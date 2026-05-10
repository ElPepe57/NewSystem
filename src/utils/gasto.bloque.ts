/**
 * Utility · Resolver bloque de costo de un Gasto (chk5 · S3.6 M1.bis)
 *
 * Centraliza la lógica de "qué bloque tiene este gasto" para evitar duplicación
 * entre hooks (useRentabilidadVentas), widgets (RentabilidadTresNivelesWidget),
 * componentes (Gastos.tsx, GastoForm.tsx), servicios (contabilidad, reporte,
 * gasto, ctru), y reportes (ReporteDirectoIndirecto).
 *
 * Modelo canónico (chk5.A15 · cirugía final completada):
 *   - Único path: `gasto.categoriaCostoId` resuelto via árbol dinámico
 *     (categoriasCosto/{id}) cargado en categoriaCostoStore.
 *   - Sin fallback legacy. Los tipos `CategoriaGasto`/`ClaseGasto`/etc fueron
 *     eliminados. El campo `gasto.categoria` ya no existe en el modelo.
 *
 * El árbol debe pasarse desde el componente que ya lo carga vía
 * useCategoriaCostoStore.fetchArbol(). Esta utility NO carga · solo lee.
 */

import type { Gasto, TipoGasto } from '../types/gasto.types';
import type { BloqueCosto, CategoriaCosto } from '../types/categoriaCosto.types';

/** Estructura del árbol cargado por categoriaCostoStore */
export type ArbolCategorias = Record<
  BloqueCosto,
  { padres: CategoriaCosto[]; hijos: Record<string, CategoriaCosto[]> }
>;

/**
 * Tipo mínimo para resolver bloque · solo necesita categoriaCostoId (canon).
 * chk5.A15 · el fallback legacy a `gasto.categoria` fue eliminado tras la
 * cirugía final · el campo categoria ya no existe en Gasto/GastoFormData.
 */
type GastoMinimoParaBloque = { categoriaCostoId?: string };

/**
 * Resuelve el bloque de un gasto desde su `categoriaCostoId` + árbol.
 * Retorna null si no se puede determinar (gasto sin clasificar o árbol no cargado).
 */
export function getBloqueDelGasto(
  gasto: GastoMinimoParaBloque,
  arbol?: ArbolCategorias | null
): BloqueCosto | null {
  if (!gasto.categoriaCostoId || !arbol) return null;
  for (const bloque of ['producto', 'venta', 'periodo'] as BloqueCosto[]) {
    const datos = arbol[bloque];
    if (!datos) continue;
    if (datos.padres.some(p => p.id === gasto.categoriaCostoId)) return bloque;
    for (const padreId of Object.keys(datos.hijos)) {
      if (datos.hijos[padreId].some(h => h.id === gasto.categoriaCostoId)) return bloque;
    }
  }
  return null;
}

/**
 * Predicado · ¿este gasto pertenece al bloque dado?
 * Útil para .filter() de listas.
 */
export function esGastoDelBloque(
  gasto: GastoMinimoParaBloque,
  bloque: BloqueCosto,
  arbol?: ArbolCategorias | null
): boolean {
  return getBloqueDelGasto(gasto, arbol) === bloque;
}

/**
 * Helpers semánticos · más legible que repetir esGastoDelBloque(g, 'producto', a)
 */
export const esGastoDeProducto = (g: GastoMinimoParaBloque, a?: ArbolCategorias | null) =>
  esGastoDelBloque(g, 'producto', a);

export const esGastoDeVenta = (g: GastoMinimoParaBloque, a?: ArbolCategorias | null) =>
  esGastoDelBloque(g, 'venta', a);

export const esGastoDePeriodo = (g: GastoMinimoParaBloque, a?: ArbolCategorias | null) =>
  esGastoDelBloque(g, 'periodo', a);

/**
 * Predicado canónico: ¿este gasto cae en la dimensión "distribución" del bloque
 * 'venta'? Reemplaza la distinción legacy GD vs GV que dependía del campo
 * `gasto.categoria`. Ahora se deriva del `tipo` del gasto (canon):
 *   - GD legacy ≡ tipos relacionados a distribución física: delivery, empaque, courier
 *   - GV legacy ≡ resto del bloque venta (comisiones, marketing directo, etc.)
 *
 * Útil para servicios que necesitan separar costos directos de distribución
 * vs costos directos de venta (comisiones) dentro del bloque 'venta'.
 */
