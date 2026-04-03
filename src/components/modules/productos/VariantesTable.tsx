import React, { useState, useRef, useEffect } from 'react';
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

/** Mini inline autocomplete — dropdown fino que aparece al escribir */
const InlineAutocomplete: React.FC<{
  value: string;
  onChange: (v: string) => void;
  suggestions?: string[];
  placeholder?: string;
}> = ({ value, onChange, suggestions = [], placeholder }) => {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = value
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase())
    : suggestions;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setFocused(true); setOpen(true); }}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="w-full px-1.5 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
      />
      {open && focused && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-md shadow-lg max-h-32 overflow-y-auto">
          {filtered.slice(0, 8).map(s => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(s); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 text-xs text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

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
    if (!updated.some(v => v.esPrincipal) && updated.length > 0) {
      updated[0].esPrincipal = true;
    }
    onChange(updated);
  };

  const updateVariante = (id: string, field: keyof VarianteRow, value: any) => {
    onChange(variantes.map(v => {
      if (v.id !== id) {
        if (field === 'esPrincipal' && value === true) return { ...v, esPrincipal: false };
        return v;
      }
      const updated = { ...v, [field]: value };
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
        {variantes.map((v) => (
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
            <InlineAutocomplete
              value={v.presentacion}
              onChange={(val) => updateVariante(v.id, 'presentacion', val)}
              suggestions={sugerencias?.presentaciones}
              placeholder={ph.presentacion}
            />
            <InlineAutocomplete
              value={v.contenido}
              onChange={(val) => updateVariante(v.id, 'contenido', val)}
              suggestions={sugerencias?.contenidos}
              placeholder={ph.contenido}
            />
            <InlineAutocomplete
              value={v.dosaje}
              onChange={(val) => updateVariante(v.id, 'dosaje', val)}
              suggestions={sugerencias?.dosajes}
              placeholder={ph.dosaje}
            />
            <InlineAutocomplete
              value={v.sabor}
              onChange={(val) => updateVariante(v.id, 'sabor', val)}
              suggestions={sugerencias?.sabores}
              placeholder={ph.sabor || 'Sabor'}
            />
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

      <div className="text-xs text-gray-400">
        {variantes.length} variante{variantes.length !== 1 ? 's' : ''} · SKUs se generarán como {skuPrefix}-XXXX al guardar
      </div>
    </div>
  );
};
