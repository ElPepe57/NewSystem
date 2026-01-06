import React from 'react';
import {
  AlertTriangle,
  Clock,
  TrendingDown,
  Eye,
  Megaphone,
  Package
} from 'lucide-react';
import { Badge, Button } from '../../common';
import type { ProductoConUnidades } from './ProductoInventarioTable';

export interface AlertaProducto {
  producto: ProductoConUnidades;
  tipo: 'vencimiento' | 'stock_critico' | 'sin_movimiento';
  prioridad: 'alta' | 'media' | 'baja';
  diasRestantes?: number;
  unidadesAfectadas: number;
  mensaje: string;
}

interface AlertasPrioritariasProps {
  alertas: AlertaProducto[];
  onVerProducto: (productoId: string) => void;
  onPromocionar?: (productoId: string) => void;
  maxAlertas?: number;
}

const alertaConfig = {
  vencimiento: {
    icon: Clock,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    badgeVariant: 'warning' as const
  },
  stock_critico: {
    icon: TrendingDown,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    badgeVariant: 'danger' as const
  },
  sin_movimiento: {
    icon: Package,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    badgeVariant: 'default' as const
  }
};

const prioridadConfig = {
  alta: { color: 'text-red-600', bgColor: 'bg-red-100' },
  media: { color: 'text-amber-600', bgColor: 'bg-amber-100' },
  baja: { color: 'text-gray-600', bgColor: 'bg-gray-100' }
};

export const AlertasPrioritarias: React.FC<AlertasPrioritariasProps> = ({
  alertas,
  onVerProducto,
  onPromocionar,
  maxAlertas = 6
}) => {
  const alertasVisibles = alertas.slice(0, maxAlertas);
  const alertasOcultas = alertas.length - maxAlertas;

  if (alertas.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-3">
          <Package className="h-6 w-6 text-green-600" />
        </div>
        <h4 className="text-sm font-medium text-green-800">Todo en orden</h4>
        <p className="text-xs text-green-600 mt-1">
          No hay alertas prioritarias en este momento
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold text-gray-900">Alertas Prioritarias</h3>
          <Badge variant="warning" size="sm">{alertas.length}</Badge>
        </div>
        <span className="text-xs text-gray-500">Requieren acción</span>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {alertasVisibles.map((alerta, index) => {
          const config = alertaConfig[alerta.tipo];
          const prioridad = prioridadConfig[alerta.prioridad];
          const Icon = config.icon;

          return (
            <div
              key={`${alerta.producto.productoId}-${alerta.tipo}-${index}`}
              className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 hover:shadow-md transition-shadow`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <Badge variant={config.badgeVariant} size="sm">
                    {alerta.tipo === 'vencimiento' && 'Vencimiento'}
                    {alerta.tipo === 'stock_critico' && 'Stock Crítico'}
                    {alerta.tipo === 'sin_movimiento' && 'Sin Movimiento'}
                  </Badge>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${prioridad.bgColor} ${prioridad.color}`}>
                  {alerta.prioridad.toUpperCase()}
                </span>
              </div>

              {/* Producto Info */}
              <div className="mb-3">
                <div className="font-mono text-sm font-semibold text-gray-900">
                  {alerta.producto.sku}
                </div>
                <div className="text-sm text-gray-600 truncate">
                  {alerta.producto.marca} · {alerta.producto.nombre}
                </div>
              </div>

              {/* Detalle de alerta */}
              <div className="mb-4 p-2 bg-white/50 rounded">
                <div className="text-sm text-gray-700">{alerta.mensaje}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {alerta.unidadesAfectadas} unidad{alerta.unidadesAfectadas !== 1 ? 'es' : ''} afectada{alerta.unidadesAfectadas !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onVerProducto(alerta.producto.productoId)}
                  className="flex-1"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Ver
                </Button>
                {alerta.tipo === 'vencimiento' && onPromocionar && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onPromocionar(alerta.producto.productoId)}
                    className="flex-1"
                  >
                    <Megaphone className="h-3 w-3 mr-1" />
                    Promocionar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {alertasOcultas > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 text-center">
          <span className="text-sm text-gray-500">
            +{alertasOcultas} alerta{alertasOcultas !== 1 ? 's' : ''} adicional{alertasOcultas !== 1 ? 'es' : ''}
          </span>
        </div>
      )}
    </div>
  );
};
