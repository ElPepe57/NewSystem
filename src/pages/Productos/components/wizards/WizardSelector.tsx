/**
 * WizardSelector · Selector inicial de tipo de creación · Pre-wizard
 *
 * Mockup canónico: docs/mockups/productos/16-wizard-creacion-selector.html
 *
 * Trigger: click "+ Nuevo producto" en HeaderV2
 * Output: el usuario elige uno de 4 tipos · cada opción dispara su wizard:
 *   - "simple"            → WizardSimple (Fase 7a)
 *   - "con_variantes"     → WizardConVariantes (Fase 7b · pendiente)
 *   - "variante_existente" → WizardVarianteExistente (Fase 7c · pendiente)
 *   - "pack"              → WizardPack (Fase 7b · pendiente)
 *
 * Diseño: modal centrado max-w-2xl · header gradient F6.1 · 4 cards con
 * borde hover por color semántico · footer con tip + cancelar
 */

import React, { useEffect } from 'react';
import { X, Package, GitBranch, Search, Gift, ArrowRight, Info } from 'lucide-react';

export type TipoCreacion = 'simple' | 'con_variantes' | 'variante_existente' | 'pack';

interface WizardSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (tipo: TipoCreacion) => void;
}

interface OpcionConfig {
  tipo: TipoCreacion;
  titulo: string;
  descripcion: string;
  icon: typeof Package;
  hoverBorder: string;
  hoverBg: string;
  hoverBgIcon: string;
  hoverTextIcon: string;
  hoverArrow: string;
  isNew?: boolean;
  newColor?: string;
}

const OPCIONES: OpcionConfig[] = [
  {
    tipo: 'simple',
    titulo: 'Producto único',
    descripcion: 'Sin variantes · solo 1 SKU. Ej: una crema que se vende en una sola presentación.',
    icon: Package,
    hoverBorder: 'hover:border-teal-400',
    hoverBg: 'hover:bg-teal-50/30',
    hoverBgIcon: 'group-hover:bg-teal-100',
    hoverTextIcon: 'group-hover:text-teal-600',
    hoverArrow: 'group-hover:text-teal-600',
  },
  {
    tipo: 'con_variantes',
    titulo: 'Producto con variantes',
    descripcion: 'Diferentes tamaños, sabores o presentaciones. Ej: Sérum disponible en 30ml, 15ml y 5ml.',
    icon: GitBranch,
    hoverBorder: 'hover:border-sky-400',
    hoverBg: 'hover:bg-sky-50/30',
    hoverBgIcon: 'group-hover:bg-sky-100',
    hoverTextIcon: 'group-hover:text-sky-600',
    hoverArrow: 'group-hover:text-sky-600',
  },
  {
    tipo: 'variante_existente',
    titulo: 'Variante de producto existente',
    descripcion: 'Agregar nueva presentación a un producto que ya tienes en el catálogo.',
    icon: Search,
    hoverBorder: 'hover:border-emerald-400',
    hoverBg: 'hover:bg-emerald-50/30',
    hoverBgIcon: 'group-hover:bg-emerald-100',
    hoverTextIcon: 'group-hover:text-emerald-600',
    hoverArrow: 'group-hover:text-emerald-600',
  },
  {
    tipo: 'pack',
    titulo: 'Pack / Kit',
    descripcion: 'Cajita armada de fábrica con varios productos adentro · no desarmable.',
    icon: Gift,
    hoverBorder: 'hover:border-purple-400',
    hoverBg: 'hover:bg-purple-50/30',
    hoverBgIcon: 'group-hover:bg-purple-100',
    hoverTextIcon: 'group-hover:text-purple-600',
    hoverArrow: 'group-hover:text-purple-600',
    isNew: true,
    newColor: 'bg-purple-600',
  },
];

export const WizardSelector: React.FC<WizardSelectorProps> = ({ open, onClose, onSelect }) => {
  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        aria-label="Cerrar selector"
      />

      {/* Modal · centered desktop / bottom sheet mobile */}
      <div className="relative w-full lg:w-auto lg:max-w-2xl lg:mx-auto bg-white lg:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Drag handle solo mobile */}
        <div className="lg:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header gradient F6.1 */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 px-4 lg:px-6 py-3 lg:py-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base lg:text-xl font-bold text-slate-900">¿Qué tipo de producto vas a crear?</h2>
              <p className="text-[11px] lg:text-xs text-slate-500 mt-0.5 lg:mt-1">
                Selecciona el camino que mejor describe tu producto
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 flex-shrink-0"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body · 4 cards de tipo */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-2.5 lg:space-y-3">
          {OPCIONES.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.tipo}
                type="button"
                onClick={() => onSelect(opt.tipo)}
                className={`w-full text-left bg-white border-2 border-slate-200 rounded-xl p-3 lg:p-4 hover:shadow-sm transition-all group ${opt.hoverBorder} ${opt.hoverBg}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 transition-colors relative ${opt.hoverBgIcon}`}
                  >
                    <Icon className={`w-5 h-5 lg:w-6 lg:h-6 text-slate-600 ${opt.hoverTextIcon}`} />
                    {opt.isNew && (
                      <span
                        className={`absolute -top-1 -right-1 px-1.5 py-0.5 text-white text-[8px] font-bold rounded-full uppercase tracking-wider ${opt.newColor}`}
                      >
                        New
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold text-slate-900">{opt.titulo}</div>
                      <ArrowRight className={`w-4 h-4 text-slate-400 flex-shrink-0 ${opt.hoverArrow}`} />
                    </div>
                    <div className="text-[11px] lg:text-xs text-slate-500 mt-0.5 leading-relaxed">{opt.descripcion}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer · tip + cancelar */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 lg:px-6 py-2.5 lg:py-3 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 min-w-0 flex-1">
            <Info className="w-3 h-3 flex-shrink-0" />
            <span className="hidden sm:inline truncate">
              ¿No estás seguro? Empezá con "Producto único" · siempre podés convertirlo después.
            </span>
            <span className="sm:hidden truncate">Empezá con Único · podés convertirlo</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg flex-shrink-0"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
