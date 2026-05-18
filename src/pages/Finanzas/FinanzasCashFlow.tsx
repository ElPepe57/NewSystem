/**
 * FinanzasCashFlow — chk5.D-S3.quater · SF6
 *
 * REEMPLAZO COMPLETO de la versión legacy (Imp-L11 con CashFlowExecutivePanel).
 *
 * Sub-vista canon `/finanzas/cash-flow` · pixel-perfect MOCK 9.
 * Proyección 30/60/90 días con 3 escenarios + drivers + alertas + banner tensión.
 *
 * Override del shell adaptativo (S3.SF1):
 *   - breadcrumb leaf: "Cash flow proyectado"
 *   - header: icon CalendarRange amber + "Cash flow proyectado" + subtitle
 *   - actions: [Exportar proyección · Configurar drivers · Simular escenario]
 *   - kpiSlot: 5 KPIs propios (Posición HOY · +30d · +60d · Burn rate · Día crítico)
 *
 * Conecta:
 *   - useFinanzasShellContext() → cuentas + movimientosMes + resumenCC
 *   - tarjetaCreditoService.getAll() · recaudadoras vía cajaRecaudadoraService
 *   - cuentaCorrienteService.getAll() · CC entidades
 *   - proyectarHeuristico() · genera serie temporal
 *   - detectarPuntoTension() · banner alerta
 *
 * NOTA · drivers configurables (`DEUDA-DRIVERS-CONFIG`) difieren a chk5.D-S4.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  Download,
  Settings2,
  Play,
  Landmark,
  TrendingUp,
  Flame,
  AlertCircle,
} from 'lucide-react';
import { useFinanzasShellContext } from './FinanzasLayout';
import { tarjetaCreditoService } from '../../services/tarjetaCredito.service';
import { cuentaCorrienteService } from '../../services/cuentaCorriente.service';
import { getProductosFinancierosActivos } from '../../services/productoFinanciero.service';
import { cajaRecaudadoraService } from '../../services/cajaRecaudadora.service';
import { getMovimientos } from '../../services/tesoreria.movimientos.service';
import { TIPOS_INGRESO, TIPOS_EGRESO } from '../../services/tesoreria.shared';
import type { CuentaCorriente } from '../../types/cuentaCorriente.types';
import type { TarjetaCredito } from '../../types/tarjetaCredito.types';
import type { MovimientoTesoreria } from '../../types/tesoreria.types';
import {
  calcularPosicionHoy,
  calcularBurnRate,
  extraerDriversProyectados,
  proyectarHeuristico,
  detectarPuntoTension,
  calcularKPIsCashFlow,
  defaultFiltrosCashFlow,
  fmt0,
  fmtFechaCorta,
  type FiltrosCashFlowState,
  type DriverProyectado,
  type ProyeccionResultado,
  type PuntoTensionDetectado,
} from './components/cashflow/cashFlowHelpers';
import { ProyeccionChartSVG, ChartLegend } from './components/cashflow/ProyeccionChartSVG';
import { EscenariosCards, BannerPuntoTension } from './components/cashflow/EscenariosCards';
import { TablaDriversProyectados } from './components/cashflow/TablaDriversProyectados';
import { DriversConfigSection } from './components/cashflow/DriversConfigSection';
import { FiltrosCashFlowBar } from './components/cashflow/FiltrosCashFlowBar';
import { useToastStore } from '../../store/toastStore';

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

const FinanzasCashFlow: React.FC = () => {
  const { cuentas, miniStats, movimientosMes, setSubVistaConfig } = useFinanzasShellContext();
  const tcpaActual = miniStats?.tcpa ?? 0;
  const toastInfo = useToastStore((s) => s.info);

  // Estado local
  const [ccs, setCCs] = useState<CuentaCorriente[]>([]);
  const [tarjetas, setTarjetas] = useState<TarjetaCredito[]>([]);
  const [recaudadorasPendientes, setRecaudadorasPendientes] = useState<
    Array<{ nombre: string; pendientePEN: number; ultimaLiqDias: number }>
  >([]);
  const [historico90d, setHistorico90d] = useState<MovimientoTesoreria[]>([]);
  const [filtros, setFiltros] = useState<FiltrosCashFlowState>(defaultFiltrosCashFlow);
  const [loading, setLoading] = useState(true);

  // ─── Fetch data adicional ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const hoy = new Date();
    const hace90d = new Date();
    hace90d.setDate(hace90d.getDate() - 90);
    hace90d.setHours(0, 0, 0, 0);

    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    Promise.all([
      cuentaCorrienteService.getAll(),
      tarjetaCreditoService.getAll(),
      getProductosFinancierosActivos(),
      getMovimientos({ fechaInicio: hace90d, fechaFin: hoy }),
    ])
      .then(async ([listaCC, listaTC, prodsFin, movs90]) => {
        if (cancelled) return;
        setCCs(listaCC);
        setTarjetas(listaTC);
        setHistorico90d(movs90);

        // Recaudadoras con saldo pendiente
        const recList = prodsFin.filter((p) => p.tipoProducto === 'caja_recaudadora');
        const pendientes: Array<{
          nombre: string;
          pendientePEN: number;
          ultimaLiqDias: number;
        }> = [];
        await Promise.all(
          recList.map(async (r) => {
            if (!r.id) return;
            try {
              const bal = await cajaRecaudadoraService.calcularBalanceMes(
                r.id,
                inicioMes,
                hoy,
              );
              if (bal.pendienteLiquidar > 0.01) {
                pendientes.push({
                  nombre: r.responsableTerceroNombre ?? r.nombre,
                  pendientePEN: bal.pendienteLiquidar,
                  ultimaLiqDias: bal.diasDesdeUltimaLiquidacion ?? 15,
                });
              }
            } catch {
              // ignore
            }
          }),
        );
        if (!cancelled) setRecaudadorasPendientes(pendientes);
      })
      .catch((err) => {
        console.error('FinanzasCashFlow · error fetch:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Posición + burn ────────────────────────────────────────────────
  const posicionHoy = useMemo(
    () => calcularPosicionHoy(cuentas, tcpaActual),
    [cuentas, tcpaActual],
  );
  const burnRate = useMemo(() => calcularBurnRate(historico90d), [historico90d]);

  // ─── Drivers + proyección ──────────────────────────────────────────
  const drivers = useMemo<DriverProyectado[]>(
    () =>
      extraerDriversProyectados({
        ccs,
        tarjetas,
        recaudadorasPendientes,
        horizonte: filtros.horizonte,
        tcpa: tcpaActual,
      }),
    [ccs, tarjetas, recaudadorasPendientes, filtros.horizonte, tcpaActual],
  );

  const proyeccion = useMemo<ProyeccionResultado>(
    () =>
      proyectarHeuristico({
        posicionHoy,
        drivers,
        horizonte: filtros.horizonte,
        burnRateMensual: burnRate,
      }),
    [posicionHoy, drivers, filtros.horizonte, burnRate],
  );

  const puntoTension = useMemo<PuntoTensionDetectado | null>(
    () => detectarPuntoTension(proyeccion, drivers),
    [proyeccion, drivers],
  );

  // ─── KPIs canon MOCK 9 ─────────────────────────────────────────────
  const kpis = useMemo(
    () =>
      calcularKPIsCashFlow({
        cuentas,
        movimientos90d: historico90d,
        proyeccion,
        puntoTension,
        tcpa: tcpaActual,
      }),
    [cuentas, historico90d, proyeccion, puntoTension, tcpaActual],
  );

  // ─── Histórico para el gráfico SVG (saldo acumulado por día últimos 30d) ──
  const historicoChart = useMemo(() => {
    if (movimientosMes.length === 0 && historico90d.length === 0) return [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hace30 = new Date(hoy);
    hace30.setDate(hace30.getDate() - 30);

    // Saldo "actual" = posicionHoy · trabajamos hacia atrás restando movs
    const movsOrdenados = [...historico90d]
      .filter((m) => m.estado !== 'anulado' && m.fecha)
      .filter((m) => m.fecha.toDate() >= hace30)
      .sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis()); // descendente

    let saldoEnReversa = posicionHoy;
    const puntosPorDia = new Map<string, number>();
    puntosPorDia.set(fechaKey(hoy), saldoEnReversa);

    for (const m of movsOrdenados) {
      const fecha = m.fecha.toDate();
      fecha.setHours(0, 0, 0, 0);
      const equiv = m.montoEquivalentePEN || 0;
      // Revertir el movimiento para obtener saldo del día anterior
      if (TIPOS_INGRESO.includes(m.tipo)) saldoEnReversa -= equiv;
      else if (TIPOS_EGRESO.includes(m.tipo)) saldoEnReversa += equiv;
      puntosPorDia.set(fechaKey(fecha), saldoEnReversa);
    }

    const result: Array<{ fecha: Date; saldo: number }> = [];
    for (let i = 30; i >= 0; i--) {
      const f = new Date(hoy);
      f.setDate(f.getDate() - i);
      const key = fechaKey(f);
      const sld = puntosPorDia.get(key);
      if (sld !== undefined) {
        result.push({ fecha: f, saldo: sld });
      } else if (result.length > 0) {
        // Reusar último valor
        result.push({ fecha: f, saldo: result[result.length - 1].saldo });
      }
    }
    return result;
  }, [movimientosMes, historico90d, posicionHoy]);

  // ─── Handlers ────────────────────────────────────────────────────────
  // chk5.D-S8.SF3.D2 · placeholders honestos: toast info en vez de console.info silencioso.
  // Quedará reemplazado por implementación real en chk5.D-S9.
  const handleExportar = useCallback(() => {
    toastInfo(
      `Exportar proyección Cash Flow (${drivers.length} drivers) llegará en chk5.D-S9.`,
      'Próximamente',
    );
  }, [toastInfo, drivers.length]);

  const handleConfigurarDrivers = useCallback(() => {
    toastInfo(
      'Editar drivers de proyección manualmente llegará en chk5.D-S9. Hoy se calculan automáticos desde CC + tarjetas.',
      'Próximamente',
    );
  }, [toastInfo]);

  const handleSimular = useCallback(() => {
    toastInfo(
      'Simulador de escenarios what-if llegará en chk5.D-S9. Los 3 escenarios (optimista/base/pesimista) ya se calculan automáticos.',
      'Próximamente',
    );
  }, [toastInfo]);

  const handlePlanAccion = useCallback(() => {
    toastInfo(
      'Plan de acción guiado para puntos de tensión llegará en chk5.D-S9.',
      'Próximamente',
    );
  }, [toastInfo]);

  const handleClickDriver = useCallback((d: DriverProyectado) => {
    console.info('FinanzasCashFlow · click driver', d.descripcion);
  }, []);

  // ─── KPI slot canon MOCK 9 §1 ───────────────────────────────────────
  const kpiSlot = useMemo(
    () => (
      <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* KPI 1 · Posición HOY */}
        <KpiCard
          color="teal"
          icon={Landmark}
          label="Posición HOY"
          value={`S/ ${fmt0(kpis.posicionHoy)}`}
          subtitle="caja consolidada"
        />
        {/* KPI 2 · Proyectado +30d */}
        <KpiCard
          color={kpis.delta30d >= 0 ? 'emerald' : 'rose'}
          icon={TrendingUp}
          label="Proyectado +30d"
          value={`${kpis.delta30d >= 0 ? '+' : '−'}S/ ${fmt0(Math.abs(kpis.delta30d))}`}
          subtitle={`Cierre: S/ ${fmt0(kpis.cierre30dBase)}`}
        />
        {/* KPI 3 · Proyectado +60d */}
        <KpiCard
          color={kpis.delta60d >= 0 ? 'amber' : 'rose'}
          icon={TrendingUp}
          label="Proyectado +60d"
          value={`${kpis.delta60d >= 0 ? '+' : '−'}S/ ${fmt0(Math.abs(kpis.delta60d))}`}
          subtitle={`Cierre: S/ ${fmt0(kpis.cierre60dBase)}`}
        />
        {/* KPI 4 · Burn rate + runway */}
        <KpiCard
          color="rose"
          icon={Flame}
          label="Burn rate"
          value={`S/ ${fmt0(kpis.burnRateMensual)}/m`}
          subtitle={
            kpis.runwayMeses === Infinity
              ? 'Runway: sin datos'
              : `Runway: ${kpis.runwayMeses.toFixed(1)} meses`
          }
        />
        {/* KPI 5 · Día crítico */}
        <KpiCard
          color="indigo"
          icon={AlertCircle}
          label="Día crítico próx"
          value={kpis.diaCriticoFecha ? fmtFechaCorta(kpis.diaCriticoFecha) : '—'}
          subtitle={kpis.diaCriticoMotivo ?? 'sin tensión detectada'}
        />
      </div>
    ),
    [kpis],
  );

  // ─── Actions custom ─────────────────────────────────────────────────
  const actionsCustom = useMemo(
    () => (
      <>
        <button
          type="button"
          onClick={handleExportar}
          aria-label="Exportar proyección"
          title="Exportar proyección"
          className="text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Download className="w-3 h-3" />
          <span className="hidden sm:inline">Exportar proyección</span>
        </button>
        <button
          type="button"
          onClick={handleConfigurarDrivers}
          aria-label="Configurar drivers"
          title="Configurar drivers de proyección"
          className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Settings2 className="w-3 h-3" />
          <span className="hidden sm:inline">Configurar drivers</span>
        </button>
        <button
          type="button"
          onClick={handleSimular}
          aria-label="Simular escenario"
          title="Simular escenario what-if"
          className="text-[11px] font-bold text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Play className="w-3 h-3" />
          <span className="hidden sm:inline">Simular escenario</span>
        </button>
      </>
    ),
    [handleExportar, handleConfigurarDrivers, handleSimular],
  );

  // ─── Setear sub-vista config en el shell ────────────────────────────
  useEffect(() => {
    setSubVistaConfig({
      breadcrumbLeaf: 'Cash flow proyectado',
      header: {
        title: 'Cash flow proyectado',
        subtitle:
          'Proyección 30/60/90 días · escenarios optimista/base/pesimista · drivers identificados · alertas tempranas',
        icon: CalendarRange,
        iconColor: 'amber',
      },
      kpiSlot,
      actions: actionsCustom,
      actionsReplaceAll: true,
    });
  }, [setSubVistaConfig, kpiSlot, actionsCustom]);

  // ═════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════

  // Loading state
  if (loading) {
    return (
      <>
        <FiltrosCashFlowBar state={filtros} onChange={setFiltros} />
        <div className="p-6 space-y-4">
          <div className="shimmer h-64 rounded-xl" />
          <div className="grid grid-cols-3 gap-3">
            <div className="shimmer h-20 rounded-xl" />
            <div className="shimmer h-20 rounded-xl" />
            <div className="shimmer h-20 rounded-xl" />
          </div>
          <div className="text-center text-[10px] text-slate-500">
            Calculando proyección · {historico90d.length} movs · {ccs.length} entidades...
          </div>
        </div>
      </>
    );
  }

  // Empty state · sin histórico suficiente
  if (historico90d.length === 0 && cuentas.length === 0) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
          <CalendarRange className="w-8 h-8 text-amber-600" />
        </div>
        <div>
          <div className="text-[14px] font-bold text-slate-900">Aún no podemos proyectar</div>
          <div className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
            Cash flow proyectado requiere movimientos históricos para construir drivers confiables.
            Empezá registrando movimientos y volvé acá en 30 días.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <FiltrosCashFlowBar
        state={filtros}
        onChange={setFiltros}
        onFiltrosAvanzados={() => console.info('filtros avanzados · S4')}
      />

      {puntoTension && puntoTension.zona !== 'segura' && (
        <BannerPuntoTension punto={puntoTension} onPlanAccion={handlePlanAccion} />
      )}

      {/* Gráfico principal */}
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-[13px] font-bold text-slate-900">
            Proyección de caja · {filtros.horizonte} días
          </h3>
          <ChartLegend escenariosVisibles={filtros.escenariosVisibles} />
        </div>
        <ProyeccionChartSVG
          historico={historicoChart}
          proyeccion={proyeccion.puntos}
          escenariosVisibles={filtros.escenariosVisibles}
          puntoCriticoFecha={proyeccion.diaCriticoFecha}
          puntoCriticoSaldo={proyeccion.diaCriticoSaldoBase}
        />
        <EscenariosCards
          cierre60dOptimista={proyeccion.cierre60dOptimista}
          cierre60dBase={proyeccion.cierre60dBase}
          cierre60dPesimista={proyeccion.cierre60dPesimista}
          horizonteDias={filtros.horizonte}
        />
      </div>

      {/* Tabla drivers */}
      <div className="px-6 pb-6">
        <TablaDriversProyectados
          drivers={drivers}
          horizonteDias={filtros.horizonte}
          onClickDriver={handleClickDriver}
        />
      </div>

      {/* Section drivers configurables */}
      <div className="px-6 pb-6">
        <DriversConfigSection />
      </div>
    </>
  );
};

