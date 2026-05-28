/**
 * EstadosCanon · F10.F.1.O · 2026-05-27
 *
 * Componentes canon para empty/loading/error states del perfil.
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 16 (líneas 1527-1581).
 *
 * 3 componentes:
 *   - EmptyStateCanon · icon + título + descripción + acciones opcionales
 *   - LoadingSkeletonCard · skeleton pulse para cards genéricas
 *   - ErrorStateCanon · error con CTA retry
 *
 * Canon v8.0 N9 · quick-start cards en empty con CTAs accionables
 */
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════

interface EmptyAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: 'primary' | 'outline';
}

interface EmptyProps {
  /** Icon lucide grande · 6x6 dentro de container 12x12 */
  icon: LucideIcon;
  /** Tono del icon container · default 'sky' */
  tone?: 'sky' | 'emerald' | 'amber' | 'rose' | 'slate' | 'violet';
  /** Título · text-[14px] font-bold */
  titulo: string;
  /** Descripción · text-[12px] text-slate-600 */
  descripcion: string;
  /** Acciones canon N9 quick-start · hasta 2 */
  acciones?: EmptyAction[];
  /** Variante compacta (sin descripción larga) */
  compacto?: boolean;
}

const EMPTY_TONE_CLASSES: Record<NonNullable<EmptyProps['tone']>, { bg: string; text: string }> = {
  sky: { bg: 'bg-sky-100', text: 'text-sky-700' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-700' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-700' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-700' },
};

export const EmptyStateCanon: React.FC<EmptyProps> = ({
  icon: Icon,
  tone = 'sky',
  titulo,
  descripcion,
  acciones,
  compacto = false,
}) => {
  const c = EMPTY_TONE_CLASSES[tone];

  return (
    // Canon mockup ACTO 16 · línea 1564 · copy-paste literal
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-6 text-center">
      <div className="max-w-md mx-auto">
        <div className={`${compacto ? 'w-12 h-12' : 'w-14 h-14'} mx-auto ${c.bg} rounded-2xl flex items-center justify-center mb-3`}>
          <Icon className={`${compacto ? 'w-6 h-6' : 'w-7 h-7'} ${c.text}`} />
        </div>
        <div className={`${compacto ? 'text-[12px]' : 'text-[14px]'} font-bold text-slate-900 mb-1`}>
          {titulo}
        </div>
        <p className={`${compacto ? 'text-[11px]' : 'text-[12px]'} text-slate-600 mb-4`}>
          {descripcion}
        </p>
        {acciones && acciones.length > 0 && (
          <div className={`grid ${acciones.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-2 max-w-xs mx-auto`}>
            {acciones.map((a, idx) => {
              const ActionIcon = a.icon;
              const variant = a.variant ?? (idx === 0 && acciones.length > 1 ? 'outline' : 'primary');
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={a.onClick}
                  className={
                    variant === 'primary'
                      ? `${c.bg.replace('100', '600')} hover:opacity-90 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg inline-flex items-center justify-center gap-1`
                      : `bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-[11px] font-bold px-3 py-1.5 rounded-lg inline-flex items-center justify-center gap-1`
                  }
                >
                  {ActionIcon && <ActionIcon className="w-3 h-3" />}
                  {a.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// LOADING SKELETON · 4 variantes
// ═══════════════════════════════════════════════════════════════════════

interface SkeletonProps {
  /** Variante del skeleton · default 'card' */
  variant?: 'card' | 'table' | 'timeline' | 'kpi-strip';
  /** Cantidad de rows/items · default 3 */
  rows?: number;
}

export const LoadingSkeletonCanon: React.FC<SkeletonProps> = ({ variant = 'card', rows = 3 }) => {
  if (variant === 'kpi-strip') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-slate-200 rounded-2xl animate-pulse" style={{ height: '88px' }}></div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="h-10 bg-slate-100 border-b border-slate-200 animate-pulse"></div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-200 animate-pulse"></div>
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-slate-200 rounded w-3/4 animate-pulse"></div>
              <div className="h-2.5 bg-slate-100 rounded w-1/2 animate-pulse"></div>
            </div>
            <div className="w-16 h-4 bg-slate-200 rounded animate-pulse"></div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'timeline') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
            <div className="w-9 h-9 rounded-lg bg-slate-200 animate-pulse flex-shrink-0"></div>
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-slate-200 rounded w-2/3 animate-pulse"></div>
              <div className="h-2.5 bg-slate-100 rounded w-full animate-pulse"></div>
              <div className="h-2 bg-slate-100 rounded w-1/4 animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default · 'card' · canon mockup ACTO 16 línea 1538
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-5">
      <div className="space-y-3">
        <div className="h-6 bg-slate-200 rounded animate-pulse"></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-16 bg-slate-200 rounded-2xl animate-pulse"></div>
          <div className="h-16 bg-slate-200 rounded-2xl animate-pulse"></div>
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-200 rounded animate-pulse"></div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// ERROR STATE
// ═══════════════════════════════════════════════════════════════════════

interface ErrorProps {
  /** Título del error · default genérico */
  titulo?: string;
  /** Descripción del error · default genérico */
  descripcion?: string;
  /** Callback de retry · si NO se pasa · no hay botón */
  onRetry?: () => void;
  /** Label del botón retry · default "Reintentar" */
  retryLabel?: string;
  /** Si está reintentando · disable + spinner */
  retrying?: boolean;
}

export const ErrorStateCanon: React.FC<ErrorProps> = ({
  titulo = 'Error cargando tu información',
  descripcion = 'No pudimos cargar los datos. Intentalo otra vez.',
  onRetry,
  retryLabel = 'Reintentar',
  retrying = false,
}) => {
  return (
    // Canon mockup ACTO 16 · línea 1550 · copy-paste literal
    <div className="bg-white rounded-2xl ring-1 ring-rose-200 p-5 text-center">
      <div className="w-12 h-12 mx-auto bg-rose-100 rounded-xl flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6 text-rose-700" />
      </div>
      <div className="text-[12px] font-bold text-slate-900 mb-1">{titulo}</div>
      <p className="text-[11px] text-slate-500 mb-3">{descripcion}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
        >
          {retrying ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          {retrying ? 'Reintentando...' : retryLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyStateCanon;
