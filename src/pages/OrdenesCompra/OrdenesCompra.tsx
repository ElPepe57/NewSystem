import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Package, DollarSign, TrendingUp, AlertCircle, Download, ExternalLink, FileText, Send, Truck, CheckCircle, XCircle, CreditCard, PackageCheck, Calendar, Building2, Edit3, Search, LayoutGrid, List } from 'lucide-react';
import { Button, Card, Modal, useConfirmDialog, ConfirmDialog, useActionModal, ActionModal } from '../../components/common';
import { PageShell, PageHeader, KPIBar, StatCard, DataCard } from '../../design-system';
import type { StatusVariant } from '../../design-system';
import { useToastStore } from '../../store/toastStore';
import { OrdenCompraForm } from '../../components/modules/ordenCompra/OrdenCompraForm';
import { OrdenCompraTable } from '../../components/modules/ordenCompra/OrdenCompraTable';
import { OrdenCompraCard } from '../../components/modules/ordenCompra/OrdenCompraCard';
import { OCWizardV3 } from '../../components/modules/ordenCompra/OCWizardV3/OCWizardV3';
import { CompraCard } from '../../components/modules/ordenCompra/CompraCard';
import { PipelineCompras } from '../../components/modules/ordenCompra/PipelineCompras';
import type { EstadoPipelineCompras, PipelineComprasStage } from '../../components/modules/ordenCompra/PipelineCompras';
import { SubOrdenDetailModal } from '../../components/modules/ordenCompra/SubOrdenDetailModal';
import { useEnvioStore } from '../../store/envioStore';
import { PagoUnificadoForm } from '../../components/modules/pagos/PagoUnificadoForm';
import type { PagoUnificadoResult } from '../../components/modules/pagos/PagoUnificadoForm';
// S40: RecepcionParcialModal eliminado — recepción ahora se gestiona desde el Envío (ver EnviosDeOC en OrdenCompraCard)
import { ConfirmarOCModal } from '../../components/modules/ordenCompra/ConfirmarOCModal';
import { DespacharOCModal, type DespacharOCResult } from '../../components/modules/ordenCompra/DespacharOCModal';
import type { SubOrdenCompra } from '../../types/ordenCompra.types';
import { useOrdenCompraStore } from '../../store/ordenCompraStore';
import { useProveedorStore } from '../../store/proveedorStore';
import { useProductoStore } from '../../store/productoStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { useAuthStore } from '../../store/authStore';
import { useColaboradorStore } from '../../store/colaboradorStore';
import { exportService } from '../../services/export.service';
import type { OrdenCompra, OrdenCompraFormData, EstadoOrden } from '../../types/ordenCompra.types';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';
import { formatFecha } from '../../utils/dateFormatters';

// Interface para datos de requerimiento que viene del navigation state
interface RequerimientoData {
  id: string;
  numeroRequerimiento: string;
  productos: Array<{
    productoId: string;
    sku: string;
    marca: string;
    nombreComercial: string;
    cantidad: number;
    precioUnitarioUSD: number;
    proveedorSugerido?: string;
    urlReferencia?: string;
  }>;
  tcInvestigacion: number;
  prioridad: 'alta' | 'media' | 'baja';
}

// Interface para datos de requerimiento multi-viajero
interface RequerimientoMultiViajeroData {
  id: string;
  numeroRequerimiento: string;
  tcInvestigacion?: number;
  prioridad?: 'alta' | 'media' | 'baja';
  asignaciones: Array<{
    asignacionId: string;
    viajeroId: string;
    viajeroNombre: string;
    viajeroCodigo: string;
    productos: Array<{
      productoId: string;
      sku: string;
      marca: string;
      nombreComercial: string;
      cantidad: number;
      precioUnitarioUSD: number;
    }>;
    costoEstimadoUSD?: number;
  }>;
}

