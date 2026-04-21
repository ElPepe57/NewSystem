import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
// S44 — Feature flag para el Wizard T2 (Casilla Intl → Almacén Perú)
// S47 — Feature flag para el Wizard J (Casilla Intl ↔ Casilla Intl)
// S48 — Feature flag para el Wizard E (Traslado interno Perú ↔ Perú)
import { isWizardT2Enabled, isWizardJEnabled, isWizardEEnabled } from "../../config/features";
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
} from "lucide-react";
import { exportService } from "../../services/export.service";
import {
  Button,
  Card,
  ConfirmDialog,
  useConfirmDialog,
} from "../../components/common";
import type { PipelineStage } from "../../components/common";
import { KPIBar as DSKPIBar, StatCard as DSStatCard, Toolbar, FilterDrawer, FilterSection, PageShell, PageHeader, DataTable, StatusBadge } from '../../design-system';
import type { DataTableColumn } from '../../design-system';
import { FileText, CheckCircle2, XOctagon } from "lucide-react";
import { useEnvioStore } from '../../store/envioStore';
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
import { EnvioWizardV2 } from "./EnvioWizardV2/EnvioWizardV2";
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
// S47 — Modelo Envios Transversal: clasificación A-J derivada de campos existentes
import {
  deriveTipoRutaLogistica,
  contarEnviosPorTipoRuta,
  INFO_TIPO_RUTA,
  type TipoRutaLogistica,
} from '../../utils/envio.tipoRuta.helpers';

type TabEnvios = 'operaciones' | 'incidencias' | 'reclamos' | 'costos' | 'rendimiento';

