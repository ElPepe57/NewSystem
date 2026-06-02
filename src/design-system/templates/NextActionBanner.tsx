/**
 * NextActionBanner — Banner CTA de "próxima acción" para el detalle de una entidad.
 *
 * Patrón canónico S52 — ver `docs/DESIGN_PATTERNS.md` → Patrón 4.
 *
 * Derivado del estándar OrdenCompraCard (S42ap) — el banner teal-50 con ícono
 * circular + label + descripción + botón que le dice al usuario "cuál es tu
 * siguiente paso" según el estado de la entidad.
 *
 * Estructura:
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  [icon]  Label principal                           [ Botón ]   │
 *   │          Descripción secundaria opcional                        │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * USO:
 *   <NextActionBanner
 *     icon={Send}
 *     label="Confirmar OC"
 *     description="Divide en sub-órdenes y despacha cuando esté lista"
 *     buttonText="Confirmar"
 *     onClick={() => setVistaInterna('confirmar')}
 *   />
 *
 * REEMPLAZA:
 *   - El bloque `{nextAction && ...}` JSX hardcodeado en OrdenCompraCard (S42ap)
 *   - El patrón delegado a StatusTimeline en VentaCard
 *
 * NO USAR:
 *   - Para notificaciones transitorias (usar toast)
 *   - Para mostrar errores (usar bg-red-50)
 *   - Cuando hay 3+ acciones posibles (elegir la principal, resto va en kebab)
 */
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../utils';
import { Button } from '../../components/common/Button';

// ────────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────────

export type NextActionVariant = 'teal' | 'blue' | 'amber' | 'red' | 'sky' | 'emerald' | 'neutral';

export interface NextActionBannerProps {
  /** Ícono opcional (de lucide-react) a la izquierda */
  icon?: LucideIcon;
  /** Label principal (ej. "Confirmar OC", "Registrar recepción") */
  label: string;
  /** Descripción secundaria opcional (1 línea) */
  description?: string;
  /** Texto del botón de acción */
  buttonText?: string;
  /** Handler del botón (opcional — sin handler, el banner es solo informativo) */
  onClick?: () => void;
  /** Variante del botón (primary por default) */
  buttonVariant?: 'primary' | 'secondary';
  /** Variante de color del banner (teal default para acción positiva) */
  variant?: NextActionVariant;
  /** Disabled — deshabilita el botón (ej. esperando otra cosa) */
  disabled?: boolean;
  /** Clase adicional */
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Paleta de variantes
// ────────────────────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<
  NextActionVariant,
  { bg: string; border: string; iconBg: string; iconText: string; labelText: string; descText: string }
> = {
  teal: {
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    iconBg: 'bg-white border-teal-200',
    iconText: 'text-teal-600',
    labelText: 'text-teal-900',
    descText: 'text-teal-700',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconBg: 'bg-white border-blue-200',
    iconText: 'text-blue-600',
    labelText: 'text-blue-900',
    descText: 'text-blue-700',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconBg: 'bg-white border-amber-200',
    iconText: 'text-amber-600',
    labelText: 'text-amber-900',
    descText: 'text-amber-700',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconBg: 'bg-white border-red-200',
    iconText: 'text-red-600',
    labelText: 'text-red-900',
    descText: 'text-red-700',
  },
  sky: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    iconBg: 'bg-white border-sky-200',
    iconText: 'text-sky-600',
    labelText: 'text-sky-900',
    descText: 'text-sky-700',
  },
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconBg: 'bg-white border-emerald-200',
    iconText: 'text-emerald-600',
    labelText: 'text-emerald-900',
    descText: 'text-emerald-700',
  },
  neutral: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    iconBg: 'bg-white border-slate-200',
    iconText: 'text-slate-500',
    labelText: 'text-slate-800',
    descText: 'text-slate-600',
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────────────────────────

export const NextActionBanner: React.FC<NextActionBannerProps> = ({
  icon: Icon,
  label,
  description,
  buttonText,
  onClick,
  buttonVariant = 'primary',
  variant = 'teal',
  disabled = false,
  className,
}) => {
  const s = VARIANT_STYLES[variant];

  return (
    <div
      className={cn(
        'border rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap',
        s.bg,
        s.border,
        className
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {Icon && (
          <div
            className={cn(
              'w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0',
              s.iconBg
            )}
          >
            <Icon className={cn('w-5 h-5', s.iconText)} />
          </div>
        )}
        <div className="min-w-0">
          <div className={cn('text-sm font-semibold', s.labelText)}>{label}</div>
          {description && (
            <div className={cn('text-xs mt-0.5', s.descText)}>{description}</div>
          )}
        </div>
      </div>
      {buttonText && onClick && (
        <Button
          variant={buttonVariant === 'primary' ? 'primary' : 'secondary'}
          onClick={onClick}
          disabled={disabled}
          className="flex-shrink-0"
        >
          {buttonText}
        </Button>
      )}
    </div>
  );
};
