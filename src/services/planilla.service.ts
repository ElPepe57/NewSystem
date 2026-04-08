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
import { calcularComisionesEmpleado } from './planilla.comisiones.service';
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

    // 1. Crear gasto GA (sueldo + bonificaciones) si > 0
    const montoNomina = boleta.salarioBase + boleta.bonificaciones + boleta.otrosIngresos;
    let gastoNominaId: string | undefined;
    if (montoNomina > 0) {
      gastoNominaId = await gastoService.create({
        tipo: 'nomina',
        categoria: 'GA',
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

    // 2. Crear gasto GV (comisiones) si > 0
    let gastoComisionId: string | undefined;
    if (boleta.comisionesVentas > 0) {
      gastoComisionId = await gastoService.create({
        tipo: 'comision_vendedor',
        categoria: 'GV',
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

    // 3. Marcar adelantos como descontados
    for (const da of boleta.detalleAdelantos) {
      await updateDoc(doc(db, COLLECTIONS.ADELANTOS_NOMINA, da.adelantoId), {
        estado: 'descontado',
        boletaDescontadaId: boletaId,
      });
    }

    // 4. Actualizar boleta
    await updateDoc(doc(db, COLLECTIONS.BOLETAS, boletaId), {
      estado: 'pagada',
      gastoNominaId,
      gastoComisionId,
    });
  },

  /**
   * Anular una boleta (solo borrador o aprobada, no pagada).
   */
  async anularBoleta(boletaId: string): Promise<void> {
    const boleta = await this.getBoleta(boletaId);
    if (!boleta) throw new Error('Boleta no encontrada');
    if (boleta.estado === 'pagada') throw new Error('No se puede anular una boleta ya pagada');

    await updateDoc(doc(db, COLLECTIONS.BOLETAS, boletaId), {
      estado: 'anulada',
    });
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
  },

  async anularAdelanto(adelantoId: string): Promise<void> {
    const ref = doc(db, COLLECTIONS.ADELANTOS_NOMINA, adelantoId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Adelanto no encontrado');
    const adelanto = snap.data() as AdelantoNomina;
    if (adelanto.estado === 'descontado') throw new Error('No se puede anular un adelanto ya descontado');
    await updateDoc(ref, { estado: 'anulado' });
  },
};
