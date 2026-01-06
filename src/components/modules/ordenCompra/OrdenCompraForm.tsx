import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, Lightbulb, TrendingUp, Package, DollarSign, ClipboardList, Users } from 'lucide-react';
import { Button, Input, Card } from '../../common';
import { ProveedorAutocomplete, type ProveedorSnapshot } from '../entidades/ProveedorAutocomplete';
import { AlmacenAutocomplete, type AlmacenSnapshot } from '../entidades/AlmacenAutocomplete';
import { ProductoAutocomplete, type ProductoSnapshot } from '../entidades/ProductoAutocomplete';
import { OrdenCompraService } from '../../../services/ordenCompra.service';
import { useAuthStore } from '../../../store/authStore';
import { useToastStore } from '../../../store/toastStore';
import type { OrdenCompraFormData, ProveedorFormData, Proveedor } from '../../../types/ordenCompra.types';
import type { Producto } from '../../../types/producto.types';

interface OrdenCompraFormProps {
  proveedores: Proveedor[];
  productos: Producto[];
  onSubmit: (data: OrdenCompraFormData) => void;
  onCancel: () => void;
  loading?: boolean;
  tcSugerido?: number;
  // Props para pre-cargar desde requerimiento
  initialProductos?: Array<{
    productoId: string;
    cantidad: number;
    precioUnitarioUSD: number;
  }>;
  requerimientoId?: string;
  requerimientoNumero?: string;
  // Props para pre-cargar viajero destino (flujo multi-viajero)
  initialViajero?: {
    id: string;
    nombre: string;
  };
}

interface ProductoOrdenItem {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  cantidad: number;
  costoUnitario: number;
  sugerenciaPrecio?: number;
  // Viajero destino (para distribución multi-viajero)
  viajeroId?: string;
  viajeroNombre?: string;
}

