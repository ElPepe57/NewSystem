/**
 * TabPipeline · Tab "Pipeline" del modal detalle producto · ⭐ pieza estrella
 *
 * Mockup canónico: docs/mockups/productos/15c-modal-detalle-pipeline-valorizacion.html
 *
 * Estructura:
 *   1. Pipeline horizontal · 6 etapas (Proveedor → Casillas USA → Aduana →
 *      Almacén PE → En entrega → Vendido)
 *      Cada etapa: cantidad uds + costo unitario que crece + valor total
 *   2. 4 KPIs financieros: Capital invertido · Capital atrapado · Si vendieras
 *      todo · Ingresos del mes
 *   3. 4 Insights de inteligencia (gradient cards)
 *
 * Layout:
 *   DESKTOP: Pipeline horizontal con flechas (chevron-right) entre etapas
 *   MOBILE:  Pipeline vertical (cards apiladas con conector ↓)
 *
 * Refleja la cita del usuario en docs/mockups/productos-intel-s58f.html:
 * "el valor en cada punto donde se encontrara"
 */

import React, { useMemo } from 'react';
import {
  Factory,
  Globe,
  PackageX,
  Warehouse,
  Truck,
  CheckCircle,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Zap,
  AlertCircle,
  TrendingUp,
  Lightbulb,
} from 'lucide-react';
import type { Producto } from '../../../../types/producto.types';
import { calcularInvestigacion } from '../../utils/investigacionCalculos';

interface TabPipelineProps {
  producto: Producto;
}

interface Etapa {
  num: number;
  label: string;
  subtitulo: string;
  uds: number;
  costoUnit?: { valor: string; moneda: string };
  total?: { valor: string; moneda: string };
  extras?: { label: string; valor: string }[];
  variant: 'slate' | 'sky' | 'amber' | 'teal' | 'purple' | 'emerald';
  icon: typeof Factory;
}

function getStock(p: Producto): number {
  return (p as any).stockDisponible ?? (p as any).stockTotal ?? 0;
}