const TIPOS_GASTO_DISTRIBUCION = new Set<TipoGasto>(['delivery', 'empaque']);

export function esGastoDistribucion(gasto: Pick<Gasto, 'tipo'>): boolean {
  return TIPOS_GASTO_DISTRIBUCION.has(gasto.tipo);
}

/**
 * Predicado canónico: ¿este gasto cae en la dimensión "administrativa" del
 * bloque 'periodo'? Reemplaza la distinción legacy GA vs GO que dependía del
 * campo `gasto.categoria`. Ahora se deriva del `tipo` (canon):
 *   - GA legacy ≡ tipos administrativos: 'administrativo', 'nomina'
 *   - GO legacy ≡ resto del bloque periodo (operativo, otros)
 *
 * Útil para reportes contables que aún necesitan el desglose administrativo
 * vs operativo dentro de los costos fijos del periodo.
 */
const TIPOS_GASTO_ADMINISTRATIVO = new Set<TipoGasto>(['administrativo', 'nomina']);

export function esGastoAdministrativo(gasto: Pick<Gasto, 'tipo'>): boolean {
  return TIPOS_GASTO_ADMINISTRATIVO.has(gasto.tipo);
}

/**
 * Resuelve el bloque + nombre de la categoría padre de un gasto en un solo
 * paso (chk5.A12 · evita doble loop en consumers como ReportesGastosBI).
 *
 * - Si tiene `categoriaCostoId` y existe en `arbol`: retorna ambos resueltos.
 * - Si nada match: retorna { bloque: null, categoriaPadre: null }.
 */
export function resolverGastoCanonico(
  gasto: GastoMinimoParaBloque,
  arbol?: ArbolCategorias | null
): { bloque: BloqueCosto | null; categoriaPadre: string | null } {
  if (!gasto.categoriaCostoId || !arbol) return { bloque: null, categoriaPadre: null };
  for (const bloque of ['producto', 'venta', 'periodo'] as BloqueCosto[]) {
    const datos = arbol[bloque];
    if (!datos) continue;
    // ¿Es categoría padre directa?
    const padreDirecto = datos.padres.find(p => p.id === gasto.categoriaCostoId);
    if (padreDirecto) return { bloque, categoriaPadre: padreDirecto.nombre };
    // ¿Es subcategoría? Buscar el padre por id
    for (const padreId of Object.keys(datos.hijos)) {
      if (datos.hijos[padreId].some(h => h.id === gasto.categoriaCostoId)) {
        const padreObj = datos.padres.find(p => p.id === padreId);
        return { bloque, categoriaPadre: padreObj?.nombre ?? null };
      }
    }
  }
  return { bloque: null, categoriaPadre: null };
}

// ─── RESOLUCIÓN INVERSA · TipoGasto legacy → categoriaCostoId canónico ──────

/**
 * Mapeo canónico · TipoGasto legacy → { bloque, categoriaPadreNombre, subcategoriaNombre? }
 * Mismo mapping que scripts/migrate-gastos-legacy-a-categoriaCostoId.mjs (chk5.A4)
 * pero portado a TS para uso en servicios.
 */
