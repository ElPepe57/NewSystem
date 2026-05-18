/**
 * G10PulsoFinanciero — chk5.D-S3.quinto · SF2
 *
 * Pulso financiero · 4 gauges semáforo canon MOCK 4 §2.
 * Pixel-perfect SVG arc gauges con tinte emerald/amber/rose.
 *
 * Cada gauge: arc circular 0-100% con label + estado + subtítulo.
 * Banner alerta debajo si algún gauge está en crítico/atención.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { PulsoFinanciero, Gauge } from './analisisHelpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface G10PulsoFinancieroProps {
  pulso: PulsoFinanciero;
}

// ═════════════════════════════════════════════════════════════════════════
// MAPS canon
// ═════════════════════════════════════════════════════════════════════════

const GAUGE_STROKE: Record<Gauge['color'], string> = {
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
};

const GAUGE_TEXT: Record<Gauge['color'], string> = {
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
};

const GAUGE_VALUE_FADE: Record<Gauge['color'], string> = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  rose: 'text-rose-400',
};

const ESTADO_LABEL_CANON: Record<NonNullable<Gauge['estado']>, string> = {
  saludable: 'Saludable',
  solido: 'Sólido',
  atencion: 'Atención',
  critico: 'Crítico',
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════

export const G10PulsoFinanciero: React.FC<G10PulsoFinancieroProps> = ({ pulso }) => {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-purple-700">
          § G10 · Pulso financiero · 4 gauges semáforo
        </span>
        <div className="flex-1 h-px bg-purple-200" />
      </div>
      <p className="text-[12px] text-slate-500 max-w-2xl">
        ¿Cómo viene el negocio HOY en 1 vistazo? 4 dimensiones · color semáforo
        emerald/amber/rose.
      </p>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <GaugeCard gauge={pulso.liquidez} />
        <GaugeCard gauge={pulso.rentabilidad} />
        <GaugeCard gauge={pulso.solvencia} />
        <GaugeCard gauge={pulso.eficiencia} />
      </div>

      {pulso.alerta && (
        <div
          className={`ring-1 rounded-xl p-3 text-[11px] flex items-start gap-2 ${
            pulso.alerta.severidad === 'rose'
              ? 'bg-rose-50 ring-rose-200 text-rose-900'
              : 'bg-amber-50 ring-amber-200 text-amber-900'
          }`}
        >
          <AlertTriangle
            className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
              pulso.alerta.severidad === 'rose' ? 'text-rose-700' : 'text-amber-700'
            }`}
          />
          <div>
            <strong>{pulso.alerta.titulo}</strong>
            <div className="mt-1">{pulso.alerta.descripcion}</div>
          </div>
        </div>
      )}
    </section>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTE GAUGE
// ═════════════════════════════════════════════════════════════════════════

interface GaugeCardProps {
  gauge: Gauge;
}

const GaugeCard: React.FC<GaugeCardProps> = ({ gauge }) => {
  // Arc: r=40 · circumference = 2*pi*40 ≈ 251
  // dashoffset = 251 - (valor/100 * 251)
  // chk5.D-S8.SF3.D3 · guard NaN: valor podría venir de division por 0 en helpers
  const circumference = 251;
  const valorSeguro = Number.isFinite(gauge.valor) ? gauge.valor : 0;
  const dashoffset = circumference - (valorSeguro / 100) * circumference;

  return (
    <div className="text-center">
      <div className="relative w-32 h-32 mx-auto mb-2">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={GAUGE_STROKE[gauge.color]}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 600ms ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`text-2xl font-bold tabular-nums ${GAUGE_TEXT[gauge.color]}`}>
            {Math.round(valorSeguro)}
            <span className={GAUGE_VALUE_FADE[gauge.color]}>%</span>
          </div>
          <div className={`text-[9px] font-bold uppercase ${GAUGE_TEXT[gauge.color]}`}>
            {ESTADO_LABEL_CANON[gauge.estado]}
          </div>
        </div>
      </div>
      <div className="text-[11px] font-bold text-slate-900">{gauge.label}</div>
      <div className="text-[10px] text-slate-500">{gauge.subtitulo}</div>
    </div>
  );
};
