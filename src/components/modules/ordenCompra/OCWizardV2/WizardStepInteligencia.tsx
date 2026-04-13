import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  DollarSign, Package, Layers, BarChart3,
} from 'lucide-react';
import { cn } from '../../../../design-system';
import type { StatusVariant } from '../../../../design-system';
import type { ProductoOrden } from '../../../../types/ordenCompra.types';
import { OrdenCompraService } from '../../../../services/ordenCompra.service';
import { useProductoStore } from '../../../../store/productoStore';

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

// ─── Score Ring (SVG) ─────────────────────────────────────────────

const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 52 }) => {
  const sw = 4;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : score > 0 ? '#ef4444' : '#cbd5e1';
  const textColor = score >= 70 ? 'text-emerald-700' : score >= 45 ? 'text-amber-700' : score > 0 ? 'text-red-700' : 'text-slate-400';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700 ease-out" />
      </svg>
      <span className={cn('absolute text-xs font-bold', textColor)}>{score > 0 ? score : '—'}</span>
    </div>
  );
};

// ─── Delta display ────────────────────────────────────────────────

const Delta: React.FC<{ current: number; reference: number; label: string }> = ({ current, reference, label }) => {
  if (reference <= 0 || current <= 0) return null;
  const diff = ((current - reference) / reference) * 100;
  const isDown = diff < 0;
  const isFlat = Math.abs(diff) < 0.5;

  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-medium',
      isFlat ? 'text-slate-400' : isDown ? 'text-emerald-600' : 'text-red-600',
    )}>
      {isFlat ? <Minus className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
      {isFlat ? '=' : `${isDown ? '' : '+'}${diff.toFixed(1)}%`}
      <span className="text-slate-400 ml-0.5">vs {label}</span>
    </span>
  );
};

// ─── Compute product score (numeric only) ─────────────────────────

function computeScore(
  prod: ProductoOrden,
  hist: PrecioHistorico,
  inv: any | null,
  tcCompra: number,
  costoAdicionalPorUnidadUSD: number,
): number {
  let total = 0;
  let weight = 0;

  // 1. Price vs historical average (30%)
  if (hist.promedio && hist.promedio > 0 && prod.costoUnitario > 0) {
    const diff = ((prod.costoUnitario - hist.promedio) / hist.promedio) * 100;
    const s = diff <= -10 ? 100 : diff <= -5 ? 90 : diff <= 0 ? 75 : diff <= 5 ? 55 : diff <= 10 ? 35 : 10;
    total += s * 30;
    weight += 30;
  }

  // 2. Real margin with charges (35%) — uses competitor price -5% vs CTRU with charges
  const ctruConCargos = prod.costoUnitario > 0 && tcCompra > 0
    ? (prod.costoUnitario + costoAdicionalPorUnidadUSD) * tcCompra
    : null;
  const precioVenta = inv?.precioPERUMin > 0 ? inv.precioPERUMin * 0.95 : (inv?.precioSugeridoCalculado > 0 ? inv.precioSugeridoCalculado : null);
  if (ctruConCargos && precioVenta && precioVenta > 0) {
    const margenReal = ((precioVenta - ctruConCargos) / precioVenta) * 100;
    const s = margenReal >= 45 ? 100 : margenReal >= 35 ? 85 : margenReal >= 25 ? 65 : margenReal >= 15 ? 40 : margenReal >= 0 ? 20 : 5;
    total += s * 35;
    weight += 35;
  } else if (inv?.margenEstimado > 0) {
    // Fallback to research margin if no competitor data
    const s = inv.margenEstimado >= 45 ? 100 : inv.margenEstimado >= 35 ? 85 : inv.margenEstimado >= 25 ? 65 : inv.margenEstimado >= 15 ? 40 : 15;
    total += s * 35;
    weight += 35;
  }

  // 3. Charge burden (20%) — penalizes if charges are a large % of product cost
  if (prod.costoUnitario > 0 && costoAdicionalPorUnidadUSD > 0) {
    const chargeRatio = (costoAdicionalPorUnidadUSD / prod.costoUnitario) * 100;
    const s = chargeRatio <= 5 ? 95 : chargeRatio <= 10 ? 75 : chargeRatio <= 20 ? 55 : chargeRatio <= 35 ? 30 : 10;
    total += s * 20;
    weight += 20;
  } else if (prod.costoUnitario > 0) {
    // No charges = perfect score on this dimension
    total += 100 * 20;
    weight += 20;
  }

  // 4. Viability from research (15%)
  if (inv?.puntuacionViabilidad > 0) {
    total += inv.puntuacionViabilidad * 15;
    weight += 15;
  }

  return weight > 0 ? Math.round(total / weight) : 0;
}