export const OrdenesCompra: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const toast = useToastStore();
  const { productos, fetchProductos } = useProductoStore();
  const { getTCDelDia } = useTipoCambioStore();
  const [tcSugerido, setTcSugerido] = useState<number>(0);

  // Proveedores desde el store centralizado
  const { proveedoresActivos, fetchProveedoresActivos } = useProveedorStore();

  // S38-011: Colaboradores (couriers + transportistas locales) para el modal de despacho
  const { colaboradores, fetchColaboradores } = useColaboradorStore();
  // S42al — Líneas de negocio para dropdown de filtro (mockup S40 L248-250)
  const lineasActivas = useLineaNegocioStore((s) => s.lineasActivas);
  const lineaFiltroGlobal = useLineaNegocioStore((s) => s.lineaFiltroGlobal);
  const setLineaFiltroGlobal = useLineaNegocioStore((s) => s.setLineaFiltroGlobal);
  const fetchLineasActivas = useLineaNegocioStore((s) => s.fetchLineasActivas);
  useEffect(() => {
    if (lineasActivas.length === 0) fetchLineasActivas();
  }, [lineasActivas.length, fetchLineasActivas]);
  useEffect(() => {
    if (colaboradores.length === 0) fetchColaboradores();
  }, []);

  // Datos del requerimiento si viene de Requerimientos
  const fromRequerimiento = (location.state as { fromRequerimiento?: RequerimientoData })?.fromRequerimiento;
  const fromRequerimientoMultiViajero = (location.state as { fromRequerimientoMultiViajero?: RequerimientoMultiViajeroData })?.fromRequerimientoMultiViajero;
  const fromMultipleRequerimientos = (location.state as { fromMultipleRequerimientos?: {
    requerimientoIds: string[];
    requerimientoNumeros: string[];
    productos: Array<{ productoId: string; cantidad: number; precioUnitarioUSD: number }>;
    productosOrigen: Array<{ productoId: string; requerimientoId: string; cantidad: number; cotizacionId?: string; clienteNombre?: string }>;
    clientes: Array<{ requerimientoId: string; requerimientoNumero: string; clienteNombre: string }>;
    tcInvestigacion: number;
  } })?.fromMultipleRequerimientos;
  const {
    ordenes,
    stats,
    loading,
    fetchOrdenes,
    createOrden,
    updateOrden,
    cambiarEstadoOrden,
    confirmarOC,
    registrarPago,
    deleteOrden,
    fetchStats
  } = useOrdenCompraStore();

  // S41 — envíos para mostrar lista asociada en CompraCard
  const envios = useEnvioStore((s) => s.envios);
  const fetchEnvios = useEnvioStore((s) => s.fetchEnvios);

  // Índice envíos por ordenCompraId (O(1) lookup desde cards)
  const enviosPorOCIndex = useMemo(() => {
    const m = new Map<string, typeof envios>();
    envios.forEach((e) => {
      if (!e.ordenCompraId) return;
      if (!m.has(e.ordenCompraId)) m.set(e.ordenCompraId, []);
      m.get(e.ordenCompraId)!.push(e);
    });
    return m;
  }, [envios]);

  // Filtrar órdenes por línea de negocio global
  const ordenesLN = useLineaFilter(ordenes, o => o.lineaNegocioId);

  // S41 Tanda 6 — estado para SubOrdenDetailModal
  const [subOrdenDetalle, setSubOrdenDetalle] = useState<{
    ordenId: string;
    subOrdenId: string;
  } | null>(null);

  // S42am — Default a vista card para que coincida con el diseño del mockup S40.
  // La vista tabla se mantiene como opción pero no es el default.
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');
  const [isWizardV2Open, setIsWizardV2Open] = useState(false);
  const [isOrdenModalOpen, setIsOrdenModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isPagoModalOpen, setIsPagoModalOpen] = useState(false);
  const [isConfirmarModalOpen, setIsConfirmarModalOpen] = useState(false);
  // S38-011: estado para el modal custom de despacho
  const [despacharCtx, setDespacharCtx] = useState<{ estadoTarget: EstadoOrden; titulo: string } | null>(null);
  const [selectedOrden, setSelectedOrdenLocal] = useState<OrdenCompra | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null);
  // S42 Tanda 10 — Filtros adicionales vista Compras (mockup s40 líneas 235-254)
  const [busquedaGlobal, setBusquedaGlobal] = useState('');
  const [pillFiltro, setPillFiltro] = useState<'todas' | 'activas' | 'completadas'>('todas');
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [filtroEstadoPago, setFiltroEstadoPago] = useState('');
  const [itemsVisibles, setItemsVisibles] = useState(10);
  // Estado para edición
  const [ordenEditando, setOrdenEditando] = useState<OrdenCompra | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Datos iniciales para el formulario (cuando viene de un requerimiento)
  const [initialFormData, setInitialFormData] = useState<{
    requerimientoId?: string;
    requerimientoNumero?: string;
    // Multi-requerimiento (OC consolidada)
    requerimientoIds?: string[];
    requerimientoNumeros?: string[];
    clientesOrigen?: Array<{ requerimientoId: string; requerimientoNumero: string; clienteNombre: string }>;
    productosOrigen?: Array<{ productoId: string; requerimientoId: string; cantidad: number; cotizacionId?: string; clienteNombre?: string }>;
    productos?: Array<{
      productoId: string;
      cantidad: number;
      precioUnitarioUSD: number;
    }>;
    tcSugerido?: number;
    // Viajero preseleccionado (flujo multi-viajero)
    viajero?: {
      id: string;
      nombre: string;
    };
  } | null>(null);

  // Estado para creación multi-viajero
  const [multiViajeroData, setMultiViajeroData] = useState<RequerimientoMultiViajeroData | null>(null);
  const [currentViajeroIndex, setCurrentViajeroIndex] = useState(0);
  const [creandoMultiOC, setCreandoMultiOC] = useState(false);
  const [totalViajerosOriginal, setTotalViajerosOriginal] = useState(0);
  const [viajerosCompletados, setViajerosCompletados] = useState(0);
  // Flag para evitar re-abrir el modal después de completar el flujo multi-viajero
  const [multiViajeroCompletado, setMultiViajeroCompletado] = useState(false);

  // Hook para dialogo de confirmacion
  const { dialogProps, confirm } = useConfirmDialog();
  const { modalProps: actionModalProps, open: openActionModal } = useActionModal();

  // Pipeline stages para filtrado visual
  // S41 — Pipeline Opción B: 4 estados (Borrador → Confirmada → En Despacho → Completada)
  // Se deriva de los estados internos agrupándolos.
  const pipelineComprasStages: PipelineComprasStage[] = useMemo(() => {
    const countEstado = (estados: string[]) =>
      ordenesLN.filter((o) => estados.includes(o.estado)).length;

    return [
      { id: 'borrador', label: 'Borrador', count: countEstado(['borrador']) },
      {
        id: 'confirmada',
        label: 'Confirmada',
        count: countEstado(['confirmada', 'enviada', 'pagada']),
      },
      {
        id: 'en_despacho',
        label: 'En Despacho',
        count: countEstado(['en_proceso', 'despachada', 'en_transito', 'recibida_parcial']),
      },
      {
        id: 'completada',
        label: 'Completada',
        count: countEstado(['completada', 'recibida']),
      },
    ];
  }, [ordenesLN]);

  // Mapeo pipeline Opción B → estados internos (para filtrado)
  const estadoFilterMapOpcionB: Record<EstadoPipelineCompras, string[]> = {
    borrador: ['borrador'],
    confirmada: ['confirmada', 'enviada', 'pagada'],
    en_despacho: ['en_proceso', 'despachada', 'en_transito', 'recibida_parcial'],
    completada: ['completada', 'recibida'],
  };

  // S42 Tanda 10 — Stats derivados para KPIs enriquecidos (mockup s40 líneas 128-178)
  const statsExtra = useMemo(() => {
    const estadosActivos = ['confirmada', 'enviada', 'pagada', 'en_proceso', 'despachada', 'en_transito', 'recibida_parcial'];
    const estadosCompletados = ['completada', 'recibida'];

    let montoPendienteUSD = 0;
    let ocsConPagoPendiente = 0;
    let montoCompletadasUSD = 0;
    let countActivas = 0;
    let countCompletadas = 0;

    for (const o of ordenesLN) {
      if (estadosActivos.includes(o.estado)) countActivas++;
      if (estadosCompletados.includes(o.estado)) {
        countCompletadas++;
        montoCompletadasUSD += (o.totalUSD || 0);
      }
      if (o.estado !== 'cancelada' && (o.estadoPago === 'pendiente' || o.estadoPago === 'parcial')) {
        const pagado = (o.historialPagos || []).reduce((s, p) => s + (p.montoUSD || 0), 0);
        const pendiente = (o.totalUSD || 0) - pagado;
        if (pendiente > 0.01) {
          montoPendienteUSD += pendiente;
          ocsConPagoPendiente++;
        }
      }
    }

    // Envíos activos vinculados a OCs en despacho
    const ocIdsEnDespacho = new Set(
      ordenesLN
        .filter(o => ['en_proceso', 'despachada', 'en_transito', 'recibida_parcial'].includes(o.estado))
        .map(o => o.id)
    );
    const enviosActivosVinculados = envios.filter(e =>
      e.ordenCompraId && ocIdsEnDespacho.has(e.ordenCompraId) && ['en_transito', 'confirmado'].includes(e.estado)
    ).length;

    return {
      montoPendienteUSD,
      ocsConPagoPendiente,
      montoCompletadasUSD,
      countActivas,
      countCompletadas,
      enviosActivosVinculados,
    };
  }, [ordenesLN, envios]);

  // Órdenes filtradas — aplica pipeline + pills + dropdowns + búsqueda global
  const ordenesFiltradas = useMemo(() => {
    let lista = ordenesLN;

    // Pipeline stage (si activo)
    if (filtroEstado) {
      const estadosValidos =
        estadoFilterMapOpcionB[filtroEstado as EstadoPipelineCompras] || [filtroEstado];
      lista = lista.filter((o) => estadosValidos.includes(o.estado));
    }

    // Pills filtro (todas / activas / completadas)
    if (pillFiltro === 'activas') {
      lista = lista.filter(o =>
        ['confirmada', 'enviada', 'pagada', 'en_proceso', 'despachada', 'en_transito', 'recibida_parcial'].includes(o.estado)
      );
    } else if (pillFiltro === 'completadas') {
      lista = lista.filter(o => ['completada', 'recibida'].includes(o.estado));
    }

    // Filtro por proveedor
    if (filtroProveedor) {
      lista = lista.filter(o => o.proveedorId === filtroProveedor);
    }

    // Filtro por estado de pago
    if (filtroEstadoPago) {
      lista = lista.filter(o => o.estadoPago === filtroEstadoPago);
    }

    // Búsqueda global (número OC, proveedor, tracking)
    if (busquedaGlobal.trim()) {
      const term = busquedaGlobal.trim().toLowerCase();
      lista = lista.filter(o =>
        (o.numeroOrden || '').toLowerCase().includes(term) ||
        (o.nombreProveedor || '').toLowerCase().includes(term) ||
        (o.numeroTracking || '').toLowerCase().includes(term)
      );
    }

    return lista;
  }, [ordenesLN, filtroEstado, pillFiltro, filtroProveedor, filtroEstadoPago, busquedaGlobal]);

  // Reset paginación cuando cambian filtros
  useEffect(() => {
    setItemsVisibles(10);
  }, [filtroEstado, pillFiltro, filtroProveedor, filtroEstadoPago, busquedaGlobal]);

  // Cargar datos al montar
  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchOrdenes();
        await fetchProveedoresActivos();
        await fetchProductos();
        await fetchEnvios(); // S41: para mostrar envíos asociados en CompraCard
        if (fetchStats && typeof fetchStats === 'function') {
          await fetchStats();
        }

        // Cargar tipo de cambio sugerido
        const tc = await getTCDelDia();
        if (tc) {
          setTcSugerido(tc.compra);
        }
      } catch (error) {
        console.error('Error cargando datos:', error);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si viene de Requerimientos, abrir modal con datos pre-cargados
  useEffect(() => {
    if (fromRequerimiento && proveedoresActivos.length > 0) {
      // Preparar datos iniciales
      setInitialFormData({
        requerimientoId: fromRequerimiento.id,
        requerimientoNumero: fromRequerimiento.numeroRequerimiento,
        productos: fromRequerimiento.productos.map(p => ({
          productoId: p.productoId,
          cantidad: p.cantidad,
          precioUnitarioUSD: p.precioUnitarioUSD
        })),
        tcSugerido: fromRequerimiento.tcInvestigacion
      });

      // Abrir modal de nueva orden
      setIsOrdenModalOpen(true);

      // Limpiar el state de location para evitar re-abrir al navegar
      window.history.replaceState({}, document.title);
    }
  }, [fromRequerimiento, proveedoresActivos]);

  // Si viene de Requerimientos con multi-viajero, preparar creación secuencial
  // IMPORTANTE: Solo ejecutar UNA VEZ cuando llega el dato, no cuando cambia creandoMultiOC
  useEffect(() => {
    // Si ya completamos el flujo multi-viajero, no volver a abrir
    if (multiViajeroCompletado) return;

    // Solo iniciar si tenemos datos Y no estamos ya en proceso
    if (fromRequerimientoMultiViajero && proveedoresActivos.length > 0 && !creandoMultiOC && !multiViajeroData) {
      setMultiViajeroData(fromRequerimientoMultiViajero);
      setCurrentViajeroIndex(0);
      setCreandoMultiOC(true);
      setTotalViajerosOriginal(fromRequerimientoMultiViajero.asignaciones.length);
      setViajerosCompletados(0);

      // Preparar datos del primer viajero
      const primeraAsignacion = fromRequerimientoMultiViajero.asignaciones[0];
      if (primeraAsignacion) {
        setInitialFormData({
          requerimientoId: fromRequerimientoMultiViajero.id,
          requerimientoNumero: fromRequerimientoMultiViajero.numeroRequerimiento,
          productos: primeraAsignacion.productos.map(p => ({
            productoId: p.productoId,
            cantidad: p.cantidad,
            precioUnitarioUSD: p.precioUnitarioUSD
          })),
          tcSugerido: fromRequerimientoMultiViajero.tcInvestigacion,
          // Preseleccionar el viajero como almacén destino
          viajero: {
            id: primeraAsignacion.viajeroId,
            nombre: primeraAsignacion.viajeroNombre
          }
        });
        setIsOrdenModalOpen(true);
      }

      // Limpiar el state de location
      window.history.replaceState({}, document.title);
    }
  }, [fromRequerimientoMultiViajero, proveedoresActivos, creandoMultiOC, multiViajeroData, multiViajeroCompletado]);

  // Si viene de Requerimientos con múltiples requerimientos (OC consolidada)
  useEffect(() => {
    if (fromMultipleRequerimientos && proveedoresActivos.length > 0) {
      setInitialFormData({
        requerimientoIds: fromMultipleRequerimientos.requerimientoIds,
        requerimientoNumeros: fromMultipleRequerimientos.requerimientoNumeros,
        clientesOrigen: fromMultipleRequerimientos.clientes,
        productosOrigen: fromMultipleRequerimientos.productosOrigen,
        productos: fromMultipleRequerimientos.productos.map(p => ({
          productoId: p.productoId,
          cantidad: p.cantidad,
          precioUnitarioUSD: p.precioUnitarioUSD
        })),
        tcSugerido: fromMultipleRequerimientos.tcInvestigacion
      });
      setIsOrdenModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [fromMultipleRequerimientos, proveedoresActivos]);

  // Crear orden
  const handleCreateOrden = async (data: OrdenCompraFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Si viene de un requerimiento, incluir el ID para vinculación
      const ordenData = initialFormData?.requerimientoId
        ? { ...data, requerimientoId: initialFormData.requerimientoId }
        : data;

      // Si estamos en modo multi-viajero, asignar los productos al viajero correspondiente
      if (creandoMultiOC && multiViajeroData) {
        const asignacionActual = multiViajeroData.asignaciones[currentViajeroIndex];
        if (asignacionActual) {
          // Agregar viajeroId y viajeroNombre a cada producto
          ordenData.productos = ordenData.productos.map(prod => ({
            ...prod,
            viajeroId: asignacionActual.viajeroId,
            viajeroNombre: asignacionActual.viajeroNombre
          }));
        }
      }

      await createOrden(ordenData, user.uid);

      // Si estamos en modo multi-viajero, pasar al siguiente viajero
      if (creandoMultiOC && multiViajeroData) {
        const asignacionActualNombre = multiViajeroData.asignaciones[currentViajeroIndex]?.viajeroNombre;
        const nuevosCompletados = viajerosCompletados + 1;
        setViajerosCompletados(nuevosCompletados);

        // Eliminar la asignación actual (ya procesada) del array
        const asignacionesRestantes = multiViajeroData.asignaciones.filter((_, idx) => idx !== currentViajeroIndex);

        if (asignacionesRestantes.length > 0) {
          // Hay más viajeros, actualizar datos y preparar el siguiente
          const siguienteAsignacion = asignacionesRestantes[0];

          // Actualizar multiViajeroData sin la asignación procesada
          setMultiViajeroData({
            ...multiViajeroData,
            asignaciones: asignacionesRestantes
          });
          setCurrentViajeroIndex(0); // Siempre será el primero del array restante

          setInitialFormData({
            requerimientoId: multiViajeroData.id,
            requerimientoNumero: multiViajeroData.numeroRequerimiento,
            productos: siguienteAsignacion.productos.map(p => ({
              productoId: p.productoId,
              cantidad: p.cantidad,
              precioUnitarioUSD: p.precioUnitarioUSD
            })),
            tcSugerido: multiViajeroData.tcInvestigacion,
            // Preseleccionar el viajero como almacén destino
            viajero: {
              id: siguienteAsignacion.viajeroId,
              nombre: siguienteAsignacion.viajeroNombre
            }
          });

          toast.success(
            `OC creada para ${asignacionActualNombre}. Siguiente: ${siguienteAsignacion.viajeroNombre} (${nuevosCompletados + 1}/${totalViajerosOriginal})`
          );
          // El modal permanece abierto para el siguiente viajero
        } else {
          // Terminamos con todos los viajeros - guardar total antes de resetear
          const totalCreadas = totalViajerosOriginal;

          // MARCAR COMO COMPLETADO PRIMERO para evitar que el useEffect re-abra el modal
          setMultiViajeroCompletado(true);

          // Limpiar todos los estados
          setIsOrdenModalOpen(false);
          setInitialFormData(null);
          setMultiViajeroData(null);
          setCurrentViajeroIndex(0);
          setCreandoMultiOC(false);
          setTotalViajerosOriginal(0);
          setViajerosCompletados(0);

          // Mostrar mensaje DESPUÉS de limpiar estados
          toast.success(
            `¡Todas las OCs han sido creadas! Total: ${totalCreadas} órdenes de compra`
          );
        }
      } else {
        setIsOrdenModalOpen(false);
        setIsWizardV2Open(false);
        setInitialFormData(null);
        toast.success('Orden de compra creada exitosamente');
      }
    } catch (error: any) {
      console.error('Error al crear orden:', error);
      toast.error(error.message);
      // En caso de error, marcar como completado y cerrar todo
      if (creandoMultiOC) {
        setMultiViajeroCompletado(true);
        setMultiViajeroData(null);
        setCurrentViajeroIndex(0);
        setCreandoMultiOC(false);
        setTotalViajerosOriginal(0);
        setViajerosCompletados(0);
      }
      setIsOrdenModalOpen(false);
      setInitialFormData(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cerrar modal y limpiar datos iniciales
  const handleCloseOrdenModal = () => {
    setIsOrdenModalOpen(false);
    setInitialFormData(null);
    // Limpiar estado de edición
    setOrdenEditando(null);
    setIsEditMode(false);
    // Limpiar datos de multi-viajero si estaba en ese modo
    if (creandoMultiOC) {
      // Marcar como completado para evitar que el useEffect re-abra el modal
      setMultiViajeroCompletado(true);
      setMultiViajeroData(null);
      setCurrentViajeroIndex(0);
      setCreandoMultiOC(false);
      setTotalViajerosOriginal(0);
      setViajerosCompletados(0);
    }
  };

  // Helper: obtener orden fresca del store (evita stale closure)
  const refreshSelectedOrden = async (ordenId: string) => {
    // Re-fetch to ensure fresh data from Firestore
    await fetchOrdenes();
    const freshOrdenes = useOrdenCompraStore.getState().ordenes;
    const ordenActualizada = freshOrdenes.find(o => o.id === ordenId);
    if (ordenActualizada) setSelectedOrdenLocal(ordenActualizada);
  };

  // Ver detalles
  const handleViewDetails = (orden: OrdenCompra) => {
    setSelectedOrdenLocal(orden);
    setIsDetailsModalOpen(true);
  };

  // Editar orden (solo permitido en estado borrador)
  const handleEditOrden = (orden: OrdenCompra) => {
    if (orden.estado !== 'borrador') {
      toast.warning('Solo se pueden editar órdenes en estado Borrador');
      return;
    }
    setOrdenEditando(orden);
    setIsEditMode(true);
    setIsOrdenModalOpen(true);
  };

  // Actualizar orden existente
  const handleUpdateOrden = async (data: OrdenCompraFormData) => {
    if (!user || !ordenEditando) return;

    setIsSubmitting(true);
    try {
      await updateOrden(ordenEditando.id, data, user.uid);
      toast.success('Orden actualizada correctamente');
      setIsOrdenModalOpen(false);
      setOrdenEditando(null);
      setIsEditMode(false);
    } catch (error: any) {
      console.error('Error al actualizar orden:', error);
      toast.error(error.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cambiar estado
  const handleCambiarEstado = async (nuevoEstado: EstadoOrden) => {
    if (!user || !selectedOrden) return;

    // REINGENIERIA: Confirmar OC — directo sin modal separado
    if (nuevoEstado === 'confirmada') {
      try {
        setIsSubmitting(true);
        if (!selectedOrden.almacenDestino) {
          toast.error('Esta OC no tiene destino asignado. Edítala y selecciona el almacén en Perú (si el proveedor entrega directo) o la casilla del viajero/courier.');
          setIsSubmitting(false);
          return;
        }
        const result = await confirmarOC(selectedOrden.id, selectedOrden.almacenDestino, user.uid);
        await refreshSelectedOrden(selectedOrden.id);
        setIsDetailsModalOpen(false);
        toast.success(`OC confirmada: ${result.unidadesCreadas} unidades pedidas creadas`);
      } catch (error: any) {
        toast.error(error.message, 'Error al confirmar OC');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // S38-011: Despachar OC — abrir modal custom con autocomplete de courier
    const estadosDespacho: EstadoOrden[] = ['en_proceso', 'en_transito', 'enviada', 'despachada'];
    if (estadosDespacho.includes(nuevoEstado)) {
      const tituloEstado = nuevoEstado === 'en_transito' ? 'Marcar en Tránsito'
        : nuevoEstado === 'despachada' ? 'Marcar Despachada'
        : nuevoEstado === 'enviada' ? 'Marcar Enviada'
        : 'Marcar En Proceso';
      // Abre el modal custom — la lógica de submit ocurre en handleDespacharSubmit
      setDespacharCtx({ estadoTarget: nuevoEstado, titulo: tituloEstado });
      return;
    }

    // Otros estados (cancelada, etc.)
    {
      try {
        await cambiarEstadoOrden(selectedOrden.id, nuevoEstado, user.uid);
        await refreshSelectedOrden(selectedOrden.id);
        setIsDetailsModalOpen(false);
        toast.success(`Estado actualizado a: ${nuevoEstado}`);
      } catch (error: any) {
        toast.error(error.message, 'Error');
      }
    }
  };

  // S38-011: Submit del modal de despacho (autocomplete + crear inline)
  const handleDespacharSubmit = async (result: DespacharOCResult) => {
    if (!user || !selectedOrden || !despacharCtx) return;
    let courierColaboradorIdFinal = result.courierColaboradorId;

    // Si el modal pidió crear nuevo colaborador, hacerlo aquí (caller)
    if (!courierColaboradorIdFinal && result.crearNuevoColaborador) {
      try {
        const { colaboradorService } = await import('../../services/colaborador.service');
        const { tipo, nombre } = result.crearNuevoColaborador;
        const pais = tipo === 'transportista_local' ? 'Peru' : (selectedOrden.paisOrigen || 'USA');
        courierColaboradorIdFinal = await colaboradorService.crear(
          { nombre, tipo, estado: 'activo', pais } as any,
          user.uid
        );
        await fetchColaboradores();
        toast.success(`Courier "${nombre}" agregado a Red Logística`);
      } catch (err: any) {
        toast.error(`Error creando courier: ${err.message}`);
        return;
      }
    }

    try {
      await cambiarEstadoOrden(selectedOrden.id, despacharCtx.estadoTarget, user.uid, {
        numeroTracking: result.numeroTracking,
        courier: result.courierNombre,
        courierColaboradorId: courierColaboradorIdFinal,
        fechaDespacho: result.fechaDespacho,
      });
      await refreshSelectedOrden(selectedOrden.id);
      setDespacharCtx(null);
      setIsDetailsModalOpen(false);
      toast.success(`OC ${despacharCtx.titulo.toLowerCase()} — Envío activado`);
    } catch (error: any) {
      toast.error(error.message, 'Error');
    }
  };

  // Confirmar OC con sub-órdenes opcionales (llamado desde ConfirmarOCModal)
  const handleConfirmarConSubOrdenes = async (subOrdenes?: SubOrdenCompra[]) => {
    if (!user || !selectedOrden) return;
    try {
      setIsSubmitting(true);
      if (!selectedOrden.almacenDestino) {
        toast.error('Esta OC no tiene destino asignado. Edítala y selecciona el almacén en Perú (si el proveedor entrega directo) o la casilla del viajero/courier.');
        setIsSubmitting(false);
        return;
      }
      // Sub-órdenes se pasan a confirmarOC que las persiste en el batch
      const result = await confirmarOC(selectedOrden.id, selectedOrden.almacenDestino, user.uid, undefined, subOrdenes);
      await refreshSelectedOrden(selectedOrden.id);
      setIsConfirmarModalOpen(false);
      toast.success(
        `OC confirmada: ${result.unidadesCreadas} unidades pedidas${subOrdenes && subOrdenes.length > 0 ? ` + ${subOrdenes.length} envíos` : ''}`,
      );
    } catch (error: any) {
      toast.error(error.message, 'Error al confirmar OC');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Registrar pago
  const [subOrdenPago, setSubOrdenPago] = useState<string | null>(null);

  const handleRegistrarPago = () => {
    if (!selectedOrden) return;
    setSubOrdenPago(null);
    setIsPagoModalOpen(true);
  };

  const handlePagarSubOrden = (subOrdenId: string) => {
    if (!selectedOrden) return;
    setSubOrdenPago(subOrdenId);
    setIsPagoModalOpen(true);
  };

  const handleSubmitPago = async (datos: PagoUnificadoResult) => {
    if (!user || !selectedOrden) return;

    try {
      setIsSubmitting(true);
      await registrarPago(selectedOrden.id, {
        fechaPago: datos.fechaPago,
        monedaPago: datos.monedaPago,
        montoOriginal: datos.montoOriginal,
        tipoCambio: datos.tipoCambio,
        metodoPago: datos.metodoPago as any,
        cuentaOrigenId: datos.cuentaOrigenId,
        referencia: datos.referencia,
        notas: datos.notas,
        subOrdenId: subOrdenPago || undefined
      }, user.uid);

      const simbolo = datos.monedaPago === 'USD' ? '$' : 'S/';
      toast.success(`Pago de ${simbolo} ${datos.montoOriginal.toFixed(2)} registrado exitosamente`);
      setIsPagoModalOpen(false);

      // Recargar órdenes para ver actualización
      await fetchOrdenes();
      refreshSelectedOrden(selectedOrden.id);
    } catch (error: any) {
      toast.error(`Error al registrar pago: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // S40: handlers de recepción directa eliminados — flujo canónico es vía Envíos (ver EnviosDeOC).
  // Los handlers legacy (handleRecibirOrden, handleRecibirSubOrden, handleSubmitRecepcion,
  // handleRevertirRecepciones) y su estado (subOrdenRecepcion, isRecepcionModalOpen) fueron
  // removidos junto con RecepcionParcialModal.tsx.

  // Eliminar orden
  const handleDelete = async (orden: OrdenCompra) => {
    const confirmed = await confirm({
      title: 'Eliminar Orden',
      message: `¿Eliminar la orden ${orden.numeroOrden}? Esta accion no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      await deleteOrden(orden.id);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getEstadoLabel = (estado: EstadoOrden): string => {
    const labels: Record<string, string> = {
      borrador: 'Borrador',
      confirmada: 'Confirmada',
      en_proceso: 'En Proceso',
      despachada: 'Despachada',
      completada: 'Completada',
      cancelada: 'Cancelada',
      // Legacy (backward compat)
      enviada: 'Confirmada',
      en_transito: 'En Proceso',
      recibida_parcial: 'Despachada',
      recibida: 'Completada',
      pagada: 'Pagada',
    };
    return labels[estado] || estado;
  };

  const getEstadoVariant = (estado: EstadoOrden): StatusVariant => {
    const map: Record<string, StatusVariant> = {
      borrador: 'neutral',
      confirmada: 'info',
      en_proceso: 'warning',
      despachada: 'warning',
      completada: 'success',
      cancelada: 'danger',
      // Legacy
      enviada: 'info',
      en_transito: 'warning',
      recibida_parcial: 'warning',
      recibida: 'success',
      pagada: 'brand',
    };
    return map[estado] ?? 'neutral';
  };

  return (
    <PageShell>
      {/* Header */}
      <PageHeader
        title="Compras"
        subtitle="Órdenes de compra y proveedores"
        icon={Package}
        actions={
          <div className="flex items-center gap-2">
            {/* S42 Tanda 10 — Search global (mockup líneas 116-125) */}
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={busquedaGlobal}
                onChange={(e) => setBusquedaGlobal(e.target.value)}
                placeholder="Buscar OC, proveedor, número..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 w-60"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportService.exportOrdenesCompra(ordenes)}
              disabled={ordenesLN.length === 0}
            >
              <Download className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsWizardV2Open(true)}
              disabled={proveedoresActivos.length === 0}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Nueva OC</span>
              <span className="sm:hidden">Nueva</span>
            </Button>
          </div>
        }
      />

      {/* Alerta si no hay proveedores */}
      {proveedoresActivos.length === 0 && (
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-amber-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-slate-900">No hay proveedores registrados</p>
                <p className="text-sm text-slate-600">Crea proveedores desde el Gestor de Maestros antes de hacer órdenes de compra.</p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/maestros')}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Ir a Maestros
            </Button>
          </div>
        </Card>
      )}

      {/* S42 Tanda 10 — KPIs alineados al mockup (líneas 128-178): Total · Valor · Borradores · En curso · Por pagar · Completadas */}
      {stats && (
        <KPIBar columns={6}>
          <StatCard
            label="Total OCs"
            value={stats.totalOrdenes}
            icon={Package}
            variant="neutral"
            subtitle="este mes"
          />
          <StatCard
            label="Valor total"
            value={`$${stats.valorTotalUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            icon={DollarSign}
            variant="info"
            subtitle="USD"
          />
          <StatCard
            label="Borradores"
            value={stats.borradores}
            icon={Edit3}
            variant="neutral"
            subtitle="sin confirmar"
            onClick={() => setFiltroEstado(filtroEstado === 'borrador' ? null : 'borrador')}
            active={filtroEstado === 'borrador'}
          />
          <StatCard
            label="En curso"
            value={stats.enviadas + stats.pagadas + stats.enTransito + (stats.recibidasParcial || 0)}
            icon={TrendingUp}
            variant="warning"
            subtitle={statsExtra.enviosActivosVinculados > 0
              ? `${statsExtra.enviosActivosVinculados} envíos activos`
              : 'envíos en tránsito / parcial'}
          />
          <StatCard
            label="Por pagar"
            value={statsExtra.ocsConPagoPendiente}
            icon={CreditCard}
            variant="danger"
            subtitle={statsExtra.montoPendienteUSD > 0
              ? `$${statsExtra.montoPendienteUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pendiente`
              : 'sin pagos pendientes'}
          />
          <StatCard
            label="Completadas"
            value={stats.recibidas}
            icon={CheckCircle}
            variant="success"
            subtitle={statsExtra.montoCompletadasUSD > 0
              ? `$${statsExtra.montoCompletadasUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : 'todos los envíos recibidos'}
          />
        </KPIBar>
      )}

      {/* Pipeline Opción B (S41) — 4 etapas Borrador → Confirmada → En Despacho → Completada */}
      <PipelineCompras
        stages={pipelineComprasStages}
        activeStage={filtroEstado as EstadoPipelineCompras | null}
        onStageClick={(s) => setFiltroEstado(s)}
        totalOCs={ordenesLN.length}
      />

      {/* S42 Tanda 10 — Pills filtros rápidos + dropdowns (mockup líneas 236-250) */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">Filtrar:</span>
        <button
          type="button"
          onClick={() => setPillFiltro('todas')}
          className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
            pillFiltro === 'todas'
              ? 'bg-teal-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Todas <span className="ml-1 opacity-75">({ordenesLN.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setPillFiltro('activas')}
          className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
            pillFiltro === 'activas'
              ? 'bg-teal-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Activas ({statsExtra.countActivas})
        </button>
        <button
          type="button"
          onClick={() => setPillFiltro('completadas')}
          className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
            pillFiltro === 'completadas'
              ? 'bg-teal-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Completadas ({statsExtra.countCompletadas})
        </button>
        <span className="text-slate-300 mx-1">|</span>
        <select
          value={filtroProveedor}
          onChange={(e) => setFiltroProveedor(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          <option value="">Todos los proveedores</option>
          {proveedoresActivos.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <select
          value={filtroEstadoPago}
          onChange={(e) => setFiltroEstadoPago(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          <option value="">Todos los estados de pago</option>
          <option value="pendiente">Pendiente</option>
          <option value="parcial">Parcial</option>
          <option value="pagado">Pagado</option>
        </select>
        {/* S42al — Dropdown de líneas de negocio (mockup S40 L248-250) */}
        <select
          value={lineaFiltroGlobal ?? ''}
          onChange={(e) => setLineaFiltroGlobal(e.target.value || null)}
          className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          <option value="">Todas las líneas</option>
          {lineasActivas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        {(pillFiltro !== 'todas' ||
          filtroProveedor ||
          filtroEstadoPago ||
          lineaFiltroGlobal ||
          busquedaGlobal) && (
          <button
            type="button"
            onClick={() => {
              setPillFiltro('todas');
              setFiltroProveedor('');
              setFiltroEstadoPago('');
              setLineaFiltroGlobal(null);
              setBusquedaGlobal('');
            }}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Limpiar filtros
          </button>
        )}
        {/* S42am — Toggle vista tabla/card inline (mockup S40 L251-254).
             Reemplaza el <Toolbar> separado que mostraba "N resultados" duplicando
             los pills "Todas (N)". */}
        <div className="flex items-center gap-1 ml-2 border-l border-slate-200 pl-2">
          <button
            type="button"
            onClick={() => setViewMode('card')}
            title="Vista tarjetas"
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'card'
                ? 'bg-slate-200 text-slate-900'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            title="Vista tabla"
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'table'
                ? 'bg-slate-200 text-slate-900'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lista de Ordenes */}
      {viewMode === 'table' ? (
        <Card padding="none">
          <OrdenCompraTable
            ordenes={ordenesFiltradas}
            onView={handleViewDetails}
            onEdit={handleEditOrden}
            onDelete={handleDelete}
            loading={loading}
          />
        </Card>
      ) : (
        // S42al — Container con bg-slate-50 + padding para que las cards
        // blancas contrasten visualmente (mockup S40 L258: `bg-slate-50 p-6 space-y-3`).
        <div className="bg-slate-50 rounded-xl p-4 md:p-5 space-y-3 border border-slate-100">
          {ordenesFiltradas.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg py-16 text-center">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">Sin resultados</p>
              <p className="text-xs text-slate-500 mt-1">
                No se encontraron órdenes de compra.
              </p>
            </div>
          ) : (
            <>
              {ordenesFiltradas.slice(0, itemsVisibles).map((orden) => (
                <CompraCard
                  key={orden.id}
                  orden={orden}
                  enviosAsociados={enviosPorOCIndex.get(orden.id) ?? []}
                  onView={() => handleViewDetails(orden)}
                  onRegistrarPago={() => {
                    setSelectedOrdenLocal(orden);
                    setSubOrdenPago(null);
                    setIsPagoModalOpen(true);
                  }}
                  onRegistrarPagoSubOrden={(subOrdenId) => {
                    setSelectedOrdenLocal(orden);
                    setSubOrdenPago(subOrdenId);
                    setIsPagoModalOpen(true);
                  }}
                  onVerSubOrden={(subOrdenId) =>
                    setSubOrdenDetalle({ ordenId: orden.id, subOrdenId })
                  }
                  onVerEnvio={(envioId) => navigate(`/envios?envioId=${envioId}`)}
                  onVerEnvios={() => navigate(`/envios?ordenCompraId=${orden.id}`)}
                />
              ))}
              {/* S42 Tanda 10 — Footer "Cargar más" (mockup líneas 478-481) */}
              {ordenesFiltradas.length > itemsVisibles && (
                <div className="pt-2 text-center">
                  <span className="text-xs text-slate-500">
                    + {ordenesFiltradas.length - itemsVisibles} OCs más ·{' '}
                  </span>
                  <button
                    type="button"
                    onClick={() => setItemsVisibles((n) => n + 10)}
                    className="text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline"
                  >
                    Cargar más
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal Nueva Orden */}
      {isOrdenModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop - click para cerrar */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCloseOrdenModal}
          />

          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header con X para cerrar */}
              <div className="flex-shrink-0 bg-white z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 rounded-t-lg">
                <h3 className="text-xl font-semibold text-slate-900">
                  {isEditMode && ordenEditando
                    ? `Editar Orden ${ordenEditando.numeroOrden}`
                    : creandoMultiOC && multiViajeroData
                      ? `Nueva OC para ${multiViajeroData.asignaciones[currentViajeroIndex]?.viajeroNombre} (${viajerosCompletados + 1}/${totalViajerosOriginal})`
                      : initialFormData?.requerimientoNumero
                        ? `Nueva OC desde ${initialFormData.requerimientoNumero}`
                        : "Nueva Orden de Compra"
                  }
                </h3>
                <button
                  type="button"
                  onClick={handleCloseOrdenModal}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content - scrollable area */}
              <div className="p-6 overflow-y-auto flex-1 min-h-0">
                {/* Banner de progreso multi-viajero */}
                {creandoMultiOC && multiViajeroData && totalViajerosOriginal > 0 && (
                  <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Package className="h-5 w-5 text-purple-600 mr-2" />
                        <span className="font-medium text-purple-900">
                          Creando OC {viajerosCompletados + 1} de {totalViajerosOriginal}
                        </span>
                      </div>
                      <span className="text-sm text-purple-600">
                        Viajero: {multiViajeroData.asignaciones[currentViajeroIndex]?.viajeroNombre}
                      </span>
                    </div>
                    <div className="mt-2 w-full bg-purple-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${((viajerosCompletados + 1) / totalViajerosOriginal) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <OrdenCompraForm
                  key={isEditMode ? ordenEditando?.id : (initialFormData?.viajero?.id || 'default')}
                  proveedores={proveedoresActivos}
                  productos={productos}
                  onSubmit={isEditMode ? handleUpdateOrden : handleCreateOrden}
                  onCancel={handleCloseOrdenModal}
                  loading={isSubmitting}
                  tcSugerido={initialFormData?.tcSugerido || tcSugerido}
                  initialProductos={initialFormData?.productos}
                  requerimientoId={initialFormData?.requerimientoId}
                  requerimientoNumero={initialFormData?.requerimientoNumero}
                  requerimientoIds={initialFormData?.requerimientoIds}
                  requerimientoNumeros={initialFormData?.requerimientoNumeros}
                  clientesOrigen={initialFormData?.clientesOrigen}
                  productosOrigen={initialFormData?.productosOrigen}
                  initialViajero={initialFormData?.viajero}
                  isEditMode={isEditMode}
                  ordenEditar={ordenEditando ? {
                    id: ordenEditando.id,
                    numeroOrden: ordenEditando.numeroOrden,
                    proveedorId: ordenEditando.proveedorId,
                    nombreProveedor: ordenEditando.nombreProveedor,
                    almacenDestino: ordenEditando.almacenDestino || '',
                    productos: ordenEditando.productos.map(p => ({
                      productoId: p.productoId,
                      sku: p.sku,
                      marca: p.marca,
                      nombreComercial: p.nombreComercial,
                      presentacion: p.presentacion,
                      cantidad: p.cantidad,
                      costoUnitario: p.costoUnitario
                    })),
                    subtotalUSD: ordenEditando.subtotalUSD,
                    impuestoCompraUSD: ordenEditando.impuestoCompraUSD,
                    costoEnvioProveedorUSD: ordenEditando.costoEnvioProveedorUSD,
                    otrosGastosCompraUSD: ordenEditando.otrosGastosCompraUSD,
                    descuentoUSD: ordenEditando.descuentoUSD,
                    totalUSD: ordenEditando.totalUSD,
                    tcCompra: ordenEditando.tcCompra || 0,
                    numeroTracking: ordenEditando.numeroTracking,
                    courier: ordenEditando.courier,
                    observaciones: ordenEditando.observaciones
                  } as any : undefined}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalles de Orden */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="Detalles de Orden"
        size="full"
      >
        {selectedOrden && (
          <OrdenCompraCard
            orden={selectedOrden}
            onCambiarEstado={handleCambiarEstado}
            onConfirmarConSubOrdenes={handleConfirmarConSubOrdenes}
            // S42aq — Flujo de confirmación unificado: el banner CTA abre
            // el ConfirmarOCModal separado (con tabla asignación + validación)
            onSolicitarConfirmacion={() => setIsConfirmarModalOpen(true)}
            onRegistrarPago={handleRegistrarPago}
            onPagarSubOrden={handlePagarSubOrden}
            onRefresh={() => { fetchOrdenes(); if (selectedOrden) refreshSelectedOrden(selectedOrden.id); }}
          />
        )}
      </Modal>

      {/* Modal Registrar Pago */}
      {isPagoModalOpen && selectedOrden && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            {(() => {
              const subOrdenActiva = subOrdenPago
                ? selectedOrden.subOrdenes?.find(s => s.id === subOrdenPago)
                : undefined;
              const montoTotal = subOrdenActiva ? subOrdenActiva.totalUSD : selectedOrden.totalUSD;
              // DATA-001: para pago de OC completa, NO filtrar por subOrdenId — todos los
              // pagos (sub-orden o completa) cuentan contra el total de la OC. Sólo cuando
              // se paga una sub-orden específica filtramos por su subOrdenId.
              const pagosRelevantes = (selectedOrden.historialPagos || []).filter(p =>
                subOrdenPago ? p.subOrdenId === subOrdenPago : true
              );
              const yaPagado = pagosRelevantes.reduce((s, p) => s + p.montoUSD, 0);
              const pendiente = montoTotal - yaPagado;

              // S41 Bloque 5 — Destinatario del pago: colaborador si adelantó, proveedor en caso contrario
              const esDeudorAlternativo =
                selectedOrden.deudorTipo === 'colaborador' && !!selectedOrden.deudorId;
              const destinatarioPago = esDeudorAlternativo
                ? {
                    id: selectedOrden.deudorId!,
                    nombre: selectedOrden.deudorNombre || 'Colaborador',
                    tipo: 'colaborador' as const,
                    proveedorOriginalNombre: selectedOrden.nombreProveedor,
                  }
                : {
                    id: selectedOrden.proveedorId,
                    nombre: selectedOrden.nombreProveedor,
                    tipo: 'proveedor' as const,
                  };

              return (
                <PagoUnificadoForm
                  origen="orden_compra"
                  titulo={subOrdenActiva
                    ? `Pago Sub-orden — ${subOrdenActiva.referenciaProveedor || subOrdenActiva.id}`
                    : `Pago ${selectedOrden.numeroOrden}`}
                  montoTotal={montoTotal}
                  montoPendiente={Math.max(0, pendiente)}
                  monedaOriginal="USD"
                  tcDocumento={selectedOrden.tcPago || selectedOrden.tcCompra}
                  pagosAnteriores={pagosRelevantes.map(p => ({
                    id: p.id,
                    fecha: p.fecha?.toDate?.() || new Date(),
                    monto: p.montoUSD,
                    moneda: 'USD',
                    metodo: p.metodoPago,
                    referencia: p.referencia,
                  }))}
                  destinatario={destinatarioPago}
                  onSubmit={handleSubmitPago}
                  onCancel={() => { setIsPagoModalOpen(false); setSubOrdenPago(null); }}
                  loading={isSubmitting}
                />
              );
            })()}
          </div>
        </div>
      )}

      {/* S40: Modal Recepción Parcial eliminado — la recepción se gestiona desde el Envío asociado (ver EnviosDeOC en OrdenCompraCard) */}

      {/* Modal Confirmar OC — S42ar: montaje condicional (isOpen debe ser true
          para instanciar el componente). ConfirmarOCModal.tsx tiene hooks
          useMemo después de `if (!isOpen) return null`, lo que viola las reglas
          de hooks cuando isOpen cambia en un componente ya montado. Al montar
          solo cuando realmente se abre, se evita ese caso. */}
      {selectedOrden && isConfirmarModalOpen && (
        <ConfirmarOCModal
          isOpen={true}
          onClose={() => setIsConfirmarModalOpen(false)}
          orden={selectedOrden}
          onConfirmar={handleConfirmarConSubOrdenes}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Dialogo de Confirmacion */}
      <ConfirmDialog {...dialogProps} />

      {/* Modal de Acciones con campos */}
      <ActionModal {...actionModalProps} />

      {/* Wizard V3 — Rework S41: Ruta → Productos → Cargos → Inteligencia → Confirmar */}
      <OCWizardV3
        isOpen={isWizardV2Open}
        onClose={() => setIsWizardV2Open(false)}
        onSubmit={handleCreateOrden}
        isSubmitting={isSubmitting}
      />

      {/* S38-011: Modal Despachar OC con autocomplete inteligente de courier */}
      {despacharCtx && selectedOrden && (
        <DespacharOCModal
          isOpen={true}
          onClose={() => setDespacharCtx(null)}
          orden={selectedOrden}
          tituloEstado={despacharCtx.titulo}
          colaboradores={colaboradores}
          onConfirm={handleDespacharSubmit}
        />
      )}

      {/* S41 Tanda 6 — Modal Detalle sub-orden standalone */}
      {subOrdenDetalle && (() => {
        const orden = ordenes.find((o) => o.id === subOrdenDetalle.ordenId);
        if (!orden) return null;
        const subOrden = orden.subOrdenes?.find(
          (s) => s.id === subOrdenDetalle.subOrdenId
        );
        if (!subOrden) return null;
        const envioVinculado = subOrden.envioId
          ? envios.find((e) => e.id === subOrden.envioId)
          : null;

        return (
          <SubOrdenDetailModal
            isOpen={true}
            orden={orden}
            subOrden={subOrden}
            envio={envioVinculado ?? null}
            onClose={() => setSubOrdenDetalle(null)}
            onBackToOC={() => {
              setSubOrdenDetalle(null);
              handleViewDetails(orden);
            }}
            onRegistrarPago={() => {
              setSelectedOrdenLocal(orden);
              setSubOrdenPago(subOrden.id);
              setIsPagoModalOpen(true);
              setSubOrdenDetalle(null);
            }}
          />
        );
      })()}
    </PageShell>
  );
};