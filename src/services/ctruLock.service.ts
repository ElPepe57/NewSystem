import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

/**
 * Servicio de Lock para recálculo CTRU
 *
 * Previene ejecuciones concurrentes de recalcularCTRUDinamico() que pueden
 * causar corrupción de datos (race condition: lectura-cálculo-escritura con datos obsoletos).
 *
 * Estrategia:
 * - Mutex en memoria (variable isRunning) para protección dentro de la misma pestaña
 * - Documento Firestore 'system/ctru_lock' para visibilidad cross-tab (informativo)
 * - Si el lock está tomado, encola la petición (máximo 1) y ejecuta al terminar
 * - Timeout de 30 segundos para prevenir locks permanentes
 */

type CTRUResult = {
  unidadesActualizadas: number;
  gastosAplicados: number;
  impactoPorUnidad: number;
};

const LOCK_DOC_PATH = 'system/ctru_lock';
const LOCK_TIMEOUT_MS = 30_000;

let isRunning = false;
let pendingResolve: ((result: CTRUResult | null) => void) | null = null;
let pendingFn: (() => Promise<CTRUResult>) | null = null;

export const ctruLockService = {
  /**
   * Ejecutar una función de recálculo CTRU con protección de lock.
   * Si ya hay un recálculo en curso, encola la petición (máx 1).
   */
  async executeWithLock(
    fn: () => Promise<CTRUResult>
  ): Promise<CTRUResult | null> {
    // Si ya está corriendo en esta pestaña, encolar (máximo 1 pendiente)
    if (isRunning) {
      console.log('[CTRU Lock] Recálculo ya en ejecución, encolando petición');

      // Si ya hay uno encolado, reemplazarlo (solo interesa el más reciente)
      if (pendingResolve) {
        pendingResolve(null); // Resolver el anterior como null (fue reemplazado)
      }

      return new Promise<CTRUResult | null>((resolve) => {
        pendingResolve = resolve;
        pendingFn = fn;
      });
    }

    // Verificar si otro tab tiene el lock (via Firestore)
    try {
      const lockSnap = await getDoc(doc(db, LOCK_DOC_PATH));
      if (lockSnap.exists()) {
        const lockData = lockSnap.data();
        if (lockData.status === 'running' && lockData.lockedAt) {
          const lockedAtMs = lockData.lockedAt.toMillis();
          const elapsed = Date.now() - lockedAtMs;
          if (elapsed < LOCK_TIMEOUT_MS) {
            console.log(`[CTRU Lock] Otro tab tiene el lock (${Math.round(elapsed / 1000)}s). Encolando...`);
            return new Promise<CTRUResult | null>((resolve) => {
              pendingResolve = resolve;
              pendingFn = fn;
              // Reintentar después de un delay
              setTimeout(() => {
                if (pendingFn && pendingResolve) {
                  const savedFn = pendingFn;
                  const savedResolve = pendingResolve;
                  pendingFn = null;
                  pendingResolve = null;
                  this.executeWithLock(savedFn).then(savedResolve);
                }
              }, 5000);
            });
          }
          // Lock expirado, proceder
          console.warn('[CTRU Lock] Lock expirado encontrado, procediendo con recálculo');
        }
      }
    } catch (e) {
      // Si falla la lectura del lock, proceder de todas formas (el mutex local protege)
      console.warn('[CTRU Lock] No se pudo verificar lock remoto, usando solo lock local:', e);
    }

    // Adquirir lock
    isRunning = true;
    try {
      // Escribir lock en Firestore (informativo para otros tabs)
      await setDoc(doc(db, LOCK_DOC_PATH), {
        lockedAt: Timestamp.now(),
        lockedBy: auth.currentUser?.uid || 'system',
        status: 'running'
      }).catch(() => {}); // No bloquear si falla la escritura del lock

      console.log('[CTRU Lock] Lock adquirido, ejecutando recálculo...');

      // Ejecutar la función protegida
      const result = await fn();

      // Liberar lock en Firestore
      await setDoc(doc(db, LOCK_DOC_PATH), {
        status: 'idle',
        lastResult: {
          unidadesActualizadas: result.unidadesActualizadas,
          gastosAplicados: result.gastosAplicados,
          completedAt: Timestamp.now()
        },
        lockedBy: auth.currentUser?.uid || 'system',
        lockedAt: Timestamp.now()
      }).catch(() => {});

      console.log(`[CTRU Lock] Recálculo completado: ${result.unidadesActualizadas} unidades`);
      return result;
    } catch (error) {
      // Liberar lock en caso de error
      await setDoc(doc(db, LOCK_DOC_PATH), {
        status: 'error',
        error: String(error),
        failedAt: Timestamp.now(),
        lockedBy: auth.currentUser?.uid || 'system'
      }).catch(() => {});

      throw error;
    } finally {
      isRunning = false;

      // Procesar petición encolada si existe
      if (pendingFn && pendingResolve) {
        const nextFn = pendingFn;
        const nextResolve = pendingResolve;
        pendingFn = null;
        pendingResolve = null;

        console.log('[CTRU Lock] Procesando petición encolada...');
        // Delay breve para no martillar Firestore
        setTimeout(() => {
          this.executeWithLock(nextFn).then(nextResolve).catch(() => nextResolve(null));
        }, 500);
      }
    }
  },

  /** Verificar si hay un recálculo en curso (para indicadores UI) */
  isLocked(): boolean {
    return isRunning;
  }
};
