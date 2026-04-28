/**
 * useDraft — S58 Fase 4 · Auto-save de borradores en localStorage
 *
 * Patrón Linear/Notion/Stripe Atlas para no perder trabajo del usuario:
 *
 *   1. Cada cambio del form se guarda automáticamente (debounced 600ms)
 *      en localStorage bajo una key estable.
 *   2. Al desmontarse / cerrar el modal sin submit, el borrador SE QUEDA.
 *   3. Al volver a abrir el modal, el hook detecta el borrador y expone
 *      `hasDraft = true` + `draftSavedAt`. El componente decide UI.
 *   4. Tras submit exitoso, llamar `clearDraft()` para vaciar el storage.
 *   5. TTL configurable (default 24h) para evitar que borradores antiguos
 *      contaminen sesiones futuras.
 *
 * Maneja Date objects con serialización custom (JSON pierde Dates por defecto).
 *
 * Uso típico:
 *
 *   const draft = useDraft<MovimientoFormData>('movimiento', formData, {
 *     enabled: isOpen && !editingExistingDoc,
 *     onRestore: (data) => setFormData(data),
 *   });
 *
 *   {draft.hasDraft && !draft.restored && (
 *     <Banner>
 *       Tienes un borrador del {draft.savedAt.toLocaleString()}
 *       <button onClick={draft.restore}>Continuar</button>
 *       <button onClick={draft.discard}>Descartar</button>
 *     </Banner>
 *   )}
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Tipos ─────────────────────────────────────────────────────────────

export interface UseDraftOptions<T> {
  /**
   * Si false, el hook no salva ni detecta. Útil para modo edit del mismo
   * formulario (donde el doc original es la fuente de verdad).
   * Default: true.
   */
  enabled?: boolean;

  /**
   * Callback al restaurar un borrador. Recibe los datos deserializados.
   * El componente debe usar esto para llenar su state del form.
   */
  onRestore?: (data: T) => void;

  /**
   * Tiempo de vida del borrador en milisegundos. Borradores más viejos
   * se ignoran. Default: 24 horas.
   */
  ttlMs?: number;

  /**
   * Debounce de escritura en ms. Default: 600ms.
   */
  debounceMs?: number;

  /**
   * Si true, no detecta borradores existentes al montar (útil cuando
   * sabes que estás en modo edit y NO quieres ofrecer restaurar).
   * Default: false.
   */
  skipDetectOnMount?: boolean;
}

