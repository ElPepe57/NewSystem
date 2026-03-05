import React, { useState } from 'react';
import { Package, Eye, Pencil, Trash2, TrendingUp, ChevronDown, ChevronUp, DollarSign, CreditCard, Layers, Info, User, ClipboardCheck } from 'lucide-react';
import { Badge, Pagination, usePagination } from '../../common';
import { useUserName } from '../../../hooks/useUserNames';
import type { OrdenCompra, EstadoOrden, EstadoPagoOC } from '../../../types/ordenCompra.types';

interface OrdenCompraTableProps {
  ordenes: OrdenCompra[];
  onView: (orden: OrdenCompra) => void;
  onEdit?: (orden: OrdenCompra) => void;
  onDelete?: (orden: OrdenCompra) => void;
  loading?: boolean;
}

const estadoLabels: Record<EstadoOrden, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  borrador: { label: 'Borrador', variant: 'default' },
  enviada: { label: 'Enviada', variant: 'info' },
  en_transito: { label: 'En Tránsito', variant: 'warning' },
  recibida_parcial: { label: 'Parcial', variant: 'warning' },
  recibida: { label: 'Recibida', variant: 'success' },
  cancelada: { label: 'Cancelada', variant: 'danger' }
};

const estadoPagoLabels: Record<EstadoPagoOC, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  pendiente: { label: 'Pendiente', variant: 'danger' },
  pagada: { label: 'Pagada', variant: 'success' },
  pago_parcial: { label: 'Pago Parcial', variant: 'warning' }
};

// Componente para una fila de recepción
import type { RecepcionParcial } from '../../../types/ordenCompra.types';

