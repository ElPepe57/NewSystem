import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Package, DollarSign, AlertCircle, Download, ExternalLink, FileText, Send, Truck, CheckCircle, XCircle, CreditCard, PackageCheck, Calendar, Building2, Search, ShoppingCart, LayoutDashboard, ClipboardList, BrainCircuit } from 'lucide-react';
import { Button, Card, Modal, useConfirmDialog, ConfirmDialog, useActionModal, ActionModal } from '../../components/common';
// chk5.COMERCIALES-F1 · Compras re-construido como hub del kit (grupo Comercial = blue)
import { HubShell, HubTopBar, HubHeader, HubKpiStrip, HubTabs, HubBody } from '../../design-system';
import type { StatusVariant, HubTab, HubKpi } from '../../design-system';
import { useToastStore } from '../../store/toastStore';
// S53.9 — OrdenCompraForm + OrdenCompraTable ELIMINADOS (legacy).
// Toda la creacion/edicion de OC pasa por OCWizardV3. Lista en tarjetas unicamente.
import { OrdenCompraCard } from '../../components/modules/ordenCompra/OrdenCompraCard';
import { OCWizardV3 } from '../../components/modules/ordenCompra/OCWizardV3/OCWizardV3';
import { CompraCard } from '../../components/modules/ordenCompra/CompraCard';
import { PipelineCompras } from '../../components/modules/ordenCompra/PipelineCompras';
import type { EstadoPipelineCompras, PipelineComprasStage } from '../../components/modules/ordenCompra/PipelineCompras';
import { SubOrdenDetailModal } from '../../components/modules/ordenCompra/SubOrdenDetailModal';
import { TabResumenCompras } from './components/TabResumenCompras';
import { TabPendientesCompras } from './components/TabPendientesCompras';
import { OCBuilder } from '../../components/modules/ordenCompra/OCBuilder/OCBuilder';
import { useRequerimientoStore } from '../../store/requerimientoStore';
import type { Requerimiento } from '../../types/requerimiento.types';
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
import { hasRole } from '../../types/auth.types';
import { useColaboradorStore } from '../../store/colaboradorStore';
import { exportService } from '../../services/export.service';
import type { OrdenCompra, OrdenCompraFormData, EstadoOrden } from '../../types/ordenCompra.types';
import { useLineaFilter } from '../../hooks/useLineaFilter';
// S55 Fase 2 — pagos viven en CC; hook reactivo lee desde movimientosCC
import { usePagosOC } from '../../hooks/usePagosOC';
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
  const userProfile = useAuthStore((s) => s.userProfile);
  const esAdmin = hasRole(userProfile, 'admin'); // canon "admin ve todo" · chip contextual al rol
  const toast = useToastStore();
  const { productos, fetchProductos } = useProductoStore();
  const { getTCDelDia } = useTipoCambioStore();
  const { requerimientos, fetchRequerimientos } = useRequerimientoStore();
  const loadingReqs = useRequerimientoStore((s) => s.loading);
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
  // S53.9 — viewMode eliminado. Vista de tarjetas es la única opción.
  const [isWizardV2Open, setIsWizardV2Open] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isPagoModalOpen, setIsPagoModalOpen] = useState(false);
  const [isConfirmarModalOpen, setIsConfirmarModalOpen] = useState(false);
  // S38-011: estado para el modal custom de despacho
  const [despacharCtx, setDespacharCtx] = useState<{ estadoTarget: EstadoOrden; titulo: string } | null>(null);
  const [selectedOrden, setSelectedOrdenLocal] = useState<OrdenCompra | null>(null);
  // S55 Fase 2 — Pagos de la OC seleccionada (CC). Reemplaza orden.historialPagos.
  const { pagos: pagosOCSeleccionada } = usePagosOC(selectedOrden?.id ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null);
  // chk5.COMERCIALES-F1 · tab activa del hub · default 'ordenes' hasta que la Fase 1b construya el Resumen §A→§F
  const [tabActiva, setTabActiva] = useState<'resumen' | 'ordenes' | 'pendientes' | 'proveedores' | 'inteligencia'>('resumen');
  const [isOCBuilderOpen, setIsOCBuilderOpen] = useState(false);
  const [ocBuilderReqs, setOcBuilderReqs] = useState<Requerimiento[]>([]);
  // S42 Tanda 10 — Filtros adicionales vista Compras (mockup s40 líneas 235-254)
  const [busquedaGlobal, setBusquedaGlobal] = useState('');
  const [pillFiltro, setPillFiltro] = useState<'todas' | 'activas' | 'completadas'>('todas');
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [filtroEstadoPago, setFiltroEstadoPago] = useState('');
  const [itemsVisibles, setItemsVisibles] = useState(10);
  // Estado para edición
  const [ordenEditando, setOrdenEditando] = useState<OrdenCompra | null>(null);
  // S53.9 — isEditMode eliminado. El wizard detecta edicion por presencia de `ordenEditar`.

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
        // S55 Fase 2 — usamos `montoPendiente` denormalizado (mantenido por
        // ordenCompra.pagos.service al registrar pagos). Si no está, asumimos
        // total pendiente. Para detalle de pagos individuales se consulta CC.
        const tcRef = o.tcReferencial || o.tcCompra || 1;
        const pendiente = o.montoPendiente
          ? o.montoPendiente / tcRef
          : (o.totalUSD || 0);
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

  // Lazy: cargar requerimientos al abrir la tab Pendientes (chk5.COMERCIALES-F3a)
  useEffect(() => {
    if (tabActiva === 'pendientes' && requerimientos.length === 0) {
      fetchRequerimientos().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActiva]);

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
      setIsWizardV2Open(true);

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
        setIsWizardV2Open(true);
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
      setIsWizardV2Open(true);
      window.history.replaceState({}, document.title);
    }
  }, [fromMultipleRequerimientos, proveedoresActivos]);

  // Crear orden (o editar si ordenEditando está seteado — S53.9)
  const handleCreateOrden = async (data: OrdenCompraFormData) => {
    if (!user) return;

    // S53.9 — Modo edición: OCWizardV3 llamó onSubmit y ordenEditando está seteado.
    // En vez de crear una OC nueva, actualizamos la existente con update().
    if (ordenEditando) {
      setIsSubmitting(true);
      try {
        await updateOrden(ordenEditando.id, data, user.uid);
        toast.success('Orden actualizada correctamente');
        setIsWizardV2Open(false);
        setOrdenEditando(null);
        await fetchOrdenes();
      } catch (error: any) {
        console.error('Error al actualizar orden:', error);
        toast.error(error.message, 'Error');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

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
          setIsWizardV2Open(false);
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
        setIsWizardV2Open(false);
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
      setIsWizardV2Open(false);
      setInitialFormData(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // S53.9 — Cerrar wizard y limpiar datos iniciales. Reemplaza el handleCloseOrdenModal
  // legacy que cerraba el modal de OrdenCompraForm. Ahora cierra el OCWizardV3.
  const handleCloseOrdenModal = () => {
    setIsWizardV2Open(false);
    setInitialFormData(null);
    setOrdenEditando(null);
    // Limpiar datos de multi-viajero si estaba en ese modo
    if (creandoMultiOC) {
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

  // chk5.C-FIX · B4.1 · cross-link desde Gastos · lee ?highlight=ID y abre modal detalle
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightHandledRef = useRef<string | null>(null);
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (!highlightId) return;
    if (highlightHandledRef.current === highlightId) return; // ya procesado
    if (loading || ordenes.length === 0) return; // esperar a que cargue
    const oc = ordenes.find(o => o.id === highlightId);
    if (oc) {
      setSelectedOrdenLocal(oc);
      setIsDetailsModalOpen(true);
      highlightHandledRef.current = highlightId;
      // Limpia el param de la URL para que back/refresh no re-dispare el modal
      const next = new URLSearchParams(searchParams);
      next.delete('highlight');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, ordenes, loading, setSearchParams]);

  // Editar orden (solo permitido en estado borrador) — S53.9: abre OCWizardV3
  // con el prop `ordenEditar` que pre-carga todos los datos.
  const handleEditOrden = (orden: OrdenCompra) => {
    if (orden.estado !== 'borrador') {
      toast.warning('Solo se pueden editar órdenes en estado Borrador');
      return;
    }
    setIsDetailsModalOpen(false);
    setOrdenEditando(orden);
    setIsWizardV2Open(true);
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

  // chk5.COMERCIALES-F1 · derivados del hub (tabs · KPI strip semántico · breadcrumb)
  const comprasTabs: HubTab[] = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { id: 'ordenes', label: 'Órdenes', icon: Package },
    { id: 'pendientes', label: 'Pendientes', icon: ClipboardList },
    { id: 'proveedores', label: 'Proveedores', icon: Building2 },
    { id: 'inteligencia', label: 'Inteligencia', icon: BrainCircuit },
  ];
  const breadcrumbLeaf = tabActiva === 'resumen' ? null : (comprasTabs.find((t) => t.id === tabActiva)?.label ?? null);
  const comprasKpis: HubKpi[] = stats ? [
    { label: 'Comprado mes', valor: `$ ${stats.valorTotalUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, tono: 'amber', icon: DollarSign, delta: `${stats.totalOrdenes} OCs este mes` },
    { label: 'Borradores', valor: String(stats.borradores), tono: 'slate', icon: FileText, delta: 'sin confirmar' },
    { label: 'En curso', valor: String(stats.enviadas + stats.pagadas + stats.enTransito + (stats.recibidasParcial || 0)), tono: 'sky', icon: Truck, delta: statsExtra.enviosActivosVinculados > 0 ? `${statsExtra.enviosActivosVinculados} envíos activos` : 'en tránsito / parcial' },
    { label: 'Por pagar', valor: String(statsExtra.ocsConPagoPendiente), tono: 'rose', icon: CreditCard, delta: statsExtra.montoPendienteUSD > 0 ? `$${statsExtra.montoPendienteUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })} pendiente` : 'al día' },
    { label: 'Completadas', valor: String(stats.recibidas), tono: 'emerald', icon: CheckCircle, delta: statsExtra.montoCompletadasUSD > 0 ? `$${statsExtra.montoCompletadasUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : 'recibidas' },
  ] : [];

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
      <HubShell>
        <HubTopBar grupo="comercial" modulo="Compras" leaf={breadcrumbLeaf} esAdmin={esAdmin} onModulo={() => setTabActiva('resumen')} />
        <HubHeader
          grupo="comercial"
          icon={ShoppingCart}
          titulo="Compras"
          subtitulo="Órdenes de compra · proveedores · recepción · pagos · inteligencia de precios"
          acciones={[
            { label: 'Exportar', icon: Download, onClick: () => exportService.exportOrdenesCompra(ordenes), tier: 'neutral', disabled: ordenesLN.length === 0 },
            { label: 'Nueva OC', icon: Plus, onClick: () => setIsWizardV2Open(true), tier: 'primary', disabled: proveedoresActivos.length === 0 },
          ]}
        />
        {stats && <HubKpiStrip cols={5} kpis={comprasKpis} />}
        <HubTabs grupo="comercial" tabs={comprasTabs} activa={tabActiva} onChange={(id) => setTabActiva(id as typeof tabActiva)} />
        <HubBody flush>

        {/* ═══ TAB ÓRDENES · pipeline + filtros + listado (contenido operativo) ═══ */}
        {tabActiva === 'ordenes' && (
        <div className="p-4 sm:p-6 space-y-4">
          {/* Buscador (movido del header) */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={busquedaGlobal}
              onChange={(e) => setBusquedaGlobal(e.target.value)}
              placeholder="Buscar OC, proveedor, número…"
              className="w-full pl-9 pr-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

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

      {/* KPIs movidos al HubKpiStrip persistente del shell · chk5.COMERCIALES-F1 */}

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
        {/* S53.9 — Toggle viewMode ELIMINADO. Vista de tarjetas es la unica. */}
      </div>

      {/* Lista de Ordenes — vista de tarjetas unicamente (S53.9) */}
      {(
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
        </div>
        )}

        {/* ═══ TAB RESUMEN · dashboard ejecutivo §A→§F (no clona el strip) ═══ */}
        {tabActiva === 'resumen' && (
          <TabResumenCompras
            ordenes={ordenesLN}
            stats={stats}
            statsExtra={statsExtra}
            tcHoy={tcSugerido}
            onNuevaOC={() => setIsWizardV2Open(true)}
            onIrTab={(tab) => setTabActiva(tab)}
            onFiltrarEstado={(estado) => {
              setTabActiva('ordenes');
              if (estado === '__por_pagar__') { setFiltroEstadoPago('pendiente'); }
              else { setFiltroEstado(estado); }
            }}
            onVerOC={(oc) => { setSelectedOrdenLocal(oc); setIsDetailsModalOpen(true); }}
            navigate={navigate}
          />
        )}

        {/* ═══ TAB PENDIENTES · requerimientos aprobados → OC consolidada ═══ */}
        {tabActiva === 'pendientes' && (
          <TabPendientesCompras
            requerimientos={requerimientos}
            loading={loadingReqs}
            onCrearOCConsolidada={(reqs) => { setOcBuilderReqs(reqs); setIsOCBuilderOpen(true); }}
            onNuevaOC={() => setIsWizardV2Open(true)}
          />
        )}

        {/* ═══ TABS EN CONSTRUCCIÓN (Proveedores · Inteligencia) · fases siguientes ═══ */}
        {(tabActiva === 'proveedores' || tabActiva === 'inteligencia') && (
          <div className="p-8 sm:p-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 mb-3 mx-auto">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              {comprasTabs.find((t) => t.id === tabActiva)?.label}
            </h3>
            <p className="text-[12px] text-slate-500 mt-1 max-w-sm mx-auto">
              Esta sección se construye en la siguiente fase del hub de Compras. Mientras tanto, opera desde{' '}
              <button type="button" onClick={() => setTabActiva('ordenes')} className="text-blue-600 font-medium hover:underline">Órdenes</button>.
            </p>
          </div>
        )}

        </HubBody>
      </HubShell>

      {/* OC Builder · consolida N requerimientos en OC(s) · motor único reusado (chk5.COMERCIALES-F3a) */}
      <OCBuilder
        isOpen={isOCBuilderOpen}
        onClose={() => { setIsOCBuilderOpen(false); setOcBuilderReqs([]); }}
        requerimientos={ocBuilderReqs}
        tcSugerido={tcSugerido}
        onComplete={(ordenesCreadas) => {
          setIsOCBuilderOpen(false);
          setOcBuilderReqs([]);
          toast.success(`${ordenesCreadas.length} OC(s) creadas exitosamente`);
          fetchOrdenes();
          fetchRequerimientos().catch(() => {});
        }}
      />

      {/* S53.9 — Modal Nueva Orden legacy ELIMINADO. La creacion/edicion vive en OCWizardV3. */}


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
            // S42av — onSolicitarConfirmacion ya no es necesario: el flujo
            // de confirmación ahora vive embedded dentro del mismo modal de
            // Detalles (ver OrdenCompraCard: vistaInterna === 'confirmar').
            onRegistrarPago={handleRegistrarPago}
            onPagarSubOrden={handlePagarSubOrden}
            onRefresh={() => { fetchOrdenes(); if (selectedOrden) refreshSelectedOrden(selectedOrden.id); }}
            // S53.9 — Editar y Eliminar solo visibles en borrador (dentro del card)
            onEditarOC={() => handleEditOrden(selectedOrden)}
            onEliminarOC={() => handleDelete(selectedOrden)}
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
              // S55 Fase 2 — Pagos vienen del hook reactivo (CC).
              // Filtramos por sub-orden vía notas (heurística por refSubDocumentoId).
              const pagosRelevantes = pagosOCSeleccionada.filter((p) =>
                subOrdenPago
                  ? (p.subOrdenId === subOrdenPago ||
                     (p.notas && p.notas.includes(`subOrdenId=${subOrdenPago}`)))
                  : true,
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

      {/* S42av — ConfirmarOCModal separado ELIMINADO. Ahora el flujo de
          confirmación se renderiza embedded dentro del modal de "Detalles de
          Orden" (ver OrdenCompraCard: vistaInterna === 'confirmar'). Esto
          evita la sensación de "modal sobre modal" y da continuidad visual. */}

      {/* Dialogo de Confirmacion */}
      <ConfirmDialog {...dialogProps} />

      {/* Modal de Acciones con campos */}
      <ActionModal {...actionModalProps} />

      {/* Wizard V3 — Rework S41: Ruta → Productos → Cargos → Inteligencia → Confirmar
           S53.9: maneja tambien edicion de OCs borrador (ordenEditando) y pre-link a
           requerimientos (initialFormData.requerimientoId/Ids/Numero/Numeros) */}
      <OCWizardV3
        isOpen={isWizardV2Open}
        onClose={() => {
          setIsWizardV2Open(false);
          setOrdenEditando(null);
          setInitialFormData(null);
        }}
        onSubmit={handleCreateOrden}
        isSubmitting={isSubmitting}
        ordenEditar={ordenEditando || undefined}
        requerimientoId={initialFormData?.requerimientoId}
        requerimientoNumero={initialFormData?.requerimientoNumero}
        requerimientoIds={initialFormData?.requerimientoIds}
        requerimientoNumeros={initialFormData?.requerimientoNumeros}
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
    </div>
  );
};