import React, { useEffect, useState } from 'react';
import {
  Calculator,
  Package,
  Truck,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import { Card, GradientHeader } from '../../components/common';
import { LineaFilterInline } from '../../components/common/LineaFilterInline';
import {
  CTRUKPIGrid,
  CostCompositionChart,
  CostEvolutionChart,
  MarginErosionChart,
  ExpenseTrendChart,
  ProductoCTRUTable,
  ProductoCTRUDetail,
  LoteOCTable
} from '../../components/modules/ctru';
import { useCTRUStore } from '../../store/ctruStore';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import type { CTRUProductoDetalle } from '../../store/ctruStore';
import { logger } from '../../lib/logger';

type TabActiva = 'resumen' | 'catalogo' | 'lote';

export const CTRUDashboard: React.FC = () => {
  const {
    resumen,
    productosDetalle,
    historialMensual,
    historialGastos,
    lotesOC,
    loading,
    error,
    fetchAll
  } = useCTRUStore();

  const [tabActiva, setTabActiva] = useState<TabActiva>('resumen');
  const [productoSeleccionado, setProductoSeleccionado] = useState<CTRUProductoDetalle | null>(null);
  const [vistaCosto, setVistaCosto] = useState<'contable' | 'gerencial'>('contable');

  // Filtrar productos por línea de negocio global
  const productosFiltrados = useLineaFilter(productosDetalle, p => p.lineaNegocioId);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Proyecciones eliminadas de CTRU — ahora viven en /proyeccion

  if (loading && !resumen) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando datos de CTRU...</p>
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: TabActiva; label: string; labelShort?: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'resumen', label: 'Resumen', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'catalogo', label: 'Catalogo de Costos', labelShort: 'Costos', icon: <Package className="w-4 h-4" />, badge: productosFiltrados.length },
    { id: 'lote', label: 'Por Lote/OC', labelShort: 'Lotes', icon: <Truck className="w-4 h-4" />, badge: lotesOC.length }
  ];

  return (
    <div className="space-y-0 overflow-x-hidden">
      {/* Header */}
      <GradientHeader
        title="CTRU - Costo Total Real por Unidad"
        subtitle="Analisis completo de costos, margenes y pricing por producto"
        icon={Calculator}
        variant="blue"
      />

      {/* Filtro de línea de negocio */}
      <LineaFilterInline />

      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm px-3 sm:px-6 py-2 sm:py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide min-w-0 flex-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTabActiva(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                  tabActiva === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="hidden sm:inline">{tab.icon}</span>
                <span className="sm:hidden">{tab.labelShort || tab.label}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    tabActiva === tab.id ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Toggle Contable/Gerencial — solo visible en tab Catálogo */}
            {tabActiva === 'catalogo' && (
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setVistaCosto('contable')}
                  className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded-md transition-colors ${
                    vistaCosto === 'contable'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="CTRU Contable: GA/GO solo entre unidades vendidas. Para P&L y estados financieros."
                >
                  <span className="hidden sm:inline">Contable</span>
                  <span className="sm:hidden">C</span>
                </button>
                <button
                  onClick={() => setVistaCosto('gerencial')}
                  className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded-md transition-colors ${
                    vistaCosto === 'gerencial'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="CTRU Gerencial: GA/GO entre todas las unidades. Para cotizar y fijar precios."
                >
                  <span className="hidden sm:inline">Gerencial</span>
                  <span className="sm:hidden">G</span>
                </button>
              </div>
            )}
            {resumen && (
              <div className="text-xs text-gray-500 hidden sm:block">
                {resumen.totalProductos} productos · {resumen.totalProductosActivos} en inventario · {resumen.totalUnidadesActivas + resumen.totalUnidadesVendidas} unidades
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-8 space-y-4 sm:space-y-6">
        {/* Empty state */}
        {resumen && resumen.totalProductos === 0 && tabActiva === 'resumen' && (
          <Card>
            <div className="text-center py-12">
              <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Sin datos de productos</h3>
              <p className="text-gray-500 mt-2">
                No hay unidades registradas para calcular CTRU.
                <br />
                Registra recepciones de ordenes de compra para ver los costos aqui.
              </p>
            </div>
          </Card>
        )}

        {/* Tab: Resumen */}
        {tabActiva === 'resumen' && resumen && (
          <>
            {/* KPIs — 4 compact cards */}
            <CTRUKPIGrid resumen={resumen} productosDetalle={productosFiltrados} />

            {resumen.totalProductos > 0 && (
              <>
                {/* Cost Composition — horizontal stacked bar */}
                <CostCompositionChart productos={productosFiltrados} />

                {/* Charts row: Cost Evolution + Expense Trend */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <CostEvolutionChart historialMensual={historialMensual} />
                  <ExpenseTrendChart historialGastos={historialGastos} />
                </div>

                {/* Financial Summary — replaces MarginErosionChart */}
                <MarginErosionChart productosDetalle={productosFiltrados} />
              </>
            )}
          </>
        )}

        {/* Tab: Catalogo de Costos */}
        {tabActiva === 'catalogo' && (
          <>
            {/* Vista info banner */}
            <div className={`text-xs px-3 py-2 rounded-lg border ${
              vistaCosto === 'contable'
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              {vistaCosto === 'contable'
                ? '📊 Vista Contable: CTRU histórico por lote. Gastos Administrativos y Operativos solo entre unidades vendidas. Para P&L y estados financieros.'
                : '💼 Vista Gerencial: CTRU con Gastos Administrativos y Operativos entre todas las unidades. Para cotizar y fijar precios con costo más realista.'}
            </div>
            <ProductoCTRUTable
              productos={productosFiltrados}
              onSelectProducto={setProductoSeleccionado}
              vistaCosto={vistaCosto}
            />
          </>
        )}

        {/* Tab: Por Lote/OC */}
        {tabActiva === 'lote' && (
          <LoteOCTable lotes={lotesOC} />
        )}
      </div>

      {/* Product Detail Modal */}
      {productoSeleccionado && (
        <ProductoCTRUDetail
          producto={productoSeleccionado}
          onClose={() => setProductoSeleccionado(null)}
        />
      )}
    </div>
  );
};
