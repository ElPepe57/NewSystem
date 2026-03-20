import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useLineaNegocioStore } from '../../../store/lineaNegocioStore';

/**
 * Selector global de Línea de Negocio.
 * Se muestra en el sidebar y permite filtrar todo el ERP
 * por una línea específica o ver todas.
 */
export const LineaNegocioSelector: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const lineasActivas = useLineaNegocioStore(s => s.lineasActivas);
  const lineaFiltroGlobal = useLineaNegocioStore(s => s.lineaFiltroGlobal);
  const setLineaFiltroGlobal = useLineaNegocioStore(s => s.setLineaFiltroGlobal);

  // Derivar label y color de la línea seleccionada
  const selectedLinea = lineasActivas.find(l => l.id === lineaFiltroGlobal);
  const selectedLabel = selectedLinea ? `${selectedLinea.icono || ''} ${selectedLinea.nombre}`.trim() : 'Todas las líneas';
  const selectedColor = selectedLinea?.color || '#6B7280';

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cerrar con Escape
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

  // No renderizar si no hay líneas cargadas
  if (lineasActivas.length === 0) return null;

  return (
    <div ref={ref} className="relative mx-3 mt-3">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/40 hover:bg-gray-800/70 border border-gray-700/30 hover:border-gray-600/50 w-full transition-all duration-150"
      >
        <span
          className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/10"
          style={{ backgroundColor: selectedColor }}
        />
        <span className="text-sm font-medium text-gray-200 truncate flex-1 text-left">
          {selectedLabel}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-xl border border-gray-700/50 z-50 py-1 max-h-64 overflow-y-auto">
          {/* Opción "Todas" */}
          <button
            onClick={() => handleSelect(null)}
            className={`flex items-center gap-2 w-full px-3 py-2 text-left transition-colors duration-100
              ${lineaFiltroGlobal === null
                ? 'bg-primary-600/20 text-primary-300'
                : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
              }`}
          >
            <span className="w-3 h-3 rounded-full bg-gray-500 flex-shrink-0" />
            <span className="text-sm font-medium flex-1">Todas las líneas</span>
            {lineaFiltroGlobal === null && (
              <Check className="h-4 w-4 text-primary-400 flex-shrink-0" />
            )}
          </button>

          {/* Separador */}
          <div className="border-t border-gray-700/50 my-1" />

          {/* Líneas activas */}
          {lineasActivas.map(linea => {
            const isSelected = lineaFiltroGlobal === linea.id;
            return (
              <button
                key={linea.id}
                onClick={() => handleSelect(linea.id)}
                className={`flex items-center gap-2 w-full px-3 py-2 text-left transition-colors duration-100
                  ${isSelected
                    ? 'bg-primary-600/20 text-primary-300'
                    : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
                  }`}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: linea.color }}
                />
                <span className="text-sm font-medium flex-1 truncate">
                  {linea.icono ? `${linea.icono} ` : ''}{linea.nombre}
                </span>
                {isSelected && (
                  <Check className="h-4 w-4 text-primary-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
