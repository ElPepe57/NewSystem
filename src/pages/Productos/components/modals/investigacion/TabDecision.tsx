/**
 * TabDecision · Sub-vista del Modal Investigación Completo
 *
 * Mockup canónico: docs/mockups/productos/27-investigacion-tab-decision.html
 *
 * Síntesis ejecutiva: hero recomendación + KPIs proyección + análisis multifactorial
 * (criterios scoreados con barra) + score global ponderado + alertas/consideraciones
 * + decisión binaria (Importar al catálogo / Descartar oportunidad).
 */

import React from 'react';
import {
  CheckCircle2,
  Check,
  X,
  ArrowRight,
  AlertTriangle,
  DollarSign,
  Users,
  Award,
  TrendingUp,
  Dot,
} from 'lucide-react';
import type { DecisionInvestigacion, CriterioDecision } from './types';

interface TabDecisionProps {
  decision: DecisionInvestigacion;
  onImportar?: () => void;
  onDescartar?: () => void;
}

const ICONO_MAP = {
  dollar: DollarSign,
  users: Users,
  award: Award,
  trending: TrendingUp,
  alert: AlertTriangle,
};

const COLOR_BAR_MAP: Record<CriterioDecision['semaforo'], string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-400',
};

const COLOR_TEXT_MAP: Record<CriterioDecision['semaforo'], string> = {
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  rose: 'text-rose-600',
};

const COLOR_ICON_MAP: Record<CriterioDecision['semaforo'], string> = {
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  rose: 'text-rose-600',
};

