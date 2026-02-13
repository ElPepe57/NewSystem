import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Lightbulb, Package, DollarSign, ClipboardList, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { Button, Input, Card } from '../../common';
import { ProveedorAutocomplete, type ProveedorSnapshot } from '../entidades/ProveedorAutocomplete';
import { AlmacenAutocomplete, type AlmacenSnapshot } from '../entidades/AlmacenAutocomplete';
import { ProductoAutocomplete, type ProductoSnapshot } from '../entidades/ProductoAutocomplete';
import { PriceAdvisorModal } from './PriceAdvisorModal';
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
  initialProductos?: Array<{
    productoId: string;
    cantidad: number;
    precioUnitarioUSD: number;
  }>;
  requerimientoId?: string;
  requerimientoNumero?: string;
  // Multi-requerimiento (OC consolidada)
  requerimientoIds?: string[];
  requerimientoNumeros?: string[];
  clientesOrigen?: Array<{ requerimientoId: string; requerimientoNumero: string; clienteNombre: string }>;
  productosOrigen?: Array<{ productoId: string; requerimientoId: string; cantidad: number; cotizacionId?: string; clienteNombre?: string }>;
  initialViajero?: {
    id: string;
    nombre: string;
  };
  // Props para modo edición
  ordenEditar?: {
    id: string;
    numeroOrden: string;
    proveedorId: string;
    nombreProveedor: string;
    almacenDestino: string;
    productos: Array<{
      productoId: string;
      sku: string;
      marca: string;
      nombreComercial: string;
      presentacion: string;
      cantidad: number;
      costoUnitario: number;
    }>;
    subtotalUSD: number;
    impuestoUSD?: number;
    gastosEnvioUSD?: number;
    otrosGastosUSD?: number;
    totalUSD: number;
    tcCompra: number;
    numeroTracking?: string;
    courier?: string;
    observaciones?: string;
  };
  isEditMode?: boolean;
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
  requerimientoIds,
  requerimientoNumeros,
  clientesOrigen,
  productosOrigen,
  initialViajero,
  ordenEditar,
  isEditMode = false
}) => {
  const { user } = useAuthStore();
  const toast = useToastStore();

  // Estado para proveedores y almacenes - inicializar desde ordenEditar si existe
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<ProveedorSnapshot | null>(
    ordenEditar ? {
      proveedorId: ordenEditar.proveedorId,
      nombre: ordenEditar.nombreProveedor,
      pais: 'USA' // Los proveedores típicamente son de USA
    } : null
  );
  const [almacenSeleccionado, setAlmacenSeleccionado] = useState<AlmacenSnapshot | null>(
    ordenEditar ? {
      almacenId: ordenEditar.almacenDestino,
      nombre: '', // Se cargará desde el autocomplete
      ciudad: '',
      pais: 'USA'
    } : initialViajero ? {
      almacenId: initialViajero.id,
      nombre: initialViajero.nombre,
      ciudad: '',
      pais: 'USA'
    } : null
  );

  // Inicializar productos
  const getInitialProductos = (): ProductoOrdenItem[] => {
    // Si estamos editando, usar los productos de la orden
    if (ordenEditar && ordenEditar.productos.length > 0) {
      return ordenEditar.productos.map(p => ({
        productoId: p.productoId,
        sku: p.sku,
        marca: p.marca,
        nombreComercial: p.nombreComercial,
        presentacion: p.presentacion,
        cantidad: p.cantidad,
        costoUnitario: p.costoUnitario
      }));
    }
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

  // Calcular porcentaje de tax inicial si estamos editando
  const calcularPorcentajeTaxInicial = () => {
    if (ordenEditar && ordenEditar.impuestoUSD && ordenEditar.subtotalUSD > 0) {
      return (ordenEditar.impuestoUSD / ordenEditar.subtotalUSD) * 100;
    }
    return 0;
  };

  // Estado del formulario
  const [productosOrden, setProductosOrden] = useState<ProductoOrdenItem[]>(getInitialProductos);
  const [porcentajeTax, setPorcentajeTax] = useState(calcularPorcentajeTaxInicial);
  const [gastosEnvioUSD, setGastosEnvioUSD] = useState(ordenEditar?.gastosEnvioUSD || 0);
  const [otrosGastosUSD, setOtrosGastosUSD] = useState(ordenEditar?.otrosGastosUSD || 0);
  const [tcCompra, setTcCompra] = useState(ordenEditar?.tcCompra || tcSugerido || 0);
  const [numeroTracking, setNumeroTracking] = useState(ordenEditar?.numeroTracking || '');
  const [courier, setCourier] = useState(ordenEditar?.courier || '');
  const [observaciones, setObservaciones] = useState(ordenEditar?.observaciones || '');

  // Estado para secciones colapsables
  const [seccionesExpandidas, setSeccionesExpandidas] = useState({
    productos: true,
    costos: false,
    adicional: false
  });

  // Estado para modal de asesor de precios
  const [priceAdvisorState, setPriceAdvisorState] = useState<{
    isOpen: boolean;
    index: number | null;
  }>({ isOpen: false, index: null });

  // Effects
  useEffect(() => {
    if (tcSugerido && tcCompra === 0) {
      setTcCompra(tcSugerido);
    }
  }, [tcSugerido]);

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

  // Productos válidos
  const productosValidos = productosOrden.filter(p => p.productoId && p.cantidad > 0 && p.costoUnitario > 0);

  // Handlers
  const handleAddProducto = () => {
    setProductosOrden([...productosOrden, {
      productoId: '',
      sku: '',
      marca: '',
      nombreComercial: '',
      presentacion: '',
      cantidad: 1,
      costoUnitario: 0
    }]);
  };

  const handleRemoveProducto = (index: number) => {
    if (productosOrden.length > 1) {
      setProductosOrden(productosOrden.filter((_, i) => i !== index));
    }
  };

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

  const handleProductoChange = (index: number, field: 'cantidad' | 'costoUnitario', value: number) => {
    const nuevosProductos = [...productosOrden];
    nuevosProductos[index] = {
      ...nuevosProductos[index],
      [field]: value
    };
    setProductosOrden(nuevosProductos);
  };

  const handleUsarSugerencia = (index: number) => {
    const producto = productosOrden[index];
    if (producto.sugerenciaPrecio) {
      handleProductoChange(index, 'costoUnitario', producto.sugerenciaPrecio);
    }
  };

  const handleCreateProveedor = async (data: ProveedorFormData): Promise<Proveedor> => {
    if (!user) throw new Error('Usuario no autenticado');
    return await OrdenCompraService.createProveedor(data, user.uid);
  };

  const toggleSeccion = (seccion: keyof typeof seccionesExpandidas) => {
    setSeccionesExpandidas(prev => ({
      ...prev,
      [seccion]: !prev[seccion]
    }));
  };

  const openPriceAdvisor = (index: number) => {
    setPriceAdvisorState({ isOpen: true, index });
  };

  const closePriceAdvisor = () => {
    setPriceAdvisorState({ isOpen: false, index: null });
  };

  const handleUsarPrecioDelAdvisor = (precio: number) => {
    if (priceAdvisorState.index !== null) {
      handleProductoChange(priceAdvisorState.index, 'costoUnitario', precio);
    }
  };

  const getProductoCompleto = (productoId: string): Producto | undefined => {
    return productos.find(p => p.id === productoId);
  };

  // Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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

    if (productosValidos.length === 0) {
      toast.warning('Debe agregar al menos un producto con cantidad y costo válidos');
      return;
    }

    // Todos los productos van al mismo destino (almacenSeleccionado)
    const productosConInfo = productosValidos.map(item => ({
      productoId: item.productoId,
      sku: item.sku,
      marca: item.marca,
      nombreComercial: item.nombreComercial,
      presentacion: item.presentacion,
      cantidad: item.cantidad,
      costoUnitario: item.costoUnitario,
      subtotal: item.cantidad * item.costoUnitario,
      // El viajero/destino es el mismo para todos los productos de esta OC
      viajeroId: almacenSeleccionado?.almacenId,
      viajeroNombre: almacenSeleccionado?.nombre
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
      requerimientoId: requerimientoId || undefined,
      // Multi-requerimiento (OC consolidada)
      ...(requerimientoIds && requerimientoIds.length > 0 ? {
        requerimientoIds,
        productosOrigen: productosOrigen || undefined
      } : {})
    };

    onSubmit(formData);
  };

  // Producto seleccionado para el advisor
  const productoParaAdvisor = priceAdvisorState.index !== null
    ? getProductoCompleto(productosOrden[priceAdvisorState.index]?.productoId)
    : undefined;

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Banner: OC Consolidada (multi-requerimiento) */}
        {requerimientoIds && requerimientoIds.length > 0 ? (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="h-5 w-5 text-blue-600" />
              <p className="text-sm font-semibold text-blue-900">
                OC Consolidada desde {requerimientoIds.length} requerimiento(s)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {clientesOrigen?.map((c, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                  {c.requerimientoNumero} - {c.clienteNombre}
                </span>
              ))}
            </div>
          </div>
        ) : requerimientoId ? (
          <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-primary-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-primary-900">
                Desde Requerimiento: {requerimientoNumero || requerimientoId}
              </p>
            </div>
          </div>
        ) : null}

        {/* Header con totales flotantes */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 -mx-4 px-4 py-3 -mt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="text-xs sm:text-sm">
                <span className="text-gray-500">Prod:</span>
                <span className="ml-1 font-medium">{productosValidos.length}</span>
              </div>
              <div className="text-xs sm:text-sm">
                <span className="text-gray-500">TC:</span>
                <span className="ml-1 font-medium">{tcCompra.toFixed(3)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="text-right">
                <div className="text-xs text-gray-500">USD</div>
                <div className="text-base sm:text-lg font-bold text-primary-600">${totalUSD.toFixed(2)}</div>
              </div>
              {tcCompra > 0 && (
                <div className="text-right">
                  <div className="text-xs text-gray-500">PEN</div>
                  <div className="text-sm font-semibold text-gray-700">S/ {totalPEN.toFixed(2)}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Información General - Siempre visible */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Proveedor <span className="text-red-500">*</span>
            </label>
            <ProveedorAutocomplete
              value={proveedorSeleccionado}
              onChange={setProveedorSeleccionado}
              onCreateNew={handleCreateProveedor}
              placeholder="Buscar proveedor..."
              required
              allowCreate
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Destino USA <span className="text-red-500">*</span>
            </label>
            <AlmacenAutocomplete
              value={almacenSeleccionado}
              onChange={setAlmacenSeleccionado}
              placeholder="Almacén destino..."
              required
              filterPais="USA"
            />
          </div>

          <div>
            <Input
              label="Tipo de Cambio"
              type="number"
              required
              min="0"
              step="0.001"
              value={tcCompra}
              onChange={(e) => setTcCompra(parseFloat(e.target.value) || 0)}
              className="text-sm"
            />
          </div>
        </div>

        {/* Sección: Productos */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSeccion('productos')}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-gray-900">Productos</span>
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                {productosOrden.length}
              </span>
            </div>
            {seccionesExpandidas.productos ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>

          {seccionesExpandidas.productos && (
            <div className="p-4 space-y-3">
              {/* Lista de productos compacta */}
              {productosOrden.map((item, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border transition-all ${
                    item.productoId && item.costoUnitario > 0
                      ? 'bg-white border-gray-200'
                      : 'bg-gray-50 border-dashed border-gray-300'
                  }`}
                >
                  {/* Fila principal - Diseño responsive */}
                  <div className="space-y-3 sm:space-y-0">
                    {/* Row 1: Número + Producto */}
                    <div className="flex items-start gap-2 sm:gap-3">
                      {/* Número de producto */}
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                        {index + 1}
                      </div>

                      {/* Selector de producto */}
                      <div className="flex-1 min-w-0">
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
                          placeholder="Buscar producto..."
                          required
                        />
                      </div>

                      {/* Acciones - visible en desktop, en móvil después */}
                      <div className="hidden sm:flex items-center gap-1">
                        {item.productoId && item.costoUnitario > 0 && tcCompra > 0 && (
                          <button
                            type="button"
                            onClick={() => openPriceAdvisor(index)}
                            className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Asesor de precios"
                          >
                            <Lightbulb className="h-4 w-4" />
                          </button>
                        )}
                        {productosOrden.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveProducto(index)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Badges de origen por cliente (multi-requerimiento) */}
                    {productosOrigen && productosOrigen.length > 0 && item.productoId && (() => {
                      const origenes = productosOrigen.filter(o => o.productoId === item.productoId);
                      if (origenes.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-1 ml-8 sm:ml-9">
                          {origenes.map((o, oi) => (
                            <span key={oi} className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                              {o.clienteNombre || 'Cliente'}: {o.cantidad} uds
                            </span>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Row 2: Cantidad, Precio, Subtotal */}
                    <div className="flex items-center gap-2 sm:gap-3 ml-8 sm:ml-9">
                      {/* Cantidad */}
                      <div className="w-16 sm:w-20">
                        <input
                          type="number"
                          min="1"
                          value={item.cantidad}
                          onChange={(e) => handleProductoChange(index, 'cantidad', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center"
                          placeholder="Cant."
                        />
                      </div>

                      {/* Precio */}
                      <div className="flex-1 sm:w-28 sm:flex-none">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.costoUnitario}
                            onChange={(e) => handleProductoChange(index, 'costoUnitario', parseFloat(e.target.value) || 0)}
                            className="w-full pl-6 pr-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      {/* Subtotal */}
                      <div className="w-20 sm:w-24 text-right">
                        <div className="text-xs text-gray-500">Subtotal</div>
                        <div className="text-sm sm:text-base font-semibold text-gray-900">
                          ${(item.cantidad * item.costoUnitario).toFixed(2)}
                        </div>
                      </div>

                      {/* Acciones - solo móvil */}
                      <div className="flex sm:hidden items-center gap-1">
                        {item.productoId && item.costoUnitario > 0 && tcCompra > 0 && (
                          <button
                            type="button"
                            onClick={() => openPriceAdvisor(index)}
                            className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Asesor de precios"
                          >
                            <Lightbulb className="h-4 w-4" />
                          </button>
                        )}
                        {productosOrden.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveProducto(index)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Fila secundaria: Sugerencia de precio */}
                  {item.productoId && item.sugerenciaPrecio && item.sugerenciaPrecio !== item.costoUnitario && (
                    <div className="mt-2 ml-9">
                      <button
                        type="button"
                        onClick={() => handleUsarSugerencia(index)}
                        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800"
                      >
                        <Lightbulb className="h-3 w-3" />
                        Usar precio sugerido: ${item.sugerenciaPrecio.toFixed(2)}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Agregar producto */}
              <button
                type="button"
                onClick={handleAddProducto}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Plus className="h-4 w-4" />
                Agregar producto
              </button>
            </div>
          )}
        </div>

        {/* Sección: Costos Adicionales */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSeccion('costos')}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-gray-900">Costos Adicionales</span>
              {(porcentajeTax > 0 || gastosEnvioUSD > 0 || otrosGastosUSD > 0) && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  +${(impuestoUSD + gastosEnvioUSD + otrosGastosUSD).toFixed(2)}
                </span>
              )}
            </div>
            {seccionesExpandidas.costos ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>

          {seccionesExpandidas.costos && (
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Input
                    label="Tax / Impuesto (%)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={porcentajeTax}
                    onChange={(e) => setPorcentajeTax(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                  {impuestoUSD > 0 && (
                    <p className="text-xs text-amber-600 mt-1">= ${impuestoUSD.toFixed(2)} USD</p>
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
              </div>

              {/* Resumen de totales */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm space-y-1.5">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal productos:</span>
                  <span>${subtotalUSD.toFixed(2)}</span>
                </div>
                {impuestoUSD > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Tax ({porcentajeTax}%):</span>
                    <span>${impuestoUSD.toFixed(2)}</span>
                  </div>
                )}
                {gastosEnvioUSD > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Envío:</span>
                    <span>${gastosEnvioUSD.toFixed(2)}</span>
                  </div>
                )}
                {otrosGastosUSD > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Otros:</span>
                    <span>${otrosGastosUSD.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-primary-700 pt-1.5 border-t border-blue-200">
                  <span>Total:</span>
                  <span>${totalUSD.toFixed(2)} USD</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sección: Información Adicional */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSeccion('adicional')}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-gray-900">Tracking y Observaciones</span>
              {(numeroTracking || courier || observaciones) && (
                <span className="w-2 h-2 bg-green-500 rounded-full" />
              )}
            </div>
            {seccionesExpandidas.adicional ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>

          {seccionesExpandidas.adicional && (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="Notas internas..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading || totalUSD === 0}
            className="w-full sm:w-auto"
          >
            {loading
              ? (isEditMode ? 'Actualizando...' : 'Creando...')
              : (isEditMode ? 'Actualizar Orden' : 'Crear Orden')
            }
          </Button>
        </div>
      </form>

      {/* Modal de Asesor de Precios */}
      <PriceAdvisorModal
        isOpen={priceAdvisorState.isOpen}
        onClose={closePriceAdvisor}
        producto={productoParaAdvisor}
        precioIngresado={priceAdvisorState.index !== null ? productosOrden[priceAdvisorState.index]?.costoUnitario || 0 : 0}
        tipoCambio={tcCompra}
        proveedorActual={proveedorSeleccionado?.nombre}
        onUsarPrecioSugerido={handleUsarPrecioDelAdvisor}
      />
    </>
  );
};
