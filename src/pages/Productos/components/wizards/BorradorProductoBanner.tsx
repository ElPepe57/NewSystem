/**
 * BorradorProductoBanner — Banner del Wizard de Producto cuando hay un
 * borrador sin terminar.
 *
 * Réplica directa del patrón canónico de S53.20-23 (BorradorOCBanner,
 * BorradorEnvioBanner). Lee localStorage + Firestore al montar, prioriza
 * el más reciente y permite Continuar / Descartar.
 *
 * Tipo: 'producto' · 6 pasos (Identidad · Atributos · Identificadores ·
 * Clasificación · Logística · Marketing).
 */
import React, { useEffect, useState } from 'react';
import { FileText, Trash2, ArrowRight } from 'lucide-react';
import { auth } from '../../../../lib/firebase';
import { borradorWizardService } from '../../../../services/borradorWizard.service';
import {
  buildBorradorLocalStorageKey,
  type BorradorWizard,
} from '../../../../types/borradorWizard.types';
import { formatFechaRelativa } from '../../../../design-system';

interface Props {
  /** Versión reactiva — al cambiar, el banner relee el borrador. */
  refreshKey?: number;
  /** Callback cuando el usuario hace click en "Continuar" */
  onContinuar: (borrador: BorradorWizard) => void;
}

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

export const BorradorProductoBanner: React.FC<Props> = ({
  refreshKey = 0,
  onContinuar,
}) => {
  const [borrador, setBorrador] = useState<BorradorWizard | null>(null);
  const [descartando, setDescartando] = useState(false);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    // Lectura síncrona de localStorage para respuesta inmediata
    let local: BorradorWizard | null = null;
    try {
      const lsKey = buildBorradorLocalStorageKey(userId, 'producto');
      const raw = localStorage.getItem(lsKey);
      if (raw) local = JSON.parse(raw) as BorradorWizard;
    } catch {
      /* localStorage deshabilitado o corrupto */
    }

    if (local) setBorrador(local);

    // Lectura async de Firestore — verdad cross-device
    let cancelled = false;
    (async () => {
      try {
        const remote = await borradorWizardService.get(userId, 'producto');
        if (cancelled) return;
        const pick = pickMasReciente(local, remote);
        setBorrador(pick);
      } catch {
        /* si falla Firestore, mantenemos localStorage */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleDescartar = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || descartando) return;
    setDescartando(true);
    try {
      localStorage.removeItem(buildBorradorLocalStorageKey(userId, 'producto'));
    } catch {
      /* silencioso */
    }
    try {
      await borradorWizardService.delete(userId, 'producto');
    } catch {
      /* silencioso */
    }
    setBorrador(null);
    setDescartando(false);
  };

  if (!borrador) return null;

  const totalPasos = 6;
  const pasoActualTexto = `Paso ${(borrador.pasoActual ?? 0) + 1} de ${totalPasos}`;
  const fechaTexto = formatFechaRelativa(borrador.fechaActualizacion);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-center gap-4 shadow-sm">
      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5 text-amber-700" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-amber-900">
          Tienes un producto en borrador
        </div>
        <div className="text-xs text-amber-800 mt-0.5 truncate">
          {borrador.resumen ?? 'Producto sin terminar'}
          <span className="text-amber-600 mx-1.5">·</span>
          <span>{fechaTexto}</span>
          <span className="text-amber-600 mx-1.5">·</span>
          <span>{pasoActualTexto}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={handleDescartar}
          disabled={descartando}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Descartar
        </button>
        <button
          type="button"
          onClick={() => onContinuar(borrador)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-sm"
        >
          Continuar
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