export function TabDecision({ decision, onImportar, onDescartar }: TabDecisionProps) {
  const recomendado = decision.recomendacion === 'importar';

  return (
    <div className="space-y-4">
      {/* Header tab */}
      <div>
        <h3 className="text-base font-bold text-slate-900">Recomendación final</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Síntesis de proveedores + competencia + márgenes proyectados
        </p>
      </div>

      {/* HERO RECOMENDACIÓN */}
      <div
        className={`rounded-xl border-2 p-5 ${
          recomendado
            ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-white'
            : 'border-rose-300 bg-gradient-to-br from-rose-50 to-white'
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-14 h-14 rounded-2xl text-white flex items-center justify-center flex-shrink-0 shadow-md ${
              recomendado
                ? 'bg-emerald-600 shadow-emerald-200'
                : 'bg-rose-600 shadow-rose-200'
            }`}
          >
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={`text-[10px] uppercase tracking-wider font-bold ${
                  recomendado ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                Recomendación IA
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-white text-[10px] font-bold ${
                  recomendado ? 'bg-emerald-600' : 'bg-rose-600'
                }`}
              >
                {recomendado ? 'RECOMENDADO' : 'NO RECOMENDADO'}
              </span>
            </div>
            <h2 className="text-base lg:text-lg font-bold text-slate-900">
              {recomendado
                ? `Importar al catálogo · Precio sugerido S/ ${decision.precioSugeridoPEN.toFixed(0)}`
                : 'Descartar oportunidad · Análisis no favorable'}
            </h2>
            <p className="text-xs text-slate-700 mt-1">{decision.resumen}</p>
          </div>
        </div>

        {/* KPIs proyección */}
        <div
          className={`grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t ${
            recomendado ? 'border-emerald-200' : 'border-rose-200'
          }`}
        >
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              Costo unitario
            </div>
            <div className="text-base font-bold text-slate-900 tabular-nums">
              S/ {decision.costoUnitarioPEN.toFixed(0)}
            </div>
            <div className="text-[10px] text-slate-500">CTRU · landed</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              Precio venta
            </div>
            <div className="text-base font-bold text-slate-900 tabular-nums">
              S/ {decision.precioSugeridoPEN.toFixed(0)}
            </div>
            <div
              className={`text-[10px] ${recomendado ? 'text-emerald-700' : 'text-rose-700'}`}
            >
              Sugerido
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              Margen bruto
            </div>
            <div
              className={`text-base font-bold tabular-nums ${
                recomendado ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {decision.margenBrutoPct.toFixed(0)}%
            </div>
            <div className="text-[10px] text-slate-500">
              S/ {decision.margenBrutoPEN.toFixed(0)}/u
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              Break-even
            </div>
            <div className="text-base font-bold text-slate-900 tabular-nums">
              {decision.breakEvenUds} uds
            </div>
            <div className="text-[10px] text-slate-500">para recuperar OC</div>
          </div>
        </div>
      </div>

      {/* CRITERIOS PUNTUADOS */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Análisis multifactorial
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {decision.criterios.map((c) => {
            const Icon = ICONO_MAP[c.icon];
            const widthPct = Math.max(0, Math.min(100, c.score * 10));
            return (
              <div
                key={c.key}
                className="grid grid-cols-12 gap-3 items-center px-4 py-2.5"
              >
                <div className="col-span-12 lg:col-span-4 flex items-center gap-2 text-xs">
                  <Icon className={`w-3.5 h-3.5 ${COLOR_ICON_MAP[c.semaforo]}`} />
                  <span className="font-medium text-slate-700">{c.label}</span>
                </div>
                <div className="col-span-8 lg:col-span-6 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${COLOR_BAR_MAP[c.semaforo]}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span
                    className={`text-[11px] font-bold tabular-nums ${COLOR_TEXT_MAP[c.semaforo]}`}
                  >
                    {c.score.toFixed(1)}/10
                  </span>
                </div>
                <div className="col-span-4 lg:col-span-2 text-[11px] text-slate-500 text-right">
                  {c.etiqueta}
                </div>
              </div>
            );
          })}
        </div>
        <div
          className={`px-4 py-2.5 border-t flex items-center justify-between ${
            recomendado
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-rose-50 border-rose-200'
          }`}
        >
          <div
            className={`text-[11px] font-bold ${
              recomendado ? 'text-emerald-900' : 'text-rose-900'
            }`}
          >
            Score global ponderado
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`text-base font-bold tabular-nums ${
                recomendado ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {decision.scoreGlobal.toFixed(1)} / 10
            </div>
            <span
              className={`px-2 py-0.5 rounded text-white text-[10px] font-bold ${
                recomendado ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              {recomendado ? 'RECOMENDADO' : 'NO RECOMENDADO'}
            </span>
          </div>
        </div>
      </div>

      {/* CONSIDERACIONES */}
      {decision.consideraciones && decision.consideraciones.length > 0 && (
        <div className="border border-amber-200 rounded-xl bg-amber-50/40 p-3 space-y-2">
          <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            {decision.consideraciones.length} consideracion
            {decision.consideraciones.length === 1 ? '' : 'es'}
          </div>
          {decision.consideraciones.map((c, i) => (
            <div key={i} className="text-[11px] text-slate-700 flex items-start gap-2">
              <Dot className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
              <span>{c}</span>
            </div>
          ))}
        </div>
      )}

      {/* DECISIÓN BINARIA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <button
          onClick={onImportar}
          className={`rounded-xl border-2 p-4 text-left flex items-center gap-3 transition-all ${
            recomendado
              ? 'border-emerald-500 bg-emerald-50 hover:bg-emerald-100'
              : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-lg text-white flex items-center justify-center flex-shrink-0 ${
              recomendado ? 'bg-emerald-600' : 'bg-slate-400'
            }`}
          >
            <Check className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div
              className={`text-sm font-bold ${
                recomendado ? 'text-emerald-900' : 'text-slate-700'
              }`}
            >
              Importar al catálogo
            </div>
            <div
              className={`text-[11px] mt-0.5 ${
                recomendado ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              Crear producto + variantes + 1ra OC sugerida
            </div>
          </div>
          <ArrowRight
            className={`w-4 h-4 ${recomendado ? 'text-emerald-600' : 'text-slate-400'}`}
          />
        </button>

        <button
          onClick={onDescartar}
          className={`rounded-xl border p-4 text-left flex items-center gap-3 transition-all ${
            !recomendado
              ? 'border-rose-300 bg-rose-50 hover:bg-rose-100'
              : 'border-slate-200 bg-white hover:border-rose-300 hover:bg-rose-50'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              !recomendado ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div
              className={`text-sm font-bold ${
                !recomendado ? 'text-rose-900' : 'text-slate-700'
              }`}
            >
              Descartar oportunidad
            </div>
            <div
              className={`text-[11px] mt-0.5 ${
                !recomendado ? 'text-rose-700' : 'text-slate-500'
              }`}
            >
              Archivar la investigación · pedirá motivo
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
