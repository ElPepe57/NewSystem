import React, { useMemo } from 'react';
import {
  AlertTriangle, CheckCircle2, PieChart, Activity, Clock, Building2,
  ArrowLeftRight, Plus, ClipboardList, Truck, ArrowRight, ShoppingCart,
  UserCheck, PenLine, GitMerge, ChevronRight, FileText, PackageSearch, CreditCard,
  Info, CalendarClock, Plug, ShieldAlert, Layers, Bell,
} from 'lucide-react';
import type { OrdenCompra, OrdenCompraStats, Proveedor } from '../../../types/ordenCompra.types';
import type { Requerimiento } from '../../../types/requerimiento.types';
import { useProductoIntelStore } from '../../../store/productoIntelStore';
import { calcularPendientesCompra, resumenPendientes } from '../../../components/modules/ordenCompra/pendientesCompra.helper';
import { UMBRAL_AUTORIZACION_SOCIO_USD } from '../../../services/autorizacionEgreso.helper';
import type { RadarAtrasadosResult } from '../useRadarAtrasados';

// chk5.COMERCIALES-F1b · Tab Resumen de Compras · dashboard ejecutivo §A→§F (Layout A)
// Canon de no-redundancia: NO clona los 5 KPIs del strip · aporta visión NUEVA
// (cola de firmas, pipeline de abastecimiento, donut/tendencia clickables, calendario
// de caja, concentración×riesgo SRM, mix de origen, ROP teaser, incidencias).
// Pixel del mockup docs/mockups/compras-hub-evolucion-v1.html · ACTO 2 (§A→§F · líneas 247-561).

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
  // F1b · fuentes nuevas para el dashboard evolucionado.
  requerimientos: Requerimiento[];
  proveedores: Proveedor[];
  radar: RadarAtrasadosResult;
  esSocio: boolean;
  onNuevaOC: () => void;
  onIrTab: (tab: 'ordenes' | 'pendientes' | 'proveedores' | 'inteligencia') => void;
  onFiltrarEstado: (estado: string) => void;
  onFiltrarProveedor: (proveedorId: string) => void;
  onVerOC: (oc: OrdenCompra) => void;
  navigate: (path: string) => void;
}

const NOMBRES_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Estados logísticos "en curso" (no borrador, no completado, no cancelado)
// String[] para incluir estados legacy ('pagada', 'enviada'...) igual que statsExtra del padre.
// Grupos de estado ESPEJO de estadoFilterMapOpcionB (OrdenesCompra) · cada estación del pipeline
// cuenta EXACTAMENTE lo que filtra al clickear (conteo = resultado · evita el "click→menos OCs").
const ESTADOS_CONFIRMADA: string[] = ['confirmada', 'enviada', 'pagada'];       // estación "En curso" / filtro 'confirmada'
const ESTADOS_EN_DESPACHO: string[] = ['en_proceso', 'despachada', 'en_transito', 'recibida_parcial']; // "Por recibir" / 'en_despacho'
const ESTADOS_EN_CURSO: string[] = [...ESTADOS_CONFIRMADA, ...ESTADOS_EN_DESPACHO]; // todo en vuelo (banner salud / demoradas)

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

// Tendencia · SVG línea/área (viewBox 300×100). El path se arma a partir de los 6 montos.
const TREND_W = 300;
const TREND_H = 100;

