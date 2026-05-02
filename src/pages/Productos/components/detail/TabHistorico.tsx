/**
 * TabHistorico · Tab "Histórico" del modal detalle producto
 *
 * Mockup canónico: docs/mockups/productos/15b-modal-detalle-historico.html
 *
 * Estructura:
 *   1. Chart área ventas + línea stock disponible (3m/6m/1A/Todo)
 *   2. Lista movimientos recientes (recepción · venta · transferencia · etc.)
 *
 * Nota: el chart aún usa data placeholder generada del seedHash · cuando exista
 *       la integración con `movimientosService` se reemplaza por data real.
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Clock,
  ArrowDown,
  ArrowUp,
  ArrowRightLeft,
  ShoppingCart,
  Download,
  Package,
} from 'lucide-react';
import type { Producto } from '../../../../types/producto.types';

interface TabHistoricoProps {
  producto: Producto;
  onExportar?: () => void;
}

type RangoTemporal = '3m' | '6m' | '1A' | 'todo';

interface MovimientoMock {
  id: string;
  tipo: 'recepcion' | 'venta' | 'transferencia' | 'ajuste';
  titulo: string;
  subtitulo: string;
  uds: number;
  fecha: string;
}

const RANGOS: { key: RangoTemporal; label: string; meses: number }[] = [
  { key: '3m', label: '3m', meses: 3 },
  { key: '6m', label: '6m', meses: 6 },
  { key: '1A', label: '1A', meses: 12 },
  { key: 'todo', label: 'Todo', meses: 24 },
];

const MES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const TabHistorico: React.FC<TabHistoricoProps> = ({ producto, onExportar }) => {
  const [rango, setRango] = useState<RangoTemporal>('6m');

  // Series placeholder generadas con seedHash · estables por producto
  const series = useMemo(() => {
    const seedHash = producto.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const random = (n: number) => {
      const x = Math.sin(seedHash + n) * 10000;
      return x - Math.floor(x);
    };
    const meses = RANGOS.find(r => r.key === rango)?.meses ?? 6;
    const ventas = Array.from({ length: meses }, (_, i) => 5 + Math.floor(random(i) * 25 + i * 1.5));
    const stock = Array.from({ length: meses }, (_, i) => 20 + Math.floor(random(i + 100) * 30 + i * 2));
    return { ventas, stock };
  }, [producto.id, rango]);

  // Lista placeholder de movimientos (cuando exista API real, reemplazar)
  const movimientos: MovimientoMock[] = useMemo(() => {
    return [
      { id: '1', tipo: 'recepcion', titulo: 'Recepción · OC-2026-038', subtitulo: 'Almacén Lima Central · 28 abr 2026', uds: 30, fecha: '28 abr' },
      { id: '2', tipo: 'venta', titulo: 'Venta · VT-2026-103', subtitulo: 'Cliente: María Q. · 27 abr 2026', uds: -2, fecha: '27 abr' },
      { id: '3', tipo: 'venta', titulo: 'Venta · VT-2026-101', subtitulo: 'Cliente: Beauty Clinic · 26 abr 2026', uds: -5, fecha: '26 abr' },
      { id: '4', tipo: 'transferencia', titulo: 'Transferencia · TR-2026-014', subtitulo: 'Lima Central → Lima Norte · 25 abr 2026', uds: 10, fecha: '25 abr' },
      { id: '5', tipo: 'venta', titulo: 'Venta · VT-2026-098', subtitulo: 'Mercado Libre · 24 abr 2026', uds: -1, fecha: '24 abr' },
    ];
  }, []);

  // Calcular eje Y a partir de las series para escalar el chart
  const maxVal = useMemo(() => {
    const all = [...series.ventas, ...series.stock];
    return Math.max(1, ...all);
  }, [series]);

  const W = 600;
  const H = 120;
  const xStep = series.ventas.length > 1 ? W / (series.ventas.length - 1) : W;

  const ventasPath = series.ventas.map((v, i) => `${i * xStep},${H - (v / maxVal) * (H - 20)}`).join(' ');
  const stockPath = series.stock.map((v, i) => `${i * xStep},${H - (v / maxVal) * (H - 20)}`).join(' ');
  const ventasArea = `0,${H} ${ventasPath} ${W},${H}`;

  const monthLabels = useMemo(() => {
    const meses = RANGOS.find(r => r.key === rango)?.meses ?? 6;
    const now = new Date();
    return Array.from({ length: meses }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (meses - 1 - i), 1);
      return MES_LABELS[d.getMonth()];
    });
  }, [rango]);

  return (
    <div className="p-3 lg:p-5 space-y-3 lg:space-y-4 max-h-[calc(90vh-220px)] lg:max-h-[480px] overflow-y-auto">
      {/* 1. Chart histórico ventas + stock */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            Evolución · Ventas y stock
          </h4>
          <div className="flex items-center gap-1">
            {RANGOS.map(r => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRango(r.key)}
                className={`px-2 py-1 text-[10px] font-bold rounded ${
                  rango === r.key
                    ? 'bg-teal-100 text-teal-700'
                    : 'text-slate-500 hover:bg-slate-100 font-medium'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full h-28 lg:h-32">
          {/* Grid */}
          <line x1="0" y1="40" x2={W} y2="40" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2 2" />
          <line x1="0" y1="80" x2={W} y2="80" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2 2" />
          <line x1="0" y1="120" x2={W} y2="120" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2 2" />
          {/* Área ventas */}
          <polygon points={ventasArea} fill="#14b8a6" opacity="0.15" />
          <polyline points={ventasPath} fill="none" stroke="#14b8a6" strokeWidth="2.5" />
          {/* Stock dashed */}
          <polyline points={stockPath} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3" />
          {/* Mes labels */}
          {monthLabels.map((m, i) => (
            <text
              key={i}
              x={i * xStep}
              y={H + 18}
              fontSize="9"
              fill="#94a3b8"
              textAnchor={i === 0 ? 'start' : i === monthLabels.length - 1 ? 'end' : 'middle'}
            >
              {m}
            </text>
          ))}
        </svg>
        <div className="flex items-center gap-3 lg:gap-4 mt-2 text-[10px] flex-wrap">
          <div className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-teal-500" />
            <span className="text-slate-600">Ventas mes (uds)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 border-t border-dashed border-slate-400" />
            <span className="text-slate-600">Stock disponible</span>
          </div>
        </div>
      </div>

      {/* 2. Movimientos recientes */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 gap-2 flex-wrap">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-600" />
            Movimientos recientes
          </h4>
          {onExportar && (
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
        {movimientos.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {movimientos.map(m => (
              <MovimientoRow key={m.id} mov={m} />
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-2">
              <Package className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-xs text-slate-500">Sin movimientos registrados</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

const MovimientoRow: React.FC<{ mov: MovimientoMock }> = ({ mov }) => {
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

function getMovimientoConfig(tipo: MovimientoMock['tipo']) {
  switch (tipo) {
    case 'recepcion':
      return { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: ArrowDown };
    case 'venta':
      return { bg: 'bg-rose-50', text: 'text-rose-600', icon: ShoppingCart };
    case 'transferencia':
      return { bg: 'bg-amber-50', text: 'text-amber-600', icon: ArrowRightLeft };
    case 'ajuste':
    default:
      return { bg: 'bg-sky-50', text: 'text-sky-600', icon: ArrowUp };
  }
}
