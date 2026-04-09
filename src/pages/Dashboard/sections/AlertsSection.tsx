import React from 'react';
import { AlertTriangle, CreditCard, Package, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrencyCompact } from '../../../utils/format';
import type { DashboardCuentasPendientes } from '../../../types/tesoreria.types';

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

const fmtC = (v: number) => formatCurrencyCompact(v, 'PEN');

export const AlertsSection: React.FC<AlertsSectionProps> = ({
  dashboardCxPCxC,
  stockCriticoItems,
}) => {
  const cxcVencidos = dashboardCxPCxC?.cuentasPorCobrar.cantidadVencidos ?? 0;
  const cxcMonto = dashboardCxPCxC?.cuentasPorCobrar.pendienteMas30dias ?? 0;
  const hayStockCritico = stockCriticoItems.length > 0;
  const hayAlertaCxC = cxcVencidos > 0;

  // Si no hay alertas, no renderizar nada
  if (!hayStockCritico && !hayAlertaCxC) return null;

  return (
    <div className="space-y-3">
      {/* Alerta stock critico */}
      {hayStockCritico && (
        <div className="border-l-4 border-rose-500 bg-rose-50 rounded-r-xl px-5 py-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <AlertTriangle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-rose-800">
                {stockCriticoItems.length} {stockCriticoItems.length === 1 ? 'producto' : 'productos'} bajo stock minimo
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {stockCriticoItems.slice(0, 3).map(item => (
                  <span
                    key={item.productoId}
                    className="inline-flex items-center gap-1 text-xs bg-rose-100 text-rose-700 rounded-full px-2.5 py-0.5"
                  >
                    <Package className="h-3 w-3" />
                    {item.nombre} ({item.disponibles} uds)
                  </span>
                ))}
                {stockCriticoItems.length > 3 && (
                  <span className="text-xs text-rose-500 self-center">
                    +{stockCriticoItems.length - 3} mas
                  </span>
                )}
              </div>
            </div>
          </div>
          <Link
            to="/inventario"
            className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors whitespace-nowrap"
          >
            Ver inventario <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Alerta CxC vencida */}
      {hayAlertaCxC && (
        <div className="border-l-4 border-amber-500 bg-amber-50 rounded-r-xl px-5 py-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <CreditCard className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {fmtC(cxcMonto)} en cobros vencidos +30 dias
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                {cxcVencidos} {cxcVencidos === 1 ? 'documento pendiente' : 'documentos pendientes'} de cobro
              </p>
            </div>
          </div>
          <Link
            to="/tesoreria"
            className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors whitespace-nowrap"
          >
            Gestionar <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
};
