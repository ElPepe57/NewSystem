import React from 'react';
import { WizardStepInteligencia } from './WizardStepInteligencia';
import type { OCWizardState } from './ocWizardTypes';

interface StepInteligenciaProps {
  state: OCWizardState;
  subtotal: number;
  grandTotal: number;
}

/**
 * StepInteligencia — Paso 4 del OCWizardV3.
 *
 * Usa el `WizardStepInteligencia` local de V3 (migrado del V2).
 * El componente interno ya tiene UI rica con ScoreRing SVG + Delta + cards
 * de 6 métricas por producto. Esta envoltura solo agrega el header del paso.
 *
 * Fórmula del score: §12.3 del ESPEC mantuvo sin cambios (40% precio / 30% margen /
 * 20% carga de cargos / 10% puntuación investigación).
 */
export const StepInteligencia: React.FC<StepInteligenciaProps> = ({ state }) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Inteligencia de la compra
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Análisis de viabilidad por producto: precio vs histórico, margen proyectado y carga
          de cargos. Paso <strong>informativo</strong> — puedes continuar aunque el score sea bajo.
        </p>
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
