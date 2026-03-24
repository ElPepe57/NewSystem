import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * Hook compartido para los 4 selectores de producto.
 * Centraliza: click-outside, posicionamiento, filtrado, teclado, label.
 *
 * DUP-001 fix: reemplaza ~2500 líneas duplicadas.
 */

/**
 * Item agrupado para renderizado en dropdown.
 * type='group' = header no seleccionable, type='item' = producto seleccionable
 */
export interface GroupedDropdownItem<T> {
  type: 'group' | 'item';
  item?: T;
  groupLabel?: string;
  groupId?: string;
  itemIndex: number; // Índice real en filteredItems (-1 para headers)
}

interface UseProductoDropdownConfig<T> {
  /** Array de productos/items a filtrar */
  items: T[];
  /** Función que extrae campos buscables de un item */
  getSearchableText: (item: T) => string;
  /** Función que genera el label del item seleccionado */
  getLabel: (item: T) => string;
  /** Filtro adicional (ej: esPadre) */
  extraFilter?: (item: T) => boolean;
  /** Máximo de resultados */
  maxResults?: number;
  /** Mínimo de caracteres para buscar */
  minChars?: number;
  /** Ancho mínimo del dropdown */
  minDropdownWidth?: number;
  /** Usar posición fixed (para modales) */
  useFixed?: boolean;
  /** Función para obtener el grupoId de un item (para agrupar variantes) */
  getGroupId?: (item: T) => string | undefined;
  /** Función para obtener el label del grupo */
  getGroupLabel?: (item: T) => string;
}

interface UseProductoDropdownReturn<T> {
  // Refs
  containerRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  // Estado
  inputValue: string;
  setInputValue: (v: string) => void;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  filteredItems: T[];
  highlightedIndex: number;
  dropdownPosition: { top: number; left: number; width: number; openUp: boolean };
  /** Items agrupados para renderizado (incluye headers de grupo) */
  groupedItems: GroupedDropdownItem<T>[];
  // Handlers
  handleInputChange: (value: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleSelect: (item: T) => void;
  handleClear: () => void;
  // Callback que el componente debe llamar al seleccionar
  onSelectCallback: React.MutableRefObject<((item: T) => void) | null>;
}

export function useProductoDropdown<T>(
  config: UseProductoDropdownConfig<T>
): UseProductoDropdownReturn<T> {
  const {
    items,
    getSearchableText,
    getLabel: _getLabel,
    extraFilter,
    maxResults = 15,
    minChars = 1,
    minDropdownWidth = 450,
    useFixed = false,
    getGroupId,
    getGroupLabel,
  } = config;

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const onSelectCallback = useRef<((item: T) => void) | null>(null);

  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredItems, setFilteredItems] = useState<T[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, openUp: false });

  // Click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Positioning
  useEffect(() => {
    const updatePosition = () => {
      if (!containerRef.current || !isOpen) return;
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const openUp = spaceBelow < 300 && rect.top > 300;

      setDropdownPosition({
        top: openUp ? rect.top - 4 : rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, minDropdownWidth),
        openUp,
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, minDropdownWidth]);

  // Filter
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    setHighlightedIndex(-1);

    if (value.length >= minChars) {
      const searchLower = value.toLowerCase();
      const filtered = items.filter(item => {
        if (extraFilter && !extraFilter(item)) return false;
        return getSearchableText(item).toLowerCase().includes(searchLower);
      });
      setFilteredItems(filtered.slice(0, maxResults));
      setIsOpen(true);
    } else {
      setFilteredItems([]);
      setIsOpen(false);
    }
  }, [items, getSearchableText, extraFilter, maxResults, minChars]);

  // Keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || filteredItems.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => prev < filteredItems.length - 1 ? prev + 1 : 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : filteredItems.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredItems[highlightedIndex]) {
          handleSelect(filteredItems[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  }, [isOpen, filteredItems, highlightedIndex]);

  // Select
  const handleSelect = useCallback((item: T) => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    setInputValue(_getLabel(item));
    onSelectCallback.current?.(item);
  }, [_getLabel]);

  // Clear
  const handleClear = useCallback(() => {
    setInputValue('');
    setFilteredItems([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  // Agrupar items para renderizado (headers de grupo + items seleccionables)
  const groupedItems = useMemo((): GroupedDropdownItem<T>[] => {
    if (!getGroupId || !getGroupLabel) {
      // Sin agrupación: todos son items normales
      return filteredItems.map((item, i) => ({ type: 'item' as const, item, itemIndex: i }));
    }

    const result: GroupedDropdownItem<T>[] = [];
    const seenGroups = new Set<string>();

    filteredItems.forEach((item, index) => {
      const groupId = getGroupId(item);
      if (groupId && !seenGroups.has(groupId)) {
        // Contar cuántas variantes del mismo grupo hay en los resultados
        const siblingsInResults = filteredItems.filter(fi => getGroupId(fi) === groupId).length;
        if (siblingsInResults > 1) {
          seenGroups.add(groupId);
          result.push({
            type: 'group',
            groupLabel: getGroupLabel(item),
            groupId,
            itemIndex: -1,
          });
        }
      }
      result.push({ type: 'item', item, itemIndex: index });
    });

    return result;
  }, [filteredItems, getGroupId, getGroupLabel]);

  return {
    containerRef,
    inputRef,
    dropdownRef,
    inputValue,
    setInputValue,
    isOpen,
    setIsOpen,
    filteredItems,
    highlightedIndex,
    dropdownPosition,
    groupedItems,
    handleInputChange,
    handleKeyDown,
    handleSelect,
    handleClear,
    onSelectCallback,
  };
}
