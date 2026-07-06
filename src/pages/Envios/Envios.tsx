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
  DollarSign,
  RefreshCw,
  Package,
  Gavel,
  BarChart3,
  Coins,
  Download,
  LayoutDashboard,
  Landmark,
  Zap,
  HandCoins,
  ArrowUpDown,
  ArrowRight,
  ArrowUpRight,
  Users,
  SlidersHorizontal,
  Route,
  Ship,
  Store,
  Undo2,
  Activity,
  XCircle,
} from "lucide-react";
import { exportService } from "../../services/export.service";
import {
  ConfirmDialog,
  useConfirmDialog,
} from "../../components/common";
import { BorradorBanner, FiltrosBar, HubShell, HubTopBar, HubHeader, HubKpiStrip, HubTabs, HubBody } from '../../design-system';
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
  RecepcionEnvioFormData,
} from "../../types/envio.types";
import type { CuentaCaja, MetodoTesoreria } from "../../types/tesoreria.types";
import { useLineaFilter } from "../../hooks/useLineaFilter";
import { useToastStore } from "../../store/toastStore";

// Sub-componentes
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
import { DespacharEnvioModal } from './DespacharEnvioModal';
import { useColaboradorStore } from '../../store/colaboradorStore';
import { useReclamoStore } from '../../store/reclamoStore';
import { TabReclamos } from './TabReclamos';
import { TabIncidencias } from './TabIncidencias';
import { TabCostosLanded } from './TabCostosLanded';
import { TabRendimiento } from './TabRendimiento';
import { TabResumenEnvios, type ResumenEnviosData } from './TabResumenEnvios';
import { TabImpactoFinanciero, type ImpactoFinancieroData } from './TabImpactoFinanciero';
// S47 — Modelo Envios Transversal: clasificación A-J derivada de campos existentes
import {
  deriveTipoRutaLogistica,
  contarEnviosPorTipoRuta,
  INFO_TIPO_RUTA,
  type TipoRutaLogistica,
} from '../../utils/envio.tipoRuta.helpers';

// chk5.ENVIOS-CONSISTENCIA · El wizard de creación se monta como MODAL en esta
// página (canon · consistente con OCWizardV3 de Compras y los demás módulos), no
// como ruta-página aparte. Lazy para no bloar el chunk de Envios (carga al abrir).
const EnvioWizardModal = React.lazy(() =>
  import('./EnvioWizard/EnvioWizardPage').then((m) => ({ default: m.EnvioWizardPage }))
);
// Wizards F (despacho venta) y G (retorno devolución) · también MODALES desde el hub
// (canon · antes eran rutas-página sueltas). Gateados por flag WIZARD_F/WIZARD_G.
const WizardFModal = React.lazy(() =>
  import('./EnvioWizardF').then((m) => ({ default: m.WizardFPage }))
);
const WizardGModal = React.lazy(() =>
  import('./EnvioWizardG').then((m) => ({ default: m.WizardGPage }))
);

type TabEnvios = 'resumen' | 'operaciones' | 'incidencias' | 'reclamos' | 'costos' | 'rendimiento' | 'impacto';

