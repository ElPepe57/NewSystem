/**
 * OrigenBadge · L3 · F4 · capa de medición #4.
 *
 * Badge unificado del ORIGEN/subtipo de un requerimiento, con color SEMÁNTICO fijo
 * (no el color del módulo): demanda=emerald · restock=sky · apuesta=indigo · manual=slate.
 * Fuente única para que el modelo evolucionado (4 orígenes) sea VISIBLE en todas las
 * superficies de lista (Tablero · Acordeón · Pendientes) — antes eran "datos fantasma"
 * que solo se veían al abrir el detalle.
 */
import React from 'react';
import { Users, Cpu, Sparkles, SlidersHorizontal } from 'lucide-react';
import { resolverLente } from '../panelDecision.helper';
import type { OrigenRequerimiento, OrigenSubtipo } from '../../../types/requerimiento.types';

const CFG: Record<
  ReturnType<typeof resolverLente>,
  { label: string; cls: string; Icon: React.ComponentType<{ style?: React.CSSProperties }> }
> = {
  demanda_comprometida: { label: 'Demanda', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', Icon: Users },
  restock: { label: 'Restock', cls: 'bg-sky-50 text-sky-700 ring-sky-200', Icon: Cpu },
  apuesta: { label: 'Apuesta', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200', Icon: Sparkles },
  manual: { label: 'Manual', cls: 'bg-slate-100 text-slate-600 ring-slate-300', Icon: SlidersHorizontal },
};

interface Props {
  origen: OrigenRequerimiento;
  subtipo?: OrigenSubtipo;
  size?: 'xs' | 'sm';
  /** Oculta el texto y deja solo el ícono (para filas muy densas). */
  iconOnly?: boolean;
}

export const OrigenBadge: React.FC<Props> = ({ origen, subtipo, size = 'sm', iconOnly = false }) => {
  const lente = resolverLente({ origen, subtipo });
  const { label, cls, Icon } = CFG[lente];
  const sz = size === 'xs'
    ? 'text-[10px] px-1.5 py-0.5 gap-1'
    : 'text-[11px] px-2 py-0.5 gap-1';
  const ic = size === 'xs' ? 10 : 11;

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ring-1 ${cls} ${iconOnly ? 'px-1 py-1' : sz}`}
      title={label}
    >
      <Icon style={{ width: ic, height: ic }} />
      {!iconOnly && label}
    </span>
  );
};

export default OrigenBadge;
