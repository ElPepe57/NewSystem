import React, { useState } from 'react';
import { ArrowRight, ChevronRight, Check, Copy } from 'lucide-react';
import { cn } from '../utils';

/**
 * RouteCardV2 — Tarjeta de ruta unificada para OC y Envíos.
 *
 * Patrón visual aprobado S54 (mockup V2): pill de modalidad arriba +
 * 2 o 3 nodos grandes con fechas/estados inline.
 *
 * - 2 nodos (default): separador con líneas punteadas y arrow-right centrado.
 * - 3 nodos (cuando hay `intermedio`): separador con chevron-right simple.
 *
 * Reemplaza:
 *   - `NodoRuta` + `RutaGrande` locales de EnvioDetailModal
 *   - (nuevo) visualización de ruta en OrdenCompraCard
 */

// ─────────────────────────────────────────────────────────────────────────────

export type RouteNodeBadgeVariant = 'emerald' | 'sky' | 'amber' | 'slate';

export interface RouteCardV2Node {
  /** Emoji bandera. Si no se provee, usar `icon`. */
  flag?: string;
  /** Ícono custom que reemplaza al flag (ej: ícono cliente, almacén). */
  icon?: React.ReactNode;
  /** Nombre principal del nodo (ej: "Asian Beauty Wholesale"). */
  nombre: string;
  /** Línea secundaria (ej: "Proveedor · China"). */
  subtitulo?: string;
  /** Badge de estado del nodo (ej: "Despachado 12-abr."). */
  badge?: {
    label: string;
    variant: RouteNodeBadgeVariant;
  };
}

export type RouteCardV2PillVariant = 'sky' | 'amber' | 'slate' | 'emerald';

export interface RouteCardV2Pill {
  /** Texto principal (ej: "Vía courier · DHL Express"). */
  text: string;
  /** Ícono opcional al inicio de la pill. */
  icon?: React.ReactNode;
  /** Color de la pill (sky = transportador confirmado, amber = viajero/traslado interno, slate = sin asignar). */
  variant?: RouteCardV2PillVariant;
  /** Extras tipo costo/referencia como textos secundarios separados por "·". */
  extras?: string[];
  /** Número de tracking: se renderiza como segmento clickable copiable al final de la pill. */
  tracking?: string;
}

export type RouteCardV2PipelineStepStatus = 'completed' | 'current' | 'pending' | 'skipped';

export interface RouteCardV2PipelineStep {
  /** Etiqueta del paso (ej: "Borrador", "Compra física", "Completada"). */
  label: string;
  /** Texto de fecha/hora (ya formateado, ej: "23 abr · 09:14" o "—"). */
  fecha?: string;
  /** Estado del paso. */
  status: RouteCardV2PipelineStepStatus;
}

export interface RouteCardV2Pipeline {
  steps: RouteCardV2PipelineStep[];
  /** Texto opcional a la derecha del divider "PROGRESO" (ej: "Creada 23 abr · Completada 23 abr"). */
  meta?: string;
}

