import { useState, useEffect, useMemo } from 'react';
import { useCompetidorStore } from '../../store/competidorStore';
import { CompetidorDetailView } from './CompetidorDetailView';
import type { Competidor, PlataformaCompetidor, ReputacionCompetidor } from '../../types/entidadesMaestras.types';
import { Pagination, usePagination } from '../common';

// Sub-tabs del módulo
type SubTab = 'lista' | 'dashboard' | 'alertas';

interface CompetidoresIntelProps {
  onOpenCompetidorModal: (competidor?: Competidor) => void;
  onViewCompetidor?: (competidor: Competidor) => void;
  onEditCompetidor?: (competidor: Competidor) => void;
  onDeleteCompetidor: (id: string) => void;
}

export function CompetidoresIntel({
  onOpenCompetidorModal,
  onViewCompetidor,
  onEditCompetidor,
  onDeleteCompetidor
}: CompetidoresIntelProps) {
  const [subTab, setSubTab] = useState<SubTab>('lista');
  const [busqueda, setBusqueda] = useState('');
  const [filtroPlataforma, setFiltroPlataforma] = useState<string>('todos');
  const [filtroAmenaza, setFiltroAmenaza] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [competidorDetalle, setCompetidorDetalle] = useState<Competidor | null>(null);

  const {
    competidores,
    stats,
    loading,
    fetchCompetidores,
    fetchStats
  } = useCompetidorStore();

  // Los datos se cargan desde Maestros.tsx, solo cargar si no hay datos
  useEffect(() => {
    if (!competidores.length && !loading) {
      fetchCompetidores();
    }
    if (!stats && !loading) {
      fetchStats();
    }
  }, []);

  // Alertas calculadas
  const alertas = useMemo(() => {
    if (!competidores.length) return null;

    const activos = competidores.filter(c => c.estado === 'activo');

    // Competidores de alta amenaza
    const amenazaAlta = activos.filter(c => c.nivelAmenaza === 'alto');

    // Líderes de categoría
    const lideres = activos.filter(c => c.esLiderCategoria);

    // Competidores sin análisis reciente (30 días)
    const ahora = new Date();
    const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sinAnalisisReciente = activos.filter(c => {
      if (!c.metricas?.ultimaActualizacion) return true;
      const ultimaAct = c.metricas.ultimaActualizacion.toDate?.() ||
        new Date(c.metricas.ultimaActualizacion as unknown as string);
      return ultimaAct < hace30Dias;
    });

    // Competidores con reputación excelente (posible amenaza creciente)
    const reputacionExcelente = activos.filter(c => c.reputacion === 'excelente');

    // Nuevos competidores (últimos 30 días)
    const nuevos = activos.filter(c => {
      if (!c.fechaCreacion) return false;
      const fechaCreacion = c.fechaCreacion.toDate?.() ||
        new Date(c.fechaCreacion as unknown as string);
      return fechaCreacion > hace30Dias;
    });

    return {
      amenazaAlta,
      lideres,
      sinAnalisisReciente,
      reputacionExcelente,
      nuevos,
      totalAlertas: amenazaAlta.length + sinAnalisisReciente.length
    };
  }, [competidores]);

  // Filtrado de competidores
  const competidoresFiltrados = useMemo(() => {
    let resultado = [...competidores];

    // Filtro por búsqueda
    if (busqueda) {
      const termino = busqueda.toLowerCase();
      resultado = resultado.filter(c =>
        c.nombre.toLowerCase().includes(termino) ||
        c.codigo?.toLowerCase().includes(termino) ||
        c.alias?.some(a => a.toLowerCase().includes(termino))
      );
    }

    // Filtro por plataforma
    if (filtroPlataforma !== 'todos') {
      resultado = resultado.filter(c => c.plataformaPrincipal === filtroPlataforma);
    }

    // Filtro por nivel de amenaza
    if (filtroAmenaza !== 'todos') {
      resultado = resultado.filter(c => c.nivelAmenaza === filtroAmenaza);
    }

    // Filtro por estado
    if (filtroEstado !== 'todos') {
      resultado = resultado.filter(c => c.estado === filtroEstado);
    }

    return resultado.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [competidores, busqueda, filtroPlataforma, filtroAmenaza, filtroEstado]);

  // Paginación
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    setPage,
    setItemsPerPage,
    paginatedItems: competidoresPaginados
  } = usePagination({
    items: competidoresFiltrados,
    initialItemsPerPage: 25
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getPlataformaLabel = (plataforma: PlataformaCompetidor) => {
    const labels: Record<PlataformaCompetidor, string> = {
      mercado_libre: 'Mercado Libre',
      web_propia: 'Web Propia',
      inkafarma: 'InkaFarma',
      mifarma: 'MiFarma',
      amazon: 'Amazon',
      falabella: 'Falabella',
      otra: 'Otra'
    };
    return labels[plataforma] || plataforma;
  };

  const getPlataformaColor = (plataforma: PlataformaCompetidor) => {
    const colors: Record<PlataformaCompetidor, string> = {
      mercado_libre: 'bg-yellow-100 text-yellow-800',
      web_propia: 'bg-blue-100 text-blue-800',
      inkafarma: 'bg-green-100 text-green-800',
      mifarma: 'bg-purple-100 text-purple-800',
      amazon: 'bg-orange-100 text-orange-800',
      falabella: 'bg-lime-100 text-lime-800',
      otra: 'bg-gray-100 text-gray-800'
    };
    return colors[plataforma] || 'bg-gray-100 text-gray-800';
  };

  const getAmenazaColor = (nivel: string) => {
    const colors: Record<string, string> = {
      bajo: 'bg-green-100 text-green-800',
      medio: 'bg-yellow-100 text-yellow-800',
      alto: 'bg-red-100 text-red-800'
    };
    return colors[nivel] || 'bg-gray-100 text-gray-800';
  };

  const getReputacionLabel = (rep: ReputacionCompetidor) => {
    const labels: Record<ReputacionCompetidor, string> = {
      excelente: 'Excelente',
      buena: 'Buena',
      regular: 'Regular',
      mala: 'Mala',
      desconocida: 'Desconocida'
    };
    return labels[rep] || rep;
  };

  const getEstadoColor = (estado: string) => {
    const colors: Record<string, string> = {
      activo: 'bg-green-100 text-green-800',
      inactivo: 'bg-yellow-100 text-yellow-800',
      cerrado: 'bg-red-100 text-red-800'
    };
    return colors[estado] || 'bg-gray-100 text-gray-800';
  };

  // Render de la lista
  const renderLista = () => (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-64">
          <input
            type="text"
            placeholder="Buscar por nombre, código o alias..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <select
          value={filtroPlataforma}
          onChange={(e) => setFiltroPlataforma(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="todos">Todas las plataformas</option>
          <option value="mercado_libre">Mercado Libre</option>
          <option value="web_propia">Web Propia</option>
          <option value="inkafarma">InkaFarma</option>
          <option value="mifarma">MiFarma</option>
          <option value="amazon">Amazon</option>
          <option value="falabella">Falabella</option>
          <option value="otra">Otra</option>
        </select>

        <select
          value={filtroAmenaza}
          onChange={(e) => setFiltroAmenaza(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="todos">Todos los niveles</option>
          <option value="alto">Amenaza Alta</option>
          <option value="medio">Amenaza Media</option>
          <option value="bajo">Amenaza Baja</option>
        </select>

        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="todos">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
          <option value="cerrado">Cerrado</option>
        </select>

        <button
          onClick={() => onOpenCompetidorModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Competidor
        </button>
      </div>

      {/* Contador */}
      <div className="text-sm text-gray-500">
        Mostrando {competidoresFiltrados.length} de {competidores.length} competidores
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Competidor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plataforma
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amenaza
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reputación
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Productos Analizados
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {competidoresPaginados.map(competidor => (
              <tr key={competidor.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold ${
                      competidor.nivelAmenaza === 'alto' ? 'bg-red-500' :
                      competidor.nivelAmenaza === 'medio' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}>
                      {competidor.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-3">
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        {competidor.nombre}
                        {competidor.esLiderCategoria && (
                          <span className="text-yellow-500" title="Líder de categoría">⭐</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{competidor.codigo}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPlataformaColor(competidor.plataformaPrincipal)}`}>
                    {getPlataformaLabel(competidor.plataformaPrincipal)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAmenazaColor(competidor.nivelAmenaza)}`}>
                    {competidor.nivelAmenaza.charAt(0).toUpperCase() + competidor.nivelAmenaza.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                  {getReputacionLabel(competidor.reputacion)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {competidor.metricas?.productosAnalizados || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEstadoColor(competidor.estado)}`}>
                    {competidor.estado.charAt(0).toUpperCase() + competidor.estado.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex justify-center gap-2">
                    {(
                      <button
                        onClick={() => setCompetidorDetalle(competidor)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Ver detalle"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    )}
                    {competidor.urlTienda && (
                      <a
                        href={competidor.urlTienda}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-600 hover:text-gray-800"
                        title="Visitar tienda"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                    <button
                      onClick={() => onEditCompetidor ? onEditCompetidor(competidor) : onOpenCompetidorModal(competidor)}
                      className="text-gray-600 hover:text-gray-800"
                      title="Editar"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDeleteCompetidor(competidor.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Eliminar"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {competidoresFiltrados.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No se encontraron competidores con los filtros aplicados
          </div>
        )}

        {/* Paginación */}
        {competidoresFiltrados.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={competidoresFiltrados.length}
            pageSize={itemsPerPage}
            onPageChange={setPage}
            onPageSizeChange={setItemsPerPage}
          />
        )}
      </div>
    </div>
  );

  // Render del dashboard
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Total Competidores</div>
          <div className="text-3xl font-bold text-gray-900">{stats?.total || 0}</div>
          <div className="text-sm text-green-600 mt-1">
            {stats?.activos || 0} activos
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Amenaza Alta</div>
          <div className="text-3xl font-bold text-red-600">{stats?.porNivelAmenaza?.alto || 0}</div>
          <div className="text-sm text-gray-500 mt-1">
            Requieren monitoreo constante
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Líderes de Categoría</div>
          <div className="text-3xl font-bold text-yellow-600">{stats?.lideresCategoria || 0}</div>
          <div className="text-sm text-gray-500 mt-1">
            Dominan su segmento
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Productos Analizados</div>
          <div className="text-3xl font-bold text-blue-600">{stats?.totalProductosAnalizados || 0}</div>
          <div className="text-sm text-gray-500 mt-1">
            Precio promedio: {formatCurrency(stats?.precioPromedioGeneral || 0)}
          </div>
        </div>
      </div>

      {/* Distribuciones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Por plataforma */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Por Plataforma</h3>
          <div className="space-y-3">
            {stats?.porPlataforma && Object.entries(stats.porPlataforma)
              .filter(([, cantidad]) => cantidad > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([plataforma, cantidad]) => {
                const porcentaje = ((cantidad / (stats?.activos || 1)) * 100);
                return (
                  <div key={plataforma} className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPlataformaColor(plataforma as PlataformaCompetidor)}`}>
                      {getPlataformaLabel(plataforma as PlataformaCompetidor)}
                    </span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">
                      {cantidad}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Por nivel de amenaza */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Nivel de Amenaza</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span className="text-sm text-gray-700">Alta</span>
              </div>
              <span className="text-lg font-semibold text-red-600">{stats?.porNivelAmenaza?.alto || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                <span className="text-sm text-gray-700">Media</span>
              </div>
              <span className="text-lg font-semibold text-yellow-600">{stats?.porNivelAmenaza?.medio || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span className="text-sm text-gray-700">Baja</span>
              </div>
              <span className="text-lg font-semibold text-green-600">{stats?.porNivelAmenaza?.bajo || 0}</span>
            </div>
          </div>

          {/* Gráfico de dona simplificado */}
          <div className="mt-6 flex justify-center">
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 36 36" className="w-full h-full">
                {(() => {
                  const total = (stats?.porNivelAmenaza?.alto || 0) +
                               (stats?.porNivelAmenaza?.medio || 0) +
                               (stats?.porNivelAmenaza?.bajo || 0);
                  if (total === 0) return null;

                  const alto = ((stats?.porNivelAmenaza?.alto || 0) / total) * 100;
                  const medio = ((stats?.porNivelAmenaza?.medio || 0) / total) * 100;

                  return (
                    <>
                      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#22C55E" strokeWidth="3" strokeDasharray={`${100 - alto - medio} ${alto + medio}`} strokeDashoffset="25" />
                      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#EAB308" strokeWidth="3" strokeDasharray={`${medio} ${100 - medio}`} strokeDashoffset={25 - (100 - alto - medio)} />
                      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#EF4444" strokeWidth="3" strokeDasharray={`${alto} ${100 - alto}`} strokeDashoffset={25 - (100 - alto)} />
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>
        </div>

        {/* Por reputación */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Reputación</h3>
          <div className="space-y-3">
            {stats?.porReputacion && Object.entries(stats.porReputacion)
              .filter(([, cantidad]) => cantidad > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([rep, cantidad]) => (
                <div key={rep} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    {getReputacionLabel(rep as ReputacionCompetidor)}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          rep === 'excelente' ? 'bg-green-500' :
                          rep === 'buena' ? 'bg-blue-500' :
                          rep === 'regular' ? 'bg-yellow-500' :
                          rep === 'mala' ? 'bg-red-500' : 'bg-gray-400'
                        }`}
                        style={{ width: `${(cantidad / (stats?.activos || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-8 text-right">{cantidad}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Top competidores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top por Análisis de Productos</h3>
          <div className="space-y-3">
            {stats?.topCompetidoresPorAnalisis?.map((comp, idx) => (
              <div key={comp.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                  idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-600' : 'bg-blue-500'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{comp.nombre}</div>
                  <div className="text-sm text-gray-500">
                    Precio promedio: {formatCurrency(comp.precioPromedio)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{comp.productosAnalizados}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getAmenazaColor(comp.nivelAmenaza)}`}>
                    {comp.nivelAmenaza}
                  </span>
                </div>
              </div>
            ))}
            {(!stats?.topCompetidoresPorAnalisis || stats.topCompetidoresPorAnalisis.length === 0) && (
              <div className="text-center text-gray-500 py-4">
                No hay análisis de productos aún
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Competidores de Alta Amenaza</h3>
          <div className="space-y-3">
            {stats?.competidoresAmenazaAlta?.map(comp => (
              <div key={comp.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white font-bold">
                  {comp.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-red-900">{comp.nombre}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getPlataformaColor(comp.plataformaPrincipal)}`}>
                    {getPlataformaLabel(comp.plataformaPrincipal)}
                  </span>
                </div>
                <div className="text-sm text-red-600">
                  {comp.productosAnalizados} productos
                </div>
              </div>
            ))}
            {(!stats?.competidoresAmenazaAlta || stats.competidoresAmenazaAlta.length === 0) && (
              <div className="text-center text-green-600 py-4">
                No hay competidores de alta amenaza
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render de alertas
  const renderAlertas = () => (
    <div className="space-y-6">
      {/* Resumen de alertas */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Resumen de Alertas</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            (alertas?.totalAlertas || 0) > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}>
            {alertas?.totalAlertas || 0} alertas activas
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium text-red-800">Alta Amenaza</span>
            </div>
            <div className="text-2xl font-bold text-red-600">{alertas?.amenazaAlta?.length || 0}</div>
            <div className="text-sm text-red-700">Competidores peligrosos</div>
          </div>

          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium text-yellow-800">Sin Análisis Reciente</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600">{alertas?.sinAnalisisReciente?.length || 0}</div>
            <div className="text-sm text-yellow-700">Más de 30 días</div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="font-medium text-blue-800">Nuevos Competidores</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{alertas?.nuevos?.length || 0}</div>
            <div className="text-sm text-blue-700">Últimos 30 días</div>
          </div>
        </div>
      </div>

      {/* Lista de alertas por tipo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Amenaza Alta */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Competidores de Alta Amenaza
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {alertas?.amenazaAlta?.map(comp => (
              <div key={comp.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white font-bold">
                  {comp.nombre.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{comp.nombre}</div>
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${getPlataformaColor(comp.plataformaPrincipal)}`}>
                      {getPlataformaLabel(comp.plataformaPrincipal)}
                    </span>
                    {comp.esLiderCategoria && <span className="text-yellow-500">⭐ Líder</span>}
                  </div>
                </div>
                <button
                  onClick={() => setCompetidorDetalle(comp)}
                  className="text-red-600 hover:text-red-800"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            ))}
            {(!alertas?.amenazaAlta || alertas.amenazaAlta.length === 0) && (
              <div className="text-center py-8 text-green-600">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                No hay competidores de alta amenaza
              </div>
            )}
          </div>
        </div>

        {/* Sin análisis reciente */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Requieren Análisis
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {alertas?.sinAnalisisReciente?.slice(0, 10).map(comp => (
              <div key={comp.id} className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
                <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold">
                  {comp.nombre.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{comp.nombre}</div>
                  <div className="text-sm text-gray-500">
                    {comp.metricas?.productosAnalizados || 0} productos analizados
                  </div>
                </div>
                <button
                  onClick={() => onEditCompetidor?.(comp) || onOpenCompetidorModal(comp)}
                  className="text-yellow-600 hover:text-yellow-800 px-3 py-1 bg-yellow-100 rounded-lg text-sm"
                >
                  Analizar
                </button>
              </div>
            ))}
            {(alertas?.sinAnalisisReciente?.length || 0) > 10 && (
              <div className="text-center text-sm text-yellow-600">
                +{(alertas?.sinAnalisisReciente?.length || 0) - 10} más...
              </div>
            )}
            {(!alertas?.sinAnalisisReciente || alertas.sinAnalisisReciente.length === 0) && (
              <div className="text-center py-8 text-green-600">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Todos los competidores están actualizados
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Líderes y nuevos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Líderes de categoría */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-yellow-500">⭐</span>
            Líderes de Categoría
          </h3>
          <div className="space-y-3">
            {alertas?.lideres?.map(comp => (
              <div key={comp.id} className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold">
                  {comp.nombre.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{comp.nombre}</div>
                  <div className="text-sm text-gray-500">
                    {comp.categoriasLider?.join(', ') || 'Sin categorías específicas'}
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${getAmenazaColor(comp.nivelAmenaza)}`}>
                  {comp.nivelAmenaza}
                </span>
              </div>
            ))}
            {(!alertas?.lideres || alertas.lideres.length === 0) && (
              <div className="text-center py-4 text-gray-500">
                No hay líderes de categoría identificados
              </div>
            )}
          </div>
        </div>

        {/* Nuevos competidores */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nuevos Competidores (30 días)
          </h3>
          <div className="space-y-3">
            {alertas?.nuevos?.map(comp => (
              <div key={comp.id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                  {comp.nombre.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{comp.nombre}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getPlataformaColor(comp.plataformaPrincipal)}`}>
                    {getPlataformaLabel(comp.plataformaPrincipal)}
                  </span>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${getAmenazaColor(comp.nivelAmenaza)}`}>
                  {comp.nivelAmenaza}
                </span>
              </div>
            ))}
            {(!alertas?.nuevos || alertas.nuevos.length === 0) && (
              <div className="text-center py-4 text-gray-500">
                No hay nuevos competidores este mes
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recomendaciones */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recomendaciones de Inteligencia Competitiva</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-red-50 rounded-lg">
            <h4 className="font-medium text-red-800 mb-2">Monitoreo Prioritario</h4>
            <p className="text-sm text-red-700">
              Revisa semanalmente los precios y estrategias de los {alertas?.amenazaAlta?.length || 0} competidores
              de alta amenaza.
            </p>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">Actualizar Análisis</h4>
            <p className="text-sm text-yellow-700">
              Hay {alertas?.sinAnalisisReciente?.length || 0} competidores sin análisis reciente.
              Programa investigación de mercado.
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-800 mb-2">Observar Reputación</h4>
            <p className="text-sm text-green-700">
              {alertas?.reputacionExcelente?.length || 0} competidores tienen reputación excelente.
              Analiza qué están haciendo bien.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // Mostrar loading solo si está cargando y no hay datos aún
  if (loading && competidores.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Cargando competidores...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs de navegación */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-4">
          <button
            onClick={() => setSubTab('lista')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              subTab === 'lista'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Lista de Competidores
          </button>
          <button
            onClick={() => setSubTab('dashboard')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              subTab === 'dashboard'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Dashboard Intel
          </button>
          <button
            onClick={() => setSubTab('alertas')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
              subTab === 'alertas'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Alertas
            {(alertas?.totalAlertas || 0) > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {alertas?.totalAlertas}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Contenido según sub-tab */}
      {subTab === 'lista' && renderLista()}
      {subTab === 'dashboard' && renderDashboard()}
      {subTab === 'alertas' && renderAlertas()}

      {/* Modal de detalle con analytics */}
      {competidorDetalle && (
        <CompetidorDetailView
          competidor={competidorDetalle}
          onClose={() => setCompetidorDetalle(null)}
          onEdit={() => {
            setCompetidorDetalle(null);
            onEditCompetidor ? onEditCompetidor(competidorDetalle) : onOpenCompetidorModal(competidorDetalle);
          }}
        />
      )}
    </div>
  );
}
