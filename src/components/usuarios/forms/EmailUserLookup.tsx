/**
 * EmailUserLookup.tsx · chk5.PERSONAS-v5.8 · E2-extended (2026-05-28)
 *
 * Input de email con detección automática de user existente (debounce 500ms).
 * Muestra una card informativa debajo del input con el resultado del lookup.
 *
 * 3 estados visuales:
 *   - idle / not_found → nada debajo del input (flujo crear nuevo)
 *   - found_ok → card verde "Ya existe · agregaremos relación de {tipoLabel}"
 *   - found_blocked → card roja "Ya tiene relación vigente de {tipoLabel}"
 *
 * El padre recibe onUserFound(user | null, relacionesVigentes) en cada cambio.
 * El componente NO llama setLoading del padre · gestiona su propio spinner inline.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Mail, Loader2, CheckCircle2, XCircle, User as UserIcon } from 'lucide-react';
import type { UserProfile } from '../../../types/auth.types';
import type { RelacionLaboral, TipoRelacion } from '../../../types/relacionLaboral.types';
import { TIPO_RELACION_LABELS } from '../../../types/relacionLaboral.types';
import type { LookupUserResult } from '../../../hooks/useCreateUserWithRelacion';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

type LookupState = 'idle' | 'searching' | 'not_found' | 'found_ok' | 'found_blocked';

export interface EmailUserLookupProps {
  value: string;
  onChange: (email: string) => void;
  onUserFound: (user: UserProfile | null, relacionesVigentes: RelacionLaboral[]) => void;
  /** Tipo de relación del modal que llama · para detectar conflicto */
  tipoModal: TipoRelacion;
  /** Etiqueta display del tipo · "empleado" | "socio" */
  tipoLabel: string;
  /** Función de lookup inyectada desde el hook del padre */
  lookupFn: (email: string) => Promise<LookupUserResult>;
  /** Error de validación del padre (ej. "Email inválido") */
  error?: string;
  /** Callback para navegar al UserPanel del user bloqueado */
  onOpenUserPanel?: (uid: string) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

