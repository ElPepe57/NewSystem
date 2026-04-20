import React from 'react';
import { WizardStepInteligencia } from './WizardStepInteligencia';
import type { OCWizardState } from './ocWizardTypes';

interface StepInteligenciaProps {
  state: OCWizardState;
  subtotal: number;
  grandTotal: number;
  /** Callback para avanzar al siguiente paso sin completar la inteligencia (paso opcional). */
  onSaltar?: () => void;
}

/**
 * StepInteligencia — Paso 4 del OCWizardV3.
 *
 * S42ak — Header y UI alineados al mockup maestro S40 (líneas 1162-1252):
 *   - Título "Inteligencia comercial"
 *   - Subtítulo con "Paso opcional" destacado en amber
 *   - Botón "Saltar paso →" a la derecha
 *   - Delega al `WizardStepInteligencia` el render de KPIs + tabla análisis
 *
 * La lógica de cálculo (computeScore 40/30/20/10, CTRU, histórico) se mantiene
 * intacta: solo cambia la presentación visual.
 */
export const StepInteligencia: React.FC<StepInteligenciaProps> = ({ state, onSaltar }) => {
  return (
    <div className="space-y-4">
      {/* Header alineado al mockup S40 L1162-1171 */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-slate-900">
            Inteligencia comercial
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Comparativa con compras anteriores y proyección de margen.{' '}
            <span className="text-amber-700 font-medium">Paso opcional</span>
            {' '}— puedes saltarlo.
          </p>
        </div>
        {onSaltar && (
          <button
            type="button"
            onClick={onSaltar}
            className="text-xs text-slate-600 hover:text-slate-800 border border-slate-300 hover:border-slate-400 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 whitespace-nowrap"
          >
            Saltar paso →
          </button>
        )}
      </div>

      <WizardStepInteligencia
        productos={state.productos}
        tcCompra={state.tcCompra}
        costoShippingUSD={state.configLogistica.costoShippingProveedor || 0}
        cargosOC={state.cargosOC}
        descuentosOC={state.descuentosOC}
      />
    </div>
  );
};
