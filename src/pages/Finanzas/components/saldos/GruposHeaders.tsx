/**
 * GruposHeaders — chk5.D-S3.ter · SF3
 *
 * Headers de grupos para el listado Saldos · canon MOCK 6 §1.
 *
 * Componentes exportados:
 *   - `GrupoTitularHeader`     · header de titular (Empresa · Personal · Recaudador)
 *   - `SubGrupoPoolUSDHeader`  · sub-header agregado dentro de Empresa (Pool USD D13)
 *   - `GrupoGenericoHeader`    · header reutilizable para agrupaciones tipo/moneda/banco
 *
 * Diseño canon v9.0 M1 copy-paste literal del mockup §1.
 */

import React from 'react';
import { Building, User, Truck, DollarSign } from 'lucide-react';
import type { TitularGrupo } from './saldosHelpers';
import { TITULAR_GRUPO_COLOR } from './saldosHelpers';

// ═════════════════════════════════════════════════════════════════════════
// GRUPO TITULAR HEADER
// ═════════════════════════════════════════════════════════════════════════

export interface GrupoTitularHeaderProps {
  grupo: TitularGrupo;
  /** Label completo · ej "Empresa · Vita Skin Peru SAC" · "Personal · José LP (CEO)" */
  label: string;
  /** Cantidad de productos del grupo */
  count: number;
  /** Sub-label monto · ej "S/ 81,420 + $ 4,820" · "−$ 1,240 (reembolso pendiente)" */
  subtotalLabel: string;
  /** Badge especial · ej "⭐ 90% envíos" para colaborador top */
  badgeEspecial?: { label: string; color: 'emerald' | 'amber' | 'rose' };
}

// ─── Maps canon ──────────────────────────────────────────────────────────

const GRUPO_GRADIENT: Record<TitularGrupo, string> = {
  empresa: 'bg-gradient-to-r from-teal-50 to-teal-100/30',
  personal: 'bg-gradient-to-r from-indigo-50 to-indigo-100/30',
  recaudador: 'bg-gradient-to-r from-purple-50 to-purple-100/30',
};

const GRUPO_TEXT: Record<TitularGrupo, string> = {
  empresa: 'text-teal-900',
  personal: 'text-indigo-900',
  recaudador: 'text-purple-900',
};

const GRUPO_ICON_TEXT: Record<TitularGrupo, string> = {
  empresa: 'text-teal-700',
  personal: 'text-indigo-700',
  recaudador: 'text-purple-700',
};

const GRUPO_BADGE_BG: Record<TitularGrupo, string> = {
  empresa: 'bg-teal-100 text-teal-700',
  personal: 'bg-indigo-100 text-indigo-700',
  recaudador: 'bg-purple-100 text-purple-700',
};

const GRUPO_SUBTOTAL_TEXT: Record<TitularGrupo, string> = {
  empresa: 'text-teal-700',
  personal: 'text-indigo-700',
  recaudador: 'text-purple-700',
};

const BADGE_ESPECIAL_BG: Record<NonNullable<GrupoTitularHeaderProps['badgeEspecial']>['color'], string> = {
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-700',
};

const GRUPO_ICON: Record<TitularGrupo, React.ComponentType<{ className?: string }>> = {
  empresa: Building,
  personal: User,
  recaudador: Truck,
};

// ─── Componente ──────────────────────────────────────────────────────────

