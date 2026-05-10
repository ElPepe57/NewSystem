/**
 * VistaPorBloque · TAREA-GASTOS-PAGE-V2 F3.b
 *
 * Vista alternativa del listado de gastos · agrupado por los 3 bloques
 * canonicos (Importacion · Venta · Periodo) en columnas paralelas.
 * Cada columna muestra:
 *  - Header con gradient + KPIs (total + count) + descripcion
 *  - Top categorias del bloque con monto
 *  - Mini-cards de gastos recientes con CTA inline
 */

import React, { useMemo } from 'react';
import type { Gasto } from '../../../types/gasto.types';
import type { BloqueCosto } from '../../../types/categoriaCosto.types';

interface VistaPorBloqueProps {
  gastos: Gasto[];
  arbolCategorias: Record<BloqueCosto, { padres: any[]; hijos: Record<string, any[]> }> | null;
  onEditar: (g: Gasto) => void;
  onPagar: (g: Gasto) => void;
}

const formatPEN = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(n);

const BLOQUE_CONFIG: Record<BloqueCosto, {
  emoji: string;
  label: string;
  gradient: string;
  bgLight: string;
  textColor: string;
  ringColor: string;
  badge: string;
  descripcion: string;
}> = {
  producto: {
    emoji: '📦',
    label: 'Producto',
    gradient: 'from-blue-600 to-indigo-600',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-900',
    ringColor: 'ring-blue-200',
    badge: 'CAJA 1 · CTRU',
    descripcion: 'Costos directos de traer producto',
  },
  venta: {
    emoji: '🛒',
    label: 'Venta',
    gradient: 'from-purple-600 to-fuchsia-600',
    bgLight: 'bg-purple-50',
    textColor: 'text-purple-900',
    ringColor: 'ring-purple-200',
    badge: 'CAJA 2 · MARGEN',
    descripcion: 'Costos directos por cada venta',
  },
  periodo: {
    emoji: '📅',
    label: 'Período',
    gradient: 'from-amber-500 to-orange-600',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-900',
    ringColor: 'ring-amber-200',
    badge: 'CAJA 3 · OPERATIVO',
    descripcion: 'Gastos fijos del mes',
  },
};

