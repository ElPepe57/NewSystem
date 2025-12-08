import React, { useEffect, useState } from 'react';
import { Plus, TrendingUp, TrendingDown, Calendar, DollarSign, AlertCircle } from 'lucide-react';
import { Button, Card, Modal } from '../../components/common';
import { TipoCambioForm } from '../../components/modules/tipoCambio/TipoCambioForm';
import { TipoCambioTable } from '../../components/modules/tipoCambio/TipoCambioTable';
import { TipoCambioChart } from '../../components/modules/tipoCambio/TipoCambioChart';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { useAuthStore } from '../../store/authStore';
import type { TipoCambio, TipoCambioFormData } from '../../types/tipoCambio.types';

export const TipoCambio: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { 
    tiposCambio, 
    stats, 
    historial, 
    loading, 
    fetchTiposCambio, 
    createTipoCambio, 
    updateTipoCambio, 
    deleteTipoCambio,
    fetchStats,
    fetchHistorial
  } = useTipoCambioStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTC, setEditingTC] = useState<TipoCambio | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar datos al montar
  useEffect(() => {
    fetchTiposCambio();
    fetchStats();
    fetchHistorial(30);
  }, [fetchTiposCambio, fetchStats, fetchHistorial]);

  // Crear o actualizar TC
  const handleSubmit = async (data: TipoCambioFormData) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      if (editingTC) {
        await updateTipoCambio(editingTC.id, data);
      } else {
        await createTipoCambio(data, user.uid);
      }
      setIsModalOpen(false);
      setEditingTC(null);
      
      // Recargar historial después de crear/actualizar
      await fetchHistorial(30);
    } catch (error: any) {
      console.error('Error al guardar tipo de cambio:', error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Editar TC
  const handleEdit = (tc: TipoCambio) => {
    setEditingTC(tc);
    setIsModalOpen(true);
  };

  // Eliminar TC
  const handleDelete = async (tc: TipoCambio) => {
    if (!window.confirm(`¿Eliminar el tipo de cambio del ${tc.fecha.toDate().toLocaleDateString('es-PE')}?`)) {
      return;
    }
    
    try {
      await deleteTipoCambio(tc.id);
      await fetchHistorial(30);
    } catch (error) {
      console.error('Error al eliminar tipo de cambio:', error);
    }
  };

  // Cerrar modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTC(null);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleDateString('es-PE', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tipo de Cambio</h1>
          <p className="text-gray-600 mt-1">Control de tipo de cambio USD → PEN</p>
        </div>
        <Button
          variant="primary"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus className="h-5 w-5 mr-2" />
          Registrar TC
        </Button>
      </div>

      {/* Stats - TC Actual */}
      {stats?.tcActual && (
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-primary-100 rounded-lg">
                <DollarSign className="h-8 w-8 text-primary-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600">Tipo de Cambio Actual</div>
                <div className="text-xs text-gray-500">{formatDate(stats.tcActual.fecha)}</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-8">
              <div className="text-center">
                <div className="text-sm text-gray-600">Compra</div>
                <div className="text-2xl font-bold text-success-600">
                  {stats.tcActual.compra.toFixed(3)}
                </div>
                {stats.variacionCompra !== 0 && (
                  <div className={`flex items-center justify-center text-xs mt-1 ${
                    stats.variacionCompra > 0 ? 'text-success-600' : 'text-danger-600'
                  }`}>
                    {stats.variacionCompra > 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {Math.abs(stats.variacionCompra).toFixed(2)}%
                  </div>
                )}
              </div>
              
              <div className="text-center">
                <div className="text-sm text-gray-600">Venta</div>
                <div className="text-2xl font-bold text-danger-600">
                  {stats.tcActual.venta.toFixed(3)}
                </div>
                {stats.variacionVenta !== 0 && (
                  <div className={`flex items-center justify-center text-xs mt-1 ${
                    stats.variacionVenta > 0 ? 'text-success-600' : 'text-danger-600'
                  }`}>
                    {stats.variacionVenta > 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {Math.abs(stats.variacionVenta).toFixed(2)}%
                  </div>
                )}
              </div>
              
              <div className="text-center">
                <div className="text-sm text-gray-600">Promedio</div>
                <div className="text-2xl font-bold text-primary-600">
                  {stats.tcActual.promedio.toFixed(3)}
                </div>
              </div>
            </div>
          </div>
          
          {stats.tcActual.alertaVariacion && (
            <div className="mt-4 p-3 bg-warning-50 border border-warning-200 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 text-warning-600 mr-2" />
              <span className="text-sm text-warning-800">
                ¡Atención! El tipo de cambio ha variado más del 3% respecto al día anterior.
              </span>
            </div>
          )}
        </Card>
      )}

      {/* KPIs Adicionales */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card padding="md">
            <div className="text-sm text-gray-600">Promedio Semana</div>
            <div className="text-xl font-bold text-gray-900 mt-1">
              {stats.promedioSemana.toFixed(3)}
            </div>
          </Card>
          
          <Card padding="md">
            <div className="text-sm text-gray-600">Promedio Mes</div>
            <div className="text-xl font-bold text-gray-900 mt-1">
              {stats.promedioMes.toFixed(3)}
            </div>
          </Card>
          
          <Card padding="md">
            <div className="text-sm text-gray-600">Mínimo 30 días</div>
            <div className="text-xl font-bold text-success-600 mt-1">
              {stats.minimo30Dias.toFixed(3)}
            </div>
          </Card>
          
          <Card padding="md">
            <div className="text-sm text-gray-600">Máximo 30 días</div>
            <div className="text-xl font-bold text-danger-600 mt-1">
              {stats.maximo30Dias.toFixed(3)}
            </div>
          </Card>
        </div>
      )}

      {/* Gráfico */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Evolución Últimos 30 Días</h3>
        </div>
        <div className="p-6">
          <TipoCambioChart historial={historial} loading={loading} />
        </div>
      </Card>

      {/* Tabla */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Historial de Tipos de Cambio ({tiposCambio.length})
          </h3>
        </div>
        <TipoCambioTable
          tiposCambio={tiposCambio}
          onEdit={handleEdit}
          onDelete={handleDelete}
          loading={loading}
        />
      </Card>

      {/* Modal Crear/Editar */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingTC ? 'Editar Tipo de Cambio' : 'Registrar Tipo de Cambio'}
        size="md"
      >
        <TipoCambioForm
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          loading={isSubmitting}
          initialData={editingTC ? {
            fecha: editingTC.fecha.toDate(),
            compra: editingTC.compra,
            venta: editingTC.venta,
            fuente: editingTC.fuente,
            observaciones: editingTC.observaciones
          } : undefined}
        />
      </Modal>
    </div>
  );
};