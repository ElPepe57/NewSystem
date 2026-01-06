import React, { useEffect, useState } from 'react';
import {
  Truck,
  Star,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  DollarSign,
  Clock,
  Globe,
  Shield,
  Award,
  BarChart3,
  PieChart,
  Zap,
  RefreshCw,
  Plus,
  Filter,
  Search,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  ShoppingCart
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
import { useProveedorStore } from '../../store/proveedorStore';
import { useAuthStore } from '../../store/authStore';
import { ProveedorDetailView } from './ProveedorDetailView';
import type { Proveedor, ClasificacionProveedor, TipoProveedor } from '../../types/ordenCompra.types';

// Sub-tabs dentro del módulo de proveedores
type SubTabProveedores = 'lista' | 'dashboard' | 'evaluacion';

interface ProveedoresSRMProps {
  onOpenProveedorModal: (proveedor?: Proveedor) => void;
  onViewProveedor: (proveedor: Proveedor) => void;
  onDeleteProveedor: (id: string) => void;
  onEditProveedor: (proveedor: Proveedor) => void;
}

export const ProveedoresSRM: React.FC<ProveedoresSRMProps> = ({
  onOpenProveedorModal,
  onViewProveedor,
  onDeleteProveedor,
  onEditProveedor
}) => {
  const user = useAuthStore(state => state.user);
  const [subTab, setSubTab] = useState<SubTabProveedores>('lista');
  const [busqueda, setBusqueda] = useState('');
  const [filtroClasificacion, setFiltroClasificacion] = useState<ClasificacionProveedor | 'todos'>('todos');
  const [filtroPais, setFiltroPais] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<TipoProveedor | 'todos'>('todos');
  const [proveedorDetalle, setProveedorDetalle] = useState<Proveedor | null>(null);

  const {
    proveedores,
    stats,
    loading,
    fetchProveedores,
    fetchStats
  } = useProveedorStore();

  // Los datos se cargan desde Maestros.tsx, solo cargar si no hay datos
  useEffect(() => {
    if (!proveedores.length && !loading) {
      fetchProveedores();
    }
    if (!stats && !loading) {
      fetchStats();
    }
  }, []);

  // Filtrar proveedores
  const proveedoresFiltrados = proveedores.filter(p => {
    // Búsqueda
    if (busqueda) {
      const term = busqueda.toLowerCase();
      const match = p.nombre.toLowerCase().includes(term) ||
        p.contacto?.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term) ||
        p.codigo?.toLowerCase().includes(term);
      if (!match) return false;
    }

    // Filtro por clasificación
    if (filtroClasificacion !== 'todos') {
      if (p.evaluacion?.clasificacion !== filtroClasificacion) return false;
    }

    // Filtro por país
    if (filtroPais !== 'todos') {
      if (p.pais !== filtroPais) return false;
    }

    // Filtro por tipo
    if (filtroTipo !== 'todos') {
      if (p.tipo !== filtroTipo) return false;
    }

    return true;
  });

  // Paginación
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    setPage,
    setItemsPerPage,
    paginatedItems: proveedoresPaginados
  } = usePagination({
    items: proveedoresFiltrados,
    initialItemsPerPage: 25
  });

  // Helpers de UI
  const getClasificacionConfig = (clasificacion?: ClasificacionProveedor) => {
    const configs: Record<ClasificacionProveedor, { color: string; icon: React.ReactNode; label: string }> = {
      preferido: { color: 'bg-green-100 text-green-700', icon: <Star className="h-3 w-3" />, label: 'Preferido' },
      aprobado: { color: 'bg-blue-100 text-blue-700', icon: <CheckCircle className="h-3 w-3" />, label: 'Aprobado' },
      condicional: { color: 'bg-amber-100 text-amber-700', icon: <AlertCircle className="h-3 w-3" />, label: 'Condicional' },
      suspendido: { color: 'bg-red-100 text-red-700', icon: <XCircle className="h-3 w-3" />, label: 'Suspendido' }
    };
    return configs[clasificacion || 'aprobado'];
  };

  const getTipoColor = (tipo: TipoProveedor) => {
    const colores: Record<TipoProveedor, string> = {
      mayorista: 'bg-purple-100 text-purple-700',
      fabricante: 'bg-indigo-100 text-indigo-700',
      distribuidor: 'bg-cyan-100 text-cyan-700',
      minorista: 'bg-blue-100 text-blue-700'
    };
    return colores[tipo] || 'bg-gray-100 text-gray-700';
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-3 w-3 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  // Calcular estadísticas adicionales
  const proveedoresPreferidos = proveedores.filter(p => p.evaluacion?.clasificacion === 'preferido');
  const proveedoresSuspendidos = proveedores.filter(p => p.evaluacion?.clasificacion === 'suspendido');
  const proveedoresSinEvaluar = proveedores.filter(p => !p.evaluacion || p.evaluacion.puntuacion === 0);
  const promedioRating = proveedores.length > 0
    ? proveedores.reduce((sum, p) => sum + (p.evaluacion?.puntuacion || 0), 0) / proveedores.length
    : 0;

  // Sub-tabs
  const subTabs = [
    { id: 'lista', label: 'Lista', icon: Truck, count: proveedores.length },
    { id: 'dashboard', label: 'Dashboard SRM', icon: BarChart3 },
    { id: 'evaluacion', label: 'Evaluación', icon: Star, count: proveedoresSinEvaluar.length > 0 ? proveedoresSinEvaluar.length : undefined }
  ];

  return (
    <div className="space-y-4">
      {/* Sub-navegación */}
      <div className="flex items-center justify-between">
        <TabNavigation
          tabs={subTabs}
          activeTab={subTab}
          onTabChange={(id) => setSubTab(id as SubTabProveedores)}
          variant="pills"
        />
        <Button variant="primary" size="sm" onClick={() => onOpenProveedorModal()}>
          <Plus className="h-4 w-4 mr-1" />
          Nuevo Proveedor
        </Button>
      </div>

      {/* ============ SUB-TAB: DASHBOARD SRM ============ */}
      {subTab === 'dashboard' && stats && (
        <div className="space-y-6">
          {/* KPIs principales */}
          <KPIGrid columns={5}>
            <KPICard
              title="Total Proveedores"
              value={stats.totalProveedores}
              icon={Truck}
              variant="info"
              size="sm"
            />
            <KPICard
              title="Activos"
              value={stats.proveedoresActivos}
              icon={CheckCircle}
              variant="success"
              size="sm"
            />
            <KPICard
              title="Preferidos"
              value={proveedoresPreferidos.length}
              icon={Star}
              variant="success"
              size="sm"
            />
            <KPICard
              title="Rating Promedio"
              value={promedioRating.toFixed(1)}
              subtitle="de 10"
              icon={Award}
              variant={promedioRating >= 7 ? 'success' : promedioRating >= 5 ? 'warning' : 'danger'}
              size="sm"
            />
            <KPICard
              title="Suspendidos"
              value={proveedoresSuspendidos.length}
              icon={AlertTriangle}
              variant={proveedoresSuspendidos.length > 0 ? 'warning' : 'default'}
              size="sm"
            />
          </KPIGrid>

          {/* Distribución */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Por Clasificación */}
            <Card padding="lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600" />
                Clasificación de Proveedores
              </h3>
              <div className="space-y-4">
                {(['preferido', 'aprobado', 'condicional', 'suspendido'] as ClasificacionProveedor[]).map(clasificacion => {
                  const count = proveedores.filter(p => p.evaluacion?.clasificacion === clasificacion).length;
                  const porcentaje = proveedores.length > 0 ? (count / proveedores.length) * 100 : 0;
                  const config = getClasificacionConfig(clasificacion);
                  return (
                    <div key={clasificacion} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`flex items-center gap-1 px-2.5 py-1 text-sm font-medium rounded-full ${config.color}`}>
                          {config.icon}
                          {config.label}
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          {count} ({porcentaje.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            clasificacion === 'preferido' ? 'bg-green-500' :
                            clasificacion === 'aprobado' ? 'bg-blue-500' :
                            clasificacion === 'condicional' ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Por País */}
            <Card padding="lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Globe className="h-5 w-5 text-indigo-600" />
                Proveedores por País
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.proveedoresPorPais || {})
                  .sort(([, a], [, b]) => b - a)
                  .map(([pais, count]) => {
                    const porcentaje = proveedores.length > 0 ? (count / proveedores.length) * 100 : 0;
                    return (
                      <div key={pais} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{pais}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${porcentaje}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-12 text-right">
                            {count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>
          </div>

          {/* Top Proveedores */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AlertCard
              title="Top por Compras"
              icon={ShoppingCart}
              variant="success"
              emptyMessage="Sin datos de compras"
              items={(stats.topProveedoresPorCompras || []).slice(0, 5).map(p => ({
                id: p.proveedorId,
                label: p.nombre,
                value: `${p.ordenesCompra} OC`,
                sublabel: `USD ${p.montoTotalUSD.toLocaleString()}`
              }))}
              maxItems={5}
              onItemClick={(id) => {
                const prov = proveedores.find(p => p.id === id);
                if (prov) onViewProveedor(prov);
              }}
            />
            <AlertCard
              title="Mejor Rating"
              icon={Star}
              variant="info"
              emptyMessage="Sin evaluaciones"
              items={proveedores
                .filter(p => p.evaluacion && p.evaluacion.puntuacion > 0)
                .sort((a, b) => (b.evaluacion?.puntuacion || 0) - (a.evaluacion?.puntuacion || 0))
                .slice(0, 5)
                .map(p => ({
                  id: p.id,
                  label: p.nombre,
                  value: `${p.evaluacion?.puntuacion.toFixed(1)}/10`,
                  sublabel: p.evaluacion?.clasificacion
                }))}
              maxItems={5}
              onItemClick={(id) => {
                const prov = proveedores.find(p => p.id === id);
                if (prov) onViewProveedor(prov);
              }}
            />
          </div>
        </div>
      )}

      {/* ============ SUB-TAB: EVALUACIÓN ============ */}
      {subTab === 'evaluacion' && (
        <div className="space-y-6">
          {/* KPIs de evaluación */}
          <KPIGrid columns={4}>
            <KPICard
              title="Sin Evaluar"
              value={proveedoresSinEvaluar.length}
              icon={AlertCircle}
              variant={proveedoresSinEvaluar.length > 0 ? 'warning' : 'success'}
              size="sm"
            />
            <KPICard
              title="Rating > 7"
              value={proveedores.filter(p => (p.evaluacion?.puntuacion || 0) >= 7).length}
              icon={Star}
              variant="success"
              size="sm"
            />
            <KPICard
              title="Rating < 5"
              value={proveedores.filter(p => p.evaluacion && p.evaluacion.puntuacion < 5).length}
              icon={TrendingDown}
              variant="danger"
              size="sm"
            />
            <KPICard
              title="Promedio General"
              value={promedioRating.toFixed(1)}
              subtitle="de 10 puntos"
              icon={Award}
              variant="info"
              size="sm"
            />
          </KPIGrid>

          {/* Proveedores sin evaluar */}
          {proveedoresSinEvaluar.length > 0 && (
            <Card padding="lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Proveedores Pendientes de Evaluación
                <Badge variant="warning">{proveedoresSinEvaluar.length}</Badge>
              </h3>
              <div className="space-y-3">
                {proveedoresSinEvaluar.slice(0, 10).map(prov => (
                  <div
                    key={prov.id}
                    className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100 hover:bg-amber-100 cursor-pointer transition-colors"
                    onClick={() => onViewProveedor(prov)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
                        <Truck className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{prov.nombre}</p>
                        <p className="text-sm text-gray-500">{prov.pais} - {prov.tipo}</p>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm">
                      Evaluar
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Ranking de proveedores evaluados */}
          <Card padding="lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 text-indigo-600" />
              Ranking de Proveedores
            </h3>
            <div className="space-y-3">
              {proveedores
                .filter(p => p.evaluacion && p.evaluacion.puntuacion > 0)
                .sort((a, b) => (b.evaluacion?.puntuacion || 0) - (a.evaluacion?.puntuacion || 0))
                .slice(0, 10)
                .map((prov, index) => {
                  const config = getClasificacionConfig(prov.evaluacion?.clasificacion);
                  return (
                    <div
                      key={prov.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => onViewProveedor(prov)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-gray-200 text-gray-700' :
                          index === 2 ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{prov.nombre}</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${config.color}`}>
                              {config.label}
                            </span>
                            <span className="text-xs text-gray-500">{prov.pais}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          {getRatingStars(Math.round((prov.evaluacion?.puntuacion || 0) / 2))}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-indigo-600">
                            {prov.evaluacion?.puntuacion.toFixed(1)}
                          </p>
                          <p className="text-xs text-gray-500">de 10</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        </div>
      )}

      {/* ============ SUB-TAB: LISTA ============ */}
      {subTab === 'lista' && (
        <div className="space-y-4">
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
                  placeholder="Buscar por nombre, contacto, email..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Filtro por clasificación */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={filtroClasificacion}
                  onChange={(e) => setFiltroClasificacion(e.target.value as ClasificacionProveedor | 'todos')}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todos">Todas las clasificaciones</option>
                  <option value="preferido">Preferido</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="condicional">Condicional</option>
                  <option value="suspendido">Suspendido</option>
                </select>
              </div>

              {/* Filtro por país */}
              <select
                value={filtroPais}
                onChange={(e) => setFiltroPais(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos los países</option>
                <option value="USA">USA</option>
                <option value="China">China</option>
                <option value="Peru">Perú</option>
                <option value="Otro">Otro</option>
              </select>

              {/* Filtro por tipo */}
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as TipoProveedor | 'todos')}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos los tipos</option>
                <option value="minorista">Minorista</option>
                <option value="mayorista">Mayorista</option>
                <option value="fabricante">Fabricante</option>
                <option value="distribuidor">Distribuidor</option>
                              </select>

              <span className="text-sm text-gray-500">
                {proveedoresFiltrados.length} de {proveedores.length}
              </span>
            </div>
          </Card>

          {/* Lista de proveedores */}
          <Card padding="none">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Proveedores ({proveedoresFiltrados.length})
              </h3>
            </div>

            {proveedoresFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No hay proveedores que coincidan con los filtros</p>
                <Button
                  variant="primary"
                  onClick={() => onOpenProveedorModal()}
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Proveedor
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {proveedoresPaginados.map((proveedor) => {
                  const clasificacionConfig = getClasificacionConfig(proveedor.evaluacion?.clasificacion);
                  return (
                    <div
                      key={proveedor.id}
                      className="px-6 py-4 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center relative">
                          <Truck className="h-6 w-6 text-indigo-600" />
                          {proveedor.evaluacion?.clasificacion === 'preferido' && (
                            <Star className="absolute -top-1 -right-1 h-4 w-4 text-yellow-400 fill-yellow-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                              {proveedor.codigo}
                            </span>
                            <span className="font-medium text-gray-900">{proveedor.nombre}</span>
                            <Badge variant={proveedor.activo ? 'success' : 'default'}>
                              {proveedor.activo ? 'Activo' : 'Inactivo'}
                            </Badge>
                            <span className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${clasificacionConfig.color}`}>
                              {clasificacionConfig.icon}
                              {clasificacionConfig.label}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                            <span className="flex items-center">
                              <Globe className="h-3 w-3 mr-1" />
                              {proveedor.pais}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded ${getTipoColor(proveedor.tipo)}`}>
                              {proveedor.tipo}
                            </span>
                            {proveedor.evaluacion && proveedor.evaluacion.puntuacion > 0 && (
                              <span className="flex items-center">
                                <Star className="h-3 w-3 mr-1 text-yellow-400 fill-yellow-400" />
                                {proveedor.evaluacion.puntuacion.toFixed(1)}/10
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {proveedor.metricas?.ordenesCompra || 0} OC
                          </div>
                          <div className="text-sm text-green-600 font-medium">
                            USD {(proveedor.metricas?.montoTotalUSD || 0).toLocaleString()}
                          </div>
                        </div>

                        <div className="flex space-x-1">
                          {proveedor.url && (
                            <a
                              href={proveedor.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Visitar sitio"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          <button
                            onClick={() => setProveedorDetalle(proveedor)}
                            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                            title="Ver analytics detallado"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onViewProveedor(proveedor)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onEditProveedor(proveedor)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onDeleteProveedor(proveedor.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Paginación */}
            {proveedoresFiltrados.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={proveedoresFiltrados.length}
                pageSize={itemsPerPage}
                onPageChange={setPage}
                onPageSizeChange={setItemsPerPage}
              />
            )}
          </Card>
        </div>
      )}

      {/* Modal de detalle de proveedor con analytics */}
      {proveedorDetalle && (
        <ProveedorDetailView
          proveedor={proveedorDetalle}
          onClose={() => setProveedorDetalle(null)}
          onEdit={() => {
            setProveedorDetalle(null);
            onEditProveedor(proveedorDetalle);
          }}
        />
      )}
    </div>
  );
};
