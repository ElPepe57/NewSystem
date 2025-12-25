import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell
} from 'recharts';
import type { ProductoRentabilidad } from '../../../types/reporte.types';

interface RentabilidadBarChartProps {
  productos: ProductoRentabilidad[];
  maxItems?: number;
  tipo?: 'utilidad' | 'margen' | 'ventas';
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900 mb-2">{data.nombreCompleto}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Ventas:</span>
            <span className="font-medium">S/ {data.ventasTotalPEN.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Utilidad:</span>
            <span className="font-medium text-green-600">S/ {data.utilidadPEN.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Margen:</span>
            <span className="font-medium text-blue-600">{data.margenPromedio.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Unidades:</span>
            <span className="font-medium">{data.unidadesVendidas}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const RentabilidadBarChart: React.FC<RentabilidadBarChartProps> = ({
  productos,
  maxItems = 10,
  tipo = 'utilidad'
}) => {
  // Preparar datos para el gráfico
  const data = productos
    .slice(0, maxItems)
    .map(p => ({
      ...p,
      nombre: `${p.marca.substring(0, 8)} - ${p.nombreComercial.substring(0, 12)}`,
      nombreCompleto: `${p.marca} ${p.nombreComercial}`,
      // Valor para el eje Y según tipo
      valor: tipo === 'utilidad' ? p.utilidadPEN :
             tipo === 'margen' ? p.margenPromedio :
             p.ventasTotalPEN
    }));

  const getBarColor = (margen: number) => {
    if (margen >= 40) return '#10B981'; // green
    if (margen >= 25) return '#3B82F6'; // blue
    if (margen >= 15) return '#F59E0B'; // yellow
    return '#EF4444'; // red
  };

  const formatValue = (value: number) => {
    if (tipo === 'margen') return `${value.toFixed(0)}%`;
    if (value >= 1000) return `S/ ${(value / 1000).toFixed(1)}k`;
    return `S/ ${value.toFixed(0)}`;
  };

  const getTitulo = () => {
    switch (tipo) {
      case 'utilidad': return 'Utilidad por Producto (PEN)';
      case 'margen': return 'Margen por Producto (%)';
      case 'ventas': return 'Ventas por Producto (PEN)';
      default: return '';
    }
  };

  if (data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        <p>No hay datos de rentabilidad disponibles</p>
      </div>
    );
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            type="number"
            tickFormatter={formatValue}
            tick={{ fontSize: 11 }}
            axisLine={{ stroke: '#E5E7EB' }}
          />
          <YAxis
            type="category"
            dataKey="nombre"
            tick={{ fontSize: 10 }}
            width={95}
            axisLine={{ stroke: '#E5E7EB' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="valor"
            name={getTitulo()}
            radius={[0, 4, 4, 0]}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getBarColor(entry.margenPromedio)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
