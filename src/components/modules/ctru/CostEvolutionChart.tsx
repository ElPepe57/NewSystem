import React from 'react';
import { TrendingUp } from 'lucide-react';
import { formatCurrency, CHART_COLORS } from '../../common/Charts';
import type { HistorialCostosMes } from '../../../store/ctruStore';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface CostEvolutionChartProps {
  historialMensual: HistorialCostosMes[];
}

export const CostEvolutionChart: React.FC<CostEvolutionChartProps> = ({ historialMensual }) => {
  const hasData = historialMensual.filter(h => h.costoCompraProm > 0).length >= 2;
  const hasVentas = historialMensual.some(h => h.precioVentaProm > 0);

  const chartData = historialMensual.map(h => {
    const adicOC = h.costoImpuestoProm + h.costoEnvioProm + h.costoOtrosProm;
    return {
      name: `${h.label} ${h.anio}`,
      Compra: Math.round(h.costoCompraProm * 100) / 100,
      'Adic. OC': Math.round(adicOC * 100) / 100,
      'Flete Intl': Math.round(h.costoFleteIntlProm * 100) / 100,
      'GA/GO': Math.round(h.gastoGAGOProm * 100) / 100,
      'Precio Venta': h.precioVentaProm > 0 ? Math.round(h.precioVentaProm * 100) / 100 : null
    };
  });

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
      <h3 className="text-base font-semibold text-gray-900 mb-0.5">Costos vs Precio de Venta</h3>
      <p className="text-xs text-gray-400 mb-4">
        Area = capas de costo acumuladas{hasVentas ? ' · Linea = precio venta promedio' : ''}
      </p>
      {hasData ? (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              stroke="#e5e7eb"
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              stroke="#e5e7eb"
              tickLine={false}
              tickFormatter={formatCurrency}
              width={65}
            />
            <Tooltip
              formatter={(value: number, name: string) => [formatCurrency(value), name]}
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                padding: '8px 12px',
                fontSize: '12px'
              }}
            />
            <Legend
              iconSize={10}
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            />
            <Area
              type="monotone"
              dataKey="Compra"
              name="Compra"
              fill={CHART_COLORS.primary}
              fillOpacity={0.6}
              stroke={CHART_COLORS.primary}
              strokeWidth={0}
              stackId="costs"
            />
            <Area
              type="monotone"
              dataKey="Adic. OC"
              name="Adic. OC"
              fill={CHART_COLORS.warning}
              fillOpacity={0.6}
              stroke={CHART_COLORS.warning}
              strokeWidth={0}
              stackId="costs"
            />
            <Area
              type="monotone"
              dataKey="Flete Intl"
              name="Flete Intl"
              fill="#f97316"
              fillOpacity={0.6}
              stroke="#f97316"
              strokeWidth={0}
              stackId="costs"
            />
            <Area
              type="monotone"
              dataKey="GA/GO"
              name="GA/GO"
              fill={CHART_COLORS.secondary}
              fillOpacity={0.6}
              stroke={CHART_COLORS.secondary}
              strokeWidth={0}
              stackId="costs"
            />
            {hasVentas && (
              <Line
                type="monotone"
                dataKey="Precio Venta"
                name="Precio Venta"
                stroke={CHART_COLORS.success}
                strokeWidth={3}
                dot={{ fill: CHART_COLORS.success, strokeWidth: 2, r: 4 }}
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex flex-col items-center justify-center h-[240px] text-gray-300">
          <TrendingUp className="w-10 h-10 mb-2" />
          <p className="text-sm text-gray-400">Datos insuficientes</p>
          <p className="text-xs text-gray-400">Se necesitan al menos 2 meses</p>
        </div>
      )}
    </div>
  );
};
