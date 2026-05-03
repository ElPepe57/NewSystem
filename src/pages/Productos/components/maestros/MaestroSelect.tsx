/**
 * MaestroSelect · Componente reutilizable Single-Select con creación inline
 *
 * Implementa el patrón "Campo Creable" del mockup #41 v4 para:
 *   - Marca (vinculo a marcaStore)
 *   - Tipo de producto (vinculo a tipoProductoStore)
 *
 * Pattern:
 *   1. Input con autocomplete + dropdown filtrable
 *   2. Sugiere existentes del Gestor Maestro
 *   3. Si no hay match: footer "+ Crear 'X' como nuevo en Gestor Maestro"
 *   4. Click crea + selecciona automáticamente
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Layers, PlusCircle, Loader2, Check, ChevronDown, Award, X } from 'lucide-react';

export interface MaestroItem {
  id: string;
  nombre: string;
  /** Metadata opcional para mostrar */
  codigo?: string;
  meta1?: string;       // ej: "fabricante" para tipo, "USA" para país
  meta2?: string;       // ej: "12 prods" para conteo de uso
}

interface MaestroSelectProps {
  label: string;
  required?: boolean;
  /** Item actualmente seleccionado (id) */
  valueId?: string;
  /** Snapshot del item (nombre + meta) */
  valueSnapshot?: MaestroItem;
  /** Lista del Gestor Maestro */
  items: MaestroItem[];
  loading?: boolean;
  /** Tipo de maestro · define icono + tema */
  tipo: 'marca' | 'tipo-producto' | 'generico';
  /** Callback al seleccionar item existente */
  onSelect: (item: MaestroItem) => void;
  /** Callback al pedir crear nuevo (con el query actual como nombre) */
  onSolicitarCrear: (queryActual: string) => void;
  /** Callback al desvincular */
  onClear?: () => void;
  /** Placeholder del input */
  placeholder?: string;
  /** Helper text bajo el input */
  helperText?: string;
}

const ICONO_TIPO = {
  marca: Award,
  'tipo-producto': Layers,
  generico: Building2,
};

const TEMA_TIPO = {
  marca: { border: 'border-emerald-300', focus: 'focus:ring-emerald-400 focus:border-emerald-500', bg: 'bg-emerald-50', icon: 'text-emerald-600' },
  'tipo-producto': { border: 'border-indigo-300', focus: 'focus:ring-indigo-400 focus:border-indigo-500', bg: 'bg-indigo-50', icon: 'text-indigo-600' },
  generico: { border: 'border-teal-300', focus: 'focus:ring-teal-400 focus:border-teal-500', bg: 'bg-teal-50', icon: 'text-teal-600' },
};

export function MaestroSelect({
  label,
  required,
  valueId,
  valueSnapshot,
  items,
  loading = false,
  tipo,
  onSelect,
  onSolicitarCrear,
  onClear,
  placeholder,
  helperText,
}: MaestroSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const Icon = ICONO_TIPO[tipo];
  const tema = TEMA_TIPO[tipo];

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

  // Items filtrados
  const itemsFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    return items
      .filter(it => it.nombre.toLowerCase().includes(q) || (it.codigo ?? '').toLowerCase().includes(q))
      .slice(0, 12);
  }, [items, query]);

  // Estado vinculado · mostrar card emerald
  if (valueId && valueSnapshot) {
    return (
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 px-3 py-2 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {valueSnapshot.codigo && (
                <span className="text-[10px] font-mono text-slate-500">{valueSnapshot.codigo}</span>
              )}
              <span className="text-sm font-bold text-slate-900 truncate">{valueSnapshot.nombre}</span>
              {valueSnapshot.meta1 && (
                <span className="px-1.5 py-0.5 text-[9px] rounded bg-purple-100 text-purple-800 font-semibold">
                  {valueSnapshot.meta1}
                </span>
              )}
            </div>
            {valueSnapshot.meta2 && (
              <div className="text-[10px] text-slate-600 mt-0.5">{valueSnapshot.meta2}</div>
            )}
          </div>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] font-bold text-emerald-700 hover:underline flex-shrink-0"
            >
              Cambiar
            </button>
          )}
        </div>
        {helperText && <div className="text-[9px] text-slate-500 mt-0.5">{helperText}</div>}
      </div>
    );
  }

  // Modo búsqueda
  return (
    <div ref={containerRef}>
      <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
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
          placeholder={placeholder ?? `Buscar o crear ${label.toLowerCase()}...`}
          className={`w-full pl-9 pr-9 py-1.5 border-2 ${tema.border} rounded-lg text-sm focus:outline-none focus:ring-2 ${tema.focus} bg-white`}
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
        ) : (
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        )}
      </div>
      {helperText && <div className="text-[9px] text-slate-500 mt-0.5">{helperText}</div>}

      {open && (
        <div className="relative">
          <div className="absolute z-[60] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-72 overflow-hidden">
            <div className="max-h-56 overflow-y-auto">
              {itemsFiltrados.length === 0 ? (
                <div className="px-3 py-3 text-center text-slate-500 text-xs italic">
                  {loading ? 'Cargando...' : query ? `No se encontró "${query}"` : 'Escribí para buscar...'}
                </div>
              ) : (
                <>
                  <div className="px-3 py-1.5 text-[9px] uppercase tracking-wider text-slate-500 font-bold bg-slate-50 border-b border-slate-100">
                    {itemsFiltrados.length} coincidencia{itemsFiltrados.length === 1 ? '' : 's'} del Gestor Maestro
                  </div>
                  {itemsFiltrados.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        onSelect(it);
                        setQuery('');
                        setOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left hover:${tema.bg} border-b border-slate-100 last:border-b-0 flex items-start gap-2`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${tema.icon} mt-0.5 flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {it.codigo && <span className="text-[10px] font-mono text-slate-400">{it.codigo}</span>}
                          <span className="text-xs font-bold text-slate-900 truncate">{it.nombre}</span>
                          {it.meta1 && (
                            <span className="px-1.5 py-0.5 text-[9px] rounded bg-purple-100 text-purple-800 font-semibold">
                              {it.meta1}
                            </span>
                          )}
                        </div>
                        {it.meta2 && <div className="text-[10px] text-slate-500">{it.meta2}</div>}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>

            {query.trim() && (
              <button
                type="button"
                onClick={() => {
                  onSolicitarCrear(query.trim());
                  setOpen(false);
                  setQuery('');
                }}
                className={`w-full px-3 py-2.5 text-left ${tema.bg} hover:opacity-90 border-t-2 ${tema.border} flex items-center gap-2 transition-all`}
              >
                <PlusCircle className={`w-3.5 h-3.5 ${tema.icon}`} />
                <span className={`text-xs font-bold ${tema.icon.replace('text', 'text')}`}>
                  Crear "{query.trim()}" como {label.toLowerCase()}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
