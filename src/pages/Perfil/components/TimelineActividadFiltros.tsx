/**
 * TimelineActividadFiltros · F10.F.1.O · 2026-05-27
 *
 * Filtros chip scroll-x para el timeline de actividad reciente.
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 10 (líneas 1109-1117).
 *
 * Patrón canon v8.0 N6 · scroll horizontal en mobile · sin wrap.
 *
 * Estructura:
 *   - Span "Módulo:" uppercase
 *   - Chip "Todos · N" (active por default · bg-slate-900 text-white)
 *   - Chip por cada módulo · bg-white border · clickable
 *
 * Uso:
 *   <TimelineActividadFiltros
 *     filtroActivo={filtro}
 *     onFiltroChange={setFiltro}
 *     contadores={{ todos: 27, ventas: 8, planilla: 4 }}
 *   />
 */
import React from 'react';

interface Props {
  /** Filtro actualmente activo · '' = todos */
  filtroActivo: string;
  /** Callback al cambiar de filtro */
  onFiltroChange: (filtro: string) => void;
  /** Contadores por módulo · key='todos' es obligatorio */
  contadores: Record<string, number>;
}

// Orden y labels canon · debe coincidir con módulos del sistema
const MODULOS: Array<{ id: string; label: string }> = [
  { id: '', label: 'Todos' }, // siempre primero · '' = sin filtro
  { id: 'ventas', label: 'Ventas' },
  { id: 'compras', label: 'Compras' },
  { id: 'planilla', label: 'Planilla' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'finanzas', label: 'Finanzas' },
  { id: 'configuracion', label: 'Configuración' },
];

export const TimelineActividadFiltros: React.FC<Props> = ({
  filtroActivo,
  onFiltroChange,
  contadores,
}) => {
  const total = contadores.todos || 0;

  return (
    // Canon mockup ACTO 10 · línea 1109 · copy-paste literal
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex-shrink-0">
        Módulo:
      </span>
      {MODULOS.map((m) => {
        const count = m.id === '' ? total : contadores[m.id] || 0;
        const isActive = filtroActivo === m.id;
        // Ocultar módulos sin actividad (excepto "Todos")
        if (m.id !== '' && count === 0) return null;
        return (
          <button
            key={m.id || 'todos'}
            type="button"
            onClick={() => onFiltroChange(m.id)}
            className={`${
              isActive
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            } text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap transition-colors`}
          >
            {m.label}
            {count > 0 && <span className="ml-1 tabular-nums">· {count}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default TimelineActividadFiltros;
