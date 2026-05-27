/**
 * ResumenAdmin · F10.F.1.J · 2026-05-27
 *
 * Vista RESUMEN del Tab cuando el user tiene rol admin/gerente.
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 3 (líneas 323-455).
 *
 * Estructura:
 *   1. Banner gestión "Tienes N acciones esperando tu aprobación"
 *   2. KPI mini strip 4 cards: PEND. APROBAR · USUARIOS · CIERRE MES · LIQUIDACIONES
 *   3. Bandeja de aprobaciones (4 cards apiladas linkable)
 *   4. Accesos rápidos de gestión (4 quick actions)
 *
 * Data:
 *   - Cuenta usuarios pendiente_aprobacion + invitado_no_registrado
 *   - Cuenta adelantos estado=pendiente
 *   - Cuenta calculos estado=calculado (bono pendiente aprobación)
 *   - Cuenta liquidaciones estado=aprobada (aprobada pero no pagada)
 *   - Total usuarios activos
 *   - Días hasta cierre del mes (último día del mes - hoy)
 */
import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Users,
  CalendarCheck,
  UserMinus,
  ListChecks,
  UserPlus,
  ArrowDownCircle,
  Trophy,
  ArrowRight,
  BriefcaseBusiness,
  CheckSquare,
  Shield,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  limit as fbLimit,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { COLLECTIONS } from '../../../config/collections';

interface ResumenAdminData {
  usuariosPendientes: number;
  usuariosTotal: number;
  adelantosPendientes: number;
  adelantosTotalPEN: number;
  bonosPendientes: number;
  bonosTotalPEN: number;
  liquidacionesPendientes: number;
  liquidacionesTotalPEN: number;
  diasHastaCierre: number;
  mesActualLabel: string;
}

const MES_LABEL = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const fmtMoney = (n: number): string =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const calcularDiasHastaCierre = (): { dias: number; mesLabel: string } => {
  const ahora = new Date();
  const ultimoDiaMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
  const diffMs = ultimoDiaMes.getTime() - ahora.getTime();
  const dias = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  return { dias, mesLabel: MES_LABEL[ahora.getMonth() + 1] };
};

