import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  PlusCircle,
  ClipboardList,
  Package,
  Check,
  Clock,
  XCircle,
  Link2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  History,
  Search,
  ShoppingCart,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Eye,
  FileText,
  Zap,
  BarChart3,
  Users,
  Building2,
  Lightbulb,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Target,
  Truck,
  UserCheck
} from 'lucide-react';
import { Button, Card, Modal, Badge } from '../../components/common';
import { ProductoForm } from '../../components/modules/productos/ProductoForm';
import { AsignacionResponsableForm } from '../../components/modules/requerimiento/AsignacionResponsableForm';
import { useProductoStore } from '../../store/productoStore';
import type { ProductoFormData } from '../../types/producto.types';
import { ExpectativaService } from '../../services/expectativa.service';
import { ProductoService } from '../../services/producto.service';
import { OrdenCompraService } from '../../services/ordenCompra.service';
import { VentaService } from '../../services/venta.service';
import { inventarioService } from '../../services/inventario.service';
import { tipoCambioService } from '../../services/tipoCambio.service';
import { useAuthStore } from '../../store/authStore';
import type {
  Requerimiento,
  RequerimientoFormData,
  EstadoRequerimiento,
  TipoSolicitante
} from '../../types/expectativa.types';
import type { AsignacionResponsable } from '../../types/requerimiento.types';
import type { Producto } from '../../types/producto.types';
import type { Venta } from '../../types/venta.types';

// Tipo para información de investigación de mercado
interface InvestigacionProducto {
  productoId: string;
  precioPromedioUSD: number;
  precioMinimoUSD: number;
  precioMaximoUSD: number;
  ultimoPrecioUSD: number;
  proveedorRecomendado?: {
    id: string;
    nombre: string;
    ultimoPrecioUSD: number;
  };
  historial: Array<{
    proveedorNombre: string;
    costoUnitarioUSD: number;
    fechaCompra: Date;
  }>;
}

// Tipo para sugerencias de stock bajo
interface SugerenciaStock {
  producto: Producto;
  stockActual: number;
  stockMinimo: number;
  demandaPromedio: number;
  diasParaAgotarse: number;
  urgencia: 'critica' | 'alta' | 'media';
  precioEstimadoUSD?: number;
  proveedorSugerido?: string;
}

// Columnas del Kanban
const KANBAN_COLUMNS: { id: EstadoRequerimiento; label: string; color: string; icon: React.ReactNode }[] = [
  { id: 'pendiente', label: 'Pendientes', color: 'bg-yellow-500', icon: <Clock className="h-4 w-4" /> },
  { id: 'aprobado', label: 'Aprobados', color: 'bg-blue-500', icon: <Check className="h-4 w-4" /> },
  { id: 'en_proceso', label: 'En Proceso', color: 'bg-purple-500', icon: <Link2 className="h-4 w-4" /> },
  { id: 'completado', label: 'Completados', color: 'bg-green-500', icon: <Check className="h-4 w-4" /> }
];

