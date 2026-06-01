/**
 * Planilla.tsx · chk5.PERSONAS-v5.4 · F4 · 2026-05-26
 *
 * Refactor completo canon banking-grade sky · mockup planilla-v5.4-completo.html ACTO 1.
 *
 * Cambios vs v5.3:
 *   ❌ Tab "Empleados" eliminado (ahora vive en /usuarios filtro Planilla)
 *   ✅ Tab "Boletas del mes" (preservado · sigue siendo TabBoletas)
 *   ✅ Tab "Adelantos" (preservado · sigue siendo TabAdelantos)
 *   ✅ Tab "Incentivos & Comisiones" NUEVO (v5.4)
 *   ✅ Tab "Vacaciones & Gratificaciones" NUEVO (v5.4 · sin CTS)
 *   ✅ Tab "Análisis & Reportes" NUEVO (v5.4 · cost analytics 360)
 *
 * Estructura del shell:
 *   §A · Breadcrumb (Inicio › Planilla › sub-tab · módulo como 2º nivel · canon S9.D1)
 *   §B · Header banking-grade sky (icon · h1 · acciones)
 *   §C · KPI strip 4 cards (Payroll mes · Personal activo · Incentivos mes · Próx. gratif)
 *   §D · Selector de período (mes/año)
 *   §E · TabsRow scroll-x (5 tabs · canon N6)
 *   §F · Body del tab activo
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BriefcaseBusiness,
  Calendar,
  Download,
  Lock,
  Plus,
  RefreshCw,
  FileText,
  ArrowDownCircle,
  Trophy,
  Palmtree,
  BarChart3,
  Wallet,
  Users,
  UserMinus,
  CalendarDays,
  LayoutDashboard,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
// Hub Kit (L5) · DS Fase 4
import { HubShell, HubTopBar, HubHeader, HubKpiStrip, HubTabs, HubBody } from '../../design-system';
import type { HubTab, HubKpi } from '../../design-system';
import { useAuthStore } from '../../store/authStore';
import { hasRole } from '../../types/auth.types';
import { TabBoletas } from './components/TabBoletas';
import { TabAdelantos } from './components/TabAdelantos';
import { TabIncentivos } from './components/TabIncentivos';
import { TabVacacionesGratificaciones } from './components/TabVacacionesGratificaciones';
import { TabAnalisisReportes } from './components/TabAnalisisReportes';
// chk5.PERSONAS-v5.4 · F10.E · Tab Resumen estratégico (alineado con Contabilidad/Finanzas/Inversionistas)
import { TabResumenPlanilla } from './components/TabResumenPlanilla';
import { planillaService } from '../../services/planilla.service';
import { calculoIncentivoService } from '../../services/calculoIncentivo.service';
import type { Boleta, AdelantoNomina, MesGratificacion } from '../../types/planilla.types';
import { formatCurrencyPEN } from '../../utils/format';
// chk5.PERSONAS-v5.4 · F5 · modales operativos canon FormModalV2
import { ProcesarGratificacionModal } from '../../components/modules/planilla/ProcesarGratificacionModal';
import { ProgramarVacacionesModal } from '../../components/modules/planilla/ProgramarVacacionesModal';
import { CalcularBonosMesModal } from '../../components/modules/planilla/CalcularBonosMesModal';
import { AprobarBonoModal } from '../../components/modules/planilla/AprobarBonoModal';
import { RechazarBonoModal } from '../../components/modules/planilla/RechazarBonoModal';
import { NuevoEsquemaIncentivoModal } from '../../components/modules/planilla/NuevoEsquemaIncentivoModal';
import { EditarEsquemaIncentivoModal } from '../../components/modules/planilla/EditarEsquemaIncentivoModal';
import { GenerarBoletasModal } from '../../components/modules/planilla/GenerarBoletasModal';
import { CerrarMesModal } from '../../components/modules/planilla/CerrarMesModal';
import { ExportPayrollModal } from '../../components/modules/planilla/ExportPayrollModal';
import { WizardBajaEmpleadoModal } from '../../components/modules/planilla/WizardBajaEmpleadoModal';
// chk5.PERSONAS-v5.8 · E3 · Modal "Nuevo empleado" · alta directa desde Planilla
import { NuevoEmpleadoModal } from '../../components/modules/planilla/NuevoEmpleadoModal';
import type { CalculoIncentivoMes, EsquemaIncentivo } from '../../types/planilla.types';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

// chk5.PERSONAS-v5.4 · F10.E · agregado 'resumen' como first tab estratégico
// (alineado con Contabilidad · Finanzas Overview · Inversionistas Resumen ejecutivo)
type TabId =
  | 'resumen'
  | 'boletas'
  | 'adelantos'
  | 'incentivos'
  | 'vacaciones'
  | 'analisis';

interface TabConfig {
  id: TabId;
  label: string;
  labelSm?: string;
  /** Leaf canon S9.D1 para breadcrumb · undefined si es default (sin leaf) */
  breadcrumbLeaf?: string;
  Icon: LucideIcon;
  badge?: { label: string; tinte: 'sky' | 'amber' | 'violet' };
}

