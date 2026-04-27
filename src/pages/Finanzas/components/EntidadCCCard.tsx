/**
 * EntidadCCCard — S56 · Card de entidad financiera
 *
 * Inspirada en `CompraCard` (S54.x referencia canónica): layout dual
 * @container con NARROW (stack vertical) y WIDE (12-col con dividers).
 *
 * Cada card representa UNA cuenta corriente de UNA entidad
 * (cliente / proveedor / colaborador / empleado) con:
 *   - Avatar con iniciales + tipo
 *   - Estado contextual (al día / vencido / saldo a favor / etc)
 *   - Saldo destacado en moneda principal
 *   - Resumen de documentos asociados
 *   - Acciones inline (Cobrar / Pagar / Aplicar saldo)
 *
 * Click en card → abre EntidadCCDetailModal (Fase 2).
 * Click en CTA → dispara acción correspondiente.
 */

import React, { useMemo } from 'react';
import {
  ArrowRight,
  CircleDot,
  Clock,
  CheckCircle2,
  Coins,
  CircleDollarSign,
  HandCoins,
  Building,
  Users as UsersIcon,
  Truck,
  IdCard,
} from 'lucide-react';
import { cn } from '../../../design-system';
import type {
  CuentaCorriente,
  TipoEntidadCC,
} from '../../../types/cuentaCorriente.types';
import { TIPO_ENTIDAD_CC_LABELS } from '../../../types/cuentaCorriente.types';

