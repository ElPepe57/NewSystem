/**
 * SugerenciasVariantesBanner · Tool #32
 *
 * Mockup canónico: docs/mockups/productos/32-tool-sugerencia-variantes-banner.html
 *
 * Banner inteligente con detección IA de productos similares.
 * Aparece en cabecera del listado V2 cuando hay grupos detectados.
 *
 * Variantes:
 *   1. Banner inline grande (cabecera del listado)
 *   2. Modal de revisión (3 grupos con confianza alta/media/baja)
 *   3. Compacto en card individual (tooltip lateral · DIFERIDO)
 */

import React, { useEffect } from 'react';
import {
  X,
  Sparkles,
  BrainCircuit,
  Eye,
  Settings2,
  CheckCircle2,
  Check,
  AlertTriangle,
  HelpCircle,
  Info,
  Droplets,
  Flower,
  Pill,
} from 'lucide-react';
import type { GrupoSugerido, ConfianzaGrupo } from './types';

interface SugerenciasVariantesBannerProps {
  open: boolean;            // Banner visible
  grupos: GrupoSugerido[];
  onRevisar: () => void;    // Abre modal de revisión
  onDescartarTodas: () => void;
}

interface SugerenciasVariantesModalProps {
  open: boolean;
  grupos: GrupoSugerido[];
  onClose: () => void;
  onAplicar: (grupoId: string) => void;
  onDescartar: (grupoId: string) => void;
  onAplicarTodos: () => void;
  onConfigurar?: () => void;
}

const ICONO_PRODUCTO: Record<NonNullable<import('./types').ProductoSugerido['icono']>, typeof Droplets> = {
  droplets: Droplets,
  flower: Flower,
  pill: Pill,
};

const COLOR_PRODUCTO: Record<NonNullable<import('./types').ProductoSugerido['iconoColor']>, string> = {
  amber: 'text-amber-700',
  rose: 'text-rose-700',
  indigo: 'text-indigo-700',
};

