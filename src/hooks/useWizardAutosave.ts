import { useEffect, useRef, useState, useCallback } from 'react';
import { borradorWizardService } from '../services/borradorWizard.service';
import type { BorradorWizard, TipoBorradorWizard } from '../types/borradorWizard.types';
import { buildBorradorLocalStorageKey } from '../types/borradorWizard.types';
import { auth } from '../lib/firebase';

interface UseWizardAutosaveOptions<TState> {
  /** Tipo de wizard ('oc' | 'envio'). Determina la clave en localStorage y Firestore */
  tipo: TipoBorradorWizard;
  /** Estado actual del wizard a persistir */
  state: TState;
  /** Paso actual del wizard (0-based) */
  pasoActual: number;
  /** Flag para saber si el wizard está activo (no tiene sentido guardar si se cerró) */
  enabled?: boolean;
  /** Intervalo de auto-save en Firestore en milisegundos (default 30s) */
  firestoreIntervalMs?: number;
  /** Callback opcional para construir el resumen (ej: "Amazon · $340") */
  buildResumen?: (state: TState) => string | undefined;
  /** Callback opcional para extraer el monto estimado (para listado admin) */
  buildMonto?: (state: TState) => number | undefined;
}

interface UseWizardAutosaveResult<TState> {
  /** Borrador existente al abrir el wizard (si hay) */
  borradorExistente: BorradorWizard | null;
  /** Estado de carga de la lectura inicial */
  loadingBorrador: boolean;
  /** Continuar desde el borrador (devuelve el estado parseado) */
  continuarBorrador: () => TState | null;
  /** Descartar el borrador (borra localStorage + Firestore) */
  descartarBorrador: () => Promise<void>;
  /** Guardar inmediatamente (útil al completar el wizard) */
  clearDraft: () => Promise<void>;
  /** Último timestamp de guardado en Firestore */
  lastSavedAt: Date | null;
  /** Si hay cambios pendientes sin guardar en Firestore */
  isDirty: boolean;
}

/**
 * Hook de autoguardado en 2 capas para wizards multi-paso.
 *
 * Capa 1 — localStorage (instant):
 *   Cada cambio en `state` se guarda inmediatamente en localStorage. Permite
 *   recuperar el wizard si el usuario cierra el navegador accidentalmente.
 *
 * Capa 2 — Firestore (cross-device):
 *   Cada `firestoreIntervalMs` (default 30s) si hay cambios, se guarda en
 *   `borradoresWizard/{userId}_{tipo}`. Permite continuar desde otro equipo.
 *
 * Uso:
 *   const { borradorExistente, continuarBorrador, descartarBorrador, clearDraft } =
 *     useWizardAutosave({
 *       tipo: 'oc',
 *       state: wizardState,
 *       pasoActual: currentStep,
 *       enabled: isOpen,
 *     });
 *
 *   // Al abrir, si hay borrador, mostrar banner:
 *   if (borradorExistente) { ... "¿Continuar?" → continuarBorrador() }
 *
 *   // Al confirmar el wizard, limpiar:
 *   await clearDraft();
 */
