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

import React, { useEffect, useMemo, useState } from 'react';
import {
  Landmark,
  Calendar,
  RefreshCw,
  UserCog,
  FileText,
  Wallet,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  Zap,
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
// Hub Kit (L5) · DS Fase 4
import { HubShell, HubTopBar, HubHeader, HubKpiStrip, HubTabs, HubBody } from '../../design-system';
import type { HubTab, HubKpi } from '../../design-system';

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
// chk5.PERSONAS-v5.8 · E4 · Modal "Nuevo socio" · alta directa desde Inversionistas
import { NuevoSocioModal } from '../../components/modules/inversionistas/NuevoSocioModal';

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
  { id: 'resumen', label: 'Resumen', breadcrumb: 'Resumen', icon: Home },
  { id: 'capital', label: 'Mi Capital', breadcrumb: 'Mi Capital', icon: Coins },
  { id: 'trayectoria', label: 'Trayectoria', breadcrumb: 'Trayectoria', icon: LineChart },
  { id: 'roi', label: 'ROI Dual', breadcrumb: 'ROI Dual', icon: Layers },
  { id: 'distribucion', label: 'Distribución', breadcrumb: 'Distribución', icon: Banknote },
  { id: 'salud', label: 'Salud', breadcrumb: 'Salud', icon: HeartPulse },
  { id: 'reportes', label: 'Reportes', breadcrumb: 'Reportes', icon: FileBarChart },
];

// KpiCard local + TINTE_MAP → reemplazados por HubKpiStrip (Hub Kit · DS F4).

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

