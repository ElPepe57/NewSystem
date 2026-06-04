import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
// S53 F5 — Flags legacy WIZARD_T2/J/E/I eliminados (reemplazo directo D-4).
//   F y G siguen con flag hasta T-F y T-G (migración a Ventas/Devoluciones).
import { isWizardFEnabled, isWizardGEnabled } from "../../config/features";
import {
  ArrowRightLeft,
  Truck,
  Clock,
  AlertTriangle,
  Plus,
  CheckCircle,
  DollarSign,
  RefreshCw,
  Package,
  Gavel,
  BarChart3,
  ChevronRight,
  Search,
  Download,
  LayoutDashboard,
  Landmark,
} from "lucide-react";
import { exportService } from "../../services/export.service";
import {
  Button,
  Card,
  ConfirmDialog,
  useConfirmDialog,
} from "../../components/common";
import { Toolbar, FilterDrawer, FilterSection, HubShell, HubTopBar, HubHeader, HubKpiStrip, HubTabs, HubBody } from '../../design-system';
import type { HubKpi, HubTab } from '../../design-system';
import { hasRole } from '../../types/auth.types';
import { useEnvioStore } from '../../store/envioStore';
// S55 Fase 4 — pagos al colaborador viven en CC
import { usePagosEnvio } from '../../hooks/usePagosEnvio';
import { useProductoStore } from "../../store/productoStore";
import { useAlmacenStore } from '../../store/casillaStore';
import { useAuthStore } from "../../store/authStore";
import { tesoreriaService } from "../../services/tesoreria.service";
import { useTipoCambioStore } from "../../store/tipoCambioStore";
import type {
  Envio,
  TipoEnvio,
  EstadoEnvio,
  EnvioFormData,
  RecepcionEnvioFormData,
} from "../../types/envio.types";
import type { CuentaCaja, MetodoTesoreria } from "../../types/tesoreria.types";
import { useLineaFilter } from "../../hooks/useLineaFilter";
import { useToastStore } from "../../store/toastStore";

// Sub-componentes
import { EnvioCard } from "./EnvioCard";
import { EnvioCardSimple } from "./EnvioCardSimple";
// S53 F5 · EnvioWizardV2 ELIMINADO — el wizard unificado (/envios/nuevo) lo reemplaza
// S53.26 — NuevoEnvioMenu reemplazado por un botón directo "+ Nuevo envío"
// en el PageHeader, igual al patrón de /compras (Package manager pending T-F/T-G).
import { RecepcionModal } from "./RecepcionModal";
import { PagoUnificadoForm } from '../../components/modules/pagos/PagoUnificadoForm';
import type { PagoUnificadoResult } from '../../components/modules/pagos/PagoUnificadoForm';
import { EditFleteModal } from "./EditFleteModal";
import { EnvioDetailModal } from "./EnvioDetailModal";
import type { DespacharOCResult } from '../../components/modules/ordenCompra/DespacharOCModal';
import { DespacharEnvioModal, type DespacharEnvioResult } from './DespacharEnvioModal';
import { useColaboradorStore } from '../../store/colaboradorStore';
import { useReclamoStore } from '../../store/reclamoStore';
import { TabReclamos } from './TabReclamos';
import { TabIncidencias } from './TabIncidencias';
import { TabCostosLanded } from './TabCostosLanded';
import { TabRendimiento } from './TabRendimiento';
import { TabResumenEnvios, type ResumenEnviosData } from './TabResumenEnvios';
// S47 — Modelo Envios Transversal: clasificación A-J derivada de campos existentes
import {
  deriveTipoRutaLogistica,
  contarEnviosPorTipoRuta,
  INFO_TIPO_RUTA,
  type TipoRutaLogistica,
} from '../../utils/envio.tipoRuta.helpers';

type TabEnvios = 'resumen' | 'operaciones' | 'incidencias' | 'reclamos' | 'costos' | 'rendimiento';

