import React from 'react';
import { Receipt } from 'lucide-react';
import { MultiBarChart, formatCurrency } from '../../common/Charts';
import type { HistorialGastosEntry } from '../../../store/ctruStore';

interface ExpenseTrendChartProps {
  historialGastos: HistorialGastosEntry[];
}

export const ExpenseTrendChart: React.FC<ExpenseTrendChartProps> = ({ historialGastos }) => {
  const hasData = historialGastos.some(h => h.total > 0);

  const chartData = historialGastos.map(h => ({
    name: h.label,
    'GA/GO': Math.round((h.GA + h.GO) * 100) / 100,
    'GV/GD': Math.round((h.GV + h.GD) * 100) / 100
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
      <h3 className="text-base font-semibold text-gray-900 mb-0.5">Gastos Operativos Mensuales</h3>
      <p className="text-xs text-gray-400 mb-4">
        GA/GO impacta CTRU · GV/GD impacta margen de venta
      </p>
      {hasData ? (
        <MultiBarChart
          data={chartData}
          bars={[
            { dataKey: 'GA/GO', color: '#8b5cf6', name: 'GA/GO (Admin + Operativos)' },
            { dataKey: 'GV/GD', color: '#14b8a6', name: 'GV/GD (Venta + Distribucion)' }
          ]}
          stacked
          formatValue={formatCurrency}
          height={240}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-[240px] text-gray-300">
          <Receipt className="w-10 h-10 mb-2" />
          <p className="text-sm text-gray-400">No hay gastos registrados</p>
        </div>
      )}
    </div>
  );
};
