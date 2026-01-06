import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';

export interface VirtualListProps<T> {
  /** Array de items a renderizar */
  items: T[];
  /** Altura de cada item en px */
  itemHeight: number;
  /** Altura del contenedor en px (o 'auto' para usar viewport) */
  height: number | 'auto';
  /** Cantidad de items extra a renderizar arriba/abajo del viewport */
  overscan?: number;
  /** Función para renderizar cada item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Key extractor para cada item */
  getKey?: (item: T, index: number) => string | number;
  /** Clases CSS adicionales para el contenedor */
  className?: string;
  /** Mostrar mensaje cuando no hay items */
  emptyMessage?: string;
  /** Callback cuando se hace scroll */
  onScroll?: (scrollTop: number) => void;
  /** Callback cuando se llega al final (infinite scroll) */
  onEndReached?: () => void;
  /** Distancia desde el final para triggear onEndReached */
  endReachedThreshold?: number;
}

/**
 * Componente de lista virtualizada para renderizar eficientemente listas grandes.
 * Solo renderiza los items visibles + overscan, mejorando significativamente el rendimiento.
 *
 * @example
 * <VirtualList
 *   items={productos}
 *   itemHeight={60}
 *   height={400}
 *   renderItem={(producto, index) => (
 *     <ProductoRow key={producto.id} producto={producto} />
 *   )}
 * />
 */
export function VirtualList<T>({
  items,
  itemHeight,
  height,
  overscan = 3,
  renderItem,
  getKey,
  className = '',
  emptyMessage = 'No hay elementos',
  onScroll,
  onEndReached,
  endReachedThreshold = 100
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Calcular altura del contenedor
  useEffect(() => {
    if (height === 'auto') {
      const updateHeight = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          setContainerHeight(viewportHeight - rect.top - 20);
        }
      };
      updateHeight();
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    } else {
      setContainerHeight(height);
    }
  }, [height]);

  // Calcular items visibles
  const { startIndex, visibleItems, offsetY } = useMemo(() => {
    const actualHeight = containerHeight || 400;

    // Calcular rango visible
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(actualHeight / itemHeight);
    const end = Math.min(items.length, start + visibleCount + overscan * 2);

    return {
      startIndex: start,
      visibleItems: items.slice(start, end),
      offsetY: start * itemHeight
    };
  }, [items, itemHeight, scrollTop, containerHeight, overscan]);

  // Manejar scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const newScrollTop = target.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);

    // Detectar si llegamos al final
    if (onEndReached) {
      const scrollHeight = target.scrollHeight;
      const clientHeight = target.clientHeight;
      if (scrollHeight - newScrollTop - clientHeight < endReachedThreshold) {
        onEndReached();
      }
    }
  }, [onScroll, onEndReached, endReachedThreshold]);

  const totalHeight = items.length * itemHeight;

  if (items.length === 0) {
    return (
      <div className={`flex items-center justify-center py-8 text-gray-500 ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: height === 'auto' ? containerHeight : height }}
      onScroll={handleScroll}
    >
      {/* Contenedor con altura total para scroll correcto */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Items visibles posicionados absolutamente */}
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, idx) => {
            const actualIndex = startIndex + idx;
            const key = getKey ? getKey(item, actualIndex) : actualIndex;
            return (
              <div key={key} style={{ height: itemHeight }}>
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook para virtualizar una tabla
 */
export interface UseVirtualTableOptions {
  totalItems: number;
  rowHeight: number;
  containerHeight: number;
  overscan?: number;
}

export interface UseVirtualTableResult {
  startIndex: number;
  endIndex: number;
  offsetY: number;
  totalHeight: number;
  onScroll: (e: React.UIEvent<HTMLElement>) => void;
}

export function useVirtualTable({
  totalItems,
  rowHeight,
  containerHeight,
  overscan = 5
}: UseVirtualTableOptions): UseVirtualTableResult {
  const [scrollTop, setScrollTop] = useState(0);

  const result = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / rowHeight);
    const end = Math.min(totalItems, start + visibleCount + overscan * 2);

    return {
      startIndex: start,
      endIndex: end,
      offsetY: start * rowHeight,
      totalHeight: totalItems * rowHeight
    };
  }, [scrollTop, rowHeight, containerHeight, totalItems, overscan]);

  const onScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    setScrollTop(target.scrollTop);
  }, []);

  return { ...result, onScroll };
}

export default VirtualList;
