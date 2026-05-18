/**
 * VistaCalendario · canon v8.0 + v9.0 · Gastos rework v4
 *
 * chk5.C-UX-PASS-ALT (2026-05-11) · refactor con canon v8.0 + v9.0:
 *   - N1+N2 · días con gradient sutil + ring según bloque dominante (no solo dots)
 *   - N4 · color cross-módulo blue/purple/amber
 *   - F8/F9 · lucide ChevronLeft/ChevronRight (NO caracteres ‹ ›)
 *   - N10 · botón "Hoy" en teal (canon)
 *   - v9.0 M1 · classes copy-paste literal del mockup
 *
 * Mockup: `docs/mockups/gastos-vistas-alternativas-v4.html · Sección 2`.
 */

import React, { useMemo, useState } from 'react';
import {
  X as XIcon, Package, ShoppingBag, Calendar,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { Gasto } from '../../../types/gasto.types';
import type { BloqueCosto } from '../../../types/categoriaCosto.types';
import { toDateOrNow } from '../../../utils/dateFormatters';
import { getBloqueDelGasto, type ArbolCategorias } from '../../../utils/gasto.bloque';

interface VistaCalendarioProps {
  gastos: Gasto[];
  arbolCategorias: Record<BloqueCosto, { padres: any[]; hijos: Record<string, any[]> }> | null;
  selectedYear: number;
  selectedMonth: number; // 1-12
  onChangeMes: (year: number, month: number) => void;
  onEditar: (g: Gasto) => void;
  onPagar: (g: Gasto) => void;
}

const formatPEN0 = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(n);

const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const bloqueDeGasto = (g: Gasto, arbolCategorias: ArbolCategorias | null): BloqueCosto =>
  getBloqueDelGasto(g, arbolCategorias) ?? 'periodo';

// canon v8.0 N1+N2 · clases por bloque dominante del día
const cellClassByBloque: Record<BloqueCosto, {
  gradient: string;
  ring: string;
  hover: string;
  dot: string;
  text: string;
  amount: string;
}> = {
  producto: {
    gradient: 'bg-gradient-to-br from-blue-50 to-blue-100/40',
    ring: 'ring-1 ring-blue-200/50',
    hover: 'hover:from-blue-100 hover:to-blue-100',
    dot: 'bg-blue-500',
    text: 'text-blue-900',
    amount: 'text-blue-700',
  },
  venta: {
    gradient: 'bg-gradient-to-br from-purple-50 to-purple-100/40',
    ring: 'ring-1 ring-purple-200/50',
    hover: 'hover:from-purple-100 hover:to-purple-100',
    dot: 'bg-purple-500',
    text: 'text-purple-900',
    amount: 'text-purple-700',
  },
  periodo: {
    gradient: 'bg-gradient-to-br from-amber-50 to-amber-100/40',
    ring: 'ring-1 ring-amber-200/50',
    hover: 'hover:from-amber-100 hover:to-amber-100',
    dot: 'bg-amber-500',
    text: 'text-amber-900',
    amount: 'text-amber-700',
  },
};

// Card de gasto en panel del día · canon v8.0 N4 · border + chip por bloque
const cardClassByBloque: Record<BloqueCosto, {
  border: string;
  Icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  label: string;
}> = {
  producto: { border: 'border-blue-100', Icon: Package, iconColor: 'text-blue-700', label: 'Producto' },
  venta: { border: 'border-purple-100', Icon: ShoppingBag, iconColor: 'text-purple-700', label: 'Venta' },
  periodo: { border: 'border-amber-100', Icon: Calendar, iconColor: 'text-amber-700', label: 'Período' },
};

export const VistaCalendario: React.FC<VistaCalendarioProps> = ({
  gastos,
  arbolCategorias,
  selectedYear,
  selectedMonth,
  onChangeMes,
  onEditar,
  onPagar,
}) => {
  const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null);

  const grid = useMemo(() => {
    const primerDia = new Date(selectedYear, selectedMonth - 1, 1);
    const ultimoDia = new Date(selectedYear, selectedMonth, 0);
    const diasEnMes = ultimoDia.getDate();
    const offsetIni = (primerDia.getDay() + 6) % 7;
    const totalCells = Math.ceil((offsetIni + diasEnMes) / 7) * 7;

    const gastosPorDia: Record<number, Gasto[]> = {};
    for (const g of gastos) {
      const f = toDateOrNow(g.fecha);
      if (isNaN(f.getTime())) continue;
      if (f.getFullYear() !== selectedYear || f.getMonth() !== selectedMonth - 1) continue;
      const dia = f.getDate();
      if (!gastosPorDia[dia]) gastosPorDia[dia] = [];
      gastosPorDia[dia].push(g);
    }

    const cells: Array<{ dia: number | null; gastos: Gasto[] }> = [];
    for (let i = 0; i < totalCells; i++) {
      const dia = i - offsetIni + 1;
      if (dia >= 1 && dia <= diasEnMes) {
        cells.push({ dia, gastos: gastosPorDia[dia] || [] });
      } else {
        cells.push({ dia: null, gastos: [] });
      }
    }
    return cells;
  }, [selectedYear, selectedMonth, gastos]);

  const hoy = new Date();
  const esHoyMes = hoy.getFullYear() === selectedYear && hoy.getMonth() === selectedMonth - 1;

  const gastosDelDia = diaSeleccionado !== null
    ? grid.find(c => c.dia === diaSeleccionado)?.gastos ?? []
    : [];
  const totalDelDia = gastosDelDia.reduce((acc, g) => acc + (g.montoPEN || 0), 0);

  // Resumen por bloque del mes (para sidebar / panel info)
  const resumenMes = useMemo(() => {
    const r: Record<BloqueCosto, number> = { producto: 0, venta: 0, periodo: 0 };
    for (const cell of grid) {
      for (const g of cell.gastos) {
        const b = bloqueDeGasto(g, arbolCategorias);
        r[b] += g.montoPEN || 0;
      }
    }
    return r;
  }, [grid, arbolCategorias]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Header con navegación + leyenda · canon v9.0 M1 · classes literal */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const d = new Date(selectedYear, selectedMonth - 2, 1);
              onChangeMes(d.getFullYear(), d.getMonth() + 1);
              setDiaSeleccionado(null);
            }}
            className="bg-white border border-slate-200 p-1.5 rounded hover:bg-slate-100"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <span className="font-bold tabular-nums text-sm text-slate-900 min-w-[120px] text-center">
            {MESES_LARGOS[selectedMonth - 1]} {selectedYear}
          </span>
          <button
            type="button"
            onClick={() => {
              const d = new Date(selectedYear, selectedMonth, 1);
              onChangeMes(d.getFullYear(), d.getMonth() + 1);
              setDiaSeleccionado(null);
            }}
            className="bg-white border border-slate-200 p-1.5 rounded hover:bg-slate-100"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
          {!esHoyMes && (
            <button
              type="button"
              onClick={() => {
                onChangeMes(hoy.getFullYear(), hoy.getMonth() + 1);
                setDiaSeleccionado(null);
              }}
              className="ml-2 text-[11px] text-teal-700 hover:text-teal-800 font-medium underline"
            >
              Hoy
            </button>
          )}
        </div>

        {/* Leyenda · canon v8.0 N4 · colores cross-módulo */}
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-slate-500 uppercase tracking-wider font-bold">Leyenda:</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-slate-700">Producto</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            <span className="text-slate-700">Venta</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="text-slate-700">Período</span>
          </span>
        </div>
      </div>

      {/* Grid 7×N · canon v8.0 N1+N2 · cada día con su tinte */}
      <div className="p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DIAS_SHORT.map((d) => (
            <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((cell, idx) => {
            if (cell.dia === null) {
              return <div key={idx} className="aspect-square bg-slate-50 rounded"></div>;
            }
            const esHoy = esHoyMes && cell.dia === hoy.getDate();
            const isSelected = diaSeleccionado === cell.dia;

            // Determinar bloque dominante del día (por monto)
            let bloqueDominante: BloqueCosto | null = null;
            if (cell.gastos.length > 0) {
              const totales: Record<BloqueCosto, number> = { producto: 0, venta: 0, periodo: 0 };
              for (const g of cell.gastos) {
                totales[bloqueDeGasto(g, arbolCategorias)] += g.montoPEN || 0;
              }
              bloqueDominante = (Object.entries(totales)
                .sort(([, a], [, b]) => b - a)[0][0]) as BloqueCosto;
            }
            const totalDia = cell.gastos.reduce((a, g) => a + (g.montoPEN || 0), 0);
            const cellCfg = bloqueDominante ? cellClassByBloque[bloqueDominante] : null;

            // Bloques únicos del día (para los dots)
            const bloquesUnicos = Array.from(new Set(cell.gastos.map(g => bloqueDeGasto(g, arbolCategorias))));

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setDiaSeleccionado(cell.dia)}
                className={`aspect-square rounded p-1.5 cursor-pointer transition-colors text-left ${
                  isSelected && cellCfg
                    ? `${cellCfg.gradient} ring-2 ring-${bloqueDominante === 'producto' ? 'blue' : bloqueDominante === 'venta' ? 'purple' : 'amber'}-500 shadow-sm`
                    : esHoy
                      ? 'bg-teal-50 ring-2 ring-teal-400'
                      : cellCfg
                        ? `${cellCfg.gradient} ${cellCfg.ring} ${cellCfg.hover}`
                        : 'bg-white border border-slate-100 hover:bg-slate-50'
                }`}
              >
                <div className={`text-[11px] font-bold ${
                  esHoy ? 'text-teal-900'
                    : cellCfg ? cellCfg.text
                    : 'text-slate-700'
                }`}>
                  {cell.dia}
                </div>
                {esHoy && (
                  <div className="text-[8px] text-teal-700 italic">hoy</div>
                )}
                {cell.gastos.length > 0 && !esHoy && (
                  <>
                    <div className="flex gap-0.5 mt-0.5">
                      {bloquesUnicos.map((b) => (
                        <span
                          key={b}
                          className={`w-1.5 h-1.5 rounded-full ${cellClassByBloque[b].dot}`}
                        />
                      ))}
                    </div>
                    {cellCfg && (
                      <div className={`text-[8px] tabular-nums font-medium mt-0.5 ${cellCfg.amount}`}>
                        {formatPEN0(totalDia)}
                      </div>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel inferior · día seleccionado · canon v8.0 N1+N2 · tinte por bloque dominante */}
      {diaSeleccionado !== null && gastosDelDia.length > 0 && (() => {
        // Bloque dominante del día seleccionado
        const totales: Record<BloqueCosto, number> = { producto: 0, venta: 0, periodo: 0 };
        for (const g of gastosDelDia) {
          totales[bloqueDeGasto(g, arbolCategorias)] += g.montoPEN || 0;
        }
        const bDom = (Object.entries(totales).sort(([, a], [, b]) => b - a)[0][0]) as BloqueCosto;
        const cfg = cellClassByBloque[bDom];

        return (
          <div className={`${cfg.gradient} border-t ${cfg.ring} px-4 py-3`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className={`text-[10px] uppercase tracking-wider ${cfg.amount} font-bold`}>
                  {diaSeleccionado} de {MESES_LARGOS[selectedMonth - 1].toLowerCase()} · {gastosDelDia.length} gasto{gastosDelDia.length > 1 ? 's' : ''}
                </div>
                <div className={`text-base font-bold tabular-nums ${cfg.text}`}>
                  Total: {formatPEN0(totalDelDia)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDiaSeleccionado(null)}
                className={`text-xs ${cfg.amount} hover:opacity-80 font-medium inline-flex items-center gap-1`}
              >
                <XIcon className="w-3.5 h-3.5" /> Cerrar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {gastosDelDia.map((g) => {
                const b = bloqueDeGasto(g, arbolCategorias);
                const cardCfg = cardClassByBloque[b];
                const CardIcon = cardCfg.Icon;
                const dotColor = cellClassByBloque[b].dot;
                return (
                  <div
                    key={g.id}
                    className={`bg-white border ${cardCfg.border} rounded-lg p-2.5 cursor-pointer hover:shadow-sm transition-shadow`}
                    onClick={() => onEditar(g)}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                      <span className={`text-[9px] uppercase tracking-wider ${cardCfg.iconColor} font-bold inline-flex items-center gap-0.5`}>
                        <CardIcon className="w-2.5 h-2.5" />
                        {cardCfg.label}
                      </span>
                      <span className="ml-auto text-[10px] font-bold tabular-nums text-slate-900">
                        {formatPEN0(g.montoPEN || 0)}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {g.descripcion || g.tipo || g.numeroGasto}
                    </div>
                    {(g.proveedor || g.proveedorNombre) && (
                      <div className="text-[10px] text-slate-500 truncate">
                        {g.proveedor || g.proveedorNombre}
                      </div>
                    )}
                    {(g.estado === 'pendiente' || g.estado === 'parcial') && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPagar(g);
                        }}
                        className={`mt-1.5 w-full text-[10px] bg-white border ${cardCfg.border} hover:bg-slate-50 ${cardCfg.iconColor} font-bold py-1 rounded`}
                      >
                        Pagar →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {diaSeleccionado !== null && gastosDelDia.length === 0 && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-500 italic">
          No hay gastos registrados el día {diaSeleccionado}.
        </div>
      )}

      {/* Resumen del mes · footer compacto · canon v8.0 */}
      {(resumenMes.producto + resumenMes.venta + resumenMes.periodo) > 0 && diaSeleccionado === null && (
        <div className="border-t border-slate-200 bg-slate-50/50 px-4 py-2 flex items-center gap-3 text-[11px] flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Resumen mes:</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-slate-600">Producto:</span>
            <span className="font-bold tabular-nums text-blue-900">{formatPEN0(resumenMes.producto)}</span>
          </span>
          <span className="text-slate-300">·</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            <span className="text-slate-600">Venta:</span>
            <span className="font-bold tabular-nums text-purple-900">{formatPEN0(resumenMes.venta)}</span>
          </span>
          <span className="text-slate-300">·</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="text-slate-600">Período:</span>
            <span className="font-bold tabular-nums text-amber-900">{formatPEN0(resumenMes.periodo)}</span>
          </span>
        </div>
      )}
    </div>
  );
};
