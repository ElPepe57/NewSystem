/**
 * Tab 6 · Salud financiera · Soberanía + Runway + Bridge + Sensibilidad + Múltiplos
 *
 * chk5.DS-DEDUP (2026-06-01): de-duplicación del KPI strip superior.
 * El strip ya muestra Equity Ratio y Multiplicador → se ELIMINAN de esta tab
 * (eran clones) y se reemplazan por análisis que el strip NO da:
 *  - Equity Value Bridge: cómo se construyó el patrimonio (capital → +utilidades → −retiros → hoy)
 *  - Sensibilidad: 3 escenarios (si las ventas caen/suben 15%, qué pasa con multiplicador y soberanía)
 * Se PRESERVAN (no clonan el strip): Soberanía · Runway · Patr/Ventas · Margen neto · Valuación.
 *
 * Mobile: cards stack vertical · bridge y sensibilidad se apilan.
 */
import React from 'react';
import { Flag, Zap, ShieldCheck, BarChart3, AlertCircle, Info } from 'lucide-react';
import { formatCurrencyPEN } from '../../../utils/format';
import type { ResumenInversionista } from '../../../types/inversionista.types';
// chk5.PERSONAS-v5.4 · F6 · cross-link 360° desde Salud financiera hacia Planilla
import { BannerImpactoPlanilla } from '../planilla/BannerImpactoPlanilla';

interface Props {
  data: ResumenInversionista;
}

