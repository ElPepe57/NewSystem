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
 *   §A · Breadcrumb 3 niveles (Inicio › Finanzas y Contabilidad › Planilla)
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
  ChevronRight,
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
  CalendarDays,
} from 'lucide-react';
import { TabBoletas } from './components/TabBoletas';
import { TabAdelantos } from './components/TabAdelantos';
import { TabIncentivos } from './components/TabIncentivos';
import { TabVacacionesGratificaciones } from './components/TabVacacionesGratificaciones';
import { TabAnalisisReportes } from './components/TabAnalisisReportes';
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
import type { CalculoIncentivoMes } from '../../types/planilla.types';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

type TabId =
  | 'boletas'
  | 'adelantos'
  | 'incentivos'
  | 'vacaciones'
  | 'analisis';

interface TabConfig {
  id: TabId;
  label: string;
  labelSm?: string;
  Icon: React.ComponentType<{ className?: string }>;
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
  const ahora = new Date();
  const [mes, setMes] = useState<number>(ahora.getMonth() + 1);
  const [anio, setAnio] = useState<number>(ahora.getFullYear());
  const [tabActiva, setTabActiva] = useState<TabId>('boletas');

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

  // Tabs config canon
  const TABS: TabConfig[] = useMemo(
    () => [
      {
        id: 'boletas',
        label: 'Boletas del mes',
        labelSm: 'Boletas',
        Icon: FileText,
        badge:
          boletasMes.length > 0
            ? { label: String(boletasMes.length), tinte: 'sky' }
            : undefined,
      },
      {
        id: 'adelantos',
        label: 'Adelantos',
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
        Icon: Trophy,
        badge: { label: 'NUEVO', tinte: 'violet' },
      },
      {
        id: 'vacaciones',
        label: 'Vacaciones & Gratificaciones',
        labelSm: 'Vac.+Grat.',
        Icon: Palmtree,
      },
      {
        id: 'analisis',
        label: 'Análisis & Reportes',
        labelSm: 'Análisis',
        Icon: BarChart3,
        badge: { label: 'NUEVO', tinte: 'violet' },
      },
    ],
    [boletasMes.length, adelantosPendientes.length],
  );

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* §A · BREADCRUMB canon S9.D1 · 3 niveles */}
        <div className="border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center gap-3 bg-slate-50">
          <div className="flex items-center text-[12px] flex-1 min-w-0">
            <a className="text-slate-500 hover:text-sky-700 cursor-pointer flex-shrink-0">Inicio</a>
            <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5 flex-shrink-0" />
            <a
              className="text-slate-500 hover:text-sky-700 cursor-pointer flex-shrink-0"
              onClick={() => navigate('/contabilidad')}
            >
              Finanzas y Contabilidad
            </a>
            <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5 flex-shrink-0" />
            <span className="text-slate-900 font-semibold truncate">Planilla</span>
          </div>
        </div>

        {/* §B · HEADER banking-grade · icon sky gradient */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3 sm:gap-4 flex-wrap">
            <div className="flex items-start gap-3 flex-1 min-w-[260px]">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white flex-shrink-0">
                <BriefcaseBusiness className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Planilla</h1>
                <p className="text-[12px] sm:text-[13px] text-slate-500 leading-snug">
                  Operación mensual · nómina · adelantos · incentivos · vacaciones · gratificaciones
                </p>
              </div>
            </div>
            {/* Acciones header · 3-tier canon */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {/* Selector período */}
              <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={mes}
                  onChange={(e) => setMes(Number(e.target.value))}
                  className="text-[11px] font-semibold bg-transparent focus:outline-none cursor-pointer"
                  aria-label="Mes"
                >
                  {MESES_NOMBRE.map((m, i) => (
                    <option key={i} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={anio}
                  onChange={(e) => setAnio(Number(e.target.value))}
                  className="text-[11px] font-semibold bg-transparent focus:outline-none cursor-pointer"
                  aria-label="Año"
                >
                  {aniosDisponibles.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              {/* Tier neutral · Recargar */}
              <button
                type="button"
                onClick={cargarShellData}
                disabled={loadingShell}
                aria-label="Recargar datos"
                className="text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loadingShell ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Recargar</span>
              </button>
              {/* Tier neutral · Exportar */}
              <button
                type="button"
                aria-label="Exportar payroll"
                title="Exportar payroll del mes"
                className="text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <Download className="w-3 h-3" />
                <span className="hidden md:inline">Exportar</span>
              </button>
              {/* Tier destacada · Cerrar mes */}
              <button
                type="button"
                aria-label="Cerrar mes"
                title="Cerrar el mes de planilla (consolidar boletas + bonos)"
                className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <Lock className="w-3 h-3" />
                <span className="hidden md:inline">Cerrar mes</span>
              </button>
              {/* Tier primary · Nueva boleta */}
              <button
                type="button"
                aria-label="Nueva boleta"
                title="Crear boleta manual"
                className="text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden sm:inline">Nueva boleta</span>
              </button>
            </div>
          </div>
        </div>

        {/* §C · KPI STRIP · 4 cards canon mockup ACTO 1 */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <div className="bg-gradient-to-br from-sky-50 to-sky-100/40 ring-1 ring-sky-200/50 rounded-2xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-sky-700 font-bold">
                PAYROLL {mesNombreCorto(mes).toUpperCase()}
              </span>
              <Wallet className="w-3.5 h-3.5 text-sky-700 flex-shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold tabular-nums text-sky-900">
              {formatCurrencyPEN(payrollMes)}
            </div>
            <div className="text-[10px] sm:text-[11px] text-sky-700 mt-1 truncate">
              {boletasMes.length} boleta{boletasMes.length === 1 ? '' : 's'}
              {bonosMesPEN > 0 ? ` · ${formatCurrencyPEN(bonosMesPEN)} bonos` : ''}
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-emerald-700 font-bold">
                PERSONAL ACTIVO
              </span>
              <Users className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold tabular-nums text-emerald-900">
              {empleadosActivos}
            </div>
            <div className="text-[10px] sm:text-[11px] text-emerald-700 mt-1 truncate">
              empleado{empleadosActivos === 1 ? '' : 's'} con perfil laboral
            </div>
          </div>
          <div className="bg-gradient-to-br from-violet-50 to-violet-100/40 ring-1 ring-violet-200/50 rounded-2xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-violet-700 font-bold">
                INCENTIVOS MES
              </span>
              <Trophy className="w-3.5 h-3.5 text-violet-700 flex-shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold tabular-nums text-violet-900">
              {formatCurrencyPEN(bonosMesPEN)}
            </div>
            <div className="text-[10px] sm:text-[11px] text-violet-700 mt-1 truncate">
              bonos aprobados + en boleta
            </div>
          </div>
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 ring-1 ring-indigo-200/50 rounded-2xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-indigo-700 font-bold">
                PRÓX. GRATIF.
              </span>
              <CalendarDays className="w-3.5 h-3.5 text-indigo-700 flex-shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold tabular-nums text-indigo-900">
              {proximaGratificacion.fecha.getMonth() === 6 ? 'jul' : 'dic'}{' '}
              <span className="text-indigo-400">· {proximaGratificacion.dias}d</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-indigo-700 mt-1 truncate">
              jul/dic Perú · sin CTS
            </div>
          </div>
        </div>

        {/* §E · TABS ROW · 5 tabs · scroll-x mobile · canon N6 */}
        <div className="border-b border-slate-200 px-3 sm:px-6 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-1 whitespace-nowrap">
            {TABS.map((tab) => {
              const isActive = tab.id === tabActiva;
              const Icon = tab.Icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTabActiva(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`px-3 sm:px-4 py-2.5 text-[12px] border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-sky-600 text-sky-700 font-bold'
                      : 'border-transparent text-slate-600 hover:text-sky-600 font-medium'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.labelSm ?? tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        tab.badge.tinte === 'sky'
                          ? 'bg-sky-100 text-sky-700'
                          : tab.badge.tinte === 'amber'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-violet-100 text-violet-700'
                      }`}
                    >
                      {tab.badge.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* §F · BODY del tab activo */}
        <div>
          {tabActiva === 'boletas' && <TabBoletas />}
          {tabActiva === 'adelantos' && <TabAdelantos />}
          {tabActiva === 'incentivos' && (
            <TabIncentivos
              mes={mes}
              anio={anio}
              onNuevoEsquema={() => { /* F5.B: NuevoEsquemaIncentivoModal */ }}
              onEditarEsquema={(_esq) => { /* F5.B: EditarEsquemaIncentivoModal */ }}
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
        </div>
      </div>

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
    </div>
  );
};

export default Planilla;
