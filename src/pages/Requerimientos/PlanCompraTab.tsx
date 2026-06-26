/**
 * PlanCompraTab · A1 · la TAB HÉROE de Requerimientos (F4 · convergencia demanda×caja a portafolio).
 *
 * Materializa "el sistema recomienda, vos decidís" a nivel cartera: la cola de reqs (pendiente/
 * aprobado/parcial) ordenada por MÉRITO, "gastada" contra un TOPE DE CAJA editable → la WATERLINE
 * (lo que entra este ciclo vs lo que se difiere). Nadie veía que 5 reqs que caben por separado
 * revientan la caja juntos. El plan RECOMIENDA, no bloquea: el usuario mueve el tope / decide.
 *
 * Núcleo PURO en `planCompra.helper` (construirPlanCompra + detectarConsolidaciones). Acá solo
 * presentación (canon DS · chrome BLUE · color semántico vía OrigenBadge · tabular-nums · lucide).
 */
import React, { useMemo, useState } from 'react';
import {
  SlidersHorizontal, Lightbulb, Layers, GitMerge, ListOrdered, Scissors,
  Info, Zap, CheckCircle, CheckCircle2, Kanban, AlertTriangle,
} from 'lucide-react';
import { construirPlanCompra, detectarConsolidaciones } from './planCompra.helper';
import { OrigenBadge } from './components/OrigenBadge';
import { useCajaDisponible } from './useCajaDisponible';
import type { Requerimiento } from '../../types/requerimiento.types';

interface Props {
  requerimientos: Requerimiento[];
  /** Abre el flujo "Generar compra" (OCBuilder) con esos reqs pre-seleccionados (consolidación C2). */
  onAgrupar: (reqsIds: string[]) => void;
}

const SLIDER_MIN = 10000;
// Default razonable cuando la caja no se pudo leer (null): el usuario lo ajusta a mano.
const TOPE_DEFAULT_SIN_CAJA = 0;

const fmtPEN = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

/** Etiqueta + nombre principal de los productos del req (1º + "+N"). */
function resumenProductos(req: Requerimiento): { nombre: string; meta: string } {
  const prods = req.productos ?? [];
  if (prods.length === 0) return { nombre: 'Sin productos', meta: req.numeroRequerimiento };
  const primero = prods[0];
  const extra = prods.length > 1 ? ` +${prods.length - 1}` : '';
  const uds = prods.reduce((s, p) => s + (p.cantidadSolicitada ?? 0), 0);
  return {
    nombre: `${primero.nombreComercial}${extra}`,
    meta: `${req.numeroRequerimiento} · ${uds} un`,
  };
}

