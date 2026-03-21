import React from 'react';
import { Layers } from 'lucide-react';
import { Button } from '../../components/common';

interface SelectionFloatingBarProps {
  selectedCount: number;
  onGenerarOCConsolidada: () => void;
  onCancelar: () => void;
}

export const SelectionFloatingBar: React.FC<SelectionFloatingBarProps> = ({
  selectedCount,
  onGenerarOCConsolidada,
  onCancelar
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white shadow-xl border border-primary-200 rounded-xl px-6 py-3 flex items-center gap-4">
      <div className="text-sm text-gray-700">
        <span className="font-semibold text-primary-600">{selectedCount}</span> requerimiento(s) seleccionado(s)
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={onGenerarOCConsolidada}
      >
        <Layers className="h-4 w-4 mr-2" />
        Generar OC Consolidada
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCancelar}
      >
        Cancelar
      </Button>
    </div>
  );
};
