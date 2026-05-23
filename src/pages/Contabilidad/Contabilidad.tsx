/**
 * Página de Contabilidad
 * Vista completa con pestañas: Resumen, Balance General, Estado de Resultados, Indicadores, Tendencias, Cierre
 */

import { useState, useEffect, useRef, useCallback, type ComponentType } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  BarChart3,
  Calendar,
  RefreshCw,
  Wallet,
  PiggyBank,
  AlertTriangle,
  Target,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  LineChart,
  LayoutDashboard,
  Calculator,
  CircleDollarSign,
  Scale,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Loader2,
  Lock,
  // chk5.E-S1 · canon banking-grade
  ChevronRight,
  ChevronLeft,
  Download,
  Settings2,
  CreditCard,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  StatDistribution,
} from '../../components/common';
import { DataTable } from '../../design-system';
import type { DataTableColumn } from '../../design-system';
import { EstadoResultados, BalanceGeneral, CierreMensual } from '../../components/modules/contabilidad';
import { ReporteDirectoIndirecto } from '../../components/modules/contabilidad/ReporteDirectoIndirecto';
import { contabilidadService } from '../../services/contabilidad.service';
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';
import type {
  EstadoResultados as EstadoResultadosType,
  ResumenContable,
  TendenciaMensual,
  BalanceGeneral as BalanceGeneralType,
  IndicadoresFinancieros,
  AnalisisFinanciero,
} from '../../types/contabilidad.types';
import { formatCurrencyPEN, formatPercent } from '../../utils/format';

type TabActiva = 'resumen' | 'balance' | 'estado-resultados' | 'indicadores' | 'tendencias' | 'cierre';

// Alias local para mantener llamadas existentes sin alterar (PEN, 0 decimales no soportado
// en format.ts — se usa formatCurrencyPEN que produce 2 decimales; la diferencia visual
// es mínima y unifica el comportamiento).
const formatCurrency = formatCurrencyPEN;

// Color según estado del análisis
const getEstadoColor = (estado: AnalisisFinanciero['estado']) => {
  switch (estado) {
    case 'excelente': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'bueno': return 'bg-sky-100 text-sky-800 border-sky-300';
    case 'regular': return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'malo': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'critico': return 'bg-red-100 text-red-800 border-red-300';
    default: return 'bg-slate-100 text-slate-800 border-slate-300';
  }
};

