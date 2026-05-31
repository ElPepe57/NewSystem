/**
 * TabResumenPlanilla.tsx
 *
 * chk5.PERSONAS-v5.4 · F10.E · 2026-05-26
 *
 * Tab "Resumen" estratégico del módulo Planilla · alineado con el patrón
 * canon de Contabilidad (Resumen) · Finanzas (Overview) · Inversionistas
 * (Resumen ejecutivo) · Vita Skin.
 *
 * Estructura canon banking-grade sky:
 *  §A · Banner estado de planilla (verde/amber/rojo)
 *  §B · Mini bar chart 12m evolución costo laboral
 *  §C · Insights del mes (auto-generados · 3-5 hallazgos)
 *  §D · Acciones rápidas (Generar boletas · Calcular bonos · etc)
 *  §E · Cross-links 360° mini cards (Gastos · Cash-flow · P&L · Salud)
 *  §F · Alertas activas (boletas borrador · bonos pendientes)
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Wallet,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Zap,
  Gift,
  UserMinus,
  ArrowRight,
  FileText,
  Trophy,
  Lightbulb,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  planillaAnalyticsService,
  type CostoLaboralMensual,
} from '../../../services/planillaAnalytics.service';
import { planillaService } from '../../../services/planilla.service';
import { calculoIncentivoService } from '../../../services/calculoIncentivo.service';
import { liquidacionService } from '../../../services/liquidacion.service';
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
  /** Callbacks para wire-up con modales del shell */
  onGenerarBoletas?: () => void;
  onCalcularBonos?: () => void;
  onProcesarGratificacion?: () => void;
  onBajaEmpleado?: () => void;
  /** Navegar a tab específico del shell */
  onIrATab?: (tab: 'boletas' | 'adelantos' | 'incentivos' | 'vacaciones' | 'analisis') => void;
}

const MES_NOMBRE = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function mesNombreCorto(m: number) {
  return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][m - 1] ?? '';
}

// ───── Mini bar chart SVG ─────

