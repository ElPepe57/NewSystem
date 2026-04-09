import React from 'react';
import { TrendingUp, Calendar } from 'lucide-react';
import { Card } from '../../../components/common';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { TopProductosWidget } from '../../../components/modules/dashboard/TopProductosWidget';
import { formatCurrencyPEN, formatCurrencyCompact } from '../../../utils/format';

interface AnalyticsSectionProps {
  ventasUltimos30Dias: { fecha: string; fechaCompleta: Date; ventas: number; cantidad: number }[];
  topProductosVendidos: any[];
}

const fmt = (v: number) => formatCurrencyPEN(v);
const fmtShort = (v: number) => formatCurrencyCompact(v, 'PEN');

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({
  ventasUltimos30Dias,
  topProductosVendidos
}) => {
  const totalVentas30d = ventasUltimos30Dias.reduce((sum, d) => sum + d.ventas, 0);
  const totalOps30d = ventasUltimos30Dias.reduce((sum, d) => sum + d.cantidad, 0);
  const hayVentas = ventasUltimos30Dias.some(d => d.ventas > 0);

  return (
    <div className="hidden sm:block">
      <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-blue-500" />
        Tendencia y Productos
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* LineChart ventas 30 dias — ocupa 2 columnas */}
        <div className="lg:col-span-2">
          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary-500" />
                Ventas Ultimos 30 Dias
              </h3>
            </div>

            {hayVentas ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ventasUltimos30Dias}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="fecha"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={fmtShort}
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) => [fmt(value), 'Ventas']}
                      labelStyle={{ fontWeight: 'bold' }}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="ventas"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6, fill: '#3B82F6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-56 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <TrendingUp className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No hay ventas en los ultimos 30 dias</p>
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-gray-500">Total 30 dias</div>
                <div className="font-semibold text-gray-900 text-sm">{fmt(totalVentas30d)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Promedio/dia</div>
                <div className="font-semibold text-gray-900 text-sm">{fmt(totalVentas30d / 30)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total Ops.</div>
                <div className="font-semibold text-gray-900 text-sm">{totalOps30d}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Top 5 productos — ocupa 1 columna */}
        <div className="lg:col-span-1">
          <TopProductosWidget
            productos={topProductosVendidos}
            maxItems={5}
            titulo="Top 5 Productos"
          />
        </div>
      </div>
    </div>
  );
};