/** Lista los tipos vigentes de un user en chips legibles */
const RelacionChips: React.FC<{ relaciones: RelacionLaboral[] }> = ({ relaciones }) => {
  if (relaciones.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {relaciones.map((r) => (
        <span
          key={r.id}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700"
        >
          {TIPO_RELACION_LABELS[r.tipo] ?? r.tipo}
        </span>
      ))}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const EmailUserLookup: React.FC<EmailUserLookupProps> = ({
  value,
  onChange,
  onUserFound,
  tipoModal,
  tipoLabel,
  lookupFn,
  error,
  onOpenUserPanel,
}) => {
  const [lookupState, setLookupState] = useState<LookupState>('idle');
  const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
  const [foundRelaciones, setFoundRelaciones] = useState<RelacionLaboral[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref para cancelar lookups stale (email cambió mientras la promesa estaba en vuelo)
  const lastEmailRef = useRef<string>('');

  useEffect(() => {
    const normalized = value.trim().toLowerCase();

    // Si el campo está vacío → resetear todo
    if (!normalized) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setLookupState('idle');
      setFoundUser(null);
      setFoundRelaciones([]);
      onUserFound(null, []);
      return;
    }

    // Si email incompleto (no tiene @ y .) → resetear silenciosamente
    if (!normalized.includes('@') || !normalized.includes('.')) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setLookupState('idle');
      setFoundUser(null);
      setFoundRelaciones([]);
      onUserFound(null, []);
      return;
    }

    // Debounce 500ms
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLookupState('searching');
      lastEmailRef.current = normalized;

      try {
        const { user, relacionesVigentes } = await lookupFn(normalized);

        // Si el email cambió mientras esperábamos → ignorar resultado stale
        if (lastEmailRef.current !== normalized) return;

        if (!user) {
          setLookupState('not_found');
          setFoundUser(null);
          setFoundRelaciones([]);
          onUserFound(null, []);
          return;
        }

        const tieneRelacionDelTipo = relacionesVigentes.some((r) => r.tipo === tipoModal);
        setFoundUser(user);
        setFoundRelaciones(relacionesVigentes);
        setLookupState(tieneRelacionDelTipo ? 'found_blocked' : 'found_ok');
        onUserFound(user, relacionesVigentes);
      } catch {
        if (lastEmailRef.current !== normalized) return;
        // Error de red → volver a idle silenciosamente (no bloquear al usuario)
        setLookupState('not_found');
        setFoundUser(null);
        setFoundRelaciones([]);
        onUserFound(null, []);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div>
      {/* Label */}
      <label
        htmlFor="email-lookup-input"
        className="block text-[11px] uppercase tracking-wider font-bold text-slate-700 mb-1.5"
      >
        <Mail className="w-3 h-3 inline mr-1 text-slate-500" />
        Email
        <span className="text-rose-500 ml-0.5">*</span>
      </label>

      {/* Input con spinner inline */}
      <div className="relative">
        <input
          id="email-lookup-input"
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="nombre@empresa.pe"
          autoComplete="email"
          aria-describedby={error ? 'email-lookup-error' : undefined}
          aria-invalid={!!error}
          className={[
            'w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:border-transparent pr-8',
            error
              ? 'border-rose-300 focus:ring-rose-400'
              : 'border-slate-200 focus:ring-teal-500',
          ].join(' ')}
        />
        {lookupState === 'searching' && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
        )}
        {lookupState === 'found_ok' && (
          <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />
        )}
        {lookupState === 'found_blocked' && (
          <XCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-rose-500" />
        )}
      </div>

      {/* Error de validación del padre */}
      {error && (
        <p id="email-lookup-error" className="text-[11px] text-rose-600 mt-1 font-medium">
          {error}
        </p>
      )}

      {/* ── Card: usuario encontrado sin conflicto ── */}
      {lookupState === 'found_ok' && foundUser && (
        <div className="mt-2 bg-emerald-50 ring-1 ring-emerald-200 rounded-lg px-3 py-2.5">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <UserIcon className="w-3 h-3 text-emerald-700 flex-shrink-0" />
                <span className="text-[12px] font-semibold text-emerald-900 truncate">
                  {foundUser.displayName}
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Usuario ya existe en el sistema. Agregaremos una relaci&oacute;n de{' '}
                <strong>{tipoLabel}</strong>.
              </p>
              {foundRelaciones.length > 0 && (
                <div className="mt-1.5">
                  <span className="text-[10px] text-emerald-600 uppercase tracking-wide font-bold">
                    Relaciones vigentes:
                  </span>
                  <RelacionChips relaciones={foundRelaciones} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Card: usuario ya tiene relación del tipo · bloqueado ── */}
      {lookupState === 'found_blocked' && foundUser && (
        <div className="mt-2 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2.5">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <UserIcon className="w-3 h-3 text-rose-700 flex-shrink-0" />
                <span className="text-[12px] font-semibold text-rose-900 truncate">
                  {foundUser.displayName}
                </span>
              </div>
              <p className="text-[11px] text-rose-700 mt-0.5">
                Ya tiene una relaci&oacute;n de <strong>{tipoLabel}</strong> vigente. Para
                modificar su cargo o sueldo, abrí su perfil desde Usuarios.
              </p>
              {foundRelaciones.length > 0 && (
                <div className="mt-1.5">
                  <span className="text-[10px] text-rose-600 uppercase tracking-wide font-bold">
                    Relaciones vigentes:
                  </span>
                  <RelacionChips relaciones={foundRelaciones} />
                </div>
              )}
              {onOpenUserPanel && (
                <button
                  type="button"
                  onClick={() => onOpenUserPanel(foundUser.uid)}
                  className="mt-2 text-[11px] font-semibold text-rose-700 underline hover:text-rose-900"
                >
                  Abrir perfil de {foundUser.displayName} en Usuarios &rarr;
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
