/**
 * ComparativaLotesTable · tabla de lotes del SKU foco · Workspace Costos
 *
 * chk5.B9 (S3.6 M1.bis · Cost Intelligence) · pixel-perfect contra mockup
 * `cost-intelligence-canon-productos.html · Sec 2 · Panel 3`.
 *
 * Tabla que compara los lotes de un mismo SKU recibidos en distintas OCs
 * a lo largo del tiempo. Permite ver:
 *   - Costo unit. USD por lote · driver del cambio
 *   - TCPA aplicado a cada lote
 *   - Costo PEN derivado
 *   - Δ vs lote anterior (% con color)
 *   - Driver principal inferido (proveedor / TC / mixto)
 *   - Fila final: promedio ponderado FIFO + tendencia
 *
 * Empty state:
 *   - Si no hay SKU foco: "Sin SKUs con ≥2 lotes" + sugerencia
 *   - Si hay SKU pero <2 lotes: "Necesita ≥2 OCs"
 */

import React, { useState, useRef, useEffect } from 'react';
import { Layers, AlertCircle, ChevronDown, Check } from 'lucide-react';
import type { SkuConCostos, LoteCosto } from '../../../utils/costIntelligence';
import { calcularPromedioFIFO, driverPrincipalLote } from '../../../utils/costIntelligence';

interface ComparativaLotesTableProps {
  sku: SkuConCostos | null;
  /** Lista de SKUs candidatos (con ≥2 lotes) para el selector dropdown */
  candidatos?: SkuConCostos[];
  /** Handler para cambiar el SKU foco · recibe productoId */
  onSeleccionarSku?: (productoId: string) => void;
}

