import React, { useState, useEffect } from 'react';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import { Link2, Package, User, CheckCircle2, AlertTriangle, Search } from 'lucide-react';
import { OrdenCompraService } from '../../../services/ordenCompra.service';
import { expectativaService } from '../../../services/expectativa.service';
import type { OrdenCompra } from '../../../types/ordenCompra.types';
import type { Venta } from '../../../types/venta.types';

interface VincularOCModalProps {
  isOpen: boolean;
  onClose: () => void;
  venta: Venta;
  userId: string;
  onSuccess: () => void;
}

export const VincularOCModal: React.FC<VincularOCModalProps> = ({
  isOpen,
  onClose,
  venta,
  userId,
  onSuccess
}) => {
  const [ordenesRecibidas, setOrdenesRecibidas] = useState<OrdenCompra[]>([]);
  const [selectedOCId, setSelectedOCId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingOrdenes, setLoadingOrdenes] = useState(true);
  const [resultado, setResultado] = useState<{
    success: boolean;
    requerimientoNumero?: string;
    unidadesReservadas?: number;
    detalles?: Array<{ productoId: string; reservadas: number; faltantes: number }>;
    error?: string;
  } | null>(null);

  const productosFaltantes = venta.productosConFaltante || [];
  // Si hay info de faltantes, filtrar solo esos; si no, usar todos los productos
  const productosVenta = productosFaltantes.length > 0
    ? venta.productos.filter(p => {
        const faltante = productosFaltantes.find(f => f.nombre.includes(p.nombreComercial));
        return faltante && faltante.solicitados > faltante.disponibles;
      })
    : venta.productos;

  useEffect(() => {
    if (isOpen) {
      loadOrdenesRecibidas();
      setResultado(null);
      setSelectedOCId('');
    }
  }, [isOpen]);

  const loadOrdenesRecibidas = async () => {
    setLoadingOrdenes(true);
    try {
      const ordenes = await OrdenCompraService.getAll();
      // Filtrar solo recibidas
      const recibidas = ordenes.filter(o => o.estado === 'recibida');
      setOrdenesRecibidas(recibidas);
    } catch (error) {
      console.error('Error al cargar órdenes:', error);
    } finally {
      setLoadingOrdenes(false);
    }
  };

  const selectedOC = ordenesRecibidas.find(o => o.id === selectedOCId);

  // Calcular preview de productos coincidentes
  const getPreviewVinculacion = () => {
    if (!selectedOC) return [];
    return productosVenta.map(pv => {
      const faltante = productosFaltantes.find(f => f.nombre.includes(pv.nombreComercial));
      const cantidadNecesaria = faltante ? faltante.solicitados - faltante.disponibles : pv.cantidad;
      const productoOC = selectedOC.productos.find(po => po.productoId === pv.productoId);
      return {
        productoId: pv.productoId,
        nombre: pv.nombreComercial,
        marca: pv.marca,
        cantidadNecesaria,
        cantidadEnOC: productoOC?.cantidad || 0,
        disponible: !!productoOC
      };
    });
  };

  const handleVincular = async () => {
    if (!selectedOC || !userId) return;
    setLoading(true);
    setResultado(null);

    try {
      const productosParaVincular = productosVenta.map(p => {
        const faltante = productosFaltantes.find(f => f.nombre.includes(p.nombreComercial));
        const cantidadNecesaria = faltante ? faltante.solicitados - faltante.disponibles : p.cantidad;
        // Usar costo de compra de la OC, no el precio de venta al cliente
        const productoOC = selectedOC!.productos.find(po => po.productoId === p.productoId);
        return {
          productoId: p.productoId,
          sku: p.sku || '',
          marca: p.marca || '',
          nombreComercial: p.nombreComercial,
          cantidadFaltante: cantidadNecesaria,
          precioEstimadoUSD: productoOC?.costoUnitario || 0
        };
      });

      const result = await expectativaService.vincularOCRetroactivamente({
        cotizacionId: venta.id,
        cotizacionNumero: venta.numeroVenta,
        nombreCliente: venta.nombreCliente,
        ordenCompraId: selectedOC.id,
        ordenCompraNumero: selectedOC.numeroOrden,
        productos: productosParaVincular,
        userId
      });

      setResultado({
        success: true,
        requerimientoNumero: result.requerimientoNumero,
        unidadesReservadas: result.unidadesReservadas,
        detalles: result.detalles
      });

      onSuccess();
    } catch (error: any) {
      setResultado({
        success: false,
        error: error.message || 'Error al vincular'
      });
    } finally {
      setLoading(false);
    }
  };

  const preview = getPreviewVinculacion();
  const productosCoincidentes = preview.filter(p => p.disponible);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Vincular con Orden de Compra Existente"
      subtitle={`${venta.nombreCliente} - ${venta.numeroVenta}`}
      size="lg"
    >
      <div className="space-y-5">
        {/* Info del cliente y productos faltantes */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-blue-900">{venta.nombreCliente}</span>
            <span className="text-sm text-blue-600">({venta.numeroVenta})</span>
          </div>
          <div className="text-sm text-blue-800 mb-2">Productos con faltante de stock:</div>
          <div className="space-y-1">
            {productosVenta.map(p => {
              const faltante = productosFaltantes.find(f => f.nombre.includes(p.nombreComercial));
              const cant = faltante ? faltante.solicitados - faltante.disponibles : p.cantidad;
              return (
                <div key={p.productoId} className="flex justify-between text-sm">
                  <span className="text-blue-700">{p.nombreComercial}</span>
                  <span className="font-medium text-blue-900">{cant} unidades</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Resultado exitoso */}
        {resultado?.success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-green-900">Vinculado exitosamente</span>
            </div>
            <div className="text-sm text-green-800 space-y-1">
              <p>Requerimiento creado: <strong>{resultado.requerimientoNumero}</strong></p>
              <p>Unidades reservadas: <strong>{resultado.unidadesReservadas}</strong></p>
              {resultado.detalles?.some(d => d.faltantes > 0) && (
                <div className="mt-2 text-amber-700 bg-amber-50 p-2 rounded">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Algunos productos no tienen suficientes unidades disponibles en esta OC:
                  <ul className="ml-4 mt-1 list-disc">
                    {resultado.detalles.filter(d => d.faltantes > 0).map(d => (
                      <li key={d.productoId}>{d.faltantes} unidades faltantes</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <Button variant="primary" className="mt-3" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        )}

        {/* Error */}
        {resultado?.success === false && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="text-red-900">{resultado.error}</span>
            </div>
          </div>
        )}

        {/* Selector de OC */}
        {!resultado?.success && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="h-4 w-4 inline mr-1" />
                Seleccionar Orden de Compra recibida
              </label>
              {loadingOrdenes ? (
                <div className="text-sm text-gray-500 py-2">Cargando órdenes...</div>
              ) : (
                <select
                  value={selectedOCId}
                  onChange={(e) => setSelectedOCId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">-- Seleccionar OC --</option>
                  {ordenesRecibidas.map(oc => (
                    <option key={oc.id} value={oc.id}>
                      {oc.numeroOrden} - {oc.nombreProveedor} ({oc.productos.length} productos, ${oc.totalUSD.toFixed(2)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Preview de vinculación */}
            {selectedOC && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b">
                  <span className="text-sm font-medium text-gray-700">
                    Preview de vinculación con {selectedOC.numeroOrden}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-gray-600">Producto</th>
                      <th className="px-4 py-2 text-center text-gray-600">Necesita</th>
                      <th className="px-4 py-2 text-center text-gray-600">En OC</th>
                      <th className="px-4 py-2 text-center text-gray-600">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.map(p => (
                      <tr key={p.productoId}>
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900">{p.nombre}</div>
                          <div className="text-xs text-gray-500">{p.marca}</div>
                        </td>
                        <td className="px-4 py-2 text-center">{p.cantidadNecesaria}</td>
                        <td className="px-4 py-2 text-center">{p.cantidadEnOC}</td>
                        <td className="px-4 py-2 text-center">
                          {p.disponible ? (
                            p.cantidadEnOC >= p.cantidadNecesaria ? (
                              <span className="text-green-600 font-medium">Suficiente</span>
                            ) : (
                              <span className="text-amber-600 font-medium">Parcial</span>
                            )
                          ) : (
                            <span className="text-red-500 font-medium">No encontrado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {productosCoincidentes.length === 0 && (
                  <div className="p-4 text-center text-amber-600 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                    Esta OC no contiene los productos necesarios
                  </div>
                )}
              </div>
            )}

            {/* Botón vincular */}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleVincular}
                loading={loading}
                disabled={!selectedOCId || productosCoincidentes.length === 0}
              >
                <Link2 className="h-4 w-4 mr-2" />
                Vincular y Reservar Stock
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
