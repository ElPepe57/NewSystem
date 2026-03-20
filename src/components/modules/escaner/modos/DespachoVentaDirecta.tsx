import React, { useState, useCallback, useImperativeHandle, forwardRef, useRef } from 'react';
import { ShoppingCart, Search, User, CheckCircle2, Trash2, Minus, Plus } from 'lucide-react';
import { useScanAccumulator } from '../../../../hooks/useScanAccumulator';
import { ScanAccumulatorList } from '../ScanAccumulatorList';
import { VentaService } from '../../../../services/venta.service';
import { clienteService } from '../../../../services/cliente.service';
import { useToastStore } from '../../../../store/toastStore';
import { useAuthStore } from '../../../../store/authStore';
import type { Producto } from '../../../../types/producto.types';
import type { VentaDirectaItem } from '../../../../types/escanerModos.types';
import type { Cliente } from '../../../../types/entidadesMaestras.types';

export interface DespachoVentaDirectaHandle {
  handleScan: (barcode: string, format?: string) => void;
}

export const DespachoVentaDirecta = forwardRef<DespachoVentaDirectaHandle>((_props, ref) => {
  const toast = useToastStore();
  const { user } = useAuthStore();

  // Client search
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteResults, setClienteResults] = useState<Cliente[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [nombreManual, setNombreManual] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const accumulator = useScanAccumulator<VentaDirectaItem>({
    buildModeData: (producto: Producto) => ({
      precioUnitario: 0,
      subtotal: 0,
    }),
  });

  // Expose scan handler
  useImperativeHandle(ref, () => ({
    handleScan: (barcode: string) => {
      accumulator.handleScan(barcode);
    },
  }), [accumulator]);

  // Client search with debounce
  const handleClienteSearch = useCallback((termino: string) => {
    setClienteSearch(termino);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (termino.length < 2) {
      setClienteResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await clienteService.buscar(termino, 5);
        setClienteResults(results);
      } catch {
        // silent
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleSelectCliente = useCallback((cliente: Cliente) => {
    setSelectedCliente(cliente);
    setClienteSearch('');
    setClienteResults([]);
    setNombreManual('');
  }, []);

  const handlePriceChange = useCallback((productoId: string, precio: number) => {
    const item = accumulator.items.get(productoId);
    if (item) {
      accumulator.updateModeData(productoId, {
        precioUnitario: precio,
        subtotal: precio * item.cantidad,
      });
    }
  }, [accumulator]);

  // Recalculate subtotals when quantity changes
  const handleUpdateQuantity = useCallback((productoId: string, cantidad: number) => {
    const item = accumulator.items.get(productoId);
    if (item) {
      accumulator.updateQuantity(productoId, cantidad);
      // Update subtotal after quantity change
      setTimeout(() => {
        accumulator.updateModeData(productoId, {
          subtotal: item.modeData.precioUnitario * cantidad,
        });
      }, 0);
    }
  }, [accumulator]);

  const total = accumulator.itemsArray.reduce((s, item) =>
    s + (item.modeData.precioUnitario * item.cantidad), 0
  );

  const handleCrearVenta = useCallback(async () => {
    if (!user?.uid) return;
    const nombre = selectedCliente?.nombre || nombreManual.trim();
    if (!nombre) {
      toast.warning('Ingresa el nombre del cliente');
      return;
    }
    if (accumulator.itemsArray.length === 0) {
      toast.warning('Escanea al menos un producto');
      return;
    }

    // Validate prices > 0
    const productosSinPrecio = accumulator.itemsArray.filter(item => !item.modeData.precioUnitario || item.modeData.precioUnitario <= 0);
    if (productosSinPrecio.length > 0) {
      const nombres = productosSinPrecio.map(p => p.producto.sku).join(', ');
      toast.warning(`Precio invalido en: ${nombres}. Todos los productos deben tener precio mayor a 0.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const venta = await VentaService.create({
        clienteId: selectedCliente?.id,
        nombreCliente: nombre,
        telefonoCliente: selectedCliente?.telefono,
        emailCliente: selectedCliente?.email,
        direccionEntrega: selectedCliente?.direccionPrincipal,
        canal: 'directo',
        canalNombre: 'Venta Directa (Escaner)',
        incluyeEnvio: false,
        productos: accumulator.itemsArray.map(item => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioUnitario: item.modeData.precioUnitario,
        })),
      }, user.uid, true);

      // Assign inventory to the newly created venta
      try {
        await VentaService.asignarInventario(venta.id, user.uid);
        toast.success(`Venta ${venta.numeroVenta} creada con inventario asignado`);
      } catch (asignError: any) {
        console.error('Error asignando inventario:', asignError);
        toast.warning(
          `Venta ${venta.numeroVenta} creada, pero la asignacion de inventario fallo. Asigne manualmente desde el modulo de Ventas.`
        );
      }

      accumulator.clear();
      setSelectedCliente(null);
      setNombreManual('');
    } catch (error: any) {
      toast.error(error?.message || 'Error al crear venta');
    } finally {
      setIsSubmitting(false);
    }
  }, [user, selectedCliente, nombreManual, accumulator, toast]);

  return (
    <div className="space-y-4">
      {/* Client section */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <User className="h-4 w-4 text-gray-500" />
          Cliente
        </label>

        {selectedCliente ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-2.5">
            <div>
              <p className="text-sm font-medium text-gray-900">{selectedCliente.nombre}</p>
              <p className="text-xs text-gray-500">
                {selectedCliente.telefono || selectedCliente.email || selectedCliente.dniRuc || ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCliente(null)}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Search existing */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={clienteSearch}
                onChange={(e) => handleClienteSearch(e.target.value)}
                placeholder="Buscar cliente existente..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* Search results */}
            {clienteResults.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {clienteResults.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCliente(c)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <p className="text-sm font-medium text-gray-900">{c.nombre}</p>
                    <p className="text-xs text-gray-500">{c.telefono || c.email || ''}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Manual name */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">o</span>
              <input
                type="text"
                value={nombreManual}
                onChange={(e) => setNombreManual(e.target.value)}
                placeholder="Nombre del cliente nuevo"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <ShoppingCart className="h-4 w-4 text-gray-500" />
            Carrito ({accumulator.totalItems} productos)
          </label>
          {accumulator.totalItems > 0 && (
            <button
              type="button"
              onClick={accumulator.clear}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              Vaciar
            </button>
          )}
        </div>

        {accumulator.itemsArray.length === 0 ? (
          <div className="text-center py-6">
            <ShoppingCart className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Escanea productos para agregarlos al carrito</p>
          </div>
        ) : (
          <div className="space-y-2">
            {accumulator.itemsArray.map(item => {
              const p = item.producto;
              return (
                <div
                  key={item.productoId}
                  className={`border rounded-lg p-3 transition-all ${
                    item.productoId === accumulator.lastScannedId
                      ? 'border-primary-400 ring-1 ring-primary-200 bg-primary-50/30'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {p.marca} {p.nombreComercial}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {p.sku} · {p.presentacion}
                      </p>
                      {/* Price input */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-xs text-gray-500">S/</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.modeData.precioUnitario || ''}
                          onChange={(e) => handlePriceChange(item.productoId, parseFloat(e.target.value) || 0)}
                          className={`w-20 px-2 py-1 border rounded text-xs text-right focus:ring-1 tabular-nums ${
                            !item.modeData.precioUnitario || item.modeData.precioUnitario <= 0
                              ? 'border-red-400 bg-red-50 focus:ring-red-500'
                              : 'border-gray-200 focus:ring-primary-500'
                          }`}
                        />
                        <span className="text-xs text-gray-400">× {item.cantidad} = S/ {(item.modeData.precioUnitario * item.cantidad).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.productoId, item.cantidad - 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold text-gray-900 tabular-nums">
                        {item.cantidad}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.productoId, item.cantidad + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => accumulator.removeItem(item.productoId)}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 ml-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Total + action */}
      {accumulator.totalItems > 0 && (
        <div className="sticky bottom-0 bg-gray-50/95 backdrop-blur-sm border-t border-gray-200 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Total</span>
            <span className="text-lg font-bold text-gray-900 tabular-nums">S/ {total.toFixed(2)}</span>
          </div>
          <button
            type="button"
            onClick={handleCrearVenta}
            disabled={isSubmitting || (!selectedCliente && !nombreManual.trim())}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isSubmitting ? 'Creando venta...' : 'Crear Venta Directa'}
          </button>
        </div>
      )}
    </div>
  );
});

DespachoVentaDirecta.displayName = 'DespachoVentaDirecta';
