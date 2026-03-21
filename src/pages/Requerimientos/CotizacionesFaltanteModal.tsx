import React from 'react';
import { Button, Modal } from '../../components/common';
import type { Venta } from '../../types/venta.types';

interface CotizacionesFaltanteModalProps {
  isOpen: boolean;
  onClose: () => void;
  cotizaciones: Venta[];
  onCrearDesdeCotizacion: (venta: Venta) => void;
}

export const CotizacionesFaltanteModal: React.FC<CotizacionesFaltanteModalProps> = ({
  isOpen,
  onClose,
  cotizaciones,
  onCrearDesdeCotizacion
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generar Requerimiento desde Cotizacion"
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Selecciona una cotizacion confirmada para generar automaticamente un requerimiento de compra con los productos faltantes.
        </p>

        {cotizaciones.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hay cotizaciones confirmadas con faltante de stock
          </div>
        ) : (
          <div className="divide-y border rounded-lg max-h-96 overflow-y-auto">
            {cotizaciones.map((venta) => (
              <div key={venta.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      {venta.numeroVenta} - {venta.nombreCliente}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Total: S/ {venta.totalPEN.toFixed(2)} | {venta.productos.length} productos
                    </div>
                    {venta.productosConFaltante && venta.productosConFaltante.length > 0 && (
                      <div className="text-sm text-amber-600 mt-1">
                        Faltantes: {venta.productosConFaltante.map(p => p.nombre).join(', ')}
                      </div>
                    )}
                  </div>
                  <Button variant="primary" size="sm" onClick={() => onCrearDesdeCotizacion(venta)}>
                    Generar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </Modal>
  );
};
