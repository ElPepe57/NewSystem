/**
 * ProyeccionChartSVG — chk5.D-S3.quater · SF2
 *
 * Gráfico SVG canon MOCK 9 · proyección de caja con 4 series:
 *   1. Caja real (histórico · solid teal)
 *   2. Proyección base (dashed indigo)
 *   3. Optimista +15% (dashed emerald)
 *   4. Pesimista −20% (dashed rose)
 *
 * Elementos canon:
 *   - Eje Y con escala adaptativa (S/ valores)
 *   - Eje X con fechas (5-6 ticks)
 *   - Línea HOY marcador (vertical dashed slate)
 *   - Zona alerta < S/ 30K (línea dashed amber)
 *   - Zona crítica < S/ 0 (línea dashed rose)
 *   - Punto crítico marcado con círculo + tooltip texto inline
 *
 * Responsive · viewBox + svg width 100% · auto-escala.
 */

import React, { useMemo } from 'react';
import type { PuntoProyeccion, EscenarioCashFlow } from './cashFlowHelpers';
import { fmtFechaCorta, fmtK } from './cashFlowHelpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface ProyeccionChartSVGProps {
  /** Puntos del histórico real (últimos N días · solid teal) */
  historico: Array<{ fecha: Date; saldo: number }>;
  /** Puntos de proyección (incluye hoy como anclaje · 3 escenarios) */
  proyeccion: PuntoProyeccion[];
  /** Escenarios visibles · controla qué líneas se dibujan */
  escenariosVisibles: Set<EscenarioCashFlow>;
  /** Punto crítico opcional · marcado con círculo + label */
  puntoCriticoFecha?: Date;
  puntoCriticoSaldo?: number;
}

// ═════════════════════════════════════════════════════════════════════════
// CONSTANTES SVG
// ═════════════════════════════════════════════════════════════════════════

const SVG_WIDTH = 800;
const SVG_HEIGHT = 280;
const PADDING_LEFT = 40;
const PADDING_RIGHT = 20;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 30;
const PLOT_WIDTH = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const PLOT_HEIGHT = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

const COLOR_HISTORICO = '#0d9488'; // teal-600
const COLOR_BASE = '#6366f1'; // indigo-500
const COLOR_OPTIMISTA = '#10b981'; // emerald-500
const COLOR_PESIMISTA = '#f43f5e'; // rose-500
const COLOR_ALERTA = '#fbbf24'; // amber-400
const COLOR_CRITICA = '#dc2626'; // red-600
const COLOR_HOY_LINE = '#cbd5e1'; // slate-300

// ═════════════════════════════════════════════════════════════════════════
// HELPERS DE ESCALA
// ═════════════════════════════════════════════════════════════════════════

interface Escala {
  minY: number;
  maxY: number;
  minX: number;
  maxX: number;
}

function calcularEscala(
  historico: ProyeccionChartSVGProps['historico'],
  proyeccion: ProyeccionChartSVGProps['proyeccion'],
  escenariosVisibles: Set<EscenarioCashFlow>,
): Escala {
  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;

  for (const p of historico) {
    if (p.saldo < minY) minY = p.saldo;
    if (p.saldo > maxY) maxY = p.saldo;
    const t = p.fecha.getTime();
    if (t < minX) minX = t;
    if (t > maxX) maxX = t;
  }

  for (const p of proyeccion) {
    const t = p.fecha.getTime();
    if (t < minX) minX = t;
    if (t > maxX) maxX = t;
    if (escenariosVisibles.has('base')) {
      if (p.saldoBase < minY) minY = p.saldoBase;
      if (p.saldoBase > maxY) maxY = p.saldoBase;
    }
    if (escenariosVisibles.has('optimista')) {
      if (p.saldoOptimista < minY) minY = p.saldoOptimista;
      if (p.saldoOptimista > maxY) maxY = p.saldoOptimista;
    }
    if (escenariosVisibles.has('pesimista')) {
      if (p.saldoPesimista < minY) minY = p.saldoPesimista;
      if (p.saldoPesimista > maxY) maxY = p.saldoPesimista;
    }
  }

  // Padding 10% arriba y abajo
  const rangoY = maxY - minY;
  minY = Math.min(minY - rangoY * 0.1, 0); // siempre incluir 0 (zona crítica)
  maxY = maxY + rangoY * 0.1;

  if (!isFinite(minY) || !isFinite(maxY) || minY === maxY) {
    minY = 0;
    maxY = 100000;
  }
  if (!isFinite(minX) || !isFinite(maxX) || minX === maxX) {
    minX = Date.now();
    maxX = Date.now() + 60 * 24 * 60 * 60 * 1000;
  }

  return { minY, maxY, minX, maxX };
}