const getEstadoIcon = (estado: AnalisisFinanciero['estado']) => {
  switch (estado) {
    case 'excelente':
    case 'bueno':
      return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    case 'regular':
      return <AlertCircle className="w-5 h-5 text-amber-600" />;
    case 'malo':
    case 'critico':
      return <XCircle className="w-5 h-5 text-red-600" />;
    default:
      return <Info className="w-5 h-5 text-slate-600" />;
  }
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES CANON · chk5.E-S1 · pixel-perfect Finanzas
// ═════════════════════════════════════════════════════════════════════════

type KpiColor = 'emerald' | 'teal' | 'rose' | 'indigo' | 'amber';

interface KpiContaCardProps {
  label: string;
  value: string;
  color: KpiColor;
  icon: LucideIcon;
  delta?: string;
  deltaPositive?: boolean;
}

const KPI_CARD_BG: Record<KpiColor, string> = {
  emerald: 'bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50',
  teal: 'bg-gradient-to-br from-teal-50 to-teal-100/40 ring-1 ring-teal-200/50',
  rose: 'bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50',
  indigo: 'bg-gradient-to-br from-indigo-50 to-indigo-100/40 ring-1 ring-indigo-200/50',
  amber: 'bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50',
};

const KPI_LABEL_COLOR: Record<KpiColor, string> = {
  emerald: 'text-emerald-700',
  teal: 'text-teal-700',
  rose: 'text-rose-700',
  indigo: 'text-indigo-700',
  amber: 'text-amber-700',
};

const KPI_VALUE_COLOR: Record<KpiColor, string> = {
  emerald: 'text-emerald-900',
  teal: 'text-teal-900',
  rose: 'text-rose-900',
  indigo: 'text-indigo-900',
  amber: 'text-amber-900',
};

const KpiContaCard: React.FC<KpiContaCardProps> = ({
  label, value, color, icon: Icon, delta, deltaPositive,
}) => (
  <div className={`rounded-2xl p-4 ${KPI_CARD_BG[color]}`}>
    <div className="flex items-center justify-between mb-2">
      <span className={`text-[10px] uppercase tracking-wider font-bold ${KPI_LABEL_COLOR[color]}`}>
        {label}
      </span>
      <Icon className={`w-3.5 h-3.5 ${KPI_LABEL_COLOR[color]}`} />
    </div>
    <div className={`text-2xl font-bold tabular-nums ${KPI_VALUE_COLOR[color]}`}>
      {value}
    </div>
    {delta && (
      <div className={`text-[11px] mt-1 flex items-center gap-1 ${
        deltaPositive === undefined ? KPI_LABEL_COLOR[color]
        : deltaPositive ? 'text-emerald-700'
        : 'text-rose-700'
      }`}>
        {delta}
      </div>
    )}
  </div>
);

interface ContaTabConfig {
  id: string;
  label: string;
  mobileLabel?: string;
  icon: LucideIcon;
}

interface SubVistaTabsContabilidadProps {
  tabs: ContaTabConfig[];
  activeId: string;
  onTabChange: (id: string) => void;
}

const SubVistaTabsContabilidad: React.FC<SubVistaTabsContabilidadProps> = ({
  tabs, activeId, onTabChange,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const slack = 2;
    setCanScrollLeft(el.scrollLeft > slack);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - slack);
  }, []);

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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('button[aria-current="page"]');
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    const t = window.setTimeout(updateScrollState, 350);
    return () => window.clearTimeout(t);
  }, [activeId, updateScrollState]);

  const scrollBy = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.6, behavior: 'smooth' });
  }, []);

  return (
    <div className="relative border-b border-slate-200">
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
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={
                  'px-4 py-3 text-[12px] border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ' +
                  (isActive
                    ? 'border-purple-600 text-purple-700 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 font-medium')
                }
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
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
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════

export function Contabilidad() {
  const lineaFiltroGlobal = useLineaNegocioStore(state => state.lineaFiltroGlobal);
  const [tabActiva, setTabActiva] = useState<TabActiva>('resumen');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState<ResumenContable | null>(null);
  const [estado, setEstado] = useState<EstadoResultadosType | null>(null);
  const [tendencia, setTendencia] = useState<TendenciaMensual[]>([]);
  const [mesAnterior, setMesAnterior] = useState<ResumenContable | null>(null);
  const [balance, setBalance] = useState<BalanceGeneralType | null>(null);
  const [indicadores, setIndicadores] = useState<IndicadoresFinancieros | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisFinanciero[]>([]);

  const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Cargar datos
  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [estadoData, tendenciaData, balanceData, indicadoresData] = await Promise.all([
        contabilidadService.generarEstadoResultados(mes, anio, lineaFiltroGlobal),
        contabilidadService.getTendenciaMensual(anio, lineaFiltroGlobal),
        contabilidadService.generarBalanceGeneral(mes, anio),
        contabilidadService.calcularIndicadoresFinancieros(mes, anio, lineaFiltroGlobal),
      ]);

      setEstado(estadoData);
      setTendencia(tendenciaData);
      setBalance(balanceData);
      setIndicadores(indicadoresData);
      setAnalisis(contabilidadService.generarAnalisisFinanciero(indicadoresData));

      // Crear resumen desde estado
      setResumen({
        periodo: estadoData.periodo,
        ventasNetas: estadoData.ventasNetas,
        compras: estadoData.compras.total,
        utilidadBruta: estadoData.utilidadBruta,
        gastosOperativos: estadoData.totalGastosOperativos,
        utilidadNeta: estadoData.utilidadNeta,
        margenNeto: estadoData.utilidadNetaPorcentaje,
        tendencia: estadoData.utilidadNeta >= 0 ? 'subiendo' : 'bajando',
      });

      // Cargar mes anterior para comparación
      const mesAnt = mes === 1 ? 12 : mes - 1;
      const anioAnt = mes === 1 ? anio - 1 : anio;
      try {
        const resumenAnt = await contabilidadService.getResumenContable(mesAnt, anioAnt, lineaFiltroGlobal);
        setMesAnterior(resumenAnt);
      } catch {
        setMesAnterior(null);
      }
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [mes, anio, lineaFiltroGlobal]);

  // Calcular variaciones vs mes anterior
  const calcularVariacion = (actual: number, anterior: number | undefined): number | null => {
    if (!anterior || anterior === 0) return null;
    return ((actual - anterior) / Math.abs(anterior)) * 100;
  };

  const varVentas = calcularVariacion(resumen?.ventasNetas || 0, mesAnterior?.ventasNetas);
  const varUtilidadNeta = calcularVariacion(resumen?.utilidadNeta || 0, mesAnterior?.utilidadNeta);
  const varCompras = calcularVariacion(resumen?.compras || 0, mesAnterior?.compras);

  // Tabs
  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { id: 'balance', label: 'Balance General', mobileLabel: 'Balance', icon: Scale },
    { id: 'estado-resultados', label: 'Estado de Resultados', mobileLabel: 'Resultados', icon: FileText },
    { id: 'indicadores', label: 'Indicadores', mobileLabel: 'KPIs', icon: Activity },
    { id: 'tendencias', label: 'Tendencias', icon: LineChart },
    { id: 'cierre', label: 'Cierre Mensual', mobileLabel: 'Cierre', icon: Lock },
  ];

  // Años disponibles
  const aniosDisponibles = [];
  const anioActual = new Date().getFullYear();
  for (let a = 2024; a <= anioActual; a++) {
    aniosDisponibles.push(a);
  }

  // Encontrar mejor y peor mes
  const mejorMes = tendencia.reduce((best, curr) =>
    curr.utilidadNeta > (best?.utilidadNeta || -Infinity) ? curr : best, tendencia[0]);
  const peorMes = tendencia.reduce((worst, curr) =>
    curr.utilidadNeta < (worst?.utilidadNeta || Infinity) ? curr : worst, tendencia[0]);

  // Acumulado del año
  const acumuladoVentas = tendencia.reduce((sum, m) => sum + m.ventasNetas, 0);
  const acumuladoCompras = tendencia.reduce((sum, m) => sum + m.compras, 0);
  const acumuladoUtilidadNeta = tendencia.reduce((sum, m) => sum + m.utilidadNeta, 0);
  const promedioMensual = tendencia.length > 0 ? acumuladoUtilidadNeta / tendencia.length : 0;

  return (
    <div className="p-4 lg:p-6">
      {/* Shell frame banking-grade · canon F1+S9.D1 · pixel-perfect Finanzas */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

        {/* §A · TOP BAR breadcrumb canon S9.D1 (3 niveles · sin grupo sidebar) */}
        <div className="border-b border-slate-200 px-6 py-2.5 flex items-center gap-3 bg-slate-50">
          <div className="flex items-center text-[12px] flex-1">
            <a className="text-slate-500 hover:text-teal-700 cursor-pointer">Inicio</a>
            <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5" />
            <span className="text-slate-900 font-semibold">Contabilidad</span>
          </div>
        </div>

        {/* §B · HEADER BANKING-GRADE · icon purple gradient + h1 + subtitle + 3-tier actions canon N10 */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 flex-1 min-w-[260px]">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white flex-shrink-0">
                <Calculator className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Contabilidad
                </h1>
                <p className="text-[13px] text-slate-500 leading-snug">
                  Estados financieros formales · Balance General · P&L · ratios e indicadores · cierre mensual
                </p>
              </div>
            </div>
            {/* canon S8.D8+D10 · flex-wrap + max-w-full + icon-only mobile */}
            <div className="flex items-center gap-2 flex-wrap justify-end max-w-full">
              {/* Selector período · compacto */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                <select
                  value={mes}
                  onChange={(e) => setMes(Number(e.target.value))}
                  className="border-none bg-transparent text-[12px] font-medium text-slate-700 focus:ring-0 focus:outline-none cursor-pointer"
                >
                  {MESES.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select
                  value={anio}
                  onChange={(e) => setAnio(Number(e.target.value))}
                  className="border-none bg-transparent text-[12px] font-medium text-slate-700 focus:ring-0 focus:outline-none cursor-pointer"
                >
                  {aniosDisponibles.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              {/* Tier neutral · Recargar */}
              <button
                type="button"
                onClick={cargarDatos}
                disabled={loading}
                aria-label="Recargar datos contables"
                title="Recargar datos contables"
                className="text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Recargar</span>
              </button>
              {/* Tier destacada · Exportar */}
              <button
                type="button"
                onClick={() => console.info('Exportar Contabilidad · pendiente chk5.E-S2')}
                aria-label="Exportar reporte contable"
                title="Exportar reporte contable a PDF/Excel"
                className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">Exportar</span>
              </button>
            </div>
          </div>
        </div>

        {/* §C · KPI STRIP canon N1+N2 · 5 KPIs color semántico + gradient + ring */}
        {estado && balance && (
          <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiContaCard
              label="VENTAS NETAS"
              value={formatCurrency(estado.ventasNetas)}
              color="emerald"
              icon={DollarSign}
              delta={varVentas !== null ? `${varVentas >= 0 ? '+' : ''}${varVentas.toFixed(1)}% vs mes ant.` : undefined}
              deltaPositive={varVentas !== null ? varVentas >= 0 : undefined}
            />
            <KpiContaCard
              label="TOTAL ACTIVOS"
              value={formatCurrency(balance.activos.totalActivos)}
              color="teal"
              icon={Wallet}
            />
            <KpiContaCard
              label="TOTAL PASIVOS"
              value={formatCurrency(balance.pasivos.totalPasivos)}
              color="rose"
              icon={CreditCard}
            />
            <KpiContaCard
              label="PATRIMONIO"
              value={formatCurrency(balance.patrimonio.totalPatrimonio)}
              color="indigo"
              icon={PiggyBank}
            />
            <KpiContaCard
              label="UTILIDAD NETA"
              value={formatCurrency(estado.utilidadNeta)}
              color="amber"
              icon={estado.utilidadNeta >= 0 ? TrendingUp : TrendingDown}
              delta={varUtilidadNeta !== null ? `${varUtilidadNeta >= 0 ? '+' : ''}${varUtilidadNeta.toFixed(1)}% vs mes ant.` : undefined}
              deltaPositive={varUtilidadNeta !== null ? varUtilidadNeta >= 0 : undefined}
            />
          </div>
        )}

        {/* §D · Sub-vista TABS canon S9.D11 con chevron buttons (adaptado a tabs internos) */}
        <SubVistaTabsContabilidad
          tabs={tabs}
          activeId={tabActiva}
          onTabChange={(id) => setTabActiva(id as TabActiva)}
        />

        {/* §E · BODY · contenido según tab activo */}
        <div className="p-6 bg-slate-50/30">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        )}

      {/* RESUMEN · KPIs ya viven en el §C shell · acá solo banners + distribuciones + indicadores */}
      {!loading && tabActiva === 'resumen' && estado && balance && (
        <div className="space-y-6">
          {/* Alerta + secciones secundarias */}
          <div>
            {/* Alerta de Anticipos Pendientes */}
            {balance.pasivos.corriente.anticiposClientes &&
             balance.pasivos.corriente.anticiposClientes.totalAnticiposPEN > 0 && (
              <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg shrink-0">
                    <CircleDollarSign className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-purple-800 text-sm sm:text-base">
                      Anticipos Pendientes (Pasivo)
                    </div>
                    <div className="text-xs sm:text-sm text-purple-600">
                      {balance.pasivos.corriente.anticiposClientes.cantidadVentas} ventas con anticipo sin entregar — Ingreso diferido
                    </div>
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-purple-700 sm:text-right pl-12 sm:pl-0">
                  {formatCurrency(balance.pasivos.corriente.anticiposClientes.totalAnticiposPEN)}
                </div>
              </div>
            )}
          </div>

          {/* Distribución */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatDistribution
              title="Composición de Activos"
              valueFormat="currency"
              data={[
                { label: 'Efectivo', value: balance.activos.corriente.efectivo.total, color: 'bg-emerald-500' },
                { label: 'CxC', value: balance.activos.corriente.cuentasPorCobrar.neto, color: 'bg-sky-500' },
                { label: 'Inventario', value: balance.activos.corriente.inventarios.totalValorPEN, color: 'bg-purple-500' },
              ]}
            />
            <StatDistribution
              title="Estructura Financiera"
              valueFormat="currency"
              data={[
                { label: 'Pasivos', value: balance.pasivos.totalPasivos, color: 'bg-red-500' },
                { label: 'Patrimonio', value: balance.patrimonio.totalPatrimonio, color: 'bg-sky-500' },
              ]}
            />
            <StatDistribution
              title="Estructura de Costos"
              valueFormat="currency"
              data={[
                { label: 'Compras', value: estado.compras.total, color: 'bg-orange-500' },
                { label: 'Costos Venta', value: estado.costosVariables.total, color: 'bg-purple-500' },
                { label: 'Gastos Fijos', value: estado.costosFijos.total, color: 'bg-amber-500' },
              ]}
            />
            <StatDistribution
              title="Inventario por País"
              valueFormat="currency"
              data={[
                { label: 'USA', value: balance.activos.corriente.inventarios.inventarioUSA.valorPEN, color: 'bg-sky-500' },
                { label: 'Perú', value: balance.activos.corriente.inventarios.inventarioPeru.valorPEN, color: 'bg-emerald-500' },
              ]}
            />
          </div>

          {/* Indicadores clave y Análisis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Indicadores clave */}
            {indicadores && (
              <div className="bg-white rounded-lg border p-6">
                <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-600" />
                  Indicadores Clave
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-sm text-slate-500">Razón Corriente</div>
                    <div className="text-2xl font-bold text-sky-600">
                      {indicadores.liquidez.razonCorriente.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-400">Act. Corr. / Pas. Corr.</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-sm text-slate-500">ROE</div>
                    <div className={`text-2xl font-bold ${indicadores.rentabilidad.roe >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatPercent(indicadores.rentabilidad.roe)}
                    </div>
                    <div className="text-xs text-slate-400">Util. Neta / Patrimonio</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-sm text-slate-500">Endeudamiento</div>
                    <div className={`text-2xl font-bold ${indicadores.solvencia.endeudamientoTotal <= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {formatPercent(indicadores.solvencia.endeudamientoTotal)}
                    </div>
                    <div className="text-xs text-slate-400">Pasivos / Activos</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-sm text-slate-500">Ciclo de Efectivo</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {indicadores.actividad.cicloConversionEfectivo.toFixed(0)} días
                    </div>
                    <div className="text-xs text-slate-400">Inv + Cobro - Pago</div>
                  </div>
                </div>
              </div>
            )}

            {/* Análisis con semáforo */}
            <div className="bg-white rounded-lg border p-6">
              <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-600" />
                Diagnóstico Financiero
              </h4>
              <div className="space-y-3">
                {analisis.slice(0, 4).map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-lg border ${getEstadoColor(item.estado)}`}
                  >
                    <div className="flex items-center gap-3">
                      {getEstadoIcon(item.estado)}
                      <div>
                        <div className="font-medium">{item.indicador}</div>
                        <div className="text-xs opacity-80">{item.descripcion}</div>
                      </div>
                    </div>
                    <div className="font-mono font-bold">{item.valorFormateado}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Acumulado del Año */}
          {tendencia.length > 0 && (
            <div className="bg-teal-50 rounded-lg border border-teal-200 p-6">
              <h4 className="font-semibold text-teal-800 mb-4 flex items-center gap-2">
                <CircleDollarSign className="w-5 h-5" />
                Acumulado {anio}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <div className="text-xs sm:text-sm text-teal-600">Ventas Acumuladas</div>
                  <div className="text-lg sm:text-2xl font-bold text-teal-900">{formatCurrency(acumuladoVentas)}</div>
                </div>
                <div>
                  <div className="text-xs sm:text-sm text-teal-600">Compras Acumuladas</div>
                  <div className="text-lg sm:text-2xl font-bold text-teal-900">{formatCurrency(acumuladoCompras)}</div>
                </div>
                <div>
                  <div className="text-xs sm:text-sm text-teal-600">Utilidad Acumulada</div>
                  <div className={`text-lg sm:text-2xl font-bold ${acumuladoUtilidadNeta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(acumuladoUtilidadNeta)}
                  </div>
                </div>
                <div>
                  <div className="text-xs sm:text-sm text-teal-600">Promedio Mensual</div>
                  <div className={`text-lg sm:text-2xl font-bold ${promedioMensual >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(promedioMensual)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BALANCE GENERAL */}
      {!loading && tabActiva === 'balance' && (
        <BalanceGeneral mes={mes} anio={anio} />
      )}

      {/* ESTADO DE RESULTADOS */}
      {!loading && tabActiva === 'estado-resultados' && (
        <>
          <EstadoResultados />
          <ReporteDirectoIndirecto mes={mes} anio={anio} />
        </>
      )}

      {/* INDICADORES FINANCIEROS */}
      {!loading && tabActiva === 'indicadores' && indicadores && (
        <div className="space-y-6">
          {/* Ratios por categoría */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Liquidez */}
            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-sky-800 mb-3 sm:mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Ratios de Liquidez
              </h3>
              <p className="text-sm text-slate-500 mb-4">Miden la capacidad de pago a corto plazo</p>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Razón Corriente</div>
                    <div className="text-xs text-slate-500">Activo Corriente / Pasivo Corriente</div>
                  </div>
                  <div className={`text-xl sm:text-2xl font-bold ${indicadores.liquidez.razonCorriente >= 1.5 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {indicadores.liquidez.razonCorriente.toFixed(2)}
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Prueba Ácida</div>
                    <div className="text-xs text-slate-500">(Act. Corr. - Inventarios) / Pas. Corr.</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.liquidez.pruebaAcida >= 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {indicadores.liquidez.pruebaAcida.toFixed(2)}
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Capital de Trabajo</div>
                    <div className="text-xs text-slate-500">Activo Corriente - Pasivo Corriente</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.liquidez.capitalTrabajo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(indicadores.liquidez.capitalTrabajo)}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Razón de Efectivo</div>
                    <div className="text-xs text-slate-500">Efectivo / Pasivo Corriente</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.liquidez.razonEfectivo >= 0.3 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {indicadores.liquidez.razonEfectivo.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Solvencia */}
            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-purple-800 mb-3 sm:mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5" />
                Ratios de Solvencia
              </h3>
              <p className="text-sm text-slate-500 mb-4">Miden la estructura de financiamiento</p>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Endeudamiento Total</div>
                    <div className="text-xs text-slate-500">Pasivos / Activos</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.solvencia.endeudamientoTotal <= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {formatPercent(indicadores.solvencia.endeudamientoTotal)}
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Endeudamiento Patrimonio</div>
                    <div className="text-xs text-slate-500">Pasivos / Patrimonio</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.solvencia.endeudamientoPatrimonio <= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {formatPercent(indicadores.solvencia.endeudamientoPatrimonio)}
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Autonomía</div>
                    <div className="text-xs text-slate-500">Patrimonio / Activos</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.solvencia.autonomia >= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {formatPercent(indicadores.solvencia.autonomia)}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Apalancamiento</div>
                    <div className="text-xs text-slate-500">Activos / Patrimonio</div>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {indicadores.solvencia.apalancamiento.toFixed(2)}x
                  </div>
                </div>
              </div>
            </div>

            {/* Rentabilidad */}
            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-emerald-800 mb-3 sm:mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Ratios de Rentabilidad
              </h3>
              <p className="text-sm text-slate-500 mb-4">Miden la capacidad de generar utilidades</p>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">ROA (Return on Assets)</div>
                    <div className="text-xs text-slate-500">Utilidad Neta / Activos</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.rentabilidad.roa >= 5 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {formatPercent(indicadores.rentabilidad.roa)}
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">ROE (Return on Equity)</div>
                    <div className="text-xs text-slate-500">Utilidad Neta / Patrimonio</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.rentabilidad.roe >= 10 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {formatPercent(indicadores.rentabilidad.roe)}
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Margen Bruto</div>
                    <div className="text-xs text-slate-500">Utilidad Bruta / Ventas</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.rentabilidad.margenBruto >= 30 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {formatPercent(indicadores.rentabilidad.margenBruto)}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Margen Neto</div>
                    <div className="text-xs text-slate-500">Utilidad Neta / Ventas</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.rentabilidad.margenNeto >= 10 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {formatPercent(indicadores.rentabilidad.margenNeto)}
                  </div>
                </div>
              </div>
            </div>

            {/* Actividad */}
            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-amber-800 mb-3 sm:mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Ratios de Actividad
              </h3>
              <p className="text-sm text-slate-500 mb-4">Miden la eficiencia operativa</p>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Rotación de Inventarios</div>
                    <div className="text-xs text-slate-500">Compras / Inventario</div>
                  </div>
                  <div className="text-2xl font-bold text-amber-600">
                    {indicadores.actividad.rotacionInventarios.toFixed(1)}x
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Días de Inventario</div>
                    <div className="text-xs text-slate-500">365 / Rotación</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.actividad.diasInventario <= 60 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {indicadores.actividad.diasInventario.toFixed(0)} días
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Días de Cobro</div>
                    <div className="text-xs text-slate-500">CxC / (Ventas/365)</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.actividad.diasCobro <= 30 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {indicadores.actividad.diasCobro.toFixed(0)} días
                  </div>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-medium">Días de Pago</div>
                    <div className="text-xs text-slate-500">CxP / (Compras/365)</div>
                  </div>
                  <div className="text-2xl font-bold text-sky-600">
                    {indicadores.actividad.diasPago.toFixed(0)} días
                  </div>
                </div>
                <div className="flex justify-between items-center bg-purple-50 rounded-lg p-3 -mx-3">
                  <div>
                    <div className="font-medium text-purple-800">Ciclo de Conversión</div>
                    <div className="text-xs text-purple-600">Días Inv + Cobro - Pago</div>
                  </div>
                  <div className={`text-2xl font-bold ${indicadores.actividad.cicloConversionEfectivo <= 45 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {indicadores.actividad.cicloConversionEfectivo.toFixed(0)} días
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Análisis completo con semáforo */}
          <div className="bg-white rounded-lg border p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-3 sm:mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-600" />
              Diagnóstico Financiero Completo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analisis.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${getEstadoColor(item.estado)}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getEstadoIcon(item.estado)}
                      <span className="font-semibold">{item.indicador}</span>
                    </div>
                    <span className="font-mono font-bold text-lg">{item.valorFormateado}</span>
                  </div>
                  <p className="text-sm opacity-80">{item.descripcion}</p>
                  {item.recomendacion && (
                    <p className="text-xs mt-2 opacity-70 italic">{item.recomendacion}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TENDENCIAS */}
      {!loading && tabActiva === 'tendencias' && (
        <div className="space-y-6">
          {/* Resumen de tendencia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-2 sm:mb-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-sm text-slate-500">Mejor Mes</div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900">{mejorMes?.nombreMes || '-'}</div>
              <div className="text-emerald-600 font-medium text-sm sm:text-base">
                {mejorMes ? formatCurrency(mejorMes.utilidadNeta) : '-'}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-2 sm:mb-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-sm text-slate-500">Peor Mes</div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900">{peorMes?.nombreMes || '-'}</div>
              <div className={`font-medium text-sm sm:text-base ${(peorMes?.utilidadNeta || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {peorMes ? formatCurrency(peorMes.utilidadNeta) : '-'}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-2 sm:mb-3">
                <div className="p-2 bg-sky-100 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-sky-600" />
                </div>
                <div className="text-sm text-slate-500">Promedio Mensual</div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900">
                {formatCurrency(promedioMensual)}
              </div>
              <div className="text-sky-600 font-medium text-sm sm:text-base">
                {tendencia.length} meses
              </div>
            </div>
          </div>

          {/* Evolución Mensual — Cards en mobile, tabla en desktop */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b bg-slate-50">
              <h3 className="font-semibold text-slate-800">Evolución Mensual {anio}</h3>
            </div>

            {/* Mobile: Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {tendencia.map((m, idx) => {
                const margenBruto = m.ventasNetas > 0 ? (m.utilidadBruta / m.ventasNetas) * 100 : 0;
                const margenNeto = m.ventasNetas > 0 ? (m.utilidadNeta / m.ventasNetas) * 100 : 0;
                const maxVentas = Math.max(...tendencia.map(t => t.ventasNetas), 1);
                const barWidth = (m.ventasNetas / maxVentas) * 100;

                return (
                  <div key={idx} className="px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-slate-900">{m.nombreMes}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        m.utilidadNeta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {m.utilidadNeta >= 0 ? '+' : ''}{margenNeto.toFixed(1)}% neto
                      </span>
                    </div>

                    {/* Barra de ventas */}
                    <div className="h-2 bg-slate-100 rounded-full mb-3 overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${barWidth}%` }} />
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Ventas</span>
                        <span className="font-medium text-slate-900">{formatCurrency(m.ventasNetas)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Compras</span>
                        <span className="font-medium text-orange-600">{formatCurrency(m.compras)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">U. Bruta</span>
                        <span className={`font-medium ${m.utilidadBruta >= 0 ? 'text-sky-600' : 'text-red-600'}`}>
                          {formatCurrency(m.utilidadBruta)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Gastos Op.</span>
                        <span className="font-medium text-slate-600">{formatCurrency(m.gastosOperativos)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">EBIT</span>
                        <span className="font-medium text-purple-600">{formatCurrency(m.utilidadOperativa)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">U. Neta</span>
                        <span className={`font-bold ${m.utilidadNeta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(m.utilidadNeta)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Totales mobile */}
              <div className="px-4 py-4 bg-slate-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-slate-900">ACUMULADO {anio}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    acumuladoUtilidadNeta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {acumuladoUtilidadNeta >= 0 ? '+' : ''}{acumuladoVentas > 0 ? ((acumuladoUtilidadNeta / acumuladoVentas) * 100).toFixed(1) : '0.0'}% neto
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ventas</span>
                    <span className="font-bold text-slate-900">{formatCurrency(acumuladoVentas)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Compras</span>
                    <span className="font-bold text-orange-700">{formatCurrency(acumuladoCompras)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">U. Bruta</span>
                    <span className="font-bold text-sky-700">{formatCurrency(tendencia.reduce((s, m) => s + m.utilidadBruta, 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">U. Neta</span>
                    <span className={`font-bold ${acumuladoUtilidadNeta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatCurrency(acumuladoUtilidadNeta)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop: Tabla */}
            {(() => {
              type FilaTendencia = TendenciaMensual & { _esTotal?: boolean };
              const acumUtilidadBruta = tendencia.reduce((s, m) => s + m.utilidadBruta, 0);
              const acumGastosOperativos = tendencia.reduce((s, m) => s + m.gastosOperativos, 0);
              const acumUtilidadOperativa = tendencia.reduce((s, m) => s + m.utilidadOperativa, 0);
              const filaTotal: FilaTendencia = {
                mes: 0,
                anio,
                nombreMes: 'TOTAL',
                ventasNetas: acumuladoVentas,
                compras: acumuladoCompras,
                utilidadBruta: acumUtilidadBruta,
                gastosOperativos: acumGastosOperativos,
                utilidadOperativa: acumUtilidadOperativa,
                utilidadNeta: acumuladoUtilidadNeta,
                _esTotal: true,
              };
              const filas: FilaTendencia[] = [...tendencia, filaTotal];
              const columnasTendencia: DataTableColumn<FilaTendencia>[] = [
                {
                  key: 'nombreMes',
                  header: 'Mes',
                  render: (m) => (
                    <span className={m._esTotal ? 'font-semibold text-slate-900' : 'font-medium text-slate-900'}>
                      {m.nombreMes}
                    </span>
                  ),
                },
                {
                  key: 'ventasNetas',
                  header: 'Ventas',
                  align: 'right',
                  render: (m) => (
                    <span className={m._esTotal ? 'font-semibold text-slate-900' : 'text-slate-700'}>
                      {formatCurrency(m.ventasNetas)}
                    </span>
                  ),
                },
                {
                  key: 'compras',
                  header: 'Compras',
                  align: 'right',
                  render: (m) => (
                    <span className={m._esTotal ? 'font-semibold text-orange-700' : 'text-orange-600'}>
                      {formatCurrency(m.compras)}
                    </span>
                  ),
                },
                {
                  key: 'utilidadBruta',
                  header: 'U. Bruta',
                  align: 'right',
                  render: (m) => (
                    <span className={m._esTotal ? 'font-semibold text-sky-700' : 'text-sky-600'}>
                      {formatCurrency(m.utilidadBruta)}
                    </span>
                  ),
                },
                {
                  key: 'gastosOperativos',
                  header: 'Gastos Op.',
                  align: 'right',
                  render: (m) => (
                    <span className={m._esTotal ? 'font-semibold text-slate-700' : 'text-slate-600'}>
                      {formatCurrency(m.gastosOperativos)}
                    </span>
                  ),
                },
                {
                  key: 'utilidadOperativa',
                  header: 'EBIT',
                  align: 'right',
                  render: (m) => (
                    <span className={m._esTotal ? 'font-semibold text-purple-700' : 'text-purple-600'}>
                      {formatCurrency(m.utilidadOperativa)}
                    </span>
                  ),
                },
                {
                  key: 'utilidadNeta',
                  header: 'U. Neta',
                  align: 'right',
                  render: (m) => (
                    <span className={`font-semibold ${m.utilidadNeta >= 0 ? (m._esTotal ? 'text-emerald-700' : 'text-emerald-600') : (m._esTotal ? 'text-red-700' : 'text-red-600')}`}>
                      {formatCurrency(m.utilidadNeta)}
                    </span>
                  ),
                },
              ];
              return (
                <div className="hidden md:block">
                  <DataTable
                    data={filas}
                    columns={columnasTendencia}
                    keyExtractor={(m) => m._esTotal ? '__total__' : m.nombreMes}
                    compact
                  />
                </div>
              );
            })()}
          </div>

          {/* Gráfico visual — Utilidad Neta por Mes */}
          <div className="bg-white rounded-lg border p-4 sm:p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Utilidad Neta por Mes</h3>
            <div className="space-y-3">
              {tendencia.map((m, idx) => {
                const maxVal = Math.max(...tendencia.map(t => Math.abs(t.utilidadNeta)), 1);
                const width = Math.abs(m.utilidadNeta) / maxVal * 100;
                const isPositive = m.utilidadNeta >= 0;

                return (
                  <div key={idx} className="flex items-center gap-2 sm:gap-3">
                    <div className="w-12 sm:w-20 text-xs sm:text-sm text-slate-600 shrink-0">{m.nombreMes.slice(0, 3)}</div>
                    <div className="flex-1 h-5 sm:h-6 bg-slate-100 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className={`w-20 sm:w-28 text-right text-xs sm:text-sm font-medium shrink-0 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(m.utilidadNeta)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CIERRE MENSUAL */}
      {!loading && tabActiva === 'cierre' && (
        <CierreMensual mes={mes} anio={anio} />
      )}
        </div>
        {/* fin §E body */}
      </div>
      {/* fin shell frame */}
    </div>
  );
}

// (sub-componentes canon viven ARRIBA · ver línea ~98 antes de la función Contabilidad)
