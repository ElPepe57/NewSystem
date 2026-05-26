/**
 * historialSalarial.service.ts
 *
 * chk5.PERSONAS-v5.4 · F3 · 2026-05-26
 *
 * CRUD del historial de variaciones salariales por empleado.
 * Trazabilidad de promociones, ajustes anuales, méritos, correcciones.
 *
 * Patrón:
 *  - `registrarVariacion`: crea nuevo HistorialSalarial + actualiza salarioBase
 *    en PerfilLaboral (subcolección private). Transacción atómica.
 *  - `getHistorialUsuario`: lista cronológica para timeline en Ficha 360.
 *  - `getSalarioVigenteEn`: busca el salario vigente en una fecha específica
 *    (útil para gratificación trunca, liquidaciones, recálculos).
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import type {
  HistorialSalarial,
  PerfilLaboral,
  AjusteSalarialFormData,
} from '../types/planilla.types';

// ============================================
// HELPERS
// ============================================

function getHistorialRef(id: string) {
  return doc(db, COLLECTIONS.HISTORIAL_SALARIAL, id);
}

function getColRef() {
  return collection(db, COLLECTIONS.HISTORIAL_SALARIAL);
}

function getPrivateRef(userId: string) {
  return doc(db, COLLECTIONS.USERS, userId, 'private', 'laboral');
}

function generarIdHistorial(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.floor(Math.random() * 1000)
    .toString(36)
    .toUpperCase()
    .padStart(3, '0');
  return `HSAL-${ts}-${rnd}`;
}

// ============================================
// SERVICE
// ============================================

export const historialSalarialService = {
  /**
   * Registra una variación salarial y actualiza el PerfilLaboral atomicamente.
   * Si el usuario no tiene perfil laboral, falla (no se puede ajustar sin sueldo
   * base previo).
   */
  async registrarVariacion(
    data: AjusteSalarialFormData,
    registradoPor: string,
  ): Promise<HistorialSalarial> {
    const id = generarIdHistorial();
    const ahora = Timestamp.now();

    const result = await runTransaction(db, async (tx) => {
      // Leer perfil laboral actual
      const perfilSnap = await tx.get(getPrivateRef(data.userId));
      if (!perfilSnap.exists()) {
        throw new Error(
          `El empleado ${data.empleadoNombre} no tiene perfil laboral configurado. ` +
            'Configura el sueldo base antes de registrar ajustes.',
        );
      }
      const perfil = perfilSnap.data() as PerfilLaboral;
      const salarioAnterior = perfil.salarioBase ?? 0;
      const delta = data.salarioNuevo - salarioAnterior;
      const porcentajeVariacion =
        salarioAnterior > 0 ? (delta / salarioAnterior) * 100 : 0;

      const historial: HistorialSalarial = {
        id,
        userId: data.userId,
        empleadoNombre: data.empleadoNombre,
        salarioAnterior,
        salarioNuevo: data.salarioNuevo,
        moneda: data.moneda,
        delta,
        porcentajeVariacion,
        efectivoDesde: Timestamp.fromDate(data.efectivoDesde),
        razon: data.razon,
        notas: data.notas,
        registradoPor,
        fechaRegistro: ahora,
      };

      // Crear documento de historial
      tx.set(getHistorialRef(id), historial);

      // Actualizar perfil laboral con el nuevo salario
      tx.update(getPrivateRef(data.userId), {
        salarioBase: data.salarioNuevo,
        monedaSalario: data.moneda,
      });

      return historial;
    });

    logger.info('[historialSalarial] variación registrada', {
      id: result.id,
      userId: data.userId,
      delta: result.delta,
    });

    return result;
  },

  /**
   * Lista cronológica del historial de un empleado (más reciente primero).
   * Usado en Ficha 360 → HistorialSalarialTimeline.
   */
  async getHistorialUsuario(userId: string): Promise<HistorialSalarial[]> {
    const q = query(
      getColRef(),
      where('userId', '==', userId),
      orderBy('efectivoDesde', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as HistorialSalarial);
  },

  /**
   * Devuelve el salario vigente para un userId en una fecha dada.
   * Útil para gratificación trunca (sueldo al 30/06 o 30/11) y liquidaciones
   * (sueldo al día de la baja). Si no hay historial, devuelve null.
   */
  async getSalarioVigenteEn(
    userId: string,
    fecha: Date,
  ): Promise<{ salario: number; moneda: 'PEN' | 'USD' } | null> {
    const fechaTs = Timestamp.fromDate(fecha);
    const q = query(
      getColRef(),
      where('userId', '==', userId),
      where('efectivoDesde', '<=', fechaTs),
      orderBy('efectivoDesde', 'desc'),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const ultimo = snap.docs[0].data() as HistorialSalarial;
    return { salario: ultimo.salarioNuevo, moneda: ultimo.moneda };
  },

  /**
   * Lista todas las variaciones recientes del sistema (para tab Análisis y
   * Reportes · sub-bloque "Últimas variaciones salariales").
   */
  async getRecientes(limite: number = 20): Promise<HistorialSalarial[]> {
    const q = query(getColRef(), orderBy('fechaRegistro', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.slice(0, limite).map((d) => d.data() as HistorialSalarial);
  },
};
