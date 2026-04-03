import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../common';

export interface VarianteRow {
  id: string;
  presentacion: string;
  contenido: string;
  dosaje: string;
  sabor: string;
  codigoUPC: string;
  servingsPerDay: number;
  varianteLabel: string;
  esPrincipal: boolean;
}

interface VariantesTableProps {
  variantes: VarianteRow[];
  onChange: (variantes: VarianteRow[]) => void;
  skuPrefix: string;
  esSkincare?: boolean;
  sugerencias?: {
    presentaciones?: string[];
    dosajes?: string[];
    contenidos?: string[];
    sabores?: string[];
  };
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
  esSkincare = false,
  sugerencias,
}) => {
  // Placeholders adaptados por línea
  const ph = esSkincare
    ? { presentacion: 'Serum', contenido: '50ml', dosaje: 'Centella 10%', sabor: '', upc: '880...' }
    : { presentacion: 'Cápsulas', contenido: '90 caps', dosaje: '1000mg', sabor: 'Natural', upc: '768990...' };
  const addVariante = () => {
    onChange([
      ...variantes,
      { id: genId(), presentacion: '', contenido: '', dosaje: '', sabor: '', codigoUPC: '', servingsPerDay: 0, varianteLabel: '', esPrincipal: false },
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
      if (field === 'contenido' || field === 'dosaje' || field === 'sabor') {
        updated.varianteLabel = [updated.contenido, updated.dosaje, updated.sabor].filter(Boolean).join(' - ');
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

      {/* Table — scrollable horizontally on mobile */}
      <div className="border border-gray-200 rounded-lg overflow-x-auto">
        <div className="min-w-[700px]">
        {/* Header */}
        <div className="grid grid-cols-[40px_100px_90px_80px_80px_100px_60px_1fr_32px] gap-1.5 px-3 py-2 bg-gray-50 border-b text-[10px] font-medium text-gray-500 uppercase">
          <div className="text-center">Ppal</div>
          <div>Presentación</div>
          <div>Contenido *</div>
          <div>{esSkincare ? 'Ingrediente' : 'Dosaje'}</div>
          <div>{esSkincare ? 'Tipo Piel' : 'Sabor'}</div>
          <div>UPC/EAN</div>
          <div>Porc/día</div>
          <div>Label</div>
          <div></div>
        </div>

        {/* Rows */}
        {variantes.map((v, idx) => (
          <div key={v.id} className={`grid grid-cols-[40px_100px_90px_80px_80px_100px_60px_1fr_32px] gap-1.5 px-3 py-2 items-center border-b last:border-0 ${v.esPrincipal ? 'bg-primary-50/50' : ''}`}>
            <div className="text-center">
              <input
                type="radio"
                name="principal"
                checked={v.esPrincipal}
                onChange={() => updateVariante(v.id, 'esPrincipal', true)}
                className="text-primary-600"
              />
            </div>
            <div>
              <input
                type="text"
                list="dl-presentaciones"
                value={v.presentacion}
                onChange={(e) => updateVariante(v.id, 'presentacion', e.target.value)}
                placeholder={ph.presentacion}
                className="w-full px-1.5 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <input
                type="text"
                list="dl-contenidos"
                value={v.contenido}
                onChange={(e) => updateVariante(v.id, 'contenido', e.target.value)}
                placeholder={ph.contenido}
                className="w-full px-1.5 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <input
                type="text"
                list="dl-dosajes"
                value={v.dosaje}
                onChange={(e) => updateVariante(v.id, 'dosaje', e.target.value)}
                placeholder={ph.dosaje}
                className="w-full px-1.5 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <input
                type="text"
                list="dl-sabores"
                value={v.sabor}
                onChange={(e) => updateVariante(v.id, 'sabor', e.target.value)}
                placeholder={ph.sabor || 'Sabor'}
                className="w-full px-1.5 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <input
                type="text"
                value={v.codigoUPC}
                onChange={(e) => updateVariante(v.id, 'codigoUPC', e.target.value)}
                placeholder={ph.upc}
                className="w-full px-1.5 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <input
                type="number"
                value={v.servingsPerDay || ''}
                onChange={(e) => updateVariante(v.id, 'servingsPerDay', parseInt(e.target.value) || 0)}
                placeholder="2"
                min={0}
                className="w-full px-1.5 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
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
      </div>

      {variantes.length < 2 && (
        <p className="text-xs text-red-500">Mínimo 2 variantes para crear un grupo.</p>
      )}

      {/* Summary */}
      <div className="text-xs text-gray-400">
        {variantes.length} variante{variantes.length !== 1 ? 's' : ''} · SKUs se generarán como {skuPrefix}-XXXX al guardar
      </div>

      {/* Datalists for autocomplete suggestions */}
      {sugerencias?.presentaciones && (
        <datalist id="dl-presentaciones">
          {sugerencias.presentaciones.map(s => <option key={s} value={s} />)}
        </datalist>
      )}
      {sugerencias?.contenidos && (
        <datalist id="dl-contenidos">
          {sugerencias.contenidos.map(s => <option key={s} value={s} />)}
        </datalist>
      )}
      {sugerencias?.dosajes && (
        <datalist id="dl-dosajes">
          {sugerencias.dosajes.map(s => <option key={s} value={s} />)}
        </datalist>
      )}
      {sugerencias?.sabores && (
        <datalist id="dl-sabores">
          {sugerencias.sabores.map(s => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  );
};
