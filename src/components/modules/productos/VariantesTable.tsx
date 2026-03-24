import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../common';

export interface VarianteRow {
  id: string;
  contenido: string;
  sabor: string;
  varianteLabel: string;
  esPrincipal: boolean;
}

interface VariantesTableProps {
  variantes: VarianteRow[];
  onChange: (variantes: VarianteRow[]) => void;
  skuPrefix: string;
}

let nextId = 1;
const genId = () => `var-${Date.now()}-${nextId++}`;

/**
 * Tabla inline editable de variantes para el flujo "Producto con variantes".
 * Mínimo 2 variantes requeridas.
 */
export const VariantesTable: React.FC<VariantesTableProps> = ({
  variantes,
  onChange,
  skuPrefix,
}) => {
  const addVariante = () => {
    onChange([
      ...variantes,
      { id: genId(), contenido: '', sabor: '', varianteLabel: '', esPrincipal: false },
    ]);
  };

  const removeVariante = (id: string) => {
    if (variantes.length <= 2) return;
    const updated = variantes.filter(v => v.id !== id);
    // If removed was principal, make first one principal
    if (!updated.some(v => v.esPrincipal) && updated.length > 0) {
      updated[0].esPrincipal = true;
    }
    onChange(updated);
  };

  const updateVariante = (id: string, field: keyof VarianteRow, value: any) => {
    onChange(variantes.map(v => {
      if (v.id !== id) {
        // If setting principal, unset others
        if (field === 'esPrincipal' && value === true) return { ...v, esPrincipal: false };
        return v;
      }
      const updated = { ...v, [field]: value };
      // Auto-generate varianteLabel
      if (field === 'contenido' || field === 'sabor') {
        updated.varianteLabel = [updated.contenido, updated.sabor].filter(Boolean).join(' - ');
      }
      return updated;
    }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900">Variantes del producto</h4>
          <p className="text-xs text-gray-500">Cada variante tendrá su propio SKU automático</p>
        </div>
        <Button variant="secondary" size="sm" onClick={addVariante}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Agregar
        </Button>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 border-b text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
          <div className="col-span-1 text-center">Ppal</div>
          <div className="col-span-4">Contenido *</div>
          <div className="col-span-3">Sabor</div>
          <div className="col-span-3">Label</div>
          <div className="col-span-1"></div>
        </div>

        {/* Rows */}
        {variantes.map((v, idx) => (
          <div key={v.id} className={`grid grid-cols-12 gap-2 px-3 py-2 items-center border-b last:border-0 ${v.esPrincipal ? 'bg-primary-50/50' : ''}`}>
            <div className="col-span-1 text-center">
              <input
                type="radio"
                name="principal"
                checked={v.esPrincipal}
                onChange={() => updateVariante(v.id, 'esPrincipal', true)}
                className="text-primary-600"
              />
            </div>
            <div className="col-span-4">
              <input
                type="text"
                value={v.contenido}
                onChange={(e) => updateVariante(v.id, 'contenido', e.target.value)}
                placeholder="90 caps"
                className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-200 rounded focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="col-span-3">
              <input
                type="text"
                value={v.sabor}
                onChange={(e) => updateVariante(v.id, 'sabor', e.target.value)}
                placeholder="Natural"
                className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-200 rounded focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="col-span-3">
              <span className="text-xs text-gray-500 truncate block">{v.varianteLabel || '—'}</span>
            </div>
            <div className="col-span-1 text-center">
              {variantes.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeVariante(v.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {variantes.length < 2 && (
        <p className="text-xs text-red-500">Mínimo 2 variantes para crear un grupo.</p>
      )}

      {/* Summary */}
      <div className="text-xs text-gray-400">
        {variantes.length} variante{variantes.length !== 1 ? 's' : ''} · SKUs se generarán como {skuPrefix}-XXXX al guardar
      </div>
    </div>
  );
};
