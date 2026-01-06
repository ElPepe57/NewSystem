import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook para aplicar debounce a un valor
 *
 * @param value - Valor a debounce
 * @param delay - Tiempo de espera en milisegundos (default: 300ms)
 * @returns Valor debounceado
 *
 * @example
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebounce(search, 500);
 *
 * useEffect(() => {
 *   // Este efecto solo se ejecuta despues de 500ms de inactividad
 *   fetchResults(debouncedSearch);
 * }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook para crear una funcion debounceada
 *
 * @param callback - Funcion a debounce
 * @param delay - Tiempo de espera en milisegundos (default: 300ms)
 * @returns Funcion debounceada
 *
 * @example
 * const debouncedSearch = useDebouncedCallback((term: string) => {
 *   fetchResults(term);
 * }, 500);
 *
 * <input onChange={(e) => debouncedSearch(e.target.value)} />
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Mantener referencia actualizada del callback
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );

  return debouncedFn;
}

/**
 * Hook para busqueda con debounce y estado de loading
 *
 * @param searchFn - Funcion de busqueda asincrona
 * @param delay - Tiempo de espera en milisegundos
 * @returns Objeto con funciones y estado
 *
 * @example
 * const { search, query, setQuery, isSearching, results } = useSearch(async (term) => {
 *   return await api.search(term);
 * }, 500);
 */
export function useSearch<T>(
  searchFn: (query: string) => Promise<T[]>,
  delay: number = 300
) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const debouncedQuery = useDebounce(query, delay);

  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery.trim()) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const searchResults = await searchFn(debouncedQuery);
        setResults(searchResults);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Error en la búsqueda'));
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedQuery, searchFn]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
  }, []);

  return {
    query,
    setQuery,
    debouncedQuery,
    results,
    isSearching,
    error,
    clearSearch
  };
}

/**
 * Hook para filtrar una lista localmente con debounce
 *
 * @param items - Lista de items a filtrar
 * @param filterFn - Funcion de filtro
 * @param delay - Tiempo de espera
 * @returns Objeto con items filtrados y estado
 *
 * @example
 * const { filteredItems, searchTerm, setSearchTerm, isFiltering } = useFilteredList(
 *   productos,
 *   (producto, term) => producto.nombre.toLowerCase().includes(term.toLowerCase()),
 *   300
 * );
 */
export function useFilteredList<T>(
  items: T[],
  filterFn: (item: T, searchTerm: string) => boolean,
  delay: number = 300
) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, delay);
  const [isFiltering, setIsFiltering] = useState(false);

  // Indicar que esta filtrando mientras espera el debounce
  useEffect(() => {
    if (searchTerm !== debouncedSearchTerm) {
      setIsFiltering(true);
    } else {
      setIsFiltering(false);
    }
  }, [searchTerm, debouncedSearchTerm]);

  const filteredItems = debouncedSearchTerm.trim()
    ? items.filter(item => filterFn(item, debouncedSearchTerm))
    : items;

  const clearFilter = useCallback(() => {
    setSearchTerm('');
  }, []);

  return {
    filteredItems,
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    isFiltering,
    clearFilter,
    totalItems: items.length,
    filteredCount: filteredItems.length
  };
}
