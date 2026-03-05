import React from 'react';
import { DollarSign, Calculator, TrendingUp } from 'lucide-react';
import { Card } from '../../common';
import { MiniChart, formatCurrency, CHART_COLORS } from '../../common/Charts';
import type { CTRUResumenV2 } from '../../../store/ctruStore';

interface CTRUKPIGridProps {
  resumen: CTRUResumenV2;
}

export const CTRUKPIGrid: React.FC<CTRUKPIGridProps> = ({ resumen }) => {
  const formatUSD = (v: number) => `$ ${v.toFixed(2)}`;

  const kpis = [
    {
      label: 'Costo Compra Promedio',
      value: formatUSD(resumen.costoCompraPromedioUSD),
      subtitle: `${resumen.totalUnidadesActivas} activas · ${resumen.totalUnidadesVendidas} vendidas`,
      icon: <DollarSign className="w-5 h-5 text-blue-600" />,
      trend: resumen.tendenciaCostoCompra,
      color: CHART_COLORS.primary,
      bg: 'bg-blue-50', border: 'border-blue-200'
    },
    {
      label: 'CTRU Promedio',
      value: formatCurrency(resumen.ctruPromedioPEN),
      subtitle: `${resumen.totalProductos} productos`,
      icon: <Calculator className="w-5 h-5 text-purple-600" />,
      trend: resumen.tendenciaCTRU,
      color: CHART_COLORS.secondary,
      bg: 'bg-purple-50', border: 'border-purple-200'
    },
    {
      label: 'Margen Promedio',
      value: resumen.totalVentasAnalizadas > 0 ? `${resumen.margenPromedioPercent.toFixed(1)}%` : '- -',
      subtitle: resumen.totalVentasAnalizadas > 0
        ? `${resumen.totalVentasAnalizadas} ventas analizadas`
        : 'Sin ventas registradas',
      icon: <TrendingUp className="w-5 h-5 text-green-600" />,
      trend: resumen.tendenciaMargen,
      color: CHART_COLORS.success,
      bg: 'bg-green-50', border: 'border-green-200'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className={`${kpi.bg} border ${kpi.border}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {kpi.icon}
              <span className="text-xs font-medium text-gray-600">{kpi.label}</span>
            </div>
            {kpi.trend.filter(v => v > 0).length >= 2 && (
              <MiniChart data={kpi.trend} type="area" color={kpi.color} width={70} height={28} />
            )}
          </div>
          <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
          <div className="text-xs text-gray-500 mt-1">{kpi.subtitle}</div>
        </Card>
      ))}
    </div>
  );
};
