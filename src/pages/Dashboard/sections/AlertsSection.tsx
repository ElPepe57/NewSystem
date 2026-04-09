import React from 'react';
import { AlertTriangle, CheckCircle, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Badge } from '../../../components/common';
import type { DashboardCuentasPendientes } from '../../../types/tesoreria.types';
import { formatCurrencyPEN } from '../../../utils/format';

interface StockCriticoItem {
  productoId: string;
  sku: string;
  nombre: string;
  disponibles: number;
  stockMinimo: number;
  almacenNombre?: string;
}

interface AlertsSectionProps {
  dashboardCxPCxC: DashboardCuentasPendientes | null;
  stockCriticoItems: StockCriticoItem[];
}

const fmt = (v: number) => formatCurrencyPEN(v);

export const AlertsSection: React.FC<AlertsSectionProps> = ({
  dashboardCxPCxC,
  stockCriticoItems
}) => {
  const cxcVencidos = dashboardCxPCxC?.cuentasPorCobrar.cantidadVencidos ?? 0;
  const cxcVencidoMonto = dashboardCxPCxC?.cuentasPorCobrar.pendienteMas30dias ?? 0;
  const hayAlertaCxC = cxcVencidos > 0;
  const hayStockCritico = stockCriticoItems.length > 0;
  const sinAlertas = !hayStockCritico && !hayAlertaCxC;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        Alertas Criticas
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Stock Critico */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Stock Bajo Minimo
            </h3>
            {hayStockCritico && (
              <Link to="/inventario" className="text-sm text-primary-600 hover:text-primary-700">
                Ver inventario
              </Link>
            )}
          </div>

          {!hayStockCritico ? (
            <div className="flex items-center gap-3 py-6 px-2">
              <CheckCircle className="h-8 w-8 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700">Todo en orden</p>
                <p className="text-xs text-gray-500">Ningun producto bajo el stock minimo</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {stockCriticoItems.slice(0, 5).map(item => (
                <div
                  key={item.productoId}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">{item.nombre}</div>
                    <div className="text-xs text-gray-500">
                      {item.sku}{item.almacenNombre ? ` · ${item.almacenNombre}` : ''}
                    </div>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <Badge variant="danger">{item.disponibles} uds</Badge>
                    <div className="text-xs text-gray-500 mt-1">Min: {item.stockMinimo}</div>
                  </div>
                </div>
              ))}
              {stockCriticoItems.length > 5 && (
                <Link
                  to="/inventario"
                  className="block text-center text-xs text-primary-600 hover:text-primary-700 pt-1"
                >
                  +{stockCriticoItems.length - 5} productos mas
                </Link>
              )}
            </div>
          )}
        </Card>

        {/* CxC Vencida +30 dias */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-orange-500" />
              CxC Vencida +30 Dias
            </h3>
            {hayAlertaCxC && (
              <Link to="/tesoreria" className="text-sm text-primary-600 hover:text-primary-700">
                Ver tesoreria
              </Link>
            )}
          </div>

          {!dashboardCxPCxC ? (
            <div className="flex items-center gap-3 py-6 px-2">
              <div className="h-8 w-8 rounded-full bg-gray-100 flex-shrink-0 animate-pulse" />
              <p className="text-sm text-gray-400">Cargando datos...</p>
            </div>
          ) : !hayAlertaCxC ? (
            <div className="flex items-center gap-3 py-6 px-2">
              <CheckCircle className="h-8 w-8 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700">Sin vencidos</p>
                <p className="text-xs text-gray-500">No hay CxC con mas de 30 dias pendientes</p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-700">
                    {cxcVencidos} {cxcVencidos === 1 ? 'documento vencido' : 'documentos vencidos'}
                  </p>
                  <p className="text-xl font-bold text-red-900 mt-1">{fmt(cxcVencidoMonto)}</p>
                  <p className="text-xs text-red-600 mt-1">Pendiente de cobro con mas de 30 dias</p>
                  <Link
                    to="/tesoreria"
                    className="inline-block mt-3 text-xs font-medium text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Gestionar cobranza
                  </Link>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
