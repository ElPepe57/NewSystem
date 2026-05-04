/**
 * S3.4 (2026-05-04) · Chip vivo "Duración del envase".
 *
 * Componente reusable que muestra al usuario cuánto le rinde un frasco/envase
 * de suplemento dado su contenido neto + servings/día (+ dosaje cuando la
 * unidad es continua). Aparece en:
 *   - Wizard crear producto (Sec.3 Identificadores)
 *   - Editor de producto V2 (Sec.3 Identificadores)
 *   - Modal detalle producto cara cliente (próximo paso)
 *
 * Tres estados visuales:
 *   - 'ok'         · chip verde con "≈ N días" + razón del cálculo
 *   - 'pendiente'  · chip slate dashed con qué falta + CTA "ir a Sec.X"
 *   - 'no_aplica'  · null (no se renderiza · ej. SKC con unidad ml)
 *
 * Banner amber suave cuando la duración es atípica (<14d o >180d).
 */

import { CalendarClock, Zap, ArrowRight, AlertTriangle } from 'lucide-react';
import {
  calcularDuracionEnvase,
  evaluarDuracionAtipica,
  type CalcularDuracionInput,
} from '../../utils/duracionEnvase';

interface ChipDuracionEnvaseProps extends CalcularDuracionInput {
  /** Si la línea no es SUP, no tiene sentido mostrar el chip */
  esSuplemento: boolean;
  /** CTA opcional para saltar a la sección que contiene el campo faltante */
  onIrASec2?: () => void;
  /** Variante compacta (para usar dentro del campo Servings/día en Sec.2) */
  compact?: boolean;
}

export function ChipDuracionEnvase({
  esSuplemento,
  contenidoNeto,
  servingsPerDay,
  dosaje,
  onIrASec2,
  compact = false,
}: ChipDuracionEnvaseProps) {
  if (!esSuplemento) return null;

  const estado = calcularDuracionEnvase({ contenidoNeto, servingsPerDay, dosaje });

  if (estado.tipo === 'no_aplica') return null;

  // PENDIENTE · falta info
  if (estado.tipo === 'pendiente') {
    if (compact) {
      return (
        <div className="text-[10px] leading-tight">
          <div className="text-emerald-800 font-bold uppercase tracking-wider mb-0.5">Duración auto</div>
          <div className="text-slate-500 italic">Pendiente · falta {labelFaltan(estado.faltan)}</div>
        </div>
      );
    }
    const necesitaSec2 = estado.faltan.includes('servings') || estado.faltan.includes('dosaje');
    return (
      <div className="rounded-lg bg-slate-50 border border-dashed border-slate-300 p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center flex-shrink-0">
          <CalendarClock className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Duración del envase</div>
          <div className="text-xs text-slate-700 mt-0.5">
            Pendiente · falta <strong>{labelFaltan(estado.faltan)}</strong>
          </div>
        </div>
        {necesitaSec2 && onIrASec2 && (
          <button
            type="button"
            onClick={onIrASec2}
            className="text-[10px] px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 hover:bg-indigo-100 flex items-center gap-1"
          >
            Ir a Sec.2 <ArrowRight className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    );
  }

  // OK · cálculo exitoso
  const validacion = evaluarDuracionAtipica(estado.dias);

  if (compact) {
    return (
      <div className="text-[10px] leading-tight">
        <div className="text-emerald-800 font-bold uppercase tracking-wider mb-0.5">Duración auto</div>
        <div className="text-emerald-900 leading-tight">
          <span className="text-base font-bold tabular-nums">≈ {estado.dias} días</span>
        </div>
        <div className="text-[9px] text-emerald-700 truncate">{estado.razonCalculo}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-emerald-50 border border-emerald-300 p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
          <CalendarClock className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-emerald-800 font-bold">Duración del envase</div>
          <div className="text-base font-bold text-emerald-900 tabular-nums">≈ {estado.dias} días</div>
          <div className="text-[9px] text-emerald-700 mt-0.5">{estado.razonCalculo} · ciclo de recompra estimado</div>
        </div>
        <div className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold flex items-center gap-1">
          <Zap className="w-2.5 h-2.5" />auto
        </div>
      </div>
      {validacion.atipica && (
        <div className="rounded-lg bg-amber-50 border border-amber-300 p-2.5 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-[10px] text-amber-900 leading-relaxed">
            {validacion.mensaje}
          </div>
        </div>
      )}
    </div>
  );
}

function labelFaltan(faltan: Array<'servings' | 'contenido' | 'dosaje'>): string {
  const map: Record<typeof faltan[number], string> = {
    servings: 'Servings/día',
    contenido: 'Contenido neto',
    dosaje: 'Dosaje (g/ml por servida)',
  };
  return faltan.map(f => map[f]).join(' · ');
}
