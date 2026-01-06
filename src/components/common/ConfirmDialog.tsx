import React from 'react';
import { AlertTriangle, Trash2, CheckCircle, Info, X, AlertCircle } from 'lucide-react';
import { Button } from './Button';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
  /** Icono personalizado - si no se provee, usa el icono por defecto segun variant */
  icon?: React.ReactNode;
}

const variantConfig: Record<ConfirmDialogVariant, {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  buttonVariant: 'danger' | 'primary' | 'secondary';
}> = {
  danger: {
    icon: <Trash2 className="h-6 w-6" />,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    buttonVariant: 'danger'
  },
  warning: {
    icon: <AlertTriangle className="h-6 w-6" />,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    buttonVariant: 'primary'
  },
  info: {
    icon: <Info className="h-6 w-6" />,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    buttonVariant: 'primary'
  },
  success: {
    icon: <CheckCircle className="h-6 w-6" />,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    buttonVariant: 'primary'
  }
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'warning',
  loading = false,
  icon
}) => {
  if (!isOpen) return null;

  const config = variantConfig[variant];
  const displayIcon = icon || config.icon;

  const handleConfirm = () => {
    onConfirm();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !loading) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-2xl max-w-md w-full transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          {!loading && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          {/* Content */}
          <div className="p-6">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={`flex-shrink-0 h-12 w-12 rounded-full ${config.iconBg} ${config.iconColor} flex items-center justify-center`}>
                {displayIcon}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <h3
                  id="confirm-dialog-title"
                  className="text-lg font-semibold text-gray-900"
                >
                  {title}
                </h3>
                <div className="mt-2 text-sm text-gray-600">
                  {typeof message === 'string' ? <p>{message}</p> : message}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              {cancelText}
            </Button>
            <Button
              variant={config.buttonVariant}
              onClick={handleConfirm}
              loading={loading}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook para manejar el estado del ConfirmDialog
 * Uso:
 * const { dialogProps, confirm } = useConfirmDialog();
 *
 * // En el onClick:
 * const confirmed = await confirm({
 *   title: 'Eliminar?',
 *   message: 'Esta accion no se puede deshacer',
 *   variant: 'danger'
 * });
 * if (confirmed) { ... }
 *
 * // En el JSX:
 * <ConfirmDialog {...dialogProps} />
 */
export interface UseConfirmDialogOptions {
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
  icon?: React.ReactNode;
}

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [options, setOptions] = React.useState<UseConfirmDialogOptions>({
    title: '',
    message: ''
  });
  const resolveRef = React.useRef<((value: boolean) => void) | null>(null);

  const confirm = React.useCallback((opts: UseConfirmDialogOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);
    setLoading(false);

    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  const handleConfirm = React.useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const dialogProps: ConfirmDialogProps = {
    isOpen,
    onClose: handleClose,
    onConfirm: handleConfirm,
    loading,
    ...options
  };

  return {
    dialogProps,
    confirm,
    setLoading
  };
}

// Global store for confirm dialog using zustand
import { create } from 'zustand';

interface GlobalConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  variant: ConfirmDialogVariant;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  loading: boolean;

  confirm: (options: UseConfirmDialogOptions) => Promise<boolean>;
  close: () => void;
  setLoading: (loading: boolean) => void;
}

export const useGlobalConfirmDialog = create<GlobalConfirmDialogState>((set) => {
  let resolvePromise: ((value: boolean) => void) | null = null;

  return {
    isOpen: false,
    title: '',
    message: '',
    variant: 'warning',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    onConfirm: () => {},
    loading: false,

    confirm: (options) => {
      return new Promise<boolean>((resolve) => {
        resolvePromise = resolve;
        set({
          isOpen: true,
          title: options.title,
          message: options.message,
          variant: options.variant || 'warning',
          confirmText: options.confirmText || 'Confirmar',
          cancelText: options.cancelText || 'Cancelar',
          loading: false,
          onConfirm: () => {
            resolvePromise?.(true);
            resolvePromise = null;
            set({ isOpen: false });
          }
        });
      });
    },

    close: () => {
      resolvePromise?.(false);
      resolvePromise = null;
      set({ isOpen: false, loading: false });
    },

    setLoading: (loading) => set({ loading })
  };
});

/**
 * Componente global para el ConfirmDialog
 * Debe incluirse una vez en el App.tsx
 */
export const GlobalConfirmDialog: React.FC = () => {
  const {
    isOpen,
    title,
    message,
    variant,
    confirmText,
    cancelText,
    onConfirm,
    loading,
    close
  } = useGlobalConfirmDialog();

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={close}
      onConfirm={onConfirm}
      title={title}
      message={message}
      variant={variant}
      confirmText={confirmText}
      cancelText={cancelText}
      loading={loading}
    />
  );
};
