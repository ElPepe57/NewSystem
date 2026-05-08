/**
 * MaestroChipsMulti · Componente reutilizable Multi-Chips con creación inline
 *
 * Implementa el patrón "CHIPS creables" del mockup #41 v4 para:
 *   - Categorías (vinculo a categoriaStore · max 5 · una marcable como PRINCIPAL)
 *   - Etiquetas (vinculo a etiquetaStore · libres · sin límite)
 *
 * Pattern:
 *   1. Caja con chips ya seleccionados (con X para remover)
 *   2. Chip "PRINCIPAL" si aplica (categorías)
 *   3. Input "+ otra" abre dropdown con sugerencias del Gestor Maestro
 *   4. Footer "+ Crear nuevo" cuando query sin match
 *   5. Sugerencias inline (botones) para los más usados
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, PlusCircle, Tag, Layers } from 'lucide-react';
import { FloatingDropdown } from './FloatingDropdown';

export interface MaestroChipItem {
  id: string;
  nombre: string;
  codigo?: string;
}

export interface MaestroChipSelection {
  id: string;
  nombre: string;
  esPrincipal?: boolean;
}

interface MaestroChipsMultiProps {
  label: string;
  required?: boolean;
  /** Chips actualmente seleccionados */
  selecciones: MaestroChipSelection[];
  /** Lista del Gestor Maestro */
  items: MaestroChipItem[];
  loading?: boolean;
  /** Permite marcar uno como principal · default false */
  permitePrincipal?: boolean;
  /** Maximo de chips · default sin limite */
  maximo?: number;
  /** Sugerencias inline rápidas (más usadas) */
  sugerenciasRapidas?: MaestroChipItem[];
  tema?: 'emerald' | 'amber';
  onChange: (selecciones: MaestroChipSelection[]) => void;
  /** Callback al pedir crear nuevo · debe retornar el ID del nuevo */
  onCrearNuevo: (nombre: string) => Promise<string | null>;
  helperText?: string;
}

const TEMA = {
  emerald: {
    border: 'border-emerald-300',
    bg: 'bg-emerald-50',
    bgChip: 'bg-emerald-100',
    textChip: 'text-emerald-800',
    bgPrincipal: 'bg-emerald-600',
  },
  amber: {
    border: 'border-amber-300',
    bg: 'bg-white',
    bgChip: 'bg-amber-100',
    textChip: 'text-amber-800',
    bgPrincipal: 'bg-amber-600',
  },
};