export const OrdenCompraForm: React.FC<OrdenCompraFormProps> = ({
  proveedores,
  productos,
  onSubmit,
  onCancel,
  loading = false,
  tcSugerido,
  initialProductos,
  requerimientoId,
  requerimientoNumero,
  initialViajero
}) => {
  const { user } = useAuthStore();
  const toast = useToastStore();

  // Estado para proveedores y almacenes con autocomplete
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<ProveedorSnapshot | null>(null);
  // Si viene un viajero inicial, preseleccionarlo como almacén destino
  const [almacenSeleccionado, setAlmacenSeleccionado] = useState<AlmacenSnapshot | null>(
    initialViajero ? {
      almacenId: initialViajero.id,
      nombre: initialViajero.nombre,
      ciudad: '',
      pais: 'USA'
    } : null
  );

  // Inicializar productos - desde requerimiento o vacío
  const getInitialProductos = (): ProductoOrdenItem[] => {
    if (initialProductos && initialProductos.length > 0) {
      return initialProductos.map(p => {
        const prod = productos.find(pr => pr.id === p.productoId);
        return {
          productoId: p.productoId,
          sku: prod?.sku || '',
          marca: prod?.marca || '',
          nombreComercial: prod?.nombreComercial || '',
          presentacion: prod?.presentacion || '',
          cantidad: p.cantidad,
          costoUnitario: p.precioUnitarioUSD
        };
      });
    }
    return [{
      productoId: '',
      sku: '',
      marca: '',
      nombreComercial: '',
      presentacion: '',
      cantidad: 1,
      costoUnitario: 0
    }];
  };

  // Estado del formulario
  const [productosOrden, setProductosOrden] = useState<ProductoOrdenItem[]>(getInitialProductos);
  const [porcentajeTax, setPorcentajeTax] = useState(0);
  const [gastosEnvioUSD, setGastosEnvioUSD] = useState(0);
  const [otrosGastosUSD, setOtrosGastosUSD] = useState(0);
  const [tcCompra, setTcCompra] = useState(tcSugerido || 0);
  const [numeroTracking, setNumeroTracking] = useState('');
  const [courier, setCourier] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Actualizar TC sugerido cuando cambie
  useEffect(() => {
    if (tcSugerido && tcCompra === 0) {
      setTcCompra(tcSugerido);
    }
  }, [tcSugerido]);

  // Actualizar almacén seleccionado cuando cambie el viajero inicial (flujo multi-viajero)
  useEffect(() => {
    if (initialViajero) {
      setAlmacenSeleccionado({
        almacenId: initialViajero.id,
        nombre: initialViajero.nombre,
        ciudad: '',
        pais: 'USA'
      });
    }
  }, [initialViajero]);

  // Re-inicializar productos si cambian los iniciales (cuando viene de requerimiento)
  useEffect(() => {
    if (initialProductos && initialProductos.length > 0) {
      setProductosOrden(initialProductos.map(p => {
        const prod = productos.find(pr => pr.id === p.productoId);
        return {
          productoId: p.productoId,
          sku: prod?.sku || '',
          marca: prod?.marca || '',
          nombreComercial: prod?.nombreComercial || '',
          presentacion: prod?.presentacion || '',
          cantidad: p.cantidad,
          costoUnitario: p.precioUnitarioUSD
        };
      }));
    }
  }, [initialProductos, productos]);

  // Calcular totales
  const subtotalUSD = productosOrden.reduce((sum, item) => {
    if (item.productoId && item.cantidad > 0 && item.costoUnitario > 0) {
      return sum + (item.cantidad * item.costoUnitario);
    }
    return sum;
  }, 0);

  const impuestoUSD = subtotalUSD > 0 ? (subtotalUSD * porcentajeTax) / 100 : 0;
  const totalUSD = subtotalUSD + impuestoUSD + gastosEnvioUSD + otrosGastosUSD;
  const totalPEN = tcCompra > 0 ? totalUSD * tcCompra : 0;

  // Agregar producto
  const handleAddProducto = () => {
    setProductosOrden([...productosOrden, {
      productoId: '',
      sku: '',
      marca: '',
      nombreComercial: '',
      presentacion: '',
      cantidad: 1,
      costoUnitario: 0,
      viajeroId: undefined,
      viajeroNombre: undefined
    }]);
  };

  // Eliminar producto
  const handleRemoveProducto = (index: number) => {
    if (productosOrden.length > 1) {
      setProductosOrden(productosOrden.filter((_, i) => i !== index));
    }
  };

  // Actualizar producto desde autocomplete
  const handleProductoSelect = (
    index: number,
    snapshot: ProductoSnapshot | null,
    sugerencia?: { precioConImpuesto: number } | null
  ) => {
    const nuevosProductos = [...productosOrden];
    if (snapshot) {
      nuevosProductos[index] = {
        ...nuevosProductos[index],
        productoId: snapshot.productoId,
        sku: snapshot.sku,
        marca: snapshot.marca,
        nombreComercial: snapshot.nombreComercial,
        presentacion: snapshot.presentacion,
        costoUnitario: sugerencia?.precioConImpuesto || nuevosProductos[index].costoUnitario,
        sugerenciaPrecio: sugerencia?.precioConImpuesto
      };
    } else {
      nuevosProductos[index] = {
        productoId: '',
        sku: '',
        marca: '',
        nombreComercial: '',
        presentacion: '',
        cantidad: nuevosProductos[index].cantidad,
        costoUnitario: 0
      };
    }
    setProductosOrden(nuevosProductos);
  };

  // Actualizar cantidad o costo
  const handleProductoChange = (index: number, field: 'cantidad' | 'costoUnitario', value: number) => {
    const nuevosProductos = [...productosOrden];
    nuevosProductos[index] = {
      ...nuevosProductos[index],
      [field]: value
    };
    setProductosOrden(nuevosProductos);
  };

  // Usar precio sugerido
  const handleUsarSugerencia = (index: number) => {
    const producto = productosOrden[index];
    if (producto.sugerenciaPrecio) {
      handleProductoChange(index, 'costoUnitario', producto.sugerenciaPrecio);
    }
  };

  // Actualizar viajero de un producto
  const handleViajeroChange = (index: number, viajero: AlmacenSnapshot | null) => {
    const nuevosProductos = [...productosOrden];
    nuevosProductos[index] = {
      ...nuevosProductos[index],
      viajeroId: viajero?.almacenId,
      viajeroNombre: viajero?.nombre
    };
    setProductosOrden(nuevosProductos);
  };

  // Crear nuevo proveedor
  const handleCreateProveedor = async (data: ProveedorFormData): Promise<Proveedor> => {
    if (!user) throw new Error('Usuario no autenticado');
    return await OrdenCompraService.createProveedor(data, user.uid);
  };

  // Enviar formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    if (!proveedorSeleccionado) {
      toast.warning('Debe seleccionar un proveedor');
      return;
    }

    if (!almacenSeleccionado) {
      toast.warning('Debe seleccionar un almacén de destino');
      return;
    }

    if (tcCompra <= 0) {
      toast.warning('El tipo de cambio debe ser mayor a 0');
      return;
    }

    const productosValidos = productosOrden.filter(p =>
      p.productoId && p.cantidad > 0 && p.costoUnitario > 0
    );

    if (productosValidos.length === 0) {
      toast.warning('Debe agregar al menos un producto con cantidad y costo válidos');
      return;
    }

    // Preparar datos con información completa de productos
    const productosConInfo = productosValidos.map(item => ({
      productoId: item.productoId,
      sku: item.sku,
      marca: item.marca,
      nombreComercial: item.nombreComercial,
      presentacion: item.presentacion,
      cantidad: item.cantidad,
      costoUnitario: item.costoUnitario,
      subtotal: item.cantidad * item.costoUnitario,
      // Viajero destino (opcional)
      viajeroId: item.viajeroId,
      viajeroNombre: item.viajeroNombre
    }));

    const formData: OrdenCompraFormData = {
      proveedorId: proveedorSeleccionado.proveedorId,
      productos: productosConInfo,
      subtotalUSD,
      impuestoUSD: impuestoUSD > 0 ? impuestoUSD : undefined,
      gastosEnvioUSD: gastosEnvioUSD > 0 ? gastosEnvioUSD : undefined,
      otrosGastosUSD: otrosGastosUSD > 0 ? otrosGastosUSD : undefined,
      totalUSD,
      tcCompra,
      almacenDestino: almacenSeleccionado.almacenId,
      numeroTracking: numeroTracking.trim() || undefined,
      courier: courier.trim() || undefined,
      observaciones: observaciones.trim() || undefined,
      requerimientoId: requerimientoId || undefined
    };

    onSubmit(formData);
  };

  // Contar productos con sugerencias disponibles
  const productosConSugerencia = productosOrden.filter(p => p.sugerenciaPrecio && p.sugerenciaPrecio !== p.costoUnitario).length;

  // Contenido del formulario (reutilizable)
  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-6">
          {/* Banner: Viene de Requerimiento */}
          {requerimientoId && (
            <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-full">
                <ClipboardList className="h-5 w-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-primary-900">
                  Orden generada desde Requerimiento
                </p>
                <p className="text-sm text-primary-700">
                  {requerimientoNumero || requerimientoId} - Los productos y cantidades han sido pre-cargados
                </p>
              </div>
            </div>
          )}

          {/* Sección 1: Proveedor y Almacén */}
          <Card padding="md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              1. Información General
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor <span className="text-red-500">*</span>
                </label>
                <ProveedorAutocomplete
                  value={proveedorSeleccionado}
                  onChange={setProveedorSeleccionado}
                  onCreateNew={handleCreateProveedor}
                  placeholder="Buscar o crear proveedor..."
                  required
                  allowCreate
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Almacén de Destino (USA) <span className="text-red-500">*</span>
                </label>
                <AlmacenAutocomplete
                  value={almacenSeleccionado}
                  onChange={setAlmacenSeleccionado}
                  placeholder="Buscar almacén..."
                  required
                  filterPais="USA"
                />
              </div>
            </div>

            {proveedores.length === 0 && (
              <div className="mt-4 p-4 bg-yellow-50 rounded-lg flex items-start">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
                <div className="text-sm text-yellow-800">
                  <strong>No hay proveedores registrados.</strong>
                  <br />
                  Puedes crear uno nuevo usando el buscador de arriba.
                </div>
              </div>
            )}
          </Card>

          {/* Sección 2: Productos */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  2. Productos
                </h3>
                {productosConSugerencia > 0 && (
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full flex items-center">
                    <Lightbulb className="h-3 w-3 mr-1" />
                    {productosConSugerencia} con sugerencia de precio
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddProducto}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Producto
              </Button>
            </div>

            <div className="space-y-4">
              {productosOrden.map((item, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-3">
                      {/* Fila 1: Selector de producto */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Producto <span className="text-red-500">*</span>
                        </label>
                        <ProductoAutocomplete
                          productos={productos}
                          value={item.productoId ? {
                            productoId: item.productoId,
                            sku: item.sku,
                            marca: item.marca,
                            nombreComercial: item.nombreComercial,
                            presentacion: item.presentacion
                          } : null}
                          onChange={(snapshot, sugerencia) => handleProductoSelect(index, snapshot, sugerencia)}
                          proveedorSeleccionado={proveedorSeleccionado?.nombre}
                          showInvestigacionSugerencia={false}
                          placeholder="Buscar por SKU, marca o nombre..."
                          required
                        />
                      </div>

                      {/* Fila 2: Cantidad y Costo */}
                      <div className="grid grid-cols-3 gap-3">
                        <Input
                          label="Cantidad"
                          type="number"
                          required
                          min="1"
                          value={item.cantidad}
                          onChange={(e) => handleProductoChange(index, 'cantidad', parseInt(e.target.value) || 0)}
                        />

                        <div>
                          <Input
                            label="Costo Unit. (USD)"
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            value={item.costoUnitario}
                            onChange={(e) => handleProductoChange(index, 'costoUnitario', parseFloat(e.target.value) || 0)}
                          />
                          {item.sugerenciaPrecio && item.sugerenciaPrecio !== item.costoUnitario && (
                            <button
                              type="button"
                              onClick={() => handleUsarSugerencia(index)}
                              className="mt-1 text-xs text-amber-600 hover:text-amber-800 flex items-center"
                            >
                              <Lightbulb className="h-3 w-3 mr-1" />
                              Usar ${item.sugerenciaPrecio.toFixed(2)} (investigación)
                            </button>
                          )}
                        </div>

                        <div className="flex flex-col">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Subtotal</label>
                          <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-lg px-3">
                            <span className="text-lg font-semibold text-gray-900">
                              ${(item.cantidad * item.costoUnitario).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Fila 3: Viajero destino (opcional) */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center">
                          <Users className="h-3 w-3 mr-1 text-purple-500" />
                          Viajero Destino
                          <span className="ml-1 text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <AlmacenAutocomplete
                          value={item.viajeroId ? {
                            almacenId: item.viajeroId,
                            nombre: item.viajeroNombre || '',
                            ciudad: '',
                            pais: 'USA'
                          } : null}
                          onChange={(viajero) => handleViajeroChange(index, viajero)}
                          placeholder="Asignar a viajero..."
                          soloViajeros
                        />
                        {item.viajeroNombre && (
                          <p className="text-xs text-purple-600 mt-1">
                            → Este producto irá a: {item.viajeroNombre}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botón eliminar */}
                    {productosOrden.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveProducto(index)}
                        className="mt-6 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Sección 3: Costos Adicionales y TC */}
          <Card padding="md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              3. Costos y Tipo de Cambio
            </h3>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Input
                  label="Tax / Impuesto (%)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={porcentajeTax}
                  onChange={(e) => setPorcentajeTax(parseFloat(e.target.value) || 0)}
                  placeholder="Ej: 7.25"
                />
                {impuestoUSD > 0 && (
                  <p className="text-xs text-amber-600 mt-1 font-medium">
                    = ${impuestoUSD.toFixed(2)} USD
                  </p>
                )}
              </div>

              <Input
                label="Gastos de Envío (USD)"
                type="number"
                min="0"
                step="0.01"
                value={gastosEnvioUSD}
                onChange={(e) => setGastosEnvioUSD(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />

              <Input
                label="Otros Gastos (USD)"
                type="number"
                min="0"
                step="0.01"
                value={otrosGastosUSD}
                onChange={(e) => setOtrosGastosUSD(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />

              <Input
                label="Tipo de Cambio (Compra)"
                type="number"
                required
                min="0"
                step="0.001"
                value={tcCompra}
                onChange={(e) => setTcCompra(parseFloat(e.target.value) || 0)}
                helperText="TC al momento de crear la orden"
              />
            </div>

            {/* Resumen de Totales */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal Productos:</span>
                <span className="font-medium text-gray-900">${subtotalUSD.toFixed(2)} USD</span>
              </div>
              {impuestoUSD > 0 && (
                <div className="flex justify-between text-sm text-amber-700">
                  <span>Impuesto / Tax ({porcentajeTax.toFixed(2)}%):</span>
                  <span className="font-medium">${impuestoUSD.toFixed(2)} USD</span>
                </div>
              )}
              {gastosEnvioUSD > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Gastos de Envío:</span>
                  <span className="font-medium text-gray-900">${gastosEnvioUSD.toFixed(2)} USD</span>
                </div>
              )}
              {otrosGastosUSD > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Otros Gastos:</span>
                  <span className="font-medium text-gray-900">${otrosGastosUSD.toFixed(2)} USD</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold pt-2 border-t border-blue-200">
                <span className="text-gray-900">Total USD:</span>
                <span className="text-primary-600">${totalUSD.toFixed(2)} USD</span>
              </div>
              {tcCompra > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Equivalente PEN (TC {tcCompra.toFixed(3)}):</span>
                  <span className="font-medium text-gray-900">S/ {totalPEN.toFixed(2)}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Sección 4: Tracking y Observaciones */}
          <Card padding="md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              4. Información Adicional (Opcional)
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Número de Tracking"
                  type="text"
                  value={numeroTracking}
                  onChange={(e) => setNumeroTracking(e.target.value)}
                  placeholder="Ej: 1Z999AA10123456784"
                />

                <Input
                  label="Courier"
                  type="text"
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                  placeholder="Ej: FedEx, UPS, DHL"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Notas internas sobre esta orden..."
                />
              </div>
            </div>
          </Card>

      {/* Acciones */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button
          type="button"
          variant="secondary"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={loading || totalUSD === 0}
        >
          {loading ? 'Creando...' : 'Crear Orden de Compra'}
        </Button>
      </div>
    </form>
  );

  // Siempre retornar solo el contenido del formulario
  // El contenedor modal se maneja desde el componente padre
  return formContent;
};
