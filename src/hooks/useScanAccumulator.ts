import { useState, useCallback, useRef } from 'react';
import { ProductoService } from '../services/producto.service';
import { useToastStore } from '../store/toastStore';
import type { Producto } from '../types/producto.types';
import type { AccumulatorItem } from '../types/escanerModos.types';

interface UseScanAccumulatorOptions<T> {
  /** Build mode-specific data when a product is first scanned */
  buildModeData: (producto: Producto) => Promise<T> | T;
  /** Optional: custom product resolution (default: ProductoService.getByCodigoUPC) */
  resolveProduct?: (barcode: string) => Promise<Producto | null>;
  /** Optional: called when scan increments an existing item */
  onIncrement?: (productoId: string, newCantidad: number) => void;
  /** Optional: max quantity per product (0 = unlimited) */
  maxQuantity?: number;
}

interface UseScanAccumulatorReturn<T> {
  items: Map<string, AccumulatorItem<T>>;
  itemsArray: AccumulatorItem<T>[];
  handleScan: (barcode: string) => Promise<void>;
  updateQuantity: (productoId: string, cantidad: number) => void;
  updateModeData: (productoId: string, partial: Partial<T>) => void;
  removeItem: (productoId: string) => void;
  clear: () => void;
  totalItems: number;
  totalQuantity: number;
  isProcessing: boolean;
  lastScannedId: string | null;
}

export function useScanAccumulator<T = Record<string, never>>(
  options: UseScanAccumulatorOptions<T>
): UseScanAccumulatorReturn<T> {
  const [items, setItems] = useState<Map<string, AccumulatorItem<T>>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  const toast = useToastStore();
  const processingRef = useRef(false);

  const handleScan = useCallback(async (barcode: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);

    try {
      const resolve = options.resolveProduct || ProductoService.getByCodigoUPC;
      const producto = await resolve(barcode);

      if (!producto) {
        toast.warning(`Codigo ${barcode} no encontrado en el sistema`);
        // Vibrate pattern for not found
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        return;
      }

      setItems(prev => {
        const next = new Map(prev);
        const existing = next.get(producto.id);

        if (existing) {
          const newCantidad = existing.cantidad + 1;
          if (options.maxQuantity && newCantidad > options.maxQuantity) {
            toast.warning(`Cantidad maxima alcanzada para ${producto.marca} ${producto.nombreComercial}`);
            return prev;
          }
          next.set(producto.id, { ...existing, cantidad: newCantidad });
          options.onIncrement?.(producto.id, newCantidad);
        } else {
          const modeData = options.buildModeData(producto);
          // Handle both sync and async buildModeData
          if (modeData instanceof Promise) {
            // For async, we'll set a placeholder and update after
            modeData.then(data => {
              setItems(current => {
                const updated = new Map(current);
                const item = updated.get(producto.id);
                if (item) {
                  updated.set(producto.id, { ...item, modeData: data });
                }
                return updated;
              });
            });
            next.set(producto.id, {
              productoId: producto.id,
              producto,
              cantidad: 1,
              modeData: {} as T,
            });
          } else {
            next.set(producto.id, {
              productoId: producto.id,
              producto,
              cantidad: 1,
              modeData,
            });
          }
        }

        return next;
      });

      setLastScannedId(producto.id);
      // Vibrate for success
      if (navigator.vibrate) navigator.vibrate(100);

    } catch (error) {
      toast.error('Error al procesar escaneo');
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [options, toast]);

  const updateQuantity = useCallback((productoId: string, cantidad: number) => {
    setItems(prev => {
      const next = new Map(prev);
      const item = next.get(productoId);
      if (item && cantidad > 0) {
        next.set(productoId, { ...item, cantidad });
      } else if (item && cantidad <= 0) {
        next.delete(productoId);
      }
      return next;
    });
  }, []);

  const updateModeData = useCallback((productoId: string, partial: Partial<T>) => {
    setItems(prev => {
      const next = new Map(prev);
      const item = next.get(productoId);
      if (item) {
        next.set(productoId, {
          ...item,
          modeData: { ...item.modeData, ...partial },
        });
      }
      return next;
    });
  }, []);

  const removeItem = useCallback((productoId: string) => {
    setItems(prev => {
      const next = new Map(prev);
      next.delete(productoId);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems(new Map());
    setLastScannedId(null);
  }, []);

  const itemsArray = Array.from(items.values());
  const totalItems = items.size;
  const totalQuantity = itemsArray.reduce((sum, item) => sum + item.cantidad, 0);

  return {
    items,
    itemsArray,
    handleScan,
    updateQuantity,
    updateModeData,
    removeItem,
    clear,
    totalItems,
    totalQuantity,
    isProcessing,
    lastScannedId,
  };
}
