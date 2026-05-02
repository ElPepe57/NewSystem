/**
 * Tipos compartidos de los Tools de Productos V2
 * Mockups: #30 ProductosIntel · #31 PuntoEquilibrio · #32 SugerenciasVariantes · #36 SugerenciasDelDia
 */

// ─── #30 Productos Intel ─────────────────────────────────────────────────────
export type LineaIntel = 'skincare' | 'suplemento' | 'wellness' | 'pack' | 'otros';

export type AccionIntel = 'reponer' | 'vigilar' | 'liquidar';

export type ScoreLiquidezCategoria = 'liquido' | 'medio' | 'lento';

export interface ProductoIntelRow {
  id: string;
  sku: string;
  nombre: string;
  marca: string;
  linea: LineaIntel;
  scoreLiquidez: number;          // 0..100
  scoreCategoria: ScoreLiquidezCategoria;
  leadTimeDias: number;
  ocsHistoricas: number;
  velocidadMes: number;
  variacionVsPeriodoAnteriorPct: number;  // -65, +133
  capitalInvertidoPEN: number;
  unidadesStock: number;
  costoUnitarioPEN: number;
  margenPotencialPEN: number;     // puede ser negativo (pérdida si vence)
  margenPotencialPct: number;     // puede ser negativo
  accion: AccionIntel;
  diasParaVencer?: number;        // si aplica
  esPerdidaSiVence?: boolean;
}

// ─── #31 Punto de Equilibrio ─────────────────────────────────────────────────
export interface PuntoEquilibrioInput {
  productoId: string;
  productoSku: string;
  productoNombre: string;
  productoMarca?: string;
  ctruInicial: number;            // S/
  precioVentaInicial: number;     // S/
  costosFijosInicial: number;     // S/
}

// ─── #36 Sugerencias del Día ─────────────────────────────────────────────────
export type CategoriaSugerencia = 'urgente' | 'vigilar' | 'oportunidad';

export type IconoSugerencia =
  | 'zap-off'
  | 'alert-circle'
  | 'alert-triangle'
  | 'trending-down'
  | 'trending-up'
  | 'package-x'
  | 'globe'
  | 'search'
  | 'package-2'
  | 'sparkles'
  | 'link-2';

export interface SugerenciaDelDia {
  id: string;
  categoria: CategoriaSugerencia;
  icono: IconoSugerencia;
  titulo: string;
  descripcion: string;
  metricaLabel?: string;          // "Pérdida potencial:", "Días restantes:"
  metricaValor?: string;          // "−S/ 360", "11d"
  metricaColor?: 'rose' | 'amber' | 'emerald' | 'purple';
  esLinkado?: boolean;            // ej. linkado a banner #32
  borderHighlight?: 'purple';     // accent left border
}

// ─── #32 Sugerencias Variantes ───────────────────────────────────────────────
export type ConfianzaGrupo = 'alta' | 'media' | 'baja';

export interface ProductoSugerido {
  sku: string;
  nombre: string;
  detalle?: string;               // "→ var. 30ml" o "⚠ concentración 1%"
  detalleColor?: 'slate' | 'amber';
  icono?: 'droplets' | 'flower' | 'pill';
  iconoColor?: 'amber' | 'rose' | 'indigo';
}

export interface GrupoSugerido {
  id: string;
  nombreBase: string;
  matchPct: number;               // 96, 78, 62
  confianza: ConfianzaGrupo;
  descripcion: string;            // "3 SKUs sueltos detectados · misma marca..."
  productos: ProductoSugerido[];
}
