/**
 * EntidadCCCardCanonico — chk5.D-S3.bis · SF2
 *
 * Row de entidad para el listado CC · pixel-perfect canon MOCK 8 §1.
 * Reemplaza al legacy `EntidadCCCard.tsx` (eliminado en chk5.D-S5 · 2026-05-16).
 *
 * Estructura por row:
 *   [Avatar circular gradient color tipo] [Nombre + badges] [Meta + aging bar] [Monto + estado] [→]
 *
 * Badges contextuales:
 *   - "Top deudor" (emerald) · primer cliente con mayor saldo
 *   - "USD" (blue) · cuando tiene saldoUSD > 0
 *   - "Vence Xd" (rose) · cuando dias hasta vencimiento ≤ 7
 *   - "Recaudador" (purple) · colaborador con producto financiero recaudadora
 *   - "Reembolso TC" (indigo) · empleado con saldoUSD positivo (CEO Amex)
 *   - "90% envíos" (amber) · % de envíos manejados (colaborador logístico)
 *
 * Variantes especiales (renderizadas vía slots):
 *   - Multi-canal · chips canales activos (YAPE/PLIN/POS/CASH con %)
 *     · sólo si la CC es de colaborador recaudador
 */

import React from 'react';
import { ChevronRight, Smartphone, CreditCard, Banknote } from 'lucide-react';
import type { CuentaCorriente } from '../../../../types/cuentaCorriente.types';
import {
  obtenerIniciales,
  calcularAgingHeuristico,
  TIPO_ENTIDAD_COLOR,
  type AgingBuckets,
} from './ccHelpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface EntidadCCBadge {
  label: string;
  color: 'emerald' | 'rose' | 'purple' | 'indigo' | 'amber' | 'blue' | 'cyan';
}

export interface CanalRecaudacionResumen {
  /** Tipo canal · matcha con CanalAceptado.tipo */
  tipo: 'yape' | 'plin' | 'pos_niubiz' | 'pos_izipay' | 'efectivo' | 'transferencia' | 'otro' | string;
  /** Porcentaje del volumen recaudado en este canal */
  pct: number;
  /** Label corto · default = tipo upper */
  label?: string;
}

