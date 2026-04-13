import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, Info,
  Globe, ShieldCheck, Target, BarChart3, Zap,
  ArrowUpRight, ArrowDownRight, Activity, Package,
  DollarSign, Percent, Users, Layers,
} from 'lucide-react';
import { cn, StatusBadge, text as dsText } from '../../../../design-system';
import type { StatusVariant } from '../../../../design-system';
import type { ProductoOrden } from '../../../../types/ordenCompra.types';
import { OrdenCompraService } from '../../../../services/ordenCompra.service';
import { useProductoStore } from '../../../../store/productoStore';

// ─── Types ────────────────────────────────────────────────────────

interface PrecioHistorico {
  ultimoPrecio: number | null;
  promedio: number | null;
  totalCompras: number;
}

interface IntelProducto {
  precioHistorico: PrecioHistorico;
  loading: boolean;
}

interface WizardStepInteligenciaProps {
  productos: ProductoOrden[];
  tcCompra: number;
}

// ─── Score Engine ─────────────────────────────────────────────────

function computeProductScore(
  prod: ProductoOrden,
  historico: PrecioHistorico,
  inv: any | null,
  tcCompra: number,
): { score: number; signals: Signal[]; verdict: StatusVariant } {
  const signals: Signal[] = [];
  let totalWeight = 0;
  let totalScore = 0;

  // 1. Price vs historical (weight: 30)
  if (historico.ultimoPrecio && historico.ultimoPrecio > 0 && prod.costoUnitario > 0) {
    const diff = ((prod.costoUnitario - historico.ultimoPrecio) / historico.ultimoPrecio) * 100;
    const priceScore = diff <= -5 ? 95 : diff <= 0 ? 80 : diff <= 5 ? 60 : diff <= 10 ? 35 : 10;
    totalScore += priceScore * 30;
    totalWeight += 30;
    signals.push({
      icon: diff <= 0 ? ArrowDownRight : ArrowUpRight,
      label: diff <= 0 ? `${Math.abs(diff).toFixed(1)}% bajo histórico` : `${diff.toFixed(1)}% sobre histórico`,
      variant: diff <= -5 ? 'success' : diff <= 0 ? 'success' : diff <= 5 ? 'warning' : 'danger',
      category: 'precio',
    });
  } else if (historico.totalCompras === 0) {
    signals.push({ icon: Info, label: 'Primera compra — sin referencia de precio', variant: 'neutral', category: 'precio' });
  }

  // 2. Market viability (weight: 25)
  if (inv?.puntuacionViabilidad > 0) {
    totalScore += inv.puntuacionViabilidad * 25;
    totalWeight += 25;
  }

  // 3. Estimated margin (weight: 25)
  if (inv?.margenEstimado > 0) {
    const marginScore = inv.margenEstimado >= 40 ? 95 : inv.margenEstimado >= 30 ? 80 : inv.margenEstimado >= 20 ? 60 : inv.margenEstimado >= 10 ? 35 : 10;
    totalScore += marginScore * 25;
    totalWeight += 25;
    signals.push({
      icon: Percent,
      label: `Margen estimado: ${inv.margenEstimado.toFixed(0)}%`,
      variant: inv.margenEstimado >= 30 ? 'success' : inv.margenEstimado >= 15 ? 'warning' : 'danger',
      category: 'margen',
    });
  }

  // 4. Competition level (weight: 10)
  if (inv?.nivelCompetencia) {
    const compMap: Record<string, number> = { baja: 90, media: 65, alta: 40, saturada: 15 };
    const compScore = compMap[inv.nivelCompetencia] || 50;
    totalScore += compScore * 10;
    totalWeight += 10;
    signals.push({
      icon: Users,
      label: `Competencia ${inv.nivelCompetencia}${inv.numeroCompetidores > 0 ? ` (${inv.numeroCompetidores})` : ''}`,
      variant: compScore >= 65 ? 'success' : compScore >= 40 ? 'warning' : 'danger',
      category: 'competencia',
    });
  }

  // 5. Demand (weight: 10)
  if (inv?.demandaEstimada) {
    const demMap: Record<string, number> = { alta: 90, media: 60, baja: 25 };
    const demScore = demMap[inv.demandaEstimada] || 50;
    totalScore += demScore * 10;
    totalWeight += 10;
    signals.push({
      icon: Activity,
      label: `Demanda ${inv.demandaEstimada}${inv.tendencia ? ` · ${inv.tendencia === 'subiendo' ? '↑' : inv.tendencia === 'bajando' ? '↓' : '→'}` : ''}`,
      variant: demScore >= 60 ? 'success' : demScore >= 40 ? 'warning' : 'danger',
      category: 'demanda',
    });
  }

  // Recommendation signal
  if (inv?.recomendacion) {
    const recomMap: Record<string, { label: string; variant: StatusVariant }> = {
      importar: { label: 'Recomendado para importar', variant: 'success' },
      investigar_mas: { label: 'Requiere más investigación', variant: 'warning' },
      descartar: { label: 'No recomendado', variant: 'danger' },
    };
    const r = recomMap[inv.recomendacion];
    if (r) signals.push({ icon: Target, label: r.label, variant: r.variant, category: 'recomendacion' });
  }

  const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  const verdict: StatusVariant = finalScore >= 70 ? 'success' : finalScore >= 45 ? 'warning' : finalScore > 0 ? 'danger' : 'neutral';

  return { score: finalScore, signals, verdict };
}

