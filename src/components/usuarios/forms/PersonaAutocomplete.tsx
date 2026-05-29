/**
 * PersonaAutocomplete.tsx · chk5.PERSONAS-v5.9 · E1 (2026-05-28)
 *
 * Reemplaza EmailUserLookup.tsx con búsqueda local de nombre O email
 * mientras el usuario escribe (debounce 150ms, top 8 matches).
 *
 * Arquitectura:
 *   - Carga userService.getAll() UNA VEZ al montar (cache en estado local).
 *   - Filtra localmente sin llamadas adicionales.
 *   - Por cada match en dropdown, carga listVigentesByUser() con cache en useRef Map.
 *   - Al seleccionar un item, llama onUserSelected(user, relacionesVigentes).
 *   - Al elegir "Crear nuevo", llama onCreateNew(query).
 *   - Cuando userExistente != null, muestra chip-pill (estado seleccionado)
 *     con botón X para deseleccionar; el input de búsqueda se oculta.
 *
 * Keyboard: ↑↓ navega, Enter selecciona, Esc cierra.
 * Accesibilidad: role="combobox", role="option", aria-activedescendant.
 * Mobile: dropdown max-h [60vh] scrollable, touch targets ≥44px.
 *
 * Constraints:
 *   - Canon F8: iconos lucide únicos, sin emojis en chrome UI.
 *   - Canon colores chips: empleado=teal, socio=purple, honorarios=sky, externo=amber.
 *   - El borrador serializa emailInput (string), nunca el objeto UserProfile.
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  Loader2,
  Plus,
  Search,
  User as UserIcon,
  X,
} from 'lucide-react';
import { userService } from '../../../services/user.service';
import { relacionesLaboralesService } from '../../../services/relacionesLaborales.service';
import type { UserProfile } from '../../../types/auth.types';
import type { RelacionLaboral, TipoRelacion } from '../../../types/relacionLaboral.types';
import {
  TIPO_RELACION_LABELS,
  TIPO_RELACION_COLORS,
} from '../../../types/relacionLaboral.types';

// ═════════════════════════════════════════════════════════════════════════
// HELPERS INTERNOS
// ═════════════════════════════════════════════════════════════════════════

/** Genera initials de hasta 2 caracteres a partir de un displayName */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Color de fondo del avatar derivado del UID (determinístico) */
const AVATAR_PALETTES = [
  'bg-teal-500',
  'bg-purple-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-orange-500',
];
function getAvatarColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
}

/** Filtra la lista de users por query (nombre o email, case-insensitive) */
function filterUsers(users: UserProfile[], q: string): UserProfile[] {
  const lower = q.toLowerCase().trim();
  if (!lower) return [];
  return users
    .filter(
      (u) =>
        (u.email ?? '').toLowerCase().includes(lower) ||
        (u.displayName ?? '').toLowerCase().includes(lower),
    )
    .slice(0, 8);
}

