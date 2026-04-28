/**
 * helpers.ts — DatosBancarios · F-DatosBanc
 *
 * Utilidades compartidas: labels, iconos, generación de IDs locales.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Smartphone,
  Mail,
  CreditCard,
  Globe,
} from 'lucide-react';
import type { DatoBancarioPasivo } from '../../../types/tesoreria.types';

export type TipoDatoBancario = DatoBancarioPasivo['tipo'];

export const TIPO_LABEL: Record<TipoDatoBancario, string> = {
  banco: 'Banco',
  yape: 'Yape',
  plin: 'Plin',
  mercadopago: 'Mercado Pago',
  paypal: 'PayPal',
  zelle: 'Zelle',
  wise: 'Wise',
  otro: 'Otro',
};

export const TIPO_ICON: Record<TipoDatoBancario, LucideIcon> = {
  banco: Building2,
  yape: Smartphone,
  plin: Smartphone,
  mercadopago: Smartphone,
  paypal: Mail,
  zelle: Mail,
  wise: Globe,
  otro: CreditCard,
};

export const TIPO_COLOR_CLASSES: Record<
  TipoDatoBancario,
  { bg: string; text: string; border: string }
> = {
  banco: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  yape: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  plin: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
  mercadopago: { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200' },
  paypal: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  zelle: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  wise: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
  otro: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
};

/**
 * Genera un ID local único para un dato bancario.
 * No es Firestore ID — vive embebido en el array.
 */
export function generarDatoBancarioId(): string {
  return `db-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Resumen humano en una línea para mostrar en cards.
 */
export function describirDatoBancario(d: DatoBancarioPasivo): string {
  const partes: string[] = [];
  if (d.tipo === 'banco') {
    if (d.banco) partes.push(d.banco);
    if (d.productoFinanciero === 'cuenta_corriente') partes.push('Cta corriente');
    else if (d.productoFinanciero === 'cuenta_ahorros') partes.push('Cta ahorros');
    if (d.numeroCuenta) partes.push(d.numeroCuenta);
  } else {
    partes.push(TIPO_LABEL[d.tipo]);
    if (d.identificador) partes.push(d.identificador);
  }
  if (d.moneda) partes.push(d.moneda);
  return partes.join(' · ');
}
