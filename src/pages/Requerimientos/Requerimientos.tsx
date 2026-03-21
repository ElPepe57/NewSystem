import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Zap,
  RefreshCw,
  AlertCircle,
  Layers,
  CheckSquare
} from 'lucide-react';
import { Button, ConfirmDialog, Modal, useConfirmDialog } from '../../components/common';
import { ProductoForm } from '../../components/modules/productos/ProductoForm';
import { AsignacionResponsableForm } from '../../components/modules/requerimiento/AsignacionResponsableForm';
import { VincularOCModal } from '../../components/modules/requerimiento/VincularOCModal';
import { OCBuilder, PendientesCompraPanel } from '../../components/modules/ordenCompra';
import type { ProductoRequerimientoSnapshot } from '../../components/modules/entidades/ProductoSearchRequerimientos';
import { useProductoStore } from '../../store/productoStore';
import { useExpectativaStore } from '../../store/expectativaStore';
import type { ProductoFormData } from '../../types/producto.types';
import { ProductoService } from '../../services/producto.service';
import { OrdenCompraService } from '../../services/ordenCompra.service';
import { VentaService } from '../../services/venta.service';
import { inventarioService } from '../../services/inventario.service';
import { tipoCambioService } from '../../services/tipoCambio.service';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import type {
  Requerimiento,
  RequerimientoFormData,
  EstadoRequerimiento
} from '../../types/expectativa.types';
import type { Producto } from '../../types/producto.types';
import type { Venta } from '../../types/venta.types';

// Sub-components
import { RequerimientosKPIGrid } from './RequerimientosKPIGrid';
import { IntelligencePanel } from './IntelligencePanel';
import { KanbanBoard } from './KanbanBoard';
import { RequerimientosListView } from './RequerimientosListView';
import { RequerimientoFormModal } from './RequerimientoFormModal';
import { RequerimientoDetailModal } from './RequerimientoDetailModal';
import { SugerenciasStockModal } from './SugerenciasStockModal';
import { CotizacionesFaltanteModal } from './CotizacionesFaltanteModal';
import { SelectionFloatingBar } from './SelectionFloatingBar';
import type { InvestigacionProducto, SugerenciaStock } from './requerimientos.types';

