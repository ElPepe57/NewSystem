import React, { useEffect, useState, useMemo } from 'react';
import { Layers, AlertTriangle } from 'lucide-react';
import { cn } from '../../../../design-system';
import type { ProductoOrden } from '../../../../types/ordenCompra.types';
import { OrdenCompraService } from '../../../../services/ordenCompra.service';
import { useProductoStore } from '../../../../store/productoStore';
import { getEmojiPorProducto } from './productoEmoji';

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

// ─── Compute product score (numeric only) ─────────────────────────
// Lógica intacta desde S41 — 40% precio / 30% margen / 20% carga / 10% inv.

function computeScore(
  prod: ProductoOrden,
  hist: PrecioHistorico,
  inv: any | null,
  tcCompra: number,
  costoAdicionalPorUnidadUSD: number,
): number {
  let total = 0;
  let weight = 0;
  const mejorProv = inv?.precioUSAMin > 0 ? inv.precioUSAMin : null;

  // 1. Price vs best provider (40%)
  if (mejorProv && prod.costoUnitario > 0) {
    const diff = ((prod.costoUnitario - mejorProv) / mejorProv) * 100;
    const s = diff <= -5 ? 95 : diff <= 0 ? 85 : diff <= 2 ? 65 : diff <= 5 ? 45 : diff <= 10 ? 25 : 10;
    total += s * 40;
    weight += 40;
  } else if (hist.promedio && hist.promedio > 0 && prod.costoUnitario > 0) {
    const diff = ((prod.costoUnitario - hist.promedio) / hist.promedio) * 100;
    const s = diff <= -5 ? 90 : diff <= 0 ? 75 : diff <= 5 ? 50 : diff <= 10 ? 30 : 10;
    total += s * 40;
    weight += 40;
  }

  // 2. Margin with charges (30%)
  const ctruConCargos = prod.costoUnitario > 0 && tcCompra > 0
    ? (prod.costoUnitario + costoAdicionalPorUnidadUSD) * tcCompra
    : null;
  const precioVenta = inv?.precioPERUMin > 0
    ? inv.precioPERUMin * 0.95
    : (inv?.precioSugeridoCalculado > 0 ? inv.precioSugeridoCalculado : null);
  if (ctruConCargos && precioVenta && precioVenta > 0) {
    const margenReal = ((precioVenta - ctruConCargos) / precioVenta) * 100;
    const s = margenReal >= 60 ? 90 : margenReal >= 45 ? 75 : margenReal >= 30 ? 60 : margenReal >= 15 ? 35 : margenReal >= 0 ? 15 : 5;
    total += s * 30;
    weight += 30;
  } else if (inv?.margenEstimado > 0) {
    const s = inv.margenEstimado >= 60 ? 90 : inv.margenEstimado >= 45 ? 75 : inv.margenEstimado >= 30 ? 60 : inv.margenEstimado >= 15 ? 35 : 10;
    total += s * 30;
    weight += 30;
  }

  // 3. Charge burden (20%)
  if (prod.costoUnitario > 0) {
    const chargeRatio = costoAdicionalPorUnidadUSD > 0 ? (costoAdicionalPorUnidadUSD / prod.costoUnitario) * 100 : 0;
    const s = chargeRatio === 0 ? 70 : chargeRatio <= 5 ? 65 : chargeRatio <= 10 ? 55 : chargeRatio <= 20 ? 40 : chargeRatio <= 35 ? 25 : 10;
    total += s * 20;
    weight += 20;
  }

  // 4. Viability from research (10%)
  if (inv?.puntuacionViabilidad > 0) {
    total += inv.puntuacionViabilidad * 10;
    weight += 10;
  }

  return weight > 0 ? Math.round(total / weight) : 0;
}

// ─── Score label (para KPI 1) ─────────────────────────────────────

function scoreLabelAndTone(score: number): { label: string; tone: 'emerald' | 'amber' | 'red' | 'slate' } {
  if (score === 0) return { label: 'Sin datos suficientes', tone: 'slate' };
  if (score >= 85) return { label: 'Excelente · comprar', tone: 'emerald' };
  if (score >= 70) return { label: 'Bueno · comprar', tone: 'emerald' };
  if (score >= 55) return { label: 'Aceptable · revisar', tone: 'amber' };
  if (score >= 40) return { label: 'Dudoso · revisar', tone: 'amber' };
  return { label: 'No recomendable', tone: 'red' };
}