export function MaestroChipsMulti({
  label,
  required,
  selecciones,
  items,
  loading = false,
  permitePrincipal = false,
  maximo,
  sugerenciasRapidas,
  tema = 'emerald',
  onChange,
  onCrearNuevo,
  helperText,
}: MaestroChipsMultiProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [creando, setCreando] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cls = TEMA[tema];

  const haReached = maximo !== undefined && selecciones.length >= maximo;
  const seleccionadosIds = useMemo(() => new Set(selecciones.map(s => s.id)), [selecciones]);

  // Items disponibles (no seleccionados)
  const itemsDisponibles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter(it => !seleccionadosIds.has(it.id))
      .filter(it => !q || it.nombre.toLowerCase().includes(q) || (it.codigo ?? '').toLowerCase().includes(q))
      .slice(0, 12);
  }, [items, query, seleccionadosIds]);

  // Sugerencias rápidas (no seleccionados)
  const sugerenciasFiltradas = useMemo(
    () => (sugerenciasRapidas ?? []).filter(it => !seleccionadosIds.has(it.id)).slice(0, 4),
    [sugerenciasRapidas, seleccionadosIds],
  );

  // Click fuera cierra dropdown · contempla portal (dropdownRef)
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideContainer = containerRef.current?.contains(target) ?? false;
      const insideDropdown = dropdownRef.current?.contains(target) ?? false;
      if (!insideContainer && !insideDropdown) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Handlers
  const agregar = (item: MaestroChipItem) => {
    if (haReached) return;
    const nuevo: MaestroChipSelection = {
      id: item.id,
      nombre: item.nombre,
      esPrincipal: permitePrincipal && selecciones.length === 0, // primera = principal automáticamente
    };
    onChange([...selecciones, nuevo]);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const remover = (id: string) => {
    const eraPrincipal = selecciones.find(s => s.id === id)?.esPrincipal;
    let nuevas = selecciones.filter(s => s.id !== id);
    // Si era principal, marcar la primera restante como principal
    if (eraPrincipal && permitePrincipal && nuevas.length > 0 && !nuevas.some(s => s.esPrincipal)) {
      nuevas = nuevas.map((s, i) => (i === 0 ? { ...s, esPrincipal: true } : s));
    }
    onChange(nuevas);
  };

  const marcarPrincipal = (id: string) => {
    if (!permitePrincipal) return;
    onChange(selecciones.map(s => ({ ...s, esPrincipal: s.id === id })));
  };

  const handleCrear = async (nombre: string) => {
    if (!nombre.trim() || creando || haReached) return;
    setCreando(true);
    try {
      const id = await onCrearNuevo(nombre.trim());
      if (id) {
        agregar({ id, nombre: nombre.trim() });
      }
    } finally {
      setCreando(false);
    }
  };

  return (
    <div ref={containerRef}>
      <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 flex items-center justify-between">
        <span>
          {label} {required && <span className="text-rose-500">*</span>}
          {maximo && (
            <span className="text-[9px] text-slate-400 font-normal italic ml-1">
              {selecciones.length} / {maximo}
            </span>
          )}
        </span>
      </label>

      {/* Caja con chips + input · ancla del dropdown floating */}
      <div ref={anchorRef} className={`border-2 ${cls.border} rounded-lg p-2 ${cls.bg}`}>
        <div className="flex flex-wrap gap-1.5 items-center">
          {selecciones.map((sel) => (
            <span
              key={sel.id}
              className={`px-2 py-0.5 rounded ${cls.bgChip} ${cls.textChip} text-[10px] font-bold flex items-center gap-1`}
            >
              <button
                type="button"
                onClick={() => marcarPrincipal(sel.id)}
                disabled={!permitePrincipal || sel.esPrincipal}
                className={permitePrincipal && !sel.esPrincipal ? 'cursor-pointer hover:underline' : ''}
                title={permitePrincipal && !sel.esPrincipal ? 'Click para hacer principal' : undefined}
              >
                ✓ {sel.nombre}
              </button>
              {permitePrincipal && sel.esPrincipal && (
                <span className={`text-[8px] ${cls.bgPrincipal} text-white rounded px-1 ml-0.5`}>
                  PRINCIPAL
                </span>
              )}
              <button type="button" onClick={() => remover(sel.id)} className={`hover:opacity-70 ml-0.5`}>
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          {!haReached && (
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={selecciones.length === 0 ? `Buscar ${label.toLowerCase()}...` : '+ otra...'}
              className="text-[10px] flex-1 min-w-[100px] px-1 py-0.5 focus:outline-none bg-transparent placeholder:text-slate-400"
            />
          )}
        </div>
      </div>

      {/* Sugerencias rápidas inline */}
      {sugerenciasFiltradas.length > 0 && !open && !haReached && (
        <div className="mt-1 flex flex-wrap gap-1 items-center">
          <span className="text-[9px] text-slate-500 italic">Más usadas:</span>
          {sugerenciasFiltradas.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => agregar(s)}
              className={`px-1.5 py-0.5 rounded ${cls.bg} hover:${cls.bgChip} ${cls.textChip} text-[10px] border ${cls.border}`}
            >
              + {s.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Dropdown de búsqueda · S3.5 portaleado vía FloatingDropdown
          para escapar del overflow del modal contenedor */}
      <FloatingDropdown anchorRef={anchorRef} dropdownRef={dropdownRef} isOpen={open}>
        <div className="bg-white border border-slate-200 rounded-lg shadow-xl max-h-72 overflow-hidden">
          <div className="max-h-56 overflow-y-auto">
            {itemsDisponibles.length === 0 ? (
              <div className="px-3 py-3 text-center text-slate-500 text-xs italic">
                {loading
                  ? 'Cargando...'
                  : query
                    ? `No se encontró "${query}"`
                    : 'Escribí para buscar o creá uno nuevo'}
              </div>
            ) : (
              <>
                <div className="px-3 py-1.5 text-[9px] uppercase tracking-wider text-slate-500 font-bold bg-slate-50 border-b border-slate-100">
                  {itemsDisponibles.length} disponible{itemsDisponibles.length === 1 ? '' : 's'}
                </div>
                {itemsDisponibles.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => agregar(it)}
                    className={`w-full px-3 py-1.5 text-left hover:${cls.bg} text-[11px] border-b border-slate-100 last:border-b-0`}
                  >
                    <span className="text-emerald-600 mr-1.5">+</span>
                    {it.nombre}
                    {it.codigo && <span className="text-[9px] text-slate-400 ml-1.5 font-mono">{it.codigo}</span>}
                  </button>
                ))}
              </>
            )}
          </div>

          {query.trim() && !creando && (
            <button
              type="button"
              onClick={() => handleCrear(query.trim())}
              className={`w-full px-3 py-2.5 text-left ${cls.bgChip} ${cls.textChip} hover:opacity-90 border-t-2 ${cls.border} flex items-center gap-2`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">Crear "{query.trim()}" como {label.toLowerCase()}</span>
            </button>
          )}
          {creando && (
            <div className={`w-full px-3 py-2.5 text-center ${cls.bgChip} ${cls.textChip} border-t-2 ${cls.border} text-xs`}>
              Creando...
            </div>
          )}
        </div>
      </FloatingDropdown>

      {helperText && <div className="text-[9px] text-slate-500 mt-1 italic">{helperText}</div>}
    </div>
  );
}