export default FinanzasCashFlow;

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES INLINE
// ═════════════════════════════════════════════════════════════════════════

interface KpiCardProps {
  color: 'teal' | 'emerald' | 'amber' | 'rose' | 'indigo';
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle: string;
}

const KPI_BG: Record<KpiCardProps['color'], string> = {
  teal: 'bg-gradient-to-br from-teal-50 to-teal-100/40 ring-teal-200/50',
  emerald: 'bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-emerald-200/50',
  amber: 'bg-gradient-to-br from-amber-50 to-amber-100/40 ring-amber-200/50',
  rose: 'bg-gradient-to-br from-rose-50 to-rose-100/40 ring-rose-200/50',
  indigo: 'bg-gradient-to-br from-indigo-50 to-indigo-100/40 ring-indigo-200/50',
};

const KPI_LABEL: Record<KpiCardProps['color'], string> = {
  teal: 'text-teal-700',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
  indigo: 'text-indigo-700',
};

const KPI_VALUE: Record<KpiCardProps['color'], string> = {
  teal: 'text-teal-900',
  emerald: 'text-emerald-900',
  amber: 'text-amber-900',
  rose: 'text-rose-900',
  indigo: 'text-indigo-900',
};

const KpiCard: React.FC<KpiCardProps> = ({ color, icon: Icon, label, value, subtitle }) => (
  <div className={`ring-1 rounded-2xl p-4 ${KPI_BG[color]}`}>
    <div className="flex items-center justify-between mb-2 gap-2">
      <span
        className={`text-[10px] uppercase tracking-wider font-bold truncate ${KPI_LABEL[color]}`}
      >
        {label}
      </span>
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${KPI_LABEL[color]}`} />
    </div>
    <div className={`text-2xl font-bold tabular-nums ${KPI_VALUE[color]}`}>{value}</div>
    <div className={`text-[11px] mt-1 truncate ${KPI_LABEL[color]}`}>{subtitle}</div>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════
// UTILS
// ═════════════════════════════════════════════════════════════════════════

function fechaKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