/** Chip de relación con colores canon v8.0 */
const RelacionChip: React.FC<{ tipo: TipoRelacion }> = ({ tipo }) => {
  const colors = TIPO_RELACION_COLORS[tipo];
  return (
    <span
      className={[
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ring-1',
        colors.bg,
        colors.text,
        colors.ring,
      ].join(' ')}
    >
      {TIPO_RELACION_LABELS[tipo]}
    </span>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// TIPOS PÚBLICOS
// ═════════════════════════════════════════════════════════════════════════

export interface PersonaAutocompleteProps {
  /** Texto actual del input (para sincronizar con el borrador del padre) */
  inputValue: string;
  onInputChange: (value: string) => void;
  /** User ya seleccionado (modo pill). Cuando !== null, el input se oculta. */
  userExistente: UserProfile | null;
  relacionesVigentes: RelacionLaboral[];
  /** Llamado cuando el usuario SELECCIONA un item del dropdown */
  onUserSelected: (user: UserProfile, relacionesVigentes: RelacionLaboral[]) => void;
  /** Llamado cuando el usuario elige "Crear nuevo con X" */
  onCreateNew: (query: string) => void;
  /** Llamado cuando el usuario hace click en X de la chip-pill (deseleccionar) */
  onDeselect: () => void;
  /** Tipo del modal que llama · para detectar conflicto en la chip */
  tipoModal: TipoRelacion;
  /** Error de validación externo */
  error?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════

export const PersonaAutocomplete: React.FC<PersonaAutocompleteProps> = ({
  inputValue,
  onInputChange,
  userExistente,
  relacionesVigentes,
  onUserSelected,
  onCreateNew,
  onDeselect,
  tipoModal,
  error,
}) => {
  const instanceId = useId();
  const listboxId = `persona-autocomplete-listbox-${instanceId}`;

  // ── Cache de todos los users (se carga al montar) ──────────────────────
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // ── Cache de relaciones por uid (evita re-fetch en mismo lifecycle) ───
  const relacionesCache = useRef<Map<string, RelacionLaboral[]>>(new Map());

  // ── Estado del dropdown ────────────────────────────────────────────────
  const [matches, setMatches] = useState<UserProfile[]>([]);
  const [matchRelaciones, setMatchRelaciones] = useState<Map<string, RelacionLaboral[]>>(
    new Map(),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [loadingRelaciones, setLoadingRelaciones] = useState(false);

  // ── Refs para click outside y debounce ────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Carga inicial de todos los users ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const users = await userService.getAll();
        if (!cancelled) setAllUsers(users);
      } catch (err) {
        console.warn('[PersonaAutocomplete] error cargando users:', err);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Carga relaciones para una lista de matches ────────────────────────
  const cargarRelacionesParaMatches = useCallback(
    async (users: UserProfile[]) => {
      const uidsNeedingFetch = users
        .map((u) => u.uid)
        .filter((uid) => !relacionesCache.current.has(uid));

      if (uidsNeedingFetch.length === 0) {
        // Todos ya en cache → solo actualizar el Map de estado
        const newMap = new Map<string, RelacionLaboral[]>();
        users.forEach((u) => {
          newMap.set(u.uid, relacionesCache.current.get(u.uid) ?? []);
        });
        setMatchRelaciones(newMap);
        return;
      }

      setLoadingRelaciones(true);
      try {
        const fetchResults = await Promise.all(
          uidsNeedingFetch.map((uid) =>
            relacionesLaboralesService
              .listVigentesByUser(uid)
              .then((rels) => ({ uid, rels }))
              .catch(() => ({ uid, rels: [] as RelacionLaboral[] })),
          ),
        );
        fetchResults.forEach(({ uid, rels }) => {
          relacionesCache.current.set(uid, rels);
        });

        const newMap = new Map<string, RelacionLaboral[]>();
        users.forEach((u) => {
          newMap.set(u.uid, relacionesCache.current.get(u.uid) ?? []);
        });
        setMatchRelaciones(newMap);
      } finally {
        setLoadingRelaciones(false);
      }
    },
    [],
  );

  // ─── Filtrado local con debounce 150ms ────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = inputValue.trim();
    if (!q) {
      setMatches([]);
      setIsOpen(false);
      setHighlightedIndex(-1);
      return;
    }

    if (loadingUsers) {
      // Lista no cargada aún — esperamos
      return;
    }

    debounceRef.current = setTimeout(() => {
      const found = filterUsers(allUsers, q);
      setMatches(found);
      setIsOpen(true);
      setHighlightedIndex(-1);
      void cargarRelacionesParaMatches(found);
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, allUsers, loadingUsers, cargarRelacionesParaMatches]);

  // ─── Click fuera cierra el dropdown ──────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Selección de un user existente ──────────────────────────────────
  const handleSelectUser = useCallback(
    (user: UserProfile) => {
      const rels = relacionesCache.current.get(user.uid) ?? [];
      setIsOpen(false);
      setHighlightedIndex(-1);
      onUserSelected(user, rels);
    },
    [onUserSelected],
  );

  // ─── Selección de "Crear nuevo" ───────────────────────────────────────
  const handleCreateNew = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    onCreateNew(inputValue.trim());
  }, [inputValue, onCreateNew]);

  // ─── Keyboard navigation ──────────────────────────────────────────────
  // Total items = matches.length + 1 (crear nuevo al final)
  const totalItems = matches.length + 1;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && inputValue.trim()) {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < matches.length) {
          handleSelectUser(matches[highlightedIndex]);
        } else if (highlightedIndex === matches.length) {
          handleCreateNew();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  // ─── ID del item activo para aria-activedescendant ───────────────────
  const activeDescendant =
    highlightedIndex >= 0 ? `${listboxId}-item-${highlightedIndex}` : undefined;

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: MODO PILL (user ya seleccionado)
  // ═══════════════════════════════════════════════════════════════════════
  if (userExistente) {
    const tieneConflicto = relacionesVigentes.some((r) => r.tipo === tipoModal);
    const initials = getInitials(userExistente.displayName);
    const avatarColor = getAvatarColor(userExistente.uid);

    return (
      <div>
        {/* Label */}
        <div className="text-[11px] uppercase tracking-wider font-bold text-slate-700 mb-1.5 flex items-center gap-1">
          <Search className="w-3 h-3 text-slate-500" />
          Persona seleccionada
        </div>

        {/* Chip pill */}
        <div
          className={[
            'flex items-start gap-3 rounded-lg px-3 py-2.5 ring-1',
            tieneConflicto
              ? 'bg-rose-50 ring-rose-200'
              : 'bg-emerald-50 ring-emerald-200',
          ].join(' ')}
        >
          {/* Avatar */}
          <div
            className={[
              'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
              'text-white text-[12px] font-bold select-none',
              avatarColor,
            ].join(' ')}
            aria-hidden="true"
          >
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-slate-900 truncate leading-tight">
              {userExistente.displayName}
            </div>
            <div className="text-[11px] text-slate-500 truncate mt-0.5">
              {userExistente.email}
            </div>
            {relacionesVigentes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {relacionesVigentes.map((r) => (
                  <RelacionChip key={r.id} tipo={r.tipo} />
                ))}
              </div>
            )}
          </div>

          {/* Botón deseleccionar */}
          <button
            type="button"
            onClick={onDeselect}
            aria-label="Deseleccionar persona y volver a buscar"
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                       text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hint contextual */}
        <p className="text-[11px] text-slate-500 mt-1">
          {tieneConflicto
            ? 'Este usuario ya tiene una relación vigente de este tipo.'
            : 'Usuario encontrado. Completá los datos de la relación abajo.'}
        </p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: MODO BÚSQUEDA (input + dropdown)
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div ref={containerRef} className="relative">
      {/* Label */}
      <label
        htmlFor={`${instanceId}-input`}
        className="block text-[11px] uppercase tracking-wider font-bold text-slate-700 mb-1.5"
      >
        <Search className="w-3 h-3 inline mr-1 text-slate-500" />
        Buscar persona
        <span className="text-rose-500 ml-0.5">*</span>
      </label>

      {/* Input combobox */}
      <div className="relative">
        <input
          ref={inputRef}
          id={`${instanceId}-input`}
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inputValue.trim() && matches.length > 0) setIsOpen(true);
          }}
          placeholder={
            loadingUsers ? 'Cargando personas...' : 'Nombre o email...'
          }
          disabled={loadingUsers}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={activeDescendant}
          aria-invalid={!!error}
          aria-describedby={error ? `${instanceId}-error` : undefined}
          className={[
            'w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:border-transparent',
            'pl-3 pr-8',
            error
              ? 'border-rose-300 focus:ring-rose-400'
              : 'border-slate-200 focus:ring-teal-500',
            loadingUsers ? 'bg-slate-50 cursor-wait' : '',
          ].join(' ')}
        />
        {/* Spinner o icono */}
        {loadingUsers ? (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
        ) : inputValue.trim() ? (
          <button
            type="button"
            onClick={() => {
              onInputChange('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            aria-label="Limpiar búsqueda"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400
                       hover:text-slate-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
        )}
      </div>

      {/* Error de validación externo */}
      {error && (
        <p id={`${instanceId}-error`} className="text-[11px] text-rose-600 mt-1 font-medium">
          {error}
        </p>
      )}

      {/* ── Dropdown ──────────────────────────────────────────────────── */}
      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Resultados de búsqueda de personas"
          className={[
            'absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg',
            'overflow-y-auto',
            'max-h-[60vh] sm:max-h-72',
          ].join(' ')}
        >
          {/* Skeleton mientras carga relaciones para los matches */}
          {loadingRelaciones && matches.length === 0 && (
            <li className="px-3 py-3 flex items-center gap-2 text-[12px] text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
              Buscando...
            </li>
          )}

          {/* Items de matches */}
          {matches.map((user, index) => {
            const rels = matchRelaciones.get(user.uid) ?? [];
            const isHighlighted = index === highlightedIndex;
            const initials = getInitials(user.displayName);
            const avatarColor = getAvatarColor(user.uid);

            return (
              <li
                key={user.uid}
                id={`${listboxId}-item-${index}`}
                role="option"
                aria-selected={isHighlighted}
                onMouseDown={(e) => {
                  // mousedown en vez de click para que no dispare blur antes de seleccionar
                  e.preventDefault();
                  handleSelectUser(user);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={[
                  'flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                  // Touch target mínimo 44px asegurado por py-2.5 + avatar 36px
                  isHighlighted ? 'bg-teal-50' : 'hover:bg-slate-50',
                  index < matches.length - 1 || matches.length > 0
                    ? 'border-b border-slate-100'
                    : '',
                ].join(' ')}
              >
                {/* Avatar circular */}
                <div
                  className={[
                    'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                    'text-white text-[12px] font-bold select-none',
                    avatarColor,
                  ].join(' ')}
                  aria-hidden="true"
                >
                  {initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-slate-900 truncate leading-tight">
                    {user.displayName}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {user.email}
                  </div>
                  {/* Chips de relaciones vigentes */}
                  {rels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {rels.map((r) => (
                        <RelacionChip key={r.id} tipo={r.tipo} />
                      ))}
                    </div>
                  )}
                  {loadingRelaciones && !matchRelaciones.has(user.uid) && (
                    <div className="mt-1 h-3 w-20 bg-slate-100 rounded animate-pulse" />
                  )}
                </div>
              </li>
            );
          })}

          {/* ── Opción "Crear nuevo" siempre al final ── */}
          {(() => {
            const q = inputValue.trim();
            const isEmail = q.includes('@');
            const label = isEmail
              ? `Crear nuevo con email "${q}"`
              : `Crear nuevo con nombre "${q}"`;
            const createIndex = matches.length;
            const isHighlighted = createIndex === highlightedIndex;

            return (
              <li
                id={`${listboxId}-item-${createIndex}`}
                role="option"
                aria-selected={isHighlighted}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCreateNew();
                }}
                onMouseEnter={() => setHighlightedIndex(createIndex)}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                  'border-t border-slate-200',
                  isHighlighted ? 'bg-teal-50' : 'hover:bg-slate-50',
                ].join(' ')}
              >
                <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <Plus className="w-4 h-4 text-teal-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-teal-700 truncate leading-tight">
                    {label}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Si la persona no está en el sistema
                  </div>
                </div>
              </li>
            );
          })()}

          {/* Sin matches y no está cargando */}
          {matches.length === 0 && !loadingRelaciones && !loadingUsers && inputValue.trim() && (
            <li className="px-3 py-2.5 text-[12px] text-slate-500 flex items-center gap-2 border-b border-slate-100">
              <UserIcon className="w-4 h-4 text-slate-300 flex-shrink-0" />
              No hay personas con ese nombre o email
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
