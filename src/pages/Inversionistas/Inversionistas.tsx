/**
 * Inversionistas · vista ejecutiva canon v5.2 violet (chk5.E-INV-RF).
 *
 * REFACTOR completo · shell con TabsRow horizontal + breadcrumb 3 niveles.
 * Replica el patrón de Contabilidad.tsx para consistencia transversal.
 *
 * Mobile-first:
 *  - TabsRow con scroll horizontal (canon N6 v8.0)
 *  - KPI strip 5 cards → 2/3/5 cols según viewport
 *  - Body padding p-4 sm:p-6
 *  - Tap targets ≥44px en tabs
 *  - Botones header con label collapse en mobile (hidden sm:inline)
 *
 * Color signature: violet (distinto a purple Contabilidad, teal Finanzas).
 *
 * Las 7 vistas viven en sub-componentes (components/modules/inversionistas/).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Landmark,
  ChevronRight,
  ChevronLeft,
  Shield,
  Calendar,
  RefreshCw,
  UserCog,
  FileText,
  Wallet,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  Zap,
  Info,
  AlertCircle,
  // Iconos tabs
  Home,
  Coins,
  LineChart,
  Layers,
  Banknote,
  HeartPulse,
  FileBarChart,
  Users,
  ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { inversionistaService } from '../../services/inversionista.service';
import type {
  ResumenInversionista,
  TrayectoriaMensual,
} from '../../types/inversionista.types';
import { formatCurrencyPEN } from '../../utils/format';
import { useAuthStore } from '../../store/authStore';
import { hasRole, hasAnyRole } from '../../types/auth.types';

import {
  InversionistasResumen,
  InversionistasCapital,
  InversionistasTrayectoria,
  InversionistasROI,
  InversionistasDistribucion,
  InversionistasSalud,
  InversionistasReportes,
} from '../../components/modules/inversionistas';

import { MESES_NOMBRE_LARGO } from '../../components/modules/inversionistas/shared';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

type TabId = 'resumen' | 'capital' | 'trayectoria' | 'roi' | 'distribucion' | 'salud' | 'reportes';

interface TabConfig {
  id: TabId;
  label: string;
  mobileLabel?: string;
  breadcrumb: string;
  icon: LucideIcon;
}

const TABS: TabConfig[] = [
  { id: 'resumen', label: 'Resumen', breadcrumb: 'Resumen ejecutivo', icon: Home },
  { id: 'capital', label: 'Mi Capital', breadcrumb: 'Mi capital', icon: Coins },
  { id: 'trayectoria', label: 'Trayectoria', breadcrumb: 'Trayectoria 24m', icon: LineChart },
  { id: 'roi', label: 'ROI Dual', breadcrumb: 'ROI dual', icon: Layers },
  { id: 'distribucion', label: 'Distribución', breadcrumb: 'Distribución de utilidad', icon: Banknote },
  { id: 'salud', label: 'Salud', breadcrumb: 'Salud financiera', icon: HeartPulse },
  { id: 'reportes', label: 'Reportes', breadcrumb: 'Reportes ejecutivos', icon: FileBarChart },
];

// ═════════════════════════════════════════════════════════════════════════
// KPI CARD canon N1+N2
// ═════════════════════════════════════════════════════════════════════════

interface KpiCardProps {
  label: string;
  valor: string;
  delta?: string;
  tooltip?: string;
  tinte: 'violet' | 'indigo' | 'emerald' | 'amber' | 'purple';
  icon: React.ReactNode;
}

const TINTE_MAP = {
  violet: { grad: 'from-violet-50 to-violet-100/40', ring: 'ring-violet-200/50', label: 'text-violet-700', icon: 'text-violet-700', valor: 'text-violet-900', delta: 'text-violet-700' },
  indigo: { grad: 'from-indigo-50 to-indigo-100/40', ring: 'ring-indigo-200/50', label: 'text-indigo-700', icon: 'text-indigo-700', valor: 'text-indigo-900', delta: 'text-indigo-700' },
  emerald: { grad: 'from-emerald-50 to-emerald-100/40', ring: 'ring-emerald-200/50', label: 'text-emerald-700', icon: 'text-emerald-700', valor: 'text-emerald-900', delta: 'text-emerald-700' },
  amber: { grad: 'from-amber-50 to-amber-100/40', ring: 'ring-amber-200/50', label: 'text-amber-700', icon: 'text-amber-700', valor: 'text-amber-900', delta: 'text-amber-700' },
  purple: { grad: 'from-violet-50 to-purple-100/40', ring: 'ring-purple-200/50', label: 'text-purple-700', icon: 'text-purple-700', valor: 'text-purple-900', delta: 'text-purple-700' },
} as const;

function KpiCard({ label, valor, delta, tooltip, tinte, icon }: KpiCardProps) {
  const t = TINTE_MAP[tinte];
  return (
    <div className={`bg-gradient-to-br ${t.grad} ring-1 ${t.ring} rounded-2xl p-3 sm:p-4`}>
      <div className="flex items-center justify-between mb-1.5 sm:mb-2">
        <span
          className={`text-[9px] sm:text-[10px] uppercase tracking-wider ${t.label} font-bold flex items-center gap-1`}
          title={tooltip}
        >
          {label}
          {tooltip && <Info className="w-3 h-3 text-slate-400 flex-shrink-0" aria-label={tooltip} />}
        </span>
        <span className={`w-3.5 h-3.5 ${t.icon} flex-shrink-0`}>{icon}</span>
      </div>
      <div className={`text-xl sm:text-2xl font-bold tabular-nums ${t.valor}`}>{valor}</div>
      {delta && <div className={`text-[10px] sm:text-[11px] ${t.delta} mt-1 truncate`}>{delta}</div>}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Loading state · usado en lazy load de trayectoria 24m
// ═════════════════════════════════════════════════════════════════════════

function TrayectoriaLoadingState() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
      <RefreshCw className="w-6 h-6 text-violet-500 animate-spin mx-auto mb-3" />
      <p className="text-[13px] text-slate-600 font-semibold">Calculando trayectoria 24 meses...</p>
      <p className="text-[11px] text-slate-400 mt-1">
        Cruzando Balance + P&L de cada mes · solo se calcula la primera vez
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// TabsRow canon · scroll-x mobile · chevron arrows desktop · violet active
// ═════════════════════════════════════════════════════════════════════════

interface TabsRowProps {
  tabs: TabConfig[];
  activeId: TabId;
  onChange: (id: TabId) => void;
}

function TabsRow({ tabs, activeId, onChange }: TabsRowProps) {
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
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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
      <div ref={scrollRef} className="px-3 sm:px-6 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1 -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={
                  'px-3 sm:px-4 py-3 text-[12px] border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ' +
                  (isActive
                    ? 'border-violet-600 text-violet-700 font-semibold'
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
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════

export default function Inversionistas() {
  const navigate = useNavigate();
  const ahora = new Date();
  const [mes, setMes] = useState<number>(ahora.getMonth() + 1);
  const [anio, setAnio] = useState<number>(ahora.getFullYear());
  const [tabActiva, setTabActiva] = useState<TabId>('resumen');
  const [data, setData] = useState<ResumenInversionista | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // chk5.E-INV-PERF · lazy load de trayectoria 24m
  // El resumen inicial NO incluye trayectoria (load rápido ~1-2s).
  // La trayectoria se carga la primera vez que entran a tab Trayectoria o
  // Distribución (lazy), y luego queda cacheada para futuras navegaciones.
  const [trayectoriaCargada, setTrayectoriaCargada] = useState(false);
  const [trayectoriaCargando, setTrayectoriaCargando] = useState(false);

  // Canon "admin ve todo" · banner contextual
  const userProfile = useAuthStore((s) => s.userProfile);
  const esAdmin = hasRole(userProfile, 'admin');
  // Banner cross-link · solo admin/gerente · canon v5.3 (mockup inversionistas-v5.3-tweaks.html · líneas 80-94)
  const puedeGestionarSocios = hasAnyRole(userProfile, ['admin', 'gerente']);

  const aniosDisponibles = useMemo(() => {
    const out: number[] = [];
    for (let y = ahora.getFullYear(); y >= ahora.getFullYear() - 3; y--) out.push(y);
    return out;
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    setTrayectoriaCargada(false);   // reset · cambio de período fuerza recargar trayectoria
    try {
      const resumen = await inversionistaService.calcularResumenInversionista(mes, anio);
      setData(resumen);
    } catch (err) {
      console.error('Error cargando datos inversionistas:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar datos.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * chk5.E-INV-PERF · lazy load de trayectoria 24m.
   *
   * Solo se ejecuta la primera vez que el user entra a un tab que la necesita
   * (Trayectoria o Distribución). Una vez cargada, queda cacheada en `data`
   * hasta que cambie el período (mes/anio).
   *
   * Una vez cargada, recalculamos la salud con la tendencia patrimonio real
   * (ahora sí tenemos 6m de historia para derivar pendiente).
   */
  const cargarTrayectoria = async () => {
    if (!data || trayectoriaCargada || trayectoriaCargando) return;
    setTrayectoriaCargando(true);
    try {
      const trayectoria: TrayectoriaMensual[] =
        await inversionistaService.calcularTrayectoria24Meses(mes, anio);

      // Recalcular salud con la tendencia real ahora que tenemos historia
      const config = await inversionistaService.getConfiguracionInversionistas();
      const saludRecalculada = inversionistaService.recalcularSaludConTendencia(
        data,
        trayectoria,
        config.umbralEquityRatio
      );

      setData({ ...data, trayectoria, salud: saludRecalculada });
      setTrayectoriaCargada(true);
    } catch (err) {
      console.error('Error cargando trayectoria:', err);
      // No bloqueamos el módulo · solo mostramos chart vacío en el tab.
    } finally {
      setTrayectoriaCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, anio]);

  // chk5.E-INV-PERF · disparar lazy load cuando entra a tabs que necesitan trayectoria
  useEffect(() => {
    if ((tabActiva === 'trayectoria' || tabActiva === 'distribucion') && !trayectoriaCargada) {
      cargarTrayectoria();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActiva, trayectoriaCargada, data]);

  const tabActivaCfg = TABS.find((t) => t.id === tabActiva)!;

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* §A · BREADCRUMB canon S9.D1 · 3 niveles dinámicos */}
        <div className="border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center gap-3 bg-slate-50">
          <div className="flex items-center text-[12px] flex-1 min-w-0">
            <a className="text-slate-500 hover:text-violet-700 cursor-pointer flex-shrink-0">Inicio</a>
            <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5 flex-shrink-0" />
            {tabActiva === 'resumen' ? (
              <span className="text-slate-900 font-semibold truncate">Inversionistas</span>
            ) : (
              <>
                <a
                  className="text-slate-500 hover:text-violet-700 cursor-pointer flex-shrink-0"
                  onClick={() => setTabActiva('resumen')}
                >
                  Inversionistas
                </a>
                <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5 flex-shrink-0" />
                <span className="text-slate-900 font-semibold truncate">{tabActivaCfg.breadcrumb}</span>
              </>
            )}
          </div>
          {/* Banner contextual al rol · canon admin ve todo */}
          <span className="text-[10px] bg-violet-50 text-violet-700 px-2 py-0.5 rounded font-bold hidden sm:inline-flex items-center gap-1 flex-shrink-0">
            <Shield className="w-3 h-3" />
            {esAdmin ? 'Vista ejecutiva · admin' : 'Acceso restringido · solo socios'}
          </span>
        </div>

        {/* §B · HEADER banking-grade · icon violet gradient */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3 sm:gap-4 flex-wrap">
            <div className="flex items-start gap-3 flex-1 min-w-[220px]">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white flex-shrink-0">
                <Landmark className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Inversionistas</h1>
                <p className="text-[12px] sm:text-[13px] text-slate-500 leading-snug">
                  Vista estratégica · capital comprometido · retorno · trayectoria
                </p>
              </div>
            </div>
            {/* Acciones header · 3-tier canon · flex-wrap mobile */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {/* Selector período · compacto */}
              <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={mes}
                  onChange={(e) => setMes(Number(e.target.value))}
                  className="text-[11px] font-semibold bg-transparent focus:outline-none cursor-pointer"
                  aria-label="Mes"
                >
                  {MESES_NOMBRE_LARGO.slice(1).map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select
                  value={anio}
                  onChange={(e) => setAnio(Number(e.target.value))}
                  className="text-[11px] font-semibold bg-transparent focus:outline-none cursor-pointer"
                  aria-label="Año"
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
                aria-label="Recargar datos"
                title="Recargar datos del módulo"
                className="text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Recargar</span>
              </button>
              {/* Tier destacada · Configurar socios */}
              <button
                type="button"
                onClick={() => navigate('/usuarios?filterRole=socio')}
                aria-label="Configurar socios"
                title="Gestionar socios desde Usuarios · agregá rol 'socio' a usuarios existentes o creá nuevos"
                className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <UserCog className="w-3 h-3" />
                <span className="hidden md:inline">Gestionar socios</span>
              </button>
              {/* Tier primary · Reporte directorio */}
              <button
                type="button"
                onClick={() => setTabActiva('reportes')}
                aria-label="Ir a reportes ejecutivos"
                title="Exportar reportes ejecutivos"
                className="text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <FileText className="w-3 h-3" />
                <span className="hidden md:inline">Reportes</span>
              </button>
            </div>
          </div>
        </div>

        {/* §B.5 · BANNER CROSS-LINK · solo admin/gerente · canon v5.3 (mockup inversionistas-v5.3-tweaks.html · líneas 80-94) */}
        {puedeGestionarSocios && (
          <div className="mx-4 sm:mx-6 mt-2 mb-3 bg-gradient-to-r from-purple-50 to-indigo-50 ring-1 ring-purple-200 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-purple-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-slate-700">
                <strong>Admin/Gerente:</strong> para configurar socios · % participación · aportes de valor (D7) · ir a Usuarios.
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/usuarios?filterRole=socio')}
              className="bg-white border border-purple-300 hover:bg-purple-50 text-purple-700 text-[11px] font-bold px-3 py-1 rounded-lg whitespace-nowrap flex items-center gap-1"
            >
              <span className="hidden sm:inline">Configurar socios</span>
              <span className="sm:hidden">Socios</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* §C · KPI STRIP · 5 cards · 2/3/5 cols */}
        {data && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
            <KpiCard
              tinte="violet"
              icon={<Wallet />}
              label="CAPITAL COMPROMETIDO"
              valor={formatCurrencyPEN(data.capitalComprometido.totalPEN)}
              delta={`${formatCurrencyPEN(data.capitalComprometido.cashAportadoPEN)} cash + ${formatCurrencyPEN(data.capitalComprometido.deudaTCPersonalPEN)} TC`}
              tooltip="Cash propio aportado + TC personal asumida"
            />
            <KpiCard
              tinte="indigo"
              icon={<PiggyBank />}
              label="PATRIMONIO"
              valor={formatCurrencyPEN(data.patrimonioPEN)}
              delta={data.activosPEN > 0 ? `${(data.patrimonioPEN / data.activosPEN * 100).toFixed(0)}% de los activos` : '—'}
            />
            <KpiCard
              tinte="emerald"
              icon={<ShieldCheck />}
              label="EQUITY RATIO"
              valor={`${data.equityRatio.porcentaje.toFixed(0)}%`}
              delta={data.equityRatio.salud}
              tooltip="% del activo que es REALMENTE tuyo · libre de deuda"
            />
            <KpiCard
              tinte="amber"
              icon={<TrendingUp />}
              label="ROI ANUAL"
              valor={`${(data.roiDual.sobreCapitalComprometido * 100).toFixed(0)}%`}
              delta={data.roiDual.sobreCapitalComprometido > 0.05 ? `vs ~5% plazo fijo · ${(data.roiDual.sobreCapitalComprometido / 0.05).toFixed(1)}x` : '—'}
              tooltip="Sobre capital comprometido total"
            />
            <KpiCard
              tinte="purple"
              icon={<Zap />}
              label="MULTIPLICADOR"
              valor={data.multiplicador.multiplicador > 0 ? `${data.multiplicador.multiplicador.toFixed(2)}x` : '—'}
              delta={data.multiplicador.multiplicador > 0 ? `por S/1 puesto valen S/${data.multiplicador.multiplicador.toFixed(2)}` : 'Sin data'}
              tooltip="Patrimonio actual / Capital aportado original"
            />
          </div>
        )}

        {/* §D · TABS ROW · canon · scroll-x mobile */}
        <TabsRow tabs={TABS} activeId={tabActiva} onChange={setTabActiva} />

        {/* §E · BODY · sólo tab activo · canon padding responsive */}
        <div className="p-4 sm:p-6">
          {loading && !data && (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-violet-500 animate-spin mx-auto mb-3" />
              <p className="text-[13px] text-slate-600">Cargando vista ejecutiva...</p>
              <p className="text-[11px] text-slate-400 mt-1">Capital · patrimonio · ROI · soberanía</p>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-[13px] font-semibold text-rose-900">Error al cargar la vista</div>
                <div className="text-[11px] text-rose-700 mt-0.5">{error}</div>
              </div>
            </div>
          )}

          {data && !loading && (
            <>
              {tabActiva === 'resumen' && <InversionistasResumen data={data} />}
              {tabActiva === 'capital' && <InversionistasCapital data={data} />}
              {tabActiva === 'trayectoria' && (
                trayectoriaCargando ? (
                  <TrayectoriaLoadingState />
                ) : (
                  <InversionistasTrayectoria data={data} />
                )
              )}
              {tabActiva === 'roi' && <InversionistasROI data={data} />}
              {tabActiva === 'distribucion' && (
                trayectoriaCargando ? (
                  <TrayectoriaLoadingState />
                ) : (
                  <InversionistasDistribucion data={data} />
                )
              )}
              {tabActiva === 'salud' && <InversionistasSalud data={data} />}
              {tabActiva === 'reportes' && <InversionistasReportes data={data} mes={mes} anio={anio} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
