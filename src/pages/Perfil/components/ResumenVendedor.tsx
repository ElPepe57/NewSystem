/**
 * src/pages/Perfil/components/ResumenVendedor.tsx
 * 2026-06-14 · Home operativo del VENDEDOR (perfiles-por-rol Fase 1 · piloto).
 *
 * "Mi trabajo" por FUNCIÓN (no por vínculo): el vendedor ve SU negocio del mes,
 * no su sueldo. Orden canónico §A→§E (banner → KPIs → meta+tendencia → pendientes
 * → acciones). "Mis áreas" (§G) lo aporta <MisAreas/> a nivel de MiPerfil.
 *
 * Datos REALES (hoy): ventas por `creadoPor` · cotizaciones · entregas · cobranzas.
 * Datos A CONSTRUIR (Fase 2): meta personal del vendedor + comisión Modelo A
 * (% por línea de negocio sobre la venta). Se muestran como placeholders honestos.
 *
 * Canon mockup: docs/mockups/perfil-home-vendedor-v1.html · ACTO 2 §A-§E.
 * Color de chrome = violet (grupo Equipo) · KPIs en paleta semántica fija.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown, ShoppingBag, FileText, Truck, BadgeDollarSign,
  Target, TrendingUp, ListChecks, Plus, FilePlus, ArrowRight, Lock,
} from 'lucide-react';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { VentaService } from '../../../services/venta.service';
import { CotizacionService } from '../../../services/cotizacion.service';
import { lineaNegocioService } from '../../../services/lineaNegocio.service';
import { getDatosLaboralesView } from '../../../services/perfilPersona.adapter';
import { formatCurrencyPEN } from '../../../utils/format';
import type { Venta, EstadoVenta } from '../../../types/venta.types';
import type { Cotizacion, EstadoCotizacion } from '../../../types/cotizacion.types';
import type { LineaNegocio } from '../../../types/lineaNegocio.types';
import { LoadingSkeletonCanon, ErrorStateCanon } from './EstadosCanon';

interface ResumenVendedorProps {
  uid: string;
  displayName?: string;
}

// Estados de venta que cuentan como "entrega/cobro en curso" (ni cerrada ni anulada).
const ESTADOS_ENTREGA_PENDIENTE: EstadoVenta[] = [
  'reservada', 'confirmada', 'parcial', 'asignada', 'en_entrega', 'despachada', 'entrega_parcial',
];
// Estados de cotización "abierta" (sigue viva, aún no convertida ni cerrada).
const ESTADOS_COTIZACION_ABIERTA: EstadoCotizacion[] = [
  'nueva', 'validada', 'pendiente_adelanto', 'adelanto_pagado', 'con_abono',
];

const toDate = (ts: any): Date | null => ts?.toDate?.() ?? null;
const MS_DIA = 1000 * 60 * 60 * 24;

export const ResumenVendedor: React.FC<ResumenVendedorProps> = ({ uid, displayName }) => {
  const { data, loading, error, refetch } = useAsyncData(
    async () => {
      const [ventas, cotizaciones, lineas, datosLab] = await Promise.all([
        VentaService.getVentasRecientes(60).catch(() => [] as Venta[]),
        CotizacionService.getAll().catch(() => [] as Cotizacion[]),
        lineaNegocioService.getAll().catch(() => [] as LineaNegocio[]),
        getDatosLaboralesView(uid).catch(() => null),
      ]);
      return {
        ventas: ventas.filter((v) => v.creadoPor === uid),
        cotizaciones: cotizaciones.filter((c) => c.creadoPor === uid),
        lineas,
        meta: datosLab?.metaVentasMensual ?? 0,
      };
    },
    [uid],
  );

  const m = useMemo(() => {
    const ventas = data?.ventas ?? [];
    const cotizaciones = data?.cotizaciones ?? [];
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    // Ventas "reales" (excluye las que aún son cotización o se cancelaron).
    const ventasReales = ventas.filter((v) => v.estado !== 'cotizacion' && v.estado !== 'cancelada');

    // §B · KPI 1 · Mis ventas del mes (monto + conteo).
    const ventasMes = ventasReales.filter((v) => {
      const f = toDate(v.fechaCreacion);
      return f && f.getMonth() === mesActual && f.getFullYear() === anioActual;
    });
    const ventasMesMonto = ventasMes.reduce((s, v) => s + (v.totalPEN || 0), 0);

    // §B · KPI 4 · Comisión estimada (Modelo A · % por línea sobre la venta).
    const lineas = data?.lineas ?? [];
    const comisionPorLinea = new Map(lineas.map((l) => [l.id, l.comisionPorcentaje ?? 0]));
    const hayComisionConfigurada = lineas.some((l) => (l.comisionPorcentaje ?? 0) > 0);
    const comisionMes = ventasMes.reduce((s, v) => {
      const pct = v.lineaNegocioId ? comisionPorLinea.get(v.lineaNegocioId) ?? 0 : 0;
      return s + (v.totalPEN || 0) * (pct / 100);
    }, 0);

    // §C · Meta del mes · progreso + proyección lineal por ritmo diario.
    const meta = data?.meta ?? 0;
    const tieneMeta = meta > 0;
    const progresoMeta = tieneMeta ? Math.min(100, Math.round((ventasMesMonto / meta) * 100)) : 0;
    const diaHoy = ahora.getDate();
    const diasDelMes = new Date(anioActual, mesActual + 1, 0).getDate();
    const diasRestantes = Math.max(0, diasDelMes - diaHoy);
    const ritmoDiario = diaHoy > 0 ? ventasMesMonto / diaHoy : 0;
    const proyeccionMes = ritmoDiario * diasDelMes;
    const proyeccionPct = tieneMeta ? Math.round((proyeccionMes / meta) * 100) : 0;
    const faltaParaMeta = Math.max(0, meta - ventasMesMonto);
    const necesarioDiario = diasRestantes > 0 ? faltaParaMeta / diasRestantes : faltaParaMeta;

    // §B · KPI 2 · Cotizaciones abiertas + por vencer (≤7 días).
    const cotizacionesAbiertas = cotizaciones.filter((c) => ESTADOS_COTIZACION_ABIERTA.includes(c.estado));
    const cotizacionesPorVencer = cotizacionesAbiertas.filter((c) => {
      const f = toDate(c.fechaVencimiento);
      if (!f) return false;
      const dias = (f.getTime() - ahora.getTime()) / MS_DIA;
      return dias >= 0 && dias <= 7;
    });

    // §B · KPI 3 · Entregas pendientes + cobranzas vencidas.
    const entregasPendientes = ventasReales.filter((v) => ESTADOS_ENTREGA_PENDIENTE.includes(v.estado));
    const cobranzasVencidas = ventasReales.filter((v) => v.estadoPago !== 'pagado' && (v.montoPendiente || 0) > 0);

    // §C · Sparkline · ventas (monto) por día, últimos 7 días.
    const buckets = Array.from({ length: 7 }, () => 0);
    const inicioVentana = new Date(anioActual, ahora.getMonth(), ahora.getDate() - 6);
    inicioVentana.setHours(0, 0, 0, 0);
    let ventasSemana = 0;
    let mejorDiaMonto = 0;
    for (const v of ventasReales) {
      const f = toDate(v.fechaCreacion);
      if (!f) continue;
      const idx = Math.floor((f.getTime() - inicioVentana.getTime()) / MS_DIA);
      if (idx >= 0 && idx < 7) {
        buckets[idx] += v.totalPEN || 0;
        ventasSemana += 1;
      }
    }
    mejorDiaMonto = Math.max(0, ...buckets);
    const maxBucket = Math.max(...buckets, 1);
    const sparkPoints = buckets
      .map((val, i) => `${Math.round((i / 6) * 200)},${Math.round(55 - (val / maxBucket) * 43)}`)
      .join(' ');

    // §D · Pendientes accionables unificados (entregas + cotizaciones por vencer + cobranzas).
    type Pend = { id: string; chip: string; tinte: 'rose' | 'amber'; ref: string; texto: string; to: string; cta: string };
    const pendientes: Pend[] = [];
    for (const v of entregasPendientes.slice(0, 4)) {
      pendientes.push({
        id: `ent-${v.id}`, chip: 'ENTREGA PENDIENTE', tinte: 'amber', ref: v.numeroVenta,
        texto: `${v.nombreCliente} · ${formatCurrencyPEN(v.totalPEN)}`,
        to: '/ventas', cta: 'Coordinar',
      });
    }
    for (const c of cotizacionesPorVencer.slice(0, 3)) {
      const f = toDate(c.fechaVencimiento);
      const dias = f ? Math.max(0, Math.ceil((f.getTime() - ahora.getTime()) / MS_DIA)) : 0;
      pendientes.push({
        id: `cot-${c.id}`, chip: 'COTIZACIÓN POR VENCER', tinte: 'amber', ref: c.numeroCotizacion,
        texto: `${c.nombreCliente} · ${formatCurrencyPEN(c.totalPEN)} · vence en ${dias} día${dias !== 1 ? 's' : ''}`,
        to: '/cotizaciones', cta: 'Dar seguimiento',
      });
    }
    for (const v of cobranzasVencidas.slice(0, 3)) {
      pendientes.push({
        id: `cob-${v.id}`, chip: 'COBRANZA PENDIENTE', tinte: 'rose', ref: v.numeroVenta,
        texto: `${v.nombreCliente} · ${formatCurrencyPEN(v.montoPendiente)} por cobrar`,
        to: '/ventas', cta: 'Gestionar',
      });
    }
    pendientes.sort((a, b) => (a.tinte === 'rose' ? -1 : 1) - (b.tinte === 'rose' ? -1 : 1));

    return {
      ventasMesMonto,
      ventasMesCount: ventasMes.length,
      comisionMes,
      hayComisionConfigurada,
      meta,
      tieneMeta,
      progresoMeta,
      diasRestantes,
      proyeccionMes,
      proyeccionPct,
      necesarioDiario,
      cotizacionesAbiertas: cotizacionesAbiertas.length,
      cotizacionesPorVencer: cotizacionesPorVencer.length,
      entregasPendientes: entregasPendientes.length,
      cobranzasVencidas: cobranzasVencidas.length,
      ventasSemana,
      mejorDiaMonto,
      sparkPoints,
      pendientes: pendientes.slice(0, 5),
      totalPendientes: entregasPendientes.length + cotizacionesPorVencer.length + cobranzasVencidas.length,
    };
  }, [data]);

  if (loading) return <LoadingSkeletonCanon />;
  if (error) {
    return <ErrorStateCanon titulo="No pudimos cargar tu actividad de ventas" onRetry={refetch} />;
  }

  const primerNombre = (displayName || 'vendedor').trim().split(/\s+/)[0];

  return (
    <div className="space-y-5">
      {/* §A · Banner saludo + pendientes */}
      <div className="bg-gradient-to-r from-violet-50 to-violet-100/40 ring-1 ring-violet-200/60 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[15px] font-bold text-slate-900">Hola, {primerNombre} 👋 — esto es lo tuyo hoy</div>
          <div className="text-[12px] text-slate-600 mt-0.5">
            {m.totalPendientes > 0 ? (
              <>Tenés <b className="text-rose-700">{m.totalPendientes} pendiente{m.totalPendientes !== 1 ? 's' : ''}</b> que requieren tu atención.</>
            ) : (
              <>Sin pendientes urgentes · todo al día. 🎯</>
            )}
          </div>
        </div>
        {m.totalPendientes > 0 && (
          <a href="#mis-pendientes" className="text-[12px] font-bold text-violet-700 bg-white ring-1 ring-violet-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 flex-shrink-0">
            Ver pendientes <ArrowDown className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* §B · KPI strip semántico (canon N1/N2) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Mis ventas · mes */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">Mis ventas · mes</span>
            <ShoppingBag className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-900">{formatCurrencyPEN(m.ventasMesMonto)}</div>
          <div className="text-[11px] text-amber-700 mt-1">{m.ventasMesCount} venta{m.ventasMesCount !== 1 ? 's' : ''} este mes</div>
        </div>
        {/* Cotizaciones */}
        <div className="bg-gradient-to-br from-sky-50 to-sky-100/40 ring-1 ring-sky-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-sky-700 font-bold">Cotizaciones</span>
            <FileText className="w-3.5 h-3.5 text-sky-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-sky-900">{m.cotizacionesAbiertas} <span className="text-sky-400 text-base">abiertas</span></div>
          <div className="text-[11px] text-sky-700 mt-1">{m.cotizacionesPorVencer} por vencer esta semana</div>
        </div>
        {/* Entregas / cobros */}
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">Entregas / cobros</span>
            <Truck className="w-3.5 h-3.5 text-rose-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-rose-900">{m.entregasPendientes} <span className="text-rose-400 text-base">pend.</span></div>
          <div className="text-[11px] text-rose-700 mt-1">{m.cobranzasVencidas} cobranza{m.cobranzasVencidas !== 1 ? 's' : ''} por cobrar</div>
        </div>
        {/* Comisión estimada · Modelo A (% por línea sobre la venta) */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-4 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">Comisión est.</span>
            <BadgeDollarSign className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          {m.hayComisionConfigurada ? (
            <>
              <div className="text-2xl font-bold tabular-nums text-emerald-900">{formatCurrencyPEN(m.comisionMes)}</div>
              <div className="text-[10px] text-emerald-700 mt-1">por tus ventas de este mes</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold tabular-nums text-emerald-900">—</div>
              <div className="text-[10px] text-emerald-700 mt-1 inline-flex items-center gap-1">
                <span className="bg-emerald-200/70 px-1.5 py-0.5 rounded font-bold">Sin % configurado</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* §C · Visualización: meta del mes (Fase 2) + tendencia 7d (real) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Meta del mes · progreso real contra metaVentasMensual (datosLaborales) */}
        <div className="md:col-span-2 bg-white ring-1 ring-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] font-bold text-slate-900 flex items-center gap-2"><Target className="w-4 h-4 text-violet-600" /> Mi meta del mes</div>
            {m.tieneMeta && <div className="text-[12px] text-slate-500">faltan <b className="text-slate-900">{m.diasRestantes} día{m.diasRestantes !== 1 ? 's' : ''}</b></div>}
          </div>
          {m.tieneMeta ? (
            <>
              <div className="flex items-end justify-between mb-2">
                <div className="text-2xl font-bold tabular-nums text-slate-900">{formatCurrencyPEN(m.ventasMesMonto)} <span className="text-[13px] font-medium text-slate-400">de {formatCurrencyPEN(m.meta)}</span></div>
                <div className="text-[13px] font-bold text-amber-600">{m.progresoMeta}%</div>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" style={{ width: `${m.progresoMeta}%` }}></div>
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                {m.necesarioDiario > 0
                  ? <>Necesitás <b className="text-slate-700">{formatCurrencyPEN(m.necesarioDiario)}/día</b> para cerrar la meta · proyección actual: <b className="text-amber-700">{formatCurrencyPEN(m.proyeccionMes)} ({m.proyeccionPct}%)</b>.</>
                  : <><b className="text-emerald-700">¡Meta alcanzada!</b> 🎯 Vas {m.progresoMeta}% · proyección de cierre: <b className="text-emerald-700">{formatCurrencyPEN(m.proyeccionMes)}</b>.</>}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-end justify-between mb-2">
                <div className="text-2xl font-bold tabular-nums text-slate-900">{formatCurrencyPEN(m.ventasMesMonto)} <span className="text-[13px] font-medium text-slate-400">vendido este mes</span></div>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-200 rounded-full" style={{ width: '0%' }}></div>
              </div>
              <div className="text-[11px] text-slate-500 mt-2 flex items-start gap-1.5">
                <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
                <span>El admin aún no configuró tu <b className="text-slate-700">meta mensual</b> · pedila para ver tu progreso y proyección.</span>
              </div>
            </>
          )}
        </div>
        {/* Sparkline ventas 7d · REAL */}
        <div className="bg-white ring-1 ring-slate-200 rounded-2xl p-5">
          <div className="text-[13px] font-bold text-slate-900 flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-emerald-600" /> Mis últimos 7 días</div>
          <svg viewBox="0 0 200 60" className="w-full h-16">
            <polyline points={m.sparkPoints} fill="none" stroke="#10b981" strokeWidth="2.5" />
          </svg>
          <div className="text-[11px] text-slate-500 mt-1">
            {m.ventasSemana} venta{m.ventasSemana !== 1 ? 's' : ''} esta semana
            {m.mejorDiaMonto > 0 && <> · mejor día: {formatCurrencyPEN(m.mejorDiaMonto)}</>}
          </div>
        </div>
      </div>

      {/* §D · Mis pendientes */}
      <div id="mis-pendientes">
        <div className="text-[13px] font-bold text-slate-900 mb-2 flex items-center gap-2"><ListChecks className="w-4 h-4 text-violet-600" /> Mis pendientes</div>
        {m.pendientes.length > 0 ? (
          <div className="space-y-2">
            {m.pendientes.map((p) => (
              <div key={p.id} className={`bg-white ring-1 ring-slate-200 border-l-4 ${p.tinte === 'rose' ? 'border-l-rose-400' : 'border-l-amber-400'} rounded-xl p-3 flex items-center justify-between gap-3`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold ${p.tinte === 'rose' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'} px-1.5 py-0.5 rounded`}>{p.chip}</span>
                    <span className="text-[11px] font-mono text-slate-400">{p.ref}</span>
                  </div>
                  <div className="text-[13px] font-semibold text-slate-900 mt-0.5 truncate">{p.texto}</div>
                </div>
                <Link to={p.to} className="text-[11px] font-bold text-violet-700 hover:bg-violet-50 px-2.5 py-1 rounded flex-shrink-0">{p.cta} →</Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white ring-1 ring-slate-200 rounded-xl p-4 text-[12px] text-slate-500 text-center">
            Sin pendientes · todas tus entregas, cotizaciones y cobranzas están al día.
          </div>
        )}
      </div>

      {/* §E · Acciones rápidas + cross-links */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Link to="/ventas" className="text-[12px] font-bold text-white bg-violet-600 hover:bg-violet-700 px-4 py-2 rounded-lg flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nueva venta</Link>
        <Link to="/cotizaciones" className="text-[12px] font-medium text-slate-700 bg-white ring-1 ring-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg flex items-center gap-1.5"><FilePlus className="w-4 h-4" /> Nueva cotización</Link>
        <div className="flex-1"></div>
        <Link to="/ventas" className="text-[12px] font-semibold text-violet-700 hover:underline flex items-center gap-1">Ver todas mis ventas <ArrowRight className="w-3.5 h-3.5" /></Link>
        <span className="text-slate-300">·</span>
        <Link to="/inventario" className="text-[12px] font-semibold text-violet-700 hover:underline flex items-center gap-1">Inventario disponible <ArrowRight className="w-3.5 h-3.5" /></Link>
      </div>
    </div>
  );
};

export default ResumenVendedor;
