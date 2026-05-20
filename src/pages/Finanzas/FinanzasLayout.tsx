/**
 * FinanzasLayout — chk5.D-S2 · SF4 · Shell unificado canon MOCK 1
 *
 * Refactor pixel-perfect contra `docs/mockups/finanzas-shell-overview-v5.1.html`
 * (§2 Shell completo · canon v8.0+v9.0). Reemplaza el shell legacy S57.
 *
 * Layout:
 *   1. Top bar · breadcrumb + utility (⌘K + bell)
 *   2. Header banking-grade · icon Landmark teal + h1 + subtitle + 3-tier actions
 *   3. KPI strip canon v8.0 N1+N2 · 5 KPIs semánticos (KpiStripFinanzas SF1)
 *   4. Mini-stats footer canon N3 · Pool USD · TC ciclo · GK Xpress
 *   5. Tabs 6 sub-rutas canon · Overview · Saldos · Movimientos · CC · Cash flow · Análisis
 *   6. <Outlet /> renderiza el cuerpo de la sub-vista activa
 *
 * El sidebar persistente NO vive en el shell · vive dentro del Overview (SF5)
 * porque el mockup §2 lo muestra como `md:col-span-1` del grid del cuerpo
 * Overview, no del shell raíz.
 *
 * Wireup:
 *   - "Exportar" · cross-link a /reportes (placeholder)
 *   - "Configurar TC" · cross-link a /tipo-cambio
 *   - "+ Nuevo movimiento" · dispara DropdownNuevoMovimiento (SF3)
 *
 * Las 8 acciones del dropdown se ramifican vía AccionNuevoMovimiento. Por SF4
 * los wizards Cobrar distribuido · Pagos masivos · etc se mantienen como
 * placeholders (cross-link a /tesoreria) hasta SF5/S3 que las wire-up al canon.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Landmark,
  ChevronLeft,
  ChevronRight,
  Bell,
  Keyboard,
  Download,
  Settings2,
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Users,
  CalendarRange,
  LineChart,
  type LucideIcon,
} from 'lucide-react';
import { PageShell } from '../../design-system';
import { cn } from '../../design-system';
import {
  KpiStripFinanzas,
  type KpiStripFinanzasData,
  type MiniStatsFooterData,
} from './components/KpiStripFinanzas';
import {
  DropdownNuevoMovimiento,
  type AccionNuevoMovimiento,
} from './components/DropdownNuevoMovimiento';
import { IngresoSimpleModal } from './components/wizards/IngresoSimpleModal';
import { EgresoSimpleModal } from './components/wizards/EgresoSimpleModal';
import { PagoAbonoWizard } from './components/PagoAbonoWizard';
import { LiquidarRecaudadoraWizard } from './components/LiquidarRecaudadoraWizard/LiquidarRecaudadoraWizard';
import { ConversionTransferenciaWizard } from './components/wizards/ConversionTransferenciaWizard';
import { PagosMasivosWizard } from './components/wizards/PagosMasivosWizard';
import { PagarEstadoCuentaWizard } from './components/wizards/PagarEstadoCuentaWizard';
import { cuentaCorrienteService } from '../../services/cuentaCorriente.service';
import { getCuentas } from '../../services/tesoreria.cuentas.service';
import { getMovimientos } from '../../services/tesoreria.movimientos.service';
import { TIPOS_INGRESO, TIPOS_EGRESO } from '../../services/tesoreria.shared';
import { poolUSDViewService } from '../../services/poolUSD.view.service';
import { tarjetaCreditoService } from '../../services/tarjetaCredito.service';
import { getProductosFinancierosActivos } from '../../services/productoFinanciero.service';
import { cajaRecaudadoraService } from '../../services/cajaRecaudadora.service';
import type {
  CuentaCorriente,
  SaldosResumen,
} from '../../types/cuentaCorriente.types';
import type { CuentaCaja, MovimientoTesoreria } from '../../types/tesoreria.types';
import type { TarjetaCredito } from '../../types/tarjetaCredito.types';

// ═════════════════════════════════════════════════════════════════════════
// TABS · 6 sub-rutas canon (mockup §2)
// ═════════════════════════════════════════════════════════════════════════

interface TabConfig {
  path: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
  /** Badge opcional (count · ej. "8" cuentas) */
  badge?: { value: string | number; color: 'slate' | 'emerald' | 'rose' | 'indigo' | 'amber' };
  /** Sub-vista pendiente de wiring · disabled */
  disabled?: boolean;
  /** Tooltip cuando está disabled */
  disabledHint?: string;
}

