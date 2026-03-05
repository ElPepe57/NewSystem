import React, { useEffect, useState, useMemo } from 'react';
import { Plus, ShoppingCart, DollarSign, TrendingUp, Package, CheckCircle, CreditCard, Calculator, PieChart, FileText, Truck, XCircle, Clock, Timer, Zap, PackageCheck, AlertTriangle } from 'lucide-react';
import { Button, Card, Modal, useConfirmDialog, ConfirmDialog, PipelineHeader, useActionModal, ActionModal, ErrorBoundary } from '../../components/common';
// Nota: ActionModal aún se usa para cancelar ventas
import type { PipelineStage } from '../../components/common';
import { useToastStore } from '../../store/toastStore';
import { VentaForm } from '../../components/modules/venta/VentaForm';
import { VentaTable } from '../../components/modules/venta/VentaTable';
import { VentaCard } from '../../components/modules/venta/VentaCard';
import { PagoVentaForm } from '../../components/modules/venta/PagoVentaForm';
import { GastosVentaForm } from '../../components/modules/venta/GastosVentaForm';
import { ProgramarEntregaModal } from '../../components/modules/venta/ProgramarEntregaModal';
import { EditarVentaModal } from '../../components/modules/venta/EditarVentaModal';
import { useVentaStore } from '../../store/ventaStore';
import { useAuthStore } from '../../store/authStore';
import { useRentabilidadVentas } from '../../hooks/useRentabilidadVentas';
import { gastoService } from '../../services/gasto.service';
import { VentaService } from '../../services/venta.service';
import { useEntregaStore } from '../../store/entregaStore';
import type { Venta, VentaFormData, MetodoPago, AdelantoData, EditarVentaData } from '../../types/venta.types';
import type { ProgramarEntregaData } from '../../types/entrega.types';

