import React, { useEffect, useMemo, useState } from 'react';
import {
  Coins, Eye, Wallet, Hourglass, FileClock, Calculator, PackageX, TrendingDown,
  TrendingUp, HandCoins, Receipt, Landmark, ArrowRight, Check, CalendarClock,
  DollarSign, PiggyBank, Plus, ShieldCheck, Plug,
} from 'lucide-react';
import type { OrdenCompra } from '../../../types/ordenCompra.types';
import type { Envio } from '../../../types/envio.types';
import type { IncidenciaOC } from '../../../types/incidenciaOC.types';
import type { Gasto } from '../../../types/gasto.types';
import { TIPOS_GASTO_LABELS } from '../../../types/gasto.types';
import {
  pendienteUsdDeOC,
  esDeudaViva,
  diasDesdeImpacto,
  calcularCalendarioCajaCompras,
  calcularExposicionFxCompras,
} from '../impactoCompras.helper';

// Tab "Impacto financiero" · 4ª tab del hub de Compras (tras Pendientes) · LENTE DE DINERO
// DE SOLO-LECTURA (idea del titular · aprobada 2026-07-03). Pixel del mockup
// docs/mockups/compras-master-v1.html · ACTO 16 (§A-§E · líneas 4276-4740).
//
// Canon no-redundancia · 3 adjudicaciones YA decididas (2026-07-03):
//  1. Strip = número · tab = desglose: el strip da "Por pagar $X" — aquí NO se clona esa
//     card: se ABRE en aging por proveedor (§B) y calendario (§E).
//  2. Inteligencia = operativo · Impacto = dinero: las incidencias siguen en Inteligencia
//     con su ángulo operativo (tasa · mix) — aquí solo entra su ángulo de DINERO (§D).
//  3. Calendario de caja + FX MIGRARON del Resumen: viven aquí como detalle (§E) · el
//     Resumen quedó con un teaser de 1 línea (impactoCompras.helper = fuente única).
//
// HONESTIDAD del modelo: no existen fechas de vencimiento pactadas → §B se rotula
// "antigüedad de la deuda" y §E "estimación". Los agregados de dinero EXCLUYEN
// borradores (c52e904) salvo la simulación §C (ese es su punto).

interface StatsExtraImpacto {
  montoPendienteUSD: number;
  ocsConPagoPendiente: number;
}

interface TabImpactoComprasProps {
  ordenes: OrdenCompra[];
  statsExtra: StatsExtraImpacto;
  tcHoy: number;
  envios: Envio[];
  /** Incidencias cross-OC (fetch único del padre) · null = cargando. */
  incidencias: IncidenciaOC[] | null;
  onNuevaOC: () => void;
  navigate: (path: string) => void;
}

