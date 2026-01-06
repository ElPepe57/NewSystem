import React from 'react';
import { useToastStore, type ToastType, type Toast } from '../../store/toastStore';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const getToastConfig = (type: ToastType) => {
  switch (type) {
    case 'success':
      return {
        bg: 'bg-white',
        border: 'border-l-green-500',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
        titleColor: 'text-green-800',
        textColor: 'text-green-700',
        icon: <CheckCircle className="w-5 h-5" />
      };
    case 'error':
      return {
        bg: 'bg-white',
        border: 'border-l-red-500',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        titleColor: 'text-red-800',
        textColor: 'text-red-700',
        icon: <AlertCircle className="w-5 h-5" />
      };
    case 'warning':
      return {
        bg: 'bg-white',
        border: 'border-l-amber-500',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        titleColor: 'text-amber-800',
        textColor: 'text-amber-700',
        icon: <AlertTriangle className="w-5 h-5" />
      };
    case 'info':
    default:
      return {
        bg: 'bg-white',
        border: 'border-l-blue-500',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        titleColor: 'text-blue-800',
        textColor: 'text-blue-700',
        icon: <Info className="w-5 h-5" />
      };
  }
};

const ToastItem: React.FC<{ toast: Toast; onRemove: () => void }> = ({ toast, onRemove }) => {
  const style = getToastConfig(toast.type);

  return (
    <div
      className={`
        ${style.bg} border-l-4 ${style.border} shadow-lg rounded-lg overflow-hidden
        transform transition-all duration-300 ease-out
        ${toast.isLeaving ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
      role="alert"
    >
      <div className="p-4 flex items-start gap-3">
        {/* Icono */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full ${style.iconBg} ${style.iconColor} flex items-center justify-center`}>
          {style.icon}
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p className={`text-sm font-semibold ${style.titleColor}`}>
              {toast.title}
            </p>
          )}
          <p className={`text-sm ${toast.title ? style.textColor : style.titleColor} ${toast.title ? 'mt-0.5' : ''}`}>
            {toast.message}
          </p>
        </div>

        {/* Boton cerrar */}
        <button
          onClick={onRemove}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Barra de progreso */}
      {toast.duration > 0 && !toast.isLeaving && (
        <div className="h-1 bg-gray-100">
          <div
            className={`h-full ${style.iconBg.replace('100', '400')}`}
            style={{
              animation: `shrink ${toast.duration}ms linear forwards`
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

const ToastContainer: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[100] flex flex-col gap-3 w-96 max-w-[90vw]">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default ToastContainer;