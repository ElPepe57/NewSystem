import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, Wallet, CreditCard, Banknote, Smartphone, Building2, TrendingUp, Info, PlusCircle, History, ShoppingBag, Star } from 'lucide-react';
import { Button, Input, Select, Modal } from '../../common';
import { ProductoForm } from '../productos/ProductoForm';
import { ClienteAutocomplete } from '../entidades/ClienteAutocomplete';
import { tesoreriaService } from '../../../services/tesoreria.service';
import { clienteService } from '../../../services/cliente.service';
import { useProductoStore } from '../../../store/productoStore';
import { useAuthStore } from '../../../store/authStore';
import { useClienteStore } from '../../../store/clienteStore';
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
  loading = false,
  onProductoCreated
}) => {
  const { user } = useAuthStore();
  const { productos: productosStore, createProducto } = useProductoStore();

  // Modal de crear producto
  const [showProductoModal, setShowProductoModal] = useState(false);
  const [isCreatingProducto, setIsCreatingProducto] = useState(false);

  // Cliente inteligente
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteSnapshot | null>(null);
  const [nombreCliente, setNombreCliente] = useState('');
  const [emailCliente, setEmailCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [dniRuc, setDniRuc] = useState('');
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [historialCliente, setHistorialCliente] = useState<{
    totalCompras: number;
    montoTotal: number;
    ultimaCompra?: Date;
    productosFavoritos: string[];
  } | null>(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const [canal, setCanal] = useState<CanalVenta>('directo');
  const [mercadoLibreId, setMercadoLibreId] = useState('');
  const [productos, setProductos] = useState<ProductoVentaItem[]>([
    { productoId: '', cantidad: 1, precioUnitario: 0 }
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
            if (clienteCompleto.direccionPrincipal && !direccionEntrega) {
              setDireccionEntrega(clienteCompleto.direccionPrincipal);
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
        canalOrigen: data.canalOrigen || 'whatsapp'
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
      alert(`Error al crear cliente: ${error.message}`);
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

  // Handler para crear producto desde el modal interno
  const handleCreateProducto = async (data: ProductoFormData) => {
    if (!user) return;

    setIsCreatingProducto(true);
    try {
      await createProducto(data, user.uid);
      setShowProductoModal(false);
      // Notificar al padre para que refresque los productos disponibles
      onProductoCreated?.();
      alert('✅ Producto creado correctamente. Ya puedes seleccionarlo en la lista.');
    } catch (error: any) {
      alert(`❌ Error al crear producto: ${error.message}`);
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
      alert('Debes agregar al menos un producto con cantidad y precio válidos');
      return;
    }

    // Validar adelanto si está activo
    if (registrarAdelanto) {
      if (montoAdelanto <= 0) {
        alert('El monto del adelanto debe ser mayor a 0');
        return;
      }
      if (montoAdelanto > totalPEN) {
        alert('El adelanto no puede ser mayor al total de la venta');
        return;
      }
    }

    const data: VentaFormData = {
      nombreCliente,
      canal,
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
    if (direccionEntrega) data.direccionEntrega = direccionEntrega;
    if (descuento > 0) data.descuento = descuento;
    if (costoEnvio > 0) data.costoEnvio = costoEnvio;
    data.incluyeEnvio = incluyeEnvio;
    if (canal === 'mercado_libre' && mercadoLibreId) data.mercadoLibreId = mercadoLibreId;

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

  return (
    <form className="space-y-6">
      {/* Cliente Inteligente */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Datos del Cliente</h4>

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
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-blue-700">
                  <ShoppingBag className="h-5 w-5" />
                  {historialCliente.totalCompras}
                </div>
                <p className="text-xs text-gray-600">Compras</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  S/{historialCliente.montoTotal.toFixed(0)}
                </div>
                <p className="text-xs text-gray-600">Total gastado</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  S/{(historialCliente.montoTotal / historialCliente.totalCompras).toFixed(0)}
                </div>
                <p className="text-xs text-gray-600">Ticket promedio</p>
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
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowProductoModal(true)}
              className="text-primary-600"
            >
              <PlusCircle className="h-4 w-4 mr-1" />
              Crear Producto
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAddProducto}
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar Línea
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {productos.map((item, index) => {
            const stockDisponible = getStockDisponible(item.productoId);
            const stockInsuficiente = item.productoId && item.cantidad > stockDisponible;
            const productoSeleccionado = productosDisponibles.find(p => p.productoId === item.productoId);
            const tieneInvestigacion = productoSeleccionado?.investigacion;

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

                {/* Sugerencia de precio basado en investigación */}
                {tieneInvestigacion && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-800">Rango de precios sugerido</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
                          <div>
                            <span className="text-blue-600">Entrada competitiva:</span>
                            <span className="ml-1 font-semibold text-blue-800">
                              S/{tieneInvestigacion.precioEntrada.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-blue-600">Mín. mercado:</span>
                            <span className="ml-1 font-semibold text-blue-800">
                              S/{tieneInvestigacion.precioPERUMin.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-blue-600">Promedio:</span>
                            <span className="ml-1 font-semibold text-blue-800">
                              S/{tieneInvestigacion.precioPERUPromedio.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-blue-600">Máx. mercado:</span>
                            <span className="ml-1 font-semibold text-blue-800">
                              S/{tieneInvestigacion.precioPERUMax.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        {/* Botones rápidos para aplicar precio */}
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => handleProductoChange(index, 'precioUnitario', tieneInvestigacion.precioEntrada.toFixed(2))}
                            className={`px-2 py-1 text-xs rounded-full transition-colors ${
                              Math.abs(item.precioUnitario - tieneInvestigacion.precioEntrada) < 1
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                          >
                            Entrada
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
                            Mínimo
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
                            Promedio
                          </button>
                        </div>
                        {/* Margen estimado */}
                        {tieneInvestigacion.ctruEstimado > 0 && item.precioUnitario > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <Info className="h-3 w-3 text-blue-500" />
                            <span className="text-xs text-blue-600">
                              Margen estimado:{' '}
                              <span className={`font-semibold ${
                                ((item.precioUnitario - tieneInvestigacion.ctruEstimado) / item.precioUnitario * 100) >= 20
                                  ? 'text-green-600'
                                  : ((item.precioUnitario - tieneInvestigacion.ctruEstimado) / item.precioUnitario * 100) >= 10
                                    ? 'text-yellow-600'
                                    : 'text-red-600'
                              }`}>
                                {((item.precioUnitario - tieneInvestigacion.ctruEstimado) / item.precioUnitario * 100).toFixed(1)}%
                              </span>
                              {' '}(CTRU: S/{tieneInvestigacion.ctruEstimado.toFixed(2)})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Descuento y Envío */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div className="flex items-center space-x-4 bg-gray-50 p-3 rounded-lg">
          <span className="text-sm font-medium text-gray-700">Tipo de envío:</span>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="tipoEnvio"
              checked={incluyeEnvio}
              onChange={() => setIncluyeEnvio(true)}
              className="mr-2"
            />
            <span className="text-sm text-gray-600">Envío gratis (asumido por la empresa)</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="tipoEnvio"
              checked={!incluyeEnvio}
              onChange={() => setIncluyeEnvio(false)}
              className="mr-2"
            />
            <span className="text-sm text-gray-600">Cliente paga envío</span>
          </label>
        </div>
      )}

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

          {/* Mostrar adelanto en resumen si está activo */}
          {registrarAdelanto && montoAdelanto > 0 && (
            <>
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
            </>
          )}
        </div>
      </div>

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
                    // Para cuentas bi-moneda, mostrar saldoPEN; para mono-moneda, saldoActual
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
          variant="secondary"
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