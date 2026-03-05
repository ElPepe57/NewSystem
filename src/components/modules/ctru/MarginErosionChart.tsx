import React from 'react';
import { TrendingDown } from 'lucide-react';
import { Card } from '../../common';
import { formatCurrency, CHART_COLORS } from '../../common/Charts';
import type { HistorialCostosMes } from '../../../store/ctruStore';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface MarginErosionChartProps {
  historialMensual: HistorialCostosMes[];
}

export const MarginErosionChart: React.FC<MarginErosionChartProps> = ({ historialMensual }) => {
  const hasData = historialMensual.filter(h => h.costoCompraProm > 0).length >= 2;
  const hasVentas = historialMensual.some(h => h.precioVentaProm > 0);

  const chartData = historialMensual.map(h => {
    // Group OC additionals to reduce bar clutter
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
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Erosion del Margen</h3>
      <p className="text-xs text-gray-500 mb-4">
        Barras = capas de costo apiladas{hasVentas ? ' | Linea = precio de venta promedio' : ''}
      </p>
      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={formatCurrency} />
            <Tooltip
              formatter={(value: number, name: string) => [formatCurrency(value), name]}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
            />
            <Legend />
            <Bar dataKey="Compra" name="Compra" fill={CHART_COLORS.primary} stackId="costs" />
            <Bar dataKey="Adic. OC" name="Adic. OC" fill={CHART_COLORS.warning} stackId="costs" />
            <Bar dataKey="Flete Intl" name="Flete Intl" fill="#f97316" stackId="costs" />
            <Bar dataKey="GA/GO" name="GA/GO" fill={CHART_COLORS.secondary} stackId="costs" radius={[4, 4, 0, 0]} />
            {hasVentas && (
              <Line
                type="monotone"
                dataKey="Precio Venta"
                name="Precio Venta"
                stroke={CHART_COLORS.success}
                strokeWidth={3}
                dot={{ fill: CHART_COLORS.success, strokeWidth: 2, r: 5 }}
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex flex-col items-center justify-center h-[260px] text-gray-400">
          <TrendingDown className="w-10 h-10 mb-2" />
          <p className="text-sm">Datos insuficientes para mostrar erosion</p>
          <p className="text-xs">Se necesitan al menos 2 meses con datos</p>
        </div>
      )}
    </Card>
  );
};
