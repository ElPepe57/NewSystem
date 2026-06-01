/**
 * ResumenTab · dashboard ejecutivo · PRIMERA tab del módulo Stock/Inventario (chk5.DS-F3-STOCK)
 *
 * Pixel-perfect vs `docs/mockups/stock-resumen-v1.html` (ACTO 1 desktop · §BODY del Tab Resumen).
 * Canon hub: "primera tab siempre Resumen · dashboard ejecutivo".
 *
 * Orden canónico del Tab Resumen (§A→§F · Layout A main(2) + aside(1)):
 *   §A  Banner de estado (gradient emerald · valor total + inmovilizado)
 *   §B  Distribución de existencias (donut SVG + leyenda)
 *   §B2 Por línea de negocio (barras orange) + Por país (barras emerald/sky)
 *   §C  Insights del inventario (concentración · capital inmovilizado · días promedio)
 *   §D  Acciones rápidas (4 botones · 1ro orange primary)
 *   §F  Alertas top 3 + CTA "Ver todas en Atención"
 *   §E  Conecta con (cross-links 360 · Productos / CTRU / Compras / Envíos)
 *
 * Color del grupo Inventario = ORANGE en el chrome (acciones primary · cross-link Productos).
 * Semántico FIJO en los datos (emerald/sky/amber/rose/violet/indigo).
 *
 * NOTA: el shell (InventarioPageV2) ya envuelve este body en `bg-slate-50/30 px-6 py-5 space-y-4`,
 * por eso el componente NO repite ese wrapper · arranca directo con un Fragment §A + grid.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  PieChart,
  Lightbulb,
  TrendingUp,
  AlertOctagon,
  Info,
  Calendar,
  ShoppingCart,
  Package,
  Clock,
  TrendingDown,
  Search,
  ArrowRight,
  Tag,
  Calculator,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import type { ProductoConUnidades } from './ProductoInventarioTable';
import type { AlertaProducto } from './AlertasPrioritarias';
import type { CTRUProductoDetalle } from '../../../../store/ctruStore';

// ── Props (los pasa el shell InventarioPageV2) ──────────────────────────────
interface ResumenTabProps {
  stats: {
    total: number;
    disponiblePeru: number;
    reservada: number;
    reservadaOrigen: number;
    reservadaPeru: number;
    enTransito: number;
    enOrigen: number;
    problemas: number;
    valorTotalUSD: number;
    proximasAVencer: number;
  };
  productosConUnidades: ProductoConUnidades[];
  alertas: AlertaProducto[];
  ctruData?: CTRUProductoDetalle[];
  lineasNegocio: { id: string; nombre: string; codigo?: string }[];
  onVerVencimientos: () => void;
  onIrAtencion: () => void;
  onIrExistencias: () => void;
}

// ── Helpers de formato ──────────────────────────────────────────────────────
/** Compacto USD con `k`/`m` minúscula (pixel-perfect vs mockup "$19.8k") · sin espacio. */
function compactUSD(value: number): string {
  const abs = Math.abs(value);
  let body: string;
  if (abs >= 1_000_000) body = `$${(abs / 1_000_000).toFixed(1)}m`;
  else if (abs >= 1_000) body = `$${(abs / 1_000).toFixed(1)}k`;
  else body = `$${Math.round(abs)}`;
  return value < 0 ? `-${body}` : body;
}

