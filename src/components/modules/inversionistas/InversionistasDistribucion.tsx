/**
 * Tab 5 · Distribución · qué se hizo con la utilidad
 *
 * Cubre §5 del mockup completo: barras de utilidades históricas por año
 * (deuda E) + 3 cards reinvertido/TC/distribuido + tabla retiros + banner
 * pedagógico política de distribución.
 *
 * Mobile: barras siguen visibles (chart compacto), 3 cards stack vertical,
 * tabla retiros se convierte en cards apilados (canon F4).
 */
import React, { useMemo } from 'react';
import { Info } from 'lucide-react';
import { formatCurrencyPEN } from '../../../utils/format';
import { formatFechaCorta } from './shared';
import type { ResumenInversionista } from '../../../types/inversionista.types';

interface Props {
  data: ResumenInversionista;
}

export default function InversionistasDistribucion({ data }: Props) {
  const totalRetirado = data.retirosPorSocio.reduce((a, b) => a + b.totalRetiradoPEN, 0);
  const retiradoCapital = data.retirosPorSocio.reduce((a, b) => a + b.porTipo.capital, 0);
  const retiradoUtilidades = data.retirosPorSocio.reduce((a, b) => a + b.porTipo.utilidades, 0);
  const utilidadAcum = data.roiDual.utilidadNetaAcumuladaPEN;
  const pagadoTC = utilidadAcum * 0.30; // proxy · 30% del flujo destinado a TC
  const reinvertido = Math.max(0, utilidadAcum - retiradoUtilidades - pagadoTC);

  const pctReinvertido = utilidadAcum > 0 ? (reinvertido / utilidadAcum) * 100 : 0;
  const pctDistribuido = utilidadAcum > 0 ? (retiradoUtilidades / utilidadAcum) * 100 : 0;
  const pctPagadoTC = utilidadAcum > 0 ? (pagadoTC / utilidadAcum) * 100 : 0;

  // Utilidades por año · agrupar trayectoria por anio (deuda E)
  const utilidadesPorAnio = useMemo(() => {
    const acum = new Map<number, number>();
    data.trayectoria.forEach((t) => {
      acum.set(t.anio, (acum.get(t.anio) || 0) + t.utilidadNeta);
    });
    return Array.from(acum.entries())
      .sort(([a], [b]) => a - b)
      .map(([anio, un]) => ({ anio, un }));
  }, [data.trayectoria]);

  const maxUN = Math.max(...utilidadesPorAnio.map((u) => u.un), 1);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
      {/* §5.1 · Utilidades generadas histórico · DEUDA E cubierta */}
      {utilidadesPorAnio.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2">
            UTILIDADES GENERADAS · {utilidadesPorAnio[0].anio}–{utilidadesPorAnio[utilidadesPorAnio.length - 1].anio}
          </div>
          <div className="flex items-end gap-1.5 h-20 mb-1">
            {utilidadesPorAnio.map(({ anio, un }, i) => {
              const isLast = i === utilidadesPorAnio.length - 1;
              const heightPct = (Math.abs(un) / maxUN) * 100;
              return (
                <div
                  key={anio}
                  className={`flex-1 rounded-t ${isLast ? 'bg-emerald-600' : 'bg-emerald-500'} ${un < 0 ? '!bg-rose-400' : ''}`}
                  style={{ height: `${Math.max(heightPct, 4)}%` }}
                  title={`${anio}: ${formatCurrencyPEN(un)}`}
                />
              );
            })}
          </div>
          <div className="flex gap-1.5 text-[10px] text-slate-500">
            {utilidadesPorAnio.map(({ anio, un }) => (
              <span key={anio} className="flex-1 text-center truncate">
                {anio} · {formatCurrencyPEN(un)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* §5.2 · 3 cards · reinvertido vs pagado TC vs distribuido · stack mobile */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 ${utilidadesPorAnio.length > 0 ? 'pt-3 border-t border-slate-100' : ''}`}>
        <div className="bg-emerald-50/40 border border-emerald-200 rounded-lg p-3">
          <div className="text-[10px] uppercase font-bold text-emerald-700 mb-0.5">REINVERTIDO EN NEGOCIO</div>
          <div className="text-[18px] font-bold tabular-nums text-emerald-900">
            {formatCurrencyPEN(reinvertido)}
          </div>
          <div className="text-[10px] text-emerald-700">{pctReinvertido.toFixed(0)}% de la utilidad</div>
        </div>
        <div className="bg-rose-50/40 border border-rose-200 rounded-lg p-3">
          <div className="text-[10px] uppercase font-bold text-rose-700 mb-0.5">PAGADO A TC PERSONAL</div>
          <div className="text-[18px] font-bold tabular-nums text-rose-900">
            {formatCurrencyPEN(pagadoTC)}
          </div>
          <div className="text-[10px] text-rose-700">{pctPagadoTC.toFixed(0)}% liberando apalancamiento</div>
        </div>
        <div className="bg-amber-50/40 border border-amber-200 rounded-lg p-3">
          <div className="text-[10px] uppercase font-bold text-amber-700 mb-0.5">DISTRIBUIDO A SOCIOS</div>
          <div className="text-[18px] font-bold tabular-nums text-amber-900">
            {formatCurrencyPEN(retiradoUtilidades)}
          </div>
          <div className="text-[10px] text-amber-700">{pctDistribuido.toFixed(0)}% retiros</div>
        </div>
      </div>

      {/* §5.3 · Retiros de socios · tabla desktop, cards mobile */}
      {totalRetirado > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2">RETIROS DE SOCIOS · histórico</div>

          {/* Tabla desktop */}
          <table className="w-full text-[11px] hidden md:table">
            <thead>
              <tr className="text-[10px] text-slate-500">
                <th className="text-left py-1 font-semibold">Socio</th>
                <th className="text-left py-1 font-semibold">Retiros</th>
                <th className="text-left py-1 font-semibold">Último</th>
                <th className="text-right py-1 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.retirosPorSocio.map((r) => (
                <tr key={r.socioId}>
                  <td className="py-1.5 font-semibold">{r.socioNombre}</td>
                  <td className="py-1.5 text-slate-500">{r.cantidadRetiros} retiro{r.cantidadRetiros === 1 ? '' : 's'}</td>
                  <td className="py-1.5 text-slate-600">{formatFechaCorta(r.fechaUltimoRetiro)}</td>
                  <td className="py-1.5 text-right tabular-nums text-rose-700">
                    −{formatCurrencyPEN(r.totalRetiradoPEN)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Cards stack mobile */}
          <div className="md:hidden divide-y divide-slate-100">
            {data.retirosPorSocio.map((r) => (
              <div key={r.socioId} className="py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 text-[12px] truncate">{r.socioNombre}</div>
                  <div className="text-[10px] text-slate-500">
                    {r.cantidadRetiros} retiro{r.cantidadRetiros === 1 ? '' : 's'} · último {formatFechaCorta(r.fechaUltimoRetiro)}
                  </div>
                </div>
                <div className="tabular-nums text-rose-700 text-[13px] font-semibold flex-shrink-0">
                  −{formatCurrencyPEN(r.totalRetiradoPEN)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* §5.4 · Banner pedagógico · política de distribución */}
      <div className="mt-4 pt-3 border-t border-slate-100 bg-violet-50/30 -mx-4 sm:-mx-5 px-4 sm:px-5 py-2.5 text-[11px] text-violet-900 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-violet-700 mt-0.5 flex-shrink-0" />
        <div>
          <strong>Política de distribución:</strong> de cada S/100 ganados,{' '}
          <strong>S/{(pctReinvertido + pctPagadoTC).toFixed(0)} se reinvierten</strong> (negocio + pago TC) y{' '}
          <strong>S/{pctDistribuido.toFixed(0)} se distribuyen</strong>.{' '}
          {pctReinvertido + pctPagadoTC > 60
            ? 'Estás priorizando crecimiento sobre dividendos · típico en PyME en expansión.'
            : 'Estás equilibrando crecimiento y distribución.'}
        </div>
      </div>
    </div>
  );
}
