import React from 'react';
import { ShoppingCart, TrendingUp, Target, ArrowRightLeft, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrencyPEN, formatCurrencyCompact } from '../../../utils/format';

interface HeroKPIProps {
  totalVentasMes: number;
  utilidadMes: number;
  margenPromedioMes: number;
  ventasMesCount: number;
  tipoCambioDelDia: any;
}

const fmt = (v: number) => formatCurrencyPEN(v);
const fmtShort = (v: number) => formatCurrencyCompact(v, 'PEN');

export const HeroKPISection: React.FC<HeroKPIProps> = ({
  totalVentasMes,
  utilidadMes,
  margenPromedioMes,
  ventasMesCount,
  tipoCambioDelDia
}) => {
  const margenBueno = margenPromedioMes >= 25;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      {/* Ventas del Mes */}
      <Link to="/ventas">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 lg:p-5 border border-emerald-100 hover:shadow-md transition-shadow cursor-pointer h-full">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs lg:text-sm font-medium text-emerald-700 truncate">Ventas del Mes</p>
              <p className="text-2xl lg:text-4xl font-bold text-emerald-900 mt-1 leading-tight">
                <span className="hidden sm:inline">{fmt(totalVentasMes)}</span>
                <span className="sm:hidden">{fmtShort(totalVentasMes)}</span>
              </p>
              <div className="flex items-center gap-1 mt-2">
                {margenBueno
                  ? <ArrowUpRight className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                  : <ArrowDownRight className="h-3 w-3 text-red-500 flex-shrink-0" />
                }
                <span className={`text-xs font-medium ${margenBueno ? 'text-emerald-600' : 'text-red-500'}`}>
                  {margenPromedioMes.toFixed(1)}% margen
                </span>
              </div>
            </div>
            <ShoppingCart className="h-10 w-10 lg:h-12 lg:w-12 text-emerald-300 flex-shrink-0 opacity-60" />
          </div>
        </div>
      </Link>

      {/* Utilidad del Mes */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 lg:p-5 border border-blue-100 h-full">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs lg:text-sm font-medium text-blue-700 truncate">Utilidad del Mes</p>
            <p className="text-2xl lg:text-4xl font-bold text-blue-900 mt-1 leading-tight">
              <span className="hidden sm:inline">{fmt(utilidadMes)}</span>
              <span className="sm:hidden">{fmtShort(utilidadMes)}</span>
            </p>
            <p className="text-xs text-blue-600 mt-2">
              {ventasMesCount} {ventasMesCount === 1 ? 'venta' : 'ventas'} este mes
            </p>
          </div>
          <TrendingUp className="h-10 w-10 lg:h-12 lg:w-12 text-blue-300 flex-shrink-0 opacity-60" />
        </div>
      </div>

      {/* Margen Promedio */}
      <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-4 lg:p-5 border border-purple-100 h-full">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs lg:text-sm font-medium text-purple-700 truncate">Margen Promedio</p>
            <p className={`text-2xl lg:text-4xl font-bold mt-1 leading-tight ${
              margenPromedioMes >= 30 ? 'text-purple-700' :
              margenPromedioMes >= 20 ? 'text-purple-600' : 'text-red-600'
            }`}>
              {margenPromedioMes.toFixed(1)}%
            </p>
            <p className="text-xs text-purple-600 mt-2">
              {margenPromedioMes >= 30 ? 'Excelente' : margenPromedioMes >= 20 ? 'Aceptable' : 'Bajo objetivo'}
            </p>
          </div>
          <Target className="h-10 w-10 lg:h-12 lg:w-12 text-purple-300 flex-shrink-0 opacity-60" />
        </div>
      </div>

      {/* Tipo de Cambio */}
      <Link to="/tipo-cambio">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 lg:p-5 border border-amber-100 hover:shadow-md transition-shadow cursor-pointer h-full">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs lg:text-sm font-medium text-amber-700 truncate">Tipo de Cambio</p>
              <p className="text-2xl lg:text-4xl font-bold text-amber-900 mt-1 leading-tight">
                {tipoCambioDelDia?.compra?.toFixed(3) ?? '-'}
              </p>
              <p className="text-xs text-amber-600 mt-2">
                Venta: {tipoCambioDelDia?.venta?.toFixed(3) ?? '-'}
              </p>
            </div>
            <ArrowRightLeft className="h-10 w-10 lg:h-12 lg:w-12 text-amber-300 flex-shrink-0 opacity-60" />
          </div>
        </div>
      </Link>
    </div>
  );
};
