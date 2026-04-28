/**
 * pagoEstadoCuentaTarjeta.service.ts — S58d v2 · TX-2
 *
 * Paga el estado de cuenta de una tarjeta de crédito. Soporta 2 modos:
 *
 *   1. 'banco_emisor': El negocio paga al banco emisor con su cuenta
 *      empresarial. Aplica solo a tarjetas con titularidad='empresa'.
 *      Calcula diferencial cambiario contra TC del cargo (Δ por cargo).
 *
 *   2. 'reembolso_titular': El negocio reembolsa al titular (empleado/
 *      colaborador) por uso de su tarjeta personal. NO hay diferencial
 *      cambiario (el titular ya lo asumió al pagar al banco con plata mixta).
 *
 * EJECUTA EN ORDEN (best-effort después de tesorería):
 *   1. Crear documento PagoEstadoCuentaTarjeta
 *   2. MovimientoTesoreria egreso desde cuenta empresarial
 *   3. MovCC crédito en CC de la tarjeta (saldo TC baja)
 *   4. Por cada aplicación a cargo:
 *      - Calcular diferencial (solo banco_emisor)
 *      - Actualizar cargo (estado, montoPagado, pagosIds, diferencial)
 *   5. Si reembolso_titular: MovCC crédito en CC del titular
 *
 * IDEMPOTENCIA: vía idempotencyKey en cada MovCC.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  updateDoc,
  addDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import type {
  PagoEstadoCuentaTarjeta,
  PagoEstadoCuentaTarjetaInput,
  PagoEstadoCuentaTarjetaResult,
  TarjetaCredito,
  CargoTarjeta,
  AplicacionPagoCargoTC,
  ModoPagoEstadoCuentaTC,
} from '../types/tarjetaCredito.types';
import type { MovimientoTesoreriaFormData } from '../types/tesoreria.types';
import { tesoreriaService } from './tesoreria.service';
import { cuentaCorrienteService } from './cuentaCorriente.service';

// ═════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═════════════════════════════════════════════════════════════════════════

const CARGOS_COLL = COLLECTIONS.CARGOS_TARJETA;
const TARJETAS_COLL = COLLECTIONS.TARJETAS_CREDITO;
const PAGOS_COLL = COLLECTIONS.PAGOS_ESTADO_CUENTA_TC;
const TOLERANCIA = 0.01;

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

async function generarNumeroPago(): Promise<string> {
  const year = new Date().getFullYear();
  return getNextSequenceNumber(`PEC-${year}`, 4);
}

function generarIdempotencyKey(input: PagoEstadoCuentaTarjetaInput): string {
  const apps = input.aplicaciones
    .map((a) => `${a.cargoId}:${a.montoAplicado.toFixed(2)}`)
    .sort()
    .join('|');
  const fechaIso = input.fecha.toISOString().split('T')[0];
  return `pec:${input.tarjetaCreditoId}:${fechaIso}:${input.moneda}:${input.monto.toFixed(2)}:${apps}`;
}

/**
 * Calcula el diferencial cambiario para un cargo.
 * Δ (PEN) = (cargo.tcDelDia - tcPago) × montoAplicado
 * Positivo = ganancia (TC subió desde el cargo · USD entró más barato)
 * Negativo = pérdida (TC bajó desde el cargo)
 */
function calcularDiferencial(
  cargoTcDelDia: number,
  tcPago: number,
  montoAplicado: number,
): number {
  return (cargoTcDelDia - tcPago) * montoAplicado;
}

// ═════════════════════════════════════════════════════════════════════════
// API PÚBLICA
// ═════════════════════════════════════════════════════════════════════════

/**
 * Ejecuta TX-2 · Pagar estado de cuenta de tarjeta.
 */
