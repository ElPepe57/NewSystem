/**
 * TabLlegadas · Fase 1 · 6ª tab del hub Compras · "torre de control logística desde la óptica de la OC".
 *
 * El verbo del usuario: "vigilar / empujar MI pedido". REGLA estricta de ownership:
 *   · OPERABLE aquí (propio de Compras): radar de atrasados en vuelo + "Empujar proveedor".
 *   · READ-ONLY (cross-link): capital en tránsito → Envíos/Finanzas · unidades → Stock ·
 *     incidencias/reclamos → Envíos (SOLO count + link · NO el detalle/CRUD · su dueño es Envíos).
 *
 * Layout A (main + aside · canon). Chrome BLUE (Comercial) · semántico en el dato. Pixel-perfect del
 * mockup docs/mockups/compras-llegadas-v1.html (Actos 1, 2, 4, 5, 6, 7).
 *
 * HONESTIDAD: "última señal / mudo" NO existe (no hay campo de señal de tracking · gap C4) → se
 * rotula "señal de tracking: pendiente", NO un número falso. Capital/uds = derivables hoy (read-only).
 */

import React, { useState } from 'react';
import {
  Ship, ExternalLink, Eye, Info, ArrowRight, Radar, AlertTriangle, Megaphone,
  PlaneLanding, Boxes, AlertOctagon, HandCoins, ShieldCheck, Plane,
} from 'lucide-react';
import type { RadarAtrasadosResult, FilaRadarLlegada } from '../useRadarAtrasados';
import { GRAVEDAD_META, barWidthPct } from '../radarLlegadas.ui';
import { EmpujarProveedorModal } from './EmpujarProveedorModal';

interface TabLlegadasProps {
  radar: RadarAtrasadosResult;
  /** Navegación (cross-link read-only a otros módulos · NO duplica). */
  navigate: (path: string) => void;
}

const fmtUSD = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

