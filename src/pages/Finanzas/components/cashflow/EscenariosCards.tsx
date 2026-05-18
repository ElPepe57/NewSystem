/**
 * EscenariosCards + BannerPuntoTension — chk5.D-S3.quater · SF3
 *
 * Componentes complementarios al gráfico SVG de proyección · canon MOCK 9.
 *
 * Exports:
 *   - <EscenariosCards />     · 3 cards (optimista · base activa · pesimista)
 *     con cierre estimado +60d y narrativa explicativa
 *   - <BannerPuntoTension />  · banner alerta amber/rose con icon · texto
 *     descriptivo + CTA "Plan de acción"
 *
 * Diseño canon v9.0 M1 copy-paste literal del mockup §1.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { PuntoTensionDetectado } from './cashFlowHelpers';
import { fmt0, fmtFechaCorta } from './cashFlowHelpers';

// ═════════════════════════════════════════════════════════════════════════
// ESCENARIOS CARDS
// ═════════════════════════════════════════════════════════════════════════

export interface EscenariosCardsProps {
  cierre60dOptimista: number;
  cierre60dBase: number;
  cierre60dPesimista: number;
  horizonteDias: number;
}

export const EscenariosCards: React.FC<EscenariosCardsProps> = ({
  cierre60dOptimista,
  cierre60dBase,
  cierre60dPesimista,
  horizonteDias,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* OPTIMISTA */}
      <EscenarioCard
        label="Optimista (+15%)"
        valor={cierre60dOptimista}
        narrativa={`cierre ${horizonteDias}d · cobranza efectiva + nueva venta · NO retrasos`}
        color="emerald"
      />
      {/* BASE · activo */}
      <EscenarioCard
        label="Base (escenario activo)"
        valor={cierre60dBase}
        narrativa={`cierre ${horizonteDias}d · operativa actual sin sorpresas`}
        color="indigo"
        destacado
      />
      {/* PESIMISTA */}
      <EscenarioCard
        label="Pesimista (−20%)"
        valor={cierre60dPesimista}
        narrativa={`cierre ${horizonteDias}d · ventas caen + cobros NO entran · revisar holgura`}
        color="rose"
      />
    </div>
  );
};

interface EscenarioCardProps {
  label: string;
  valor: number;
  narrativa: string;
  color: 'emerald' | 'indigo' | 'rose';
  destacado?: boolean;
}

const ESC_BG: Record<EscenarioCardProps['color'], string> = {
  emerald: 'bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-emerald-200/50',
  indigo: 'bg-gradient-to-br from-indigo-50 to-indigo-100/40',
  rose: 'bg-gradient-to-br from-rose-50 to-rose-100/40 ring-rose-200/50',
};

const ESC_LABEL: Record<EscenarioCardProps['color'], string> = {
  emerald: 'text-emerald-700',
  indigo: 'text-indigo-700',
  rose: 'text-rose-700',
};

const ESC_VALUE: Record<EscenarioCardProps['color'], string> = {
  emerald: 'text-emerald-900',
  indigo: 'text-indigo-900',
  rose: 'text-rose-900',
};

const EscenarioCard: React.FC<EscenarioCardProps> = ({
  label,
  valor,
  narrativa,
  color,
  destacado,
}) => (
  <div
    className={`rounded-xl p-3 ${ESC_BG[color]} ${
      destacado ? 'ring-2 ring-indigo-500' : 'ring-1'
    }`}
  >
    <div className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${ESC_LABEL[color]}`}>
      {label}
    </div>
    <div className={`text-[18px] font-bold tabular-nums ${ESC_VALUE[color]}`}>
      {valor < 0 ? '−' : ''}S/ {fmt0(Math.abs(valor))}
    </div>
    <div className={`text-[10px] mt-1 ${ESC_LABEL[color]}`}>{narrativa}</div>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════
// BANNER PUNTO DE TENSIÓN
// ═════════════════════════════════════════════════════════════════════════

export interface BannerPuntoTensionProps {
  punto: PuntoTensionDetectado;
  onPlanAccion: () => void;
}

const BANNER_BG: Record<PuntoTensionDetectado['zona'], string> = {
  segura: 'bg-gradient-to-r from-amber-50 to-amber-100/40 ring-amber-300',
  alerta: 'bg-gradient-to-r from-amber-50 to-amber-100/40 ring-amber-400',
  critica: 'bg-gradient-to-r from-rose-50 to-rose-100/40 ring-rose-400',
};

const BANNER_ICON_BG: Record<PuntoTensionDetectado['zona'], string> = {
  segura: 'bg-amber-100 text-amber-700',
  alerta: 'bg-amber-100 text-amber-700',
  critica: 'bg-rose-100 text-rose-700',
};

const BANNER_TITLE: Record<PuntoTensionDetectado['zona'], string> = {
  segura: 'text-amber-900',
  alerta: 'text-amber-900',
  critica: 'text-rose-900',
};

const BANNER_TEXT: Record<PuntoTensionDetectado['zona'], string> = {
  segura: 'text-amber-700',
  alerta: 'text-amber-700',
  critica: 'text-rose-700',
};

const BANNER_BTN: Record<PuntoTensionDetectado['zona'], string> = {
  segura: 'bg-amber-600 hover:bg-amber-700',
  alerta: 'bg-amber-600 hover:bg-amber-700',
  critica: 'bg-rose-600 hover:bg-rose-700',
};

const BANNER_LABEL_ZONA: Record<PuntoTensionDetectado['zona'], string> = {
  segura: 'Punto de tensión detectado',
  alerta: 'Punto de tensión · zona alerta',
  critica: 'Punto crítico · caja negativa',
};

export const BannerPuntoTension: React.FC<BannerPuntoTensionProps> = ({ punto, onPlanAccion }) => {
  return (
    <div className="px-6 py-3 border-b bg-amber-50/40">
      <div
        className={`ring-1 rounded-xl p-3 flex items-start gap-3 flex-wrap ${BANNER_BG[punto.zona]}`}
      >
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${BANNER_ICON_BG[punto.zona]}`}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-[260px]">
          <div className={`text-[12px] font-bold ${BANNER_TITLE[punto.zona]}`}>
            {BANNER_LABEL_ZONA[punto.zona]} · {fmtFechaCorta(punto.fecha)}
          </div>
          <div className={`text-[11px] ${BANNER_TEXT[punto.zona]}`}>{punto.mensaje}</div>
          <div className={`text-[10px] mt-1 ${BANNER_TEXT[punto.zona]}`}>
            En {punto.diasHasta} {punto.diasHasta === 1 ? 'día' : 'días'} ·{' '}
            <strong>S/ {fmt0(punto.totalEgresos)}</strong> en salidas ·{' '}
            <strong>S/ {fmt0(punto.cajaEseDia)}</strong> caja proyectada.
          </div>
        </div>
        <button
          type="button"
          onClick={onPlanAccion}
          className={`text-[11px] font-bold text-white px-3 py-1.5 rounded-lg flex-shrink-0 ${BANNER_BTN[punto.zona]}`}
        >
          Plan de acción
        </button>
      </div>
    </div>
  );
};