export async function ejecutar(
  input: PagoEstadoCuentaTarjetaInput,
  userId: string,
): Promise<PagoEstadoCuentaTarjetaResult> {
  // ─── 1. Validaciones ────────────────────────────────────────────────
  if (!input.tarjetaCreditoId) throw new Error('tarjetaCreditoId requerido');
  if (input.monto <= 0) throw new Error('monto debe ser > 0');
  if (input.tipoCambio <= 0) throw new Error('tipoCambio debe ser > 0');
  if (!input.cuentaOrigenId) throw new Error('cuentaOrigenId requerido');
  if (!input.aplicaciones || input.aplicaciones.length === 0)
    throw new Error('Debe haber al menos 1 aplicación a cargo');

  // Σ aplicaciones === monto
  const sumaApp = input.aplicaciones.reduce(
    (s, a) => s + a.montoAplicado,
    0,
  );
  if (Math.abs(sumaApp - input.monto) > TOLERANCIA) {
    throw new Error(
      `Suma aplicaciones (${sumaApp.toFixed(2)}) ≠ monto (${input.monto.toFixed(2)})`,
    );
  }

  // Cargar tarjeta + inferir modo
  const tarjetaSnap = await getDoc(
    doc(db, TARJETAS_COLL, input.tarjetaCreditoId),
  );
  if (!tarjetaSnap.exists()) throw new Error('Tarjeta no encontrada');
  const tarjeta = { id: tarjetaSnap.id, ...tarjetaSnap.data() } as TarjetaCredito;

  const titularidadEfectiva = tarjeta.titularidad ?? 'empresa';
  const modo: ModoPagoEstadoCuentaTC =
    input.modo ??
    (titularidadEfectiva === 'personal' ? 'reembolso_titular' : 'banco_emisor');

  // Validar coherencia modo vs titularidad
  if (modo === 'reembolso_titular' && titularidadEfectiva !== 'personal') {
    throw new Error(
      `Modo 'reembolso_titular' requiere titularidad='personal' en la tarjeta`,
    );
  }
  if (modo === 'reembolso_titular' && !tarjeta.titularEntidadId) {
    throw new Error(
      `Tarjeta personal sin titularEntidadId — no se puede reembolsar`,
    );
  }

  // Validar cuenta origen existe
  const cuenta = await tesoreriaService.getCuentaById(input.cuentaOrigenId);
  if (!cuenta) throw new Error('Cuenta origen no encontrada');

  // Validar cargos existen y montos no exceden pendiente
  const cargosResolvidos = new Map<string, CargoTarjeta>();
  for (const app of input.aplicaciones) {
    const cargoSnap = await getDoc(doc(db, CARGOS_COLL, app.cargoId));
    if (!cargoSnap.exists())
      throw new Error(`Cargo ${app.cargoNumero} no existe`);
    const cargo = { id: cargoSnap.id, ...cargoSnap.data() } as CargoTarjeta;
    if (cargo.estado === 'pagado')
      throw new Error(`Cargo ${cargo.numeroCargo} ya está pagado`);
    if (cargo.tarjetaCreditoId !== input.tarjetaCreditoId) {
      throw new Error(
        `Cargo ${cargo.numeroCargo} no pertenece a esta tarjeta`,
      );
    }
    if (app.montoAplicado > cargo.montoPendiente + TOLERANCIA) {
      throw new Error(
        `Cargo ${cargo.numeroCargo}: monto (${app.montoAplicado.toFixed(2)}) excede pendiente (${cargo.montoPendiente.toFixed(2)})`,
      );
    }
    cargosResolvidos.set(app.cargoId, cargo);
  }

  // ─── 2. Idempotencia ────────────────────────────────────────────────
  const idempotencyKey = input.idempotencyKey ?? generarIdempotencyKey(input);

  // ─── 3. Crear documento PagoEstadoCuentaTarjeta ─────────────────────
  const numeroPago = await generarNumeroPago();
  const baseDoc: Record<string, unknown> = {
    numeroPago,
    tarjetaCreditoId: tarjeta.id,
    tarjetaCreditoNombre: tarjeta.nombre,
    modo,
    fecha: Timestamp.fromDate(input.fecha),
    moneda: input.moneda,
    monto: input.monto,
    tipoCambio: input.tipoCambio,
    cuentaOrigenId: cuenta.id,
    cuentaOrigenNombre: cuenta.nombre,
    metodo: input.metodo,
    aplicaciones: input.aplicaciones, // se actualiza luego con diferenciales
    creadoPor: userId,
    fechaCreacion: Timestamp.now(),
  };
  if (input.fuenteTipoCambio) baseDoc.fuenteTipoCambio = input.fuenteTipoCambio;
  if (input.referencia) baseDoc.referencia = input.referencia;
  if (input.notas) baseDoc.notas = input.notas;
  if (modo === 'reembolso_titular') {
    baseDoc.titularEntidadId = tarjeta.titularEntidadId;
    baseDoc.titularEntidadTipo = tarjeta.titularEntidadTipo;
    baseDoc.titularNombre = tarjeta.titularNombre;
  }

  const pagoRef = await addDoc(collection(db, PAGOS_COLL), baseDoc);
  const pagoId = pagoRef.id;

  // ─── 4. Movimiento de tesorería (egreso) ────────────────────────────
  const conceptoTesoreria =
    modo === 'banco_emisor'
      ? `Pago al banco emisor · TC ${tarjeta.nombre} · ${numeroPago}`
      : `Reembolso a ${tarjeta.titularNombre || 'titular'} por uso de TC ${tarjeta.nombre} · ${numeroPago}`;

  let movimientoTesoreriaId = '';
  try {
    const tesoreriaData: MovimientoTesoreriaFormData = {
      tipo: modo === 'banco_emisor' ? 'pago_orden_compra' : 'pago_proveedor_local',
      moneda: input.moneda,
      monto: input.monto,
      tipoCambio: input.tipoCambio,
      metodo: input.metodo,
      concepto: conceptoTesoreria,
      fecha: input.fecha,
      cuentaOrigen: input.cuentaOrigenId,
    };
    if (input.referencia) tesoreriaData.referencia = input.referencia;
    if (input.notas) tesoreriaData.notas = input.notas;

    movimientoTesoreriaId = await tesoreriaService.registrarMovimiento(
      tesoreriaData,
      userId,
    );
    await updateDoc(doc(db, PAGOS_COLL, pagoId), {
      movimientoTesoreriaId,
    });
  } catch (err) {
    logger.error(
      '[PagoEstadoCuentaTarjeta] Error tesorería — abortando',
      err,
    );
    throw new Error(
      `No se pudo registrar movimiento de tesorería: ${err instanceof Error ? err.message : 'desconocido'}`,
    );
  }

  // ─── 5. MovCC crédito en CC de la tarjeta ───────────────────────────
  let movimientoCCTarjetaId = '';
  try {
    const result = await cuentaCorrienteService.registrarMovimiento(
      {
        entidadId: tarjeta.id,
        tipo: 'tarjeta_credito',
        entidadNombre: tarjeta.nombre,
        tipoMovimiento: 'credito_pago_estado_cuenta_tc',
        descripcion:
          modo === 'banco_emisor'
            ? `Pago al banco · ${numeroPago} · ${input.aplicaciones.length} cargos`
            : `Reembolso titular · ${numeroPago} · ${input.aplicaciones.length} cargos`,
        moneda: input.moneda,
        monto: input.monto,
        fecha: input.fecha,
        refDocumentoTipo: 'pago_estado_cuenta_tc',
        refDocumentoId: pagoId,
        refDocumentoNumero: numeroPago,
        movimientoTesoreriaId,
        idempotencyKey,
      },
      userId,
    );
    movimientoCCTarjetaId = result.movimientoId;
    await updateDoc(doc(db, PAGOS_COLL, pagoId), { movimientoCCTarjetaId });
  } catch (err) {
    logger.error('[PagoEstadoCuentaTarjeta] Error MovCC TC', err);
    throw new Error(
      `No se pudo registrar crédito en CC de tarjeta: ${err instanceof Error ? err.message : 'desconocido'}`,
    );
  }

  // ─── 6. Aplicar a cada cargo + diferencial ──────────────────────────
  const errores: string[] = [];
  let cargosActualizados = 0;
  let diferencialTotal = 0;
  const aplicacionesConDiferencial: AplicacionPagoCargoTC[] = [];

  for (const app of input.aplicaciones) {
    const cargo = cargosResolvidos.get(app.cargoId)!;
    try {
      let diferencial = 0;
      if (modo === 'banco_emisor' && cargo.tcDelDia) {
        diferencial = calcularDiferencial(
          cargo.tcDelDia,
          input.tipoCambio,
          app.montoAplicado,
        );
        diferencialTotal += diferencial;
      }

      // Actualizar cargo
      const nuevoMontoPagado = cargo.montoPagado + app.montoAplicado;
      const nuevoPendiente = Math.max(0, cargo.monto - nuevoMontoPagado);
      const nuevoEstado: 'pendiente' | 'parcial' | 'pagado' =
        nuevoPendiente <= TOLERANCIA
          ? 'pagado'
          : nuevoMontoPagado > TOLERANCIA
            ? 'parcial'
            : 'pendiente';

      const cargoUpdates: Record<string, unknown> = {
        estado: nuevoEstado,
        montoPagado: nuevoMontoPagado,
        montoPendiente: nuevoPendiente,
        pagosIds: [...(cargo.pagosIds || []), pagoId],
      };
      if (modo === 'banco_emisor') {
        cargoUpdates.diferencialCambiarioPEN =
          (cargo.diferencialCambiarioPEN || 0) + diferencial;
      }
      await updateDoc(doc(db, CARGOS_COLL, cargo.id), cargoUpdates);

      aplicacionesConDiferencial.push({
        ...app,
        diferencialCambiarioPEN:
          modo === 'banco_emisor' ? diferencial : undefined,
      });
      cargosActualizados++;
    } catch (err) {
      const msg = `Cargo ${app.cargoNumero}: ${
        err instanceof Error ? err.message : 'error'
      }`;
      logger.error(`[PagoEstadoCuentaTarjeta] ${msg}`, err);
      errores.push(msg);
      aplicacionesConDiferencial.push(app);
    }
  }

  // Update pago con aplicaciones (con diferencial inyectado) + total
  await updateDoc(doc(db, PAGOS_COLL, pagoId), {
    aplicaciones: aplicacionesConDiferencial,
    diferencialCambiarioPENTotal:
      modo === 'banco_emisor' ? diferencialTotal : undefined,
  });

  // ─── 7. Si reembolso_titular: MovCC crédito en CC del titular ───────
  let movimientoCCTitularId: string | undefined;
  if (modo === 'reembolso_titular' && tarjeta.titularEntidadId) {
    try {
      const result = await cuentaCorrienteService.registrarMovimiento(
        {
          entidadId: tarjeta.titularEntidadId,
          tipo: tarjeta.titularEntidadTipo!,
          entidadNombre: tarjeta.titularNombre || 'Titular',
          tipoMovimiento: 'credito_pago_estado_cuenta_tc',
          descripcion:
            `Reembolso por uso de TC ${tarjeta.nombre} · ${numeroPago} · ` +
            `${input.aplicaciones.length} cargos`,
          moneda: input.moneda,
          monto: input.monto,
          fecha: input.fecha,
          refDocumentoTipo: 'pago_estado_cuenta_tc',
          refDocumentoId: pagoId,
          refDocumentoNumero: numeroPago,
          movimientoTesoreriaId,
          idempotencyKey: `${idempotencyKey}:titular`,
        },
        userId,
      );
      movimientoCCTitularId = result.movimientoId;
      await updateDoc(doc(db, PAGOS_COLL, pagoId), {
        movimientoCCTitularId,
      });
    } catch (err) {
      const msg = `MovCC titular: ${err instanceof Error ? err.message : 'error'}`;
      logger.error(`[PagoEstadoCuentaTarjeta] ${msg}`, err);
      errores.push(msg);
    }
  }

  // ─── 8. Resultado ───────────────────────────────────────────────────
  if (errores.length === 0) {
    logger.success(
      `[PagoEstadoCuentaTarjeta] OK · ${numeroPago} · modo=${modo} · ` +
        `${input.moneda} ${input.monto.toFixed(2)} → ${cargosActualizados} cargos` +
        (modo === 'banco_emisor'
          ? ` · Δ=${diferencialTotal.toFixed(2)} PEN`
          : ''),
    );
  } else {
    logger.warn(
      `[PagoEstadoCuentaTarjeta] PARCIAL · ${numeroPago} · ${errores.length} errores`,
    );
  }

  return {
    pagoId,
    numeroPago,
    movimientoTesoreriaId,
    movimientoCCTarjetaId,
    movimientoCCTitularId,
    cargosActualizados,
    diferencialCambiarioPENTotal: diferencialTotal,
    errores,
  };
}

