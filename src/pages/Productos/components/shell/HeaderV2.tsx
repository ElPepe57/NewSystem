/**
 * HeaderV2 · header banking-grade del listado de Productos V2 · F1 + F12
 *
 * DESKTOP (≥lg):
 *   - Breadcrumb · h1 con icono + subtítulo
 *   - 6 acciones inline: Sugerencias · Inteligencia · Archivo · Importar · Exportar · Nuevo
 *
 * MOBILE (<lg):
 *   - Breadcrumb compacto · h1 + subtítulo
 *   - 1 CTA primario "Nuevo producto" + dropdown "Más acciones" (5 secundarias)
 *   - Pattern Stripe/Linear/Mercury · F12
 *
 * Mockup canónico desktop: 01-page-listado.html
 * Mockup canónico mobile:  01m-page-listado-mobile.html
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Calculator,
  Trash2,
  Upload,
  Download,
  Plus,
  Package,
  ChevronRight,
  Lightbulb,
  MoreHorizontal,
} from 'lucide-react';

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

  // Cuántas acciones secundarias hay disponibles (para mostrar/ocultar dropdown)
  const hasSecondaryActions = !!(
    onClickSugerencias ||
    onClickCalculadora ||
    onClickArchivo ||
    onClickImportar ||
    onClickExportar
  );

  return (
    <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
      {/* Lado izquierdo · breadcrumb + título · IGUAL en mobile/desktop */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
          <span className="hover:text-teal-600 transition-colors cursor-pointer">Catálogo</span>
          <ChevronRight className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
          <span className="text-slate-600 font-medium truncate">Productos · Maestro de SKUs</span>
        </div>
        <h1 className="text-lg lg:text-2xl font-bold text-slate-900 flex items-center gap-2 lg:gap-2.5">
          <Package className="w-5 h-5 lg:w-6 lg:h-6 text-teal-600" />
          Productos
        </h1>
        <p className="text-xs lg:text-sm text-slate-500 mt-0.5 max-w-2xl">
          Catálogo maestro · qué vendemos, cómo se configura, qué cuesta traerlo y cuánto se gana.
        </p>
      </div>

      {/* ═══════ DESKTOP (≥lg) · Todas las acciones inline ═══════ */}
      <div className="hidden lg:flex items-center gap-2 flex-wrap flex-shrink-0">
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

      {/* ═══════ MOBILE (<lg) · 1 CTA + Dropdown "Más" (F12) ═══════ */}
      <div className="lg:hidden w-full flex items-center gap-1.5 mt-2">
        {onClickNuevo && (
          <button
            onClick={onClickNuevo}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm"
            type="button"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo producto
          </button>
        )}

        {/* Sugerencias visible por su importancia · más todas las demás en dropdown */}
        {onClickSugerencias && (
          <button
            onClick={onClickSugerencias}
            className="flex items-center justify-center gap-1 px-3 py-2.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg"
            type="button"
            aria-label="Sugerencias del día"
          >
            <Lightbulb className="w-3.5 h-3.5" />
          </button>
        )}

        {hasSecondaryActions && (
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setShowMobileMenu(v => !v)}
              className="relative flex items-center justify-center px-3 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              type="button"
              aria-label="Más acciones"
            >
              <MoreHorizontal className="w-4 h-4" />
              {archivadosCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {archivadosCount}
                </span>
              )}
            </button>

            {/* Dropdown menu */}
            {showMobileMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-30 overflow-hidden">
                {onClickCalculadora && (
                  <button
                    onClick={() => {
                      onClickCalculadora();
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 text-left"
                    type="button"
                  >
                    <Calculator className="w-3.5 h-3.5 text-indigo-700 flex-shrink-0" />
                    Inteligencia
                  </button>
                )}
                {onClickArchivo && (
                  <button
                    onClick={() => {
                      onClickArchivo();
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 text-left border-t border-slate-100"
                    type="button"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    Archivo
                    {archivadosCount > 0 && (
                      <span className="ml-auto bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full px-1.5 py-0.5 tabular-nums">
                        {archivadosCount}
                      </span>
                    )}
                  </button>
                )}
                {onClickImportar && (
                  <button
                    onClick={() => {
                      onClickImportar();
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 text-left border-t border-slate-100"
                    type="button"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    Importar
                  </button>
                )}
                {onClickExportar && (
                  <button
                    onClick={() => {
                      onClickExportar();
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 text-left border-t border-slate-100"
                    type="button"
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
