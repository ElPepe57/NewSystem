/**
 * PoolUSDWidget — chk5.D-S2 · SF2
 *
 * Widget Pool USD para sidebar persistente del módulo Finanzas.
 * Implementa D13 · Pool USD = vista agregada de N cuentas USD (no entidad propia).
 *
 * Consume:
 *   - poolUSDViewService.calcularTCPA() → TCPA único
 *   - poolUSDViewService.getSaldoUSD() → saldos por cuenta + total agregado
 *   - useTipoCambio() → TC mercado actual para calcular diferencial
 *
 * Diseño canon v8.0 + v9.0 M1 copy-paste literal del mockup MOCK 1
 * (docs/mockups/finanzas-shell-overview-v5.1.html · §2 sidebar Pool USD).
 *
 * Decisión D13 (chk5.D-S1e): Pool USD NO es entidad propia · es vista
 * derivada que agrega TODAS las cuentas USD físicas del sistema con TCPA único.
 */

import React, { useEffect, useState } from 'react';
import { DollarSign, ArrowRight, Loader2 } from 'lucide-react';
import { poolUSDViewService } from '../../../services/poolUSD.view.service';
import { useTipoCambio } from '../../../hooks/useTipoCambio';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface PoolUSDWidgetProps {
  /** Click footer · navega a histórico TCPA */
  onVerHistorial?: () => void;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

const fmt0 = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmt2 = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const PoolUSDWidget: React.FC<PoolUSDWidgetProps> = ({ onVerHistorial }) => {
  const { tc: tcSistema } = useTipoCambio();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tcpa, setTcpa] = useState<number>(0);
  const [totalUSD, setTotalUSD] = useState<number>(0);
  const [cuentas, setCuentas] = useState<Array<{ id: string; nombre: string; saldo: number }>>([]);

  useEffect(() => {
    let cancelled = false;
    const cargarPool = async () => {
      try {
        setLoading(true);
        setError(null);
        const [tcpaData, saldoData] = await Promise.all([
          poolUSDViewService.calcularTCPA(),
          poolUSDViewService.getSaldoUSD(),
        ]);
        if (cancelled) return;
        setTcpa(tcpaData.tcpa);
        setTotalUSD(saldoData.totalUSD);
        setCuentas(saldoData.cuentas);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message ?? 'Error cargando Pool USD');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void cargarPool();
    return () => {
      cancelled = true;
    };
  }, []);

  // TC mercado para diferencial (preferir venta · fallback compra)
  const tcMercado = tcSistema?.venta ?? tcSistema?.compra ?? 0;
  const diferencial = tcMercado > 0 && tcpa > 0 ? tcMercado - tcpa : 0;
  const equivalentePEN = totalUSD * tcpa;
  const gananciaPotencialPEN = diferencial * totalUSD;

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-teal-50 to-teal-100/40 ring-1 ring-teal-200/50 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Loader2 className="w-3.5 h-3.5 text-teal-700 animate-spin" />
          <span className="text-[10px] uppercase tracking-wider text-teal-700 font-bold">
            Pool USD · cargando
          </span>
        </div>
        <div className="h-6 bg-teal-100/50 rounded animate-pulse mb-2" />
        <div className="h-3 bg-teal-100/50 rounded animate-pulse w-3/4" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 ring-1 ring-rose-200/50 rounded-2xl p-4">
        <div className="text-[10px] uppercase tracking-wider text-rose-700 font-bold mb-1">
          Pool USD · error
        </div>
        <div className="text-[11px] text-rose-900">{error}</div>
      </div>
    );
  }

  // Mostrar count solo si > 0 · si == 0 indicar "sin cuentas USD"
  const sinCuentas = cuentas.length === 0;

  return (
    <div className="bg-gradient-to-br from-teal-50 to-teal-100/40 ring-1 ring-teal-200/50 rounded-2xl p-4">
      {/* Header con count */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5 text-teal-700" />
          <span className="text-[10px] uppercase tracking-wider font-bold text-teal-700">
            Pool USD · vista consolidada
          </span>
        </div>
        {!sinCuentas && (
          <span className="text-[9px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-bold">
            {cuentas.length} ctas
          </span>
        )}
      </div>

      {/* Total agregado */}
      <div className="text-xl font-bold tabular-nums text-teal-900">
        $ {fmt0(totalUSD)}
        <span className="text-teal-400">.{fmt2(totalUSD).split('.')[1] ?? '00'}</span>
      </div>

      {/* TCPA + equivalente PEN */}
      {tcpa > 0 && (
        <div className="text-[10px] text-teal-700 mt-1">
          TCPA único:{' '}
          <span className="font-bold tabular-nums">{tcpa.toFixed(3)}</span>
          {equivalentePEN > 0 && (
            <>
              {' · ≈ S/ '}
              <span className="font-bold tabular-nums">{fmt0(equivalentePEN)}</span>
            </>
          )}
        </div>
      )}

      {/* TC mercado + diferencial */}
      {tcMercado > 0 && tcpa > 0 && (
        <div className="text-[10px] text-teal-700">
          TC mercado hoy:{' '}
          <span className="font-bold tabular-nums">{tcMercado.toFixed(3)}</span>{' '}
          {diferencial > 0 ? (
            <span className="text-emerald-700 font-bold">
              ↑ ganancia +S/ {fmt0(gananciaPotencialPEN)}
            </span>
          ) : diferencial < 0 ? (
            <span className="text-rose-700 font-bold">
              ↓ pérdida −S/ {fmt0(Math.abs(gananciaPotencialPEN))}
            </span>
          ) : (
            <span className="text-slate-500">sin diferencial</span>
          )}
        </div>
      )}

      {/* Drill por cuenta · D13 vista agregada de N cuentas */}
      {cuentas.length > 0 && (
        <div className="mt-3 pt-3 border-t border-teal-200/50 space-y-1 text-[10px]">
          {cuentas.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between"
            >
              <span className="text-teal-700 truncate flex-1 min-w-0" title={c.nombre}>
                {c.nombre}
              </span>
              <span className="font-bold tabular-nums text-teal-900 flex-shrink-0">
                $ {fmt0(c.saldo)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state · sin cuentas USD configuradas */}
      {sinCuentas && (
        <div className="text-[10px] text-teal-700/70 italic mt-2">
          Sin cuentas USD configuradas · creá una en módulo Saldos para activar el Pool.
        </div>
      )}

      {/* Footer link · histórico TCPA */}
      {onVerHistorial && (
        <button
          type="button"
          onClick={onVerHistorial}
          className="text-[10px] text-teal-800 hover:underline mt-2 inline-flex items-center gap-1"
        >
          Ver historial TCPA
          <ArrowRight className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
};
