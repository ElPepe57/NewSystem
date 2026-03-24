import React from 'react';
import { Package, AlertTriangle, Search, Layers } from 'lucide-react';

interface FiltroRapidoItem {
  id: string;
  label: string;
  labelCorto: string;
  icon: React.ElementType;
  count: number;
  color: string;
  activeColor: string;
}

interface FiltrosRapidosProps {
  totalProductos: number;
  activos: number;
  stockCritico: number;
  sinInvestigar: number;
  activeFilter: string | null;
  onFilter: (filterId: string | null) => void;
}

export const FiltrosRapidos: React.FC<FiltrosRapidosProps> = ({
  totalProductos,
  activos,
  stockCritico,
  sinInvestigar,
  activeFilter,
  onFilter,
}) => {
  const filtros: FiltroRapidoItem[] = [
    {
      id: 'todos',
      label: 'Todos',
      labelCorto: 'Todos',
      icon: Layers,
      count: totalProductos,
      color: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
      activeColor: 'bg-primary-100 text-primary-700 ring-1 ring-primary-300',
    },
    {
      id: 'activos',
      label: 'Activos',
      labelCorto: 'Activos',
      icon: Package,
      count: activos,
      color: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
      activeColor: 'bg-green-100 text-green-700 ring-1 ring-green-300',
    },
    {
      id: 'stock_critico',
      label: 'Stock Crítico',
      labelCorto: 'Crítico',
      icon: AlertTriangle,
      count: stockCritico,
      color: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
      activeColor: 'bg-red-100 text-red-700 ring-1 ring-red-300',
    },
    {
      id: 'sin_investigar',
      label: 'Sin Investigar',
      labelCorto: 'Sin Inv.',
      icon: Search,
      count: sinInvestigar,
      color: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
      activeColor: 'bg-amber-100 text-amber-700 ring-1 ring-amber-300',
    },
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
      {filtros.map(f => {
        const Icon = f.icon;
        const isActive = activeFilter === f.id || (activeFilter === null && f.id === 'todos');
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilter(f.id === 'todos' ? null : f.id)}
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
              isActive ? f.activeColor : f.color
            }`}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{f.label}</span>
            <span className="sm:hidden">{f.labelCorto}</span>
            <span className={`ml-0.5 text-[10px] sm:text-xs ${isActive ? 'opacity-80' : 'opacity-50'}`}>
              {f.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
