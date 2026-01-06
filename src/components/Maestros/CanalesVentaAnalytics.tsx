import React, { useEffect, useState, useMemo } from 'react';
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
  TrendingDown,
  DollarSign,
  Package,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Zap,
  Clock,
  Crown
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
  StatDistribution
} from '../common';
import { CanalVentaForm } from '../modules/canalVenta/CanalVentaForm';
import { CanalVentaDetailView } from './CanalVentaDetailView';
import { useCanalVentaStore } from '../../store/canalVentaStore';
import { useVentaStore } from '../../store/ventaStore';
import { useAuthStore } from '../../store/authStore';
import type { CanalVenta, CanalVentaFormData } from '../../types/canalVenta.types';
import type { Venta } from '../../types/venta.types';

interface CanalesVentaAnalyticsProps {
  onViewCanal?: (canal: CanalVenta) => void;
}

// Sub-tabs
type SubTabCanales = 'lista' | 'dashboard' | 'rendimiento';

// Mapeo de nombres de icono a componentes
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Store: Store,
  ShoppingBag: ShoppingBag,
  MessageCircle: MessageCircle,
  Globe: Globe,
  Tag: Tag,
  MoreHorizontal: MoreHorizontal
};

// Interfaz para métricas de canal
interface CanalMetrics {
  canalId: string;
  nombre: string;
  color: string;
  icono?: string;

  // Volumen
  totalVentas: number;
  totalCotizaciones: number;
  tasaConversion: number;

  // Financiero
  montoTotal: number;
  comisionTotal: number;
  margenPromedio: number;
  ticketPromedio: number;

  // Tendencia (vs mes anterior)
  tendenciaVentas: number;
  tendenciaMonto: number;
}

