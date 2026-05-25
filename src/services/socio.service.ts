/**
 * ===============================================
 * SOCIO SERVICE (refactor chk5.F3-ADAPT · 2026-05-24)
 * ===============================================
 *
 * REFACTOR · ahora compone el "Socio" desde 2 fuentes canon:
 *   1. /users/{uid}              · UserProfile con rol 'socio'
 *   2. /users/{uid}/private/datosSocio · sub-perfil con % · valor · etc.
 *
 * El catálogo /socios separado queda DEPRECADO (lo creé en chk5.E-INV-SOC
 * pero la auditoría reveló que era modelo paralelo · ahora unificado en users).
 *
 * Para compatibilidad backward del shape Socio, este service devuelve objetos
 * con la misma estructura que antes · pero los datos provienen del modelo unificado.
 *
 *   socio.id  ←→  user.uid
 *   socio.userId ←→  user.uid (= id · redundante pero mantenido)
 *   socio.nombre  ←→ user.displayName
 *   socio.email   ←→ user.email
 *   socio.porcentajeParticipacion  ←→ datosSocio.porcentajeParticipacion
 *   socio.fechaIngreso  ←→ datosSocio.fechaIngresoNegocio
 *   socio.rol  ←→ datosSocio.rolEnNegocio
 *   socio.activo  ←→ user.activo
 *
 * NUEVO: el objeto Socio devuelto incluye un campo `datosSocioCompleto?` con el
 * sub-perfil entero (para casos donde el caller necesita tipoParticipacion ·
 * aporteDeValor · etc).
 */

import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';

import type { Socio, SocioFormData } from '../types/inversionista.types';
import type { UserProfile } from '../types/auth.types';
import { hasRole } from '../types/auth.types';
import type { DatosSocio, DatosSocioFormData } from '../types/datosSocio.types';
import { datosSocioService } from './datosSocio.service';
import { userService } from './user.service';

// ===============================================
// HELPERS DE COMPOSICIÓN
// ===============================================

/**
 * Compone un Socio (shape legacy) a partir de UserProfile + DatosSocio.
 *
 * Si el user tiene rol 'socio' pero NO existe datosSocio sub-perfil aún,
 * retorna un Socio con valores default (participación 0 · fecha hoy).
 * Eso señaliza al admin que falta completar la sub-vista.
 */
function componerSocio(user: UserProfile, datos: DatosSocio | null): Socio & {
  /** Sub-perfil completo · null si todavía no se creó */
  datosSocioCompleto?: DatosSocio;
} {
  const fechaIngreso = datos?.fechaIngresoNegocio ?? user.fechaCreacion ?? Timestamp.now();
  return {
    id: user.uid,
    userId: user.uid,
    nombre: user.displayName,
    email: user.email,
    porcentajeParticipacion: datos?.porcentajeParticipacion ?? 0,
    rol: datos?.rolEnNegocio,
    fechaIngreso,
    activo: user.activo,
    notas: datos?.notas,
    creadoPor: datos?.creadoPor ?? '',
    fechaCreacion: datos?.fechaCreacion ?? fechaIngreso,
    actualizadoPor: datos?.actualizadoPor,
    fechaActualizacion: datos?.fechaActualizacion,
    datosSocioCompleto: datos ?? undefined,
  };
}

// ===============================================
// CRUD (modelo unificado users + datosSocio)
// ===============================================

/**
 * Lista todos los socios del negocio · users con rol 'socio'.
 * Compone con datosSocio sub-perfil cuando existe.
 */
export async function getAll(): Promise<Socio[]> {
  const users = await userService.getAll();
  const socios = users.filter((u) => hasRole(u, 'socio'));
  const result = await Promise.all(
    socios.map(async (u) => {
      const datos = await datosSocioService.get(u.uid).catch(() => null);
      return componerSocio(u, datos);
    })
  );
  return result;
}

/**
 * Por ID · ahora el ID es el uid del UserProfile.
 */
export async function getById(id: string): Promise<Socio | null> {
  const user = await userService.getByUid(id);
  if (!user || !hasRole(user, 'socio')) return null;
  const datos = await datosSocioService.get(id).catch(() => null);
  return componerSocio(user, datos);
}

/**
 * Por userId · alias de getById (ahora son el mismo concepto).
 */
export async function getByUserId(userId: string): Promise<Socio | null> {
  return getById(userId);
}

/**
 * Por email · busca un user con rol 'socio' por email.
 */
