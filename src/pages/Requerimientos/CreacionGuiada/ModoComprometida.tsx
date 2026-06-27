/**
 * ModoComprometida · F4+ · Creación guiada · modo Comprometida (mockup acto 2 · línea ~210).
 *
 * Lista las COTIZACIONES con adelanto pagado / que requieren stock (`cotizacionesConfirmadas`):
 * demanda real, el cliente ya se comprometió. Al seleccionar una → crea un req
 * origen=demanda_comprometida vinculado a la cotización (cliente + productos faltantes).
 *
 * Estados: empty · sin cotizaciones comprometidas.
 */
import React from 'react';
import { UserCheck, ShoppingCart } from 'lucide-react';
import type { Venta } from '../../../types/venta.types';

interface Props {
  cotizaciones: Venta[];
  seleccionId: string | null;
  onSelect: (ventaId: string) => void;
}

export const ModoComprometida: React.FC<Props> = ({ cotizaciones, seleccionId, onSelect }) => {
  // ── Empty ──
  if (cotizaciones.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
          <UserCheck className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="text-[13px] font-semibold text-slate-800">Sin demanda comprometida</div>
        <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
          No hay cotizaciones con adelanto que requieran stock. Cuando un cliente abone una cotización
          sin stock, aparecerá acá lista para convertir en requerimiento.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="text-[12px] text-slate-600 mb-3">
        Cotizaciones con <b className="text-slate-900">adelanto / demanda real</b> que requieren stock.
      </div>
      <div className="space-y-2">
        {cotizaciones.map((v) => {
          const seleccionado = seleccionId === v.id;
          const adelantoPagado = (v.montoPagado || 0) > 0;
          const faltantes = v.productosConFaltante?.length ?? v.productos.length;
          return (
            <div
              key={v.id}
              className={`rounded-xl p-3 ${
                seleccionado ? 'border border-emerald-300 bg-emerald-50/40 ring-1 ring-emerald-200' : 'border border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={seleccionado}
                  onChange={() => onSelect(seleccionado ? '' : v.id)}
                  className="mt-1 rounded border-slate-300 text-emerald-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13px] font-semibold text-slate-800 truncate">
                      {v.nombreCliente}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 flex-shrink-0">{v.numeroVenta}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <ShoppingCart className="w-3 h-3 text-slate-400" /> {faltantes} producto{faltantes !== 1 ? 's' : ''} faltante{faltantes !== 1 ? 's' : ''}
                    </span>
                    <span>Total <b>S/ {(v.totalPEN || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</b></span>
                    {adelantoPagado && (
                      <span className="text-emerald-600 font-medium inline-flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> adelanto S/ {(v.montoPagado || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default ModoComprometida;
