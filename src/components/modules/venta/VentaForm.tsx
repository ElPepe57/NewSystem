import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, AlertCircle, Wallet, CreditCard, Banknote, Smartphone, Building2, TrendingUp, Info, PlusCircle, History, ShoppingBag, Star, Package, User, CheckCircle, ChevronLeft, ChevronRight, Boxes, Calendar, DollarSign, Lock, MapPin } from 'lucide-react';
import { Button, Input, Select, Modal, Stepper, useStepper, StepContent, GoogleMapsAddressInput } from '../../common';
import type { AddressData } from '../../common';
import type { Step } from '../../common/Stepper';
import { ProductoForm } from '../productos/ProductoForm';
import { ClienteAutocomplete } from '../entidades/ClienteAutocomplete';
import { CanalAutocomplete } from '../canalVenta/CanalAutocomplete';
import { ProductoSearchVentas, type ProductoVentaSnapshot } from '../entidades/ProductoSearchVentas';
import { tesoreriaService } from '../../../services/tesoreria.service';
import { clienteService } from '../../../services/cliente.service';
import { useProductoStore } from '../../../store/productoStore';
import { useAuthStore } from '../../../store/authStore';
import { useClienteStore } from '../../../store/clienteStore';
import { useToastStore } from '../../../store/toastStore';
import { useCanalVentaStore } from '../../../store/canalVentaStore';
import type { VentaFormData, CanalVenta, MetodoPago, AdelantoData } from '../../../types/venta.types';
import type { ProductoDisponible } from '../../../types/venta.types';
import type { CuentaCaja, MetodoTesoreria } from '../../../types/tesoreria.types';
import type { ProductoFormData } from '../../../types/producto.types';
import type { ClienteSnapshot, ClienteFormData } from '../../../types/entidadesMaestras.types';

interface VentaFormProps {
  productosDisponibles: ProductoDisponible[];
  onSubmit: (data: VentaFormData, esVentaDirecta: boolean, adelanto?: AdelantoData) => void;
  onCancel: () => void;
  loading?: boolean;
  onProductoCreated?: () => void; // Callback para refrescar productos disponibles después de crear uno
}

// Mapeo de MetodoPago a MetodoTesoreria
const mapMetodoPagoToTesoreria = (metodo: MetodoPago): MetodoTesoreria => {
  const mapping: Record<MetodoPago, MetodoTesoreria> = {
    'efectivo': 'efectivo',
    'transferencia': 'transferencia_bancaria',
    'yape': 'yape',
    'plin': 'plin',
    'tarjeta': 'tarjeta',
    'mercado_pago': 'mercado_pago',
    'paypal': 'paypal',
    'zelle': 'zelle',
    'otro': 'otro'
  };
  return mapping[metodo];
};

const METODOS_PAGO: { value: MetodoPago; label: string; icon: React.ReactNode }[] = [
  { value: 'efectivo', label: 'Efectivo', icon: <Banknote className="h-4 w-4" /> },
  { value: 'transferencia', label: 'Transferencia', icon: <Building2 className="h-4 w-4" /> },
  { value: 'yape', label: 'Yape', icon: <Smartphone className="h-4 w-4" /> },
  { value: 'plin', label: 'Plin', icon: <Smartphone className="h-4 w-4" /> },
  { value: 'tarjeta', label: 'Tarjeta', icon: <CreditCard className="h-4 w-4" /> },
  { value: 'mercado_pago', label: 'Mercado Pago', icon: <CreditCard className="h-4 w-4" /> },
];

interface ProductoVentaItem {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  snapshot?: ProductoVentaSnapshot | null; // Info completa del producto
}

// canalOptions legacy - ahora usamos CanalAutocomplete dinámico

// Definición de pasos del flujo de venta
const VENTA_STEPS: Step[] = [
  { id: 'productos', label: 'Productos', description: 'Selecciona productos', icon: <Package className="h-4 w-4" /> },
  { id: 'cliente', label: 'Cliente', description: 'Datos del cliente', icon: <User className="h-4 w-4" /> },
  { id: 'pago', label: 'Pago', description: 'Método de pago', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'confirmacion', label: 'Confirmar', description: 'Revisar y confirmar', icon: <CheckCircle className="h-4 w-4" /> }
];

