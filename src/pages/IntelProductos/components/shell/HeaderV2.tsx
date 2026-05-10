/**
 * HeaderV2 · header canon Cost Intelligence · banking-grade F1 + F12
 *
 * chk5.B4 (S3.6 M1.bis · Cost Intelligence) · refactor pixel-perfect contra
 * canon Productos V2. Espejo de `src/pages/Productos/components/shell/HeaderV2.tsx`
 * adaptado a las acciones específicas de Cost Intelligence.
 *
 * DESKTOP (≥lg):
 *   - Breadcrumb · h1 con icon teal + subtítulo max-w-2xl
 *   - 4 acciones inline: Sugerencias del día · Recalcular · Exportar · Reporte ejecutivo
 *
 * MOBILE (<lg):
 *   - Breadcrumb compacto · h1 + subtítulo
 *   - 1 CTA primario "Reporte ejecutivo" + chip lightbulb + dropdown "Más" con secundarias
 *
 * Mockup canónico: docs/mockups/cost-intelligence-canon-productos.html · Sección 1+3
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronRight,
  BrainCircuit,
  Lightbulb,
  RefreshCw,
  Download,
  FileText,
  MoreHorizontal,
} from 'lucide-react';

interface HeaderV2Props {
  /** Workspace label cambia según workspace activo · va en el breadcrumb */
  workspaceLabel: string;
  /** Subtitle ejecutivo · cambia según workspace */
  subtitle?: string;
  /** Loading flag para spinear el botón Recalcular */
  loading?: boolean;
  onSugerencias?: () => void;
  onRecalcular?: () => void;
  onExport?: () => void;
  onReporte?: () => void;
}

export const HeaderV2: React.FC<HeaderV2Props> = ({
  workspaceLabel,
  subtitle,
  loading,
  onSugerencias,
  onRecalcular,
  onExport,
  onReporte,
}) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close mobile dropdown on outside click
  useEffect(() => {
    if (!showMobileMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMobileMenu]);

  // Cuántas acciones secundarias hay disponibles (para mostrar/ocultar dropdown mobile)
  const hasSecondaryActions = !!(onRecalcular || onExport);

  return (
    <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
      {/* Lado izquierdo · breadcrumb + título · IGUAL en mobile/desktop */}
      {/* canon F1.1 · min-w-[260px] evita colapso del subtítulo cuando los botones llenan el ancho */}
      <div className="flex-1 min-w-[260px]">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
          <span className="hover:text-teal-600 transition-colors cursor-pointer">Inteligencia</span>
          <ChevronRight className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
          <span className="text-slate-600 font-medium truncate">{workspaceLabel}</span>
        </div>
        <h1 className="text-lg lg:text-2xl font-bold text-slate-900 flex items-center gap-2 lg:gap-2.5">
          <BrainCircuit className="w-5 h-5 lg:w-6 lg:h-6 text-teal-600" />
          Cost Intelligence
        </h1>
        <p className="text-xs lg:text-sm text-slate-500 mt-0.5 max-w-2xl">
          {subtitle ?? 'Análisis estratégico de costos · evolución temporal · variance attribution · sugerencias accionables.'}
        </p>
      </div>

      {/* ═══════ DESKTOP (≥lg) · Todas las acciones inline ═══════ */}
      <div className="hidden lg:flex items-center gap-2 flex-wrap flex-shrink-0">
        {onSugerencias && (
          <button
            type="button"
            onClick={onSugerencias}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-all"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Sugerencias del día
          </button>
        )}
        {onRecalcular && (
          <button
            type="button"
            onClick={onRecalcular}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Recalcular
          </button>
        )}
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
        )}
        {onReporte && (
          <button
            type="button"
            onClick={onReporte}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-all shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" />
            Reporte ejecutivo
          </button>
        )}
      </div>

      {/* ═══════ MOBILE (<lg) · 1 CTA primario + dropdown "Más" (F12) ═══════ */}
      <div className="lg:hidden w-full flex items-center gap-1.5 mt-2">
        {onReporte && (
          <button
            type="button"
            onClick={onReporte}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" />
            Reporte ejecutivo
          </button>
        )}

        {/* Sugerencias visible por su importancia (cuando llegue) · resto en dropdown */}
        {onSugerencias && (
          <button
            type="button"
            onClick={onSugerencias}
            aria-label="Sugerencias del día"
            className="flex items-center justify-center gap-1 px-3 py-2.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg"
          >
            <Lightbulb className="w-3.5 h-3.5" />
          </button>
        )}

        {hasSecondaryActions && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setShowMobileMenu((v) => !v)}
              aria-label="Más acciones"
              className="flex items-center justify-center px-3 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMobileMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-30 overflow-hidden">
                {onRecalcular && (
                  <button
                    type="button"
                    onClick={() => {
                      onRecalcular();
                      setShowMobileMenu(false);
                    }}
                    disabled={loading}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 text-left disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-slate-500 flex-shrink-0 ${loading ? 'animate-spin' : ''}`} />
                    Recalcular
                  </button>
                )}
                {onExport && (
                  <button
                    type="button"
                    onClick={() => {
                      onExport();
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 text-left border-t border-slate-100"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    Exportar
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
