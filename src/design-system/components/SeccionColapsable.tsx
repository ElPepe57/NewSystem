/**
 * SeccionColapsable · átomo reutilizable para wizards V2
 *
 * Mockup canónico: docs/mockups/productos/17-wizard-crear-simple.html (4 secciones)
 *
 * Diseño:
 *   - Estado expandido: border-2 border-{tone}-200 + bg-{tone}-50/50 en header
 *   - Estado colapsado: border slate-200 + hover bg-slate-50
 *   - Header: número en círculo + título bold + subtítulo + chevron
 *   - Tone semántico: teal (default activo) · slate (inactivo)
 */

import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface SeccionColapsableProps {
  numero: number;
  titulo: string;
  subtitulo?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  /** tone "active" cuando expanded · "inactive" colapsada · "complete" si ya tiene datos válidos */
  estado?: 'active' | 'inactive' | 'complete';
}

const ESTADO_STYLES = {
  active: {
    container: 'border-2 border-teal-200',
    header: 'bg-teal-50/50',
    badge: 'bg-teal-600 text-white',
    titleColor: 'text-teal-900',
    subColor: 'text-teal-700',
    chevronColor: 'text-teal-700',
  },
  complete: {
    container: 'border-2 border-emerald-200',
    header: 'bg-emerald-50/50 hover:bg-emerald-50',
    badge: 'bg-emerald-600 text-white',
    titleColor: 'text-emerald-900',
    subColor: 'text-emerald-700',
    chevronColor: 'text-emerald-700',
  },
  inactive: {
    container: 'border border-slate-200',
    header: 'hover:bg-slate-50',
    badge: 'bg-slate-200 text-slate-600',
    titleColor: 'text-slate-700',
    subColor: 'text-slate-500',
    chevronColor: 'text-slate-400',
  },
};

export const SeccionColapsable: React.FC<SeccionColapsableProps> = ({
  numero,
  titulo,
  subtitulo,
  expanded,
  onToggle,
  children,
  estado,
}) => {
  const effectiveEstado = estado ?? (expanded ? 'active' : 'inactive');
  const styles = ESTADO_STYLES[effectiveEstado];

  return (
    <div className={`rounded-xl overflow-hidden transition-all ${styles.container}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${styles.header}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${styles.badge}`}
          >
            {numero}
          </span>
          <span className={`text-sm font-bold ${styles.titleColor}`}>{titulo}</span>
          {subtitulo && (
            <span className={`text-[10px] ${styles.subColor} hidden sm:inline truncate`}>{subtitulo}</span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className={`w-4 h-4 ${styles.chevronColor} flex-shrink-0`} />
        ) : (
          <ChevronDown className={`w-4 h-4 ${styles.chevronColor} flex-shrink-0`} />
        )}
      </button>
      {expanded && <div className="px-4 py-4 space-y-3 border-t border-slate-100 bg-white">{children}</div>}
    </div>
  );
};
