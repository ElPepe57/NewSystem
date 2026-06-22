/**
 * delegacionAutorizacion.service · F4 · CRUD + chequeo de delegaciones de autoridad de egresos.
 *
 * Un socio delega su facultad de autorizar egresos a un usuario o rol (cuando se ausenta).
 * El chequeo `tieneAutoridadDelegada` lo consumen los servicios de egreso (gasto/OC/req) y la
 * bandeja para ampliar el pool de quienes pueden firmar (la regla de doble firma se mantiene).
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';
import {
  type DelegacionAutorizacion,
  tieneAutoridadDelegada as tieneAutoridadDelegadaPuro,
} from './delegacionAutorizacion.helper';

const COL = COLLECTIONS.DELEGACIONES_AUTORIZACION;

export interface CrearDelegacionInput {
  delegadoPorNombre?: string;
  tipo: 'usuario' | 'rol';
  delegadoAUsuario?: string;
  delegadoANombre?: string;
  delegadoARol?: string;
  motivo?: string;
  /** Vigencia opcional · si no se pasa, rige hasta revocarla. */
  hasta?: Date;
}

function mapDoc(id: string, data: Record<string, unknown>): DelegacionAutorizacion {
  return { id, ...(data as Omit<DelegacionAutorizacion, 'id'>) };
}

export const delegacionAutorizacionService = {
  /** Crear una delegación (la firma el socio que delega · `userId`). */
  async crear(input: CrearDelegacionInput, userId: string): Promise<string> {
    if (input.tipo === 'usuario' && !input.delegadoAUsuario) throw new Error('Falta el usuario delegado.');
    if (input.tipo === 'rol' && !input.delegadoARol) throw new Error('Falta el rol delegado.');
    const docData: Record<string, unknown> = {
      delegadoPor: userId,
      tipo: input.tipo,
      activa: true,
      desde: serverTimestamp(),
      creadoEn: serverTimestamp(),
    };
    if (input.delegadoPorNombre) docData.delegadoPorNombre = input.delegadoPorNombre;
    if (input.tipo === 'usuario') {
      docData.delegadoAUsuario = input.delegadoAUsuario;
      if (input.delegadoANombre) docData.delegadoANombre = input.delegadoANombre;
    } else {
      docData.delegadoARol = input.delegadoARol;
    }
    if (input.motivo) docData.motivo = input.motivo;
    if (input.hasta) docData.hasta = Timestamp.fromDate(input.hasta);
    const ref = await addDoc(collection(db, COL), docData);
    return ref.id;
  },

  /** Revocar una delegación (la desactiva · no se borra · auditoría). */
  async revocar(id: string, userId: string): Promise<void> {
    await updateDoc(doc(db, COL, id), { activa: false, revocadaPor: userId, fechaRevocacion: serverTimestamp() });
  },

  /** Delegaciones que YO (socio) creé · para la sección de gestión en Mi perfil. */
  async listarMias(socioUid: string): Promise<DelegacionAutorizacion[]> {
    try {
      const q = query(collection(db, COL), where('delegadoPor', '==', socioUid), orderBy('creadoEn', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => mapDoc(d.id, d.data()));
    } catch (e) {
      logger.warn('Error listando delegaciones propias:', e);
      // Fallback sin orderBy (si falta índice compuesto).
      const snap = await getDocs(query(collection(db, COL), where('delegadoPor', '==', socioUid)));
      return snap.docs.map((d) => mapDoc(d.id, d.data()));
    }
  },

  /** Todas las delegaciones activas (pool chico) · base del chequeo de autoridad. */
  async listarActivas(): Promise<DelegacionAutorizacion[]> {
    const snap = await getDocs(query(collection(db, COL), where('activa', '==', true)));
    return snap.docs.map((d) => mapDoc(d.id, d.data()));
  },

  /** ¿este usuario tiene autoridad DELEGADA vigente para autorizar egresos? (async · I/O + helper puro). */
  async tieneAutoridadDelegada(userId: string, userRoles: string[]): Promise<boolean> {
    const activas = await this.listarActivas().catch(() => [] as DelegacionAutorizacion[]);
    return tieneAutoridadDelegadaPuro(activas, userId, userRoles, Date.now());
  },
};
