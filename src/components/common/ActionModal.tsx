import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { create } from 'zustand';

export type ActionModalVariant = 'info' | 'warning' | 'success' | 'danger';

export interface ActionModalField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'textarea';
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number;
  min?: number;
  max?: number;
  step?: number;
}

export interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (values: Record<string, string | number>) => void;
  title: string;
  description?: string | React.ReactNode;
  fields?: ActionModalField[];
  confirmText?: string;
  cancelText?: string;
  variant?: ActionModalVariant;
  loading?: boolean;
  /** Información contextual adicional */
  contextInfo?: Array<{ label: string; value: string | number }>;
}

const variantConfig: Record<ActionModalVariant, {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  buttonVariant: 'primary' | 'danger' | 'secondary';
}> = {
  info: {
    icon: <Info className="h-6 w-6" />,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    buttonVariant: 'primary'
  },
  warning: {
    icon: <AlertTriangle className="h-6 w-6" />,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    buttonVariant: 'primary'
  },
  success: {
    icon: <CheckCircle className="h-6 w-6" />,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    buttonVariant: 'primary'
  },
  danger: {
    icon: <AlertCircle className="h-6 w-6" />,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    buttonVariant: 'danger'
  }
};

export const ActionModal: React.FC<ActionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  fields = [],
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'info',
  loading = false,
  contextInfo
}) => {
  const [values, setValues] = useState<Record<string, string | number>>({});
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Inicializar valores por defecto cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      const initialValues: Record<string, string | number> = {};
      fields.forEach(field => {
        initialValues[field.id] = field.defaultValue ?? '';
      });
      setValues(initialValues);

      // Focus en el primer input
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, fields]);

  if (!isOpen) return null;

  const config = variantConfig[variant];

  const handleChange = (fieldId: string, value: string | number) => {
    setValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validar campos requeridos
    const missingRequired = fields.filter(
      field => field.required && !values[field.id]
    );

    if (missingRequired.length > 0) {
      return;
    }

    onConfirm(values);
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
      aria-labelledby="action-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal */}
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

          <form onSubmit={handleSubmit}>
            {/* Content */}
            <div className="p-6">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`
                  flex-shrink-0 h-12 w-12 rounded-full
                  ${config.iconBg} ${config.iconColor}
                  flex items-center justify-center
                `}>
                  {config.icon}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <h3
                    id="action-modal-title"
                    className="text-lg font-semibold text-gray-900"
                  >
                    {title}
                  </h3>
                  {description && (
                    <div className="mt-2 text-sm text-gray-600">
                      {typeof description === 'string' ? <p>{description}</p> : description}
                    </div>
                  )}
                </div>
              </div>

              {/* Contexto adicional */}
              {contextInfo && contextInfo.length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-2">
                    {contextInfo.map((info, index) => (
                      <div key={index}>
                        <span className="text-xs text-gray-500">{info.label}</span>
                        <p className="text-sm font-medium text-gray-900">{info.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Campos de entrada */}
              {fields.length > 0 && (
                <div className="mt-4 space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id}>
                      <label
                        htmlFor={field.id}
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>

                      {field.type === 'textarea' ? (
                        <textarea
                          id={field.id}
                          value={values[field.id] ?? ''}
                          onChange={(e) => handleChange(field.id, e.target.value)}
                          placeholder={field.placeholder}
                          required={field.required}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                        />
                      ) : index === 0 ? (
                        <input
                          ref={firstInputRef}
                          id={field.id}
                          type={field.type}
                          value={values[field.id] ?? ''}
                          onChange={(e) => handleChange(
                            field.id,
                            field.type === 'number' ? Number(e.target.value) : e.target.value
                          )}
                          placeholder={field.placeholder}
                          required={field.required}
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          className="block w-full rounded-lg border border-gray-300 pl-3 pr-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      ) : (
                        <Input
                          id={field.id}
                          type={field.type}
                          value={values[field.id] ?? ''}
                          onChange={(e) => handleChange(
                            field.id,
                            field.type === 'number' ? Number(e.target.value) : e.target.value
                          )}
                          placeholder={field.placeholder}
                          required={field.required}
                          min={field.min}
                          max={field.max}
                          step={field.step}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={loading}
              >
                {cancelText}
              </Button>
              <Button
                type="submit"
                variant={config.buttonVariant}
                loading={loading}
              >
                {confirmText}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Hook para uso simple (sin campos de entrada)
// ============================================

export interface UseActionModalOptions {
  title: string;
  description?: string | React.ReactNode;
  fields?: ActionModalField[];
  confirmText?: string;
  cancelText?: string;
  variant?: ActionModalVariant;
  contextInfo?: Array<{ label: string; value: string | number }>;
}

export function useActionModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<UseActionModalOptions>({
    title: ''
  });
  const resolveRef = useRef<((value: Record<string, string | number> | null) => void) | null>(null);

  const open = React.useCallback((opts: UseActionModalOptions): Promise<Record<string, string | number> | null> => {
    setOptions(opts);
    setIsOpen(true);
    setLoading(false);

    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(null);
    resolveRef.current = null;
  }, []);

  const handleConfirm = React.useCallback((values: Record<string, string | number>) => {
    setIsOpen(false);
    resolveRef.current?.(values);
    resolveRef.current = null;
  }, []);

  const modalProps: ActionModalProps = {
    isOpen,
    onClose: handleClose,
    onConfirm: handleConfirm,
    loading,
    ...options
  };

  return {
    modalProps,
    open,
    setLoading
  };
}

// ============================================
// Store global para ActionModal
// ============================================

interface GlobalActionModalState {
  isOpen: boolean;
  title: string;
  description?: string | React.ReactNode;
  fields: ActionModalField[];
  variant: ActionModalVariant;
  confirmText: string;
  cancelText: string;
  contextInfo?: Array<{ label: string; value: string | number }>;
  loading: boolean;

  open: (options: UseActionModalOptions) => Promise<Record<string, string | number> | null>;
  close: () => void;
  setLoading: (loading: boolean) => void;
}

export const useGlobalActionModal = create<GlobalActionModalState>((set) => {
  let resolvePromise: ((value: Record<string, string | number> | null) => void) | null = null;

  return {
    isOpen: false,
    title: '',
    description: undefined,
    fields: [],
    variant: 'info',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    contextInfo: undefined,
    loading: false,

    open: (options) => {
      return new Promise<Record<string, string | number> | null>((resolve) => {
        resolvePromise = resolve;
        set({
          isOpen: true,
          title: options.title,
          description: options.description,
          fields: options.fields || [],
          variant: options.variant || 'info',
          confirmText: options.confirmText || 'Confirmar',
          cancelText: options.cancelText || 'Cancelar',
          contextInfo: options.contextInfo,
          loading: false
        });
      });
    },

    close: () => {
      resolvePromise?.(null);
      resolvePromise = null;
      set({ isOpen: false, loading: false });
    },

    setLoading: (loading) => set({ loading })
  };
});

/**
 * Componente global para ActionModal
 * Incluir una vez en App.tsx
 */
export const GlobalActionModal: React.FC = () => {
  const state = useGlobalActionModal();

  const handleConfirm = (values: Record<string, string | number>) => {
    state.close();
    // El resolve ya se maneja en close, pero necesitamos pasar los valores
  };

  return (
    <ActionModal
      isOpen={state.isOpen}
      onClose={state.close}
      onConfirm={handleConfirm}
      title={state.title}
      description={state.description}
      fields={state.fields}
      variant={state.variant}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      contextInfo={state.contextInfo}
      loading={state.loading}
    />
  );
};

export default ActionModal;
