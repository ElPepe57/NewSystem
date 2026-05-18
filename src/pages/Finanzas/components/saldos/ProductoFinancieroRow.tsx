/**
 * ProductoFinancieroRow — chk5.D-S3.ter · SF2
 *
 * Row de producto financiero para el listado Saldos · canon MOCK 6 §1.
 * Pixel-perfect contra `docs/mockups/finanzas-vista-saldos-v5.1.html`.
 *
 * Renderiza UN producto · 6 variantes visuales:
 *   1. cuenta_bancaria      · avatar gradient banco (BCP/IBK/BBVA) · saldo
 *   2. wallet_digital       · avatar gradient wallet (Stripe/MP/PP) · saldo + comisión chip
 *   3. tarjeta_credito      · icon CreditCard amber/AMEX · deuda + vencimiento
 *   4. tarjeta_debito       · icon CreditCard indigo · "(de Pool USD)" + disponible
 *   5. caja_efectivo        · icon Banknote slate · saldo + responsable
 *   6. caja_recaudadora     · avatar gradient purple · pendiente liquidar + breakdown
 *
 * Badges contextuales (resolución desde props o helper):
 *   - "Default PEN" / "Default USD" · cuando es la cuenta default por moneda
 *   - "TC Bimoneda" · cuando esBiMoneda
 *   - "Vence Xd" (rose pulse) · cuando próximo a fecha pago
 *   - "Wallet" · sky para wallets digitales
 *   - "Recaudadora" · purple
 *   - "Reembolso" · indigo para TC personal
 *   - "↗ Pool USD" · amber para TC débito vinculada al pool
 *   - "4.5%+S/0.60" · amber para wallets con comisión
 */

import React from 'react';
import { ChevronRight, CreditCard, Banknote } from 'lucide-react';
import type { ProductoFinancieroUnif, KindProductoSaldo } from './saldosHelpers';
import {
  bancoCortoDe,
  gradientBancoDe,
  kindFinalDe,
  nombreDe,
  saldoPENDe,
  saldoUSDDe,
  esBiMonedaDe,
  monedaPrincipalDe,
  KIND_COLOR,
} from './saldosHelpers';
import type { CuentaCaja } from '../../../../types/tesoreria.types';
import type { TarjetaCredito } from '../../../../types/tarjetaCredito.types';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface ProductoFinancieroBadge {
  label: string;
  color: 'emerald' | 'rose' | 'purple' | 'indigo' | 'amber' | 'sky' | 'slate';
  /** Si true · animate-pulse (alertas urgentes) */
  pulse?: boolean;
}

