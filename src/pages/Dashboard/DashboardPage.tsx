import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { DashboardSkeleton, GradientHeader, LineaFiltroActivoBanner } from '../../components/common';
import { LineaFilterInline } from '../../components/common/LineaFilterInline';
import { ErrorTesoreriaBanner } from '../../components/modules/dashboard/ErrorTesoreriaBanner';
import { useDashboardData } from './useDashboardData';
import { ExecutiveSummarySection } from './sections/ExecutiveSummarySection';
import { AnalyticsSection } from './sections/AnalyticsSection';
import { AlertsSection } from './sections/AlertsSection';

export const DashboardPage: React.FC = () => {
  const data = useDashboardData();

  if (data.loading) {
    return <DashboardSkeleton />;
  }

  const cxcVencidos = data.dashboardCxPCxC?.cuentasPorCobrar.cantidadVencidos ?? 0;

  return (
    <div className="space-y-6">
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

      {/* Filtro de linea */}
      <div className="flex-1 min-w-0">
        <LineaFilterInline />
      </div>

      {/* Zona 1 — Executive Summary Card */}
      <ExecutiveSummarySection
        totalVentasMes={data.totalVentasMes}
        utilidadMes={data.utilidadMes}
        margenPromedioMes={data.margenPromedioMes}
        cantidadVentasMes={data.cantidadVentasMes}
        crecimientoVentas={data.crecimientoVentas}
        crecimientoUtilidad={data.crecimientoUtilidad}
        cambioMargen={data.cambioMargen}
        totalVentasMesAnterior={data.totalVentasMesAnterior}
        gastosMes={data.gastosMes}
        gastosMesAnterior={data.gastosMesAnterior}
        crecimientoGastos={data.crecimientoGastos}
        ratioGastosVentas={data.ratioGastosVentas}
        metaMensual={data.metaMensual}
        progresoMeta={data.progresoMeta}
        promedioDiarioNecesario={data.promedioDiarioNecesario}
        diasRestantesMes={data.diasRestantesMes}
        resumenTexto={data.resumenTexto}
        stockCritico={data.stockCritico}
        cxcVencidos={cxcVencidos}
      />

      {/* Zona 2 — Tendencia + contexto lateral */}
      <AnalyticsSection
        ventasUltimos30Dias={data.ventasUltimos30Dias}
        topProductosVendidos={data.topProductosVendidos}
        tipoCambioDelDia={data.tipoCambioDelDia}
      />

      {/* Zona 3 — Alertas (solo si existen) */}
      <AlertsSection
        dashboardCxPCxC={data.dashboardCxPCxC}
        stockCriticoItems={data.stockCriticoItems}
      />
    </div>
  );
};
