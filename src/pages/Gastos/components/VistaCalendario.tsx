/**
 * VistaCalendario · TAREA-GASTOS-PAGE-V2 F3.b
 *
 * Vista alternativa: grid mensual con dots de color por bloque.
 * Click en un día expande panel con gastos de ese día + total + bulk pay.
 */

import React, { useMemo, useState } from 'react';
import type { Gasto } from '../../../types/gasto.types';
import type { BloqueCosto } from '../../../types/categoriaCosto.types';

interface VistaCalendarioProps {
  gastos: Gasto[];
  arbolCategorias: Record<BloqueCosto, { padres: any[]; hijos: Record<string, any[]> }> | null;
  selectedYear: number;
  selectedMonth: number; // 1-12
  onChangeMes: (year: number, month: number) => void;
  onEditar: (g: Gasto) => void;
  onPagar: (g: Gasto) => void;
}

const formatPEN = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(n);

const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const bloqueDeGasto = (g: Gasto, arbolCategorias: any): BloqueCosto => {
  if (g.categoriaCostoId && arbolCategorias) {
    for (const b of ['producto', 'venta', 'periodo'] as BloqueCosto[]) {
      const datos = arbolCategorias[b];
      if (!datos) continue;
      if (datos.padres.some((p: any) => p.id === g.categoriaCostoId)) return b;
      for (const padreId of Object.keys(datos.hijos)) {
        if (datos.hijos[padreId].some((h: any) => h.id === g.categoriaCostoId)) return b;
      }
    }
  }
  if (g.categoria === 'GA') return 'producto';
  if (g.categoria === 'GD' || g.categoria === 'GV') return 'venta';
  return 'periodo';
};

