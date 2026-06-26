/**
 * DriverSelector · L3 · F4 · capa de medición #4.
 *
 * Selector toggle del DRIVER DE DEMANDA (subtipo='manual'): qué variable fuera de sistema
 * (TikTok/Facebook/Marketplace/Promoción/Otro) disparó el pedido de instinto. Estructurado
 * (no texto libre) para alimentar el scorecard de acierto por driver. Mismos íconos que el
 * DriverChip y el PanelDecisionRequerimiento. Reutilizable entre el form de creación y el
 * panel recomendador.
 */
import React from 'react';
import { Video, Facebook, ShoppingBag, Tag, MoreHorizontal } from 'lucide-react';
import { LABEL_DRIVER_DEMANDA } from '../../../types/requerimiento.types';
import type { DriverDemanda } from '../../../types/requerimiento.types';

const DRIVER_ICON: Record<DriverDemanda, React.ComponentType<{ style?: React.CSSProperties }>> = {
  tiktok: Video,
  facebook: Facebook,
  marketplace: ShoppingBag,
  promocion: Tag,
  otro: MoreHorizontal,
};

interface Props {
  value?: DriverDemanda;
  onChange: (driver: DriverDemanda) => void;
}

export const DriverSelector: React.FC<Props> = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {(Object.keys(LABEL_DRIVER_DEMANDA) as DriverDemanda[]).map((d) => {
      const Icon = DRIVER_ICON[d];
      const activo = value === d;
      const activoCls =
        d === 'tiktok'
          ? 'bg-pink-600 text-white ring-1 ring-pink-700'
          : 'bg-blue-600 text-white ring-1 ring-blue-700';
      return (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={`h-8 px-3 rounded-lg text-[11px] flex items-center gap-1.5 ${
            activo
              ? `font-bold ${activoCls}`
              : 'font-medium text-slate-600 bg-white ring-1 ring-slate-300 hover:bg-slate-50'
          }`}
        >
          <Icon style={{ width: 11, height: 11 }} />
          {LABEL_DRIVER_DEMANDA[d]}
        </button>
      );
    })}
  </div>
);

export default DriverSelector;