export interface ProductoFinancieroRowProps {
  producto: ProductoFinancieroUnif;
  /** Badges contextuales adicionales · resueltos por el padre */
  badges?: ProductoFinancieroBadge[];
  /** Meta secundaria · ej "194-1234567-0-12 · BCP · cta corriente · Yape + Plin" */
  meta?: string;
  /** Estado lateral derecha · ej "+S/ 3,200 hoy" · "71% del pool" · "Vence 28-may" */
  estadoLabel?: string;
  /** Color del estado · default slate-500 */
  estadoColor?: 'emerald' | 'rose' | 'amber' | 'purple' | 'sky' | 'indigo' | 'slate';
  /** Click handler · abre drawer detalle */
  onClick: () => void;
  /** Highlight sub-grupo Pool USD · bg-teal-50/10 */
  highlight?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════
// MAPS canon
// ═════════════════════════════════════════════════════════════════════════

const BADGE_BG: Record<ProductoFinancieroBadge['color'], string> = {
  emerald: 'bg-emerald-100 text-emerald-700',
  rose: 'bg-rose-100 text-rose-700',
  purple: 'bg-purple-100 text-purple-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  amber: 'bg-amber-100 text-amber-700',
  sky: 'bg-sky-100 text-sky-700',
  slate: 'bg-slate-100 text-slate-700',
};

const ESTADO_COLOR_MAP: Record<NonNullable<ProductoFinancieroRowProps['estadoColor']>, string> = {
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
  amber: 'text-amber-700',
  purple: 'text-purple-700',
  sky: 'text-sky-700',
  indigo: 'text-indigo-700',
  slate: 'text-slate-500',
};

/** Color del monto principal según tipo de producto · canon mockup */
const MONTO_COLOR: Record<KindProductoSaldo, string> = {
  cuenta_bancaria: 'text-teal-900',
  wallet_digital: 'text-sky-900',
  tarjeta_credito: 'text-amber-900',
  tarjeta_debito: 'text-indigo-900',
  caja_efectivo: 'text-slate-900',
  caja_recaudadora: 'text-purple-900',
};

const HOVER_BG: Record<KindProductoSaldo, string> = {
  cuenta_bancaria: 'hover:bg-slate-50',
  wallet_digital: 'hover:bg-sky-50/30',
  tarjeta_credito: 'hover:bg-amber-50/30',
  tarjeta_debito: 'hover:bg-indigo-50/30',
  caja_efectivo: 'hover:bg-slate-50',
  caja_recaudadora: 'hover:bg-purple-50/30',
};

// ═════════════════════════════════════════════════════════════════════════
// HELPERS · formato
// ═════════════════════════════════════════════════════════════════════════

const fmt0 = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function formatMontoCanonico(
  p: ProductoFinancieroUnif,
): { textoPrincipal: string; textoSecundario?: string } {
  const kind = kindFinalDe(p);
  const pen = saldoPENDe(p);
  const usd = saldoUSDDe(p);

  // TC débito · NO tiene saldo propio · texto "(de Pool USD)"
  if (kind === 'tarjeta_debito') {
    return { textoPrincipal: '(de Pool USD)' };
  }

  // TC bimoneda · muestra ambos saldos
  if (kind === 'tarjeta_credito' && esBiMonedaDe(p)) {
    return {
      textoPrincipal: `−$ ${fmt0(Math.abs(usd))} · −S/ ${fmt0(Math.abs(pen))}`,
    };
  }

  // TC mono USD/PEN
  if (kind === 'tarjeta_credito') {
    const moneda = monedaPrincipalDe(p);
    const monto = moneda === 'USD' ? Math.abs(usd) : Math.abs(pen);
    return {
      textoPrincipal: `−${moneda === 'USD' ? '$' : 'S/'} ${fmt0(monto)}`,
    };
  }

  // Recaudadora · siempre PEN positivo
  if (kind === 'caja_recaudadora') {
    return { textoPrincipal: `S/ ${fmt0(Math.abs(pen))}` };
  }

  // Bi-moneda (no TC) · ej Visa BCP debe · NO debería pasar aquí porque ya cubierto arriba
  if (esBiMonedaDe(p)) {
    return {
      textoPrincipal: `S/ ${fmt0(Math.abs(pen))}`,
      textoSecundario: `$ ${fmt0(Math.abs(usd))}`,
    };
  }

  // Mono moneda · cuenta bancaria · wallet · caja efectivo
  const moneda = monedaPrincipalDe(p);
  if (moneda === 'USD') {
    return { textoPrincipal: `$ ${fmt0(Math.abs(usd))}` };
  }
  return { textoPrincipal: `S/ ${fmt0(Math.abs(pen))}` };
}

/**
 * Devuelve el avatar visual del producto · 40x40 px.
 * Para TC mono · usa icon CreditCard · para TC débito también · CASH = Banknote.
 */
function renderAvatar(p: ProductoFinancieroUnif): React.ReactNode {
  const kind = kindFinalDe(p);
  const gradient = gradientBancoDe(p);
  const banco = bancoCortoDe(p);

  // TC · icon CreditCard
  if (kind === 'tarjeta_credito' || kind === 'tarjeta_debito') {
    return (
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
        style={{ background: gradient }}
      >
        <CreditCard className="w-5 h-5" />
      </div>
    );
  }
  // Caja efectivo · icon Banknote
  if (kind === 'caja_efectivo') {
    return (
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
        style={{ background: gradient }}
      >
        <Banknote className="w-5 h-5" />
      </div>
    );
  }
  // Resto · iniciales del banco
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
      style={{ background: gradient }}
    >
      {banco}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const ProductoFinancieroRow: React.FC<ProductoFinancieroRowProps> = ({
  producto,
  badges = [],
  meta,
  estadoLabel,
  estadoColor = 'slate',
  onClick,
  highlight = false,
}) => {
  const kind = kindFinalDe(producto);
  const monto = formatMontoCanonico(producto);
  const _color = KIND_COLOR[kind];
  void _color; // reservado para futuro

  // Highlight bg para sub-grupo Pool USD (cuenta_bancaria USD en titular Empresa)
  const highlightBg = highlight ? 'bg-teal-50/10' : '';

  // Meta default si no se pasa · construir desde data común
  const metaFinal = meta ?? construirMetaDefault(producto);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-6 py-3 flex items-center gap-3 text-left transition-colors ${HOVER_BG[kind]} ${highlightBg}`}
    >
      {renderAvatar(producto)}

      {/* Cuerpo central */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-bold text-slate-900 truncate">
            {nombreDe(producto)}
          </span>
          {badges.map((b, idx) => (
            <span
              key={`${b.label}-${idx}`}
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap ${BADGE_BG[b.color]} ${
                b.pulse ? 'animate-pulse' : ''
              }`}
            >
              {b.label}
            </span>
          ))}
        </div>
        {metaFinal && (
          <div className="text-[11px] text-slate-500 truncate tabular-nums">{metaFinal}</div>
        )}
      </div>

      {/* Monto + estado derecha */}
      <div className="text-right flex-shrink-0">
        <div className={`text-[16px] font-bold tabular-nums ${MONTO_COLOR[kind]}`}>
          {monto.textoPrincipal}
        </div>
        {monto.textoSecundario && (
          <div className={`text-[12px] font-bold tabular-nums ${MONTO_COLOR[kind]}/70`}>
            {monto.textoSecundario}
          </div>
        )}
        {estadoLabel && (
          <div className={`text-[10px] ${ESTADO_COLOR_MAP[estadoColor]}`}>
            {estadoLabel}
          </div>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
    </button>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// HELPERS DEFAULT META · construir meta cuando el padre no la pasa explicit
// ═════════════════════════════════════════════════════════════════════════

function construirMetaDefault(p: ProductoFinancieroUnif): string {
  const kind = kindFinalDe(p);

  if (kind === 'tarjeta_credito') {
    const tc = p.kindData as TarjetaCredito;
    const partes: string[] = [];
    if (tc.diaCorte) partes.push(`día corte ${tc.diaCorte}`);
    if (tc.diaPago) partes.push(`día pago ${tc.diaPago}`);
    if (tc.banco) partes.push(tc.banco);
    return partes.join(' · ');
  }

  if (kind === 'caja_recaudadora') {
    if (p.kind === 'caja_recaudadora') {
      const pf = p.kindData;
      const partes: string[] = [];
      if (pf.responsableTerceroNombre) partes.push(pf.responsableTerceroNombre);
      const canalesActivos = pf.canalesAceptados?.filter((c) => c.activo) ?? [];
      if (canalesActivos.length > 0) {
        partes.push(`${canalesActivos.length} ${canalesActivos.length === 1 ? 'canal' : 'canales'}`);
      }
      return partes.join(' · ');
    }
    return '';
  }

  // CuentaCaja
  const c = p.kindData as CuentaCaja;
  const partes: string[] = [];
  if (c.numeroCuenta) partes.push(c.numeroCuenta);
  if (c.banco) partes.push(c.banco);
  if (c.productoFinanciero === 'cuenta_corriente') partes.push('cta corriente');
  if (c.productoFinanciero === 'cuenta_ahorros') partes.push('cta ahorros');
  if (c.productoFinanciero === 'tarjeta_debito') {
    partes.push('Vinculada · NO saldo propio · descuenta de Pool USD');
  }
  if (c.canalesDigitales && c.canalesDigitales.length > 0) {
    const labels = c.canalesDigitales
      .map((cd) => cd.tipo.charAt(0).toUpperCase() + cd.tipo.slice(1))
      .join(' + ');
    partes.push(labels);
  }
  return partes.join(' · ');
}