// ─── BANNER INLINE ─────────────────────────────────────────────────────────
export function SugerenciasVariantesBanner({
  open,
  grupos,
  onRevisar,
  onDescartarTodas,
}: SugerenciasVariantesBannerProps) {
  if (!open || grupos.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 via-fuchsia-50/30 to-white p-4">
      <div className="flex items-start gap-3 flex-col sm:flex-row">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white flex items-center justify-center flex-shrink-0 shadow-md">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-purple-700 font-bold flex items-center gap-1">
              <BrainCircuit className="w-3 h-3" />
              IA · Detección inteligente
            </span>
            <span className="px-1.5 py-0.5 rounded bg-purple-600 text-white text-[10px] font-bold">
              {grupos.length} grupo{grupos.length === 1 ? '' : 's'}
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            Detectamos productos que podrían agruparse como variantes
          </h3>
          <p className="text-[11px] text-slate-700 mt-0.5">
            Encontramos <strong>{grupos.length} grupos de productos similares</strong> que
            actualmente están como SKUs separados. Agruparlos como variantes del mismo producto base
            mejora reportes, búsqueda y mantenimiento del catálogo.
          </p>
        </div>
        <div className="flex flex-row sm:flex-col items-stretch sm:items-end gap-1.5 flex-shrink-0 w-full sm:w-auto">
          <button
            onClick={onRevisar}
            className="px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm flex items-center gap-1.5 justify-center transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Revisar sugerencias
          </button>
          <button
            onClick={onDescartarTodas}
            className="text-[10px] font-medium text-slate-500 hover:text-slate-700 underline"
          >
            Descartar todas
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL DE REVISIÓN ──────────────────────────────────────────────────────
const COLOR_CONFIANZA: Record<
  ConfianzaGrupo,
  {
    border: string;
    bgCard: string;
    bgHeader: string;
    borderHeader: string;
    chipBg: string;
    iconBg: string;
    iconColor: string;
    titleColor: string;
    descColor: string;
    btnLabel: string;
    btnCls: string;
    HeaderIcon: typeof Check;
  }
> = {
  alta: {
    border: 'border-2 border-emerald-300',
    bgCard: 'bg-emerald-50/40',
    bgHeader: 'bg-emerald-50',
    borderHeader: 'border-emerald-200',
    chipBg: 'bg-emerald-600 text-white',
    iconBg: 'bg-emerald-600',
    iconColor: 'text-white',
    titleColor: 'text-emerald-900',
    descColor: 'text-emerald-700',
    btnLabel: 'Aplicar',
    btnCls: 'text-white bg-emerald-600 hover:bg-emerald-700',
    HeaderIcon: Check,
  },
  media: {
    border: 'border-2 border-amber-300',
    bgCard: 'bg-amber-50/40',
    bgHeader: 'bg-amber-50',
    borderHeader: 'border-amber-200',
    chipBg: 'bg-amber-600 text-white',
    iconBg: 'bg-amber-600',
    iconColor: 'text-white',
    titleColor: 'text-amber-900',
    descColor: 'text-amber-700',
    btnLabel: 'Revisar',
    btnCls: 'text-amber-800 bg-white hover:bg-amber-100 border border-amber-300',
    HeaderIcon: AlertTriangle,
  },
  baja: {
    border: 'border border-slate-200',
    bgCard: 'bg-white',
    bgHeader: 'bg-slate-50',
    borderHeader: 'border-slate-200',
    chipBg: 'bg-slate-300 text-slate-700',
    iconBg: 'bg-slate-200',
    iconColor: 'text-slate-600',
    titleColor: 'text-slate-700',
    descColor: 'text-slate-500',
    btnLabel: 'Descartar',
    btnCls: 'text-slate-600 bg-white hover:bg-slate-100 border border-slate-200',
    HeaderIcon: HelpCircle,
  },
};

export function SugerenciasVariantesModal({
  open,
  grupos,
  onClose,
  onAplicar,
  onDescartar,
  onAplicarTodos,
  onConfigurar,
}: SugerenciasVariantesModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const altaConfianza = grupos.filter((g) => g.confianza === 'alta').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 px-4 lg:px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-100 to-fuchsia-200 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-purple-700" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900">Sugerencias de agrupación</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {grupos.length} grupo{grupos.length === 1 ? '' : 's'} detectado
                  {grupos.length === 1 ? '' : 's'} · revisa y acepta los que apliquen
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {onConfigurar && (
                <button
                  onClick={onConfigurar}
                  className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"
                  title="Configurar detección"
                >
                  <Settings2 className="w-4 h-4" />
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

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-5 space-y-4">
          {grupos.map((g) => {
            const cfg = COLOR_CONFIANZA[g.confianza];
            const HeaderIconCmp = cfg.HeaderIcon;
            return (
              <div key={g.id} className={`rounded-xl ${cfg.border} ${cfg.bgCard} overflow-hidden`}>
                {/* Header del grupo */}
                <div
                  className={`px-4 py-3 ${cfg.bgHeader} border-b ${cfg.borderHeader} flex items-center gap-3 flex-wrap sm:flex-nowrap`}
                >
                  <div className={`w-8 h-8 rounded-lg ${cfg.iconBg} ${cfg.iconColor} flex items-center justify-center flex-shrink-0`}>
                    <HeaderIconCmp className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-bold ${cfg.titleColor}`}>{g.nombreBase}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${cfg.chipBg}`}>
                        {g.matchPct}% match
                      </span>
                    </div>
                    <div className={`text-[10px] mt-0.5 ${cfg.descColor}`}>{g.descripcion}</div>
                  </div>
                  <button
                    onClick={() =>
                      g.confianza === 'baja' ? onDescartar(g.id) : onAplicar(g.id)
                    }
                    className={`px-2.5 py-1 text-[11px] font-bold rounded transition-colors ${cfg.btnCls}`}
                  >
                    {cfg.btnLabel}
                  </button>
                </div>

                {/* Productos del grupo (no se renderiza cuando confianza baja) */}
                {g.confianza !== 'baja' && g.productos.length > 0 && (
                  <div className="bg-white p-3 space-y-1.5">
                    {g.productos.map((prod, i) => {
                      const Icon = prod.icono ? ICONO_PRODUCTO[prod.icono] : Droplets;
                      const iconColor = prod.iconoColor
                        ? COLOR_PRODUCTO[prod.iconoColor]
                        : 'text-slate-500';
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded"
                        >
                          <Icon className={`w-4 h-4 ${iconColor}`} />
                          <span className="text-xs text-slate-700 flex-1 truncate">
                            <span className="font-mono text-slate-500">{prod.sku}</span> · {prod.nombre}
                          </span>
                          {prod.detalle && (
                            <span
                              className={`text-[10px] tabular-nums whitespace-nowrap ${
                                prod.detalleColor === 'amber'
                                  ? 'text-amber-700 font-bold'
                                  : 'text-slate-500'
                              }`}
                            >
                              {prod.detalle}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 lg:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
            <Info className="w-3 h-3" />
            <span>Las sugerencias se generan analizando nombres, marcas, categorías y atributos.</span>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Recordar después
            </button>
            <button
              onClick={onAplicarTodos}
              disabled={altaConfianza === 0}
              className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Aplicar {altaConfianza} grupo{altaConfianza === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
