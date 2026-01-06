import React, { useEffect, useState } from 'react';
import {
  Tag,
  Plus,
  Edit2,
  Search,
  Percent,
  Truck,
  CheckCircle,
  XCircle,
  Store,
  ShoppingBag,
  MessageCircle,
  Globe,
  MoreHorizontal,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { Button, Card, Badge, Modal, KPICard, KPIGrid, SearchInput } from '../common';
import { CanalVentaForm } from '../modules/canalVenta/CanalVentaForm';
import { useCanalVentaStore } from '../../store/canalVentaStore';
import { useAuthStore } from '../../store/authStore';
import type { CanalVenta, CanalVentaFormData } from '../../types/canalVenta.types';

interface CanalesVentaGestorProps {
  onViewCanal?: (canal: CanalVenta) => void;
}

// Mapeo de nombres de icono a componentes
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Store: Store,
  ShoppingBag: ShoppingBag,
  MessageCircle: MessageCircle,
  Globe: Globe,
  Tag: Tag,
  MoreHorizontal: MoreHorizontal
};

export const CanalesVentaGestor: React.FC<CanalesVentaGestorProps> = ({
  onViewCanal
}) => {
  const user = useAuthStore(state => state.user);
  const {
    canales,
    loading,
    initialized,
    fetchCanales,
    createCanal,
    updateCanal,
    cambiarEstado,
    inicializarCanalesSistema
  } = useCanalVentaStore();

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCanal, setEditingCanal] = useState<CanalVenta | null>(null);
  const [activeTab, setActiveTab] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCanales();
  }, [fetchCanales]);

  // Inicializar canales del sistema si no hay ninguno
  useEffect(() => {
    if (initialized && canales.length === 0 && user) {
      inicializarCanalesSistema(user.uid);
    }
  }, [initialized, canales.length, user, inicializarCanalesSistema]);

  const handleCreateCanal = async (data: CanalVentaFormData) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await createCanal(data, user.uid);
      setShowFormModal(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert('Error al crear: ' + message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCanal = async (data: CanalVentaFormData) => {
    if (!user || !editingCanal) return;
    setIsSubmitting(true);
    try {
      await updateCanal(editingCanal.id, data, user.uid);
      setEditingCanal(null);
      setShowFormModal(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert('Error al actualizar: ' + message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleEstado = async (canal: CanalVenta) => {
    if (!user) return;

    if (canal.esSistema && canal.estado === 'activo') {
      alert('No se puede desactivar un canal del sistema');
      return;
    }

    const nuevoEstado = canal.estado === 'activo' ? 'inactivo' : 'activo';
    const accion = nuevoEstado === 'activo' ? 'activar' : 'desactivar';

    if (!confirm(`¿Deseas ${accion} el canal "${canal.nombre}"?`)) {
      return;
    }

    try {
      await cambiarEstado(canal.id, nuevoEstado, user.uid);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert('Error: ' + message);
    }
  };

  const openCreateModal = () => {
    setEditingCanal(null);
    setShowFormModal(true);
  };

  const openEditModal = (canal: CanalVenta) => {
    setEditingCanal(canal);
    setShowFormModal(true);
  };

  // Filtrar por búsqueda
  const canalesFiltrados = canales.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Filtrar por tab
  const getCanalesFiltrados = () => {
    switch (activeTab) {
      case 'activos':
        return canalesFiltrados.filter(c => c.estado === 'activo');
      case 'inactivos':
        return canalesFiltrados.filter(c => c.estado === 'inactivo');
      default:
        return canalesFiltrados;
    }
  };

  // Stats
  const totalCanales = canales.length;
  const canalesActivos = canales.filter(c => c.estado === 'activo').length;
  const canalesConComision = canales.filter(c => (c.comisionPorcentaje || 0) > 0).length;
  const comisionPromedio = canales.length > 0
    ? canales.reduce((sum, c) => sum + (c.comisionPorcentaje || 0), 0) / canales.length
    : 0;

  const canalesVisibles = getCanalesFiltrados();

  // Renderizar icono del canal
  const renderIcon = (iconName?: string, color?: string) => {
    const IconComponent = iconMap[iconName || 'Tag'] || Tag;
    return (
      <span style={{ color: color || '#6b7280' }}>
        <IconComponent className="h-5 w-5" />
      </span>
    );
  };

  if (loading && canales.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <KPIGrid columns={4}>
        <KPICard
          title="Total Canales"
          value={totalCanales}
          icon={Tag}
          variant="info"
        />
        <KPICard
          title="Canales Activos"
          value={canalesActivos}
          icon={CheckCircle}
          variant="success"
        />
        <KPICard
          title="Con Comisión"
          value={canalesConComision}
          icon={Percent}
          variant="warning"
        />
        <KPICard
          title="Comisión Promedio"
          value={`${comisionPromedio.toFixed(1)}%`}
          icon={DollarSign}
          variant="default"
        />
      </KPIGrid>

      {/* Barra de acciones */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'todos' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab('todos')}
          >
            Todos ({canalesFiltrados.length})
          </Button>
          <Button
            variant={activeTab === 'activos' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab('activos')}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Activos ({canalesFiltrados.filter(c => c.estado === 'activo').length})
          </Button>
          <Button
            variant={activeTab === 'inactivos' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab('inactivos')}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Inactivos ({canalesFiltrados.filter(c => c.estado === 'inactivo').length})
          </Button>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <SearchInput
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar canal..."
            className="flex-1 sm:w-64"
          />
          <Button variant="primary" onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Canal
          </Button>
        </div>
      </div>

      {/* Lista de canales */}
      {canalesVisibles.length === 0 ? (
        <Card className="p-8 text-center">
          <Tag className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {busqueda ? 'Sin resultados' : 'No hay canales de venta'}
          </h3>
          <p className="text-gray-500 mb-4">
            {busqueda
              ? 'No se encontraron canales con ese criterio de búsqueda'
              : 'Crea tu primer canal de venta para comenzar'
            }
          </p>
          {!busqueda && (
            <Button variant="primary" onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Canal
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {canalesVisibles.map((canal) => (
            <Card
              key={canal.id}
              className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${
                canal.estado === 'inactivo' ? 'opacity-60' : ''
              }`}
              onClick={() => onViewCanal?.(canal)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${canal.color}20` }}
                  >
                    {renderIcon(canal.icono, canal.color)}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{canal.nombre}</h4>
                    <p className="text-xs text-gray-500">{canal.codigo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canal.esSistema && (
                    <Badge variant="info" size="sm">Sistema</Badge>
                  )}
                  <Badge
                    variant={canal.estado === 'activo' ? 'success' : 'warning'}
                    size="sm"
                  >
                    {canal.estado === 'activo' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>

              {canal.descripcion && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {canal.descripcion}
                </p>
              )}

              <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                {(canal.comisionPorcentaje || 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <Percent className="h-4 w-4" />
                    <span>{canal.comisionPorcentaje}% comisión</span>
                  </div>
                )}
                {canal.requiereEnvio && (
                  <div className="flex items-center gap-1">
                    <Truck className="h-4 w-4" />
                    <span>Con envío</span>
                  </div>
                )}
              </div>

              {/* Vista previa del badge */}
              <div className="mb-3">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${canal.color}20`,
                    color: canal.color
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: canal.color }}
                  />
                  {canal.nombre}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(canal);
                  }}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                {!canal.esSistema && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleEstado(canal);
                    }}
                  >
                    {canal.estado === 'activo' ? (
                      <>
                        <XCircle className="h-4 w-4 mr-1" />
                        Desactivar
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Activar
                      </>
                    )}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de formulario */}
      <Modal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingCanal(null);
        }}
        title={editingCanal ? 'Editar Canal de Venta' : 'Nuevo Canal de Venta'}
        size="lg"
      >
        <CanalVentaForm
          canal={editingCanal || undefined}
          onSubmit={editingCanal ? handleUpdateCanal : handleCreateCanal}
          onCancel={() => {
            setShowFormModal(false);
            setEditingCanal(null);
          }}
          loading={isSubmitting}
        />
      </Modal>
    </div>
  );
};
