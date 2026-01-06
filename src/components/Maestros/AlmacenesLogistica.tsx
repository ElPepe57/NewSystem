import React, { useEffect, useState, useMemo } from 'react';
import {
  Warehouse,
  MapPin,
  TrendingUp,
  AlertTriangle,
  Package,
  DollarSign,
  Clock,
  Phone,
  Mail,
  Edit2,
  Eye,
  Filter,
  Search,
  Plane,
  Activity,
  Award,
  ChevronRight,
  Users,
  Calendar,
  BarChart3,
  PieChart,
  Target,
  Zap,
  Building2,
  Globe,
  Star,
  TrendingDown,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  KPICard,
  KPIGrid,
  AlertCard,
  TabNavigation,
  Pagination,
  usePagination
} from '../common';
import { AlmacenDetailView } from './AlmacenDetailView';
import { useAlmacenStore } from '../../store/almacenStore';
import type { Almacen, PaisAlmacen, TipoAlmacen, EstadoAlmacen } from '../../types/almacen.types';

// Sub-tabs del módulo
type SubTab = 'lista' | 'dashboard' | 'evaluacion';

interface AlmacenesLogisticaProps {
  onOpenAlmacenModal: (almacen?: Almacen) => void;
  onViewAlmacen: (almacen: Almacen) => void;
  onEditAlmacen: (almacen: Almacen) => void;
}

