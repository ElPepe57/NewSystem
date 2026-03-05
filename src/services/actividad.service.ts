import {
  addDoc,
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type { ActividadReciente, ActividadFormData } from '../types/collaboration.types';

const COLLECTION_NAME = COLLECTIONS.ACTIVIDAD;

// Cache de displayNames para no hacer queries repetidos
const displayNameCache = new Map<string, string>();

async function resolveDisplayName(userId: string, displayName: string): Promise<string> {
  // Si ya es un nombre legible (no parece UID), usarlo directo
  if (displayName !== userId && displayName.length < 40 && !displayName.match(/^[a-zA-Z0-9]{20,}$/)) {
    return displayName;
  }

  // Buscar en cache
  if (displayNameCache.has(userId)) {
    return displayNameCache.get(userId)!;
  }

  // Buscar en Firestore
  try {
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId));
    if (userDoc.exists()) {
      const name = userDoc.data().displayName || userId;
      displayNameCache.set(userId, name);
      return name;
    }
  } catch {
    // Silenciar
  }

  return displayName;
}

export const actividadService = {
  /**
   * Registrar una actividad. Fire-and-forget — nunca debe bloquear la operación principal.
   * Resuelve automáticamente el displayName si se pasa un UID.
   * Llamar con .catch(() => {}) desde los servicios.
   */
  async registrar(data: ActividadFormData): Promise<void> {
    try {
      const displayName = await resolveDisplayName(data.userId, data.displayName);
      await addDoc(collection(db, COLLECTION_NAME), {
        ...data,
        displayName,
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      // Silenciar — la actividad es secundaria, nunca debe fallar la operación principal
      console.error('Error registrando actividad:', error);
    }
  },

  /**
   * Suscripción en tiempo real a las últimas actividades.
   * Devuelve las últimas 50 actividades ordenadas por fecha descendente.
   */
  suscribirActividad(
    callback: (actividades: ActividadReciente[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const actividades = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as ActividadReciente));
      callback(actividades);
    }, (error) => {
      console.error('Error en suscripción de actividad:', error);
    });
  },
};
