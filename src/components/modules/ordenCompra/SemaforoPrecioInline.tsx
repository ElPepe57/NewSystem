import React from 'react';
import { History, Check, TrendingUp, ArrowDownLeft } from 'lucide-react';
import { cn } from '../../../design-system';
import { analizarPrecio } from '../../../utils/precioInteligencia.helper';

/**
 * Referencia de precio por SKU: histórico (OCs en-memoria) + investigado (catálogo).
 * Se construye con getReferenciaPreciosEnMemoria(ids, ordenes) + producto.investigacion.precioUSAPromedio.
 */
export interface ReferenciaPrecio {
  ultimaCompra: number | null;
  promedio: number | null;
  investigado: number | null;
  nMuestras: number;
}

interface SemaforoPrecioInlineProps {
  /** Costo unitario USD que el comprador tipea. */
  costo: number;
  /** Referencia de precio del SKU (histórico + investigado) · undefined → no renderiza nada. */
  referencia?: ReferenciaPrecio;
  /** Callback al pulsar "usar $X" (precarga el costo sugerido). */
  onUsarSugerido: (precio: number) => void;
  className?: string;
}

/**
 * SemaforoPrecioInline — referencia de precio + semáforo crudo-vs-crudo, inline.
 *
 * Extraído de StepProductos (D1 · 2026-06-30) para reuso DRY entre las DOS vías de creación
 * de OC: el wizard single (OCWizardV3/StepProductos) y la consolidada (OCBuilder/Step2). Usa el
 * motor PURO `analizarPrecio` (UNA sola base · los 3 bugs ya corregidos). Renderiza null sin referencia.
 */
export const SemaforoPrecioInline: React.FC<SemaforoPrecioInlineProps> = ({
  costo,
  referencia,
  onUsarSugerido,
  className,
}) => {
  if (!referencia) return null;
  const ref = referencia;
  const tieneRef = ref.ultimaCompra != null || ref.promedio != null || ref.investigado != null;
  const sugerido = ref.investigado ?? ref.ultimaCompra ?? null;
  // Semáforo via motor PURO · UNA sola base (promedio histórico · cae al investigado/mercado).
  const semaforo = analizarPrecio({
    costoUnitarioUSD: costo,
    costoAdicionalPorUnidadUSD: 0,
    tc: 0, // el chip solo muestra el semáforo crudo-vs-crudo (no landed/margen)
    referencia: { ultimaCompra: ref.ultimaCompra, promedio: ref.promedio, nMuestras: ref.nMuestras },
    investigacion:
      ref.investigado != null
        ? { precioMejorProvUSD: ref.investigado, precioEfectivo: 0, tieneProveedores: true, tieneCompetidores: false }
        : null,
  });
  const deltaPct = semaforo.deltaPct;
  const sobrePrecio = semaforo.veredicto === 'caro' || semaforo.veredicto === 'no_recomendable';

  return (
    <div className={cn('flex items-center gap-2 text-[10px] flex-wrap', className)}>
      {tieneRef ? (
        <>
          <span className="inline-flex items-center gap-1 text-slate-400 font-semibold uppercase tracking-wider">
            <History className="w-3 h-3" />Referencia
          </span>
          {ref.ultimaCompra != null && (
            <span className="text-slate-500">
              últ <b className="text-slate-700 tabular-nums">${ref.ultimaCompra.toFixed(0)}</b>
            </span>
          )}
          {ref.promedio != null && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">
                prom <b className="text-slate-700 tabular-nums">${ref.promedio.toFixed(0)}</b>
              </span>
            </>
          )}
          {ref.investigado != null && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">
                invest <b className="text-slate-700 tabular-nums">${ref.investigado.toFixed(0)}</b>
              </span>
            </>
          )}
          {costo === 0 && sugerido != null && (
            <button
              type="button"
              onClick={() => onUsarSugerido(Number(sugerido.toFixed(2)))}
              className="inline-flex items-center gap-1 ml-1 text-blue-700 font-bold bg-blue-100 hover:bg-blue-200 rounded px-1.5 py-0.5"
            >
              <ArrowDownLeft className="w-3 h-3" />usar ${sugerido.toFixed(0)}
            </button>
          )}
          {costo > 0 && deltaPct != null &&
            (sobrePrecio ? (
              <span className="inline-flex items-center gap-1 text-amber-600 font-bold ml-1">
                <TrendingUp className="w-3 h-3" />+{Math.round(deltaPct)}% vs prom · caro
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold ml-1">
                <Check className="w-3 h-3" />
                {deltaPct < -2 ? `${Math.round(deltaPct)}% vs prom` : 'en rango'}
              </span>
            ))}
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-1 text-slate-300 font-semibold uppercase tracking-wider">
            <History className="w-3 h-3" />Referencia
          </span>
          <span className="text-slate-400 italic">sin histórico · primera compra de este SKU</span>
        </>
      )}
    </div>
  );
};
