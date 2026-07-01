import React from 'react';

/**
 * GroupBadge — identificador numerado de un grupo draft (1-based).
 *
 * Reemplaza el dot de color por-grupo (sistema arcoíris sky/emerald/amber/…)
 * por un único acento AZUL + el NÚMERO del grupo como distinguidor.
 * Alinea OCBuilder al canon de color por GRUPO del sidebar (Comercial = blue)
 * y elimina la inconsistencia de 8 colores rotando por grupo.
 */
export const GroupBadge: React.FC<{ numero: number; className?: string }> = ({
  numero,
  className = '',
}) => (
  <span
    className={`inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold tabular-nums flex-shrink-0 ${className}`}
    aria-label={`Grupo ${numero}`}
  >
    {numero}
  </span>
);