const TABS: TabConfig[] = [
  { path: '/finanzas', label: 'Overview', icon: LayoutDashboard, end: true },
  { path: '/finanzas/saldos', label: 'Saldos', icon: Wallet, end: false },
  {
    path: '/finanzas/movimientos',
    label: 'Movimientos',
    icon: ArrowLeftRight,
    end: false,
  },
  {
    path: '/finanzas/cc',
    label: 'Cuentas Corrientes',
    icon: Users,
    end: false,
  },
  { path: '/finanzas/cash-flow', label: 'Cash flow', icon: CalendarRange, end: false },
  {
    path: '/finanzas/analisis',
    label: 'Análisis',
    icon: LineChart,
    end: false,
  },
];

const BADGE_COLOR: Record<NonNullable<TabConfig['badge']>['color'], string> = {
  slate: 'bg-slate-100 text-slate-600',
  emerald: 'bg-emerald-100 text-emerald-700',
  rose: 'bg-rose-100 text-rose-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  amber: 'bg-amber-100 text-amber-700',
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTE · SubVistaTabs (chk5.D-S8.SF3.D11)
// Scroll horizontal con chevron buttons que aparecen sólo cuando hay overflow.
// Auto-scroll del tab activo a la vista al navegar.
// ═════════════════════════════════════════════════════════════════════════

const SubVistaTabs: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Actualiza estado de chevrons según scroll position
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const slack = 2; // tolerancia pixel-perfect
    setCanScrollLeft(el.scrollLeft > slack);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - slack);
  }, []);

  // Listeners: scroll + resize + mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState]);

  // Auto-scroll del tab activo a la vista cuando cambia la ruta
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('a[aria-current="page"]');
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    // Re-evaluar chevrons después del scroll programático
    const t = window.setTimeout(updateScrollState, 350);
    return () => window.clearTimeout(t);
  }, [location.pathname, updateScrollState]);

  // Scroll por click de chevron · 60% del viewport visible (aprox 1.5 tabs)
  const scrollBy = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.6, behavior: 'smooth' });
  }, []);

  return (
    <div className="relative border-b border-slate-200">
      {/* Chevron izquierdo · sólo si hay scroll posible a la izquierda */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Desplazar tabs a la izquierda"
          className="absolute left-0 top-0 bottom-0 z-20 px-1.5 bg-white/95 hover:bg-slate-50 border-r border-slate-200 flex items-center text-slate-600 hover:text-slate-900 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      <div ref={scrollRef} className="px-6 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1 -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            if (tab.disabled) {
              return (
                <button
                  key={tab.path}
                  type="button"
                  disabled
                  title={tab.disabledHint}
                  aria-disabled="true"
                  className="px-4 py-3 text-[12px] font-medium border-b-2 border-transparent text-slate-400 cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold">
                    próx
                  </span>
                </button>
              );
            }
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'px-4 py-3 text-[12px] border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors',
                    isActive
                      ? 'border-teal-600 text-teal-700 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 font-medium',
                  )
                }
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.badge && (
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                      BADGE_COLOR[tab.badge.color],
                    )}
                  >
                    {tab.badge.value}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Chevron derecho · sólo si hay scroll posible a la derecha */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Desplazar tabs a la derecha"
          className="absolute right-0 top-0 bottom-0 z-20 px-1.5 bg-white/95 hover:bg-slate-50 border-l border-slate-200 flex items-center text-slate-600 hover:text-slate-900 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)]"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Fade hint derecho · sólo se nota cuando hay overflow horizontal y no hay chevron (ej. desktop apenas justo) */}
      {canScrollRight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-8 h-full w-6 bg-gradient-to-l from-white to-transparent"
        />
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-VISTA CONFIG · cada sub-vista puede override header/KPIs/actions/crumb
// ═════════════════════════════════════════════════════════════════════════

/**
 * Config que cada sub-vista declara al montarse vía `setSubVistaConfig`.
 * Si una sub-vista NO declara override · usa el default del shell.
 * El shell auto-resetea config a null cuando cambia `location.pathname`
 * para evitar config stale entre sub-rutas.
 *
 * Descubrimiento chk5.D-S3.SF1: cada mockup de sub-vista (MOCK 7/8/9)
 * muestra header banking-grade propio + KPI strip específico distinto al
 * shell global del MOCK 1. Esto requiere shell adaptativo, no estático.
 */
export interface SubVistaConfig {
  /** Override breadcrumb leaf · default 'Finanzas' */
  breadcrumbLeaf?: string;
  /** Override header banking-grade · default: Landmark teal + "Finanzas" */
  header?: {
    title: string;
    subtitle: string;
    icon: LucideIcon;
    /** Color del gradient del icon wrapper · canon N1 */
    iconColor: 'teal' | 'slate' | 'indigo' | 'purple' | 'emerald' | 'amber';
  };
  /**
   * Override KPI strip + mini-stats · default: KpiStripFinanzas con 5 KPIs
   * generales del módulo. Sub-vista puede pasar su propio React node con
   * KPIs específicos (ej. Movimientos: Movs del mes · Ingresos · Egresos
   * · Flujo neto · Pendientes conciliación).
   */
  kpiSlot?: React.ReactNode;
  /**
   * Override actions del header derecho · default: Exportar · Configurar TC
   * · + Nuevo movimiento. Sub-vista puede pasar sus propios botones.
   * El dropdown "+ Nuevo movimiento" SE PRESERVA automáticamente al final
   * para mantener consistencia · si la sub-vista NO lo quiere debe pasar
   * actionsReplaceAll=true.
   */
  actions?: React.ReactNode;
  /** Si true · reemplaza COMPLETAMENTE las actions (incluyendo dropdown) */
  actionsReplaceAll?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════
// OUTLET CONTEXT · expone data + setSubVistaConfig a las sub-vistas
// ═════════════════════════════════════════════════════════════════════════

export interface FinanzasShellContext {
  /** Data ya cargada por el shell · sub-vistas pueden reusar sin refetch */
  kpiData: KpiStripFinanzasData | null;
  miniStats: MiniStatsFooterData | null;
  cuentas: CuentaCaja[];
  resumenCC: SaldosResumen | null;
  movimientosMes: MovimientoTesoreria[];
  loading: boolean;
  /** Permite a la sub-vista disparar acción del dropdown · ej. Overview banner GK */
  onSeleccionarAccion: (accion: AccionNuevoMovimiento) => void;
  /**
   * Sub-vista declara su config (header · KPIs · actions · breadcrumb).
   * Llamar dentro de useEffect con array de deps estables.
   * Reset automático al cambiar de sub-ruta.
   */
  setSubVistaConfig: (config: SubVistaConfig | null) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// MAPS canon · gradient del icon banking-grade por color (Tailwind static)
// ═════════════════════════════════════════════════════════════════════════

const ICON_GRADIENT: Record<NonNullable<SubVistaConfig['header']>['iconColor'], string> = {
  teal: 'bg-gradient-to-br from-teal-500 to-teal-700 ring-2 ring-teal-100',
  slate: 'bg-gradient-to-br from-slate-500 to-slate-700 ring-2 ring-slate-100',
  indigo: 'bg-gradient-to-br from-indigo-500 to-indigo-700 ring-2 ring-indigo-100',
  purple: 'bg-gradient-to-br from-purple-500 to-purple-700 ring-2 ring-purple-100',
  emerald: 'bg-gradient-to-br from-emerald-500 to-emerald-700 ring-2 ring-emerald-100',
  amber: 'bg-gradient-to-br from-amber-500 to-amber-700 ring-2 ring-amber-100',
};

const DEFAULT_HEADER = {
  title: 'Finanzas',
  subtitle:
    'Caja viva · cuentas corrientes · proyección de flujo · y análisis estratégico del negocio en un solo módulo.',
  icon: Landmark,
  iconColor: 'teal' as const,
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE SHELL
// ═════════════════════════════════════════════════════════════════════════

const FinanzasLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // ─── Sub-vista config · override-able por cada hijo del Outlet ───────
  const [subVistaConfig, setSubVistaConfig] = useState<SubVistaConfig | null>(null);

  // ─── Wizard activo · wire-up directo del dropdown · chk5.D-S4.a.SF5 ──
  const [wizardAbierto, setWizardAbierto] = useState<AccionNuevoMovimiento | null>(null);

  // Reset config al cambiar de sub-ruta (evita config stale de la vista anterior)
  useEffect(() => {
    setSubVistaConfig(null);
  }, [location.pathname]);

  // ─── Fetch data compartida del shell ──────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [resumenCC, setResumenCC] = useState<SaldosResumen | null>(null);
  const [cuentas, setCuentas] = useState<CuentaCaja[]>([]);
  const [movimientosMes, setMovimientosMes] = useState<MovimientoTesoreria[]>([]);
  // chk5.D-S6.SF2 · data adicional para KPIs reales (CCs · movs mes anterior · TCs · recaudadoras)
  const [ccs, setCCs] = useState<CuentaCorriente[]>([]);
  const [movimientosMesAnterior, setMovimientosMesAnterior] = useState<MovimientoTesoreria[]>([]);
  const [tarjetas, setTarjetas] = useState<TarjetaCredito[]>([]);
  const [recaudadorasSaldoPendiente, setRecaudadorasSaldoPendiente] = useState(0);
  const [poolUSDData, setPoolUSDData] = useState<{
    tcpa: number;
    totalUSD: number;
    cuentasCount: number;
  }>({ tcpa: 0, totalUSD: 0, cuentasCount: 0 });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    inicioMes.setHours(0, 0, 0, 0);
    const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const finMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth(), 0, 23, 59, 59, 999);

    Promise.all([
      cuentaCorrienteService.getResumen(),
      cuentaCorrienteService.getAll(),
      getCuentas(),
      getMovimientos({ fechaInicio: inicioMes }),
      getMovimientos({ fechaInicio: inicioMesAnterior, fechaFin: finMesAnterior }),
      tarjetaCreditoService.getAll(),
      getProductosFinancierosActivos(),
      poolUSDViewService.calcularTCPA().catch(() => ({
        tcpa: 0,
        totalUSDComprado: 0,
        totalPENGastado: 0,
        movimientosCount: 0,
      })),
      poolUSDViewService.getSaldoUSD().catch(() => ({
        totalUSD: 0,
        cuentas: [] as Array<{ id: string; nombre: string; saldo: number }>,
      })),
    ])
      .then(async ([r, ccsList, cs, ms, msAnt, tcs, prodsFin, tcpaResult, saldoUSDResult]) => {
        if (cancelled) return;
        setResumenCC(r);
        setCCs(ccsList);
        setCuentas(cs);
        setMovimientosMes(ms);
        setMovimientosMesAnterior(msAnt);
        setTarjetas(tcs);
        setPoolUSDData({
          tcpa: tcpaResult.tcpa,
          totalUSD: saldoUSDResult.totalUSD,
          cuentasCount: saldoUSDResult.cuentas.length,
        });

        // Calcular saldo pendiente recaudadoras (S6.SF3)
        const recList = prodsFin.filter((p) => p.tipoProducto === 'caja_recaudadora');
        let totalPendienteRecaudadoras = 0;
        await Promise.all(
          recList.map(async (rec) => {
            if (!rec.id) return;
            try {
              const balance = await cajaRecaudadoraService.calcularBalanceMes(
                rec.id,
                inicioMes,
                ahora,
              );
              totalPendienteRecaudadoras += balance.pendienteLiquidar;
            } catch {
              // ignore individual errors
            }
          }),
        );
        if (!cancelled) setRecaudadorasSaldoPendiente(totalPendienteRecaudadoras);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Derivar KPI data canon MOCK 1 · chk5.D-S6.SF2+SF3 (real · no hardcoded) ──
  const kpiData = useMemo<KpiStripFinanzasData | null>(() => {
    if (loading) return null;

    let saldoPEN = 0;
    let saldoUSD = 0;
    for (const c of cuentas) {
      if (!c.activa) continue;
      if (c.esBiMoneda) {
        saldoPEN += c.saldoPEN || 0;
        saldoUSD += c.saldoUSD || 0;
      } else if (c.moneda === 'PEN') saldoPEN += c.saldoActual || 0;
      else saldoUSD += c.saldoActual || 0;
    }
    // Patrimonio total · equivalente PEN aproximado (USD * TCPA)
    const patrimonioTotalPEN = saldoPEN + saldoUSD * (poolUSDData.tcpa || 0);

    // ─── Flujo del mes actual ────────────────────────────────────────
    let ingreso = 0;
    let egreso = 0;
    for (const m of movimientosMes) {
      if (m.estado === 'anulado') continue;
      const equiv = m.montoEquivalentePEN || 0;
      if (TIPOS_INGRESO.includes(m.tipo)) ingreso += equiv;
      else if (TIPOS_EGRESO.includes(m.tipo)) egreso += equiv;
    }
    const flujoNetoMesPEN = ingreso - egreso;

    // ─── Flujo del mes anterior (S6.SF2) ─────────────────────────────
    let ingresoPrev = 0;
    let egresoPrev = 0;
    for (const m of movimientosMesAnterior) {
      if (m.estado === 'anulado') continue;
      const equiv = m.montoEquivalentePEN || 0;
      if (TIPOS_INGRESO.includes(m.tipo)) ingresoPrev += equiv;
      else if (TIPOS_EGRESO.includes(m.tipo)) egresoPrev += equiv;
    }
    const flujoMesAnteriorPEN = ingresoPrev - egresoPrev;
    // patrimonioDeltaMes · heurística: flujo neto del mes (cuánto creció caja vs entrada de mes)
    const patrimonioDeltaMes = flujoNetoMesPEN;

    // ─── Counts CC (S6.SF2) ──────────────────────────────────────────
    let porCobrarClientesCount = 0;
    let porPagarVencen7dCount = 0;
    const hoy = Date.now();
    const en7d = hoy + 7 * 24 * 60 * 60 * 1000;
    for (const cc of ccs) {
      const pen = cc.saldoPEN || 0;
      const usd = cc.saldoUSD || 0;
      if (cc.tipo === 'cliente' && (pen > 0.01 || usd > 0.01)) {
        porCobrarClientesCount++;
      }
      if (cc.tipo === 'proveedor' && (pen < -0.01 || usd < -0.01)) {
        // Heurística vencimiento · fechaUltimoMov + 30d
        if (cc.fechaUltimoMovimiento) {
          const fechaVenc = cc.fechaUltimoMovimiento.toMillis() + 30 * 24 * 60 * 60 * 1000;
          if (fechaVenc >= hoy && fechaVenc <= en7d) {
            porPagarVencen7dCount++;
          }
        }
      }
    }

    // ─── DSO/DPO ponderados (S6.SF3) ─────────────────────────────────
    let dsoPond = 0;
    let dsoPesos = 0;
    let dpoPond = 0;
    let dpoPesos = 0;
    for (const cc of ccs) {
      const magnitud = Math.abs(cc.saldoPEN || 0) + Math.abs(cc.saldoUSD || 0);
      if (magnitud < 0.01 || !cc.fechaUltimoMovimiento) continue;
      const dias = Math.floor((hoy - cc.fechaUltimoMovimiento.toMillis()) / (1000 * 60 * 60 * 24));
      if (cc.tipo === 'cliente' && (cc.saldoPEN > 0 || cc.saldoUSD > 0)) {
        dsoPond += magnitud * dias;
        dsoPesos += magnitud;
      } else if (cc.tipo === 'proveedor' && (cc.saldoPEN < 0 || cc.saldoUSD < 0)) {
        dpoPond += magnitud * dias;
        dpoPesos += magnitud;
      }
    }
    const dsoDias = dsoPesos > 0 ? Math.round(dsoPond / dsoPesos) : 0;
    const dpoDias = dpoPesos > 0 ? Math.round(dpoPond / dpoPesos) : 0;

    return {
      patrimonioTotalPEN,
      patrimonioDeltaMes,
      porCobrarPEN: resumenCC?.totalDebenAEmpresa.PEN ?? 0,
      porCobrarClientesCount,
      porPagarPEN: resumenCC?.totalEmpresaDebe.PEN ?? 0,
      porPagarVencen7dCount,
      flujoNetoMesPEN,
      flujoMesAnteriorPEN,
      dsoDias,
      dpoDias,
    };
  }, [loading, cuentas, movimientosMes, movimientosMesAnterior, ccs, resumenCC, poolUSDData.tcpa]);

  const miniStats = useMemo<MiniStatsFooterData | null>(() => {
    if (loading) return null;

    // TC ciclo cerrado · saldos absolutos de TCs activas con día de pago ≤ próximos 7d
    // Heurística: TC se considera "ciclo cerrado" cuando hay pago próximo a vencer.
    // El cálculo "real" requiere CC espejo de cada TC · DEUDA-S6-CC-ESPEJO-TC documentada.
    // Aproximación: suma de saldos legacy saldoActualUSD de tarjetas con próximo pago dentro 7d.
    const hoyDate = new Date();
    let tcCicloCerradoPEN = 0;
    for (const tc of tarjetas) {
      if (!tc.activa || !tc.diaPago) continue;
      const proxFecha = new Date(hoyDate);
      proxFecha.setDate(tc.diaPago);
      if (proxFecha < hoyDate) proxFecha.setMonth(proxFecha.getMonth() + 1);
      const diasHasta = Math.floor(
        (proxFecha.getTime() - hoyDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diasHasta <= 7) {
        const saldoUSD = Math.abs(tc.saldoActualUSD ?? 0);
        tcCicloCerradoPEN += saldoUSD * (poolUSDData.tcpa || 0);
      }
    }

    return {
      poolUSD: poolUSDData.totalUSD,
      poolUSDCuentasCount: poolUSDData.cuentasCount,
      tcpa: poolUSDData.tcpa,
      tcCicloCerradoPEN,
      recaudadoraPendientePEN: recaudadorasSaldoPendiente,
    };
  }, [loading, poolUSDData, tarjetas, recaudadorasSaldoPendiente]);

  // ─── Handlers dropdown nuevo movimiento ───────────────────────────────
  const handleSeleccionarAccion = useCallback(
    (accion: AccionNuevoMovimiento) => {
      // chk5.D-S4.a.SF5 · wire-up directo · cero salidas a /tesoreria
      // Cada acción abre el wizard/modal correspondiente como overlay sobre el shell.
      setWizardAbierto(accion);
    },
    [],
  );

  const handleCerrarWizard = useCallback(() => {
    setWizardAbierto(null);
  }, []);

  const handleSuccessWizard = useCallback(() => {
    setWizardAbierto(null);
    // TODO chk5.D-S4.b · refresh data del shell tras submit exitoso
  }, []);

  const handleExportar = useCallback(() => {
    navigate('/reportes');
  }, [navigate]);

  const handleConfigurarTC = useCallback(() => {
    navigate('/tipo-cambio');
  }, [navigate]);

  // ─── Outlet context ───────────────────────────────────────────────────
  const outletContext = useMemo<FinanzasShellContext>(
    () => ({
      kpiData,
      miniStats,
      cuentas,
      resumenCC,
      movimientosMes,
      loading,
      onSeleccionarAccion: handleSeleccionarAccion,
      setSubVistaConfig,
    }),
    [kpiData, miniStats, cuentas, resumenCC, movimientosMes, loading, handleSeleccionarAccion],
  );

  // ─── Resolver header/breadcrumb/actions/KPI con override de sub-vista ─
  const headerCfg = subVistaConfig?.header ?? DEFAULT_HEADER;
  const HeaderIcon = headerCfg.icon;
  const breadcrumbLeaf = subVistaConfig?.breadcrumbLeaf ?? 'Finanzas';
  const showDefaultKpi = !subVistaConfig?.kpiSlot;
  const showDefaultActions = !subVistaConfig?.actions;

  return (
    <PageShell>
      {/* Shell frame · borde + sombra · contiene todo el módulo Finanzas */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* §A · TOP BAR breadcrumb + utility · canon chk5.D-S9.D1 (2026-05-18)
              Canon breadcrumb consistente · 3 niveles sin grupo sidebar:
                Overview      → Inicio › Finanzas
                Sub-vistas    → Inicio › Finanzas › <leaf>
              Razón: el grupo "Finanzas y Contabilidad" ya está visible siempre
              en el sidebar izquierdo · no aporta repetirlo en breadcrumb +
              evita rutas largas tipo "Inicio › Finanzas y Contabilidad › Finanzas".
              Patrón a replicar en Compras/Ventas/Envíos/Gastos cuando agreguen breadcrumb. */}
        <div className="border-b border-slate-200 px-6 py-2.5 flex items-center gap-3 bg-slate-50">
          <div className="flex items-center text-[12px] flex-1">
            <a className="text-slate-500 hover:text-teal-700 cursor-pointer">Inicio</a>
            <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5" />
            {subVistaConfig?.breadcrumbLeaf ? (
              <>
                <a
                  className="text-slate-500 hover:text-teal-700 cursor-pointer"
                  onClick={() => navigate('/finanzas')}
                >
                  Finanzas
                </a>
                <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5" />
                <span className="text-slate-900 font-semibold">{breadcrumbLeaf}</span>
              </>
            ) : (
              <span className="text-slate-900 font-semibold">Finanzas</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="hover:bg-slate-100 text-slate-600 text-[11px] px-2 py-1 rounded inline-flex items-center gap-1"
              aria-label="Atajo teclado"
            >
              <Keyboard className="w-3 h-3" />
              <span className="text-[10px] font-mono">⌘K</span>
            </button>
            <button
              type="button"
              className="relative hover:bg-slate-100 p-1.5 rounded"
              aria-label="Notificaciones"
            >
              <Bell className="w-3.5 h-3.5 text-slate-500" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full" />
            </button>
          </div>
        </div>

        {/* §B · HEADER BANKING-GRADE · icon + title + actions · N10 + adaptativo SF1 */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 flex-1 min-w-[260px]">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0 ${
                  ICON_GRADIENT[headerCfg.iconColor]
                }`}
              >
                <HeaderIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {headerCfg.title}
                </h1>
                <p className="text-[13px] text-slate-500 leading-snug">
                  {headerCfg.subtitle}
                </p>
              </div>
            </div>
            {/* N10 · 3-tier action hierarchy · sub-vista puede override total o parcial.
                  chk5.D-S8.SF3.D8 · sin flex-shrink-0 + flex-wrap + justify-end · evita
                  que en mobile (<sm) la fila de 3 botones se salga del viewport. */}
            <div className="flex items-center gap-2 flex-wrap justify-end max-w-full">
              {subVistaConfig?.actions}
              {(showDefaultActions || !subVistaConfig?.actionsReplaceAll) && (
                <>
                  {showDefaultActions && (
                    <>
                      <button
                        type="button"
                        onClick={handleExportar}
                        aria-label="Exportar"
                        title="Exportar"
                        className="text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                      >
                        <Download className="w-3 h-3" />
                        <span className="hidden sm:inline">Exportar</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleConfigurarTC}
                        aria-label="Configurar TC"
                        title="Configurar tipo de cambio"
                        className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                      >
                        <Settings2 className="w-3 h-3" />
                        <span className="hidden sm:inline">Configurar TC</span>
                      </button>
                    </>
                  )}
                  <DropdownNuevoMovimiento onSeleccionar={handleSeleccionarAccion} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* §C · KPI STRIP + MINI-STATS · canon v8.0 N1+N2+N3 · adaptativo SF1 */}
        {subVistaConfig?.kpiSlot ? (
          // Override · sub-vista pasa su propio KPI strip (ej. Movimientos ledger)
          subVistaConfig.kpiSlot
        ) : kpiData && miniStats ? (
          <KpiStripFinanzas data={kpiData} miniStats={miniStats} loading={false} />
        ) : (
          <KpiStripFinanzas
            data={{
              patrimonioTotalPEN: 0,
              patrimonioDeltaMes: 0,
              porCobrarPEN: 0,
              porCobrarClientesCount: 0,
              porPagarPEN: 0,
              porPagarVencen7dCount: 0,
              flujoNetoMesPEN: 0,
              flujoMesAnteriorPEN: 0,
              dsoDias: 0,
              dpoDias: 0,
            }}
            loading={true}
          />
        )}

        {/* §D · TABS 6 sub-rutas · canon mockup §2 · scroll-x mobile (N6)
              chk5.D-S8.SF3.D11 · extraido a <SubVistaTabs> con chevron buttons
              que aparecen solo cuando hay overflow + auto-scroll del tab activo */}
        <SubVistaTabs />

        {/* §E · OUTLET · cuerpo de la sub-vista activa */}
        <div className="bg-slate-50/30">
          <Outlet context={outletContext} />
        </div>
      </div>

      {/* §F · WIZARDS · wire-up directo del dropdown (chk5.D-S4.a.SF5) */}
      {/* A.1 · Ingreso simple */}
      <IngresoSimpleModal
        isOpen={wizardAbierto === 'ingreso_simple'}
        onClose={handleCerrarWizard}
        cuentas={cuentas}
        onSuccess={handleSuccessWizard}
      />
      {/* A.2 · Egreso simple */}
      <EgresoSimpleModal
        isOpen={wizardAbierto === 'egreso_simple'}
        onClose={handleCerrarWizard}
        cuentas={cuentas}
        onSuccess={handleSuccessWizard}
      />
      {/* A.3 · Conversión USD ↔ PEN */}
      {wizardAbierto === 'conversion_usd_pen' && (
        <ConversionTransferenciaWizard
          isOpen={true}
          onClose={handleCerrarWizard}
          onSuccess={handleSuccessWizard}
          varianteInicial="conversion"
        />
      )}
      {/* A.4 · Transferencia interna */}
      {wizardAbierto === 'transferencia_interna' && (
        <ConversionTransferenciaWizard
          isOpen={true}
          onClose={handleCerrarWizard}
          onSuccess={handleSuccessWizard}
          varianteInicial="transferencia"
        />
      )}
      {/* B.1 · PagoAbono distribuido (cobrar/pagar a entidad CC) */}
      <PagoAbonoWizard
        isOpen={wizardAbierto === 'cobrar_distribuido'}
        onClose={handleCerrarWizard}
        onSuccess={handleSuccessWizard}
      />
      {/* B.2 · Pagar estado de cuenta TC */}
      <PagarEstadoCuentaWizard
        isOpen={wizardAbierto === 'pagar_tc'}
        onClose={handleCerrarWizard}
        onSuccess={handleSuccessWizard}
      />
      {/* B.3 · Pagos masivos batch */}
      {wizardAbierto === 'pagos_masivos' && (
        <PagosMasivosWizard
          isOpen={true}
          onClose={handleCerrarWizard}
          onSuccess={handleSuccessWizard}
        />
      )}
      {/* B.4 · Liquidar caja recaudadora (canon S1f) */}
      <LiquidarRecaudadoraWizard
        isOpen={wizardAbierto === 'liquidar_recaudadora'}
        onClose={handleCerrarWizard}
        onSuccess={handleSuccessWizard}
      />
    </PageShell>
  );
};

export default FinanzasLayout;

// ═════════════════════════════════════════════════════════════════════════
// HOOK CONVENIENCIA · usa esto desde las sub-vistas hijo
// ═════════════════════════════════════════════════════════════════════════

import { useOutletContext } from 'react-router-dom';

/**
 * Hook que expone el FinanzasShellContext a sub-vistas hijo.
 * Usar dentro de Finanzas.tsx · FinanzasSaldos.tsx · FinanzasCashFlow.tsx
 * para reusar la data ya cargada por el shell sin refetch.
 *
 * @example
 *   const { kpiData, cuentas, onSeleccionarAccion } = useFinanzasShellContext();
 */
export function useFinanzasShellContext(): FinanzasShellContext {
  return useOutletContext<FinanzasShellContext>();
}
