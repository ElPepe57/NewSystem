/**
 * PRICE HISTORY CHART
 * Gráfico de línea que muestra el histórico de precios de compra
 * con líneas de referencia para promedio y precio actual
 */

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart
} from 'recharts';
import type { PuntoHistorico } from '../../../types/priceIntelligence.types';

interface PriceHistoryChartProps {
  puntos: PuntoHistorico[];
  precioActual: number;
  promedioHistorico: number;
  height?: number;
}

export const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({
  puntos,
  precioActual,
  promedioHistorico,
  height = 200
}) => {
  // Preparar datos para el gráfico
  const chartData = useMemo(() => {
    return puntos.map(punto => ({
      fecha: punto.fecha.toLocaleDateString('es-PE', {
        month: 'short',
        day: 'numeric',
        year: '2-digit'
      }),
      fechaCompleta: punto.fecha.toLocaleDateString('es-PE', {
        weekday: 'short',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      precio: punto.precio,
      proveedor: punto.proveedor,
      cantidad: punto.cantidad,
      orden: punto.numeroOrden
    }));
  }, [puntos]);

  // Calcular rango del eje Y
  const yDomain = useMemo(() => {
    if (puntos.length === 0) return [0, 100];

    const precios = [...puntos.map(p => p.precio), precioActual, promedioHistorico].filter(p => p > 0);
    const minPrecio = Math.min(...precios);
    const maxPrecio = Math.max(...precios);
    const padding = (maxPrecio - minPrecio) * 0.15 || maxPrecio * 0.1;

    return [
      Math.max(0, minPrecio - padding),
      maxPrecio + padding
    ];
  }, [puntos, precioActual, promedioHistorico]);

  // Tooltip personalizado
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 text-sm">
        <p className="font-medium text-gray-900">{data.fechaCompleta}</p>
        <div className="mt-2 space-y-1">
          <p className="text-gray-600">
            <span className="font-medium text-primary-600">${data.precio.toFixed(2)}</span> USD
          </p>
          <p className="text-gray-500 text-xs">Proveedor: {data.proveedor}</p>
          <p className="text-gray-500 text-xs">Cantidad: {data.cantidad} unidades</p>
          <p className="text-gray-500 text-xs">Orden: {data.orden}</p>
        </div>
      </div>
    );
  };

  if (puntos.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300"
        style={{ height }}
      >
        <p className="text-sm text-gray-400">Sin datos históricos para graficar</p>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
        >
          <defs>
            <linearGradient id="colorPrecio" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />

          <XAxis
            dataKey="fecha"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
          />

          <YAxis
            domain={yDomain}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
            width={45}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Área bajo la línea */}
          <Area
            type="monotone"
            dataKey="precio"
            stroke="transparent"
            fill="url(#colorPrecio)"
          />

          {/* Línea de precios históricos */}
          <Line
            type="monotone"
            dataKey="precio"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: '#4f46e5' }}
          />

          {/* Línea de referencia: Promedio histórico */}
          {promedioHistorico > 0 && (
            <ReferenceLine
              y={promedioHistorico}
              stroke="#9ca3af"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              label={{
                value: `Prom: $${promedioHistorico.toFixed(2)}`,
                position: 'right',
                fill: '#6b7280',
                fontSize: 10
              }}
            />
          )}

          {/* Línea de referencia: Precio actual ingresado */}
          {precioActual > 0 && (
            <ReferenceLine
              y={precioActual}
              stroke={precioActual > promedioHistorico ? '#ef4444' : '#22c55e'}
              strokeDasharray="3 3"
              strokeWidth={2}
              label={{
                value: `Actual: $${precioActual.toFixed(2)}`,
                position: 'left',
                fill: precioActual > promedioHistorico ? '#dc2626' : '#16a34a',
                fontSize: 10,
                fontWeight: 'bold'
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Leyenda */}
      <div className="flex items-center justify-center gap-6 mt-2 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-primary-500 rounded"></div>
          <span>Precios históricos</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-gray-400 rounded" style={{ borderStyle: 'dashed' }}></div>
          <span>Promedio</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`w-3 h-0.5 rounded ${precioActual > promedioHistorico ? 'bg-red-500' : 'bg-green-500'}`}></div>
          <span>Precio actual</span>
        </div>
      </div>
    </div>
  );
};
