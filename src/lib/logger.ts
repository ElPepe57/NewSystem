/**
 * Logger simple para el sistema.
 * En producción, los errores de background se persisten en Firestore (_errorLog).
 */

const isDevelopment = import.meta.env.DEV;

// ---------------------------------------------------------------------------
// logBackgroundError — Deduplicación en memoria
// ---------------------------------------------------------------------------
// Registra la clave "operacion|mensaje" y el timestamp en que se logueó por
// última vez. Si el mismo par vuelve dentro de 60 segundos se descarta para
// no saturar Firestore con el mismo error repetido en loops rápidos.
const _dedupCache = new Map<string, number>();
const DEDUP_WINDOW_MS = 60_000;

function _isDuplicate(operation: string, message: string): boolean {
  const key = `${operation}|${message}`;
  const now = Date.now();
  const last = _dedupCache.get(key);
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) {
    return true;
  }
  _dedupCache.set(key, now);
  // Limpieza periódica: eliminar entradas expiradas para evitar memory leak
  // (solo cuando el cache crece; en condiciones normales tiene pocas entradas)
  if (_dedupCache.size > 200) {
    for (const [k, ts] of _dedupCache.entries()) {
      if (now - ts >= DEDUP_WINDOW_MS) _dedupCache.delete(k);
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------
export type BackgroundErrorSeverity = 'critical' | 'high' | 'medium';

export interface BackgroundErrorContext {
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// logBackgroundError
// ---------------------------------------------------------------------------
/**
 * Persiste un error de background (fire-and-forget) en Firestore.
 *
 * Garantías:
 *  - Nunca lanza excepciones ni rechaza promesas — es seguro en cualquier .catch()
 *  - Solo escribe en producción (o cuando VITE_FORCE_ERROR_LOG=true)
 *  - Deduplica: misma operación + mensaje dentro de 60 s → descarta silenciosamente
 *  - Importa Firestore de forma lazy para evitar dependencias circulares
 *
 * @param operation  Nombre corto del proceso (ej. 'poolUSD.tesoreria', 'ctru.postEntrega')
 * @param error      El error capturado
 * @param severity   'critical' | 'high' | 'medium'
 * @param context    Datos adicionales opcionales (IDs, montos, etc.)
 */
export function logBackgroundError(
  operation: string,
  error: unknown,
  severity: BackgroundErrorSeverity,
  context?: BackgroundErrorContext
): void {
  // Determinar si debemos persistir en Firestore
  const forceEnabled = import.meta.env.VITE_FORCE_ERROR_LOG === 'true';
  const shouldPersist = !isDevelopment || forceEnabled;

  // Extraer mensaje legible del error
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : JSON.stringify(error);

  // Siempre mantener visibilidad en consola para desarrollo
  if (isDevelopment || forceEnabled) {
    console.warn(`[ErrorLog][${severity.toUpperCase()}] ${operation}: ${message}`, context ?? '');
  }

  if (!shouldPersist) return;

  // Deduplicar antes de ir a Firestore
  if (_isDuplicate(operation, message)) return;

  // Escritura lazy — nunca bloquea, nunca lanza
  Promise.resolve()
    .then(async () => {
      const [{ collection, addDoc, Timestamp }, { db }, { COLLECTIONS }] = await Promise.all([
        import('firebase/firestore'),
        import('./firebase'),
        import('../config/collections'),
      ]);

      await addDoc(collection(db, COLLECTIONS.ERROR_LOG), {
        timestamp: Timestamp.now(),
        operation,
        message,
        severity,
        context: context ?? null,
        env: import.meta.env.MODE ?? 'unknown',
      });
    })
    .catch(() => {
      // Si la propia escritura en Firestore falla, absorber silenciosamente.
      // No podemos hacer nada más sin entrar en un loop de logging.
    });
}

// ---------------------------------------------------------------------------
// Logger general
// ---------------------------------------------------------------------------
export const logger = {
  /**
   * Log informativo - solo en desarrollo
   */
  info: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(message, ...args);
    }
  },

  /**
   * Log de éxito - solo en desarrollo
   */
  success: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(`✅ ${message}`, ...args);
    }
  },

  /**
   * Log de advertencia - siempre visible
   */
  warn: (message: string, ...args: unknown[]) => {
    console.warn(message, ...args);
  },

  /**
   * Log de error - siempre visible
   */
  error: (message: string, ...args: unknown[]) => {
    console.error(message, ...args);
  },

  /**
   * Log de debug - solo en desarrollo
   */
  debug: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.debug(message, ...args);
    }
  }
};
