import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../../components/common';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { formatCurrencyCompact } from '../../../utils/format';

interface RentabilidadLinea {
  ventas: number;
  utilidad: number;
  margen: number;
  cantidad: number;
}

interface DeepAnalyticsSectionProps {
  topProductosVendidos: {
    productoId: string;
    sku: string;
    marca: string;
    nombreComercial: string;
    unidadesVendidas: number;
    ventasTotalPEN: number;
    utilidadPEN: number;
    margenPromedio: number;
  }[];
  rentabilidadSUP: RentabilidadLinea;
  rentabilidadSKC: RentabilidadLinea;
  lineaFiltroGlobal: string | null;
}

const fmtC = (v: number) => formatCurrencyCompact(v, 'PEN');

const BarTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-800 mb-1">{d?.nombre}</p>
      <p className="text-slate-600">Ventas: <span className="font-bold text-slate-900">{fmtC(d?.ventasTotalPEN ?? 0)}</span></p>
      <p className="text-slate-600">Margen: <span className="font-bold text-slate-900">{(d?.margenPromedio ?? 0).toFixed(1)}%</span></p>
    </div>
  );
};

const LineaCard: React.FC<{
  nombre: string;
  color: string;
  bgColor: string;
  borderColor: string;
  data: RentabilidadLinea;
}> = ({ nombre, color, bgColor, borderColor, data }) => (
  <div className={`${bgColor} ${borderColor} border rounded-xl p-4`}>
    <div className="flex items-center gap-2 mb-3">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-sm font-bold text-slate-800">{nombre}</span>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="text-xs text-slate-500 mb-0.5">Ventas</div>
        <div className="text-base font-bold text-slate-900">{fmtC(data.ventas)}</div>
      </div>
      <div>
        <div className="text-xs text-slate-500 mb-0.5">Utilidad</div>
        <div className="text-base font-bold text-slate-900">{fmtC(data.utilidad)}</div>
      </div>
      <div>
        <div className="text-xs text-slate-500 mb-0.5">Margen</div>
        <div className={`text-base font-bold ${data.margen >= 25 ? 'text-emerald-600' : data.margen >= 15 ? 'text-amber-600' : 'text-rose-600'}`}>
          {data.margen.toFixed(1)}%
        </div>
      </div>
      <div>
        <div className="text-xs text-slate-500 mb-0.5">Ventas</div>
        <div className="text-base font-bold text-slate-900">{data.cantidad}</div>
      </div>
    </div>
  </div>
);

export const DeepAnalyticsSection: React.FC<DeepAnalyticsSectionProps> = ({
  topProductosVendidos,
  rentabilidadSUP,
  rentabilidadSKC,
  lineaFiltroGlobal,
}) => {
  const top5 = topProductosVendidos.slice(0, 5);

  // Calcular concentracion (% del total)
  const totalVentas5 = top5.reduce((s, p) => s + p.ventasTotalPEN, 0);
  const totalGlobal = topProductosVendidos.reduce((s, p) => s + p.ventasTotalPEN, 0);

  const barData = top5.map(p => ({
    nombre: p.nombreComercial || p.sku,
    ventasTotalPEN: p.ventasTotalPEN,
    margenPromedio: p.margenPromedio,
    concentracion: totalGlobal > 0 ? (p.ventasTotalPEN / totalGlobal) * 100 : 0,
  }));

  const mostrarDualLinea = lineaFiltroGlobal === null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">

      {/* Top 5 productos — barras horizontales */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Top 5 Productos</h3>
          <Link
            to="/reportes"
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {top5.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-slate-400">
            <p className="text-sm">Sin ventas registradas</p>
          </div>
        ) : (
          <>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  layout="vertical"
                  margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={fmtC}
                    tick={{ fontSize: 9, fill: '#9CA3AF' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="nombre"
                    tick={{ fontSize: 9, fill: '#6B7280' }}
                    tickLine={false}
                    axisLine={false}
                    width={90}
                    tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + '…' : v}
                  />
                  <Tooltip content={<BarTooltip />} />
                  <Bar dataKey="ventasTotalPEN" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {barData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === 0 ? '#3b82f6' : index === 1 ? '#6366f1' : '#8b5cf6'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Concentracion */}
            {totalGlobal > 0 && (
              <div className="mt-3 pt-3 border-t text-xs text-slate-500">
                Top 5 representa <span className="font-semibold text-slate-700">
                  {((totalVentas5 / totalGlobal) * 100).toFixed(0)}%
                </span> del total de ventas
              </div>
            )}
          </>
        )}
      </Card>

      {/* Rentabilidad por linea */}
      <Card padding="md">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            {mostrarDualLinea ? 'Rentabilidad por Linea' : 'Rentabilidad del Mes'}
          </h3>
        </div>

        {mostrarDualLinea ? (
          <div className="space-y-3">
            <LineaCard
              nombre="Suplementos (SUP)"
              color="bg-violet-500"
              bgColor="bg-violet-50"
              borderColor="border-violet-200"
              data={rentabilidadSUP}
            />
            <LineaCard
              nombre="Skincare (SKC)"
              color="bg-pink-500"
              bgColor="bg-pink-50"
              borderColor="border-pink-200"
              data={rentabilidadSKC}
            />
          </div>
        ) : (
          // Cuando hay filtro activo, mostrar la linea filtrada
          <LineaCard
            nombre={lineaFiltroGlobal?.includes('SKC') || lineaFiltroGlobal?.includes('SKIN') ? 'Skincare (SKC)' : 'Suplementos (SUP)'}
            color={lineaFiltroGlobal?.includes('SKC') || lineaFiltroGlobal?.includes('SKIN') ? 'bg-pink-500' : 'bg-violet-500'}
            bgColor={lineaFiltroGlobal?.includes('SKC') || lineaFiltroGlobal?.includes('SKIN') ? 'bg-pink-50' : 'bg-violet-50'}
            borderColor={lineaFiltroGlobal?.includes('SKC') || lineaFiltroGlobal?.includes('SKIN') ? 'border-pink-200' : 'border-violet-200'}
            data={lineaFiltroGlobal?.includes('SKC') || lineaFiltroGlobal?.includes('SKIN') ? rentabilidadSKC : rentabilidadSUP}
          />
        )}

        <div className="mt-4 pt-3 border-t">
          <Link
            to="/reportes"
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Ver reportes completos
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </Card>
    </div>
  );
};
