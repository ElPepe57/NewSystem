/**
 * DriverChip · L3 · F4 · capa de medición #4.
 *
 * Chip del DRIVER DE DEMANDA (solo subtipo='manual'): qué variable fuera de sistema
 * disparó el pedido de instinto (TikTok/Facebook/Marketplace/Promoción/Otro). Fuente
 * única para que el driver — antes texto libre invisible — sea VISIBLE y queryable en
 * las listas. Mismos íconos que el selector del PanelDecisionRequerimiento.
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
  driver: DriverDemanda;
  size?: 'xs' | 'sm';
}

export const DriverChip: React.FC<Props> = ({ driver, size = 'sm' }) => {
  const Icon = DRIVER_ICON[driver];
  const sz = size === 'xs'
    ? 'text-[10px] px-1.5 py-0.5 gap-1'
    : 'text-[11px] px-2 py-0.5 gap-1';
  const ic = size === 'xs' ? 10 : 11;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium bg-white text-slate-600 ring-1 ring-slate-300 ${sz}`}
      title={`Driver: ${LABEL_DRIVER_DEMANDA[driver]}`}
    >
      <Icon style={{ width: ic, height: ic }} />
      {LABEL_DRIVER_DEMANDA[driver]}
    </span>
  );
};

export default DriverChip;
