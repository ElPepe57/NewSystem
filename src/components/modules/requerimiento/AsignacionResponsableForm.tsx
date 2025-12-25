import React, { useState, useEffect } from 'react';
import { Users, Package, Calendar, DollarSign, Plus, X, Truck, Check, AlertCircle } from 'lucide-react';
import { Button, Modal } from '../../common';
import { almacenService } from '../../../services/almacen.service';
import { requerimientoService } from '../../../services/requerimiento.service';
import type { Almacen } from '../../../types/almacen.types';
import type {
  Requerimiento,
  AsignacionResponsable,
  AsignarResponsableData,
  ProductoRequerimiento
} from '../../../types/requerimiento.types';

interface Props {
  requerimiento: Requerimiento;
  isOpen: boolean;
  onClose: () => void;
  onAsignacionCreada: () => void;
  userId: string;
}

export const AsignacionResponsableForm: React.FC<Props> = ({
  requerimiento,
  isOpen,
  onClose,
  onAsignacionCreada,
  userId
}) => {
  const [viajeros, setViajeros] = useState<Almacen[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedViajeroId, setSelectedViajeroId] = useState('');
  const [productosAsignados, setProductosAsignados] = useState<{
    productoId: string;
    cantidad: number;
  }[]>([]);
  const [fechaEstimadaLlegada, setFechaEstimadaLlegada] = useState('');
  const [costoEstimadoUSD, setCostoEstimadoUSD] = useState<number | undefined>();
  const [notas, setNotas] = useState('');

  // Cargar viajeros
  useEffect(() => {
    const loadViajeros = async () => {
      try {
        const almacenes = await almacenService.getAll();
        // Filtrar solo viajeros activos
        const viajerosActivos = almacenes.filter(
          a => a.esViajero && a.estadoAlmacen === 'activo'
        );
        setViajeros(viajerosActivos);
      } catch (error) {
        console.error('Error al cargar viajeros:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadViajeros();
      // Reset form
      setSelectedViajeroId('');
      setProductosAsignados([]);
      setFechaEstimadaLlegada('');
      setCostoEstimadoUSD(undefined);
      setNotas('');
    }
  }, [isOpen]);

  // Productos con cantidad pendiente
  const productosPendientes = requerimiento.productos.filter(p => p.cantidadPendiente > 0);

  // Obtener viajero seleccionado
  const viajeroSeleccionado = viajeros.find(v => v.id === selectedViajeroId);

  // Inicializar productos cuando se selecciona viajero
  useEffect(() => {
    if (selectedViajeroId && productosAsignados.length === 0) {
      // Por defecto, asignar toda la cantidad pendiente
      setProductosAsignados(
        productosPendientes.map(p => ({
          productoId: p.productoId,
          cantidad: p.cantidadPendiente
        }))
      );

      // Si el viajero tiene fecha de próximo viaje, usarla
      if (viajeroSeleccionado?.proximoViaje) {
        const fecha = viajeroSeleccionado.proximoViaje.toDate();
        setFechaEstimadaLlegada(fecha.toISOString().split('T')[0]);
      }
    }
  }, [selectedViajeroId]);

  const handleCantidadChange = (productoId: string, cantidad: number) => {
    const producto = productosPendientes.find(p => p.productoId === productoId);
    if (!producto) return;

    // Validar que no exceda lo pendiente
    const cantidadValidada = Math.min(Math.max(0, cantidad), producto.cantidadPendiente);

    setProductosAsignados(prev => {
      const existing = prev.find(p => p.productoId === productoId);
      if (existing) {
        return prev.map(p =>
          p.productoId === productoId ? { ...p, cantidad: cantidadValidada } : p
        );
      }
      return [...prev, { productoId, cantidad: cantidadValidada }];
    });
  };

  const handleSubmit = async () => {
    if (!selectedViajeroId) {
      alert('Selecciona un viajero/responsable');
      return;
    }

    const productosConCantidad = productosAsignados.filter(p => p.cantidad > 0);
    if (productosConCantidad.length === 0) {
      alert('Asigna al menos un producto con cantidad mayor a 0');
      return;
    }

    setSubmitting(true);
    try {
      const data: AsignarResponsableData = {
        responsableId: selectedViajeroId,
        productos: productosConCantidad.map(p => ({
          productoId: p.productoId,
          cantidadAsignada: p.cantidad
        })),
        fechaEstimadaLlegada: fechaEstimadaLlegada ? new Date(fechaEstimadaLlegada) : undefined,
        costoEstimadoUSD,
        notas: notas || undefined
      };

      await requerimientoService.asignarResponsable(requerimiento.id, data, userId);

      alert('Responsable asignado correctamente');
      onAsignacionCreada();
      onClose();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const totalUnidadesAsignadas = productosAsignados.reduce((sum, p) => sum + p.cantidad, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Asignar Responsable/Viajero"
      size="lg"
    >
      <div className="space-y-6">
        {/* Info del requerimiento */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-blue-600">Requerimiento</span>
              <div className="font-bold text-blue-900">{requerimiento.numeroRequerimiento}</div>
            </div>
            <div className="text-right">
              <span className="text-sm text-blue-600">Productos pendientes</span>
              <div className="font-bold text-blue-900">
                {productosPendientes.reduce((s, p) => s + p.cantidadPendiente, 0)} unidades
              </div>
            </div>
          </div>
        </div>

        {/* Selector de viajero */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Users className="inline h-4 w-4 mr-1" />
            Viajero/Responsable
          </label>
          {loading ? (
            <div className="text-gray-500 text-sm">Cargando viajeros...</div>
          ) : viajeros.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
              <AlertCircle className="inline h-4 w-4 mr-2" />
              No hay viajeros activos registrados. Crea uno en el módulo de Transferencias.
            </div>
          ) : (
            <select
              value={selectedViajeroId}
              onChange={(e) => setSelectedViajeroId(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-0"
            >
              <option value="">Seleccionar viajero...</option>
              {viajeros.map(v => (
                <option key={v.id} value={v.id}>
                  {v.codigo} - {v.nombre}
                  {v.proximoViaje && ` (Próx. viaje: ${v.proximoViaje.toDate().toLocaleDateString('es-PE')})`}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Info del viajero seleccionado */}
        {viajeroSeleccionado && (
          <div className="bg-gray-50 rounded-lg p-4 border">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-gray-900">{viajeroSeleccionado.nombre}</div>
                <div className="text-sm text-gray-500">
                  {viajeroSeleccionado.ciudad}, {viajeroSeleccionado.estado || 'USA'}
                </div>
                {viajeroSeleccionado.frecuenciaViaje && (
                  <div className="text-sm text-gray-500">
                    Frecuencia: {viajeroSeleccionado.frecuenciaViaje}
                  </div>
                )}
              </div>
              <div className="text-right">
                {viajeroSeleccionado.costoPromedioFlete && (
                  <div className="text-sm">
                    <span className="text-gray-500">Flete promedio:</span>
                    <span className="font-medium text-gray-900 ml-1">
                      ${viajeroSeleccionado.costoPromedioFlete}/ud
                    </span>
                  </div>
                )}
                {viajeroSeleccionado.proximoViaje && (
                  <div className="text-sm text-blue-600">
                    Próximo viaje: {viajeroSeleccionado.proximoViaje.toDate().toLocaleDateString('es-PE')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Productos a asignar */}
        {selectedViajeroId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Package className="inline h-4 w-4 mr-1" />
              Productos a asignar
            </label>
            <div className="border rounded-lg divide-y">
              {productosPendientes.map(prod => {
                const asignado = productosAsignados.find(p => p.productoId === prod.productoId);
                return (
                  <div key={prod.productoId} className="p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {prod.sku} - {prod.marca} {prod.nombreComercial}
                      </div>
                      <div className="text-sm text-gray-500">
                        Pendiente: {prod.cantidadPendiente} de {prod.cantidadSolicitada}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <label className="text-xs text-gray-500">Asignar</label>
                        <input
                          type="number"
                          min="0"
                          max={prod.cantidadPendiente}
                          value={asignado?.cantidad || 0}
                          onChange={(e) => handleCantidadChange(prod.productoId, parseInt(e.target.value) || 0)}
                          className="w-20 px-3 py-2 rounded border border-gray-300 text-center"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCantidadChange(prod.productoId, prod.cantidadPendiente)}
                        title="Asignar todo"
                      >
                        Todo
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-right text-sm">
              <span className="text-gray-500">Total a asignar:</span>
              <span className="font-bold text-primary-600 ml-2">{totalUnidadesAsignadas} unidades</span>
            </div>
          </div>
        )}

        {/* Fecha estimada y costo */}
        {selectedViajeroId && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                Fecha estimada de llegada
              </label>
              <input
                type="date"
                value={fechaEstimadaLlegada}
                onChange={(e) => setFechaEstimadaLlegada(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="inline h-4 w-4 mr-1" />
                Costo estimado (USD)
              </label>
              <input
                type="number"
                step="0.01"
                value={costoEstimadoUSD || ''}
                onChange={(e) => setCostoEstimadoUSD(parseFloat(e.target.value) || undefined)}
                placeholder="0.00"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-primary-500"
              />
            </div>
          </div>
        )}

        {/* Notas */}
        {selectedViajeroId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas (opcional)
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Instrucciones especiales, ubicación de recojo, etc."
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-primary-500 resize-none"
            />
          </div>
        )}

        {/* Acciones */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || !selectedViajeroId || totalUnidadesAsignadas === 0}
          >
            {submitting ? (
              'Asignando...'
            ) : (
              <>
                <Truck className="h-4 w-4 mr-2" />
                Asignar Responsable
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
