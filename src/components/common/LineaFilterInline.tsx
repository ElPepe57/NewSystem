import { useLineaNegocioStore } from '../../store/lineaNegocioStore';

export function LineaFilterInline() {
  const lineasActivas = useLineaNegocioStore(s => s.lineasActivas);
  const lineaFiltroGlobal = useLineaNegocioStore(s => s.lineaFiltroGlobal);
  const setLineaFiltroGlobal = useLineaNegocioStore(s => s.setLineaFiltroGlobal);

  if (lineasActivas.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Todas */}
      <button
        type="button"
        onClick={() => setLineaFiltroGlobal(null)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          lineaFiltroGlobal === null
            ? 'bg-gray-800 text-white'
            : 'bg-white text-gray-500 border border-gray-300 hover:bg-gray-50'
        }`}
      >
        Todas
      </button>

      {/* Líneas */}
      {lineasActivas.map(linea => {
        const isActive = lineaFiltroGlobal === linea.id;
        return (
          <button
            key={linea.id}
            type="button"
            onClick={() => setLineaFiltroGlobal(linea.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? 'text-white shadow-sm'
                : 'bg-white border border-gray-300 hover:bg-gray-50'
            }`}
            style={isActive ? { backgroundColor: linea.color } : { color: linea.color }}
          >
            {linea.icono && <span>{linea.icono}</span>}
            {linea.nombre}
          </button>
        );
      })}
    </div>
  );
}
