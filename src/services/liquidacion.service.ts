/**
 * liquidacion.service.ts
 *
 * chk5.PERSONAS-v5.4 · F3 · 2026-05-26
 *
 * CRUD de liquidaciones por baja de empleado.
 *
 * Workflow del wizard "Dar de baja a empleado":
 *  1. Crear liquidación en estado 'borrador' (con conceptos calculados)
 *  2. Gerente aprueba → 'aprobada'
 *  3. Cloud Function `ejecutarLiquidacion` (F9) ejecuta:
 *     - Crea MovimientoFinanciero (egreso) en cuenta cash
 *     - Crea Gasto contable (cuenta sueldos)
 *     - Marca adelantos pendientes como descontados
 *     - Desactiva PerfilLaboral (activo = false)
 *     - Cambia estado a 'pagada'
 *
 * El cálculo de conceptos vive en la UI (WizardBajaEmpleadoModal) ·
 * este service solo persiste y orquesta el workflow.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import type {
  LiquidacionEmpleado,
  BajaEmpleadoFormData,
  EstadoLiquidacion,
  ConceptoLiquidacion,
} from '../types/planilla.types';

// ============================================
// HELPERS
// ============================================

function getLiqRef(id: string) {
  return doc(db, COLLECTIONS.LIQUIDACIONES_EMPLEADO, id);
}

function getColRef() {
  return collection(db, COLLECTIONS.LIQUIDACIONES_EMPLEADO);
}

function generarIdLiquidacion(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.floor(Math.random() * 1000)
    .toString(36)
    .toUpperCase()
    .padStart(3, '0');
  return `LIQ-${ts}-${rnd}`;
}

/**
 * Calcula totales a partir de los conceptos (positivos = pagar · negativos = descontar).
 * Devuelve { totalBruto, totalDescuentos, netoALiquidar }.
 */
export function calcularTotalesLiquidacion(conceptos: ConceptoLiquidacion[]): {
  totalBruto: number;
  totalDescuentos: number;
  netoALiquidar: number;
} {
  let totalBruto = 0;
  let totalDescuentos = 0;
  conceptos.forEach((c) => {
    if (c.monto >= 0) totalBruto += c.monto;
    else totalDescuentos += Math.abs(c.monto);
  });
  return {
    totalBruto,
    totalDescuentos,
    netoALiquidar: totalBruto - totalDescuentos,
  };
}

// ============================================
// SERVICE
// ============================================

