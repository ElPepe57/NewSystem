import React from 'react';
import { Minus, Plus, Trash2, Package } from 'lucide-react';
import type { AccumulatorItem } from '../../../types/escanerModos.types';

interface ScanAccumulatorListProps<T> {
  items: AccumulatorItem<T>[];
  onUpdateQuantity: (productoId: string, cantidad: number) => void;
  onRemove: (productoId: string) => void;
  /** Optional: render additional info per item (badges, progress, etc.) */
  renderExtra?: (item: AccumulatorItem<T>) => React.ReactNode;
  /** Optional: highlight the last scanned item */
  lastScannedId?: string | null;
  emptyMessage?: string;
}

export function ScanAccumulatorList<T>({
  items,
  onUpdateQuantity,
  onRemove,
  renderExtra,
  lastScannedId,
  emptyMessage = 'Escanea productos para agregarlos a la lista',
}: ScanAccumulatorListProps<T>) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 sm:py-12">
        <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <Package className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map(item => {
        const isLastScanned = item.productoId === lastScannedId;
        const p = item.producto;

        return (
          <div
            key={item.productoId}
            className={`bg-white border rounded-lg p-3 transition-all ${
              isLastScanned
                ? 'border-primary-400 ring-1 ring-primary-200 bg-primary-50/30'
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Product info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {p.marca} {p.nombreComercial}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {p.sku} · {p.presentacion} {p.dosaje && `· ${p.dosaje}`} {p.contenido && `· ${p.contenido}`}
                </p>
                {/* Extra content from parent */}
                {renderExtra && (
                  <div className="mt-1.5">
                    {renderExtra(item)}
                  </div>
                )}
              </div>

              {/* Quantity controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.productoId, item.cantidad - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center text-sm font-semibold text-gray-900 tabular-nums">
                  {item.cantidad}
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.productoId, item.cantidad + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(item.productoId)}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors ml-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
