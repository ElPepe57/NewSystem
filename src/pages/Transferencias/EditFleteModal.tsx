import React, { useState, useMemo } from "react";
import { DollarSign, AlertTriangle } from "lucide-react";
import { Modal, Button } from "../../components/common";
import { useProductoStore } from "../../store/productoStore";
import type { Transferencia } from "../../types/transferencia.types";

interface EditFleteModalProps {
  transferencia: Transferencia;
  onClose: () => void;
  onConfirm: (costoFletePorProducto: Record<string, number>) => Promise<void>;
}

export const EditFleteModal: React.FC<EditFleteModalProps> = ({
  transferencia,
  onClose,
  onConfirm,
}) => {
  const { productos } = useProductoStore();
  const productosMap = useMemo(() => {
    const map = new Map<string, typeof productos[0]>();
    productos.forEach(p => map.set(p.id, p));
    return map;
  }, [productos]);

  const [submitting, setSubmitting] = useState(false);
  // Input: flete POR UNIDAD — el total se calcula automáticamente
  const [fletePorUnidadMap, setFletePorUnidadMap] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const producto of transferencia.productosSummary) {
      const unidadesProducto = transferencia.unidades.filter(u => u.productoId === producto.productoId);
      const fleteTotal = unidadesProducto.reduce((sum, u) => sum + (u.costoFleteUSD || 0), 0);
      const cantidad = producto.cantidad || 1;
      if (fleteTotal > 0) {
        initial[producto.productoId] = fleteTotal / cantidad;
      }
    }
    return initial;
  });

  // Calcular totales por producto para pasar al onConfirm
  const fletesPorProducto: Record<string, number> = {};
  for (const producto of transferencia.productosSummary) {
    const porUnidad = fletePorUnidadMap[producto.productoId] || 0;
    fletesPorProducto[producto.productoId] = porUnidad * (producto.cantidad || 1);
  }

  const totalFlete = Object.values(fletesPorProducto).reduce((sum, v) => sum + (v || 0), 0);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onConfirm(fletesPorProducto);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Flete - ${transferencia.numeroTransferencia}`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Info de la transferencia */}
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-gray-500">Destino:</span> <span className="font-medium">{transferencia.almacenDestinoNombre}</span></div>
            <div><span className="text-gray-500">Unidades:</span> <span className="font-medium">{transferencia.totalUnidades}</span></div>
            {transferencia.viajeroNombre && (
              <div><span className="text-gray-500">Viajero:</span> <span className="font-medium">{transferencia.viajeroNombre}</span></div>
            )}
            <div>
              <span className="text-gray-500">Flete actual:</span>{' '}
              <span className="font-medium">
                {transferencia.costoFleteTotal && transferencia.costoFleteTotal > 0
                  ? `$${transferencia.costoFleteTotal.toFixed(2)}`
                  : 'Sin flete'}
              </span>
            </div>
          </div>
        </div>

        {/* Flete por producto */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">Costo de Flete por Producto</h4>
            <div className="text-lg font-bold text-blue-700">${totalFlete.toFixed(2)}</div>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {transferencia.productosSummary.map((producto) => {
              const unidadesCount = producto.cantidad;
              const fletePorUnidad = fletePorUnidadMap[producto.productoId] || 0;
              const fleteTotalProducto = fletePorUnidad * unidadesCount;
              const productoFull = productosMap.get(producto.productoId);

              return (
                <div key={producto.productoId} className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h5 className="font-medium text-gray-900 truncate">
                        {productoFull?.nombreComercial || producto.nombre}
                      </h5>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                        {productoFull?.marca && (
                          <span className="text-xs font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{productoFull.marca}</span>
                        )}
                        {productoFull?.presentacion && (
                          <span className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded capitalize">{productoFull.presentacion.replace('_', ' ')}</span>
                        )}
                        {productoFull?.dosaje && (
                          <span className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{productoFull.dosaje}</span>
                        )}
                        {productoFull?.contenido && (
                          <span className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{productoFull.contenido}</span>
                        )}
                        {productoFull?.sabor && (
                          <span className="text-xs text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">{productoFull.sabor}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{producto.sku} &middot; {producto.cantidad} unidades</p>
                    </div>
                    <div className="flex-shrink-0 w-40">
                      <label className="block text-xs text-gray-500 mb-1">Flete por unidad (USD)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                        <input
                          type="number"
                          value={fletePorUnidadMap[producto.productoId] || ''}
                          onChange={(e) => {
                            const valor = parseFloat(e.target.value) || 0;
                            setFletePorUnidadMap(prev => ({
                              ...prev,
                              [producto.productoId]: valor
                            }));
                          }}
                          className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      {fleteTotalProducto > 0 && (
                        <div className="text-xs text-blue-600 mt-1 text-right">
                          Total: ${fleteTotalProducto.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {(transferencia.estado === 'recibida_completa' || transferencia.estado === 'recibida_parcial') && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Esta transferencia ya fue recibida. Al actualizar el flete, se recalculara el CTRU de las unidades afectadas.
              </p>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end space-x-3 pt-2 border-t">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Guardando...' : 'Guardar Flete'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
