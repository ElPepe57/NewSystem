/**
 * HeaderGastos · header canon banking-grade · Gastos rework v3
 *
 * chk5.C1 (S3.6 M3 · Gastos Rework) · pixel-perfect contra mockup canon
 * `gastos-rework-v3-final.html · Sección 1 · header`.
 *
 * DESKTOP/MOBILE responsive:
 *   - Breadcrumb · h1 con icon teal · subtítulo
 *   - Acciones: Política asignación · Ver P&L → · Exportar · Nuevo gasto manual
 *   - Cero emojis · solo lucide-icons
 *
 * Cross-link "Ver P&L →" lleva a Contabilidad (placeholder MVP · activable cuando
 * el módulo Contabilidad tenga su vista canon).
 */

import React from 'react';
import { ChevronRight, Receipt, Settings, FileBarChart, Download, Plus, ExternalLink } from 'lucide-react';

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
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 mb-4">
      {/* chk5.C-UX-PASS · canon v8.0 · U1 · Header banking-grade 2 filas */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        {/* canon v9.0 M1 · breadcrumb sin transition-colors defensivos */}
        <span className="hover:text-teal-600 cursor-pointer">Finanzas</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium">
          Gastos · {totalMovimientosMes.toLocaleString('es-PE')} movimientos este mes
        </span>
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        {/* canon F1.1 · min-w-[260px] evita colapso del subtítulo */}
        <div className="flex-1 min-w-[260px]">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 flex items-center gap-2 sm:gap-2.5">
            {/* canon v8.0 N1 · gradient icon teal-50 → teal-100 + ring sutil */}
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 ring-1 ring-teal-200/50 flex items-center justify-center flex-shrink-0">
              <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-teal-700" />
            </div>
            Gastos
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
          {/* canon v8.0 N10 · primary CTA · teal-600 (no slate-900) */}
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
  );
};
