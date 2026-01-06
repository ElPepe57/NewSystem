import { useState, useEffect } from 'react';
import {
  User, Phone, Mail, MapPin, Calendar, ShoppingCart, DollarSign,
  TrendingUp, TrendingDown, Package, Star, AlertTriangle, Clock,
  BarChart3, Target, Award, RefreshCw, ExternalLink, MessageSquare
} from 'lucide-react';
import type { Cliente } from '../../types/entidadesMaestras.types';
import {
  clienteAnalyticsService,
  type ClienteAnalytics,
  type CompraHistorial,
  type ProductoFavorito
} from '../../services/cliente.analytics.service';

type DetailTab = 'resumen' | 'historial' | 'productos' | 'analytics' | 'predicciones';

interface ClienteDetailViewProps {
  cliente: Cliente;
  onClose: () => void;
  onEdit?: () => void;
  onWhatsApp?: (telefono: string) => void;
}

export function ClienteDetailView({ cliente, onClose, onEdit, onWhatsApp }: ClienteDetailViewProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('resumen');
  const [analytics, setAnalytics] = useState<ClienteAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [cliente.id]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await clienteAnalyticsService.getClienteAnalytics(cliente.id);
      setAnalytics(data);
    } catch (error) {
      console.error('Error cargando analytics:', error);
    }
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
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
      case 'A': return 'bg-green-100 text-green-800 border-green-300';
      case 'B': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSegmentoIcon = (segmento?: string) => {
    switch (segmento) {
      case 'vip': return <Award className="w-4 h-4 text-yellow-500" />;
      case 'premium': return <Star className="w-4 h-4 text-purple-500" />;
      case 'frecuente': return <RefreshCw className="w-4 h-4 text-blue-500" />;
      case 'en_riesgo': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'perdido': return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTendenciaIcon = (tendencia?: string) => {
    switch (tendencia) {
      case 'creciendo':
      case 'aumentando':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'decreciendo':
      case 'disminuyendo':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <span className="text-gray-400">-</span>;
    }
  };

  // Renderizar pestaña Resumen
  const renderResumen = () => (
    <div className="space-y-6">
      {/* Info del cliente */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start gap-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
            cliente.clasificacionABC === 'A' ? 'bg-green-100 text-green-600' :
            cliente.clasificacionABC === 'B' ? 'bg-blue-100 text-blue-600' :
            'bg-gray-100 text-gray-600'
          }`}>
            {cliente.nombre.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900">{cliente.nombre}</h2>
              {cliente.clasificacionABC && (
                <span className={`px-2 py-1 text-sm font-bold rounded-full border ${getClasificacionColor(cliente.clasificacionABC)}`}>
                  Clase {cliente.clasificacionABC}
                </span>
              )}
            </div>
            <p className="text-gray-500">{cliente.codigo}</p>

            <div className="flex flex-wrap gap-4 mt-3">
              {cliente.telefono && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  {cliente.telefono}
                </div>
              )}
              {cliente.email && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  {cliente.email}
                </div>
              )}
              {cliente.direccionPrincipal && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  {cliente.direccionPrincipal}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-3">
              {cliente.segmento && (
                <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                  {getSegmentoIcon(cliente.segmento)}
                  {cliente.segmento.replace('_', ' ')}
                </span>
              )}
              <span className={`px-2 py-1 text-xs rounded-full ${
                cliente.estado === 'activo' ? 'bg-green-100 text-green-800' :
                cliente.estado === 'inactivo' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {cliente.estado}
              </span>
              <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                {cliente.canalOrigen}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {cliente.telefono && onWhatsApp && (
              <button
                onClick={() => onWhatsApp(cliente.telefono!)}
                className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                title="WhatsApp"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            )}
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
              <ShoppingCart className="w-4 h-4" />
              Total Compras
            </div>
            <div className="text-2xl font-bold text-gray-900">{analytics.totalCompras}</div>
            <div className="text-xs text-gray-500">
              {analytics.diasComoCliente} dias como cliente
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <DollarSign className="w-4 h-4" />
              Gasto Total
            </div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(analytics.gastoTotalHistorico)}</div>
            <div className="flex items-center gap-1 text-xs">
              {getTendenciaIcon(analytics.tendenciaGasto)}
              <span className={analytics.tasaCrecimiento >= 0 ? 'text-green-600' : 'text-red-600'}>
                {analytics.tasaCrecimiento >= 0 ? '+' : ''}{analytics.tasaCrecimiento.toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Target className="w-4 h-4" />
              Ticket Promedio
            </div>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(analytics.ticketPromedio)}</div>
            <div className="text-xs text-gray-500">
              Max: {formatCurrency(analytics.ticketMaximo)}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              Frecuencia
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {analytics.frecuenciaCompraDias > 0 ? `${analytics.frecuenciaCompraDias}d` : '-'}
            </div>
            <div className="flex items-center gap-1 text-xs">
              {getTendenciaIcon(analytics.tendenciaFrecuencia)}
              <span className="text-gray-500">{analytics.comprasPorMes.toFixed(1)} compras/mes</span>
            </div>
          </div>
        </div>
      )}

      {/* Ultima compra y Predicciones */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ultima actividad */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Ultima Actividad
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Primera compra:</span>
                <span className="font-medium">
                  {analytics.primeraCompra ? formatDate(analytics.primeraCompra) : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ultima compra:</span>
                <span className="font-medium">
                  {analytics.ultimaCompra ? formatDate(analytics.ultimaCompra) : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Dias sin comprar:</span>
                <span className={`font-medium ${
                  analytics.diasDesdeUltimaCompra > 90 ? 'text-red-600' :
                  analytics.diasDesdeUltimaCompra > 30 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {analytics.diasDesdeUltimaCompra} dias
                </span>
              </div>
              {analytics.predicciones.proximaCompraEstimada && (
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-500">Proxima compra estimada:</span>
                  <span className="font-medium text-blue-600">
                    {formatDate(analytics.predicciones.proximaCompraEstimada)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Predicciones rápidas */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Predicciones
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Prob. recompra (30d):</span>
                  <span className={`font-medium ${
                    analytics.predicciones.probabilidadRecompra30Dias >= 60 ? 'text-green-600' :
                    analytics.predicciones.probabilidadRecompra30Dias >= 30 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {analytics.predicciones.probabilidadRecompra30Dias}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      analytics.predicciones.probabilidadRecompra30Dias >= 60 ? 'bg-green-500' :
                      analytics.predicciones.probabilidadRecompra30Dias >= 30 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${analytics.predicciones.probabilidadRecompra30Dias}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Riesgo de perdida:</span>
                  <span className={`font-medium ${
                    analytics.predicciones.probabilidadChurn <= 20 ? 'text-green-600' :
                    analytics.predicciones.probabilidadChurn <= 50 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {analytics.predicciones.probabilidadChurn}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      analytics.predicciones.probabilidadChurn <= 20 ? 'bg-green-500' :
                      analytics.predicciones.probabilidadChurn <= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${analytics.predicciones.probabilidadChurn}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t">
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor de vida estimado:</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(analytics.predicciones.valorVidaEstimado)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Productos favoritos y alertas */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top productos */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Productos Favoritos
            </h3>
            <div className="space-y-3">
              {analytics.productosFavoritos.slice(0, 5).map((prod, idx) => (
                <div key={prod.productoId} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : 'bg-blue-400'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{prod.nombre}</div>
                    <div className="text-xs text-gray-500">
                      {prod.vecesComprado}x comprado - {prod.unidadesTotales} unidades
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">{formatCurrency(prod.gastoTotal)}</div>
                  </div>
                </div>
              ))}
              {analytics.productosFavoritos.length === 0 && (
                <div className="text-center text-gray-500 py-4">Sin compras registradas</div>
              )}
            </div>
          </div>

          {/* Alertas de recompra */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Alertas de Recompra
            </h3>
            <div className="space-y-3">
              {analytics.alertasRecompra.slice(0, 5).map(alerta => (
                <div
                  key={alerta.productoId}
                  className={`p-3 rounded-lg ${
                    alerta.urgencia === 'alta' ? 'bg-red-50 border border-red-200' :
                    alerta.urgencia === 'media' ? 'bg-yellow-50 border border-yellow-200' :
                    'bg-blue-50 border border-blue-200'
                  }`}
                >
                  <div className="font-medium text-gray-900">{alerta.nombre}</div>
                  <div className="text-sm text-gray-600">
                    Hace {alerta.diasDesdeCompra} dias (ciclo: {alerta.cicloEstimado}d)
                  </div>
                </div>
              ))}
              {analytics.alertasRecompra.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  Sin alertas de recompra activas
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ranking */}
      {analytics && analytics.rankingGeneral > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Ranking General</h3>
              <p className="text-gray-600">
                Este cliente esta en el top <strong>{Math.round((analytics.rankingGeneral / analytics.totalClientes) * 100)}%</strong> de tus clientes
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-purple-600">#{analytics.rankingGeneral}</div>
              <div className="text-sm text-gray-500">de {analytics.totalClientes} clientes</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Renderizar pestaña Historial
  const renderHistorial = () => (
    <div className="space-y-4">
      {analytics && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900">Historial de Compras ({analytics.totalCompras})</h3>
          </div>
          <div className="divide-y">
            {analytics.historialCompras.map(compra => (
              <div key={compra.ventaId} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-gray-900">{compra.numeroVenta}</div>
                    <div className="text-sm text-gray-500">
                      {formatDate(compra.fecha)}
                      {compra.diasDesdeCompraAnterior !== undefined && (
                        <span className="ml-2 text-xs text-gray-400">
                          ({compra.diasDesdeCompraAnterior} dias desde anterior)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">{formatCurrency(compra.totalPEN)}</div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      compra.estado === 'entregada' ? 'bg-green-100 text-green-800' :
                      compra.estado === 'cancelada' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {compra.estado}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  {compra.productos.map((prod, idx) => (
                    <div key={idx} className="flex justify-between text-sm text-gray-600">
                      <span>
                        {prod.cantidad}x {prod.nombre}
                        <span className="text-gray-400 ml-1">({prod.marca})</span>
                      </span>
                      <span>{formatCurrency(prod.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {analytics.historialCompras.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No hay compras registradas
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Renderizar pestaña Productos
  const renderProductos = () => (
    <div className="space-y-6">
      {analytics && (
        <>
          {/* Estadísticas de productos */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{analytics.totalProductosUnicos}</div>
              <div className="text-sm text-gray-500">Productos diferentes</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{analytics.totalUnidadesCompradas}</div>
              <div className="text-sm text-gray-500">Unidades totales</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-3xl font-bold text-purple-600">{analytics.marcasPreferidas.length}</div>
              <div className="text-sm text-gray-500">Marcas compradas</div>
            </div>
          </div>

          {/* Productos favoritos detallados */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900">Productos Favoritos</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-right">Compras</th>
                  <th className="px-4 py-3 text-right">Unidades</th>
                  <th className="px-4 py-3 text-right">Gasto</th>
                  <th className="px-4 py-3 text-right">Frecuencia</th>
                  <th className="px-4 py-3 text-right">Ultima</th>
                  <th className="px-4 py-3 text-right">Proxima Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analytics.productosFavoritos.map(prod => (
                  <tr key={prod.productoId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{prod.nombre}</div>
                      <div className="text-xs text-gray-500">{prod.sku} - {prod.marca}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">{prod.vecesComprado}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{prod.unidadesTotales}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">
                      {formatCurrency(prod.gastoTotal)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {prod.frecuenciaPromedioDias > 0 ? `${prod.frecuenciaPromedioDias}d` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatDate(prod.ultimaCompra)}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600">
                      {prod.proximaCompraEstimada ? formatDate(prod.proximaCompraEstimada) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Marcas preferidas */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Marcas Preferidas</h3>
            <div className="space-y-3">
              {analytics.marcasPreferidas.map(marca => (
                <div key={marca.marca} className="flex items-center gap-3">
                  <div className="w-32 font-medium text-gray-900">{marca.marca}</div>
                  <div className="flex-1">
                    <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full"
                        style={{ width: `${marca.porcentajeGasto}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-24 text-right">
                    <div className="font-medium text-gray-900">{formatPercent(marca.porcentajeGasto)}</div>
                    <div className="text-xs text-gray-500">{formatCurrency(marca.gastoTotal)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Categorías */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Categorias Preferidas</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {analytics.categoriasPreferidas.slice(0, 8).map(cat => (
                <div key={cat.categoria} className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-lg font-bold text-gray-900">{formatPercent(cat.porcentaje)}</div>
                  <div className="text-sm text-gray-600">{cat.categoria}</div>
                  <div className="text-xs text-gray-400">{formatCurrency(cat.gasto)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // Renderizar pestaña Analytics
  const renderAnalytics = () => (
    <div className="space-y-6">
      {analytics && (
        <>
          {/* Gastos por período */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Ultimos 30 dias</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(analytics.gastoUltimos30Dias)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Ultimos 90 dias</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(analytics.gastoUltimos90Dias)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Ultimos 365 dias</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(analytics.gastoUltimos365Dias)}
              </div>
            </div>
          </div>

          {/* Historial mensual */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Historial Mensual</h3>
            <div className="space-y-2">
              {analytics.metricasPorMes.slice(-12).map(mes => {
                const maxGasto = Math.max(...analytics.metricasPorMes.map(m => m.gastoPEN));
                const porcentaje = maxGasto > 0 ? (mes.gastoPEN / maxGasto) * 100 : 0;

                return (
                  <div key={mes.periodo} className="flex items-center gap-3">
                    <div className="w-20 text-sm text-gray-500">{mes.periodo}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(porcentaje, 5)}%` }}
                      >
                        {porcentaje > 20 && (
                          <span className="text-xs text-white font-medium">
                            {formatCurrency(mes.gastoPEN)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-16 text-sm text-gray-500 text-right">
                      {mes.compras} compras
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Patrones detectados */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Patrones de Comportamiento</h3>
            {analytics.patronesCompra.length > 0 ? (
              <div className="space-y-3">
                {analytics.patronesCompra.map((patron, idx) => (
                  <div key={idx} className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          patron.tipo === 'frecuencia' ? 'bg-blue-100 text-blue-800' :
                          patron.tipo === 'monto' ? 'bg-green-100 text-green-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {patron.tipo}
                        </span>
                        <p className="mt-2 text-gray-900">{patron.descripcion}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Confianza</div>
                        <div className="font-bold text-blue-600">{formatPercent(patron.confianza)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                Se necesitan mas compras para detectar patrones
              </div>
            )}
          </div>

          {/* Comparación */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Comparacion con otros clientes</h3>
            <div className="space-y-4">
              {analytics.comparaciones.map(comp => (
                <div key={comp.metrica} className="flex items-center gap-4">
                  <div className="w-32 text-sm text-gray-600">{comp.metrica}</div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">
                        {comp.metrica === 'Gasto Total' || comp.metrica === 'Ticket Promedio'
                          ? formatCurrency(comp.valorCliente)
                          : comp.valorCliente.toFixed(0)}
                      </span>
                      <span className="text-gray-500">
                        Prom: {comp.metrica === 'Gasto Total' || comp.metrica === 'Ticket Promedio'
                          ? formatCurrency(comp.promedioGeneral)
                          : comp.promedioGeneral.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    comp.comparacion === 'superior' ? 'bg-green-100 text-green-800' :
                    comp.comparacion === 'inferior' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {comp.comparacion}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // Renderizar pestaña Predicciones
  const renderPredicciones = () => (
    <div className="space-y-6">
      {analytics && (
        <>
          {/* Métricas predictivas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h4 className="text-sm text-gray-500 mb-2">Probabilidad de Recompra (30 dias)</h4>
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${
                  analytics.predicciones.probabilidadRecompra30Dias >= 60 ? 'text-green-600' :
                  analytics.predicciones.probabilidadRecompra30Dias >= 30 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {analytics.predicciones.probabilidadRecompra30Dias}%
                </div>
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full ${
                        analytics.predicciones.probabilidadRecompra30Dias >= 60 ? 'bg-green-500' :
                        analytics.predicciones.probabilidadRecompra30Dias >= 30 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${analytics.predicciones.probabilidadRecompra30Dias}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h4 className="text-sm text-gray-500 mb-2">Riesgo de Perdida (Churn)</h4>
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${
                  analytics.predicciones.probabilidadChurn <= 20 ? 'text-green-600' :
                  analytics.predicciones.probabilidadChurn <= 50 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {analytics.predicciones.probabilidadChurn}%
                </div>
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full ${
                        analytics.predicciones.probabilidadChurn <= 20 ? 'bg-green-500' :
                        analytics.predicciones.probabilidadChurn <= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${analytics.predicciones.probabilidadChurn}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Valor de vida */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg p-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg opacity-90">Valor de Vida Estimado (CLV)</h3>
                <p className="text-sm opacity-75">Proyeccion a 3 años basada en comportamiento historico</p>
              </div>
              <div className="text-4xl font-bold">
                {formatCurrency(analytics.predicciones.valorVidaEstimado)}
              </div>
            </div>
          </div>

          {/* Productos probables */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Productos Probables en Proxima Compra</h3>
            <div className="grid grid-cols-3 gap-4">
              {analytics.predicciones.productosProbables.map((prod, idx) => (
                <div key={idx} className="p-4 bg-blue-50 rounded-lg text-center">
                  <div className="text-2xl mb-2">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</div>
                  <div className="font-medium text-gray-900">{prod}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Oportunidades cross-sell */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Oportunidades de Venta Cruzada</h3>
            {analytics.oportunidadesCrossSell.length > 0 ? (
              <div className="space-y-3">
                {analytics.oportunidadesCrossSell.map(op => (
                  <div key={op.productoId} className="flex items-center gap-4 p-3 bg-purple-50 rounded-lg">
                    <Package className="w-8 h-8 text-purple-500" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{op.nombre}</div>
                      <div className="text-sm text-gray-600">{op.razon}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-purple-600">{op.probabilidad}%</div>
                      <div className="text-xs text-gray-500">probabilidad</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                No hay oportunidades de cross-sell identificadas
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando analytics del cliente...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-100 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
              cliente.clasificacionABC === 'A' ? 'bg-green-100 text-green-600' :
              cliente.clasificacionABC === 'B' ? 'bg-blue-100 text-blue-600' :
              'bg-gray-100 text-gray-600'
            }`}>
              {cliente.nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{cliente.nombre}</h1>
              <p className="text-sm text-gray-500">{cliente.codigo} - Analytics Detallado</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b px-6">
          <nav className="flex gap-4">
            {[
              { id: 'resumen', label: 'Resumen', icon: User },
              { id: 'historial', label: 'Historial', icon: ShoppingCart },
              { id: 'productos', label: 'Productos', icon: Package },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'predicciones', label: 'Predicciones', icon: Target }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as DetailTab)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'resumen' && renderResumen()}
          {activeTab === 'historial' && renderHistorial()}
          {activeTab === 'productos' && renderProductos()}
          {activeTab === 'analytics' && renderAnalytics()}
          {activeTab === 'predicciones' && renderPredicciones()}
        </div>
      </div>
    </div>
  );
}
