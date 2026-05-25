/**
 * ===============================================
 * SOCIO SERVICE (chk5.E-INV-SOC · 2026-05-24)
 * ===============================================
 *
 * Catálogo de socios del negocio · una entidad más en el sistema, junto a
 * Clientes, Proveedores, Colaboradores y Empleados.
 *
 * Patrón canon CRUD · doc id determinístico vía snake_case del nombre.
 * Vinculación opcional con UserProfile vía `userId` (UID de Firebase Auth).
 *
 * Cuando un socio se vincula a un usuario:
 *  - El email se sincroniza con el del UserProfile
 *  - Permite que el módulo Inversionistas muestre vista personalizada
 *  - Habilita futuros envíos automáticos de reportes ejecutivos por email
 *
 * NO duplica el catálogo · es la fuente única de verdad de socios.
 * `inversionista.service.ts` consume este servicio para todas las operaciones
 * de socios (delega vía namespace).
 */

import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';

import type { Socio, SocioFormData } from '../types/inversionista.types';
import type { UserProfile } from '../types/auth.types';

// ===============================================
// CONSTANTES
// ===============================================

const COLECCION = COLLECTIONS.SOCIOS;

// ===============================================
// HELPERS
// ===============================================

/** Doc id determinístico · snake_case del nombre · "José LP" → "jose_lp" */
function generarIdDesdeNombre(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar acentos
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

// ===============================================
// CRUD
// ===============================================

export async function getAll(): Promise<Socio[]> {
  const snapshot = await getDocs(collection(db, COLECCION));
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Socio[];
}

export async function getById(id: string): Promise<Socio | null> {
  const snap = await getDoc(doc(db, COLECCION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Socio;
}

/**
 * Busca un socio por su userId vinculado · útil para mostrar vista
 * personalizada cuando el user activo es socio (ej: "Tus aportes" en el
 * módulo Inversionistas).
 */
export async function getByUserId(userId: string): Promise<Socio | null> {
  const q = query(collection(db, COLECCION), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as Socio;
}

/**
 * Busca socio por email · usado para detectar vínculo opcional con
 * UserProfile cuando el admin tipea un email en el form de crear socio.
 */
export async function getByEmail(email: string): Promise<Socio | null> {
  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm) return null;
  const q = query(collection(db, COLECCION), where('email', '==', emailNorm));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as Socio;
}

export async function crear(data: SocioFormData, userIdActor: string): Promise<string> {
  const id = generarIdDesdeNombre(data.nombre);

  // Validar uniqueness · si ya existe, error claro
  const exists = await getById(id);
  if (exists) {
    throw new Error(
      `Ya existe un socio con el nombre "${data.nombre}" (id: ${id}). Usá un nombre distinto.`
    );
  }

  const docData: Omit<Socio, 'id'> = {
    nombre: data.nombre.trim(),
    porcentajeParticipacion: data.porcentajeParticipacion,
    fechaIngreso: Timestamp.fromDate(data.fechaIngreso),
    activo: data.activo,
    creadoPor: userIdActor,
    fechaCreacion: Timestamp.now(),
  };
  if (data.email) (docData as any).email = data.email.trim().toLowerCase();
  if (data.userId) (docData as any).userId = data.userId;
  if (data.rol) (docData as any).rol = data.rol;
  if (data.notas) (docData as any).notas = data.notas;

  await setDoc(doc(db, COLECCION, id), docData);
  logger.success(`Socio creado: ${data.nombre} (id: ${id})`);
  return id;
}

export async function actualizar(
  id: string,
  data: Partial<SocioFormData>,
  userIdActor: string
): Promise<void> {
  const updates: Record<string, any> = {
    actualizadoPor: userIdActor,
    fechaActualizacion: Timestamp.now(),
  };
  if (data.nombre !== undefined) updates.nombre = data.nombre.trim();
  if (data.email !== undefined) updates.email = data.email.trim().toLowerCase();
  if (data.userId !== undefined) updates.userId = data.userId;
  if (data.porcentajeParticipacion !== undefined)
    updates.porcentajeParticipacion = data.porcentajeParticipacion;
  if (data.rol !== undefined) updates.rol = data.rol;
  if (data.fechaIngreso !== undefined)
    updates.fechaIngreso = Timestamp.fromDate(data.fechaIngreso);
  if (data.activo !== undefined) updates.activo = data.activo;
  if (data.notas !== undefined) updates.notas = data.notas;

  await updateDoc(doc(db, COLECCION, id), updates);
  logger.success(`Socio actualizado: ${id}`);
}

export async function eliminar(id: string): Promise<void> {
  await deleteDoc(doc(db, COLECCION, id));
  logger.success(`Socio eliminado: ${id}`);
}

// ===============================================
// VINCULACIÓN CON USERPROFILE
// ===============================================

/**
 * Busca usuarios del sistema cuyo email coincida con el ingresado.
 *
 * Usado por el form de crear/editar socio para sugerir vincular al socio
 * con un usuario existente. Si match → autocomplete `userId` con UID.
 *
 * Si no hay match → el socio queda "silent partner" (sin userId).
 */
export async function buscarUsuariosPorEmail(email: string): Promise<UserProfile[]> {
  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm) return [];
  const q = query(
    collection(db, COLLECTIONS.USERS),
    where('email', '==', emailNorm)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    uid: d.id,
    ...d.data(),
  })) as UserProfile[];
}

/**
 * Lista todos los usuarios activos del sistema · usado por el combobox de
 * vinculación en el form de socio para dejar al admin elegir manualmente
 * sin necesidad de tipear el email exacto.
 */
export async function listarUsuariosVinculables(): Promise<UserProfile[]> {
  const snapshot = await getDocs(collection(db, COLLECTIONS.USERS));
  return snapshot.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .filter((u: any) => u.activo) as UserProfile[];
}

// ===============================================
// EXPORT NAMESPACE
// ===============================================

export const socioService = {
  getAll,
  getById,
  getByUserId,
  getByEmail,
  crear,
  actualizar,
  eliminar,
  buscarUsuariosPorEmail,
  listarUsuariosVinculables,
};
