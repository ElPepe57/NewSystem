/**
 * Design System Tokens — Capa L0 · escala visual canónica del sistema.
 *
 * Canon "DESIGN SYSTEM · KIT UNIVERSAL" sección E · REFINAMIENTOS (2026-05-31).
 *
 * ┌─ QUÉ vive aquí ────────────────────────────────────────────────────────────┐
 * │  Radios · tipografía por rol · sombras (elevación) · spacing · breakpoints  │
 * │  + la paleta SEMÁNTICA fija (success/warning/danger/info/neutral/brand).    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ QUÉ NO vive aquí ─────────────────────────────────────────────────────────┐
 * │  El COLOR DE IDENTIDAD por módulo (teal/violet/blue/orange/indigo/slate).   │
 * │  Eso vive en `grupoColor.ts` (heredado por grupo del sidebar · Modelo A).   │
 * │  Los dos sistemas NO chocan: identidad viste el CHROME · semántico el DATO. │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * REGLAS DE ORO (canon E):
 *   • Radios: un hijo NUNCA más redondo que su padre (control < card < shell).
 *   • Tipografía: pocos tamaños = orden. Cada texto tiene un ROL, no un tamaño suelto.
 *   • Sombras = elevación (no decoración): plano integrado < card en reposo < overlay.
 *   • Mobile-first: la escala nace en móvil y crece con los breakpoints.
 *
 * NOTA sobre el canon M1 (pixel-perfect): las PÁGINAS/MÓDULOS copian las clases
 * literales de su mockup (no importan estos objetos). Estos tokens son la fuente
 * para los COMPONENTES del Design System (capas L1-L5 · Hub Kit) y la referencia
 * documental de la escala. La consistencia vive en el componente, no en la
 * disciplina de quien escribe una página.
 */

// ─── Colors · paleta de MARCA ────────────────────────────────────────────────
// El color de marca (Vita Skin) es teal. El color de IDENTIDAD por módulo NO se
// elige aquí: se hereda del grupo del sidebar vía `grupoColor.ts` (Modelo A).

export const colors = {
  brand: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6', // teal-500 · marca Vita Skin
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
    950: '#042f2e',
  },
} as const;

// Paleta SEMÁNTICA fija (idéntica en todos los módulos · NO la pisa la identidad).
export const semantic = {
  success: 'emerald',
  warning: 'amber',
  danger: 'red',
  info: 'sky',
  neutral: 'slate',
  brand: 'teal',
} as const;

// ─── Surfaces ────────────────────────────────────────────────────────────────

export const surface = {
  page: 'bg-slate-50',
  card: 'bg-white',
  elevated: 'bg-white shadow-sm',
  sunken: 'bg-slate-100',
  overlay: 'bg-black/50',
  hover: 'hover:bg-slate-50',
  active: 'bg-teal-50',
} as const;

// ─── Typography · por ROL (canon TIPOGRAFÍA) ─────────────────────────────────
// FAMILIA: Inter (tailwind.config.fontFamily.sans · cargada en index.html · heredada
//   por TODA la app · alineada a los mockups). Estos roles fijan TAMAÑO + PESO; el
//   COLOR lo pone el CONTEXTO, no el rol:
//     • estructura → slate (900 título · 700 · 600 cuerpo · 500 meta · 400 muted)
//     • dato       → semántico (amber=dinero · rose=urgencia · emerald=positivo …)
//     • chrome     → color del grupo (teal/violet/blue/orange/indigo/slate · grupoColor.ts)
//   Dentro de un dato: jerarquía de tono -700 (label) / -900 (valor) / -400 (decimal atenuado · F7).
// Escala: h1/metric 2xl · título base/lg · subtítulo 13px · cuerpo 12px · meta 11px ·
//   overline 10px-upper · micro 9px. Pocos tamaños = orden · tabular-nums en números.
// Estos roles COINCIDEN con la implementación real del Hub Kit (M1 · referencia viva).

