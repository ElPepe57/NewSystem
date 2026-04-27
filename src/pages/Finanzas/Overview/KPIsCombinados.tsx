/**
 * KPIsCombinados — S57 Fase C · 4 KPIs ejecutivos del Overview
 *
 * Combina datos de:
 *  - Tesorería (saldo en cuentas bancarias)
 *  - Cuentas Corrientes (por cobrar / por pagar)
 *  - Movimientos de tesorería del mes (flujo neto)
 *
 * Diseño: 4 cards gradient, una por KPI. Layout 2col mobile / 4col desktop.
 */

import React from 'react';
import {
  Building2,
  ArrowDown,
  ArrowUp,
  TrendingUp,
} from 'lucide-react';
import type { CuentaCaja, MovimientoTesoreria } from '../../../types/tesoreria.types';
import type { SaldosResumen } from '../../../types/cuentaCorriente.types';
import {
  TIPOS_INGRESO,
  TIPOS_EGRESO,
} from '../../../services/tesoreria.shared';

interface KPIsCombinadosProps {
  cuentas: CuentaCaja[];
  movimientosUltimos90d: MovimientoTesoreria[];
  resumenCC: SaldosResumen | null;
  conteosCC: {
    porCobrar: number;
    porPagar: number;
    vencidas: number;
  };
  loading?: boolean;
}

function fmt(n: number, moneda: 'PEN' | 'USD'): string {
  const sym = moneda === 'USD' ? 'US$' : 'S/';
  return `${sym} ${n.toLocaleString('es-PE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtSigned(n: number, moneda: 'PEN' | 'USD'): string {
  const sym = moneda === 'USD' ? 'US$' : 'S/';
  const abs = Math.abs(n).toLocaleString('es-PE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${n >= 0 ? '+' : '−'}${sym} ${abs}`;
}

