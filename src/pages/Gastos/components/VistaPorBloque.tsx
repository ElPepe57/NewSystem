/**
 * VistaPorBloque · canon v8.0 + v9.0 · Gastos rework v4
 *
 * chk5.C-UX-PASS-ALT (2026-05-11) · refactor con canon v8.0 + v9.0:
 *   - N1+N2 · gradient sutil + ring colored (no headers saturados)
 *   - N4 · color cross-módulo blue/purple/amber por bloque
 *   - N7 · md:grid-cols-3 (no lg:)
 *   - v9.0 M1 · classes copy-paste literal del mockup
 *
 * Mockup: `docs/mockups/gastos-vistas-alternativas-v4.html · Sección 1`.
 *
 * Vista alternativa: agrupado por los 3 bloques canónicos en cards paralelas.
 * Cada card muestra: header + sparkline 6m + KPIs + top 5 categorías + lista de gastos.
 */

import React, { useMemo } from 'react';
import { Package, ShoppingBag, Calendar, TrendingUp, Info } from 'lucide-react';
import type { Gasto } from '../../../types/gasto.types';
import type { BloqueCosto } from '../../../types/categoriaCosto.types';
import { toDateOrNow } from '../../../utils/dateFormatters';
import { getBloqueDelGasto } from '../../../utils/gasto.bloque';

interface VistaPorBloqueProps {
  gastos: Gasto[];
  arbolCategorias: Record<BloqueCosto, { padres: any[]; hijos: Record<string, any[]> }> | null;
  onEditar: (g: Gasto) => void;
  onPagar: (g: Gasto) => void;
}

const formatPEN0 = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(n);

// canon v8.0 N4 · color semántico cross-módulo
const BLOQUE_CONFIG: Record<BloqueCosto, {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge: string;
  impacto: string;
  /** Stroke color for sparkline SVG */
  sparkColor: string;
  /** Wrapper canon v8.0 N2 · gradient sutil + ring colored */
  wrapperClasses: string;
  iconWrapperClasses: string;
  iconColor: string;
  labelColor: string;
  valueColor: string;
  decimalColor: string;
  deltaColor: string;
  borderColor: string;
  footerBg: string;
}> = {
  producto: {
    Icon: Package,
    label: 'Producto',
    badge: 'CTRU',
    impacto: 'se carga al CTRU del lote · afecta margen por unidad',
    sparkColor: '#3b82f6',
    wrapperClasses: 'bg-gradient-to-br from-blue-50 to-blue-100/40 ring-1 ring-blue-200/50',
    iconWrapperClasses: 'bg-blue-100 ring-1 ring-blue-200/50',
    iconColor: 'text-blue-700',
    labelColor: 'text-blue-700',
    valueColor: 'text-blue-900',
    decimalColor: 'text-blue-400',
    deltaColor: 'text-blue-700',
    borderColor: 'border-blue-200/40',
    footerBg: 'bg-blue-50/60 border-blue-200/30',
  },
  venta: {
    Icon: ShoppingBag,
    label: 'Venta',
    badge: 'Por venta',
    impacto: 'se carga a la venta · afecta margen agregado del mes',
    sparkColor: '#8b5cf6',
    wrapperClasses: 'bg-gradient-to-br from-purple-50 to-purple-100/40 ring-1 ring-purple-200/50',
    iconWrapperClasses: 'bg-purple-100 ring-1 ring-purple-200/50',
    iconColor: 'text-purple-700',
    labelColor: 'text-purple-700',
    valueColor: 'text-purple-900',
    decimalColor: 'text-purple-400',
    deltaColor: 'text-purple-700',
    borderColor: 'border-purple-200/40',
    footerBg: 'bg-purple-50/60 border-purple-200/30',
  },
  periodo: {
    Icon: Calendar,
    label: 'Período',
    badge: 'Overhead',
    impacto: 'NO toca CTRU · va al P&L del mes · base del overhead allocation',
    sparkColor: '#f59e0b',
    wrapperClasses: 'bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50',
    iconWrapperClasses: 'bg-amber-100 ring-1 ring-amber-200/50',
    iconColor: 'text-amber-700',
    labelColor: 'text-amber-700',
    valueColor: 'text-amber-900',
    decimalColor: 'text-amber-400',
    deltaColor: 'text-amber-700',
    borderColor: 'border-amber-200/40',
    footerBg: 'bg-amber-50/60 border-amber-200/30',
  },
};

