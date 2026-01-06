import { useState, useEffect } from 'react';
import {
  Truck, Phone, Mail, Calendar, DollarSign,
  TrendingUp, TrendingDown, AlertTriangle, Clock, BarChart3,
  RefreshCw, MapPin, Users, Star, X,
  Activity, Target, CheckCircle, AlertCircle, Package,
  XCircle, Timer, Award, Route, Zap
} from 'lucide-react';
import type { Transportista } from '../../types/transportista.types';
import {
  transportistaAnalyticsService,
  type TransportistaAnalytics,
  type EntregaHistorial,
  type MetricasZona,
  type IncidenciaTransportista,
  type ComparativaTransportistas
} from '../../services/transportista.analytics.service';

type DetailTab = 'resumen' | 'entregas' | 'zonas' | 'analisis' | 'comparativa';

interface TransportistaDetailViewProps {
  transportista: Transportista;
  onClose: () => void;
  onEdit?: () => void;
}

export function TransportistaDetailView({ transportista, onClose, onEdit }: TransportistaDetailViewProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('resumen');
  const [analytics, setAnalytics] = useState<TransportistaAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [transportista.id]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await transportistaAnalyticsService.getTransportistaAnalytics(transportista.id);
      setAnalytics(data);
    } catch (error) {
      console.error('Error cargando analytics:', error);
    }
    setLoading(false);
  };

  const formatCurrency = (value: number, currency: 'USD' | 'PEN' = 'PEN') => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const getTendenciaIcon = (tendencia?: string) => {
    switch (tendencia) {
      case 'mejorando':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'empeorando':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <span className="text-gray-400">-</span>;
    }
  };

  const getAlertaIcon = (severidad: string) => {
    switch (severidad) {
      case 'danger': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default: return <AlertCircle className="w-4 h-4 text-blue-500" />;
    }
  };

  const getEstadoEntregaColor = (estado: string) => {
    switch (estado) {
      case 'completada': return 'text-green-600 bg-green-100';
      case 'fallida': return 'text-red-600 bg-red-100';
      case 'reprogramada': return 'text-yellow-600 bg-yellow-100';
      case 'en_proceso': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getEstadoEntregaIcon = (estado: string) => {
    switch (estado) {
      case 'completada': return <CheckCircle className="w-4 h-4" />;
      case 'fallida': return <XCircle className="w-4 h-4" />;
      case 'reprogramada': return <Clock className="w-4 h-4" />;
      case 'en_proceso': return <Truck className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getCalificacionColor = (calificacion: number) => {
    if (calificacion >= 4.5) return 'text-green-600';
    if (calificacion >= 4) return 'text-blue-600';
    if (calificacion >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Renderizar pestaña Resumen
  const renderResumen = () => (
    <div className="space-y-6">
      {/* Info del transportista */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start gap-4">
          <div className={`w-16 h-16 rounded-lg flex items-center justify-center text-2xl font-bold ${
            transportista.tipo === 'interno' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
          }`}>
            <Truck className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900">{transportista.nombre}</h2>
              {analytics && (
                <span className={`px-2 py-1 text-sm font-bold rounded-full ${
                  analytics.rendimiento.tasaExitoGlobal >= 90 ? 'bg-green-100 text-green-800' :
                  analytics.rendimiento.tasaExitoGlobal >= 80 ? 'bg-blue-100 text-blue-800' :
                  analytics.rendimiento.tasaExitoGlobal >= 70 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {formatPercent(analytics.rendimiento.tasaExitoGlobal)} éxito
                </span>
              )}
            </div>
            <p className="text-gray-500">{transportista.codigo}</p>

            <div className="flex flex-wrap gap-4 mt-3">
              {transportista.telefono && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  {transportista.telefono}
                </div>
              )}
              {transportista.email && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  {transportista.email}
                </div>
              )}
              {transportista.dni && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  DNI: {transportista.dni}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-3">
              <span className={`px-2 py-1 text-xs rounded-full ${
                transportista.estado === 'activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {transportista.estado}
              </span>
              <span className={`px-2 py-1 text-xs rounded-full ${
                transportista.tipo === 'interno' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
              }`}>
                {transportista.tipo}
              </span>
              {transportista.courierExterno && (
                <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                  {transportista.courierExterno}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Editar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPIs principales */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Package className="w-4 h-4" />
              Entregas Totales
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {analytics.rendimiento.entregasTotales}
            </div>
            <div className="text-xs text-gray-500">
              {analytics.entregasUltimos30Dias} últimos 30 días
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle className="w-4 h-4" />
              Tasa de Éxito
            </div>
            <div className={`text-2xl font-bold ${
              analytics.rendimiento.tasaExitoGlobal >= 85 ? 'text-green-600' :
              analytics.rendimiento.tasaExitoGlobal >= 70 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {formatPercent(analytics.rendimiento.tasaExitoGlobal)}
            </div>
            <div className="flex items-center gap-1 text-xs">
              {getTendenciaIcon(analytics.tendenciaRendimiento)}
              <span className="text-gray-500">{analytics.tendenciaRendimiento}</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Timer className="w-4 h-4" />
              Tiempo Promedio
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {analytics.rendimiento.tiempoPromedioEntrega.toFixed(1)}h
            </div>
            <div className="text-xs text-gray-500">
              Puntualidad: {formatPercent(analytics.rendimiento.puntualidad)}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Star className="w-4 h-4" />
              Calificación
            </div>
            <div className={`text-2xl font-bold ${getCalificacionColor(analytics.calificacionPromedio)}`}>
              {analytics.calificacionPromedio.toFixed(1)}/5
            </div>
            <div className="text-xs text-gray-500">
              {analytics.totalCalificaciones} calificaciones
            </div>
          </div>
        </div>
      )}

      {/* Métricas de costos */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Métricas de Costos
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">Costo Total</div>
              <div className="text-xl font-bold">{formatCurrency(analytics.metricasCosto.costoTotalPeriodo)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Costo por Entrega</div>
              <div className="text-xl font-bold">{formatCurrency(analytics.metricasCosto.costoPromedioEntrega)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Costo por Unidad</div>
              <div className="text-xl font-bold">{formatCurrency(analytics.metricasCosto.costoPromedioUnidad)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">ROI</div>
              <div className={`text-xl font-bold ${
                analytics.roi.retornoInversion > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatPercent(analytics.roi.retornoInversion)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alertas */}
      {analytics && analytics.alertas.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Alertas ({analytics.alertas.length})
          </h3>
          <div className="space-y-3">
            {analytics.alertas.slice(0, 5).map((alerta, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  alerta.severidad === 'danger' ? 'bg-red-50 border-red-200' :
                  alerta.severidad === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {getAlertaIcon(alerta.severidad)}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{alerta.mensaje}</div>
                    {alerta.detalle && (
                      <div className="text-sm text-gray-600 mt-1">{alerta.detalle}</div>
                    )}
                    {alerta.accionRecomendada && (
                      <div className="text-sm text-blue-600 mt-1">
                        → {alerta.accionRecomendada}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Renderizar pestaña Entregas
  const renderEntregas = () => (
    <div className="space-y-6">
      {/* Resumen de entregas */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Totales</div>
            <div className="text-2xl font-bold">{analytics.rendimiento.entregasTotales}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Exitosas</div>
            <div className="text-2xl font-bold text-green-600">{analytics.rendimiento.entregasExitosas}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Fallidas</div>
            <div className="text-2xl font-bold text-red-600">{analytics.rendimiento.entregasFallidas}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Reprogramadas</div>
            <div className="text-2xl font-bold text-yellow-600">{analytics.rendimiento.entregasReprogramadas}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">En Proceso</div>
            <div className="text-2xl font-bold text-blue-600">{analytics.rendimiento.entregasEnProceso}</div>
          </div>
        </div>
      )}

      {/* Historial de entregas */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Historial de Entregas ({analytics.entregasHistorial.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Fecha</th>
                  <th className="text-left py-2 px-2">Venta</th>
                  <th className="text-left py-2 px-2">Cliente</th>
                  <th className="text-left py-2 px-2">Zona</th>
                  <th className="text-right py-2 px-2">Unid.</th>
                  <th className="text-right py-2 px-2">Tiempo</th>
                  <th className="text-right py-2 px-2">Costo</th>
                  <th className="text-center py-2 px-2">Estado</th>
                  <th className="text-center py-2 px-2">Calif.</th>
                </tr>
              </thead>
              <tbody>
                {analytics.entregasHistorial.slice(0, 20).map((entrega, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2 text-xs">{formatDate(entrega.fecha)}</td>
                    <td className="py-2 px-2 font-mono text-xs">{entrega.numeroVenta || '-'}</td>
                    <td className="py-2 px-2">{entrega.clienteNombre || '-'}</td>
                    <td className="py-2 px-2 text-gray-500">{entrega.zona}</td>
                    <td className="py-2 px-2 text-right font-medium">{entrega.unidades}</td>
                    <td className="py-2 px-2 text-right">{entrega.tiempoEntrega > 0 ? `${entrega.tiempoEntrega}h` : '-'}</td>
                    <td className="py-2 px-2 text-right">{formatCurrency(entrega.costoEntrega)}</td>
                    <td className="py-2 px-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${getEstadoEntregaColor(entrega.estado)}`}>
                        {getEstadoEntregaIcon(entrega.estado)}
                        {entrega.estado}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      {entrega.calificacionCliente ? (
                        <span className={`font-medium ${getCalificacionColor(entrega.calificacionCliente)}`}>
                          {entrega.calificacionCliente.toFixed(1)}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Incidencias */}
      {analytics && analytics.incidencias.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Incidencias ({analytics.incidencias.length})
          </h3>
          <div className="space-y-3">
            {analytics.incidencias.slice(0, 10).map((incidencia, idx) => (
              <div key={idx} className={`p-3 rounded-lg border ${
                incidencia.severidad === 'grave' ? 'bg-red-50 border-red-200' :
                incidencia.severidad === 'moderada' ? 'bg-yellow-50 border-yellow-200' :
                'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        incidencia.severidad === 'grave' ? 'bg-red-100 text-red-700' :
                        incidencia.severidad === 'moderada' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {incidencia.severidad}
                      </span>
                      <span className="text-sm font-medium">{incidencia.tipo.replace('_', ' ')}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{incidencia.descripcion}</div>
                    {incidencia.clienteAfectado && (
                      <div className="text-xs text-gray-500 mt-1">Cliente: {incidencia.clienteAfectado}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">{formatDate(incidencia.fecha)}</div>
                    {incidencia.resuelta ? (
                      <span className="text-xs text-green-600">Resuelta</span>
                    ) : (
                      <span className="text-xs text-red-600">Pendiente</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Renderizar pestaña Zonas
  const renderZonas = () => (
    <div className="space-y-6">
      {/* Resumen de zonas */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Zonas Atendidas</div>
            <div className="text-2xl font-bold">{analytics.coberturadistribucionZonas}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Mejor Rendimiento</div>
            <div className="text-2xl font-bold text-green-600">{analytics.zonasConMejorRendimiento.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Problemáticas</div>
            <div className="text-2xl font-bold text-red-600">{analytics.zonasProblematicas.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Día Más Productivo</div>
            <div className="text-xl font-bold capitalize">{analytics.diaMasProductivo}</div>
          </div>
        </div>
      )}

      {/* Métricas por zona */}
      {analytics && analytics.metricasPorZona.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Rendimiento por Zona
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Zona</th>
                  <th className="text-right py-2 px-2">Entregas</th>
                  <th className="text-right py-2 px-2">Exitosas</th>
                  <th className="text-right py-2 px-2">Fallidas</th>
                  <th className="text-right py-2 px-2">Tasa Éxito</th>
                  <th className="text-right py-2 px-2">Tiempo Prom.</th>
                  <th className="text-right py-2 px-2">Costo Prom.</th>
                  <th className="text-center py-2 px-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {analytics.metricasPorZona.map((zona, idx) => (
                  <tr key={idx} className={`border-b hover:bg-gray-50 ${zona.esZonaProblematica ? 'bg-red-50' : ''}`}>
                    <td className="py-2 px-2 font-medium">{zona.zona}</td>
                    <td className="py-2 px-2 text-right">{zona.totalEntregas}</td>
                    <td className="py-2 px-2 text-right text-green-600">{zona.entregasExitosas}</td>
                    <td className="py-2 px-2 text-right text-red-600">{zona.entregasFallidas}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={`font-medium ${
                        zona.tasaExito >= 90 ? 'text-green-600' :
                        zona.tasaExito >= 80 ? 'text-blue-600' :
                        zona.tasaExito >= 70 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {formatPercent(zona.tasaExito)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">{zona.tiempoPromedioHoras.toFixed(1)}h</td>
                    <td className="py-2 px-2 text-right">{formatCurrency(zona.costoPromedio)}</td>
                    <td className="py-2 px-2 text-center">
                      {zona.esZonaProblematica ? (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">Problemática</span>
                      ) : zona.tasaExito >= 90 ? (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Excelente</span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">Normal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Distribución por día */}
      {analytics && analytics.distribucionPorDia.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Distribución por Día de la Semana
          </h3>
          <div className="space-y-3">
            {analytics.distribucionPorDia.map((dia, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-24 text-sm font-medium capitalize">{dia.dia}</div>
                <div className="flex-1">
                  <div className="h-6 bg-gray-100 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(dia.entregas / Math.max(...analytics.distribucionPorDia.map(d => d.entregas))) * 100}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                      {dia.entregas} entregas
                    </span>
                  </div>
                </div>
                <div className="w-20 text-right text-sm">
                  <span className={dia.tasaExito >= 85 ? 'text-green-600' : dia.tasaExito >= 70 ? 'text-yellow-600' : 'text-red-600'}>
                    {formatPercent(dia.tasaExito)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zonas recomendadas */}
      {analytics && analytics.predicciones.zonasRecomendadas.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Route className="w-5 h-5" />
            Zonas Recomendadas
          </h3>
          <div className="flex flex-wrap gap-2">
            {analytics.predicciones.zonasRecomendadas.map((zona, idx) => (
              <span key={idx} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                {zona}
              </span>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-3">
            Estas zonas tienen la mejor tasa de éxito para este transportista.
          </p>
        </div>
      )}
    </div>
  );

  // Renderizar pestaña Análisis
  const renderAnalisis = () => (
    <div className="space-y-6">
      {/* Métricas de rendimiento detalladas */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Análisis de Rendimiento</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-3 bg-green-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{analytics.rendimiento.entregasExitosas}</div>
              <div className="text-sm text-gray-600">Exitosas</div>
            </div>
            <div className="p-3 bg-red-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-600">{analytics.rendimiento.entregasFallidas}</div>
              <div className="text-sm text-gray-600">Fallidas</div>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">{analytics.rendimiento.entregasReprogramadas}</div>
              <div className="text-sm text-gray-600">Reprogramadas</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{formatPercent(analytics.rendimiento.puntualidad)}</div>
              <div className="text-sm text-gray-600">Puntualidad</div>
            </div>
          </div>

          {/* Tiempos */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 border rounded-lg">
              <div className="text-sm text-gray-500">Tiempo Mínimo</div>
              <div className="text-xl font-bold">{analytics.rendimiento.tiempoMinimoEntrega.toFixed(1)}h</div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="text-sm text-gray-500">Tiempo Promedio</div>
              <div className="text-xl font-bold">{analytics.rendimiento.tiempoPromedioEntrega.toFixed(1)}h</div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="text-sm text-gray-500">Tiempo Máximo</div>
              <div className="text-xl font-bold">{analytics.rendimiento.tiempoMaximoEntrega.toFixed(1)}h</div>
            </div>
          </div>
        </div>
      )}

      {/* Distribución de calificaciones */}
      {analytics && analytics.totalCalificaciones > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Star className="w-5 h-5" />
            Distribución de Calificaciones
          </h3>
          <div className="flex items-center gap-4 mb-4">
            <div className={`text-4xl font-bold ${getCalificacionColor(analytics.calificacionPromedio)}`}>
              {analytics.calificacionPromedio.toFixed(1)}
            </div>
            <div className="flex">
              {[1, 2, 3, 4, 5].map(star => (
                <Star
                  key={star}
                  className={`w-6 h-6 ${star <= Math.round(analytics.calificacionPromedio) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                />
              ))}
            </div>
            <div className="text-sm text-gray-500">
              ({analytics.totalCalificaciones} calificaciones)
            </div>
          </div>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map(star => {
              const count = analytics.distribucionCalificaciones[star] || 0;
              const percent = analytics.totalCalificaciones > 0
                ? (count / analytics.totalCalificaciones) * 100
                : 0;
              return (
                <div key={star} className="flex items-center gap-2">
                  <div className="w-8 text-sm">{star} ★</div>
                  <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        star >= 4 ? 'bg-green-500' : star >= 3 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="w-16 text-right text-sm text-gray-500">{count} ({formatPercent(percent)})</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ROI detallado */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Análisis ROI
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Valor Entregas</div>
              <div className="text-xl font-bold">{formatCurrency(analytics.roi.valorEntregasCompletadas)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Costo Total</div>
              <div className="text-xl font-bold">{formatCurrency(analytics.roi.costoTotal)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Margen Neto</div>
              <div className={`text-xl font-bold ${analytics.roi.margenNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(analytics.roi.margenNeto)}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Costo Oportunidad</div>
              <div className="text-xl font-bold text-red-600">{formatCurrency(analytics.roi.costoOportunidadFallos)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Predicciones */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Predicciones (próximos 30 días)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Entregas Estimadas</div>
              <div className="text-xl font-bold">{analytics.predicciones.entregasEstimadas30Dias}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Costo Estimado</div>
              <div className="text-xl font-bold">{formatCurrency(analytics.predicciones.costoEstimado30Dias)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Tasa Éxito Proyectada</div>
              <div className="text-xl font-bold">{formatPercent(analytics.predicciones.tasaExitoProyectada)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Riesgo Rotación</div>
              <div className={`text-xl font-bold ${
                analytics.predicciones.riesgoRotacion > 20 ? 'text-red-600' :
                analytics.predicciones.riesgoRotacion > 10 ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {formatPercent(analytics.predicciones.riesgoRotacion)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comentarios recientes */}
      {analytics && analytics.comentariosRecientes.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Comentarios de Clientes</h3>
          <div className="space-y-3">
            {analytics.comentariosRecientes.map((comentario, idx) => (
              <div key={idx} className={`p-3 rounded-lg border ${
                comentario.esPositivo ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{comentario.clienteNombre}</span>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${star <= comentario.calificacion ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{comentario.comentario}</p>
                  </div>
                  <div className="text-xs text-gray-500">{formatDate(comentario.fecha)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Renderizar pestaña Comparativa
  const renderComparativa = () => (
    <div className="space-y-6">
      {/* Ranking */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ranking de Transportistas</h3>
          <div className="flex items-center gap-4 mb-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600">#{analytics.rankingGeneral}</div>
              <div className="text-sm text-gray-500">de {analytics.totalTransportistas}</div>
            </div>
            <div className="flex-1">
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${analytics.percentilRendimiento}%` }}
                />
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Percentil {analytics.percentilRendimiento}% de rendimiento
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparativa detallada */}
      {analytics && analytics.comparativaTransportistas.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparativa con Otros Transportistas</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">#</th>
                  <th className="text-left py-2 px-2">Transportista</th>
                  <th className="text-left py-2 px-2">Tipo</th>
                  <th className="text-right py-2 px-2">Entregas</th>
                  <th className="text-right py-2 px-2">Tasa Éxito</th>
                  <th className="text-right py-2 px-2">Tiempo Prom.</th>
                  <th className="text-right py-2 px-2">Costo Prom.</th>
                  <th className="text-center py-2 px-2">Calif.</th>
                  <th className="text-center py-2 px-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {analytics.comparativaTransportistas.slice(0, 10).map((comp, idx) => (
                  <tr
                    key={idx}
                    className={`border-b ${comp.transportistaId === transportista.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="py-2 px-2 font-bold">
                      {comp.ranking <= 3 ? (
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                          comp.ranking === 1 ? 'bg-yellow-100 text-yellow-700' :
                          comp.ranking === 2 ? 'bg-gray-100 text-gray-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {comp.ranking}
                        </span>
                      ) : comp.ranking}
                    </td>
                    <td className="py-2 px-2">
                      <div className="font-medium">{comp.nombre}</div>
                      <div className="text-xs text-gray-500">{comp.codigo}</div>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        comp.tipo === 'interno' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {comp.tipo}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">{comp.entregas}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={`font-medium ${
                        comp.tasaExito >= 90 ? 'text-green-600' :
                        comp.tasaExito >= 80 ? 'text-blue-600' :
                        comp.tasaExito >= 70 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {formatPercent(comp.tasaExito)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">{comp.tiempoPromedio.toFixed(1)}h</td>
                    <td className="py-2 px-2 text-right">{formatCurrency(comp.costoPromedio)}</td>
                    <td className="py-2 px-2 text-center">
                      <span className={getCalificacionColor(comp.calificacion)}>
                        {comp.calificacion.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      {comp.esRecomendado ? (
                        <Award className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: BarChart3 },
    { id: 'entregas', label: 'Entregas', icon: Package },
    { id: 'zonas', label: 'Zonas', icon: MapPin },
    { id: 'analisis', label: 'Análisis', icon: Target },
    { id: 'comparativa', label: 'Comparativa', icon: Users }
  ] as const;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-100 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Truck className={`w-6 h-6 ${transportista.tipo === 'interno' ? 'text-blue-600' : 'text-purple-600'}`} />
            <div>
              <h2 className="text-xl font-bold text-gray-900">{transportista.nombre}</h2>
              <p className="text-sm text-gray-500">
                {transportista.codigo} - {transportista.tipo}
                {transportista.courierExterno && ` (${transportista.courierExterno})`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b px-6">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {activeTab === 'resumen' && renderResumen()}
              {activeTab === 'entregas' && renderEntregas()}
              {activeTab === 'zonas' && renderZonas()}
              {activeTab === 'analisis' && renderAnalisis()}
              {activeTab === 'comparativa' && renderComparativa()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
