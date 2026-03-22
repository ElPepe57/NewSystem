/**
 * DevolucionFormModal.tsx
 *
 * Modal para crear una solicitud de devolución a partir de una venta entregada.
 * Flujo: seleccionar productos → elegir cantidades → motivo → enviar.
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Package } from 'lucide-react';
import { Modal, Button } from '../../components/common';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { devolucionService } from '../../services/devolucion.service';
import { VentaService } from '../../services/venta.service';
import { logger } from '../../lib/logger';
import { formatCurrencyPEN } from '../../utils/format';
import type { Venta } from '../../types/venta.types';
import type { MotivoDevolucion } from '../../types/devolucion.types';

// ================================================================
// CONSTANTES
// ================================================================

const MOTIVOS_DEVOLUCION: Array<{ value: MotivoDevolucion; label: string }> = [
  { value: 'producto_danado', label: 'Producto llegó dañado' },
  { value: 'producto_equivocado', label: 'Producto equivocado enviado' },
  { value: 'no_cumple_expectativa', label: 'No cumple expectativa del cliente' },
  { value: 'vencido_proximo', label: 'Producto próximo a vencer' },
  { value: 'duplicado', label: 'Pedido duplicado' },
  { value: 'error_pedido', label: 'Error en el pedido (cantidad, modelo)' },
  { value: 'otro', label: 'Otro motivo' },
];

// ================================================================
// TIPOS LOCALES
// ================================================================

interface ProductoSeleccionado {
  productoId: string;
  sku: string;
  nombreProducto: string;
  cantidadVendida: number;
  precioUnitarioOriginal: number;
  seleccionado: boolean;
  cantidadDevolver: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ventaId: string;
  onSuccess?: () => void;
}

// ================================================================
// COMPONENTE
// ================================================================

export const DevolucionFormModal: React.FC<Props> = ({
  isOpen,
  onClose,
  ventaId,
  onSuccess,
}) => {
  const user = useAuthStore(state => state.user);
  const toast = useToastStore();

  const [venta, setVenta] = useState<Venta | null>(null);
  const [loadingVenta, setLoadingVenta] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [productos, setProductos] = useState<ProductoSeleccionado[]>([]);
  const [motivo, setMotivo] = useState<MotivoDevolucion>('producto_danado');
  const [detalleMotivo, setDetalleMotivo] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Cargar la venta al abrir el modal
  useEffect(() => {
    if (!isOpen || !ventaId) return;

    const cargarVenta = async () => {
      setLoadingVenta(true);
      try {
        const data = await VentaService.getById(ventaId);
        if (!data) {
          toast.error('No se encontró la venta');
          onClose();
          return;
        }
        setVenta(data);

        // Inicializar selección de productos
        const productosInit: ProductoSeleccionado[] = (data.productos ?? []).map(p => ({
          productoId: p.productoId,
          sku: p.sku ?? '',
          nombreProducto: p.nombreComercial ?? '',
          cantidadVendida: p.cantidad,
          precioUnitarioOriginal: p.precioUnitario ?? 0,
          seleccionado: false,
          cantidadDevolver: 1,
        }));
        setProductos(productosInit);
      } catch (error: any) {
        logger.error('[DevolucionFormModal] Error cargando venta:', error);
        toast.error(error.message || 'Error al cargar la venta');
        onClose();
      } finally {
        setLoadingVenta(false);
      }
    };

    cargarVenta();
  }, [isOpen, ventaId]);

  // Limpiar estado al cerrar
  const handleClose = () => {
    setVenta(null);
    setProductos([]);
    setMotivo('producto_danado');
    setDetalleMotivo('');
    setObservaciones('');
    onClose();
  };

  const toggleProducto = (index: number) => {
    setProductos(prev => prev.map((p, i) =>
      i === index ? { ...p, seleccionado: !p.seleccionado } : p
    ));
  };

  const setCantidad = (index: number, valor: number) => {
    setProductos(prev => prev.map((p, i) => {
      if (i !== index) return p;
      const clampado = Math.max(1, Math.min(valor, p.cantidadVendida));
      return { ...p, cantidadDevolver: clampado };
    }));
  };

  const productosSeleccionados = productos.filter(p => p.seleccionado);

  const montoTotal = productosSeleccionados.reduce(
    (acc, p) => acc + p.cantidadDevolver * p.precioUnitarioOriginal,
    0
  );

  const puedeEnviar =
    productosSeleccionados.length > 0 &&
    motivo !== undefined &&
    (motivo !== 'otro' || detalleMotivo.trim().length > 0);

  const handleSubmit = async () => {
    if (!user || !venta || !puedeEnviar) return;

    setSubmitting(true);
    try {
      await devolucionService.crear(
        {
          ventaId: venta.id,
          productos: productosSeleccionados.map(p => ({
            productoId: p.productoId,
            sku: p.sku,
            nombreProducto: p.nombreProducto,
            cantidad: p.cantidadDevolver,
            precioUnitarioOriginal: p.precioUnitarioOriginal,
          })),
          motivo,
          detalleMotivo: detalleMotivo.trim() || undefined,
        },
        user.uid
      );

      toast.success(
        `Solicitud de devolución creada para la venta ${venta.numeroVenta}`,
        'Devolución Solicitada'
      );
      onSuccess?.();
      handleClose();
    } catch (error: any) {
      logger.error('[DevolucionFormModal] Error creando devolución:', error);
      toast.error(error.message || 'Error al crear la solicitud de devolución');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Solicitar Devolución — ${venta?.numeroVenta ?? '...'}`}
      size="lg"
    >
      {loadingVenta ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : venta ? (
        <div className="space-y-6">
          {/* Información de la venta */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Cliente:</span> {venta.nombreCliente}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-medium">Total de la venta:</span>{' '}
              {formatCurrencyPEN(venta.totalPEN)}
            </p>
          </div>

          {/* Selección de productos */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-500" />
              Productos a devolver
            </h3>
            <div className="space-y-2">
              {productos.map((prod, index) => (
                <div
                  key={prod.productoId}
                  className={`rounded-lg border p-3 transition-colors ${
                    prod.seleccionado
                      ? 'border-primary-300 bg-primary-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id={`prod-${prod.productoId}`}
                      checked={prod.seleccionado}
                      onChange={() => toggleProducto(index)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label
                      htmlFor={`prod-${prod.productoId}`}
                      className="flex-1 cursor-pointer"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {prod.nombreProducto}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        SKU: {prod.sku} &middot; Vendido: {prod.cantidadVendida} ud. &middot;{' '}
                        {formatCurrencyPEN(prod.precioUnitarioOriginal)} / ud.
                      </p>
                    </label>
                    {prod.seleccionado && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">Cant.:</label>
                        <input
                          type="number"
                          min={1}
                          max={prod.cantidadVendida}
                          value={prod.cantidadDevolver}
                          onChange={e => setCantidad(index, parseInt(e.target.value, 10) || 1)}
                          className="w-16 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label
              htmlFor="motivo-devolucion"
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              Motivo de devolución <span className="text-red-500">*</span>
            </label>
            <select
              id="motivo-devolucion"
              value={motivo}
              onChange={e => setMotivo(e.target.value as MotivoDevolucion)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {MOTIVOS_DEVOLUCION.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Detalle obligatorio cuando motivo === 'otro' */}
          {motivo === 'otro' && (
            <div>
              <label
                htmlFor="detalle-motivo"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Detalle del motivo <span className="text-red-500">*</span>
              </label>
              <textarea
                id="detalle-motivo"
                value={detalleMotivo}
                onChange={e => setDetalleMotivo(e.target.value)}
                rows={3}
                placeholder="Describe el motivo de la devolución..."
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
          )}

          {/* Observaciones opcionales */}
          <div>
            <label
              htmlFor="observaciones-devolucion"
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              Observaciones{' '}
              <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              id="observaciones-devolucion"
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Información adicional para el equipo de almacén..."
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Resumen del monto */}
          {productosSeleccionados.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-amber-800">
                  Monto a devolver al cliente:
                </span>
                <span className="text-lg font-bold text-amber-700">
                  {formatCurrencyPEN(montoTotal)}
                </span>
              </div>
              <p className="text-xs text-amber-600 mt-1">
                {productosSeleccionados.length} producto(s) seleccionado(s)
              </p>
            </div>
          )}

          {/* Advertencia si no hay productos seleccionados */}
          {productosSeleccionados.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span>Selecciona al menos un producto para continuar.</span>
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
            <Button variant="secondary" onClick={handleClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!puedeEnviar || submitting}
              loading={submitting}
            >
              Solicitar Devolución
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
