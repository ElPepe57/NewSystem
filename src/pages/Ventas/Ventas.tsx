import React, { useEffect, useState, useMemo } from 'react';
import { Plus, ShoppingCart, DollarSign, TrendingUp, Package, CheckCircle, CreditCard, Calculator, PieChart, FileText, Truck, XCircle } from 'lucide-react';
import { Button, Card, Modal, useConfirmDialog, ConfirmDialog, PipelineHeader, useActionModal, ActionModal } from '../../components/common';
// Nota: ActionModal aún se usa para cancelar ventas
import type { PipelineStage } from '../../components/common';
import { useToastStore } from '../../store/toastStore';
import { VentaForm } from '../../components/modules/venta/VentaForm';
import { VentaTable } from '../../components/modules/venta/VentaTable';
import { VentaCard } from '../../components/modules/venta/VentaCard';
import { PagoVentaForm } from '../../components/modules/venta/PagoVentaForm';
import { GastosVentaForm } from '../../components/modules/venta/GastosVentaForm';
import { ProgramarEntregaModal } from '../../components/modules/venta/ProgramarEntregaModal';
import { useVentaStore } from '../../store/ventaStore';
import { useAuthStore } from '../../store/authStore';
import { useRentabilidadVentas } from '../../hooks/useRentabilidadVentas';
import { gastoService } from '../../services/gasto.service';
import { useEntregaStore } from '../../store/entregaStore';
import type { Venta, VentaFormData, MetodoPago } from '../../types/venta.types';
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
    fetchResumenPagos
  } = useVentaStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isPagoModalOpen, setIsPagoModalOpen] = useState(false);
  const [isGastosModalOpen, setIsGastosModalOpen] = useState(false);
  const [isEntregaModalOpen, setIsEntregaModalOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null);

  // Hook de rentabilidad con distribución proporcional de GA/GO
  const { datos: rentabilidad, getRentabilidadVenta, loading: loadingRentabilidad, refetch: refetchRentabilidad } = useRentabilidadVentas(ventas);

  // Store de entregas
  const { programarEntrega } = useEntregaStore();

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
      entregada: ventas.filter(v => v.estado === 'entregada').length,
      cancelada: ventas.filter(v => v.estado === 'cancelada').length
    };

    return [
      { id: 'cotizacion', label: 'Cotización', count: counts.cotizacion, color: 'gray', icon: <FileText className="h-4 w-4" /> },
      { id: 'confirmada', label: 'Confirmada', count: counts.confirmada, color: 'blue', icon: <CheckCircle className="h-4 w-4" /> },
      { id: 'asignada', label: 'Asignada', count: counts.asignada, color: 'purple', icon: <Package className="h-4 w-4" /> },
      { id: 'en_entrega', label: 'En Entrega', count: counts.en_entrega, color: 'yellow', icon: <Truck className="h-4 w-4" /> },
      { id: 'entregada', label: 'Entregada', count: counts.entregada, color: 'green', icon: <CheckCircle className="h-4 w-4" /> },
      { id: 'cancelada', label: 'Cancelada', count: counts.cancelada, color: 'red', icon: <XCircle className="h-4 w-4" /> }
    ];
  }, [ventas]);

  // Ventas filtradas
  const ventasFiltradas = useMemo(() => {
    if (!filtroEstado) return ventas;
    return ventas.filter(v => v.estado === filtroEstado);
  }, [ventas, filtroEstado]);

  // Cargar datos al montar
  useEffect(() => {
    fetchVentas();
    fetchProductosDisponibles();
    fetchStats();
    fetchResumenPagos();
  }, [fetchVentas, fetchProductosDisponibles, fetchStats, fetchResumenPagos]);

  // Crear venta/cotización
  const handleCreateVenta = async (data: VentaFormData, esVentaDirecta: boolean) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      if (esVentaDirecta) {
        await createVenta(data, user.uid);
      } else {
        await createCotizacion(data, user.uid);
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
      const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
      if (ventaActualizada) setSelectedVenta(ventaActualizada);
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
      
      const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
      if (ventaActualizada) setSelectedVenta(ventaActualizada);
      
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

      const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
      if (ventaActualizada) setSelectedVenta(ventaActualizada);
    } catch (error: any) {
      toast.error(error.message, 'Error');
    }
  };

  // Cancelar venta
  const handleCancelar = async () => {
    if (!user || !selectedVenta) return;

    const result = await openActionModal({
      title: 'Cancelar Venta',
      description: 'Esta acción liberará el inventario asignado y marcará la venta como cancelada.',
      variant: 'danger',
      confirmText: 'Cancelar Venta',
      contextInfo: [
        { label: 'Venta', value: selectedVenta.numeroVenta },
        { label: 'Cliente', value: selectedVenta.nombreCliente },
        { label: 'Estado actual', value: selectedVenta.estado }
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

      const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
      if (ventaActualizada) setSelectedVenta(ventaActualizada);

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

      // Actualizar la venta seleccionada
      const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
      if (ventaActualizada) setSelectedVenta(ventaActualizada);

      // Recargar datos
      await fetchVentas();
      await fetchResumenPagos();
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
      const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
      if (ventaActualizada) setSelectedVenta(ventaActualizada);

      await fetchResumenPagos();
      toast.success('Pago eliminado');
    } catch (error: any) {
      toast.error(error.message, 'Error');
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

      // Recargar ventas
      await fetchVentas();
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
          <VentaCard
            venta={selectedVenta}
            rentabilidadData={getRentabilidadVenta(selectedVenta.id)}
            onConfirmar={selectedVenta.estado === 'cotizacion' ? handleConfirmar : undefined}
            onAsignarInventario={selectedVenta.estado === 'confirmada' ? handleAsignarInventario : undefined}
            onMarcarEntregada={selectedVenta.estado === 'en_entrega' ? handleMarcarEntregada : undefined}
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
            onProgramarEntrega={
              (selectedVenta.estado === 'asignada' ||
               selectedVenta.estado === 'en_entrega' ||
               selectedVenta.estado === 'entrega_parcial')
                ? handleOpenEntregaModal
                : undefined
            }
            onEntregaCompletada={async () => {
              // Refrescar la venta seleccionada para ver el nuevo estado
              await fetchVentaById(selectedVenta.id);
              // Refrescar la lista de ventas
              await fetchVentas();
              // Refrescar la rentabilidad (invalida cache y recalcula)
              refetchRentabilidad();
            }}
          />
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