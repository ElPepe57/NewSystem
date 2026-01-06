import React, { useState } from 'react';
import { ShoppingCart, Eye, Trash2, TrendingUp, TrendingDown, Calculator, Lock, AlertTriangle, PieChart, ChevronDown, ChevronUp, Package, DollarSign, Percent, Info, Truck } from 'lucide-react';
import { Badge, Pagination, usePagination } from '../../common';
import type { Venta, EstadoVenta, CanalVenta } from '../../../types/venta.types';
import { useRentabilidadVentas, type RentabilidadVenta, type DatosRentabilidadGlobal } from '../../../hooks/useRentabilidadVentas';

interface VentaTableProps {
  ventas: Venta[];
  onView: (venta: Venta) => void;
  onDelete?: (venta: Venta) => void;
  onRegistrarAdelanto?: (venta: Venta) => void;
  loading?: boolean;
  /** @deprecated - Ahora se usa distribución proporcional vía useRentabilidadVentas */
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

// Componente de desglose expandible
interface DesgloseVentaProps {
  venta: Venta;
  rentabilidad: RentabilidadVenta;
  datosGlobales: DatosRentabilidadGlobal | null;
}

const DesgloseVenta: React.FC<DesgloseVentaProps> = ({ venta, rentabilidad, datosGlobales }) => {
  return (
    <div className="bg-gradient-to-br from-slate-50 to-gray-100 p-5 border-t border-gray-200">
      {/* Header del desglose */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-800 flex items-center">
          <Calculator className="h-4 w-4 mr-2 text-purple-600" />
          Desglose de Rentabilidad - {venta.numeroVenta}
        </h4>
        <div className="text-xs text-gray-500">
          Proporción GA/GO: {datosGlobales ? ((rentabilidad.costoBase / datosGlobales.baseCostoTotal) * 100).toFixed(2) : 0}%
        </div>
      </div>

      {/* Resumen de la venta - 6 tarjetas */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="text-xs text-gray-500 flex items-center">
            <DollarSign className="h-3 w-3 mr-1" />
            Total Venta
          </div>
          <div className="text-lg font-bold text-gray-900">S/ {venta.totalPEN.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-blue-200 bg-blue-50">
          <div className="text-xs text-gray-500 flex items-center">
            <Package className="h-3 w-3 mr-1" />
            Costo Base
          </div>
          <div className="text-lg font-bold text-blue-600">S/ {rentabilidad.costoBase.toFixed(2)}</div>
          <div className="text-xs text-gray-400">Compra + Flete</div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-purple-200 bg-purple-50">
          <div className="text-xs text-gray-500 flex items-center">
            <DollarSign className="h-3 w-3 mr-1" />
            GV
          </div>
          <div className="text-lg font-bold text-purple-600">S/ {rentabilidad.gastosGV.toFixed(2)}</div>
          <div className="text-xs text-gray-400">Comisiones, pasarelas</div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-sky-200 bg-sky-50">
          <div className="text-xs text-gray-500 flex items-center">
            <Truck className="h-3 w-3 mr-1" />
            GD
          </div>
          <div className="text-lg font-bold text-sky-600">S/ {rentabilidad.gastosGD.toFixed(2)}</div>
          <div className="text-xs text-gray-400">Delivery</div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-orange-200 bg-orange-50">
          <div className="text-xs text-gray-500 flex items-center">
            <PieChart className="h-3 w-3 mr-1" />
            GA/GO
          </div>
          <div className="text-lg font-bold text-orange-600">S/ {rentabilidad.costoGAGO.toFixed(2)}</div>
          <div className="text-xs text-gray-400">Admin/Operativo</div>
        </div>
        <div className={`rounded-lg p-3 border ${rentabilidad.utilidadNeta >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="text-xs text-gray-500 flex items-center">
            <Percent className="h-3 w-3 mr-1" />
            Utilidad Neta
          </div>
          <div className={`text-lg font-bold ${rentabilidad.utilidadNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            S/ {rentabilidad.utilidadNeta.toFixed(2)}
          </div>
          <div className="text-xs text-gray-400">
            Margen: {rentabilidad.margenNeto.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Fórmula de cálculo - Actualizada con GV y GD separados */}
      <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
        <div className="text-xs font-medium text-gray-600 mb-3 flex items-center">
          <Info className="h-3 w-3 mr-1 text-blue-500" />
          Cálculo paso a paso:
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-200">
            <span className="text-gray-600">1. Venta total:</span>
            <span className="font-mono font-medium">S/ {venta.totalPEN.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-200">
            <span className="text-gray-600">2. (-) Costo base (compra + flete):</span>
            <span className="font-mono font-medium text-blue-600">- S/ {rentabilidad.costoBase.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-200">
            <span className="text-gray-600">3. (-) GV (comisiones, pasarelas):</span>
            <span className="font-mono font-medium text-purple-600">- S/ {rentabilidad.gastosGV.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-200">
            <span className="text-gray-600">4. (-) GD (delivery - Transportistas):</span>
            <span className="font-mono font-medium text-sky-600">- S/ {rentabilidad.gastosGD.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-200 bg-yellow-50 -mx-2 px-2">
            <span className="text-gray-700 font-medium">(=) Utilidad Bruta:</span>
            <span className={`font-mono font-semibold ${rentabilidad.utilidadBruta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              S/ {rentabilidad.utilidadBruta.toFixed(2)}
              <span className="text-xs text-gray-500 ml-1">({rentabilidad.margenBruto.toFixed(1)}%)</span>
            </span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-200">
            <span className="text-gray-600">5. (-) GA/GO prorrateado:</span>
            <span className="font-mono font-medium text-orange-600">- S/ {rentabilidad.costoGAGO.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-2 bg-gray-100 rounded px-2 mt-2">
            <span className="font-semibold text-gray-800">(=) Utilidad Neta:</span>
            <span className={`font-mono font-bold text-lg ${rentabilidad.utilidadNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              S/ {rentabilidad.utilidadNeta.toFixed(2)}
              <span className="text-xs font-normal ml-1">({rentabilidad.margenNeto.toFixed(1)}%)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Desglose por producto - Actualizado con GV/GD y GA/GO separados */}
      {rentabilidad.desgloseProductos && rentabilidad.desgloseProductos.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Desglose por Producto ({rentabilidad.desgloseProductos.length})
            </h5>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Producto</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Cant.</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Precio Venta</th>
                  <th className="px-3 py-2 text-right font-medium text-blue-600">Costo Base</th>
                  <th className="px-3 py-2 text-right font-medium text-indigo-600" title="GV + GD prorrateado por % subtotal">GV+GD</th>
                  <th className="px-3 py-2 text-right font-medium text-orange-600" title="Prorrateado por % costo">GA/GO</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Costo Total</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Util. Neta</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rentabilidad.desgloseProductos.map((prod, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900 truncate max-w-[180px]" title={prod.nombre}>
                        {prod.nombre}
                      </div>
                      <div className="text-gray-400 font-mono">{prod.sku}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{prod.cantidad}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      S/ {prod.precioVenta.toFixed(2)}
                      <div className="text-gray-400 text-[10px]">{prod.proporcionVenta.toFixed(1)}% venta</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-blue-600">
                      S/ {prod.costoBase.toFixed(2)}
                      <div className="text-gray-400 text-[10px]">{prod.proporcionCosto.toFixed(1)}% costo</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-indigo-600">
                      S/ {prod.costoGVGD.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-orange-600">
                      S/ {prod.costoGAGO.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium">
                      S/ {prod.costoTotal.toFixed(2)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-medium ${prod.utilidadNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      S/ {prod.utilidadNeta.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        prod.margenNeto >= 25 ? 'bg-green-100 text-green-800' :
                        prod.margenNeto >= 10 ? 'bg-yellow-100 text-yellow-800' :
                        prod.margenNeto >= 0 ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {prod.margenNeto.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Nota explicativa */}
      <div className="mt-4 text-xs text-gray-500 bg-blue-50 rounded-lg p-3 border border-blue-100">
        <div className="flex items-start">
          <Info className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <div>
              <strong className="text-purple-700">GV (Gastos de Venta):</strong> Comisiones, pasarelas de pago, fees de plataformas.
              Se registran manualmente desde la sección de gastos de venta.
            </div>
            <div>
              <strong className="text-sky-700">GD (Gastos de Distribución):</strong> Costo de delivery.
              Se generan <span className="font-semibold">automáticamente</span> al confirmar entregas en el módulo de Transportistas.
            </div>
            <div>
              <strong className="text-orange-700">GA/GO (Gastos Admin/Operativos):</strong> Alquiler, servicios, sueldos, etc.
              Se prorratean por <span className="font-mono bg-orange-100 px-1 rounded">% del costo base</span> de cada producto.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const VentaTable: React.FC<VentaTableProps> = ({
  ventas,
  onView,
  onDelete,
  onRegistrarAdelanto,
  loading = false
}) => {
  // Estado para filas expandidas
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Paginación
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    setPage,
    setItemsPerPage,
    paginatedItems: ventasPaginadas
  } = usePagination({
    items: ventas,
    initialItemsPerPage: 15
  });

  // Usar el hook de rentabilidad con distribución proporcional
  const { datos: datosRentabilidad, getRentabilidadVenta, loading: loadingRentabilidad } = useRentabilidadVentas(ventas);

  // Toggle expansión de fila
  const toggleRow = (ventaId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ventaId)) {
        newSet.delete(ventaId);
      } else {
        newSet.add(ventaId);
      }
      return newSet;
    });
  };

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
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
              <Calculator className="h-4 w-4 mx-auto text-purple-500" aria-label="Ver desglose" />
            </th>
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
              <div className="flex items-center" title="Margen Neto con distribución proporcional de GA/GO">
                <PieChart className="h-3 w-3 mr-1 text-orange-500" />
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
          {ventasPaginadas.map((venta) => {
            const estadoInfo = estadoLabels[venta.estado];
            const margenBrutoPositivo = venta.margenPromedio !== undefined && venta.margenPromedio > 0;

            // Obtener rentabilidad con distribución proporcional
            const rentabilidad = getRentabilidadVenta(venta.id);
            const tieneRentabilidad = rentabilidad !== null;
            const margenNetoPositivo = tieneRentabilidad && rentabilidad.margenNeto > 0;
            const isExpanded = expandedRows.has(venta.id);

            return (
              <React.Fragment key={venta.id}>
              <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-purple-50' : ''}`}>
                {/* Botón de expandir/colapsar desglose */}
                <td className="px-3 py-4 whitespace-nowrap text-center">
                  <button
                    onClick={() => toggleRow(venta.id)}
                    className={`p-1.5 rounded-lg transition-all duration-200 ${
                      isExpanded
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-500 hover:bg-purple-100 hover:text-purple-600'
                    }`}
                    title={isExpanded ? 'Ocultar desglose' : 'Ver desglose de rentabilidad'}
                    disabled={!tieneRentabilidad && !loadingRentabilidad}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </td>
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

                {/* Margen Neto con distribución proporcional de GA/GO */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {tieneRentabilidad ? (
                    <div title={`GA/GO: S/ ${rentabilidad.costoGAGO.toFixed(2)} (${((rentabilidad.costoBase / (datosRentabilidad?.baseCostoTotal || 1)) * 100).toFixed(1)}% proporcional)`}>
                      <div className="flex items-center">
                        {margenNetoPositivo ? (
                          <TrendingUp className="h-4 w-4 text-success-500 mr-1" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-danger-500 mr-1" />
                        )}
                        <span className={`text-sm font-medium ${
                          margenNetoPositivo ? 'text-success-600' : 'text-danger-600'
                        }`}>
                          {rentabilidad.margenNeto.toFixed(1)}%
                        </span>
                      </div>
                      <div className={`text-xs ${rentabilidad.utilidadNeta >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                        Neto: S/ {rentabilidad.utilidadNeta.toFixed(2)}
                      </div>
                    </div>
                  ) : loadingRentabilidad ? (
                    <span className="text-sm text-gray-400">...</span>
                  ) : (
                    <span className="text-sm text-gray-400" title="Sin datos de rentabilidad">-</span>
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

              {/* Fila expandible con desglose de rentabilidad */}
              {isExpanded && tieneRentabilidad && rentabilidad && (
                <tr>
                  <td colSpan={11} className="p-0">
                    <DesgloseVenta
                      venta={venta}
                      rentabilidad={rentabilidad}
                      datosGlobales={datosRentabilidad}
                    />
                  </td>
                </tr>
              )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Paginación */}
      {ventas.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={ventas.length}
          pageSize={itemsPerPage}
          onPageChange={setPage}
          onPageSizeChange={setItemsPerPage}
        />
      )}
    </div>
  );
};