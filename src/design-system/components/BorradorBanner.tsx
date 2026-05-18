/**
 * BorradorBanner — Banner canónico de "tenés borrador en wizard sin terminar"
 *
 * Promovido a design-system en S3.6 M1 chk2 (2026-05-07) consolidando los 3
 * banners idénticos previos:
 *   - BorradorOCBanner (compras)
 *   - BorradorEnvioBanner (envíos)
 *   - BorradorProductoBanner (productos)
 *
 * Patrón canónico declarado en CLAUDE.md sección "CANON DE FORMULARIOS ·
 * BORRADOR + DESCARTAR" (2026-05-07).
 *
 * Uso:
 *   <BorradorBanner
 *     tipo="oc"
 *     refreshKey={openCount}
 *     onContinuar={(borrador) => abrirWizardConBorrador(borrador.estado)}
 *   />
 *
 * Comportamiento:
 *   - Lee el borrador desde localStorage (capa 1, instant) + Firestore (capa 2)
 *   - Prioriza el más reciente entre ambas capas
 *   - Click "Continuar" → callback al padre con el snapshot del estado
 *   - Click "Descartar" → borra ambas capas y oculta el banner
 *   - Si no hay borrador, retorna null (no renderiza nada)
 *
 * Para extender a un nuevo tipo de wizard:
 *   1. Sumar el discriminator a TipoBorradorWizard en types/borradorWizard.types.ts
 *   2. Agregar entrada en LABELS abajo con título + fallback + totalPasos
 *   3. El consumidor solo pasa `tipo="X"`; las labels se resuelven automáticamente
 */
import React, { useEffect, useState } from 'react';
import { FileText, Trash2, ArrowRight } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { borradorWizardService } from '../../services/borradorWizard.service';
import {
  buildBorradorLocalStorageKey,
  type BorradorWizard,
  type TipoBorradorWizard,
} from '../../types/borradorWizard.types';
import { formatFechaRelativa } from './DraftBanner';
import { toMillisSafe } from '../../utils/dateFormatters';

/**
 * Configuración por tipo · centraliza labels para que el consumidor solo pase `tipo`.
 * Al agregar un wizard nuevo, sumar entrada acá.
 */
const LABELS: Record<TipoBorradorWizard, {
  titulo: string;
  resumenFallback: string;
  totalPasos: number;
}> = {
  oc: {
    titulo: 'Tienes una Orden de Compra en borrador',
    resumenFallback: 'OC sin terminar',
    totalPasos: 5,
  },
  envio: {
    titulo: 'Tienes un envío en borrador',
    resumenFallback: 'Envío sin terminar',
    totalPasos: 4,
  },
  producto: {
    titulo: 'Tienes un producto en borrador',
    resumenFallback: 'Producto sin terminar',
    totalPasos: 6,
  },
  // chk5.C-FIX · canon F-Borradores extendido a Gastos (form 5 secciones canon)
  gasto: {
    titulo: 'Tienes un gasto en borrador',
    resumenFallback: 'Gasto sin terminar',
    totalPasos: 5,
  },
  // chk5.D-S1f · F5 · canon F-Borradores extendido a LiquidarRecaudadoraWizard
  liquidar_recaudadora: {
    titulo: 'Tienes una liquidación de Caja Recaudadora en borrador',
    resumenFallback: 'Liquidación sin terminar',
    totalPasos: 3,
  },
};

interface BorradorBannerProps {
  /** Tipo de wizard · resuelve labels y key de storage */
  tipo: TipoBorradorWizard;
  /** Versión reactiva — al cambiar, el banner relee el borrador */
  refreshKey?: number;
  /** Callback cuando el usuario hace click en "Continuar" */
  onContinuar: (borrador: BorradorWizard) => void;
  /** Override opcional de totalPasos · default del LABELS */
  totalPasos?: number;
  /** Override opcional del título · default del LABELS */
  titulo?: string;
  /** Override opcional del resumen fallback · default del LABELS */
  resumenFallback?: string;
}

function pickMasReciente(
  local: BorradorWizard | null,
  remote: BorradorWizard | null,
): BorradorWizard | null {
  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;
  const localTs = toMillisSafe(local.fechaActualizacion);
  const remoteTs = toMillisSafe(remote.fechaActualizacion);
  return localTs > remoteTs ? local : remote;
}

export const BorradorBanner: React.FC<BorradorBannerProps> = ({
  tipo,
  refreshKey = 0,
  onContinuar,
  totalPasos: totalPasosOverride,
  titulo: tituloOverride,
  resumenFallback: fallbackOverride,
}) => {
  const cfg = LABELS[tipo];
  const titulo = tituloOverride ?? cfg.titulo;
  const fallback = fallbackOverride ?? cfg.resumenFallback;
  const totalPasos = totalPasosOverride ?? cfg.totalPasos;

  const [borrador, setBorrador] = useState<BorradorWizard | null>(null);
  const [descartando, setDescartando] = useState(false);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    // Capa 1 · localStorage síncrono
    let local: BorradorWizard | null = null;
    try {
      const lsKey = buildBorradorLocalStorageKey(userId, tipo);
      const raw = localStorage.getItem(lsKey);
      if (raw) local = JSON.parse(raw) as BorradorWizard;
    } catch {
      /* localStorage deshabilitado o corrupto */
    }

    if (local) setBorrador(local);

    // Capa 2 · Firestore async (fuente de verdad cross-device)
    let cancelled = false;
    (async () => {
      try {
        const remote = await borradorWizardService.get(userId, tipo);
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
  }, [refreshKey, tipo]);

  const handleDescartar = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || descartando) return;
    setDescartando(true);
    try {
      localStorage.removeItem(buildBorradorLocalStorageKey(userId, tipo));
    } catch {
      /* silencioso */
    }
    try {
      await borradorWizardService.delete(userId, tipo);
    } catch {
      /* silencioso */
    }
    setBorrador(null);
    setDescartando(false);
  };

  if (!borrador) return null;

  const pasoActualTexto = `Paso ${(borrador.pasoActual ?? 0) + 1} de ${totalPasos}`;
  const fechaTexto = formatFechaRelativa(borrador.fechaActualizacion);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-center gap-4 shadow-sm">
      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5 text-amber-700" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-amber-900">{titulo}</div>
        <div className="text-xs text-amber-800 mt-0.5 truncate">
          {borrador.resumen ?? fallback}
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
