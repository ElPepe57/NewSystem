import React from 'react';
import { Card } from '../../common';
import { DonutChart, formatCurrency, CHART_COLORS } from '../../common/Charts';
import type { PieChartData } from '../../common/Charts';
import type { CTRUProductoDetalle } from '../../../store/ctruStore';

interface CostCompositionChartProps {
  productos: CTRUProductoDetalle[];
}

export const CostCompositionChart: React.FC<CostCompositionChartProps> = ({ productos }) => {
  // Calculate weighted average across all products (weighted by units)
  let totalUnidades = 0;
  let sumCompra = 0;
  let sumImpuesto = 0;
  let sumEnvio = 0;
  let sumOtros = 0;
  let sumFleteIntl = 0;
  let sumGAGO = 0;
  let sumGVGD = 0;
  let sumPrecioVenta = 0;
  let ventasUnidades = 0;

  for (const p of productos) {
    totalUnidades += p.totalUnidades;
    sumCompra += p.costoCompraPENProm * p.totalUnidades;
    sumImpuesto += p.costoImpuestoPENProm * p.totalUnidades;
    sumEnvio += p.costoEnvioPENProm * p.totalUnidades;
    sumOtros += p.costoOtrosPENProm * p.totalUnidades;
    sumFleteIntl += p.costoFleteIntlPENProm * p.totalUnidades;
    sumGAGO += p.gastoGAGOProm * p.totalUnidades;
    sumGVGD += p.gastoGVGDProm * p.totalUnidades;
    if (p.ventasCount > 0) {
      sumPrecioVenta += p.precioVentaProm * p.totalUnidades;
      ventasUnidades += p.totalUnidades;
    }
  }

  const compraProm = totalUnidades > 0 ? sumCompra / totalUnidades : 0;
  const impuestoProm = totalUnidades > 0 ? sumImpuesto / totalUnidades : 0;
  const envioProm = totalUnidades > 0 ? sumEnvio / totalUnidades : 0;
  const otrosProm = totalUnidades > 0 ? sumOtros / totalUnidades : 0;
  const fleteIntlProm = totalUnidades > 0 ? sumFleteIntl / totalUnidades : 0;
  const gagoProm = totalUnidades > 0 ? sumGAGO / totalUnidades : 0;
  const gvgdProm = totalUnidades > 0 ? sumGVGD / totalUnidades : 0;
  const costoTotal = compraProm + impuestoProm + envioProm + otrosProm + fleteIntlProm + gagoProm + gvgdProm;
  const precioVentaProm = ventasUnidades > 0 ? sumPrecioVenta / ventasUnidades : 0;
  const margen = precioVentaProm > 0 ? precioVentaProm - costoTotal : 0;
  const margenPct = precioVentaProm > 0 ? (margen / precioVentaProm) * 100 : 0;

  const pct = (v: number) => costoTotal > 0 ? ((v / costoTotal) * 100).toFixed(1) : '0.0';

  // Group OC additionals for donut to avoid clutter
  const adicOCProm = impuestoProm + envioProm + otrosProm;

  const data: PieChartData[] = [
    { name: 'Compra', value: compraProm, color: CHART_COLORS.primary },
    { name: 'Adic. OC', value: adicOCProm, color: CHART_COLORS.warning },
    { name: 'Flete Intl', value: fleteIntlProm, color: '#f97316' },
    { name: 'GA/GO', value: gagoProm, color: CHART_COLORS.secondary },
    { name: 'GV/GD', value: gvgdProm, color: CHART_COLORS.info }
  ].filter(d => d.value > 0);

  const layers = [
    { label: 'Compra', value: compraProm, pct: pct(compraProm), color: 'bg-blue-600', bg: 'bg-blue-50' },
    { label: 'Impuesto', value: impuestoProm, pct: pct(impuestoProm), color: 'bg-red-500', bg: 'bg-red-50', sub: true },
    { label: 'Envio OC', value: envioProm, pct: pct(envioProm), color: 'bg-amber-500', bg: 'bg-amber-50', sub: true },
    { label: 'Otros OC', value: otrosProm, pct: pct(otrosProm), color: 'bg-gray-500', bg: 'bg-gray-50', sub: true },
    { label: 'Flete Intl', value: fleteIntlProm, pct: pct(fleteIntlProm), color: 'bg-orange-500', bg: 'bg-orange-50' },
    { label: 'GA/GO', value: gagoProm, pct: pct(gagoProm), color: 'bg-purple-600', bg: 'bg-purple-50' },
    { label: 'GV/GD', value: gvgdProm, pct: pct(gvgdProm), color: 'bg-cyan-600', bg: 'bg-cyan-50' }
  ];

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Composicion del Costo por Unidad</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <DonutChart
            data={data}
            height={220}
            formatValue={formatCurrency}
            centerLabel={formatCurrency(costoTotal)}
          />
        </div>
        <div className="flex flex-col justify-center space-y-1.5">
          {layers.map((layer) => (
            <div
              key={layer.label}
              className={`flex items-center justify-between p-2 ${layer.bg} rounded-lg ${'sub' in layer ? 'ml-4' : ''}`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${layer.color}`} />
                <span className={`text-sm text-gray-700 ${'sub' in layer ? 'text-xs' : ''}`}>{layer.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">({layer.pct}%)</span>
                <span className={`font-semibold w-24 text-right ${'sub' in layer ? 'text-xs' : 'text-sm'}`}>{formatCurrency(layer.value)}</span>
              </div>
            </div>
          ))}

          <div className="border-t border-gray-200 pt-2 mt-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Costo Total</span>
              <span className="text-base font-bold text-gray-900">{formatCurrency(costoTotal)}</span>
            </div>
            {precioVentaProm > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Precio Venta Prom.</span>
                  <span className="text-sm font-semibold text-gray-700">{formatCurrency(precioVentaProm)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Margen</span>
                  <span className={`text-sm font-bold ${margenPct >= 20 ? 'text-green-600' : margenPct >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                    {formatCurrency(margen)} ({margenPct.toFixed(1)}%)
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
