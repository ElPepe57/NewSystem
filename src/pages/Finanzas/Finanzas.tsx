/**
 * Finanzas — chk5.D-S2 · SF5 · Overview pixel-perfect canon MOCK 1
 *
 * Refactor pixel-perfect contra `docs/mockups/finanzas-shell-overview-v5.1.html`
 * §2 cuerpo Overview default · canon v8.0+v9.0 (M1 copy-paste literal).
 *
 * Estructura:
 *   Grid md:grid-cols-4 · main (3 cols) + sidebar persistente (1 col)
 *
 * MAIN:
 *   1. Banner Caja Recaudadora (purple) · visible si hay saldo pendiente · N8
 *   2. Pipeline Cash Flow visual · 5 stages con flechas · N1+N2
 *   3. Grid 4 cards de acceso rápido (Saldos · Movimientos hoy · CC · Cash flow 30d)
 *
 * SIDEBAR (persistente desde md:768px · N7):
 *   1. Acciones urgentes
 *   2. Top entidades · mes
 *   3. Pool USD widget (D13 vista agregada) · usa PoolUSDWidget SF2
 *   4. TC ciclo cerrado
 *   5. Cajas recaudadoras pendientes
 *
 * Reutiliza data del shell via `useFinanzasShellContext` · sin refetch (perf).
 * Drawer detalle canon (DrawerCCEntidadCanonico) + wizard pago canon (PagoAbonoWizard).
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  ArrowRightLeft,
  GitCommitHorizontal,
  Wallet,
  ArrowDown,
  ArrowUp,
  Users,
  TrendingUp,
  ArrowRight,
  AlertOctagon,
  AlertCircle,
  CreditCard,
} from 'lucide-react';
import { cuentaCorrienteService } from '../../services/cuentaCorriente.service';
import { getCuentas } from '../../services/tesoreria.cuentas.service';
import { getMovimientos } from '../../services/tesoreria.movimientos.service';
import { TIPOS_INGRESO, TIPOS_EGRESO } from '../../services/tesoreria.shared';
import type { CuentaCorriente } from '../../types/cuentaCorriente.types';

import { PoolUSDWidget } from './components/PoolUSDWidget';
import { DrawerCCEntidadCanonico } from './components/cc/DrawerCCEntidadCanonico';
import { PagoAbonoWizard } from './components/PagoAbonoWizard';
import { useFinanzasShellContext } from './FinanzasLayout';

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

const fmt0 = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtSigned = (n: number) =>
  `${n >= 0 ? '+' : '−'}S/ ${fmt0(Math.abs(n))}`;

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

const Finanzas: React.FC = () => {
  const navigate = useNavigate();
  const { kpiData, miniStats, cuentas, resumenCC, movimientosMes, loading, onSeleccionarAccion } =
    useFinanzasShellContext();

  // ─── Fetch local · data específica del Overview (no en shell) ─────────
  const [ccs, setCCs] = useState<CuentaCorriente[]>([]);
  const [movimientosHoy, setMovimientosHoy] = useState<{ ingresos: number; egresos: number; count: number }>({
    ingresos: 0,
    egresos: 0,
    count: 0,
  });
  const [loadingExtra, setLoadingExtra] = useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoadingExtra(true);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    Promise.all([cuentaCorrienteService.getAll(), getCuentas(), getMovimientos({ fechaInicio: hoy })])
      .then(([listaCC, _, movsHoy]) => {
        if (cancelled) return;
        setCCs(listaCC);

        let ingresos = 0;
        let egresos = 0;
        let count = 0;
        for (const m of movsHoy) {
          if (m.estado === 'anulado') continue;
          count++;
          const equiv = m.montoEquivalentePEN || 0;
          if (TIPOS_INGRESO.includes(m.tipo)) ingresos += equiv;
          else if (TIPOS_EGRESO.includes(m.tipo)) egresos += equiv;
        }
        setMovimientosHoy({ ingresos, egresos, count });
      })
      .finally(() => {
        if (!cancelled) setLoadingExtra(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Saldos consolidados PEN/USD ──────────────────────────────────────
  const saldosConsolidados = useMemo(() => {
    let pen = 0;
    let usd = 0;
    let activas = 0;
    for (const c of cuentas) {
      if (!c.activa) continue;
      activas++;
      if (c.esBiMoneda) {
        pen += c.saldoPEN || 0;
        usd += c.saldoUSD || 0;
      } else if (c.moneda === 'PEN') pen += c.saldoActual || 0;
      else usd += c.saldoActual || 0;
    }
    return { pen, usd, activas };
  }, [cuentas]);

  // ─── Conteo de CC por tipo ────────────────────────────────────────────
  const conteosCC = useMemo(() => {
    let clientes = 0;
    let proveedores = 0;
    let colaboradores = 0;
    let empleados = 0;
    let total = 0;
    for (const cc of ccs) {
      const tienePEN = Math.abs(cc.saldoPEN) > 0.01;
      const tieneUSD = Math.abs(cc.saldoUSD) > 0.01;
      if (!tienePEN && !tieneUSD) continue;
      total++;
      switch (cc.tipo) {
        case 'cliente':
          clientes++;
          break;
        case 'proveedor':
          proveedores++;
          break;
        case 'colaborador':
          colaboradores++;
          break;
        case 'empleado':
          empleados++;
          break;
      }
    }
    return { clientes, proveedores, colaboradores, empleados, total };
  }, [ccs]);

  // ─── Top entidades del mes ────────────────────────────────────────────
  const topEntidades = useMemo(() => {
    const ordenadas = [...ccs]
      .filter((cc) => Math.abs(cc.saldoPEN) > 0.01 || Math.abs(cc.saldoUSD) > 0.01)
      .sort((a, b) => Math.abs(b.saldoPEN) + Math.abs(b.saldoUSD) - (Math.abs(a.saldoPEN) + Math.abs(a.saldoUSD)));
    return ordenadas.slice(0, 4);
  }, [ccs]);

  // ─── Pipeline Cash Flow data (5 stages) ───────────────────────────────
  const pipelineStages = useMemo(() => {
    const pendientes = kpiData?.porCobrarPEN ?? 0;
    const enCuenta = saldosConsolidados.pen;
    const reservado = miniStats?.tcCicloCerradoPEN ?? 0;
    const enPago = kpiData?.porPagarPEN ?? 0;
    const ejecutado = movimientosMes.reduce((acc, m) => {
      if (m.estado === 'anulado') return acc;
      if (TIPOS_EGRESO.includes(m.tipo)) return acc + (m.montoEquivalentePEN || 0);
      return acc;
    }, 0);

    const total = pendientes + enCuenta + reservado + enPago + ejecutado;
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

    return [
      { label: 'Pendientes', value: pendientes, color: 'rose' as const, sub: 'facturas CxC', pct: pct(pendientes) },
      { label: 'En cuenta', value: enCuenta, color: 'teal' as const, sub: 'disponible inmediato', pct: pct(enCuenta) },
      { label: 'Reservado', value: reservado, color: 'amber' as const, sub: 'TC ciclo cerrado', pct: pct(reservado) },
      { label: 'En pago', value: enPago, color: 'indigo' as const, sub: 'OC + nómina próx', pct: pct(enPago) },
      { label: 'Ejecutado', value: ejecutado, color: 'emerald' as const, sub: 'cerrado mes', pct: pct(ejecutado) },
    ];
  }, [kpiData, miniStats, saldosConsolidados.pen, movimientosMes]);

  // ─── Modales legacy preservados ───────────────────────────────────────
  const [ccSeleccionada, setCCSeleccionada] = useState<CuentaCorriente | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardEntidad, setWizardEntidad] = useState<{
    entidadId: string;
    entidadTipo: CuentaCorriente['tipo'];
    entidadNombre: string;
    saldoUSD: number;
    saldoPEN: number;
  } | null>(null);

  const abrirWizard = React.useCallback((cc?: CuentaCorriente) => {
    setWizardEntidad(
      cc
        ? {
            entidadId: cc.entidadId,
            entidadTipo: cc.tipo,
            entidadNombre: cc.entidadNombre,
            saldoUSD: cc.saldoUSD,
            saldoPEN: cc.saldoPEN,
          }
        : null,
    );
    setWizardOpen(true);
  }, []);

  const recaudadoraPendiente = miniStats?.recaudadoraPendientePEN ?? 0;
  const hayLoading = loading || loadingExtra;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6">
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* MAIN · 3 cols                                                    */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="md:col-span-3 space-y-4">
          {/* §1 · BANNER CAJA RECAUDADORA (N8 · siempre visible si > 0) */}
          {recaudadoraPendiente > 0 && (
            <div className="bg-gradient-to-r from-purple-50 to-purple-100/30 ring-1 ring-purple-200/50 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3 flex-1 min-w-[260px]">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white ring-2 ring-purple-200 flex-shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-purple-900">
                    Saldo pendiente de liquidar
                  </div>
                  <div className="text-[11px] text-purple-700 mt-0.5">
                    Cajas recaudadoras con saldo neto pendiente de transferir a cuenta bancaria.
                    Total:{' '}
                    <span className="font-bold tabular-nums">S/ {fmt0(recaudadoraPendiente)}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSeleccionarAccion('liquidar_recaudadora')}
                className="text-[11px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg flex items-center gap-1.5 flex-shrink-0 transition-colors"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" /> Liquidar
              </button>
            </div>
          )}

          {/* §2 · PIPELINE CASH FLOW VISUAL · 5 stages con flechas */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
                  <GitCommitHorizontal className="w-4 h-4 text-teal-600" />
                  Pipeline Cash Flow · dinero en tránsito
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  5 stages · visualiza dónde está cada sol del negocio hoy
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/finanzas/cash-flow')}
                className="text-[10px] text-teal-700 hover:underline"
              >
                Ver detalle →
              </button>
            </div>
            {/* chk5.D-S8.SF3.D7 · pipeline overflow fix integral:
                  Grid responsive en vez de flex con min-width fijo. La grid se
                  adapta al ancho disponible y wrapea graceful sin desbordar:
                    - 2 cols en mobile (< 640px)
                    - 3 cols en sm-md  (640-1023px)
                    - 5 cols en lg+    (≥ 1024px) sólo si hay espacio · si no, vuelve a 3
                  El sidebar derecho (Chat) achica la columna útil; con grid las
                  cards se redimensionan en lugar de salirse del encuadre. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 pt-2 [&>*:nth-child(5)]:col-span-2 sm:[&>*:nth-child(5)]:col-span-1">
              {pipelineStages.map((stage, idx) => (
                <PipelineStage
                  key={stage.label}
                  label={stage.label}
                  value={stage.value}
                  subtitle={stage.sub}
                  pct={stage.pct}
                  color={stage.color}
                  hasArrow={idx < pipelineStages.length - 1}
                />
              ))}
            </div>
          </div>

          {/* §3 · GRID 4 CARDS de acceso rápido */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Saldos summary · emerald */}
            <button
              type="button"
              onClick={() => navigate('/finanzas/saldos')}
              className="text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                    Saldos consolidados
                  </div>
                  <div className="text-[15px] font-bold text-slate-900">
                    {saldosConsolidados.activas} cuentas activas
                  </div>
                </div>
                <Wallet className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-emerald-50 rounded-lg p-2">
                  <div className="text-emerald-700 text-[9px] uppercase font-bold">PEN</div>
                  <div className="font-bold tabular-nums text-emerald-900">
                    S/ {fmt0(saldosConsolidados.pen)}
                  </div>
                </div>
                <div className="bg-teal-50 rounded-lg p-2">
                  <div className="text-teal-700 text-[9px] uppercase font-bold">
                    USD Pool{' '}
                    {miniStats && miniStats.poolUSDCuentasCount > 0 && (
                      <>({miniStats.poolUSDCuentasCount} ctas)</>
                    )}
                  </div>
                  <div className="font-bold tabular-nums text-teal-900">
                    $ {fmt0(saldosConsolidados.usd)}
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-emerald-700 hover:underline mt-2 inline-flex items-center gap-1">
                Ver todas <ArrowRight className="w-2.5 h-2.5" />
              </span>
            </button>

            {/* Movimientos hoy · slate · cross-link a /finanzas/movimientos (S3.SF5 cerró DEUDA-CROSS-LINKS B) */}
            <button
              type="button"
              onClick={() => navigate('/finanzas/movimientos')}
              className="text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-400 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                    Movimientos hoy
                  </div>
                  <div className="text-[15px] font-bold text-slate-900">
                    {movimientosHoy.count} transacciones
                  </div>
                </div>
                <ArrowRightLeft className="w-4 h-4 text-slate-600" />
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-700 flex items-center gap-1">
                    <ArrowDown className="w-3 h-3" /> ingresos
                  </span>
                  <span className="font-bold tabular-nums text-emerald-700">
                    +S/ {fmt0(movimientosHoy.ingresos)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-rose-700 flex items-center gap-1">
                    <ArrowUp className="w-3 h-3" /> egresos
                  </span>
                  <span className="font-bold tabular-nums text-rose-700">
                    −S/ {fmt0(movimientosHoy.egresos)}
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-teal-700 hover:underline mt-2 inline-flex items-center gap-1">
                Ver ledger <ArrowRight className="w-2.5 h-2.5" />
              </span>
            </button>

            {/* CC entidades · indigo */}
            <button
              type="button"
              onClick={() => navigate('/finanzas/saldos')}
              className="text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                    CC con entidades
                  </div>
                  <div className="text-[15px] font-bold text-slate-900">
                    {conteosCC.total} abiertas
                  </div>
                </div>
                <Users className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex gap-1 text-[10px] flex-wrap">
                {conteosCC.clientes > 0 && (
                  <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">
                    {conteosCC.clientes} clientes
                  </span>
                )}
                {conteosCC.proveedores > 0 && (
                  <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full font-bold">
                    {conteosCC.proveedores} proveedores
                  </span>
                )}
                {conteosCC.colaboradores > 0 && (
                  <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">
                    {conteosCC.colaboradores} colaboradores
                  </span>
                )}
                {conteosCC.empleados > 0 && (
                  <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">
                    {conteosCC.empleados} empleados
                  </span>
                )}
                {conteosCC.total === 0 && !hayLoading && (
                  <span className="text-slate-400 italic">Sin CC abiertas</span>
                )}
              </div>
              <span className="text-[10px] text-indigo-700 hover:underline mt-2 inline-flex items-center gap-1">
                Ver CC <ArrowRight className="w-2.5 h-2.5" />
              </span>
            </button>

            {/* Cash flow projection · amber */}
            <button
              type="button"
              onClick={() => navigate('/finanzas/cash-flow')}
              className="text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                    Cash flow 30d
                  </div>
                  <div className="text-[15px] font-bold text-slate-900">
                    Proyectado: {fmtSigned(kpiData?.flujoNetoMesPEN ?? 0)}
                  </div>
                </div>
                <TrendingUp className="w-4 h-4 text-amber-600" />
              </div>
              <svg viewBox="0 0 120 30" className="w-full h-8">
                <polyline
                  points="0,22 12,18 24,20 36,15 48,12 60,14 72,10 84,8 96,5 108,3 120,2"
                  fill="none"
                  stroke="#d97706"
                  strokeWidth="1.5"
                />
                <polyline
                  points="0,28 12,28 24,26 36,24 48,22 60,20 72,18 84,17 96,15 108,14 120,12"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1.5"
                />
              </svg>
              <span className="text-[10px] text-amber-700 hover:underline mt-1 inline-flex items-center gap-1">
                Ver proyección <ArrowRight className="w-2.5 h-2.5" />
              </span>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SIDEBAR · 1 col · persistente desde md:768px (N7)                */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <aside className="md:col-span-1 space-y-3">
          {/* §S1 · Acciones urgentes */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-700">
                Acciones urgentes
              </span>
            </div>
            <div className="space-y-2 text-[11px]">
              {/* TODO chk5.D-S3 · alimentar desde service real (CxP vencen 7d · TC vence · liquidar) */}
              {(kpiData?.porPagarVencen7dCount ?? 0) > 0 ? (
                <div className="flex items-start gap-2 p-2 bg-rose-50 rounded-lg ring-1 ring-rose-200/50">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-700 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-rose-900 truncate">
                      {kpiData!.porPagarVencen7dCount} CxP vencen ≤7d
                    </div>
                    <div className="text-[10px] text-rose-700 truncate">
                      Total: S/ {fmt0(kpiData!.porPagarPEN)}
                    </div>
                  </div>
                </div>
              ) : null}
              {(miniStats?.tcCicloCerradoPEN ?? 0) > 0 && (
                <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg ring-1 ring-amber-200/50">
                  <CreditCard className="w-3.5 h-3.5 text-amber-700 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-amber-900 truncate">TC ciclo cerrado</div>
                    <div className="text-[10px] text-amber-700 truncate">
                      S/ {fmt0(miniStats!.tcCicloCerradoPEN)} bimoneda
                    </div>
                  </div>
                </div>
              )}
              {recaudadoraPendiente > 0 && (
                <div className="flex items-start gap-2 p-2 bg-purple-50 rounded-lg ring-1 ring-purple-200/50">
                  <Truck className="w-3.5 h-3.5 text-purple-700 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-purple-900 truncate">
                      Liquidar recaudadora
                    </div>
                    <div className="text-[10px] text-purple-700 truncate">
                      S/ {fmt0(recaudadoraPendiente)} pendiente
                    </div>
                  </div>
                </div>
              )}
              {!hayLoading &&
                (kpiData?.porPagarVencen7dCount ?? 0) === 0 &&
                (miniStats?.tcCicloCerradoPEN ?? 0) === 0 &&
                recaudadoraPendiente === 0 && (
                  <div className="text-[10px] text-slate-400 italic text-center py-2">
                    Sin acciones urgentes
                  </div>
                )}
            </div>
          </div>

          {/* §S2 · Top entidades del mes */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-700">
                Top entidades · mes
              </span>
            </div>
            <div className="space-y-1.5 text-[11px]">
              {topEntidades.length === 0 && !hayLoading && (
                <div className="text-[10px] text-slate-400 italic text-center py-2">
                  Sin entidades con saldo
                </div>
              )}
              {topEntidades.map((cc) => {
                const total = Math.abs(cc.saldoPEN) + Math.abs(cc.saldoUSD);
                const esCobro = cc.saldoPEN > 0.01 || cc.saldoUSD > 0.01;
                return (
                  <button
                    key={cc.id}
                    type="button"
                    onClick={() => setCCSeleccionada(cc)}
                    className="w-full flex items-center justify-between text-left hover:bg-slate-50 rounded px-1 py-0.5 transition-colors"
                  >
                    <span
                      className={`truncate flex-1 min-w-0 ${
                        esCobro ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {esCobro ? '▶' : '◀'} {cc.entidadNombre}
                    </span>
                    <span
                      className={`font-bold tabular-nums flex-shrink-0 ${
                        esCobro ? 'text-emerald-900' : 'text-rose-900'
                      }`}
                    >
                      S/ {fmt0(total)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* §S3 · Pool USD widget (D13 · vista agregada · SF2) */}
          <PoolUSDWidget
            onVerHistorial={() => navigate('/rendimiento-cambiario')}
          />

          {/* §S4 · TC ciclo cerrado (placeholder · chk5.D-S3 alimenta real) */}
          {(miniStats?.tcCicloCerradoPEN ?? 0) > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-700">
                  TC ciclo cerrado
                </span>
              </div>
              <div className="bg-amber-50 ring-1 ring-amber-200/50 rounded-lg p-2 text-[11px]">
                <div className="text-amber-900 font-bold">
                  S/ {fmt0(miniStats!.tcCicloCerradoPEN)}
                </div>
                <div className="text-[10px] text-amber-700 mt-0.5">
                  Total bimoneda pendiente pago
                </div>
              </div>
            </div>
          )}

          {/* §S5 · Cajas recaudadoras pendientes (placeholder · chk5.D-S3) */}
          {recaudadoraPendiente > 0 && (
            <div className="bg-white border border-purple-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-3.5 h-3.5 text-purple-600" />
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-700">
                  Cajas recaudadoras
                </span>
              </div>
              <div className="bg-purple-50 ring-1 ring-purple-200/50 rounded-lg p-2 text-[11px]">
                <div className="text-purple-900 font-bold">
                  S/ {fmt0(recaudadoraPendiente)}
                </div>
                <div className="text-[10px] text-purple-700 mt-0.5">
                  Pendiente liquidar a banco
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ─── Drawer CC Entidad canon · chk5.D-S7.SF1 (reemplaza EntidadCCDetailModal legacy) */}
      {ccSeleccionada && (
        <DrawerCCEntidadCanonico
          cc={ccSeleccionada}
          onClose={() => setCCSeleccionada(null)}
          onRegistrarCobro={() => {
            const cc = ccSeleccionada;
            setCCSeleccionada(null);
            abrirWizard(cc);
          }}
        />
      )}

      <PagoAbonoWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        entidadPreseleccionada={wizardEntidad ?? undefined}
        onSuccess={() => {
          // Refrescar lista CC tras pago exitoso (refetch local)
          void cuentaCorrienteService.getAll().then(setCCs);
        }}
      />
    </>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES INLINE
// ═════════════════════════════════════════════════════════════════════════

interface PipelineStageProps {
  label: string;
  value: number;
  subtitle: string;
  pct: number;
  color: 'rose' | 'teal' | 'amber' | 'indigo' | 'emerald';
  hasArrow: boolean;
}

/**
 * Stage card del Pipeline Cash Flow · canon v9.0 M1 pixel-perfect mockup.
 * Tailwind requiere clases estáticas · no string interpolation directa.
 */
const PipelineStage: React.FC<PipelineStageProps> = ({
  label,
  value,
  subtitle,
  pct,
  color,
  hasArrow,
}) => {
  const STAGE_BG: Record<typeof color, string> = {
    rose: 'bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50',
    teal: 'bg-gradient-to-br from-teal-50 to-teal-100/40 ring-1 ring-teal-200/50',
    amber: 'bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50',
    indigo: 'bg-gradient-to-br from-indigo-50 to-indigo-100/40 ring-1 ring-indigo-200/50',
    emerald: 'bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50',
  };
  const TEXT_LABEL: Record<typeof color, string> = {
    rose: 'text-rose-700',
    teal: 'text-teal-700',
    amber: 'text-amber-700',
    indigo: 'text-indigo-700',
    emerald: 'text-emerald-700',
  };
  const TEXT_VALUE: Record<typeof color, string> = {
    rose: 'text-rose-900',
    teal: 'text-teal-900',
    amber: 'text-amber-900',
    indigo: 'text-indigo-900',
    emerald: 'text-emerald-900',
  };
  const BAR_BG: Record<typeof color, string> = {
    rose: 'bg-rose-100',
    teal: 'bg-teal-100',
    amber: 'bg-amber-100',
    indigo: 'bg-indigo-100',
    emerald: 'bg-emerald-100',
  };
  const BAR_FILL: Record<typeof color, string> = {
    rose: 'bg-rose-500',
    teal: 'bg-teal-500',
    amber: 'bg-amber-500',
    indigo: 'bg-indigo-500',
    emerald: 'bg-emerald-500',
  };

  return (
    <div className={`min-w-0 rounded-xl p-3 relative ${STAGE_BG[color]}`}>
      <div className={`text-[9px] uppercase tracking-wider font-bold mb-1 ${TEXT_LABEL[color]}`}>
        {label}
      </div>
      <div className={`text-base font-bold tabular-nums ${TEXT_VALUE[color]}`}>
        S/ {fmt0(value)}
      </div>
      <div className={`text-[10px] mt-1 ${TEXT_LABEL[color]}`}>{subtitle}</div>
      <div className={`mt-2 h-1 rounded-full overflow-hidden ${BAR_BG[color]}`}>
        <div
          className={`h-full ${BAR_FILL[color]}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      {hasArrow && (
        <span className="hidden xl:block absolute -right-2 top-1/2 -translate-y-1/2 text-slate-300 text-base font-light z-10 pointer-events-none">
          →
        </span>
      )}
    </div>
  );
};

export default Finanzas;
