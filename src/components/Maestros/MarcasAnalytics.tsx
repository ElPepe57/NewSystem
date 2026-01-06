import { useState, useEffect, useMemo } from 'react';
import { useMarcaStore } from '../../store/marcaStore';
import type { Marca } from '../../types/entidadesMaestras.types';
import { MarcaDetailView } from './MarcaDetailView';
import { MarcasComparador } from './MarcasComparador';
import { Pagination, usePagination } from '../common';

// Sub-tabs del módulo
type SubTab = 'lista' | 'dashboard' | 'rentabilidad';

interface MarcasAnalyticsProps {
  onOpenMarcaModal: (marca?: Marca) => void;
  onViewMarca?: (marca: Marca) => void;
  onEditMarca?: (marca: Marca) => void;
  onDeleteMarca: (id: string) => void;
}

export function MarcasAnalytics({
  onOpenMarcaModal,
  onViewMarca,
  onEditMarca,
  onDeleteMarca
}: MarcasAnalyticsProps) {
  const [subTab, setSubTab] = useState<SubTab>('lista');
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [ordenarPor, setOrdenarPor] = useState<'nombre' | 'ventas' | 'margen' | 'productos'>('nombre');
  const [marcaDetalle, setMarcaDetalle] = useState<Marca | null>(null);
  const [mostrarComparador, setMostrarComparador] = useState(false);

  const {
    marcas,
    stats,
    loading,
    fetchMarcas,
    fetchStats
  } = useMarcaStore();

  // Los datos se cargan desde Maestros.tsx, solo cargar si no hay datos
  useEffect(() => {
    if (!marcas.length && !loading) {
      fetchMarcas();
    }
    if (!stats && !loading) {
      fetchStats();
    }
  }, []);

  // Métricas calculadas
  const metricas = useMemo(() => {
    if (!marcas.length) return null;

    const activas = marcas.filter(m => m.estado === 'activa');
    const conProductos = marcas.filter(m => m.metricas?.productosActivos > 0);
    const conVentas = marcas.filter(m => m.metricas?.ventasTotalPEN > 0);

    const totalVentas = marcas.reduce((sum, m) => sum + (m.metricas?.ventasTotalPEN || 0), 0);
    const totalProductos = marcas.reduce((sum, m) => sum + (m.metricas?.productosActivos || 0), 0);
    const totalUnidades = marcas.reduce((sum, m) => sum + (m.metricas?.unidadesVendidas || 0), 0);

    // Calcular margen promedio ponderado
    const margenPonderado = totalUnidades > 0
      ? marcas.reduce((sum, m) => sum + (m.metricas?.margenPromedio || 0) * (m.metricas?.unidadesVendidas || 0), 0) / totalUnidades
      : 0;

    // Distribución por tipo
    const porTipo = marcas.reduce((acc, m) => {
      acc[m.tipoMarca] = (acc[m.tipoMarca] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Top 5 marcas por ventas
    const topVentas = [...conVentas]
      .sort((a, b) => (b.metricas?.ventasTotalPEN || 0) - (a.metricas?.ventasTotalPEN || 0))
      .slice(0, 5);

    // Top 5 marcas por margen (con mínimo 10 unidades)
    const topMargen = [...conVentas]
      .filter(m => (m.metricas?.unidadesVendidas || 0) >= 10)
      .sort((a, b) => (b.metricas?.margenPromedio || 0) - (a.metricas?.margenPromedio || 0))
      .slice(0, 5);

    // Marcas sin ventas en últimos 60 días (inactivas comercialmente)
    const ahora = new Date();
    const hace60Dias = new Date(ahora.getTime() - 60 * 24 * 60 * 60 * 1000);
    const sinVentasRecientes = conProductos.filter(m => {
      if (!m.metricas?.ultimaVenta) return true;
      const ultimaVenta = m.metricas.ultimaVenta.toDate?.() || new Date(m.metricas.ultimaVenta as unknown as string);
      return ultimaVenta < hace60Dias;
    });

    // Marcas descontinuadas con productos
    const descontinuadasConProductos = marcas.filter(
      m => m.estado === 'descontinuada' && (m.metricas?.productosActivos || 0) > 0
    );

    return {
      total: marcas.length,
      activas: activas.length,
      conProductos: conProductos.length,
      conVentas: conVentas.length,
      totalVentas,
      totalProductos,
      totalUnidades,
      margenPonderado,
      porTipo,
      topVentas,
      topMargen,
      sinVentasRecientes,
      descontinuadasConProductos
    };
  }, [marcas]);

  // Filtrado de marcas
  const marcasFiltradas = useMemo(() => {
    let resultado = [...marcas];

    // Filtro por búsqueda
    if (busqueda) {
      const termino = busqueda.toLowerCase();
      resultado = resultado.filter(m =>
        m.nombre.toLowerCase().includes(termino) ||
        m.codigo?.toLowerCase().includes(termino) ||
        m.alias?.some(a => a.toLowerCase().includes(termino))
      );
    }

    // Filtro por tipo
    if (filtroTipo !== 'todos') {
      resultado = resultado.filter(m => m.tipoMarca === filtroTipo);
    }

    // Filtro por estado
    if (filtroEstado !== 'todos') {
      resultado = resultado.filter(m => m.estado === filtroEstado);
    }

    // Ordenamiento
    resultado.sort((a, b) => {
      switch (ordenarPor) {
        case 'ventas':
          return (b.metricas?.ventasTotalPEN || 0) - (a.metricas?.ventasTotalPEN || 0);
        case 'margen':
          return (b.metricas?.margenPromedio || 0) - (a.metricas?.margenPromedio || 0);
        case 'productos':
          return (b.metricas?.productosActivos || 0) - (a.metricas?.productosActivos || 0);
        default:
          return a.nombre.localeCompare(b.nombre);
      }
    });

    return resultado;
  }, [marcas, busqueda, filtroTipo, filtroEstado, ordenarPor]);

  // Paginación
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    setPage,
    setItemsPerPage,
    paginatedItems: marcasPaginadas
  } = usePagination({
    items: marcasFiltradas,
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

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      farmaceutica: 'Farmacéutica',
      suplementos: 'Suplementos',
      cosmetica: 'Cosmética',
      tecnologia: 'Tecnología',
      otro: 'Otro'
    };
    return labels[tipo] || tipo;
  };

  const getTipoColor = (tipo: string) => {
    const colors: Record<string, string> = {
      farmaceutica: 'bg-blue-100 text-blue-800',
      suplementos: 'bg-green-100 text-green-800',
      cosmetica: 'bg-pink-100 text-pink-800',
      tecnologia: 'bg-purple-100 text-purple-800',
      otro: 'bg-gray-100 text-gray-800'
    };
    return colors[tipo] || 'bg-gray-100 text-gray-800';
  };

  const getEstadoColor = (estado: string) => {
    const colors: Record<string, string> = {
      activa: 'bg-green-100 text-green-800',
      inactiva: 'bg-yellow-100 text-yellow-800',
      descontinuada: 'bg-red-100 text-red-800'
    };
    return colors[estado] || 'bg-gray-100 text-gray-800';
  };

  // Render de la lista de marcas
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
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="todos">Todos los tipos</option>
          <option value="farmaceutica">Farmacéutica</option>
          <option value="suplementos">Suplementos</option>
          <option value="cosmetica">Cosmética</option>
          <option value="tecnologia">Tecnología</option>
          <option value="otro">Otro</option>
        </select>

        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="todos">Todos los estados</option>
          <option value="activa">Activa</option>
          <option value="inactiva">Inactiva</option>
          <option value="descontinuada">Descontinuada</option>
        </select>

        <select
          value={ordenarPor}
          onChange={(e) => setOrdenarPor(e.target.value as any)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="nombre">Ordenar: Nombre</option>
          <option value="ventas">Ordenar: Ventas</option>
          <option value="margen">Ordenar: Margen</option>
          <option value="productos">Ordenar: Productos</option>
        </select>

        <button
          onClick={() => setMostrarComparador(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
          title="Comparar marcas por categoría"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Comparar
        </button>

        <button
          onClick={() => onOpenMarcaModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Marca
        </button>
      </div>

      {/* Contador */}
      <div className="text-sm text-gray-500">
        Mostrando {marcasFiltradas.length} de {marcas.length} marcas
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Marca
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Productos
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ventas
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Margen
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {marcasPaginadas.map(marca => (
              <tr key={marca.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {marca.logoUrl ? (
                      <img
                        src={marca.logoUrl}
                        alt={marca.nombre}
                        className="h-8 w-8 rounded-full object-cover mr-3"
                      />
                    ) : (
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center mr-3 text-white font-semibold text-sm"
                        style={{ backgroundColor: marca.colorPrimario || '#3B82F6' }}
                      >
                        {marca.nombre.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{marca.nombre}</div>
                      <div className="text-sm text-gray-500">{marca.codigo}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTipoColor(marca.tipoMarca)}`}>
                    {getTipoLabel(marca.tipoMarca)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEstadoColor(marca.estado)}`}>
                    {marca.estado.charAt(0).toUpperCase() + marca.estado.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {marca.metricas?.productosActivos || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {formatCurrency(marca.metricas?.ventasTotalPEN || 0)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <span className={marca.metricas?.margenPromedio >= 25 ? 'text-green-600' : marca.metricas?.margenPromedio >= 15 ? 'text-yellow-600' : 'text-red-600'}>
                    {formatPercent(marca.metricas?.margenPromedio || 0)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => setMarcaDetalle(marca)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Ver detalle y analytics"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onEditMarca ? onEditMarca(marca) : onOpenMarcaModal(marca)}
                      className="text-gray-600 hover:text-gray-800"
                      title="Editar"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDeleteMarca(marca.id)}
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

        {marcasFiltradas.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No se encontraron marcas con los filtros aplicados
          </div>
        )}

        {/* Paginación */}
        {marcasFiltradas.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={marcasFiltradas.length}
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
          <div className="text-sm text-gray-500 mb-1">Total Marcas</div>
          <div className="text-3xl font-bold text-gray-900">{metricas?.total || 0}</div>
          <div className="text-sm text-green-600 mt-1">
            {metricas?.activas || 0} activas
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Marcas con Productos</div>
          <div className="text-3xl font-bold text-blue-600">{metricas?.conProductos || 0}</div>
          <div className="text-sm text-gray-500 mt-1">
            {metricas?.totalProductos || 0} productos totales
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Ventas Totales</div>
          <div className="text-3xl font-bold text-green-600">
            {formatCurrency(metricas?.totalVentas || 0)}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {(metricas?.totalUnidades || 0).toLocaleString()} unidades
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Margen Promedio</div>
          <div className={`text-3xl font-bold ${(metricas?.margenPonderado || 0) >= 25 ? 'text-green-600' : (metricas?.margenPonderado || 0) >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>
            {formatPercent(metricas?.margenPonderado || 0)}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Ponderado por unidades
          </div>
        </div>
      </div>

      {/* Distribución por tipo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución por Tipo</h3>
          <div className="space-y-3">
            {metricas?.porTipo && Object.entries(metricas.porTipo)
              .sort((a, b) => b[1] - a[1])
              .map(([tipo, cantidad]) => {
                const porcentaje = ((cantidad / (metricas?.total || 1)) * 100);
                return (
                  <div key={tipo} className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTipoColor(tipo)}`}>
                      {getTipoLabel(tipo)}
                    </span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-20 text-right">
                      {cantidad} ({porcentaje.toFixed(0)}%)
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Alertas */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Alertas de Marcas</h3>
          <div className="space-y-3">
            {(metricas?.sinVentasRecientes?.length || 0) > 0 && (
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <div className="font-medium text-yellow-800">
                    {metricas?.sinVentasRecientes?.length} marcas sin ventas recientes
                  </div>
                  <div className="text-sm text-yellow-700">
                    Con productos pero sin ventas en 60 días
                  </div>
                </div>
              </div>
            )}

            {(metricas?.descontinuadasConProductos?.length || 0) > 0 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className="font-medium text-red-800">
                    {metricas?.descontinuadasConProductos?.length} marcas descontinuadas con productos
                  </div>
                  <div className="text-sm text-red-700">
                    Revisar y reasignar productos
                  </div>
                </div>
              </div>
            )}

            {(metricas?.sinVentasRecientes?.length || 0) === 0 && (metricas?.descontinuadasConProductos?.length || 0) === 0 && (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="font-medium text-green-800">
                  Todo en orden con las marcas
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top marcas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 por Ventas</h3>
          <div className="space-y-3">
            {metricas?.topVentas?.map((marca, idx) => (
              <div key={marca.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-600' : 'bg-blue-500'}`}>
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{marca.nombre}</div>
                  <div className="text-sm text-gray-500">
                    Margen: {formatPercent(marca.metricas?.margenPromedio || 0)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-green-600">
                    {formatCurrency(marca.metricas?.ventasTotalPEN || 0)}
                  </div>
                </div>
              </div>
            ))}
            {(!metricas?.topVentas || metricas.topVentas.length === 0) && (
              <div className="text-center text-gray-500 py-4">
                No hay datos de ventas aún
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 por Margen</h3>
          <div className="space-y-3">
            {metricas?.topMargen?.map((marca, idx) => (
              <div key={marca.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${idx === 0 ? 'bg-green-500' : idx === 1 ? 'bg-green-400' : idx === 2 ? 'bg-green-300' : 'bg-blue-500'}`}>
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{marca.nombre}</div>
                  <div className="text-sm text-gray-500">
                    Ventas: {formatCurrency(marca.metricas?.ventasTotalPEN || 0)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-green-600">
                    {formatPercent(marca.metricas?.margenPromedio || 0)}
                  </div>
                </div>
              </div>
            ))}
            {(!metricas?.topMargen || metricas.topMargen.length === 0) && (
              <div className="text-center text-gray-500 py-4">
                Necesita más ventas para calcular
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render de rentabilidad
  const renderRentabilidad = () => {
    // Calcular matriz de rentabilidad
    const marcasConDatos = marcas.filter(m =>
      m.estado === 'activa' &&
      (m.metricas?.ventasTotalPEN || 0) > 0
    );

    // Calcular cuartiles para clasificar
    const ventas = marcasConDatos.map(m => m.metricas?.ventasTotalPEN || 0).sort((a, b) => a - b);
    const margenes = marcasConDatos.map(m => m.metricas?.margenPromedio || 0).sort((a, b) => a - b);

    const ventasMediana = ventas[Math.floor(ventas.length / 2)] || 0;
    const margenMediana = margenes[Math.floor(margenes.length / 2)] || 0;

    // Clasificar marcas en cuadrantes
    const estrellas = marcasConDatos.filter(m =>
      (m.metricas?.ventasTotalPEN || 0) >= ventasMediana &&
      (m.metricas?.margenPromedio || 0) >= margenMediana
    );

    const vacasLecheras = marcasConDatos.filter(m =>
      (m.metricas?.ventasTotalPEN || 0) >= ventasMediana &&
      (m.metricas?.margenPromedio || 0) < margenMediana
    );

    const interrogantes = marcasConDatos.filter(m =>
      (m.metricas?.ventasTotalPEN || 0) < ventasMediana &&
      (m.metricas?.margenPromedio || 0) >= margenMediana
    );

    const perros = marcasConDatos.filter(m =>
      (m.metricas?.ventasTotalPEN || 0) < ventasMediana &&
      (m.metricas?.margenPromedio || 0) < margenMediana
    );

    return (
      <div className="space-y-6">
        {/* Matriz BCG simplificada */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Matriz de Rentabilidad (Ventas vs Margen)
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            Clasificación basada en mediana de ventas ({formatCurrency(ventasMediana)}) y margen ({formatPercent(margenMediana)})
          </p>

          <div className="grid grid-cols-2 gap-4">
            {/* Estrellas */}
            <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">⭐</span>
                <h4 className="font-semibold text-green-800">Estrellas ({estrellas.length})</h4>
              </div>
              <p className="text-sm text-green-700 mb-3">Alto volumen + Alto margen</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {estrellas.slice(0, 5).map(m => (
                  <div key={m.id} className="flex justify-between text-sm">
                    <span className="text-green-900">{m.nombre}</span>
                    <span className="text-green-600">{formatPercent(m.metricas?.margenPromedio || 0)}</span>
                  </div>
                ))}
                {estrellas.length > 5 && (
                  <div className="text-sm text-green-600">+{estrellas.length - 5} más...</div>
                )}
              </div>
            </div>

            {/* Interrogantes */}
            <div className="bg-yellow-50 rounded-lg p-4 border-2 border-yellow-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">❓</span>
                <h4 className="font-semibold text-yellow-800">Interrogantes ({interrogantes.length})</h4>
              </div>
              <p className="text-sm text-yellow-700 mb-3">Bajo volumen + Alto margen</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {interrogantes.slice(0, 5).map(m => (
                  <div key={m.id} className="flex justify-between text-sm">
                    <span className="text-yellow-900">{m.nombre}</span>
                    <span className="text-yellow-600">{formatCurrency(m.metricas?.ventasTotalPEN || 0)}</span>
                  </div>
                ))}
                {interrogantes.length > 5 && (
                  <div className="text-sm text-yellow-600">+{interrogantes.length - 5} más...</div>
                )}
              </div>
            </div>

            {/* Vacas lecheras */}
            <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🐄</span>
                <h4 className="font-semibold text-blue-800">Vacas Lecheras ({vacasLecheras.length})</h4>
              </div>
              <p className="text-sm text-blue-700 mb-3">Alto volumen + Bajo margen</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {vacasLecheras.slice(0, 5).map(m => (
                  <div key={m.id} className="flex justify-between text-sm">
                    <span className="text-blue-900">{m.nombre}</span>
                    <span className="text-blue-600">{formatCurrency(m.metricas?.ventasTotalPEN || 0)}</span>
                  </div>
                ))}
                {vacasLecheras.length > 5 && (
                  <div className="text-sm text-blue-600">+{vacasLecheras.length - 5} más...</div>
                )}
              </div>
            </div>

            {/* Perros */}
            <div className="bg-red-50 rounded-lg p-4 border-2 border-red-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🐕</span>
                <h4 className="font-semibold text-red-800">Bajo Rendimiento ({perros.length})</h4>
              </div>
              <p className="text-sm text-red-700 mb-3">Bajo volumen + Bajo margen</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {perros.slice(0, 5).map(m => (
                  <div key={m.id} className="flex justify-between text-sm">
                    <span className="text-red-900">{m.nombre}</span>
                    <span className="text-red-600">{formatPercent(m.metricas?.margenPromedio || 0)}</span>
                  </div>
                ))}
                {perros.length > 5 && (
                  <div className="text-sm text-red-600">+{perros.length - 5} más...</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recomendaciones */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recomendaciones Estratégicas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">Invertir en Estrellas</h4>
              <p className="text-sm text-green-700">
                Mantener stock óptimo y considerar exclusividad con proveedores de estas marcas.
              </p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-2">Potenciar Interrogantes</h4>
              <p className="text-sm text-yellow-700">
                Aumentar visibilidad y promoción. Alto potencial de margen.
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Optimizar Vacas Lecheras</h4>
              <p className="text-sm text-blue-700">
                Negociar mejores precios con proveedores para mejorar márgenes.
              </p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <h4 className="font-medium text-red-800 mb-2">Evaluar Bajo Rendimiento</h4>
              <p className="text-sm text-red-700">
                Considerar reducir SKUs o descontinuar marcas de este cuadrante.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Mostrar loading solo si está cargando y no hay datos aún
  if (loading && marcas.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Cargando marcas...</span>
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
            Lista de Marcas
          </button>
          <button
            onClick={() => setSubTab('dashboard')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              subTab === 'dashboard'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Dashboard Analytics
          </button>
          <button
            onClick={() => setSubTab('rentabilidad')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              subTab === 'rentabilidad'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Análisis de Rentabilidad
          </button>
        </nav>
      </div>

      {/* Contenido según sub-tab */}
      {subTab === 'lista' && renderLista()}
      {subTab === 'dashboard' && renderDashboard()}
      {subTab === 'rentabilidad' && renderRentabilidad()}

      {/* Modal de detalle de marca */}
      {marcaDetalle && (
        <MarcaDetailView
          marca={marcaDetalle}
          onClose={() => setMarcaDetalle(null)}
          onEdit={() => {
            setMarcaDetalle(null);
            onOpenMarcaModal(marcaDetalle);
          }}
        />
      )}

      {/* Modal comparador de marcas */}
      {mostrarComparador && (
        <MarcasComparador onClose={() => setMostrarComparador(false)} />
      )}
    </div>
  );
}
