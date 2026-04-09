import React from 'react';
import { Box, Receipt, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EficienciaImportacionWidget } from '../../../components/modules/dashboard/EficienciaImportacionWidget';
import { formatCurrencyPEN, formatCurrencyCompact } from '../../../utils/format';

interface OperationalSectionProps {
  ordenesEnProceso: any[];
  ordenesStats: any;
  gastosStats: any;
  anticiposPendientes: { cantidad: number; monto: number };
}

const fmt = (v: number) => formatCurrencyPEN(v);
const fmtShort = (v: number) => formatCurrencyCompact(v, 'PEN');

export const OperationalSection: React.FC<OperationalSectionProps> = ({
  ordenesEnProceso,
  ordenesStats,
  gastosStats,
  anticiposPendientes
}) => {
  return (
    <div className="space-y-4 lg:space-y-6">
      {/* KPIs operacionales */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        {/* Ordenes en proceso */}
        <Link to="/compras">
          <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl p-4 lg:p-5 border border-sky-100 hover:shadow-md transition-shadow h-full">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs lg:text-sm font-medium text-sky-700 truncate">Ordenes en Proceso</p>
                <p className="text-2xl lg:text-4xl font-bold text-sky-900 mt-1 leading-tight">
                  {ordenesEnProceso.length}
                </p>
                <p className="text-xs text-sky-600 mt-2">
                  {ordenesStats?.enTransito || 0} en transito
                </p>
              </div>
              <Box className="h-10 w-10 lg:h-12 lg:w-12 text-sky-300 flex-shrink-0 opacity-60" />
            </div>
          </div>
        </Link>

        {/* Gastos del mes */}
        <Link to="/gastos">
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-4 lg:p-5 border border-gray-200 hover:shadow-md transition-shadow h-full">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">Gastos del Mes</p>
                <p className="text-xl lg:text-3xl font-bold text-gray-900 mt-1 leading-tight">
                  <span className="hidden sm:inline">{fmt(gastosStats?.totalMesActual || 0)}</span>
                  <span className="sm:hidden">{fmtShort(gastosStats?.totalMesActual || 0)}</span>
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {gastosStats?.cantidadGastosMesActual || 0} gastos registrados
                </p>
              </div>
              <Receipt className="h-10 w-10 lg:h-12 lg:w-12 text-gray-300 flex-shrink-0 opacity-60" />
            </div>
          </div>
        </Link>

        {/* Anticipos pendientes */}
        {anticiposPendientes.monto > 0 ? (
          <Link to="/tesoreria">
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-4 lg:p-5 border border-purple-200 border-l-4 border-l-purple-500 hover:shadow-md transition-shadow h-full">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs lg:text-sm font-medium text-purple-700 truncate">Anticipos (Pasivo)</p>
                  <p className="text-xl lg:text-3xl font-bold text-purple-900 mt-1 leading-tight">
                    <span className="hidden sm:inline">{fmt(anticiposPendientes.monto)}</span>
                    <span className="sm:hidden">{fmtShort(anticiposPendientes.monto)}</span>
                  </p>
                  <p className="text-xs text-purple-600 mt-2">
                    {anticiposPendientes.cantidad} {anticiposPendientes.cantidad === 1 ? 'venta' : 'ventas'} con adelanto
                  </p>
                </div>
                <CreditCard className="h-10 w-10 lg:h-12 lg:w-12 text-purple-300 flex-shrink-0 opacity-60" />
              </div>
            </div>
          </Link>
        ) : (
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-4 lg:p-5 border border-purple-100 h-full">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs lg:text-sm font-medium text-purple-700 truncate">Anticipos (Pasivo)</p>
                <p className="text-2xl lg:text-4xl font-bold text-purple-900 mt-1 leading-tight">0</p>
                <p className="text-xs text-purple-600 mt-2">Sin anticipos pendientes</p>
              </div>
              <CreditCard className="h-10 w-10 lg:h-12 lg:w-12 text-purple-300 flex-shrink-0 opacity-60" />
            </div>
          </div>
        )}

      </div>

      {/* Eficiencia de importacion */}
      <div className="hidden sm:grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <EficienciaImportacionWidget />
      </div>
    </div>
  );
};
