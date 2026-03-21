import { useMemo } from 'react';
import { useLineaNegocioStore } from '../store/lineaNegocioStore';

/**
 * Filtra un array de items por la línea de negocio seleccionada globalmente.
 *
 * @param items - Array de elementos a filtrar.
 * @param getLineaId - Función que extrae el lineaNegocioId de cada item.
 *   - Si retorna `undefined` con `allowUndefined: true`, el item siempre se incluye
 *     (útil para gastos/movimientos compartidos sin línea asignada).
 * @param options.allowUndefined - Cuando `true`, items sin lineaNegocioId se incluyen
 *   aunque haya un filtro activo. Default: `false`.
 *
 * @example
 * // Filtrado estricto (solo items de la línea seleccionada)
 * const ventasFiltradas = useLineaFilter(ventas, v => v.lineaNegocioId);
 *
 * @example
 * // Filtrado permisivo (items sin línea siempre se muestran)
 * const gastosFiltrados = useLineaFilter(
 *   gastos,
 *   g => g.lineaNegocioId,
 *   { allowUndefined: true }
 * );
 */
export function useLineaFilter<T>(
  items: T[],
  getLineaId: (item: T) => string | null | undefined,
  options: { allowUndefined?: boolean } = {}
): T[] {
  const { allowUndefined = false } = options;
  const lineaFiltroGlobal = useLineaNegocioStore(state => state.lineaFiltroGlobal);

  return useMemo(() => {
    if (!lineaFiltroGlobal) return items;

    return items.filter(item => {
      const lineaId = getLineaId(item);
      if (allowUndefined && !lineaId) return true;
      return lineaId === lineaFiltroGlobal;
    });
    // getLineaId is intentionally omitted from deps — callers must pass a stable
    // reference (inline arrow functions defined outside useMemo are fine because
    // this hook memoizes on items + lineaFiltroGlobal, which already captures all
    // necessary invalidations). If a caller needs identity-based deps they can
    // wrap getLineaId in useCallback themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, lineaFiltroGlobal, allowUndefined]);
}