export const GrupoTitularHeader: React.FC<GrupoTitularHeaderProps> = ({
  grupo,
  label,
  count,
  subtotalLabel,
  badgeEspecial,
}) => {
  const Icon = GRUPO_ICON[grupo];
  // Suprimir warning del const importado pero no usado para validar el color hace match
  void TITULAR_GRUPO_COLOR;

  return (
    <div
      className={`px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap ${GRUPO_GRADIENT[grupo]}`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${GRUPO_ICON_TEXT[grupo]}`} />
        <span className={`text-[12px] font-bold ${GRUPO_TEXT[grupo]}`}>{label}</span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${GRUPO_BADGE_BG[grupo]}`}
        >
          {count} {count === 1 ? 'producto' : 'productos'}
        </span>
        {badgeEspecial && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${BADGE_ESPECIAL_BG[badgeEspecial.color]}`}
          >
            {badgeEspecial.label}
          </span>
        )}
      </div>
      <div className={`text-[11px] tabular-nums font-medium ${GRUPO_SUBTOTAL_TEXT[grupo]}`}>
        {subtotalLabel}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-GRUPO POOL USD HEADER (D13 · vista agregada dentro de Empresa)
// ═════════════════════════════════════════════════════════════════════════

export interface SubGrupoPoolUSDHeaderProps {
  /** Cantidad de cuentas USD físicas que conforman el pool */
  cuentasCount: number;
  /** TCPA único del pool · ej 3.742 */
  tcpa: number;
  /** Total agregado del pool en USD */
  totalUSD: number;
  /** Equivalente PEN aproximado */
  equivPEN: number;
}

export const SubGrupoPoolUSDHeader: React.FC<SubGrupoPoolUSDHeaderProps> = ({
  cuentasCount,
  tcpa,
  totalUSD,
  equivPEN,
}) => {
  const fmt0 = (n: number) =>
    n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return (
    <div className="px-6 py-1.5 bg-teal-50/40 border-y border-teal-200/50 flex items-center justify-between gap-2 flex-wrap">
      <span className="text-[10px] font-bold text-teal-700 flex items-center gap-1">
        <DollarSign className="w-3 h-3" />
        Pool USD · {cuentasCount} {cuentasCount === 1 ? 'cuenta USD física' : 'cuentas USD físicas'} · TCPA único{' '}
        {tcpa > 0 ? tcpa.toFixed(3) : '—'}
      </span>
      <span className="text-[11px] font-bold tabular-nums text-teal-900">
        $ {fmt0(totalUSD)}
        {equivPEN > 0 && <> · ≈ S/ {fmt0(equivPEN)}</>}
      </span>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// GRUPO GENÉRICO HEADER (para agrupaciones por tipo/moneda/banco)
// ═════════════════════════════════════════════════════════════════════════

export interface GrupoGenericoHeaderProps {
  label: string;
  count: number;
  subtotalLabel: string;
  /** Tinte del grupo · canon N1 · default slate */
  color?: 'teal' | 'sky' | 'amber' | 'indigo' | 'slate' | 'purple' | 'emerald' | 'rose';
  /** Icon opcional */
  icon?: React.ComponentType<{ className?: string }>;
}

const GENERICO_BG: Record<NonNullable<GrupoGenericoHeaderProps['color']>, string> = {
  teal: 'bg-teal-50',
  sky: 'bg-sky-50',
  amber: 'bg-amber-50',
  indigo: 'bg-indigo-50',
  slate: 'bg-slate-100',
  purple: 'bg-purple-50',
  emerald: 'bg-emerald-50',
  rose: 'bg-rose-50',
};
const GENERICO_TEXT: Record<NonNullable<GrupoGenericoHeaderProps['color']>, string> = {
  teal: 'text-teal-900',
  sky: 'text-sky-900',
  amber: 'text-amber-900',
  indigo: 'text-indigo-900',
  slate: 'text-slate-900',
  purple: 'text-purple-900',
  emerald: 'text-emerald-900',
  rose: 'text-rose-900',
};
const GENERICO_ICON_TEXT: Record<NonNullable<GrupoGenericoHeaderProps['color']>, string> = {
  teal: 'text-teal-700',
  sky: 'text-sky-700',
  amber: 'text-amber-700',
  indigo: 'text-indigo-700',
  slate: 'text-slate-700',
  purple: 'text-purple-700',
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
};

export const GrupoGenericoHeader: React.FC<GrupoGenericoHeaderProps> = ({
  label,
  count,
  subtotalLabel,
  color = 'slate',
  icon: Icon,
}) => {
  return (
    <div
      className={`px-5 py-2 flex items-center justify-between gap-2 flex-wrap ${GENERICO_BG[color]}`}
    >
      <span className={`text-[12px] font-bold flex items-center gap-1.5 ${GENERICO_TEXT[color]}`}>
        {Icon && <Icon className={`w-3.5 h-3.5 ${GENERICO_ICON_TEXT[color]}`} />}
        {label} ({count})
      </span>
      <span className={`text-[11px] font-bold tabular-nums ${GENERICO_TEXT[color]}`}>
        {subtotalLabel}
      </span>
    </div>
  );
};
