/**
 * TabRendimiento — S40 Bloque D
 *
 * Dashboard ejecutivo de KPIs operativos de logística.
 *
 * Métricas (se calculan en memoria desde envíos + reclamos):
 *  - Fill Rate: % unidades recibidas vs esperadas
 *  - On-Time Delivery: % envíos que llegaron dentro del ETA
 *  - Damage Rate: % unidades dañadas sobre recibidas
 *  - Loss Rate: % unidades perdidas sobre esperadas
 *  - Customs Clearance Time: días promedio en aduana
 *  - Recovery Rate: % monto reclamado que se cobró
 *
 * Todos los % se muestran con código de color semáforo (verde ≥80, ámbar 60-80, rojo <60).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  PackageCheck,
  Clock,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  TrendingUp,
  Calendar,
  Truck,
} from 'lucide-react';
import { StatCard } from '../../design-system';
import { useEnvioStore } from '../../store/envioStore';
import { useReclamoStore } from '../../store/reclamoStore';
import { formatCurrency } from '../../utils/format';
import type { Envio } from '../../types/envio.types';

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

function semaforoVariant(pct: number, isGoodHigh: boolean = true): 'success' | 'warning' | 'danger' {
  if (isGoodHigh) {
    if (pct >= 80) return 'success';
    if (pct >= 60) return 'warning';
    return 'danger';
  } else {
    if (pct <= 5) return 'success';
    if (pct <= 15) return 'warning';
    return 'danger';
  }
}

export const TabRendimiento: React.FC = () => {
  const { envios, fetchEnvios } = useEnvioStore();
  const { resumen: resumenReclamos, fetchResumen: fetchResumenReclamos } = useReclamoStore();
  const [periodo, setPeriodo] = useState<Periodo>('ultimos_3_meses');

  useEffect(() => {
    if (envios.length === 0) fetchEnvios();
    fetchResumenReclamos();
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
    let totalRetenidas = 0;

    for (const e of enviosCompletados) {
      totalEsperadas += e.totalUnidades || 0;
      totalRecibidas += e.totalUnidadesRecibidas || 0;
      totalDanadas += e.totalUnidadesDanadas || 0;
      totalPerdidas += e.totalUnidadesFaltantes || 0;
      totalRetenidas += (e.unidades || []).filter(u => u.estadoEnvio === 'retenida').length;
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

    // Tiempo promedio en aduana: aprox usando envíos con incidencias aduana resueltas
    // S40: simplificado — sin fallback legacy ('otro' + descripción "aduana")
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
      totalRetenidas,
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

  // Ranking de envíos con mayor Damage Rate
  const rankingDanadas = useMemo(() => {
    return enviosPeriodo
      .filter(e => (e.totalUnidadesDanadas || 0) > 0)
      .map(e => ({
        envio: e,
        danadas: e.totalUnidadesDanadas || 0,
        total: e.totalUnidades || 0,
        rate: ((e.totalUnidadesDanadas || 0) / Math.max(e.totalUnidades || 1, 1)) * 100,
      }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);
  }, [enviosPeriodo]);

  // Ranking de couriers por on-time
  const rankingCouriers = useMemo(() => {
    const byCourier = new Map<string, { total: number; aTiempo: number; retenciones: number }>();
    for (const e of enviosPeriodo) {
      const nombre = e.colaboradorNombre || '—';
      const curr = byCourier.get(nombre) || { total: 0, aTiempo: 0, retenciones: 0 };
      curr.total++;
      if (e.fechaLlegadaReal && e.fechaLlegadaEstimada
        && e.fechaLlegadaReal.toMillis() <= e.fechaLlegadaEstimada.toMillis()) {
        curr.aTiempo++;
      }
      if ((e.incidencias || []).some(i => i.tipo === 'aduana')) curr.retenciones++;
      byCourier.set(nombre, curr);
    }
    return [...byCourier.entries()]
      .filter(([nombre]) => nombre !== '—')
      .map(([nombre, stats]) => ({
        nombre,
        total: stats.total,
        onTimeRate: stats.total > 0 ? (stats.aTiempo / stats.total) * 100 : 0,
        retenciones: stats.retenciones,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [enviosPeriodo]);

  return (
    <div className="space-y-4">
      {/* Filtro período */}
      <div className="flex items-center justify-between gap-2 p-3 bg-white border border-slate-200 rounded-lg">
        <div className="text-sm text-slate-600">
          <span className="font-medium text-slate-800">{metricas.totalEnvios}</span> envíos analizados ·{' '}
          <span className="font-medium text-slate-800">{metricas.enviosCompletados}</span> completados
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
            className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {(Object.keys(PERIODO_LABELS) as Periodo[]).map(p => (
              <option key={p} value={p}>{PERIODO_LABELS[p]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Fill Rate"
          value={`${metricas.fillRate.toFixed(1)}%`}
          icon={PackageCheck}
          variant={semaforoVariant(metricas.fillRate, true)}
          subtitle={`${metricas.totalRecibidas}/${metricas.totalEsperadas} unidades`}
        />
        <StatCard
          label="On-Time Delivery"
          value={`${metricas.onTimeRate.toFixed(1)}%`}
          icon={Clock}
          variant={semaforoVariant(metricas.onTimeRate, true)}
          subtitle={`${metricas.onTimeEnviosCount} envíos con ETA`}
        />
        <StatCard
          label="Damage Rate"
          value={`${metricas.damageRate.toFixed(1)}%`}
          icon={AlertTriangle}
          variant={semaforoVariant(metricas.damageRate, false)}
          subtitle={`${metricas.totalDanadas} unidad(es) dañadas`}
        />
        <StatCard
          label="Loss Rate"
          value={`${metricas.lossRate.toFixed(1)}%`}
          icon={XCircle}
          variant={semaforoVariant(metricas.lossRate, false)}
          subtitle={`${metricas.totalPerdidas} unidad(es) perdidas`}
        />
      </div>

      {/* KPIs secundarios */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Tiempo en tránsito"
          value={metricas.diasPromedio > 0 ? `${metricas.diasPromedio.toFixed(1)} días` : '—'}
          icon={Truck}
          variant="info"
          subtitle="Promedio por envío"
        />
        <StatCard
          label="Tiempo en aduana"
          value={metricas.diasAduanaPromedio > 0 ? `${metricas.diasAduanaPromedio.toFixed(1)} días` : '—'}
          icon={ShieldAlert}
          variant={metricas.diasAduanaPromedio > 5 ? 'danger' : metricas.diasAduanaPromedio > 2 ? 'warning' : 'success'}
          subtitle={`${metricas.cantMuestrasAduana} muestra(s)`}
        />
        <StatCard
          label="Recovery Rate"
          value={resumenReclamos ? `${resumenReclamos.tasaRecuperacion.toFixed(1)}%` : '—'}
          icon={TrendingUp}
          variant={resumenReclamos ? semaforoVariant(resumenReclamos.tasaRecuperacion, true) : 'neutral'}
          subtitle="% cobrado vs reclamado"
        />
        <StatCard
          label="Monto perdido"
          value={resumenReclamos ? formatCurrency(resumenReclamos.totalPerdidoPEN, 'PEN') : '—'}
          icon={XCircle}
          variant={resumenReclamos && resumenReclamos.totalPerdidoPEN > 0 ? 'danger' : 'neutral'}
          subtitle="Reclamos rechazados"
        />
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ranking dañadas */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h4 className="text-sm font-semibold text-slate-900">Top 5 envíos con dañadas</h4>
          </div>
          {rankingDanadas.length === 0 ? (
            <div className="text-xs text-slate-500 py-4 text-center">✨ Sin envíos dañados en el período.</div>
          ) : (
            <div className="space-y-2">
              {rankingDanadas.map(r => (
                <div key={r.envio.id} className="flex items-center justify-between gap-2 p-2 bg-amber-50/50 border border-amber-200 rounded-lg text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{r.envio.numeroEnvio}</div>
                    <div className="text-slate-500 truncate">
                      {r.envio.origenProveedorNombre || r.envio.origenCasillaNombre || '—'}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold text-amber-700">{r.rate.toFixed(1)}%</div>
                    <div className="text-[10px] text-slate-500">{r.danadas}/{r.total} u</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ranking couriers */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4 text-sky-600" />
            <h4 className="text-sm font-semibold text-slate-900">Top couriers por volumen</h4>
          </div>
          {rankingCouriers.length === 0 ? (
            <div className="text-xs text-slate-500 py-4 text-center">Sin datos de couriers en el período.</div>
          ) : (
            <div className="space-y-2">
              {rankingCouriers.map(r => (
                <div key={r.nombre} className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900 truncate">{r.nombre}</div>
                    <div className="text-slate-500">{r.total} envío(s){r.retenciones > 0 && ` · ${r.retenciones} con aduana`}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`font-semibold ${
                      r.onTimeRate >= 80 ? 'text-emerald-700'
                      : r.onTimeRate >= 60 ? 'text-amber-700'
                      : 'text-red-700'
                    }`}>
                      {r.onTimeRate.toFixed(0)}%
                    </div>
                    <div className="text-[10px] text-slate-500">on-time</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notas metodología */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
        <div className="font-medium text-slate-800 mb-1">📊 Metodología</div>
        <ul className="space-y-0.5 list-disc list-inside">
          <li><strong>Fill Rate</strong> = unidades recibidas / unidades esperadas (sobre envíos completados)</li>
          <li><strong>On-Time</strong> = envíos que llegaron ≤ ETA / total con fecha estimada</li>
          <li><strong>Damage / Loss Rate</strong> = unidades con incidencia / unidades totales</li>
          <li><strong>Tiempo en aduana</strong> = días entre fechaRetencion y fechaLiberacion de incidencias aduana</li>
          <li><strong>Recovery Rate</strong> = monto cobrado en reclamos / monto total reclamado</li>
        </ul>
      </div>
    </div>
  );
};