export const TabPipeline: React.FC<TabPipelineProps> = ({ producto }) => {
  const stockPeru = (producto as any).stockDisponiblePeru ?? (producto as any).stockPeru ?? getStock(producto);
  const stockUSA = (producto as any).stockUSA ?? 0;
  const stockTransito = (producto as any).stockTransito ?? 0;
  const stockReservado = (producto as any).stockReservado ?? 0;
  const ventasMes = (producto as any).ventasMes ?? 0;
  const ctru = producto.investigacion?.ctruEstimado ?? producto.ctruPromedio ?? 0;
  const proveedorPrincipal = producto.investigacion?.proveedoresUSA?.[0];
  const costoEXW = proveedorPrincipal?.precio ?? 0;
  const fleteIntl = producto.costoFleteInternacional ?? 4.5;
  const precioVenta = calcularInvestigacion(producto).precioEfectivo;

  // 6 etapas del pipeline
  const etapas: Etapa[] = useMemo(
    () => [
      {
        num: 1,
        label: 'Proveedor',
        subtitulo: proveedorPrincipal?.nombre ?? 'Sin proveedor',
        uds: 0,
        costoUnit: costoEXW > 0 ? { valor: costoEXW.toFixed(2), moneda: '$' } : undefined,
        extras: costoEXW > 0 ? [{ label: '≈ S/', valor: (costoEXW * 3.85).toFixed(2) }] : undefined,
        variant: 'slate',
        icon: Factory,
      },
      {
        num: 2,
        label: 'Casillas USA',
        subtitulo: 'En tránsito intl.',
        uds: stockUSA,
        costoUnit: costoEXW > 0 ? { valor: costoEXW.toFixed(2), moneda: '$' } : undefined,
        total: stockUSA > 0 && costoEXW > 0 ? { valor: (stockUSA * costoEXW * 3.85).toFixed(0), moneda: 'S/' } : undefined,
        variant: 'sky',
        icon: Globe,
      },
      {
        num: 3,
        label: 'Aduana',
        subtitulo: 'Callao',
        uds: stockTransito,
        costoUnit: costoEXW > 0 ? { valor: (costoEXW + fleteIntl).toFixed(2), moneda: '$' } : undefined,
        extras: [{ label: '+ flete', valor: `$ ${fleteIntl.toFixed(2)}` }],
        total:
          stockTransito > 0 && costoEXW > 0
            ? { valor: (stockTransito * (costoEXW + fleteIntl) * 3.85).toFixed(0), moneda: 'S/' }
            : undefined,
        variant: 'amber',
        icon: PackageX,
      },
      {
        num: 4,
        label: 'Almacén PE',
        subtitulo: 'Lima',
        uds: stockPeru,
        costoUnit: ctru > 0 ? { valor: ctru.toFixed(2), moneda: 'S/' } : undefined,
        extras:
          costoEXW > 0
            ? [{ label: '+ imp 18%', valor: `$ ${(costoEXW * 0.18).toFixed(2)}` }]
            : undefined,
        total: stockPeru > 0 && ctru > 0 ? { valor: (stockPeru * ctru).toFixed(0), moneda: 'S/' } : undefined,
        variant: 'teal',
        icon: Warehouse,
      },
      {
        num: 5,
        label: 'En entrega',
        subtitulo: 'Drivers + reservadas',
        uds: stockReservado,
        costoUnit: ctru > 0 ? { valor: ctru.toFixed(2), moneda: 'S/' } : undefined,
        total:
          stockReservado > 0 && ctru > 0 ? { valor: (stockReservado * ctru).toFixed(0), moneda: 'S/' } : undefined,
        variant: 'purple',
        icon: Truck,
      },
      {
        num: 6,
        label: 'Vendido (mes)',
        subtitulo: 'Mes actual',
        uds: ventasMes,
        costoUnit: precioVenta > 0 ? { valor: precioVenta.toFixed(2), moneda: 'S/' } : undefined,
        total: ventasMes > 0 && precioVenta > 0 ? { valor: (ventasMes * precioVenta).toFixed(0), moneda: 'S/' } : undefined,
        variant: 'emerald',
        icon: CheckCircle,
      },
    ],
    [stockUSA, stockTransito, stockPeru, stockReservado, ventasMes, ctru, costoEXW, fleteIntl, precioVenta, proveedorPrincipal]
  );

  // 4 KPIs financieros derivados
  const kpis = useMemo(() => {
    const inPipeline = stockUSA + stockTransito + stockPeru + stockReservado;
    const capitalInvertido =
      stockUSA * costoEXW * 3.85 +
      stockTransito * (costoEXW + fleteIntl) * 3.85 +
      stockPeru * ctru +
      stockReservado * ctru;
    const capitalAtrapado = stockUSA * costoEXW * 3.85 + stockTransito * (costoEXW + fleteIntl) * 3.85;
    const siVendieraTodo = inPipeline * precioVenta - capitalInvertido;
    const ingresosMes = ventasMes * precioVenta;
    return {
      capitalInvertido: Math.round(capitalInvertido),
      capitalAtrapado: Math.round(capitalAtrapado),
      siVendieraTodo: Math.round(siVendieraTodo),
      ingresosMes: Math.round(ingresosMes),
      inPipeline,
      atrapadoUds: stockUSA + stockTransito,
    };
  }, [stockUSA, stockTransito, stockPeru, stockReservado, ventasMes, ctru, costoEXW, fleteIntl, precioVenta]);

  // Score liquidez (placeholder · derivado de velocidad ventas vs stock)
  const scoreLiquidez = useMemo(() => {
    if (stockPeru === 0 || ventasMes === 0) return null;
    const ratio = (ventasMes * 6) / stockPeru;
    const score = Math.min(100, Math.round(ratio * 100));
    if (score >= 70) return { value: score, label: 'LÍQUIDO', color: 'emerald' };
    if (score >= 40) return { value: score, label: 'MEDIO', color: 'amber' };
    return { value: score, label: 'LENTO', color: 'rose' };
  }, [stockPeru, ventasMes]);

  // Empty state si no hay nada
  const sinDatos = etapas.every(e => !e.uds && !e.costoUnit);
  if (sinDatos) {
    return (
      <div className="p-3 lg:p-5">
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-8 lg:p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-7 h-7 text-indigo-700" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Pipeline sin datos</h3>
          <p className="text-xs lg:text-sm text-slate-500 max-w-md mx-auto">
            Este producto aún no tiene proveedores · stock · ni ventas. El pipeline se construirá automáticamente cuando
            ingreses datos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 lg:p-5 space-y-3 lg:space-y-4 max-h-[calc(90vh-220px)] lg:max-h-[600px] overflow-y-auto">
      {/* Header tab */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm lg:text-base font-bold text-slate-900 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            Pipeline de valorización
          </h3>
          <p className="text-[11px] lg:text-xs text-slate-500 mt-0.5">
            El valor unitario crece con cada etapa · {kpis.inPipeline} uds en pipeline
          </p>
        </div>
        {scoreLiquidez && (
          <span
            className={`px-2 py-1 rounded text-[10px] font-bold border ${
              scoreLiquidez.color === 'emerald'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : scoreLiquidez.color === 'amber'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            Score {scoreLiquidez.value} · {scoreLiquidez.label}
          </span>
        )}
      </div>

      {/* ═══════ PIPELINE · DESKTOP horizontal ═══════ */}
      <div className="hidden lg:block bg-gradient-to-b from-slate-50/60 to-white rounded-xl p-4">
        <div className="flex items-stretch gap-1.5">
          {etapas.map((e, idx) => (
            <React.Fragment key={e.num}>
              <EtapaCard etapa={e} />
              {idx < etapas.length - 1 && (
                <div className="flex items-center text-slate-300 flex-shrink-0">
                  <ChevronRight className="w-4 h-4" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ═══════ PIPELINE · MOBILE vertical (F12) ═══════ */}
      <div className="lg:hidden bg-gradient-to-b from-slate-50/60 to-white rounded-xl p-3 space-y-1.5">
        {etapas.map((e, idx) => (
          <React.Fragment key={e.num}>
            <EtapaCard etapa={e} mobile />
            {idx < etapas.length - 1 && (
              <div className="flex justify-center text-slate-300">
                <ChevronDown className="w-4 h-4" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ═══════ 4 KPIs FINANCIEROS ═══════ */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-3">
          Resumen financiero del pipeline
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
          <KpiCard
            label="Capital invertido total"
            value={`S/ ${kpis.capitalInvertido.toLocaleString()}`}
            sub={`en ${kpis.inPipeline} uds del pipeline`}
            tone="slate"
          />
          <KpiCard
            label="Capital atrapado"
            value={`S/ ${kpis.capitalAtrapado.toLocaleString()}`}
            sub={`en casillas + aduana (${kpis.atrapadoUds} uds)`}
            tone="amber"
          />
          <KpiCard
            label="Si vendieras todo"
            value={`+S/ ${kpis.siVendieraTodo.toLocaleString()}`}
            sub={`${kpis.inPipeline} uds × S/ ${Math.round(precioVenta)}`}
            tone="emerald"
          />
          <KpiCard
            label="Ingresos mes (real)"
            value={`S/ ${kpis.ingresosMes.toLocaleString()}`}
            sub={`${ventasMes} uds vendidas`}
            tone="indigo"
          />
        </div>
      </div>

      {/* ═══════ INSIGHTS ═══════ */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          Insights de inteligencia
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3">
          {scoreLiquidez && (
            <InsightCard
              icon={Zap}
              tone={scoreLiquidez.color as 'emerald' | 'amber' | 'rose'}
              title={`Score ${scoreLiquidez.value} · ${scoreLiquidez.label}`}
              text={`Velocidad real ${ventasMes} uds/mes · stock cubre ~${
                ventasMes > 0 ? Math.round(stockPeru / ventasMes) : '∞'
              } meses.`}
            />
          )}
          {kpis.atrapadoUds > 0 && (
            <InsightCard
              icon={AlertCircle}
              tone="amber"
              title={`${Math.round((kpis.atrapadoUds / Math.max(kpis.inPipeline, 1)) * 100)}% del stock fuera de PE`}
              text={`Tienes S/ ${kpis.capitalAtrapado.toLocaleString()} en casillas/aduana sin generar ingresos.`}
            />
          )}
          {ventasMes > 0 && (
            <InsightCard
              icon={TrendingUp}
              tone="indigo"
              title="Ventas activas"
              text={`${ventasMes} uds vendidas este mes · ingresos S/ ${kpis.ingresosMes.toLocaleString()}.`}
            />
          )}
          {stockPeru < 25 && stockPeru > 0 && (
            <InsightCard
              icon={Lightbulb}
              tone="purple"
              title="Sugerencia accionable"
              text={`Stock bajo en Almacén PE (${stockPeru} uds). Considera reordenar antes de quedar sin stock.`}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<Etapa['variant'], { ring: string; bg: string; iconColor: string; titleColor: string; valueColor: string }> = {
  slate: { ring: '', bg: 'bg-white', iconColor: 'text-slate-500', titleColor: 'text-slate-500', valueColor: 'text-slate-700' },
  sky: { ring: 'ring-1 ring-sky-200', bg: 'bg-sky-50/40', iconColor: 'text-sky-600', titleColor: 'text-sky-700', valueColor: 'text-sky-700' },
  amber: { ring: 'ring-1 ring-amber-200', bg: 'bg-amber-50/40', iconColor: 'text-amber-600', titleColor: 'text-amber-700', valueColor: 'text-amber-700' },
  teal: { ring: 'ring-2 ring-teal-300', bg: 'bg-gradient-to-br from-teal-50 to-white', iconColor: 'text-teal-600', titleColor: 'text-teal-700', valueColor: 'text-teal-700' },
  purple: { ring: 'ring-1 ring-purple-200', bg: 'bg-purple-50/40', iconColor: 'text-purple-600', titleColor: 'text-purple-700', valueColor: 'text-purple-700' },
  emerald: { ring: 'ring-2 ring-emerald-300', bg: 'bg-gradient-to-br from-emerald-50 to-white', iconColor: 'text-emerald-600', titleColor: 'text-emerald-700', valueColor: 'text-emerald-700' },
};

const EtapaCard: React.FC<{ etapa: Etapa; mobile?: boolean }> = ({ etapa, mobile }) => {
  const styles = VARIANT_STYLES[etapa.variant];
  const Icon = etapa.icon;
  return (
    <div
      className={`flex-1 min-w-0 rounded-lg p-2.5 lg:p-3 border border-slate-200 ${styles.bg} ${styles.ring} ${
        mobile ? 'flex items-center gap-3' : ''
      }`}
    >
      <div className={mobile ? 'flex-1 min-w-0' : ''}>
        <div className="flex items-center gap-1 mb-1">
          <Icon className={`w-3 h-3 ${styles.iconColor}`} />
          <span className={`text-[9px] uppercase tracking-wider font-bold ${styles.titleColor}`}>
            {etapa.num}. {etapa.label}
          </span>
        </div>
        {etapa.subtitulo && <div className={`text-[10px] mb-1.5 ${styles.titleColor} opacity-80 truncate`}>{etapa.subtitulo}</div>}
        <div className="text-base lg:text-lg font-bold text-slate-900 tabular-nums leading-tight">
          {etapa.uds}
          <span className="text-[10px] text-slate-400 font-normal ml-1">uds</span>
        </div>
      </div>

      {(etapa.costoUnit || etapa.total || etapa.extras) && (
        <div
          className={`${
            mobile ? 'flex-shrink-0 text-right space-y-0.5' : 'border-t border-slate-100 mt-2 pt-1.5 space-y-0.5'
          }`}
        >
          {etapa.extras?.map((ex, i) => (
            <div key={i} className="flex justify-between gap-2 text-[10px]">
              <span className="text-slate-500">{ex.label}</span>
              <span className="font-semibold tabular-nums text-slate-700">{ex.valor}</span>
            </div>
          ))}
          {etapa.costoUnit && (
            <div className="flex justify-between gap-2 text-[10px]">
              <span className="text-slate-500">Unit.</span>
              <span className={`font-semibold tabular-nums ${styles.valueColor}`}>
                {etapa.costoUnit.moneda} {etapa.costoUnit.valor}
              </span>
            </div>
          )}
          {etapa.total && (
            <div className="flex justify-between gap-2 text-[10px]">
              <span className="text-slate-500">Total</span>
              <span className={`font-bold tabular-nums ${styles.valueColor}`}>
                {etapa.total.moneda} {etapa.total.valor}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const KpiCard: React.FC<{ label: string; value: string; sub: string; tone: 'slate' | 'amber' | 'emerald' | 'indigo' }> = ({
  label,
  value,
  sub,
  tone,
}) => {
  const styles = {
    slate: { border: 'border-slate-200', bg: 'bg-white', textL: 'text-slate-500', textV: 'text-slate-900' },
    amber: { border: 'border-amber-200', bg: 'bg-gradient-to-br from-amber-50 to-white', textL: 'text-amber-700', textV: 'text-amber-700' },
    emerald: { border: 'border-emerald-200', bg: 'bg-gradient-to-br from-emerald-50 to-white', textL: 'text-emerald-700', textV: 'text-emerald-700' },
    indigo: { border: 'border-indigo-200', bg: 'bg-gradient-to-br from-indigo-50 to-white', textL: 'text-indigo-700', textV: 'text-indigo-700' },
  }[tone];

  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} p-3`}>
      <div className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${styles.textL}`}>{label}</div>
      <div className={`text-base lg:text-xl font-bold tabular-nums tracking-tight ${styles.textV}`}>{value}</div>
      <div className="text-[10px] text-slate-600 tabular-nums mt-1 leading-snug">{sub}</div>
    </div>
  );
};

const InsightCard: React.FC<{
  icon: typeof Zap;
  tone: 'emerald' | 'amber' | 'rose' | 'indigo' | 'purple';
  title: string;
  text: string;
}> = ({ icon: Icon, tone, title, text }) => {
  const styles = {
    emerald: { border: 'border-emerald-200', bg: 'bg-gradient-to-br from-emerald-50 to-white', iconText: 'text-emerald-700', titleText: 'text-emerald-900' },
    amber: { border: 'border-amber-200', bg: 'bg-gradient-to-br from-amber-50 to-white', iconText: 'text-amber-700', titleText: 'text-amber-900' },
    rose: { border: 'border-rose-200', bg: 'bg-gradient-to-br from-rose-50 to-white', iconText: 'text-rose-700', titleText: 'text-rose-900' },
    indigo: { border: 'border-indigo-200', bg: 'bg-gradient-to-br from-indigo-50 to-white', iconText: 'text-indigo-700', titleText: 'text-indigo-900' },
    purple: { border: 'border-purple-200', bg: 'bg-gradient-to-br from-purple-50 to-white', iconText: 'text-purple-700', titleText: 'text-purple-900' },
  }[tone];

  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} p-3`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 ${styles.iconText} flex-shrink-0 mt-0.5`} />
        <div className="text-[11px] text-slate-700 leading-relaxed">
          <strong className={styles.titleText}>{title}</strong>
          <br />
          {text}
        </div>
      </div>
    </div>
  );
};
