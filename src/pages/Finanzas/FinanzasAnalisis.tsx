/**
 * FinanzasAnalisis — chk5.D-S3.quinto · SF7
 *
 * Sub-vista canon `/finanzas/analisis` · pixel-perfect MOCK 4.
 * Vista estratégica con 10 gráficas en 3 tiers:
 *
 *   TIER 1 · Ejecutivas (defaultmente visibles)
 *     - G10 · Pulso financiero (4 gauges)
 *     - G1.a · Waterfall margen
 *     - G3 · Burn rate + Runway
 *     - G2 · Working Capital Cycle
 *     - G7 · EBITDA Bridge MoM
 *
 *   TIER 2 · Operativas
 *     - Calendario obligaciones (heatmap mensual)
 *     - G9 · Sankey flujo dinero
 *
 *   TIER 3 · Tácticas (drill)
 *     - G5 · Cohort cobro DSO (heatmap)
 *     - G4 · ROI por línea (scatter quadrant)
 *     - G6 · Cash flow escenarios
 *
 * Override del shell adaptativo (S3.SF1):
 *   - breadcrumb leaf: "Análisis estratégico"
 *   - header: icon LineChart purple + "Análisis estratégico" + subtitle
 *   - actions: [Exportar dashboard · Configurar benchmarks] + dropdown preservado
 *   - kpiSlot: NO usa kpiSlot · las gráficas son el contenido principal
 *
 * Conecta:
 *   - useFinanzasShellContext() → cuentas + miniStats + movimientosMes + resumenCC
 *   - cuentaCorrienteService.getAll() · CC entidades
 *   - tarjetaCreditoService.getAll() · tarjetas
 *   - getMovimientos · históricos 90d + mes anterior
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LineChart, Download, Settings2 } from 'lucide-react';
import { useFinanzasShellContext } from './FinanzasLayout';
import { cuentaCorrienteService } from '../../services/cuentaCorriente.service';
import { tarjetaCreditoService } from '../../services/tarjetaCredito.service';
import { getMovimientos } from '../../services/tesoreria.movimientos.service';
import type { CuentaCorriente } from '../../types/cuentaCorriente.types';
import type { TarjetaCredito } from '../../types/tarjetaCredito.types';
import type { MovimientoTesoreria } from '../../types/tesoreria.types';
import {
  calcularAgregados,
  calcularPulsoFinanciero,
  calcularWaterfallMargen,
  calcularBurnRunway,
  calcularWorkingCapitalCycle,
  calcularEbitdaBridge,
  calcularCalendarioObligaciones,
  calcularSankey,
  calcularCohortDSO,
  calcularROIScatter,
} from './components/analisis/analisisHelpers';
import { G10PulsoFinanciero } from './components/analisis/G10PulsoFinanciero';
import { G1aWaterfallMargen } from './components/analisis/G1aWaterfallMargen';
import { G3BurnRunway } from './components/analisis/G3BurnRunway';
import { G2WorkingCapitalCycle } from './components/analisis/G2WorkingCapitalCycle';
import { G7EbitdaBridge } from './components/analisis/G7EbitdaBridge';
import { CalendarioObligaciones } from './components/analisis/CalendarioObligaciones';
import { G9Sankey } from './components/analisis/G9Sankey';
import {
  G5CohortDSO,
  G4ROIScatter,
  G6CashFlowEscenarios,
} from './components/analisis/GraficasCondensadas';
import { useToastStore } from '../../store/toastStore';

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

const FinanzasAnalisis: React.FC = () => {
  const { cuentas, miniStats, resumenCC, movimientosMes, setSubVistaConfig } =
    useFinanzasShellContext();
  const tcpaActual = miniStats?.tcpa ?? 0;
  const toastInfo = useToastStore((s) => s.info);

  // Estado local · fetch extra
  const [ccs, setCCs] = useState<CuentaCorriente[]>([]);
  const [tarjetas, setTarjetas] = useState<TarjetaCredito[]>([]);
  const [historico90d, setHistorico90d] = useState<MovimientoTesoreria[]>([]);
  const [movimientosMesAnterior, setMovimientosMesAnterior] = useState<MovimientoTesoreria[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Fetch ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const hoy = new Date();
    const hace90d = new Date(hoy);
    hace90d.setDate(hace90d.getDate() - 90);
    hace90d.setHours(0, 0, 0, 0);

    const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59, 999);

    Promise.all([
      cuentaCorrienteService.getAll(),
      tarjetaCreditoService.getAll(),
      getMovimientos({ fechaInicio: hace90d, fechaFin: hoy }),
      getMovimientos({ fechaInicio: inicioMesAnterior, fechaFin: finMesAnterior }),
    ])
      .then(([listaCC, listaTC, movs90, movsAnt]) => {
        if (cancelled) return;
        setCCs(listaCC);
        setTarjetas(listaTC);
        setHistorico90d(movs90);
        setMovimientosMesAnterior(movsAnt);
      })
      .catch((err) => {
        console.error('FinanzasAnalisis · error fetch:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Suprimir warning · inicioMesActual reservado
    void inicioMesActual;
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Agregados financieros base ──────────────────────────────────────
  const agregados = useMemo(
    () =>
      calcularAgregados({
        cuentas,
        movimientosMes,
        ccs,
        tarjetas,
        resumenCC,
        tcpa: tcpaActual,
      }),
    [cuentas, movimientosMes, ccs, tarjetas, resumenCC, tcpaActual],
  );

  // ─── Calcular cada gráfica ───────────────────────────────────────────
  const wcc = useMemo(() => calcularWorkingCapitalCycle({ ccs }), [ccs]);

  const pulso = useMemo(
    () =>
      calcularPulsoFinanciero({
        cajaActual: getCajaActual(cuentas, tcpaActual),
        cxpProximos30d: agregados.cxpProximos30d,
        margenEbitdaPct: agregados.margenEbitdaPct,
        activosTotal: agregados.activosTotal,
        pasivosTotal: agregados.pasivosTotal,
        ccc: wcc.ccc,
      }),
    [cuentas, tcpaActual, agregados, wcc],
  );

  const waterfall = useMemo(
    () =>
      calcularWaterfallMargen({
        ingreso: agregados.ingresoMes,
        cogs: agregados.cogsEstimado,
        opex: agregados.opexEstimado,
      }),
    [agregados],
  );

  const burnRunway = useMemo(
    () =>
      calcularBurnRunway({
        cajaActual: getCajaActual(cuentas, tcpaActual),
        movimientos90d: historico90d,
      }),
    [cuentas, tcpaActual, historico90d],
  );

  const ebitdaBridge = useMemo(
    () =>
      calcularEbitdaBridge({
        movimientosMesActual: movimientosMes,
        movimientosMesAnterior: movimientosMesAnterior,
      }),
    [movimientosMes, movimientosMesAnterior],
  );

  const calendario = useMemo(() => {
    const hoy = new Date();
    return calcularCalendarioObligaciones({
      anio: hoy.getFullYear(),
      mes: hoy.getMonth(),
      ccs,
      tarjetas,
    });
  }, [ccs, tarjetas]);

  const sankey = useMemo(
    () => calcularSankey({ cuentas, movimientos: movimientosMes }),
    [cuentas, movimientosMes],
  );

  const cohort = useMemo(() => calcularCohortDSO({ ccs }), [ccs]);

  const roiScatter = useMemo(() => calcularROIScatter({ movimientos: movimientosMes }), [
    movimientosMes,
  ]);

  // Cash flow escenarios placeholder · S3.quater ya tiene el cálculo real
  const cashFlowEscenarios = useMemo(() => {
    const base = agregados.ebitda;
    return {
      base30d: base * 1,
      base60d: base * 2,
      base90d: base * 3,
      optimista90d: base * 3 * 1.15,
      pesimista90d: base * 3 * 0.8,
    };
  }, [agregados.ebitda]);

  // ─── Handlers ────────────────────────────────────────────────────────
  // chk5.D-S8.SF3.D2 · placeholders honestos: toast info en vez de console.info silencioso.
  const handleExportar = useCallback(() => {
    toastInfo(
      'Export del dashboard analítico a PDF/Excel llegará en chk5.D-S9. Por ahora podés capturar cada gráfica individualmente.',
      'Próximamente',
    );
  }, [toastInfo]);

  const handleConfigurarBenchmarks = useCallback(() => {
    toastInfo(
      'Editar umbrales de los semáforos del Pulso Financiero (rangos verde/ámbar/rojo) llegará en chk5.D-S9. Hoy son defaults sectoriales.',
      'Próximamente',
    );
  }, [toastInfo]);

  // ─── Actions custom ─────────────────────────────────────────────────
  const actionsCustom = useMemo(
    () => (
      <>
        <button
          type="button"
          onClick={handleExportar}
          aria-label="Exportar dashboard"
          title="Exportar dashboard analítico"
          className="text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Download className="w-3 h-3" />
          <span className="hidden sm:inline">Exportar dashboard</span>
        </button>
        <button
          type="button"
          onClick={handleConfigurarBenchmarks}
          aria-label="Configurar benchmarks"
          title="Configurar umbrales del Pulso Financiero"
          className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Settings2 className="w-3 h-3" />
          <span className="hidden sm:inline">Configurar benchmarks</span>
        </button>
      </>
    ),
    [handleExportar, handleConfigurarBenchmarks],
  );

  // ─── Setear sub-vista config ────────────────────────────────────────
  useEffect(() => {
    setSubVistaConfig({
      breadcrumbLeaf: 'Análisis estratégico',
      header: {
        title: 'Análisis estratégico',
        subtitle:
          'Pulso financiero · margen · runway · capital de trabajo · EBITDA · calendario de obligaciones · cohort de cobro · ROI por línea · escenarios de cash flow',
        icon: LineChart,
        iconColor: 'purple',
      },
      actions: actionsCustom,
      actionsReplaceAll: false, // preserva dropdown "+ Nuevo movimiento"
    });
  }, [setSubVistaConfig, actionsCustom]);

  // ═════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="shimmer h-48 rounded-2xl" />
        <div className="shimmer h-64 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="shimmer h-48 rounded-2xl" />
          <div className="shimmer h-48 rounded-2xl" />
        </div>
        <div className="text-center text-[10px] text-slate-500">
          Calculando análisis estratégico · 10 indicadores...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* ─── INTRO + MATRIZ 3 TIERS ─────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-sm text-slate-600 max-w-3xl">
          Vista estratégica del módulo Finanzas. Cada gráfica responde una pregunta clave
          del negocio · de la salud general (pulso financiero) al detalle de cohortes y
          escenarios futuros.
        </p>
      </section>

      {/* ─── TIER 1 · EJECUTIVAS ───────────────────────────────────── */}
      <G10PulsoFinanciero pulso={pulso} />
      <G1aWaterfallMargen data={waterfall} />
      <G3BurnRunway data={burnRunway} />
      <G2WorkingCapitalCycle data={wcc} />
      <G7EbitdaBridge data={ebitdaBridge} />

      {/* ─── TIER 2 · OPERATIVAS ───────────────────────────────────── */}
      <CalendarioObligaciones data={calendario} />

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
            § Gráficas condensadas TIER 2-3
          </span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <p className="text-[12px] text-slate-500 max-w-2xl">
          Sankey de flujo · cohorte DSO · ROI por línea · escenarios de cash flow.
          Vista preview · el drill completo vive en cada sub-vista asociada.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <G9Sankey nodos={sankey.nodos} flows={sankey.flows} />
          <G5CohortDSO rows={cohort} />
          <G4ROIScatter puntos={roiScatter} />
          <G6CashFlowEscenarios data={cashFlowEscenarios} />
        </div>
      </section>
    </div>
  );
};

export default FinanzasAnalisis;

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function getCajaActual(
  cuentas: Array<{
    activa: boolean;
    esBiMoneda: boolean;
    moneda: 'PEN' | 'USD';
    saldoActual?: number;
    saldoPEN?: number;
    saldoUSD?: number;
  }>,
  tcpa: number,
): number {
  let pen = 0;
  let usd = 0;
  for (const c of cuentas) {
    if (!c.activa) continue;
    if (c.esBiMoneda) {
      pen += c.saldoPEN ?? 0;
      usd += c.saldoUSD ?? 0;
    } else if (c.moneda === 'PEN') {
      pen += c.saldoActual ?? 0;
    } else {
      usd += c.saldoActual ?? 0;
    }
  }
  return pen + usd * tcpa;
}
