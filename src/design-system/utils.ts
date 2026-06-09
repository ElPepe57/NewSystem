import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ColorIdentidad } from './grupoColor';

/**
 * Merge Tailwind classes with deduplication.
 * Combines clsx (conditional) + tailwind-merge (dedup conflicting classes).
 *
 * Usage:
 *   cn('px-4 py-2', isActive && 'bg-teal-50', className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Clases de FOCUS (ring + border) por color de identidad de grupo.
 * Para los componentes L2 (TextField/MoneyField/DateField) · default 'teal'
 * (backward-compat: los usos existentes no pasan `tone` y siguen en teal).
 *
 * Canon gobernanza de color: el color del MÓDULO viste el chrome (incluidos los
 * focus rings). Antes los L2 tenían `teal` hardcoded → rompían el chrome de los
 * módulos no-teal (violet/blue/orange/indigo). Esto lo parametriza.
 *
 * ⚠️ Clases LITERALES (el JIT de Tailwind las detecta) · NUNCA interpolar.
 */
const FOCUS_TONE: Record<ColorIdentidad, string> = {
  teal: 'focus:ring-teal-500 focus:border-teal-500',
  violet: 'focus:ring-violet-500 focus:border-violet-500',
  blue: 'focus:ring-blue-500 focus:border-blue-500',
  orange: 'focus:ring-orange-500 focus:border-orange-500',
  indigo: 'focus:ring-indigo-500 focus:border-indigo-500',
  slate: 'focus:ring-slate-500 focus:border-slate-500',
};

export function focusTone(tone: ColorIdentidad = 'teal'): string {
  return FOCUS_TONE[tone];
}