export const Requerimientos: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { productos: productosStore, createProducto, fetchProductos } = useProductoStore();

  // TC del día
  const [tcDelDia, setTcDelDia] = useState<{ venta: number; compra: number } | null>(null);

  // Estados principales
  const [loading, setLoading] = useState(true);
  const [requerimientos, setRequerimientos] = useState<Requerimiento[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cotizacionesConfirmadas, setCotizacionesConfirmadas] = useState<Venta[]>([]);
  const [sugerenciasStock, setSugerenciasStock] = useState<SugerenciaStock[]>([]);

  // Vista
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [showIntelligencePanel, setShowIntelligencePanel] = useState(true);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isFromCotizacionModalOpen, setIsFromCotizacionModalOpen] = useState(false);
  const [isSugerenciasModalOpen, setIsSugerenciasModalOpen] = useState(false);
  const [selectedRequerimiento, setSelectedRequerimiento] = useState<Requerimiento | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de crear producto
  const [showProductoModal, setShowProductoModal] = useState(false);
  const [isCreatingProducto, setIsCreatingProducto] = useState(false);

  // Modal de asignar responsable
  const [isAsignacionModalOpen, setIsAsignacionModalOpen] = useState(false);

  // Form
  const [formData, setFormData] = useState<Partial<RequerimientoFormData>>({
    origen: 'manual',
    prioridad: 'media',
    tipoSolicitante: 'administracion',
    productos: []
  });

  // Producto temporal para agregar
  const [productoTemp, setProductoTemp] = useState({
    productoId: '',
    cantidadSolicitada: 1,
    precioEstimadoUSD: 0,
    proveedorSugerido: '',
    urlReferencia: ''
  });

  // Información de investigación de mercado
  const [investigacionMercado, setInvestigacionMercado] = useState<Map<string, InvestigacionProducto>>(new Map());
  const [loadingInvestigacion, setLoadingInvestigacion] = useState(false);
  const [showHistorial, setShowHistorial] = useState<string | null>(null);

  // Expandir/contraer secciones
  const [expandedSections, setExpandedSections] = useState({
    alertas: true,
    sugerencias: true,
    cotizaciones: true
  });

  useEffect(() => {
    loadData();
    loadTCDelDia();
  }, []);

  const loadTCDelDia = async () => {
    try {
      const tc = await tipoCambioService.getTCDelDia();
      if (tc) {
        setTcDelDia({ venta: tc.venta, compra: tc.compra });
      }
    } catch (error) {
      console.error('Error al cargar TC del día:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqs, prods, ventas] = await Promise.all([
        ExpectativaService.getRequerimientos(),
        ProductoService.getAll(),
        VentaService.getAll()
      ]);
      setRequerimientos(reqs);
      setProductos(prods);

      // Filtrar cotizaciones confirmadas que requieren stock
      const cotizacionesConFaltante = ventas.filter(
        v => v.estado === 'confirmada' && v.requiereStock === true
      );
      setCotizacionesConfirmadas(cotizacionesConFaltante);

      // Cargar sugerencias de stock bajo
      await loadSugerenciasStock(prods);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar sugerencias basadas en stock bajo
  const loadSugerenciasStock = async (prods: Producto[]) => {
    try {
      const sugerencias: SugerenciaStock[] = [];

      // Obtener inventario agregado y demanda histórica
      const [inventarioAgregado, demandaHistorica] = await Promise.all([
        inventarioService.getInventarioAgregado(),
        VentaService.getDemandaPromedioPorProducto(30) // Últimos 30 días
      ]);
      const inventarioMap = new Map(inventarioAgregado.map(inv => [inv.productoId, inv]));

      for (const producto of prods) {
        // Verificar si está activo
        if (producto.estado !== 'activo') continue;

        // Obtener stock actual del producto desde inventario agregado
        const inventario = inventarioMap.get(producto.id);
        const stockActual = inventario?.disponibles || 0;
        const stockMinimo = producto.stockMinimo || 5;

        if (stockActual <= stockMinimo) {
          // Calcular demanda promedio basándose en ventas históricas
          const demandaPromedio = demandaHistorica.get(producto.id) || 1; // Mínimo 1 por día si no hay datos
          const diasParaAgotarse = demandaPromedio > 0
            ? Math.floor(stockActual / demandaPromedio)
            : stockActual > 0 ? 30 : 0; // Si no hay demanda, asumir 30 días

          // Determinar urgencia
          let urgencia: 'critica' | 'alta' | 'media' = 'media';
          if (stockActual === 0) urgencia = 'critica';
          else if (diasParaAgotarse <= 3) urgencia = 'alta';

          // Obtener precio histórico si existe
          const investigacion = await OrdenCompraService.getInvestigacionMercado([producto.id]);
          const info = investigacion.get(producto.id);

          sugerencias.push({
            producto,
            stockActual,
            stockMinimo,
            demandaPromedio,
            diasParaAgotarse,
            urgencia,
            precioEstimadoUSD: info?.proveedorRecomendado?.ultimoPrecioUSD || info?.ultimoPrecioUSD,
            proveedorSugerido: info?.proveedorRecomendado?.nombre
          });
        }
      }

      // Ordenar por urgencia
      sugerencias.sort((a, b) => {
        const orden = { critica: 0, alta: 1, media: 2 };
        return orden[a.urgencia] - orden[b.urgencia];
      });

      setSugerenciasStock(sugerencias.slice(0, 10)); // Top 10
    } catch (error) {
      console.error('Error al cargar sugerencias:', error);
    }
  };

  // Agrupar requerimientos por estado para Kanban
  const requerimientosPorEstado = useMemo(() => {
    const grouped: Record<EstadoRequerimiento, Requerimiento[]> = {
      borrador: [],
      pendiente: [],
      aprobado: [],
      en_proceso: [],
      completado: [],
      cancelado: []
    };

    requerimientos.forEach(req => {
      if (grouped[req.estado]) {
        grouped[req.estado].push(req);
      }
    });

    return grouped;
  }, [requerimientos]);

  // Cargar investigación de mercado cuando se selecciona un producto
  const handleProductoChange = async (productoId: string) => {
    setProductoTemp({ ...productoTemp, productoId });

    if (!productoId) return;

    // Verificar si ya tenemos la información
    if (investigacionMercado.has(productoId)) {
      const info = investigacionMercado.get(productoId)!;
      if (info.proveedorRecomendado) {
        setProductoTemp(prev => ({
          ...prev,
          productoId,
          precioEstimadoUSD: info.proveedorRecomendado!.ultimoPrecioUSD,
          proveedorSugerido: info.proveedorRecomendado!.nombre
        }));
      }
      return;
    }

    // Cargar información de mercado
    setLoadingInvestigacion(true);
    try {
      const resultado = await OrdenCompraService.getInvestigacionMercado([productoId]);
      const info = resultado.get(productoId);

      if (info) {
        setInvestigacionMercado(prev => new Map(prev).set(productoId, info));

        if (info.proveedorRecomendado) {
          setProductoTemp(prev => ({
            ...prev,
            precioEstimadoUSD: info.proveedorRecomendado!.ultimoPrecioUSD,
            proveedorSugerido: info.proveedorRecomendado!.nombre
          }));
        } else if (info.ultimoPrecioUSD > 0) {
          setProductoTemp(prev => ({
            ...prev,
            precioEstimadoUSD: info.ultimoPrecioUSD
          }));
        }
      }
    } catch (error) {
      console.error('Error al cargar investigación de mercado:', error);
    } finally {
      setLoadingInvestigacion(false);
    }
  };

  const handleAgregarProducto = () => {
    if (!productoTemp.productoId) return;

    const producto = productos.find((p) => p.id === productoTemp.productoId);
    if (!producto) return;

    setFormData({
      ...formData,
      productos: [
        ...(formData.productos || []),
        {
          productoId: productoTemp.productoId,
          cantidadSolicitada: productoTemp.cantidadSolicitada,
          precioEstimadoUSD: productoTemp.precioEstimadoUSD || undefined,
          proveedorSugerido: productoTemp.proveedorSugerido || undefined,
          urlReferencia: productoTemp.urlReferencia || undefined
        }
      ]
    });

    setProductoTemp({
      productoId: '',
      cantidadSolicitada: 1,
      precioEstimadoUSD: 0,
      proveedorSugerido: '',
      urlReferencia: ''
    });
  };

  const handleRemoverProducto = (index: number) => {
    setFormData({
      ...formData,
      productos: formData.productos?.filter((_, i) => i !== index)
    });
  };

  const handleCrearRequerimiento = async () => {
    if (!user || !formData.productos?.length) return;

    setIsSubmitting(true);
    try {
      await ExpectativaService.crearRequerimiento(
        formData as RequerimientoFormData,
        user.uid
      );
      setIsModalOpen(false);
      setFormData({ origen: 'manual', prioridad: 'media', tipoSolicitante: 'administracion', productos: [] });
      loadData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler para crear producto desde el modal interno
  const handleCreateProducto = async (data: ProductoFormData) => {
    if (!user) return;

    setIsCreatingProducto(true);
    try {
      await createProducto(data, user.uid);
      // Refrescar lista de productos
      await fetchProductos();
      loadData(); // Refrescar también los datos locales
      setShowProductoModal(false);
      alert('✅ Producto creado correctamente');
    } catch (error: any) {
      alert(`❌ Error al crear producto: ${error.message}`);
    } finally {
      setIsCreatingProducto(false);
    }
  };

  // Crear requerimiento desde sugerencia de stock
  const handleCrearDesdeSugerencia = async (sugerencia: SugerenciaStock) => {
    const cantidadSugerida = Math.max(sugerencia.stockMinimo * 2, 10); // Al menos el doble del mínimo

    setFormData({
      origen: 'stock_minimo',
      tipoSolicitante: 'administracion',
      prioridad: sugerencia.urgencia === 'critica' ? 'alta' : sugerencia.urgencia === 'alta' ? 'alta' : 'media',
      productos: [{
        productoId: sugerencia.producto.id,
        cantidadSolicitada: cantidadSugerida,
        precioEstimadoUSD: sugerencia.precioEstimadoUSD,
        proveedorSugerido: sugerencia.proveedorSugerido
      }],
      justificacion: `Stock bajo: ${sugerencia.stockActual} unidades disponibles (mínimo: ${sugerencia.stockMinimo})`
    });

    setIsSugerenciasModalOpen(false);
    setIsModalOpen(true);
  };

  // Crear requerimiento desde una cotización confirmada
  const handleCrearDesdeCotizacion = async (venta: Venta) => {
    if (!user) return;

    const productosFaltantes = venta.productosConFaltante || [];
    const productosVenta = venta.productos.filter(p => {
      const faltante = productosFaltantes.find(f => f.nombre.includes(p.nombreComercial));
      return faltante && faltante.solicitados > faltante.disponibles;
    });

    if (productosVenta.length === 0) {
      alert('No hay productos con faltante de stock en esta venta');
      return;
    }

    const productoIds = productosVenta.map(p => p.productoId);
    const investigacion = await OrdenCompraService.getInvestigacionMercado(productoIds);

    const productosRequerimiento = productosVenta.map(p => {
      const faltante = productosFaltantes.find(f => f.nombre.includes(p.nombreComercial));
      const cantidadNecesaria = faltante ? faltante.solicitados - faltante.disponibles : p.cantidad;
      const info = investigacion.get(p.productoId);

      return {
        productoId: p.productoId,
        cantidadSolicitada: cantidadNecesaria,
        precioEstimadoUSD: info?.proveedorRecomendado?.ultimoPrecioUSD || info?.ultimoPrecioUSD,
        proveedorSugerido: info?.proveedorRecomendado?.nombre
      };
    });

    setFormData({
      origen: 'venta_pendiente',
      ventaRelacionadaId: venta.id,
      tipoSolicitante: 'cliente',
      nombreClienteSolicitante: venta.nombreCliente,
      prioridad: 'alta',
      productos: productosRequerimiento,
      justificacion: `Requerimiento generado desde venta ${venta.numeroVenta} - ${venta.nombreCliente}`
    });

    investigacion.forEach((value, key) => {
      setInvestigacionMercado(prev => new Map(prev).set(key, value));
    });

    setIsFromCotizacionModalOpen(false);
    setIsModalOpen(true);
  };

  // Aprobar requerimiento
  const handleAprobar = async (req: Requerimiento) => {
    if (!user) return;
    try {
      await ExpectativaService.actualizarEstado(req.id, 'aprobado', user.uid);
      loadData();
    } catch (error: any) {
      console.error('Error al aprobar:', error);
      alert('Error al aprobar el requerimiento');
    }
  };

  // Navegar a Órdenes de Compra con datos del requerimiento pre-cargados
  const handleGenerarOC = (req: Requerimiento) => {
    // Preparar los productos del requerimiento para el formulario de OC
    const productosParaOC = req.productos.map(prod => ({
      productoId: prod.productoId,
      sku: prod.sku,
      marca: prod.marca,
      nombreComercial: prod.nombreComercial,
      cantidad: prod.cantidadSolicitada,
      precioUnitarioUSD: prod.precioEstimadoUSD || 0,
      proveedorSugerido: prod.proveedorSugerido,
      urlReferencia: prod.urlReferencia
    }));

    // Navegar a /compras con el state que contiene los datos del requerimiento
    navigate('/compras', {
      state: {
        fromRequerimiento: {
          id: req.id,
          numeroRequerimiento: req.numeroRequerimiento,
          productos: productosParaOC,
          tcInvestigacion: req.expectativa.tcInvestigacion,
          prioridad: req.prioridad
        }
      }
    });
  };

  // Badges y formateo
  const getEstadoBadge = (estado: EstadoRequerimiento) => {
    const config: Record<EstadoRequerimiento, { color: string; icon: React.ReactNode }> = {
      borrador: { color: 'bg-gray-100 text-gray-800', icon: <Clock className="h-3 w-3" /> },
      pendiente: { color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-3 w-3" /> },
      aprobado: { color: 'bg-blue-100 text-blue-800', icon: <Check className="h-3 w-3" /> },
      en_proceso: { color: 'bg-purple-100 text-purple-800', icon: <Link2 className="h-3 w-3" /> },
      completado: { color: 'bg-green-100 text-green-800', icon: <Check className="h-3 w-3" /> },
      cancelado: { color: 'bg-red-100 text-red-800', icon: <XCircle className="h-3 w-3" /> }
    };

    const { color, icon } = config[estado];
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {icon}
        <span className="ml-1">{estado.replace('_', ' ')}</span>
      </span>
    );
  };

  const getPrioridadBadge = (prioridad: 'alta' | 'media' | 'baja') => {
    const config = {
      alta: 'bg-red-100 text-red-800 border-red-200',
      media: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      baja: 'bg-gray-100 text-gray-800 border-gray-200'
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config[prioridad]}`}>
        {prioridad === 'alta' && <AlertTriangle className="h-3 w-3 mr-1" />}
        {prioridad}
      </span>
    );
  };

  const getSolicitanteIcon = (tipo: TipoSolicitante) => {
    switch (tipo) {
      case 'cliente': return <Users className="h-4 w-4 text-blue-500" />;
      case 'administracion': return <Building2 className="h-4 w-4 text-gray-500" />;
      case 'ventas': return <Target className="h-4 w-4 text-green-500" />;
      case 'investigacion': return <Lightbulb className="h-4 w-4 text-yellow-500" />;
      default: return null;
    }
  };

  const getSolicitanteLabel = (req: Requerimiento) => {
    if (req.tipoSolicitante === 'cliente' && req.nombreClienteSolicitante) {
      return req.nombreClienteSolicitante;
    }
    switch (req.tipoSolicitante) {
      case 'administracion': return 'Administración';
      case 'ventas': return 'Ventas';
      case 'investigacion': return 'Investigación';
      default: return req.origen?.replace('_', ' ') || '-';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (value: number, currency: 'USD' | 'PEN' = 'USD') => {
    const symbol = currency === 'USD' ? '$' : 'S/';
    return `${symbol} ${value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Badge para estados de asignación
  const getAsignacionEstadoBadge = (estado: string) => {
    const config: Record<string, { variant: 'warning' | 'info' | 'success' | 'default' | 'danger'; label: string }> = {
      pendiente: { variant: 'warning', label: 'Pendiente' },
      comprando: { variant: 'info', label: 'Comprando' },
      comprado: { variant: 'info', label: 'Comprado' },
      en_almacen_usa: { variant: 'info', label: 'En Almacén USA' },
      en_transito: { variant: 'info', label: 'En Tránsito' },
      recibido: { variant: 'success', label: 'Recibido' },
      cancelado: { variant: 'danger', label: 'Cancelado' }
    };
    const { variant, label } = config[estado] || { variant: 'default' as const, label: estado };
    return <Badge variant={variant}>{label}</Badge>;
  };

  // Handler para cuando se crea una asignación
  const handleAsignacionCreada = () => {
    loadData();
    setIsAsignacionModalOpen(false);
  };

  // Estadísticas calculadas
  const stats = useMemo(() => {
    const activos = requerimientos.filter(r => r.estado !== 'cancelado' && r.estado !== 'completado');
    const pendientes = requerimientos.filter(r => r.estado === 'pendiente');
    const aprobados = requerimientos.filter(r => r.estado === 'aprobado');
    const enProceso = requerimientos.filter(r => r.estado === 'en_proceso');

    const costoEstimadoPendiente = [...pendientes, ...aprobados].reduce(
      (sum, r) => sum + (r.expectativa?.costoTotalEstimadoUSD || 0), 0
    );

    const reqUrgentes = activos.filter(r => r.prioridad === 'alta').length;

    return {
      total: requerimientos.length,
      activos: activos.length,
      pendientes: pendientes.length,
      aprobados: aprobados.length,
      enProceso: enProceso.length,
      urgentes: reqUrgentes,
      costoEstimadoPendiente,
      alertasStock: sugerenciasStock.filter(s => s.urgencia === 'critica' || s.urgencia === 'alta').length
    };
  }, [requerimientos, sugerenciasStock]);

  // Info del producto seleccionado para el form
  const infoProductoSeleccionado = productoTemp.productoId
    ? investigacionMercado.get(productoTemp.productoId)
    : null;

  // Renderizar tarjeta de requerimiento para Kanban
  const renderKanbanCard = (req: Requerimiento) => (
    <div
      key={req.id}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => {
        setSelectedRequerimiento(req);
        setIsDetailModalOpen(true);
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <span className="font-semibold text-primary-600 text-sm">{req.numeroRequerimiento}</span>
        {getPrioridadBadge(req.prioridad)}
      </div>

      {/* Solicitante */}
      <div className="flex items-center text-sm text-gray-600 mb-2">
        {getSolicitanteIcon(req.tipoSolicitante)}
        <span className="ml-1.5 truncate">{getSolicitanteLabel(req)}</span>
      </div>

      {/* Productos */}
      <div className="flex items-center text-sm text-gray-500 mb-3">
        <Package className="h-4 w-4 mr-1.5" />
        {req.productos.length} producto(s)
      </div>

      {/* Costo estimado */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-500">Costo Est.</span>
        <span className="font-semibold text-gray-900">
          {formatCurrency(req.expectativa?.costoTotalEstimadoUSD || 0)}
        </span>
      </div>

      {/* Acciones rápidas */}
      {req.estado === 'pendiente' && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              handleAprobar(req);
            }}
          >
            <Check className="h-4 w-4 mr-1" />
            Aprobar
          </Button>
        </div>
      )}

      {req.estado === 'aprobado' && !req.ordenCompraId && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              handleGenerarOC(req);
            }}
          >
            <ShoppingCart className="h-4 w-4 mr-1" />
            Generar OC
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Requerimientos</h1>
          <p className="text-gray-600 mt-1">
            Gestión inteligente de solicitudes de compra
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Toggle de vista */}
          <div className="bg-gray-100 rounded-lg p-1 flex">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'kanban' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Lista
            </button>
          </div>

          <Button
            variant="ghost"
            onClick={() => setShowIntelligencePanel(!showIntelligencePanel)}
          >
            <Zap className={`h-5 w-5 ${showIntelligencePanel ? 'text-yellow-500' : 'text-gray-400'}`} />
          </Button>

          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-5 w-5 mr-2" />
            Nuevo Requerimiento
          </Button>
        </div>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card padding="md" className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-yellow-600 font-medium">Pendientes</div>
              <div className="text-2xl font-bold text-yellow-700">{stats.pendientes}</div>
            </div>
            <Clock className="h-8 w-8 text-yellow-400" />
          </div>
        </Card>

        <Card padding="md" className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-blue-600 font-medium">Aprobados</div>
              <div className="text-2xl font-bold text-blue-700">{stats.aprobados}</div>
            </div>
            <Check className="h-8 w-8 text-blue-400" />
          </div>
        </Card>

        <Card padding="md" className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-purple-600 font-medium">En Proceso</div>
              <div className="text-2xl font-bold text-purple-700">{stats.enProceso}</div>
            </div>
            <Link2 className="h-8 w-8 text-purple-400" />
          </div>
        </Card>

        <Card padding="md" className={`${stats.urgentes > 0 ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-red-600 font-medium">Urgentes</div>
              <div className="text-2xl font-bold text-red-700">{stats.urgentes}</div>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-600 font-medium">Costo Pendiente</div>
              <div className="text-lg font-bold text-gray-900">
                {formatCurrency(stats.costoEstimadoPendiente)}
              </div>
            </div>
            <DollarSign className="h-8 w-8 text-gray-400" />
          </div>
        </Card>

        <Card padding="md" className={`${stats.alertasStock > 0 ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-orange-600 font-medium">Alertas Stock</div>
              <div className="text-2xl font-bold text-orange-700">{stats.alertasStock}</div>
            </div>
            <Package className="h-8 w-8 text-orange-400" />
          </div>
        </Card>
      </div>

      {/* Panel de Inteligencia */}
      {showIntelligencePanel && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Alertas de Stock */}
          <Card padding="none" className="overflow-hidden">
            <div
              className="px-4 py-3 bg-orange-50 border-b border-orange-200 flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedSections(prev => ({ ...prev, alertas: !prev.alertas }))}
            >
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
                <span className="font-semibold text-orange-900">Alertas de Stock</span>
                <span className="ml-2 bg-orange-200 text-orange-800 text-xs px-2 py-0.5 rounded-full">
                  {sugerenciasStock.length}
                </span>
              </div>
              {expandedSections.alertas ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
            {expandedSections.alertas && (
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {sugerenciasStock.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No hay alertas de stock bajo
                  </div>
                ) : (
                  sugerenciasStock.slice(0, 5).map((sug, idx) => (
                    <div key={idx} className="p-3 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center">
                            <span className={`w-2 h-2 rounded-full mr-2 ${
                              sug.urgencia === 'critica' ? 'bg-red-500' :
                              sug.urgencia === 'alta' ? 'bg-orange-500' : 'bg-yellow-500'
                            }`} />
                            <span className="font-medium text-sm truncate">
                              {sug.producto.nombreComercial}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Stock: {sug.stockActual} / Min: {sug.stockMinimo}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCrearDesdeSugerencia(sug)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                {sugerenciasStock.length > 5 && (
                  <button
                    onClick={() => setIsSugerenciasModalOpen(true)}
                    className="w-full p-3 text-center text-sm text-primary-600 hover:bg-primary-50 font-medium"
                  >
                    Ver todas ({sugerenciasStock.length})
                  </button>
                )}
              </div>
            )}
          </Card>

          {/* Cotizaciones Pendientes */}
          <Card padding="none" className="overflow-hidden">
            <div
              className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedSections(prev => ({ ...prev, cotizaciones: !prev.cotizaciones }))}
            >
              <div className="flex items-center">
                <ShoppingCart className="h-5 w-5 text-blue-500 mr-2" />
                <span className="font-semibold text-blue-900">Cotizaciones con Faltante</span>
                <span className="ml-2 bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                  {cotizacionesConfirmadas.length}
                </span>
              </div>
              {expandedSections.cotizaciones ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
            {expandedSections.cotizaciones && (
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {cotizacionesConfirmadas.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No hay cotizaciones pendientes
                  </div>
                ) : (
                  cotizacionesConfirmadas.slice(0, 5).map((venta) => (
                    <div key={venta.id} className="p-3 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {venta.nombreCliente}
                          </div>
                          <div className="text-xs text-gray-500">
                            {venta.numeroVenta} • {venta.productos.length} productos
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCrearDesdeCotizacion(venta)}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                {cotizacionesConfirmadas.length > 5 && (
                  <button
                    onClick={() => setIsFromCotizacionModalOpen(true)}
                    className="w-full p-3 text-center text-sm text-primary-600 hover:bg-primary-50 font-medium"
                  >
                    Ver todas ({cotizacionesConfirmadas.length})
                  </button>
                )}
              </div>
            )}
          </Card>

          {/* Métricas de Precisión */}
          <Card padding="none" className="overflow-hidden">
            <div className="px-4 py-3 bg-green-50 border-b border-green-200 flex items-center">
              <BarChart3 className="h-5 w-5 text-green-500 mr-2" />
              <span className="font-semibold text-green-900">Métricas de Compras</span>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">TC Actual</span>
                  <span className="font-semibold">S/ {tcDelDia?.venta?.toFixed(3) || '3.700'}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Total por aprobar</span>
                  <span className="font-semibold">{formatCurrency(stats.costoEstimadoPendiente)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">En soles (aprox)</span>
                  <span className="font-semibold text-gray-900">
                    S/ {(stats.costoEstimadoPendiente * (tcDelDia?.venta || 3.70)).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="text-xs text-gray-500 mb-2">Ciclo promedio</div>
                <div className="flex items-baseline">
                  <span className="text-2xl font-bold text-gray-900">7</span>
                  <span className="text-sm text-gray-500 ml-1">días</span>
                </div>
                <div className="text-xs text-gray-500">desde requerimiento hasta recepción</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Vista Kanban o Lista */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map(column => (
            <div key={column.id} className="bg-gray-50 rounded-lg p-4">
              {/* Header de columna */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full ${column.color} mr-2`} />
                  <span className="font-semibold text-gray-900">{column.label}</span>
                </div>
                <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
                  {requerimientosPorEstado[column.id]?.length || 0}
                </span>
              </div>

              {/* Tarjetas */}
              <div className="space-y-3 min-h-[200px]">
                {loading ? (
                  <div className="text-center text-gray-500 text-sm py-8">Cargando...</div>
                ) : requerimientosPorEstado[column.id]?.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-8">
                    Sin requerimientos
                  </div>
                ) : (
                  requerimientosPorEstado[column.id]?.map(req => renderKanbanCard(req))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Vista Lista */
        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Requerimientos ({requerimientos.length})
            </h3>
            <Button variant="ghost" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Req</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solicitante</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Productos</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Est. USD</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Prioridad</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">Cargando...</td>
                  </tr>
                ) : requerimientos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">No hay requerimientos registrados</td>
                  </tr>
                ) : (
                  requerimientos.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-primary-600">{req.numeroRequerimiento}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(req.fechaCreacion)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center">
                          {getSolicitanteIcon(req.tipoSolicitante)}
                          <span className="ml-2">{getSolicitanteLabel(req)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex items-center">
                          <Package className="h-4 w-4 text-gray-400 mr-2" />
                          {req.productos.length} producto(s)
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                        {formatCurrency(req.expectativa?.costoTotalEstimadoUSD || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getPrioridadBadge(req.prioridad)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getEstadoBadge(req.estado)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRequerimiento(req);
                              setIsDetailModalOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {req.estado === 'pendiente' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAprobar(req)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal Nuevo Requerimiento - Diseño Inteligente */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title=""
        size="xl"
      >
        <div className="space-y-6">
          {/* Header con contexto */}
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <ClipboardList className="h-6 w-6 mr-2 text-primary-600" />
                Nuevo Requerimiento de Compra
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {tcDelDia && `TC del día: S/ ${tcDelDia.venta.toFixed(3)}`}
              </p>
            </div>
            {/* Prioridad visual */}
            <div className="flex space-x-2">
              {(['baja', 'media', 'alta'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setFormData({ ...formData, prioridad: p })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    formData.prioridad === p
                      ? p === 'alta' ? 'bg-red-500 text-white shadow-md'
                      : p === 'media' ? 'bg-yellow-500 text-white shadow-md'
                      : 'bg-gray-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p === 'alta' && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Solicitante - Cards visuales */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">¿Quién solicita este requerimiento?</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { id: 'administracion', label: 'Administración', sublabel: 'Mantener stock', icon: <Building2 className="h-5 w-5" />, color: 'gray' },
                { id: 'ventas', label: 'Ventas', sublabel: 'Equipo comercial', icon: <Target className="h-5 w-5" />, color: 'green' },
                { id: 'cliente', label: 'Cliente', sublabel: 'Pedido específico', icon: <Users className="h-5 w-5" />, color: 'blue' },
                { id: 'investigacion', label: 'Investigación', sublabel: 'Producto nuevo', icon: <Lightbulb className="h-5 w-5" />, color: 'yellow' }
              ].map((tipo) => (
                <button
                  key={tipo.id}
                  onClick={() => setFormData({
                    ...formData,
                    tipoSolicitante: tipo.id as TipoSolicitante,
                    nombreClienteSolicitante: tipo.id !== 'cliente' ? undefined : formData.nombreClienteSolicitante
                  })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.tipoSolicitante === tipo.id
                      ? `border-${tipo.color}-500 bg-${tipo.color}-50 shadow-md`
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`${formData.tipoSolicitante === tipo.id ? `text-${tipo.color}-600` : 'text-gray-400'}`}>
                    {tipo.icon}
                  </div>
                  <div className="mt-2 font-medium text-gray-900">{tipo.label}</div>
                  <div className="text-xs text-gray-500">{tipo.sublabel}</div>
                </button>
              ))}
            </div>
            {/* Campo de cliente si es necesario */}
            {formData.tipoSolicitante === 'cliente' && (
              <div className="mt-3">
                <input
                  type="text"
                  value={formData.nombreClienteSolicitante || ''}
                  onChange={(e) => setFormData({ ...formData, nombreClienteSolicitante: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-blue-200 focus:border-blue-500 focus:ring-0 bg-blue-50"
                  placeholder="Nombre del cliente..."
                />
              </div>
            )}
          </div>

          {/* Buscador de productos inteligente */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900 flex items-center">
                <Package className="h-5 w-5 mr-2 text-primary-600" />
                Agregar Productos
              </h4>
              <div className="flex items-center gap-2">
                {formData.productos && formData.productos.length > 0 && (
                  <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-medium">
                    {formData.productos.length} agregado(s)
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowProductoModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                >
                  <PlusCircle className="h-4 w-4" />
                  Crear Producto
                </button>
              </div>
            </div>

            {/* Búsqueda de producto */}
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select
                value={productoTemp.productoId}
                onChange={(e) => handleProductoChange(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:ring-0 text-gray-900 bg-white appearance-none cursor-pointer"
              >
                <option value="">Buscar y seleccionar producto...</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} - {p.marca} {p.nombreComercial}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>

            {/* Producto seleccionado - Vista expandida */}
            {productoTemp.productoId && (
              <div className="bg-white rounded-xl border-2 border-primary-200 overflow-hidden">
                {/* Info del producto */}
                {(() => {
                  const selectedProd = productos.find(p => p.id === productoTemp.productoId);
                  return selectedProd ? (
                    <div className="p-4 bg-primary-50 border-b border-primary-100">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-medium text-primary-600 bg-primary-100 px-2 py-0.5 rounded">
                            {selectedProd.sku}
                          </span>
                          <h5 className="font-semibold text-gray-900 mt-1">
                            {selectedProd.marca} {selectedProd.nombreComercial}
                          </h5>
                          <p className="text-sm text-gray-500">
                            {selectedProd.presentacion} • {selectedProd.contenido}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Stock actual</div>
                          <div className={`text-lg font-bold ${(selectedProd.stockDisponible || 0) <= (selectedProd.stockMinimo || 5) ? 'text-red-600' : 'text-green-600'}`}>
                            {selectedProd.stockDisponible || 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Investigación de mercado - Visual mejorada */}
                {loadingInvestigacion ? (
                  <div className="p-4 flex items-center justify-center text-primary-600">
                    <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                    Analizando historial de precios...
                  </div>
                ) : infoProductoSeleccionado && infoProductoSeleccionado.historial.length > 0 ? (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700 flex items-center">
                        <TrendingUp className="h-4 w-4 mr-1 text-green-500" />
                        Análisis de Mercado
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowHistorial(showHistorial ? null : productoTemp.productoId)}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        {showHistorial ? 'Ocultar detalle' : 'Ver historial'}
                      </button>
                    </div>

                    {/* Métricas de precio */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <div className="text-xs text-gray-500">Último</div>
                        <div className="font-bold text-gray-900">${infoProductoSeleccionado.ultimoPrecioUSD.toFixed(2)}</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2 text-center">
                        <div className="text-xs text-green-600">Mínimo</div>
                        <div className="font-bold text-green-700">${infoProductoSeleccionado.precioMinimoUSD.toFixed(2)}</div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2 text-center">
                        <div className="text-xs text-blue-600">Promedio</div>
                        <div className="font-bold text-blue-700">${infoProductoSeleccionado.precioPromedioUSD.toFixed(2)}</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-2 text-center">
                        <div className="text-xs text-red-600">Máximo</div>
                        <div className="font-bold text-red-700">${infoProductoSeleccionado.precioMaximoUSD.toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Proveedor recomendado */}
                    {infoProductoSeleccionado.proveedorRecomendado && (
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Check className="h-5 w-5 text-green-500 mr-2" />
                            <div>
                              <div className="text-xs text-green-600">Proveedor recomendado</div>
                              <div className="font-semibold text-green-800">
                                {infoProductoSeleccionado.proveedorRecomendado.nombre}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-700">
                              ${infoProductoSeleccionado.proveedorRecomendado.ultimoPrecioUSD.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Historial expandido */}
                    {showHistorial === productoTemp.productoId && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-xs font-medium text-gray-500 mb-2">Historial de compras</div>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {infoProductoSeleccionado.historial.map((h, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                              <span className="text-gray-700">{h.proveedorNombre}</span>
                              <span className="font-medium text-gray-900">${h.costoUnitarioUSD.toFixed(2)}</span>
                              <span className="text-gray-500 text-xs">{h.fechaCompra.toLocaleDateString('es-PE')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : productoTemp.productoId && !loadingInvestigacion ? (
                  <div className="p-4 bg-amber-50 border-t border-amber-100">
                    <div className="flex items-center text-amber-700">
                      <AlertCircle className="h-5 w-5 mr-2" />
                      <span className="text-sm">Producto nuevo - Sin historial de compras</span>
                    </div>
                  </div>
                ) : null}

                {/* Campos de entrada */}
                <div className="p-4 border-t bg-gray-50">
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        value={productoTemp.cantidadSolicitada}
                        onChange={(e) => setProductoTemp({ ...productoTemp, cantidadSolicitada: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-0 text-center font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Precio USD
                        {infoProductoSeleccionado?.proveedorRecomendado && (
                          <span className="text-green-600 ml-1">(sugerido)</span>
                        )}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={productoTemp.precioEstimadoUSD || ''}
                          onChange={(e) => setProductoTemp({ ...productoTemp, precioEstimadoUSD: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-0"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor</label>
                      <input
                        type="text"
                        value={productoTemp.proveedorSugerido}
                        onChange={(e) => setProductoTemp({ ...productoTemp, proveedorSugerido: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-0"
                        placeholder="Amazon, iHerb..."
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="primary"
                        onClick={handleAgregarProducto}
                        disabled={!productoTemp.productoId}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar
                      </Button>
                    </div>
                  </div>

                  {/* URL opcional */}
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">URL de referencia (opcional)</label>
                    <input
                      type="text"
                      value={productoTemp.urlReferencia}
                      onChange={(e) => setProductoTemp({ ...productoTemp, urlReferencia: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-0 text-sm"
                      placeholder="https://www.amazon.com/..."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Lista de productos agregados - Diseño mejorado */}
          {formData.productos && formData.productos.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">
                  Productos en este requerimiento
                </h4>
                <div className="text-sm text-gray-500">
                  Total estimado: <span className="font-bold text-gray-900">
                    ${formData.productos.reduce((sum, p) => sum + (p.precioEstimadoUSD || 0) * p.cantidadSolicitada, 0).toFixed(2)}
                  </span>
                  {tcDelDia && (
                    <span className="text-gray-400 ml-2">
                      (S/ {(formData.productos.reduce((sum, p) => sum + (p.precioEstimadoUSD || 0) * p.cantidadSolicitada, 0) * tcDelDia.venta).toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {formData.productos.map((prod, index) => {
                  const producto = productos.find((p) => p.id === prod.productoId);
                  const subtotal = (prod.precioEstimadoUSD || 0) * prod.cantidadSolicitada;
                  return (
                    <div key={index} className="flex items-center justify-between bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-center space-x-4">
                        <div className="bg-primary-100 text-primary-700 w-10 h-10 rounded-lg flex items-center justify-center font-bold">
                          {prod.cantidadSolicitada}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {producto?.marca} {producto?.nombreComercial}
                          </div>
                          <div className="text-sm text-gray-500">
                            {producto?.sku}
                            {prod.proveedorSugerido && ` • ${prod.proveedorSugerido}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">${subtotal.toFixed(2)}</div>
                          {prod.precioEstimadoUSD && (
                            <div className="text-xs text-gray-500">${prod.precioEstimadoUSD} c/u</div>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoverProducto(index)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Justificación con sugerencias */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Justificación
              <span className="text-gray-400 font-normal ml-1">(opcional)</span>
            </label>
            <textarea
              value={formData.justificacion || ''}
              onChange={(e) => setFormData({ ...formData, justificacion: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:ring-0 resize-none"
              placeholder="Ej: Reponer stock agotado, cliente urgente, precio especial encontrado..."
            />
          </div>

          {/* Footer con acciones y resumen */}
          <div className="flex items-center justify-between pt-4 border-t bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-xl">
            <div className="text-sm text-gray-500">
              {formData.productos && formData.productos.length > 0 ? (
                <span>
                  <strong className="text-gray-900">{formData.productos.length}</strong> producto(s) •
                  <strong className="text-gray-900 ml-1">
                    ${formData.productos.reduce((sum, p) => sum + (p.precioEstimadoUSD || 0) * p.cantidadSolicitada, 0).toFixed(2)} USD
                  </strong>
                </span>
              ) : (
                <span className="text-amber-600">Agrega al menos un producto</span>
              )}
            </div>
            <div className="flex space-x-3">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleCrearRequerimiento}
                disabled={isSubmitting || !formData.productos?.length}
                className="px-6"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Crear Requerimiento
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Sugerencias de Stock */}
      <Modal
        isOpen={isSugerenciasModalOpen}
        onClose={() => setIsSugerenciasModalOpen(false)}
        title="Productos con Stock Bajo"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Estos productos están por debajo del stock mínimo. Crea requerimientos para reabastecer.
          </p>

          <div className="divide-y border rounded-lg max-h-96 overflow-y-auto">
            {sugerenciasStock.map((sug, idx) => (
              <div key={idx} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className={`w-3 h-3 rounded-full mr-2 ${
                        sug.urgencia === 'critica' ? 'bg-red-500' :
                        sug.urgencia === 'alta' ? 'bg-orange-500' : 'bg-yellow-500'
                      }`} />
                      <span className="font-medium">{sug.producto.sku}</span>
                      <span className="mx-2 text-gray-400">-</span>
                      <span>{sug.producto.marca} {sug.producto.nombreComercial}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Stock actual:</span>
                        <span className={`ml-1 font-medium ${sug.stockActual === 0 ? 'text-red-600' : ''}`}>
                          {sug.stockActual}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Stock mínimo:</span>
                        <span className="ml-1 font-medium">{sug.stockMinimo}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Días para agotarse:</span>
                        <span className={`ml-1 font-medium ${sug.diasParaAgotarse <= 3 ? 'text-red-600' : ''}`}>
                          {sug.diasParaAgotarse}
                        </span>
                      </div>
                    </div>
                    {sug.precioEstimadoUSD && (
                      <div className="mt-1 text-sm text-gray-500">
                        Precio estimado: ${sug.precioEstimadoUSD.toFixed(2)}
                        {sug.proveedorSugerido && ` (${sug.proveedorSugerido})`}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleCrearDesdeSugerencia(sug)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Crear
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="ghost" onClick={() => setIsSugerenciasModalOpen(false)}>Cerrar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal Seleccionar Cotización */}
      <Modal
        isOpen={isFromCotizacionModalOpen}
        onClose={() => setIsFromCotizacionModalOpen(false)}
        title="Generar Requerimiento desde Cotización"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Selecciona una cotización confirmada para generar automáticamente un requerimiento de compra con los productos faltantes.
          </p>

          {cotizacionesConfirmadas.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay cotizaciones confirmadas con faltante de stock
            </div>
          ) : (
            <div className="divide-y border rounded-lg max-h-96 overflow-y-auto">
              {cotizacionesConfirmadas.map((venta) => (
                <div key={venta.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {venta.numeroVenta} - {venta.nombreCliente}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Total: S/ {venta.totalPEN.toFixed(2)} | {venta.productos.length} productos
                      </div>
                      {venta.productosConFaltante && venta.productosConFaltante.length > 0 && (
                        <div className="text-sm text-amber-600 mt-1">
                          Faltantes: {venta.productosConFaltante.map(p => p.nombre).join(', ')}
                        </div>
                      )}
                    </div>
                    <Button variant="primary" size="sm" onClick={() => handleCrearDesdeCotizacion(venta)}>
                      Generar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t">
            <Button variant="ghost" onClick={() => setIsFromCotizacionModalOpen(false)}>Cerrar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal Detalle */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Requerimiento ${selectedRequerimiento?.numeroRequerimiento || ''}`}
        size="lg"
      >
        {selectedRequerimiento && (
          <div className="space-y-6">
            {/* Info general */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Estado</label>
                <div className="mt-1">{getEstadoBadge(selectedRequerimiento.estado)}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Prioridad</label>
                <div className="mt-1">{getPrioridadBadge(selectedRequerimiento.prioridad)}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Origen</label>
                <div className="mt-1 font-medium">{selectedRequerimiento.origen.replace('_', ' ')}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Fecha</label>
                <div className="mt-1 font-medium">{formatDate(selectedRequerimiento.fechaCreacion)}</div>
              </div>
            </div>

            {/* Solicitante */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="text-sm text-gray-500">Solicitado por</label>
              <div className="mt-1 font-medium text-gray-900 flex items-center">
                {getSolicitanteIcon(selectedRequerimiento.tipoSolicitante)}
                <span className="ml-2">
                  {selectedRequerimiento.tipoSolicitante === 'cliente' && selectedRequerimiento.nombreClienteSolicitante
                    ? `Cliente: ${selectedRequerimiento.nombreClienteSolicitante}`
                    : selectedRequerimiento.tipoSolicitante === 'administracion' ? 'Administración (Stock)'
                    : selectedRequerimiento.tipoSolicitante === 'ventas' ? 'Equipo de Ventas'
                    : selectedRequerimiento.tipoSolicitante === 'investigacion' ? 'Investigación de Mercado'
                    : '-'}
                </span>
              </div>
            </div>

            {/* Expectativa financiera */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Expectativa Financiera
              </h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <label className="text-blue-600">TC Investigación</label>
                  <div className="font-bold text-blue-900">
                    S/ {selectedRequerimiento.expectativa?.tcInvestigacion?.toFixed(3) || '-'}
                  </div>
                </div>
                <div>
                  <label className="text-blue-600">Costo Est. USD</label>
                  <div className="font-bold text-blue-900">
                    {formatCurrency(selectedRequerimiento.expectativa?.costoTotalEstimadoUSD || 0)}
                  </div>
                </div>
                <div>
                  <label className="text-blue-600">Costo Est. PEN</label>
                  <div className="font-bold text-blue-900">
                    {formatCurrency(selectedRequerimiento.expectativa?.costoTotalEstimadoPEN || 0, 'PEN')}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                <div>
                  <label className="text-blue-600">Impuesto Est.</label>
                  <div className="font-medium text-blue-900">
                    {formatCurrency(selectedRequerimiento.expectativa?.impuestoEstimadoUSD || 0)}
                  </div>
                </div>
                <div>
                  <label className="text-blue-600">Flete Est.</label>
                  <div className="font-medium text-blue-900">
                    {formatCurrency(selectedRequerimiento.expectativa?.fleteEstimadoUSD || 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* Productos */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Productos ({selectedRequerimiento.productos.length})</h4>
              <div className="border rounded-lg divide-y">
                {selectedRequerimiento.productos.map((prod, index) => (
                  <div key={index} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {prod.sku} - {prod.marca} {prod.nombreComercial}
                        </div>
                        <div className="text-sm text-gray-500">Cantidad: {prod.cantidadSolicitada}</div>
                      </div>
                      {prod.precioEstimadoUSD && (
                        <div className="text-right">
                          <div className="font-medium text-gray-900">{formatCurrency(prod.precioEstimadoUSD)}</div>
                          <div className="text-xs text-gray-500">
                            Total: {formatCurrency(prod.precioEstimadoUSD * prod.cantidadSolicitada)}
                          </div>
                        </div>
                      )}
                    </div>
                    {(prod.proveedorSugerido || prod.urlReferencia) && (
                      <div className="mt-2 text-sm text-gray-500">
                        {prod.proveedorSugerido && <span className="mr-4">Proveedor: {prod.proveedorSugerido}</span>}
                        {prod.urlReferencia && (
                          <a
                            href={prod.urlReferencia}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:underline inline-flex items-center"
                          >
                            Ver referencia
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Asignaciones de Responsables/Viajeros */}
            {(selectedRequerimiento as any).asignaciones && (selectedRequerimiento as any).asignaciones.length > 0 && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-900 mb-3 flex items-center">
                  <Truck className="h-5 w-5 mr-2" />
                  Responsables Asignados ({(selectedRequerimiento as any).asignaciones.length})
                </h4>
                <div className="space-y-3">
                  {(selectedRequerimiento as any).asignaciones.map((asig: AsignacionResponsable, idx: number) => (
                    <div key={asig.id || idx} className="bg-white rounded-lg p-3 border border-green-100">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-green-600" />
                            <span className="font-semibold text-gray-900">
                              {asig.responsableNombre}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({asig.responsableCodigo})
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-gray-600">
                            {asig.productos?.length || 0} producto(s) •
                            {asig.productos?.reduce((sum, p) => sum + p.cantidadAsignada, 0) || 0} unidades
                          </div>
                          {asig.fechaEstimadaLlegada && (
                            <div className="text-xs text-gray-500 mt-1">
                              Llegada estimada: {formatDate(asig.fechaEstimadaLlegada)}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          {getAsignacionEstadoBadge(asig.estado)}
                          {asig.costoEstimadoUSD && (
                            <div className="text-sm font-medium text-gray-700 mt-1">
                              {formatCurrency(asig.costoEstimadoUSD)}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Detalle de productos asignados */}
                      {asig.productos && asig.productos.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-green-100">
                          <div className="text-xs text-gray-500 mb-1">Productos asignados:</div>
                          <div className="flex flex-wrap gap-2">
                            {asig.productos.map((prod, pIdx) => (
                              <span
                                key={pIdx}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800"
                              >
                                {prod.sku}: {prod.cantidadAsignada} ud
                                {prod.cantidadRecibida > 0 && (
                                  <span className="ml-1 text-green-600">
                                    ({prod.cantidadRecibida} recibidas)
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resumen de cantidades pendientes */}
            {selectedRequerimiento.productos.some(p => (p as any).cantidadPendiente > 0) && (
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h4 className="font-medium text-yellow-900 mb-2 flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Cantidades Pendientes de Asignar
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedRequerimiento.productos.filter(p => (p as any).cantidadPendiente > 0).map((prod, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-medium">{prod.sku}:</span>
                      <span className="text-yellow-800 ml-1">
                        {(prod as any).cantidadPendiente || prod.cantidadSolicitada} pendientes
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OC vinculada */}
            {selectedRequerimiento.ordenCompraId && (
              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-medium text-purple-900 flex items-center">
                  <Link2 className="h-5 w-5 mr-2" />
                  Orden de Compra Vinculada
                </h4>
                <div className="mt-2 font-bold text-purple-900">{selectedRequerimiento.ordenCompraNumero}</div>
              </div>
            )}

            {/* Justificación */}
            {selectedRequerimiento.justificacion && (
              <div>
                <label className="text-sm text-gray-500">Justificación</label>
                <div className="mt-1 text-gray-900">{selectedRequerimiento.justificacion}</div>
              </div>
            )}

            {/* Acciones según estado */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button variant="ghost" onClick={() => setIsDetailModalOpen(false)}>Cerrar</Button>

              {/* Botón para asignar responsable (disponible cuando está aprobado o en proceso) */}
              {(selectedRequerimiento.estado === 'aprobado' || selectedRequerimiento.estado === 'en_proceso') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAsignacionModalOpen(true);
                  }}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Asignar Viajero
                </Button>
              )}

              {selectedRequerimiento.estado === 'pendiente' && (
                <Button variant="primary" onClick={() => {
                  handleAprobar(selectedRequerimiento);
                  setIsDetailModalOpen(false);
                }}>
                  <Check className="h-4 w-4 mr-2" />
                  Aprobar
                </Button>
              )}
              {selectedRequerimiento.estado === 'aprobado' && !selectedRequerimiento.ordenCompraId && (
                <Button variant="primary" onClick={() => {
                  handleGenerarOC(selectedRequerimiento);
                }}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Generar OC
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

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

      {/* Modal de Asignar Responsable/Viajero */}
      {selectedRequerimiento && user && (
        <AsignacionResponsableForm
          requerimiento={selectedRequerimiento as any}
          isOpen={isAsignacionModalOpen}
          onClose={() => setIsAsignacionModalOpen(false)}
          onAsignacionCreada={handleAsignacionCreada}
          userId={user.uid}
        />
      )}
    </div>
  );
};
