import { logger } from '../lib/logger';
import {
  doc,
  collection,
  query,
  orderBy,
  where,
  limit,
  Timestamp,
  onSnapshot,
  writeBatch,
  type Unsubscribe,
  type QuerySnapshot,
  type DocumentData,
  type Query
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type { ChatMensaje } from '../types/collaboration.types';

const MENSAJES_COLLECTION = COLLECTIONS.CHAT_MENSAJES;
const META_COLLECTION = COLLECTIONS.CHAT_META;

const RETRY_DELAY_MS = 3000;
const MAX_RETRIES = 10;

/**
 * Genera un ID determinístico para un canal DM entre dos usuarios.
 */
export function getDMCanalId(uid1: string, uid2: string): string {
  return `dm_${[uid1, uid2].sort().join('_')}`;
}

/**
 * Helper: crea una suscripción onSnapshot con retry automático en caso de error.
 * Cuando Firestore lanza error (ej: índice faltante, red caída), la suscripción muere.
 * Este wrapper la re-crea automáticamente tras un delay.
 */
function onSnapshotWithRetry(
  buildQuery: () => Query<DocumentData>,
  onData: (snapshot: QuerySnapshot<DocumentData>) => void,
  label: string
): Unsubscribe {
  let unsub: Unsubscribe | null = null;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;
  let retryCount = 0;
  let cancelled = false;

  const subscribe = () => {
    if (cancelled) return;
    try {
      const q = buildQuery();
      unsub = onSnapshot(q, (snapshot) => {
        retryCount = 0;
        onData(snapshot);
      }, (error) => {
        logger.error(`[Chat] Error en suscripción ${label}:`, error.message);
        unsub = null;
        if (!cancelled && retryCount < MAX_RETRIES) {
          retryCount++;
          logger.info(`[Chat] Reintentando ${label} en ${RETRY_DELAY_MS / 1000}s (intento ${retryCount}/${MAX_RETRIES})...`);
          retryTimeout = setTimeout(subscribe, RETRY_DELAY_MS);
        }
      });
    } catch (err) {
      logger.error(`[Chat] Error creando query ${label}:`, err);
    }
  };

  subscribe();

  return () => {
    cancelled = true;
    if (unsub) unsub();
    if (retryTimeout) clearTimeout(retryTimeout);
  };
}

export const chatService = {
  /**
   * Enviar un mensaje a un canal (general o DM).
   * Usa writeBatch para escribir mensaje + metadata en un solo commit atómico.
   */
  async enviarMensaje(
    texto: string,
    userId: string,
    displayName: string,
    canalId: string = 'general',
    photoURL?: string
  ): Promise<void> {
    const ahora = Timestamp.now();

    const batch = writeBatch(db);

    const msgRef = doc(collection(db, MENSAJES_COLLECTION));
    const msgData: Record<string, unknown> = {
      texto: texto.trim(),
      userId,
      displayName,
      timestamp: ahora,
      canalId,
    };
    if (photoURL) msgData.photoURL = photoURL;
    batch.set(msgRef, msgData);

    const metaRef = doc(db, META_COLLECTION, canalId);
    batch.set(metaRef, {
      ultimoMensaje: ahora,
      ultimoUsuario: displayName,
    }, { merge: true });

    await batch.commit();
  },

  /**
   * Suscripción al chat general (incluye mensajes antiguos sin canalId).
   * Auto-retry si la suscripción falla.
   */
  suscribirMensajes(
    callback: (mensajes: ChatMensaje[]) => void,
    limitCount: number = 100
  ): Unsubscribe {
    return onSnapshotWithRetry(
      () => query(
        collection(db, MENSAJES_COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      ),
      (snapshot) => {
        const mensajes = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as ChatMensaje))
          .filter(m => !m.canalId || m.canalId === 'general');

        callback(mensajes.reverse());
      },
      'general'
    );
  },

  /**
   * Suscripción a un canal específico (DM).
   * Auto-retry si la suscripción falla (ej: índice aún construyéndose).
   */
  suscribirMensajesCanal(
    canalId: string,
    callback: (mensajes: ChatMensaje[]) => void,
    limitCount: number = 100
  ): Unsubscribe {
    return onSnapshotWithRetry(
      () => query(
        collection(db, MENSAJES_COLLECTION),
        where('canalId', '==', canalId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      ),
      (snapshot) => {
        const mensajes = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        } as ChatMensaje));

        callback(mensajes.reverse());
      },
      `canal:${canalId}`
    );
  },
};
