import React from 'react';
import { Search, LayoutGrid, List } from 'lucide-react';
import { Card, Select } from '../../components/common';

type VistaType = 'kanban' | 'lista';

interface CotizacionesFiltrosProps {
  busqueda: string;
  onBusquedaChange: (value: string) => void;
  filtroCanal: string;
  onFiltroCanalChange: (value: string) => void;
  vista: VistaType;
  onVistaChange: (vista: VistaType) => void;
}

export const CotizacionesFiltros: React.FC<CotizacionesFiltrosProps> = ({
  busqueda,
  onBusquedaChange,
  filtroCanal,
  onFiltroCanalChange,
  vista,
  onVistaChange
}) => {
  return (
    <Card padding="md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número, cliente o teléfono..."
              value={busqueda}
              onChange={(e) => onBusquedaChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <Select
            value={filtroCanal}
            onChange={(e) => onFiltroCanalChange(e.target.value)}
            options={[
              { value: '', label: 'Todos los canales' },
              { value: 'mercado_libre', label: 'Mercado Libre' },
              { value: 'directo', label: 'Directo' },
              { value: 'otro', label: 'Otro' }
            ]}
          />
        </div>

        <div className="flex items-center border rounded-lg overflow-hidden self-start sm:self-auto">
          <button
            onClick={() => onVistaChange('kanban')}
            className={`px-3 py-2 flex items-center gap-1 text-sm ${vista === 'kanban' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <LayoutGrid className="h-4 w-4" />
            Kanban
          </button>
          <button
            onClick={() => onVistaChange('lista')}
            className={`px-3 py-2 flex items-center gap-1 text-sm ${vista === 'lista' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <List className="h-4 w-4" />
            Lista
          </button>
        </div>
      </div>
    </Card>
  );
};