interface Signal {
  icon: typeof TrendingUp;
  label: string;
  variant: StatusVariant;
  category: string;
}

// ─── Score Ring ────────────────────────────────────────────────────

const ScoreRing: React.FC<{ score: number; variant: StatusVariant; size?: number }> = ({ score, variant, size = 56 }) => {
  const strokeWidth = 4;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const colorMap: Record<StatusVariant, string> = {
    success: '#10b981', warning: '#f59e0b', danger: '#ef4444',
    info: '#0ea5e9', neutral: '#94a3b8', brand: '#0d9488',
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={colorMap[variant]} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className={cn('absolute text-sm font-bold', score >= 70 ? 'text-emerald-700' : score >= 45 ? 'text-amber-700' : score > 0 ? 'text-red-700' : 'text-slate-400')}>
        {score > 0 ? score : '—'}
      </span>
    </div>
  );
};

// ─── Metric Pill ──────────────────────────────────────────────────

const MetricPill: React.FC<{ label: string; value: string; sub?: string; variant?: StatusVariant }> = ({ label, value, sub, variant }) => {
  const bg = variant ? { success: 'bg-emerald-50', warning: 'bg-amber-50', danger: 'bg-red-50', info: 'bg-sky-50', neutral: 'bg-slate-50', brand: 'bg-teal-50' }[variant] : 'bg-slate-50';
  const textColor = variant ? { success: 'text-emerald-800', warning: 'text-amber-800', danger: 'text-red-800', info: 'text-sky-800', neutral: 'text-slate-800', brand: 'text-teal-800' }[variant] : 'text-slate-900';

  return (
    <div className={cn('rounded-lg px-3 py-2', bg)}>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={cn('text-sm font-bold tabular-nums mt-0.5', textColor)}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
};

// ─── Signal Row ───────────────────────────────────────────────────

const SignalRow: React.FC<{ signal: Signal }> = ({ signal }) => {
  const Icon = signal.icon;
  const colorMap: Record<StatusVariant, string> = {
    success: 'text-emerald-500', warning: 'text-amber-500', danger: 'text-red-500',
    info: 'text-sky-500', neutral: 'text-slate-400', brand: 'text-teal-500',
  };
  const bgMap: Record<StatusVariant, string> = {
    success: 'bg-emerald-50', warning: 'bg-amber-50', danger: 'bg-red-50',
    info: 'bg-sky-50', neutral: 'bg-slate-50', brand: 'bg-teal-50',
  };

  return (
    <div className={cn('flex items-center gap-2.5 px-3 py-2 rounded-lg', bgMap[signal.variant])}>
      <Icon className={cn('w-4 h-4 flex-shrink-0', colorMap[signal.variant])} />
      <span className="text-xs font-medium text-slate-800">{signal.label}</span>
    </div>
  );
};

// ─── Order Health Banner ──────────────────────────────────────────

const OrderHealthBanner: React.FC<{ avgScore: number; totalInversion: number; productos: number; unidades: number; alertCount: number }> = ({
  avgScore, totalInversion, productos, unidades, alertCount,
}) => {
  const verdict = avgScore >= 70 ? 'success' : avgScore >= 45 ? 'warning' : avgScore > 0 ? 'danger' : 'neutral';
  const verdictLabels: Record<string, string> = {
    success: 'Compra recomendada', warning: 'Compra con observaciones', danger: 'Compra con riesgo', neutral: 'Sin datos suficientes',
  };
  const verdictColors: Record<string, string> = {
    success: 'from-emerald-50 to-emerald-100/50 border-emerald-200',
    warning: 'from-amber-50 to-amber-100/50 border-amber-200',
    danger: 'from-red-50 to-red-100/50 border-red-200',
    neutral: 'from-slate-50 to-slate-100/50 border-slate-200',
  };

  return (
    <div className={cn('bg-gradient-to-r border rounded-2xl p-5', verdictColors[verdict])}>
      <div className="flex items-center gap-4">
        <ScoreRing score={avgScore} variant={verdict} size={64} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">{verdictLabels[verdict]}</h3>
            <StatusBadge variant={verdict as StatusVariant} dot>{avgScore > 0 ? `${avgScore}/100` : '—'}</StatusBadge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-600">
            <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-slate-400" /> ${totalInversion.toFixed(2)} USD</span>
            <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5 text-slate-400" /> {productos} productos · {unidades} uds</span>
            {alertCount > 0 && <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3.5 h-3.5" /> {alertCount} alerta{alertCount > 1 ? 's' : ''}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────

export const WizardStepInteligencia: React.FC<WizardStepInteligenciaProps> = ({
  productos,
  tcCompra,
}) => {
  const [intel, setIntel] = useState<Record<string, IntelProducto>>({});
  const { productos: catalogoProductos } = useProductoStore();

  // Load price history
  useEffect(() => {
    productos.forEach(async (p) => {
      if (!p.productoId || intel[p.productoId]) return;
      setIntel((prev) => ({
        ...prev,
        [p.productoId]: { precioHistorico: { ultimoPrecio: null, promedio: null, totalCompras: 0 }, loading: true },
      }));
      try {
        const historico = await OrdenCompraService.getPreciosHistoricos(p.productoId);
        const precios = historico.map((h) => h.costoUnitarioUSD).filter((x) => x > 0);
        setIntel((prev) => ({
          ...prev,
          [p.productoId]: {
            precioHistorico: {
              ultimoPrecio: precios.length > 0 ? precios[precios.length - 1] : null,
              promedio: precios.length > 0 ? precios.reduce((a, b) => a + b, 0) / precios.length : null,
              totalCompras: historico.length,
            },
            loading: false,
          },
        }));
      } catch {
        setIntel((prev) => ({
          ...prev,
          [p.productoId]: { precioHistorico: { ultimoPrecio: null, promedio: null, totalCompras: 0 }, loading: false },
        }));
      }
    });
  }, [productos]);

  // Market research map
  const investigacionMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const prod of productos) {
      const item = catalogoProductos.find(c => c.id === prod.productoId);
      if (item?.investigacion) map[prod.productoId] = item.investigacion;
    }
    return map;
  }, [productos, catalogoProductos]);

  // Compute scores
  const productScores = useMemo(() => {
    return productos.map((prod) => {
      const data = intel[prod.productoId];
      const historico = data?.precioHistorico ?? { ultimoPrecio: null, promedio: null, totalCompras: 0 };
      const inv = investigacionMap[prod.productoId] ?? null;
      const loading = data?.loading ?? true;
      const result = loading ? { score: 0, signals: [], verdict: 'neutral' as StatusVariant } : computeProductScore(prod, historico, inv, tcCompra);
      const ctruUnit = prod.costoUnitario > 0 && tcCompra > 0 ? prod.costoUnitario * tcCompra : null;
      return { prod, historico, inv, loading, ctruUnit, ...result };
    });
  }, [productos, intel, investigacionMap, tcCompra]);

  // Aggregates
  const totalUnidades = productos.reduce((s, p) => s + (p.cantidad || 0), 0);
  const subtotalUSD = productos.reduce((s, p) => s + (p.costoUnitario || 0) * (p.cantidad || 0), 0);
  const avgScore = productScores.filter(p => p.score > 0).length > 0
    ? Math.round(productScores.filter(p => p.score > 0).reduce((s, p) => s + p.score, 0) / productScores.filter(p => p.score > 0).length)
    : 0;
  const alertCount = productScores.filter(p => p.verdict === 'danger' || p.verdict === 'warning').length;

  if (productos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <Layers className="w-12 h-12 text-slate-300" />
        <p className="text-slate-500 text-sm">No hay productos en esta orden.</p>
        <p className="text-slate-400 text-xs">Agrega productos en el paso anterior.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900">Inteligencia Comercial</h2>
        <p className="text-sm text-slate-500 mt-1">Análisis integral de tu selección de compra</p>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        {/* Order Health Banner */}
        <OrderHealthBanner
          avgScore={avgScore}
          totalInversion={subtotalUSD}
          productos={productos.length}
          unidades={totalUnidades}
          alertCount={alertCount}
        />

        {/* Product Analysis Cards */}
        {productScores.map(({ prod, historico, inv, loading, score, signals, verdict, ctruUnit }) => {
          const inversion = (prod.costoUnitario || 0) * (prod.cantidad || 0);

          return (
            <div
              key={prod.productoId}
              className={cn(
                'bg-white border rounded-2xl overflow-hidden transition-all',
                verdict === 'danger' ? 'border-red-200' : verdict === 'warning' ? 'border-amber-200' : 'border-slate-200',
              )}
            >
              {/* Card Header */}
              <div className="flex items-center gap-4 px-5 py-4">
                <ScoreRing score={score} variant={verdict} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">{prod.sku}</span>
                    {inv?.recomendacion && (
                      <StatusBadge
                        variant={inv.recomendacion === 'importar' ? 'success' : inv.recomendacion === 'descartar' ? 'danger' : 'warning'}
                      >
                        {inv.recomendacion === 'importar' ? 'Importar' : inv.recomendacion === 'descartar' ? 'Descartar' : 'Investigar'}
                      </StatusBadge>
                    )}
                    {loading && <div className="w-16 h-4 bg-slate-100 rounded animate-pulse" />}
                  </div>
                  <h4 className="font-semibold text-slate-900 text-sm mt-0.5">{prod.nombreComercial}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[prod.marca, prod.presentacion, prod.contenido, prod.dosaje, prod.sabor, prod.pesoLibras ? `${prod.pesoLibras} lb` : null].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>

              {/* Metrics Row */}
              <div className="px-5 pb-1">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <MetricPill
                    label="Precio compra"
                    value={prod.costoUnitario > 0 ? `$${prod.costoUnitario.toFixed(2)}` : '—'}
                    sub={historico.ultimoPrecio ? `Último: $${historico.ultimoPrecio.toFixed(2)}` : undefined}
                    variant={
                      historico.ultimoPrecio && prod.costoUnitario > 0
                        ? prod.costoUnitario <= historico.ultimoPrecio ? 'success' : 'danger'
                        : undefined
                    }
                  />
                  <MetricPill
                    label="CTRU est."
                    value={ctruUnit ? `S/${ctruUnit.toFixed(2)}` : '—'}
                    sub={inv?.ctruEstimado > 0 ? `Inv: S/${inv.ctruEstimado.toFixed(2)}` : undefined}
                  />
                  <MetricPill
                    label="Margen"
                    value={inv?.margenEstimado > 0 ? `${inv.margenEstimado.toFixed(0)}%` : '—'}
                    sub={inv?.precioSugeridoCalculado > 0 ? `Venta: S/${inv.precioSugeridoCalculado.toFixed(0)}` : undefined}
                    variant={inv?.margenEstimado >= 30 ? 'success' : inv?.margenEstimado >= 15 ? 'warning' : inv?.margenEstimado > 0 ? 'danger' : undefined}
                  />
                  <MetricPill
                    label="Cantidad"
                    value={`${prod.cantidad} uds`}
                  />
                  <MetricPill
                    label="Inversión"
                    value={inversion > 0 ? `$${inversion.toFixed(2)}` : '—'}
                  />
                </div>
              </div>

              {/* Signals */}
              {signals.length > 0 && (
                <div className="px-5 py-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {signals.map((sig, i) => (
                      <SignalRow key={i} signal={sig} />
                    ))}
                  </div>
                </div>
              )}

              {/* Viability bar */}
              {inv?.puntuacionViabilidad > 0 && (
                <div className="px-5 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide w-16">Viabilidad</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          inv.puntuacionViabilidad >= 60 ? 'bg-emerald-500' : inv.puntuacionViabilidad >= 40 ? 'bg-amber-500' : 'bg-red-500',
                        )}
                        style={{ width: `${inv.puntuacionViabilidad}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-700 w-10 text-right">{inv.puntuacionViabilidad}</span>
                  </div>
                </div>
              )}

              {/* Reasoning */}
              {inv?.razonamiento && (
                <div className="px-5 pb-4">
                  <p className="text-[11px] text-slate-500 italic leading-relaxed">{inv.razonamiento}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
