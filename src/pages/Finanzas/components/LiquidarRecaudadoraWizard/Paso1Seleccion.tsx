/**
 * Paso 1 · Selección · LiquidarRecaudadoraWizard · chk5.D-S1f · F5
 *
 * Selecciona recaudadora + periodo + cuenta destino + fecha liquidación.
 * Los selectores son inputs simples por ahora · [TODO F6] autocomplete
 * cuando exista UI catálogo de productosFinancieros activos.
 */

import React from 'react';
import { Truck, Calendar, Building2 } from 'lucide-react';
import type { LiquidarRecaudadoraState } from './types';

interface Paso1Props {
  state: LiquidarRecaudadoraState;
  setState: React.Dispatch<React.SetStateAction<LiquidarRecaudadoraState>>;
}

export const Paso1Seleccion: React.FC<Paso1Props> = ({ state, setState }) => {
  return (
    <div className="space-y-5">
      {/* Caja Recaudadora */}
      <div className="bg-purple-50 ring-1 ring-purple-200 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-purple-700" />
          <h3 className="text-[12px] font-bold text-purple-900">Caja Recaudadora a liquidar</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-purple-600 font-semibold mb-1">
              ID recaudadora
            </label>
            <input
              type="text"
              value={state.recaudadoraId}
              onChange={(e) =>
                setState((s) => ({ ...s, recaudadoraId: e.target.value }))
              }
              placeholder="ej: pf_caja_gk_xpress_001"
              className="w-full px-2 py-1.5 text-xs font-mono border border-purple-300 rounded bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-purple-600 font-semibold mb-1">
              Nombre (display)
            </label>
            <input
              type="text"
              value={state.recaudadoraNombre}
              onChange={(e) =>
                setState((s) => ({ ...s, recaudadoraNombre: e.target.value }))
              }
              placeholder="Ej: GK Xpress · multi-canal"
              className="w-full px-2 py-1.5 text-xs border border-purple-300 rounded bg-white"
            />
          </div>
        </div>
        <p className="text-[9px] text-purple-600 italic">
          [TODO F6] · reemplazar por autocomplete productos activos tipoProducto='caja_recaudadora'.
        </p>
      </div>

      {/* Periodo */}
      <div className="bg-amber-50 ring-1 ring-amber-200 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-700" />
          <h3 className="text-[12px] font-bold text-amber-900">Periodo a liquidar</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">
              Fecha inicio
            </label>
            <input
              type="date"
              value={state.fechaInicio}
              onChange={(e) =>
                setState((s) => ({ ...s, fechaInicio: e.target.value }))
              }
              className="w-full px-2 py-1.5 text-sm border border-amber-300 rounded bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">
              Fecha fin
            </label>
            <input
              type="date"
              value={state.fechaFin}
              onChange={(e) =>
                setState((s) => ({ ...s, fechaFin: e.target.value }))
              }
              className="w-full px-2 py-1.5 text-sm border border-amber-300 rounded bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">
              Fecha liquidación
            </label>
            <input
              type="date"
              value={state.fechaLiquidacion}
              onChange={(e) =>
                setState((s) => ({ ...s, fechaLiquidacion: e.target.value }))
              }
              className="w-full px-2 py-1.5 text-sm border border-amber-300 rounded bg-white"
            />
          </div>
        </div>
      </div>

      {/* Cuenta destino */}
      <div className="bg-teal-50 ring-1 ring-teal-200 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-teal-700" />
          <h3 className="text-[12px] font-bold text-teal-900">Cuenta destino de liquidación</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-teal-700 font-semibold mb-1">
              ID cuenta destino
            </label>
            <input
              type="text"
              value={state.cuentaDestinoId}
              onChange={(e) =>
                setState((s) => ({ ...s, cuentaDestinoId: e.target.value }))
              }
              placeholder="ej: pf_bcp_soles_operativa_001"
              className="w-full px-2 py-1.5 text-xs font-mono border border-teal-300 rounded bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-teal-700 font-semibold mb-1">
              Nombre (display)
            </label>
            <input
              type="text"
              value={state.cuentaDestinoNombre}
              onChange={(e) =>
                setState((s) => ({ ...s, cuentaDestinoNombre: e.target.value }))
              }
              placeholder="Ej: BCP Soles Operativa"
              className="w-full px-2 py-1.5 text-xs border border-teal-300 rounded bg-white"
            />
          </div>
        </div>
        <p className="text-[9px] text-teal-600 italic">
          [TODO F6] · autocomplete productos activos en la moneda match con recaudadora.
          La moneda debe coincidir · si no, usar Conversión USD↔PEN antes.
        </p>
      </div>
    </div>
  );
};