export const ResumenAdmin: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<ResumenAdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const cargar = async () => {
      setLoading(true);
      try {
        const { dias, mesLabel } = calcularDiasHastaCierre();

        // 1. Usuarios pendientes de aprobación · estado pendiente_aprobacion o invitado_no_registrado
        // Backward-compat: docs viejos pueden NO tener `estado` · usar activo=false como proxy
        const usuariosRef = collection(db, COLLECTIONS.USERS);
        const [usuariosPendQ, usuariosTotalQ] = await Promise.all([
          getDocs(query(usuariosRef, where('estado', 'in', ['pendiente_aprobacion', 'invitado_no_registrado']), fbLimit(20))).catch(() => null),
          getDocs(query(usuariosRef, where('activo', '==', true), fbLimit(100))).catch(() => null),
        ]);
        const usuariosPendientes = usuariosPendQ?.size || 0;
        const usuariosTotal = usuariosTotalQ?.size || 0;

        // 2. Adelantos pendientes
        const adelantosRef = collection(db, COLLECTIONS.ADELANTOS_NOMINA);
        const adelantosSnap = await getDocs(
          query(adelantosRef, where('estado', '==', 'pendiente'), fbLimit(50)),
        ).catch(() => null);
        let adelantosTotalPEN = 0;
        const adelantosPendientes = adelantosSnap?.size || 0;
        adelantosSnap?.docs.forEach((d) => {
          const data = d.data() as any;
          adelantosTotalPEN += data.montoPEN || data.monto || 0;
        });

        // 3. Bonos calculados pendientes de aprobación
        const calculosRef = collection(db, COLLECTIONS.CALCULOS_INCENTIVO);
        const calculosSnap = await getDocs(
          query(calculosRef, where('estado', '==', 'calculado'), fbLimit(50)),
        ).catch(() => null);
        let bonosTotalPEN = 0;
        const bonosPendientes = calculosSnap?.size || 0;
        calculosSnap?.docs.forEach((d) => {
          const data = d.data() as any;
          bonosTotalPEN += data.bonoCalculado || 0;
        });

        // 4. Liquidaciones aprobadas pendientes de pago
        const liquidacionesRef = collection(db, COLLECTIONS.LIQUIDACIONES_EMPLEADO);
        const liquidacionesSnap = await getDocs(
          query(liquidacionesRef, where('estado', '==', 'aprobada'), fbLimit(50)),
        ).catch(() => null);
        let liquidacionesTotalPEN = 0;
        const liquidacionesPendientes = liquidacionesSnap?.size || 0;
        liquidacionesSnap?.docs.forEach((d) => {
          const data = d.data() as any;
          liquidacionesTotalPEN += data.totalLiquidacionPEN || data.totalLiquidacion || 0;
        });

        if (cancelled) return;
        setData({
          usuariosPendientes,
          usuariosTotal,
          adelantosPendientes,
          adelantosTotalPEN,
          bonosPendientes,
          bonosTotalPEN,
          liquidacionesPendientes,
          liquidacionesTotalPEN,
          diasHastaCierre: dias,
          mesActualLabel: mesLabel,
        });
      } catch (err) {
        console.error('[ResumenAdmin] Error cargando data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    cargar();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 text-center text-slate-400 text-[12px]">
        Cargando vista de admin...
      </div>
    );
  }

  const totalPendientes =
    data.usuariosPendientes +
    data.adelantosPendientes +
    data.bonosPendientes +
    data.liquidacionesPendientes;

  const bannerSubtitulo = [
    data.usuariosPendientes > 0 ? `${data.usuariosPendientes} usuario${data.usuariosPendientes > 1 ? 's' : ''}` : null,
    data.adelantosPendientes > 0 ? `${data.adelantosPendientes} adelanto${data.adelantosPendientes > 1 ? 's' : ''}` : null,
    data.bonosPendientes > 0 ? `${data.bonosPendientes} bono${data.bonosPendientes > 1 ? 's' : ''}` : null,
    data.liquidacionesPendientes > 0 ? `${data.liquidacionesPendientes} liquidación` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-5">
      {/* Banner gestión · canon mockup líneas 325-333 */}
      {totalPendientes > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-violet-50 ring-1 ring-purple-300 rounded-xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-purple-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-bold text-purple-900 mb-0.5">
              Tienes {totalPendientes} acción{totalPendientes > 1 ? 'es' : ''} esperando tu aprobación
            </div>
            <div className="text-[11px] text-purple-800">
              {bannerSubtitulo} · revisar antes del cierre
            </div>
          </div>
        </div>
      )}

      {/* KPI mini strip · canon mockup líneas 336-369 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">PEND. APROBAR</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-900">{totalPendientes}</div>
          <div className="text-[10px] text-amber-700">requieren mi acción</div>
        </div>
        <div className="bg-gradient-to-br from-sky-50 to-sky-100/40 ring-1 ring-sky-200/50 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-sky-700 font-bold">USUARIOS</span>
            <Users className="w-3.5 h-3.5 text-sky-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-sky-900">{data.usuariosTotal}</div>
          <div className="text-[10px] text-sky-700">
            {data.usuariosPendientes > 0
              ? `${data.usuariosPendientes} pendiente${data.usuariosPendientes > 1 ? 's' : ''} alta`
              : 'todos activos'}
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">CIERRE MES</span>
            <CalendarCheck className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">{data.diasHastaCierre}d</div>
          <div className="text-[10px] text-emerald-700">de {data.mesActualLabel} {new Date().getFullYear()}</div>
        </div>
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">LIQUIDACIONES</span>
            <UserMinus className="w-3.5 h-3.5 text-rose-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-rose-900">{data.liquidacionesPendientes}</div>
          <div className="text-[10px] text-rose-700">
            {data.liquidacionesPendientes > 0 ? 'aprob. pend. pago' : 'sin pendientes'}
          </div>
        </div>
      </div>

      {/* Bandeja de aprobaciones · canon mockup líneas 372-419 */}
      {totalPendientes > 0 && (
        <div>
          <h3 className="text-[13px] font-bold text-slate-900 mb-2 inline-flex items-center gap-1.5">
            <ListChecks className="w-4 h-4 text-purple-700" />
            Tu bandeja de aprobaciones
          </h3>
          <div className="space-y-2">
            {data.usuariosPendientes > 0 && (
              <button
                type="button"
                onClick={() => navigate('/usuarios?filter=pendientes')}
                className="w-full bg-white border border-amber-200 hover:bg-amber-50/40 rounded-lg p-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <UserPlus className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-slate-900">
                      {data.usuariosPendientes} usuario{data.usuariosPendientes > 1 ? 's' : ''} esperan aprobación
                    </div>
                    <div className="text-[10px] text-slate-600">
                      Revisar nuevos signups e invitaciones pendientes
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-700 flex-shrink-0" />
              </button>
            )}
            {data.adelantosPendientes > 0 && (
              <button
                type="button"
                onClick={() => navigate('/planilla?tab=adelantos')}
                className="w-full bg-white border border-amber-200 hover:bg-amber-50/40 rounded-lg p-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ArrowDownCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-slate-900">
                      {data.adelantosPendientes} adelanto{data.adelantosPendientes > 1 ? 's' : ''} pendiente{data.adelantosPendientes > 1 ? 's' : ''} · {fmtMoney(data.adelantosTotalPEN)} total
                    </div>
                    <div className="text-[10px] text-slate-600">Revisar antes de fin de mes</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-700 flex-shrink-0" />
              </button>
            )}
            {data.bonosPendientes > 0 && (
              <button
                type="button"
                onClick={() => navigate('/planilla?tab=incentivos')}
                className="w-full bg-white border border-violet-200 hover:bg-violet-50/40 rounded-lg p-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Trophy className="w-4 h-4 text-violet-700 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-slate-900">
                      {data.bonosPendientes} bono{data.bonosPendientes > 1 ? 's' : ''} calculado{data.bonosPendientes > 1 ? 's' : ''} · {fmtMoney(data.bonosTotalPEN)}
                    </div>
                    <div className="text-[10px] text-slate-600">Esquemas de incentivo · esperando aprobación gerencial</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-violet-700 flex-shrink-0" />
              </button>
            )}
            {data.liquidacionesPendientes > 0 && (
              <button
                type="button"
                onClick={() => navigate('/planilla?tab=incentivos&estado=liquidacion')}
                className="w-full bg-white border border-rose-200 hover:bg-rose-50/40 rounded-lg p-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <UserMinus className="w-4 h-4 text-rose-700 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-slate-900">
                      {data.liquidacionesPendientes} liquidación aprobada · {fmtMoney(data.liquidacionesTotalPEN)} a pagar
                    </div>
                    <div className="text-[10px] text-slate-600">Procesar pagos · evitar quedar +7 días</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-rose-700 flex-shrink-0" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick actions admin · canon mockup líneas 422-453 */}
      <div>
        <h3 className="text-[13px] font-bold text-slate-900 mb-2">Accesos rápidos de gestión</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => navigate('/usuarios')}
            className="bg-white border border-purple-200 hover:bg-purple-50/30 rounded-lg p-3 text-left transition-colors"
          >
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mb-1.5">
              <Users className="w-4 h-4 text-purple-700" />
            </div>
            <div className="text-[11px] font-bold text-slate-900">Ir a /usuarios</div>
            <div className="text-[10px] text-slate-500">directorio completo</div>
          </button>
          <button
            type="button"
            onClick={() => navigate('/planilla?tab=resumen')}
            className="bg-white border border-sky-200 hover:bg-sky-50/30 rounded-lg p-3 text-left transition-colors"
          >
            <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center mb-1.5">
              <BriefcaseBusiness className="w-4 h-4 text-sky-700" />
            </div>
            <div className="text-[11px] font-bold text-slate-900">Cerrar mes planilla</div>
            <div className="text-[10px] text-slate-500">en {data.diasHastaCierre} día{data.diasHastaCierre !== 1 ? 's' : ''}</div>
          </button>
          <button
            type="button"
            onClick={() => navigate('/planilla?tab=adelantos&action=batch')}
            className="bg-white border border-emerald-200 hover:bg-emerald-50/30 rounded-lg p-3 text-left transition-colors"
          >
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center mb-1.5">
              <CheckSquare className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-[11px] font-bold text-slate-900">Aprobar todo</div>
            <div className="text-[10px] text-slate-500">batch aprobaciones</div>
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/auditoria')}
            className="bg-white border border-slate-200 hover:bg-slate-50 rounded-lg p-3 text-left transition-colors"
          >
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center mb-1.5">
              <Shield className="w-4 h-4 text-slate-700" />
            </div>
            <div className="text-[11px] font-bold text-slate-900">Ver auditoría</div>
            <div className="text-[10px] text-slate-500">log de cambios</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResumenAdmin;
