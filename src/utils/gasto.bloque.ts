/**
 * Utility · Resolver bloque de costo de un Gasto (chk5.A5)
 *
 * Centraliza la lógica de "qué bloque tiene este gasto" para evitar duplicación
 * entre hooks (useRentabilidadVentas), widgets (RentabilidadTresNivelesWidget),
 * componentes (Gastos.tsx, GastoForm.tsx), y reportes (ReporteDirectoIndirecto).
 *
 * Estrategia:
 *   1. Prioriza `gasto.categoriaCostoId` (modelo canónico 3 niveles)
 *      Resuelve via árbol cargado en categoriaCostoStore
 *   2. Fallback a `gasto.categoria` legacy (GV/GD/GA/GO)
 *      Mapping: GA/GO → 'periodo' · GV/GD → 'venta'
 *   3. Si nada match → null (gasto sin clasificar)
 *
 * El árbol debe pasarse desde el componente que ya lo carga vía
 * useCategoriaCostoStore.fetchArbol(). Esta utility NO carga · solo lee.
 */

import type { Gasto, CategoriaGasto } from '../types/gasto.types';
import type { BloqueCosto, CategoriaCosto } from '../types/categoriaCosto.types';

/** Estructura del árbol cargado por categoriaCostoStore */
export type ArbolCategorias = Record<
  BloqueCosto,
  { padres: CategoriaCosto[]; hijos: Record<string, CategoriaCosto[]> }
>;

/** Mapping de categoría legacy a bloque */
const LEGACY_CATEGORIA_A_BLOQUE: Record<CategoriaGasto, BloqueCosto> = {
  GA: 'periodo',
  GO: 'periodo',
  GV: 'venta',
  GD: 'venta',
};

/**
 * Resuelve el bloque de un gasto.
 * Retorna null si no se puede determinar (gasto sin clasificar).
 */
export function getBloqueDelGasto(
  gasto: Pick<Gasto, 'categoria' | 'categoriaCostoId'>,
  arbol?: ArbolCategorias | null
): BloqueCosto | null {
  // Estrategia 1: categoriaCostoId (canon)
  if (gasto.categoriaCostoId && arbol) {
    for (const bloque of ['producto', 'venta', 'periodo'] as BloqueCosto[]) {
      const datos = arbol[bloque];
      if (!datos) continue;
      // ¿Es categoría padre?
      if (datos.padres.some(p => p.id === gasto.categoriaCostoId)) return bloque;
      // ¿Es subcategoría?
      for (const padreId of Object.keys(datos.hijos)) {
        if (datos.hijos[padreId].some(h => h.id === gasto.categoriaCostoId)) return bloque;
      }
    }
  }

  // Estrategia 2: categoria legacy
  if (gasto.categoria) {
    return LEGACY_CATEGORIA_A_BLOQUE[gasto.categoria] ?? null;
  }

  return null;
}

/**
 * Predicado · ¿este gasto pertenece al bloque dado?
 * Útil para .filter() de listas.
 */
export function esGastoDelBloque(
  gasto: Pick<Gasto, 'categoria' | 'categoriaCostoId'>,
  bloque: BloqueCosto,
  arbol?: ArbolCategorias | null
): boolean {
  return getBloqueDelGasto(gasto, arbol) === bloque;
}

/**
 * Helpers semánticos · más legible que repetir esGastoDelBloque(g, 'producto', a)
 */
export const esGastoDeProducto = (g: Pick<Gasto, 'categoria' | 'categoriaCostoId'>, a?: ArbolCategorias | null) =>
  esGastoDelBloque(g, 'producto', a);

export const esGastoDeVenta = (g: Pick<Gasto, 'categoria' | 'categoriaCostoId'>, a?: ArbolCategorias | null) =>
  esGastoDelBloque(g, 'venta', a);

export const esGastoDePeriodo = (g: Pick<Gasto, 'categoria' | 'categoriaCostoId'>, a?: ArbolCategorias | null) =>
  esGastoDelBloque(g, 'periodo', a);
