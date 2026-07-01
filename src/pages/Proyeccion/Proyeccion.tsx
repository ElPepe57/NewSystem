/**
 * Proyección 360 · Hub de FORECAST DEL RESULTADO (grupo Análisis · indigo).
 * ─────────────────────────────────────────────────────────────────────────────
 * Responde "¿hacia dónde voy?": P&L y margen PROYECTADO en 3 cajas
 * (Producto · Venta · Período) a 30/90 días — lo único que ninguna otra
 * sección entrega (Reportes = pasado · Contabilidad = formal · Finanzas = caja).
 *
 * CONSUME los motores existentes (canon no-redundancia):
 *  - Inventario → Motor de Reorden (productoIntelStore) · cross-link a /inventario
 *  - Costos → detalle por SKU vive en Cost Intelligence (/intel-productos)
 *  - Caja → vive en Finanzas (sin flujo sintético aquí)
 *
 * Redibujo Fase 2+4 (2026-07-01) · mockup: docs/mockups/proyeccion-hub-v1.html
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, BarChart3, DollarSign, Package, RefreshCw, ShoppingCart,
  Target, AlertTriangle, AlertCircle, Sparkles, Layers, GitBranch, ArrowRight,
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { HubShell, HubTopBar, HubHeader, HubKpiStrip, HubTabs, HubBody } from '../../design-system';
import type { HubTab, HubKpi, HubMiniStat } from '../../design-system';
import { LineaDropdown } from '../../components/common/LineaDropdown';
import { useCTRUStore } from '../../store/ctruStore';
import type { CTRUProductoDetalle } from '../../store/ctruStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { useProductoIntelStore } from '../../store/productoIntelStore';
import { useAuthStore } from '../../store/authStore';
import { hasRole } from '../../types/auth.types';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';
import { calcularProyeccion360 } from '../../services/proyeccion360.service';
import type { Proyeccion360, Horizonte360 } from '../../types/proyeccion360.types';

// ─── Formato ─────────────────────────────────────────────────────────────────

const fmtPEN = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtK = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}` : n.toFixed(0));
const sufK = (n: number) => (Math.abs(n) >= 1000 ? 'k' : '');

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export const Proyeccion: React.FC = () => {
  const navigate = useNavigate();
  const { productosDetalle, historialMensual, historialGastos, loading: ctruLoading, error: ctruError, fetchAll } = useCTRUStore();
  const { getTCDelDia } = useTipoCambioStore();
  const sugerenciasReposicion = useProductoIntelStore(s => s.sugerenciasReposicion);
  const cargarIntel = useProductoIntelStore(s => s.cargarDatos);
  const userProfile = useAuthStore(s => s.userProfile);
  const esAdmin = hasRole(userProfile, 'admin');

  const productos = productosDetalle || [];
  const productosLN = useLineaFilter(productos, (p: CTRUProductoDetalle) => p.lineaNegocioId);
  const lineaActiva = useLineaNegocioStore(s => s.lineaFiltroGlobal);

  const [horizonte, setHorizonte] = useState<Horizonte360>(30);
  const [tab, setTab] = useState('resumen');
  const [tcActual, setTcActual] = useState(3.50);

  useEffect(() => {
    if (!productos.length && !ctruLoading) fetchAll();
  }, [productos.length, ctruLoading, fetchAll]);

  // TC del día PRIMERO y recién entonces el Motor de Reorden (fuente única de
  // reorden · canon no-redundancia) — si el motor cargara antes, sus sugerencias
  // quedarían calculadas con el TC default (3.50) en vez del real.
  useEffect(() => {
    getTCDelDia().then(tc => {
      const tcVenta = tc?.venta || 3.50;
      if (tc?.venta) setTcActual(tc.venta);
      if (!sugerenciasReposicion.length) cargarIntel(tcVenta);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cálculo 360 en memoria
  const proy = useMemo((): Proyeccion360 | null => {
    if (!productosLN.length) return null;
    return calcularProyeccion360(
      productosLN, historialMensual || [], historialGastos || [],
      horizonte, tcActual, sugerenciasReposicion,
    );
  }, [productosLN, historialMensual, historialGastos, horizonte, tcActual, sugerenciasReposicion]);

  // ─── Shell común (top-bar + header + toggle horizonte) ───
  const tabs: HubTab[] = [
    { id: 'resumen', label: 'Resumen', icon: BarChart3 },
    { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
    { id: 'inventario', label: 'Inventario', icon: Package },
    { id: 'costos', label: 'Costos', icon: DollarSign },
    { id: 'margen', label: 'Margen', icon: Target },
  ];

  const headerShell = (body: React.ReactNode, opts?: { kpis?: HubKpi[]; miniStats?: HubMiniStat[] }) => (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6">
      <HubShell>
        <HubTopBar
          grupo="analisis"
          modulo="Proyección"
          leaf={tab === 'resumen' ? null : tabs.find(t => t.id === tab)?.label ?? null}
          esAdmin={esAdmin}
          onInicio={() => navigate('/')}
          onModulo={() => setTab('resumen')}
        />
        <HubHeader
          grupo="analisis"
          icon={TrendingUp}
          titulo="Proyección 360"
          subtitulo={`Hacia dónde va el resultado · próximos ${horizonte} días`}
          extraActions={
            <div className="flex items-center gap-2">
              <LineaDropdown />
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                {([30, 90] as Horizonte360[]).map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHorizonte(h)}
                    className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      horizonte === h ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {h}d
                  </button>
                ))}
              </div>
            </div>
          }
          acciones={[{ label: 'Recalcular', icon: RefreshCw, tier: 'neutral', onClick: () => fetchAll() }]}
        />
        {opts?.kpis && <HubKpiStrip kpis={opts.kpis} miniStats={opts.miniStats} cols={5} />}
        <HubTabs grupo="analisis" tabs={tabs} activa={tab} onChange={setTab} />
        <HubBody>{body}</HubBody>
      </HubShell>
    </div>
  );

  // ─── Estados ───
  if (ctruLoading && !productos.length) {
    return headerShell(
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-56 bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (ctruError) {
    return headerShell(
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
        <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-7 h-7 text-rose-400" />
        </div>
        <div className="text-[15px] font-bold text-slate-900">No se pudo calcular la proyección</div>
        <p className="text-[12px] text-slate-500 mt-1 max-w-sm mx-auto">
          Falló la carga de datos del sistema (CTRU / gastos). Reintenta o revisa tus permisos.
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => fetchAll()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!proy) {
    return headerShell(
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <TrendingUp className="w-7 h-7 text-indigo-300" />
        </div>
        <div className="text-[15px] font-bold text-slate-900">Aún no hay suficiente historial</div>
        <p className="text-[12px] text-slate-500 mt-1 max-w-sm mx-auto">
          La proyección necesita al menos <b>1 producto con historial de ventas</b>.
          Registra ventas o ajusta el filtro de línea de negocio.
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => navigate('/productos')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold px-3.5 py-2 rounded-lg"
          >
            Ir a Productos
          </button>
        </div>
      </div>
    );
  }

  // ─── KPI strip (semántico) + mini-stats de confianza ───
  const alertasCriticas = proy.alertas.filter(a => a.severidad === 'danger').length;
  const kpis: HubKpi[] = [
    {
      label: 'Ingresos', tono: 'emerald', icon: ShoppingCart,
      valor: `S/ ${fmtK(proy.ingresosProyectados)}`, sufijo: sufK(proy.ingresosProyectados),
      delta: (
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          {proy.ventas.crecimientoPct >= 0 ? '+' : ''}{proy.ventas.crecimientoPct.toFixed(1)}% vs mes ant.
        </span>
      ),
    },
    {
      label: 'Costos', tono: 'amber', icon: DollarSign,
      valor: `S/ ${fmtK(proy.costosProyectados)}`, sufijo: sufK(proy.costosProyectados),
      delta: <span>CTRU + venta + período</span>,
    },
    {
      label: 'Utilidad', tono: proy.utilidadProyectada >= 0 ? 'emerald' : 'rose', icon: TrendingUp,
      valor: `S/ ${fmtK(proy.utilidadProyectada)}`, sufijo: sufK(proy.utilidadProyectada),
      delta: <span>operativa proyectada</span>,
    },
    {
      label: 'Margen', tono: proy.margenNetoProyectado >= 20 ? 'emerald' : proy.margenNetoProyectado >= 0 ? 'amber' : 'rose', icon: Target,
      valor: proy.margenNetoProyectado.toFixed(1), sufijo: '%',
      delta: <span>{proy.margenNetoProyectado >= 20 ? 'saludable (≥20%)' : 'bajo el objetivo (20%)'}</span>,
    },
    {
      label: 'Alertas', tono: alertasCriticas > 0 ? 'rose' : 'slate', icon: AlertTriangle,
      valor: String(proy.alertas.length),
      delta: <span>{alertasCriticas > 0 ? `${alertasCriticas} crítica${alertasCriticas > 1 ? 's' : ''}` : 'sin críticas'}</span>,
    },
  ];
  const miniStats: HubMiniStat[] = [
    { label: <>Confianza de la proyección: <strong className={proy.confianza === 'alta' ? 'text-emerald-600' : proy.confianza === 'media' ? 'text-amber-600' : 'text-rose-600'}>{proy.confianza}</strong></> },
    { label: <>{proy.mesesHistorial} meses de historial</> },
    { label: <>Horizonte: {horizonte} días</> },
    { label: <>TC S/ {tcActual.toFixed(2)}</> },
  ];

  return headerShell(
    <>
      {tab === 'resumen' && <TabResumen proy={proy} lineaActiva={lineaActiva} />}
      {tab === 'ventas' && <TabVentas proy={proy} />}
      {tab === 'inventario' && <TabInventario proy={proy} onVerInventario={() => navigate('/inventario')} />}
      {tab === 'costos' && <TabCostos proy={proy} onVerCostIntel={() => navigate('/intel-productos')} />}
      {tab === 'margen' && <TabMargen proy={proy} />}
    </>,
    { kpis, miniStats },
  );
};

// ============================================
// TAB · RESUMEN (§A banner → §B timeline → §C P&L + escenarios → §F alertas)
// ============================================

const TabResumen: React.FC<{ proy: Proyeccion360; lineaActiva: string | null }> = ({ proy, lineaActiva }) => {
  const m = proy.margen;
  const sano = m.utilidadOperativa >= 0 && m.margenOperativo >= 20;
  const criticas = proy.alertas.filter(a => a.severidad === 'danger').length;

  return (
    <div className="space-y-4">
      {/* §A banner estado */}
      <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/30 ring-1 ring-indigo-200/60 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-indigo-700" />
        </div>
        <div>
          <div className="text-[13px] font-bold text-slate-900">
            {sano ? 'Negocio en crecimiento' : m.utilidadOperativa >= 0 ? 'Resultado positivo con margen ajustado' : 'Proyección en rojo'}
            {' · '}utilidad operativa proyectada {fmtPEN(m.utilidadOperativa)}
          </div>
          <div className="text-[12px] text-slate-600 leading-snug">
            Con el ritmo actual de ventas y los costos de hoy, los próximos {proy.horizonte} días cierran con
            margen {m.margenOperativo.toFixed(1)}%.
            {criticas > 0 ? ` Hay ${criticas} alerta${criticas > 1 ? 's' : ''} crítica${criticas > 1 ? 's' : ''} que conviene atender.` : ' Sin alertas críticas.'}
          </div>
        </div>
      </div>

      {/* Caveat honesto: los gastos (cajas 2-3) son globales, no por línea */}
      {lineaActiva && (
        <div className="bg-amber-50 ring-1 ring-amber-200/60 rounded-xl px-4 py-2.5 flex items-start gap-2 text-[12px] text-amber-800">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
          <span>
            Filtro de línea activo: ventas y CTRU son de la línea, pero los <b>gastos de venta/período son
            globales</b> (aún no se atribuyen por línea) — el margen operativo por línea es referencial.
          </span>
        </div>
      )}

      {/* §B visualización · timeline real + proyectado */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="text-[14px] font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" /> Evolución y proyección del negocio
        </h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={proy.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtPEN(v)} />
              <Bar dataKey="ingresos" name="Ingresos" radius={[3, 3, 0, 0]}>
                {proy.timeline.map((p, i) => (
                  <Cell key={i} fill={p.tipo === 'real' ? 'rgba(59,130,246,0.7)' : 'rgba(59,130,246,0.35)'} />
                ))}
              </Bar>
              <Bar dataKey="costos" name="Costos" radius={[3, 3, 0, 0]}>
                {proy.timeline.map((p, i) => (
                  <Cell key={i} fill={p.tipo === 'real' ? 'rgba(251,146,60,0.6)' : 'rgba(251,146,60,0.3)'} />
                ))}
              </Bar>
              <Line dataKey="utilidad" name="Utilidad" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-500/70 rounded-sm" /> Ingresos</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-orange-400/60 rounded-sm" /> Costos</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" /> Utilidad</span>
          </div>
          <span className="text-[10px] text-slate-400">tono atenuado = proyectado</span>
        </div>
      </div>

      {/* §C insights · P&L 3 cajas + escenarios de utilidad */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h3 className="text-[14px] font-semibold text-slate-900 mb-3">
            P&amp;L proyectado ({proy.horizonte} días) <span className="text-[11px] font-normal text-slate-400">· 3 cajas</span>
          </h3>
          <div className="space-y-1 text-[13px]">
            <PYLRow label="Ingresos por ventas" valor={m.ingresosBrutos} bold />
            <PYLRow label="(−) Costo de ventas · CTRU" caja="Caja 1 · Producto" valor={-m.costoVentas} negativo />
            <PYLRow label="= Utilidad bruta" valor={m.utilidadBruta} pct={m.margenBruto} bold sep />
            <PYLRow label="(−) Gastos de venta" caja="Caja 2 · Venta" valor={-m.gastoVenta} negativo />
            <PYLRow label="= Utilidad de contribución" valor={m.utilidadContribucion} pct={m.margenContribucion} bold sep />
            <PYLRow label="(−) Gastos de período (fijos)" caja="Caja 3 · Período" valor={-m.gastoPeriodo} negativo />
            <PYLRow label="= Utilidad operativa" valor={m.utilidadOperativa} pct={m.margenOperativo} final />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-[14px] font-semibold text-slate-900">Escenarios de utilidad</h3>
            <span className="text-[10px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">±% ventas/TC/gastos</span>
          </div>
          <div className="space-y-2.5">
            {proy.escenarios.map(e => {
              const maxUtil = Math.max(...proy.escenarios.map(x => Math.abs(x.utilidad)), 1);
              const borde = e.nombre === 'optimista' ? 'border-emerald-500' : e.nombre === 'base' ? 'border-sky-500' : 'border-rose-500';
              const barra = e.utilidad >= 0 ? (e.margen >= 20 ? 'bg-emerald-500' : 'bg-amber-400') : 'bg-rose-500';
              return (
                <div key={e.nombre} className={`border-l-4 ${borde} bg-slate-50/60 rounded-r-lg p-2.5`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-slate-700 capitalize">
                      {e.nombre} <span className="text-slate-400 font-normal">· {(e.probabilidad * 100).toFixed(0)}%</span>
                    </span>
                    <span className="text-[15px] font-bold tabular-nums text-slate-900">S/ {fmtK(e.utilidad)}{sufK(e.utilidad)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5">
                    <div className={`h-full ${barra} rounded-full`} style={{ width: `${Math.min(Math.abs(e.utilidad) / maxUtil * 100, 100)}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Margen {e.margen.toFixed(1)}% · ingresos S/ {fmtK(e.ingresos)}{sufK(e.ingresos)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* §F alertas */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="text-[14px] font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500" /> Alertas ({proy.alertas.length})
        </h3>
        {proy.alertas.length === 0 ? (
          <div className="text-[12px] text-slate-400">Sin alertas para este horizonte.</div>
        ) : (
          <div className="space-y-2">
            {proy.alertas.map((a, i) => {
              const theme = a.severidad === 'danger'
                ? 'bg-rose-50 border-rose-200 text-rose-500'
                : a.severidad === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-500'
                  : 'bg-sky-50 border-sky-200 text-sky-500';
              const [bg, border, iconColor] = theme.split(' ');
              return (
                <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg ${bg} border ${border} text-[13px]`}>
                  <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
                  <div>
                    <div className="font-medium text-slate-900">{a.mensaje}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{a.accion}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const PYLRow: React.FC<{
  label: string; valor: number; caja?: string; pct?: number;
  bold?: boolean; negativo?: boolean; sep?: boolean; final?: boolean;
}> = ({ label, valor, caja, pct, bold, negativo, sep, final }) => (
  <div className={`flex items-center justify-between py-1 ${bold ? 'font-semibold' : ''} ${sep ? 'border-t border-slate-100 pt-1' : ''} ${final ? 'font-bold border-t-2 border-slate-300 mt-1 py-1.5' : ''}`}>
    <span className={negativo ? 'text-slate-500' : ''}>
      {label}{' '}
      {caja && <span className="text-[10px] text-indigo-400 font-semibold">{caja}</span>}
    </span>
    <span className="flex items-center gap-2">
      <span className={`tabular-nums ${negativo ? 'text-rose-500' : ''}`}>{fmtPEN(negativo ? Math.abs(valor) : valor)}</span>
      {pct !== undefined && (
        <span className={`text-[11px] font-bold tabular-nums ${valor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{pct.toFixed(1)}%</span>
      )}
    </span>
  </div>
);

// ============================================
// TAB · VENTAS
// ============================================

const TabVentas: React.FC<{ proy: Proyeccion360 }> = ({ proy }) => {
  const v = proy.ventas;
  const top = [...v.productos].sort((a, b) => b.ingresosProyectados - a.ingresosProyectados).slice(0, 15);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniKpi label="Unidades" valor={v.totalUnidades.toLocaleString('es-PE')} />
        <MiniKpi label="Monto proyectado" valor={fmtPEN(v.totalMontoPEN)} />
        <MiniKpi label="Ticket promedio" valor={fmtPEN(v.ticketPromedio)} />
        <MiniKpi label="Crecimiento" valor={`${v.crecimientoPct >= 0 ? '+' : ''}${v.crecimientoPct.toFixed(1)}%`} tono={v.crecimientoPct >= 0 ? 'emerald' : 'rose'} />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-[14px] font-semibold text-slate-900">Ventas proyectadas por producto</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[12px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-500">Producto</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500">Ritmo/mes</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500">Uds. proy.</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500">Ingresos proy.</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {top.map(p => (
                <tr key={p.productoId} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-900 truncate max-w-[220px]">{p.nombre}</div>
                    <div className="text-slate-400 font-mono text-[10px]">{p.sku}</div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{p.ventasMensuales.toFixed(1)} u</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{p.unidadesProyectadas}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{fmtPEN(p.ingresosProyectados)}</td>
                  <td className="px-4 py-2 text-right">
                    {p.limitadoPorStock ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700">
                        limita · {p.diasHastaStockout}d
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">ok</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================
// TAB · INVENTARIO (consume Motor de Reorden)
// ============================================

const TabInventario: React.FC<{ proy: Proyeccion360; onVerInventario: () => void }> = ({ proy, onVerInventario }) => {
  const inv = proy.inventario;
  const lista = [...inv.productos].sort((a, b) => a.diasStock - b.diasStock).slice(0, 12);
  const maxDias = 90;
  return (
    <div className="space-y-4">
      {/* Consumidor · el reorden viene del Motor de Reorden (canon no-redundancia) */}
      <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/30 ring-1 ring-indigo-200/60 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[12px] text-slate-700 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-indigo-500" />
          Reorden y días de stock vienen del <b>Motor de Reorden</b> · aquí se ven en tu horizonte.
          {!inv.desdeMotorReorden && <span className="text-amber-700 font-semibold">(motor sin datos · mostrando cobertura estimada)</span>}
        </span>
        <button type="button" onClick={onVerInventario} className="text-[12px] font-bold text-indigo-700 hover:underline whitespace-nowrap flex items-center gap-1">
          Ver Inventario <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniKpi label="Disponibles" valor={`${inv.totalDisponibles.toLocaleString('es-PE')} uds`} />
        <MiniKpi label="Valor inventario" valor={fmtPEN(inv.valorInventarioPEN)} />
        <MiniKpi label="Productos en riesgo" valor={String(inv.productosEnRiesgo)} tono={inv.productosEnRiesgo > 0 ? 'rose' : 'emerald'} />
        <MiniKpi label="Costo recompra total" valor={fmtPEN(inv.costoTotalRecompraPEN)} />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="text-[14px] font-semibold text-slate-900 mb-3">Estado del inventario al horizonte</h3>
        <div className="space-y-3">
          {lista.map(p => {
            const barra = p.estado === 'critico' ? 'bg-rose-500' : p.estado === 'atencion' ? 'bg-amber-400' : 'bg-emerald-500';
            const diasColor = p.estado === 'critico' ? 'text-rose-600' : p.estado === 'atencion' ? 'text-amber-600' : 'text-emerald-600';
            return (
              <div key={p.productoId}>
                <div className="flex items-center justify-between text-[13px] mb-1">
                  <span className="font-medium">{p.nombre}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">{p.disponibles} uds</span>
                    <span className={`text-[11px] font-bold ${diasColor}`}>{p.diasStock >= 9999 ? '∞' : `${p.diasStock}d`}</span>
                  </div>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${barra} rounded-full`} style={{ width: `${Math.min(Math.max(p.diasStock / maxDias * 100, 3), 100)}%` }} />
                </div>
                {p.necesitaRecompra && (
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Comprar {p.cantidadSugerida} uds — {fmtPEN(p.costoRecompraPEN)}
                    {p.puntoReorden !== undefined && ` · punto de reorden ${p.puntoReorden} uds`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================
// TAB · COSTOS (3 cajas · detalle SKU en Cost Intelligence)
// ============================================

const TabCostos: React.FC<{ proy: Proyeccion360; onVerCostIntel: () => void }> = ({ proy, onVerCostIntel }) => {
  const c = proy.costos;
  const total = c.costoTotal || 1;
  const pctProducto = (c.costoVentasTotal / total) * 100;
  const pctVenta = (c.gastoVentaProyectado / total) * 100;
  const pctPeriodo = (c.gastoPeriodoProyectado / total) * 100;
  return (
    <div className="space-y-4">
      {/* Consumidor · el detalle por SKU vive en Cost Intelligence */}
      <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/30 ring-1 ring-indigo-200/60 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[12px] text-slate-700 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-indigo-500" />
          Costo consolidado por caja (proyectado). El detalle por SKU + variance vive en <b>Cost Intelligence</b>.
        </span>
        <button type="button" onClick={onVerCostIntel} className="text-[12px] font-bold text-indigo-700 hover:underline whitespace-nowrap flex items-center gap-1">
          Ver Cost Intelligence <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniKpi label="Costo total" valor={fmtPEN(c.costoTotal)} />
        <MiniKpi label="CTRU promedio" valor={fmtPEN(c.ctruPromedioProyectado)} />
        <MiniKpi label="Gastos período" valor={fmtPEN(c.gastoPeriodoProyectado)} />
        <MiniKpi label="Impacto TC +5%" valor={fmtPEN(c.impactoTC5Pct)} tono="rose" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h3 className="text-[14px] font-semibold text-slate-900 mb-3">
            Distribución de costos <span className="text-[11px] font-normal text-slate-400">· 3 cajas</span>
          </h3>
          <div className="flex items-center justify-center h-48">
            <div
              className="w-36 h-36 rounded-full"
              style={{
                background: `conic-gradient(#3b82f6 0% ${pctProducto}%, #a855f7 ${pctProducto}% ${pctProducto + pctVenta}%, #f59e0b ${pctProducto + pctVenta}% 100%)`,
              }}
            >
              <div className="w-20 h-20 bg-white rounded-full m-8 flex items-center justify-center text-[11px] font-bold text-slate-600 tabular-nums">
                S/{fmtK(c.costoTotal)}{sufK(c.costoTotal)}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h3 className="text-[14px] font-semibold text-slate-900 mb-3">Desglose por caja</h3>
          <div className="space-y-2 text-[13px]">
            <CajaRow color="bg-blue-500" label="Producto · CTRU" caja="Caja 1" monto={c.costoVentasTotal} pct={pctProducto} />
            <CajaRow color="bg-purple-500" label="Venta" caja="Caja 2" monto={c.gastoVentaProyectado} pct={pctVenta} />
            <CajaRow color="bg-amber-500" label="Período (fijos)" caja="Caja 3" monto={c.gastoPeriodoProyectado} pct={pctPeriodo} />
            <div className="border-t border-slate-200 pt-2 flex justify-between font-bold">
              <span>Total</span><span className="tabular-nums">{fmtPEN(c.costoTotal)}</span>
            </div>
            {c.costoRecompras > 0 && (
              <div className="text-[11px] text-slate-400 pt-1">
                + Recompra sugerida (motor de reorden): {fmtPEN(c.costoRecompras)} — no incluida en el P&L del horizonte.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CajaRow: React.FC<{ color: string; label: string; caja: string; monto: number; pct: number }> = ({ color, label, caja, monto, pct }) => (
  <div className="flex items-center justify-between">
    <span className="flex items-center gap-2">
      <span className={`w-3 h-3 rounded-full ${color}`} /> {label} <span className="text-[10px] text-slate-400">{caja}</span>
    </span>
    <span className="tabular-nums font-medium">
      {fmtPEN(monto)} <span className="text-slate-400 text-[11px]">{pct.toFixed(0)}%</span>
    </span>
  </div>
);

// ============================================
// TAB · MARGEN (cascada 5 barras por caja)
// ============================================

const TabMargen: React.FC<{ proy: Proyeccion360 }> = ({ proy }) => {
  const m = proy.margen;
  const maxV = Math.max(m.ingresosBrutos, 1);
  const h = (v: number) => `${Math.min(Math.max(Math.abs(v) / maxV * 88, 2), 88)}%`;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniKpi label="Margen bruto" valor={`${m.margenBruto.toFixed(1)}%`} tono="emerald" />
        <MiniKpi label="Margen operativo" valor={`${m.margenOperativo.toFixed(1)}%`} tono={m.margenOperativo >= 20 ? 'emerald' : m.margenOperativo >= 0 ? 'amber' : 'rose'} />
        <MiniKpi label="Break-even" valor={m.unidadesBreakEven > 0 ? `${m.unidadesBreakEven} uds` : '—'} />
        <MiniKpi label="Productos riesgo" valor={String(m.productosMargenNegativo + m.productosMargenBajo)} tono={m.productosMargenNegativo > 0 ? 'rose' : 'amber'} />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="text-[14px] font-semibold text-slate-900 mb-3">
          Cascada: de ingresos a utilidad <span className="text-[11px] font-normal text-slate-400">· por caja</span>
        </h3>
        <div className="h-56 flex items-end justify-around gap-2 px-2 border-l border-b border-slate-200">
          <CascadaBar color="bg-emerald-500/80" label="Ingresos" valor={m.ingresosBrutos} height={h(m.ingresosBrutos)} />
          <CascadaBar color="bg-blue-500/80" label="(−) CTRU" valor={-m.costoVentas} height={h(m.costoVentas)} />
          <CascadaBar color="bg-purple-500/80" label="(−) Venta" valor={-m.gastoVenta} height={h(m.gastoVenta)} />
          <CascadaBar color="bg-amber-500/80" label="(−) Período" valor={-m.gastoPeriodo} height={h(m.gastoPeriodo)} />
          <CascadaBar color="bg-emerald-600/80" label="Utilidad" valor={m.utilidadOperativa} height={h(m.utilidadOperativa)} />
        </div>
      </div>
    </div>
  );
};

const CascadaBar: React.FC<{ color: string; label: string; valor: number; height: string }> = ({ color, label, valor, height }) => (
  <div className="flex flex-col items-center gap-1 flex-1">
    <div className={`w-full max-w-[64px] ${color} rounded-t`} style={{ height }} />
    <span className="text-[10px] text-slate-500">{label}</span>
    <span className="text-[10px] tabular-nums font-bold text-slate-700">
      {valor < 0 ? '−' : ''}{fmtK(Math.abs(valor))}{sufK(Math.abs(valor))}
    </span>
  </div>
);

// ============================================
// Shared · Mini KPI
// ============================================

const MiniKpi: React.FC<{ label: string; valor: string; tono?: 'emerald' | 'rose' | 'amber' }> = ({ label, valor, tono }) => {
  const color = tono === 'emerald' ? 'text-emerald-600' : tono === 'rose' ? 'text-rose-600' : tono === 'amber' ? 'text-amber-600' : 'text-slate-900';
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-0.5 ${color}`}>{valor}</div>
    </div>
  );
};
