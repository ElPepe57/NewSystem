import React from 'react';
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
import type { TendenciaVentas } from '../../../types/reporte.types';

interface TendenciaChartProps {
  data: TendenciaVentas[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white px-3 py-2 border border-gray-200 rounded-lg shadow-lg text-xs sm:text-sm">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}</span>
          </span>
          <span className="font-semibold text-gray-900">
            {entry.name === 'Margen'
              ? `${Number(entry.value).toFixed(1)}%`
              : `S/ ${Number(entry.value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
        </div>
      ))}
    </div>
  );
};

export const TendenciaChart: React.FC<TendenciaChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No hay datos para mostrar la tendencia
      </div>
    );
  }

  // Auto interval: show ~7-8 labels max
  const interval = data.length > 8 ? Math.ceil(data.length / 7) - 1 : 0;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis
          dataKey="fecha"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          angle={-45}
          textAnchor="end"
          interval={interval}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickFormatter={(value) => `S/${value}`}
          tickLine={false}
          axisLine={false}
          width={55}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickFormatter={(value) => `${value}%`}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          iconSize={10}
        />
        <Bar
          yAxisId="left"
          dataKey="ventas"
          name="Ventas"
          fill="#3b82f6"
          radius={[3, 3, 0, 0]}
          maxBarSize={24}
          opacity={0.85}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="margen"
          name="Margen"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ r: 2.5, fill: '#f59e0b', strokeWidth: 0 }}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};
