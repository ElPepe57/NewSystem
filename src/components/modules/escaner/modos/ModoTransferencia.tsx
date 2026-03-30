import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react';
import { ArrowRightLeft, Warehouse, Package, CheckCircle2, Trash2, Minus, Plus, AlertCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { almacenService } from '../../../../services/almacen.service';
import { unidadService } from '../../../../services/unidad.service';
import { transferenciaService } from '../../../../services/transferencia.service';
import { ProductoService } from '../../../../services/producto.service';
import { useToastStore } from '../../../../store/toastStore';
import { useAuthStore } from '../../../../store/authStore';
import type { Almacen } from '../../../../types/almacen.types';
import type { Unidad } from '../../../../types/unidad.types';
import type { TipoTransferencia } from '../../../../types/transferencia.types';
import { esTipoTransferenciaInternacional, esTipoTransferenciaInterna, getLabelTipoTransferencia } from '../../../../utils/multiOrigen.helpers';
import { VincularUPCModal } from '../VincularUPCModal';

export interface ModoTransferenciaHandle {
  handleScan: (barcode: string, format?: string) => void;
}

interface ProductoTransferencia {
  productoId: string;
  sku: string;
  nombre: string;
  cantidad: number;
  disponible: number;
  reservadas: number; // How many of the available units are reserved for a venta
  unidadIds: string[]; // All available unit IDs for this product in origin
}

export const ModoTransferencia = forwardRef<ModoTransferenciaHandle>((_props, ref) => {
  const toast = useToastStore();
  const { user } = useAuthStore();

  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [origenId, setOrigenId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [loading, setLoading] = useState(true);
  const [unidadesOrigen, setUnidadesOrigen] = useState<Unidad[]>([]);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [productos, setProductos] = useState<ProductoTransferencia[]>([]);
  const [notas, setNotas] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVincularModal, setShowVincularModal] = useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState('');
  const [viajeroId, setViajeroId] = useState('');
  const [viajeros, setViajeros] = useState<Almacen[]>([]);
  const [numeroTracking, setNumeroTracking] = useState('');
  const [showEnvioFields, setShowEnvioFields] = useState(false);

  // Load warehouses and viajeros
  useEffect(() => {
    const load = async () => {
      try {
        const [all, viajerosData] = await Promise.all([
          almacenService.getAll(),
          almacenService.getViajeros().catch(() => [] as Almacen[]),
        ]);
        // Solo almacenes locales en Perú (el escáner no se usa en USA)
        setAlmacenes(all.filter(a => a.estadoAlmacen !== 'inactivo' && (a.pais === 'Peru' || a.pais === 'Peru_local')));
        setViajeros(viajerosData);
      } catch {
        toast.error('Error al cargar almacenes');
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load available units when origin changes
  useEffect(() => {
    if (!origenId) {
      setUnidadesOrigen([]);
      setProductos([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoadingUnidades(true);
      try {
        const unidades = await unidadService.getDisponiblesPorAlmacen(origenId);
        if (!cancelled) {
          setUnidadesOrigen(unidades);
          setProductos([]);
        }
      } catch {
        if (!cancelled) toast.error('Error al cargar unidades');
      } finally {
        if (!cancelled) setLoadingUnidades(false);
      }
    };
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origenId]);

  // Group available units by product for quick lookup
  const unidadesPorProducto = useMemo(() => {
    const map = new Map<string, Unidad[]>();
    for (const u of unidadesOrigen) {
      const existing = map.get(u.productoId) || [];
      existing.push(u);
      map.set(u.productoId, existing);
    }
    return map;
  }, [unidadesOrigen]);

  // Count reserved units per product
  const reservadasPorProducto = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of unidadesOrigen) {
      if (u.reservadaPara) {
        map.set(u.productoId, (map.get(u.productoId) || 0) + 1);
      }
    }
    return map;
  }, [unidadesOrigen]);

  // Determine transfer type based on warehouse selection
  const tipoTransferencia = useMemo((): TipoTransferencia | null => {
    if (!origenId || !destinoId) return null;
    const origen = almacenes.find(a => a.id === origenId);
    const destino = almacenes.find(a => a.id === destinoId);
    if (!origen || !destino) return null;
    if (origen.pais !== destino.pais) return 'internacional_peru';
    return 'interna_origen';
  }, [origenId, destinoId, almacenes]);

  const handleScan = useCallback(async (barcode: string) => {
    if (!origenId) {
      toast.warning('Selecciona el almacen de origen primero');
      return;
    }
    if (!destinoId) {
      toast.warning('Selecciona el almacen de destino');
      return;
    }

    // Find product by SKU in available units first
    let productoId: string | null = null;
    let productoNombre = '';
    let productoSku = '';

    for (const [pid, units] of unidadesPorProducto.entries()) {
      if (units[0]?.productoSKU === barcode) {
        productoId = pid;
        productoSku = units[0].productoSKU;
        productoNombre = `${units[0].productoNombre || units[0].productoSKU}`;
        break;
      }
    }

    // Try UPC lookup
    if (!productoId) {
      try {
        const producto = await ProductoService.getByCodigoUPC(barcode);
        if (producto && unidadesPorProducto.has(producto.id)) {
          productoId = producto.id;
          productoSku = producto.sku;
          productoNombre = `${producto.marca} ${producto.nombreComercial}`;
        }
      } catch { /* silent */ }
    }

    if (!productoId) {
      setNotFoundBarcode(barcode);
      setShowVincularModal(true);
      toast.warning(`Codigo ${barcode} no encontrado — puedes vincularlo a un producto`);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      return;
    }

    const unidadesDisponibles = unidadesPorProducto.get(productoId) || [];

    setProductos(prev => {
      const existing = prev.find(p => p.productoId === productoId);
      if (existing) {
        // Already selecting some units from this product
        const alreadySelected = existing.cantidad;
        if (alreadySelected >= unidadesDisponibles.length) {
          toast.warning(`${productoNombre || productoSku}: no hay mas unidades disponibles`);
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          return prev;
        }
        return prev.map(p =>
          p.productoId === productoId
            ? { ...p, cantidad: p.cantidad + 1 }
            : p
        );
      } else {
        // New product
        // Get better name from first unit's product data
        const firstUnit = unidadesDisponibles[0];
        return [...prev, {
          productoId: productoId!,
          sku: productoSku || firstUnit?.productoSKU || '',
          nombre: productoNombre || productoSku || firstUnit?.productoSKU || 'Producto',
          cantidad: 1,
          disponible: unidadesDisponibles.length,
          reservadas: reservadasPorProducto.get(productoId!) || 0,
          unidadIds: unidadesDisponibles.map(u => u.id),
        }];
      }
    });

    if (navigator.vibrate) navigator.vibrate(100);
  }, [origenId, destinoId, unidadesPorProducto, reservadasPorProducto, toast]);

  useImperativeHandle(ref, () => ({ handleScan }), [handleScan]);

  const handleUpdateQuantity = useCallback((productoId: string, cantidad: number) => {
    setProductos(prev => {
      if (cantidad <= 0) return prev.filter(p => p.productoId !== productoId);
      return prev.map(p => {
        if (p.productoId !== productoId) return p;
        return { ...p, cantidad: Math.min(cantidad, p.disponible) };
      });
    });
  }, []);

  const handleRemove = useCallback((productoId: string) => {
    setProductos(prev => prev.filter(p => p.productoId !== productoId));
  }, []);

  const totalUnidades = productos.reduce((s, p) => s + p.cantidad, 0);

  const handleCrearTransferencia = useCallback(async () => {
    if (!user?.uid || !origenId || !destinoId || !tipoTransferencia || totalUnidades === 0) return;

    setIsSubmitting(true);
    try {
      // Collect unit IDs: pick first N units (FEFO — already sorted by fecha vencimiento from service)
      const unidadesIds: string[] = [];
      for (const prod of productos) {
        const ids = prod.unidadIds.slice(0, prod.cantidad);
        unidadesIds.push(...ids);
      }

      const transferenciaId = await transferenciaService.crear({
        tipo: tipoTransferencia,
        almacenOrigenId: origenId,
        almacenDestinoId: destinoId,
        unidadesIds,
        notas: notas || undefined,
        ...(esTipoTransferenciaInternacional(tipoTransferencia) && viajeroId ? { viajeroId } : {}),
        ...(esTipoTransferenciaInternacional(tipoTransferencia) && numeroTracking.trim() ? { numeroTracking: numeroTracking.trim() } : {}),
      }, user.uid);

      toast.success(`Transferencia creada exitosamente`);
      setProductos([]);
      setNotas('');
      setViajeroId('');
      setNumeroTracking('');
      setShowEnvioFields(false);

      // Refresh units
      const unidades = await unidadService.getDisponiblesPorAlmacen(origenId);
      setUnidadesOrigen(unidades);
    } catch (error: any) {
      toast.error(error?.message || 'Error al crear transferencia');
    } finally {
      setIsSubmitting(false);
    }
  }, [user, origenId, destinoId, tipoTransferencia, totalUnidades, productos, notas, toast]);

  const origenNombre = almacenes.find(a => a.id === origenId)?.nombre || '';
  const destinoNombre = almacenes.find(a => a.id === destinoId)?.nombre || '';

  return (
    <div className="space-y-4">
      {/* Warehouse selectors */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
          <Warehouse className="h-4 w-4 text-gray-500" />
          Almacenes
        </label>

        {loading ? (
          <div className="flex items-center gap-2 py-2">
            <div className="h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Cargando almacenes...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Origin */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Origen</label>
              <select
                value={origenId}
                onChange={(e) => {
                  setOrigenId(e.target.value);
                  if (e.target.value === destinoId) setDestinoId('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Selecciona almacen origen</option>
                {almacenes.map(a => (
                  <option key={a.id} value={a.id} disabled={a.id === destinoId}>
                    {a.nombre} ({a.pais})
                  </option>
                ))}
              </select>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <ArrowRightLeft className="h-5 w-5 text-gray-400 rotate-90" />
            </div>

            {/* Destination */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Destino</label>
              <select
                value={destinoId}
                onChange={(e) => setDestinoId(e.target.value)}
                disabled={!origenId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
              >
                <option value="">Selecciona almacen destino</option>
                {almacenes
                  .filter(a => a.id !== origenId)
                  .map(a => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} ({a.pais})
                    </option>
                  ))}
              </select>
            </div>

            {/* Transfer type badge */}
            {tipoTransferencia && (
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full font-medium ${
                  esTipoTransferenciaInternacional(tipoTransferencia)
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {getLabelTipoTransferencia(tipoTransferencia, almacenes.find(a => a.id === origenId)?.pais)}
                </span>
                {loadingUnidades && (
                  <span className="flex items-center gap-1 text-gray-500">
                    <div className="h-3 w-3 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                    Cargando stock...
                  </span>
                )}
                {!loadingUnidades && origenId && (
                  <span className="text-gray-500">
                    {unidadesOrigen.length} unidades disponibles en {origenNombre}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scanned products list */}
      {origenId && destinoId && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Package className="h-4 w-4 text-gray-500" />
              Productos a transferir ({productos.length})
            </label>
            {productos.length > 0 && (
              <button
                type="button"
                onClick={() => setProductos([])}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Limpiar
              </button>
            )}
          </div>

          {productos.length === 0 ? (
            <div className="text-center py-6">
              <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Escanea productos para agregarlos a la transferencia</p>
            </div>
          ) : (
            <div className="space-y-2">
              {productos.map(prod => (
                <div
                  key={prod.productoId}
                  className={`border rounded-lg p-3 ${
                    prod.reservadas > 0 ? 'border-amber-300 bg-amber-50/20' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{prod.nombre}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-gray-500">
                          {prod.sku} · Disponible: {prod.disponible} uds
                        </p>
                        {prod.reservadas > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            {prod.reservadas} de {prod.disponible} reservadas
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(prod.productoId, prod.cantidad - 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <div className="text-center min-w-[3rem]">
                        <span className="text-sm font-bold tabular-nums text-gray-900">
                          {prod.cantidad}
                        </span>
                        <span className="text-xs text-gray-400">/{prod.disponible}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(prod.productoId, prod.cantidad + 1)}
                        disabled={prod.cantidad >= prod.disponible}
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-30"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(prod.productoId)}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 ml-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* usa_peru fields + Notes + action */}
      {productos.length > 0 && (
        <>
          {/* Viajero/tracking fields for USA → Peru */}
          {tipoTransferencia && esTipoTransferenciaInternacional(tipoTransferencia) && (
            <div className="bg-white border border-purple-200 rounded-xl p-3 sm:p-4">
              <button
                type="button"
                onClick={() => setShowEnvioFields(!showEnvioFields)}
                className="flex items-center justify-between w-full text-sm font-medium text-purple-700"
              >
                <span>Datos de envio internacional (opcional)</span>
                {showEnvioFields ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showEnvioFields && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Viajero / Transportista</label>
                    <select
                      value={viajeroId}
                      onChange={(e) => setViajeroId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="">Seleccionar viajero...</option>
                      {viajeros.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.nombre} ({v.codigo})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Numero de tracking</label>
                    <input
                      type="text"
                      value={numeroTracking}
                      onChange={(e) => setNumeroTracking(e.target.value)}
                      placeholder="Tracking number..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <p className="text-xs text-gray-400">Estos datos se pueden completar despues desde el modulo de Transferencias</p>
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Notas (opcional)</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Notas sobre la transferencia..."
            />
          </div>

          <div className="sticky bottom-0 bg-gray-50/95 backdrop-blur-sm border-t border-gray-200 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 py-3">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-gray-600">
                {origenNombre} → {destinoNombre}
              </span>
              <span className="font-semibold text-gray-900">{totalUnidades} unidades</span>
            </div>
            <button
              type="button"
              onClick={handleCrearTransferencia}
              disabled={isSubmitting || totalUnidades === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              <ArrowRightLeft className="h-4 w-4" />
              {isSubmitting ? 'Creando transferencia...' : `Crear Transferencia (${totalUnidades} uds)`}
            </button>
          </div>
        </>
      )}
      <VincularUPCModal
        isOpen={showVincularModal}
        onClose={() => setShowVincularModal(false)}
        barcode={notFoundBarcode}
        onLinked={(producto) => {
          setShowVincularModal(false);
          toast.success(`${producto.nombreComercial} vinculado al codigo ${notFoundBarcode}`);
        }}
      />
    </div>
  );
});

ModoTransferencia.displayName = 'ModoTransferencia';
