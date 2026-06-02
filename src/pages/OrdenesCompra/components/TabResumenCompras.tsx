import React, { useMemo } from 'react';
import {
  AlertTriangle, CheckCircle2, PieChart, BarChart3, Clock, Building2,
  ArrowLeftRight, Plus, ClipboardList, Truck, ArrowRight, ShoppingCart,
} from 'lucide-react';
import type { OrdenCompra, OrdenCompraStats } from '../../../types/ordenCompra.types';
import { EmptyDashboardSkeleton } from '../../../design-system';

// chk5.COMERCIALES-F1b · Tab Resumen de Compras · dashboard ejecutivo §A→§F
// Canon de no-redundancia: NO clona los 5 KPIs del strip · aporta visión NUEVA
// (concentración, tendencia, lead time, cumplimiento de pago, exposición FX).
// Pixel del mockup docs/mockups/compras-hub-v1-core.html (§A→§F · líneas 114-205).

interface StatsExtra {
  montoPendienteUSD: number;
  ocsConPagoPendiente: number;
  montoCompletadasUSD: number;
  enviosActivosVinculados: number;
}

interface TabResumenComprasProps {
  ordenes: OrdenCompra[];
  stats: OrdenCompraStats | null;
  statsExtra: StatsExtra;
  tcHoy: number;
  onNuevaOC: () => void;
  onIrTab: (tab: 'ordenes' | 'pendientes' | 'proveedores' | 'inteligencia') => void;
  onFiltrarEstado: (estado: string) => void;
  onVerOC: (oc: OrdenCompra) => void;
  navigate: (path: string) => void;
}

const NOMBRES_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Estados logísticos "en curso" (no borrador, no completado, no cancelado)
// String[] para incluir estados legacy ('pagada', 'enviada'...) igual que statsExtra del padre.
const ESTADOS_EN_CURSO: string[] = ['confirmada', 'enviada', 'pagada', 'en_proceso', 'despachada', 'en_transito', 'recibida_parcial'];

