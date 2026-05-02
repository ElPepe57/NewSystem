/**
 * EmptyStateBd · estado vacío cuando NO hay productos en la BD (onboarding)
 *
 * Mockup canónico: docs/mockups/productos/02-page-listado-vacio-bd.html
 *
 * Diseño:
 *   - Card grande con borde dashed
 *   - Emoji 📦 + título + subtítulo
 *   - 4 cards de tipo de creación (Producto único / con variantes / variante existente / pack)
 *   - Variante existente está disabled (necesita ≥1 producto base)
 *   - Sub-acciones: Importar Excel · Ver guía rápida
 */

import React from 'react';
import { Package, GitBranch, Search, Gift, Upload, BookOpen } from 'lucide-react';

interface EmptyStateBdProps {
  onClickCrearSimple?: () => void;
  onClickCrearConVariantes?: () => void;
  onClickCrearPack?: () => void;
  onClickImportar?: () => void;
  onClickGuia?: () => void;
}

export const EmptyStateBd: React.FC<EmptyStateBdProps> = ({
  onClickCrearSimple,
  onClickCrearConVariantes,
  onClickCrearPack,
  onClickImportar,
  onClickGuia,
}) => {
  return (
    <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
      <div className="text-6xl mb-4">📦</div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Aún no tienes productos en tu catálogo</h2>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
        Empieza creando tu primer producto · skincare, suplemento, simple, con variantes o un pack/kit. El catálogo es la base de
        todo el sistema.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto mb-6">
        <button
          onClick={onClickCrearSimple}
          className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-teal-400 hover:bg-teal-50/30 transition-all group"
          type="button"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-teal-100 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-slate-600 group-hover:text-teal-600" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Producto único</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Sin variantes. Solo un SKU.</div>
            </div>
          </div>
        </button>

        <button
          onClick={onClickCrearConVariantes}
          className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-sky-400 hover:bg-sky-50/30 transition-all group"
          type="button"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-sky-100 flex items-center justify-center flex-shrink-0">
              <GitBranch className="w-5 h-5 text-slate-600 group-hover:text-sky-600" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Producto con variantes</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Diferentes tamaños, sabores o presentaciones.</div>
            </div>
          </div>
        </button>

        <button
          disabled
          className="bg-white border border-slate-200 rounded-xl p-4 text-left opacity-50 cursor-not-allowed"
          type="button"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Search className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-400">Variante de producto existente</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Necesitas tener al menos 1 producto base</div>
            </div>
          </div>
        </button>

        <button
          onClick={onClickCrearPack}
          className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-purple-400 hover:bg-purple-50/30 transition-all group"
          type="button"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-purple-100 flex items-center justify-center flex-shrink-0 relative">
              <Gift className="w-5 h-5 text-slate-600 group-hover:text-purple-600" />
              <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                NEW
              </span>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Pack / Kit</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Cajita armada de fábrica con varios productos adentro.</div>
            </div>
          </div>
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs">
        {onClickImportar && (
          <button onClick={onClickImportar} className="text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1" type="button">
            <Upload className="w-3.5 h-3.5" />
            Importar desde Excel
          </button>
        )}
        {onClickImportar && onClickGuia && <span className="text-slate-300">·</span>}
        {onClickGuia && (
          <button onClick={onClickGuia} className="text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1" type="button">
            <BookOpen className="w-3.5 h-3.5" />
            Ver guía rápida
          </button>
        )}
      </div>
    </div>
  );
};
