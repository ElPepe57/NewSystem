import React from 'react';
import { Package, TrendingUp, AlertTriangle, Clock, DollarSign, BarChart3, Lock, Truck } from 'lucide-react';
import { ScoreLiquidezBadge, TendenciaBadge, RotacionBadge } from './ScoreLiquidezBadge';
import type { ProductoIntel } from '../../../types/productoIntel.types';
import { formatCurrencyCompact } from '../../../utils/format';

interface ProductoIntelCardProps {
  producto: ProductoIntel;
  onClick?: () => void;
  compact?: boolean;
}

const formatCurrency = (value: number): string => formatCurrencyCompact(value, 'PEN');

export const ProductoIntelCard: React.FC<ProductoIntelCardProps> = ({
  producto,
  onClick,
  compact = false
}) => {
  const { rotacion, rentabilidad, liquidez, alertas } = producto;
  const alertasCriticas = alertas.filter(a => a.severidad === 'danger');
  const alertasWarning = alertas.filter(a => a.severidad === 'warning');

  if (compact) {
    return (
      <div
        className={`
          bg-white border border-gray-200 rounded-lg p-3
          ${onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-300 transition-all' : ''}
        `}
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 truncate" title={producto.nombreComercial}>
              {producto.nombreComercial}
            </p>
            <p className="text-xs text-gray-500">{producto.sku} - {producto.marca}</p>
          </div>
          <ScoreLiquidezBadge
            score={liquidez.score}
            clasificacion={liquidez.clasificacion}
            size="sm"
          />
        </div>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <RotacionBadge
            rotacionDias={rotacion.rotacionDias}
            clasificacion={rotacion.clasificacionRotacion}
          />
          <span className="text-xs text-gray-500">
            Stock: {rotacion.stockTotal}
          </span>
          {/* Badges de estado especial */}
          {rotacion.stockReservado > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
              <Lock className="h-2.5 w-2.5" />
              {rotacion.stockReservado} res.
            </span>
          )}
          {rotacion.stockTransito > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">
              <Truck className="h-2.5 w-2.5" />
              {rotacion.stockTransito} trán.
            </span>
          )}
        </div>

        {alertasCriticas.length > 0 && (
          <div className="mt-2 flex items-center gap-1 text-red-600">
            <AlertTriangle className="h-3 w-3" />
            <span className="text-xs">{alertasCriticas[0].mensaje}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`
        bg-white border border-gray-200 rounded-lg p-4
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:border-gray-300 transition-all' : ''}
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
            <Package className="h-5 w-5 text-gray-600" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate" title={producto.nombreComercial}>
              {producto.nombreComercial}
            </p>
            <p className="text-sm text-gray-500">{producto.sku}</p>
            <p className="text-xs text-gray-400">{producto.marca}</p>
          </div>
        </div>
        <ScoreLiquidezBadge
          score={liquidez.score}
          clasificacion={liquidez.clasificacion}
          size="md"
        />
      </div>

      {/* Metricas principales */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {/* Rotacion */}
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="flex items-center gap-1 mb-1">
            <Clock className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-500">Rotacion</span>
          </div>
          <p className="font-semibold text-gray-900">
            {rotacion.rotacionDias < 999 ? `${rotacion.rotacionDias}d` : '-'}
          </p>
          <p className="text-xs text-gray-500">
            {rotacion.ventasPorSemana.toFixed(1)}/sem
          </p>
        </div>

        {/* Margen */}
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="flex items-center gap-1 mb-1">
            <DollarSign className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-500">Margen</span>
          </div>
          <p className="font-semibold text-gray-900">
            {rentabilidad.margenBrutoPromedio.toFixed(0)}%
          </p>
          <p className="text-xs text-gray-500">
            ROI: {rentabilidad.roiPromedio}%
          </p>
        </div>

        {/* Stock */}
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="flex items-center gap-1 mb-1">
            <BarChart3 className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-500">Stock</span>
          </div>
          <p className="font-semibold text-gray-900">{rotacion.stockTotal}</p>
          <p className="text-xs text-gray-500">
            {rotacion.diasParaQuiebre < 999 ? `${rotacion.diasParaQuiebre}d` : '-'} quiebre
          </p>
        </div>
      </div>

      {/* Badges de stock especial (reservado/tránsito) */}
      {(rotacion.stockReservado > 0 || rotacion.stockTransito > 0) && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {rotacion.stockReservado > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-medium">
              <Lock className="h-3 w-3" />
              {rotacion.stockReservado} reservadas
            </span>
          )}
          {rotacion.stockTransito > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg text-xs font-medium">
              <Truck className="h-3 w-3" />
              {rotacion.stockTransito} en tránsito
            </span>
          )}
          {rotacion.stockDisponible > 0 && (
            <span className="text-xs text-gray-500">
              {rotacion.stockDisponible} disponibles
            </span>
          )}
        </div>
      )}

      {/* Tendencia y ventas */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <TendenciaBadge
            tendencia={rotacion.tendencia}
            variacion={rotacion.variacionVentas}
          />
          <span className="text-xs text-gray-500">
            {rotacion.unidadesVendidas30d} vendidas (30d)
          </span>
        </div>
        <span className="text-sm font-medium text-gray-700">
          {formatCurrency(rotacion.ventasPEN30d)}
        </span>
      </div>

      {/* Valor en inventario */}
      <div className="flex items-center justify-between text-sm mb-3">
        <span className="text-gray-500">Valor inventario</span>
        <span className="font-medium text-gray-900">
          {formatCurrency(liquidez.valorInventarioPEN)}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm mb-3">
        <span className="text-gray-500">Potencial utilidad</span>
        <span className="font-medium text-green-600">
          {formatCurrency(liquidez.potencialUtilidadPEN)}
        </span>
      </div>

      {/* Alertas */}
      {(alertasCriticas.length > 0 || alertasWarning.length > 0) && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
          {alertasCriticas.map((alerta, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-red-600">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span className="text-xs">{alerta.mensaje}</span>
            </div>
          ))}
          {alertasWarning.slice(0, 2).map((alerta, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-yellow-600">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span className="text-xs">{alerta.mensaje}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recomendacion */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500">{liquidez.descripcion}</p>
        <p className="text-xs font-medium text-blue-600 mt-1">{liquidez.recomendacion}</p>
      </div>
    </div>
  );
};
