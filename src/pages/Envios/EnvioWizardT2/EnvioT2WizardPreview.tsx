/**
 * EnvioT2WizardPreview — Panel lateral sticky del Wizard T2 que se muestra
 * en los 5 pasos (análogo a OCWizardPreview del Wizard OC V3).
 *
 * Contenido:
 *  1. Mini ruta visual (origen → destino con bandera, tipo transporte)
 *  2. Contadores (unidades, productos, OCs consolidadas, pre-vendidas)
 *  3. Separador
 *  4. Totales monetarios (CTRU base, + Landed, Total) en USD y PEN
 *  5. Indicador de autoguardado
 *
 * Se renderiza dentro del slot `previewPanel` de `WizardShell`:
 *  <WizardShell previewPanel={<EnvioT2WizardPreview {...props} />}>
 *    ...
 *  </WizardShell>
 *
 * Es un presentational component puro — recibe los valores ya calculados
 * como props. Los cálculos viven en los selectors del state (selectCTRUBaseUSD,
 * selectMontoTotalFlete, selectTotalLandedUSD).
 */
import React from 'react';
import { cn } from '../../../design-system';

export interface EnvioT2WizardPreviewProps {
  // ─── Ruta ───
  /** Bandera emoji del país de origen (ej: "🇺🇸") */
  origenFlag?: string;
  /** Nombre corto de la casilla origen (ej: "Felicita") */
  origenNombre?: string;
  /** Subtexto del origen (ej: "Miami") */
  origenSubtexto?: string;

  /** Bandera emoji del país destino (default: "🇵🇪") */
  destinoFlag?: string;
  /** Nombre corto del almacén destino (ej: "Lima Centro") */
  destinoNombre?: string;
  /** Subtexto del destino (ej: "Almacén") */
  destinoSubtexto?: string;

  /** Icono del tipo de transporte entre origen y destino (ej: "✈️", "📦") */
  transporteIcono?: string;
  /** Nombre del colaborador del transporte (ej: "Juan Pérez") */
  colaboradorNombre?: string;

  // ─── Contadores ───
  unidadesCount: number;
  productosCount: number;
  ocsCount: number;
  prioritariasCount?: number;
  prioritariasTotales?: number;

  // ─── Totales monetarios ───
  /** CTRU base acumulado en USD (sin landed) */
  ctruBaseUSD: number;
  /** Total de costos landed (flete + adicionales) en USD */
  landedUSD: number;
  /** Tipo de cambio PEN/USD (si 0, no se muestra equivalente PEN) */
  tipoCambio?: number;

  // ─── Autoguardado ───
  /** Texto legible del estado del autoguardado (ej: "hace 15 min") */
  autoguardadoLabel?: string;

  // ─── Estilo ───
  /** Si se muestra el "Gran total" destacado en teal (solo en paso 5) */
  destacarTotal?: boolean;
  /** Clase adicional */
  className?: string;
}