export interface EntidadCCCardCanonicoProps {
  cc: CuentaCorriente;
  /** Tipo de cambio actual para mostrar equivalente PEN cuando hay USD */
  tcpa?: number;
  /** Badges contextuales adicionales (ej. "Top deudor" calculado por el padre) */
  badges?: EntidadCCBadge[];
  /** Aging buckets · si se pasan se renderiza la barra de aging detallada
   *  Si no, se usa heurística simple basada en fechaUltimoMovimiento */
  aging?: AgingBuckets;
  /** Meta secundaria · ej "RUC 20567890123 · 4 facturas abiertas · F-001 (61d)" */
  meta?: string;
  /** Canales activos para colaboradores recaudadores · render chips multi-canal */
  canales?: CanalRecaudacionResumen[];
  /** Label estado en el monto · ej "F-001 vence 61d" · "Al día" · "Pendiente liquidar" */
  estadoLabel?: string;
  /** Color del estado label */
  estadoColor?: 'emerald' | 'rose' | 'amber' | 'purple' | 'slate';
  /** Click handler · abre drawer detalle */
  onClick: () => void;
  /** Highlight sutil (top deudor · bg-emerald-50/20) */
  highlight?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════
// MAPS canon · Tailwind classes estáticas (no string interpolation)
// ═════════════════════════════════════════════════════════════════════════

const AVATAR_GRADIENT: Record<
  ReturnType<typeof tipoColor>,
  string
> = {
  emerald: 'bg-gradient-to-br from-emerald-500 to-emerald-700 ring-2 ring-emerald-100',
  rose: 'bg-gradient-to-br from-rose-500 to-rose-700 ring-2 ring-rose-100',
  purple: 'bg-gradient-to-br from-purple-500 to-purple-700 ring-2 ring-purple-100',
  indigo: 'bg-gradient-to-br from-indigo-500 to-indigo-700 ring-2 ring-indigo-100',
  amber: 'bg-gradient-to-br from-amber-500 to-amber-700 ring-2 ring-amber-100',
};

const HOVER_BG: Record<ReturnType<typeof tipoColor>, string> = {
  emerald: 'hover:bg-emerald-50/30',
  rose: 'hover:bg-rose-50/30',
  purple: 'hover:bg-purple-50/30',
  indigo: 'hover:bg-indigo-50/30',
  amber: 'hover:bg-amber-50/30',
};

const HIGHLIGHT_BG: Record<ReturnType<typeof tipoColor>, string> = {
  emerald: 'bg-emerald-50/20',
  rose: 'bg-rose-50/20',
  purple: 'bg-purple-50/20',
  indigo: 'bg-indigo-50/20',
  amber: 'bg-amber-50/20',
};

const MONTO_COLOR: Record<ReturnType<typeof tipoColor>, string> = {
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
  purple: 'text-purple-700',
  indigo: 'text-indigo-700',
  amber: 'text-amber-700',
};

const BADGE_BG: Record<EntidadCCBadge['color'], string> = {
  emerald: 'bg-emerald-100 text-emerald-700',
  rose: 'bg-rose-100 text-rose-700',
  purple: 'bg-purple-100 text-purple-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
  cyan: 'bg-cyan-100 text-cyan-700',
};

const ESTADO_COLOR_MAP: Record<NonNullable<EntidadCCCardCanonicoProps['estadoColor']>, string> = {
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
  amber: 'text-amber-700',
  purple: 'text-purple-700',
  slate: 'text-slate-500',
};

// ═════════════════════════════════════════════════════════════════════════
// CANALES · maps canon multi-canal mockup
// ═════════════════════════════════════════════════════════════════════════

const CANAL_CONFIG: Record<
  string,
  { label: string; color: 'purple' | 'cyan' | 'amber' | 'emerald' | 'rose' | 'indigo'; icon: 'smartphone' | 'credit-card' | 'banknote' }
> = {
  yape: { label: 'YAPE', color: 'purple', icon: 'smartphone' },
  plin: { label: 'PLIN', color: 'cyan', icon: 'smartphone' },
  pos_niubiz: { label: 'POS', color: 'amber', icon: 'credit-card' },
  pos_izipay: { label: 'POS', color: 'amber', icon: 'credit-card' },
  efectivo: { label: 'CASH', color: 'emerald', icon: 'banknote' },
  transferencia: { label: 'TRANS', color: 'indigo', icon: 'credit-card' },
  otro: { label: 'OTRO', color: 'rose', icon: 'banknote' },
};

const CANAL_CHIP_BG: Record<string, string> = {
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
  cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rose: 'bg-rose-100 text-rose-700 border-rose-200',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function tipoColor(cc: CuentaCorriente): 'emerald' | 'rose' | 'purple' | 'indigo' | 'amber' {
  return TIPO_ENTIDAD_COLOR[cc.tipo];
}

const fmt0 = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function formatMontoPrincipal(cc: CuentaCorriente): { texto: string; equiv?: string } {
  const pen = Math.abs(cc.saldoPEN || 0);
  const usd = Math.abs(cc.saldoUSD || 0);
  // Si tiene USD > 0 y PEN cercano a 0 · mostrar como USD principal
  if (usd > 0.01 && pen < 0.01) {
    return { texto: `$ ${fmt0(usd)}` };
  }
  // Si tiene ambos · PEN principal · USD como equiv en pequeño
  if (usd > 0.01 && pen > 0.01) {
    return {
      texto: `S/ ${fmt0(pen)}`,
      equiv: `+ $ ${fmt0(usd)}`,
    };
  }
  return { texto: `S/ ${fmt0(pen)}` };
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const EntidadCCCardCanonico: React.FC<EntidadCCCardCanonicoProps> = ({
  cc,
  badges = [],
  aging,
  meta,
  canales,
  estadoLabel,
  estadoColor = 'slate',
  onClick,
  highlight = false,
}) => {
  const color = tipoColor(cc);
  const iniciales = obtenerIniciales(cc.entidadNombre);
  const monto = formatMontoPrincipal(cc);
  const agingResuelto = aging ?? calcularAgingHeuristico(cc);
  const tieneAging = agingResuelto.pct0a30 + agingResuelto.pct31a60 + agingResuelto.pct60plus > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-6 py-3 flex items-center gap-3 text-left transition-colors ${
        HOVER_BG[color]
      } ${highlight ? HIGHLIGHT_BG[color] : ''}`}
    >
      {/* Avatar circular con iniciales */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 ${AVATAR_GRADIENT[color]}`}
      >
        {iniciales}
      </div>

      {/* Cuerpo central */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-bold text-slate-900 truncate">
            {cc.entidadNombre}
          </span>
          {badges.map((b, idx) => (
            <span
              key={`${b.label}-${idx}`}
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap ${BADGE_BG[b.color]}`}
            >
              {b.label}
            </span>
          ))}
        </div>
        {meta && (
          <div className="text-[11px] text-slate-500 truncate">{meta}</div>
        )}

        {/* Aging bar mini · 3 segmentos */}
        {tieneAging && (
          <>
            <div className="flex items-center gap-0.5 mt-1.5 max-w-xs">
              {agingResuelto.pct0a30 > 0 && (
                <div
                  className={`h-1.5 bg-emerald-400 ${
                    agingResuelto.pct31a60 === 0 && agingResuelto.pct60plus === 0
                      ? 'rounded'
                      : 'rounded-l'
                  }`}
                  style={{ width: `${agingResuelto.pct0a30}%` }}
                  title={`0-30d: ${agingResuelto.pct0a30}%`}
                />
              )}
              {agingResuelto.pct31a60 > 0 && (
                <div
                  className={`h-1.5 bg-amber-400 ${
                    agingResuelto.pct0a30 === 0 && agingResuelto.pct60plus === 0
                      ? 'rounded'
                      : agingResuelto.pct0a30 === 0
                      ? 'rounded-l'
                      : agingResuelto.pct60plus === 0
                      ? 'rounded-r'
                      : ''
                  }`}
                  style={{ width: `${agingResuelto.pct31a60}%` }}
                  title={`31-60d: ${agingResuelto.pct31a60}%`}
                />
              )}
              {agingResuelto.pct60plus > 0 && (
                <div
                  className={`h-1.5 bg-rose-500 ${
                    agingResuelto.pct0a30 === 0 && agingResuelto.pct31a60 === 0
                      ? 'rounded'
                      : 'rounded-r'
                  }`}
                  style={{ width: `${agingResuelto.pct60plus}%` }}
                  title={`+60d: ${agingResuelto.pct60plus}%`}
                />
              )}
            </div>
            <div className="flex gap-2 text-[9px] mt-0.5 flex-wrap">
              {agingResuelto.pct0a30 > 0 && (
                <span className="text-emerald-700">
                  {agingResuelto.pct0a30}% 0-30d
                  {agingResuelto.pct31a60 === 0 && agingResuelto.pct60plus === 0 && ' ✓'}
                </span>
              )}
              {agingResuelto.pct31a60 > 0 && (
                <span className="text-amber-700">{agingResuelto.pct31a60}% 31-60d</span>
              )}
              {agingResuelto.pct60plus > 0 && (
                <span className="text-rose-700 font-bold">
                  {agingResuelto.pct60plus}% +60d ⚠️
                </span>
              )}
            </div>
          </>
        )}

        {/* Canales multi-canal · sólo si se pasan */}
        {canales && canales.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            <span className="text-[9px] text-slate-500 mr-1">Canales:</span>
            {canales.map((c) => {
              const cfg = CANAL_CONFIG[c.tipo] ?? CANAL_CONFIG.otro;
              const IconComp =
                cfg.icon === 'smartphone' ? Smartphone : cfg.icon === 'credit-card' ? CreditCard : Banknote;
              return (
                <span
                  key={c.tipo}
                  className={`text-[9px] border px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 ${CANAL_CHIP_BG[cfg.color]}`}
                >
                  <IconComp className="w-2 h-2" />
                  {c.label ?? cfg.label} {Math.round(c.pct)}%
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Monto + estado · derecha */}
      <div className="text-right flex-shrink-0">
        <div className={`text-[16px] font-bold tabular-nums ${MONTO_COLOR[color]}`}>
          {monto.texto}
        </div>
        {monto.equiv && (
          <div className={`text-[10px] tabular-nums ${MONTO_COLOR[color]}/70`}>
            {monto.equiv}
          </div>
        )}
        {estadoLabel && (
          <div className={`text-[10px] ${ESTADO_COLOR_MAP[estadoColor]}`}>
            {estadoLabel}
          </div>
        )}
      </div>

      {/* Chevron */}
      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
    </button>
  );
};
