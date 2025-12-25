import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSystemNotificationStore } from '../../store/systemNotificationStore';
import type { SystemNotification, AccionNotificacion } from '../../types/notification.types';

// Iconos según el tipo de notificación
const iconosPorTipo: Record<string, string> = {
  stock_disponible: '📦',
  reserva_por_vencer: '⏰',
  reserva_vencida: '⚠️',
  pago_recibido: '💰',
  stock_bajo: '📉',
  requerimiento_urgente: '🔴',
  general: '🔔'
};

// Colores según prioridad
const coloresPorPrioridad: Record<string, string> = {
  baja: 'bg-gray-100 border-gray-300',
  media: 'bg-blue-50 border-blue-300',
  alta: 'bg-yellow-50 border-yellow-400',
  urgente: 'bg-red-50 border-red-400'
};

interface NotificationItemProps {
  notificacion: SystemNotification;
  onAccion: (accion: AccionNotificacion) => void;
  onMarcarLeida: () => void;
  onEliminar: () => void;
}

function NotificationItem({
  notificacion,
  onAccion,
  onMarcarLeida,
  onEliminar
}: NotificationItemProps) {
  const icono = iconosPorTipo[notificacion.tipo] || '🔔';
  const colorClase = coloresPorPrioridad[notificacion.prioridad] || coloresPorPrioridad.media;

  const fechaCreacion = notificacion.fechaCreacion?.toDate
    ? notificacion.fechaCreacion.toDate()
    : new Date();

  const tiempoRelativo = getRelativeTime(fechaCreacion);

  return (
    <div
      className={`p-3 border-l-4 rounded-r-lg mb-2 ${colorClase} ${
        !notificacion.leida ? 'font-medium' : 'opacity-80'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2 flex-1">
          <span className="text-xl">{icono}</span>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-800 truncate">
              {notificacion.titulo}
            </h4>
            <p className="text-sm text-gray-600">{notificacion.mensaje}</p>
            {notificacion.detalles && (
              <p className="text-xs text-gray-500 mt-1">{notificacion.detalles}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{tiempoRelativo}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 ml-2">
          {!notificacion.leida && (
            <button
              onClick={onMarcarLeida}
              className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
              title="Marcar como leída"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
          <button
            onClick={onEliminar}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            title="Eliminar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Botones de acción */}
      {notificacion.acciones && notificacion.acciones.length > 0 && !notificacion.accionada && (
        <div className="flex gap-2 mt-3">
          {notificacion.acciones.map((accion) => (
            <button
              key={accion.id}
              onClick={() => onAccion(accion)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                accion.tipo === 'primary'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : accion.tipo === 'danger'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {accion.label}
            </button>
          ))}
        </div>
      )}

      {notificacion.accionada && (
        <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Acción completada
        </div>
      )}
    </div>
  );
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora mismo';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return date.toLocaleDateString('es-PE');
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const {
    notificaciones,
    contadores,
    iniciarSuscripcion,
    detenerSuscripcion,
    marcarComoLeida,
    marcarTodasComoLeidas,
    marcarComoAccionada,
    eliminar
  } = useSystemNotificationStore();

  // Iniciar suscripción al montar
  useEffect(() => {
    iniciarSuscripcion();
    return () => detenerSuscripcion();
  }, [iniciarSuscripcion, detenerSuscripcion]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAccion = async (notificacion: SystemNotification, accion: AccionNotificacion) => {
    // Marcar como accionada
    await marcarComoAccionada(notificacion.id);

    // Ejecutar la acción correspondiente
    switch (accion.accion) {
      case 'ver_venta':
        if (accion.parametros?.ventaId) {
          navigate(`/ventas/${accion.parametros.ventaId}`);
        }
        break;
      case 'asignar_stock':
        if (accion.parametros?.ventaId) {
          navigate(`/ventas/${accion.parametros.ventaId}?accion=asignar`);
        }
        break;
      case 'ver_requerimiento':
        if (accion.parametros?.requerimientoId) {
          navigate(`/requerimientos/${accion.parametros.requerimientoId}`);
        }
        break;
      case 'extender_reserva':
        if (accion.parametros?.ventaId) {
          navigate(`/cotizaciones/${accion.parametros.ventaId}?accion=extender`);
        }
        break;
      default:
        console.log('Acción no implementada:', accion.accion);
    }

    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón de notificaciones */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
        title="Notificaciones"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Badge de notificaciones no leídas */}
        {contadores.noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white bg-red-500 rounded-full">
            {contadores.noLeidas > 99 ? '99+' : contadores.noLeidas}
          </span>
        )}

        {/* Indicador de urgente */}
        {contadores.urgentes > 0 && (
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-600 rounded-full animate-pulse" />
        )}
      </button>

      {/* Panel de notificaciones */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-h-[500px] bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">
              Notificaciones
              {contadores.noLeidas > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({contadores.noLeidas} sin leer)
                </span>
              )}
            </h3>
            {contadores.noLeidas > 0 && (
              <button
                onClick={marcarTodasComoLeidas}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {/* Lista de notificaciones */}
          <div className="overflow-y-auto max-h-[400px] p-3">
            {notificaciones.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <p className="text-sm">No tienes notificaciones</p>
              </div>
            ) : (
              notificaciones.map((notificacion) => (
                <NotificationItem
                  key={notificacion.id}
                  notificacion={notificacion}
                  onAccion={(accion) => handleAccion(notificacion, accion)}
                  onMarcarLeida={() => marcarComoLeida(notificacion.id)}
                  onEliminar={() => eliminar(notificacion.id)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notificaciones.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  navigate('/notificaciones');
                  setIsOpen(false);
                }}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Ver todas las notificaciones
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