export const Envios: React.FC = () => {
  const [tabEnvios, setTabEnvios] = useState<TabEnvios>('operaciones');
  const user = useAuthStore(state => state.user);
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
    viajeros,
    fetchAlmacenes: fetchTodosAlmacenes,
    fetchAlmacenesUSA,
    fetchAlmacenesPeru,
    fetchViajeros,
  } = useAlmacenStore();

  const almacenesOrigen = useMemo(() =>
    todosAlmacenes.filter(a => a.estadoAlmacen === 'activo'),
    [todosAlmacenes]
  );
  const almacenesDestinoPeru = useMemo(() =>
    todosAlmacenes.filter(a => a.estadoAlmacen === 'activo' && a.pais === 'Peru'),
    [todosAlmacenes]
  );

  const { productos: todosProductos, fetchProductos } = useProductoStore();
  const productosMapGlobal = useMemo(() => {
    const map = new Map<string, typeof todosProductos[0]>();
    todosProductos.forEach(p => map.set(p.id, p));
    return map;
  }, [todosProductos]);

  // Estado de modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRecepcionModal, setShowRecepcionModal] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [envioParaRecepcion, setEnvioParaRecepcion] = useState<Envio | null>(null);
  const [envioParaPago, setEnvioParaPago] = useState<Envio | null>(null);
  const [selectedEnvio, setSelectedEnvio] = useState<Envio | null>(null);
  const [showEditFleteModal, setShowEditFleteModal] = useState(false);
  const [envioParaFlete, setEnvioParaFlete] = useState<Envio | null>(null);
  // S39: Despachar envío con courier (reutiliza DespacharOCModal)
  const [envioParaDespachar, setEnvioParaDespachar] = useState<Envio | null>(null);
  const { colaboradores, fetchColaboradores } = useColaboradorStore();

  // Estado de vista
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');

  // Estado de filtros
  const [activeTab, setActiveTab] = useState<'todas' | 'en_transito' | 'pendientes' | 'incidencias'>('todas');
  const [filtroTipo, setFiltroTipo] = useState<TipoEnvio | 'todas'>('todas');
  const [filtroEstado, setFiltroEstado] = useState<EstadoEnvio | ''>('');
  const [busqueda, setBusqueda] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);
  // S42 Tanda 9 — Filtros extra alineados a mockup s40 líneas 2073-2092
  // S42aj — 'tramo1' reemplaza el tab "Envíos Proveedor" eliminado (origenTipo === 'proveedor')
  const [pillFiltroEnv, setPillFiltroEnv] = useState<'todas' | 'activas' | 'incidencias' | 'tramo1'>('todas');
  const [filtroCourier, setFiltroCourier] = useState('');
  // S47 — Filtro por tipo de ruta logística (A-J del Modelo Envíos Transversal)
  const [filtroTipoRuta, setFiltroTipoRuta] = useState<TipoRutaLogistica | ''>('');
  const [itemsVisiblesEnv, setItemsVisiblesEnv] = useState(12);

  const [cuentasTesoreria, setCuentasTesoreria] = useState<CuentaCaja[]>([]);
  const { dialogProps, confirm: confirmDialog } = useConfirmDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  // S44 — Feature flag del Wizard T2 (Casilla Internacional → Almacén Perú)
  const wizardT2Enabled = useMemo(() => isWizardT2Enabled(), []);
  // S47 — Feature flag del Wizard J (Casilla Internacional ↔ Casilla Internacional)
  const wizardJEnabled = useMemo(() => isWizardJEnabled(), []);
  // S48 — Feature flag del Wizard E (Traslado interno Almacén Perú ↔ Almacén Perú)
  const wizardEEnabled = useMemo(() => isWizardEEnabled(), []);

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
    fetchViajeros();
    fetchColaboradores();
    fetchResumenReclamos();
    getTCDelDia().then(tc => setTipoCambioActual(tc ? { tasaVenta: tc.venta } : null)).catch(console.error);
    tesoreriaService.getCuentas().then(setCuentasTesoreria).catch(console.error);
  }, [fetchEnvios, fetchEnTransito, fetchPendientesRecepcion, fetchResumen, fetchAlmacenesUSA, fetchAlmacenesPeru, fetchViajeros, getTCDelDia, fetchResumenReclamos]);

  useEffect(() => {
    if (todosProductos.length === 0) fetchProductos();
  }, [todosProductos.length, fetchProductos]);

  // Deep-link desde query param
  useEffect(() => {
    const envioId = searchParams.get('envioId');
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

  // Pipeline stages
  const pipelineStages: PipelineStage[] = useMemo(() => {
    const contarPorEstado = (estados: EstadoEnvio[]) =>
      enviosPorLinea.filter(e => estados.includes(e.estado)).length;

    return [
      {
        id: 'borrador',
        label: 'Borrador',
        count: contarPorEstado(['borrador']),
        color: 'gray' as const,
        icon: <FileText className="h-4 w-4" />,
      },
      {
        id: 'confirmado',
        label: 'Confirmado',
        count: contarPorEstado(['confirmado']),
        color: 'yellow' as const,
        icon: <Package className="h-4 w-4" />,
      },
      {
        id: 'en_transito',
        label: 'En Transito',
        count: contarPorEstado(['en_transito']),
        color: 'blue' as const,
        icon: <Truck className="h-4 w-4" />,
      },
      {
        id: 'recibida',
        label: 'Recibida',
        count: contarPorEstado(['recibida_parcial', 'recibida_completa']),
        color: 'green' as const,
        icon: <CheckCircle2 className="h-4 w-4" />,
      },
      {
        id: 'cancelada',
        label: 'Cancelada',
        count: contarPorEstado(['cancelada']),
        color: 'red' as const,
        icon: <XOctagon className="h-4 w-4" />,
      },
    ];
  }, [enviosPorLinea]);

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

    // S42aj — Count Tramo 1 (envíos del proveedor a casilla)
    const countTramo1 = enviosPorLinea.filter(e => e.origenTipo === 'proveedor').length;

    // S47 — Count por tipo de ruta A-J (Modelo Envíos Transversal)
    const countsPorTipoRuta = contarEnviosPorTipoRuta(enviosPorLinea);

    return {
      unidadesEnTransito,
      valorLandedPEN,
      countActivas,
      countIncidencias,
      countTramo1,
      tc,
      countsPorTipoRuta,
    };
  }, [enviosEnTransitoPorLinea, enviosPorLinea, tipoCambioActual, valorEnTransito]);

  // S42 Tanda 9 — Breakdown por tipo de ruta (mockup líneas 2003-2036)
  const breakdownPorTipo = useMemo(() => {
    const total = enviosPorLinea.length || 1;
    let proveedorACasilla = 0;
    let casillaAPeru = 0;
    let entreCasillas = 0;
    let ddpDirecto = 0;
    for (const e of enviosPorLinea) {
      if ((e as any).esDDP === true) { ddpDirecto++; continue; }
      if (e.tipo === 'interna_origen') { entreCasillas++; continue; }
      // tipo === 'internacional_peru'
      if (e.ordenCompraId) proveedorACasilla++;
      else casillaAPeru++;
    }
    return [
      { label: 'Proveedor → Casilla', value: proveedorACasilla, pct: Math.round((proveedorACasilla / total) * 100), dot: 'bg-sky-500', bar: 'bg-sky-500' },
      { label: 'Casilla → Perú', value: casillaAPeru, pct: Math.round((casillaAPeru / total) * 100), dot: 'bg-teal-500', bar: 'bg-teal-500' },
      { label: 'Entre casillas origen', value: entreCasillas, pct: Math.round((entreCasillas / total) * 100), dot: 'bg-purple-500', bar: 'bg-purple-500' },
      { label: 'Entrega directa a Perú', value: ddpDirecto, pct: Math.round((ddpDirecto / total) * 100), dot: 'bg-amber-500', bar: 'bg-amber-500' },
    ];
  }, [enviosPorLinea]);

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

    // S42 Tanda 9 — Pills filtro (mockup s40 líneas 2074-2077)
    // S42aj — +tramo1 (envíos con origen=proveedor, reemplaza tab "Envíos Proveedor")
    if (pillFiltroEnv === 'activas') {
      lista = lista.filter(e => !['recibida_completa', 'cancelada'].includes(e.estado));
    } else if (pillFiltroEnv === 'incidencias') {
      lista = lista.filter(e => {
        if ((e.totalUnidadesFaltantes || 0) > 0 || (e.totalUnidadesDanadas || 0) > 0) return true;
        if (e.estado === 'retenida_aduana' || e.estado === 'perdida_total') return true;
        if (Array.isArray(e.incidencias) && e.incidencias.some(i => !i.resuelta)) return true;
        return false;
      });
    } else if (pillFiltroEnv === 'tramo1') {
      lista = lista.filter(e => e.origenTipo === 'proveedor');
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

  const handleCrearEnvio = useCallback(async (data: EnvioFormData) => {
    if (!user) return;
    await crearEnvio(data, user.uid);
  }, [user, crearEnvio]);

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

  // Mapeo de estado → variante visual
  const estadoVariant = (estado: EstadoEnvio): 'neutral' | 'info' | 'warning' | 'success' | 'danger' => {
    const map: Record<EstadoEnvio, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
      borrador: 'neutral',
      confirmado: 'info',
      en_transito: 'warning',
      retenida_aduana: 'danger',
      recibida_parcial: 'warning',
      recibida_completa: 'success',
      perdida_total: 'danger',
      cancelada: 'danger',
    };
    return map[estado] ?? 'neutral';
  };

  const estadoLabel = (estado: EstadoEnvio): string => {
    const map: Record<EstadoEnvio, string> = {
      borrador: 'Borrador',
      confirmado: 'Confirmado',
      en_transito: 'En Transito',
      retenida_aduana: 'Aduana',
      recibida_parcial: 'Parcial',
      recibida_completa: 'Completa',
      perdida_total: 'Perdida',
      cancelada: 'Cancelada',
    };
    return map[estado] ?? estado;
  };

  // Columnas de la tabla
  const envioColumns: DataTableColumn<Envio>[] = [
    {
      key: 'numero',
      header: 'Numero',
      render: (e) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm font-medium text-slate-900">{e.numeroEnvio}</span>
          <span className="text-xs text-slate-500 capitalize">
            {e.tipo === 'internacional_peru' ? 'Internacional' : 'Interna'}
          </span>
        </div>
      ),
    },
    {
      key: 'ruta',
      header: 'Ruta',
      render: (e) => (
        <div className="flex items-center gap-1 text-sm text-slate-700">
          <span className="truncate max-w-[90px]" title={e.origenCasillaNombre ?? e.origenProveedorNombre}>
            {e.origenCasillaNombre ?? e.origenProveedorNombre ?? '—'}
          </span>
          <ArrowRightLeft className="h-3 w-3 text-slate-400 shrink-0" />
          <span className="truncate max-w-[90px]" title={e.destinoCasillaNombre}>
            {e.destinoCasillaNombre}
          </span>
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (e) => (
        <StatusBadge variant={estadoVariant(e.estado)} dot>
          {estadoLabel(e.estado)}
        </StatusBadge>
      ),
    },
    {
      key: 'unidades',
      header: 'Unidades',
      align: 'right',
      render: (e) => (
        <span className="text-sm text-slate-700">{e.totalUnidades ?? e.unidades?.length ?? 0}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'flete',
      header: 'Flete',
      align: 'right',
      render: (e) => (
        <span className="text-sm text-slate-700">
          {e.costoFleteTotal != null
            ? `$${e.costoFleteTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
            : '—'}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'fecha',
      header: 'Fecha',
      align: 'right',
      render: (e) => (
        <span className="text-sm text-slate-500">
          {e.fechaCreacion?.toDate
            ? e.fechaCreacion.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit' })
            : '—'}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'acciones',
      header: '',
      align: 'right',
      render: (e) => (
        <div className="flex items-center justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
          {e.estado === 'borrador' && (
            <button
              onClick={() => handleConfirmar(e.id)}
              className="text-xs px-2 py-1 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
            >
              Confirmar
            </button>
          )}
          {e.estado === 'confirmado' && (
            <button
              onClick={() => handleEnviar(e.id)}
              className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
            >
              Enviar
            </button>
          )}
          {(e.estado === 'en_transito' || e.estado === 'recibida_parcial') && (
            <button
              onClick={() => handleIniciarRecepcion(e)}
              className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              Recibir
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Envíos"
        subtitle="Hub logístico · Todos los movimientos físicos del negocio"
        icon={ArrowRightLeft}
        actions={
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              onClick={() => {
                fetchEnvios();
                fetchEnTransito();
                fetchPendientesRecepcion();
                fetchResumen();
              }}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
            {/* S42bf — Botón Exportar (auditoría mockup S40 L1934) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportService.exportEnvios(enviosPorLinea)}
              disabled={enviosPorLinea.length === 0}
            >
              <Download className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Envio
            </Button>
            {/* S44 — Botón del Wizard T2 (Casilla Intl → Almacén Perú).
                Visible sólo con feature flag WIZARD_T2 activa (ver config/features.ts) */}
            {wizardT2Enabled && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/envios/nuevo-t2')}
                title="Wizard T2 (S44) — Consolida unidades de una casilla internacional y envíalas a Perú"
              >
                <Package className="h-4 w-4 mr-2" />
                Casilla a Perú
              </Button>
            )}
            {/* S47 — Botón del Wizard J (Casilla Intl ↔ Casilla Intl).
                Visible sólo con feature flag WIZARD_J activa */}
            {wizardJEnabled && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/envios/nuevo-j')}
                title="Wizard J (S47) — Mueve unidades entre dos casillas internacionales (mismo colaborador o entre colaboradores)"
              >
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Entre casillas
              </Button>
            )}
            {/* S48 — Botón del Wizard E (Traslado interno Perú ↔ Perú).
                Visible sólo con feature flag WIZARD_E activa */}
            {wizardEEnabled && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/envios/nuevo-e')}
                title="Wizard E (S48) — Traslado interno entre dos almacenes Perú (consolidación, capacidad, costo menor, etc.)"
              >
                <Truck className="h-4 w-4 mr-2" />
                Traslado interno
              </Button>
            )}
          </div>
        }
      />

      {/* S40 Bloque D: Tabs módulo logístico — Operaciones / Proveedor / Incidencias / Reclamos / Costos / Rendimiento */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit flex-wrap">
        <EnviosTabButton
          active={tabEnvios === 'operaciones'}
          onClick={() => setTabEnvios('operaciones')}
          icon={ArrowRightLeft}
          label="Operaciones"
        />
        {/* S42aj — Tab "Envíos Proveedor" eliminado. El acceso queda como pill
            "Tramo 1 (Proveedor)" dentro del tab Operaciones. */}
        <EnviosTabButton
          active={tabEnvios === 'incidencias'}
          onClick={() => setTabEnvios('incidencias')}
          icon={AlertTriangle}
          label="Incidencias"
          badge={resumen?.enviosConIncidencias || 0}
          badgeColor="red"
        />
        <EnviosTabButton
          active={tabEnvios === 'reclamos'}
          onClick={() => setTabEnvios('reclamos')}
          icon={Gavel}
          label="Reclamos"
          badge={resumenReclamos?.reclamosPendientes || 0}
          badgeColor="amber"
        />
        <EnviosTabButton
          active={tabEnvios === 'costos'}
          onClick={() => setTabEnvios('costos')}
          icon={DollarSign}
          label="Costos Landed"
        />
        <EnviosTabButton
          active={tabEnvios === 'rendimiento'}
          onClick={() => setTabEnvios('rendimiento')}
          icon={BarChart3}
          label="Rendimiento"
        />
      </div>

      {tabEnvios === 'reclamos' ? (
        <TabReclamos />
      ) : tabEnvios === 'incidencias' ? (
        <TabIncidencias />
      ) : tabEnvios === 'costos' ? (
        <TabCostosLanded />
      ) : tabEnvios === 'rendimiento' ? (
        <TabRendimiento />
      ) : (
      <>
      {/* S42 Tanda 9 — KPIs alineados al mockup (líneas 1948-1998) */}
      <DSKPIBar columns={6}>
        <DSStatCard
          label="Total"
          value={enviosPorLinea.length}
          icon={ArrowRightLeft}
          variant="neutral"
          subtitle="envíos activos"
        />
        <DSStatCard
          label="En tránsito"
          value={resumen?.enTransito || 0}
          icon={Truck}
          variant="info"
          onClick={() => setActiveTab('en_transito')}
          active={activeTab === 'en_transito'}
          subtitle={enviosStatsExtra.unidadesEnTransito > 0
            ? `${enviosStatsExtra.unidadesEnTransito} unidades`
            : 'en camino'}
        />
        <DSStatCard
          label="Pendientes"
          value={resumen?.pendientesRecepcion || 0}
          icon={Clock}
          variant="warning"
          onClick={() => setActiveTab('pendientes')}
          active={activeTab === 'pendientes'}
          subtitle="recepción parcial"
        />
        <DSStatCard
          label="Incidencias"
          value={resumen?.enviosConIncidencias || 0}
          icon={AlertTriangle}
          variant={resumen?.enviosConIncidencias ? 'danger' : 'neutral'}
          onClick={() => setActiveTab('incidencias')}
          active={activeTab === 'incidencias'}
          subtitle="sin resolver"
        />
        <DSStatCard
          label="En reclamo"
          value={resumenReclamos?.reclamosPendientes || 0}
          icon={Gavel}
          variant={resumenReclamos && resumenReclamos.reclamosPendientes > 0 ? 'warning' : 'neutral'}
          onClick={() => setTabEnvios('reclamos')}
          subtitle={resumenReclamos && resumenReclamos.totalReclamadoPEN > 0
            ? `S/ ${resumenReclamos.totalReclamadoPEN.toLocaleString('es-PE', { maximumFractionDigits: 0 })} pendiente`
            : 'sin reclamos'}
        />
        <DSStatCard
          label="Valor landed"
          value={enviosStatsExtra.tc > 0
            ? `S/ ${enviosStatsExtra.valorLandedPEN.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`
            : `$${valorEnTransito.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          variant="success"
          subtitle="total prorrateado"
        />
      </DSKPIBar>

      {/* S42 Tanda 9 — Dashboard 2-col: Breakdown por tipo + Pipeline logístico horizontal (mockup líneas 2000-2070) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Breakdown por tipo */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Distribución por tipo</h3>
          <div className="space-y-2">
            {breakdownPorTipo.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <span className={`w-2 h-2 rounded-full ${item.dot}`}></span>
                    {item.label}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {item.value} <span className="text-slate-400 font-normal">({item.pct}%)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className={`${item.bar} h-2 rounded-full transition-all`} style={{ width: `${item.pct}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline logístico horizontal */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Pipeline logístico</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPipelineStage(pipelineStage === 'borrador' ? null : 'borrador')}
              className={`flex-1 rounded-lg p-2 text-center transition-colors ${
                pipelineStage === 'borrador' ? 'bg-slate-200 ring-2 ring-slate-400' : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              <FileText className="h-4 w-4 text-slate-600 mx-auto" />
              <div className="text-[10px] text-slate-600 mt-0.5">Borrador</div>
              <div className="text-sm font-bold text-slate-900">{pipelineStages[0]?.count || 0}</div>
            </button>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <button
              type="button"
              onClick={() => setPipelineStage(pipelineStage === 'confirmado' ? null : 'confirmado')}
              className={`flex-1 rounded-lg p-2 text-center border transition-colors ${
                pipelineStage === 'confirmado' ? 'bg-amber-100 border-amber-300 ring-2 ring-amber-300' : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Package className="h-4 w-4 text-amber-600 mx-auto" />
              <div className="text-[10px] text-amber-700 mt-0.5">Confirmado</div>
              <div className="text-sm font-bold text-slate-900">{pipelineStages[1]?.count || 0}</div>
            </button>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <button
              type="button"
              onClick={() => setPipelineStage(pipelineStage === 'en_transito' ? null : 'en_transito')}
              className={`flex-1 rounded-lg p-2 text-center border transition-colors ${
                pipelineStage === 'en_transito' ? 'bg-sky-100 border-sky-300 ring-2 ring-sky-300' : 'bg-sky-50 border-sky-200 hover:bg-sky-100'
              }`}
            >
              <Truck className="h-4 w-4 text-sky-600 mx-auto" />
              <div className="text-[10px] text-sky-700 mt-0.5">En tránsito</div>
              <div className="text-sm font-bold text-slate-900">{pipelineStages[2]?.count || 0}</div>
            </button>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <button
              type="button"
              onClick={() => setPipelineStage(pipelineStage === 'recibida' ? null : 'recibida')}
              className={`flex-1 rounded-lg p-2 text-center border transition-colors ${
                pipelineStage === 'recibida' ? 'bg-emerald-100 border-emerald-300 ring-2 ring-emerald-300' : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
              <div className="text-[10px] text-emerald-700 mt-0.5">Recibida</div>
              <div className="text-sm font-bold text-slate-900">{pipelineStages[3]?.count || 0}</div>
            </button>
          </div>
          {resumen?.completadasMes != null && (
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 text-center">
              Completadas este mes: <b className="text-slate-700">{resumen.completadasMes}</b>
              {enviosPorLinea.length > 0 && (
                <> · Fill rate: <b className="text-emerald-700">
                  {Math.round(((pipelineStages[3]?.count || 0) / enviosPorLinea.length) * 100)}%
                </b></>
              )}
            </div>
          )}
        </div>
      </div>

      {/* S42 Tanda 9 — Pills filtros + dropdowns (mockup líneas 2072-2092) */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">Filtrar:</span>
        <button
          type="button"
          onClick={() => setPillFiltroEnv('todas')}
          className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
            pillFiltroEnv === 'todas' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Todas <span className="ml-1 opacity-75">({enviosPorLinea.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setPillFiltroEnv('activas')}
          className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
            pillFiltroEnv === 'activas' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Activas ({enviosStatsExtra.countActivas})
        </button>
        <button
          type="button"
          onClick={() => setPillFiltroEnv('incidencias')}
          className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
            pillFiltroEnv === 'incidencias' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Con incidencias ({enviosStatsExtra.countIncidencias})
        </button>
        {/* S42aj — Pill que reemplaza el tab "Envíos Proveedor" */}
        <button
          type="button"
          onClick={() => setPillFiltroEnv('tramo1')}
          title="Envíos con origen proveedor (Tramo 1 — lo que el proveedor te envía a la casilla)"
          className={`px-2.5 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
            pillFiltroEnv === 'tramo1' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Package className="w-3 h-3" />
          Tramo 1 · Proveedor ({enviosStatsExtra.countTramo1})
        </button>
        <select
          value={filtroCourier}
          onChange={(e) => setFiltroCourier(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
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

      {/* S47 — Pills por tipo de ruta logística A-J (Modelo Envíos Transversal) */}
      <div className="flex items-center gap-2 flex-wrap mt-2">
        <span className="text-xs text-slate-500">Tipo de ruta:</span>
        <button
          type="button"
          onClick={() => setFiltroTipoRuta('')}
          className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
            filtroTipoRuta === '' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          title="Ver todos los tipos de ruta"
        >
          Todos
        </button>
        {(Object.keys(INFO_TIPO_RUTA) as TipoRutaLogistica[]).map((codigo) => {
          const info = INFO_TIPO_RUTA[codigo];
          const count = enviosStatsExtra.countsPorTipoRuta[codigo] || 0;
          const activo = filtroTipoRuta === codigo;
          // Ocultar pills sin envíos clasificables (E/F/G/I por ahora) salvo que estén seleccionados
          if (count === 0 && !activo) return null;
          return (
            <button
              key={codigo}
              type="button"
              onClick={() => setFiltroTipoRuta(activo ? '' : codigo)}
              title={info.nombreLargo}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors flex items-center gap-1.5 ${
                activo
                  ? 'bg-teal-600 text-white ring-2 ring-teal-300'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span className="font-mono text-[10px] opacity-70">{codigo}</span>
              <span className="text-[11px]">{info.icono}</span>
              <span>{info.nombreCorto}</span>
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

      {/* Toolbar */}
      <Toolbar
        search={{ value: busqueda, onChange: setBusqueda, placeholder: 'Buscar envios...' }}
        filterCount={[filtroTipo !== 'todas' ? filtroTipo : '', filtroEstado, activeTab !== 'todas' ? activeTab : ''].filter(Boolean).length}
        onFilterToggle={() => setShowFilters(true)}
        resultCount={enviosFiltrados.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
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
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-5 w-5 mr-2" />
                Nuevo Envio
              </Button>
            )}
          </div>
        </Card>
      ) : viewMode === 'card' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enviosFiltrados.slice(0, itemsVisiblesEnv).map(envio => (
              <EnvioCard
                key={envio.id}
                envio={envio}
                productosMap={productosMapGlobal}
                onSelect={setSelectedEnvio}
                onConfirmar={handleConfirmar}
                onEnviar={handleEnviar}
                onCancelar={handleCancelar}
                onIniciarRecepcion={handleIniciarRecepcion}
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
                className="text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline"
              >
                Cargar más
              </button>
            </div>
          )}
        </>
      ) : (
        <Card padding="none">
          <DataTable
            columns={envioColumns}
            data={enviosFiltrados}
            keyExtractor={(e) => e.id}
            onRowClick={(e) => setSelectedEnvio(e)}
            compact
            emptyMessage="No hay envios con los filtros actuales"
          />
        </Card>
      )}

      {/* Wizard V2 — Rework S41: Ruta → Productos → Confirmar (Opción A) */}
      <EnvioWizardV2
        isOpen={showCreateModal}
        loading={loading}
        casillasOrigen={almacenesOrigen}
        casillasDestinoPeru={almacenesDestinoPeru}
        colaboradores={viajeros}
        productosMap={productosMapGlobal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCrearEnvio}
      />

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
        const pagosAnteriores = envioParaPago.pagosColaborador ?? [];
        const pagadoUSD = pagosAnteriores.reduce((s, p) => s + (p.montoUSD || 0), 0);
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
                pagosAnteriores={pagosAnteriores.map(p => ({
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
      </>
      )}
    </PageShell>
  );
};

// ─── Helper component: botón de tab unificado ─────────────────────────────
interface EnviosTabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  badge?: number;
  badgeColor?: 'red' | 'amber';
}

const EnviosTabButton: React.FC<EnviosTabButtonProps> = ({ active, onClick, icon: Icon, label, badge, badgeColor = 'red' }) => {
  const badgeClass = badgeColor === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${badgeClass}`}>
          {badge}
        </span>
      )}
    </button>
  );
};
