/**
 * revisionMensual.service.ts · canon v5.2 chk5.E-RM
 *
 * Reemplaza cierreContable.service.ts (deprecated).
 *
 * Diferencias clave:
 * - NO bloquea modificaciones del período
 * - NO genera snapshot inmutable
 * - NO requiere motivo para "re-abrir" (no hay reapertura · es solo un log)
 * - Marcar como revisado es OPCIONAL · solo agrega entry al historial
 *
 * Además expone helpers para construir el panel de Conciliación Bancaria
 * leyendo el estado de las cuentas (saldoActual + ultimaVerificacion).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';
import type {
  RevisionMensual,
  EstadoConciliacion,
  ConciliacionCuenta,
  ResumenConciliacion,
} from '../types/revisionMensual.types';
import type { CuentaCaja } from '../types/tesoreria.types';

// ============================================================================
// REVISION MENSUAL · CRUD informal
// ============================================================================

/**
 * Construir ID determinístico para período · "2026-05"
 */
function buildRevisionId(mes: number, anio: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

/**
 * Obtener revisión de un período · null si no existe (estado: sin_revisar implícito)
 */
export async function getRevisionMensual(
  mes: number,
  anio: number,
): Promise<RevisionMensual | null> {
  try {
    const id = buildRevisionId(mes, anio);
    const ref = doc(db, COLLECTIONS.REVISIONES_MENSUALES, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as RevisionMensual;
  } catch (err) {
    logger.warn('Error obteniendo revisión mensual:', err);
    return null;
  }
}

/**
 * Marcar período como revisado (acción opcional · solo agrega log)
 *
 * Si ya estaba "revisado", actualiza la fecha (re-revisión).
 * NO bloquea modificaciones del período · NO genera snapshot.
 */
export async function marcarComoRevisado(input: {
  mes: number;
  anio: number;
  userId: string;
  userNombre?: string;
  observaciones?: string;
  alertasDetectadas?: number;
  utilidadNetaSnapshot?: number;
}): Promise<RevisionMensual> {
  const { mes, anio, userId, userNombre, observaciones, alertasDetectadas, utilidadNetaSnapshot } =
    input;

  if (!userId) throw new Error('userId requerido para audit trail');
  if (mes < 1 || mes > 12) throw new Error('mes inválido');

  const id = buildRevisionId(mes, anio);
  const ref = doc(db, COLLECTIONS.REVISIONES_MENSUALES, id);

  const revision: Record<string, unknown> = {
    mes,
    anio,
    estado: 'revisado',
    revisadoPor: userId,
    fechaRevision: Timestamp.now(),
    fechaActualizacion: Timestamp.now(),
  };

  if (userNombre) revision.revisadoPorNombre = userNombre;
  if (observaciones?.trim()) revision.observaciones = observaciones.trim();
  if (typeof alertasDetectadas === 'number') revision.alertasDetectadas = alertasDetectadas;
  if (typeof utilidadNetaSnapshot === 'number') revision.utilidadNetaSnapshot = utilidadNetaSnapshot;

  await setDoc(ref, revision, { merge: true });

  return {
    id,
    mes,
    anio,
    estado: 'revisado',
    revisadoPor: userId,
    revisadoPorNombre: userNombre,
    fechaRevision: revision.fechaRevision as Timestamp,
    observaciones: observaciones?.trim(),
    alertasDetectadas,
    utilidadNetaSnapshot,
  };
}

/**
 * Obtener historial de revisiones · últimos N períodos (ordenados desc por año/mes)
 */
export async function getHistorialRevisiones(
  maxResultados: number = 12,
): Promise<RevisionMensual[]> {
  try {
    // Ordenar primero por año DESC · luego por mes DESC
    const q = query(
      collection(db, COLLECTIONS.REVISIONES_MENSUALES),
      orderBy('anio', 'desc'),
      orderBy('mes', 'desc'),
      limit(maxResultados),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RevisionMensual);
  } catch (err) {
    logger.warn('Error obteniendo historial de revisiones:', err);
    return [];
  }
}

// ============================================================================
// CONCILIACIÓN BANCARIA · resumen para el panel
// ============================================================================

/**
 * Convierte CuentaCaja en ConciliacionCuenta · evalúa estado de verificación
 */
function evaluarConciliacionCuenta(cuenta: CuentaCaja, tc: number): ConciliacionCuenta {
  // Saldo en sistema · monetizamos a PEN
  let saldoSistemaPEN = 0;
  let saldoSistemaOriginal = 0;
  let monedaDisplay: string = cuenta.moneda;

  if (cuenta.esBiMoneda) {
    const sUSD = cuenta.saldoUSD ?? 0;
    const sPEN = cuenta.saldoPEN ?? 0;
    saldoSistemaPEN = sPEN + sUSD * tc;
    saldoSistemaOriginal = saldoSistemaPEN; // bi-moneda · display ya consolidado
    monedaDisplay = 'USD+PEN';
  } else {
    saldoSistemaOriginal = cuenta.saldoActual ?? 0;
    saldoSistemaPEN = cuenta.moneda === 'USD' ? saldoSistemaOriginal * tc : saldoSistemaOriginal;
  }

  // Última verificación
  const ultimaVerif = cuenta.ultimaVerificacion;
  let estado: EstadoConciliacion;
  let saldoVerificadoPEN: number | undefined;
  let saldoVerificadoOriginal: number | undefined;
  let diasDesdeVerificacion: number | undefined;
  let desviacionPEN: number | undefined;
  let desviacionOriginal: number | undefined;
  let fechaUltimaVerificacion: Timestamp | undefined;

  if (!ultimaVerif) {
    estado = 'sin_verificar';
  } else {
    fechaUltimaVerificacion = ultimaVerif.fecha as Timestamp;
    const fechaMs = (ultimaVerif.fecha as Timestamp).toMillis();
    const ahoraMs = Date.now();
    const diasMs = (ahoraMs - fechaMs) / (1000 * 60 * 60 * 24);
    diasDesdeVerificacion = Math.floor(diasMs);

    saldoVerificadoOriginal = ultimaVerif.saldoBancoReportado;
    saldoVerificadoPEN =
      ultimaVerif.moneda === 'USD' ? saldoVerificadoOriginal * tc : saldoVerificadoOriginal;

    // Calcular desviación con respecto al saldo del sistema HOY (no al snapshot del momento)
    desviacionOriginal = saldoSistemaOriginal - saldoVerificadoOriginal;
    desviacionPEN = saldoSistemaPEN - saldoVerificadoPEN;
    const desviacionSignificativa = Math.abs(desviacionPEN) >= 1; // S/1+ es relevante

    // Determinar estado según días + desviación
    if (desviacionSignificativa) {
      estado = 'desviacion';
    } else if (diasDesdeVerificacion <= 7) {
      estado = 'verificada';
    } else if (diasDesdeVerificacion <= 30) {
      estado = 'sin_verificar';
    } else {
      estado = 'desactualizada';
    }
  }

  return {
    cuentaId: cuenta.id ?? '',
    nombre: cuenta.nombre,
    tipo: cuenta.tipo as ConciliacionCuenta['tipo'],
    moneda: monedaDisplay,
    saldoSistemaPEN,
    saldoSistemaOriginal,
    saldoVerificadoPEN,
    saldoVerificadoOriginal,
    diasDesdeVerificacion,
    desviacionPEN,
    desviacionOriginal,
    estado,
    fechaUltimaVerificacion,
  };
}

/**
 * Obtener resumen consolidado de conciliación bancaria
 * - Excluye cuentas de crédito (son pasivos, no efectivo)
 */
export async function getResumenConciliacion(tipoCambio: number): Promise<ResumenConciliacion> {
  const cuentasRef = collection(db, COLLECTIONS.CUENTAS_CAJA);
  const q = query(cuentasRef, where('activa', '==', true));
  const snap = await getDocs(q);

  const cuentas: ConciliacionCuenta[] = [];
  let verificadas = 0;
  let sinVerificar = 0;
  let desactualizadas = 0;
  let conDesviacion = 0;

  snap.forEach((d) => {
    const cuenta = { id: d.id, ...d.data() } as CuentaCaja;
    if (cuenta.tipo === 'credito') return; // saltar cuentas de crédito

    const conc = evaluarConciliacionCuenta(cuenta, tipoCambio);
    cuentas.push(conc);

    switch (conc.estado) {
      case 'verificada':
        verificadas++;
        break;
      case 'sin_verificar':
        sinVerificar++;
        break;
      case 'desactualizada':
        desactualizadas++;
        break;
      case 'desviacion':
        conDesviacion++;
        break;
    }
  });

  // Ordenar · primero las con desviación · luego desactualizadas · luego sin verificar · al final verificadas
  const orden: Record<EstadoConciliacion, number> = {
    desviacion: 0,
    desactualizada: 1,
    sin_verificar: 2,
    verificada: 3,
  };
  cuentas.sort((a, b) => orden[a.estado] - orden[b.estado]);

  return {
    cuentas,
    totalCuentas: cuentas.length,
    verificadas,
    sinVerificar,
    desactualizadas,
    conDesviacion,
  };
}

// ============================================================================
// EXPORT default · service object compatible con el resto
// ============================================================================

export const revisionMensualService = {
  getRevisionMensual,
  marcarComoRevisado,
  getHistorialRevisiones,
  getResumenConciliacion,
};
