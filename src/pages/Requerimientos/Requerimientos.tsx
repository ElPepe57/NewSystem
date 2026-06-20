import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus, RefreshCw, Layers, CheckSquare, ClipboardList,
  Clock, AlertTriangle, CheckCircle, Link2, DollarSign,
  AlertOctagon, ShoppingCart, BadgeDollarSign,
  LayoutDashboard, ListChecks, PackageSearch,
} from 'lucide-react';
import { ConfirmDialog, Modal, useConfirmDialog } from '../../components/common';
import { LineaDropdown } from '../../components/common/LineaDropdown';
import { HubShell, HubTopBar, HubHeader, HubKpiStrip, HubTabs, HubBody } from '../../design-system';
import type { HubKpi, HubMiniStat, HubTab } from '../../design-system';
import { ProductoForm } from '../../components/modules/productos/ProductoForm';
import { AsignacionResponsableForm } from '../../components/modules/requerimiento/AsignacionResponsableForm';
import { OCBuilder, PendientesCompraPanel } from '../../components/modules/ordenCompra';
import type { ProductoRequerimientoSnapshot } from '../../components/modules/entidades/ProductoSearchRequerimientos';
import { useProductoStore } from '../../store/productoStore';
import { useRequerimientoStore } from '../../store/requerimientoStore';
import { requerimientoService } from '../../services/requerimiento.service';
import type { ProductoFormData } from '../../types/producto.types';
import { ProductoService } from '../../services/producto.service';
import { OrdenCompraService } from '../../services/ordenCompra.service';
import { VentaService } from '../../services/venta.service';
import { inventarioService } from '../../services/inventario.service';
import { tipoCambioService } from '../../services/tipoCambio.service';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import { hasRole } from '../../types/auth.types';
import type {
  Requerimiento,
  RequerimientoFormData
} from '../../types/requerimiento.types';
import type { Producto } from '../../types/producto.types';
import type { Venta } from '../../types/venta.types';

// Sub-components
import { ResumenRequerimientos } from './ResumenRequerimientos';
import { TableroRequerimientos } from './TableroRequerimientos';
import { RequerimientoFormModal } from './RequerimientoFormModal';
import { RequerimientoDetailModal } from './RequerimientoDetailModal';
import { SugerenciasStockModal } from './SugerenciasStockModal';
import { CotizacionesFaltanteModal } from './CotizacionesFaltanteModal';
import { SelectionFloatingBar } from './SelectionFloatingBar';
import type { InvestigacionProducto, SugerenciaStock } from './requerimientos.types';

