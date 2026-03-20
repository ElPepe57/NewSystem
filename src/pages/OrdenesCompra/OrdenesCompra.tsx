import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Package, DollarSign, TrendingUp, AlertCircle, Download, ExternalLink, FileText, Send, Truck, CheckCircle, XCircle, CreditCard, PackageCheck } from 'lucide-react';
import { Button, Card, Modal, useConfirmDialog, ConfirmDialog, PipelineHeader, useActionModal, ActionModal } from '../../components/common';
import type { PipelineStage } from '../../components/common';
import { useToastStore } from '../../store/toastStore';
import { OrdenCompraForm } from '../../components/modules/ordenCompra/OrdenCompraForm';
import { OrdenCompraTable } from '../../components/modules/ordenCompra/OrdenCompraTable';
import { OrdenCompraCard } from '../../components/modules/ordenCompra/OrdenCompraCard';
import { PagoForm } from '../../components/modules/ordenCompra/PagoForm';
import { RecepcionParcialModal } from '../../components/modules/ordenCompra/RecepcionParcialModal';
import { useOrdenCompraStore } from '../../store/ordenCompraStore';
import { useProveedorStore } from '../../store/proveedorStore';
import { useProductoStore } from '../../store/productoStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { useAuthStore } from '../../store/authStore';
import { exportService } from '../../services/export.service';
import type { OrdenCompra, OrdenCompraFormData, EstadoOrden } from '../../types/ordenCompra.types';
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';

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
  const { productos, fetchProductos } = useProductoStore();
  const { getTCDelDia } = useTipoCambioStore();
  const [tcSugerido, setTcSugerido] = useState<number>(0);

  // Proveedores desde el store centralizado
  const { proveedoresActivos, fetchProveedoresActivos } = useProveedorStore();

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
    registrarPago,
    recibirOrden,
    recibirOrdenParcial,
    deleteOrden,
    fetchStats
  } = useOrdenCompraStore();

  const lineaFiltroGlobal = useLineaNegocioStore(state => state.lineaFiltroGlobal);

  // Filtrar órdenes por línea de negocio global
  const ordenesLN = useMemo(() => {
    if (!lineaFiltroGlobal) return ordenes;
    return ordenes.filter(o => o.lineaNegocioId === lineaFiltroGlobal);
  }, [ordenes, lineaFiltroGlobal]);

  const [isOrdenModalOpen, setIsOrdenModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isPagoModalOpen, setIsPagoModalOpen] = useState(false);
  const [isRecepcionModalOpen, setIsRecepcionModalOpen] = useState(false);
  const [selectedOrden, setSelectedOrdenLocal] = useState<OrdenCompra | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null);
  // Estado para edición
  const [ordenEditando, setOrdenEditando] = useState<OrdenCompra | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

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
  const toast = useToastStore();

  // Pipeline stages para filtrado visual
  const pipelineStages: PipelineStage[] = useMemo(() => {
    const counts = {
      borrador: ordenesLN.filter(o => o.estado === 'borrador').length,
      enviada: ordenesLN.filter(o => o.estado === 'enviada').length,
      en_transito: ordenesLN.filter(o => o.estado === 'en_transito').length,
      recibida_parcial: ordenesLN.filter(o => o.estado === 'recibida_parcial').length,
      recibida: ordenesLN.filter(o => o.estado === 'recibida').length,
      cancelada: ordenesLN.filter(o => o.estado === 'cancelada').length
    };

    return [
      { id: 'borrador', label: 'Borrador', count: counts.borrador, color: 'gray', icon: <FileText className="h-4 w-4" /> },
      { id: 'enviada', label: 'Enviada', count: counts.enviada, color: 'blue', icon: <Send className="h-4 w-4" /> },
      { id: 'en_transito', label: 'En Tránsito', count: counts.en_transito, color: 'yellow', icon: <Truck className="h-4 w-4" /> },
      { id: 'recibida_parcial', label: 'Parcial', count: counts.recibida_parcial, color: 'orange', icon: <PackageCheck className="h-4 w-4" /> },
      { id: 'recibida', label: 'Recibida', count: counts.recibida, color: 'green', icon: <CheckCircle className="h-4 w-4" /> },
      { id: 'cancelada', label: 'Cancelada', count: counts.cancelada, color: 'red', icon: <XCircle className="h-4 w-4" /> }
    ];
  }, [ordenesLN]);

  // Órdenes filtradas
  const ordenesFiltradas = useMemo(() => {
    if (!filtroEstado) return ordenesLN;
    return ordenesLN.filter(o => o.estado === filtroEstado);
  }, [ordenesLN, filtroEstado]);

  // Cargar datos al montar
  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchOrdenes();
        await fetchProveedoresActivos();
        await fetchProductos();
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
      setIsOrdenModalOpen(true);

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
        setIsOrdenModalOpen(true);
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
      setIsOrdenModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [fromMultipleRequerimientos, proveedoresActivos]);

  // Crear orden
  const handleCreateOrden = async (data: OrdenCompraFormData) => {
    if (!user) return;

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

          alert(
            `✅ OC creada para ${asignacionActualNombre}\n\n` +
            `Siguiente: ${siguienteAsignacion.viajeroNombre} (${nuevosCompletados + 1}/${totalViajerosOriginal})`
          );
          // El modal permanece abierto para el siguiente viajero
        } else {
          // Terminamos con todos los viajeros - guardar total antes de resetear
          const totalCreadas = totalViajerosOriginal;

          // MARCAR COMO COMPLETADO PRIMERO para evitar que el useEffect re-abra el modal
          setMultiViajeroCompletado(true);

          // Limpiar todos los estados
          setIsOrdenModalOpen(false);
          setInitialFormData(null);
          setMultiViajeroData(null);
          setCurrentViajeroIndex(0);
          setCreandoMultiOC(false);
          setTotalViajerosOriginal(0);
          setViajerosCompletados(0);

          // Mostrar mensaje DESPUÉS de limpiar estados
          alert(
            `✅ ¡Todas las OCs han sido creadas!\n\n` +
            `Total: ${totalCreadas} órdenes de compra`
          );
        }
      } else {
        setIsOrdenModalOpen(false);
        setInitialFormData(null);
      }
    } catch (error: any) {
      console.error('Error al crear orden:', error);
      alert(error.message);
      // En caso de error, marcar como completado y cerrar todo
      if (creandoMultiOC) {
        setMultiViajeroCompletado(true);
        setMultiViajeroData(null);
        setCurrentViajeroIndex(0);
        setCreandoMultiOC(false);
        setTotalViajerosOriginal(0);
        setViajerosCompletados(0);
      }
      setIsOrdenModalOpen(false);
      setInitialFormData(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cerrar modal y limpiar datos iniciales
  const handleCloseOrdenModal = () => {
    setIsOrdenModalOpen(false);
    setInitialFormData(null);
    // Limpiar estado de edición
    setOrdenEditando(null);
    setIsEditMode(false);
    // Limpiar datos de multi-viajero si estaba en ese modo
    if (creandoMultiOC) {
      // Marcar como completado para evitar que el useEffect re-abra el modal
      setMultiViajeroCompletado(true);
      setMultiViajeroData(null);
      setCurrentViajeroIndex(0);
      setCreandoMultiOC(false);
      setTotalViajerosOriginal(0);
      setViajerosCompletados(0);
    }
  };

  // Helper: obtener orden fresca del store (evita stale closure)
  const refreshSelectedOrden = (ordenId: string) => {
    const freshOrdenes = useOrdenCompraStore.getState().ordenes;
    const ordenActualizada = freshOrdenes.find(o => o.id === ordenId);
    if (ordenActualizada) setSelectedOrdenLocal(ordenActualizada);
  };

  // Ver detalles
  const handleViewDetails = (orden: OrdenCompra) => {
    setSelectedOrdenLocal(orden);
    setIsDetailsModalOpen(true);
  };

  // Editar orden (solo permitido en estado borrador)
  const handleEditOrden = (orden: OrdenCompra) => {
    if (orden.estado !== 'borrador') {
      toast.warning('Solo se pueden editar órdenes en estado Borrador');
      return;
    }
    setOrdenEditando(orden);
    setIsEditMode(true);
    setIsOrdenModalOpen(true);
  };

  // Actualizar orden existente
  const handleUpdateOrden = async (data: OrdenCompraFormData) => {
    if (!user || !ordenEditando) return;

    setIsSubmitting(true);
    try {
      await updateOrden(ordenEditando.id, data, user.uid);
      toast.success('Orden actualizada correctamente');
      setIsOrdenModalOpen(false);
      setOrdenEditando(null);
      setIsEditMode(false);
    } catch (error: any) {
      console.error('Error al actualizar orden:', error);
      toast.error(error.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cambiar estado
  const handleCambiarEstado = async (nuevoEstado: EstadoOrden) => {
    if (!user || !selectedOrden) return;

    // Si cambia a "en_transito", pedir tracking
    if (nuevoEstado === 'en_transito') {
      const result = await openActionModal({
        title: 'Marcar en Tránsito',
        description: 'Ingresa la información de seguimiento del envío.',
        variant: 'info',
        confirmText: 'Marcar en Tránsito',
        contextInfo: [
          { label: 'Orden', value: selectedOrden.numeroOrden },
          { label: 'Proveedor', value: selectedOrden.nombreProveedor },
          { label: 'Total', value: `$${selectedOrden.totalUSD.toFixed(2)}` }
        ],
        fields: [
          {
            id: 'numeroTracking',
            label: 'Número de tracking',
            type: 'text',
            placeholder: 'Ej: 1Z999AA10123456784'
          },
          {
            id: 'courier',
            label: 'Courier / Transportista',
            type: 'text',
            placeholder: 'Ej: UPS, FedEx, DHL...'
          }
        ]
      });

      if (!result) return;

      try {
        await cambiarEstadoOrden(selectedOrden.id, nuevoEstado, user.uid, {
          numeroTracking: result.numeroTracking as string || undefined,
          courier: result.courier as string || undefined
        });
        refreshSelectedOrden(selectedOrden.id);
        toast.success('Orden marcada en tránsito');
      } catch (error: any) {
        toast.error(error.message, 'Error');
      }
    }
    // Otros estados
    else {
      try {
        await cambiarEstadoOrden(selectedOrden.id, nuevoEstado, user.uid);
        refreshSelectedOrden(selectedOrden.id);
        toast.success(`Estado actualizado a: ${nuevoEstado}`);
      } catch (error: any) {
        toast.error(error.message, 'Error');
      }
    }
  };

  // Registrar pago
  const handleRegistrarPago = () => {
    if (!selectedOrden) return;
    setIsPagoModalOpen(true);
  };

  const handleSubmitPago = async (datos: {
    fechaPago: Date;
    monedaPago: 'USD' | 'PEN';
    montoOriginal: number;
    tipoCambio: number;
    metodoPago: any;
    cuentaOrigenId?: string;
    referencia?: string;
    notas?: string;
  }) => {
    if (!user || !selectedOrden) return;

    try {
      setIsSubmitting(true);
      await registrarPago(selectedOrden.id, {
        fechaPago: datos.fechaPago,
        monedaPago: datos.monedaPago,
        montoOriginal: datos.montoOriginal,
        tipoCambio: datos.tipoCambio,
        metodoPago: datos.metodoPago,
        cuentaOrigenId: datos.cuentaOrigenId,
        referencia: datos.referencia,
        notas: datos.notas
      }, user.uid);

      const simbolo = datos.monedaPago === 'USD' ? '$' : 'S/';
      alert(`✅ Pago de ${simbolo} ${datos.montoOriginal.toFixed(2)} registrado exitosamente`);
      setIsPagoModalOpen(false);

      // Recargar órdenes para ver actualización
      await fetchOrdenes();
      refreshSelectedOrden(selectedOrden.id);
    } catch (error: any) {
      alert(`❌ Error al registrar pago: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Recibir orden - abrir modal de recepción parcial
  const handleRecibirOrden = () => {
    if (!selectedOrden) return;
    setIsRecepcionModalOpen(true);
  };

  // Submit de recepción parcial
  const handleSubmitRecepcion = async (
    productosRecibidos: Array<{ productoId: string; cantidadRecibida: number }>,
    observaciones?: string
  ) => {
    if (!user || !selectedOrden) return;

    await recibirOrdenParcial(selectedOrden.id, productosRecibidos, user.uid, observaciones);

    // Recargar orden actualizada
    await fetchOrdenes();
    refreshSelectedOrden(selectedOrden.id);
  };

  // Revertir recepciones (limpieza de datos de prueba)
  const handleRevertirRecepciones = async () => {
    if (!user || !selectedOrden) return;

    const confirmed = await confirm({
      title: 'Revertir Recepciones',
      message: `¿Revertir TODAS las recepciones de ${selectedOrden.numeroOrden}? Esto eliminará las unidades generadas y regresará la OC a estado "En Tránsito". Esta acción NO se puede deshacer.`,
      confirmText: 'Revertir Todo',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      const { OrdenCompraService } = await import('../../services/ordenCompra.service');
      const result = await OrdenCompraService.revertirRecepciones(selectedOrden.id, user.uid);
      toast.success(`Recepciones revertidas: ${result.unidadesEliminadas} unidades eliminadas, estado → ${result.estadoRestaurado}`);
      await fetchOrdenes();
      await fetchStats();
      refreshSelectedOrden(selectedOrden.id);
    } catch (error: any) {
      toast.error(error.message || 'Error al revertir');
    } finally {
      setIsSubmitting(false);
    }
  };

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
      alert(error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Órdenes de Compra</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Gestión de compras y proveedores</p>
        </div>
        <div className="flex items-center gap-2 sm:space-x-3">
          <Button
            variant="outline"
            onClick={() => exportService.exportOrdenesCompra(ordenes)}
            disabled={ordenes.length === 0}
            className="flex-1 sm:flex-initial justify-center"
          >
            <Download className="h-5 w-5 mr-2" />
            <span className="hidden sm:inline">Exportar Excel</span>
            <span className="sm:hidden">Exportar</span>
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsOrdenModalOpen(true)}
            disabled={proveedoresActivos.length === 0}
            className="flex-1 sm:flex-initial justify-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            <span className="hidden sm:inline">Nueva Orden</span>
            <span className="sm:hidden">Nueva OC</span>
          </Button>
        </div>
      </div>

      {/* Alerta si no hay proveedores */}
      {proveedoresActivos.length === 0 && (
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-warning-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">No hay proveedores registrados</p>
                <p className="text-sm text-gray-600">Crea proveedores desde el Gestor de Maestros antes de hacer órdenes de compra.</p>
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

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Total Órdenes</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.totalOrdenes}
                </div>
              </div>
              <Package className="h-10 w-10 text-gray-400" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">En Proceso</div>
                <div className="text-2xl font-bold text-warning-600 mt-1">
                  {stats.enviadas + stats.pagadas + stats.enTransito + (stats.recibidasParcial || 0)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {stats.enviadas} env. / {stats.enTransito} trán.{(stats.recibidasParcial || 0) > 0 ? ` / ${stats.recibidasParcial} parc.` : ''}
                </div>
              </div>
              <TrendingUp className="h-10 w-10 text-warning-400" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Recibidas</div>
                <div className="text-2xl font-bold text-success-600 mt-1">
                  {stats.recibidas}
                </div>
              </div>
              <Package className="h-10 w-10 text-success-400" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Valor Total</div>
                <div className="text-xl font-bold text-primary-600 mt-1">
                  ${stats.valorTotalUSD.toFixed(0)}
                </div>
                {stats.valorTotalPEN > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    S/ {stats.valorTotalPEN.toFixed(0)}
                  </div>
                )}
              </div>
              <DollarSign className="h-10 w-10 text-primary-400" />
            </div>
          </Card>
        </div>
      )}

      {/* Pipeline de Estados */}
      <PipelineHeader
        stages={pipelineStages}
        activeStage={filtroEstado}
        onStageClick={setFiltroEstado}
        title="Pipeline de Compras"
      />

      {/* Tabla de Órdenes */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {filtroEstado
              ? `${pipelineStages.find(s => s.id === filtroEstado)?.label || 'Órdenes'} (${ordenesFiltradas.length})`
              : `Órdenes de Compra (${ordenes.length})`
            }
          </h3>
        </div>
        <OrdenCompraTable
          ordenes={ordenesFiltradas}
          onView={handleViewDetails}
          onEdit={handleEditOrden}
          onDelete={handleDelete}
          loading={loading}
        />
      </Card>

      {/* Modal Nueva Orden */}
      {isOrdenModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop - click para cerrar */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCloseOrdenModal}
          />

          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header con X para cerrar */}
              <div className="flex-shrink-0 bg-white z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 rounded-t-lg">
                <h3 className="text-xl font-semibold text-gray-900">
                  {isEditMode && ordenEditando
                    ? `Editar Orden ${ordenEditando.numeroOrden}`
                    : creandoMultiOC && multiViajeroData
                      ? `Nueva OC para ${multiViajeroData.asignaciones[currentViajeroIndex]?.viajeroNombre} (${viajerosCompletados + 1}/${totalViajerosOriginal})`
                      : initialFormData?.requerimientoNumero
                        ? `Nueva OC desde ${initialFormData.requerimientoNumero}`
                        : "Nueva Orden de Compra"
                  }
                </h3>
                <button
                  type="button"
                  onClick={handleCloseOrdenModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content - scrollable area */}
              <div className="p-6 overflow-y-auto flex-1 min-h-0">
                {/* Banner de progreso multi-viajero */}
                {creandoMultiOC && multiViajeroData && totalViajerosOriginal > 0 && (
                  <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Package className="h-5 w-5 text-purple-600 mr-2" />
                        <span className="font-medium text-purple-900">
                          Creando OC {viajerosCompletados + 1} de {totalViajerosOriginal}
                        </span>
                      </div>
                      <span className="text-sm text-purple-600">
                        Viajero: {multiViajeroData.asignaciones[currentViajeroIndex]?.viajeroNombre}
                      </span>
                    </div>
                    <div className="mt-2 w-full bg-purple-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${((viajerosCompletados + 1) / totalViajerosOriginal) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <OrdenCompraForm
                  key={isEditMode ? ordenEditando?.id : (initialFormData?.viajero?.id || 'default')}
                  proveedores={proveedoresActivos}
                  productos={productos}
                  onSubmit={isEditMode ? handleUpdateOrden : handleCreateOrden}
                  onCancel={handleCloseOrdenModal}
                  loading={isSubmitting}
                  tcSugerido={initialFormData?.tcSugerido || tcSugerido}
                  initialProductos={initialFormData?.productos}
                  requerimientoId={initialFormData?.requerimientoId}
                  requerimientoNumero={initialFormData?.requerimientoNumero}
                  requerimientoIds={initialFormData?.requerimientoIds}
                  requerimientoNumeros={initialFormData?.requerimientoNumeros}
                  clientesOrigen={initialFormData?.clientesOrigen}
                  productosOrigen={initialFormData?.productosOrigen}
                  initialViajero={initialFormData?.viajero}
                  isEditMode={isEditMode}
                  ordenEditar={ordenEditando ? {
                    id: ordenEditando.id,
                    numeroOrden: ordenEditando.numeroOrden,
                    proveedorId: ordenEditando.proveedorId,
                    nombreProveedor: ordenEditando.nombreProveedor,
                    almacenDestino: ordenEditando.almacenDestino || '',
                    productos: ordenEditando.productos.map(p => ({
                      productoId: p.productoId,
                      sku: p.sku,
                      marca: p.marca,
                      nombreComercial: p.nombreComercial,
                      presentacion: p.presentacion,
                      cantidad: p.cantidad,
                      costoUnitario: p.costoUnitario
                    })),
                    subtotalUSD: ordenEditando.subtotalUSD,
                    impuestoUSD: ordenEditando.impuestoUSD,
                    gastosEnvioUSD: ordenEditando.gastosEnvioUSD,
                    otrosGastosUSD: ordenEditando.otrosGastosUSD,
                    descuentoUSD: ordenEditando.descuentoUSD,
                    totalUSD: ordenEditando.totalUSD,
                    tcCompra: ordenEditando.tcCompra || 0,
                    numeroTracking: ordenEditando.numeroTracking,
                    courier: ordenEditando.courier,
                    observaciones: ordenEditando.observaciones
                  } : undefined}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalles de Orden */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="Detalles de Orden"
        size="xl"
      >
        {selectedOrden && (
          <OrdenCompraCard
            orden={selectedOrden}
            onCambiarEstado={handleCambiarEstado}
            onRegistrarPago={handleRegistrarPago}
            onRecibirOrden={handleRecibirOrden}
            onRevertirRecepciones={handleRevertirRecepciones}
          />
        )}
      </Modal>

      {/* Modal Registrar Pago */}
      {isPagoModalOpen && selectedOrden && (
        <PagoForm
          orden={selectedOrden}
          onSubmit={handleSubmitPago}
          onCancel={() => setIsPagoModalOpen(false)}
          loading={isSubmitting}
        />
      )}

      {/* Modal Recepción Parcial */}
      {isRecepcionModalOpen && selectedOrden && (
        <RecepcionParcialModal
          isOpen={isRecepcionModalOpen}
          onClose={() => setIsRecepcionModalOpen(false)}
          orden={selectedOrden}
          onSubmit={handleSubmitRecepcion}
        />
      )}

      {/* Dialogo de Confirmacion */}
      <ConfirmDialog {...dialogProps} />

      {/* Modal de Acciones con campos */}
      <ActionModal {...actionModalProps} />
    </div>
  );
};