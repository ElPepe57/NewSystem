/**
 * HistorialSalarialTimeline.tsx
 *
 * chk5.PERSONAS-v5.4 · F8 · 2026-05-26
 *
 * Timeline cronológico de variaciones salariales del empleado.
 * Diseño canon mockup planilla-v5.4-completo.html ACTO 6.
 *
 * Visual: stack vertical · dots sky (variaciones normales) + amber
 * (excepcionales · corrección/otro). Línea vertical conecta dots.
 *
 * Usado en /usuarios Ficha 360 → tab Sub-perfiles → bloque Datos Laborales.
 */
import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, ArrowRight, Info } from 'lucide-react';
import { historialSalarialService } from '../../../services/historialSalarial.service';
import type {
  HistorialSalarial,
  RazonVariacionSalarial,
} from '../../../types/planilla.types';
import { RAZON_VARIACION_LABELS } from '../../../types/planilla.types';
import { formatCurrencyPEN } from '../../../utils/format';

interface Props {
  userId: string;
  /** Compact ‧ no muestra detalle de notas · solo deltas */
  compact?: boolean;
  /** Max items a mostrar · default 5 */
  maxItems?: number;
}

/** Razones excepcionales · usan dot amber */
const RAZONES_EXCEPCIONALES: RazonVariacionSalarial[] = ['correccion', 'otro'];

function formatFechaCorta(d: Date): string {
  return d.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' });
}

function formatFechaLarga(d: Date): string {
  return d.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export const HistorialSalarialTimeline: React.FC<Props> = ({
  userId,
  compact = false,
  maxItems = 5,
}) => {
  const [historial, setHistorial] = useState<HistorialSalarial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    (async () => {
      try {
        const h = await historialSalarialService.getHistorialUsuario(userId);
        setHistorial(h);
      } catch (err) {
        console.error('[HistorialSalarialTimeline] error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) {
    return (
      <div className="text-[11px] text-slate-500 py-2">Cargando histórico salarial...</div>
    );
  }

  if (historial.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded p-3 text-[11px] text-slate-600 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-500" />
        <div>
          <strong>Sin variaciones registradas.</strong> El sueldo actual es el inicial. Cuando
          ajustes el sueldo · cada cambio queda registrado acá con razón y fecha efectiva.
        </div>
      </div>
    );
  }

  const items = historial.slice(0, maxItems);
  const hayMas = historial.length > maxItems;

  return (
    <div className="space-y-0">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
        HISTORIAL DE VARIACIONES
      </div>

      <div className="relative">
        {/* Línea vertical conectora (solo si hay 2+ items) */}
        {items.length > 1 && (
          <div className="absolute left-[5px] top-3 bottom-3 w-px bg-slate-200" aria-hidden="true" />
        )}

        <ul className="space-y-3">
          {items.map((h) => {
            const esExcepcional = RAZONES_EXCEPCIONALES.includes(h.razon);
            const subio = h.delta > 0;
            const fecha = h.efectivoDesde.toDate();
            return (
              <li key={h.id} className="relative flex items-start gap-3">
                {/* Dot · sky normal · amber excepcional */}
                <div
                  className={`relative z-10 w-3 h-3 mt-1 rounded-full ring-4 flex-shrink-0 ${
                    esExcepcional
                      ? 'bg-amber-500 ring-amber-100'
                      : subio
                        ? 'bg-sky-500 ring-sky-100'
                        : 'bg-rose-500 ring-rose-100'
                  }`}
                  aria-hidden="true"
                />

                <div className="flex-1 min-w-0 pb-1">
                  {/* Fila 1: monto + delta */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-bold text-slate-900 tabular-nums">
                      {formatCurrencyPEN(h.salarioNuevo)}
                    </span>
                    <span
                      className={`text-[10px] inline-flex items-center gap-0.5 font-bold tabular-nums ${
                        subio ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {subio ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {subio ? '+' : ''}
                      {formatCurrencyPEN(h.delta)}
                      <span className="text-slate-500 font-normal">
                        ({h.porcentajeVariacion > 0 ? '+' : ''}
                        {h.porcentajeVariacion.toFixed(1)}%)
                      </span>
                    </span>
                  </div>

                  {/* Fila 2: razón + fecha */}
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                        esExcepcional ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {RAZON_VARIACION_LABELS[h.razon]}
                    </span>
                    <span title={formatFechaLarga(fecha)}>{formatFechaCorta(fecha)}</span>
                  </div>

                  {/* Fila 3: notas (solo si no es compact) */}
                  {!compact && h.notas && (
                    <div className="text-[10px] text-slate-600 mt-1 italic line-clamp-2">
                      {h.notas}
                    </div>
                  )}

                  {/* Fila 4: previous → next visual */}
                  {!compact && h.salarioAnterior > 0 && (
                    <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 tabular-nums">
                      {formatCurrencyPEN(h.salarioAnterior)}
                      <ArrowRight className="w-2.5 h-2.5" />
                      {formatCurrencyPEN(h.salarioNuevo)}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {hayMas && (
        <div className="text-[10px] text-slate-500 mt-2 italic">
          + {historial.length - maxItems} variaciones más en el historial completo
        </div>
      )}
    </div>
  );
};

export default HistorialSalarialTimeline;
