import React, { useEffect, useState } from 'react';
import { Plus, Package, DollarSign, TrendingUp, AlertCircle, Users } from 'lucide-react';
import { Button, Card, Modal, Input } from '../../components/common';
import { ProveedorForm } from '../../components/modules/ordenCompra/ProveedorForm';
import { OrdenCompraForm } from '../../components/modules/ordenCompra/OrdenCompraForm';
import { OrdenCompraTable } from '../../components/modules/ordenCompra/OrdenCompraTable';
import { OrdenCompraCard } from '../../components/modules/ordenCompra/OrdenCompraCard';
import { useOrdenCompraStore } from '../../store/ordenCompraStore';
import { useProductoStore } from '../../store/productoStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { useAuthStore } from '../../store/authStore';
import type { OrdenCompra, OrdenCompraFormData, ProveedorFormData, EstadoOrden } from '../../types/ordenCompra.types';

export const OrdenesCompra: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { productos, fetchProductos } = useProductoStore();
  const { stats: tcStats, fetchStats: fetchTCStats } = useTipoCambioStore();
  const { 
    ordenes,
    proveedores,
    stats,
    loading,
    fetchOrdenes,
    fetchProveedores,
    createProveedor,
    createOrden,
    cambiarEstadoOrden,
    recibirOrden,
    deleteOrden,
    fetchStats,
    setSelectedOrden
  } = useOrdenCompraStore();
  
  const [isProveedorModalOpen, setIsProveedorModalOpen] = useState(false);
  const [isOrdenModalOpen, setIsOrdenModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedOrden, setSelectedOrdenLocal] = useState<OrdenCompra | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar datos al montar
  useEffect(() => {
    fetchOrdenes();
    fetchProveedores();
    fetchProductos();
    fetchStats();
    fetchTCStats();
  }, [fetchOrdenes, fetchProveedores, fetchProductos, fetchStats, fetchTCStats]);

  // Crear proveedor
  const handleCreateProveedor = async (data: ProveedorFormData) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      await createProveedor(data, user.uid);
      setIsProveedorModalOpen(false);
    } catch (error: any) {
      console.error('Error al crear proveedor:', error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Crear orden
  const handleCreateOrden = async (data: OrdenCompraFormData) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      await createOrden(data, user.uid);
      setIsOrdenModalOpen(false);
    } catch (error: any) {
      console.error('Error al crear orden:', error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ver detalles
  const handleViewDetails = (orden: OrdenCompra) => {
    setSelectedOrdenLocal(orden);
    setIsDetailsModalOpen(true);
  };

  // Cambiar estado
  const handleCambiarEstado = async (nuevoEstado: EstadoOrden) => {
    if (!user || !selectedOrden) return;
    
    // Si cambia a "pagada", pedir TC de pago
    if (nuevoEstado === 'pagada') {
      const tcPagoStr = window.prompt('Ingresa el TC de pago:', tcStats?.tcActual?.promedio.toFixed(3) || '');
      if (!tcPagoStr) return;
      
      const tcPago = parseFloat(tcPagoStr);
      if (isNaN(tcPago) || tcPago <= 0) {
        alert('TC de pago inválido');
        return;
      }
      
      try {
        await cambiarEstadoOrden(selectedOrden.id, nuevoEstado, user.uid, { tcPago });
        // Recargar orden actualizada
        const ordenActualizada = ordenes.find(o => o.id === selectedOrden.id);
        if (ordenActualizada) setSelectedOrdenLocal(ordenActualizada);
      } catch (error: any) {
        alert(error.message);
      }
    }
    // Si cambia a "en_transito", pedir tracking
    else if (nuevoEstado === 'en_transito') {
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

  // Recibir orden
  const handleRecibirOrden = async () => {
    if (!user || !selectedOrden) return;
    
    if (!window.confirm(`¿Recibir la orden ${selectedOrden.numeroOrden} y generar inventario automáticamente?`)) {
      return;
    }
    
    try {
      const unidadesGeneradas = await recibirOrden(selectedOrden.id, user.uid);
      alert(`¡Orden recibida! Se generaron ${unidadesGeneradas.length} unidades de inventario.`);
      
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
            variant="ghost"
            onClick={() => setIsProveedorModalOpen(true)}
          >
            <Users className="h-5 w-5 mr-2" />
            Nuevo Proveedor
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsOrdenModalOpen(true)}
            disabled={proveedores.length === 0}
          >
            <Plus className="h-5 w-5 mr-2" />
            Nueva Orden
          </Button>
        </div>
      </div>

      {/* Alerta si no hay proveedores */}
      {proveedores.length === 0 && (
        <Card padding="md">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-warning-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">No hay proveedores registrados</p>
              <p className="text-sm text-gray-600">Crea al menos un proveedor antes de hacer órdenes de compra.</p>
            </div>
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

      {/* Modal Nuevo Proveedor */}
      <Modal
        isOpen={isProveedorModalOpen}
        onClose={() => setIsProveedorModalOpen(false)}
        title="Nuevo Proveedor"
        size="lg"
      >
        <ProveedorForm
          onSubmit={handleCreateProveedor}
          onCancel={() => setIsProveedorModalOpen(false)}
          loading={isSubmitting}
        />
      </Modal>

      {/* Modal Nueva Orden */}
      <Modal
        isOpen={isOrdenModalOpen}
        onClose={() => setIsOrdenModalOpen(false)}
        title="Nueva Orden de Compra"
        size="xl"
      >
        <OrdenCompraForm
          proveedores={proveedores}
          productos={productos}
          onSubmit={handleCreateOrden}
          onCancel={() => setIsOrdenModalOpen(false)}
          loading={isSubmitting}
          tcSugerido={tcStats?.tcActual?.promedio}
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
            onRecibirOrden={handleRecibirOrden}
          />
        )}
      </Modal>
    </div>
  );
};