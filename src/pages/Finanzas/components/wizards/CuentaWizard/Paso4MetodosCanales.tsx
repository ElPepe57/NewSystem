/**
 * Paso 4 — Métodos disponibles + canales digitales · S58c v2
 *
 * Métodos: lista de chips clickables (transferencia, yape, plin, etc.)
 * Canales digitales: solo si tipo='banco'. Yape/Plin/SIP/Ágora/BIM
 * con su identificador (teléfono o alias).
 */

import React from 'react';
import { Plus, Trash2, Star } from 'lucide-react';
import { TextField } from '../../../../../design-system/components/forms/TextField';
import { cn } from '../../../../../design-system/utils';
import type { MetodoTesoreria } from '../../../../../types/tesoreria.types';
import {
  CANAL_LABEL,
  CANAL_COLOR,
  type CuentaWizardState,
  type TipoCanalDigital,
} from './types';

interface Paso4Props {
  state: CuentaWizardState;
  setState: React.Dispatch<React.SetStateAction<CuentaWizardState>>;
}

const METODO_OPTIONS: Array<{
  value: MetodoTesoreria;
  label: string;
  hint?: string;
}> = [
  { value: 'transferencia_bancaria', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'tarjeta', label: 'Tarjeta débito' },
  { value: 'tarjeta_credito', label: 'Tarjeta crédito' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'otro', label: 'Otro' },
];

const CANAL_BADGE_CLASSES: Record<string, string> = {
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
  cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  sky: 'bg-sky-100 text-sky-700 border-sky-200',
};

export const Paso4MetodosCanales: React.FC<Paso4Props> = ({
  state,
  setState,
}) => {
  const toggleMetodo = (metodo: MetodoTesoreria) => {
    setState((s) => {
      const has = s.metodosDisponibles.includes(metodo);
      return {
        ...s,
        metodosDisponibles: has
          ? s.metodosDisponibles.filter((m) => m !== metodo)
          : [...s.metodosDisponibles, metodo],
      };
    });
  };

  const agregarCanal = (tipo: TipoCanalDigital) => {
    if (state.canalesDigitales.some((c) => c.tipo === tipo)) return;
    setState((s) => ({
      ...s,
      canalesDigitales: [...s.canalesDigitales, { tipo, identificador: '' }],
    }));
  };

  const removerCanal = (tipo: TipoCanalDigital) => {
    setState((s) => ({
      ...s,
      canalesDigitales: s.canalesDigitales.filter((c) => c.tipo !== tipo),
    }));
  };

  const actualizarIdentificador = (
    tipo: TipoCanalDigital,
    identificador: string,
  ) => {
    setState((s) => ({
      ...s,
      canalesDigitales: s.canalesDigitales.map((c) =>
        c.tipo === tipo ? { ...c, identificador } : c,
      ),
    }));
  };

  // Canales aún no agregados
  const canalesDisponibles: TipoCanalDigital[] = (
    ['yape', 'plin', 'sip', 'agora', 'bim'] as TipoCanalDigital[]
  ).filter((t) => !state.canalesDigitales.some((c) => c.tipo === t));

  return (
    <div className="space-y-5">
      {/* Métodos disponibles */}
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
          Métodos de pago disponibles
        </label>
        <div className="flex flex-wrap gap-1.5">
          {METODO_OPTIONS.map((m) => {
            const active = state.metodosDisponibles.includes(m.value);
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => toggleMetodo(m.value)}
                className={cn(
                  'text-[11px] px-2.5 py-1 rounded border transition-colors',
                  active
                    ? 'bg-teal-50 text-teal-700 border-teal-200 font-semibold'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50',
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5">
          Métodos que puede usar esta cuenta (en cobros, pagos, transferencias).
        </p>
      </div>

      {/* Canales digitales (solo banco) */}
      {state.tipo === 'banco' && (
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
            Canales digitales asociados
          </label>
          <div className="space-y-2">
            {state.canalesDigitales.map((canal) => {
              const colorKey = CANAL_COLOR[canal.tipo];
              return (
                <div
                  key={canal.tipo}
                  className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg bg-slate-50/50"
                >
                  <span
                    className={cn(
                      'text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded border w-16 text-center flex-shrink-0',
                      CANAL_BADGE_CLASSES[colorKey],
                    )}
                  >
                    {CANAL_LABEL[canal.tipo]}
                  </span>
                  <input
                    type="text"
                    value={canal.identificador}
                    onChange={(e) =>
                      actualizarIdentificador(canal.tipo, e.target.value)
                    }
                    placeholder={
                      canal.tipo === 'yape' || canal.tipo === 'plin'
                        ? '987 654 321'
                        : 'Alias o ID'
                    }
                    className="flex-1 h-8 px-2.5 text-[12px] border border-slate-300 rounded bg-white outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => removerCanal(canal.tipo)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    aria-label={`Quitar ${CANAL_LABEL[canal.tipo]}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            {canalesDisponibles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {canalesDisponibles.map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => agregarCanal(tipo)}
                    className="text-[10px] px-2 py-1 bg-white border border-dashed border-slate-300 text-slate-600 rounded hover:bg-slate-50 hover:border-teal-300 hover:text-teal-700 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    {CANAL_LABEL[tipo]}
                  </button>
                ))}
              </div>
            )}

            {state.canalesDigitales.length === 0 && (
              <p className="text-[11px] text-slate-500">
                Yape / Plin / SIP / Ágora / BIM. El dinero entra/sale de esta
                cuenta bancaria — no son cuentas separadas.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Cuenta por defecto */}
      <div className="border-t border-slate-200 pt-4">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={state.esCuentaPorDefecto}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                esCuentaPorDefecto: e.target.checked,
              }))
            }
            className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
          />
          <div>
            <div className="text-[12px] font-medium text-slate-900 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-500" />
              Marcar como cuenta por defecto
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Se sugerirá automáticamente al registrar movimientos en{' '}
              {state.moneda}.
            </div>
          </div>
        </label>
      </div>
    </div>
  );
};
