/**
 * TabCompetencia · Sub-vista del Modal Investigación Completo
 *
 * Mockup canónico: docs/mockups/productos/26-investigacion-tab-competencia.html
 *
 * Tabla de competidores en el mercado con barras comparativas + tendencia 30d + stock.
 * Banner de posicionamiento + 4 KPIs footer (promedio · más barato · más caro · tu posición).
 */

import React, { useState } from 'react';
import {
  Search as SearchIcon,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus as TrendingFlat,
} from 'lucide-react';
import type { CompetidorInvestigacion } from './types';

interface TabCompetenciaProps {
  competidores: CompetidorInvestigacion[];      // Incluye fila "TÚ"
  tuPrecioPEN: number;
  onAgregarCompetidor?: (nombre: string) => void;
  /** Click en fila o botón Editar abre el modal de edición */
  onEditarCompetidor?: (competidorId: string) => void;
}

const COLOR_BAR: Record<NonNullable<CompetidorInvestigacion['colorAvatar']>, string> = {
  emerald: 'bg-emerald-500',
  indigo: 'bg-indigo-400',
  rose: 'bg-rose-400',
  purple: 'bg-purple-400',
  amber: 'bg-amber-500',
  slate: 'bg-slate-400',
};

const COLOR_AVATAR: Record<NonNullable<CompetidorInvestigacion['colorAvatar']>, string> = {
  emerald: 'bg-emerald-100 text-emerald-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  rose: 'bg-rose-100 text-rose-700',
  purple: 'bg-purple-100 text-purple-700',
  amber: 'bg-amber-100 text-amber-800',
  slate: 'bg-slate-100 text-slate-700',
};

function TendenciaIcon({
  t,
  pct,
}: {
  t: CompetidorInvestigacion['tendencia30d'];
  pct?: number;
}) {
  if (t === 'sube') {
    return (
      <span className="text-[11px] text-amber-600 font-bold flex items-center gap-1">
        <TrendingUp className="w-3 h-3" />+{pct?.toFixed(0) ?? '?'}% (subió)
      </span>
    );
  }
  if (t === 'baja') {
    return (
      <span className="text-[11px] text-rose-600 font-bold flex items-center gap-1">
        <TrendingDown className="w-3 h-3" />-{pct?.toFixed(0) ?? '?'}% (bajó)
      </span>
    );
  }
  return (
    <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
      <TrendingFlat className="w-3 h-3" />
      Estable
    </span>
  );
}

