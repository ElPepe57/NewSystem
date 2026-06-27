/**
 * ModoRestock · F4+ · Creación guiada · modo Restock (mockup acto 2).
 *
 * La lista de recomendaciones del MOTOR DE REORDEN (`sugerenciasStock`/productoIntel):
 * "el motor recomienda reponer N productos". Selección múltiple + "Todo", cada item
 * con disp/reorden/velocidad/cobertura + cantidad sugerida editable. Al confirmar el
 * modal, crea UN req subtipo=restock por sugerencia seleccionada (trazabilidad del motor).
 *
 * Estados: empty (sin recomendaciones · acto 7) · loading (skeleton · acto 7).
 */
import React from 'react';
import { CheckCircle2, History } from 'lucide-react';
import type { SugerenciaStock } from '../requerimientos.types';

interface Props {
  sugerencias: SugerenciaStock[];
  loading: boolean;
  /** Set de productoId seleccionados. */
  seleccion: Set<string>;
  onToggle: (productoId: string) => void;
  onToggleTodo: () => void;
  /** Cantidades editadas por productoId (override de la sugerida). */
  cantidades: Record<string, number>;
  onCantidadChange: (productoId: string, cantidad: number) => void;
}

const URGENCIA_BADGE: Record<SugerenciaStock['urgencia'], { label: string; cls: string }> = {
  critica: { label: 'crítico', cls: 'text-rose-700 bg-rose-100' },
  alta: { label: 'alta', cls: 'text-amber-700 bg-amber-100' },
  media: { label: 'media', cls: 'text-slate-600 bg-slate-100' },
};

export const ModoRestock: React.FC<Props> = ({
  sugerencias,
  loading,
  seleccion,
  onToggle,
  onToggleTodo,
  cantidades,
  onCantidadChange,
}) => {
  // ── Loading (acto 7) ──
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
        <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
        <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
      </div>
    );
  }

  // ── Empty · sin recomendaciones (acto 7) ──
  if (sugerencias.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="text-[13px] font-semibold text-slate-800">Restock · sin recomendaciones</div>
        <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
          Todo por encima del punto de reorden. El motor no sugiere nada — buena señal. (Cambiá a Manual para forzar.)
        </p>
      </div>
    );
  }

  const todoActivo = sugerencias.every((s) => seleccion.has(s.producto.id));

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[12px] text-slate-600">
          El motor recomienda reponer <b className="text-slate-900">{sugerencias.length} producto{sugerencias.length !== 1 ? 's' : ''}</b>{' '}
          <span className="text-slate-400">(sin historial no aparece)</span>.
        </div>
        <label className="text-[11px] text-slate-500 inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" className="rounded border-slate-300 text-sky-600" checked={todoActivo} onChange={onToggleTodo} /> Todo
        </label>
      </div>

      <div className="space-y-2">
        {sugerencias.map((sug) => {
          const id = sug.producto.id;
          const checked = seleccion.has(id);
          const cantidad = cantidades[id] ?? sug.cantidadSugerida ?? Math.max(sug.stockMinimo - sug.stockActual, 10);
          const badge = URGENCIA_BADGE[sug.urgencia];
          const costoUnit = sug.precioEstimadoUSD;
          const subtotal = costoUnit ? costoUnit * cantidad : undefined;
          const cobertura = sug.demandaPromedio > 0 ? sug.stockActual / sug.demandaPromedio : undefined;

          return (
            <div
              key={id}
              className={`rounded-xl p-3 ${
                checked ? 'border border-sky-300 bg-sky-50/40 ring-1 ring-sky-200' : 'border border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(id)}
                  className="mt-1 rounded border-slate-300 text-sky-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13px] font-semibold text-slate-800 truncate">
                      {sug.producto.marca} · {sug.producto.nombreComercial}
                    </div>
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums">
                    <span>Disp neto <b className={sug.stockActual <= 5 ? 'text-rose-600' : 'text-amber-600'}>{sug.stockActual}</b></span>
                    <span>Reorden <b>{sug.stockMinimo}</b></span>
                    {sug.demandaPromedio > 0 && <span>Velocidad <b>{sug.demandaPromedio.toFixed(1)}/día</b></span>}
                    {cobertura != null && <span>Cobertura <b className={cobertura <= 3 ? 'text-rose-600' : ''}>{cobertura.toFixed(1)}d</b></span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide">Pedir</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <button
                      type="button"
                      onClick={() => onCantidadChange(id, Math.max(1, cantidad - 1))}
                      className="w-6 h-6 rounded border border-slate-200 text-slate-500 hover:bg-slate-50"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={cantidad}
                      onChange={(e) => onCantidadChange(id, Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 text-center text-[13px] font-bold text-slate-900 tabular-nums border border-slate-200 rounded py-0.5"
                    />
                    <button
                      type="button"
                      onClick={() => onCantidadChange(id, cantidad + 1)}
                      className="w-6 h-6 rounded border border-slate-200 text-slate-500 hover:bg-slate-50"
                    >
                      +
                    </button>
                  </div>
                  {subtotal != null && (
                    <div className="text-[10px] text-slate-500 mt-1 tabular-nums">
                      × ${costoUnit!.toFixed(2)} = <b className="text-amber-700">${subtotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</b>
                    </div>
                  )}
                  {sug.proveedorSugerido && (
                    <div className="text-[9px] text-slate-400 inline-flex items-center gap-0.5">
                      <History className="w-2.5 h-2.5" /> {sug.proveedorSugerido}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default ModoRestock;
