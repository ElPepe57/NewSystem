/**
 * CajaRecaudadoraPaso4CanalesAceptados — chk5.D-S1f · F4
 *
 * Paso 4 del wizard cuando tipo='recaudadora'. Reemplaza al Paso4MetodosCanales
 * (que es para banco/digital/efectivo/credito).
 *
 * Caja Recaudadora soporta multi-canal (D12):
 *   - 5 digitales: yape · plin · sip · agora · bim
 *   - efectivo (sin identificador · manual report)
 *   - 3 POS: niubiz · izipay · visanet (con merchant ID)
 *   - transferencia bancaria (con CCI)
 *
 * Al menos 1 canal activo obligatorio. Cada canal activo requiere identificador
 * (excepto efectivo). Cada tipo único (no duplicados).
 */

import React from 'react';
import { Plus, Trash2, Power, PowerOff, Smartphone, Banknote, CreditCard, Building2 } from 'lucide-react';
import {
  CANAL_RECAUDACION_LABEL,
  CANAL_RECAUDACION_COLOR,
  type TipoCanalRecaudacion,
} from '../../../../../types/productoFinanciero.types';
import type { CuentaWizardState } from './types';

interface Paso4RecaudadoraProps {
  state: CuentaWizardState;
  setState: React.Dispatch<React.SetStateAction<CuentaWizardState>>;
}

// Iconos por canal
const CANAL_ICON: Record<TipoCanalRecaudacion, React.ComponentType<{ className?: string }>> = {
  yape: Smartphone,
  plin: Smartphone,
  sip: Smartphone,
  agora: Smartphone,
  bim: Smartphone,
  efectivo: Banknote,
  pos_niubiz: CreditCard,
  pos_izipay: CreditCard,
  pos_visanet: CreditCard,
  transferencia: Building2,
};

// Placeholder por canal
const CANAL_PLACEHOLDER: Record<TipoCanalRecaudacion, string> = {
  yape: '+51 999-888-777 (celular)',
  plin: '+51 999-888-777 (celular)',
  sip: 'Alias SIP',
  agora: 'Alias Ágora',
  bim: 'Alias BIM',
  efectivo: 'N/A (cash physical · no requiere identificador)',
  pos_niubiz: 'Merchant ID Niubiz',
  pos_izipay: 'Merchant ID Izipay',
  pos_visanet: 'Merchant ID Visanet',
  transferencia: 'CCI 20 dígitos',
};

const COLOR_CLASSES: Record<string, { badge: string; ring: string }> = {
  purple: { badge: 'bg-purple-100 text-purple-700 border-purple-200', ring: 'ring-purple-300' },
  cyan: { badge: 'bg-cyan-100 text-cyan-700 border-cyan-200', ring: 'ring-cyan-300' },
  amber: { badge: 'bg-amber-100 text-amber-700 border-amber-200', ring: 'ring-amber-300' },
  emerald: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', ring: 'ring-emerald-300' },
  sky: { badge: 'bg-sky-100 text-sky-700 border-sky-200', ring: 'ring-sky-300' },
  teal: { badge: 'bg-teal-100 text-teal-700 border-teal-200', ring: 'ring-teal-300' },
};

const TODOS_LOS_CANALES: TipoCanalRecaudacion[] = [
  'yape', 'plin', 'sip', 'agora', 'bim',
  'efectivo',
  'pos_niubiz', 'pos_izipay', 'pos_visanet',
  'transferencia',
];

