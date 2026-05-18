/**
 * VistaPorProveedor · canon v8.0 + v9.0 · Gastos rework v4
 *
 * chk5.C-UX-PASS-ALT (2026-05-11) · refactor con canon v8.0 + v9.0:
 *   - N1+N2 · avatar con gradient sutil + ring según bloque dominante
 *   - N4 · chip de bloque al lado del nombre (Producto/Venta/Período)
 *   - F8 · iconos lucide (ChevronUp/Down, no `⌃`)
 *   - v9.0 M1 · classes copy-paste literal del mockup
 *
 * Mockup: `docs/mockups/gastos-vistas-alternativas-v4.html · Sección 3`.
 *
 * Vista: lista de proveedores con sparkline 12m por proveedor + expandible.
 */

import React, { useMemo, useState } from 'react';
import {
  Package, ShoppingBag, Calendar,
  ChevronUp, ChevronDown, TrendingUp, Minus, Check, Clock,
} from 'lucide-react';
import type { Gasto } from '../../../types/gasto.types';
import type { BloqueCosto } from '../../../types/categoriaCosto.types';
import { toDateOrNow } from '../../../utils/dateFormatters';
import { getBloqueDelGasto } from '../../../utils/gasto.bloque';

interface VistaPorProveedorProps {
  gastos: Gasto[];
  arbolCategorias: Record<BloqueCosto, { padres: any[]; hijos: Record<string, any[]> }> | null;
  onEditar: (g: Gasto) => void;
  onPagar: (g: Gasto) => void;
}

const formatPEN0 = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(n);

