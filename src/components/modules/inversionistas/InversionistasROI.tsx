/**
 * Tab 4 · ROI dual + Costo financiero del negocio
 *
 * Cubre §4 mockup completo: 2 cards ROI (propio vs comprometido) + card
 * costo financiero con intereses TC pagados, % del margen y veredicto.
 *
 * Mobile: 2 cards ROI apilan verticalmente, costo financiero abajo.
 */
import React from 'react';
import { TrendingUp, Layers, AlertCircle } from 'lucide-react';
import { formatCurrencyPEN, formatPercent } from '../../../utils/format';
import type { ResumenInversionista } from '../../../types/inversionista.types';

interface Props {
  data: ResumenInversionista;
}

export default function InversionistasROI({ data }: Props) {
  const roiPropio = data.roiDual.sobreCashAportado * 100;
  const roiComprometido = data.roiDual.sobreCapitalComprometido * 100;

  // Costo financiero estimado · TEA promedio 39-42% en TCs personales
  // Estimación conservadora: 40% TEA sobre deuda TC vigente promedio del año
  const TEA_PROMEDIO = 0.40;
  const intereses_anuales_estimados = data.capitalComprometido.deudaTCPersonalPEN * TEA_PROMEDIO;
  // YTD = proporcional a mes actual del año (asume cálculo en mes corte)
  const mesActual = new Date().getMonth() + 1;
  const intereses_ytd = intereses_anuales_estimados * (mesActual / 12);

  // % del margen bruto · usamos utilidad neta acumulada como proxy
  const ventasAnuales = data.ventasMesActualPEN * 12; // proxy anualizado
  const pctDelMargenBruto = ventasAnuales > 0 ? (intereses_ytd / ventasAnuales) * 100 : 0;

  // Veredicto apalancamiento positivo si ROI sobre comprometido > TEA TC
  const apalancamientoConveniente = roiComprometido > TEA_PROMEDIO * 100;

  return (
    <div className="space-y-3">
      {/* 2 cards ROI · stack mobile, 2 cols desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ROI sobre capital PROPIO */}
        <div className="bg-white border border-emerald-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-700" />
            <h3 className="text-[12px] font-bold text-emerald-900">ROI sobre capital PROPIO</h3>
          </div>
          <div className="text-[28px] font-bold tabular-nums text-emerald-700">
            {formatPercent(roiPropio, 1)}
          </div>
          <div className="text-[11px] text-emerald-700">
            sobre {formatCurrencyPEN(data.capitalComprometido.cashAportadoPEN)} propios
          </div>
          <div className="mt-3 pt-3 border-t border-emerald-100 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-600">Utilidad neta acum.</span>
              <span className="tabular-nums font-semibold">
                {formatCurrencyPEN(data.roiDual.utilidadNetaAcumuladaPEN)}
              </span>
            </div>
            <div className="flex justify-between font-bold border-t border-emerald-100 pt-1">
              <span className="text-emerald-900">Capital propio</span>
              <span className="tabular-nums text-emerald-900">
                {formatCurrencyPEN(data.capitalComprometido.cashAportadoPEN)}
              </span>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-emerald-700 bg-emerald-50 rounded p-1.5">
            {roiPropio >= 15 ? '✓ ROI saludable · meta ≥15%' : '⚠ Por debajo de meta 15%'}
          </div>
        </div>

        {/* ROI sobre capital COMPROMETIDO */}
        <div className="bg-white border border-violet-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-violet-700" />
            <h3 className="text-[12px] font-bold text-violet-900">ROI sobre capital COMPROMETIDO</h3>
          </div>
          <div className="text-[28px] font-bold tabular-nums text-violet-700">
            {formatPercent(roiComprometido, 1)}
          </div>
          <div className="text-[11px] text-violet-700">
            sobre {formatCurrencyPEN(data.capitalComprometido.totalPEN)} (incluye TC)
          </div>
          <div className="mt-3 pt-3 border-t border-violet-100 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-600">Utilidad neta acum.</span>
              <span className="tabular-nums font-semibold">
                {formatCurrencyPEN(data.roiDual.utilidadNetaAcumuladaPEN)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Capital propio</span>
              <span className="tabular-nums text-slate-700">
                {formatCurrencyPEN(data.capitalComprometido.cashAportadoPEN)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">+ TC personal</span>
              <span className="tabular-nums text-slate-700">
                {formatCurrencyPEN(data.capitalComprometido.deudaTCPersonalPEN)}
              </span>
            </div>
            <div className="flex justify-between font-bold border-t border-violet-100 pt-1">
              <span className="text-violet-900">Capital comprometido</span>
              <span className="tabular-nums text-violet-900">
                {formatCurrencyPEN(data.capitalComprometido.totalPEN)}
              </span>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-violet-700 bg-violet-50 rounded p-1.5">
            {roiComprometido >= 20
              ? '✓ Apalancamiento te conviene · ROI > costo TC'
              : '⚠ ROI cerca o por debajo del costo TC · revisar'}
          </div>
        </div>
      </div>

      {/* Costo financiero del negocio · canon §4 mockup */}
      {data.capitalComprometido.deudaTCPersonalPEN > 0 && (
        <div className="bg-white border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-700" />
            <h3 className="text-[12px] font-bold text-amber-900">Costo financiero del negocio</h3>
          </div>
          {/* 3 chips: stack en mobile, grid 3 en desktop */}
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
                {pctDelMargenBruto.toFixed(1)}%
              </div>
              <div className="text-[10px] text-amber-700">de cada S/100 vendidos</div>
            </div>
            <div className={`${apalancamientoConveniente ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'} border rounded-lg p-3`}>
              <div className={`text-[10px] uppercase font-bold mb-0.5 ${apalancamientoConveniente ? 'text-emerald-700' : 'text-rose-700'}`}>
                VEREDICTO
              </div>
              <div className={`text-[14px] font-bold ${apalancamientoConveniente ? 'text-emerald-900' : 'text-rose-900'}`}>
                {apalancamientoConveniente ? 'Apalancamiento positivo ✓' : 'Apalancamiento riesgoso ⚠'}
              </div>
              <div className={`text-[10px] ${apalancamientoConveniente ? 'text-emerald-700' : 'text-rose-700'}`}>
                {apalancamientoConveniente
                  ? `ROI ${roiComprometido.toFixed(0)}% > costo ${(TEA_PROMEDIO * 100).toFixed(0)}% TC`
                  : `ROI ${roiComprometido.toFixed(0)}% ≤ costo ${(TEA_PROMEDIO * 100).toFixed(0)}% TC`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
