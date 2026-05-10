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

import type { Gasto, CategoriaGasto, ClaseGasto, TipoGasto } from '../types/gasto.types';
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

/**
 * Resuelve el bloque + nombre de la categoría padre de un gasto en un solo
 * paso (chk5.A12 · evita doble loop en consumers como ReportesGastosBI).
 *
 * - Si tiene `categoriaCostoId` y existe en `arbol`: retorna ambos resueltos.
 * - Si solo tiene categoria legacy: retorna bloque derivado + categoriaPadre = null.
 * - Si nada match: retorna { bloque: null, categoriaPadre: null }.
 */
export function resolverGastoCanonico(
  gasto: Pick<Gasto, 'categoria' | 'categoriaCostoId'>,
  arbol?: ArbolCategorias | null
): { bloque: BloqueCosto | null; categoriaPadre: string | null } {
  // Estrategia 1: categoriaCostoId + arbol → resolver ambos en un loop
  if (gasto.categoriaCostoId && arbol) {
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
  }

  // Estrategia 2: fallback legacy (solo bloque, sin nombre de padre)
  return { bloque: getBloqueDelGasto(gasto, arbol), categoriaPadre: null };
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

// ─── DERIVACIÓN LEGACY · canon → CategoriaGasto GV/GD/GA/GO ─────────────────

/**
 * Mapeo · TipoGasto → CategoriaGasto legacy.
 * Útil para servicios antiguos (contabilidad, reporte) que aún filtran por
 * GV/GD/GA/GO · permite preservar lógica interna sin refactor masivo.
 *
 * Lo que el método hace: convierte la semántica del modelo nuevo (bloque +
 * tipo) en la categoría legacy correspondiente. Si el gasto ya tiene
 * categoria explícita, la respeta (idempotente).
 */
const TIPO_A_CATEGORIA_LEGACY: Record<TipoGasto, CategoriaGasto> = {
  // PRODUCTO (ex GA · costos de importación afectan CTRU)
  flete_internacional:  'GA',
  flete_usa_peru:       'GA',
  recojo_local:         'GA',
  almacenaje:           'GA',
  internacion:          'GA',
  // PRODUCTO · pérdidas (legacy las mapeaba dispersas · normalizamos a GV por baja)
  merma_transferencia:  'GV',
  merma_vencimiento:    'GO',
  desmedro:             'GO',
  // VENTA
  comision_ml:          'GV',
  comision_pasarela:    'GV',
  comision_vendedor:    'GV',
  delivery:             'GD',
  empaque:              'GD',
  marketing:            'GV',
  // PERIODO
  nomina:               'GA',
  administrativo:       'GA',
  operativo:            'GO',
  otros:                'GO',
};

/**
 * Resuelve la categoría legacy GV/GD/GA/GO de un gasto.
 * Estrategia:
 *   1. Si tiene `categoria` explícita → la retorna (no toca)
 *   2. Si tiene `tipo` mapeado → deriva categoría legacy
 *   3. Si tiene `categoriaCostoId` con bloque → deriva fallback genérico
 *      ('venta' → 'GV' · 'periodo' → 'GA' · 'producto' → 'GA')
 *   4. null si no se puede determinar
 */
export function getCategoriaLegacyDelGasto(
  gasto: Pick<Gasto, 'categoria' | 'categoriaCostoId' | 'tipo'>,
  arbol?: ArbolCategorias | null
): CategoriaGasto | null {
  // Estrategia 1: categoria explícita
  if (gasto.categoria) return gasto.categoria;

  // Estrategia 2: tipo mapeado
  if (gasto.tipo && TIPO_A_CATEGORIA_LEGACY[gasto.tipo]) {
    return TIPO_A_CATEGORIA_LEGACY[gasto.tipo];
  }

  // Estrategia 3: derivar del bloque
  const bloque = getBloqueDelGasto(gasto, arbol);
  if (bloque === 'venta') return 'GV';
  if (bloque === 'periodo') return 'GA';
  if (bloque === 'producto') return 'GA';

  return null;
}

/**
 * Helper · normaliza un array de gastos legacy.
 * Devuelve un nuevo array donde cada gasto tiene `categoria` poblada
 * (sea la original o derivada del canon).
 *
 * Útil para servicios que filtran masivamente por categoria legacy y
 * no quieren refactorizar su lógica interna · solo normalizar input.
 */
export function normalizarGastosConCategoriaLegacy<T extends Pick<Gasto, 'categoria' | 'categoriaCostoId' | 'tipo'>>(
  gastos: T[],
  arbol?: ArbolCategorias | null
): T[] {
  return gastos.map(g => {
    if (g.categoria) return g;
    const cat = getCategoriaLegacyDelGasto(g, arbol);
    return cat ? { ...g, categoria: cat } : g;
  });
}

// ─── DERIVACIONES LEGACY DESDE BLOQUE (chk5.A13) ────────────────────────────

/**
 * Deriva la `ClaseGasto` legacy ('GVD' | 'GAO') desde el bloque canónico.
 * Reemplaza el patrón `getClaseGasto(g.categoria)` por una derivación que
 * NO depende del campo legacy `categoria`, lo cual destraba la cirugía
 * final (chk5.A15) donde `Gasto.categoria` se elimina del modelo.
 *
 * Mapeo:
 *   bloque 'venta'    → 'GVD' (gastos directos de venta)
 *   bloque 'producto' → 'GAO' (costos de adquisición · afectan CTRU)
 *   bloque 'periodo'  → 'GAO' (gastos fijos del mes)
 *
 * Nota: 'GAO' agrupa producto+periodo en el modelo legacy. Esto se mantiene
 * por retrocompat pero la distinción entre ambos vive en `bloque` directamente.
 */
export function bloqueToClaseGasto(bloque: BloqueCosto): ClaseGasto {
  return bloque === 'venta' ? 'GVD' : 'GAO';
}

/**
 * Resuelve `claseGasto` directamente desde un gasto (canon · sin necesidad
 * de arbol porque el fallback legacy via `categoria` ya está integrado en
 * `getBloqueDelGasto`).
 *
 * Reemplazo canónico de `getClaseGasto(data.categoria)` en gasto.service.ts:
 *   const claseGasto = resolverClaseGasto(data);
 */
export function resolverClaseGasto(
  gasto: Pick<Gasto, 'categoria' | 'categoriaCostoId'>,
  arbol?: ArbolCategorias | null
): ClaseGasto {
  const bloque = getBloqueDelGasto(gasto, arbol) ?? 'periodo';
  return bloqueToClaseGasto(bloque);
}
