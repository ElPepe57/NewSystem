/**
 * EntidadMaestraAutocomplete · Componente compartido (Fase B-feedback v6.1)
 *
 * Autocomplete con vínculo al Gestor Maestro reutilizable para Proveedor o Competidor.
 * Sigue el patrón canónico V2:
 *   - Input con icono + estado vinculado (check verde · card emerald)
 *   - Dropdown con resultados filtrables + metadata útil (código, plataformas, tipo, país)
 *   - Footer "+ Crear ... en Gestor Maestro" cuando hay query sin match exacto
 *   - Filtro opcional por país (proveedor)
 *
 * Mockups: 37 (proveedor) + 38 (competidor) — Estado A
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Users as UsersIcon,
  PlusCircle,
  Loader2,
  Check,
  Search as SearchIcon,
  X,
} from 'lucide-react';

export type EntidadTipo = 'proveedor' | 'competidor';

export interface EntidadMaestraItem {
  id: string;
  codigo?: string;
  nombre: string;
  pais?: string;
  // Proveedor
  tipo?: string;             // "distribuidor", "fabricante", etc.
  metricasOC?: number;
  // Competidor
  plataformasResumen?: string[];   // ["Web propia", "Mercado Libre", "Instagram"]
  plataformaPrincipal?: string;
}

interface EntidadMaestraAutocompleteProps {
  tipo: EntidadTipo;
  /** Item actualmente vinculado (si está editando) */
  itemSeleccionadoId?: string;
  itemSeleccionadoSnapshot?: EntidadMaestraItem;
  /** Lista del Gestor Maestro */
  items: EntidadMaestraItem[];
  loading?: boolean;
  /** Filtro por país (solo proveedor) */
  filtroPais?: string;
  /** Color de tema · teal (proveedor) | amber (competidor) */
  tema: 'teal' | 'amber';
  /** Callback al seleccionar un item existente */
  onSelect: (item: EntidadMaestraItem) => void;
  /** Callback al pedir crear nuevo (con el query actual como nombre sugerido) */
  onSolicitarCrear: (queryActual: string) => void;
  /** Callback al desvincular (botón Cambiar en card vinculada) */
  onDesvincular?: () => void;
}

const COLOR_THEME = {
  teal: {
    border: 'border-teal-300',
    borderInput: 'focus:border-teal-500 focus:ring-teal-400',
    bg: 'bg-teal-50',
    bgHover: 'hover:bg-teal-50',
    bgFooter: 'bg-teal-50',
    bgFooterHover: 'hover:bg-teal-100',
    border2Footer: 'border-teal-200',
    text: 'text-teal-700',
    textBold: 'text-teal-700',
    textBolder: 'text-teal-900',
    icon: 'text-teal-600',
  },
  amber: {
    border: 'border-amber-300',
    borderInput: 'focus:border-amber-500 focus:ring-amber-400',
    bg: 'bg-amber-50',
    bgHover: 'hover:bg-amber-50',
    bgFooter: 'bg-amber-50',
    bgFooterHover: 'hover:bg-amber-100',
    border2Footer: 'border-amber-200',
    text: 'text-amber-700',
    textBold: 'text-amber-700',
    textBolder: 'text-amber-900',
    icon: 'text-amber-600',
  },
} as const;

