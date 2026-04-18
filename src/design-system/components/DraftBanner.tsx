import React from 'react';
import { FileText, RotateCcw, Trash2 } from 'lucide-react';
import { cn } from '../utils';

interface DraftBannerProps {
  /** Si se muestra el banner */
  show: boolean;
  /** Texto descriptivo del borrador (ej: "OC sin terminar de Amazon · $340") */
  descripcion?: string;
  /** Timestamp legible de última edición (ej: "hace 2 horas") */
  fechaLegible?: string;
  /** Paso actual donde estaba (ej: "Paso 3 de 5") */
  pasoActual?: string;
  /** Callback al aceptar continuar el borrador */
  onContinuar: () => void;
  /** Callback al descartar el borrador */
  onDescartar: () => void;
  /** ClassName adicional */
  className?: string;
}

/**
 * DraftBanner — Banner que aparece arriba de un wizard cuando hay un borrador
 * guardado previo (capa 1 localStorage + capa 2 Firestore).
 *
 * Usuario decide: continuar donde dejó o descartar y empezar de nuevo.
 *
 * Uso típico:
 *   <DraftBanner
 *     show={!!borradorExistente && !aceptado}
 *     descripcion="OC sin terminar — Amazon · $340"
 *     fechaLegible="hace 15 min"
 *     pasoActual="Paso 3 de 5"
 *     onContinuar={() => { aplicarBorrador(continuarBorrador()); setAceptado(true); }}
 *     onDescartar={() => { descartarBorrador(); setAceptado(true); }}
 *   />
 */
export const DraftBanner: React.FC<DraftBannerProps> = ({
  show,
  descripcion,
  fechaLegible,
  pasoActual,
  onContinuar,
  onDescartar,
  className,
}) => {
  if (!show) return null;

  return (
    <div
      className={cn(
        'bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3',
        className
      )}
    >
      <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-amber-900">
          Tienes un borrador sin terminar
        </div>
        <div className="text-xs text-amber-800 mt-0.5">
          {descripcion || 'Se detectó un wizard incompleto de una sesión anterior.'}
          {fechaLegible && <span className="text-amber-700"> · {fechaLegible}</span>}
          {pasoActual && <span className="text-amber-700"> · {pasoActual}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onDescartar}
          className="px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Descartar
        </button>
        <button
          type="button"
          onClick={onContinuar}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Continuar
        </button>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Helper: formatear fecha relativa en español
// ════════════════════════════════════════════════════════════════════════════

export function formatFechaRelativa(fecha: Date | any): string {
  let ts: number;
  if (fecha instanceof Date) ts = fecha.getTime();
  else if (fecha?.toMillis) ts = fecha.toMillis();
  else if (typeof fecha === 'string') ts = new Date(fecha).getTime();
  else return 'fecha desconocida';

  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'hace unos segundos';
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24) return `hace ${hours} h`;
  if (days < 7) return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
  return new Date(ts).toLocaleDateString('es-PE');
}