function xCoord(fecha: Date, e: Escala): number {
  // chk5.D-S8.SF3.D3 · guard NaN: fecha invalida o e.maxX==e.minX → division 0.
  const t = fecha?.getTime?.();
  if (!Number.isFinite(t)) return PADDING_LEFT;
  const denom = e.maxX - e.minX;
  if (denom === 0) return PADDING_LEFT;
  const raw = PADDING_LEFT + ((t - e.minX) / denom) * PLOT_WIDTH;
  return Number.isFinite(raw) ? raw : PADDING_LEFT;
}

function yCoord(saldo: number, e: Escala): number {
  // chk5.D-S8.SF3.D3 · guard NaN: saldo NaN o rango Y == 0 → division 0.
  if (!Number.isFinite(saldo)) return PADDING_TOP + PLOT_HEIGHT;
  const denom = e.maxY - e.minY;
  if (denom === 0) return PADDING_TOP + PLOT_HEIGHT;
  const raw = PADDING_TOP + PLOT_HEIGHT - ((saldo - e.minY) / denom) * PLOT_HEIGHT;
  return Number.isFinite(raw) ? raw : PADDING_TOP + PLOT_HEIGHT;
}

function pointsString(
  puntos: Array<{ fecha: Date; saldo: number }>,
  e: Escala,
): string {
  return puntos.map((p) => `${xCoord(p.fecha, e).toFixed(1)},${yCoord(p.saldo, e).toFixed(1)}`).join(' ');
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const ProyeccionChartSVG: React.FC<ProyeccionChartSVGProps> = ({
  historico,
  proyeccion,
  escenariosVisibles,
  puntoCriticoFecha,
  puntoCriticoSaldo,
}) => {
  const escala = useMemo(
    () => calcularEscala(historico, proyeccion, escenariosVisibles),
    [historico, proyeccion, escenariosVisibles],
  );

  // Hoy = fin del histórico = inicio de proyección
  const hoy = useMemo(() => {
    if (historico.length > 0) return historico[historico.length - 1].fecha;
    if (proyeccion.length > 0) return proyeccion[0].fecha;
    return new Date();
  }, [historico, proyeccion]);

  const xHoy = xCoord(hoy, escala);

  // Ticks Y · 3-4 referencias (max · mid · 0 si aplica · min)
  const ticksY = useMemo(() => {
    const tk: number[] = [];
    tk.push(escala.maxY);
    tk.push((escala.maxY + escala.minY) / 2);
    if (escala.minY < 0 && escala.maxY > 0) tk.push(0);
    tk.push(escala.minY);
    return Array.from(new Set(tk.map((v) => Math.round(v / 10000) * 10000))).sort(
      (a, b) => b - a,
    );
  }, [escala]);

  // Ticks X · 5 fechas equidistantes
  const ticksX = useMemo(() => {
    const tk: Date[] = [];
    const span = escala.maxX - escala.minX;
    for (let i = 0; i <= 4; i++) {
      tk.push(new Date(escala.minX + (span * i) / 4));
    }
    return tk;
  }, [escala]);

  // Zonas alerta · S/ 30K · zona crítica · S/ 0
  const yAlerta = yCoord(30000, escala);
  const yCritica = yCoord(0, escala);

  // Puntos proyección por serie
  const puntosBase = proyeccion.map((p) => ({ fecha: p.fecha, saldo: p.saldoBase }));
  const puntosOpt = proyeccion.map((p) => ({ fecha: p.fecha, saldo: p.saldoOptimista }));
  const puntosPes = proyeccion.map((p) => ({ fecha: p.fecha, saldo: p.saldoPesimista }));

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      preserveAspectRatio="none"
      className="w-full h-64 bg-slate-50 rounded-xl"
      role="img"
      aria-label="Proyección de caja"
    >
      {/* ─── Grid Y ────────────────────────────────────────────────── */}
      {ticksY.map((v) => {
        const y = yCoord(v, escala);
        return (
          <g key={`y-${v}`}>
            <line
              x1={PADDING_LEFT}
              y1={y}
              x2={SVG_WIDTH - PADDING_RIGHT}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth="0.5"
              strokeDasharray="2 4"
            />
            <text x={5} y={y + 3} fontSize="9" fill="#475569">
              S/ {fmtK(v)}
            </text>
          </g>
        );
      })}

      {/* ─── Zonas alerta / crítica ────────────────────────────────── */}
      {yAlerta >= PADDING_TOP && yAlerta <= PADDING_TOP + PLOT_HEIGHT && (
        <>
          <line
            x1={PADDING_LEFT}
            y1={yAlerta}
            x2={SVG_WIDTH - PADDING_RIGHT}
            y2={yAlerta}
            stroke={COLOR_ALERTA}
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.6"
          />
          <text x={PADDING_LEFT + 4} y={yAlerta - 2} fontSize="8" fill="#92400e" fontWeight="bold">
            Zona alerta &lt; S/ 30K
          </text>
        </>
      )}
      {yCritica >= PADDING_TOP && yCritica <= PADDING_TOP + PLOT_HEIGHT && escala.minY < 0 && (
        <>
          <line
            x1={PADDING_LEFT}
            y1={yCritica}
            x2={SVG_WIDTH - PADDING_RIGHT}
            y2={yCritica}
            stroke={COLOR_CRITICA}
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.6"
          />
          <text x={PADDING_LEFT + 4} y={yCritica - 2} fontSize="8" fill="#991b1b" fontWeight="bold">
            Zona crítica &lt; S/ 0
          </text>
        </>
      )}

      {/* ─── Línea vertical HOY ────────────────────────────────────── */}
      <line
        x1={xHoy}
        y1={PADDING_TOP}
        x2={xHoy}
        y2={PADDING_TOP + PLOT_HEIGHT}
        stroke={COLOR_HOY_LINE}
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <text x={xHoy - 30} y={PADDING_TOP + PLOT_HEIGHT + 10} fontSize="8" fill="#0f766e" fontWeight="bold">
        HOY {fmtFechaCorta(hoy)}
      </text>

      {/* ─── Línea histórica real (teal solid) ─────────────────────── */}
      {historico.length > 0 && (
        <polyline
          points={pointsString(historico, escala)}
          fill="none"
          stroke={COLOR_HISTORICO}
          strokeWidth="2.5"
        />
      )}

      {/* ─── Líneas proyección por escenario ───────────────────────── */}
      {escenariosVisibles.has('optimista') && proyeccion.length > 0 && (
        <polyline
          points={pointsString(puntosOpt, escala)}
          fill="none"
          stroke={COLOR_OPTIMISTA}
          strokeWidth="1.5"
          strokeDasharray="3 2"
          opacity="0.8"
        />
      )}
      {escenariosVisibles.has('base') && proyeccion.length > 0 && (
        <polyline
          points={pointsString(puntosBase, escala)}
          fill="none"
          stroke={COLOR_BASE}
          strokeWidth="2.5"
        />
      )}
      {escenariosVisibles.has('pesimista') && proyeccion.length > 0 && (
        <polyline
          points={pointsString(puntosPes, escala)}
          fill="none"
          stroke={COLOR_PESIMISTA}
          strokeWidth="1.5"
          strokeDasharray="3 2"
          opacity="0.8"
        />
      )}

      {/* ─── Punto crítico marcado ──────────────────────────────────── */}
      {puntoCriticoFecha && puntoCriticoSaldo !== undefined && (
        <g>
          <circle
            cx={xCoord(puntoCriticoFecha, escala)}
            cy={yCoord(puntoCriticoSaldo, escala)}
            r="5"
            fill={COLOR_ALERTA}
            stroke="white"
            strokeWidth="2"
          />
          <text
            x={xCoord(puntoCriticoFecha, escala) + 8}
            y={yCoord(puntoCriticoSaldo, escala) - 4}
            fontSize="8"
            fill="#92400e"
            fontWeight="bold"
          >
            {fmtFechaCorta(puntoCriticoFecha)} S/ {fmtK(puntoCriticoSaldo)}
          </text>
        </g>
      )}

      {/* ─── Ticks X (fechas) ───────────────────────────────────────── */}
      {ticksX.map((f, i) => (
        <text
          key={`x-${i}`}
          x={xCoord(f, escala)}
          y={SVG_HEIGHT - 8}
          fontSize="8"
          fill="#475569"
          textAnchor="middle"
        >
          {fmtFechaCorta(f)}
        </text>
      ))}
    </svg>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// LEYENDA SEPARADA · canon MOCK 9 §1 leyenda externa
// ═════════════════════════════════════════════════════════════════════════

export interface ChartLegendProps {
  escenariosVisibles: Set<EscenarioCashFlow>;
}

export const ChartLegend: React.FC<ChartLegendProps> = ({ escenariosVisibles }) => (
  <div className="flex items-center gap-3 text-[10px] flex-wrap">
    <span className="flex items-center gap-1">
      <span className="w-3 h-3 rounded-full bg-teal-500" />
      Caja real (histórico)
    </span>
    {escenariosVisibles.has('base') && (
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-full bg-indigo-500" />
        Proyección base
      </span>
    )}
    {escenariosVisibles.has('optimista') && (
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-full bg-emerald-300" />
        Optimista
      </span>
    )}
    {escenariosVisibles.has('pesimista') && (
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-full bg-rose-300" />
        Pesimista
      </span>
    )}
  </div>
);
