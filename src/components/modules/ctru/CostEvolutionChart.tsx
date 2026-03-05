import React from 'react';
import { TrendingUp } from 'lucide-react';
import { Card } from '../../common';
import { MultiLineChart, formatCurrency, CHART_COLORS } from '../../common/Charts';
import type { HistorialCostosMes } from '../../../store/ctruStore';

interface CostEvolutionChartProps {
  historialMensual: HistorialCostosMes[];
}

export const CostEvolutionChart: React.FC<CostEvolutionChartProps> = ({ historialMensual }) => {
  const hasData = historialMensual.filter(h => h.costoCompraProm > 0).length >= 2;

  const chartData = historialMensual.map(h => {
    // Group OC additionals into one line to reduce noise
    const adicOC = h.costoImpuestoProm + h.costoEnvioProm + h.costoOtrosProm;
    return {
      name: `${h.label} ${h.anio}`,
      Compra: Math.round(h.costoCompraProm * 100) / 100,
      'Adic. OC': Math.round(adicOC * 100) / 100,
      'Flete Intl': Math.round(h.costoFleteIntlProm * 100) / 100,
      'GA/GO': Math.round(h.gastoGAGOProm * 100) / 100
    };
  });

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Evolucion de Costos por Componente</h3>
      <p className="text-xs text-gray-500 mb-4">Adic. OC = Impuesto + Envio + Otros de la Orden de Compra</p>
      {hasData ? (
        <MultiLineChart
          data={chartData}
          lines={[
            { dataKey: 'Compra', color: CHART_COLORS.primary, name: 'Compra PEN' },
            { dataKey: 'Adic. OC', color: CHART_COLORS.warning, name: 'Adic. OC PEN' },
            { dataKey: 'Flete Intl', color: '#f97316', name: 'Flete Intl PEN' },
            { dataKey: 'GA/GO', color: CHART_COLORS.secondary, name: 'GA/GO PEN' }
          ]}
          formatValue={formatCurrency}
          height={260}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-[260px] text-gray-400">
          <TrendingUp className="w-10 h-10 mb-2" />
          <p className="text-sm">Datos insuficientes para mostrar tendencia</p>
          <p className="text-xs">Se necesitan al menos 2 meses con datos</p>
        </div>
      )}
    </Card>
  );
};
