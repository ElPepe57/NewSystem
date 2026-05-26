/**
 * src/components/modules/usuarios/TabSocios.tsx
 * chk5.F4-USERS (2026-05-25) · Tab "Socios" del módulo /usuarios.
 *
 * Cross-link a /inversionistas (vista ejecutiva canon violet).
 * Muestra preview de cap table compuesto desde users con rol='socio'.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, ArrowRight, TrendingUp, Wallet } from 'lucide-react';
import type { UserProfile } from '../../../types/auth.types';
import { hasRole } from '../../../types/auth.types';

interface Props {
  usuarios: UserProfile[];
}

export default function TabSocios({ usuarios }: Props) {
  const navigate = useNavigate();

  const socios = useMemo(() => usuarios.filter((u) => hasRole(u, 'socio')), [usuarios]);
  const total = socios.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-slate-900">Socios del negocio</h2>
            <p className="text-[11px] text-slate-500">{total} {total === 1 ? 'socio activo' : 'socios activos'} · cap table compuesta</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/inversionistas')}
          className="bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
        >
          Ver en Inversionistas
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* KPI strip · canon N1+N2 violet */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-violet-50 to-violet-100/40 ring-1 ring-violet-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-violet-700 font-bold">TOTAL SOCIOS</span>
            <Briefcase className="w-3.5 h-3.5 text-violet-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-violet-900">{total}</div>
          <div className="text-[10px] text-violet-700 mt-1">activos en cap table</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">CAPITAL</span>
            <Wallet className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">—</div>
          <div className="text-[10px] text-emerald-700 mt-1">ver detalle en Inversionistas</div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 ring-1 ring-indigo-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-indigo-700 font-bold">PARTICIPACIÓN</span>
            <TrendingUp className="w-3.5 h-3.5 text-indigo-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-indigo-900">—</div>
          <div className="text-[10px] text-indigo-700 mt-1">% total asignado</div>
        </div>
      </div>

      {/* Lista de socios */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-3">Lista de socios</div>
        {socios.length === 0 ? (
          <div className="text-center py-8">
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-[13px] font-bold text-slate-900 mb-1">Sin socios registrados</p>
            <p className="text-[11px] text-slate-500 mb-4">
              Los socios se crean asignando el rol "socio" a usuarios existentes.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {socios.map((socio) => (
              <div
                key={socio.uid}
                className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-violet-50/30 rounded-lg cursor-pointer transition-colors"
                onClick={() => navigate(`/usuarios/${socio.uid}/ficha`)}
              >
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-violet-700 rounded-full flex items-center justify-center text-white font-bold text-[12px]">
                  {socio.displayName?.substring(0, 2).toUpperCase() || 'S'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-slate-900 truncate">{socio.displayName}</div>
                  <div className="text-[11px] text-slate-500 truncate">{socio.email} · {socio.cargo || 'sin cargo'}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-violet-600 flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cross-link card · siempre visible (canon N8) */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 ring-1 ring-violet-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-5 h-5 text-violet-700" />
          </div>
          <div className="flex-1">
            <h3 className="text-[13px] font-bold text-slate-900 mb-1">Vista ejecutiva en Inversionistas</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Cap table completa · capital invertido · aportes de valor · vesting · trayectoria histórica
              · ROI · todo en el módulo dedicado para socios.
            </p>
          </div>
          <button
            onClick={() => navigate('/inversionistas')}
            className="bg-white border border-violet-300 text-violet-700 hover:bg-violet-50 text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 whitespace-nowrap"
          >
            Abrir
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
