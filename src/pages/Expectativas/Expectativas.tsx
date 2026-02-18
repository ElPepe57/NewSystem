import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShoppingCart,
  Package,
  RefreshCw
} from 'lucide-react';
import { Card } from '../../components/common';
import { ExpectativaService } from '../../services/expectativa.service';
import { VentaService } from '../../services/venta.service';
import { OrdenCompraService } from '../../services/ordenCompra.service';
import type { ComparacionVenta, ComparacionCompra, ExpectativaStats } from '../../types/expectativa.types';

type TabActiva = 'ventas' | 'compras';

export const Expectativas: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [tabActiva, setTabActiva] = useState<TabActiva>('ventas');
  const [comparacionesVentas, setComparacionesVentas] = useState<ComparacionVenta[]>([]);
  const [comparacionesCompras, setComparacionesCompras] = useState<ComparacionCompra[]>([]);
  const [stats, setStats] = useState<ExpectativaStats | null>(null);
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1);
  const [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear());

  useEffect(() => {
    loadData();
  }, [mesSeleccionado, anioSeleccionado]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar stats con filtro de mes/año
      const [statsData, ventas, ordenes] = await Promise.all([
        ExpectativaService.getStats(mesSeleccionado, anioSeleccionado),
        VentaService.getAll(),
        OrdenCompraService.getAll()
      ]);
      setStats(statsData);

      // Filtrar ventas del período con expectativa
      const ventasPeriodo = ventas.filter(v => {
        const fecha = v.fechaCreacion?.toDate?.() || new Date(v.fechaCreacion as unknown as string);
        return (
          fecha.getMonth() + 1 === mesSeleccionado &&
          fecha.getFullYear() === anioSeleccionado &&
          v.expectativaCotizacion &&
          v.estado !== 'cotizacion'
        );
      });

      const comparacionesV: ComparacionVenta[] = [];
      for (const v of ventasPeriodo) {
        const comp = await ExpectativaService.compararVenta(v.id);
        if (comp) comparacionesV.push(comp);
      }
      setComparacionesVentas(comparacionesV);

      // Filtrar OCs del período con expectativa de requerimiento
      const ocsPeriodo = ordenes.filter(o => {
        const fecha = o.fechaCreacion?.toDate?.() || new Date(o.fechaCreacion as unknown as string);
        return (
          fecha.getMonth() + 1 === mesSeleccionado &&
          fecha.getFullYear() === anioSeleccionado &&
          (o as any).expectativaRequerimiento
        );
      });

      const comparacionesC: ComparacionCompra[] = [];
      for (const oc of ocsPeriodo) {
        const comp = await ExpectativaService.compararCompra(oc.id);
        if (comp) comparacionesC.push(comp);
      }
      setComparacionesCompras(comparacionesC);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: 'PEN' | 'USD' = 'PEN') => {
    return `${currency === 'PEN' ? 'S/' : '$'} ${amount.toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expectativa vs Realidad</h1>
          <p className="text-gray-600 mt-1">
            Análisis de cumplimiento financiero - Ventas y Compras
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={mesSeleccionado}
            onChange={(e) => setMesSeleccionado(parseInt(e.target.value))}
            className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2024, i).toLocaleDateString('es-PE', { month: 'long' })}
              </option>
            ))}
          </select>
          <select
            value={anioSeleccionado}
            onChange={(e) => setAnioSeleccionado(parseInt(e.target.value))}
            className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          >
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-primary-600 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando análisis...</div>
      ) : (
        <>
          {/* KPIs Cruzados (desde getStats) */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card padding="md" className="border-l-4 border-l-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Tasa Conversión</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {stats.ventas.tasaConversion.toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {stats.ventas.cotizacionesConvertidas}/{stats.ventas.totalCotizaciones} cotizaciones
                    </div>
                  </div>
                  <Target className="h-10 w-10 text-blue-400" />
                </div>
              </Card>

              <Card padding="md" className={`border-l-4 ${
                stats.ventas.cumplimientoUtilidad >= 100 ? 'border-l-green-500' : 'border-l-yellow-500'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Cumplimiento Utilidad</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {stats.ventas.cumplimientoUtilidad.toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Real: {formatCurrency(stats.ventas.utilidadTotalReal)}
                    </div>
                  </div>
                  {stats.ventas.cumplimientoUtilidad >= 100 ? (
                    <TrendingUp className="h-10 w-10 text-green-400" />
                  ) : (
                    <TrendingDown className="h-10 w-10 text-yellow-400" />
                  )}
                </div>
              </Card>

              <Card padding="md" className={`border-l-4 ${
                stats.compras.porcentajeDentroPresupuesto >= 80 ? 'border-l-green-500' : 'border-l-orange-500'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Compras en Presupuesto</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {stats.compras.porcentajeDentroPresupuesto.toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {stats.compras.requerimientosDentroPresupuesto}/{stats.compras.requerimientosCompletados} completados
                    </div>
                  </div>
                  <Package className="h-10 w-10 text-orange-400" />
                </div>
              </Card>

              <Card padding="md" className={`border-l-4 ${
                stats.impactoTC.impactoNetoTC >= 0 ? 'border-l-green-500' : 'border-l-red-500'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Impacto Neto TC</div>
                    <div className={`text-2xl font-bold ${
                      stats.impactoTC.impactoNetoTC >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stats.impactoTC.impactoNetoTC >= 0 ? '+' : ''}
                      {formatCurrency(stats.impactoTC.impactoNetoTC)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Ventas: {formatCurrency(stats.impactoTC.impactoTotalTCVentas)} | Compras: {formatCurrency(stats.impactoTC.impactoTotalTCCompras)}
                    </div>
                  </div>
                  <DollarSign className="h-10 w-10 text-gray-400" />
                </div>
              </Card>
            </div>
          )}

          {/* Tabs: Ventas / Compras */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setTabActiva('ventas')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  tabActiva === 'ventas'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <ShoppingCart className="h-4 w-4" />
                Ventas ({comparacionesVentas.length})
              </button>
              <button
                onClick={() => setTabActiva('compras')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  tabActiva === 'compras'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Package className="h-4 w-4" />
                Compras ({comparacionesCompras.length})
              </button>
            </nav>
          </div>

          {/* Tab: Ventas */}
          {tabActiva === 'ventas' && (
            <>
              {/* Métricas de Ventas */}
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card padding="md" className="bg-blue-50">
                    <div className="text-sm text-blue-600 font-medium">Utilidad Esperada</div>
                    <div className="text-xl font-bold text-blue-900 mt-1">
                      {formatCurrency(stats.ventas.utilidadTotalEsperada)}
                    </div>
                    <div className="text-xs text-blue-700 mt-1">
                      Margen esperado: {stats.ventas.margenPromedioEsperado.toFixed(1)}%
                    </div>
                  </Card>
                  <Card padding="md" className="bg-green-50">
                    <div className="text-sm text-green-600 font-medium">Utilidad Real</div>
                    <div className="text-xl font-bold text-green-900 mt-1">
                      {formatCurrency(stats.ventas.utilidadTotalReal)}
                    </div>
                    <div className="text-xs text-green-700 mt-1">
                      Margen real: {stats.ventas.margenPromedioReal.toFixed(1)}%
                    </div>
                  </Card>
                  <Card padding="md" className={
                    stats.ventas.diferenciaMargenPromedio >= 0 ? 'bg-green-50' : 'bg-red-50'
                  }>
                    <div className={`text-sm font-medium ${
                      stats.ventas.diferenciaMargenPromedio >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>Diferencia Margen</div>
                    <div className={`text-xl font-bold mt-1 flex items-center ${
                      stats.ventas.diferenciaMargenPromedio >= 0 ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {stats.ventas.diferenciaMargenPromedio >= 0 ? (
                        <ArrowUpRight className="h-5 w-5 mr-1" />
                      ) : (
                        <ArrowDownRight className="h-5 w-5 mr-1" />
                      )}
                      {stats.ventas.diferenciaMargenPromedio >= 0 ? '+' : ''}
                      {stats.ventas.diferenciaMargenPromedio.toFixed(1)}%
                    </div>
                  </Card>
                </div>
              )}

              {/* Tabla de Ventas */}
              <Card padding="none">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Detalle de Ventas ({comparacionesVentas.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Venta</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">TC Cotiz.</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">TC Venta</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Utilidad Esp.</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Utilidad Real</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Diferencia</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cumplimiento</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {comparacionesVentas.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                            No hay ventas con expectativa en este período
                          </td>
                        </tr>
                      ) : (
                        comparacionesVentas.map((comp) => (
                          <tr key={comp.ventaId} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium text-primary-600">{comp.numeroVenta}</div>
                              <div className="text-xs text-gray-500">{formatDate(comp.realidad.fechaVenta)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              {comp.expectativa.tcCotizacion.toFixed(3)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              {comp.realidad.tcVenta.toFixed(3)}
                              {comp.diferencias.diferenciaTC !== 0 && (
                                <span className={`ml-1 text-xs ${
                                  comp.diferencias.diferenciaTC > 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  ({comp.diferencias.diferenciaTC > 0 ? '+' : ''}{comp.diferencias.diferenciaTC.toFixed(3)})
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              {formatCurrency(comp.expectativa.utilidadEsperadaPEN)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                              {formatCurrency(comp.realidad.utilidadRealPEN)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              <span className={
                                comp.diferencias.diferenciaUtilidadPEN >= 0 ? 'text-green-600' : 'text-red-600'
                              }>
                                {comp.diferencias.diferenciaUtilidadPEN >= 0 ? '+' : ''}
                                {formatCurrency(comp.diferencias.diferenciaUtilidadPEN)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`text-sm font-medium ${
                                comp.diferencias.porcentajeCumplimiento >= 100 ? 'text-green-600' :
                                comp.diferencias.porcentajeCumplimiento >= 80 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {comp.diferencias.porcentajeCumplimiento.toFixed(0)}%
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {comp.diferencias.cumplioExpectativa ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Cumplió
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  No cumplió
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Razones de diferencias */}
              {comparacionesVentas.filter(c => c.razones && c.razones.length > 0).length > 0 && (
                <Card padding="md">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Razones de las Diferencias</h3>
                  <div className="space-y-3">
                    {comparacionesVentas
                      .filter((c) => c.razones && c.razones.length > 0)
                      .slice(0, 5)
                      .map((comp) => (
                        <div key={comp.ventaId} className="p-3 bg-gray-50 rounded-lg">
                          <div className="font-medium text-gray-900">{comp.numeroVenta}</div>
                          <ul className="mt-1 text-sm text-gray-600 list-disc list-inside">
                            {comp.razones?.map((razon, i) => (
                              <li key={i}>{razon}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Tab: Compras */}
          {tabActiva === 'compras' && (
            <>
              {/* Métricas de Compras */}
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card padding="md" className="bg-blue-50">
                    <div className="text-sm text-blue-600 font-medium">Costo Estimado</div>
                    <div className="text-xl font-bold text-blue-900 mt-1">
                      {formatCurrency(stats.compras.costoTotalEstimado)}
                    </div>
                    <div className="text-xs text-blue-700 mt-1">
                      {stats.compras.totalRequerimientos} requerimientos
                    </div>
                  </Card>
                  <Card padding="md" className="bg-orange-50">
                    <div className="text-sm text-orange-600 font-medium">Costo Real</div>
                    <div className="text-xl font-bold text-orange-900 mt-1">
                      {formatCurrency(stats.compras.costoTotalReal)}
                    </div>
                    <div className="text-xs text-orange-700 mt-1">
                      {stats.compras.requerimientosCompletados} completados
                    </div>
                  </Card>
                  <Card padding="md" className={
                    stats.compras.desviacionPromedio <= 5 ? 'bg-green-50' : 'bg-red-50'
                  }>
                    <div className={`text-sm font-medium ${
                      stats.compras.desviacionPromedio <= 5 ? 'text-green-600' : 'text-red-600'
                    }`}>Desviación Promedio</div>
                    <div className={`text-xl font-bold mt-1 ${
                      stats.compras.desviacionPromedio <= 5 ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {stats.compras.desviacionPromedio >= 0 ? '+' : ''}
                      {stats.compras.desviacionPromedio.toFixed(1)}%
                    </div>
                  </Card>
                </div>
              )}

              {/* Tabla de Compras */}
              <Card padding="none">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Detalle de Compras ({comparacionesCompras.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">OC</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requerimiento</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">TC Invest.</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">TC Compra</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">TC Pago</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Est. USD</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Real USD</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Desviación</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {comparacionesCompras.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                            No hay compras con expectativa en este período
                          </td>
                        </tr>
                      ) : (
                        comparacionesCompras.map((comp) => (
                          <tr key={comp.ordenCompraId} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium text-primary-600">{comp.numeroOrdenCompra}</div>
                              <div className="text-xs text-gray-500">{formatDate(comp.realidad.fechaCompra)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                              {comp.numeroRequerimiento}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              {comp.expectativa.tcInvestigacion.toFixed(3)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              {comp.realidad.tcCompra.toFixed(3)}
                              {comp.diferencias.diferenciaTC !== 0 && (
                                <span className={`ml-1 text-xs ${
                                  comp.diferencias.diferenciaTC < 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  ({comp.diferencias.diferenciaTC > 0 ? '+' : ''}{comp.diferencias.diferenciaTC.toFixed(3)})
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              {comp.realidad.tcPago
                                ? comp.realidad.tcPago.toFixed(3)
                                : <span className="text-gray-400">-</span>
                              }
                              {comp.diferencias.diferenciaTCPago != null && comp.diferencias.diferenciaTCPago !== 0 && (
                                <span className={`ml-1 text-xs ${
                                  comp.diferencias.diferenciaTCPago < 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  ({comp.diferencias.diferenciaTCPago > 0 ? '+' : ''}{comp.diferencias.diferenciaTCPago.toFixed(3)})
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              {formatCurrency(comp.expectativa.costoTotalEstimadoUSD, 'USD')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                              {formatCurrency(comp.realidad.costoTotalRealUSD, 'USD')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              <span className={
                                comp.diferencias.porcentajeDesviacion <= 5 ? 'text-green-600' : 'text-red-600'
                              }>
                                {comp.diferencias.porcentajeDesviacion > 0 ? '+' : ''}
                                {comp.diferencias.porcentajeDesviacion.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {comp.diferencias.dentroPresupuesto ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  En presupuesto
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Excedido
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Razones de diferencias en compras */}
              {comparacionesCompras.filter(c => c.razones && c.razones.length > 0).length > 0 && (
                <Card padding="md">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Razones de Desviación</h3>
                  <div className="space-y-3">
                    {comparacionesCompras
                      .filter((c) => c.razones && c.razones.length > 0)
                      .slice(0, 5)
                      .map((comp) => (
                        <div key={comp.ordenCompraId} className="p-3 bg-gray-50 rounded-lg">
                          <div className="font-medium text-gray-900">
                            {comp.numeroOrdenCompra} - {comp.numeroRequerimiento}
                          </div>
                          <ul className="mt-1 text-sm text-gray-600 list-disc list-inside">
                            {comp.razones?.map((razon, i) => (
                              <li key={i}>{razon}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Alertas y Observaciones */}
          {stats && (
            <Card padding="md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
                Alertas y Observaciones
              </h3>
              <div className="space-y-3">
                {comparacionesVentas.length === 0 && comparacionesCompras.length === 0 ? (
                  <div className="text-gray-500 text-sm">
                    No hay operaciones con expectativa registrada en este período.
                    Las expectativas se registran automáticamente al crear cotizaciones y requerimientos.
                  </div>
                ) : (
                  <>
                    {stats.ventas.cumplimientoUtilidad < 80 && stats.ventas.cotizacionesConvertidas > 0 && (
                      <div className="flex items-start p-3 bg-yellow-50 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-yellow-800">Cumplimiento de utilidad bajo</div>
                          <div className="text-sm text-yellow-600">
                            Solo se cumplió el {stats.ventas.cumplimientoUtilidad.toFixed(0)}% de la utilidad esperada en ventas
                          </div>
                        </div>
                      </div>
                    )}
                    {stats.impactoTC.impactoNetoTC < -100 && (
                      <div className="flex items-start p-3 bg-red-50 rounded-lg">
                        <TrendingDown className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-red-800">Pérdida por tipo de cambio</div>
                          <div className="text-sm text-red-600">
                            La variación del TC generó una pérdida neta de {formatCurrency(Math.abs(stats.impactoTC.impactoNetoTC))}
                          </div>
                        </div>
                      </div>
                    )}
                    {stats.compras.desviacionPromedio > 10 && stats.compras.requerimientosCompletados > 0 && (
                      <div className="flex items-start p-3 bg-orange-50 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-orange-800">Desviación alta en compras</div>
                          <div className="text-sm text-orange-600">
                            Las compras excedieron el presupuesto en promedio un {stats.compras.desviacionPromedio.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    )}
                    {stats.ventas.cumplimientoUtilidad >= 80 && stats.impactoTC.impactoNetoTC >= 0 && (
                      <div className="flex items-start p-3 bg-green-50 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-green-800">Buen desempeño</div>
                          <div className="text-sm text-green-600">
                            Las expectativas se están cumpliendo consistentemente
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
