import React from 'react';
import { Truck, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import type { MetricasLeadTime } from '../../../types/productoIntel.types';

interface LeadTimeCardProps {
  leadTime: MetricasLeadTime;
}

export const LeadTimeCard: React.FC<LeadTimeCardProps> = ({ leadTime }) => {
  const formatFecha = (fecha: Date): string => {
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(fecha);
  };

  // Determinar si el lead time es bueno, normal o malo
  const getLeadTimeStatus = (dias: number): { color: string; label: string } => {
    if (dias <= 20) return { color: 'green', label: 'Excelente' };
    if (dias <= 35) return { color: 'yellow', label: 'Normal' };
    if (dias <= 50) return { color: 'orange', label: 'Lento' };
    return { color: 'red', label: 'Muy lento' };
  };

  const status = getLeadTimeStatus(leadTime.tiempoPromedioTotal);

  const colorClasses = {
    green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
    red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' }
  };

  const colors = colorClasses[status.color as keyof typeof colorClasses];

  if (leadTime.ordenesAnalizadas === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Truck className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Lead Time Promedio</h3>
            <p className="text-xs text-gray-500">Tiempo de compra a recepcion</p>
          </div>
        </div>
        <div className="text-center py-6">
          <Clock className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Sin datos suficientes</p>
          <p className="text-xs text-gray-400">Se necesitan OC completadas para calcular</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Truck className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Lead Time Promedio</h3>
            <p className="text-xs text-gray-500">Tiempo de compra a recepcion</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
          {status.label}
        </span>
      </div>

      {/* Tiempo total destacado */}
      <div className={`rounded-lg p-4 mb-4 ${colors.bg} border ${colors.border}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Tiempo Total Promedio</p>
            <p className={`text-3xl font-bold ${colors.text}`}>
              {leadTime.tiempoPromedioTotal} dias
            </p>
          </div>
          <div className={`p-3 rounded-full bg-white/50`}>
            <Clock className={`h-6 w-6 ${colors.text}`} />
          </div>
        </div>
      </div>

      {/* Desglose de tiempos */}
      <div className="space-y-3 mb-4">
        <h4 className="text-xs font-medium text-gray-500 uppercase">Desglose Estimado</h4>

        {/* Compra a envio */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
            <span className="text-sm text-gray-600">Compra → Envio</span>
          </div>
          <span className="font-medium text-gray-900">{leadTime.tiempoPromedioCompraEnvio}d</span>
        </div>

        {/* Transito USA */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-400"></div>
            <span className="text-sm text-gray-600">Transito USA</span>
          </div>
          <span className="font-medium text-gray-900">{leadTime.tiempoPromedioTransitoUSA}d</span>
        </div>

        {/* USA a Peru */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <span className="text-sm text-gray-600">USA → Peru</span>
          </div>
          <span className="font-medium text-gray-900">{leadTime.tiempoPromedioUSAPeru}d</span>
        </div>
      </div>

      {/* Barra visual */}
      <div className="h-2 flex rounded-full overflow-hidden bg-gray-100 mb-4">
        <div
          className="bg-blue-400"
          style={{ width: `${(leadTime.tiempoPromedioCompraEnvio / leadTime.tiempoPromedioTotal) * 100}%` }}
        />
        <div
          className="bg-purple-400"
          style={{ width: `${(leadTime.tiempoPromedioTransitoUSA / leadTime.tiempoPromedioTotal) * 100}%` }}
        />
        <div
          className="bg-green-400"
          style={{ width: `${(leadTime.tiempoPromedioUSAPeru / leadTime.tiempoPromedioTotal) * 100}%` }}
        />
      </div>

      {/* Estadisticas adicionales */}
      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100">
        <div className="text-center">
          <p className="text-xs text-gray-500">Minimo</p>
          <p className="font-semibold text-gray-900">{leadTime.tiempoMinimo}d</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Maximo</p>
          <p className="font-semibold text-gray-900">{leadTime.tiempoMaximo}d</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Desviacion</p>
          <p className="font-semibold text-gray-900">±{leadTime.desviacionEstandar}d</p>
        </div>
      </div>

      {/* Metadata */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Basado en {leadTime.ordenesAnalizadas} ordenes completadas
          {leadTime.periodoAnalisis && (
            <span className="ml-1">
              ({formatFecha(leadTime.periodoAnalisis.desde)} - {formatFecha(leadTime.periodoAnalisis.hasta)})
            </span>
          )}
        </p>
      </div>
    </div>
  );
};
