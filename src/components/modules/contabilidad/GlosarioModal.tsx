/**
 * GlosarioModal · canon v5.2 chk5.E-A
 *
 * Modal con diccionario A-Z de términos contables. Buscador inline + chips por
 * categoría + entries con definición · cálculo · ejemplo · saludable.
 *
 * Pixel-perfect contra docs/mockups/contabilidad-glosario-modal-v5.2.html
 */

import React, { useState, useMemo } from 'react';
import { BookOpen, Search, Calculator, X } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import {
  GLOSARIO_CONTABLE,
  GLOSARIO_CATEGORIAS,
  type GlosarioCategoria,
  type TerminoGlosario,
} from '../../../data/glosarioContable';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type CategoriaFilter = 'todos' | GlosarioCategoria;

// Map de color → clases Tailwind para los chips
const CHIP_COLOR_MAP: Record<string, { bg: string; text: string; border: string; bgActive: string }> = {
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    bgActive: 'bg-emerald-600',
  },
  sky: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    bgActive: 'bg-sky-600',
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    bgActive: 'bg-amber-600',
  },
  rose: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    bgActive: 'bg-rose-600',
  },
  slate: {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    bgActive: 'bg-slate-600',
  },
};

// Badge category color map (versión chica para cada entry)
const BADGE_COLOR_MAP: Record<GlosarioCategoria, { bg: string; text: string }> = {
  rentabilidad: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  liquidez: { bg: 'bg-sky-50', text: 'text-sky-700' },
  eficiencia: { bg: 'bg-amber-50', text: 'text-amber-700' },
  balance: { bg: 'bg-rose-50', text: 'text-rose-700' },
  otros: { bg: 'bg-slate-100', text: 'text-slate-700' },
};

export const GlosarioModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState<CategoriaFilter>('todos');

  // Conteos por categoría
  const conteos = useMemo(() => {
    const c: Record<string, number> = { todos: GLOSARIO_CONTABLE.length };
    (Object.keys(GLOSARIO_CATEGORIAS) as GlosarioCategoria[]).forEach((cat) => {
      c[cat] = GLOSARIO_CONTABLE.filter((t) => t.categoria === cat).length;
    });
    return c;
  }, []);

  // Filtrado · search por título/sinónimo/definición + categoría
  const terminosFiltrados = useMemo(() => {
    const searchLower = search.toLowerCase().trim();
    return GLOSARIO_CONTABLE.filter((t) => {
      if (categoria !== 'todos' && t.categoria !== categoria) return false;
      if (!searchLower) return true;
      return (
        t.titulo.toLowerCase().includes(searchLower) ||
        (t.sinonimo?.toLowerCase().includes(searchLower) ?? false) ||
        t.definicion.toLowerCase().includes(searchLower)
      );
    }).sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
  }, [search, categoria]);

  // Agrupar por primera letra para mostrar headers A · B · C
  const terminosAgrupados = useMemo(() => {
    const grupos: Record<string, TerminoGlosario[]> = {};
    terminosFiltrados.forEach((t) => {
      const letra = t.titulo.charAt(0).toUpperCase();
      if (!grupos[letra]) grupos[letra] = [];
      grupos[letra].push(t);
    });
    return grupos;
  }, [terminosFiltrados]);

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={() => onClose()}
      title="Glosario contable"
      subtitle="Todos los términos técnicos del módulo explicados en lenguaje claro"
      icon={BookOpen}
      iconTone="purple"
      submitLabel="Cerrar"
      submitVariant="primary"
      cancelLabel=""
      size="lg"
    >
      <div className="space-y-4">
        {/* Buscador */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar término · ej. EBITDA, margen, liquidez..."
            className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-lg text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Chips categoría · scroll horizontal mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          <button
            type="button"
            onClick={() => setCategoria('todos')}
            className={`text-[10px] font-bold whitespace-nowrap px-2.5 py-1 rounded-full transition-colors ${
              categoria === 'todos'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Todos · {conteos.todos}
          </button>
          {(Object.keys(GLOSARIO_CATEGORIAS) as GlosarioCategoria[]).map((cat) => {
            const meta = GLOSARIO_CATEGORIAS[cat];
            const colors = CHIP_COLOR_MAP[meta.color] || CHIP_COLOR_MAP.slate;
            const isActive = categoria === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoria(cat)}
                className={`text-[10px] font-semibold whitespace-nowrap px-2.5 py-1 rounded-full transition-colors ${
                  isActive
                    ? `${colors.bgActive} text-white`
                    : `${colors.bg} ${colors.text} border ${colors.border} hover:opacity-80`
                }`}
              >
                {meta.label} · {conteos[cat] || 0}
              </button>
            );
          })}
        </div>

        {/* Lista A-Z scrollable */}
        <div className="max-h-[500px] overflow-y-auto space-y-4 pr-1">
          {terminosFiltrados.length === 0 && (
            <div className="text-center py-12 text-[12px] text-slate-500">
              <Search className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <div className="font-semibold text-slate-700">Sin resultados</div>
              <div className="text-[11px] mt-1">
                No encontramos términos que coincidan con "{search}"
              </div>
            </div>
          )}

          {Object.keys(terminosAgrupados)
            .sort()
            .map((letra) => (
              <div key={letra}>
                <div className="text-[11px] uppercase tracking-wider font-bold text-purple-700 mb-2">
                  {letra}
                </div>
                <div className="space-y-2">
                  {terminosAgrupados[letra].map((t) => (
                    <GlosarioEntry key={t.id} termino={t} />
                  ))}
                </div>
              </div>
            ))}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-500 text-center">
          {GLOSARIO_CONTABLE.length} términos · actualizado periódicamente
        </div>
      </div>
    </FormModalV2>
  );
};

// ============================================================================
// SUB-COMPONENTE · entry individual del glosario
// ============================================================================

const GlosarioEntry: React.FC<{ termino: TerminoGlosario }> = ({ termino }) => {
  const badgeColors = BADGE_COLOR_MAP[termino.categoria];
  const isClave = termino.esClave;

  return (
    <div
      className={`border rounded-xl p-3 transition-colors ${
        isClave
          ? 'border-purple-200 bg-purple-50/30 ring-2 ring-purple-100'
          : 'border-slate-200 hover:border-purple-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[13px] font-bold text-slate-900">{termino.titulo}</span>
          <span
            className={`text-[10px] ${badgeColors.bg} ${badgeColors.text} px-1.5 py-0.5 rounded font-bold`}
          >
            {GLOSARIO_CATEGORIAS[termino.categoria].label}
          </span>
        </div>
        {isClave && (
          <span className="text-[9px] text-purple-600 italic font-bold whitespace-nowrap">
            ★ término clave
          </span>
        )}
      </div>

      {termino.sinonimo && (
        <div className="text-[10px] text-slate-500 italic mb-1">{termino.sinonimo}</div>
      )}

      <p className="text-[11px] text-slate-600 leading-relaxed">{termino.definicion}</p>

      {termino.calculo && (
        <div className="text-[10px] text-slate-500 mt-1.5 flex items-start gap-1.5">
          <Calculator className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>
            <span className="text-slate-400">Cálculo:</span> {termino.calculo}
          </span>
        </div>
      )}

      {termino.ejemplo && (
        <div className="text-[10px] text-slate-500 mt-1.5">
          <span className="text-slate-400 font-medium">Ejemplo:</span> {termino.ejemplo}
        </div>
      )}

      {termino.saludable && (
        <div className="text-[10px] mt-1.5">
          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded inline-block">
            ✓ Saludable: {termino.saludable}
          </span>
        </div>
      )}
    </div>
  );
};

export default GlosarioModal;
