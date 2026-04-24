/**
 * BorradorEnvioBanner — Banner de borrador dentro del Wizard de Envíos.
 *
 * Paralelo directo de `BorradorOCBanner` pero con `tipo: 'envio'` y 4 pasos.
 * Se renderiza arriba del WizardShell si el usuario tiene un envío sin
 * terminar. Al montar lee localStorage + Firestore.
 *
 * S53.23 — Mismo patrón que S53.21 (wizard de OC). Resuelve el caso de
 * "dejé el wizard a medias y quiero retomar".
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

export const BorradorEnvioBanner: React.FC<Props> = ({
  refreshKey = 0,
  onContinuar,
}) => {
  const [borrador, setBorrador] = useState<BorradorWizard | null>(null);
  const [descartando, setDescartando] = useState(false);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    let local: BorradorWizard | null = null;
    try {
      const lsKey = buildBorradorLocalStorageKey(userId, 'envio');
      const raw = localStorage.getItem(lsKey);
      if (raw) local = JSON.parse(raw) as BorradorWizard;
    } catch {
      /* localStorage deshabilitado o corrupto */
    }

    if (local) setBorrador(local);

    let cancelled = false;
    (async () => {
      try {
        const remote = await borradorWizardService.get(userId, 'envio');
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
      localStorage.removeItem(buildBorradorLocalStorageKey(userId, 'envio'));
    } catch {
      /* silencioso */
    }
    try {
      await borradorWizardService.delete(userId, 'envio');
    } catch {
      /* silencioso */
    }
    setBorrador(null);
    setDescartando(false);
  };

  if (!borrador) return null;

  const totalPasos = 4;
  const pasoActualTexto = `Paso ${(borrador.pasoActual ?? 0) + 1} de ${totalPasos}`;
  const fechaTexto = formatFechaRelativa(borrador.fechaActualizacion);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-center gap-4 shadow-sm">
      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5 text-amber-700" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-amber-900">
          Tienes un envío en borrador
        </div>
        <div className="text-xs text-amber-800 mt-0.5 truncate">
          {borrador.resumen ?? 'Envío sin terminar'}
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
