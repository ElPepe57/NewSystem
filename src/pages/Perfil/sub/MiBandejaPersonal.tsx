/**
 * MiBandejaPersonal · F10.F.1.J-SIDEBAR.5 · 2026-05-27
 *
 * Sub-página /perfil/mi-bandeja · Centro de mando admin.
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.7-mi-bandeja.html (10 actos · todos cubiertos).
 *
 * Sub-tabs internas:
 *   - Todos (default) · lista mixta
 *   - Usuarios pendientes · cards
 *   - Adelantos pendientes · tabla con bulk
 *   - Bonos calculados · cards con breakdown
 *   - Liquidaciones aprobadas · cards urgentes
 *
 * Permission boundary: solo admin/gerente (canManageUsers).
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Download,
  CheckSquare,
  LayoutGrid,
  UserPlus,
  ArrowDownCircle,
  Trophy,
  UserMinus,
  ArrowRight,
  AlertTriangle,
  Wallet,
  PenLine,
  ClipboardList,
  Banknote,
  Package,
} from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAuthStore } from '../../../store/authStore';
import { useToastStore } from '../../../store/toastStore';
import { getUserRoles } from '../../../types/auth.types';
import { useEgresosPendientesSocio, type EgresoPendienteConAccion } from '../../../hooks/useEgresosPendientesSocio';
import { firmarEgreso } from '../../../services/firmarEgreso.service';
import { useBandejaSignal } from '../../../store/bandejaSignalStore';
import { chipFirma, LABEL_ORIGEN, autorizacionCompleta, fechaMiFirma, type OrigenEgreso, type EgresoPendiente } from '../../../services/egresosPendientesSocio.helper';
import { BackArrowHeader } from '../../../components/common/BackArrowHeader';
import { useConfirmDialog, ConfirmDialog } from '../../../components/common';
import { calculoIncentivoService } from '../../../services/calculoIncentivo.service';
import { planillaService } from '../../../services/planilla.service';
import { userService } from '../../../services/user.service';
import type { UserRole } from '../../../types/auth.types';
import {
  collection,
  query,
  where,
  getDocs,
  limit as fbLimit,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { COLLECTIONS } from '../../../config/collections';

type SubTab = 'todos' | 'usuarios' | 'adelantos' | 'bonos' | 'liquidaciones' | 'egresos';

/** F4 · icono por origen del egreso (semántico cross-módulo). */
const ICONO_ORIGEN: Record<OrigenEgreso, React.ElementType> = {
  requerimiento: ClipboardList,
  gasto: Banknote,
  oc: Package,
};

interface BandejaData {
  usuariosPendientes: Array<{ id: string; nombre: string; email: string; origen: string; fechaInvitacion?: Date; rol?: string }>;
  adelantosPendientes: Array<{ id: string; userId: string; empleadoNombre: string; montoPEN: number; concepto?: string; fechaSolicitud?: Date }>;
  bonosCalculados: Array<{ id: string; userId: string; empleadoNombre: string; esquemaNombre: string; bonoCalculado: number; mes: number; anio: number }>;
  liquidacionesAprobadas: Array<{ id: string; userId: string; empleadoNombre: string; totalLiquidacion: number; tipoBaja?: string; fechaSalida?: Date }>;
}

const fmtMoney = (n: number): string =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const diasHastaCierre = (): number => {
  const ahora = new Date();
  const ultimo = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
  return Math.max(0, Math.ceil((ultimo.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)));
};

const fechaRelativa = (d: Date | undefined): string => {
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  const horas = Math.floor(diff / (1000 * 60 * 60));
  if (horas < 1) return 'hace minutos';
  if (horas < 24) return `hace ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias}d`;
};

