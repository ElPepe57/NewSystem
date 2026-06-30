import React, { useEffect, useState, useMemo } from 'react';
import { Layers, AlertTriangle } from 'lucide-react';
import { cn } from '../../../../design-system';
import type { ProductoOrden } from '../../../../types/ordenCompra.types';
import { OrdenCompraService } from '../../../../services/ordenCompra.service';
import { useProductoStore } from '../../../../store/productoStore';
import { getEmojiPorProducto } from './productoEmoji';
// F3 · motor PURO del Lente 2 (semáforo + margen landed + score · 3 bugs corregidos)
import { analizarPrecio, type InvestigacionViva, type ScoreTone } from '../../../../utils/precioInteligencia.helper';
// Fuente VIVA del margen/PVP (reemplaza los campos deprecados de producto.investigacion)
import { calcularInvestigacion } from '../../../../pages/Productos/utils/investigacionCalculos';

// ─── Types ────────────────────────────────────────────────────────

interface PrecioHistorico {
  ultimoPrecio: number | null;
  promedio: number | null;
  minimo: number | null;
  maximo: number | null;
  totalCompras: number;
}

interface IntelProducto {
  precioHistorico: PrecioHistorico;
  loading: boolean;
}

interface WizardStepInteligenciaProps {
  productos: ProductoOrden[];
  tcCompra: number;
  costoShippingUSD?: number;
  cargosOC?: Array<{ montoUSD: number }>;
  descuentosOC?: Array<{ montoUSD: number }>;
}

// ─── Score → KPI 1 (label/tono agregado) ──────────────────────────
// El score por-producto y su label/tono ahora vienen del helper PURO
// (analizarPrecio). Esta función SOLO mapea el score AGREGADO del strip
// a label + tono, reutilizando los mismos umbrales del helper.

function scoreLabelAndTone(score: number): { label: string; tone: ScoreTone } {
  if (score === 0) return { label: 'Sin datos suficientes', tone: 'slate' };
  if (score >= 85) return { label: 'Excelente · comprar', tone: 'emerald' };
  if (score >= 70) return { label: 'Bueno · comprar', tone: 'emerald' };
  if (score >= 55) return { label: 'Aceptable · revisar', tone: 'amber' };
  if (score >= 40) return { label: 'Dudoso · revisar', tone: 'amber' };
  return { label: 'No recomendable', tone: 'rose' };
}

// ─── Main Component ───────────────────────────────────────────────
// S42ak — UI alineada al mockup S40 L1160-1252:
//   Header + 4 KPI cards horizontales + Tabla "Análisis por producto"
// F3 · El cálculo por-producto ahora lo resuelve el motor PURO analizarPrecio
// (precioInteligencia.helper · 3 bugs corregidos · alimentado por calcularInvestigacion
// = fuente VIVA de margen/PVP). Solo se preserva la presentación pre-DS.

