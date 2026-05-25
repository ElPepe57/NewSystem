/**
 * datosLaborales.service.ts · chk5.F2-SUB-PERFILES (2026-05-24)
 *
 * CRUD del sub-perfil "datosLaborales" del UserProfile.
 *
 * Path canon: /users/{uid}/private/datosLaborales (docId = 'datosLaborales')
 *
 * Este sub-perfil consolida los datos de planilla a partir de Fase 2.
 * La colección legacy /empleados queda deprecada · se migra automáticamente
 * al editar un user (lazy migration) o vía script 1x (preferible).
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';
import type {
  DatosLaborales,
  DatosLaboralesFormData,
} from '../types/datosLaborales.types';

const DOC_ID = 'datosLaborales';

/**
 * Path al doc · subcollection privada del user.
 */
function getDocPath(uid: string) {
  return doc(db, COLLECTIONS.USERS, uid, 'private', DOC_ID);
}

// ═════════════════════════════════════════════════════════════════════════
// CRUD
// ═════════════════════════════════════════════════════════════════════════

/**
 * Obtener datos laborales de un usuario. Retorna null si no existen.
 */
export async function getDatosLaborales(uid: string): Promise<DatosLaborales | null> {
  const snap = await getDoc(getDocPath(uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as DatosLaborales;
}

/**
 * Crear o actualizar datos laborales (upsert · idempotente).
 *
 * Si el doc NO existe · setea fechaCreacion + creadoPor.
 * Si ya existe · actualiza fechaActualizacion + actualizadoPor.
 */
export async function setDatosLaborales(
  uid: string,
  data: DatosLaboralesFormData,
  userIdActor: string,
): Promise<void> {
  const existing = await getDatosLaborales(uid);

  const docData: Partial<DatosLaborales> = {
    ...data,
    uid,
    fechaIngreso: Timestamp.fromDate(data.fechaIngreso),
    fechaSalida: data.fechaSalida ? Timestamp.fromDate(data.fechaSalida) : undefined,
    fechaActualizacion: Timestamp.now(),
    actualizadoPor: userIdActor,
  };

  if (!existing) {
    docData.fechaCreacion = Timestamp.now();
    docData.creadoPor = userIdActor;
  } else {
    docData.fechaCreacion = existing.fechaCreacion;
    docData.creadoPor = existing.creadoPor;
  }

  // Limpiar undefined explícitos (Firestore se queja)
  Object.keys(docData).forEach((k) => {
    if ((docData as any)[k] === undefined) delete (docData as any)[k];
  });

  await setDoc(getDocPath(uid), docData);
  logger.success(`Datos laborales ${existing ? 'actualizados' : 'creados'} para uid: ${uid}`);
}

/**
 * Eliminar datos laborales · usar con cuidado · audit trail externo.
 * Útil cuando se quita el rol de planilla a un usuario.
 */
export async function deleteDatosLaborales(uid: string): Promise<void> {
  await deleteDoc(getDocPath(uid));
  logger.success(`Datos laborales eliminados para uid: ${uid}`);
}

/**
 * Listar TODOS los usuarios que tienen datos laborales activos.
 * Usado por el módulo Planilla para reemplazar la colección /empleados.
 *
 * Estrategia: collectionGroup query sobre la sub-colección "private" filtrando
 * los docs cuyo ID es 'datosLaborales' (el path canon).
 */
export async function listarUsuariosConDatosLaborales(): Promise<DatosLaborales[]> {
  // collectionGroup busca docs en cualquier subcolección llamada "private"
  // (incluye datosLaborales y otros como datosSocio · filtramos por el campo
  // de identificación inmediato post-query).
  const cg = collectionGroup(db, 'private');
  const snapshot = await getDocs(cg);
  const result: DatosLaborales[] = [];

  snapshot.forEach((d) => {
    // El docId del sub-doc es 'datosLaborales'
    if (d.id !== DOC_ID) return;
    const data = d.data() as DatosLaborales;
    // El uid se deriva del path: /users/{uid}/private/datosLaborales
    const pathSegs = d.ref.path.split('/');
    const uidIdx = pathSegs.indexOf('users') + 1;
    const uid = pathSegs[uidIdx];
    if (uid) result.push({ ...data, uid });
  });

  return result;
}

// ═════════════════════════════════════════════════════════════════════════
// EXPORT NAMESPACE
// ═════════════════════════════════════════════════════════════════════════

export const datosLaboralesService = {
  get: getDatosLaborales,
  set: setDatosLaborales,
  delete: deleteDatosLaborales,
  listAll: listarUsuariosConDatosLaborales,
};
