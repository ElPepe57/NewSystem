import React from 'react';
import { Package, DollarSign, TrendingUp } from 'lucide-react';
import type { OCWizardState } from './ocWizardTypes';
import { OCRutaVerticalSidebar } from './OCRutaVerticalSidebar';

interface OCWizardPreviewProps {
  state: OCWizardState;
  subtotal: number;
  totalCargos: number;
  totalDescuentos: number;
  totalImpuestos: number;
  grandTotal: number;
  currentStep: number; // S53.4 — para saber qué bloque está "current" en la ruta vertical
}

/**
 * OCWizardPreview — Panel lateral del wizard OC.
 * Muestra resumen en vivo del estado actual mientras se llena el wizard.
 */
export const OCWizardPreview: React.FC<OCWizardPreviewProps> = ({
  state,
  subtotal,
  totalCargos,
  totalDescuentos,
  totalImpuestos,
  grandTotal,
  currentStep,
}) => {
  const productosCount = state.productos.length;
  const unidadesTotal = state.productos.reduce((s, p) => s + (p.cantidad || 0), 0);

  return (
    <div className="space-y-4">
      {/* S53.4 — Ruta vertical persistente (chip tipo + 3 bloques + deudor alt)
           replica el patrón del Wizard de Envíos Unificado v7 · D-R */}
      <OCRutaVerticalSidebar state={state} currentStep={currentStep} />

      {/* ─── Productos ─────────────────────────────────────────────────── */}
      <PreviewSection icon={<Package className="w-4 h-4" />} title="Productos" isEmpty={productosCount === 0}>
        {productosCount > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">SKUs</span>
              <span className="font-medium text-slate-800 tabular-nums">{productosCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Unidades</span>
              <span className="font-medium text-slate-800 tabular-nums">{unidadesTotal}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-200">
              <span className="text-slate-600 font-medium">Subtotal</span>
              <span className="font-semibold text-slate-900 tabular-nums">${subtotal.toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <EmptyHint text="Agrega al menos 1 producto" />
        )}
      </PreviewSection>

      {/* ─── Cargos ────────────────────────────────────────────────────── */}
      {(state.cargosOC.length + state.descuentosOC.length + state.impuestosOC.length > 0) && (
        <PreviewSection icon={<DollarSign className="w-4 h-4" />} title="Cargos comerciales">
          <div className="space-y-1 text-xs">
            {totalCargos > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Cargos</span>
                <span className="text-slate-700 tabular-nums">+${totalCargos.toFixed(2)}</span>
              </div>
            )}
            {totalDescuentos > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Descuentos</span>
                <span className="text-emerald-700 tabular-nums">-${totalDescuentos.toFixed(2)}</span>
              </div>
            )}
            {totalImpuestos > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Impuestos</span>
                <span className="text-slate-700 tabular-nums">+${totalImpuestos.toFixed(2)}</span>
              </div>
            )}
          </div>
        </PreviewSection>
      )}

      {/* ─── Gran total ────────────────────────────────────────────────── */}
      {grandTotal > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                Gran total
              </span>
            </div>
            <span className="text-xl font-bold text-blue-900 tabular-nums">
              ${grandTotal.toFixed(2)}
            </span>
          </div>
          {state.tcCompra > 0 && (
            <div className="text-[10px] text-blue-700 mt-1 text-right">
              ≈ S/ {(grandTotal * state.tcCompra).toFixed(2)} · TC {state.tcCompra}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Internal helpers
// ════════════════════════════════════════════════════════════════════════════

const PreviewSection: React.FC<{
  icon: React.ReactNode;
  title: string;
  isEmpty?: boolean;
  children: React.ReactNode;
}> = ({ icon, title, isEmpty, children }) => (
  <div className={`bg-white rounded-xl border p-3 ${isEmpty ? 'border-dashed border-slate-200' : 'border-slate-200'}`}>
    <div className="flex items-center gap-2 mb-2">
      <div className={`${isEmpty ? 'text-slate-300' : 'text-slate-500'}`}>{icon}</div>
      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{title}</div>
    </div>
    {children}
  </div>
);

const EmptyHint: React.FC<{ text: string }> = ({ text }) => (
  <div className="text-xs text-slate-400 italic">{text}</div>
);

// S53.4 — buildPreviewNodes() y getFlag() ELIMINADOS.
// La ruta visual ahora vive en OCRutaVerticalSidebar con el patrón v7
// del Wizard de Envíos Unificado (3 bloques verticales + chip tipo).
