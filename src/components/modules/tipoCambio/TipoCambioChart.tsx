import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TipoCambioHistorial } from '../../../types/tipoCambio.types';

interface TipoCambioChartProps {
  historial: TipoCambioHistorial[];
  loading?: boolean;
}

export const TipoCambioChart: React.FC<TipoCambioChartProps> = ({
  historial,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (historial.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-gray-500">
        No hay datos para mostrar
      </div>
    );
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={historial}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="fecha" 
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
          />
          <YAxis 
            domain={['auto', 'auto']}
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
            tickFormatter={(value) => value.toFixed(3)}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px'
            }}
            formatter={(value: any) => value.toFixed(3)}
          />
          <Legend 
            wrapperStyle={{ fontSize: '14px' }}
          />
          <Line 
            type="monotone" 
            dataKey="compra" 
            stroke="#10b981" 
            strokeWidth={2}
            name="Compra"
            dot={{ fill: '#10b981', r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line 
            type="monotone" 
            dataKey="venta" 
            stroke="#ef4444" 
            strokeWidth={2}
            name="Venta"
            dot={{ fill: '#ef4444', r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line 
            type="monotone" 
            dataKey="promedio" 
            stroke="#3b82f6" 
            strokeWidth={2}
            name="Promedio"
            dot={{ fill: '#3b82f6', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};