/**
 * ColaboradorTransporteCard — Card seleccionable/seleccionada del colaborador
 * (viajero o courier) en el Paso 3 (Transporte).
 *
 * Muestra:
 *  - Avatar con iniciales (color temático por tipo)
 *  - Nombre + badge "Disponible"
 *  - Info contextual (viajes previos, próximo vuelo, etc.)
 *  - Tarifa base destacada en amber (si configurada)
 *  - Check visual si está seleccionado
 *
 * Uso:
 *  <ColaboradorTransporteCard
 *    id="JP"
 *    nombre="Juan Pérez"
 *    iniciales="JP"
 *    tipo="viajero"
 *    disponible
 *    seleccionado={state.colaboradorId === 'JP'}
 *    info="Viajero frecuente · 12 viajes completados"
 *    tarifaBadge="💰 Base: $8/libra"
 *    onSelect={() => dispatch({ type: 'SET_COLABORADOR', id: 'JP', ... })}
 *    onCambiar={() => openPicker()}
 *  />
 */
import React from 'react';
import { cn } from '../../../design-system';

export interface ColaboradorTransporteCardProps {
  /** ID del colaborador */
  id: string;
  /** Nombre completo del colaborador */
  nombre: string;
  /** Iniciales para el avatar (ej: "JP" para Juan Pérez) */
  iniciales: string;
  /** Tipo de colaborador — determina color del avatar */
  tipo: 'viajero' | 'courier';
  /** Si está disponible para asignar a este envío */
  disponible?: boolean;
  /** Si esta card está seleccionada (es el colaborador elegido) */
  seleccionado: boolean;
  /** Texto descriptivo (viajes completados, notas, etc.) */
  info?: string;
  /** Badge destacado con la tarifa base (ej: "💰 Base: $8/libra") */
  tarifaBadge?: string | null;
  /** Texto auxiliar a la derecha del badge de tarifa */
  tarifaContexto?: string;
  /** Callback al seleccionar (si aún no está seleccionado) */
  onSelect?: () => void;
  /** Callback al click en "Cambiar" (si ya está seleccionado) */
  onCambiar?: () => void;
  /** Clase adicional */
  className?: string;
}

const AVATAR_COLORS: Record<'viajero' | 'courier', string> = {
  viajero: 'bg-sky-100 text-sky-700',
  courier: 'bg-violet-100 text-violet-700',
};

export const ColaboradorTransporteCard: React.FC<ColaboradorTransporteCardProps> = ({
  id,
  nombre,
  iniciales,
  tipo,
  disponible = true,
  seleccionado,
  info,
  tarifaBadge,
  tarifaContexto,
  onSelect,
  onCambiar,
  className,
}) => {
  const avatarClasses = AVATAR_COLORS[tipo];

  const content = (
    <>
      {seleccionado && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0',
            avatarClasses
          )}
          aria-hidden
        >
          {iniciales}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-base font-semibold text-slate-900">{nombre}</span>
            {disponible && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
                Disponible
              </span>
            )}
          </div>
          {info && <div className="text-xs text-slate-600">{info}</div>}
          {tarifaBadge && (
            <div className="flex items-center gap-3 mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                {tarifaBadge}
              </span>
              {tarifaContexto && (
                <span className="text-xs text-slate-500">{tarifaContexto}</span>
              )}
            </div>
          )}
        </div>
        {seleccionado && onCambiar && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCambiar();
            }}
            className="text-xs text-teal-700 hover:underline font-medium flex-shrink-0"
          >
            Cambiar
          </button>
        )}
      </div>
    </>
  );

  // Si está seleccionado, card estática con botón "Cambiar"
  // Si no está seleccionado, card clickeable (botón wrapper)
  if (seleccionado) {
    return (
      <div
        data-colaborador-id={id}
        className={cn(
          'relative bg-white border-2 border-teal-500 rounded-xl p-4 ring-4 ring-teal-100',
          className
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-colaborador-id={id}
      onClick={onSelect}
      className={cn(
        'relative bg-white border border-slate-200 hover:border-teal-300 rounded-xl p-4 text-left w-full transition-colors',
        className
      )}
    >
      {content}
    </button>
  );
};