export const Ventas: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const {
    ventas,
    productosDisponibles,
    stats,
    resumenPagos,
    loading,
    fetchVentas,
    fetchProductosDisponibles,
    createCotizacion,
    createVenta,
    confirmarCotizacion,
    asignarInventario,
    marcarEntregada,
    cancelarVenta,
    deleteVenta,
    fetchStats,
    registrarPago,
    eliminarPago,
    fetchResumenPagos,
    iniciarSuscripcion: iniciarSuscripcionVentas,
    detenerSuscripcion: detenerSuscripcionVentas
  } = useVentaStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isPagoModalOpen, setIsPagoModalOpen] = useState(false);
  const [isGastosModalOpen, setIsGastosModalOpen] = useState(false);
  const [isEntregaModalOpen, setIsEntregaModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null);

  // Hook de rentabilidad con distribución proporcional de GA/GO
  const { datos: rentabilidad, getRentabilidadVenta, loading: loadingRentabilidad, refetch: refetchRentabilidad } = useRentabilidadVentas(ventas);

  // Store de entregas
  const {
    programarEntrega,
    iniciarSuscripcion: iniciarSuscripcionEntregas,
    detenerSuscripcion: detenerSuscripcionEntregas
  } = useEntregaStore();

  // Exponer corrección de canales en consola para admin
  useEffect(() => {
    (window as any).corregirCanalesVentas = () => VentaService.corregirCanalesVentas();
  }, []);

  // Hook para dialogo de confirmacion
  const { dialogProps, confirm } = useConfirmDialog();
  const { modalProps: actionModalProps, open: openActionModal } = useActionModal();
  const toast = useToastStore();

  // Pipeline stages para filtrado visual
  const pipelineStages: PipelineStage[] = useMemo(() => {
    const counts = {
      cotizacion: ventas.filter(v => v.estado === 'cotizacion').length,
      confirmada: ventas.filter(v => v.estado === 'confirmada').length,
      asignada: ventas.filter(v => v.estado === 'asignada').length,
      en_entrega: ventas.filter(v => v.estado === 'en_entrega').length,
      despachada: ventas.filter(v => v.estado === 'despachada').length,
      entregada: ventas.filter(v => v.estado === 'entregada').length,
      cancelada: ventas.filter(v => v.estado === 'cancelada').length
    };

    return [
      { id: 'cotizacion', label: 'Cotización', count: counts.cotizacion, color: 'gray', icon: <FileText className="h-4 w-4" /> },
      { id: 'confirmada', label: 'Confirmada', count: counts.confirmada, color: 'blue', icon: <CheckCircle className="h-4 w-4" /> },
      { id: 'asignada', label: 'Asignada', count: counts.asignada, color: 'purple', icon: <Package className="h-4 w-4" /> },
      { id: 'en_entrega', label: 'Programada', count: counts.en_entrega, color: 'yellow', icon: <Clock className="h-4 w-4" /> },
      { id: 'despachada', label: 'En Camino', count: counts.despachada, color: 'orange', icon: <Truck className="h-4 w-4" /> },
      { id: 'entregada', label: 'Entregada', count: counts.entregada, color: 'green', icon: <CheckCircle className="h-4 w-4" /> },
      { id: 'cancelada', label: 'Cancelada', count: counts.cancelada, color: 'red', icon: <XCircle className="h-4 w-4" /> }
    ];
  }, [ventas]);

  // Ventas filtradas
  const ventasFiltradas = useMemo(() => {
    if (!filtroEstado) return ventas;
    return ventas.filter(v => v.estado === filtroEstado);
  }, [ventas, filtroEstado]);

  // Lead Time metrics (solo ventas entregadas con fechas completas)
  const leadTimeMetrics = useMemo(() => {
    const entregadas = ventas.filter(v =>
      v.estado === 'entregada' &&
      v.fechaCreacion && v.fechaConfirmacion && v.fechaAsignacion && v.fechaEntrega
    );
    if (entregadas.length === 0) return null;

    const toMs = (t: any) => (t?.toDate ? t.toDate() : new Date(t)).getTime();
    const toDays = (ms: number) => ms / (1000 * 60 * 60 * 24);

    const segments = entregadas.map(v => {
      const total = toDays(toMs(v.fechaEntrega) - toMs(v.fechaCreacion));
      const cotConf = toDays(toMs(v.fechaConfirmacion) - toMs(v.fechaCreacion));
      const confAsig = toDays(toMs(v.fechaAsignacion) - toMs(v.fechaConfirmacion));
      const asigProg = v.fechaEnEntrega
        ? toDays(toMs(v.fechaEnEntrega) - toMs(v.fechaAsignacion))
        : toDays(toMs(v.fechaEntrega) - toMs(v.fechaAsignacion));
      const progDesp = v.fechaDespacho && v.fechaEnEntrega
        ? toDays(toMs(v.fechaDespacho) - toMs(v.fechaEnEntrega))
        : 0;
      const despEntr = v.fechaDespacho
        ? toDays(toMs(v.fechaEntrega) - toMs(v.fechaDespacho))
        : v.fechaEnEntrega
          ? toDays(toMs(v.fechaEntrega) - toMs(v.fechaEnEntrega))
          : 0;
      return { total, cotConf, confAsig, asigProg, progDesp, despEntr };
    });

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const min = (arr: number[]) => Math.min(...arr);
    const max = (arr: number[]) => Math.max(...arr);

    return {
      count: entregadas.length,
      total: { avg: avg(segments.map(s => s.total)), min: min(segments.map(s => s.total)), max: max(segments.map(s => s.total)) },
      cotConf: { avg: avg(segments.map(s => s.cotConf)), min: min(segments.map(s => s.cotConf)), max: max(segments.map(s => s.cotConf)) },
      confAsig: { avg: avg(segments.map(s => s.confAsig)), min: min(segments.map(s => s.confAsig)), max: max(segments.map(s => s.confAsig)) },
      asigProg: { avg: avg(segments.map(s => s.asigProg)), min: min(segments.map(s => s.asigProg)), max: max(segments.map(s => s.asigProg)) },
      progDesp: { avg: avg(segments.map(s => s.progDesp)), min: min(segments.map(s => s.progDesp)), max: max(segments.map(s => s.progDesp)) },
      despEntr: { avg: avg(segments.map(s => s.despEntr)), min: min(segments.map(s => s.despEntr)), max: max(segments.map(s => s.despEntr)) },
    };
  }, [ventas]);

  // Cargar datos al montar + suscripción en tiempo real para ventas y entregas
  useEffect(() => {
    iniciarSuscripcionVentas();   // Listener en tiempo real para ventas
    iniciarSuscripcionEntregas(); // Listener en tiempo real para entregas pendientes
    fetchProductosDisponibles();
    fetchStats();
    fetchResumenPagos();

    return () => {
      detenerSuscripcionVentas();   // Limpiar listener al desmontar
      detenerSuscripcionEntregas();
    };
  }, [iniciarSuscripcionVentas, detenerSuscripcionVentas, iniciarSuscripcionEntregas, detenerSuscripcionEntregas, fetchProductosDisponibles, fetchStats, fetchResumenPagos]);

  // Crear venta/cotización
  const handleCreateVenta = async (data: VentaFormData, esVentaDirecta: boolean, adelanto?: AdelantoData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      let ventaId: string;
      if (esVentaDirecta) {
        ventaId = await createVenta(data, user.uid);
      } else {
        ventaId = await createCotizacion(data, user.uid);
      }

      // Si hay adelanto, registrarlo con reserva de stock
      if (adelanto && adelanto.monto > 0) {
        try {
          await VentaService.registrarAdelantoConReserva(ventaId, adelanto, user.uid);
          toast.success('Adelanto registrado correctamente', 'Adelanto');
          // Refrescar ventas para ver el estado actualizado
          await fetchVentas();
        } catch (adelantoError: any) {
          console.error('Error al registrar adelanto:', adelantoError);
          toast.warning(
            `La venta se creó pero hubo un error al registrar el adelanto: ${adelantoError.message}`,
            'Adelanto no registrado'
          );
        }
      }

      setIsModalOpen(false);
      await fetchProductosDisponibles();
    } catch (error: any) {
      console.error('Error al crear venta:', error);
      toast.error(error.message, 'Error al crear venta');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper: obtener venta fresca del store (evita stale closure)
  const refreshSelectedVenta = (ventaId: string) => {
    const freshVentas = useVentaStore.getState().ventas;
    const ventaActualizada = freshVentas.find(v => v.id === ventaId);
    if (ventaActualizada) setSelectedVenta(ventaActualizada);
  };

  // Ver detalles
  const handleViewDetails = (venta: Venta) => {
    setSelectedVenta(venta);
    setIsDetailsModalOpen(true);
  };

  // Confirmar cotización
  const handleConfirmar = async () => {
    if (!user || !selectedVenta) return;

    try {
      await confirmarCotizacion(selectedVenta.id, user.uid);
      refreshSelectedVenta(selectedVenta.id);
    } catch (error: any) {
      toast.error(error.message, 'Error');
    }
  };

  // Asignar inventario con FEFO
  const handleAsignarInventario = async () => {
    if (!user || !selectedVenta) return;

    const confirmed = await confirm({
      title: 'Asignar Inventario FEFO',
      message: 'Se asignara inventario automaticamente usando el metodo FEFO (primero lo que vence primero). Las unidades seran reservadas para esta venta.',
      confirmText: 'Asignar',
      variant: 'info'
    });
    if (!confirmed) return;

    try {
      const resultados = await asignarInventario(selectedVenta.id, user.uid);
      
      // Mostrar resultado
      const mensaje = resultados.map(r =>
        `${r.cantidadAsignada} unidades asignadas para producto`
      ).join(', ');

      toast.success(`Inventario asignado: ${mensaje}`, 'Inventario Asignado');
      
      refreshSelectedVenta(selectedVenta.id);
      
      await fetchProductosDisponibles();
    } catch (error: any) {
      toast.error(error.message, 'Error');
    }
  };

  // Marcar como entregada
  const handleMarcarEntregada = async () => {
    if (!user || !selectedVenta) return;

    const confirmed = await confirm({
      title: 'Marcar como Entregada',
      message: `¿Confirmar que la venta ${selectedVenta.numeroVenta} fue entregada al cliente? Las unidades pasaran a estado "entregada".`,
      confirmText: 'Confirmar Entrega',
      variant: 'success'
    });
    if (!confirmed) return;

    try {
      await marcarEntregada(selectedVenta.id, user.uid);
      toast.success('Venta entregada. Las unidades ahora están en estado "entregada".', 'Venta Entregada');

      refreshSelectedVenta(selectedVenta.id);
    } catch (error: any) {
      toast.error(error.message, 'Error');
    }
  };

  // Cancelar venta
  const handleCancelar = async () => {
    if (!user || !selectedVenta) return;

    const tienePagos = selectedVenta.pagos && selectedVenta.pagos.length > 0;
    const montoPagado = selectedVenta.montoPagado || 0;

    const result = await openActionModal({
      title: 'Cancelar Venta',
      description: (
        <div className="space-y-2">
          <p>Esta acción liberará el inventario asignado y marcará la venta como cancelada.</p>
          {tienePagos && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800 text-sm">Esta venta tiene pagos registrados</p>
                  <p className="text-amber-700 text-xs mt-1">
                    Se han cobrado <span className="font-bold">S/ {montoPagado.toFixed(2)}</span> en {selectedVenta.pagos!.length} pago(s).
                    Antes de cancelar, elimina los pagos desde los detalles de la venta para revertir los ingresos en Tesorería.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ),
      variant: 'danger',
      confirmText: 'Cancelar Venta',
      contextInfo: [
        { label: 'Venta', value: selectedVenta.numeroVenta },
        { label: 'Cliente', value: selectedVenta.nombreCliente },
        { label: 'Estado actual', value: selectedVenta.estado },
        ...(tienePagos ? [{ label: 'Pagos registrados', value: `S/ ${montoPagado.toFixed(2)}` }] : [])
      ],
      fields: [
        {
          id: 'motivo',
          label: 'Motivo de cancelación',
          type: 'textarea',
          placeholder: 'Ingresa el motivo de la cancelación...',
          required: true
        }
      ]
    });

    if (!result || !result.motivo) return;

    try {
      await cancelarVenta(selectedVenta.id, user.uid, result.motivo as string);
      toast.success('Venta cancelada. El inventario asignado ha sido liberado.', 'Venta Cancelada');

      refreshSelectedVenta(selectedVenta.id);

      await fetchProductosDisponibles();
    } catch (error: any) {
      toast.error(error.message, 'Error');
    }
  };

  // Eliminar cotización
  const handleDelete = async (venta: Venta) => {
    const confirmed = await confirm({
      title: 'Eliminar Cotizacion',
      message: `¿Eliminar la cotizacion ${venta.numeroVenta}? Esta accion no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      await deleteVenta(venta.id);
      toast.success('Cotización eliminada');
    } catch (error: any) {
      toast.error(error.message, 'Error');
    }
  };

  // Abrir modal de pago
  const handleOpenPagoModal = () => {
    setIsPagoModalOpen(true);
  };

  // Registrar pago
  const handleRegistrarPago = async (datosPago: {
    monto: number;
    metodoPago: MetodoPago;
    referencia?: string;
    notas?: string;
  }) => {
    if (!user || !selectedVenta) return;

    setIsSubmitting(true);
    try {
      await registrarPago(selectedVenta.id, datosPago, user.uid);
      setIsPagoModalOpen(false);

      // Recargar datos primero, luego actualizar seleccionada con datos frescos
      await fetchVentas();
      await fetchResumenPagos();
      refreshSelectedVenta(selectedVenta.id);
      toast.success('Pago registrado correctamente');
    } catch (error: any) {
      toast.error(error.message, 'Error al registrar pago');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar pago
  const handleEliminarPago = async (pagoId: string) => {
    if (!user || !selectedVenta) return;

    const confirmed = await confirm({
      title: 'Eliminar Pago',
      message: 'Esta a punto de eliminar este pago. Esta accion no se puede deshacer y afectara el saldo de la venta.',
      confirmText: 'Eliminar Pago',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      await eliminarPago(selectedVenta.id, pagoId, user.uid);

      // Actualizar la venta seleccionada
      refreshSelectedVenta(selectedVenta.id);

      await fetchResumenPagos();
      toast.success('Pago eliminado');
    } catch (error: any) {
      toast.error(error.message, 'Error');
    }
  };

  // Corregir precio de producto
  const handleCorregirPrecio = async (productoId: string, productoNombre: string, precioActual: number) => {
    if (!user || !selectedVenta) return;

    const result = await openActionModal({
      title: 'Corregir Precio de Producto',
      description: `Corregir el precio unitario de "${productoNombre}". Esto actualizará la venta, pagos, entregas y tesorería.`,
      variant: 'warning',
      confirmText: 'Corregir Precio',
      contextInfo: [
        { label: 'Venta', value: selectedVenta.numeroVenta },
        { label: 'Producto', value: productoNombre },
        { label: 'Precio actual', value: `S/ ${precioActual.toFixed(2)}` }
      ],
      fields: [
        {
          id: 'nuevoPrecio',
          label: 'Nuevo precio unitario (S/)',
          type: 'number',
          placeholder: precioActual.toFixed(2),
          required: true
        }
      ]
    });

    if (!result || !result.nuevoPrecio) return;

    const nuevoPrecio = parseFloat(result.nuevoPrecio as string);
    if (isNaN(nuevoPrecio) || nuevoPrecio <= 0) {
      toast.error('El precio debe ser un número mayor a 0');
      return;
    }

    try {
      const { cambios } = await VentaService.corregirPrecioProducto(
        selectedVenta.id,
        productoId,
        nuevoPrecio,
        user.uid
      );

      // Refrescar datos
      await fetchVentas();
      await fetchResumenPagos();
      refetchRentabilidad();

      // Actualizar la venta seleccionada
      refreshSelectedVenta(selectedVenta.id);

      toast.success(
        cambios.join('\n'),
        'Precio Corregido'
      );
    } catch (error: any) {
      toast.error(error.message, 'Error al corregir precio');
    }
  };

  // Editar venta
  const handleEditarVenta = async (cambios: EditarVentaData) => {
    if (!user || !selectedVenta) return;

    setIsSubmitting(true);
    try {
      const { cambios: log } = await VentaService.editarVenta(
        selectedVenta.id,
        cambios,
        user.uid
      );
      setIsEditModalOpen(false);

      await fetchVentas();
      await fetchResumenPagos();
      refetchRentabilidad();

      refreshSelectedVenta(selectedVenta.id);

      toast.success(log.join('\n'), 'Venta Actualizada');
    } catch (error: any) {
      toast.error(error.message, 'Error al editar venta');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir modal de gastos
  const handleOpenGastosModal = () => {
    setIsGastosModalOpen(true);
  };

  // Abrir modal de entrega
  const handleOpenEntregaModal = () => {
    setIsEntregaModalOpen(true);
  };

  // Programar entrega
  const handleProgramarEntrega = async (data: ProgramarEntregaData) => {
    if (!user || !selectedVenta) return;

    setIsSubmitting(true);
    try {
      await programarEntrega(data, selectedVenta, user.uid);
      setIsEntregaModalOpen(false);
      toast.success('Entrega programada correctamente');

      // Recargar ventas y actualizar seleccionada
      await fetchVentas();
      refreshSelectedVenta(selectedVenta.id);
    } catch (error: any) {
      toast.error(error.message, 'Error al programar entrega');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Registrar gastos de venta
  const handleRegistrarGastos = async (gastos: Array<{
    id: string;
    tipo: string;
    categoria: string;
    descripcion: string;
    monto: number;
  }>) => {
    if (!user || !selectedVenta) return;

    setIsSubmitting(true);
    try {
      await gastoService.createGastosVenta(
        selectedVenta.id,
        gastos.map(g => ({
          tipo: g.tipo,
          categoria: g.categoria,
          descripcion: g.descripcion,
          monto: g.monto,
          ventaNumero: selectedVenta.numeroVenta
        })),
        user.uid
      );

      setIsGastosModalOpen(false);
      toast.success(`${gastos.length} gasto(s) registrado(s). Vaya a Gastos para registrar el pago.`, 'Gastos Registrados');

      // Recargar datos incluyendo rentabilidad
      await fetchVentas();
      if (selectedVenta) refreshSelectedVenta(selectedVenta.id);
      await fetchStats();
      await refetchRentabilidad();
    } catch (error: any) {
      toast.error(error.message, 'Error al registrar gastos');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ventas</h1>
          <p className="text-gray-600 mt-1">Gestión de ventas y cotizaciones con FEFO automático</p>
        </div>
        <Button
          variant="primary"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus className="h-5 w-5 mr-2" />
          Nueva Venta
        </Button>
      </div>

      {/* Alerta si no hay stock disponible */}
      {productosDisponibles.length === 0 && (
        <Card padding="md">
          <div className="flex items-center">
            <Package className="h-5 w-5 text-warning-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">No hay stock disponible en Perú</p>
              <p className="text-sm text-gray-600">
                Puedes crear cotizaciones que generarán requerimientos de compra automáticamente.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* KPIs */}
      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card padding="md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Total Ventas</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">
                    {stats.totalVentas}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {stats.cotizaciones} cotizaciones
                  </div>
                </div>
                <ShoppingCart className="h-10 w-10 text-gray-400" />
              </div>
            </Card>

            <Card padding="md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">En Proceso</div>
                  <div className="text-2xl font-bold text-warning-600 mt-1">
                    {stats.enProceso}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {stats.confirmadas} confirmadas
                  </div>
                </div>
                <Package className="h-10 w-10 text-warning-400" />
              </div>
            </Card>

            <Card padding="md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Entregadas</div>
                  <div className="text-2xl font-bold text-success-600 mt-1">
                    {stats.entregadas}
                  </div>
                </div>
                <CheckCircle className="h-10 w-10 text-success-400" />
              </div>
            </Card>

            <Card padding="md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Ventas Totales</div>
                  <div className="text-xl font-bold text-primary-600 mt-1">
                    S/ {stats.ventasTotalPEN.toFixed(0)}
                  </div>
                </div>
                <DollarSign className="h-10 w-10 text-primary-400" />
              </div>
            </Card>
          </div>

          {/* KPIs Rentabilidad - Utilidad Bruta vs Neta */}
          {(stats.utilidadTotalPEN > 0 || (rentabilidad && rentabilidad.totalUtilidadNeta !== 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Utilidad Bruta */}
              <Card padding="md">
                <div className="text-sm text-gray-600">Utilidad Bruta</div>
                <div className="text-2xl font-bold text-success-600 mt-1">
                  S/ {stats.utilidadTotalPEN.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Ventas - Costo producto
                </div>
              </Card>

              {/* Gastos Operativos (GA/GO + GV/GD) */}
              {rentabilidad && (
                <Card padding="md">
                  <div className="text-sm text-gray-600">Gastos Operativos</div>
                  <div className="text-2xl font-bold text-orange-600 mt-1">
                    - S/ {(rentabilidad.totalGastosGAGO + rentabilidad.totalGastosGVGD).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                    <div className="flex justify-between">
                      <span>GA/GO:</span>
                      <span>S/ {rentabilidad.totalGastosGAGO.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GV/GD:</span>
                      <span>S/ {rentabilidad.totalGastosGVGD.toFixed(2)}</span>
                    </div>
                  </div>
                </Card>
              )}

              {/* Utilidad Neta */}
              {rentabilidad && (
                <Card padding="md" className={rentabilidad.totalUtilidadNeta >= 0 ? 'bg-green-50' : 'bg-red-50'}>
                  <div className="text-sm text-gray-600">Utilidad Neta</div>
                  <div className={`text-2xl font-bold mt-1 ${rentabilidad.totalUtilidadNeta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    S/ {rentabilidad.totalUtilidadNeta.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Margen Neto: {rentabilidad.margenNetoPromedio.toFixed(1)}%
                  </div>
                </Card>
              )}

              {/* Ventas por Canal */}
              <Card padding="md">
                <div className="text-sm text-gray-600 mb-2">Ventas por Canal</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mercado Libre:</span>
                    <span className="font-semibold">{stats.ventasML}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Directo:</span>
                    <span className="font-semibold">{stats.ventasDirecto}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Otro:</span>
                    <span className="font-semibold">{stats.ventasOtro}</span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* KPIs de Eficiencia de Inversión */}
          {rentabilidad && rentabilidad.totalVentas > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Multiplicador de Ventas - igual que Dashboard */}
              <Card padding="md" className="bg-gradient-to-br from-blue-50 to-indigo-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Multiplicador</div>
                    <div className={`text-2xl font-bold mt-1 ${
                      rentabilidad.totalCostoBase > 0 && (rentabilidad.totalVentas / rentabilidad.totalCostoBase) >= 2
                        ? 'text-emerald-600'
                        : rentabilidad.totalCostoBase > 0 && (rentabilidad.totalVentas / rentabilidad.totalCostoBase) >= 1.5
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    }`}>
                      {rentabilidad.totalCostoBase > 0
                        ? `${(rentabilidad.totalVentas / rentabilidad.totalCostoBase).toFixed(2)}x`
                        : '0x'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Por cada S/ 1 en producto
                    </div>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-400" />
                </div>
              </Card>

              {/* Carga GA/GO por Unidad */}
              <Card padding="md" className="bg-gradient-to-br from-purple-50 to-purple-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Carga GA/GO</div>
                    <div className="text-2xl font-bold text-purple-600 mt-1">
                      S/ {rentabilidad.impactoPorUnidad.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      por unidad vendida
                    </div>
                  </div>
                  <PieChart className="h-8 w-8 text-purple-400" />
                </div>
              </Card>

              {/* ROI Neto - por cada sol invertido, cuánto ganas */}
              <Card padding="md" className="bg-gradient-to-br from-green-50 to-emerald-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">ROI Neto</div>
                    <div className={`text-2xl font-bold mt-1 ${
                      rentabilidad.totalUtilidadNeta >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {(() => {
                        const inversionTotal = rentabilidad.totalCostoBase + rentabilidad.totalGastosGAGO + rentabilidad.totalGastosGVGD;
                        if (inversionTotal <= 0) return 'S/ 0.00';
                        const roiPorSol = rentabilidad.totalUtilidadNeta / inversionTotal;
                        return `S/ ${roiPorSol.toFixed(2)}`;
                      })()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      ganancia por S/ 1 invertido
                    </div>
                  </div>
                  <DollarSign className="h-8 w-8 text-emerald-400" />
                </div>
              </Card>

              {/* Costo Total por Unidad (CTRU promedio vendido) */}
              <Card padding="md" className="bg-gradient-to-br from-amber-50 to-orange-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">CTRU Promedio</div>
                    <div className="text-2xl font-bold text-amber-600 mt-1">
                      S/ {rentabilidad.baseUnidades > 0
                        ? ((rentabilidad.totalCostoBase + rentabilidad.totalCostoGAGO) / rentabilidad.baseUnidades).toFixed(2)
                        : '0.00'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      costo real por unidad
                    </div>
                  </div>
                  <Calculator className="h-8 w-8 text-amber-400" />
                </div>
              </Card>
            </div>
          )}

          {/* KPIs Lead Time */}
          {leadTimeMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card padding="md" className="bg-gradient-to-br from-cyan-50 to-teal-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Lead Time Total</div>
                    <div className="text-2xl font-bold text-cyan-600 mt-1">
                      {leadTimeMetrics.total.avg.toFixed(1)}d
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      min {leadTimeMetrics.total.min.toFixed(1)}d · max {leadTimeMetrics.total.max.toFixed(1)}d
                    </div>
                  </div>
                  <Clock className="h-8 w-8 text-cyan-400" />
                </div>
              </Card>

              <Card padding="md" className="bg-gradient-to-br from-sky-50 to-cyan-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Cotización → Confirmada</div>
                    <div className="text-2xl font-bold text-sky-600 mt-1">
                      {leadTimeMetrics.cotConf.avg.toFixed(1)}d
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      min {leadTimeMetrics.cotConf.min.toFixed(1)}d · max {leadTimeMetrics.cotConf.max.toFixed(1)}d
                    </div>
                  </div>
                  <Timer className="h-8 w-8 text-sky-400" />
                </div>
              </Card>

              <Card padding="md" className="bg-gradient-to-br from-teal-50 to-emerald-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Confirmada → Asignada</div>
                    <div className="text-2xl font-bold text-teal-600 mt-1">
                      {leadTimeMetrics.confAsig.avg.toFixed(1)}d
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      min {leadTimeMetrics.confAsig.min.toFixed(1)}d · max {leadTimeMetrics.confAsig.max.toFixed(1)}d
                    </div>
                  </div>
                  <Zap className="h-8 w-8 text-teal-400" />
                </div>
              </Card>

              <Card padding="md" className="bg-gradient-to-br from-amber-50 to-yellow-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Asignada → Programada</div>
                    <div className="text-2xl font-bold text-amber-600 mt-1">
                      {leadTimeMetrics.asigProg.avg.toFixed(1)}d
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      min {leadTimeMetrics.asigProg.min.toFixed(1)}d · max {leadTimeMetrics.asigProg.max.toFixed(1)}d
                    </div>
                  </div>
                  <Package className="h-8 w-8 text-amber-400" />
                </div>
              </Card>

              <Card padding="md" className="bg-gradient-to-br from-orange-50 to-amber-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Programada → En Camino</div>
                    <div className="text-2xl font-bold text-orange-600 mt-1">
                      {leadTimeMetrics.progDesp.avg.toFixed(1)}d
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      min {leadTimeMetrics.progDesp.min.toFixed(1)}d · max {leadTimeMetrics.progDesp.max.toFixed(1)}d
                    </div>
                  </div>
                  <Truck className="h-8 w-8 text-orange-400" />
                </div>
              </Card>

              <Card padding="md" className="bg-gradient-to-br from-emerald-50 to-green-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">En Camino → Entregada</div>
                    <div className="text-2xl font-bold text-emerald-600 mt-1">
                      {leadTimeMetrics.despEntr.avg.toFixed(1)}d
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      min {leadTimeMetrics.despEntr.min.toFixed(1)}d · max {leadTimeMetrics.despEntr.max.toFixed(1)}d
                    </div>
                  </div>
                  <PackageCheck className="h-8 w-8 text-emerald-400" />
                </div>
              </Card>
            </div>
          )}

          {/* KPIs Cobranza */}
          {resumenPagos && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card padding="md" className="bg-green-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Por Cobrar</div>
                    <div className="text-xl font-bold text-danger-600 mt-1">
                      S/ {resumenPagos.totalPorCobrar.toFixed(2)}
                    </div>
                  </div>
                  <CreditCard className="h-8 w-8 text-danger-400" />
                </div>
              </Card>

              <Card padding="md" className="bg-green-50">
                <div className="text-sm text-gray-600">Cobranza del Mes</div>
                <div className="text-xl font-bold text-success-600 mt-1">
                  S/ {resumenPagos.cobranzaMesActual.toFixed(2)}
                </div>
              </Card>

              <Card padding="md" className="bg-green-50">
                <div className="text-sm text-gray-600 mb-1">Estado de Pagos</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-danger-600">Pendientes:</span>
                    <span className="font-semibold">{resumenPagos.ventasPendientes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-warning-600">Parciales:</span>
                    <span className="font-semibold">{resumenPagos.ventasParciales}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-success-600">Pagadas:</span>
                    <span className="font-semibold">{resumenPagos.ventasPagadas}</span>
                  </div>
                </div>
              </Card>

              <Card padding="md" className="bg-green-50">
                <div className="text-sm text-gray-600">% Cobrado</div>
                <div className="text-xl font-bold text-primary-600 mt-1">
                  {stats.ventasTotalPEN > 0
                    ? ((stats.ventasTotalPEN - resumenPagos.totalPorCobrar) / stats.ventasTotalPEN * 100).toFixed(1)
                    : 0}%
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Pipeline de Estados */}
      <PipelineHeader
        stages={pipelineStages}
        activeStage={filtroEstado}
        onStageClick={setFiltroEstado}
        title="Pipeline de Ventas"
      />

      {/* Tabla de Ventas */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {filtroEstado
                ? `${pipelineStages.find(s => s.id === filtroEstado)?.label || 'Ventas'} (${ventasFiltradas.length})`
                : `Ventas y Cotizaciones (${ventas.length})`
              }
            </h3>
            {/* Indicadores de rentabilidad con distribución proporcional */}
            <div className="flex items-center gap-2 flex-wrap">
              {rentabilidad && rentabilidad.totalGastosGAGO > 0 && (
                <div className="flex items-center text-sm text-gray-600 bg-orange-50 px-2 py-1 rounded-lg" title="Gastos Administrativos/Operativos distribuidos proporcionalmente">
                  <PieChart className="h-4 w-4 text-orange-500 mr-1" />
                  <span className="text-xs">GA/GO:</span>
                  <span className="font-semibold text-orange-600 ml-1">
                    S/ {rentabilidad.totalGastosGAGO.toFixed(0)}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">
                    ({rentabilidad.totalCostoBase > 0
                      ? ((rentabilidad.totalCostoGAGO / rentabilidad.totalCostoBase) * 100).toFixed(1)
                      : 0}%)
                  </span>
                </div>
              )}
              {rentabilidad && rentabilidad.totalGastosGVGD > 0 && (
                <div className="flex items-center text-sm text-gray-600 bg-blue-50 px-2 py-1 rounded-lg" title="Gastos de Venta/Distribución directos">
                  <Calculator className="h-4 w-4 text-blue-500 mr-1" />
                  <span className="text-xs">GV/GD:</span>
                  <span className="font-semibold text-blue-600 ml-1">
                    S/ {rentabilidad.totalGastosGVGD.toFixed(0)}
                  </span>
                </div>
              )}
              {rentabilidad && (
                <div className="flex items-center text-sm bg-green-50 px-2 py-1 rounded-lg" title="Margen Neto promedio después de GA/GO y GV/GD">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-xs">Margen Neto:</span>
                  <span className={`font-semibold ml-1 ${rentabilidad.margenNetoPromedio >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {rentabilidad.margenNetoPromedio.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <VentaTable
          ventas={ventasFiltradas}
          onView={handleViewDetails}
          onDelete={handleDelete}
          loading={loading}
        />
      </Card>

      {/* Modal Nueva Venta */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nueva Venta / Cotización"
        size="xl"
      >
        <VentaForm
          productosDisponibles={productosDisponibles}
          onSubmit={handleCreateVenta}
          onCancel={() => setIsModalOpen(false)}
          loading={isSubmitting}
        />
      </Modal>

      {/* Modal Detalles de Venta */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="Detalles de Venta"
        size="xl"
      >
        {selectedVenta && (
          <ErrorBoundary
            fallbackMessage="Error al cargar los detalles de esta venta"
            onReset={() => setIsDetailsModalOpen(false)}
          >
            <VentaCard
              venta={selectedVenta}
              rentabilidadData={getRentabilidadVenta(selectedVenta.id)}
              onConfirmar={selectedVenta.estado === 'cotizacion' ? handleConfirmar : undefined}
              onAsignarInventario={(selectedVenta.estado === 'confirmada' || selectedVenta.estado === 'reservada') ? handleAsignarInventario : undefined}
              onMarcarEntregada={(selectedVenta.estado === 'en_entrega' || selectedVenta.estado === 'despachada') ? handleMarcarEntregada : undefined}
              onCancelar={
                selectedVenta.estado !== 'entregada' && selectedVenta.estado !== 'cancelada'
                  ? handleCancelar
                  : undefined
              }
              onRegistrarPago={
                selectedVenta.estado !== 'cotizacion' &&
                selectedVenta.estado !== 'cancelada' &&
                selectedVenta.estadoPago !== 'pagado'
                  ? handleOpenPagoModal
                  : undefined
              }
              onEliminarPago={
                selectedVenta.estado !== 'entregada'
                  ? handleEliminarPago
                  : undefined
              }
              onAgregarGastos={
                selectedVenta.estado !== 'cotizacion' &&
                selectedVenta.estado !== 'cancelada'
                  ? handleOpenGastosModal
                  : undefined
              }
              onCorregirPrecio={handleCorregirPrecio}
              onEditarVenta={
                selectedVenta.estado !== 'entregada' && selectedVenta.estado !== 'cancelada'
                  ? () => setIsEditModalOpen(true)
                  : undefined
              }
              onProgramarEntrega={
                (selectedVenta.estado === 'asignada' ||
                 selectedVenta.estado === 'en_entrega' ||
                 selectedVenta.estado === 'despachada' ||
                 selectedVenta.estado === 'entrega_parcial')
                  ? handleOpenEntregaModal
                  : undefined
              }
              onEntregaCompletada={async () => {
                // Refrescar la lista de ventas primero
                await fetchVentas();
                // Luego actualizar la venta seleccionada con datos frescos
                if (selectedVenta) {
                  refreshSelectedVenta(selectedVenta.id);
                }
                // Refrescar la rentabilidad (invalida cache y recalcula)
                refetchRentabilidad();
              }}
            />
          </ErrorBoundary>
        )}
      </Modal>

      {/* Modal Registrar Pago */}
      {selectedVenta && isPagoModalOpen && (
        <PagoVentaForm
          venta={selectedVenta}
          onSubmit={handleRegistrarPago}
          onCancel={() => setIsPagoModalOpen(false)}
          loading={isSubmitting}
        />
      )}

      {/* Modal Registrar Gastos de Venta */}
      <Modal
        isOpen={isGastosModalOpen}
        onClose={() => setIsGastosModalOpen(false)}
        title="Gastos de Venta"
        size="lg"
      >
        {selectedVenta && (
          <GastosVentaForm
            venta={selectedVenta}
            onSubmit={handleRegistrarGastos}
            onCancel={() => setIsGastosModalOpen(false)}
            loading={isSubmitting}
          />
        )}
      </Modal>

      {/* Modal Editar Venta */}
      {selectedVenta && isEditModalOpen && (
        <EditarVentaModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={handleEditarVenta}
          venta={selectedVenta}
          loading={isSubmitting}
        />
      )}

      {/* Modal Programar Entrega */}
      {selectedVenta && isEntregaModalOpen && (
        <ProgramarEntregaModal
          isOpen={isEntregaModalOpen}
          onClose={() => setIsEntregaModalOpen(false)}
          onSubmit={handleProgramarEntrega}
          venta={selectedVenta}
          loading={isSubmitting}
        />
      )}

      {/* Dialogo de Confirmacion */}
      <ConfirmDialog {...dialogProps} />

      {/* Modal de Acciones con campos */}
      <ActionModal {...actionModalProps} />
    </div>
  );
};