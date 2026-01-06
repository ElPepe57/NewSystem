import React, { useEffect, useState } from 'react';
import {
  Truck,
  User,
  Phone,
  DollarSign,
  Plus,
  Download,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  Award,
  Package
} from 'lucide-react';
import { Button, Card, Badge, Modal } from '../../components/common';
import { TransportistaForm } from '../../components/modules/transportista/TransportistaForm';
import { useTransportistaStore } from '../../store/transportistaStore';
import { useAuthStore } from '../../store/authStore';
import type { Transportista, TransportistaFormData } from '../../types/transportista.types';

const courierLabels: Record<string, string> = {
  olva: 'Olva Courier',
  mercado_envios: 'Mercado Envíos',
  urbano: 'Urbano Express',
  shalom: 'Shalom',
  otro: 'Otro'
};

export const Transportistas: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const {
    transportistas,
    transportistasActivos,
    ranking,
    loading,
    fetchTransportistas,
    fetchActivos,
    fetchRanking,
    createTransportista,
    updateTransportista,
    toggleEstado,
    seedDefaultTransportistas
  } = useTransportistaStore();

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingTransportista, setEditingTransportista] = useState<Transportista | null>(null);
  const [activeTab, setActiveTab] = useState<'todos' | 'internos' | 'externos' | 'ranking'>('todos');

  useEffect(() => {
    fetchTransportistas();
    fetchActivos();
    fetchRanking();
  }, [fetchTransportistas, fetchActivos, fetchRanking]);

  const handleSeedTransportistas = async () => {
    if (!user) return;

    if (!confirm('¿Deseas crear los transportistas por defecto?')) {
      return;
    }

    try {
      await seedDefaultTransportistas(user.uid);
      alert('Transportistas creados correctamente');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert('Error: ' + message);
    }
  };

  const handleCreateTransportista = async (data: TransportistaFormData) => {
    if (!user) return;
    try {
      await createTransportista(data, user.uid);
      setShowFormModal(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert('Error al crear: ' + message);
    }
  };

  const handleUpdateTransportista = async (data: TransportistaFormData) => {
    if (!user || !editingTransportista) return;
    try {
      await updateTransportista(editingTransportista.id, data, user.uid);
      setEditingTransportista(null);
      setShowFormModal(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert('Error al actualizar: ' + message);
    }
  };

  const handleToggleEstado = async (transportista: Transportista) => {
    if (!user) return;
    const accion = transportista.estado === 'activo' ? 'desactivar' : 'activar';
    if (!confirm(`¿Deseas ${accion} a ${transportista.nombre}?`)) {
      return;
    }

    try {
      await toggleEstado(transportista.id, user.uid);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert('Error: ' + message);
    }
  };

  const openCreateModal = () => {
    setEditingTransportista(null);
    setShowFormModal(true);
  };

  const openEditModal = (transportista: Transportista) => {
    setEditingTransportista(transportista);
    setShowFormModal(true);
  };

  // Filtrar transportistas según tab
  const getTransportistasFiltrados = () => {
    switch (activeTab) {
      case 'internos':
        return transportistas.filter(t => t.tipo === 'interno');
      case 'externos':
        return transportistas.filter(t => t.tipo === 'externo');
      case 'ranking':
        return ranking;
      default:
        return transportistas;
    }
  };

  // Estadísticas
  const totalActivos = transportistasActivos.length;
  const internos = transportistas.filter(t => t.tipo === 'interno' && t.estado === 'activo').length;
  const externos = transportistas.filter(t => t.tipo === 'externo' && t.estado === 'activo').length;
  const costoPromedioGeneral = transportistas.reduce((sum, t) => sum + (t.costoPromedioPorEntrega || 0), 0) / (transportistas.length || 1);

  // Componente de tarjeta de transportista
  const TransportistaCard = ({ transportista }: { transportista: Transportista }) => {
    const tasaExito = transportista.tasaExito || 0;

    return (
      <Card
        padding="md"
        className="hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => openEditModal(transportista)}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
              transportista.tipo === 'interno'
                ? 'bg-blue-100'
                : 'bg-purple-100'
            }`}>
              {transportista.tipo === 'interno' ? (
                <User className="h-6 w-6 text-blue-600" />
              ) : (
                <Truck className="h-6 w-6 text-purple-600" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{transportista.nombre}</h3>
              <p className="text-sm text-gray-500">{transportista.codigo}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={transportista.estado === 'activo' ? 'success' : 'default'}>
              {transportista.estado === 'activo' ? 'Activo' : 'Inactivo'}
            </Badge>
            <Badge variant={transportista.tipo === 'interno' ? 'info' : 'warning'}>
              {transportista.tipo === 'interno' ? 'Interno' : courierLabels[transportista.courierExterno || 'otro']}
            </Badge>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500 mb-1">Entregas</div>
            <div className="text-lg font-bold text-gray-900">
              {transportista.totalEntregas || 0}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500 mb-1">Éxito</div>
            <div className={`text-lg font-bold ${
              tasaExito >= 90 ? 'text-green-600' :
              tasaExito >= 70 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {tasaExito.toFixed(0)}%
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500 mb-1">Costo Prom.</div>
            <div className="text-lg font-bold text-gray-900">
              S/ {(transportista.costoPromedioPorEntrega || transportista.costoFijo || 0).toFixed(0)}
            </div>
          </div>
        </div>

        {/* Barra de éxito */}
        {transportista.totalEntregas && transportista.totalEntregas > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Tasa de éxito</span>
              <span>{transportista.entregasExitosas || 0} / {transportista.totalEntregas}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  tasaExito >= 90 ? 'bg-green-500' :
                  tasaExito >= 70 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${tasaExito}%` }}
              />
            </div>
          </div>
        )}

        {/* Info adicional */}
        <div className="space-y-2 pt-3 border-t">
          {transportista.telefono && (
            <div className="flex items-center text-sm text-gray-600">
              <Phone className="h-4 w-4 mr-2 text-gray-400" />
              {transportista.telefono}
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            {transportista.costoFijo ? (
              <span className="text-gray-600">
                <DollarSign className="h-4 w-4 inline mr-1 text-gray-400" />
                Costo fijo: S/ {transportista.costoFijo.toFixed(2)}
              </span>
            ) : transportista.comisionPorcentaje ? (
              <span className="text-gray-600">
                Comisión: {transportista.comisionPorcentaje}%
              </span>
            ) : null}

            {transportista.tiempoPromedioEntrega && (
              <span className="text-gray-500">
                <Clock className="h-4 w-4 inline mr-1" />
                {transportista.tiempoPromedioEntrega.toFixed(0)} min prom.
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleEstado(transportista);
            }}
            className={`text-sm font-medium ${
              transportista.estado === 'activo'
                ? 'text-red-600 hover:text-red-700'
                : 'text-green-600 hover:text-green-700'
            }`}
          >
            {transportista.estado === 'activo' ? 'Desactivar' : 'Activar'}
          </button>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
      </Card>
    );
  };

  // Componente de ranking
  const RankingCard = ({ transportista, position }: { transportista: Transportista; position: number }) => {
    const getMedalColor = (pos: number) => {
      if (pos === 1) return 'text-yellow-500';
      if (pos === 2) return 'text-gray-400';
      if (pos === 3) return 'text-amber-600';
      return 'text-gray-300';
    };

    return (
      <div className="flex items-center p-4 bg-white rounded-lg border hover:shadow-md transition-shadow">
        <div className="flex-shrink-0 w-12 text-center">
          {position <= 3 ? (
            <Award className={`h-8 w-8 mx-auto ${getMedalColor(position)}`} />
          ) : (
            <span className="text-2xl font-bold text-gray-400">#{position}</span>
          )}
        </div>

        <div className="flex-1 ml-4">
          <div className="flex items-center">
            <span className="font-semibold text-gray-900">{transportista.nombre}</span>
            <Badge variant={transportista.tipo === 'interno' ? 'info' : 'warning'} size="sm" className="ml-2">
              {transportista.tipo === 'interno' ? 'Interno' : 'Externo'}
            </Badge>
          </div>
          <div className="flex items-center mt-1 text-sm text-gray-500">
            <Package className="h-4 w-4 mr-1" />
            {transportista.totalEntregas} entregas
            <span className="mx-2">·</span>
            <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
            {transportista.entregasExitosas} exitosas
          </div>
        </div>

        <div className="text-right">
          <div className={`text-2xl font-bold ${
            (transportista.tasaExito || 0) >= 90 ? 'text-green-600' :
            (transportista.tasaExito || 0) >= 70 ? 'text-amber-600' : 'text-red-600'
          }`}>
            {(transportista.tasaExito || 0).toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">tasa de éxito</div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transportistas</h1>
          <p className="text-gray-600 mt-1">
            Gestiona repartidores internos y couriers externos
          </p>
        </div>
        <div className="flex space-x-3">
          {transportistas.length === 0 && !loading && (
            <Button variant="secondary" onClick={handleSeedTransportistas}>
              <Download className="h-5 w-5 mr-2" />
              Crear por Defecto
            </Button>
          )}
          <Button variant="primary" onClick={openCreateModal}>
            <Plus className="h-5 w-5 mr-2" />
            Nuevo Transportista
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Transportistas Activos</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {totalActivos}
              </div>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Internos (Lima)</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {internos}
              </div>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Externos (Couriers)</div>
              <div className="text-2xl font-bold text-purple-600 mt-1">
                {externos}
              </div>
            </div>
            <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Truck className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Costo Prom. Entrega</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">
                S/ {costoPromedioGeneral.toFixed(2)}
              </div>
            </div>
            <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('todos')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'todos'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Todos ({transportistas.length})
          </button>
          <button
            onClick={() => setActiveTab('internos')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'internos'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <User className="h-4 w-4 mr-2" />
            Internos ({transportistas.filter(t => t.tipo === 'interno').length})
          </button>
          <button
            onClick={() => setActiveTab('externos')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'externos'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Truck className="h-4 w-4 mr-2" />
            Externos ({transportistas.filter(t => t.tipo === 'externo').length})
          </button>
          <button
            onClick={() => setActiveTab('ranking')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'ranking'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Ranking
          </button>
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : transportistas.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-12">
            <Truck className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay transportistas registrados
            </h3>
            <p className="text-gray-600 mb-6">
              Crea transportistas para gestionar las entregas de tus ventas
            </p>
            <div className="flex justify-center space-x-4">
              <Button variant="secondary" onClick={handleSeedTransportistas}>
                <Download className="h-5 w-5 mr-2" />
                Crear por Defecto
              </Button>
              <Button variant="primary" onClick={openCreateModal}>
                <Plus className="h-5 w-5 mr-2" />
                Crear Transportista
              </Button>
            </div>
          </div>
        </Card>
      ) : activeTab === 'ranking' ? (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Award className="h-5 w-5 mr-2 text-amber-500" />
            Ranking de Transportistas por Éxito
          </h2>
          {ranking.length > 0 ? (
            <div className="space-y-2">
              {ranking.map((t, index) => (
                <RankingCard key={t.id} transportista={t} position={index + 1} />
              ))}
            </div>
          ) : (
            <Card padding="lg">
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">
                  No hay suficientes entregas para generar un ranking
                </p>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {getTransportistasFiltrados().map(transportista => (
            <TransportistaCard key={transportista.id} transportista={transportista} />
          ))}
          {getTransportistasFiltrados().length === 0 && (
            <Card padding="lg" className="col-span-full">
              <div className="text-center py-8">
                <Truck className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">
                  No hay transportistas en esta categoría
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Modal de creación/edición */}
      <Modal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingTransportista(null);
        }}
        title={editingTransportista ? 'Editar Transportista' : 'Nuevo Transportista'}
        size="lg"
      >
        <TransportistaForm
          transportista={editingTransportista || undefined}
          onSubmit={editingTransportista ? handleUpdateTransportista : handleCreateTransportista}
          onCancel={() => {
            setShowFormModal(false);
            setEditingTransportista(null);
          }}
          loading={loading}
        />
      </Modal>
    </div>
  );
};
