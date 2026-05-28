/**
 * CardMultiRolRica · F10.F.1.J-SIDEBAR.3 · 2026-05-27
 *
 * Card del Tab Mi Información con descripción RICA de cada rol asignado.
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 5 (líneas 650-682).
 *
 * Estructura canon:
 *   - Header: h3 "Mis roles asignados" + label "N roles · permisos heredados"
 *   - Lista de cards · 1 por rol con:
 *     · Icon container 32px (bg-{tinte}-100 · w-8 h-8)
 *     · Título del rol (text-[12px] font-bold)
 *     · Descripción rica (text-[11px] text-slate-600) · permisos heredados
 *     · Chip ROOT/CAPITAL/etc (text-[10px] bg-{tinte}-200 text-{tinte}-900)
 *
 * Cada rol tiene chip distintivo:
 *   - admin → ROOT
 *   - socio → CAPITAL
 *   - finanzas → DINERO
 *   - gerente → MGMT
 *   - vendedor/comprador/almacenero → OP
 *   - supervisor → VIEW
 */
import React from 'react';
import { Shield, Briefcase, Users, ShoppingBag, ShoppingCart, Package, Wallet, Eye, UserCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  DEFAULT_PERMISOS,
  type UserRole,
} from '../../../types/auth.types';

interface RolDisplay {
  icon: LucideIcon;
  bgIcon: string;
  colorIcon: string;
  bgCard: string;
  border: string;
  chip: string;
  chipText: string;
  chipBg: string;
}

const ROL_DISPLAY: Record<UserRole, RolDisplay> = {
  admin: {
    icon: Shield,
    bgIcon: 'bg-purple-100',
    colorIcon: 'text-purple-700',
    bgCard: 'bg-purple-50/40',
    border: 'border-purple-200',
    chip: 'ROOT',
    chipText: 'text-purple-900',
    chipBg: 'bg-purple-200',
  },
  gerente: {
    icon: Briefcase,
    bgIcon: 'bg-purple-100',
    colorIcon: 'text-purple-700',
    bgCard: 'bg-purple-50/40',
    border: 'border-purple-200',
    chip: 'MGMT',
    chipText: 'text-purple-900',
    chipBg: 'bg-purple-200',
  },
  socio: {
    icon: UserCircle,
    bgIcon: 'bg-violet-100',
    colorIcon: 'text-violet-700',
    bgCard: 'bg-violet-50/40',
    border: 'border-violet-200',
    chip: 'CAPITAL',
    chipText: 'text-violet-900',
    chipBg: 'bg-violet-200',
  },
  finanzas: {
    icon: Wallet,
    bgIcon: 'bg-teal-100',
    colorIcon: 'text-teal-700',
    bgCard: 'bg-teal-50/40',
    border: 'border-teal-200',
    chip: 'DINERO',
    chipText: 'text-teal-900',
    chipBg: 'bg-teal-200',
  },
  vendedor: {
    icon: ShoppingBag,
    bgIcon: 'bg-sky-100',
    colorIcon: 'text-sky-700',
    bgCard: 'bg-sky-50/40',
    border: 'border-sky-200',
    chip: 'OP',
    chipText: 'text-sky-900',
    chipBg: 'bg-sky-200',
  },
  comprador: {
    icon: ShoppingCart,
    bgIcon: 'bg-amber-100',
    colorIcon: 'text-amber-700',
    bgCard: 'bg-amber-50/40',
    border: 'border-amber-200',
    chip: 'OP',
    chipText: 'text-amber-900',
    chipBg: 'bg-amber-200',
  },
  almacenero: {
    icon: Package,
    bgIcon: 'bg-emerald-100',
    colorIcon: 'text-emerald-700',
    bgCard: 'bg-emerald-50/40',
    border: 'border-emerald-200',
    chip: 'OP',
    chipText: 'text-emerald-900',
    chipBg: 'bg-emerald-200',
  },
  supervisor: {
    icon: Eye,
    bgIcon: 'bg-teal-100',
    colorIcon: 'text-teal-700',
    bgCard: 'bg-teal-50/40',
    border: 'border-teal-200',
    chip: 'VIEW',
    chipText: 'text-teal-900',
    chipBg: 'bg-teal-200',
  },
  invitado: {
    icon: Users,
    bgIcon: 'bg-slate-100',
    colorIcon: 'text-slate-600',
    bgCard: 'bg-slate-50/40',
    border: 'border-slate-200',
    chip: 'GUEST',
    chipText: 'text-slate-900',
    chipBg: 'bg-slate-200',
  },
};

export const CardMultiRolRica: React.FC = () => {
  const { roles } = usePermissions();

  if (!roles || roles.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 text-center">
        <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <div className="text-[13px] font-semibold text-slate-700">Sin roles asignados</div>
        <div className="text-[11px] text-slate-500 mt-1">
          Contactá al admin para que asigne tu rol en el sistema.
        </div>
      </div>
    );
  }

  return (
    // Canon mockup ACTO 5 · línea 651 · copy-paste literal
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold text-slate-900 inline-flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-purple-700" />
          Mis roles asignados
        </h3>
        <span className="text-[10px] text-slate-500 font-medium">
          {roles.length} rol{roles.length !== 1 ? 'es' : ''} · permisos heredados
        </span>
      </div>
      <div className="space-y-2">
        {roles.map((rol) => {
          const display = ROL_DISPLAY[rol] ?? ROL_DISPLAY.invitado;
          const Icon = display.icon;
          const cantPermisos = DEFAULT_PERMISOS[rol]?.length ?? 0;

          return (
            <div
              key={rol}
              className={`flex items-start gap-3 ${display.bgCard} border ${display.border} rounded-lg p-3`}
            >
              <div className={`w-8 h-8 ${display.bgIcon} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${display.colorIcon}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-slate-900">{ROLE_LABELS[rol]}</div>
                <div className="text-[11px] text-slate-600 leading-snug">
                  {ROLE_DESCRIPTIONS[rol]}
                  {cantPermisos > 0 && (
                    <>
                      {' · '}
                      <span className="tabular-nums font-bold">{cantPermisos}</span> permisos
                    </>
                  )}
                </div>
              </div>
              <span
                className={`text-[10px] ${display.chipBg} ${display.chipText} px-2 py-0.5 rounded font-bold flex-shrink-0`}
              >
                {display.chip}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CardMultiRolRica;