const toDate = (v: any): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  return null;
};
const diasDesde = (v: any): number | null => {
  const d = toDate(v);
  return d ? (Date.now() - d.getTime()) / 86400000 : null;
};
const fmtUSDk = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1000) return `$${(n / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};
const fmtUSD = (n: number): string => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const fmtPEN = (n: number): string => `S/ ${Math.abs(n).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;

const DONUT_COLORS = ['#3b82f6', '#8b5cf6', '#0ea5e9']; // blue · violet · sky (top 3)
const DONUT_DOT = ['bg-blue-500', 'bg-violet-500', 'bg-sky-500'];

export const TabResumenCompras: React.FC<TabResumenComprasProps> = ({
  ordenes, stats, statsExtra, tcHoy, onNuevaOC, onIrTab, onFiltrarEstado, onVerOC, navigate,
}) => {
  const activas = useMemo(() => ordenes.filter((o) => o.estado !== 'cancelada'), [ordenes]);

  // ── Concentración de gasto por proveedor (§B donut + §C concentración) ──
  const porProveedor = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    for (const o of activas) {
      const monto = o.totalUSD || 0;
      if (monto <= 0) continue;
      const nombre = o.nombreProveedor || 'Sin proveedor';
      map.set(nombre, (map.get(nombre) || 0) + monto);
      total += monto;
    }
    const arr = [...map.entries()]
      .map(([nombre, monto]) => ({ nombre, monto, pct: total > 0 ? (monto / total) * 100 : 0 }))
      .sort((a, b) => b.monto - a.monto);
    const top = arr.slice(0, 3);
    const otros = arr.slice(3);
    const otrosMonto = otros.reduce((s, x) => s + x.monto, 0);
    const otrosPct = total > 0 ? (otrosMonto / total) * 100 : 0;
    const top3pct = top.reduce((s, x) => s + x.pct, 0);
    // segmentos del donut (offset acumulado arrancando en 25 · circunferencia ≈ 100)
    let acum = 25;
    const segmentos = top
      .map((t, i) => ({ color: DONUT_COLORS[i], pct: t.pct }))
      .concat(otrosPct > 0 ? [{ color: '#94a3b8', pct: otrosPct }] : [])
      .filter((s) => s.pct > 0.5)
      .map((s) => { const off = acum; acum -= s.pct; return { ...s, offset: off }; });
    return { arr, top, otrosMonto, otrosCount: otros.length, otrosPct, total, top3pct: Math.round(top3pct), segmentos };
  }, [activas]);

  // ── Tendencia de compras · últimos 6 meses (§B barras) ──
  const tendencia = useMemo(() => {
    const ahora = new Date();
    const meses = Array.from({ length: 6 }, (_, k) => {
      const i = 5 - k;
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      return { label: NOMBRES_MES[d.getMonth()], key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, monto: 0, esActual: i === 0 };
    });
    const idx = new Map(meses.map((m, i) => [m.key, i]));
    for (const o of activas) {
      const f = toDate(o.fechaCreacion);
      if (!f) continue;
      const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
      const i = idx.get(key);
      if (i !== undefined) meses[i].monto += (o.totalUSD || 0);
    }
    const max = Math.max(...meses.map((m) => m.monto), 1);
    const promedio = meses.reduce((s, m) => s + m.monto, 0) / meses.length;
    const actual = meses[meses.length - 1];
    const prev = meses[meses.length - 2];
    const deltaPct = prev && prev.monto > 0 ? Math.round(((actual.monto - prev.monto) / prev.monto) * 100) : null;
    return { meses, max, promedio, actual, deltaPct };
  }, [activas]);

  // ── Lead time promedio · creación → recepción (§C · resiliente) ──
  const leadTime = useMemo(() => {
    const dias: number[] = [];
    for (const o of activas) {
      const fc = toDate(o.fechaCreacion);
      const fr = toDate(o.fechaRecibida);
      if (fc && fr && fr > fc) dias.push((fr.getTime() - fc.getTime()) / 86400000);
      for (const so of (o.subOrdenes || [])) {
        const sfe = toDate(so.fechaEnvio);
        const sfr = toDate(so.fechaRecepcion);
        if (sfe && sfr && sfr > sfe) dias.push((sfr.getTime() - sfe.getTime()) / 86400000);
      }
    }
    if (dias.length === 0) return { promedio: null as number | null, muestras: 0 };
    return { promedio: Math.round(dias.reduce((s, d) => s + d, 0) / dias.length), muestras: dias.length };
  }, [activas]);

  // ── % cumplimiento de pago (§C · reusa stats del strip para consistencia) ──
  const cumplimientoPago = useMemo(() => {
    const comprometido = stats?.valorTotalUSD ?? activas.reduce((s, o) => s + (o.totalUSD || 0), 0);
    const pendiente = statsExtra.montoPendienteUSD;
    const pagado = Math.max(0, comprometido - pendiente);
    const pct = comprometido > 0 ? Math.round((pagado / comprometido) * 100) : 100;
    return { pct, comprometido, pendiente, pagado };
  }, [stats, statsExtra, activas]);

  // ── Exposición FX · OCs sin pagar · tcCompra histórico vs hoy (§C) ──
  const fx = useMemo(() => {
    if (!tcHoy) return { impactoPEN: 0, hayTC: false };
    let impactoPEN = 0;
    for (const o of activas) {
      if (o.estadoPago === 'pagado') continue;
      const tcRef = o.tcReferencial || o.tcCompra;
      if (!tcRef) continue;
      const pendienteUSD = o.montoPendiente ? o.montoPendiente / tcRef : (o.totalUSD || 0);
      if (pendienteUSD <= 0) continue;
      impactoPEN += pendienteUSD * (tcHoy - tcRef); // >0 = pagar hoy cuesta más PEN (pérdida)
    }
    return { impactoPEN: Math.round(impactoPEN), hayTC: true };
  }, [activas, tcHoy]);

  // ── OCs demoradas · en tránsito > 21 días sin completar (proxy real) ──
  const demoradas = useMemo(
    () => activas.filter((o) => ESTADOS_EN_CURSO.includes(o.estado) && (diasDesde(o.fechaCreacion) ?? 0) > 21),
    [activas],
  );

  // ── Unidades por llegar (§E cross-link Inventario) ──
  const unidadesPorLlegar = useMemo(() => {
    let u = 0;
    for (const o of activas) {
      if (!ESTADOS_EN_CURSO.includes(o.estado)) continue;
      for (const p of (o.productos || [])) u += Math.max(0, (p.cantidad || 0) - (p.cantidadRecibida || 0));
    }
    return u;
  }, [activas]);

  const confirmadasListas = useMemo(() => activas.filter((o) => o.estado === 'confirmada').length, [activas]);

  // ── §A banner de salud ──
  const banner = useMemo(() => {
    const porPagar = statsExtra.ocsConPagoPendiente;
    const borradores = stats?.borradores ?? 0;
    const señales: { strong: string; resto: string }[] = [];
    if (porPagar > 0) señales.push({ strong: `${porPagar} OC${porPagar > 1 ? 's' : ''}`, resto: ' por pagar' });
    if (demoradas.length > 0) señales.push({ strong: `${demoradas.length}`, resto: ` envío${demoradas.length > 1 ? 's' : ''} demorado${demoradas.length > 1 ? 's' : ''}` });
    if (borradores > 0) señales.push({ strong: `${borradores}`, resto: ` borrador${borradores > 1 ? 'es' : ''} sin confirmar` });
    const nivel: 'verde' | 'amber' | 'rojo' = demoradas.length > 0 ? 'rojo' : (porPagar > 0 || borradores > 0) ? 'amber' : 'verde';
    return { nivel, señales };
  }, [stats, statsExtra, demoradas]);

  // ── §F alertas accionables ──
  const alertas = useMemo(() => {
    const porPagar = activas
      .filter((o) => (o.estadoPago === 'pendiente' || o.estadoPago === 'parcial'))
      .map((o) => {
        const tcRef = o.tcReferencial || o.tcCompra || tcHoy || 1;
        const pendUSD = o.montoPendiente ? o.montoPendiente / tcRef : (o.totalUSD || 0);
        return { oc: o, pendUSD };
      })
      .filter((x) => x.pendUSD > 0.01)
      .sort((a, b) => b.pendUSD - a.pendUSD)
      .slice(0, 3);
    return { porPagar, demoradas: demoradas.slice(0, 2) };
  }, [activas, demoradas, tcHoy]);

  const sinDatos = activas.length === 0;

  // ════════════════════ EMPTY STATE · esqueleto estructural (sin OCs) ════════════════════
  if (sinDatos) {
    return (
      <div className="bg-slate-50/30 p-4 sm:p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <EmptyDashboardSkeleton
            color="blue"
            icon={ShoppingCart}
            titulo="Aún no hay órdenes de compra"
            subtitulo="Cuando registres tu primera OC, tu Resumen mostrará esto:"
            cta={{ label: 'Nueva orden de compra', icon: Plus, onClick: onNuevaOC }}
            ctaSecundario={{ label: 'Ver pendientes', icon: ClipboardList, onClick: () => onIrTab('pendientes') }}
            bloques={[
              { tipo: 'banner', label: 'Salud de compras' },
              { tipo: 'charts', items: [{ label: 'Gasto por proveedor', forma: 'donut' }, { label: 'Tendencia de compras · 6 meses', forma: 'bars' }] },
              { tipo: 'stats', label: 'Insights del mes', items: ['Lead time', 'Concentración', 'Cumplim. pago', 'FX acumulado'] },
              { tipo: 'links', label: 'Conecta con · 360', items: ['Envíos', 'Inventario', 'Finanzas', 'Requerimientos'] },
              { tipo: 'list', label: 'Alertas', filas: 2 },
            ]}
          />
        </div>
      </div>
    );
  }

  // ════════════════════ DASHBOARD §A→§F ════════════════════
  const NIVEL = {
    verde: { grad: 'from-emerald-50 to-emerald-100/30', ring: 'ring-emerald-200/60', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', titulo: 'text-emerald-900', texto: 'text-emerald-700', btn: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50', Icon: CheckCircle2, label: 'Compras al día' },
    amber: { grad: 'from-amber-50 to-amber-100/30', ring: 'ring-amber-200/60', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', titulo: 'text-amber-900', texto: 'text-amber-700', btn: 'text-amber-700 border-amber-200 hover:bg-amber-50', Icon: AlertTriangle, label: 'Compras con atención' },
    rojo: { grad: 'from-rose-50 to-rose-100/30', ring: 'ring-rose-200/60', iconBg: 'bg-rose-100', iconColor: 'text-rose-600', titulo: 'text-rose-900', texto: 'text-rose-700', btn: 'text-rose-700 border-rose-200 hover:bg-rose-50', Icon: AlertTriangle, label: 'Compras requieren acción' },
  }[banner.nivel];

  return (
    <div className="bg-slate-50/30 p-4 sm:p-6 space-y-4">

      {/* §A banner salud */}
      <div className={`bg-gradient-to-r ${NIVEL.grad} ring-1 ${NIVEL.ring} rounded-2xl p-4`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${NIVEL.iconBg} flex items-center justify-center flex-shrink-0`}>
              <NIVEL.Icon className={`w-5 h-5 ${NIVEL.iconColor}`} />
            </div>
            <div>
              <div className={`text-[14px] font-bold ${NIVEL.titulo}`}>{NIVEL.label}</div>
              <div className={`text-[12px] ${NIVEL.texto}`}>
                {banner.señales.length === 0
                  ? 'Sin borradores ni pagos pendientes · todo bajo control'
                  : banner.señales.map((s, i) => (
                      <React.Fragment key={i}>{i > 0 && ' · '}<strong>{s.strong}</strong>{s.resto}</React.Fragment>
                    ))}
              </div>
            </div>
          </div>
          {banner.nivel !== 'verde' && (
            <button onClick={() => onFiltrarEstado('__por_pagar__')} className={`text-[11px] font-bold ${NIVEL.btn} bg-white border px-3 py-1.5 rounded-lg`}>Ver pendientes →</button>
          )}
        </div>
      </div>

      {/* §B visualización · grid 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* donut · gasto por proveedor */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Gasto por proveedor</div>
              <div className="text-[11px] text-slate-400">concentración de tus compras</div>
            </div>
            <PieChart className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 36 36" className="w-24 h-24 flex-shrink-0">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.6" />
              {porProveedor.segmentos.map((s, i) => (
                <circle key={i} cx="18" cy="18" r="15.9" fill="none" stroke={s.color} strokeWidth="3.6"
                  strokeDasharray={`${s.pct} ${100 - s.pct}`} strokeDashoffset={s.offset} />
              ))}
              <text x="18" y="20" textAnchor="middle" className="tabular-nums" style={{ fontSize: '5px', fontWeight: 700, fill: '#0f172a' }}>{fmtUSDk(porProveedor.total)}</text>
            </svg>
            <div className="flex-1 space-y-1.5 text-[12px]">
              {porProveedor.top.map((t, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 min-w-0"><span className={`w-2 h-2 rounded-full ${DONUT_DOT[i]} flex-shrink-0`} /><span className="truncate">{t.nombre}</span></span>
                  <span className="tabular-nums font-semibold text-slate-700 flex-shrink-0">{Math.round(t.pct)}%</span>
                </div>
              ))}
              {porProveedor.otrosCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400" /> Otros ({porProveedor.otrosCount})</span>
                  <span className="tabular-nums font-semibold text-slate-700">{Math.round(porProveedor.otrosPct)}%</span>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* barras · tendencia 6m */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Tendencia de compras · 6 meses</div>
              <div className="text-[11px] text-slate-400">valor importado por mes (USD)</div>
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-end justify-between gap-2 h-28 pt-2">
            {tendencia.meses.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full rounded-t ${m.esActual ? 'bg-blue-600' : 'bg-blue-200'}`} style={{ height: `${Math.max(2, (m.monto / tendencia.max) * 100)}%` }} />
                <span className={`text-[9px] ${m.esActual ? 'text-blue-700 font-bold' : 'text-slate-400'}`}>{m.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Promedio {fmtUSDk(tendencia.promedio)}</span>
            <span className="text-blue-700 font-semibold tabular-nums">
              {tendencia.actual.label} {fmtUSDk(tendencia.actual.monto)}{tendencia.deltaPct !== null ? ` · ${tendencia.deltaPct >= 0 ? '+' : ''}${tendencia.deltaPct}%` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* §C insights */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 ml-1">Insights del mes</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* lead time */}
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1"><Clock className="w-3.5 h-3.5 text-sky-600" /><span className="text-[10px] uppercase tracking-wider text-sky-700 font-bold">Lead time</span></div>
            <div className="text-[18px] font-bold tabular-nums text-slate-900">{leadTime.promedio !== null ? `${leadTime.promedio} días` : '—'}</div>
            <div className="text-[11px] text-slate-500 leading-snug">{leadTime.promedio !== null ? 'promedio proveedor → recepción' : 'sin recepciones registradas aún'}</div>
          </div>
          {/* concentración */}
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1"><Building2 className="w-3.5 h-3.5 text-blue-600" /><span className="text-[10px] uppercase tracking-wider text-blue-700 font-bold">Concentración</span></div>
            <div className="text-[18px] font-bold tabular-nums text-slate-900">{porProveedor.top3pct}<span className="text-slate-400">%</span></div>
            <div className="text-[11px] text-slate-500 leading-snug">en tus top {Math.min(3, porProveedor.top.length)} proveedores</div>
          </div>
          {/* cumplimiento pago */}
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">Cumplim. pago</span></div>
            <div className="text-[18px] font-bold tabular-nums text-slate-900">{cumplimientoPago.pct}<span className="text-slate-400">%</span></div>
            <div className="text-[11px] text-slate-500 leading-snug">pagado vs total adeudado</div>
          </div>
          {/* FX */}
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1"><ArrowLeftRight className="w-3.5 h-3.5 text-amber-600" /><span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">FX acumulado</span></div>
            {fx.hayTC ? (
              <div className={`text-[18px] font-bold tabular-nums ${fx.impactoPEN > 0 ? 'text-rose-700' : fx.impactoPEN < 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                {fx.impactoPEN > 0 ? '− ' : fx.impactoPEN < 0 ? '+ ' : ''}{fmtPEN(fx.impactoPEN)}
              </div>
            ) : (
              <div className="text-[18px] font-bold tabular-nums text-slate-400">—</div>
            )}
            <div className="text-[11px] text-slate-500 leading-snug">TC compra vs hoy (sin pagar)</div>
          </div>
        </div>
      </div>

      {/* §D acciones */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 ml-1">Acciones rápidas</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button onClick={onNuevaOC} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50/30 text-left transition-colors">
            <Plus className="w-4 h-4 text-blue-600 mb-1.5" /><div className="text-[12px] font-bold text-slate-900">Nueva orden de compra</div><div className="text-[10px] text-slate-500">wizard 5 pasos</div>
          </button>
          <button onClick={() => onIrTab('pendientes')} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-amber-300 hover:bg-amber-50/30 text-left transition-colors">
            <ClipboardList className="w-4 h-4 text-amber-600 mb-1.5" /><div className="text-[12px] font-bold text-slate-900">Ver pendientes de comprar</div><div className="text-[10px] text-slate-500">productos desde requerimientos</div>
          </button>
          <button onClick={() => onFiltrarEstado('confirmada')} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-sky-300 hover:bg-sky-50/30 text-left transition-colors">
            <Truck className="w-4 h-4 text-sky-600 mb-1.5" /><div className="text-[12px] font-bold text-slate-900">Despachar próximos</div><div className="text-[10px] text-slate-500">{confirmadasListas} OC{confirmadasListas !== 1 ? 's' : ''} confirmada{confirmadasListas !== 1 ? 's' : ''} lista{confirmadasListas !== 1 ? 's' : ''}</div>
          </button>
        </div>
      </div>

      {/* §E cross-links · 360 */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 ml-1">Conecta con · 360</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <a onClick={() => navigate('/envios')} className="bg-gradient-to-r from-orange-50 to-orange-100/20 border border-orange-200 rounded-lg p-3 flex items-center justify-between hover:border-orange-300 cursor-pointer">
            <div><div className="text-[12px] font-bold text-slate-900">Envíos</div><div className="text-[11px] text-orange-700">{statsExtra.enviosActivosVinculados} en tránsito</div></div><ArrowRight className="w-4 h-4 text-orange-600" />
          </a>
          <a onClick={() => navigate('/inventario')} className="bg-gradient-to-r from-orange-50 to-orange-100/20 border border-orange-200 rounded-lg p-3 flex items-center justify-between hover:border-orange-300 cursor-pointer">
            <div><div className="text-[12px] font-bold text-slate-900">Inventario</div><div className="text-[11px] text-orange-700">{unidadesPorLlegar.toLocaleString('es-PE')} u. por llegar</div></div><ArrowRight className="w-4 h-4 text-orange-600" />
          </a>
          <a onClick={() => navigate('/finanzas')} className="bg-gradient-to-r from-teal-50 to-teal-100/20 border border-teal-200 rounded-lg p-3 flex items-center justify-between hover:border-teal-300 cursor-pointer">
            <div><div className="text-[12px] font-bold text-slate-900">Finanzas</div><div className="text-[11px] text-teal-700">{fmtUSDk(statsExtra.montoPendienteUSD)} por pagar</div></div><ArrowRight className="w-4 h-4 text-teal-600" />
          </a>
          <a onClick={() => navigate('/requerimientos')} className="bg-gradient-to-r from-blue-50 to-blue-100/20 border border-blue-200 rounded-lg p-3 flex items-center justify-between hover:border-blue-300 cursor-pointer">
            <div><div className="text-[12px] font-bold text-slate-900">Requerimientos</div><div className="text-[11px] text-blue-700">por convertir</div></div><ArrowRight className="w-4 h-4 text-blue-600" />
          </a>
        </div>
      </div>

      {/* §F alertas */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 ml-1">Alertas</div>
        {alertas.porPagar.length === 0 && alertas.demoradas.length === 0 ? (
          <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span className="text-[12px] text-emerald-900">Todo al día · sin pagos vencidos ni envíos demorados</span>
          </div>
        ) : (
          <div className="space-y-2">
            {alertas.porPagar.map(({ oc, pendUSD }) => (
              <div key={oc.id} className="bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0"><AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" /><span className="text-[12px] text-rose-900 truncate"><strong>{oc.numeroOrden} · {fmtUSD(pendUSD)}</strong> por pagar ({oc.nombreProveedor})</span></div>
                <button onClick={() => onVerOC(oc)} className="text-[11px] font-bold text-rose-700 hover:underline whitespace-nowrap">Pagar →</button>
              </div>
            ))}
            {alertas.demoradas.map((oc) => (
              <div key={oc.id} className="bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0"><Truck className="w-4 h-4 text-amber-600 flex-shrink-0" /><span className="text-[12px] text-amber-900 truncate"><strong>{oc.numeroOrden}</strong> demorada · {Math.round(diasDesde(oc.fechaCreacion) ?? 0)} días sin completar</span></div>
                <button onClick={() => onVerOC(oc)} className="text-[11px] font-bold text-amber-700 hover:underline whitespace-nowrap">Ver →</button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