export const MiBandejaPersonal: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const { canManageUsers, isSocio, isAdmin } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const toast = useToastStore();
  const { dialogProps, confirm } = useConfirmDialog();
  const [subTab, setSubTab] = useState<SubTab>('todos');
  const [data, setData] = useState<BandejaData | null>(null);
  const [loading, setLoading] = useState(true);
  // F4 · bump para recargar la data RRHH tras una acción (aprobar/rechazar).
  const [reloadKey, setReloadKey] = useState(0);
  const recargarRRHH = () => setReloadKey((k) => k + 1);

  // F4 · handlers RRHH · wirean los botones (antes inertes · DEUDA-F10.A) a los servicios que ya existen.
  const handleAprobarBono = async (id: string, nombre: string) => {
    if (!user) return;
    const ok = await confirm({ title: 'Aprobar bono', message: `¿Aprobar el bono de ${nombre}?`, confirmText: 'Aprobar', variant: 'success' });
    if (!ok) return;
    try {
      await calculoIncentivoService.aprobar(id, user.uid);
      toast.success(`Bono de ${nombre} aprobado`);
      recargarRRHH();
    } catch (e: any) { toast.error(e.message, 'Error al aprobar'); }
  };
  const handleRechazarBono = async (id: string, nombre: string) => {
    if (!user) return;
    const ok = await confirm({ title: 'Rechazar bono', message: `¿Rechazar el bono de ${nombre}? Esta acción queda registrada.`, confirmText: 'Rechazar', variant: 'danger' });
    if (!ok) return;
    try {
      await calculoIncentivoService.rechazar(id, user.uid, 'Rechazado por el aprobador desde la bandeja');
      toast.success(`Bono de ${nombre} rechazado`);
      recargarRRHH();
    } catch (e: any) { toast.error(e.message, 'Error al rechazar'); }
  };
  const handleAprobarUsuario = async (uid: string, nombre: string, rol?: string) => {
    if (!rol) { toast.warning(`${nombre} no tiene rol solicitado · asignalo desde Usuarios`); return; }
    const ok = await confirm({ title: 'Aprobar usuario', message: `¿Dar de alta a ${nombre} con rol "${rol}"?`, confirmText: 'Aprobar', variant: 'success' });
    if (!ok) return;
    try {
      await userService.aprobarUsuario(uid, rol as UserRole);
      toast.success(`${nombre} dado de alta`);
      recargarRRHH();
    } catch (e: any) { toast.error(e.message, 'Error al aprobar'); }
  };
  const handleRechazarAdelanto = async (id: string, nombre: string) => {
    const ok = await confirm({ title: 'Rechazar adelanto', message: `¿Anular el adelanto de ${nombre}?`, confirmText: 'Anular', variant: 'danger' });
    if (!ok) return;
    try {
      await planillaService.anularAdelanto(id);
      toast.success(`Adelanto de ${nombre} anulado`);
      recargarRRHH();
    } catch (e: any) { toast.error(e.message, 'Error al anular'); }
  };

  // F4 · bandeja unificada de egresos · admin VE (admin-ve-todo) · firmar exige rol socio.
  const verEgresos = isSocio || isAdmin;
  const { egresos, dadas, count: egresosCount, totalUSD: egresosTotalUSD, loading: egresosLoading, reload: reloadEgresos } = useEgresosPendientesSocio();
  // F4 · toggle dentro de la sub-tab Egresos: lo que espera mi firma vs lo que YA firmé.
  const [egresosVista, setEgresosVista] = useState<'por-firmar' | 'dadas'>('por-firmar');

  const handleFirmarEgreso = async (e: EgresoPendienteConAccion) => {
    if (!user || !userProfile) return;
    try {
      const res = await firmarEgreso(e.origen, e.id, user.uid, getUserRoles(userProfile));
      if (res.completa) {
        toast.success(`${LABEL_ORIGEN[e.origen]} ${e.numero} autorizado`, 'Egreso autorizado');
      } else {
        toast.warning(
          `Tu firma fue registrada. Falta ${res.faltanFirmas === 1 ? 'la firma de otro socio' : `${res.faltanFirmas} firmas de socios`} para autorizar.`,
        );
      }
      reloadEgresos();
      useBandejaSignal.getState().bump(); // refresca el badge del sidebar
    } catch (error: any) {
      toast.error(error.message, 'Error al firmar');
    }
  };

  // Card de egreso · reusada en el early-return (socio puro) y en la sub-tab Egresos (admin/gerente).
  const renderEgreso = (e: EgresoPendienteConAccion) => {
    const Icon = ICONO_ORIGEN[e.origen];
    return (
      <div key={`${e.origen}-${e.id}`} className="bg-white border border-violet-200 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-[220px] flex-1">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white flex-shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase text-violet-700 bg-violet-50 rounded px-1.5 py-0.5">{LABEL_ORIGEN[e.origen]}</span>
              <span className="text-[12px] font-bold text-slate-900 truncate">{e.numero}</span>
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {e.descripcion || '—'} · <span className="text-violet-600 font-medium">{chipFirma(e)}</span>
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[14px] font-bold tabular-nums text-amber-900">${e.montoUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          <div className="text-[9px] text-slate-400 uppercase">USD landed</div>
        </div>
        <div className="inline-flex items-center gap-1.5 flex-shrink-0">
          {e.puedeFirmar ? (
            <button
              onClick={() => handleFirmarEgreso(e)}
              className="text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 px-2.5 py-1 rounded inline-flex items-center gap-1"
            >
              <PenLine className="w-3 h-3" /> Firmar
            </button>
          ) : (
            <span className="text-[10px] text-slate-400 italic px-2">{!isSocio ? 'Autoridad del socio' : 'Esperando otro socio'}</span>
          )}
        </div>
      </div>
    );
  };

  // F4 · "Mis aprobaciones dadas" · card read-only de un egreso que YA firmé.
  const renderEgresoDado = (e: EgresoPendiente) => {
    const Icon = ICONO_ORIGEN[e.origen];
    const completo = autorizacionCompleta(e);
    const f = fechaMiFirma(e, user?.uid || '');
    const fechaDate = f && typeof f === 'object' && 'toDate' in (f as object) ? (f as { toDate: () => Date }).toDate() : undefined;
    return (
      <div key={`dada-${e.origen}-${e.id}`} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-[220px] flex-1">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white flex-shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase text-slate-600 bg-slate-100 rounded px-1.5 py-0.5">{LABEL_ORIGEN[e.origen]}</span>
              <span className="text-[12px] font-bold text-slate-900 truncate">{e.numero}</span>
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {e.descripcion || '—'}{fechaDate ? ` · firmaste ${fechaRelativa(fechaDate)}` : ''}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[14px] font-bold tabular-nums text-slate-700">${e.montoUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          <div className="text-[9px] text-slate-400 uppercase">USD landed</div>
        </div>
        <div className="inline-flex items-center gap-1.5 flex-shrink-0">
          {completo ? (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
              <CheckSquare className="w-3 h-3" /> Autorizado
            </span>
          ) : (
            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              Tu firma · falta {e.faltanFirmas} socio{e.faltanFirmas === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>
    );
  };

  // F4 · vista de Egresos con toggle "Por firmar / Mis aprobaciones dadas" · reusada en el main (admin/socio)
  // y en el early-return del socio puro. El toggle es MISMA data, dos lentes (canon TABS-vs-TOGGLE).
  const renderEgresosVista = () => (
    <>
      <div className="flex items-center gap-1.5 flex-wrap">
        {([
          { id: 'por-firmar' as const, label: 'Por firmar', count: egresos.length },
          { id: 'dadas' as const, label: 'Mis aprobaciones dadas', count: dadas.length },
        ]).map((v) => {
          const active = egresosVista === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setEgresosVista(v.id)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${
                active ? 'bg-violet-600 text-white' : 'text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {v.label}
              {v.count > 0 && (
                <span className={`text-[9px] font-bold rounded-full px-1.5 ${active ? 'bg-white/25' : 'bg-slate-100'}`}>{v.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {egresosVista === 'por-firmar' ? (
        egresos.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <CheckSquare className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-[15px] font-bold text-slate-900 mb-1">Sin egresos pendientes</h2>
            <p className="text-[12px] text-slate-600">No hay egresos esperando firma de socio.</p>
          </div>
        ) : (
          egresos.map(renderEgreso)
        )
      ) : dadas.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <PenLine className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-[15px] font-bold text-slate-900 mb-1">Todavía no firmaste egresos</h2>
          <p className="text-[12px] text-slate-600">Acá quedan registradas las autorizaciones que vayas dando.</p>
        </div>
      ) : (
        dadas.map(renderEgresoDado)
      )}
    </>
  );

  useEffect(() => {
    if (!canManageUsers) return;
    let cancelled = false;
    const cargar = async () => {
      setLoading(true);
      try {
        const [usersSnap, adelantosSnap, bonosSnap, liquidSnap] = await Promise.all([
          getDocs(query(
            collection(db, COLLECTIONS.USERS),
            where('estado', 'in', ['pendiente_aprobacion', 'invitado_no_registrado']),
            fbLimit(30),
          )).catch(() => null),
          getDocs(query(
            collection(db, COLLECTIONS.ADELANTOS_NOMINA),
            where('estado', '==', 'pendiente'),
            fbLimit(30),
          )).catch(() => null),
          getDocs(query(
            collection(db, COLLECTIONS.CALCULOS_INCENTIVO),
            where('estado', '==', 'calculado'),
            fbLimit(30),
          )).catch(() => null),
          getDocs(query(
            collection(db, COLLECTIONS.LIQUIDACIONES_EMPLEADO),
            where('estado', '==', 'aprobada'),
            fbLimit(30),
          )).catch(() => null),
        ]);

        if (cancelled) return;

        const usuariosPendientes = usersSnap?.docs.map((d) => {
          const u = d.data() as any;
          return {
            id: d.id,
            nombre: u.displayName || u.email || 'Usuario sin nombre',
            email: u.email || '—',
            origen: u.origen || (u.estado === 'invitado_no_registrado' ? 'invitacion_admin' : 'self_signup'),
            fechaInvitacion: u.fechaInvitacion?.toDate?.(),
            rol: u.role || u.roles?.[0],
          };
        }) ?? [];

        const adelantosPendientes = adelantosSnap?.docs.map((d) => {
          const a = d.data() as any;
          return {
            id: d.id,
            userId: a.userId,
            empleadoNombre: a.empleadoNombre || 'Empleado',
            montoPEN: a.montoPEN || a.monto || 0,
            concepto: a.concepto || a.razon,
            fechaSolicitud: a.fechaSolicitud?.toDate?.() || a.fecha?.toDate?.(),
          };
        }) ?? [];

        const bonosCalculados = bonosSnap?.docs.map((d) => {
          const b = d.data() as any;
          return {
            id: d.id,
            userId: b.userId,
            empleadoNombre: b.empleadoNombre || 'Empleado',
            esquemaNombre: b.esquemaNombre || 'Esquema sin nombre',
            bonoCalculado: b.bonoCalculado || 0,
            mes: b.mes,
            anio: b.anio,
          };
        }) ?? [];

        const liquidacionesAprobadas = liquidSnap?.docs.map((d) => {
          const l = d.data() as any;
          return {
            id: d.id,
            userId: l.userId,
            empleadoNombre: l.empleadoNombre || 'Empleado',
            totalLiquidacion: l.totalLiquidacionPEN || l.totalLiquidacion || 0,
            tipoBaja: l.tipoBaja,
            fechaSalida: l.fechaSalida?.toDate?.(),
          };
        }) ?? [];

        setData({ usuariosPendientes, adelantosPendientes, bonosCalculados, liquidacionesAprobadas });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    cargar();
    return () => {
      cancelled = true;
    };
  }, [canManageUsers, reloadKey]);

  // F4 · embedded (tab del hub Mi Espacio) → sin shell · standalone → con shell + BackArrowHeader.
  const wrap = (
    content: React.ReactNode,
    opts: { subtitulo?: string; acciones?: React.ReactNode; colorTone?: 'amber' | 'violet'; seccionLabel?: string } = {},
  ): React.ReactElement =>
    embedded ? (
      <>
        {(opts.subtitulo || opts.acciones) && (
          <div className="px-4 sm:px-5 md:px-6 pt-3 flex items-center justify-between gap-2 flex-wrap">
            {opts.subtitulo && <div className="text-[12px] text-slate-500">{opts.subtitulo}</div>}
            {opts.acciones && <div className="flex items-center gap-1.5 flex-wrap">{opts.acciones}</div>}
          </div>
        )}
        {content}
      </>
    ) : (
      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          <BackArrowHeader
            seccionLabel={opts.seccionLabel ?? 'Mi bandeja'}
            icon={ShieldCheck}
            colorTone={opts.colorTone ?? 'amber'}
            subtitulo={opts.subtitulo}
            acciones={opts.acciones}
          />
          {content}
        </div>
      </div>
    );

  if (!canManageUsers && !verEgresos) {
    return wrap(
      <div className="p-8 text-center">
        <ShieldCheck className="w-16 h-16 mx-auto mb-3 text-slate-300" />
        <h2 className="text-[15px] font-bold text-slate-900 mb-2">Vista no disponible</h2>
        <p className="text-[12px] text-slate-600 mb-4 max-w-md mx-auto">
          Esta vista es para admin/gerente (aprobaciones del equipo) o socios (autorización de egresos).
        </p>
        {!embedded && (
          <button onClick={() => navigate('/perfil')} className="text-[12px] font-bold text-white bg-violet-600 hover:bg-violet-700 px-4 py-2 rounded-lg">
            Volver al perfil
          </button>
        )}
      </div>
    );
  }

  // F4 · socio PURO (no admin/gerente): bandeja SOLO de egresos · no usa la maquinaria RRHH.
  if (!canManageUsers && verEgresos) {
    return wrap(
      <div className="p-4 sm:p-5 md:p-6 space-y-3 bg-slate-50/30">
        {egresosLoading ? (
          <div className="text-center text-slate-400 text-[12px] py-8">Cargando egresos…</div>
        ) : (
          renderEgresosVista()
        )}
      </div>,
      {
        seccionLabel: 'Mi bandeja · Egresos',
        colorTone: 'violet',
        subtitulo: egresosLoading
          ? 'Cargando…'
          : `${egresosCount} esperan tu firma · $${egresosTotalUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD pendiente`,
      },
    );
  }

  if (loading || !data) {
    return wrap(
      <div className="p-8 text-center text-slate-400 text-[12px]">Cargando aprobaciones pendientes...</div>,
      { subtitulo: 'Cargando...' },
    );
  }

  const totalAdelantos = data.adelantosPendientes.reduce((sum, a) => sum + a.montoPEN, 0);
  const totalBonos = data.bonosCalculados.reduce((sum, b) => sum + b.bonoCalculado, 0);
  const totalLiquidaciones = data.liquidacionesAprobadas.reduce((sum, l) => sum + l.totalLiquidacion, 0);
  const totalPendientes =
    data.usuariosPendientes.length +
    data.adelantosPendientes.length +
    data.bonosCalculados.length +
    data.liquidacionesAprobadas.length;

  // Sub-tabs config
  const TABS_CFG: Array<{ id: SubTab; label: string; icon: React.ElementType; count: number }> = [
    { id: 'todos', label: 'Todos', icon: LayoutGrid, count: totalPendientes },
    { id: 'usuarios', label: 'Usuarios', icon: UserPlus, count: data.usuariosPendientes.length },
    { id: 'adelantos', label: 'Adelantos', icon: ArrowDownCircle, count: data.adelantosPendientes.length },
    { id: 'bonos', label: 'Bonos', icon: Trophy, count: data.bonosCalculados.length },
    { id: 'liquidaciones', label: 'Liquidaciones', icon: UserMinus, count: data.liquidacionesAprobadas.length },
    ...(verEgresos ? [{ id: 'egresos' as SubTab, label: 'Egresos', icon: Wallet, count: egresos.length }] : []),
  ];

  // Empty state global (incluye egresos para no decir "todo al día" si hay egresos pendientes o cargando)
  if (totalPendientes === 0 && !(verEgresos && (egresosLoading || egresos.length > 0 || dadas.length > 0))) {
    return wrap(
      <div className="p-8 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckSquare className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-[16px] font-bold text-slate-900 mb-1">¡Todo al día!</h2>
        <p className="text-[12px] text-slate-600 max-w-sm mx-auto">
          No hay aprobaciones pendientes en tu bandeja. Excelente trabajo manteniendo el ritmo del equipo.
        </p>
      </div>,
      { subtitulo: 'Centro de mando · estado al día' },
    );
  }

  const accionesBandeja = (
    <>
      <button className="text-[11px] font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5">
        <Download className="w-3.5 h-3.5" />
        Exportar
      </button>
      <button className="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5">
        <CheckSquare className="w-3.5 h-3.5" />
        Aprobar todo ({totalPendientes})
      </button>
    </>
  );

  return wrap(
    <>

        {/* KPI strip 4 cards · canon mockup v5.7 ACTO 1 */}
        <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/30">
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">USUARIOS</span>
              <UserPlus className="w-3.5 h-3.5 text-amber-700" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-amber-900">{data.usuariosPendientes.length}</div>
            <div className="text-[10px] text-amber-700">esperan alta</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">ADELANTOS</span>
              <ArrowDownCircle className="w-3.5 h-3.5 text-amber-700" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-amber-900">{data.adelantosPendientes.length}</div>
            <div className="text-[10px] text-amber-700">{fmtMoney(totalAdelantos)} total</div>
          </div>
          <div className="bg-gradient-to-br from-violet-50 to-violet-100/40 ring-1 ring-violet-200/50 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-violet-700 font-bold">BONOS</span>
              <Trophy className="w-3.5 h-3.5 text-violet-700" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-violet-900">{data.bonosCalculados.length}</div>
            <div className="text-[10px] text-violet-700">{fmtMoney(totalBonos)} calculado</div>
          </div>
          <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">LIQUIDACIONES</span>
              <UserMinus className="w-3.5 h-3.5 text-rose-700" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-rose-900">{data.liquidacionesAprobadas.length}</div>
            <div className="text-[10px] text-rose-700">{fmtMoney(totalLiquidaciones)} a pagar</div>
          </div>
          {verEgresos && (
            <div className="bg-gradient-to-br from-violet-50 to-violet-100/40 ring-1 ring-violet-200/50 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-violet-700 font-bold">EGRESOS</span>
                <Wallet className="w-3.5 h-3.5 text-violet-700" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-violet-900">{egresos.length}</div>
              <div className="text-[10px] text-violet-700">
                ${egresosTotalUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD · {egresosCount} firmables
              </div>
            </div>
          )}
        </div>

        {/* Sub-tabs · canon mockup v5.7 ACTO 1 */}
        <div className="px-6 border-b border-slate-200 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-1 whitespace-nowrap">
            {TABS_CFG.map((t) => {
              const Icon = t.icon;
              const active = subTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSubTab(t.id)}
                  className={`px-4 py-2.5 text-[12px] flex items-center gap-1.5 border-b-2 transition-colors min-h-[44px] ${
                    active
                      ? 'font-bold border-amber-600 text-amber-700'
                      : 'font-medium border-transparent text-slate-600 hover:text-amber-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                  {t.count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums ${active ? 'bg-amber-100' : 'bg-slate-100'}`}>
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body por sub-tab */}
        <div className="p-4 sm:p-5 md:p-6 space-y-3 bg-slate-50/30">
          {/* ─── Sub-tab TODOS · lista mixta agrupada ─── */}
          {subTab === 'todos' && (
            <>
              {data.usuariosPendientes.length > 0 && (
                <button
                  onClick={() => setSubTab('usuarios')}
                  className="w-full bg-white border border-amber-200 hover:bg-amber-50/40 rounded-lg p-3 flex items-center justify-between text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <UserPlus className="w-4 h-4 text-amber-700" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-slate-900">
                          {data.usuariosPendientes.length} usuario{data.usuariosPendientes.length > 1 ? 's' : ''} esperan aprobación
                        </span>
                        <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase">USUARIOS</span>
                      </div>
                      <div className="text-[10px] text-slate-600">
                        {data.usuariosPendientes.slice(0, 2).map((u) => u.nombre).join(' · ')}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-amber-700" />
                </button>
              )}
              {data.adelantosPendientes.length > 0 && (
                <button
                  onClick={() => setSubTab('adelantos')}
                  className="w-full bg-white border border-amber-200 hover:bg-amber-50/40 rounded-lg p-3 flex items-center justify-between text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ArrowDownCircle className="w-4 h-4 text-amber-700" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-slate-900">
                          {data.adelantosPendientes.length} adelanto{data.adelantosPendientes.length > 1 ? 's' : ''} pendiente{data.adelantosPendientes.length > 1 ? 's' : ''} · {fmtMoney(totalAdelantos)} total
                        </span>
                        <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase">ADELANTOS</span>
                      </div>
                      <div className="text-[10px] text-slate-600">
                        {data.adelantosPendientes.slice(0, 3).map((a) => `${a.empleadoNombre} (${fmtMoney(a.montoPEN)})`).join(' · ')}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-amber-700" />
                </button>
              )}
              {data.bonosCalculados.length > 0 && (
                <button
                  onClick={() => setSubTab('bonos')}
                  className="w-full bg-white border border-violet-200 hover:bg-violet-50/40 rounded-lg p-3 flex items-center justify-between text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Trophy className="w-4 h-4 text-violet-700" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-slate-900">
                          {data.bonosCalculados.length} bono{data.bonosCalculados.length > 1 ? 's' : ''} calculado{data.bonosCalculados.length > 1 ? 's' : ''} · {fmtMoney(totalBonos)}
                        </span>
                        <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-bold uppercase">BONOS</span>
                      </div>
                      <div className="text-[10px] text-slate-600">Esperando aprobación gerencial</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-violet-700" />
                </button>
              )}
              {data.liquidacionesAprobadas.length > 0 && (
                <button
                  onClick={() => setSubTab('liquidaciones')}
                  className="w-full bg-white border border-rose-200 hover:bg-rose-50/40 rounded-lg p-3 flex items-center justify-between text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <UserMinus className="w-4 h-4 text-rose-700" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-slate-900">
                          {data.liquidacionesAprobadas.length} liquidación · {fmtMoney(totalLiquidaciones)} a pagar
                        </span>
                        <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold uppercase">LIQUIDACIÓN</span>
                      </div>
                      <div className="text-[10px] text-slate-600">
                        <strong className="text-rose-700">Evitar quedar +7 días</strong>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-rose-700" />
                </button>
              )}
            </>
          )}

          {/* ─── Sub-tab USUARIOS ─── */}
          {subTab === 'usuarios' && data.usuariosPendientes.map((u) => (
            <div key={u.id} className="bg-white border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0">
                  {u.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[13px] font-bold text-slate-900">{u.nombre}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      u.origen === 'invitacion_admin' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {u.origen === 'invitacion_admin' ? 'INVITADO' : 'SELF-SIGNUP'}
                    </span>
                    {u.fechaInvitacion && <span className="text-[10px] text-slate-500">{fechaRelativa(u.fechaInvitacion)}</span>}
                  </div>
                  <div className="text-[11px] text-slate-600 mb-1">{u.email} {u.rol ? `· solicitó rol: ${u.rol}` : ''}</div>
                  {u.origen === 'self_signup' && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                      <AlertTriangle className="w-3 h-3" />
                      Trust bajo · verificar antes de aprobar
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => navigate('/usuarios')} className="text-[11px] font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded">Rechazar</button>
                  <button onClick={() => handleAprobarUsuario(u.id, u.nombre, u.rol)} className="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded">Aprobar</button>
                </div>
              </div>
            </div>
          ))}

          {/* ─── Sub-tab ADELANTOS ─── */}
          {subTab === 'adelantos' && data.adelantosPendientes.map((a) => (
            <div key={a.id} className="bg-white border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-[200px] flex-1">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white font-bold text-[12px] flex-shrink-0">
                  {a.empleadoNombre.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-bold text-slate-900">{a.empleadoNombre}</div>
                  <div className="text-[10px] text-slate-500">
                    {a.concepto ? `"${a.concepto}"` : 'Sin concepto'}{a.fechaSolicitud ? ` · ${fechaRelativa(a.fechaSolicitud)}` : ''}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-bold tabular-nums text-amber-900">{fmtMoney(a.montoPEN)}</div>
              </div>
              <div className="inline-flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => handleRechazarAdelanto(a.id, a.empleadoNombre)} className="text-[11px] font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 px-2 py-1 rounded">Rechazar</button>
                <button onClick={() => navigate('/planilla')} className="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2 py-1 rounded">Pagar</button>
              </div>
            </div>
          ))}

          {/* ─── Sub-tab BONOS ─── */}
          {subTab === 'bonos' && data.bonosCalculados.map((b) => (
            <div key={b.id} className="bg-violet-50/40 border border-violet-200 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3 flex-wrap">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white flex-shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <div className="text-[14px] font-bold text-slate-900">{b.empleadoNombre} · {b.esquemaNombre}</div>
                  <div className="text-[11px] text-slate-600">Período {b.mes}/{b.anio}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-violet-700 font-bold">BONO</div>
                  <div className="text-2xl font-bold tabular-nums text-violet-900">{fmtMoney(b.bonoCalculado)}</div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => handleRechazarBono(b.id, b.empleadoNombre)} className="text-[11px] font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded">Rechazar</button>
                <button onClick={() => handleAprobarBono(b.id, b.empleadoNombre)} className="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded">Aprobar</button>
              </div>
            </div>
          ))}

          {/* ─── Sub-tab LIQUIDACIONES ─── */}
          {subTab === 'liquidaciones' && data.liquidacionesAprobadas.map((l) => {
            const diasDesdeSalida = l.fechaSalida ? Math.floor((Date.now() - l.fechaSalida.getTime()) / (1000 * 60 * 60 * 24)) : 0;
            const urgente = diasDesdeSalida > 5;
            return (
              <div key={l.id} className={`${urgente ? 'bg-rose-50/40 border-2 border-rose-300' : 'bg-white border border-rose-200'} rounded-xl p-4`}>
                <div className="flex items-start gap-3 mb-3 flex-wrap">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-white flex-shrink-0">
                    <UserMinus className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-bold text-slate-900">{l.empleadoNombre}</span>
                      {l.tipoBaja && (
                        <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold uppercase">
                          {l.tipoBaja}
                        </span>
                      )}
                      {urgente && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase">
                          URGENTE · {diasDesdeSalida}d
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Aprobada{l.fechaSalida ? ` · salida ${fechaRelativa(l.fechaSalida)}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">TOTAL A PAGAR</div>
                    <div className="text-2xl font-bold tabular-nums text-rose-900">{fmtMoney(l.totalLiquidacion)}</div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => navigate('/planilla')} className="text-[11px] font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded">Ver acta</button>
                  <button onClick={() => navigate('/planilla')} className="text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded">Registrar pago</button>
                </div>
              </div>
            );
          })}

          {/* ─── Sub-tab EGRESOS · autorización de socio (F4) ─── */}
          {subTab === 'egresos' && renderEgresosVista()}
        </div>
        <ConfirmDialog {...dialogProps} />
        </>,
        {
          seccionLabel: 'Mi bandeja · Centro de mando',
          subtitulo: `${totalPendientes} aprobacion${totalPendientes !== 1 ? 'es' : ''} esperando tu acción · revisar antes del cierre`,
          acciones: accionesBandeja,
        },
      );
};

export default MiBandejaPersonal;