export const AlmacenesLogistica: React.FC<AlmacenesLogisticaProps> = ({
  onOpenAlmacenModal,
  onViewAlmacen,
  onEditAlmacen
}) => {
  const [subTab, setSubTab] = useState<SubTab>('lista');
  const [busqueda, setBusqueda] = useState('');
  const [filtroPais, setFiltroPais] = useState<PaisAlmacen | 'todos'>('todos');
  const [filtroTipo, setFiltroTipo] = useState<TipoAlmacen | 'todos'>('todos');
  const [filtroEstado, setFiltroEstado] = useState<EstadoAlmacen | 'todos'>('todos');
  const [almacenDetalle, setAlmacenDetalle] = useState<Almacen | null>(null);

  const {
    almacenes,
    stats,
    loading,
    fetchAlmacenes,
    fetchStats
  } = useAlmacenStore();

  // Cargar datos
  useEffect(() => {
    if (almacenes.length === 0) {
      fetchAlmacenes();
    }
    if (!stats) {
      fetchStats();
    }
  }, []);

  // Filtrado de almacenes
  const almacenesFiltrados = useMemo(() => {
    let resultado = [...almacenes];

    // Filtro por búsqueda
    if (busqueda) {
      const termino = busqueda.toLowerCase();
      resultado = resultado.filter(a =>
        a.nombre.toLowerCase().includes(termino) ||
        a.codigo.toLowerCase().includes(termino) ||
        a.ciudad?.toLowerCase().includes(termino) ||
        a.email?.toLowerCase().includes(termino)
      );
    }

    // Filtro por país
    if (filtroPais !== 'todos') {
      resultado = resultado.filter(a => a.pais === filtroPais);
    }

    // Filtro por tipo
    if (filtroTipo !== 'todos') {
      resultado = resultado.filter(a => a.tipo === filtroTipo);
    }

    // Filtro por estado
    if (filtroEstado !== 'todos') {
      resultado = resultado.filter(a => a.estadoAlmacen === filtroEstado);
    }

    return resultado;
  }, [almacenes, busqueda, filtroPais, filtroTipo, filtroEstado]);

  // Paginación
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    setPage,
    setItemsPerPage,
    paginatedItems: almacenesPaginados
  } = usePagination({
    items: almacenesFiltrados,
    initialItemsPerPage: 25
  });

  // Helpers de UI
  const getPaisColor = (pais: PaisAlmacen) => {
    return pais === 'USA'
      ? 'bg-blue-100 text-blue-700 border-blue-300'
      : 'bg-amber-100 text-amber-700 border-amber-300';
  };

  const getTipoColor = (tipo: TipoAlmacen) => {
    return tipo === 'viajero'
      ? 'bg-purple-100 text-purple-700 border-purple-300'
      : 'bg-indigo-100 text-indigo-700 border-indigo-300';
  };

  const getEstadoColor = (estado: EstadoAlmacen): 'success' | 'default' | 'danger' => {
    switch (estado) {
      case 'activo': return 'success';
      case 'inactivo': return 'default';
      case 'suspendido': return 'danger';
    }
  };

  const getCapacidadColor = (porcentaje: number) => {
    if (porcentaje >= 80) return 'bg-red-500';
    if (porcentaje >= 60) return 'bg-amber-500';
    if (porcentaje >= 40) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getClasificacionColor = (clasificacion?: string) => {
    switch (clasificacion) {
      case 'excelente': return 'bg-green-100 text-green-800 border-green-300';
      case 'bueno': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'regular': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'deficiente': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const calcularCapacidadUsada = (almacen: Almacen) => {
    if (!almacen.capacidadUnidades || almacen.capacidadUnidades === 0) return 0;
    return ((almacen.unidadesActuales || 0) / almacen.capacidadUnidades) * 100;
  };

  const formatFechaViaje = (fecha?: any) => {
    if (!fecha) return 'No definido';
    const fechaObj = fecha.toDate?.() || new Date(fecha);
    const diasRestantes = Math.ceil((fechaObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return `${fechaObj.toLocaleDateString('es-PE')} (${diasRestantes}d)`;
  };

  // Métricas calculadas para dashboard
  const metricas = useMemo(() => {
    if (!almacenes.length) return null;

    const activos = almacenes.filter(a => a.estadoAlmacen === 'activo');
    const almacenesUSA = almacenes.filter(a => a.pais === 'USA');
    const almacenesPeru = almacenes.filter(a => a.pais === 'Peru');
    const viajeros = almacenes.filter(a => a.esViajero);
    const viajerosActivos = viajeros.filter(a => a.estadoAlmacen === 'activo');

    const totalUnidadesUSA = almacenesUSA.reduce((sum, a) => sum + (a.unidadesActuales || 0), 0);
    const totalValorUSD = almacenes.reduce((sum, a) => sum + (a.valorInventarioUSD || 0), 0);

    // Distribución por país
    const porPais = {
      USA: almacenesUSA.length,
      Peru: almacenesPeru.length
    };

    // Distribución por tipo
    const porTipo = {
      viajero: viajeros.length,
      almacen_peru: almacenes.filter(a => a.tipo === 'almacen_peru').length
    };

    // Distribución por estado
    const porEstado = {
      activo: activos.length,
      inactivo: almacenes.filter(a => a.estadoAlmacen === 'inactivo').length,
      suspendido: almacenes.filter(a => a.estadoAlmacen === 'suspendido').length
    };

    // Capacidad usada
    const conCapacidad = almacenes.filter(a => a.capacidadUnidades && a.capacidadUnidades > 0);
    const capacidadUsada = {
      low: conCapacidad.filter(a => calcularCapacidadUsada(a) < 40).length,
      medium: conCapacidad.filter(a => {
        const cap = calcularCapacidadUsada(a);
        return cap >= 40 && cap < 80;
      }).length,
      high: conCapacidad.filter(a => calcularCapacidadUsada(a) >= 80).length
    };

    // Alertas
    const capacidadCritica = almacenes.filter(a => calcularCapacidadUsada(a) >= 80);

    const ahora = new Date();
    const en7Dias = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
    const proximosViajes = viajeros.filter(v => {
      if (!v.proximoViaje) return false;
      const fechaViaje = v.proximoViaje.toDate?.() || new Date(v.proximoViaje as unknown as string);
      return fechaViaje >= ahora && fechaViaje <= en7Dias;
    });

    const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sinMovimiento = almacenes.filter(a => {
      // Sin movimiento = totalUnidadesEnviadas + totalUnidadesRecibidas === 0 en últimos 30 días
      // Como no tenemos fecha de última transferencia, usamos una aproximación
      return (a.unidadesActuales || 0) > 0 &&
             (a.totalUnidadesEnviadas || 0) === 0 &&
             (a.totalUnidadesRecibidas || 0) === 0;
    });

    return {
      totalAlmacenes: almacenes.length,
      activos: activos.length,
      almacenesUSA: almacenesUSA.length,
      almacenesPeru: almacenesPeru.length,
      viajeros: viajeros.length,
      viajerosActivos: viajerosActivos.length,
      totalUnidadesUSA,
      totalValorUSD,
      porPais,
      porTipo,
      porEstado,
      capacidadUsada,
      capacidadCritica,
      proximosViajes,
      sinMovimiento
    };
  }, [almacenes]);

  // Datos para evaluación
  const datosEvaluacion = useMemo(() => {
    const conEvaluacion = almacenes.filter(a => a.evaluacion);

    // Ordenar por puntuación
    const ranking = [...conEvaluacion].sort(
      (a, b) => (b.evaluacion?.puntuacion || 0) - (a.evaluacion?.puntuacion || 0)
    );

    // Clasificación
    const porClasificacion = {
      excelente: conEvaluacion.filter(a => a.evaluacion?.clasificacion === 'excelente').length,
      bueno: conEvaluacion.filter(a => a.evaluacion?.clasificacion === 'bueno').length,
      regular: conEvaluacion.filter(a => a.evaluacion?.clasificacion === 'regular').length,
      deficiente: conEvaluacion.filter(a => a.evaluacion?.clasificacion === 'deficiente').length
    };

    const topPerformers = ranking.slice(0, 5);
    const needingAttention = conEvaluacion
      .filter(a => (a.evaluacion?.puntuacion || 0) < 60)
      .sort((a, b) => (a.evaluacion?.puntuacion || 0) - (b.evaluacion?.puntuacion || 0))
      .slice(0, 5);

    return {
      conEvaluacion: conEvaluacion.length,
      ranking,
      porClasificacion,
      topPerformers,
      needingAttention
    };
  }, [almacenes]);

  // Sub-tabs
  const subTabs = [
    { id: 'lista', label: 'Lista', icon: Warehouse, count: almacenes.length },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'evaluacion', label: 'Evaluación', icon: Award, count: datosEvaluacion.conEvaluacion }
  ];

  return (
    <div className="space-y-4">
      {/* Sub-navegación */}
      <div className="flex items-center justify-between">
        <TabNavigation
          tabs={subTabs}
          activeTab={subTab}
          onTabChange={(id) => setSubTab(id as SubTab)}
          variant="pills"
        />
        <Button variant="primary" size="sm" onClick={() => onOpenAlmacenModal()}>
          <Warehouse className="h-4 w-4 mr-1" />
          Nuevo Almacén
        </Button>
      </div>

      {/* ============ SUB-TAB: DASHBOARD ============ */}
      {subTab === 'dashboard' && metricas && (
        <div className="space-y-6">
          {/* KPIs principales */}
          <KPIGrid columns={5}>
            <KPICard
              title="Total Almacenes"
              value={metricas.totalAlmacenes}
              subtitle={`${metricas.activos} activos`}
              icon={Warehouse}
              variant="info"
              size="sm"
            />
            <KPICard
              title="USA / Peru"
              value={`${metricas.almacenesUSA} / ${metricas.almacenesPeru}`}
              subtitle="distribución"
              icon={Globe}
              variant="default"
              size="sm"
            />
            <KPICard
              title="Viajeros Activos"
              value={metricas.viajerosActivos}
              subtitle={`de ${metricas.viajeros} total`}
              icon={Plane}
              variant="success"
              size="sm"
            />
            <KPICard
              title="Unidades en USA"
              value={metricas.totalUnidadesUSA}
              icon={Package}
              variant="info"
              size="sm"
            />
            <KPICard
              title="Valor Inventario"
              value={`$${metricas.totalValorUSD.toLocaleString()}`}
              subtitle="USD total"
              icon={DollarSign}
              variant="success"
              size="sm"
            />
          </KPIGrid>

          {/* Distribution Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Por País */}
            <Card padding="lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Globe className="h-5 w-5 text-indigo-600" />
                Por País
              </h3>
              <div className="space-y-4">
                {Object.entries(metricas.porPais).map(([pais, cantidad]) => {
                  const porcentaje = (cantidad / metricas.totalAlmacenes) * 100;
                  return (
                    <div key={pais} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded border ${getPaisColor(pais as PaisAlmacen)}`}>
                          {pais}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {cantidad} ({porcentaje.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pais === 'USA' ? 'bg-blue-500' : 'bg-amber-500'}`}
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Por Tipo */}
            <Card padding="lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                Por Tipo
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded border ${getTipoColor('viajero')}`}>
                      Viajero
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {metricas.porTipo.viajero}
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-500"
                      style={{ width: `${(metricas.porTipo.viajero / metricas.totalAlmacenes) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded border ${getTipoColor('almacen_peru')}`}>
                      Almacén
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {metricas.porTipo.almacen_peru}
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${(metricas.porTipo.almacen_peru / metricas.totalAlmacenes) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Por Estado */}
            <Card padding="lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-600" />
                Por Estado
              </h3>
              <div className="space-y-3">
                {Object.entries(metricas.porEstado).map(([estado, cantidad]) => (
                  <div key={estado} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {estado === 'activo' && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {estado === 'inactivo' && <XCircle className="h-4 w-4 text-gray-400" />}
                      {estado === 'suspendido' && <AlertCircle className="h-4 w-4 text-red-600" />}
                      <span className="text-sm capitalize">{estado}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {cantidad}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Capacidad Usada */}
            <Card padding="lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-indigo-600" />
                Capacidad
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                    <span className="text-sm">Baja (&lt;40%)</span>
                  </div>
                  <span className="text-sm font-medium">{metricas.capacidadUsada.low}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                    <span className="text-sm">Media (40-80%)</span>
                  </div>
                  <span className="text-sm font-medium">{metricas.capacidadUsada.medium}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                    <span className="text-sm">Alta (&gt;80%)</span>
                  </div>
                  <span className="text-sm font-medium">{metricas.capacidadUsada.high}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* AlertCards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <AlertCard
              title="Capacidad Crítica"
              icon={AlertTriangle}
              variant="warning"
              emptyMessage="Sin alertas de capacidad"
              items={metricas.capacidadCritica.map(a => ({
                id: a.id,
                label: a.nombre,
                value: `${calcularCapacidadUsada(a).toFixed(0)}%`,
                sublabel: `${a.unidadesActuales || 0} / ${a.capacidadUnidades || 0} unidades`
              }))}
              maxItems={5}
              onItemClick={(id) => {
                const almacen = almacenes.find(a => a.id === id);
                if (almacen) setAlmacenDetalle(almacen);
              }}
            />

            <AlertCard
              title="Próximos Viajes"
              icon={Plane}
              variant="info"
              emptyMessage="Sin viajes programados en 7 días"
              items={metricas.proximosViajes.map(v => {
                const fechaViaje = v.proximoViaje?.toDate?.() || new Date(v.proximoViaje as unknown as string);
                const diasRestantes = Math.ceil((fechaViaje.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return {
                  id: v.id,
                  label: v.nombre,
                  value: `${diasRestantes} días`,
                  sublabel: fechaViaje.toLocaleDateString('es-PE')
                };
              })}
              maxItems={5}
              onItemClick={(id) => {
                const almacen = almacenes.find(a => a.id === id);
                if (almacen) setAlmacenDetalle(almacen);
              }}
            />

            <AlertCard
              title="Sin Movimiento"
              icon={Clock}
              variant="warning"
              emptyMessage="Todos los almacenes activos"
              items={metricas.sinMovimiento.map(a => ({
                id: a.id,
                label: a.nombre,
                value: `${a.unidadesActuales || 0} unidades`,
                sublabel: 'Sin transferencias'
              }))}
              maxItems={5}
              onItemClick={(id) => {
                const almacen = almacenes.find(a => a.id === id);
                if (almacen) setAlmacenDetalle(almacen);
              }}
            />
          </div>

          {/* Tabla de inventario por almacén */}
          <Card padding="lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PieChart className="h-5 w-5 text-indigo-600" />
              Distribución de Inventario
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Almacén</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">País</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unidades</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor USD</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacidad</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {almacenes
                    .filter(a => (a.unidadesActuales || 0) > 0)
                    .sort((a, b) => (b.valorInventarioUSD || 0) - (a.valorInventarioUSD || 0))
                    .map(almacen => {
                      const capacidadUsada = calcularCapacidadUsada(almacen);
                      return (
                        <tr key={almacen.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {almacen.esViajero ? (
                                <Plane className="h-4 w-4 text-purple-600" />
                              ) : (
                                <Warehouse className="h-4 w-4 text-indigo-600" />
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900">{almacen.nombre}</div>
                                <div className="text-xs text-gray-500">{almacen.codigo}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded border ${getPaisColor(almacen.pais)}`}>
                              {almacen.pais}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded border ${getTipoColor(almacen.tipo)}`}>
                              {almacen.tipo === 'viajero' ? 'Viajero' : 'Almacén'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                            {almacen.unidadesActuales || 0}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-green-600">
                            ${(almacen.valorInventarioUSD || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {almacen.capacidadUnidades ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden w-24">
                                  <div
                                    className={`h-full rounded-full transition-all ${getCapacidadColor(capacidadUsada)}`}
                                    style={{ width: `${Math.min(capacidadUsada, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-600 w-10 text-right">
                                  {capacidadUsada.toFixed(0)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ============ SUB-TAB: EVALUACION ============ */}
      {subTab === 'evaluacion' && (
        <div className="space-y-6">
          {/* KPIs de evaluación */}
          <KPIGrid columns={4}>
            <KPICard
              title="Con Evaluación"
              value={datosEvaluacion.conEvaluacion}
              subtitle={`de ${almacenes.length} total`}
              icon={Award}
              variant="info"
              size="sm"
            />
            <KPICard
              title="Excelentes"
              value={datosEvaluacion.porClasificacion.excelente}
              subtitle="≥80 puntos"
              icon={Star}
              variant="success"
              size="sm"
            />
            <KPICard
              title="Buenos"
              value={datosEvaluacion.porClasificacion.bueno}
              subtitle="60-79 puntos"
              icon={TrendingUp}
              variant="info"
              size="sm"
            />
            <KPICard
              title="Requieren Atención"
              value={datosEvaluacion.porClasificacion.regular + datosEvaluacion.porClasificacion.deficiente}
              subtitle="<60 puntos"
              icon={AlertTriangle}
              variant={datosEvaluacion.porClasificacion.deficiente > 0 ? 'danger' : 'warning'}
              size="sm"
            />
          </KPIGrid>

          {/* Distribución por clasificación */}
          <Card padding="lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PieChart className="h-5 w-5 text-indigo-600" />
              Clasificación por Desempeño
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(datosEvaluacion.porClasificacion).map(([clasificacion, cantidad]) => {
                const porcentaje = datosEvaluacion.conEvaluacion > 0
                  ? (cantidad / datosEvaluacion.conEvaluacion) * 100
                  : 0;
                return (
                  <div key={clasificacion} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded border capitalize ${getClasificacionColor(clasificacion)}`}>
                        {clasificacion}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {cantidad}
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          clasificacion === 'excelente' ? 'bg-green-500' :
                          clasificacion === 'bueno' ? 'bg-blue-500' :
                          clasificacion === 'regular' ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 text-right">
                      {porcentaje.toFixed(1)}%
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Ranking y alertas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top performers */}
            <Card padding="lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Top Performers
              </h3>
              {datosEvaluacion.topPerformers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Sin evaluaciones aún</p>
              ) : (
                <div className="space-y-3">
                  {datosEvaluacion.topPerformers.map((almacen, idx) => (
                    <div
                      key={almacen.id}
                      className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100 hover:bg-green-100 cursor-pointer transition-colors"
                      onClick={() => setAlmacenDetalle(almacen)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold ${
                          idx === 0 ? 'bg-yellow-500' :
                          idx === 1 ? 'bg-gray-400' :
                          idx === 2 ? 'bg-amber-600' : 'bg-green-500'
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{almacen.nombre}</p>
                          <p className="text-sm text-gray-500">{almacen.codigo}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-700">
                          {almacen.evaluacion?.puntuacion.toFixed(1)} pts
                        </p>
                        <p className={`text-xs px-2 py-0.5 rounded border capitalize ${getClasificacionColor(almacen.evaluacion?.clasificacion)}`}>
                          {almacen.evaluacion?.clasificacion}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Needing attention */}
            <Card padding="lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Requieren Atención
              </h3>
              {datosEvaluacion.needingAttention.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Todos tienen buen desempeño</p>
              ) : (
                <div className="space-y-3">
                  {datosEvaluacion.needingAttention.map((almacen) => (
                    <div
                      key={almacen.id}
                      className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 cursor-pointer transition-colors"
                      onClick={() => setAlmacenDetalle(almacen)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                          <TrendingDown className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{almacen.nombre}</p>
                          <p className="text-sm text-gray-500">{almacen.codigo}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-700">
                          {almacen.evaluacion?.puntuacion.toFixed(1)} pts
                        </p>
                        <p className={`text-xs px-2 py-0.5 rounded border capitalize ${getClasificacionColor(almacen.evaluacion?.clasificacion)}`}>
                          {almacen.evaluacion?.clasificacion}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Ranking completo */}
          <Card padding="lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              Ranking Completo
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Almacén/Viajero</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Puntuación</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Clasificación</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Conservación</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">T. Respuesta</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cumplimiento</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Comunicación</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {datosEvaluacion.ranking.map((almacen, idx) => (
                    <tr key={almacen.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setAlmacenDetalle(almacen)}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {almacen.esViajero ? (
                            <Plane className="h-4 w-4 text-purple-600" />
                          ) : (
                            <Warehouse className="h-4 w-4 text-indigo-600" />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{almacen.nombre}</div>
                            <div className="text-xs text-gray-500">{almacen.codigo}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className="text-sm font-bold text-gray-900">
                          {almacen.evaluacion?.puntuacion.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded border capitalize ${getClasificacionColor(almacen.evaluacion?.clasificacion)}`}>
                          {almacen.evaluacion?.clasificacion}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-600">
                        {almacen.evaluacion?.factores.conservacionProductos.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-600">
                        {almacen.evaluacion?.factores.tiempoRespuesta.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-600">
                        {almacen.evaluacion?.factores.cumplimientoFechas.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-600">
                        {almacen.evaluacion?.factores.comunicacion.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {datosEvaluacion.ranking.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No hay almacenes con evaluación aún
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ============ SUB-TAB: LISTA ============ */}
      {subTab === 'lista' && (
        <div className="space-y-4">
          {/* KPIs rápidos */}
          {stats && (
            <KPIGrid columns={4}>
              <KPICard
                title="Total Almacenes"
                value={stats.totalAlmacenes}
                icon={Warehouse}
                variant="info"
                size="sm"
              />
              <KPICard
                title="Viajeros Activos"
                value={stats.viajeros}
                icon={Plane}
                variant="success"
                size="sm"
              />
              <KPICard
                title="Unidades USA"
                value={stats.unidadesTotalesUSA}
                icon={Package}
                variant="info"
                size="sm"
              />
              <KPICard
                title="Valor Inventario"
                value={`$${stats.valorInventarioUSA.toLocaleString()}`}
                subtitle="USD"
                icon={DollarSign}
                variant="success"
                size="sm"
              />
            </KPIGrid>
          )}

          {/* Filtros */}
          <Card padding="md">
            <div className="flex flex-wrap items-center gap-4">
              {/* Búsqueda */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, código, ciudad..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Filtro por país */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={filtroPais}
                  onChange={(e) => setFiltroPais(e.target.value as PaisAlmacen | 'todos')}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todos">Todos los países</option>
                  <option value="USA">USA</option>
                  <option value="Peru">Peru</option>
                </select>
              </div>

              {/* Filtro por tipo */}
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as TipoAlmacen | 'todos')}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos los tipos</option>
                <option value="viajero">Viajero</option>
                <option value="almacen_peru">Almacén Perú</option>
              </select>

              {/* Filtro por estado */}
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as EstadoAlmacen | 'todos')}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="suspendido">Suspendido</option>
              </select>

              {/* Contador de resultados */}
              <span className="text-sm text-gray-500">
                {almacenesFiltrados.length} de {almacenes.length}
              </span>
            </div>
          </Card>

          {/* Lista de almacenes */}
          <Card padding="none">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Almacenes y Viajeros ({almacenesFiltrados.length})
              </h3>
            </div>

            {almacenesFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <Warehouse className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No hay almacenes que coincidan con los filtros</p>
                <Button
                  variant="primary"
                  onClick={() => onOpenAlmacenModal()}
                  className="mt-4"
                >
                  Crear Almacén
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {almacenesPaginados.map((almacen) => {
                  const capacidadUsada = calcularCapacidadUsada(almacen);
                  return (
                    <div
                      key={almacen.id}
                      className="px-6 py-4 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                          almacen.pais === 'USA' ? 'bg-blue-100' : 'bg-amber-100'
                        }`}>
                          {almacen.esViajero ? (
                            <Plane className={`h-6 w-6 ${almacen.pais === 'USA' ? 'text-blue-600' : 'text-amber-600'}`} />
                          ) : (
                            <Warehouse className={`h-6 w-6 ${almacen.pais === 'USA' ? 'text-blue-600' : 'text-amber-600'}`} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                              {almacen.codigo}
                            </span>
                            <span className="font-medium text-gray-900">{almacen.nombre}</span>
                            <span className={`px-2 py-1 text-xs font-medium rounded border ${getPaisColor(almacen.pais)}`}>
                              {almacen.pais}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded border ${getTipoColor(almacen.tipo)}`}>
                              {almacen.tipo === 'viajero' ? 'Viajero' : 'Almacén'}
                            </span>
                            <Badge variant={getEstadoColor(almacen.estadoAlmacen)}>
                              {almacen.estadoAlmacen}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                            <span className="flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              {almacen.ciudad}
                            </span>
                            {almacen.telefono && (
                              <span className="flex items-center">
                                <Phone className="h-3 w-3 mr-1" />
                                {almacen.telefono}
                              </span>
                            )}
                            {almacen.email && (
                              <span className="flex items-center">
                                <Mail className="h-3 w-3 mr-1" />
                                {almacen.email}
                              </span>
                            )}
                            {almacen.esViajero && almacen.proximoViaje && (
                              <span className="flex items-center text-purple-600">
                                <Calendar className="h-3 w-3 mr-1" />
                                {formatFechaViaje(almacen.proximoViaje)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {almacen.unidadesActuales || 0} unidades
                          </div>
                          <div className="text-sm text-green-600 font-medium">
                            ${(almacen.valorInventarioUSD || 0).toLocaleString()} USD
                          </div>
                          {almacen.capacidadUnidades && (
                            <div className="mt-1">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${getCapacidadColor(capacidadUsada)}`}
                                    style={{ width: `${Math.min(capacidadUsada, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500">
                                  {capacidadUsada.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex space-x-1">
                          <button
                            onClick={() => setAlmacenDetalle(almacen)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onEditAlmacen(almacen)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Paginación */}
            {almacenesFiltrados.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={almacenesFiltrados.length}
                pageSize={itemsPerPage}
                onPageChange={setPage}
                onPageSizeChange={setItemsPerPage}
              />
            )}
          </Card>
        </div>
      )}

      {/* Modal de detalle con analytics */}
      {almacenDetalle && (
        <AlmacenDetailView
          almacen={almacenDetalle}
          onClose={() => setAlmacenDetalle(null)}
          onEdit={() => {
            setAlmacenDetalle(null);
            onEditAlmacen(almacenDetalle);
          }}
        />
      )}
    </div>
  );
};
