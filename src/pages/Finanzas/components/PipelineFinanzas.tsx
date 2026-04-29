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

  // Imp-L11.b · diseño pill horizontal estilo M6 (mockup movimientos)
  // Antes: rounded-md con count interno · Ahora: rounded-full pill compacto
  // con count como badge separado y divisor vertical entre estado y tipo.
  const hayFiltroActivo =
    estadoActivo !== 'todas' || tipoActivo !== 'todos';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Label compacto */}
      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mr-1">
        Filtrar:
      </span>

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
              'px-3 py-1 rounded-full text-[12px] inline-flex items-center gap-1.5 whitespace-nowrap transition-all font-medium',
              isActivo ? chip.classes.activo : chip.classes.inactivo,
              isActivo && 'shadow-sm',
            )}
          >
            <Icon className="w-3 h-3" />
            <span>{chip.label}</span>
            <span
              className={cn(
                'tabular-nums text-[11px] font-bold',
                isActivo ? 'text-white/90' : 'opacity-60',
              )}
            >
              {chip.count}
            </span>
          </button>
        );
      })}

      {/* Divider vertical */}
      <div className="h-5 w-px bg-slate-200 mx-1" />

      {/* Chips de tipo · sin "todos los tipos" botón explícito ·
          un click sobre el chip activo lo desactiva (toggle) */}
      {chipsTipo.map((chip) => {
        const Icon = chip.icon;
        const isActivo = tipoActivo === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onCambiarTipo(isActivo ? 'todos' : chip.id)}
            className={cn(
              'px-3 py-1 rounded-full text-[12px] inline-flex items-center gap-1.5 whitespace-nowrap transition-all font-medium',
              isActivo ? chip.classes.activo : chip.classes.inactivo,
              isActivo && 'shadow-sm',
            )}
          >
            <Icon className="w-3 h-3" />
            <span>{chip.label}</span>
          </button>
        );
      })}

      {/* Limpiar filtros (solo visible cuando hay filtro activo) */}
      {hayFiltroActivo && (
        <button
          type="button"
          onClick={() => {
            onCambiarEstado('todas');
            onCambiarTipo('todos');
          }}
          className="ml-auto text-[11px] text-slate-500 hover:text-teal-700 inline-flex items-center gap-1 transition-colors px-2 py-1"
        >
          <span>×</span>
          Limpiar filtros
        </button>
      )}
    </div>
  );
};
