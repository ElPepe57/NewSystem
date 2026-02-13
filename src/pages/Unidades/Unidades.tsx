import React, { useEffect, useState, useMemo } from 'react';
import {
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  RefreshCw,
  Eye,
  Warehouse,
  Plane,
  ShoppingBag,
  Boxes,
  LayoutGrid,
  List
} from 'lucide-react';
import {
  Card,
  Badge,
  Select,
  Button,
  ListSummary,
  KPIGrid,
  KPICard,
  PipelineHeader,
  SearchInput,
  Pagination,
  GradientHeader,
  StatCard,
  StatDistribution
} from '../../components/common';
import type { PipelineStage } from '../../components/common/PipelineHeader';
import { UnidadDetailsModal, UnidadCard } from '../../components/modules/inventario';
import { useUnidadStore } from '../../store/unidadStore';
import { useProductoStore } from '../../store/productoStore';
import { useAlmacenStore } from '../../store/almacenStore';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { unidadService } from '../../services/unidad.service';
import type { Unidad, EstadoUnidad } from '../../types/unidad.types';

type VistaUnidades = 'cards' | 'tabla';

export const Unidades: React.FC = () => {
  const { unidades, stats, loading, fetchUnidades, fetchStats } = useUnidadStore();
  const { productos, fetchProductos } = useProductoStore();
  const { almacenes, fetchAlmacenes } = useAlmacenStore();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  const [filtros, setFiltros] = useState({
    productoId: '',
    almacenId: '',
    estado: '' as EstadoUnidad | '',
    pais: '' as 'USA' | 'Peru' | ''
  });
  const [filtroEstadoPipeline, setFiltroEstadoPipeline] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [sincronizando, setSincronizando] = useState(false);
  const [unidadSeleccionada, setUnidadSeleccionada] = useState<Unidad | null>(null);
  const [vistaActual, setVistaActual] = useState<VistaUnidades>('tabla');

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);

  useEffect(() => {
    fetchUnidades();
    fetchStats();
    fetchProductos();
    fetchAlmacenes();
  }, [fetchUnidades, fetchStats, fetchProductos, fetchAlmacenes]);

  // Calcular estadísticas para el pipeline desde las unidades (fuente única de verdad)
  const unidadesStats = useMemo(() => {
    let recibidaUSA = 0;
    let enTransitoUSA = 0;
    let enTransitoPeru = 0;
    let disponiblePeru = 0;
    let reservada = 0;
    let vendida = 0;
    let problemas = 0;
    let valorTotalUSD = 0;
    let proximasAVencer = 0;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    unidades.forEach(u => {
      valorTotalUSD += u.costoUnitarioUSD || 0;

      switch (u.estado) {
        case 'recibida_usa':
          recibidaUSA++;
          break;
        case 'en_transito_usa':
          enTransitoUSA++;
          break;
        case 'en_transito_peru':
          enTransitoPeru++;
          break;
        case 'disponible_peru':
          disponiblePeru++;
          break;
        case 'reservada':
          reservada++;
          break;
        case 'vendida':
          vendida++;
          break;
        case 'vencida':
        case 'danada':
          problemas++;
          break;
      }

      // Contar próximas a vencer (30 días)
      if (u.fechaVencimiento?.toDate && u.estado !== 'vendida') {
        const vencimiento = u.fechaVencimiento.toDate();
        vencimiento.setHours(0, 0, 0, 0);
        const diffDias = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDias >= 0 && diffDias <= 30) {
          proximasAVencer++;
        }
      }
    });

    const enTransito = enTransitoUSA + enTransitoPeru;
    const totalActivo = recibidaUSA + enTransito + disponiblePeru + reservada;

    return {
      recibidaUSA,
      enTransitoUSA,
      enTransitoPeru,
      enTransito,
      disponiblePeru,
      reservada,
      vendida,
      problemas,
      total: unidades.length,
      totalActivo,
      valorTotalUSD,
      proximasAVencer
    };
  }, [unidades]);

  // Pipeline stages para el PipelineHeader
  const pipelineStages: PipelineStage[] = useMemo(() => [
    {
      id: 'recibida_usa',
      label: 'USA',
      count: unidadesStats.recibidaUSA,
      color: 'blue',
      icon: <Warehouse className="h-4 w-4" />
    },
    {
      id: 'en_transito',
      label: 'En Tránsito',
      count: unidadesStats.enTransito,
      color: 'yellow',
      icon: <Plane className="h-4 w-4" />
    },
    {
      id: 'disponible_peru',
      label: 'Perú',
      count: unidadesStats.disponiblePeru,
      color: 'green',
      icon: <CheckCircle className="h-4 w-4" />
    },
    {
      id: 'reservada',
      label: 'Reservadas',
      count: unidadesStats.reservada,
      color: 'purple',
      icon: <ShoppingBag className="h-4 w-4" />
    },
    {
      id: 'vendida',
      label: 'Vendidas',
      count: unidadesStats.vendida,
      color: 'gray',
      icon: <CheckCircle className="h-4 w-4" />
    },
    {
      id: 'problemas',
      label: 'Problemas',
      count: unidadesStats.problemas,
      color: 'red',
      icon: <AlertTriangle className="h-4 w-4" />
    }
  ], [unidadesStats]);

  // Aplicar filtros y búsqueda
  const unidadesFiltradas = useMemo(() => {
    return unidades.filter(unidad => {
      // Filtro por pipeline (prioridad)
      if (filtroEstadoPipeline) {
        switch (filtroEstadoPipeline) {
          case 'recibida_usa':
            if (unidad.estado !== 'recibida_usa') return false;
            break;
          case 'en_transito':
            if (unidad.estado !== 'en_transito_usa' && unidad.estado !== 'en_transito_peru') return false;
            break;
          case 'disponible_peru':
            if (unidad.estado !== 'disponible_peru') return false;
            break;
          case 'reservada':
            if (unidad.estado !== 'reservada') return false;
            break;
          case 'vendida':
            if (unidad.estado !== 'vendida') return false;
            break;
          case 'problemas':
            if (unidad.estado !== 'vencida' && unidad.estado !== 'danada') return false;
            break;
        }
      }

      // Búsqueda por texto
      if (busqueda) {
        const term = busqueda.toLowerCase();
        const matchSearch =
          unidad.productoSKU?.toLowerCase().includes(term) ||
          unidad.productoNombre?.toLowerCase().includes(term) ||
          unidad.lote?.toLowerCase().includes(term) ||
          unidad.almacenNombre?.toLowerCase().includes(term);
        if (!matchSearch) return false;
      }

      if (filtros.productoId && unidad.productoId !== filtros.productoId) return false;
      if (filtros.almacenId && unidad.almacenId !== filtros.almacenId) return false;
      if (filtros.estado && unidad.estado !== filtros.estado) return false;
      if (filtros.pais && unidad.pais !== filtros.pais) return false;
      return true;
    });
  }, [unidades, filtros, busqueda, filtroEstadoPipeline]);

  // Paginación
  const unidadesPaginadas = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return unidadesFiltradas.slice(startIndex, startIndex + pageSize);
  }, [unidadesFiltradas, currentPage, pageSize]);

  // Reset página cuando cambian filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [filtros, busqueda, filtroEstadoPipeline]);

  const limpiarFiltros = () => {
    setFiltros({
      productoId: '',
      almacenId: '',
      estado: '',
      pais: ''
    });
    setBusqueda('');
    setFiltroEstadoPipeline(null);
    setCurrentPage(1);
  };

  // Sincronizar unidades huérfanas (sin venta válida)
  const handleSincronizar = async () => {
    setSincronizando(true);
    try {
      const resultado = await unidadService.sincronizarUnidadesHuerfanas();

      if (resultado.unidadesSincronizadas > 0) {
        addToast('success', `Se sincronizaron ${resultado.unidadesSincronizadas} unidades huérfanas`, 5000);
        // Recargar datos
        fetchUnidades();
        fetchStats();
      } else {
        addToast('success', 'No hay unidades huérfanas para sincronizar');
      }

      // Log detalle para debugging
      if (resultado.detalle.length > 0) {
        console.log('[Sincronización] Detalle:', resultado.detalle);
      }
    } catch (error: any) {
      console.error('Error sincronizando:', error);
      addToast('error', `Error al sincronizar: ${error.message}`);
    } finally {
      setSincronizando(false);
    }
  };

  // Función para obtener el badge de estado
  const getEstadoBadge = (estado: EstadoUnidad | string) => {
    const badges: Record<string, { variant: 'success' | 'info' | 'warning' | 'default' | 'danger'; label: string }> = {
      // Estados en USA
      'recibida_usa': { variant: 'success', label: 'Recibida USA' },
      'en_transito_usa': { variant: 'info', label: 'En Tránsito USA' },
      // Estados en tránsito a Perú
      'en_transito_peru': { variant: 'info', label: 'En Tránsito → Perú' },
      // Estados en Perú
      'disponible_peru': { variant: 'success', label: 'Disponible Perú' },
      'reservada': { variant: 'warning', label: 'Reservada' },
      'vendida': { variant: 'default', label: 'Vendida' },
      // Estados especiales
      'vencida': { variant: 'danger', label: 'Vencida' },
      'danada': { variant: 'danger', label: 'Dañada' },
      // Estados legacy (para mostrar mientras no se sincronicen)
      'entregada': { variant: 'warning', label: 'Entregada (sync)' },
      'asignada_pedido': { variant: 'warning', label: 'Asignada (sync)' }
    };
    return badges[estado] || { variant: 'default' as const, label: estado || 'Desconocido' };
  };

  // Función para calcular días para vencer
  const calcularDiasParaVencer = (unidad: Unidad): number => {
    if (!unidad?.fechaVencimiento) {
      return 0;
    }
    return unidadService.calcularDiasParaVencer(unidad.fechaVencimiento);
  };

  // Función para obtener color según días para vencer
  const getColorVencimiento = (dias: number): string => {
    if (dias < 0) return 'text-danger-600';
    if (dias <= 30) return 'text-warning-600';
    if (dias <= 90) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const formatFecha = (timestamp: any): string => {
    if (!timestamp || !timestamp.toDate) {
      return '-';
    }
    return timestamp.toDate().toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const hayFiltrosActivos = busqueda || filtros.productoId || filtros.almacenId || filtros.estado || filtros.pais || filtroEstadoPipeline;

  return (
    <div className="space-y-6">
      {/* Header Profesional con Gradiente */}
      <GradientHeader
        title="Unidades"
        subtitle="Fuente única de verdad - Trazabilidad FEFO (First Expired, First Out)"
        icon={Boxes}
        variant="dark"
        actions={
          <Button
            variant="ghost"
            onClick={handleSincronizar}
            disabled={sincronizando}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <RefreshCw className={`h-5 w-5 ${sincronizando ? 'animate-spin' : ''}`} />
          </Button>
        }
        stats={[
          { label: 'Total', value: unidadesStats.total },
          { label: 'USA', value: unidadesStats.recibidaUSA + unidadesStats.enTransitoUSA },
          { label: 'Perú', value: unidadesStats.disponiblePeru },
          { label: 'Vendidas', value: unidadesStats.vendida }
        ]}
      />

      {/* StatCards interactivos */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          label="Total Unidades"
          value={unidadesStats.total}
          icon={Package}
          variant="blue"
        />
        <StatCard
          label="Valor USD"
          value={formatCurrency(unidadesStats.valorTotalUSD)}
          icon={DollarSign}
          variant="green"
        />
        <StatCard
          label="En USA"
          value={unidadesStats.recibidaUSA + unidadesStats.enTransitoUSA}
          icon={Warehouse}
          variant="blue"
          onClick={() => setFiltros(prev => ({ ...prev, pais: prev.pais === 'USA' ? '' : 'USA' }))}
          active={filtros.pais === 'USA'}
        />
        <StatCard
          label="En Tránsito"
          value={unidadesStats.enTransitoPeru}
          icon={Plane}
          variant="amber"
          onClick={() => setFiltroEstadoPipeline(filtroEstadoPipeline === 'en_transito_peru' ? null : 'en_transito_peru')}
          active={filtroEstadoPipeline === 'en_transito_peru'}
        />
        <StatCard
          label="En Perú"
          value={unidadesStats.disponiblePeru}
          icon={CheckCircle}
          variant="green"
          onClick={() => setFiltros(prev => ({ ...prev, pais: prev.pais === 'Peru' ? '' : 'Peru' }))}
          active={filtros.pais === 'Peru'}
        />
        <StatCard
          label="Por Vencer"
          value={unidadesStats.proximasAVencer}
          icon={Clock}
          variant={unidadesStats.proximasAVencer > 0 ? 'red' : 'default'}
        />
      </div>

      {/* Distribución Visual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatDistribution
          title="Distribución por Ubicación"
          data={[
            { label: 'USA', value: unidadesStats.recibidaUSA + unidadesStats.enTransitoUSA, color: 'bg-blue-500' },
            { label: 'En Tránsito → Perú', value: unidadesStats.enTransitoPeru, color: 'bg-amber-500' },
            { label: 'Perú', value: unidadesStats.disponiblePeru, color: 'bg-green-500' },
            { label: 'Reservadas', value: unidadesStats.reservada, color: 'bg-purple-500' }
          ]}
        />
        <StatDistribution
          title="Estado de Unidades"
          data={[
            { label: 'Disponibles', value: unidadesStats.recibidaUSA + unidadesStats.disponiblePeru, color: 'bg-green-500' },
            { label: 'En Movimiento', value: unidadesStats.enTransitoUSA + unidadesStats.enTransitoPeru, color: 'bg-blue-500' },
            { label: 'Vendidas', value: unidadesStats.vendida, color: 'bg-gray-400' },
            { label: 'Problemas', value: unidadesStats.problemas, color: 'bg-red-500' }
          ]}
        />
      </div>

      {/* Pipeline de Estados */}
      <PipelineHeader
        title="Estado de Unidades"
        stages={pipelineStages}
        activeStage={filtroEstadoPipeline}
        onStageClick={setFiltroEstadoPipeline}
      />

      {/* Búsqueda y Filtros */}
      <Card padding="md">
        <div className="space-y-4">
          {/* Barra de búsqueda y toggle */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <SearchInput
                value={busqueda}
                onChange={setBusqueda}
                placeholder="Buscar por SKU, nombre, lote o almacén..."
              />
            </div>

            {/* Toggle de vista */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Vista:</span>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  onClick={() => setVistaActual('cards')}
                  className={`p-2 ${
                    vistaActual === 'cards'
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                  title="Vista de tarjetas"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setVistaActual('tabla')}
                  className={`p-2 ${
                    vistaActual === 'tabla'
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                  title="Vista de tabla"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              label="Producto"
              value={filtros.productoId}
              onChange={(e) => setFiltros({ ...filtros, productoId: e.target.value })}
              options={[
                { value: '', label: 'Todos los productos' },
                ...productos.map(p => ({
                  value: p.id,
                  label: `${p.sku} - ${p.nombreComercial}`
                }))
              ]}
            />

            <Select
              label="Almacén"
              value={filtros.almacenId}
              onChange={(e) => setFiltros({ ...filtros, almacenId: e.target.value })}
              options={[
                { value: '', label: 'Todos los almacenes' },
                ...almacenes.map(a => ({
                  value: a.id,
                  label: `${a.pais === 'USA' ? '🇺🇸' : '🇵🇪'} ${a.nombre}`
                }))
              ]}
            />

            <Select
              label="Estado"
              value={filtros.estado}
              onChange={(e) => setFiltros({ ...filtros, estado: e.target.value as EstadoUnidad | '' })}
              options={[
                { value: '', label: 'Todos los estados' },
                { value: 'recibida_usa', label: 'Recibida USA' },
                { value: 'en_transito_usa', label: 'En Tránsito USA' },
                { value: 'en_transito_peru', label: 'En Tránsito → Perú' },
                { value: 'disponible_peru', label: 'Disponible Perú' },
                { value: 'reservada', label: 'Reservada' },
                { value: 'vendida', label: 'Vendida' },
                { value: 'vencida', label: 'Vencida' },
                { value: 'danada', label: 'Dañada' }
              ]}
            />

            <Select
              label="País"
              value={filtros.pais}
              onChange={(e) => setFiltros({ ...filtros, pais: e.target.value as 'USA' | 'Peru' | '' })}
              options={[
                { value: '', label: 'Todos los países' },
                { value: 'USA', label: '🇺🇸 USA' },
                { value: 'Peru', label: '🇵🇪 Perú' }
              ]}
            />
          </div>

          {/* Contador de resultados */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Mostrando <span className="font-medium">{unidadesPaginadas.length}</span> de{' '}
              <span className="font-medium">{unidadesFiltradas.length}</span> unidades
              {unidadesFiltradas.length !== unidades.length && ` (${unidades.length} total)`}
            </span>
            {hayFiltrosActivos && (
              <button
                onClick={limpiarFiltros}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Contenido según vista */}
      {vistaActual === 'cards' ? (
        /* Vista de Cards */
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {loading ? (
              <div className="col-span-full flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : unidadesPaginadas.length === 0 ? (
              <div className="col-span-full">
                <Card padding="lg">
                  <div className="text-center py-8">
                    <Package className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No hay unidades</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Las unidades se crean automáticamente al recibir órdenes de compra
                    </p>
                  </div>
                </Card>
              </div>
            ) : (
              unidadesPaginadas.map((unidad) => (
                <UnidadCard
                  key={unidad.id}
                  unidad={unidad}
                  onVerDetalle={() => setUnidadSeleccionada(unidad)}
                />
              ))
            )}
          </div>

          {/* Paginación para Cards */}
          {!loading && unidadesFiltradas.length > 0 && (
            <Card padding="sm">
              <Pagination
                currentPage={currentPage}
                totalItems={unidadesFiltradas.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[12, 24, 48, 96]}
                showPageSizeSelector
                showItemsInfo
              />
            </Card>
          )}
        </>
      ) : (
        /* Vista de Tabla */
        <Card padding="md">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : unidadesFiltradas.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay unidades</h3>
              <p className="mt-1 text-sm text-gray-500">
                Las unidades se crean automáticamente al recibir órdenes de compra
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Lote
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Vencimiento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Almacén
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Costo USD
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {unidadesPaginadas.map((unidad) => {
                    if (!unidad || !unidad.estado) return null;

                    const diasVencer = calcularDiasParaVencer(unidad);
                    const estadoBadge = getEstadoBadge(unidad.estado);

                    return (
                      <tr key={unidad.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {unidad.productoSKU || '-'}
                            </div>
                            <div className="text-sm text-gray-500">{unidad.productoNombre || '-'}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{unidad.lote || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatFecha(unidad.fechaVencimiento)}
                          </div>
                          <div className={`text-xs font-medium ${getColorVencimiento(diasVencer)}`}>
                            {diasVencer < 0
                              ? `Vencido hace ${Math.abs(diasVencer)} días`
                              : `${diasVencer} días`}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {unidad.pais === 'USA' ? '🇺🇸' : '🇵🇪'} {unidad.almacenNombre || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={estadoBadge.variant}>{estadoBadge.label}</Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {formatCurrency(unidad.costoUnitarioUSD || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => setUnidadSeleccionada(unidad)}
                            className="p-1.5 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && unidadesFiltradas.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 space-y-4">
              <ListSummary
                filteredCount={unidadesFiltradas.length}
                totalCount={unidades.length}
                itemLabel="unidades"
                summaryItems={[
                  {
                    label: 'Valor Total',
                    value: `$${unidadesFiltradas.reduce((sum, u) => sum + (u.costoUnitarioUSD || 0), 0).toFixed(2)}`,
                    icon: 'money',
                    variant: 'info'
                  },
                  {
                    label: 'Disponibles',
                    value: unidadesFiltradas.filter(u => u.estado === 'disponible_peru' || u.estado === 'recibida_usa').length,
                    icon: 'package',
                    variant: 'success'
                  },
                  {
                    label: 'Reservadas',
                    value: unidadesFiltradas.filter(u => u.estado === 'reservada').length,
                    icon: 'package',
                    variant: 'warning'
                  }
                ]}
              />
              <Pagination
                currentPage={currentPage}
                totalItems={unidadesFiltradas.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[25, 50, 100, 200]}
                showPageSizeSelector
                showItemsInfo
              />
            </div>
          )}
        </Card>
      )}

      {/* Modal de Detalles de Unidad */}
      {unidadSeleccionada && (
        <UnidadDetailsModal
          unidad={unidadSeleccionada}
          onClose={() => setUnidadSeleccionada(null)}
          onLiberarReserva={async (unidad) => {
            if (!user) return;
            const confirmar = window.confirm(
              `¿Liberar la reserva de la unidad ${unidad.lote}?\n\nLa unidad volverá al estado "Disponible Perú" y podrá ser asignada a otra cotización.`
            );
            if (!confirmar) return;
            try {
              const resultado = await unidadService.liberarUnidades(
                [unidad.id],
                'Liberación manual desde detalle de unidad',
                user.uid
              );
              if (resultado.exitos > 0) {
                addToast('Reserva liberada exitosamente', 'success');
                setUnidadSeleccionada(null);
                await fetchUnidades();
                await fetchStats();
              } else {
                addToast('No se pudo liberar la reserva', 'error');
              }
            } catch (error: any) {
              addToast(error.message || 'Error al liberar reserva', 'error');
            }
          }}
        />
      )}
    </div>
  );
};
