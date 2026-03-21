import React from 'react';
import {
  AlertTriangle,
  ShoppingCart,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Plus,
  Link2,
  ArrowRight
} from 'lucide-react';
import { Button, Card } from '../../components/common';
import { formatCurrency } from '../../utils/format';
import type { SugerenciaStock, RequerimientosStats } from './requerimientos.types';
import type { Venta } from '../../types/venta.types';

interface ExpandedSections {
  alertas: boolean;
  sugerencias: boolean;
  cotizaciones: boolean;
}

interface IntelligencePanelProps {
  sugerenciasStock: SugerenciaStock[];
  cotizacionesConfirmadas: Venta[];
  stats: RequerimientosStats;
  tcDelDia: { venta: number; compra: number } | null;
  expandedSections: ExpandedSections;
  onToggleSection: (section: keyof ExpandedSections) => void;
  onCrearDesdeSugerencia: (sug: SugerenciaStock) => void;
  onVerTodasSugerencias: () => void;
  onVincularOC: (venta: Venta) => void;
  onCrearDesdeCotizacion: (venta: Venta) => void;
  onVerTodasCotizaciones: () => void;
}

export const IntelligencePanel: React.FC<IntelligencePanelProps> = ({
  sugerenciasStock,
  cotizacionesConfirmadas,
  stats,
  tcDelDia,
  expandedSections,
  onToggleSection,
  onCrearDesdeSugerencia,
  onVerTodasSugerencias,
  onVincularOC,
  onCrearDesdeCotizacion,
  onVerTodasCotizaciones
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Alertas de Stock */}
      <Card padding="none" className="overflow-hidden">
        <div
          className="px-4 py-3 bg-orange-50 border-b border-orange-200 flex items-center justify-between cursor-pointer"
          onClick={() => onToggleSection('alertas')}
        >
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
            <span className="font-semibold text-orange-900">Alertas de Stock</span>
            <span className="ml-2 bg-orange-200 text-orange-800 text-xs px-2 py-0.5 rounded-full">
              {sugerenciasStock.length}
            </span>
          </div>
          {expandedSections.alertas ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
        {expandedSections.alertas && (
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {sugerenciasStock.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No hay alertas de stock bajo
              </div>
            ) : (
              sugerenciasStock.slice(0, 5).map((sug, idx) => (
                <div key={idx} className="p-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <span className={`w-2 h-2 rounded-full mr-2 ${
                          sug.urgencia === 'critica' ? 'bg-red-500' :
                          sug.urgencia === 'alta' ? 'bg-orange-500' : 'bg-yellow-500'
                        }`} />
                        <span className="font-medium text-sm truncate">
                          {sug.producto.nombreComercial}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Stock: {sug.stockActual} / Min: {sug.stockMinimo}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCrearDesdeSugerencia(sug)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            {sugerenciasStock.length > 5 && (
              <button
                onClick={onVerTodasSugerencias}
                className="w-full p-3 text-center text-sm text-primary-600 hover:bg-primary-50 font-medium"
              >
                Ver todas ({sugerenciasStock.length})
              </button>
            )}
          </div>
        )}
      </Card>

      {/* Cotizaciones Pendientes */}
      <Card padding="none" className="overflow-hidden">
        <div
          className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between cursor-pointer"
          onClick={() => onToggleSection('cotizaciones')}
        >
          <div className="flex items-center">
            <ShoppingCart className="h-5 w-5 text-blue-500 mr-2" />
            <span className="font-semibold text-blue-900">Cotizaciones con Faltante</span>
            <span className="ml-2 bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full">
              {cotizacionesConfirmadas.length}
            </span>
          </div>
          {expandedSections.cotizaciones ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
        {expandedSections.cotizaciones && (
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {cotizacionesConfirmadas.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No hay cotizaciones pendientes
              </div>
            ) : (
              cotizacionesConfirmadas.slice(0, 5).map((venta) => (
                <div key={venta.id} className="p-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {venta.nombreCliente}
                      </div>
                      <div className="text-xs text-gray-500">
                        {venta.numeroVenta} • {venta.productos.length} productos
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onVincularOC(venta)}
                        title="Vincular con OC existente"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCrearDesdeCotizacion(venta)}
                        title="Crear requerimiento nuevo"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
            {cotizacionesConfirmadas.length > 5 && (
              <button
                onClick={onVerTodasCotizaciones}
                className="w-full p-3 text-center text-sm text-primary-600 hover:bg-primary-50 font-medium"
              >
                Ver todas ({cotizacionesConfirmadas.length})
              </button>
            )}
          </div>
        )}
      </Card>

      {/* Metricas de Precision */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-4 py-3 bg-green-50 border-b border-green-200 flex items-center">
          <BarChart3 className="h-5 w-5 text-green-500 mr-2" />
          <span className="font-semibold text-green-900">Metricas de Compras</span>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">TC Actual</span>
              <span className="font-semibold">S/ {tcDelDia?.venta?.toFixed(3) || '3.700'}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Total por aprobar</span>
              <span className="font-semibold">{formatCurrency(stats.costoEstimadoPendiente)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">En soles (aprox)</span>
              <span className="font-semibold text-gray-900">
                S/ {(stats.costoEstimadoPendiente * (tcDelDia?.venta || 3.70)).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t">
            <div className="text-xs text-gray-500 mb-2">Ciclo promedio</div>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-900">7</span>
              <span className="text-sm text-gray-500 ml-1">dias</span>
            </div>
            <div className="text-xs text-gray-500">desde requerimiento hasta recepcion</div>
          </div>
        </div>
      </Card>
    </div>
  );
};
