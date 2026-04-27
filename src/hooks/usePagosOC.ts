/**
 * usePagosOC — S55 Fase 2 · Hook reactivo para pagos de una OC
 *
 * Lee desde `movimientosCC` (vía adaptador) y expone el array en formato
 * legacy `PagoOCLegacy[]` para consumidores existentes (UIs OC, etc.).
 *
 * Recarga automáticamente cuando cambia `oc.cantidadMovimientos` o
 * el saldo de la CC del proveedor (no es real-time por mov, pero se
 * refresca cuando el usuario navega o se registra un pago nuevo).
 *
 * Uso:
 *   const { pagos, loading, refresh } = usePagosOC(ocId);
 *
 * Para casos donde se necesita real-time estricto, usar
 * `useMovimientosCC` directamente con filtros por refDocumentoId.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  getPagosOC,
  type PagoOCLegacy,
} from '../services/cuentaCorriente.adaptadores';

interface UsePagosOCResult {
  pagos: PagoOCLegacy[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Total pagado en USD (suma de todos los pagos). */
  totalPagadoUSD: number;
}

export function usePagosOC(ocId: string | undefined | null): UsePagosOCResult {
  const [pagos, setPagos] = useState<PagoOCLegacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ocId) {
      setPagos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await getPagosOC(ocId);
      setPagos(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando pagos');
    } finally {
      setLoading(false);
    }
  }, [ocId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalPagadoUSD = pagos.reduce((sum, p) => sum + p.montoUSD, 0);

  return { pagos, loading, error, refresh, totalPagadoUSD };
}
