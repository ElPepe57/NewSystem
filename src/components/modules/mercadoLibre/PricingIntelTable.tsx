/**
 * Tabla desktop del Panel de Pricing Inteligente.
 * Muestra productos ML agrupados con datos de costo CTRU, márgenes, y Buy Box.
 */

import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Edit3,
  Check,
  X,
  RefreshCw,
  ExternalLink,
  Eye,
} from 'lucide-react';
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

// ---- HEADER CON SORT ----
const SortHeader: React.FC<{
  label: string;
  field: SortField;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}> = ({ label, field, currentField, currentDir, onSort, className = '' }) => {
  const active = currentField === field;
  return (
    <th
      className={`text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 cursor-pointer hover:text-gray-700 select-none ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active ? (
          currentDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <span className="w-3 h-3" />
        )}
      </div>
    </th>
  );
};

// ---- BUY BOX MINI BADGE ----
const BuyBoxMini: React.FC<{ row: PricingIntelRow }> = ({ row }) => {
  if (!row.hasCatalogo || !row.buyBoxStatus) {
    return <span className="text-gray-300 text-xs">—</span>;
  }

  const cfg: Record<string, { label: string; bg: string; text: string }> = {
    winning: { label: 'GANANDO', bg: 'bg-green-50', text: 'text-green-700' },
    competing: { label: 'PERDIENDO', bg: 'bg-red-50', text: 'text-red-700' },
    sharing_first_place: { label: 'COMPARTIDO', bg: 'bg-yellow-50', text: 'text-yellow-700' },
    listed: { label: 'SIN COMPETIR', bg: 'bg-gray-100', text: 'text-gray-500' },
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
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">CAT</span>
    )}
    {row.hasClasica && (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">CLA</span>
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
      // Update ALL listings in the group
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
        <span className="text-xs text-gray-400">S/</span>
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
            <button onClick={handleSave} className="p-0.5 text-green-600 hover:bg-green-50 rounded">
              <Check className="w-3 h-3" />
            </button>
            <button onClick={() => setEditing(false)} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
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
      className="group flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-amber-600"
      title="Editar precio en ML"
    >
      {fmtPEN(row.mlPrice)}
      <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
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
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.groupKey));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="w-10 px-3 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
              />
            </th>
            <SortHeader label="Producto" field="nombre" currentField={sortField} currentDir={sortDir} onSort={onSort} />
            <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Tipo</th>
            <SortHeader label="Precio ML" field="precio" currentField={sortField} currentDir={sortDir} onSort={onSort} />
            <SortHeader label="Costo CTRU" field="costo" currentField={sortField} currentDir={sortDir} onSort={onSort} />
            <SortHeader label="Margen" field="margen" currentField={sortField} currentDir={sortDir} onSort={onSort} />
            <SortHeader label="Buy Box" field="buybox" currentField={sortField} currentDir={sortDir} onSort={onSort} />
            <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Margen @ BB</th>
            <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3 w-20">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.groupKey} className="hover:bg-gray-50">
              <td className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(row.groupKey)}
                  onChange={() => onToggleSelect(row.groupKey)}
                  className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {row.mlThumbnail && (
                    <img src={row.mlThumbnail} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{row.mlTitle}</p>
                    <p className="text-[10px] text-gray-400">
                      {row.productoSku || row.mlSku || row.listings[0]?.mlItemId}
                      {!row.vinculado && (
                        <span className="ml-1 text-orange-500 font-medium">Sin vincular</span>
                      )}
                      {row.listings.length > 1 && (
                        <span className="ml-1 text-gray-400">· {row.listings.length} pub.</span>
                      )}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <ListingTypeBadges row={row} />
              </td>
              <td className="px-4 py-3">
                <InlinePriceCell row={row} />
              </td>
              <td className="px-4 py-3 text-xs text-gray-600">
                {row.costoTotal != null ? fmtPEN(row.costoTotal) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className={`px-4 py-3 ${getMarginBg(row.margenNeto)}`}>
                <span className={`text-xs font-semibold ${getMarginColor(row.margenNeto)}`}>
                  {fmtPct(row.margenNeto)}
                </span>
              </td>
              <td className="px-4 py-3">
                <BuyBoxMini row={row} />
              </td>
              <td className="px-4 py-3">
                {row.margenAtBuyBoxPrice != null ? (
                  <span className={`text-xs font-semibold ${getMarginColor(row.margenAtBuyBoxPrice)} ${getMarginBg(row.margenAtBuyBoxPrice)} px-1.5 py-0.5 rounded`}>
                    {fmtPct(row.margenAtBuyBoxPrice)}
                  </span>
                ) : (
                  <span className="text-gray-300 text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => onOpenDetail(row)}
                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    title="Ver detalle de pricing"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <a
                    href={row.mlPermalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    title="Ver en ML"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-8">No se encontraron productos con los filtros seleccionados</p>
      )}
    </div>
  );
};
