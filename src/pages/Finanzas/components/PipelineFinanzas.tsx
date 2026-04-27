/**
 * PipelineFinanzas — S56 · Filtro principal del hub Finanzas
 *
 * Chips clickables horizontales (estilo Stripe / Compras) para filtrar
 * la lista de entidades por estado y tipo.
 *
 * Estados:
 *   - todas / por_cobrar / por_pagar / vencidas / saldadas
 *
 * Tipos (chips secundarios):
 *   - clientes / proveedores / colaboradores / empleados
 */

import React from 'react';
import {
  List,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  Check,
  Users as UsersIcon,
  Building,
  Truck,
  IdCard,
} from 'lucide-react';
import { cn } from '../../../design-system';
import type { TipoEntidadCC } from '../../../types/cuentaCorriente.types';

export type FiltroEstado =
  | 'todas'
  | 'por_cobrar'
  | 'por_pagar'
  | 'vencidas'
  | 'saldadas';

export interface ConteosFiltro {
  todas: number;
  porCobrar: number;
  porPagar: number;
  vencidas: number;
  saldadas: number;
  porTipo: Record<TipoEntidadCC, number>;
}

interface PipelineFinanzasProps {
  estadoActivo: FiltroEstado;
  onCambiarEstado: (estado: FiltroEstado) => void;
  tipoActivo: TipoEntidadCC | 'todos';
  onCambiarTipo: (tipo: TipoEntidadCC | 'todos') => void;
  conteos: ConteosFiltro;
}

interface ChipConfig {
  id: FiltroEstado;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  classes: {
    activo: string;
    inactivo: string;
  };
}

interface TipoChipConfig {
  id: TipoEntidadCC;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  classes: { activo: string; inactivo: string };
}

export const PipelineFinanzas: React.FC<PipelineFinanzasProps> = ({
  estadoActivo,
  onCambiarEstado,
  tipoActivo,
  onCambiarTipo,
  conteos,
}) => {
  const chipsEstado: ChipConfig[] = [
    {
      id: 'todas',
      label: 'Todas',
      icon: List,
      count: conteos.todas,
      classes: {
        activo: 'bg-slate-900 text-white',
        inactivo: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
      },
    },
    {
      id: 'por_cobrar',
      label: 'Por cobrar',
      icon: ArrowDownToLine,
      count: conteos.porCobrar,
      classes: {
        activo: 'bg-emerald-600 text-white',
        inactivo: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200',
      },
    },
    {
      id: 'por_pagar',
      label: 'Por pagar',
      icon: ArrowUpFromLine,
      count: conteos.porPagar,
      classes: {
        activo: 'bg-red-600 text-white',
        inactivo: 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200',
      },
    },
    {
      id: 'vencidas',
      label: 'Vencidas',
      icon: Clock,
      count: conteos.vencidas,
      classes: {
        activo: 'bg-amber-600 text-white',
        inactivo: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200',
      },
    },
    {
      id: 'saldadas',
      label: 'Saldadas',
      icon: Check,
      count: conteos.saldadas,
      classes: {
        activo: 'bg-slate-700 text-white',
        inactivo: 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200',
      },
    },
  ];

  const chipsTipo: TipoChipConfig[] = [
    {
      id: 'cliente',
      label: 'Clientes',
      icon: UsersIcon,
      count: conteos.porTipo.cliente || 0,
      classes: {
        activo: 'bg-sky-600 text-white',
        inactivo: 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200',
      },
    },
    {
      id: 'proveedor',
      label: 'Proveedores',
      icon: Building,
      count: conteos.porTipo.proveedor || 0,
      classes: {
        activo: 'bg-amber-600 text-white',
        inactivo: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200',
      },
    },
    {
      id: 'colaborador',
      label: 'Colaboradores',
      icon: Truck,
      count: conteos.porTipo.colaborador || 0,
      classes: {
        activo: 'bg-purple-600 text-white',
        inactivo: 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200',
      },
    },
    {
      id: 'empleado',
      label: 'Empleados',
      icon: IdCard,
      count: conteos.porTipo.empleado || 0,
      classes: {
        activo: 'bg-emerald-600 text-white',
        inactivo: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200',
      },
    },
  ];

  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
        Filtrar
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {/* Chips de estado */}
        {chipsEstado.map((chip) => {
          const Icon = chip.icon;
          const isActivo = estadoActivo === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onCambiarEstado(chip.id)}
              className={cn(
                'px-3 py-1.5 rounded-md text-[12px] flex items-center gap-1.5 whitespace-nowrap transition-colors font-medium',
                isActivo ? chip.classes.activo : chip.classes.inactivo,
              )}
            >
              <Icon className="w-3 h-3" />
              {chip.label}
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-md text-[10px] font-semibold',
                  isActivo ? 'bg-white/20' : 'bg-white/60',
                )}
              >
                {chip.count}
              </span>
            </button>
          );
        })}

        {/* Divider vertical */}
        <div className="h-6 w-px bg-slate-200 mx-1 flex-shrink-0" />

        {/* Chip "todos los tipos" para resetear */}
        <button
          type="button"
          onClick={() => onCambiarTipo('todos')}
          className={cn(
            'px-3 py-1.5 rounded-md text-[12px] flex items-center gap-1.5 whitespace-nowrap transition-colors font-medium',
            tipoActivo === 'todos'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50',
          )}
        >
          Todos los tipos
        </button>

        {/* Chips de tipo */}
        {chipsTipo.map((chip) => {
          const Icon = chip.icon;
          const isActivo = tipoActivo === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() =>
                onCambiarTipo(isActivo ? 'todos' : chip.id)
              }
              className={cn(
                'px-3 py-1.5 rounded-md text-[12px] flex items-center gap-1.5 whitespace-nowrap transition-colors font-medium',
                isActivo ? chip.classes.activo : chip.classes.inactivo,
              )}
            >
              <Icon className="w-3 h-3" />
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
