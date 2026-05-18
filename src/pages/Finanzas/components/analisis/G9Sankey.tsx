/**
 * G9Sankey — chk5.D-S3.quinto · SF5
 *
 * Sankey simplificado canon MOCK 4 §8.
 * Flujo dinero · cuentas (origen) → categorías (destino).
 *
 * SVG inline simplificado · NO usa d3-sankey ni react-flow.
 * Versión MVP que se mejora con librería real en chk5.D-S4
 * (DEUDA-LIBRERIA-GRAFICA).
 *
 * Layout:
 *   - Lado izq: barras verticales de cuentas (4 max)
 *   - Lado der: barras verticales de categorías (4 max)
 *   - Curvas Bezier conectando origen → destino · grosor proporcional al volumen
 */

import React from 'react';
import { GitMerge } from 'lucide-react';
import type { SankeyNode, SankeyFlow } from './analisisHelpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface G9SankeyProps {
  nodos: SankeyNode[];
  flows: SankeyFlow[];
}

// ═════════════════════════════════════════════════════════════════════════
// CONSTANTES SVG
// ═════════════════════════════════════════════════════════════════════════

const SVG_W = 300;
const SVG_H = 140;
const NODE_WIDTH = 20;
const ORIGEN_X = 10;
const DESTINO_X = 240;
const PADDING_Y = 5;
const PLOT_H = SVG_H - PADDING_Y * 2;

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const G9Sankey: React.FC<G9SankeyProps> = ({ nodos, flows }) => {
  const origenes = nodos.filter((n) => n.lado === 'origen');
  const destinos = nodos.filter((n) => n.lado === 'destino');

  // chk5.D-S8.SF3.D3 · guard NaN: si volumen es NaN propaga a y/cy del SVG.
  const safeVol = (v: number) => (Number.isFinite(v) ? v : 0);
  const volumenTotalOrigen = origenes.reduce((s, n) => s + safeVol(n.volumen), 0) || 1;
  const volumenTotalDestino = destinos.reduce((s, n) => s + safeVol(n.volumen), 0) || 1;

  // Posicionar nodos verticalmente · proporcional al volumen
  const nodePositions = new Map<string, { y: number; height: number }>();
  let yAcumOrigen = PADDING_Y;
  for (const n of origenes) {
    const height = (safeVol(n.volumen) / volumenTotalOrigen) * PLOT_H * 0.85;
    nodePositions.set(n.id, { y: yAcumOrigen, height });
    yAcumOrigen += height + 5;
  }
  let yAcumDestino = PADDING_Y;
  for (const n of destinos) {
    const height = (safeVol(n.volumen) / volumenTotalDestino) * PLOT_H * 0.85;
    nodePositions.set(n.id, { y: yAcumDestino, height });
    yAcumDestino += height + 5;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <GitMerge className="w-4 h-4 text-teal-700" />
        <h3 className="text-[13px] font-bold text-slate-900">G9 · Sankey · flujo de dinero</h3>
      </div>
      <p className="text-[10px] text-slate-500 mb-3">
        ¿De dónde entra y a dónde sale cada sol? · cuentas → categorías
      </p>

      {nodos.length === 0 ? (
        <div className="bg-slate-50 rounded p-4 text-center text-[11px] text-slate-500 italic">
          Sin movimientos en el periodo · requiere data histórica.
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            preserveAspectRatio="none"
            className="w-full bg-slate-50 rounded"
            role="img"
            aria-label="Sankey flujo de dinero"
          >
            {/* Curvas Sankey · de origen a destino */}
            {flows.map((flow, i) => {
              const posOrigen = nodePositions.get(flow.desde);
              const posDestino = nodePositions.get(flow.hacia);
              if (!posOrigen || !posDestino) return null;
              const yOrigen = posOrigen.y + posOrigen.height / 2;
              const yDestino = posDestino.y + posDestino.height / 2;
              const grosor = Math.max(
                2,
                Math.min(20, (flow.volumen / volumenTotalOrigen) * 60),
              );
              return (
                <path
                  key={i}
                  d={`M ${ORIGEN_X + NODE_WIDTH} ${yOrigen} Q ${SVG_W / 2} ${yOrigen} ${
                    SVG_W / 2
                  } ${(yOrigen + yDestino) / 2} Q ${SVG_W / 2} ${yDestino} ${DESTINO_X} ${yDestino}`}
                  fill="none"
                  stroke={flow.color}
                  strokeOpacity="0.25"
                  strokeWidth={grosor}
                />
              );
            })}

            {/* Nodos origen */}
            {origenes.map((n) => {
              const pos = nodePositions.get(n.id)!;
              return (
                <g key={n.id}>
                  <rect x={ORIGEN_X} y={pos.y} width={NODE_WIDTH} height={pos.height} fill={n.color} />
                  <text
                    x={ORIGEN_X + NODE_WIDTH + 4}
                    y={pos.y + pos.height / 2 + 3}
                    fontSize="8"
                    fill="#0f766e"
                    fontWeight="bold"
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}

            {/* Nodos destino */}
            {destinos.map((n) => {
              const pos = nodePositions.get(n.id)!;
              return (
                <g key={n.id}>
                  <rect
                    x={DESTINO_X}
                    y={pos.y}
                    width={NODE_WIDTH}
                    height={pos.height}
                    fill={n.color}
                  />
                  <text
                    x={DESTINO_X + NODE_WIDTH + 4}
                    y={pos.y + pos.height / 2 + 3}
                    fontSize="8"
                    fill="#475569"
                    fontWeight="bold"
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="text-[10px] text-slate-600 mt-2">
            Vista preview · representación esquemática del flujo de dinero del periodo.
          </div>
        </>
      )}
    </div>
  );
};
