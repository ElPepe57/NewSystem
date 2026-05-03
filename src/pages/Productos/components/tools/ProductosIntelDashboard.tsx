/**
 * ProductosIntelDashboard · Modal grande · Tool #30 · F6(A)
 *
 * Mockup canónico: docs/mockups/productos/30-tool-dashboard-catalogo.html
 *
 * Inteligencia de catálogo: valor del stock + lead time real + score liquidez +
 * sugerencias accionables (Reponer / Vigilar / Liquidar).
 *
 * Trigger: header del listado V2 botón "💡 Inteligencia"
 *
 * Estructura:
 *   - Header con select periodo + Reporte ejecutivo + CTA Sugerencias del día + X
 *   - KPI strip ejecutivo · 5 KPIs (Valor stock · Capital invertido · Margen
 *     potencial · Capital atrapado · Stock lento)
 *   - Filtros · 2 grupos de chips (Score liquidez + Acción) + búsqueda + orden
 *   - Listado intel rows con avatar + producto + score bar + KPIs + acción chip
 *   - Footer con timestamp + "Ver sugerencias del día"
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Zap,
  Download,
  Lightbulb,
  Grid3x3,
  Clock,
  Snail,
  TrendingUp,
  TrendingDown,
  Eye,
  ZapOff,
  Search as SearchIcon,
  ChevronDown,
  AlertTriangle,
  Droplets,
  Pill,
  Package,
  Flower,
  Gift,
} from 'lucide-react';
import type {
  ProductoIntelRow,
  ScoreLiquidezCategoria,
  AccionIntel,
  LineaIntel,
} from './types';

interface ProductosIntelDashboardProps {
  open: boolean;
  productos: ProductoIntelRow[];
  // KPIs ejecutivos calculados (si no, se derivan)
  valorStockTotal?: number;
  capitalInvertido?: number;
  margenPotencial?: number;
  capitalAtrapado?: number;
  stockLentoCount?: number;
  ultimaActualizacion?: string;
  onClose: () => void;
  onAbrirSugerencias?: () => void;
  onDescargarReporte?: () => void;
  onClickProducto?: (productoId: string) => void;
}

type FiltroScore = 'todos' | ScoreLiquidezCategoria;
type FiltroAccion = 'todas' | AccionIntel;
type Orden = 'margen_desc' | 'capital_desc' | 'velocidad_desc' | 'score_asc';

const ORDEN_LABELS: Record<Orden, string> = {
  margen_desc: 'Mayor margen potencial',
  capital_desc: 'Mayor capital invertido',
  velocidad_desc: 'Mayor velocidad',
  score_asc: 'Score más bajo primero',
};

const ICONO_LINEA: Record<LineaIntel, typeof Droplets> = {
  skincare: Droplets,
  suplemento: Pill,
  wellness: Flower,
  pack: Gift,
  otros: Package,
};

const COLOR_LINEA_BG: Record<LineaIntel, string> = {
  skincare: 'from-amber-50 to-amber-100 ring-amber-200/50',
  suplemento: 'from-indigo-50 to-indigo-100 ring-indigo-200/50',
  wellness: 'from-rose-50 to-pink-100 ring-pink-200/50',
  pack: 'from-purple-50 to-fuchsia-100 ring-purple-200/50',
  otros: 'from-slate-50 to-slate-100 ring-slate-200/50',
};

const COLOR_LINEA_ICON: Record<LineaIntel, string> = {
  skincare: 'text-amber-700',
  suplemento: 'text-indigo-700',
  wellness: 'text-pink-700',
  pack: 'text-purple-700',
  otros: 'text-slate-600',
};

const COLOR_LINEA_CHIP: Record<LineaIntel, string> = {
  skincare: 'bg-amber-50 text-amber-700 border-amber-200',
  suplemento: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  wellness: 'bg-rose-50 text-rose-700 border-rose-200',
  pack: 'bg-purple-50 text-purple-700 border-purple-200',
  otros: 'bg-slate-50 text-slate-700 border-slate-200',
};

const COLOR_SCORE_TEXT: Record<ScoreLiquidezCategoria, string> = {
  liquido: 'text-emerald-700',
  medio: 'text-amber-700',
  lento: 'text-rose-700',
};

const COLOR_SCORE_BAR_FULL: Record<ScoreLiquidezCategoria, string> = {
  liquido: 'bg-emerald-500',
  medio: 'bg-amber-500',
  lento: 'bg-rose-500',
};

const COLOR_SCORE_BAR_EMPTY: Record<ScoreLiquidezCategoria, string> = {
  liquido: 'bg-emerald-200',
  medio: 'bg-amber-200',
  lento: 'bg-rose-200',
};

const ACCION_CHIP: Record<AccionIntel, { label: string; cls: string; Icon: typeof TrendingUp }> = {
  reponer: {
    label: 'Reponer',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Icon: TrendingUp,
  },
  vigilar: {
    label: 'Vigilar',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
    Icon: Eye,
  },
  liquidar: {
    label: 'Liquidar',
    cls: 'bg-rose-50 text-rose-700 border-rose-200',
    Icon: ZapOff,
  },
};

function ScoreBar({
  categoria,
  score,
}: {
  categoria: ScoreLiquidezCategoria;
  score: number;
}) {
  const cleanScore = Math.max(0, Math.min(100, score));
  const segmentosLlenos = Math.round((cleanScore / 100) * 5);
  return (
    <div className="flex gap-[1.5px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`h-[5px] flex-1 rounded-[1px] ${
            i < segmentosLlenos
              ? COLOR_SCORE_BAR_FULL[categoria]
              : COLOR_SCORE_BAR_EMPTY[categoria]
          }`}
        />
      ))}
    </div>
  );
}

export function ProductosIntelDashboard({
  open,
  productos,
  valorStockTotal,
  capitalInvertido,
  margenPotencial,
  capitalAtrapado,
  stockLentoCount,
  ultimaActualizacion,
  onClose,
  onAbrirSugerencias,
  onDescargarReporte,
  onClickProducto,
}: ProductosIntelDashboardProps) {
  const [periodo, setPeriodo] = useState<'30d' | '90d' | 'year'>('90d');
  const [filtroScore, setFiltroScore] = useState<FiltroScore>('todos');
  const [filtroAccion, setFiltroAccion] = useState<FiltroAccion>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<Orden>('margen_desc');

  // ESC para cerrar
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Conteos por filtro · null se cuenta como "sin data" pero NO inflar las categorías
  const conteos = useMemo(() => {
    const por: Record<ScoreLiquidezCategoria, number> = { liquido: 0, medio: 0, lento: 0 };
    const acc: Record<AccionIntel, number> = { reponer: 0, vigilar: 0, liquidar: 0 };
    productos.forEach((p) => {
      if (p.scoreCategoria) por[p.scoreCategoria] = (por[p.scoreCategoria] ?? 0) + 1;
      if (p.accion) acc[p.accion] = (acc[p.accion] ?? 0) + 1;
    });
    return { por, acc, total: productos.length };
  }, [productos]);

  // KPIs derivados · solo cuentan productos con data REAL (no inventan)
  const kpis = useMemo(() => {
    const valStock = valorStockTotal ?? productos.reduce((s, p) => {
      // valor stock = unidades × precioVenta · solo si hay precio
      if (p.unidadesStock <= 0 || p.costoUnitarioPEN === null || p.margenPotencialPEN === null) return s;
      const precio = p.costoUnitarioPEN + p.margenPotencialPEN / Math.max(1, p.unidadesStock);
      return s + p.unidadesStock * precio;
    }, 0);
    const capInv = capitalInvertido ?? productos.reduce((s, p) => s + (p.capitalInvertidoPEN ?? 0), 0);
    const margPot = margenPotencial ?? productos.reduce((s, p) => s + (p.margenPotencialPEN ?? 0), 0);
    const lento = stockLentoCount ?? conteos.por.lento;
    return {
      valStock: Math.round(valStock),
      capInv: Math.round(capInv),
      margPot: Math.round(margPot),
      capAtrap: capitalAtrapado ?? 0,
      lento,
    };
  }, [productos, valorStockTotal, capitalInvertido, margenPotencial, capitalAtrapado, stockLentoCount, conteos]);

  // Lista filtrada + ordenada · nulls van al final (no se pueden ordenar)
  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let items = productos.filter((p) => {
      if (filtroScore !== 'todos' && p.scoreCategoria !== filtroScore) return false;
      if (filtroAccion !== 'todas' && p.accion !== filtroAccion) return false;
      if (q) {
        const inText =
          p.nombre.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.marca.toLowerCase().includes(q);
        if (!inText) return false;
      }
      return true;
    });

    // Helper: trata null como -Infinity (van al final en orden desc)
    const nz = (v: number | null) => (v === null ? -Infinity : v);
    items.sort((a, b) => {
      switch (orden) {
        case 'margen_desc':
          return nz(b.margenPotencialPEN) - nz(a.margenPotencialPEN);
        case 'capital_desc':
          return nz(b.capitalInvertidoPEN) - nz(a.capitalInvertidoPEN);
        case 'velocidad_desc':
          return nz(b.velocidadMes) - nz(a.velocidadMes);
        case 'score_asc':
          return (a.scoreLiquidez ?? Infinity) - (b.scoreLiquidez ?? Infinity);
      }
    });
    return items;
  }, [productos, filtroScore, filtroAccion, busqueda, orden]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 px-4 lg:px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-indigo-700" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg lg:text-xl font-bold text-slate-900">Productos Intel</h2>
                <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                  Inteligencia de catálogo · valor del stock + lead time real + score liquidez +
                  sugerencias accionables
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value as any)}
                className="hidden sm:block text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="30d">Últimos 30 días</option>
                <option value="90d">Últimos 90 días</option>
                <option value="year">Año actual</option>
              </select>
              <button
                onClick={onDescargarReporte}
                className="hidden md:flex px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-md items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Reporte ejecutivo
              </button>
              <button
                onClick={onAbrirSugerencias}
                className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sugerencias del día</span>
                <span className="sm:hidden">Sugerencias</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* KPI STRIP EJECUTIVO · 5 columnas */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 lg:px-6 py-4 lg:py-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-slate-200 gap-y-4">
            <div className="lg:px-4 lg:first:pl-0">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
                Valor stock total
              </div>
              <div className="text-xl lg:text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
                S/ {kpis.valStock.toLocaleString('es-PE')}
              </div>
              <div className="text-[10px] text-slate-500 tabular-nums mt-1">a precio de venta</div>
            </div>
            <div className="lg:px-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
                Capital invertido
              </div>
              <div className="text-xl lg:text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
                S/ {kpis.capInv.toLocaleString('es-PE')}
              </div>
              <div className="text-[10px] text-slate-500 tabular-nums mt-1">costo landed</div>
            </div>
            <div className="lg:px-4">
              <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mb-1.5">
                Margen potencial
              </div>
              <div
                className={`text-xl lg:text-2xl font-bold tabular-nums tracking-tight ${
                  kpis.margPot >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {kpis.margPot >= 0 ? '+' : '−'}S/ {Math.abs(kpis.margPot).toLocaleString('es-PE')}
              </div>
              <div className="text-[10px] text-emerald-600 tabular-nums mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {kpis.capInv > 0
                  ? `${Math.round((kpis.margPot / kpis.capInv) * 100)}% si vendes todo`
                  : 'sin inversión'}
              </div>
            </div>
            <div className="lg:px-4">
              <div className="text-[10px] uppercase tracking-wider text-amber-700 font-bold mb-1.5">
                Capital atrapado
              </div>
              <div className="text-xl lg:text-2xl font-bold text-amber-700 tabular-nums tracking-tight">
                S/ {kpis.capAtrap.toLocaleString('es-PE')}
              </div>
              <div className="text-[10px] text-amber-700 tabular-nums mt-1">en aduana + tránsito</div>
            </div>
            <div className="lg:px-4">
              <div className="text-[10px] uppercase tracking-wider text-rose-700 font-bold mb-1.5">
                Stock lento
              </div>
              <div className="text-xl lg:text-2xl font-bold text-rose-700 tabular-nums tracking-tight">
                {kpis.lento}
              </div>
              <div className="text-[10px] text-rose-700 tabular-nums mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                productos &gt;180d sin venta
              </div>
            </div>
          </div>
        </div>

        {/* FILTROS · Score liquidez + Acción + Búsqueda + Orden */}
        <div className="border-b border-slate-200 bg-white px-4 lg:px-6 py-3">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                Score liquidez:
              </span>
              <FiltroChip
                active={filtroScore === 'todos'}
                onClick={() => setFiltroScore('todos')}
                Icon={Grid3x3}
                label="Todos"
                count={conteos.total}
                colorActive="slate"
              />
              <FiltroChip
                active={filtroScore === 'liquido'}
                onClick={() => setFiltroScore('liquido')}
                Icon={Zap}
                label="Líquidos"
                count={conteos.por.liquido}
                color="emerald"
              />
              <FiltroChip
                active={filtroScore === 'medio'}
                onClick={() => setFiltroScore('medio')}
                Icon={Clock}
                label="Medios"
                count={conteos.por.medio}
                color="amber"
              />
              <FiltroChip
                active={filtroScore === 'lento'}
                onClick={() => setFiltroScore('lento')}
                Icon={Snail}
                label="Lentos"
                count={conteos.por.lento}
                color="rose"
              />

              <div className="w-px h-5 bg-slate-200 mx-1" />

              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                Acción:
              </span>
              <FiltroChip
                active={filtroAccion === 'reponer'}
                onClick={() => setFiltroAccion(filtroAccion === 'reponer' ? 'todas' : 'reponer')}
                Icon={TrendingUp}
                label="Reponer"
                count={conteos.acc.reponer}
                color="emerald"
              />
              <FiltroChip
                active={filtroAccion === 'vigilar'}
                onClick={() => setFiltroAccion(filtroAccion === 'vigilar' ? 'todas' : 'vigilar')}
                Icon={Eye}
                label="Vigilar"
                count={conteos.acc.vigilar}
                color="amber"
              />
              <FiltroChip
                active={filtroAccion === 'liquidar'}
                onClick={() => setFiltroAccion(filtroAccion === 'liquidar' ? 'todas' : 'liquidar')}
                Icon={ZapOff}
                label="Liquidar"
                count={conteos.acc.liquidar}
                color="rose"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar producto, SKU…"
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div className="relative">
                <select
                  value={orden}
                  onChange={(e) => setOrden(e.target.value as Orden)}
                  className="appearance-none pl-3 pr-8 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {(Object.keys(ORDEN_LABELS) as Orden[]).map((k) => (
                    <option key={k} value={k}>
                      {ORDEN_LABELS[k]}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* LISTADO INTEL */}
        <div className="bg-white flex-1 overflow-y-auto">
          {lista.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Snail className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                No hay productos que coincidan con los filtros aplicados.
              </p>
            </div>
          ) : (
            <>
              {/* Header desktop */}
              <div className="hidden lg:grid grid-cols-[44px_minmax(0,1.6fr)_130px_80px_90px_110px_110px_90px] gap-3 items-center px-4 py-2 bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                <div></div>
                <div>Producto</div>
                <div>Score liquidez</div>
                <div className="text-right">Lead time</div>
                <div className="text-right">Velocidad</div>
                <div className="text-right">Capital invertido</div>
                <div className="text-right">Margen potencial</div>
                <div className="text-right">Acción</div>
              </div>

              {/* Filas */}
              {lista.map((p) => {
                const Icon = ICONO_LINEA[p.linea];
                // Si no hay accion definida, usar fallback neutro
                const accion = p.accion ? ACCION_CHIP[p.accion] : null;
                const AccionIconCmp = accion?.Icon;
                // Color por categoría · slate si no hay
                const colorTextoCat = p.scoreCategoria ? COLOR_SCORE_TEXT[p.scoreCategoria] : 'text-slate-400';
                return (
                  <div
                    key={p.id}
                    onClick={() => onClickProducto?.(p.id)}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50 cursor-pointer
                               grid grid-cols-1 lg:grid-cols-[44px_minmax(0,1.6fr)_130px_80px_90px_110px_110px_90px]
                               gap-3 items-center px-4 py-3"
                  >
                    {/* Avatar */}
                    <div className="hidden lg:block">
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ring-1 flex items-center justify-center ${COLOR_LINEA_BG[p.linea]}`}
                      >
                        <Icon className={`w-5 h-5 ${COLOR_LINEA_ICON[p.linea]}`} />
                      </div>
                    </div>

                    {/* Producto */}
                    <div className="min-w-0 flex items-center gap-3 lg:block">
                      <div
                        className={`lg:hidden w-10 h-10 rounded-xl bg-gradient-to-br ring-1 flex items-center justify-center flex-shrink-0 ${COLOR_LINEA_BG[p.linea]}`}
                      >
                        <Icon className={`w-5 h-5 ${COLOR_LINEA_ICON[p.linea]}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {p.nombre}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-[10px]">
                          <span className="font-mono text-slate-400">{p.sku}</span>
                          <span className="text-slate-300">·</span>
                          <span className="font-medium text-slate-600 truncate">{p.marca}</span>
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-full border ${COLOR_LINEA_CHIP[p.linea]}`}
                          >
                            {capitalize(p.linea)}
                          </span>
                          {p.diasParaVencer !== undefined && p.diasParaVencer <= 30 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border bg-rose-100 text-rose-700 border-rose-200">
                              ⚠ Vence {p.diasParaVencer}d
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mobile · resto en stack */}
                    <div className="lg:hidden grid grid-cols-2 gap-2 mt-1 text-[11px]">
                      <div>
                        <div className="text-slate-500">Score liquidez</div>
                        {p.scoreLiquidez !== null && p.scoreCategoria ? (
                          <>
                            <ScoreBar categoria={p.scoreCategoria} score={p.scoreLiquidez} />
                            <div className={`text-[10px] font-bold tabular-nums mt-0.5 ${colorTextoCat}`}>
                              {p.scoreLiquidez} · {p.scoreCategoria.toUpperCase()}
                            </div>
                          </>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic">—</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-slate-500">Lead time</div>
                        <div className="font-semibold tabular-nums">
                          {p.leadTimeDias !== null ? `${p.leadTimeDias}d` : <span className="text-slate-400">—</span>}
                        </div>
                        <div className="text-[9px] text-slate-500">{p.ocsHistoricas} OCs</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Velocidad</div>
                        {p.velocidadMes !== null ? (
                          <>
                            <div className={`font-semibold tabular-nums ${colorTextoCat}`}>
                              {p.velocidadMes}<span className="text-[9px] text-slate-400 font-normal">/mes</span>
                            </div>
                            {p.variacionVsPeriodoAnteriorPct !== null && (
                              <div className={`text-[9px] tabular-nums ${colorTextoCat}`}>
                                {p.variacionVsPeriodoAnteriorPct >= 0 ? '+' : ''}
                                {p.variacionVsPeriodoAnteriorPct}% vs ant.
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-slate-400 italic">—</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-slate-500">Capital invertido</div>
                        <div className="font-bold tabular-nums">
                          {p.capitalInvertidoPEN !== null
                            ? `S/ ${p.capitalInvertidoPEN.toLocaleString('es-PE')}`
                            : <span className="text-slate-400">—</span>}
                        </div>
                        <div className="text-[9px] text-slate-500 tabular-nums">
                          {p.unidadesStock} uds{p.costoUnitarioPEN !== null ? ` × ${p.costoUnitarioPEN.toFixed(2)}` : ''}
                        </div>
                      </div>
                      <div className="col-span-2 flex items-center justify-between pt-1 border-t border-slate-100">
                        <div>
                          <div className="text-slate-500">Margen potencial</div>
                          {p.margenPotencialPEN !== null ? (
                            <>
                              <div
                                className={`font-bold tabular-nums ${
                                  p.esPerdidaSiVence ? 'text-rose-700' : colorTextoCat
                                }`}
                              >
                                {p.margenPotencialPEN >= 0 ? '+' : '−'}S/{' '}
                                {Math.abs(p.margenPotencialPEN).toLocaleString('es-PE')}
                              </div>
                              {p.margenPotencialPct !== null && (
                                <div className={`text-[9px] tabular-nums font-semibold ${colorTextoCat}`}>
                                  {p.esPerdidaSiVence ? 'pérdida si vence' : `${p.margenPotencialPct >= 0 ? '+' : ''}${p.margenPotencialPct}% margen`}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-slate-400 italic">—</div>
                          )}
                        </div>
                        {accion && AccionIconCmp ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-semibold ${accion.cls}`}
                          >
                            <AccionIconCmp className="w-2.5 h-2.5" />
                            {accion.label}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">sin recomendación</span>
                        )}
                      </div>
                    </div>

                    {/* Desktop · resto en columnas */}
                    <div className="hidden lg:block">
                      {p.scoreLiquidez !== null && p.scoreCategoria ? (
                        <>
                          <ScoreBar categoria={p.scoreCategoria} score={p.scoreLiquidez} />
                          <div className={`text-[10px] font-bold tabular-nums mt-1 ${colorTextoCat}`}>
                            {p.scoreLiquidez} · {p.scoreCategoria.toUpperCase()}
                          </div>
                        </>
                      ) : (
                        <div className="text-[10px] text-slate-400 italic">— sin data</div>
                      )}
                    </div>
                    <div className="hidden lg:block text-right">
                      <div className="text-sm font-semibold text-slate-900 tabular-nums">
                        {p.leadTimeDias !== null ? `${p.leadTimeDias}d` : <span className="text-slate-400">—</span>}
                      </div>
                      <div className="text-[9px] text-slate-500 tabular-nums">
                        {p.ocsHistoricas} OCs
                      </div>
                    </div>
                    <div className="hidden lg:block text-right">
                      {p.velocidadMes !== null ? (
                        <>
                          <div className={`text-sm font-semibold tabular-nums ${colorTextoCat}`}>
                            {p.velocidadMes}<span className="text-[9px] text-slate-400 font-normal">/mes</span>
                          </div>
                          {p.variacionVsPeriodoAnteriorPct !== null && (
                            <div className={`text-[9px] tabular-nums ${colorTextoCat}`}>
                              {p.variacionVsPeriodoAnteriorPct >= 0 ? '+' : ''}
                              {p.variacionVsPeriodoAnteriorPct}% vs ant.
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-slate-400 italic">—</div>
                      )}
                    </div>
                    <div className="hidden lg:block text-right">
                      <div className="text-sm font-bold text-slate-900 tabular-nums">
                        {p.capitalInvertidoPEN !== null
                          ? `S/ ${p.capitalInvertidoPEN.toLocaleString('es-PE')}`
                          : <span className="text-slate-400">—</span>}
                      </div>
                      <div className="text-[9px] text-slate-500 tabular-nums">
                        {p.unidadesStock} uds{p.costoUnitarioPEN !== null ? ` × ${p.costoUnitarioPEN.toFixed(2)}` : ''}
                      </div>
                    </div>
                    <div className="hidden lg:block text-right">
                      {p.margenPotencialPEN !== null ? (
                        <>
                          <div
                            className={`text-sm font-bold tabular-nums ${
                              p.esPerdidaSiVence ? 'text-rose-700' : colorTextoCat
                            }`}
                          >
                            {p.margenPotencialPEN >= 0 ? '+' : '−'}S/{' '}
                            {Math.abs(p.margenPotencialPEN).toLocaleString('es-PE')}
                          </div>
                          {p.margenPotencialPct !== null && (
                            <div className={`text-[9px] tabular-nums font-semibold ${colorTextoCat}`}>
                              {p.esPerdidaSiVence ? 'pérdida si vence' : `${p.margenPotencialPct >= 0 ? '+' : ''}${p.margenPotencialPct}% margen`}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-slate-400 italic">—</div>
                      )}
                    </div>
                    <div className="hidden lg:block text-right">
                      {accion && AccionIconCmp ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-semibold ${accion.cls}`}
                        >
                          <AccionIconCmp className="w-2.5 h-2.5" />
                          {accion.label}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">sin recom.</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 lg:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>
              Score liquidez recalculado al{' '}
              {ultimaActualizacion ?? new Date().toLocaleDateString('es-PE')} · datos de últimos 90
              días
            </span>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={onAbrirSugerencias}
              className="px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              Ver sugerencias del día
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componente: chip de filtro ─────────────────────────────────────────
function FiltroChip({
  active,
  onClick,
  Icon,
  label,
  count,
  color,
  colorActive,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Grid3x3;
  label: string;
  count: number;
  color?: 'emerald' | 'amber' | 'rose';
  colorActive?: 'slate';
}) {
  const baseCls =
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors';
  let cls = '';
  if (active && colorActive === 'slate') {
    cls = `${baseCls} bg-slate-900 text-white border-slate-900`;
  } else if (active && color === 'emerald') {
    cls = `${baseCls} bg-emerald-600 text-white border-emerald-600`;
  } else if (active && color === 'amber') {
    cls = `${baseCls} bg-amber-600 text-white border-amber-600`;
  } else if (active && color === 'rose') {
    cls = `${baseCls} bg-rose-600 text-white border-rose-600`;
  } else if (color === 'emerald') {
    cls = `${baseCls} bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100`;
  } else if (color === 'amber') {
    cls = `${baseCls} bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100`;
  } else if (color === 'rose') {
    cls = `${baseCls} bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100`;
  } else {
    cls = `${baseCls} bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100`;
  }
  return (
    <button onClick={onClick} className={cls}>
      <Icon className="w-3 h-3" />
      {label}
      <span className="opacity-70 tabular-nums">{count}</span>
    </button>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