export function useWizardAutosave<TState>({
  tipo,
  state,
  pasoActual,
  enabled = true,
  firestoreIntervalMs = 30_000,
  buildResumen,
  buildMonto,
}: UseWizardAutosaveOptions<TState>): UseWizardAutosaveResult<TState> {
  const [borradorExistente, setBorradorExistente] = useState<BorradorWizard | null>(null);
  const [loadingBorrador, setLoadingBorrador] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const lastFirestoreSaveRef = useRef<number>(0);
  const initialLoadDoneRef = useRef(false);

  const userId = auth.currentUser?.uid || '';
  const lsKey = userId ? buildBorradorLocalStorageKey(userId, tipo) : '';

  // ─── Reset del estado interno cuando el wizard se cierra ────────────────
  // S53.18 FIX — En wizards tipo modal (como OCWizardV3) el componente NO se
  // desmonta al cerrar: solo hace `if (!isOpen) return null`. Por eso los
  // refs y el estado interno del hook persisten entre aperturas.
  //
  // Sin este reset, `initialLoadDoneRef.current` queda en `true` después del
  // primer load, y al reabrir el wizard el useEffect de lectura inicial
  // hace `if (initialLoadDoneRef.current) return` y nunca relee el borrador
  // → el banner jamás aparece aunque haya un borrador válido guardado.
  //
  // Detectamos la transición enabled: true → false y reseteamos todo para
  // que la próxima apertura re-lea localStorage/Firestore desde cero.
  const wasEnabledRef = useRef(false);
  useEffect(() => {
    if (wasEnabledRef.current && !enabled) {
      initialLoadDoneRef.current = false;
      lastFirestoreSaveRef.current = 0;
      setBorradorExistente(null);
      setLoadingBorrador(true);
      setIsDirty(false);
    }
    wasEnabledRef.current = enabled;
  }, [enabled]);

  // ─── Lectura inicial al abrir el wizard ──────────────────────────────────
  useEffect(() => {
    if (!enabled || !userId || initialLoadDoneRef.current) return;

    let cancelled = false;
    const load = async () => {
      try {
        // 1) Intentar localStorage primero (más rápido)
        const lsData = localStorage.getItem(lsKey);
        let localBorrador: BorradorWizard | null = null;
        if (lsData) {
          try {
            const parsed = JSON.parse(lsData);
            localBorrador = parsed as BorradorWizard;
          } catch {
            /* corrupt — ignorar */
          }
        }

        // 2) Leer Firestore (verdad cross-device)
        const remoteBorrador = await borradorWizardService.get(userId, tipo);

        if (cancelled) return;

        // Priorizar el más reciente
        const pick = pickMasReciente(localBorrador, remoteBorrador);
        setBorradorExistente(pick);
        setLoadingBorrador(false);
        initialLoadDoneRef.current = true;
      } catch {
        if (!cancelled) {
          setLoadingBorrador(false);
          initialLoadDoneRef.current = true;
        }
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [enabled, userId, tipo, lsKey]);

  // ─── Capa 1: localStorage (inmediato en cada cambio) ─────────────────────
  useEffect(() => {
    if (!enabled || !userId || !initialLoadDoneRef.current) return;
    try {
      const payload = {
        id: `${userId}_${tipo}`,
        tipo,
        userId,
        pasoActual,
        estado: state,
        fechaActualizacion: new Date().toISOString(),
      };
      localStorage.setItem(lsKey, JSON.stringify(payload));
      setIsDirty(true);
    } catch {
      /* localStorage lleno o deshabilitado — silencioso */
    }
  }, [state, pasoActual, enabled, userId, lsKey, tipo]);

  // ─── Capa 2: Firestore (cada N segundos si hay cambios) ──────────────────
  useEffect(() => {
    if (!enabled || !userId || !initialLoadDoneRef.current) return;

    const interval = setInterval(async () => {
      if (!isDirty) return;
      const now = Date.now();
      if (now - lastFirestoreSaveRef.current < firestoreIntervalMs - 500) return;

      try {
        await borradorWizardService.save({
          tipo,
          userId,
          pasoActual,
          estado: state as any,
          resumen: buildResumen?.(state),
          montoEstimado: buildMonto?.(state),
        });
        lastFirestoreSaveRef.current = now;
        setLastSavedAt(new Date());
        setIsDirty(false);
      } catch {
        /* silencioso — reintentará en el próximo tick */
      }
    }, firestoreIntervalMs);

    return () => clearInterval(interval);
  }, [enabled, userId, tipo, state, pasoActual, isDirty, firestoreIntervalMs, buildResumen, buildMonto]);

  // ─── API para el caller ──────────────────────────────────────────────────
  const continuarBorrador = useCallback((): TState | null => {
    return (borradorExistente?.estado as TState) ?? null;
  }, [borradorExistente]);

  const descartarBorrador = useCallback(async () => {
    if (!userId) return;
    try {
      localStorage.removeItem(lsKey);
    } catch {
      /* silencioso */
    }
    try {
      await borradorWizardService.delete(userId, tipo);
    } catch {
      /* silencioso */
    }
    setBorradorExistente(null);
    setIsDirty(false);
  }, [userId, lsKey, tipo]);

  const clearDraft = useCallback(async () => {
    if (!userId) return;
    try {
      localStorage.removeItem(lsKey);
    } catch {
      /* silencioso */
    }
    try {
      await borradorWizardService.delete(userId, tipo);
    } catch {
      /* silencioso */
    }
    setBorradorExistente(null);
    setIsDirty(false);
  }, [userId, lsKey, tipo]);

  return {
    borradorExistente,
    loadingBorrador,
    continuarBorrador,
    descartarBorrador,
    clearDraft,
    lastSavedAt,
    isDirty,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════

function pickMasReciente(
  local: BorradorWizard | null,
  remote: BorradorWizard | null
): BorradorWizard | null {
  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;

  const localTs = new Date(local.fechaActualizacion as any).getTime();
  const remoteTs =
    (remote.fechaActualizacion as any)?.toMillis?.() ||
    new Date(remote.fechaActualizacion as any).getTime();

  return localTs > remoteTs ? local : remote;
}
