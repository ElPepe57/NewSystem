import React, { useState } from 'react';
import { Package, GitBranch, Plus, Search, Gift } from 'lucide-react';
import { Button } from '../../common';
import { isProductoPackEnabled } from '../../../config/features';

export type TipoCreacion = 'simple' | 'con_variantes' | 'variante_existente' | 'pack';

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
  badgeNuevo?: boolean;
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
  {
    tipo: 'pack',
    icon: Gift,
    titulo: 'Pack / Kit',
    descripcion: 'Cajita armada de fábrica con varios productos adentro. No desarmable.',
    color: 'purple',
    badgeNuevo: true,
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

  const packEnabled = isProductoPackEnabled();
  const opcionesVisibles = OPCIONES.filter(op => op.tipo !== 'pack' || packEnabled);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-900">¿Cómo es este producto?</h3>
        <p className="text-sm text-slate-500 mt-1">Selecciona el tipo de producto que quieres crear</p>
      </div>

      <div className="space-y-3">
        {opcionesVisibles.map(op => {
          const Icon = op.icon;
          const isSelected = selected === op.tipo;
          const isPack = op.tipo === 'pack';
          return (
            <button
              key={op.tipo}
              type="button"
              onClick={() => setSelected(op.tipo)}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left relative ${
                isSelected && isPack
                  ? 'border-purple-500 bg-purple-50 shadow-sm'
                  : isSelected
                    ? 'border-teal-500 bg-teal-50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {op.badgeNuevo && (
                <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold tracking-wider">
                  NUEVO
                </span>
              )}
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isSelected && isPack
                  ? 'bg-purple-100'
                  : isSelected
                    ? 'bg-teal-100'
                    : 'bg-slate-100'
              }`}>
                <Icon className={`h-6 w-6 ${
                  isSelected && isPack
                    ? 'text-purple-600'
                    : isSelected
                      ? 'text-teal-600'
                      : 'text-slate-400'
                }`} />
              </div>
              <div className="min-w-0">
                <p className={`font-medium ${
                  isSelected && isPack
                    ? 'text-purple-900'
                    : isSelected
                      ? 'text-teal-900'
                      : 'text-slate-900'
                }`}>
                  {op.titulo}
                </p>
                <p className="text-sm text-slate-500">{op.descripcion}</p>
              </div>
              <div className={`ml-auto w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                isSelected && isPack
                  ? 'border-purple-500 bg-purple-500'
                  : isSelected
                    ? 'border-teal-500 bg-teal-500'
                    : 'border-slate-300'
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