/**
 * Lista cargos pendientes de una tarjeta.
 */
export async function getCargosPendientes(
  tarjetaCreditoId: string,
): Promise<CargoTarjeta[]> {
  const q = query(
    collection(db, CARGOS_COLL),
    where('tarjetaCreditoId', '==', tarjetaCreditoId),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as CargoTarjeta)
    .filter((c) => c.estado !== 'pagado');
}

/**
 * Lista todos los cargos de una tarjeta (cualquier estado).
 */
export async function getCargosByTarjeta(
  tarjetaCreditoId: string,
): Promise<CargoTarjeta[]> {
  const q = query(
    collection(db, CARGOS_COLL),
    where('tarjetaCreditoId', '==', tarjetaCreditoId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CargoTarjeta);
}

/**
 * Lista todos los pagos de estado de cuenta de una tarjeta.
 * Ordenados por fecha desc (los más recientes primero).
 */
export async function getPagosByTarjeta(
  tarjetaCreditoId: string,
): Promise<PagoEstadoCuentaTarjeta[]> {
  const q = query(
    collection(db, PAGOS_COLL),
    where('tarjetaCreditoId', '==', tarjetaCreditoId),
  );
  const snap = await getDocs(q);
  const pagos = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as PagoEstadoCuentaTarjeta,
  );
  // Ordenar por fecha desc en memoria (Firestore index podría requerir composite)
  pagos.sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
  return pagos;
}

// ═════════════════════════════════════════════════════════════════════════
// FACADE
// ═════════════════════════════════════════════════════════════════════════

export const pagoEstadoCuentaTarjetaService = {
  ejecutar,
  getCargosPendientes,
  getCargosByTarjeta,
  getPagosByTarjeta,
};

export type { PagoEstadoCuentaTarjeta };
