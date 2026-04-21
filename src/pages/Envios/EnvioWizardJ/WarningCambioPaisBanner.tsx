/**
 * WarningCambioPaisBanner — Banner amarillo visible cuando el envío cruza
 * países (D-9: intra-país preferente en Caso J).
 *
 * No bloquea la creación. El flag queda registrado en el documento del envío
 * como `advertenciaCambioPais: true` para auditoría posterior.
 *
 * Ubicación típica: Paso 2 del Wizard J (StepDestino), justo debajo de la
 * selección de casilla destino.
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { PAISES_CONFIG } from '../../../types/casilla.types';
import { cn } from '../../../design-system';

export interface WarningCambioPaisBannerProps {
  /** País del colaborador origen (ej. 'USA') */
  origenPais: string;
  /** País de la casilla destino (ej. 'China') */
  destinoPais: string;
  /** Nombre del colaborador destino para personalizar el mensaje */
  colaboradorDestinoNombre?: string;
  /** Clase adicional */
  className?: string;
}

export const WarningCambioPaisBanner: React.FC<WarningCambioPaisBannerProps> = ({
  origenPais,
  destinoPais,
  colaboradorDestinoNombre,
  className,
}) => {
  const origenEmoji = PAISES_CONFIG[origenPais]?.emoji ?? '🌐';
  const origenNombre = PAISES_CONFIG[origenPais]?.nombre ?? origenPais;
  const destinoEmoji = PAISES_CONFIG[destinoPais]?.emoji ?? '🌐';
  const destinoNombre = PAISES_CONFIG[destinoPais]?.nombre ?? destinoPais;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 bg-amber-50 border border-amber-300 rounded-lg',
        className
      )}
      role="alert"
    >
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-xs">
        <div className="font-semibold text-amber-900 mb-1">
          Envío entre países distintos
        </div>
        <div className="text-amber-800 flex items-center gap-1 mb-1 flex-wrap">
          <span className="font-medium">
            {origenEmoji} {origenNombre}
          </span>
          <span className="text-amber-500">→</span>
          <span className="font-medium">
            {destinoEmoji} {destinoNombre}
          </span>
        </div>
        <div className="text-amber-700 leading-snug">
          El Caso J es preferente intra-país. Verifica que
          {colaboradorDestinoNombre ? (
            <>
              {' '}
              <b>{colaboradorDestinoNombre}</b>
            </>
          ) : (
            ' el colaborador destino'
          )}{' '}
          espera este envío y que las reglas aduaneras del cruce fueron resueltas.
          Esta advertencia queda registrada en el envío para auditoría.
        </div>
      </div>
    </div>
  );
};
