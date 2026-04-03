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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, lineaFiltroGlobal, allowUndefined]);
}

/**
 * Filtra entidades que tienen `lineaNegocioIds: string[]` (array de líneas).
 * Si la entidad no tiene líneas asignadas (vacío/undefined), se incluye siempre.
 */
export function useLineaFilterMulti<T>(
  items: T[],
  getLineaIds: (item: T) => string[] | undefined
): T[] {
  const lineaFiltroGlobal = useLineaNegocioStore(state => state.lineaFiltroGlobal);

  return useMemo(() => {
    if (!lineaFiltroGlobal) return items;

    return items.filter(item => {
      const ids = getLineaIds(item);
      if (!ids || ids.length === 0) return true; // Sin línea asignada = disponible para todas
      return ids.includes(lineaFiltroGlobal);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, lineaFiltroGlobal]);
}
