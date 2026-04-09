import React from 'react';
import { ShoppingCart, TrendingUp, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrencyPEN, formatCurrencyCompact } from '../../../utils/format';
import type { DashboardCuentasPendientes } from '../../../types/tesoreria.types';

interface HeroKPIProps {
  totalVentasMes: number;
  utilidadMes: number;
  margenPromedio: number;
  cantidadVentas: number;
  dashboardCxPCxC: DashboardCuentasPendientes | null;
  stockCritico: number;
}

const fmt = (v: number) => formatCurrencyPEN(v);
const fmtShort = (v: number) => formatCurrencyCompact(v, 'PEN');

export const HeroKPISection: React.FC<HeroKPIProps> = ({
  totalVentasMes,
  utilidadMes,
  margenPromedio,
  cantidadVentas,
  dashboardCxPCxC,
  stockCritico
}) => {
  const cxc = dashboardCxPCxC?.cuentasPorCobrar.totalEquivalentePEN ?? 0;
  const cxp = dashboardCxPCxC?.cuentasPorPagar.totalEquivalentePEN ?? 0;
  const flujoNeto = cxc - cxp;
  const flujoPositivo = flujoNeto >= 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      {/* Ventas del Mes */}
      <Link to="/ventas">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 lg:p-5 border border-emerald-100 hover:shadow-md transition-shadow cursor-pointer h-full relative overflow-hidden">
          <ShoppingCart className="absolute top-3 right-3 h-10 w-10 text-emerald-200 opacity-60" />
          <div className="min-w-0 pr-8">
            <p className="text-xs lg:text-sm font-medium text-emerald-700">Ventas del Mes</p>
            <p className="text-2xl lg:text-4xl font-bold text-emerald-900 mt-1 leading-tight">
              <span className="hidden sm:inline">{fmt(totalVentasMes)}</span>
              <span className="sm:hidden">{fmtShort(totalVentasMes)}</span>
            </p>
            <p className="text-xs lg:text-sm text-gray-500 mt-2">
              {cantidadVentas} {cantidadVentas === 1 ? 'venta' : 'ventas'} este mes
            </p>
          </div>
        </div>
      </Link>

      {/* Utilidad del Mes */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 lg:p-5 border border-blue-100 h-full relative overflow-hidden">
        <TrendingUp className="absolute top-3 right-3 h-10 w-10 text-blue-200 opacity-60" />
        <div className="min-w-0 pr-8">
          <p className="text-xs lg:text-sm font-medium text-blue-700">Utilidad del Mes</p>
          <p className="text-2xl lg:text-4xl font-bold text-blue-900 mt-1 leading-tight">
            <span className="hidden sm:inline">{fmt(utilidadMes)}</span>
            <span className="sm:hidden">{fmtShort(utilidadMes)}</span>
          </p>
          <p className="text-xs lg:text-sm text-gray-500 mt-2">
            Margen: {margenPromedio.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Flujo Neto CxC - CxP */}
      <Link to="/tesoreria">
        <div className={`rounded-xl p-4 lg:p-5 border hover:shadow-md transition-shadow cursor-pointer h-full relative overflow-hidden ${
          flujoPositivo
            ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100'
            : 'bg-gradient-to-br from-orange-50 to-red-50 border-orange-200'
        }`}>
          <ArrowRightLeft className={`absolute top-3 right-3 h-10 w-10 opacity-60 ${
            flujoPositivo ? 'text-green-200' : 'text-orange-200'
          }`} />
          <div className="min-w-0 pr-8">
            <p className={`text-xs lg:text-sm font-medium ${flujoPositivo ? 'text-green-700' : 'text-orange-700'}`}>
              Flujo Neto
            </p>
            <p className={`text-2xl lg:text-4xl font-bold mt-1 leading-tight ${
              flujoPositivo ? 'text-green-900' : 'text-orange-900'
            }`}>
              {dashboardCxPCxC
                ? <><span className="hidden sm:inline">{flujoPositivo ? '+' : ''}{fmt(flujoNeto)}</span><span className="sm:hidden">{flujoPositivo ? '+' : ''}{fmtShort(flujoNeto)}</span></>
                : <span className="text-gray-400 text-xl">Cargando...</span>
              }
            </p>
            <p className="text-xs lg:text-sm text-gray-500 mt-2">
              CxC: {fmtShort(cxc)} / CxP: {fmtShort(cxp)}
            </p>
          </div>
        </div>
      </Link>

      {/* Stock Critico */}
      <Link to="/inventario">
        <div className={`rounded-xl p-4 lg:p-5 border hover:shadow-md transition-shadow cursor-pointer h-full relative overflow-hidden ${
          stockCritico > 0
            ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200'
            : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100'
        }`}>
          <AlertTriangle className={`absolute top-3 right-3 h-10 w-10 opacity-60 ${
            stockCritico > 0 ? 'text-red-200' : 'text-green-200'
          }`} />
          <div className="min-w-0 pr-8">
            <p className={`text-xs lg:text-sm font-medium ${stockCritico > 0 ? 'text-red-700' : 'text-green-700'}`}>
              Stock Critico
            </p>
            <p className={`text-2xl lg:text-4xl font-bold mt-1 leading-tight ${
              stockCritico > 0 ? 'text-red-900' : 'text-green-900'
            }`}>
              {stockCritico}
            </p>
            <p className="text-xs lg:text-sm text-gray-500 mt-2">
              {stockCritico > 0 ? 'productos bajo minimo' : 'Todo en orden'}
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
};
