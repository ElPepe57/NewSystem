import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  X,
  Check,
  CheckCheck,
  AlertTriangle,
  ShoppingCart,
  Package,
  Clock,
  User,
  Info,
  Trash2
} from 'lucide-react';
import { Badge } from '../common';
import { useNotificacionStore } from '../../store/notificacionStore';
import { useAuthStore } from '../../store/authStore';
import { notificacionService } from '../../services/notificacion.service';
import type { Notificacion, TipoNotificacion } from '../../types/notificacion.types';

export const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { userProfile } = useAuthStore();
  const {
    notificaciones,
    stats,
    setNotificaciones,
    marcarComoLeida,
    marcarTodasComoLeidas,
    removeNotificacion
  } = useNotificacionStore();

  // Cargar notificaciones al montar
  useEffect(() => {
    if (!userProfile?.uid) return;

    // Suscribirse a notificaciones en tiempo real
    const unsubscribe = notificacionService.subscribeToNotificaciones(
      userProfile.uid,
      (nuevasNotificaciones) => {
        setNotificaciones(nuevasNotificaciones);
      }
    );

    return () => unsubscribe();
  }, [userProfile?.uid, setNotificaciones]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIconForType = (tipo: TipoNotificacion) => {
    switch (tipo) {
      case 'stock_critico':
      case 'stock_bajo':
        return <AlertTriangle className="h-5 w-5 text-warning-500" />;
      case 'producto_vencido':
      case 'producto_por_vencer':
        return <Clock className="h-5 w-5 text-orange-500" />;
      case 'nueva_venta':
      case 'venta_entregada':
        return <ShoppingCart className="h-5 w-5 text-success-500" />;
      case 'orden_recibida':
      case 'orden_en_transito':
        return <Package className="h-5 w-5 text-blue-500" />;
      case 'usuario_nuevo':
        return <User className="h-5 w-5 text-purple-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case 'urgente':
        return 'border-l-4 border-red-500 bg-red-50';
      case 'alta':
        return 'border-l-4 border-orange-500 bg-orange-50';
      case 'media':
        return 'border-l-4 border-yellow-500 bg-yellow-50';
      default:
        return 'border-l-4 border-gray-300 bg-gray-50';
    }
  };

  const formatFecha = (timestamp: any) => {
    if (!timestamp?.toDate) return '';
    const fecha = timestamp.toDate();
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

  const handleMarcarLeida = async (notificacion: Notificacion) => {
    if (!notificacion.leida) {
      marcarComoLeida(notificacion.id);
      try {
        await notificacionService.marcarComoLeida(notificacion.id);
      } catch (error) {
        console.error('Error al marcar como leída:', error);
      }
    }
  };

  const handleMarcarTodasLeidas = async () => {
    if (!userProfile?.uid) return;
    marcarTodasComoLeidas();
    try {
      await notificacionService.marcarTodasComoLeidas(userProfile.uid);
    } catch (error) {
      console.error('Error al marcar todas como leídas:', error);
    }
  };

  const handleEliminar = async (id: string) => {
    removeNotificacion(id);
    try {
      await notificacionService.delete(id);
    } catch (error) {
      console.error('Error al eliminar notificación:', error);
    }
  };

  const getLinkForNotificacion = (notificacion: Notificacion): string | null => {
    if (!notificacion.entidadTipo || !notificacion.entidadId) return null;

    switch (notificacion.entidadTipo) {
      case 'producto':
        return `/productos?id=${notificacion.entidadId}`;
      case 'venta':
        return `/ventas?id=${notificacion.entidadId}`;
      case 'orden':
        return `/compras?id=${notificacion.entidadId}`;
      case 'inventario':
        return `/inventario?producto=${notificacion.entidadId}`;
      default:
        return null;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón de notificaciones */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        title="Notificaciones"
      >
        <Bell className="h-6 w-6" />
        {stats.noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white bg-red-500 rounded-full">
            {stats.noLeidas > 99 ? '99+' : stats.noLeidas}
          </span>
        )}
        {stats.urgentes > 0 && (
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-ping" />
        )}
      </button>

      {/* Dropdown de notificaciones */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-h-[500px] bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="font-semibold text-gray-900">Notificaciones</span>
              {stats.noLeidas > 0 && (
                <Badge variant="danger">{stats.noLeidas}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {stats.noLeidas > 0 && (
                <button
                  onClick={handleMarcarTodasLeidas}
                  className="p-1 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Lista de notificaciones */}
          <div className="max-h-[380px] overflow-y-auto">
            {notificaciones.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No hay notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notificaciones.map((notificacion) => {
                  const link = getLinkForNotificacion(notificacion);
                  const content = (
                    <div
                      className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                        !notificacion.leida ? getPrioridadColor(notificacion.prioridad) : 'bg-white'
                      }`}
                      onClick={() => handleMarcarLeida(notificacion)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getIconForType(notificacion.tipo)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm font-medium ${!notificacion.leida ? 'text-gray-900' : 'text-gray-600'}`}>
                              {notificacion.titulo}
                            </p>
                            <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                              {formatFecha(notificacion.fechaCreacion)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {notificacion.mensaje}
                          </p>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-1">
                          {!notificacion.leida && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleMarcarLeida(notificacion);
                              }}
                              className="p-1 text-gray-400 hover:text-success-600 rounded"
                              title="Marcar como leída"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEliminar(notificacion.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );

                  if (link) {
                    return (
                      <Link
                        key={notificacion.id}
                        to={link}
                        onClick={() => {
                          handleMarcarLeida(notificacion);
                          setIsOpen(false);
                        }}
                      >
                        {content}
                      </Link>
                    );
                  }

                  return <div key={notificacion.id}>{content}</div>;
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notificaciones.length > 0 && (
            <div className="p-3 border-t bg-gray-50 text-center">
              <span className="text-xs text-gray-500">
                {stats.total} notificaciones • {stats.noLeidas} sin leer
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
