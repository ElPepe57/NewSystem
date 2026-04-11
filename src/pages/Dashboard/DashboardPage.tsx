import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { PageShell, PageHeader } from '../../design-system';
import { DashboardSkeleton, LineaFiltroActivoBanner } from '../../components/common';
import { LineaFilterInline } from '../../components/common/LineaFilterInline';
import { ErrorTesoreriaBanner } from '../../components/modules/dashboard/ErrorTesoreriaBanner';
import { useDashboardData } from './useDashboardData';
import { ExecutiveSummarySection } from './sections/ExecutiveSummarySection';
import { CashLiquidezSection } from './sections/CashLiquidezSection';
import { InsightsSection } from './sections/InsightsSection';
import { DeepAnalyticsSection } from './sections/DeepAnalyticsSection';
import { RentabilidadTresNivelesWidget } from '../../components/modules/dashboard/RentabilidadTresNivelesWidget';
import { DiferencialCambiarioWidget } from '../../components/modules/dashboard/DiferencialCambiarioWidget';

export const DashboardPage: React.FC = () => {
  const data = useDashboardData();

  if (data.loading) {
    return <DashboardSkeleton />;
  }

  const cxcVencidos = data.dashboardCxPCxC?.cuentasPorCobrar.cantidadVencidos ?? 0;

  return (
    <PageShell>
      {/* Header */}
      <PageHeader
        title="Dashboard"
        subtitle={new Date().toLocaleDateString('es-PE', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}
        icon={LayoutDashboard}
      />

      {/* Banners de estado */}
      <ErrorTesoreriaBanner />
      <LineaFiltroActivoBanner onClear={() => data.setLineaFiltroGlobal(null)} />

      {/* Filtro de linea */}
      <LineaFilterInline />

      {/* Zona 1 — Executive Pulse */}
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
        proyeccionVentasFinMes={data.proyeccionVentasFinMes}
        proyeccionVsMeta={data.proyeccionVsMeta}
        resumenTexto={data.resumenTexto}
        stockCritico={data.stockCritico}
        cxcVencidos={cxcVencidos}
        sparklineVentas={data.sparklineVentas}
        sparklineUtilidad={data.sparklineUtilidad}
        sparklineGastos={data.sparklineGastos}
        sparklineMargen={data.sparklineMargen}
        healthIndicators={data.healthIndicators}
      />

      {/* Zona 2 — Cash & Liquidez */}
      <CashLiquidezSection
        saldoCajaTotal={data.saldoCajaTotal}
        gastoMensualPromedio={data.gastoMensualPromedio}
        cashRunwayMeses={data.cashRunwayMeses}
        valorInventarioPEN={data.valorInventarioPEN}
        workingCapital={data.workingCapital}
        dashboardCxPCxC={data.dashboardCxPCxC}
        ventasDualLinea={data.ventasDualLinea}
        lineaFiltroGlobal={data.lineaFiltroGlobal}
        tipoCambioDelDia={data.tipoCambioDelDia}
      />

      {/* Zona 3 — Rentabilidad + FX */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RentabilidadTresNivelesWidget />
        <DiferencialCambiarioWidget />
      </div>

      {/* Zona 4 — Insights proactivos */}
      <InsightsSection insights={data.insights} />

      {/* Zona 5 — Profundidad */}
      <DeepAnalyticsSection
        topProductosVendidos={data.topProductosVendidos}
        rentabilidadSUP={data.rentabilidadSUP}
        rentabilidadSKC={data.rentabilidadSKC}
        lineaFiltroGlobal={data.lineaFiltroGlobal}
      />
    </PageShell>
  );
};
