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
  XCircle
} from 'lucide-react';
import { Card } from '../../components/common';
import { ExpectativaService } from '../../services/expectativa.service';
import { VentaService } from '../../services/venta.service';
import type { ComparacionVenta } from '../../types/expectativa.types';
import type { Venta } from '../../types/venta.types';

export const Expectativas: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [comparacionesVentas, setComparacionesVentas] = useState<ComparacionVenta[]>([]);
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1);
  const [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear());

  useEffect(() => {
    loadData();
  }, [mesSeleccionado, anioSeleccionado]);

  const loadData = async () => {
    setLoading(true);
    try {
      const ventas = await VentaService.getAll();

      // Filtrar ventas con expectativa y calcular comparaciones
      const ventasConExpectativa = ventas.filter(
        (v) => v.expectativaCotizacion && v.estado !== 'cotizacion'
      );

      const comparaciones: ComparacionVenta[] = [];
      for (const v of ventasConExpectativa) {
        const comp = await ExpectativaService.compararVenta(v.id);
        if (comp) {
          comparaciones.push(comp);
        }
      }

      setComparacionesVentas(comparaciones);
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

  // Calcular métricas agregadas
  const metricas = {
    ventasAnalizadas: comparacionesVentas.length,
    cumplieron: comparacionesVentas.filter((c) => c.diferencias.cumplioExpectativa).length,
    noCumplieron: comparacionesVentas.filter((c) => !c.diferencias.cumplioExpectativa).length,
    utilidadEsperadaTotal: comparacionesVentas.reduce(
      (sum, c) => sum + c.expectativa.utilidadEsperadaPEN,
      0
    ),
    utilidadRealTotal: comparacionesVentas.reduce(
      (sum, c) => sum + c.realidad.utilidadRealPEN,
      0
    ),
    diferenciaUtilidadTotal: comparacionesVentas.reduce(
      (sum, c) => sum + c.diferencias.diferenciaUtilidadPEN,
      0
    ),
    impactoTCTotal: comparacionesVentas.reduce(
      (sum, c) => sum + c.diferencias.impactoTCenPEN,
      0
    ),
    cumplimientoPromedio:
      comparacionesVentas.length > 0
        ? comparacionesVentas.reduce((sum, c) => sum + c.diferencias.porcentajeCumplimiento, 0) /
          comparacionesVentas.length
        : 0
  };

  const tasaCumplimiento =
    metricas.ventasAnalizadas > 0
      ? (metricas.cumplieron / metricas.ventasAnalizadas) * 100
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expectativa vs Realidad</h1>
          <p className="text-gray-600 mt-1">
            Análisis de cumplimiento de expectativas financieras
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
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando análisis...</div>
      ) : (
        <>
          {/* KPIs Principales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card padding="md" className="border-l-4 border-l-primary-500">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Ventas Analizadas</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {metricas.ventasAnalizadas}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Con expectativa registrada</div>
                </div>
                <BarChart3 className="h-10 w-10 text-primary-400" />
              </div>
            </Card>

            <Card
              padding="md"
              className={`border-l-4 ${
                tasaCumplimiento >= 80
                  ? 'border-l-green-500'
                  : tasaCumplimiento >= 50
                  ? 'border-l-yellow-500'
                  : 'border-l-red-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Tasa de Cumplimiento</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {tasaCumplimiento.toFixed(0)}%
                  </div>
                  <div className="text-sm mt-1">
                    <span className="text-green-600">{metricas.cumplieron} ok</span>
                    {' / '}
                    <span className="text-red-600">{metricas.noCumplieron} bajo</span>
                  </div>
                </div>
                <Target className="h-10 w-10 text-gray-400" />
              </div>
            </Card>

            <Card padding="md" className="border-l-4 border-l-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Utilidad Esperada</div>
                  <div className="text-xl font-bold text-gray-900">
                    {formatCurrency(metricas.utilidadEsperadaTotal)}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Total cotizado</div>
                </div>
                <DollarSign className="h-10 w-10 text-blue-400" />
              </div>
            </Card>

            <Card
              padding="md"
              className={`border-l-4 ${
                metricas.diferenciaUtilidadTotal >= 0 ? 'border-l-green-500' : 'border-l-red-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Utilidad Real</div>
                  <div className="text-xl font-bold text-gray-900">
                    {formatCurrency(metricas.utilidadRealTotal)}
                  </div>
                  <div
                    className={`text-sm mt-1 flex items-center ${
                      metricas.diferenciaUtilidadTotal >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {metricas.diferenciaUtilidadTotal >= 0 ? (
                      <ArrowUpRight className="h-4 w-4 mr-1" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 mr-1" />
                    )}
                    {formatCurrency(Math.abs(metricas.diferenciaUtilidadTotal))}
                  </div>
                </div>
                {metricas.diferenciaUtilidadTotal >= 0 ? (
                  <TrendingUp className="h-10 w-10 text-green-400" />
                ) : (
                  <TrendingDown className="h-10 w-10 text-red-400" />
                )}
              </div>
            </Card>
          </div>

          {/* Impacto del Tipo de Cambio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card padding="md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-primary-500" />
                Impacto del Tipo de Cambio
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600">Impacto TC en Ventas</div>
                    <div className="text-xs text-gray-500">
                      Diferencia entre TC cotización y TC venta
                    </div>
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      metricas.impactoTCTotal >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {metricas.impactoTCTotal >= 0 ? '+' : ''}
                    {formatCurrency(metricas.impactoTCTotal)}
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600">Cumplimiento Promedio</div>
                    <div className="text-xs text-gray-500">Utilidad real vs esperada</div>
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      metricas.cumplimientoPromedio >= 100 ? 'text-green-600' : 'text-yellow-600'
                    }`}
                  >
                    {metricas.cumplimientoPromedio.toFixed(0)}%
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
                Alertas y Observaciones
              </h3>
              <div className="space-y-3">
                {comparacionesVentas.length === 0 ? (
                  <div className="text-gray-500 text-sm">
                    No hay ventas con expectativa registrada para analizar
                  </div>
                ) : (
                  <>
                    {tasaCumplimiento < 80 && (
                      <div className="flex items-start p-3 bg-yellow-50 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-yellow-800">
                            Tasa de cumplimiento baja
                          </div>
                          <div className="text-sm text-yellow-600">
                            Solo el {tasaCumplimiento.toFixed(0)}% de las ventas cumplieron la
                            expectativa
                          </div>
                        </div>
                      </div>
                    )}
                    {metricas.impactoTCTotal < -100 && (
                      <div className="flex items-start p-3 bg-red-50 rounded-lg">
                        <TrendingDown className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-red-800">Pérdida por tipo de cambio</div>
                          <div className="text-sm text-red-600">
                            La variación del TC generó una pérdida de{' '}
                            {formatCurrency(Math.abs(metricas.impactoTCTotal))}
                          </div>
                        </div>
                      </div>
                    )}
                    {tasaCumplimiento >= 80 && metricas.diferenciaUtilidadTotal >= 0 && (
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
          </div>

          {/* Tabla de Comparaciones */}
          <Card padding="none">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Detalle de Comparaciones ({comparacionesVentas.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Venta
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      TC Cotiz.
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      TC Venta
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Utilidad Esp.
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Utilidad Real
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Diferencia
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Cumplimiento
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {comparacionesVentas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        No hay comparaciones disponibles
                      </td>
                    </tr>
                  ) : (
                    comparacionesVentas.map((comp) => (
                      <tr key={comp.ventaId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-primary-600">{comp.numeroVenta}</div>
                          <div className="text-xs text-gray-500">
                            {formatDate(comp.realidad.fechaVenta)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {comp.expectativa.tcCotizacion.toFixed(3)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {comp.realidad.tcVenta.toFixed(3)}
                          {comp.diferencias.diferenciaTC !== 0 && (
                            <span
                              className={`ml-1 text-xs ${
                                comp.diferencias.diferenciaTC > 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              ({comp.diferencias.diferenciaTC > 0 ? '+' : ''}
                              {comp.diferencias.diferenciaTC.toFixed(3)})
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
                          <span
                            className={
                              comp.diferencias.diferenciaUtilidadPEN >= 0
                                ? 'text-green-600'
                                : 'text-red-600'
                            }
                          >
                            {comp.diferencias.diferenciaUtilidadPEN >= 0 ? '+' : ''}
                            {formatCurrency(comp.diferencias.diferenciaUtilidadPEN)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span
                            className={`text-sm font-medium ${
                              comp.diferencias.porcentajeCumplimiento >= 100
                                ? 'text-green-600'
                                : comp.diferencias.porcentajeCumplimiento >= 80
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}
                          >
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

          {/* Insights */}
          {comparacionesVentas.length > 0 && (
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
    </div>
  );
};
