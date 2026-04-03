/**
 * Componentes reutilizables de Línea de Negocio para Gestión de Maestros
 * - LineaNegocioBadges: muestra badges de líneas asignadas
 * - LineaNegocioFilter: select para filtrar por línea
 */
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';

/** Muestra badges de las líneas de negocio asignadas a una entidad */
export const LineaNegocioBadges: React.FC<{ lineaIds?: string[] }> = ({ lineaIds }) => {
  const { lineas } = useLineaNegocioStore();

  if (!lineaIds || lineaIds.length === 0) {
    return <span className="text-xs text-gray-400 italic">Sin asignar</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {lineaIds.map(id => {
        const linea = lineas.find(l => l.id === id);
        return linea ? (
          <span
            key={id}
            className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-indigo-100 text-indigo-700"
          >
            {linea.nombre}
          </span>
        ) : null;
      })}
    </div>
  );
};

/** Checkboxes multi-select para asignar líneas de negocio en formularios */
export const LineaNegocioCheckboxes: React.FC<{
  value: string[];
  onChange: (ids: string[]) => void;
}> = ({ value, onChange }) => {
  const { lineasActivas } = useLineaNegocioStore();

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Línea de Negocio
      </label>
      <div className="flex flex-wrap gap-2">
        {lineasActivas.map(l => (
          <button
            key={l.id}
            type="button"
            onClick={() => toggle(l.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              value.includes(l.id)
                ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            }`}
          >
            {value.includes(l.id) && '✓ '}{l.nombre}
          </button>
        ))}
      </div>
      {value.length === 0 && (
        <p className="text-xs text-amber-600 mt-1">Sin línea asignada — se mostrará en todas</p>
      )}
    </div>
  );
};

/** Select para filtrar por línea de negocio */
export const LineaNegocioSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  className?: string;
}> = ({ value, onChange, className = '' }) => {
  const { lineasActivas } = useLineaNegocioStore();

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${className}`}
    >
      <option value="todos">Todas las líneas</option>
      {lineasActivas.map(l => (
        <option key={l.id} value={l.id}>{l.nombre}</option>
      ))}
    </select>
  );
};