const formatFecha = (timestamp: any): string => {
  const fecha = timestamp?.toDate?.() ?? new Date(timestamp);
  if (isNaN(fecha.getTime())) return '-';
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${fecha.getDate()} ${meses[fecha.getMonth()]}`;
};

// canon v8.0 N4 · config visual por bloque dominante del proveedor
const BLOQUE_CONFIG: Record<BloqueCosto, {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  avatarClasses: string;
  avatarTextColor: string;
  chipClasses: string;
  sparkColor: string;
  bgExpandido: string;
  borderExpandidoCard: string;
}> = {
  producto: {
    Icon: Package,
    label: 'Producto',
    avatarClasses: 'bg-gradient-to-br from-blue-50 to-blue-100 ring-1 ring-blue-200/50',
    avatarTextColor: 'text-blue-700',
    chipClasses: 'bg-blue-100 text-blue-700',
    sparkColor: '#3b82f6',
    bgExpandido: 'bg-blue-50/20',
    borderExpandidoCard: 'border-blue-100',
  },
  venta: {
    Icon: ShoppingBag,
    label: 'Venta',
    avatarClasses: 'bg-gradient-to-br from-purple-50 to-purple-100 ring-1 ring-purple-200/50',
    avatarTextColor: 'text-purple-700',
    chipClasses: 'bg-purple-100 text-purple-700',
    sparkColor: '#8b5cf6',
    bgExpandido: 'bg-purple-50/20',
    borderExpandidoCard: 'border-purple-100',
  },
  periodo: {
    Icon: Calendar,
    label: 'Período',
    avatarClasses: 'bg-gradient-to-br from-amber-50 to-amber-100 ring-1 ring-amber-200/50',
    avatarTextColor: 'text-amber-700',
    chipClasses: 'bg-amber-100 text-amber-700',
    sparkColor: '#f59e0b',
    bgExpandido: 'bg-amber-50/20',
    borderExpandidoCard: 'border-amber-100',
  },
};

export const VistaPorProveedor: React.FC<VistaPorProveedorProps> = ({
  gastos,
  arbolCategorias,
  onEditar,
  onPagar,
}) => {
  const [expandido, setExpandido] = useState<string | null>(null);

  const datosProveedores = useMemo(() => {
    const ahora = new Date();
    const inicio12m = new Date(ahora.getFullYear(), ahora.getMonth() - 11, 1);
    const inicio3m = new Date(ahora.getFullYear(), ahora.getMonth() - 2, 1);

    const map: Record<string, {
      key: string;
      nombre: string;
      gastos: Gasto[];
      total12m: number;
      total3m: number;
      total3mAnt: number; // meses 4-6 atrás para delta
      pendientes: number;
      cantidad12m: number;
      gastosPorMes: number[];
      bloquesPorMonto: Record<BloqueCosto, number>;
    }> = {};

    for (const g of gastos) {
      const fecha = toDateOrNow(g.fecha);
      const key = g.proveedorId || (g.proveedor || g.proveedorNombre || 'sin_proveedor');
      const nombre = g.proveedorNombre || g.proveedor || 'Sin proveedor';
      if (!map[key]) {
        map[key] = {
          key,
          nombre,
          gastos: [],
          total12m: 0,
          total3m: 0,
          total3mAnt: 0,
          pendientes: 0,
          cantidad12m: 0,
          gastosPorMes: Array(12).fill(0),
          bloquesPorMonto: { producto: 0, venta: 0, periodo: 0 },
        };
      }
      map[key].gastos.push(g);
      if (g.estado === 'pendiente' || g.estado === 'parcial') {
        map[key].pendientes += (g.montoPEN || 0) - (g.montoPagado || 0);
      }
      if (fecha >= inicio12m) {
        const monto = g.montoPEN || 0;
        map[key].total12m += monto;
        map[key].cantidad12m += 1;
        const bloque = getBloqueDelGasto(g, arbolCategorias) ?? 'periodo';
        map[key].bloquesPorMonto[bloque] += monto;
        const diff = (ahora.getFullYear() - fecha.getFullYear()) * 12 + (ahora.getMonth() - fecha.getMonth());
        const bucket = 11 - diff;
        if (bucket >= 0 && bucket < 12) {
          map[key].gastosPorMes[bucket] += monto;
        }
        if (fecha >= inicio3m) map[key].total3m += monto;
        else if (diff >= 3 && diff < 6) map[key].total3mAnt += monto;
      }
    }

    for (const k of Object.keys(map)) {
      map[k].gastos.sort((a, b) => {
        const fa = a.fecha?.toDate?.()?.getTime() ?? 0;
        const fb = b.fecha?.toDate?.()?.getTime() ?? 0;
        return fb - fa;
      });
    }

    return Object.values(map).sort((a, b) => b.total12m - a.total12m);
  }, [gastos, arbolCategorias]);

  // Sparkline SVG · genera path desde array de 12 valores
  const buildSparkline = (data: number[], color: string): React.ReactNode => {
    const max = Math.max(...data, 1);
    const w = 200;
    const h = 30;
    const stepX = w / (data.length - 1);
    const points = data.map((v, i) => {
      const x = i * stepX;
      const y = h - (v / max) * (h - 4) - 2;
      return `${x},${y.toFixed(1)}`;
    }).join(' ');
    const lastX = (data.length - 1) * stepX;
    const lastY = h - (data[data.length - 1] / max) * (h - 4) - 2;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-32 h-7 flex-shrink-0">
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" opacity="0.6" />
        <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
      </svg>
    );
  };

  if (datosProveedores.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200/50 flex items-center justify-center mb-3">
          <Package className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">Sin proveedores registrados</h3>
        <p className="text-xs text-slate-500 mt-1">
          Cuando registres gastos vinculados a proveedores, aparecerán acá agrupados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {datosProveedores.map((p) => {
        // Bloque dominante por monto 12m
        const bloqueDom: BloqueCosto = (Object.entries(p.bloquesPorMonto)
          .sort(([, a], [, b]) => b - a)[0][0]) as BloqueCosto;
        const cfg = BLOQUE_CONFIG[bloqueDom];
        const BloqueIcon = cfg.Icon;

        // Delta % vs 3m anteriores
        const deltaPct = p.total3mAnt > 0
          ? ((p.total3m - p.total3mAnt) / p.total3mAnt) * 100
          : 0;
        const deltaUp = deltaPct > 0;
        const deltaDown = deltaPct < 0;

        const isExp = expandido === p.key;
        const iniciales = p.nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase().slice(0, 2);

        return (
          <div key={p.key} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setExpandido(isExp ? null : p.key)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
            >
              {/* Avatar con tinte semántico · canon v8.0 N1+N2 */}
              <div className={`w-10 h-10 rounded-xl ${cfg.avatarClasses} flex items-center justify-center font-bold text-sm ${cfg.avatarTextColor} flex-shrink-0`}>
                {iniciales}
              </div>

              {/* Info principal */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{p.nombre}</span>
                  <span className={`text-[9px] font-bold ${cfg.chipClasses} px-1.5 py-0.5 rounded inline-flex items-center gap-0.5`}>
                    <BloqueIcon className="w-2.5 h-2.5" />
                    {cfg.label}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  {p.cantidad12m} gasto{p.cantidad12m !== 1 ? 's' : ''} últimos 12m
                  {p.pendientes > 0 && (
                    <span className="text-rose-600 font-medium"> · {formatPEN0(p.pendientes)} pendiente</span>
                  )}
                </div>
              </div>

              {/* Sparkline 12m */}
              {buildSparkline(p.gastosPorMes, cfg.sparkColor)}

              {/* Total 12m + delta */}
              <div className="text-right flex-shrink-0">
                <div className="text-base font-bold tabular-nums text-slate-900">
                  {formatPEN0(p.total12m)}
                </div>
                <div className={`text-[10px] flex items-center gap-0.5 justify-end ${cfg.avatarTextColor}`}>
                  {deltaUp ? <TrendingUp className="w-2.5 h-2.5" />
                    : deltaDown ? <ChevronDown className="w-2.5 h-2.5" />
                    : <Minus className="w-2.5 h-2.5" />}
                  {deltaUp ? '+' : ''}{deltaPct.toFixed(0)}% últ. 3m
                </div>
              </div>

              {/* Chevron expand */}
              {isExp
                ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
            </button>

            {/* Contenido expandido · canon v8.0 N1 · tinte del bloque dominante */}
            {isExp && (
              <div className={`border-t border-slate-100 ${cfg.bgExpandido} px-4 py-3`}>
                <div className={`text-[10px] uppercase tracking-wider ${cfg.avatarTextColor} font-bold mb-2`}>
                  Últimos gastos · {p.gastos.length} total
                </div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {p.gastos.slice(0, 10).map((g) => {
                    const esPdte = g.estado === 'pendiente' || g.estado === 'parcial';
                    const f = toDateOrNow(g.fecha);
                    const esVencido = esPdte && !isNaN(f.getTime()) && f < new Date();
                    return (
                      <div
                        key={g.id}
                        className={`flex items-center justify-between bg-white border ${esVencido ? 'border-rose-300' : cfg.borderExpandidoCard} rounded-lg px-3 py-2 cursor-pointer hover:shadow-sm transition-shadow`}
                        onClick={() => onEditar(g)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-[10px] text-slate-400 tabular-nums">{formatFecha(g.fecha)}</span>
                          <span className="text-xs font-medium text-slate-900 truncate">
                            {g.descripcion || g.tipo || g.numeroGasto}
                          </span>
                        </div>
                        <span className={`text-xs font-bold tabular-nums ${esVencido ? 'text-rose-700' : 'text-slate-900'}`}>
                          {formatPEN0(g.montoPEN || 0)}
                        </span>
                        {/* Chip estado */}
                        {g.estado === 'pagado' ? (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded ml-2 inline-flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> Pagado
                          </span>
                        ) : esPdte ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPagar(g);
                            }}
                            className={`text-[9px] font-bold ml-2 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 ${
                              esVencido
                                ? 'bg-rose-600 text-white animate-pulse'
                                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            }`}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            {esVencido ? 'Pagar HOY' : 'Pagar'}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {p.gastos.length > 10 && (
                  <div className={`mt-2 text-[10px] ${cfg.avatarTextColor} hover:opacity-80 font-medium`}>
                    + {p.gastos.length - 10} gastos más en el histórico
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
