/**
 * planilla.service.ts
 *
 * CRUD de perfiles laborales (subcoleccion private), boletas y adelantos.
 * Orquesta generación de boletas con cálculo automático de comisiones.
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import { userService } from './user.service';
import { gastoService } from './gasto.service';
import { categoriaCostoService } from './categoriaCosto.service';
import { resolverCategoriaCostoIdParaTipo, type ArbolCategorias } from '../utils/gasto.bloque';
import { calcularComisionesEmpleado } from './planilla.comisiones.service';
// S55 Fase 5 — CC del empleado
import { cuentaCorrienteService } from './cuentaCorriente.service';
import type { UserProfile } from '../types/auth.types';
import type {
  PerfilLaboral,
  PerfilLaboralFormData,
  EmpleadoConPerfil,
  Boleta,
  AdelantoNomina,
  AdelantoFormData,
  BoletaAjustes,
  DetalleAdelanto,
} from '../types/planilla.types';

// ============================================
// HELPERS
// ============================================

/** Elimina campos undefined de un objeto (Firestore no los acepta) */
function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  const cleaned = {} as any;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) cleaned[key] = value;
  }
  return cleaned;
}

// ============================================
// PERFIL LABORAL (subcoleccion users/{uid}/private)
// ============================================

const PRIVATE_DOC_ID = 'laboral';

function getPrivateRef(userId: string) {
  return doc(db, COLLECTIONS.USERS, userId, 'private', PRIVATE_DOC_ID);
}

