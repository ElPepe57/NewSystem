import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, XCircle, Package } from 'lucide-react';
import { Card, Badge } from '../../common';

interface Alerta {
  tipo: 'stock_critico' | 'stock_bajo' | 'proximo_vencer' | 'vencido';
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  mensaje: string;
  prioridad: 'alta' | 'media' | 'baja';
  cantidad: number;
}

interface AlertasWidgetProps {
  alertas: Alerta[];
  maxItems?: number;
}

export const AlertasWidget: React.FC<AlertasWidgetProps> = ({
  alertas,
  maxItems = 5
}) => {
  const getAlertIcon = (tipo: string) => {
    switch (tipo) {
      case 'stock_critico':
        return <XCircle className="h-5 w-5 text-danger-500" />;
      case 'stock_bajo':
        return <AlertTriangle className="h-5 w-5 text-warning-500" />;
      case 'proximo_vencer':
        return <Clock className="h-5 w-5 text-warning-500" />;
      case 'vencido':
        return <XCircle className="h-5 w-5 text-danger-500" />;
      default:
        return <Package className="h-5 w-5 text-gray-500" />;
    }
  };

  const getAlertBg = (tipo: string) => {
    switch (tipo) {
      case 'stock_critico':
      case 'vencido':
        return 'bg-red-50 border-l-4 border-red-500';
      case 'stock_bajo':
      case 'proximo_vencer':
        return 'bg-yellow-50 border-l-4 border-yellow-500';
      default:
        return 'bg-gray-50';
    }
  };

  const getPrioridadBadge = (prioridad: string) => {
    switch (prioridad) {
      case 'alta':
        return <Badge variant="danger">Urgente</Badge>;
      case 'media':
        return <Badge variant="warning">Media</Badge>;
      default:
        return <Badge variant="default">Baja</Badge>;
    }
  };

  // Agrupar alertas por tipo
  const alertasAgrupadas = {
    criticas: alertas.filter(a => a.tipo === 'stock_critico' || a.tipo === 'vencido'),
    advertencias: alertas.filter(a => a.tipo === 'stock_bajo' || a.tipo === 'proximo_vencer')
  };

  const totalCriticas = alertasAgrupadas.criticas.length;
  const totalAdvertencias = alertasAgrupadas.advertencias.length;

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2 text-warning-500" />
          Alertas del Sistema
        </h3>
        <div className="flex gap-2">
          {totalCriticas > 0 && (
            <Badge variant="danger">{totalCriticas} críticas</Badge>
          )}
          {totalAdvertencias > 0 && (
            <Badge variant="warning">{totalAdvertencias} advertencias</Badge>
          )}
        </div>
      </div>

      {alertas.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No hay alertas activas</p>
          <p className="text-xs text-success-600 mt-1">Todo está en orden</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alertas.slice(0, maxItems).map((alerta, index) => (
            <Link
              key={`${alerta.productoId}-${alerta.tipo}-${index}`}
              to={`/inventario?producto=${alerta.productoId}`}
              className="block"
            >
              <div className={`flex items-center justify-between p-3 rounded-lg ${getAlertBg(alerta.tipo)} hover:opacity-80 transition-opacity`}>
                <div className="flex items-center gap-3">
                  {getAlertIcon(alerta.tipo)}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">
                      {alerta.marca} {alerta.nombreComercial}
                    </div>
                    <div className="text-xs text-gray-600">
                      {alerta.mensaje}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {getPrioridadBadge(alerta.prioridad)}
                </div>
              </div>
            </Link>
          ))}

          {alertas.length > maxItems && (
            <Link
              to="/inventario"
              className="block text-center text-sm text-primary-600 hover:text-primary-700 py-2"
            >
              Ver {alertas.length - maxItems} alertas más →
            </Link>
          )}
        </div>
      )}
    </Card>
  );
};
