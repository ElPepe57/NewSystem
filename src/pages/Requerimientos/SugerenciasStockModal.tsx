import React from 'react';
import { Plus } from 'lucide-react';
import { Button, Modal } from '../../components/common';
import type { SugerenciaStock } from './requerimientos.types';

interface SugerenciasStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  sugerencias: SugerenciaStock[];
  onCrearDesdeSugerencia: (sug: SugerenciaStock) => void;
}

export const SugerenciasStockModal: React.FC<SugerenciasStockModalProps> = ({
  isOpen,
  onClose,
  sugerencias,
  onCrearDesdeSugerencia
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Productos con Stock Bajo"
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Estos productos estan por debajo del stock minimo. Crea requerimientos para reabastecer.
        </p>

        <div className="divide-y border rounded-lg max-h-96 overflow-y-auto">
          {sugerencias.map((sug, idx) => (
            <div key={idx} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <span className={`w-3 h-3 rounded-full mr-2 ${
                      sug.urgencia === 'critica' ? 'bg-red-500' :
                      sug.urgencia === 'alta' ? 'bg-orange-500' : 'bg-yellow-500'
                    }`} />
                    <span className="font-medium">{sug.producto.sku}</span>
                    <span className="mx-2 text-gray-400">-</span>
                    <span>{sug.producto.marca} {sug.producto.nombreComercial}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Stock:</span>
                      <span className={`ml-1 font-medium ${sug.stockActual === 0 ? 'text-red-600' : ''}`}>
                        {sug.stockActual}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Minimo:</span>
                      <span className="ml-1 font-medium">{sug.stockMinimo}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Dias:</span>
                      <span className={`ml-1 font-medium ${sug.diasParaAgotarse <= 3 ? 'text-red-600' : ''}`}>
                        {sug.diasParaAgotarse}
                      </span>
                    </div>
                  </div>
                  {sug.precioEstimadoUSD && (
                    <div className="mt-1 text-sm text-gray-500">
                      Precio estimado: ${sug.precioEstimadoUSD.toFixed(2)}
                      {sug.proveedorSugerido && ` (${sug.proveedorSugerido})`}
                    </div>
                  )}
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onCrearDesdeSugerencia(sug)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Crear
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </Modal>
  );
};
