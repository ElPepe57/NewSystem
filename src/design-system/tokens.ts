/**
 * Design System Tokens — Fuente unica de verdad para todo el sistema visual.
 *
 * REGLA: Ningun componente debe usar clases de color/tipografia/spacing
 * directamente. Siempre importar desde aqui.
 */

// ─── Colors ──────────────────────────────────────────────────────────────────

export const colors = {
  brand: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1', // primary brand
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },
} as const;

// Semantic color mapping (Tailwind class names)
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

// ─── Typography ──────────────────────────────────────────────────────────────

export const text = {
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

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const spacing = {
  pageX: 'px-4 sm:px-6 lg:px-8',
  pageY: 'py-6',
  sectionGap: 'space-y-6',
  cardPadding: 'p-5',
  cardPaddingCompact: 'p-4',
  inlineGap: 'gap-3',
  stackGap: 'gap-4',
} as const;

// ─── Elevation (Shadows) ─────────────────────────────────────────────────────

export const elevation = {
  0: '',
  1: 'shadow-sm',
  2: 'shadow-md',
  3: 'shadow-lg',
} as const;

// ─── Radius ──────────────────────────────────────────────────────────────────

export const radius = {
  sm: 'rounded-md',
  md: 'rounded-lg',
  lg: 'rounded-xl',
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

// ─── Status Variant Mapping ──────────────────────────────────────────────────

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

export const statusColors: Record<StatusVariant, { bg: string; text: string; border: string; dot: string }> = {
  success: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  danger: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  info: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  neutral: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-500' },
  brand: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
};
