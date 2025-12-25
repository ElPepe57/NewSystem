import React, { useEffect, useState } from 'react';
import { Plus, ShoppingCart, DollarSign, TrendingUp, TrendingDown, Package, CheckCircle, CreditCard, Calculator, Download, RefreshCw } from 'lucide-react';
import { Button, Card, Modal } from '../../components/common';
import { VentaForm } from '../../components/modules/venta/VentaForm';
import type { AdelantoData } from '../../types/venta.types';
import { VentaTable } from '../../components/modules/venta/VentaTable';
import { VentaCard } from '../../components/modules/venta/VentaCard';
import { PagoVentaForm } from '../../components/modules/venta/PagoVentaForm';
import { GastosVentaForm } from '../../components/modules/venta/GastosVentaForm';
import { useVentaStore } from '../../store/ventaStore';
import { useAuthStore } from '../../store/authStore';
import { gastoService } from '../../services/gasto.service';
import { VentaService } from '../../services/venta.service';
import { useRentabilidadVentas } from '../../hooks/useRentabilidadVentas';
import type { Venta, VentaFormData, MetodoPago } from '../../types/venta.types';
import { exportService } from '../../services/export.service';

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
    completarAsignacionProducto,
    actualizarFechaEstimadaProducto,
    marcarEnEntrega,
    marcarEntregada,
    registrarEntregaParcial,
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
  const [isGastosVentaModalOpen, setIsGastosVentaModalOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Hook centralizado para cálculos de rentabilidad
  const { datos: rentabilidad, getRentabilidadVenta } = useRentabilidadVentas(ventas);

  // Cargar datos al montar
  useEffect(() => {
    fetchVentas();
    fetchProductosDisponibles();
    fetchStats();
    fetchResumenPagos();
  }, [fetchVentas, fetchProductosDisponibles, fetchStats, fetchResumenPagos]);

  // Crear venta/cotización con adelanto opcional
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

      // Si hay adelanto, registrarlo después de crear la venta/cotización
      if (adelanto && adelanto.monto > 0 && ventaId) {
        try {
          await VentaService.registrarAdelanto(
            ventaId,
            {
              monto: adelanto.monto,
              metodoPago: adelanto.metodoPago,
              referencia: adelanto.referencia,
              cuentaDestinoId: adelanto.cuentaDestinoId
            },
            user.uid
          );
        } catch (errorAdelanto: any) {
          console.error('Error al registrar adelanto:', errorAdelanto);
          alert(`Venta creada, pero hubo un error al registrar el adelanto: ${errorAdelanto.message}`);
        }
      }

      setIsModalOpen(false);
      await fetchProductosDisponibles();
      await fetchVentas(); // Recargar para ver el adelanto
    } catch (error: any) {
      console.error('Error al crear venta:', error);
      alert(error.message);
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
      alert(error.message);
    }
  };

  // Asignar inventario con FEFO
  const handleAsignarInventario = async (permitirParcial: boolean = false) => {
    if (!user || !selectedVenta) return;

    const mensajeConfirmacion = permitirParcial
      ? '¿Asignar inventario parcialmente? Se asignarán solo los productos con stock disponible.'
      : '¿Asignar todo el inventario usando FEFO? Si falta stock, la operación fallará.';

    if (!window.confirm(mensajeConfirmacion)) {
      return;
    }

    try {
      const resultados = await asignarInventario(selectedVenta.id, user.uid, permitirParcial);

      // Analizar resultados
      const totalAsignados = resultados.reduce((sum, r) => sum + r.cantidadAsignada, 0);
      const totalPendientes = resultados.reduce((sum, r) => sum + r.unidadesFaltantes, 0);

      let mensaje = '';
      if (totalPendientes === 0) {
        mensaje = `✅ Inventario asignado completamente!\n\n${totalAsignados} unidades asignadas.`;
      } else {
        mensaje = `⚠️ Asignación parcial completada.\n\n` +
          `✓ ${totalAsignados} unidades asignadas\n` +
          `✗ ${totalPendientes} unidades pendientes de stock\n\n` +
          `Los productos pendientes se pueden asignar cuando llegue nuevo stock.`;
      }

      alert(mensaje);

      await fetchVentas();
      const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
      if (ventaActualizada) setSelectedVenta(ventaActualizada);

      await fetchProductosDisponibles();
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Completar asignación de un producto específico
  const handleCompletarAsignacion = async (productoId: string) => {
    if (!user || !selectedVenta) return;

    try {
      const resultado = await completarAsignacionProducto(selectedVenta.id, productoId, user.uid);

      if (resultado.unidadesFaltantes === 0) {
        alert(`✅ Producto asignado completamente! ${resultado.cantidadAsignada} unidades asignadas.`);
      } else {
        alert(`⚠️ Asignación parcial: ${resultado.cantidadAsignada} unidades asignadas, ${resultado.unidadesFaltantes} aún pendientes.`);
      }

      await fetchVentas();
      const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
      if (ventaActualizada) setSelectedVenta(ventaActualizada);

      await fetchProductosDisponibles();
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Actualizar fecha estimada de un producto
  const handleActualizarFechaEstimada = async (productoId: string) => {
    if (!user || !selectedVenta) return;

    const producto = selectedVenta.productos.find(p => p.productoId === productoId);
    if (!producto) return;

    const fechaStr = window.prompt(
      `Fecha estimada de llegada de stock para ${producto.marca} ${producto.nombreComercial}\n(formato: YYYY-MM-DD)`,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );

    if (!fechaStr) return;

    const fecha = new Date(fechaStr);
    if (isNaN(fecha.getTime())) {
      alert('Fecha inválida. Use el formato YYYY-MM-DD');
      return;
    }

    const notas = window.prompt('Notas adicionales (opcional):') || '';

    try {
      await actualizarFechaEstimadaProducto(selectedVenta.id, productoId, fecha, notas, user.uid);
      alert('✅ Fecha estimada actualizada');

      await fetchVentas();
      const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
      if (ventaActualizada) setSelectedVenta(ventaActualizada);
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Marcar en entrega
  const handleMarcarEnEntrega = async () => {
    if (!user || !selectedVenta) return;
    
    const direccion = window.prompt('Dirección de entrega (opcional):', selectedVenta.direccionEntrega || '');
    const notas = window.prompt('Notas de entrega (opcional):');
    
    try {
      await marcarEnEntrega(selectedVenta.id, user.uid, { 
        direccionEntrega: direccion || undefined,
        notasEntrega: notas || undefined
      });
      
      const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
      if (ventaActualizada) setSelectedVenta(ventaActualizada);
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Marcar como entregada
  const handleMarcarEntregada = async () => {
    if (!user || !selectedVenta) return;

    const hayPendientes = selectedVenta.productos.some(p =>
      (p.cantidadAsignada || 0) < p.cantidad || (p.cantidadPendiente || 0) > 0
    );

    const mensaje = hayPendientes
      ? `¿Entregar los productos asignados de ${selectedVenta.numeroVenta}? La venta quedará en "Entrega Parcial" porque hay productos pendientes.`
      : `¿Marcar la venta ${selectedVenta.numeroVenta} como entregada completamente?`;

    if (!window.confirm(mensaje)) {
      return;
    }

    try {
      await marcarEntregada(selectedVenta.id, user.uid);

      if (hayPendientes) {
        alert('✅ Entrega registrada. La venta queda en "Entrega Parcial" - puedes continuar asignando y entregando los productos pendientes.');
      } else {
        alert('✅ Venta completada. Todas las unidades han sido entregadas.');
      }

      await fetchVentas();
      const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
      if (ventaActualizada) setSelectedVenta(ventaActualizada);
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Registrar entrega parcial (para ventas en estado entrega_parcial)
  const handleRegistrarEntregaParcial = async () => {
    if (!user || !selectedVenta) return;

    // Verificar que haya algo para entregar
    const productosParaEntregar = selectedVenta.productos.filter(p =>
      (p.cantidadAsignada || 0) > (p.cantidadEntregada || 0)
    );

    if (productosParaEntregar.length === 0) {
      alert('No hay productos asignados pendientes de entrega. Asigna inventario primero.');
      return;
    }

    const direccion = window.prompt('Dirección de entrega (opcional):', selectedVenta.direccionEntrega || '');
    const notas = window.prompt('Notas de entrega (opcional):');

    if (!window.confirm('¿Registrar entrega de los productos asignados pendientes?')) {
      return;
    }

    try {
      const entrega = await registrarEntregaParcial(selectedVenta.id, user.uid, {
        direccionEntrega: direccion || undefined,
        notasEntrega: notas || undefined
      });

      const cantidadEntregada = entrega.productosEntregados.reduce((sum, p) => sum + p.cantidad, 0);
      alert(`✅ Entrega registrada!\n\n${cantidadEntregada} unidades entregadas en ${entrega.productosEntregados.length} producto(s).`);

      await fetchVentas();
      const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
      if (ventaActualizada) setSelectedVenta(ventaActualizada);
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Cancelar venta
  const handleCancelar = async () => {
    if (!user || !selectedVenta) return;
    
    const motivo = window.prompt('Motivo de cancelación:');
    if (!motivo) return;
    
    try {
      await cancelarVenta(selectedVenta.id, user.uid, motivo);
      alert('✅ Venta cancelada. El inventario asignado ha sido liberado.');
      
      const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
      if (ventaActualizada) setSelectedVenta(ventaActualizada);
      
      await fetchProductosDisponibles();
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Eliminar cotización
  const handleDelete = async (venta: Venta) => {
    if (!window.confirm(`¿Eliminar la cotización ${venta.numeroVenta}?`)) {
      return;
    }

    try {
      await deleteVenta(venta.id);
    } catch (error: any) {
      alert(error.message);
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
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar pago
  const handleEliminarPago = async (pagoId: string) => {
    if (!user || !selectedVenta) return;

    if (!window.confirm('¿Eliminar este pago? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await eliminarPago(selectedVenta.id, pagoId, user.uid);

      // Actualizar la venta seleccionada
      const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
      if (ventaActualizada) setSelectedVenta(ventaActualizada);

      await fetchResumenPagos();
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Recalcular estado de la venta
  const handleRecalcularEstado = async () => {
    if (!user || !selectedVenta) return;

    try {
      await VentaService.recalcularEstado(selectedVenta.id, user.uid);

      // Recargar ventas y actualizar la seleccionada
      await fetchVentas();
      const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
      if (ventaActualizada) {
        setSelectedVenta(ventaActualizada);
      } else {
        // Si no la encuentra, cerrar el modal para ver la lista actualizada
        setSelectedVenta(null);
      }

      alert('Estado recalculado correctamente');
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Sincronizar adelantos pendientes desde cotizaciones
  const handleSincronizarAdelantos = async () => {
    if (!user) return;

    if (!window.confirm('¿Sincronizar adelantos de cotizaciones a ventas? Esto corregirá ventas que fueron convertidas sin transferir el adelanto correctamente.')) {
      return;
    }

    setIsSyncing(true);
    try {
      const resultado = await VentaService.sincronizarTodosLosAdelantosPendientes(user.uid);

      if (resultado.sincronizadas > 0) {
        alert(`✅ Sincronización completada!\n\n${resultado.sincronizadas} de ${resultado.totalRevisadas} ventas sincronizadas.`);
        await fetchVentas();
        await fetchResumenPagos();
      } else if (resultado.totalRevisadas > 0) {
        alert(`ℹ️ No hay adelantos pendientes de sincronizar.\n\n${resultado.totalRevisadas} ventas revisadas, todas ya están al día.`);
      } else {
        alert('ℹ️ No hay ventas con cotización de origen para revisar.');
      }
    } catch (error: any) {
      alert(`Error al sincronizar: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Sincronizar adelanto de venta específica
  const handleSincronizarAdelantoVenta = async () => {
    if (!user || !selectedVenta) return;

    setIsSyncing(true);
    try {
      const resultado = await VentaService.sincronizarAdelantoDesdeCotizacion(selectedVenta.id, user.uid);

      if (resultado.sincronizado) {
        alert(`✅ ${resultado.mensaje}`);
        await fetchVentas();
        await fetchResumenPagos();

        // Actualizar venta seleccionada
        const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
        if (ventaActualizada) setSelectedVenta(ventaActualizada);
      } else {
        alert(`ℹ️ ${resultado.mensaje}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Abrir modal de gastos de venta
  const handleOpenGastosVentaModal = () => {
    setIsGastosVentaModalOpen(true);
  };

  // Registrar gastos de venta
  // Handler para registrar gastos de venta (nuevo diseño dinámico)
  const handleRegistrarGastosVenta = async (nuevosGastos: {
    id: string;
    tipo: string;
    categoria: string;
    descripcion: string;
    monto: number;
  }[]) => {
    if (!user || !selectedVenta) return;

    setIsSubmitting(true);
    try {
      // Crear cada gasto GVD individualmente
      for (const gasto of nuevosGastos) {
        await gastoService.create({
          tipo: gasto.tipo as any,
          categoria: gasto.categoria as any,
          descripcion: gasto.descripcion,
          montoPEN: gasto.monto,
          fecha: new Date(),
          estado: 'pagado',
          metodoPago: 'efectivo',
          esProrrateable: false,
          impactaCTRU: false,
          ventaId: selectedVenta.id,
          ventaNumero: selectedVenta.numeroVenta
        }, user.uid);
      }

      // Calcular totales para actualizar en la venta
      const totalGastos = nuevosGastos.reduce((sum, g) => sum + g.monto, 0);

      // Actualizar totales de gastos en la venta
      const gastosExistentes = await gastoService.getGastosVenta(selectedVenta.id);
      const totalGastosVenta = gastosExistentes.reduce((sum, g) => sum + g.montoPEN, 0);

      await VentaService.actualizarGastosVenta(selectedVenta.id, {
        otrosGastosVenta: totalGastosVenta // Guardamos el total acumulado
      }, user.uid);

      setIsGastosVentaModalOpen(false);

      // Recargar datos
      await fetchVentas();
      const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
      if (ventaActualizada) setSelectedVenta(ventaActualizada);

      alert(`✅ ${nuevosGastos.length} gasto(s) registrados correctamente`);
    } catch (error: any) {
      alert(error.message);
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSincronizarAdelantos}
            disabled={isSyncing || ventas.length === 0}
            title="Sincronizar adelantos de cotizaciones a ventas"
          >
            <RefreshCw className={`h-5 w-5 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sync Adelantos'}
          </Button>
          <Button
            variant="outline"
            onClick={() => exportService.exportVentas(ventas)}
            disabled={ventas.length === 0}
          >
            <Download className="h-5 w-5 mr-2" />
            Exportar Excel
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            disabled={productosDisponibles.length === 0}
          >
            <Plus className="h-5 w-5 mr-2" />
            Nueva Venta
          </Button>
        </div>
      </div>

      {/* Alerta si no hay productos disponibles */}
      {productosDisponibles.length === 0 && (
        <Card padding="md">
          <div className="flex items-center">
            <Package className="h-5 w-5 text-warning-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">No hay productos disponibles para venta</p>
              <p className="text-sm text-gray-600">Recibe inventario en Perú para poder vender.</p>
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

          {/* KPIs Rentabilidad - Usando cálculo centralizado */}
          {rentabilidad && rentabilidad.totalUtilidadNeta !== 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card padding="md">
                <div className="text-sm text-gray-600">Utilidad Bruta</div>
                <div className="text-xs text-gray-400">(con CTRU + GA/GO)</div>
                <div className={`text-2xl font-bold mt-1 ${rentabilidad.totalUtilidadBruta >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  S/ {rentabilidad.totalUtilidadBruta.toFixed(2)}
                </div>
              </Card>

              <Card padding="md">
                <div className="text-sm text-gray-600">Utilidad Neta</div>
                <div className="text-xs text-gray-400">(- gastos GV/GD)</div>
                <div className={`text-2xl font-bold mt-1 ${rentabilidad.totalUtilidadNeta >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  S/ {rentabilidad.totalUtilidadNeta.toFixed(2)}
                </div>
              </Card>

              <Card padding="md">
                <div className="text-sm text-gray-600">Margen Bruto</div>
                <div className="flex items-center mt-1">
                  {rentabilidad.margenBrutoPromedio >= 0 ? (
                    <TrendingUp className="h-6 w-6 text-success-500 mr-2" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-danger-500 mr-2" />
                  )}
                  <span className={`text-2xl font-bold ${rentabilidad.margenBrutoPromedio >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    {rentabilidad.margenBrutoPromedio.toFixed(1)}%
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Neto: {rentabilidad.margenNetoPromedio.toFixed(1)}%
                </div>
              </Card>

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

      {/* Tabla de Ventas */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Ventas y Cotizaciones ({ventas.length})
            </h3>
            {rentabilidad && (rentabilidad.totalGastosGAGO > 0 || rentabilidad.totalGastosGVGD > 0) && (
              <div className="flex items-center gap-3 text-sm flex-wrap">
                {/* GA/GO (Prorrateables) */}
                {rentabilidad.totalGastosGAGO > 0 && (
                  <div className="flex items-center text-gray-600 bg-orange-50 px-2 py-1 rounded-lg">
                    <Calculator className="h-4 w-4 text-orange-500 mr-1" />
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
                {/* GV/GD (Por venta) */}
                {rentabilidad.totalGastosGVGD > 0 && (
                  <div className="flex items-center text-gray-600 bg-purple-50 px-2 py-1 rounded-lg">
                    <Package className="h-4 w-4 text-purple-500 mr-1" />
                    <span className="text-xs">GV/GD:</span>
                    <span className="font-semibold text-purple-600 ml-1">
                      S/ {rentabilidad.totalGastosGVGD.toFixed(0)}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">
                      ({rentabilidad.totalVentas > 0
                        ? ((rentabilidad.totalGastosGVGD / rentabilidad.totalVentas) * 100).toFixed(1)
                        : 0}% ventas)
                    </span>
                  </div>
                )}
                {/* Ratio Eficiencia */}
                {rentabilidad.totalUtilidadNeta > 0 && (rentabilidad.totalGastosGAGO + rentabilidad.totalGastosGVGD) > 0 && (
                  <div className="flex items-center text-gray-600 bg-emerald-50 px-2 py-1 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-emerald-500 mr-1" />
                    <span className="text-xs">Eficiencia:</span>
                    <span className="font-semibold text-emerald-600 ml-1">
                      {(rentabilidad.totalUtilidadNeta / (rentabilidad.totalGastosGAGO + rentabilidad.totalGastosGVGD)).toFixed(1)}x
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <VentaTable
          ventas={ventas}
          onView={handleViewDetails}
          onDelete={handleDelete}
          loading={loading}
          rentabilidadData={rentabilidad}
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
          onProductoCreated={() => fetchProductosDisponibles()}
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
            onAsignarInventario={
              selectedVenta.estado === 'confirmada' ||
              selectedVenta.estado === 'parcial' ||
              selectedVenta.estado === 'entrega_parcial'
                ? handleAsignarInventario
                : undefined
            }
            onCompletarAsignacion={
              selectedVenta.estado === 'parcial' || selectedVenta.estado === 'entrega_parcial'
                ? handleCompletarAsignacion
                : undefined
            }
            onActualizarFechaEstimada={
              selectedVenta.estado === 'parcial' || selectedVenta.estado === 'entrega_parcial'
                ? handleActualizarFechaEstimada
                : undefined
            }
            onMarcarEnEntrega={
              selectedVenta.estado === 'asignada' || selectedVenta.estado === 'parcial'
                ? handleMarcarEnEntrega
                : undefined
            }
            onMarcarEntregada={
              selectedVenta.estado === 'en_entrega' || selectedVenta.estado === 'entrega_parcial'
                ? handleMarcarEntregada
                : undefined
            }
            onRegistrarEntregaParcial={
              selectedVenta.estado === 'entrega_parcial' ? handleRegistrarEntregaParcial : undefined
            }
            onCancelar={
              selectedVenta.estado !== 'entregada' &&
              selectedVenta.estado !== 'cancelada' &&
              selectedVenta.estado !== 'entrega_parcial'
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
            onRecalcularEstado={
              selectedVenta.estado === 'entrega_parcial' || selectedVenta.estado === 'parcial'
                ? handleRecalcularEstado
                : undefined
            }
            onRegistrarGastosVenta={
              selectedVenta.estado !== 'cotizacion' && selectedVenta.estado !== 'cancelada'
                ? handleOpenGastosVentaModal
                : undefined
            }
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

      {/* Modal Gastos de Venta */}
      <Modal
        isOpen={isGastosVentaModalOpen}
        onClose={() => setIsGastosVentaModalOpen(false)}
        title="Gastos de Venta"
        size="lg"
      >
        {selectedVenta && (
          <GastosVentaForm
            venta={selectedVenta}
            onSubmit={handleRegistrarGastosVenta}
            onCancel={() => setIsGastosVentaModalOpen(false)}
            loading={isSubmitting}
          />
        )}
      </Modal>
    </div>
  );
};