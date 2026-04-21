/**
 * VarianteJIndicator — Indicador visual de la variante J1/J2 derivada del
 * Caso J (D-8).
 *
 * J1 — Mismo colaborador mueve unidades entre dos casillas suyas
 * J2 — Remitente y destinatario son colaboradores distintos
 *
 * La variante se auto-detecta en el reducer (colaboradorOrigenId ===
 * colaboradorDestinoId) y este componente solo la visualiza. No es editable.
 *
 * Ubicación típica: Paso 2 del Wizard J (StepDestino), junto al warning
 * de cambio de país si aplica.
 */
import React from 'react';
import { User, Users } from 'lucide-react';
import type { VarianteCasoJ } from './envioWizardJTypes';
import { cn } from '../../../design-system';

export interface VarianteJIndicatorProps {
  variante: VarianteCasoJ;
  colaboradorOrigenNombre: string;
  colaboradorDestinoNombre: string;
  className?: string;
}

export const VarianteJIndicator: React.FC<VarianteJIndicatorProps> = ({
  variante,
  colaboradorOrigenNombre,
  colaboradorDestinoNombre,
  className,
}) => {
  const esJ1 = variante === 'J1';
  const Icon = esJ1 ? User : Users;
  const colorClass = esJ1
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : 'bg-violet-50 border-violet-200 text-violet-800';

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 p-2.5 border rounded-lg',
        colorClass,
        className
      )}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
          esJ1 ? 'bg-emerald-100' : 'bg-violet-100'
        )}
      >
        <Icon className={cn('w-4 h-4', esJ1 ? 'text-emerald-700' : 'text-violet-700')} />
      </div>
      <div className="flex-1 text-xs leading-snug">
        <div className="font-semibold mb-0.5 flex items-center gap-1.5">
          <span className="font-mono text-[10px] opacity-70">{variante}</span>
          <span>
            {esJ1 ? 'Movimiento interno del mismo colaborador' : 'Entre colaboradores distintos'}
          </span>
        </div>
        <div className="opacity-90">
          {esJ1 ? (
            <>
              <b>{colaboradorOrigenNombre}</b> moverá unidades entre dos casillas
              suyas. No requiere confirmación de destinatario externo.
            </>
          ) : (
            <>
              <b>{colaboradorOrigenNombre}</b> enviará a{' '}
              <b>{colaboradorDestinoNombre}</b>. El destinatario deberá confirmar la
              recepción al llegar.
            </>
          )}
        </div>
      </div>
    </div>
  );
};
