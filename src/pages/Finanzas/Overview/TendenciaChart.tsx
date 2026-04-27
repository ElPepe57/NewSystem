/**
 * TendenciaChart — S57 Fase C · Gráfico de tendencia 6 meses
 *
 * Barras agrupadas (ingresos vs egresos) en PEN equivalente,
 * sobre los últimos 6 meses. Diseño minimalista estilo Stripe/Mercury.
 *
 * Fuente: MovimientoTesoreria (filtrado por estado != anulado).
 * Equivalencia PEN: usa montoEquivalentePEN del propio mov.
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MovimientoTesoreria } from '../../../types/tesoreria.types';
import { TIPOS_INGRESO, TIPOS_EGRESO } from '../../../services/tesoreria.shared';
import { cn } from '../../../design-system';

interface TendenciaChartProps {
  movimientos: MovimientoTesoreria[];
  loading?: boolean;
}

interface MesData {
  key: string; // YYYY-MM
  label: string; // Ene, Feb...
  anio: number;
  mes: number;
  ingresos: number;
  egresos: number;
  neto: number;
  esMesActual: boolean;
}

const MESES_CORTOS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function fmtPEN(n: number, abreviado = false): string {
  if (abreviado && Math.abs(n) >= 1000) {
    return `S/ ${(n / 1000).toFixed(1)}K`;
  }
  return `S/ ${n.toLocaleString('es-PE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export const TendenciaChart: React.FC<TendenciaChartProps> = ({
  movimientos,
  loading,
}) => {
  // ── Calcular últimos 6 meses ──
  const meses = React.useMemo<MesData[]>(() => {
    const ahora = new Date();
    const lista: MesData[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      lista.push({
        key: `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`,
        label: MESES_CORTOS[d.getMonth()],
        anio: d.getFullYear(),
        mes: d.getMonth(),
        ingresos: 0,
        egresos: 0,
        neto: 0,
        esMesActual: i === 0,
      });
    }

    for (const m of movimientos) {
      if (m.estado === 'anulado') continue;
      const fecha = m.fecha.toDate();
      const key = `${fecha.getFullYear()}-${String(fecha.getMonth()).padStart(2, '0')}`;
      const bucket = lista.find((b) => b.key === key);
      if (!bucket) continue;

      const equivPEN = m.montoEquivalentePEN || 0;
      if (TIPOS_INGRESO.includes(m.tipo)) bucket.ingresos += equivPEN;
      else if (TIPOS_EGRESO.includes(m.tipo)) bucket.egresos += equivPEN;
    }

    for (const b of lista) b.neto = b.ingresos - b.egresos;
    return lista;
  }, [movimientos]);

  // ── Encontrar el máximo para escalar barras ──
  const maxValor = React.useMemo(() => {
    let max = 0;
    for (const m of meses) {
      if (m.ingresos > max) max = m.ingresos;
      if (m.egresos > max) max = m.egresos;
    }
    return max || 1;
  }, [meses]);

  // ── Datos del mes activo ──
  const mesActivo = meses[meses.length - 1];
  const mesAnterior = meses[meses.length - 2];
  const variacionNeto =
    mesAnterior && mesAnterior.neto !== 0
      ? Math.round(((mesActivo.neto - mesAnterior.neto) / Math.abs(mesAnterior.neto)) * 100)
      : null;

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="h-48 bg-slate-50 rounded animate-pulse" />
      </div>
    );
  }

  const sinDatos = meses.every((m) => m.ingresos === 0 && m.egresos === 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Tendencia 6 meses</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Ingresos vs egresos en PEN equivalente
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-600">Ingresos</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-slate-600">Egresos</span>
          </span>
        </div>
      </div>

      {/* Chart */}
      {sinDatos ? (
        <div className="h-40 flex items-center justify-center text-sm text-slate-400 italic">
          Sin movimientos en los últimos 6 meses
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-2 items-end h-40 mt-4">
          {meses.map((m) => {
            const altIng = (m.ingresos / maxValor) * 100;
            const altEgr = (m.egresos / maxValor) * 100;
            return (
              <div key={m.key} className="flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end h-32" title={
                  `${m.label} ${m.anio}\nIngresos: ${fmtPEN(m.ingresos)}\nEgresos: ${fmtPEN(m.egresos)}\nNeto: ${m.neto >= 0 ? '+' : ''}${fmtPEN(m.neto)}`
                }>
                  <div
                    className={cn(
                      'flex-1 rounded-t transition-opacity hover:opacity-80',
                      m.esMesActual ? 'bg-emerald-500' : 'bg-emerald-400',
                    )}
                    style={{ height: `${Math.max(altIng, 1)}%` }}
                  />
                  <div
                    className={cn(
                      'flex-1 rounded-t transition-opacity hover:opacity-80',
                      m.esMesActual ? 'bg-red-500' : 'bg-red-400',
                    )}
                    style={{ height: `${Math.max(altEgr, 1)}%` }}
                  />
                </div>
                <span
                  className={cn(
                    'text-[10px]',
                    m.esMesActual
                      ? 'text-slate-700 font-semibold'
                      : 'text-slate-500',
                  )}
                >
                  {m.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Resumen del mes activo */}
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">
            Ingresos {mesActivo.label}
          </div>
          <div className="text-base font-bold text-emerald-700 tabular-nums">
            {fmtPEN(mesActivo.ingresos)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">
            Egresos {mesActivo.label}
          </div>
          <div className="text-base font-bold text-red-700 tabular-nums">
            {fmtPEN(mesActivo.egresos)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-1">
            Diferencia
            {variacionNeto !== null && (
              <span
                className={cn(
                  'text-[10px] flex items-center gap-0.5',
                  variacionNeto > 0
                    ? 'text-emerald-600'
                    : variacionNeto < 0
                      ? 'text-red-600'
                      : 'text-slate-400',
                )}
              >
                {variacionNeto > 0 ? (
                  <TrendingUp className="w-2.5 h-2.5" />
                ) : variacionNeto < 0 ? (
                  <TrendingDown className="w-2.5 h-2.5" />
                ) : (
                  <Minus className="w-2.5 h-2.5" />
                )}
                {Math.abs(variacionNeto)}%
              </span>
            )}
          </div>
          <div
            className={cn(
              'text-base font-bold tabular-nums',
              mesActivo.neto >= 0 ? 'text-purple-700' : 'text-red-700',
            )}
          >
            {mesActivo.neto >= 0 ? '+' : '−'}
            {fmtPEN(Math.abs(mesActivo.neto))}
          </div>
        </div>
      </div>
    </div>
  );
};