const TIPO_GASTO_A_CANON: Record<TipoGasto, { bloque: BloqueCosto; padre: string; sub?: string }> = {
  // PRODUCTO (afecta CTRU)
  flete_internacional:  { bloque: 'producto', padre: 'Transporte',  sub: 'Flete viajero' },
  flete_usa_peru:       { bloque: 'producto', padre: 'Transporte',  sub: 'Flete viajero' },
  recojo_local:         { bloque: 'producto', padre: 'Manipuleo',   sub: 'Recojo local' },
  almacenaje:           { bloque: 'producto', padre: 'Manipuleo',   sub: 'Almacenaje temporal' },
  internacion:          { bloque: 'producto', padre: 'Aranceles',   sub: 'Impuesto importacion' },
  // PRODUCTO · pérdidas (chk5.A10 · subcat propia "Pérdidas" en seed)
  merma_transferencia:  { bloque: 'producto', padre: 'Pérdidas',    sub: 'Merma transferencia' },
  merma_vencimiento:    { bloque: 'producto', padre: 'Pérdidas',    sub: 'Merma vencimiento' },
  desmedro:             { bloque: 'producto', padre: 'Pérdidas',    sub: 'Desmedro' },

  // VENTA (afecta margen contribución)
  comision_ml:          { bloque: 'venta', padre: 'Comisiones',         sub: 'Comision ML' },
  comision_pasarela:    { bloque: 'venta', padre: 'Comisiones',         sub: 'Comision pasarela' },
  comision_vendedor:    { bloque: 'venta', padre: 'Comisiones',         sub: 'Comision vendedor' },
  delivery:             { bloque: 'venta', padre: 'Distribucion',       sub: 'Delivery local' },
  empaque:              { bloque: 'venta', padre: 'Empaque',            sub: 'Kit de empaque' },
  marketing:            { bloque: 'venta', padre: 'Marketing directo',  sub: 'Promocion' },

  // PERIODO (afecta margen operativo)
  nomina:               { bloque: 'periodo', padre: 'Personal',         sub: 'Sueldos' },
  administrativo:       { bloque: 'periodo', padre: 'Profesionales',    sub: 'Consultorias' },
  operativo:            { bloque: 'periodo', padre: 'Operativos',       sub: 'Suministros oficina' },
  otros:                { bloque: 'periodo', padre: 'Operativos',       sub: 'Suministros oficina' },
};

/**
 * Resuelve el categoriaCostoId canónico para un TipoGasto + árbol cargado.
 * Usado por servicios que crean gastos automáticos (planilla, reclamo, bajaInventario, etc).
 *
 * Retorna `null` si:
 *   - El tipo no está mapeado
 *   - El árbol no tiene la categoría/subcategoría correspondiente
 *
 * En caso null, el servicio debe persistir solo `categoria` legacy (compat hasta seed completo).
 */
export function resolverCategoriaCostoIdParaTipo(
  tipo: TipoGasto,
  arbol: ArbolCategorias | null | undefined
): string | null {
  if (!arbol) return null;
  const mapping = TIPO_GASTO_A_CANON[tipo];
  if (!mapping) return null;

  const datosBloque = arbol[mapping.bloque];
  if (!datosBloque) return null;

  // Buscar categoría padre por nombre
  const padre = datosBloque.padres.find(p => p.nombre === mapping.padre);
  if (!padre) return null;

  // Si hay subcategoría definida y existe, preferirla
  if (mapping.sub) {
    const hijos = datosBloque.hijos[padre.id] ?? [];
    const sub = hijos.find(h => h.nombre === mapping.sub);
    if (sub) return sub.id;
  }

  // Fallback al padre
  return padre.id;
}

/**
 * Obtiene el bloque canónico para un TipoGasto sin necesidad de árbol.
 * Útil cuando solo se necesita saber el bloque (no el id de categoría).
 */
export function getBloqueParaTipo(tipo: TipoGasto): BloqueCosto | null {
  return TIPO_GASTO_A_CANON[tipo]?.bloque ?? null;
}

// chk5.A15 · ADAPTADORES LEGACY ELIMINADOS · cirugía final completada
// ─────────────────────────────────────────────────────────────────────
// Eliminados en este chunk:
//   - LEGACY_CATEGORIA_A_BLOQUE (Record<CategoriaGasto, BloqueCosto>)
//   - TIPO_A_CATEGORIA_LEGACY (Record<TipoGasto, CategoriaGasto>)
//   - getCategoriaLegacyDelGasto(gasto, arbol)
//   - normalizarGastosConCategoriaLegacy(gastos, arbol)
//   - bloqueToClaseGasto(bloque)
//   - resolverClaseGasto(gasto, arbol)
//
// Razón: los tipos CategoriaGasto/ClaseGasto fueron eliminados de
// `gasto.types.ts`. Toda derivación legacy queda obsoleta. Los servicios y
// hooks que dependían de estas funciones fueron migrados en chk5.A12-A14:
//   - Distinción GV/GD ahora vía esGastoDistribucion(g)
//   - Distinción GA/GO ahora vía esGastoAdministrativo(g)
//   - Filtros por bloque vía esGastoDelBloque(g, 'venta'/'periodo'/'producto')
//   - claseGasto no se persiste más (campo eliminado del modelo Gasto)
