import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Package,
  Zap,
  Truck,
  Loader2,
  RotateCw,
  Play,
} from 'lucide-react';
import { useMercadoLibreStore } from '../../store/mercadoLibreStore';
import { Modal } from '../../components/common/Modal';
import type { MLOrderSync } from '../../types/mercadoLibre.types';
import { History } from 'lucide-react';

// ---- HELPER ----
const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// ---- ORDER DETAIL MODAL ----
const OrderDetailModal: React.FC<{ order: MLOrderSync; onClose: () => void }> = ({ order, onClose }) => {
  const { procesarOrden, procesando, procesandoOrderId } = useMercadoLibreStore();
  const isProcessing = procesando && procesandoOrderId === order.id;

  const canProcess = (order.estado === 'pendiente' || order.estado === 'error') && order.todosVinculados;

  const handleProcesar = async () => {
    try {
      await procesarOrden(order.id);
      onClose();
    } catch {
      // Error shown in store
    }
  };

  const costoEnvioCliente = order.costoEnvioCliente || 0;
  const cargoEnvioML = order.cargoEnvioML || 0;
  const esFlex = order.metodoEnvio === 'flex';
  const envioComoIngreso = esFlex ? costoEnvioCliente : 0;
  const totalConEnvio = order.totalML + envioComoIngreso;

  return (
    <Modal isOpen onClose={onClose} title={order.packId ? `Pack-${order.packId}` : `Orden ML-${order.mlOrderId}`} size="lg">
      <div className="space-y-4">
        {/* Estado + Origen */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${
              order.estado === 'procesada' ? 'text-green-600 bg-green-50' :
              order.estado === 'error' ? 'text-red-600 bg-red-50' :
              order.estado === 'ignorada' ? 'text-gray-600 bg-gray-50' :
              'text-amber-600 bg-amber-50'
            }`}>
              {order.estado === 'procesada' ? <CheckCircle2 className="w-4 h-4" /> :
               order.estado === 'error' ? <XCircle className="w-4 h-4" /> :
               order.estado === 'ignorada' ? <XCircle className="w-4 h-4" /> :
               <Clock className="w-4 h-4" />}
              {order.estado.charAt(0).toUpperCase() + order.estado.slice(1)}
            </span>
            {order.origen === 'importacion_historica' && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">
                <History className="w-3 h-3" />
                Importado
              </span>
            )}
            {order.packId && (order.subOrderIds?.length || 0) > 1 && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                <Package className="w-3 h-3" />
                Pack {order.productos?.length || 0} productos
              </span>
            )}
          </div>
          <div className="text-right">
            {order.numeroVenta && (
              <span className="text-sm font-medium text-green-600">{order.numeroVenta}</span>
            )}
            {order.fechaOrdenML && (
              <p className="text-xs text-gray-400">
                {order.fechaOrdenML.toDate().toLocaleDateString('es-PE', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>

        {/* ML Status */}
        {order.mlStatus && order.mlStatus !== 'paid' && (
          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            Estado en ML: <span className="font-medium">{order.mlStatus}</span>
          </div>
        )}

        {/* Pack sub-orders info */}
        {order.packId && order.subOrderIds && order.subOrderIds.length > 1 && (
          <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
            <span className="font-medium">Compra multi-producto:</span>{' '}
            {order.subOrderIds.length} sub-órdenes ML ({order.subOrderIds.map((id: number) => `#${id}`).join(', ')})
          </div>
        )}

        {/* Error */}
        {order.errorDetalle && (
          <div className="text-sm bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">
            {order.errorDetalle}
          </div>
        )}

        {/* Buyer */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
          <h4 className="text-xs font-semibold text-gray-500 uppercase">Comprador</h4>
          <p className="text-sm font-medium">{order.mlBuyerName ? toTitleCase(order.mlBuyerName) : `Buyer #${order.mlBuyerId}`}</p>
          {order.mlBuyerNickname && <p className="text-xs text-gray-400">@{order.mlBuyerNickname}</p>}
          {order.buyerDni && <p className="text-xs text-gray-500">{order.buyerDocType || 'DNI'}: {order.buyerDni}</p>}
          {order.razonSocial && <p className="text-xs text-gray-500 font-medium">{order.razonSocial}</p>}
          {order.buyerEmail && <p className="text-xs text-gray-500">{order.buyerEmail}</p>}
          {order.buyerPhone && <p className="text-xs text-gray-500">Tel: {order.buyerPhone}</p>}
        </div>

        {/* Dirección */}
        {order.direccionEntrega && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <h4 className="text-xs font-semibold text-gray-500 uppercase">Dirección de entrega</h4>
            <p className="text-sm">{order.direccionEntrega}</p>
            {(order.distrito || order.provincia) && (
              <p className="text-xs text-gray-500">
                {[order.distrito, order.provincia].filter(Boolean).join(', ')}
                {order.codigoPostal && ` · C.P. ${order.codigoPostal}`}
              </p>
            )}
            {order.referenciaEntrega && (
              <p className="text-xs text-gray-500 italic">Ref: {order.referenciaEntrega}</p>
            )}
            {order.trackingNumber && (
              <p className="text-xs text-gray-500">Tracking: {order.trackingNumber}</p>
            )}
          </div>
        )}

        {/* Productos */}
        {order.productos && order.productos.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Productos</h4>
            <div className="space-y-2">
              {order.productos.map((prod: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {prod.productoNombre || prod.mlTitle}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {prod.productoSku && (
                        <span className="text-xs text-gray-400">SKU: {prod.productoSku}</span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        prod.vinculado
                          ? 'bg-green-100 text-green-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {prod.vinculado ? 'Vinculado' : 'Sin vincular'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-sm font-medium">{prod.cantidad} × S/ {prod.precioUnitario.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">Fee: S/ {(prod.saleFee * prod.cantidad).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totales */}
        <div className="border-t pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal productos</span>
            <span className="font-medium">S/ {order.totalML.toFixed(2)}</span>
          </div>
          {esFlex && costoEnvioCliente > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Envío Flex (cliente paga)</span>
              <span className="font-medium">S/ {costoEnvioCliente.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold border-t pt-1">
            <span>Total</span>
            <span>S/ {totalConEnvio.toFixed(2)}</span>
          </div>
          {order.comisionML > 0 && (
            <div className="flex justify-between text-xs text-gray-400">
              <span>Comisión ML</span>
              <span>- S/ {order.comisionML.toFixed(2)}</span>
            </div>
          )}
          {cargoEnvioML > 0 && (
            <div className="flex justify-between text-xs text-gray-400">
              <span>Cargo por envío ML{!esFlex && costoEnvioCliente > 0 ? ` (cliente pagó S/ ${costoEnvioCliente.toFixed(2)})` : ''}</span>
              <span>- S/ {cargoEnvioML.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Acción */}
        {canProcess && (
          <button
            onClick={handleProcesar}
            disabled={procesando}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : order.estado === 'error' ? (
              <RotateCw className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {order.estado === 'error' ? 'Reintentar procesamiento' : 'Procesar orden → Crear venta ERP'}
          </button>
        )}
      </div>
    </Modal>
  );
};

// ---- ORDER ROW ----
export const OrderRow: React.FC<{ order: MLOrderSync; expanded?: boolean }> = ({ order, expanded }) => {
  const { procesarOrden, procesando, procesandoOrderId } = useMercadoLibreStore();
  const [showDetail, setShowDetail] = useState(false);
  const [showError, setShowError] = useState(false);
  const isProcessing = procesando && procesandoOrderId === order.id;

  const estadoConfig = {
    pendiente: { icon: Clock, color: 'text-amber-600 bg-amber-50', label: 'Pendiente' },
    procesada: { icon: CheckCircle2, color: 'text-green-600 bg-green-50', label: 'Procesada' },
    error: { icon: XCircle, color: 'text-red-600 bg-red-50', label: 'Error' },
    ignorada: { icon: XCircle, color: 'text-gray-600 bg-gray-50', label: 'Ignorada' },
  };
  const cfg = estadoConfig[order.estado] || estadoConfig.pendiente;
  const Icon = cfg.icon;

  const handleProcesar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await procesarOrden(order.id);
    } catch {
      // Error manejado en el store
    }
  };

  const canProcess = (order.estado === 'pendiente' || order.estado === 'error') && order.todosVinculados;
  const hasUnlinked = order.estado === 'pendiente' && !order.todosVinculados;

  const total = (order.totalML || 0) + (order.costoEnvioCliente || 0);
  const fechaStr = order.fechaOrdenML
    ? order.fechaOrdenML.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;
  const buyerName = order.mlBuyerName ? toTitleCase(order.mlBuyerName) : `Buyer #${order.mlBuyerId}`;

  const isPack = !!(order.packId && (order.subOrderIds?.length || 0) > 1);
  const packProductCount = order.productos?.length || 0;

  const badges = (
    <>
      {isPack && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium leading-none inline-flex items-center gap-0.5">
          <Package className="w-2.5 h-2.5" />Pack {packProductCount} prod.
        </span>
      )}
      {order.origen === 'importacion_historica' && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-medium leading-none">
          Importado
        </span>
      )}
      {order.metodoEnvio === 'flex' && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium leading-none inline-flex items-center gap-0.5">
          <Zap className="w-2.5 h-2.5" />Flex
        </span>
      )}
      {order.metodoEnvio === 'urbano' && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium leading-none inline-flex items-center gap-0.5">
          <Truck className="w-2.5 h-2.5" />Urbano
        </span>
      )}
    </>
  );

  const processButton = canProcess && (
    <button
      onClick={handleProcesar}
      disabled={procesando}
      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
      title={order.estado === 'error' ? 'Reintentar' : 'Procesar'}
    >
      {isProcessing ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : order.estado === 'error' ? (
        <RotateCw className="w-3 h-3" />
      ) : (
        <Play className="w-3 h-3" />
      )}
      {order.estado === 'error' ? 'Reintentar' : 'Procesar'}
    </button>
  );

  return (
    <>
      {/* ---- Mobile card ---- */}
      <div
        className="sm:hidden px-4 py-3 hover:bg-gray-50 cursor-pointer space-y-2"
        onClick={() => setShowDetail(true)}
      >
        {/* Row 1: Estado + Total */}
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${cfg.color}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
          </span>
          <span className="text-sm font-bold text-gray-900">S/ {total.toFixed(2)}</span>
        </div>
        {/* Row 2: Order ID + Venta */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-mono text-gray-600">
            {isPack ? `Pack-${order.packId}` : `ML-${order.mlOrderId}`}
          </span>
          {order.numeroVenta && (
            <span className="text-xs font-semibold text-green-600">→ {order.numeroVenta}</span>
          )}
        </div>
        {/* Row 3: Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {badges}
        </div>
        {/* Row 4: Buyer + Date */}
        <div className="text-xs text-gray-500 truncate">
          {buyerName}
          {expanded && order.distrito && ` · ${order.distrito}`}
          {fechaStr && <span> · {fechaStr}</span>}
        </div>
        {/* Row 5: Financial details */}
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          {order.comisionML > 0 && <span>Com: S/ {order.comisionML.toFixed(2)}</span>}
          {(order.costoEnvioCliente || 0) > 0 && <span>Envío: S/ {(order.costoEnvioCliente || 0).toFixed(2)}</span>}
          {(order.cargoEnvioML || 0) > 0 && <span>Envío ML: S/ {(order.cargoEnvioML || 0).toFixed(2)}</span>}
        </div>
        {/* Warnings */}
        {hasUnlinked && (
          <p className="text-xs text-orange-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Productos sin vincular
          </p>
        )}
        {order.estado === 'error' && order.errorDetalle && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowError(!showError); }}
            className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
          >
            <AlertCircle className="w-3 h-3" />
            Ver error
          </button>
        )}
        {/* Process button */}
        {processButton && (
          <div className="pt-1" onClick={(e) => e.stopPropagation()}>
            {processButton}
          </div>
        )}
      </div>

      {/* ---- Desktop row ---- */}
      <div
        className="hidden sm:flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer"
        onClick={() => setShowDetail(true)}
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${cfg.color}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5 flex-wrap">
              {isPack ? `Pack-${order.packId}` : `ML-${order.mlOrderId}`}
              {order.numeroVenta && (
                <span className="text-green-600">→ {order.numeroVenta}</span>
              )}
              {badges}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {buyerName}
              {expanded && order.distrito && ` · ${order.distrito}`}
              {fechaStr && <span className="ml-1">· {fechaStr}</span>}
            </p>
            {hasUnlinked && (
              <p className="text-xs text-orange-500 flex items-center gap-1 mt-0.5">
                <AlertTriangle className="w-3 h-3" />
                Productos sin vincular
              </p>
            )}
            {order.estado === 'error' && order.errorDetalle && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowError(!showError); }}
                className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 mt-0.5"
              >
                <AlertCircle className="w-3 h-3" />
                Ver error
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold">S/ {total.toFixed(2)}</p>
            {(order.costoEnvioCliente || 0) > 0 && (
              <p className="text-xs text-gray-400">Envío: S/ {(order.costoEnvioCliente || 0).toFixed(2)}</p>
            )}
            {order.comisionML > 0 && (
              <p className="text-xs text-gray-400">Com: S/ {order.comisionML.toFixed(2)}</p>
            )}
            {(order.cargoEnvioML || 0) > 0 && (
              <p className="text-xs text-gray-400">Envío ML: S/ {(order.cargoEnvioML || 0).toFixed(2)}</p>
            )}
          </div>
          {processButton}
        </div>
      </div>

      {showError && order.errorDetalle && (
        <div className="px-4 pb-3 -mt-1">
          <div className="text-xs bg-red-50 border border-red-200 rounded-lg p-2 text-red-700">
            {order.errorDetalle}
          </div>
        </div>
      )}

      {showDetail && (
        <OrderDetailModal order={order} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
};
