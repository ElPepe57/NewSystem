/**
 * SugerenciasDelDiaModal · Modal grande · Tool #36 · F6(A)
 *
 * Mockup canónico: docs/mockups/productos/36-tool-sugerencias-del-dia.html
 *
 * Centro de decisiones diario · 3 columnas (Urgente · Vigilar · Oportunidades)
 * Reduce análisis manual a 30s/día.
 *
 * Trigger: header del listado V2 botón "💡 Sugerencias del día" o footer del
 * Productos Intel #30.
 */

import React, { useEffect, useMemo } from 'react';
import {
  X,
  Lightbulb,
  Settings2,
  CheckCheck,
  Clock,
  BellOff,
  AlertTriangle,
  AlertCircle,
  ZapOff,
  TrendingDown,
  TrendingUp,
  PackageX,
  Globe,
  Search as SearchIcon,
  Package2,
  Sparkles,
  Link2,
} from 'lucide-react';
import type { SugerenciaDelDia, CategoriaSugerencia, IconoSugerencia } from './types';

interface SugerenciasDelDiaModalProps {
  open: boolean;
  sugerencias: SugerenciaDelDia[];
  fecha?: string;                    // "2 mayo 2026"
  ultimaActualizacion?: string;      // "06:00"
  onClose: () => void;
  onConfigurar?: () => void;
  onEjecutarTodasUrgentes?: () => void;
  onPausarNotificaciones?: () => void;
  onClickSugerencia?: (s: SugerenciaDelDia) => void;
}

const ICONO_MAP: Record<IconoSugerencia, typeof AlertTriangle> = {
  'zap-off': ZapOff,
  'alert-circle': AlertCircle,
  'alert-triangle': AlertTriangle,
  'trending-down': TrendingDown,
  'trending-up': TrendingUp,
  'package-x': PackageX,
  globe: Globe,
  search: SearchIcon,
  'package-2': Package2,
  sparkles: Sparkles,
  'link-2': Link2,
};

const COLOR_CATEGORIA: Record<
  CategoriaSugerencia,
  {
    bg: string;
    bgHeader: string;
    dotColor: string;
    title: string;
    badgeText: string;
    iconColor: string;
    pulse?: boolean;
  }
> = {
  urgente: {
    bg: 'bg-rose-50/30',
    bgHeader: 'bg-rose-50/80',
    dotColor: 'bg-rose-500',
    title: 'text-rose-900',
    badgeText: 'text-rose-700',
    iconColor: 'text-rose-700',
    pulse: true,
  },
  vigilar: {
    bg: 'bg-amber-50/30',
    bgHeader: 'bg-amber-50/80',
    dotColor: 'bg-amber-500',
    title: 'text-amber-900',
    badgeText: 'text-amber-700',
    iconColor: 'text-amber-700',
  },
  oportunidad: {
    bg: 'bg-emerald-50/30',
    bgHeader: 'bg-emerald-50/80',
    dotColor: 'bg-emerald-500',
    title: 'text-emerald-900',
    badgeText: 'text-emerald-700',
    iconColor: 'text-emerald-700',
  },
};

const COLOR_METRICA: Record<NonNullable<SugerenciaDelDia['metricaColor']>, string> = {
  rose: 'text-rose-600',
  amber: 'text-amber-700',
  emerald: 'text-emerald-600',
  purple: 'text-purple-600',
};

