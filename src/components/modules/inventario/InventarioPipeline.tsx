import React from 'react';
import {
  Package,
  Plane,
  MapPin,
  ShoppingCart,
  AlertTriangle,
  Clock
} from 'lucide-react';

export interface PipelineStats {
  recibidaUSA: number;
  enTransito: number;
  disponiblePeru: number;
  reservada: number;
  problemas: number;
  total: number;
  valorTotalUSD: number;
}

interface InventarioPipelineProps {
  stats: PipelineStats;
  filtroActivo: string | null;
  onFiltroChange: (filtro: string | null) => void;
}

interface PipelineStage {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  count: number;
  color: string;
  bgColor: string;
  borderColor: string;
  hoverColor: string;
}

export const InventarioPipeline: React.FC<InventarioPipelineProps> = ({
  stats,
  filtroActivo,
  onFiltroChange
}) => {
  const stages: PipelineStage[] = [
    {
      id: 'recibida_usa',
      label: 'En USA',
      sublabel: 'Recibidas',
      icon: <Package className="h-5 w-5" />,
      count: stats.recibidaUSA,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      hoverColor: 'hover:bg-blue-100'
    },
    {
      id: 'en_transito',
      label: 'En Tránsito',
      sublabel: 'USA → Perú',
      icon: <Plane className="h-5 w-5" />,
      count: stats.enTransito,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      hoverColor: 'hover:bg-amber-100'
    },
    {
      id: 'disponible_peru',
      label: 'En Perú',
      sublabel: 'Disponibles',
      icon: <MapPin className="h-5 w-5" />,
      count: stats.disponiblePeru,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      hoverColor: 'hover:bg-green-100'
    },
    {
      id: 'reservada',
      label: 'Reservadas',
      sublabel: 'Para venta',
      icon: <ShoppingCart className="h-5 w-5" />,
      count: stats.reservada,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      hoverColor: 'hover:bg-purple-100'
    },
    {
      id: 'problemas',
      label: 'Problemas',
      sublabel: 'Vencidas/Dañadas',
      icon: <AlertTriangle className="h-5 w-5" />,
      count: stats.problemas,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      hoverColor: 'hover:bg-red-100'
    }
  ];

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header con totales */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Pipeline de Inventario</h2>
          <p className="text-sm text-gray-500">Estado actual de las unidades</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">unidades totales</div>
          <div className="text-sm font-medium text-green-600">
            {formatCurrency(stats.valorTotalUSD)} USD
          </div>
        </div>
      </div>

      {/* Pipeline visual */}
      <div className="flex items-stretch gap-2">
        {stages.map((stage, index) => {
          const isActive = filtroActivo === stage.id;
          const hasUnits = stage.count > 0;

          return (
            <React.Fragment key={stage.id}>
              {/* Stage card */}
              <button
                onClick={() => onFiltroChange(isActive ? null : stage.id)}
                disabled={!hasUnits}
                className={`
                  flex-1 relative p-4 rounded-lg border-2 transition-all duration-200
                  ${isActive
                    ? `${stage.bgColor} ${stage.borderColor} ring-2 ring-offset-2 ring-${stage.color.replace('text-', '')}`
                    : hasUnits
                      ? `bg-white border-gray-200 ${stage.hoverColor} cursor-pointer`
                      : 'bg-gray-50 border-gray-100 cursor-not-allowed opacity-50'
                  }
                `}
              >
                {/* Icon y label */}
                <div className="flex flex-col items-center text-center">
                  <div className={`mb-2 ${isActive ? stage.color : hasUnits ? 'text-gray-400' : 'text-gray-300'}`}>
                    {stage.icon}
                  </div>
                  <div className={`text-xs font-medium ${isActive ? stage.color : 'text-gray-600'}`}>
                    {stage.label}
                  </div>
                  <div className="text-xs text-gray-400">{stage.sublabel}</div>
                  <div className={`mt-2 text-2xl font-bold ${isActive ? stage.color : 'text-gray-900'}`}>
                    {stage.count}
                  </div>
                </div>

                {/* Indicador activo */}
                {isActive && (
                  <div className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-3 rotate-45 ${stage.bgColor} border-b-2 border-r-2 ${stage.borderColor}`}></div>
                )}
              </button>

              {/* Flecha entre stages */}
              {index < stages.length - 1 && (
                <div className="flex items-center justify-center w-6">
                  <div className="w-full h-0.5 bg-gray-200 relative">
                    <div className="absolute right-0 top-1/2 transform -translate-y-1/2 border-t-4 border-b-4 border-l-6 border-transparent border-l-gray-300"></div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Botón limpiar filtro */}
      {filtroActivo && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => onFiltroChange(null)}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Limpiar filtro
          </button>
        </div>
      )}
    </div>
  );
};
