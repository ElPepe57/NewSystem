/**
 * calculoIncentivo.service.ts
 *
 * chk5.PERSONAS-v5.4 · F3 · 2026-05-26
 *
 * CRUD de cálculos mensuales de incentivos.
 *
 * Workflow:
 *  1. cron / acción manual → `calcularBonosMes(mes, anio)` → CalculosIncentivoMes[]
 *  2. UI tab Incentivos muestra resultados · gerente revisa
 *  3. `aprobar(id)` o `rechazar(id, razon)` → estado cambia
 *  4. al generar boleta del mes → `vincularConBoleta(boletaId, calculoIds)`
 *
 * IMPORTANTE: el motor de cálculo (que aplica las fórmulas según tipo de
 * esquema) vive en `utils/incentivoCalculadores.ts` (F7). Este service es
 * solo el "orquestador de persistencia" y workflow.
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
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import type {
  CalculoIncentivoMes,
  EstadoCalculoIncentivo,
  TipoIncentivo,
} from '../types/planilla.types';

// ============================================
// HELPERS
// ============================================

function getCalculoRef(id: string) {
  return doc(db, COLLECTIONS.CALCULOS_INCENTIVO, id);
}

function getColRef() {
  return collection(db, COLLECTIONS.CALCULOS_INCENTIVO);
}

export function generarIdCalculo(mes: number, anio: number): string {
  const mesStr = String(mes).padStart(2, '0');
  const rnd = Math.floor(Math.random() * 100000)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0');
  return `CALC-${anio}-${mesStr}-${rnd}`;
}

// ============================================
// SERVICE
// ============================================

export const calculoIncentivoService = {
  /**
   * Persiste un cálculo (resultado del motor de cálculo).
   * Llamado típicamente por el orquestador del cron mensual.
   */
  async guardar(calculo: CalculoIncentivoMes): Promise<void> {
    await setDoc(getCalculoRef(calculo.id), calculo);
    logger.info('[calculoIncentivo] guardado', {
      id: calculo.id,
      userId: calculo.userId,
      bono: calculo.bonoCalculado,
    });
  },

  /**
   * Persiste un batch de cálculos (atómico). Útil cuando el motor procesa
   * un mes completo con N empleados y M esquemas en una sola operación.
   * Firestore writeBatch soporta hasta 500 ops · si excede usa varios batches.
   */
  async guardarBatch(calculos: CalculoIncentivoMes[]): Promise<void> {
    if (calculos.length === 0) return;
    // Chunk de a 500 (límite Firestore)
    const CHUNK = 500;
    for (let i = 0; i < calculos.length; i += CHUNK) {
      const slice = calculos.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      slice.forEach((c) => batch.set(getCalculoRef(c.id), c));
      await batch.commit();
    }
    logger.info('[calculoIncentivo] batch guardado', { total: calculos.length });
  },

  /**
   * Lee un cálculo por ID.
   */
  async getById(id: string): Promise<CalculoIncentivoMes | null> {
    const snap = await getDoc(getCalculoRef(id));
    return snap.exists() ? (snap.data() as CalculoIncentivoMes) : null;
  },

  /**
   * Lista todos los cálculos de un mes/año específico.
   * Usado por tab Incentivos al cambiar el período.
   */
  async listMes(mes: number, anio: number): Promise<CalculoIncentivoMes[]> {
    const q = query(
      getColRef(),
      where('mes', '==', mes),
      where('anio', '==', anio),
      orderBy('fechaCalculo', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as CalculoIncentivoMes);
  },

  /**
   * Lista cálculos de un empleado en un rango de meses (para tab Análisis
   * y Reportes · histórico individual).
   */
  async listUsuario(userId: string, limite: number = 24): Promise<CalculoIncentivoMes[]> {
    const q = query(
      getColRef(),
      where('userId', '==', userId),
      orderBy('fechaCalculo', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.slice(0, limite).map((d) => d.data() as CalculoIncentivoMes);
  },

  /**
   * Lista cálculos pendientes de aprobación (estado = 'calculado'). Banner
   * contextual del tab Incentivos.
   */
  async listPendientes(): Promise<CalculoIncentivoMes[]> {
    const q = query(
      getColRef(),
      where('estado', '==', 'calculado' as EstadoCalculoIncentivo),
      orderBy('fechaCalculo', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as CalculoIncentivoMes);
  },

  /**
   * Aprueba un cálculo (gerente review).
   */
  async aprobar(id: string, aprobadoPor: string): Promise<void> {
    await updateDoc(getCalculoRef(id), {
      estado: 'aprobado' as EstadoCalculoIncentivo,
      aprobadoPor,
      fechaAprobacion: Timestamp.now(),
    });
    logger.info('[calculoIncentivo] aprobado', { id, aprobadoPor });
  },

  /**
   * Rechaza un cálculo con razón obligatoria.
   */
  async rechazar(id: string, aprobadoPor: string, razonRechazo: string): Promise<void> {
    if (!razonRechazo.trim()) {
      throw new Error('La razón del rechazo es obligatoria.');
    }
    await updateDoc(getCalculoRef(id), {
      estado: 'rechazado' as EstadoCalculoIncentivo,
      aprobadoPor,
      razonRechazo: razonRechazo.trim(),
      fechaAprobacion: Timestamp.now(),
    });
    logger.info('[calculoIncentivo] rechazado', { id, razon: razonRechazo });
  },

  /**
   * Vincula múltiples cálculos a una boleta (cuando se genera la boleta del mes).
   * Cambia estado a 'incluido_en_boleta' y registra boletaId. Atómico.
   */
  async vincularConBoleta(boletaId: string, calculoIds: string[]): Promise<void> {
    if (calculoIds.length === 0) return;
    const batch = writeBatch(db);
    calculoIds.forEach((id) => {
      batch.update(getCalculoRef(id), {
        estado: 'incluido_en_boleta' as EstadoCalculoIncentivo,
        boletaId,
      });
    });
    await batch.commit();
    logger.info('[calculoIncentivo] vinculados a boleta', { boletaId, total: calculoIds.length });
  },

  /**
   * Resumen agregado por mes (para tab Análisis y Reportes).
   * Retorna conteo por tipo, total pagado, top empleados.
   */
  async resumenMes(
    mes: number,
    anio: number,
  ): Promise<{
    total: number;
    totalPagadoPEN: number;
    porTipo: Record<TipoIncentivo, { count: number; totalPEN: number }>;
    topEmpleados: Array<{ userId: string; empleadoNombre: string; totalPEN: number }>;
  }> {
    const calculos = await this.listMes(mes, anio);
    const incluidos = calculos.filter((c) => c.estado === 'incluido_en_boleta');

    const porTipo: Record<string, { count: number; totalPEN: number }> = {
      comision: { count: 0, totalPEN: 0 },
      bono_meta: { count: 0, totalPEN: 0 },
      bono_kpi: { count: 0, totalPEN: 0 },
      bono_fijo: { count: 0, totalPEN: 0 },
    };

    const empleadoMap = new Map<string, { empleadoNombre: string; totalPEN: number }>();
    let totalPagadoPEN = 0;

    incluidos.forEach((c) => {
      const montoPEN = c.moneda === 'PEN' ? c.bonoCalculado : c.bonoCalculado; // TODO: aplicar TC si USD
      porTipo[c.esquemaTipo].count += 1;
      porTipo[c.esquemaTipo].totalPEN += montoPEN;
      totalPagadoPEN += montoPEN;

      const prev = empleadoMap.get(c.userId) ?? {
        empleadoNombre: c.empleadoNombre,
        totalPEN: 0,
      };
      prev.totalPEN += montoPEN;
      empleadoMap.set(c.userId, prev);
    });

    const topEmpleados = Array.from(empleadoMap.entries())
      .map(([userId, v]) => ({ userId, empleadoNombre: v.empleadoNombre, totalPEN: v.totalPEN }))
      .sort((a, b) => b.totalPEN - a.totalPEN)
      .slice(0, 10);

    return {
      total: incluidos.length,
      totalPagadoPEN,
      porTipo: porTipo as Record<TipoIncentivo, { count: number; totalPEN: number }>,
      topEmpleados,
    };
  },
};
