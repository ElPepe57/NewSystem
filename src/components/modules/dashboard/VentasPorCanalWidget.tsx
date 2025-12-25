import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Store, ShoppingBag, MoreHorizontal } from 'lucide-react';
import { Card } from '../../common';

interface CanalStats {
  cantidad: number;
  totalPEN: number;
  porcentaje: number;
}

interface VentasPorCanalData {
  mercadoLibre: CanalStats;
  directo: CanalStats;
  otro: CanalStats;
}

interface VentasPorCanalWidgetProps {
  data: VentasPorCanalData;
}

const COLORS = {
  mercadoLibre: '#FFE600', // Amarillo ML
  directo: '#10B981',      // Verde success
  otro: '#6B7280'          // Gris
};

export const VentasPorCanalWidget: React.FC<VentasPorCanalWidgetProps> = ({ data }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const chartData = [
    {
      name: 'Mercado Libre',
      value: data.mercadoLibre.totalPEN,
      cantidad: data.mercadoLibre.cantidad,
      porcentaje: data.mercadoLibre.porcentaje,
      color: COLORS.mercadoLibre
    },
    {
      name: 'Venta Directa',
      value: data.directo.totalPEN,
      cantidad: data.directo.cantidad,
      porcentaje: data.directo.porcentaje,
      color: COLORS.directo
    },
    {
      name: 'Otros',
      value: data.otro.totalPEN,
      cantidad: data.otro.cantidad,
      porcentaje: data.otro.porcentaje,
      color: COLORS.otro
    }
  ].filter(item => item.value > 0);

  const totalVentas = data.mercadoLibre.totalPEN + data.directo.totalPEN + data.otro.totalPEN;
  const totalCantidad = data.mercadoLibre.cantidad + data.directo.cantidad + data.otro.cantidad;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white p-3 shadow-lg rounded-lg border border-gray-200">
          <p className="font-semibold text-gray-900">{item.name}</p>
          <p className="text-sm text-gray-600">{formatCurrency(item.value)}</p>
          <p className="text-xs text-gray-500">{item.cantidad} ventas ({item.porcentaje.toFixed(1)}%)</p>
        </div>
      );
    }
    return null;
  };

  const getIcon = (name: string) => {
    switch (name) {
      case 'Mercado Libre':
        return <Store className="h-4 w-4" />;
      case 'Venta Directa':
        return <ShoppingBag className="h-4 w-4" />;
      default:
        return <MoreHorizontal className="h-4 w-4" />;
    }
  };

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Store className="h-5 w-5 mr-2 text-primary-500" />
          Ventas por Canal
        </h3>
        <div className="text-right">
          <div className="text-sm font-semibold text-gray-900">{formatCurrency(totalVentas)}</div>
          <div className="text-xs text-gray-500">{totalCantidad} ventas</div>
        </div>
      </div>

      {totalVentas === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Store className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Sin datos de ventas</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row items-center gap-4">
          {/* Gráfico circular */}
          <div className="w-full lg:w-1/2 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Leyenda personalizada */}
          <div className="w-full lg:w-1/2 space-y-3">
            {chartData.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between p-2 rounded-lg bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex items-center gap-1 text-sm text-gray-700">
                    {getIcon(item.name)}
                    <span>{item.name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">
                    {item.porcentaje.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    {item.cantidad} ventas
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
