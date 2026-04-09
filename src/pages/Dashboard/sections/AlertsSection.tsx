import React from 'react';
import { AlertTriangle, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Badge } from '../../../components/common';
import { VencimientosWidget } from '../../../components/modules/dashboard/VencimientosWidget';
import { ActividadRecienteWidget } from '../../../components/modules/dashboard/ActividadRecienteWidget';
import type { DashboardCuentasPendientes } from '../../../types/tesoreria.types';
import type { ActividadItem } from '../../../components/modules/dashboard';
import { formatCurrencyPEN } from '../../../utils/format';

interface AlertsSectionProps {
  dashboardCxPCxC: DashboardCuentasPendientes | null;
  ventas: any[];
  actividadReciente: ActividadItem[];
}

const fmt = (v: number) => formatCurrencyPEN(v);

export const AlertsSection: React.FC<AlertsSectionProps> = ({
  dashboardCxPCxC,
  ventas,
  actividadReciente
}) => {
  const alertas = dashboardCxPCxC?.alertas ?? [];
  const alertasAlta = alertas.filter(a => a.prioridad === 'alta');
  const alertasMedia = alertas.filter(a => a.prioridad === 'media');
  const alertasTotal = alertas.length;

  const ultimasVentas = (ventas || [])
    .filter(v => v.estado !== 'cancelada')
    .slice(0, 5);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Alertas financieras */}
      {alertasTotal > 0 && (
        <Card padding="md" className="bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base lg:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Alertas Financieras
              <span className="text-sm font-normal text-amber-600">({alertasTotal})</span>
              {alertasAlta.length > 0 && (
                <Badge variant="danger" size="sm">{alertasAlta.length} alta prioridad</Badge>
              )}
            </h3>
            <Link to="/tesoreria" className="text-sm text-primary-600 hover:text-primary-700">
              Ver todas
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alertas.slice(0, 6).map((alerta, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  alerta.prioridad === 'alta' ? 'bg-red-50 border-red-200' :
                  alerta.prioridad === 'media' ? 'bg-amber-50 border-amber-200' :
                  'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    alerta.prioridad === 'alta' ? 'bg-red-500' :
                    alerta.prioridad === 'media' ? 'bg-amber-500' : 'bg-gray-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{alerta.mensaje}</p>
                    <Badge
                      variant={alerta.tipo === 'vencido' ? 'danger' : alerta.tipo === 'monto_alto' ? 'warning' : 'info'}
                      size="sm"
                    >
                      {alerta.tipo === 'vencido' ? 'Vencido' : 'Monto Alto'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Últimas ventas + Vencimientos + Actividad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Últimas ventas */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base lg:text-lg font-semibold text-gray-900">Ultimas Ventas</h3>
            <Link to="/ventas" className="text-sm text-primary-600 hover:text-primary-700">
              Ver todo
            </Link>
          </div>

          {ultimasVentas.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No hay ventas registradas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ultimasVentas.map(venta => (
                <div key={venta.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">{venta.numeroVenta}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {venta.nombreCliente} · {venta.canal}
                    </div>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <div className="font-semibold text-gray-900 text-sm">{fmt(venta.totalPEN)}</div>
                    <Badge
                      variant={
                        venta.estado === 'entregada' ? 'success' :
                        venta.estado === 'despachada' ? 'info' :
                        venta.estado === 'en_entrega' ? 'warning' :
                        venta.estado === 'confirmada' ? 'warning' : 'default'
                      }
                      size="sm"
                    >
                      {venta.estado}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Vencimientos */}
        <VencimientosWidget maxItems={6} />
      </div>

      {/* Actividad reciente */}
      <div className="hidden sm:grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <ActividadRecienteWidget actividades={actividadReciente} maxItems={10} />
      </div>
    </div>
  );
};
