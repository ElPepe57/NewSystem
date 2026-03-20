/**
 * Card mobile del Panel de Pricing Inteligente.
 * Trabaja con filas agrupadas por producto (PricingIntelRow).
 */

import React from 'react';
import { ExternalLink, Eye } from 'lucide-react';
import type { PricingIntelRow } from './pricingIntel.utils';
import { getMarginColor, getMarginBg, fmtPEN, fmtPct } from './pricingIntel.utils';

interface PricingIntelCardProps {
  row: PricingIntelRow;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpenDetail: (row: PricingIntelRow) => void;
}

const BuyBoxMiniMobile: React.FC<{ row: PricingIntelRow }> = ({ row }) => {
  if (!row.hasCatalogo || !row.buyBoxStatus) return null;

  const cfg: Record<string, { label: string; bg: string; text: string }> = {
    winning: { label: 'GANANDO', bg: 'bg-green-50', text: 'text-green-700' },
    competing: { label: 'PERDIENDO', bg: 'bg-red-50', text: 'text-red-700' },
    sharing_first_place: { label: 'COMPARTIDO', bg: 'bg-yellow-50', text: 'text-yellow-700' },
    listed: { label: 'SIN COMPETIR', bg: 'bg-gray-100', text: 'text-gray-500' },
  };
  const c = cfg[row.buyBoxStatus] || cfg.listed;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
        {c.label}
      </span>
      {row.buyBoxStatus === 'competing' && row.buyBoxPriceToWin != null && (
        <span className="text-[10px] text-red-500">
          p/ganar: {fmtPEN(row.buyBoxPriceToWin)}
        </span>
      )}
      {row.margenAtBuyBoxPrice != null && (
        <span className={`text-[10px] font-semibold ${getMarginColor(row.margenAtBuyBoxPrice)}`}>
          (margen: {fmtPct(row.margenAtBuyBoxPrice)})
        </span>
      )}
    </div>
  );
};

export const PricingIntelCard: React.FC<PricingIntelCardProps> = ({
  row,
  selected,
  onToggleSelect,
  onOpenDetail,
}) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(row.groupKey)}
          className="mt-1 rounded border-gray-300 text-amber-500 focus:ring-amber-500 shrink-0"
        />
        {row.mlThumbnail && (
          <img src={row.mlThumbnail} alt="" className="w-12 h-12 rounded-lg object-cover bg-gray-100 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">{row.mlTitle}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {row.hasCatalogo && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">CAT</span>
            )}
            {row.hasClasica && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">CLA</span>
            )}
            <span className="text-[10px] text-gray-400">{row.productoSku || row.mlSku || row.listings[0]?.mlItemId}</span>
            {!row.vinculado && (
              <span className="text-[10px] font-medium text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-full">Sin vincular</span>
            )}
            {row.listings.length > 1 && (
              <span className="text-[10px] text-gray-400">{row.listings.length} pub.</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => onOpenDetail(row)}
            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
          >
            <Eye className="w-4 h-4" />
          </button>
          <a
            href={row.mlPermalink}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Data grid */}
      <div className="grid grid-cols-3 gap-px bg-gray-100 border-t border-gray-100">
        <div className="bg-white px-3 py-2">
          <p className="text-[10px] text-gray-400 uppercase">Precio ML</p>
          <p className="text-sm font-semibold text-gray-900">{fmtPEN(row.mlPrice)}</p>
        </div>
        <div className="bg-white px-3 py-2">
          <p className="text-[10px] text-gray-400 uppercase">Costo CTRU</p>
          <p className="text-sm font-semibold text-gray-600">
            {row.costoTotal != null ? fmtPEN(row.costoTotal) : '—'}
          </p>
        </div>
        <div className={`bg-white px-3 py-2 ${getMarginBg(row.margenNeto)}`}>
          <p className="text-[10px] text-gray-400 uppercase">Margen</p>
          <p className={`text-sm font-semibold ${getMarginColor(row.margenNeto)}`}>
            {fmtPct(row.margenNeto)}
          </p>
        </div>
      </div>

      {/* Buy Box row */}
      {row.hasCatalogo && row.buyBoxStatus && (
        <div className="border-t border-gray-100 px-3 py-2">
          <BuyBoxMiniMobile row={row} />
        </div>
      )}
    </div>
  );
};
