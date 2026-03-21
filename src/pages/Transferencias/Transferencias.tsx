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
import {
  Button,
  Card,
  ConfirmDialog,
  useConfirmDialog,
  PipelineHeader,
  GradientHeader,
  StatCard,
  StatDistribution,
} from "../../components/common";
import type { PipelineStage } from "../../components/common";
import { FileText, CheckCircle2, XOctagon } from "lucide-react";
import { useTransferenciaStore } from "../../store/transferenciaStore";
import { useProductoStore } from "../../store/productoStore";
import { useAlmacenStore } from "../../store/almacenStore";
import { useAuthStore } from "../../store/authStore";
import { tesoreriaService } from "../../services/tesoreria.service";
import { useTipoCambioStore } from "../../store/tipoCambioStore";
import type {
  Transferencia,
  TipoTransferencia,
  EstadoTransferencia,
  TransferenciaFormData,
  RecepcionFormData,
} from "../../types/transferencia.types";
import type { CuentaCaja, MetodoTesoreria } from "../../types/tesoreria.types";
import { esTipoTransferenciaInterna, esTipoTransferenciaInternacional, esPaisOrigen } from "../../utils/multiOrigen.helpers";
import { useLineaNegocioStore } from "../../store/lineaNegocioStore";

// Sub-componentes extraidos
import { TransferenciaCard } from "./TransferenciaCard";
import { CreateTransferenciaModal } from "./CreateTransferenciaModal";
import { RecepcionModal } from "./RecepcionModal";
import { PagoViajeroModal } from "./PagoViajeroModal";
import { EditFleteModal } from "./EditFleteModal";
import { TransferenciaDetailModal } from "./TransferenciaDetailModal";
import { TransferenciaFilters } from "./TransferenciaFilters";

