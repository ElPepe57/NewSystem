import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { DashboardSkeleton, GradientHeader, LineaFiltroActivoBanner } from '../../components/common';
import { LineaFilterInline } from '../../components/common/LineaFilterInline';
import { ErrorTesoreriaBanner } from '../../components/modules/dashboard/ErrorTesoreriaBanner';
import { UsuariosActivosWidget } from '../../components/modules/dashboard';
import { useDashboardData } from './useDashboardData';
import { HeroKPISection } from './sections/HeroKPISection';
import { FinancialSection } from './sections/FinancialSection';
import { InventorySection } from './sections/InventorySection';
import { OperationalSection } from './sections/OperationalSection';
import { ROISection } from './sections/ROISection';
import { AnalyticsSection } from './sections/AnalyticsSection';
import { AlertsSection } from './sections/AlertsSection';

export const DashboardPage: React.FC = () => {
  const data = useDashboardData();

  if (data.loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header ejecutivo */}
      <GradientHeader
        title="Dashboard Ejecutivo"
        subtitle={`Resumen operativo y financiero — ${new Date().toLocaleDateString('es-PE', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}`}
        icon={LayoutDashboard}
        variant="dark"
      />

      {/* Banners de estado */}
      <ErrorTesoreriaBanner />
      <LineaFiltroActivoBanner onClear={() => data.setLineaFiltroGlobal(null)} />
      <LineaFilterInline />

      {/* 1. Hero KPIs: ventas, utilidad, margen, TC */}
      <HeroKPISection
        totalVentasMes={data.totalVentasMes}
        utilidadMes={data.utilidadMes}
        margenPromedioMes={data.margenPromedioMes}
        ventasMesCount={data.ventasMesActual.length}
        tipoCambioDelDia={data.tipoCambioDelDia}
      />

      {/* 2. Inventario: valor, stock crítico, distribución */}
      <InventorySection
        valorInventarioPEN={data.valorInventarioPEN}
        stockCritico={data.stockCritico}
        productosActivos={data.productosActivos}
        totalProductos={data.productos.length}
        distribucionInventario={data.distribucionInventario}
        resumenInventario={data.resumenInventario}
        tipoCambioDelDia={data.tipoCambioDelDia}
        inventario={data.inventario}
        productos={data.productos}
      />

      {/* 3. ROI: métricas de inversión e investigación de mercado */}
      <ROISection metricsROI={data.metricsROI} />

      {/* 4. Financiero: CxC/CxP (solo si hay datos) */}
      {data.dashboardCxPCxC && (
        <FinancialSection dashboardCxPCxC={data.dashboardCxPCxC} />
      )}

      {/* 5. Operacional: OCs, gastos, anticipos, eficiencia importacion */}
      <OperationalSection
        ordenesEnProceso={data.ordenesEnProceso}
        ordenesStats={data.ordenesStats}
        gastosStats={data.gastosStats}
        anticiposPendientes={data.anticiposPendientes}
      />

      {/* 6. Analytics: gráficos tendencia, canales, top productos, mapa */}
      <AnalyticsSection
        ventasUltimos30Dias={data.ventasUltimos30Dias}
        topProductosVendidos={data.topProductosVendidos}
        ventasPorCanalPie={data.ventasPorCanalPie}
      />

      {/* 7. Alertas: financieras, últimas ventas, vencimientos, actividad */}
      <AlertsSection
        dashboardCxPCxC={data.dashboardCxPCxC}
        ventas={data.ventas}
        actividadReciente={data.actividadReciente}
      />

      {/* Widget de usuarios (solo admin) */}
      {data.isAdmin && (
        <div className="grid grid-cols-1 gap-6">
          <UsuariosActivosWidget showDetailed={true} />
        </div>
      )}
    </div>
  );
};
