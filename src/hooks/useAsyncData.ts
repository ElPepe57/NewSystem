/**
 * useAsyncData — Canon de data-fetching · REFETCH SILENCIOSO (auditoría 2026-06-12)
 *
 * Encapsula el patrón canónico del sistema (referencia viva: Inversionistas.tsx
 * `{loading && !data && <spinner/>}`), institucionalizado tras la auditoría 360
 * del bug-clase "loading desmonta UI" (caso real: Usuarios · el modal Invitar se
 * re-abría vacío porque el refetch post-acción re-disparaba el early-return por
 * loading y desmontaba todo el árbol, modal incluido).
 *
 * Garantías estructurales (no dependen de la disciplina de quien programa):
 *   - `loading` es true SOLO durante el PRIMER load (cuando aún no hay data).
 *   - `refetch()` es SILENCIOSO: la UI sigue montada con la data anterior hasta
 *     que llega la nueva — nunca desmonta modales/overlays abiertos ni parpadea
 *     al spinner. Seguro de llamar desde onSuccess de cualquier modal/wizard.
 *   - `refreshing` indica refetch en curso (para spinner sutil opcional).
 *   - Cambio de `deps` = scope de datos NUEVO (ej. cambio de período) → vuelve
 *     a primer load (spinner legítimo · la data vieja no aplica al scope nuevo).
 *   - Respuestas fuera de orden se descartan (guard de carrera por runId).
 *
 * Uso:
 *   const { data, loading, error, refetch } = useAsyncData(() => service.getAll());
 *   if (loading) return <Spinner />;             // SOLO primer load
 *   ...
 *   <Wizard onSuccess={() => refetch()} />       // seguro: no desmonta nada
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAsyncDataResult<T> {
  /** Data cargada · null hasta que el primer load resuelve. */
  data: T | null;
  /** true SOLO durante el primer load (sin data aún). */
  loading: boolean;
  /** true durante un refetch silencioso (la data anterior sigue visible). */
  refreshing: boolean;
  /** Mensaje del último error de carga · null si la última carga fue exitosa. */
  error: string | null;
  /** Re-carga. Silenciosa si ya hay data · full-loading si el primer load falló. */
  refetch: () => Promise<void>;
}

export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
): UseAsyncDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Siempre la versión más reciente del fetcher · el consumidor NO necesita
  // memoizarlo (evita closures stale sin imponer useCallback en cada página).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const dataRef = useRef<T | null>(null);
  const runIdRef = useRef(0);

  const refetch = useCallback(async () => {
    const runId = ++runIdRef.current;
    const esPrimerLoad = dataRef.current === null;
    if (esPrimerLoad) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (runId !== runIdRef.current) return; // llegó tarde · ya hay un fetch más nuevo
      dataRef.current = result;
      setData(result);
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    // Cambio de deps = scope nuevo → resetea a primer load (spinner legítimo).
    dataRef.current = null;
    setData(null);
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, refreshing, error, refetch };
}
