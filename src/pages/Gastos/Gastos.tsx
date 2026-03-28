import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { formatFecha } from '../../utils/dateFormatters';
import { formatCurrencyPEN } from '../../utils/format';
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Plus, Filter, Download, PieChart, CreditCard, Wallet, ChevronLeft, ChevronRight, Calendar, List, Pencil, Trash2 } from 'lucide-react';
import { Card, Badge, Button, Select, SearchInput, useConfirmDialog, ConfirmDialog, ListSummary, EmptyStateAction, TableRowSkeleton, GastosSkeleton, GastoLineaBadge } from '../../components/common';
import { useToastStore } from '../../store/toastStore';
import { useGastoStore } from '../../store/gastoStore';
import { useAuthStore } from '../../store/authStore';
import { ctruService } from '../../services/ctru.service';
import { GastoForm } from './GastoForm';
import { PagoGastoForm } from './PagoGastoForm';
import { exportService } from '../../services/export.service';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import { CATEGORIAS_GASTO, type Gasto, type TipoGasto, type CategoriaGasto, type EstadoGasto, type ClaseGasto } from '../../types/gasto.types';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

type ViewMode = 'month' | 'all' | 'pending';

export const Gastos: React.FC = () => {
  const { user } = useAuthStore();
  const {
    gastos, stats, loading,
    fetchGastos, fetchGastosMes, buscarGastos,
    fetchStats, setViewMode: storeSetViewMode, reloadCurrentView,
    fetchGastosPendientesYParciales, eliminarGasto
  } = useGastoStore();

  const [showModal, setShowModal] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [gastoParaPago, setGastoParaPago] = useState<Gasto | null>(null);
  const [gastoParaEditar, setGastoParaEditar] = useState<Gasto | null>(null);
  const [filtros, setFiltros] = useState({
    claseGasto: '' as ClaseGasto | '',
    tipo: '' as TipoGasto | '',
    categoria: '' as CategoriaGasto | '',
    estado: '' as EstadoGasto | '',
    esProrrateable: '' as 'true' | 'false' | ''
  });

  // Vista y navegación temporal
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar gastos por línea de negocio (sin lineaNegocioId = compartidos, siempre visibles)
  const gastosPorLinea = useLineaFilter(gastos, g => g.lineaNegocioId, { allowUndefined: true });

  // Hook para dialogo de confirmacion
  const { dialogProps, confirm } = useConfirmDialog();
  const toast = useToastStore();

  const isCurrentMonth = selectedMonth === new Date().getMonth() + 1 && selectedYear === new Date().getFullYear();

  // Cargar datos según el modo de vista
  useEffect(() => {
    storeSetViewMode(viewMode, selectedMonth, selectedYear);
    if (viewMode === 'all') {
      fetchGastos();
    } else if (viewMode === 'pending') {
      fetchGastosPendientesYParciales();
    } else {
      fetchGastosMes(selectedMonth, selectedYear);
    }
    fetchStats();
  }, [viewMode, selectedMonth, selectedYear]);

  // Navegación de mes
  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (selectedMonth === 1) {
        setSelectedMonth(12);
        setSelectedYear(prev => prev - 1);
      } else {
        setSelectedMonth(prev => prev - 1);
      }
    } else {
      if (selectedMonth === 12) {
        setSelectedMonth(1);
        setSelectedYear(prev => prev + 1);
      } else {
        setSelectedMonth(prev => prev + 1);
      }
    }
  }, [selectedMonth]);

  const goToCurrentMonth = useCallback(() => {
    setSelectedMonth(new Date().getMonth() + 1);
    setSelectedYear(new Date().getFullYear());
    setViewMode('month');
  }, []);

  // Filtrar gastos (incluye búsqueda por texto)
  const gastosFiltrados = useMemo(() => {
    let resultado = gastosPorLinea;

    // Búsqueda por texto
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      resultado = resultado.filter(g =>
        g.descripcion?.toLowerCase().includes(term) ||
        g.numeroGasto?.toLowerCase().includes(term) ||
        g.proveedor?.toLowerCase().includes(term) ||
        g.tipo?.toLowerCase().includes(term) ||
        g.notas?.toLowerCase().includes(term)
      );
    }

    if (filtros.claseGasto) {
      resultado = resultado.filter(g => g.claseGasto === filtros.claseGasto);
    }
    if (filtros.tipo) {
      resultado = resultado.filter(g => g.tipo === filtros.tipo);
    }
    if (filtros.categoria) {
      resultado = resultado.filter(g => g.categoria === filtros.categoria);
    }
    if (filtros.estado) {
      resultado = resultado.filter(g => g.estado === filtros.estado);
    }
    if (filtros.esProrrateable) {
      resultado = resultado.filter(g => g.esProrrateable === (filtros.esProrrateable === 'true'));
    }

    return resultado;
  }, [gastosPorLinea, filtros, searchTerm]);

  // Calcular resumen por tipo de gasto
  const resumenPorTipo = useMemo(() => {
    const resumen: Record<string, { tipo: string; cantidad: number; total: number; porcentaje: number }> = {};
    const totalGeneral = gastosFiltrados.reduce((sum, g) => sum + g.montoPEN, 0);

    gastosFiltrados.forEach(gasto => {
      const tipo = gasto.tipo;
      if (!resumen[tipo]) {
        resumen[tipo] = { tipo, cantidad: 0, total: 0, porcentaje: 0 };
      }
      resumen[tipo].cantidad += 1;
      resumen[tipo].total += gasto.montoPEN;
    });

    // Calcular porcentajes y ordenar por total descendente
    const resultado = Object.values(resumen)
      .map(item => ({
        ...item,
        porcentaje: totalGeneral > 0 ? (item.total / totalGeneral) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);

    return { items: resultado, totalGeneral };
  }, [gastosFiltrados]);

  // Obtener lista única de tipos para el filtro dinámico
  const tiposUnicos = useMemo(() => {
    const tipos = new Set(gastos.map(g => g.tipo));
    return Array.from(tipos).sort();
  }, [gastos]);

  const formatCurrency = (amount: number): string => formatCurrencyPEN(amount);


  const getEstadoBadge = (estado: EstadoGasto) => {
    const badges = {
      'pendiente': { variant: 'warning' as const, label: 'Pendiente' },
      'parcial': { variant: 'info' as const, label: 'Parcial' },
      'pagado': { variant: 'success' as const, label: 'Pagado' },
      'cancelado': { variant: 'danger' as const, label: 'Cancelado' }
    };
    return badges[estado] || { variant: 'default' as const, label: 'Desconocido' };
  };

  const getTipoBadge = (tipo: TipoGasto) => {
    return { variant: 'default' as const, label: tipo };
  };

  // Colores para las categorías
  const getCategoriaColor = (cat: CategoriaGasto | undefined): string => {
    if (!cat) return 'bg-gray-100 text-gray-700';
    const colors: Record<CategoriaGasto, string> = {
      GV: 'bg-purple-100 text-purple-700',
      GD: 'bg-blue-100 text-blue-700',
      GA: 'bg-amber-100 text-amber-700',
      GO: 'bg-green-100 text-green-700'
    };
    return colors[cat] || 'bg-gray-100 text-gray-700';
  };

  const handleRecalcularCTRU = async () => {
    const confirmed = await confirm({
      title: 'Recalcular CTRU Dinamico',
      message: '¿Desea recalcular el CTRU dinamico con los gastos pendientes? Esto actualizara el costo de todas las unidades disponibles.',
      confirmText: 'Recalcular',
      variant: 'warning'
    });
    if (!confirmed) return;

    try {
      const resultado = await ctruService.recalcularCTRUDinamicoSafe();
      if (resultado) {
        toast.success(
          `${resultado.unidadesActualizadas} unidades actualizadas, ${resultado.gastosAplicados} gastos aplicados. Impacto: ${formatCurrency(resultado.impactoPorUnidad)}/unidad`,
          'CTRU Recalculado'
        );
      } else {
        toast.info('Recálculo CTRU encolado (otro en ejecución)', 'CTRU');
      }

      await reloadCurrentView();
      await fetchStats();
    } catch (error: any) {
      toast.error(error.message, 'Error al recalcular CTRU');
    }
  };

  const handleEliminarGasto = async (gasto: Gasto) => {
    const confirmed = await confirm({
      title: 'Eliminar Gasto',
      message: `¿Está seguro de eliminar el gasto ${gasto.numeroGasto}? "${gasto.descripcion}"\n\nEsta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      await eliminarGasto(gasto.id);
      toast.success(`Gasto ${gasto.numeroGasto} eliminado`, 'Gasto eliminado');
    } catch (error: any) {
      toast.error(error.message, 'Error al eliminar');
    }
  };

  const handleEditarGasto = (gasto: Gasto) => {
    setGastoParaEditar(gasto);
    setShowModal(true);
  };

  const limpiarFiltros = () => {
    setFiltros({
      claseGasto: '',
      tipo: '',
      categoria: '',
      estado: '',
      esProrrateable: ''
    });
    setSearchTerm('');
  };

  // Verificar si hay algún filtro activo
  const hayFiltrosActivos = filtros.claseGasto || filtros.tipo || filtros.categoria || filtros.estado || filtros.esProrrateable || searchTerm.trim();

  // Obtener badge para clase de gasto
  const getClaseBadge = (clase: ClaseGasto | undefined) => {
    if (!clase) {
      return { label: 'GAO', color: 'bg-gray-100 text-gray-700' };
    }
    if (clase === 'GVD') {
      return { label: 'GVD', color: 'bg-purple-100 text-purple-700' };
    }
    return { label: 'GAO', color: 'bg-blue-100 text-blue-700' };
  };

  // Label dinámico para métricas
  const getViewLabel = () => {
    if (viewMode === 'all') return 'Total General';
    if (viewMode === 'pending') return 'Total Pendiente';
    return `Total ${MONTH_NAMES[selectedMonth - 1]}`;
  };

  // Mostrar skeleton durante carga inicial
  if (loading && gastos.length === 0) {
    return <GastosSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Costos y Gastos</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Gestión de costos de importación, gastos operativos y pérdidas
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <Button
            variant="outline"
            onClick={() => exportService.exportGastos(gastosFiltrados)}
            disabled={gastosFiltrados.length === 0}
            className="flex-shrink-0"
          >
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </Button>
          <Button
            variant="secondary"
            onClick={handleRecalcularCTRU}
            className="flex-shrink-0"
          >
            <TrendingUp className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Recalcular CTRU</span>
          </Button>
          <Button onClick={() => { setGastoParaEditar(null); setShowModal(true); }} className="flex-shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Gasto
          </Button>
        </div>
      </div>

      {/* Navegador de Período */}
      <Card padding="md">
        <div className="flex flex-col gap-3">
          {/* Row 1: Tabs + month nav / label */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Tabs de vista */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
              <button
                onClick={() => setViewMode('month')}
                className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-colors flex items-center justify-center gap-1 sm:gap-1.5 ${
                  viewMode === 'month'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Mensual
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-colors flex items-center justify-center gap-1 sm:gap-1.5 ${
                  viewMode === 'all'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Todos
              </button>
              <button
                onClick={() => setViewMode('pending')}
                className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-colors flex items-center justify-center gap-1 sm:gap-1.5 ${
                  viewMode === 'pending'
                    ? 'bg-amber-50 text-amber-800 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Pendientes
              </button>
            </div>

            {/* Navegación de mes (solo en modo mensual) */}
            {viewMode === 'month' && (
              <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-3">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="text-center min-w-[140px] sm:min-w-[180px]">
                  <span className="text-sm sm:text-lg font-semibold text-gray-900">
                    {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                  </span>
                </div>
                <button
                  onClick={() => navigateMonth('next')}
                  className={`p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors ${
                    isCurrentMonth ? 'opacity-30 cursor-not-allowed' : ''
                  }`}
                  disabled={isCurrentMonth}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                {!isCurrentMonth && (
                  <button
                    onClick={goToCurrentMonth}
                    className="text-xs sm:text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Hoy
                  </button>
                )}
              </div>
            )}

            {/* Label para modos no-mensuales */}
            {viewMode === 'all' && (
              <span className="text-sm sm:text-lg font-semibold text-gray-900 text-center sm:text-right">
                Todos los gastos ({gastos.length})
              </span>
            )}
            {viewMode === 'pending' && (
              <span className="text-sm sm:text-lg font-semibold text-amber-700 text-center sm:text-right">
                Pendientes de pago ({gastos.length})
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Métricas */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Card padding="md">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[11px] sm:text-sm text-gray-600 truncate">{getViewLabel()}</div>
                <div className="text-base sm:text-2xl font-bold text-gray-900 mt-0.5 sm:mt-1 truncate">
                  {formatCurrency(
                    viewMode === 'month' && isCurrentMonth
                      ? stats.totalMesActual
                      : resumenPorTipo.totalGeneral
                  )}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                  {viewMode === 'month' && isCurrentMonth
                    ? `${stats.cantidadGastosMesActual} gastos`
                    : `${gastosFiltrados.length} gastos`
                  }
                </div>
              </div>
              <DollarSign className="h-5 w-5 sm:h-8 sm:w-8 text-gray-400 flex-shrink-0" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[11px] sm:text-sm text-gray-600 truncate"><span className="sm:hidden">Prorrateables</span><span className="hidden sm:inline">Gastos Prorrateables</span></div>
                <div className="text-base sm:text-2xl font-bold text-primary-600 mt-0.5 sm:mt-1 truncate">
                  {formatCurrency(stats.gastosProrrateablesMesActual)}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                  Impactan CTRU
                </div>
              </div>
              <TrendingUp className="h-5 w-5 sm:h-8 sm:w-8 text-primary-400 flex-shrink-0" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[11px] sm:text-sm text-gray-600 truncate"><span className="sm:hidden">Pendientes</span><span className="hidden sm:inline">Pendientes de Pago</span></div>
                <div className="text-base sm:text-2xl font-bold text-warning-600 mt-0.5 sm:mt-1 truncate">
                  {formatCurrency(stats.totalPendientePago)}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                  {stats.cantidadPendientePago} gastos
                </div>
              </div>
              <AlertCircle className="h-5 w-5 sm:h-8 sm:w-8 text-warning-400 flex-shrink-0" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[11px] sm:text-sm text-gray-600 truncate"><span className="sm:hidden">Variación</span><span className="hidden sm:inline">Variación vs Mes Anterior</span></div>
                <div className={`text-base sm:text-2xl font-bold mt-0.5 sm:mt-1 ${
                  stats.variacionVsMesAnterior >= 0 ? 'text-danger-600' : 'text-success-600'
                }`}>
                  {stats.variacionVsMesAnterior >= 0 ? '+' : ''}
                  {stats.variacionVsMesAnterior.toFixed(1)}%
                </div>
                <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">
                  <span className="hidden sm:inline">Promedio anual: </span>{formatCurrency(stats.promedioMensualAnioActual)}
                </div>
              </div>
              {stats.variacionVsMesAnterior >= 0 ? (
                <TrendingUp className="h-5 w-5 sm:h-8 sm:w-8 text-danger-400 flex-shrink-0" />
              ) : (
                <TrendingDown className="h-5 w-5 sm:h-8 sm:w-8 text-success-400 flex-shrink-0" />
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Tabs de Categoría: Gastos del Negocio / Costos de Importación / Pérdidas */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto scrollbar-hide">
        {[
          { id: 'negocio', label: 'Gastos del Negocio', shortLabel: 'Negocio', color: 'text-gray-900', filter: (g: Gasto) => !['flete_internacional', 'flete_usa_peru', 'almacenaje', 'internacion', 'recojo_local'].includes(g.tipo) && !['merma_transferencia', 'merma_vencimiento', 'desmedro'].includes(g.tipo) },
          { id: 'importacion', label: 'Costos de Importación', shortLabel: 'Importación', color: 'text-blue-700', filter: (g: Gasto) => ['flete_internacional', 'flete_usa_peru', 'almacenaje', 'internacion', 'recojo_local'].includes(g.tipo) },
          { id: 'perdidas', label: 'Pérdidas de Inventario', shortLabel: 'Pérdidas', color: 'text-red-700', filter: (g: Gasto) => ['merma_transferencia', 'merma_vencimiento', 'desmedro'].includes(g.tipo) },
        ].map(tab => {
          const count = gastosFiltrados.filter(tab.filter).length;
          const isActive = filtros.claseGasto === '' && !searchTerm
            ? tab.id === 'negocio'
            : count > 0;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'negocio') {
                  setFiltros(prev => ({ ...prev, claseGasto: '' as ClaseGasto | '' }));
                } else if (tab.id === 'importacion') {
                  setFiltros(prev => ({ ...prev, claseGasto: 'GAO' as ClaseGasto }));
                } else {
                  setFiltros(prev => ({ ...prev, claseGasto: '' as ClaseGasto | '' }));
                }
              }}
              className={`flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm rounded-md font-medium transition-colors flex items-center justify-center gap-1.5 ${
                tab.id === 'negocio' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
              {count > 0 && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  tab.id === 'perdidas' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Resumen por Tipo de Gasto */}
      {resumenPorTipo.items.length > 0 && (
        <Card padding="md">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4 sm:h-5 sm:w-5 text-primary-500" />
                <span className="text-sm sm:text-base font-medium text-gray-900">Distribución por Tipo</span>
              </div>
              <span className="text-xs sm:text-sm text-gray-500">
                Total: {formatCurrency(resumenPorTipo.totalGeneral)}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
              {resumenPorTipo.items.map((item, index) => {
                // Colores para las barras de progreso
                const colores = [
                  'bg-primary-500',
                  'bg-success-500',
                  'bg-warning-500',
                  'bg-info-500',
                  'bg-purple-500',
                  'bg-pink-500',
                  'bg-orange-500',
                  'bg-teal-500'
                ];
                const colorBarra = colores[index % colores.length];

                return (
                  <div
                    key={item.tipo}
                    className="bg-gray-50 rounded-lg p-2 sm:p-3 border border-gray-100 hover:border-primary-200 transition-colors cursor-pointer"
                    onClick={() => setFiltros({ ...filtros, tipo: item.tipo as TipoGasto })}
                  >
                    <div className="flex items-center justify-between mb-1 sm:mb-2">
                      <span className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={item.tipo}>
                        {item.tipo}
                      </span>
                      <span className="text-[10px] sm:text-xs text-gray-500 ml-1 flex-shrink-0">
                        {item.cantidad}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm sm:text-lg font-semibold text-gray-900 truncate">
                        {formatCurrency(item.total)}
                      </span>
                      <span className="text-[10px] sm:text-sm font-medium text-gray-600 ml-1 flex-shrink-0">
                        {item.porcentaje.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                      <div
                        className={`${colorBarra} h-1.5 sm:h-2 rounded-full transition-all`}
                        style={{ width: `${Math.min(item.porcentaje, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Búsqueda + Filtros */}
      <Card padding="md">
        <div className="space-y-4">
          {/* Búsqueda */}
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar por descripción, número, proveedor..."
            size="md"
          />

          {/* Filtros */}
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <span className="font-medium text-gray-700">Filtros</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
            <Select
              label="Clase"
              value={filtros.claseGasto}
              onChange={(e) => setFiltros({ ...filtros, claseGasto: e.target.value as ClaseGasto | '' })}
              options={[
                { value: '', label: 'Todas' },
                { value: 'GVD', label: 'GVD - Venta y Distribución' },
                { value: 'GAO', label: 'GAO - Admin. y Operativo' }
              ]}
            />

            <Select
              label="Tipo"
              value={filtros.tipo}
              onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value as TipoGasto | '' })}
              options={[
                { value: '', label: 'Todos' },
                ...tiposUnicos.map(tipo => ({ value: tipo, label: tipo }))
              ]}
            />

            <Select
              label="Categoría"
              value={filtros.categoria}
              onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value as CategoriaGasto | '' })}
              options={[
                { value: '', label: 'Todas' },
                { value: 'GV', label: 'GV - Venta' },
                { value: 'GD', label: 'GD - Distribución' },
                { value: 'GA', label: 'GA - Administrativo' },
                { value: 'GO', label: 'GO - Operativo' }
              ]}
            />

            <Select
              label="Estado"
              value={filtros.estado}
              onChange={(e) => setFiltros({ ...filtros, estado: e.target.value as EstadoGasto | '' })}
              options={[
                { value: '', label: 'Todos' },
                { value: 'pendiente', label: 'Pendiente' },
                { value: 'parcial', label: 'Parcial' },
                { value: 'pagado', label: 'Pagado' },
                { value: 'cancelado', label: 'Cancelado' }
              ]}
            />

            <Select
              label="Prorrateable"
              value={filtros.esProrrateable}
              onChange={(e) => setFiltros({ ...filtros, esProrrateable: e.target.value as 'true' | 'false' | '' })}
              options={[
                { value: '', label: 'Todos' },
                { value: 'true', label: 'Sí (CTRU)' },
                { value: 'false', label: 'No' }
              ]}
            />
          </div>

          {hayFiltrosActivos && (
            <button
              onClick={limpiarFiltros}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </Card>

      {/* Tabla de Gastos */}
      <Card padding="md">
        {loading ? (
          <>
            {/* Mobile skeleton */}
            <div className="md:hidden space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 animate-pulse">
                  <div className="flex justify-between">
                    <div className="flex gap-1.5">
                      <div className="h-4 w-8 bg-gray-200 rounded" />
                      <div className="h-4 w-20 bg-gray-200 rounded" />
                      <div className="h-4 w-14 bg-gray-200 rounded" />
                    </div>
                    <div className="h-5 w-20 bg-gray-200 rounded" />
                  </div>
                  <div className="h-3 w-3/4 bg-gray-200 rounded mt-2" />
                  <div className="flex gap-1.5 mt-2">
                    <div className="h-3 w-8 bg-gray-200 rounded" />
                    <div className="h-3 w-24 bg-gray-200 rounded" />
                    <div className="h-3 w-16 bg-gray-200 rounded ml-auto" />
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop skeleton */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <TableRowSkeleton columns={6} rows={8} />
                </tbody>
              </table>
            </div>
          </>
        ) : gastosFiltrados.length === 0 ? (
          <EmptyStateAction
            title={
              viewMode === 'pending'
                ? 'No hay gastos pendientes'
                : hayFiltrosActivos
                  ? 'No se encontraron gastos'
                  : 'No hay gastos registrados'
            }
            description={
              viewMode === 'pending'
                ? 'Todos los gastos han sido pagados'
                : hayFiltrosActivos
                  ? 'Prueba con otros filtros o limpia los filtros actuales'
                  : viewMode === 'month'
                    ? `No hay gastos en ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
                    : 'Comienza registrando un nuevo gasto operativo'
            }
            variant={hayFiltrosActivos || viewMode === 'pending' ? 'no-results' : 'no-data'}
            icon={hayFiltrosActivos ? 'search' : 'file'}
            actionLabel={hayFiltrosActivos ? 'Limpiar Filtros' : 'Nuevo Gasto'}
            onAction={hayFiltrosActivos ? limpiarFiltros : () => setShowModal(true)}
          />
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="md:hidden space-y-2">
              {gastosFiltrados.map((gasto) => {
                const estadoBadge = getEstadoBadge(gasto.estado);
                const claseBadge = getClaseBadge(gasto.claseGasto);

                return (
                  <div key={gasto.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                    {/* Row 1: Number + badges + amount */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${claseBadge.color}`}>
                            {claseBadge.label}
                          </span>
                          <span className="text-xs font-medium text-gray-900">
                            {gasto.numeroGasto}
                          </span>
                          <Badge variant={estadoBadge.variant}>{estadoBadge.label}</Badge>
                          {gasto.esProrrateable && (
                            <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${gasto.ctruRecalculado ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              CTRU {gasto.ctruRecalculado ? '✓' : '⏳'}
                            </span>
                          )}
                          <GastoLineaBadge lineaNegocioId={gasto.lineaNegocioId} />
                        </div>
                        {gasto.ventaId && (
                          <div className="text-[10px] text-purple-600 mt-0.5">→ Venta vinculada</div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-gray-900">
                          {formatCurrency(gasto.montoPEN)}
                        </div>
                        {gasto.moneda === 'USD' && (
                          <div className="text-[10px] text-gray-500">${gasto.montoOriginal.toFixed(2)}</div>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Description */}
                    <div className="mt-1.5">
                      <div className="text-xs text-gray-900 line-clamp-1">{gasto.descripcion}</div>
                      {gasto.proveedor && (
                        <div className="text-[10px] text-gray-500">{gasto.proveedor}</div>
                      )}
                    </div>

                    {/* Row 3: Tipo + Categoría + Fecha */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getCategoriaColor(gasto.categoria)}`}>
                        {gasto.categoria}
                      </span>
                      <span className="text-[10px] text-gray-600 truncate">{gasto.tipo}</span>
                      <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{formatFecha(gasto.fecha)}</span>
                    </div>

                    {/* Partial payment progress */}
                    {gasto.estado === 'parcial' && gasto.montoPagado !== undefined && (
                      <div className="mt-1.5">
                        <div className="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
                          <span>{((gasto.montoPagado / gasto.montoPEN) * 100).toFixed(0)}% pagado</span>
                          <span>{formatCurrency(gasto.montoPagado)} / {formatCurrency(gasto.montoPEN)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div
                            className="bg-primary-500 h-1 rounded-full transition-all"
                            style={{ width: `${Math.min((gasto.montoPagado / gasto.montoPEN) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
                      {(gasto.estado === 'pendiente' || gasto.estado === 'parcial') && (
                        <button
                          onClick={() => {
                            setGastoParaPago(gasto);
                            setShowPagoModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-md transition-colors"
                        >
                          <CreditCard className="h-3 w-3" />
                          Pagar
                        </button>
                      )}
                      <button
                        onClick={() => handleEditarGasto(gasto)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </button>
                      {(gasto.estado === 'pendiente' || gasto.estado === 'cancelado') && !gasto.pagos?.length && (
                        <button
                          onClick={() => handleEliminarGasto(gasto)}
                          className="inline-flex items-center p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors ml-auto"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                      {gasto.estado === 'pagado' && (
                        <span className="text-[10px] text-gray-400 ml-auto">
                          {gasto.pagos && gasto.pagos.length > 1
                            ? `${gasto.pagos.length} pagos`
                            : gasto.metodoPago || '-'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Número
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Descripción
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tipo / Categoría
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Monto
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      CTRU
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {gastosFiltrados.map((gasto) => {
                    const estadoBadge = getEstadoBadge(gasto.estado);
                    const claseBadge = getClaseBadge(gasto.claseGasto);

                    return (
                      <tr key={gasto.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${claseBadge.color}`}>
                              {claseBadge.label}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {gasto.numeroGasto}
                            </span>
                          </div>
                          {gasto.ventaId && (
                            <div className="text-xs text-purple-600 mt-0.5">
                              → Venta vinculada
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900">{gasto.descripcion}</div>
                          {gasto.proveedor && (
                            <div className="text-xs text-gray-500">{gasto.proveedor}</div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-gray-900">{gasto.tipo}</div>
                            <div className="flex items-center gap-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getCategoriaColor(gasto.categoria)}`}>
                                {gasto.categoria}
                              </span>
                              <span className="text-xs text-gray-500">
                                {CATEGORIAS_GASTO[gasto.categoria]?.nombre || gasto.categoria}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(gasto.montoPEN)}
                          </div>
                          {gasto.moneda === 'USD' && (
                            <div className="text-xs text-gray-500">
                              ${gasto.montoOriginal.toFixed(2)} USD
                            </div>
                          )}
                          {gasto.estado === 'parcial' && gasto.montoPagado !== undefined && (
                            <div className="mt-1">
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className="bg-primary-500 h-1.5 rounded-full transition-all"
                                  style={{ width: `${Math.min((gasto.montoPagado / gasto.montoPEN) * 100, 100)}%` }}
                                />
                              </div>
                              <div className="text-xs text-primary-600 mt-0.5">
                                {((gasto.montoPagado / gasto.montoPEN) * 100).toFixed(0)}% pagado
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <div className="text-sm text-gray-900">
                            {formatFecha(gasto.fecha)}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant={estadoBadge.variant}>{estadoBadge.label}</Badge>
                            <GastoLineaBadge lineaNegocioId={gasto.lineaNegocioId} />
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          {gasto.esProrrateable ? (
                            <Badge variant={gasto.ctruRecalculado ? 'success' : 'warning'}>
                              {gasto.ctruRecalculado ? 'Aplicado' : 'Pendiente'}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1">
                            {(gasto.estado === 'pendiente' || gasto.estado === 'parcial') && (
                              <button
                                onClick={() => {
                                  setGastoParaPago(gasto);
                                  setShowPagoModal(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
                                title={gasto.estado === 'pendiente' ? 'Registrar pago' : 'Registrar pago parcial'}
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                Pagar
                              </button>
                            )}
                            <button
                              onClick={() => handleEditarGasto(gasto)}
                              className="inline-flex items-center p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar gasto"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {(gasto.estado === 'pendiente' || gasto.estado === 'cancelado') && !gasto.pagos?.length && (
                              <button
                                onClick={() => handleEliminarGasto(gasto)}
                                className="inline-flex items-center p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar gasto"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          {gasto.estado === 'parcial' && gasto.montoPagado !== undefined && (
                            <div className="text-xs text-gray-500 mt-1">
                              {formatCurrency(gasto.montoPagado)} / {formatCurrency(gasto.montoPEN)}
                            </div>
                          )}
                          {gasto.estado === 'pagado' && (
                            <div className="text-xs text-gray-400 mt-1">
                              {gasto.pagos && gasto.pagos.length > 1
                                ? `${gasto.pagos.length} pagos`
                                : gasto.metodoPago || '-'}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && gastosFiltrados.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200">
            <ListSummary
              filteredCount={gastosFiltrados.length}
              totalCount={gastos.length}
              itemLabel="gastos"
              summaryItems={[
                {
                  label: 'Total',
                  value: formatCurrency(resumenPorTipo.totalGeneral),
                  icon: 'money',
                  variant: 'default'
                },
                {
                  label: 'Pendientes',
                  value: gastosFiltrados.filter(g => g.estado === 'pendiente' || g.estado === 'parcial').length,
                  icon: 'file',
                  variant: 'warning'
                }
              ]}
            />
          </div>
        )}
      </Card>

      {/* Modal Formulario Nuevo/Editar Gasto */}
      {showModal && (
        <GastoForm
          gastoEditar={gastoParaEditar}
          onClose={() => {
            setShowModal(false);
            setGastoParaEditar(null);
          }}
        />
      )}

      {/* Modal Formulario Pago de Gasto */}
      {showPagoModal && gastoParaPago && (
        <PagoGastoForm
          gasto={gastoParaPago}
          onClose={() => {
            setShowPagoModal(false);
            setGastoParaPago(null);
          }}
          onSuccess={() => {
            setShowPagoModal(false);
            setGastoParaPago(null);
            reloadCurrentView();
            fetchStats();
          }}
        />
      )}

      {/* Dialogo de Confirmacion */}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};
