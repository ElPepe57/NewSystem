/**
 * datosSocio.service.ts · chk5.F2-SUB-PERFILES (2026-05-24)
 *
 * CRUD del sub-perfil "datosSocio" del UserProfile.
 *
 * Path canon: /users/{uid}/private/datosSocio
 *
 * Este sub-perfil consolida los datos del socio a partir de Fase 2.
 * La colección legacy /socios queda deprecada · se migra automáticamente
 * al editar un user con rol socio (lazy migration) o vía script.
 *
 * D7 canon (chk5.E-INV-PERF):
 * La participación NO se mide solo en cash · también en valor aportado.
 * Este service soporta los 3 tipos: cash_puro · mixta · valor_puro.
 */

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collectionGroup,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';
import type {
  DatosSocio,
  DatosSocioFormData,
} from '../types/datosSocio.types';

const DOC_ID = 'datosSocio';

function getDocPath(uid: string) {
  return doc(db, COLLECTIONS.USERS, uid, 'private', DOC_ID);
}

// ═════════════════════════════════════════════════════════════════════════
// CRUD
// ═════════════════════════════════════════════════════════════════════════

export async function getDatosSocio(uid: string): Promise<DatosSocio | null> {
  const snap = await getDoc(getDocPath(uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as DatosSocio;
}

/**
 * Upsert · idempotente. Maneja conversión de Date → Timestamp y limpieza
 * de undefined.
 */
export async function setDatosSocio(
  uid: string,
  data: DatosSocioFormData,
  userIdActor: string,
): Promise<void> {
  const existing = await getDatosSocio(uid);

  // Convertir aporteDeValor.vesting.fechaInicioVesting si existe
  let aporteDeValor: DatosSocio['aporteDeValor'];
  if (data.aporteDeValor) {
    aporteDeValor = {
      tiposDeValor: data.aporteDeValor.tiposDeValor,
      descripcion: data.aporteDeValor.descripcion,
    };
    if (data.aporteDeValor.valuacionEstimadaPEN !== undefined) {
      aporteDeValor.valuacionEstimadaPEN = data.aporteDeValor.valuacionEstimadaPEN;
    }
    if (data.aporteDeValor.vesting) {
      aporteDeValor.vesting = {
        tipoVesting: data.aporteDeValor.vesting.tipoVesting,
      };
      if (data.aporteDeValor.vesting.mesesVesting !== undefined) {
        aporteDeValor.vesting.mesesVesting = data.aporteDeValor.vesting.mesesVesting;
      }
      if (data.aporteDeValor.vesting.mesesCliff !== undefined) {
        aporteDeValor.vesting.mesesCliff = data.aporteDeValor.vesting.mesesCliff;
      }
      if (data.aporteDeValor.vesting.fechaInicioVesting) {
        aporteDeValor.vesting.fechaInicioVesting = Timestamp.fromDate(
          data.aporteDeValor.vesting.fechaInicioVesting
        );
      }
    }
  }

  const docData: Partial<DatosSocio> = {
    uid,
    porcentajeParticipacion: data.porcentajeParticipacion,
    fechaIngresoNegocio: Timestamp.fromDate(data.fechaIngresoNegocio),
    tipoParticipacion: data.tipoParticipacion,
    fechaActualizacion: Timestamp.now(),
    actualizadoPor: userIdActor,
  };

  if (data.rolEnNegocio) docData.rolEnNegocio = data.rolEnNegocio;
  if (aporteDeValor) docData.aporteDeValor = aporteDeValor;
  if (data.tcsPersonalesVinculadas?.length) {
    docData.tcsPersonalesVinculadas = data.tcsPersonalesVinculadas;
  }
  if (data.notas) docData.notas = data.notas;

  if (!existing) {
    docData.fechaCreacion = Timestamp.now();
    docData.creadoPor = userIdActor;
  } else {
    docData.fechaCreacion = existing.fechaCreacion;
    docData.creadoPor = existing.creadoPor;
  }

  await setDoc(getDocPath(uid), docData);
  logger.success(`Datos socio ${existing ? 'actualizados' : 'creados'} para uid: ${uid}`);
}

export async function deleteDatosSocio(uid: string): Promise<void> {
  await deleteDoc(getDocPath(uid));
  logger.success(`Datos socio eliminados para uid: ${uid}`);
}

/**
 * Listar TODOS los usuarios que tienen sub-perfil datosSocio.
 * Usado por el módulo Inversionistas para reemplazar la colección /socios.
 */
export async function listarUsuariosConDatosSocio(): Promise<DatosSocio[]> {
  const cg = collectionGroup(db, 'private');
  const snapshot = await getDocs(cg);
  const result: DatosSocio[] = [];

  snapshot.forEach((d) => {
    if (d.id !== DOC_ID) return;
    const data = d.data() as DatosSocio;
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

export const datosSocioService = {
  get: getDatosSocio,
  set: setDatosSocio,
  delete: deleteDatosSocio,
  listAll: listarUsuariosConDatosSocio,
};
