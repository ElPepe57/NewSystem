import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Eye, AlertTriangle, Lock, Truck } from 'lucide-react';
import { ScoreLiquidezBadge, TendenciaBadge, RotacionBadge } from './ScoreLiquidezBadge';
import type { ProductoIntel } from '../../../types/productoIntel.types';
import { formatCurrencyPEN } from '../../../utils/format';

interface ProductoIntelTableProps {
  productos: ProductoIntel[];
  onSort?: (campo: string) => void;
  sortConfig?: { campo: string; ascendente: boolean };
  onProductoClick?: (productoId: string) => void;
}

const formatCurrency = (value: number): string => formatCurrencyPEN(value);

export const ProductoIntelTable: React.FC<ProductoIntelTableProps> = ({
  productos,
  onSort,
  sortConfig,
  onProductoClick
}) => {
  const getSortIcon = (campo: string) => {
    if (!sortConfig || sortConfig.campo !== campo) {
      return <ArrowUpDown className="h-3 w-3 text-gray-400" />;
    }
    return sortConfig.ascendente
      ? <ArrowUp className="h-3 w-3 text-blue-600" />
      : <ArrowDown className="h-3 w-3 text-blue-600" />;
  };

  const HeaderCell: React.FC<{
    campo: string;
    label: string;
    align?: 'left' | 'center' | 'right';
    sortable?: boolean;
  }> = ({ campo, label, align = 'left', sortable = true }) => (
    <th
      className={`
        px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider
        ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}
        ${sortable ? 'cursor-pointer hover:bg-gray-100' : ''}
      `}
      onClick={() => sortable && onSort?.(campo)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        {sortable && getSortIcon(campo)}
      </div>
    </th>
  );

  if (productos.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-500">No hay productos que mostrar</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <HeaderCell campo="nombre" label="Producto" />
              <HeaderCell campo="score" label="Liquidez" align="center" />
              <HeaderCell campo="rotacion" label="Rotacion" align="center" />
              <HeaderCell campo="stock" label="Stock" align="center" />
              <HeaderCell campo="margen" label="Margen" align="center" />
              <HeaderCell campo="ventas30d" label="Ventas 30d" align="right" />
              <HeaderCell campo="tendencia" label="Tendencia" align="center" />
              <HeaderCell campo="valorInv" label="Valor Inv." align="right" />
              <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
                Alertas
              </th>
              <th className="px-3 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {productos.map(producto => {
              const { rotacion, rentabilidad, liquidez, alertas } = producto;
              const alertasCriticas = alertas.filter(a => a.severidad === 'danger').length;
              const alertasWarning = alertas.filter(a => a.severidad === 'warning').length;

              return (
                <tr
                  key={producto.productoId}
                  className={`
                    hover:bg-gray-50 transition-colors
                    ${onProductoClick ? 'cursor-pointer' : ''}
                    ${liquidez.clasificacion === 'critica' ? 'bg-red-50/30' : ''}
                  `}
                  onClick={() => onProductoClick?.(producto.productoId)}
                >
                  {/* Producto */}
                  <td className="px-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate max-w-[200px]" title={producto.nombreComercial}>
                        {producto.nombreComercial}
                      </p>
                      <p className="text-xs text-gray-500">{producto.sku} - {producto.marca}</p>
                    </div>
                  </td>

                  {/* Score Liquidez */}
                  <td className="px-3 py-3 text-center">
                    <ScoreLiquidezBadge
                      score={liquidez.score}
                      clasificacion={liquidez.clasificacion}
                      size="sm"
                    />
                  </td>

                  {/* Rotacion */}
                  <td className="px-3 py-3 text-center">
                    <RotacionBadge
                      rotacionDias={rotacion.rotacionDias}
                      clasificacion={rotacion.clasificacionRotacion}
                    />
                  </td>

                  {/* Stock */}
                  <td className="px-3 py-3 text-center">
                    <div>
                      <p className="font-medium text-gray-900">{rotacion.stockTotal}</p>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        {rotacion.stockReservado > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]" title="Stock reservado">
                            <Lock className="h-2.5 w-2.5" />
                            {rotacion.stockReservado}
                          </span>
                        )}
                        {rotacion.stockTransito > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px]" title="Stock en tránsito">
                            <Truck className="h-2.5 w-2.5" />
                            {rotacion.stockTransito}
                          </span>
                        )}
                        {rotacion.stockReservado === 0 && rotacion.stockTransito === 0 && (
                          <span className="text-xs text-gray-500">
                            {rotacion.diasParaQuiebre < 999 ? `${rotacion.diasParaQuiebre}d` : '-'}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Margen */}
                  <td className="px-3 py-3 text-center">
                    <div>
                      <p className={`font-medium ${rentabilidad.margenBrutoPromedio >= 30 ? 'text-green-600' : rentabilidad.margenBrutoPromedio >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {rentabilidad.margenBrutoPromedio.toFixed(0)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        ROI {rentabilidad.roiPromedio}%
                      </p>
                    </div>
                  </td>

                  {/* Ventas 30d */}
                  <td className="px-3 py-3 text-right">
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(rotacion.ventasPEN30d)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {rotacion.unidadesVendidas30d} uds
                      </p>
                    </div>
                  </td>

                  {/* Tendencia */}
                  <td className="px-3 py-3 text-center">
                    <TendenciaBadge
                      tendencia={rotacion.tendencia}
                      variacion={rotacion.variacionVentas}
                    />
                  </td>

                  {/* Valor Inventario */}
                  <td className="px-3 py-3 text-right">
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(liquidez.valorInventarioPEN)}
                      </p>
                      <p className="text-xs text-green-600">
                        +{formatCurrency(liquidez.potencialUtilidadPEN)}
                      </p>
                    </div>
                  </td>

                  {/* Alertas */}
                  <td className="px-3 py-3 text-center">
                    {(alertasCriticas > 0 || alertasWarning > 0) ? (
                      <div className="flex items-center justify-center gap-1">
                        {alertasCriticas > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs">
                            <AlertTriangle className="h-3 w-3" />
                            {alertasCriticas}
                          </span>
                        )}
                        {alertasWarning > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 text-xs">
                            <AlertTriangle className="h-3 w-3" />
                            {alertasWarning}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>

                  {/* Accion */}
                  <td className="px-3 py-3">
                    <button
                      className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onProductoClick?.(producto.productoId);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
