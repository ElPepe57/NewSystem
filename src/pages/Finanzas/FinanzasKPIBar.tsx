/**
 * FinanzasKPIBar — S57 Fase C+ · KPI strip compartido del hub Finanzas
 *
 * Mini-barra de KPIs visible en TODAS las sub-vistas (Overview, Saldos,
 * Cash flow). Refuerza visualmente que las 3 vistas son el mismo módulo
 * con distintas lentes — el dinero es el mismo, solo cambia el ángulo.
 *
 * 4 KPIs compactos en una row horizontal:
 *  1. Saldo en cuentas bancarias (PEN + USD)
 *  2. Por cobrar (CC entidades nos deben)
 *  3. Por pagar (CC nosotros debemos)
 *  4. Flujo del mes (ingresos − egresos PEN equivalente)
 *
 * Self-contained: hace su propio fetch al montarse, sin depender de
 * que la página hija haya cargado nada.
 */

import React, { useEffect, useState } from 'react';
import {
  Building2,
  ArrowDown,
  ArrowUp,
  TrendingUp,
} from 'lucide-react';
import { cuentaCorrienteService } from '../../services/cuentaCorriente.service';
import { getCuentas } from '../../services/tesoreria.cuentas.service';
import { getMovimientos } from '../../services/tesoreria.movimientos.service';
import { TIPOS_INGRESO, TIPOS_EGRESO } from '../../services/tesoreria.shared';
import type { CuentaCaja, MovimientoTesoreria } from '../../types/tesoreria.types';
import type { SaldosResumen } from '../../types/cuentaCorriente.types';

// ─── Helpers ───────────────────────────────────────────────────────────

function fmtK(n: number, moneda: 'PEN' | 'USD'): string {
  const sym = moneda === 'USD' ? 'US$' : 'S/';
  if (Math.abs(n) >= 1000) {
    return `${sym} ${(n / 1000).toLocaleString('es-PE', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}K`;
  }
  return `${sym} ${n.toLocaleString('es-PE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtSignedK(n: number, moneda: 'PEN' | 'USD'): string {
  const sym = moneda === 'USD' ? 'US$' : 'S/';
  const abs = Math.abs(n);
  const valor =
    abs >= 1000
      ? `${(abs / 1000).toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`
      : abs.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return `${n >= 0 ? '+' : '−'}${sym} ${valor}`;
}

// ─── Componente ────────────────────────────────────────────────────────

export const FinanzasKPIBar: React.FC = () => {
  const [resumenCC, setResumenCC] = useState<SaldosResumen | null>(null);
  const [cuentas, setCuentas] = useState<CuentaCaja[]>([]);
  const [movimientosMes, setMovimientosMes] = useState<MovimientoTesoreria[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    inicioMes.setHours(0, 0, 0, 0);

    Promise.all([
      cuentaCorrienteService.getResumen(),
      getCuentas(),
      getMovimientos({ fechaInicio: inicioMes }),
    ])
      .then(([r, cs, ms]) => {
        if (cancelled) return;
        setResumenCC(r);
        setCuentas(cs);
        setMovimientosMes(ms);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Derivar saldos ──
  const saldosCuentas = React.useMemo(() => {
    let pen = 0;
    let usd = 0;
    for (const c of cuentas) {
      if (!c.activa) continue;
      if (c.esBiMoneda) {
        pen += c.saldoPEN || 0;
        usd += c.saldoUSD || 0;
      } else if (c.moneda === 'PEN') pen += c.saldoActual || 0;
      else usd += c.saldoActual || 0;
    }
    return { pen, usd };
  }, [cuentas]);

  const flujoMes = React.useMemo(() => {
    let ingreso = 0;
    let egreso = 0;
    for (const m of movimientosMes) {
      if (m.estado === 'anulado') continue;
      const equiv = m.montoEquivalentePEN || 0;
      if (TIPOS_INGRESO.includes(m.tipo)) ingreso += equiv;
      else if (TIPOS_EGRESO.includes(m.tipo)) egreso += equiv;
    }
    return ingreso - egreso;
  }, [movimientosMes]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 animate-pulse h-14"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      {/* Saldo en cuentas (teal · color de marca Vita Skin) */}
      <div className="bg-gradient-to-br from-teal-50 to-white border border-teal-200 rounded-lg px-3 py-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Building2 className="w-3 h-3 text-teal-500" />
          <span className="text-[9px] uppercase tracking-wider text-teal-700 font-semibold">
            En cuentas
          </span>
        </div>
        <div className="text-sm font-bold text-teal-700 tabular-nums">
          {fmtK(saldosCuentas.pen, 'PEN')}
        </div>
        {saldosCuentas.usd > 0.01 && (
          <div className="text-[10px] text-teal-600 tabular-nums">
            + {fmtK(saldosCuentas.usd, 'USD')}
          </div>
        )}
      </div>

      {/* Por cobrar */}
      <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-lg px-3 py-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <ArrowDown className="w-3 h-3 text-emerald-500" />
          <span className="text-[9px] uppercase tracking-wider text-emerald-700 font-semibold">
            Por cobrar
          </span>
        </div>
        <div className="text-sm font-bold text-emerald-700 tabular-nums">
          {fmtK(resumenCC?.totalDebenAEmpresa.PEN ?? 0, 'PEN')}
        </div>
        {(resumenCC?.totalDebenAEmpresa.USD ?? 0) > 0.01 && (
          <div className="text-[10px] text-emerald-600 tabular-nums">
            + {fmtK(resumenCC!.totalDebenAEmpresa.USD, 'USD')}
          </div>
        )}
      </div>

      {/* Por pagar */}
      <div className="bg-gradient-to-br from-red-50 to-white border border-red-200 rounded-lg px-3 py-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <ArrowUp className="w-3 h-3 text-red-500" />
          <span className="text-[9px] uppercase tracking-wider text-red-700 font-semibold">
            Por pagar
          </span>
        </div>
        <div className="text-sm font-bold text-red-700 tabular-nums">
          {fmtK(resumenCC?.totalEmpresaDebe.PEN ?? 0, 'PEN')}
        </div>
        {(resumenCC?.totalEmpresaDebe.USD ?? 0) > 0.01 && (
          <div className="text-[10px] text-red-600 tabular-nums">
            + {fmtK(resumenCC!.totalEmpresaDebe.USD, 'USD')}
          </div>
        )}
      </div>

      {/* Flujo del mes (slate · neutral, dato compuesto) */}
      <div className="bg-gradient-to-br from-slate-100 to-white border border-slate-200 rounded-lg px-3 py-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <TrendingUp className="w-3 h-3 text-slate-500" />
          <span className="text-[9px] uppercase tracking-wider text-slate-700 font-semibold">
            Flujo mes
          </span>
        </div>
        <div className="text-sm font-bold text-slate-800 tabular-nums">
          {fmtSignedK(flujoMes, 'PEN')}
        </div>
        <div className="text-[10px] text-slate-600">
          {flujoMes >= 0 ? 'positivo' : 'negativo'}
        </div>
      </div>
    </div>
  );
};
