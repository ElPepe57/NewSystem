import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import type { ProductoRentabilidad } from '../../../types/reporte.types';

interface RentabilidadBarChartProps {
  productos: ProductoRentabilidad[];
  maxItems?: number;
  tipo?: 'utilidad' | 'margen' | 'ventas';
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white px-2.5 py-2 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900 text-xs mb-1.5">{data.nombreCompleto}</p>
        <div className="space-y-0.5 text-[11px]">
          <div className="flex justify-between gap-3">
            <span className="text-gray-600">Ventas:</span>
            <span className="font-medium">S/ {data.ventasTotalPEN.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-600">Utilidad:</span>
            <span className="font-medium text-green-600">S/ {data.utilidadPEN.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-600">Margen:</span>
            <span className="font-medium text-blue-600">{data.margenPromedio.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-600">Uds:</span>
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
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Preparar datos para el gráfico
  const data = productos
    .slice(0, maxItems)
    .map(p => ({
      ...p,
      nombre: isMobile
        ? `${p.marca.substring(0, 5)}-${p.nombreComercial.substring(0, 7)}`
        : `${p.marca.substring(0, 8)} - ${p.nombreComercial.substring(0, 12)}`,
      nombreCompleto: `${p.marca} ${p.nombreComercial}`,
      valor: tipo === 'utilidad' ? p.utilidadPEN :
             tipo === 'margen' ? p.margenPromedio :
             p.ventasTotalPEN
    }));

  const getBarColor = (margen: number) => {
    if (margen >= 40) return '#10B981';
    if (margen >= 25) return '#3B82F6';
    if (margen >= 15) return '#F59E0B';
    return '#EF4444';
  };

  const formatValue = (value: number) => {
    if (tipo === 'margen') return `${value.toFixed(0)}%`;
    if (value >= 1000) return `S/${(value / 1000).toFixed(0)}k`;
    return `S/${value.toFixed(0)}`;
  };

  if (data.length === 0) {
    return (
      <div className="h-64 sm:h-80 flex items-center justify-center text-gray-500 text-sm">
        No hay datos de rentabilidad disponibles
      </div>
    );
  }

  return (
    <div className="h-64 sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={isMobile
            ? { top: 5, right: 10, left: 0, bottom: 5 }
            : { top: 5, right: 30, left: 100, bottom: 5 }
          }
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            type="number"
            tickFormatter={formatValue}
            tick={{ fontSize: isMobile ? 9 : 11 }}
            axisLine={{ stroke: '#E5E7EB' }}
          />
          <YAxis
            type="category"
            dataKey="nombre"
            tick={{ fontSize: isMobile ? 8 : 10 }}
            width={isMobile ? 65 : 95}
            axisLine={{ stroke: '#E5E7EB' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="valor"
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