export const text = {
  // Roles canónicos (0 consumidores hoy · REFERENCIA documental del canon TIPOGRAFÍA)
  hero: 'text-2xl font-bold tracking-tight text-slate-900',              // h1 de módulo (HubHeader)
  metricHero: 'text-2xl font-bold tabular-nums',                         // dato héroe KPI (color = tono semántico)
  title: 'text-base sm:text-lg font-semibold text-slate-900',            // título de sección/card
  subtitle: 'text-[13px] text-slate-500 leading-snug',                   // subtítulo bajo el h1 (HubHeader)
  navTab: 'text-[13px]',                                                 // label de tab (peso por estado · HubTabs)
  bodyText: 'text-[12px] text-slate-600',                                // cuerpo (12px · canon)
  meta: 'text-[11px] text-slate-500',                                    // meta · breadcrumb · delta KPI (11px)
  overline: 'text-[10px] font-bold uppercase tracking-wider text-slate-500', // label/etiqueta (KPI override → semántico-700)
  micro: 'text-[9px] font-bold tabular-nums',                            // badge/micro (9px)

  // ── Alias en uso por los componentes DS pre-canon (se mantienen para compat) ──
  display: 'text-xl sm:text-2xl font-bold tracking-tight text-slate-900',
  heading: 'text-base sm:text-lg font-semibold text-slate-900',
  subheading: 'text-sm font-semibold text-slate-700',
  body: 'text-sm text-slate-600',
  bodyStrong: 'text-sm font-medium text-slate-900',
  caption: 'text-xs text-slate-500',
  label: 'text-xs font-medium uppercase tracking-wider text-slate-500',
  metric: 'text-2xl font-bold tabular-nums text-slate-900',
  metricSm: 'text-lg font-bold tabular-nums text-slate-900',
} as const;

// ─── Spacing · base 4px (canon E) ────────────────────────────────────────────
// Tailwind ya opera en base-4 (p-1=4px · p-2=8px · gap-3=12px · gap-4=16px).

export const spacing = {
  pageX: 'px-4 sm:px-6 lg:px-8',
  pageY: 'py-6',
  sectionGap: 'space-y-6',
  cardPadding: 'p-5',
  cardPaddingCompact: 'p-4',
  inlineGap: 'gap-3',
  stackGap: 'gap-4',
} as const;

// ─── Elevation (Shadows) · 3 niveles = elevación (canon E) ────────────────────
// Sombra comunica ALTURA, no decoración:
//   flat    → plano integrado en la superficie (sin sombra)
//   resting → card en reposo sobre el fondo
//   overlay → elemento flotante (modal · dropdown · tooltip)

export const elevation = {
  flat: '',
  resting: 'shadow-sm',
  overlay: 'shadow-lg',

  // ── Alias numéricos en uso por componentes DS pre-canon (compat) ──
  0: '',
  1: 'shadow-sm',
  2: 'shadow-md',
  3: 'shadow-lg',
} as const;

// ─── Radius · por ROL (canon E) ──────────────────────────────────────────────
// Regla de oro: un hijo NUNCA más redondo que su padre.
//   control 8px  → botones · inputs · chips cuadrados · controles
//   card    12px → cards internas
//   shell   16px → shell del módulo · KPI strip · overlays grandes
//   pill         → pills · badges · avatares circulares

export const radius = {
  // Escala canónica por rol (usar en componentes nuevos · Hub Kit)
  control: 'rounded-lg',  // 8px
  card: 'rounded-xl',     // 12px
  shell: 'rounded-2xl',   // 16px
  pill: 'rounded-full',

  // ── Escala legacy (nombres "corridos") en uso por componentes DS pre-canon ──
  // @deprecated · no usar en componentes nuevos · preferir control/card/shell/pill.
  sm: 'rounded-md',   // 6px
  md: 'rounded-lg',   // 8px
  lg: 'rounded-xl',   // 12px
  full: 'rounded-full',
} as const;

// ─── Borders ─────────────────────────────────────────────────────────────────

export const border = {
  default: 'border border-slate-200',
  subtle: 'border border-slate-100',
  strong: 'border border-slate-300',
  focus: 'ring-2 ring-teal-500 ring-offset-2',
  accent: (variant: keyof typeof semantic = 'brand') => `border-l-4 border-l-${semantic[variant]}-500`,
} as const;

// ─── Transitions ─────────────────────────────────────────────────────────────

export const transition = {
  fast: 'transition-all duration-150 ease-in-out',
  normal: 'transition-all duration-200 ease-in-out',
  slow: 'transition-all duration-300 ease-in-out',
} as const;

// ─── Breakpoints · mobile-first (canon E · documental) ────────────────────────
// Coinciden con los defaults de Tailwind. La app NACE en móvil y crece:
//   base <640  → 1 columna · filtros colapsados · KPIs apilados
//   sm   640   → ajustes finos de texto/acciones
//   md   768   → APARECE el sidebar · KPIs en fila (5 cols) · layout A/B con aside
//   lg   1024  → afinamiento de grids/paddings
// Uso: clases responsive de Tailwind (`sm:` `md:` `lg:`). No requiere config.

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

// ─── Status Variant Mapping ──────────────────────────────────────────────────

export type StatusVariant =
  | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'
  // Aliases legacy para compat con consumidores que usan nombres de color directo
  | 'amber' | 'red' | 'blue' | 'green' | 'default';

export const statusColors: Record<StatusVariant, { bg: string; text: string; border: string; dot: string }> = {
  success: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  danger: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  info: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  neutral: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-500' },
  brand: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
  // Aliases legacy — mapean al mismo color
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  blue: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  green: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  default: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-500' },
};
