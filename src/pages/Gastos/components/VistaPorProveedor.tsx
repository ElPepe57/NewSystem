/**
 * VistaPorProveedor · TAREA-GASTOS-PAGE-V2 F3.b
 *
 * Vista alternativa: lista agrupada por proveedor con sparkline 12m
 * por proveedor. Click expande lista de gastos del proveedor.
 */

import React, { useMemo, useState } from 'react';
import type { Gasto } from '../../../types/gasto.types';

interface VistaPorProveedorProps {
  gastos: Gasto[];
  onEditar: (g: Gasto) => void;
  onPagar: (g: Gasto) => void;
}

const formatPEN = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(n);

const formatFecha = (timestamp: any): string => {
  const fecha = timestamp?.toDate?.() ?? new Date(timestamp);
  if (isNaN(fecha.getTime())) return '-';
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${fecha.getDate()} ${meses[fecha.getMonth()]}`;
};

export const VistaPorProveedor: React.FC<VistaPorProveedorProps> = ({
  gastos,
  onEditar,
  onPagar,
}) => {
  const [expandido, setExpandido] = useState<string | null>(null);

  const datosProveedores = useMemo(() => {
    const ahora = new Date();
    const inicio12m = new Date(ahora.getFullYear(), ahora.getMonth() - 11, 1);

    const map: Record<string, {
      key: string;
      nombre: string;
      ruc?: string;
      gastos: Gasto[];
      total12m: number;
      pendientes: number;
      cantidad12m: number;
      gastosPorMes: number[]; // 12 meses
    }> = {};

    for (const g of gastos) {
      const fecha = g.fecha?.toDate?.() ?? new Date(g.fecha as any);
      const key = g.proveedorId || (g.proveedor || g.proveedorNombre || 'sin_proveedor');
      const nombre = g.proveedorNombre || g.proveedor || 'Sin proveedor';
      if (!map[key]) {
        map[key] = {
          key,
          nombre,
          gastos: [],
          total12m: 0,
          pendientes: 0,
          cantidad12m: 0,
          gastosPorMes: Array(12).fill(0),
        };
      }
      map[key].gastos.push(g);
      if (g.estado === 'pendiente' || g.estado === 'parcial') {
        map[key].pendientes += (g.montoPEN || 0) - (g.montoPagado || 0);
      }
      // Solo dentro de los 12m para tendencia y total12m
      if (fecha >= inicio12m) {
        map[key].total12m += g.montoPEN || 0;
        map[key].cantidad12m += 1;
        const diff = (ahora.getFullYear() - fecha.getFullYear()) * 12 + (ahora.getMonth() - fecha.getMonth());
        const bucket = 11 - diff;
        if (bucket >= 0 && bucket < 12) {
          map[key].gastosPorMes[bucket] += g.montoPEN || 0;
        }
      }
    }

    // Sort gastos por fecha desc
    for (const k of Object.keys(map)) {
      map[k].gastos.sort((a, b) => {
        const fa = a.fecha?.toDate?.()?.getTime() ?? 0;
        const fb = b.fecha?.toDate?.()?.getTime() ?? 0;
        return fb - fa;
      });
    }

    return Object.values(map).sort((a, b) => b.total12m - a.total12m);
  }, [gastos]);

  const totalGeneral12m = datosProveedores.reduce((acc, p) => acc + p.total12m, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-700 font-bold">Vista agrupada por proveedor</div>
          <div className="text-sm font-semibold text-slate-900 mt-0.5">
            {datosProveedores.length} proveedores · {formatPEN(totalGeneral12m)} en 12 meses
          </div>
        </div>
        <div className="text-[11px] text-slate-500 italic">Click en una fila para expandir gastos del proveedor</div>
      </div>

      {/* Lista de proveedores */}
      <div className="divide-y divide-slate-100">
        {datosProveedores.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 italic">
            No hay gastos con proveedores registrados.
          </div>
        ) : (
          datosProveedores.map((p, idx) => {
            const maxMes = Math.max(...p.gastosPorMes, 1);
            const pct = totalGeneral12m > 0 ? (p.total12m / totalGeneral12m) * 100 : 0;
            const isExp = expandido === p.key;
            return (
              <div key={p.key}>
                {/* Fila resumen */}
                <button
                  type="button"
                  onClick={() => setExpandido(isExp ? null : p.key)}
                  className="w-full px-4 py-3 hover:bg-slate-50 transition-colors text-left flex items-center gap-3"
                >
                  <div className="w-8 text-center text-base font-bold text-slate-400 tabular-nums">#{idx + 1}</div>
                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {p.nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{p.nombre}</div>
                    <div className="text-[11px] text-slate-500">
                      {p.cantidad12m} en 12m · {p.gastos.length} histórico · {pct.toFixed(1)}% del total
                    </div>
                  </div>
                  {/* Sparkline 12m */}
                  <div className="hidden md:flex items-end gap-0.5 h-10" style={{ width: '160px' }}>
                    {p.gastosPorMes.map((monto, i) => {
                      const altPct = (monto / maxMes) * 100;
                      return (
                        <div
                          key={i}
                          className="flex-1 bg-blue-200 hover:bg-blue-400 transition-colors rounded-sm"
                          style={{ height: `${Math.max(altPct, 2)}%` }}
                          title={`${formatPEN(monto)}`}
                        ></div>
                      );
                    })}
                  </div>
                  <div className="text-right min-w-[100px]">
                    <div className="text-sm font-bold tabular-nums text-blue-700">{formatPEN(p.total12m)}</div>
                    {p.pendientes > 0 ? (
                      <div className="text-[10px] text-rose-600 font-bold tabular-nums">
                        {formatPEN(p.pendientes)} pdte
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400">12m</div>
                    )}
                  </div>
                  <span className={`text-slate-400 text-base transition-transform ${isExp ? 'rotate-180' : ''}`}>⌃</span>
                </button>

                {/* Lista expandida de gastos del proveedor */}
                {isExp && (
                  <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
                    <div className="text-[10px] uppercase tracking-wider text-slate-600 font-bold mb-2">
                      Histórico · {p.gastos.length} gastos
                    </div>
                    <div className="space-y-1.5 max-h-80 overflow-y-auto">
                      {p.gastos.map((g) => {
                        const esPdte = g.estado === 'pendiente' || g.estado === 'parcial';
                        const f = g.fecha?.toDate?.() ?? new Date(g.fecha as any);
                        const esVencido = esPdte && !isNaN(f.getTime()) && f < new Date();
                        return (
                          <div
                            key={g.id}
                            className={`bg-white rounded-lg border px-3 py-2 cursor-pointer hover:shadow-sm transition-shadow ${
                              esVencido ? 'border-rose-300' : 'border-slate-200'
                            }`}
                            onClick={() => onEditar(g)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-slate-900 truncate">
                                  {g.descripcion || g.tipo || g.numeroGasto}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {formatFecha(g.fecha)} · {g.estado}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`text-xs font-bold tabular-nums ${esVencido ? 'text-rose-700' : 'text-slate-900'}`}>
                                  {formatPEN(g.montoPEN || 0)}
                                </div>
                                {esPdte && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onPagar(g);
                                    }}
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                                      esVencido
                                        ? 'bg-rose-600 text-white animate-pulse'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {esVencido ? 'Pagar HOY' : 'Pagar'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
