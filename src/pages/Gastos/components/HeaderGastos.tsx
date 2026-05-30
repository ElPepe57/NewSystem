/**
 * HeaderGastos · shell-top canon HUB · Gastos rework v5.2 (2026-05-30)
 *
 * Anatomía hub (canon "ARQUITECTURA DE MÓDULO · HUB CON TABS"):
 *   - Top-bar bg-slate-50 · breadcrumb S9.D1 (Inicio › Gastos) + chip de rol
 *     contextual teal (canon "admin ve todo")
 *   - Header banking-grade · icon teal + h1 + subtítulo + acciones 3-tier (N10)
 *
 * Card autocontenido (overflow-hidden) · Gastos.tsx lo usa tal cual.
 * Pixel-perfect contra docs/mockups/gastos-v5.2-integral.html · ACTO 1.
 */

import React from 'react';
import {
  ChevronRight, Receipt, Settings, FileBarChart, Download, Plus, ExternalLink, Shield,
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { hasRole } from '../../../types/auth.types';

interface HeaderGastosProps {
  totalMovimientosMes: number;
  /** Click "Política asignación" → abre AllocationEngineSettings (F9) */
  onPoliticaAsignacion?: () => void;
  /** Click "Ver P&L" → navega a Contabilidad · placeholder MVP */
  onVerPnL?: () => void;
  /** Click "Exportar" → invoca exportService */
  onExportar?: () => void;
  /** Click "Nuevo gasto manual" → abre GastoForm modal */
  onNuevoGasto: () => void;
  /** Si true, deshabilita Exportar (sin data) */
  exportDisabled?: boolean;
}

export const HeaderGastos: React.FC<HeaderGastosProps> = ({
  totalMovimientosMes,
  onPoliticaAsignacion,
  onVerPnL,
  onExportar,
  onNuevoGasto,
  exportDisabled = false,
}) => {
  // Canon "admin ve todo" · chip contextual al rol del top-bar (alineado a hermanos)
  const userProfile = useAuthStore((s) => s.userProfile);
  const esAdmin = hasRole(userProfile, 'admin');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4">
      {/* §A · TOP-BAR · breadcrumb S9.D1 + chip de rol contextual (canon hub) */}
      <div className="border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center gap-3 bg-slate-50">
        <div className="flex items-center text-[12px] flex-1 min-w-0">
          <span className="text-slate-500 hover:text-teal-700 cursor-pointer flex-shrink-0">Inicio</span>
          <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5 flex-shrink-0" />
          <span className="text-slate-900 font-semibold truncate">Gastos</span>
        </div>
        <span className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded font-bold hidden sm:inline-flex items-center gap-1 flex-shrink-0">
          <Shield className="w-3 h-3" />
          {esAdmin ? 'Vista ejecutiva · admin' : 'Vista ejecutiva'}
        </span>
      </div>

      {/* §B · HEADER banking-grade · icon teal + h1 + subtítulo + acciones 3-tier (N10) */}
      <div className="px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 flex items-center gap-2 sm:gap-2.5">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 ring-1 ring-teal-200/50 flex items-center justify-center flex-shrink-0">
                <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-teal-700" />
              </div>
              Gastos
              {totalMovimientosMes > 0 && (
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full tabular-nums">
                  {totalMovimientosMes.toLocaleString('es-PE')} este mes
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
              Consolidador de gastos · manuales + auto-generados por OC/Envío/Venta · separación gasto/pago canon.
            </p>
          </div>

          {/* Acciones · canon v8.0 N10 · 3-tier jerarquía cromática */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap flex-shrink-0">
            {onPoliticaAsignacion && (
              <button
                type="button"
                onClick={onPoliticaAsignacion}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Política asignación</span>
                <span className="lg:hidden">Política</span>
              </button>
            )}
            {onVerPnL && (
              <button
                type="button"
                onClick={onVerPnL}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                title="Ver P&L en Contabilidad"
              >
                <FileBarChart className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Ver P&L</span>
                <ExternalLink className="w-3 h-3 opacity-50" />
              </button>
            )}
            {onExportar && (
              <button
                type="button"
                onClick={onExportar}
                disabled={exportDisabled}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Exportar</span>
              </button>
            )}
            {/* canon v8.0 N10 · primary CTA · teal-600 */}
            <button
              type="button"
              onClick={onNuevoGasto}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nuevo gasto manual</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