// TabsRow local → reemplazado por HubTabs (Hub Kit · DS F4 · cierra deuda "unificar tabs").

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
  // chk5.E-INV-PERF2 · FASE 2 · carga de acumulados históricos (12 P&L) en background
  const [acumuladosCargando, setAcumuladosCargando] = useState(false);

  // chk5.PERSONAS-v5.8 · E4 · Modal "Nuevo socio" · alta directa
  const [nuevoSocioOpen, setNuevoSocioOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Auto-hide toast
  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

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
      // chk5.E-INV-PERF2 · FASE 1 · primer paint rápido SIN los 12 P&L históricos
      // (acumulados ROI 12m + soberanía). Pasa incluirAcumulados=false → ~2 cálculos
      // contables en vez de ~20. La FASE 2 (cargarAcumulados) los enriquece después.
      const resumen = await inversionistaService.calcularResumenInversionista(mes, anio, false);
      setData(resumen);
    } catch (err) {
      console.error('Error cargando datos inversionistas:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar datos.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * chk5.E-INV-PERF2 · FASE 2 · enriquece con los acumulados históricos (12 P&L).
   * Se dispara en background tras el primer paint · NO bloquea la vista. Cuando
   * termina, ROI 12m + soberanía + salud se actualizan con los valores reales.
   */
  const cargarAcumulados = async () => {
    if (acumuladosCargando) return;
    setAcumuladosCargando(true);
    try {
      const completo = await inversionistaService.calcularResumenInversionista(mes, anio, true);
      // Preservar la trayectoria si el user ya la cargó (lazy de otro tab)
      setData((prev) => (prev ? { ...completo, trayectoria: prev.trayectoria } : completo));
    } catch (err) {
      console.error('Error cargando acumulados inversionistas:', err);
      // No bloqueamos · los KPIs históricos quedan en placeholder
    } finally {
      setAcumuladosCargando(false);
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

  // chk5.E-INV-PERF2 · FASE 2 · tras el primer paint (data con acumuladosCargados=false)
  // disparamos en background el cálculo de los 12 P&L históricos para enriquecer
  // ROI 12m + soberanía + salud. No bloquea la vista.
  useEffect(() => {
    if (data && data.acumuladosCargados === false && !acumuladosCargando) {
      cargarAcumulados();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // chk5.E-INV-PERF · disparar lazy load cuando entra a tabs que necesitan trayectoria
  useEffect(() => {
    if ((tabActiva === 'trayectoria' || tabActiva === 'distribucion') && !trayectoriaCargada) {
      cargarTrayectoria();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActiva, trayectoriaCargada, data]);

  const tabActivaCfg = TABS.find((t) => t.id === tabActiva)!;

  // ===== Hub Kit · breadcrumb leaf + tabs + KPIs + selector de período =====
  const breadcrumbLeaf = tabActiva === 'resumen' ? null : tabActivaCfg.breadcrumb;
  const inversionistasTabs: HubTab[] = TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }));
  const inversionistasKpis: HubKpi[] = data
    ? [
        { label: 'CAPITAL COMPROMETIDO', tono: 'violet', icon: Wallet, valor: formatCurrencyPEN(data.capitalComprometido.totalPEN), delta: `${formatCurrencyPEN(data.capitalComprometido.cashAportadoPEN)} cash + ${formatCurrencyPEN(data.capitalComprometido.deudaTCPersonalPEN)} TC`, tooltip: 'Cash propio aportado + TC personal asumida' },
        { label: 'PATRIMONIO', tono: 'indigo', icon: PiggyBank, valor: formatCurrencyPEN(data.patrimonioPEN), delta: data.activosPEN > 0 ? `${((data.patrimonioPEN / data.activosPEN) * 100).toFixed(0)}% de los activos` : '—' },
        { label: 'EQUITY RATIO', tono: 'emerald', icon: ShieldCheck, valor: `${data.equityRatio.porcentaje.toFixed(0)}%`, delta: data.equityRatio.salud, tooltip: '% del activo que es REALMENTE tuyo · libre de deuda' },
        { label: 'ROI ANUAL', tono: 'amber', icon: TrendingUp, valor: `${(data.roiDual.sobreCapitalComprometido * 100).toFixed(0)}%`, delta: data.roiDual.sobreCapitalComprometido > 0.05 ? `vs ~5% plazo fijo · ${(data.roiDual.sobreCapitalComprometido / 0.05).toFixed(1)}x` : '—', tooltip: 'Sobre capital comprometido total' },
        { label: 'MULTIPLICADOR', tono: 'violet', icon: Zap, valor: data.multiplicador.multiplicador > 0 ? `${data.multiplicador.multiplicador.toFixed(2)}x` : '—', delta: data.multiplicador.multiplicador > 0 ? `por S/1 puesto valen S/${data.multiplicador.multiplicador.toFixed(2)}` : 'Sin data', tooltip: 'Patrimonio actual / Capital aportado original' },
      ]
    : [];
  // Selector de período · va en el slot extraActions del HubHeader
  const periodoSelector = (
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
  );

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
      <HubShell>
        <HubTopBar
          grupo="equipo"
          modulo="Inversionistas"
          leaf={breadcrumbLeaf}
          esAdmin={esAdmin}
          chipNoAdmin="Acceso restringido · solo socios"
          onModulo={() => setTabActiva('resumen')}
        />

        {/* §B · HEADER banking-grade · ícono violet sólido + período (extraActions) + acciones 3-tier */}
        <HubHeader
          grupo="equipo"
          icon={Landmark}
          titulo="Inversionistas"
          subtitulo="Vista estratégica · capital comprometido · retorno · trayectoria"
          extraActions={periodoSelector}
          acciones={[
            { label: 'Recargar', icon: RefreshCw, onClick: cargarDatos, tier: 'neutral', disabled: loading },
            { label: 'Gestionar socios', icon: UserCog, onClick: () => navigate('/usuarios?filterRole=socio'), tier: 'config' },
            { label: 'Reportes', icon: FileText, onClick: () => setTabActiva('reportes'), tier: 'neutral' },
            { label: 'Nuevo socio', icon: Users, onClick: () => setNuevoSocioOpen(true), tier: 'primary' },
          ]}
        />

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

        {/* §C · KPI STRIP · 5 KPIs semánticos (violet/indigo/emerald/amber/violet) + tooltips */}
        {data && <HubKpiStrip cols={5} kpis={inversionistasKpis} />}

        {/* §D · TABS · HubTabs (equipo → violet · scroll-x N6) */}
        <HubTabs grupo="equipo" tabs={inversionistasTabs} activa={tabActiva} onChange={(id) => setTabActiva(id as TabId)} />

        {/* §E · BODY · Layout B (sin aside) */}
        <HubBody>
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
        </HubBody>
      </HubShell>

      {/* chk5.PERSONAS-v5.8 · E4 · Alta de socio directa desde Inversionistas */}
      <NuevoSocioModal
        isOpen={nuevoSocioOpen}
        onClose={() => setNuevoSocioOpen(false)}
        onSuccess={(uid) => {
          setNuevoSocioOpen(false);
          setToastMsg(`Socio agregado al cap table (uid: ${uid.slice(0, 8)}...)`);
          cargarDatos();
        }}
      />

      {/* Toast inline · patron existente del módulo */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-50 bg-violet-600 text-white text-[12px] font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          <Users className="w-3.5 h-3.5" />
          {toastMsg}
        </div>
      )}
    </div>
  );
}
