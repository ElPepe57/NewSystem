import React, { useState, useMemo } from 'react';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import { Package, CheckCircle2, AlertTriangle, Box, Truck } from 'lucide-react';
import type { OrdenCompra } from '../../../types/ordenCompra.types';

interface RecepcionParcialModalProps {
  isOpen: boolean;
  onClose: () => void;
  orden: OrdenCompra;
  onSubmit: (
    productosRecibidos: Array<{ productoId: string; cantidadRecibida: number }>,
    observaciones?: string
  ) => Promise<void>;
}

export const RecepcionParcialModal: React.FC<RecepcionParcialModalProps> = ({
  isOpen,
  onClose,
  orden,
  onSubmit
}) => {
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [recibirTodo, setRecibirTodo] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  // Calcular pendientes por producto
  const productosConPendiente = useMemo(() => {
    return orden.productos.map(p => {
      const recibido = p.cantidadRecibida || 0;
      const pendiente = p.cantidad - recibido;
      return {
        ...p,
        recibido,
        pendiente,
        completo: pendiente <= 0
      };
    });
  }, [orden.productos]);

  const hayPendientes = productosConPendiente.some(p => !p.completo);

  // Número de recepción
  const numeroRecepcion = (orden.recepcionesParciales?.length || 0) + 1;

  // Manejar cambio de checkbox "Recibir todo"
  const handleRecibirTodo = (checked: boolean) => {
    setRecibirTodo(checked);
    if (checked) {
      const nuevasCantidades: Record<string, number> = {};
      productosConPendiente.forEach(p => {
        if (!p.completo) {
          nuevasCantidades[p.productoId] = p.pendiente;
        }
      });
      setCantidades(nuevasCantidades);
    } else {
      setCantidades({});
    }
  };

  // Manejar cambio de cantidad individual
  const handleCantidadChange = (productoId: string, valor: number, max: number) => {
    const cantidadFinal = Math.max(0, Math.min(valor, max));
    setCantidades(prev => ({
      ...prev,
      [productoId]: cantidadFinal
    }));
    // Si cambiaron manualmente, desmarcar "recibir todo"
    if (recibirTodo) setRecibirTodo(false);
  };

  // Toggle producto individual
  const toggleProducto = (productoId: string, pendiente: number) => {
    setCantidades(prev => {
      const current = prev[productoId] || 0;
      if (current > 0) {
        const { [productoId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productoId]: pendiente };
    });
    if (recibirTodo) setRecibirTodo(false);
  };

  // Calcular resumen
  const resumen = useMemo(() => {
    const productosSeleccionados = Object.entries(cantidades)
      .filter(([, cant]) => cant > 0);
    const totalUnidades = productosSeleccionados.reduce((sum, [, cant]) => sum + cant, 0);

    // Calcular costo de esta entrega
    const totalUnidadesOrden = orden.productos.reduce((sum, p) => sum + p.cantidad, 0);
    const costosAdicionales = (orden.impuestoUSD || 0) + (orden.gastosEnvioUSD || 0) + (orden.otrosGastosUSD || 0);
    const costoAdicionalPorUnidad = totalUnidadesOrden > 0 ? costosAdicionales / totalUnidadesOrden : 0;

    let costoRecepcionUSD = 0;
    for (const [productoId, cant] of productosSeleccionados) {
      const producto = orden.productos.find(p => p.productoId === productoId);
      if (producto) {
        costoRecepcionUSD += cant * (producto.costoUnitario + costoAdicionalPorUnidad);
      }
    }

    // Verificar si esta recepción completa la orden
    const esRecepcionFinal = productosConPendiente.every(p => {
      const cantidadAAgregar = cantidades[p.productoId] || 0;
      return (p.recibido + cantidadAAgregar) >= p.cantidad;
    });

    return {
      productosCount: productosSeleccionados.length,
      totalUnidades,
      costoRecepcionUSD,
      esRecepcionFinal
    };
  }, [cantidades, orden, productosConPendiente]);

  const handleSubmit = async () => {
    const productosRecibidos = Object.entries(cantidades)
      .filter(([, cant]) => cant > 0)
      .map(([productoId, cantidadRecibida]) => ({ productoId, cantidadRecibida }));

    if (productosRecibidos.length === 0) return;

    setLoading(true);
    setResultado(null);

    try {
      await onSubmit(productosRecibidos, observaciones || undefined);
      setResultado({
        success: true,
        message: resumen.esRecepcionFinal
          ? `Recepcion final completada. ${resumen.totalUnidades} unidades recibidas. La orden está completa.`
          : `Recepcion #${numeroRecepcion} registrada. ${resumen.totalUnidades} unidades recibidas.`
      });
    } catch (error: any) {
      setResultado({
        success: false,
        error: error.message || 'Error al registrar recepción'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCantidades({});
    setRecibirTodo(false);
    setObservaciones('');
    setResultado(null);
    onClose();
  };

  // Progreso global de la OC
  const totalOrdenado = orden.productos.reduce((sum, p) => sum + p.cantidad, 0);
  const totalRecibido = orden.productos.reduce((sum, p) => sum + (p.cantidadRecibida || 0), 0);
  const porcentajeGlobal = totalOrdenado > 0 ? (totalRecibido / totalOrdenado) * 100 : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Recepción de Productos - ${orden.numeroOrden}`}
      subtitle={`${orden.nombreProveedor} · Recepción #${numeroRecepcion}`}
      size="lg"
    >
      <div className="space-y-5">
        {/* Progreso global */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Progreso de recepción</span>
            </div>
            <span className="text-sm font-bold text-blue-900">{totalRecibido}/{totalOrdenado} unidades ({porcentajeGlobal.toFixed(0)}%)</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all"
              style={{ width: `${porcentajeGlobal}%` }}
            />
          </div>
          {orden.recepcionesParciales && orden.recepcionesParciales.length > 0 && (
            <div className="mt-2 text-xs text-blue-700">
              {orden.recepcionesParciales.length} recepción(es) previas registradas
            </div>
          )}
        </div>

        {/* Resultado */}
        {resultado?.success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-green-900">Recepción registrada</span>
            </div>
            <p className="text-sm text-green-800">{resultado.message}</p>
            <Button variant="primary" className="mt-3" onClick={handleClose}>
              Cerrar
            </Button>
          </div>
        )}

        {resultado?.success === false && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="text-red-900">{resultado.error}</span>
            </div>
          </div>
        )}

        {/* Formulario de recepción */}
        {!resultado?.success && (
          <>
            {/* Checkbox recibir todo */}
            {hayPendientes && (
              <label className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors">
                <input
                  type="checkbox"
                  checked={recibirTodo}
                  onChange={(e) => handleRecibirTodo(e.target.checked)}
                  className="h-4 w-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                />
                <span className="text-sm font-medium text-amber-900">Recibir TODO lo pendiente (recepción completa)</span>
              </label>
            )}

            {/* Lista de productos */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-600 w-8"></th>
                    <th className="px-3 py-2 text-left text-gray-600">Producto</th>
                    <th className="px-2 py-2 text-center text-gray-600">Ordenado</th>
                    <th className="px-2 py-2 text-center text-gray-600">Recibido</th>
                    <th className="px-2 py-2 text-center text-gray-600">Pendiente</th>
                    <th className="px-3 py-2 text-center text-gray-600">Recibir ahora</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {productosConPendiente.map(p => (
                    <tr key={p.productoId} className={p.completo ? 'bg-green-50 opacity-60' : 'hover:bg-gray-50'}>
                      <td className="px-3 py-2">
                        {p.completo ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <input
                            type="checkbox"
                            checked={(cantidades[p.productoId] || 0) > 0}
                            onChange={() => toggleProducto(p.productoId, p.pendiente)}
                            className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{p.nombreComercial}</div>
                        <div className="text-xs text-gray-500">{p.marca} · {p.sku}</div>
                      </td>
                      <td className="px-2 py-2 text-center font-medium">{p.cantidad}</td>
                      <td className="px-2 py-2 text-center">
                        <span className={p.recibido > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                          {p.recibido}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        {p.completo ? (
                          <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Completo</span>
                        ) : (
                          <span className="text-amber-600 font-medium">{p.pendiente}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {p.completo ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            max={p.pendiente}
                            value={cantidades[p.productoId] || 0}
                            onChange={(e) => handleCantidadChange(p.productoId, parseInt(e.target.value) || 0, p.pendiente)}
                            className="w-16 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones (opcional)
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Ej: Paquete 2 de 3, tracking TBA12345..."
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Resumen */}
            {resumen.totalUnidades > 0 && (
              <div className={`rounded-lg p-4 border ${resumen.esRecepcionFinal ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-semibold text-gray-900">
                    Resumen de recepción #{numeroRecepcion}
                  </span>
                  {resumen.esRecepcionFinal && (
                    <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                      RECEPCIÓN FINAL
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Productos:</span>
                    <span className="ml-1 font-medium">{resumen.productosCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Unidades:</span>
                    <span className="ml-1 font-medium">{resumen.totalUnidades}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Valor:</span>
                    <span className="ml-1 font-medium">${resumen.costoRecepcionUSD.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Botones */}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                disabled={resumen.totalUnidades === 0}
              >
                <Box className="h-4 w-4 mr-2" />
                {resumen.esRecepcionFinal ? 'Recibir y Completar Orden' : `Registrar Recepción #${numeroRecepcion}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
