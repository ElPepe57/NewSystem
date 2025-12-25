import React, { useEffect, useState } from 'react';
import {
  Calculator,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  PieChart,
  BarChart3,
  Briefcase,
  Truck,
  Settings,
  Receipt,
  Info
} from 'lucide-react';
import { Card } from '../../components/common';
import { useCTRUStore } from '../../store/ctruStore';
import { CATEGORIAS_GASTO } from '../../types/gasto.types';

export const CTRUDashboard: React.FC = () => {
  const {
    resumen,
    productosTop,
    desgloseCostos,
    loading,
    recalculando,
    error,
    fetchAll,
    recalcularCTRU
  } = useCTRUStore();

  const [recalculoResultado, setRecalculoResultado] = useState<{
    unidadesActualizadas: number;
    gastosAplicados: number;
    impactoPorUnidad: number;
  } | null>(null);
  const [showResultado, setShowResultado] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleRecalcular = async () => {
    try {
      const resultado = await recalcularCTRU();
      setRecalculoResultado(resultado);
      setShowResultado(true);
      setTimeout(() => setShowResultado(false), 5000);
    } catch (err) {
      console.error('Error al recalcular CTRU:', err);
    }
  };

  if (loading && !resumen) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando datos de CTRU...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard CTRU</h1>
          <p className="text-gray-600 mt-1">
            Costo Total Real por Unidad - Análisis y gestión de costos
          </p>
        </div>
        <button
          onClick={handleRecalcular}
          disabled={recalculando}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
            ${recalculando
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-primary-600 text-white hover:bg-primary-700'
            }
          `}
        >
          <RefreshCw className={`h-5 w-5 ${recalculando ? 'animate-spin' : ''}`} />
          {recalculando ? 'Recalculando...' : 'Recalcular CTRU'}
        </button>
      </div>

      {/* Resultado del Recálculo */}
      {showResultado && recalculoResultado && (
        <div className="bg-success-50 border border-success-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="h-6 w-6 text-success-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-success-900">Recálculo completado</h3>
            <p className="text-success-700 text-sm mt-1">
              Se actualizaron {recalculoResultado.unidadesActualizadas} unidades
              con {recalculoResultado.gastosAplicados} gastos aplicados.
              Impacto por unidad: S/ {recalculoResultado.impactoPorUnidad.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-danger-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-danger-900">Error</h3>
            <p className="text-danger-700 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* KPIs Principales */}
      {resumen && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">CTRU Promedio Global</div>
                <div className="text-2xl font-bold text-primary-600 mt-1">
                  S/ {resumen.ctruPromedioGlobal.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Costo real por unidad
                </div>
              </div>
              <Calculator className="h-10 w-10 text-primary-400" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Unidades Disponibles</div>
                <div className="text-2xl font-bold text-success-600 mt-1">
                  {resumen.totalUnidadesDisponibles}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  En inventario Perú
                </div>
              </div>
              <Package className="h-10 w-10 text-success-400" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Gastos por Prorratear</div>
                <div className="text-2xl font-bold text-warning-600 mt-1">
                  S/ {resumen.totalGastosProrrateablesMes.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Pendientes del mes
                </div>
              </div>
              <DollarSign className="h-10 w-10 text-warning-400" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Impacto por Unidad</div>
                <div className={`text-2xl font-bold mt-1 ${
                  resumen.impactoPorUnidad > 0 ? 'text-danger-600' : 'text-gray-600'
                }`}>
                  S/ {resumen.impactoPorUnidad.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Al aplicar gastos
                </div>
              </div>
              {resumen.impactoPorUnidad > 0 ? (
                <TrendingUp className="h-10 w-10 text-danger-400" />
              ) : (
                <TrendingDown className="h-10 w-10 text-success-400" />
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Desglose de Costos */}
      {desgloseCostos && resumen && resumen.totalUnidadesDisponibles > 0 && (
        <Card padding="md">
          <div className="flex items-center mb-4">
            <PieChart className="h-6 w-6 text-primary-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">
              Desglose de Costos del Inventario
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gráfico visual simple */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Costo de Compra (PEN)</span>
                  <span className="font-medium">
                    S/ {desgloseCostos.costoCompraPEN.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full"
                    style={{
                      width: `${desgloseCostos.ctruFinal > 0 ? (desgloseCostos.costoCompraPEN / desgloseCostos.ctruFinal) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Costo de Flete</span>
                  <span className="font-medium">
                    S/ {desgloseCostos.costoFletePEN.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-orange-500 h-3 rounded-full"
                    style={{
                      width: `${desgloseCostos.ctruFinal > 0 ? (desgloseCostos.costoFletePEN / desgloseCostos.ctruFinal) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Gastos GA + GO (Prorrateados)</span>
                  <span className="font-medium">
                    S/ {desgloseCostos.gastosProrrateadosPEN.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-purple-500 h-3 rounded-full"
                    style={{
                      width: `${desgloseCostos.ctruFinal > 0 ? (desgloseCostos.gastosProrrateadosPEN / desgloseCostos.ctruFinal) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Resumen numérico */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Resumen Total</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Compra USD:</span>
                  <span className="font-medium">
                    ${desgloseCostos.costoCompraUSD.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Compra PEN:</span>
                  <span className="font-medium">
                    S/ {desgloseCostos.costoCompraPEN.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Flete:</span>
                  <span className="font-medium">
                    S/ {desgloseCostos.costoFletePEN.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Gastos GA+GO:</span>
                  <span className="font-medium">
                    S/ {desgloseCostos.gastosProrrateadosPEN.toFixed(2)}
                  </span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">CTRU Total:</span>
                    <span className="font-bold text-primary-600">
                      S/ {desgloseCostos.ctruFinal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-500">Promedio por unidad:</span>
                    <span className="text-gray-700">
                      S/ {(desgloseCostos.ctruFinal / resumen.totalUnidadesDisponibles).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Desglose de Gastos por Categoría */}
      {desgloseCostos?.gastosPorCategoria && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gastos que impactan CTRU (GA + GO) */}
          <Card padding="md" className="border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Settings className="h-5 w-5 text-amber-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Gastos que Impactan CTRU
                </h3>
              </div>
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                Se prorratean entre unidades
              </span>
            </div>

            <div className="space-y-4">
              {/* GA - Gastos Administrativos */}
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-amber-500 rounded-full mr-3"></div>
                  <div>
                    <span className="font-medium text-gray-900">GA - {CATEGORIAS_GASTO.GA.nombre}</span>
                    <p className="text-xs text-gray-500">{CATEGORIAS_GASTO.GA.descripcion}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-amber-700">
                    S/ {desgloseCostos.gastosPorCategoria.gastosAdministrativos.toFixed(2)}
                  </span>
                  <p className="text-xs text-gray-500">
                    {desgloseCostos.gastosPorCategoria.cantidadGA} gastos
                  </p>
                </div>
              </div>

              {/* GO - Gastos Operativos */}
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <div>
                    <span className="font-medium text-gray-900">GO - {CATEGORIAS_GASTO.GO.nombre}</span>
                    <p className="text-xs text-gray-500">{CATEGORIAS_GASTO.GO.descripcion}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-green-700">
                    S/ {desgloseCostos.gastosPorCategoria.gastosOperativos.toFixed(2)}
                  </span>
                  <p className="text-xs text-gray-500">
                    {desgloseCostos.gastosPorCategoria.cantidadGO} gastos
                  </p>
                </div>
              </div>

              {/* Total que impacta CTRU */}
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total prorrateado:</span>
                  <span className="text-lg font-bold text-amber-600">
                    S/ {desgloseCostos.gastosPorCategoria.totalImpactaCTRU.toFixed(2)}
                  </span>
                </div>
                {resumen && resumen.totalUnidadesDisponibles > 0 && (
                  <p className="text-sm text-gray-500 mt-1 text-right">
                    = S/ {(desgloseCostos.gastosPorCategoria.totalImpactaCTRU / resumen.totalUnidadesDisponibles).toFixed(2)} por unidad
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Gastos que NO impactan CTRU (GV + GD) */}
          <Card padding="md" className="border-l-4 border-l-purple-500">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Receipt className="h-5 w-5 text-purple-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Gastos por Venta
                </h3>
              </div>
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                Se descuentan de utilidad
              </span>
            </div>

            <div className="space-y-4">
              {/* GV - Gastos de Venta */}
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                  <div>
                    <span className="font-medium text-gray-900">GV - {CATEGORIAS_GASTO.GV.nombre}</span>
                    <p className="text-xs text-gray-500">{CATEGORIAS_GASTO.GV.descripcion}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-purple-700">
                    S/ {desgloseCostos.gastosPorCategoria.gastosVenta.toFixed(2)}
                  </span>
                  <p className="text-xs text-gray-500">
                    {desgloseCostos.gastosPorCategoria.cantidadGV} gastos
                  </p>
                </div>
              </div>

              {/* GD - Gastos de Distribución */}
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                  <div>
                    <span className="font-medium text-gray-900">GD - {CATEGORIAS_GASTO.GD.nombre}</span>
                    <p className="text-xs text-gray-500">{CATEGORIAS_GASTO.GD.descripcion}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-blue-700">
                    S/ {desgloseCostos.gastosPorCategoria.gastosDistribucion.toFixed(2)}
                  </span>
                  <p className="text-xs text-gray-500">
                    {desgloseCostos.gastosPorCategoria.cantidadGD} gastos
                  </p>
                </div>
              </div>

              {/* Total que NO impacta CTRU */}
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total asociado a ventas:</span>
                  <span className="text-lg font-bold text-purple-600">
                    S/ {desgloseCostos.gastosPorCategoria.totalNoImpactaCTRU.toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1 text-right">
                  No afecta el costo de inventario
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Fórmula CTRU */}
      <Card padding="md" className="bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Calculator className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-blue-900">Fórmula CTRU</h3>
            <p className="text-blue-800 mt-2 font-mono text-sm">
              CTRU = (Costo USD × TC) + Flete + (GA + GO) / Unidades Disponibles
            </p>
            <div className="mt-3 text-sm text-blue-700 space-y-1">
              <p>• <strong>Costo USD × TC:</strong> Costo de compra convertido a soles</p>
              <p>• <strong>Flete:</strong> Costo de envío USA→Perú prorrateado por OC</p>
              <p>• <strong>GA (Administrativos):</strong> Servicios, planilla, contador, software</p>
              <p>• <strong>GO (Operativos):</strong> Movilidad, útiles, mantenimiento, almacenaje</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Nota sobre GV/GD */}
      <Card padding="md" className="bg-purple-50 border-purple-200">
        <div className="flex items-start gap-3">
          <Info className="h-6 w-6 text-purple-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-purple-900">Gastos de Venta y Distribución</h3>
            <p className="text-purple-800 mt-2 text-sm">
              Los gastos <strong>GV</strong> (comisiones, fees de plataformas) y <strong>GD</strong> (envíos, motorizado)
              <strong className="text-purple-900"> no se prorratean en el CTRU</strong>.
            </p>
            <p className="text-purple-700 mt-2 text-sm">
              Estos gastos se asocian a ventas específicas y se descuentan directamente de la utilidad
              de cada venta para calcular la ganancia neta real.
            </p>
          </div>
        </div>
      </Card>

      {/* Top Productos por CTRU */}
      {productosTop.length > 0 && (
        <Card padding="md">
          <div className="flex items-center mb-4">
            <BarChart3 className="h-6 w-6 text-warning-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">
              Top 10 Productos por CTRU (Mayor Costo)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CTRU Promedio
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rango CTRU
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unidades
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {productosTop.map((producto, index) => (
                  <tr key={producto.productoId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {producto.productoNombre}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {producto.productoSKU}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <span className={`text-sm font-semibold ${
                        index < 3 ? 'text-danger-600' : 'text-gray-900'
                      }`}>
                        S/ {producto.ctruPromedio.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-500">
                      S/ {producto.ctruMinimo.toFixed(2)} - S/ {producto.ctruMaximo.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {producto.unidadesDisponibles}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Sin datos */}
      {resumen && resumen.totalUnidadesDisponibles === 0 && (
        <Card padding="lg">
          <div className="text-center py-8">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Sin unidades disponibles</h3>
            <p className="text-gray-500 mt-2">
              No hay unidades en estado "disponible_peru" para calcular CTRU.
              <br />
              Registra recepciones de órdenes de compra para ver los costos aquí.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};
