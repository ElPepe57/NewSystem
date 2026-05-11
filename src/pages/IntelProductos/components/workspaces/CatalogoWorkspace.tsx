/**
 * CatalogoWorkspace · vista valorizada del catálogo · Cost Intelligence
 *
 * chk5.B8 (S3.6 M1.bis · Cost Intelligence) · refactor canon CI con lógica
 * propia (NO investigación). Recibe SKUs con costos reales del shell.
 *
 * Filtros canon F3 (3 dimensiones propias CI):
 *   - Línea (skincare/suplemento/etc.)
 *   - Estado costo (estable/volátil/anómalo · derivado de variance)
 *   - Etapa pipeline (pedido/tránsito/aduana/almacén · de unidades)
 *
 * Layout multi-pane: tabla densa + drill-down (F6 pattern · 4 tabs CI).
 *
 * Mockup canónico: docs/mockups/cost-intelligence-canon-productos.html · Sec 1
 */

import React, { useMemo, useState } from 'react';
import {
  Droplets,
  Pill,
  Check,
  Activity,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { FiltrosBar, PaginacionFooter } from '../../../../design-system';
import type { ChipGroupConfig, SortOption } from '../../../../design-system';
import { CatalogoTable, type SortKey, type SortDir } from './CatalogoTable';
import { ProductoDetailPane } from './ProductoDetailPane';
import type { SkuConCostos, EtapaPipeline, EstadoCosto } from '../../utils/costIntelligence';
import { ETAPA_LABELS, ESTADO_COSTO_LABELS } from '../../utils/costIntelligence';

interface CatalogoWorkspaceProps {
  skus: SkuConCostos[];
}

const PAGE_SIZE = 25;

export const CatalogoWorkspace: React.FC<CatalogoWorkspaceProps> = ({ skus }) => {
  const [search, setSearch] = useState('');
  const [selecciones, setSelecciones] = useState<Record<string, string[]>>({});
  const [sortValue, setSortValue] = useState<string>('variance_desc');
  const [seleccionado, setSeleccionado] = useState<SkuConCostos | null>(null);
  const [page, setPage] = useState(1);

  // Líneas únicas (con contador)
  const lineasInfo = useMemo(() => {
    const map = new Map<string, number>();
    skus.forEach((s) => {
      const linea = s.lineaNegocioNombre ?? 'sin_linea';
      map.set(linea, (map.get(linea) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .filter(([k]) => k !== 'sin_linea')
      .sort((a, b) => b[1] - a[1]);
  }, [skus]);

  // Contadores por estado de costo + etapa pipeline
  const counts = useMemo(() => {
    const estadoCosto: Record<EstadoCosto, number> = { estable: 0, volatil: 0, anomalo: 0 };
    const etapa: Record<EtapaPipeline, number> = { pedido: 0, transito: 0, aduana: 0, almacen: 0 };
    skus.forEach((s) => {
      if (s.estadoCosto) estadoCosto[s.estadoCosto]++;
      if (s.etapaPipeline) etapa[s.etapaPipeline]++;
    });
    return { estadoCosto, etapa };
  }, [skus]);

  // Chip groups canon F3
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
      key: 'estadoCosto',
      label: 'Estado costo',
      options: [
        { value: 'estable', label: ESTADO_COSTO_LABELS.estable, icon: Check,    variant: 'emerald' as const, count: counts.estadoCosto.estable },
        { value: 'volatil', label: ESTADO_COSTO_LABELS.volatil, icon: Activity, variant: 'amber'   as const, count: counts.estadoCosto.volatil },
        { value: 'anomalo', label: ESTADO_COSTO_LABELS.anomalo, icon: Zap,      variant: 'rose'    as const, count: counts.estadoCosto.anomalo },
      ],
      multi: true,
    },
    {
      key: 'etapa',
      label: 'Etapa',
      options: [
        { value: 'pedido',   label: ETAPA_LABELS.pedido,   variant: 'slate' as const, count: counts.etapa.pedido   },
        { value: 'transito', label: ETAPA_LABELS.transito, variant: 'slate' as const, count: counts.etapa.transito },
        { value: 'aduana',   label: ETAPA_LABELS.aduana,   variant: 'slate' as const, count: counts.etapa.aduana   },
        { value: 'almacen',  label: ETAPA_LABELS.almacen,  variant: 'slate' as const, count: counts.etapa.almacen  },
      ],
      multi: true,
    },
  ], [lineasInfo, counts]);

  // Sort options canon CI
  const sortOptions: SortOption[] = [
    { value: 'variance_desc',     label: 'Variance ↓' },
    { value: 'variance_asc',      label: 'Variance ↑' },
    { value: 'capital_desc',      label: 'Capital ↓' },
    { value: 'capital_asc',       label: 'Capital ↑' },
    { value: 'ultimoCosto_desc',  label: 'Último costo ↓' },
    { value: 'ultimoCosto_asc',   label: 'Último costo ↑' },
    { value: 'stability_desc',    label: 'Stability ↓' },
    { value: 'stability_asc',     label: 'Stability ↑' },
    { value: 'nombre_asc',        label: 'Nombre A-Z' },
  ];

  // Aplicar filtros + sort
  const visibles = useMemo(() => {
    let res = skus;

    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter((s) =>
        s.sku.toLowerCase().includes(q) ||
        s.nombreComercial.toLowerCase().includes(q) ||
        (s.marca ?? '').toLowerCase().includes(q) ||
        s.lotes.some((l) => l.loteId.toLowerCase().includes(q))
      );
    }

    const sLinea = selecciones.linea ?? [];
    if (sLinea.length > 0) {
      res = res.filter((s) => s.lineaNegocioNombre && sLinea.includes(s.lineaNegocioNombre));
    }

    const sEstadoCosto = selecciones.estadoCosto ?? [];
    if (sEstadoCosto.length > 0) {
      res = res.filter((s) => s.estadoCosto && sEstadoCosto.includes(s.estadoCosto));
    }

    const sEtapa = selecciones.etapa ?? [];
    if (sEtapa.length > 0) {
      res = res.filter((s) => s.etapaPipeline && sEtapa.includes(s.etapaPipeline));
    }

    // Sort
    res = [...res].sort((a, b) => {
      switch (sortValue) {
        case 'nombre_asc':
          return a.nombreComercial.localeCompare(b.nombreComercial);
        case 'variance_asc':
          return (a.varianceVsLoteAntPct ?? Infinity) - (b.varianceVsLoteAntPct ?? Infinity);
        case 'variance_desc':
          return (b.varianceVsLoteAntPct ?? -Infinity) - (a.varianceVsLoteAntPct ?? -Infinity);
        case 'capital_asc':
          return a.capitalActivoPEN - b.capitalActivoPEN;
        case 'capital_desc':
          return b.capitalActivoPEN - a.capitalActivoPEN;
        case 'ultimoCosto_asc':
          return a.ultimoCostoPEN - b.ultimoCostoPEN;
        case 'ultimoCosto_desc':
          return b.ultimoCostoPEN - a.ultimoCostoPEN;
        case 'stability_asc':
          return a.stabilityScore - b.stabilityScore;
        case 'stability_desc':
          return b.stabilityScore - a.stabilityScore;
        default:
          return 0;
      }
    });

    return res;
  }, [skus, search, selecciones, sortValue]);

  // Paginación
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPaginas);
  const pagedVisibles = useMemo(
    () => visibles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [visibles, safePage]
  );

  React.useEffect(() => {
    setPage(1);
  }, [search, selecciones, sortValue]);

  // Handlers
  const onChipToggle = (groupKey: string, value: string) => {
    setSelecciones((prev) => {
      const current = prev[groupKey] ?? [];
      const isSelected = current.includes(value);
      const next = isSelected ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [groupKey]: next };
    });
  };

  const hayFiltrosActivos =
    !!search.trim() || Object.values(selecciones).some((arr) => arr.length > 0);
  const limpiarTodo = () => {
    setSearch('');
    setSelecciones({});
  };

  // Sort para tabla header (derivar de sortValue)
  const [tableSortKey, tableSortDir] = useMemo<[SortKey, SortDir]>(() => {
    const parts = sortValue.split('_');
    const key = parts[0] as SortKey;
    const dir = (parts[1] as SortDir) ?? 'desc';
    return [key, dir];
  }, [sortValue]);

  const handleTableSort = (k: SortKey) => {
    const currentDir =
      tableSortKey === k
        ? tableSortDir === 'asc'
          ? 'desc'
          : 'asc'
        : k === 'nombre'
        ? 'asc'
        : 'desc';
    setSortValue(`${k}_${currentDir}`);
  };

  return (
    <>
      {/* FiltrosBar canon · chips toggle multi-grupo · 3 dimensiones CI */}
      <FiltrosBar
        chipGroups={chipGroups}
        selecciones={selecciones}
        onChipToggle={onChipToggle}
        searchTerm={search}
        searchPlaceholder="Buscar por SKU, nombre, lote..."
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
        style={{ gridTemplateColumns: seleccionado ? 'minmax(0, 1fr) 420px' : '1fr' }}
      >
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {visibles.length === 0 ? (
            <div className="p-12 text-center">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                No hay SKUs con costos que coincidan con los filtros
              </p>
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
                skus={pagedVisibles}
                sortKey={tableSortKey}
                sortDir={tableSortDir}
                onSort={handleTableSort}
                seleccionadoId={seleccionado?.productoId ?? null}
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
          <ProductoDetailPane
            sku={seleccionado}
            onClose={() => setSeleccionado(null)}
          />
        )}
      </div>
    </>
  );
};
