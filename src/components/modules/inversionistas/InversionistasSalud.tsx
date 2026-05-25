/**
 * Tab 6 · Salud financiera · Soberanía + Runway + Equity + Múltiplos
 *
 * Cubre §6 mockup completo: card soberanía (¿cuándo el negocio camina solo?)
 * + card RUNWAY (deuda F · días sin vender un peso) + barra equity + 4
 * múltiplos financieros.
 *
 * Mobile: cards stack vertical, múltiplos 2 cols mobile / 4 cols desktop.
 */
import React from 'react';
import { Flag, Zap, ShieldCheck, BarChart3, AlertCircle } from 'lucide-react';
import { formatCurrencyPEN } from '../../../utils/format';
import type { ResumenInversionista } from '../../../types/inversionista.types';

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
  // Proxy: ventas mes × (1 - margen neto) = costos+gastos del mes
  const costosGastosMensuales = data.ventasMesActualPEN * (1 - data.margenNetoMesActual / 100);
  // Caja estimada · usamos activos - inventario (~70%) como proxy de caja
  // En la práctica esto debería venir del Balance · simplificación aquí
  const cajaEstimada = data.activosPEN * 0.15; // proxy conservador
  const runwayDias = costosGastosMensuales > 0
    ? Math.round((cajaEstimada / costosGastosMensuales) * 30)
    : 0;
  const META_RUNWAY = 60;

  return (
    <div className="space-y-3">
      {/* 2 cards · Soberanía + Runway · stack mobile */}
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

          {/* Barra progreso */}
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

        {/* RUNWAY · DEUDA F cubierta */}
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

      {/* Equity ratio · barra horizontal · highlight */}
      <div className="bg-white border border-emerald-200 rounded-2xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <h3 className="text-[12px] font-bold text-emerald-900">Equity ratio · cuán libre de deuda</h3>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <div className="text-right">
              <div className="text-slate-500 text-[10px]">Patrimonio</div>
              <div className="tabular-nums font-semibold">{formatCurrencyPEN(data.equityRatio.patrimonioPEN)}</div>
            </div>
            <div className="text-right">
              <div className="text-slate-500 text-[10px]">Activos</div>
              <div className="tabular-nums font-semibold">{formatCurrencyPEN(data.equityRatio.activosPEN)}</div>
            </div>
            <div className="text-right">
              <div className="text-emerald-700 text-[10px] font-bold uppercase">{data.equityRatio.salud}</div>
              <div className="tabular-nums text-emerald-900 text-[16px] font-bold">
                {data.equityRatio.porcentaje.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
        <div className="h-3 bg-slate-100 rounded-lg overflow-hidden relative">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-600"
            style={{ width: `${Math.min(100, data.equityRatio.porcentaje)}%` }}
          />
        </div>
      </div>

      {/* Múltiplos financieros · 4 chips · 2 cols mobile, 4 cols desktop */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="text-[12px] font-bold text-slate-900 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-600" />
          Múltiplos financieros · valuación aproximada
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
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
          <div className="bg-emerald-50 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-emerald-700 mb-0.5">Multiplicador</div>
            <div className="text-[14px] font-bold tabular-nums text-emerald-900">
              {data.multiplicador.multiplicador > 0 ? `${data.multiplicador.multiplicador.toFixed(2)}x` : '—'}
            </div>
            <div className="text-[9px] text-emerald-700">por S/1 puesto</div>
          </div>
        </div>
      </div>
    </div>
  );
}