interface EntidadCCCardProps {
  cc: CuentaCorriente;
  /** Click en cualquier área no-acción → abre detalle. */
  onView?: () => void;
  /** Click en CTA principal contextual (Pagar/Cobrar/Aplicar). */
  onAccionPrincipal?: () => void;
  className?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function inicial(nombre: string): string {
  if (!nombre) return '?';
  const parts = nombre.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const ICONO_TIPO: Record<TipoEntidadCC, React.ComponentType<{ className?: string }>> = {
  cliente: UsersIcon,
  proveedor: Building,
  colaborador: Truck,
  empleado: IdCard,
};

const COLOR_TIPO: Record<TipoEntidadCC, { bg: string; text: string; badge: string }> = {
  cliente: { bg: 'bg-sky-100', text: 'text-sky-700', badge: 'bg-sky-100 text-sky-700' },
  proveedor: { bg: 'bg-amber-100', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  colaborador: { bg: 'bg-purple-100', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
  empleado: { bg: 'bg-emerald-100', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
};

/** Calcula el saldo dominante (el de mayor magnitud absoluta) y su moneda. */
function getSaldoDominante(cc: CuentaCorriente): {
  monto: number;
  moneda: 'PEN' | 'USD';
  signo: 'positivo' | 'negativo' | 'cero';
} {
  const absUSD = Math.abs(cc.saldoUSD);
  const absPEN = Math.abs(cc.saldoPEN);

  if (absUSD < 0.01 && absPEN < 0.01) {
    return { monto: 0, moneda: 'PEN', signo: 'cero' };
  }
  if (absUSD >= absPEN) {
    return {
      monto: cc.saldoUSD,
      moneda: 'USD',
      signo: cc.saldoUSD > 0 ? 'positivo' : 'negativo',
    };
  }
  return {
    monto: cc.saldoPEN,
    moneda: 'PEN',
    signo: cc.saldoPEN > 0 ? 'positivo' : 'negativo',
  };
}

/** Estado contextual: al día / vencido / saldo a favor / saldada / etc. */
function getEstadoContextual(cc: CuentaCorriente): {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  classes: string;
  pulse?: boolean;
} {
  const saldoDominante = getSaldoDominante(cc);

  if (saldoDominante.signo === 'cero') {
    return {
      label: 'Saldada',
      icon: CheckCircle2,
      classes: 'bg-slate-50 text-slate-600 border-slate-200',
    };
  }

  // Días desde último movimiento
  const diasUltimoMov = cc.fechaUltimoMovimiento
    ? Math.floor(
        (Date.now() - cc.fechaUltimoMovimiento.toMillis()) / (1000 * 60 * 60 * 24),
      )
    : 0;

  // Saldo a favor: cliente con saldo negativo, o cualquier otro tipo con saldo positivo
  // que no represente "deuda activa" (heurística simple).
  if (cc.tipo === 'cliente' && saldoDominante.signo === 'negativo') {
    return {
      label: 'Saldo a favor',
      icon: Coins,
      classes: 'bg-purple-50 text-purple-700 border-purple-200',
    };
  }

  // Vencido (>30 días sin actividad para entidades con saldo)
  if (diasUltimoMov > 30) {
    return {
      label: `Vencido ${diasUltimoMov}d`,
      icon: Clock,
      classes: 'bg-red-50 text-red-700 border-red-200',
      pulse: true,
    };
  }

  if (diasUltimoMov > 7) {
    return {
      label: `${diasUltimoMov}d sin act.`,
      icon: Clock,
      classes: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }

  return {
    label: 'Al día',
    icon: CircleDot,
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
}

/** CTA principal contextual según el saldo dominante y el tipo. */
function getCTAPrincipal(
  cc: CuentaCorriente,
): {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  classes: string;
} | null {
  const saldoDominante = getSaldoDominante(cc);

  if (saldoDominante.signo === 'cero') return null; // sin acción si saldada

  // Saldo a favor (cliente con saldo negativo) → ofrecer aplicar
  if (cc.tipo === 'cliente' && saldoDominante.signo === 'negativo') {
    return {
      label: 'Aplicar',
      icon: HandCoins,
      classes: 'bg-white border border-purple-300 text-purple-700 hover:bg-purple-50',
    };
  }

  // Saldo positivo (entidad nos debe) → cobrar
  if (saldoDominante.signo === 'positivo') {
    return {
      label: 'Cobrar',
      icon: CircleDollarSign,
      classes: 'bg-emerald-600 text-white hover:bg-emerald-700',
    };
  }

  // Saldo negativo (le debemos) → pagar
  return {
    label: 'Pagar',
    icon: CircleDollarSign,
    classes: 'bg-red-600 text-white hover:bg-red-700',
  };
}

function fmtSaldo(monto: number, moneda: 'PEN' | 'USD'): string {
  const simbolo = moneda === 'USD' ? 'US$' : 'S/';
  const abs = Math.abs(monto).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (monto > 0.01) return `+${simbolo} ${abs}`;
  if (monto < -0.01) return `−${simbolo} ${abs}`;
  return `${simbolo} 0.00`;
}

// ─── Componente ─────────────────────────────────────────────────────────

export const EntidadCCCard: React.FC<EntidadCCCardProps> = ({
  cc,
  onView,
  onAccionPrincipal,
  className,
}) => {
  const TipoIcon = ICONO_TIPO[cc.tipo];
  const tipoColor = COLOR_TIPO[cc.tipo];
  const estado = useMemo(() => getEstadoContextual(cc), [cc]);
  const EstadoIcon = estado.icon;
  const cta = useMemo(() => getCTAPrincipal(cc), [cc]);
  const CTAIcon = cta?.icon;
  const saldoDominante = getSaldoDominante(cc);

  // Color del saldo según signo
  const saldoColorClass =
    saldoDominante.signo === 'positivo'
      ? 'text-emerald-700'
      : saldoDominante.signo === 'negativo'
        ? cc.tipo === 'cliente'
          ? 'text-purple-700'
          : 'text-red-700'
        : 'text-slate-500';

  const saldoLabel =
    saldoDominante.signo === 'positivo'
      ? 'Por cobrar'
      : saldoDominante.signo === 'negativo'
        ? cc.tipo === 'cliente'
          ? 'A favor del cliente'
          : 'Por pagar'
        : 'Saldada';

  const handleAccion = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAccionPrincipal?.();
  };

  // Saldo secundario (si hay saldo en la otra moneda)
  const tieneSaldoSecundario =
    saldoDominante.moneda === 'USD'
      ? Math.abs(cc.saldoPEN) > 0.01
      : Math.abs(cc.saldoUSD) > 0.01;

  return (
    <div
      className={cn(
        '@container bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-teal-300 transition-all cursor-pointer',
        className,
      )}
      onClick={onView}
    >
      {/* ═══════════════════ NARROW (stack vertical) ═══════════════════ */}
      <div className="@[640px]:hidden space-y-3">
        {/* Row 1: Avatar + Nombre + Tipo + Estado */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0',
                tipoColor.bg,
                tipoColor.text,
              )}
            >
              {inicial(cc.entidadNombre)}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 truncate text-sm">
                {cc.entidadNombre}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-md font-medium',
                    tipoColor.badge,
                  )}
                >
                  {TIPO_ENTIDAD_CC_LABELS[cc.tipo]}
                </span>
              </div>
            </div>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap flex-shrink-0',
              estado.classes,
            )}
          >
            {estado.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-pulse" />}
            <EstadoIcon className="w-2.5 h-2.5" />
            {estado.label}
          </span>
        </div>

        {/* Row 2: Saldo destacado + docs */}
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                Saldo
              </div>
              <div
                className={cn(
                  'text-lg font-bold tabular-nums',
                  saldoColorClass,
                )}
              >
                {fmtSaldo(saldoDominante.monto, saldoDominante.moneda)}
              </div>
              <div className={cn('text-[10px]', saldoColorClass)}>
                {saldoLabel}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                Movs
              </div>
              <div className="text-sm font-bold text-slate-900 tabular-nums">
                {cc.cantidadMovimientos}
              </div>
              {tieneSaldoSecundario && (
                <div className="text-[10px] text-slate-500 tabular-nums">
                  {saldoDominante.moneda === 'USD'
                    ? fmtSaldo(cc.saldoPEN, 'PEN')
                    : fmtSaldo(cc.saldoUSD, 'USD')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Acciones */}
        <div className="flex gap-2">
          {cta && (
            <button
              type="button"
              onClick={handleAccion}
              className={cn(
                'flex-1 text-[12px] py-2 rounded-md font-medium flex items-center justify-center gap-1',
                cta.classes,
              )}
            >
              {CTAIcon && <CTAIcon className="w-3.5 h-3.5" />}
              {cta.label}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onView?.();
            }}
            className="flex-1 text-[12px] py-2 bg-white border border-slate-300 text-slate-700 rounded-md font-medium hover:bg-slate-50"
          >
            Ver detalle
          </button>
        </div>
      </div>

      {/* ═══════════════════ WIDE (12-col horizontal) ═══════════════════ */}
      <div className="hidden @[640px]:grid grid-cols-12 items-center gap-3">
        {/* Col 1-3: Avatar + Nombre + Tipo */}
        <div className="col-span-3 flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0',
              tipoColor.bg,
              tipoColor.text,
            )}
          >
            {inicial(cc.entidadNombre)}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 truncate text-sm">
              {cc.entidadNombre}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-md font-medium',
                  tipoColor.badge,
                )}
              >
                <TipoIcon className="w-2.5 h-2.5 inline mr-0.5" />
                {TIPO_ENTIDAD_CC_LABELS[cc.tipo]}
              </span>
            </div>
          </div>
        </div>

        {/* Col 4-5: Estado */}
        <div className="col-span-2">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
            Estado
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap',
              estado.classes,
            )}
          >
            {estado.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-pulse" />}
            <EstadoIcon className="w-2.5 h-2.5" />
            {estado.label}
          </span>
        </div>

        {/* Col 6-8: Saldo destacado */}
        <div className="col-span-3 text-right">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">
            Saldo
          </div>
          <div className="tabular-nums">
            <span className={cn('text-lg font-bold', saldoColorClass)}>
              {fmtSaldo(saldoDominante.monto, saldoDominante.moneda)}
            </span>
            {tieneSaldoSecundario && (
              <div className="text-[10px] text-slate-500 tabular-nums">
                +{' '}
                {saldoDominante.moneda === 'USD'
                  ? fmtSaldo(cc.saldoPEN, 'PEN')
                  : fmtSaldo(cc.saldoUSD, 'USD')}
              </div>
            )}
            <div className={cn('text-[11px]', saldoColorClass)}>{saldoLabel}</div>
          </div>
        </div>

        {/* Col 9-10: Movs + última actividad */}
        <div className="col-span-2 border-l border-slate-100 pl-3">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">
            Movimientos
          </div>
          <div className="text-[12px] text-slate-700 font-medium">
            {cc.cantidadMovimientos} registrados
          </div>
          {cc.fechaUltimoMovimiento && (
            <div className="text-[10px] text-slate-500">
              Última act:{' '}
              {cc.fechaUltimoMovimiento.toDate().toLocaleDateString('es-PE', {
                day: '2-digit',
                month: 'short',
              })}
            </div>
          )}
        </div>

        {/* Col 11-12: Acciones */}
        <div className="col-span-2 flex justify-end gap-1.5">
          {cta && (
            <button
              type="button"
              onClick={handleAccion}
              className={cn(
                'text-[11px] px-2.5 py-1.5 rounded-md font-medium flex items-center gap-1',
                cta.classes,
              )}
            >
              {CTAIcon && <CTAIcon className="w-3 h-3" />}
              {cta.label}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onView?.();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md"
            title="Ver detalle"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
