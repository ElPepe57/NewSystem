import React from 'react';
import type { MLProductMap } from '../../types/mercadoLibre.types';

export const BuyBoxBadge: React.FC<{ listing: MLProductMap }> = ({ listing }) => {
  if (listing.mlListingType !== 'catalogo' || !listing.buyBoxStatus) {
    return <span className="text-slate-300 text-xs">—</span>;
  }

  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    winning: { label: 'GANANDO', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    competing: { label: 'PERDIENDO', bg: 'bg-red-50', text: 'text-red-700' },
    sharing_first_place: { label: 'COMPARTIENDO', bg: 'bg-yellow-50', text: 'text-yellow-700' },
    listed: { label: 'SIN COMPETIR', bg: 'bg-slate-100', text: 'text-slate-500' },
  };

  const cfg = statusConfig[listing.buyBoxStatus] || statusConfig.listed;

  return (
    <div className="space-y-0.5">
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
        {cfg.label}
      </span>
      {listing.buyBoxStatus === 'competing' && listing.buyBoxPriceToWin != null && (
        <p className="text-[10px] text-red-500">
          Precio p/ganar: S/ {listing.buyBoxPriceToWin.toFixed(2)}
        </p>
      )}
      {listing.buyBoxStatus === 'competing' && listing.buyBoxWinnerPrice != null && (
        <p className="text-[10px] text-slate-400">
          Ganador: S/ {listing.buyBoxWinnerPrice.toFixed(2)}
        </p>
      )}
    </div>
  );
};
