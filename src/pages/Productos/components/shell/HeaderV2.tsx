/**
 * HeaderV2 · header banking-grade del listado de Productos V2 (F1)
 *
 * Mockup canónico: docs/mockups/productos/01-page-listado.html (header)
 *
 * Decisiones de diseño:
 *   - Breadcrumb chevron-right separator (F9 canónico)
 *   - h1 con icono teal-600 + título + subtítulo descriptivo
 *   - Acciones: Calculadora · Archivo (con badge count) · Importar · Exportar · Nuevo producto (CTA primary)
 *   - Las acciones se reciben como callbacks · este componente NO maneja state
 */

import React from 'react';
import { Calculator, Trash2, Upload, Download, Plus, Package, ChevronRight, Lightbulb } from 'lucide-react';

interface HeaderV2Props {
  archivadosCount?: number;
  onClickCalculadora?: () => void;
  onClickArchivo?: () => void;
  onClickImportar?: () => void;
  onClickExportar?: () => void;
  onClickNuevo?: () => void;
  onClickSugerencias?: () => void;
}

export const HeaderV2: React.FC<HeaderV2Props> = ({
  archivadosCount = 0,
  onClickCalculadora,
  onClickArchivo,
  onClickImportar,
  onClickExportar,
  onClickNuevo,
  onClickSugerencias,
}) => {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
          <span className="hover:text-teal-600 transition-colors cursor-pointer">Catálogo</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-600 font-medium">Productos · Maestro de SKUs</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
          <Package className="w-6 h-6 text-teal-600" />
          Productos
        </h1>
        <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">
          Catálogo maestro · qué vendemos, cómo se configura, qué cuesta traerlo y cuánto se gana.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {onClickSugerencias && (
          <button
            onClick={onClickSugerencias}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-all"
            type="button"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Sugerencias del día
          </button>
        )}
        {onClickCalculadora && (
          <button
            onClick={onClickCalculadora}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-all"
            type="button"
          >
            <Calculator className="w-3.5 h-3.5" />
            Inteligencia
          </button>
        )}
        {onClickArchivo && (
          <button
            onClick={onClickArchivo}
            className="relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
            type="button"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Archivo
            {archivadosCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {archivadosCount}
              </span>
            )}
          </button>
        )}
        {onClickImportar && (
          <button
            onClick={onClickImportar}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
            type="button"
          >
            <Upload className="w-3.5 h-3.5" />
            Importar
          </button>
        )}
        {onClickExportar && (
          <button
            onClick={onClickExportar}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
            type="button"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
        )}
        {onClickNuevo && (
          <button
            onClick={onClickNuevo}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-all shadow-sm"
            type="button"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo producto
          </button>
        )}
      </div>
    </div>
  );
};
