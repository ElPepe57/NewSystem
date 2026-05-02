/**
 * ScoreLiquidezBar · átomo compartido del módulo Productos V2
 *
 * Barra segmentada de 5 puntos que visualiza el score de liquidez de un SKU
 * (0-100) según cuán rápido rota el inventario en el mercado.
 *
 * Categorías:
 *   - LÍQUIDO   (66-100) → verde · vendiendo bien · acción "Reponer"
 *   - MEDIO     (33-65)  → ámbar · velocidad moderada · acción "Vigilar"
 *   - LENTO     (0-32)   → rosa  · stock estancado · acción "Liquidar"
 *
 * Mockup canónico: ver docs/mockups/productos/30-tool-dashboard-catalogo.html (v2)
 * y docs/mockups/productos-intel-s58f.html (raíz histórica del concepto).
 */

import React from 'react';

export type ScoreCategoria = 'LIQUIDO' | 'MEDIO' | 'LENTO';

interface ScoreLiquidezBarProps {
  /** Score 0-100 */
  score: number;
  /** Si true, muestra "85 · LÍQUIDO" debajo de la barra */
  showLabel?: boolean;
  /** Tamaño de la barra: sm (4px alto) · md (5px) · lg (6px) */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CATEGORIA_COLORS = {
  LIQUIDO: { active: 'bg-emerald-500', dim: 'bg-emerald-200', text: 'text-emerald-700' },
  MEDIO: { active: 'bg-amber-500', dim: 'bg-amber-200', text: 'text-amber-700' },
  LENTO: { active: 'bg-rose-500', dim: 'bg-rose-200', text: 'text-rose-700' },
};

const SIZE_HEIGHT = {
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2',
};

/**
 * Calcula la categoría a partir del score numérico.
 */
export function categoriaFromScore(score: number): ScoreCategoria {
  if (score >= 66) return 'LIQUIDO';
  if (score >= 33) return 'MEDIO';
  return 'LENTO';
}

/**
 * Calcula cuántos de los 5 segmentos están "activos" (saturados) según el score.
 * Score 85 → 5 activos · score 52 → 3 activos · score 22 → 1 activo.
 */
function activeSegmentsFromScore(score: number): number {
  if (score >= 85) return 5;
  if (score >= 65) return 4;
  if (score >= 45) return 3;
  if (score >= 25) return 2;
  return 1;
}

export const ScoreLiquidezBar: React.FC<ScoreLiquidezBarProps> = ({
  score,
  showLabel = true,
  size = 'md',
  className = '',
}) => {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const categoria = categoriaFromScore(clampedScore);
  const colors = CATEGORIA_COLORS[categoria];
  const activeCount = activeSegmentsFromScore(clampedScore);
  const heightClass = SIZE_HEIGHT[size];

  return (
    <div className={className}>
      <div className="flex gap-px items-center">
        {[0, 1, 2, 3, 4].map(idx => (
          <div
            key={idx}
            className={`${heightClass} flex-1 rounded-[1px] ${idx < activeCount ? colors.active : colors.dim}`}
          />
        ))}
      </div>
      {showLabel && (
        <div className={`text-[10px] font-bold tabular-nums mt-1 ${colors.text}`}>
          {clampedScore} · {categoria}
        </div>
      )}
    </div>
  );
};