export interface RouteCardV2Props {
  /** Pill superior con modalidad + transportador + tracking. Si se omite, se muestra "Sin transportador asignado". */
  pill?: RouteCardV2Pill;
  /** Nodo de origen. */
  origen: RouteCardV2Node;
  /** Nodo intermedio opcional (ej: casilla intermedia real en envío tipo C). */
  intermedio?: RouteCardV2Node;
  /** Nodo de destino. */
  destino: RouteCardV2Node;
  /** Pipeline de estados del ciclo de vida (opcional). Se renderiza como footer
      unificado dentro de la misma tarjeta (diseño V-C · S54). */
  pipeline?: RouteCardV2Pipeline;
  /** Tono de fondo especial (ej: amber para "Recojo en origen"). */
  toneBg?: 'default' | 'amber';
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

const PILL_VARIANTS: Record<RouteCardV2PillVariant, string> = {
  sky: 'bg-sky-100 text-sky-700 border-sky-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const PILL_DIVIDER_COLOR: Record<RouteCardV2PillVariant, string> = {
  sky: 'text-sky-300',
  amber: 'text-amber-400',
  slate: 'text-slate-400',
  emerald: 'text-emerald-400',
};

const BADGE_VARIANTS: Record<RouteNodeBadgeVariant, string> = {
  emerald: 'bg-emerald-100 text-emerald-700',
  sky: 'bg-sky-100 text-sky-700',
  amber: 'bg-amber-100 text-amber-800',
  slate: 'bg-slate-100 text-slate-600',
};

const BG_TONES: Record<'default' | 'amber', string> = {
  default: 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
  amber: 'bg-gradient-to-br from-amber-50 to-white border-amber-200',
};

// ─────────────────────────────────────────────────────────────────────────────

export const RouteCardV2: React.FC<RouteCardV2Props> = ({
  pill,
  origen,
  intermedio,
  destino,
  pipeline,
  toneBg = 'default',
  className,
}) => {
  const tieneIntermedio = !!intermedio;
  const tienePipeline = !!pipeline && pipeline.steps.length > 0;

  // Cuando hay pipeline, la tarjeta actúa como contenedor con secciones
  // internas (V-C · S54): ruta arriba + divider + pipeline abajo. Sin
  // pipeline, conserva el padding tradicional.
  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden',
        BG_TONES[toneBg],
        className
      )}
    >
      {/* Sección: ruta (pill + nodos) */}
      <div className="p-4">
        <PillRow pill={pill} />

        <div
          className={cn(
            'flex items-stretch',
            tieneIntermedio ? 'gap-2' : 'gap-3'
          )}
        >
          <Nodo nodo={origen} />
          {tieneIntermedio ? (
            <>
              <SeparadorChevron />
              <Nodo nodo={intermedio!} />
              <SeparadorChevron />
            </>
          ) : (
            <SeparadorPunteado />
          )}
          <Nodo nodo={destino} />
        </div>
      </div>

      {/* Footer: pipeline unificado (V-C). Solo se renderiza si se pasa. */}
      {tienePipeline && (
        <>
          <PipelineDivider meta={pipeline!.meta} toneBg={toneBg} />
          <PipelineRow steps={pipeline!.steps} />
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const PillRow: React.FC<{ pill?: RouteCardV2Pill }> = ({ pill }) => {
  const [copied, setCopied] = useState(false);

  if (!pill) {
    return (
      <div className="flex justify-center mb-3">
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200 italic">
          Sin transportador asignado
        </span>
      </div>
    );
  }

  const variant = pill.variant ?? 'sky';
  const dividerColor = PILL_DIVIDER_COLOR[variant];

  const handleCopyTracking = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pill.tracking) return;
    try {
      await navigator.clipboard.writeText(pill.tracking);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard errors
    }
  };

  return (
    <div className="flex justify-center mb-3">
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border',
          PILL_VARIANTS[variant]
        )}
      >
        {pill.icon && <span className="flex-shrink-0">{pill.icon}</span>}
        <span>{pill.text}</span>
        {pill.extras?.map((extra, i) => (
          <React.Fragment key={i}>
            <span className={dividerColor}>·</span>
            <span
              className={cn(
                extra.match(/^[A-Z0-9\-]{4,}$/) ? 'font-mono text-[10px]' : ''
              )}
            >
              {extra}
            </span>
          </React.Fragment>
        ))}
        {pill.tracking && (
          <>
            <span className={dividerColor}>·</span>
            <button
              type="button"
              onClick={handleCopyTracking}
              title={copied ? 'Copiado' : 'Copiar tracking'}
              className="inline-flex items-center gap-1 font-mono text-[10px] hover:opacity-70 transition-opacity cursor-pointer"
            >
              <span>{pill.tracking}</span>
              {copied ? (
                <Check className="w-2.5 h-2.5" />
              ) : (
                <Copy className="w-2.5 h-2.5 opacity-60" />
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const Nodo: React.FC<{ nodo: RouteCardV2Node }> = ({ nodo }) => (
  <div className="flex-1 min-w-0 bg-white rounded-lg p-3 border border-slate-200">
    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
      {nodo.icon ? (
        <span className="flex-shrink-0">{nodo.icon}</span>
      ) : (
        <span className="text-lg flex-shrink-0">{nodo.flag ?? '🌐'}</span>
      )}
      <span className="font-semibold text-sm text-slate-900 truncate">
        {nodo.nombre}
      </span>
    </div>
    {nodo.subtitulo && (
      <div className="text-[11px] text-slate-500 truncate mb-1.5">
        {nodo.subtitulo}
      </div>
    )}
    {nodo.badge && (
      <span
        className={cn(
          'inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium',
          BADGE_VARIANTS[nodo.badge.variant]
        )}
      >
        {nodo.badge.label}
      </span>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────

const SeparadorPunteado: React.FC = () => (
  <div className="flex-shrink-0 flex flex-col items-center justify-center px-1">
    <div className="w-12 h-0.5 border-t-2 border-dashed border-slate-300" />
    <ArrowRight className="w-4 h-4 text-slate-400 my-1" />
    <div className="w-12 h-0.5 border-t-2 border-dashed border-slate-300" />
  </div>
);

const SeparadorChevron: React.FC = () => (
  <div className="flex-shrink-0 flex items-center justify-center">
    <ChevronRight className="w-5 h-5 text-slate-300" />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline footer (V-C · S54)
// ─────────────────────────────────────────────────────────────────────────────

const DIVIDER_TOP_BORDERS: Record<'default' | 'amber', string> = {
  default: 'border-slate-200/70',
  amber: 'border-amber-200/50',
};

const PipelineDivider: React.FC<{ meta?: string; toneBg: 'default' | 'amber' }> = ({
  meta,
  toneBg,
}) => (
  <div
    className={cn(
      'flex items-center gap-2 px-4 py-2 border-t bg-white/40',
      DIVIDER_TOP_BORDERS[toneBg]
    )}
  >
    <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">
      Progreso
    </div>
    <div className="flex-1 h-px bg-slate-200/50" />
    {meta && (
      <div className="text-[10px] text-slate-500 tabular-nums">{meta}</div>
    )}
  </div>
);

const STEP_DOT_STYLES: Record<RouteCardV2PipelineStepStatus, string> = {
  completed: 'bg-emerald-500 text-white',
  current: 'bg-emerald-500 text-white ring-2 ring-emerald-200',
  pending: 'bg-white text-slate-400 border border-slate-300',
  skipped: 'bg-slate-200 text-slate-400',
};

const STEP_LABEL_STYLES: Record<RouteCardV2PipelineStepStatus, string> = {
  completed: 'text-slate-800',
  current: 'text-emerald-700',
  pending: 'text-slate-400',
  skipped: 'text-slate-400 line-through',
};

const STEP_FECHA_STYLES: Record<RouteCardV2PipelineStepStatus, string> = {
  completed: 'text-slate-500',
  current: 'text-emerald-600',
  pending: 'text-slate-400',
  skipped: 'text-slate-400',
};

const PipelineRow: React.FC<{ steps: RouteCardV2PipelineStep[] }> = ({ steps }) => (
  <div className="px-4 py-3 bg-white/60">
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const siguiente = steps[i + 1];
        const conectorActivo =
          step.status === 'completed' &&
          siguiente &&
          (siguiente.status === 'completed' || siguiente.status === 'current');
        return (
          <React.Fragment key={i}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                  STEP_DOT_STYLES[step.status]
                )}
              >
                {step.status === 'completed' || step.status === 'current' ? (
                  <Check className="w-3 h-3" strokeWidth={3} />
                ) : step.status === 'pending' ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                ) : (
                  <span className="text-[10px]">–</span>
                )}
              </div>
              <div className="min-w-0">
                <div
                  className={cn(
                    'text-xs truncate',
                    step.status === 'current' ? 'font-bold' : 'font-semibold',
                    STEP_LABEL_STYLES[step.status]
                  )}
                >
                  {step.label}
                </div>
                {step.fecha && (
                  <div
                    className={cn(
                      'text-[10px] truncate tabular-nums',
                      STEP_FECHA_STYLES[step.status]
                    )}
                  >
                    {step.fecha}
                  </div>
                )}
              </div>
            </div>
            {!isLast && (
              <div
                className={cn(
                  'h-0.5 flex-shrink-0 mx-1',
                  // Conector responsive: crece con espacio, mínimo suficiente
                  'w-6 sm:w-8 md:w-10',
                  conectorActivo ? 'bg-emerald-400' : 'bg-slate-200'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper: convierte código de país a emoji de bandera.
 * Reemplaza el helper privado `getFlag` de EnvioDetailModal (L1786).
 */
export function getFlagFromPais(pais?: string | null): string {
  if (!pais) return '🌐';
  const flags: Record<string, string> = {
    USA: '🇺🇸',
    'Estados Unidos': '🇺🇸',
    EEUU: '🇺🇸',
    CHINA: '🇨🇳',
    China: '🇨🇳',
    COREA: '🇰🇷',
    Corea: '🇰🇷',
    'Corea del Sur': '🇰🇷',
    JAPÓN: '🇯🇵',
    Japón: '🇯🇵',
    Japon: '🇯🇵',
    MÉXICO: '🇲🇽',
    México: '🇲🇽',
    Mexico: '🇲🇽',
    PERÚ: '🇵🇪',
    Perú: '🇵🇪',
    Peru: '🇵🇪',
  };
  return flags[pais] ?? '🌐';
}
