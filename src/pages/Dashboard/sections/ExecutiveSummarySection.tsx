import React from 'react';
import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { formatCurrencyPEN, formatCurrencyCompact } from '../../../utils/format';
import { Sparkline } from '../../../components/common/dashboard/Sparkline';
import { BulletProgressBar } from '../../../components/common/dashboard/BulletProgressBar';
import { HealthSemaphore } from '../../../components/common/dashboard/HealthSemaphore';
import type { HealthIndicator } from '../../../components/common/dashboard/HealthSemaphore';

interface ExecutiveSummarySectionProps {
  // Mes actual
  totalVentasMes: number;
  utilidadMes: number;
  margenPromedioMes: number;
  cantidadVentasMes: number;
  // Comparativo mes anterior
  crecimientoVentas: number;
  crecimientoUtilidad: number;
  cambioMargen: number;
  totalVentasMesAnterior: number;
  // Gastos
  gastosMes: number;
  gastosMesAnterior: number;
  crecimientoGastos: number;
  ratioGastosVentas: number;
  // Meta y progreso
  metaMensual: number;
  progresoMeta: number;
  promedioDiarioNecesario: number;
  diasRestantesMes: number;
  // Proyeccion
  proyeccionVentasFinMes: number;
  proyeccionVsMeta: number;
  // Texto natural
  resumenTexto: string;
  // Alertas
  stockCritico: number;
  cxcVencidos: number;
  // Sparklines
  sparklineVentas: { value: number }[];
  sparklineUtilidad: { value: number }[];
  sparklineGastos: { value: number }[];
  sparklineMargen: { value: number }[];
  // Semaforo
  healthIndicators: HealthIndicator[];
}

const fmt = (v: number) => formatCurrencyPEN(v);
const fmtC = (v: number) => formatCurrencyCompact(v, 'PEN');

interface TrendProps {
  value: number;
  unit?: 'percent' | 'pp';
  positiveIsGood?: boolean;
}

const TrendBadge: React.FC<TrendProps> = ({ value, unit = 'percent', positiveIsGood = true }) => {
  const isPositive = value > 0.1;
  const isNegative = value < -0.1;

  const colorClass = isPositive
    ? (positiveIsGood ? 'text-emerald-600' : 'text-red-600')
    : isNegative
      ? (positiveIsGood ? 'text-red-600' : 'text-emerald-600')
      : 'text-slate-400';

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  const formatted = unit === 'pp'
    ? `${value > 0 ? '+' : ''}${value.toFixed(1)}pp`
    : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {formatted} vs mes ant.
    </span>
  );
};