export function EntidadMaestraAutocomplete({
  tipo,
  itemSeleccionadoId,
  itemSeleccionadoSnapshot,
  items,
  loading = false,
  filtroPais,
  tema,
  onSelect,
  onSolicitarCrear,
  onDesvincular,
}: EntidadMaestraAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const cls = COLOR_THEME[tema];
  const Icon = tipo === 'proveedor' ? Building2 : UsersIcon;

  // Click fuera cierra dropdown
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Items filtrados por query + país
  const itemsFiltrados = useMemo(() => {
    let lista = items;
    if (filtroPais && tipo === 'proveedor') {
      lista = lista.filter((it) => !it.pais || it.pais === filtroPais);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      lista = lista.filter(
        (it) =>
          it.nombre.toLowerCase().includes(q) ||
          (it.codigo ?? '').toLowerCase().includes(q),
      );
    }
    return lista.slice(0, 12);
  }, [items, query, filtroPais, tipo]);

  // Si hay snapshot vinculado: mostrar card verde
  if (itemSeleccionadoId && itemSeleccionadoSnapshot) {
    const it = itemSeleccionadoSnapshot;
    return (
      <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 px-3 py-2 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
          <Check className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {it.codigo && (
              <span className="text-xs font-mono text-slate-500">{it.codigo}</span>
            )}
            <span className="text-sm font-bold text-slate-900 truncate">{it.nombre}</span>
            {it.tipo && (
              <span className="px-1.5 py-0.5 text-[9px] rounded bg-purple-100 text-purple-800 font-semibold">
                {it.tipo}
              </span>
            )}
            {it.pais && (
              <span className="px-1.5 py-0.5 text-[9px] rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                {it.pais}
              </span>
            )}
          </div>
          {it.plataformasResumen && it.plataformasResumen.length > 0 && (
            <div className="text-[10px] text-slate-600 mt-0.5 truncate">
              {it.plataformasResumen.length} plataforma
              {it.plataformasResumen.length === 1 ? '' : 's'}:{' '}
              {it.plataformasResumen.join(' · ')}
            </div>
          )}
          {it.metricasOC !== undefined && it.metricasOC > 0 && (
            <div className="text-[10px] text-slate-600 mt-0.5">
              {it.metricasOC} OCs históricas
            </div>
          )}
        </div>
        {onDesvincular && (
          <button
            onClick={onDesvincular}
            className={`text-[10px] font-bold ${cls.text} hover:underline flex-shrink-0`}
            type="button"
          >
            Cambiar
          </button>
        )}
      </div>
    );
  }

  // Modo búsqueda: input + dropdown
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Icon className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400`} />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={
            tipo === 'proveedor' ? 'Buscar o crear proveedor...' : 'Buscar o crear competidor...'
          }
          className={`w-full pl-9 pr-9 py-2 border-2 ${cls.border} rounded-lg text-sm focus:outline-none focus:ring-2 ${cls.borderInput} bg-white`}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {!loading && !query && (
          <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
        )}
      </div>

      {open && (
        <div className="absolute z-[60] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-72 overflow-hidden">
          <div className="max-h-56 overflow-y-auto">
            {itemsFiltrados.length === 0 ? (
              <div className="px-3 py-3 text-center text-slate-500 text-xs italic">
                {loading
                  ? 'Cargando...'
                  : query
                    ? `No se encontró "${query}"`
                    : tipo === 'proveedor'
                      ? 'Escribí para buscar o creá un nuevo proveedor'
                      : 'Escribí para buscar o creá un nuevo competidor'}
              </div>
            ) : (
              itemsFiltrados.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    onSelect(it);
                    setQuery('');
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 text-left ${cls.bgHover} border-b border-slate-100 last:border-b-0`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon className={`w-3.5 h-3.5 ${cls.icon} mt-0.5 flex-shrink-0`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {it.codigo && (
                            <span className="text-xs font-mono text-slate-400">{it.codigo}</span>
                          )}
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {it.nombre}
                          </span>
                          {it.tipo && (
                            <span className="px-1.5 py-0.5 text-[9px] rounded bg-purple-100 text-purple-800 font-semibold">
                              {it.tipo}
                            </span>
                          )}
                          {it.pais && (
                            <span className="px-1.5 py-0.5 text-[9px] rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                              {it.pais}
                            </span>
                          )}
                        </div>
                        {it.plataformasResumen && it.plataformasResumen.length > 0 && (
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                            {it.plataformasResumen.length} plataforma
                            {it.plataformasResumen.length === 1 ? '' : 's'}:{' '}
                            <span className={`font-medium ${cls.textBold}`}>
                              {it.plataformasResumen.slice(0, 2).join(' · ')}
                            </span>
                            {it.plataformasResumen.length > 2 && (
                              <span> · +{it.plataformasResumen.length - 2} más</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {it.metricasOC !== undefined && it.metricasOC > 0 && (
                      <span className="text-[10px] text-slate-400 tabular-nums flex-shrink-0">
                        {it.metricasOC} OCs
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer · crear nuevo */}
          {query.trim() && (
            <button
              type="button"
              onClick={() => {
                onSolicitarCrear(query.trim());
                setOpen(false);
              }}
              className={`w-full px-3 py-2.5 text-left ${cls.bgFooter} ${cls.bgFooterHover} ${cls.text} border-t ${cls.border2Footer} flex items-center gap-2 transition-colors`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">
                Crear "{query.trim()}" como nuevo {tipo === 'proveedor' ? 'proveedor' : 'competidor'} en Gestor Maestro
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
