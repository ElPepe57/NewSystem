import React from "react";
import { Search } from "lucide-react";
import type { TipoTransferencia, EstadoTransferencia } from "../../types/transferencia.types";

interface TransferenciaFiltersProps {
  activeTab: 'todas' | 'en_transito' | 'pendientes';
  filtroTipo: TipoTransferencia | 'todas';
  filtroEstado: EstadoTransferencia | 'todas';
  busqueda: string;
  totalTransferencias: number;
  totalEnTransito: number;
  totalPendientes: number;
  onTabChange: (tab: 'todas' | 'en_transito' | 'pendientes') => void;
  onFiltroTipoChange: (tipo: TipoTransferencia | 'todas') => void;
  onFiltroEstadoChange: (estado: EstadoTransferencia | 'todas') => void;
  onBusquedaChange: (busqueda: string) => void;
}

export const TransferenciaFilters: React.FC<TransferenciaFiltersProps> = ({
  activeTab,
  filtroTipo,
  filtroEstado,
  busqueda,
  totalTransferencias,
  totalEnTransito,
  totalPendientes,
  onTabChange,
  onFiltroTipoChange,
  onFiltroEstadoChange,
  onBusquedaChange,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto scrollbar-hide">
        <nav className="-mb-px flex space-x-4 sm:space-x-8">
          <button
            onClick={() => onTabChange('todas')}
            className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
              activeTab === 'todas'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Todas ({totalTransferencias})
          </button>
          <button
            onClick={() => onTabChange('en_transito')}
            className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
              activeTab === 'en_transito'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            En Transito ({totalEnTransito})
          </button>
          <button
            onClick={() => onTabChange('pendientes')}
            className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
              activeTab === 'pendientes'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pendientes ({totalPendientes})
          </button>
        </nav>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar..."
            value={busqueda}
            onChange={(e) => onBusquedaChange(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-48"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filtroTipo}
            onChange={(e) => onFiltroTipoChange(e.target.value as TipoTransferencia | 'todas')}
            className="flex-1 sm:flex-initial px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="todas">Todos los tipos</option>
            <option value="internacional_peru">Internacional → Peru</option>
            <option value="interna_origen">Interna Origen</option>
          </select>
          <select
            value={filtroEstado}
            onChange={(e) => onFiltroEstadoChange(e.target.value as EstadoTransferencia | 'todas')}
            className="flex-1 sm:flex-initial px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="todas">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="preparando">Preparando</option>
            <option value="en_transito">En Transito</option>
            <option value="recibida_parcial">Recibida Parcial</option>
            <option value="recibida_completa">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      </div>
    </div>
  );
};
