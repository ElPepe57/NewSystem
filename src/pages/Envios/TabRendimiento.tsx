/**
 * TabRendimiento — Tab "Rendimiento" del hub de Envíos (dashboard de desempeño logístico).
 *
 * Alineado PIXEL-PERFECT al master · docs/mockups/envios-master-v1.html · ACTO 7.
 * Chrome = orange (grupo Inventario). Datos reales vía stores; las métricas sin fuente
 * todavía (zona de destino · series históricas de lead-time) se muestran "—" · no se inventan.
 *
 * Secciones:
 *  §0 Callout amber · estado honesto del tab (parcial · migración charts DS pendiente)
 *  §A KPIs operativos vs meta (bullet charts con marca vertical de SLA)
 *  §B Lead time promedio (valor real + nota sobre serie histórica sin fuente)
 *  §C1 Ranking por courier · tasa de éxito (última milla · despachos F)
 *  §C2 Ranking por viajero · lead-time pierna B (importación · origen → Perú)
 *  §D Ranking por zona · entregas (sin fuente todavía → empty-state honesto)
 *  §E Nota metodología
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  PackageCheck,
  Clock,
  AlertTriangle,
  XCircle,
  Gauge,
  TrendingDown,
  Award,
  MapPin,
  Calendar,
  BarChart3,
  Minus,
  Plane,
  Info,
  Wrench,
} from 'lucide-react';
import { useEnvioStore } from '../../store/envioStore';
import { leadTimePiernaB, resumirLeadTime } from '../../utils/leadTimePiernas.helper';

type Periodo = 'ultimo_mes' | 'ultimos_3_meses' | 'ultimos_6_meses' | 'anio_actual' | 'todos';

const PERIODO_LABELS: Record<Periodo, string> = {
  ultimo_mes: 'Último mes',
  ultimos_3_meses: 'Últimos 3 meses',
  ultimos_6_meses: 'Últimos 6 meses',
  anio_actual: 'Año actual',
  todos: 'Todos',
};

function cutoffFor(p: Periodo): number | null {
  const now = Date.now();
  const DIA = 24 * 60 * 60 * 1000;
  switch (p) {
    case 'ultimo_mes': return now - 30 * DIA;
    case 'ultimos_3_meses': return now - 90 * DIA;
    case 'ultimos_6_meses': return now - 180 * DIA;
    case 'anio_actual': return new Date(new Date().getFullYear(), 0, 1).getTime();
    case 'todos': return null;
  }
}

/**
 * Color semántico para barras bullet. isGoodHigh=true → más es mejor (fill rate, on-time).
 * isGoodHigh=false → menos es mejor (damage, loss).
 * Thresholds: fill≥95% OK · on-time≥90% OK · damage<2% OK · loss<1% OK.
 */
function bulletColor(pct: number, meta: number, isGoodHigh: boolean): string {
  if (isGoodHigh) {
    if (pct >= meta) return 'bg-emerald-500';
    if (pct >= meta * 0.75) return 'bg-amber-500';
    return 'bg-rose-500';
  } else {
    // inverse: pct must be < meta to be good
    if (pct <= meta) return 'bg-emerald-500';
    if (pct <= meta * 1.5) return 'bg-amber-500';
    return 'bg-rose-500';
  }
}

function bulletTextColor(pct: number, meta: number, isGoodHigh: boolean): string {
  if (isGoodHigh) {
    if (pct >= meta) return 'text-emerald-700';
    if (pct >= meta * 0.75) return 'text-amber-700';
    return 'text-rose-700';
  } else {
    if (pct <= meta) return 'text-emerald-700';
    if (pct <= meta * 1.5) return 'text-amber-700';
    return 'text-rose-700';
  }
}

function bulletDecimalColor(pct: number, meta: number, isGoodHigh: boolean): string {
  if (isGoodHigh) {
    if (pct >= meta) return 'text-emerald-400';
    if (pct >= meta * 0.75) return 'text-amber-400';
    return 'text-rose-400';
  } else {
    if (pct <= meta) return 'text-emerald-400';
    if (pct <= meta * 1.5) return 'text-amber-400';
    return 'text-rose-400';
  }
}

// Clases LITERALES por tono (el JIT de Tailwind no detecta bg-${x}-500 dinámico).
const RANK_COL = {
  emerald: { dot: 'bg-emerald-500', text: 'text-emerald-700', dec: 'text-emerald-400', bar: 'bg-emerald-500' },
  amber: { dot: 'bg-amber-500', text: 'text-amber-700', dec: 'text-amber-400', bar: 'bg-amber-500' },
  rose: { dot: 'bg-rose-500', text: 'text-rose-700', dec: 'text-rose-400', bar: 'bg-rose-500' },
} as const;

