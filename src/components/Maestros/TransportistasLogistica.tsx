import React, { useEffect, useState, useMemo } from 'react';
import {
  Truck,
  User,
  Phone,
  DollarSign,
  Plus,
  TrendingUp,
  CheckCircle,
  Award,
  Package,
  Search,
  AlertTriangle,
  Star,
  MapPin,
  Clock,
  TrendingDown,
  Activity
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  Modal,
  KPICard,
  KPIGrid,
  SearchInput,
  TabNavigation,
  AlertCard,
  StatDistribution,
  EmptyState,
  Pagination,
  usePagination
} from '../common';
import { TransportistaForm } from '../modules/transportista/TransportistaForm';
import { TransportistaDetailView } from './TransportistaDetailView';
import { useTransportistaStore } from '../../store/transportistaStore';
import { useAuthStore } from '../../store/authStore';
import type { Transportista, TransportistaFormData } from '../../types/transportista.types';

interface TransportistasLogisticaProps {
  onViewTransportista?: (transportista: Transportista) => void;
}

type SubTab = 'lista' | 'dashboard' | 'rendimiento';

const courierLabels: Record<string, string> = {
  olva: 'Olva Courier',
  mercado_envios: 'Mercado Envíos',
  urbano: 'Urbano Express',
  shalom: 'Shalom',
  otro: 'Otro'
};