const MESES_NOMBRE = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function mesNombreCorto(m: number) {
  return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][m - 1] ?? '';
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════

export const Planilla: React.FC = () => {
  const navigate = useNavigate();
  // DS Fase 4 · Hub Kit · chip de rol en el top-bar (canon "admin ve todo")
  const userProfile = useAuthStore((s) => s.userProfile);
  const esAdmin = hasRole(userProfile, 'admin');
  const ahora = new Date();
  // chk5.PERSONAS-v5.4 · F6 · deep-link reading desde cross-links 360°
  // ?mes=X&anio=Y pre-selecciona el período al entrar desde /gastos · /finanzas/cash-flow · etc
  const queryParams = useMemo(() => {
    if (typeof window === 'undefined') return { mes: null, anio: null };
    const sp = new URLSearchParams(window.location.search);
    const m = Number(sp.get('mes'));
    const a = Number(sp.get('anio'));
    return {
      mes: Number.isFinite(m) && m >= 1 && m <= 12 ? m : null,
      anio: Number.isFinite(a) && a >= 2020 && a <= 2100 ? a : null,
    };
  }, []);
  const [mes, setMes] = useState<number>(queryParams.mes ?? ahora.getMonth() + 1);
  const [anio, setAnio] = useState<number>(queryParams.anio ?? ahora.getFullYear());
  // chk5.PERSONAS-v5.4 · F10.E · default 'resumen' alineado con Contabilidad/Finanzas/Inversionistas
  // (vista estratégica al entrar · operación táctica vive en otras tabs)
  const [tabActiva, setTabActiva] = useState<TabId>('resumen');

  // Data del shell · KPIs
  const [boletasMes, setBoletasMes] = useState<Boleta[]>([]);
  const [empleadosActivos, setEmpleadosActivos] = useState(0);
  const [bonosMesPEN, setBonosMesPEN] = useState(0);
  const [adelantosPendientes, setAdelantosPendientes] = useState<AdelantoNomina[]>([]);
  const [loadingShell, setLoadingShell] = useState(true);

  // chk5.PERSONAS-v5.4 · F5 · modales operativos
  const [modal, setModal] = useState<
    | { kind: 'none' }
    | { kind: 'procesarGratif'; mes: MesGratificacion }
    | { kind: 'programarVacaciones' }
    | { kind: 'calcularBonos' }
    | { kind: 'aprobarBono'; calculo: CalculoIncentivoMes }
    | { kind: 'rechazarBono'; calculo: CalculoIncentivoMes }
    | { kind: 'nuevoEsquema' }
    | { kind: 'editarEsquema'; esquema: EsquemaIncentivo }
    | { kind: 'generarBoletas' }
    | { kind: 'cerrarMes' }
    | { kind: 'exportPayroll' }
    | { kind: 'bajaEmpleado' }
    | { kind: 'nuevoEmpleado' }
  >({ kind: 'none' });
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const cargarShellData = useCallback(async () => {
    setLoadingShell(true);
    try {
      const [boletas, empleados, calculos, adelantos] = await Promise.all([
        planillaService.getBoletasPorPeriodo(mes, anio),
        planillaService.getEmpleadosActivos(),
        calculoIncentivoService.listMes(mes, anio),
        planillaService.getAdelantos(50),
      ]);
      setBoletasMes(boletas);
      setEmpleadosActivos(empleados.length);
      const bonos = calculos
        .filter((c) => c.estado === 'incluido_en_boleta' || c.estado === 'aprobado')
        .reduce((s, c) => s + c.bonoCalculado, 0);
      setBonosMesPEN(bonos);
      setAdelantosPendientes(adelantos.filter((a) => a.estado === 'pendiente'));
    } catch (err) {
      console.error('[Planilla] error cargando shell data:', err);
    } finally {
      setLoadingShell(false);
    }
  }, [mes, anio]);

  useEffect(() => {
    cargarShellData();
  }, [cargarShellData]);

  // KPIs derivados
  const payrollMes = useMemo(
    () => boletasMes.reduce((s, b) => s + b.totalNeto, 0),
    [boletasMes],
  );

  const proximaGratificacion = useMemo(() => {
    // Próxima jul 15 o dic 15
    const hoy = new Date();
    const candidatos = [
      new Date(anio, 6, 15),
      new Date(anio, 11, 15),
      new Date(anio + 1, 6, 15),
    ];
    const next = candidatos.find((c) => c.getTime() > hoy.getTime()) ?? candidatos[0];
    const dias = Math.max(0, Math.ceil((next.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)));
    return { fecha: next, dias };
  }, [anio]);

  const aniosDisponibles = useMemo(() => {
    const out: number[] = [];
    for (let y = ahora.getFullYear(); y >= ahora.getFullYear() - 3; y--) out.push(y);
    return out;
  }, []);

  // Tabs config canon · F10.E agregó 'resumen' como first tab + breadcrumbLeaf canon S9.D1
  const TABS: TabConfig[] = useMemo(
    () => [
      {
        id: 'resumen',
        label: 'Resumen',
        labelSm: 'Resumen',
        breadcrumbLeaf: undefined, // default · sin leaf en breadcrumb (canon S9.D1)
        Icon: LayoutDashboard,
      },
      {
        id: 'boletas',
        label: 'Boletas del mes',
        labelSm: 'Boletas',
        breadcrumbLeaf: 'Boletas del mes',
        Icon: FileText,
        badge:
          boletasMes.length > 0
            ? { label: String(boletasMes.length), tinte: 'sky' }
            : undefined,
      },
      {
        id: 'adelantos',
        label: 'Adelantos',
        breadcrumbLeaf: 'Adelantos',
        Icon: ArrowDownCircle,
        badge:
          adelantosPendientes.length > 0
            ? { label: String(adelantosPendientes.length), tinte: 'amber' }
            : undefined,
      },
      {
        id: 'incentivos',
        label: 'Incentivos & Comisiones',
        labelSm: 'Incentivos',
        breadcrumbLeaf: 'Incentivos & Comisiones',
        Icon: Trophy,
        badge: { label: 'NUEVO', tinte: 'violet' },
      },
      {
        id: 'vacaciones',
        label: 'Vacaciones & Gratificaciones',
        labelSm: 'Vac.+Grat.',
        breadcrumbLeaf: 'Vacaciones & Gratificaciones',
        Icon: Palmtree,
      },
      {
        id: 'analisis',
        label: 'Análisis & Reportes',
        labelSm: 'Análisis',
        breadcrumbLeaf: 'Análisis & Reportes',
        Icon: BarChart3,
        badge: { label: 'NUEVO', tinte: 'violet' },
      },
    ],
    [boletasMes.length, adelantosPendientes.length],
  );

  // chk5.PERSONAS-v5.4 · F10.E · breadcrumbLeaf dinámico según tab activa
  const tabActivaCfg = TABS.find((t) => t.id === tabActiva)!;

  // ===== Hub Kit · breadcrumb leaf + tabs (badges) + KPIs + selector de período =====
  const breadcrumbLeaf = tabActivaCfg.breadcrumbLeaf ?? null;
  const planillaTabs: HubTab[] = TABS.map((t) => {
    const base = { id: t.id, label: t.label, icon: t.Icon };
    if (t.id === 'boletas' && boletasMes.length > 0) return { ...base, badge: boletasMes.length, badgeTono: 'slate' as const };
    if (t.id === 'adelantos' && adelantosPendientes.length > 0) return { ...base, badge: adelantosPendientes.length, badgeTono: 'amber' as const };
    return base;
  });
  const planillaKpis: HubKpi[] = [
    { label: `PAYROLL ${mesNombreCorto(mes).toUpperCase()}`, tono: 'rose', icon: Wallet, valor: formatCurrencyPEN(payrollMes), delta: `${boletasMes.length} boleta${boletasMes.length === 1 ? '' : 's'}${bonosMesPEN > 0 ? ` · ${formatCurrencyPEN(bonosMesPEN)} bonos` : ''}` },
    { label: 'PERSONAL ACTIVO', tono: 'emerald', icon: Users, valor: String(empleadosActivos), delta: `empleado${empleadosActivos === 1 ? '' : 's'} con perfil laboral` },
    { label: 'INCENTIVOS MES', tono: 'violet', icon: Trophy, valor: formatCurrencyPEN(bonosMesPEN), delta: 'bonos aprobados + en boleta' },
    { label: 'PRÓX. GRATIF.', tono: 'indigo', icon: CalendarDays, valor: proximaGratificacion.fecha.getMonth() === 6 ? 'jul' : 'dic', sufijo: ` · ${proximaGratificacion.dias}d`, delta: 'jul/dic Perú · sin CTS' },
  ];
  const periodoSelector = (
    <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
      <Calendar className="w-3.5 h-3.5 text-slate-500" />
      <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="text-[11px] font-semibold bg-transparent focus:outline-none cursor-pointer" aria-label="Mes">
        {MESES_NOMBRE.map((m, i) => (<option key={i} value={i + 1}>{m}</option>))}
      </select>
      <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="text-[11px] font-semibold bg-transparent focus:outline-none cursor-pointer" aria-label="Año">
        {aniosDisponibles.map((a) => (<option key={a} value={a}>{a}</option>))}
      </select>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
      <HubShell>
        <HubTopBar
          grupo="equipo"
          modulo="Planilla"
          leaf={breadcrumbLeaf}
          esAdmin={esAdmin}
          onModulo={() => setTabActiva('resumen')}
        />

        {/* §B · HEADER banking-grade · ícono violet sólido + período (extraActions) + 6 acciones */}
        <HubHeader
          grupo="equipo"
          icon={BriefcaseBusiness}
          titulo="Planilla"
          subtitulo="Operación mensual · nómina · adelantos · incentivos · vacaciones · gratificaciones"
          extraActions={periodoSelector}
          acciones={[
            { label: 'Recargar', icon: RefreshCw, onClick: cargarShellData, tier: 'neutral', disabled: loadingShell },
            { label: 'Exportar', icon: Download, onClick: () => setModal({ kind: 'exportPayroll' }), tier: 'neutral' },
            { label: 'Cerrar mes', icon: Lock, onClick: () => setModal({ kind: 'cerrarMes' }), tier: 'config' },
            { label: 'Dar de baja', icon: UserMinus, onClick: () => setModal({ kind: 'bajaEmpleado' }), tier: 'danger' },
            { label: 'Nuevo empleado', icon: Plus, onClick: () => setModal({ kind: 'nuevoEmpleado' }), tier: 'neutral' },
            { label: 'Generar boletas', icon: Plus, onClick: () => setModal({ kind: 'generarBoletas' }), tier: 'primary' },
          ]}
        />

        {/* §C · KPI STRIP · 4 KPIs (Payroll rose · Personal emerald · Incentivos violet · Próx.gratif indigo) */}
        <HubKpiStrip cols={4} kpis={planillaKpis} />

        {/* §E · TABS · HubTabs (equipo → violet · scroll-x N6 · badges slate/amber) */}
        <HubTabs grupo="equipo" tabs={planillaTabs} activa={tabActiva} onChange={(id) => setTabActiva(id as TabId)} />

        {/* §F · BODY · Layout B · flush (las tabs auto-paddean p-4 sm:p-6) */}
        <HubBody flush>
          {tabActiva === 'resumen' && (
            <TabResumenPlanilla
              mes={mes}
              anio={anio}
              onGenerarBoletas={() => setModal({ kind: 'generarBoletas' })}
              onCalcularBonos={() => setModal({ kind: 'calcularBonos' })}
              onProcesarGratificacion={() =>
                setModal({
                  kind: 'procesarGratif',
                  mes: ([7, 12].includes(mes) ? mes : 7) as MesGratificacion,
                })
              }
              onBajaEmpleado={() => setModal({ kind: 'bajaEmpleado' })}
              onIrATab={(t) => setTabActiva(t)}
            />
          )}
          {tabActiva === 'boletas' && <TabBoletas />}
          {tabActiva === 'adelantos' && <TabAdelantos />}
          {tabActiva === 'incentivos' && (
            <TabIncentivos
              mes={mes}
              anio={anio}
              onNuevoEsquema={() => setModal({ kind: 'nuevoEsquema' })}
              onEditarEsquema={(esq) => setModal({ kind: 'editarEsquema', esquema: esq })}
              onCalcularMes={() => setModal({ kind: 'calcularBonos' })}
              onAprobarCalculo={(c) => setModal({ kind: 'aprobarBono', calculo: c })}
              onRechazarCalculo={(c) => setModal({ kind: 'rechazarBono', calculo: c })}
            />
          )}
          {tabActiva === 'vacaciones' && (
            <TabVacacionesGratificaciones
              mes={mes}
              anio={anio}
              onProcesarGratificacion={(m) => setModal({ kind: 'procesarGratif', mes: m })}
              onProgramarVacaciones={() => setModal({ kind: 'programarVacaciones' })}
            />
          )}
          {tabActiva === 'analisis' && <TabAnalisisReportes mes={mes} anio={anio} />}
        </HubBody>
      </HubShell>

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* TOAST notificaciones canon · auto-hide 4s                          */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 max-w-md rounded-lg shadow-lg border px-4 py-3 ${
            toast.kind === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="text-[12px] font-semibold">{toast.msg}</div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* MODALES F5 · canon FormModalV2 sky/indigo/purple                    */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      <ProcesarGratificacionModal
        isOpen={modal.kind === 'procesarGratif'}
        onClose={() => setModal({ kind: 'none' })}
        mes={modal.kind === 'procesarGratif' ? modal.mes : 7}
        anio={anio}
        onSuccess={(msg) => {
          setToast({ kind: 'success', msg });
          cargarShellData();
        }}
        onError={(msg) => setToast({ kind: 'error', msg })}
      />

      <ProgramarVacacionesModal
        isOpen={modal.kind === 'programarVacaciones'}
        onClose={() => setModal({ kind: 'none' })}
        onSuccess={(msg) => setToast({ kind: 'success', msg })}
        onError={(msg) => setToast({ kind: 'error', msg })}
      />

      <CalcularBonosMesModal
        isOpen={modal.kind === 'calcularBonos'}
        onClose={() => setModal({ kind: 'none' })}
        mes={mes}
        anio={anio}
        onSuccess={(msg) => {
          setToast({ kind: 'success', msg });
          cargarShellData();
        }}
        onError={(msg) => setToast({ kind: 'error', msg })}
      />

      <AprobarBonoModal
        isOpen={modal.kind === 'aprobarBono'}
        onClose={() => setModal({ kind: 'none' })}
        calculo={modal.kind === 'aprobarBono' ? modal.calculo : null}
        onSuccess={(msg) => {
          setToast({ kind: 'success', msg });
          cargarShellData();
        }}
        onError={(msg) => setToast({ kind: 'error', msg })}
      />

      <RechazarBonoModal
        isOpen={modal.kind === 'rechazarBono'}
        onClose={() => setModal({ kind: 'none' })}
        calculo={modal.kind === 'rechazarBono' ? modal.calculo : null}
        onSuccess={(msg) => {
          setToast({ kind: 'success', msg });
          cargarShellData();
        }}
        onError={(msg) => setToast({ kind: 'error', msg })}
      />

      <NuevoEsquemaIncentivoModal
        isOpen={modal.kind === 'nuevoEsquema'}
        onClose={() => setModal({ kind: 'none' })}
        onSuccess={(msg) => {
          setToast({ kind: 'success', msg });
          cargarShellData();
        }}
        onError={(msg) => setToast({ kind: 'error', msg })}
      />

      <EditarEsquemaIncentivoModal
        isOpen={modal.kind === 'editarEsquema'}
        onClose={() => setModal({ kind: 'none' })}
        esquema={modal.kind === 'editarEsquema' ? modal.esquema : null}
        onSuccess={(msg) => {
          setToast({ kind: 'success', msg });
          cargarShellData();
        }}
        onError={(msg) => setToast({ kind: 'error', msg })}
      />

      <GenerarBoletasModal
        isOpen={modal.kind === 'generarBoletas'}
        onClose={() => setModal({ kind: 'none' })}
        mes={mes}
        anio={anio}
        onSuccess={(msg) => {
          setToast({ kind: 'success', msg });
          cargarShellData();
        }}
        onError={(msg) => setToast({ kind: 'error', msg })}
      />

      <CerrarMesModal
        isOpen={modal.kind === 'cerrarMes'}
        onClose={() => setModal({ kind: 'none' })}
        mes={mes}
        anio={anio}
        onSuccess={(msg) => setToast({ kind: 'success', msg })}
        onError={(msg) => setToast({ kind: 'error', msg })}
      />

      <ExportPayrollModal
        isOpen={modal.kind === 'exportPayroll'}
        onClose={() => setModal({ kind: 'none' })}
        mes={mes}
        anio={anio}
        onSuccess={(msg) => setToast({ kind: 'success', msg })}
        onError={(msg) => setToast({ kind: 'error', msg })}
      />

      <WizardBajaEmpleadoModal
        isOpen={modal.kind === 'bajaEmpleado'}
        onClose={() => setModal({ kind: 'none' })}
        onSuccess={(msg) => {
          setToast({ kind: 'success', msg });
          cargarShellData();
        }}
        onError={(msg) => setToast({ kind: 'error', msg })}
      />

      {/* chk5.PERSONAS-v5.8 · E3 · Alta de empleado directa desde Planilla */}
      <NuevoEmpleadoModal
        isOpen={modal.kind === 'nuevoEmpleado'}
        onClose={() => setModal({ kind: 'none' })}
        onSuccess={(uid) => {
          setModal({ kind: 'none' });
          setToast({ kind: 'success', msg: `Empleado agregado a planilla (uid: ${uid.slice(0, 8)}...)` });
          cargarShellData();
        }}
      />
    </div>
  );
};

export default Planilla;
