/**
 * Paso 3 · Logística (placeholder F1)
 *
 * Implementación completa en F3 (S53).
 * Contendrá: transportador + tracking + 4 modalidades de costo (D-11)
 * + chip TC read-only (D-10) + recordatorio cierre operativo≠financiero.
 */
import React from 'react';
import type { UseEnvioWizardStateReturn } from '../useEnvioWizardState';

interface Props {
  wizard: UseEnvioWizardStateReturn;
}

export const Paso3Logistica: React.FC<Props> = ({ wizard }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">Logística</h3>
        <p className="text-sm text-slate-600">
          Transportador, tracking y costos del envío.
        </p>
      </div>

      <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl p-6 text-center">
        <div className="text-3xl mb-2">🚧</div>
        <div className="text-sm font-semibold text-amber-900 mb-1">
          Paso 3 se implementa en F3
        </div>
        <p className="text-xs text-amber-700">
          Aquí irán: selector de transportador, número de tracking, 4
          modalidades de costo (Flete total / Tarifa por unidad / Por producto /
          Por tramos de peso), chip TC read-only y recordatorio cierre
          operativo ≠ cierre financiero.
        </p>
      </div>

      <div className="text-[11px] text-slate-500">
        Tipo actual: <b>{wizard.tipoInferido || '(ninguno)'}</b> · Total
        unidades: <b>{wizard.totalUnidades}</b>
      </div>
    </div>
  );
};