export const VentaForm: React.FC<VentaFormProps> = ({
  productosDisponibles,
  onSubmit,
  onCancel,
  loading = false,
  onProductoCreated
}) => {
  const { user } = useAuthStore();
  const { productos: productosStore, createProducto } = useProductoStore();
  const toast = useToastStore();
  const { getById: getCanalById } = useCanalVentaStore();

  // Modal de crear producto
  const [showProductoModal, setShowProductoModal] = useState(false);
  const [isCreatingProducto, setIsCreatingProducto] = useState(false);

  // Cliente inteligente
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteSnapshot | null>(null);
  const [nombreCliente, setNombreCliente] = useState('');
  const [emailCliente, setEmailCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [dniRuc, setDniRuc] = useState('');
  const [addressData, setAddressData] = useState<AddressData>({
    direccion: '',
    distrito: '',
    provincia: '',
    codigoPostal: '',
    referencia: '',
    coordenadas: null,
  });
  const [historialCliente, setHistorialCliente] = useState<{
    totalCompras: number;
    montoTotal: number;
    ultimaCompra?: Date;
    productosFavoritos: string[];
  } | null>(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const [canal, setCanal] = useState<CanalVenta>('');
  const [canalNombre, setCanalNombre] = useState('');
  const [mercadoLibreId, setMercadoLibreId] = useState('');
  const [productos, setProductos] = useState<ProductoVentaItem[]>([
    { productoId: '', cantidad: 1, precioUnitario: 0, snapshot: null }
  ]);
  const [descuento, setDescuento] = useState(0);
  const [costoEnvio, setCostoEnvio] = useState(0);
  const [incluyeEnvio, setIncluyeEnvio] = useState(true); // true = envío gratis
  const [observaciones, setObservaciones] = useState('');

  // Estado para adelanto
  const [registrarAdelanto, setRegistrarAdelanto] = useState(false);
  const [montoAdelanto, setMontoAdelanto] = useState(0);
  const [metodoPagoAdelanto, setMetodoPagoAdelanto] = useState<MetodoPago>('efectivo');
  const [referenciaAdelanto, setReferenciaAdelanto] = useState('');

  // Estado para cuentas de tesorería
  const [cuentas, setCuentas] = useState<CuentaCaja[]>([]);
  const [cuentaDestinoId, setCuentaDestinoId] = useState<string>('');
  const [loadingCuentas, setLoadingCuentas] = useState(true);

  // Stepper para el flujo de venta
  const {
    currentStep,
    isFirstStep,
    isLastStep,
    goToStep,
    nextStep,
    prevStep
  } = useStepper({ steps: VENTA_STEPS });

  // Cargar cuentas al montar
  useEffect(() => {
    const cargarCuentas = async () => {
      try {
        setLoadingCuentas(true);
        const cuentasActivas = await tesoreriaService.getCuentasActivas('PEN');
        setCuentas(cuentasActivas);

        // Seleccionar cuenta por defecto
        const metodoTesoreria = mapMetodoPagoToTesoreria(metodoPagoAdelanto);
        const cuentaPorDefecto = await tesoreriaService.getCuentaPorMetodoPago(metodoTesoreria, 'PEN');
        if (cuentaPorDefecto) {
          setCuentaDestinoId(cuentaPorDefecto.id);
        } else if (cuentasActivas.length > 0) {
          setCuentaDestinoId(cuentasActivas[0].id);
        }
      } catch (error) {
        console.error('Error al cargar cuentas:', error);
      } finally {
        setLoadingCuentas(false);
      }
    };

    cargarCuentas();
  }, []);

  // Actualizar cuenta destino cuando cambia el método de pago
  useEffect(() => {
    const actualizarCuentaPorMetodo = async () => {
      const metodoTesoreria = mapMetodoPagoToTesoreria(metodoPagoAdelanto);
      const cuentaPorDefecto = await tesoreriaService.getCuentaPorMetodoPago(metodoTesoreria, 'PEN');
      if (cuentaPorDefecto) {
        setCuentaDestinoId(cuentaPorDefecto.id);
      }
    };

    if (!loadingCuentas) {
      actualizarCuentaPorMetodo();
    }
  }, [metodoPagoAdelanto, loadingCuentas]);

  const cuentaSeleccionada = cuentas.find(c => c.id === cuentaDestinoId);

  // Handler para selección de cliente desde el autocomplete
  const handleClienteChange = async (cliente: ClienteSnapshot | null) => {
    setClienteSeleccionado(cliente);

    if (cliente) {
      // Autocompletar campos del formulario
      setNombreCliente(cliente.nombre);
      if (cliente.telefono) setTelefonoCliente(cliente.telefono);
      if (cliente.email) setEmailCliente(cliente.email);
      if (cliente.dniRuc) setDniRuc(cliente.dniRuc);

      // Cargar historial del cliente
      if (cliente.clienteId) {
        setLoadingHistorial(true);
        try {
          const clienteCompleto = await clienteService.getById(cliente.clienteId);
          if (clienteCompleto) {
            setHistorialCliente({
              totalCompras: clienteCompleto.metricas.totalCompras,
              montoTotal: clienteCompleto.metricas.montoTotalPEN,
              ultimaCompra: clienteCompleto.metricas.ultimaCompra?.toDate(),
              productosFavoritos: clienteCompleto.metricas.productosFavoritos || []
            });
            // Autocompletar dirección principal si existe
            if (clienteCompleto.direccionPrincipal && !addressData.direccion) {
              setAddressData(prev => ({ ...prev, direccion: clienteCompleto.direccionPrincipal || '' }));
            }

            // Auto-llenar canal de venta: prioridad canal principal > canal origen
            if (!canal) {
              const canalAutoId = clienteCompleto.canalPrincipalActual || clienteCompleto.canalOrigen;
              if (canalAutoId) {
                const canalObj = await getCanalById(canalAutoId);
                if (canalObj) {
                  setCanal(canalObj.id);
                  setCanalNombre(canalObj.nombre);
                } else {
                  // Fallback: usar el ID directamente
                  setCanal(canalAutoId);
                  setCanalNombre(canalAutoId);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error al cargar historial del cliente:', error);
        } finally {
          setLoadingHistorial(false);
        }
      }
    } else {
      // Limpiar campos si se deselecciona
      setHistorialCliente(null);
    }
  };

  // Handler para crear nuevo cliente desde el autocomplete
  const handleCreateClienteInline = async (data: Partial<ClienteFormData>) => {
    if (!user || !data.nombre) return;

    try {
      const clienteData: ClienteFormData = {
        nombre: data.nombre,
        telefono: data.telefono,
        dniRuc: data.dniRuc,
        tipoCliente: data.tipoCliente || 'persona',
        canalOrigen: data.canalOrigen || ''
      };

      const clienteId = await clienteService.create(clienteData, user.uid);

      // Seleccionar el cliente recién creado
      const nuevoCliente: ClienteSnapshot = {
        clienteId,
        nombre: data.nombre,
        telefono: data.telefono,
        dniRuc: data.dniRuc
      };
      handleClienteChange(nuevoCliente);
    } catch (error: any) {
      console.error('Error al crear cliente:', error);
      toast.error(error.message, 'Error al crear cliente');
    }
  };

  // Calcular totales
  const subtotalPEN = productos.reduce((sum, item) => {
    if (item.productoId && item.cantidad > 0 && item.precioUnitario > 0) {
      return sum + (item.cantidad * item.precioUnitario);
    }
    return sum;
  }, 0);

  // Si incluyeEnvio = true (gratis), el cliente no paga envío
  // Si incluyeEnvio = false, el cliente paga el costo de envío
  const totalPEN = subtotalPEN - descuento + (incluyeEnvio ? 0 : costoEnvio);

  // Agregar producto
  const handleAddProducto = () => {
    setProductos([...productos, { productoId: '', cantidad: 1, precioUnitario: 0, snapshot: null }]);
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

  // Handler para selección de producto desde buscador inteligente
  const handleProductoSelect = (index: number, snapshot: ProductoVentaSnapshot | null) => {
    const nuevosProductos = [...productos];

    if (snapshot) {
      nuevosProductos[index] = {
        ...nuevosProductos[index],
        productoId: snapshot.productoId,
        precioUnitario: snapshot.precioSugerido > 0 ? snapshot.precioSugerido : nuevosProductos[index].precioUnitario,
        snapshot: snapshot
      };
    } else {
      nuevosProductos[index] = {
        ...nuevosProductos[index],
        productoId: '',
        snapshot: null
      };
    }

    setProductos(nuevosProductos);
  };

  // Handler para crear producto desde el modal interno
  const handleCreateProducto = async (data: ProductoFormData) => {
    if (!user) return;

    setIsCreatingProducto(true);
    try {
      await createProducto(data, user.uid);
      setShowProductoModal(false);
      // Notificar al padre para que refresque los productos disponibles
      onProductoCreated?.();
      toast.success('Producto creado correctamente. Ya puedes seleccionarlo en la lista.');
    } catch (error: any) {
      toast.error(error.message, 'Error al crear producto');
    } finally {
      setIsCreatingProducto(false);
    }
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
      toast.warning('Debes agregar al menos un producto con cantidad y precio válidos');
      return;
    }

    // Validar adelanto si está activo
    if (registrarAdelanto) {
      if (montoAdelanto <= 0) {
        toast.warning('El monto del adelanto debe ser mayor a 0');
        return;
      }
      if (montoAdelanto > totalPEN) {
        toast.warning('El adelanto no puede ser mayor al total de la venta');
        return;
      }
    }

    const data: VentaFormData = {
      nombreCliente,
      canal,
      canalNombre: canalNombre || undefined,
      productos: productosValidos,
      observaciones
    };

    // Vincular cliente del maestro si está seleccionado
    if (clienteSeleccionado?.clienteId) {
      data.clienteId = clienteSeleccionado.clienteId;
    }

    if (emailCliente) data.emailCliente = emailCliente;
    if (telefonoCliente) data.telefonoCliente = telefonoCliente;
    if (dniRuc) data.dniRuc = dniRuc;
    if (addressData.direccion) data.direccionEntrega = addressData.direccion;
    if (addressData.distrito) data.distrito = addressData.distrito;
    if (addressData.provincia) data.provincia = addressData.provincia;
    if (addressData.codigoPostal) data.codigoPostal = addressData.codigoPostal;
    if (addressData.referencia) data.referencia = addressData.referencia;
    if (addressData.coordenadas) data.coordenadas = addressData.coordenadas;
    if (descuento > 0) data.descuento = descuento;
    if (costoEnvio > 0) data.costoEnvio = costoEnvio;
    data.incluyeEnvio = incluyeEnvio;
    if ((canalNombre.toLowerCase().includes('mercado libre') || canal === 'mercado_libre') && mercadoLibreId) data.mercadoLibreId = mercadoLibreId;

    // Preparar datos del adelanto si corresponde
    let adelantoData: AdelantoData | undefined;
    if (registrarAdelanto && montoAdelanto > 0) {
      adelantoData = {
        monto: montoAdelanto,
        metodoPago: metodoPagoAdelanto,
        referencia: referenciaAdelanto || undefined,
        cuentaDestinoId: cuentaDestinoId || undefined
      };
    }

    onSubmit(data, esVentaDirecta, adelantoData);
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

  // Validaciones por paso
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: // Productos
        const productosValidos = productos.filter(p =>
          p.productoId && p.cantidad > 0 && p.precioUnitario > 0
        );
        if (productosValidos.length === 0) {
          toast.warning('Debes agregar al menos un producto con cantidad y precio válidos');
          return false;
        }
        return true;
      case 1: // Cliente
        if (!nombreCliente.trim()) {
          toast.warning('El nombre del cliente es requerido');
          return false;
        }
        return true;
      case 2: // Pago
        if (registrarAdelanto && montoAdelanto <= 0) {
          toast.warning('El monto del adelanto debe ser mayor a 0');
          return false;
        }
        if (registrarAdelanto && montoAdelanto > totalPEN) {
          toast.warning('El adelanto no puede ser mayor al total de la venta');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      nextStep();
    }
  };

  const handlePrevStep = () => {
    prevStep();
  };

  return (
    <form className="space-y-6">
      {/* Stepper Header */}
      <div className="mb-8">
        <Stepper
          steps={VENTA_STEPS}
          currentStep={currentStep}
          onStepClick={goToStep}
          size="md"
          allowClickCompleted={true}
        />
      </div>

      {/* Contenido por Paso */}
      <StepContent currentStep={currentStep}>
        {/* PASO 1: PRODUCTOS */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h4 className="text-base sm:text-lg font-semibold text-gray-900">Selecciona los productos</h4>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowProductoModal(true)}
                className="text-primary-600 flex-1 sm:flex-none"
              >
                <PlusCircle className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Crear Producto</span>
                <span className="sm:hidden">Crear</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddProducto}
                className="flex-1 sm:flex-none"
              >
                <Plus className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Agregar Línea</span>
                <span className="sm:hidden">Agregar</span>
              </Button>
            </div>
          </div>

          {/* Alerta si no hay productos */}
          {productosDisponibles.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">No hay productos registrados</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Primero debes crear productos en el sistema. Usa el botón "Crear Producto" arriba.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {productos.map((item, index) => {
              const stockDisponible = item.snapshot?.stockLibre ?? getStockDisponible(item.productoId);
              const stockInsuficiente = item.productoId && item.cantidad > stockDisponible;
              const productoSeleccionado = productosDisponibles.find(p => p.productoId === item.productoId);
              const tieneInvestigacion = productoSeleccionado?.investigacion;
              const margenActual = item.snapshot?.ctruPromedio && item.precioUnitario > 0
                ? ((item.precioUnitario - item.snapshot.ctruPromedio) / item.precioUnitario) * 100
                : null;

              return (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="flex-1 space-y-3">
                      {/* Buscador inteligente de productos */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Producto
                        </label>
                        <ProductoSearchVentas
                          productos={productosDisponibles}
                          value={item.snapshot}
                          onChange={(snapshot) => handleProductoSelect(index, snapshot)}
                          placeholder="Buscar por SKU, marca o nombre..."
                          required
                        />
                      </div>

                      {/* Cantidad, Precio y Subtotal */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
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
                              Stock disponible: {stockDisponible}
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

                        {/* Margen en tiempo real */}
                        <div className="text-center">
                          {margenActual !== null ? (
                            <div className={`px-3 py-2 rounded-lg ${
                              margenActual >= 20 ? 'bg-green-100' :
                              margenActual >= 10 ? 'bg-yellow-100' : 'bg-red-100'
                            }`}>
                              <div className="text-xs text-gray-600">Margen</div>
                              <div className={`text-lg font-bold ${
                                margenActual >= 20 ? 'text-green-600' :
                                margenActual >= 10 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {margenActual.toFixed(1)}%
                              </div>
                            </div>
                          ) : item.snapshot && (
                            <div className="px-3 py-2 rounded-lg bg-gray-100">
                              <div className="text-xs text-gray-500">Margen</div>
                              <div className="text-sm text-gray-400">-</div>
                            </div>
                          )}
                        </div>

                        {/* Subtotal y eliminar */}
                        <div className="flex items-center justify-between">
                          <div className="text-right flex-1">
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
                              className="text-danger-600 hover:text-danger-900 ml-2"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Precios rápidos de investigación si está disponible */}
                      {tieneInvestigacion && item.productoId && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
                          <span className="text-xs text-gray-500 w-full sm:w-auto">Aplicar precio:</span>
                          <button
                            type="button"
                            onClick={() => handleProductoChange(index, 'precioUnitario', tieneInvestigacion.precioEntrada.toFixed(2))}
                            className={`px-2 py-1 text-xs rounded-full transition-colors ${
                              Math.abs(item.precioUnitario - tieneInvestigacion.precioEntrada) < 1
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                          >
                            Entrada S/{tieneInvestigacion.precioEntrada.toFixed(0)}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleProductoChange(index, 'precioUnitario', tieneInvestigacion.precioPERUMin.toFixed(2))}
                            className={`px-2 py-1 text-xs rounded-full transition-colors ${
                              Math.abs(item.precioUnitario - tieneInvestigacion.precioPERUMin) < 1
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                          >
                            Mín. S/{tieneInvestigacion.precioPERUMin.toFixed(0)}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleProductoChange(index, 'precioUnitario', tieneInvestigacion.precioPERUPromedio.toFixed(2))}
                            className={`px-2 py-1 text-xs rounded-full transition-colors ${
                              Math.abs(item.precioUnitario - tieneInvestigacion.precioPERUPromedio) < 1
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                          >
                            Prom. S/{tieneInvestigacion.precioPERUPromedio.toFixed(0)}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Descuento y Envío */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <Input
              label="Descuento (PEN)"
              type="number"
              step="0.01"
              min="0"
              value={descuento}
              onChange={(e) => setDescuento(parseFloat(e.target.value) || 0)}
            />

            <Input
              label="Costo de Envío (PEN)"
              type="number"
              step="0.01"
              min="0"
              value={costoEnvio}
              onChange={(e) => setCostoEnvio(parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Tipo de envío */}
          {costoEnvio > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-gray-50 p-3 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Tipo de envío:</span>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="tipoEnvio"
                    checked={incluyeEnvio}
                    onChange={() => setIncluyeEnvio(true)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600">Envío gratis</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="tipoEnvio"
                    checked={!incluyeEnvio}
                    onChange={() => setIncluyeEnvio(false)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600">Cliente paga</span>
                </label>
              </div>
            </div>
          )}

          {/* Subtotal del paso */}
          <div className="bg-gray-100 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700">Subtotal de productos:</span>
              <span className="text-xl font-bold text-primary-600">S/ {subtotalPEN.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* PASO 2: CLIENTE */}
        <div className="space-y-6">
          <h4 className="text-lg font-semibold text-gray-900">Datos del Cliente</h4>

          {/* Autocomplete de Cliente */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar o crear cliente
            </label>
            <ClienteAutocomplete
              value={clienteSeleccionado}
              onChange={handleClienteChange}
              onCreateNew={handleCreateClienteInline}
              placeholder="Buscar por nombre, teléfono o DNI..."
              allowCreate={true}
            />
          </div>

          {/* Historial del Cliente (si está seleccionado y tiene historial) */}
          {clienteSeleccionado && historialCliente && historialCliente.totalCompras > 0 && (
            <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <History className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-800">Historial del Cliente</span>
                {historialCliente.totalCompras >= 5 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                    <Star className="h-3 w-3" />
                    Cliente frecuente
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg sm:text-2xl font-bold text-blue-700">
                    <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />
                    {historialCliente.totalCompras}
                  </div>
                  <p className="text-xs text-gray-600">Compras</p>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl font-bold text-green-600">
                    S/{historialCliente.montoTotal.toFixed(0)}
                  </div>
                  <p className="text-xs text-gray-600">Total</p>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl font-bold text-purple-600">
                    S/{(historialCliente.montoTotal / historialCliente.totalCompras).toFixed(0)}
                  </div>
                  <p className="text-xs text-gray-600">Promedio</p>
                </div>
              </div>
              {historialCliente.ultimaCompra && (
                <p className="mt-2 text-xs text-gray-500 text-center">
                  Última compra: {historialCliente.ultimaCompra.toLocaleDateString('es-PE')}
                </p>
              )}
              {historialCliente.productosFavoritos.length > 0 && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-xs text-gray-600 mb-1">Productos frecuentes:</p>
                  <div className="flex flex-wrap gap-1">
                    {historialCliente.productosFavoritos.slice(0, 3).map((prod, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-white text-xs text-gray-700 rounded border">
                        {prod}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {loadingHistorial && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-center text-sm text-gray-500">
              Cargando historial del cliente...
            </div>
          )}

          {/* Campos editables del cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre del Cliente"
              value={nombreCliente}
              onChange={(e) => setNombreCliente(e.target.value)}
              required
              disabled={!!clienteSeleccionado}
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

          {/* Dirección de Entrega con Google Maps */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="inline h-4 w-4 mr-1" />
              Dirección de Entrega
            </label>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <GoogleMapsAddressInput
                value={addressData}
                onChange={setAddressData}
              />
            </div>
          </div>

          {/* Canal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <CanalAutocomplete
              label="Canal de Venta"
              value={canal}
              onChange={(canalId, canalObj) => {
                setCanal(canalId);
                setCanalNombre(canalObj?.nombre || canalId);
              }}
              placeholder="Buscar o crear canal..."
              required
            />

            {(canalNombre.toLowerCase().includes('mercado libre') || canal === 'mercado_libre') && (
              <Input
                label="ID de Mercado Libre"
                value={mercadoLibreId}
                onChange={(e) => setMercadoLibreId(e.target.value)}
                placeholder="ej: MLB123456789"
              />
            )}
          </div>
        </div>

        {/* PASO 3: PAGO */}
        <div className="space-y-6">
          <h4 className="text-lg font-semibold text-gray-900">Método de Pago</h4>

          {/* Sección de Adelanto */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div
              className={`p-4 cursor-pointer transition-colors ${
                registrarAdelanto ? 'bg-success-50 border-b border-success-200' : 'bg-gray-50 hover:bg-gray-100'
              }`}
              onClick={() => setRegistrarAdelanto(!registrarAdelanto)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${registrarAdelanto ? 'bg-success-100' : 'bg-gray-200'}`}>
                    <CreditCard className={`h-5 w-5 ${registrarAdelanto ? 'text-success-600' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Registrar Adelanto</h4>
                    <p className="text-sm text-gray-500">
                      {registrarAdelanto
                        ? 'El cliente realizará un pago anticipado'
                        : 'Haz clic para registrar un adelanto del cliente'}
                    </p>
                  </div>
                </div>
                <div className={`w-12 h-6 rounded-full transition-colors ${
                  registrarAdelanto ? 'bg-success-500' : 'bg-gray-300'
                }`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform mt-0.5 ${
                    registrarAdelanto ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </div>
              </div>
            </div>

            {registrarAdelanto && (
              <div className="p-4 space-y-4 bg-white">
                {/* Monto del adelanto */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Input
                      label="Monto del Adelanto (PEN)"
                      type="number"
                      step="0.01"
                      min="0"
                      max={totalPEN}
                      value={montoAdelanto}
                      onChange={(e) => setMontoAdelanto(parseFloat(e.target.value) || 0)}
                      helperText={`Máximo: S/ ${totalPEN.toFixed(2)}`}
                    />
                    {/* Botones de porcentaje rápido */}
                    <div className="flex gap-2 mt-2">
                      {[25, 50, 75, 100].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setMontoAdelanto(Math.round((totalPEN * pct / 100) * 100) / 100)}
                          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                            Math.abs(montoAdelanto - (totalPEN * pct / 100)) < 0.01
                              ? 'bg-primary-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <Input
                    label="Referencia / N° Operación"
                    type="text"
                    value={referenciaAdelanto}
                    onChange={(e) => setReferenciaAdelanto(e.target.value)}
                    placeholder="Ej: Transferencia #123"
                  />
                </div>

                {/* Método de pago */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Método de Pago
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {METODOS_PAGO.map((metodo) => (
                      <button
                        key={metodo.value}
                        type="button"
                        onClick={() => setMetodoPagoAdelanto(metodo.value)}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-colors ${
                          metodoPagoAdelanto === metodo.value
                            ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-200'
                            : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        {metodo.icon}
                        <span className="text-xs font-medium mt-1">{metodo.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cuenta destino */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Cuenta Destino
                    </div>
                  </label>
                  {loadingCuentas ? (
                    <div className="text-sm text-gray-500">Cargando cuentas...</div>
                  ) : cuentas.length === 0 ? (
                    <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                      No hay cuentas configuradas. El adelanto se registrará sin asociar a una cuenta.
                    </div>
                  ) : (
                    <select
                      value={cuentaDestinoId}
                      onChange={(e) => setCuentaDestinoId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm"
                    >
                      <option value="">Sin cuenta específica</option>
                      {cuentas.map((cuenta) => {
                        const saldoPEN = cuenta.esBiMoneda ? (cuenta.saldoPEN || 0) : cuenta.saldoActual;
                        return (
                          <option key={cuenta.id} value={cuenta.id}>
                            {cuenta.nombre} {cuenta.banco ? `(${cuenta.banco})` : ''} - Saldo: S/ {saldoPEN.toFixed(2)}
                          </option>
                        );
                      })}
                    </select>
                  )}
                  {cuentaSeleccionada && (
                    <div className="text-xs text-success-600">
                      El adelanto se sumará al saldo de "{cuentaSeleccionada.nombre}"
                    </div>
                  )}
                </div>
              </div>
            )}
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
        </div>

        {/* PASO 4: CONFIRMACIÓN */}
        <div className="space-y-6">
          <h4 className="text-lg font-semibold text-gray-900">Revisa y confirma tu venta</h4>

          {/* Resumen de productos */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Productos ({productos.filter(p => p.productoId).length})
            </h5>
            <div className="space-y-2">
              {productos.filter(p => p.productoId).map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                  <div>
                    <span className="font-medium">{getProductoNombre(item.productoId)}</span>
                    <span className="text-gray-500 text-sm ml-2">x{item.cantidad}</span>
                  </div>
                  <span className="font-semibold">S/ {(item.cantidad * item.precioUnitario).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Resumen del cliente */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Cliente
            </h5>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Nombre:</span>
                <span className="ml-2 font-medium">{nombreCliente || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">DNI/RUC:</span>
                <span className="ml-2 font-medium">{dniRuc || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>
                <span className="ml-2 font-medium">{emailCliente || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">Teléfono:</span>
                <span className="ml-2 font-medium">{telefonoCliente || '-'}</span>
              </div>
              {addressData.direccion && (
                <div className="col-span-2">
                  <span className="text-gray-500">Dirección:</span>
                  <span className="ml-2 font-medium">{addressData.direccion}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Canal:</span>
                <span className="ml-2 font-medium">{canalNombre || canal || '-'}</span>
              </div>
            </div>
          </div>

          {/* Totales */}
          <div className="bg-primary-50 p-6 rounded-lg">
            <h5 className="font-medium text-gray-900 mb-4">Resumen de la Venta</h5>
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

              {costoEnvio > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    Envío {incluyeEnvio ? '(gratis)' : '(cobrado al cliente)'}:
                  </span>
                  <span className={`font-semibold ${incluyeEnvio ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {incluyeEnvio ? '' : '+ '}S/ {costoEnvio.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="border-t border-primary-200 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total:</span>
                  <span className="text-2xl font-bold text-primary-600">S/ {totalPEN.toFixed(2)}</span>
                </div>
              </div>

              {registrarAdelanto && montoAdelanto > 0 && (
                <div className="border-t border-primary-200 pt-2 mt-2">
                  <div className="flex justify-between text-success-600">
                    <span className="font-medium">Adelanto a registrar:</span>
                    <span className="font-semibold">- S/ {montoAdelanto.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-amber-600 mt-1">
                    <span className="font-medium">Saldo pendiente:</span>
                    <span className="font-semibold">S/ {(totalPEN - montoAdelanto).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {observaciones && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-2">Observaciones</h5>
              <p className="text-sm text-gray-600">{observaciones}</p>
            </div>
          )}
        </div>
      </StepContent>

      {/* Navegación entre pasos */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-6 border-t">
        <div className="order-2 sm:order-1">
          {!isFirstStep && (
            <Button
              type="button"
              variant="ghost"
              onClick={handlePrevStep}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 order-1 sm:order-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
            className="order-last sm:order-first"
          >
            Cancelar
          </Button>

          {!isLastStep ? (
            <Button
              type="button"
              variant="primary"
              onClick={handleNextStep}
              className="w-full sm:w-auto"
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleSubmitCotizacion}
                loading={loading}
                className="w-full sm:w-auto"
              >
                <span className="hidden sm:inline">Guardar como Cotización</span>
                <span className="sm:hidden">Cotización</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmitVenta}
                loading={loading}
                className="w-full sm:w-auto"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Confirmar Venta</span>
                <span className="sm:hidden">Confirmar</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Crear Producto */}
      {showProductoModal && (
        <Modal
          isOpen={showProductoModal}
          onClose={() => setShowProductoModal(false)}
          title="Nuevo Producto"
          size="xl"
        >
          <ProductoForm
            onSubmit={handleCreateProducto}
            onCancel={() => setShowProductoModal(false)}
            loading={isCreatingProducto}
            productosExistentes={productosStore}
          />
        </Modal>
      )}
    </form>
  );
};