const formatUSD = (n: number): string =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const formatPEN = (n: number): string =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const EnvioT2WizardPreview: React.FC<EnvioT2WizardPreviewProps> = ({
  origenFlag = '🌎',
  origenNombre = 'Origen',
  origenSubtexto,
  destinoFlag = '🇵🇪',
  destinoNombre = 'Destino',
  destinoSubtexto,
  transporteIcono,
  colaboradorNombre,
  unidadesCount,
  productosCount,
  ocsCount,
  prioritariasCount = 0,
  prioritariasTotales = 0,
  ctruBaseUSD,
  landedUSD,
  tipoCambio = 0,
  autoguardadoLabel,
  destacarTotal = false,
  className,
}) => {
  const totalUSD = ctruBaseUSD + landedUSD;
  const totalPEN = tipoCambio > 0 ? totalUSD * tipoCambio : 0;
  const hayOrigen = origenNombre !== 'Origen';
  const hayDestino = destinoNombre !== 'Destino';

  return (
    <div className={cn('sticky top-0 space-y-4', className)}>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Resumen del envío
      </div>

      {/* ─── Mini ruta visual ─── */}
      <div className="bg-white rounded-lg border border-slate-200 p-3">
        <div className="flex items-center gap-2">
          {/* Origen */}
          <div className="flex flex-col items-center min-w-0">
            <span className="text-2xl" aria-hidden>{origenFlag}</span>
            <div
              className={cn(
                'text-[10px] font-medium mt-1 truncate max-w-[70px]',
                hayOrigen ? 'text-slate-900' : 'text-slate-400'
              )}
            >
              {origenNombre}
            </div>
            {origenSubtexto && (
              <div className="text-[9px] text-slate-500 truncate max-w-[70px]">
                {origenSubtexto}
              </div>
            )}
          </div>

          {/* Conector */}
          <div className="flex-1 flex items-center">
            <div
              className={cn(
                'h-px flex-1',
                hayOrigen && hayDestino ? 'bg-teal-400' : 'bg-slate-300'
              )}
            />
            {transporteIcono && (
              <span className="text-xs px-1" aria-hidden>{transporteIcono}</span>
            )}
            {!transporteIcono && (
              <svg
                className="w-3 h-3 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            )}
            <div
              className={cn(
                'h-px flex-1',
                hayOrigen && hayDestino ? 'bg-teal-400' : 'bg-slate-300'
              )}
            />
          </div>

          {/* Destino */}
          <div className="flex flex-col items-center min-w-0">
            <span className="text-2xl" aria-hidden>{destinoFlag}</span>
            <div
              className={cn(
                'text-[10px] font-medium mt-1 truncate max-w-[80px]',
                hayDestino ? 'text-slate-900' : 'text-slate-400'
              )}
            >
              {destinoNombre}
            </div>
            {destinoSubtexto && (
              <div className="text-[9px] text-slate-500 truncate max-w-[80px]">
                {destinoSubtexto}
              </div>
            )}
          </div>
        </div>
        {colaboradorNombre && (
          <div className="text-[10px] text-slate-500 text-center mt-2 truncate">
            {colaboradorNombre}
          </div>
        )}
      </div>

      {/* ─── Contadores + Totales ─── */}
      <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
        {/* Contadores */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Unidades</span>
          <span className="font-semibold text-slate-900 tabular-nums">{unidadesCount}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Productos</span>
          <span className="font-semibold text-slate-900 tabular-nums">{productosCount}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">OCs consolidadas</span>
          <span className="font-semibold text-slate-900 tabular-nums">{ocsCount}</span>
        </div>
        {prioritariasTotales > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">🎯 Pre-vendidas</span>
            <span className="font-semibold text-emerald-700 tabular-nums">
              {prioritariasCount} de {prioritariasTotales}
            </span>
          </div>
        )}

        <div className="h-px bg-slate-100" />

        {/* Totales */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">CTRU base</span>
          <span className="font-semibold text-slate-900 tabular-nums">
            {formatUSD(ctruBaseUSD)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">+ Landed</span>
          <span
            className={cn(
              'font-semibold tabular-nums',
              landedUSD > 0 ? 'text-teal-700' : 'text-slate-400'
            )}
          >
            {landedUSD > 0 ? '+' : ''}{formatUSD(landedUSD)}
          </span>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Gran total (más destacado si destacarTotal) */}
        {destacarTotal ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Total</span>
              <span className="font-bold text-slate-900 tabular-nums text-lg">
                {formatUSD(totalUSD)}
              </span>
            </div>
            {totalPEN > 0 && (
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>S/</span>
                <span className="tabular-nums">{formatPEN(totalPEN)}</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Total estimado</span>
              <span className="font-bold text-slate-900 tabular-nums">
                {formatUSD(totalUSD)}
              </span>
            </div>
            {totalPEN > 0 && (
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Equivalente PEN</span>
                <span className="tabular-nums">{formatPEN(totalPEN)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Gran total destacado (solo paso 5) ─── */}
      {destacarTotal && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-teal-700 mb-1">
            Gran total del envío
          </div>
          <div className="text-2xl font-bold text-teal-900 tabular-nums">
            {formatUSD(totalUSD)}
          </div>
          {totalPEN > 0 && (
            <div className="text-xs text-teal-700 mt-0.5">
              USD · {formatPEN(totalPEN)} PEN
            </div>
          )}
        </div>
      )}

      {/* ─── Autoguardado ─── */}
      {autoguardadoLabel && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
          <span>Guardado automático · {autoguardadoLabel}</span>
        </div>
      )}
    </div>
  );
};
