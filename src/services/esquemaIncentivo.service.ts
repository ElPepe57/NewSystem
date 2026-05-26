/**
 * esquemaIncentivo.service.ts
 *
 * chk5.PERSONAS-v5.4 · F3 · 2026-05-26
 *
 * CRUD de esquemas de incentivo (templates).
 *
 * 4 tipos canon:
 *  - comision: variable sobre ventas (vendedores)
 *  - bono_meta: cuantitativa por cumplimiento (logística/compras)
 *  - bono_kpi: cualitativa por indicadores (finanzas)
 *  - bono_fijo: monto fijo recurrente (gerencia)
 *
 * Los esquemas son TEMPLATES · el cálculo mensual produce CalculoIncentivoMes
 * (otro service · `calculoIncentivo.service.ts`).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import type {
  EsquemaIncentivo,
  EsquemaIncentivoFormData,
  TipoIncentivo,
} from '../types/planilla.types';

// ============================================
// HELPERS
// ============================================

function getEsquemaRef(id: string) {
  return doc(db, COLLECTIONS.ESQUEMAS_INCENTIVO, id);
}

function getColRef() {
  return collection(db, COLLECTIONS.ESQUEMAS_INCENTIVO);
}

function generarIdEsquema(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.floor(Math.random() * 1000)
    .toString(36)
    .toUpperCase()
    .padStart(3, '0');
  return `ESQ-${ts}-${rnd}`;
}

/** Elimina campos undefined antes de escribir a Firestore */
function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  const cleaned = {} as any;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) cleaned[key] = value;
  }
  return cleaned;
}

// ============================================
// SERVICE
// ============================================

export const esquemaIncentivoService = {
  /**
   * Crea un nuevo esquema de incentivo. Validaciones mínimas:
   *  - nombre no vacío
   *  - tipo válido
   *  - configuración coherente con tipo (no se valida deep · responsabilidad UI/wizard)
   */
  async crear(
    data: EsquemaIncentivoFormData,
    creadoPor: string,
  ): Promise<EsquemaIncentivo> {
    if (!data.nombre.trim()) {
      throw new Error('El nombre del esquema es obligatorio.');
    }

    const id = generarIdEsquema();
    const ahora = Timestamp.now();

    const esquema = cleanUndefined({
      id,
      nombre: data.nombre.trim(),
      descripcion: data.descripcion?.trim(),
      tipo: data.tipo,
      aplicableA: data.aplicableA,
      configuracion: data.configuracion,
      activo: true,
      vigenteDesde: Timestamp.fromDate(data.vigenteDesde),
      vigenteHasta: data.vigenteHasta
        ? Timestamp.fromDate(data.vigenteHasta)
        : undefined,
      creadoPor,
      fechaCreacion: ahora,
    }) as EsquemaIncentivo;

    await setDoc(getEsquemaRef(id), esquema);
    logger.info('[esquemaIncentivo] creado', { id, tipo: data.tipo, nombre: esquema.nombre });
    return esquema;
  },

  /**
   * Lee un esquema por ID. Devuelve null si no existe.
   */
  async getById(id: string): Promise<EsquemaIncentivo | null> {
    const snap = await getDoc(getEsquemaRef(id));
    return snap.exists() ? (snap.data() as EsquemaIncentivo) : null;
  },

  /**
   * Lista todos los esquemas (incluye inactivos para auditoría histórica).
   * Para UI usar `listActivos` o `listVigentesEn(fecha)`.
   */
  async listAll(): Promise<EsquemaIncentivo[]> {
    const snap = await getDocs(query(getColRef(), orderBy('fechaCreacion', 'desc')));
    return snap.docs.map((d) => d.data() as EsquemaIncentivo);
  },

  /**
   * Lista solo esquemas activos.
   */
  async listActivos(): Promise<EsquemaIncentivo[]> {
    const snap = await getDocs(
      query(getColRef(), where('activo', '==', true), orderBy('fechaCreacion', 'desc')),
    );
    return snap.docs.map((d) => d.data() as EsquemaIncentivo);
  },

  /**
   * Lista esquemas vigentes en una fecha específica (vigenteDesde <= fecha
   * AND (vigenteHasta == null OR vigenteHasta >= fecha)). Usado por el motor
   * de cálculo mensual.
   *
   * Nota: Firestore no permite range queries en 2 campos distintos en una
   * misma consulta, así que filtramos en memoria después de un primer recorte.
   */
  async listVigentesEn(fecha: Date): Promise<EsquemaIncentivo[]> {
    const fechaTs = Timestamp.fromDate(fecha);
    const activos = await this.listActivos();
    return activos.filter((e) => {
      if (e.vigenteDesde.toMillis() > fechaTs.toMillis()) return false;
      if (e.vigenteHasta && e.vigenteHasta.toMillis() < fechaTs.toMillis()) return false;
      return true;
    });
  },

  /**
   * Lista esquemas por tipo (útil para el tab Incentivos · filtros chip).
   */
  async listPorTipo(tipo: TipoIncentivo): Promise<EsquemaIncentivo[]> {
    const snap = await getDocs(
      query(getColRef(), where('tipo', '==', tipo), orderBy('fechaCreacion', 'desc')),
    );
    return snap.docs.map((d) => d.data() as EsquemaIncentivo);
  },

  /**
   * Actualiza un esquema (sin tocar id · tipo · aplicableA · vigenteDesde
   * para no romper cálculos históricos). Si necesita un cambio profundo,
   * crear esquema nuevo y desactivar el viejo.
   */
  async actualizar(
    id: string,
    cambios: Partial<EsquemaIncentivoFormData>,
    modificadoPor: string,
  ): Promise<void> {
    const ahora = Timestamp.now();
    const update: Record<string, any> = {
      modificadoPor,
      fechaModificacion: ahora,
    };
    if (cambios.nombre !== undefined) update.nombre = cambios.nombre.trim();
    if (cambios.descripcion !== undefined) update.descripcion = cambios.descripcion.trim();
    if (cambios.configuracion !== undefined) update.configuracion = cambios.configuracion;
    if (cambios.vigenteHasta !== undefined) {
      update.vigenteHasta = cambios.vigenteHasta
        ? Timestamp.fromDate(cambios.vigenteHasta)
        : null;
    }
    await updateDoc(getEsquemaRef(id), update);
    logger.info('[esquemaIncentivo] actualizado', { id });
  },

  /**
   * Desactiva un esquema (soft delete · mantiene historial de cálculos previos).
   * Marca como inactivo y opcionalmente fija vigenteHasta = hoy.
   */
  async desactivar(id: string, modificadoPor: string): Promise<void> {
    const ahora = Timestamp.now();
    await updateDoc(getEsquemaRef(id), {
      activo: false,
      vigenteHasta: ahora,
      modificadoPor,
      fechaModificacion: ahora,
    });
    logger.info('[esquemaIncentivo] desactivado', { id });
  },

  /**
   * Elimina un esquema PERMANENTEMENTE. Solo admin. Previamente debe verificar
   * que no haya cálculos vinculados (si los hay, debería usar `desactivar`).
   */
  async eliminar(id: string): Promise<void> {
    await deleteDoc(getEsquemaRef(id));
    logger.info('[esquemaIncentivo] eliminado', { id });
  },
};
