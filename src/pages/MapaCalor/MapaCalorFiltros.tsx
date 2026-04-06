import { Flame, Layers, MapPin } from 'lucide-react';
import { useMapaCalorStore } from '../../store/mapaCalorStore';
import { LineaFilterInline } from '../../components/common/LineaFilterInline';
import type { PeriodoPresetMapa, CapaMapa } from '../../types/mapaCalor.types';

const PERIODOS: { id: PeriodoPresetMapa; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: '7d' },
  { id: 'mes', label: '30d' },
  { id: '3meses', label: '3m' },
  { id: '6meses', label: '6m' },
  { id: 'todo', label: 'Todo' },
];

const CAPAS: { id: CapaMapa; label: string; icon: React.ReactNode }[] = [
  { id: 'heatmap', label: 'Calor', icon: <Flame className="h-3.5 w-3.5" /> },
  { id: 'clusters', label: 'Clusters', icon: <Layers className="h-3.5 w-3.5" /> },
  { id: 'marcadores', label: 'Puntos', icon: <MapPin className="h-3.5 w-3.5" /> },
];

export function MapaCalorFiltros() {
  const { filtros, capaActiva, setPeriodo, setCapa } = useMapaCalorStore();

  return (
    <div className="space-y-3">
      {/* Línea de negocio */}
      <LineaFilterInline />

      <div className="flex flex-wrap items-center gap-3">
        {/* Periodo */}
        <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1">
          {PERIODOS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodo(p.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filtros.periodoPreset === p.id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Capa del mapa */}
        <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1">
          {CAPAS.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCapa(c.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                capaActiva === c.id
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {c.icon}
              <span className="hidden sm:inline">{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
