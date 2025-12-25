import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Package, DollarSign, TrendingUp, AlertCircle, Download, ExternalLink } from 'lucide-react';
import { Button, Card, Modal, Input } from '../../components/common';
import { OrdenCompraForm } from '../../components/modules/ordenCompra/OrdenCompraForm';
import { OrdenCompraTable } from '../../components/modules/ordenCompra/OrdenCompraTable';
import { OrdenCompraCard } from '../../components/modules/ordenCompra/OrdenCompraCard';
import { PagoForm } from '../../components/modules/ordenCompra/PagoForm';
import { useOrdenCompraStore } from '../../store/ordenCompraStore';
import { useProveedorStore } from '../../store/proveedorStore';
import { useProductoStore } from '../../store/productoStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { useAuthStore } from '../../store/authStore';
import { exportService } from '../../services/export.service';
import type { OrdenCompra, OrdenCompraFormData, EstadoOrden } from '../../types/ordenCompra.types';

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
  const {
    ordenes,
    stats,
    loading,
    fetchOrdenes,
    createOrden,
    cambiarEstadoOrden,
    registrarPago,
    recibirOrden,
    deleteOrden,
    fetchStats,
    setSelectedOrden
  } = useOrdenCompraStore();

  const [isOrdenModalOpen, setIsOrdenModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isPagoModalOpen, setIsPagoModalOpen] = useState(false);
  const [selectedOrden, setSelectedOrdenLocal] = useState<OrdenCompra | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Datos iniciales para el formulario (cuando viene de un requerimiento)
  const [initialFormData, setInitialFormData] = useState<{
    requerimientoId?: string;
    requerimientoNumero?: string;
    productos?: Array<{
      productoId: string;
      cantidad: number;
      precioUnitarioUSD: number;
    }>;
    tcSugerido?: number;
  } | null>(null);

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

  // Crear orden
  const handleCreateOrden = async (data: OrdenCompraFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Si viene de un requerimiento, incluir el ID para vinculación
      const ordenData = initialFormData?.requerimientoId
        ? { ...data, requerimientoId: initialFormData.requerimientoId }
        : data;

      await createOrden(ordenData, user.uid);
      setIsOrdenModalOpen(false);
      setInitialFormData(null); // Limpiar datos iniciales
    } catch (error: any) {
      console.error('Error al crear orden:', error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cerrar modal y limpiar datos iniciales
  const handleCloseOrdenModal = () => {
    setIsOrdenModalOpen(false);
    setInitialFormData(null);
  };

  // Ver detalles
  const handleViewDetails = (orden: OrdenCompra) => {
    setSelectedOrdenLocal(orden);
    setIsDetailsModalOpen(true);
  };

  // Cambiar estado
  const handleCambiarEstado = async (nuevoEstado: EstadoOrden) => {
    if (!user || !selectedOrden) return;

    // Si cambia a "en_transito", pedir tracking
    if (nuevoEstado === 'en_transito') {
      const numeroTracking = window.prompt('Ingresa el número de tracking (opcional):');
      const courier = window.prompt('Ingresa el courier (opcional):');
      
      try {
        await cambiarEstadoOrden(selectedOrden.id, nuevoEstado, user.uid, { numeroTracking, courier });
        const ordenActualizada = ordenes.find(o => o.id === selectedOrden.id);
        if (ordenActualizada) setSelectedOrdenLocal(ordenActualizada);
      } catch (error: any) {
        alert(error.message);
      }
    }
    // Otros estados
    else {
      try {
        await cambiarEstadoOrden(selectedOrden.id, nuevoEstado, user.uid);
        const ordenActualizada = ordenes.find(o => o.id === selectedOrden.id);
        if (ordenActualizada) setSelectedOrdenLocal(ordenActualizada);
      } catch (error: any) {
        alert(error.message);
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
      const ordenActualizada = ordenes.find(o => o.id === selectedOrden.id);
      if (ordenActualizada) setSelectedOrdenLocal(ordenActualizada);
    } catch (error: any) {
      alert(`❌ Error al registrar pago: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Recibir orden
  const handleRecibirOrden = async () => {
    if (!user || !selectedOrden) return;

    if (!window.confirm(`¿Recibir la orden ${selectedOrden.numeroOrden} y generar inventario automáticamente?`)) {
      return;
    }

    try {
      const resultado = await recibirOrden(selectedOrden.id, user.uid);

      // Mostrar mensaje según si hay reservas o no
      let mensaje = `¡Orden recibida! Se generaron ${resultado.unidadesGeneradas.length} unidades de inventario.`;

      if (resultado.unidadesReservadas.length > 0) {
        mensaje += `\n\n📦 ${resultado.unidadesReservadas.length} unidades RESERVADAS para el cliente`;
        if (resultado.cotizacionVinculada) {
          mensaje += ` (Cotización vinculada)`;
        }
      }
      if (resultado.unidadesDisponibles.length > 0 && resultado.unidadesReservadas.length > 0) {
        mensaje += `\n📦 ${resultado.unidadesDisponibles.length} unidades como STOCK LIBRE`;
      }

      alert(mensaje);

      // Recargar orden
      const ordenActualizada = ordenes.find(o => o.id === selectedOrden.id);
      if (ordenActualizada) setSelectedOrdenLocal(ordenActualizada);
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Eliminar orden
  const handleDelete = async (orden: OrdenCompra) => {
    if (!window.confirm(`¿Eliminar la orden ${orden.numeroOrden}?`)) {
      return;
    }
    
    try {
      await deleteOrden(orden.id);
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Órdenes de Compra</h1>
          <p className="text-gray-600 mt-1">Gestión de compras y proveedores</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={() => exportService.exportOrdenesCompra(ordenes)}
            disabled={ordenes.length === 0}
          >
            <Download className="h-5 w-5 mr-2" />
            Exportar Excel
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsOrdenModalOpen(true)}
            disabled={proveedoresActivos.length === 0}
          >
            <Plus className="h-5 w-5 mr-2" />
            Nueva Orden
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
                  {stats.enviadas + stats.pagadas + stats.enTransito}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {stats.enviadas} env. / {stats.pagadas} pag. / {stats.enTransito} trán.
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

      {/* Tabla de Órdenes */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Órdenes de Compra ({ordenes.length})
          </h3>
        </div>
        <OrdenCompraTable
          ordenes={ordenes}
          onView={handleViewDetails}
          onDelete={handleDelete}
          loading={loading}
        />
      </Card>

      {/* Modal Nueva Orden */}
      <Modal
        isOpen={isOrdenModalOpen}
        onClose={handleCloseOrdenModal}
        title={initialFormData?.requerimientoNumero
          ? `Nueva OC desde ${initialFormData.requerimientoNumero}`
          : "Nueva Orden de Compra"
        }
        size="xl"
      >
        <OrdenCompraForm
          proveedores={proveedoresActivos}
          productos={productos}
          onSubmit={handleCreateOrden}
          onCancel={handleCloseOrdenModal}
          loading={isSubmitting}
          tcSugerido={initialFormData?.tcSugerido || tcSugerido}
          initialProductos={initialFormData?.productos}
          requerimientoId={initialFormData?.requerimientoId}
          requerimientoNumero={initialFormData?.requerimientoNumero}
        />
      </Modal>

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
    </div>
  );
};