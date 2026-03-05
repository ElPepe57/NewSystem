import React, { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, Eye } from 'lucide-react';
import { Card } from '../../common';
import { formatCurrency } from '../../common/Charts';
import type { CTRUProductoDetalle } from '../../../store/ctruStore';

interface ProductoCTRUTableProps {
  productos: CTRUProductoDetalle[];
  onSelectProducto: (producto: CTRUProductoDetalle) => void;
}

type SortField = 'productoSKU' | 'productoNombre' | 'costoCompraUSDProm' | 'adicOC' |
  'costoFleteIntlPENProm' | 'gastoGAGOProm' | 'gastoGVGDProm' | 'ctruPromedio' |
  'precioVentaProm' | 'margenNetoProm' | 'totalUnidades';

type FiltroEstado = 'todos' | 'inventario' | 'vendidos';

function getSortValue(p: CTRUProductoDetalle, field: SortField): number | string {
  if (field === 'adicOC') {
    return p.costoImpuestoPENProm + p.costoEnvioPENProm + p.costoOtrosPENProm;
  }
  return p[field as keyof CTRUProductoDetalle] as number | string;
}

export const ProductoCTRUTable: React.FC<ProductoCTRUTableProps> = ({ productos, onSelectProducto }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('ctruPromedio');
  const [sortAsc, setSortAsc] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');

  const filtered = useMemo(() => {
    let result = [...productos];

    // Filtro por estado
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
    return sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const formatUSD = (v: number) => `$ ${v.toFixed(2)}`;

  const countInventario = productos.filter(p => p.estadoProducto !== 'vendido').length;
  const countVendidos = productos.filter(p => p.estadoProducto === 'vendido').length;

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        {/* Filtro estado chips */}
        <div className="flex items-center gap-1">
          {([
            { id: 'todos' as FiltroEstado, label: 'Todos', count: productos.length },
            { id: 'inventario' as FiltroEstado, label: 'En Inventario', count: countInventario },
            { id: 'vendidos' as FiltroEstado, label: 'Vendidos', count: countVendidos }
          ]).map(chip => (
            <button
              key={chip.id}
              onClick={() => setFiltroEstado(chip.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filtroEstado === chip.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {chip.label} ({chip.count})
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-500">{filtered.length} productos</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th
                className="text-left py-3 px-2 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                onClick={() => handleSort('productoSKU')}
              >
                <div className="flex items-center gap-1">SKU <SortIcon field="productoSKU" /></div>
              </th>
              <th
                className="text-left py-3 px-2 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                onClick={() => handleSort('productoNombre')}
              >
                <div className="flex items-center gap-1">Producto <SortIcon field="productoNombre" /></div>
              </th>
              <th
                className="text-right py-3 px-2 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                onClick={() => handleSort('costoCompraUSDProm')}
              >
                <div className="flex items-center justify-end gap-1">Compra USD <SortIcon field="costoCompraUSDProm" /></div>
              </th>
              <th
                className="text-right py-3 px-2 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                onClick={() => handleSort('adicOC')}
                title="Impuesto + Envio + Otros de OC"
              >
                <div className="flex items-center justify-end gap-1">Adic. OC <SortIcon field="adicOC" /></div>
              </th>
              <th
                className="text-right py-3 px-2 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                onClick={() => handleSort('costoFleteIntlPENProm')}
              >
                <div className="flex items-center justify-end gap-1">Flete Intl <SortIcon field="costoFleteIntlPENProm" /></div>
              </th>
              <th
                className="text-right py-3 px-2 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                onClick={() => handleSort('gastoGAGOProm')}
              >
                <div className="flex items-center justify-end gap-1">GA/GO <SortIcon field="gastoGAGOProm" /></div>
              </th>
              <th
                className="text-right py-3 px-2 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                onClick={() => handleSort('gastoGVGDProm')}
              >
                <div className="flex items-center justify-end gap-1">GV/GD <SortIcon field="gastoGVGDProm" /></div>
              </th>
              <th
                className="text-right py-3 px-2 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                onClick={() => handleSort('ctruPromedio')}
              >
                <div className="flex items-center justify-end gap-1">CTRU <SortIcon field="ctruPromedio" /></div>
              </th>
              <th
                className="text-right py-3 px-2 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                onClick={() => handleSort('precioVentaProm')}
              >
                <div className="flex items-center justify-end gap-1">Venta <SortIcon field="precioVentaProm" /></div>
              </th>
              <th
                className="text-right py-3 px-2 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                onClick={() => handleSort('margenNetoProm')}
              >
                <div className="flex items-center justify-end gap-1">Margen <SortIcon field="margenNetoProm" /></div>
              </th>
              <th
                className="text-right py-3 px-2 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                onClick={() => handleSort('totalUnidades')}
              >
                <div className="flex items-center justify-end gap-1">Uds <SortIcon field="totalUnidades" /></div>
              </th>
              <th className="text-center py-3 px-2 font-medium text-gray-600 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const adicOC = p.costoImpuestoPENProm + p.costoEnvioPENProm + p.costoOtrosPENProm;
              const pctAdicOC = p.pctImpuesto + p.pctEnvio + p.pctOtros;

              return (
                <tr
                  key={p.productoId}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onSelectProducto(p)}
                >
                  <td className="py-3 px-2">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{p.productoSKU || '-'}</span>
                  </td>
                  <td className="py-3 px-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-xs">{p.productoNombre}</span>
                        {p.estadoProducto === 'vendido' && (
                          <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">vendido</span>
                        )}
                      </div>
                      {(p.marca || p.presentacion || p.contenido || p.dosaje) && (
                        <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                          {[p.marca, p.presentacion, p.contenido, p.dosaje, p.sabor].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      <div className="flex w-full h-1.5 mt-1 rounded-full overflow-hidden bg-gray-100">
                        {p.pctCompra > 0 && <div className="bg-blue-500" style={{ width: `${p.pctCompra}%` }} />}
                        {p.pctImpuesto > 0 && <div className="bg-red-400" style={{ width: `${p.pctImpuesto}%` }} />}
                        {p.pctEnvio > 0 && <div className="bg-amber-500" style={{ width: `${p.pctEnvio}%` }} />}
                        {p.pctOtros > 0 && <div className="bg-gray-400" style={{ width: `${p.pctOtros}%` }} />}
                        {p.pctFleteIntl > 0 && <div className="bg-orange-500" style={{ width: `${p.pctFleteIntl}%` }} />}
                        {p.pctGAGO > 0 && <div className="bg-purple-500" style={{ width: `${p.pctGAGO}%` }} />}
                        {p.pctGVGD > 0 && <div className="bg-cyan-500" style={{ width: `${p.pctGVGD}%` }} />}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right text-gray-700">
                    {formatUSD(p.costoCompraUSDProm)} <span className="text-gray-400 text-[10px]">({p.pctCompra.toFixed(0)}%)</span>
                  </td>
                  <td className="py-3 px-2 text-right text-gray-600 text-xs" title={`Imp: ${formatCurrency(p.costoImpuestoPENProm)} | Env: ${formatCurrency(p.costoEnvioPENProm)} | Otr: ${formatCurrency(p.costoOtrosPENProm)}`}>
                    {adicOC > 0.01 ? (
                      <span>{formatCurrency(adicOC)} <span className="text-gray-400">({pctAdicOC.toFixed(0)}%)</span></span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right text-gray-600 text-xs">
                    {p.costoFleteIntlPENProm > 0.01 ? (
                      <span>{formatCurrency(p.costoFleteIntlPENProm)} <span className="text-gray-400">({p.pctFleteIntl.toFixed(0)}%)</span></span>
                    ) : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="py-3 px-2 text-right text-xs" title={p.gastoGAGOEstimado > 0 ? `Estimado: ${formatCurrency(p.gastoGAGOEstimado)}` : undefined}>
                    {p.gastoGAGOProm > 0.01
                      ? <span className="text-gray-600">{formatCurrency(p.gastoGAGOProm)} <span className="text-gray-400">({p.pctGAGO.toFixed(0)}%)</span></span>
                      : p.gastoGAGOEstimado > 0
                        ? <span className="text-gray-400 italic">~{formatCurrency(p.gastoGAGOEstimado)}</span>
                        : <span className="text-gray-400">-</span>
                    }
                  </td>
                  <td className="py-3 px-2 text-right text-xs">
                    {p.ventasCount > 0 ? (
                      <span className="text-gray-600">{formatCurrency(p.gastoGVGDProm)} <span className="text-gray-400">({p.pctGVGD.toFixed(0)}%)</span></span>
                    ) : (
                      <span className="text-gray-400 italic">-</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-gray-900">{formatCurrency(p.ctruPromedio)}</td>
                  <td className="py-3 px-2 text-right text-xs">
                    {p.ventasCount > 0 ? (
                      <span className="text-gray-700">{formatCurrency(p.precioVentaProm)}</span>
                    ) : (
                      <span className="text-gray-400 italic">-</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right">
                    {p.ventasCount > 0 ? (
                      <span className={`text-xs font-bold ${p.margenNetoProm >= 20 ? 'text-green-600' : p.margenNetoProm >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                        {p.margenNetoProm.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-400 italic text-xs">-</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.unidadesActivas > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {p.unidadesActivas}/{p.totalUnidades}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Eye className="w-4 h-4 text-gray-400 hover:text-blue-600 mx-auto" />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="py-8 text-center text-gray-400">
                  {searchTerm ? 'No se encontraron productos' : 'No hay productos disponibles'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