export interface UseDraftReturn {
  /** True si hay un borrador válido (no expirado) en storage al montar. */
  hasDraft: boolean;
  /** Fecha en que se guardó el borrador detectado. null si no hay. */
  savedAt: Date | null;
  /** True después de que el usuario llamó `restore()`. */
  restored: boolean;
  /** Restaura el borrador llamando a onRestore con los datos. */
  restore: () => void;
  /** Descarta el borrador detectado · limpia storage. */
  discard: () => void;
  /** Limpia storage explícitamente · usar tras submit exitoso. */
  clearDraft: () => void;
  /** Estado del último save · útil para indicador en UI. */
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  /** Texto humano del último save (ej: "hace 3 segundos"). */
  savedAgo: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'draft:';

interface DraftEnvelope<T> {
  data: T;
  savedAt: number; // ms epoch
  ttl: number;
}

/** Serializa preservando Date como objetos {__date: ISO}. */
function serialize<T>(value: T): string {
  return JSON.stringify(value, (_, v) => {
    if (v instanceof Date) {
      return { __date: v.toISOString() };
    }
    return v;
  });
}

/** Deserializa restaurando Date desde {__date: ISO}. */
function deserialize<T>(raw: string): T {
  return JSON.parse(raw, (_, v) => {
    if (v && typeof v === 'object' && '__date' in v && typeof v.__date === 'string') {
      return new Date(v.__date);
    }
    return v;
  });
}

/** "hace X segundos/minutos/horas" en español. */
function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 30) return 'hace unos segundos';
  if (seconds < 60) return `hace ${seconds} segundos`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} minuto${minutes !== 1 ? 's' : ''}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} hora${hours !== 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days !== 1 ? 's' : ''}`;
}

// ─── Hook ──────────────────────────────────────────────────────────────

export function useDraft<T>(
  /** Key única del borrador (ej: "movimiento-tesoreria"). */
  key: string,
  /** Estado actual del form. Cada cambio dispara save (debounced). */
  currentValue: T | null | undefined,
  options: UseDraftOptions<T> = {},
): UseDraftReturn {
  const {
    enabled = true,
    onRestore,
    ttlMs = 24 * 60 * 60 * 1000, // 24h
    debounceMs = 600,
    skipDetectOnMount = false,
  } = options;

  const storageKey = `${STORAGE_PREFIX}${key}`;
  const [hasDraft, setHasDraft] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [restored, setRestored] = useState(false);
  const [saveStatus, setSaveStatus] = useState<UseDraftReturn['saveStatus']>('idle');
  const [savedAgo, setSavedAgo] = useState<string | null>(null);

  const debounceRef = useRef<number | null>(null);
  const isFirstRun = useRef(true);

  // ── Detectar borrador al montar ──
  useEffect(() => {
    if (!enabled || skipDetectOnMount) {
      setHasDraft(false);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setHasDraft(false);
        return;
      }
      const envelope = deserialize<DraftEnvelope<T>>(raw);
      const ageMs = Date.now() - envelope.savedAt;
      if (ageMs > envelope.ttl) {
        // Expirado: limpiar y no ofrecer
        localStorage.removeItem(storageKey);
        setHasDraft(false);
        return;
      }
      setHasDraft(true);
      setSavedAt(new Date(envelope.savedAt));
    } catch {
      // JSON corrupto: limpiar
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      setHasDraft(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, enabled, skipDetectOnMount]);

  // ── Auto-save debounced cuando cambia currentValue ──
  useEffect(() => {
    if (!enabled) return;
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (currentValue === null || currentValue === undefined) return;

    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }

    setSaveStatus('saving');
    debounceRef.current = window.setTimeout(() => {
      try {
        const envelope: DraftEnvelope<T> = {
          data: currentValue,
          savedAt: Date.now(),
          ttl: ttlMs,
        };
        localStorage.setItem(storageKey, serialize(envelope));
        setSaveStatus('saved');
        setSavedAgo(timeAgo(new Date(envelope.savedAt)));
      } catch (err) {
        // QuotaExceeded u otros: no es crítico
        console.warn(`[useDraft] Could not save draft "${key}":`, err);
        setSaveStatus('error');
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [currentValue, enabled, storageKey, ttlMs, debounceMs, key]);

  // ── Tick para refrescar "hace X segundos" cada 15s ──
  useEffect(() => {
    if (!enabled || saveStatus !== 'saved') return;
    const id = window.setInterval(() => {
      const lastSave = localStorage.getItem(storageKey);
      if (!lastSave) return;
      try {
        const env = deserialize<DraftEnvelope<T>>(lastSave);
        setSavedAgo(timeAgo(new Date(env.savedAt)));
      } catch {
        /* ignore */
      }
    }, 15000);
    return () => window.clearInterval(id);
  }, [enabled, storageKey, saveStatus]);

  // ── API ──
  const restore = useCallback(() => {
    if (!enabled) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const envelope = deserialize<DraftEnvelope<T>>(raw);
      onRestore?.(envelope.data);
      setRestored(true);
    } catch (err) {
      console.warn(`[useDraft] Could not restore draft "${key}":`, err);
    }
  }, [enabled, storageKey, onRestore, key]);

  const discard = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setHasDraft(false);
    setSavedAt(null);
    setRestored(false);
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setHasDraft(false);
    setSavedAt(null);
    setRestored(false);
    setSaveStatus('idle');
    setSavedAgo(null);
  }, [storageKey]);

  return {
    hasDraft,
    savedAt,
    restored,
    restore,
    discard,
    clearDraft,
    saveStatus,
    savedAgo,
  };
}
