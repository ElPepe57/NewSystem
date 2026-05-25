/**
 * RolesMultiSelect · chk5.F2-SUB-PERFILES (2026-05-24)
 *
 * Grid de checkboxes para seleccionar múltiples roles del UserProfile.
 *
 * Canon · ver mockup `modelo-personas-v5.2.html` ESTADO A2.1.
 *  - 9 roles · cada uno con icon lucide + label + color signature
 *  - Multi-select · checkbox visual con border tint cuando marcado
 *  - Resumen de permisos calculados al pie (union de los roles seleccionados)
 *  - Banner pedagógico cuando se marca rol 'socio' (sub-perfiles dinámicos)
 *
 * Responsive: grid 2 cols mobile · 3 cols desktop.
 */

import React from 'react';
import {
  Shield, UserCheck, Briefcase, ShoppingCart, Package, Wallet, Eye, User,
  Landmark, Info, CheckCircle2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  type UserRole,
  ROLE_LABELS,
  calcularPermisosDeRoles,
} from '../../../types/auth.types';

interface Props {
  /** Roles seleccionados actualmente */
  value: UserRole[];
  /** Callback con nuevo array */
  onChange: (roles: UserRole[]) => void;
  /** Si true · deshabilita la edición (auto-edición admin) */
  disabled?: boolean;
}

interface RoleOption {
  value: UserRole;
  icon: LucideIcon;
  /** Clases Tailwind para card seleccionada · border + bg */
  selectedClasses: string;
  /** Color del icon en sí (cuando seleccionado) */
  iconColorSelected: string;
  /** Color del label cuando seleccionado */
  labelColorSelected: string;
}

const OPTIONS: RoleOption[] = [
  { value: 'admin',      icon: Shield,     selectedClasses: 'bg-purple-50 border-purple-400',  iconColorSelected: 'text-purple-700',  labelColorSelected: 'text-purple-900' },
  { value: 'gerente',    icon: UserCheck,  selectedClasses: 'bg-indigo-50 border-indigo-400',  iconColorSelected: 'text-indigo-700',  labelColorSelected: 'text-indigo-900' },
  { value: 'vendedor',   icon: Briefcase,  selectedClasses: 'bg-sky-50 border-sky-400',        iconColorSelected: 'text-sky-700',     labelColorSelected: 'text-sky-900' },
  { value: 'comprador',  icon: ShoppingCart, selectedClasses: 'bg-amber-50 border-amber-400',  iconColorSelected: 'text-amber-700',   labelColorSelected: 'text-amber-900' },
  { value: 'almacenero', icon: Package,    selectedClasses: 'bg-emerald-50 border-emerald-400',iconColorSelected: 'text-emerald-700', labelColorSelected: 'text-emerald-900' },
  { value: 'finanzas',   icon: Wallet,     selectedClasses: 'bg-teal-50 border-teal-400',      iconColorSelected: 'text-teal-700',    labelColorSelected: 'text-teal-900' },
  { value: 'supervisor', icon: Eye,        selectedClasses: 'bg-slate-50 border-slate-400',    iconColorSelected: 'text-slate-700',   labelColorSelected: 'text-slate-900' },
  { value: 'socio',      icon: Landmark,   selectedClasses: 'bg-violet-50 border-violet-400',  iconColorSelected: 'text-violet-700',  labelColorSelected: 'text-violet-900' },
  { value: 'invitado',   icon: User,       selectedClasses: 'bg-slate-50 border-slate-400',    iconColorSelected: 'text-slate-500',   labelColorSelected: 'text-slate-700' },
];

export default function RolesMultiSelect({ value, onChange, disabled }: Props) {
  const toggleRole = (role: UserRole) => {
    if (disabled) return;
    if (value.includes(role)) {
      onChange(value.filter((r) => r !== role));
    } else {
      onChange([...value, role]);
    }
  };

  const permisosCalculados = calcularPermisosDeRoles(value);
  const tieneSocio = value.includes('socio');
  const tieneRolPlanilla = value.some((r) =>
    (['gerente', 'vendedor', 'comprador', 'almacenero', 'finanzas', 'supervisor'] as UserRole[]).includes(r)
  );

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-2">
          Roles asignados *
        </label>
        <p className="text-[11px] text-slate-600 mb-3">
          Una persona puede tener uno o varios roles. Los permisos se acumulan.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = value.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-2 p-2.5 border-2 rounded-lg transition-colors ${
                  disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                } ${
                  isSelected
                    ? opt.selectedClasses
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleRole(opt.value)}
                  disabled={disabled}
                  className="w-4 h-4 accent-purple-600"
                />
                <Icon className={`w-4 h-4 ${isSelected ? opt.iconColorSelected : 'text-slate-500'}`} />
                <span className={`text-[11px] font-bold ${isSelected ? opt.labelColorSelected : 'text-slate-700'}`}>
                  {ROLE_LABELS[opt.value]}
                </span>
                {opt.value === 'socio' && !isSelected && (
                  <span className="ml-auto text-[8px] bg-violet-100 text-violet-700 px-1 rounded font-bold">NEW</span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* Resumen de permisos derivados */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
        <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mb-1.5 flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3" />
          Permisos calculados · {permisosCalculados.length}
        </div>
        {value.length === 0 ? (
          <p className="text-[11px] text-rose-700 font-semibold">
            ⚠ Seleccioná al menos un rol · el usuario quedaría sin permisos.
          </p>
        ) : (
          <p className="text-[11px] text-emerald-900">
            Con <strong>{value.length} rol{value.length === 1 ? '' : 'es'}</strong> seleccionado
            {value.length === 1 ? '' : 's'} ({value.map((r) => ROLE_LABELS[r]).join(' · ')}) este usuario
            recibe la unión de todos los permisos.
            {value.includes('admin') && ' Admin ya da acceso total.'}
          </p>
        )}
      </div>

      {/* Banner pedagógico · sub-perfiles dinámicos */}
      {(tieneSocio || tieneRolPlanilla) && (
        <div className="bg-violet-50/50 border border-violet-200 rounded-lg p-2.5 flex items-start gap-2 text-[11px] text-violet-900">
          <Info className="w-4 h-4 text-violet-700 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Sub-perfiles dinámicos:</strong>{' '}
            {tieneRolPlanilla && (
              <>al marcar un rol de planilla, podrás completar la tab "Datos laborales" (cargo · sueldo · contrato).{' '}</>
            )}
            {tieneSocio && (
              <>al marcar el rol <strong>socio</strong>, podrás completar la tab "Datos de socio" (% participación · tipo de aporte · valor).</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
