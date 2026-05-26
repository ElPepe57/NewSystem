/**
 * src/components/modules/usuarios/TabPlanilla.tsx
 * chk5.F4-USERS (2026-05-25) · Tab "Planilla" del módulo /usuarios.
 *
 * Cross-link a /planilla (módulo dedicado de boletas + adelantos).
 * Muestra preview compuesto desde users con rol='planilla' + datosLaborales.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, ArrowRight, Building2, Home, Laptop } from 'lucide-react';
import type { UserProfile } from '../../../types/auth.types';
import { hasRole } from '../../../types/auth.types';

interface Props {
  usuarios: UserProfile[];
}

export default function TabPlanilla({ usuarios }: Props) {
  const navigate = useNavigate();

  const planilla = useMemo(() => usuarios.filter((u) => hasRole(u, 'planilla' as never) || (hasRole as never as (u: UserProfile, r: string) => boolean)(u as never, 'finanzas')), []);
  // Para planilla canon · roles que típicamente están en planilla:
  // vendedor · comprador · almacenero · finanzas (sin admin/gerente que son owners)
  const enPlanilla = useMemo(
    () =>
      usuarios.filter((u) => {
        const roles = u.roles || (u.role ? [u.role] : []);
        return roles.some((r) => ['vendedor', 'comprador', 'almacenero', 'finanzas', 'supervisor'].includes(r));
      }),
    [usuarios],
  );
  const total = enPlanilla.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
            <BriefcaseBusiness className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-slate-900">Personal en planilla</h2>
            <p className="text-[11px] text-slate-500">{total} {total === 1 ? 'persona activa' : 'personas activas'} · vínculo laboral</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/planilla')}
          className="bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
        >
          Ver en Planilla
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* KPI strip · sky */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-sky-50 to-sky-100/40 ring-1 ring-sky-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-sky-700 font-bold">EN PLANILLA</span>
            <BriefcaseBusiness className="w-3.5 h-3.5 text-sky-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-sky-900">{total}</div>
          <div className="text-[10px] text-sky-700 mt-1">con vínculo laboral</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">PAYROLL MES</span>
            <Building2 className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">—</div>
          <div className="text-[10px] text-emerald-700 mt-1">ver detalle en Planilla</div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 ring-1 ring-indigo-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-indigo-700 font-bold">MODALIDAD</span>
            <Laptop className="w-3.5 h-3.5 text-indigo-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-indigo-900">—</div>
          <div className="text-[10px] text-indigo-700 mt-1">presencial · híbrido · remoto</div>
        </div>
      </div>

      {/* Lista de personal */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-3">Personal vinculado</div>
        {enPlanilla.length === 0 ? (
          <div className="text-center py-8">
            <BriefcaseBusiness className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-[13px] font-bold text-slate-900 mb-1">Sin personal en planilla</p>
            <p className="text-[11px] text-slate-500 mb-4">
              Las personas se vinculan a planilla asignándoles un rol operativo (vendedor · comprador · etc.).
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {enPlanilla.slice(0, 8).map((p) => {
              const roles = p.roles || (p.role ? [p.role] : []);
              return (
                <div
                  key={p.uid}
                  className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-sky-50/30 rounded-lg cursor-pointer transition-colors"
                  onClick={() => navigate(`/usuarios/${p.uid}/ficha`)}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-sky-600 rounded-full flex items-center justify-center text-white font-bold text-[12px]">
                    {p.displayName?.substring(0, 2).toUpperCase() || 'P'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-slate-900 truncate">{p.displayName}</div>
                    <div className="text-[11px] text-slate-500 truncate">{p.email} · {roles.join(' · ')}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-sky-600 flex-shrink-0" />
                </div>
              );
            })}
            {enPlanilla.length > 8 && (
              <div className="text-center text-[11px] text-slate-500 pt-2">
                + {enPlanilla.length - 8} más · ver completo en Planilla
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cross-link card */}
      <div className="bg-gradient-to-r from-sky-50 to-cyan-50 ring-1 ring-sky-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Home className="w-5 h-5 text-sky-700" />
          </div>
          <div className="flex-1">
            <h3 className="text-[13px] font-bold text-slate-900 mb-1">Módulo Planilla</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Boletas mensuales · adelantos de nómina · vacaciones · CTS · gratificaciones ·
              configuración de modalidad · contratos · todo en el módulo dedicado.
            </p>
          </div>
          <button
            onClick={() => navigate('/planilla')}
            className="bg-white border border-sky-300 text-sky-700 hover:bg-sky-50 text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 whitespace-nowrap"
          >
            Abrir
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