// ─── Main Component ───────────────────────────────────────────────
// S42ak — UI alineada al mockup S40 L1160-1252:
//   Header + 4 KPI cards horizontales + Tabla "Análisis por producto"
// Toda la lógica de cálculo (intel hook, invMap, analysis, computeScore)
// se mantiene intacta desde S41 — solo cambia la presentación.

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

  // Market research
  const invMap = useMemo(() => {
    const m: Record<string, any> = {};
    for (const p of productos) {
      const item = catalogo.find(c => c.id === p.productoId);
      if (item?.investigacion) m[p.productoId] = item.investigacion;
    }
    return m;
  }, [productos, catalogo]);

  // Per-product analysis
  const analysis = useMemo(() => productos.map(prod => {
    const data = intel[prod.productoId];
    const hist = data?.precioHistorico ?? { ultimoPrecio: null, promedio: null, minimo: null, maximo: null, totalCompras: 0 };
    const inv = invMap[prod.productoId] ?? null;
    const loading = data?.loading ?? true;
    const score = loading ? 0 : computeScore(prod, hist, inv, tcCompra, costoAdicionalPorUnidad);
    const ctruBase = prod.costoUnitario > 0 && tcCompra > 0 ? prod.costoUnitario * tcCompra : null;
    const ctru = ctruBase !== null ? ctruBase + (costoAdicionalPorUnidad * tcCompra) : null;
    const inversion = (prod.costoUnitario || 0) * (prod.cantidad || 0);
    const mejorPrecioProveedor = inv?.precioUSAMin > 0 ? inv.precioUSAMin : null;
    return { prod, hist, inv, loading, score, ctru, ctruBase, inversion, mejorPrecioProveedor };
  }), [productos, intel, invMap, tcCompra, costoAdicionalPorUnidad]);

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

    analysis.forEach(({ prod, hist, inv, ctru }) => {
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

      const pvp = inv?.precioPERUMin > 0
        ? inv.precioPERUMin * 0.95
        : (inv?.precioSugeridoCalculado > 0 ? inv.precioSugeridoCalculado : null);

      if (pvp && uds > 0) {
        pvpSum += pvp * uds;
        pvpWeight += uds;
      }

      if (ctru && ctru > 0 && uds > 0) {
        ctruSum += ctru * uds;
        ctruWeight += uds;
      }

      if (pvp && ctru && pvp > 0 && ctru > 0 && inversionAct > 0) {
        const margen = ((pvp - ctru) / pvp) * 100;
        margenSum += margen * inversionAct;
        margenWeight += inversionAct;
      } else if (inv?.margenEstimado > 0 && inversionAct > 0) {
        margenSum += inv.margenEstimado * inversionAct;
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
          scoreMeta.tone === 'red' && 'bg-red-50 border-red-200',
          scoreMeta.tone === 'slate' && 'bg-slate-50 border-slate-200',
        )}>
          <div className={cn(
            'text-[10px] font-semibold uppercase mb-1',
            scoreMeta.tone === 'emerald' && 'text-emerald-700',
            scoreMeta.tone === 'amber' && 'text-amber-700',
            scoreMeta.tone === 'red' && 'text-red-700',
            scoreMeta.tone === 'slate' && 'text-slate-500',
          )}>
            Score de viabilidad
          </div>
          <div className={cn(
            'text-3xl font-bold',
            scoreMeta.tone === 'emerald' && 'text-emerald-700',
            scoreMeta.tone === 'amber' && 'text-amber-700',
            scoreMeta.tone === 'red' && 'text-red-700',
            scoreMeta.tone === 'slate' && 'text-slate-400',
          )}>
            {avgScore > 0 ? avgScore : '—'}
          </div>
          <div className={cn(
            'text-[11px] mt-1',
            scoreMeta.tone === 'emerald' && 'text-emerald-600',
            scoreMeta.tone === 'amber' && 'text-amber-600',
            scoreMeta.tone === 'red' && 'text-red-600',
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
              {analysis.map(({ prod, hist, inv, loading, ctru }) => {
                const emoji = getEmojiPorProducto(prod).emoji;
                const mejorHist = hist.minimo && hist.minimo > 0 ? hist.minimo : null;
                const diffPct =
                  mejorHist && prod.costoUnitario > 0
                    ? ((prod.costoUnitario - mejorHist) / mejorHist) * 100
                    : null;
                const pvp = inv?.precioPERUMin > 0
                  ? inv.precioPERUMin * 0.95
                  : (inv?.precioSugeridoCalculado > 0 ? inv.precioSugeridoCalculado : null);
                const margen = pvp && ctru && pvp > 0 && ctru > 0
                  ? ((pvp - ctru) / pvp) * 100
                  : (inv?.margenEstimado > 0 ? inv.margenEstimado : null);

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
