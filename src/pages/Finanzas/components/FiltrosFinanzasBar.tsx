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

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  | 'este_anio'
  | 'custom';

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
  // Solo aplica cuando rangoFecha === 'custom'. Formato 'YYYY-MM-DD'.
  fechaDesde?: string;
  fechaHasta?: string;
  onCambiarFechasCustom?: (desde: string, hasta: string) => void;

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
  { id: 'custom', label: 'Personalizado…' },
];

// Formatea una fecha 'YYYY-MM-DD' a un label corto tipo "12 abr".
function formatearFechaCorta(yyyymmdd: string): string {
  if (!yyyymmdd) return '—';
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  if (!y || !m || !d) return yyyymmdd;
  const fecha = new Date(y, m - 1, d);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} ${meses[fecha.getMonth()]}`;
}

// ── Helpers para el mini-calendar ──────────────────────────────────────
const MESES_LARGOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function aYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function deYYYYMMDD(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Mini-calendario inline con selección de rango visual estilo Stripe/Linear.
 * Click 1 = desde · Click 2 = hasta (auto-swap si hasta < desde) ·
 * Click 3 = reinicia con nuevo desde.
 */
const MiniCalendarRange: React.FC<{
  desde: string;
  hasta: string;
  onCambiar: (desde: string, hasta: string) => void;
}> = ({ desde, hasta, onCambiar }) => {
  const dDesde = deYYYYMMDD(desde);
  const dHasta = deYYYYMMDD(hasta);

  // Mes que se está mostrando (default: mes de "desde" o mes actual)
  const [mesVisible, setMesVisible] = useState<Date>(() => {
    if (dDesde) return new Date(dDesde.getFullYear(), dDesde.getMonth(), 1);
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  });

  // Hover preview del rango antes de hacer click final
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  const navegarMes = (delta: number) => {
    setMesVisible((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  // Genera la grilla del mes (incluye días del mes anterior/siguiente para alinear)
  const dias = useMemo(() => {
    const primero = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1);
    const ultimo = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 0);
    // Día de la semana del primero (0=dom, ajustamos a 0=lun)
    let diaSemanaPrimero = primero.getDay() - 1;
    if (diaSemanaPrimero < 0) diaSemanaPrimero = 6;

    const result: Array<{ fecha: Date; esDelMes: boolean }> = [];
    // Días del mes anterior para llenar la primera fila
    for (let i = diaSemanaPrimero - 1; i >= 0; i--) {
      const d = new Date(primero);
      d.setDate(d.getDate() - i - 1);
      result.push({ fecha: d, esDelMes: false });
    }
    // Días del mes
    for (let d = 1; d <= ultimo.getDate(); d++) {
      result.push({
        fecha: new Date(mesVisible.getFullYear(), mesVisible.getMonth(), d),
        esDelMes: true,
      });
    }
    // Completa la última fila
    while (result.length % 7 !== 0) {
      const last = result[result.length - 1].fecha;
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      result.push({ fecha: d, esDelMes: false });
    }
    return result;
  }, [mesVisible]);

  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const handleClickDia = (fecha: Date) => {
    const yyyymmdd = aYYYYMMDD(fecha);

    // Caso 1: no hay desde → poner desde
    if (!dDesde) {
      onCambiar(yyyymmdd, '');
      return;
    }
    // Caso 2: hay desde pero no hasta → poner hasta (auto-swap si necesario)
    if (dDesde && !dHasta) {
      if (fecha.getTime() < dDesde.getTime()) {
        onCambiar(yyyymmdd, aYYYYMMDD(dDesde));
      } else {
        onCambiar(aYYYYMMDD(dDesde), yyyymmdd);
      }
      return;
    }
    // Caso 3: ya hay ambos → reiniciar con nuevo desde
    onCambiar(yyyymmdd, '');
  };

  // Determina el estado visual de cada día
  const estadoDia = (fecha: Date): 'desde' | 'hasta' | 'unico' | 'rango' | 'preview' | 'hoy' | 'normal' => {
    const hoy = new Date();
    const esHoy = mismoDia(fecha, hoy);

    if (dDesde && dHasta) {
      if (mismoDia(fecha, dDesde) && mismoDia(fecha, dHasta)) return 'unico';
      if (mismoDia(fecha, dDesde)) return 'desde';
      if (mismoDia(fecha, dHasta)) return 'hasta';
      if (fecha.getTime() > dDesde.getTime() && fecha.getTime() < dHasta.getTime()) return 'rango';
    } else if (dDesde && !dHasta) {
      if (mismoDia(fecha, dDesde)) return 'desde';
      // Preview del rango con hover
      if (hoverDate) {
        const start = dDesde.getTime() < hoverDate.getTime() ? dDesde : hoverDate;
        const end = dDesde.getTime() < hoverDate.getTime() ? hoverDate : dDesde;
        if (fecha.getTime() > start.getTime() && fecha.getTime() < end.getTime()) return 'preview';
        if (mismoDia(fecha, hoverDate) && !mismoDia(fecha, dDesde)) return 'preview';
      }
    }
    if (esHoy) return 'hoy';
    return 'normal';
  };

  const limpiar = () => onCambiar('', '');

  const irHoy = () => {
    const hoy = new Date();
    setMesVisible(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  };

  return (
    <div className="w-[280px]">
      {/* Header navegación mes */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          type="button"
          onClick={() => navegarMes(-1)}
          className="w-7 h-7 rounded-md hover:bg-slate-100 inline-flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={irHoy}
          className="text-[12px] font-semibold text-slate-700 hover:text-teal-700 transition-colors px-2 py-1 rounded-md hover:bg-slate-50"
        >
          {MESES_LARGOS[mesVisible.getMonth()]} {mesVisible.getFullYear()}
        </button>
        <button
          type="button"
          onClick={() => navegarMes(1)}
          className="w-7 h-7 rounded-md hover:bg-slate-100 inline-flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Grid de días */}
      <div className="grid grid-cols-7 gap-y-0.5 mb-2">
        {DIAS_CORTOS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] uppercase tracking-wider text-slate-400 font-semibold py-1"
          >
            {d}
          </div>
        ))}
        {dias.map(({ fecha, esDelMes }, idx) => {
          const estado = estadoDia(fecha);
          // Bordes del rango (preview o real) para efecto de "barra"
          const enRango = estado === 'rango' || estado === 'preview';
          return (
            <div key={idx} className="relative h-8 flex items-center justify-center">
              {/* Fondo del rango (capa atrás del círculo) */}
              {enRango && (
                <div className="absolute inset-y-1 inset-x-0 bg-teal-50" />
              )}
              {/* Tail del extremo desde para conectar con el rango */}
              {(estado === 'desde' && (dHasta || hoverDate)) && (
                <div className="absolute inset-y-1 right-0 left-1/2 bg-teal-50" />
              )}
              {(estado === 'hasta') && (
                <div className="absolute inset-y-1 left-0 right-1/2 bg-teal-50" />
              )}
              <button
                type="button"
                onClick={() => handleClickDia(fecha)}
                onMouseEnter={() => setHoverDate(fecha)}
                onMouseLeave={() => setHoverDate(null)}
                disabled={!esDelMes}
                className={cn(
                  'relative z-10 w-7 h-7 rounded-full text-[12px] font-medium transition-all inline-flex items-center justify-center tabular-nums',
                  !esDelMes && 'text-slate-300 cursor-default',
                  esDelMes && estado === 'normal' && 'text-slate-700 hover:bg-slate-100',
                  esDelMes && estado === 'hoy' && 'text-teal-700 font-semibold ring-1 ring-teal-300 hover:bg-teal-50',
                  estado === 'desde' && 'bg-teal-600 text-white shadow-sm hover:bg-teal-700',
                  estado === 'hasta' && 'bg-teal-600 text-white shadow-sm hover:bg-teal-700',
                  estado === 'unico' && 'bg-teal-600 text-white shadow-sm hover:bg-teal-700',
                  estado === 'rango' && 'text-teal-700 hover:bg-teal-100',
                  estado === 'preview' && 'text-teal-700 hover:bg-teal-100',
                )}
              >
                {fecha.getDate()}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer con resumen + acciones */}
      <div className="border-t border-slate-100 pt-2 flex items-center justify-between gap-2">
        <div className="text-[11px] text-slate-600 flex-1">
          {dDesde && dHasta ? (
            <span className="font-medium">
              {formatearFechaCorta(desde)} – {formatearFechaCorta(hasta)}
            </span>
          ) : dDesde ? (
            <span>
              <span className="text-slate-400">Desde</span>{' '}
              <span className="font-medium">{formatearFechaCorta(desde)}</span>
              <span className="text-slate-400 ml-1">· elige fin</span>
            </span>
          ) : (
            <span className="text-slate-400">Selecciona el inicio</span>
          )}
        </div>
        {(dDesde || dHasta) && (
          <button
            type="button"
            onClick={limpiar}
            className="text-[11px] font-medium text-slate-500 hover:text-teal-700 transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
};

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
  fechaDesde = '',
  fechaHasta = '',
  onCambiarFechasCustom,
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

  // Cuando es custom, el label muestra el rango: "12 abr – 28 abr"
  const labelFecha = (() => {
    if (rangoFecha === 'custom' && (fechaDesde || fechaHasta)) {
      return `${formatearFechaCorta(fechaDesde)} – ${formatearFechaCorta(fechaHasta)}`;
    }
    return RANGOS_FECHA.find((r) => r.id === rangoFecha)?.label ?? 'Todo el periodo';
  })();
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
    <div className="space-y-3">
      {/* ─── FILA 1 · Filtros principales (chips toggleables) ────────── */}
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
          <div
            className={cn(
              'absolute top-full left-0 mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-xl py-1',
              rangoFecha === 'custom' ? 'min-w-[320px]' : 'min-w-[220px]',
            )}
          >
            {RANGOS_FECHA.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onCambiarRango(r.id);
                  // Si elige preset distinto de custom, cierra. Si elige
                  // 'custom', deja abierto para que vea los inputs de fecha.
                  if (r.id !== 'custom') setDropdownFechaOpen(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-[12px] hover:bg-slate-50 transition-colors',
                  rangoFecha === r.id && 'bg-teal-50 text-teal-700 font-medium',
                )}
              >
                {r.label}
              </button>
            ))}

            {/* Mini-calendario inline — visible al elegir Personalizado.
                Reemplaza inputs nativos type="date" por un calendar con
                selección visual de rango estilo Stripe/Linear/Mercury. */}
            {rangoFecha === 'custom' && (
              <div className="border-t border-slate-100 mt-1 pt-3 px-3 pb-3">
                <MiniCalendarRange
                  desde={fechaDesde}
                  hasta={fechaHasta}
                  onCambiar={(d, h) => onCambiarFechasCustom?.(d, h)}
                />
                {fechaDesde && fechaHasta && (
                  <div className="flex justify-end pt-2 mt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setDropdownFechaOpen(false)}
                      className="text-[11px] px-3 py-1.5 rounded-md font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                    >
                      Aplicar
                    </button>
                  </div>
                )}
              </div>
            )}
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

      </div>
      {/* ─── /FILA 1 ─────────────────────────────────────────────────── */}

      {/* Divider sutil entre las 2 filas */}
      <div className="border-t border-slate-100" />

      {/* ─── FILA 2 · Búsqueda + ordenamiento + limpiar ──────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Búsqueda — input prominente con ícono y botón × clear */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => onCambiarBusqueda(e.target.value)}
            placeholder="Buscar por nombre de cliente, proveedor o colaborador…"
            className="w-full pl-9 pr-9 py-2 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white placeholder:text-slate-400 transition-all"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => onCambiarBusqueda('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Orden dropdown — etiqueta "Ordenar por" para claridad semántica */}
        <div ref={refOrden} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setDropdownOrdenOpen((o) => !o)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all',
              orden === 'mayor_saldo'
                ? 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                : 'bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100',
            )}
          >
            <span className="text-slate-400 font-normal text-[11px]">Ordenar:</span>
            <span>{labelOrden}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          {dropdownOrdenOpen && (
            <div className="absolute top-full right-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px]">
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

        {/* Limpiar (condicional) */}
        {hayFiltroActivo && (
          <button
            type="button"
            onClick={limpiarTodo}
            className="text-[12px] font-medium text-teal-600 hover:text-teal-700 inline-flex items-center gap-1 transition-colors px-3 py-2 rounded-lg hover:bg-teal-50 flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            Limpiar filtros
          </button>
        )}
      </div>
      {/* ─── /FILA 2 ─────────────────────────────────────────────────── */}
    </div>
  );
};
