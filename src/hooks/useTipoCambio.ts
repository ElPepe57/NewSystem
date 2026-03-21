import { useState, useEffect, useCallback, useRef } from 'react';
import { tipoCambioService } from '../services/tipoCambio.service';
import type { TCResuelto, TCFreshness } from '../types/tipoCambio.types';

interface UseTipoCambioResult {
  tc: TCResuelto | null;
  loading: boolean;
  error: string | null;
  freshness: TCFreshness;
  esFallback: boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook para consumir el TC centralizado con auto-refresh cada 5 minutos.
 * Provee estado de freshness para que los componentes reaccionen visualmente.
 */
export function useTipoCambio(): UseTipoCambioResult {
  const [tc, setTc] = useState<TCResuelto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTC = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const resultado = await tipoCambioService.resolverTC();
      setTc(resultado);
    } catch (err: any) {
      setError(err.message || 'Error obteniendo tipo de cambio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTC();
    // Auto-refresh cada 5 minutos
    intervalRef.current = setInterval(fetchTC, 5 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchTC]);

  return {
    tc,
    loading,
    error,
    freshness: tc?.freshness ?? 'unknown',
    esFallback: tc?.esFallback ?? false,
    refetch: fetchTC,
  };
}
