/**
 * TabHistorico · Tab "Histórico" del modal detalle producto
 *
 * Mockup canónico: docs/mockups/productos/15b-modal-detalle-historico.html
 *
 * Estructura:
 *   1. Chart área ventas + línea stock disponible (esqueleto · pendiente data agregada)
 *   2. Lista movimientos REALES agrupados por documento (OC/Venta/Transferencia)
 *      derivados de unidades.movimientos[] filtrado por productoId.
 *
 * Implementación · Fase H+ (post mock):
 *   - Query unidades por productoId vía unidadService.buscar({ productoId })
 *   - Aplanar todos los movimientos[] de cada unidad
 *   - Agrupar por documentoRelacionado.id (1 fila por OC/Venta) sumando uds
 *   - Si la unidad no tiene documento (ej. ajuste manual), 1 fila por unidad
 *   - Ordenar por fecha descendente · mostrar últimos 30
 *
 * Chart de líneas: queda como ESQUELETO sin data hasta integración con
 * agregaciones BI (ventas por mes + stock por mes desde snapshots).
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  Clock,
  ArrowDown,
  ArrowUp,
  ArrowRightLeft,
  ShoppingCart,
  Download,
  Package,
  AlertCircle,
} from 'lucide-react';
import type { Producto } from '../../../../types/producto.types';
import type { Unidad, MovimientoUnidad } from '../../../../types/unidad.types';
import { unidadService } from '../../../../services/unidad.service';
import { toDateOrNow, toMillisSafe } from '../../../../utils/dateFormatters';

interface TabHistoricoProps {
  producto: Producto;
  onExportar?: () => void;
}

type RangoTemporal = '3m' | '6m' | '1A' | 'todo';

interface MovimientoAgrupado {
  id: string;                                    // hash del documento o unidadId
  tipo: 'recepcion' | 'venta' | 'transferencia' | 'ajuste' | 'devolucion' | 'reserva';
  titulo: string;                                // ej "Recepción · OC-2026-038"
  subtitulo: string;                             // ej "Almacén Lima Central · 28 abr 2026"
  uds: number;                                   // signo + para entrada, - para salida
  fecha: Date;
  fechaLabel: string;                            // ej "28 abr"
}

const RANGOS: { key: RangoTemporal; label: string; meses: number }[] = [
  { key: '3m', label: '3m', meses: 3 },
  { key: '6m', label: '6m', meses: 6 },
  { key: '1A', label: '1A', meses: 12 },
  { key: 'todo', label: 'Todo', meses: 99 },
];

const MES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Tipos que cuentan como entrada (+) vs salida (-)
const TIPOS_ENTRADA: Set<MovimientoUnidad['tipo']> = new Set(['recepcion', 'devolucion']);
const TIPOS_SALIDA: Set<MovimientoUnidad['tipo']> = new Set(['venta', 'vencimiento', 'daño']);
// transferencia · reserva · ajuste se neutralizan o se manejan especial

export const TabHistorico: React.FC<TabHistoricoProps> = ({ producto, onExportar }) => {
  const [rango, setRango] = useState<RangoTemporal>('6m');
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch unidades por producto
  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    unidadService
      .buscar({ productoId: producto.id })
      .then(res => {
        if (!cancelado) setUnidades(res);
      })
      .catch(err => {
        if (!cancelado) setError(err?.message ?? 'Error cargando unidades');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [producto.id]);

  // Movimientos agrupados por documento · ordenados desc · filtrados por rango
  const movimientos = useMemo((): MovimientoAgrupado[] => {
    if (unidades.length === 0) return [];
    const ahora = Date.now();
    const mesesAtras = RANGOS.find(r => r.key === rango)?.meses ?? 6;
    const corte = mesesAtras >= 99 ? 0 : ahora - mesesAtras * 30 * 24 * 60 * 60 * 1000;

    // 1. Aplanar todos los movimientos
    const planos: Array<MovimientoUnidad & { unidadId: string }> = [];
    for (const u of unidades) {
      for (const m of u.movimientos ?? []) {
        planos.push({ ...m, unidadId: u.id });
      }
    }

    // 2. Filtrar por rango de fechas
    const filtrados = planos.filter(m => toMillisSafe(m.fecha) >= corte);

    // 3. Agrupar por documentoRelacionado.id (OC/Venta/Transferencia)
    //    Si no tiene documento, agrupar como evento individual de la unidad
    const grupos = new Map<string, MovimientoAgrupado>();
    for (const m of filtrados) {
      const docId = m.documentoRelacionado?.id;
      const key = docId ? `${m.tipo}-${docId}` : `${m.tipo}-${m.unidadId}-${m.id}`;
      const fecha = toDateOrNow(m.fecha);
      const signo = TIPOS_ENTRADA.has(m.tipo) ? 1 : TIPOS_SALIDA.has(m.tipo) ? -1 : 1;

      if (grupos.has(key)) {
        const existente = grupos.get(key)!;
        existente.uds += signo;
      } else {
        const tipoUI = mapTipoToUI(m.tipo);
        const titulo = construirTitulo(m, tipoUI);
        const subtitulo = construirSubtitulo(m, fecha);
        grupos.set(key, {
          id: key,
          tipo: tipoUI,
          titulo,
          subtitulo,
          uds: signo,
          fecha,
          fechaLabel: formatearFecha(fecha),
        });
      }
    }

    // 4. Ordenar por fecha descendente · top 30
    return Array.from(grupos.values())
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
      .slice(0, 30);
  }, [unidades, rango]);

  return (
    <div className="p-3 lg:p-5 space-y-3 lg:space-y-4">
      {/* 1. Chart skeleton · sin data hasta agregaciones BI */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            Tendencia · ventas y stock
          </h4>
          <div className="flex items-center gap-1">
            {RANGOS.map(r => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRango(r.key)}
                className={`px-2 py-1 text-[10px] rounded ${
                  rango === r.key
                    ? 'bg-teal-50 text-teal-700 border border-teal-200 font-bold'
                    : 'text-slate-500 hover:bg-slate-50 border border-transparent'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Skeleton vacío · grilla limpia + leyenda · sin data placeholder */}
        <div className="relative">
          <svg viewBox="0 0 600 100" className="w-full h-24">
            <line x1="0" y1="20" x2="600" y2="20" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2 2" />
            <line x1="0" y1="50" x2="600" y2="50" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2 2" />
            <line x1="0" y1="80" x2="600" y2="80" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2 2" />
            {/* Mes labels equiespaciados */}
            {Array.from({ length: 6 }, (_, i) => {
              const x = (i / 5) * 600;
              const date = new Date();
              date.setMonth(date.getMonth() - 5 + i);
              return (
                <text key={i} x={x} y={98} textAnchor="middle" className="fill-slate-300 text-[8px]">
                  {MES_LABELS[date.getMonth()]}
                </text>
              );
            })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] text-slate-500 italic flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Tendencia disponible cuando haya 2+ meses de movimientos
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
          <div className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-teal-500" />
            <span>Ventas mes (uds)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 border-t border-dashed border-slate-400" />
            <span>Stock disponible</span>
          </div>
        </div>
      </div>

      {/* 2. Movimientos REALES agrupados */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 gap-2 flex-wrap">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-600" />
            Movimientos {movimientos.length > 0 && <span className="text-[10px] font-normal text-slate-500">· {movimientos.length}</span>}
          </h4>
          {onExportar && movimientos.length > 0 && (
            <button
              type="button"
              onClick={onExportar}
              className="text-[10px] text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Exportar
            </button>
          )}
        </div>

        {loading ? (
          <div className="px-4 py-10 text-center text-xs text-slate-400 italic">
            Cargando movimientos...
          </div>
        ) : error ? (
          <div className="px-4 py-6 text-center">
            <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center mx-auto mb-2">
              <AlertCircle className="w-5 h-5 text-rose-500" />
            </div>
            <p className="text-xs text-rose-600">Error: {error}</p>
          </div>
        ) : movimientos.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {movimientos.map(m => (
              <MovimientoRow key={m.id} mov={m} />
            ))}
          </div>
        ) : (
          <div className="px-4 py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6 text-slate-400" />
            </div>
            <h5 className="text-sm font-bold text-slate-700 mb-1">Sin movimientos registrados</h5>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Las recepciones de OC, ventas y transferencias de este SKU aparecerán aquí
              en cuanto se ejecuten.
            </p>
            {/* TODO Fase Final · activar CTAs reales con navigate('/compras/nueva') y similares */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-[10px] text-slate-400 italic px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                Empieza creando una OC
              </span>
              <span className="text-[10px] text-slate-400 italic px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                O recibe una orden existente
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Sub-componentes y helpers ────────────────────────────────────────────────

const MovimientoRow: React.FC<{ mov: MovimientoAgrupado }> = ({ mov }) => {
  const config = getMovimientoConfig(mov.tipo);
  const Icon = config.icon;
  return (
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bg}`}>
        <Icon className={`w-3.5 h-3.5 ${config.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-900 truncate">{mov.titulo}</div>
        <div className="text-[10px] text-slate-500 truncate">{mov.subtitulo}</div>
      </div>
      <div className={`text-sm font-bold tabular-nums flex-shrink-0 ${config.text}`}>
        {mov.uds > 0 ? '+' : ''}
        {mov.uds} uds
      </div>
    </div>
  );
};

function getMovimientoConfig(tipo: MovimientoAgrupado['tipo']) {
  switch (tipo) {
    case 'recepcion':
      return { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: ArrowDown };
    case 'devolucion':
      return { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: ArrowDown };
    case 'venta':
      return { bg: 'bg-rose-50', text: 'text-rose-600', icon: ShoppingCart };
    case 'transferencia':
      return { bg: 'bg-amber-50', text: 'text-amber-600', icon: ArrowRightLeft };
    case 'reserva':
      return { bg: 'bg-purple-50', text: 'text-purple-600', icon: Package };
    case 'ajuste':
    default:
      return { bg: 'bg-sky-50', text: 'text-sky-600', icon: ArrowUp };
  }
}

function mapTipoToUI(tipo: MovimientoUnidad['tipo']): MovimientoAgrupado['tipo'] {
  switch (tipo) {
    case 'recepcion': return 'recepcion';
    case 'venta': return 'venta';
    case 'transferencia': return 'transferencia';
    case 'reserva': return 'reserva';
    case 'devolucion': return 'devolucion';
    case 'vencimiento':
    case 'daño':
    case 'ajuste':
    default: return 'ajuste';
  }
}

function construirTitulo(m: MovimientoUnidad, tipoUI: MovimientoAgrupado['tipo']): string {
  const docNum = m.documentoRelacionado?.numero ?? '';
  const labels: Record<MovimientoAgrupado['tipo'], string> = {
    recepcion: 'Recepción',
    venta: 'Venta',
    transferencia: 'Transferencia',
    reserva: 'Reserva',
    devolucion: 'Devolución',
    ajuste: 'Ajuste',
  };
  return docNum ? `${labels[tipoUI]} · ${docNum}` : labels[tipoUI];
}

function construirSubtitulo(m: MovimientoUnidad, fecha: Date): string {
  const partes: string[] = [];
  if (m.almacenDestino) partes.push(`Almacén ${m.almacenDestino}`);
  else if (m.almacenOrigen) partes.push(`Desde ${m.almacenOrigen}`);
  if (m.observaciones) partes.push(m.observaciones);
  partes.push(formatearFechaCompleta(fecha));
  return partes.join(' · ');
}

function formatearFecha(d: Date): string {
  return `${d.getDate()} ${MES_LABELS[d.getMonth()].toLowerCase()}`;
}

function formatearFechaCompleta(d: Date): string {
  return `${d.getDate()} ${MES_LABELS[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
}