const fmtUSD = (n: number): string => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const fmtPEN = (n: number): string => `S/ ${Math.abs(n).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;

/** Canon F7 · decimales atenuados en el dato héroe del KPI. */
const partesMonto = (n: number): { ent: string; dec: string } => {
  const [ent, dec] = n.toFixed(2).split('.');
  return { ent: Number(ent).toLocaleString('en-US'), dec: `.${dec}` };
};

const TIPOS_MERMA = ['merma_transferencia', 'merma_vencimiento', 'desmedro'] as const;

const esMesActual = (v: unknown): boolean => {
  const o = v as { toDate?: () => Date } | Date | null | undefined;
  const d = o instanceof Date ? o : (o && typeof o.toDate === 'function' ? o.toDate() : null);
  if (!d) return false;
  const ahora = new Date();
  return d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth();
};

interface PerdidaItem {
  key: string;
  titulo: string;
  sub: string;
  usd: number;
}

interface ReclamoItem {
  key: string;
  titulo: string;
  sub: string;
  pen: number;
}

const ESTADO_RECLAMO_LABEL: Record<string, string> = {
  pendiente: 'reclamo pendiente de respuesta',
  aceptado: 'aceptado · espera nota de crédito',
};

export const TabImpactoCompras: React.FC<TabImpactoComprasProps> = ({
  ordenes, statsExtra, tcHoy, envios, incidencias, onNuevaOC, navigate,
}) => {
  const activas = useMemo(() => ordenes.filter((o) => o.estado !== 'cancelada'), [ordenes]);
  const comprometidas = useMemo(() => activas.filter((o) => o.estado !== 'borrador'), [activas]);
  const borradores = useMemo(() => activas.filter((o) => o.estado === 'borrador'), [activas]);

  // ── Gastos de merma del período · fetch lazy acotado (getGastosMesActual = query por mes/año) ──
  const [mermasMes, setMermasMes] = useState<Gasto[] | null | 'error'>(null);
  useEffect(() => {
    let cancelado = false;
    import('../../../services/gasto.service')
      .then(({ gastoService }) => gastoService.getGastosMesActual())
      .then((gastos) => {
        if (cancelado) return;
        setMermasMes(gastos.filter((g) => (TIPOS_MERMA as readonly string[]).includes(g.tipo)));
      })
      .catch(() => { if (!cancelado) setMermasMes('error'); });
    return () => { cancelado = true; };
  }, []);

  // ── §B · Aging de deuda por proveedor · buckets por ANTIGÜEDAD del débito ──
  // (fechaEnviada = cuando la OC se comprometió con el proveedor · fallback fechaCreacion.
  //  NO se inventan fechas de vencimiento pactadas — no existen en el modelo.)
  const aging = useMemo(() => {
    const buckets = [0, 0, 0, 0]; // 0-15d · 16-30d · 31-60d · +60d
    const porProv = new Map<string, { total: number; b: [number, number, number, number] }>();
    const deudas: { oc: OrdenCompra; pendUSD: number; dias: number }[] = [];
    let total = 0;
    for (const o of comprometidas) {
      if (!esDeudaViva(o)) continue;
      const pendUSD = pendienteUsdDeOC(o);
      if (pendUSD <= 0.01) continue;
      const dias = Math.floor(diasDesdeImpacto(o.fechaEnviada ?? o.fechaCreacion) ?? 0);
      const idx = dias <= 15 ? 0 : dias <= 30 ? 1 : dias <= 60 ? 2 : 3;
      buckets[idx] += pendUSD;
      total += pendUSD;
      deudas.push({ oc: o, pendUSD, dias });
      const nombre = o.nombreProveedor || 'Sin proveedor';
      const cur = porProv.get(nombre) || { total: 0, b: [0, 0, 0, 0] as [number, number, number, number] };
      cur.total += pendUSD;
      cur.b[idx] += pendUSD;
      porProv.set(nombre, cur);
    }
    const filas = [...porProv.entries()]
      .map(([nombre, v]) => ({ nombre, total: v.total, b: v.b }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    const masAntiguas = [...deudas].sort((a, b) => b.dias - a.dias).slice(0, 2);
    const pctViejo = total > 0 ? Math.round(((buckets[2] + buckets[3]) / total) * 100) : 0;
    return { buckets, filas, total, masAntiguas, pctViejo, hayDeuda: total > 0.01 };
  }, [comprometidas]);

  // ── §C · Simulación de borradores (los borradores NO suman al strip · c52e904) ──
  // Selección por DES-selección (robusta a cambios de la lista · default: todos marcados).
  const [deseleccionados, setDeseleccionados] = useState<Set<string>>(new Set());
  const simulacion = useMemo(() => {
    const seleccionados = borradores.filter((b) => !deseleccionados.has(b.id));
    const totalSelUSD = seleccionados.reduce((s, o) => s + (o.totalUSD || 0), 0);
    const totalBorradoresUSD = borradores.reduce((s, o) => s + (o.totalUSD || 0), 0);
    const deudaActual = statsExtra.montoPendienteUSD;
    const deudaSim = deudaActual + totalSelUSD;
    const pct = deudaActual > 0 ? Math.round((totalSelUSD / deudaActual) * 100) : null;
    const comprometidoActual = comprometidas.reduce((s, o) => s + (o.totalUSD || 0), 0);
    return {
      seleccionados,
      countSel: seleccionados.length,
      totalSelUSD,
      totalBorradoresUSD,
      deudaActual,
      deudaSim,
      pct,
      comprometidoActual,
      wDeuda: deudaSim > 0 ? (deudaActual / deudaSim) * 100 : 0,
      wSim: deudaSim > 0 ? (totalSelUSD / deudaSim) * 100 : 0,
    };
  }, [borradores, deseleccionados, statsExtra.montoPendienteUSD, comprometidas]);

  const toggleBorrador = (id: string) => {
    setDeseleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── §A/§D · Pérdidas del período · incidencias con impactoRealUSD + gastos de merma ──
  const perdidas = useMemo(() => {
    const items: PerdidaItem[] = [];
    let usd = 0;
    let uds = 0;
    // Incidencias de OC cerradas con pérdida REAL en el mes en curso (ángulo DINERO · el
    // ángulo operativo — tasa/mix — sigue en Inteligencia · adjudicación 2).
    for (const i of incidencias ?? []) {
      const real = i.impactoRealUSD || 0;
      if (real <= 0) continue;
      if (!esMesActual(i.fechaResolucion ?? i.fechaCreacion)) continue;
      usd += real;
      uds += i.cantidad || 0;
      items.push({
        key: `inc-${i.id}`,
        titulo: i.titulo,
        sub: `${i.cantidad ? `${i.cantidad} uds · ` : ''}${i.productoNombre || i.ocNumero}`,
        usd: real,
      });
    }
    // Gastos de merma del mes (merma_transferencia · merma_vencimiento · desmedro).
    if (mermasMes && mermasMes !== 'error') {
      for (const g of mermasMes) {
        const tc = (g.tipoCambio && g.tipoCambio > 0) ? g.tipoCambio : (tcHoy > 0 ? tcHoy : 0);
        const gUsd = tc > 0 ? (g.montoPEN || 0) / tc : 0;
        if (gUsd <= 0) continue;
        usd += gUsd;
        items.push({
          key: `gasto-${g.id}`,
          titulo: g.descripcion || TIPOS_GASTO_LABELS[g.tipo],
          sub: TIPOS_GASTO_LABELS[g.tipo],
          usd: gUsd,
        });
      }
    }
    items.sort((a, b) => b.usd - a.usd);
    return { usd, uds, items, count: items.length, mermaError: mermasMes === 'error', cargando: mermasMes === null };
  }, [incidencias, mermasMes, tcHoy]);

  // ── §A/§D · Por cobrar al proveedor · reclamos abiertos de incidencias de envío (PEN) ──
  // Agregado in-memory sobre envíos ligados a OC (mismo patrón que radar.teaser · aquí SIN
  // acotar a en-vuelo: la lente de dinero cubre TODO reclamo abierto de Compras).
  const reclamos = useMemo(() => {
    const items: ReclamoItem[] = [];
    let pen = 0;
    for (const e of envios) {
      if (!e.ordenCompraId) continue; // solo envíos del ciclo de Compras
      for (const inc of e.incidencias ?? []) {
        const estado = inc.estadoReclamo;
        if (!estado || estado === 'cobrado' || estado === 'rechazado') continue;
        const monto = inc.montoReclamoPEN || 0;
        pen += monto;
        items.push({
          key: `${e.id}-${inc.id}`,
          titulo: inc.descripcion || `Reclamo · ${e.numeroEnvio}`,
          sub: ESTADO_RECLAMO_LABEL[estado] || estado,
          pen: monto,
        });
      }
    }
    items.sort((a, b) => b.pen - a.pen);
    return { pen, items, count: items.length };
  }, [envios]);

  // ── §E · Calendario de caja + Exposición FX (MIGRADOS del Resumen · fuente única helper) ──
  const calendario = useMemo(() => calcularCalendarioCajaCompras(ordenes), [ordenes]);
  const fx = useMemo(() => calcularExposicionFxCompras(ordenes, tcHoy), [ordenes, tcHoy]);

  const deudaViva = partesMonto(statsExtra.montoPendienteUSD);
  const potencial = partesMonto(simulacion.totalBorradoresUSD);
  const perdidasM = partesMonto(perdidas.usd);

  // ════════════════════ EMPTY STATE · honesto (sin OCs activas) ════════════════════
  if (activas.length === 0) {
    return (
      <div className="bg-slate-50/30 p-3 sm:p-4 md:p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-center py-10">
            <PiggyBank className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <div className="text-[13px] font-bold text-slate-900">Compras aún no golpea la caja</div>
            <div className="text-[12px] text-slate-500 mt-1 max-w-[17rem] mx-auto">
              Sin OCs confirmadas no hay deuda, sin borradores no hay nada que simular y sin
              recepciones no hay pérdidas ni reclamos. Esta lente se enciende sola cuando
              confirmes tu primera OC.
            </div>
            <div className="flex items-center justify-center gap-2 mt-4">
              <button type="button" onClick={onNuevaOC} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold px-3.5 py-2 rounded-lg shadow-sm">
                <Plus className="w-4 h-4" /> Nueva OC
              </button>
              <button type="button" onClick={() => navigate('/finanzas')} className="flex items-center gap-1.5 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 text-[12px] font-semibold px-3.5 py-2 rounded-lg">
                <Landmark className="w-4 h-4" /> Ver Cuentas por pagar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50/30 p-3 sm:p-4 md:p-6">
      <div className="space-y-5">

        {/* Aviso · lente de solo-lectura */}
        <div className="flex items-start gap-3 bg-gradient-to-r from-rose-50 to-rose-100/30 ring-1 ring-rose-200/60 rounded-2xl p-4">
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
            <Coins className="w-5 h-5 text-rose-700" />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-bold text-rose-900">Lente de SOLO-LECTURA · no re-implementa módulos</div>
            <div className="text-[12px] text-rose-700 mt-0.5 leading-snug">
              Responde "¿cómo golpea Compras a la caja?" agregando lo que ya vive en otros módulos:
              deuda (Cuentas por pagar · Finanzas) · pérdidas (Gastos / Incidencias) · reclamos al
              proveedor. Aquí NO se paga ni se registra nada — cada bloque cross-linkea a su módulo
              dueño. <span className="font-semibold">La acción de pagar sigue en Finanzas/CC.</span>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-slate-50 text-slate-600 border border-slate-200 flex-shrink-0">
            <Eye className="w-2.5 h-2.5" /> Read-only
          </span>
        </div>

        {/* ============ §A · KPIs de dinero ============ */}
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">§A · El dinero de Compras hoy</span>
            <span className="text-[11px] text-slate-400">fuentes: Cuentas por pagar · borradores · incidencias · reclamos</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Deuda viva */}
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2"><span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">Deuda viva</span><Wallet className="w-3.5 h-3.5 text-amber-700" /></div>
              <div className="text-2xl font-bold tabular-nums text-amber-900">${deudaViva.ent}<span className="text-amber-400">{deudaViva.dec}</span></div>
              <div className="text-[11px] text-amber-700 flex items-center gap-1 mt-1">
                <Hourglass className="w-3 h-3" /> {aging.hayDeuda ? `${aging.pctViejo}% con +30 días · aging §B` : 'sin saldos pendientes'}
              </div>
            </div>
            {/* Compromiso potencial */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 ring-1 ring-indigo-200/50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2"><span className="text-[10px] uppercase tracking-wider text-indigo-700 font-bold">Compromiso potencial</span><FileClock className="w-3.5 h-3.5 text-indigo-700" /></div>
              <div className="text-2xl font-bold tabular-nums text-indigo-900">${potencial.ent}<span className="text-indigo-400">{potencial.dec}</span></div>
              <div className="text-[11px] text-indigo-700 flex items-center gap-1 mt-1">
                <Calculator className="w-3 h-3" /> {borradores.length > 0 ? `${borradores.length} borrador${borradores.length > 1 ? 'es' : ''} · si los ejecutas` : 'sin borradores'}
              </div>
            </div>
            {/* Pérdidas del período */}
            <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2"><span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">Pérdidas del período</span><PackageX className="w-3.5 h-3.5 text-rose-700" /></div>
              <div className="text-2xl font-bold tabular-nums text-rose-900">
                {perdidas.usd > 0 ? (<>${perdidasM.ent}<span className="text-rose-400">{perdidasM.dec}</span></>) : (<span className="text-rose-300">$0</span>)}
              </div>
              <div className="text-[11px] text-rose-700 flex items-center gap-1 mt-1">
                <TrendingDown className="w-3 h-3" /> {perdidas.usd > 0
                  ? `${perdidas.uds > 0 ? `${perdidas.uds} uds · ` : ''}dañado + perdido + merma`
                  : 'se activa con las primeras bajas'}
              </div>
            </div>
            {/* Por cobrar al proveedor */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2"><span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">Por cobrar al proveedor</span><HandCoins className="w-3.5 h-3.5 text-emerald-700" /></div>
              <div className="text-2xl font-bold tabular-nums text-emerald-900">
                {reclamos.count > 0 ? fmtPEN(reclamos.pen) : <span className="text-emerald-300">S/ 0</span>}
              </div>
              <div className="text-[11px] text-emerald-700 flex items-center gap-1 mt-1">
                <Receipt className="w-3 h-3" /> {reclamos.count > 0 ? `${reclamos.count} reclamo${reclamos.count > 1 ? 's' : ''} abierto${reclamos.count > 1 ? 's' : ''}` : 'sin reclamos abiertos'}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" /> El strip da el total "Por pagar" · esta tab lo abre en antigüedad (§B), simulación (§C) y calendario (§E) — strip = número · tab = desglose.
          </p>
        </div>

        {/* ============ §B · Aging de deuda por proveedor ============ */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Hourglass className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <div className="text-[12px] font-bold text-slate-900">§B · Aging de deuda por proveedor</div>
                <div className="text-[10px] text-slate-500">Antigüedad de la deuda · desglose del "Por pagar" del strip · fuente: Cuentas por pagar</div>
              </div>
            </div>
            <button type="button" onClick={() => navigate('/finanzas')} className="flex items-center gap-1.5 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 text-[12px] font-semibold px-3.5 py-2 rounded-lg">
              <Landmark className="w-4 h-4" /> Pagar vive en Finanzas <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {aging.hayDeuda ? (
            <>
              {/* buckets por antigüedad del débito (no hay vencimientos pactados en el modelo) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center mb-4">
                <div className="rounded-lg bg-sky-50 border border-sky-200 p-2"><div className="text-xl font-bold tabular-nums text-sky-700">{fmtUSD(aging.buckets[0])}</div><div className="text-[10px] text-sky-600">0-15 días</div></div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-2"><div className="text-xl font-bold tabular-nums text-amber-700">{fmtUSD(aging.buckets[1])}</div><div className="text-[10px] text-amber-600">16-30 días</div></div>
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-2"><div className="text-xl font-bold tabular-nums text-rose-700">{fmtUSD(aging.buckets[2])}</div><div className="text-[10px] text-rose-600">31-60 días</div></div>
                <div className="rounded-lg bg-rose-100 border border-rose-300 p-2"><div className="text-xl font-bold tabular-nums text-rose-900">{fmtUSD(aging.buckets[3])}</div><div className="text-[10px] text-rose-700">+60 días</div></div>
              </div>

              {/* filas por proveedor · barra apilada por bucket */}
              <div className="space-y-3">
                {aging.filas.map((f) => {
                  const segs = [
                    { w: (f.b[0] / f.total) * 100, cls: 'bg-sky-400', label: '0-15d', monto: f.b[0] },
                    { w: (f.b[1] / f.total) * 100, cls: 'bg-amber-400', label: '16-30d', monto: f.b[1] },
                    { w: (f.b[2] / f.total) * 100, cls: 'bg-rose-400', label: '31-60d', monto: f.b[2] },
                    { w: (f.b[3] / f.total) * 100, cls: 'bg-rose-600', label: '+60d', monto: f.b[3] },
                  ].filter((s) => s.monto > 0.01);
                  return (
                    <div key={f.nombre}>
                      <div className="flex items-center justify-between mb-1 text-[11px]">
                        <span className="font-semibold text-slate-700">{f.nombre}</span>
                        <span className="font-bold tabular-nums text-slate-900">{fmtUSD(f.total)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex">
                        {segs.map((s, i) => (
                          <div key={i} className={`h-full ${s.cls}`} style={{ width: `${s.w}%` }} />
                        ))}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                        {segs.map((s, i) => `${i > 0 ? ' · ' : ''}${s.label} ${fmtUSD(s.monto)}`).join('')}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Hourglass className="w-3.5 h-3.5 text-rose-500" /> Deuda más antigua:{' '}
                  {aging.masAntiguas.map((d, i) => (
                    <React.Fragment key={d.oc.id}>{i > 0 && ' · '}<b className="text-slate-700 tabular-nums">{d.oc.numeroOrden} {fmtUSD(d.pendUSD)} · {d.dias}d</b></React.Fragment>
                  ))}
                </span>
                <span className="text-slate-400 tabular-nums">Σ {fmtUSD(aging.total)} · cuadra con el strip "Por pagar"</span>
              </div>
            </>
          ) : (
            <div className="text-[11px] text-slate-400 leading-snug py-4 text-center">
              Sin deuda viva · las OCs confirmadas están al día (o aún no hay compras confirmadas con saldo).
            </div>
          )}
        </div>

        {/* ============ §C · Simulación de borradores ============ */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Calculator className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <div className="text-[12px] font-bold text-slate-900">§C · Simulación de borradores · ¿y si los ejecutas?</div>
                <div className="text-[10px] text-slate-500">Los borradores NO suman al strip (no son compra) · aquí ves su golpe ANTES de confirmar</div>
              </div>
            </div>
          </div>

          {borradores.length > 0 ? (
            <>
              <div className="space-y-2">
                {borradores.map((b) => {
                  const sel = !deseleccionados.has(b.id);
                  const skus = (b.productos || []).length;
                  const uds = (b.productos || []).reduce((s, p) => s + (p.cantidad || 0), 0);
                  return (
                    <button
                      type="button"
                      key={b.id}
                      onClick={() => toggleBorrador(b.id)}
                      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer text-left ${sel ? 'bg-indigo-50/50 ring-1 ring-indigo-200/50' : 'bg-white ring-1 ring-slate-200'}`}
                    >
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${sel ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 bg-white'}`}>
                        {sel && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-slate-800 truncate">
                          {b.numeroOrden} · {b.nombreProveedor}
                          <span className="inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 border border-slate-200 ml-1">Borrador</span>
                        </div>
                        <div className="text-[10px] text-slate-500 tabular-nums">{skus} SKU{skus === 1 ? '' : 's'} · {uds} uds</div>
                      </div>
                      <span className={`text-[13px] font-bold tabular-nums flex-shrink-0 ${sel ? 'text-indigo-700' : 'text-slate-400'}`}>{fmtUSD(b.totalUSD || 0)}</span>
                    </button>
                  );
                })}
              </div>

              {/* resultado de la simulación */}
              <div className="mt-3 bg-gradient-to-r from-indigo-50 to-indigo-100/30 ring-1 ring-indigo-200/60 rounded-xl p-3">
                <div className="flex items-center justify-between text-[11px] mb-1.5 flex-wrap gap-1">
                  <span className="text-indigo-700 font-semibold">
                    {simulacion.countSel > 0
                      ? `Deuda viva si ejecutas ${simulacion.countSel === borradores.length ? `los ${simulacion.countSel}` : `${simulacion.countSel} de ${borradores.length}`}`
                      : 'Marcá al menos un borrador para simular'}
                  </span>
                  <span className="tabular-nums text-indigo-900 font-bold">
                    {fmtUSD(simulacion.deudaActual)} → {fmtUSD(simulacion.deudaSim)}
                    {simulacion.pct !== null && simulacion.countSel > 0 && <span className="text-indigo-500"> (+{simulacion.pct}%)</span>}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-white/70 overflow-hidden flex">
                  <div className="h-full bg-amber-400" style={{ width: `${simulacion.wDeuda}%` }} />
                  <div className="h-full bg-indigo-500" style={{ width: `${simulacion.wSim}%` }} />
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-indigo-700 flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> deuda actual {fmtUSD(simulacion.deudaActual)}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> borradores {fmtUSD(simulacion.totalSelUSD)}{tcHoy > 0 && simulacion.totalSelUSD > 0 ? ` ≈ ${fmtPEN(simulacion.totalSelUSD * tcHoy)} al TC ${tcHoy.toFixed(3)}` : ''}</span>
                  <span className="ml-auto tabular-nums">Comprometido pasaría de {fmtUSD(simulacion.comprometidoActual)} a {fmtUSD(simulacion.comprometidoActual + simulacion.totalSelUSD)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-[11px] text-slate-400 leading-snug py-4 text-center">
              Sin borradores · nada que simular. Cuando guardes una OC como borrador, acá ves su golpe de caja antes de confirmarla.
            </div>
          )}
        </div>

        {/* ============ §D · Perdido vs por-recuperar ============ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Perdido */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                  <PackageX className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <div className="text-[12px] font-bold text-slate-900">§D · Perdido del período</div>
                  <div className="text-[10px] text-slate-500">dañados · perdidos · merma de recepción</div>
                </div>
              </div>
              <span className="text-[13px] font-bold tabular-nums text-rose-700">{perdidas.usd > 0 ? fmtUSD(perdidas.usd) : '—'}</span>
            </div>
            {perdidas.items.length > 0 ? (
              <div className="space-y-2">
                {perdidas.items.slice(0, 3).map((it) => (
                  <div key={it.key} className="flex items-center justify-between bg-rose-50/40 ring-1 ring-rose-200/40 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-slate-800 truncate">{it.titulo}</div>
                      <div className="text-[10px] text-slate-500 tabular-nums truncate">{it.sub}</div>
                    </div>
                    <span className="text-[13px] font-bold tabular-nums text-rose-700 flex-shrink-0">{fmtUSD(it.usd)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 leading-snug py-3">
                {perdidas.cargando
                  ? 'Cargando pérdidas del período…'
                  : 'Sin pérdidas registradas este período · se activa con las primeras bajas (dañado / perdido / merma).'}
                {perdidas.mermaError && ' No se pudieron leer los gastos de merma — se muestran solo las incidencias.'}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Ya registrado como gasto/merma</span>
              <button type="button" onClick={() => navigate('/gastos')} className="flex items-center gap-1 text-blue-700 font-semibold cursor-pointer">Ver en Gastos <ArrowRight className="w-3 h-3" /></button>
            </div>
          </div>
          {/* Por recuperar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <HandCoins className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <div className="text-[12px] font-bold text-slate-900">Por recuperar · reclamos al proveedor</div>
                  <div className="text-[10px] text-slate-500">reclamos abiertos de incidencias de envío</div>
                </div>
              </div>
              <span className="text-[13px] font-bold tabular-nums text-emerald-700">{reclamos.count > 0 ? fmtPEN(reclamos.pen) : '—'}</span>
            </div>
            {reclamos.items.length > 0 ? (
              <div className="space-y-2">
                {reclamos.items.slice(0, 3).map((it) => (
                  <div key={it.key} className="flex items-center justify-between bg-emerald-50/40 ring-1 ring-emerald-200/40 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-slate-800 truncate">{it.titulo}</div>
                      <div className="text-[10px] text-slate-500 truncate">{it.sub}</div>
                    </div>
                    <span className="text-[13px] font-bold tabular-nums text-emerald-700 flex-shrink-0">{fmtPEN(it.pen)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 leading-snug py-3">
                Sin reclamos abiertos al proveedor · cuando una incidencia de envío tenga reclamo con monto, acá ves cuánto te deben.
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Cada reclamo nace de una incidencia</span>
              <button type="button" onClick={() => navigate('/envios')} className="flex items-center gap-1 text-blue-700 font-semibold cursor-pointer">Ver incidencias en Envíos <ArrowRight className="w-3 h-3" /></button>
            </div>
          </div>
        </div>

        {/* ============ §E · Calendario de caja + Exposición FX (migrados del Resumen) ============ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Calendario de caja */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <CalendarClock className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <div className="text-[12px] font-bold text-slate-900">§E · Calendario de caja</div>
                  <div className="text-[10px] text-slate-500">cuándo golpea la deuda · migrado del Resumen</div>
                </div>
              </div>
              <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1"><Plug className="w-2.5 h-2.5" /> estimación</span>
            </div>
            {calendario.hayDatos ? (
              <>
                <div className="space-y-2.5 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 rounded-full bg-rose-500" /> Próximos 7 días · deuda más antigua</span>
                    <span className="font-bold tabular-nums text-rose-700">{fmtUSD(calendario.d7)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 rounded-full bg-amber-500" /> Próximos 15 días</span>
                    <span className="font-bold tabular-nums text-amber-700">{fmtUSD(calendario.d15)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 rounded-full bg-sky-500" /> Próximos 30 días</span>
                    <span className="font-bold tabular-nums text-sky-700">{fmtUSD(calendario.d30)}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-400 tabular-nums">
                  Σ {fmtUSD(calendario.total)} · el strip da el total · aquí ves el CUÁNDO (estimado por antigüedad · sin vencimientos pactados en el modelo)
                </div>
              </>
            ) : (
              <div className="text-[11px] text-slate-400 leading-snug py-2">Sin saldos por pagar · no hay salidas de caja proyectadas</div>
            )}
          </div>
          {/* Exposición FX */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <div className="text-[12px] font-bold text-slate-900">Exposición FX de la deuda</div>
                  <div className="text-[10px] text-slate-500">TC pactado al confirmar vs TC hoy · migrado del Resumen</div>
                </div>
              </div>
              {fx.deltaPct !== null && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${fx.deltaPct >= 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                  {fx.deltaPct >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />} TC {fx.deltaPct >= 0 ? '+' : ''}{fx.deltaPct.toFixed(1)}%
                </span>
              )}
            </div>
            {fx.hayTC && fx.deudaUSD > 0 && fx.tcPromedioPactado ? (
              <>
                <div className="space-y-2 text-[12px]">
                  <div className="flex items-center justify-between"><span className="text-slate-600">Deuda en USD</span><span className="font-bold tabular-nums text-slate-900">USD {fx.deudaUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-600">TC promedio pactado (al confirmar)</span><span className="font-bold tabular-nums text-slate-900">{fx.tcPromedioPactado.toFixed(3)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-600">TC hoy</span><span className={`font-bold tabular-nums ${fx.impactoPEN > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{tcHoy.toFixed(3)}{fx.deltaPct !== null && <span className={`text-[10px] ${fx.impactoPEN > 0 ? 'text-rose-500' : 'text-emerald-500'}`}> ({fx.deltaPct >= 0 ? '+' : ''}{fx.deltaPct.toFixed(1)}%)</span>}</span></div>
                </div>
                <div className={`mt-3 bg-gradient-to-r rounded-lg px-3 py-2 flex items-center justify-between text-[11px] ring-1 ${fx.impactoPEN > 0 ? 'from-rose-50 to-rose-100/30 ring-rose-200/60' : 'from-emerald-50 to-emerald-100/30 ring-emerald-200/60'}`}>
                  <span className={`font-semibold ${fx.impactoPEN > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>Si pagaras todo hoy</span>
                  <span className={`font-bold tabular-nums ${fx.impactoPEN > 0 ? 'text-rose-900' : 'text-emerald-900'}`}>{fx.impactoPEN > 0 ? '+' : '−'}{fmtPEN(fx.impactoPEN)} {fx.impactoPEN > 0 ? 'sobre' : 'bajo'} lo previsto</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-400">{fx.pagosPendientes} pago{fx.pagosPendientes === 1 ? '' : 's'} pendiente{fx.pagosPendientes === 1 ? '' : 's'} en USD · TC de referencia pactado al confirmar cada OC · la misma señal que teasea el Resumen</div>
              </>
            ) : (
              <div className="text-[11px] text-slate-400 leading-snug py-2">
                {!fx.hayTC ? 'Sin TC del día registrado · registrá el tipo de cambio para medir la exposición' : 'Sin deuda en USD con TC pactado · nada expuesto al tipo de cambio'}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
