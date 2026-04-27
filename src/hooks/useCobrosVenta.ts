/**
 * useCobrosVenta — S55 Fase 3 · Hook reactivo para cobros de una Venta
 *
 * Lee desde `movimientosCC` (vía adaptador) y expone el array en formato
 * legacy `CobroVentaLegacy[]` para consumidores existentes (UIs Venta).
 *
 * Equivalente a `usePagosOC` pero para ventas. Los cobros vienen de la CC
 * del cliente (movimientos `credito_cobro_venta`).
 *
 * Uso:
 *   const { cobros, loading, refresh, totalCobrado } = useCobrosVenta(ventaId);
 */

import { useEffect, useState, useCallback } from 'react';
import {
  getCobrosVenta,
  type CobroVentaLegacy,
} from '../services/cuentaCorriente.adaptadores';

interface UseCobrosVentaResult {
  cobros: CobroVentaLegacy[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Total cobrado en PEN (suma de todos los cobros). */
  totalCobrado: number;
}

export function useCobrosVenta(
  ventaId: string | undefined | null,
): UseCobrosVentaResult {
  const [cobros, setCobros] = useState<CobroVentaLegacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ventaId) {
      setCobros([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await getCobrosVenta(ventaId);
      setCobros(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando cobros');
    } finally {
      setLoading(false);
    }
  }, [ventaId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalCobrado = cobros.reduce((sum, c) => sum + c.monto, 0);

  return { cobros, loading, error, refresh, totalCobrado };
}