export const CanalesVentaAnalytics: React.FC<CanalesVentaAnalyticsProps> = ({
  onViewCanal
}) => {
  const user = useAuthStore(state => state.user);
  const {
    canales,
    loading: loadingCanales,
    initialized,
    fetchCanales,
    createCanal,
    updateCanal,
    cambiarEstado,
    inicializarCanalesSistema
  } = useCanalVentaStore();

  const {
    ventas,
    loading: loadingVentas,
    fetchVentas
  } = useVentaStore();

  const [subTab, setSubTab] = useState<SubTabCanales>('dashboard');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCanal, setEditingCanal] = useState<CanalVenta | null>(null);
  const [canalDetalle, setCanalDetalle] = useState<CanalVenta | null>(null);
  const [activeTab, setActiveTab] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCanales();
    fetchVentas();
  }, [fetchCanales, fetchVentas]);

  // Inicializar canales del sistema si no hay ninguno
  useEffect(() => {
    if (initialized && canales.length === 0 && user) {
      inicializarCanalesSistema(user.uid);
    }
  }, [initialized, canales.length, user, inicializarCanalesSistema]);

  // ============================================
  // CÁLCULO DE MÉTRICAS POR CANAL
  // ============================================

  const metricas = useMemo(() => {
    const now = new Date();
    const mesActual = new Date(now.getFullYear(), now.getMonth(), 1);
    const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const finMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0);

    const metricasPorCanal: Record<string, CanalMetrics> = {};

    // Inicializar métricas para todos los canales
    canales.forEach(canal => {
      metricasPorCanal[canal.id] = {
        canalId: canal.id,
        nombre: canal.nombre,
        color: canal.color || '#6b7280',
        icono: canal.icono,
        totalVentas: 0,
        totalCotizaciones: 0,
        tasaConversion: 0,
        montoTotal: 0,
        comisionTotal: 0,
        margenPromedio: 0,
        ticketPromedio: 0,
        tendenciaVentas: 0,
        tendenciaMonto: 0
      };
    });

    // Procesar ventas
    ventas.forEach(venta => {
      const canal = canales.find(c => c.id === venta.canal || c.codigo === venta.canal);
      if (!canal) return;

      const fechaVenta = venta.fechaCreacion?.toDate?.() || new Date(venta.fechaCreacion as any);
      const esVentaReal = venta.estado !== 'cotizacion' && venta.estado !== 'cancelada';
      const esMesActual = fechaVenta >= mesActual;
      const esMesAnterior = fechaVenta >= mesAnterior && fechaVenta <= finMesAnterior;

      const metrics = metricasPorCanal[canal.id];
      if (!metrics) return;

      // Contar cotizaciones y ventas
      if (venta.estado === 'cotizacion') {
        metrics.totalCotizaciones++;
      } else if (esVentaReal) {
        metrics.totalVentas++;
        metrics.montoTotal += venta.totalPEN || 0;

        // Calcular comisión
        const comision = canal.comisionPorcentaje
          ? (venta.totalPEN || 0) * (canal.comisionPorcentaje / 100)
          : 0;
        metrics.comisionTotal += comision;

        // Margen
        if (venta.margenNeto !== undefined) {
          metrics.margenPromedio += venta.margenNeto;
        } else if (venta.margenBruto !== undefined) {
          metrics.margenPromedio += venta.margenBruto;
        }

        // Tendencias (mes actual vs mes anterior)
        if (esMesActual) {
          metrics.tendenciaVentas++;
          metrics.tendenciaMonto += venta.totalPEN || 0;
        }
      }
    });

    // Calcular promedios y tendencias
    Object.values(metricasPorCanal).forEach(metrics => {
      // Tasa de conversión
      if (metrics.totalCotizaciones > 0) {
        metrics.tasaConversion = (metrics.totalVentas / (metrics.totalVentas + metrics.totalCotizaciones)) * 100;
      }

      // Ticket promedio
      if (metrics.totalVentas > 0) {
        metrics.ticketPromedio = metrics.montoTotal / metrics.totalVentas;
        metrics.margenPromedio = metrics.margenPromedio / metrics.totalVentas;
      }

      // Calcular tendencias (simplificado - en producción comparar con mes anterior real)
      // Aquí asumimos que el mes anterior tuvo similar actividad
      const ventasMesAnteriorEstimado = metrics.totalVentas * 0.8; // Placeholder
      const montoMesAnteriorEstimado = metrics.montoTotal * 0.8; // Placeholder

      if (ventasMesAnteriorEstimado > 0) {
        metrics.tendenciaVentas = ((metrics.tendenciaVentas - ventasMesAnteriorEstimado) / ventasMesAnteriorEstimado) * 100;
      }
      if (montoMesAnteriorEstimado > 0) {
        metrics.tendenciaMonto = ((metrics.tendenciaMonto - montoMesAnteriorEstimado) / montoMesAnteriorEstimado) * 100;
      }
    });

    return metricasPorCanal;
  }, [canales, ventas]);

  // ============================================
  // ESTADÍSTICAS GLOBALES
  // ============================================

  const statsGlobales = useMemo(() => {
    const totalCanales = canales.length;
    const canalesActivos = canales.filter(c => c.estado === 'activo').length;
    const canalesConComision = canales.filter(c => (c.comisionPorcentaje || 0) > 0).length;

    const comisionPromedio = canales.length > 0
      ? canales.reduce((sum, c) => sum + (c.comisionPorcentaje || 0), 0) / canales.length
      : 0;

    const metricasArray = Object.values(metricas);
    const totalVentas = metricasArray.reduce((sum, m) => sum + m.totalVentas, 0);
    const totalCotizaciones = metricasArray.reduce((sum, m) => sum + m.totalCotizaciones, 0);
    const montoTotal = metricasArray.reduce((sum, m) => sum + m.montoTotal, 0);
    const comisionTotal = metricasArray.reduce((sum, m) => sum + m.comisionTotal, 0);

    // Tasa de conversión global (cotizaciones a ventas)
    const totalOportunidades = totalVentas + totalCotizaciones;
    const tasaConversionGlobal = totalOportunidades > 0
      ? (totalVentas / totalOportunidades) * 100
      : 0;

    // ROI neto (ingresos - comisiones)
    const roiNeto = montoTotal - comisionTotal;

    // Ticket promedio global
    const ticketPromedioGlobal = totalVentas > 0 ? montoTotal / totalVentas : 0;

    // Canal top (por monto)
    const canalTop = metricasArray.length > 0
      ? metricasArray.reduce((max, m) => m.montoTotal > max.montoTotal ? m : max)
      : null;

    // Canal con mejor conversión (mínimo 3 oportunidades)
    const canalesConOportunidades = metricasArray.filter(m => (m.totalVentas + m.totalCotizaciones) >= 3);
    const mejorConversion = canalesConOportunidades.length > 0
      ? canalesConOportunidades.reduce((max, m) => m.tasaConversion > max.tasaConversion ? m : max)
      : null;

    // Canal con mejor ticket promedio (mínimo 1 venta)
    const canalesConVentas = metricasArray.filter(m => m.totalVentas > 0);
    const mejorTicket = canalesConVentas.length > 0
      ? canalesConVentas.reduce((max, m) => m.ticketPromedio > max.ticketPromedio ? m : max)
      : null;

    return {
      totalCanales,
      canalesActivos,
      canalesConComision,
      comisionPromedio,
      totalVentas,
      totalCotizaciones,
      montoTotal,
      comisionTotal,
      tasaConversionGlobal,
      roiNeto,
      ticketPromedioGlobal,
      canalTop,
      mejorConversion,
      mejorTicket
    };
  }, [canales, metricas]);

  // ============================================
  // DISTRIBUCIONES
  // ============================================

  const distribuciones = useMemo(() => {
    // Por estado
    const activosCount = canales.filter(c => c.estado === 'activo').length;
    const inactivosCount = canales.filter(c => c.estado === 'inactivo').length;

    const porEstado = [
      {
        label: 'Activos',
        value: activosCount,
        color: 'bg-green-500'
      },
      {
        label: 'Inactivos',
        value: inactivosCount,
        color: 'bg-gray-500'
      }
    ];

    // Por comisión
    const conComision = canales.filter(c => (c.comisionPorcentaje || 0) > 0).length;
    const sinComision = canales.filter(c => (c.comisionPorcentaje || 0) === 0).length;

    const porComision = [
      {
        label: 'Con comisión',
        value: conComision,
        color: 'bg-amber-500'
      },
      {
        label: 'Sin comisión',
        value: sinComision,
        color: 'bg-green-500'
      }
    ];

    // Por ventas (top 5 canales)
    const porVentas = Object.values(metricas)
      .sort((a, b) => b.montoTotal - a.montoTotal)
      .slice(0, 5)
      .map(m => ({
        label: m.nombre,
        value: m.totalVentas,
        color: 'bg-blue-500'
      }));

    // Por conversión (canales con mejor tasa de conversión)
    const porConversion = Object.values(metricas)
      .filter(m => (m.totalVentas + m.totalCotizaciones) > 0)
      .sort((a, b) => b.tasaConversion - a.tasaConversion)
      .slice(0, 5)
      .map(m => ({
        label: m.nombre,
        value: Math.round(m.tasaConversion),
        color: m.tasaConversion >= 70 ? 'bg-green-500' : m.tasaConversion >= 40 ? 'bg-amber-500' : 'bg-red-500'
      }));

    // Por ticket promedio (top 5)
    const porTicket = Object.values(metricas)
      .filter(m => m.totalVentas > 0)
      .sort((a, b) => b.ticketPromedio - a.ticketPromedio)
      .slice(0, 5)
      .map(m => ({
        label: m.nombre,
        value: Math.round(m.ticketPromedio),
        color: 'bg-purple-500'
      }));

    return { porEstado, porComision, porVentas, porConversion, porTicket };
  }, [canales, metricas, statsGlobales.totalVentas]);

  // ============================================
  // HANDLERS
  // ============================================

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

  // ============================================
  // FILTROS
  // ============================================

  const canalesFiltrados = useMemo(() => {
    let filtered = canales;

    // Filtro por búsqueda
    if (busqueda) {
      filtered = filtered.filter(c =>
        c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
      );
    }

    // Filtro por tab
    switch (activeTab) {
      case 'activos':
        filtered = filtered.filter(c => c.estado === 'activo');
        break;
      case 'inactivos':
        filtered = filtered.filter(c => c.estado === 'inactivo');
        break;
      default:
        break;
    }

    return filtered;
  }, [canales, busqueda, activeTab]);

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderIcon = (iconName?: string, color?: string) => {
    const IconComponent = iconMap[iconName || 'Tag'] || Tag;
    return (
      <span style={{ color: color || '#6b7280' }}>
        <IconComponent className="h-5 w-5" />
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // ============================================
  // LOADING STATE
  // ============================================

  if ((loadingCanales || loadingVentas) && canales.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header con tabs */}
      <div className="flex items-center justify-between">
        <TabNavigation
          tabs={[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'lista', label: 'Lista de Canales', icon: Tag },
            { id: 'rendimiento', label: 'Rendimiento', icon: Activity }
          ]}
          activeTab={subTab}
          onTabChange={(tab: string) => setSubTab(tab as SubTabCanales)}
        />
        <Button variant="primary" onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Canal
        </Button>
      </div>

      {/* ========================================== */}
      {/* TAB: DASHBOARD */}
      {/* ========================================== */}
      {subTab === 'dashboard' && (
        <div className="space-y-6">
          {/* KPIs Principales - Ventas */}
          <KPIGrid columns={5}>
            <KPICard
              title="Facturación Total"
              value={formatCurrency(statsGlobales.montoTotal)}
              icon={DollarSign}
              variant="success"
              subtitle={`${statsGlobales.totalVentas} ventas`}
            />
            <KPICard
              title="Tasa Conversión"
              value={`${statsGlobales.tasaConversionGlobal.toFixed(1)}%`}
              icon={Target}
              variant={statsGlobales.tasaConversionGlobal >= 50 ? 'success' : statsGlobales.tasaConversionGlobal >= 30 ? 'warning' : 'danger'}
              subtitle={`${statsGlobales.totalVentas} de ${statsGlobales.totalVentas + statsGlobales.totalCotizaciones}`}
            />
            <KPICard
              title="Ticket Promedio"
              value={formatCurrency(statsGlobales.ticketPromedioGlobal)}
              icon={ShoppingBag}
              variant="info"
            />
            <KPICard
              title="Comisiones Pagadas"
              value={formatCurrency(statsGlobales.comisionTotal)}
              icon={Percent}
              variant="warning"
              subtitle={`${statsGlobales.comisionPromedio.toFixed(1)}% promedio`}
            />
            <KPICard
              title="Ingreso Neto"
              value={formatCurrency(statsGlobales.roiNeto)}
              icon={TrendingUp}
              variant="success"
              subtitle="facturación - comisiones"
            />
          </KPIGrid>

          {/* KPIs de Canales */}
          <KPIGrid columns={4}>
            <KPICard
              title="Total Canales"
              value={statsGlobales.totalCanales}
              icon={Tag}
              variant="info"
              subtitle={`${statsGlobales.canalesActivos} activos`}
            />
            <KPICard
              title="Canal Top (Ventas)"
              value={statsGlobales.canalTop?.nombre || 'N/A'}
              icon={Crown}
              variant="success"
              subtitle={statsGlobales.canalTop ? formatCurrency(statsGlobales.canalTop.montoTotal) : ''}
            />
            <KPICard
              title="Mejor Conversión"
              value={statsGlobales.mejorConversion?.nombre || 'N/A'}
              icon={Target}
              variant="info"
              subtitle={statsGlobales.mejorConversion ? `${statsGlobales.mejorConversion.tasaConversion.toFixed(0)}%` : ''}
            />
            <KPICard
              title="Mejor Ticket"
              value={statsGlobales.mejorTicket?.nombre || 'N/A'}
              icon={Zap}
              variant="warning"
              subtitle={statsGlobales.mejorTicket ? formatCurrency(statsGlobales.mejorTicket.ticketPromedio) : ''}
            />
          </KPIGrid>

          {/* Sección de Conversión por Canal */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary-600" />
              Análisis de Conversión por Canal
            </h3>
            {Object.values(metricas).filter(m => (m.totalVentas + m.totalCotizaciones) > 0).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Canal</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cotizaciones</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ventas</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tasa Conversión</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Facturación</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ticket Prom.</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.values(metricas)
                      .filter(m => (m.totalVentas + m.totalCotizaciones) > 0)
                      .sort((a, b) => b.tasaConversion - a.tasaConversion)
                      .map(m => {
                        const totalOps = m.totalVentas + m.totalCotizaciones;
                        return (
                          <tr key={m.canalId} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
                                <span className="font-medium text-gray-900">{m.nombre}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-600">
                              {m.totalCotizaciones}
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">
                              {m.totalVentas}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      m.tasaConversion >= 70 ? 'bg-green-500' :
                                      m.tasaConversion >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.min(m.tasaConversion, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-sm font-medium ${
                                  m.tasaConversion >= 70 ? 'text-green-600' :
                                  m.tasaConversion >= 40 ? 'text-amber-600' : 'text-red-600'
                                }`}>
                                  {m.tasaConversion.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                              {formatCurrency(m.montoTotal)}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-600">
                              {formatCurrency(m.ticketPromedio)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Target className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No hay datos de conversión disponibles</p>
                <p className="text-sm mt-1">Registra cotizaciones y ventas para ver el análisis</p>
              </div>
            )}
          </Card>

          {/* Distribuciones */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary-600" />
                Por Estado
              </h3>
              <StatDistribution title="Estado" data={distribuciones.porEstado} />
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary-600" />
                Por Comisión
              </h3>
              <StatDistribution title="Comisión" data={distribuciones.porComision} />
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary-600" />
                Distribución de Ventas
              </h3>
              {distribuciones.porVentas.length > 0 ? (
                <StatDistribution title="Ventas" data={distribuciones.porVentas} />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Sin ventas registradas</p>
                </div>
              )}
            </Card>
          </div>

          {/* Tarjetas de Canales con Métricas */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Canales con Métricas
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {canales
                .filter(c => c.estado === 'activo')
                .map(canal => {
                  const metrics = metricas[canal.id];
                  if (!metrics) return null;

                  return (
                    <Card
                      key={canal.id}
                      className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => onViewCanal?.(canal)}
                    >
                      {/* Header */}
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
                        {canal.esSistema && (
                          <Badge variant="info" size="sm">Sistema</Badge>
                        )}
                      </div>

                      {/* Métricas */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-xs text-gray-500">Ventas</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {metrics.totalVentas}
                          </p>
                          {metrics.tendenciaVentas !== 0 && (
                            <p className={`text-xs flex items-center gap-1 ${
                              metrics.tendenciaVentas > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {metrics.tendenciaVentas > 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {Math.abs(metrics.tendenciaVentas).toFixed(1)}%
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Monto Total</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {formatCurrency(metrics.montoTotal)}
                          </p>
                        </div>
                      </div>

                      {/* Info adicional */}
                      <div className="space-y-1 text-xs text-gray-600 border-t pt-2">
                        {metrics.tasaConversion > 0 && (
                          <div className="flex justify-between">
                            <span>Tasa de conversión:</span>
                            <span className="font-medium">{metrics.tasaConversion.toFixed(1)}%</span>
                          </div>
                        )}
                        {metrics.ticketPromedio > 0 && (
                          <div className="flex justify-between">
                            <span>Ticket promedio:</span>
                            <span className="font-medium">{formatCurrency(metrics.ticketPromedio)}</span>
                          </div>
                        )}
                        {(canal.comisionPorcentaje || 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Comisión total:</span>
                            <span className="font-medium text-red-600">
                              -{formatCurrency(metrics.comisionTotal)}
                            </span>
                          </div>
                        )}
                        {metrics.margenPromedio > 0 && (
                          <div className="flex justify-between">
                            <span>Margen promedio:</span>
                            <span className="font-medium text-green-600">
                              {metrics.margenPromedio.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB: LISTA */}
      {/* ========================================== */}
      {subTab === 'lista' && (
        <div className="space-y-6">
          {/* KPIs simplificados */}
          <KPIGrid columns={4}>
            <KPICard
              title="Total Canales"
              value={statsGlobales.totalCanales}
              icon={Tag}
              variant="info"
            />
            <KPICard
              title="Canales Activos"
              value={statsGlobales.canalesActivos}
              icon={CheckCircle}
              variant="success"
            />
            <KPICard
              title="Con Comisión"
              value={statsGlobales.canalesConComision}
              icon={Percent}
              variant="warning"
            />
            <KPICard
              title="Comisión Promedio"
              value={`${statsGlobales.comisionPromedio.toFixed(1)}%`}
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
                Todos ({canales.length})
              </Button>
              <Button
                variant={activeTab === 'activos' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setActiveTab('activos')}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Activos ({canales.filter(c => c.estado === 'activo').length})
              </Button>
              <Button
                variant={activeTab === 'inactivos' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setActiveTab('inactivos')}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Inactivos ({canales.filter(c => c.estado === 'inactivo').length})
              </Button>
            </div>

            <SearchInput
              value={busqueda}
              onChange={setBusqueda}
              placeholder="Buscar canal..."
              className="w-full sm:w-64"
            />
          </div>

          {/* Lista de canales */}
          {canalesFiltrados.length === 0 ? (
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
              {canalesFiltrados.map((canal) => {
                const metrics = metricas[canal.id];
                return (
                  <Card
                    key={canal.id}
                    className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${
                      canal.estado === 'inactivo' ? 'opacity-60' : ''
                    }`}
                    onClick={() => setCanalDetalle(canal)}
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

                    {/* Métricas rápidas */}
                    {metrics && metrics.totalVentas > 0 && (
                      <div className="mb-3 p-2 bg-gray-50 rounded text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Ventas:</span>
                          <span className="font-medium">{metrics.totalVentas}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-medium">{formatCurrency(metrics.montoTotal)}</span>
                        </div>
                      </div>
                    )}

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
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* TAB: RENDIMIENTO */}
      {/* ========================================== */}
      {subTab === 'rendimiento' && (
        <div className="space-y-6">
          {/* Resumen de rendimiento */}
          <KPIGrid columns={4}>
            <KPICard
              title="Facturación Total"
              value={formatCurrency(statsGlobales.montoTotal)}
              icon={DollarSign}
              variant="success"
            />
            <KPICard
              title="Ventas Totales"
              value={statsGlobales.totalVentas}
              icon={ShoppingBag}
              variant="success"
            />
            <KPICard
              title="Ticket Promedio"
              value={formatCurrency(statsGlobales.totalVentas > 0 ? statsGlobales.montoTotal / statsGlobales.totalVentas : 0)}
              icon={Target}
              variant="info"
            />
            <KPICard
              title="Canal Top"
              value={statsGlobales.canalTop?.nombre || 'N/A'}
              icon={Zap}
              variant="warning"
            />
          </KPIGrid>

          {/* Tabla de rendimiento por canal */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary-600" />
              Rendimiento Detallado por Canal
            </h3>

            {Object.values(metricas).filter(m => m.totalVentas > 0 || m.totalCotizaciones > 0).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Canal
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cotizaciones
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ventas
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tasa Conv.
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Facturación
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ticket Prom.
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Comisión
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Margen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.values(metricas)
                      .filter(m => m.totalVentas > 0 || m.totalCotizaciones > 0)
                      .sort((a, b) => b.montoTotal - a.montoTotal)
                      .map((metrics) => (
                        <tr key={metrics.canalId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: metrics.color }}
                              />
                              <span className="text-sm font-medium text-gray-900">
                                {metrics.nombre}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-600">
                            {metrics.totalCotizaciones}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                            {metrics.totalVentas}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                            <span className={`font-medium ${
                              metrics.tasaConversion >= 50 ? 'text-green-600' :
                              metrics.tasaConversion >= 25 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {metrics.tasaConversion.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                            {formatCurrency(metrics.montoTotal)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-600">
                            {formatCurrency(metrics.ticketPromedio)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-red-600">
                            {metrics.comisionTotal > 0 ? `-${formatCurrency(metrics.comisionTotal)}` : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                            <span className={`font-medium ${
                              metrics.margenPromedio >= 30 ? 'text-green-600' :
                              metrics.margenPromedio >= 15 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {metrics.margenPromedio > 0 ? `${metrics.margenPromedio.toFixed(1)}%` : '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  Sin datos de rendimiento
                </h4>
                <p className="text-gray-500">
                  No hay ventas o cotizaciones registradas para analizar
                </p>
              </div>
            )}
          </Card>

          {/* Top 3 canales por diferentes métricas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Top por ventas */}
            <Card className="p-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Top 3 por Ventas
              </h4>
              <div className="space-y-3">
                {Object.values(metricas)
                  .sort((a, b) => b.totalVentas - a.totalVentas)
                  .slice(0, 3)
                  .map((m, idx) => (
                    <div key={m.canalId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-400">#{idx + 1}</span>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="text-sm font-medium text-gray-700">{m.nombre}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">{m.totalVentas}</span>
                    </div>
                  ))}
              </div>
            </Card>

            {/* Top por facturación */}
            <Card className="p-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                Top 3 por Facturación
              </h4>
              <div className="space-y-3">
                {Object.values(metricas)
                  .sort((a, b) => b.montoTotal - a.montoTotal)
                  .slice(0, 3)
                  .map((m, idx) => (
                    <div key={m.canalId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-400">#{idx + 1}</span>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="text-sm font-medium text-gray-700">{m.nombre}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(m.montoTotal)}
                      </span>
                    </div>
                  ))}
              </div>
            </Card>

            {/* Top por margen */}
            <Card className="p-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Percent className="h-4 w-4 text-blue-600" />
                Top 3 por Margen
              </h4>
              <div className="space-y-3">
                {Object.values(metricas)
                  .filter(m => m.margenPromedio > 0)
                  .sort((a, b) => b.margenPromedio - a.margenPromedio)
                  .slice(0, 3)
                  .map((m, idx) => (
                    <div key={m.canalId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-400">#{idx + 1}</span>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="text-sm font-medium text-gray-700">{m.nombre}</span>
                      </div>
                      <span className="text-sm font-bold text-green-600">
                        {m.margenPromedio.toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
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

      {/* Modal de detalle con analytics */}
      {canalDetalle && (
        <CanalVentaDetailView
          canal={canalDetalle}
          onClose={() => setCanalDetalle(null)}
          onEdit={() => {
            setCanalDetalle(null);
            openEditModal(canalDetalle);
          }}
        />
      )}
    </div>
  );
};
