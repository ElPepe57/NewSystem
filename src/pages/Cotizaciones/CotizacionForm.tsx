import React, { useEffect, useState, useMemo } from 'react';
import { X, Plus, Trash2, Search, AlertTriangle, Package, TrendingUp, Info, PlusCircle, User, Star, ShoppingBag, History, Download, FileText, MapPin, Truck, Clock, ShoppingCart } from 'lucide-react';
import { Modal, Input, Select, Button, Badge } from '../../components/common';
import { ProductoForm } from '../../components/modules/productos/ProductoForm';
import { ClienteAutocomplete } from '../../components/modules/entidades/ClienteAutocomplete';
import { useCotizacionStore } from '../../store/cotizacionStore';
import { useConfiguracionStore } from '../../store/configuracionStore';
import { useVentaStore } from '../../store/ventaStore';
import { useProductoStore } from '../../store/productoStore';
import { useAuthStore } from '../../store/authStore';
import { inventarioService } from '../../services/inventario.service';
import { clienteService } from '../../services/cliente.service';
import { CotizacionPdfService } from '../../services/cotizacionPdf.service';
import { stockDisponibilidadService } from '../../services/stockDisponibilidad.service';
import type { Cotizacion, CotizacionFormData } from '../../types/cotizacion.types';
import type { CanalVenta, ProductoDisponible } from '../../types/venta.types';
import type { ProductoFormData } from '../../types/producto.types';
import type { ClienteSnapshot, ClienteFormData } from '../../types/entidadesMaestras.types';
import type { DisponibilidadProducto, FuenteStock } from '../../types/stockDisponibilidad.types';

interface ProductoLinea {
  productoId: string;
  sku: string;
  marca: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  stockDisponible: number;  // Stock total disponible (Perú + USA)
  investigacion?: ProductoDisponible['investigacion']; // Datos de investigación

  // ========== Información Multi-Almacén ==========
  disponibilidadMultiAlmacen?: {
    stockPeru: number;
    stockUSA: number;
    stockTotal: number;
    fuenteRecomendada: FuenteStock;
    cantidadDesdePeru: number;
    cantidadDesdeUSA: number;
    cantidadVirtual: number;  // Cantidad que irá a requerimiento
    tiempoEstimadoDias: number;
    razonRecomendacion?: string;
  };
}

interface CotizacionFormProps {
  onClose: () => void;
  cotizacionEditar?: Cotizacion | null;  // Si se pasa, modo edición
}