export const WizardStepInteligencia: React.FC<WizardStepInteligenciaProps> = ({
  productos, tcCompra, costoShippingUSD = 0, cargosOC = [], descuentosOC = [],
}) => {
  const [intel, setIntel] = useState<Record<string, IntelProducto>>({});
  const { productos: catalogo } = useProductoStore();

  // Total costos adicionales (cargos - descuentos) prorrateados por unidad
  const totalUnidadesCalc = productos.reduce((s, p) => s + (p.cantidad || 0), 0);
  const totalCargosUSD = cargosOC.reduce((s, c) => s + (c.montoUSD || 0), 0);
  const totalDescuentosUSD = descuentosOC.reduce((s, d) => s + (d.montoUSD || 0), 0);
  const costosAdicionalesUSD = totalCargosUSD - totalDescuentosUSD;
  const costoAdicionalPorUnidad = totalUnidadesCalc > 0 ? costosAdicionalesUSD / totalUnidadesCalc : 0;

  // Load price history
  useEffect(() => {
    productos.forEach(async (p) => {
      if (!p.productoId || intel[p.productoId]) return;
      setIntel(prev => ({
        ...prev,
        [p.productoId]: { precioHistorico: { ultimoPrecio: null, promedio: null, minimo: null, maximo: null, totalCompras: 0 }, loading: true },
      }));
      try {
        const hist = await OrdenCompraService.getPreciosHistoricos(p.productoId);
        const precios = hist.map(h => h.costoUnitarioUSD).filter(x => x > 0);
        setIntel(prev => ({
          ...prev,
          [p.productoId]: {
            precioHistorico: {
              ultimoPrecio: precios.length > 0 ? precios[precios.length - 1] : null,
              promedio: precios.length > 0 ? precios.reduce((a, b) => a + b, 0) / precios.length : null,
              minimo: precios.length > 0 ? Math.min(...precios) : null,
              maximo: precios.length > 0 ? Math.max(...precios) : null,
              totalCompras: hist.length,
            },
            loading: false,
          },
        }));
      } catch {
        setIntel(prev => ({
          ...prev,
          [p.productoId]: { precioHistorico: { ultimoPrecio: null, promedio: null, minimo: null, maximo: null, totalCompras: 0 }, loading: false },
        }));
      }
    });
  }, [productos]);

  // Investigación VIVA por producto · calcularInvestigacion (fuente única de margen/PVP)
  // Reemplaza la lectura de campos deprecados (precioUSAMin/precioPERUMin/margenEstimado).
  const invMap = useMemo(() => {
    const m: Record<string, InvestigacionViva | null> = {};
    for (const p of productos) {
      const item = catalogo.find(c => c.id === p.productoId);
      if (item?.investigacion) {
        const calc = calcularInvestigacion(item, tcCompra);
        m[p.productoId] = {
          precioMejorProvUSD: calc.precioMejorProvUSD,
          precioEfectivo: calc.precioEfectivo,
          tieneProveedores: calc.tieneProveedores,
          tieneCompetidores: calc.tieneCompetidores,
        };
      } else {
        m[p.productoId] = null;
      }
    }
    return m;
  }, [productos, catalogo, tcCompra]);

  // Puntuación de viabilidad por producto (factor 10% del score · de la investigación)
  const viabilidadMap = useMemo(() => {
    const m: Record<string, number | undefined> = {};
    for (const p of productos) {
      const item = catalogo.find(c => c.id === p.productoId);
      m[p.productoId] = item?.investigacion?.puntuacionViabilidad;
    }
    return m;
  }, [productos, catalogo]);

  // Per-product analysis · TODO via analizarPrecio (motor PURO · 3 bugs corregidos)
  const analysis = useMemo(() => productos.map(prod => {
    const data = intel[prod.productoId];
    const hist = data?.precioHistorico ?? { ultimoPrecio: null, promedio: null, minimo: null, maximo: null, totalCompras: 0 };
    const inv = invMap[prod.productoId] ?? null;
    const loading = data?.loading ?? true;
    const res = analizarPrecio({
      costoUnitarioUSD: prod.costoUnitario,
      costoAdicionalPorUnidadUSD: costoAdicionalPorUnidad,
      tc: tcCompra,
      referencia: { ultimaCompra: hist.ultimoPrecio, promedio: hist.promedio, nMuestras: hist.totalCompras },
      investigacion: inv,
      puntuacionViabilidad: viabilidadMap[prod.productoId],
    });
    const score = loading ? 0 : res.score;
    const ctru = res.landedUnitPEN;            // landed PEN (incl. cargos prorrateados)
    const inversion = (prod.costoUnitario || 0) * (prod.cantidad || 0);
    return { prod, hist, inv, loading, score, res, ctru, inversion };
  }), [productos, intel, invMap, viabilidadMap, tcCompra, costoAdicionalPorUnidad]);

  // Aggregates
  const totalUds = productos.reduce((s, p) => s + (p.cantidad || 0), 0);
  const totalUSD = productos.reduce((s, p) => s + (p.costoUnitario || 0) * (p.cantidad || 0), 0);
  const avgScore = analysis.filter(a => a.score > 0).length > 0
    ? Math.round(analysis.filter(a => a.score > 0).reduce((s, a) => s + a.score, 0) / analysis.filter(a => a.score > 0).length)
    : 0;
  const alertas = analysis.filter(a => !a.loading && a.score > 0 && a.score < 45).length;

  // ─── Agregados para los 4 KPIs del mockup ────────────────────────
  // Todos ponderados por inversión (USD) o unidades según corresponda.
  const kpis = useMemo(() => {
    let inversionActualUSD = 0;
    let inversionHistoricaUSD = 0;
    let pvpSum = 0;
    let pvpWeight = 0;
    let ctruSum = 0;
    let ctruWeight = 0;
    let margenSum = 0;
    let margenWeight = 0;
    let huboHistorico = false;

    analysis.forEach(({ prod, hist, res }) => {
      const uds = prod.cantidad || 0;
      const costoAct = prod.costoUnitario || 0;
      const inversionAct = costoAct * uds;
      inversionActualUSD += inversionAct;

      if (hist.promedio && hist.promedio > 0) {
        inversionHistoricaUSD += hist.promedio * uds;
        huboHistorico = true;
      } else {
        inversionHistoricaUSD += inversionAct;
      }

      // PVP y CTRU (landed) del motor PURO · margen ya calculado por el helper
      const pvp = res.precioVentaPEN;
      const ctru = res.landedUnitPEN;

      if (pvp && pvp > 0 && uds > 0) {
        pvpSum += pvp * uds;
        pvpWeight += uds;
      }

      if (ctru && ctru > 0 && uds > 0) {
        ctruSum += ctru * uds;
        ctruWeight += uds;
      }

      if (res.margenPct !== null && inversionAct > 0) {
        margenSum += res.margenPct * inversionAct;
        margenWeight += inversionAct;
      }
    });

    const precioVsHistoricoPct = huboHistorico && inversionHistoricaUSD > 0
      ? ((inversionActualUSD - inversionHistoricaUSD) / inversionHistoricaUSD) * 100
      : null;
    const precioActualProm = totalUds > 0 ? inversionActualUSD / totalUds : 0;
    const precioHistoricoProm = huboHistorico && totalUds > 0 ? inversionHistoricaUSD / totalUds : null;

    return {
      precioVsHistoricoPct,
      precioActualProm,
      precioHistoricoProm,
      pvpPromedio: pvpWeight > 0 ? pvpSum / pvpWeight : null,
      ctruPromedio: ctruWeight > 0 ? ctruSum / ctruWeight : null,
      margenPromedio: margenWeight > 0 ? margenSum / margenWeight : null,
    };
  }, [analysis, totalUds]);

  // ─── Empty state ─────────────────────────────────────────────────
  if (productos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <Layers className="w-12 h-12 text-slate-300" />
        <p className="text-slate-500 text-sm">No hay productos en esta orden.</p>
      </div>
    );
  }

  const scoreMeta = scoreLabelAndTone(avgScore);

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* KPI Grid 4 cols — mockup L1174-1195 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* KPI 1 — Score de viabilidad */}
        <div className={cn(
          'p-4 border rounded-xl text-center',
          scoreMeta.tone === 'emerald' && 'bg-emerald-50 border-emerald-200',
          scoreMeta.tone === 'amber' && 'bg-amber-50 border-amber-200',
          scoreMeta.tone === 'rose' && 'bg-red-50 border-red-200',
          scoreMeta.tone === 'slate' && 'bg-slate-50 border-slate-200',
        )}>
          <div className={cn(
            'text-[10px] font-semibold uppercase mb-1',
            scoreMeta.tone === 'emerald' && 'text-emerald-700',
            scoreMeta.tone === 'amber' && 'text-amber-700',
            scoreMeta.tone === 'rose' && 'text-red-700',
            scoreMeta.tone === 'slate' && 'text-slate-500',
          )}>
            Score de viabilidad
          </div>
          <div className={cn(
            'text-3xl font-bold',
            scoreMeta.tone === 'emerald' && 'text-emerald-700',
            scoreMeta.tone === 'amber' && 'text-amber-700',
            scoreMeta.tone === 'rose' && 'text-red-700',
            scoreMeta.tone === 'slate' && 'text-slate-400',
          )}>
            {avgScore > 0 ? avgScore : '—'}
          </div>
          <div className={cn(
            'text-[11px] mt-1',
            scoreMeta.tone === 'emerald' && 'text-emerald-600',
            scoreMeta.tone === 'amber' && 'text-amber-600',
            scoreMeta.tone === 'rose' && 'text-red-600',
            scoreMeta.tone === 'slate' && 'text-slate-500',
          )}>
            {scoreMeta.label}
          </div>
        </div>

        {/* KPI 2 — Precio vs histórico */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl">
          <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
            Precio vs histórico
          </div>
          <div className={cn(
            'text-xl font-bold',
            kpis.precioVsHistoricoPct === null && 'text-slate-400',
            kpis.precioVsHistoricoPct !== null && kpis.precioVsHistoricoPct < -0.5 && 'text-emerald-700',
            kpis.precioVsHistoricoPct !== null && kpis.precioVsHistoricoPct > 0.5 && 'text-amber-700',
            kpis.precioVsHistoricoPct !== null && Math.abs(kpis.precioVsHistoricoPct) <= 0.5 && 'text-slate-600',
          )}>
            {kpis.precioVsHistoricoPct === null
              ? '—'
              : `${kpis.precioVsHistoricoPct > 0 ? '+' : ''}${kpis.precioVsHistoricoPct.toFixed(1)}%`}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {kpis.precioHistoricoProm !== null
              ? `$ ${kpis.precioActualProm.toFixed(2)} vs $ ${kpis.precioHistoricoProm.toFixed(2)} (prom compras)`
              : 'Sin histórico previo'}
          </div>
        </div>

        {/* KPI 3 — Margen proyectado */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl">
          <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
            Margen proyectado
          </div>
          <div className={cn(
            'text-xl font-bold',
            kpis.margenPromedio === null && 'text-slate-400',
            kpis.margenPromedio !== null && kpis.margenPromedio >= 45 && 'text-emerald-700',
            kpis.margenPromedio !== null && kpis.margenPromedio >= 30 && kpis.margenPromedio < 45 && 'text-amber-700',
            kpis.margenPromedio !== null && kpis.margenPromedio < 30 && 'text-red-700',
          )}>
            {kpis.margenPromedio !== null ? `${kpis.margenPromedio.toFixed(0)}%` : '—'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {kpis.ctruPromedio !== null && kpis.pvpPromedio !== null
              ? `S/ ${kpis.ctruPromedio.toFixed(0)} → S/ ${kpis.pvpPromedio.toFixed(0)} PVP sugerido`
              : 'Sin datos de PVP'}
          </div>
        </div>

        {/* KPI 4 — CTRU estimado */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl">
          <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
            CTRU estimado
          </div>
          <div className="text-xl font-bold text-slate-900">
            {kpis.ctruPromedio !== null ? `S/ ${kpis.ctruPromedio.toFixed(2)}` : '—'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {costosAdicionalesUSD > 0
              ? `incl. cargos prorrateados (+S/ ${(costoAdicionalPorUnidad * tcCompra).toFixed(2)}/ud)`
              : 'sin cargos adicionales'}
          </div>
        </div>
      </div>

      {/* Tabla "Análisis por producto" — mockup L1197-1251 */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
          <span className="text-xs font-semibold text-slate-700">Análisis por producto</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Producto</th>
                <th className="px-4 py-2 text-right font-medium">Precio actual</th>
                <th className="px-4 py-2 text-right font-medium">Mejor histórico</th>
                <th className="px-4 py-2 text-right font-medium">Diferencia</th>
                <th className="px-4 py-2 text-right font-medium">Margen esperado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analysis.map(({ prod, hist, loading, res }) => {
                const emoji = getEmojiPorProducto(prod).emoji;
                const mejorHist = hist.minimo && hist.minimo > 0 ? hist.minimo : null;
                // Margen del motor PURO (vivo · fix bug margen deprecado). La "Diferencia" de ESTA
                // columna es vs el MEJOR histórico que se muestra al lado (coherente con su propia
                // columna) · el semáforo unificado vs-promedio vive en StepProductos + el KPI, no acá.
                const margen = res.margenPct;
                const diffPct = mejorHist && prod.costoUnitario > 0
                  ? ((prod.costoUnitario - mejorHist) / mejorHist) * 100
                  : null;

                return (
                  <tr key={prod.productoId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{emoji}</span>
                        <span className="font-medium text-slate-800">
                          {prod.nombreComercial || prod.sku || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-900 tabular-nums">
                      {prod.costoUnitario > 0 ? `$ ${prod.costoUnitario.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600 tabular-nums">
                      {loading ? (
                        <span className="inline-block w-14 h-3 bg-slate-100 rounded animate-pulse" />
                      ) : mejorHist ? (
                        <>
                          $ {mejorHist.toFixed(2)}
                          {hist.totalCompras > 0 && (
                            <span className="text-[11px] text-slate-400 ml-1">
                              ({hist.totalCompras}c)
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className={cn(
                      'px-4 py-2 text-right tabular-nums',
                      diffPct === null && 'text-slate-400 italic',
                      diffPct !== null && diffPct < -0.5 && 'text-emerald-700',
                      diffPct !== null && diffPct > 0.5 && 'text-amber-700',
                      diffPct !== null && Math.abs(diffPct) <= 0.5 && 'text-slate-500',
                    )}>
                      {diffPct === null
                        ? (loading ? <span className="inline-block w-10 h-3 bg-slate-100 rounded animate-pulse" /> : 'primera vez')
                        : `${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}%`}
                    </td>
                    <td className={cn(
                      'px-4 py-2 text-right font-semibold tabular-nums',
                      margen === null && 'text-slate-400',
                      margen !== null && margen >= 45 && 'text-emerald-700',
                      margen !== null && margen >= 30 && margen < 45 && 'text-amber-700',
                      margen !== null && margen < 30 && 'text-red-700',
                    )}>
                      {margen !== null ? `${margen.toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer alertas */}
      {alertas > 0 && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            {alertas} producto{alertas > 1 ? 's' : ''} con score bajo ({'<'}45). Revisa antes de continuar.
          </span>
        </div>
      )}

      {/* Resumen inversión total (footer informativo) */}
      <div className="text-xs text-slate-500 flex items-center gap-4 px-1">
        <span>
          Inversión total: <strong className="text-slate-700 tabular-nums">${totalUSD.toFixed(2)}</strong>
        </span>
        <span>·</span>
        <span>
          {productos.length} producto{productos.length > 1 ? 's' : ''} · {totalUds} unidad{totalUds !== 1 ? 'es' : ''}
        </span>
        {costosAdicionalesUSD > 0 && (
          <>
            <span>·</span>
            <span className="text-amber-700">
              +${costosAdicionalesUSD.toFixed(2)} en cargos adicionales
            </span>
          </>
        )}
      </div>
    </div>
  );
};
