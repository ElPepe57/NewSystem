import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Truck } from 'lucide-react';
import { Card } from '../../common';
import { formatCurrency } from '../../common/Charts';
import type { LoteOCDetalle } from '../../../store/ctruStore';

interface LoteOCTableProps {
  lotes: LoteOCDetalle[];
}

export const LoteOCTable: React.FC<LoteOCTableProps> = ({ lotes }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!searchTerm) return lotes;
    const term = searchTerm.toLowerCase();
    return lotes.filter(l =>
      l.ordenCompraNumero.toLowerCase().includes(term) ||
      l.proveedorNombre.toLowerCase().includes(term)
    );
  }, [lotes, searchTerm]);

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  };

  const formatTC = (tc: number) => {
    if (!tc) return '-';
    return `S/ ${tc.toFixed(4)}`;
  };

  const formatUSD = (v: number) => `$ ${v.toFixed(2)}`;

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por OC o proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <span className="text-sm text-gray-500">{filtered.length} lotes</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-2 font-medium text-gray-600 w-8"></th>
              <th className="text-left py-3 px-2 font-medium text-gray-600">OC #</th>
              <th className="text-left py-3 px-2 font-medium text-gray-600">Proveedor</th>
              <th className="text-left py-3 px-2 font-medium text-gray-600">Fecha</th>
              <th className="text-right py-3 px-2 font-medium text-gray-600">TC Compra</th>
              <th className="text-right py-3 px-2 font-medium text-gray-600">TC Pago</th>
              <th className="text-right py-3 px-2 font-medium text-gray-600">Uds.</th>
              <th className="text-right py-3 px-2 font-medium text-gray-600">CTRU Prom.</th>
              <th className="text-right py-3 px-2 font-medium text-gray-600">Composicion</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lote) => {
              const isExpanded = expandedId === lote.ordenCompraId;
              const tcDiff = lote.tcPago && lote.tcCompra ? lote.tcPago - lote.tcCompra : 0;

              return (
                <React.Fragment key={lote.ordenCompraId}>
                  <tr
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : lote.ordenCompraId)}
                  >
                    <td className="py-3 px-2">
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-gray-400" />
                        : <ChevronRight className="w-4 h-4 text-gray-400" />
                      }
                    </td>
                    <td className="py-3 px-2">
                      <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        {lote.ordenCompraNumero}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-medium text-gray-900">{lote.proveedorNombre}</td>
                    <td className="py-3 px-2 text-gray-600">{formatDate(lote.fechaRecepcion)}</td>
                    <td className="py-3 px-2 text-right text-gray-600">{formatTC(lote.tcCompra)}</td>
                    <td className="py-3 px-2 text-right">
                      <span className={tcDiff > 0 ? 'text-red-600' : tcDiff < 0 ? 'text-green-600' : 'text-gray-600'}>
                        {formatTC(lote.tcPago)}
                      </span>
                      {tcDiff !== 0 && (
                        <span className={`text-[10px] ml-1 ${tcDiff > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          ({tcDiff > 0 ? '+' : ''}{tcDiff.toFixed(4)})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {lote.totalUnidades}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right font-semibold">{formatCurrency(lote.ctruPromedio)}</td>
                    <td className="py-3 px-2">
                      {/* Mini composition bar - 7 layers */}
                      <div className="flex w-24 h-3 ml-auto rounded-full overflow-hidden bg-gray-100">
                        {lote.pctCompra > 0 && <div className="bg-blue-500" style={{ width: `${lote.pctCompra}%` }} />}
                        {lote.pctImpuesto > 0 && <div className="bg-red-400" style={{ width: `${lote.pctImpuesto}%` }} />}
                        {lote.pctEnvio > 0 && <div className="bg-amber-500" style={{ width: `${lote.pctEnvio}%` }} />}
                        {lote.pctOtros > 0 && <div className="bg-gray-400" style={{ width: `${lote.pctOtros}%` }} />}
                        {lote.pctFleteIntl > 0 && <div className="bg-orange-500" style={{ width: `${lote.pctFleteIntl}%` }} />}
                        {lote.pctGAGO > 0 && <div className="bg-purple-500" style={{ width: `${lote.pctGAGO}%` }} />}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={9} className="bg-gray-50 p-4">
                        {/* Cost composition per unit - 7 layers (grouped for space) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                          <div className="bg-white p-3 rounded-lg border border-l-4 border-l-blue-500">
                            <div className="text-xs text-gray-500 mb-1">Compra Prom.</div>
                            <div className="text-sm font-semibold">{formatUSD(lote.costoCompraUSDProm)}</div>
                            <div className="text-xs text-gray-500">{formatCurrency(lote.costoCompraPENProm)} ({lote.pctCompra.toFixed(1)}%)</div>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-l-4 border-l-amber-500">
                            <div className="text-xs text-gray-500 mb-1">Adic. OC Prom.</div>
                            <div className="text-sm font-semibold">
                              {formatUSD(lote.costoImpuestoUSDProm + lote.costoEnvioUSDProm + lote.costoOtrosUSDProm)}
                            </div>
                            <div className="text-xs text-gray-500 space-y-0.5">
                              {lote.costoImpuestoUSDProm > 0 && (
                                <div>Imp: {formatCurrency(lote.costoImpuestoPENProm)} ({lote.pctImpuesto.toFixed(1)}%)</div>
                              )}
                              {lote.costoEnvioUSDProm > 0 && (
                                <div>Env: {formatCurrency(lote.costoEnvioPENProm)} ({lote.pctEnvio.toFixed(1)}%)</div>
                              )}
                              {lote.costoOtrosUSDProm > 0 && (
                                <div>Otr: {formatCurrency(lote.costoOtrosPENProm)} ({lote.pctOtros.toFixed(1)}%)</div>
                              )}
                              {lote.costoImpuestoUSDProm === 0 && lote.costoEnvioUSDProm === 0 && lote.costoOtrosUSDProm === 0 && (
                                <div>Sin adicionales</div>
                              )}
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-l-4 border-l-orange-500">
                            <div className="text-xs text-gray-500 mb-1">Flete Intl Prom.</div>
                            <div className="text-sm font-semibold">
                              {lote.costoFleteIntlUSDProm > 0 ? formatUSD(lote.costoFleteIntlUSDProm) : '-'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {lote.costoFleteIntlPENProm > 0
                                ? `${formatCurrency(lote.costoFleteIntlPENProm)} (${lote.pctFleteIntl.toFixed(1)}%)`
                                : 'Sin transferencia'}
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-l-4 border-l-purple-500">
                            <div className="text-xs text-gray-500 mb-1">GA/GO Prom.</div>
                            <div className="text-sm font-semibold">{formatCurrency(lote.gastoGAGOProm)}</div>
                            <div className="text-xs text-gray-500">({lote.pctGAGO.toFixed(1)}%)</div>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-l-4 border-l-gray-400">
                            <div className="text-xs text-gray-500 mb-1">Impacto TC</div>
                            <div className={`text-sm font-semibold ${tcDiff > 0 ? 'text-red-600' : tcDiff < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                              {tcDiff !== 0
                                ? `${tcDiff > 0 ? '+' : ''}${formatCurrency(lote.costoCompraUSDProm * tcDiff)}`
                                : 'Sin diferencia'
                              }
                            </div>
                          </div>
                        </div>

                        <h4 className="text-xs font-semibold text-gray-700 mb-2">Productos en esta OC</h4>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2 text-gray-500">SKU</th>
                              <th className="text-left py-2 px-2 text-gray-500">Producto</th>
                              <th className="text-right py-2 px-2 text-gray-500">Cant.</th>
                              <th className="text-right py-2 px-2 text-gray-500">Costo USD</th>
                              <th className="text-right py-2 px-2 text-gray-500">CTRU Prom.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lote.productos.map((prod) => (
                              <tr key={prod.productoId} className="border-b border-gray-100">
                                <td className="py-2 px-2 font-mono">{prod.productoSKU || '-'}</td>
                                <td className="py-2 px-2">{prod.productoNombre}</td>
                                <td className="py-2 px-2 text-right">{prod.cantidad}</td>
                                <td className="py-2 px-2 text-right">{formatUSD(prod.costoUnitarioUSD)}</td>
                                <td className="py-2 px-2 text-right font-semibold">{formatCurrency(prod.ctruPromedio)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-gray-400">
                  <Truck className="w-8 h-8 mx-auto mb-2" />
                  {searchTerm ? 'No se encontraron lotes' : 'No hay ordenes de compra registradas'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
