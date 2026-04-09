import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { DashboardSkeleton, GradientHeader, LineaFiltroActivoBanner } from '../../components/common';
import { LineaFilterInline } from '../../components/common/LineaFilterInline';
import { ErrorTesoreriaBanner } from '../../components/modules/dashboard/ErrorTesoreriaBanner';
import { UsuariosActivosWidget } from '../../components/modules/dashboard';
import { useDashboardData } from './useDashboardData';
import { HeroKPISection } from './sections/HeroKPISection';
import { AnalyticsSection } from './sections/AnalyticsSection';
import { AlertsSection } from './sections/AlertsSection';

export const DashboardPage: React.FC = () => {
  const data = useDashboardData();

  if (data.loading) {
    return <DashboardSkeleton />;
  }

  const tcCompra = data.tipoCambioDelDia?.compra?.toFixed(3);
  const tcVenta = data.tipoCambioDelDia?.venta?.toFixed(3);

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <GradientHeader
        title="Dashboard"
        subtitle={new Date().toLocaleDateString('es-PE', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}
        icon={LayoutDashboard}
        variant="dark"
      />

      {/* Banners de estado */}
      <ErrorTesoreriaBanner />
      <LineaFiltroActivoBanner onClear={() => data.setLineaFiltroGlobal(null)} />

      {/* Filtro de linea + TC del dia */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <LineaFilterInline />
        </div>
        {tcCompra && (
          <span className="inline-flex items-center text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full flex-shrink-0 font-medium">
            TC: S/ {tcCompra} / {tcVenta}
          </span>
        )}
      </div>

      {/* Zona 1 — 4 KPIs hero */}
      <HeroKPISection
        totalVentasMes={data.totalVentasMes}
        utilidadMes={data.utilidadMes}
        margenPromedio={data.margenPromedioMes}
        cantidadVentas={data.cantidadVentasMes}
        dashboardCxPCxC={data.dashboardCxPCxC}
        stockCritico={data.stockCritico}
      />

      {/* Zona 2 — Tendencia + Top 5 productos */}
      <AnalyticsSection
        ventasUltimos30Dias={data.ventasUltimos30Dias}
        topProductosVendidos={data.topProductosVendidos}
      />

      {/* Zona 3 — Alertas criticas */}
      <AlertsSection
        dashboardCxPCxC={data.dashboardCxPCxC}
        stockCriticoItems={data.stockCriticoItems}
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
