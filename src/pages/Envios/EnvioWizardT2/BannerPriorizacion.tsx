/**
 * BannerPriorizacion — Banner emerald en el Paso 2 (Picking) que destaca
 * cuántas unidades pre-vendidas hay disponibles y ofrece incluirlas
 * automáticamente.
 *
 * Decisión D-5/D-14: las unidades con `Unidad.reservadaPara` (cotizaciones
 * con adelanto pagado) tienen prioridad visual y se pueden incluir con 1 click.
 *
 * Uso:
 *  <BannerPriorizacion
 *    cantidadPrevendidas={4}
 *    cotizacionesLabel={['COT-123', 'COT-145', 'COT-178']}
 *    incluirAuto={true}
 *    onToggleAuto={checked => dispatch({...})}
 *  />
 *
 *  // Si no hay pre-vendidas disponibles, el banner se oculta solo:
 *  <BannerPriorizacion cantidadPrevendidas={0} />
 */
import React from 'react';
import { cn } from '../../../design-system';

export interface BannerPriorizacionProps {
  /** Cantidad de unidades pre-vendidas disponibles en la casilla origen */
  cantidadPrevendidas: number;
  /** Lista de códigos de cotizaciones afectadas (ej: ["COT-123", "COT-145"]) */
  cotizacionesLabel?: string[];
  /** Estado del checkbox "Incluir automáticamente" */
  incluirAuto: boolean;
  /** Callback al cambiar el checkbox */
  onToggleAuto: (checked: boolean) => void;
  /** Clase adicional */
  className?: string;
}

export const BannerPriorizacion: React.FC<BannerPriorizacionProps> = ({
  cantidadPrevendidas,
  cotizacionesLabel = [],
  incluirAuto,
  onToggleAuto,
  className,
}) => {
  // Si no hay prioritarias, el banner no se muestra (D-5 edge case)
  if (cantidadPrevendidas === 0) return null;

  return (
    <div
      className={cn(
        'bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3',
        className
      )}
      role="note"
    >
      <div
        className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 text-lg"
        aria-hidden
      >
        🎯
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-emerald-900">
          {cantidadPrevendidas}{' '}
          {cantidadPrevendidas === 1 ? 'unidad está pre-vendida' : 'unidades están pre-vendidas'}
        </div>
        <div className="text-xs text-emerald-800 mt-0.5">
          {cotizacionesLabel.length > 0 ? (
            <>
              {'Cotizaciones '}
              {cotizacionesLabel.map((cod, idx) => (
                <React.Fragment key={cod}>
                  <span className="font-mono bg-white px-1 rounded">{cod}</span>
                  {idx < cotizacionesLabel.length - 1 && ', '}
                </React.Fragment>
              ))}
              {' con adelanto pagado — se recomienda incluirlas para cumplir compromiso con clientes.'}
            </>
          ) : (
            'Son cotizaciones con adelanto pagado — se recomienda incluirlas para cumplir compromiso con clientes.'
          )}
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs font-medium text-emerald-800 cursor-pointer flex-shrink-0">
        <input
          type="checkbox"
          checked={incluirAuto}
          onChange={(e) => onToggleAuto(e.target.checked)}
          className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
        />
        Incluir automáticamente
      </label>
    </div>
  );
};