/** USD con separadores de miles, sin decimales (mockup "$19,800"). */
function fullUSD(value: number): string {
  return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(value))}`;
}

const fmtInt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));

/** ms de una fecha tipo Firestore Timestamp (defensivo). */
function toMs(ts: any): number | null {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  return null;
}

const MS_90D = 90 * 24 * 60 * 60 * 1000;

// Iconos + color semántico por tipo de alerta (§F)
const ALERTA_ICON: Record<AlertaProducto['tipo'], { icon: LucideIcon; box: string; iconColor: string }> = {
  vencimiento:   { icon: Clock,        box: 'bg-rose-100',  iconColor: 'text-rose-700'  },
  stock_critico: { icon: TrendingDown, box: 'bg-rose-100',  iconColor: 'text-rose-700'  },
  sin_movimiento:{ icon: Search,       box: 'bg-amber-100', iconColor: 'text-amber-700' },
};

export const ResumenTab: React.FC<ResumenTabProps> = ({
  stats,
  productosConUnidades,
  alertas,
  ctruData,
  lineasNegocio,
  onVerVencimientos,
  onIrAtencion,
  onIrExistencias,
}) => {
  const navigate = useNavigate();

  // ── Cálculos derivados ────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const totalProductos = productosConUnidades.length;
    const totalUnidades = stats.total;
    const valorTotal = stats.valorTotalUSD;
    const pctDisponible = totalUnidades > 0 ? Math.round((stats.disponiblePeru / totalUnidades) * 100) : 0;

    // Inmovilizado: capital (costoUnitarioUSD) de unidades en stock (disponibles) cuya
    // fecha de recepción es > 90 días atrás → "sin movimiento". Suma a nivel UNIDAD (no
    // sobre-cuenta el producto entero). Si ningún dato de fecha, queda 0 (no se inventa).
    const ahora = Date.now();
    let inmovilizado = 0;
    let productosInmovilizados = 0;
    productosConUnidades.forEach((p) => {
      let pTieneInmovil = false;
      p.unidades.forEach((u) => {
        if (u.estado !== 'disponible' && u.estado !== 'disponible_peru') return;
        const ms = toMs((u as any).fechaRecepcion) ?? toMs((u as any).fechaCreacion);
        if (ms !== null && ahora - ms > MS_90D) {
          inmovilizado += u.costoUnitarioUSD || 0;
          pTieneInmovil = true;
        }
      });
      if (pTieneInmovil) productosInmovilizados++;
    });

    // Distribución por estado (donut §B) — 5 segmentos semánticos.
    const distSegments = [
      { key: 'disponible', label: 'Disponible',  value: stats.disponiblePeru, dotClass: 'bg-emerald-500', stroke: '#10b981' },
      { key: 'reservada',  label: 'Reservada',   value: stats.reservada,      dotClass: 'bg-sky-500',     stroke: '#0ea5e9' },
      { key: 'transito',   label: 'En tránsito', value: stats.enTransito,     dotClass: 'bg-amber-500',   stroke: '#f59e0b' },
      { key: 'origen',     label: 'En origen',   value: stats.enOrigen,       dotClass: 'bg-violet-500',  stroke: '#8b5cf6' },
      { key: 'problemas',  label: 'Problemas',   value: stats.problemas,      dotClass: 'bg-rose-500',    stroke: '#f43f5e' },
    ];
    const distTotal = distSegments.reduce((s, d) => s + d.value, 0) || 1;
    // Acumular offsets para el donut SVG (circumference normalizada a 100 · igual técnica que el mockup).
    let acc = 0;
    const donut = distSegments
      .filter((d) => d.value > 0)
      .map((d) => {
        const pct = (d.value / distTotal) * 100;
        const seg = { stroke: d.stroke, dash: pct, offset: -acc };
        acc += pct;
        return seg;
      });
    const distLegend = distSegments.map((d) => ({
      label: d.label,
      value: d.value,
      pct: Math.round((d.value / distTotal) * 100),
      dotClass: d.dotClass,
    }));

    // Por línea de negocio (§B2) — count de productos por línea, top 4 desc.
    const nombrePorLinea = new Map<string, string>();
    lineasNegocio.forEach((l) => nombrePorLinea.set(l.id, l.nombre));
    const countPorLinea = new Map<string, number>();
    productosConUnidades.forEach((p) => {
      const lid = p.lineaNegocioId ?? 'sin-linea';
      countPorLinea.set(lid, (countPorLinea.get(lid) ?? 0) + 1);
    });
    const lineasArr = Array.from(countPorLinea.entries())
      .map(([id, count]) => ({ id, nombre: nombrePorLinea.get(id) ?? 'Sin línea', count }))
      .sort((a, b) => b.count - a.count);
    const maxLineaCount = lineasArr.length > 0 ? lineasArr[0].count : 1;
    const lineas = lineasArr.slice(0, 4).map((l, i) => ({
      ...l,
      width: Math.round((l.count / maxLineaCount) * 100),
      // Degradado orange por ranking (mockup: 500 → 400 → 300 → 200).
      barClass: ['bg-orange-500', 'bg-orange-400', 'bg-orange-300', 'bg-orange-200'][i] ?? 'bg-orange-200',
    }));

    // Por país (§B2) — unidades en Perú vs origen/USA.
    let unidadesPeru = 0;
    let unidadesOrigen = 0;
    productosConUnidades.forEach((p) => {
      p.unidades.forEach((u) => {
        if (u.estado === 'vendida') return;
        if (u.pais === 'Peru' || u.pais === 'Peru_local') unidadesPeru++;
        else unidadesOrigen++;
      });
    });
    const paisTotal = unidadesPeru + unidadesOrigen || 1;
    const paises = [
      { label: '🇵🇪 Perú', count: unidadesPeru,   width: Math.round((unidadesPeru / paisTotal) * 100),   barClass: 'bg-emerald-500' },
      { label: '🇺🇸 USA',  count: unidadesOrigen, width: Math.round((unidadesOrigen / paisTotal) * 100), barClass: 'bg-sky-500' },
    ];

    // Insights (§C)
    const concentracionPct = lineasArr.length > 0 && totalProductos > 0
      ? Math.round((lineasArr[0].count / totalProductos) * 100)
      : 0;
    const lineaTop = lineasArr.length > 0 ? lineasArr[0].nombre : '—';

    // Días promedio en inventario (real · edad de unidades disponibles vía fechaRecepción).
    let sumDias = 0;
    let cntDias = 0;
    productosConUnidades.forEach((p) => {
      p.unidades.forEach((u) => {
        if (u.estado !== 'disponible' && u.estado !== 'disponible_peru') return;
        const ms = toMs((u as any).fechaRecepcion) ?? toMs((u as any).fechaCreacion);
        if (ms !== null) {
          sumDias += Math.max(0, Math.floor((ahora - ms) / (24 * 60 * 60 * 1000)));
          cntDias++;
        }
      });
    });
    const diasPromedio = cntDias > 0 ? Math.round(sumDias / cntDias) : null;
    const tieneCtru = Array.isArray(ctruData) && ctruData.length > 0;

    return {
      totalProductos,
      totalUnidades,
      valorTotal,
      pctDisponible,
      inmovilizado,
      productosInmovilizados,
      donut,
      distLegend,
      lineas,
      paises,
      unidadesOrigen,
      concentracionPct,
      lineaTop,
      diasPromedio,
      tieneCtru,
    };
  }, [stats, productosConUnidades, lineasNegocio, ctruData]);

  const top3Alertas = alertas.slice(0, 3);
  const hayInventario = productosConUnidades.length > 0;

  // ── Empty state limpio (sin crashear) ─────────────────────────────────────
  // El inventario NO se "sincroniza" manualmente: nace automáticamente al confirmar
  // una OC (genera las unidades) y transita estados con cada envío/venta. Por eso el
  // CTA del vacío apunta al ORIGEN del inventario (Compras), no a "Sincronizar".
  if (!hayInventario) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
        <div className="w-12 h-12 mx-auto rounded-xl bg-orange-100 flex items-center justify-center mb-3">
          <Package className="w-6 h-6 text-orange-600" />
        </div>
        <div className="text-sm font-bold text-slate-900 mb-1">Aún no tienes unidades en circulación</div>
        <p className="text-[12px] text-slate-500 max-w-sm mx-auto mb-4">
          Tu inventario se genera <b className="text-slate-600">automáticamente</b> al confirmar órdenes de compra y registrar envíos. Cuando tengas unidades verás aquí distribución, líneas de negocio, alertas y capital inmovilizado.
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/compras')}
            className="inline-flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg"
          >
            <ShoppingCart className="w-4 h-4" /> Crear orden de compra
          </button>
          <button
            type="button"
            onClick={() => navigate('/productos')}
            className="inline-flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
          >
            <Tag className="w-4 h-4 text-slate-400" /> Ver productos
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* §A · BANNER DE ESTADO */}
      <div className="bg-gradient-to-r from-emerald-50 to-emerald-100/30 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <div className="text-[13px] font-bold text-slate-900">
              Inventario saludable · {calc.pctDisponible}% disponible en Perú
            </div>
            <div className="text-[11px] text-slate-500 max-w-xl">
              Valor inmovilizado <b className="text-slate-700 tabular-nums">{fullUSD(calc.valorTotal)}</b> en{' '}
              <b className="tabular-nums">{fmtInt(calc.totalProductos)}</b> productos /{' '}
              <b className="tabular-nums">{fmtInt(calc.totalUnidades)}</b> unidades ·{' '}
              <b className="text-rose-700">{alertas.length} {alertas.length === 1 ? 'alerta' : 'alertas'}</b>{' '}
              {alertas.length === 1 ? 'abierta requiere' : 'abiertas requieren'} atención.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-center">
          <div>
            <div className="text-2xl font-bold tabular-nums text-emerald-700">{compactUSD(calc.valorTotal)}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Valor total</div>
          </div>
          <div className="w-px h-8 bg-slate-200"></div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-amber-700">{compactUSD(calc.inmovilizado)}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Inmovilizado</div>
          </div>
        </div>
      </div>

      {/* LAYOUT A · main(3) + aside(1) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* MAIN */}
        <div className="md:col-span-2 space-y-4">

          {/* §B · VISUALIZACIÓN · distribución de existencias */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Distribución de existencias</div>
                <div className="text-[10px] text-slate-500">Snapshot actual · {fmtInt(calc.totalUnidades)} unidades</div>
              </div>
              <PieChart className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex items-center gap-5 flex-wrap">
              {/* donut SVG · circumference normalizada a 100 */}
              <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90 flex-shrink-0">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                {calc.donut.map((seg, i) => (
                  <circle
                    key={i}
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke={seg.stroke}
                    strokeWidth="4"
                    strokeDasharray={`${seg.dash} 100`}
                    strokeDashoffset={seg.offset}
                  />
                ))}
              </svg>
              <div className="flex-1 min-w-[180px] space-y-1.5 text-xs">
                {calc.distLegend.map((d) => (
                  <div key={d.label} className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${d.dotClass}`}></span>
                    <span className="text-slate-700">{d.label}</span>
                    <span className="ml-auto font-bold text-slate-900 tabular-nums">{fmtInt(d.value)}</span>
                    <span className="text-slate-400 text-[10px] tabular-nums w-8 text-right">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* §B2 · por línea + por país */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-[12px] font-bold text-slate-900 mb-2">Por línea de negocio</div>
              <div className="space-y-1.5 text-[11px]">
                {calc.lineas.map((l) => (
                  <div key={l.id} className="flex items-center gap-2">
                    <span className="w-20 text-slate-600 truncate">{l.nombre}</span>
                    <div className="flex-1 bg-slate-100 rounded h-2">
                      <div className={`${l.barClass} h-2 rounded`} style={{ width: `${l.width}%` }}></div>
                    </div>
                    <span className="tabular-nums w-6 text-right">{fmtInt(l.count)}</span>
                  </div>
                ))}
                {calc.lineas.length === 0 && (
                  <div className="text-[10px] text-slate-400">Sin líneas asignadas.</div>
                )}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-[12px] font-bold text-slate-900 mb-2">Por país</div>
              <div className="space-y-1.5 text-[11px]">
                {calc.paises.map((p) => (
                  <div key={p.label} className="flex items-center gap-2">
                    <span className="w-20 text-slate-600 truncate">{p.label}</span>
                    <div className="flex-1 bg-slate-100 rounded h-2">
                      <div className={`${p.barClass} h-2 rounded`} style={{ width: `${p.width}%` }}></div>
                    </div>
                    <span className="tabular-nums w-9 text-right">{fmtInt(p.count)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-slate-400">
                {fmtInt(calc.unidadesOrigen)} unidades en origen · pendientes de despacho a Perú.
              </div>
            </div>
          </div>

          {/* §C · INSIGHTS */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-[12px] font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-500" /> Insights del inventario
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-start gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span className="text-slate-600">
                  <b className="text-slate-800">{calc.concentracionPct}%</b> del inventario concentrado en línea{' '}
                  <b>{calc.lineaTop}</b> ·{' '}
                  {calc.concentracionPct >= 60 ? 'diversificación baja' : calc.concentracionPct >= 35 ? 'diversificación moderada' : 'diversificación alta'}.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-600 mt-0.5 flex-shrink-0" />
                <span className="text-slate-600">
                  <b className="text-slate-800">{fullUSD(calc.inmovilizado)}</b> de capital inmovilizado en{' '}
                  <b>{fmtInt(calc.productosInmovilizados)} {calc.productosInmovilizados === 1 ? 'producto' : 'productos'}</b>{' '}
                  sin movimiento &gt;90d · recuperable vía promoción.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-sky-600 mt-0.5 flex-shrink-0" />
                <span className="text-slate-600">
                  Días promedio en inventario{' '}
                  <b className="text-slate-800">{calc.diasPromedio !== null ? `${calc.diasPromedio}d` : '—'}</b>
                  {calc.tieneCtru
                    ? ' · costos por unidad disponibles en CTRU.'
                    : ' · conecta CTRU para ver rotación y rentabilidad.'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ASIDE (contexto persistente) */}
        <aside className="md:col-span-1 space-y-4">

          {/* §D · ACCIONES RÁPIDAS · operativas. La reconciliación de datos NO vive
              aquí (es mantenimiento ocasional · está en el header): el inventario es
              live y la acción de mayor valor desde Stock es reabastecer (Crear OC). */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2.5">Acciones rápidas</div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => navigate('/compras')}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg"
              >
                <ShoppingCart className="w-4 h-4" /> Crear orden de compra
              </button>
              <button
                type="button"
                onClick={onIrExistencias}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
              >
                <Package className="w-4 h-4 text-slate-400" /> Ver existencias
              </button>
              <button
                type="button"
                onClick={onVerVencimientos}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
              >
                <Calendar className="w-4 h-4 text-slate-400" /> Ver vencimientos
              </button>
            </div>
          </div>

          {/* §F · ALERTAS TOP */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Alertas que requieren atención</span>
              {alertas.length > 0 && (
                <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 rounded-full font-bold tabular-nums">{alertas.length}</span>
              )}
            </div>
            {top3Alertas.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {top3Alertas.map((a, i) => {
                  const cfg = ALERTA_ICON[a.tipo];
                  const Icon = cfg.icon;
                  const valorAfectado = (a.unidadesAfectadas || 0) * (a.producto.costoPromedioUSD || 0);
                  const titulo =
                    a.tipo === 'vencimiento'
                      ? `${a.producto.nombre} · vence en ${a.diasRestantes ?? '?'}d`
                      : a.tipo === 'stock_critico'
                        ? `${a.producto.nombre} · bajo mínimo`
                        : `${a.producto.nombre} · sin mov >90d`;
                  const sub =
                    a.tipo === 'stock_critico'
                      ? `${fmtInt(a.unidadesAfectadas)} uds disponibles`
                      : `${fmtInt(a.unidadesAfectadas)} uds · ${fullUSD(valorAfectado)} afectado`;
                  return (
                    <div key={`${a.producto.productoId}-${a.tipo}-${i}`} className="px-4 py-2.5 flex items-start gap-2.5">
                      <div className={`w-7 h-7 rounded-lg ${cfg.box} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-3.5 h-3.5 ${cfg.iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-slate-800 truncate">{titulo}</div>
                        <div className="text-[10px] text-slate-500">{sub}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-5 text-center">
                <div className="text-[11px] font-semibold text-emerald-700">Todo en orden</div>
                <div className="text-[10px] text-slate-500">No hay alertas abiertas.</div>
              </div>
            )}
            <button
              type="button"
              onClick={onIrAtencion}
              className="w-full px-4 py-2 text-[11px] font-semibold text-orange-700 hover:bg-orange-50 flex items-center justify-center gap-1 border-t border-slate-100"
            >
              Ver todas en Atención <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* §E · CROSS-LINKS 360 */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2.5">Conecta con</div>
            <div className="grid grid-cols-2 gap-2">
              <a
                onClick={() => navigate('/productos')}
                className="flex flex-col gap-1 p-2.5 rounded-lg border border-slate-200 hover:border-orange-300 hover:bg-orange-50/30 cursor-pointer"
              >
                <Tag className="w-4 h-4 text-orange-600" />
                <span className="text-[11px] font-bold text-slate-800">Productos</span>
                <span className="text-[9px] text-slate-500">catálogo</span>
              </a>
              <a
                onClick={() => navigate('/ctru')}
                className="flex flex-col gap-1 p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer"
              >
                <Calculator className="w-4 h-4 text-indigo-600" />
                <span className="text-[11px] font-bold text-slate-800">CTRU</span>
                <span className="text-[9px] text-slate-500">rentabilidad</span>
              </a>
              <a
                onClick={() => navigate('/compras')}
                className="flex flex-col gap-1 p-2.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                <span className="text-[11px] font-bold text-slate-800">Compras</span>
                <span className="text-[9px] text-slate-500">reabastecer</span>
              </a>
              <a
                onClick={() => navigate('/envios')}
                className="flex flex-col gap-1 p-2.5 rounded-lg border border-slate-200 hover:border-purple-300 hover:bg-purple-50/30 cursor-pointer"
              >
                <Truck className="w-4 h-4 text-purple-600" />
                <span className="text-[11px] font-bold text-slate-800">Envíos</span>
                <span className="text-[9px] text-slate-500">en tránsito</span>
              </a>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
};
