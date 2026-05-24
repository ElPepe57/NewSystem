/**
 * TooltipPedagogico · canon v5.2 chk5.E-A
 *
 * Tooltip especializado para términos técnicos contables. Estructura canon:
 * (1) Título · (2) Definición coloquial · (3) Cómo se calcula (opcional) · (4) Saludable/ejemplo (opcional)
 *
 * Usa el componente <Tooltip> base existente · solo aporta el formato estructurado.
 *
 * @example
 * <TooltipPedagogico
 *   titulo="EBITDA"
 *   definicion="Ganancia operativa real del negocio sin contar diferencias cambiarias, intereses ni impuestos."
 *   calculo="Margen Bruto − Gastos Operativos"
 *   saludable="≥15% sobre las ventas"
 * >
 *   <Info className="w-3 h-3 text-slate-400 hover:text-slate-600" />
 * </TooltipPedagogico>
 */

import React from 'react';
import { Info } from 'lucide-react';
import { Tooltip } from './Tooltip';
import type { TooltipPosition } from './Tooltip';

export interface TooltipPedagogicoProps {
  /** Nombre del término técnico */
  titulo: string;
  /** Explicación en lenguaje coloquial */
  definicion: string;
  /** Fórmula o método de cálculo (opcional) */
  calculo?: string;
  /** Qué significa "alto/bajo" o ejemplo del negocio (opcional) */
  saludable?: string;
  /** Si se pasa, envuelve este elemento · si no, renderiza el icono Info canon */
  children?: React.ReactElement;
  /** Posición del tooltip · default 'top' */
  position?: TooltipPosition;
  /** Color del icon canon (cuando no se pasan children) · default 'slate-400 hover:slate-600' */
  iconClassName?: string;
}

export const TooltipPedagogico: React.FC<TooltipPedagogicoProps> = ({
  titulo,
  definicion,
  calculo,
  saludable,
  children,
  position = 'top',
  iconClassName = 'w-3 h-3 text-slate-400 hover:text-slate-600 cursor-help',
}) => {
  const content = (
    <div className="space-y-2 max-w-[280px]">
      <div className="font-bold text-[12px]">{titulo}</div>
      <div className="text-[11px] text-slate-200 leading-relaxed">{definicion}</div>
      {calculo && (
        <div className="text-[11px] text-slate-300 leading-relaxed pt-1 border-t border-slate-700/50">
          <span className="text-slate-400 font-medium">Cálculo: </span>
          {calculo}
        </div>
      )}
      {saludable && (
        <div className="text-[11px] text-emerald-300 leading-relaxed pt-1 border-t border-slate-700/50">
          <span className="font-medium">✓ Saludable: </span>
          {saludable}
        </div>
      )}
    </div>
  );

  // Si no se pasa children, renderizar el icon Info canon por defecto
  const trigger = children || (
    <span className="inline-flex items-center" tabIndex={0} aria-label={`Más info sobre ${titulo}`}>
      <Info className={iconClassName} />
    </span>
  );

  return (
    <Tooltip content={content} position={position} maxWidth={300}>
      {trigger}
    </Tooltip>
  );
};
