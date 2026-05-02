/**
 * BannerAccionRapida · banner contextual debajo de un Card row
 *
 * Aparece cuando el producto está en estado:
 *   - stock_critico (mockup 10c) → "Reordenar ahora · Stock cubrirá ~5d" + CTA "Crear OC"
 *   - investigacion_vencida (mockup 10d) → "Re-investigar precios · datos +90 días" + CTA "Re-investigar ahora"
 *
 * El banner consume todo el ancho del row (12 cols) y mantiene el border-l-4
 * del estado correspondiente para continuidad visual.
 */

import React from 'react';
import { AlertTriangle, Search } from 'lucide-react';

export type BannerTipo = 'stock_critico' | 'investigacion_vencida';

interface BannerAccionRapidaProps {
  tipo: BannerTipo;
  mensaje: string;
  ctaLabel: string;
  onCta: () => void;
  onSecundaria?: () => void;
  secundariaLabel?: string;
}

const TIPO_STYLES: Record<BannerTipo, { container: string; text: string; cta: string; secundaria: string; icon: typeof AlertTriangle }> = {
  stock_critico: {
    container: 'bg-rose-50 border-l-4 border-rose-500 border-rose-100',
    text: 'text-rose-800',
    cta: 'bg-rose-600 hover:bg-rose-700',
    secundaria: 'text-rose-600 hover:text-rose-700',
    icon: AlertTriangle,
  },
  investigacion_vencida: {
    container: 'bg-amber-50 border-l-4 border-amber-400 border-amber-100',
    text: 'text-amber-800',
    cta: 'bg-amber-600 hover:bg-amber-700',
    secundaria: 'text-amber-600 hover:text-amber-700',
    icon: Search,
  },
};

export const BannerAccionRapida: React.FC<BannerAccionRapidaProps> = ({
  tipo,
  mensaje,
  ctaLabel,
  onCta,
  onSecundaria,
  secundariaLabel,
}) => {
  const styles = TIPO_STYLES[tipo];
  const Icon = styles.icon;

  return (
    <div className={`px-4 py-2 border-t flex items-center justify-between gap-2 ${styles.container}`}>
      <div className={`flex items-center gap-2 text-xs ${styles.text}`}>
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{mensaje}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {onSecundaria && secundariaLabel && (
          <button type="button" onClick={onSecundaria} className={`px-2.5 py-1 text-[10px] font-medium ${styles.secundaria}`}>
            {secundariaLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onCta}
          className={`px-2.5 py-1 text-[10px] font-bold text-white rounded transition-colors ${styles.cta}`}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
};
