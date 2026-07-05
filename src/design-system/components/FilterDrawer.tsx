import React, { useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { cn } from '../utils';
import { text, elevation } from '../tokens';
import { COLOR_CLASSES, type ColorIdentidad } from '../grupoColor';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  onClearAll?: () => void;
  activeFilterCount?: number;
  className?: string;
  /**
   * Color de identidad del módulo (canon gobernanza de color). Viste el chrome
   * del drawer (badge de conteo + CTA "Aplicar") con el color del grupo en vez
   * del teal legacy. Aditivo: sin él, mantiene el teal (no-breaking).
   */
  color?: ColorIdentidad;
}

/**
 * FilterDrawer — Panel lateral derecho con filtros.
 * Se desliza desde la derecha. Fondo overlay oscuro.
 */
export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen, onClose, title = 'Filtros', children, onClearAll, activeFilterCount, className, color = 'teal',
}) => {
  const C = COLOR_CLASSES[color];
  // Bloquear scroll del body cuando esta abierto
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className={cn(
        'fixed inset-y-0 right-0 w-full sm:w-[380px] bg-white z-50 flex flex-col',
        elevation[3], 'animate-slide-in-right',
        className,
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <h2 className={text.heading}>{title}</h2>
            {!!activeFilterCount && (
              <span className={cn('w-5 h-5 text-xs font-bold rounded-full flex items-center justify-center', C.toggleActive)}>
                {activeFilterCount}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {children}
        </div>

        {/* Footer */}
        {onClearAll && (
          <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={onClearAll}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpiar todo
            </button>
            <button
              onClick={onClose}
              className={cn('px-4 py-2 text-sm font-medium rounded-lg transition-colors', C.primaryBtn)}
            >
              Aplicar
            </button>
          </div>
        )}
      </div>
    </>
  );
};