export const Requerimientos: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const toast = useToastStore();
  const { productos: productosStore, createProducto, fetchProductos } = useProductoStore();
  const {
    requerimientos,
    loading: loadingReqs,
    fetchRequerimientos,
    actualizarEstado: storeActualizarEstado,
    limpiarDatosVinculacion: storeLimpiarDatos
  } = useExpectativaStore();

  // Filtrar requerimientos por linea de negocio global
  const requerimientosLN = useLineaFilter(requerimientos, r => r.lineaNegocioId);

  // TC del dia
  const [tcDelDia, setTcDelDia] = useState<{ venta: number; compra: number } | null>(null);

  // Estados principales
  const [loadingLocal, setLoadingLocal] = useState(true);
  const loading = loadingReqs || loadingLocal;
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

  // Modal vincular OC retroactiva
  const [isVincularOCModalOpen, setIsVincularOCModalOpen] = useState(false);
  const [ventaParaVincular, setVentaParaVincular] = useState<Venta | null>(null);

  // Seleccion multiple para OC consolidada
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedReqIds, setSelectedReqIds] = useState<Set<string>>(new Set());

  // OC Builder wizard
  const [isOCBuilderOpen, setIsOCBuilderOpen] = useState(false);
  const [ocBuilderReqs, setOcBuilderReqs] = useState<Requerimiento[]>([]);
  const [isPendientesOpen, setIsPendientesOpen] = useState(false);

  // Form
  const [formData, setFormData] = useState<Partial<RequerimientoFormData>>({
    origen: 'manual',
    prioridad: 'media',
    tipoSolicitante: 'administracion',
    productos: []
  });

  // Producto temporal para agregar
  const [productoSnapshot, setProductoSnapshot] = useState<ProductoRequerimientoSnapshot | null>(null);
  const [productoTemp, setProductoTemp] = useState({
    productoId: '',
    cantidadSolicitada: 1,
    precioEstimadoUSD: 0,
    proveedorSugerido: '',
    urlReferencia: ''
  });

  // Investigacion de mercado
  const [investigacionMercado, setInvestigacionMercado] = useState<Map<string, InvestigacionProducto>>(new Map());
  const [loadingInvestigacion, setLoadingInvestigacion] = useState(false);
  const [showHistorial, setShowHistorial] = useState<string | null>(null);

  // Expandir/contraer secciones del panel de inteligencia
  const [expandedSections, setExpandedSections] = useState({
    alertas: true,
    sugerencias: true,
    cotizaciones: true
  });

  const { dialogProps, confirm } = useConfirmDialog();

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
      console.error('Error al cargar TC del dia:', error);
    }
  };

  const loadData = async () => {
    setLoadingLocal(true);
    try {
      const [, prods, ventas] = await Promise.all([
        fetchRequerimientos(),
        ProductoService.getAll(),
        VentaService.getAll()
      ]);
      setProductos(prods);

      const reqs = useExpectativaStore.getState().requerimientos;
      const reqVentaIds = new Set(
        reqs
          .filter(r => r.estado !== 'cancelado')
          .flatMap(r => [
            (r as any).ventaRelacionadaId,
            (r as any).cotizacionId,
            (r as any).ventaId
          ].filter(Boolean))
      );
      const cotizacionesConFaltante = ventas.filter(
        v => v.estado === 'confirmada' && v.requiereStock === true &&
          !reqVentaIds.has(v.id) &&
          !(v.cotizacionOrigenId && reqVentaIds.has(v.cotizacionOrigenId))
      );
      setCotizacionesConfirmadas(cotizacionesConFaltante);
      await loadSugerenciasStock(prods);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoadingLocal(false);
    }
  };

  const loadSugerenciasStock = async (prods: Producto[]) => {
    try {
      const inventarioAgregado = await inventarioService.getInventarioAgregado();
      const inventarioMap = new Map(inventarioAgregado.map((inv: { productoId: string; disponibles: number }) => [inv.productoId, inv]));
      const demandaHistorica: Map<string, number> = new Map();

      const productosStockBajo: Array<{
        producto: Producto;
        stockActual: number;
        stockMinimo: number;
        demandaPromedio: number;
        diasParaAgotarse: number;
        urgencia: 'critica' | 'alta' | 'media';
      }> = [];

      for (const producto of prods) {
        if (producto.estado !== 'activo') continue;
        const inventario = inventarioMap.get(producto.id);
        const stockActual = (inventario as { disponibles?: number })?.disponibles || 0;
        const stockMinimo = producto.stockMinimo || 5;

        if (stockActual <= stockMinimo) {
          const demandaPromedio = demandaHistorica.get(producto.id) || 1;
          const diasParaAgotarse = demandaPromedio > 0
            ? Math.floor(stockActual / demandaPromedio)
            : stockActual > 0 ? 30 : 0;

          let urgencia: 'critica' | 'alta' | 'media' = 'media';
          if (stockActual === 0) urgencia = 'critica';
          else if (diasParaAgotarse <= 3) urgencia = 'alta';

          productosStockBajo.push({ producto, stockActual, stockMinimo, demandaPromedio, diasParaAgotarse, urgencia });
        }
      }

      if (productosStockBajo.length === 0) {
        setSugerenciasStock([]);
        return;
      }

      const productosIds = productosStockBajo.map(p => p.producto.id);
      const investigacionMercadoMap = await OrdenCompraService.getInvestigacionMercado(productosIds);

      const sugerencias: SugerenciaStock[] = productosStockBajo.map(item => {
        const info = investigacionMercadoMap.get(item.producto.id);
        return {
          ...item,
          precioEstimadoUSD: info?.proveedorRecomendado?.ultimoPrecioUSD || info?.ultimoPrecioUSD,
          proveedorSugerido: info?.proveedorRecomendado?.nombre
        };
      });

      sugerencias.sort((a, b) => {
        const orden = { critica: 0, alta: 1, media: 2 };
        return orden[a.urgencia] - orden[b.urgencia];
      });

      setSugerenciasStock(sugerencias.slice(0, 10));
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
      parcial: [],
      en_proceso: [],
      completado: [],
      cancelado: []
    };

    requerimientosLN.forEach(req => {
      if (grouped[req.estado]) {
        grouped[req.estado].push(req);
      }
    });

    return grouped;
  }, [requerimientosLN]);

  // Estadisticas calculadas
  const stats = useMemo(() => {
    const activos = requerimientosLN.filter(r => r.estado !== 'cancelado' && r.estado !== 'completado');
    const pendientes = requerimientosLN.filter(r => r.estado === 'pendiente');
    const aprobados = requerimientosLN.filter(r => r.estado === 'aprobado');
    const enProceso = requerimientosLN.filter(r => r.estado === 'en_proceso' || r.estado === 'parcial');
    const costoEstimadoPendiente = [...pendientes, ...aprobados].reduce(
      (sum, r) => sum + (r.expectativa?.costoTotalEstimadoUSD || 0), 0
    );
    const reqUrgentes = activos.filter(r => r.prioridad === 'alta').length;

    return {
      total: requerimientosLN.length,
      activos: activos.length,
      pendientes: pendientes.length,
      aprobados: aprobados.length,
      enProceso: enProceso.length,
      urgentes: reqUrgentes,
      costoEstimadoPendiente,
      alertasStock: sugerenciasStock.filter(s => s.urgencia === 'critica' || s.urgencia === 'alta').length
    };
  }, [requerimientosLN, sugerenciasStock]);

  // ---- Handlers de producto snapshot ----

  const handleProductoSnapshotSelect = async (snapshot: ProductoRequerimientoSnapshot | null) => {
    setProductoSnapshot(snapshot);

    if (snapshot) {
      setProductoTemp(prev => ({
        ...prev,
        productoId: snapshot.productoId,
        precioEstimadoUSD: snapshot.ultimoCostoUSD || prev.precioEstimadoUSD
      }));

      if (!investigacionMercado.has(snapshot.productoId)) {
        setLoadingInvestigacion(true);
        try {
          const resultado = await OrdenCompraService.getInvestigacionMercado([snapshot.productoId]);
          const info = resultado.get(snapshot.productoId);
          if (info) {
            setInvestigacionMercado(prev => new Map(prev).set(snapshot.productoId, info));
            if (info.proveedorRecomendado) {
              setProductoTemp(prev => ({
                ...prev,
                precioEstimadoUSD: info.proveedorRecomendado!.ultimoPrecioUSD,
                proveedorSugerido: info.proveedorRecomendado!.nombre
              }));
            }
          }
        } catch (error) {
          console.error('Error al cargar investigacion de mercado:', error);
        } finally {
          setLoadingInvestigacion(false);
        }
      } else {
        const info = investigacionMercado.get(snapshot.productoId)!;
        if (info.proveedorRecomendado) {
          setProductoTemp(prev => ({
            ...prev,
            precioEstimadoUSD: info.proveedorRecomendado!.ultimoPrecioUSD,
            proveedorSugerido: info.proveedorRecomendado!.nombre
          }));
        }
      }
    } else {
      setProductoTemp(prev => ({
        ...prev,
        productoId: '',
        precioEstimadoUSD: 0,
        proveedorSugerido: ''
      }));
    }
  };

  // ---- Handlers de formulario ----

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
    if (!user || !formData.productos?.length || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await useExpectativaStore.getState().crearRequerimiento(
        formData as RequerimientoFormData,
        user.uid
      );
      setIsModalOpen(false);
      setFormData({ origen: 'manual', prioridad: 'media', tipoSolicitante: 'administracion', productos: [] });
      loadData();
    } catch (error: any) {
      toast.error(error.message, 'Error al crear requerimiento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProducto = async (data: ProductoFormData) => {
    if (!user) return;
    setIsCreatingProducto(true);
    try {
      await createProducto(data, user.uid);
      await fetchProductos();
      loadData();
      setShowProductoModal(false);
      toast.success('Producto creado correctamente');
    } catch (error: any) {
      toast.error(error.message, 'Error al crear producto');
    } finally {
      setIsCreatingProducto(false);
    }
  };

  const handleCrearDesdeSugerencia = async (sugerencia: SugerenciaStock) => {
    const cantidadSugerida = Math.max(sugerencia.stockMinimo * 2, 10);
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
      justificacion: `Stock bajo: ${sugerencia.stockActual} unidades disponibles (minimo: ${sugerencia.stockMinimo})`
    });
    setIsSugerenciasModalOpen(false);
    setIsModalOpen(true);
  };

  const handleCrearDesdeCotizacion = async (venta: Venta) => {
    if (!user) return;

    const productosFaltantes = venta.productosConFaltante || [];
    const productosVenta = venta.productos.filter(p => {
      const faltante = productosFaltantes.find(f => f.nombre.includes(p.nombreComercial));
      return faltante && faltante.solicitados > faltante.disponibles;
    });

    if (productosVenta.length === 0) {
      toast.warning('No hay productos con faltante de stock en esta venta');
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

  // ---- Handlers de estado ----

  const handleAprobar = async (req: Requerimiento) => {
    if (!user) return;
    try {
      await storeActualizarEstado(req.id, 'aprobado', user.uid);
      toast.success('Requerimiento aprobado');
      loadData();
    } catch (error: any) {
      console.error('Error al aprobar:', error);
      toast.error('Error al aprobar el requerimiento');
    }
  };

  const handleCancelar = async (req: Requerimiento) => {
    if (!user) return;
    const confirmar = await confirm({
      title: 'Cancelar Requerimiento',
      message: `Estas seguro de cancelar ${req.numeroRequerimiento}? Esta accion no se puede deshacer.`,
      confirmText: 'Cancelar Requerimiento',
      variant: 'danger'
    });
    if (!confirmar) return;
    try {
      await storeActualizarEstado(req.id, 'cancelado', user.uid);
      toast.success('Requerimiento cancelado');
      loadData();
    } catch (error: any) {
      console.error('Error al cancelar:', error);
      toast.error('Error al cancelar el requerimiento');
    }
  };

  const handleLimpiarDatos = async () => {
    if (!user) return;
    const confirmar = await confirm({
      title: 'Limpiar datos de vinculacion',
      message: 'Esto cancelara requerimientos duplicados y corregira las cotizaciones que ya tienen stock reservado. Continuar?',
      confirmText: 'Limpiar datos',
      variant: 'danger'
    });
    if (!confirmar) return;
    try {
      const result = await storeLimpiarDatos(user.uid);
      toast.success(result.resumen, 'Limpieza completada');
      loadData();
    } catch (error: any) {
      console.error('Error al limpiar datos:', error);
      toast.error(error.message, 'Error en limpieza');
    }
  };

  // ---- Handlers de OC ----

  const handleGenerarOC = (req: Requerimiento) => {
    setOcBuilderReqs([req]);
    setIsOCBuilderOpen(true);
  };

  const handleGenerarOCsPorViajero = (req: Requerimiento) => {
    setOcBuilderReqs([req]);
    setIsOCBuilderOpen(true);
  };

  const toggleReqSelection = (reqId: string) => {
    setSelectedReqIds(prev => {
      const next = new Set(prev);
      if (next.has(reqId)) {
        next.delete(reqId);
      } else {
        next.add(reqId);
      }
      return next;
    });
  };

  const handleGenerarOCConsolidada = () => {
    const selectedReqs = requerimientosLN.filter(r => selectedReqIds.has(r.id!));
    if (selectedReqs.length === 0) return;
    setOcBuilderReqs(selectedReqs);
    setIsOCBuilderOpen(true);
    setSelectionMode(false);
    setSelectedReqIds(new Set());
  };

  const handleVincularOC = (venta: Venta) => {
    setVentaParaVincular(venta);
    setIsVincularOCModalOpen(true);
  };

  const handleAsignacionCreada = () => {
    loadData();
    setIsAsignacionModalOpen(false);
  };

  const handleToggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Requerimientos</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Gestion de solicitudes de compra
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Toggle de vista */}
          <div className="bg-gray-100 rounded-lg p-1 flex">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                viewMode === 'kanban' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Lista
            </button>
          </div>

          <Button
            variant="ghost"
            onClick={() => setShowIntelligencePanel(!showIntelligencePanel)}
            className="hidden sm:flex"
          >
            <Zap className={`h-5 w-5 ${showIntelligencePanel ? 'text-yellow-500' : 'text-gray-400'}`} />
          </Button>

          {cotizacionesConfirmadas.length > 0 && (
            <Button
              variant="ghost"
              onClick={handleLimpiarDatos}
              className="hidden sm:flex text-red-500 hover:text-red-700"
              title="Limpiar duplicados y corregir datos"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => setIsPendientesOpen(true)}
            className="hidden sm:flex"
            title="Ver productos pendientes de compra"
          >
            <AlertCircle className="h-4 w-4 mr-1 text-indigo-500" />
            Pendientes
          </Button>

          <Button
            variant={selectionMode ? 'warning' : 'outline'}
            onClick={() => {
              setSelectionMode(!selectionMode);
              if (selectionMode) setSelectedReqIds(new Set());
            }}
            className="hidden sm:flex"
          >
            {selectionMode ? <CheckSquare className="h-4 w-4 mr-1" /> : <Layers className="h-4 w-4 mr-1" />}
            {selectionMode ? 'Cancelar' : 'OC Consolidada'}
          </Button>

          <Button variant="primary" onClick={() => setIsModalOpen(true)} className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Nuevo Requerimiento</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <RequerimientosKPIGrid stats={stats} />

      {/* Panel de Inteligencia */}
      {showIntelligencePanel && (
        <IntelligencePanel
          sugerenciasStock={sugerenciasStock}
          cotizacionesConfirmadas={cotizacionesConfirmadas}
          stats={stats}
          tcDelDia={tcDelDia}
          expandedSections={expandedSections}
          onToggleSection={handleToggleSection}
          onCrearDesdeSugerencia={handleCrearDesdeSugerencia}
          onVerTodasSugerencias={() => setIsSugerenciasModalOpen(true)}
          onVincularOC={handleVincularOC}
          onCrearDesdeCotizacion={handleCrearDesdeCotizacion}
          onVerTodasCotizaciones={() => setIsFromCotizacionModalOpen(true)}
        />
      )}

      {/* Vista Kanban o Lista */}
      {viewMode === 'kanban' ? (
        <KanbanBoard
          requerimientosPorEstado={requerimientosPorEstado}
          loading={loading}
          selectionMode={selectionMode}
          selectedReqIds={selectedReqIds}
          onToggleSelection={toggleReqSelection}
          onOpenDetail={(req) => {
            setSelectedRequerimiento(req);
            setIsDetailModalOpen(true);
          }}
          onAprobar={handleAprobar}
          onCancelar={handleCancelar}
          onGenerarOC={handleGenerarOC}
        />
      ) : (
        <RequerimientosListView
          requerimientos={requerimientosLN}
          loading={loading}
          onOpenDetail={(req) => {
            setSelectedRequerimiento(req);
            setIsDetailModalOpen(true);
          }}
          onAprobar={handleAprobar}
          onRefresh={loadData}
        />
      )}

      {/* Modal Nuevo Requerimiento */}
      <RequerimientoFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        formData={formData}
        onFormDataChange={setFormData}
        productoSnapshot={productoSnapshot}
        onProductoSnapshotChange={handleProductoSnapshotSelect}
        productoTemp={productoTemp}
        onProductoTempChange={setProductoTemp}
        productos={productos}
        investigacionMercado={investigacionMercado}
        loadingInvestigacion={loadingInvestigacion}
        showHistorial={showHistorial}
        onShowHistorialChange={setShowHistorial}
        tcDelDia={tcDelDia}
        isSubmitting={isSubmitting}
        onAgregarProducto={handleAgregarProducto}
        onRemoverProducto={handleRemoverProducto}
        onCrearRequerimiento={handleCrearRequerimiento}
        onAbrirCrearProducto={() => setShowProductoModal(true)}
      />

      {/* Modal Sugerencias de Stock */}
      <SugerenciasStockModal
        isOpen={isSugerenciasModalOpen}
        onClose={() => setIsSugerenciasModalOpen(false)}
        sugerencias={sugerenciasStock}
        onCrearDesdeSugerencia={handleCrearDesdeSugerencia}
      />

      {/* Modal Cotizaciones con Faltante */}
      <CotizacionesFaltanteModal
        isOpen={isFromCotizacionModalOpen}
        onClose={() => setIsFromCotizacionModalOpen(false)}
        cotizaciones={cotizacionesConfirmadas}
        onCrearDesdeCotizacion={handleCrearDesdeCotizacion}
      />

      {/* Modal Detalle */}
      <RequerimientoDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        requerimiento={selectedRequerimiento}
        onAprobar={handleAprobar}
        onGenerarOC={handleGenerarOC}
        onGenerarOCsPorViajero={handleGenerarOCsPorViajero}
        onAbrirAsignacion={() => setIsAsignacionModalOpen(true)}
      />

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

      {/* Dialogo de Confirmacion */}
      <ConfirmDialog {...dialogProps} />

      {/* Modal Vincular OC Retroactiva */}
      {ventaParaVincular && (
        <VincularOCModal
          isOpen={isVincularOCModalOpen}
          onClose={() => {
            setIsVincularOCModalOpen(false);
            setVentaParaVincular(null);
          }}
          venta={ventaParaVincular}
          userId={user?.uid || ''}
          onSuccess={() => {
            loadData();
          }}
        />
      )}

      {/* Barra flotante de seleccion para OC consolidada */}
      <SelectionFloatingBar
        selectedCount={selectedReqIds.size}
        onGenerarOCConsolidada={handleGenerarOCConsolidada}
        onCancelar={() => {
          setSelectionMode(false);
          setSelectedReqIds(new Set());
        }}
      />

      {/* OC Builder Wizard */}
      <OCBuilder
        isOpen={isOCBuilderOpen}
        onClose={() => {
          setIsOCBuilderOpen(false);
          setOcBuilderReqs([]);
        }}
        requerimientos={ocBuilderReqs}
        tcSugerido={tcDelDia?.compra}
        onComplete={(ordenesCreadas) => {
          setIsOCBuilderOpen(false);
          setOcBuilderReqs([]);
          toast.success(`${ordenesCreadas.length} OC(s) creadas exitosamente`);
          loadData();
        }}
      />

      <PendientesCompraPanel
        isOpen={isPendientesOpen}
        onClose={() => setIsPendientesOpen(false)}
        requerimientos={requerimientosLN}
        onEnviarAlBuilder={(reqs) => {
          setIsPendientesOpen(false);
          setOcBuilderReqs(reqs);
          setIsOCBuilderOpen(true);
        }}
      />
    </div>
  );
};
