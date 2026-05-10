/**
 * CatalogoWorkspace · vista valorizada del catálogo · Cost Intelligence
 *
 * chk5.B7 (S3.6 M1.bis · Cost Intelligence) · refactor pixel-perfect contra
 * canon Productos V2. Reemplaza selects nativos por FiltrosBar canon y
 * agrega PaginacionFooter. Layout multi-pane: tabla densa + drill-down.
 *
 * Mockup canónico: docs/mockups/cost-intelligence-canon-productos.html · Sec 1
 */

import React, { useMemo, useState } from 'react';
import { Droplets, Pill, Check, CircleX, Search, Sparkles, AlertTriangle } from 'lucide-react';
import type { Producto } from '../../../../types/producto.types';
import { calcularInvestigacion } from '../../../Productos/utils/investigacionCalculos';
import { FiltrosBar, PaginacionFooter } from '../../../../design-system';
import type { ChipGroupConfig, SortOption } from '../../../../design-system';
import { CatalogoTable } from './CatalogoTable';
import { ProductoDetailPane } from './ProductoDetailPane';

interface CatalogoWorkspaceProps {
  productos: Producto[];
  tc: number;
}

export type SortKey = 'nombre' | 'costo' | 'margen' | 'score';
export type SortDir = 'asc' | 'desc';

export interface ProductoEnriquecido {
  producto: Producto;
  costoUSD: number;
  costoPEN: number;
  precioEfectivo: number;
  margenPct: number | null;
  utilidad: number | null;
  tc: number;
  /** Score 0-100 derivado de calidad de datos · MVP sin sparklines */
  score: number;
  tieneInvestigacion: boolean;
  esCompleta: boolean;
}

const PAGE_SIZE = 25;

function calcularScore(prod: Producto, c: ReturnType<typeof calcularInvestigacion>): number {
  let score = 0;
  if (c.esCompleta) score += 30;
  else if (c.tieneInvestigacion) score += 10;
  if (c.margenPct >= 30) score += 25;
  else if (c.margenPct >= 20) score += 18;
  else if (c.margenPct >= 10) score += 8;
  if (c.precioVentaManual > 0) score += 20;
  if (c.tieneProveedores) score += 15;
  if (prod.estado === 'activo') score += 10;
  return Math.min(100, Math.max(0, score));
}

/** Bucket de score · usado en chip filter */
function scoreBucket(score: number): 'optimo' | 'medio' | 'pobre' {
  if (score >= 70) return 'optimo';
  if (score >= 40) return 'medio';
  return 'pobre';
}

