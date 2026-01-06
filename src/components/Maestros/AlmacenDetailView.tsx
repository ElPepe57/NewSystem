import { useState, useEffect } from 'react';
import {
  Warehouse, MapPin, Phone, Mail, Calendar, Package, DollarSign,
  TrendingUp, TrendingDown, AlertTriangle, Clock, BarChart3, Truck,
  RefreshCw, ArrowRight, ArrowLeft, Plane, Users, Star, X,
  ChevronRight, Activity, Target, Zap, AlertCircle, CheckCircle
} from 'lucide-react';
import type { Almacen } from '../../types/almacen.types';
import {
  almacenAnalyticsService,
  type AlmacenAnalytics,
  type ProductoInventario,
  type RotacionProducto,
  type AlertaAlmacen
} from '../../services/almacen.analytics.service';

type DetailTab = 'resumen' | 'inventario' | 'movimientos' | 'analisis' | 'comparativa';

interface AlmacenDetailViewProps {
  almacen: Almacen;
  onClose: () => void;
  onEdit?: () => void;
}

export function AlmacenDetailView({ almacen, onClose, onEdit }: AlmacenDetailViewProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('resumen');
  const [analytics, setAnalytics] = useState<AlmacenAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [almacen.id]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await almacenAnalyticsService.getAlmacenAnalytics(almacen.id);
      setAnalytics(data);
    } catch (error) {
      console.error('Error cargando analytics:', error);
    }
    setLoading(false);
  };

  const formatCurrency = (value: number, currency: 'USD' | 'PEN' = 'USD') => {
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

  const getClasificacionColor = (clasificacion?: string) => {
    switch (clasificacion) {
      case 'excelente': return 'bg-green-100 text-green-800 border-green-300';
      case 'bueno': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'regular': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'deficiente': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTendenciaIcon = (tendencia?: string) => {
    switch (tendencia) {
      case 'creciendo':
      case 'mejorando':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'decreciendo':
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

  const getRotacionColor = (rotacion: string) => {
    switch (rotacion) {
      case 'alta': return 'text-green-600 bg-green-100';
      case 'normal': return 'text-blue-600 bg-blue-100';
      case 'baja': return 'text-yellow-600 bg-yellow-100';
      case 'estancado': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Renderizar pestaña Resumen
  const renderResumen = () => (
    <div className="space-y-6">
      {/* Info del almacén */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start gap-4">
          <div className={`w-16 h-16 rounded-lg flex items-center justify-center text-2xl font-bold ${
            almacen.esViajero ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
          }`}>
            {almacen.esViajero ? <Plane className="w-8 h-8" /> : <Warehouse className="w-8 h-8" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900">{almacen.nombre}</h2>
              {almacen.evaluacion && (
                <span className={`px-2 py-1 text-sm font-bold rounded-full border ${getClasificacionColor(almacen.evaluacion.clasificacion)}`}>
                  {almacen.evaluacion.clasificacion}
                </span>
              )}
            </div>
            <p className="text-gray-500">{almacen.codigo}</p>

            <div className="flex flex-wrap gap-4 mt-3">
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <MapPin className="w-4 h-4" />
                {almacen.ciudad}, {almacen.pais}
              </div>
              {almacen.telefono && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  {almacen.telefono}
                </div>
              )}
              {almacen.email && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  {almacen.email}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-3">
              <span className={`px-2 py-1 text-xs rounded-full ${
                almacen.estadoAlmacen === 'activo' ? 'bg-green-100 text-green-800' :
                almacen.estadoAlmacen === 'inactivo' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {almacen.estadoAlmacen}
              </span>
              <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                {almacen.esViajero ? 'Viajero' : almacen.tipo}
              </span>
              <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                {almacen.pais}
              </span>
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
              Unidades
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {analytics.inventarioActual.unidadesTotales}
            </div>
            <div className="text-xs text-gray-500">
              {analytics.inventarioActual.productosUnicos} productos únicos
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <DollarSign className="w-4 h-4" />
              Valor Inventario
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(analytics.inventarioActual.valorTotalUSD)}
            </div>
            <div className="text-xs text-gray-500">
              {formatCurrency(analytics.inventarioActual.valorTotalPEN, 'PEN')}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Activity className="w-4 h-4" />
              Capacidad
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatPercent(analytics.inventarioActual.porcentajeCapacidad)}
            </div>
            <div className="flex items-center gap-1 text-xs">
              {getTendenciaIcon(analytics.tendenciaCapacidad)}
              <span className="text-gray-500">{analytics.tendenciaCapacidad}</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Star className="w-4 h-4" />
              Evaluación
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {analytics.evaluacionActual}/100
            </div>
            <div className="flex items-center gap-1 text-xs">
              {getTendenciaIcon(analytics.tendenciaEvaluacion)}
              <span className="text-gray-500">{analytics.clasificacionActual}</span>
            </div>
          </div>
        </div>
      )}

      {/* Métricas de viajero */}
      {analytics?.metricasViajero && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Plane className="w-5 h-5" />
            Métricas de Viajero
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">Total Viajes</div>
              <div className="text-xl font-bold">{analytics.metricasViajero.totalViajes}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Último 30 días</div>
              <div className="text-xl font-bold">{analytics.metricasViajero.viajesUltimos30Dias}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Puntualidad</div>
              <div className="text-xl font-bold">{formatPercent(analytics.metricasViajero.tasaPuntualidad)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Próximo Viaje</div>
              <div className="text-xl font-bold">
                {analytics.metricasViajero.diasParaProximoViaje !== undefined
                  ? `${analytics.metricasViajero.diasParaProximoViaje} días`
                  : 'Sin programar'}
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

  // Renderizar pestaña Inventario
  const renderInventario = () => (
    <div className="space-y-6">
      {/* Distribución por categoría */}
      {analytics && analytics.distribucionPorCategoria.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución por Marca/Categoría</h3>
          <div className="space-y-3">
            {analytics.distribucionPorCategoria.slice(0, 8).map((cat, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-32 text-sm font-medium truncate">{cat.categoria}</div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${cat.porcentajeValor}%` }}
                    />
                  </div>
                </div>
                <div className="w-20 text-right text-sm">{formatPercent(cat.porcentajeValor)}</div>
                <div className="w-24 text-right text-sm font-medium">{formatCurrency(cat.valorUSD)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Productos en inventario */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Productos en Inventario ({analytics.productosInventario.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">SKU</th>
                  <th className="text-left py-2 px-2">Producto</th>
                  <th className="text-left py-2 px-2">Marca</th>
                  <th className="text-right py-2 px-2">Cant.</th>
                  <th className="text-right py-2 px-2">Valor USD</th>
                  <th className="text-right py-2 px-2">Días</th>
                  <th className="text-center py-2 px-2">Rotación</th>
                </tr>
              </thead>
              <tbody>
                {analytics.productosInventario.slice(0, 20).map((prod, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2 font-mono text-xs">{prod.sku}</td>
                    <td className="py-2 px-2">{prod.nombre}</td>
                    <td className="py-2 px-2 text-gray-500">{prod.marca}</td>
                    <td className="py-2 px-2 text-right font-medium">{prod.cantidad}</td>
                    <td className="py-2 px-2 text-right">{formatCurrency(prod.valorTotalUSD)}</td>
                    <td className="py-2 px-2 text-right">{prod.diasEnAlmacen}</td>
                    <td className="py-2 px-2 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${getRotacionColor(prod.rotacion)}`}>
                        {prod.rotacion}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Productos próximos a vencer */}
      {analytics && analytics.productosProximosVencer.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Productos Próximos a Vencer ({analytics.productosProximosVencer.length})
          </h3>
          <div className="space-y-2">
            {analytics.productosProximosVencer.map((prod, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div>
                  <div className="font-medium">{prod.sku} - {prod.nombre}</div>
                  <div className="text-sm text-gray-500">{prod.cantidad} unidades</div>
                </div>
                <div className="text-right">
                  <div className="text-red-600 font-bold">
                    {prod.diasParaVencer} días
                  </div>
                  <div className="text-sm text-gray-500">{formatCurrency(prod.valorTotalUSD)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Renderizar pestaña Movimientos
  const renderMovimientos = () => (
    <div className="space-y-6">
      {/* Resumen de movimientos */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Mov. últimos 30 días</div>
            <div className="text-2xl font-bold">{analytics.movimientosUltimos30Dias}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Promedio diario</div>
            <div className="text-2xl font-bold">{analytics.promedioMovimientosDiarios.toFixed(1)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Trans. Enviadas</div>
            <div className="text-2xl font-bold text-orange-600">{analytics.transferenciasEnviadas}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Trans. Recibidas</div>
            <div className="text-2xl font-bold text-green-600">{analytics.transferenciasRecibidas}</div>
          </div>
        </div>
      )}

      {/* Historial de movimientos */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Movimientos Recientes
          </h3>
          <div className="space-y-3">
            {analytics.movimientosHistorial.slice(0, 15).map((mov, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  mov.tipo === 'entrada' || mov.tipo === 'transferencia_entrada'
                    ? 'bg-green-100 text-green-600'
                    : 'bg-orange-100 text-orange-600'
                }`}>
                  {mov.tipo === 'entrada' || mov.tipo === 'transferencia_entrada'
                    ? <ArrowRight className="w-5 h-5" />
                    : <ArrowLeft className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{mov.productoNombre}</div>
                  <div className="text-sm text-gray-500">
                    {mov.tipo.replace('_', ' ')} - {mov.cantidad} unidades
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">{formatDate(mov.fecha)}</div>
                  <div className="text-sm text-gray-500">{formatCurrency(mov.valorUSD)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transferencias */}
      {analytics && analytics.transferenciasHistorial.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Historial de Transferencias
          </h3>
          <div className="space-y-3">
            {analytics.transferenciasHistorial.slice(0, 10).map((trans, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 border rounded-lg">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  trans.tipoMovimiento === 'entrada'
                    ? 'bg-green-100 text-green-600'
                    : 'bg-orange-100 text-orange-600'
                }`}>
                  <Truck className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">
                    {trans.tipoMovimiento === 'entrada' ? 'Desde' : 'Hacia'}:{' '}
                    {trans.tipoMovimiento === 'entrada' ? trans.almacenOrigenNombre : trans.almacenDestinoNombre}
                  </div>
                  <div className="text-sm text-gray-500">
                    {trans.totalUnidades} unidades - {trans.estado}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">{formatDate(trans.fecha)}</div>
                  <div className="text-sm font-medium">{formatCurrency(trans.valorTotalUSD)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Renderizar pestaña Análisis
  const renderAnalisis = () => (
    <div className="space-y-6">
      {/* Rotación de productos */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Análisis de Rotación</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-3 bg-green-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{analytics.productosAltaRotacion.length}</div>
              <div className="text-sm text-gray-600">Alta Rotación</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">
                {analytics.rotacionProductos.filter(p => p.tendencia === 'normal').length}
              </div>
              <div className="text-sm text-gray-600">Rotación Normal</div>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {analytics.rotacionProductos.filter(p => p.tendencia === 'baja').length}
              </div>
              <div className="text-sm text-gray-600">Baja Rotación</div>
            </div>
            <div className="p-3 bg-red-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-600">{analytics.productosEstancados.length}</div>
              <div className="text-sm text-gray-600">Estancados</div>
            </div>
          </div>

          {/* Productos estancados */}
          {analytics.productosEstancados.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-900 mb-2">Productos Estancados (más de 90 días)</h4>
              <div className="space-y-2">
                {analytics.productosEstancados.slice(0, 5).map((prod, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-red-50 rounded">
                    <div>
                      <span className="font-mono text-sm">{prod.sku}</span> - {prod.nombre}
                    </div>
                    <div className="text-right">
                      <span className="text-red-600 font-medium">{prod.diasSinMovimiento} días</span>
                      <span className="text-gray-500 ml-2">({prod.stockActual} uds)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Historial de evaluaciones */}
      {analytics && analytics.historialEvaluaciones.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Historial de Evaluaciones</h3>
          <div className="space-y-3">
            {analytics.historialEvaluaciones.slice(-5).reverse().map((eval_, idx) => {
              const fecha = eval_.fecha instanceof Date ? eval_.fecha : eval_.fecha.toDate();
              return (
                <div key={idx} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                    eval_.puntuacion >= 80 ? 'bg-green-100 text-green-600' :
                    eval_.puntuacion >= 60 ? 'bg-blue-100 text-blue-600' :
                    eval_.puntuacion >= 40 ? 'bg-yellow-100 text-yellow-600' :
                    'bg-red-100 text-red-600'
                  }`}>
                    {eval_.puntuacion}
                  </div>
                  <div className="flex-1">
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div>Conservación: {eval_.factores.conservacionProductos}</div>
                      <div>Tiempo Resp.: {eval_.factores.tiempoRespuesta}</div>
                      <div>Cumplimiento: {eval_.factores.cumplimientoFechas}</div>
                      <div>Comunicación: {eval_.factores.comunicacion}</div>
                    </div>
                    {eval_.notas && <div className="text-sm text-gray-500 mt-1">{eval_.notas}</div>}
                  </div>
                  <div className="text-sm text-gray-500">{formatDate(fecha)}</div>
                </div>
              );
            })}
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
              <div className="text-sm text-gray-500">Capacidad Estimada</div>
              <div className="text-xl font-bold">{analytics.predicciones.capacidadEstimada30Dias}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Riesgo Sobrecapacidad</div>
              <div className={`text-xl font-bold ${
                analytics.predicciones.riesgoSobrecapacidad > 50 ? 'text-red-600' :
                analytics.predicciones.riesgoSobrecapacidad > 25 ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {formatPercent(analytics.predicciones.riesgoSobrecapacidad)}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Próximos a Vencer</div>
              <div className="text-xl font-bold text-red-600">{analytics.predicciones.productosProximosVencer}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Valor en Riesgo</div>
              <div className="text-xl font-bold">{formatCurrency(analytics.predicciones.valorEnRiesgoUSD)}</div>
            </div>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ranking de Almacenes</h3>
          <div className="flex items-center gap-4 mb-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600">#{analytics.rankingGeneral}</div>
              <div className="text-sm text-gray-500">de {analytics.totalAlmacenes}</div>
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

      {/* Comparativa */}
      {analytics && analytics.comparativaAlmacenes.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparativa con Otros Almacenes</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">#</th>
                  <th className="text-left py-2 px-2">Almacén</th>
                  <th className="text-left py-2 px-2">Tipo</th>
                  <th className="text-right py-2 px-2">Unidades</th>
                  <th className="text-right py-2 px-2">Capacidad</th>
                  <th className="text-right py-2 px-2">Evaluación</th>
                </tr>
              </thead>
              <tbody>
                {analytics.comparativaAlmacenes.slice(0, 10).map((comp, idx) => (
                  <tr
                    key={idx}
                    className={`border-b ${comp.almacenId === almacen.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="py-2 px-2 font-bold">{comp.ranking}</td>
                    <td className="py-2 px-2">
                      <div className="font-medium">{comp.nombreAlmacen}</div>
                      <div className="text-xs text-gray-500">{comp.codigo}</div>
                    </td>
                    <td className="py-2 px-2">
                      {comp.esViajero ? (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">Viajero</span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">{comp.pais}</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">{comp.unidadesActuales}</td>
                    <td className="py-2 px-2 text-right">{formatPercent(comp.capacidadUtilizada)}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={`font-bold ${
                        comp.evaluacion >= 80 ? 'text-green-600' :
                        comp.evaluacion >= 60 ? 'text-blue-600' :
                        comp.evaluacion >= 40 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {comp.evaluacion}
                      </span>
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
    { id: 'inventario', label: 'Inventario', icon: Package },
    { id: 'movimientos', label: 'Movimientos', icon: Activity },
    { id: 'analisis', label: 'Análisis', icon: Target },
    { id: 'comparativa', label: 'Comparativa', icon: Users }
  ] as const;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-100 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {almacen.esViajero ? <Plane className="w-6 h-6 text-purple-600" /> : <Warehouse className="w-6 h-6 text-blue-600" />}
            <div>
              <h2 className="text-xl font-bold text-gray-900">{almacen.nombre}</h2>
              <p className="text-sm text-gray-500">{almacen.codigo} - {almacen.ciudad}, {almacen.pais}</p>
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
              {activeTab === 'inventario' && renderInventario()}
              {activeTab === 'movimientos' && renderMovimientos()}
              {activeTab === 'analisis' && renderAnalisis()}
              {activeTab === 'comparativa' && renderComparativa()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
