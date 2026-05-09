/**
 * HeaderV2 · header banking-grade canónico para módulo Inventario
 *
 * Pixel-perfect canon F1 + F1.1 (S58f + S3.3).
 *   - Breadcrumb superior con ChevronRight separator (canon F9)
 *   - h1 con icon teal · texto bold tracking-tight
 *   - Subtítulo descriptivo · `flex-1 min-w-[260px]` (canon F1.1 anti-colapso)
 *   - Acciones a la derecha · estilo secundario plano (canon F10)
 *
 * Reusa exactamente la estructura aprobada del mockup stock-rediseno-s58f.
 * Promocionable a design-system si otros módulos adoptan el mismo patrón;
 * por ahora vive aquí page-scoped (S3.6 M1 chk4.2).
 */

import React from 'react';
import { ChevronRight, Warehouse, RefreshCw, Download } from 'lucide-react';

interface HeaderV2Props {
  /** Texto del crumb padre (ej: "Logística"). Click navega o filtra · opcional. */
  parentCrumb?: string;
  /** Texto del crumb hoja (current page · ej: "Stock · Inventario operativo"). */
  currentCrumb: string;
  /** Título h1. */
  titulo: string;
  /** Subtítulo descriptivo de 1-2 líneas. */
  subtitulo: string;
  /** Estado de carga del botón Sincronizar. */
  sincronizando?: boolean;
  /** Handler del botón Sincronizar. */
  onSincronizar?: () => void;
  /** Handler del botón Exportar. */
  onExportar?: () => void;
  /** Disabled state del botón Exportar (sin datos). */
  exportarDisabled?: boolean;
}

export const HeaderV2: React.FC<HeaderV2Props> = ({
  parentCrumb = 'Logística',
  currentCrumb,
  titulo,
  subtitulo,
  sincronizando = false,
  onSincronizar,
  onExportar,
  exportarDisabled = false,
}) => {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex-1 min-w-[260px]">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
          <span className="hover:text-teal-600 transition-colors cursor-pointer">{parentCrumb}</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-600 font-medium">{currentCrumb}</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
          <Warehouse className="w-6 h-6 text-teal-600" />
          {titulo}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">
          {subtitulo}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {onSincronizar && (
          <button
            type="button"
            onClick={onSincronizar}
            disabled={sincronizando}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all disabled:opacity-50"
            title="Sincronizar desde origen"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>
        )}
        {onExportar && (
          <button
            type="button"
            onClick={onExportar}
            disabled={exportarDisabled}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        )}
      </div>
    </div>
  );
};
