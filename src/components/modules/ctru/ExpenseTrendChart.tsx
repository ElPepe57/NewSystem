import React from 'react';
import { Receipt } from 'lucide-react';
import { Card } from '../../common';
import { MultiBarChart, formatCurrency, CHART_COLORS } from '../../common/Charts';
import type { HistorialGastosEntry } from '../../../store/ctruStore';

interface ExpenseTrendChartProps {
  historialGastos: HistorialGastosEntry[];
}

export const ExpenseTrendChart: React.FC<ExpenseTrendChartProps> = ({ historialGastos }) => {
  const hasData = historialGastos.some(h => h.total > 0);

  const chartData = historialGastos.map(h => ({
    name: h.label,
    GA: Math.round(h.GA * 100) / 100,
    GO: Math.round(h.GO * 100) / 100,
    GV: Math.round(h.GV * 100) / 100,
    GD: Math.round(h.GD * 100) / 100
  }));

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Gastos por Categoria y Mes</h3>
      <p className="text-xs text-gray-500 mb-4">
        GA/GO impactan CTRU | GV/GD impactan margen de venta
      </p>
      {hasData ? (
        <MultiBarChart
          data={chartData}
          bars={[
            { dataKey: 'GA', color: CHART_COLORS.warning, name: 'Administrativos (GA)' },
            { dataKey: 'GO', color: CHART_COLORS.success, name: 'Operativos (GO)' },
            { dataKey: 'GV', color: CHART_COLORS.secondary, name: 'Venta (GV)' },
            { dataKey: 'GD', color: CHART_COLORS.info, name: 'Distribucion (GD)' }
          ]}
          stacked
          formatValue={formatCurrency}
          height={260}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-[260px] text-gray-400">
          <Receipt className="w-10 h-10 mb-2" />
          <p className="text-sm">No hay gastos registrados</p>
        </div>
      )}
    </Card>
  );
};
