import React, { useState } from 'react';
import { Package, ArrowRight, AlertTriangle } from 'lucide-react';
import { Button, Modal } from '../../common';
import { ProductoSearchVentas, type ProductoVentaSnapshot } from '../entidades/ProductoSearchVentas';
import type { Venta, ProductoDisponible } from '../../../types/venta.types';

interface CorregirProductoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (productoIdAnterior: string, nuevoProductoId: string) => Promise<void>;
  venta: Venta;
  productoActual: {
    productoId: string;
    nombre: string;
    sku: string;
    presentacion: string;
  };
  productosDisponibles: ProductoDisponible[];
  loading?: boolean;
}

export const CorregirProductoModal: React.FC<CorregirProductoModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  venta,
  productoActual,
  productosDisponibles,
  loading = false
}) => {
  const [selectedProduct, setSelectedProduct] = useState<ProductoVentaSnapshot | null>(null);

  const esMismoProducto = selectedProduct?.productoId === productoActual.productoId;
  const puedeConfirmar = selectedProduct && !esMismoProducto && !loading;

  const handleSubmit = async () => {
    if (!selectedProduct || esMismoProducto) return;
    await onSubmit(productoActual.productoId, selectedProduct.productoId);
  };

  const handleClose = () => {
    setSelectedProduct(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Corregir Producto — ${venta.numeroVenta}`}
      size="lg"
      footer={
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {selectedProduct && !esMismoProducto ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                <Package className="h-3 w-3" />
                Producto seleccionado
              </span>
            ) : (
              <span className="text-gray-400 text-xs">Selecciona el producto correcto</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!puedeConfirmar}
              loading={loading}
            >
              Corregir Producto
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Producto actual */}
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
            <Package className="h-4 w-4 text-danger-500" />
            Producto Actual (incorrecto)
          </h3>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <span className="text-xs font-mono text-red-600">{productoActual.sku}</span>
                <p className="text-sm font-medium text-red-900">{productoActual.nombre}</p>
                <p className="text-xs text-red-600">{productoActual.presentacion}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Flecha */}
        <div className="flex justify-center">
          <div className="flex items-center gap-2 text-gray-400">
            <div className="h-px w-8 bg-gray-300" />
            <ArrowRight className="h-4 w-4" />
            <div className="h-px w-8 bg-gray-300" />
          </div>
        </div>

        {/* Buscador de nuevo producto */}
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
            <Package className="h-4 w-4 text-success-500" />
            Nuevo Producto (correcto)
          </h3>
          <ProductoSearchVentas
            productos={productosDisponibles}
            value={selectedProduct}
            onChange={setSelectedProduct}
            placeholder="Buscar producto correcto..."
          />
        </div>

        {/* Preview comparativo */}
        {selectedProduct && !esMismoProducto && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <span className="text-xs font-mono text-green-600">{selectedProduct.sku}</span>
                <p className="text-sm font-medium text-green-900">
                  {selectedProduct.marca} {selectedProduct.nombreComercial}
                </p>
                <p className="text-xs text-green-600">{selectedProduct.presentacion}</p>
                {selectedProduct.stockLibre > 0 ? (
                  <span className="inline-flex items-center mt-1 px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                    Stock: {selectedProduct.stockLibre} disponible{selectedProduct.stockLibre !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="inline-flex items-center mt-1 px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                    Sin stock disponible
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {esMismoProducto && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700">Es el mismo producto. Selecciona uno diferente.</p>
          </div>
        )}

        {/* Warning de cascada */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700">
            <p className="font-medium mb-1">Esta corrección actualizará:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>La venta {venta.numeroVenta}</li>
              {venta.cotizacionOrigenId && (
                <li>La cotización {venta.numeroCotizacionOrigen || 'vinculada'}</li>
              )}
              <li>Requerimientos vinculados</li>
            </ul>
            <p className="mt-1 text-blue-600">Se mantendrán la cantidad y precio actuales.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