export const TabResumenCompras: React.FC<TabResumenComprasProps> = ({
  ordenes, stats, statsExtra, tcHoy, requerimientos, proveedores, radar, esSocio,
  onNuevaOC, onIrTab, onFiltrarEstado, onFiltrarProveedor, onVerOC, navigate,
}) => {
  const activas = useMemo(() => ordenes.filter((o) => o.estado !== 'cancelada'), [ordenes]);
  // Semántica honesta (UAT 2026-07-03): los agregados de DINERO (gasto por proveedor ·
  // tendencia) solo cuentan OCs COMPROMETIDAS (confirmada+) — un borrador no es compra
  // (el débito en CC nace al confirmar). `activas` se mantiene para la cola de firmas
  // (borradores sobre el umbral esperan autorización) y el pipeline (etapa Borradores explícita).
  const comprometidas = useMemo(() => activas.filter((o) => o.estado !== 'borrador'), [activas]);

  // ── §A · Cola de firmas de socio · OCs con autorizacion.estado === 'pendiente' ──
  // El campo OrdenCompra.autorizacion ({estado, firmas[]...}) vive sobre las OCs sobre el umbral
  // (doble firma · fuente única autorizacionEgreso.helper · UMBRAL_AUTORIZACION_SOCIO_USD).
  const colaFirmas = useMemo(() => {
    const pendientes = activas.filter((o) => o.autorizacion?.estado === 'pendiente');
    const montoUSD = pendientes.reduce((s, o) => s + (o.totalUSD || 0), 0);
    return { ocs: pendientes, count: pendientes.length, montoUSD };
  }, [activas]);

  // ── Concentración de gasto por proveedor (§B donut + §C concentración) ──
  const porProveedor = useMemo(() => {
    const map = new Map<string, { monto: number; proveedorId: string }>();
    let total = 0;
    for (const o of comprometidas) {
      const monto = o.totalUSD || 0;
      if (monto <= 0) continue;
      const nombre = o.nombreProveedor || 'Sin proveedor';
      const cur = map.get(nombre) || { monto: 0, proveedorId: o.proveedorId || '' };
      cur.monto += monto;
      if (!cur.proveedorId && o.proveedorId) cur.proveedorId = o.proveedorId;
      map.set(nombre, cur);
      total += monto;
    }
    const arr = [...map.entries()]
      .map(([nombre, v]) => ({ nombre, monto: v.monto, proveedorId: v.proveedorId, pct: total > 0 ? (v.monto / total) * 100 : 0 }))
      .sort((a, b) => b.monto - a.monto);
    const top = arr.slice(0, 3);
    const otros = arr.slice(3);
    const otrosMonto = otros.reduce((s, x) => s + x.monto, 0);
    const otrosPct = total > 0 ? (otrosMonto / total) * 100 : 0;
    const top3pct = top.reduce((s, x) => s + x.pct, 0);
    // segmentos del donut (offset acumulado arrancando en 25 · circunferencia ≈ 100)
    let acum = 25;
    const segmentos = top
      .map((t, i) => ({ color: DONUT_COLORS[i], pct: t.pct, proveedorId: t.proveedorId }))
      .concat(otrosPct > 0 ? [{ color: '#94a3b8', pct: otrosPct, proveedorId: '' }] : [])
      .filter((s) => s.pct > 0.5)
      .map((s) => { const off = acum; acum -= s.pct; return { ...s, offset: off }; });
    return { arr, top, otrosMonto, otrosCount: otros.length, otrosPct, total, top3pct: Math.round(top3pct), segmentos };
  }, [activas]);

  // ── Tendencia de compras · últimos 6 meses (§B línea/área) ──
  const tendencia = useMemo(() => {
    const ahora = new Date();
    const meses = Array.from({ length: 6 }, (_, k) => {
      const i = 5 - k;
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      return { label: NOMBRES_MES[d.getMonth()], key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, monto: 0, esActual: i === 0 };
    });
    const idx = new Map(meses.map((m, i) => [m.key, i]));
    for (const o of comprometidas) {
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
    // Puntos del path SVG (área + línea + línea de promedio dashed). Y invertido (0 arriba).
    const yDe = (monto: number) => TREND_H - (max > 0 ? (monto / max) * (TREND_H - 18) : 0) - 4;
    const n = meses.length;
    const xDe = (i: number) => (n > 1 ? (i / (n - 1)) * TREND_W : TREND_W);
    const puntos = meses.map((m, i) => ({ x: xDe(i), y: yDe(m.monto) }));
    const linePath = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' ');
    const areaPath = `${linePath} L${TREND_W},${TREND_H} L0,${TREND_H} Z`;
    const promedioY = yDe(promedio);
    const ultimo = puntos[puntos.length - 1];
    return { meses, max, promedio, actual, deltaPct, linePath, areaPath, promedioY, ultimo };
  }, [activas]);

  // ── Lead time promedio · creación → recepción (§C · resiliente) ──
  const leadTime = useMemo(() => {
    const dias: number[] = [];
    for (const o of comprometidas) {
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

  // ── % cumplimiento de pago (§C · base LINE-AWARE: comprometido y pendiente sobre el MISMO set
  //    filtrado por Línea · antes comprometido salía de stats GLOBAL e inflaba el % al filtrar línea) ──
  const cumplimientoPago = useMemo(() => {
    const comprometido = activas.reduce((s, o) => s + (o.totalUSD || 0), 0);
    const pendiente = statsExtra.montoPendienteUSD;
    const pagado = Math.max(0, comprometido - pendiente);
    const pct = comprometido > 0 ? Math.round((pagado / comprometido) * 100) : 100;
    return { pct, comprometido, pendiente, pagado };
  }, [statsExtra, activas]);

  // ── Exposición FX · OCs sin pagar · tcCompra histórico vs hoy (§C) ──
  const fx = useMemo(() => {
    if (!tcHoy) return { impactoPEN: 0, hayTC: false };
    let impactoPEN = 0;
    for (const o of comprometidas) {
      if (o.estadoPago === 'pagado') continue;
      const tcRef = o.tcReferencial || o.tcCompra;
      if (!tcRef) continue;
      const pendienteUSD = o.montoPendiente ? o.montoPendiente / tcRef : (o.totalUSD || 0);
      if (pendienteUSD <= 0) continue;
      impactoPEN += pendienteUSD * (tcHoy - tcRef); // >0 = pagar hoy cuesta más PEN (pérdida)
    }
    return { impactoPEN: Math.round(impactoPEN), hayTC: true };
  }, [activas, tcHoy]);

  // ── OCs demoradas · proxy local (en tránsito > 21 días) para el banner de salud ──
  const demoradas = useMemo(
    () => activas.filter((o) => ESTADOS_EN_CURSO.includes(o.estado) && (diasDesde(o.fechaCreacion) ?? 0) > 21),
    [activas],
  );

  // ── §B · Pipeline de abastecimiento · 5 estaciones (count + monto) ──
  // Requerim. = calcularPendientesCompra (fuente única con tab Pendientes).
  // Borrador/En curso/Por pagar = stats/statsExtra (ya existen). Por recibir = OCs en vuelo.
  const pendientesCompra = useMemo(() => calcularPendientesCompra(requerimientos), [requerimientos]);
  const resPendientes = useMemo(() => resumenPendientes(pendientesCompra), [pendientesCompra]);

  // En curso = grupo 'confirmada' (lo que filtra el click) · Por recibir = grupo 'en_despacho'.
  const enCurso = useMemo(() => activas.filter((o) => ESTADOS_CONFIRMADA.includes(o.estado)), [activas]);
  const porRecibir = useMemo(() => activas.filter((o) => ESTADOS_EN_DESPACHO.includes(o.estado)), [activas]);
  const porPagar = useMemo(() => activas.filter((o) => o.estadoPago === 'pendiente' || o.estadoPago === 'parcial'), [activas]);

  const pipeline = useMemo(() => {
    const montoUSD = (lista: OrdenCompra[]) => lista.reduce((s, o) => s + (o.totalUSD || 0), 0);
    const borradores = activas.filter((o) => o.estado === 'borrador');
    // CUELLO de botella = la estación "Por recibir" cuando hay demoradas (radar severo+crítico).
    const demoradasCount = radar.resumen.badge;
    return {
      requerim: { count: resPendientes.totalProductos, monto: resPendientes.totalEstimadoUSD },
      borrador: { count: borradores.length, monto: montoUSD(borradores) },
      enCurso: { count: enCurso.length, monto: montoUSD(enCurso) },
      porRecibir: { count: porRecibir.length, monto: montoUSD(porRecibir), demoradas: demoradasCount, esCuello: demoradasCount > 0 },
      porPagar: { count: statsExtra.ocsConPagoPendiente, monto: statsExtra.montoPendienteUSD },
    };
  }, [activas, resPendientes, enCurso, porRecibir, radar.resumen.badge, statsExtra]);

  // ── §C · Calendario / escalonado de caja (próximas salidas) ──
  // HONESTIDAD: no existe campo de fecha de vencimiento de pago de OC. Estimamos buckets por la
  // antigüedad de la OC sin pagar (proxy de cuándo vence el saldo) · rotulado "estimación".
  const calendarioCaja = useMemo(() => {
    let d7 = 0, d15 = 0, d30 = 0;
    for (const o of porPagar) {
      const tcRef = o.tcReferencial || o.tcCompra || tcHoy || 1;
      const pendUSD = o.montoPendiente ? o.montoPendiente / tcRef : (o.totalUSD || 0);
      if (pendUSD <= 0.01) continue;
      const dias = diasDesde(o.fechaCreacion) ?? 0;
      // Heurística: más antigua = vence antes (más urgente).
      if (dias > 21) d7 += pendUSD;
      else if (dias > 10) d15 += pendUSD;
      else d30 += pendUSD;
    }
    const max = Math.max(d7, d15, d30, 1);
    return { d7, d15, d30, max, hayDatos: d7 + d15 + d30 > 0 };
  }, [porPagar, tcHoy]);

  // ── §C · Concentración × riesgo SRM · % del gasto en proveedores condicionales/sin evaluar ──
  // Deriva de la clasificación SRM (evaluacion.clasificacion · C6). "En riesgo" = condicional +
  // suspendido + sin evaluar. "OK" = preferido + aprobado.
  const concentracionRiesgo = useMemo(() => {
    const clasifPorId = new Map<string, string | undefined>();
    for (const p of proveedores) clasifPorId.set(p.id, p.evaluacion?.clasificacion);
    let gastoRiesgo = 0;
    let total = 0;
    let conClasif = 0;
    for (const o of comprometidas) {
      const monto = o.totalUSD || 0;
      if (monto <= 0) continue;
      total += monto;
      const clasif = o.proveedorId ? clasifPorId.get(o.proveedorId) : undefined;
      if (clasif === 'preferido' || clasif === 'aprobado') conClasif += monto;
      else { gastoRiesgo += monto; if (clasif === 'condicional' || clasif === 'suspendido') conClasif += monto; }
    }
    const pctRiesgo = total > 0 ? Math.round((gastoRiesgo / total) * 100) : 0;
    // Si NINGÚN proveedor está clasificado, el "riesgo" es 100% por defecto (sin evaluar) → fallback honesto.
    const hayClasificacion = conClasif > 0;
    return { pctRiesgo, pctOk: 100 - pctRiesgo, hayClasificacion, total };
  }, [activas, proveedores]);

  // ── §C · Mix del gasto (restock / apuesta / comprometida) · join OC→Requerimiento ──
  // OJO: origen/subtipo viven en el Requerimiento. Unimos vía requerimientoId(s). Si < 30% de las
  // OCs (por monto) tienen origen poblado → fallback honesto (no se inventa el mix).
  const mixGasto = useMemo(() => {
    const reqById = new Map<string, Requerimiento>();
    for (const r of requerimientos) if (r.id) reqById.set(r.id, r);
    let restock = 0, apuesta = 0, comprometida = 0, otrosManual = 0, conOrigen = 0, total = 0;
    for (const o of comprometidas) {
      const monto = o.totalUSD || 0;
      if (monto <= 0) continue;
      total += monto;
      // requerimientoId singular o el primero del multi-req.
      const reqId = o.requerimientoId || (o.requerimientoIds && o.requerimientoIds[0]);
      const req = reqId ? reqById.get(reqId) : undefined;
      if (!req) continue;
      conOrigen += monto;
      if (req.origen === 'demanda_comprometida') comprometida += monto;
      else if (req.subtipo === 'restock') restock += monto;
      else if (req.subtipo === 'apuesta') apuesta += monto;
      else otrosManual += monto;
    }
    const cobertura = total > 0 ? conOrigen / total : 0;
    // Fold "manual" (subtipo manual / sin subtipo) dentro de restock (reposición planificada).
    const base = conOrigen > 0 ? conOrigen : 1;
    const pct = (v: number) => Math.round((v / base) * 100);
    return {
      restock: pct(restock + otrosManual),
      apuesta: pct(apuesta),
      comprometida: pct(comprometida),
      cobertura,
      hayDatos: cobertura >= 0.3 && conOrigen > 0,
    };
  }, [activas, requerimientos]);

  // ── §E · ROP teaser · SKUs bajo punto de reorden (motor stockReorden via productoIntelStore) ──
  // NO dispara la carga pesada (cargarDatos) · solo lee el estado SI ya está poblado (canon perf).
  const sugerenciasReposicion = useProductoIntelStore((s) => s.sugerenciasReposicion);
  const ropTeaser = useMemo(() => {
    if (!sugerenciasReposicion || sugerenciasReposicion.length === 0) return { count: 0, cargado: false };
    const bajoROP = sugerenciasReposicion.filter((s) => {
      const rop = s.puntoReorden ?? s.stockMinimo;
      const stock = s.stockNeto ?? s.stockActual;
      return rop > 0 && stock <= rop;
    });
    return { count: bajoROP.length, cargado: true };
  }, [sugerenciasReposicion]);

  // ── Unidades por llegar (§E cross-link Inventario) · reusa el cómputo del radar (OCs en vuelo) ──
  const unidadesPorLlegar = radar.unidades.total;

  // ── §F alertas accionables (por pagar top + demoradas del radar) ──
  const alertasPorPagar = useMemo(() => {
    return porPagar
      .map((o) => {
        const tcRef = o.tcReferencial || o.tcCompra || tcHoy || 1;
        const pendUSD = o.montoPendiente ? o.montoPendiente / tcRef : (o.totalUSD || 0);
        return { oc: o, pendUSD };
      })
      .filter((x) => x.pendUSD > 0.01)
      .sort((a, b) => b.pendUSD - a.pendUSD)
      .slice(0, 2);
  }, [porPagar, tcHoy]);

  // ── §A banner de salud ──
  const banner = useMemo(() => {
    const porPagarCount = statsExtra.ocsConPagoPendiente;
    const borradores = stats?.borradores ?? 0;
    const señales: { strong: string; resto: string }[] = [];
    if (porPagarCount > 0) señales.push({ strong: `${porPagarCount} OC${porPagarCount > 1 ? 's' : ''}`, resto: ' por pagar' });
    if (demoradas.length > 0) señales.push({ strong: `${demoradas.length}`, resto: ` envío${demoradas.length > 1 ? 's' : ''} demorado${demoradas.length > 1 ? 's' : ''}` });
    if (borradores > 0) señales.push({ strong: `${borradores}`, resto: ` borrador${borradores > 1 ? 'es' : ''} sin confirmar` });
    const nivel: 'verde' | 'amber' | 'rojo' = demoradas.length > 0 ? 'rojo' : (porPagarCount > 0 || borradores > 0) ? 'amber' : 'verde';
    return { nivel, señales };
  }, [stats, statsExtra, demoradas]);

  const sinDatos = activas.length === 0;

  // ════════════════════ EMPTY STATE · modelo estándar (sin OCs) ════════════════════
  // (El esqueleto fantasma de la anatomía fue retirado a pedido del titular · 2026-07-03)
  if (sinDatos) {
    return (
      <div className="bg-slate-50/30 p-4 sm:p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ShoppingCart className="w-7 h-7 text-blue-300" />
          </div>
          <div className="text-[15px] font-bold text-slate-900">Aún no hay órdenes de compra</div>
          <p className="text-[12px] text-slate-500 mt-1 max-w-sm mx-auto">
            El resumen ejecutivo — salud de compras, gasto por proveedor, tendencia e insights —
            cobra vida cuando registres tu primera OC.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            <button
              type="button"
              onClick={onNuevaOC}
              className="bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Nueva orden de compra
            </button>
            <button
              type="button"
              onClick={() => onIrTab('pendientes')}
              className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-[12px] font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5"
            >
              <ClipboardList className="w-3.5 h-3.5" /> Ver pendientes
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════ DASHBOARD §A→§F · Layout A (main 2 + aside 1) ════════════════════
  const NIVEL = {
    verde: { grad: 'from-emerald-50 to-emerald-100/30', ring: 'ring-emerald-200/60', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', titulo: 'text-emerald-900', texto: 'text-emerald-700', btn: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50', Icon: CheckCircle2, label: 'Compras al día' },
    amber: { grad: 'from-amber-50 to-amber-100/30', ring: 'ring-amber-200/60', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', titulo: 'text-amber-900', texto: 'text-amber-700', btn: 'text-amber-700 border-amber-200 hover:bg-amber-50', Icon: AlertTriangle, label: 'Compras con atención' },
    rojo: { grad: 'from-rose-50 to-rose-100/30', ring: 'ring-rose-200/60', iconBg: 'bg-rose-100', iconColor: 'text-rose-600', titulo: 'text-rose-900', texto: 'text-rose-700', btn: 'text-rose-700 border-rose-200 hover:bg-rose-50', Icon: AlertTriangle, label: 'Compras requieren acción' },
  }[banner.nivel];

  return (
    <div className="bg-slate-50/30 p-3 sm:p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ═════════ MAIN (col-span-2) ═════════ */}
        <div className="md:col-span-2 space-y-4">

          {/* §A · COLA DE FIRMAS DE SOCIO · de autorizacion.estado===pendiente (>umbral) */}
          {colaFirmas.count > 0 && (
            <div className="bg-gradient-to-r from-violet-50 to-violet-100/30 ring-1 ring-violet-200/60 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0"><UserCheck className="w-5 h-5 text-violet-600" /></div>
                  <div>
                    <div className="text-[14px] font-bold text-violet-900">{colaFirmas.count} OC{colaFirmas.count > 1 ? 's' : ''} · {fmtUSD(colaFirmas.montoUSD)} {colaFirmas.count > 1 ? 'esperan' : 'espera'} {esSocio ? 'tu firma de socio' : 'firma de socio'}</div>
                    <div className="text-[12px] text-violet-700">Superan el umbral de doble firma (&gt; {fmtUSD(UMBRAL_AUTORIZACION_SOCIO_USD)}) · {esSocio ? 'quien entra al hub es quien firma' : 'pendientes de autorización societaria'}</div>
                  </div>
                </div>
                <button onClick={() => onVerOC(colaFirmas.ocs[0])} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold px-3.5 py-2 rounded-lg shadow-sm flex-shrink-0">
                  <PenLine className="w-4 h-4" /> Revisar firmas
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {colaFirmas.ocs.slice(0, 4).map((oc) => (
                  <div key={oc.id} className="bg-white/70 border border-violet-100 rounded-lg px-3 py-2 flex items-center justify-between text-[12px]">
                    <span className="text-slate-700 tabular-nums truncate">{oc.numeroOrden} · {oc.nombreProveedor} <span className="text-slate-400">·</span> {fmtUSD(oc.totalUSD || 0)}</span>
                    <button onClick={() => onVerOC(oc)} className="text-[11px] font-bold text-violet-700 hover:underline whitespace-nowrap">{esSocio ? 'Firmar →' : 'Ver →'}</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* §A · BANNER DE SALUD DE LA SECCIÓN */}
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

          {/* §B · BANDA "PIPELINE DE ABASTECIMIENTO" · 5 estaciones · clickable · cuello en rose */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Pipeline de abastecimiento</div>
                <div className="text-[11px] text-slate-400">de la demanda al pago · clic en una estación filtra Órdenes</div>
              </div>
              <GitMerge className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {/* 1 Requerimiento */}
              <button onClick={() => onIrTab('pendientes')} className="flex-1 min-w-[110px] bg-blue-50 border border-blue-200 rounded-xl p-3 text-left hover:border-blue-300 transition-colors">
                <div className="flex items-center gap-1.5 mb-1.5"><ClipboardList className="w-3.5 h-3.5 text-blue-600" /><span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Requerim.</span></div>
                <div className="text-xl font-bold tabular-nums text-blue-900">{pipeline.requerim.count}</div>
                <div className="text-[10px] text-blue-700 tabular-nums">{fmtUSDk(pipeline.requerim.monto)} por convertir</div>
              </button>
              <div className="flex items-center"><ChevronRight className="w-4 h-4 text-slate-300" /></div>
              {/* 2 Borrador */}
              <button onClick={() => onFiltrarEstado('borrador')} className="flex-1 min-w-[110px] bg-slate-50 border border-slate-200 rounded-xl p-3 text-left hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-1.5 mb-1.5"><FileText className="w-3.5 h-3.5 text-slate-500" /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Borrador</span></div>
                <div className="text-xl font-bold tabular-nums text-slate-900">{pipeline.borrador.count}</div>
                <div className="text-[10px] text-slate-500 tabular-nums">{fmtUSDk(pipeline.borrador.monto)} sin confirmar</div>
              </button>
              <div className="flex items-center"><ChevronRight className="w-4 h-4 text-slate-300" /></div>
              {/* 3 En curso */}
              <button onClick={() => onFiltrarEstado('confirmada')} className="flex-1 min-w-[110px] bg-sky-50 border border-sky-200 rounded-xl p-3 text-left hover:border-sky-300 transition-colors">
                <div className="flex items-center gap-1.5 mb-1.5"><Truck className="w-3.5 h-3.5 text-sky-600" /><span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">En curso</span></div>
                <div className="text-xl font-bold tabular-nums text-sky-900">{pipeline.enCurso.count}</div>
                <div className="text-[10px] text-sky-700 tabular-nums">{fmtUSDk(pipeline.enCurso.monto)} en tránsito</div>
              </button>
              <div className="flex items-center"><ChevronRight className="w-4 h-4 text-slate-300" /></div>
              {/* 4 Por recibir · CUELLO DE BOTELLA (rose) */}
              <button onClick={() => onFiltrarEstado('en_despacho')} className={`flex-1 min-w-[110px] rounded-xl p-3 text-left transition-colors ${pipeline.porRecibir.esCuello ? 'bg-rose-50 border border-rose-300 ring-1 ring-rose-200 hover:border-rose-400' : 'bg-slate-50 border border-slate-200 hover:border-slate-300'}`}>
                <div className="flex items-center gap-1.5 mb-1.5"><PackageSearch className={`w-3.5 h-3.5 ${pipeline.porRecibir.esCuello ? 'text-rose-600' : 'text-slate-500'}`} /><span className={`text-[10px] font-bold uppercase tracking-wider ${pipeline.porRecibir.esCuello ? 'text-rose-700' : 'text-slate-600'}`}>Por recibir</span></div>
                <div className={`text-xl font-bold tabular-nums ${pipeline.porRecibir.esCuello ? 'text-rose-900' : 'text-slate-900'}`}>{pipeline.porRecibir.count}</div>
                {pipeline.porRecibir.esCuello ? (
                  <div className="text-[10px] text-rose-700 tabular-nums flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" /> cuello · {pipeline.porRecibir.demoradas} demoradas</div>
                ) : (
                  <div className="text-[10px] text-slate-500 tabular-nums">{fmtUSDk(pipeline.porRecibir.monto)} en camino</div>
                )}
              </button>
              <div className="flex items-center"><ChevronRight className="w-4 h-4 text-slate-300" /></div>
              {/* 5 Por pagar */}
              <button onClick={() => onFiltrarEstado('__por_pagar__')} className="flex-1 min-w-[110px] bg-amber-50 border border-amber-200 rounded-xl p-3 text-left hover:border-amber-300 transition-colors">
                <div className="flex items-center gap-1.5 mb-1.5"><CreditCard className="w-3.5 h-3.5 text-amber-600" /><span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Por pagar</span></div>
                <div className="text-xl font-bold tabular-nums text-amber-900">{pipeline.porPagar.count}</div>
                <div className="text-[10px] text-amber-700 tabular-nums">{fmtUSDk(pipeline.porPagar.monto)} saldo</div>
              </button>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 flex items-start gap-1.5"><Info className="w-3 h-3 flex-shrink-0 mt-0.5" /><span>Clic en una estación filtra Órdenes · el cuello (rojo) marca dónde se acumulan las llegadas demoradas.</span></div>
          </div>

          {/* §B · DONUT CLICKABLE + TENDENCIA LÍNEA/ÁREA */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* DONUT · gasto por proveedor · CLICKABLE */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Gasto por proveedor</div>
                  <div className="text-[11px] text-slate-400">clic en un segmento → Órdenes filtrado</div>
                </div>
                <PieChart className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-center gap-4">
                <svg viewBox="0 0 36 36" className="w-24 h-24 flex-shrink-0">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.6" />
                  {porProveedor.segmentos.map((s, i) => (
                    <circle key={i} cx="18" cy="18" r="15.9" fill="none" stroke={s.color} strokeWidth="3.6"
                      strokeDasharray={`${s.pct} ${100 - s.pct}`} strokeDashoffset={s.offset}
                      className={s.proveedorId ? 'cursor-pointer hover:opacity-80' : ''}
                      onClick={s.proveedorId ? () => onFiltrarProveedor(s.proveedorId) : undefined} />
                  ))}
                  <text x="18" y="20" textAnchor="middle" className="tabular-nums" style={{ fontSize: '5px', fontWeight: 700, fill: '#0f172a' }}>{fmtUSDk(porProveedor.total)}</text>
                </svg>
                <div className="flex-1 space-y-1.5 text-[12px]">
                  {porProveedor.top.map((t, i) => (
                    <button key={i} onClick={() => t.proveedorId && onFiltrarProveedor(t.proveedorId)} className="w-full flex items-center justify-between hover:bg-slate-50 rounded px-1 py-0.5">
                      <span className="flex items-center gap-1.5 min-w-0"><span className={`w-2 h-2 rounded-full ${DONUT_DOT[i]} flex-shrink-0`} /><span className="truncate">{t.nombre}</span></span>
                      <span className="tabular-nums font-semibold text-slate-700 flex-shrink-0">{Math.round(t.pct)}%</span>
                    </button>
                  ))}
                  {porProveedor.otrosCount > 0 && (
                    <button onClick={() => onIrTab('proveedores')} className="w-full flex items-center justify-between hover:bg-slate-50 rounded px-1 py-0.5">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400" /> Otros ({porProveedor.otrosCount})</span>
                      <span className="tabular-nums font-semibold text-slate-700">{Math.round(porProveedor.otrosPct)}%</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            {/* TENDENCIA 6m · LÍNEA/ÁREA + línea de promedio */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Tendencia de compras · 6 meses</div>
                  <div className="text-[11px] text-slate-400">valor importado por mes (USD)</div>
                </div>
                <Activity className="w-4 h-4 text-slate-400" />
              </div>
              {/* área + línea + promedio */}
              <svg viewBox="0 0 300 100" className="w-full h-28" preserveAspectRatio="none">
                <defs><linearGradient id="areaFillCompras" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0" /></linearGradient></defs>
                {/* área */}
                <path d={tendencia.areaPath} fill="url(#areaFillCompras)" />
                {/* línea */}
                <path d={tendencia.linePath} fill="none" stroke="#3b82f6" strokeWidth="2" />
                {/* línea de promedio (dashed) */}
                <line x1="0" y1={tendencia.promedioY} x2="300" y2={tendencia.promedioY} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" />
                {/* punto del mes actual */}
                <circle cx={tendencia.ultimo.x} cy={tendencia.ultimo.y} r="3" fill="#3b82f6" />
              </svg>
              <div className="flex items-center justify-between text-[9px] text-slate-400 -mt-1">
                {tendencia.meses.map((m, i) => (
                  <span key={i} className={m.esActual ? 'text-blue-700 font-bold' : ''}>{m.label}</span>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-amber-600 flex items-center gap-1"><span className="w-3 h-px bg-amber-400 inline-block" /> Promedio {fmtUSDk(tendencia.promedio)}</span>
                <span className="text-blue-700 font-semibold tabular-nums">{tendencia.actual.label} {fmtUSDk(tendencia.actual.monto)}{tendencia.deltaPct !== null ? ` · ${tendencia.deltaPct >= 0 ? '+' : ''}${tendencia.deltaPct}%` : ''}</span>
              </div>
            </div>
          </div>

          {/* §C · INSIGHTS · row 1: lead/concentración/cumplimiento/FX (preservados) */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 ml-1">Insights del mes</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Lead time · desglose REAL por pierna (proveedor + viajero · del scorecard leadTimePiernas
                  que el radar ya computa). El mockup pedía tránsito/aduana pero ese corte NO es computable
                  (sin timestamp de aduana) → proveedor/viajero es el desglose honesto con el dato que existe.
                  Fallback al span único creación→recepción si aún no hay envíos cerrados medibles. */}
              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1"><Clock className="w-3.5 h-3.5 text-sky-600" /><span className="text-[10px] uppercase tracking-wider text-sky-700 font-bold">Lead time · desglose</span></div>
                {(radar.leadTimePierna.proveedor || radar.leadTimePierna.viajero) ? (
                  <>
                    <div className="text-[13px] text-slate-600 leading-snug tabular-nums">
                      <b className="text-slate-800">{radar.leadTimePierna.proveedor ? `${radar.leadTimePierna.proveedor.promedio}d` : '—'}</b> proveedor + <b className="text-slate-800">{radar.leadTimePierna.viajero ? `${radar.leadTimePierna.viajero.promedio}d` : '—'}</b> viajero
                    </div>
                    <div className="text-[11px] text-slate-500 leading-snug mt-0.5">promedio sobre {Math.max(radar.leadTimePierna.proveedor?.n ?? 0, radar.leadTimePierna.viajero?.n ?? 0)} envío(s) cerrado(s)</div>
                  </>
                ) : (
                  <>
                    <div className="text-[18px] font-bold tabular-nums text-slate-900">{leadTime.promedio !== null ? `${leadTime.promedio} días` : '—'}</div>
                    <div className="text-[11px] text-slate-500 leading-snug">{leadTime.promedio !== null ? 'creación → recepción' : 'sin recepciones registradas aún'}</div>
                  </>
                )}
              </div>
              {/* Concentración */}
              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1"><Building2 className="w-3.5 h-3.5 text-blue-600" /><span className="text-[10px] uppercase tracking-wider text-blue-700 font-bold">Concentración</span></div>
                <div className="text-[18px] font-bold tabular-nums text-slate-900">{porProveedor.top3pct}<span className="text-slate-400">%</span></div>
                <div className="text-[11px] text-slate-500 leading-snug">en tus top {Math.min(3, porProveedor.top.length)} proveedores</div>
              </div>
              {/* Cumplimiento pago */}
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

          {/* §C · INSIGHTS · row 2 · calendario de caja + concentración×riesgo + mix origen */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* CALENDARIO/ESCALONADO DE CAJA · de montoPendiente+antigüedad · estimación */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5 text-amber-600" /><span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">Próximas salidas de caja</span></div>
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1"><Plug className="w-2.5 h-2.5" /> estimación</span>
              </div>
              {calendarioCaja.hayDatos ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between"><span className="text-[11px] text-slate-600">Próximos <b className="text-slate-800">7d</b></span><span className="text-[13px] font-bold tabular-nums text-rose-700">{fmtUSD(calendarioCaja.d7)}</span></div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-rose-400 rounded-full" style={{ width: `${(calendarioCaja.d7 / calendarioCaja.max) * 100}%` }} /></div>
                  <div className="flex items-center justify-between"><span className="text-[11px] text-slate-600"><b className="text-slate-800">15d</b></span><span className="text-[13px] font-bold tabular-nums text-amber-700">{fmtUSD(calendarioCaja.d15)}</span></div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-amber-400 rounded-full" style={{ width: `${(calendarioCaja.d15 / calendarioCaja.max) * 100}%` }} /></div>
                  <div className="flex items-center justify-between"><span className="text-[11px] text-slate-600"><b className="text-slate-800">30d</b></span><span className="text-[13px] font-bold tabular-nums text-slate-700">{fmtUSD(calendarioCaja.d30)}</span></div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-slate-400 rounded-full" style={{ width: `${(calendarioCaja.d30 / calendarioCaja.max) * 100}%` }} /></div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 leading-snug py-2">Sin saldos por pagar · no hay salidas de caja proyectadas</div>
              )}
            </div>
            {/* CONCENTRACIÓN × RIESGO · TEASER comprimido (22% + barra riesgo/ok) */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2"><ShieldAlert className="w-3.5 h-3.5 text-rose-600" /><span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">Compra × riesgo SRM</span></div>
              {concentracionRiesgo.hayClasificacion ? (
                <>
                  <div className="text-2xl font-bold tabular-nums text-rose-900">{concentracionRiesgo.pctRiesgo}<span className="text-rose-300">%</span></div>
                  <div className="text-[11px] text-slate-500 leading-snug mb-2">del gasto en proveedores condicionales / sin evaluar</div>
                  {/* barra 2-tramos (riesgo vs ok) */}
                  <div className="flex h-2.5 rounded-full overflow-hidden">
                    <div className="bg-rose-400" style={{ width: `${concentracionRiesgo.pctRiesgo}%` }} title="En riesgo (condic. + sin evaluar)" />
                    <div className="bg-emerald-200" style={{ width: `${concentracionRiesgo.pctOk}%` }} title="OK (preferido + aprobado)" />
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold tabular-nums text-slate-300">—</div>
                  <div className="text-[11px] text-slate-500 leading-snug mb-2">aún sin proveedores evaluados · clasificá en Proveedores para ver el riesgo del gasto</div>
                </>
              )}
              <button onClick={() => onIrTab('proveedores')} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:underline">Ver desglose en Proveedores <ArrowRight className="w-3 h-3" /></button>
            </div>
            {/* MIX apuesta/restock/comprometida · de Requerimiento.origen vía requerimientoId */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-blue-600" /><span className="text-[10px] uppercase tracking-wider text-blue-700 font-bold">Mix del gasto</span></div>
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1"><Plug className="w-2.5 h-2.5" /> vía requerimientoId</span>
              </div>
              {mixGasto.hayDatos ? (
                <div className="space-y-2 text-[11px]">
                  <div><div className="flex justify-between mb-0.5"><span className="flex items-center gap-1.5 text-slate-600"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Restock</span><span className="tabular-nums font-bold text-slate-800">{mixGasto.restock}%</span></div><div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${mixGasto.restock}%` }} /></div></div>
                  <div><div className="flex justify-between mb-0.5"><span className="flex items-center gap-1.5 text-slate-600"><span className="w-2 h-2 rounded-full bg-purple-500" /> Apuesta</span><span className="tabular-nums font-bold text-slate-800">{mixGasto.apuesta}%</span></div><div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${mixGasto.apuesta}%` }} /></div></div>
                  <div><div className="flex justify-between mb-0.5"><span className="flex items-center gap-1.5 text-slate-600"><span className="w-2 h-2 rounded-full bg-sky-500" /> Comprometida</span><span className="tabular-nums font-bold text-slate-800">{mixGasto.comprometida}%</span></div><div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-sky-500 rounded-full" style={{ width: `${mixGasto.comprometida}%` }} /></div></div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 leading-snug py-2">Sin datos de origen aún · las OCs todavía no enlazan requerimiento con origen poblado</div>
              )}
            </div>
          </div>

          {/* §D · ACCIONES RÁPIDAS */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 ml-1">Acciones rápidas</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={onNuevaOC} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50/30 text-left transition-colors"><Plus className="w-4 h-4 text-blue-600 mb-1.5" /><div className="text-[12px] font-bold text-slate-900">Nueva orden de compra</div><div className="text-[10px] text-slate-500">wizard 5 pasos</div></button>
              <button onClick={() => onIrTab('pendientes')} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-amber-300 hover:bg-amber-50/30 text-left transition-colors"><ShoppingCart className="w-4 h-4 text-amber-600 mb-1.5" /><div className="text-[12px] font-bold text-slate-900">Generar compra</div><div className="text-[10px] text-slate-500">consolida requerimientos pendientes</div></button>
              <button onClick={() => colaFirmas.count > 0 ? onVerOC(colaFirmas.ocs[0]) : onIrTab('ordenes')} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-violet-300 hover:bg-violet-50/30 text-left transition-colors"><PenLine className="w-4 h-4 text-violet-600 mb-1.5" /><div className="text-[12px] font-bold text-slate-900">Revisar firmas</div><div className="text-[10px] text-slate-500">{colaFirmas.count > 0 ? `${colaFirmas.count} OC${colaFirmas.count > 1 ? 's' : ''} ${colaFirmas.count > 1 ? 'esperan' : 'espera'} tu firma` : 'sin firmas pendientes'}</div></button>
            </div>
          </div>

        </div>

        {/* ═════════ ASIDE (col-span-1) · contexto persistente ═════════ */}
        <aside className="md:col-span-1 space-y-4">

          {/* §F · ALERTAS · INCIDENCIAS ABIERTAS + $ disputa + demoradas + por pagar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">§F · Alertas</span>
              <Bell className="w-4 h-4 text-slate-400" />
            </div>
            <div className="space-y-2">
              {/* incidencias agregadas + reclamos por cobrar (del radar · listAll) */}
              {radar.teaser.incidenciasAbiertas > 0 && (
                <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" /><span className="text-[12px] font-semibold text-rose-900">{radar.teaser.incidenciasAbiertas} incidencia{radar.teaser.incidenciasAbiertas > 1 ? 's' : ''} abierta{radar.teaser.incidenciasAbiertas > 1 ? 's' : ''}</span></div>
                  {radar.teaser.reclamosPorCobrar > 0 && (
                    <div className="text-[11px] text-rose-700 mt-0.5 ml-6">{fmtPEN(radar.teaser.reclamosMontoPEN)} en reclamos por cobrar</div>
                  )}
                  <div className="mt-1.5 ml-6"><button onClick={() => onIrTab('inteligencia')} className="text-[11px] font-bold text-rose-700 hover:underline">Ver en Inteligencia →</button></div>
                </div>
              )}
              {/* demoradas (top del radar) */}
              {radar.filas.slice(0, 1).map((f) => (
                <div key={f.id} className="bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0"><Truck className="w-4 h-4 text-amber-600 flex-shrink-0" /><span className="text-[12px] text-amber-900 truncate"><strong>{f.numero}</strong> demorada · {f.diasEnVuelo} días</span></div>
                  <button onClick={() => onVerOC(f.orden)} className="text-[11px] font-bold text-amber-700 hover:underline whitespace-nowrap">Ver →</button>
                </div>
              ))}
              {/* por pagar (top) */}
              {alertasPorPagar.map(({ oc, pendUSD }) => (
                <div key={oc.id} className="bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0"><CreditCard className="w-4 h-4 text-rose-600 flex-shrink-0" /><span className="text-[12px] text-rose-900 truncate"><strong>{oc.numeroOrden} · {fmtUSD(pendUSD)}</strong></span></div>
                  <button onClick={() => onVerOC(oc)} className="text-[11px] font-bold text-rose-700 hover:underline whitespace-nowrap">Pagar →</button>
                </div>
              ))}
              {/* sin alertas */}
              {radar.teaser.incidenciasAbiertas === 0 && radar.filas.length === 0 && alertasPorPagar.length === 0 && (
                <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span className="text-[12px] text-emerald-900">Todo al día · sin incidencias ni pagos vencidos</span>
                </div>
              )}
            </div>
          </div>

          {/* §E · CROSS-LINKS 360 · con cifras pobladas + ROP teaser */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-3">§E · Conecta con · 360</div>
            <div className="space-y-2">
              {/* Requerimientos por convertir · POBLADO (calcularPendientesCompra) */}
              <button onClick={() => onIrTab('pendientes')} className="w-full bg-gradient-to-r from-blue-50 to-blue-100/20 border border-blue-200 rounded-lg p-3 flex items-center justify-between hover:border-blue-300 cursor-pointer text-left">
                <div><div className="text-[12px] font-bold text-slate-900">Requerimientos</div><div className="text-[11px] text-blue-700 tabular-nums">{pipeline.requerim.count} por convertir · {fmtUSDk(pipeline.requerim.monto)}</div></div><ArrowRight className="w-4 h-4 text-blue-600" />
              </button>
              {/* TEASER señal de reorden ROP · linkea el motor (NO duplica · no fuerza la carga) */}
              <button onClick={() => navigate('/intel-productos')} className="w-full bg-gradient-to-r from-orange-50 to-orange-100/20 border border-orange-200 rounded-lg p-3 flex items-center justify-between hover:border-orange-300 cursor-pointer text-left">
                <div><div className="text-[12px] font-bold text-slate-900">Stock · reorden</div><div className="text-[11px] text-orange-700 tabular-nums">{ropTeaser.cargado ? `${ropTeaser.count} SKUs bajo punto de reorden` : 'ver SKUs bajo punto de reorden'}</div></div><ArrowRight className="w-4 h-4 text-orange-600" />
              </button>
              <button onClick={() => navigate('/envios')} className="w-full bg-gradient-to-r from-orange-50 to-orange-100/20 border border-orange-200 rounded-lg p-3 flex items-center justify-between hover:border-orange-300 cursor-pointer text-left">
                <div><div className="text-[12px] font-bold text-slate-900">Envíos</div><div className="text-[11px] text-orange-700 tabular-nums">{statsExtra.enviosActivosVinculados} en tránsito</div></div><ArrowRight className="w-4 h-4 text-orange-600" />
              </button>
              <button onClick={() => navigate('/inventario')} className="w-full bg-gradient-to-r from-orange-50 to-orange-100/20 border border-orange-200 rounded-lg p-3 flex items-center justify-between hover:border-orange-300 cursor-pointer text-left">
                <div><div className="text-[12px] font-bold text-slate-900">Inventario</div><div className="text-[11px] text-orange-700 tabular-nums">{unidadesPorLlegar.toLocaleString('es-PE')} u. por llegar</div></div><ArrowRight className="w-4 h-4 text-orange-600" />
              </button>
              <button onClick={() => navigate('/finanzas')} className="w-full bg-gradient-to-r from-teal-50 to-teal-100/20 border border-teal-200 rounded-lg p-3 flex items-center justify-between hover:border-teal-300 cursor-pointer text-left">
                <div><div className="text-[12px] font-bold text-slate-900">Finanzas</div><div className="text-[11px] text-teal-700 tabular-nums">{fmtUSDk(statsExtra.montoPendienteUSD)} por pagar</div></div><ArrowRight className="w-4 h-4 text-teal-600" />
              </button>
            </div>
            <div className="mt-2 text-[9px] text-slate-400 flex items-start gap-1.5"><Info className="w-3 h-3 flex-shrink-0 mt-0.5" /><span>Requerimientos = calcularPendientesCompra · ROP = motor stockReorden (cifra al abrir Stock).</span></div>
          </div>

        </aside>
      </div>
    </div>
  );
};
