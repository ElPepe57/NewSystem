import React, { useState } from 'react';
import { formatFecha as formatDate } from '../../../utils/dateFormatters';
import { Package, Eye, Pencil, Trash2, TrendingUp, ChevronDown, ChevronUp, DollarSign, CreditCard, Layers, Info, User, ClipboardCheck, MapPin, Search } from 'lucide-react';
import { Badge, Pagination, usePagination, LineaNegocioBadge, PaisOrigenBadge } from '../../common';
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
  pagado: { label: 'Pagada', variant: 'success' },
  parcial: { label: 'Pago Parcial', variant: 'warning' }
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
  const impuesto = orden.impuestoCompraUSD ?? orden.impuestoUSD ?? 0;
  const envio = orden.costoEnvioProveedorUSD ?? orden.gastosEnvioUSD ?? 0;
  const otros = orden.otrosGastosCompraUSD ?? orden.otrosGastosUSD ?? 0;
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
    <div className="bg-gradient-to-br from-slate-50 to-gray-100 p-5 border-t border-gray-200 sticky left-0 max-w-[100vw] overflow-hidden sm:static sm:max-w-none sm:overflow-visible">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
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

        {/* Vista móvil: cards */}
        <div className="sm:hidden divide-y divide-gray-100">
          {orden.productos.map((prod, idx) => {
            const recibida = prod.cantidadRecibida || 0;
            const porcentaje = prod.cantidad > 0 ? (recibida / prod.cantidad) * 100 : 0;
            const chips: string[] = [];
            if (prod.presentacion) chips.push(prod.presentacion);
            if (prod.contenido) chips.push(prod.contenido);
            if (prod.dosaje) chips.push(prod.dosaje);
            if (prod.sabor) chips.push(prod.sabor);

            return (
              <div key={idx} className="px-4 py-3">
                <div className="text-sm font-medium text-gray-900">
                  {prod.marca} {prod.nombreComercial}
                </div>
                <div className="flex items-center flex-wrap gap-x-1.5 text-[10px] text-gray-500 mt-0.5">
                  <span className="font-mono text-gray-400">{prod.sku}</span>
                  {chips.length > 0 && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>{chips.join(' · ')}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">{prod.cantidad}u × <span className="font-mono">${(prod.costoUnitario ?? 0).toFixed(2)}</span></span>
                    <span className="font-semibold text-gray-900 font-mono">${(prod.subtotal ?? 0).toFixed(2)}</span>
                  </div>
                  {tieneRecepciones && (
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${recibida >= prod.cantidad ? 'text-green-600' : recibida > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {recibida}/{prod.cantidad}
                      </span>
                      {recibida > 0 && (
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full">
                          <div
                            className={`h-full rounded-full ${porcentaje >= 100 ? 'bg-green-500' : 'bg-amber-500'}`}
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
          <div className="px-4 py-3 bg-gray-50 flex items-center justify-between text-xs font-bold">
            <span className="text-gray-600">{totalPedido} unidades</span>
            <span className="font-mono">${orden.subtotalUSD.toFixed(2)}</span>
          </div>
        </div>

        {/* Vista desktop: tabla */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Producto</th>
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
                const chips: string[] = [];
                if (prod.presentacion) chips.push(prod.presentacion);
                if (prod.contenido) chips.push(prod.contenido);
                if (prod.dosaje) chips.push(prod.dosaje);
                if (prod.sabor) chips.push(prod.sabor);

                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900" title={`${prod.marca} ${prod.nombreComercial}`}>
                        {prod.marca} {prod.nombreComercial}
                      </div>
                      <div className="flex items-center flex-wrap gap-x-1.5 text-[10px] text-gray-500 mt-0.5">
                        <span className="font-mono text-gray-400">{prod.sku}</span>
                        {chips.length > 0 && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>{chips.join(' · ')}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{prod.cantidad}</td>
                    <td className="px-3 py-2 text-right font-mono">${(prod.costoUnitario ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium">${(prod.subtotal ?? 0).toFixed(2)}</td>
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
                <td className="px-3 py-2 text-right font-medium text-gray-600">Totales:</td>
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
    totalPages,
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


  return (
    <div>
      {/* Barra de búsqueda */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por producto, SKU, marca, proveedor, destino..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
        {busqueda && (
          <div className="text-xs text-gray-500 mt-1">
            {ordenesBuscadas.length} de {ordenes.length} órdenes
          </div>
        )}
      </div>

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
              const estadoInfo = estadoLabels[orden.estado] || estadoLabels.borrador;
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
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <LineaNegocioBadge lineaNegocioId={orden.lineaNegocioId} />
                      <PaisOrigenBadge paisOrigen={(orden as any).paisOrigen} />
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{orden.nombreProveedor}</div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="space-y-1.5 max-w-[340px]">
                      {orden.productos.slice(0, 3).map((p, idx) => {
                        const chips: string[] = [];
                        if (p.presentacion) chips.push(p.presentacion);
                        if (p.contenido) chips.push(p.contenido);
                        if (p.dosaje) chips.push(p.dosaje);
                        if (p.sabor) chips.push(p.sabor);
                        return (
                          <div key={idx} className="text-xs leading-tight">
                            <div className="font-semibold text-gray-900 truncate">{p.marca} {p.nombreComercial}</div>
                            <div className="flex items-center flex-wrap gap-x-1.5 text-[10px] text-gray-500 mt-0.5">
                              <span className="font-mono text-gray-400">{p.sku}</span>
                              {chips.length > 0 && (
                                <>
                                  <span className="text-gray-300">·</span>
                                  <span>{chips.join(' · ')}</span>
                                </>
                              )}
                              <span className="text-gray-300">·</span>
                              <span className="font-medium text-gray-600">{p.cantidad}u × ${(p.costoUnitario ?? 0).toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })}
                      {orden.productos.length > 3 && (
                        <div className="text-[10px] text-gray-400">
                          +{orden.productos.length - 3} producto{orden.productos.length - 3 > 1 ? 's' : ''} más
                        </div>
                      )}
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
                    <div className="flex flex-col gap-1">
                      <Badge variant={estadoInfo.variant}>
                        {estadoInfo.label}
                      </Badge>
                      {orden.diferenciaCambiaria && Math.abs(orden.diferenciaCambiaria) > 0 && (
                        <div className="flex items-center">
                          <TrendingUp className="h-3 w-3 text-warning-500 mr-1" />
                          <span className="text-xs text-warning-600">
                            Dif. FX
                          </span>
                        </div>
                      )}
                      {orden.nombreAlmacenDestino && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded w-fit">
                          <MapPin className="h-2.5 w-2.5" />
                          {orden.nombreAlmacenDestino}
                        </span>
                      )}
                      {orden.courier && (
                        <span className="text-[10px] text-gray-500">
                          📦 {orden.courier}
                        </span>
                      )}
                    </div>
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
