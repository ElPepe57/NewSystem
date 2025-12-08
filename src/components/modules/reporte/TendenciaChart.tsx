import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TendenciaVentas } from '../../../types/reporte.types';

interface TendenciaChartProps {
  data: TendenciaVentas[];
}

// Formatter personalizado para el Tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
      <p className="font-semibold text-gray-900 mb-2">{label}</p>
      {payload.map((entry: any, index: number) => {
        let value = entry.value;
        let formattedValue = '';
        
        // Formatear según el tipo de dato
        if (entry.name === 'Ventas' || entry.name === 'Utilidad') {
          // Soles para Ventas y Utilidad
          formattedValue = `S/ ${value.toFixed(2)}`;
        } else if (entry.name === 'Margen') {
          // Porcentaje para Margen
          formattedValue = `${value.toFixed(1)}%`;
        }
        
        return (
          <div key={index} className="flex items-center justify-between gap-4">
            <span style={{ color: entry.color }} className="font-medium">
              {entry.name}:
            </span>
            <span className="font-semibold text-gray-900">
              {formattedValue}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const TendenciaChart: React.FC<TendenciaChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No hay datos suficientes para mostrar la tendencia
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="fecha" 
          tick={{ fontSize: 12 }}
        />
        <YAxis 
          yAxisId="left"
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => `S/ ${value}`}
          label={{ value: 'Ventas y Utilidad (S/)', angle: -90, position: 'insideLeft' }}
        />
        <YAxis 
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => `${value}%`}
          label={{ value: 'Margen (%)', angle: 90, position: 'insideRight' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line 
          yAxisId="left"
          type="monotone" 
          dataKey="ventas" 
          stroke="#0ea5e9" 
          name="Ventas"
          strokeWidth={2}
        />
        <Line 
          yAxisId="left"
          type="monotone" 
          dataKey="utilidad" 
          stroke="#10b981" 
          name="Utilidad"
          strokeWidth={2}
        />
        <Line 
          yAxisId="right"
          type="monotone" 
          dataKey="margen" 
          stroke="#f59e0b" 
          name="Margen"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};