/**
 * TabResumenPlanilla.tsx
 *
 * chk5.DS-DEDUP · 2026-06-01 · Rediseño "Dashboard de salud del costo laboral".
 *
 * El KPI strip superior del shell (Payroll · Personal activo · Incentivos ·
 * Próx. gratif.) se queda INTACTO. Esta tab dejó de clonarlo: ahora muestra
 * análisis que el strip NO da, en el orden canónico §A→§F.
 *
 * Variables nuevas (recomendación curada del squad · FP&A + BI + Contabilidad):
 *  §A · Semáforo carga laboral (costo laboral / ventas del mes) — el ratio #1
 *  §B · Donut composición (fijo vs variable) + sparkline tendencia 6 meses
 *  §C · Insights: productividad/persona · fijo% · devengado vs pagado · provisión gratif
 *  §D · Acciones rápidas
 *  §E · Cross-links 360 que cuadran con P&L y Cash flow
 *  §F · Alertas accionables
 *
 * Mockup aprobado: docs/mockups/planilla-resumen-salud-laboral-v1.html
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  PieChart,
  BarChart3,
  Lock,
  Wallet,
  PiggyBank,
  Info,
  FileText,
  HandCoins,
  Users,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  planillaAnalyticsService,
  type CostoLaboralMensual,
} from '../../../services/planillaAnalytics.service';
import { planillaService } from '../../../services/planilla.service';
import { calculoIncentivoService } from '../../../services/calculoIncentivo.service';
import { liquidacionService } from '../../../services/liquidacion.service';
import { getEstadoResultadosCached } from '../../../services/contabilidadCache';
import type {
  Boleta,
  AdelantoNomina,
  CalculoIncentivoMes,
  LiquidacionEmpleado,
} from '../../../types/planilla.types';
import { formatCurrencyPEN } from '../../../utils/format';

interface Props {
  mes: number;
  anio: number;
  onGenerarBoletas?: () => void;
  onIrATab?: (tab: 'boletas' | 'adelantos' | 'incentivos' | 'vacaciones' | 'analisis') => void;
}

function mesNombreCorto(m: number) {
  return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][m - 1] ?? '';
}

// ════════════════════════════════════════════════════════════════════
// §B · Donut de composición · 4 segmentos semánticos (fijo vs variable)
// ════════════════════════════════════════════════════════════════════

interface Segmento {
  label: string;
  valor: number;
  pct: number;
  color: string; // hex para el stroke SVG
  dot: string;   // clase tailwind del dot
}

const DonutComposicion: React.FC<{ segmentos: Segmento[]; total: number }> = ({ segmentos, total }) => {
  // Arcos acumulados · offset 25 = empieza arriba (12 en punto)
  let acumulado = 0;
  const arcos = segmentos.map((s) => {
    const dash = `${s.pct} ${100 - s.pct}`;
    const offset = 25 - acumulado;
    acumulado += s.pct;
    return { ...s, dash, offset };
  });
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 36 36" className="w-24 h-24 flex-shrink-0">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.6" />
        {arcos.map((a, i) => (
          <circle
            key={i}
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke={a.color}
            strokeWidth="3.6"
            strokeDasharray={a.dash}
            strokeDashoffset={a.offset}
          />
        ))}
        <text x="18" y="17" textAnchor="middle" className="tabular-nums" style={{ fontSize: '5px', fontWeight: 700, fill: '#0f172a' }}>
          {total >= 1000 ? `S/${(total / 1000).toFixed(1)}k` : `S/${total.toFixed(0)}`}
        </text>
        <text x="18" y="22" textAnchor="middle" style={{ fontSize: '2.6px', fill: '#94a3b8' }}>total mes</text>
      </svg>
      <div className="flex-1 space-y-1.5 text-[12px]">
        {segmentos.map((s, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${s.dot}`}></span> {s.label}
            </span>
            <span className="tabular-nums font-semibold text-slate-700">{s.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════════

export const TabResumenPlanilla: React.FC<Props> = ({ mes, anio, onGenerarBoletas, onIrATab }) => {
  const navigate = useNavigate();
  const [serie, setSerie] = useState<CostoLaboralMensual[]>([]);
  const [boletas, setBoletas] = useState<Boleta[]>([]);
  const [adelantos, setAdelantos] = useState<AdelantoNomina[]>([]);
  const [bonosPendientes, setBonosPendientes] = useState<CalculoIncentivoMes[]>([]);
  const [liquidacionesAprobadas, setLiquidacionesAprobadas] = useState<LiquidacionEmpleado[]>([]);
  const [empleadosActivos, setEmpleadosActivos] = useState(0);
  const [ventasMes, setVentasMes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const [s, bs, ads, calculos, liqs, emps, estado] = await Promise.all([
          planillaAnalyticsService.costoLaboralPorMes(6),
          planillaService.getBoletasPorPeriodo(mes, anio),
          planillaService.getAdelantos(50),
          calculoIncentivoService.listMes(mes, anio),
          liquidacionService.listPorEstado('aprobada'),
          planillaService.getEmpleadosActivos(),
          getEstadoResultadosCached(mes, anio).catch(() => null),
        ]);
        setSerie(s);
        setBoletas(bs);
        setAdelantos(ads);
        setBonosPendientes(calculos.filter((c) => c.estado === 'calculado'));
        setLiquidacionesAprobadas(liqs);
        setEmpleadosActivos(emps.length);
        setVentasMes(estado?.ventasNetas ?? 0);
      } catch (err) {
        console.error('[TabResumenPlanilla] error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [mes, anio]);

  // ─── Costo laboral del mes seleccionado (de la serie · fallback a boletas) ───
  const costoMes = useMemo<CostoLaboralMensual>(() => {
    const enSerie = serie.find((s) => s.mes === mes && s.anio === anio);
    if (enSerie) return enSerie;
    const totalBoletas = boletas.reduce((acc, b) => acc + b.totalNeto, 0);
    const totalBonos = boletas.reduce((acc, b) => acc + (b.bonificaciones ?? 0), 0);
    return {
      mes, anio, totalBoletas, totalBonos,
      totalGratificaciones: 0, totalLiquidaciones: 0,
      totalCostoLaboral: totalBoletas + totalBonos, cantidadEmpleados: boletas.length,
    };
  }, [serie, boletas, mes, anio]);

  // ─── Análisis derivado (las variables nuevas) ───
  const analisis = useMemo(() => {
    const total = costoMes.totalCostoLaboral;
    const empleados = empleadosActivos || costoMes.cantidadEmpleados || boletas.length || 0;

    // §A · Carga laboral / ventas
    const cargaLaboral = ventasMes > 0 ? (total / ventasMes) * 100 : null;
    const estadoCarga: 'sano' | 'atencion' | 'critico' | 'sindata' =
      cargaLaboral === null ? 'sindata' : cargaLaboral <= 30 ? 'sano' : cargaLaboral <= 40 ? 'atencion' : 'critico';

    // Δ vs mes anterior (de la serie)
    const idx = serie.findIndex((s) => s.mes === mes && s.anio === anio);
    const prev = idx > 0 ? serie[idx - 1] : serie.length >= 2 ? serie[serie.length - 2] : null;
    const cargaPrev = prev && ventasMes > 0 ? null : null; // delta de carga requiere ventas históricas · usamos delta de costo
    const deltaCostoPp =
      prev && prev.totalCostoLaboral > 0
        ? ((total - prev.totalCostoLaboral) / prev.totalCostoLaboral) * 100
        : null;

    // §C · costo por persona · productividad · fijo vs variable
    const costoPorPersona = empleados > 0 ? total / empleados : 0;
    const productividad = empleados > 0 ? ventasMes / empleados : 0;
    const pctFijo = total > 0 ? (costoMes.totalBoletas / total) * 100 : 0;

    // §C · devengado vs pagado (de las boletas del mes)
    const devengado = boletas.reduce((acc, b) => acc + b.totalNeto, 0);
    const pagado = boletas.filter((b) => b.estado === 'pagada').reduce((acc, b) => acc + b.totalNeto, 0);
    const pendientePago = Math.max(0, devengado - pagado);

    // §C · provisión de gratificación acumulada (1/6 del sueldo por mes del semestre)
    const mesSemestre = mes <= 6 ? mes : mes - 6;
    const provisionMensual = costoMes.totalBoletas / 6;
    const provisionAcumulada = provisionMensual * mesSemestre;

    return {
      total, empleados, cargaLaboral, estadoCarga, deltaCostoPp, cargaPrev,
      costoPorPersona, productividad, pctFijo,
      devengado, pagado, pendientePago,
      mesSemestre, provisionAcumulada,
    };
  }, [costoMes, empleadosActivos, boletas, ventasMes, serie, mes, anio]);

  // ─── §B · segmentos del donut ───
  const segmentos = useMemo<Segmento[]>(() => {
    const t = costoMes.totalCostoLaboral || 1;
    const defs = [
      { label: 'Sueldos base', valor: costoMes.totalBoletas, color: '#6366f1', dot: 'bg-indigo-500' },
      { label: 'Bonos / comisiones', valor: costoMes.totalBonos, color: '#10b981', dot: 'bg-emerald-500' },
      { label: 'Gratif. (provisión)', valor: costoMes.totalGratificaciones, color: '#f59e0b', dot: 'bg-amber-500' },
      { label: 'Liquidaciones', valor: costoMes.totalLiquidaciones, color: '#f43f5e', dot: 'bg-rose-500' },
    ];
    return defs.map((d) => ({ ...d, pct: (d.valor / t) * 100 }));
  }, [costoMes]);

  // ─── §B · tendencia 6 meses ───
  const tendencia = useMemo(() => {
    const max = Math.max(...serie.map((s) => s.totalCostoLaboral), 1);
    const promedio = serie.length > 0 ? serie.reduce((acc, s) => acc + s.totalCostoLaboral, 0) / serie.length : 0;
    return { max, promedio };
  }, [serie]);

  // ─── alertas/pendientes ───
  const pendientes = useMemo(() => {
    // 'pagado' = entregado al empleado pero aún sin descontar de boleta (en circulación)
    const adelantosVencidos = adelantos.filter((a) => a.estado === 'pagado').length;
    return {
      boletasBorrador: boletas.filter((b) => b.estado === 'borrador').length,
      adelantosVencidos,
      bonosPorAprobar: bonosPendientes.length,
      liquidacionesPend: liquidacionesAprobadas.length,
    };
  }, [boletas, adelantos, bonosPendientes, liquidacionesAprobadas]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="text-[12px]">Cargando salud del costo laboral…</div>
      </div>
    );
  }

  // Estilos del semáforo §A
  const cargaStyles = {
    sano: { bg: 'from-emerald-50 to-emerald-100/30', ring: 'ring-emerald-200/60', iconBg: 'bg-emerald-100', icon: 'text-emerald-600', title: 'text-emerald-900', body: 'text-emerald-700', val: 'text-emerald-900', dec: 'text-emerald-400', Icon: CheckCircle2, titulo: 'Costo laboral bajo control' },
    atencion: { bg: 'from-amber-50 to-amber-100/30', ring: 'ring-amber-200/60', iconBg: 'bg-amber-100', icon: 'text-amber-600', title: 'text-amber-900', body: 'text-amber-700', val: 'text-amber-900', dec: 'text-amber-400', Icon: AlertTriangle, titulo: 'Costo laboral elevado' },
    critico: { bg: 'from-rose-50 to-rose-100/30', ring: 'ring-rose-200/60', iconBg: 'bg-rose-100', icon: 'text-rose-600', title: 'text-rose-900', body: 'text-rose-700', val: 'text-rose-900', dec: 'text-rose-400', Icon: AlertCircle, titulo: 'Costo laboral alto · margen en riesgo' },
    sindata: { bg: 'from-slate-50 to-slate-100/30', ring: 'ring-slate-200/60', iconBg: 'bg-slate-100', icon: 'text-slate-500', title: 'text-slate-900', body: 'text-slate-600', val: 'text-slate-900', dec: 'text-slate-400', Icon: Info, titulo: 'Sin ventas registradas este mes' },
  }[analisis.estadoCarga];
  const CargaIcon = cargaStyles.Icon;

  // posición del marcador en la barra de umbral (0–50% → 0–100% del ancho)
  const cargaBarPct = analisis.cargaLaboral !== null ? Math.min(100, (analisis.cargaLaboral / 50) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 space-y-4">

      {/* §A · BANNER SEMÁFORO · carga laboral */}
      <div className={`bg-gradient-to-r ${cargaStyles.bg} ring-1 ${cargaStyles.ring} rounded-2xl p-4`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${cargaStyles.iconBg} flex items-center justify-center flex-shrink-0`}>
              <CargaIcon className={`w-5 h-5 ${cargaStyles.icon}`} />
            </div>
            <div>
              <div className={`text-[14px] font-bold ${cargaStyles.title}`}>{cargaStyles.titulo}</div>
              <div className={`text-[12px] ${cargaStyles.body}`}>
                {analisis.cargaLaboral !== null ? (
                  <>De cada <strong>S/ 100</strong> que vendés, <strong>S/ {analisis.cargaLaboral.toFixed(0)}</strong> se van en tu equipo</>
                ) : (
                  <>Registrá ventas del mes para ver tu ratio de carga laboral</>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-[10px] uppercase tracking-wider ${cargaStyles.body} font-bold`}>Carga laboral</div>
            <div className={`text-2xl font-bold tabular-nums ${cargaStyles.val}`}>
              {analisis.cargaLaboral !== null ? analisis.cargaLaboral.toFixed(1) : '—'}<span className={cargaStyles.dec}>%</span>
            </div>
            {analisis.deltaCostoPp !== null && (
              <div className={`text-[11px] ${cargaStyles.body} flex items-center gap-1 justify-end`}>
                {analisis.deltaCostoPp > 0 ? <TrendingUp className="w-3 h-3" /> : analisis.deltaCostoPp < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                {analisis.deltaCostoPp > 0 ? '+' : ''}{analisis.deltaCostoPp.toFixed(1)}% costo vs mes ant.
              </div>
            )}
          </div>
        </div>
        {analisis.cargaLaboral !== null && (
          <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
            <span className="font-bold text-emerald-700">Sano ≤30%</span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden relative">
              <div className={`absolute inset-y-0 left-0 rounded-full ${analisis.estadoCarga === 'sano' ? 'bg-emerald-500' : analisis.estadoCarga === 'atencion' ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${cargaBarPct}%` }}></div>
              <div className="absolute inset-y-0" style={{ left: '60%', width: '1px', background: '#f59e0b' }}></div>
              <div className="absolute inset-y-0" style={{ left: '80%', width: '1px', background: '#f43f5e' }}></div>
            </div>
            <span className="text-amber-600 font-bold">40%</span>
            <span className="text-rose-600 font-bold">alto</span>
          </div>
        )}
      </div>

      {/* §B · VISUALIZACIÓN · composición + tendencia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut composición */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Composición del costo</div>
              <div className="text-[11px] text-slate-400">de qué está hecho tu costo laboral</div>
            </div>
            <PieChart className="w-4 h-4 text-slate-400" />
          </div>
          <DonutComposicion segmentos={segmentos} total={costoMes.totalCostoLaboral} />
          <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 text-indigo-500 flex-shrink-0" />
            <span><strong>{analisis.pctFijo.toFixed(0)}% es fijo</strong> (sueldos) · el {(100 - analisis.pctFijo).toFixed(0)}% restante se ajusta solo si las ventas bajan.</span>
          </div>
        </div>

        {/* Sparkline tendencia 6m */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Tendencia · {serie.length} meses</div>
              <div className="text-[11px] text-slate-400">costo laboral total por mes</div>
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          {serie.length === 0 ? (
            <div className="h-28 flex items-center justify-center text-[11px] text-slate-400">Sin data histórica</div>
          ) : (
            <>
              <div className="flex items-end justify-between gap-2 h-28 pt-2">
                {serie.map((s, i) => {
                  const esActual = s.mes === mes && s.anio === anio;
                  const h = (s.totalCostoLaboral / tendencia.max) * 100;
                  return (
                    <div key={`${s.anio}-${s.mes}`} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`w-full rounded-t ${esActual ? 'bg-violet-600' : 'bg-violet-200'}`} style={{ height: `${Math.max(4, h)}%` }}></div>
                      <span className={`text-[9px] ${esActual ? 'text-violet-700 font-bold' : 'text-slate-400'}`}>{mesNombreCorto(s.mes)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 flex items-center gap-1"><span className="w-3 h-0.5 bg-slate-400 inline-block"></span> Promedio {formatCurrencyPEN(tendencia.promedio)}</span>
                <span className="text-violet-700 font-semibold tabular-nums">{mesNombreCorto(mes)} {formatCurrencyPEN(costoMes.totalCostoLaboral)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* §C · INSIGHTS · 4 cards en lenguaje del dueño */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 ml-1">Insights del mes</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* productividad/costo */}
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1"><TrendingUp className="w-3.5 h-3.5 text-emerald-600" /><span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">Productividad</span></div>
            <div className="text-[18px] font-bold tabular-nums text-slate-900">{formatCurrencyPEN(analisis.productividad)}</div>
            <div className="text-[11px] text-slate-500 leading-snug">genera cada persona en ventas · cuesta <span className="font-semibold text-slate-700">{formatCurrencyPEN(analisis.costoPorPersona)}</span></div>
          </div>
          {/* fijo vs variable */}
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1"><Lock className="w-3.5 h-3.5 text-indigo-600" /><span className="text-[10px] uppercase tracking-wider text-indigo-700 font-bold">Flexibilidad</span></div>
            <div className="text-[18px] font-bold tabular-nums text-slate-900">{analisis.pctFijo.toFixed(0)}<span className="text-slate-400">%</span> fijo</div>
            <div className="text-[11px] text-slate-500 leading-snug">el {(100 - analisis.pctFijo).toFixed(0)}% se ajusta solo con el desempeño del equipo</div>
          </div>
          {/* devengado vs pagado */}
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1"><Wallet className="w-3.5 h-3.5 text-amber-600" /><span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">Pagado vs debido</span></div>
            <div className="text-[18px] font-bold tabular-nums text-slate-900">{formatCurrencyPEN(analisis.pendientePago)}</div>
            <div className="text-[11px] text-slate-500 leading-snug">pendiente · costó {formatCurrencyPEN(analisis.devengado)} · pagaste <span className="font-semibold text-slate-700">{formatCurrencyPEN(analisis.pagado)}</span></div>
          </div>
          {/* provision gratif */}
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1"><PiggyBank className="w-3.5 h-3.5 text-amber-600" /><span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">Provisión gratif.</span></div>
            <div className="text-[18px] font-bold tabular-nums text-slate-900">{formatCurrencyPEN(analisis.provisionAcumulada)}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${(analisis.mesSemestre / 6) * 100}%` }}></div></div>
              <span className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">{analisis.mesSemestre}/6 meses</span>
            </div>
          </div>
        </div>
      </div>

      {/* §D · ACCIONES RÁPIDAS */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 ml-1">Acciones rápidas</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button type="button" onClick={onGenerarBoletas} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-violet-300 hover:bg-violet-50/30 text-left transition-colors">
            <FileText className="w-4 h-4 text-violet-600 mb-1.5" />
            <div className="text-[12px] font-bold text-slate-900">Generar boletas del mes</div>
            <div className="text-[10px] text-slate-500">{analisis.empleados} empleados activos</div>
          </button>
          <button type="button" onClick={() => onIrATab?.('adelantos')} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-amber-300 hover:bg-amber-50/30 text-left transition-colors">
            <HandCoins className="w-4 h-4 text-amber-600 mb-1.5" />
            <div className="text-[12px] font-bold text-slate-900">Aprobar adelantos</div>
            <div className="text-[10px] text-slate-500">{adelantos.filter((a) => a.estado === 'pendiente').length} pendientes</div>
          </button>
          <button type="button" onClick={() => onIrATab?.('boletas')} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-300 hover:bg-slate-50 text-left transition-colors">
            <Users className="w-4 h-4 text-slate-600 mb-1.5" />
            <div className="text-[12px] font-bold text-slate-900">Ver detalle por empleado</div>
            <div className="text-[10px] text-slate-500">boletas individuales</div>
          </button>
        </div>
      </div>

      {/* §E · CROSS-LINKS 360 · que cuadran con P&L y Cash flow */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 ml-1">Conecta con · 360</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button type="button" onClick={() => navigate('/contabilidad')} className="bg-gradient-to-r from-teal-50 to-cyan-50/30 border border-teal-200 rounded-lg p-3 flex items-center justify-between hover:border-teal-300 transition-colors text-left">
            <div className="min-w-0"><div className="text-[12px] font-bold text-slate-900">Gasto de personal · P&amp;L</div><div className="text-[11px] text-teal-700 tabular-nums">{formatCurrencyPEN(analisis.devengado)} en Contabilidad</div></div>
            <ArrowRight className="w-4 h-4 text-teal-600 flex-shrink-0 ml-2" />
          </button>
          <button type="button" onClick={() => navigate('/finanzas/cash-flow')} className="bg-gradient-to-r from-teal-50 to-cyan-50/30 border border-teal-200 rounded-lg p-3 flex items-center justify-between hover:border-teal-300 transition-colors text-left">
            <div className="min-w-0"><div className="text-[12px] font-bold text-slate-900">Salida de caja · nómina</div><div className="text-[11px] text-teal-700 tabular-nums">{formatCurrencyPEN(analisis.pagado)} en Finanzas</div></div>
            <ArrowRight className="w-4 h-4 text-teal-600 flex-shrink-0 ml-2" />
          </button>
          <button type="button" onClick={() => navigate('/usuarios')} className="bg-gradient-to-r from-violet-50 to-violet-100/20 border border-violet-200 rounded-lg p-3 flex items-center justify-between hover:border-violet-300 transition-colors text-left">
            <div className="min-w-0"><div className="text-[12px] font-bold text-slate-900">Gestión del equipo</div><div className="text-[11px] text-violet-700">Usuarios · identidades</div></div>
            <ArrowRight className="w-4 h-4 text-violet-600 flex-shrink-0 ml-2" />
          </button>
        </div>
      </div>

      {/* §F · ALERTAS */}
      {(pendientes.boletasBorrador > 0 || pendientes.adelantosVencidos > 0 || pendientes.bonosPorAprobar > 0) && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 ml-1">Alertas</div>
          <div className="space-y-2">
            {pendientes.boletasBorrador > 0 && (
              <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" /><span className="text-[12px] text-rose-900"><strong>{pendientes.boletasBorrador} boleta{pendientes.boletasBorrador === 1 ? '' : 's'} en borrador</strong> · requieren aprobación antes de pagar</span></div>
                <button type="button" onClick={() => onIrATab?.('boletas')} className="text-[11px] font-bold text-rose-700 hover:underline whitespace-nowrap">Ver →</button>
              </div>
            )}
            {pendientes.adelantosVencidos > 0 && (
              <div className="bg-sky-50 ring-1 ring-sky-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-sky-600 flex-shrink-0" /><span className="text-[12px] text-sky-900"><strong>{pendientes.adelantosVencidos} adelanto{pendientes.adelantosVencidos === 1 ? '' : 's'} sin descontar</strong> · revisar antes del cierre del mes</span></div>
                <button type="button" onClick={() => onIrATab?.('adelantos')} className="text-[11px] font-bold text-sky-700 hover:underline whitespace-nowrap">Ver →</button>
              </div>
            )}
            {pendientes.bonosPorAprobar > 0 && (
              <div className="bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" /><span className="text-[12px] text-amber-900"><strong>{pendientes.bonosPorAprobar} bono{pendientes.bonosPorAprobar === 1 ? '' : 's'} pendiente{pendientes.bonosPorAprobar === 1 ? '' : 's'} de aprobación</strong> · antes de generar boletas</span></div>
                <button type="button" onClick={() => onIrATab?.('incentivos')} className="text-[11px] font-bold text-amber-700 hover:underline whitespace-nowrap">Ver →</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TabResumenPlanilla;
