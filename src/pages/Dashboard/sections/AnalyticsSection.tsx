import React from 'react';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../../components/common';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { formatCurrencyPEN, formatCurrencyCompact } from '../../../utils/format';

interface AnalyticsSectionProps {
  ventasUltimos30Dias: { fecha: string; fechaCompleta: Date; ventas: number; cantidad: number }[];
  topProductosVendidos: any[];
  tipoCambioDelDia?: { compra?: number; venta?: number } | null;
}

const fmt = (v: number) => formatCurrencyPEN(v);
const fmtC = (v: number) => formatCurrencyCompact(v, 'PEN');

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3">
      <p className="text-xs font-semibold text-gray-600 mb-1">{label}</p>
      <p className="text-base font-bold text-gray-900">{fmt(payload[0]?.value ?? 0)}</p>
      {payload[0]?.payload?.cantidad > 0 && (
        <p className="text-xs text-gray-400 mt-0.5">
          {payload[0].payload.cantidad} {payload[0].payload.cantidad === 1 ? 'venta' : 'ventas'}
        </p>
      )}
    </div>
  );
};

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({
  ventasUltimos30Dias,
  topProductosVendidos,
  tipoCambioDelDia,
}) => {
  const totalVentas30d = ventasUltimos30Dias.reduce((sum, d) => sum + d.ventas, 0);
  const hayVentas = ventasUltimos30Dias.some(d => d.ventas > 0);
  const top3 = topProductosVendidos.slice(0, 3);

  const tcCompra = tipoCambioDelDia?.compra?.toFixed(3);
  const tcVenta = tipoCambioDelDia?.venta?.toFixed(3);

  return (
    <div className="hidden sm:block">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">

        {/* Area chart — 2 columnas */}
        <div className="lg:col-span-2">
          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Ventas ultimos 30 dias
              </h3>
              <span className="text-sm font-medium text-gray-500">
                Total: <span className="text-gray-900">{fmtC(totalVentas30d)}</span>
              </span>
            </div>

            {hayVentas ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ventasUltimos30Dias} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis
                      dataKey="fecha"
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={fmtC}
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      tickLine={false}
                      axisLine={false}
                      width={60}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="ventas"
                      stroke="#3B82F6"
                      strokeWidth={2.5}
                      fill="url(#colorVentas)"
                      dot={false}
                      activeDot={{ r: 5, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-52 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <TrendingUp className="h-10 w-10 mx-auto mb-2 text-gray-200" />
                  <p className="text-sm">Sin ventas en los ultimos 30 dias</p>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Columna lateral compacta */}
        <div className="lg:col-span-1 flex flex-col gap-4">

          {/* TC del dia */}
          {tcCompra && (
            <Card padding="md">
              <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                Tipo de Cambio
              </div>
              <div className="text-xl font-bold text-gray-900">
                S/ {tcCompra}
                {tcVenta && (
                  <span className="text-base font-medium text-gray-400"> / {tcVenta}</span>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-1">Compra / Venta (hoy)</div>
            </Card>
          )}

          {/* Top 3 productos */}
          <Card padding="md" className="flex-1">
            <div className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">
              Top 3 Productos
            </div>
            {top3.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">Sin datos disponibles</p>
            ) : (
              <div className="space-y-2.5">
                {top3.map((prod, idx) => (
                  <div key={prod.productoId} className="flex items-center gap-2.5">
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-blue-100 text-blue-700' :
                      idx === 1 ? 'bg-gray-100 text-gray-600' :
                      'bg-orange-50 text-orange-600'
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate leading-tight">
                        {prod.nombreComercial || prod.sku}
                      </div>
                      <div className="text-xs text-gray-400">{fmtC(prod.ventasTotalPEN)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-3 border-t">
              <Link
                to="/reportes"
                className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                Ver reportes completos
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
