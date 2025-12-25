import React from 'react';
import { ShoppingCart, Eye, Trash2, TrendingUp, TrendingDown, Calculator, Lock, Clock, AlertTriangle } from 'lucide-react';
import { Badge } from '../../common';
import type { Venta, EstadoVenta, CanalVenta } from '../../../types/venta.types';

interface VentaTableProps {
  ventas: Venta[];
  onView: (venta: Venta) => void;
  onDelete?: (venta: Venta) => void;
  onRegistrarAdelanto?: (venta: Venta) => void;
  loading?: boolean;
  /** Carga operativa por unidad del mes (gastos operativos / unidades vendidas) */
  cargaOperativaPorUnidad?: number;
}

const estadoLabels: Record<EstadoVenta, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  cotizacion: { label: 'Cotización', variant: 'default' },
  reservada: { label: 'Reservada', variant: 'info' },
  confirmada: { label: 'Confirmada', variant: 'info' },
  parcial: { label: 'Parcial', variant: 'warning' },
  asignada: { label: 'Asignada', variant: 'warning' },
  en_entrega: { label: 'En Entrega', variant: 'warning' },
  entrega_parcial: { label: 'Entrega Parcial', variant: 'warning' },
  entregada: { label: 'Entregada', variant: 'success' },
  cancelada: { label: 'Cancelada', variant: 'danger' },
  devuelta: { label: 'Devuelta', variant: 'danger' },
  devolucion_parcial: { label: 'Dev. Parcial', variant: 'warning' }
};

const canalLabels: Record<CanalVenta, string> = {
  mercado_libre: 'ML',
  directo: 'Directo',
  otro: 'Otro'
};

export const VentaTable: React.FC<VentaTableProps> = ({
  ventas,
  onView,
  onDelete,
  onRegistrarAdelanto,
  loading = false,
  cargaOperativaPorUnidad = 0
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (ventas.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay ventas</h3>
        <p className="mt-1 text-sm text-gray-500">Comienza creando tu primera venta o cotización</p>
      </div>
    );
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleDateString('es-PE', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Número
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cliente
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Canal
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Productos
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Margen Bruto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="flex items-center">
                <Calculator className="h-3 w-3 mr-1" />
                Margen Neto
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fecha
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {ventas.map((venta) => {
            const estadoInfo = estadoLabels[venta.estado];
            const margenBrutoPositivo = venta.margenPromedio !== undefined && venta.margenPromedio > 0;

            // Calcular rentabilidad neta
            const cantidadUnidades = venta.productos.reduce((sum, p) => sum + p.cantidad, 0);
            const cargaOperativaVenta = cargaOperativaPorUnidad * cantidadUnidades;
            const utilidadNeta = (venta.utilidadBrutaPEN || 0) - cargaOperativaVenta;
            const margenNeto = venta.totalPEN > 0 ? (utilidadNeta / venta.totalPEN) * 100 : 0;
            const margenNetoPositivo = margenNeto > 0;

            return (
              <tr key={venta.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <ShoppingCart className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-mono font-medium text-gray-900">
                      {venta.numeroVenta}
                    </span>
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{venta.nombreCliente}</div>
                  {venta.dniRuc && (
                    <div className="text-xs text-gray-500">{venta.dniRuc}</div>
                  )}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant="info" size="sm">
                    {canalLabels[venta.canal]}
                  </Badge>
                </td>
                
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {venta.productos.length} {venta.productos.length === 1 ? 'producto' : 'productos'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {venta.productos.slice(0, 2).map(p => p.marca).join(', ')}
                    {venta.productos.length > 2 && '...'}
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">
                    S/ {venta.totalPEN.toFixed(2)}
                  </div>
                  {venta.utilidadBrutaPEN !== undefined && (
                    <div className={`text-xs ${venta.utilidadBrutaPEN >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                      Util: S/ {venta.utilidadBrutaPEN.toFixed(2)}
                    </div>
                  )}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  {venta.margenPromedio !== undefined ? (
                    <div className="flex items-center">
                      {margenBrutoPositivo ? (
                        <TrendingUp className="h-4 w-4 text-success-500 mr-1" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-danger-500 mr-1" />
                      )}
                      <span className={`text-sm font-medium ${
                        margenBrutoPositivo ? 'text-success-600' : 'text-danger-600'
                      }`}>
                        {venta.margenPromedio.toFixed(1)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>

                {/* Margen Neto (descontando carga operativa) */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {cargaOperativaPorUnidad > 0 ? (
                    <div>
                      <div className="flex items-center">
                        {margenNetoPositivo ? (
                          <TrendingUp className="h-4 w-4 text-success-500 mr-1" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-danger-500 mr-1" />
                        )}
                        <span className={`text-sm font-medium ${
                          margenNetoPositivo ? 'text-success-600' : 'text-danger-600'
                        }`}>
                          {margenNeto.toFixed(1)}%
                        </span>
                      </div>
                      <div className={`text-xs ${utilidadNeta >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                        Neto: S/ {utilidadNeta.toFixed(2)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400" title="Sin datos de carga operativa">-</span>
                  )}
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <Badge variant={estadoInfo.variant}>
                      {estadoInfo.label}
                    </Badge>
                    {/* Indicador de reserva */}
                    {venta.estado === 'reservada' && venta.stockReservado && (
                      <Badge
                        variant={venta.stockReservado.tipoReserva === 'fisica' ? 'success' : 'warning'}
                        size="sm"
                      >
                        {venta.stockReservado.tipoReserva === 'fisica' ? '✓ Física' : '⏳ Virtual'}
                      </Badge>
                    )}
                    {/* Indicador de stock faltante en cotizaciones */}
                    {venta.estado === 'cotizacion' && venta.requiereStock && (
                      <span className="inline-flex items-center text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Sin stock
                      </span>
                    )}
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {formatDate(venta.fechaCreacion)}
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onView(venta)}
                      className="text-primary-600 hover:text-primary-900"
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    {/* Botón de registrar adelanto - solo cotizaciones */}
                    {venta.estado === 'cotizacion' && onRegistrarAdelanto && (
                      <button
                        onClick={() => onRegistrarAdelanto(venta)}
                        className="text-purple-600 hover:text-purple-900"
                        title="Registrar Adelanto y Reservar Stock"
                      >
                        <Lock className="h-4 w-4" />
                      </button>
                    )}

                    {venta.estado === 'cotizacion' && onDelete && (
                      <button
                        onClick={() => onDelete(venta)}
                        className="text-danger-600 hover:text-danger-900"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};