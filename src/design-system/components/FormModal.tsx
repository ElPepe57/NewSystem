import React from 'react';
import { Modal } from '../../components/common/Modal';
import { cn } from '../utils';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onSubmit: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'create' | 'edit' | 'confirm';
}

const defaultLabels: Record<string, string> = {
  create: 'Crear',
  edit: 'Guardar',
  confirm: 'Confirmar',
};

/**
 * FormModal — Wrapper estandar de Modal para formularios.
 * Usa el Modal existente (bien construido) + footer consistente.
 */
export const FormModal: React.FC<FormModalProps> = ({
  isOpen, onClose, title, subtitle, size = 'md', onSubmit,
  submitLabel, cancelLabel = 'Cancelar', loading, disabled,
  children, variant = 'create',
}) => {
  const label = submitLabel || defaultLabels[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size={size}>
      {subtitle && <p className="text-sm text-slate-500 -mt-2 mb-4">{subtitle}</p>}
      <div className="space-y-4">
        {children}
      </div>
      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || disabled}
          className={cn(
            'px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors',
            'bg-teal-600 hover:bg-teal-700',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {loading ? 'Guardando...' : label}
        </button>
      </div>
    </Modal>
  );
};
