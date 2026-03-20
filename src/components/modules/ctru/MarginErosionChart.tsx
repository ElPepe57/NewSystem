import React, { useMemo } from 'react';
import { Layers, Calculator, DollarSign, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../common/Charts';
import type { CTRUProductoDetalle } from '../../../store/ctruStore';

interface ResumenFinancieroProps {
  productosDetalle: CTRUProductoDetalle[];
}

/**
 * Resumen Financiero — replaces MarginErosionChart
 * Shows 4 key financial metrics in a 2x2 grid
 */
export const MarginErosionChart: React.FC<ResumenFinancieroProps> = ({ productosDetalle }) => {
  const metricas = useMemo(() => {
    if (productosDetalle.length === 0) {
      return { costoInventario: 0, ctru: 0, costoTotal: 0, utilidadProm: 0, hasVentas: false };
    }

    let totalUnidades = 0;
    let sumInventario = 0;
    let sumCTRU = 0;
    let sumCostoTotal = 0;
    let totalVentas = 0;
    let sumUtilidad = 0;

    for (const p of productosDetalle) {
      totalUnidades += p.totalUnidades;
      sumInventario += p.costoInventarioProm * p.totalUnidades;
      sumCTRU += p.ctruPromedio * p.totalUnidades;
      sumCostoTotal += p.costoTotalRealProm * p.totalUnidades;
      if (p.ventasCount > 0) {
        totalVentas += p.ventasCount;
        sumUtilidad += (p.precioVentaProm - p.costoTotalRealProm) * p.ventasCount;
      }
    }

    return {
      costoInventario: totalUnidades > 0 ? sumInventario / totalUnidades : 0,
      ctru: totalUnidades > 0 ? sumCTRU / totalUnidades : 0,
      costoTotal: totalUnidades > 0 ? sumCostoTotal / totalUnidades : 0,
      utilidadProm: totalVentas > 0 ? sumUtilidad / totalVentas : 0,
      hasVentas: totalVentas > 0
    };
  }, [productosDetalle]);

  const items = [
    {
      label: 'Costo Inventario Prom',
      sublabel: 'Capas 1-5: Compra + OC + Flete',
      value: formatCurrency(metricas.costoInventario),
      icon: <Layers className="w-4 h-4 text-blue-500" />,
      bg: 'bg-blue-50',
      valueColor: 'text-blue-700'
    },
    {
      label: 'CTRU Promedio',
      sublabel: 'Capas 1-6: + GA/GO prorrateado',
      value: formatCurrency(metricas.ctru),
      icon: <Calculator className="w-4 h-4 text-purple-500" />,
      bg: 'bg-purple-50',
      valueColor: 'text-purple-700'
    },
    {
      label: 'Costo Total Real Prom',
      sublabel: 'Capas 1-7: + GV/GD por venta',
      value: formatCurrency(metricas.costoTotal),
      icon: <DollarSign className="w-4 h-4 text-gray-500" />,
      bg: 'bg-gray-50',
      valueColor: 'text-gray-700'
    },
    {
      label: 'Utilidad Prom / Venta',
      sublabel: metricas.hasVentas ? 'Precio venta - costo total real' : 'Sin ventas registradas',
      value: metricas.hasVentas ? formatCurrency(metricas.utilidadProm) : '—',
      icon: <TrendingUp className={`w-4 h-4 ${metricas.utilidadProm >= 0 ? 'text-green-500' : 'text-red-500'}`} />,
      bg: metricas.utilidadProm >= 0 ? 'bg-green-50' : 'bg-red-50',
      valueColor: metricas.utilidadProm >= 0 ? 'text-green-700' : 'text-red-700'
    }
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
      <h3 className="text-base font-semibold text-gray-900 mb-0.5">Resumen Financiero</h3>
      <p className="text-xs text-gray-400 mb-4">Promedios ponderados por unidad</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item) => (
          <div key={item.label} className={`${item.bg} rounded-lg p-3`}>
            <div className="flex items-center gap-1.5 mb-2">
              {item.icon}
              <span className="text-[11px] font-medium text-gray-500 leading-tight">{item.label}</span>
            </div>
            <div className={`text-lg sm:text-xl font-bold ${item.valueColor}`}>
              {item.value}
            </div>
            <div className="text-[10px] text-gray-400 mt-1 leading-snug">
              {item.sublabel}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
