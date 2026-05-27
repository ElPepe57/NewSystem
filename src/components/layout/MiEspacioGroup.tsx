/**
 * MiEspacioGroup · F10.F.1.J-SIDEBAR · 2026-05-27
 *
 * Grupo "Mi espacio" del sidebar · ÚLTIMO bloque antes del logout.
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.6-sidebar-personalizado.html (ACTOs 3-6).
 *
 * Patrón visual canon:
 *   - border-t-2 border-purple-200 separa del resto del sidebar
 *   - Label "Mi espacio" en uppercase tracking-wider color purple-700
 *   - Items con icon w-4 h-4 + label text-sm
 *   - Item activo: bg-purple-50 text-purple-700 font-semibold
 *   - Badge dinámico (ej. "7" en Mi bandeja) bg-amber-100 text-amber-700
 *   - Items disabled: tachados con label "sin data"
 *
 * Items renderizados dependen del rol/sub-perfiles del user · ver useMiEspacioItems.
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMiEspacioItems } from '../../hooks/useMiEspacioItems';

const BADGE_COLORS: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-700',
  sky: 'bg-sky-100 text-sky-700',
  emerald: 'bg-emerald-100 text-emerald-700',
};

export const MiEspacioGroup: React.FC = () => {
  const location = useLocation();
  const { items } = useMiEspacioItems();

  // Si NO hay items (solo Mi perfil que siempre está) · igual mostrar
  // porque al menos "Mi perfil" debería verse para todos los usuarios autenticados.
  if (items.length === 0) return null;

  return (
    <div className="border-t-2 border-purple-200 mt-2 pt-2 px-3">
      {/* Label del grupo */}
      <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-purple-700">
        Mi espacio
      </div>

      {/* Items */}
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path
            || (item.path !== '/perfil' && location.pathname.startsWith(item.path));

          if (item.disabled) {
            return (
              <div
                key={item.id}
                className="flex items-center space-x-2.5 px-3 py-2 rounded-lg text-slate-400 cursor-not-allowed"
                title={item.disabledReason}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm font-medium line-through truncate">{item.label}</span>
                <span className="text-[9px] text-slate-400 ml-auto flex-shrink-0">sin data</span>
              </div>
            );
          }

          return (
            <Link
              key={item.id}
              to={item.path}
              className={`
                flex items-center space-x-2.5 px-3 py-2 rounded-lg transition-all duration-150
                ${isActive
                  ? 'bg-purple-50 text-purple-700 font-semibold'
                  : 'text-slate-600 hover:bg-purple-50/40 hover:text-purple-700'
                }
              `}
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-purple-700' : ''}`} />
              <span className="text-sm font-medium truncate flex-1">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums flex-shrink-0 ${
                    BADGE_COLORS[item.badgeColor ?? 'amber']
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default MiEspacioGroup;
