import React from 'react';
import { Share2 } from 'lucide-react';
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';

/**
 * Badge para mostrar la línea de negocio de un registro.
 * Usa el color y ícono de la línea para una identificación visual rápida.
 */
export const LineaNegocioBadge: React.FC<{
  lineaNegocioId?: string | null;
  size?: 'sm' | 'md';
}> = ({ lineaNegocioId, size = 'sm' }) => {
  const lineas = useLineaNegocioStore(state => state.lineas);

  if (!lineaNegocioId) return null;

  const linea = lineas.find(l => l.id === lineaNegocioId);
  if (!linea) return null;

  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses}`}
      style={{ backgroundColor: `${linea.color}20`, color: linea.color }}
    >
      {linea.icono && <span>{linea.icono}</span>}
      {linea.nombre}
    </span>
  );
};

/**
 * Badge "Compartido" para gastos que no pertenecen a ninguna línea de negocio.
 * Se muestra en gris con un ícono de compartir.
 */
export const CompartidoBadge: React.FC<{
  size?: 'sm' | 'md';
}> = ({ size = 'sm' }) => {
  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-gray-100 text-gray-600 ${sizeClasses}`}>
      <Share2 className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      Compartido
    </span>
  );
};

/**
 * Badge para gastos que muestra línea de negocio o "Compartido" si no tiene.
 */
export const GastoLineaBadge: React.FC<{
  lineaNegocioId?: string | null;
  size?: 'sm' | 'md';
}> = ({ lineaNegocioId, size = 'sm' }) => {
  if (lineaNegocioId) {
    return <LineaNegocioBadge lineaNegocioId={lineaNegocioId} size={size} />;
  }
  return <CompartidoBadge size={size} />;
};

/**
 * Badge para mostrar el país de origen de un registro.
 */
export const PaisOrigenBadge: React.FC<{
  paisOrigen?: string | null;
  size?: 'sm' | 'md';
}> = ({ paisOrigen, size = 'sm' }) => {
  if (!paisOrigen) return null;

  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-gray-100 text-gray-700 ${sizeClasses}`}>
      🌐 {paisOrigen}
    </span>
  );
};

/**
 * Banner/chip para indicar el filtro global de línea activo en el Dashboard.
 */
export const LineaFiltroActivoBanner: React.FC<{
  onClear: () => void;
}> = ({ onClear }) => {
  const lineaFiltroGlobal = useLineaNegocioStore(state => state.lineaFiltroGlobal);
  const lineas = useLineaNegocioStore(state => state.lineas);

  if (!lineaFiltroGlobal) return null;

  const linea = lineas.find(l => l.id === lineaFiltroGlobal);
  if (!linea) return null;

  return (
    <div
      className="flex items-center justify-between px-4 py-2 rounded-lg border"
      style={{
        backgroundColor: `${linea.color}10`,
        borderColor: `${linea.color}30`
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Mostrando:</span>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold"
          style={{ backgroundColor: `${linea.color}20`, color: linea.color }}
        >
          {linea.icono && <span>{linea.icono}</span>}
          {linea.nombre}
        </span>
      </div>
      <button
        onClick={onClear}
        className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200"
        title="Mostrar todas las líneas"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};
