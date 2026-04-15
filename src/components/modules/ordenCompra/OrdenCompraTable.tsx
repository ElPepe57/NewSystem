import React, { useState } from 'react';
import { formatFecha as formatDate } from '../../../utils/dateFormatters';
import { Package, Eye, Pencil, Trash2, TrendingUp, DollarSign, CreditCard, Layers, Info, User, ClipboardCheck, MapPin, Search, Truck, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge, Pagination, usePagination, LineaNegocioBadge, PaisOrigenBadge } from '../../common';
import { useUserName } from '../../../hooks/useUserNames';
import type { OrdenCompra, EstadoOrden, EstadoPagoOC, RecepcionParcial } from '../../../types/ordenCompra.types';
import { getDescripcionProducto } from '../../../utils/producto.helpers';
import { getSubOrdenResumen } from '../../../utils/ordenCompra.helpers';
import { DataTable } from '../../../design-system';
import type { DataTableColumn } from '../../../design-system';
import { SubOrdenCard } from './SubOrdenCard';

interface OrdenCompraTableProps {
  ordenes: OrdenCompra[];
  onView: (orden: OrdenCompra) => void;
  onEdit?: (orden: OrdenCompra) => void;
  onDelete?: (orden: OrdenCompra) => void;
  loading?: boolean;
}

const estadoLabels: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  // Estados nuevos (reingeniería)
  borrador: { label: 'Borrador', variant: 'default' },
  confirmada: { label: 'Confirmada', variant: 'info' },
  en_proceso: { label: 'En Proceso', variant: 'warning' },
  despachada: { label: 'Despachada', variant: 'warning' },
  completada: { label: 'Completada', variant: 'success' },
  cancelada: { label: 'Cancelada', variant: 'danger' },
  // Estados legacy (backward compat)
  enviada: { label: 'Confirmada', variant: 'info' },
  en_transito: { label: 'En Proceso', variant: 'warning' },
  recibida_parcial: { label: 'Despachada', variant: 'warning' },
  recibida: { label: 'Completada', variant: 'success' },
};

const estadoPagoLabels: Record<EstadoPagoOC, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  pendiente: { label: 'Pendiente', variant: 'danger' },
  pagado: { label: 'Pagada', variant: 'success' },
  parcial: { label: 'Pago Parcial', variant: 'warning' }
};