const MiniBars: React.FC<{ serie: CostoLaboralMensual[] }> = ({ serie }) => {
  if (serie.length === 0) {
    return <div className="text-[11px] text-slate-400 py-4 text-center">Sin data histórica</div>;
  }
  const max = Math.max(...serie.map((s) => s.totalCostoLaboral), 1);
  const barW = 28;
  const gap = 4;
  const h = 60;
  return (
    <div className="overflow-x-auto">
      <svg
        width={serie.length * (barW + gap)}
        height={h + 18}
        className="block"
        role="img"
        aria-label="Costo laboral mensual"
      >
        {serie.map((m, i) => {
          const altura = (m.totalCostoLaboral / max) * h;
          const esActual = i === serie.length - 1;
          return (
            <g key={`${m.anio}-${m.mes}`} transform={`translate(${i * (barW + gap)}, 0)`}>
              <rect
                x={0}
                y={h - altura}
                width={barW}
                height={altura}
                rx={3}
                className={esActual ? 'fill-violet-600' : 'fill-violet-300'}
              />
              <text
                x={barW / 2}
                y={h + 13}
                textAnchor="middle"
                className="fill-slate-500"
                fontSize={9}
              >
                {mesNombreCorto(m.mes)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ───── Calculadora de estado de la planilla ─────

type EstadoPlanilla = 'al_dia' | 'atencion' | 'critico';

interface InfoEstado {
  estado: EstadoPlanilla;
  titulo: string;
  detalle: string;
  razones: string[];
}

function calcularEstadoPlanilla(
  boletas: Boleta[],
  bonosPendientes: CalculoIncentivoMes[],
  liquidacionesAprobadas: LiquidacionEmpleado[],
): InfoEstado {
  const boletasBorrador = boletas.filter((b) => b.estado === 'borrador').length;
  const boletasAprobadasSinPagar = boletas.filter((b) => b.estado === 'aprobada').length;
  const bonosPorAprobar = bonosPendientes.length;

  // Liquidaciones aprobadas sin pagar hace +7 días
  const ahora = Date.now();
  const liqCriticas = liquidacionesAprobadas.filter((l) => {
    const aprobacionMs = l.fechaAprobacion?.toMillis?.() ?? l.fechaCreacion.toMillis();
    const diasDesde = (ahora - aprobacionMs) / (1000 * 60 * 60 * 24);
    return diasDesde > 7;
  }).length;

  const razones: string[] = [];

  if (liqCriticas > 0) {
    razones.push(`${liqCriticas} liquidación${liqCriticas === 1 ? '' : 'es'} aprobada${liqCriticas === 1 ? '' : 's'} sin pagar hace +7 días`);
    return {
      estado: 'critico',
      titulo: 'Estado crítico',
      detalle: 'Hay compromisos vencidos que requieren acción inmediata.',
      razones,
    };
  }

  if (boletasBorrador > 0) razones.push(`${boletasBorrador} boleta${boletasBorrador === 1 ? '' : 's'} en borrador`);
  if (boletasAprobadasSinPagar > 0) razones.push(`${boletasAprobadasSinPagar} boleta${boletasAprobadasSinPagar === 1 ? '' : 's'} aprobada${boletasAprobadasSinPagar === 1 ? '' : 's'} sin pagar`);
  if (bonosPorAprobar > 0) razones.push(`${bonosPorAprobar} bono${bonosPorAprobar === 1 ? '' : 's'} pendiente${bonosPorAprobar === 1 ? '' : 's'} de aprobación`);

  if (razones.length > 0) {
    return {
      estado: 'atencion',
      titulo: 'Atención requerida',
      detalle: 'Hay items pendientes que conviene resolver pronto.',
      razones,
    };
  }

  return {
    estado: 'al_dia',
    titulo: 'Planilla al día',
    detalle: 'Todas las boletas pagadas · sin bonos pendientes · sin liquidaciones vencidas.',
    razones: ['Operación impecable este mes'],
  };
}

// ───── Generador de insights ─────

interface Insight {
  tipo: 'positivo' | 'atencion' | 'negativo' | 'info';
  texto: string;
  ctaLabel?: string;
  ctaAction?: () => void;
}

function generarInsightsResumen(
  serie: CostoLaboralMensual[],
  bonosMesPEN: number,
  empleadosActivos: number,
  diasAProximaGratif: number,
  mesProxGratif: number,
  ctas: {
    irAnalisis: () => void;
    irIncentivos: () => void;
    procesarGratif?: () => void;
  },
): Insight[] {
  const insights: Insight[] = [];

  // Insight #1 · variación MoM
  if (serie.length >= 2) {
    const ultimo = serie[serie.length - 1];
    const penultimo = serie[serie.length - 2];
    if (penultimo.totalCostoLaboral > 0) {
      const variacionPct =
        ((ultimo.totalCostoLaboral - penultimo.totalCostoLaboral) / penultimo.totalCostoLaboral) * 100;
      if (Math.abs(variacionPct) >= 3) {
        insights.push({
          tipo: variacionPct > 0 ? 'atencion' : 'positivo',
          texto: `Tu costo laboral ${variacionPct > 0 ? 'subió' : 'bajó'} ${Math.abs(variacionPct).toFixed(1)}% vs el mes pasado (${formatCurrencyPEN(Math.abs(ultimo.totalCostoLaboral - penultimo.totalCostoLaboral))})`,
          ctaLabel: 'Ver análisis',
          ctaAction: ctas.irAnalisis,
        });
      }
    }
  }

  // Insight #2 · bonos del mes vs payroll
  const ultimoMes = serie[serie.length - 1];
  if (ultimoMes && bonosMesPEN > 0 && ultimoMes.totalBoletas > 0) {
    const ratio = (bonosMesPEN / ultimoMes.totalBoletas) * 100;
    if (ratio > 15) {
      insights.push({
        tipo: 'info',
        texto: `Los bonos representan ${ratio.toFixed(0)}% del payroll este mes · típico cuando hay performance alto en ventas`,
        ctaLabel: 'Ver incentivos',
        ctaAction: ctas.irIncentivos,
      });
    }
  }

  // Insight #3 · próxima gratificación
  if (diasAProximaGratif <= 30 && diasAProximaGratif >= 0) {
    insights.push({
      tipo: 'atencion',
      texto: `Próxima gratificación de ${MES_NOMBRE[mesProxGratif - 1]} en ${diasAProximaGratif} días · ${empleadosActivos} empleados afectados`,
      ctaLabel: ctas.procesarGratif ? 'Procesar ahora' : undefined,
      ctaAction: ctas.procesarGratif,
    });
  }

  // Insight #4 · estabilidad
  if (insights.length === 0) {
    insights.push({
      tipo: 'positivo',
      texto: `Costo laboral estable · sin variaciones significativas · ${empleadosActivos} empleados activos`,
    });
  }

  return insights;
}

// ───── COMPONENT ─────

export const TabResumenPlanilla: React.FC<Props> = ({
  mes,
  anio,
  onGenerarBoletas,
  onCalcularBonos,
  onProcesarGratificacion,
  onBajaEmpleado,
  onIrATab,
}) => {
  const navigate = useNavigate();
  const [serie, setSerie] = useState<CostoLaboralMensual[]>([]);
  const [boletas, setBoletas] = useState<Boleta[]>([]);
  const [adelantos, setAdelantos] = useState<AdelantoNomina[]>([]);
  const [bonosPendientes, setBonosPendientes] = useState<CalculoIncentivoMes[]>([]);
  const [liquidacionesAprobadas, setLiquidacionesAprobadas] = useState<LiquidacionEmpleado[]>([]);
  const [empleadosActivos, setEmpleadosActivos] = useState(0);
  const [bonosMesPEN, setBonosMesPEN] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const [s, bs, ads, calculos, liqs, emps] = await Promise.all([
          planillaAnalyticsService.costoLaboralPorMes(12),
          planillaService.getBoletasPorPeriodo(mes, anio),
          planillaService.getAdelantos(50),
          calculoIncentivoService.listMes(mes, anio),
          liquidacionService.listPorEstado('aprobada'),
          planillaService.getEmpleadosActivos(),
        ]);
        setSerie(s);
        setBoletas(bs);
        setAdelantos(ads);
        setBonosPendientes(calculos.filter((c) => c.estado === 'calculado'));
        setBonosMesPEN(
          calculos
            .filter((c) => c.estado === 'incluido_en_boleta' || c.estado === 'aprobado')
            .reduce((s, c) => s + c.bonoCalculado, 0),
        );
        setLiquidacionesAprobadas(liqs);
        setEmpleadosActivos(emps.length);
      } catch (err) {
        console.error('[TabResumenPlanilla] error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [mes, anio]);

  // Stats derivadas
  const stats = useMemo(() => {
    const ultimoMes = serie[serie.length - 1];
    const penultimoMes = serie[serie.length - 2];
    const variacionMoM =
      ultimoMes && penultimoMes && penultimoMes.totalCostoLaboral > 0
        ? ((ultimoMes.totalCostoLaboral - penultimoMes.totalCostoLaboral) /
            penultimoMes.totalCostoLaboral) *
          100
        : 0;
    const payrollMes = boletas.reduce((s, b) => s + b.totalNeto, 0);
    return {
      payrollMes,
      variacionMoM,
      adelantosPendientes: adelantos.filter((a) => a.estado === 'pendiente').length,
      bonosPendientes: bonosPendientes.length,
      boletasBorrador: boletas.filter((b) => b.estado === 'borrador').length,
    };
  }, [serie, boletas, adelantos, bonosPendientes]);

  const proximaGratif = useMemo(() => {
    const hoy = new Date();
    const candidatos: Array<{ mes: number; fecha: Date }> = [
      { mes: 7, fecha: new Date(anio, 6, 15) },
      { mes: 12, fecha: new Date(anio, 11, 15) },
      { mes: 7, fecha: new Date(anio + 1, 6, 15) },
    ];
    const next = candidatos.find((c) => c.fecha.getTime() > hoy.getTime()) ?? candidatos[0];
    const dias = Math.max(
      0,
      Math.ceil((next.fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)),
    );
    return { mesProx: next.mes, dias };
  }, [anio]);

  const estadoPlanilla = useMemo(
    () => calcularEstadoPlanilla(boletas, bonosPendientes, liquidacionesAprobadas),
    [boletas, bonosPendientes, liquidacionesAprobadas],
  );

  const insights = useMemo(
    () =>
      generarInsightsResumen(serie, bonosMesPEN, empleadosActivos, proximaGratif.dias, proximaGratif.mesProx, {
        irAnalisis: () => onIrATab?.('analisis'),
        irIncentivos: () => onIrATab?.('incentivos'),
        procesarGratif: onProcesarGratificacion,
      }),
    [serie, bonosMesPEN, empleadosActivos, proximaGratif, onIrATab, onProcesarGratificacion],
  );

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="text-[12px]">Cargando resumen estratégico...</div>
      </div>
    );
  }

  // Estilos por estado
  const estadoStyles = {
    al_dia: {
      bg: 'bg-gradient-to-r from-emerald-50 to-emerald-100/40',
      ring: 'ring-emerald-200',
      iconBg: 'bg-emerald-100',
      iconText: 'text-emerald-700',
      titleText: 'text-emerald-900',
      bodyText: 'text-emerald-700',
      icon: CheckCircle2,
    },
    atencion: {
      bg: 'bg-gradient-to-r from-amber-50 to-amber-100/40',
      ring: 'ring-amber-200',
      iconBg: 'bg-amber-100',
      iconText: 'text-amber-700',
      titleText: 'text-amber-900',
      bodyText: 'text-amber-700',
      icon: AlertTriangle,
    },
    critico: {
      bg: 'bg-gradient-to-r from-rose-50 to-rose-100/40',
      ring: 'ring-rose-200',
      iconBg: 'bg-rose-100',
      iconText: 'text-rose-700',
      titleText: 'text-rose-900',
      bodyText: 'text-rose-700',
      icon: AlertCircle,
    },
  }[estadoPlanilla.estado];

  const IconEstado = estadoStyles.icon;
  const insightTinte: Record<Insight['tipo'], string> = {
    positivo: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    atencion: 'bg-amber-50 border-amber-200 text-amber-900',
    negativo: 'bg-rose-50 border-rose-200 text-rose-900',
    info: 'bg-sky-50 border-sky-200 text-sky-900',
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* §A · Banner Estado de la Planilla · canon Contabilidad BannerEstadoNegocio */}
      <div className={`${estadoStyles.bg} ring-1 ${estadoStyles.ring} rounded-2xl p-4`}>
        <div className="flex items-start gap-3 flex-wrap">
          <div className={`w-12 h-12 ${estadoStyles.iconBg} rounded-2xl flex items-center justify-center flex-shrink-0`}>
            <IconEstado className={`w-6 h-6 ${estadoStyles.iconText}`} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className={`text-[10px] uppercase tracking-wider ${estadoStyles.iconText} font-bold mb-0.5`}>
              ESTADO DE LA PLANILLA
            </div>
            <div className={`text-[16px] font-bold ${estadoStyles.titleText} mb-1`}>
              {estadoPlanilla.titulo}
            </div>
            <div className={`text-[11px] ${estadoStyles.bodyText} mb-2`}>{estadoPlanilla.detalle}</div>
            <div className="flex flex-wrap items-center gap-2">
              {estadoPlanilla.razones.map((r, i) => (
                <span
                  key={i}
                  className={`text-[10px] bg-white/60 ${estadoStyles.bodyText} px-2 py-0.5 rounded-full border ${estadoStyles.ring.replace('ring-', 'border-')} font-semibold`}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* §B · KPI strip ejecutivo · 4 cards canon banking-grade */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">
              PAYROLL {mesNombreCorto(mes).toUpperCase()}
            </span>
            <Wallet className="w-3.5 h-3.5 text-rose-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-rose-900">
            {formatCurrencyPEN(stats.payrollMes)}
          </div>
          <div className="text-[11px] text-rose-700 mt-1 truncate">
            {boletas.length} boleta{boletas.length === 1 ? '' : 's'}
          </div>
        </div>
        <div
          className={`bg-gradient-to-br ring-1 rounded-2xl p-4 ${
            stats.variacionMoM >= 0
              ? 'from-amber-50 to-amber-100/40 ring-amber-200/50'
              : 'from-emerald-50 to-emerald-100/40 ring-emerald-200/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-[10px] uppercase tracking-wider font-bold ${
                stats.variacionMoM >= 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              Δ MoM
            </span>
            {stats.variacionMoM >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-amber-700" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-emerald-700" />
            )}
          </div>
          <div
            className={`text-2xl font-bold tabular-nums ${
              stats.variacionMoM >= 0 ? 'text-amber-900' : 'text-emerald-900'
            }`}
          >
            {stats.variacionMoM >= 0 ? '+' : ''}
            {stats.variacionMoM.toFixed(1)}%
          </div>
          <div
            className={`text-[11px] mt-1 ${stats.variacionMoM >= 0 ? 'text-amber-700' : 'text-emerald-700'}`}
          >
            vs mes anterior
          </div>
        </div>
        <div className="bg-gradient-to-br from-violet-50 to-violet-100/40 ring-1 ring-violet-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-violet-700 font-bold">
              BONOS DEL MES
            </span>
            <Trophy className="w-3.5 h-3.5 text-violet-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-violet-900">
            {formatCurrencyPEN(bonosMesPEN)}
          </div>
          <div className="text-[11px] text-violet-700 mt-1 truncate">
            {stats.payrollMes > 0
              ? `${((bonosMesPEN / stats.payrollMes) * 100).toFixed(0)}% del payroll`
              : 'sin payroll este mes'}
          </div>
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 ring-1 ring-indigo-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-indigo-700 font-bold">
              PRÓX. GRATIF.
            </span>
            <CalendarDays className="w-3.5 h-3.5 text-indigo-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-indigo-900">
            {proximaGratif.mesProx === 7 ? 'jul' : 'dic'}{' '}
            <span className="text-indigo-400">· {proximaGratif.dias}d</span>
          </div>
          <div className="text-[11px] text-indigo-700 mt-1 truncate">
            {empleadosActivos} empleados afectados
          </div>
        </div>
      </div>

      {/* §C · Mini bar chart 12m · canon TabAnalisisReportes (compacto) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-[13px] font-bold text-slate-900 inline-flex items-center gap-1.5">
            <LayoutDashboard className="w-4 h-4 text-violet-700" />
            Evolución del costo laboral · últimos {serie.length || 0} meses
          </h3>
          <button
            type="button"
            onClick={() => onIrATab?.('analisis')}
            className="text-[11px] text-violet-700 font-bold hover:underline inline-flex items-center gap-1"
          >
            Análisis detallado
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <MiniBars serie={serie} />
      </div>

      {/* §D · Insights del mes · canon Contabilidad InsightsDelMes */}
      <div>
        <h3 className="text-[13px] font-bold text-slate-900 mb-2 inline-flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4 text-amber-600" />
          Insights del mes
          <span className="text-[10px] text-slate-500 font-normal">
            · {insights.length} hallazgo{insights.length === 1 ? '' : 's'}
          </span>
        </h3>
        <div className="space-y-2">
          {insights.map((ins, i) => (
            <div
              key={i}
              className={`border rounded-lg p-3 ${insightTinte[ins.tipo]} flex items-start justify-between gap-3 flex-wrap`}
            >
              <div className="text-[12px] flex-1 min-w-[200px]">{ins.texto}</div>
              {ins.ctaLabel && ins.ctaAction && (
                <button
                  type="button"
                  onClick={ins.ctaAction}
                  className="text-[11px] font-bold underline hover:no-underline inline-flex items-center gap-0.5 flex-shrink-0"
                >
                  {ins.ctaLabel}
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* §E · Acciones rápidas · 4 quick-start canon N9 */}
      <div>
        <h3 className="text-[13px] font-bold text-slate-900 mb-2">Acciones rápidas</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={onGenerarBoletas}
            className="bg-white border border-violet-200 hover:bg-violet-50/30 rounded-lg p-3 text-left transition-colors"
          >
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center mb-1.5">
              <FileText className="w-4 h-4 text-violet-700" />
            </div>
            <div className="text-[11px] font-bold text-slate-900">Generar boletas</div>
            <div className="text-[10px] text-slate-500">del mes en lote</div>
          </button>
          <button
            type="button"
            onClick={onCalcularBonos}
            className="bg-white border border-violet-200 hover:bg-violet-50/30 rounded-lg p-3 text-left transition-colors"
          >
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center mb-1.5">
              <Zap className="w-4 h-4 text-violet-700" />
            </div>
            <div className="text-[11px] font-bold text-slate-900">Calcular bonos</div>
            <div className="text-[10px] text-slate-500">4 tipos · auto</div>
          </button>
          <button
            type="button"
            onClick={onProcesarGratificacion}
            className="bg-white border border-indigo-200 hover:bg-indigo-50/30 rounded-lg p-3 text-left transition-colors"
          >
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mb-1.5">
              <Gift className="w-4 h-4 text-indigo-700" />
            </div>
            <div className="text-[11px] font-bold text-slate-900">Procesar gratif.</div>
            <div className="text-[10px] text-slate-500">jul / dic</div>
          </button>
          <button
            type="button"
            onClick={onBajaEmpleado}
            className="bg-white border border-rose-200 hover:bg-rose-50/30 rounded-lg p-3 text-left transition-colors"
          >
            <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center mb-1.5">
              <UserMinus className="w-4 h-4 text-rose-700" />
            </div>
            <div className="text-[11px] font-bold text-slate-900">Dar de baja</div>
            <div className="text-[10px] text-slate-500">wizard 4 pasos</div>
          </button>
        </div>
      </div>

      {/* §F · Cross-links 360° · canon F6 BannerImpactoPlanilla pero compacto */}
      <div>
        <h3 className="text-[13px] font-bold text-slate-900 mb-2">Impacto 360° en otros módulos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate(`/gastos?mes=${mes}&anio=${anio}`)}
            className="bg-white border border-amber-200 hover:bg-amber-50/30 rounded-lg p-3 text-left flex items-center justify-between transition-colors"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-amber-900">Gastos · costo planilla mes</div>
              <div className="text-[10px] text-amber-700">overhead recurrente</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 ml-2" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/finanzas/cash-flow')}
            className="bg-white border border-rose-200 hover:bg-rose-50/30 rounded-lg p-3 text-left flex items-center justify-between transition-colors"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-rose-900">Cash flow · próx. pago</div>
              <div className="text-[10px] text-rose-700">programación egresos</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-rose-700 flex-shrink-0 ml-2" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/contabilidad?tab=pyl')}
            className="bg-white border border-violet-200 hover:bg-violet-50/30 rounded-lg p-3 text-left flex items-center justify-between transition-colors"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-violet-900">P&amp;L · gastos personal</div>
              <div className="text-[10px] text-violet-700">impacto utilidad</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-violet-700 flex-shrink-0 ml-2" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/inversionistas?tab=salud')}
            className="bg-white border border-violet-200 hover:bg-violet-50/30 rounded-lg p-3 text-left flex items-center justify-between transition-colors"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-violet-900">Inversionistas · salud</div>
              <div className="text-[10px] text-violet-700">ratio costo/ingresos</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-violet-700 flex-shrink-0 ml-2" />
          </button>
        </div>
      </div>

      {/* §G · Alertas activas · si hay pendientes accionables */}
      {(stats.boletasBorrador > 0 || stats.bonosPendientes > 0 || stats.adelantosPendientes > 0) && (
        <div>
          <h3 className="text-[13px] font-bold text-slate-900 mb-2 inline-flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-700" />
            Pendientes accionables
          </h3>
          <div className="space-y-2">
            {stats.boletasBorrador > 0 && (
              <button
                type="button"
                onClick={() => onIrATab?.('boletas')}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg p-3 text-left flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-[12px] font-semibold text-slate-900">
                      {stats.boletasBorrador} boleta{stats.boletasBorrador === 1 ? '' : 's'} en borrador
                    </div>
                    <div className="text-[10px] text-slate-500">requieren aprobación antes de pagar</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            )}
            {stats.bonosPendientes > 0 && (
              <button
                type="button"
                onClick={() => onIrATab?.('incentivos')}
                className="w-full bg-amber-50 hover:bg-amber-100/60 border border-amber-200 rounded-lg p-3 text-left flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-700" />
                  <div>
                    <div className="text-[12px] font-semibold text-amber-900">
                      {stats.bonosPendientes} bono{stats.bonosPendientes === 1 ? '' : 's'} pendiente{stats.bonosPendientes === 1 ? '' : 's'} de aprobación
                    </div>
                    <div className="text-[10px] text-amber-700">revisar y aprobar/rechazar</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-700" />
              </button>
            )}
            {stats.adelantosPendientes > 0 && (
              <button
                type="button"
                onClick={() => onIrATab?.('adelantos')}
                className="w-full bg-amber-50 hover:bg-amber-100/60 border border-amber-200 rounded-lg p-3 text-left flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-700 rotate-45" />
                  <div>
                    <div className="text-[12px] font-semibold text-amber-900">
                      {stats.adelantosPendientes} adelanto{stats.adelantosPendientes === 1 ? '' : 's'} pendiente{stats.adelantosPendientes === 1 ? '' : 's'}
                    </div>
                    <div className="text-[10px] text-amber-700">aprobar o rechazar solicitudes</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-700" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TabResumenPlanilla;