export const TransportistasLogistica: React.FC<TransportistasLogisticaProps> = ({
  onViewTransportista
}) => {
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

  const [subTab, setSubTab] = useState<SubTab>('dashboard');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingTransportista, setEditingTransportista] = useState<Transportista | null>(null);
  const [transportistaDetalle, setTransportistaDetalle] = useState<Transportista | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'interno' | 'externo'>('todos');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination
  const {
    currentPage,
    pageSize,
    paginatedItems: transportistasPaginados,
    totalPages,
    setPage,
    onPageChange,
    onPageSizeChange
  } = usePagination(transportistas, 12);

  useEffect(() => {
    fetchTransportistas();
    fetchActivos();
    fetchRanking();
  }, [fetchTransportistas, fetchActivos, fetchRanking]);

  // ============================================
  // MÉTRICAS CALCULADAS
  // ============================================

  const metricas = useMemo(() => {
    if (!transportistas.length) return null;

    const totalTransportistas = transportistas.length;
    const activos = transportistas.filter(t => t.estado === 'activo').length;
    const internos = transportistas.filter(t => t.tipo === 'interno' && t.estado === 'activo').length;
    const externos = transportistas.filter(t => t.tipo === 'externo' && t.estado === 'activo').length;

    const totalEntregas = transportistas.reduce((sum, t) => sum + (t.totalEntregas || 0), 0);
    const totalExitosas = transportistas.reduce((sum, t) => sum + (t.entregasExitosas || 0), 0);
    const tasaPuntualidad = totalEntregas > 0 ? (totalExitosas / totalEntregas) * 100 : 0;

    // Calificación promedio ponderada
    const transportistasConCalificacion = transportistas.filter(t => t.calificacionPromedio);
    const calificacionPromedio = transportistasConCalificacion.length > 0
      ? transportistasConCalificacion.reduce((sum, t) => sum + (t.calificacionPromedio || 0), 0) / transportistasConCalificacion.length
      : 0;

    // Distribuciones
    const porEstado = {
      activo: activos,
      inactivo: totalTransportistas - activos
    };

    const porTipo = {
      interno: transportistas.filter(t => t.tipo === 'interno').length,
      externo: transportistas.filter(t => t.tipo === 'externo').length
    };

    // Distribución por servicio (couriers externos)
    const porServicio: Record<string, number> = {};
    transportistas.filter(t => t.tipo === 'externo').forEach(t => {
      const servicio = t.courierExterno || 'otro';
      porServicio[servicio] = (porServicio[servicio] || 0) + 1;
    });

    // Distribución por zona
    const zonasCounts: Record<string, number> = {};
    transportistas.forEach(t => {
      (t.zonasAtendidas || []).forEach(zona => {
        zonasCounts[zona] = (zonasCounts[zona] || 0) + 1;
      });
    });

    // Top 3 transportistas
    const conEntregas = transportistas.filter(t => (t.totalEntregas || 0) > 0);
    const top3 = [...conEntregas]
      .sort((a, b) => (b.tasaExito || 0) - (a.tasaExito || 0))
      .slice(0, 3);

    // Transportistas que necesitan atención (baja calificación o tasa de éxito)
    const necesitanAtencion = conEntregas.filter(t =>
      (t.tasaExito || 0) < 80 || (t.calificacionPromedio || 0) < 3.5
    ).slice(0, 5);

    // Sin entregas recientes (más de 30 días)
    const ahora = new Date();
    const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sinEntregasRecientes = transportistas.filter(t => {
      if (!t.fechaUltimaEntrega) return t.estado === 'activo';
      const ultimaEntrega = t.fechaUltimaEntrega.toDate?.() || new Date(t.fechaUltimaEntrega as unknown as string);
      return ultimaEntrega < hace30Dias && t.estado === 'activo';
    }).slice(0, 5);

    return {
      totalTransportistas,
      activos,
      internos,
      externos,
      totalEntregas,
      totalExitosas,
      tasaPuntualidad,
      calificacionPromedio,
      porEstado,
      porTipo,
      porServicio,
      zonasCounts,
      top3,
      necesitanAtencion,
      sinEntregasRecientes
    };
  }, [transportistas]);

  // ============================================
  // FILTRADO Y BÚSQUEDA
  // ============================================

  const transportistasFiltrados = useMemo(() => {
    let resultado = [...transportistas];

    // Búsqueda
    if (busqueda) {
      const termino = busqueda.toLowerCase();
      resultado = resultado.filter(t =>
        t.nombre.toLowerCase().includes(termino) ||
        t.codigo?.toLowerCase().includes(termino) ||
        t.telefono?.includes(termino)
      );
    }

    // Filtro por tipo
    if (filtroTipo !== 'todos') {
      resultado = resultado.filter(t => t.tipo === filtroTipo);
    }

    return resultado;
  }, [transportistas, busqueda, filtroTipo]);

  // ============================================
  // HANDLERS
  // ============================================

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
    setIsSubmitting(true);
    try {
      await createTransportista(data, user.uid);
      setShowFormModal(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert('Error al crear: ' + message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTransportista = async (data: TransportistaFormData) => {
    if (!user || !editingTransportista) return;
    setIsSubmitting(true);
    try {
      await updateTransportista(editingTransportista.id, data, user.uid);
      setEditingTransportista(null);
      setShowFormModal(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert('Error al actualizar: ' + message);
    } finally {
      setIsSubmitting(false);
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

  // ============================================
  // COMPONENTES INTERNOS
  // ============================================

  const TransportistaCard = ({ transportista }: { transportista: Transportista }) => {
    const tasaExito = transportista.tasaExito || 0;

    return (
      <Card
        padding="md"
        className="hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => setTransportistaDetalle(transportista)}
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
            <div className="text-xs text-gray-500 mb-1">Costo</div>
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

          {transportista.calificacionPromedio && (
            <div className="flex items-center text-sm text-gray-600">
              <Star className="h-4 w-4 mr-2 text-amber-400" />
              {transportista.calificacionPromedio.toFixed(1)} / 5.0
            </div>
          )}
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
        </div>
      </Card>
    );
  };

  const RankingRow = ({ transportista, position }: { transportista: Transportista; position: number }) => {
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

  // ============================================
  // RENDERIZADO DE TABS
  // ============================================

  const renderListaTab = () => (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-4">
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar transportista..."
          className="flex-1 max-w-md"
        />

        <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setFiltroTipo('todos')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filtroTipo === 'todos'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFiltroTipo('interno')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filtroTipo === 'interno'
                ? 'bg-white shadow text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <User className="h-4 w-4 inline mr-1" />
            Internos
          </button>
          <button
            onClick={() => setFiltroTipo('externo')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filtroTipo === 'externo'
                ? 'bg-white shadow text-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Truck className="h-4 w-4 inline mr-1" />
            Externos
          </button>
        </div>
      </div>

      {/* Grid de tarjetas */}
      {transportistasFiltrados.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {transportistasPaginados.map(transportista => (
              <TransportistaCard key={transportista.id} transportista={transportista} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalItems={transportistas.length}
                pageSize={pageSize}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={Search}
          title="No se encontraron transportistas"
          description="Intenta ajustar los filtros de búsqueda"
        />
      )}
    </div>
  );

  const renderDashboardTab = () => {
    if (!metricas) {
      return (
        <EmptyState
          icon={Truck}
          title="No hay datos disponibles"
          description="Crea transportistas para ver el dashboard"
        />
      );
    }

    return (
      <div className="space-y-6">
        {/* KPIs Principales */}
        <KPIGrid columns={5}>
          <KPICard
            title="Total Transportistas"
            value={metricas.totalTransportistas}
            subtitle={`${metricas.activos} activos`}
            icon={Truck}
            variant="info"
            size="sm"
          />
          <KPICard
            title="Activos"
            value={metricas.activos}
            subtitle={`${((metricas.activos / metricas.totalTransportistas) * 100).toFixed(0)}% del total`}
            icon={Activity}
            variant="success"
            size="sm"
          />
          <KPICard
            title="Entregas Realizadas"
            value={metricas.totalEntregas.toLocaleString()}
            subtitle={`${metricas.totalExitosas} exitosas`}
            icon={Package}
            variant="info"
            size="sm"
          />
          <KPICard
            title="Tasa de Puntualidad"
            value={`${metricas.tasaPuntualidad.toFixed(1)}%`}
            subtitle="entregas exitosas"
            icon={CheckCircle}
            variant={metricas.tasaPuntualidad >= 90 ? 'success' : metricas.tasaPuntualidad >= 70 ? 'warning' : 'danger'}
            size="sm"
          />
          <KPICard
            title="Valoración Promedio"
            value={metricas.calificacionPromedio > 0 ? metricas.calificacionPromedio.toFixed(1) : 'N/A'}
            subtitle={metricas.calificacionPromedio > 0 ? '/ 5.0 estrellas' : 'sin calificaciones'}
            icon={Star}
            variant={metricas.calificacionPromedio >= 4 ? 'success' : metricas.calificacionPromedio >= 3 ? 'warning' : 'danger'}
            size="sm"
          />
        </KPIGrid>

        {/* Distribuciones */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatDistribution
            title="Por Estado"
            data={[
              {
                label: 'Activos',
                value: metricas.porEstado.activo,
                color: 'bg-green-500'
              },
              {
                label: 'Inactivos',
                value: metricas.porEstado.inactivo,
                color: 'bg-gray-500'
              }
            ]}
          />

          <StatDistribution
            title="Por Tipo de Servicio"
            data={[
              {
                label: 'Internos',
                value: metricas.porTipo.interno,
                color: 'bg-blue-500'
              },
              {
                label: 'Externos',
                value: metricas.porTipo.externo,
                color: 'bg-purple-500'
              }
            ]}
          />

          <StatDistribution
            title="Couriers Externos"
            data={Object.entries(metricas.porServicio).map(([servicio, cantidad]) => ({
              label: courierLabels[servicio] || servicio,
              value: cantidad,
              color: 'bg-purple-500'
            }))}
          />
        </div>

        {/* Alertas y Destacados */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Top 3 Mejor Rendimiento */}
          <AlertCard
            variant="success"
            title="Mejor Rendimiento"
            icon={Award}
            emptyMessage="No hay datos suficientes"
            items={metricas.top3.map((t) => ({
              id: t.id,
              label: t.nombre,
              value: `${(t.tasaExito || 0).toFixed(0)}%`
            }))}
          />

          {/* Necesitan Atención */}
          <AlertCard
            variant="warning"
            title="Necesitan Atención"
            icon={AlertTriangle}
            emptyMessage="Todos los transportistas están bien"
            items={metricas.necesitanAtencion.map((t) => ({
              id: t.id,
              label: t.nombre,
              value: `${(t.tasaExito || 0).toFixed(0)}%`
            }))}
          />

          {/* Sin Entregas Recientes */}
          <AlertCard
            variant="info"
            title="Sin Entregas Recientes"
            icon={Clock}
            emptyMessage="Todos activos recientemente"
            items={metricas.sinEntregasRecientes.map((t) => ({
              id: t.id,
              label: t.nombre,
              value: '+30 días'
            }))}
          />
        </div>
      </div>
    );
  };

  const renderRendimientoTab = () => {
    const transportistasConEntregas = transportistas.filter(t => (t.totalEntregas || 0) > 0);

    if (transportistasConEntregas.length === 0) {
      return (
        <EmptyState
          icon={TrendingUp}
          title="No hay datos de rendimiento"
          description="Cuando se realicen entregas, podrás ver el análisis de rendimiento aquí"
        />
      );
    }

    return (
      <div className="space-y-6">
        {/* KPIs de Rendimiento */}
        <KPIGrid columns={4}>
          <KPICard
            title="Con Entregas"
            value={transportistasConEntregas.length}
            subtitle={`de ${transportistas.length} total`}
            icon={Package}
            variant="info"
            size="sm"
          />
          <KPICard
            title="Promedio Entregas"
            value={(transportistasConEntregas.reduce((sum, t) => sum + (t.totalEntregas || 0), 0) / transportistasConEntregas.length).toFixed(1)}
            subtitle="por transportista"
            icon={Activity}
            variant="info"
            size="sm"
          />
          <KPICard
            title="Mejor Tasa"
            value={`${Math.max(...transportistasConEntregas.map(t => t.tasaExito || 0)).toFixed(0)}%`}
            subtitle="de éxito"
            icon={TrendingUp}
            variant="success"
            size="sm"
          />
          <KPICard
            title="Requieren Mejora"
            value={transportistasConEntregas.filter(t => (t.tasaExito || 0) < 80).length}
            subtitle="< 80% éxito"
            icon={TrendingDown}
            variant="warning"
            size="sm"
          />
        </KPIGrid>

        {/* Ranking Completo */}
        <Card padding="lg">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Award className="h-5 w-5 mr-2 text-amber-500" />
              Ranking de Rendimiento
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Transportistas ordenados por tasa de éxito en entregas
            </p>
          </div>

          <div className="space-y-3">
            {ranking.map((transportista, index) => (
              <RankingRow
                key={transportista.id}
                transportista={transportista}
                position={index + 1}
              />
            ))}
          </div>
        </Card>

        {/* Análisis Detallado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card padding="lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
              Alto Rendimiento (&gt;90%)
            </h3>
            <div className="space-y-2">
              {transportistasConEntregas
                .filter(t => (t.tasaExito || 0) >= 90)
                .map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{t.nombre}</p>
                      <p className="text-sm text-gray-600">
                        {t.entregasExitosas} / {t.totalEntregas} entregas
                      </p>
                    </div>
                    <Badge variant="success">
                      {(t.tasaExito || 0).toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              {transportistasConEntregas.filter(t => (t.tasaExito || 0) >= 90).length === 0 && (
                <p className="text-sm text-gray-600 text-center py-4">
                  Ningún transportista alcanza este nivel
                </p>
              )}
            </div>
          </Card>

          <Card padding="lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
              Necesitan Mejora (&lt;80%)
            </h3>
            <div className="space-y-2">
              {transportistasConEntregas
                .filter(t => (t.tasaExito || 0) < 80)
                .map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{t.nombre}</p>
                      <p className="text-sm text-gray-600">
                        {t.entregasExitosas} / {t.totalEntregas} entregas
                      </p>
                    </div>
                    <Badge variant="warning">
                      {(t.tasaExito || 0).toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              {transportistasConEntregas.filter(t => (t.tasaExito || 0) < 80).length === 0 && (
                <p className="text-sm text-gray-600 text-center py-4">
                  Todos los transportistas superan este nivel
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // ============================================
  // RENDER PRINCIPAL
  // ============================================

  if (loading && transportistas.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (transportistas.length === 0) {
    return (
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
              Crear por Defecto
            </Button>
            <Button variant="primary" onClick={openCreateModal}>
              <Plus className="h-5 w-5 mr-2" />
              Crear Transportista
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con navegación de tabs */}
      <div className="flex items-center justify-between">
        <TabNavigation
          tabs={[
            { id: 'dashboard', label: 'Dashboard', icon: Activity },
            { id: 'lista', label: 'Lista', icon: Truck },
            { id: 'rendimiento', label: 'Rendimiento', icon: TrendingUp }
          ]}
          activeTab={subTab}
          onTabChange={(tabId) => setSubTab(tabId as SubTab)}
        />

        <Button variant="primary" onClick={openCreateModal}>
          <Plus className="h-5 w-5 mr-2" />
          Nuevo Transportista
        </Button>
      </div>

      {/* Contenido según el tab activo */}
      {subTab === 'dashboard' && renderDashboardTab()}
      {subTab === 'lista' && renderListaTab()}
      {subTab === 'rendimiento' && renderRendimientoTab()}

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
          loading={isSubmitting}
        />
      </Modal>

      {/* Modal de detalle con analytics */}
      {transportistaDetalle && (
        <TransportistaDetailView
          transportista={transportistaDetalle}
          onClose={() => setTransportistaDetalle(null)}
          onEdit={() => {
            setTransportistaDetalle(null);
            openEditModal(transportistaDetalle);
          }}
        />
      )}
    </div>
  );
};
