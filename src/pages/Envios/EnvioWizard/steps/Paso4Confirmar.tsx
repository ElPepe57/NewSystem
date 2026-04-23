/**
 * Paso 4 · Confirmar (placeholder F1)
 *
 * Implementación completa en F4 (S53). Contendrá:
 *   - Header con tipo detectado
 *   - Ruta visual origen → tránsito → destino
 *   - KPIs consolidados
 *   - Bloque "Al confirmar se creará"
 *   - Campo notas
 *   - Gran total
 *   - Botón con label dinámico por tipo (ver config.botonCrearLabel)
 */
import React from 'react';
import type { UseEnvioWizardStateReturn } from '../useEnvioWizardState';

interface Props {
  wizard: UseEnvioWizardStateReturn;
}

export const Paso4Confirmar: React.FC<Props> = ({ wizard }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">
          Revisá antes de crear
        </h3>
        <p className="text-sm text-slate-600">
          Resumen final del envío antes de confirmar.
        </p>
      </div>

      <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl p-6 text-center">
        <div className="text-3xl mb-2">🚧</div>
        <div className="text-sm font-semibold text-amber-900 mb-1">
          Paso 4 se implementa en F4
        </div>
        <p className="text-xs text-amber-700">
          Aquí irá el resumen final + ruta visual + KPIs + bloque de efectos +
          notas + botón "{wizard.tipoConfig?.botonCrearLabel || 'Crear envío'}".
        </p>
      </div>
    </div>
  );
};