export const ExecutiveSummarySection: React.FC<ExecutiveSummarySectionProps> = ({
  totalVentasMes,
  utilidadMes,
  margenPromedioMes,
  cantidadVentasMes,
  crecimientoVentas,
  crecimientoUtilidad,
  cambioMargen,
  totalVentasMesAnterior,
  gastosMes,
  gastosMesAnterior,
  crecimientoGastos,
  ratioGastosVentas,
  metaMensual,
  progresoMeta,
  promedioDiarioNecesario,
  diasRestantesMes,
  proyeccionVentasFinMes,
  proyeccionVsMeta,
  resumenTexto,
  stockCritico,
  cxcVencidos,
  sparklineVentas,
  sparklineUtilidad,
  sparklineGastos,
  sparklineMargen,
  healthIndicators,
}) => {
  const faltaMeta = Math.max(metaMensual - totalVentasMes, 0);
  const metaAlcanzada = totalVentasMes >= metaMensual;

  return (
    <div className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200">

      {/* Fila superior: semaforo de salud */}
      <div className="mb-5">
        <HealthSemaphore indicators={healthIndicators} />
      </div>

      <div className="border-t border-slate-100 mb-5" />

      {/* Narrativa con numeros destacados */}
      <div className="mb-6">
        <p className="text-base lg:text-lg text-slate-700 leading-relaxed">
          {resumenTexto}
        </p>
        {(stockCritico > 0 || cxcVencidos > 0) && (
          <p className="mt-2 text-sm text-amber-600 flex items-center gap-1.5 flex-wrap">
            <span>&#9888;</span>
            {stockCritico > 0 && (
              <span>{stockCritico} {stockCritico === 1 ? 'producto' : 'productos'} con stock critico</span>
            )}
            {stockCritico > 0 && cxcVencidos > 0 && <span className="text-slate-300">·</span>}
            {cxcVencidos > 0 && (
              <span>{cxcVencidos} {cxcVencidos === 1 ? 'cobro vencido' : 'cobros vencidos'} +30 dias</span>
            )}
          </p>
        )}
      </div>

      <div className="border-t border-slate-100 mb-6" />

      {/* Grid 4 metricas con sparklines */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">

        {/* Ventas del mes */}
        <div className="min-w-0 bg-teal-50/60 rounded-xl p-4">
          <div className="text-xs lg:text-sm text-slate-500 mb-1 uppercase tracking-wide font-medium">Ventas del mes</div>
          <div className="text-xl lg:text-3xl font-bold text-slate-900 leading-tight truncate">
            <span className="hidden lg:inline">{fmt(totalVentasMes)}</span>
            <span className="lg:hidden">{fmtC(totalVentasMes)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div>
              {totalVentasMesAnterior > 0
                ? <TrendBadge value={crecimientoVentas} />
                : <span className="text-xs text-slate-500">{cantidadVentasMes} ventas</span>
              }
            </div>
            {sparklineVentas.length >= 2 && (
              <Sparkline data={sparklineVentas} width={72} height={24} />
            )}
          </div>
        </div>

        {/* Utilidad */}
        <div className="min-w-0 bg-teal-50/60 rounded-xl p-4">
          <div className="text-xs lg:text-sm text-slate-500 mb-1 uppercase tracking-wide font-medium">Utilidad</div>
          <div className="text-xl lg:text-3xl font-bold text-slate-900 leading-tight truncate">
            <span className="hidden lg:inline">{fmt(utilidadMes)}</span>
            <span className="lg:hidden">{fmtC(utilidadMes)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <TrendBadge value={crecimientoUtilidad} />
            {sparklineUtilidad.length >= 2 && (
              <Sparkline data={sparklineUtilidad} width={72} height={24} />
            )}
          </div>
        </div>

        {/* Gastos del mes */}
        <div className="min-w-0 bg-teal-50/60 rounded-xl p-4">
          <div className="text-xs lg:text-sm text-slate-500 mb-1 uppercase tracking-wide font-medium">Gastos del mes</div>
          <div className="text-xl lg:text-3xl font-bold text-slate-900 leading-tight truncate">
            <span className="hidden lg:inline">{fmt(gastosMes)}</span>
            <span className="lg:hidden">{fmtC(gastosMes)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div>
              {gastosMesAnterior > 0
                ? <TrendBadge value={crecimientoGastos} positiveIsGood={false} />
                : ratioGastosVentas > 0
                  ? <span className="text-xs text-slate-500">{ratioGastosVentas.toFixed(0)}% de ventas</span>
                  : <span className="text-xs text-slate-500">Sin datos previos</span>
              }
            </div>
            {sparklineGastos.length >= 2 && (
              <Sparkline data={sparklineGastos} width={72} height={24} color="#f59e0b" />
            )}
          </div>
        </div>

        {/* Margen */}
        <div className="min-w-0 bg-teal-50/60 rounded-xl p-4">
          <div className="text-xs lg:text-sm text-slate-500 mb-1 uppercase tracking-wide font-medium">Margen</div>
          <div className="text-xl lg:text-3xl font-bold text-slate-900 leading-tight">
            {margenPromedioMes.toFixed(1)}%
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <TrendBadge value={cambioMargen} unit="pp" />
            {sparklineMargen.length >= 2 && (
              <Sparkline data={sparklineMargen} width={72} height={24} />
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 mb-5" />

      {/* Bullet Chart: meta mensual con proyeccion */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <span className="text-sm font-medium text-slate-600">Meta mensual</span>
          </div>
          <span className={`text-sm font-bold ${metaAlcanzada ? 'text-emerald-600' : 'text-slate-700'}`}>
            {progresoMeta.toFixed(0)}% · {fmtC(totalVentasMes)} / {fmtC(metaMensual)}
          </span>
        </div>

        <BulletProgressBar progress={progresoMeta} />

        {/* Barra de proyeccion (secundaria, traslucida) */}
        {proyeccionVentasFinMes > totalVentasMes && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">Proyeccion fin de mes</span>
              <span className={`text-xs font-medium ${proyeccionVsMeta >= 100 ? 'text-emerald-600' : proyeccionVsMeta >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                {fmtC(proyeccionVentasFinMes)} ({proyeccionVsMeta.toFixed(0)}% de meta)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full transition-all duration-700 opacity-60"
                style={{
                  width: `${Math.min(proyeccionVsMeta, 100)}%`,
                  backgroundColor: proyeccionVsMeta >= 100 ? '#10b981' : proyeccionVsMeta >= 80 ? '#f59e0b' : '#f43f5e'
                }}
              />
            </div>
          </div>
        )}

        {/* Subtexto bajo la barra */}
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          {metaAlcanzada ? (
            <span className="text-emerald-600 font-medium">Meta alcanzada este mes</span>
          ) : (
            <span>
              Faltan {fmtC(faltaMeta)}
              {diasRestantesMes > 0 && promedioDiarioNecesario > 0 && (
                <> · Promedio diario necesario: <span className="text-slate-700 font-medium">{fmtC(promedioDiarioNecesario)}/dia</span></>
              )}
            </span>
          )}
          {diasRestantesMes > 0 && (
            <span>{diasRestantesMes} {diasRestantesMes === 1 ? 'dia' : 'dias'} restantes</span>
          )}
        </div>
      </div>
    </div>
  );
};