export function TabCompetencia({
  competidores,
  tuPrecioPEN,
  onAgregarCompetidor,
  onEditarCompetidor,
}: TabCompetenciaProps) {
  const [busqueda, setBusqueda] = useState('');

  // Stats footer
  const externos = competidores.filter((c) => !c.esTu);
  const total = externos.length + 1; // tú incluido
  const precios = externos.map((c) => c.precioPEN);
  const promedio = precios.length
    ? Math.round(precios.reduce((a, b) => a + b, 0) / precios.length)
    : tuPrecioPEN;
  const masBarato = precios.length ? Math.min(...precios) : tuPrecioPEN;
  const masCaro = precios.length ? Math.max(...precios) : tuPrecioPEN;
  const ordenados = [...externos.map((c) => c.precioPEN), tuPrecioPEN].sort((a, b) => a - b);
  const tuPosicion = ordenados.indexOf(tuPrecioPEN) + 1;
  const variacionVsPromedio = (((tuPrecioPEN - promedio) / promedio) * 100).toFixed(0);
  const tuPosicionTexto = Number(variacionVsPromedio) < 0 ? 'por debajo' : 'por encima';

  return (
    <div className="space-y-4">
      {/* Header tab */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            {externos.length} competidor{externos.length === 1 ? '' : 'es'} en el mercado
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Comparativa de precio, márgenes estimados y participación de mercado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Agregar competidor..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-44 lg:w-48 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          <button
            onClick={() => {
              if (busqueda.trim()) {
                onAgregarCompetidor?.(busqueda.trim());
                setBusqueda('');
              }
            }}
            className="px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar
          </button>
        </div>
      </div>

      {/* Banner posicionamiento */}
      <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-amber-900">Tu posición en el mercado</div>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Tu precio actual <strong>S/ {tuPrecioPEN.toFixed(0)}</strong> está{' '}
              <strong>
                {Math.abs(Number(variacionVsPromedio))}% {tuPosicionTexto} del promedio del mercado
              </strong>{' '}
              (S/ {promedio}). Margen sano · oportunidad de subir.
            </p>
          </div>
          <span className="text-[10px] font-bold text-amber-700 px-2 py-1 rounded bg-white border border-amber-200 flex-shrink-0">
            {tuPosicion === 1 ? '1ro más barato' : `${tuPosicion}do más barato`}
          </span>
        </div>
      </div>

      {/* Tabla competidores · DESKTOP */}
      <div className="hidden lg:block border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          <div className="col-span-4">Competidor</div>
          <div className="col-span-2 text-right">Precio (S/)</div>
          <div className="col-span-3">vs. tu precio</div>
          <div className="col-span-2">Tendencia 30d</div>
          <div className="col-span-1 text-right">Stock</div>
        </div>
        {competidores.map((c) => {
          const color = c.colorAvatar ?? 'slate';
          const ratio = c.porcentajeVsTuPrecio ?? Math.round((c.precioPEN / tuPrecioPEN) * 100);
          const barWidth = Math.min(95, Math.max(20, ratio * 0.85));
          return (
            <div
              key={c.id}
              onClick={() => {
                if (!c.esTu && onEditarCompetidor) onEditarCompetidor(c.id);
              }}
              className={`grid grid-cols-12 gap-3 items-center px-4 py-3 border-b last:border-b-0 transition-colors ${
                c.esTu
                  ? 'bg-amber-50 border-amber-200'
                  : `border-slate-100 hover:bg-slate-50 ${onEditarCompetidor ? 'cursor-pointer' : ''}`
              }`}
            >
              <div className="col-span-4 flex items-center gap-2 min-w-0">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                    c.esTu ? 'bg-amber-200 text-amber-800' : COLOR_AVATAR[color]
                  }`}
                >
                  {c.iniciales}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{c.nombre}</div>
                  <div className="text-[10px] text-slate-600 truncate">
                    {c.esTu ? 'Tu precio actual' : c.url ?? c.ubicacion ?? ''}
                  </div>
                </div>
              </div>
              <div className="col-span-2 text-right">
                <div
                  className={`text-base font-bold tabular-nums ${
                    !c.esTu &&
                    c.variacionPct !== undefined &&
                    c.variacionPct < 0
                      ? 'text-emerald-700'
                      : 'text-slate-900'
                  }`}
                >
                  S/ {c.precioPEN.toFixed(0)}
                </div>
                {!c.esTu && c.variacionPct !== undefined && (
                  <div
                    className={`text-[10px] ${
                      c.variacionPct < 0 ? 'text-emerald-600' : 'text-rose-500'
                    }`}
                  >
                    {c.variacionPct >= 0 ? '+' : ''}
                    {c.variacionPct.toFixed(1)}%
                  </div>
                )}
              </div>
              <div className="col-span-3">
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${c.esTu ? 'bg-amber-500' : COLOR_BAR[color]}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {c.esTu ? 'Referencia (100% = tu precio)' : `${ratio}% de tu precio`}
                </div>
              </div>
              <div className="col-span-2">
                <TendenciaIcon t={c.tendencia30d} pct={c.variacionTendenciaPct} />
              </div>
              <div className="col-span-1 text-right text-[11px] tabular-nums text-slate-700">
                {c.stock !== undefined ? (
                  <span className={c.esTu ? 'font-bold' : ''}>{c.stock}</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cards · MOBILE (F12) */}
      <div className="lg:hidden space-y-2">
        {competidores.map((c) => {
          const color = c.colorAvatar ?? 'slate';
          const ratio = c.porcentajeVsTuPrecio ?? Math.round((c.precioPEN / tuPrecioPEN) * 100);
          const barWidth = Math.min(95, Math.max(20, ratio * 0.85));
          return (
            <div
              key={c.id}
              onClick={() => {
                if (!c.esTu && onEditarCompetidor) onEditarCompetidor(c.id);
              }}
              className={`rounded-xl border p-3 ${
                c.esTu
                  ? 'bg-amber-50 border-amber-200'
                  : `bg-white border-slate-200 ${onEditarCompetidor ? 'cursor-pointer hover:border-amber-300' : ''}`
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                    c.esTu ? 'bg-amber-200 text-amber-800' : COLOR_AVATAR[color]
                  }`}
                >
                  {c.iniciales}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{c.nombre}</div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {c.esTu ? 'Tu precio actual' : c.url ?? c.ubicacion ?? ''}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-base font-bold tabular-nums ${
                      !c.esTu &&
                      c.variacionPct !== undefined &&
                      c.variacionPct < 0
                        ? 'text-emerald-700'
                        : 'text-slate-900'
                    }`}
                  >
                    S/ {c.precioPEN.toFixed(0)}
                  </div>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${c.esTu ? 'bg-amber-500' : COLOR_BAR[color]}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-[11px]">
                <span className="text-slate-500">
                  {c.esTu ? 'Referencia' : `${ratio}% de tu precio`}
                </span>
                <TendenciaIcon t={c.tendencia30d} pct={c.variacionTendenciaPct} />
              </div>
              {c.stock !== undefined && (
                <div className="text-[10px] text-slate-500 mt-1">
                  Stock: <span className="font-bold tabular-nums">{c.stock}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer · 4 KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
            Promedio mercado
          </div>
          <div className="text-lg font-bold text-slate-900 tabular-nums">S/ {promedio}</div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold">
            Más barato
          </div>
          <div className="text-lg font-bold text-emerald-700 tabular-nums">S/ {masBarato}</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-amber-600 font-bold">
            Más caro
          </div>
          <div className="text-lg font-bold text-amber-700 tabular-nums">S/ {masCaro}</div>
        </div>
        <div className="bg-indigo-50 rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-indigo-600 font-bold">
            Tu posición
          </div>
          <div className="text-lg font-bold text-indigo-700 tabular-nums">
            {tuPosicion} / {total}
          </div>
        </div>
      </div>
    </div>
  );
}