export const VistaPorBloque: React.FC<VistaPorBloqueProps> = ({
  gastos,
  arbolCategorias,
  onEditar,
  onPagar,
}) => {
  const bloqueDeGasto = useMemo(() => (g: Gasto): BloqueCosto => {
    if (g.categoriaCostoId && arbolCategorias) {
      for (const b of ['producto', 'venta', 'periodo'] as BloqueCosto[]) {
        const datos = arbolCategorias[b];
        if (!datos) continue;
        if (datos.padres.some(p => p.id === g.categoriaCostoId)) return b;
        for (const padreId of Object.keys(datos.hijos)) {
          if (datos.hijos[padreId].some((h: any) => h.id === g.categoriaCostoId)) return b;
        }
      }
    }
    if (g.categoria === 'GA') return 'producto';
    if (g.categoria === 'GD' || g.categoria === 'GV') return 'venta';
    return 'periodo';
  }, [arbolCategorias]);

  const datosBloques = useMemo(() => {
    const out: Record<BloqueCosto, {
      gastos: Gasto[];
      total: number;
      porCategoria: Record<string, number>;
    }> = {
      producto: { gastos: [], total: 0, porCategoria: {} },
      venta: { gastos: [], total: 0, porCategoria: {} },
      periodo: { gastos: [], total: 0, porCategoria: {} },
    };
    for (const g of gastos) {
      const b = bloqueDeGasto(g);
      out[b].gastos.push(g);
      out[b].total += g.montoPEN || 0;
      // categoria padre nombre
      let catNombre = 'Sin categorizar';
      if (g.categoriaCostoId && arbolCategorias) {
        const datos = arbolCategorias[b];
        if (datos) {
          const padre = datos.padres.find(p => p.id === g.categoriaCostoId);
          if (padre) catNombre = padre.nombre;
          else {
            for (const padreId of Object.keys(datos.hijos)) {
              if (datos.hijos[padreId].some((h: any) => h.id === g.categoriaCostoId)) {
                const padreObj = datos.padres.find(p => p.id === padreId);
                catNombre = padreObj?.nombre || catNombre;
                break;
              }
            }
          }
        }
      }
      out[b].porCategoria[catNombre] = (out[b].porCategoria[catNombre] || 0) + (g.montoPEN || 0);
    }
    // Sort gastos by fecha desc
    for (const b of Object.keys(out) as BloqueCosto[]) {
      out[b].gastos.sort((a, c) => {
        const fa = a.fecha?.toDate?.()?.getTime() ?? 0;
        const fc = c.fecha?.toDate?.()?.getTime() ?? 0;
        return fc - fa;
      });
    }
    return out;
  }, [gastos, bloqueDeGasto, arbolCategorias]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {(['producto', 'venta', 'periodo'] as BloqueCosto[]).map((bloque) => {
        const cfg = BLOQUE_CONFIG[bloque];
        const data = datosBloques[bloque];
        const topCategorias = Object.entries(data.porCategoria)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);

        return (
          <div key={bloque} className={`bg-white rounded-2xl border ring-1 ${cfg.ringColor} overflow-hidden shadow-sm flex flex-col`}>
            {/* Header gradient */}
            <div className={`bg-gradient-to-br ${cfg.gradient} text-white px-4 py-3 relative`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-3xl">{cfg.emoji}</span>
                <span className="bg-white/20 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">
                  {cfg.badge}
                </span>
              </div>
              <div className="text-xl font-bold">{cfg.label}</div>
              <div className="text-xs text-white/80 mt-0.5">{cfg.descripcion}</div>
            </div>

            {/* KPIs */}
            <div className={`${cfg.bgLight} px-4 py-3 grid grid-cols-2 gap-3`}>
              <div>
                <div className="text-[10px] uppercase tracking-wider opacity-70 font-bold">Total</div>
                <div className={`text-xl font-bold tabular-nums ${cfg.textColor}`}>
                  {formatPEN(data.total)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider opacity-70 font-bold">Gastos</div>
                <div className={`text-xl font-bold tabular-nums ${cfg.textColor}`}>{data.gastos.length}</div>
              </div>
            </div>

            {/* Top categorias del bloque */}
            {topCategorias.length > 0 && (
              <div className={`${cfg.bgLight} px-4 py-2 border-t border-white/40`}>
                <div className="text-[10px] uppercase tracking-wider opacity-70 font-bold mb-1.5">
                  Top {topCategorias.length} categorías
                </div>
                <div className="space-y-1">
                  {topCategorias.map(([nombre, monto]) => {
                    const pct = data.total > 0 ? (monto / data.total) * 100 : 0;
                    return (
                      <div key={nombre} className="flex items-center justify-between text-[11px]">
                        <span className={`${cfg.textColor} font-semibold truncate flex-1`} title={nombre}>{nombre}</span>
                        <span className={`${cfg.textColor} font-bold tabular-nums ml-2`}>
                          {formatPEN(monto)}
                        </span>
                        <span className="opacity-60 ml-2 tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Lista de gastos del bloque · max 8 */}
            <div className="flex-1 px-4 py-3 space-y-1.5 max-h-[400px] overflow-y-auto">
              {data.gastos.length === 0 ? (
                <div className="text-center text-xs text-slate-400 italic py-4">
                  Sin gastos en este bloque
                </div>
              ) : (
                <>
                  {data.gastos.slice(0, 8).map((g) => {
                    const esVencido = g.estado === 'pendiente' || g.estado === 'parcial'
                      ? (() => {
                          const f = g.fecha?.toDate?.() ?? new Date(g.fecha as any);
                          return !isNaN(f.getTime()) && f < new Date();
                        })()
                      : false;
                    return (
                      <div
                        key={g.id}
                        className={`bg-white border rounded-lg px-2.5 py-1.5 cursor-pointer hover:shadow-sm transition-shadow ${
                          esVencido ? 'border-rose-300' : 'border-slate-200'
                        }`}
                        onClick={() => onEditar(g)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {g.descripcion || g.tipo || g.numeroGasto}
                            </div>
                            {(g.proveedor || g.proveedorNombre) && (
                              <div className="text-[10px] text-slate-500 truncate">{g.proveedor || g.proveedorNombre}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={`text-xs font-bold tabular-nums ${esVencido ? 'text-rose-700' : cfg.textColor}`}>
                              {formatPEN(g.montoPEN || 0)}
                            </div>
                            {(g.estado === 'pendiente' || g.estado === 'parcial') && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPagar(g);
                                }}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                                  esVencido
                                    ? 'bg-rose-600 text-white animate-pulse'
                                    : `bg-white border border-slate-200 hover:bg-slate-50 ${cfg.textColor}`
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
                  {data.gastos.length > 8 && (
                    <div className="text-center text-[10px] text-slate-400 italic pt-1">
                      + {data.gastos.length - 8} gastos más
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
