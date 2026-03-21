import {
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  where,
  Timestamp,
  onSnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import type { PresenciaUsuario } from '../types/collaboration.types';
import type { UserRole } from '../types/auth.types';

const COLLECTION_NAME = COLLECTIONS.PRESENCIA;

export const presenciaService = {
  /**
   * Actualizar presencia del usuario actual (heartbeat).
   * Se llama cada 2 minutos + al iniciar sesión.
   */
  async actualizarPresencia(
    uid: string,
    displayName: string,
    role: UserRole,
    paginaActual?: string,
    photoURL?: string
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, uid);
      const data: Record<string, unknown> = {
        uid,
        displayName,
        role,
        estado: 'online',
        ultimaActividad: Timestamp.now(),
        paginaActual: paginaActual || null,
      };
      if (photoURL) data.photoURL = photoURL;
      await setDoc(docRef, data, { merge: true });
    } catch (error) {
      logger.error('Error actualizando presencia:', error);
    }
  },

  /**
   * Marcar usuario como offline.
   * Se llama al cerrar sesión o cerrar pestaña.
   */
  async marcarOffline(uid: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, uid);
      await setDoc(docRef, {
        estado: 'offline',
        ultimaActividad: Timestamp.now(),
      }, { merge: true });
    } catch (error) {
      logger.error('Error marcando offline:', error);
    }
  },

  /**
   * Suscripción en tiempo real a todos los usuarios con presencia.
   * Devuelve solo usuarios activos (no invitados).
   */
  suscribirPresencia(
    callback: (usuarios: PresenciaUsuario[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('estado', 'in', ['online', 'away'])
    );

    return onSnapshot(q, (snapshot) => {
      const usuarios = snapshot.docs.map(d => ({
        ...d.data()
      } as PresenciaUsuario));

      // Ordenar: online primero, luego away
      usuarios.sort((a, b) => {
        if (a.estado === 'online' && b.estado !== 'online') return -1;
        if (a.estado !== 'online' && b.estado === 'online') return 1;
        return 0;
      });

      callback(usuarios);
    }, (error) => {
      logger.error('Error en suscripción de presencia:', error);
    });
  },

  /**
   * Eliminar documento de presencia de un usuario (al eliminarlo del sistema).
   */
  async eliminarPresencia(uid: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, uid);
      await deleteDoc(docRef);
    } catch (error) {
      logger.error('Error eliminando presencia:', error);
    }
  },

  /**
   * Limpiar documentos de presencia huérfanos (usuarios eliminados del sistema).
   */
  async limpiarHuerfanos(uidsActivos: string[]): Promise<void> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      const activosSet = new Set(uidsActivos);
      const eliminaciones = snapshot.docs
        .filter(d => !activosSet.has(d.id))
        .map(d => deleteDoc(d.ref));
      if (eliminaciones.length > 0) {
        await Promise.all(eliminaciones);
        logger.info(`Presencia: ${eliminaciones.length} documento(s) huérfano(s) eliminado(s)`);
      }
    } catch (error) {
      logger.error('Error limpiando presencia huérfana:', error);
    }
  },

  /**
   * Obtener todos los usuarios con presencia (snapshot único, para cargar offline).
   */
  async obtenerTodos(): Promise<PresenciaUsuario[]> {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return snapshot.docs.map(d => d.data() as PresenciaUsuario);
  },
};