export const VistaPorBloque: React.FC<VistaPorBloqueProps> = ({
  gastos,
  arbolCategorias,
  onEditar,
  onPagar,
}) => {
  const bloqueDeGasto = useMemo(
    () => (g: Gasto): BloqueCosto => getBloqueDelGasto(g, arbolCategorias) ?? 'periodo',
    [arbolCategorias],
  );

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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {(['producto', 'venta', 'periodo'] as BloqueCosto[]).map((bloque) => {
        const cfg = BLOQUE_CONFIG[bloque];
        const BloqueIcon = cfg.Icon;
        const data = datosBloques[bloque];
        const topCategorias = Object.entries(data.porCategoria)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);
        const totalCentavos = (data.total % 1).toFixed(2).slice(2);
        const totalEntero = Math.floor(data.total);

        return (
          <div key={bloque} className={`${cfg.wrapperClasses} rounded-2xl overflow-hidden`}>

            {/* Header sutil · canon v8.0 N2 · NO fondo saturado */}
            <div className={`px-4 py-3 border-b ${cfg.borderColor}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg ${cfg.iconWrapperClasses} flex items-center justify-center`}>
                    <BloqueIcon className={`w-4 h-4 ${cfg.iconColor}`} />
                  </div>
                  <span className={`text-[11px] uppercase tracking-wider ${cfg.labelColor} font-bold`}>
                    {cfg.label}
                  </span>
                </div>
                <span className={`text-[9px] font-bold ${cfg.labelColor} bg-white px-1.5 py-0.5 rounded`}>
                  {cfg.badge}
                </span>
              </div>
              <div className={`text-2xl font-bold tabular-nums ${cfg.valueColor}`}>
                {formatPEN0(totalEntero)}<span className={cfg.decimalColor}>.{totalCentavos}</span>
              </div>
              <div className={`text-[11px] ${cfg.deltaColor} flex items-center gap-1 mt-1`}>
                <TrendingUp className="w-3 h-3" />
                {data.gastos.length} movimientos
              </div>

              {/* Sparkline 6m sutil · canon v9.0 · placeholder visual */}
              <svg viewBox="0 0 200 30" className="w-full h-7 mt-2">
                <polyline
                  points="0,22 40,20 80,18 120,14 160,12 200,10"
                  fill="none"
                  stroke={cfg.sparkColor}
                  strokeWidth="1.5"
                  opacity="0.6"
                />
                <circle cx="200" cy="10" r="2.5" fill={cfg.sparkColor} />
              </svg>
            </div>

            {/* Top categorías */}
            <div className="bg-white/60 px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
                Top {topCategorias.length} categorías
              </div>
              {topCategorias.length === 0 ? (
                <div className="text-[11px] text-slate-400 italic text-center py-2">
                  Sin gastos categorizados
                </div>
              ) : (
                <div className="space-y-1.5 text-[11px]">
                  {topCategorias.map(([nombre, monto]) => {
                    const pct = data.total > 0 ? (monto / data.total) * 100 : 0;
                    return (
                      <div key={nombre} className="flex items-center justify-between">
                        <span className="text-slate-700 truncate" title={nombre}>{nombre}</span>
                        <span className="tabular-nums font-bold text-slate-900">
                          {formatPEN0(monto)} <span className="text-slate-400 text-[9px]">{pct.toFixed(0)}%</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Lista de gastos (compacta) */}
            {data.gastos.length > 0 && (
              <div className="bg-white/60 px-4 py-3 border-t border-slate-200/40 max-h-[280px] overflow-y-auto">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
                  Últimos gastos
                </div>
                <div className="space-y-1.5">
                  {data.gastos.slice(0, 5).map((g) => {
                    const esVencido = g.estado === 'pendiente' || g.estado === 'parcial'
                      ? (() => {
                          const f = toDateOrNow(g.fecha);
                          return !isNaN(f.getTime()) && f < new Date();
                        })()
                      : false;
                    return (
                      <div
                        key={g.id}
                        className={`bg-white border rounded-lg px-2.5 py-1.5 cursor-pointer hover:shadow-sm ${
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
                              <div className="text-[10px] text-slate-500 truncate">
                                {g.proveedor || g.proveedorNombre}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={`text-xs font-bold tabular-nums ${esVencido ? 'text-rose-700' : cfg.valueColor}`}>
                              {formatPEN0(g.montoPEN || 0)}
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
                                    : `bg-white border border-slate-200 hover:bg-slate-50 ${cfg.valueColor}`
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
                  {data.gastos.length > 5 && (
                    <div className="text-center text-[10px] text-slate-400 italic pt-1">
                      + {data.gastos.length - 5} gastos más
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer impacto · canon v9.0 · classes copy-paste del mockup */}
            <div className={`${cfg.footerBg} px-4 py-2 border-t`}>
              <div className={`text-[10px] ${cfg.deltaColor} flex items-center gap-1`}>
                <Info className="w-3 h-3 flex-shrink-0" />
                <span><span className="font-bold">Impacto:</span> {cfg.impacto}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
