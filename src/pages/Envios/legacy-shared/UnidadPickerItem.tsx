/**
 * UnidadPickerItem — Fila de unidad individual en el Paso 2 (Picking).
 *
 * Componente atómico. Muestra una unidad con:
 *  - Checkbox de selección
 *  - ID corto de la unidad
 *  - Badge de prioridad si tiene `reservadaPara` (pre-vendida · COT-XXX)
 *  - Fecha de recepción o subtexto descriptivo
 *
 * Pulse animado en unidades prioritarias para llamar la atención del usuario.
 *
 * Uso:
 *  <UnidadPickerItem
 *    unidadId="UN-8823"
 *    codigoUnidad="UN-8823"
 *    seleccionada={true}
 *    reservadaParaLabel="COT-145"
 *    fechaRecepcionLabel="Recibida 29-mar"
 *    onToggle={() => dispatch({ type: 'TOGGLE_UNIDAD', unidadId: 'UN-8823' })}
 *  />
 */
import React from 'react';
import { cn } from '../../../design-system';

export interface UnidadPickerItemProps {
  /** ID único de la unidad en Firestore */
  unidadId: string;
  /** Código mostrado (ej: "UN-8823" — últimos chars del id en mayúsculas) */
  codigoUnidad: string;
  /** Si está marcada para incluirse en el envío */
  seleccionada: boolean;
  /** Etiqueta de reserva (ej: "COT-145" si `reservadaPara` existe). null = stock normal */
  reservadaParaLabel?: string | null;
  /** Fecha legible de recepción (ej: "Recibida 29-mar") */
  fechaRecepcionLabel?: string;
  /** Texto adicional a la derecha (ej: "stock normal", "OC-002") */
  extraRightLabel?: string;
  /** Callback al clickear la fila o el checkbox */
  onToggle: () => void;
  /** Si está deshabilitada (ej: ya asignada a otro envío) */
  disabled?: boolean;
  /** Clase adicional */
  className?: string;
}

export const UnidadPickerItem: React.FC<UnidadPickerItemProps> = ({
  unidadId,
  codigoUnidad,
  seleccionada,
  reservadaParaLabel,
  fechaRecepcionLabel,
  extraRightLabel,
  onToggle,
  disabled = false,
  className,
}) => {
  const esPrioritaria = !!reservadaParaLabel;

  return (
    <label
      data-unidad-id={unidadId}
      className={cn(
        'px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors',
        esPrioritaria && 'bg-emerald-50/40',
        esPrioritaria && seleccionada && 'prio-item',
        !esPrioritaria && 'hover:bg-slate-50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <input
        type="checkbox"
        checked={seleccionada}
        onChange={onToggle}
        disabled={disabled}
        className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 disabled:cursor-not-allowed"
      />
      <span className="text-base flex-shrink-0" aria-hidden>🏷️</span>
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs text-slate-700">#{codigoUnidad}</span>
        {reservadaParaLabel && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
            Reservada · {reservadaParaLabel}
          </span>
        )}
      </div>
      {(fechaRecepcionLabel || extraRightLabel) && (
        <span className="text-xs text-slate-500 flex-shrink-0 truncate max-w-[200px]">
          {fechaRecepcionLabel}
          {fechaRecepcionLabel && extraRightLabel && ' · '}
          {extraRightLabel}
        </span>
      )}
    </label>
  );
};
