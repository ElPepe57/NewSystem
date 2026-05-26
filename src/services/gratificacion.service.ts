/**
 * gratificacion.service.ts
 *
 * chk5.PERSONAS-v5.4 · F3 · 2026-05-26
 *
 * CRUD de gratificaciones · solo Julio y Diciembre Perú.
 * Vita Skin NO paga CTS · este service NO crea CTS.
 *
 * Cálculo proporcional simple:
 *   monto = salarioBaseReferencia * (diasEfectivosEnSemestre / 180)
 *
 * Workflow:
 *  1. Admin/Gerente abre ProcesarGratificacionModal (jul o dic)
 *  2. Service calcula monto sugerido por empleado vigente
 *  3. Estado inicial: 'pendiente'
 *  4. Aprobación: 'pendiente' → 'aprobada'
 *  5. Cloud Function `procesarGratificacion` (F9) ejecuta:
 *     - Crea Boleta extraordinaria con gratificacionId
 *     - Crea Gasto + MovimientoFinanciero
 *     - Estado: 'aprobada' → 'pagada'
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
  Gratificacion,
  GratificacionFormData,
  EstadoGratificacion,
  MesGratificacion,
} from '../types/planilla.types';

// ============================================
// HELPERS
// ============================================

function getGratRef(id: string) {
  return doc(db, COLLECTIONS.GRATIFICACIONES, id);
}

function getColRef() {
  return collection(db, COLLECTIONS.GRATIFICACIONES);
}

function generarIdGratificacion(mes: number, anio: number): string {
  const mesStr = String(mes).padStart(2, '0');
  const rnd = Math.floor(Math.random() * 10000)
    .toString(36)
    .toUpperCase()
    .padStart(3, '0');
  return `GRAT-${anio}-${mesStr}-${rnd}`;
}

/**
 * Calcula la gratificación proporcional simple.
 *   monto = salarioBase * (diasEfectivos / 180)
 * Vita Skin: sin bonificaciones extra · sin EsSalud · sin descuentos.
 */
export function calcularGratificacionProporcional(
  salarioBase: number,
  diasEfectivosEnSemestre: number,
): number {
  if (salarioBase <= 0) return 0;
  const dias = Math.max(0, Math.min(180, diasEfectivosEnSemestre));
  return Number(((salarioBase * dias) / 180).toFixed(2));
}

// ============================================
// SERVICE
// ============================================

export const gratificacionService = {
  /**
   * Crea una gratificación en estado 'pendiente'.
   * El cálculo del monto puede hacerse antes en UI o aquí (si se pasa
   * `salarioBaseReferencia` y `diasEfectivosEnSemestre`, recalcula).
   */
  async crear(
    data: GratificacionFormData,
    creadoPor: string,
  ): Promise<Gratificacion> {
    if (data.mes !== 7 && data.mes !== 12) {
      throw new Error(
        'Solo se procesan gratificaciones en Julio (mes=7) o Diciembre (mes=12).',
      );
    }
    if (data.diasEfectivosEnSemestre < 0 || data.diasEfectivosEnSemestre > 180) {
      throw new Error('Los días efectivos en el semestre deben estar entre 0 y 180.');
    }

    const id = generarIdGratificacion(data.mes, data.anio);
    const ahora = Timestamp.now();

    const grat: Gratificacion = {
      id,
      userId: data.userId,
      empleadoNombre: data.empleadoNombre,
      mes: data.mes,
      anio: data.anio,
      diasEfectivosEnSemestre: data.diasEfectivosEnSemestre,
      salarioBaseReferencia: data.salarioBaseReferencia,
      montoCalculado: data.montoCalculado,
      moneda: data.moneda,
      estado: 'pendiente',
      creadoPor,
      fechaCreacion: ahora,
    };

    await setDoc(getGratRef(id), grat);
    logger.info('[gratificacion] creada', {
      id,
      userId: data.userId,
      monto: data.montoCalculado,
    });
    return grat;
  },

  /**
   * Lee gratificación por ID.
   */
  async getById(id: string): Promise<Gratificacion | null> {
    const snap = await getDoc(getGratRef(id));
    return snap.exists() ? (snap.data() as Gratificacion) : null;
  },

  /**
   * Lista gratificaciones de un mes/año específico.
   * Para tab Vacaciones y Gratificaciones.
   */
  async listMes(mes: MesGratificacion, anio: number): Promise<Gratificacion[]> {
    const q = query(
      getColRef(),
      where('mes', '==', mes),
      where('anio', '==', anio),
      orderBy('fechaCreacion', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Gratificacion);
  },

  /**
   * Lista gratificaciones de un empleado a lo largo del tiempo.
   */
  async listUsuario(userId: string): Promise<Gratificacion[]> {
    const q = query(
      getColRef(),
      where('userId', '==', userId),
      orderBy('fechaCreacion', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Gratificacion);
  },

  /**
   * Aprueba gratificación (pendiente → aprobada). Lista para pago.
   */
  async aprobar(id: string, aprobadoPor: string): Promise<void> {
    const existente = await this.getById(id);
    if (!existente) throw new Error(`Gratificación ${id} no encontrada.`);
    if (existente.estado !== 'pendiente') {
      throw new Error(`Solo gratificaciones pendientes pueden aprobarse. Estado: ${existente.estado}`);
    }
    await updateDoc(getGratRef(id), {
      estado: 'aprobada' as EstadoGratificacion,
      aprobadoPor,
      fechaAprobacion: Timestamp.now(),
    });
    logger.info('[gratificacion] aprobada', { id, aprobadoPor });
  },

  /**
   * Marca como pagada (estado terminal). Se llama desde Cloud Function
   * `procesarGratificacion` (F9) después de crear la boleta + gasto + mov.
   */
  async marcarComoPagada(
    id: string,
    refs: { boletaId?: string; gastoId?: string; movimientoTesoreriaId?: string },
  ): Promise<void> {
    const update: Record<string, any> = {
      estado: 'pagada' as EstadoGratificacion,
    };
    if (refs.boletaId) update.boletaId = refs.boletaId;
    if (refs.gastoId) update.gastoId = refs.gastoId;
    if (refs.movimientoTesoreriaId) update.movimientoTesoreriaId = refs.movimientoTesoreriaId;
    await updateDoc(getGratRef(id), update);
    logger.info('[gratificacion] marcada pagada', { id, refs });
  },

  /**
   * Anula gratificación (solo si no fue pagada).
   */
  async anular(id: string, anuladoPor: string): Promise<void> {
    const existente = await this.getById(id);
    if (!existente) throw new Error(`Gratificación ${id} no encontrada.`);
    if (existente.estado === 'pagada') {
      throw new Error('No se puede anular una gratificación ya pagada. Requiere reverso contable.');
    }
    await updateDoc(getGratRef(id), {
      estado: 'anulada' as EstadoGratificacion,
      aprobadoPor: anuladoPor,
      fechaAprobacion: Timestamp.now(),
    });
    logger.info('[gratificacion] anulada', { id });
  },
};