// Componente para una fila de recepción
const RecepcionRow: React.FC<{
  recepcion: RecepcionParcial;
  nombreAlmacenDestino?: string;
  registradoPorNombre: string;
  formatTimestamp: (ts: any) => string;
}> = ({ recepcion, nombreAlmacenDestino, registradoPorNombre, formatTimestamp }) => {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
          #{recepcion.numero}
        </div>
        <div>
          <div className="text-sm font-medium text-slate-900">
            {recepcion.totalUnidadesRecepcion} unidades recibidas
          </div>
          <div className="text-xs text-slate-500">
            {formatTimestamp(recepcion.fecha)}
            {recepcion.observaciones && (
              <span className="ml-2 text-slate-400">— {recepcion.observaciones}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {nombreAlmacenDestino && (
          <div className="flex items-center text-xs text-slate-600 bg-sky-50 px-3 py-1.5 rounded-full border border-sky-100">
            <Package className="h-3 w-3 mr-1.5 text-sky-500" />
            <span className="font-medium text-sky-700">{nombreAlmacenDestino}</span>
          </div>
        )}
        <div className="flex items-center text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full">
          <User className="h-3 w-3 mr-1.5 text-slate-400" />
          <span className="font-medium">{registradoPorNombre}</span>
        </div>
      </div>
    </div>
  );
};

// Componente de desglose expandible
const DesgloseOrdenCompra: React.FC<{ orden: OrdenCompra }> = ({ orden }) => {
  const impuesto = orden.impuestoCompraUSD ?? 0;
  const envio = orden.costoEnvioProveedorUSD ?? 0;
  const otros = orden.otrosGastosCompraUSD ?? 0;
  const envioYOtros = envio + otros;
  const descuento = orden.descuentoUSD
    ?? (orden.subOrdenes?.reduce((sum, s) => sum + (s.descuentoUSD || 0), 0) || 0);
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
    <div className="bg-slate-50 p-5 border-t border-slate-200 sticky left-0 max-w-[100vw] overflow-hidden sm:static sm:max-w-none sm:overflow-visible">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <h4 className="text-sm font-semibold text-slate-800 flex items-center">
          <Layers className="h-4 w-4 mr-2 text-sky-600" />
          Desglose de Orden - {orden.numeroOrden}
        </h4>
        <div className="flex items-center gap-4">
          {orden.requerimientoNumeros && orden.requerimientoNumeros.length > 0 && (
            <div className="text-xs text-slate-500">
              Requerimientos: {orden.requerimientoNumeros.join(', ')}
            </div>
          )}
          <div className="text-xs text-slate-500 flex items-center">
            <User className="h-3 w-3 mr-1" />
            Creada por: <span className="font-medium text-slate-700 ml-1">{creadoPorNombre}</span>
          </div>
        </div>
      </div>

      {/* Tarjetas financieras */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 mb-5">
        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <div className="text-xs text-slate-500 flex items-center">
            <DollarSign className="h-3 w-3 mr-1" />
            Subtotal
          </div>
          <div className="text-lg font-bold text-slate-900">${orden.subtotalUSD.toFixed(2)}</div>
        </div>

        {descuento > 0 && (
          <div className="bg-white rounded-lg p-3 border border-red-100">
            <div className="text-xs text-slate-500">Descuento</div>
            <div className="text-lg font-bold text-red-600">-${descuento.toFixed(2)}</div>
          </div>
        )}

        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <div className="text-xs text-slate-500">Impuesto (Tax)</div>
          <div className="text-lg font-bold text-slate-700">${impuesto.toFixed(2)}</div>
        </div>

        {envioYOtros > 0 && (
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="text-xs text-slate-500">Envío + Otros</div>
            <div className="text-lg font-bold text-slate-700">${envioYOtros.toFixed(2)}</div>
            {envio > 0 && otros > 0 && (
              <div className="text-xs text-slate-400">Envío: ${envio.toFixed(2)} | Otros: ${otros.toFixed(2)}</div>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg p-3 border border-sky-200 bg-sky-50">
          <div className="text-xs text-slate-500 flex items-center">
            <DollarSign className="h-3 w-3 mr-1" />
            Total USD
          </div>
          <div className="text-lg font-bold text-sky-600">${orden.totalUSD.toFixed(2)}</div>
        </div>

        {(orden.tcCompra || orden.tcPago) && (
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="text-xs text-slate-500">Tipo de Cambio</div>
            {orden.tcCompra && (
              <div className="text-sm font-medium text-slate-700">
                Compra: S/ {orden.tcCompra.toFixed(3)}
              </div>
            )}
            {orden.tcPago && orden.tcPago !== orden.tcCompra && (
              <div className="text-sm font-medium text-slate-700">
                Pago: S/ {orden.tcPago.toFixed(3)}
              </div>
            )}
          </div>
        )}

        {orden.totalPEN && (
          <div className="bg-white rounded-lg p-3 border border-emerald-200 bg-emerald-50">
            <div className="text-xs text-slate-500">Total PEN</div>
            <div className="text-lg font-bold text-emerald-600">S/ {orden.totalPEN.toFixed(2)}</div>
          </div>
        )}

        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <div className="text-xs text-slate-500 flex items-center">
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
          <div className={`bg-white rounded-lg p-3 border ${orden.diferenciaCambiaria > 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="text-xs text-slate-500 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              Dif. Cambiaria
            </div>
            <div className={`text-lg font-bold ${orden.diferenciaCambiaria > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {orden.diferenciaCambiaria > 0 ? '+' : ''}S/ {orden.diferenciaCambiaria.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Productos: por sub-orden si existen, o tabla plana */}
      {orden.subOrdenes && orden.subOrdenes.length > 0 ? (
        <div className="space-y-3">
          {orden.subOrdenes.map((sub, idx) => (
            <SubOrdenCard
              key={sub.id || idx}
              subOrden={sub}
              index={idx}
              mode="compact"
            />
          ))}
          {/* Totales OC */}
          <div className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-700">
            <span>Total OC: {totalPedido} unidades en {orden.subOrdenes.length} sub-ordenes</span>
            <span className="font-mono">${orden.subtotalUSD.toFixed(2)}</span>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Productos ({orden.productos.length})
            </h5>
            {tieneRecepciones && (
              <span className="text-xs text-slate-500">
                Recibido: {totalRecibido} / {totalPedido} unidades
              </span>
            )}
          </div>

          {/* Vista móvil: cards */}
          <div className="sm:hidden divide-y divide-slate-100">
            {orden.productos.map((prod, idx) => {
              const recibida = prod.cantidadRecibida || 0;
              const porcentaje = prod.cantidad > 0 ? (recibida / prod.cantidad) * 100 : 0;
              const desc = getDescripcionProducto(prod);

              return (
                <div key={idx} className="px-4 py-3">
                  <div className="text-sm font-medium text-slate-900">
                    {prod.marca} {prod.nombreComercial}
                  </div>
                  <div className="flex items-center flex-wrap gap-x-1.5 text-[10px] text-slate-500 mt-0.5">
                    <span className="font-mono text-slate-400">{prod.sku}</span>
                    {desc && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span>{desc}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">{prod.cantidad}u × <span className="font-mono">${(prod.costoUnitario ?? 0).toFixed(2)}</span></span>
                      <span className="font-semibold text-slate-900 font-mono">${(prod.subtotal ?? 0).toFixed(2)}</span>
                    </div>
                    {tieneRecepciones && (
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${recibida >= prod.cantidad ? 'text-emerald-600' : recibida > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {recibida}/{prod.cantidad}
                        </span>
                        {recibida > 0 && (
                          <div className="w-12 h-1.5 bg-slate-200 rounded-full">
                            <div
                              className={`h-full rounded-full ${porcentaje >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(porcentaje, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Totales móvil */}
            <div className="px-4 py-3 bg-slate-50 flex items-center justify-between text-xs font-bold">
              <span className="text-slate-600">{totalPedido} unidades</span>
              <span className="font-mono">${orden.subtotalUSD.toFixed(2)}</span>
            </div>
          </div>

          {/* Vista desktop: DataTable */}
          <div className="hidden sm:block">
            {(() => {
              type ProductoOC = (typeof orden.productos)[number];
              const productoCols: DataTableColumn<ProductoOC>[] = [
                {
                  key: 'producto',
                  header: 'Producto',
                  render: (prod) => {
                    const desc = getDescripcionProducto(prod);
                    return (
                      <div>
                        <div className="font-medium text-slate-900" title={`${prod.marca} ${prod.nombreComercial}`}>
                          {prod.marca} {prod.nombreComercial}
                        </div>
                        <div className="flex items-center flex-wrap gap-x-1.5 text-[10px] text-slate-500 mt-0.5">
                          <span className="font-mono text-slate-400">{prod.sku}</span>
                          {desc && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span>{desc}</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  },
                },
                {
                  key: 'cantidad',
                  header: 'Cant.',
                  align: 'right',
                  width: 'w-16',
                  render: (prod) => <span className="font-medium">{prod.cantidad}</span>,
                },
                {
                  key: 'costoUnitario',
                  header: 'Costo Unit.',
                  align: 'right',
                  width: 'w-28',
                  render: (prod) => <span className="font-mono">${(prod.costoUnitario ?? 0).toFixed(2)}</span>,
                },
                {
                  key: 'subtotal',
                  header: 'Subtotal',
                  align: 'right',
                  width: 'w-28',
                  render: (prod) => <span className="font-mono font-medium">${(prod.subtotal ?? 0).toFixed(2)}</span>,
                },
                ...(tieneRecepciones
                  ? [{
                      key: 'recibido',
                      header: 'Recibido',
                      align: 'right' as const,
                      width: 'w-28',
                      render: (prod: ProductoOC) => {
                        const recibida = prod.cantidadRecibida || 0;
                        const porcentaje = prod.cantidad > 0 ? (recibida / prod.cantidad) * 100 : 0;
                        return (
                          <div className="flex flex-col items-end gap-1">
                            <span className={`font-medium ${recibida >= prod.cantidad ? 'text-emerald-600' : recibida > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                              {recibida}/{prod.cantidad}
                            </span>
                            {recibida > 0 && (
                              <div className="w-16 h-1.5 bg-slate-200 rounded-full">
                                <div
                                  className={`h-full rounded-full ${porcentaje >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                  style={{ width: `${Math.min(porcentaje, 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      },
                    }]
                  : []),
              ];

              return (
                <DataTable<ProductoOC>
                  columns={productoCols}
                  data={orden.productos}
                  keyExtractor={(prod) => prod.sku}
                  compact
                />
              );
            })()}
            {/* Fila de totales */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-700">
              <span>Totales: {totalPedido} unidades</span>
              <div className="flex items-center gap-6">
                {tieneRecepciones && (
                  <span className="text-slate-600">{totalRecibido}/{totalPedido} recibidas</span>
                )}
                <span className="font-mono">${orden.subtotalUSD.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recepciones */}
      {orden.recepcionesParciales && orden.recepcionesParciales.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mt-4">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center">
              <ClipboardCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
              Recepciones ({orden.recepcionesParciales.length})
            </h5>
            {orden.nombreAlmacenDestino && (
              <span className="text-xs text-slate-500">
                Destino: <span className="font-medium text-sky-700">{orden.nombreAlmacenDestino}</span>
              </span>
            )}
          </div>
          <div className="divide-y divide-slate-100">
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
        <div className="mt-4 text-xs text-slate-500 bg-sky-50 rounded-lg p-3 border border-sky-100">
          <div className="flex items-start">
            <Info className="h-4 w-4 text-sky-500 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-slate-700">Observaciones:</strong> {orden.observaciones}
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
  // Búsqueda
  const [busqueda, setBusqueda] = useState('');

  // Filtrar por búsqueda
  const ordenesBuscadas = React.useMemo(() => {
    if (!busqueda.trim()) return ordenes;
    const q = busqueda.toLowerCase().trim();
    return ordenes.filter(o =>
      o.numeroOrden.toLowerCase().includes(q) ||
      o.nombreProveedor.toLowerCase().includes(q) ||
      (o.nombreAlmacenDestino || '').toLowerCase().includes(q) ||
      (o.courier || '').toLowerCase().includes(q) ||
      o.productos.some(p =>
        p.marca.toLowerCase().includes(q) ||
        p.nombreComercial.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.presentacion || '').toLowerCase().includes(q) ||
        (p.contenido || '').toLowerCase().includes(q) ||
        (p.dosaje || '').toLowerCase().includes(q) ||
        (p.sabor || '').toLowerCase().includes(q)
      )
    );
  }, [ordenes, busqueda]);

  // Paginación
  const {
    currentPage,
    itemsPerPage,
    setPage,
    setItemsPerPage,
    paginatedItems: ordenesPaginadas
  } = usePagination({
    items: ordenesBuscadas,
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (ordenes.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-slate-400" />
        <h3 className="mt-2 text-sm font-medium text-slate-900">No hay órdenes de compra</h3>
        <p className="mt-1 text-sm text-slate-500">Comienza creando tu primera orden</p>
      </div>
    );
  }


  return (
    <div>
      {/* Barra de búsqueda */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por producto, SKU, marca, proveedor, destino..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
        {busqueda && (
          <div className="text-xs text-slate-500 mt-1">
            {ordenesBuscadas.length} de {ordenes.length} órdenes
          </div>
        )}
      </div>

      {(() => {
        const ocColumns: DataTableColumn<OrdenCompra>[] = [
          {
            key: 'numeroOrden',
            header: 'Número Orden',
            render: (orden) => (
              <div>
                <div className="flex items-center">
                  <Package className="h-4 w-4 text-slate-400 mr-2 flex-shrink-0" />
                  <span className="text-sm font-mono font-medium text-slate-900">
                    {orden.numeroOrden}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  <LineaNegocioBadge lineaNegocioId={orden.lineaNegocioId} />
                  <PaisOrigenBadge paisOrigen={(orden as any).paisOrigen} />
                </div>
              </div>
            ),
          },
          {
            key: 'proveedor',
            header: 'Proveedor',
            render: (orden) => (
              <div className="text-sm text-slate-900">{orden.nombreProveedor}</div>
            ),
          },
          {
            key: 'productos',
            header: 'Productos',
            hideOnMobile: true,
            render: (orden) => (
              <div className="space-y-1.5 max-w-[340px]">
                {orden.productos.slice(0, 3).map((p, idx) => {
                  const desc = getDescripcionProducto(p);
                  return (
                    <div key={idx} className="text-xs leading-tight">
                      <div className="font-semibold text-slate-900 truncate">{p.marca} {p.nombreComercial}</div>
                      <div className="flex items-center flex-wrap gap-x-1.5 text-[10px] text-slate-500 mt-0.5">
                        <span className="font-mono text-slate-400">{p.sku}</span>
                        {desc && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span>{desc}</span>
                          </>
                        )}
                        <span className="text-slate-300">·</span>
                        <span className="font-medium text-slate-600">{p.cantidad}u × ${(p.costoUnitario ?? 0).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
                {orden.productos.length > 3 && (
                  <div className="text-[10px] text-slate-400">
                    +{orden.productos.length - 3} producto{orden.productos.length - 3 > 1 ? 's' : ''} más
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'total',
            header: 'Total',
            render: (orden) => (
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  ${orden.totalUSD.toFixed(2)}
                </div>
                {orden.totalPEN && (
                  <div className="text-xs text-slate-500">
                    S/ {orden.totalPEN.toFixed(2)}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'estado',
            header: 'Estado',
            render: (orden) => {
              const estadoInfo = estadoLabels[orden.estado] || estadoLabels.borrador;
              const subResumen = getSubOrdenResumen(orden.subOrdenes);
              return (
                <div className="flex flex-col gap-1">
                  <Badge variant={estadoInfo.variant}>
                    {estadoInfo.label}
                  </Badge>
                  {subResumen && (
                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded w-fit font-medium ${
                      subResumen.recibidas === subResumen.total
                        ? 'bg-emerald-50 text-emerald-700'
                        : subResumen.recibidas > 0 || subResumen.enTransito > 0
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Layers className="h-2.5 w-2.5" />
                      {subResumen.recibidas}/{subResumen.total} sub-ord.
                    </span>
                  )}
                  {subResumen && subResumen.pagadas > 0 && subResumen.pagadas < subResumen.total && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded w-fit font-medium bg-amber-50 text-amber-700">
                      <CreditCard className="h-2.5 w-2.5" />
                      {subResumen.pagadas}/{subResumen.total} pagadas
                    </span>
                  )}
                  {orden.diferenciaCambiaria && Math.abs(orden.diferenciaCambiaria) > 0 && (
                    <div className="flex items-center">
                      <TrendingUp className="h-3 w-3 text-amber-500 mr-1" />
                      <span className="text-xs text-amber-600">Dif. FX</span>
                    </div>
                  )}
                  {orden.nombreAlmacenDestino && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded w-fit">
                      <MapPin className="h-2.5 w-2.5" />
                      {orden.nombreAlmacenDestino}
                    </span>
                  )}
                  {orden.courier && (
                    <span className="text-[10px] text-slate-500">
                      {orden.courier}
                    </span>
                  )}
                </div>
              );
            },
          },
          {
            key: 'fechaCreacion',
            header: 'Fecha Creación',
            hideOnMobile: true,
            render: (orden) => (
              <div className="text-sm text-slate-900">
                {formatDate(orden.fechaCreacion)}
              </div>
            ),
          },
          {
            key: 'acciones',
            header: 'Acciones',
            align: 'right',
            render: (orden) => (
              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onView(orden); }}
                  className="text-teal-600 hover:text-teal-900"
                  title="Ver detalles"
                >
                  <Eye className="h-4 w-4" />
                </button>
                {orden.estado === 'borrador' && onEdit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(orden); }}
                    className="text-slate-600 hover:text-slate-900"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {['borrador', 'enviada', 'en_transito', 'cancelada'].includes(orden.estado) && !orden.inventarioGenerado && onDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(orden); }}
                    className="text-red-600 hover:text-red-900"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ),
          },
        ];

        return (
          <DataTable<OrdenCompra>
            columns={ocColumns}
            data={ordenesPaginadas}
            keyExtractor={(orden) => orden.id}
            compact
            expandedRowRender={(orden) => <DesgloseOrdenCompra orden={orden} />}
            expandedKeys={expandedRows}
            onToggleExpand={toggleRow}
          />
        );
      })()}

      {/* Paginación */}
      {ordenesBuscadas.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={ordenesBuscadas.length}
          pageSize={itemsPerPage}
          onPageChange={setPage}
          onPageSizeChange={setItemsPerPage}
        />
      )}
    </div>
  );
};
