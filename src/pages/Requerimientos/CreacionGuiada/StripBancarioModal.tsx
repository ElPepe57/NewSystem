/**
 * StripBancarioModal · F4+ · Creación guiada.
 *
 * El strip banking-grade del header del modal (mockup acto 2 · líneas ~178-201):
 * 3 KPIs de DECISIÓN que se actualizan según lo que se va armando en el modo activo —
 *   · Valor (costo de PRODUCTO · no landed · amber)
 *   · Margen proyectado (% · si hay precio de venta · emerald)
 *   · Impacto en caja (% del costo vs caja disponible · sky · entra/no entra)
 * + selector de PRIORIDAD (Baja/Media/Alta).
 *
 * El color de los KPIs es SEMÁNTICO (amber=dinero · emerald=positivo · sky=parcial),
 * idéntico al strip del PanelDecisionRequerimiento. No usa el color del módulo.
 */
import React from 'react';
import { DollarSign, TrendingUp, Wallet, Check, Microscope } from 'lucide-react';
import type { StripBancario } from './creacionGuiada.helper';
import type { PrioridadRequerimiento } from '../../../types/requerimiento.types';

interface Props {
  strip: StripBancario;
  prioridad: PrioridadRequerimiento;
  onPrioridadChange: (p: PrioridadRequerimiento) => void;
  /** Sub-texto del valor (ej. "no landed" · "desde investigación"). */
  valorHint?: 'no_landed' | 'investigacion';
}

export const StripBancarioModal: React.FC<Props> = ({ strip, prioridad, onPrioridadChange, valorHint = 'no_landed' }) => {
  return (
    <div className="border-b border-slate-200 px-1 pt-1 pb-3">
      {/* strip banking-grade: Valor (costo producto) · Margen proyectado · Impacto en caja */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Valor · costo de producto */}
        <div className="bg-amber-50 ring-1 ring-amber-200 rounded-xl px-3 py-2">
          <div className="text-[9px] uppercase tracking-wider text-amber-700 font-bold flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Valor · costo de producto
          </div>
          <div className="text-[16px] font-bold text-amber-900 tabular-nums leading-tight">
            $ {strip.valorUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-amber-600 inline-flex items-center gap-0.5">
            {valorHint === 'investigacion' && <Microscope className="w-2.5 h-2.5" />}
            S/ {strip.valorPEN.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            {valorHint === 'no_landed' ? <> · <b>no landed</b></> : ' · desde investigación'}
          </div>
        </div>

        {/* Margen proyectado */}
        <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-xl px-3 py-2">
          <div className="text-[9px] uppercase tracking-wider text-emerald-700 font-bold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Margen proyectado
          </div>
          <div className="text-[16px] font-bold text-emerald-900 tabular-nums leading-tight">
            {strip.margenPct != null ? (
              <>~{strip.margenPct.toFixed(0)}<span className="text-emerald-400">%</span></>
            ) : (
              <span className="text-emerald-300">—</span>
            )}
          </div>
          <div className="text-[10px] text-emerald-600">
            {strip.margenPct != null ? 'vs precio de venta' : 'agrega precio de venta'}
          </div>
        </div>

        {/* Impacto en caja */}
        <div className="bg-sky-50 ring-1 ring-sky-200 rounded-xl px-3 py-2">
          <div className="text-[9px] uppercase tracking-wider text-sky-700 font-bold flex items-center gap-1">
            <Wallet className="w-3 h-3" /> Impacto en caja
          </div>
          <div className="text-[16px] font-bold text-sky-900 tabular-nums leading-tight">
            {strip.impactoCajaPct != null ? (
              <>{strip.impactoCajaPct.toFixed(0)}<span className="text-sky-400">%</span></>
            ) : (
              <span className="text-sky-300">—</span>
            )}
          </div>
          <div className="text-[10px] text-sky-600 inline-flex items-center gap-0.5">
            {strip.cajaDisponiblePEN != null ? (
              <>
                {strip.entra && <Check className="w-2.5 h-2.5" />}
                {strip.entra ? 'entra' : 'no entra'} · S/ {abreviar(strip.cajaDisponiblePEN)} disp
              </>
            ) : (
              'caja desconocida'
            )}
          </div>
        </div>
      </div>

      {/* Prioridad */}
      <div className="mt-2 flex items-center gap-1.5 text-[11px]">
        <span className="text-slate-400 font-medium">Prioridad</span>
        {(['baja', 'media', 'alta'] as const).map((p) => {
          const activo = prioridad === p;
          const activoCls = p === 'alta' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-700 text-white shadow-sm';
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPrioridadChange(p)}
              className={`px-2 py-0.5 rounded-full font-medium ${activo ? activoCls : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

function abreviar(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default StripBancarioModal;
