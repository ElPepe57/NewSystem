import { useState, useEffect, useLayoutEffect } from 'react';
import { formatFecha as formatDate } from '../../utils/dateFormatters';
import { formatCurrency as formatCurrencyImport, formatPercent } from '../../utils/format';
import { DataTable } from '../../design-system';
import type { DataTableColumn } from '../../design-system';
import {
  ShoppingBag, DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  BarChart3, RefreshCw, Users, Star, X, Activity, Target, Zap,
  AlertCircle, Package, Percent, Calendar, Award, ShoppingCart,
  FileText, ArrowUpRight, ArrowDownRight, CheckCircle, Clock,
  MessageCircle, Instagram, Store, MoreHorizontal
} from 'lucide-react';
import { registerModalOpen, unregisterModalOpen, getModalCount } from '../common/Modal';
import type { CanalVenta } from '../../types/canalVenta.types';
import {
  canalVentaAnalyticsService,
  type CanalVentaAnalytics,
  type VentaCanal,
  type CotizacionCanal,
  type HistorialPeriodo,
  type ComparativaCanales
} from '../../services/canalVenta.analytics.service';

type DetailTab = 'resumen' | 'ventas' | 'conversion' | 'analisis' | 'comparativa';

interface CanalVentaDetailViewProps {
  canal: CanalVenta;
  onClose: () => void;
  onEdit?: () => void;
}

