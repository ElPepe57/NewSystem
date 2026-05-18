/**
 * origenGasto · utility canon · determina el origen de un gasto
 *
 * chk5.C3 (S3.6 M3 · Gastos Rework) · ayuda a filtrar/badgear gastos según
 * de dónde nacieron · si fueron manuales o auto-generados por otros módulos.
 *
 * Reglas canon (basadas en vinculaciones del modelo Gasto):
 *   - Si tiene `ordenCompraId` → 'oc' (auto-generado por Orden de Compra)
 *   - Si tiene `envioId`        → 'envio' (auto-generado por Envío)
 *   - Si tiene `ventaId`        → 'venta' (auto-generado por Venta)
 *   - Si no tiene ninguno       → 'manual' (registrado a mano en el form)
 *
 * Nota: el modelo actual de Gasto solo expone `ordenCompraId` y `ventaId`
 * en gasto.types.ts. Para `envioId` chequeamos un campo opcional (extender
 * gasto.types.ts en próxima sesión si se persiste explícitamente).
 */

import type { Gasto } from '../../../types/gasto.types';

export type OrigenGasto = 'manual' | 'oc' | 'envio' | 'venta';

/**
 * Determina el origen canónico de un gasto basado en sus vinculaciones.
 */
export function getOrigenGasto(gasto: Gasto): OrigenGasto {
  if (gasto.ordenCompraId) return 'oc';
  // envioId no está en el tipo formal · usamos cast defensivo · futura sesión
  // puede extender Gasto.types con campo `envioId?: string`
  if ((gasto as any).envioId) return 'envio';
  if (gasto.ventaId) return 'venta';
  return 'manual';
}

/** Labels canon para mostrar en UI · usado por chips + cards */
export const ORIGEN_LABELS: Record<OrigenGasto, string> = {
  manual: 'Manual',
  oc: 'Auto · OC',
  envio: 'Auto · Envío',
  venta: 'Auto · Venta',
};

/** Labels cortos para chips de filtros (más compactos) */
export const ORIGEN_LABELS_CHIP: Record<OrigenGasto, string> = {
  manual: 'Manual',
  oc: 'OC',
  envio: 'Envío',
  venta: 'Venta',
};
