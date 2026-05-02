/**
 * TabInvestigacion · Tab "Investigación" del modal detalle producto
 *
 * Mockup canónico: docs/mockups/productos/13-modal-detalle-investigacion.html
 *
 * Estructura:
 *   1. Header con CTA "Ver investigación completa"
 *   2. Card Proveedores analizados (top 3 con badge "recomendado")
 *   3. Card Competencia local (grid responsive · 5 chips con "Mi precio" resaltado)
 *   4. Card Histórico precios mini-chart (3 series · 6 meses)
 *   5. Banner Decisión recomendada (gradient emerald)
 *
 * Si no hay investigación (`producto.investigacion === undefined`):
 *   muestra empty state con CTA "Investigar ahora"
 */

import React, { useMemo } from 'react';
import {
  ExternalLink,
  DollarSign,
  Users,
  TrendingUp,
  CheckCircle2,
  Search,
  Award,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import type { Producto } from '../../../../types/producto.types';

interface TabInvestigacionProps {
  producto: Producto;
  onVerCompleto?: () => void;
  onReInvestigar?: () => void;
}

function getPrecioVenta(p: Producto): number {
  return (p as any).precioVenta ?? p.investigacion?.precioSugeridoCalculado ?? 0;
}

function diasDesdeInvestigacion(p: Producto): number | null {
  const inv = p.investigacion;
  if (!inv) return null;
  const ts = (inv.fechaInvestigacion as any)?.toDate?.()?.getTime?.() ?? 0;
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

function isInvestigacionVencida(p: Producto): boolean {
  const inv = p.investigacion;
  if (!inv) return false;
  const ts = (inv.vigenciaHasta as any)?.toDate?.()?.getTime?.() ?? 0;
  return ts > 0 && ts < Date.now();
}

export const TabInvestigacion: React.FC<TabInvestigacionProps> = ({ producto, onVerCompleto, onReInvestigar }) => {
  const inv = producto.investigacion;
  const dias = diasDesdeInvestigacion(producto);
  const vencida = isInvestigacionVencida(producto);
  const precioVenta = getPrecioVenta(producto);

  // Empty state · sin investigación
  if (!inv) {
    return (
      <div className="p-3 lg:p-5">
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-8 lg:p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Search className="w-7 h-7 text-amber-700" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Sin investigación de mercado</h3>
          <p className="text-xs lg:text-sm text-slate-500 max-w-md mx-auto mb-5">
            Aún no se ha analizado proveedores ni competencia para este producto. La investigación te da datos para decidir
            precios, márgenes y oportunidades.
          </p>
          {onReInvestigar && (
            <button
              type="button"
              onClick={onReInvestigar}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
            >
              <Search className="w-3.5 h-3.5" />
              Investigar ahora
            </button>
          )}
        </div>
      </div>
    );
  }

  const proveedores = (inv.proveedoresUSA ?? []).slice(0, 3);
  const competidores = (inv.competidoresPeru ?? []).slice(0, 4);
  const competenciaPromedio = inv.precioPERUPromedio ?? 0;
  const competenciaMin = inv.precioPERUMin ?? 0;

  // Decisión derivada
  const recomendacion = inv.recomendacion ?? 'investigar_mas';
  const margenEstimado = inv.margenEstimado ?? 0;
  const decisionConfig = getDecisionConfig(recomendacion);

  return (
    <div className="p-3 lg:p-5 space-y-3 lg:space-y-4">
      {/* Banner alerta · investigación vencida */}
      {vencida && dias !== null && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div className="flex-1 text-xs text-amber-900">
            <strong>Datos desactualizados.</strong> Última investigación hace {Math.floor(dias / 30)} meses · considera re-investigar.
          </div>
          {onReInvestigar && (
            <button
              type="button"
              onClick={onReInvestigar}
              className="px-2.5 py-1 text-[10px] font-bold text-white bg-amber-600 hover:bg-amber-700 rounded flex-shrink-0"
            >
              Re-investigar
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm lg:text-base font-bold text-slate-900">Resumen de investigación</h3>
          <p className="text-[11px] lg:text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {dias !== null ? `Hace ${dias} días` : 'Análisis de proveedores y competencia'}
          </p>
        </div>
        {onVerCompleto && (
          <button
            type="button"
            onClick={onVerCompleto}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ver completa</span>
            <span className="sm:hidden">Ver</span>
          </button>
        )}
      </div>

      {/* 1. Proveedores analizados */}
      {proveedores.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-900">Proveedores analizados</h4>
            </div>
            <span className="text-[11px] text-slate-500 tabular-nums">
              {proveedores.length} proveedor{proveedores.length === 1 ? '' : 'es'}
            </span>
          </div>
          <div className="space-y-2">
            {proveedores.map((p: any, idx: number) => {
              const isTop = idx === 0;
              return (
                <div
                  key={p.id ?? idx}
                  className={`flex items-start sm:items-center justify-between gap-3 p-2.5 rounded-lg border ${
                    isTop ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={`w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${
                        isTop ? 'bg-emerald-600' : 'bg-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-semibold flex items-center gap-1.5 flex-wrap ${
                          isTop ? 'text-slate-900' : 'text-slate-700'
                        }`}
                      >
                        {p.nombre ?? `Proveedor ${idx + 1}`}
                        {isTop && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-bold flex items-center gap-1">
                            <Award className="w-2.5 h-2.5" />
                            recomendado
                          </span>
                        )}
                      </div>
                      {p.notas && (
                        <div className={`text-[11px] mt-0.5 ${isTop ? 'text-emerald-700' : 'text-slate-500'}`}>{p.notas}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-sm font-bold tabular-nums ${isTop ? 'text-slate-900' : 'text-slate-700'}`}>
                      $ {p.precio?.toFixed(2) ?? '—'}
                    </div>
                    {p.leadTime !== undefined && (
                      <div className="text-[10px] text-slate-500 tabular-nums">Lead {p.leadTime}d</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Competencia en Perú */}
      {competidores.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600" />
              <h4 className="text-sm font-bold text-slate-900">Competencia en Perú</h4>
            </div>
            <span className="text-[11px] text-slate-500 tabular-nums">
              {competidores.length} competidores
              {competenciaPromedio > 0 && ` · prom. S/ ${Math.round(competenciaPromedio)}`}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {competidores.map((c: any, idx: number) => (
              <div key={c.id ?? idx} className="p-2 rounded bg-slate-50 border border-slate-200">
                <div className="font-medium text-slate-900 truncate">{c.nombre ?? `Competidor ${idx + 1}`}</div>
                <div className="text-slate-500 tabular-nums">S/ {c.precio ?? '—'}</div>
              </div>
            ))}
            {/* Mi precio resaltado · siempre visible si tiene precio */}
            {precioVenta > 0 && (
              <div className="p-2 rounded bg-emerald-50 border border-emerald-300 ring-1 ring-emerald-200">
                <div className="font-medium text-emerald-900">Mi precio</div>
                <div className="text-emerald-700 font-bold tabular-nums">
                  S/ {Math.round(precioVenta)} {competenciaMin > 0 && precioVenta < competenciaMin ? '✓' : ''}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Histórico precios mini-chart (placeholder · datos reales en Fase 5+) */}
      <HistoricoPreciosMini producto={producto} />

      {/* 4. Decisión recomendada */}
      <div className={`rounded-xl p-4 flex items-start gap-3 border ${decisionConfig.container}`}>
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${decisionConfig.iconBg}`}
        >
          <decisionConfig.icon className={`w-5 h-5 ${decisionConfig.iconColor}`} />
        </div>
        <div className="flex-1">
          <div className={`text-sm font-bold ${decisionConfig.titleColor}`}>
            Decisión: {decisionConfig.label}
          </div>
          <div className={`text-xs mt-1 ${decisionConfig.textColor}`}>
            {inv.razonamiento ??
              `Margen estimado ${margenEstimado}% · ${competenciaMin > 0 ? `competencia mínima S/ ${Math.round(competenciaMin)}` : 'sin datos de competencia'}.`}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

const HistoricoPreciosMini: React.FC<{ producto: Producto }> = ({ producto }) => {
  // Genera serie pseudo-aleatoria estable basada en el ID (placeholder hasta tener data real)
  const series = useMemo(() => {
    const seedHash = producto.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const random = (n: number) => {
      const x = Math.sin(seedHash + n) * 10000;
      return x - Math.floor(x);
    };
    const miPrecio = Array.from({ length: 7 }, (_, i) => 60 - i * 2 - random(i) * 5);
    const competencia = Array.from({ length: 7 }, (_, i) => 45 - i * 2 - random(i + 100) * 5);
    const ctru = Array.from({ length: 7 }, (_, i) => 95 - i * 1 - random(i + 200) * 3);
    return { miPrecio, competencia, ctru };
  }, [producto.id]);

  const toPath = (values: number[]) =>
    values.map((y, i) => `${(i / (values.length - 1)) * 600},${y}`).join(' ');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-600" />
          <h4 className="text-sm font-bold text-slate-900">Histórico precios · 6 meses</h4>
        </div>
      </div>
      <svg viewBox="0 0 600 120" className="w-full h-20 lg:h-24">
        {/* Grid */}
        <line x1="0" y1="30" x2="600" y2="30" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="0" y1="60" x2="600" y2="60" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="0" y1="90" x2="600" y2="90" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2 2" />
        {/* Mi precio · violeta */}
        <polyline points={toPath(series.miPrecio)} fill="none" stroke="#8b5cf6" strokeWidth="2.5" />
        {/* Competencia · slate dashed */}
        <polyline
          points={toPath(series.competencia)}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        {/* CTRU · amber */}
        <polyline points={toPath(series.ctru)} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
      </svg>
      <div className="flex items-center gap-3 lg:gap-4 mt-2 text-[10px] flex-wrap">
        <div className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-violet-500" />
          <span className="text-slate-600">Mi precio</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 border-t border-dashed border-slate-400" />
          <span className="text-slate-600">Competencia</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-amber-500" />
          <span className="text-slate-600">CTRU</span>
        </div>
      </div>
    </div>
  );
};

// ─── Configuración de decisión ───────────────────────────────────────────────

function getDecisionConfig(rec: 'importar' | 'investigar_mas' | 'descartar') {
  switch (rec) {
    case 'importar':
      return {
        label: 'IMPORTAR · oportunidad activa',
        container: 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200',
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        titleColor: 'text-emerald-900',
        textColor: 'text-emerald-800',
        icon: CheckCircle2,
      };
    case 'descartar':
      return {
        label: 'DESCARTAR · márgenes no viables',
        container: 'bg-gradient-to-r from-rose-50 to-amber-50 border-rose-200',
        iconBg: 'bg-rose-100',
        iconColor: 'text-rose-600',
        titleColor: 'text-rose-900',
        textColor: 'text-rose-800',
        icon: AlertTriangle,
      };
    case 'investigar_mas':
    default:
      return {
        label: 'INVESTIGAR MÁS · datos insuficientes',
        container: 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        titleColor: 'text-amber-900',
        textColor: 'text-amber-800',
        icon: Search,
      };
  }
}
