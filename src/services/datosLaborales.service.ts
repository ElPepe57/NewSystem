/**
 * datosLaborales.service.ts · chk5.F2-SUB-PERFILES (2026-05-24)
 *
 * LECTURA del sub-perfil legacy "datosLaborales" (/users/{uid}/private/datosLaborales).
 *
 * ⚠️ MODELO EN DEPRECACIÓN (2026-06-14): la ESCRITURA migró al modelo vivo
 * `RelacionLaboral`. Este service quedó SOLO con `get`, usado como FALLBACK por
 * `perfilPersona.adapter.getDatosLaboralesView` para personas cuya data laboral
 * aún viva en el modelo viejo (sembrada a mano · sin RelacionLaboral todavía).
 *
 * Cuando se confirme que TODA persona con datos laborales tiene su RelacionLaboral,
 * este service, su colección y el fallback del adaptador se pueden borrar por completo.
 * (Las funciones de escritura set/delete/listAll se eliminaron · estaban muertas.)
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type { DatosLaborales } from '../types/datosLaborales.types';

const DOC_ID = 'datosLaborales';

/** Path al doc · subcolección privada del user. */
function getDocPath(uid: string) {
  return doc(db, COLLECTIONS.USERS, uid, 'private', DOC_ID);
}

/** Obtener datos laborales legacy de un usuario. Retorna null si no existen. */
export async function getDatosLaborales(uid: string): Promise<DatosLaborales | null> {
  const snap = await getDoc(getDocPath(uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as DatosLaborales;
}

export const datosLaboralesService = {
  get: getDatosLaborales,
};