export const CajaRecaudadoraPaso4CanalesAceptados: React.FC<Paso4RecaudadoraProps> = ({
  state,
  setState,
}) => {
  const canalesActuales = state.canalesAceptados;
  const tiposActuales = new Set(canalesActuales.map((c) => c.tipo));
  const canalesDisponibles = TODOS_LOS_CANALES.filter((t) => !tiposActuales.has(t));

  const agregarCanal = (tipo: TipoCanalRecaudacion) => {
    setState((s) => ({
      ...s,
      canalesAceptados: [
        ...s.canalesAceptados,
        { tipo, identificador: tipo === 'efectivo' ? '' : '', activo: true },
      ],
    }));
  };

  const removerCanal = (tipo: TipoCanalRecaudacion) => {
    setState((s) => ({
      ...s,
      canalesAceptados: s.canalesAceptados.filter((c) => c.tipo !== tipo),
    }));
  };

  const toggleActivo = (tipo: TipoCanalRecaudacion) => {
    setState((s) => ({
      ...s,
      canalesAceptados: s.canalesAceptados.map((c) =>
        c.tipo === tipo ? { ...c, activo: !c.activo } : c,
      ),
    }));
  };

  const actualizarIdentificador = (tipo: TipoCanalRecaudacion, identificador: string) => {
    setState((s) => ({
      ...s,
      canalesAceptados: s.canalesAceptados.map((c) =>
        c.tipo === tipo ? { ...c, identificador } : c,
      ),
    }));
  };

  return (
    <div className="space-y-5">
      {/* Banner D12 */}
      <div className="bg-purple-50 border border-purple-200 rounded-md p-3 text-[11px] text-purple-900">
        <strong>Multi-canal D12:</strong> el recaudador puede aceptar cobros en cualquier
        combinación de canales (Yape · Plin · POS · efectivo · etc.). El balance se
        consolida · liquidación es única · CC con el proveedor es 1 sola. Al menos 1
        canal activo es obligatorio.
      </div>

      {/* Canales configurados */}
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
          Canales aceptados ({canalesActuales.length})
        </label>
        {canalesActuales.length === 0 ? (
          <div className="text-[11px] text-slate-500 italic bg-slate-50 rounded-lg p-3 border border-dashed border-slate-300">
            No hay canales configurados aún · agregá al menos 1 abajo.
          </div>
        ) : (
          <div className="space-y-2">
            {canalesActuales.map((canal) => {
              const colorKey = CANAL_RECAUDACION_COLOR[canal.tipo];
              const colorClasses = COLOR_CLASSES[colorKey] ?? COLOR_CLASSES.teal;
              const Icon = CANAL_ICON[canal.tipo];
              const requiereIdentificador = canal.tipo !== 'efectivo';
              return (
                <div
                  key={canal.tipo}
                  className={`flex items-center gap-2 p-2 border rounded-lg bg-white ring-1 ${
                    canal.activo ? colorClasses.ring : 'ring-slate-200 opacity-60'
                  }`}
                >
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-1 rounded border w-28 text-center flex items-center justify-center gap-1 ${colorClasses.badge}`}
                  >
                    <Icon className="w-3 h-3" />
                    {CANAL_RECAUDACION_LABEL[canal.tipo]}
                  </span>
                  <input
                    type="text"
                    value={canal.identificador ?? ''}
                    onChange={(e) => actualizarIdentificador(canal.tipo, e.target.value)}
                    placeholder={CANAL_PLACEHOLDER[canal.tipo]}
                    disabled={!requiereIdentificador}
                    className={`flex-1 h-8 px-2.5 text-[12px] border border-slate-300 rounded ${
                      requiereIdentificador ? 'bg-white' : 'bg-slate-50 italic text-slate-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => toggleActivo(canal.tipo)}
                    className={`p-1.5 rounded ${
                      canal.activo
                        ? 'text-emerald-700 hover:bg-emerald-50'
                        : 'text-slate-400 hover:bg-slate-100'
                    }`}
                    title={canal.activo ? 'Activo · click para desactivar' : 'Inactivo · click para activar'}
                  >
                    {canal.activo ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => removerCanal(canal.tipo)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Eliminar canal · preserva eventos históricos"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Agregar canal */}
      {canalesDisponibles.length > 0 && (
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
            Agregar canal
          </label>
          <div className="flex flex-wrap gap-1.5">
            {canalesDisponibles.map((tipo) => {
              const colorKey = CANAL_RECAUDACION_COLOR[tipo];
              const colorClasses = COLOR_CLASSES[colorKey] ?? COLOR_CLASSES.teal;
              const Icon = CANAL_ICON[tipo];
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => agregarCanal(tipo)}
                  className={`text-[10px] px-2 py-1 bg-white border border-dashed rounded hover:bg-slate-50 flex items-center gap-1 ${colorClasses.badge.replace('bg-', 'hover:bg-').replace('text-', 'hover:text-')}`}
                >
                  <Plus className="w-3 h-3" />
                  <Icon className="w-3 h-3" />
                  {CANAL_RECAUDACION_LABEL[tipo]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Resumen */}
      {canalesActuales.length > 0 && (
        <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-lg p-2.5 text-[11px] text-emerald-900">
          <strong>Resumen:</strong>{' '}
          <strong>{canalesActuales.filter((c) => c.activo).length}</strong> canal(es) activo(s) ·{' '}
          <strong>{canalesActuales.filter((c) => !c.activo).length}</strong> inactivo(s). Los
          inactivos preservan histórico pero no aceptan nuevos cobros (útil ej. POS en
          reparación).
        </div>
      )}
    </div>
  );
};
