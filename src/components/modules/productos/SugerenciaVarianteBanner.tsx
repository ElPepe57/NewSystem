import React, { useState } from 'react';
import { GitBranch, X, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { Button } from '../../common';
import type { Producto } from '../../../types/producto.types';
import type { VarianteCandidato } from '../../../hooks/useDetectarVarianteCandidatos';

interface SugerenciaVarianteBannerProps {
  candidatos: VarianteCandidato[];
  onAgregarComoVariante: (padre: Producto) => void;
  onCrearIndependiente: () => void;
  onDescartar: () => void;
}

export const SugerenciaVarianteBanner: React.FC<SugerenciaVarianteBannerProps> = ({
  candidatos,
  onAgregarComoVariante,
  onCrearIndependiente,
  onDescartar,
}) => {
  const [showAll, setShowAll] = useState(false);

  if (candidatos.length === 0) return null;

  const principal = candidatos[0];
  const tieneMultiples = candidatos.length > 1;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-blue-100/50">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
          <GitBranch className="h-4 w-4" />
          Producto similar detectado
        </div>
        <button
          type="button"
          onClick={onDescartar}
          className="text-blue-400 hover:text-blue-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        <p className="text-xs text-blue-700">
          Encontramos {candidatos.length === 1 ? 'un producto' : `${candidatos.length} productos`} que {candidatos.length === 1 ? 'podría ser' : 'podrían ser'} del mismo grupo:
        </p>

        {/* Primary candidate */}
        <div className="bg-white rounded-lg border border-blue-100 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-blue-600">{principal.producto.sku}</span>
                {principal.producto.esPadre && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-100 text-purple-700">Padre</span>
                )}
              </div>
              <p className="font-medium text-gray-900 text-sm mt-0.5">
                {principal.producto.marca} — {principal.producto.nombreComercial}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {principal.producto.presentacion && (
                  <span className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{principal.producto.presentacion}</span>
                )}
                {principal.producto.dosaje && (
                  <span className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{principal.producto.dosaje}</span>
                )}
                {principal.producto.contenido && (
                  <span className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{principal.producto.contenido}</span>
                )}
                {principal.producto.sabor && (
                  <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{principal.producto.sabor}</span>
                )}
              </div>
              {principal.camposDiferentes.length > 0 && (
                <p className="text-xs text-amber-600 mt-1.5">
                  Diferencia detectada: {principal.camposDiferentes.join(', ')}
                </p>
              )}
            </div>
            <Package className="h-5 w-5 text-blue-300 flex-shrink-0" />
          </div>
        </div>

        {/* Show all candidates */}
        {tieneMultiples && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            {showAll ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Ver los {candidatos.length} productos similares
          </button>
        )}

        {showAll && tieneMultiples && (
          <div className="space-y-2">
            {candidatos.slice(1).map((c) => (
              <div key={c.producto.id} className="bg-white rounded-lg border border-gray-100 p-2.5 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-gray-500">{c.producto.sku}</span>
                    <span className="text-xs text-gray-700 truncate">{c.producto.contenido} {c.producto.sabor}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAgregarComoVariante(c.producto)}
                  className="text-xs flex-shrink-0"
                >
                  Elegir
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onAgregarComoVariante(principal.producto)}
          >
            <GitBranch className="h-3.5 w-3.5 mr-1" />
            Agregar como variante de {principal.producto.sku}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onCrearIndependiente}
          >
            Crear como independiente
          </Button>
        </div>
      </div>
    </div>
  );
};
