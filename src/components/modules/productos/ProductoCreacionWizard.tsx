import React, { useState } from 'react';
import { Package, GitBranch, Plus, Search } from 'lucide-react';
import { Button } from '../../common';

export type TipoCreacion = 'simple' | 'con_variantes' | 'variante_existente';

interface ProductoCreacionWizardProps {
  onSelect: (tipo: TipoCreacion) => void;
  onCancel: () => void;
}

const OPCIONES: {
  tipo: TipoCreacion;
  icon: React.ElementType;
  titulo: string;
  descripcion: string;
  color: string;
}[] = [
  {
    tipo: 'simple',
    icon: Package,
    titulo: 'Producto único',
    descripcion: 'Sin variantes. Solo un SKU.',
    color: 'primary',
  },
  {
    tipo: 'con_variantes',
    icon: GitBranch,
    titulo: 'Producto con variantes',
    descripcion: 'Diferentes tamaños, sabores o presentaciones.',
    color: 'blue',
  },
  {
    tipo: 'variante_existente',
    icon: Search,
    titulo: 'Variante de producto existente',
    descripcion: 'Agregar a un grupo ya creado.',
    color: 'green',
  },
];

/**
 * Pantalla de intención al crear producto.
 * Pregunta al usuario qué tipo de producto quiere crear ANTES de abrir el formulario.
 */
export const ProductoCreacionWizard: React.FC<ProductoCreacionWizardProps> = ({
  onSelect,
  onCancel,
}) => {
  const [selected, setSelected] = useState<TipoCreacion | null>(null);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">¿Cómo es este producto?</h3>
        <p className="text-sm text-gray-500 mt-1">Selecciona el tipo de producto que quieres crear</p>
      </div>

      <div className="space-y-3">
        {OPCIONES.map(op => {
          const Icon = op.icon;
          const isSelected = selected === op.tipo;
          return (
            <button
              key={op.tipo}
              type="button"
              onClick={() => setSelected(op.tipo)}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left ${
                isSelected
                  ? 'border-primary-500 bg-primary-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isSelected ? 'bg-primary-100' : 'bg-gray-100'
              }`}>
                <Icon className={`h-6 w-6 ${isSelected ? 'text-primary-600' : 'text-gray-400'}`} />
              </div>
              <div className="min-w-0">
                <p className={`font-medium ${isSelected ? 'text-primary-900' : 'text-gray-900'}`}>
                  {op.titulo}
                </p>
                <p className="text-sm text-gray-500">{op.descripcion}</p>
              </div>
              <div className={`ml-auto w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
              }`}>
                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={() => selected && onSelect(selected)}
          disabled={!selected}
        >
          <Plus className="h-4 w-4 mr-1" />
          Continuar
        </Button>
      </div>
    </div>
  );
};
