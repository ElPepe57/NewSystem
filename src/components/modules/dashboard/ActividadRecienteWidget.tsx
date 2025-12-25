import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ShoppingCart,
  Package,
  Truck,
  ArrowRightLeft,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Card, Badge } from '../../common';

export type TipoActividad =
  | 'venta_nueva'
  | 'venta_entregada'
  | 'orden_creada'
  | 'orden_recibida'
  | 'transferencia_enviada'
  | 'transferencia_recibida'
  | 'stock_critico';

export interface ActividadItem {
  id: string;
  tipo: TipoActividad;
  titulo: string;
  descripcion: string;
  fecha: Date;
  entidadId?: string;
  metadata?: Record<string, any>;
}

interface ActividadRecienteWidgetProps {
  actividades: ActividadItem[];
  maxItems?: number;
}

export const ActividadRecienteWidget: React.FC<ActividadRecienteWidgetProps> = ({
  actividades,
  maxItems = 8
}) => {
  const getIcon = (tipo: TipoActividad) => {
    switch (tipo) {
      case 'venta_nueva':
        return <ShoppingCart className="h-4 w-4 text-primary-500" />;
      case 'venta_entregada':
        return <CheckCircle className="h-4 w-4 text-success-500" />;
      case 'orden_creada':
        return <Package className="h-4 w-4 text-blue-500" />;
      case 'orden_recibida':
        return <CheckCircle className="h-4 w-4 text-success-500" />;
      case 'transferencia_enviada':
        return <Truck className="h-4 w-4 text-orange-500" />;
      case 'transferencia_recibida':
        return <ArrowRightLeft className="h-4 w-4 text-success-500" />;
      case 'stock_critico':
        return <AlertCircle className="h-4 w-4 text-danger-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getBadge = (tipo: TipoActividad) => {
    switch (tipo) {
      case 'venta_nueva':
        return <Badge variant="info">Venta</Badge>;
      case 'venta_entregada':
        return <Badge variant="success">Entregada</Badge>;
      case 'orden_creada':
        return <Badge variant="info">Orden</Badge>;
      case 'orden_recibida':
        return <Badge variant="success">Recibida</Badge>;
      case 'transferencia_enviada':
        return <Badge variant="warning">Enviada</Badge>;
      case 'transferencia_recibida':
        return <Badge variant="success">Recibida</Badge>;
      case 'stock_critico':
        return <Badge variant="danger">Alerta</Badge>;
      default:
        return <Badge variant="default">Sistema</Badge>;
    }
  };

  const getLink = (actividad: ActividadItem): string | null => {
    if (!actividad.entidadId) return null;

    switch (actividad.tipo) {
      case 'venta_nueva':
      case 'venta_entregada':
        return `/ventas?id=${actividad.entidadId}`;
      case 'orden_creada':
      case 'orden_recibida':
        return `/compras?id=${actividad.entidadId}`;
      case 'transferencia_enviada':
      case 'transferencia_recibida':
        return `/transferencias?id=${actividad.entidadId}`;
      case 'stock_critico':
        return `/inventario?producto=${actividad.entidadId}`;
      default:
        return null;
    }
  };

  const formatFecha = (fecha: Date) => {
    const ahora = new Date();
    const diffMs = ahora.getTime() - fecha.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  };

  // Agrupar actividades por fecha
  const actividadesAgrupadas = actividades
    .slice(0, maxItems)
    .reduce((grupos, actividad) => {
      const fechaStr = actividad.fecha.toLocaleDateString('es-PE', {
        weekday: 'long',
        day: 'numeric',
        month: 'short'
      });

      if (!grupos[fechaStr]) {
        grupos[fechaStr] = [];
      }
      grupos[fechaStr].push(actividad);
      return grupos;
    }, {} as Record<string, ActividadItem[]>);

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Activity className="h-5 w-5 mr-2 text-primary-500" />
          Actividad Reciente
        </h3>
        <Badge variant="default">{actividades.length} eventos</Badge>
      </div>

      {actividades.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Clock className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Sin actividad reciente</p>
          <p className="text-xs text-gray-400 mt-1">Las acciones del sistema aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(actividadesAgrupadas).map(([fecha, items]) => (
            <div key={fecha}>
              <div className="text-xs font-medium text-gray-500 uppercase mb-2">
                {fecha}
              </div>
              <div className="relative">
                {/* Línea de timeline */}
                <div className="absolute left-[9px] top-0 bottom-0 w-0.5 bg-gray-200" />

                <div className="space-y-3">
                  {items.map((actividad) => {
                    const link = getLink(actividad);
                    const content = (
                      <div className="flex items-start gap-3 relative">
                        {/* Icono con fondo */}
                        <div className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full bg-white border-2 border-gray-200">
                          {getIcon(actividad.tipo)}
                        </div>

                        {/* Contenido */}
                        <div className="flex-1 min-w-0 pb-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {actividad.titulo}
                            </p>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {formatFecha(actividad.fecha)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">
                            {actividad.descripcion}
                          </p>
                          <div className="mt-1">
                            {getBadge(actividad.tipo)}
                          </div>
                        </div>
                      </div>
                    );

                    if (link) {
                      return (
                        <Link
                          key={actividad.id}
                          to={link}
                          className="block hover:bg-gray-50 rounded-lg -ml-1 pl-1 transition-colors"
                        >
                          {content}
                        </Link>
                      );
                    }

                    return <div key={actividad.id}>{content}</div>;
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
