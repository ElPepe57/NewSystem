import React, { useState } from 'react';
import { Calculator, TrendingUp, ArrowRight, ShoppingCart, DollarSign, BarChart3 } from 'lucide-react';
import { Modal } from '../../common';
import { MultiLineChart, formatCurrency, CHART_COLORS } from '../../common/Charts';
import type { CTRUProductoDetalle } from '../../../store/ctruStore';

interface ProductoCTRUDetailProps {
  producto: CTRUProductoDetalle;
  onClose: () => void;
}

type SubTab = 'costos' | 'compras' | 'ventas';

export const ProductoCTRUDetail: React.FC<ProductoCTRUDetailProps> = ({ producto, onClose }) => {
  const [subTab, setSubTab] = useState<SubTab>('costos');

  const formatUSD = (v: number) => `$ ${v.toFixed(2)}`;
  const p = producto;
  const costoTotal = p.costoTotalRealProm;
  const margenBrutoMonto = p.precioVentaProm > 0 ? p.precioVentaProm - p.ctruPromedio : 0;
  const margenNetoMonto = p.precioVentaProm > 0 ? p.precioVentaProm - costoTotal : 0;

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  };

  const subTabs: Array<{ id: SubTab; label: string; icon: React.ReactNode }> = [
    { id: 'costos', label: 'Costos', icon: <Calculator className="w-3.5 h-3.5" /> },
    { id: 'compras', label: 'Historial Compras', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'ventas', label: `Ventas (${p.ventasCount})`, icon: <ShoppingCart className="w-3.5 h-3.5" /> }
  ];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={producto.productoNombre}
      size="xl"
    >
      <div className="space-y-4">
        {/* Header info */}
        <div className="flex items-center gap-3 pb-3 border-b">
          <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded-lg">{p.productoSKU || '-'}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            p.estadoProducto === 'activo' ? 'bg-green-100 text-green-700' :
            p.estadoProducto === 'vendido' ? 'bg-gray-200 text-gray-600' :
            'bg-blue-100 text-blue-700'
          }`}>
            {p.estadoProducto === 'activo' ? 'En inventario' :
             p.estadoProducto === 'vendido' ? 'Todo vendido' : 'Mixto'}
          </span>
          <span className="text-sm text-gray-500">{p.unidadesActivas} activas / {p.totalUnidades} total</span>
          {p.ventasCount > 0 && (
            <span className="text-sm text-gray-500">| {p.ventasCount} ventas</span>
          )}
        </div>

        {/* Sub-tab navigation */}
        <div className="flex gap-1 border-b">
          {subTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                subTab === tab.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* SUB-TAB: Costos */}
        {subTab === 'costos' && <CostosTab p={p} formatUSD={formatUSD} costoTotal={costoTotal} margenBrutoMonto={margenBrutoMonto} margenNetoMonto={margenNetoMonto} />}

        {/* SUB-TAB: Historial Compras */}
        {subTab === 'compras' && <ComprasTab p={p} formatUSD={formatUSD} formatDate={formatDate} />}

        {/* SUB-TAB: Ventas */}
        {subTab === 'ventas' && <VentasTab p={p} formatDate={formatDate} />}
      </div>
    </Modal>
  );
};

// ============================================
// SUB-TAB: Costos + Pricing
// ============================================

function CostosTab({ p, formatUSD, costoTotal, margenBrutoMonto, margenNetoMonto }: {
  p: CTRUProductoDetalle;
  formatUSD: (v: number) => string;
  costoTotal: number;
  margenBrutoMonto: number;
  margenNetoMonto: number;
}) {
  const layers = [
    {
      label: 'Precio Compra',
      usd: formatUSD(p.costoCompraUSDProm),
      pen: formatCurrency(p.costoCompraPENProm),
      pct: `${p.pctCompra.toFixed(1)}%`,
      color: 'border-l-blue-500',
      bg: 'bg-blue-50'
    },
    {
      label: 'Impuesto (Tax)',
      usd: formatUSD(p.costoImpuestoUSDProm),
      pen: formatCurrency(p.costoImpuestoPENProm),
      pct: `${p.pctImpuesto.toFixed(1)}%`,
      color: 'border-l-red-400',
      bg: 'bg-red-50',
      hidden: p.costoImpuestoUSDProm < 0.001
    },
    {
      label: 'Envio OC',
      usd: formatUSD(p.costoEnvioUSDProm),
      pen: formatCurrency(p.costoEnvioPENProm),
      pct: `${p.pctEnvio.toFixed(1)}%`,
      color: 'border-l-amber-500',
      bg: 'bg-amber-50',
      hidden: p.costoEnvioUSDProm < 0.001
    },
    {
      label: 'Otros OC',
      usd: formatUSD(p.costoOtrosUSDProm),
      pen: formatCurrency(p.costoOtrosPENProm),
      pct: `${p.pctOtros.toFixed(1)}%`,
      color: 'border-l-gray-400',
      bg: 'bg-gray-50',
      hidden: p.costoOtrosUSDProm < 0.001
    },
    {
      label: 'Flete Intl (USA-Peru)',
      usd: p.costoFleteIntlUSDProm > 0 ? formatUSD(p.costoFleteIntlUSDProm) : null,
      pen: formatCurrency(p.costoFleteIntlPENProm),
      pct: `${p.pctFleteIntl.toFixed(1)}%`,
      color: 'border-l-orange-500',
      bg: 'bg-orange-50'
    },
    {
      label: 'GA/GO',
      usd: null,
      pen: p.unidadesVendidas > 0 ? formatCurrency(p.gastoGAGOProm) : formatCurrency(0),
      pct: p.unidadesVendidas > 0 ? `${p.pctGAGO.toFixed(1)}%` : '0%',
      color: 'border-l-purple-500',
      bg: 'bg-purple-50',
      note: p.unidadesVendidas === 0 && p.gastoGAGOEstimado > 0
        ? `Est. proyectado: ${formatCurrency(p.gastoGAGOEstimado)}/ud`
        : p.unidadesVendidas > 0 ? '(solo vendidas)' : undefined
    },
    {
      label: 'GV/GD',
      usd: null,
      pen: p.ventasCount > 0 ? formatCurrency(p.gastoGVGDProm) : '-',
      pct: p.ventasCount > 0 ? `${p.pctGVGD.toFixed(1)}%` : '-',
      color: 'border-l-cyan-500',
      bg: 'bg-cyan-50',
      note: p.ventasCount === 0 ? '(sin ventas)' : undefined
    }
  ];

  const visibleLayers = layers.filter(l => !('hidden' in l && l.hidden));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Cost breakdown */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Calculator className="w-4 h-4" /> Desglose de Costos por Unidad
        </h4>

        <div className="space-y-2">
          {visibleLayers.map((layer) => (
            <div
              key={layer.label}
              className={`flex items-center justify-between p-3 ${layer.bg} rounded-lg border-l-4 ${layer.color}`}
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-700">{layer.label}</span>
                {'note' in layer && layer.note && <span className="text-[10px] text-gray-400">{layer.note}</span>}
              </div>
              <div className="flex items-center gap-3">
                {layer.usd && (
                  <>
                    <span className="text-xs text-gray-500">{layer.usd}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                  </>
                )}
                <span className="text-sm font-semibold text-gray-800 w-24 text-right">{layer.pen}</span>
                <span className="text-xs text-gray-500 w-14 text-right">({layer.pct})</span>
              </div>
            </div>
          ))}

          <div className="border-t-2 border-gray-300 my-2" />

          {/* Costo Inventario */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">= Costo Inventario (Capas 1-5)</span>
            <span className="text-base font-bold text-gray-700">{formatCurrency(p.costoInventarioProm)}</span>
          </div>

          {/* CTRU */}
          <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
            <span className="text-sm font-bold text-gray-800">= CTRU (Capas 1-6)</span>
            <span className="text-lg font-bold text-blue-700">{formatCurrency(p.ctruPromedio)}</span>
          </div>

          {/* Costo Total Real */}
          <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
            <span className="text-sm font-bold text-gray-800">= Costo Total Real</span>
            <span className="text-lg font-bold text-gray-900">{formatCurrency(costoTotal)}</span>
          </div>

          {/* Venta y margen */}
          {p.ventasCount > 0 && (
            <>
              <div className="border-t border-gray-200 my-1" />
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <span className="text-sm text-gray-700">Precio Venta Prom.</span>
                <span className="text-sm font-semibold text-gray-800">{formatCurrency(p.precioVentaProm)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <span className="text-sm text-gray-700">Margen Bruto (sin GV/GD)</span>
                <span className={`text-sm font-bold ${p.margenBrutoProm >= 20 ? 'text-green-600' : p.margenBrutoProm >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                  {formatCurrency(margenBrutoMonto)} ({p.margenBrutoProm.toFixed(1)}%)
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border-2 border-green-200">
                <span className="text-sm font-bold text-gray-800">Margen Neto Real</span>
                <span className={`text-lg font-bold ${p.margenNetoProm >= 20 ? 'text-green-600' : p.margenNetoProm >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                  {formatCurrency(margenNetoMonto)} ({p.margenNetoProm.toFixed(1)}%)
                </span>
              </div>
            </>
          )}

          {p.ctruMaximo - p.ctruMinimo > 0 && (
            <div className="flex items-center justify-between p-2 text-xs text-gray-500">
              <span>Rango CTRU:</span>
              <span>{formatCurrency(p.ctruMinimo)} - {formatCurrency(p.ctruMaximo)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Pricing */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <DollarSign className="w-4 h-4" /> Herramienta de Pricing
        </h4>

        <div className="space-y-3">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Costo base para pricing (Costo Total Real)</div>
            <div className="text-2xl font-bold text-blue-700">{formatCurrency(p.pricing.costoTotal > 0 ? p.pricing.costoTotal : p.pricing.ctru)}</div>
          </div>

          {p.unidadesVendidas === 0 && p.gastoGAGOEstimado > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-700">
              <span className="font-semibold">Nota:</span> GA/GO estimado {formatCurrency(p.gastoGAGOEstimado)}/ud no incluido.
              Costo proyectado con GA/GO: <span className="font-bold">{formatCurrency((p.pricing.costoTotal > 0 ? p.pricing.costoTotal : p.pricing.ctru) + p.gastoGAGOEstimado)}</span>
            </div>
          )}

          <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Precios sugeridos por margen</div>

          {([
            { label: '10% margen', value: p.pricing.precioMinimo10, color: 'text-red-600', bg: 'bg-red-50' },
            { label: '20% margen', value: p.pricing.precioMinimo20, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: '30% margen', value: p.pricing.precioMinimo30, color: 'text-green-600', bg: 'bg-green-50' }
          ]).map(target => (
            <div key={target.label} className={`flex items-center justify-between p-3 ${target.bg} rounded-lg`}>
              <span className="text-sm text-gray-700">{target.label}</span>
              <span className={`text-base font-bold ${target.color}`}>{formatCurrency(target.value)}</span>
            </div>
          ))}

          {p.pricing.precioActual > 0 && (
            <>
              <div className="border-t border-gray-200 my-2" />
              <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Precio actual prom.</span>
                <span className="text-base font-bold text-gray-900">{formatCurrency(p.pricing.precioActual)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                <span className="text-sm text-gray-700">Margen actual</span>
                <span className={`text-sm font-bold ${
                  p.pricing.margenActual >= 20 ? 'text-green-600' :
                  p.pricing.margenActual >= 10 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {p.pricing.margenActual.toFixed(1)}%
                </span>
              </div>
            </>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <div className="text-xs text-gray-500">CTRU Promedio</div>
            <div className="text-lg font-bold text-blue-700">{formatCurrency(p.ctruPromedio)}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg text-center">
            <div className="text-xs text-gray-500">Compra USD Prom.</div>
            <div className="text-lg font-bold text-gray-800">{formatUSD(p.costoCompraUSDProm)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUB-TAB: Historial de Compras
// ============================================

function ComprasTab({ p, formatUSD, formatDate }: {
  p: CTRUProductoDetalle;
  formatUSD: (v: number) => string;
  formatDate: (d: Date | null) => string;
}) {
  // Chart data from lotes
  const chartData = p.lotes
    .slice().reverse() // Chronological order for chart
    .map(l => ({
      name: l.ordenCompraNumero,
      'Costo USD': Math.round(l.costoUnitarioUSD * 100) / 100,
      'Costo PEN': Math.round(l.costoUnitarioPEN * 100) / 100
    }));

  return (
    <div className="space-y-4">
      {/* Chart */}
      {chartData.length >= 2 ? (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4" /> Evolucion del Costo por OC
          </h4>
          <MultiLineChart
            data={chartData}
            lines={[
              { dataKey: 'Costo PEN', color: CHART_COLORS.primary, name: 'Costo PEN' },
              { dataKey: 'Costo USD', color: CHART_COLORS.warning, name: 'Costo USD' }
            ]}
            formatValue={formatCurrency}
            height={220}
          />
        </div>
      ) : p.lotes.length === 1 ? null : (
        <div className="flex flex-col items-center justify-center h-[120px] text-gray-400">
          <TrendingUp className="w-8 h-8 mb-2" />
          <p className="text-sm">Sin historial de compras</p>
        </div>
      )}

      {/* Table */}
      {p.lotes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 font-medium text-gray-600">OC #</th>
                <th className="text-left py-2 px-2 font-medium text-gray-600">Fecha</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">Cantidad</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">Costo USD</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">Costo PEN</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">TC</th>
              </tr>
            </thead>
            <tbody>
              {p.lotes.map((lote) => (
                <tr key={lote.ordenCompraId} className="border-b border-gray-100">
                  <td className="py-2 px-2">
                    <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      {lote.ordenCompraNumero}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-gray-600">{formatDate(lote.fecha)}</td>
                  <td className="py-2 px-2 text-right">
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-medium">
                      {lote.cantidad}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right">{formatUSD(lote.costoUnitarioUSD)}</td>
                  <td className="py-2 px-2 text-right font-semibold">{formatCurrency(lote.costoUnitarioPEN)}</td>
                  <td className="py-2 px-2 text-right text-gray-500">S/ {lote.tc.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {p.lotes.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p className="text-sm">No se encontraron ordenes de compra para este producto</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// SUB-TAB: Ventas
// ============================================

function VentasTab({ p, formatDate }: {
  p: CTRUProductoDetalle;
  formatDate: (d: Date | null) => string;
}) {
  // Chart data from ventas (chronological)
  const chartData = p.ventasDetalle
    .slice().reverse()
    .map(v => ({
      name: v.ventaNumero,
      'Margen %': Math.round(v.margenNeto * 10) / 10
    }));

  return (
    <div className="space-y-4">
      {/* Chart */}
      {chartData.length >= 2 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4" /> Evolucion del Margen por Venta
          </h4>
          <MultiLineChart
            data={chartData}
            lines={[
              { dataKey: 'Margen %', color: CHART_COLORS.success, name: 'Margen Neto %' }
            ]}
            formatValue={(v: number) => `${v.toFixed(1)}%`}
            height={200}
          />
        </div>
      )}

      {/* Table */}
      {p.ventasDetalle.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 font-medium text-gray-600">Venta #</th>
                <th className="text-left py-2 px-2 font-medium text-gray-600">Fecha</th>
                <th className="text-left py-2 px-2 font-medium text-gray-600">Cliente</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">Cant</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">Precio Unit</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">Costo Unit</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">GV/GD</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">Margen</th>
              </tr>
            </thead>
            <tbody>
              {p.ventasDetalle.map((v) => (
                <tr key={v.ventaId} className="border-b border-gray-100">
                  <td className="py-2 px-2">
                    <span className="font-mono text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                      {v.ventaNumero}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-gray-600 text-xs">{formatDate(v.fecha)}</td>
                  <td className="py-2 px-2 text-gray-700 text-xs max-w-[150px] truncate">{v.cliente}</td>
                  <td className="py-2 px-2 text-right">{v.cantidad}</td>
                  <td className="py-2 px-2 text-right">{formatCurrency(v.precioUnitario)}</td>
                  <td className="py-2 px-2 text-right text-gray-600">
                    {v.costoUnitario > 0 ? formatCurrency(v.costoUnitario) : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="py-2 px-2 text-right text-gray-600 text-xs">
                    {v.gvgdUnitario > 0 ? formatCurrency(v.gvgdUnitario) : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {v.margenNeto !== 0 ? (
                      <span className={`text-xs font-bold ${
                        v.margenNeto >= 20 ? 'text-green-600' :
                        v.margenNeto >= 10 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {v.margenNeto.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <ShoppingCart className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">No hay ventas registradas para este producto</p>
        </div>
      )}
    </div>
  );
}
