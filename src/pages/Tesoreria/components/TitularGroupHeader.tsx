/**
 * TitularGroupHeader — Imp-L1.1.5 · Refactor visual S58e
 *
 * Header del grupo de titular en la vista por titular. Muestra avatar +
 * nombre del titular + tipo + RUC/DNI + count + saldo agregado.
 *
 * Color del avatar diferenciado por tipo de titular:
 *   - empresa     → teal
 *   - empleado    → sky
 *   - colaborador → purple
 *   - proveedor   → amber
 *   - cliente     → rose
 */

import React from 'react';
import {
  Building,
  IdCard,
  Truck,
  User,
  Users as UsersIcon,
} from 'lucide-react';
import { cn } from '../../../design-system/utils';

export type TipoTitular =
  | 'empresa'
  | 'empleado'
  | 'colaborador'
  | 'proveedor'
  | 'cliente';

interface TipoConfig {
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  text: string;
  label: string;
}

const TIPO_CONFIG: Record<TipoTitular, TipoConfig> = {
  empresa: {
    icon: Building,
    bg: 'bg-teal-100',
    text: 'text-teal-700',
    label: 'Empresa',
  },
  empleado: {
    icon: IdCard,
    bg: 'bg-sky-100',
    text: 'text-sky-700',
    label: 'Empleado',
  },
  colaborador: {
    icon: UsersIcon,
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    label: 'Colaborador',
  },
  proveedor: {
    icon: Truck,
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    label: 'Proveedor',
  },
  cliente: {
    icon: User,
    bg: 'bg-rose-100',
    text: 'text-rose-700',
    label: 'Cliente',
  },
};

export interface TitularGroupHeaderProps {
  tipo: TipoTitular;
  nombre: string;
  /** Subtítulo (ej: "RUC 20601234567 · 8 productos") */
  subtitulo?: string;
  /** Texto del saldo agregado a la derecha */
  saldoTexto: string;
  /** Click navega al drill-down M4 del titular */
  onClick?: () => void;
  className?: string;
}

export const TitularGroupHeader: React.FC<TitularGroupHeaderProps> = ({
  tipo,
  nombre,
  subtitulo,
  saldoTexto,
  onClick,
  className,
}) => {
  const cfg = TIPO_CONFIG[tipo];
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 mb-3 px-4 py-3.5',
        'rounded-xl border border-slate-200',
        'bg-gradient-to-br from-slate-50 to-slate-100',
        onClick && 'cursor-pointer transition-all hover:shadow-sm hover:border-teal-200',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
            cfg.bg,
          )}
        >
          <Icon className={cn('w-4 h-4', cfg.text)} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900 truncate">
            {nombre}
          </div>
          {subtitulo && (
            <div className="text-xs text-slate-500 truncate">{subtitulo}</div>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-[10px] text-slate-400 uppercase tracking-wide">
          Saldo agregado
        </div>
        <div className="text-base font-bold text-slate-900 tabular-nums">
          {saldoTexto}
        </div>
      </div>
    </div>
  );
};
