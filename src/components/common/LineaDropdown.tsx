import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';

/**
 * LineaDropdown — Selector de línea de negocio moderno.
 * Se integra en el PageHeader junto al título.
 * Estilo Linear/Vercel: botón limpio con dropdown.
 * Escala a N líneas de negocio.
 */
export function LineaDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const lineasActivas = useLineaNegocioStore(s => s.lineasActivas);
  const lineaFiltroGlobal = useLineaNegocioStore(s => s.lineaFiltroGlobal);
  const setLineaFiltroGlobal = useLineaNegocioStore(s => s.setLineaFiltroGlobal);

  const selectedLinea = lineasActivas.find(l => l.id === lineaFiltroGlobal);
  const selectedLabel = selectedLinea
    ? `${selectedLinea.icono || ''} ${selectedLinea.nombre}`.trim()
    : 'Todas las líneas';
  const selectedColor = selectedLinea?.color || undefined;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open]);

  const handleSelect = (lineaId: string | null) => {
    setLineaFiltroGlobal(lineaId);
    setOpen(false);
  };

  if (lineasActivas.length <= 1) return null;

  return (
    <div ref={ref} className="relative">
      {/* Trigger — estilo context switcher premium */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="inline-flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition-all text-sm font-medium text-slate-700 shadow-sm"
      >
        <span
          className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white"
          style={{ backgroundColor: selectedColor || '#94a3b8' }}
        />
        <span className="font-semibold">{selectedLabel}</span>
        <div className="ml-1 p-0.5 rounded-md bg-slate-200/60">
          <ChevronDown className={`h-3 w-3 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-lg border border-slate-200 z-50 py-1.5">
          {/* Todas */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={`flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm transition-colors ${
              lineaFiltroGlobal === null
                ? 'bg-teal-50 text-teal-700 font-medium'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 flex-shrink-0" />
            <span className="flex-1">Todas las líneas</span>
            {lineaFiltroGlobal === null && (
              <Check className="h-4 w-4 text-teal-600 flex-shrink-0" />
            )}
          </button>

          <div className="border-t border-slate-100 my-1" />

          {/* Líneas */}
          {lineasActivas.map(linea => {
            const isSelected = lineaFiltroGlobal === linea.id;
            return (
              <button
                key={linea.id}
                type="button"
                onClick={() => handleSelect(linea.id)}
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm transition-colors ${
                  isSelected
                    ? 'bg-teal-50 text-teal-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: linea.color }}
                />
                <span className="flex-1 truncate">
                  {linea.icono ? `${linea.icono} ` : ''}{linea.nombre}
                </span>
                {isSelected && (
                  <Check className="h-4 w-4 text-teal-600 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
