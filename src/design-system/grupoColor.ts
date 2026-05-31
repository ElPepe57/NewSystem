/**
 * grupoColor.ts · FUENTE ÚNICA de la gobernanza de color del Design System.
 *
 * Canon "DESIGN SYSTEM · KIT UNIVERSAL + GOBERNANZA DE COLOR" (2026-05-30/31).
 *
 * Hay DOS sistemas de color que NO chocan (aplican a zonas distintas):
 *
 *   1. IDENTIDAD DE MÓDULO (este archivo) — responde "¿en qué módulo estoy?".
 *      1 color por GRUPO del sidebar, HEREDADO (no por módulo, no inventado).
 *      Aplica SOLO al CHROME: chip de rol · icono del header · tab activo ·
 *      primary CTA · focus rings · banners de sección · highlights de módulo.
 *
 *   2. SEMÁNTICO (NO vive aquí) — responde "¿qué significa este dato?".
 *      Paleta FIJA idéntica en todos los módulos (amber=dinero · rose=urgencia ·
 *      emerald=positivo · etc.). Aplica al CONTENIDO (KPIs · estados · donuts ·
 *      badges · color por bloque/origen). El color de módulo NUNCA lo pisa.
 *
 * El color NO se elige ni se inventa: cuando nace un módulo se ubica en un grupo
 * del sidebar (Canon de ubicación de funcionalidad) y HEREDA el color de su grupo.
 * El sistema lee de este registro finito. Escala infinito (color por grupo).
 *
 * Modelo A (elegido): el color del módulo viste TODO el chrome, incluido el
 * primary CTA. Deroga el N10 anterior ("primary siempre teal").
 *
 * ⚠️ Las clases Tailwind están escritas LITERALES (no interpoladas) para que el
 * JIT las detecte. NUNCA construir clases con template strings tipo `bg-${c}-600`.
 */

/** Los 6 grupos del sidebar (Sidebar.tsx). */
export type GrupoSidebar =
  | 'finanzas-contabilidad'
  | 'equipo'
  | 'comercial'
  | 'inventario'
  | 'analisis'
  | 'administracion';

/** Los 6 colores de identidad. Uno por grupo. */
export type ColorIdentidad = 'teal' | 'violet' | 'blue' | 'orange' | 'indigo' | 'slate';

/**
 * Registro grupo → color. ESTA es la decisión de gobernanza.
 * Confirmado por el usuario 2026-05-30 (paleta de gobernanza CERRADA).
 */
export const GRUPO_COLOR: Record<GrupoSidebar, ColorIdentidad> = {
  'finanzas-contabilidad': 'teal', // marca Vita Skin · Finanzas · Gastos · Contabilidad · Inversionistas(*)
  'equipo': 'violet', // Usuarios · Planilla · Inversionistas
  'comercial': 'blue', // Ventas · Compras · Clientes
  'inventario': 'orange', // Stock · Unidades · Productos
  'analisis': 'indigo', // Reportes · BI · Cost Intelligence
  'administracion': 'slate', // Configuración · Auditoría
};

/**
 * Etiqueta legible del grupo (para breadcrumb "Inicio › {grupo} › {módulo}").
 */
export const GRUPO_LABEL: Record<GrupoSidebar, string> = {
  'finanzas-contabilidad': 'Finanzas y Contabilidad',
  'equipo': 'Equipo',
  'comercial': 'Comercial',
  'inventario': 'Inventario',
  'analisis': 'Análisis',
  'administracion': 'Administración',
};

/**
 * Clases de chrome por color de identidad. Cada slot es un rol del chrome.
 * Un módulo consume: const C = COLOR_CLASSES[GRUPO_COLOR['<su-grupo>']].
 */
export interface ColorIdentidadClasses {
  /** Tab activo de HubTabs (border-b-2 + texto). */
  tabActive: string;
  /** Primary CTA (Modelo A · color del módulo). */
  primaryBtn: string;
  /** Icono del header banking-grade (cuadro con gradient). */
  headerIcon: string;
  /** Fondo tonal suave del icono (empty state / chip cuadrado). */
  iconTonalBg: string;
  /** Texto/icono sobre el fondo tonal. */
  iconTonalText: string;
  /** Chip de rol (bg + text). Se combina con px/py/rounded del consumidor. */
  chip: string;
  /** Focus ring de inputs. */
  focusInput: string;
  /** Spinner / loader del módulo. */
  spinnerText: string;
  /** Texto de acento (links, énfasis · -700). */
  accentText: string;
  /** Texto de acento fuerte (-900). */
  accentTextStrong: string;
  /** Fondo suave plano (-50 · loading bg). */
  softBg: string;
  /** Banner de sección con color de módulo (gradient + ring). */
  banner: string;
  /** Toggle / segment activo. */
  toggleActive: string;
  /** Borde fuerte (-500 · border-l-4, rings de énfasis). */
  borderStrong: string;
  /** Highlight de fila/celda actual (bg suave translúcido). */
  rowHighlight: string;
}

