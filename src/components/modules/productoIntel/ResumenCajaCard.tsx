import React, { useState } from 'react';
import { Wallet, TrendingUp, Snowflake, Lock, Truck, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import type { ResumenCaja } from '../../../types/productoIntel.types';
import { formatCurrencyCompact } from '../../../utils/format';

type CategoriaClick = 'activa' | 'comprometida' | 'transito' | 'congelada';

interface ResumenCajaCardProps {
  resumen: ResumenCaja;
  onClickCategoria?: (categoria: CategoriaClick) => void;
}

// Alias con default PEN para preservar comportamiento anterior
const formatCurrency = (value: number, currency: 'PEN' | 'USD' = 'PEN'): string =>
  formatCurrencyCompact(value, currency);

export const ResumenCajaCard: React.FC<ResumenCajaCardProps> = ({
  resumen,
  onClickCategoria
}) => {
  const [showPreventas, setShowPreventas] = useState(false);

  // 4 categorías de caja
  const categorias = [
    {
      key: 'activa' as const,
      label: 'Caja Activa',
      sublabel: 'Stock disponible, buena rotación',
      icon: TrendingUp,
      data: resumen.cajaActiva,
      color: 'green' as const,
      porcentaje: resumen.porcentajeCajaActiva,
      extraInfo: resumen.cajaActiva.rotacionPromedioDias > 0
        ? `~${resumen.cajaActiva.rotacionPromedioDias}d rotación`
        : null
    },
    {
      key: 'comprometida' as const,
      label: 'Comprometida',
      sublabel: 'Reservado (ya vendido)',
      icon: Lock,
      data: resumen.cajaComprometida,
      color: 'blue' as const,
      porcentaje: resumen.porcentajeCajaComprometida,
      extraInfo: resumen.cajaComprometida.ventasReservadas > 0
        ? `${resumen.cajaComprometida.ventasReservadas} ventas`
        : null
    },
    {
      key: 'transito' as const,
      label: 'En Tránsito',
      sublabel: 'USA → Perú',
      icon: Truck,
      data: resumen.cajaTransito,
      color: 'purple' as const,
      porcentaje: resumen.porcentajeCajaTransito,
      extraInfo: resumen.cajaTransito.diasPromedioLlegada > 0
        ? `~${resumen.cajaTransito.diasPromedioLlegada}d llegada`
        : null
    },
    {
      key: 'congelada' as const,
      label: 'Congelada',
      sublabel: 'Baja/sin rotación',
      icon: Snowflake,
      data: resumen.cajaCongelada,
      color: 'red' as const,
      porcentaje: resumen.porcentajeCajaCongelada,
      extraInfo: resumen.cajaCongelada.diasPromedioSinMovimiento > 0
        ? `${resumen.cajaCongelada.diasPromedioSinMovimiento}d sin mov.`
        : null
    }
  ];

  const colorClasses = {
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
      iconBg: 'bg-green-100',
      barBg: 'bg-green-500'
    },
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
      iconBg: 'bg-blue-100',
      barBg: 'bg-blue-500'
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-700',
      iconBg: 'bg-purple-100',
      barBg: 'bg-purple-500'
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      iconBg: 'bg-red-100',
      barBg: 'bg-red-500'
    },
    yellow: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-700',
      iconBg: 'bg-yellow-100',
      barBg: 'bg-yellow-500'
    }
  };

  const tienePreventas = resumen.preventasVirtuales && resumen.preventasVirtuales.cantidad > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
            <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">Distribución de Caja</h3>
            <p className="text-[10px] sm:text-xs text-gray-500">Capital invertido en inventario</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg sm:text-xl font-bold text-gray-900">
            {formatCurrency(resumen.totalInventarioPEN)}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-500">
            {resumen.cajaActiva.unidades + resumen.cajaComprometida.unidades +
             resumen.cajaTransito.unidades + resumen.cajaCongelada.unidades} unidades
          </p>
        </div>
      </div>

      {/* Barra de distribución con 4 colores */}
      <div className="h-3 flex rounded-full overflow-hidden bg-gray-100 mb-4">
        {categorias.map(cat => (
          cat.porcentaje > 0 && (
            <div
              key={cat.key}
              className={`${colorClasses[cat.color].barBg} transition-all cursor-pointer hover:opacity-80`}
              style={{ width: `${cat.porcentaje}%` }}
              onClick={() => onClickCategoria?.(cat.key)}
              title={`${cat.label}: ${formatCurrency(cat.data.valorInventarioPEN)} (${cat.porcentaje}%)`}
            />
          )
        ))}
      </div>

      {/* Grid de 4 categorías (2x2) */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {categorias.map(cat => {
          const colors = colorClasses[cat.color];
          const Icon = cat.icon;

          return (
            <div
              key={cat.key}
              className={`
                ${colors.bg} ${colors.border} border rounded-lg p-2 sm:p-3 overflow-hidden
                ${onClickCategoria ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
              `}
              onClick={() => onClickCategoria?.(cat.key)}
            >
              {/* Header: label + porcentaje */}
              <div className="flex items-start justify-between gap-1 mb-1.5 sm:mb-2">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <div className={`p-1 sm:p-1.5 ${colors.iconBg} rounded flex-shrink-0`}>
                    <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${colors.text}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs sm:text-sm font-medium ${colors.text} truncate`}>{cat.label}</p>
                    <p className="text-[9px] sm:text-[10px] text-gray-500 truncate">{cat.sublabel}</p>
                  </div>
                </div>
                <span className={`text-[10px] sm:text-xs font-bold ${colors.text} flex-shrink-0`}>{cat.porcentaje}%</span>
              </div>

              {/* Values */}
              <div className="space-y-0.5 sm:space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] sm:text-xs text-gray-600">Valor</span>
                  <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                    {formatCurrency(cat.data.valorInventarioPEN)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] sm:text-xs text-gray-600">Uds</span>
                  <span className="text-xs sm:text-sm text-gray-700">{cat.data.unidades}</span>
                </div>
                {cat.extraInfo && (
                  <div className="flex items-center pt-0.5 sm:pt-1 border-t border-gray-200/50">
                    <span className="text-[9px] sm:text-[10px] text-gray-500 flex items-center gap-0.5 sm:gap-1 truncate">
                      <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                      {cat.extraInfo}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Preventas Virtuales (si existen) */}
      {tienePreventas && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <button
            onClick={() => setShowPreventas(!showPreventas)}
            className="w-full flex items-center justify-between text-left hover:bg-gray-50 rounded-lg p-2 -m-2"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-orange-100 rounded">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-orange-700">
                  Preventas Virtuales
                </p>
                <p className="text-[10px] text-gray-500">
                  Sin stock físico aún
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(resumen.preventasVirtuales.valorTotalPEN)}
                </p>
                <p className="text-[10px] text-gray-500">
                  {resumen.preventasVirtuales.cantidad} ventas
                </p>
              </div>
              {showPreventas ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </button>

          {showPreventas && resumen.preventasVirtuales.detalles.length > 0 && (
            <div className="mt-3 space-y-2">
              {resumen.preventasVirtuales.detalles.slice(0, 5).map(preventa => (
                <div
                  key={preventa.ventaId}
                  className="bg-orange-50 border border-orange-200 rounded-lg p-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {preventa.numeroVenta}
                      </p>
                      <p className="text-xs text-gray-500">{preventa.clienteNombre}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(preventa.totalVenta)}
                      </p>
                      <p className="text-[10px] text-green-600">
                        Adelanto: {formatCurrency(preventa.montoAdelanto)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {preventa.productos.slice(0, 3).map((p, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] bg-white text-gray-600 px-1.5 py-0.5 rounded"
                      >
                        {p.sku} ({p.cantidadFaltante} faltantes)
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {resumen.preventasVirtuales.detalles.length > 5 && (
                <p className="text-xs text-gray-500 text-center">
                  +{resumen.preventasVirtuales.detalles.length - 5} más...
                </p>
              )}
            </div>
          )}

          {/* Resumen de adelantos */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="bg-green-50 rounded-lg p-2">
              <p className="text-[10px] text-gray-500">Adelantos recibidos</p>
              <p className="text-sm font-bold text-green-600">
                {formatCurrency(resumen.preventasVirtuales.adelantosRecibidosPEN)}
              </p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-2">
              <p className="text-[10px] text-gray-500">Por cobrar</p>
              <p className="text-sm font-bold text-yellow-600">
                {formatCurrency(resumen.preventasVirtuales.valorTotalPEN - resumen.preventasVirtuales.adelantosRecibidosPEN)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Resumen de potencial */}
      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 grid grid-cols-2 gap-2 sm:gap-4">
        <div>
          <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Potencial de Venta</p>
          <p className="text-base sm:text-lg font-bold text-gray-900">
            {formatCurrency(resumen.totalPotencialVentaPEN)}
          </p>
        </div>
        <div>
          <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Utilidad Potencial</p>
          <p className="text-base sm:text-lg font-bold text-green-600">
            {formatCurrency(resumen.totalPotencialUtilidadPEN)}
          </p>
        </div>
      </div>
    </div>
  );
};
