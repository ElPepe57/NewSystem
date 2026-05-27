/**
 * MisIncentivos · F10.F.1.F · 2026-05-27
 *
 * Card emerald con resumen de bonos/incentivos del mes para el empleado.
 * Muestra:
 *   - Bono del mes en curso (calculado / aprobado / pagado)
 *   - Histórico últimos 3 meses (tabla mini)
 *   - Cross-link a /planilla?tab=incentivos
 *
 * Canon v8.0 N1 · color semántico emerald (success · ganancia)
 * Solo aparece si el user tiene calculos en historial.
 */
import React from 'react';
import { Sparkles, TrendingUp, ExternalLink, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrencyPEN } from '../../../utils/format';
import type { CalculoIncentivoMes } from '../../../types/planilla.types';

interface Props {
  calculos: CalculoIncentivoMes[];
  loading?: boolean;
}

const MES_LABEL = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const ESTADO_COLOR: Record<CalculoIncentivoMes['estado'], { bg: string; text: string; label: string }> = {
  calculado: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Por aprobar' },
  aprobado: { bg: 'bg-sky-100', text: 'text-sky-700', label: 'Aprobado' },
  rechazado: { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Rechazado' },
  incluido_en_boleta: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'En boleta' },
};

export const MisIncentivos: React.FC<Props> = ({ calculos, loading = false }) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-5 text-center">
        <Sparkles className="w-6 h-6 mx-auto mb-2 text-emerald-300 animate-pulse" />
        <div className="text-[12px] text-slate-500">Cargando incentivos...</div>
      </div>
    );
  }

  if (calculos.length === 0) {
    // Empty state pedagógico · NO ocultar la card · canon N8
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-emerald-700" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-emerald-700 font-bold">Mis incentivos</div>
            <div className="text-[14px] font-semibold text-emerald-900 leading-tight">Aún sin bonos calculados</div>
            <div className="text-[11px] text-slate-600 mt-1">
              Cuando tu esquema de incentivos genere el primer cálculo, aparecerá aquí.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Cálculo del mes en curso · si existe
  const ahora = new Date();
  const mesActual = ahora.getMonth() + 1;
  const anioActual = ahora.getFullYear();
  const calculoMesActual = calculos.find((c) => c.mes === mesActual && c.anio === anioActual);

  // Histórico · ordenado desc · excluyendo el mes actual
  const historico = calculos
    .filter((c) => !(c.mes === mesActual && c.anio === anioActual))
    .slice(0, 3);

  // Total proyectado · suma del último mes con histórico de 3m
  const totalUltimos3m = historico.reduce((sum, c) => sum + c.bonoCalculado, 0);

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl overflow-hidden">
      {/* Header card */}
      <div className="px-4 py-3 border-b border-emerald-200/60 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-emerald-700 flex-shrink-0" />
        <span className="text-[11px] uppercase tracking-wider text-emerald-700 font-bold">
          Mis incentivos
        </span>
        <button
          type="button"
          onClick={() => navigate('/planilla?tab=incentivos')}
          className="ml-auto text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
        >
          Ver detalle
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Mes actual · destacado */}
      <div className="bg-white p-4 sm:p-5">
        {calculoMesActual ? (
          <>
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">
                  Bono · {MES_LABEL[mesActual]} {anioActual}
                </div>
                <div className="text-[28px] sm:text-[32px] font-bold tabular-nums text-emerald-900 leading-none mt-1">
                  {formatCurrencyPEN(calculoMesActual.bonoCalculado)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {calculoMesActual.esquemaNombre} ·{' '}
                  {calculoMesActual.metricaCalculada.unidad === 'S/'
                    ? formatCurrencyPEN(calculoMesActual.metricaCalculada.valorMedido)
                    : `${calculoMesActual.metricaCalculada.valorMedido} ${calculoMesActual.metricaCalculada.unidad}`}
                </div>
              </div>
              <span
                className={`inline-flex items-center text-[10px] px-2 py-1 rounded font-bold ${
                  ESTADO_COLOR[calculoMesActual.estado].bg
                } ${ESTADO_COLOR[calculoMesActual.estado].text}`}
              >
                {ESTADO_COLOR[calculoMesActual.estado].label}
              </span>
            </div>

            {/* Barra cumplimiento · si hay objetivo */}
            {typeof calculoMesActual.metricaCalculada.cumplePct === 'number' && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                  <span>Cumplimiento</span>
                  <span className="tabular-nums font-bold text-emerald-700">
                    {calculoMesActual.metricaCalculada.cumplePct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, calculoMesActual.metricaCalculada.cumplePct)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-emerald-300 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-slate-700">
                Sin cálculo aún para {MES_LABEL[mesActual]} {anioActual}
              </div>
              <div className="text-[11px] text-slate-500">
                El cálculo se ejecuta automáticamente el día 1 del mes siguiente.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Histórico mini · 3 últimos meses */}
      {historico.length > 0 && (
        <div className="bg-slate-50/60 border-t border-emerald-200/60 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              Histórico 3 meses
            </span>
            <span className="text-[11px] tabular-nums font-bold text-slate-700 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-600" />
              {formatCurrencyPEN(totalUltimos3m)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {historico.map((c) => (
              <div
                key={c.id}
                className="bg-white border border-slate-100 rounded-lg p-2 text-center"
              >
                <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                  {MES_LABEL[c.mes]} {String(c.anio).slice(-2)}
                </div>
                <div className="text-[13px] font-bold text-slate-900 tabular-nums mt-0.5">
                  {formatCurrencyPEN(c.bonoCalculado)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MisIncentivos;
