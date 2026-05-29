/**
 * BannerQueSeCreara.tsx · chk5.PERSONAS-v5.x · 2026-05-28
 *
 * Banner pedagógico contextual que matiza qué se va a crear según el modo
 * del modal de alta (NuevoEmpleadoModal · NuevoSocioModal).
 *
 * Razón de existir: el modelo Persona ≠ Empleado · Persona ≠ Socio.
 * Una PERSONA (User) puede tener N RELACIONES (empleado · socio · honorarios ·
 * externo). Crear un empleado puede o NO crear un User nuevo dependiendo de si
 * la persona ya existe en el sistema.
 *
 * 2 modos visuales:
 *
 *   MODO CREAR · userExistente === null
 *     "Esto va a crear:
 *        ✓ Usuario nuevo (con credenciales de login)
 *        ✓ Relación tipo {empleado|socio}"
 *
 *   MODO AGREGAR RELACIÓN · userExistente !== null
 *     "Esto va a crear:
 *        ✓ Una nueva relación tipo {empleado|socio} para {NombreUser}
 *        ℹ El usuario ya existe · no se duplica · mantiene su login"
 *
 * En modo BLOQUEADO (user con relación vigente del mismo tipo) el banner NO
 * se muestra · el banner rojo de bloqueo de los modales cubre ese caso.
 */

import React from 'react';
import { Info, UserPlus, Link2, CheckCircle2 } from 'lucide-react';

export interface BannerQueSeCrearaProps {
  /** Tipo de relación que el modal va a crear */
  tipoRelacion: 'empleado' | 'socio' | 'honorarios' | 'externo';
  /** Nombre del user existente (modo agregar) · null si es modo crear */
  nombreUserExistente?: string | null;
}

const TIPO_LABELS: Record<BannerQueSeCrearaProps['tipoRelacion'], string> = {
  empleado: 'empleado',
  socio: 'socio',
  honorarios: 'honorarios',
  externo: 'externo',
};

export const BannerQueSeCreara: React.FC<BannerQueSeCrearaProps> = ({
  tipoRelacion,
  nombreUserExistente,
}) => {
  const esModoAgregar = !!nombreUserExistente;
  const tipoLabel = TIPO_LABELS[tipoRelacion];

  return (
    <div className="bg-sky-50/60 ring-1 ring-sky-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
      <Info className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider font-bold text-sky-900 mb-1.5">
          Esto va a crear
        </div>
        <ul className="space-y-1 text-[12px] text-sky-900">
          {esModoAgregar ? (
            <>
              <li className="flex items-start gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-sky-700 flex-shrink-0 mt-0.5" />
                <span>
                  Una <strong>nueva relación tipo {tipoLabel}</strong> para{' '}
                  <strong>{nombreUserExistente}</strong>.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span className="text-sky-800">
                  El <strong>usuario</strong> ya existe · no se duplica · mantiene su login y sus
                  otras relaciones.
                </span>
              </li>
            </>
          ) : (
            <>
              <li className="flex items-start gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-sky-700 flex-shrink-0 mt-0.5" />
                <span>
                  Un <strong>usuario nuevo</strong> en el sistema (con email + password para
                  loguear).
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-sky-700 flex-shrink-0 mt-0.5" />
                <span>
                  Una <strong>relación tipo {tipoLabel}</strong> vinculada a ese usuario.
                </span>
              </li>
            </>
          )}
        </ul>
        <div className="mt-2 text-[10px] text-sky-700/80 leading-relaxed">
          <strong>Persona ≠ {tipoLabel}.</strong> Una persona es el usuario · puede tener varias
          relaciones al mismo tiempo (ej. socio + empleado). Los permisos del sistema (rol) son
          independientes del tipo de relación.
        </div>
      </div>
    </div>
  );
};