const fmtUSD = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPEN = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString('es-PE');
const fmtPct = (n: number, decimals = 1) =>
  `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;
const fmtFechaCorta = (d: Date) =>
  d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

function rowClassesByVariance(variancePct: number | null): string {
  if (variancePct === null) return 'hover:bg-slate-50';
  const abs = Math.abs(variancePct);
  if (abs <= 2) return 'hover:bg-slate-50';
  if (abs <= 5) return 'bg-amber-50/30 hover:bg-amber-50/60';
  return 'bg-rose-50/30 hover:bg-rose-50/60 ring-1 ring-rose-200';
}

function varianceClasses(variancePct: number | null): string {
  if (variancePct === null) return 'text-slate-400';
  const abs = Math.abs(variancePct);
  if (abs <= 2) return 'text-emerald-600';
  if (abs <= 5) return 'text-amber-700';
  return 'text-rose-700';
}

export const ComparativaLotesTable: React.FC<ComparativaLotesTableProps> = ({ sku, candidatos = [], onSeleccionarSku }) => {
  // Dropdown selector de SKU · canon dropdown contextual (click-outside close)
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const haySelector = candidatos.length > 1 && !!onSeleccionarSku;

  // Empty state: sin SKU foco
  if (!sku) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm font-bold text-slate-900">Comparativa de lotes</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Compara el costo de la MISMA SKU en cada compra (lote/OC) en el tiempo
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Layers className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-xs text-slate-500 mb-1 font-semibold">
            Sin SKUs con ≥2 lotes
          </p>
          <p className="text-[10px] text-slate-400 max-w-md">
            La comparativa requiere al menos 1 SKU con 2 o más OCs recibidas para
            comparar costos entre lotes. Cuando llegue la segunda OC de un producto
            ya comprado, este panel se activa.
          </p>
        </div>
      </div>
    );
  }

  // Empty state: SKU con <2 lotes (no debería suceder por el selector, pero defensivo)
  if (sku.lotes.length < 2) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm font-bold text-slate-900">
              Comparativa de lotes · {sku.nombreComercial}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Necesita ≥2 OCs del mismo SKU para comparar
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-6 h-6 text-amber-400 mb-2" />
          <p className="text-xs text-slate-500">
            Sólo 1 lote registrado · esperando segunda OC
          </p>
        </div>
      </div>
    );
  }

  const lotes = sku.lotes;
  const fifo = calcularPromedioFIFO(sku);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Comparativa de lotes
          </div>
          {/* SKU como botón dropdown · click cambia foco · canon F1 contextual */}
          {haySelector ? (
            <div ref={dropdownRef} className="relative inline-block">
              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 group"
                aria-expanded={dropdownOpen}
                aria-haspopup="listbox"
              >
                <span className="text-sm font-bold text-slate-900 truncate group-hover:text-teal-700 transition-colors">
                  {sku.nombreComercial}
                </span>
                <span className="text-[10px] font-mono text-slate-500 group-hover:text-teal-600">
                  · {sku.sku}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 transition-transform ${
                    dropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {dropdownOpen && (
                <div
                  className="absolute left-0 top-full mt-1 w-80 max-h-[320px] overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg z-30"
                  role="listbox"
                >
                  <div className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50">
                    {candidatos.length} SKUs con ≥2 lotes
                  </div>
                  {candidatos.map((c) => {
                    const esActual = c.productoId === sku.productoId;
                    return (
                      <button
                        key={c.productoId}
                        type="button"
                        role="option"
                        aria-selected={esActual}
                        onClick={() => {
                          onSeleccionarSku?.(c.productoId);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-[11px] hover:bg-teal-50 border-b border-slate-100 last:border-b-0 flex items-start gap-2 ${
                          esActual ? 'bg-teal-50/60' : ''
                        }`}
                      >
                        <span className="flex-shrink-0 w-3 h-3 flex items-center justify-center mt-0.5">
                          {esActual && <Check className="w-3 h-3 text-teal-700" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-slate-900 truncate">
                            {c.nombreComercial}
                          </span>
                          <span className="block text-[9px] text-slate-500 tabular-nums">
                            <span className="font-mono">{c.sku}</span>
                            {c.marca && (<> · {c.marca}</>)}
                            <> · {c.lotes.length} lotes · {fmtInt(c.unidadesActivas)} uds</>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm font-bold text-slate-900 truncate">
              {sku.nombreComercial}
              <span className="ml-1.5 text-[10px] font-mono text-slate-500">· {sku.sku}</span>
            </div>
          )}
          <div className="text-[10px] text-slate-500 mt-0.5">
            Compara el costo de la MISMA SKU en cada compra (lote/OC) en el tiempo
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-bold text-white bg-slate-900 px-2 py-1 rounded tabular-nums">
            {lotes.length} lotes · {fmtInt(fifo.totalUds)} uds
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] mt-2">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
              <th className="px-2 py-2">Lote</th>
              <th className="px-2 py-2">OC origen</th>
              <th className="px-2 py-2">Recibido</th>
              <th className="px-2 py-2 text-right">Uds</th>
              <th className="px-2 py-2 text-right">Costo unit. USD</th>
              <th className="px-2 py-2 text-right">TCPA</th>
              <th className="px-2 py-2 text-right">Costo unit. PEN</th>
              <th className="px-2 py-2 text-right">Δ vs lote ant.</th>
              <th className="px-2 py-2">Driver principal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lotes.map((lote, idx) => {
              const anterior: LoteCosto | null = idx > 0 ? lotes[idx - 1] : null;
              const variancePct = anterior && anterior.costoUnitarioPEN > 0
                ? ((lote.costoUnitarioPEN - anterior.costoUnitarioPEN) / anterior.costoUnitarioPEN) * 100
                : null;
              const rowCls = rowClassesByVariance(variancePct);
              const tcCls = anterior && Math.abs(lote.tc - anterior.tc) / anterior.tc > 0.02
                ? 'text-amber-700'
                : 'text-slate-700';
              const driverLabel = driverPrincipalLote(lote, anterior);
              const driverCls = anterior === null
                ? 'text-slate-600'
                : variancePct !== null && Math.abs(variancePct) > 5
                ? 'text-rose-700'
                : variancePct !== null && Math.abs(variancePct) > 2
                ? 'text-amber-700'
                : 'text-slate-600';

              return (
                <tr key={`${lote.ordenCompraId}-${lote.loteId}`} className={rowCls}>
                  <td className="px-2 py-2 font-mono text-slate-700 font-bold">
                    {lote.loteId}
                  </td>
                  <td className="px-2 py-2 font-mono text-slate-600">
                    {lote.ordenCompraNumero || '—'}
                  </td>
                  <td className="px-2 py-2 text-slate-700">
                    {fmtFechaCorta(lote.fechaRecepcion)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {fmtInt(lote.cantidad)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold">
                    $ {fmtUSD(lote.costoUnitarioUSD)}
                  </td>
                  <td className={`px-2 py-2 text-right tabular-nums ${tcCls}`}>
                    {lote.tc.toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold">
                    S/ {fmtPEN(lote.costoUnitarioPEN)}
                  </td>
                  <td className={`px-2 py-2 text-right font-bold tabular-nums ${varianceClasses(variancePct)}`}>
                    {variancePct === null ? '—' : fmtPct(variancePct)}
                  </td>
                  <td className={`px-2 py-2 ${driverCls}`}>
                    {driverLabel}
                  </td>
                </tr>
              );
            })}

            {/* Fila resumen · promedio ponderado FIFO */}
            <tr className="bg-slate-50 border-t-2 border-slate-300">
              <td className="px-2 py-2 font-bold text-slate-900">
                Promedio ponderado (FIFO)
              </td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-2 py-2 text-right tabular-nums font-bold">
                {fmtInt(fifo.totalUds)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums font-bold">
                $ {fmtUSD(fifo.costoPromedioUSD)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums font-bold">
                {fifo.tcpaPromedio.toFixed(2)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums font-bold">
                S/ {fmtPEN(fifo.costoPromedioPEN)}
              </td>
              <td className={`px-2 py-2 text-right font-bold tabular-nums ${varianceClasses(fifo.varianceTotalPct)}`}>
                {fifo.varianceTotalPct === null ? '—' : fmtPct(fifo.varianceTotalPct)}
              </td>
              <td className="px-2 py-2 font-bold text-slate-900">
                {fifo.tendencia === 'alcista' && 'Tendencia: alcista'}
                {fifo.tendencia === 'bajista' && 'Tendencia: bajista'}
                {fifo.tendencia === 'estable' && 'Tendencia: estable'}
                {fifo.tendencia === null && '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
