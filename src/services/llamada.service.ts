import {
  addDoc,
  doc,
  updateDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  where,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type { LlamadaActiva } from '../types/collaboration.types';

const COLLECTION_NAME = COLLECTIONS.LLAMADAS;

export const llamadaService = {
  /**
   * Crear documento de llamada en Firestore (estado = 'sonando').
   * Retorna el ID del documento creado.
   */
  async crearLlamada(data: Omit<LlamadaActiva, 'id' | 'respondidoEn' | 'finalizadoEn'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      tipo: data.tipo,
      estado: 'sonando',
      creadorId: data.creadorId,
      creadorNombre: data.creadorNombre,
      creadorRole: data.creadorRole || null,
      creadorPhotoURL: data.creadorPhotoURL || null,
      destinatarioId: data.destinatarioId || null,
      destinatarioNombre: data.destinatarioNombre || null,
      participantes: data.participantes,
      roomName: data.roomName,
      roomUrl: data.roomUrl || null,
      creadoEn: Timestamp.now(),
    });
    return docRef.id;
  },

  /** Aceptar llamada: estado → 'activa' */
  async aceptarLlamada(llamadaId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION_NAME, llamadaId), {
      estado: 'activa',
      respondidoEn: Timestamp.now(),
    });
  },

  /** Rechazar llamada: estado → 'rechazada' */
  async rechazarLlamada(llamadaId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION_NAME, llamadaId), {
      estado: 'rechazada',
      finalizadoEn: Timestamp.now(),
    });
  },

  /** Finalizar llamada (colgar): estado → 'finalizada' */
  async finalizarLlamada(llamadaId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION_NAME, llamadaId), {
      estado: 'finalizada',
      finalizadoEn: Timestamp.now(),
    });
  },

  /** Marcar como no contestada (timeout 30s) */
  async marcarNoContestada(llamadaId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION_NAME, llamadaId), {
      estado: 'no_contestada',
      finalizadoEn: Timestamp.now(),
    });
  },

  /**
   * Suscripcion en tiempo real a llamadas entrantes para un usuario.
   * Query: participantes array-contains myUid AND estado == 'sonando'
   * Filtra client-side las llamadas creadas por el propio usuario.
   */
  suscribirLlamadasEntrantes(
    myUid: string,
    callback: (llamadas: LlamadaActiva[]) => void
  ): Unsubscribe {
    let unsub: Unsubscribe | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    let cancelled = false;

    const subscribe = () => {
      if (cancelled) return;
      try {
        const q = query(
          collection(db, COLLECTION_NAME),
          where('participantes', 'array-contains', myUid),
          where('estado', '==', 'sonando')
        );

        unsub = onSnapshot(q, (snapshot) => {
          retryCount = 0;
          const llamadas = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as LlamadaActiva))
            .filter(l => l.creadorId !== myUid);
          callback(llamadas);
        }, (error) => {
          console.error('Error en suscripcion de llamadas entrantes:', error.message);
          unsub = null;
          if (!cancelled && retryCount < 10) {
            retryCount++;
            console.log(`[Llamadas] Reintentando suscripción en 3s (intento ${retryCount}/10)...`);
            retryTimeout = setTimeout(subscribe, 3000);
          }
        });
      } catch (err) {
        console.error('[Llamadas] Error creando query:', err);
      }
    };

    subscribe();

    return () => {
      cancelled = true;
      if (unsub) unsub();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  },

  /**
   * Suscripcion en tiempo real a un documento de llamada especifico.
   * Usado por el caller para rastrear cambios de estado (aceptada/rechazada/etc).
   */
  suscribirLlamada(
    llamadaId: string,
    callback: (llamada: LlamadaActiva | null) => void
  ): Unsubscribe {
    return onSnapshot(doc(db, COLLECTION_NAME, llamadaId), (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      callback({ id: snapshot.id, ...snapshot.data() } as LlamadaActiva);
    }, (error) => {
      console.error('Error en suscripcion de llamada:', error);
    });
  },

  /**
   * Limpiar documentos de llamada antiguos (>1 hora, no activas).
   * Se ejecuta una vez al iniciar la app, similar a presenciaService.limpiarHuerfanos().
   */
  async limpiarLlamadasAntiguas(): Promise<void> {
    try {
      const threshold = Timestamp.fromDate(new Date(Date.now() - 60 * 60 * 1000));
      const q = query(
        collection(db, COLLECTION_NAME),
        where('creadoEn', '<', threshold)
      );

      const snapshot = await getDocs(q);
      const deletions = snapshot.docs
        .filter(d => d.data().estado !== 'activa')
        .map(d => deleteDoc(d.ref));

      if (deletions.length > 0) {
        await Promise.all(deletions);
      }
    } catch (error) {
      console.error('Error limpiando llamadas antiguas:', error);
    }
  },
};