export const KPIsCombinados: React.FC<KPIsCombinadosProps> = ({
  cuentas,
  movimientosUltimos90d,
  resumenCC,
  conteosCC,
  loading,
}) => {
  // ── Saldo en cuentas bancarias (Tesorería) ──
  const saldosCuentas = React.useMemo(() => {
    let pen = 0;
    let usd = 0;
    let activas = 0;
    for (const c of cuentas) {
      if (!c.activa) continue;
      activas++;
      if (c.esBiMoneda) {
        pen += c.saldoPEN || 0;
        usd += c.saldoUSD || 0;
      } else if (c.moneda === 'PEN') {
        pen += c.saldoActual || 0;
      } else {
        usd += c.saldoActual || 0;
      }
    }
    return { pen, usd, activas };
  }, [cuentas]);

  // ── Flujo del mes actual (PEN equivalente) ──
  const flujoMesActual = React.useMemo(() => {
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();
    const mesAnterior = mesActual === 0 ? 11 : mesActual - 1;
    const anioMesAnterior = mesActual === 0 ? anioActual - 1 : anioActual;

    let ingresoActual = 0;
    let egresoActual = 0;
    let ingresoAnterior = 0;
    let egresoAnterior = 0;

    for (const m of movimientosUltimos90d) {
      if (m.estado === 'anulado') continue;
      const fecha = m.fecha.toDate();
      const mes = fecha.getMonth();
      const anio = fecha.getFullYear();

      const enMesActual = mes === mesActual && anio === anioActual;
      const enMesAnterior = mes === mesAnterior && anio === anioMesAnterior;
      if (!enMesActual && !enMesAnterior) continue;

      // Equivalente en PEN siempre disponible
      const equivPEN = m.montoEquivalentePEN || 0;
      if (TIPOS_INGRESO.includes(m.tipo)) {
        if (enMesActual) ingresoActual += equivPEN;
        else ingresoAnterior += equivPEN;
      } else if (TIPOS_EGRESO.includes(m.tipo)) {
        if (enMesActual) egresoActual += equivPEN;
        else egresoAnterior += equivPEN;
      }
    }

    const flujoActual = ingresoActual - egresoActual;
    const flujoAnterior = ingresoAnterior - egresoAnterior;
    const variacionPct =
      flujoAnterior !== 0
        ? Math.round(((flujoActual - flujoAnterior) / Math.abs(flujoAnterior)) * 100)
        : null;

    return {
      ingreso: ingresoActual,
      egreso: egresoActual,
      neto: flujoActual,
      anterior: flujoAnterior,
      variacionPct,
    };
  }, [movimientosUltimos90d]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-slate-50 border border-slate-200 rounded-xl p-4 animate-pulse h-28"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Saldo en cuentas bancarias (teal · color de marca Vita Skin) */}
      <div className="bg-gradient-to-br from-teal-50 to-white border border-teal-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-teal-700 font-semibold">
            Saldo en cuentas
          </span>
          <Building2 className="w-3.5 h-3.5 text-teal-500" />
        </div>
        <div className="text-2xl font-bold text-teal-700 tabular-nums">
          {fmt(saldosCuentas.pen, 'PEN')}
        </div>
        {saldosCuentas.usd > 0 && (
          <div className="text-xs text-teal-600 tabular-nums mt-0.5">
            + {fmt(saldosCuentas.usd, 'USD')}
          </div>
        )}
        <div className="text-[10px] text-teal-700/70 mt-2">
          {saldosCuentas.activas} cuenta{saldosCuentas.activas !== 1 ? 's' : ''} activa
          {saldosCuentas.activas !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Por cobrar (emerald) */}
      <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">
            Por cobrar
          </span>
          <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold text-emerald-700 tabular-nums">
          {fmt(resumenCC?.totalDebenAEmpresa.PEN ?? 0, 'PEN')}
        </div>
        {(resumenCC?.totalDebenAEmpresa.USD ?? 0) > 0 && (
          <div className="text-xs text-emerald-600 tabular-nums mt-0.5">
            + {fmt(resumenCC!.totalDebenAEmpresa.USD, 'USD')}
          </div>
        )}
        <div className="text-[10px] text-emerald-700/70 mt-2">
          {conteosCC.porCobrar} entidad{conteosCC.porCobrar !== 1 ? 'es' : ''}
        </div>
      </div>

      {/* Por pagar (red) */}
      <div className="bg-gradient-to-br from-red-50 to-white border border-red-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-red-700 font-semibold">
            Por pagar
          </span>
          <ArrowUp className="w-3.5 h-3.5 text-red-500" />
        </div>
        <div className="text-2xl font-bold text-red-700 tabular-nums">
          {fmt(resumenCC?.totalEmpresaDebe.PEN ?? 0, 'PEN')}
        </div>
        {(resumenCC?.totalEmpresaDebe.USD ?? 0) > 0 && (
          <div className="text-xs text-red-600 tabular-nums mt-0.5">
            + {fmt(resumenCC!.totalEmpresaDebe.USD, 'USD')}
          </div>
        )}
        <div className="text-[10px] text-red-700/70 mt-2">
          {conteosCC.porPagar} entidad{conteosCC.porPagar !== 1 ? 'es' : ''}
          {conteosCC.vencidas > 0 && ` · ${conteosCC.vencidas} vencidas`}
        </div>
      </div>

      {/* Flujo este mes (slate · neutral, dato compuesto sin signo único) */}
      <div className="bg-gradient-to-br from-slate-100 to-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-700 font-semibold">
            Flujo este mes
          </span>
          <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
        </div>
        <div className="text-2xl font-bold text-slate-800 tabular-nums">
          {fmtSigned(flujoMesActual.neto, 'PEN')}
        </div>
        {flujoMesActual.anterior !== 0 && (
          <div className="text-xs text-slate-600 tabular-nums mt-0.5">
            vs {fmtSigned(flujoMesActual.anterior, 'PEN')} mes ant.
          </div>
        )}
        <div className="text-[10px] text-slate-600 mt-2">
          {flujoMesActual.variacionPct !== null
            ? `${flujoMesActual.variacionPct >= 0 ? '↑' : '↓'} ${Math.abs(flujoMesActual.variacionPct)}% · ${flujoMesActual.neto >= 0 ? 'positivo' : 'negativo'}`
            : flujoMesActual.neto >= 0
              ? 'Mes en positivo'
              : 'Mes en negativo'}
        </div>
      </div>
    </div>
  );
};