export const TabRendimiento: React.FC = () => {
  const { envios, fetchEnvios } = useEnvioStore();
  const [periodo, setPeriodo] = useState<Periodo>('ultimos_3_meses');

  useEffect(() => {
    if (envios.length === 0) fetchEnvios();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtrar envíos del período
  const enviosPeriodo = useMemo(() => {
    const cutoff = cutoffFor(periodo);
    if (cutoff === null) return envios;
    return envios.filter(e => e.fechaCreacion.toMillis() >= cutoff);
  }, [envios, periodo]);

  // Métricas
  const metricas = useMemo(() => {
    const enviosCompletados = enviosPeriodo.filter(e =>
      e.estado === 'recibida_completa' || e.estado === 'recibida_parcial'
    );

    let totalEsperadas = 0;
    let totalRecibidas = 0;
    let totalDanadas = 0;
    let totalPerdidas = 0;

    for (const e of enviosCompletados) {
      totalEsperadas += e.totalUnidades || 0;
      totalRecibidas += e.totalUnidadesRecibidas || 0;
      totalDanadas += e.totalUnidadesDanadas || 0;
      totalPerdidas += e.totalUnidadesFaltantes || 0;
    }

    // Fill Rate
    const fillRate = totalEsperadas > 0 ? (totalRecibidas / totalEsperadas) * 100 : 100;

    // Damage Rate (sobre recibidas)
    const damageRate = totalRecibidas > 0 ? (totalDanadas / totalRecibidas) * 100 : 0;

    // Loss Rate (sobre esperadas)
    const lossRate = totalEsperadas > 0 ? (totalPerdidas / totalEsperadas) * 100 : 0;

    // On-Time (sobre los que tienen ambas fechas)
    const conFechas = enviosCompletados.filter(e => e.fechaLlegadaEstimada && e.fechaLlegadaReal);
    const aTiempo = conFechas.filter(e =>
      e.fechaLlegadaReal!.toMillis() <= e.fechaLlegadaEstimada!.toMillis()
    ).length;
    const onTimeRate = conFechas.length > 0 ? (aTiempo / conFechas.length) * 100 : 0;

    // Días en tránsito promedio
    const conTiempo = enviosCompletados.filter(e => e.diasEnTransito !== undefined && e.diasEnTransito > 0);
    const diasPromedio = conTiempo.length > 0
      ? conTiempo.reduce((s, e) => s + (e.diasEnTransito || 0), 0) / conTiempo.length
      : 0;

    // Tiempo promedio en aduana
    const conAduana = enviosPeriodo.filter(e =>
      (e.incidencias || []).some(i => i.tipo === 'aduana')
    );
    let diasAduanaTotal = 0;
    let cantMuestrasAduana = 0;
    for (const e of conAduana) {
      for (const inc of (e.incidencias || [])) {
        if (inc.tipo !== 'aduana') continue;
        const inicio = inc.fechaRetencion?.toMillis() || inc.fechaRegistro.toMillis();
        const fin = inc.fechaLiberacion?.toMillis() || inc.fechaResolucion?.toMillis() || Date.now();
        diasAduanaTotal += (fin - inicio) / (1000 * 60 * 60 * 24);
        cantMuestrasAduana++;
      }
    }
    const diasAduanaPromedio = cantMuestrasAduana > 0 ? diasAduanaTotal / cantMuestrasAduana : 0;

    return {
      totalEnvios: enviosPeriodo.length,
      enviosCompletados: enviosCompletados.length,
      totalEsperadas,
      totalRecibidas,
      totalDanadas,
      totalPerdidas,
      fillRate,
      damageRate,
      lossRate,
      onTimeRate,
      onTimeEnviosCount: conFechas.length,
      diasPromedio,
      diasAduanaPromedio,
      cantMuestrasAduana,
    };
  }, [enviosPeriodo]);

  // Ranking de viajeros · lead-time PIERNA B (origen → Perú) por colaboradorId.
  const rankingCouriers = useMemo(() => {
    const byViajero = new Map<string, {
      nombre: string;
      total: number;
      retenciones: number;
      leadTimes: number[];
    }>();
    for (const e of enviosPeriodo) {
      const id = e.colaboradorId;
      if (!id) continue;
      const curr = byViajero.get(id) || {
        nombre: e.colaboradorNombre || id,
        total: 0,
        retenciones: 0,
        leadTimes: [],
      };
      curr.total++;
      if (e.colaboradorNombre) curr.nombre = e.colaboradorNombre;
      if ((e.incidencias || []).some(i => i.tipo === 'aduana')) curr.retenciones++;
      const lt = leadTimePiernaB(e);
      if (lt != null) curr.leadTimes.push(lt);
      byViajero.set(id, curr);
    }
    return [...byViajero.entries()]
      .map(([id, stats]) => ({
        id,
        nombre: stats.nombre,
        total: stats.total,
        retenciones: stats.retenciones,
        leadTime: resumirLeadTime(stats.leadTimes),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [enviosPeriodo]);

  // Ranking de couriers de ÚLTIMA MILLA · tasa de éxito (entregadas / despachadas · despachos F).
  // Habilitado por la absorción de Entrega: los despachos F traen courier + estado de entrega.
  const rankingCourierExito = useMemo(() => {
    const byCourier = new Map<string, { nombre: string; despachados: number; entregados: number }>();
    for (const e of enviosPeriodo) {
      if (e.destinoTipo !== 'cliente') continue; // solo despachos F (última milla)
      if (!['en_camino', 'entregada', 'fallida', 'reprogramada'].includes(e.estado)) continue;
      const nombre = e.colaboradorNombre || 'Sin courier';
      const c = byCourier.get(nombre) || { nombre, despachados: 0, entregados: 0 };
      c.despachados++;
      if (e.estado === 'entregada') c.entregados++;
      byCourier.set(nombre, c);
    }
    return [...byCourier.values()]
      .filter((c) => c.despachados > 0)
      .map((c) => ({ ...c, tasa: (c.entregados / c.despachados) * 100 }))
      .sort((a, b) => b.tasa - a.tasa)
      .slice(0, 5);
  }, [enviosPeriodo]);

  // SLA metas
  const META_FILL = 95;    // fill rate ≥ 95%
  const META_ONTIME = 90;  // on-time ≥ 90%
  const META_DAMAGE = 2;   // damage rate < 2%
  const META_LOSS = 1;     // loss rate < 1%
  const META_LEADTIME = 10; // lead time puerta a puerta ≤ 10 días (referencia)

  // Para barra bullet inversa (damage/loss): posición visual máxima = 2× meta
  const damageBarMax = Math.max(META_DAMAGE * 2, metricas.damageRate + 1);
  const lossBarMax = Math.max(META_LOSS * 2, metricas.lossRate + 1);

  return (
    <div className="space-y-4">

      {/* §0 — Callout amber · estado honesto del tab */}
      <div className="bg-gradient-to-r from-amber-50 to-amber-100/30 ring-1 ring-amber-200/60 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Wrench className="w-5 h-5 text-amber-700" />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-amber-900 flex items-center gap-2">
            Estado del tab{' '}
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Parcial
            </span>
          </div>
          <div className="text-[12px] text-amber-800/90 leading-snug mt-0.5">
            El dashboard usa primitivas de{' '}
            <code className="text-[11px] bg-amber-100/60 px-1 py-0.5 rounded">common/</code>{' '}
            en vez de los <span className="font-semibold">charts del kit DS</span>. El gap es migrar a los componentes canon
            (bullet vs meta · sparkline/línea · barras horizontales) con color{' '}
            <span className="font-semibold">semántico</span> — el DATO manda el tipo de gráfico, no la decoración.
            Los KPIs de zona y la serie histórica de lead-time muestran{' '}
            <span className="font-semibold">—</span> hasta que exista la fuente de datos.
          </div>
        </div>
      </div>

      {/* Filtro período */}
      <div className="flex items-center justify-between gap-2 p-3 bg-white border border-slate-200 rounded-lg">
        <div className="text-[12px] text-slate-600">
          <span className="font-medium text-slate-800 tabular-nums">{metricas.totalEnvios}</span> envíos analizados ·{' '}
          <span className="font-medium text-slate-800 tabular-nums">{metricas.enviosCompletados}</span> completados
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
            className="px-2 py-1.5 text-[12px] border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {(Object.keys(PERIODO_LABELS) as Periodo[]).map(p => (
              <option key={p} value={p}>{PERIODO_LABELS[p]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* FILA 1 · §A KPIs operativos vs meta (bullet charts) + §B Lead time promedio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* §A — KPIs operativos · vs meta (bullet charts) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <Gauge className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <div className="text-[12px] font-bold text-slate-900">KPIs operativos · vs meta</div>
                <div className="text-[10px] text-slate-500">
                  {PERIODO_LABELS[periodo]} · {metricas.enviosCompletados} envíos completados
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-600 border border-slate-200 rounded-full px-2 py-0.5">SLA</span>
          </div>

          <div className="space-y-3.5">
            {/* Fill rate */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-slate-400" /> Fill rate
                </span>
                <span className={`text-[12px] font-bold tabular-nums ${bulletTextColor(metricas.fillRate, META_FILL, true)}`}>
                  {metricas.fillRate.toFixed(1)}<span className={bulletDecimalColor(metricas.fillRate, META_FILL, true)}>%</span>{' '}
                  <span className="text-[10px] font-medium text-slate-400">/ meta {META_FILL}%</span>
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${bulletColor(metricas.fillRate, META_FILL, true)}`}
                  style={{ width: `${Math.min(metricas.fillRate, 100)}%` }}
                />
                <div className="absolute top-0 bottom-0 w-0.5 bg-slate-700" style={{ left: `${META_FILL}%` }} />
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5 tabular-nums">
                {metricas.totalRecibidas}/{metricas.totalEsperadas} unidades
              </div>
            </div>

            {/* On-time delivery */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> On-time delivery
                </span>
                {metricas.onTimeEnviosCount > 0 ? (
                  <span className={`text-[12px] font-bold tabular-nums ${bulletTextColor(metricas.onTimeRate, META_ONTIME, true)}`}>
                    {metricas.onTimeRate.toFixed(0)}<span className={bulletDecimalColor(metricas.onTimeRate, META_ONTIME, true)}>%</span>{' '}
                    <span className="text-[10px] font-medium text-slate-400">/ meta {META_ONTIME}%</span>
                  </span>
                ) : (
                  <span className="text-[12px] font-bold text-slate-300 tabular-nums">—</span>
                )}
              </div>
              <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden">
                {metricas.onTimeEnviosCount > 0 && (
                  <div
                    className={`h-full rounded-full ${bulletColor(metricas.onTimeRate, META_ONTIME, true)}`}
                    style={{ width: `${Math.min(metricas.onTimeRate, 100)}%` }}
                  />
                )}
                <div className="absolute top-0 bottom-0 w-0.5 bg-slate-700" style={{ left: `${META_ONTIME}%` }} />
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5 tabular-nums">
                {metricas.onTimeEnviosCount > 0
                  ? `${metricas.onTimeEnviosCount} envíos con ETA registrada`
                  : 'Sin envíos con ETA registrada en el período'}
              </div>
            </div>

            {/* Damage rate */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-slate-400" /> Damage rate
                </span>
                <span className={`text-[12px] font-bold tabular-nums ${bulletTextColor(metricas.damageRate, META_DAMAGE, false)}`}>
                  {metricas.damageRate.toFixed(1)}<span className={bulletDecimalColor(metricas.damageRate, META_DAMAGE, false)}>%</span>{' '}
                  <span className="text-[10px] font-medium text-slate-400">/ meta &lt;{META_DAMAGE}%</span>
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${bulletColor(metricas.damageRate, META_DAMAGE, false)}`}
                  style={{ width: `${(metricas.damageRate / damageBarMax) * 100}%` }}
                />
                <div className="absolute top-0 bottom-0 w-0.5 bg-slate-700" style={{ left: `${(META_DAMAGE / damageBarMax) * 100}%` }} />
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5 tabular-nums">
                {metricas.totalDanadas} unidad(es) dañadas sobre {metricas.totalRecibidas} recibidas
              </div>
            </div>

            {/* Loss rate */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-slate-400" /> Loss rate
                </span>
                <span className={`text-[12px] font-bold tabular-nums ${bulletTextColor(metricas.lossRate, META_LOSS, false)}`}>
                  {metricas.lossRate.toFixed(1)}<span className={bulletDecimalColor(metricas.lossRate, META_LOSS, false)}>%</span>{' '}
                  <span className="text-[10px] font-medium text-slate-400">/ meta &lt;{META_LOSS}%</span>
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${bulletColor(metricas.lossRate, META_LOSS, false)}`}
                  style={{ width: `${(metricas.lossRate / lossBarMax) * 100}%` }}
                />
                <div className="absolute top-0 bottom-0 w-0.5 bg-slate-700" style={{ left: `${(META_LOSS / lossBarMax) * 100}%` }} />
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5 tabular-nums">
                {metricas.totalPerdidas} unidad(es) perdidas sobre {metricas.totalEsperadas} esperadas
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-slate-400">
            <Minus className="w-3 h-3 text-slate-400" />
            <span>La barra vertical marca la meta · el color dice si cumple (emerald) o vigila (amber/rose).</span>
          </div>
        </div>

        {/* §B — Lead time promedio */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <div className="text-[12px] font-bold text-slate-900">Lead time promedio</div>
                <div className="text-[10px] text-slate-500">
                  {PERIODO_LABELS[periodo]} · días puerta a puerta
                </div>
              </div>
            </div>
            {metricas.diasPromedio > 0 ? (
              <span className="text-[11px] font-bold tabular-nums text-slate-700 flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-emerald-500" />
                {metricas.diasPromedio.toFixed(1)} d
              </span>
            ) : (
              <span className="text-[11px] font-bold text-slate-300 tabular-nums">—</span>
            )}
          </div>

          {/* Valor actual + nota honesta sobre serie histórica */}
          {metricas.diasPromedio > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-end gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Promedio actual</div>
                  <div className="text-[28px] font-bold tabular-nums text-slate-900 leading-none">
                    {metricas.diasPromedio.toFixed(1)}<span className="text-slate-400 text-[16px]"> días</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                  <span>vs referencia {META_LEADTIME} días</span>
                  <span className={`font-semibold ${metricas.diasPromedio <= META_LEADTIME ? 'text-emerald-600' : metricas.diasPromedio <= META_LEADTIME * 1.5 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {metricas.diasPromedio <= META_LEADTIME ? 'dentro de referencia' : 'sobre referencia'}
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${metricas.diasPromedio <= META_LEADTIME ? 'bg-emerald-500' : metricas.diasPromedio <= META_LEADTIME * 1.5 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min((metricas.diasPromedio / (META_LEADTIME * 2)) * 100, 100)}%` }}
                  />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-slate-700" style={{ left: '50%' }} />
                </div>
              </div>
              <div className="text-[11px] text-slate-500 leading-snug">
                Calculado sobre {enviosPeriodo.filter(e => (e.diasEnTransito || 0) > 0).length} envíos
                con registro de días en tránsito.
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <TrendingDown className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <div className="text-[12px] text-slate-400">Sin datos de tránsito en el período.</div>
              </div>
            </div>
          )}

          {/* Aduana · información secundaria */}
          {metricas.cantMuestrasAduana > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Tiempo en aduana prom.
                </span>
                <span className={`font-bold tabular-nums ${metricas.diasAduanaPromedio > 5 ? 'text-rose-700' : metricas.diasAduanaPromedio > 2 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {metricas.diasAduanaPromedio.toFixed(1)} días
                </span>
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5 tabular-nums">
                {metricas.cantMuestrasAduana} retención(es) · fechas de incidencias aduana
              </div>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-slate-400">
            <Info className="w-3 h-3 text-slate-400" />
            <span>Serie histórica mensual pendiente de fuente · se mostrará cuando haya agregados por mes en el modelo.</span>
          </div>
        </div>
      </div>

      {/* FILA 2 · §C1 courier tasa de éxito (última milla) + §C2 viajero lead-time (importación) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* §C1 — Ranking por courier · tasa de éxito (última milla · despachos F) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <Award className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <div className="text-[12px] font-bold text-slate-900">Por courier · tasa de éxito</div>
                <div className="text-[10px] text-slate-500">Entregas exitosas / despachadas · última milla</div>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-600 border border-slate-200 rounded-full px-2 py-0.5">
              {rankingCourierExito.length} courier{rankingCourierExito.length !== 1 ? 's' : ''}
            </span>
          </div>
          {rankingCourierExito.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <PackageCheck className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <div className="text-[12px] text-slate-400">Sin despachos de última milla en el período.</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {rankingCourierExito.map((c) => {
                const col = c.tasa >= 90 ? RANK_COL.emerald : c.tasa >= 70 ? RANK_COL.amber : RANK_COL.rose;
                return (
                  <div key={c.nombre}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`} />
                        <span className="text-[12px] font-semibold text-slate-700 truncate max-w-[150px]">{c.nombre}</span>
                      </div>
                      <span className={`text-[12px] font-bold tabular-nums ${col.text}`}>
                        {c.tasa.toFixed(0)}<span className={col.dec}>%</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${col.bar}`} style={{ width: `${Math.min(c.tasa, 100)}%` }} />
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5 tabular-nums">
                      {c.entregados}/{c.despachados} entregados
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* §C2 — Ranking por viajero · lead-time pierna B (importación) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <Award className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <div className="text-[12px] font-bold text-slate-900">Por courier · lead-time</div>
                <div className="text-[10px] text-slate-500">Pierna B · días origen → Perú</div>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-600 border border-slate-200 rounded-full px-2 py-0.5">
              {rankingCouriers.length} viajero{rankingCouriers.length !== 1 ? 's' : ''}
            </span>
          </div>

          {rankingCouriers.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Plane className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <div className="text-[12px] text-slate-400">Sin datos de viajeros en el período.</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {rankingCouriers.map((r) => {
                const hasLt = r.leadTime != null;
                // Max para la barra = max lead time del conjunto
                const maxLt = Math.max(...rankingCouriers.map(x => x.leadTime?.promedio ?? 0)) || 1;
                const barPct = hasLt ? (r.leadTime!.promedio / maxLt) * 100 : 0;
                // Viajero con retenciones → amber; sin retenciones y con datos → emerald; sin datos → slate
                const dotColor = !hasLt ? 'bg-slate-300' : r.retenciones > 0 ? 'bg-amber-500' : 'bg-emerald-500';
                const barColor = !hasLt ? 'bg-slate-200' : r.retenciones > 0 ? 'bg-amber-400' : 'bg-emerald-400';

                return (
                  <div key={r.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                        <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-1 truncate max-w-[140px]">
                          {r.nombre}
                          <Plane className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        </span>
                      </div>
                      <span className="text-[12px] font-bold tabular-nums text-slate-900">
                        {hasLt ? (
                          <>{r.leadTime!.promedio.toFixed(1)}<span className="text-slate-400"> d</span></>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barPct}%` }} />
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5 tabular-nums">
                      {r.total} envío{r.total !== 1 ? 's' : ''}
                      {r.retenciones > 0 && ` · ${r.retenciones} con aduana`}
                      {hasLt && ` · +/- ${r.leadTime!.desviacion.toFixed(1)}d · ${r.leadTime!.n} med.`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {rankingCouriers.some(r => r.retenciones > 0) && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-amber-700">
              <AlertTriangle className="w-3 h-3" />
              <span>Viajeros con retenciones aduaneras tienen mayor dispersión de lead-time.</span>
            </div>
          )}
        </div>
      </div>

      {/* §D — Ranking por zona · entregas (sin fuente todavía) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <div className="text-[12px] font-bold text-slate-900">Por zona · entregas</div>
                <div className="text-[10px] text-slate-500">Volumen de despachos completados</div>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-600 border border-slate-200 rounded-full px-2 py-0.5">—</span>
          </div>

          {/* Empty-state honesto: el campo zona de destino no existe aún en el modelo de envío */}
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <MapPin className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <div className="text-[12px] text-slate-500 font-medium">Sin fuente de datos</div>
              <div className="text-[11px] text-slate-400 mt-1 max-w-[220px] mx-auto">
                El campo zona/destino del despacho F no existe aún en el modelo de Envío.
                Disponible cuando se implemente.
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-slate-400">
            <Info className="w-3 h-3 text-slate-400" />
            <span>Zona = destino final del despacho F · alimentará el mapa de calor de Ventas.</span>
          </div>
        </div>

      {/* §E — Nota metodología */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-400 flex items-start gap-1.5">
        <BarChart3 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-slate-500 mb-1 text-[11px]">Canon no-redundancia + Metodología</div>
          <ul className="space-y-0.5">
            <li><strong className="text-slate-600">Fill Rate</strong> = unidades recibidas / unidades esperadas (sobre envíos completados)</li>
            <li><strong className="text-slate-600">On-Time</strong> = envíos que llegaron ≤ ETA / total con fecha estimada registrada</li>
            <li><strong className="text-slate-600">Damage / Loss Rate</strong> = unidades con incidencia / unidades totales</li>
            <li><strong className="text-slate-600">Tiempo en aduana</strong> = días entre fechaRetencion y fechaLiberacion de incidencias tipo "aduana"</li>
            <li><strong className="text-slate-600">Rendimiento NO clona el KPI strip</strong> — aquí el DATO manda el tipo de gráfico: bullet para "vs meta", barras para ranking. Color semántico (emerald cumple · amber vigila · rose alerta), nunca chrome.</li>
          </ul>
        </div>
      </div>

    </div>
  );
};
