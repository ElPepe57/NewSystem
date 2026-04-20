import React, { useMemo } from 'react';
import { Info } from 'lucide-react';
import { DynamicChargesSection } from '../../../../design-system';
import type { DynamicChargeItem } from '../../../../design-system';
import type { OCWizardState } from './ocWizardTypes';
import type { OCWizardAction } from './ocWizardReducer';
import type {
  CargoOC,
  DescuentoOC,
  ImpuestoOC,
} from '../../../../types/ordenCompra.types';

interface StepCargosProps {
  state: OCWizardState;
  dispatch: React.Dispatch<OCWizardAction>;
  subtotalProductos: number;
}

// ════════════════════════════════════════════════════════════════════════════
// Conceptos sugeridos (autocomplete)
// ════════════════════════════════════════════════════════════════════════════

const CONCEPTOS_CARGO = [
  'Shipping internacional',
  'Shipping local',
  'Handling fee',
  'Insurance',
  'Service fee',
  'Import duty',
  'Customs processing',
];

const CONCEPTOS_DESCUENTO = [
  'Subscribe & Save',
  'Cupón promocional',
  'Bulk discount',
  'Rebate',
  'Early payment discount',
  'Clearance',
];

const CONCEPTOS_IMPUESTO = [
  'Sales Tax CA',
  'Sales Tax NY',
  'VAT',
  'IGV',
  'State tax',
  'Federal tax',
];

// ════════════════════════════════════════════════════════════════════════════
// Adaptadores entre tipos del sistema y tipo DynamicChargeItem del DS
// ════════════════════════════════════════════════════════════════════════════

const cargoToItem = (c: CargoOC): DynamicChargeItem => ({
  id: c.id,
  concepto: c.concepto,
  montoUSD: c.montoUSD,
  metodoProrrateo: c.metodoProrrateo,
});

const itemToCargo = (item: DynamicChargeItem): CargoOC => ({
  id: item.id,
  concepto: item.concepto,
  montoUSD: item.montoUSD,
  metodoProrrateo:
    (item.metodoProrrateo as 'por_valor' | 'por_cantidad' | 'por_peso') || 'por_valor',
});

const descuentoToItem = (d: DescuentoOC): DynamicChargeItem => ({
  id: d.id,
  concepto: d.concepto,
  montoUSD: d.montoUSD,
  metodoProrrateo: d.metodoProrrateo,
});

const itemToDescuento = (item: DynamicChargeItem): DescuentoOC => ({
  id: item.id,
  concepto: item.concepto,
  montoUSD: item.montoUSD,
  metodoProrrateo:
    (item.metodoProrrateo as 'por_valor' | 'por_cantidad' | 'proporcional') || 'por_valor',
});

const impuestoToItem = (i: ImpuestoOC): DynamicChargeItem => ({
  id: i.id,
  concepto: i.concepto,
  montoUSD: i.montoUSD,
  modo: i.modo,
  porcentaje: i.porcentaje,
});

const itemToImpuesto = (item: DynamicChargeItem): ImpuestoOC => ({
  id: item.id,
  concepto: item.concepto,
  montoUSD: item.montoUSD,
  modo: item.modo || 'fijo',
  porcentaje: item.porcentaje,
});

// ════════════════════════════════════════════════════════════════════════════
// StepCargos
// ════════════════════════════════════════════════════════════════════════════

/**
 * StepCargos — Paso 3 del OCWizardV3.
 *
 * Captura 3 tipos de ajustes comerciales al total de productos:
 * - Cargos (shipping, handling, etc.) — se SUMAN
 * - Descuentos (Subscribe & Save, cupones) — se RESTAN
 * - Impuestos (sales tax, VAT) — se SUMAN (pueden ser % o fijo)
 *
 * Los shipping que se capturaron en el paso Ruta aparecen aquí pre-cargados
 * (sync bidireccional, gestionado en OCWizardV3.tsx).
 */