export const Transferencias: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const {
    transferencias,
    transferenciasEnTransito,
    transferenciasPendientes,
    resumen,
    loading,
    fetchTransferencias,
    fetchEnTransito,
    fetchPendientesRecepcion,
    fetchResumen,
    crearTransferencia,
    confirmarTransferencia,
    enviarTransferencia,
    registrarRecepcion,
    cancelarTransferencia,
    registrarPagoViajero,
    actualizarFlete,
    reconciliarPagoViajero,
  } = useTransferenciaStore();

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

  // Almacenes dinamicos por tipo
  const almacenesOrigen = useMemo(() =>
    todosAlmacenes.filter(a => a.estadoAlmacen === 'activo' && esPaisOrigen(a.pais)),
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
  const [transferenciaParaRecepcion, setTransferenciaParaRecepcion] = useState<Transferencia | null>(null);
  const [transferenciaParaPago, setTransferenciaParaPago] = useState<Transferencia | null>(null);
  const [selectedTransferencia, setSelectedTransferencia] = useState<Transferencia | null>(null);
  const [showEditFleteModal, setShowEditFleteModal] = useState(false);
  const [transferenciaParaFlete, setTransferenciaParaFlete] = useState<Transferencia | null>(null);

  // Estado de filtros
  const [activeTab, setActiveTab] = useState<'todas' | 'en_transito' | 'pendientes'>('todas');
  const [filtroTipo, setFiltroTipo] = useState<TipoTransferencia | 'todas'>('todas');
  const [filtroEstado, setFiltroEstado] = useState<EstadoTransferencia | 'todas'>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);

  const [cuentasTesoreria, setCuentasTesoreria] = useState<CuentaCaja[]>([]);
  const lineaFiltroGlobal = useLineaNegocioStore(state => state.lineaFiltroGlobal);
  const { dialogProps, confirm: confirmDialog } = useConfirmDialog();
  const [searchParams, setSearchParams] = useSearchParams();

  // Carga inicial de datos
  useEffect(() => {
    fetchTransferencias();
    fetchEnTransito();
    fetchPendientesRecepcion();
    fetchResumen();
    fetchTodosAlmacenes();
    fetchAlmacenesUSA();
    fetchAlmacenesPeru();
    fetchViajeros();
    getTCDelDia().then(tc => setTipoCambioActual(tc ? { tasaVenta: tc.venta } : null)).catch(console.error);
    tesoreriaService.getCuentas().then(setCuentasTesoreria).catch(console.error);
  }, [fetchTransferencias, fetchEnTransito, fetchPendientesRecepcion, fetchResumen, fetchAlmacenesUSA, fetchAlmacenesPeru, fetchViajeros, getTCDelDia]);

  useEffect(() => {
    if (todosProductos.length === 0) fetchProductos();
  }, [todosProductos.length, fetchProductos]);

  // Deep-link desde query param (ej. desde Tesoreria CxP)
  useEffect(() => {
    const transferenciaId = searchParams.get('transferenciaId');
    if (transferenciaId && transferencias.length > 0) {
      const found = transferencias.find(t => t.id === transferenciaId);
      if (found) {
        setSelectedTransferencia(found);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, transferencias, setSearchParams]);

  // Pipeline stages para visualizacion
  const pipelineStages: PipelineStage[] = useMemo(() => {
    const contarPorEstado = (estados: EstadoTransferencia[]) =>
      transferencias.filter(t => estados.includes(t.estado)).length;

    return [
      {
        id: 'borrador',
        label: 'Borrador',
        count: contarPorEstado(['borrador']),
        color: 'gray' as const,
        icon: <FileText className="h-4 w-4" />,
      },
      {
        id: 'preparando',
        label: 'Preparando',
        count: contarPorEstado(['preparando']),
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
  }, [transferencias]);

  // Calcular valor total en transito
  const valorEnTransito = useMemo(() => {
    return transferenciasEnTransito.reduce((total, t) => {
      const valorTransferencia = t.productosSummary?.reduce((sum, p) => sum + ((p as { costoTotalUSD?: number }).costoTotalUSD || 0), 0) || 0;
      return total + valorTransferencia;
    }, 0);
  }, [transferenciasEnTransito]);

  // Filtrar transferencias
  const transferenciasFiltradas = useMemo(() => {
    let lista = activeTab === 'en_transito'
      ? transferenciasEnTransito
      : activeTab === 'pendientes'
        ? transferenciasPendientes
        : transferencias;

    if (lineaFiltroGlobal) {
      lista = lista.filter(t => !t.lineaNegocioId || t.lineaNegocioId === lineaFiltroGlobal);
    }

    if (pipelineStage) {
      if (pipelineStage === 'recibida') {
        lista = lista.filter(t => t.estado === 'recibida_parcial' || t.estado === 'recibida_completa');
      } else {
        lista = lista.filter(t => t.estado === pipelineStage);
      }
    }

    if (filtroTipo !== 'todas') {
      if (filtroTipo === 'internacional_peru' || filtroTipo === 'usa_peru') {
        lista = lista.filter(t => esTipoTransferenciaInternacional(t.tipo));
      } else if (filtroTipo === 'interna_origen' || filtroTipo === 'interna_usa') {
        lista = lista.filter(t => esTipoTransferenciaInterna(t.tipo));
      } else {
        lista = lista.filter(t => t.tipo === filtroTipo);
      }
    }

    if (filtroEstado !== 'todas') {
      lista = lista.filter(t => t.estado === filtroEstado);
    }

    if (busqueda) {
      const term = busqueda.toLowerCase();
      lista = lista.filter(t => {
        const numeroTransferencia = (t.numeroTransferencia ?? '').toLowerCase();
        const almacenOrigenNombre = (t.almacenOrigenNombre ?? '').toLowerCase();
        const almacenDestinoNombre = (t.almacenDestinoNombre ?? '').toLowerCase();
        return numeroTransferencia.includes(term) ||
               almacenOrigenNombre.includes(term) ||
               almacenDestinoNombre.includes(term);
      });
    }

    return lista;
  }, [activeTab, transferenciasEnTransito, transferenciasPendientes, transferencias,
      lineaFiltroGlobal, pipelineStage, filtroTipo, filtroEstado, busqueda]);

  // Handlers de acciones
  const handleConfirmar = useCallback(async (id: string) => {
    if (!user) return;
    const confirmed = await confirmDialog({
      title: 'Confirmar Transferencia',
      message: 'Confirmar esta transferencia para preparacion?',
      confirmText: 'Confirmar',
      variant: 'info',
    });
    if (confirmed) {
      await confirmarTransferencia(id, user.uid);
    }
  }, [user, confirmDialog, confirmarTransferencia]);

  const handleEnviar = useCallback(async (id: string) => {
    if (!user) return;
    const confirmed = await confirmDialog({
      title: 'Enviar Transferencia',
      message: 'Marcar esta transferencia como enviada?',
      confirmText: 'Enviar',
      variant: 'info',
    });
    if (confirmed) {
      await enviarTransferencia(id, { fechaSalida: new Date() }, user.uid);
    }
  }, [user, confirmDialog, enviarTransferencia]);

  const handleCancelar = useCallback(async (id: string) => {
    if (!user) return;
    const motivo = prompt("Ingrese el motivo de cancelacion:");
    if (motivo) {
      await cancelarTransferencia(id, motivo, user.uid);
    }
  }, [user, cancelarTransferencia]);

  const handleIniciarRecepcion = useCallback((transferencia: Transferencia) => {
    setTransferenciaParaRecepcion(transferencia);
    setSelectedTransferencia(null);
    setShowRecepcionModal(true);
  }, []);

  const handleAbrirPagoViajero = useCallback((transferencia: Transferencia) => {
    setTransferenciaParaPago(transferencia);
    setSelectedTransferencia(null);
    setShowPagoModal(true);
  }, []);

  const handleAbrirEditFlete = useCallback((transferencia: Transferencia) => {
    setTransferenciaParaFlete(transferencia);
    setShowEditFleteModal(true);
  }, []);

  const handleReconciliarPago = useCallback(async (transferencia: Transferencia) => {
    if (!user) return;
    try {
      await reconciliarPagoViajero(transferencia.id, user.uid);
      setSelectedTransferencia(null);
      alert('Pago sincronizado correctamente en Tesoreria');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      alert(msg);
    }
  }, [user, reconciliarPagoViajero]);

  const handleCrearTransferencia = useCallback(async (data: TransferenciaFormData) => {
    if (!user) return;
    await crearTransferencia(data, user.uid);
  }, [user, crearTransferencia]);

  const handleRegistrarRecepcion = useCallback(async (data: RecepcionFormData) => {
    if (!user) return;
    try {
      await registrarRecepcion(data, user.uid);
      setShowRecepcionModal(false);
      setTransferenciaParaRecepcion(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert('Error: ' + message);
    }
  }, [user, registrarRecepcion]);

  const handleRegistrarPagoViajero = useCallback(async (datos: {
    fechaPago: Date;
    monedaPago: 'USD' | 'PEN';
    montoOriginal: number;
    tipoCambio: number;
    metodoPago: MetodoTesoreria;
    cuentaOrigenId?: string;
    referencia?: string;
    notas?: string;
  }) => {
    if (!user || !transferenciaParaPago) return;
    try {
      await registrarPagoViajero(transferenciaParaPago.id, datos, user.uid);
      setShowPagoModal(false);
      setTransferenciaParaPago(null);
      alert('Pago al viajero registrado correctamente');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert('Error: ' + message);
    }
  }, [user, transferenciaParaPago, registrarPagoViajero]);

  const handleActualizarFlete = useCallback(async (costoFletePorProducto: Record<string, number>) => {
    if (!user || !transferenciaParaFlete) return;
    try {
      await actualizarFlete(transferenciaParaFlete.id, costoFletePorProducto, user.uid);
      setShowEditFleteModal(false);
      setTransferenciaParaFlete(null);
      setSelectedTransferencia(null);
      alert('Flete actualizado correctamente');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert('Error: ' + message);
    }
  }, [user, transferenciaParaFlete, actualizarFlete]);

  return (
    <div className="space-y-6">
      {/* Header con Gradiente */}
      <GradientHeader
        title="Transferencias"
        subtitle="Gestiona el movimiento de productos entre almacenes"
        icon={ArrowRightLeft}
        variant="dark"
        actions={
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              onClick={() => {
                fetchTransferencias();
                fetchEnTransito();
                fetchPendientesRecepcion();
                fetchResumen();
              }}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Transferencia
            </Button>
          </div>
        }
        stats={[
          { label: 'Total', value: transferencias.length },
          { label: 'En Transito', value: resumen?.enTransito || 0 },
          { label: 'Pendientes', value: resumen?.pendientesRecepcion || 0 },
          { label: 'Completadas', value: resumen?.completadasMes || 0 },
        ]}
      />

      {/* StatCards interactivos */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          label="Total"
          value={transferencias.length}
          icon={ArrowRightLeft}
          variant="blue"
        />
        <StatCard
          label="En Transito"
          value={resumen?.enTransito || 0}
          icon={Truck}
          variant="blue"
          onClick={() => setActiveTab('en_transito')}
          active={activeTab === 'en_transito'}
        />
        <StatCard
          label="Pendientes"
          value={resumen?.pendientesRecepcion || 0}
          icon={Clock}
          variant="amber"
          onClick={() => setActiveTab('pendientes')}
          active={activeTab === 'pendientes'}
        />
        <StatCard
          label="Completadas"
          value={resumen?.completadasMes || 0}
          icon={CheckCircle}
          variant="green"
        />
        <StatCard
          label="Incidencias"
          value={resumen?.transferenciasConIncidencias || 0}
          icon={AlertTriangle}
          variant={resumen?.transferenciasConIncidencias ? 'red' : 'default'}
        />
        <StatCard
          label="Valor USD"
          value={valorEnTransito > 0 ? `$${valorEnTransito.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '$0'}
          icon={DollarSign}
          variant="green"
        />
      </div>

      {/* Distribucion Visual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatDistribution
          title="Estado de Transferencias"
          data={[
            { label: 'Borrador', value: pipelineStages[0]?.count || 0, color: 'bg-gray-400' },
            { label: 'Preparando', value: pipelineStages[1]?.count || 0, color: 'bg-yellow-500' },
            { label: 'En Transito', value: pipelineStages[2]?.count || 0, color: 'bg-blue-500' },
            { label: 'Recibida', value: pipelineStages[3]?.count || 0, color: 'bg-green-500' },
          ]}
        />
        <StatDistribution
          title="Tipo de Transferencias"
          data={[
            { label: 'Internacional → Peru', value: transferencias.filter(t => esTipoTransferenciaInternacional(t.tipo)).length, color: 'bg-blue-500' },
            { label: 'Interna Origen', value: transferencias.filter(t => esTipoTransferenciaInterna(t.tipo)).length, color: 'bg-gray-500' },
          ]}
        />
      </div>

      {/* Pipeline visual de estados */}
      <PipelineHeader
        stages={pipelineStages}
        activeStage={pipelineStage}
        onStageClick={setPipelineStage}
        title="Flujo de Transferencias"
      />

      {/* Tabs y Filtros */}
      <TransferenciaFilters
        activeTab={activeTab}
        filtroTipo={filtroTipo}
        filtroEstado={filtroEstado}
        busqueda={busqueda}
        totalTransferencias={transferencias.length}
        totalEnTransito={transferenciasEnTransito.length}
        totalPendientes={transferenciasPendientes.length}
        onTabChange={setActiveTab}
        onFiltroTipoChange={setFiltroTipo}
        onFiltroEstadoChange={setFiltroEstado}
        onBusquedaChange={setBusqueda}
      />

      {/* Lista de transferencias */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : transferenciasFiltradas.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-12">
            <ArrowRightLeft className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay transferencias
            </h3>
            <p className="text-gray-600 mb-6">
              {activeTab === 'en_transito'
                ? 'No hay transferencias en transito'
                : activeTab === 'pendientes'
                  ? 'No hay transferencias pendientes de recepcion'
                  : 'Crea tu primera transferencia para mover productos entre almacenes'
              }
            </p>
            {activeTab === 'todas' && (
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-5 w-5 mr-2" />
                Nueva Transferencia
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {transferenciasFiltradas.map(transferencia => (
            <TransferenciaCard
              key={transferencia.id}
              transferencia={transferencia}
              productosMap={productosMapGlobal}
              onSelect={setSelectedTransferencia}
              onConfirmar={handleConfirmar}
              onEnviar={handleEnviar}
              onCancelar={handleCancelar}
              onIniciarRecepcion={handleIniciarRecepcion}
            />
          ))}
        </div>
      )}

      {/* Modal: Crear transferencia */}
      <CreateTransferenciaModal
        isOpen={showCreateModal}
        loading={loading}
        almacenesOrigen={almacenesOrigen}
        almacenesDestinoPeru={almacenesDestinoPeru}
        viajeros={viajeros}
        productosMap={productosMapGlobal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCrearTransferencia}
      />

      {/* Modal: Detalle de transferencia */}
      {selectedTransferencia && (
        <TransferenciaDetailModal
          transferencia={selectedTransferencia}
          productosMap={productosMapGlobal}
          userId={user?.uid}
          onClose={() => setSelectedTransferencia(null)}
          onConfirmar={handleConfirmar}
          onEnviar={handleEnviar}
          onIniciarRecepcion={handleIniciarRecepcion}
          onAbrirPagoViajero={handleAbrirPagoViajero}
          onAbrirEditFlete={handleAbrirEditFlete}
          onReconciliarPago={handleReconciliarPago}
        />
      )}

      {/* Modal: Recepcion */}
      {showRecepcionModal && transferenciaParaRecepcion && (
        <RecepcionModal
          transferencia={transferenciaParaRecepcion}
          productosMap={productosMapGlobal}
          onClose={() => {
            setShowRecepcionModal(false);
            setTransferenciaParaRecepcion(null);
          }}
          onConfirm={handleRegistrarRecepcion}
        />
      )}

      {/* Modal: Pago al Viajero */}
      {showPagoModal && transferenciaParaPago && (
        <PagoViajeroModal
          transferencia={transferenciaParaPago}
          tipoCambioActual={tipoCambioActual}
          cuentasTesoreria={cuentasTesoreria}
          onClose={() => {
            setShowPagoModal(false);
            setTransferenciaParaPago(null);
          }}
          onConfirm={handleRegistrarPagoViajero}
        />
      )}

      {/* Modal: Editar Flete */}
      {showEditFleteModal && transferenciaParaFlete && (
        <EditFleteModal
          transferencia={transferenciaParaFlete}
          onClose={() => {
            setShowEditFleteModal(false);
            setTransferenciaParaFlete(null);
          }}
          onConfirm={handleActualizarFlete}
        />
      )}

      {/* Dialogo de Confirmacion */}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};
