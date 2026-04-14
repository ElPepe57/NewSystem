import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
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
} from "lucide-react";
import { LineaDropdown } from '../../components/common/LineaDropdown';
import {
  Button,
  Card,
  ConfirmDialog,
  useConfirmDialog,
  PipelineHeader,
  StatDistribution,
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
import { CreateEnvioModal } from "./CreateEnvioModal";
import { RecepcionModal } from "./RecepcionModal";
import { PagoUnificadoForm } from '../../components/modules/pagos/PagoUnificadoForm';
import type { PagoUnificadoResult } from '../../components/modules/pagos/PagoUnificadoForm';
import { EditFleteModal } from "./EditFleteModal";
import { EnvioDetailModal } from "./EnvioDetailModal";
import { EnviosProveedorTab } from "./EnviosProveedorTab";

type TabEnvios = 'envios' | 'proveedor';

export const Envios: React.FC = () => {
  const [tabEnvios, setTabEnvios] = useState<TabEnvios>('envios');
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

  // Estado de vista
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');

  // Estado de filtros
  const [activeTab, setActiveTab] = useState<'todas' | 'en_transito' | 'pendientes'>('todas');
  const [filtroTipo, setFiltroTipo] = useState<TipoEnvio | 'todas'>('todas');
  const [filtroEstado, setFiltroEstado] = useState<EstadoEnvio | ''>('');
  const [busqueda, setBusqueda] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);

  const [cuentasTesoreria, setCuentasTesoreria] = useState<CuentaCaja[]>([]);
  const { dialogProps, confirm: confirmDialog } = useConfirmDialog();
  const [searchParams, setSearchParams] = useSearchParams();

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
    getTCDelDia().then(tc => setTipoCambioActual(tc ? { tasaVenta: tc.venta } : null)).catch(console.error);
    tesoreriaService.getCuentas().then(setCuentasTesoreria).catch(console.error);
  }, [fetchEnvios, fetchEnTransito, fetchPendientesRecepcion, fetchResumen, fetchAlmacenesUSA, fetchAlmacenesPeru, fetchViajeros, getTCDelDia]);

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

  // Filtrar envios
  const enviosFiltrados = useMemo(() => {
    let lista = activeTab === 'en_transito'
      ? enviosEnTransitoPorLinea
      : activeTab === 'pendientes'
        ? enviosPendientesPorLinea
        : enviosPorLinea;

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
        return numeroEnvio.includes(term) ||
               origenNombre.includes(term) ||
               destinoNombre.includes(term);
      });
    }

    return lista;
  }, [activeTab, enviosEnTransitoPorLinea, enviosPendientesPorLinea, enviosPorLinea,
      pipelineStage, filtroTipo, filtroEstado, busqueda]);

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

  const handleEnviar = useCallback(async (id: string) => {
    if (!user) return;
    const confirmed = await confirmDialog({
      title: 'Marcar como Enviado',
      message: 'Marcar este envio como en transito?',
      confirmText: 'Enviar',
      variant: 'info',
    });
    if (confirmed) {
      await enviarEnvio(id, { fechaSalida: new Date() }, user.uid);
    }
  }, [user, confirmDialog, enviarEnvio]);

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

  const handleRegistrarRecepcion = useCallback(async (data: RecepcionEnvioFormData) => {
    if (!user) return;
    try {
      // Recepcion se registra via el servicio de recepcion directamente por ahora
      // El store tiene registrarRecepcion pero la accion es del servicio
      const { envioRecepcionService } = await import('../../services/envio.recepcion.service');
      await envioRecepcionService.registrarRecepcion(data, user.uid);
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
        title="Envios"
        subtitle="Gestiona el movimiento de productos entre casillas"
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
            <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Envio
            </Button>
          </div>
        }
        stats={[
          { label: 'Total', value: enviosPorLinea.length },
          { label: 'En Transito', value: resumen?.enTransito || 0 },
          { label: 'Pendientes', value: resumen?.pendientesRecepcion || 0 },
          { label: 'Completadas', value: resumen?.completadasMes || 0 },
        ]}
      />

      {/* Tabs: Envios vs Envios Proveedor */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={() => setTabEnvios('envios')}
          className={`px-4 py-2 text-xs font-medium rounded-md transition-colors ${
            tabEnvios === 'envios'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5 inline mr-1.5" />
          Envios
        </button>
        <button
          type="button"
          onClick={() => setTabEnvios('proveedor')}
          className={`px-4 py-2 text-xs font-medium rounded-md transition-colors ${
            tabEnvios === 'proveedor'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Package className="w-3.5 h-3.5 inline mr-1.5" />
          Envios Proveedor
        </button>
      </div>

      {tabEnvios === 'proveedor' ? (
        <EnviosProveedorTab />
      ) : (
      <>
      {/* StatCards interactivos */}
      <DSKPIBar columns={6}>
        <DSStatCard label="Total" value={enviosPorLinea.length} icon={ArrowRightLeft} variant="neutral" />
        <DSStatCard label="En Transito" value={resumen?.enTransito || 0} icon={Truck} variant="info" onClick={() => setActiveTab('en_transito')} active={activeTab === 'en_transito'} />
        <DSStatCard label="Pendientes" value={resumen?.pendientesRecepcion || 0} icon={Clock} variant="warning" onClick={() => setActiveTab('pendientes')} active={activeTab === 'pendientes'} />
        <DSStatCard label="Completadas" value={resumen?.completadasMes || 0} icon={CheckCircle} variant="success" />
        <DSStatCard label="Incidencias" value={resumen?.enviosConIncidencias || 0} icon={AlertTriangle} variant={resumen?.enviosConIncidencias ? 'danger' : 'neutral'} />
        <DSStatCard label="Valor USD" value={valorEnTransito > 0 ? `$${valorEnTransito.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '$0'} icon={DollarSign} variant="brand" />
      </DSKPIBar>

      {/* Distribucion Visual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatDistribution
          title="Estado de Envios"
          data={[
            { label: 'Borrador', value: pipelineStages[0]?.count || 0, color: 'bg-slate-400' },
            { label: 'Confirmado', value: pipelineStages[1]?.count || 0, color: 'bg-yellow-500' },
            { label: 'En Transito', value: pipelineStages[2]?.count || 0, color: 'bg-sky-500' },
            { label: 'Recibida', value: pipelineStages[3]?.count || 0, color: 'bg-emerald-500' },
          ]}
        />
        <StatDistribution
          title="Tipo de Envios"
          data={[
            { label: 'Internacional Peru', value: enviosPorLinea.filter(e => e.tipo === 'internacional_peru').length, color: 'bg-sky-500' },
            { label: 'Interna Origen', value: enviosPorLinea.filter(e => e.tipo === 'interna_origen').length, color: 'bg-slate-500' },
          ]}
        />
      </div>

      {/* Pipeline visual de estados */}
      <PipelineHeader
        stages={pipelineStages}
        activeStage={pipelineStage}
        onStageClick={setPipelineStage}
        title="Flujo de Envios"
      />

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
          <select className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" value={activeTab} onChange={e => setActiveTab(e.target.value as 'todas' | 'en_transito' | 'pendientes')}>
            <option value="todas">Todos los envios</option>
            <option value="en_transito">En transito</option>
            <option value="pendientes">Pendientes recepcion</option>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {enviosFiltrados.map(envio => (
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

      {/* Modal: Crear envio */}
      <CreateEnvioModal
        isOpen={showCreateModal}
        loading={loading}
        almacenesOrigen={almacenesOrigen}
        almacenesDestinoPeru={almacenesDestinoPeru}
        viajeros={viajeros}
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

      {/* Dialogo de Confirmacion */}
      <ConfirmDialog {...dialogProps} />
      </>
      )}
    </PageShell>
  );
};
