/**
 * Paso 2 · Destino detalles (placeholder F1)
 *
 * CONDICIONAL — solo aparece para tipos E (motivo) e I (referencia + relación).
 * Para C y J, el wizard salta automático del Paso 1 al Paso 3.
 *
 * Implementación completa en F3 (S53).
 */
import React from 'react';
import type { UseEnvioWizardStateReturn } from '../useEnvioWizardState';

interface Props {
  wizard: UseEnvioWizardStateReturn;
}

export const Paso2DestinoDetalles: React.FC<Props> = ({ wizard }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">
          Detalles del destino
        </h3>
        <p className="text-sm text-slate-600">
          Este paso es condicional — solo aparece para tipos E (motivo
          obligatorio) e I (referencia + tipo relación).
        </p>
      </div>

      <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl p-6 text-center">
        <div className="text-3xl mb-2">🚧</div>
        <div className="text-sm font-semibold text-amber-900 mb-1">
          Paso 2 se implementa en F3
        </div>
        <p className="text-xs text-amber-700">
          Aquí irán: para tipo E el selector de motivo obligatorio; para tipo I
          los campos de referencia y tipo de relación + banner de bloqueo de
          stock.
        </p>
        <div className="mt-3 text-[11px] text-slate-600">
          Tipo actual: <b>{wizard.tipoInferido || '(ninguno)'}</b>
        </div>
      </div>
    </div>
  );
};