export function CanalVentaDetailView({ canal, onClose, onEdit }: CanalVentaDetailViewProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('resumen');
  const [analytics, setAnalytics] = useState<CanalVentaAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  // Registrar modal abierto
  useLayoutEffect(() => {
    registerModalOpen();
    document.body.setAttribute('data-modal-open', 'true');
    return () => {
      unregisterModalOpen();
      if (getModalCount() === 0) {
        document.body.removeAttribute('data-modal-open');
      }
    };
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [canal.id]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await canalVentaAnalyticsService.getCanalVentaAnalytics(canal.id);
      setAnalytics(data);
    } catch (error) {
      console.error('Error cargando analytics:', error);
    }
    setLoading(false);
  };

  // formatCurrency y formatPercent importados de utils/format
  // Alias local para preservar el default PEN que usaba la definición anterior
  const formatCurrency = (value: number, currency: 'USD' | 'PEN' = 'PEN') =>
    formatCurrencyImport(value, currency);

  const getTendenciaIcon = (tendencia?: string) => {
    switch (tendencia) {
      case 'creciendo':
        return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case 'decreciendo':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <span className="text-slate-400">-</span>;
    }
  };

  const getAlertaIcon = (severidad: string) => {
    switch (severidad) {
      case 'danger': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default: return <AlertCircle className="w-4 h-4 text-sky-500" />;
    }
  };

  const getCanalIcon = (icono?: string) => {
    switch (icono) {
      case 'ShoppingBag': return <ShoppingBag className="w-8 h-8" />;
      case 'MessageCircle': return <MessageCircle className="w-8 h-8" />;
      case 'Instagram': return <Instagram className="w-8 h-8" />;
      case 'Store': return <Store className="w-8 h-8" />;
      case 'MoreHorizontal': return <MoreHorizontal className="w-8 h-8" />;
      default: return <ShoppingCart className="w-8 h-8" />;
    }
  };

  const getEstadoCotizacionColor = (estado: string) => {
    switch (estado) {
      case 'convertida': return 'text-emerald-600 bg-emerald-100';
      case 'aprobada': return 'text-sky-600 bg-sky-100';
      case 'pendiente': return 'text-yellow-600 bg-yellow-100';
      case 'rechazada': return 'text-red-600 bg-red-100';
      case 'vencida': return 'text-slate-600 bg-slate-100';
      default: return 'text-slate-600 bg-slate-100';
    }
  };

  // Renderizar pestaña Resumen
  const renderResumen = () => (
    <div className="space-y-6">
      {/* Info del canal */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start gap-4">
          <div
            className="w-16 h-16 rounded-lg flex items-center justify-center text-white"
            style={{ backgroundColor: canal.color || '#6b7280' }}
          >
            {getCanalIcon(canal.icono)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-slate-900">{canal.nombre}</h2>
              {analytics && (
                <span className={`px-2 py-1 text-sm font-bold rounded-full ${
                  analytics.tendenciaVentas === 'creciendo' ? 'bg-emerald-100 text-emerald-800' :
                  analytics.tendenciaVentas === 'decreciendo' ? 'bg-red-100 text-red-800' :
                  'bg-slate-100 text-slate-800'
                }`}>
                  {analytics.tendenciaVentas}
                </span>
              )}
            </div>
            <p className="text-slate-500">{canal.codigo}</p>

            {canal.descripcion && (
              <p className="text-slate-600 mt-2">{canal.descripcion}</p>
            )}

            <div className="flex gap-2 mt-3">
              <span className={`px-2 py-1 text-xs rounded-full ${
                canal.estado === 'activo' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}>
                {canal.estado}
              </span>
              {canal.comisionPorcentaje !== undefined && canal.comisionPorcentaje > 0 && (
                <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                  {canal.comisionPorcentaje}% comisión
                </span>
              )}
              {canal.requiereEnvio && (
                <span className="px-2 py-1 text-xs rounded-full bg-sky-100 text-sky-800">
                  Requiere envío
                </span>
              )}
              {canal.esSistema && (
                <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-800">
                  Canal sistema
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {onEdit && !canal.esSistema && (
              <button
                onClick={onEdit}
                className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg"
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
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <ShoppingCart className="w-4 h-4" />
              Ventas Totales
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {analytics.metricasVenta.ventasTotales}
            </div>
            <div className="text-xs text-slate-500">
              {analytics.metricasVenta.ventasUltimos30Dias} últimos 30 días
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <DollarSign className="w-4 h-4" />
              Ingresos Totales
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(analytics.metricasVenta.ingresosTotales)}
            </div>
            <div className="flex items-center gap-1 text-xs">
              {getTendenciaIcon(analytics.tendenciaVentas)}
              <span className={analytics.tasaCrecimiento >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                {analytics.tasaCrecimiento >= 0 ? '+' : ''}{formatPercent(analytics.tasaCrecimiento)}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Percent className="w-4 h-4" />
              Tasa Conversión
            </div>
            <div className={`text-2xl font-bold ${
              analytics.metricasConversion.tasaConversion >= 30 ? 'text-emerald-600' :
              analytics.metricasConversion.tasaConversion >= 20 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {formatPercent(analytics.metricasConversion.tasaConversion)}
            </div>
            <div className="text-xs text-slate-500">
              {analytics.metricasConversion.cotizacionesConvertidas} de {analytics.metricasConversion.cotizacionesTotales}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Users className="w-4 h-4" />
              Clientes
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {analytics.metricasCliente.clientesUnicos}
            </div>
            <div className="text-xs text-slate-500">
              {analytics.metricasCliente.clientesRecurrentes} recurrentes
            </div>
          </div>
        </div>
      )}

      {/* Métricas financieras */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Métricas Financieras
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-slate-500">Ticket Promedio</div>
              <div className="text-xl font-bold">{formatCurrency(analytics.metricasVenta.ticketPromedio)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Margen Total</div>
              <div className="text-xl font-bold text-emerald-600">{formatCurrency(analytics.metricasVenta.margenTotal)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Margen Promedio</div>
              <div className="text-xl font-bold">{formatPercent(analytics.metricasVenta.margenPorcentajePromedio)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">ROI Canal</div>
              <div className={`text-xl font-bold ${
                analytics.metricasROI.roiPorcentaje >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {formatPercent(analytics.metricasROI.roiPorcentaje)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Funnel de conversión */}
      {analytics && analytics.funnelConversion.cotizaciones > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Funnel de Conversión
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-28 text-sm font-medium">Cotizaciones</div>
              <div className="flex-1">
                <div className="h-8 bg-sky-500 rounded-lg flex items-center justify-center text-white font-medium">
                  {analytics.funnelConversion.cotizaciones}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-28 text-sm font-medium">Negociación</div>
              <div className="flex-1">
                <div
                  className="h-8 bg-yellow-500 rounded-lg flex items-center justify-center text-white font-medium"
                  style={{ width: `${(analytics.funnelConversion.enNegociacion / analytics.funnelConversion.cotizaciones) * 100}%` }}
                >
                  {analytics.funnelConversion.enNegociacion}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-28 text-sm font-medium">Aprobadas</div>
              <div className="flex-1">
                <div
                  className="h-8 bg-sky-400 rounded-lg flex items-center justify-center text-white font-medium"
                  style={{ width: `${(analytics.funnelConversion.aprobadas / analytics.funnelConversion.cotizaciones) * 100}%` }}
                >
                  {analytics.funnelConversion.aprobadas}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-28 text-sm font-medium">Convertidas</div>
              <div className="flex-1">
                <div
                  className="h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-medium"
                  style={{ width: `${(analytics.funnelConversion.convertidas / analytics.funnelConversion.cotizaciones) * 100}%` }}
                >
                  {analytics.funnelConversion.convertidas}
                </div>
              </div>
            </div>
          </div>
          <div className="text-center mt-4 text-sm text-slate-500">
            Tasa global: <span className="font-bold text-slate-900">{formatPercent(analytics.funnelConversion.tasaGlobal)}</span>
          </div>
        </div>
      )}

      {/* Alertas */}
      {analytics && analytics.alertas.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
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
                  'bg-sky-50 border-sky-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {getAlertaIcon(alerta.severidad)}
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{alerta.mensaje}</div>
                    {alerta.detalle && (
                      <div className="text-sm text-slate-600 mt-1">{alerta.detalle}</div>
                    )}
                    {alerta.accionRecomendada && (
                      <div className="text-sm text-sky-600 mt-1">
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

  // Renderizar pestaña Ventas
  const renderVentas = () => (
    <div className="space-y-6">
      {/* Resumen de ventas */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">Últimos 7 días</div>
            <div className="text-2xl font-bold">{analytics.metricasVenta.ventasUltimos7Dias}</div>
            <div className="text-xs text-slate-500">{formatCurrency(analytics.metricasVenta.ingresosUltimos7Dias)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">Últimos 30 días</div>
            <div className="text-2xl font-bold">{analytics.metricasVenta.ventasUltimos30Dias}</div>
            <div className="text-xs text-slate-500">{formatCurrency(analytics.metricasVenta.ingresosUltimos30Dias)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">Últimos 90 días</div>
            <div className="text-2xl font-bold">{analytics.metricasVenta.ventasUltimos90Dias}</div>
            <div className="text-xs text-slate-500">{formatCurrency(analytics.metricasVenta.ingresosUltimos90Dias)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">Unidades Vendidas</div>
            <div className="text-2xl font-bold">{analytics.metricasVenta.unidadesVendidas}</div>
            <div className="text-xs text-slate-500">{analytics.metricasVenta.productosUnicos} prod. únicos</div>
          </div>
        </div>
      )}

      {/* Historial de ventas */}
      {analytics && analytics.ventasHistorial.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Historial de Ventas ({analytics.ventasHistorial.length})
          </h3>
          {(() => {
            type VentaItem = VentaCanal;
            const colsVentas: DataTableColumn<VentaItem>[] = [
              {
                key: 'fecha', header: 'Fecha',
                render: v => <span className="text-xs">{formatDate(v.fecha)}</span>,
              },
              {
                key: 'numeroVenta', header: 'Número',
                render: v => <span className="font-mono text-xs">{v.numeroVenta}</span>,
              },
              { key: 'clienteNombre', header: 'Cliente', render: v => <span>{v.clienteNombre}</span> },
              { key: 'productos', header: 'Prods.', align: 'right', hideOnMobile: true, render: v => <span>{v.productos}</span> },
              { key: 'unidades', header: 'Unidades', align: 'right', hideOnMobile: true, render: v => <span>{v.unidades}</span> },
              {
                key: 'totalPEN', header: 'Total', align: 'right',
                render: v => <span className="font-medium">{formatCurrency(v.totalPEN)}</span>,
              },
              {
                key: 'margenPorcentaje', header: 'Margen', align: 'right', hideOnMobile: true,
                render: v => <span className="text-emerald-600">{formatPercent(v.margenPorcentaje)}</span>,
              },
              {
                key: 'estado', header: 'Estado', align: 'center',
                render: v => (
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    v.estado === 'completada' ? 'bg-emerald-100 text-emerald-700' :
                    v.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {v.estado}
                  </span>
                ),
              },
            ];
            return (
              <DataTable
                columns={colsVentas}
                data={analytics.ventasHistorial.slice(0, 20)}
                keyExtractor={v => v.ventaId}
                compact
                emptyMessage="Sin ventas registradas"
              />
            );
          })()}
        </div>
      )}

      {/* Productos top */}
      {analytics && analytics.productosTop.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Productos Más Vendidos
          </h3>
          {(() => {
            type ProdTop = typeof analytics.productosTop[number];
            const colsProductosTop: DataTableColumn<ProdTop>[] = [
              {
                key: 'sku', header: 'SKU',
                render: prod => <span className="font-mono text-xs">{prod.sku}</span>,
              },
              { key: 'nombre', header: 'Producto', render: prod => <span>{prod.nombre}</span> },
              {
                key: 'marca', header: 'Marca', hideOnMobile: true,
                render: prod => <span className="text-slate-500">{prod.marca}</span>,
              },
              {
                key: 'unidades', header: 'Unidades', align: 'right',
                render: prod => <span className="font-medium">{prod.unidades}</span>,
              },
              {
                key: 'ingresos', header: 'Ingresos', align: 'right',
                render: prod => <span>{formatCurrency(prod.ingresos)}</span>,
              },
              {
                key: 'participacion', header: 'Part. %', align: 'right', hideOnMobile: true,
                render: prod => (
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-500 rounded-full" style={{ width: `${prod.participacion}%` }} />
                    </div>
                    <span className="text-xs">{formatPercent(prod.participacion)}</span>
                  </div>
                ),
              },
            ];
            return (
              <DataTable
                columns={colsProductosTop}
                data={analytics.productosTop.slice(0, 10)}
                keyExtractor={prod => prod.productoId}
                compact
                emptyMessage="Sin productos"
              />
            );
          })()}
        </div>
      )}

      {/* Clientes top */}
      {analytics && analytics.clientesTop.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Clientes Top
          </h3>
          <div className="space-y-3">
            {analytics.clientesTop.slice(0, 5).map((cliente, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    cliente.esVIP ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {cliente.esVIP ? <Star className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-medium">{cliente.nombre}</div>
                    <div className="text-sm text-slate-500">{cliente.compras} compras</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{formatCurrency(cliente.monto)}</div>
                  <div className="text-xs text-slate-500">Última: {formatDate(cliente.ultimaCompra)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Renderizar pestaña Conversión
  const renderConversion = () => (
    <div className="space-y-6">
      {/* Métricas de conversión */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">Total Cotizaciones</div>
            <div className="text-2xl font-bold">{analytics.metricasConversion.cotizacionesTotales}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">Convertidas</div>
            <div className="text-2xl font-bold text-emerald-600">{analytics.metricasConversion.cotizacionesConvertidas}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">Rechazadas</div>
            <div className="text-2xl font-bold text-red-600">{analytics.metricasConversion.cotizacionesRechazadas}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">Pendientes</div>
            <div className="text-2xl font-bold text-yellow-600">{analytics.metricasConversion.cotizacionesPendientes}</div>
          </div>
        </div>
      )}

      {/* Tasas */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Tasas de Conversión</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50 rounded-lg text-center">
              <div className="text-3xl font-bold text-emerald-600">
                {formatPercent(analytics.metricasConversion.tasaConversion)}
              </div>
              <div className="text-sm text-slate-600">Conversión</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg text-center">
              <div className="text-3xl font-bold text-red-600">
                {formatPercent(analytics.metricasConversion.tasaRechazo)}
              </div>
              <div className="text-sm text-slate-600">Rechazo</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg text-center">
              <div className="text-3xl font-bold text-slate-600">
                {formatPercent(analytics.metricasConversion.tasaVencimiento)}
              </div>
              <div className="text-sm text-slate-600">Vencimiento</div>
            </div>
          </div>
        </div>
      )}

      {/* Tiempos de conversión */}
      {analytics && analytics.metricasConversion.tiempoPromedioConversion > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Tiempos de Conversión
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 border rounded-lg text-center">
              <div className="text-sm text-slate-500">Mínimo</div>
              <div className="text-xl font-bold">{analytics.metricasConversion.tiempoMinimoConversion} días</div>
            </div>
            <div className="p-3 border rounded-lg text-center">
              <div className="text-sm text-slate-500">Promedio</div>
              <div className="text-xl font-bold">{analytics.metricasConversion.tiempoPromedioConversion.toFixed(1)} días</div>
            </div>
            <div className="p-3 border rounded-lg text-center">
              <div className="text-sm text-slate-500">Máximo</div>
              <div className="text-xl font-bold">{analytics.metricasConversion.tiempoMaximoConversion} días</div>
            </div>
          </div>
        </div>
      )}

      {/* Motivos de rechazo */}
      {analytics && analytics.metricasConversion.motivosRechazo.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Motivos de Rechazo
          </h3>
          <div className="space-y-3">
            {analytics.metricasConversion.motivosRechazo.map((motivo, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-32 text-sm font-medium truncate">{motivo.motivo}</div>
                <div className="flex-1">
                  <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{ width: `${motivo.porcentaje}%` }}
                    />
                  </div>
                </div>
                <div className="w-16 text-right text-sm">{motivo.count} ({formatPercent(motivo.porcentaje)})</div>
                <div className="w-24 text-right text-sm font-medium text-red-600">
                  {formatCurrency(motivo.valorPerdidoPEN)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-red-50 rounded-lg">
            <div className="text-sm text-slate-600">Valor total perdido</div>
            <div className="text-xl font-bold text-red-600">
              {formatCurrency(analytics.metricasConversion.valorTotalPerdido)}
            </div>
          </div>
        </div>
      )}

      {/* Historial de cotizaciones */}
      {analytics && analytics.cotizacionesHistorial.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Historial de Cotizaciones ({analytics.cotizacionesHistorial.length})
          </h3>
          {(() => {
            type CotizItem = CotizacionCanal;
            const colsCotizaciones: DataTableColumn<CotizItem>[] = [
              {
                key: 'fecha', header: 'Fecha',
                render: c => <span className="text-xs">{formatDate(c.fecha)}</span>,
              },
              {
                key: 'numero', header: 'Número',
                render: c => <span className="font-mono text-xs">{c.numero}</span>,
              },
              { key: 'clienteNombre', header: 'Cliente', render: c => <span>{c.clienteNombre}</span> },
              {
                key: 'montoPEN', header: 'Monto', align: 'right',
                render: c => <span className="font-medium">{formatCurrency(c.montoPEN)}</span>,
              },
              {
                key: 'estado', header: 'Estado', align: 'center',
                render: c => (
                  <span className={`px-2 py-1 text-xs rounded-full ${getEstadoCotizacionColor(c.estado)}`}>
                    {c.estado}
                  </span>
                ),
              },
            ];
            return (
              <DataTable
                columns={colsCotizaciones}
                data={analytics.cotizacionesHistorial.slice(0, 15)}
                keyExtractor={c => c.cotizacionId}
                compact
                emptyMessage="Sin cotizaciones"
              />
            );
          })()}
        </div>
      )}
    </div>
  );

  // Renderizar pestaña Análisis
  const renderAnalisis = () => (
    <div className="space-y-6">
      {/* Métricas de clientes */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Análisis de Clientes</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-3 bg-sky-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-sky-600">{analytics.metricasCliente.clientesUnicos}</div>
              <div className="text-sm text-slate-600">Únicos</div>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-emerald-600">{analytics.metricasCliente.clientesNuevos}</div>
              <div className="text-sm text-slate-600">Nuevos</div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-600">{analytics.metricasCliente.clientesRecurrentes}</div>
              <div className="text-sm text-slate-600">Recurrentes</div>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">{formatPercent(analytics.metricasCliente.tasaRecurrencia)}</div>
              <div className="text-sm text-slate-600">Recurrencia</div>
            </div>
          </div>

          {/* Segmentación */}
          <h4 className="font-medium text-slate-900 mb-3">Segmentación de Clientes</h4>
          <div className="grid grid-cols-4 gap-3">
            <div className="p-2 border rounded-lg text-center">
              <div className="text-lg font-bold text-yellow-600">{analytics.metricasCliente.segmentacionClientes.vip}</div>
              <div className="text-xs text-slate-500">VIP</div>
            </div>
            <div className="p-2 border rounded-lg text-center">
              <div className="text-lg font-bold text-sky-600">{analytics.metricasCliente.segmentacionClientes.frecuentes}</div>
              <div className="text-xs text-slate-500">Frecuentes</div>
            </div>
            <div className="p-2 border rounded-lg text-center">
              <div className="text-lg font-bold text-slate-600">{analytics.metricasCliente.segmentacionClientes.ocasionales}</div>
              <div className="text-xs text-slate-500">Ocasionales</div>
            </div>
            <div className="p-2 border rounded-lg text-center">
              <div className="text-lg font-bold text-emerald-600">{analytics.metricasCliente.segmentacionClientes.nuevos}</div>
              <div className="text-xs text-slate-500">Nuevos</div>
            </div>
          </div>
        </div>
      )}

      {/* ROI detallado */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Análisis ROI
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-sm text-slate-500">Ingresos Totales</div>
              <div className="text-xl font-bold">{formatCurrency(analytics.metricasROI.ingresosTotales)}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-sm text-slate-500">Comisiones</div>
              <div className="text-xl font-bold text-red-600">{formatCurrency(analytics.metricasROI.comisionesPagadas)}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-sm text-slate-500">Margen Bruto</div>
              <div className="text-xl font-bold text-emerald-600">{formatCurrency(analytics.metricasROI.margenBruto)}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-sm text-slate-500">Rentabilidad Neta</div>
              <div className={`text-xl font-bold ${analytics.metricasROI.rentabilidadNeta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(analytics.metricasROI.rentabilidadNeta)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historial mensual */}
      {analytics && analytics.historialMensual.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Historial Mensual
          </h3>
          {(() => {
            const colsHistorial: DataTableColumn<HistorialPeriodo>[] = [
              { key: 'periodo', header: 'Período', render: mes => <span className="font-medium">{mes.periodo}</span> },
              { key: 'ventas', header: 'Ventas', align: 'right', render: mes => <span>{mes.ventas}</span> },
              {
                key: 'ingresos', header: 'Ingresos', align: 'right',
                render: mes => <span className="font-medium">{formatCurrency(mes.ingresos)}</span>,
              },
              {
                key: 'margenPorcentaje', header: 'Margen', align: 'right', hideOnMobile: true,
                render: mes => <span className="text-emerald-600">{formatPercent(mes.margenPorcentaje)}</span>,
              },
              {
                key: 'ticketPromedio', header: 'Ticket Prom.', align: 'right', hideOnMobile: true,
                render: mes => <span>{formatCurrency(mes.ticketPromedio)}</span>,
              },
              {
                key: 'clientes', header: 'Clientes', align: 'right', hideOnMobile: true,
                render: mes => <span>{mes.clientes}</span>,
              },
              {
                key: 'crecimientoIngresos', header: 'Crec. %', align: 'right',
                render: mes => (
                  <span className={`flex items-center justify-end gap-1 ${mes.crecimientoIngresos >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {mes.crecimientoIngresos >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {formatPercent(Math.abs(mes.crecimientoIngresos))}
                  </span>
                ),
              },
            ];
            return (
              <DataTable
                columns={colsHistorial}
                data={analytics.historialMensual.slice(-6).reverse()}
                keyExtractor={mes => mes.periodo}
                compact
                emptyMessage="Sin historial mensual"
              />
            );
          })()}
        </div>
      )}

      {/* Predicciones */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Predicciones (próximos 30 días)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-sm text-slate-500">Ventas Estimadas</div>
              <div className="text-xl font-bold">{analytics.predicciones.ventasEstimadas30Dias}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-sm text-slate-500">Ingresos Estimados</div>
              <div className="text-xl font-bold">{formatCurrency(analytics.predicciones.ingresosEstimados30Dias)}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-sm text-slate-500">Riesgo Declinación</div>
              <div className={`text-xl font-bold ${
                analytics.predicciones.riesgoDeclinacion > 30 ? 'text-red-600' :
                analytics.predicciones.riesgoDeclinacion > 15 ? 'text-yellow-600' :
                'text-emerald-600'
              }`}>
                {formatPercent(analytics.predicciones.riesgoDeclinacion)}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-sm text-slate-500">Oportunidad Crecimiento</div>
              <div className={`text-xl font-bold ${
                analytics.predicciones.oportunidadCrecimiento > 40 ? 'text-emerald-600' :
                analytics.predicciones.oportunidadCrecimiento > 20 ? 'text-yellow-600' :
                'text-slate-600'
              }`}>
                {formatPercent(analytics.predicciones.oportunidadCrecimiento)}
              </div>
            </div>
          </div>

          {/* Factores */}
          <div className="grid grid-cols-2 gap-4">
            {analytics.predicciones.factoresRiesgo.length > 0 && (
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="text-sm font-medium text-red-800 mb-2">Factores de Riesgo</div>
                <ul className="text-sm text-red-600 space-y-1">
                  {analytics.predicciones.factoresRiesgo.map((factor, idx) => (
                    <li key={idx}>• {factor}</li>
                  ))}
                </ul>
              </div>
            )}
            {analytics.predicciones.factoresOportunidad.length > 0 && (
              <div className="p-3 bg-emerald-50 rounded-lg">
                <div className="text-sm font-medium text-emerald-800 mb-2">Factores de Oportunidad</div>
                <ul className="text-sm text-emerald-600 space-y-1">
                  {analytics.predicciones.factoresOportunidad.map((factor, idx) => (
                    <li key={idx}>• {factor}</li>
                  ))}
                </ul>
              </div>
            )}
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
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Ranking de Canales</h3>
          <div className="flex items-center gap-4 mb-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-sky-600">#{analytics.rankingGeneral}</div>
              <div className="text-sm text-slate-500">de {analytics.totalCanales}</div>
            </div>
            <div className="flex-1">
              <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full"
                  style={{ width: `${analytics.participacionMercado}%` }}
                />
              </div>
              <div className="text-sm text-slate-500 mt-1">
                Participación de mercado: <span className="font-bold">{formatPercent(analytics.participacionMercado)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparativa detallada */}
      {analytics && analytics.comparativaCanales.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Comparativa con Otros Canales</h3>
          {(() => {
            type CompCanal = ComparativaCanales;
            const colsComparativa: DataTableColumn<CompCanal>[] = [
              {
                key: 'ranking', header: '#',
                render: comp => comp.ranking <= 3 ? (
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                    comp.ranking === 1 ? 'bg-yellow-100 text-yellow-700' :
                    comp.ranking === 2 ? 'bg-slate-100 text-slate-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {comp.ranking}
                  </span>
                ) : <span className="font-bold">{comp.ranking}</span>,
              },
              {
                key: 'nombre', header: 'Canal',
                render: comp => (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded flex items-center justify-center text-white text-xs"
                      style={{ backgroundColor: canal.color || '#6b7280' }}>
                      {comp.nombre.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium">{comp.nombre}</div>
                      <div className="text-xs text-slate-500">{comp.codigo}</div>
                    </div>
                  </div>
                ),
              },
              { key: 'ventas', header: 'Ventas', align: 'right', render: comp => <span>{comp.ventas}</span> },
              {
                key: 'ingresos', header: 'Ingresos', align: 'right',
                render: comp => <span className="font-medium">{formatCurrency(comp.ingresos)}</span>,
              },
              {
                key: 'margenPorcentaje', header: 'Margen %', align: 'right', hideOnMobile: true,
                render: comp => <span className="text-emerald-600">{formatPercent(comp.margenPorcentaje)}</span>,
              },
              {
                key: 'ticketPromedio', header: 'Ticket Prom.', align: 'right', hideOnMobile: true,
                render: comp => <span>{formatCurrency(comp.ticketPromedio)}</span>,
              },
              {
                key: 'clientes', header: 'Clientes', align: 'right', hideOnMobile: true,
                render: comp => <span>{comp.clientes}</span>,
              },
              {
                key: 'participacion', header: 'Part. %', align: 'right',
                render: comp => <span className="font-medium">{formatPercent(comp.participacion)}</span>,
              },
              {
                key: 'tendencia', header: 'Tendencia', align: 'center', hideOnMobile: true,
                render: comp => getTendenciaIcon(comp.tendencia),
              },
            ];
            return (
              <DataTable
                columns={colsComparativa}
                data={analytics.comparativaCanales.slice(0, 10)}
                keyExtractor={comp => comp.canalId}
                compact
                emptyMessage="Sin comparativas disponibles"
              />
            );
          })()}
        </div>
      )}

      {/* Mejor y peor mes */}
      {analytics && (analytics.mejorMes || analytics.peorMes) && (
        <div className="grid grid-cols-2 gap-4">
          {analytics.mejorMes && (
            <div className="bg-emerald-50 rounded-lg shadow p-6">
              <h4 className="text-sm font-medium text-emerald-800 mb-2 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4" />
                Mejor Mes
              </h4>
              <div className="text-2xl font-bold text-emerald-600">{analytics.mejorMes.periodo}</div>
              <div className="text-sm text-emerald-700 mt-1">
                {analytics.mejorMes.ventas} ventas - {formatCurrency(analytics.mejorMes.ingresos)}
              </div>
            </div>
          )}
          {analytics.peorMes && (
            <div className="bg-red-50 rounded-lg shadow p-6">
              <h4 className="text-sm font-medium text-red-800 mb-2 flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4" />
                Peor Mes
              </h4>
              <div className="text-2xl font-bold text-red-600">{analytics.peorMes.periodo}</div>
              <div className="text-sm text-red-700 mt-1">
                {analytics.peorMes.ventas} ventas - {formatCurrency(analytics.peorMes.ingresos)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: BarChart3 },
    { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
    { id: 'conversion', label: 'Conversión', icon: Percent },
    { id: 'analisis', label: 'Análisis', icon: Target },
    { id: 'comparativa', label: 'Comparativa', icon: Users }
  ] as const;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-100 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: canal.color || '#6b7280' }}
            >
              {getCanalIcon(canal.icono)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{canal.nombre}</h2>
              <p className="text-sm text-slate-500">
                {canal.codigo}
                {canal.comisionPorcentaje !== undefined && canal.comisionPorcentaje > 0 && ` - ${canal.comisionPorcentaje}% comisión`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
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
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
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
              <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {activeTab === 'resumen' && renderResumen()}
              {activeTab === 'ventas' && renderVentas()}
              {activeTab === 'conversion' && renderConversion()}
              {activeTab === 'analisis' && renderAnalisis()}
              {activeTab === 'comparativa' && renderComparativa()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
