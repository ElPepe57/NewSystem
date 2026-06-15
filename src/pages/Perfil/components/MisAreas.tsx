/**
 * src/pages/Perfil/components/MisAreas.tsx
 * 2026-06-14 · §G del home por rol · "Mis áreas · a qué tenés acceso".
 *
 * REUSABLE para los 9 roles · cero config. Deriva 100% de los permisos del
 * usuario cruzados con la fuente única de navegación (MENU_GROUPS · cada item
 * ya declara su `permiso`). Lo que el rol puede ver, aparece; lo que no, no.
 * Multi-rol: como los permisos del usuario son la UNIÓN de sus roles, las áreas
 * accesibles ya salen unidas automáticamente.
 *
 * Canon mockup: docs/mockups/perfil-home-vendedor-v1.html · ACTO 2 §G (líneas 233-270).
 * Color por grupo del sidebar (GRUPO_COLOR · gobernanza de color heredada).
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Lock } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import { MENU_GROUPS, GRUPO_COLOR } from '../../../config/navegacion';
import { ROLE_LABELS, type UserRole } from '../../../types/auth.types';

export const MisAreas: React.FC = () => {
  const { hasPermiso, roles } = usePermissions();

  // Grupos accesibles (≥1 item con permiso) vs bloqueados (0 items accesibles).
  const { gruposAccesibles, gruposBloqueados } = useMemo(() => {
    const accesibles = MENU_GROUPS.map((grupo) => ({
      ...grupo,
      items: grupo.items.filter((item) => !item.permiso || hasPermiso(item.permiso)),
    })).filter((g) => g.items.length > 0);

    const bloqueados = MENU_GROUPS.filter(
      (grupo) => !grupo.items.some((item) => !item.permiso || hasPermiso(item.permiso)),
    );

    return { gruposAccesibles: accesibles, gruposBloqueados: bloqueados };
  }, [hasPermiso]);

  // Etiqueta de rol(es) · multi-rol se une con " + " (ej. "Vendedor + Comprador").
  const rolesLabel = useMemo(
    () =>
      (roles as UserRole[])
        .filter((r) => r !== 'invitado')
        .map((r) => ROLE_LABELS[r] ?? r)
        .join(' + ') || 'tu perfil',
    [roles],
  );

  if (gruposAccesibles.length === 0) return null;

  return (
    <div className="pt-4 border-t border-slate-100">
      <div className="text-[13px] font-bold text-slate-900 mb-1 flex items-center gap-2">
        <LayoutGrid className="w-4 h-4 text-violet-600" /> Mis áreas · a qué tenés acceso
      </div>
      <div className="text-[11px] text-slate-500 mb-3">
        Tu rol <b className="text-violet-700">{rolesLabel}</b> te habilita estas secciones
        (se derivan de tus permisos · clic para entrar).
      </div>

      <div className="space-y-3">
        {gruposAccesibles.map((grupo) => {
          const color = GRUPO_COLOR[grupo.id] ?? GRUPO_COLOR.admin;
          return (
            <div key={grupo.id}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${color.fg} mb-1.5`}>
                {grupo.label}
              </div>
              <div className="flex flex-wrap gap-2">
                {grupo.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-700 ${color.bg} ring-1 ${color.ring} ${color.hover} px-3 py-1.5 rounded-lg transition-colors`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${color.fg}`} /> {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {gruposBloqueados.length > 0 && (
        <div className="text-[11px] text-slate-400 mt-3 flex items-start gap-1.5">
          <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            {gruposBloqueados.map((g) => g.label).join(' · ')}{' '}
            <b>no aparecen</b> porque tu rol no tiene acceso. Si necesitás alguna, pedila al admin.
          </span>
        </div>
      )}
    </div>
  );
};

export default MisAreas;
