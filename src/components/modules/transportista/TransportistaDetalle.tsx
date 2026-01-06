import React, { useState, useMemo } from 'react';
import {
  X,
  Truck,
  Phone,
  Mail,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  Award,
  Target,
  Activity,
  DollarSign,
  Package,
  Percent,
  Edit
} from 'lucide-react';
import type { Transportista } from '../../../types/transportista.types';
import { Badge } from '../../common/Badge';
import { Card } from '../../common/Card';
import { KPICard, KPIGrid, StatDistribution, AlertCard } from '../../common/KPICard';
import { Tabs, TabsProvider, TabPanel } from '../../common/Tabs';
import {
  SimpleBarChart,
  SimpleLineChart,
  DonutChart,
  CHART_COLORS,
  formatNumber,
  formatCurrency
} from '../../common/Charts';

// ============================================
// TIPOS
// ============================================

interface TransportistaDetalleProps {
  transportista: Transportista;
  onClose: () => void;
  onEdit: () => void;
}

type TabActiva = 'resumen' | 'historial' | 'analytics' | 'predicciones';

interface EntregaSimulada {
  id: string;
  codigo: string;
  fecha: Date;
  distrito: string;
  estado: 'exitosa' | 'fallida' | 'pendiente';
  monto: number;
  tiempoEntrega: number; // horas
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

// Simular datos de entregas basados en las métricas del transportista
const generarEntregasSimuladas = (transportista: Transportista): EntregaSimulada[] => {
  const entregas: EntregaSimulada[] = [];
  const totalEntregas = transportista.totalEntregas || 0;
  const entregasExitosas = transportista.entregasExitosas || 0;
  const entregasFallidas = transportista.entregasFallidas || 0;

  const distritos = transportista.zonasAtendidas?.length
    ? transportista.zonasAtendidas
    : ['Lima', 'Miraflores', 'San Isidro', 'Surco', 'La Molina'];

  // Generar entregas exitosas
  for (let i = 0; i < Math.min(entregasExitosas, 20); i++) {
    entregas.push({
      id: `e-${i}`,
      codigo: `ENT-${String(i + 1).padStart(4, '0')}`,
      fecha: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      distrito: distritos[Math.floor(Math.random() * distritos.length)],
      estado: 'exitosa',
      monto: 50 + Math.random() * 200,
      tiempoEntrega: transportista.tiempoPromedioEntrega || 2 + Math.random() * 4
    });
  }

  // Generar entregas fallidas
  for (let i = 0; i < Math.min(entregasFallidas, 5); i++) {
    entregas.push({
      id: `f-${i}`,
      codigo: `ENT-${String(entregasExitosas + i + 1).padStart(4, '0')}`,
      fecha: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      distrito: distritos[Math.floor(Math.random() * distritos.length)],
      estado: 'fallida',
      monto: 50 + Math.random() * 200,
      tiempoEntrega: 6 + Math.random() * 12
    });
  }

  // Generar entregas pendientes
  const pendientes = totalEntregas - entregasExitosas - entregasFallidas;
  for (let i = 0; i < Math.min(pendientes, 3); i++) {
    entregas.push({
      id: `p-${i}`,
      codigo: `ENT-${String(entregasExitosas + entregasFallidas + i + 1).padStart(4, '0')}`,
      fecha: new Date(Date.now() - Math.random() * 2 * 24 * 60 * 60 * 1000),
      distrito: distritos[Math.floor(Math.random() * distritos.length)],
      estado: 'pendiente',
      monto: 50 + Math.random() * 200,
      tiempoEntrega: 0
    });
  }

  return entregas.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
};

// Generar datos de rendimiento mensual
const generarRendimientoMensual = (transportista: Transportista) => {
  const meses = ['Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene'];
  const totalBase = (transportista.totalEntregas || 50) / 6;

  return meses.map((mes, idx) => {
    const variacion = 0.7 + Math.random() * 0.6;
    const total = Math.round(totalBase * variacion);
    const tasaExito = (transportista.tasaExito || 95) + (Math.random() * 10 - 5);

    return {
      mes,
      entregas: total,
      exitosas: Math.round(total * (tasaExito / 100)),
      fallidas: Math.round(total * (1 - tasaExito / 100)),
      tasaExito: Math.min(100, Math.max(0, tasaExito))
    };
  });
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export const TransportistaDetalle: React.FC<TransportistaDetalleProps> = ({
  transportista,
  onClose,
  onEdit
}) => {
  const [tabActiva, setTabActiva] = useState<TabActiva>('resumen');
  const [filtroEstado, setFiltroEstado] = useState<'todas' | 'exitosa' | 'fallida' | 'pendiente'>('todas');

  // Datos simulados
  const entregas = useMemo(() => generarEntregasSimuladas(transportista), [transportista]);
  const rendimientoMensual = useMemo(() => generarRendimientoMensual(transportista), [transportista]);

  // Entregas filtradas
  const entregasFiltradas = entregas.filter(e =>
    filtroEstado === 'todas' || e.estado === filtroEstado
  );

  // Métricas calculadas
  const totalEntregas = transportista.totalEntregas || 0;
  const entregasExitosas = transportista.entregasExitosas || 0;
  const entregasFallidas = transportista.entregasFallidas || 0;
  const entregasPendientes = totalEntregas - entregasExitosas - entregasFallidas;
  const tasaExito = transportista.tasaExito || 0;
  const tiempoPromedio = transportista.tiempoPromedioEntrega || 0;
  const costoPromedio = transportista.costoPromedioPorEntrega || 0;

  // Alertas
  const alertas = useMemo(() => {
    const alerts: Array<{ id: string; label: string; sublabel?: string; value?: string }> = [];

    if (tasaExito < 85) {
      alerts.push({
        id: 'tasa-baja',
        label: 'Tasa de éxito baja',
        sublabel: `Actual: ${tasaExito.toFixed(1)}%`,
        value: 'Crítico'
      });
    }

    if (tiempoPromedio > 8) {
      alerts.push({
        id: 'tiempo-alto',
        label: 'Tiempo de entrega elevado',
        sublabel: `${tiempoPromedio.toFixed(1)} horas promedio`
      });
    }

    if (transportista.estado === 'inactivo') {
      alerts.push({
        id: 'inactivo',
        label: 'Transportista inactivo',
        sublabel: 'No puede recibir nuevas entregas'
      });
    }

    const diasSinEntrega = transportista.fechaUltimaEntrega
      ? Math.floor((Date.now() - transportista.fechaUltimaEntrega.toMillis()) / (1000 * 60 * 60 * 24))
      : null;

    if (diasSinEntrega && diasSinEntrega > 15) {
      alerts.push({
        id: 'inactividad',
        label: 'Inactividad prolongada',
        sublabel: `${diasSinEntrega} días sin entregas`
      });
    }

    return alerts;
  }, [transportista, tasaExito, tiempoPromedio]);

  // Distribución por estado
  const distribucionEstado = [
    { label: 'Exitosas', value: entregasExitosas, color: 'bg-green-500' },
    { label: 'Fallidas', value: entregasFallidas, color: 'bg-red-500' },
    { label: 'Pendientes', value: entregasPendientes, color: 'bg-yellow-500' }
  ];

  // Distribución por zona
  const distribucionZona = useMemo(() => {
    const zonas = entregas.reduce((acc, e) => {
      acc[e.distrito] = (acc[e.distrito] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(zonas)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [entregas]);

  // Tabs
  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: <Activity className="h-4 w-4" /> },
    { id: 'historial', label: 'Historial', icon: <Calendar className="h-4 w-4" />, badge: entregas.length },
    { id: 'analytics', label: 'Analytics', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'predicciones', label: 'Predicciones', icon: <Target className="h-4 w-4" /> }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header con gradiente verde/esmeralda */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm">
                <Truck className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold">{transportista.nombre}</h2>
                  <Badge
                    variant={transportista.estado === 'activo' ? 'success' : 'secondary'}
                    className="text-xs"
                  >
                    {transportista.estado === 'activo' ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <Badge
                    variant={transportista.tipo === 'interno' ? 'info' : 'warning'}
                    className="text-xs"
                  >
                    {transportista.tipo === 'interno' ? 'Interno' : 'Externo'}
                  </Badge>
                </div>
                <p className="text-green-100 text-sm mb-3">{transportista.codigo}</p>
                <div className="flex items-center gap-6 text-sm text-green-50">
                  {transportista.telefono && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      <span>{transportista.telefono}</span>
                    </div>
                  )}
                  {transportista.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-4 w-4" />
                      <span>{transportista.email}</span>
                    </div>
                  )}
                  {transportista.tipo === 'externo' && transportista.courierExterno && (
                    <div className="flex items-center gap-1.5">
                      <Package className="h-4 w-4" />
                      <span className="capitalize">{transportista.courierExterno.replace('_', ' ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onEdit}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Editar transportista"
              >
                <Edit className="h-5 w-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b border-gray-200 bg-gray-50 px-6">
          <Tabs
            tabs={tabs}
            activeTab={tabActiva}
            onChange={(id) => setTabActiva(id as TabActiva)}
            variant="underline"
          />
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <TabsProvider activeTab={tabActiva}>

            {/* TAB: RESUMEN */}
            <TabPanel tabId="resumen">
              <div className="space-y-6">
                {/* KPIs Principales */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Métricas Principales</h3>
                  <KPIGrid columns={4}>
                    <KPICard
                      title="Total Entregas"
                      value={totalEntregas}
                      icon={Package}
                      variant="default"
                      subtitle="Últimos 30 días"
                    />
                    <KPICard
                      title="Entregas Exitosas"
                      value={entregasExitosas}
                      icon={CheckCircle}
                      variant="success"
                      subtitle={`${tasaExito.toFixed(1)}% tasa de éxito`}
                    />
                    <KPICard
                      title="Tiempo Promedio"
                      value={`${tiempoPromedio.toFixed(1)}h`}
                      icon={Clock}
                      variant={tiempoPromedio > 6 ? 'warning' : 'info'}
                      subtitle="Por entrega"
                    />
                    <KPICard
                      title="Costo Promedio"
                      value={formatCurrency(costoPromedio)}
                      icon={DollarSign}
                      variant="default"
                      subtitle="Por entrega"
                    />
                  </KPIGrid>
                </div>

                {/* Información adicional y distribuciones */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Información del Transportista */}
                  <Card className="p-4">
                    <h4 className="font-medium text-gray-900 mb-4">Información del Transportista</h4>
                    <div className="space-y-3">
                      {transportista.tipo === 'interno' && (
                        <>
                          {transportista.dni && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">DNI:</span>
                              <span className="font-medium text-gray-900">{transportista.dni}</span>
                            </div>
                          )}
                          {transportista.licencia && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Licencia:</span>
                              <span className="font-medium text-gray-900">{transportista.licencia}</span>
                            </div>
                          )}
                        </>
                      )}
                      {transportista.comisionPorcentaje !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Comisión:</span>
                          <span className="font-medium text-gray-900 flex items-center gap-1">
                            {transportista.comisionPorcentaje}%
                            <Percent className="h-3 w-3" />
                          </span>
                        </div>
                      )}
                      {transportista.costoFijo !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Costo Fijo:</span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(transportista.costoFijo)}
                          </span>
                        </div>
                      )}
                      {transportista.calificacionPromedio !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Calificación:</span>
                          <span className="font-medium text-gray-900 flex items-center gap-1">
                            <Award className="h-3 w-3 text-yellow-500" />
                            {transportista.calificacionPromedio.toFixed(1)} / 5.0
                          </span>
                        </div>
                      )}
                      {transportista.fechaUltimaEntrega && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Última Entrega:</span>
                          <span className="font-medium text-gray-900">
                            {new Date(transportista.fechaUltimaEntrega.toMillis()).toLocaleDateString('es-PE')}
                          </span>
                        </div>
                      )}
                    </div>
                    {transportista.observaciones && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Observaciones:</p>
                        <p className="text-sm text-gray-700">{transportista.observaciones}</p>
                      </div>
                    )}
                  </Card>

                  {/* Distribución por Estado */}
                  <StatDistribution
                    title="Distribución de Entregas"
                    data={distribucionEstado}
                    showPercentage
                  />
                </div>

                {/* Alertas */}
                {alertas.length > 0 && (
                  <AlertCard
                    title="Alertas y Notificaciones"
                    items={alertas}
                    icon={AlertTriangle}
                    variant={tasaExito < 85 ? 'danger' : 'warning'}
                    emptyMessage="No hay alertas activas"
                  />
                )}

                {/* Zonas Atendidas */}
                {transportista.zonasAtendidas && transportista.zonasAtendidas.length > 0 && (
                  <Card className="p-4">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      Zonas Atendidas
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {transportista.zonasAtendidas.map((zona) => (
                        <Badge key={zona} variant="secondary">
                          {zona}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </TabPanel>

            {/* TAB: HISTORIAL */}
            <TabPanel tabId="historial">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Historial de Entregas ({entregasFiltradas.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <select
                      value={filtroEstado}
                      onChange={(e) => setFiltroEstado(e.target.value as any)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="todas">Todas</option>
                      <option value="exitosa">Exitosas</option>
                      <option value="fallida">Fallidas</option>
                      <option value="pendiente">Pendientes</option>
                    </select>
                  </div>
                </div>

                {/* Lista de entregas */}
                <div className="space-y-2">
                  {entregasFiltradas.length === 0 ? (
                    <Card className="p-8 text-center">
                      <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No hay entregas para mostrar</p>
                    </Card>
                  ) : (
                    entregasFiltradas.map((entrega) => (
                      <Card key={entrega.id} className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`
                              p-2 rounded-lg
                              ${entrega.estado === 'exitosa' ? 'bg-green-100' : ''}
                              ${entrega.estado === 'fallida' ? 'bg-red-100' : ''}
                              ${entrega.estado === 'pendiente' ? 'bg-yellow-100' : ''}
                            `}>
                              {entrega.estado === 'exitosa' && <CheckCircle className="h-5 w-5 text-green-600" />}
                              {entrega.estado === 'fallida' && <XCircle className="h-5 w-5 text-red-600" />}
                              {entrega.estado === 'pendiente' && <Clock className="h-5 w-5 text-yellow-600" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-gray-900">{entrega.codigo}</p>
                                <Badge
                                  variant={
                                    entrega.estado === 'exitosa' ? 'success' :
                                    entrega.estado === 'fallida' ? 'danger' : 'warning'
                                  }
                                  className="text-xs"
                                >
                                  {entrega.estado === 'exitosa' ? 'Exitosa' :
                                   entrega.estado === 'fallida' ? 'Fallida' : 'Pendiente'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {entrega.distrito}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {entrega.fecha.toLocaleDateString('es-PE')}
                                </span>
                                {entrega.estado !== 'pendiente' && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {entrega.tiempoEntrega.toFixed(1)}h
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">
                              {formatCurrency(entrega.monto)}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </TabPanel>

            {/* TAB: ANALYTICS */}
            <TabPanel tabId="analytics">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Analytics y Tendencias</h3>

                {/* Rendimiento Mensual */}
                <Card className="p-4">
                  <SimpleBarChart
                    title="Entregas por Mes"
                    data={rendimientoMensual}
                    dataKey="entregas"
                    xAxisKey="mes"
                    height={250}
                    color={CHART_COLORS.primary}
                    formatValue={formatNumber}
                  />
                </Card>

                {/* Tasa de éxito mensual */}
                <Card className="p-4">
                  <SimpleLineChart
                    title="Tasa de Éxito Mensual (%)"
                    data={rendimientoMensual}
                    dataKey="tasaExito"
                    xAxisKey="mes"
                    height={250}
                    color={CHART_COLORS.success}
                    formatValue={(v) => `${v.toFixed(1)}%`}
                  />
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Distribución por Zona */}
                  <Card className="p-4">
                    <DonutChart
                      title="Entregas por Zona"
                      data={distribucionZona}
                      height={300}
                      formatValue={formatNumber}
                    />
                  </Card>

                  {/* Comparación con promedio */}
                  <Card className="p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-4">
                      Comparación con Promedio
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600">Tasa de Éxito</span>
                          <span className="font-medium text-gray-900">{tasaExito.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${tasaExito >= 90 ? 'bg-green-500' : tasaExito >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${tasaExito}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Promedio: 92% {tasaExito >= 92 ? '(Superior)' : '(Por debajo)'}
                        </p>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600">Tiempo de Entrega</span>
                          <span className="font-medium text-gray-900">{tiempoPromedio.toFixed(1)}h</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${tiempoPromedio <= 4 ? 'bg-green-500' : tiempoPromedio <= 6 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, (tiempoPromedio / 12) * 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Promedio: 4.5h {tiempoPromedio <= 4.5 ? '(Superior)' : '(Por debajo)'}
                        </p>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600">Total Entregas</span>
                          <span className="font-medium text-gray-900">{totalEntregas}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${Math.min(100, (totalEntregas / 200) * 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Promedio: 120 entregas/mes
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </TabPanel>

            {/* TAB: PREDICCIONES */}
            <TabPanel tabId="predicciones">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Predicciones e Insights</h3>

                {/* Métricas predictivas */}
                <KPIGrid columns={3}>
                  <KPICard
                    title="Capacidad Estimada"
                    value={`${Math.round(totalEntregas / 30 * 1.2)}/día`}
                    icon={Target}
                    variant="info"
                    subtitle="Basado en histórico"
                    trend={{
                      value: 15,
                      label: 'vs mes anterior'
                    }}
                  />
                  <KPICard
                    title="Probabilidad de Éxito"
                    value={`${Math.min(100, tasaExito + 2).toFixed(0)}%`}
                    icon={TrendingUp}
                    variant={tasaExito >= 90 ? 'success' : 'warning'}
                    subtitle="Próxima entrega"
                  />
                  <KPICard
                    title="Tiempo Estimado"
                    value={`${(tiempoPromedio * 0.95).toFixed(1)}h`}
                    icon={Clock}
                    variant="default"
                    subtitle="Promedio optimizado"
                    trend={{
                      value: -5,
                      label: 'mejora esperada'
                    }}
                  />
                </KPIGrid>

                {/* Insights */}
                <Card className="p-6">
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-500" />
                    Insights Inteligentes
                  </h4>
                  <div className="space-y-3">
                    {tasaExito >= 95 && (
                      <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-green-900">Excelente Rendimiento</p>
                          <p className="text-sm text-green-700">
                            Este transportista tiene una tasa de éxito superior al 95%. Es un candidato ideal para entregas prioritarias.
                          </p>
                        </div>
                      </div>
                    )}

                    {tiempoPromedio <= 3 && (
                      <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <Clock className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-900">Entregas Rápidas</p>
                          <p className="text-sm text-blue-700">
                            Tiempo promedio de entrega bajo ({tiempoPromedio.toFixed(1)}h). Recomendado para envíos express.
                          </p>
                        </div>
                      </div>
                    )}

                    {tasaExito < 85 && (
                      <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-900">Requiere Atención</p>
                          <p className="text-sm text-red-700">
                            La tasa de éxito está por debajo del promedio. Considere capacitación adicional o reasignación de rutas.
                          </p>
                        </div>
                      </div>
                    )}

                    {tiempoPromedio > 8 && (
                      <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <TrendingDown className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-yellow-900">Optimización Necesaria</p>
                          <p className="text-sm text-yellow-700">
                            El tiempo promedio de entrega es elevado. Revise las rutas asignadas y considere optimizaciones logísticas.
                          </p>
                        </div>
                      </div>
                    )}

                    {totalEntregas > 150 && tasaExito >= 92 && (
                      <div className="flex items-start gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <Award className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-purple-900">Transportista Destacado</p>
                          <p className="text-sm text-purple-700">
                            Alto volumen de entregas ({totalEntregas}) con excelente calidad. Considere incrementar su capacidad de carga.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Recomendaciones */}
                <Card className="p-6">
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-500" />
                    Recomendaciones
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-sm">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 mt-1.5" />
                      <p className="text-gray-700">
                        Asignar entregas en zonas donde ha demostrado mejor rendimiento: {distribucionZona[0]?.name || 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 mt-1.5" />
                      <p className="text-gray-700">
                        Capacidad óptima estimada: {Math.round(totalEntregas / 30 * 1.1)} entregas por día
                      </p>
                    </div>
                    {tiempoPromedio > 6 && (
                      <div className="flex items-start gap-2 text-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 mt-1.5" />
                        <p className="text-gray-700">
                          Optimizar rutas podría reducir tiempo promedio en un 15-20%
                        </p>
                      </div>
                    )}
                    {tasaExito >= 95 && (
                      <div className="flex items-start gap-2 text-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5" />
                        <p className="text-gray-700">
                          Candidato ideal para entregas de alto valor o clientes VIP
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </TabPanel>

          </TabsProvider>
        </div>
      </div>
    </div>
  );
};

export default TransportistaDetalle;
