import React, { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, Eye, ChevronRight } from 'lucide-react';
import { Card } from '../../common';
import { formatCurrency } from '../../common/Charts';
import type { CTRUProductoDetalle } from '../../../store/ctruStore';
interface ProductoCTRUTableProps {
  productos: CTRUProductoDetalle[];
  onSelectProducto: (producto: CTRUProductoDetalle) => void;
  vistaCosto?: 'contable' | 'gerencial';
}

type SortField = 'productoSKU' | 'productoNombre' | 'costoCompraUSDProm' | 'adicOC' |
  'costoFleteIntlPENProm' | 'gastoGAGOProm' | 'gastoGVGDProm' | 'ctruPromedio' |
  'precioVentaProm' | 'margenNetoProm' | 'utilidadProm' | 'totalUnidades';

type FiltroEstado = 'todos' | 'inventario' | 'vendidos';

function getSortValue(p: CTRUProductoDetalle, field: SortField): number | string {
  if (field === 'adicOC') {
    return p.costoImpuestoPENProm + p.costoEnvioPENProm + p.costoOtrosPENProm;
  }
  if (field === 'utilidadProm') {
    return p.ventasCount > 0 ? p.precioVentaProm - p.costoTotalRealProm : 0;
  }
  return p[field as keyof CTRUProductoDetalle] as number | string;
}