export const CatalogoWorkspace: React.FC<CatalogoWorkspaceProps> = ({ productos, tc }) => {
  const [search, setSearch] = useState('');
  const [selecciones, setSelecciones] = useState<Record<string, string[]>>({});
  const [sortValue, setSortValue] = useState<string>('score_desc');
  const [seleccionado, setSeleccionado] = useState<ProductoEnriquecido | null>(null);
  const [page, setPage] = useState(1);

  // Enriquecer productos con cálculos derivados
  const enriquecidos = useMemo<ProductoEnriquecido[]>(() => {
    return productos.map((p) => {
      const c = calcularInvestigacion(p, tc);
      const score = calcularScore(p, c);
      return {
        producto: p,
        costoUSD: c.costoUSD,
        costoPEN: c.costoPEN,
        precioEfectivo: c.precioEfectivo,
        margenPct: c.tieneInvestigacion ? c.margenPct : null,
        utilidad: c.tieneInvestigacion ? c.utilidad : null,
        tc: c.tc,
        score,
        tieneInvestigacion: c.tieneInvestigacion,
        esCompleta: c.esCompleta,
      };
    });
  }, [productos, tc]);

  // Líneas únicas para filtro
  const lineasInfo = useMemo(() => {
    const map = new Map<string, number>();
    productos.forEach((p) => {
      const linea = p.lineaNegocioNombre ?? 'sin_linea';
      map.set(linea, (map.get(linea) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .filter(([k]) => k !== 'sin_linea')
      .sort((a, b) => b[1] - a[1]);
  }, [productos]);

  // Contadores para chips
  const counts = useMemo(() => {
    let activos = 0;
    let inactivos = 0;
    let conInv = 0;
    let sinInv = 0;
    const score: Record<'optimo' | 'medio' | 'pobre', number> = { optimo: 0, medio: 0, pobre: 0 };
    enriquecidos.forEach((e) => {
      if (e.producto.estado === 'activo') activos++;
      else inactivos++;
      if (e.tieneInvestigacion) conInv++;
      else sinInv++;
      score[scoreBucket(e.score)]++;
    });
    return { activos, inactivos, conInv, sinInv, score };
  }, [enriquecidos]);

  // Configurar chip groups canon F3
  const chipGroups: ChipGroupConfig[] = useMemo(() => [
    {
      key: 'linea',
      label: 'Línea',
      options: lineasInfo.map(([nombre, c]) => ({
        value: nombre,
        label: nombre,
        icon: nombre.toLowerCase().includes('skin') ? Droplets : Pill,
        variant: nombre.toLowerCase().includes('skin') ? 'amber' as const : 'indigo' as const,
        count: c,
      })),
      multi: true,
    },
    {
      key: 'estado',
      label: 'Estado',
      options: [
        { value: 'activo',   label: 'Activos',   icon: Check,    variant: 'emerald' as const, count: counts.activos },
        { value: 'inactivo', label: 'Inactivos', icon: CircleX,  variant: 'slate' as const,   count: counts.inactivos },
      ],
      multi: true,
    },
    {
      key: 'investigacion',
      label: 'Investigación',
      options: [
        { value: 'con', label: 'Con investigación', icon: Sparkles, variant: 'emerald' as const, count: counts.conInv },
        { value: 'sin', label: 'Sin investigar',    icon: Search,   variant: 'amber'   as const, count: counts.sinInv },
      ],
      multi: false,
    },
    {
      key: 'score',
      label: 'Score',
      options: [
        { value: 'optimo', label: 'Óptimo (70+)',   variant: 'emerald' as const, count: counts.score.optimo },
        { value: 'medio',  label: 'Medio (40-69)', variant: 'amber'   as const, count: counts.score.medio },
        { value: 'pobre',  label: 'Pobre (<40)',   variant: 'rose'    as const, count: counts.score.pobre },
      ],
      multi: true,
    },
  ], [lineasInfo, counts]);

  // Sort options canon
  const sortOptions: SortOption[] = [
    { value: 'score_desc',  label: 'Score ↓' },
    { value: 'score_asc',   label: 'Score ↑' },
    { value: 'nombre_asc',  label: 'Nombre A-Z' },
    { value: 'margen_desc', label: 'Margen ↓' },
    { value: 'costo_asc',   label: 'Costo ↑' },
    { value: 'costo_desc',  label: 'Costo ↓' },
  ];

  // Aplicar filtros + sort
  const visibles = useMemo(() => {
    let res = enriquecidos;

    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter((e) =>
        e.producto.sku?.toLowerCase().includes(q) ||
        e.producto.nombreComercial?.toLowerCase().includes(q) ||
        e.producto.marca?.toLowerCase().includes(q)
      );
    }
    const sLinea = selecciones.linea ?? [];
    if (sLinea.length > 0) {
      res = res.filter((e) => e.producto.lineaNegocioNombre && sLinea.includes(e.producto.lineaNegocioNombre));
    }
    const sEstado = selecciones.estado ?? [];
    if (sEstado.length > 0) {
      res = res.filter((e) => sEstado.includes(e.producto.estado as string));
    }
    const sInv = selecciones.investigacion ?? [];
    if (sInv.length > 0) {
      const wantCon = sInv.includes('con');
      res = res.filter((e) => e.tieneInvestigacion === wantCon);
    }
    const sScore = selecciones.score ?? [];
    if (sScore.length > 0) {
      res = res.filter((e) => sScore.includes(scoreBucket(e.score)));
    }

    // Sort
    res = [...res].sort((a, b) => {
      switch (sortValue) {
        case 'nombre_asc':
          return (a.producto.nombreComercial ?? '').localeCompare(b.producto.nombreComercial ?? '');
        case 'margen_desc':
          return (b.margenPct ?? -Infinity) - (a.margenPct ?? -Infinity);
        case 'costo_asc':
          return a.costoPEN - b.costoPEN;
        case 'costo_desc':
          return b.costoPEN - a.costoPEN;
        case 'score_asc':
          return a.score - b.score;
        case 'score_desc':
        default:
          return b.score - a.score;
      }
    });

    return res;
  }, [enriquecidos, search, selecciones, sortValue]);

  // Paginación
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPaginas);
  const pagedVisibles = useMemo(
    () => visibles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [visibles, safePage]
  );

  // Reset page cuando cambian filtros
  React.useEffect(() => {
    setPage(1);
  }, [search, selecciones, sortValue]);

  // Handlers para FiltrosBar
  const onChipToggle = (groupKey: string, value: string) => {
    setSelecciones((prev) => {
      const current = prev[groupKey] ?? [];
      const isSelected = current.includes(value);
      const next = isSelected ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [groupKey]: next };
    });
  };

  const hayFiltrosActivos = !!search.trim() || Object.values(selecciones).some((arr) => arr.length > 0);
  const limpiarTodo = () => {
    setSearch('');
    setSelecciones({});
  };

  // Sort para tabla legacy (header sortables) · derivar de sortValue
  const [tableSortKey, tableSortDir] = useMemo<[SortKey, SortDir]>(() => {
    const parts = sortValue.split('_');
    const key = parts[0] as SortKey;
    const dir = (parts[1] as SortDir) ?? 'desc';
    return [key, dir];
  }, [sortValue]);

  const handleTableSort = (k: SortKey) => {
    const currentDir = tableSortKey === k ? (tableSortDir === 'asc' ? 'desc' : 'asc') : (k === 'nombre' ? 'asc' : 'desc');
    setSortValue(`${k}_${currentDir}`);
  };

  return (
    <>
      {/* FiltrosBar canon · chips toggle multi-grupo */}
      <FiltrosBar
        chipGroups={chipGroups}
        selecciones={selecciones}
        onChipToggle={onChipToggle}
        searchTerm={search}
        searchPlaceholder="Buscar por SKU, nombre, marca..."
        onSearchChange={setSearch}
        sortValue={sortValue}
        sortOptions={sortOptions}
        onSortChange={setSortValue}
        hayFiltrosActivos={hayFiltrosActivos}
        onLimpiarTodo={limpiarTodo}
      />

      {/* Layout multi-pane · tabla + drill-down */}
      <div
        className="grid gap-4 mt-4"
        style={{ gridTemplateColumns: seleccionado ? 'minmax(0, 1fr) 380px' : '1fr' }}
      >
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {visibles.length === 0 ? (
            <div className="p-12 text-center">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No hay productos que coincidan con los filtros</p>
              <button
                type="button"
                onClick={limpiarTodo}
                className="mt-3 text-xs font-medium text-teal-700 hover:text-teal-800"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <>
              <CatalogoTable
                enriquecidos={pagedVisibles}
                sortKey={tableSortKey}
                sortDir={tableSortDir}
                onSort={handleTableSort}
                seleccionadoId={seleccionado?.producto.id ?? null}
                onSelect={setSeleccionado}
              />
              <PaginacionFooter
                paginaActual={safePage}
                totalItems={visibles.length}
                itemsPorPagina={PAGE_SIZE}
                onCambiarPagina={setPage}
              />
            </>
          )}
        </div>

        {seleccionado && (
          <ProductoDetailPane item={seleccionado} onClose={() => setSeleccionado(null)} />
        )}
      </div>
    </>
  );
};