export const planillaService = {
  // --- Perfil Laboral ---

  async getPerfilLaboral(userId: string): Promise<PerfilLaboral | null> {
    const snap = await getDoc(getPrivateRef(userId));
    return snap.exists() ? (snap.data() as PerfilLaboral) : null;
  },

  async guardarPerfilLaboral(userId: string, data: PerfilLaboralFormData): Promise<void> {
    // Firestore no acepta undefined — limpiar campos opcionales
    const perfil: Record<string, any> = { activo: true };
    perfil.tipo = data.tipo;
    perfil.monedaSalario = data.monedaSalario;
    if (data.salarioBase != null) perfil.salarioBase = data.salarioBase;
    if (data.esquemaComision) perfil.esquemaComision = data.esquemaComision;
    if (data.lineaNegocioId) perfil.lineaNegocioId = data.lineaNegocioId;
    if (data.banco) perfil.banco = data.banco;
    if (data.numeroCuenta) perfil.numeroCuenta = data.numeroCuenta;
    if (data.cci) perfil.cci = data.cci;
    await setDoc(getPrivateRef(userId), perfil, { merge: true });
  },

  async desactivarPerfilLaboral(userId: string): Promise<void> {
    await updateDoc(getPrivateRef(userId), { activo: false });
  },

  async eliminarPerfilLaboral(userId: string): Promise<void> {
    await deleteDoc(getPrivateRef(userId));
  },

  /**
   * Obtiene todos los usuarios con su perfil laboral (si existe).
   */
  async getEmpleados(): Promise<EmpleadoConPerfil[]> {
    const usuarios = await userService.getActivos();
    const empleados: EmpleadoConPerfil[] = [];

    for (const user of usuarios) {
      const perfil = await this.getPerfilLaboral(user.uid);
      empleados.push({
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        cargo: user.cargo,
        role: user.role,
        activo: user.activo,
        perfilLaboral: perfil || undefined,
      });
    }

    return empleados;
  },

  /**
   * Obtiene solo empleados con perfil laboral activo.
   */
  async getEmpleadosActivos(): Promise<EmpleadoConPerfil[]> {
    const todos = await this.getEmpleados();
    return todos.filter(e => e.perfilLaboral?.activo);
  },

  // ============================================
  // BOLETAS
  // ============================================

  async getBoleta(boletaId: string): Promise<Boleta | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.BOLETAS, boletaId));
    return snap.exists() ? (snap.data() as Boleta) : null;
  },

  async getBoletasPorPeriodo(mes: number, anio: number): Promise<Boleta[]> {
    const ref = collection(db, COLLECTIONS.BOLETAS);
    const q = query(ref, where('mes', '==', mes), where('anio', '==', anio));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Boleta);
  },

  /**
   * Genera boletas borrador para todos los empleados activos del periodo.
   */
  async generarBoletasMes(
    mes: number,
    anio: number,
    userId: string
  ): Promise<Boleta[]> {
    // Verificar que no existan boletas para el periodo
    const existentes = await this.getBoletasPorPeriodo(mes, anio);
    if (existentes.length > 0) {
      throw new Error(`Ya existen ${existentes.length} boletas para ${mes}/${anio}. Elimínalas primero si quieres regenerar.`);
    }

    const empleados = await this.getEmpleadosActivos();
    if (empleados.length === 0) {
      throw new Error('No hay empleados activos con perfil laboral configurado.');
    }

    const boletas: Boleta[] = [];
    const prefix = `BOL-${anio}-${String(mes).padStart(2, '0')}`;

    for (const emp of empleados) {
      const perfil = emp.perfilLaboral!;

      // Calcular comisiones si tiene esquema
      let comisionesVentas = 0;
      let detalleComisiones: any[] = [];
      if (perfil.esquemaComision) {
        const resultado = await calcularComisionesEmpleado(
          emp.uid,
          perfil.esquemaComision,
          mes,
          anio
        );
        comisionesVentas = resultado.total;
        detalleComisiones = resultado.detalle;
      }

      // Obtener adelantos pendientes de descuento
      const adelantosPendientes = await this.getAdelantosPendientesDescuento(emp.uid);
      const montoAdelantos = adelantosPendientes.reduce((sum, a) => sum + a.montoPEN, 0);
      const detalleAdelantos: DetalleAdelanto[] = adelantosPendientes.map(a => ({
        adelantoId: a.id,
        monto: a.montoPEN,
      }));

      const salarioBase = perfil.salarioBase || 0;
      const totalBruto = salarioBase + comisionesVentas;
      const totalDescuentos = montoAdelantos;
      const totalNeto = Math.max(0, totalBruto - totalDescuentos);

      const numero = await getNextSequenceNumber(prefix, 3);
      const boletaId = `${prefix}-${numero}`;

      const boleta: Boleta = {
        id: boletaId,
        userId: emp.uid,
        empleadoNombre: emp.displayName,
        empleadoCargo: emp.cargo,
        mes,
        anio,
        salarioBase,
        comisionesVentas,
        bonificaciones: 0,
        otrosIngresos: 0,
        totalBruto,
        detalleComisiones,
        adelantos: montoAdelantos,
        otrosDescuentos: 0,
        totalDescuentos,
        detalleAdelantos,
        totalNeto,
        estado: 'borrador',
        lineaNegocioId: perfil.lineaNegocioId || undefined,
        creadoPor: userId,
        fechaCreacion: Timestamp.now(),
      };

      await setDoc(doc(db, COLLECTIONS.BOLETAS, boletaId), cleanUndefined(boleta));
      boletas.push(boleta);
    }

    return boletas;
  },

  /**
   * Ajustar bonificaciones/descuentos de una boleta borrador.
   */
  async ajustarBoleta(boletaId: string, ajustes: BoletaAjustes): Promise<void> {
    const boleta = await this.getBoleta(boletaId);
    if (!boleta) throw new Error('Boleta no encontrada');
    if (boleta.estado !== 'borrador') throw new Error('Solo se pueden ajustar boletas en borrador');

    const totalBruto = boleta.salarioBase + boleta.comisionesVentas + ajustes.bonificaciones + ajustes.otrosIngresos;
    const totalDescuentos = boleta.adelantos + ajustes.otrosDescuentos;
    const totalNeto = Math.max(0, totalBruto - totalDescuentos);

    await updateDoc(doc(db, COLLECTIONS.BOLETAS, boletaId), {
      bonificaciones: ajustes.bonificaciones,
      otrosIngresos: ajustes.otrosIngresos,
      otrosDescuentos: ajustes.otrosDescuentos,
      totalBruto,
      totalDescuentos,
      totalNeto,
    });
  },

  /**
   * Aprobar una boleta borrador.
   */
  async aprobarBoleta(boletaId: string, userId: string): Promise<void> {
    const boleta = await this.getBoleta(boletaId);
    if (!boleta) throw new Error('Boleta no encontrada');
    if (boleta.estado !== 'borrador') throw new Error('Solo se pueden aprobar boletas en borrador');

    await updateDoc(doc(db, COLLECTIONS.BOLETAS, boletaId), {
      estado: 'aprobada',
      aprobadoPor: userId,
      fechaAprobacion: Timestamp.now(),
    });

    // S55 Fase 5 — Crear movimiento `debito_boleta_emitida` en CC del empleado.
    // La empresa reconoce la deuda por el totalNeto. CC saldo PEN se vuelve
    // negativo (le debemos al empleado). Cuando se pague la boleta, se salda
    // con `credito_pago_boleta`.
    // No bloqueante: si falla, queda log warning y se ajusta manual.
    if (boleta.userId && (boleta.totalNeto || 0) > 0) {
      try {
        await cuentaCorrienteService.registrarMovimiento(
          {
            entidadId: boleta.userId,
            tipo: 'empleado',
            entidadNombre: boleta.empleadoNombre,
            tipoMovimiento: 'debito_boleta_emitida',
            descripcion: `Boleta ${String(boleta.mes).padStart(2, '0')}/${boleta.anio} aprobada · neto S/ ${boleta.totalNeto.toFixed(2)}`,
            // Convención CC: debito_* SUMA al saldo. Para representar "empresa
            // le debe al empleado", usamos signo negativo via crédito puro.
            // Pero `debito_boleta_emitida` está en TIPOS_DEBITO (suma). El
            // empleado nos "debe" su trabajo (devengado). Cuando le pagamos,
            // el credito_pago_boleta resta. Saldo final 0 = todo saldado.
            // Esto refleja la cuenta corriente del empleado como "crédito
            // pendiente que la empresa le debe entregar en cash".
            moneda: 'PEN',
            monto: boleta.totalNeto,
            refDocumentoTipo: 'boleta',
            refDocumentoId: boletaId,
            refDocumentoNumero: `BOL-${boleta.anio}-${String(boleta.mes).padStart(2, '0')}-${boleta.userId.slice(-4)}`,
            idempotencyKey: `aprobar_boleta_${boletaId}`,
          },
          userId,
        );
      } catch (ccErr) {
        logger.warn(
          '[CC] No se pudo crear debito_boleta_emitida (no bloqueante): ' +
            (ccErr instanceof Error ? ccErr.message : String(ccErr)),
        );
      }
    }
  },

  /**
   * Registrar pago de una boleta aprobada.
   * Crea gastos GA (sueldo) y GV (comisiones) automáticamente.
   */
  async pagarBoleta(
    boletaId: string,
    datosPago: {
      metodoPago: string;
      cuentaOrigenId: string;
      referencia?: string;
      tipoCambio: number;
    },
    userId: string
  ): Promise<void> {
    const boleta = await this.getBoleta(boletaId);
    if (!boleta) throw new Error('Boleta no encontrada');
    if (boleta.estado !== 'aprobada') throw new Error('Solo se pueden pagar boletas aprobadas');

    const fechaPago = new Date();

    // chk5.A6 · cargar árbol una vez para resolver categoriaCostoId canónicos
    const arbol = await categoriaCostoService.getArbol() as ArbolCategorias;
    const categoriaCostoIdNomina = resolverCategoriaCostoIdParaTipo('nomina', arbol);
    const categoriaCostoIdComision = resolverCategoriaCostoIdParaTipo('comision_vendedor', arbol);

    // 1. Crear gasto bloque 'periodo' (sueldo + bonificaciones) si > 0
    const montoNomina = boleta.salarioBase + boleta.bonificaciones + boleta.otrosIngresos;
    let gastoNominaId: string | undefined;
    if (montoNomina > 0) {
      gastoNominaId = await gastoService.create({
        tipo: 'nomina',
        categoria: 'GA',                              // legacy compat · @deprecated (chk5.A9)
        categoriaCostoId: categoriaCostoIdNomina ?? undefined,  // canon · bloque 'periodo' · Personal · Sueldos
        descripcion: `Planilla ${boleta.empleadoNombre} - ${String(boleta.mes).padStart(2, '0')}/${boleta.anio}`,
        moneda: 'PEN',
        montoOriginal: montoNomina,
        tipoCambio: datosPago.tipoCambio,
        esProrrateable: true,
        fecha: fechaPago,
        frecuencia: 'unico',
        estado: 'pagado',
        metodoPago: datosPago.metodoPago,
        cuentaOrigenId: datosPago.cuentaOrigenId,
        referenciaPago: datosPago.referencia,
        impactaCTRU: true,
        lineaNegocioId: boleta.lineaNegocioId || null,
        notas: `Boleta ${boleta.id}`,
      }, userId);
    }

    // 2. Crear gasto bloque 'venta' (comisiones) si > 0
    let gastoComisionId: string | undefined;
    if (boleta.comisionesVentas > 0) {
      gastoComisionId = await gastoService.create({
        tipo: 'comision_vendedor',
        categoria: 'GV',                              // legacy compat · @deprecated (chk5.A9)
        categoriaCostoId: categoriaCostoIdComision ?? undefined,  // canon · bloque 'venta' · Comisiones · Comision vendedor
        descripcion: `Comisiones ${boleta.empleadoNombre} - ${String(boleta.mes).padStart(2, '0')}/${boleta.anio} (${boleta.detalleComisiones.length} ventas)`,
        moneda: 'PEN',
        montoOriginal: boleta.comisionesVentas,
        tipoCambio: datosPago.tipoCambio,
        esProrrateable: false,
        fecha: fechaPago,
        frecuencia: 'unico',
        estado: 'pagado',
        metodoPago: datosPago.metodoPago,
        cuentaOrigenId: datosPago.cuentaOrigenId,
        referenciaPago: datosPago.referencia,
        impactaCTRU: false,
        lineaNegocioId: boleta.lineaNegocioId || null,
        notas: `Boleta ${boleta.id} - Comisiones vendedor`,
      }, userId);
    }

    // 3. Marcar adelantos como descontados + escribir credito_descuento_adelanto en CC
    for (const da of boleta.detalleAdelantos) {
      await updateDoc(doc(db, COLLECTIONS.ADELANTOS_NOMINA, da.adelantoId), {
        estado: 'descontado',
        boletaDescontadaId: boletaId,
      });

      // S55 Fase 5 — Saldar el adelanto en CC del empleado.
      // El adelanto vivía como `debito_adelanto_empleado` (positivo: empleado nos debe).
      // Al descontarlo en boleta, creamos `credito_descuento_adelanto` (resta),
      // que neutraliza el débito original. Saldo 0 = adelanto saldado.
      if (boleta.userId && da.monto > 0) {
        try {
          await cuentaCorrienteService.registrarMovimiento(
            {
              entidadId: boleta.userId,
              tipo: 'empleado',
              entidadNombre: boleta.empleadoNombre,
              tipoMovimiento: 'credito_descuento_adelanto',
              descripcion: `Adelanto ${da.adelantoId} descontado en boleta ${String(boleta.mes).padStart(2, '0')}/${boleta.anio}`,
              moneda: 'PEN',
              monto: da.monto,
              refDocumentoTipo: 'adelanto',
              refDocumentoId: da.adelantoId,
              refDocumentoNumero: da.adelantoId,
              idempotencyKey: `descuento_adelanto_${da.adelantoId}_boleta_${boletaId}`,
            },
            userId,
          );
        } catch (ccErr) {
          logger.warn(
            '[CC] No se pudo crear credito_descuento_adelanto (no bloqueante): ' +
              (ccErr instanceof Error ? ccErr.message : String(ccErr)),
          );
        }
      }
    }

    // 4. Actualizar boleta
    await updateDoc(doc(db, COLLECTIONS.BOLETAS, boletaId), {
      estado: 'pagada',
      gastoNominaId,
      gastoComisionId,
    });

    // 5. S55 Fase 5 — Crear movimiento `credito_pago_boleta` en CC del empleado.
    // Salda el debito_boleta_emitida que se creó al aprobarla. CC saldo PEN
    // del empleado vuelve a 0 (todo lo devengado pagado).
    if (boleta.userId && (boleta.totalNeto || 0) > 0) {
      try {
        await cuentaCorrienteService.registrarMovimiento(
          {
            entidadId: boleta.userId,
            tipo: 'empleado',
            entidadNombre: boleta.empleadoNombre,
            tipoMovimiento: 'credito_pago_boleta',
            descripcion: `Pago boleta ${String(boleta.mes).padStart(2, '0')}/${boleta.anio} · S/ ${boleta.totalNeto.toFixed(2)} via ${datosPago.metodoPago}`,
            moneda: 'PEN',
            monto: boleta.totalNeto,
            fecha: fechaPago,
            refDocumentoTipo: 'boleta',
            refDocumentoId: boletaId,
            refDocumentoNumero: `BOL-${boleta.anio}-${String(boleta.mes).padStart(2, '0')}-${boleta.userId.slice(-4)}`,
            idempotencyKey: `pagar_boleta_${boletaId}`,
            notas: datosPago.referencia,
          },
          userId,
        );
      } catch (ccErr) {
        logger.warn(
          '[CC] No se pudo crear credito_pago_boleta (no bloqueante): ' +
            (ccErr instanceof Error ? ccErr.message : String(ccErr)),
        );
      }
    }
  },

  /**
   * Anular una boleta (solo borrador o aprobada, no pagada).
   */
  async anularBoleta(boletaId: string): Promise<void> {
    const boleta = await this.getBoleta(boletaId);
    if (!boleta) throw new Error('Boleta no encontrada');
    if (boleta.estado === 'pagada') throw new Error('No se puede anular una boleta ya pagada');

    const estadoPrevio = boleta.estado;

    await updateDoc(doc(db, COLLECTIONS.BOLETAS, boletaId), {
      estado: 'anulada',
    });

    // S55 Fase 5 — Si la boleta estaba 'aprobada', había un debito_boleta_emitida
    // en CC. Al anular, lo revertimos con un ajuste manual (los movs CC son
    // inmutables). Boletas en 'borrador' no tienen movimiento CC asociado.
    if (estadoPrevio === 'aprobada' && boleta.userId && (boleta.totalNeto || 0) > 0) {
      try {
        await cuentaCorrienteService.ajusteManual({
          entidadId: boleta.userId,
          tipo: 'empleado',
          entidadNombre: boleta.empleadoNombre,
          monto: boleta.totalNeto,
          moneda: 'PEN',
          direccion: 'credito', // resta el debito_boleta_emitida original
          motivo: `Anulación boleta ${String(boleta.mes).padStart(2, '0')}/${boleta.anio}`,
          userId: 'system',
        });
      } catch (ccErr) {
        logger.warn(
          '[CC] No se pudo crear ajuste anulación boleta (no bloqueante): ' +
            (ccErr instanceof Error ? ccErr.message : String(ccErr)),
        );
      }
    }
  },

  async eliminarBoleta(boletaId: string): Promise<void> {
    const boleta = await this.getBoleta(boletaId);
    if (!boleta) throw new Error('Boleta no encontrada');
    if (boleta.estado === 'pagada') throw new Error('No se puede eliminar una boleta pagada');
    await deleteDoc(doc(db, COLLECTIONS.BOLETAS, boletaId));
  },

  // ============================================
  // ADELANTOS
  // ============================================

  async getAdelantos(maxResults: number = 100): Promise<AdelantoNomina[]> {
    const ref = collection(db, COLLECTIONS.ADELANTOS_NOMINA);
    const q = query(ref, orderBy('fechaCreacion', 'desc'), limit(maxResults));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AdelantoNomina);
  },

  async getAdelantosPorEmpleado(userId: string): Promise<AdelantoNomina[]> {
    const ref = collection(db, COLLECTIONS.ADELANTOS_NOMINA);
    const q = query(ref, where('userId', '==', userId), orderBy('fechaCreacion', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AdelantoNomina);
  },

  async getAdelantosPendientesDescuento(userId: string): Promise<AdelantoNomina[]> {
    const ref = collection(db, COLLECTIONS.ADELANTOS_NOMINA);
    const q = query(
      ref,
      where('userId', '==', userId),
      where('estado', '==', 'pagado')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AdelantoNomina);
  },

  async crearAdelanto(data: AdelantoFormData, userId: string): Promise<string> {
    const year = new Date().getFullYear();
    const numero = await getNextSequenceNumber(`ADL-${year}`, 3);
    const adelantoId = `ADL-${year}-${numero}`;

    const montoPEN = data.moneda === 'PEN'
      ? data.monto
      : data.monto * (data.tipoCambio || 1);

    const adelanto: AdelantoNomina = {
      id: adelantoId,
      userId: data.userId,
      empleadoNombre: data.empleadoNombre,
      tipo: data.tipo,
      descripcion: data.descripcion,
      monto: data.monto,
      moneda: data.moneda,
      tipoCambio: data.tipoCambio,
      montoPEN,
      estado: 'pendiente',
      lineaNegocioId: data.lineaNegocioId,
      fecha: Timestamp.now(),
      creadoPor: userId,
      fechaCreacion: Timestamp.now(),
    };

    await setDoc(doc(db, COLLECTIONS.ADELANTOS_NOMINA, adelantoId), cleanUndefined(adelanto));
    return adelantoId;
  },

  /**
   * Marca un adelanto como pagado (después de registrar el movimiento de tesorería).
   */
  async marcarAdelantoPagado(adelantoId: string, movimientoTesoreriaId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.ADELANTOS_NOMINA, adelantoId), {
      estado: 'pagado',
      movimientoTesoreriaId,
    });

    // S55 Fase 5 — Crear movimiento `debito_adelanto_empleado` en CC del empleado.
    // El empleado nos debe ese monto (lo descontaremos en su próxima boleta).
    // Saldo CC del empleado: positivo = empleado nos debe.
    // Cuando se descuente en boleta, `credito_descuento_adelanto` lo salda.
    try {
      const adelantoSnap = await getDoc(doc(db, COLLECTIONS.ADELANTOS_NOMINA, adelantoId));
      if (!adelantoSnap.exists()) return;
      const adelanto = adelantoSnap.data() as AdelantoNomina;
      if (!adelanto.userId || (adelanto.montoPEN || 0) <= 0) return;

      await cuentaCorrienteService.registrarMovimiento(
        {
          entidadId: adelanto.userId,
          tipo: 'empleado',
          entidadNombre: adelanto.empleadoNombre,
          tipoMovimiento: 'debito_adelanto_empleado',
          descripcion: `Adelanto ${adelantoId} pagado · ${adelanto.descripcion || adelanto.tipo}`,
          moneda: 'PEN',
          monto: adelanto.montoPEN,
          refDocumentoTipo: 'adelanto',
          refDocumentoId: adelantoId,
          refDocumentoNumero: adelantoId,
          movimientoTesoreriaId,
          idempotencyKey: `adelanto_pagado_${adelantoId}`,
        },
        adelanto.creadoPor || 'system',
      );
    } catch (ccErr) {
      logger.warn(
        '[CC] No se pudo crear debito_adelanto_empleado (no bloqueante): ' +
          (ccErr instanceof Error ? ccErr.message : String(ccErr)),
      );
    }
  },

  async anularAdelanto(adelantoId: string): Promise<void> {
    const ref = doc(db, COLLECTIONS.ADELANTOS_NOMINA, adelantoId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Adelanto no encontrado');
    const adelanto = snap.data() as AdelantoNomina;
    if (adelanto.estado === 'descontado') throw new Error('No se puede anular un adelanto ya descontado');

    const estadoPrevio = adelanto.estado;
    await updateDoc(ref, { estado: 'anulado' });

    // S55 Fase 5 — Si el adelanto estaba 'pagado', había un
    // debito_adelanto_empleado en CC. Al anular lo revertimos con ajuste
    // manual. Adelantos en 'pendiente' no tienen movimiento CC asociado.
    if (estadoPrevio === 'pagado' && adelanto.userId && (adelanto.montoPEN || 0) > 0) {
      try {
        await cuentaCorrienteService.ajusteManual({
          entidadId: adelanto.userId,
          tipo: 'empleado',
          entidadNombre: adelanto.empleadoNombre,
          monto: adelanto.montoPEN,
          moneda: 'PEN',
          direccion: 'credito', // resta el debito_adelanto_empleado original
          motivo: `Anulación adelanto ${adelantoId}`,
          userId: 'system',
        });
      } catch (ccErr) {
        logger.warn(
          '[CC] No se pudo crear ajuste anulación adelanto (no bloqueante): ' +
            (ccErr instanceof Error ? ccErr.message : String(ccErr)),
        );
      }
    }
  },
};
