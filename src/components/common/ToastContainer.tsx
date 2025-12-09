import React from 'react';
// CORRECCIÓN AQUÍ: Se agrega 'type' antes de NotificationType
import { useNotificationStore, type NotificationType } from '../../store/notificationStore';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const ToastContainer: React.FC = () => {
  // Obtenemos el estado de forma segura
  const notifications = useNotificationStore((state) => state.notifications);
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  const getToastConfig = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-100',
          border: 'border-green-500',
          text: 'text-green-800',
          icon: <CheckCircle className="w-5 h-5 text-green-600" />
        };
      case 'error':
        return {
          bg: 'bg-red-100',
          border: 'border-red-500',
          text: 'text-red-800',
          icon: <AlertCircle className="w-5 h-5 text-red-600" />
        };
      case 'warning':
        return {
          bg: 'bg-yellow-100',
          border: 'border-yellow-500',
          text: 'text-yellow-800',
          icon: <AlertTriangle className="w-5 h-5 text-yellow-600" />
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-100',
          border: 'border-blue-500',
          text: 'text-blue-800',
          icon: <Info className="w-5 h-5 text-blue-600" />
        };
    }
  };

  // Si no hay notificaciones, no renderizamos nada (evita errores de layout)
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 w-80 max-w-[90vw]">
      {notifications.map((notif) => {
        const style = getToastConfig(notif.type);

        return (
          <div
            key={notif.id}
            className={`${style.bg} border-l-4 ${style.border} shadow-md rounded-r p-4 flex items-start justify-between transition-all duration-300 transform translate-x-0`}
            role="alert"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0">
                {style.icon}
              </div>
              <p className={`text-sm font-medium ${style.text}`}>
                {notif.message}
              </p>
            </div>

            <button
              onClick={() => removeNotification(notif.id)}
              className="ml-4 text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;