export const liquidacionService = {
  /**
   * Crea una liquidación en estado 'borrador'.
   * Validaciones: empleado debe existir · fechaEfectiva no futura > 1 año ·
   * conceptos no vacíos.
   */
  async crearBorrador(
    data: BajaEmpleadoFormData,
    creadoPor: string,
  ): Promise<LiquidacionEmpleado> {
    if (!data.conceptos || data.conceptos.length === 0) {
      throw new Error('La liquidación debe tener al menos un concepto.');
    }

    const id = generarIdLiquidacion();
    const ahora = Timestamp.now();
    const totales = calcularTotalesLiquidacion(data.conceptos);

    const liquidacion: LiquidacionEmpleado = {
      id,
      userId: data.userId,
      empleadoNombre: data.empleadoNombre,
      tipoBaja: data.tipoBaja,
      fechaEfectiva: Timestamp.fromDate(data.fechaEfectiva),
      razon: data.razon,
      conceptos: data.conceptos,
      totalBruto: totales.totalBruto,
      totalDescuentos: totales.totalDescuentos,
      netoALiquidar: totales.netoALiquidar,
      moneda: data.moneda,
      estado: 'borrador',
      creadoPor,
      fechaCreacion: ahora,
    };

    await setDoc(getLiqRef(id), liquidacion);
    logger.info('[liquidacion] borrador creada', {
      id,
      userId: data.userId,
      neto: totales.netoALiquidar,
    });
    return liquidacion;
  },

  /**
   * Lee liquidación por ID.
   */
  async getById(id: string): Promise<LiquidacionEmpleado | null> {
    const snap = await getDoc(getLiqRef(id));
    return snap.exists() ? (snap.data() as LiquidacionEmpleado) : null;
  },

  /**
   * Lista todas las liquidaciones (orden cronológico desc).
   * Para tab Análisis y Reportes · histórico de bajas.
   */
  async listAll(): Promise<LiquidacionEmpleado[]> {
    const snap = await getDocs(query(getColRef(), orderBy('fechaCreacion', 'desc')));
    return snap.docs.map((d) => d.data() as LiquidacionEmpleado);
  },

  /**
   * Lista liquidaciones por estado (para banners contextuales · "borradores
   * pendientes" · "aprobadas pendientes pago").
   */
  async listPorEstado(estado: EstadoLiquidacion): Promise<LiquidacionEmpleado[]> {
    const snap = await getDocs(
      query(getColRef(), where('estado', '==', estado), orderBy('fechaCreacion', 'desc')),
    );
    return snap.docs.map((d) => d.data() as LiquidacionEmpleado);
  },

  /**
   * Lista liquidaciones de un empleado específico (típicamente 1 · max 2 si
   * hubo recontratación).
   */
  async listUsuario(userId: string): Promise<LiquidacionEmpleado[]> {
    const snap = await getDocs(
      query(getColRef(), where('userId', '==', userId), orderBy('fechaCreacion', 'desc')),
    );
    return snap.docs.map((d) => d.data() as LiquidacionEmpleado);
  },

  /**
   * Actualiza una liquidación en borrador (solo si estado = 'borrador').
   * Recalcula totales automáticamente.
   */
  async actualizarBorrador(
    id: string,
    cambios: Partial<BajaEmpleadoFormData>,
  ): Promise<void> {
    const existente = await this.getById(id);
    if (!existente) throw new Error(`Liquidación ${id} no encontrada.`);
    if (existente.estado !== 'borrador') {
      throw new Error(`Solo se pueden editar liquidaciones en estado borrador. Estado actual: ${existente.estado}`);
    }

    const update: Record<string, any> = {};
    if (cambios.tipoBaja !== undefined) update.tipoBaja = cambios.tipoBaja;
    if (cambios.fechaEfectiva !== undefined)
      update.fechaEfectiva = Timestamp.fromDate(cambios.fechaEfectiva);
    if (cambios.razon !== undefined) update.razon = cambios.razon;
    if (cambios.conceptos !== undefined) {
      update.conceptos = cambios.conceptos;
      const t = calcularTotalesLiquidacion(cambios.conceptos);
      update.totalBruto = t.totalBruto;
      update.totalDescuentos = t.totalDescuentos;
      update.netoALiquidar = t.netoALiquidar;
    }

    await updateDoc(getLiqRef(id), update);
    logger.info('[liquidacion] borrador actualizada', { id });
  },

  /**
   * Aprueba una liquidación (borrador → aprobada). Lista para pago.
   */
  async aprobar(id: string, aprobadoPor: string): Promise<void> {
    const existente = await this.getById(id);
    if (!existente) throw new Error(`Liquidación ${id} no encontrada.`);
    if (existente.estado !== 'borrador') {
      throw new Error(`Solo borradores pueden aprobarse. Estado: ${existente.estado}`);
    }
    await updateDoc(getLiqRef(id), {
      estado: 'aprobada' as EstadoLiquidacion,
      aprobadoPor,
      fechaAprobacion: Timestamp.now(),
    });
    logger.info('[liquidacion] aprobada', { id, aprobadoPor });
  },

  /**
   * Marca liquidación como pagada (estado terminal). Se llama desde la
   * Cloud Function `ejecutarLiquidacion` (F9) DESPUÉS de crear el movimiento
   * tesorería · gasto · desactivar perfil laboral.
   */
  async marcarComoPagada(
    id: string,
    movimientoTesoreriaId: string,
    gastoLiquidacionId?: string,
  ): Promise<void> {
    const update: Record<string, any> = {
      estado: 'pagada' as EstadoLiquidacion,
      movimientoTesoreriaId,
    };
    if (gastoLiquidacionId) update.gastoLiquidacionId = gastoLiquidacionId;
    await updateDoc(getLiqRef(id), update);
    logger.info('[liquidacion] marcada pagada', { id, movimientoTesoreriaId });
  },

  /**
   * Anula una liquidación. Solo permitido si está en 'borrador' o 'aprobada'
   * (NO si ya fue pagada · ahí se necesita reverso contable).
   */
  async anular(id: string, anuladoPor: string): Promise<void> {
    const existente = await this.getById(id);
    if (!existente) throw new Error(`Liquidación ${id} no encontrada.`);
    if (existente.estado === 'pagada') {
      throw new Error('No se puede anular una liquidación ya pagada. Requiere reverso contable.');
    }
    await updateDoc(getLiqRef(id), {
      estado: 'anulada' as EstadoLiquidacion,
      aprobadoPor: anuladoPor,
      fechaAprobacion: Timestamp.now(),
    });
    logger.info('[liquidacion] anulada', { id });
  },
};