export const PlanCompraTab: React.FC<Props> = ({ requerimientos, onAgrupar }) => {
  const cajaDisponible = useCajaDisponible(); // null = desconocida (cargando o no leíble)
  const cajaConocida = cajaDisponible !== null;

  // Tope editable: arranca en la caja consolidada (cuando carga); si null → default manual.
  // Estado "no tocado" → sigue a la caja apenas resuelve; tras tocar, queda fijo en lo del usuario.
  const [topeManual, setTopeManual] = useState<number | null>(null);
  const topePEN = topeManual ?? (cajaConocida ? Math.round(cajaDisponible!) : TOPE_DEFAULT_SIN_CAJA);

  // Tope máximo del slider: deja holgura sobre el mayor de (caja, cola, tope actual).
  const totalColaRaw = useMemo(
    () => construirPlanCompra(requerimientos, Number.MAX_SAFE_INTEGER).totalColaPEN,
    [requerimientos],
  );
  const sliderMax = Math.max(
    100000,
    Math.ceil((Math.max(topePEN, totalColaRaw, cajaDisponible ?? 0) * 1.1) / 1000) * 1000,
  );

  const plan = useMemo(() => construirPlanCompra(requerimientos, topePEN), [requerimientos, topePEN]);
  const consolidaciones = useMemo(() => detectarConsolidaciones(requerimientos), [requerimientos]);

  const colaVacia = plan.filas.length === 0;

  // Posición de la waterline: índice de la última fila que entra (para el separador visual).
  const ultimoEntraIdx = plan.filas.reduce((acc, f, i) => (f.entra ? i : acc), -1);

  const acumuladoEntra = plan.totalEntraPEN;
  const progresoPct = topePEN > 0 ? Math.min(100, Math.round((acumuladoEntra / topePEN) * 100)) : 0;
  const margenRestante = Math.max(0, topePEN - acumuladoEntra);
  const totalDiferidoPEN = plan.filas.filter((f) => !f.entra).reduce((s, f) => s + f.montoPEN, 0);

  // ── Empty state · cola vacía ───────────────────────────────────────────────
  if (colaVacia) {
    return (
      <div className="p-4 sm:p-5">
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>
          <div>
            <div className="text-[14px] font-bold text-slate-800 mb-1">La cola está vacía</div>
            <div className="text-[12px] text-slate-500 leading-snug max-w-[260px] mx-auto">
              Todo lo aprobado ya está cubierto en OC. No hay reqs pendientes de asignar.
            </div>
          </div>
          <div className="text-[11px] text-slate-400">Los reqs nuevos aparecerán aquí al aprobarse.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 bg-slate-50/30 space-y-4">

      {/* ═══ CONTROL DE CAJA · slider + barra de progreso ═══ */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-[12px] font-semibold text-slate-800 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              Tope de caja para este ciclo
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {cajaConocida
                ? 'Arrastrá para ajustar cuánto destinás a compras este ciclo'
                : 'Caja no disponible · definí el tope manualmente para este ciclo'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">S/</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={topePEN}
              onChange={(e) => setTopeManual(Math.max(0, Number(e.target.value) || 0))}
              className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-[15px] font-bold tabular-nums text-blue-800 w-32 text-right focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {/* Slider */}
        <input
          type="range"
          min={SLIDER_MIN}
          max={sliderMax}
          step={1000}
          value={Math.min(Math.max(topePEN, SLIDER_MIN), sliderMax)}
          onChange={(e) => setTopeManual(Number(e.target.value))}
          className="w-full h-2 rounded-full cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-[10px] text-slate-400 tabular-nums font-medium">
          <span>S/ {fmtPEN(SLIDER_MIN)}</span>
          <span>S/ {fmtPEN(sliderMax)}</span>
        </div>

        {/* Barra de progreso acumulado vs tope */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-600 font-medium">Acumulado en cola "entra este ciclo"</span>
            <span className="tabular-nums font-bold text-slate-800">
              S/ {fmtPEN(acumuladoEntra)} <span className="font-normal text-slate-400">/ {fmtPEN(topePEN)}</span>
            </span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
              style={{ width: `${progresoPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> {plan.countEntra} {plan.countEntra === 1 ? 'req cabe' : 'reqs caben'} en la caja
            </span>
            <span className="text-slate-500">Margen restante: S/ {fmtPEN(margenRestante)}</span>
          </div>
        </div>

        {/* Insight clave · reqs que caben por separado pero revientan la caja juntos */}
        {plan.countDifiere > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2 text-[12px]">
            <Lightbulb className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <span className="text-amber-800">
              Estos {plan.countDifiere} reqs caben por separado pero revientan la caja juntos · subí el tope o priorizá. La waterline muestra el corte real.
            </span>
          </div>
        )}
      </div>

      {/* ═══ C2 · AGRUPADOR · oportunidades de consolidación ═══ */}
      {consolidaciones.map((op) => (
        <div
          key={op.productoId}
          className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 text-[12px]">
            <Layers className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-indigo-900">Oportunidad de agrupación detectada:</span>
              <span className="text-indigo-700">
                {' '}{op.reqsNumeros.length} reqs piden {op.nombreComercial}
                {op.proveedorComun ? ` · proveedor ${op.proveedorComun}` : ''} → {op.cantidadTotal} uds.
              </span>
              <span className="font-medium text-indigo-800"> Agrupar reduce el flete por unidad y simplifica la OC.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onAgrupar(op.reqsIds)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex-shrink-0"
          >
            <GitMerge className="w-3.5 h-3.5" /> Agrupar para Generar compra
          </button>
        </div>
      ))}

      {/* ═══ COLA ORDENADA POR MÉRITO · WATERLINE (desktop tabla) ═══ */}
      <div className="hidden sm:block bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Header tabla */}
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
            <ListOrdered className="w-3.5 h-3.5 text-blue-600" />
            Cola ordenada por mérito
            <span className="text-[10px] font-normal text-slate-400">(certeza de demanda + prioridad)</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-white border border-slate-300 inline-block" /> Entra este ciclo
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-slate-100 inline-block opacity-60" /> Se difiere
            </span>
          </div>
        </div>

        {/* Col headers */}
        <div className="grid grid-cols-12 gap-0 px-4 py-2 border-b border-slate-100 bg-slate-50/50 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
          <div className="col-span-1">#</div>
          <div className="col-span-2">Origen</div>
          <div className="col-span-4">Producto</div>
          <div className="col-span-2 text-right">Monto</div>
          <div className="col-span-3 text-right">Acumulado</div>
        </div>

        {/* Filas + waterline */}
        {plan.filas.map((fila, idx) => {
          const { nombre, meta } = resumenProductos(fila.req);
          return (
            <React.Fragment key={fila.req.id ?? fila.req.numeroRequerimiento}>
              <div
                className={`grid grid-cols-12 gap-0 px-4 py-3 border-b border-slate-100 items-center transition-colors ${
                  fila.entra ? 'hover:bg-slate-50/50' : 'bg-slate-50 opacity-60'
                }`}
              >
                <div className={`col-span-1 text-[12px] font-bold tabular-nums ${fila.entra ? 'text-slate-400' : 'text-slate-300'}`}>
                  {idx + 1}
                </div>
                <div className="col-span-2">
                  <OrigenBadge origen={fila.req.origen} subtipo={fila.req.subtipo} size="xs" />
                </div>
                <div className="col-span-4">
                  <div className={`text-[12px] font-semibold leading-tight ${fila.entra ? 'text-slate-800' : 'text-slate-400'}`}>
                    {nombre}
                  </div>
                  <div className={`text-[10px] ${fila.entra ? 'text-slate-500' : 'text-slate-300'}`}>{meta}</div>
                </div>
                <div className="col-span-2 text-right">
                  <div className={`text-[13px] font-bold tabular-nums ${fila.entra ? 'text-slate-900' : 'text-slate-400'}`}>
                    S/ {fmtPEN(fila.montoPEN)}
                  </div>
                </div>
                <div className="col-span-3 text-right">
                  <div className={`text-[12px] tabular-nums ${fila.entra ? 'text-slate-500' : 'text-slate-300'}`}>
                    S/ {fmtPEN(fila.acumuladoPEN)}
                  </div>
                </div>
              </div>

              {/* Línea de corte · justo después de la última fila que entra */}
              {idx === ultimoEntraIdx && plan.countDifiere > 0 && (
                <div className="relative py-0">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-blue-400" />
                  <div className="relative flex items-center justify-center py-2">
                    <div className="flex items-center gap-2 bg-blue-600 text-white text-[11px] font-bold px-4 py-1.5 rounded-full shadow-sm z-10">
                      <Scissors className="w-3.5 h-3.5" />
                      WATERLINE · Corte de caja S/ {fmtPEN(topePEN)} — los siguientes se difieren
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* Footer de la tabla · resumen de la cola */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <span>
              {plan.countEntra} entran (S/ {fmtPEN(plan.totalEntraPEN)}) · {plan.countDifiere} se difieren · cola total S/ {fmtPEN(plan.totalColaPEN)}
            </span>
          </div>
          {plan.countDifiere > 0 && (
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-slate-400" />
              <span>S/ {fmtPEN(totalDiferidoPEN)} diferido · se incluye aumentando el tope</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ COLA · WATERLINE (mobile cards · acto 9) ═══ */}
      <div className="sm:hidden bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center gap-2 text-[12px] font-semibold text-slate-700">
          <ListOrdered className="w-3.5 h-3.5 text-blue-600" />
          Cola ordenada por mérito
        </div>
        <div className="divide-y divide-slate-100">
          {plan.filas.map((fila, idx) => {
            const { nombre, meta } = resumenProductos(fila.req);
            return (
              <React.Fragment key={fila.req.id ?? fila.req.numeroRequerimiento}>
                <div className={`px-4 py-3 ${fila.entra ? 'bg-white' : 'bg-slate-50 opacity-55'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[10px] font-bold tabular-nums ${fila.entra ? 'text-slate-400' : 'text-slate-300'}`}>
                          #{idx + 1}
                        </span>
                        <OrigenBadge origen={fila.req.origen} subtipo={fila.req.subtipo} size="xs" />
                      </div>
                      <div className={`text-[12px] font-semibold truncate ${fila.entra ? 'text-slate-900' : 'text-slate-400'}`}>
                        {nombre}
                      </div>
                      <div className={`text-[10px] ${fila.entra ? 'text-slate-500' : 'text-slate-300'}`}>{meta}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-[13px] font-bold tabular-nums ${fila.entra ? 'text-slate-900' : 'text-slate-400'}`}>
                        S/ {fmtPEN(fila.montoPEN)}
                      </div>
                      <div className={`text-[10px] tabular-nums ${fila.entra ? 'text-slate-400' : 'text-slate-300'}`}>
                        acum. S/ {fmtPEN(fila.acumuladoPEN)}
                      </div>
                    </div>
                  </div>
                </div>

                {idx === ultimoEntraIdx && plan.countDifiere > 0 && (
                  <div className="bg-blue-600 py-1.5 flex items-center justify-center gap-1.5 text-white text-[10px] font-bold">
                    <Scissors className="w-3 h-3" /> WATERLINE · se difieren debajo
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <span>
            {plan.countEntra} entran (S/ {fmtPEN(plan.totalEntraPEN)}) · {plan.countDifiere} se difieren · cola total S/ {fmtPEN(plan.totalColaPEN)}
          </span>
        </div>
      </div>

      {/* Nota: caja desconocida (no leíble) — el tope arranca manual */}
      {!cajaConocida && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2 text-[11px] text-slate-500">
          <AlertTriangle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span>Caja no disponible · el plan usa el tope que definas manualmente.</span>
        </div>
      )}
    </div>
  );
};

export default PlanCompraTab;
