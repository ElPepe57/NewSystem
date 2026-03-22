import { logger } from './logger';

/**
 * Envuelve una función async y registra su duración.
 * Si supera 2000ms emite warn; de lo contrario, info.
 * Nunca suprime el error — lo re-lanza siempre.
 */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const ms = Math.round(performance.now() - start);
    if (ms > 2000) logger.warn(`[PERF] ${label}: ${ms}ms`);
    else logger.info(`[PERF] ${label}: ${ms}ms`);
    return result;
  } catch (e) {
    logger.error(`[PERF] ${label} failed after ${Math.round(performance.now() - start)}ms`);
    throw e;
  }
}
