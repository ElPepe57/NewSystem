/**
 * usePagosEnvio — S55 Fase 4 · Hook reactivo para pagos a colaborador en envíos
 *
 * Lee desde `movimientosCC` (vía adaptador) y expone el array en formato
 * legacy `PagoColaboradorLegacy[]` para consumidores existentes.
 *
 * Equivalente a `usePagosOC` y `useCobrosVenta` pero para envíos.
 *
 * Uso:
 *   const { pagos, loading, refresh, totalPagadoUSD } = usePagosEnvio(envioId);
 */

import { useEffect, useState, useCallback } from 'react';
import {
  getPagosEnvio,
  type PagoColaboradorLegacy,
} from '../services/cuentaCorriente.adaptadores';

interface UsePagosEnvioResult {
  pagos: PagoColaboradorLegacy[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Total pagado al colaborador en USD. */
  totalPagadoUSD: number;
}

export function usePagosEnvio(
  envioId: string | undefined | null,
): UsePagosEnvioResult {
  const [pagos, setPagos] = useState<PagoColaboradorLegacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!envioId) {
      setPagos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await getPagosEnvio(envioId);
      setPagos(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando pagos');
    } finally {
      setLoading(false);
    }
  }, [envioId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalPagadoUSD = pagos.reduce(
    (sum, p) => sum + (p.monedaPago === 'USD' ? p.montoOriginal : p.montoUSD),
    0,
  );

  return { pagos, loading, error, refresh, totalPagadoUSD };
}
