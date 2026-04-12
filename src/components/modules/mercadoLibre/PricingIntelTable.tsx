/**
 * Tabla desktop del Panel de Pricing Inteligente.
 * Muestra productos ML agrupados con datos de costo CTRU, márgenes, y Buy Box.
 */

import React, { useState } from 'react';
import {
  Check,
  X,
  RefreshCw,
  ExternalLink,
  Eye,
  Edit3,
} from 'lucide-react';
import { DataTable } from '../../../design-system';
import type { DataTableColumn } from '../../../design-system';
import { useMercadoLibreStore } from '../../../store/mercadoLibreStore';
import type {
  PricingIntelRow,
  SortField,
  SortDir,
} from './pricingIntel.utils';
import {
  getMarginColor,
  getMarginBg,
  fmtPEN,
  fmtPct,
} from './pricingIntel.utils';

interface PricingIntelTableProps {
  rows: PricingIntelRow[];
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onOpenDetail: (row: PricingIntelRow) => void;
}

// ---- BUY BOX MINI BADGE ----
const BuyBoxMini: React.FC<{ row: PricingIntelRow }> = ({ row }) => {
  if (!row.hasCatalogo || !row.buyBoxStatus) {
    return <span className="text-slate-300 text-xs">—</span>;
  }

  const cfg: Record<string, { label: string; bg: string; text: string }> = {
    winning: { label: 'GANANDO', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    competing: { label: 'PERDIENDO', bg: 'bg-red-50', text: 'text-red-700' },
    sharing_first_place: { label: 'COMPARTIDO', bg: 'bg-yellow-50', text: 'text-yellow-700' },
    listed: { label: 'SIN COMPETIR', bg: 'bg-slate-100', text: 'text-slate-500' },
  };

  const c = cfg[row.buyBoxStatus] || cfg.listed;

  return (
    <div className="space-y-0.5">
      <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
        {c.label}
      </span>
      {row.buyBoxStatus === 'competing' && row.buyBoxPriceToWin != null && (
        <p className="text-[10px] text-red-500">p/ganar: {fmtPEN(row.buyBoxPriceToWin)}</p>
      )}
    </div>
  );
};

// ---- LISTING TYPE BADGES ----
const ListingTypeBadges: React.FC<{ row: PricingIntelRow }> = ({ row }) => (
  <div className="flex items-center gap-1">
    {row.hasCatalogo && (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">CAT</span>
    )}
    {row.hasClasica && (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">CLA</span>
    )}
  </div>
);

// ---- INLINE PRICE EDIT (updates all listings in group) ----
const InlinePriceCell: React.FC<{ row: PricingIntelRow }> = ({ row }) => {
  const { updatePrice } = useMercadoLibreStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(row.mlPrice));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const newPrice = parseFloat(value);
    if (isNaN(newPrice) || newPrice <= 0 || newPrice === row.mlPrice) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      for (const listingId of row.listingIds) {
        await updatePrice(listingId, newPrice);
      }
      setEditing(false);
    } catch {
      // error handled in store
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-400">S/</span>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-20 px-1.5 py-0.5 border border-amber-300 rounded text-xs focus:ring-amber-500 focus:border-amber-500"
          autoFocus
          step="0.01"
          min="0.01"
        />
        {saving ? (
          <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
        ) : (
          <>
            <button onClick={handleSave} className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded">
              <Check className="w-3 h-3" />
            </button>
            <button onClick={() => setEditing(false)} className="p-0.5 text-slate-400 hover:bg-slate-100 rounded">
              <X className="w-3 h-3" />
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => { setValue(String(row.mlPrice)); setEditing(true); }}
      className="group flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-amber-600"
      title="Editar precio en ML"
    >
      {fmtPEN(row.mlPrice)}
      <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
};

// Mapa de SortField a key de columna para conectar con DataTable
const SORT_FIELD_KEY: Record<SortField, string> = {
  nombre: 'nombre',
  precio: 'precio',
  costo: 'costo',
  margen: 'margen',
  buybox: 'buybox',
};

// ---- TABLA PRINCIPAL ----
export const PricingIntelTable: React.FC<PricingIntelTableProps> = ({
  rows,
  sortField,
  sortDir,
  onSort,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onOpenDetail,
}) => {
  const columns: DataTableColumn<PricingIntelRow>[] = [
    {
      key: 'nombre',
      header: 'Producto',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.mlThumbnail && (
            <img src={row.mlThumbnail} alt="" className="w-9 h-9 rounded-lg object-cover bg-slate-100 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{row.mlTitle}</p>
            <p className="text-[10px] text-slate-400">
              {row.productoSku || row.mlSku || row.listings[0]?.mlItemId}
              {!row.vinculado && (
                <span className="ml-1 text-orange-500 font-medium">Sin vincular</span>
              )}
              {row.listings.length > 1 && (
                <span className="ml-1 text-slate-400">· {row.listings.length} pub.</span>
              )}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (row) => <ListingTypeBadges row={row} />,
    },
    {
      key: 'precio',
      header: 'Precio ML',
      sortable: true,
      render: (row) => <InlinePriceCell row={row} />,
    },
    {
      key: 'costo',
      header: 'Costo CTRU',
      sortable: true,
      hideOnMobile: true,
      render: (row) => (
        row.costoTotal != null
          ? <span className="text-xs text-slate-600">{fmtPEN(row.costoTotal)}</span>
          : <span className="text-slate-300">—</span>
      ),
    },
    {
      key: 'margen',
      header: 'Margen',
      sortable: true,
      render: (row) => (
        <div className={getMarginBg(row.margenNeto)}>
          <span className={`text-xs font-semibold ${getMarginColor(row.margenNeto)}`}>
            {fmtPct(row.margenNeto)}
          </span>
        </div>
      ),
    },
    {
      key: 'buybox',
      header: 'Buy Box',
      sortable: true,
      render: (row) => <BuyBoxMini row={row} />,
    },
    {
      key: 'margenBB',
      header: 'Margen @ BB',
      hideOnMobile: true,
      render: (row) => (
        row.margenAtBuyBoxPrice != null ? (
          <span className={`text-xs font-semibold ${getMarginColor(row.margenAtBuyBoxPrice)} ${getMarginBg(row.margenAtBuyBoxPrice)} px-1.5 py-0.5 rounded`}>
            {fmtPct(row.margenAtBuyBoxPrice)}
          </span>
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        )
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'right',
      width: 'w-20',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onOpenDetail(row); }}
            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
            title="Ver detalle de pricing"
          >
            <Eye className="w-4 h-4" />
          </button>
          <a
            href={row.mlPermalink}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
            title="Ver en ML"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      ),
    },
  ];

  // Traducir sortField a key de columna para el DataTable
  const activeSortKey = SORT_FIELD_KEY[sortField];

  // Traducir onSort del DataTable de vuelta al tipo SortField del padre
  const handleSort = (key: string) => {
    const field = Object.entries(SORT_FIELD_KEY).find(([, v]) => v === key)?.[0] as SortField | undefined;
    if (field) onSort(field);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <DataTable<PricingIntelRow>
        columns={columns}
        data={rows}
        keyExtractor={(row) => row.groupKey}
        sortBy={activeSortKey}
        sortDirection={sortDir}
        onSort={handleSort}
        selectable
        selectedKeys={selectedIds}
        onToggleSelect={onToggleSelect}
        onToggleSelectAll={onSelectAll}
        emptyMessage="No se encontraron productos con los filtros seleccionados"
      />
    </div>
  );
};
