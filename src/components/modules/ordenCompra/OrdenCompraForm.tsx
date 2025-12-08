import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { Button, Input, Select } from '../../common';
import type { OrdenCompraFormData } from '../../../types/ordenCompra.types';
import type { Proveedor } from '../../../types/ordenCompra.types';
import type { Producto } from '../../../types/producto.types';

interface OrdenCompraFormProps {
  proveedores: Proveedor[];
  productos: Producto[];
  onSubmit: (data: OrdenCompraFormData) => void;
  onCancel: () => void;
  loading?: boolean;
  tcSugerido?: number;
}

interface ProductoOrdenItem {
  productoId: string;
  cantidad: number;
  costoUnitario: number;
}

const almacenOptions = [
  { value: 'miami_1', label: 'Miami 1' },
  { value: 'miami_2', label: 'Miami 2' },
  { value: 'utah', label: 'Utah' }
];

export const OrdenCompraForm: React.FC<OrdenCompraFormProps> = ({
  proveedores,
  productos,
  onSubmit,
  onCancel,
  loading = false,
  tcSugerido
}) => {
  const [proveedorId, setProveedorId] = useState('');
  const [productosOrden, setProductosOrden] = useState<ProductoOrdenItem[]>([
    { productoId: '', cantidad: 1, costoUnitario: 0 }
  ]);
  const [gastosEnvioUSD, setGastosEnvioUSD] = useState(0);
  const [otrosGastosUSD, setOtrosGastosUSD] = useState(0);
  const [tcCompra, setTcCompra] = useState(tcSugerido || 0);
  const [almacenDestino, setAlmacenDestino] = useState('miami_1');
  const [observaciones, setObservaciones] = useState('');

  // Actualizar TC sugerido cuando cambie
  useEffect(() => {
    if (tcSugerido && tcCompra === 0) {
      setTcCompra(tcSugerido);
    }
  }, [tcSugerido]);

  // Calcular totales
  const subtotalUSD = productosOrden.reduce((sum, item) => {
    if (item.productoId && item.cantidad > 0 && item.costoUnitario > 0) {
      return sum + (item.cantidad * item.costoUnitario);
    }
    return sum;
  }, 0);

  const totalUSD = subtotalUSD + gastosEnvioUSD + otrosGastosUSD;
  const totalPEN = tcCompra > 0 ? totalUSD * tcCompra : 0;

  // Agregar producto
  const handleAddProducto = () => {
    setProductosOrden([...productosOrden, { productoId: '', cantidad: 1, costoUnitario: 0 }]);
  };

  // Eliminar producto
  const handleRemoveProducto = (index: number) => {
    if (productosOrden.length > 1) {
      setProductosOrden(productosOrden.filter((_, i) => i !== index));
    }
  };

  // Actualizar producto
  const handleProductoChange = (index: number, field: keyof ProductoOrdenItem, value: any) => {
    const nuevosProductos = [...productosOrden];
    nuevosProductos[index] = {
      ...nuevosProductos[index],
      [field]: field === 'productoId' ? value : parseFloat(value) || 0
    };
    setProductosOrden(nuevosProductos);
  };

  // Enviar formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar que haya al menos un producto válido
    const productosValidos = productosOrden.filter(p => 
      p.productoId && p.cantidad > 0 && p.costoUnitario > 0
    );
    
    if (productosValidos.length === 0) {
      alert('Debes agregar al menos un producto con cantidad y costo válidos');
      return;
    }
    
    const data: OrdenCompraFormData = {
      proveedorId,
      productos: productosValidos,
      almacenDestino,
      observaciones
    };
    
    if (gastosEnvioUSD > 0) data.gastosEnvioUSD = gastosEnvioUSD;
    if (otrosGastosUSD > 0) data.otrosGastosUSD = otrosGastosUSD;
    if (tcCompra > 0) data.tcCompra = tcCompra;
    
    onSubmit(data);
  };

  // Obtener nombre de producto
  const getProductoNombre = (productoId: string) => {
    const producto = productos.find(p => p.id === productoId);
    return producto ? `${producto.marca} ${producto.nombreComercial}` : '';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Proveedor */}
      <div>
        <Select
          label="Proveedor"
          value={proveedorId}
          onChange={(e) => setProveedorId(e.target.value)}
          options={proveedores
            .filter(p => p.activo)
            .map(p => ({ value: p.id, label: `${p.nombre} (${p.pais})` }))}
          required
        />
      </div>

      {/* Productos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-900">Productos</h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddProducto}
          >
            <Plus className="h-4 w-4 mr-1" />
            Agregar Producto
          </Button>
        </div>

        <div className="space-y-3">
          {productosOrden.map((item, index) => (
            <div key={index} className="flex items-end space-x-3 p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <Select
                  label="Producto"
                  value={item.productoId}
                  onChange={(e) => handleProductoChange(index, 'productoId', e.target.value)}
                  options={productos
                    .filter(p => p.estado === 'activo')
                    .map(p => ({ 
                      value: p.id, 
                      label: `${p.sku} - ${p.marca} ${p.nombreComercial}` 
                    }))}
                  required
                />
              </div>

              <div className="w-32">
                <Input
                  label="Cantidad"
                  type="number"
                  min="1"
                  value={item.cantidad}
                  onChange={(e) => handleProductoChange(index, 'cantidad', e.target.value)}
                  required
                />
              </div>

              <div className="w-40">
                <Input
                  label="Costo Unit. (USD)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.costoUnitario}
                  onChange={(e) => handleProductoChange(index, 'costoUnitario', e.target.value)}
                  required
                />
              </div>

              <div className="w-40">
                <div className="text-xs text-gray-600 mb-1">Subtotal</div>
                <div className="text-lg font-semibold text-gray-900">
                  ${(item.cantidad * item.costoUnitario).toFixed(2)}
                </div>
              </div>

              {productosOrden.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveProducto(index)}
                  className="text-danger-600 hover:text-danger-900"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Gastos Adicionales */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Gastos Adicionales</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Gastos de Envío (USD)"
            type="number"
            step="0.01"
            min="0"
            value={gastosEnvioUSD}
            onChange={(e) => setGastosEnvioUSD(parseFloat(e.target.value) || 0)}
          />
          
          <Input
            label="Otros Gastos (USD)"
            type="number"
            step="0.01"
            min="0"
            value={otrosGastosUSD}
            onChange={(e) => setOtrosGastosUSD(parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      {/* Configuración */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Configuración</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Almacén Destino"
            value={almacenDestino}
            onChange={(e) => setAlmacenDestino(e.target.value)}
            options={almacenOptions}
            required
          />
          
          <Input
            label="TC Estimado"
            type="number"
            step="0.001"
            min="0"
            value={tcCompra}
            onChange={(e) => setTcCompra(parseFloat(e.target.value) || 0)}
            helperText={tcSugerido ? `TC actual: ${tcSugerido.toFixed(3)}` : undefined}
          />
        </div>
      </div>

      {/* Totales */}
      <div className="bg-primary-50 p-6 rounded-lg">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Resumen de Orden</h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal Productos:</span>
            <span className="font-semibold">${subtotalUSD.toFixed(2)}</span>
          </div>
          
          {gastosEnvioUSD > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Gastos de Envío:</span>
              <span className="font-semibold">${gastosEnvioUSD.toFixed(2)}</span>
            </div>
          )}
          
          {otrosGastosUSD > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Otros Gastos:</span>
              <span className="font-semibold">${otrosGastosUSD.toFixed(2)}</span>
            </div>
          )}
          
          <div className="border-t border-primary-200 pt-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total USD:</span>
              <span className="text-2xl font-bold text-primary-600">${totalUSD.toFixed(2)}</span>
            </div>
          </div>
          
          {totalPEN > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Estimado PEN (TC {tcCompra.toFixed(3)}):</span>
              <span className="text-lg font-semibold text-gray-900">S/ {totalPEN.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Observaciones */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Observaciones
        </label>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={3}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Notas sobre la orden..."
        />
      </div>

      {/* Botones */}
      <div className="flex items-center justify-end space-x-3 pt-6 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={loading}
        >
          Crear Orden de Compra
        </Button>
      </div>
    </form>
  );
};