export const Requerimientos: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const userProfile = useAuthStore((state) => state.userProfile);
  const toast = useToastStore();
  const { productos: productosStore, createProducto, fetchProductos } = useProductoStore();
  const {
    requerimientos,
    loading: loadingReqs,
    fetchRequerimientos,
    cancelarRequerimiento: storeCancelarRequerimiento,
    limpiarDatosVinculacion: storeLimpiarDatos
  } = useRequerimientoStore();

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

  // Vista · tab activa del hub (Resumen default · canon hub)
  const [tabActiva, setTabActiva] = useState<'resumen' | 'tablero' | 'pendientes'>('resumen');
  const esAdmin = hasRole(userProfile, 'admin'); // canon "admin ve todo" · chip contextual al rol

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

  // Seleccion multiple para OC consolidada
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedReqIds, setSelectedReqIds] = useState<Set<string>>(new Set());

  // OC Builder wizard
  const [isOCBuilderOpen, setIsOCBuilderOpen] = useState(false);
  const [ocBuilderReqs, setOcBuilderReqs] = useState<Requerimiento[]>([]);
  const [isPendientesOpen, setIsPendientesOpen] = useState(false);

  // Form
  const [formData, setFormData] = useState<Partial<RequerimientoFormData>>({
    origen: 'administrativo',
    subtipo: 'manual',
    prioridad: 'media',
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
        VentaService.getVentasRequierenStock()
      ]);
      setProductos(prods);

      const reqs = useRequerimientoStore.getState().requerimientos;
      const reqVentaIds = new Set(
        reqs
          .filter(r => r.estado !== 'cancelado')
          .flatMap(r => [
            (r as any).ventaRelacionadaId,
            (r as any).cotizacionId,
            (r as any).ventaId
          ].filter(Boolean))
      );
      // Las ventas ya vienen filtradas (confirmadas + requiereStock) desde el servicio
      const cotizacionesConFaltante = ventas.filter(
        v => !reqVentaIds.has(v.id) &&
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
      await useRequerimientoStore.getState().crearRequerimiento(
        formData as RequerimientoFormData,
        user.uid
      );
      setIsModalOpen(false);
      setFormData({ origen: 'administrativo', subtipo: 'manual', prioridad: 'media', productos: [] });
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
      origen: 'administrativo',
      subtipo: 'restock',
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
      origen: 'demanda_comprometida',
      ventaRelacionadaId: venta.id,
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
    if (!user || !userProfile) return;
    try {
      const result = await requerimientoService.aprobar(req.id, user.uid, userProfile.role);

      if (result.completa) {
        toast.success('Requerimiento aprobado');
      } else {
        const rolPendiente = result.pendiente === 'admin' ? 'Administrador' : 'Gerente General';
        toast.warning(`Tu firma fue registrada. Falta la firma del ${rolPendiente} para completar la aprobación.`);
      }
      loadData();
    } catch (error: any) {
      console.error('Error al aprobar:', error);
      toast.error(error.message || 'Error al aprobar el requerimiento');
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
      await storeCancelarRequerimiento(req.id, user.uid);
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

  const handleAsignacionCreada = () => {
    loadData();
    setIsAsignacionModalOpen(false);
  };

  const handleNuevaApuesta = () => {
    setFormData({ origen: 'administrativo', subtipo: 'apuesta', prioridad: 'media', productos: [] });
    setIsModalOpen(true);
  };

  const handleGenerarOCAprobados = () => {
    const aprobados = requerimientosLN.filter(r => r.estado === 'aprobado');
    if (aprobados.length === 0) return;
    setOcBuilderReqs(aprobados);
    setIsOCBuilderOpen(true);
  };

  // ─── Chrome del hub (KPIs semánticos · mini-stats · tabs) ───
  const reqKpis: HubKpi[] = [
    { label: 'Pendientes', valor: String(stats.pendientes), tono: 'amber', icon: Clock, delta: 'por aprobar' },
    { label: 'Urgentes', valor: String(stats.urgentes), tono: 'rose', icon: AlertTriangle, delta: 'prioridad alta' },
    { label: 'Aprobados', valor: String(stats.aprobados), tono: 'emerald', icon: CheckCircle, delta: 'listos p/ OC' },
    { label: 'En proceso', valor: String(stats.enProceso), tono: 'sky', icon: Link2, delta: 'con OC vinculada' },
    { label: 'Por comprar', valor: `$ ${stats.costoEstimadoPendiente.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, tono: 'indigo', icon: DollarSign, delta: 'estimado USD' },
  ];
  const reqMiniStats: HubMiniStat[] = [
    { label: <>Alertas de stock: <b className="text-slate-800">{stats.alertasStock}</b></>, icon: AlertOctagon },
    { label: <>Cotizaciones c/ faltante: <b className="text-slate-800">{cotizacionesConfirmadas.length}</b></>, icon: ShoppingCart },
    ...(tcDelDia ? [{ label: <>TC del día: <b className="text-slate-800 tabular-nums">S/ {tcDelDia.venta.toFixed(2)}</b></>, icon: BadgeDollarSign }] : []),
  ];
  const reqTabs: HubTab[] = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { id: 'tablero', label: 'Tablero', icon: ListChecks, badge: stats.activos || undefined, badgeTono: 'rose' },
    { id: 'pendientes', label: 'Pendientes de compra', icon: PackageSearch },
  ];
  const breadcrumbLeaf = tabActiva === 'resumen' ? null : (reqTabs.find(t => t.id === tabActiva)?.label ?? null);

  const abrirDetalle = (req: Requerimiento) => {
    setSelectedRequerimiento(req);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
      <HubShell>
        <HubTopBar grupo="comercial" modulo="Requerimientos" leaf={breadcrumbLeaf} esAdmin={esAdmin} onModulo={() => setTabActiva('resumen')} />
        <HubHeader
          grupo="comercial"
          icon={ClipboardList}
          titulo="Requerimientos"
          subtitulo="Solicitudes de compra · demanda · aprobación · generación de OC"
          extraActions={<LineaDropdown />}
          acciones={[
            ...(cotizacionesConfirmadas.length > 0
              ? [{ label: 'Limpiar datos', icon: RefreshCw, onClick: handleLimpiarDatos, tier: 'config' as const }]
              : []),
            {
              label: selectionMode ? 'Cancelar selección' : 'OC Consolidada',
              icon: selectionMode ? CheckSquare : Layers,
              onClick: () => { setSelectionMode(!selectionMode); if (selectionMode) setSelectedReqIds(new Set()); },
              tier: 'neutral' as const,
            },
            { label: 'Nuevo Requerimiento', icon: Plus, onClick: () => setIsModalOpen(true), tier: 'primary' as const },
          ]}
        />
        <HubKpiStrip cols={5} kpis={reqKpis} miniStats={reqMiniStats} />
        <HubTabs grupo="comercial" tabs={reqTabs} activa={tabActiva} onChange={(id) => setTabActiva(id as typeof tabActiva)} />
        <HubBody flush>

          {/* ═══ TAB RESUMEN ═══ (§A→§F · dashboard ejecutivo) */}
          {tabActiva === 'resumen' && (
            <ResumenRequerimientos
              stats={stats}
              requerimientos={requerimientosLN}
              sugerenciasStock={sugerenciasStock}
              cotizacionesConfirmadas={cotizacionesConfirmadas}
              onNuevo={() => setIsModalOpen(true)}
              onApuesta={handleNuevaApuesta}
              onOCConsolidada={() => { setSelectionMode(true); setTabActiva('tablero'); }}
              onPendientes={() => setTabActiva('pendientes')}
              onGenerarOCAprobados={handleGenerarOCAprobados}
              onCrearDesdeSugerencia={handleCrearDesdeSugerencia}
              onVerTodasSugerencias={() => setIsSugerenciasModalOpen(true)}
            />
          )}

          {/* ═══ TAB TABLERO ═══ (Lista operativa + acordeón · Kanban retirado · D4) */}
          {tabActiva === 'tablero' && (
            <TableroRequerimientos
              requerimientos={requerimientosLN}
              loading={loading}
              selectionMode={selectionMode}
              selectedReqIds={selectedReqIds}
              onToggleSelection={toggleReqSelection}
              onOpenDetail={abrirDetalle}
              onAprobar={handleAprobar}
              onCancelar={handleCancelar}
              onGenerarOC={handleGenerarOC}
              onGenerarOCConsolidada={handleGenerarOCConsolidada}
            />
          )}

          {/* ═══ TAB PENDIENTES DE COMPRA ═══ (interim · HUB-4 inline-a el panel) */}
          {tabActiva === 'pendientes' && (
            <div className="p-4 sm:p-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><PackageSearch className="w-6 h-6" /></div>
                <div>
                  <p className="text-[14px] font-semibold text-slate-800">Productos pendientes de compra</p>
                  <p className="text-[12px] text-slate-500 mt-0.5 max-w-md">Vista agregada por producto · puente al generador de órdenes. Abrí el panel para revisarlos y enviarlos al builder.</p>
                </div>
                <button type="button" onClick={() => setIsPendientesOpen(true)} className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2">
                  <PackageSearch className="w-4 h-4" /> Ver pendientes de compra
                </button>
              </div>
            </div>
          )}

        </HubBody>
      </HubShell>

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
