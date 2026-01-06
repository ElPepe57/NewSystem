import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Truck,
  Star,
  Package,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  BarChart3,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  AlertCircle,
  Globe,
  ExternalLink,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Edit2,
  ChevronRight,
  Award,
  Target,
  Shield,
  Zap,
  RefreshCw,
  Scale,
  TrendingUp as ChartLine
} from 'lucide-react';
import { Button, Card, Badge, KPICard, KPIGrid } from '../common';
import { ProveedorAnalyticsService, type ProveedorAnalytics, type ComparativoPrecioProducto } from '../../services/proveedor.analytics.service';
import { useOrdenCompraStore } from '../../store/ordenCompraStore';
import { useProductoStore } from '../../store/productoStore';
import { useProveedorStore } from '../../store/proveedorStore';
import type { Proveedor, ClasificacionProveedor } from '../../types/ordenCompra.types';

interface ProveedorDetailViewProps {
  proveedor: Proveedor;
  onClose: () => void;
  onEdit?: () => void;
}

type TabType = 'resumen' | 'historial' | 'productos' | 'comparativo' | 'predicciones';

export const ProveedorDetailView: React.FC<ProveedorDetailViewProps> = ({
  proveedor,
  onClose,
  onEdit
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('resumen');
  const [analytics, setAnalytics] = useState<ProveedorAnalytics | null>(null);
  const [comparativoPrecios, setComparativoPrecios] = useState<ComparativoPrecioProducto[]>([]);
  const [loading, setLoading] = useState(true);

  const { ordenes: ordenesCompra, fetchOrdenes: fetchOrdenesCompra } = useOrdenCompraStore();
  const { productos, fetchProductos } = useProductoStore();
  const { proveedores } = useProveedorStore();

  // Cargar datos
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Asegurarse de tener los datos necesarios
        if (ordenesCompra.length === 0) await fetchOrdenesCompra();
        if (productos.length === 0) await fetchProductos();

        // Calcular analytics
        const analyticsData = await ProveedorAnalyticsService.getProveedorAnalytics(
          proveedor,
          ordenesCompra,
          productos,
          proveedores
        );
        setAnalytics(analyticsData);

        // Obtener productos compartidos para comparativo
        const productosCompartidos = ProveedorAnalyticsService.getProductosCompartidos(ordenesCompra, 2);
        if (productosCompartidos.length > 0) {
          const comparativos = ProveedorAnalyticsService.compararPreciosProductos(
            productosCompartidos,
            ordenesCompra,
            proveedores
          );
          setComparativoPrecios(comparativos);
        }
      } catch (error) {
        console.error('Error cargando analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [proveedor.id, ordenesCompra.length, productos.length]);

  // Helpers
  const formatCurrency = (value: number, currency: 'USD' | 'PEN' = 'USD') => {
    const symbol = currency === 'USD' ? 'USD ' : 'S/ ';
    return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getClasificacionConfig = (clasificacion?: ClasificacionProveedor) => {
    const configs: Record<ClasificacionProveedor, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
      preferido: { color: 'text-green-700', bg: 'bg-green-100', icon: <Star className="h-4 w-4 fill-green-500 text-green-500" />, label: 'Preferido' },
      aprobado: { color: 'text-blue-700', bg: 'bg-blue-100', icon: <CheckCircle className="h-4 w-4 text-blue-500" />, label: 'Aprobado' },
      condicional: { color: 'text-amber-700', bg: 'bg-amber-100', icon: <AlertCircle className="h-4 w-4 text-amber-500" />, label: 'Condicional' },
      suspendido: { color: 'text-red-700', bg: 'bg-red-100', icon: <XCircle className="h-4 w-4 text-red-500" />, label: 'Suspendido' }
    };
    return configs[clasificacion || 'aprobado'];
  };

  const getTendenciaIcon = (tendencia: 'subiendo' | 'bajando' | 'estable' | 'creciente' | 'decreciente' | 'mejorando' | 'empeorando') => {
    if (tendencia === 'subiendo' || tendencia === 'creciente' || tendencia === 'mejorando') {
      return <ArrowUpRight className="h-4 w-4 text-green-500" />;
    }
    if (tendencia === 'bajando' || tendencia === 'decreciente' || tendencia === 'empeorando') {
      return <ArrowDownRight className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: BarChart3 },
    { id: 'historial', label: 'Historial OC', icon: FileText },
    { id: 'productos', label: 'Productos', icon: Package },
    { id: 'comparativo', label: 'Comparativo', icon: Scale },
    { id: 'predicciones', label: 'Predicciones', icon: Target }
  ];

  const clasificacionConfig = getClasificacionConfig(proveedor.evaluacion?.clasificacion);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 flex items-center gap-4">
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
          <span className="text-gray-700">Cargando analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Truck className="h-7 w-7 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-500 bg-white px-2 py-0.5 rounded">
                  {proveedor.codigo}
                </span>
                <h2 className="text-xl font-bold text-gray-900">{proveedor.nombre}</h2>
                <span className={`flex items-center gap-1 px-2.5 py-1 text-sm font-medium rounded-full ${clasificacionConfig.bg} ${clasificacionConfig.color}`}>
                  {clasificacionConfig.icon}
                  {clasificacionConfig.label}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" />
                  {proveedor.pais}
                </span>
                <span className="capitalize">{proveedor.tipo}</span>
                {proveedor.url && (
                  <a
                    href={proveedor.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-indigo-600 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Sitio web
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <Button variant="secondary" size="sm" onClick={onEdit}>
                <Edit2 className="h-4 w-4 mr-1" />
                Editar
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-200">
          <nav className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB: RESUMEN */}
          {activeTab === 'resumen' && analytics && (
            <div className="space-y-6">
              {/* Alertas */}
              {analytics.alertas.length > 0 && (
                <div className="space-y-2">
                  {analytics.alertas.map((alerta, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        alerta.severidad === 'danger' ? 'bg-red-50 text-red-700' :
                        alerta.severidad === 'warning' ? 'bg-amber-50 text-amber-700' :
                        'bg-blue-50 text-blue-700'
                      }`}
                    >
                      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                      <span className="text-sm">{alerta.mensaje}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* KPIs principales */}
              <KPIGrid columns={5}>
                <KPICard
                  title="Total Compras"
                  value={formatCurrency(analytics.montoTotalUSD)}
                  icon={DollarSign}
                  variant="success"
                  size="sm"
                />
                <KPICard
                  title="Ordenes"
                  value={analytics.totalOrdenes}
                  subtitle={`${analytics.ordenesUltimos90Dias} en 90d`}
                  icon={ShoppingCart}
                  variant="info"
                  size="sm"
                />
                <KPICard
                  title="Orden Promedio"
                  value={formatCurrency(analytics.ordenPromedio)}
                  icon={BarChart3}
                  variant="default"
                  size="sm"
                />
                <KPICard
                  title="Productos"
                  value={analytics.totalProductosDistintos}
                  icon={Package}
                  variant="default"
                  size="sm"
                />
                <KPICard
                  title="Evaluacion"
                  value={`${analytics.puntuacionActual.toFixed(0)}/100`}
                  icon={Award}
                  variant={analytics.puntuacionActual >= 70 ? 'success' : analytics.puntuacionActual >= 50 ? 'warning' : 'danger'}
                  size="sm"
                />
              </KPIGrid>

              {/* Segunda fila de KPIs */}
              <KPIGrid columns={4}>
                <KPICard
                  title="Ultima Orden"
                  value={analytics.diasDesdeUltimaOrden === 999 ? 'Sin ordenes' : `Hace ${analytics.diasDesdeUltimaOrden}d`}
                  icon={Calendar}
                  variant={analytics.diasDesdeUltimaOrden > 60 ? 'warning' : 'default'}
                  size="sm"
                />
                <KPICard
                  title="Frecuencia"
                  value={analytics.frecuenciaCompraDias > 0 ? `${analytics.frecuenciaCompraDias} dias` : 'N/A'}
                  icon={Clock}
                  variant="default"
                  size="sm"
                />
                <KPICard
                  title="Tiempo Entrega"
                  value={`${analytics.tiempoEntregaPromedio.toFixed(1)} dias`}
                  subtitle={`+/- ${analytics.desviacionTiempoEntrega.toFixed(1)}d`}
                  icon={Truck}
                  variant="default"
                  size="sm"
                />
                <KPICard
                  title="Puntualidad"
                  value={`${analytics.tasaPuntualidad.toFixed(0)}%`}
                  icon={CheckCircle}
                  variant={analytics.tasaPuntualidad >= 80 ? 'success' : analytics.tasaPuntualidad >= 60 ? 'warning' : 'danger'}
                  size="sm"
                />
              </KPIGrid>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Producto mas comprado */}
                {analytics.productoMasComprado && (
                  <Card padding="lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Package className="h-5 w-5 text-indigo-600" />
                      Producto Mas Comprado
                    </h3>
                    <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{analytics.productoMasComprado.nombre}</p>
                        <p className="text-sm text-gray-500">
                          {analytics.productoMasComprado.unidades} unidades compradas
                        </p>
                      </div>
                      <Package className="h-8 w-8 text-indigo-400" />
                    </div>
                  </Card>
                )}

                {/* Evaluacion detallada */}
                <Card padding="lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-indigo-600" />
                    Evaluacion SRM
                  </h3>
                  {proveedor.evaluacion ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Calidad Productos</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${(proveedor.evaluacion.factores.calidadProductos / 25) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{proveedor.evaluacion.factores.calidadProductos}/25</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Puntualidad</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${(proveedor.evaluacion.factores.puntualidadEntrega / 25) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{proveedor.evaluacion.factores.puntualidadEntrega}/25</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Competitividad</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${(proveedor.evaluacion.factores.competitividadPrecios / 25) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{proveedor.evaluacion.factores.competitividadPrecios}/25</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Comunicacion</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${(proveedor.evaluacion.factores.comunicacion / 25) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{proveedor.evaluacion.factores.comunicacion}/25</span>
                        </div>
                      </div>
                      <div className="pt-3 border-t mt-3 flex items-center justify-between">
                        <span className="font-medium text-gray-900">Total</span>
                        <div className="flex items-center gap-2">
                          {getTendenciaIcon(analytics.tendenciaEvaluacion)}
                          <span className="text-lg font-bold text-indigo-600">
                            {proveedor.evaluacion.puntuacion.toFixed(0)}/100
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">Sin evaluacion registrada</p>
                  )}
                </Card>
              </div>

              {/* Compras por periodo */}
              <Card padding="lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ChartLine className="h-5 w-5 text-indigo-600" />
                  Compras por Periodo
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(analytics.montoUltimos30DiasUSD)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Ultimos 30 dias</p>
                    <p className="text-xs text-gray-500">{analytics.ordenesUltimos30Dias} ordenes</p>
                  </div>
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <p className="text-2xl font-bold text-indigo-600">
                      {formatCurrency(analytics.montoUltimos90DiasUSD)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Ultimos 90 dias</p>
                    <p className="text-xs text-gray-500">{analytics.ordenesUltimos90Dias} ordenes</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">
                      {formatCurrency(analytics.montoUltimos365DiasUSD)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Ultimo ano</p>
                    <p className="text-xs text-gray-500">{analytics.ordenesUltimos365Dias} ordenes</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* TAB: HISTORIAL */}
          {activeTab === 'historial' && analytics && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Historial de Ordenes de Compra ({analytics.historialOrdenes.length})
                </h3>
              </div>

              {analytics.historialOrdenes.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No hay ordenes de compra registradas</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {analytics.historialOrdenes.map((orden) => (
                    <Card key={orden.ordenId} padding="lg" className="hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="h-12 w-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <FileText className="h-6 w-6 text-indigo-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-medium text-indigo-600">
                                {orden.numeroOrden}
                              </span>
                              <Badge
                                variant={
                                  orden.estado === 'recibida' ? 'success' :
                                  orden.estado === 'en_transito' ? 'info' :
                                  orden.estado === 'cancelada' ? 'danger' : 'default'
                                }
                              >
                                {orden.estado}
                              </Badge>
                              <Badge
                                variant={
                                  orden.estadoPago === 'pagada' ? 'success' :
                                  orden.estadoPago === 'pago_parcial' ? 'warning' : 'default'
                                }
                              >
                                {orden.estadoPago}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              {formatDate(orden.fecha)} - {orden.productos.length} productos
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {orden.productos.slice(0, 3).map((p, idx) => (
                                <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                  {p.nombre.substring(0, 30)}... x{p.cantidad}
                                </span>
                              ))}
                              {orden.productos.length > 3 && (
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                  +{orden.productos.length - 3} mas
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">
                            {formatCurrency(orden.totalUSD)}
                          </p>
                          {orden.diasEntrega !== undefined && (
                            <p className="text-sm text-gray-500 flex items-center gap-1 justify-end mt-1">
                              <Truck className="h-3.5 w-3.5" />
                              {orden.diasEntrega} dias entrega
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: PRODUCTOS */}
          {activeTab === 'productos' && analytics && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Productos Comprados ({analytics.productosComprados.length})
                </h3>
              </div>

              {analytics.productosComprados.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No hay productos registrados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unidades</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ordenes</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Prom.</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ultimo Costo</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tendencia</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mejor Precio?</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {analytics.productosComprados.map((producto) => (
                        <tr key={producto.productoId} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div>
                              <p className="font-medium text-gray-900">
                                {producto.marca} {producto.nombreComercial}
                              </p>
                              <p className="text-xs text-gray-500">{producto.sku} - {producto.presentacion}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right font-medium">
                            {producto.unidadesCompradas}
                          </td>
                          <td className="px-4 py-4 text-right text-gray-600">
                            {producto.ordenesCompra}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="font-medium">{formatCurrency(producto.costoPromedioUSD)}</span>
                            {producto.costoMinimoUSD !== producto.costoMaximoUSD && (
                              <p className="text-xs text-gray-500">
                                {formatCurrency(producto.costoMinimoUSD)} - {formatCurrency(producto.costoMaximoUSD)}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right font-medium">
                            {formatCurrency(producto.ultimoCostoUSD)}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {getTendenciaIcon(producto.tendenciaCosto)}
                              {producto.variacionCosto !== 0 && (
                                <span className={`text-xs ${producto.variacionCosto > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {producto.variacionCosto > 0 ? '+' : ''}{producto.variacionCosto.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {producto.esMejorPrecio ? (
                              <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                            ) : producto.costosOtrosProveedores && producto.costosOtrosProveedores.length > 0 ? (
                              <XCircle className="h-5 w-5 text-amber-500 mx-auto" />
                            ) : (
                              <Minus className="h-5 w-5 text-gray-300 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: COMPARATIVO */}
          {activeTab === 'comparativo' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Comparativo de Precios con Otros Proveedores
                </h3>
              </div>

              {comparativoPrecios.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Scale className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No hay productos compartidos con otros proveedores para comparar</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Los comparativos aparecen cuando un producto se compra a multiples proveedores
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {comparativoPrecios.slice(0, 10).map((comparativo) => {
                    const proveedorActual = comparativo.preciosProveedores.find(p => p.proveedorId === proveedor.id);
                    const posicion = comparativo.preciosProveedores.findIndex(p => p.proveedorId === proveedor.id) + 1;

                    return (
                      <Card key={comparativo.productoId} padding="lg">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="font-medium text-gray-900">{comparativo.nombreProducto}</h4>
                            <p className="text-sm text-gray-500">{comparativo.sku}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Precio promedio mercado</p>
                            <p className="text-lg font-bold text-gray-900">{formatCurrency(comparativo.precioPromedio)}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {comparativo.preciosProveedores.map((prov, idx) => {
                            const esActual = prov.proveedorId === proveedor.id;
                            const esMejor = idx === 0;
                            const diferencia = ((prov.costoPromedioUSD - comparativo.mejorPrecio.costoUSD) / comparativo.mejorPrecio.costoUSD) * 100;

                            return (
                              <div
                                key={prov.proveedorId}
                                className={`flex items-center justify-between p-3 rounded-lg ${
                                  esActual ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    esMejor ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                  }`}>
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <p className={`font-medium ${esActual ? 'text-indigo-700' : 'text-gray-900'}`}>
                                      {prov.proveedorNombre}
                                      {esActual && <span className="text-xs ml-2">(actual)</span>}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {prov.ordenesCompra} ordenes - Ultimo: {formatDate(prov.fechaUltimaCompra)}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold">{formatCurrency(prov.costoPromedioUSD)}</p>
                                  {diferencia > 0 && (
                                    <p className="text-xs text-red-600">+{diferencia.toFixed(1)}% vs mejor</p>
                                  )}
                                  {esMejor && (
                                    <p className="text-xs text-green-600 flex items-center justify-end gap-1">
                                      <Star className="h-3 w-3 fill-green-500" /> Mejor precio
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                          <span className="text-gray-500">
                            Diferencia max: <span className="font-medium text-red-600">{comparativo.diferenciaMaxima.toFixed(1)}%</span>
                          </span>
                          {proveedorActual && posicion > 1 && (
                            <span className="text-amber-600">
                              Este proveedor esta en posicion #{posicion} de {comparativo.preciosProveedores.length}
                            </span>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: PREDICCIONES */}
          {activeTab === 'predicciones' && analytics && (
            <div className="space-y-6">
              {/* Prediccion de proxima compra */}
              <Card padding="lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-indigo-600" />
                  Prediccion de Proxima Compra
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <p className="text-3xl font-bold text-indigo-600">
                      {analytics.predicciones.diasEstimadosProximaCompra}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Dias estimados</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-lg font-bold text-purple-600">
                      {formatDate(analytics.predicciones.fechaEstimadaProximaCompra)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Fecha estimada</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(analytics.predicciones.montoEstimadoProximaCompra)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Monto estimado</p>
                  </div>
                </div>
              </Card>

              {/* Tendencias */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card padding="lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <ChartLine className="h-5 w-5 text-indigo-600" />
                    Tendencias
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">Volumen de compras</span>
                      <div className="flex items-center gap-2">
                        {getTendenciaIcon(analytics.predicciones.tendenciaVolumen)}
                        <span className="font-medium capitalize">{analytics.predicciones.tendenciaVolumen}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">Precios</span>
                      <div className="flex items-center gap-2">
                        {getTendenciaIcon(analytics.predicciones.tendenciaPrecios)}
                        <span className="font-medium capitalize">{analytics.predicciones.tendenciaPrecios}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">Evaluacion</span>
                      <div className="flex items-center gap-2">
                        {getTendenciaIcon(analytics.tendenciaEvaluacion)}
                        <span className="font-medium capitalize">{analytics.tendenciaEvaluacion}</span>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card padding="lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    Indicadores de Riesgo
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-700">Riesgo de incidencia</span>
                        <span className="font-medium">{analytics.predicciones.riesgoIncidencia}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            analytics.predicciones.riesgoIncidencia < 30 ? 'bg-green-500' :
                            analytics.predicciones.riesgoIncidencia < 60 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${analytics.predicciones.riesgoIncidencia}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-700">Riesgo de inactividad</span>
                        <span className="font-medium">{analytics.predicciones.riesgoInactividad}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            analytics.predicciones.riesgoInactividad < 30 ? 'bg-green-500' :
                            analytics.predicciones.riesgoInactividad < 60 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${analytics.predicciones.riesgoInactividad}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Valor */}
              <Card padding="lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Valor del Proveedor
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-6 bg-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">
                      {formatCurrency(analytics.predicciones.valorAnualEstimado)}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">Valor anual estimado</p>
                  </div>
                  <div className="text-center p-6 bg-indigo-50 rounded-lg">
                    <p className="text-3xl font-bold text-indigo-600">
                      {formatCurrency(analytics.predicciones.valorTotalHistorico)}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">Valor total historico</p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
