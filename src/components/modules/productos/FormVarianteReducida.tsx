import React, { useState } from 'react';
import { GitBranch, Package, ChevronLeft } from 'lucide-react';
import { Button } from '../../common';
import type { Producto } from '../../../types/producto.types';
import { TIPO_PRODUCTO_SKC_LABELS } from '../../../types/producto.types';

interface FormVarianteReducidaProps {
  grupoProducto: Producto;
  variantesExistentes: string[];
  onSubmit: (data: VarianteReducidaData) => Promise<void>;
  onBack: () => void;
  onCancel: () => void;
}

export interface VarianteReducidaData {
  contenido: string;
  sabor: string;
  dosaje: string;
  volumen?: string;           // SKC: volumen de la variante (ej: "50ml")
  pesoLibras?: number;
  varianteLabel: string;
  stockMinimo: number;
}

/**
 * Paso 2 del Flujo 3: formulario reducido (~5 campos) para crear variante de producto existente.
 * Los campos heredados del grupo se muestran como read-only.
 *
 * Detecta si el grupo es SKC (atributosSkincare presente) y adapta los campos:
 *   - SKC: pide Volumen como campo principal; oculta Sabor y Dosaje.
 *   - SUP: pide Contenido, Sabor, Dosaje (flujo original).
 */
export const FormVarianteReducida: React.FC<FormVarianteReducidaProps> = ({
  grupoProducto,
  variantesExistentes,
  onSubmit,
  onBack,
  onCancel,
}) => {
  const esSkincare = !!grupoProducto.atributosSkincare;
  const skc = grupoProducto.atributosSkincare;

  // Campos comunes
  const [pesoLibras, setPesoLibras] = useState<number | undefined>(grupoProducto.pesoLibras);
  const [stockMinimo, setStockMinimo] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  // Campos SUP
  const [contenido, setContenido] = useState('');
  const [sabor, setSabor] = useState('');
  const [dosaje, setDosaje] = useState(grupoProducto.dosaje || '');

  // Campos SKC
  const [volumen, setVolumen] = useState('');

  // Auto-generate varianteLabel
  const varianteLabel = esSkincare
    ? volumen.trim()
    : [contenido, sabor].filter(Boolean).join(' - ');

  const valorPrincipal = esSkincare ? volumen : contenido;
  const canSubmit = valorPrincipal.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        contenido: esSkincare ? '' : contenido.trim(),
        sabor: esSkincare ? '' : sabor.trim(),
        dosaje: esSkincare ? '' : dosaje.trim(),
        volumen: esSkincare ? volumen.trim() : undefined,
        pesoLibras,
        varianteLabel: varianteLabel || valorPrincipal.trim(),
        stockMinimo,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-900">Nueva variante</h3>
        <p className="text-sm text-slate-500 mt-1">Paso 2 de 2 — Define los campos de la variante</p>
      </div>

      {/* Grupo seleccionado — read only */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-slate-900 text-sm truncate">
                {grupoProducto.marca} — {grupoProducto.nombreComercial}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>{grupoProducto.sku}</span>
                {esSkincare && skc?.tipoProductoSKC && (
                  <span>· {TIPO_PRODUCTO_SKC_LABELS[skc.tipoProductoSKC] || skc.tipoProductoSKC}</span>
                )}
                {esSkincare && skc?.ingredienteClave && (
                  <span>· {skc.ingredienteClave}</span>
                )}
                {!esSkincare && grupoProducto.presentacion && <span>· {grupoProducto.presentacion}</span>}
                {!esSkincare && grupoProducto.dosaje && <span>· {grupoProducto.dosaje}</span>}
              </div>
            </div>
          </div>
          <button type="button" onClick={onBack} className="text-xs text-teal-600 hover:text-teal-800 flex-shrink-0">
            Cambiar
          </button>
        </div>
        {variantesExistentes.length > 0 && (
          <div className="flex items-center gap-1 mt-2">
            <GitBranch className="h-3 w-3 text-emerald-500 flex-shrink-0" />
            <span className="text-xs text-emerald-600">
              Existentes: {variantesExistentes.join(' · ')}
            </span>
          </div>
        )}
      </div>

      {/* Editable fields */}
      <div className="space-y-4">
        {esSkincare ? (
          /* === SKC === */
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Volumen <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={volumen}
                onChange={(e) => setVolumen(e.target.value)}
                placeholder="Ej: 30ml, 50ml, 100g"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                autoFocus
              />
              {variantesExistentes.length > 0 && (
                <p className="text-xs text-slate-400 mt-1">Diferente a: {variantesExistentes.join(', ')}</p>
              )}
            </div>

            {skc?.ingredienteClave && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Ingrediente clave <span className="text-slate-400">(hereda del grupo)</span>
                </label>
                <input
                  type="text"
                  value={skc.ingredienteClave}
                  readOnly
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-600"
                />
              </div>
            )}
          </>
        ) : (
          /* === SUP === */
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Contenido <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                placeholder="Ej: 180 caps, 500ml, 300g"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                autoFocus
              />
              {variantesExistentes.length > 0 && (
                <p className="text-xs text-slate-400 mt-1">Diferente a: {variantesExistentes.join(', ')}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Sabor <span className="text-slate-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={sabor}
                onChange={(e) => setSabor(e.target.value)}
                placeholder="Ej: Natural, Fresa, Chocolate"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Dosaje <span className="text-slate-400">(hereda del grupo)</span>
              </label>
              <input
                type="text"
                value={dosaje}
                onChange={(e) => setDosaje(e.target.value)}
                placeholder="Ej: 1000mg, 5mg"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Peso (lb) <span className="text-slate-400">(hereda del grupo)</span>
          </label>
          <input
            type="number"
            value={pesoLibras ?? ''}
            onChange={(e) => setPesoLibras(e.target.value ? parseFloat(e.target.value) : undefined)}
            placeholder="Ej: 0.5, 1.2, 5.0"
            step="0.01"
            min="0"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">Peso por unidad en libras</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Etiqueta de variante <span className="text-slate-400">(auto)</span>
          </label>
          <input
            type="text"
            value={varianteLabel}
            readOnly
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-600"
          />
          <p className="text-xs text-slate-400 mt-1">
            {esSkincare ? 'Se genera automáticamente desde Volumen' : 'Se genera automáticamente desde Contenido + Sabor'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Stock mínimo
          </label>
          <input
            type="number"
            value={stockMinimo}
            onChange={(e) => setStockMinimo(parseInt(e.target.value) || 0)}
            min={0}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="secondary" onClick={onBack} disabled={submitting}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Cambiar grupo
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? 'Creando...' : 'Crear variante'}
          </Button>
        </div>
      </div>
    </div>
  );
};
