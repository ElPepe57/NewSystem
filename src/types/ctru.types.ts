import { Timestamp } from 'firebase/firestore';

/**
 * CONTRATO DE COSTO ADAPTATIVO DE LA UNIDAD (fundación 2026-06-16)
 * ----------------------------------------------------------------
 * El CTRU (Costo Total Real por Unidad) deja de ser un escalar opaco y pasa a
 * ser la SUMA de componentes atómicos y congelados:
 *
 *     getCTRU(unidad) = Σ unidad.componentesCosto[].montoPEN   (cuando existen)
 *
 * Cada componente se congela (frozen-at-tx) al momento de la transacción que lo
 * origina (recepción de envío, recojo en origen, etc.) y es INMUTABLE: una vez
 * escrito en la unidad, no se re-deriva de la OC ni de tarifas vivas.
 *
 * Modelo canónico = 3 cajas (producto / venta / periodo). Solo los costos de la
 * caja PRODUCTO viven aquí. Los gastos de venta y de periodo (GA/GO, delivery,
 * comisiones) NO son componentes de la unidad — viven en el P&L (Acuerdo 3).
 */

/** Naturaleza del componente de costo (para desglose "¿dónde se va la plata?"). */
export type CategoriaComponenteCosto =
  | 'producto'   // Precio de compra del proveedor (capa base)
  | 'flete'      // Flete internacional / del viajero (USA→Perú)
  | 'landed'     // Cargos comerciales de la OC trasvasados al envío
  | 'recojo'     // Costo de recojo / pickup (Lima u origen)
  | 'impuesto'   // Impuestos / aduana
  | 'descuento'  // Descuento del proveedor (montoPEN NEGATIVO)
  | 'otro';      // Cualquier otro cargo adaptativo

/**
 * Ámbito de prorrateo · "¿a qué unidades pertenece este costo?"
 * Decisión "por ámbito" (user 2026-06-16):
 * - 'envio': costo de toda la remesa → se reparte entre TODAS las unidades del
 *   envío con denominador ESTABLE (total esperado), congelado por unidad al recibir.
 * - 'etapa': costo específico de una recepción/tanda → se reparte SOLO entre las
 *   unidades de esa etapa (respeta la inmutabilidad de las etapas ya recibidas).
 */
export type AmbitoComponenteCosto = 'envio' | 'etapa';

/** De qué write-path salió el componente (trazabilidad). */
export type FuenteComponenteCosto = 'oc' | 'envio' | 'recepcion';

/**
 * Componente atómico y congelado del costo de una unidad física.
 * La suma de los componentes de una unidad ES su CTRU.
 */
export interface ComponenteCostoUnidad {
  /** Naturaleza del costo (para el desglose por categoría). */
  categoria: CategoriaComponenteCosto;
  /** Etiqueta legible (ej. "Flete viajero Juan", "Recojo Lima · recepción 2"). */
  concepto: string;
  /** Monto congelado en soles. NEGATIVO si es un descuento. */
  montoPEN: number;

  /** Monto original en USD, si el componente nació en USD (trazabilidad FX). */
  montoOrigenUSD?: number;
  /** TC usado para congelar a PEN (tcPago||tcCompra de la unidad al momento). */
  tc?: number;

  /** Write-path que congeló este componente. */
  fuente: FuenteComponenteCosto;

  /** Ámbito de prorrateo (envío completo vs etapa específica). */
  ambito: AmbitoComponenteCosto;
  /** Si ambito='etapa': id de la RecepcionEnvio que generó el costo. */
  recepcionId?: string;
  /** Si ambito='etapa' y vino de una tanda: id del SubEnvioT1. */
  tandaId?: string;

  /** Vínculo opcional al árbol de categorías de costo (CategoriaCosto). */
  categoriaCostoId?: string;
  /** Timestamp de la transacción que congeló el componente. */
  congeladoEn?: Timestamp;
}
