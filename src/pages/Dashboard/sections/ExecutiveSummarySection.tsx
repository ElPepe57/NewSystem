import React from 'react';
import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { formatCurrencyPEN, formatCurrencyCompact } from '../../../utils/format';

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
  // Meta y progreso
  metaMensual: number;
  progresoMeta: number;
  promedioDiarioNecesario: number;
  diasRestantesMes: number;
  // Texto natural
  resumenTexto: string;
  // Alertas para el resumen
  stockCritico: number;
  cxcVencidos: number;
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
  const isGood = positiveIsGood ? isPositive : isNegative;

  const colorClass = isPositive
    ? (positiveIsGood ? 'text-emerald-400' : 'text-rose-400')
    : isNegative
      ? (positiveIsGood ? 'text-rose-400' : 'text-emerald-400')
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
  metaMensual,
  progresoMeta,
  promedioDiarioNecesario,
  diasRestantesMes,
  resumenTexto,
  stockCritico,
  cxcVencidos,
}) => {
  const faltaMeta = Math.max(metaMensual - totalVentasMes, 0);
  const metaAlcanzada = totalVentasMes >= metaMensual;

  // Color de la barra de progreso
  const barColor = progresoMeta >= 70
    ? 'bg-emerald-500'
    : progresoMeta >= 40
      ? 'bg-amber-500'
      : 'bg-rose-500';

  const hayAlertas = stockCritico > 0 || cxcVencidos > 0;

  return (
    <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 lg:p-8 shadow-xl">

      {/* Fila superior: resumen en texto natural */}
      <div className="mb-6">
        <p className="text-base lg:text-lg text-slate-200 leading-relaxed">
          {resumenTexto}
        </p>
        {hayAlertas && (
          <p className="mt-2 text-sm text-amber-400 flex items-center gap-1.5">
            <span className="text-amber-400">&#9888;</span>
            {stockCritico > 0 && (
              <span>{stockCritico} {stockCritico === 1 ? 'producto' : 'productos'} con stock critico</span>
            )}
            {stockCritico > 0 && cxcVencidos > 0 && <span className="text-slate-500"> · </span>}
            {cxcVencidos > 0 && (
              <span>{cxcVencidos} {cxcVencidos === 1 ? 'cobro vencido' : 'cobros vencidos'} +30 dias</span>
            )}
          </p>
        )}
      </div>

      {/* Divisor */}
      <div className="border-t border-slate-700 mb-6" />

      {/* Fila media: 3 metricas grandes inline */}
      <div className="grid grid-cols-3 gap-4 lg:gap-8 mb-6">

        {/* Ventas del mes */}
        <div className="min-w-0">
          <div className="text-sm text-slate-400 mb-1">Ventas del mes</div>
          <div className="text-2xl lg:text-4xl font-bold text-white leading-tight truncate">
            <span className="hidden lg:inline">{fmt(totalVentasMes)}</span>
            <span className="lg:hidden">{fmtC(totalVentasMes)}</span>
          </div>
          <div className="mt-1.5">
            {totalVentasMesAnterior > 0
              ? <TrendBadge value={crecimientoVentas} />
              : <span className="text-xs text-slate-500">{cantidadVentasMes} ventas</span>
            }
          </div>
        </div>

        {/* Utilidad */}
        <div className="min-w-0">
          <div className="text-sm text-slate-400 mb-1">Utilidad</div>
          <div className="text-2xl lg:text-4xl font-bold text-white leading-tight truncate">
            <span className="hidden lg:inline">{fmt(utilidadMes)}</span>
            <span className="lg:hidden">{fmtC(utilidadMes)}</span>
          </div>
          <div className="mt-1.5">
            <TrendBadge value={crecimientoUtilidad} />
          </div>
        </div>

        {/* Margen */}
        <div className="min-w-0">
          <div className="text-sm text-slate-400 mb-1">Margen</div>
          <div className="text-2xl lg:text-4xl font-bold text-white leading-tight">
            {margenPromedioMes.toFixed(1)}%
          </div>
          <div className="mt-1.5">
            <TrendBadge value={cambioMargen} unit="pp" />
          </div>
        </div>
      </div>

      {/* Divisor */}
      <div className="border-t border-slate-700 mb-5" />

      {/* Fila inferior: barra de progreso hacia meta */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <span className="text-sm font-medium text-slate-300">
              Meta mensual
            </span>
          </div>
          <span className={`text-sm font-bold ${
            metaAlcanzada ? 'text-emerald-400' : 'text-slate-300'
          }`}>
            {progresoMeta.toFixed(0)}% · {fmtC(totalVentasMes)} / {fmtC(metaMensual)}
          </span>
        </div>

        {/* Barra */}
        <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${Math.min(progresoMeta, 100)}%` }}
          />
        </div>

        {/* Subtexto bajo la barra */}
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          {metaAlcanzada ? (
            <span className="text-emerald-400 font-medium">Meta alcanzada este mes</span>
          ) : (
            <span>
              Faltan {fmtC(faltaMeta)}
              {diasRestantesMes > 0 && promedioDiarioNecesario > 0 && (
                <> · Promedio diario necesario: <span className="text-slate-300 font-medium">{fmtC(promedioDiarioNecesario)}/dia</span></>
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