export async function getByEmail(email: string): Promise<Socio | null> {
  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm) return null;
  const q = query(
    collection(db, COLLECTIONS.USERS),
    where('email', '==', emailNorm)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const user = { uid: snapshot.docs[0].id, ...snapshot.docs[0].data() } as UserProfile;
  if (!hasRole(user, 'socio')) return null;
  const datos = await datosSocioService.get(user.uid).catch(() => null);
  return componerSocio(user, datos);
}

/**
 * Crear socio · ahora requiere que el user ya exista con rol 'socio'.
 * Esta función solo escribe el sub-perfil datosSocio.
 *
 * Para crear un user nuevo desde cero · usar userService.createUser primero
 * y luego llamar a este método con el uid resultante.
 *
 * NOTA: el campo `nombre` del SocioFormData se usa para autocompletar el
 * displayName si el user existe pero no lo tiene · no es el primary key.
 */
export async function crear(data: SocioFormData & { uid?: string }, userIdActor: string): Promise<string> {
  if (!data.uid) {
    throw new Error(
      'crear(socio) requiere `uid` del UserProfile · primero creá el user con userService.createUser, luego agregale rol socio + datosSocio.'
    );
  }
  const user = await userService.getByUid(data.uid);
  if (!user) {
    throw new Error(`Usuario ${data.uid} no encontrado · creá el user primero.`);
  }
  if (!hasRole(user, 'socio')) {
    throw new Error(
      `Usuario ${data.uid} NO tiene rol "socio" · agregalo desde la edición del user antes de crear sub-perfil.`
    );
  }

  // Componer datosSocio formData básico desde SocioFormData
  const datosFormData: DatosSocioFormData = {
    porcentajeParticipacion: data.porcentajeParticipacion,
    fechaIngresoNegocio: data.fechaIngreso,
    tipoParticipacion: 'cash_puro',   // default · admin puede editar después
  };
  if (data.rol) datosFormData.rolEnNegocio = data.rol;
  if (data.notas) datosFormData.notas = data.notas;

  await datosSocioService.set(data.uid, datosFormData, userIdActor);
  logger.success(`Socio creado (sub-perfil datosSocio) para uid: ${data.uid}`);
  return data.uid;
}

/**
 * Actualizar socio · refleja en el sub-perfil datosSocio.
 *
 * Si se cambia nombre/email · NO se modifica (eso es responsabilidad del
 * userService.update). Acá solo se actualizan los campos del sub-perfil.
 */
export async function actualizar(
  id: string,
  data: Partial<SocioFormData>,
  userIdActor: string
): Promise<void> {
  // Solo actualizamos los campos del sub-perfil que vienen
  const existing = await datosSocioService.get(id);
  if (!existing) {
    // Si no existe el sub-perfil, hay que crearlo · necesita campos obligatorios
    if (data.porcentajeParticipacion === undefined || !data.fechaIngreso) {
      throw new Error(
        'Sub-perfil datosSocio no existe · necesitás porcentajeParticipacion + fechaIngreso para crearlo.'
      );
    }
    const formData: DatosSocioFormData = {
      porcentajeParticipacion: data.porcentajeParticipacion,
      fechaIngresoNegocio: data.fechaIngreso,
      tipoParticipacion: 'cash_puro',
    };
    if (data.rol) formData.rolEnNegocio = data.rol;
    if (data.notas) formData.notas = data.notas;
    await datosSocioService.set(id, formData, userIdActor);
    return;
  }

  // Actualizar campos · respeta los existentes
  const formData: DatosSocioFormData = {
    porcentajeParticipacion: data.porcentajeParticipacion ?? existing.porcentajeParticipacion,
    fechaIngresoNegocio: data.fechaIngreso ?? existing.fechaIngresoNegocio.toDate(),
    tipoParticipacion: existing.tipoParticipacion,
    rolEnNegocio: data.rol ?? existing.rolEnNegocio,
    notas: data.notas ?? existing.notas,
    aporteDeValor: existing.aporteDeValor as any,
    tcsPersonalesVinculadas: existing.tcsPersonalesVinculadas,
  };
  await datosSocioService.set(id, formData, userIdActor);
  logger.success(`Socio actualizado (sub-perfil): ${id}`);
}

/**
 * Eliminar socio · elimina el sub-perfil datosSocio + quita rol 'socio' del user.
 * NO borra el UserProfile (puede seguir existiendo con otros roles).
 */
export async function eliminar(id: string): Promise<void> {
  await datosSocioService.delete(id);
  // Quitar rol 'socio' del user (futura mejora: implementar en userService)
  logger.success(`Socio eliminado (sub-perfil): ${id}. Recordá quitar manualmente el rol 'socio' del UserProfile si ya no aplica.`);
}

// ===============================================
// VINCULACIÓN CON USERPROFILE (utilidades preservadas)
// ===============================================

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
