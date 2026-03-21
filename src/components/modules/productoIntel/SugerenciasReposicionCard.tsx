import React from 'react';
import { ShoppingCart, AlertTriangle, TrendingUp, Clock, DollarSign } from 'lucide-react';
import type { SugerenciaReposicion } from '../../../types/productoIntel.types';
import { formatCurrencyCompact } from '../../../utils/format';

interface SugerenciasReposicionCardProps {
  sugerencias: SugerenciaReposicion[];
  maxItems?: number;
  onVerTodas?: () => void;
  onProductoClick?: (productoId: string) => void;
}

// Alias con default PEN para preservar comportamiento anterior
const formatCurrency = (value: number, currency: 'PEN' | 'USD' = 'PEN'): string =>
  formatCurrencyCompact(value, currency);

const urgenciaConfig = {
  critica: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-200',
    label: 'Critica'
  },
  alta: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-200',
    label: 'Alta'
  },
  media: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    label: 'Media'
  },
  baja: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-200',
    label: 'Baja'
  }
};

export const SugerenciasReposicionCard: React.FC<SugerenciasReposicionCardProps> = ({
  sugerencias,
  maxItems = 5,
  onVerTodas,
  onProductoClick
}) => {
  const displayItems = sugerencias.slice(0, maxItems);
  const hasMore = sugerencias.length > maxItems;

  // Calcular totales
  const totalInversion = sugerencias.reduce((sum, s) => sum + s.inversionEstimadaUSD, 0);
  const totalUtilidad = sugerencias.reduce((sum, s) => sum + s.utilidadProyectadaPEN, 0);
  const sugerenciasCriticas = sugerencias.filter(s => s.urgencia === 'critica').length;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-100 rounded-lg">
            <ShoppingCart className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Sugerencias de Reposicion</h3>
            <p className="text-xs text-gray-500">Productos a comprar ordenados por prioridad</p>
          </div>
        </div>
        {sugerenciasCriticas > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
            <AlertTriangle className="h-3 w-3" />
            {sugerenciasCriticas} criticas
          </span>
        )}
      </div>

      {/* Resumen rapido */}
      <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-gray-100">
        <div className="text-center">
          <p className="text-xs text-gray-500">Productos</p>
          <p className="text-lg font-bold text-gray-900">{sugerencias.length}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Inversion Est.</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalInversion, 'USD')}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Utilidad Proy.</p>
          <p className="text-lg font-bold text-green-600">{formatCurrency(totalUtilidad)}</p>
        </div>
      </div>

      {/* Lista de sugerencias */}
      {sugerencias.length === 0 ? (
        <div className="text-center py-6">
          <ShoppingCart className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No hay sugerencias de reposicion</p>
          <p className="text-xs text-gray-400">Todos los productos tienen stock suficiente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayItems.map((sugerencia, index) => {
            const config = urgenciaConfig[sugerencia.urgencia];

            return (
              <div
                key={sugerencia.productoId}
                className={`
                  border ${config.border} rounded-lg p-3
                  ${onProductoClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
                `}
                onClick={() => onProductoClick?.(sugerencia.productoId)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-400">#{index + 1}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${config.bg} ${config.text}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 truncate mt-1" title={sugerencia.nombreComercial}>
                      {sugerencia.nombreComercial}
                    </p>
                    <p className="text-xs text-gray-500">{sugerencia.sku} - {sugerencia.marca}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-purple-600">
                      +{sugerencia.cantidadSugerida}
                    </p>
                    <p className="text-xs text-gray-500">unidades</p>
                  </div>
                </div>

                <p className="text-xs text-gray-600 mb-2">{sugerencia.razon}</p>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-xs text-gray-400">Stock</p>
                    <p className="text-sm font-medium text-gray-700">{sugerencia.stockActual}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Quiebre</p>
                    <p className="text-sm font-medium text-gray-700">
                      {sugerencia.diasParaQuiebre < 999 ? `${sugerencia.diasParaQuiebre}d` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Inversion</p>
                    <p className="text-sm font-medium text-gray-700">
                      {formatCurrency(sugerencia.inversionEstimadaUSD, 'USD')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Utilidad</p>
                    <p className="text-sm font-medium text-green-600">
                      {formatCurrency(sugerencia.utilidadProyectadaPEN)}
                    </p>
                  </div>
                </div>

                {sugerencia.tiempoRecuperacionDias < 999 && (
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span>Recuperacion estimada: {sugerencia.tiempoRecuperacionDias} dias</span>
                  </div>
                )}
              </div>
            );
          })}

          {hasMore && (
            <button
              onClick={onVerTodas}
              className="w-full text-center text-sm text-purple-600 hover:text-purple-800 py-2 border border-dashed border-gray-200 rounded-lg hover:border-purple-300 transition-colors"
            >
              Ver {sugerencias.length - maxItems} sugerencias mas...
            </button>
          )}
        </div>
      )}
    </div>
  );
};
