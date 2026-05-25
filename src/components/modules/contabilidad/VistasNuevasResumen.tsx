/**
 * VistasNuevasResumen · canon v5.2 chk5.E-C · Sprint C
 *
 * 3 vistas nuevas para el tab Resumen:
 * 1. PuntoEquilibrioCard (amber) · zona pérdida/ganancia + margen seguridad
 * 2. CapitalAtrapadoCard (blue) · líquido vs atrapado + barra proporción
 * 3. RentabilidadLineaCard (purple) · ranking por línea de negocio (placeholder · pendiente data)
 *
 * Pixel-perfect contra docs/mockups/contabilidad-vistas-nuevas-v5.2.html
 */

import React from 'react';
import {
  Target,
  ShieldCheck,
  Lock,
  Hourglass,
  Lightbulb,
  Info,
} from 'lucide-react';
import type {
  EstadoResultados,
  BalanceGeneral,
} from '../../../types/contabilidad.types';
import { formatCurrencyPEN } from '../../../utils/format';

const formatCurrency = (v: number): string => formatCurrencyPEN(v);

// ============================================================================
// 1. PUNTO DE EQUILIBRIO + MARGEN DE SEGURIDAD
// ============================================================================

interface PuntoEquilibrioProps {
  estado: EstadoResultados;
}

export const PuntoEquilibrioCard: React.FC<PuntoEquilibrioProps> = ({ estado }) => {
  const pe = estado.indicadores.puntoEquilibrioSoles;
  const peUds = estado.indicadores.puntoEquilibrioUnidades;
  const ventas = estado.ventasNetas;
  const margenSeg = estado.indicadores.margenSeguridad; // %

  // Si no hay PE calculable o ventas = 0 · empty state
  if (pe <= 0 || ventas <= 0) {
    return (
      <section className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-amber-50 to-amber-100/40 px-4 py-3 border-b border-amber-200/50">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-700" />
            <h3 className="text-[13px] font-bold text-amber-900">
              ¿Cuánto necesitás vender para no perder?
            </h3>
          </div>
        </div>
        <div className="p-4 text-center text-[11px] text-slate-500 italic">
          Sin datos suficientes para calcular el punto de equilibrio · necesita ventas + costos fijos del período
        </div>
      </section>
    );
  }

  // Pct de venta actual vs PE · cuánto está por encima/debajo
  const pctVentaVsPE = ventas > pe ? Math.min((pe / ventas) * 100, 100) : 100; // posición del marcador BE en la barra
  const pctVentaActual = ventas > 0 ? 100 : 0; // siempre al 100% si ventas > 0
  const sobrePE = ventas > pe;

  return (
    <section className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-amber-50 to-amber-100/40 px-4 py-3 border-b border-amber-200/50">
        <div className="flex items-center gap-2 flex-wrap">
          <Target className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <h3 className="text-[13px] font-bold text-amber-900">
            ¿Cuánto necesitás vender para no perder?
          </h3>
          <span
            className="inline-flex"
            title="Punto donde ventas = gastos totales · sin ganancia ni pérdida"
          >
            <Info className="w-3.5 h-3.5 text-amber-600 cursor-help" />
          </span>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between text-[11px] mb-3 flex-wrap gap-2">
          <div>
            <div className="text-[9px] uppercase font-bold text-amber-700">PUNTO DE EQUILIBRIO</div>
            <div className="text-[16px] font-bold tabular-nums text-amber-900">
              {formatCurrency(pe)}
            </div>
            <div className="text-[10px] text-slate-500">
              venta mínima del mes para cubrir TODOS los costos
            </div>
          </div>
          <div className="text-right">
            <div
              className={`text-[9px] uppercase font-bold ${sobrePE ? 'text-emerald-700' : 'text-rose-700'}`}
            >
              VENDISTE
            </div>
            <div
              className={`text-[16px] font-bold tabular-nums ${sobrePE ? 'text-emerald-700' : 'text-rose-700'}`}
            >
              {formatCurrency(ventas)}
            </div>
            <div className={`text-[10px] ${sobrePE ? 'text-emerald-700' : 'text-rose-700'}`}>
              {sobrePE
                ? `+${formatCurrency(ventas - pe)} por encima del equilibrio`
                : `${formatCurrency(pe - ventas)} por debajo · mes en pérdida`}
            </div>
          </div>
        </div>

        {/* Barra visual zona pérdida/ganancia */}
        <div className="relative h-10 bg-slate-100 rounded-lg overflow-hidden">
          {/* Zona pérdida (0 hasta breakeven) */}
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-rose-200/50 to-amber-200/50"
            style={{ width: `${pctVentaVsPE}%` }}
          />
          {/* Zona ganancia (breakeven hasta venta actual) */}
          {sobrePE && (
            <div
              className="absolute top-0 h-full bg-gradient-to-r from-emerald-300/60 to-emerald-400/70"
              style={{ left: `${pctVentaVsPE}%`, width: `${100 - pctVentaVsPE}%` }}
            />
          )}
          {/* Marcador breakeven */}
          <div
            className="absolute top-0 h-full w-0.5 bg-amber-700"
            style={{ left: `${pctVentaVsPE}%` }}
          />
        </div>

        {/* Margen de seguridad destacado · solo si sobrePE */}
        {sobrePE && margenSeg > 0 && (
          <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-lg p-2.5 mt-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <div>
                <div className="text-[11px] font-bold text-emerald-900">
                  Margen Seguridad: {margenSeg.toFixed(1)}%
                </div>
                <div className="text-[9px] text-emerald-700">
                  Ventas pueden caer hasta {margenSeg.toFixed(0)}% sin pérdida
                </div>
              </div>
            </div>
            {peUds > 0 && (
              <div className="text-[12px] font-bold tabular-nums text-emerald-900">
                ~{peUds.toLocaleString('es-PE')} uds
              </div>
            )}
          </div>
        )}

        {/* Insight rápido */}
        <div className="text-[10px] text-slate-600 bg-slate-50 rounded p-2 flex items-start gap-2 mt-3">
          <Lightbulb className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Lectura rápida:</strong>{' '}
            {sobrePE
              ? `tu zona segura es ${margenSeg.toFixed(0)}%. Aunque las ventas cayeran ${margenSeg.toFixed(0)}%, seguirías sin perder plata.`
              : 'estás vendiendo por debajo del punto de equilibrio · cada mes con esta cifra implica pérdida.'}
          </div>
        </div>
      </div>
    </section>
  );
};

