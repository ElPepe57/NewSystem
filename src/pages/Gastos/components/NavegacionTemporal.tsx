/**
 * NavegacionTemporal · navegación mensual canon · Gastos rework v4
 *
 * chk5.C-UX-PASS (2026-05-11) · refactor con canon v8.0:
 *   - U5 · eliminado toggle "Solo pendientes" (era duplicado con chip Estado=Pendiente)
 *   - Compacto en 1 fila desktop con LineaDropdown + Período + Hoy
 *   - Responsive: mobile muestra solo iconos navegación · md:+ muestra labels mes
 *
 * Patrón: [LineaDropdown global] · ← [Mes anterior] · [Mes actual · año] · [Mes siguiente] →
 *
 * Mockup referencia: `gastos-rework-v4-responsive-color.html · Sección 3 · toolbar`.
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface NavegacionTemporalProps {
  /** Mes seleccionado (1-12) */
  selectedMonth: number;
  /** Año seleccionado */
  selectedYear: number;
  /** Click "← mes anterior" */
  onPrevMonth: () => void;
  /** Click "mes siguiente →" */
  onNextMonth: () => void;
  /** Click "Hoy" (vuelve al mes actual) */
  onGoToCurrentMonth: () => void;
  /** true si el mes seleccionado es el mes actual (deshabilita botón next + oculta "Hoy") */
  isCurrentMonth: boolean;
  /**
   * Slot al FINAL · LineaDropdown global se renderiza aquí (canon v4 mockup)
   * Reemplaza el antiguo `leadingSlot` · ahora la línea va a la derecha del todo
   */
  trailingSlot?: React.ReactNode;
}

export const NavegacionTemporal: React.FC<NavegacionTemporalProps> = ({
  selectedMonth,
  selectedYear,
  onPrevMonth,
  onNextMonth,
  onGoToCurrentMonth,
  isCurrentMonth,
  trailingSlot,
}) => {
  const mesNombre = MONTH_NAMES[selectedMonth - 1] ?? '—';
  const mesAnteriorNombre = MONTH_NAMES[((selectedMonth - 2 + 12) % 12)] ?? '—';
  const mesSiguienteNombre = MONTH_NAMES[selectedMonth % 12] ?? '—';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Navegación temporal PRIMERO · canon v8.0 mockup v4 */}
      <button
        type="button"
        onClick={onPrevMonth}
        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
        title={`Ir a ${mesAnteriorNombre}`}
      >
        <ChevronLeft className="w-3 h-3" />
        <span className="hidden sm:inline">{mesAnteriorNombre}</span>
      </button>
      <span className="text-[12px] font-bold text-slate-900 tabular-nums px-2 min-w-[100px] sm:min-w-[120px] text-center">
        {mesNombre} {selectedYear}
      </span>
      <button
        type="button"
        onClick={onNextMonth}
        disabled={isCurrentMonth}
        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title={isCurrentMonth ? 'Ya estás en el mes actual' : `Ir a ${mesSiguienteNombre}`}
      >
        <span className="hidden sm:inline">{mesSiguienteNombre}</span>
        <ChevronRight className="w-3 h-3" />
      </button>

      {!isCurrentMonth && (
        <button
          type="button"
          onClick={onGoToCurrentMonth}
          className="text-[11px] font-medium text-teal-700 hover:text-teal-800 underline"
        >
          Hoy
        </button>
      )}

      {/* Separator antes del trailingSlot (si hay) */}
      {trailingSlot && <span className="hidden md:inline text-[10px] text-slate-400 mx-1">·</span>}

      {/* Slot AL FINAL · LineaDropdown global · canon v4 mockup */}
      {trailingSlot}
    </div>
  );
};
