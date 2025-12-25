import React from 'react';
import { useToastStore, type ToastType } from '../../store/toastStore';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const ToastContainer: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  const getToastConfig = (type: ToastType) => {
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

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 w-80 max-w-[90vw]">
      {toasts.map((toast) => {
        const style = getToastConfig(toast.type);

        return (
          <div
            key={toast.id}
            className={`${style.bg} border-l-4 ${style.border} shadow-md rounded-r p-4 flex items-start justify-between transition-all duration-300 transform translate-x-0`}
            role="alert"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0">
                {style.icon}
              </div>
              <p className={`text-sm font-medium ${style.text}`}>
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
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