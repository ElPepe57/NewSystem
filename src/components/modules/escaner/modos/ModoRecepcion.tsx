import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react';
import { Truck, Package, CheckCircle2, AlertTriangle, Clock, ChevronDown, Calendar } from 'lucide-react';
import { transferenciaService } from '../../../../services/transferencia.service';
import { ProductoService } from '../../../../services/producto.service';
import { useToastStore } from '../../../../store/toastStore';
import { useAuthStore } from '../../../../store/authStore';
import type { Transferencia, RecepcionFormData } from '../../../../types/transferencia.types';
import { getLabelTipoTransferencia } from '../../../../utils/multiOrigen.helpers';

export interface ModoRecepcionHandle {
  handleScan: (barcode: string, format?: string) => void;
}

interface ProductoAgrupado {
  productoId: string;
  sku: string;
  nombre: string;
  lote?: string;
  pendiente: number;
  unidadIds: string[];
}

export const ModoRecepcion = forwardRef<ModoRecepcionHandle>((_props, ref) => {
  const toast = useToastStore();
  const { user } = useAuthStore();

  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [selectedTransferencia, setSelectedTransferencia] = useState<Transferencia | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cantidadRecibir, setCantidadRecibir] = useState<Record<string, number>>({});
  const [fechasVencimiento, setFechasVencimiento] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState('');

  // Load pending transfers
  useEffect(() => {
    const load = async () => {
      try {
        const pendientes = await transferenciaService.getPendientesRecepcion();
        // Filter to only en_transito and recibida_parcial
        const validas = pendientes.filter(t =>
          t.estado === 'en_transito' || t.estado === 'recibida_parcial'
        );
        setTransferencias(validas);
      } catch {
        toast.error('Error al cargar transferencias');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  // Group pending units by product when a transfer is selected
  const productosAgrupados = useMemo((): ProductoAgrupado[] => {
    if (!selectedTransferencia) return [];

    const pendientes = selectedTransferencia.unidades.filter(u =>
      u.estadoTransferencia === 'enviada' ||
      u.estadoTransferencia === 'faltante' ||
      u.estadoTransferencia === 'pendiente' ||
      u.estadoTransferencia === 'preparada'
    );

    const map = new Map<string, { sku: string; nombre: string; lote?: string; unidadIds: string[] }>();
    for (const u of pendientes) {
      const existing = map.get(u.productoId);
      if (existing) {
        existing.unidadIds.push(u.unidadId);
      } else {
        // Use productosSummary for name if available
        const summary = selectedTransferencia.productosSummary?.find(ps => ps.productoId === u.productoId);
        map.set(u.productoId, {
          sku: u.sku,
          nombre: summary?.nombre || u.sku,
          lote: u.lote,
          unidadIds: [u.unidadId],
        });
      }
    }

    return [...map.entries()].map(([productoId, data]) => ({
      productoId,
      sku: data.sku,
      nombre: data.nombre,
      lote: data.lote,
      pendiente: data.unidadIds.length,
      unidadIds: data.unidadIds,
    }));
  }, [selectedTransferencia]);

  // Reset quantities when transfer changes
  useEffect(() => {
    const init: Record<string, number> = {};
    productosAgrupados.forEach(p => { init[p.productoId] = 0; });
    setCantidadRecibir(init);
    setFechasVencimiento({});
    setObservaciones('');
  }, [productosAgrupados]);

  // Handle barcode scan
  const handleScan = useCallback(async (barcode: string) => {
    if (!selectedTransferencia) {
      toast.warning('Selecciona una transferencia primero');
      return;
    }

    // Find product matching by SKU first
    let prod = productosAgrupados.find(p => p.sku === barcode);

    // If not found by SKU, try UPC lookup
    if (!prod) {
      try {
        const producto = await ProductoService.getByCodigoUPC(barcode);
        if (producto) {
          prod = productosAgrupados.find(p => p.productoId === producto.id);
        }
      } catch { /* silent */ }
    }

    if (!prod) {
      toast.warning(`Codigo ${barcode} no encontrado en esta transferencia`);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      return;
    }

    const current = cantidadRecibir[prod.productoId] || 0;
    if (current >= prod.pendiente) {
      toast.warning(`${prod.nombre}: ya alcanzaste la cantidad esperada (${prod.pendiente})`);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      return;
    }

    setCantidadRecibir(prev => ({ ...prev, [prod.productoId]: current + 1 }));
    if (navigator.vibrate) navigator.vibrate(100);
    toast.success(`${prod.nombre}`, `${current + 1}/${prod.pendiente}`);
  }, [selectedTransferencia, productosAgrupados, cantidadRecibir, toast]);

  // Expose to parent
  useImperativeHandle(ref, () => ({
    handleScan,
  }), [handleScan]);

  const totalPendiente = productosAgrupados.reduce((s, p) => s + p.pendiente, 0);
  const totalARecibir = Object.values(cantidadRecibir).reduce((s, n) => s + n, 0);
  const progreso = totalPendiente > 0 ? (totalARecibir / totalPendiente) * 100 : 0;

  const handleConfirmarRecepcion = useCallback(async () => {
    if (!selectedTransferencia || !user?.uid || totalARecibir === 0) return;
    setIsSubmitting(true);

    try {
      // Build unidadesRecibidas: for each product, mark first N units as received
      const unidadesRecibidas: RecepcionFormData['unidadesRecibidas'] = [];
      for (const prod of productosAgrupados) {
        const cant = cantidadRecibir[prod.productoId] || 0;
        prod.unidadIds.forEach((unidadId, idx) => {
          unidadesRecibidas.push({
            unidadId,
            recibida: idx < cant,
            danada: false,
          });
        });
      }

      // Filter out empty fecha entries
      const fechasValidas: Record<string, string> = {};
      for (const [pid, fecha] of Object.entries(fechasVencimiento)) {
        if (fecha) fechasValidas[pid] = fecha;
      }

      await transferenciaService.registrarRecepcion(
        {
          transferenciaId: selectedTransferencia.id,
          unidadesRecibidas,
          fechasVencimiento: Object.keys(fechasValidas).length > 0 ? fechasValidas : undefined,
          observaciones: observaciones || undefined,
        },
        user.uid
      );

      toast.success('Recepcion registrada correctamente');

      // Refresh transfers list
      const pendientes = await transferenciaService.getPendientesRecepcion();
      const validas = pendientes.filter(t =>
        t.estado === 'en_transito' || t.estado === 'recibida_parcial'
      );
      setTransferencias(validas);
      setSelectedTransferencia(null);
    } catch (error: any) {
      toast.error(error?.message || 'Error al registrar recepcion');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedTransferencia, user, totalARecibir, productosAgrupados, cantidadRecibir, observaciones, toast]);

  const handleRecibirTodas = useCallback(() => {
    const updated: Record<string, number> = {};
    productosAgrupados.forEach(p => { updated[p.productoId] = p.pendiente; });
    setCantidadRecibir(updated);
  }, [productosAgrupados]);

  const handleLimpiar = useCallback(() => {
    const init: Record<string, number> = {};
    productosAgrupados.forEach(p => { init[p.productoId] = 0; });
    setCantidadRecibir(init);
  }, [productosAgrupados]);

  return (
    <div className="space-y-4">
      {/* Transfer selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Truck className="h-4 w-4 text-gray-500" />
          Transferencia a recibir
        </label>
        {loading ? (
          <div className="flex items-center gap-2 py-2">
            <div className="h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Cargando transferencias...</span>
          </div>
        ) : transferencias.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">No hay transferencias pendientes de recepcion</p>
        ) : (
          <select
            value={selectedTransferencia?.id || ''}
            onChange={(e) => {
              const t = transferencias.find(tr => tr.id === e.target.value) || null;
              setSelectedTransferencia(t);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Selecciona una transferencia</option>
            {transferencias.map(t => (
              <option key={t.id} value={t.id}>
                {t.numeroTransferencia} — {t.almacenOrigenNombre} → {t.almacenDestinoNombre} ({t.totalUnidades} uds)
                {t.estado === 'recibida_parcial' ? ' [Parcial]' : ''}
              </option>
            ))}
          </select>
        )}

        {/* Transfer summary */}
        {selectedTransferencia && (
          <div className="mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1">
            <p><span className="text-blue-600 font-medium">Origen:</span> {selectedTransferencia.almacenOrigenNombre}</p>
            <p><span className="text-blue-600 font-medium">Destino:</span> {selectedTransferencia.almacenDestinoNombre}</p>
            <p><span className="text-blue-600 font-medium">Tipo:</span> {getLabelTipoTransferencia(selectedTransferencia.tipo)}</p>
            <p><span className="text-blue-600 font-medium">Unidades pendientes:</span> {totalPendiente} de {selectedTransferencia.totalUnidades}</p>
          </div>
        )}
      </div>

      {/* Products list with reception */}
      {selectedTransferencia && productosAgrupados.length > 0 && (
        <>
          {/* Progress bar */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Progreso: {totalARecibir}/{totalPendiente}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRecibirTodas}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  Recibir todas
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleLimpiar}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Limpiar
                </button>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  progreso >= 100 ? 'bg-green-500' : progreso > 0 ? 'bg-primary-500' : 'bg-gray-300'
                }`}
                style={{ width: `${Math.min(progreso, 100)}%` }}
              />
            </div>
          </div>

          {/* Product cards */}
          <div className="space-y-2">
            {productosAgrupados.map(prod => {
              const recibido = cantidadRecibir[prod.productoId] || 0;
              const completo = recibido >= prod.pendiente;
              const parcial = recibido > 0 && !completo;

              return (
                <div
                  key={prod.productoId}
                  className={`bg-white border rounded-lg p-3 transition-all ${
                    completo
                      ? 'border-green-300 bg-green-50/30'
                      : parcial
                        ? 'border-amber-300 bg-amber-50/20'
                        : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {completo ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : parcial ? (
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                        )}
                        <p className="text-sm font-medium text-gray-900 truncate">{prod.nombre}</p>
                      </div>
                      <p className="text-xs text-gray-500 ml-6">
                        {prod.sku} {prod.lote && `· Lote: ${prod.lote}`}
                      </p>

                      {/* Fecha vencimiento input */}
                      <div className="ml-6 mt-2 flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        <input
                          type="date"
                          value={fechasVencimiento[prod.productoId] || ''}
                          onChange={(e) => setFechasVencimiento(prev => ({
                            ...prev,
                            [prod.productoId]: e.target.value,
                          }))}
                          className="text-xs border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500"
                          placeholder="Vencimiento"
                        />
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setCantidadRecibir(prev => ({
                          ...prev,
                          [prod.productoId]: Math.max(0, (prev[prod.productoId] || 0) - 1),
                        }))}
                        className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold"
                      >
                        -
                      </button>
                      <div className="text-center min-w-[3rem]">
                        <span className={`text-sm font-bold tabular-nums ${
                          completo ? 'text-green-600' : parcial ? 'text-amber-600' : 'text-gray-900'
                        }`}>
                          {recibido}
                        </span>
                        <span className="text-xs text-gray-400">/{prod.pendiente}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCantidadRecibir(prev => ({
                          ...prev,
                          [prod.productoId]: Math.min(prod.pendiente, (prev[prod.productoId] || 0) + 1),
                        }))}
                        disabled={completo}
                        className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Observaciones */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Observaciones (opcional)</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Notas sobre la recepcion..."
            />
          </div>

          {/* Action button - sticky bottom */}
          <div className="sticky bottom-0 bg-gray-50/95 backdrop-blur-sm border-t border-gray-200 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 py-3">
            <button
              type="button"
              onClick={handleConfirmarRecepcion}
              disabled={isSubmitting || totalARecibir === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isSubmitting
                ? 'Registrando...'
                : `Confirmar Recepcion (${totalARecibir} unidades)`
              }
            </button>
          </div>
        </>
      )}

      {/* Empty state when no transfer selected */}
      {selectedTransferencia && productosAgrupados.length === 0 && (
        <div className="text-center py-8">
          <Package className="h-8 w-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Todas las unidades ya fueron recibidas</p>
        </div>
      )}
    </div>
  );
});

ModoRecepcion.displayName = 'ModoRecepcion';