const RecepcionRow: React.FC<{
  recepcion: RecepcionParcial;
  nombreAlmacenDestino?: string;
  registradoPorNombre: string;
  formatTimestamp: (ts: any) => string;
}> = ({ recepcion, nombreAlmacenDestino, registradoPorNombre, formatTimestamp }) => {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-700 text-xs font-bold">
          #{recepcion.numero}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">
            {recepcion.totalUnidadesRecepcion} unidades recibidas
          </div>
          <div className="text-xs text-gray-500">
            {formatTimestamp(recepcion.fecha)}
            {recepcion.observaciones && (
              <span className="ml-2 text-gray-400">— {recepcion.observaciones}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {nombreAlmacenDestino && (
          <div className="flex items-center text-xs text-gray-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
            <Package className="h-3 w-3 mr-1.5 text-blue-500" />
            <span className="font-medium text-blue-700">{nombreAlmacenDestino}</span>
          </div>
        )}
        <div className="flex items-center text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full">
          <User className="h-3 w-3 mr-1.5 text-gray-400" />
          <span className="font-medium">{registradoPorNombre}</span>
        </div>
      </div>
    </div>
  );
};

// Componente de desglose expandible
const DesgloseOrdenCompra: React.FC<{ orden: OrdenCompra }> = ({ orden }) => {
  const impuesto = orden.impuestoUSD || 0;
  const envio = orden.gastosEnvioUSD || 0;
  const otros = orden.otrosGastosUSD || 0;
  const envioYOtros = envio + otros;
  const pagoInfo = estadoPagoLabels[orden.estadoPago] || estadoPagoLabels.pendiente;
  const totalRecibido = orden.productos.reduce((sum, p) => sum + (p.cantidadRecibida || 0), 0);
  const totalPedido = orden.productos.reduce((sum, p) => sum + p.cantidad, 0);
  const tieneRecepciones = totalRecibido > 0;

  // Resolver nombre del creador
  const creadoPorNombre = useUserName(orden.creadoPor);

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '-';
    try {
      const date = timestamp.toDate();
      return date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '-';
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-gray-100 p-5 border-t border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-800 flex items-center">
          <Layers className="h-4 w-4 mr-2 text-blue-600" />
          Desglose de Orden - {orden.numeroOrden}
        </h4>
        <div className="flex items-center gap-4">
          {orden.requerimientoNumeros && orden.requerimientoNumeros.length > 0 && (
            <div className="text-xs text-gray-500">
              Requerimientos: {orden.requerimientoNumeros.join(', ')}
            </div>
          )}
          <div className="text-xs text-gray-500 flex items-center">
            <User className="h-3 w-3 mr-1" />
            Creada por: <span className="font-medium text-gray-700 ml-1">{creadoPorNombre}</span>
          </div>
        </div>
      </div>

      {/* Tarjetas financieras */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 mb-5">
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="text-xs text-gray-500 flex items-center">
            <DollarSign className="h-3 w-3 mr-1" />
            Subtotal
          </div>
          <div className="text-lg font-bold text-gray-900">${orden.subtotalUSD.toFixed(2)}</div>
        </div>

        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="text-xs text-gray-500">Impuesto (Tax)</div>
          <div className="text-lg font-bold text-gray-700">${impuesto.toFixed(2)}</div>
        </div>

        {envioYOtros > 0 && (
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-500">Envío + Otros</div>
            <div className="text-lg font-bold text-gray-700">${envioYOtros.toFixed(2)}</div>
            {envio > 0 && otros > 0 && (
              <div className="text-xs text-gray-400">Envío: ${envio.toFixed(2)} | Otros: ${otros.toFixed(2)}</div>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg p-3 border border-blue-200 bg-blue-50">
          <div className="text-xs text-gray-500 flex items-center">
            <DollarSign className="h-3 w-3 mr-1" />
            Total USD
          </div>
          <div className="text-lg font-bold text-blue-600">${orden.totalUSD.toFixed(2)}</div>
        </div>

        {(orden.tcCompra || orden.tcPago) && (
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-500">Tipo de Cambio</div>
            {orden.tcCompra && (
              <div className="text-sm font-medium text-gray-700">
                Compra: S/ {orden.tcCompra.toFixed(3)}
              </div>
            )}
            {orden.tcPago && orden.tcPago !== orden.tcCompra && (
              <div className="text-sm font-medium text-gray-700">
                Pago: S/ {orden.tcPago.toFixed(3)}
              </div>
            )}
          </div>
        )}

        {orden.totalPEN && (
          <div className="bg-white rounded-lg p-3 border border-green-200 bg-green-50">
            <div className="text-xs text-gray-500">Total PEN</div>
            <div className="text-lg font-bold text-green-600">S/ {orden.totalPEN.toFixed(2)}</div>
          </div>
        )}

        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="text-xs text-gray-500 flex items-center">
            <CreditCard className="h-3 w-3 mr-1" />
            Estado de Pago
          </div>
          <div className="mt-1">
            <Badge variant={pagoInfo.variant}>{pagoInfo.label}</Badge>
          </div>
          {orden.montoPendiente !== undefined && orden.montoPendiente > 0 && (
            <div className="text-xs text-red-500 mt-1">
              Pendiente: ${orden.montoPendiente.toFixed(2)}
            </div>
          )}
        </div>

        {orden.diferenciaCambiaria && Math.abs(orden.diferenciaCambiaria) > 0.01 && (
          <div className={`bg-white rounded-lg p-3 border ${orden.diferenciaCambiaria > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            <div className="text-xs text-gray-500 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              Dif. Cambiaria
            </div>
            <div className={`text-lg font-bold ${orden.diferenciaCambiaria > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {orden.diferenciaCambiaria > 0 ? '+' : ''}S/ {orden.diferenciaCambiaria.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Tabla de productos */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Productos ({orden.productos.length})
          </h5>
          {tieneRecepciones && (
            <span className="text-xs text-gray-500">
              Recibido: {totalRecibido} / {totalPedido} unidades
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Producto</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">SKU</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Presentación</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Cant.</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Costo Unit.</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Subtotal</th>
                {tieneRecepciones && (
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Recibido</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orden.productos.map((prod, idx) => {
                const recibida = prod.cantidadRecibida || 0;
                const porcentaje = prod.cantidad > 0 ? (recibida / prod.cantidad) * 100 : 0;

                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900 truncate max-w-[200px]" title={prod.nombreComercial}>
                        {prod.marca}
                      </div>
                      <div className="text-gray-400 truncate max-w-[200px]">{prod.nombreComercial}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-600">{prod.sku}</td>
                    <td className="px-3 py-2 text-gray-600">{prod.presentacion}</td>
                    <td className="px-3 py-2 text-right font-medium">{prod.cantidad}</td>
                    <td className="px-3 py-2 text-right font-mono">${prod.costoUnitario.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium">${prod.subtotal.toFixed(2)}</td>
                    {tieneRecepciones && (
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={`font-medium ${recibida >= prod.cantidad ? 'text-green-600' : recibida > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                            {recibida}/{prod.cantidad}
                          </span>
                        </div>
                        {recibida > 0 && (
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1 ml-auto">
                            <div
                              className={`h-full rounded-full ${porcentaje >= 100 ? 'bg-green-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(porcentaje, 100)}%` }}
                            />
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right font-medium text-gray-600">Totales:</td>
                <td className="px-3 py-2 text-right font-bold">{totalPedido}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right font-mono font-bold">${orden.subtotalUSD.toFixed(2)}</td>
                {tieneRecepciones && (
                  <td className="px-3 py-2 text-right font-bold text-gray-600">
                    {totalRecibido}/{totalPedido}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Recepciones */}
      {orden.recepcionesParciales && orden.recepcionesParciales.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mt-4">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center">
              <ClipboardCheck className="h-3.5 w-3.5 mr-1.5 text-green-600" />
              Recepciones ({orden.recepcionesParciales.length})
            </h5>
            {orden.nombreAlmacenDestino && (
              <span className="text-xs text-gray-500">
                Destino: <span className="font-medium text-blue-700">{orden.nombreAlmacenDestino}</span>
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {orden.recepcionesParciales.map((recepcion) => (
              <RecepcionRow
                key={recepcion.id}
                recepcion={recepcion}
                nombreAlmacenDestino={orden.nombreAlmacenDestino}
                registradoPorNombre={creadoPorNombre}
                formatTimestamp={formatTimestamp}
              />
            ))}
          </div>
        </div>
      )}

      {/* Observaciones */}
      {orden.observaciones && (
        <div className="mt-4 text-xs text-gray-500 bg-blue-50 rounded-lg p-3 border border-blue-100">
          <div className="flex items-start">
            <Info className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-gray-700">Observaciones:</strong> {orden.observaciones}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const OrdenCompraTable: React.FC<OrdenCompraTableProps> = ({
  ordenes,
  onView,
  onEdit,
  onDelete,
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
    paginatedItems: ordenesPaginadas
  } = usePagination({
    items: ordenes,
    initialItemsPerPage: 15
  });

  // Toggle expansión de fila
  const toggleRow = (ordenId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ordenId)) {
        newSet.delete(ordenId);
      } else {
        newSet.add(ordenId);
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

  if (ordenes.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay órdenes de compra</h3>
        <p className="mt-1 text-sm text-gray-500">Comienza creando tu primera orden</p>
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
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                <Layers className="h-4 w-4 mx-auto text-blue-500" aria-label="Ver desglose" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Número Orden
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Proveedor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Productos
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha Creación
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {ordenesPaginadas.map((orden) => {
              const estadoInfo = estadoLabels[orden.estado];
              const isExpanded = expandedRows.has(orden.id);

              return (
                <React.Fragment key={orden.id}>
                <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-blue-50' : ''}`}>
                  {/* Botón de expandir/colapsar */}
                  <td className="px-3 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => toggleRow(orden.id)}
                      className={`p-1.5 rounded-lg transition-all duration-200 ${
                        isExpanded
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600'
                      }`}
                      title={isExpanded ? 'Ocultar desglose' : 'Ver desglose de la orden'}
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
                      <Package className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm font-mono font-medium text-gray-900">
                        {orden.numeroOrden}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{orden.nombreProveedor}</div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {orden.productos.length} {orden.productos.length === 1 ? 'producto' : 'productos'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {orden.productos.slice(0, 2).map(p => p.marca).join(', ')}
                      {orden.productos.length > 2 && '...'}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      ${orden.totalUSD.toFixed(2)}
                    </div>
                    {orden.totalPEN && (
                      <div className="text-xs text-gray-500">
                        S/ {orden.totalPEN.toFixed(2)}
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={estadoInfo.variant}>
                      {estadoInfo.label}
                    </Badge>
                    {orden.diferenciaCambiaria && Math.abs(orden.diferenciaCambiaria) > 0 && (
                      <div className="flex items-center mt-1">
                        <TrendingUp className="h-3 w-3 text-warning-500 mr-1" />
                        <span className="text-xs text-warning-600">
                          Dif. FX
                        </span>
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDate(orden.fechaCreacion)}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => onView(orden)}
                        className="text-primary-600 hover:text-primary-900"
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      {orden.estado === 'borrador' && onEdit && (
                        <button
                          onClick={() => onEdit(orden)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}

                      {['borrador', 'enviada', 'en_transito', 'cancelada'].includes(orden.estado) && !orden.inventarioGenerado && onDelete && (
                        <button
                          onClick={() => onDelete(orden)}
                          className="text-danger-600 hover:text-danger-900"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Fila expandible con desglose */}
                {isExpanded && (
                  <tr>
                    <td colSpan={8} className="p-0">
                      <DesgloseOrdenCompra orden={orden} />
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {ordenes.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={ordenes.length}
          pageSize={itemsPerPage}
          onPageChange={setPage}
          onPageSizeChange={setItemsPerPage}
        />
      )}
    </div>
  );
};
