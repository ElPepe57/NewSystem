import { useEffect, useRef, useCallback, useState } from 'react';

export interface UseAutoSaveOptions<T> {
  /** Datos a guardar */
  data: T;
  /** Key para localStorage */
  storageKey: string;
  /** Delay en ms antes de guardar (debounce) */
  delay?: number;
  /** Si el autoguardado está habilitado */
  enabled?: boolean;
  /** Callback cuando se guarda */
  onSave?: (data: T) => void;
  /** Callback cuando se restaura */
  onRestore?: (data: T) => void;
  /** Función para serializar (default: JSON.stringify) */
  serialize?: (data: T) => string;
  /** Función para deserializar (default: JSON.parse) */
  deserialize?: (str: string) => T;
  /** Tiempo de expiración en ms (default: 24 horas) */
  expirationMs?: number;
}

export interface UseAutoSaveResult<T> {
  /** Si hay datos guardados disponibles */
  hasSavedData: boolean;
  /** Último timestamp de guardado */
  lastSaved: Date | null;
  /** Si está guardando actualmente */
  isSaving: boolean;
  /** Restaurar datos guardados */
  restore: () => T | null;
  /** Limpiar datos guardados */
  clear: () => void;
  /** Guardar manualmente */
  saveNow: () => void;
  /** Datos guardados (sin restaurar) */
  savedData: T | null;
}

interface StoredData<T> {
  data: T;
  timestamp: number;
  version: number;
}

const STORAGE_VERSION = 1;

/**
 * Hook para autoguardado de borradores de formularios
 *
 * @example
 * const { hasSavedData, restore, clear } = useAutoSave({
 *   data: formData,
 *   storageKey: 'producto-form-draft',
 *   delay: 1000,
 *   onSave: () => toast.info('Borrador guardado')
 * });
 *
 * // Mostrar opción de restaurar
 * {hasSavedData && (
 *   <button onClick={() => setFormData(restore())}>
 *     Restaurar borrador
 *   </button>
 * )}
 */
export function useAutoSave<T>({
  data,
  storageKey,
  delay = 2000,
  enabled = true,
  onSave,
  onRestore,
  serialize = JSON.stringify,
  deserialize = JSON.parse,
  expirationMs = 24 * 60 * 60 * 1000 // 24 horas
}: UseAutoSaveOptions<T>): UseAutoSaveResult<T> {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedData, setSavedData] = useState<T | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousDataRef = useRef<string>('');

  // Verificar si hay datos guardados válidos
  const getStoredData = useCallback((): StoredData<T> | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return null;

      const parsed: StoredData<T> = JSON.parse(stored);

      // Verificar versión
      if (parsed.version !== STORAGE_VERSION) {
        localStorage.removeItem(storageKey);
        return null;
      }

      // Verificar expiración
      if (Date.now() - parsed.timestamp > expirationMs) {
        localStorage.removeItem(storageKey);
        return null;
      }

      return parsed;
    } catch {
      localStorage.removeItem(storageKey);
      return null;
    }
  }, [storageKey, expirationMs]);

  // Cargar datos guardados al montar
  useEffect(() => {
    const stored = getStoredData();
    if (stored) {
      try {
        const deserializedData = deserialize(serialize(stored.data));
        setSavedData(deserializedData);
        setLastSaved(new Date(stored.timestamp));
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey, getStoredData, deserialize, serialize]);

  // Guardar datos con debounce
  useEffect(() => {
    if (!enabled) return;

    const serialized = serialize(data);

    // No guardar si los datos no cambiaron
    if (serialized === previousDataRef.current) return;

    // Limpiar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Programar guardado
    timeoutRef.current = setTimeout(() => {
      setIsSaving(true);

      try {
        const storedData: StoredData<T> = {
          data,
          timestamp: Date.now(),
          version: STORAGE_VERSION
        };
        localStorage.setItem(storageKey, JSON.stringify(storedData));
        previousDataRef.current = serialized;
        setLastSaved(new Date());
        setSavedData(data);
        onSave?.(data);
      } catch (error) {
        console.error('Error al guardar borrador:', error);
      } finally {
        setIsSaving(false);
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, storageKey, delay, enabled, serialize, onSave]);

  const restore = useCallback((): T | null => {
    const stored = getStoredData();
    if (stored) {
      try {
        const restoredData = deserialize(serialize(stored.data));
        onRestore?.(restoredData);
        return restoredData;
      } catch {
        return null;
      }
    }
    return null;
  }, [getStoredData, deserialize, serialize, onRestore]);

  const clear = useCallback(() => {
    localStorage.removeItem(storageKey);
    setSavedData(null);
    setLastSaved(null);
    previousDataRef.current = '';
  }, [storageKey]);

  const saveNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsSaving(true);
    try {
      const storedData: StoredData<T> = {
        data,
        timestamp: Date.now(),
        version: STORAGE_VERSION
      };
      localStorage.setItem(storageKey, JSON.stringify(storedData));
      previousDataRef.current = serialize(data);
      setLastSaved(new Date());
      setSavedData(data);
      onSave?.(data);
    } catch (error) {
      console.error('Error al guardar borrador:', error);
    } finally {
      setIsSaving(false);
    }
  }, [data, storageKey, serialize, onSave]);

  const hasSavedData = savedData !== null;

  return {
    hasSavedData,
    lastSaved,
    isSaving,
    restore,
    clear,
    saveNow,
    savedData
  };
}

/**
 * Hook simplificado para detectar cambios sin guardar
 */
export function useUnsavedChanges<T>(
  currentData: T,
  savedData: T,
  compare?: (a: T, b: T) => boolean
): boolean {
  const defaultCompare = useCallback((a: T, b: T) => {
    return JSON.stringify(a) !== JSON.stringify(b);
  }, []);

  const compareFn = compare || defaultCompare;
  return compareFn(currentData, savedData);
}

export default useAutoSave;