const dotColorByBloque: Record<BloqueCosto, string> = {
  producto: 'bg-blue-500',
  venta: 'bg-purple-500',
  periodo: 'bg-amber-500',
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

  // Calcular grid del mes (lunes a domingo)
  const grid = useMemo(() => {
    const primerDia = new Date(selectedYear, selectedMonth - 1, 1);
    const ultimoDia = new Date(selectedYear, selectedMonth, 0);
    const diasEnMes = ultimoDia.getDate();
    // Lunes=0, ..., Domingo=6 (recalculado · JS: Domingo=0)
    const offsetIni = (primerDia.getDay() + 6) % 7;
    const totalCells = Math.ceil((offsetIni + diasEnMes) / 7) * 7;

    // Mapa dia -> gastos
    const gastosPorDia: Record<number, Gasto[]> = {};
    for (const g of gastos) {
      const f = g.fecha?.toDate?.() ?? new Date(g.fecha as any);
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

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header con navegacion + leyenda */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const d = new Date(selectedYear, selectedMonth - 2, 1);
              onChangeMes(d.getFullYear(), d.getMonth() + 1);
              setDiaSeleccionado(null);
            }}
            className="bg-white border border-slate-200 px-2 py-1 rounded text-xs hover:bg-slate-100"
          >
            ‹
          </button>
          <span className="font-bold tabular-nums">{MESES_LARGOS[selectedMonth - 1]} {selectedYear}</span>
          <button
            type="button"
            onClick={() => {
              const d = new Date(selectedYear, selectedMonth, 1);
              onChangeMes(d.getFullYear(), d.getMonth() + 1);
              setDiaSeleccionado(null);
            }}
            className="bg-white border border-slate-200 px-2 py-1 rounded text-xs hover:bg-slate-100"
          >
            ›
          </button>
          {!esHoyMes && (
            <button
              type="button"
              onClick={() => {
                onChangeMes(hoy.getFullYear(), hoy.getMonth() + 1);
                setDiaSeleccionado(null);
              }}
              className="ml-2 text-xs text-amber-700 font-bold hover:text-amber-900"
            >
              Hoy
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Importación</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span>Venta</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span>Período</div>
        </div>
      </div>

      <div className="p-5">
        {/* Grid de dias */}
        <div className="grid grid-cols-7 gap-1.5 text-xs">
          {DIAS_SHORT.map((d) => (
            <div key={d} className="text-center font-bold text-slate-500 py-1.5">{d}</div>
          ))}
          {grid.map((cell, idx) => {
            if (cell.dia === null) {
              return <div key={idx} className="bg-slate-50 rounded h-20"></div>;
            }
            const esHoy = esHoyMes && cell.dia === hoy.getDate();
            const tieneVencidos = cell.gastos.some(g => {
              if (g.estado !== 'pendiente' && g.estado !== 'parcial') return false;
              const f = g.fecha?.toDate?.() ?? new Date(g.fecha as any);
              return !isNaN(f.getTime()) && f < hoy;
            });
            const totalDia = cell.gastos.reduce((a, g) => a + (g.montoPEN || 0), 0);
            const isSelected = diaSeleccionado === cell.dia;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setDiaSeleccionado(cell.dia)}
                className={`rounded p-2 h-20 text-left flex flex-col text-[10px] transition-all relative ${
                  isSelected
                    ? 'bg-amber-100 ring-2 ring-amber-500'
                    : esHoy
                      ? 'bg-amber-50 ring-2 ring-amber-300'
                      : tieneVencidos
                        ? 'bg-rose-50 hover:bg-rose-100 border border-rose-200'
                        : cell.gastos.length > 0
                          ? 'bg-white hover:bg-slate-50 border border-slate-200'
                          : 'bg-slate-50/50 hover:bg-slate-100 border border-transparent'
                }`}
              >
                <div className={`font-bold ${esHoy ? 'text-amber-900' : tieneVencidos ? 'text-rose-900' : 'text-slate-700'}`}>
                  {cell.dia}
                  {esHoy && <span className="ml-1 text-[8px] uppercase tracking-wider">HOY</span>}
                </div>
                {cell.gastos.length > 0 && (
                  <>
                    <div className="text-[9px] text-slate-500 mt-0.5">
                      {cell.gastos.length} gasto{cell.gastos.length > 1 ? 's' : ''}
                    </div>
                    <div className="flex gap-0.5 mt-1">
                      {/* dots por bloque · max 4 */}
                      {cell.gastos.slice(0, 4).map((g, i) => (
                        <span
                          key={i}
                          className={`w-2 h-2 rounded-full ${dotColorByBloque[bloqueDeGasto(g, arbolCategorias)]}`}
                        ></span>
                      ))}
                    </div>
                    <div className="mt-auto text-[9px] tabular-nums font-semibold text-slate-700">
                      {formatPEN(totalDia)}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Panel del dia seleccionado · cards anchored */}
        {diaSeleccionado !== null && gastosDelDia.length > 0 && (
          <div className="mt-5 bg-amber-50 rounded-xl border border-amber-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-amber-700 font-bold">
                  Día {diaSeleccionado} · {MESES_LARGOS[selectedMonth - 1]} {selectedYear}
                </div>
                <div className="text-base font-bold text-amber-900 tabular-nums">
                  {gastosDelDia.length} gasto{gastosDelDia.length > 1 ? 's' : ''} · {formatPEN(totalDelDia)} total
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDiaSeleccionado(null)}
                className="text-xs text-amber-700 hover:text-amber-900 font-medium"
              >
                ✕ Cerrar
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {gastosDelDia.map((g) => {
                const b = bloqueDeGasto(g, arbolCategorias);
                const dotColor = dotColorByBloque[b];
                return (
                  <div
                    key={g.id}
                    className="bg-white rounded-lg border border-amber-100 p-2.5 cursor-pointer hover:shadow-sm transition-shadow"
                    onClick={() => onEditar(g)}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
                        {b === 'producto' ? '📦 Prod.' : b === 'venta' ? '🛒 Venta' : '📅 Per.'}
                      </span>
                      <span className="ml-auto text-[10px] font-bold tabular-nums">{formatPEN(g.montoPEN || 0)}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {g.descripcion || g.tipo || g.numeroGasto}
                    </div>
                    {(g.proveedor || g.proveedorNombre) && (
                      <div className="text-[10px] text-slate-500 truncate">{g.proveedor || g.proveedorNombre}</div>
                    )}
                    {(g.estado === 'pendiente' || g.estado === 'parcial') && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPagar(g);
                        }}
                        className="mt-1.5 w-full text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold py-1 rounded"
                      >
                        Pagar →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {diaSeleccionado !== null && gastosDelDia.length === 0 && (
          <div className="mt-5 bg-slate-50 rounded-xl border border-slate-200 p-4 text-center text-sm text-slate-500 italic">
            No hay gastos registrados el día {diaSeleccionado}.
          </div>
        )}
      </div>
    </div>
  );
};
