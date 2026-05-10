import { useEffect, useRef, useState, useCallback } from 'react';
import { borradorWizardService } from '../services/borradorWizard.service';
import type { BorradorWizard, TipoBorradorWizard } from '../types/borradorWizard.types';
import { buildBorradorLocalStorageKey } from '../types/borradorWizard.types';
import { auth } from '../lib/firebase';
import { toMillisSafe } from '../utils/dateFormatters';

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
  /** Forzar un save inmediato a Firestore (p.ej. al cerrar con "Guardar borrador") */
  forceSave: () => Promise<void>;
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

  // ─── Lectura del borrador cada vez que el wizard se abre ────────────────
  // S53.18 FIX — En wizards tipo modal (OCWizardV3) el componente NO se
  // desmonta al cerrar: solo hace `if (!isOpen) return null`. Por eso los
  // refs y el estado interno del hook persisten entre aperturas.
  //
  // Estrategia: cada vez que `enabled` pasa a true (wizard se abre), RE-LEER
  // el borrador desde localStorage + Firestore, sin importar si ya se leyó
  // antes. Al cerrar (enabled=false) hacemos early return y dejamos el flag
  // en `false` para que la siguiente apertura garantice un nuevo load.
  //
  // Ventaja: no depende del orden de ejecución de efectos ni de batching;
  // cada apertura del modal siempre hace un load fresh del borrador.
  useEffect(() => {
    if (!enabled || !userId) {
      // Wizard cerrado — marcamos que la próxima apertura debe releer
      initialLoadDoneRef.current = false;
      return;
    }

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
          estado: state as Record<string, unknown>,
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

  // S53.19 — Force save inmediato a Firestore (sin esperar el intervalo de Capa 2).
  // Útil cuando el usuario confirma "Guardar borrador" al cerrar el wizard y
  // queremos asegurar persistencia cross-device antes de cerrar.
  const forceSave = useCallback(async () => {
    if (!userId) return;
    try {
      // Asegurar snapshot en localStorage también (por si aún no se había guardado)
      const payload = {
        id: `${userId}_${tipo}`,
        tipo,
        userId,
        pasoActual,
        estado: state,
        fechaActualizacion: new Date().toISOString(),
      };
      localStorage.setItem(lsKey, JSON.stringify(payload));
    } catch {
      /* silencioso */
    }
    try {
      await borradorWizardService.save({
        tipo,
        userId,
        pasoActual,
        estado: state as Record<string, unknown>,
        resumen: buildResumen?.(state),
        montoEstimado: buildMonto?.(state),
      });
      lastFirestoreSaveRef.current = Date.now();
      setLastSavedAt(new Date());
      setIsDirty(false);
    } catch {
      /* silencioso — al menos localStorage quedó guardado */
    }
  }, [userId, tipo, pasoActual, state, lsKey, buildResumen, buildMonto]);

  return {
    borradorExistente,
    loadingBorrador,
    continuarBorrador,
    descartarBorrador,
    clearDraft,
    forceSave,
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

  const localTs = toMillisSafe(local.fechaActualizacion);
  const remoteTs = toMillisSafe(remote.fechaActualizacion);

  return localTs > remoteTs ? local : remote;
}
