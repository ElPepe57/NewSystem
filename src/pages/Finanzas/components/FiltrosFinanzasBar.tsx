/**
 * FiltrosFinanzasBar — Imp-L11.c · Barra de filtros completa estilo M6
 *
 * Reemplaza al PipelineFinanzas + toolbar separado. Inspirado en el mockup
 * `docs/mockups/tesoreria-movimientos-s58e.html` (M6) que combina en una sola
 * barra horizontal sticky:
 *
 *   [📅 Rango fechas ▾] | Estado: [chips] | Tipo: [chips] | [🔍 buscar] | [Orden ▾] | × Limpiar
 *
 * Decisiones de diseño:
 *   - Pill chips rounded-full (estilo Mercury/Stripe Atlas).
 *   - Toggle: click sobre chip activo lo desactiva.
 *   - Date range presets (Últ. 7d / 30d / 90d / 6m / Año / Todos).
 *   - Botón "× Limpiar" aparece solo cuando hay filtro distinto al default.
 *   - Layout flex-wrap; en desktop 1-2 filas, en mobile baja a varias filas.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  ChevronDown,
  Search,
  List,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  Check,
  Users as UsersIcon,
  Building,
  Truck,
  IdCard,
  X,
} from 'lucide-react';
import { cn } from '../../../design-system';
import type { TipoEntidadCC } from '../../../types/cuentaCorriente.types';

export type FiltroEstado =
  | 'todas'
  | 'por_cobrar'
  | 'por_pagar'
  | 'vencidas'
  | 'saldadas';

export type RangoFecha =
  | 'todos'
  | 'ult_7d'
  | 'ult_30d'
  | 'ult_90d'
  | 'ult_6m'
  | 'este_anio';

export type OrdenLista = 'mayor_saldo' | 'ultima_act' | 'nombre';

export interface ConteosFiltro {
  todas: number;
  porCobrar: number;
  porPagar: number;
  vencidas: number;
  saldadas: number;
  porTipo: Record<TipoEntidadCC, number>;
}

interface FiltrosFinanzasBarProps {
  // Estado
  estadoActivo: FiltroEstado;
  onCambiarEstado: (estado: FiltroEstado) => void;

  // Tipo entidad
  tipoActivo: TipoEntidadCC | 'todos';
  onCambiarTipo: (tipo: TipoEntidadCC | 'todos') => void;

  // Rango fecha
  rangoFecha: RangoFecha;
  onCambiarRango: (rango: RangoFecha) => void;

  // Búsqueda
  busqueda: string;
  onCambiarBusqueda: (q: string) => void;

  // Orden
  orden: OrdenLista;
  onCambiarOrden: (o: OrdenLista) => void;

  // Conteos
  conteos: ConteosFiltro;
}

// ── Catálogos de chips ──────────────────────────────────────────────
const CHIPS_ESTADO: Array<{
  id: FiltroEstado;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  classes: { activo: string; inactivo: string };
}> = [
  {
    id: 'todas',
    label: 'Todas',
    icon: List,
    classes: {
      activo: 'bg-slate-900 text-white',
      inactivo: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
    },
  },
  {
    id: 'por_cobrar',
    label: 'Por cobrar',
    icon: ArrowDownToLine,
    classes: {
      activo: 'bg-emerald-600 text-white',
      inactivo: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200',
    },
  },
  {
    id: 'por_pagar',
    label: 'Por pagar',
    icon: ArrowUpFromLine,
    classes: {
      activo: 'bg-red-600 text-white',
      inactivo: 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200',
    },
  },
  {
    id: 'vencidas',
    label: 'Vencidas',
    icon: Clock,
    classes: {
      activo: 'bg-amber-600 text-white',
      inactivo: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200',
    },
  },
  {
    id: 'saldadas',
    label: 'Saldadas',
    icon: Check,
    classes: {
      activo: 'bg-slate-700 text-white',
      inactivo: 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200',
    },
  },
];

const CHIPS_TIPO: Array<{
  id: TipoEntidadCC;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  classes: { activo: string; inactivo: string };
}> = [
  {
    id: 'cliente',
    label: 'Clientes',
    icon: UsersIcon,
    classes: {
      activo: 'bg-sky-600 text-white',
      inactivo: 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200',
    },
  },
  {
    id: 'proveedor',
    label: 'Proveedores',
    icon: Building,
    classes: {
      activo: 'bg-amber-600 text-white',
      inactivo: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200',
    },
  },
  {
    id: 'colaborador',
    label: 'Colaboradores',
    icon: Truck,
    classes: {
      activo: 'bg-purple-600 text-white',
      inactivo: 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200',
    },
  },
  {
    id: 'empleado',
    label: 'Empleados',
    icon: IdCard,
    classes: {
      activo: 'bg-emerald-600 text-white',
      inactivo: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200',
    },
  },
];

const RANGOS_FECHA: Array<{ id: RangoFecha; label: string }> = [
  { id: 'todos', label: 'Todo el periodo' },
  { id: 'ult_7d', label: 'Últimos 7 días' },
  { id: 'ult_30d', label: 'Últimos 30 días' },
  { id: 'ult_90d', label: 'Últimos 90 días' },
  { id: 'ult_6m', label: 'Últimos 6 meses' },
  { id: 'este_anio', label: 'Este año' },
];

const ORDENES: Array<{ id: OrdenLista; label: string }> = [
  { id: 'mayor_saldo', label: 'Mayor saldo' },
  { id: 'ultima_act', label: 'Última actividad' },
  { id: 'nombre', label: 'Nombre A-Z' },
];

export const FiltrosFinanzasBar: React.FC<FiltrosFinanzasBarProps> = ({
  estadoActivo,
  onCambiarEstado,
  tipoActivo,
  onCambiarTipo,
  rangoFecha,
  onCambiarRango,
  busqueda,
  onCambiarBusqueda,
  orden,
  onCambiarOrden,
  conteos,
}) => {
  // ── Dropdowns abiertos ──
  const [dropdownFechaOpen, setDropdownFechaOpen] = useState(false);
  const [dropdownOrdenOpen, setDropdownOrdenOpen] = useState(false);
  const refFecha = useRef<HTMLDivElement>(null);
  const refOrden = useRef<HTMLDivElement>(null);

  // Click outside handler para cerrar dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (refFecha.current && !refFecha.current.contains(e.target as Node)) {
        setDropdownFechaOpen(false);
      }
      if (refOrden.current && !refOrden.current.contains(e.target as Node)) {
        setDropdownOrdenOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const labelFecha = RANGOS_FECHA.find((r) => r.id === rangoFecha)?.label ?? 'Todo el periodo';
  const labelOrden = ORDENES.find((o) => o.id === orden)?.label ?? 'Mayor saldo';

  const hayFiltroActivo =
    estadoActivo !== 'todas' ||
    tipoActivo !== 'todos' ||
    rangoFecha !== 'todos' ||
    busqueda.trim() !== '' ||
    orden !== 'mayor_saldo';

  const limpiarTodo = () => {
    onCambiarEstado('todas');
    onCambiarTipo('todos');
    onCambiarRango('todos');
    onCambiarBusqueda('');
    onCambiarOrden('mayor_saldo');
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* ── 1. Date range dropdown ────────────────────────────────── */}
      <div ref={refFecha} className="relative">
        <button
          type="button"
          onClick={() => setDropdownFechaOpen((o) => !o)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all',
            rangoFecha === 'todos'
              ? 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
              : 'bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100',
          )}
        >
          <Calendar className="w-3.5 h-3.5" />
          {labelFecha}
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
        {dropdownFechaOpen && (
          <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px]">
            {RANGOS_FECHA.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onCambiarRango(r.id);
                  setDropdownFechaOpen(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-[12px] hover:bg-slate-50 transition-colors',
                  rangoFecha === r.id && 'bg-teal-50 text-teal-700 font-medium',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-5 w-px bg-slate-200 flex-shrink-0" />

      {/* ── 2. Estado chips ──────────────────────────────────────── */}
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex-shrink-0">
        Estado:
      </span>
      {CHIPS_ESTADO.map((chip) => {
        const Icon = chip.icon;
        const count =
          chip.id === 'todas'
            ? conteos.todas
            : chip.id === 'por_cobrar'
              ? conteos.porCobrar
              : chip.id === 'por_pagar'
                ? conteos.porPagar
                : chip.id === 'vencidas'
                  ? conteos.vencidas
                  : conteos.saldadas;
        const isActivo = estadoActivo === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onCambiarEstado(chip.id)}
            className={cn(
              'px-2.5 py-1 rounded-full text-[11px] inline-flex items-center gap-1 whitespace-nowrap transition-all font-medium',
              isActivo ? chip.classes.activo : chip.classes.inactivo,
              isActivo && 'shadow-sm',
            )}
          >
            <Icon className="w-3 h-3" />
            <span>{chip.label}</span>
            <span
              className={cn(
                'tabular-nums text-[10px] font-bold',
                isActivo ? 'text-white/90' : 'opacity-60',
              )}
            >
              {count}
            </span>
          </button>
        );
      })}

      <div className="h-5 w-px bg-slate-200 flex-shrink-0" />

      {/* ── 3. Tipo entidad chips ─────────────────────────────────── */}
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex-shrink-0">
        Tipo:
      </span>
      {CHIPS_TIPO.map((chip) => {
        const Icon = chip.icon;
        const count = conteos.porTipo[chip.id] || 0;
        const isActivo = tipoActivo === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onCambiarTipo(isActivo ? 'todos' : chip.id)}
            className={cn(
              'px-2.5 py-1 rounded-full text-[11px] inline-flex items-center gap-1 whitespace-nowrap transition-all font-medium',
              isActivo ? chip.classes.activo : chip.classes.inactivo,
              isActivo && 'shadow-sm',
            )}
          >
            <Icon className="w-3 h-3" />
            <span>{chip.label}</span>
            <span
              className={cn(
                'tabular-nums text-[10px] font-bold',
                isActivo ? 'text-white/90' : 'opacity-60',
              )}
            >
              {count}
            </span>
          </button>
        );
      })}

      <div className="h-5 w-px bg-slate-200 flex-shrink-0" />

      {/* ── 4. Búsqueda ────────────────────────────────────────────── */}
      <div className="relative flex-1 min-w-[200px] max-w-[280px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => onCambiarBusqueda(e.target.value)}
          placeholder="Buscar entidad..."
          className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
        />
      </div>

      {/* ── 5. Orden dropdown ─────────────────────────────────────── */}
      <div ref={refOrden} className="relative">
        <button
          type="button"
          onClick={() => setDropdownOrdenOpen((o) => !o)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all',
            orden === 'mayor_saldo'
              ? 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
              : 'bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100',
          )}
        >
          {labelOrden}
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
        {dropdownOrdenOpen && (
          <div className="absolute top-full right-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px]">
            {ORDENES.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onCambiarOrden(o.id);
                  setDropdownOrdenOpen(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-[12px] hover:bg-slate-50 transition-colors',
                  orden === o.id && 'bg-teal-50 text-teal-700 font-medium',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 6. Limpiar (condicional) ──────────────────────────────── */}
      {hayFiltroActivo && (
        <button
          type="button"
          onClick={limpiarTodo}
          className="ml-auto text-[11px] font-medium text-teal-600 hover:text-teal-700 inline-flex items-center gap-1 transition-colors px-2 py-1 flex-shrink-0"
        >
          <X className="w-3 h-3" />
          Limpiar filtros
        </button>
      )}
    </div>
  );
};
