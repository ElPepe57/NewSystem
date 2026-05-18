/**
 * GrupoEntidadHeader — chk5.D-S3.bis · SF3
 *
 * Header de grupo de entidad para el listado CC · canon MOCK 8 §1.
 * Renderiza el separador visual entre tipos de entidad (Clientes · Proveedores
 * · Colaboradores · Empleados · Tarjetas de Crédito) con icon · count · badge
 * tipo (CxC/CxP) · subtotal lateral (DSO/DPO o pendiente).
 *
 * Diseño canon v9.0 M1 copy-paste literal de los headers del mockup §1.
 * Tinte gradient sutil por color del tipo · ej "bg-gradient-to-r from-emerald-50".
 */

import React from 'react';
import { UserCheck, Truck, Users, User, CreditCard } from 'lucide-react';
import type { TipoEntidadCC } from '../../../../types/cuentaCorriente.types';
import { TIPO_ENTIDAD_COLOR, TIPO_ENTIDAD_LABEL } from './ccHelpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface GrupoEntidadHeaderProps {
  tipo: TipoEntidadCC;
  /** Cantidad de entidades del grupo · default = ccs?.length */
  count: number;
  /** Label monto principal · ej "S/ 24,180 por cobrar" */
  subtotalLabel: string;
  /** Sub-label adicional · ej "DSO 28d" · "DPO 42d" · undefined oculta */
  meta?: string;
  /** Badge "CxC" / "CxP" / etc · null = oculto */
  badgeRol?: 'CxC' | 'CxP' | 'CC' | null;
}

// ═════════════════════════════════════════════════════════════════════════
// MAPS canon
// ═════════════════════════════════════════════════════════════════════════

const ICON_BY_TIPO: Record<TipoEntidadCC, React.ComponentType<{ className?: string }>> = {
  cliente: UserCheck,
  proveedor: Truck,
  colaborador: Users,
  empleado: User,
  tarjeta_credito: CreditCard,
};

const BG_GRADIENT: Record<ReturnType<typeof colorTipo>, string> = {
  emerald: 'bg-gradient-to-r from-emerald-50 to-emerald-100/30',
  rose: 'bg-gradient-to-r from-rose-50 to-rose-100/30',
  purple: 'bg-gradient-to-r from-purple-50 to-purple-100/30',
  indigo: 'bg-gradient-to-r from-indigo-50 to-indigo-100/30',
  amber: 'bg-gradient-to-r from-amber-50 to-amber-100/30',
};

const ICON_COLOR: Record<ReturnType<typeof colorTipo>, string> = {
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
  purple: 'text-purple-700',
  indigo: 'text-indigo-700',
  amber: 'text-amber-700',
};

const TITLE_COLOR: Record<ReturnType<typeof colorTipo>, string> = {
  emerald: 'text-emerald-900',
  rose: 'text-rose-900',
  purple: 'text-purple-900',
  indigo: 'text-indigo-900',
  amber: 'text-amber-900',
};

const BADGE_BG: Record<ReturnType<typeof colorTipo>, string> = {
  emerald: 'bg-emerald-100 text-emerald-700',
  rose: 'bg-rose-100 text-rose-700',
  purple: 'bg-purple-100 text-purple-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  amber: 'bg-amber-100 text-amber-700',
};

const SUBTOTAL_COLOR: Record<ReturnType<typeof colorTipo>, string> = {
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
  purple: 'text-purple-700',
  indigo: 'text-indigo-700',
  amber: 'text-amber-700',
};

function colorTipo(tipo: TipoEntidadCC) {
  return TIPO_ENTIDAD_COLOR[tipo];
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const GrupoEntidadHeader: React.FC<GrupoEntidadHeaderProps> = ({
  tipo,
  count,
  subtotalLabel,
  meta,
  badgeRol,
}) => {
  const color = colorTipo(tipo);
  const Icon = ICON_BY_TIPO[tipo];

  return (
    <div
      className={`px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap ${BG_GRADIENT[color]}`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${ICON_COLOR[color]}`} />
        <span className={`text-[12px] font-bold ${TITLE_COLOR[color]}`}>
          {TIPO_ENTIDAD_LABEL[tipo]} ({count})
        </span>
        {badgeRol && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${BADGE_BG[color]}`}>
            {badgeRol}
          </span>
        )}
      </div>
      <div className="text-[11px] tabular-nums flex items-center gap-1.5">
        <span className={`font-bold ${SUBTOTAL_COLOR[color]}`}>{subtotalLabel}</span>
        {meta && (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">{meta}</span>
          </>
        )}
      </div>
    </div>
  );
};