// ============================================================================
// 2. CAPITAL ATRAPADO vs CAPITAL LÍQUIDO
// ============================================================================

interface CapitalProps {
  balance: BalanceGeneral;
}

export const CapitalAtrapadoCard: React.FC<CapitalProps> = ({ balance }) => {
  const efectivo = balance.activos.corriente.efectivo.total;
  const cxc = balance.activos.corriente.cuentasPorCobrar.neto;
  const inventarios = balance.activos.corriente.inventarios.totalValorPEN;
  const noCorr = balance.activos.noCorriente.total;
  const totalAct = balance.activos.totalActivos;

  // Capital líquido · efectivo en bancos/caja/digitales
  const liquido = efectivo;
  // Capital atrapado · CxC + inventarios + activos fijos
  const atrapado = cxc + inventarios + noCorr;

  if (totalAct <= 0) {
    return (
      <section className="bg-white border border-blue-200 rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100/40 px-4 py-3 border-b border-blue-200/50">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-700" />
            <h3 className="text-[13px] font-bold text-blue-900">
              ¿Cuánto está disponible vs atrapado?
            </h3>
          </div>
        </div>
        <div className="p-4 text-center text-[11px] text-slate-500 italic">
          Sin activos registrados para evaluar la composición de capital.
        </div>
      </section>
    );
  }

  const pctLiquido = (liquido / totalAct) * 100;
  const pctAtrapado = (atrapado / totalAct) * 100;

  // Days estimados de inventario (aprox)
  const cogs = balance.activos.corriente.inventarios.totalValorPEN > 0
    ? balance.activos.corriente.inventarios.totalValorPEN
    : 0;
  // Fórmula simplificada · usar diasInventario del estado si está disponible
  // Sin servicio aquí · placeholder usa "~estimado"

  return (
    <section className="bg-white border border-blue-200 rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 to-blue-100/40 px-4 py-3 border-b border-blue-200/50">
        <div className="flex items-center gap-2 flex-wrap">
          <Lock className="w-4 h-4 text-blue-700 flex-shrink-0" />
          <h3 className="text-[13px] font-bold text-blue-900">
            ¿Cuánto está disponible vs atrapado?
          </h3>
          <span className="inline-flex" title="Capital líquido = puede usarse ya · atrapado = requiere tiempo">
            <Info className="w-3.5 h-3.5 text-blue-600 cursor-help" />
          </span>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2">
          {/* LÍQUIDO */}
          <div className="bg-emerald-50/40 border border-emerald-200 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-emerald-700 mb-1">DISPONIBLE</div>
            <div className="text-[18px] font-bold tabular-nums text-emerald-900">
              {formatCurrency(liquido)}
            </div>
            <div className="text-[10px] text-emerald-700">
              {pctLiquido.toFixed(0)}% · usable inmediato
            </div>
          </div>

          {/* ATRAPADO */}
          <div className="bg-amber-50/40 border border-amber-200 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-amber-700 mb-1">ATRAPADO</div>
            <div className="text-[18px] font-bold tabular-nums text-amber-900">
              {formatCurrency(atrapado)}
            </div>
            <div className="text-[10px] text-amber-700">
              {pctAtrapado.toFixed(0)}% · convertible con tiempo
            </div>
          </div>
        </div>

        {/* Desglose */}
        {(cxc > 0 || inventarios > 0 || noCorr > 0) && (
          <div className="mt-3 text-[10px] text-slate-600 space-y-0.5">
            {efectivo > 0 && (
              <div className="flex justify-between">
                <span>· Efectivo + bancos</span>
                <span className="tabular-nums font-semibold">{formatCurrency(efectivo)}</span>
              </div>
            )}
            {cxc > 0 && (
              <div className="flex justify-between">
                <span>· CxC clientes</span>
                <span className="tabular-nums font-semibold">{formatCurrency(cxc)}</span>
              </div>
            )}
            {inventarios > 0 && (
              <div className="flex justify-between">
                <span>· Inventarios</span>
                <span className="tabular-nums font-semibold">{formatCurrency(inventarios)}</span>
              </div>
            )}
            {noCorr > 0 && (
              <div className="flex justify-between">
                <span>· Activo no corriente</span>
                <span className="tabular-nums font-semibold">{formatCurrency(noCorr)}</span>
              </div>
            )}
          </div>
        )}

        {/* Barra proporción */}
        <div className="mt-3">
          <div className="h-6 rounded-lg overflow-hidden flex bg-slate-100">
            {pctLiquido > 0 && (
              <div
                className="bg-emerald-500 flex items-center justify-center text-[9px] font-bold text-white"
                style={{ width: `${pctLiquido}%` }}
              >
                {pctLiquido >= 8 && `${pctLiquido.toFixed(0)}%`}
              </div>
            )}
            {pctAtrapado > 0 && (
              <div
                className="bg-amber-500 flex items-center justify-center text-[9px] font-bold text-white"
                style={{ width: `${pctAtrapado}%` }}
              >
                {pctAtrapado >= 8 && `${pctAtrapado.toFixed(0)}%`}
              </div>
            )}
          </div>
          <div className="text-[9px] text-slate-500 mt-1.5 flex items-start gap-1">
            <Hourglass className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" />
            <span>
              {pctAtrapado > 60
                ? `${pctAtrapado.toFixed(0)}% atrapado · normal retail · pero vigilar que no crezca`
                : pctLiquido > 50
                  ? 'mayoría del capital disponible · buena liquidez'
                  : 'mix balanceado entre líquido y operativo'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
