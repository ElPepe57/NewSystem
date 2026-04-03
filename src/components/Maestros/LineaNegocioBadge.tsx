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
