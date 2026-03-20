import React from 'react';
import { formatCurrency } from '../../common/Charts';
import type { CTRUProductoDetalle } from '../../../store/ctruStore';

interface CostCompositionChartProps {
  productos: CTRUProductoDetalle[];
}

export const CostCompositionChart: React.FC<CostCompositionChartProps> = ({ productos }) => {
  // Calculate weighted average across all products
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
  const adicOCProm = totalUnidades > 0 ? (sumImpuesto + sumEnvio + sumOtros) / totalUnidades : 0;
  const fleteIntlProm = totalUnidades > 0 ? sumFleteIntl / totalUnidades : 0;
  const gagoProm = totalUnidades > 0 ? sumGAGO / totalUnidades : 0;
  const gvgdProm = totalUnidades > 0 ? sumGVGD / totalUnidades : 0;
  const costoTotal = compraProm + adicOCProm + fleteIntlProm + gagoProm + gvgdProm;
  const precioVentaProm = ventasUnidades > 0 ? sumPrecioVenta / ventasUnidades : 0;
  const margen = precioVentaProm > 0 ? precioVentaProm - costoTotal : 0;
  const margenPct = precioVentaProm > 0 ? (margen / precioVentaProm) * 100 : 0;

  const pct = (v: number) => costoTotal > 0 ? (v / costoTotal) * 100 : 0;

  const segments = [
    { label: 'Compra', value: compraProm, pct: pct(compraProm), color: 'bg-blue-500', dotColor: 'bg-blue-500', textColor: 'text-blue-700' },
    { label: 'Adic. OC', value: adicOCProm, pct: pct(adicOCProm), color: 'bg-amber-400', dotColor: 'bg-amber-400', textColor: 'text-amber-700' },
    { label: 'Flete Intl', value: fleteIntlProm, pct: pct(fleteIntlProm), color: 'bg-orange-500', dotColor: 'bg-orange-500', textColor: 'text-orange-700' },
    { label: 'GA/GO', value: gagoProm, pct: pct(gagoProm), color: 'bg-purple-500', dotColor: 'bg-purple-500', textColor: 'text-purple-700' },
    { label: 'GV/GD', value: gvgdProm, pct: pct(gvgdProm), color: 'bg-cyan-500', dotColor: 'bg-cyan-500', textColor: 'text-cyan-700' }
  ].filter(s => s.value > 0.01);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
      <h3 className="text-base font-semibold text-gray-900 mb-0.5">Composicion del Costo por Unidad</h3>
      <p className="text-xs text-gray-400 mb-4">Promedio ponderado de {totalUnidades} unidades</p>

      {/* Horizontal stacked bar */}
      <div className="flex h-8 rounded-xl overflow-hidden mb-3">
        {segments.map((seg, i) => (
          <div
            key={seg.label}
            className={`${seg.color} relative group transition-all hover:brightness-110`}
            style={{ width: `${seg.pct}%` }}
            title={`${seg.label}: ${formatCurrency(seg.value)} (${seg.pct.toFixed(1)}%)`}
          >
            {seg.pct > 10 && (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">
                {seg.pct.toFixed(0)}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Legend items */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 text-xs">
            <div className={`w-2.5 h-2.5 rounded-full ${seg.dotColor} flex-shrink-0`} />
            <span className="text-gray-500">{seg.label}</span>
            <span className={`font-semibold ${seg.textColor}`}>{formatCurrency(seg.value)}</span>
            <span className="text-gray-300">({seg.pct.toFixed(1)}%)</span>
          </div>
        ))}
      </div>

      {/* Summary row */}
      <div className="border-t border-gray-100 pt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <span className="text-xs text-gray-400">Costo Total</span>
          <div className="text-base font-bold text-gray-900">{formatCurrency(costoTotal)}</div>
        </div>
        {precioVentaProm > 0 && (
          <>
            <div>
              <span className="text-xs text-gray-400">Precio Venta Prom</span>
              <div className="text-base font-semibold text-gray-700">{formatCurrency(precioVentaProm)}</div>
            </div>
            <div>
              <span className="text-xs text-gray-400">Margen</span>
              <div className={`text-base font-bold ${margenPct >= 20 ? 'text-green-600' : margenPct >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                {formatCurrency(margen)} ({margenPct.toFixed(1)}%)
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
