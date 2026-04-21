/**
 * CTRULandedPreview — Tabla de preview del CTRU landed preliminar por producto
 * en el Paso 4 (Costos landed).
 *
 * Muestra, agrupado por producto:
 *  - CTRU base (costo unitario + cargos OC prorrateados)
 *  - + Landed (delta que aporta este envío T2)
 *  - CTRU final estimado (base + landed)
 *
 * Badge "Estimado · se ajusta al cerrar envío" refleja D-17:
 *  el CTRU es PRELIMINAR mientras haya costos en estado `estimado`.
 *
 * Uso:
 *  <CTRULandedPreview
 *    filas={[
 *      { productoId: 'p1', productoNombre: 'NOW Ashwagandha', emoji: '💊',
 *        uds: 2, ctruBaseUSD: 18.50, landedUSD: 4.82 },
 *      ...
 *    ]}
 *  />
 */
import React from 'react';
import { cn } from '../../../design-system';

export interface CTRULandedPreviewFila {
  productoId: string;
  productoNombre: string;
  /** Emoji del producto (o null si no hay) */
  emoji?: string;
  /** Cantidad de unidades seleccionadas de este producto */
  uds: number;
  /** CTRU base USD (sin landed) — suma o promedio de las uds seleccionadas */
  ctruBaseUSD: number;
  /** Landed USD que aporta este envío al total del producto */
  landedUSD: number;
}

export interface CTRULandedPreviewProps {
  /** Filas a mostrar, una por producto en la selección */
  filas: CTRULandedPreviewFila[];
  /** Mostrar el badge "Estimado" (default true — CTRU preliminar) */
  mostrarBadgeEstimado?: boolean;
  /** Etiqueta del badge (default "Estimado · se ajusta al cerrar envío") */
  badgeLabel?: string;
  /** Clase adicional */
  className?: string;
  /** Si está calculando (UI en re-render, muestra overlay ligero) */
  loading?: boolean;
}

const formatUSD = (n: number): string => `$${n.toFixed(2)}`;

export const CTRULandedPreview: React.FC<CTRULandedPreviewProps> = ({
  filas,
  mostrarBadgeEstimado = true,
  badgeLabel = 'Estimado · se ajusta al cerrar envío',
  className,
  loading = false,
}) => {
  const totalUds = filas.reduce((sum, f) => sum + f.uds, 0);
  const totalCTRUBase = filas.reduce((sum, f) => sum + f.ctruBaseUSD, 0);
  const totalLanded = filas.reduce((sum, f) => sum + f.landedUSD, 0);
  const totalFinal = totalCTRUBase + totalLanded;

  return (
    <div
      className={cn(
        'bg-slate-50 border border-slate-200 rounded-xl overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 flex-wrap">
        <span className="text-base" aria-hidden>💡</span>
        <div className="text-sm font-semibold text-slate-700">
          Preview CTRU landed preliminar
        </div>
        {mostrarBadgeEstimado && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />
            {badgeLabel}
          </span>
        )}
      </div>

      {/* Tabla */}
      <div className={cn('overflow-x-auto relative', loading && 'opacity-60')}>
        {loading && (
          <div className="absolute inset-0 bg-white/40 flex items-center justify-center pointer-events-none z-10">
            <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 bg-white border-b border-slate-200">
            <tr>
              <th className="text-left py-2 px-4 font-medium">Producto</th>
              <th className="text-right py-2 px-3 font-medium">Uds</th>
              <th className="text-right py-2 px-3 font-medium">CTRU base</th>
              <th className="text-right py-2 px-3 font-medium">+ Landed</th>
              <th className="text-right py-2 px-4 font-medium">CTRU final</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {filas.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-slate-400 italic">
                  Selecciona unidades en el Paso 2 y define costos arriba para ver el preview
                </td>
              </tr>
            ) : (
              filas.map((f) => (
                <tr key={f.productoId}>
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      {f.emoji && <span className="text-lg" aria-hidden>{f.emoji}</span>}
                      <span className="text-slate-900">{f.productoNombre}</span>
                    </div>
                  </td>
                  <td className="text-right py-2 px-3 tabular-nums">{f.uds}</td>
                  <td className="text-right py-2 px-3 tabular-nums text-slate-700">
                    {formatUSD(f.ctruBaseUSD)}
                  </td>
                  <td className="text-right py-2 px-3 tabular-nums font-semibold text-teal-700">
                    +{formatUSD(f.landedUSD)}
                  </td>
                  <td className="text-right py-2 px-4 tabular-nums font-bold text-slate-900">
                    {formatUSD(f.ctruBaseUSD + f.landedUSD)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filas.length > 0 && (
            <tfoot className="bg-slate-100 border-t-2 border-slate-300 text-slate-900">
              <tr>
                <td className="py-2 px-4 font-semibold">Total</td>
                <td className="text-right py-2 px-3 tabular-nums font-bold">{totalUds}</td>
                <td className="text-right py-2 px-3 tabular-nums font-bold">
                  {formatUSD(totalCTRUBase)}
                </td>
                <td className="text-right py-2 px-3 tabular-nums font-bold text-teal-700">
                  +{formatUSD(totalLanded)}
                </td>
                <td className="text-right py-2 px-4 tabular-nums font-bold">
                  {formatUSD(totalFinal)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