export function SugerenciasDelDiaModal({
  open,
  sugerencias,
  fecha,
  ultimaActualizacion,
  onClose,
  onConfigurar,
  onEjecutarTodasUrgentes,
  onPausarNotificaciones,
  onClickSugerencia,
}: SugerenciasDelDiaModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const categorias = useMemo(() => {
    const urgente = sugerencias.filter((s) => s.categoria === 'urgente');
    const vigilar = sugerencias.filter((s) => s.categoria === 'vigilar');
    const oportunidad = sugerencias.filter((s) => s.categoria === 'oportunidad');
    return { urgente, vigilar, oportunidad };
  }, [sugerencias]);

  if (!open) return null;

  const fechaLabel =
    fecha ?? new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="bg-gradient-to-br from-indigo-50 via-white to-white border-b border-indigo-200 px-4 lg:px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-6 h-6 text-indigo-700" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <h2 className="text-lg lg:text-xl font-bold text-slate-900">Sugerencias del día</h2>
                  <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-bold tabular-nums">
                    {sugerencias.length} accion{sugerencias.length === 1 ? '' : 'es'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {fechaLabel} · revisión 30 segundos · agrupadas por urgencia
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {onConfigurar && (
                <button
                  onClick={onConfigurar}
                  className="hidden sm:flex px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-md items-center gap-1.5 transition-colors"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Configurar
                </button>
              )}
              {categorias.urgente.length > 0 && (
                <button
                  onClick={onEjecutarTodasUrgentes}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ejecutar todas las urgentes</span>
                  <span className="sm:hidden">Ejec. urgentes</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* BODY · 3 columnas (lg) o stacked (mobile) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:divide-x divide-slate-200 flex-1 overflow-hidden">
          <Columna
            categoria="urgente"
            label="Urgente"
            sugerencias={categorias.urgente}
            onClickSugerencia={onClickSugerencia}
          />
          <Columna
            categoria="vigilar"
            label="Vigilar"
            sugerencias={categorias.vigilar}
            onClickSugerencia={onClickSugerencia}
          />
          <Columna
            categoria="oportunidad"
            label="Oportunidades"
            sugerencias={categorias.oportunidad}
            onClickSugerencia={onClickSugerencia}
          />
        </div>

        {/* FOOTER */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 lg:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>
              Recalculado {fechaLabel}
              {ultimaActualizacion && ` · ${ultimaActualizacion}`} · próxima actualización mañana
              06:00
            </span>
          </div>
          <div className="flex items-center gap-2 justify-end">
            {onPausarNotificaciones && (
              <button
                onClick={onPausarNotificaciones}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1.5"
              >
                <BellOff className="w-3.5 h-3.5" />
                Pausar notificaciones
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componente: Columna ────────────────────────────────────────────────
function Columna({
  categoria,
  label,
  sugerencias,
  onClickSugerencia,
}: {
  categoria: CategoriaSugerencia;
  label: string;
  sugerencias: SugerenciaDelDia[];
  onClickSugerencia?: (s: SugerenciaDelDia) => void;
}) {
  const cfg = COLOR_CATEGORIA[categoria];

  return (
    <div className={`p-4 ${cfg.bg} overflow-y-auto max-h-[440px] lg:max-h-[560px]`}>
      <div
        className={`flex items-center justify-between mb-3 sticky top-0 ${cfg.bgHeader} backdrop-blur -mx-4 px-4 py-2 z-10`}
      >
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${cfg.dotColor} ${cfg.pulse ? 'animate-pulse' : ''}`}
          />
          <h3 className={`text-xs font-bold uppercase tracking-wider ${cfg.title}`}>{label}</h3>
          <span className={`text-[10px] font-bold bg-white px-1.5 py-0.5 rounded ${cfg.badgeText}`}>
            {sugerencias.length}
          </span>
        </div>
        {sugerencias.length > 0 && (
          <button className={`text-[10px] font-bold ${cfg.badgeText} hover:opacity-80`}>
            {categoria === 'urgente' ? `Ejecutar ${sugerencias.length}` : `Ver ${sugerencias.length}`} →
          </button>
        )}
      </div>

      {sugerencias.length === 0 ? (
        <div className="text-center py-8 text-[11px] text-slate-400 italic">
          Sin sugerencias en esta categoría hoy.
        </div>
      ) : (
        <div className="space-y-2">
          {sugerencias.map((s) => (
            <SugerenciaCard
              key={s.id}
              sugerencia={s}
              onClick={() => onClickSugerencia?.(s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-componente: SugerenciaCard ─────────────────────────────────────────
function SugerenciaCard({
  sugerencia,
  onClick,
}: {
  sugerencia: SugerenciaDelDia;
  onClick?: () => void;
}) {
  const Icon = ICONO_MAP[sugerencia.icono];
  const cfg = COLOR_CATEGORIA[sugerencia.categoria];
  const borderClass = sugerencia.borderHighlight === 'purple' ? 'border-l-2 border-l-purple-400' : '';
  const metricaColor = sugerencia.metricaColor ? COLOR_METRICA[sugerencia.metricaColor] : 'text-slate-600';

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200 rounded-lg p-2.5 transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 ${borderClass}`}
    >
      <div className="flex items-start gap-2">
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${cfg.iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-slate-900">{sugerencia.titulo}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{sugerencia.descripcion}</div>
          {sugerencia.esLinkado && (
            <div className="text-[9px] text-purple-600 mt-1 font-semibold">
              ↗ Abre flujo del banner
            </div>
          )}
        </div>
      </div>
      {sugerencia.metricaLabel && sugerencia.metricaValor && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
          <span className="text-[10px] text-slate-500">{sugerencia.metricaLabel}</span>
          <span className={`text-[11px] font-bold tabular-nums ${metricaColor}`}>
            {sugerencia.metricaValor}
          </span>
        </div>
      )}
    </div>
  );
}
