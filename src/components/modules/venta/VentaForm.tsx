import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { Button, Input, Select } from '../../common';
import type { VentaFormData, CanalVenta } from '../../../types/venta.types';
import type { ProductoDisponible } from '../../../types/venta.types';

interface VentaFormProps {
  productosDisponibles: ProductoDisponible[];
  onSubmit: (data: VentaFormData, esVentaDirecta: boolean) => void;
  onCancel: () => void;
  loading?: boolean;
}

interface ProductoVentaItem {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
}

const canalOptions: Array<{ value: CanalVenta; label: string }> = [
  { value: 'mercado_libre', label: 'Mercado Libre' },
  { value: 'directo', label: 'Venta Directa' },
  { value: 'otro', label: 'Otro' }
];

export const VentaForm: React.FC<VentaFormProps> = ({
  productosDisponibles,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [nombreCliente, setNombreCliente] = useState('');
  const [emailCliente, setEmailCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [dniRuc, setDniRuc] = useState('');
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [canal, setCanal] = useState<CanalVenta>('directo');
  const [mercadoLibreId, setMercadoLibreId] = useState('');
  const [productos, setProductos] = useState<ProductoVentaItem[]>([
    { productoId: '', cantidad: 1, precioUnitario: 0 }
  ]);
  const [descuento, setDescuento] = useState(0);
  const [observaciones, setObservaciones] = useState('');

  // Calcular totales
  const subtotalPEN = productos.reduce((sum, item) => {
    if (item.productoId && item.cantidad > 0 && item.precioUnitario > 0) {
      return sum + (item.cantidad * item.precioUnitario);
    }
    return sum;
  }, 0);

  const totalPEN = subtotalPEN - descuento;

  // Agregar producto
  const handleAddProducto = () => {
    setProductos([...productos, { productoId: '', cantidad: 1, precioUnitario: 0 }]);
  };

  // Eliminar producto
  const handleRemoveProducto = (index: number) => {
    if (productos.length > 1) {
      setProductos(productos.filter((_, i) => i !== index));
    }
  };

  // Actualizar producto
  const handleProductoChange = (index: number, field: keyof ProductoVentaItem, value: any) => {
    const nuevosProductos = [...productos];
    
    if (field === 'productoId') {
      nuevosProductos[index] = {
        ...nuevosProductos[index],
        productoId: value
      };
      
      // Auto-llenar precio sugerido
      const producto = productosDisponibles.find(p => p.productoId === value);
      if (producto && producto.precioSugerido > 0) {
        nuevosProductos[index].precioUnitario = producto.precioSugerido;
      }
    } else {
      nuevosProductos[index] = {
        ...nuevosProductos[index],
        [field]: parseFloat(value) || 0
      };
    }
    
    setProductos(nuevosProductos);
  };

  // Enviar como cotización
  const handleSubmitCotizacion = (e: React.FormEvent) => {
    e.preventDefault();
    submitForm(false);
  };

  // Enviar como venta directa
  const handleSubmitVenta = (e: React.FormEvent) => {
    e.preventDefault();
    submitForm(true);
  };

  const submitForm = (esVentaDirecta: boolean) => {
    // Validar que haya al menos un producto válido
    const productosValidos = productos.filter(p => 
      p.productoId && p.cantidad > 0 && p.precioUnitario > 0
    );
    
    if (productosValidos.length === 0) {
      alert('Debes agregar al menos un producto con cantidad y precio válidos');
      return;
    }
    
    const data: VentaFormData = {
      nombreCliente,
      canal,
      productos: productosValidos,
      observaciones
    };
    
    if (emailCliente) data.emailCliente = emailCliente;
    if (telefonoCliente) data.telefonoCliente = telefonoCliente;
    if (dniRuc) data.dniRuc = dniRuc;
    if (direccionEntrega) data.direccionEntrega = direccionEntrega;
    if (descuento > 0) data.descuento = descuento;
    if (canal === 'mercado_libre' && mercadoLibreId) data.mercadoLibreId = mercadoLibreId;
    
    onSubmit(data, esVentaDirecta);
  };

  // Validar stock
  const getStockDisponible = (productoId: string) => {
    const producto = productosDisponibles.find(p => p.productoId === productoId);
    return producto?.unidadesDisponibles || 0;
  };

  const getProductoNombre = (productoId: string) => {
    const producto = productosDisponibles.find(p => p.productoId === productoId);
    return producto ? `${producto.marca} ${producto.nombreComercial}` : '';
  };

  return (
    <form className="space-y-6">
      {/* Cliente */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Datos del Cliente</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nombre del Cliente"
            value={nombreCliente}
            onChange={(e) => setNombreCliente(e.target.value)}
            required
          />
          
          <Input
            label="DNI / RUC"
            value={dniRuc}
            onChange={(e) => setDniRuc(e.target.value)}
          />
          
          <Input
            label="Email"
            type="email"
            value={emailCliente}
            onChange={(e) => setEmailCliente(e.target.value)}
          />
          
          <Input
            label="Teléfono"
            value={telefonoCliente}
            onChange={(e) => setTelefonoCliente(e.target.value)}
          />
        </div>
        
        <div className="mt-4">
          <Input
            label="Dirección de Entrega"
            value={direccionEntrega}
            onChange={(e) => setDireccionEntrega(e.target.value)}
          />
        </div>
      </div>

      {/* Canal */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Canal de Venta"
            value={canal}
            onChange={(e) => setCanal(e.target.value as CanalVenta)}
            options={canalOptions}
            required
          />
          
          {canal === 'mercado_libre' && (
            <Input
              label="ID de Mercado Libre"
              value={mercadoLibreId}
              onChange={(e) => setMercadoLibreId(e.target.value)}
              placeholder="ej: MLB123456789"
            />
          )}
        </div>
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
          {productos.map((item, index) => {
            const stockDisponible = getStockDisponible(item.productoId);
            const stockInsuficiente = item.productoId && item.cantidad > stockDisponible;
            
            return (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <Select
                        label="Producto"
                        value={item.productoId}
                        onChange={(e) => handleProductoChange(index, 'productoId', e.target.value)}
                        options={productosDisponibles.map(p => ({ 
                          value: p.productoId, 
                          label: `${p.sku} - ${p.marca} ${p.nombreComercial} (Stock: ${p.unidadesDisponibles})` 
                        }))}
                        required
                      />
                    </div>

                    <div>
                      <Input
                        label="Cantidad"
                        type="number"
                        min="1"
                        value={item.cantidad}
                        onChange={(e) => handleProductoChange(index, 'cantidad', e.target.value)}
                        required
                      />
                      {stockInsuficiente && (
                        <div className="flex items-center mt-1 text-xs text-danger-600">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Stock: {stockDisponible}
                        </div>
                      )}
                    </div>

                    <div>
                      <Input
                        label="Precio (PEN)"
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.precioUnitario}
                        onChange={(e) => handleProductoChange(index, 'precioUnitario', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-end space-x-2">
                    <div className="text-right">
                      <div className="text-xs text-gray-600 mb-1">Subtotal</div>
                      <div className="text-lg font-semibold text-gray-900">
                        S/ {(item.cantidad * item.precioUnitario).toFixed(2)}
                      </div>
                    </div>
                    
                    {productos.length > 1 && (
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
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Descuento */}
      <div>
        <Input
          label="Descuento (PEN)"
          type="number"
          step="0.01"
          min="0"
          value={descuento}
          onChange={(e) => setDescuento(parseFloat(e.target.value) || 0)}
        />
      </div>

      {/* Totales */}
      <div className="bg-primary-50 p-6 rounded-lg">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-semibold">S/ {subtotalPEN.toFixed(2)}</span>
          </div>
          
          {descuento > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Descuento:</span>
              <span className="font-semibold text-danger-600">- S/ {descuento.toFixed(2)}</span>
            </div>
          )}
          
          <div className="border-t border-primary-200 pt-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total:</span>
              <span className="text-2xl font-bold text-primary-600">S/ {totalPEN.toFixed(2)}</span>
            </div>
          </div>
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
          placeholder="Notas sobre la venta..."
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
          type="button"
          variant="default"
          onClick={handleSubmitCotizacion}
          loading={loading}
        >
          Guardar como Cotización
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSubmitVenta}
          loading={loading}
        >
          Confirmar Venta
        </Button>
      </div>
    </form>
  );
};