// ─── Main Component ───────────────────────────────────────────────

export const WizardStepInteligencia: React.FC<WizardStepInteligenciaProps> = ({
  productos, tcCompra, costoShippingUSD = 0, cargosOC = [], descuentosOC = [],
}) => {
  const [intel, setIntel] = useState<Record<string, IntelProducto>>({});
  const { productos: catalogo } = useProductoStore();

  // Total costos adicionales (cargos - descuentos) prorrateados por unidad
  // Nota: costoShippingUSD ya está incluido en cargosOC (auto-sincronizado)
  const totalUnidadesCalc = productos.reduce((s, p) => s + (p.cantidad || 0), 0);
  const totalCargosUSD = cargosOC.reduce((s, c) => s + (c.montoUSD || 0), 0);
  const totalDescuentosUSD = descuentosOC.reduce((s, d) => s + (d.montoUSD || 0), 0);
  const costosAdicionalesUSD = totalCargosUSD - totalDescuentosUSD;
  const costoAdicionalPorUnidad = totalUnidadesCalc > 0 ? costosAdicionalesUSD / totalUnidadesCalc : 0;

  // Load price history
  useEffect(() => {
    productos.forEach(async (p) => {
      if (!p.productoId || intel[p.productoId]) return;
      setIntel(prev => ({ ...prev, [p.productoId]: { precioHistorico: { ultimoPrecio: null, promedio: null, minimo: null, maximo: null, totalCompras: 0 }, loading: true } }));
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
        setIntel(prev => ({ ...prev, [p.productoId]: { precioHistorico: { ultimoPrecio: null, promedio: null, minimo: null, maximo: null, totalCompras: 0 }, loading: false } }));
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
  }), [productos, intel, invMap, tcCompra]);

  // Aggregates
  const totalUds = productos.reduce((s, p) => s + (p.cantidad || 0), 0);
  const totalUSD = productos.reduce((s, p) => s + (p.costoUnitario || 0) * (p.cantidad || 0), 0);
  const avgScore = analysis.filter(a => a.score > 0).length > 0
    ? Math.round(analysis.filter(a => a.score > 0).reduce((s, a) => s + a.score, 0) / analysis.filter(a => a.score > 0).length)
    : 0;
  const alertas = analysis.filter(a => !a.loading && a.score > 0 && a.score < 45).length;

  if (productos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <Layers className="w-12 h-12 text-slate-300" />
        <p className="text-slate-500 text-sm">No hay productos en esta orden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900">Inteligencia Comercial</h2>
        <p className="text-sm text-slate-500 mt-1">Análisis de precios, márgenes e histórico de compra</p>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">

        {/* ─── Order Summary Banner ─── */}
        <div className={cn(
          'rounded-2xl p-5 border',
          avgScore >= 70 ? 'bg-emerald-50/60 border-emerald-200' :
          avgScore >= 45 ? 'bg-amber-50/60 border-amber-200' :
          avgScore > 0 ? 'bg-red-50/60 border-red-200' :
          'bg-slate-50 border-slate-200',
        )}>
          <div className="flex items-center gap-5">
            <ScoreRing score={avgScore} size={60} />
            <div className="flex-1">
              <h3 className="text-base font-bold text-slate-900">
                {avgScore >= 70 ? 'Compra favorable' : avgScore >= 45 ? 'Compra con observaciones' : avgScore > 0 ? 'Revisar antes de continuar' : 'Sin datos suficientes'}
              </h3>
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm">
                <span className="tabular-nums"><span className="text-slate-500">Inversión:</span> <strong>${totalUSD.toFixed(2)}</strong></span>
                <span className="tabular-nums"><span className="text-slate-500">Productos:</span> <strong>{productos.length}</strong> ({totalUds} uds)</span>
                {alertas > 0 && (
                  <span className="text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {alertas} alerta{alertas > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {/* Charge impact detail */}
              {costosAdicionalesUSD > 0 && (
                <div className="mt-3 pt-3 border-t border-current/10 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Costo productos</span>
                    <span className="font-semibold tabular-nums">${totalUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-amber-700">
                    <span>+ Cargos adicionales</span>
                    <span className="font-semibold tabular-nums">+${costosAdicionalesUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-800">Costo total de la orden</span>
                    <span className="tabular-nums">${(totalUSD + costosAdicionalesUSD).toFixed(2)}</span>
                  </div>
                  <p className="text-amber-600 text-[10px] mt-1">
                    Los cargos representan el {((costosAdicionalesUSD / totalUSD) * 100).toFixed(0)}% del valor de productos — encarece el CTRU en +${costoAdicionalPorUnidad.toFixed(2)}/ud
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Product Cards ─── */}
        {analysis.map(({ prod, hist, inv, loading, score, ctru, ctruBase, inversion, mejorPrecioProveedor }) => (
          <div
            key={prod.productoId}
            className={cn(
              'bg-white border rounded-2xl overflow-hidden',
              !loading && score > 0 && score < 45 ? 'border-red-200' : 'border-slate-200',
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-4 pb-2">
              <ScoreRing score={score} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-slate-400">{prod.sku}</span>
                  {loading && <div className="w-14 h-3 bg-slate-100 rounded animate-pulse" />}
                </div>
                <h4 className="font-semibold text-slate-900 text-sm">{prod.nombreComercial}</h4>
                <p className="text-[11px] text-slate-400">
                  {[prod.marca, prod.presentacion, prod.contenido, prod.dosaje, prod.sabor, prod.pesoLibras ? `${prod.pesoLibras} lb` : null].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>

            {/* Numbers Grid */}
            <div className="px-5 py-3">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-slate-100 rounded-xl overflow-hidden">
                {/* Precio actual */}
                <div className="bg-white p-3 text-center">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide">Precio</p>
                  <p className="text-sm font-bold tabular-nums text-slate-900 mt-1">
                    {prod.costoUnitario > 0 ? `$${prod.costoUnitario.toFixed(2)}` : '—'}
                  </p>
                </div>

                {/* Mejor precio proveedor */}
                <div className="bg-white p-3 text-center">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide">Mejor prov.</p>
                  <p className={cn(
                    'text-sm font-bold tabular-nums mt-1',
                    mejorPrecioProveedor && prod.costoUnitario > 0
                      ? prod.costoUnitario <= mejorPrecioProveedor ? 'text-emerald-700' : 'text-red-700'
                      : 'text-slate-900',
                  )}>
                    {mejorPrecioProveedor ? `$${mejorPrecioProveedor.toFixed(2)}` : '—'}
                  </p>
                </div>

                {/* Promedio histórico */}
                <div className="bg-white p-3 text-center">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide">Hist. prom.</p>
                  <p className="text-sm font-bold tabular-nums text-slate-900 mt-1">
                    {hist.promedio ? `$${hist.promedio.toFixed(2)}` : '—'}
                  </p>
                  {hist.totalCompras > 0 && (
                    <p className="text-[9px] text-slate-400">{hist.totalCompras} compra{hist.totalCompras > 1 ? 's' : ''}</p>
                  )}
                </div>

                {/* CTRU estimado (incluye cargos prorrateados) */}
                <div className={cn('p-3 text-center', costoAdicionalPorUnidad > 0 ? 'bg-amber-50' : 'bg-white')}>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide">CTRU est.</p>
                  <p className={cn('text-sm font-bold tabular-nums mt-1', costoAdicionalPorUnidad > 0 ? 'text-amber-800' : 'text-slate-900')}>
                    {ctru ? `S/${ctru.toFixed(2)}` : '—'}
                  </p>
                  {costoAdicionalPorUnidad > 0 && ctruBase !== null && (
                    <p className="text-[9px] text-amber-500">
                      +S/{(costoAdicionalPorUnidad * tcCompra).toFixed(0)} cargos
                    </p>
                  )}
                </div>

                {/* Margen — calculado: (precioVenta - CTRU) / precioVenta */}
                {(() => {
                  // Precio de venta = competidor más barato - 5%
                  const precioCompetidor = inv?.precioPERUMin > 0 ? inv.precioPERUMin : null;
                  const precioVenta = precioCompetidor ? precioCompetidor * 0.95 : (inv?.precioSugeridoCalculado > 0 ? inv.precioSugeridoCalculado : null);
                  const margen = precioVenta && ctru && ctru > 0 ? ((precioVenta - ctru) / precioVenta) * 100 : (inv?.margenEstimado > 0 ? inv.margenEstimado : null);
                  const utilidad = precioVenta && ctru ? precioVenta - ctru : null;

                  const margenColor = margen !== null && margen >= 30 ? 'emerald' : margen !== null && margen >= 15 ? 'amber' : margen !== null && margen > 0 ? 'red' : null;

                  return (
                    <div className={cn('p-3 text-center', margenColor ? `bg-${margenColor}-50` : 'bg-white')}>
                      <p className="text-[9px] text-slate-400 uppercase tracking-wide">Utilidad</p>
                      <p className={cn(
                        'text-sm font-bold tabular-nums mt-1',
                        margenColor ? `text-${margenColor}-700` : 'text-slate-900',
                      )}>
                        {utilidad !== null ? `S/${utilidad.toFixed(0)}` : margen !== null ? `${margen.toFixed(0)}%` : '—'}
                      </p>
                      {margen !== null && utilidad !== null && (
                        <p className={cn('text-[9px]', margenColor ? `text-${margenColor}-500` : 'text-slate-400')}>
                          {margen.toFixed(0)}%
                          {precioCompetidor ? ' (comp -5%)' : ''}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Inversión */}
                <div className="bg-white p-3 text-center">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide">Inversión</p>
                  <p className="text-sm font-bold tabular-nums text-slate-900 mt-1">
                    ${inversion.toFixed(2)}
                  </p>
                  <p className="text-[9px] text-slate-400">{prod.cantidad} uds</p>
                </div>
              </div>
            </div>

            {/* Deltas row */}
            {prod.costoUnitario > 0 && !loading && (
              <div className="px-5 pb-3 flex flex-wrap gap-x-4 gap-y-1">
                {hist.promedio && <Delta current={prod.costoUnitario} reference={hist.promedio} label="promedio" />}
                {hist.ultimoPrecio && <Delta current={prod.costoUnitario} reference={hist.ultimoPrecio} label="última compra" />}
                {hist.minimo && hist.minimo !== hist.promedio && <Delta current={prod.costoUnitario} reference={hist.minimo} label="mínimo" />}
                {mejorPrecioProveedor && <Delta current={prod.costoUnitario} reference={mejorPrecioProveedor} label="mejor prov." />}
              </div>
            )}

            {/* Alert if significantly above historical */}
            {!loading && hist.promedio && prod.costoUnitario > 0 && ((prod.costoUnitario - hist.promedio) / hist.promedio) > 0.10 && (
              <div className="mx-5 mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-700">
                  Precio {(((prod.costoUnitario - hist.promedio) / hist.promedio) * 100).toFixed(0)}% por encima del promedio histórico (${ hist.promedio.toFixed(2)}). Verifica antes de continuar.
                </p>
              </div>
            )}

            {/* Viability bar if available */}
            {inv?.puntuacionViabilidad > 0 && (
              <div className="px-5 pb-4 flex items-center gap-3">
                <span className="text-[9px] text-slate-400 uppercase tracking-wide w-14">Viabilidad</span>
                <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', inv.puntuacionViabilidad >= 60 ? 'bg-emerald-500' : inv.puntuacionViabilidad >= 40 ? 'bg-amber-500' : 'bg-red-500')}
                    style={{ width: `${inv.puntuacionViabilidad}%` }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-slate-600 w-8 text-right">{inv.puntuacionViabilidad}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
