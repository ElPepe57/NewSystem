/**
 * G3BurnRunway — chk5.D-S3.quinto · SF3
 *
 * Burn rate + Runway canon MOCK 4 §4.
 * Pixel-perfect SVG curva descendente con zonas semáforo:
 *   - Zona segura > 6 meses (verde tenue)
 *   - Zona alerta 3-6 meses (amber tenue)
 *   - Zona crítica < 3 meses (rose tenue)
 *
 * Header con Burn rate mensual (izq) + Runway actual (der).
 * Footer con 3 cards de fechas estimadas por zona.
 */

import React, { useMemo } from 'react';
import type { BurnRunway } from './analisisHelpers';
import { fmtMonto } from './analisisHelpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface G3BurnRunwayProps {
  data: BurnRunway;
}

// ═════════════════════════════════════════════════════════════════════════
// CONSTANTES SVG
// ═════════════════════════════════════════════════════════════════════════

const SVG_W = 600;
const SVG_H = 200;
const PAD_L = 50;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 10;
const PLOT_W = SVG_W - PAD_L - PAD_R;
const PLOT_H = SVG_H - PAD_T - PAD_B;

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const G3BurnRunway: React.FC<G3BurnRunwayProps> = ({ data }) => {
  // chk5.D-S8.SF3.D3 · guard: si caja=0, maxSaldo=0 hace division 0 → NaN en SVG.
  // Fallback a 1 mantiene el eje renderizable (todo se ve en línea base) sin crash.
  const maxSaldo = data.cajaActual > 0 ? data.cajaActual : 1;
  const tresMeses = data.burnRateMensual * 3;
  const seisMeses = data.burnRateMensual * 6;

  const yScale = (saldo: number) => {
    const raw = PAD_T + PLOT_H - ((saldo - 0) / (maxSaldo - 0)) * PLOT_H;
    return Number.isFinite(raw) ? raw : PAD_T + PLOT_H;
  };

  const xScale = (mes: number) => {
    const raw = PAD_L + (mes / 12) * PLOT_W;
    return Number.isFinite(raw) ? raw : PAD_L;
  };

  const puntosPolyline = useMemo(() => {
    if (data.runwayMeses === Infinity || data.burnRateMensual <= 0) {
      // Sin burn · línea plana en la caja actual
      return `${xScale(0)},${yScale(data.cajaActual)} ${xScale(12)},${yScale(data.cajaActual)}`;
    }
    return data.puntos.map((p) => `${xScale(p.mes)},${yScale(p.saldoProyectado)}`).join(' ');
  }, [data]);

  // Y de zonas · usado para rect alerta/crítica
  const ySeisMeses = data.burnRateMensual > 0 ? yScale(seisMeses) : PAD_T + PLOT_H * 0.4;
  const yTresMeses = data.burnRateMensual > 0 ? yScale(tresMeses) : PAD_T + PLOT_H * 0.8;

  const runwayMesesDisplay =
    data.runwayMeses === Infinity ? '∞' : `${data.runwayMeses.toFixed(1)} meses`;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-purple-700">
          § G3 · Burn Rate + Runway · ¿cuántos meses dura la caja?
        </span>
        <div className="flex-1 h-px bg-purple-200" />
      </div>
      <p className="text-[12px] text-slate-500 max-w-2xl">
        Si paro de vender hoy, ¿cuánto dura la caja con los egresos fijos actuales? · Línea
        descendente + zonas semáforo.
      </p>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-rose-700">
              Burn rate mensual
            </div>
            <div className="text-2xl font-bold tabular-nums text-rose-900">
              S/ {fmtMonto(data.burnRateMensual)}
              <span className="text-rose-400">.00</span>
            </div>
            <div className="text-[10px] text-slate-500">
              promedio egresos últimos 90d / mes
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">
              Runway actual
            </div>
            <div className="text-2xl font-bold tabular-nums text-emerald-900">
              {runwayMesesDisplay}
            </div>
            <div className="text-[10px] text-slate-500">
              caja S/ {fmtMonto(data.cajaActual)} / burn S/ {fmtMonto(data.burnRateMensual)}
            </div>
          </div>
        </div>

        {/* SVG · curva runway */}
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="none"
          className="w-full h-48 border border-slate-100 rounded-lg bg-slate-50"
          role="img"
          aria-label="Curva de runway"
        >
          {/* Zona crítica (< 3 meses · rosa tenue) */}
          <rect
            x={PAD_L}
            y={yTresMeses}
            width={PLOT_W}
            height={PAD_T + PLOT_H - yTresMeses}
            fill="#fecaca"
            opacity="0.4"
          />
          {/* Zona alerta (3-6 meses · amber tenue) */}
          <rect
            x={PAD_L}
            y={ySeisMeses}
            width={PLOT_W}
            height={yTresMeses - ySeisMeses}
            fill="#fef3c7"
            opacity="0.4"
          />

          {/* Línea cero */}
          <line
            x1={PAD_L}
            y1={PAD_T + PLOT_H}
            x2={SVG_W - PAD_R}
            y2={PAD_T + PLOT_H}
            stroke="#cbd5e1"
            strokeWidth="1"
          />

          {/* Etiquetas Y */}
          <text x={5} y={PAD_T + 10} fontSize="9" fill="#475569" fontWeight="bold">
            S/ {fmtMonto(maxSaldo)}
          </text>
          {data.burnRateMensual > 0 && (
            <text x={5} y={ySeisMeses + 4} fontSize="9" fill="#92400e" fontWeight="bold">
              S/ {fmtMonto(seisMeses)} (6m)
            </text>
          )}
          {data.burnRateMensual > 0 && (
            <text x={5} y={yTresMeses + 4} fontSize="9" fill="#92400e" fontWeight="bold">
              S/ {fmtMonto(tresMeses)} (3m)
            </text>
          )}
          <text x={5} y={PAD_T + PLOT_H - 2} fontSize="9" fill="#991b1b" fontWeight="bold">
            S/ 0
          </text>

          {/* Línea de runway descendente */}
          <polyline points={puntosPolyline} fill="none" stroke="#f43f5e" strokeWidth="2.5" />

          {/* Hoy */}
          <circle cx={xScale(0)} cy={yScale(data.cajaActual)} r="4" fill="#0d9488" />
          <text x={xScale(0) + 8} y={yScale(data.cajaActual) - 4} fontSize="9" fill="#0f766e" fontWeight="bold">
            Hoy
          </text>

          {/* Mes 6 · alerta */}
          {data.burnRateMensual > 0 && data.runwayMeses > 6 && (
            <>
              <circle cx={xScale(6)} cy={yScale(maxSaldo - 6 * data.burnRateMensual)} r="4" fill="#f59e0b" />
              <text
                x={xScale(6) + 8}
                y={yScale(maxSaldo - 6 * data.burnRateMensual) - 4}
                fontSize="9"
                fill="#92400e"
                fontWeight="bold"
              >
                Mes 6 · alerta
              </text>
            </>
          )}

          {/* Punto crítico (al final del runway) */}
          {data.runwayMeses !== Infinity && data.runwayMeses <= 12 && (
            <>
              <circle
                cx={xScale(data.runwayMeses)}
                cy={yScale(0)}
                r="4"
                fill="#dc2626"
              />
              <text
                x={xScale(data.runwayMeses) - 60}
                y={yScale(0) - 6}
                fontSize="9"
                fill="#991b1b"
                fontWeight="bold"
              >
                Mes {data.runwayMeses.toFixed(1)} · crítico
              </text>
            </>
          )}
        </svg>

        {/* Footer 3 cards zonas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-[11px]">
          <ZonaCard
            label="Zona segura (>6m)"
            fecha={fechaPlusMeses(0, Math.max(0, data.runwayMeses - 6))}
            color="emerald"
          />
          <ZonaCard
            label="Zona alerta (3-6m)"
            fecha={
              data.zonaAlertaFecha && data.zonaCriticaFecha
                ? `${fmtFecha(data.zonaAlertaFecha)} a ${fmtFecha(data.zonaCriticaFecha)}`
                : '—'
            }
            color="amber"
          />
          <ZonaCard
            label="Zona crítica (<3m)"
            fecha={data.zonaCriticaFecha ? `${fmtFecha(data.zonaCriticaFecha)} en adelante` : '—'}
            color="rose"
          />
        </div>
      </div>
    </section>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═════════════════════════════════════════════════════════════════════════

interface ZonaCardProps {
  label: string;
  fecha: string;
  color: 'emerald' | 'amber' | 'rose';
}

const ZONA_BG: Record<ZonaCardProps['color'], string> = {
  emerald: 'bg-emerald-50 ring-emerald-200/50',
  amber: 'bg-amber-50 ring-amber-200/50',
  rose: 'bg-rose-50 ring-rose-200/50',
};
const ZONA_LABEL: Record<ZonaCardProps['color'], string> = {
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
};
const ZONA_TEXT: Record<ZonaCardProps['color'], string> = {
  emerald: 'text-emerald-900',
  amber: 'text-amber-900',
  rose: 'text-rose-900',
};

const ZonaCard: React.FC<ZonaCardProps> = ({ label, fecha, color }) => (
  <div className={`ring-1 rounded-lg p-2 ${ZONA_BG[color]}`}>
    <div className={`text-[9px] uppercase font-bold ${ZONA_LABEL[color]}`}>{label}</div>
    <div className={`text-[10px] ${ZONA_TEXT[color]}`}>{fecha}</div>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function fmtFecha(d: Date): string {
  return d
    .toLocaleDateString('es-PE', { month: 'short', year: 'numeric' })
    .replace(/\./g, '');
}

function fechaPlusMeses(_base: number, meses: number): string {
  if (meses <= 0) return 'Hoy';
  const d = new Date();
  d.setMonth(d.getMonth() + Math.floor(meses));
  return `Hoy hasta ${fmtFecha(d)}`;
}
