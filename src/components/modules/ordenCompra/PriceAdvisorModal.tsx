/**
 * PRICE ADVISOR MODAL
 * Modal lateral (drawer) para el asesor de precios
 * Diseño más limpio que no interrumpe el flujo del formulario
 */

import React from 'react';
import { X, Lightbulb } from 'lucide-react';
import { PriceAdvisor } from './PriceAdvisor';
import type { Producto } from '../../../types/producto.types';

interface PriceAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  producto: Producto | undefined;
  precioIngresado: number;
  tipoCambio: number;
  proveedorActual?: string;
  onUsarPrecioSugerido: (precio: number) => void;
}

export const PriceAdvisorModal: React.FC<PriceAdvisorModalProps> = ({
  isOpen,
  onClose,
  producto,
  precioIngresado,
  tipoCambio,
  proveedorActual,
  onUsarPrecioSugerido
}) => {
  if (!isOpen || !producto) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Lightbulb className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Asesor de Precios</h3>
              <p className="text-xs text-gray-500 line-clamp-1">
                {producto.marca} - {producto.nombreComercial}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <PriceAdvisor
            producto={producto}
            precioIngresado={precioIngresado}
            tipoCambio={tipoCambio}
            proveedorActual={proveedorActual}
            onUsarPrecioSugerido={(precio) => {
              onUsarPrecioSugerido(precio);
              onClose();
            }}
            compact={false}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </>
  );
};
