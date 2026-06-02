/**
 * Tab 4 · ROI · Payback + IRR + ROI propio + Costo financiero
 *
 * chk5.DS-DEDUP (2026-06-01): de-duplicación del KPI strip superior.
 * El strip ya muestra "ROI anual" (= ROI sobre capital comprometido) → se ELIMINA
 * de esta tab (era un clon) y se reemplaza por análisis que el strip NO da:
 *  - Payback: en cuántos meses el negocio te devuelve TODO el capital comprometido
 *  - IRR (rentabilidad anualizada · CAGR) vs benchmarks (plazo fijo · dólar · S&P)
 * Se PRESERVAN (no clonan el strip): ROI sobre capital propio · Costo financiero TC
 * (este último se UPGRADEA con el punto de quiebre del apalancamiento).
 *
 * Mobile: cards apilan verticalmente.
 */
import React from 'react';
import { TrendingUp, CalendarClock, AlertCircle, Info } from 'lucide-react';
import { formatCurrencyPEN, formatPercent } from '../../../utils/format';
import type { ResumenInversionista } from '../../../types/inversionista.types';

interface Props {
  data: ResumenInversionista;
}

export default function InversionistasROI({ data }: Props) {
  const roiPropio = data.roiDual.sobreCashAportado * 100;
  const roiComprometido = data.roiDual.sobreCapitalComprometido * 100;
  const capitalTotal = data.capitalComprometido.totalPEN;
  const utilidadAcum = data.roiDual.utilidadNetaAcumuladaPEN;
  const utilidadMensual = data.utilidadNetaMesActualPEN;
  const patrimonio = data.patrimonioPEN;

  // ─── §A · PAYBACK (recuperación del capital comprometido) ───
  const paybackMeses = utilidadMensual > 0 ? capitalTotal / utilidadMensual : null;
  const pctRecuperado = capitalTotal > 0 ? Math.min(100, (utilidadAcum / capitalTotal) * 100) : 0;
  const recuperado = pctRecuperado >= 100;
  const mesesLleva = utilidadMensual > 0 ? Math.round(utilidadAcum / utilidadMensual) : null;
  const mesesFaltan = paybackMeses !== null ? Math.max(0, Math.round(paybackMeses - (mesesLleva ?? 0))) : null;

  // ─── §A · IRR aproximada (CAGR del capital comprometido → patrimonio) ───
  // Nota: aproximación CAGR de 2 puntos (no XIRR ponderado · el resumen no expone
  // los aportes individuales con fecha · solo el primer aporte por socio).
  const fechasPrimerAporte = data.aportesPorSocio
    .map((a) => a.fechaPrimerAporte?.toMillis?.())
    .filter((x): x is number => typeof x === 'number');
  const primerAporteMs = fechasPrimerAporte.length > 0 ? Math.min(...fechasPrimerAporte) : null;
  const aniosInvertido = primerAporteMs ? (Date.now() - primerAporteMs) / (1000 * 60 * 60 * 24 * 365.25) : 0;
  const cagr = aniosInvertido > 0.08 && capitalTotal > 0 && patrimonio > 0
    ? (Math.pow(patrimonio / capitalTotal, 1 / aniosInvertido) - 1) * 100
    : null;
  const BENCHMARKS = [
    { label: 'Plazo fijo banco', valor: 6 },
    { label: 'Dólar / USD', valor: 10 },
    { label: 'S&P 500 prom.', valor: 12 },
  ];
  const maxBar = Math.max(cagr ?? 0, 12, 1);

  // ─── Costo financiero estimado · TEA promedio 40% en TCs personales ───
  const TEA_PROMEDIO = 0.40;
  const intereses_anuales_estimados = data.capitalComprometido.deudaTCPersonalPEN * TEA_PROMEDIO;
  const mesActual = new Date().getMonth() + 1;
  const intereses_ytd = intereses_anuales_estimados * (mesActual / 12);
  const ventasAnuales = data.ventasMesActualPEN * 12;
  const pctDeVentas = ventasAnuales > 0 ? (intereses_ytd / ventasAnuales) * 100 : 0;
  const apalancamientoConveniente = roiComprometido > TEA_PROMEDIO * 100;

  return (
    <div className="space-y-3">

      {/* §A · PAYBACK · NUEVO #1 (reemplaza la card ROI-comprometido que clonaba el strip) */}
      <div className="bg-white border border-amber-200 rounded-2xl p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <CalendarClock className="w-4 h-4 text-amber-600" />
          <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">Recuperación del capital · Payback</span>
        </div>
        {paybackMeses !== null ? (
          <>
            <div className="text-[18px] font-bold text-slate-900 mb-2">
              {recuperado ? (
                <>Ya recuperaste todo tu capital · <span className="text-emerald-700">ahora es ganancia pura</span></>
              ) : (
                <>Recuperás todo tu capital en <span className="text-amber-700 tabular-nums">{Math.round(paybackMeses)} meses</span></>
              )}
            </div>
            <div className="h-3 rounded-full bg-slate-200 overflow-hidden mb-1.5">
              <div className={`h-full rounded-full ${recuperado ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${pctRecuperado}%` }} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Ya llevás <strong className="text-slate-700">{mesesLleva ?? 0} meses</strong></span>
              {!recuperado && <span>faltan <strong className="text-slate-700">{mesesFaltan}</strong></span>}
            </div>
          </>
        ) : (
          <div className="text-[13px] text-slate-500">Sin utilidad recurrente para proyectar el payback.</div>
        )}
        <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex items-start gap-1.5">
          <Info className="w-3 h-3 mt-0.5 text-amber-500 flex-shrink-0" />
          <span>Cuánto tarda el negocio en devolverte TODO lo que pusiste (cash + deuda de tarjeta). Después, todo es ganancia.</span>
        </div>
      </div>

      {/* §A · IRR vs benchmarks · NUEVO */}
      <div className="bg-white border border-emerald-200 rounded-2xl p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">Rentabilidad anualizada de tu inversión</span>
        </div>
        {cagr !== null ? (
          <>
            <div className="text-2xl font-bold tabular-nums text-emerald-900 mb-3">
              {cagr.toFixed(0)}%<span className="text-[12px] font-medium text-slate-500"> anual · capital → patrimonio en {aniosInvertido.toFixed(1)} años</span>
            </div>
            <div className="space-y-2">
              {BENCHMARKS.map((b) => (
                <div key={b.label} className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-600 w-32 flex-shrink-0">{b.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-slate-300 rounded-full" style={{ width: `${(b.valor / maxBar) * 100}%` }} /></div>
                  <span className="text-[11px] tabular-nums text-slate-500 w-20 text-right">{b.valor}% · ×{(cagr / b.valor).toFixed(1)}</span>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-emerald-700 w-32 flex-shrink-0">Tu negocio</span>
                <div className="flex-1 h-2 rounded-full bg-emerald-100 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(cagr / maxBar) * 100}%` }} /></div>
                <span className="text-[11px] tabular-nums font-bold text-emerald-700 w-20 text-right">{cagr.toFixed(0)}%</span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-[13px] text-slate-500">Necesitamos la fecha del primer aporte y patrimonio &gt; 0 para calcular la rentabilidad anualizada.</div>
        )}
      </div>

      {/* ROI sobre capital PROPIO · SE QUEDA (único · el strip da el de comprometido) */}
      <div className="bg-white border border-emerald-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-emerald-700" />
          <h3 className="text-[12px] font-bold text-emerald-900">ROI sobre capital PROPIO</h3>
        </div>
        <div className="text-[28px] font-bold tabular-nums text-emerald-700">
          {formatPercent(roiPropio, 1)}
        </div>
        <div className="text-[11px] text-emerald-700">
          sobre {formatCurrencyPEN(data.capitalComprometido.cashAportadoPEN)} propios · el strip muestra el de capital comprometido (incluye TC)
        </div>
        <div className="mt-2 text-[10px] text-emerald-700 bg-emerald-50 rounded p-1.5">
          {roiPropio >= 15 ? '✓ ROI saludable · meta ≥15%' : '⚠ Por debajo de meta 15%'}
        </div>
      </div>

      {/* Costo financiero del negocio · SE QUEDA + UPGRADE (punto de quiebre) */}
      {data.capitalComprometido.deudaTCPersonalPEN > 0 && (
        <div className="bg-white border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-700" />
            <h3 className="text-[12px] font-bold text-amber-900">Costo del apalancamiento TC</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-amber-50/40 rounded-lg p-3">
              <div className="text-[10px] uppercase font-bold text-amber-700 mb-0.5">INTERESES TC EST. YTD</div>
              <div className="text-[18px] font-bold tabular-nums text-amber-900">
                {formatCurrencyPEN(intereses_ytd)}
              </div>
              <div className="text-[10px] text-amber-700">~{(TEA_PROMEDIO * 100).toFixed(0)}% TEA estimado</div>
            </div>
            <div className="bg-amber-50/40 rounded-lg p-3">
              <div className="text-[10px] uppercase font-bold text-amber-700 mb-0.5">% DE VENTAS PROY.</div>
              <div className="text-[18px] font-bold tabular-nums text-amber-900">
                {pctDeVentas.toFixed(1)}%
              </div>
              <div className="text-[10px] text-amber-700">de cada S/100 vendidos</div>
            </div>
            <div className={`${apalancamientoConveniente ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'} border rounded-lg p-3`}>
              <div className={`text-[10px] uppercase font-bold mb-0.5 ${apalancamientoConveniente ? 'text-emerald-700' : 'text-rose-700'}`}>
                PUNTO DE QUIEBRE
              </div>
              <div className={`text-[18px] font-bold tabular-nums ${apalancamientoConveniente ? 'text-emerald-900' : 'text-rose-900'}`}>
                {roiComprometido.toFixed(0)}%
              </div>
              <div className={`text-[10px] ${apalancamientoConveniente ? 'text-emerald-700' : 'text-rose-700'}`}>
                {apalancamientoConveniente
                  ? `te conviene hasta una tasa de ${roiComprometido.toFixed(0)}% (tu ROI > costo ${(TEA_PROMEDIO * 100).toFixed(0)}%)`
                  : `tu ROI ${roiComprometido.toFixed(0)}% ≤ costo ${(TEA_PROMEDIO * 100).toFixed(0)}% TC · revisar`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