export const Envios: React.FC = () => {
  const [tabEnvios, setTabEnvios] = useState<TabEnvios>('resumen');
  const user = useAuthStore(state => state.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const esAdmin = hasRole(userProfile, 'admin'); // canon "admin ve todo" · chip contextual al rol
  const toast = useToastStore();
  const {
    envios,
    enviosEnTransito,
    enviosPendientesRecepcion,
    resumen,
    loading,
    fetchEnvios,
    fetchEnTransito,
    fetchPendientesRecepcion,
    fetchResumen,
    crearEnvio,
    confirmarEnvio,
    enviarEnvio,
    cancelarEnvio,
    registrarPagoColaborador,
    actualizarFlete,
    reconciliarPagoColaborador,
  } = useEnvioStore();

  const { getTCDelDia } = useTipoCambioStore();
  const [tipoCambioActual, setTipoCambioActual] = useState<{ tasaVenta: number } | null>(null);

  const {
    almacenes: todosAlmacenes,
    casillas,
    viajeros,
    fetchAlmacenes: fetchTodosAlmacenes,
    fetchAlmacenesUSA,
    fetchAlmacenesPeru,
    fetchCasillas,
    fetchViajeros,
  } = useAlmacenStore();

  // S52 — El modal clasico EnvioWizardV2 consume el tipo `Almacen` (legacy).
  // La Red Logistica nueva escribe en `casillas` (tipo Casilla). Este mapping
  // convierte Casilla → shape compatible con Almacen para que el wizard legacy
  // vea las casillas activas del usuario.
  const casillaToAlmacen = useCallback((c: typeof casillas[0]): any => ({
    id: c.id,
    codigo: c.codigo,
    nombre: c.nombre,
    pais: c.pais,
    // Mapping de tipo de casilla -> tipo de almacen legacy
    tipo:
      c.tipo === 'almacen_propio'
        ? c.pais === 'Peru' || c.pais === 'Peru_local'
          ? 'almacen_peru'
          : 'almacen_origen'
        : c.tipo === 'casilla_viajero'
          ? 'viajero'
          : c.tipo === 'punto_courier'
            ? 'courier'
            : 'almacen_origen',
    estadoAlmacen: c.estado === 'activa' ? 'activo' : 'inactivo',
    direccion: c.direccion ?? '',
    ciudad: c.ciudad ?? '',
    esViajero: c.tipo === 'casilla_viajero',
    capacidadUnidades: c.capacidadUnidades,
    unidadesActuales: c.unidadesActuales,
    totalUnidadesRecibidas: c.totalUnidadesRecibidas ?? 0,
    totalUnidadesEnviadas: c.totalUnidadesEnviadas ?? 0,
    valorInventarioUSD: c.valorInventarioUSD ?? 0,
    tiempoPromedioAlmacenamiento: 0,
    fechaCreacion: c.fechaCreacion,
    creadoPor: c.creadoPor,
  }), []);

  // Derivamos los arrays legacy desde casillas (fuente de verdad post-S42g).
  // Fallback a todosAlmacenes si no hay casillas aún (caso BD legacy pura).
  const almacenesOrigen = useMemo(() => {
    if (casillas.length > 0) {
      return casillas.filter(c => c.estado === 'activa').map(casillaToAlmacen);
    }
    return todosAlmacenes.filter(a => a.estadoAlmacen === 'activo');
  }, [casillas, todosAlmacenes, casillaToAlmacen]);
  const almacenesDestinoPeru = useMemo(() => {
    if (casillas.length > 0) {
      return casillas
        .filter(c => c.estado === 'activa' && (c.pais === 'Peru' || c.pais === 'Peru_local'))
        .map(casillaToAlmacen);
    }
    return todosAlmacenes.filter(a => a.estadoAlmacen === 'activo' && a.pais === 'Peru');
  }, [casillas, todosAlmacenes, casillaToAlmacen]);

  const { productos: todosProductos, fetchProductos } = useProductoStore();
  const productosMapGlobal = useMemo(() => {
    const map = new Map<string, typeof todosProductos[0]>();
    todosProductos.forEach(p => map.set(p.id, p));
    return map;
  }, [todosProductos]);

  // Estado de modales (S53 F5 · showCreateModal eliminado — ahora /envios/nuevo)
  const [showRecepcionModal, setShowRecepcionModal] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [envioParaRecepcion, setEnvioParaRecepcion] = useState<Envio | null>(null);
  const [envioParaPago, setEnvioParaPago] = useState<Envio | null>(null);
  // S55 Fase 4 — Pagos del envío en pago (CC). Reemplaza envio.pagosColaborador[].
  const { pagos: pagosEnvioParaPago } = usePagosEnvio(envioParaPago?.id ?? null);
  const [selectedEnvio, setSelectedEnvio] = useState<Envio | null>(null);
  const [showEditFleteModal, setShowEditFleteModal] = useState(false);
  const [envioParaFlete, setEnvioParaFlete] = useState<Envio | null>(null);
  // S39: Despachar envío con courier (reutiliza DespacharOCModal)
  const [envioParaDespachar, setEnvioParaDespachar] = useState<Envio | null>(null);
  const { colaboradores, fetchColaboradores } = useColaboradorStore();

  // S57.x — viewMode ELIMINADO. Vista de tarjetas es la única opción
  // (alineado con /compras, referencia canónica S54.x).

  // Estado de filtros
  const [activeTab, setActiveTab] = useState<'todas' | 'en_transito' | 'pendientes' | 'incidencias'>('todas');
  const [filtroTipo, setFiltroTipo] = useState<TipoEnvio | 'todas'>('todas');
  const [filtroEstado, setFiltroEstado] = useState<EstadoEnvio | ''>('');
  const [busqueda, setBusqueda] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);
  // S42 Tanda 9 — Filtros extra alineados a mockup s40 líneas 2073-2092
  const [pillFiltroEnv, setPillFiltroEnv] = useState<'todas' | 'activas' | 'incidencias'>('todas');
  const [filtroCourier, setFiltroCourier] = useState('');
  // S47 — Filtro por tipo de ruta logística (A-J del Modelo Envíos Transversal)
  const [filtroTipoRuta, setFiltroTipoRuta] = useState<TipoRutaLogistica | ''>('');
  const [itemsVisiblesEnv, setItemsVisiblesEnv] = useState(12);

  const [cuentasTesoreria, setCuentasTesoreria] = useState<CuentaCaja[]>([]);
  const { dialogProps, confirm: confirmDialog } = useConfirmDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  // S53 F5 — Flags legacy eliminados (WIZARD_T2/J/E/I). Solo F y G tienen flag
  // hasta T-F y T-G que los migran a Ventas/Devoluciones.
  const wizardFEnabled = useMemo(() => isWizardFEnabled(), []);
  const wizardGEnabled = useMemo(() => isWizardGEnabled(), []);

  // S40 Bloque B: KPI reclamos
  const {
    resumen: resumenReclamos,
    fetchResumen: fetchResumenReclamos,
  } = useReclamoStore();

  // Carga inicial de datos
  useEffect(() => {
    fetchEnvios();
    fetchEnTransito();
    fetchPendientesRecepcion();
    fetchResumen();
    fetchTodosAlmacenes();
    fetchAlmacenesUSA();
    fetchAlmacenesPeru();
    fetchCasillas(); // S52 — nueva fuente de verdad de Red Logística (tipo Casilla)
    fetchViajeros();
    fetchColaboradores();
    fetchResumenReclamos();
    getTCDelDia().then(tc => setTipoCambioActual(tc ? { tasaVenta: tc.venta } : null)).catch(console.error);
    tesoreriaService.getCuentas().then(setCuentasTesoreria).catch(console.error);
  }, [fetchEnvios, fetchEnTransito, fetchPendientesRecepcion, fetchResumen, fetchAlmacenesUSA, fetchAlmacenesPeru, fetchCasillas, fetchViajeros, getTCDelDia, fetchResumenReclamos]);

  useEffect(() => {
    if (todosProductos.length === 0) fetchProductos();
  }, [todosProductos.length, fetchProductos]);

  // Deep-link desde query param
  // chk5.C-FIX · B4.2 · acepta `?envioId=` (legacy) o `?highlight=` (cross-módulo canon)
  useEffect(() => {
    const envioId = searchParams.get('envioId') || searchParams.get('highlight');
    if (envioId && envios.length > 0) {
      const found = envios.find(e => e.id === envioId);
      if (found) {
        setSelectedEnvio(found);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, envios, setSearchParams]);

  // Filtrar por linea de negocio
  const enviosPorLinea = useLineaFilter(envios, e => e.lineaNegocioId, { allowUndefined: true });
  const enviosEnTransitoPorLinea = useLineaFilter(enviosEnTransito, e => e.lineaNegocioId, { allowUndefined: true });
  const enviosPendientesPorLinea = useLineaFilter(enviosPendientesRecepcion, e => e.lineaNegocioId, { allowUndefined: true });

  // Calcular valor total en transito
  const valorEnTransito = useMemo(() => {
    return enviosEnTransito.reduce((total, e) => {
      const valorEnvio = e.productosSummary?.reduce((sum, p) => sum + ((p as { costoTotalUSD?: number }).costoTotalUSD || 0), 0) || 0;
      return total + valorEnvio;
    }, 0);
  }, [enviosEnTransito]);

  // S42 Tanda 9 — Stats extras para KPIs alineados al mockup
  const enviosStatsExtra = useMemo(() => {
    // Unidades totales en tránsito (subtítulo de "En tránsito")
    const unidadesEnTransito = enviosEnTransitoPorLinea.reduce(
      (s, e) => s + (e.totalUnidades ?? e.unidades?.length ?? 0),
      0
    );

    // Valor landed en PEN (prorrateado) — usa TC si está disponible, sino USD
    const tc = tipoCambioActual?.tasaVenta ?? 0;
    const valorLandedPEN = tc > 0 ? valorEnTransito * tc : valorEnTransito;

    // Count activos (todos menos completadas/canceladas)
    const countActivas = enviosPorLinea.filter(
      e => !['recibida_completa', 'cancelada'].includes(e.estado)
    ).length;

    // Count con incidencias abiertas
    const countIncidencias = enviosPorLinea.filter(e => {
      if ((e.totalUnidadesFaltantes || 0) > 0 || (e.totalUnidadesDanadas || 0) > 0) return true;
      if (e.estado === 'retenida_aduana' || e.estado === 'perdida_total') return true;
      if (Array.isArray(e.incidencias) && e.incidencias.some(i => !i.resuelta)) return true;
      return false;
    }).length;

    // Count en aduana (retenidos · señal de fricción de importación · mini-stat del strip)
    const countEnAduana = enviosPorLinea.filter(e => e.estado === 'retenida_aduana').length;

    // S47 — Count por tipo de ruta A-J (Modelo Envíos Transversal)
    const countsPorTipoRuta = contarEnviosPorTipoRuta(enviosPorLinea);

    return {
      unidadesEnTransito,
      valorLandedPEN,
      countActivas,
      countIncidencias,
      countEnAduana,
      tc,
      countsPorTipoRuta,
    };
  }, [enviosEnTransitoPorLinea, enviosPorLinea, tipoCambioActual, valorEnTransito]);

  // Resumen ejecutivo (tab Resumen · §A→§F · canon HUB)
  const resumenEnviosData: ResumenEnviosData = useMemo(() => {
    const alertas: ResumenEnviosData['alertas'] = [];
    enviosPorLinea.filter(e => e.estado === 'retenida_aduana').slice(0, 2).forEach(e =>
      alertas.push({ tono: 'rose', icon: 'aduana', texto: `${e.numeroEnvio} retenido en aduana` }));
    if (resumen?.enviosConIncidencias) {
      alertas.push({ tono: 'amber', icon: 'incidencia', texto: `${resumen.enviosConIncidencias} envío(s) con incidencias sin resolver` });
    }
    if (resumenReclamos?.reclamosPendientes) {
      alertas.push({ tono: 'slate', icon: 'reclamo', texto: `${resumenReclamos.reclamosPendientes} reclamo(s) pendiente(s)` });
    }
    return {
      activos: enviosStatsExtra.countActivas,
      enTransito: resumen?.enTransito ?? 0,
      pendientesRecepcion: resumen?.pendientesRecepcion ?? 0,
      incidencias: resumen?.enviosConIncidencias ?? enviosStatsExtra.countIncidencias,
      reclamosPendientes: resumenReclamos?.reclamosPendientes ?? 0,
      reclamadoPEN: resumenReclamos?.totalReclamadoPEN ?? 0,
      countsPorTipoRuta: enviosStatsExtra.countsPorTipoRuta,
      alertas,
    };
  }, [enviosPorLinea, resumen, resumenReclamos, enviosStatsExtra]);

  // S42 Tanda 9 — Couriers únicos para dropdown filtro
  const couriersUnicos = useMemo(() => {
    const set = new Set<string>();
    for (const e of enviosPorLinea) {
      if (e.courier) set.add(e.courier);
    }
    return Array.from(set).sort();
  }, [enviosPorLinea]);

  // Filtrar envios
  const enviosFiltrados = useMemo(() => {
    let lista = activeTab === 'en_transito'
      ? enviosEnTransitoPorLinea
      : activeTab === 'pendientes'
        ? enviosPendientesPorLinea
        : enviosPorLinea;

    // Filtro por incidencias activas (KPI clickable)
    if (activeTab === 'incidencias') {
      lista = lista.filter(e => {
        if ((e.totalUnidadesFaltantes || 0) > 0 || (e.totalUnidadesDanadas || 0) > 0) return true;
        if (e.estado === 'retenida_aduana' || e.estado === 'perdida_total') return true;
        if (Array.isArray(e.incidencias) && e.incidencias.some(i => !i.resuelta)) return true;
        return false;
      });
    }

    if (pipelineStage) {
      if (pipelineStage === 'recibida') {
        lista = lista.filter(e => e.estado === 'recibida_parcial' || e.estado === 'recibida_completa');
      } else {
        lista = lista.filter(e => e.estado === pipelineStage);
      }
    }

    if (filtroTipo !== 'todas') {
      lista = lista.filter(e => e.tipo === filtroTipo);
    }

    if (filtroEstado) {
      lista = lista.filter(e => e.estado === filtroEstado);
    }

    if (busqueda) {
      const term = busqueda.toLowerCase();
      lista = lista.filter(e => {
        const numeroEnvio = (e.numeroEnvio ?? '').toLowerCase();
        const origenNombre = (e.origenCasillaNombre ?? e.origenProveedorNombre ?? '').toLowerCase();
        const destinoNombre = (e.destinoCasillaNombre ?? '').toLowerCase();
        const tracking = (e.numeroTracking ?? '').toLowerCase();
        const ocNumero = ((e as any).ordenCompraNumero ?? '').toLowerCase();
        return numeroEnvio.includes(term) ||
               origenNombre.includes(term) ||
               destinoNombre.includes(term) ||
               tracking.includes(term) ||
               ocNumero.includes(term);
      });
    }

    // Pills filtro · eje ESTADO/SALUD. El filtro por origen/ruta (incl. "lo que manda
    // el proveedor") vive en la fila "Filtrar por tipo de ruta logística" (ruta A).
    if (pillFiltroEnv === 'activas') {
      lista = lista.filter(e => !['recibida_completa', 'cancelada'].includes(e.estado));
    } else if (pillFiltroEnv === 'incidencias') {
      lista = lista.filter(e => {
        if ((e.totalUnidadesFaltantes || 0) > 0 || (e.totalUnidadesDanadas || 0) > 0) return true;
        if (e.estado === 'retenida_aduana' || e.estado === 'perdida_total') return true;
        if (Array.isArray(e.incidencias) && e.incidencias.some(i => !i.resuelta)) return true;
        return false;
      });
    }

    // Dropdown courier
    if (filtroCourier) {
      lista = lista.filter(e => e.courier === filtroCourier);
    }

    // S47 — Filtro tipo ruta A-J (Modelo Envíos Transversal)
    if (filtroTipoRuta) {
      lista = lista.filter(e => deriveTipoRutaLogistica(e) === filtroTipoRuta);
    }

    return lista;
  }, [activeTab, enviosEnTransitoPorLinea, enviosPendientesPorLinea, enviosPorLinea,
      pipelineStage, filtroTipo, filtroEstado, busqueda, pillFiltroEnv, filtroCourier, filtroTipoRuta]);

  // S42 Tanda 9 — Reset paginación al cambiar filtros
  useEffect(() => {
    setItemsVisiblesEnv(12);
  }, [activeTab, pipelineStage, filtroTipo, filtroEstado, busqueda, pillFiltroEnv, filtroCourier, filtroTipoRuta]);

  // Handlers de acciones
  const handleConfirmar = useCallback(async (id: string) => {
    if (!user) return;
    const confirmed = await confirmDialog({
      title: 'Confirmar Envio',
      message: 'Confirmar este envio para preparacion?',
      confirmText: 'Confirmar',
      variant: 'info',
    });
    if (confirmed) {
      await confirmarEnvio(id, user.uid);
    }
  }, [user, confirmDialog, confirmarEnvio]);

  // S39: "Marcar como Enviado" abre DespacharOCModal para seleccionar courier + tracking
  const handleEnviar = useCallback((id: string) => {
    const envio = envios.find(e => e.id === id) || enviosEnTransito.find(e => e.id === id);
    if (envio) setEnvioParaDespachar(envio);
  }, [envios, enviosEnTransito]);

  const handleDespacharEnvioSubmit = useCallback(async (result: DespacharOCResult) => {
    if (!user || !envioParaDespachar) return;

    // 1. Si creó un courier nuevo, persistirlo
    let courierColabId = result.courierColaboradorId;
    if (!courierColabId && result.crearNuevoColaborador) {
      try {
        const { colaboradorService } = await import('../../services/colaborador.service');
        const { tipo, nombre } = result.crearNuevoColaborador;
        courierColabId = await colaboradorService.crear(
          { nombre, tipo, estado: 'activo', pais: tipo === 'transportista_local' ? 'Peru' : 'USA' } as any,
          user.uid
        );
        fetchColaboradores();
        toast.success(`Courier "${nombre}" agregado a Red Logística`);
      } catch (err: any) {
        toast.error(`Error creando courier: ${err.message}`);
        return;
      }
    }

    // 2. Enviar el envío con courier + tracking
    await enviarEnvio(envioParaDespachar.id, {
      fechaSalida: result.fechaDespacho,
      courier: result.courierNombre,
      courierColaboradorId: courierColabId,
      numeroTracking: result.numeroTracking,
    }, user.uid);

    // 3. Sync courier a la OC vinculada (ida y vuelta).
    // Usamos updateDoc directo porque updateOrden solo permite editar borradores.
    if (envioParaDespachar.ordenCompraId) {
      try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        const updates: Record<string, unknown> = {};
        if (result.courierNombre) {
          updates.courier = result.courierNombre;
          updates.colaboradorTransporteNombre = result.courierNombre;
        }
        if (courierColabId) updates.colaboradorTransporteId = courierColabId;
        if (result.numeroTracking) updates.numeroTracking = result.numeroTracking;
        if (Object.keys(updates).length > 0) {
          await updateDoc(doc(db, 'ordenesCompra', envioParaDespachar.ordenCompraId), updates);
        }
      } catch (err) {
        // No bloquear — sync a OC es best-effort
        console.warn('No se pudo sincronizar courier a OC vinculada:', err);
      }
    }

    setEnvioParaDespachar(null);
    toast.success('Envío marcado como en tránsito');
  }, [user, envioParaDespachar, enviarEnvio, fetchColaboradores, toast]);

  const handleCancelar = useCallback(async (id: string) => {
    if (!user) return;
    const motivo = prompt("Ingrese el motivo de cancelacion:");
    if (motivo) {
      await cancelarEnvio(id, motivo, user.uid);
    }
  }, [user, cancelarEnvio]);

  const handleIniciarRecepcion = useCallback((envio: Envio) => {
    setEnvioParaRecepcion(envio);
    setSelectedEnvio(null);
    setShowRecepcionModal(true);
  }, []);

  const handleAbrirPagoColaborador = useCallback((envio: Envio) => {
    setEnvioParaPago(envio);
    setSelectedEnvio(null);
    setShowPagoModal(true);
  }, []);

  const handleAbrirEditFlete = useCallback((envio: Envio) => {
    setEnvioParaFlete(envio);
    setShowEditFleteModal(true);
  }, []);

  const handleReconciliarPago = useCallback(async (envio: Envio) => {
    if (!user) return;
    try {
      await reconciliarPagoColaborador(envio.id, user.uid);
      setSelectedEnvio(null);
      toast.success('Pago sincronizado correctamente en Tesoreria');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(msg);
    }
  }, [user, reconciliarPagoColaborador, toast]);

  // S53 F5 · handleCrearEnvio ELIMINADO — la creación de envíos ahora vive
  // en /envios/nuevo (EnvioWizardPage) que llama a envioUnificadoService.

  const handleRegistrarRecepcion = useCallback(async (
    data: RecepcionEnvioFormData,
    extras?: { gastosAduanaPEN?: number; gastosAduanaDescripcion?: string }
  ) => {
    if (!user) return;
    try {
      // Recepcion se registra via el servicio de recepcion directamente por ahora
      // El store tiene registrarRecepcion pero la accion es del servicio
      const { envioRecepcionService } = await import('../../services/envio.recepcion.service');
      await envioRecepcionService.registrarRecepcion(data, user.uid, extras);
      await fetchEnvios();
      await fetchPendientesRecepcion();
      setShowRecepcionModal(false);
      setEnvioParaRecepcion(null);
      toast.success('Recepcion registrada correctamente');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast.error('Error: ' + message);
    }
  }, [user, fetchEnvios, fetchPendientesRecepcion, toast]);

  const handleRegistrarPagoColaborador = useCallback(async (datos: {
    fechaPago: Date;
    monedaPago: 'USD' | 'PEN';
    montoOriginal: number;
    tipoCambio: number;
    metodoPago: MetodoTesoreria;
    cuentaOrigenId?: string;
    referencia?: string;
    notas?: string;
  }) => {
    if (!user || !envioParaPago) return;
    try {
      await registrarPagoColaborador(envioParaPago.id, datos, user.uid);
      setShowPagoModal(false);
      setEnvioParaPago(null);
      toast.success('Pago al colaborador registrado correctamente');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast.error('Error: ' + message);
    }
  }, [user, envioParaPago, registrarPagoColaborador, toast]);

  const handleActualizarFlete = useCallback(async (costoFletePorProducto: Record<string, number>) => {
    if (!user || !envioParaFlete) return;
    try {
      await actualizarFlete(envioParaFlete.id, costoFletePorProducto, user.uid);
      setShowEditFleteModal(false);
      setEnvioParaFlete(null);
      setSelectedEnvio(null);
      toast.success('Flete actualizado correctamente');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast.error('Error: ' + message);
    }
  }, [user, envioParaFlete, actualizarFlete, toast]);

  // S57.x — envioColumns + helpers de tabla ELIMINADOS (vista DataTable removida).
  // La página renderiza únicamente EnvioCardSimple en stack vertical,
  // alineado con /compras (referencia canónica S54.x). Los helpers
  // estadoVariant/estadoLabel vivían solo dentro de envioColumns.

  // ─── Derivados del Hub Kit · KPI strip SEMÁNTICO (N1/N2) + tabs + breadcrumb ───
  // OJO: el tono es semántico (qué significa el dato), NUNCA el color del módulo
  // (inventario=orange vive solo en el chrome · identidad nunca pisa al semántico).
  const enviosKpis: HubKpi[] = [
    { label: 'Activos', valor: String(enviosPorLinea.length), tono: 'slate', icon: Package, delta: 'envíos en curso' },
    { label: 'En tránsito', valor: String(resumen?.enTransito ?? 0), tono: 'sky', icon: Truck, delta: enviosStatsExtra.unidadesEnTransito > 0 ? `${enviosStatsExtra.unidadesEnTransito} uds en camino` : 'en camino' },
    { label: 'Pend. recepción', valor: String(resumen?.pendientesRecepcion ?? 0), tono: 'amber', icon: Clock, delta: 'recepción parcial' },
    { label: 'Incidencias', valor: String(resumen?.enviosConIncidencias ?? 0), tono: 'rose', icon: AlertTriangle, delta: 'sin resolver' },
    { label: 'Valor landed', valor: enviosStatsExtra.tc > 0 ? `S/ ${(enviosStatsExtra.valorLandedPEN / 1000).toFixed(1)}` : `$ ${(valorEnTransito / 1000).toFixed(1)}`, sufijo: 'k', tono: 'indigo', icon: DollarSign, delta: 'total prorrateado' },
  ];
  const tabsHub: HubTab[] = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { id: 'operaciones', label: 'Operaciones', icon: ArrowRightLeft },
    { id: 'incidencias', label: 'Incidencias', icon: AlertTriangle, badge: resumen?.enviosConIncidencias || undefined, badgeTono: 'rose' },
    { id: 'reclamos', label: 'Reclamos', icon: Gavel, badge: resumenReclamos?.reclamosPendientes || undefined, badgeTono: 'amber' },
    { id: 'costos', label: 'Costos Landed', icon: DollarSign },
    { id: 'rendimiento', label: 'Rendimiento', icon: BarChart3 },
  ];
  const breadcrumbLeaf = tabEnvios === 'resumen' ? null : (tabsHub.find((t) => t.id === tabEnvios)?.label ?? null);

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
      <HubShell>
        <HubTopBar
          grupo="inventario"
          modulo="Envíos"
          leaf={breadcrumbLeaf}
          esAdmin={esAdmin}
          onInicio={() => navigate('/')}
          onModulo={() => setTabEnvios('resumen')}
        />
        <HubHeader
          grupo="inventario"
          icon={Truck}
          titulo="Envíos"
          subtitulo="Hub logístico · todo lo que entra, sale o se traslada físicamente"
          extraActions={
            <button
              type="button"
              onClick={() => { fetchEnvios(); fetchEnTransito(); fetchPendientesRecepcion(); fetchResumen(); }}
              title="Actualizar"
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          }
          acciones={[
            { label: 'Exportar', icon: Download, onClick: () => exportService.exportEnvios(enviosPorLinea), tier: 'neutral', disabled: enviosPorLinea.length === 0 },
            { label: 'Nuevo envío', icon: Plus, onClick: () => navigate('/envios/nuevo'), tier: 'primary' },
          ]}
        />
        {/* KPI strip persistente · color SEMÁNTICO (N1/N2) + mini-stats (N3) · canon Hub */}
        <HubKpiStrip
          cols={5}
          kpis={enviosKpis}
          miniStats={[
            { label: <span><strong className={`tabular-nums font-semibold ${enviosStatsExtra.countEnAduana > 0 ? 'text-rose-700' : 'text-slate-700'}`}>{enviosStatsExtra.countEnAduana}</strong> en aduana</span>, icon: Landmark },
            { label: <span><strong className="font-semibold text-slate-700 tabular-nums">{couriersUnicos.length}</strong> couriers activos</span>, icon: Truck },
          ]}
        />
        <HubTabs
          grupo="inventario"
          tabs={tabsHub}
          activa={tabEnvios}
          onChange={(id) => setTabEnvios(id as TabEnvios)}
        />

        <HubBody flush>
          {tabEnvios === 'resumen' ? (
            <div className="p-4 sm:p-6">
              <TabResumenEnvios
                data={resumenEnviosData}
                onNuevoEnvio={() => navigate('/envios/nuevo')}
                onIrATab={setTabEnvios}
              />
            </div>
          ) : tabEnvios === 'reclamos' ? (
            <div className="p-4 sm:p-6"><TabReclamos /></div>
          ) : tabEnvios === 'incidencias' ? (
            <div className="p-4 sm:p-6"><TabIncidencias /></div>
          ) : tabEnvios === 'costos' ? (
            <div className="p-4 sm:p-6"><TabCostosLanded /></div>
          ) : tabEnvios === 'rendimiento' ? (
            <div className="p-4 sm:p-6"><TabRendimiento /></div>
          ) : (
          <div className="p-4 sm:p-6 space-y-4">
      {/* KPIs ejecutivos → HubKpiStrip persistente del shell (semántico) ·
           canon de no-redundancia: el strip DA el número, aquí NO se re-renderiza.
           El filtrado por vista (en_transito/pendientes/incidencias) vive en las
           pills + FilterDrawer de abajo (antes era el click en el KPI). */}

      {/* S42 Tanda 9 — Pills filtros + dropdowns (mockup líneas 2072-2092) */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">Filtrar:</span>
        <button
          type="button"
          onClick={() => setPillFiltroEnv('todas')}
          className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
            pillFiltroEnv === 'todas' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Todas <span className="ml-1 opacity-75">({enviosPorLinea.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setPillFiltroEnv('activas')}
          className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
            pillFiltroEnv === 'activas' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Activas ({enviosStatsExtra.countActivas})
        </button>
        <button
          type="button"
          onClick={() => setPillFiltroEnv('incidencias')}
          className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
            pillFiltroEnv === 'incidencias' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Con incidencias ({enviosStatsExtra.countIncidencias})
        </button>
        <select
          value={filtroCourier}
          onChange={(e) => setFiltroCourier(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
        >
          <option value="">Todos los couriers</option>
          {couriersUnicos.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <div className="flex-1" />
        {(pillFiltroEnv !== 'todas' || filtroCourier || filtroTipoRuta) && (
          <button
            type="button"
            onClick={() => { setPillFiltroEnv('todas'); setFiltroCourier(''); setFiltroTipoRuta(''); }}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* S47 — Sección "Filtrar por tipo de ruta logística" (mockup S43 pixel-perfect) */}
      <div className="space-y-2 mt-2">
        <div className="text-xs font-medium text-slate-700">
          Filtrar por tipo de ruta logística
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFiltroTipoRuta('')}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
              filtroTipoRuta === '' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            title="Ver todos los tipos de ruta"
          >
            Todos <span className="ml-1 opacity-75">({enviosPorLinea.length})</span>
          </button>
          {(Object.keys(INFO_TIPO_RUTA) as TipoRutaLogistica[]).map((codigo) => {
            const info = INFO_TIPO_RUTA[codigo];
            const count = enviosStatsExtra.countsPorTipoRuta[codigo] || 0;
            const activo = filtroTipoRuta === codigo;
            // S52 — Siempre visibles (incluso con count=0) para matching pixel-perfect con mockup
            return (
              <button
                key={codigo}
                type="button"
                onClick={() => setFiltroTipoRuta(activo ? '' : codigo)}
                disabled={count === 0 && !activo}
                title={info.nombreLargo}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors flex items-center gap-1.5 ${
                  activo
                    ? 'bg-orange-600 text-white ring-2 ring-orange-300'
                    : count === 0
                      ? 'bg-slate-50 text-slate-400 border border-slate-100 cursor-not-allowed opacity-60'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 cursor-pointer'
                }`}
              >
                <info.icon className="w-3 h-3" />
                <span>{info.nombreCorto}</span>
                <span className="font-mono text-[10px] opacity-70">· {codigo}</span>
                <span className={`font-semibold ${activo ? 'text-white/90' : 'text-slate-500'}`}>({count})</span>
              </button>
            );
          })}
          {enviosStatsExtra.countsPorTipoRuta.sin_clasificar > 0 && (
            <span className="text-[11px] text-slate-400 italic ml-1">
              · {enviosStatsExtra.countsPorTipoRuta.sin_clasificar} sin clasificar
            </span>
          )}
        </div>
      </div>

      {/* S53.26 — El botón "Nuevo envío" y "Exportar" se movieron al PageHeader
           (arriba) para consolidar los controles principales en un solo card
           alargado, igual al patrón de /compras. */}

      {/* Toolbar — sin toggle de vista (S57.x: cards únicamente) */}
      <Toolbar
        search={{ value: busqueda, onChange: setBusqueda, placeholder: 'Buscar envios...' }}
        filterCount={[filtroTipo !== 'todas' ? filtroTipo : '', filtroEstado, activeTab !== 'todas' ? activeTab : ''].filter(Boolean).length}
        onFilterToggle={() => setShowFilters(true)}
        resultCount={enviosFiltrados.length}
      />

      {/* FilterDrawer */}
      <FilterDrawer
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        onClearAll={() => { setFiltroTipo('todas'); setFiltroEstado(''); setActiveTab('todas'); }}
        activeFilterCount={[filtroTipo !== 'todas' ? filtroTipo : '', filtroEstado, activeTab !== 'todas' ? activeTab : ''].filter(Boolean).length}
      >
        <FilterSection title="Vista">
          <select className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" value={activeTab} onChange={e => setActiveTab(e.target.value as 'todas' | 'en_transito' | 'pendientes' | 'incidencias')}>
            <option value="todas">Todos los envios</option>
            <option value="en_transito">En transito</option>
            <option value="pendientes">Pendientes recepcion</option>
            <option value="incidencias">Con incidencias</option>
          </select>
        </FilterSection>
        <FilterSection title="Tipo">
          <select className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as TipoEnvio | 'todas')}>
            <option value="todas">Todos los tipos</option>
            <option value="internacional_peru">Internacional</option>
            <option value="interna_origen">Interna Origen</option>
          </select>
        </FilterSection>
        <FilterSection title="Estado">
          <select className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as EstadoEnvio | '')}>
            <option value="">Todos</option>
            <option value="borrador">Borrador</option>
            <option value="confirmado">Confirmado</option>
            <option value="en_transito">En Transito</option>
            <option value="recibida_parcial">Parcial</option>
            <option value="recibida_completa">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </FilterSection>
      </FilterDrawer>

      {/* Lista de envios */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        </div>
      ) : enviosFiltrados.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-12">
            <ArrowRightLeft className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No hay envios
            </h3>
            <p className="text-slate-600 mb-6">
              {activeTab === 'en_transito'
                ? 'No hay envios en transito'
                : activeTab === 'pendientes'
                  ? 'No hay envios pendientes de recepcion'
                  : activeTab === 'incidencias'
                    ? 'Sin incidencias abiertas. Todo bajo control.'
                    : 'Crea tu primer envio para mover productos entre casillas'
              }
            </p>
            {activeTab === 'todas' && (
              <Button variant="primary" onClick={() => navigate('/envios/nuevo')}>
                <Plus className="h-5 w-5 mr-2" />
                Nuevo Envio
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          {/* S53.29 — Vista estándar: EnvioCardSimple con layout 5-columnas
               (igual a CompraCard). Elegante, alargado, consistente con
               /compras. El EnvioCard legacy queda disponible para el modal
               de detalle cuando el usuario hace click.
               S57.x — Vista de tarjetas única (DataTable eliminada). */}
          <div className="bg-slate-50 rounded-xl p-4 md:p-5 space-y-3 border border-slate-100">
            {enviosFiltrados.slice(0, itemsVisiblesEnv).map(envio => (
              <EnvioCardSimple
                key={envio.id}
                envio={envio}
                productosMap={productosMapGlobal}
                onSelect={setSelectedEnvio}
              />
            ))}
          </div>
          {/* S42 Tanda 9 — Footer "Cargar más" (mockup sección final) */}
          {enviosFiltrados.length > itemsVisiblesEnv && (
            <div className="pt-2 text-center">
              <span className="text-xs text-slate-500">
                + {enviosFiltrados.length - itemsVisiblesEnv} envíos más ·{' '}
              </span>
              <button
                type="button"
                onClick={() => setItemsVisiblesEnv((n) => n + 12)}
                className="text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline"
              >
                Cargar más
              </button>
            </div>
          )}
        </>
      )}
          </div>
          )}
        </HubBody>
      </HubShell>

      {/* ═══ Overlays · FUERA del HubShell (accesibles desde cualquier tab) ═══ */}
      {/* S53 F5 · EnvioWizardV2 ELIMINADO — el wizard unificado (/envios/nuevo) lo reemplaza. */}

      {/* Modal: Detalle de envio */}
      {selectedEnvio && (
        <EnvioDetailModal
          envio={selectedEnvio}
          productosMap={productosMapGlobal}
          userId={user?.uid}
          onClose={() => setSelectedEnvio(null)}
          onConfirmar={handleConfirmar}
          onEnviar={handleEnviar}
          onIniciarRecepcion={handleIniciarRecepcion}
          onAbrirPagoColaborador={handleAbrirPagoColaborador}
          onAbrirEditFlete={handleAbrirEditFlete}
          onReconciliarPago={handleReconciliarPago}
        />
      )}

      {/* Modal: Recepcion */}
      {showRecepcionModal && envioParaRecepcion && (
        <RecepcionModal
          transferencia={envioParaRecepcion}
          productosMap={productosMapGlobal}
          onClose={() => {
            setShowRecepcionModal(false);
            setEnvioParaRecepcion(null);
          }}
          onConfirm={handleRegistrarRecepcion}
        />
      )}

      {/* Modal: Pago al Colaborador (Unificado) */}
      {showPagoModal && envioParaPago && (() => {
        // S55 Fase 4 — pagosEnvioParaPago viene del hook (CC)
        const pagadoUSD = pagosEnvioParaPago.reduce((s, p) => s + (p.montoUSD || 0), 0);
        const pendienteUSD = (envioParaPago.costoFleteTotal || 0) - pagadoUSD;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
              <PagoUnificadoForm
                origen="viajero"
                titulo={`Pago Colaborador — ${envioParaPago.colaboradorNombre || envioParaPago.numeroEnvio}`}
                montoTotal={envioParaPago.costoFleteTotal || 0}
                montoPendiente={Math.max(0, pendienteUSD)}
                monedaOriginal="USD"
                tcDocumento={tipoCambioActual?.tasaVenta}
                pagosAnteriores={pagosEnvioParaPago.map(p => ({
                  id: p.id,
                  fecha: p.fecha?.toDate?.() || new Date(),
                  monto: p.montoUSD || p.montoOriginal || 0,
                  moneda: p.monedaPago || 'USD',
                  metodo: p.metodoPago || '',
                  referencia: p.referencia,
                }))}
                onSubmit={async (datos: PagoUnificadoResult) => {
                  await handleRegistrarPagoColaborador({
                    fechaPago: datos.fechaPago,
                    monedaPago: datos.monedaPago,
                    montoOriginal: datos.montoOriginal,
                    tipoCambio: datos.tipoCambio,
                    metodoPago: datos.metodoPago as MetodoTesoreria,
                    cuentaOrigenId: datos.cuentaOrigenId,
                    referencia: datos.referencia,
                    notas: datos.notas,
                  });
                }}
                onCancel={() => {
                  setShowPagoModal(false);
                  setEnvioParaPago(null);
                }}
              />
            </div>
          </div>
        );
      })()}

      {/* Modal: Editar Flete */}
      {showEditFleteModal && envioParaFlete && (
        <EditFleteModal
          transferencia={envioParaFlete}
          onClose={() => {
            setShowEditFleteModal(false);
            setEnvioParaFlete(null);
          }}
          onConfirm={handleActualizarFlete}
        />
      )}

      {/* S41 Tanda 7: Despachar envío V2 — layout 2-col + selector rico */}
      {envioParaDespachar && (
        <DespacharEnvioModal
          isOpen={true}
          onClose={() => setEnvioParaDespachar(null)}
          envio={envioParaDespachar}
          colaboradores={colaboradores}
          productosMap={productosMapGlobal}
          onConfirm={handleDespacharEnvioSubmit}
        />
      )}

      {/* Dialogo de Confirmacion */}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

// EnviosTabButton ELIMINADO · los tabs legacy migraron a <HubTabs> del Hub Kit (A5.1).