// ─── Mobile Card Component ───────────────────────────────────────
const MobileProductCard: React.FC<{
  p: CTRUProductoDetalle;
  onClick: () => void;
}> = ({ p, onClick }) => {
  const adicOC = p.costoImpuestoPENProm + p.costoEnvioPENProm + p.costoOtrosPENProm;
  const utilidad = p.ventasCount > 0 ? p.precioVentaProm - p.costoTotalRealProm : 0;

  return (
    <div
      className="border border-gray-100 rounded-xl p-3 active:bg-gray-50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      {/* Header: Product name + badges + CTRU */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              {p.productoSKU}
            </span>
            {p.estadoProducto === 'vendido' && (
              <span className="text-[9px] bg-gray-800 text-white px-1.5 py-0.5 rounded-full">vendido</span>
            )}
            {p.estadoProducto === 'mixto' && (
              <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">mixto</span>
            )}
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
              p.unidadesActivas > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {p.unidadesActivas}/{p.totalUnidades}
            </span>
          </div>
          <div className="text-sm font-semibold text-gray-900 mt-0.5 leading-tight">{p.productoNombre}</div>
          {(p.marca || p.presentacion) && (
            <div className="text-[10px] text-gray-400 leading-tight truncate">
              {[p.marca, p.presentacion, p.contenido, p.dosaje, p.sabor].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-gray-400 uppercase tracking-wide">CTRU</div>
          <div className="text-base font-bold text-gray-900">{formatCurrency(p.ctruPromedio)}</div>
        </div>
      </div>

      {/* Composition bar */}
      <div className="flex w-full h-1.5 rounded-full overflow-hidden bg-gray-100 mb-2.5">
        {p.pctCompra > 0 && <div className="bg-blue-500" style={{ width: `${p.pctCompra}%` }} />}
        {p.pctImpuesto > 0 && <div className="bg-red-400" style={{ width: `${p.pctImpuesto}%` }} />}
        {p.pctEnvio > 0 && <div className="bg-amber-500" style={{ width: `${p.pctEnvio}%` }} />}
        {p.pctOtros > 0 && <div className="bg-gray-400" style={{ width: `${p.pctOtros}%` }} />}
        {p.pctFleteIntl > 0 && <div className="bg-orange-500" style={{ width: `${p.pctFleteIntl}%` }} />}
        {p.pctGAGO > 0 && <div className="bg-purple-500" style={{ width: `${p.pctGAGO}%` }} />}
        {p.pctGVGD > 0 && <div className="bg-cyan-400" style={{ width: `${p.pctGVGD}%` }} />}
      </div>

      {/* Cost breakdown grid */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-[11px] mb-2">
        {/* Row 1: Costos Adquisicion */}
        <div>
          <div className="text-gray-400 text-[9px] uppercase tracking-wide">Compra</div>
          <div className="text-gray-700 font-medium">$ {p.costoCompraUSDProm.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-gray-400 text-[9px] uppercase tracking-wide">Adic. OC</div>
          <div className="text-gray-600">{adicOC > 0.01 ? formatCurrency(adicOC) : '-'}</div>
        </div>
        <div>
          <div className="text-gray-400 text-[9px] uppercase tracking-wide">Flete</div>
          <div className="text-gray-600">{p.costoFleteIntlPENProm > 0.01 ? formatCurrency(p.costoFleteIntlPENProm) : '-'}</div>
        </div>
        {/* Row 2: Gastos */}
        <div>
          <div className="text-gray-400 text-[9px] uppercase tracking-wide">GA/GO</div>
          <div className="text-gray-600">
            {p.gastoGAGOProm > 0.01
              ? formatCurrency(p.gastoGAGOProm)
              : p.gastoGAGOEstimado > 0
                ? <span className="italic text-gray-400">~{formatCurrency(p.gastoGAGOEstimado)}</span>
                : '-'
            }
          </div>
        </div>
        <div>
          <div className="text-gray-400 text-[9px] uppercase tracking-wide">GV/GD</div>
          <div className="text-gray-600">{p.ventasCount > 0 ? formatCurrency(p.gastoGVGDProm) : '-'}</div>
        </div>
        <div /> {/* Empty cell for alignment */}
      </div>

      {/* Footer: Venta + Margen + Utilidad */}
      {p.ventasCount > 0 ? (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-[9px] text-gray-400 uppercase tracking-wide">Venta</div>
              <div className="text-xs font-medium text-gray-700">{formatCurrency(p.precioVentaProm)}</div>
            </div>
            <div>
              <div className="text-[9px] text-gray-400 uppercase tracking-wide">Margen</div>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${
                p.margenNetoProm >= 30 ? 'bg-green-100 text-green-700'
                : p.margenNetoProm >= 20 ? 'bg-emerald-50 text-emerald-600'
                : p.margenNetoProm >= 10 ? 'bg-amber-50 text-amber-600'
                : 'bg-red-50 text-red-600'
              }`}>
                {p.margenNetoProm.toFixed(1)}%
              </span>
            </div>
            <div>
              <div className="text-[9px] text-gray-400 uppercase tracking-wide">Utilidad</div>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${
                utilidad > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}>
                {formatCurrency(utilidad)}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
      ) : (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-[10px] text-gray-400 italic">Sin ventas registradas</span>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
      )}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────
export const ProductoCTRUTable: React.FC<ProductoCTRUTableProps> = ({ productos, onSelectProducto, vistaCosto = 'contable' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('ctruPromedio');
  const [sortAsc, setSortAsc] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');

  const filtered = useMemo(() => {
    let result = [...productos];

    if (filtroEstado === 'inventario') {
      result = result.filter(p => p.estadoProducto !== 'vendido');
    } else if (filtroEstado === 'vendidos') {
      result = result.filter(p => p.estadoProducto === 'vendido');
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.productoNombre.toLowerCase().includes(term) ||
        p.productoSKU.toLowerCase().includes(term)
      );
    }

    result.sort((a, b) => {
      const aVal = getSortValue(a, sortField);
      const bVal = getSortValue(b, sortField);
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return result;
  }, [productos, searchTerm, sortField, sortAsc, filtroEstado]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />;
  };

  const formatUSD = (v: number) => `$ ${v.toFixed(2)}`;

  const countInventario = productos.filter(p => p.estadoProducto !== 'vendido').length;
  const countVendidos = productos.filter(p => p.estadoProducto === 'vendido').length;

  // Header sortable cell helper
  const SortHeader = ({ field, label, className = '' }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`py-2 px-2 font-medium text-gray-500 cursor-pointer hover:text-gray-800 transition-colors text-[11px] ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">
        {label} <SortIcon field={field} />
      </div>
    </th>
  );

  return (
    <Card>
      {/* Search + Filters */}
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-wrap">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50"
          />
        </div>
        <div className="flex items-center gap-1">
          {([
            { id: 'todos' as FiltroEstado, label: 'Todos', count: productos.length },
            { id: 'inventario' as FiltroEstado, label: 'Inv.', labelFull: 'Inventario', count: countInventario },
            { id: 'vendidos' as FiltroEstado, label: 'Vend.', labelFull: 'Vendidos', count: countVendidos }
          ]).map(chip => (
            <button
              key={chip.id}
              onClick={() => setFiltroEstado(chip.id)}
              className={`px-2 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all ${
                filtroEstado === chip.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <span className="sm:hidden">{chip.label}</span>
              <span className="hidden sm:inline">{'labelFull' in chip ? chip.labelFull : chip.label}</span>
              {' '}
              <span className="opacity-70">({chip.count})</span>
            </button>
          ))}
        </div>
        <span className="hidden sm:inline text-xs text-gray-400">{filtered.length} resultados</span>
      </div>

      {/* ═══ MOBILE: Card Layout ═══ */}
      <div className="sm:hidden space-y-2">
        {filtered.map((p) => (
          <MobileProductCard
            key={p.productoId}
            p={p}
            onClick={() => onSelectProducto(p)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-gray-400 text-sm">
            {searchTerm ? 'No se encontraron productos' : 'No hay productos disponibles'}
          </div>
        )}
      </div>

      {/* ═══ DESKTOP: Table Layout ═══ */}
      <div className="hidden sm:block overflow-x-auto -mx-4 sm:-mx-6">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            {/* Group headers row */}
            <tr className="border-b border-gray-100">
              <th className="py-1.5 px-2" />
              <th colSpan={3} className="py-1.5 px-2 text-center">
                <span className="text-[9px] uppercase tracking-widest text-blue-400 font-semibold">
                  Costos Adquisicion
                </span>
              </th>
              <th colSpan={2} className="py-1.5 px-2 text-center border-l border-gray-100">
                <span className="text-[9px] uppercase tracking-widest text-purple-400 font-semibold">
                  Gastos
                </span>
              </th>
              <th colSpan={5} className="py-1.5 px-2 text-center border-l border-gray-100">
                <span className="text-[9px] uppercase tracking-widest text-emerald-500 font-semibold">
                  Resultado
                </span>
              </th>
              <th className="py-1.5 px-2 border-l border-gray-100" />
              <th className="py-1.5 px-2" />
            </tr>
            {/* Column headers row */}
            <tr className="border-b-2 border-gray-200 bg-gray-50/60">
              <SortHeader field="productoNombre" label="Producto" className="!text-left min-w-[220px]" />
              {/* Costos Adquisicion */}
              <SortHeader field="costoCompraUSDProm" label="Compra" />
              <SortHeader field="adicOC" label="Adic. OC" />
              <SortHeader field="costoFleteIntlPENProm" label="Flete" />
              {/* Gastos */}
              <SortHeader field="gastoGAGOProm" label="GA/GO" className="border-l border-gray-100" />
              <SortHeader field="gastoGVGDProm" label="GV/GD" />
              {/* Resultado */}
              <SortHeader field="ctruPromedio" label="CTRU" className="border-l border-gray-100" />
              <SortHeader field="precioVentaProm" label="Venta" />
              <SortHeader field="margenNetoProm" label="Margen" />
              <SortHeader field="utilidadProm" label="Utilidad" />
              {/* Stock */}
              <SortHeader field="totalUnidades" label="Uds" className="border-l border-gray-100" />
              <th className="py-2 px-1 w-8" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, idx) => {
              const adicOC = p.costoImpuestoPENProm + p.costoEnvioPENProm + p.costoOtrosPENProm;
              const pctAdicOC = p.pctImpuesto + p.pctEnvio + p.pctOtros;

              // Vista-aware: usar campos gerenciales cuando corresponde
              const ctruActivo = vistaCosto === 'gerencial' ? (p.ctruGerencialProm || p.ctruPromedio) : p.ctruPromedio;
              const gagoActivo = vistaCosto === 'gerencial' ? (p.gastoGAGOGerencialProm || p.gastoGAGOProm) : p.gastoGAGOProm;
              const costoTotalActivo = ctruActivo + p.gastoGVGDProm;
              const utilidad = p.precioVentaProm - costoTotalActivo;
              const margenActivo = p.precioVentaProm > 0 ? ((p.precioVentaProm - costoTotalActivo) / p.precioVentaProm) * 100 : 0;
              const pctGAGOActivo = ctruActivo > 0 ? (gagoActivo / ctruActivo) * 100 : 0;
              const isEven = idx % 2 === 0;

              return (
                <tr
                  key={p.productoId}
                  className={`border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer transition-all group ${
                    isEven ? 'bg-white' : 'bg-gray-50/30'
                  }`}
                  onClick={() => onSelectProducto(p)}
                >
                  {/* PRODUCTO */}
                  <td className="py-2.5 px-2 min-w-[220px]">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                        {p.productoSKU || '-'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-900 text-xs leading-tight truncate">{p.productoNombre}</span>
                          {p.estadoProducto === 'vendido' && (
                            <span className="text-[9px] bg-gray-800 text-white px-1.5 py-0.5 rounded-full shrink-0">vendido</span>
                          )}
                          {p.estadoProducto === 'mixto' && (
                            <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full shrink-0">mixto</span>
                          )}
                        </div>
                        {(p.marca || p.presentacion || p.contenido || p.dosaje) && (
                          <div className="text-[10px] text-gray-400 leading-tight truncate">
                            {[p.marca, p.presentacion, p.contenido, p.dosaje, p.sabor].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        <div
                          className="flex w-full h-1 mt-1 rounded-full overflow-hidden bg-gray-100"
                          title={`Compra ${p.pctCompra.toFixed(0)}% | Imp ${p.pctImpuesto.toFixed(0)}% | Env ${p.pctEnvio.toFixed(0)}% | Flete ${p.pctFleteIntl.toFixed(0)}% | GA/GO ${pctGAGOActivo.toFixed(0)}% | GV/GD ${p.pctGVGD.toFixed(0)}%`}
                        >
                          {p.pctCompra > 0 && <div className="bg-blue-500" style={{ width: `${p.pctCompra}%` }} />}
                          {p.pctImpuesto > 0 && <div className="bg-red-400" style={{ width: `${p.pctImpuesto}%` }} />}
                          {p.pctEnvio > 0 && <div className="bg-amber-500" style={{ width: `${p.pctEnvio}%` }} />}
                          {p.pctOtros > 0 && <div className="bg-gray-400" style={{ width: `${p.pctOtros}%` }} />}
                          {p.pctFleteIntl > 0 && <div className="bg-orange-500" style={{ width: `${p.pctFleteIntl}%` }} />}
                          {pctGAGOActivo > 0 && <div className="bg-purple-500" style={{ width: `${pctGAGOActivo}%` }} />}
                          {p.pctGVGD > 0 && <div className="bg-cyan-400" style={{ width: `${p.pctGVGD}%` }} />}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* COSTOS ADQUISICION */}
                  <td className="py-2.5 px-2 text-right">
                    <div className="text-xs text-gray-700">{formatUSD(p.costoCompraUSDProm)}</div>
                    <div className="text-[10px] text-gray-400">({p.pctCompra.toFixed(0)}%)</div>
                  </td>
                  <td className="py-2.5 px-2 text-right" title={`Imp: ${formatCurrency(p.costoImpuestoPENProm)} | Env: ${formatCurrency(p.costoEnvioPENProm)} | Otr: ${formatCurrency(p.costoOtrosPENProm)}`}>
                    {adicOC > 0.01 ? (
                      <>
                        <div className="text-xs text-gray-600">{formatCurrency(adicOC)}</div>
                        <div className="text-[10px] text-gray-400">({pctAdicOC.toFixed(0)}%)</div>
                      </>
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {p.costoFleteIntlPENProm > 0.01 ? (
                      <>
                        <div className="text-xs text-gray-600">{formatCurrency(p.costoFleteIntlPENProm)}</div>
                        <div className="text-[10px] text-gray-400">({p.pctFleteIntl.toFixed(0)}%)</div>
                      </>
                    ) : <span className="text-gray-300 text-xs">-</span>}
                  </td>

                  {/* GASTOS */}
                  <td className="py-2.5 px-2 text-right border-l border-gray-50" title={p.gastoGAGOEstimado > 0 ? `Estimado: ${formatCurrency(p.gastoGAGOEstimado)}` : undefined}>
                    {gagoActivo > 0.01 ? (
                      <>
                        <div className="text-xs text-gray-600">{formatCurrency(gagoActivo)}</div>
                        <div className="text-[10px] text-gray-400">({pctGAGOActivo.toFixed(0)}%)</div>
                      </>
                    ) : p.gastoGAGOEstimado > 0 ? (
                      <span className="text-gray-400 italic text-[11px]">~{formatCurrency(p.gastoGAGOEstimado)}</span>
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {p.ventasCount > 0 ? (
                      <>
                        <div className="text-xs text-gray-600">{formatCurrency(p.gastoGVGDProm)}</div>
                        <div className="text-[10px] text-gray-400">({p.pctGVGD.toFixed(0)}%)</div>
                      </>
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>

                  {/* RESULTADO */}
                  <td className="py-2.5 px-2 text-right border-l border-gray-50">
                    <span className="font-bold text-gray-900 text-sm">
                      {formatCurrency(ctruActivo)}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {p.ventasCount > 0 ? (
                      <span className="text-xs font-medium text-gray-700">{formatCurrency(p.precioVentaProm)}</span>
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {p.ventasCount > 0 ? (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        margenActivo >= 30 ? 'bg-green-100 text-green-700'
                        : margenActivo >= 20 ? 'bg-emerald-50 text-emerald-600'
                        : margenActivo >= 10 ? 'bg-amber-50 text-amber-600'
                        : 'bg-red-50 text-red-600'
                      }`}>
                        {margenActivo.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {p.ventasCount > 0 ? (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        utilidad > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                      }`}>
                        {formatCurrency(utilidad)}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>

                  {/* STOCK */}
                  <td className="py-2.5 px-2 text-right border-l border-gray-50">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      p.unidadesActivas > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {p.unidadesActivas}/{p.totalUnidades}
                    </span>
                  </td>
                  <td className="py-2.5 px-1 text-center">
                    <Eye className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 mx-auto transition-colors" />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="py-12 text-center text-gray-400">
                  <div className="text-sm">{searchTerm ? 'No se encontraron productos' : 'No hay productos disponibles'}</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
