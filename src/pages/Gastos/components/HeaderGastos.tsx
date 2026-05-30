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
  /** Leaf del breadcrumb S9.D1 (tab activa) · null/undefined = tab Resumen (default · 2 niveles) */
  breadcrumbLeaf?: string | null;
  /** Click en "Gastos" del breadcrumb → vuelve a tab Resumen (solo cuando hay leaf) */
  onVolverResumen?: () => void;
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
  breadcrumbLeaf,
  onVolverResumen,
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
    <>
      {/* §A · TOP-BAR · breadcrumb S9.D1 + chip de rol contextual (canon hub) */}
      <div className="border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center gap-3 bg-slate-50">
        <div className="flex items-center text-[12px] flex-1 min-w-0">
          <span className="text-slate-500 hover:text-teal-700 cursor-pointer flex-shrink-0">Inicio</span>
          <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5 flex-shrink-0" />
          {breadcrumbLeaf ? (
            <>
              {/* canon S9.D1 · "Gastos" clickable vuelve a tab Resumen · leaf = tab activa */}
              <span
                onClick={onVolverResumen}
                className="text-slate-500 hover:text-teal-700 cursor-pointer flex-shrink-0"
              >
                Gastos
              </span>
              <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5 flex-shrink-0" />
              <span className="text-slate-900 font-semibold truncate">{breadcrumbLeaf}</span>
            </>
          ) : (
            <span className="text-slate-900 font-semibold truncate">Gastos</span>
          )}
        </div>
        <span className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded font-bold hidden sm:inline-flex items-center gap-1 flex-shrink-0">
          <Shield className="w-3 h-3" />
          {esAdmin ? 'Vista ejecutiva · admin' : 'Vista ejecutiva'}
        </span>
      </div>

      {/* §B · HEADER banking-grade · icono hermano del bloque título+subtítulo · acciones 3-tier (N10)
          PIXEL-PERFECT mockup ACTO 1 §B · icono w-11 fuera del h1 · botones py-1.5 text-[11px] */}
      <div className="px-4 sm:px-6 py-5 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 flex-1 min-w-[260px]">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-teal-50 to-teal-100 ring-1 ring-teal-200/50">
              <Receipt className="w-6 h-6 text-teal-700" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gastos</h1>
              <p className="text-[13px] text-slate-500 leading-snug">
                Consolidador de gastos · manuales + auto-generados por OC/Envío/Venta · separación gasto/pago canon.
              </p>
            </div>
          </div>

          {/* Acciones · canon v8.0 N10 · 3-tier jerarquía cromática */}
          <div className="flex items-center gap-2 flex-wrap justify-end max-w-full">
            {onPoliticaAsignacion && (
              <button
                type="button"
                onClick={onPoliticaAsignacion}
                className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <Settings className="w-3 h-3" />
                <span className="hidden lg:inline">Política asignación</span>
                <span className="lg:hidden">Política</span>
              </button>
            )}
            {onVerPnL && (
              <button
                type="button"
                onClick={onVerPnL}
                className="text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                title="Ver P&L en Contabilidad"
              >
                <FileBarChart className="w-3 h-3" />
                <span className="hidden lg:inline">Ver P&L</span>
                <ExternalLink className="w-3 h-3 opacity-50" />
              </button>
            )}
            {onExportar && (
              <button
                type="button"
                onClick={onExportar}
                disabled={exportDisabled}
                className="text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Download className="w-3 h-3" />
                <span className="hidden lg:inline">Exportar</span>
              </button>
            )}
            {/* canon v8.0 N10 · primary CTA · teal-600 */}
            <button
              type="button"
              onClick={onNuevoGasto}
              className="text-[11px] font-bold text-white bg-teal-600 hover:bg-teal-700 px-4 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nuevo gasto manual</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
