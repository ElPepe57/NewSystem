import React, { useEffect, useState, useMemo } from 'react';
import { Plus, ShoppingCart, DollarSign, TrendingUp, Package, CheckCircle, CreditCard, Calculator, PieChart, FileText, Truck, XCircle, Clock, Timer, Zap, PackageCheck, AlertTriangle, ChevronDown, ChevronUp, Users, RotateCcw } from 'lucide-react';
import { Button, Card, Modal, useConfirmDialog, ConfirmDialog, PipelineHeader, useActionModal, ActionModal, ErrorBoundary } from '../../components/common';
import { LineaFilterInline } from '../../components/common/LineaFilterInline';
import { DevolucionesTab } from './DevolucionesTab';
import { DevolucionFormModal } from './DevolucionFormModal';
import { useDevolucionStore } from '../../store/devolucionStore';
// Nota: ActionModal aún se usa para cancelar ventas
import type { PipelineStage } from '../../components/common';
import { useToastStore } from '../../store/toastStore';
import { VentaForm } from '../../components/modules/venta/VentaForm';
import { VentaTable } from '../../components/modules/venta/VentaTable';
import { VentasDashboard } from '../../components/modules/venta/VentasDashboard';
import { VentaCard } from '../../components/modules/venta/VentaCard';
import { PagoUnificadoForm } from '../../components/modules/pagos/PagoUnificadoForm';
import type { PagoUnificadoResult } from '../../components/modules/pagos/PagoUnificadoForm';
import { GastosVentaForm } from '../../components/modules/venta/GastosVentaForm';
import { ProgramarEntregaModal } from '../../components/modules/venta/ProgramarEntregaModal';
import { EditarVentaModal } from '../../components/modules/venta/EditarVentaModal';
import { CorregirProductoModal } from '../../components/modules/venta/CorregirProductoModal';
import { useVentaStore } from '../../store/ventaStore';
import { useAuthStore } from '../../store/authStore';
import { useRentabilidadVentas } from '../../hooks/useRentabilidadVentas';
import { gastoService } from '../../services/gasto.service';
import { VentaService } from '../../services/venta.service';
import { useEntregaStore } from '../../store/entregaStore';
import type { Venta, VentaFormData, MetodoPago, AdelantoData, EditarVentaData } from '../../types/venta.types';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import { ventaSociosService, MOTIVOS_VENTA_SOCIO } from '../../services/venta.socios.service';
import type { ResumenVentasSocios } from '../../services/venta.socios.service';
import { formatCurrencyPEN } from '../../utils/format';
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
  const [isCorregirProductoModalOpen, setIsCorregirProductoModalOpen] = useState(false);
  const [productoACorregir, setProductoACorregir] = useState<{ productoId: string; nombre: string; sku: string; presentacion: string } | null>(null);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null);
  const [mostrarVentasSocios, setMostrarVentasSocios] = useState(false);

  // Tab activo y devoluciones
  const [tabActiva, setTabActiva] = useState<'ventas' | 'devoluciones'>('ventas');
  const [isDevolucionFormOpen, setIsDevolucionFormOpen] = useState(false);
  const [ventaParaDevolver, setVentaParaDevolver] = useState<Venta | null>(null);
  const { devoluciones: todasDevoluciones, fetchDevoluciones } = useDevolucionStore();

  // Contar devoluciones pendientes (solicitadas + aprobadas + ejecutadas)
  const devolucionesPendientesCount = useMemo(() =>
    todasDevoluciones.filter(d =>
      d.estado === 'solicitada' || d.estado === 'aprobada' || d.estado === 'ejecutada'
    ).length,
  [todasDevoluciones]);
  // Hook de rentabilidad con distribución proporcional de GA/GO
  const { datos: rentabilidad, getRentabilidadVenta, loading: loadingRentabilidad, refetch: refetchRentabilidad } = useRentabilidadVentas(ventas);

  // Store de entregas
  const {
    programarEntrega,
    marcarEnCamino,
    fetchByVenta,
    iniciarSuscripcion: iniciarSuscripcionEntregas,
    detenerSuscripcion: detenerSuscripcionEntregas
  } = useEntregaStore();

  // Hook para dialogo de confirmacion
  const { dialogProps, confirm } = useConfirmDialog();
  const { modalProps: actionModalProps, open: openActionModal } = useActionModal();
  const toast = useToastStore();

  // Ventas filtradas por línea de negocio global
  const ventasLineaFiltradas = useLineaFilter(ventas, v => v.lineaNegocioId);

  // Pipeline stages para filtrado visual
  const pipelineStages: PipelineStage[] = useMemo(() => {
    const counts = {
      cotizacion: ventasLineaFiltradas.filter(v => v.estado === 'cotizacion').length,
      confirmada: ventasLineaFiltradas.filter(v => v.estado === 'confirmada').length,
      asignada: ventasLineaFiltradas.filter(v => v.estado === 'asignada').length,
      en_entrega: ventasLineaFiltradas.filter(v => v.estado === 'en_entrega').length,
      despachada: ventasLineaFiltradas.filter(v => v.estado === 'despachada').length,
      entregada: ventasLineaFiltradas.filter(v => v.estado === 'entregada').length,
      cancelada: ventasLineaFiltradas.filter(v => v.estado === 'cancelada').length
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
  }, [ventasLineaFiltradas]);

  // Ventas filtradas
  const ventasFiltradas = useMemo(() => {
    if (!filtroEstado) return ventasLineaFiltradas;
    return ventasLineaFiltradas.filter(v => v.estado === filtroEstado);
  }, [ventasLineaFiltradas, filtroEstado]);

  // Ventas a socios del mes actual
  const ventasSociosMes = useMemo(() => {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    return ventasLineaFiltradas.filter(v => {
      if (!v.esVentaSocio) return false;
      if (v.estado === 'cancelada') return false;
      const fecha = v.fechaCreacion?.toDate?.();
      return fecha && fecha >= inicioMes;
    });
  }, [ventasLineaFiltradas]);

  // Resumen de ventas a socios con subsidio y alertas
  const resumenSocios = useMemo<ResumenVentasSocios | null>(() => {
    if (ventasSociosMes.length === 0) return null;
    const ventasRegularesMes = ventasLineaFiltradas.filter(v => {
      if (v.esVentaSocio) return false;
      if (v.estado === 'cancelada') return false;
      const fecha = v.fechaCreacion?.toDate?.();
      const ahora = new Date();
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      return fecha && fecha >= inicioMes;
    });
    return ventaSociosService.calcularResumenSocios(ventasSociosMes, ventasRegularesMes);
  }, [ventasSociosMes, ventas]);

  // Lead Time metrics (solo ventas entregadas con fechas completas)
  const leadTimeMetrics = useMemo(() => {
    const entregadas = ventasLineaFiltradas.filter(v =>
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
  }, [ventasLineaFiltradas]);

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

      // BN-004: Si es venta bajo costo, pedir autorización
      if (error.message?.startsWith('VENTA_BAJO_COSTO:') && esVentaDirecta) {
        const userRole = user?.role || (user as any)?.rol;
        const esAdminOGerente = userRole === 'admin' || userRole === 'gerente';

        if (esAdminOGerente) {
          const confirmar = window.confirm(
            error.message.replace('VENTA_BAJO_COSTO: ', '') +
            '\n\nComo admin/gerente, ¿autoriza esta venta bajo costo?'
          );
          if (confirmar) {
            try {
              data.ventaBajoCosto = true;
              data.aprobadoPor = user.uid;
              const ventaId = await createVenta(data, user.uid);
              setIsModalOpen(false);
              await fetchProductosDisponibles();
              toast.warning('Venta bajo costo creada con autorización', 'Venta bajo costo');
              return;
            } catch (retryError: any) {
              toast.error(retryError.message, 'Error');
            }
          }
        } else {
          toast.error(
            'Precio por debajo del costo. Solicita autorización de un admin o gerente para continuar.',
            'Venta bajo costo bloqueada'
          );
        }
      } else {
        toast.error(error.message, 'Error al crear venta');
      }
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

  // Despachar venta (marcar entregas programadas como "En Camino")
  const handleDespachar = async (venta: Venta) => {
    if (!user?.uid) return;
    try {
      const entregas = await fetchByVenta(venta.id);
      const programada = entregas.find(e => e.estado === 'programada' || e.estado === 'reprogramada');
      if (!programada) {
        toast.warning('No hay entregas programadas para despachar');
        return;
      }
      await marcarEnCamino(programada.id, user.uid);
      toast.success(`${venta.numeroVenta} despachada`, 'En camino');
    } catch (error: any) {
      toast.error(error.message || 'Error al despachar');
    }
  };

  // Abrir modal de devolución
  const handleSolicitarDevolucion = (venta: Venta) => {
    setVentaParaDevolver(venta);
    setIsDevolucionFormOpen(true);
  };

  // Abrir modal de pago
  const handleOpenPagoModal = () => {
    setIsPagoModalOpen(true);
  };

  // Registrar pago
  const handleRegistrarPago = async (datos: PagoUnificadoResult) => {
    if (!user || !selectedVenta) return;

    setIsSubmitting(true);
    try {
      await registrarPago(selectedVenta.id, {
        monto: datos.montoOriginal,
        metodoPago: datos.metodoPago as MetodoPago,
        tipoCambio: datos.tipoCambio,
        referencia: datos.referencia,
        notas: datos.notas,
        cuentaDestinoId: datos.cuentaOrigenId,
      }, user.uid);
      setIsPagoModalOpen(false);

      // registrarPago ya hace fetchVentas + fetchResumenPagos internamente
      // Solo refrescar la venta seleccionada con los datos ya actualizados
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

  // Corregir producto (reemplazar producto equivocado)
  const handleCorregirProducto = (productoId: string, productoNombre: string, sku: string, presentacion: string) => {
    if (!selectedVenta) return;
    setProductoACorregir({ productoId, nombre: productoNombre, sku, presentacion });
    setIsCorregirProductoModalOpen(true);
  };

  const handleSubmitCorregirProducto = async (productoIdAnterior: string, nuevoProductoId: string) => {
    if (!user || !selectedVenta) return;

    setIsSubmitting(true);
    try {
      const { cambios } = await VentaService.corregirProductoVenta(
        selectedVenta.id,
        productoIdAnterior,
        nuevoProductoId,
        user.uid
      );

      await fetchVentas();
      await fetchResumenPagos();
      refetchRentabilidad();
      refreshSelectedVenta(selectedVenta.id);

      toast.success(cambios.join('\n'), 'Producto Corregido');
      setIsCorregirProductoModalOpen(false);
      setProductoACorregir(null);
    } catch (error: any) {
      toast.error(error.message, 'Error al corregir producto');
    } finally {
      setIsSubmitting(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Ventas</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Gestión de ventas y cotizaciones con FEFO automático</p>
        </div>
        <Button
          variant="primary"
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto justify-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nueva Venta
        </Button>
      </div>

      {/* Tabs: Ventas | Devoluciones */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setTabActiva('ventas')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              tabActiva === 'ventas'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Ventas
          </button>
          <button
            onClick={() => { setTabActiva('devoluciones'); fetchDevoluciones(); }}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tabActiva === 'devoluciones'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <RotateCcw className="h-4 w-4" />
            Devoluciones
            {devolucionesPendientesCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 text-xs font-bold bg-amber-500 text-white rounded-full">
                {devolucionesPendientesCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Contenido del tab Devoluciones */}
      {tabActiva === 'devoluciones' && <DevolucionesTab />}

      {/* Contenido del tab Ventas */}
      {tabActiva === 'ventas' && (<>

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

      {/* KPIs Dashboard */}
      {stats && (
        <VentasDashboard
          stats={stats}
          rentabilidad={rentabilidad}
          resumenPagos={resumenPagos}
          leadTimeMetrics={leadTimeMetrics}
          totalVentas={ventasLineaFiltradas.filter(v => v.estado !== 'cotizacion' && v.estado !== 'cancelada').length}
          totalEntregadas={stats.entregadas}
        />
      )}

      {/* Pipeline de Estados */}
      <PipelineHeader
        stages={pipelineStages}
        activeStage={filtroEstado}
        onStageClick={setFiltroEstado}
        title="Pipeline de Ventas"
      />

      {/* Filtro de línea de negocio */}
      <LineaFilterInline />

      {/* Resumen Ventas a Socios (colapsable con KPIs + alertas) */}
      {resumenSocios && (
        <Card padding="none">
          {/* Header colapsable */}
          <button
            onClick={() => setMostrarVentasSocios(!mostrarVentasSocios)}
            className="w-full px-6 py-3 flex items-center justify-between hover:bg-purple-50 transition-colors rounded-lg"
            aria-expanded={mostrarVentasSocios}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <Users className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <span className="font-medium text-purple-900">
                Ventas a Socios — {new Date().toLocaleString('es-PE', { month: 'long', year: 'numeric' })}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                {resumenSocios.totalVentas} {resumenSocios.totalVentas === 1 ? 'venta' : 'ventas'}
              </span>
              <span className={`text-sm font-semibold ${
                resumenSocios.totalCobradoPEN > ventaSociosService.UMBRAL_MONTO_MENSUAL_PEN
                  ? 'text-red-600'
                  : 'text-purple-600'
              }`}>
                {formatCurrencyPEN(resumenSocios.totalCobradoPEN)}
              </span>
              {resumenSocios.alertas.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {resumenSocios.alertas.length} {resumenSocios.alertas.length === 1 ? 'alerta' : 'alertas'}
                </span>
              )}
            </div>
            {mostrarVentasSocios
              ? <ChevronUp className="h-5 w-5 text-purple-400 flex-shrink-0" />
              : <ChevronDown className="h-5 w-5 text-purple-400 flex-shrink-0" />
            }
          </button>

          {mostrarVentasSocios && (
            <div className="px-6 pb-6 border-t border-purple-100">
              <p className="text-xs text-purple-400 mt-3 mb-4">
                Excluidas de reportes de rentabilidad. Subsidio = CTRU - precio cobrado. Costo de oportunidad = precio regular promedio - precio cobrado al socio.
              </p>

              {/* 5 KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
                {/* Card 1: conteo de ventas */}
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-purple-500 mb-1">Ventas este mes</p>
                  <p className="text-2xl font-bold text-purple-700">{resumenSocios.totalVentas}</p>
                  <p className="text-xs text-purple-400 mt-0.5">
                    {resumenSocios.porSocio.length} {resumenSocios.porSocio.length === 1 ? 'socio' : 'socios'}
                  </p>
                </div>

                {/* Card 2: total cobrado — rojo si supera umbral */}
                <div className={`rounded-lg p-3 text-center ${
                  resumenSocios.totalCobradoPEN > ventaSociosService.UMBRAL_MONTO_MENSUAL_PEN
                    ? 'bg-red-50'
                    : 'bg-purple-50'
                }`}>
                  <p className="text-xs text-gray-500 mb-1">Total cobrado</p>
                  <p className={`text-lg font-bold ${
                    resumenSocios.totalCobradoPEN > ventaSociosService.UMBRAL_MONTO_MENSUAL_PEN
                      ? 'text-red-600'
                      : 'text-purple-700'
                  }`}>
                    {formatCurrencyPEN(resumenSocios.totalCobradoPEN)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    umbral: {formatCurrencyPEN(ventaSociosService.UMBRAL_MONTO_MENSUAL_PEN)}
                  </p>
                </div>

                {/* Card 3: subsidio directo */}
                <div className={`rounded-lg p-3 text-center ${
                  resumenSocios.subsidioDirectoPEN > 0 ? 'bg-red-50' : 'bg-green-50'
                }`}>
                  <p className="text-xs text-gray-500 mb-1">Subsidio directo</p>
                  <p className={`text-lg font-bold ${
                    resumenSocios.subsidioDirectoPEN > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {formatCurrencyPEN(resumenSocios.subsidioDirectoPEN)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">CTRU - cobrado</p>
                </div>

                {/* Card 4: costo de oportunidad */}
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Costo oportunidad</p>
                  <p className="text-lg font-bold text-amber-600">
                    {formatCurrencyPEN(resumenSocios.costoOportunidadPEN)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">precio reg. - precio socio</p>
                </div>

                {/* Card 5: % inventario */}
                <div className={`rounded-lg p-3 text-center ${
                  resumenSocios.porcentajeInventarioUnidades > 15 ? 'bg-red-50' : 'bg-gray-50'
                }`}>
                  <p className="text-xs text-gray-500 mb-1">% Inventario</p>
                  <p className={`text-lg font-bold ${
                    resumenSocios.porcentajeInventarioUnidades > 15 ? 'text-red-600' : 'text-gray-700'
                  }`}>
                    {(resumenSocios.porcentajeInventarioUnidades || 0).toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {resumenSocios.unidadesConsumidas} uds. a socios
                  </p>
                </div>
              </div>

              {/* Alertas */}
              {resumenSocios.alertas.length > 0 && (
                <div className="space-y-2 mb-5">
                  {resumenSocios.alertas.map((alerta, i) => (
                    <div
                      key={i}
                      role="alert"
                      className={`flex items-start gap-2 text-sm px-3 py-2 rounded-lg ${
                        alerta.severidad === 'critical'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : alerta.severidad === 'warning'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>{alerta.mensaje}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tabla resumen por socio */}
              {resumenSocios.porSocio.length > 0 && (
                <div className="mb-5">
                  <h4 className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">
                    Resumen por socio
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-purple-200 text-left">
                          <th className="pb-2 pr-3 text-purple-600 font-medium">Socio</th>
                          <th className="pb-2 px-3 text-purple-600 font-medium text-center">Ventas</th>
                          <th className="pb-2 px-3 text-purple-600 font-medium text-right">Cobrado</th>
                          <th className="pb-2 px-3 text-purple-600 font-medium text-right">Subsidio</th>
                          <th className="pb-2 px-3 text-purple-600 font-medium text-right">Oportunidad</th>
                          <th className="pb-2 pl-3 text-purple-600 font-medium">Motivos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumenSocios.porSocio.map(s => (
                          <tr key={s.uid || s.nombre} className="border-b border-purple-50 hover:bg-purple-50/40 transition-colors">
                            <td className="py-2 pr-3">
                              <span className="font-medium text-gray-900">{s.nombre}</span>
                              {s.cargo && <span className="block text-xs text-purple-500">{s.cargo}</span>}
                            </td>
                            <td className="py-2 px-3 text-center text-gray-600">{s.ventas}</td>
                            <td className="py-2 px-3 text-right text-gray-700">{formatCurrencyPEN(s.cobradoPEN)}</td>
                            <td className={`py-2 px-3 text-right font-medium ${
                              s.subsidioPEN > 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {formatCurrencyPEN(s.subsidioPEN)}
                            </td>
                            <td className="py-2 px-3 text-right text-amber-600">
                              {formatCurrencyPEN(s.costoOportunidadPEN)}
                            </td>
                            <td className="py-2 pl-3">
                              <div className="flex flex-wrap gap-1">
                                {s.motivos.length > 0
                                  ? s.motivos.map(m => (
                                      <span
                                        key={m}
                                        className="inline-block text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded"
                                      >
                                        {MOTIVOS_VENTA_SOCIO[m] || m}
                                      </span>
                                    ))
                                  : <span className="text-xs text-gray-400">—</span>
                                }
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Lista de ventas individuales */}
              <div>
                <h4 className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">
                  Ventas del mes
                </h4>
                <div className="space-y-1.5">
                  {ventasSociosMes.map(v => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between py-2 px-3 bg-purple-50 rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                          {v.numeroVenta}
                        </span>
                        <span className="text-gray-700">{v.socioNombre || v.nombreCliente}</span>
                        {v.motivoVentaSocio && (
                          <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                            {MOTIVOS_VENTA_SOCIO[v.motivoVentaSocio] || v.motivoVentaSocio}
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          v.estado === 'entregada'  ? 'bg-green-100 text-green-700' :
                          v.estado === 'cancelada' ? 'bg-red-100 text-red-700'   :
                                                     'bg-blue-100 text-blue-700'
                        }`}>
                          {v.estado}
                        </span>
                      </div>
                      <span className="font-semibold text-purple-700 flex-shrink-0 ml-2">
                        {formatCurrencyPEN(v.totalPEN)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Tabla de Ventas */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {filtroEstado
                ? `${pipelineStages.find(s => s.id === filtroEstado)?.label || 'Ventas'} (${ventasFiltradas.length})`
                : `Ventas y Cotizaciones (${ventasLineaFiltradas.length})`
              }
            </h3>
            {/* Indicadores de rentabilidad con distribución proporcional */}
            <div className="flex items-center gap-2 flex-wrap">
              {rentabilidad && rentabilidad.totalGastosGAGO > 0 && (
                <div className="flex items-center text-sm text-gray-600 bg-orange-50 px-2 py-1 rounded-lg" title="Gastos Administrativos/Operativos distribuidos proporcionalmente">
                  <PieChart className="h-4 w-4 text-orange-500 mr-1" />
                  <span className="text-xs">GA/GO:</span>
                  <span className="font-semibold text-orange-600 ml-1">
                    S/ {(rentabilidad.totalGastosGAGO || 0).toFixed(0)}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">
                    ({(rentabilidad.totalCostoBase || 0) > 0
                      ? (((rentabilidad.totalCostoGAGO || 0) / (rentabilidad.totalCostoBase || 1)) * 100).toFixed(1)
                      : 0}%)
                  </span>
                </div>
              )}
              {rentabilidad && rentabilidad.totalGastosGVGD > 0 && (
                <div className="flex items-center text-sm text-gray-600 bg-blue-50 px-2 py-1 rounded-lg" title="Gastos de Venta/Distribución directos">
                  <Calculator className="h-4 w-4 text-blue-500 mr-1" />
                  <span className="text-xs">GV/GD:</span>
                  <span className="font-semibold text-blue-600 ml-1">
                    S/ {(rentabilidad.totalGastosGVGD || 0).toFixed(0)}
                  </span>
                </div>
              )}
              {rentabilidad && (
                <div className="flex items-center text-sm bg-green-50 px-2 py-1 rounded-lg" title="Margen Neto promedio después de GA/GO y GV/GD">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-xs">Margen Neto:</span>
                  <span className={`font-semibold ml-1 ${(rentabilidad.margenNetoPromedio || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(rentabilidad.margenNetoPromedio || 0).toFixed(1)}%
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
          onDespachar={handleDespachar}
          onDevolver={handleSolicitarDevolucion}
          loading={loading}
        />
      </Card>

      </>)}

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
              onCorregirProducto={
                ['cotizacion', 'confirmada'].includes(selectedVenta.estado)
                  ? handleCorregirProducto
                  : undefined
              }
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

      {/* Modal Registrar Pago (Unificado) */}
      {selectedVenta && isPagoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <PagoUnificadoForm
              origen="venta"
              titulo={`Cobro ${selectedVenta.numeroVenta} — ${selectedVenta.nombreCliente}`}
              esIngreso={true}
              montoTotal={selectedVenta.totalPEN}
              montoPendiente={selectedVenta.montoPendiente ?? selectedVenta.totalPEN - (selectedVenta.montoPagado || 0)}
              monedaOriginal="PEN"
              pagosAnteriores={(selectedVenta.pagos || []).map(p => ({
                id: p.id,
                fecha: p.fecha?.toDate?.() || new Date(),
                monto: p.monto,
                moneda: p.moneda || 'PEN',
                metodo: p.metodoPago,
                referencia: p.referencia,
              }))}
              onSubmit={handleRegistrarPago}
              onCancel={() => setIsPagoModalOpen(false)}
              loading={isSubmitting}
            />
          </div>
        </div>
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

      {/* Modal Corregir Producto */}
      {selectedVenta && isCorregirProductoModalOpen && productoACorregir && (
        <CorregirProductoModal
          isOpen={isCorregirProductoModalOpen}
          onClose={() => { setIsCorregirProductoModalOpen(false); setProductoACorregir(null); }}
          onSubmit={handleSubmitCorregirProducto}
          venta={selectedVenta}
          productoActual={productoACorregir}
          productosDisponibles={productosDisponibles}
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

      {/* Modal: Solicitar Devolución */}
      {ventaParaDevolver && (
        <DevolucionFormModal
          isOpen={isDevolucionFormOpen}
          onClose={() => {
            setIsDevolucionFormOpen(false);
            setVentaParaDevolver(null);
          }}
          ventaId={ventaParaDevolver.id}
          onSuccess={() => {
            fetchDevoluciones();
          }}
        />
      )}
    </div>
  );
};