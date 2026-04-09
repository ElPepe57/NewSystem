import React from 'react';
import {
  Banknote, CreditCard, ArrowRightLeft, AlertTriangle,
  TrendingUp, Truck, Receipt, Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Badge } from '../../../components/common';
import type { DashboardCuentasPendientes } from '../../../types/tesoreria.types';
import { formatCurrencyPEN } from '../../../utils/format';

interface FinancialSectionProps {
  dashboardCxPCxC: DashboardCuentasPendientes;
}

const fmt = (v: number) => formatCurrencyPEN(v);

export const FinancialSection: React.FC<FinancialSectionProps> = ({ dashboardCxPCxC }) => {
  const flujoNeto = dashboardCxPCxC.balanceNeto.flujoNetoPEN;
  const flujoPositivo = flujoNeto >= 0;

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* KPIs CxC/CxP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* Por Cobrar */}
        <Link to="/tesoreria">
          <Card padding="md" className="hover:shadow-md transition-shadow cursor-pointer bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-green-500 h-full">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-gray-600 flex items-center gap-1 mb-1">
                  <span className="font-medium text-green-700">Por Cobrar (CxC)</span>
                </div>
                <div className="text-2xl font-bold text-green-700">
                  {fmt(dashboardCxPCxC.cuentasPorCobrar.totalEquivalentePEN)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {dashboardCxPCxC.cuentasPorCobrar.cantidadDocumentos} ventas pendientes
                </div>
              </div>
              <Banknote className="h-10 w-10 text-green-300 opacity-60 flex-shrink-0" />
            </div>
          </Card>
        </Link>

        {/* Por Pagar */}
        <Link to="/tesoreria">
          <Card padding="md" className="hover:shadow-md transition-shadow cursor-pointer bg-gradient-to-br from-red-50 to-rose-50 border-l-4 border-red-500 h-full">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-red-700 mb-1">Por Pagar (CxP)</div>
                <div className="text-2xl font-bold text-red-700">
                  {fmt(dashboardCxPCxC.cuentasPorPagar.totalEquivalentePEN)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {dashboardCxPCxC.cuentasPorPagar.cantidadDocumentos} documentos
                </div>
              </div>
              <CreditCard className="h-10 w-10 text-red-300 opacity-60 flex-shrink-0" />
            </div>
          </Card>
        </Link>

        {/* Flujo Neto */}
        <Card padding="md" className={`h-full bg-gradient-to-br border-l-4 ${
          flujoPositivo
            ? 'from-blue-50 to-indigo-50 border-blue-500'
            : 'from-orange-50 to-amber-50 border-orange-500'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <div className={`text-sm font-medium mb-1 ${flujoPositivo ? 'text-blue-700' : 'text-orange-700'}`}>
                Flujo Neto
              </div>
              <div className={`text-2xl font-bold ${flujoPositivo ? 'text-blue-700' : 'text-orange-700'}`}>
                {flujoPositivo ? '+' : ''}{fmt(flujoNeto)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {flujoPositivo ? 'Saldo a favor' : 'Saldo en contra'}
              </div>
            </div>
            {flujoPositivo
              ? <TrendingUp className="h-10 w-10 text-blue-300 opacity-60 flex-shrink-0" />
              : <AlertTriangle className="h-10 w-10 text-orange-300 opacity-60 flex-shrink-0" />
            }
          </div>
        </Card>

        {/* Cartera Vencida */}
        <Link to="/tesoreria">
          <Card padding="md" className="hover:shadow-md transition-shadow cursor-pointer bg-gradient-to-br from-amber-50 to-yellow-50 border-l-4 border-amber-500 h-full">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-amber-700 mb-1">Cartera Vencida</div>
                <div className="text-2xl font-bold text-amber-700">
                  {dashboardCxPCxC.cuentasPorCobrar.cantidadVencidos + dashboardCxPCxC.cuentasPorPagar.cantidadVencidos}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {fmt(dashboardCxPCxC.cuentasPorCobrar.pendienteMas30dias + dashboardCxPCxC.cuentasPorPagar.pendienteMas30dias)} +30d
                </div>
              </div>
              <AlertTriangle className="h-10 w-10 text-amber-300 opacity-60 flex-shrink-0" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Detalle antigüedad y distribución CxP */}
      <div className="hidden sm:grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Antigüedad CxC */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base lg:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Banknote className="h-5 w-5 text-green-500" />
              Antigüedad CxC
            </h3>
            <Link to="/tesoreria" className="text-sm text-primary-600 hover:text-primary-700">
              Ver detalle
            </Link>
          </div>
          <div className="space-y-2">
            {[
              { label: '0-7 días', value: dashboardCxPCxC.cuentasPorCobrar.pendiente0a7dias, color: 'green', dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
              { label: '8-15 días', value: dashboardCxPCxC.cuentasPorCobrar.pendiente8a15dias, color: 'blue', dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
              { label: '16-30 días', value: dashboardCxPCxC.cuentasPorCobrar.pendiente16a30dias, color: 'yellow', dot: 'bg-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700' },
              { label: '+30 días (vencido)', value: dashboardCxPCxC.cuentasPorCobrar.pendienteMas30dias, color: 'red', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' }
            ].map(row => (
              <div key={row.label} className={`flex items-center justify-between p-3 ${row.bg} rounded-lg`}>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${row.dot}`} />
                  <span className="text-sm text-gray-700">{row.label}</span>
                </div>
                <span className={`font-semibold ${row.text}`}>{fmt(row.value)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Distribución CxP por tipo */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base lg:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-red-500" />
              Distribución CxP
            </h3>
            <Link to="/tesoreria" className="text-sm text-primary-600 hover:text-primary-700">
              Ver detalle
            </Link>
          </div>
          <div className="space-y-2">
            {dashboardCxPCxC.cuentasPorPagar.porTipo.map(tipo => (
              <div key={tipo.tipo} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  {tipo.tipo === 'orden_compra_por_pagar' && <Truck className="h-4 w-4 text-blue-500" />}
                  {tipo.tipo === 'gasto_por_pagar' && <Receipt className="h-4 w-4 text-purple-500" />}
                  {tipo.tipo === 'viajero_por_pagar' && <Users className="h-4 w-4 text-orange-500" />}
                  <span className="text-sm text-gray-700">{tipo.etiqueta}</span>
                  <Badge variant="default" size="sm">{tipo.cantidad}</Badge>
                </div>
                <div className="text-right">
                  {tipo.montoPEN > 0 && (
                    <span className="font-semibold text-gray-700 block text-sm">
                      S/ {tipo.montoPEN.toLocaleString()}
                    </span>
                  )}
                  {tipo.montoUSD > 0 && (
                    <span className="text-xs text-gray-500">
                      $ {tipo.montoUSD.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {dashboardCxPCxC.cuentasPorPagar.porTipo.length === 0 && (
              <div className="text-center py-6 text-gray-500">
                <ArrowRightLeft className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No hay cuentas por pagar</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