export const CotizacionForm: React.FC<CotizacionFormProps> = ({ onClose, cotizacionEditar }) => {
  const { user } = useAuthStore();
  const { empresa, fetchEmpresa } = useConfiguracionStore();
  const { createCotizacion, updateCotizacion, loading, fetchCotizacionById, selectedCotizacion } = useCotizacionStore();

  // Modo edición: solo si tiene ID válido, sino es duplicación (crear nueva)
  const modoEdicion = !!cotizacionEditar?.id;
  const modoDuplicacion = !!cotizacionEditar && !cotizacionEditar.id;
  const { fetchProductosDisponibles, productosDisponibles } = useVentaStore();
  const { productos, fetchProductos, createProducto } = useProductoStore();

  // Estado para mostrar modal de éxito con opción de PDF
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [cotizacionCreada, setCotizacionCreada] = useState<Cotizacion | null>(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  // ========== Cliente Inteligente (CRM) ==========
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteSnapshot | null>(null);
  const [historialCliente, setHistorialCliente] = useState<{
    totalCompras: number;
    montoTotal: number;
    ultimaCompra?: Date;
    productosFavoritos: string[];
    clasificacionABC?: string;
    segmento?: string;
  } | null>(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const [formData, setFormData] = useState({
    nombreCliente: '',
    telefonoCliente: '',
    emailCliente: '',
    direccionEntrega: '',
    dniRuc: '',
    canal: 'directo' as CanalVenta,
    descuento: 0,
    costoEnvio: 0,
    incluyeEnvio: true,
    observaciones: ''
  });

  const [lineas, setLineas] = useState<ProductoLinea[]>([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [productosFiltrados, setProductosFiltrados] = useState<typeof productos>([]);
  const [showProductoSelector, setShowProductoSelector] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de crear producto
  const [showProductoModal, setShowProductoModal] = useState(false);
  const [isCreatingProducto, setIsCreatingProducto] = useState(false);

  // ========== Handler para cliente del CRM ==========
  const handleClienteChange = async (cliente: ClienteSnapshot | null) => {
    setClienteSeleccionado(cliente);

    if (cliente) {
      // Autocompletar campos del formulario
      setFormData(prev => ({
        ...prev,
        nombreCliente: cliente.nombre,
        telefonoCliente: cliente.telefono || '',
        emailCliente: cliente.email || '',
        dniRuc: cliente.dniRuc || ''
      }));

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
              productosFavoritos: clienteCompleto.metricas.productosFavoritos || [],
              clasificacionABC: clienteCompleto.clasificacionABC,
              segmento: clienteCompleto.segmento
            });
            // Autocompletar dirección principal si existe
            if (clienteCompleto.direccionPrincipal && !formData.direccionEntrega) {
              setFormData(prev => ({ ...prev, direccionEntrega: clienteCompleto.direccionPrincipal || '' }));
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
      setFormData(prev => ({
        ...prev,
        nombreCliente: '',
        telefonoCliente: '',
        emailCliente: '',
        dniRuc: '',
        direccionEntrega: ''
      }));
    }
  };

  // Handler para crear nuevo cliente inline
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

  useEffect(() => {
    fetchProductos();
    fetchProductosDisponibles();
    fetchEmpresa();
  }, [fetchProductos, fetchProductosDisponibles, fetchEmpresa]);

  // Cargar datos de cotización a editar
  useEffect(() => {
    if (cotizacionEditar) {
      // Cargar datos del formulario
      setFormData({
        nombreCliente: cotizacionEditar.nombreCliente,
        telefonoCliente: cotizacionEditar.telefonoCliente || '',
        emailCliente: cotizacionEditar.emailCliente || '',
        direccionEntrega: cotizacionEditar.direccionEntrega || '',
        dniRuc: cotizacionEditar.dniRuc || '',
        canal: cotizacionEditar.canal,
        descuento: cotizacionEditar.descuento || 0,
        costoEnvio: cotizacionEditar.costoEnvio || 0,
        incluyeEnvio: cotizacionEditar.incluyeEnvio,
        observaciones: cotizacionEditar.observaciones || ''
      });

      // Cargar líneas de productos
      const lineasCargadas: ProductoLinea[] = cotizacionEditar.productos.map(p => ({
        productoId: p.productoId,
        sku: p.sku,
        marca: p.marca,
        nombre: p.nombreComercial,
        cantidad: p.cantidad,
        precioUnitario: p.precioUnitario,
        subtotal: p.subtotal,
        stockDisponible: p.stockDisponible || 0
      }));
      setLineas(lineasCargadas);

      // Si tiene clienteId, configurar el cliente seleccionado
      if (cotizacionEditar.clienteId) {
        setClienteSeleccionado({
          clienteId: cotizacionEditar.clienteId,
          nombre: cotizacionEditar.nombreCliente,
          telefono: cotizacionEditar.telefonoCliente,
          email: cotizacionEditar.emailCliente,
          dniRuc: cotizacionEditar.dniRuc
        });
      }
    }
  }, [cotizacionEditar]);

  useEffect(() => {
    if (busquedaProducto.length >= 2) {
      const filtrados = productos.filter(p =>
        p.sku.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
        p.nombreComercial.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
        p.marca.toLowerCase().includes(busquedaProducto.toLowerCase())
      );
      setProductosFiltrados(filtrados);
      setShowProductoSelector(true);
    } else {
      setProductosFiltrados([]);
      setShowProductoSelector(false);
    }
  }, [busquedaProducto, productos]);

  const handleAgregarProducto = async (producto: typeof productos[0]) => {
    // Verificar si ya existe
    if (lineas.some(l => l.productoId === producto.id)) {
      alert('Este producto ya está en la cotización');
      return;
    }

    // Obtener disponibilidad multi-almacén (Perú + USA)
    let stockDisponible = 0;
    let disponibilidadMultiAlmacen: ProductoLinea['disponibilidadMultiAlmacen'] = undefined;

    try {
      const consulta = await stockDisponibilidadService.consultarDisponibilidad({
        productos: [{ productoId: producto.id, cantidadRequerida: 1 }],
        incluirRecomendacion: true,
        priorizarPeru: true
      });

      const disponibilidad = consulta.productos[0];
      if (disponibilidad) {
        stockDisponible = disponibilidad.totalLibre;

        const recomendacion = disponibilidad.recomendacion;
        disponibilidadMultiAlmacen = {
          stockPeru: disponibilidad.disponiblePeru,
          stockUSA: disponibilidad.disponibleUSA,
          stockTotal: disponibilidad.totalLibre,
          fuenteRecomendada: recomendacion?.fuente || 'virtual',
          cantidadDesdePeru: recomendacion?.almacenesRecomendados
            .filter(a => disponibilidad.almacenes.find(al => al.almacenId === a.almacenId)?.pais === 'Peru')
            .reduce((sum, a) => sum + a.cantidad, 0) || 0,
          cantidadDesdeUSA: recomendacion?.almacenesRecomendados
            .filter(a => disponibilidad.almacenes.find(al => al.almacenId === a.almacenId)?.pais === 'USA')
            .reduce((sum, a) => sum + a.cantidad, 0) || 0,
          cantidadVirtual: recomendacion?.cantidadFaltante || 0,
          tiempoEstimadoDias: recomendacion?.almacenesRecomendados
            .reduce((max, a) => Math.max(max, a.tiempoEstimadoDias), 0) || 0,
          razonRecomendacion: recomendacion?.razon
        };
      }
    } catch (error) {
      console.warn('No se pudo obtener disponibilidad multi-almacén:', error);
      // Fallback al método anterior
      try {
        const inventario = await inventarioService.getInventarioProducto(producto.id);
        stockDisponible = inventario
          .filter(inv => inv.pais === 'Peru')
          .reduce((sum, inv) => sum + inv.disponibles, 0);
      } catch (e) {
        console.warn('No se pudo obtener stock:', e);
      }
    }

    // Obtener datos de investigación desde productosDisponibles
    const productoConInvestigacion = productosDisponibles.find(p => p.productoId === producto.id);

    const nuevaLinea: ProductoLinea = {
      productoId: producto.id,
      sku: producto.sku,
      marca: producto.marca,
      nombre: producto.nombreComercial,
      cantidad: 1,
      precioUnitario: producto.precioSugerido || 0,
      subtotal: producto.precioSugerido || 0,
      stockDisponible,
      investigacion: productoConInvestigacion?.investigacion,
      disponibilidadMultiAlmacen
    };

    setLineas([...lineas, nuevaLinea]);
    setBusquedaProducto('');
    setShowProductoSelector(false);
  };

  // Handler para crear producto desde el modal interno
  const handleCreateProducto = async (data: ProductoFormData) => {
    if (!user) return;

    setIsCreatingProducto(true);
    try {
      await createProducto(data, user.uid);
      // Refrescar lista de productos
      await fetchProductos();
      await fetchProductosDisponibles();
      setShowProductoModal(false);
      alert('✅ Producto creado correctamente');
    } catch (error: any) {
      alert(`❌ Error al crear producto: ${error.message}`);
    } finally {
      setIsCreatingProducto(false);
    }
  };

  const handleUpdateLinea = (index: number, field: keyof ProductoLinea, value: number) => {
    const nuevasLineas = [...lineas];
    nuevasLineas[index] = {
      ...nuevasLineas[index],
      [field]: value,
      subtotal: field === 'cantidad'
        ? value * nuevasLineas[index].precioUnitario
        : field === 'precioUnitario'
          ? nuevasLineas[index].cantidad * value
          : nuevasLineas[index].subtotal
    };
    setLineas(nuevasLineas);
  };

  const handleRemoveLinea = (index: number) => {
    setLineas(lineas.filter((_, i) => i !== index));
  };

  const calcularTotales = () => {
    const subtotal = lineas.reduce((sum, l) => sum + l.subtotal, 0);
    const descuento = formData.descuento || 0;
    const envio = formData.incluyeEnvio ? 0 : (formData.costoEnvio || 0);
    const total = subtotal - descuento + envio;
    return { subtotal, descuento, envio, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert('Debes iniciar sesión');
      return;
    }

    if (lineas.length === 0) {
      alert('Agrega al menos un producto a la cotización');
      return;
    }

    if (!formData.nombreCliente.trim()) {
      alert('El nombre del cliente es requerido');
      return;
    }

    setIsSubmitting(true);

    try {
      const data: CotizacionFormData = {
        nombreCliente: formData.nombreCliente,
        telefonoCliente: formData.telefonoCliente || undefined,
        emailCliente: formData.emailCliente || undefined,
        direccionEntrega: formData.direccionEntrega || undefined,
        dniRuc: formData.dniRuc || undefined,
        canal: formData.canal,
        productos: lineas.map(l => ({
          productoId: l.productoId,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario
        })),
        descuento: formData.descuento || undefined,
        costoEnvio: formData.costoEnvio || undefined,
        incluyeEnvio: formData.incluyeEnvio,
        observaciones: formData.observaciones || undefined,
        diasVigencia: 7 // 7 días de vigencia por defecto
      };

      // Vincular cliente del CRM si está seleccionado
      if (clienteSeleccionado?.clienteId) {
        data.clienteId = clienteSeleccionado.clienteId;
      }

      if (modoEdicion && cotizacionEditar) {
        // MODO EDICIÓN: Actualizar cotización existente
        await updateCotizacion(cotizacionEditar.id, data, user.uid);
        alert('✅ Cotización actualizada exitosamente');
        onClose();
      } else {
        // MODO CREACIÓN: Crear nueva cotización
        const cotizacionId = await createCotizacion(data, user.uid);

        // Obtener la cotización creada para mostrar en el modal y permitir descarga de PDF
        await fetchCotizacionById(cotizacionId);

        // Mostrar modal de éxito con opción de descargar PDF
        const cotizacionCreada = useCotizacionStore.getState().selectedCotizacion;
        if (cotizacionCreada) {
          setCotizacionCreada(cotizacionCreada);
          setShowSuccessModal(true);
        } else {
          // Fallback si no se pudo obtener la cotización
          alert('✅ Cotización creada exitosamente');
          onClose();
        }
      }

    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totales = calcularTotales();

  // Función para descargar PDF
  const handleDescargarPdf = async () => {
    if (!cotizacionCreada || !empresa) return;

    setGenerandoPdf(true);
    try {
      await CotizacionPdfService.downloadPdf(cotizacionCreada, empresa);
    } catch (error: any) {
      alert(`Error al generar PDF: ${error.message}`);
    } finally {
      setGenerandoPdf(false);
    }
  };

  // Función para abrir PDF en nueva pestaña
  const handleAbrirPdf = async () => {
    if (!cotizacionCreada || !empresa) return;

    setGenerandoPdf(true);
    try {
      await CotizacionPdfService.openPdf(cotizacionCreada, empresa);
    } catch (error: any) {
      alert(`Error al generar PDF: ${error.message}`);
    } finally {
      setGenerandoPdf(false);
    }
  };

  // Función para cerrar modal de éxito y volver
  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    setCotizacionCreada(null);
    onClose();
  };

  // Verificar si hay productos sin stock suficiente
  const productosSinStock = useMemo(() => {
    return lineas.filter(l => l.stockDisponible < l.cantidad);
  }, [lineas]);

  const hayProductosSinStock = productosSinStock.length > 0;

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={modoEdicion ? `Editar ${cotizacionEditar?.numeroCotizacion}` : modoDuplicacion ? "Duplicar Cotización" : "Nueva Cotización"}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ========== CLIENTE INTELIGENTE (CRM) ========== */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <User className="h-4 w-4" />
              Cliente
            </h3>
            {clienteSeleccionado && historialCliente && (
              <div className="flex items-center gap-2">
                {historialCliente.clasificacionABC && (
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    historialCliente.clasificacionABC === 'A' ? 'bg-green-100 text-green-700' :
                    historialCliente.clasificacionABC === 'B' ? 'bg-blue-100 text-blue-700' :
                    historialCliente.clasificacionABC === 'C' ? 'bg-gray-100 text-gray-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {historialCliente.clasificacionABC === 'A' && <Star className="h-3 w-3 inline mr-1" />}
                    Clase {historialCliente.clasificacionABC}
                  </span>
                )}
                {historialCliente.segmento && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                    {historialCliente.segmento}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Autocomplete de Cliente del CRM */}
          <div>
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

          {/* Historial del Cliente (si tiene compras) */}
          {clienteSeleccionado && historialCliente && historialCliente.totalCompras > 0 && (
            <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <History className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Historial del Cliente</span>
                {historialCliente.totalCompras >= 5 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                    <Star className="h-3 w-3" />
                    Frecuente
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-lg font-bold text-blue-700">
                    <ShoppingBag className="h-4 w-4" />
                    {historialCliente.totalCompras}
                  </div>
                  <p className="text-xs text-gray-600">Compras</p>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-600">
                    S/{historialCliente.montoTotal.toFixed(0)}
                  </div>
                  <p className="text-xs text-gray-600">Total</p>
                </div>
                <div>
                  <div className="text-lg font-bold text-purple-600">
                    S/{(historialCliente.montoTotal / historialCliente.totalCompras).toFixed(0)}
                  </div>
                  <p className="text-xs text-gray-600">Ticket prom.</p>
                </div>
              </div>
              {historialCliente.ultimaCompra && (
                <p className="mt-2 text-xs text-gray-500 text-center">
                  Última compra: {historialCliente.ultimaCompra.toLocaleDateString('es-PE')}
                </p>
              )}
            </div>
          )}

          {loadingHistorial && (
            <div className="p-2 bg-gray-50 rounded-lg text-center text-sm text-gray-500">
              Cargando historial...
            </div>
          )}

          {/* Campos del cliente (editables) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre del Cliente *"
              value={formData.nombreCliente}
              onChange={(e) => setFormData({ ...formData, nombreCliente: e.target.value })}
              placeholder="Nombre completo"
              required
              disabled={!!clienteSeleccionado}
            />

            <Input
              label="Teléfono"
              value={formData.telefonoCliente}
              onChange={(e) => setFormData({ ...formData, telefonoCliente: e.target.value })}
              placeholder="987654321"
            />

            <Input
              label="Email"
              type="email"
              value={formData.emailCliente}
              onChange={(e) => setFormData({ ...formData, emailCliente: e.target.value })}
              placeholder="cliente@email.com"
            />

            <Input
              label="DNI / RUC"
              value={formData.dniRuc}
              onChange={(e) => setFormData({ ...formData, dniRuc: e.target.value })}
              placeholder="12345678"
            />

            <Select
              label="Canal"
              value={formData.canal}
              onChange={(e) => setFormData({ ...formData, canal: e.target.value as CanalVenta })}
              options={[
                { value: 'directo', label: 'Venta Directa' },
                { value: 'mercado_libre', label: 'Mercado Libre' },
                { value: 'otro', label: 'Otro' }
              ]}
            />

            <Input
              label="Dirección de Entrega"
              value={formData.direccionEntrega}
              onChange={(e) => setFormData({ ...formData, direccionEntrega: e.target.value })}
              placeholder="Av. Principal 123, Lima"
            />
          </div>
        </div>

        {/* Productos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-sm font-medium text-gray-700">Productos</h3>
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
          </div>

          {/* Buscador de productos */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto por SKU, nombre o marca..."
              value={busquedaProducto}
              onChange={(e) => setBusquedaProducto(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />

            {/* Dropdown de productos */}
            {showProductoSelector && productosFiltrados.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                {productosFiltrados.map((producto) => (
                  <button
                    key={producto.id}
                    type="button"
                    onClick={() => handleAgregarProducto(producto)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {producto.sku} - {producto.marca}
                      </div>
                      <div className="text-xs text-gray-500">
                        {producto.nombreComercial}
                      </div>
                    </div>
                    <div className="text-sm text-primary-600 font-medium">
                      {formatCurrency(producto.precioSugerido || 0)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lista de productos agregados */}
          {lineas.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                      Producto
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 w-44">
                      Disponibilidad
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 w-24">
                      Cant.
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 w-32">
                      Precio
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 w-32">
                      Subtotal
                    </th>
                    <th className="px-4 py-2 w-12"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lineas.map((linea, index) => {
                    const sinStock = linea.stockDisponible < linea.cantidad;
                    const inv = linea.investigacion;
                    return (
                      <React.Fragment key={linea.productoId}>
                        <tr className={sinStock ? 'bg-warning-50' : ''}>
                          <td className="px-4 py-2">
                            <div className="text-sm font-medium text-gray-900">
                              {linea.sku}
                            </div>
                            <div className="text-xs text-gray-500">
                              {linea.marca} - {linea.nombre}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            {linea.disponibilidadMultiAlmacen ? (
                              <div className="space-y-1">
                                {/* Stock por ubicación */}
                                <div className="flex items-center gap-2 text-xs">
                                  <div className="flex items-center gap-1" title="Stock en Perú (inmediato)">
                                    <MapPin className="h-3 w-3 text-green-600" />
                                    <span className={linea.disponibilidadMultiAlmacen.stockPeru > 0 ? 'text-green-700 font-medium' : 'text-gray-400'}>
                                      PE: {linea.disponibilidadMultiAlmacen.stockPeru}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1" title="Stock en USA (requiere importación)">
                                    <Truck className="h-3 w-3 text-blue-600" />
                                    <span className={linea.disponibilidadMultiAlmacen.stockUSA > 0 ? 'text-blue-700 font-medium' : 'text-gray-400'}>
                                      US: {linea.disponibilidadMultiAlmacen.stockUSA}
                                    </span>
                                  </div>
                                </div>
                                {/* Distribución sugerida */}
                                {linea.cantidad > 0 && (
                                  <div className="text-xs space-y-0.5">
                                    {Math.min(linea.cantidad, linea.disponibilidadMultiAlmacen.stockPeru) > 0 && (
                                      <div className="flex items-center gap-1 text-green-600">
                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                        {Math.min(linea.cantidad, linea.disponibilidadMultiAlmacen.stockPeru)} de Perú
                                      </div>
                                    )}
                                    {linea.cantidad > linea.disponibilidadMultiAlmacen.stockPeru && linea.disponibilidadMultiAlmacen.stockUSA > 0 && (
                                      <div className="flex items-center gap-1 text-blue-600">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        {Math.min(linea.cantidad - linea.disponibilidadMultiAlmacen.stockPeru, linea.disponibilidadMultiAlmacen.stockUSA)} de USA
                                        {linea.disponibilidadMultiAlmacen.tiempoEstimadoDias > 0 && (
                                          <span className="text-gray-400 ml-1">
                                            (~{linea.disponibilidadMultiAlmacen.tiempoEstimadoDias}d)
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {linea.cantidad > linea.disponibilidadMultiAlmacen.stockTotal && (
                                      <div className="flex items-center gap-1 text-orange-600 font-medium">
                                        <ShoppingCart className="h-3 w-3" />
                                        {linea.cantidad - linea.disponibilidadMultiAlmacen.stockTotal} → Requerimiento
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center">
                                <Badge variant={sinStock ? 'warning' : 'success'}>
                                  {linea.stockDisponible}
                                </Badge>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min="1"
                              value={linea.cantidad}
                              onChange={(e) => handleUpdateLinea(index, 'cantidad', parseInt(e.target.value) || 1)}
                              className={`w-full px-2 py-1 text-center border rounded ${
                                sinStock ? 'border-warning-400 bg-warning-50' : 'border-gray-300'
                              }`}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={linea.precioUnitario}
                              onChange={(e) => handleUpdateLinea(index, 'precioUnitario', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-right border border-gray-300 rounded"
                            />
                            {/* Botones rápidos de precio */}
                            {inv && inv.precioPERUMin > 0 && (
                              <div className="flex gap-1 mt-1 justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateLinea(index, 'precioUnitario', inv.precioEntrada)}
                                  title={`Entrada: S/${inv.precioEntrada.toFixed(2)}`}
                                  className={`px-1.5 py-0.5 text-xs rounded ${
                                    Math.abs(linea.precioUnitario - inv.precioEntrada) < 1
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  }`}
                                >
                                  Ent
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateLinea(index, 'precioUnitario', inv.precioPERUMin)}
                                  title={`Mínimo: S/${inv.precioPERUMin.toFixed(2)}`}
                                  className={`px-1.5 py-0.5 text-xs rounded ${
                                    Math.abs(linea.precioUnitario - inv.precioPERUMin) < 1
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  }`}
                                >
                                  Min
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateLinea(index, 'precioUnitario', inv.precioPERUPromedio)}
                                  title={`Promedio: S/${inv.precioPERUPromedio.toFixed(2)}`}
                                  className={`px-1.5 py-0.5 text-xs rounded ${
                                    Math.abs(linea.precioUnitario - inv.precioPERUPromedio) < 1
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  }`}
                                >
                                  Prom
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(linea.subtotal)}
                            </span>
                            {/* Margen estimado */}
                            {inv && inv.ctruEstimado > 0 && linea.precioUnitario > 0 && (
                              <div className={`text-xs ${
                                ((linea.precioUnitario - inv.ctruEstimado) / linea.precioUnitario * 100) >= 20
                                  ? 'text-green-600'
                                  : ((linea.precioUnitario - inv.ctruEstimado) / linea.precioUnitario * 100) >= 10
                                    ? 'text-yellow-600'
                                    : 'text-red-600'
                              }`}>
                                {((linea.precioUnitario - inv.ctruEstimado) / linea.precioUnitario * 100).toFixed(0)}% margen
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveLinea(index)}
                              className="p-1 text-gray-400 hover:text-danger-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                        {/* Fila de información de precios de mercado */}
                        {inv && inv.precioPERUMin > 0 && (
                          <tr className="bg-blue-50 border-t-0">
                            <td colSpan={6} className="px-4 py-1">
                              <div className="flex items-center gap-4 text-xs text-blue-700">
                                <TrendingUp className="h-3 w-3" />
                                <span>Mercado: S/{inv.precioPERUMin.toFixed(0)} - S/{inv.precioPERUMax.toFixed(0)}</span>
                                <span>|</span>
                                <span>CTRU: S/{inv.ctruEstimado.toFixed(2)}</span>
                                <span>|</span>
                                <span>Demanda: {inv.demandaEstimada}</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-sm text-gray-500">
                Busca y agrega productos a la cotización
              </p>
            </div>
          )}
        </div>

        {/* Totales y Ajustes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 border-b pb-2">
              Ajustes
            </h3>

            <Input
              label="Descuento (S/)"
              type="number"
              min="0"
              step="0.01"
              value={formData.descuento}
              onChange={(e) => setFormData({ ...formData, descuento: parseFloat(e.target.value) || 0 })}
            />

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="incluyeEnvio"
                checked={formData.incluyeEnvio}
                onChange={(e) => setFormData({ ...formData, incluyeEnvio: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="incluyeEnvio" className="text-sm text-gray-700">
                Envío incluido (gratis)
              </label>
            </div>

            {!formData.incluyeEnvio && (
              <Input
                label="Costo de Envío (S/)"
                type="number"
                min="0"
                step="0.01"
                value={formData.costoEnvio}
                onChange={(e) => setFormData({ ...formData, costoEnvio: parseFloat(e.target.value) || 0 })}
              />
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones
              </label>
              <textarea
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                placeholder="Notas adicionales..."
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 border-b pb-2">
              Resumen
            </h3>

            {/* Resumen de Disponibilidad Multi-Almacén */}
            {lineas.length > 0 && (
              <div className="space-y-2">
                {/* Resumen de origen del stock */}
                {(() => {
                  const totalDesdePeru = lineas.reduce((sum, l) =>
                    sum + Math.min(l.cantidad, l.disponibilidadMultiAlmacen?.stockPeru || 0), 0);
                  const totalDesdeUSA = lineas.reduce((sum, l) => {
                    const dePeru = Math.min(l.cantidad, l.disponibilidadMultiAlmacen?.stockPeru || 0);
                    const restante = l.cantidad - dePeru;
                    return sum + Math.min(restante, l.disponibilidadMultiAlmacen?.stockUSA || 0);
                  }, 0);
                  const totalParaRequerimiento = lineas.reduce((sum, l) => {
                    const stockTotal = l.disponibilidadMultiAlmacen?.stockTotal || l.stockDisponible;
                    return sum + Math.max(0, l.cantidad - stockTotal);
                  }, 0);
                  const tiempoMaxUSA = lineas.reduce((max, l) =>
                    Math.max(max, l.disponibilidadMultiAlmacen?.tiempoEstimadoDias || 0), 0);

                  return (
                    <>
                      {totalDesdePeru > 0 && (
                        <div className="flex items-center gap-2 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                          <MapPin className="h-4 w-4 text-green-600" />
                          <span className="text-green-800">
                            <strong>{totalDesdePeru}</strong> unidades de Perú (inmediato)
                          </span>
                        </div>
                      )}
                      {totalDesdeUSA > 0 && (
                        <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                          <Truck className="h-4 w-4 text-blue-600" />
                          <span className="text-blue-800">
                            <strong>{totalDesdeUSA}</strong> unidades de USA
                            {tiempoMaxUSA > 0 && <span className="text-blue-600 ml-1">(~{tiempoMaxUSA} días)</span>}
                          </span>
                        </div>
                      )}
                      {totalParaRequerimiento > 0 && (
                        <div className="flex items-center gap-2 text-sm bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                          <ShoppingCart className="h-4 w-4 text-orange-600" />
                          <span className="text-orange-800">
                            <strong>{totalParaRequerimiento}</strong> unidades → Requerimiento de compra
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Alerta de productos sin stock (legacy) */}
            {hayProductosSinStock && !lineas.some(l => l.disponibilidadMultiAlmacen) && (
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-warning-800">
                      Productos sin stock disponible
                    </div>
                    <div className="text-xs text-warning-700 mt-1">
                      {productosSinStock.map(p => (
                        <div key={p.productoId}>
                          • {p.marca} {p.nombre}: {p.stockDisponible} disp. / {p.cantidad} solicit.
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-warning-600 mt-2">
                      La cotización se creará pero requerirá conseguir stock antes de confirmar.
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">{formatCurrency(totales.subtotal)}</span>
              </div>
              {totales.descuento > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Descuento:</span>
                  <span className="font-medium text-danger-600">
                    -{formatCurrency(totales.descuento)}
                  </span>
                </div>
              )}
              {totales.envio > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Envío:</span>
                  <span className="font-medium">{formatCurrency(totales.envio)}</span>
                </div>
              )}
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-900">Total:</span>
                  <span className="text-xl font-bold text-primary-600">
                    {formatCurrency(totales.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-500">
            {clienteSeleccionado && historialCliente?.clasificacionABC === 'A' && (
              <span className="inline-flex items-center gap-1 text-green-600">
                <Star className="h-3 w-3" />
                Cliente VIP - Prioridad alta
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || lineas.length === 0}
            >
              {isSubmitting
                ? (modoEdicion ? 'Guardando...' : 'Creando...')
                : (modoEdicion ? 'Guardar Cambios' : 'Crear Cotización')
              }
            </Button>
          </div>
        </div>
      </form>

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
            productosExistentes={productos}
          />
        </Modal>
      )}

      {/* Modal de Éxito con Descarga de PDF */}
      {showSuccessModal && cotizacionCreada && (
        <Modal
          isOpen={showSuccessModal}
          onClose={handleCloseSuccessModal}
          title="Cotización Creada"
          size="md"
        >
          <div className="space-y-6">
            {/* Información de la cotización creada */}
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {cotizacionCreada.numeroCotizacion}
              </h3>
              <p className="text-gray-600">
                Cotización creada exitosamente para <strong>{cotizacionCreada.nombreCliente}</strong>
              </p>
              <p className="text-2xl font-bold text-primary-600 mt-3">
                {formatCurrency(cotizacionCreada.totalPEN)}
              </p>
            </div>

            {/* Próximos pasos */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Próximos pasos:</strong> Si el cliente acepta, valida la cotización en el Kanban.
                Si requiere adelanto, usa "Comprometer Adelanto" y luego registra el pago cuando lo reciba.
              </p>
            </div>

            {/* Botones de PDF */}
            <div className="space-y-3">
              <p className="text-sm text-gray-600 text-center">
                Descarga o visualiza el PDF de la cotización para enviar a tu cliente:
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="primary"
                  onClick={handleDescargarPdf}
                  disabled={generandoPdf || !empresa}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {generandoPdf ? 'Generando...' : 'Descargar PDF'}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleAbrirPdf}
                  disabled={generandoPdf || !empresa}
                  className="flex-1"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Ver PDF
                </Button>
              </div>

              {!empresa && (
                <p className="text-xs text-amber-600 text-center">
                  Configura la información de tu empresa en Configuración para habilitar PDFs
                </p>
              )}
            </div>

            {/* Botón de cerrar */}
            <div className="pt-4 border-t">
              <Button
                variant="ghost"
                onClick={handleCloseSuccessModal}
                className="w-full"
              >
                Cerrar y volver a Cotizaciones
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
};
