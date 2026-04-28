/**
 * FormModalV2 — S58 Fase 1 · Modal de formulario banking-grade
 *
 * Wrapper sobre Modal con estética Mercury/Stripe Atlas:
 *  - Header rico: icono tonal + título + subtítulo + breadcrumb opcional
 *  - Body scrollable sin secciones de colores (la jerarquía la da tipografía)
 *  - Footer sticky con atajos teclado visibles + actions Cancel/Submit
 *  - Atajo Cmd/Ctrl+Enter para submit · Esc para cerrar
 *  - Banner opcional de auto-save (debajo del header)
 *  - Botones usan variantes -soft del Button del design system
 *
 * NO reemplaza al FormModal viejo (ese sigue para modales no migrados).
 * Migración progresiva: cada modal se mueve cuando se rediseña.
 *
 * Doc de referencia: docs/mockups/modales-finanzas-s58.html sección 2 "Anatomía".
 */

import React, { useEffect, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Coins } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common';
import { cn } from '../utils';

// ─── Tipos ─────────────────────────────────────────────────────────────

export type FormModalV2SubmitVariant =
  | 'primary'
  | 'primary-soft'
  | 'success'
  | 'success-soft'
  | 'danger'
  | 'danger-soft';

export type FormModalV2AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface FormModalV2Props {
  // ── Visibilidad ──
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;

  // ── Header ──
  /** Título principal del modal. */
  title: string;
  /** Subtítulo opcional debajo del título. */
  subtitle?: string;
  /** Breadcrumb opcional (ej: "Cash flow · Movimiento"). */
  breadcrumb?: string;
  /** Icono lucide. Default: Coins (teal). */
  icon?: LucideIcon;
  /** Color del fondo del icono. Default: 'teal'. */
  iconTone?: 'teal' | 'amber' | 'sky' | 'emerald' | 'red' | 'purple' | 'slate';

  // ── Auto-save banner (opcional) ──
  autoSaveStatus?: FormModalV2AutoSaveStatus;
  /** Etiqueta humana del estado, ej: "hace 3 segundos". */
  autoSaveLabel?: string;

  // ── Body ──
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';

  // ── Footer ──
  submitLabel?: string;
  cancelLabel?: string;
  /** Variant del botón submit. Default: 'primary-soft'. */
  submitVariant?: FormModalV2SubmitVariant;
  /** Icono opcional del botón submit. */
  submitIcon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  /** Mostrar atajos teclado en footer. Default: true. */
  showShortcuts?: boolean;
  /** Slot extra en el footer (ej: checkbox "Crear otro al guardar"). */
  footerExtras?: React.ReactNode;

  // ── Comportamiento ──
  disableEscapeKey?: boolean;
  disableBackdropClick?: boolean;
  /** Si false, el atajo Cmd/Ctrl+Enter no llama onSubmit. Default: true. */
  enableSubmitShortcut?: boolean;
}

// ─── Helper: tono del icono ────────────────────────────────────────────

const ICON_TONE_CLASSES: Record<NonNullable<FormModalV2Props['iconTone']>, string> = {
  teal: 'bg-teal-50 border-teal-200 text-teal-700',
  amber: 'bg-amber-50 border-amber-200 text-amber-700',
  sky: 'bg-sky-50 border-sky-200 text-sky-700',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  slate: 'bg-slate-100 border-slate-200 text-slate-700',
};

// ─── Helper: kbd ───────────────────────────────────────────────────────

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-block px-1.5 py-px font-mono text-[10px] bg-slate-100 border border-slate-300 border-b-2 rounded text-slate-600">
    {children}
  </span>
);

// ─── Helper: detectar Mac (para mostrar ⌘ vs Ctrl) ─────────────────────

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

// ─── Componente ────────────────────────────────────────────────────────

