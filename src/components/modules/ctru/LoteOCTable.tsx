import React, { useState, useMemo } from 'react';
import { formatFecha as formatDate } from '../../../utils/dateFormatters';
import { Search, Truck } from 'lucide-react';
import { Card } from '../../common';
import { formatCurrency } from '../../common/Charts';
import { DataTable } from '../../../design-system';
import type { DataTableColumn } from '../../../design-system';
import type { LoteOCDetalle } from '../../../store/ctruStore';

interface LoteOCTableProps {
  lotes: LoteOCDetalle[];
}

export const LoteOCTable: React.FC<LoteOCTableProps> = ({ lotes }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const expandedKeys = useMemo(() => new Set(expandedId ? [expandedId] : []), [expandedId]);

  const filtered = useMemo(() => {
    if (!searchTerm) return lotes;
    const term = searchTerm.toLowerCase();
    return lotes.filter(l =>
      l.ordenCompraNumero.toLowerCase().includes(term) ||
      l.proveedorNombre.toLowerCase().includes(term)
    );
  }, [lotes, searchTerm]);


  const formatTC = (tc: number) => {
    if (!tc) return '-';
    return `S/ ${tc.toFixed(4)}`;
  };

  const formatUSD = (v: number) => `$ ${v.toFixed(2)}`;

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por OC o proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-sky-500"
          />
        </div>
        <span className="text-sm text-slate-500">{filtered.length} lotes</span>
      </div>

      {(() => {
        const loteColumns: DataTableColumn<LoteOCDetalle>[] = [
          {
            key: 'ordenCompraNumero',
            header: 'OC #',
            render: lote => (
              <span className="font-mono text-xs bg-sky-50 text-sky-700 px-2 py-1 rounded">
                {lote.ordenCompraNumero}
              </span>
            ),
          },
          {
            key: 'proveedorNombre',
            header: 'Proveedor',
            render: lote => (
              <span className="font-medium text-slate-900">{lote.proveedorNombre}</span>
            ),
          },
          {
            key: 'fechaRecepcion',
            header: 'Fecha',
            render: lote => (
              <span className="text-slate-600">{formatDate(lote.fechaRecepcion)}</span>
            ),
            hideOnMobile: true,
          },
          {
            key: 'tcCompra',
            header: 'TC Compra',
            align: 'right',
            render: lote => (
              <span className="text-slate-600">{formatTC(lote.tcCompra)}</span>
            ),
            hideOnMobile: true,
          },
          {
            key: 'tcPago',
            header: 'TC Pago',
            align: 'right',
            render: lote => {
              const tcDiff = lote.tcPago && lote.tcCompra ? lote.tcPago - lote.tcCompra : 0;
              return (
                <>
                  <span className={tcDiff > 0 ? 'text-red-600' : tcDiff < 0 ? 'text-emerald-600' : 'text-slate-600'}>
                    {formatTC(lote.tcPago)}
                  </span>
                  {tcDiff !== 0 && (
                    <span className={`text-[10px] ml-1 ${tcDiff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      ({tcDiff > 0 ? '+' : ''}{tcDiff.toFixed(4)})
                    </span>
                  )}
                </>
              );
            },
            hideOnMobile: true,
          },
          {
            key: 'totalUnidades',
            header: 'Uds.',
            align: 'right',
            render: lote => (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800">
                {lote.totalUnidades}
              </span>
            ),
          },
          {
            key: 'ctruPromedio',
            header: 'CTRU Prom.',
            align: 'right',
            render: lote => (
              <span className="font-semibold">{formatCurrency(lote.ctruPromedio)}</span>
            ),
          },
          {
            key: 'composicion',
            header: 'Composicion',
            align: 'right',
            render: lote => (
              <div className="flex w-24 h-3 ml-auto rounded-full overflow-hidden bg-slate-100">
                {lote.pctCompra > 0 && <div className="bg-sky-500" style={{ width: `${lote.pctCompra}%` }} />}
                {lote.pctImpuesto > 0 && <div className="bg-red-400" style={{ width: `${lote.pctImpuesto}%` }} />}
                {lote.pctEnvio > 0 && <div className="bg-amber-500" style={{ width: `${lote.pctEnvio}%` }} />}
                {lote.pctOtros > 0 && <div className="bg-slate-400" style={{ width: `${lote.pctOtros}%` }} />}
                {lote.pctFleteIntl > 0 && <div className="bg-orange-500" style={{ width: `${lote.pctFleteIntl}%` }} />}
                {lote.pctGAGO > 0 && <div className="bg-purple-500" style={{ width: `${lote.pctGAGO}%` }} />}
              </div>
            ),
            hideOnMobile: true,
          },
        ];

        return (
          <DataTable
            columns={loteColumns}
            data={filtered}
            keyExtractor={lote => lote.ordenCompraId}
            expandedKeys={expandedKeys}
            onToggleExpand={id => setExpandedId(expandedId === id ? null : id)}
            expandedRowRender={lote => {
              const tcDiff = lote.tcPago && lote.tcCompra ? lote.tcPago - lote.tcCompra : 0;
              return (
                <div className="bg-slate-50 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                    <div className="bg-white p-3 rounded-lg border border-l-4 border-l-sky-500">
                      <div className="text-xs text-slate-500 mb-1">Compra Prom.</div>
                      <div className="text-sm font-semibold">{formatUSD(lote.costoCompraUSDProm)}</div>
                      <div className="text-xs text-slate-500">{formatCurrency(lote.costoCompraPENProm)} ({lote.pctCompra.toFixed(1)}%)</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-l-4 border-l-amber-500">
                      <div className="text-xs text-slate-500 mb-1">Adic. OC Prom.</div>
                      <div className="text-sm font-semibold">
                        {formatUSD(lote.costoImpuestoUSDProm + lote.costoEnvioUSDProm + lote.costoOtrosUSDProm)}
                      </div>
                      <div className="text-xs text-slate-500 space-y-0.5">
                        {lote.costoImpuestoUSDProm > 0 && <div>Imp: {formatCurrency(lote.costoImpuestoPENProm)} ({lote.pctImpuesto.toFixed(1)}%)</div>}
                        {lote.costoEnvioUSDProm > 0 && <div>Env: {formatCurrency(lote.costoEnvioPENProm)} ({lote.pctEnvio.toFixed(1)}%)</div>}
                        {lote.costoOtrosUSDProm > 0 && <div>Otr: {formatCurrency(lote.costoOtrosPENProm)} ({lote.pctOtros.toFixed(1)}%)</div>}
                        {lote.costoImpuestoUSDProm === 0 && lote.costoEnvioUSDProm === 0 && lote.costoOtrosUSDProm === 0 && <div>Sin adicionales</div>}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-l-4 border-l-orange-500">
                      <div className="text-xs text-slate-500 mb-1">Flete Intl Prom.</div>
                      <div className="text-sm font-semibold">
                        {lote.costoFleteIntlUSDProm > 0 ? formatUSD(lote.costoFleteIntlUSDProm) : '-'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {lote.costoFleteIntlPENProm > 0
                          ? `${formatCurrency(lote.costoFleteIntlPENProm)} (${lote.pctFleteIntl.toFixed(1)}%)`
                          : 'Sin transferencia'}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-l-4 border-l-purple-500">
                      <div className="text-xs text-slate-500 mb-1">GA/GO Prom.</div>
                      <div className="text-sm font-semibold">{formatCurrency(lote.gastoGAGOProm)}</div>
                      <div className="text-xs text-slate-500">({lote.pctGAGO.toFixed(1)}%)</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-l-4 border-l-gray-400">
                      <div className="text-xs text-slate-500 mb-1">Impacto TC</div>
                      <div className={`text-sm font-semibold ${tcDiff > 0 ? 'text-red-600' : tcDiff < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                        {tcDiff !== 0
                          ? `${tcDiff > 0 ? '+' : ''}${formatCurrency(lote.costoCompraUSDProm * tcDiff)}`
                          : 'Sin diferencia'}
                      </div>
                    </div>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-2">Productos en esta OC</h4>
                  {(() => {
                    type LoteProducto = LoteOCDetalle['productos'][number];
                    const prodColumns: DataTableColumn<LoteProducto>[] = [
                      {
                        key: 'productoSKU',
                        header: 'SKU',
                        render: (prod) => <span className="font-mono text-xs">{prod.productoSKU || '-'}</span>,
                      },
                      {
                        key: 'productoNombre',
                        header: 'Producto',
                        render: (prod) => <span className="text-xs">{prod.productoNombre}</span>,
                      },
                      {
                        key: 'cantidad',
                        header: 'Cant.',
                        align: 'right',
                        render: (prod) => <span className="text-xs">{prod.cantidad}</span>,
                      },
                      {
                        key: 'costoUnitarioUSD',
                        header: 'Costo USD',
                        align: 'right',
                        render: (prod) => <span className="text-xs">{formatUSD(prod.costoUnitarioUSD)}</span>,
                      },
                      {
                        key: 'ctruPromedio',
                        header: 'CTRU Prom.',
                        align: 'right',
                        render: (prod) => <span className="text-xs font-semibold">{formatCurrency(prod.ctruPromedio)}</span>,
                      },
                    ];
                    return (
                      <DataTable
                        columns={prodColumns}
                        data={lote.productos}
                        keyExtractor={(prod) => prod.productoId}
                        compact
                      />
                    );
                  })()}
                </div>
              );
            }}
            emptyState={
              <div className="py-8 text-center text-slate-400">
                <Truck className="w-8 h-8 mx-auto mb-2" />
                {searchTerm ? 'No se encontraron lotes' : 'No hay ordenes de compra registradas'}
              </div>
            }
          />
        );
      })()}
    </Card>
  );
};