export const TabLlegadas: React.FC<TabLlegadasProps> = ({ radar, navigate }) => {
  const { filas, resumen, capital, unidades, teaser } = radar;
  const [empujar, setEmpujar] = useState<FilaRadarLlegada | null>(null);

  // Deep-links que EXISTEN (verificado): Envíos lee ?envioId= y ?highlight= (abre detalle) ·
  // ?ordenCompraId= (filtra por OC · usado por CompraCard "Ver envíos"). Stock/Finanzas → ruta base.
  const verEnvio = (fila: FilaRadarLlegada) =>
    fila.envio
      ? navigate(`/envios?envioId=${fila.envio.id}`)
      : navigate(`/envios?ordenCompraId=${fila.orden.id}`);
  // Teaser → Envíos contextualizado a las OCs con incidencias (1ª OC · param soportado es 1 OC).
  const verExcepciones = () =>
    teaser.ocIds.length > 0
      ? navigate(`/envios?ordenCompraId=${teaser.ocIds[0]}`)
      : navigate('/envios');

  const sinEnVuelo = capital.totalUSD === 0 && capital.enviosCount === 0 && filas.length === 0;

  return (
    <div className="bg-slate-50/30 p-3 sm:p-4 md:p-6 space-y-4">

      {/* ════════════════════ BANNER · CAPITAL EN TRÁNSITO (cross-link · read-only · de Envíos) ════════════════════ */}
      {sinEnVuelo ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
            <Ship className="w-3.5 h-3.5" /> Capital en tránsito
            <span className="inline-flex items-center gap-1 ml-auto text-[10px] font-bold uppercase tracking-wider text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full"><Eye className="w-2.5 h-2.5" /> de Envíos</span>
          </div>
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3"><Plane className="w-7 h-7 text-slate-400" /></div>
            <div className="text-[14px] font-bold text-slate-900 mb-1">Nada en vuelo</div>
            <p className="text-[12px] text-slate-500 leading-relaxed">No hay envíos en tránsito · $0 de capital en el aire.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div className="flex items-center gap-2">
              <Ship className="w-4 h-4 text-slate-700" />
              <span className="text-[13px] font-bold text-slate-900">Capital en tránsito</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full"><ExternalLink className="w-2.5 h-2.5" /> de Envíos</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full"><Eye className="w-2.5 h-2.5" /> lectura</span>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums text-slate-900">{fmtUSD(capital.totalUSD)}</div>
              <div className="text-[11px] text-slate-500">valor en el aire · {capital.enviosCount} envío{capital.enviosCount === 1 ? '' : 's'}</div>
            </div>
          </div>
          {/* barra composición en-riesgo severo vs normal */}
          <div className="h-3 rounded-full overflow-hidden flex bg-slate-100">
            <div className="bg-rose-500 h-full" style={{ width: `${capital.enRiesgoPct}%` }} title="en riesgo severo" />
            <div className="bg-emerald-400 h-full" style={{ width: `${capital.normalPct}%` }} title="normal" />
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-rose-700"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> En riesgo severo <span className="tabular-nums">{fmtUSD(capital.enRiesgoUSD)} · {capital.enRiesgoPct}%</span></span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Normal <span className="tabular-nums">{fmtUSD(capital.normalUSD)} · {capital.normalPct}%</span></span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div className="text-[11px] text-slate-500 flex items-start gap-1.5"><Info className="w-3 h-3 flex-shrink-0 mt-0.5" /> <span>Este número <b className="text-slate-600">no se origina en Compras</b> · es la lectura del riesgo del dinero atrapado en envíos. El detalle y el write-off viven en Envíos/Finanzas.</span></div>
            <button onClick={() => navigate('/envios')} className="text-[11px] font-semibold text-orange-700 border border-orange-200 hover:bg-orange-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1">Ver en Envíos <ArrowRight className="w-3 h-3" /></button>
          </div>
        </div>
      )}

      {/* ════════════════════ LAYOUT A · main (radar) + aside (uds + teaser) ════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* ── MAIN · RADAR DE ATRASADOS (OPERABLE) ── */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center gap-2 text-[11px] flex-wrap">
              <PlaneLanding className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-semibold text-blue-700">Radar de atrasados en vuelo</span>
              <span className="inline-flex items-center gap-1 ml-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full"><Radar className="w-2.5 h-2.5" /> operable aquí</span>
            </div>

            {filas.length === 0 ? (
              /* EMPTY · sin atrasados = buena señal */
              <div className="p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-3"><PlaneLanding className="w-7 h-7 text-emerald-600" /></div>
                <div className="text-[14px] font-bold text-slate-900 mb-1">Todo en hora</div>
                <p className="text-[12px] text-slate-500 leading-relaxed mb-4 max-w-sm mx-auto">Ningún envío en vuelo va atrasado contra su lead-time. El radar vacío es <b className="text-emerald-700">buena señal</b>.</p>
              </div>
            ) : (
              <div className="bg-slate-50/30 p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Radar className="w-4 h-4 text-rose-600" />
                    <span className="text-[13px] font-bold text-slate-900 tabular-nums">{filas.length} envío{filas.length === 1 ? '' : 's'} atrasado{filas.length === 1 ? '' : 's'} en vuelo</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded-full"><AlertTriangle className="w-2.5 h-2.5" /> por gravedad</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 text-[10px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">leve &gt;1×</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full">severo &gt;1.5×</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 bg-rose-100 border border-rose-300 px-1.5 py-0.5 rounded-full">crítico &gt;2×</span>
                  </div>
                </div>

                {/* ── Desktop: tabla ── */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="hidden lg:grid grid-cols-[1.4fr_1.3fr_1.4fr_1fr_1.2fr_1fr] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span>OC / envío</span><span>Proveedor</span><span>Días en vuelo vs lead-time</span><span className="text-right">Capital</span><span>Última señal</span><span className="text-right">Acción</span>
                  </div>
                  {filas.map((fila, i) => {
                    const meta = GRAVEDAD_META[fila.gravedad];
                    const accionable = fila.gravedad !== 'leve';
                    return (
                      <div key={fila.id} className={`grid grid-cols-1 lg:grid-cols-[1.4fr_1.3fr_1.4fr_1fr_1.2fr_1fr] gap-3 px-4 py-3.5 ${i < filas.length - 1 ? 'border-b border-slate-100' : ''} ${meta.hover} transition-colors border-l-4 ${meta.borderL}`}>
                        {/* OC / envío */}
                        <div className="flex items-center gap-2 min-w-0">
                          <Ship className={`w-4 h-4 ${meta.shipIcon} flex-shrink-0`} />
                          <div className="min-w-0">
                            <div className="text-[13px] font-bold text-slate-900 truncate">{fila.numero}</div>
                            <div className="text-[11px] text-slate-500 tabular-nums truncate">{fila.orden.numeroOrden} · {fila.paisOrigen}</div>
                          </div>
                        </div>
                        {/* proveedor */}
                        <div className="flex items-center">
                          <div className="min-w-0">
                            <div className="text-[12px] font-semibold text-slate-700 truncate">{fila.proveedor}</div>
                          </div>
                        </div>
                        {/* días vs lead-time */}
                        <div className="flex items-center">
                          <div className="w-full">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className={`text-[18px] font-bold tabular-nums ${meta.dias}`}>{fila.diasEnVuelo}</span>
                              <span className="text-[11px] text-slate-400 tabular-nums">/ {fila.leadTimeEsperado}d esp.</span>
                              <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ml-1 ${meta.badge}`}>{meta.label} {fila.ratio.toFixed(1)}×</span>
                            </div>
                            <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${meta.bar} rounded-full`} style={{ width: `${barWidthPct(fila.ratio)}%` }} /></div>
                          </div>
                        </div>
                        {/* capital */}
                        <div className="flex items-center lg:justify-end"><span className="text-[14px] font-bold tabular-nums text-slate-900">{fmtUSD(fila.capitalUSD)}</span></div>
                        {/* última señal · HONESTO: no hay dato de tracking (gap C4) */}
                        <div className="flex items-center">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                            <Info className="w-3 h-3" /> tracking pendiente
                          </span>
                        </div>
                        {/* acción */}
                        <div className="flex items-center gap-1.5 lg:justify-end">
                          <button onClick={() => verEnvio(fila)} className="text-[11px] font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 px-2.5 py-1.5 rounded-lg">Ver</button>
                          <button
                            onClick={() => setEmpujar(fila)}
                            className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 ${
                              fila.gravedad === 'critico'
                                ? 'text-white bg-rose-600 hover:bg-rose-700'
                                : accionable
                                  ? 'text-rose-600 border border-rose-200 hover:bg-rose-50'
                                  : 'text-slate-400 border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <Megaphone className="w-3 h-3" /> Empujar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2 text-[10px] text-slate-400 flex items-start gap-1.5">
                  <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span>Borde izquierdo refuerza la gravedad. <b className="text-slate-500">Empujar proveedor</b> abre un mini-form (contactar / escalar / registrar promesa) que queda en el historial de la OC — la única acción PROPIA de Compras. "Ver" abre el envío en Envíos. El badge "{resumen.badge}" de la tab = filas severo+crítico.</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── ASIDE · unidades por llegar + teaser excepciones (read-only) ── */}
        <aside className="md:col-span-1 space-y-4">

          {/* UNIDADES POR LLEGAR · cross-link a Stock */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px]"><Boxes className="w-3.5 h-3.5 text-amber-600" /><span className="font-semibold text-slate-700">Unidades por llegar</span></div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full"><Eye className="w-2.5 h-2.5" /> de Stock</span>
            </div>
            <div className="p-4">
              {unidades.total === 0 ? (
                <p className="text-[12px] text-slate-500">Sin unidades en vuelo por ahora.</p>
              ) : (
                <>
                  <div className="flex items-baseline gap-2 mb-3"><span className="text-2xl font-bold tabular-nums text-slate-900">{unidades.total.toLocaleString('es-PE')}</span><span className="text-[12px] text-slate-500">uds en {capital.enviosCount} envío{capital.enviosCount === 1 ? '' : 's'}</span></div>
                  <div className="space-y-2">
                    {unidades.porProveedor.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-[12px]">
                        <span className="text-slate-600 flex items-center gap-1.5 min-w-0"><span className={`w-2 h-2 rounded-full flex-shrink-0 ${['bg-blue-500', 'bg-purple-500', 'bg-amber-500'][i] || 'bg-slate-400'}`} /><span className="truncate">{p.nombre}</span></span>
                        <span className="font-semibold tabular-nums text-slate-800 flex-shrink-0">{p.unidades.toLocaleString('es-PE')} uds</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 flex items-center gap-1"><Eye className="w-3 h-3" /> lectura · no se recibe acá</span>
                <button onClick={() => navigate('/inventario')} className="text-[11px] font-semibold text-orange-700 border border-orange-200 hover:bg-orange-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1">Ver en Stock <ArrowRight className="w-3 h-3" /></button>
              </div>
            </div>
          </div>

          {/* TEASER EXCEPCIONES · cross-link a Envíos (read-only · SOLO count + link) */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px]"><AlertOctagon className="w-3.5 h-3.5 text-rose-600" /><span className="font-semibold text-slate-700">Excepciones en curso</span></div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full"><Eye className="w-2.5 h-2.5" /> de Envíos</span>
            </div>
            <div className="p-4">
              {teaser.loading ? (
                /* loading · incidenciaOC.listAll en curso */
                <div className="space-y-2.5 animate-pulse">
                  <div className="flex items-center gap-3"><div className="w-4 h-4 rounded bg-slate-200" /><div className="flex-1 space-y-1.5"><div className="h-2.5 w-2/3 bg-slate-200 rounded" /><div className="h-2 w-1/2 bg-slate-200 rounded" /></div></div>
                  <div className="flex items-center gap-3"><div className="w-4 h-4 rounded bg-slate-200" /><div className="flex-1 space-y-1.5"><div className="h-2.5 w-1/2 bg-slate-200 rounded" /><div className="h-2 w-2/5 bg-slate-200 rounded" /></div></div>
                  <div className="h-8 w-full rounded-lg bg-slate-200 mt-1" />
                </div>
              ) : teaser.incidenciasAbiertas === 0 && teaser.reclamosPorCobrar === 0 ? (
                /* empty · sin líos (deja la card · discovery) */
                <div className="text-center py-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-2"><ShieldCheck className="w-6 h-6 text-emerald-600" /></div>
                  <div className="text-[13px] font-bold text-slate-900 mb-0.5">Sin líos en estas OCs</div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">0 incidencias · 0 reclamos por cobrar en las OCs en vuelo.{teaser.error ? ' (no se pudo leer · reintentá)' : ''}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {teaser.incidenciasAbiertas > 0 && (
                    <div className="flex items-center gap-3 bg-rose-50/50 border border-rose-100 rounded-xl px-3 py-2.5">
                      <AlertOctagon className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <div className="min-w-0"><div className="text-[13px] font-bold text-slate-900 tabular-nums">{teaser.incidenciasAbiertas} incidencia{teaser.incidenciasAbiertas === 1 ? '' : 's'} abierta{teaser.incidenciasAbiertas === 1 ? '' : 's'}</div><div className="text-[11px] text-slate-500">en estas OCs · recepción · factura · logística</div></div>
                    </div>
                  )}
                  {teaser.reclamosPorCobrar > 0 && (
                    <div className="flex items-center gap-3 bg-sky-50/50 border border-sky-100 rounded-xl px-3 py-2.5">
                      <HandCoins className="w-4 h-4 text-sky-600 flex-shrink-0" />
                      <div className="min-w-0"><div className="text-[13px] font-bold text-slate-900 tabular-nums">{teaser.reclamosPorCobrar} reclamo{teaser.reclamosPorCobrar === 1 ? '' : 's'} por cobrar</div><div className="text-[11px] text-slate-500 tabular-nums">S/ {Math.round(teaser.reclamosMontoPEN).toLocaleString('es-PE')} por cobrar</div></div>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 flex items-center gap-1"><Eye className="w-3 h-3" /> solo count · no el CRUD</span>
                <button onClick={verExcepciones} className="text-[11px] font-semibold text-orange-700 border border-orange-200 hover:bg-orange-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1">Ver en Envíos <ArrowRight className="w-3 h-3" /></button>
              </div>
            </div>
          </div>

        </aside>
      </div>

      {/* Modal "Empujar proveedor" · la única acción de captura propia */}
      <EmpujarProveedorModal fila={empujar} onClose={() => setEmpujar(null)} />

      {/* nota de ownership · cierra la regla (cross-link vs operable) */}
      <div className="text-[10px] text-slate-400 flex items-start gap-1.5">
        <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
        <span>Lo que <b className="text-slate-500">se opera</b> (radar + empujar proveedor) vive en Compras; lo que <b className="text-slate-500">es de otro dueño</b> (capital · unidades · incidencias · reclamos) se muestra read-only y se OPERA en su módulo (Envíos · Stock · Finanzas). Cero duplicación.</span>
      </div>
    </div>
  );
};
