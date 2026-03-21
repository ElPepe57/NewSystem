import React from 'react';
import { Banknote, TrendingUp, TrendingDown, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import type { FlujoCajaProyectado } from '../../../types/productoIntel.types';
import { formatCurrencyCompact } from '../../../utils/format';

interface FlujoCajaCardProps {
  flujo: FlujoCajaProyectado;
}

const formatCurrency = (value: number): string => formatCurrencyCompact(value, 'PEN');

export const FlujoCajaCard: React.FC<FlujoCajaCardProps> = ({ flujo }) => {
  const flujoNeto = flujo.flujoNetoProyectado30d;
  const isPositivo = flujoNeto >= 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Banknote className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Flujo de Caja Proyectado</h3>
            <p className="text-xs text-gray-500">Basado en rotacion historica</p>
          </div>
        </div>
      </div>

      {/* Flujo neto destacado */}
      <div className={`
        rounded-lg p-4 mb-4
        ${isPositivo ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}
      `}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Flujo Neto (30 dias)</p>
            <p className={`text-2xl font-bold ${isPositivo ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(flujoNeto)}
            </p>
          </div>
          <div className={`p-3 rounded-full ${isPositivo ? 'bg-green-100' : 'bg-red-100'}`}>
            {isPositivo
              ? <TrendingUp className="h-6 w-6 text-green-600" />
              : <TrendingDown className="h-6 w-6 text-red-600" />
            }
          </div>
        </div>
        <p className={`text-xs mt-2 ${isPositivo ? 'text-green-600' : 'text-red-600'}`}>
          {isPositivo
            ? 'Se proyecta flujo positivo de caja'
            : 'Atencion: Se proyecta deficit de caja'}
        </p>
      </div>

      {/* Ingresos proyectados */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium text-gray-700">Ingresos Proyectados</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">7 dias</p>
            <p className="font-semibold text-green-700">{formatCurrency(flujo.ingresosProyectados7d)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">15 dias</p>
            <p className="font-semibold text-green-700">{formatCurrency(flujo.ingresosProyectados15d)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">30 dias</p>
            <p className="font-semibold text-green-700">{formatCurrency(flujo.ingresosProyectados30d)}</p>
          </div>
        </div>
      </div>

      {/* Caja por tipo */}
      <div className="space-y-3 mb-4 pb-4 border-b border-gray-100">
        {/* Caja confirmada */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm text-gray-600">Caja Confirmada</span>
          </div>
          <span className="font-medium text-green-600">{formatCurrency(flujo.cajaConfirmada)}</span>
        </div>

        {/* Pendiente cobrar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-500" />
            <div>
              <span className="text-sm text-gray-600">Pendiente Cobrar</span>
              <span className="text-xs text-gray-400 ml-1">({flujo.ventasPendientesCobro} ventas)</span>
            </div>
          </div>
          <span className="font-medium text-yellow-600">{formatCurrency(flujo.cajaPendienteCobrar)}</span>
        </div>
      </div>

      {/* Egresos comprometidos */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <div>
            <span className="text-sm text-gray-600">Egresos Comprometidos</span>
            <span className="text-xs text-gray-400 ml-1">({flujo.ordenesCompraPendientes} OC)</span>
          </div>
        </div>
        <span className="font-medium text-red-600">-{formatCurrency(flujo.egresosComprometidos)}</span>
      </div>

      {/* Nota informativa */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          * Los ingresos proyectados se calculan en base al promedio de ventas diarias de cada producto
          multiplicado por su precio promedio.
        </p>
      </div>
    </div>
  );
};