export const Envios: React.FC = () => {
  const [tabEnvios, setTabEnvios] = useState<TabEnvios>('resumen');
  const [showWizard, setShowWizard] = useState(false); // modal de creación de envío
  const [showWizardF, setShowWizardF] = useState(false); // modal despacho F (gateado por flag)
  const [showWizardG, setShowWizardG] = useState(false); // modal retorno G (gateado por flag)
  const [resumeBorrador, setResumeBorrador] = useState<any>(null); // snapshot de borrador a reanudar (banner del hub)
  const [borradorKey, setBorradorKey] = useState(0); // refresca el banner de borrador al cerrar el wizard
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
    error,
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

  const { casillas, fetchCasillas } = useAlmacenStore();

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

  // Estado de filtros · unificados en FiltrosBar (canon · sin drawer, un solo eje Estado)
  const [busqueda, setBusqueda] = useState('');
  // Eje ESTADO consolidado (single-select) · fusiona la antigua "Vista" + pills + estado granular
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [orden, setOrden] = useState('reciente');
  const [filtroCourier, setFiltroCourier] = useState('');
  // Filtro por tipo de ruta logística (A-J del Modelo Envíos Transversal) · dropdown agrupado
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
    fetchCasillas(); // Red Logística · fuente de verdad (tipo Casilla)
    fetchColaboradores();
    fetchResumenReclamos();
    getTCDelDia().then(tc => setTipoCambioActual(tc ? { tasaVenta: tc.venta } : null)).catch(console.error);
    tesoreriaService.getCuentas().then(setCuentasTesoreria).catch(console.error);
  }, [fetchEnvios, fetchEnTransito, fetchPendientesRecepcion, fetchResumen, fetchCasillas, getTCDelDia, fetchResumenReclamos]);

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

  // COD por cobrar de los despachos F activos (compartido: §A Resumen + tab Impacto).
  const codResumen = useMemo(() => {
    let monto = 0, despachos = 0;
    for (const e of enviosPorLinea) {
      if (e.destinoTipo === 'cliente' && e.cobroPendiente && !e.cobroRealizado) {
        monto += e.montoPorCobrar || 0;
        despachos += 1;
      }
    }
    return { monto, despachos };
  }, [enviosPorLinea]);

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
      codPorCobrar: codResumen.monto,
      leadTimeDias: resumen?.tiempoPromedioTransitoDias ?? null,
      countEnAduana: enviosStatsExtra.countEnAduana,
      countsPorTipoRuta: enviosStatsExtra.countsPorTipoRuta,
      alertas,
    };
  }, [enviosPorLinea, resumen, resumenReclamos, enviosStatsExtra, codResumen]);

  // S42 Tanda 9 — Couriers únicos para dropdown filtro
  const couriersUnicos = useMemo(() => {
    const set = new Set<string>();
    for (const e of enviosPorLinea) {
      if (e.courier) set.add(e.courier);
    }
    return Array.from(set).sort();
  }, [enviosPorLinea]);

  // Aside Operaciones · couriers ACTIVOS con su carga real (envíos no cerrados).
  const couriersActivos = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of enviosPorLinea) {
      if (['recibida_completa', 'cancelada'].includes(e.estado)) continue;
      if (!e.courier) continue;
      map.set(e.courier, (map.get(e.courier) || 0) + 1);
    }
    const iniciales = (n: string) =>
      n.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return Array.from(map.entries())
      .map(([nombre, count]) => ({ nombre, count, iniciales: iniciales(nombre) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [enviosPorLinea]);

  // Filtrar envios · dimensiones unificadas en FiltrosBar (Estado + Tipo de ruta + Courier + búsqueda + orden)
  const enviosFiltrados = useMemo(() => {
    let lista: Envio[] = enviosPorLinea;

    // Eje ESTADO consolidado (single-select) · reemplaza Vista + pills + estado granular
    switch (estadoFiltro) {
      case 'activas':
        lista = lista.filter(e => !['recibida_completa', 'cancelada'].includes(e.estado));
        break;
      case 'en_transito':
        lista = enviosEnTransitoPorLinea;
        break;
      case 'pendientes':
        lista = enviosPendientesPorLinea;
        break;
      case 'incidencias':
        lista = lista.filter(e => {
          if ((e.totalUnidadesFaltantes || 0) > 0 || (e.totalUnidadesDanadas || 0) > 0) return true;
          if (e.estado === 'retenida_aduana' || e.estado === 'perdida_total') return true;
          if (Array.isArray(e.incidencias) && e.incidencias.some(i => !i.resuelta)) return true;
          return false;
        });
        break;
      case 'recibidas':
        lista = lista.filter(e => e.estado === 'recibida_parcial' || e.estado === 'recibida_completa');
        break;
      case 'retenida_aduana': // cross-link del aside (urgencia aduana)
        lista = lista.filter(e => e.estado === 'retenida_aduana');
        break;
      case 'cancelada':
        lista = lista.filter(e => e.estado === 'cancelada');
        break;
      default:
        break; // '' = todas
    }

    // Tipo de ruta (dropdown agrupado · A-J)
    if (filtroTipoRuta) {
      lista = lista.filter(e => deriveTipoRutaLogistica(e) === filtroTipoRuta);
    }

    // Courier (chip)
    if (filtroCourier) {
      lista = lista.filter(e => e.courier === filtroCourier);
    }

    // Búsqueda
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

    // Orden · copia ANTES de ordenar (algunas ramas devuelven refs del store · nunca mutar)
    const ms = (t?: { toMillis?: () => number }) => t?.toMillis?.() ?? 0;
    return [...lista].sort((a, b) => {
      switch (orden) {
        case 'antiguo': return ms(a.fechaCreacion) - ms(b.fechaCreacion);
        case 'unidades': return (b.totalUnidades || 0) - (a.totalUnidades || 0);
        case 'reciente':
        default: return ms(b.fechaCreacion) - ms(a.fechaCreacion);
      }
    });
  }, [enviosPorLinea, enviosEnTransitoPorLinea, enviosPendientesPorLinea,
      estadoFiltro, filtroTipoRuta, filtroCourier, busqueda, orden]);

  // Reset paginación al cambiar filtros
  useEffect(() => {
    setItemsVisiblesEnv(12);
  }, [estadoFiltro, busqueda, filtroCourier, filtroTipoRuta]);

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
  const impactoData: ImpactoFinancieroData = useMemo(() => ({
    fletePorPagar: null,     // agregación CC del colaborador · pasada dedicada
    codPorCobrar: codResumen.monto,
    codDespachos: codResumen.despachos,
    perdidas: null,          // agregación incidencias/merma · pasada dedicada
    porRecuperar: resumenReclamos?.totalReclamadoPEN ?? 0,
    reclamosDisputa: resumenReclamos?.reclamosPendientes ?? 0,
  }), [codResumen, resumenReclamos]);

  const tabsHub: HubTab[] = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { id: 'operaciones', label: 'Operaciones', icon: ArrowRightLeft },
    { id: 'incidencias', label: 'Incidencias', icon: AlertTriangle, badge: resumen?.enviosConIncidencias || undefined, badgeTono: 'rose' },
    { id: 'reclamos', label: 'Reclamos', icon: Gavel, badge: resumenReclamos?.reclamosPendientes || undefined, badgeTono: 'amber' },
    { id: 'costos', label: 'Costos Landed', icon: DollarSign },
    { id: 'rendimiento', label: 'Rendimiento', icon: BarChart3 },
    { id: 'impacto', label: 'Impacto financiero', icon: Coins },
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
            ...(wizardFEnabled ? [{ label: 'Nuevo despacho', icon: Truck, onClick: () => setShowWizardF(true), tier: 'neutral' as const }] : []),
            ...(wizardGEnabled ? [{ label: 'Nuevo retorno', icon: Undo2, onClick: () => setShowWizardG(true), tier: 'neutral' as const }] : []),
            { label: 'Nuevo envío', icon: Plus, onClick: () => setShowWizard(true), tier: 'primary' },
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
          {/* Banner de borrador · en el MÓDULO (canon borrador · máxima visibilidad ·
               NO dentro del wizard). Continuar reabre el wizard con el snapshot cargado. */}
          <div className="px-4 sm:px-6 pt-4 sm:pt-6 empty:hidden">
            <BorradorBanner
              tipo="envio"
              refreshKey={borradorKey}
              onContinuar={(b) => { setResumeBorrador(b.estado); setShowWizard(true); }}
            />
          </div>
          {error && !loading ? (
            /* Estado de ERROR de página (canon N · el store expone `error`) */
            <div className="p-4 sm:p-6">
              <div className="bg-white border border-rose-200 rounded-xl p-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-6 h-6 text-rose-600" />
                </div>
                <h3 className="text-[14px] font-semibold text-slate-900 mb-1">No se pudieron cargar los envíos</h3>
                <p className="text-[12px] text-slate-500 mb-4 max-w-md mx-auto">{error}</p>
                <button
                  type="button"
                  onClick={() => { fetchEnvios(); fetchEnTransito(); fetchPendientesRecepcion(); fetchResumen(); }}
                  className="inline-flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-[12px] font-semibold px-3.5 py-2 rounded-lg shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" /> Reintentar
                </button>
              </div>
            </div>
          ) : tabEnvios === 'resumen' ? (
            <div className="p-4 sm:p-6">
              <TabResumenEnvios
                data={resumenEnviosData}
                onNuevoEnvio={() => setShowWizard(true)}
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
          ) : tabEnvios === 'impacto' ? (
            <div className="p-4 sm:p-6"><TabImpactoFinanciero data={impactoData} /></div>
          ) : (
          <div className="p-4 sm:p-6 space-y-4">
      {/* KPIs ejecutivos → HubKpiStrip persistente del shell (semántico) ·
           canon de no-redundancia: el strip DA el número, aquí NO se re-renderiza.
           Todo el filtrado vive en el FiltrosBar canónico de abajo (un solo idioma). */}

      {/* Filtros · FiltrosBar canónico UNIFICADO (canon · sustituye los 3 lenguajes
           previos: chips tipo-ruta + pills estado + panel de selects). Tipo de ruta =
           dropdown agrupado · Estado = un solo eje de chips · Courier = chips · + orden. */}
      <FiltrosBar
        color="orange"
        leadingFilter={{
          label: 'Tipo de ruta',
          icon: Route,
          value: filtroTipoRuta,
          allOption: { value: '', label: 'Todos los tipos' },
          options: [
            { groupLabel: 'Importación', groupIcon: Ship, options: (['A', 'B', 'C', 'D', 'J'] as TipoRutaLogistica[]).map(c => ({ value: c, label: INFO_TIPO_RUTA[c].nombreCorto, icon: INFO_TIPO_RUTA[c].icon })) },
            { groupLabel: 'Nacional', groupIcon: Store, options: (['E', 'F', 'I'] as TipoRutaLogistica[]).map(c => ({ value: c, label: INFO_TIPO_RUTA[c].nombreCorto, icon: INFO_TIPO_RUTA[c].icon })) },
            { groupLabel: 'Devolución', groupIcon: Undo2, options: (['G'] as TipoRutaLogistica[]).map(c => ({ value: c, label: INFO_TIPO_RUTA[c].nombreCorto, icon: INFO_TIPO_RUTA[c].icon })) },
          ],
          onChange: (v) => setFiltroTipoRuta(v as TipoRutaLogistica | ''),
        }}
        chipGroups={[
          {
            key: 'estado',
            label: 'Estado',
            multi: false,
            options: [
              { value: 'activas', label: 'Activas', variant: 'emerald', icon: Activity },
              { value: 'en_transito', label: 'En tránsito', variant: 'sky', icon: Truck },
              { value: 'pendientes', label: 'Pendientes', variant: 'amber', icon: Clock },
              { value: 'incidencias', label: 'Incidencias', variant: 'rose', icon: AlertTriangle },
              { value: 'recibidas', label: 'Recibidas', variant: 'emerald', icon: Package },
              { value: 'cancelada', label: 'Canceladas', variant: 'slate', icon: XCircle },
            ],
          },
          ...(couriersUnicos.length > 0 ? [{
            key: 'courier',
            label: 'Courier',
            multi: false,
            options: couriersUnicos.map(c => ({ value: c, label: c, variant: 'slate' as const })),
          }] : []),
        ]}
        selecciones={{
          estado: estadoFiltro ? [estadoFiltro] : [],
          courier: filtroCourier ? [filtroCourier] : [],
        }}
        onChipToggle={(key, value) => {
          if (key === 'estado') setEstadoFiltro(prev => (prev === value ? '' : value));
          else if (key === 'courier') setFiltroCourier(prev => (prev === value ? '' : value));
        }}
        searchTerm={busqueda}
        searchPlaceholder="Buscar envío, courier, OC…"
        onSearchChange={setBusqueda}
        sortValue={orden}
        sortOptions={[
          { value: 'reciente', label: 'Más recientes' },
          { value: 'antiguo', label: 'Más antiguos' },
          { value: 'unidades', label: 'Más unidades' },
        ]}
        onSortChange={setOrden}
        hayFiltrosActivos={!!estadoFiltro || !!filtroTipoRuta || !!filtroCourier || !!busqueda}
        onLimpiarTodo={() => { setEstadoFiltro(''); setFiltroTipoRuta(''); setFiltroCourier(''); setBusqueda(''); }}
      />

      {/* Lista de envios */}
      {loading ? (
        /* Skeleton de carga con la forma del Layout A (canon · no spinner genérico) */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-3">
            <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 bg-slate-100 rounded w-1/3" />
                    <div className="h-2.5 bg-slate-100 rounded w-2/3" />
                  </div>
                  <div className="h-5 w-16 bg-slate-100 rounded-full flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
          <aside className="md:col-span-1 space-y-4">
            <div className="bg-slate-100 rounded-xl h-32 animate-pulse" />
            <div className="bg-slate-100 rounded-xl h-40 animate-pulse" />
          </aside>
        </div>
      ) : (
        /* (3) BODY · Layout A (main 2 + aside 1) — master Acto 3 (3) */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* MAIN · lista de envíos */}
          <div className="md:col-span-2 space-y-3">

            {/* header de resultados · N resultados */}
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] text-slate-500 tabular-nums">{enviosFiltrados.length} resultados</span>
            </div>

            {enviosFiltrados.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                <ArrowRightLeft className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-[14px] font-semibold text-slate-900 mb-1">No hay envíos</h3>
                <p className="text-[12px] text-slate-500 mb-4">
                  {estadoFiltro === 'en_transito'
                    ? 'No hay envíos en tránsito.'
                    : estadoFiltro === 'pendientes'
                      ? 'No hay envíos pendientes de recepción.'
                      : estadoFiltro === 'incidencias'
                        ? 'Sin incidencias abiertas. Todo bajo control.'
                        : (estadoFiltro || filtroTipoRuta || filtroCourier || busqueda)
                          ? 'No hay envíos que coincidan con los filtros.'
                          : 'Crea tu primer envío para mover productos entre casillas.'}
                </p>
                {!estadoFiltro && !filtroTipoRuta && !filtroCourier && !busqueda && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto mt-1 text-left">
                    <button
                      type="button"
                      onClick={() => setShowWizard(true)}
                      className="bg-white border border-slate-200 rounded-lg p-3 hover:border-orange-300 hover:bg-orange-50/30 transition-colors"
                    >
                      <Plus className="w-4 h-4 text-orange-600 mb-1.5" />
                      <div className="text-[11px] font-bold text-slate-900">Nuevo envío</div>
                      <div className="text-[10px] text-slate-500">Mové productos entre casillas o al cliente.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/compras')}
                      className="bg-white border border-slate-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                    >
                      <Package className="w-4 h-4 text-blue-600 mb-1.5" />
                      <div className="text-[11px] font-bold text-slate-900">Desde una OC</div>
                      <div className="text-[10px] text-slate-500">Los envíos de importación nacen de una OC confirmada.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/red-logistica')}
                      className="bg-white border border-slate-200 rounded-lg p-3 hover:border-violet-300 hover:bg-violet-50/30 transition-colors"
                    >
                      <Users className="w-4 h-4 text-violet-600 mb-1.5" />
                      <div className="text-[11px] font-bold text-slate-900">Red logística</div>
                      <div className="text-[10px] text-slate-500">Couriers, viajeros y casillas.</div>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Card canónica EnvioCardSimple — directas en la columna (sin wrapper slate) */}
                {enviosFiltrados.slice(0, itemsVisiblesEnv).map(envio => (
                  <EnvioCardSimple
                    key={envio.id}
                    envio={envio}
                    productosMap={productosMapGlobal}
                    onSelect={setSelectedEnvio}
                  />
                ))}
                {/* paginación · master Acto 3 */}
                {enviosFiltrados.length > itemsVisiblesEnv && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      Mostrando {Math.min(itemsVisiblesEnv, enviosFiltrados.length)} de {enviosFiltrados.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setItemsVisiblesEnv((n) => n + 12)}
                      className="flex items-center gap-1.5 bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 text-[12px] font-semibold px-3.5 py-2 rounded-lg"
                    >
                      Cargar más · +{Math.min(12, enviosFiltrados.length - itemsVisiblesEnv)}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ASIDE · contexto persistente (datos reales) — master Acto 3 */}
          <aside className="md:col-span-1 space-y-4">

            {/* Urgencias logísticas */}
            <div className="bg-gradient-to-br from-rose-50 to-rose-100/30 ring-1 ring-rose-200/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-rose-600" />
                <span className="text-[10px] uppercase tracking-wider font-bold text-rose-700">Urgencias logísticas</span>
              </div>
              {enviosStatsExtra.countEnAduana > 0 || codResumen.despachos > 0 || enviosStatsExtra.countIncidencias > 0 ? (
                <div className="space-y-2">
                  {enviosStatsExtra.countEnAduana > 0 && (
                    <button
                      type="button"
                      onClick={() => setEstadoFiltro('retenida_aduana')}
                      className="w-full flex items-start gap-2.5 bg-white border border-rose-200 rounded-lg px-3 py-2 hover:bg-rose-50/50 text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0"><Landmark className="w-3.5 h-3.5 text-rose-700" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-slate-900">Retenidos en aduana</div>
                        <div className="text-[11px] text-rose-700 tabular-nums">{enviosStatsExtra.countEnAduana} envío(s)</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-1" />
                    </button>
                  )}
                  {codResumen.despachos > 0 && (
                    <button
                      type="button"
                      onClick={() => setFiltroTipoRuta('F' as TipoRutaLogistica)}
                      className="w-full flex items-start gap-2.5 bg-white border border-amber-200 rounded-lg px-3 py-2 hover:bg-amber-50/50 text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0"><HandCoins className="w-3.5 h-3.5 text-amber-700" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-slate-900">COD por cobrar</div>
                        <div className="text-[11px] text-amber-700 tabular-nums">S/ {Math.round(codResumen.monto).toLocaleString('es-PE')} · {codResumen.despachos} despacho(s)</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-1" />
                    </button>
                  )}
                  {enviosStatsExtra.countIncidencias > 0 && (
                    <button
                      type="button"
                      onClick={() => setEstadoFiltro('incidencias')}
                      className="w-full flex items-start gap-2.5 bg-white border border-rose-200 rounded-lg px-3 py-2 hover:bg-rose-50/50 text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-3.5 h-3.5 text-rose-700" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-slate-900">Con incidencias</div>
                        <div className="text-[11px] text-rose-700 tabular-nums">{enviosStatsExtra.countIncidencias} envío(s)</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-1" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-white/70 border border-emerald-200 rounded-lg px-3 py-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0"><Package className="w-3.5 h-3.5 text-emerald-700" /></div>
                  <div className="text-[12px] font-medium text-emerald-800">Sin urgencias · todo bajo control</div>
                </div>
              )}
            </div>

            {/* Couriers activos */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-violet-600" />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Couriers activos</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/red-logistica')}
                  className="text-[11px] font-semibold text-violet-700 hover:text-violet-800 flex items-center gap-1"
                >
                  Red logística <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
              {couriersActivos.length > 0 ? (
                <div className="space-y-2">
                  {couriersActivos.map((c) => (
                    <div key={c.nombre} className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0">{c.iniciales}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-slate-700 truncate">{c.nombre}</div>
                      </div>
                      <span className="text-[12px] font-bold tabular-nums text-slate-700">{c.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] text-slate-400 py-1">Sin couriers con envíos activos.</div>
              )}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-slate-400">
                <SlidersHorizontal className="w-3 h-3" />
                <span>Métricas y casillas viven en Red Logística</span>
              </div>
            </div>
          </aside>
        </div>
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

      {/* Wizard de creación de envío · MODAL (canon · reemplaza la ruta /envios/nuevo) */}
      {showWizard && (
        <React.Suspense fallback={null}>
          <EnvioWizardModal
            initialState={resumeBorrador}
            onClose={() => { setShowWizard(false); setResumeBorrador(null); setBorradorKey(k => k + 1); }}
            onCreated={() => {
              setShowWizard(false);
              setResumeBorrador(null);
              setBorradorKey(k => k + 1);
              fetchEnvios();
              fetchEnTransito();
              fetchPendientesRecepcion();
              fetchResumen();
            }}
          />
        </React.Suspense>
      )}

      {/* Wizard F · Despacho venta · MODAL desde el hub (gateado por flag WIZARD_F) */}
      {showWizardF && (
        <React.Suspense fallback={null}>
          <WizardFModal
            variant="modal"
            onCancel={() => setShowWizardF(false)}
            onCreated={() => {
              setShowWizardF(false);
              fetchEnvios();
              fetchEnTransito();
              fetchPendientesRecepcion();
              fetchResumen();
            }}
          />
        </React.Suspense>
      )}

      {/* Wizard G · Retorno devolución · MODAL desde el hub (gateado por flag WIZARD_G) */}
      {showWizardG && (
        <React.Suspense fallback={null}>
          <WizardGModal
            variant="modal"
            onCancel={() => setShowWizardG(false)}
            onCreated={() => {
              setShowWizardG(false);
              fetchEnvios();
              fetchEnTransito();
              fetchPendientesRecepcion();
              fetchResumen();
            }}
          />
        </React.Suspense>
      )}

      {/* Dialogo de Confirmacion */}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

// EnviosTabButton ELIMINADO · los tabs legacy migraron a <HubTabs> del Hub Kit (A5.1).
