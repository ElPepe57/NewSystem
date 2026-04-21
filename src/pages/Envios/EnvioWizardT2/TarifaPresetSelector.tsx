/**
 * TarifaPresetSelector — 3 cards seleccionables para elegir el método de tarifa
 * del colaborador en el Paso 4 (Costos landed).
 *
 * Decisión D-18 simplificada: 3 presets (antes 4, se eliminó "Por libra"
 * por redundancia con "Monto total").
 *
 * Presets:
 *  - `monto_total`: das el total directo · sistema prorratea por peso
 *  - `por_unidad`: $X por cada uno · cada unidad paga igual
 *  - `variable`: tabla de tarifas distintas por SKU
 *
 * Uso:
 *  <TarifaPresetSelector
 *    value={state.presetTarifa}
 *    onChange={preset => dispatch({ type: 'SET_PRESET_TARIFA', preset })}
 *  />
 */
import React from 'react';
import { cn } from '../../../design-system';
import type { PresetTarifa } from './envioWizardT2Types';

export interface TarifaPresetSelectorProps {
  /** Preset actualmente seleccionado */
  value: PresetTarifa;
  /** Callback al cambiar el preset */
  onChange: (preset: PresetTarifa) => void;
  /** Clase adicional */
  className?: string;
}

interface PresetConfig {
  id: PresetTarifa;
  emoji: string;
  titulo: string;
  descripcion: string;
}

const PRESETS: PresetConfig[] = [
  {
    id: 'monto_total',
    emoji: '💵',
    titulo: 'Monto total',
    descripcion: 'Das el total · sistema prorratea por peso',
  },
  {
    id: 'por_unidad',
    emoji: '📦',
    titulo: 'Por unidad',
    descripcion: '$X × uds · cada unidad paga igual',
  },
  {
    id: 'variable',
    emoji: '📊',
    titulo: 'Variable',
    descripcion: 'Tabla de tarifas por producto',
  },
];

export const TarifaPresetSelector: React.FC<TarifaPresetSelectorProps> = ({
  value,
  onChange,
  className,
}) => {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-3 gap-3', className)} role="radiogroup">
      {PRESETS.map((preset) => {
        const seleccionado = preset.id === value;
        return (
          <label
            key={preset.id}
            className={cn(
              'relative rounded-xl p-4 cursor-pointer transition-all',
              seleccionado
                ? 'bg-teal-50 border-2 border-teal-500 ring-4 ring-teal-100'
                : 'bg-white border border-slate-200 hover:border-teal-300'
            )}
          >
            <input
              type="radio"
              name="preset-tarifa"
              value={preset.id}
              checked={seleccionado}
              onChange={() => onChange(preset.id)}
              className="sr-only"
            />
            <div className="text-2xl mb-1" aria-hidden>{preset.emoji}</div>
            <div
              className={cn(
                'text-sm font-semibold',
                seleccionado ? 'text-slate-900' : 'text-slate-700'
              )}
            >
              {preset.titulo}
            </div>
            <div
              className={cn(
                'text-xs mt-0.5',
                seleccionado ? 'text-slate-600' : 'text-slate-500'
              )}
            >
              {preset.descripcion}
            </div>
            {seleccionado && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            )}
          </label>
        );
      })}
    </div>
  );
};
