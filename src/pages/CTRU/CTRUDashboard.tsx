import React, { useEffect, useState } from 'react';
import {
  Calculator,
  Package,
  Truck,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import { Card, GradientHeader } from '../../components/common';
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
import type { CTRUProductoDetalle } from '../../store/ctruStore';

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

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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

  const tabs: Array<{ id: TabActiva; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'resumen', label: 'Resumen', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'catalogo', label: 'Catalogo de Costos', icon: <Package className="w-4 h-4" />, badge: productosDetalle.length },
    { id: 'lote', label: 'Por Lote/OC', icon: <Truck className="w-4 h-4" />, badge: lotesOC.length }
  ];

  return (
    <div className="space-y-0">
      {/* Header */}
      <GradientHeader
        title="CTRU - Costo Total Real por Unidad"
        subtitle="Analisis completo de costos, margenes y pricing por producto"
        icon={Calculator}
        variant="blue"
      />

      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTabActiva(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tabActiva === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.icon}
                {tab.label}
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
          {resumen && (
            <div className="text-xs text-gray-500">
              {resumen.totalProductos} productos · {resumen.totalProductosActivos} en inventario · {resumen.totalUnidadesActivas + resumen.totalUnidadesVendidas} unidades
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      <div className="max-w-7xl mx-auto px-6 pt-6 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 pb-8 space-y-6">
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
            {/* KPIs */}
            <CTRUKPIGrid resumen={resumen} />

            {resumen.totalProductos > 0 && (
              <>
                {/* Charts row 1: Cost Evolution + Margin Erosion */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <CostEvolutionChart historialMensual={historialMensual} />
                  <MarginErosionChart historialMensual={historialMensual} />
                </div>

                {/* Full width: Cost Composition */}
                <CostCompositionChart productos={productosDetalle} />

                {/* Full width: Expense Trend */}
                <ExpenseTrendChart historialGastos={historialGastos} />
              </>
            )}
          </>
        )}

        {/* Tab: Catalogo de Costos */}
        {tabActiva === 'catalogo' && (
          <ProductoCTRUTable
            productos={productosDetalle}
            onSelectProducto={setProductoSeleccionado}
          />
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