export default function InversionistasSalud({ data }: Props) {
  const meses = data.soberania.mesesParaSoberania;
  const totalComprometido = data.capitalComprometido.totalPEN;
  const liberado = data.capitalComprometido.cashAportadoPEN;
  const restante = data.capitalComprometido.deudaTCPersonalPEN;
  const pctCamino = totalComprometido > 0 ? (liberado / totalComprometido) * 100 : 100;

  // Runway · estimación días sin ventas · usa utilidad mensual negativa = gasto
  const costosGastosMensuales = data.ventasMesActualPEN * (1 - data.margenNetoMesActual / 100);
  const cajaEstimada = data.activosPEN * 0.15; // proxy conservador
  const runwayDias = costosGastosMensuales > 0
    ? Math.round((cajaEstimada / costosGastosMensuales) * 30)
    : 0;
  const META_RUNWAY = 60;

  // ─── §B · Equity Value Bridge (cómo se construyó el patrimonio) ───
  const cashAportado = data.capitalComprometido.cashAportadoPEN;
  const utilidadAcum = data.utilidadNetaAcumuladaPEN;
  const totalRetirado = data.retirosPorSocio.reduce((s, r) => s + r.totalRetiradoPEN, 0);
  const patrimonio = data.patrimonioPEN;
  const bridgeMax = Math.max(cashAportado, cashAportado + utilidadAcum, patrimonio, 1);
  const hBar = (v: number) => `${Math.max(4, (Math.abs(v) / bridgeMax) * 100)}%`;
  const multiplicadorReal = data.multiplicador.multiplicador;

  // ─── §B · Sensibilidad (si las ventas cambian ±15%) ───
  const utilBase = data.utilidadNetaMesActualPEN;
  const deudaTC = data.capitalComprometido.deudaTCPersonalPEN;
  // % de la utilidad que se destina a pagar TC · derivado de la soberanía actual
  const pctPagoTC = utilBase > 0 && data.soberania.pagoMensualEstimadoPEN > 0
    ? data.soberania.pagoMensualEstimadoPEN / utilBase
    : 0.30;
  // Supuesto de linealidad: Δ ventas → Δ utilidad proporcional (margen constante)
  const multProyectado = (utilMensual: number) =>
    cashAportado > 0 ? (patrimonio + utilMensual * 12) / cashAportado : 0;
  const sobMeses = (utilMensual: number) =>
    deudaTC > 0 && utilMensual > 0 ? Math.ceil(deudaTC / (utilMensual * pctPagoTC)) : 0;
  const escenarios = [
    {
      key: 'pesimista', label: 'Pesimista', delta: '−15% ventas',
      mult: multProyectado(utilBase * 0.85), sob: sobMeses(utilBase * 0.85),
      box: 'bg-rose-50 ring-rose-200', tone: 'text-rose-700', val: 'text-rose-900',
      frase: 'Seguirías sobre el agua, pero más justo',
    },
    {
      key: 'base', label: 'Base · hoy', delta: 'actual',
      mult: multProyectado(utilBase), sob: sobMeses(utilBase),
      box: 'bg-slate-50 ring-slate-200', tone: 'text-slate-600', val: 'text-slate-900',
      frase: 'La situación actual de tu negocio',
    },
    {
      key: 'optimista', label: 'Optimista', delta: '+15% ventas',
      mult: multProyectado(utilBase * 1.15), sob: sobMeses(utilBase * 1.15),
      box: 'bg-emerald-50 ring-emerald-200', tone: 'text-emerald-700', val: 'text-emerald-900',
      frase: 'Recuperás tu capital antes',
    },
  ];

  return (
    <div className="space-y-3">
      {/* cross-link 360° → Planilla */}
      <BannerImpactoPlanilla variante="salud" ocultarSiVacio={false} />

      {/* 2 cards · Soberanía + Runway · stack mobile · SE QUEDAN (únicos) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Soberanía financiera */}
        <div className="bg-white border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flag className="w-4 h-4 text-amber-700" />
            <h3 className="text-[12px] font-bold text-amber-900">¿Cuándo el negocio camina solo?</h3>
          </div>
          {restante > 0 && data.soberania.pagoMensualEstimadoPEN > 0 ? (
            <>
              <p className="text-[11px] text-slate-600 mb-3">
                Pagando ~{formatCurrencyPEN(data.soberania.pagoMensualEstimadoPEN)}/mes de TC con la utilidad,
                llegás a S/0 de deuda personal en:
              </p>
              <div className="text-[24px] font-bold tabular-nums text-amber-900">
                ~{Math.ceil(meses)} meses
              </div>
              <div className="text-[11px] text-amber-700 mb-3">Soberanía financiera 100%</div>
            </>
          ) : restante === 0 ? (
            <>
              <p className="text-[11px] text-slate-600 mb-3">No hay deuda personal vigente.</p>
              <div className="text-[24px] font-bold tabular-nums text-emerald-900">✓ Liberado</div>
              <div className="text-[11px] text-emerald-700 mb-3">Soberanía financiera 100% alcanzada</div>
            </>
          ) : (
            <>
              <p className="text-[11px] text-slate-600 mb-3">
                Aún no hay utilidad recurrente para proyectar pago de TC.
              </p>
              <div className="text-[24px] font-bold tabular-nums text-slate-700">—</div>
            </>
          )}
          <div className="h-6 bg-slate-100 rounded-lg overflow-hidden relative">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-600"
              style={{ width: `${Math.min(100, Math.max(0, pctCamino))}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white px-2 text-center">
              {pctCamino.toFixed(0)}% · {formatCurrencyPEN(restante)} restantes
            </div>
          </div>
        </div>

        {/* RUNWAY */}
        <div className="bg-white border border-teal-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-teal-700" />
            <h3 className="text-[12px] font-bold text-teal-900">Runway · días sin vender un peso</h3>
          </div>
          <p className="text-[11px] text-slate-600 mb-3">
            Caja estimada {formatCurrencyPEN(cajaEstimada)} y gastos ~{formatCurrencyPEN(costosGastosMensuales)}/mes:
          </p>
          <div className="text-[24px] font-bold tabular-nums text-teal-900">
            {runwayDias > 0 ? `~${runwayDias} días` : '—'}
          </div>
          <div className="text-[11px] text-teal-700 mb-3">
            de operación sin ingresos · meta ≥{META_RUNWAY}
          </div>
          {runwayDias > 0 && runwayDias < META_RUNWAY && (
            <div className="bg-amber-50 rounded p-2 text-[10px] text-amber-700 flex items-start gap-1">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>Runway por debajo de meta · considerá conservar más caja antes de retirar dividendos.</span>
            </div>
          )}
          {runwayDias >= META_RUNWAY && (
            <div className="bg-emerald-50 rounded p-2 text-[10px] text-emerald-700 flex items-start gap-1">
              <ShieldCheck className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>Runway saludable · podés operar &gt;{META_RUNWAY} días sin ingresos.</span>
            </div>
          )}
        </div>
      </div>

      {/* §B · EQUITY VALUE BRIDGE · NUEVO (reemplaza la card Equity ratio que clonaba el strip) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-4 h-4 text-violet-600" />
          <h3 className="text-[12px] font-bold text-slate-900">Cómo se construyó tu patrimonio</h3>
        </div>
        <p className="text-[11px] text-slate-400 mb-1">de lo que pusiste a lo que vale hoy</p>
        <div className="flex items-end justify-between gap-3 sm:gap-6 h-44 pt-6 px-2">
          {/* capital */}
          <div className="flex-1 flex flex-col items-center">
            <span className="text-[11px] font-bold tabular-nums text-violet-900 mb-1">{formatCurrencyPEN(cashAportado)}</span>
            <div className="w-full bg-violet-500 rounded-t" style={{ height: hBar(cashAportado) }} />
            <span className="text-[10px] text-slate-500 mt-1.5 text-center leading-tight">Capital que<br />pusiste</span>
          </div>
          {/* +utilidades */}
          <div className="flex-1 flex flex-col items-center justify-end h-full">
            <span className="text-[11px] font-bold tabular-nums text-emerald-700 mb-1">+ {formatCurrencyPEN(utilidadAcum)}</span>
            <div className="w-full bg-emerald-500 rounded-t" style={{ height: hBar(utilidadAcum) }} />
            <span className="text-[10px] text-slate-500 mt-1.5 text-center leading-tight">Utilidades<br />generadas</span>
          </div>
          {/* -retiros */}
          <div className="flex-1 flex flex-col items-center justify-end h-full">
            <span className="text-[11px] font-bold tabular-nums text-rose-700 mb-1">− {formatCurrencyPEN(totalRetirado)}</span>
            <div className="w-full bg-rose-400 rounded-t" style={{ height: hBar(totalRetirado) }} />
            <span className="text-[10px] text-slate-500 mt-1.5 text-center leading-tight">Dinero<br />retirado</span>
          </div>
          {/* =patrimonio */}
          <div className="flex-1 flex flex-col items-center">
            <span className="text-[11px] font-bold tabular-nums text-teal-900 mb-1">{formatCurrencyPEN(patrimonio)}</span>
            <div className="w-full bg-teal-600 rounded-t" style={{ height: hBar(patrimonio) }} />
            <span className="text-[10px] text-slate-700 font-semibold mt-1.5 text-center leading-tight">Patrimonio<br />hoy</span>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex items-start gap-1.5">
          <Info className="w-3 h-3 mt-0.5 text-violet-500 flex-shrink-0" />
          <span>
            Pusiste <strong>{formatCurrencyPEN(cashAportado)}</strong> · el negocio generó <strong>{formatCurrencyPEN(utilidadAcum)}</strong> ·
            retiraste <strong>{formatCurrencyPEN(totalRetirado)}</strong> · tu patrimonio hoy vale <strong>{formatCurrencyPEN(patrimonio)}</strong>
            {multiplicadorReal > 0 && <> ({multiplicadorReal.toFixed(2)}× lo que pusiste)</>}.
          </span>
        </div>
      </div>

      {/* §B · SENSIBILIDAD · NUEVO (reemplaza el chip Multiplicador que clonaba el strip) */}
      <div>
        <div className="flex items-center gap-2 mb-2 ml-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">¿Qué pasa si las ventas cambian?</span>
          <span className="text-[9px] text-slate-400">proyección a 12m · supuesto de margen constante</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {escenarios.map((e) => (
            <div key={e.key} className={`${e.box} ring-1 rounded-xl p-3`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] uppercase tracking-wider ${e.tone} font-bold`}>{e.label}</span>
                <span className={`text-[11px] font-bold ${e.tone} tabular-nums`}>{e.delta}</span>
              </div>
              <div className="space-y-0.5 text-[12px]">
                <div className="flex justify-between"><span className="text-slate-600">Multiplicador</span><span className={`tabular-nums font-bold ${e.val}`}>{e.mult > 0 ? `${e.mult.toFixed(2)}×` : '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Soberanía</span><span className={`tabular-nums font-bold ${e.val}`}>{e.sob > 0 ? `${e.sob} meses` : '✓ libre'}</span></div>
              </div>
              <div className={`text-[10px] ${e.tone} mt-2 leading-snug`}>{e.frase}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Múltiplos financieros · 3 chips ÚNICOS (sin Multiplicador · ese clonaba el strip) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="text-[12px] font-bold text-slate-900 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-600" />
          Múltiplos financieros · valuación aproximada
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
          <div className="bg-slate-50 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-slate-500 mb-0.5">Patr / Ventas mes</div>
            <div className="text-[14px] font-bold tabular-nums text-slate-900">
              {data.ventasMesActualPEN > 0
                ? `${(data.patrimonioPEN / data.ventasMesActualPEN).toFixed(2)}x`
                : '—'}
            </div>
            <div className="text-[9px] text-slate-500">eficiencia capital</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-slate-500 mb-0.5">Margen neto</div>
            <div className="text-[14px] font-bold tabular-nums text-slate-900">
              {data.margenNetoMesActual.toFixed(1)}%
            </div>
            <div className="text-[9px] text-slate-500">de ventas</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-slate-500 mb-0.5">Valuación aprox.</div>
            <div className="text-[14px] font-bold tabular-nums text-slate-900">
              {data.roiDual.utilidadNetaAcumuladaPEN > 0
                ? `${formatCurrencyPEN(data.roiDual.utilidadNetaAcumuladaPEN * 2)}–${formatCurrencyPEN(data.roiDual.utilidadNetaAcumuladaPEN * 3)}`
                : '—'}
            </div>
            <div className="text-[9px] text-slate-500">2-3x UN anual</div>
          </div>
        </div>
      </div>
    </div>
  );
}
