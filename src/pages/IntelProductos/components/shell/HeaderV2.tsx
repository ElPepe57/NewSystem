/**
 * HeaderV2 · header canon Cost Intelligence
 *
 * Patrón Notion · breadcrumb ChevronRight + h1 con icon teal + subtítulo
 * descriptivo + acciones primary-soft. Defensa `flex-1 min-w-[260px]` para
 * evitar colapso de subtítulo en viewports estrechos (F1.1 canon).
 *
 * Mockup canónico: docs/mockups/cost-intelligence-vision-s3.6.html · sección 2 header
 */

import React from 'react';
import { ChevronRight, BrainCircuit, RefreshCw, Download } from 'lucide-react';

interface HeaderV2Props {
  /** Nombre del workspace activo (ej. "Catálogo · 142 productos") */
  workspaceLabel: string;
  /** Subtitle ejecutivo · cambia según workspace */
  subtitle?: string;
  /** Loading flag para spinear el botón Recalcular */
  loading?: boolean;
  onRecalcular?: () => void;
  onExport?: () => void;
}

export const HeaderV2: React.FC<HeaderV2Props> = ({
  workspaceLabel,
  subtitle,
  loading,
  onRecalcular,
  onExport,
}) => {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
      {/* canon F1.1 · min-w-[260px] evita colapso del subtítulo · ver chk5.A8/A14 */}
      <div className="flex-1 min-w-[260px]">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
          <span className="hover:text-teal-600 cursor-pointer">Inteligencia</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-600 font-medium">{workspaceLabel}</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
          <BrainCircuit className="w-6 h-6 text-teal-600" />
          Cost Intelligence
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {subtitle ?? 'Análisis estratégico de costos · evolución temporal · variance attribution · sugerencias accionables'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {onRecalcular && (
          <button
            type="button"
            onClick={onRecalcular}
            disabled={loading}
            className="text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Recalcular
          </button>
        )}
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            className="text-xs font-medium text-white bg-slate-900 rounded-lg px-3 py-2 hover:bg-slate-800 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Reporte ejecutivo
          </button>
        )}
      </div>
    </div>
  );
};
