/**
 * useMovimientosCC — S55 · Hook para listar movimientos de una CC
 *
 * Lista paginada de movimientos. NO usa suscripción real-time por defecto
 * (los movimientos son inmutables; se recargan al detectar nuevo movimiento
 * via cantidadMovimientos del CC raíz).
 *
 * Uso:
 *   const { movimientos, loading, refresh } = useMovimientosCC(ccId, { limit: 50 });
 */

import { useEffect, useState, useCallback } from 'react';
import { cuentaCorrienteService } from '../services/cuentaCorriente.service';
import type { MovimientoCC } from '../types/cuentaCorriente.types';

interface UseMovimientosCCOptions {
  /** Límite de movimientos a traer. Default: 100. */
  limit?: number;
  /** Si true, recarga automáticamente cada N segundos. Default: false. */
  autoRefreshMs?: number;
}

interface UseMovimientosCCResult {
  movimientos: MovimientoCC[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useMovimientosCC(
  cuentaCorrienteId: string | undefined | null,
  options?: UseMovimientosCCOptions,
): UseMovimientosCCResult {
  const [movimientos, setMovimientos] = useState<MovimientoCC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const limit = options?.limit ?? 100;

  const refresh = useCallback(async () => {
    if (!cuentaCorrienteId) {
      setMovimientos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await cuentaCorrienteService.getMovimientos(cuentaCorrienteId, {
        limit,
      });
      setMovimientos(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando movimientos');
    } finally {
      setLoading(false);
    }
  }, [cuentaCorrienteId, limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh opcional
  useEffect(() => {
    if (!options?.autoRefreshMs) return;
    const id = setInterval(() => refresh(), options.autoRefreshMs);
    return () => clearInterval(id);
  }, [options?.autoRefreshMs, refresh]);

  return { movimientos, loading, error, refresh };
}
