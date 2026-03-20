import React, { useMemo } from 'react';
import type { CTRUResumenV2, CTRUProductoDetalle } from '../../../store/ctruStore';

interface CTRUKPIGridProps {
  resumen: CTRUResumenV2;
  productosDetalle: CTRUProductoDetalle[];
}

export const CTRUKPIGrid: React.FC<CTRUKPIGridProps> = ({ resumen, productosDetalle }) => {
  const { precioVentaProm, utilidadProm } = useMemo(() => {
    const conVentas = productosDetalle.filter(p => p.ventasCount > 0);
    if (conVentas.length === 0) return { precioVentaProm: 0, utilidadProm: 0 };

    let totalVentas = 0;
    let sumPrecio = 0;
    let sumUtilidad = 0;
    for (const p of conVentas) {
      totalVentas += p.ventasCount;
      sumPrecio += p.precioVentaProm * p.ventasCount;
      sumUtilidad += (p.precioVentaProm - p.costoTotalRealProm) * p.ventasCount;
    }
    return {
      precioVentaProm: totalVentas > 0 ? sumPrecio / totalVentas : 0,
      utilidadProm: totalVentas > 0 ? sumUtilidad / totalVentas : 0
    };
  }, [productosDetalle]);

  const fleteIntlProm = useMemo(() => {
    if (productosDetalle.length === 0) return 0;
    let sum = 0;
    let count = 0;
    for (const p of productosDetalle) {
      if (p.costoFleteIntlPENProm > 0) {
        sum += p.costoFleteIntlPENProm * p.totalUnidades;
        count += p.totalUnidades;
      }
    }
    return count > 0 ? sum / count : 0;
  }, [productosDetalle]);

  const formatPEN = (v: number) => `S/ ${v.toFixed(2)}`;

  const kpis = [
    {
      label: 'Unidades',
      value: `${resumen.totalUnidadesActivas}`,
      valueSuffix: ' activas',
      detail: `${resumen.totalUnidadesVendidas} vendidas · ${resumen.totalUnidadesActivas + resumen.totalUnidadesVendidas} total`,
      borderColor: 'border-blue-500',
      valueColor: 'text-blue-700'
    },
    {
      label: 'CTRU Promedio',
      value: formatPEN(resumen.ctruPromedioPEN),
      detail: `Compra $${resumen.costoCompraPromedioUSD.toFixed(2)} · Flete ${formatPEN(fleteIntlProm)}`,
      borderColor: 'border-purple-500',
      valueColor: 'text-purple-700'
    },
    {
      label: 'Margen Promedio',
      value: resumen.totalVentasAnalizadas > 0 ? `${resumen.margenPromedioPercent.toFixed(1)}%` : '—',
      detail: resumen.totalVentasAnalizadas > 0
        ? `${formatPEN(utilidadProm)} utilidad prom`
        : 'Sin ventas registradas',
      borderColor: resumen.margenPromedioPercent >= 20 ? 'border-green-500' : resumen.margenPromedioPercent >= 10 ? 'border-amber-500' : 'border-red-500',
      valueColor: resumen.margenPromedioPercent >= 20 ? 'text-green-700' : resumen.margenPromedioPercent >= 10 ? 'text-amber-700' : 'text-red-700'
    },
    {
      label: 'Precio Venta Prom',
      value: resumen.totalVentasAnalizadas > 0 ? formatPEN(precioVentaProm) : '—',
      detail: resumen.totalVentasAnalizadas > 0
        ? `${resumen.totalVentasAnalizadas} ventas analizadas`
        : 'Sin ventas registradas',
      borderColor: 'border-amber-500',
      valueColor: 'text-amber-700'
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className={`bg-white rounded-xl border border-gray-100 shadow-sm ${kpi.borderColor} border-l-4 p-3 sm:p-4`}
        >
          <div className="text-[11px] uppercase tracking-wide text-gray-400 font-medium mb-1">
            {kpi.label}
          </div>
          <div className={`text-xl sm:text-2xl font-bold ${kpi.valueColor} leading-tight`}>
            {kpi.value}
            {kpi.valueSuffix && (
              <span className="text-sm font-medium text-gray-500">{kpi.valueSuffix}</span>
            )}
          </div>
          <div className="text-[11px] text-gray-400 mt-1.5 leading-snug">
            {kpi.detail}
          </div>
        </div>
      ))}
    </div>
  );
};