export const FormModalV2: React.FC<FormModalV2Props> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  subtitle,
  breadcrumb,
  icon: Icon = Coins,
  iconTone = 'teal',
  autoSaveStatus = 'idle',
  autoSaveLabel,
  children,
  size = 'md',
  submitLabel = 'Guardar',
  cancelLabel = 'Cancelar',
  submitVariant = 'primary-soft',
  submitIcon: SubmitIcon,
  loading = false,
  disabled = false,
  showShortcuts = true,
  footerExtras,
  disableEscapeKey,
  disableBackdropClick,
  enableSubmitShortcut = true,
}) => {
  // ── Atajo Cmd/Ctrl+Enter para submit ──
  const handleSubmitShortcut = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || !enableSubmitShortcut) return;
      const key = e.key === 'Enter';
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      if (key && modKey && !loading && !disabled) {
        e.preventDefault();
        onSubmit();
      }
    },
    [isOpen, enableSubmitShortcut, loading, disabled, onSubmit],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleSubmitShortcut);
    return () => document.removeEventListener('keydown', handleSubmitShortcut);
  }, [isOpen, handleSubmitShortcut]);

  // ── Header content (custom, lo pasamos al Modal vía slot) ──
  // El Modal base tiene su propio header con title + subtitle.
  // Lo desactivamos pasando title vacío y construimos uno propio.
  const headerExtras = (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className={cn(
          'flex-shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center',
          ICON_TONE_CLASSES[iconTone],
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-slate-900 truncate">{title}</h2>
        <p className="text-[11px] text-slate-500 truncate">
          {breadcrumb ?? subtitle}
        </p>
      </div>
    </div>
  );

  // ── Auto-save banner ──
  const autoSaveBanner = autoSaveStatus !== 'idle' && (
    <div
      className={cn(
        'px-6 py-2 border-b flex items-center gap-2 text-[11px]',
        autoSaveStatus === 'saving' && 'bg-slate-50 border-slate-100 text-slate-600',
        autoSaveStatus === 'saved' && 'bg-teal-50 border-teal-100 text-teal-700',
        autoSaveStatus === 'error' && 'bg-red-50 border-red-100 text-red-700',
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          autoSaveStatus === 'saving' && 'bg-slate-400 animate-pulse',
          autoSaveStatus === 'saved' && 'bg-teal-500',
          autoSaveStatus === 'error' && 'bg-red-500',
        )}
      />
      {autoSaveStatus === 'saving' && 'Guardando borrador...'}
      {autoSaveStatus === 'saved' && (
        <>Borrador guardado{autoSaveLabel && ` · ${autoSaveLabel}`}</>
      )}
      {autoSaveStatus === 'error' && 'Error guardando borrador'}
    </div>
  );

  // ── Footer ──
  const footer = (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      {/* Atajos + extras a la izquierda */}
      <div className="flex items-center gap-3 flex-wrap text-[10px] text-slate-500">
        {showShortcuts && (
          <>
            <span className="flex items-center gap-1">
              <Kbd>Esc</Kbd> cerrar
            </span>
            {enableSubmitShortcut && (
              <span className="flex items-center gap-1">
                <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
                <Kbd>↵</Kbd> guardar
              </span>
            )}
          </>
        )}
        {footerExtras}
      </div>

      {/* Actions a la derecha */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={submitVariant}
          size="sm"
          onClick={onSubmit}
          loading={loading}
          disabled={disabled || loading}
        >
          {SubmitIcon && !loading && <SubmitIcon className="w-4 h-4 mr-1.5" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      // Usamos title vacío para que el Modal NO renderice su header default.
      // Renderizamos el header completo dentro del children (con icono+título)
      title=""
      size={size}
      contentPadding="none"
      disableEscapeKey={disableEscapeKey}
      disableBackdropClick={disableBackdropClick}
      footer={footer}
      showHeaderShadow={false}
    >
      {/* Header custom con icono tonal */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-3 sticky top-0 z-10">
        {headerExtras}
      </div>

      {/* Auto-save banner (si aplica) */}
      {autoSaveBanner}

      {/* Body con padding consistente */}
      <div className="px-6 py-5">{children}</div>
    </Modal>
  );
};
