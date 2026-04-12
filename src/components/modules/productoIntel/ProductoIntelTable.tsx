import React from 'react';
import { Eye, AlertTriangle, Lock, Truck } from 'lucide-react';
import { DataTable } from '../../../design-system';
import type { DataTableColumn } from '../../../design-system';
import { ScoreLiquidezBadge, TendenciaBadge, RotacionBadge } from './ScoreLiquidezBadge';
import type { ProductoIntel } from '../../../types/productoIntel.types';
import { formatCurrencyPEN } from '../../../utils/format';

interface ProductoIntelTableProps {
  productos: ProductoIntel[];
  onSort?: (campo: string) => void;
  sortConfig?: { campo: string; ascendente: boolean };
  onProductoClick?: (productoId: string) => void;
}

const formatCurrency = (value: number): string => formatCurrencyPEN(value);

export const ProductoIntelTable: React.FC<ProductoIntelTableProps> = ({
  productos, onSort, sortConfig, onProductoClick,
}) => {
  const columns: DataTableColumn<ProductoIntel>[] = [
    {
      key: 'nombre', header: 'Producto', sortable: !!onSort,
      render: p => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900 truncate max-w-[200px]" title={p.nombreComercial}>{p.nombreComercial}</p>
          <p className="text-xs text-slate-500">{p.sku} - {p.marca}</p>
        </div>
      ),
    },
    {
      key: 'score', header: 'Liquidez', align: 'center', sortable: !!onSort,
      render: p => <ScoreLiquidezBadge score={p.liquidez.score} clasificacion={p.liquidez.clasificacion} size="sm" />,
    },
    {
      key: 'rotacion', header: 'Rotacion', align: 'center', sortable: !!onSort, hideOnMobile: true,
      render: p => <RotacionBadge rotacionDias={p.rotacion.rotacionDias} clasificacion={p.rotacion.clasificacionRotacion} />,
    },
    {
      key: 'stock', header: 'Stock', align: 'center', sortable: !!onSort,
      render: p => (
        <div>
          <p className="font-medium text-slate-900">{p.rotacion.stockTotal}</p>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            {p.rotacion.stockReservado > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-sky-100 text-sky-700 rounded text-[10px]" title="Stock reservado">
                <Lock className="h-2.5 w-2.5" />{p.rotacion.stockReservado}
              </span>
            )}
            {p.rotacion.stockTransito > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px]" title="Stock en tránsito">
                <Truck className="h-2.5 w-2.5" />{p.rotacion.stockTransito}
              </span>
            )}
            {p.rotacion.stockReservado === 0 && p.rotacion.stockTransito === 0 && (
              <span className="text-xs text-slate-500">{p.rotacion.diasParaQuiebre < 999 ? `${p.rotacion.diasParaQuiebre}d` : '-'}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'margen', header: 'Margen', align: 'center', sortable: !!onSort, hideOnMobile: true,
      render: p => (
        <div>
          <p className={`font-medium ${p.rentabilidad.margenBrutoPromedio >= 30 ? 'text-emerald-600' : p.rentabilidad.margenBrutoPromedio >= 20 ? 'text-amber-600' : 'text-red-600'}`}>
            {p.rentabilidad.margenBrutoPromedio.toFixed(0)}%
          </p>
          <p className="text-xs text-slate-500">ROI {p.rentabilidad.roiPromedio}%</p>
        </div>
      ),
    },
    {
      key: 'peso', header: 'Peso', align: 'center', sortable: !!onSort, hideOnMobile: true,
      render: p => p.pesoLibras ? (
        <div>
          <p className="font-mono text-sm text-slate-700">{p.pesoLibras.toFixed(2)} lb</p>
          {p.margenPorLibra != null && p.margenPorLibra > 0 && (
            <p className="text-xs text-teal-600">{formatCurrency(p.margenPorLibra)}/lb</p>
          )}
        </div>
      ) : <span className="text-xs text-slate-300">—</span>,
    },
    {
      key: 'ventas30d', header: 'Ventas 30d', align: 'right', sortable: !!onSort, hideOnMobile: true,
      render: p => (
        <div>
          <p className="font-medium text-slate-900">{formatCurrency(p.rotacion.ventasPEN30d)}</p>
          <p className="text-xs text-slate-500">{p.rotacion.unidadesVendidas30d} uds</p>
        </div>
      ),
    },
    {
      key: 'tendencia', header: 'Tendencia', align: 'center', sortable: !!onSort, hideOnMobile: true,
      render: p => <TendenciaBadge tendencia={p.rotacion.tendencia} variacion={p.rotacion.variacionVentas} />,
    },
    {
      key: 'valorInv', header: 'Valor Inv.', align: 'right', sortable: !!onSort, hideOnMobile: true,
      render: p => (
        <div>
          <p className="font-medium text-slate-900">{formatCurrency(p.liquidez.valorInventarioPEN)}</p>
          <p className="text-xs text-emerald-600">+{formatCurrency(p.liquidez.potencialUtilidadPEN)}</p>
        </div>
      ),
    },
    {
      key: 'alertas', header: 'Alertas', align: 'center',
      render: p => {
        const criticas = p.alertas.filter(a => a.severidad === 'danger').length;
        const warnings = p.alertas.filter(a => a.severidad === 'warning').length;
        return (criticas > 0 || warnings > 0) ? (
          <div className="flex items-center justify-center gap-1">
            {criticas > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs">
                <AlertTriangle className="h-3 w-3" />{criticas}
              </span>
            )}
            {warnings > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">
                <AlertTriangle className="h-3 w-3" />{warnings}
              </span>
            )}
          </div>
        ) : <span className="text-xs text-slate-400">-</span>;
      },
    },
    {
      key: 'accion', header: '', width: 'w-10',
      render: p => (
        <button
          className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
          onClick={e => { e.stopPropagation(); onProductoClick?.(p.productoId); }}
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <DataTable<ProductoIntel>
        columns={columns}
        data={productos}
        keyExtractor={p => p.productoId}
        onRowClick={onProductoClick ? p => onProductoClick(p.productoId) : undefined}
        sortBy={sortConfig?.campo}
        sortDirection={sortConfig?.ascendente ? 'asc' : 'desc'}
        onSort={onSort}
        compact
        emptyMessage="No hay productos que mostrar"
      />
    </div>
  );
};