export const COLOR_CLASSES: Record<ColorIdentidad, ColorIdentidadClasses> = {
  teal: {
    tabActive: 'border-teal-600 text-teal-700',
    primaryBtn: 'bg-teal-600 hover:bg-teal-700 text-white',
    headerIcon: 'bg-gradient-to-br from-teal-500 to-teal-700',
    iconTonalBg: 'bg-teal-100',
    iconTonalText: 'text-teal-700',
    chip: 'bg-teal-50 text-teal-700',
    focusInput: 'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
    spinnerText: 'text-teal-600',
    accentText: 'text-teal-700',
    accentTextStrong: 'text-teal-900',
    softBg: 'bg-teal-50',
    banner: 'bg-gradient-to-r from-teal-50 to-teal-100/30 ring-1 ring-teal-200/50',
    toggleActive: 'bg-teal-600 text-white',
    borderStrong: 'border-teal-500',
    rowHighlight: 'bg-teal-50/40',
  },
  violet: {
    tabActive: 'border-violet-600 text-violet-700',
    primaryBtn: 'bg-violet-600 hover:bg-violet-700 text-white',
    headerIcon: 'bg-gradient-to-br from-violet-500 to-violet-700',
    iconTonalBg: 'bg-violet-100',
    iconTonalText: 'text-violet-700',
    chip: 'bg-violet-50 text-violet-700',
    focusInput: 'focus:border-violet-500 focus:ring-1 focus:ring-violet-500',
    spinnerText: 'text-violet-600',
    accentText: 'text-violet-700',
    accentTextStrong: 'text-violet-900',
    softBg: 'bg-violet-50',
    banner: 'bg-gradient-to-r from-violet-50 to-violet-100/30 ring-1 ring-violet-200/50',
    toggleActive: 'bg-violet-600 text-white',
    borderStrong: 'border-violet-500',
    rowHighlight: 'bg-violet-50/40',
  },
  blue: {
    tabActive: 'border-blue-600 text-blue-700',
    primaryBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
    headerIcon: 'bg-gradient-to-br from-blue-500 to-blue-700',
    iconTonalBg: 'bg-blue-100',
    iconTonalText: 'text-blue-700',
    chip: 'bg-blue-50 text-blue-700',
    focusInput: 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
    spinnerText: 'text-blue-600',
    accentText: 'text-blue-700',
    accentTextStrong: 'text-blue-900',
    softBg: 'bg-blue-50',
    banner: 'bg-gradient-to-r from-blue-50 to-blue-100/30 ring-1 ring-blue-200/50',
    toggleActive: 'bg-blue-600 text-white',
    borderStrong: 'border-blue-500',
    rowHighlight: 'bg-blue-50/40',
  },
  orange: {
    tabActive: 'border-orange-600 text-orange-700',
    primaryBtn: 'bg-orange-600 hover:bg-orange-700 text-white',
    headerIcon: 'bg-gradient-to-br from-orange-500 to-orange-700',
    iconTonalBg: 'bg-orange-100',
    iconTonalText: 'text-orange-700',
    chip: 'bg-orange-50 text-orange-700',
    focusInput: 'focus:border-orange-500 focus:ring-1 focus:ring-orange-500',
    spinnerText: 'text-orange-600',
    accentText: 'text-orange-700',
    accentTextStrong: 'text-orange-900',
    softBg: 'bg-orange-50',
    banner: 'bg-gradient-to-r from-orange-50 to-orange-100/30 ring-1 ring-orange-200/50',
    toggleActive: 'bg-orange-600 text-white',
    borderStrong: 'border-orange-500',
    rowHighlight: 'bg-orange-50/40',
  },
  indigo: {
    tabActive: 'border-indigo-600 text-indigo-700',
    primaryBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    headerIcon: 'bg-gradient-to-br from-indigo-500 to-indigo-700',
    iconTonalBg: 'bg-indigo-100',
    iconTonalText: 'text-indigo-700',
    chip: 'bg-indigo-50 text-indigo-700',
    focusInput: 'focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500',
    spinnerText: 'text-indigo-600',
    accentText: 'text-indigo-700',
    accentTextStrong: 'text-indigo-900',
    softBg: 'bg-indigo-50',
    banner: 'bg-gradient-to-r from-indigo-50 to-indigo-100/30 ring-1 ring-indigo-200/50',
    toggleActive: 'bg-indigo-600 text-white',
    borderStrong: 'border-indigo-500',
    rowHighlight: 'bg-indigo-50/40',
  },
  slate: {
    tabActive: 'border-slate-600 text-slate-700',
    primaryBtn: 'bg-slate-700 hover:bg-slate-800 text-white',
    headerIcon: 'bg-gradient-to-br from-slate-500 to-slate-700',
    iconTonalBg: 'bg-slate-100',
    iconTonalText: 'text-slate-700',
    chip: 'bg-slate-100 text-slate-700',
    focusInput: 'focus:border-slate-500 focus:ring-1 focus:ring-slate-500',
    spinnerText: 'text-slate-600',
    accentText: 'text-slate-700',
    accentTextStrong: 'text-slate-900',
    softBg: 'bg-slate-50',
    banner: 'bg-gradient-to-r from-slate-50 to-slate-100/30 ring-1 ring-slate-200/50',
    toggleActive: 'bg-slate-700 text-white',
    borderStrong: 'border-slate-500',
    rowHighlight: 'bg-slate-50/40',
  },
};

/**
 * Helper de conveniencia: dado un grupo, devuelve directamente sus clases de chrome.
 *   const C = chromeDe('finanzas-contabilidad'); // = COLOR_CLASSES.teal
 */
export function chromeDe(grupo: GrupoSidebar): ColorIdentidadClasses {
  return COLOR_CLASSES[GRUPO_COLOR[grupo]];
}
