/**
 * HistorialSalarialTimeline.tsx
 *
 * chk5.PERSONAS-v5.4 · F10.B · 2026-05-26 (refactor canon pixel-perfect ACTO 6)
 *
 * Timeline cronológico de variaciones salariales del empleado.
 * Pixel-perfect mockup planilla-v5.4-completo.html ACTO 6 (líneas 490-548).
 *
 * Visual canon:
 *  - Header descriptivo (N cambios · sueldo actual · variación total desde alta)
 *  - Dots: emerald (vigente · más reciente) · sky (variaciones intermedias) ·
 *    slate (salario inicial · "SALARIO ALTA")
 *  - Por cada item: monto + chip VIGENTE/razón + delta % + motivo + notas
 *  - Footer 3 KPI cards: SUELDO ACTUAL · VARIACIÓN TOTAL · AÑOS EN EMPRESA
 *
 * Usado en /usuarios Ficha 360 → tab Sub-perfiles → bloque Datos Laborales.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
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
  /** Max items a mostrar · default 10 (mostramos histórico completo en ficha) */
  maxItems?: number;
  /** Mostrar footer con 3 KPIs (default true · canon ACTO 6) */
  mostrarFooterKPIs?: boolean;
}

/** Razones excepcionales · dot amber */
const RAZONES_EXCEPCIONALES: RazonVariacionSalarial[] = ['correccion', 'otro'];

function formatFechaCorta(d: Date): string {
  return d.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' });
}

function formatFechaLarga(d: Date): string {
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Calcula años entre dos fechas · 1 decimal */
function aniosDesde(fecha: Date): number {
  const diffMs = Date.now() - fecha.getTime();
  const diffYears = diffMs / (365.25 * 24 * 60 * 60 * 1000);
  return Math.round(diffYears * 10) / 10;
}

export const HistorialSalarialTimeline: React.FC<Props> = ({
  userId,
  compact = false,
  maxItems = 10,
  mostrarFooterKPIs = true,
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

  // Stats derivadas
  const stats = useMemo(() => {
    if (historial.length === 0) {
      return { sueldoActual: 0, variacionTotalPct: 0, aniosEmpresa: 0, salarioInicial: 0 };
    }
    // historial viene ordenado DESC por efectivoDesde
    const ultimo = historial[0];
    const primero = historial[historial.length - 1];
    const salarioInicial = primero.salarioAnterior > 0 ? primero.salarioAnterior : primero.salarioNuevo;
    const variacionPct =
      salarioInicial > 0 ? ((ultimo.salarioNuevo - salarioInicial) / salarioInicial) * 100 : 0;
    const fechaIngreso = primero.efectivoDesde.toDate();
    return {
      sueldoActual: ultimo.salarioNuevo,
      variacionTotalPct: variacionPct,
      aniosEmpresa: aniosDesde(fechaIngreso),
      salarioInicial,
    };
  }, [historial]);

  if (loading) {
    return <div className="text-[11px] text-slate-500 py-2">Cargando histórico salarial...</div>;
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
    <div>
      {/* §A · Header descriptivo · canon ACTO 6 línea 502 */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <div className="text-[12px] font-bold text-slate-900">
            Historial de salario · {historial.length} cambio{historial.length === 1 ? '' : 's'} registrado{historial.length === 1 ? '' : 's'}
          </div>
          <div className="text-[10px] text-slate-500">
            Sueldo actual {formatCurrencyPEN(stats.sueldoActual)}
            {stats.variacionTotalPct !== 0 && (
              <>
                {' '}
                <span className={stats.variacionTotalPct > 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                  ({stats.variacionTotalPct > 0 ? '+' : ''}
                  {stats.variacionTotalPct.toFixed(1)}% desde alta)
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* §B · Timeline con dots canon · emerald (vigente) · sky (variación) · slate (alta) */}
      <div className="space-y-3">
        {items.map((h, idx) => {
          const esVigente = idx === 0; // primer item · más reciente
          const esSalarioAlta = idx === items.length - 1 && !hayMas && h.salarioAnterior === 0; // último y es el primer registro
          const esExcepcional = RAZONES_EXCEPCIONALES.includes(h.razon);
          const subio = h.delta > 0;
          const fecha = h.efectivoDesde.toDate();

          // Dot color canon
          let dotBg = 'bg-violet-500';
          let dotRing = 'ring-violet-100';
          if (esVigente) {
            dotBg = 'bg-emerald-500';
            dotRing = 'ring-emerald-100';
          } else if (esSalarioAlta) {
            dotBg = 'bg-slate-400';
            dotRing = 'ring-slate-100';
          } else if (esExcepcional) {
            dotBg = 'bg-amber-500';
            dotRing = 'ring-amber-100';
          } else if (!subio) {
            dotBg = 'bg-rose-500';
            dotRing = 'ring-rose-100';
          }

          const conectorVisible = idx < items.length - 1;

          return (
            <div key={h.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-3 h-3 rounded-full ring-4 flex-shrink-0 ${dotBg} ${dotRing}`}
                  aria-hidden="true"
                />
                {conectorVisible && <div className="w-0.5 flex-1 bg-slate-200 mt-2" aria-hidden="true" />}
              </div>
              <div className="flex-1 pb-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[13px] font-bold ${esVigente ? 'text-slate-900' : 'text-slate-700'} tabular-nums`}>
                    {formatCurrencyPEN(h.salarioNuevo)}
                  </span>
                  {esVigente && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                      VIGENTE
                    </span>
                  )}
                  {esSalarioAlta && (
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                      SALARIO ALTA
                    </span>
                  )}
                  {!esSalarioAlta && h.salarioAnterior > 0 && (
                    <span
                      className={`text-[10px] inline-flex items-center gap-0.5 font-bold tabular-nums ${
                        subio ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {subio ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {subio ? '+' : ''}
                      {h.porcentajeVariacion.toFixed(1)}% vs anterior
                    </span>
                  )}
                  {esExcepcional && !esVigente && (
                    <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                      {RAZON_VARIACION_LABELS[h.razon]}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-600">
                  Motivo: <strong>{RAZON_VARIACION_LABELS[h.razon].toLowerCase()}</strong> ·
                  efectivo {formatFechaLarga(fecha)}
                </div>

                {!compact && h.notas && (
                  <div className="text-[10px] text-slate-500 mt-1 italic line-clamp-2">
                    Notas: "{h.notas}"
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hayMas && (
        <div className="text-[10px] text-slate-500 mt-2 italic text-center">
          + {historial.length - maxItems} variaciones más en el historial completo
        </div>
      )}

      {/* §C · Footer 3 KPIs · canon ACTO 6 línea 544-547 */}
      {mostrarFooterKPIs && historial.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-200 grid grid-cols-3 gap-3 text-[12px]">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">SUELDO ACTUAL</div>
            <div className="font-bold tabular-nums text-teal-700">
              {formatCurrencyPEN(stats.sueldoActual)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">VARIACIÓN TOTAL</div>
            <div
              className={`font-bold tabular-nums ${
                stats.variacionTotalPct > 0
                  ? 'text-emerald-700'
                  : stats.variacionTotalPct < 0
                    ? 'text-rose-700'
                    : 'text-slate-700'
              }`}
            >
              {stats.variacionTotalPct > 0 ? '+' : ''}
              {stats.variacionTotalPct.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">AÑOS EN EMPRESA</div>
            <div className="font-bold tabular-nums text-slate-700">
              {stats.aniosEmpresa} años
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistorialSalarialTimeline;
