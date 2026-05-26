/**
 * TabAnalisisReportes.tsx
 *
 * chk5.PERSONAS-v5.4 · F4 · 2026-05-26
 *
 * Tab "Análisis & Reportes" · Planilla v5.4.
 * Canon sky · mockup planilla-v5.4-completo.html ACTO 4.
 *
 * Cost Analytics 360:
 *  - KPI ejecutivos del payroll
 *  - Serie temporal últimos 12 meses
 *  - Distribución por departamento (donut visual con barras stacked)
 *  - Top empleados por bonos del año
 *  - Cross-links a /gastos /finanzas/cash-flow /contabilidad/p&l /inversionistas/salud
 */
import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Wallet,
  TrendingUp,
  Trophy,
  ArrowRight,
  Download,
  PieChart,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { planillaAnalyticsService, type CostoLaboralMensual, type DistribucionDepartamento, type TopEmpleadoBonos } from '../../../services/planillaAnalytics.service';
import { formatCurrencyPEN } from '../../../utils/format';

interface TabAnalisisReportesProps {
  mes: number;
  anio: number;
}

// ───── Helpers ─────

function mesNombreCorto(m: number): string {
  return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][m - 1] ?? '';
}

/** Mini bar chart SVG · 12 puntos · color sky */
const MiniBars: React.FC<{ serie: CostoLaboralMensual[] }> = ({ serie }) => {
  if (serie.length === 0) {
    return <div className="text-[11px] text-slate-400">Sin data</div>;
  }
  const max = Math.max(...serie.map((s) => s.totalCostoLaboral), 1);
  const barW = 28;
  const gap = 4;
  const h = 80;
  return (
    <div className="overflow-x-auto">
      <svg
        width={serie.length * (barW + gap)}
        height={h + 20}
        className="block"
        role="img"
        aria-label="Costo laboral mensual"
      >
        {serie.map((m, i) => {
          const altura = (m.totalCostoLaboral / max) * h;
          return (
            <g key={`${m.anio}-${m.mes}`} transform={`translate(${i * (barW + gap)}, 0)`}>
              <rect
                x={0}
                y={h - altura}
                width={barW}
                height={altura}
                rx={3}
                className="fill-sky-500"
              />
              <text
                x={barW / 2}
                y={h + 14}
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

// ───── COMPONENT ─────

export const TabAnalisisReportes: React.FC<TabAnalisisReportesProps> = ({ mes, anio }) => {
  const navigate = useNavigate();
  const [serie, setSerie] = useState<CostoLaboralMensual[]>([]);
  const [distribucion, setDistribucion] = useState<DistribucionDepartamento[]>([]);
  const [topBonos, setTopBonos] = useState<TopEmpleadoBonos[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [s, d, t] = await Promise.all([
          planillaAnalyticsService.costoLaboralPorMes(12),
          planillaAnalyticsService.distribucionDepartamentoMes(mes, anio),
          planillaAnalyticsService.topEmpleadosBonosAnio(anio, 10),
        ]);
        setSerie(s);
        setDistribucion(d);
        setTopBonos(t);
      } catch (err) {
        console.error('[TabAnalisisReportes] error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [mes, anio]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="text-[12px]">Cargando análisis...</div>
      </div>
    );
  }

  // KPIs ejecutivos derivados de la serie
  const payrollYTD = serie
    .filter((s) => s.anio === anio)
    .reduce((acc, s) => acc + s.totalCostoLaboral, 0);
  const ultimoMes = serie[serie.length - 1];
  const penultimoMes = serie[serie.length - 2];
  const variacionMoM =
    ultimoMes && penultimoMes && penultimoMes.totalCostoLaboral > 0
      ? ((ultimoMes.totalCostoLaboral - penultimoMes.totalCostoLaboral) /
          penultimoMes.totalCostoLaboral) *
        100
      : 0;
  const totalBonosYTD = topBonos.reduce((s, t) => s + t.totalBonosPEN, 0);
  const promedioCostoMes = serie.length > 0 ? payrollYTD / serie.length : 0;

  // Empty state si no hay data
  if (serie.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <div className="text-[13px] font-bold text-slate-700 mb-1">Sin data histórica</div>
          <p className="text-[12px] text-slate-500 max-w-md mx-auto">
            Genera boletas mensuales para ver el costo laboral evolutivo y análisis 360°.
            Los reportes se llenan automáticamente con cada cierre de planilla.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* §A · KPIs ejecutivos · 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-sky-50 to-sky-100/40 ring-1 ring-sky-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-sky-700 font-bold">PAYROLL YTD</span>
            <Wallet className="w-3.5 h-3.5 text-sky-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-sky-900">
            {formatCurrencyPEN(payrollYTD)}
          </div>
          <div className="text-[10px] text-sky-700 mt-1">{serie.length} meses acumulados</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">PROMEDIO MES</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">
            {formatCurrencyPEN(promedioCostoMes)}
          </div>
          <div className="text-[10px] text-emerald-700 mt-1">por mes en período analizado</div>
        </div>
        <div
          className={`bg-gradient-to-br ${
            variacionMoM >= 0
              ? 'from-amber-50 to-amber-100/40 ring-amber-200/50'
              : 'from-rose-50 to-rose-100/40 ring-rose-200/50'
          } ring-1 rounded-2xl p-4`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-[10px] uppercase tracking-wider font-bold ${
                variacionMoM >= 0 ? 'text-amber-700' : 'text-rose-700'
              }`}
            >
              Δ MoM
            </span>
            <BarChart3
              className={`w-3.5 h-3.5 ${variacionMoM >= 0 ? 'text-amber-700' : 'text-rose-700'}`}
            />
          </div>
          <div
            className={`text-2xl font-bold tabular-nums ${
              variacionMoM >= 0 ? 'text-amber-900' : 'text-rose-900'
            }`}
          >
            {variacionMoM >= 0 ? '+' : ''}
            {variacionMoM.toFixed(1)}%
          </div>
          <div
            className={`text-[10px] mt-1 ${variacionMoM >= 0 ? 'text-amber-700' : 'text-rose-700'}`}
          >
            vs mes anterior
          </div>
        </div>
        <div className="bg-gradient-to-br from-violet-50 to-violet-100/40 ring-1 ring-violet-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-violet-700 font-bold">BONOS YTD</span>
            <Trophy className="w-3.5 h-3.5 text-violet-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-violet-900">
            {formatCurrencyPEN(totalBonosYTD)}
          </div>
          <div className="text-[10px] text-violet-700 mt-1">
            {payrollYTD > 0 ? `${((totalBonosYTD / payrollYTD) * 100).toFixed(1)}% del payroll` : '—'}
          </div>
        </div>
      </div>

      {/* §B · Serie temporal · 12 meses */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-bold text-slate-900 inline-flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-sky-700" />
            Evolución mensual · últimos {serie.length} meses
          </h3>
          <button
            type="button"
            className="text-[11px] text-slate-600 font-medium hover:bg-slate-100 px-2 py-1 rounded inline-flex items-center gap-1"
          >
            <Download className="w-3 h-3" />
            Exportar CSV
          </button>
        </div>
        <MiniBars serie={serie} />
      </div>

      {/* §C · Grid · distribución departamento + top bonos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Distribución por departamento */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-[14px] font-bold text-slate-900 mb-3 inline-flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-emerald-700" />
            Costo por departamento · {mesNombreCorto(mes)} {anio}
          </h3>
          {distribucion.length === 0 ? (
            <div className="text-[11px] text-slate-500 italic">Sin boletas en el mes</div>
          ) : (
            <ul className="space-y-2">
              {distribucion.map((d) => (
                <li key={d.departamento}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="font-semibold text-slate-700">{d.departamento}</span>
                    <span className="tabular-nums text-slate-900 font-bold">
                      {formatCurrencyPEN(d.costoTotalPEN)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded">
                      <div
                        className="h-1.5 bg-sky-500 rounded"
                        style={{ width: `${d.pctDelTotal}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 tabular-nums w-10 text-right">
                      {d.pctDelTotal.toFixed(0)}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top empleados por bonos */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-[14px] font-bold text-slate-900 mb-3 inline-flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-violet-700" />
            Top empleados · bonos {anio}
          </h3>
          {topBonos.length === 0 ? (
            <div className="text-[11px] text-slate-500 italic">Aún sin bonos del año</div>
          ) : (
            <ol className="space-y-2">
              {topBonos.slice(0, 5).map((t, idx) => (
                <li
                  key={t.userId}
                  className="flex items-center gap-2 bg-slate-50 rounded p-2 border border-slate-100"
                >
                  <div className="w-6 h-6 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-[11px] font-bold">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-slate-900 truncate">{t.empleadoNombre}</div>
                    <div className="text-[10px] text-slate-500">{t.cantidadBonos} bonos</div>
                  </div>
                  <div className="text-[12px] font-bold tabular-nums text-violet-700">
                    {formatCurrencyPEN(t.totalBonosPEN)}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* §D · Cross-links 360 · canon F6 (placeholder enriquecido aquí · F6 los habilita end-to-end) */}
      <div className="bg-gradient-to-br from-sky-50 to-violet-50/40 ring-1 ring-sky-200 rounded-xl p-4">
        <h3 className="text-[13px] font-bold text-slate-900 mb-2">Impacto 360° en otros módulos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate('/gastos?categoria=planilla')}
            className="bg-white border border-amber-200 rounded-lg p-3 hover:bg-amber-50/30 text-left flex items-center justify-between"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-amber-900">Gastos · planilla mes</div>
              <div className="text-[10px] text-amber-700">overhead recurrente registrado</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 ml-2" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/finanzas/cash-flow')}
            className="bg-white border border-rose-200 rounded-lg p-3 hover:bg-rose-50/30 text-left flex items-center justify-between"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-rose-900">Cash flow · próximo pago</div>
              <div className="text-[10px] text-rose-700">programación de egresos</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-rose-700 flex-shrink-0 ml-2" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/contabilidad?tab=pyl')}
            className="bg-white border border-sky-200 rounded-lg p-3 hover:bg-sky-50/30 text-left flex items-center justify-between"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-sky-900">P&L · gastos de personal</div>
              <div className="text-[10px] text-sky-700">impacto en utilidad operativa</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-sky-700 flex-shrink-0 ml-2" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/inversionistas?tab=salud')}
            className="bg-white border border-violet-200 rounded-lg p-3 hover:bg-violet-50/30 text-left flex items-center justify-between"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-violet-900">Inversionistas · salud financiera</div>
              <div className="text-[10px] text-violet-700">ratio costo laboral vs ingresos</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-violet-700 flex-shrink-0 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TabAnalisisReportes;
