import React, { useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Package, 
  ShoppingCart, 
  AlertTriangle,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import { Card } from '../../components/common';
import { TendenciaChart } from '../../components/modules/reporte/TendenciaChart';
import { ProductosRentabilidadTable } from '../../components/modules/reporte/ProductosRentabilidadTable';
import { InventarioValorizadoTable } from '../../components/modules/reporte/InventarioValorizadoTable';
import { AlertasInventario } from '../../components/modules/reporte/AlertasInventario';
import { useReporteStore } from '../../store/reporteStore';

export const Reportes: React.FC = () => {
  const {
    resumenEjecutivo,
    productosRentabilidad,
    inventarioValorizado,
    ventasPorCanal,
    tendenciaVentas,
    alertasInventario,
    loading,
    fetchAll
  } = useReporteStore();

  // Cargar todos los reportes al montar
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading && !resumenEjecutivo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Generando reportes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
        <p className="text-gray-600 mt-1">Análisis ejecutivo y métricas del negocio</p>
      </div>

      {/* Resumen Ejecutivo */}
      {resumenEjecutivo && (
        <>
          {/* KPIs Principales */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Resumen Ejecutivo</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card padding="md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Ventas Totales</div>
                    <div className="text-2xl font-bold text-primary-600 mt-1">
                      S/ {resumenEjecutivo.ventasTotalesPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Mes: S/ {resumenEjecutivo.ventasMes.toFixed(0)}
                    </div>
                  </div>
                  <ShoppingCart className="h-10 w-10 text-primary-400" />
                </div>
              </Card>

              <Card padding="md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Utilidad Total</div>
                    <div className="text-2xl font-bold text-success-600 mt-1">
                      S/ {resumenEjecutivo.utilidadTotalPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Margen: {resumenEjecutivo.margenPromedio.toFixed(1)}%
                    </div>
                  </div>
                  <TrendingUp className="h-10 w-10 text-success-400" />
                </div>
              </Card>

              <Card padding="md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Valor Inventario</div>
                    <div className="text-2xl font-bold text-warning-600 mt-1">
                      S/ {resumenEjecutivo.valorInventarioPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {resumenEjecutivo.unidadesDisponibles} disponibles
                    </div>
                  </div>
                  <Package className="h-10 w-10 text-warning-400" />
                </div>
              </Card>

              <Card padding="md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Inversión Total</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">
                      ${resumenEjecutivo.inversionTotalUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      TC: {resumenEjecutivo.tcActual.toFixed(3)}
                    </div>
                  </div>
                  <DollarSign className="h-10 w-10 text-gray-400" />
                </div>
              </Card>
            </div>
          </div>

          {/* KPIs Secundarios */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card padding="md">
              <div className="text-sm text-gray-600 mb-2">Ventas por Período</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Hoy:</span>
                  <span className="font-semibold text-gray-900">
                    S/ {resumenEjecutivo.ventasHoy.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Semana:</span>
                  <span className="font-semibold text-gray-900">
                    S/ {resumenEjecutivo.ventasSemana.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Mes:</span>
                  <span className="font-semibold text-primary-600">
                    S/ {resumenEjecutivo.ventasMes.toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>

            <Card padding="md">
              <div className="text-sm text-gray-600 mb-2">Inventario</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Total Unidades:</span>
                  <span className="font-semibold text-gray-900">
                    {resumenEjecutivo.unidadesTotales}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Disponibles:</span>
                  <span className="font-semibold text-success-600">
                    {resumenEjecutivo.unidadesDisponibles}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Productos:</span>
                  <span className="font-semibold text-gray-900">
                    {resumenEjecutivo.productosActivos}
                  </span>
                </div>
              </div>
            </Card>

            <Card padding="md">
              <div className="text-sm text-gray-600 mb-2">Órdenes de Compra</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Activas:</span>
                  <span className="font-semibold text-warning-600">
                    {resumenEjecutivo.ordenesActivas}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Recibidas:</span>
                  <span className="font-semibold text-success-600">
                    {resumenEjecutivo.ordenesRecibidas}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">TC Promedio:</span>
                  <span className="font-semibold text-gray-900">
                    {resumenEjecutivo.tcPromedio.toFixed(3)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Alertas de Inventario */}
      {alertasInventario.length > 0 && (
        <Card padding="md">
          <div className="flex items-center mb-4">
            <AlertTriangle className="h-6 w-6 text-warning-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">
              Alertas de Inventario ({alertasInventario.length})
            </h2>
          </div>
          <AlertasInventario alertas={alertasInventario} />
        </Card>
      )}

      {/* Tendencia de Ventas */}
      <Card padding="md">
        <div className="flex items-center mb-4">
          <Activity className="h-6 w-6 text-primary-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">
            Tendencia de Ventas (30 días)
          </h2>
        </div>
        <TendenciaChart data={tendenciaVentas} />
      </Card>

      {/* Ventas por Canal */}
      {ventasPorCanal && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card padding="md">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">Mercado Libre</div>
              <PieChart className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {ventasPorCanal.mercadoLibre.cantidad}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              S/ {ventasPorCanal.mercadoLibre.totalPEN.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {ventasPorCanal.mercadoLibre.porcentaje.toFixed(1)}% del total
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">Venta Directa</div>
              <PieChart className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {ventasPorCanal.directo.cantidad}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              S/ {ventasPorCanal.directo.totalPEN.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {ventasPorCanal.directo.porcentaje.toFixed(1)}% del total
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">Otros Canales</div>
              <PieChart className="h-5 w-5 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {ventasPorCanal.otro.cantidad}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              S/ {ventasPorCanal.otro.totalPEN.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {ventasPorCanal.otro.porcentaje.toFixed(1)}% del total
            </div>
          </Card>
        </div>
      )}

      {/* Top Productos por Rentabilidad */}
      {resumenEjecutivo && resumenEjecutivo.productosMasVendidos.length > 0 && (
        <Card padding="md">
          <div className="flex items-center mb-4">
            <BarChart3 className="h-6 w-6 text-success-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">
              Top 5 Productos Más Vendidos
            </h2>
          </div>
          <ProductosRentabilidadTable productos={resumenEjecutivo.productosMasVendidos} />
        </Card>
      )}

      {/* Análisis de Rentabilidad Completo */}
      {productosRentabilidad.length > 0 && (
        <Card padding="md">
          <div className="flex items-center mb-4">
            <TrendingUp className="h-6 w-6 text-primary-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">
              Análisis de Rentabilidad por Producto
            </h2>
          </div>
          <ProductosRentabilidadTable productos={productosRentabilidad} />
        </Card>
      )}

      {/* Inventario Valorizado */}
      {inventarioValorizado.length > 0 && (
        <Card padding="md">
          <div className="flex items-center mb-4">
            <Package className="h-6 w-6 text-warning-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">
              Inventario Valorizado
            </h2>
          </div>
          <InventarioValorizadoTable inventario={inventarioValorizado} />
        </Card>
      )}
    </div>
  );
};