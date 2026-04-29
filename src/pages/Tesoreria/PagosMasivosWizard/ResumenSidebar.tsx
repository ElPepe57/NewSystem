/**
 * ResumenSidebar — Imp-L3 · Pagos Masivos M5
 *
 * Sidebar derecho persistente que muestra el resumen del lote en
 * construcción. Header gradiente teal + body con stats + footer con
 * TC del día.
 */

import React from 'react';
import { Layers, ArrowUpCircle, ArrowDownCircle, FileText, AlertCircle } from 'lucide-react';
import type { ConfigPagoMasivo, ItemSeleccionado } from '../../../types/pagoMasivo.types';
import { cn } from '../../../design-system/utils';

function fmtMonto(n: number, moneda: 'PEN' | 'USD'): string {
  const sym = moneda === 'USD' ? 'US$' : 'S/';
  return `${sym} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface ResumenSidebarProps {
  tipo: 'egreso' | 'ingreso';
  config: Partial<ConfigPagoMasivo>;
  items: ItemSeleccionado[];
  /** Si hay alguna alerta (saldo insuficiente, etc.) */
  alertas?: string[];
}

export const ResumenSidebar: React.FC<ResumenSidebarProps> = ({
  tipo,
  config,
  items,
  alertas = [],
}) => {
  // Totales
  let totalPEN = 0;
  let totalUSD = 0;
  for (const it of items) {
    if (it.monedaDocumento === 'PEN') totalPEN += it.montoPagar;
    else totalUSD += it.montoPagar;
  }
  const tc = config.tipoCambio ?? 3.85;
  const totalConsolidadoPEN = totalPEN + totalUSD * tc;
  const totalConsolidadoUSD = totalUSD + totalPEN / tc;

  const TipoIcon = tipo === 'egreso' ? ArrowUpCircle : ArrowDownCircle;
  const tipoLabel = tipo === 'egreso' ? 'Egreso · pagos a salir' : 'Ingreso · cobros a entrar';

  return (
    <aside className="w-full lg:w-[260px] flex-shrink-0 bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col">
      {/* Header gradiente */}
      <div className="bg-gradient-to-br from-teal-700 to-teal-500 p-4 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">
            Lote en construcción
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TipoIcon className="w-3.5 h-3.5" />
          <span className="text-xs">{tipoLabel}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Cuenta seleccionada */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Cuenta {tipo === 'egreso' ? 'origen' : 'destino'}
          </div>
          {config.cuentaNombre ? (
            <div className="bg-white border border-slate-200 rounded-lg p-2.5">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {config.cuentaNombre}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {config.metodoPago && `${config.metodoPago} · `}
                {config.monedaPago}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">
              Sin cuenta seleccionada
            </div>
          )}
        </div>

        {/* Conteo de items */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Documentos seleccionados
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-2.5">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-900 tabular-nums">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
          </div>
        </div>

        {/* Totales */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Total
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5">
            {totalPEN > 0 && (
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-500">PEN</span>
                <span className="text-sm font-bold text-slate-900 tabular-nums">
                  {fmtMonto(totalPEN, 'PEN')}
                </span>
              </div>
            )}
            {totalUSD > 0 && (
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-500">USD</span>
                <span className="text-sm font-bold text-slate-900 tabular-nums">
                  {fmtMonto(totalUSD, 'USD')}
                </span>
              </div>
            )}
            {(totalPEN > 0 || totalUSD > 0) && (
              <div className="border-t border-slate-100 pt-1.5 mt-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] text-slate-400">≈ Consolidado</span>
                  <span className="text-xs font-semibold text-teal-700 tabular-nums">
                    {fmtMonto(totalConsolidadoPEN, 'PEN')}
                  </span>
                </div>
                <div className="flex justify-end items-baseline">
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    ≈ {fmtMonto(totalConsolidadoUSD, 'USD')}
                  </span>
                </div>
              </div>
            )}
            {totalPEN === 0 && totalUSD === 0 && (
              <div className="text-xs text-slate-400 italic">Sin items</div>
            )}
          </div>
        </div>

        {/* Items seleccionados (preview compacto) */}
        {items.length > 0 && items.length <= 12 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Detalle ({items.length})
            </div>
            <div className="space-y-1">
              {items.slice(0, 6).map((it) => (
                <div
                  key={it.documentoId}
                  className="flex justify-between items-baseline gap-2 text-[11px] bg-white border border-slate-100 rounded-md px-2 py-1.5"
                >
                  <span className="text-slate-700 truncate">{it.numeroDocumento}</span>
                  <span className="text-slate-900 tabular-nums font-semibold flex-shrink-0">
                    {fmtMonto(it.montoPagar, it.monedaDocumento)}
                  </span>
                </div>
              ))}
              {items.length > 6 && (
                <div className="text-[10px] text-slate-400 italic text-center pt-1">
                  + {items.length - 6} más...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alertas */}
        {alertas.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Alertas
              </span>
            </div>
            <ul className="space-y-0.5 list-disc pl-4">
              {alertas.map((a, i) => (
                <li key={i} className="text-[11px] text-amber-800">
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer · TC del día */}
      <div className="border-t border-slate-200 p-3 bg-white">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">TC del día</span>
          <span className="font-semibold text-slate-700 tabular-nums">
            S/ {(config.tipoCambio ?? 3.85).toFixed(3)}
          </span>
        </div>
      </div>
    </aside>
  );
};
