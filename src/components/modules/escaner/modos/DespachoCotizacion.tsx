import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react';
import { FileText, CheckCircle2, AlertTriangle, Clock, Package, Truck } from 'lucide-react';
import { VentaService } from '../../../../services/venta.service';
import { ProductoService } from '../../../../services/producto.service';
import { useToastStore } from '../../../../store/toastStore';
import { useAuthStore } from '../../../../store/authStore';
import type { Venta } from '../../../../types/venta.types';

export interface DespachoCotizacionHandle {
  handleScan: (barcode: string, format?: string) => void;
}

interface ProductoDespacho {
  productoId: string;
  sku: string;
  nombre: string;
  esperado: number;
  escaneado: number;
  unidadesAsignadas: string[];
}

export const DespachoCotizacion = forwardRef<DespachoCotizacionHandle>((_props, ref) => {
  const toast = useToastStore();
  const { user } = useAuthStore();

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const [productos, setProductos] = useState<ProductoDespacho[]>([]);
  const [loading, setLoading] = useState(true);
  const [isValidated, setIsValidated] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  // Load ventas ready for dispatch (asignada or en_entrega)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [asignadas, enEntrega] = await Promise.all([
          VentaService.getByEstado('asignada').catch(() => [] as Venta[]),
          VentaService.getByEstado('en_entrega').catch(() => [] as Venta[]),
        ]);
        if (cancelled) return;
        // Combine and sort by date
        const all = [...asignadas, ...enEntrega].sort(
          (a, b) => b.fechaCreacion.toMillis() - a.fechaCreacion.toMillis()
        );
        setVentas(all);
      } catch {
        if (!cancelled) toast.error('Error al cargar ventas');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build product list when venta is selected
  useEffect(() => {
    if (!selectedVenta) {
      setProductos([]);
      setIsValidated(false);
      return;
    }

    const prods: ProductoDespacho[] = selectedVenta.productos.map(p => ({
      productoId: p.productoId,
      sku: p.sku,
      nombre: `${p.marca} ${p.nombreComercial}`,
      esperado: p.cantidadPorEntregar ?? p.cantidad,
      escaneado: 0,
      unidadesAsignadas: p.unidadesAsignadas || [],
    }));

    setProductos(prods.filter(p => p.esperado > 0));
    setIsValidated(false);
  }, [selectedVenta]);

  // Check validation
  useEffect(() => {
    if (productos.length > 0 && productos.every(p => p.escaneado >= p.esperado)) {
      setIsValidated(true);
    } else {
      setIsValidated(false);
    }
  }, [productos]);

  const handleScan = useCallback(async (barcode: string) => {
    if (!selectedVenta) {
      toast.warning('Selecciona una venta primero');
      return;
    }

    // Match by SKU first
    let prodIdx = productos.findIndex(p => p.sku === barcode);

    // Try UPC lookup
    if (prodIdx === -1) {
      try {
        const producto = await ProductoService.getByCodigoUPC(barcode);
        if (producto) {
          prodIdx = productos.findIndex(p => p.productoId === producto.id);
        }
      } catch { /* silent */ }
    }

    if (prodIdx === -1) {
      toast.warning(`Codigo ${barcode} no encontrado en esta venta`);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      return;
    }

    const prod = productos[prodIdx];
    if (prod.escaneado >= prod.esperado) {
      toast.warning(`${prod.nombre}: ya alcanzaste la cantidad esperada (${prod.esperado})`);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      return;
    }

    setProductos(prev => prev.map((p, i) =>
      i === prodIdx ? { ...p, escaneado: p.escaneado + 1 } : p
    ));
    if (navigator.vibrate) navigator.vibrate(100);
    toast.success(`${prod.nombre}`, `${prod.escaneado + 1}/${prod.esperado}`);
  }, [selectedVenta, productos, toast]);

  const handleConfirmarDespacho = useCallback(async () => {
    if (!selectedVenta?.id || !user?.uid) return;
    setIsDispatching(true);
    try {
      if (selectedVenta.estado === 'asignada') {
        // Transition to en_entrega using the official service method
        await VentaService.marcarEnEntrega(selectedVenta.id, user.uid);
        toast.success('Productos validados', `Venta ${selectedVenta.numeroVenta} marcada en entrega`);
      } else if (selectedVenta.estado === 'en_entrega' || selectedVenta.estado === 'despachada') {
        // Already in entrega/despachada — just confirm visual validation
        toast.success('Productos validados', `Venta ${selectedVenta.numeroVenta} ya esta en proceso de entrega`);
      } else {
        toast.warning(`La venta esta en estado "${selectedVenta.estado}" — no se puede avanzar desde el escaner`);
        return;
      }
      // Remove from list and reset
      setVentas(prev => prev.filter(v => v.id !== selectedVenta.id));
      setSelectedVenta(null);
      setProductos([]);
      setIsValidated(false);
    } catch (error: any) {
      toast.error(error?.message || 'Error al confirmar despacho');
    } finally {
      setIsDispatching(false);
    }
  }, [selectedVenta, user, toast]);

  useImperativeHandle(ref, () => ({ handleScan }), [handleScan]);

  const totalEsperado = productos.reduce((s, p) => s + p.esperado, 0);
  const totalEscaneado = productos.reduce((s, p) => s + p.escaneado, 0);
  const progreso = totalEsperado > 0 ? (totalEscaneado / totalEsperado) * 100 : 0;

  const estadoBadge = (estado: string) => {
    switch (estado) {
      case 'asignada': return <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Asignada</span>;
      case 'en_entrega': return <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">En entrega</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Venta selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <FileText className="h-4 w-4 text-blue-500" />
          Venta a despachar
        </label>
        {loading ? (
          <div className="flex items-center gap-2 py-2">
            <div className="h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Cargando ventas...</span>
          </div>
        ) : ventas.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">No hay ventas listas para despacho</p>
        ) : (
          <select
            value={selectedVenta?.id || ''}
            onChange={(e) => {
              const v = ventas.find(vt => vt.id === e.target.value) || null;
              setSelectedVenta(v);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Selecciona una venta</option>
            {ventas.map(v => (
              <option key={v.id} value={v.id}>
                {v.numeroVenta} — {v.nombreCliente} — S/ {v.totalPEN.toFixed(2)} [{v.estado}]
              </option>
            ))}
          </select>
        )}

        {/* Venta summary */}
        {selectedVenta && (
          <div className="mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1">
            <div className="flex items-center justify-between">
              <p><span className="text-blue-600 font-medium">Cliente:</span> {selectedVenta.nombreCliente}</p>
              {estadoBadge(selectedVenta.estado)}
            </div>
            <p><span className="text-blue-600 font-medium">Total:</span> S/ {selectedVenta.totalPEN.toFixed(2)}</p>
            <p><span className="text-blue-600 font-medium">Canal:</span> {selectedVenta.canalNombre || selectedVenta.canal}</p>
            {selectedVenta.direccionEntrega && (
              <p><span className="text-blue-600 font-medium">Direccion:</span> {selectedVenta.direccionEntrega}</p>
            )}
            <p><span className="text-blue-600 font-medium">Productos:</span> {selectedVenta.productos.length} items, {selectedVenta.productos.reduce((s, p) => s + p.cantidad, 0)} uds</p>
          </div>
        )}
      </div>

      {/* Products validation */}
      {selectedVenta && productos.length > 0 && (
        <>
          {/* Progress */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Validacion: {totalEscaneado}/{totalEsperado}
              </span>
              {isValidated && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" /> Completo
                </span>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  progreso >= 100 ? 'bg-green-500' : progreso > 0 ? 'bg-blue-500' : 'bg-gray-300'
                }`}
                style={{ width: `${Math.min(progreso, 100)}%` }}
              />
            </div>
          </div>

          {/* Product cards */}
          <div className="space-y-2">
            {productos.map(prod => {
              const completo = prod.escaneado >= prod.esperado;
              const parcial = prod.escaneado > 0 && !completo;

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
                      <p className="text-xs text-gray-500 ml-6">{prod.sku}</p>
                    </div>

                    <div className="text-center min-w-[3rem] shrink-0">
                      <span className={`text-sm font-bold tabular-nums ${
                        completo ? 'text-green-600' : parcial ? 'text-amber-600' : 'text-gray-900'
                      }`}>
                        {prod.escaneado}
                      </span>
                      <span className="text-xs text-gray-400">/{prod.esperado}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Validated — confirm dispatch */}
          {isValidated && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-700">Todos los productos validados</p>
              <p className="text-xs text-green-600 mt-1 mb-3">La venta esta lista para despacho</p>
              <button
                type="button"
                onClick={handleConfirmarDespacho}
                disabled={isDispatching}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <Truck className="h-4 w-4" />
                {isDispatching ? 'Confirmando...' : 'Confirmar Validacion'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {selectedVenta && productos.length === 0 && (
        <div className="text-center py-8">
          <Package className="h-8 w-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Todos los productos ya fueron entregados</p>
        </div>
      )}
    </div>
  );
});

DespachoCotizacion.displayName = 'DespachoCotizacion';