export const StepCargos: React.FC<StepCargosProps> = ({
  state,
  dispatch,
  subtotalProductos,
}) => {
  // ─── Handlers: cargos ────────────────────────────────────────────────────
  const cargosItems = useMemo(() => state.cargosOC.map(cargoToItem), [state.cargosOC]);

  const handleCargosChange = (items: DynamicChargeItem[]) => {
    // Detectar adds / updates / removes comparando con state actual
    const oldIds = new Set(state.cargosOC.map((c) => c.id));
    const newIds = new Set(items.map((i) => i.id));

    // Removes
    state.cargosOC.forEach((c) => {
      if (!newIds.has(c.id)) {
        dispatch({ type: 'REMOVE_CARGO', id: c.id } as OCWizardAction);
      }
    });

    // Adds + Updates
    items.forEach((item) => {
      const cargo = itemToCargo(item);
      if (!oldIds.has(item.id)) {
        dispatch({ type: 'ADD_CARGO', cargo } as OCWizardAction);
      } else {
        const existing = state.cargosOC.find((c) => c.id === item.id);
        if (
          existing &&
          (existing.concepto !== cargo.concepto || existing.montoUSD !== cargo.montoUSD)
        ) {
          dispatch({ type: 'UPDATE_CARGO', cargo } as OCWizardAction);
        }
      }
    });
  };

  // ─── Handlers: descuentos ────────────────────────────────────────────────
  const descuentosItems = useMemo(
    () => state.descuentosOC.map(descuentoToItem),
    [state.descuentosOC]
  );

  const handleDescuentosChange = (items: DynamicChargeItem[]) => {
    const oldIds = new Set(state.descuentosOC.map((d) => d.id));
    const newIds = new Set(items.map((i) => i.id));

    state.descuentosOC.forEach((d) => {
      if (!newIds.has(d.id)) {
        dispatch({ type: 'REMOVE_DESCUENTO', id: d.id } as OCWizardAction);
      }
    });

    items.forEach((item) => {
      const descuento = itemToDescuento(item);
      if (!oldIds.has(item.id)) {
        dispatch({ type: 'ADD_DESCUENTO', descuento } as OCWizardAction);
      } else {
        const existing = state.descuentosOC.find((d) => d.id === item.id);
        if (
          existing &&
          (existing.concepto !== descuento.concepto || existing.montoUSD !== descuento.montoUSD)
        ) {
          dispatch({ type: 'UPDATE_DESCUENTO', descuento } as OCWizardAction);
        }
      }
    });
  };

  // ─── Handlers: impuestos ─────────────────────────────────────────────────
  const impuestosItems = useMemo(
    () => state.impuestosOC.map(impuestoToItem),
    [state.impuestosOC]
  );

  const handleImpuestosChange = (items: DynamicChargeItem[]) => {
    const oldIds = new Set(state.impuestosOC.map((i) => i.id));
    const newIds = new Set(items.map((i) => i.id));

    state.impuestosOC.forEach((i) => {
      if (!newIds.has(i.id)) {
        dispatch({ type: 'REMOVE_IMPUESTO', id: i.id } as OCWizardAction);
      }
    });

    items.forEach((item) => {
      const impuesto = itemToImpuesto(item);
      if (!oldIds.has(item.id)) {
        dispatch({ type: 'ADD_IMPUESTO', impuesto } as OCWizardAction);
      } else {
        const existing = state.impuestosOC.find((i) => i.id === item.id);
        if (
          existing &&
          (existing.concepto !== impuesto.concepto ||
            existing.montoUSD !== impuesto.montoUSD ||
            existing.modo !== impuesto.modo ||
            existing.porcentaje !== impuesto.porcentaje)
        ) {
          dispatch({ type: 'UPDATE_IMPUESTO', impuesto } as OCWizardAction);
        }
      }
    });
  };

  const totalCargos = state.cargosOC.reduce((s, c) => s + (c.montoUSD || 0), 0);
  const totalDescuentos = state.descuentosOC.reduce((s, d) => s + (d.montoUSD || 0), 0);
  const totalImpuestos = state.impuestosOC.reduce((s, i) => s + (i.montoUSD || 0), 0);
  const totalOC = subtotalProductos + totalCargos - totalDescuentos + totalImpuestos;

  // S42ag fix — base del cálculo de impuestos = subtotal NETO (con descuentos aplicados)
  // Antes: impuesto % se aplicaba sobre subtotalProductos bruto → incorrecto contablemente.
  // Ahora: se aplica sobre la base gravable real (subtotal - descuentos).
  const baseGravableImpuestos = Math.max(0, subtotalProductos + totalCargos - totalDescuentos);

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-slate-900">Cargos comerciales</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Ajustes al total que el <strong>proveedor te factura</strong>: shipping, descuentos,
          impuestos. No incluye costos logísticos del envío (flete internacional, aduana) — esos van
          en el Envío.
        </p>
      </div>

      {/* Cargos */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <DynamicChargesSection
          kind="cargo"
          items={cargosItems}
          onChange={handleCargosChange}
          conceptosSugeridos={CONCEPTOS_CARGO}
        />
      </div>

      {/* Descuentos */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <DynamicChargesSection
          kind="descuento"
          items={descuentosItems}
          onChange={handleDescuentosChange}
          conceptosSugeridos={CONCEPTOS_DESCUENTO}
        />
      </div>

      {/* Impuestos */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <DynamicChargesSection
          kind="impuesto"
          items={impuestosItems}
          onChange={handleImpuestosChange}
          conceptosSugeridos={CONCEPTOS_IMPUESTO}
          baseCalculoPorcentaje={baseGravableImpuestos}
        />
      </div>

      {/* Totales consolidados */}
      <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-4">
        <div className="text-xs font-semibold text-teal-900 uppercase tracking-wide mb-3">
          Cálculo del total OC
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Subtotal productos</span>
            <span className="font-medium tabular-nums">${subtotalProductos.toFixed(2)}</span>
          </div>
          {totalCargos > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-600">+ Cargos</span>
              <span className="font-medium tabular-nums">+${totalCargos.toFixed(2)}</span>
            </div>
          )}
          {totalDescuentos > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-600">− Descuentos</span>
              <span className="font-medium text-emerald-700 tabular-nums">
                -${totalDescuentos.toFixed(2)}
              </span>
            </div>
          )}
          {totalImpuestos > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-600">+ Impuestos</span>
              <span className="font-medium tabular-nums">+${totalImpuestos.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t-2 border-teal-300 mt-2">
            <span className="text-base font-bold text-teal-900">Total OC</span>
            <span className="text-lg font-bold text-teal-900 tabular-nums">
              ${totalOC.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Nota informativa */}
      <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-200">
        <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
        <div>
          Los cargos logísticos del envío (flete viajero, aduana, recojo local en Perú) se capturan
          en el módulo de <strong>Envíos</strong>, no aquí. Esto mantiene separado el plano
          comercial del plano logístico en el CTRU.
        </div>
      </div>
    </div>
  );
};
