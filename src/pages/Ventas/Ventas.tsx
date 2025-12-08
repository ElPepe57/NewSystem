import React, { useEffect, useState } from 'react';
import { Plus, ShoppingCart, DollarSign, TrendingUp, Package, CheckCircle } from 'lucide-react';
import { Button, Card, Modal } from '../../components/common';
import { VentaForm } from '../../components/modules/venta/VentaForm';
import { VentaTable } from '../../components/modules/venta/VentaTable';
import { VentaCard } from '../../components/modules/venta/VentaCard';
import { useVentaStore } from '../../store/ventaStore';
import { useAuthStore } from '../../store/authStore';
import type { Venta, VentaFormData } from '../../../types/venta.types';

export const Ventas: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { 
    ventas,
    productosDisponibles,
    stats,
    loading,
    fetchVentas,
    fetchProductosDisponibles,
    createCotizacion,
    createVenta,
    confirmarCotizacion,
    asignarInventario,
    marcarEnEntrega,
    marcarEntregada,
    cancelarVenta,
    deleteVenta,
    fetchStats
  } = useVentaStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar datos al montar
  useEffect(() => {
    fetchVentas();
    fetchProductosDisponibles();
    fetchStats();
  }, [fetchVentas, fetchProductosDisponibles, fetchStats]);

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
  const handleAsignarInventario = async () => {
    if (!user || !selectedVenta) return;
    
    if (!window.confirm('¿Asignar inventario automáticamente usando FEFO (primero lo que vence)?')) {
      return;
    }
    
    try {
      const resultados = await asignarInventario(selectedVenta.id, user.uid);
      
      // Mostrar resultado
      const mensaje = resultados.map(r => 
        `${r.cantidadAsignada} unidades asignadas para producto`
      ).join('\n');
      
      alert(`✅ Inventario asignado exitosamente!\n\n${mensaje}`);
      
      const ventaActualizada = ventas.find(v => v.id === selectedVenta.id);
      if (ventaActualizada) setSelectedVenta(ventaActualizada);
      
      await fetchProductosDisponibles();
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
    
    if (!window.confirm(`¿Marcar la venta ${selectedVenta.numeroVenta} como entregada?`)) {
      return;
    }
    
    try {
      await marcarEntregada(selectedVenta.id, user.uid);
      alert('✅ Venta marcada como entregada. Las unidades ahora están en estado "entregada".');
      
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
          disabled={productosDisponibles.length === 0}
        >
          <Plus className="h-5 w-5 mr-2" />
          Nueva Venta
        </Button>
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

          {/* KPIs Rentabilidad */}
          {stats.utilidadTotalPEN > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card padding="md">
                <div className="text-sm text-gray-600">Utilidad Total</div>
                <div className="text-2xl font-bold text-success-600 mt-1">
                  S/ {stats.utilidadTotalPEN.toFixed(2)}
                </div>
              </Card>

              <Card padding="md">
                <div className="text-sm text-gray-600">Margen Promedio</div>
                <div className="flex items-center mt-1">
                  <TrendingUp className="h-6 w-6 text-success-500 mr-2" />
                  <span className="text-2xl font-bold text-success-600">
                    {stats.margenPromedio.toFixed(1)}%
                  </span>
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
        </>
      )}

      {/* Tabla de Ventas */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Ventas y Cotizaciones ({ventas.length})
          </h3>
        </div>
        <VentaTable
          ventas={ventas}
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
            onConfirmar={selectedVenta.estado === 'cotizacion' ? handleConfirmar : undefined}
            onAsignarInventario={selectedVenta.estado === 'confirmada' ? handleAsignarInventario : undefined}
            onMarcarEnEntrega={selectedVenta.estado === 'asignada' ? handleMarcarEnEntrega : undefined}
            onMarcarEntregada={selectedVenta.estado === 'en_entrega' ? handleMarcarEntregada : undefined}
            onCancelar={
              selectedVenta.estado !== 'entregada' && selectedVenta.estado !== 'cancelada' 
                ? handleCancelar 
                : undefined
            }
          />
        )}
      </Modal>
    </div>
  );
};