/**
 * ProductosPageV2 · Shell principal del módulo Productos · Etapa 4 Fases 1+2
 *
 * Reemplazo pixel-perfect de la página `/productos` legacy cuando el flag
 * PRODUCTOS_V2 está activo. Cubre los mockups 01-09 + 33-35.
 *
 * COMPONENTES INTEGRADOS (Fase 0+1+2):
 *   - HeaderV2 · banking-grade F1
 *   - KpiStripV2 · KPI strip canónico F2
 *   - PillsRapidos · atajos (mockup 33)
 *   - FiltrosBar · barra completa (mockups 06-07)
 *   - ChipsActivos · banner de filtros activos removibles (mockup 34)
 *   - FiltrosDrawerMobile · drawer slide-up para mobile (mockup 08)
 *   - BulkActionsToolbar · acciones masivas sticky (mockup 09)
 *   - LoadingState · skeleton (mockup 04)
 *   - EmptyStateBd · onboarding sin productos (mockup 02)
 *   - EmptyStateBusqueda · sin resultados de búsqueda (mockup 03)
 *
 * PENDIENTE (Fase 3+):
 *   - Tabla/cards de producto (placeholder dashed indigo)
 *   - Modales detalle, wizards, herramientas
 *
 * Flag: localStorage.setItem('FEATURE_PRODUCTOS_V2', 'true') + reload
 */

import React, { useMemo, useEffect, useState } from 'react';
import { Filter as FilterIcon, Droplets, Pill, Box, Package2, Check, Search as SearchIcon } from 'lucide-react';
import { useToastStore } from '../../../../store/toastStore';
import { useProductoStore } from '../../../../store/productoStore';
import { useAuthStore } from '../../../../store/authStore';
import { HeaderV2 } from './HeaderV2';
import { KpiStripV2 } from './KpiStripV2';
import { LoadingState } from './LoadingState';
import { EmptyStateBd } from './EmptyStateBd';
import { EmptyStateBusqueda } from './EmptyStateBusqueda';
import {
  PillsRapidos,
  FiltrosBar,
  ChipsActivos,
  FiltrosDrawerMobile,
  BulkActionsToolbar,
  useProductosFilters,
  type PillKey,
  type ChipGroupConfig,
  type ChipColor,
  type SortOption,
} from '../filters';
import { ProductosListV2 } from '../cards';

// ─── Configuración de filtros ────────────────────────────────────────────────

const SORT_OPTIONS: SortOption[] = [
  { value: 'mas_vendidos', label: 'Más vendidos' },
  { value: 'nombre_asc', label: 'Nombre A-Z' },
  { value: 'margen_desc', label: 'Margen ↓' },
  { value: 'stock_desc', label: 'Stock ↓' },
  { value: 'recientes', label: 'Más recientes' },
];

// Mapa para renderizar chips activos con sus labels y colores
const CHIP_LABELS: Record<string, Record<string, { label: string; color: ChipColor }>> = {
  linea: {
    skincare: { label: 'Línea: Skincare', color: 'amber' },
    suplementos: { label: 'Línea: Suplementos', color: 'indigo' },
    wellness: { label: 'Línea: Wellness', color: 'emerald' },
    pack: { label: 'Línea: Pack', color: 'purple' },
  },
  tipo: {
    simple: { label: 'Tipo: Simple', color: 'slate' },
    pack: { label: 'Tipo: Pack', color: 'purple' },
  },
  estado: {
    activos: { label: 'Estado: Activos', color: 'emerald' },
    en_investigacion: { label: 'Estado: En investigación', color: 'amber' },
    archivados: { label: 'Estado: Archivados', color: 'slate' },
  },
};

const DATE_RANGE_LABEL: Record<string, string> = {
  todo: 'Todo',
  '7d': 'Últ. 7 días',
  '30d': 'Últ. 30 días',
  '90d': 'Últ. 90 días',
  '6m': 'Últ. 6 meses',
  año: 'Últ. año',
};

// ─── Componente principal ────────────────────────────────────────────────────

export const ProductosPageV2: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const toast = useToastStore();
  const { productos, archivados, loading, fetchProductos, fetchArchivados } = useProductoStore();
  const filtros = useProductosFilters();
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  // Cargar productos al montar
  useEffect(() => {
    if (user) {
      fetchProductos();
      fetchArchivados();
    }
  }, [user, fetchProductos, fetchArchivados]);

  const lista = useMemo(() => (Array.isArray(productos) ? productos : []), [productos]);

  // ─── Lista filtrada (aplicando todos los filtros + pillActivo) ─────────────
  const productosFiltered = useMemo(() => {
    let result = [...lista];

    // 1. Pill rápido (atajos predefinidos)
    switch (filtros.pillActivo) {
      case 'activos':
        result = result.filter((p: any) => p.estado === 'activo' || !p.estado);
        break;
      case 'stock_critico':
        result = result.filter((p: any) => {
          const stock = p.stockTotal ?? p.stock ?? 0;
          const minimo = p.stockMinimo ?? 0;
          return minimo > 0 && stock <= minimo;
        });
        break;
      case 'sin_investigar':
        result = result.filter((p: any) => {
          const stock = p.stockTotal ?? p.stock ?? 0;
          const minimo = p.stockMinimo ?? 0;
          const critico = minimo > 0 && stock <= minimo;
          return critico && !p.ultimaInvestigacion;
        });
        break;
      case 'packs':
        result = result.filter((p: any) => p.esPack === true);
        break;
      case 'todos':
      default:
        break;
    }

    // 2. Búsqueda por término
    if (filtros.searchTerm.trim()) {
      const term = filtros.searchTerm.toLowerCase();
      result = result.filter(
        (p: any) =>
          p.nombre?.toLowerCase().includes(term) ||
          p.marca?.toLowerCase().includes(term) ||
          p.sku?.toLowerCase().includes(term)
      );
    }

    // 3. Filtros por chip group (línea / tipo / estado)
    Object.entries(filtros.selecciones).forEach(([groupKey, values]) => {
      if (values.length === 0) return;
      result = result.filter((p: any) => {
        if (groupKey === 'linea') {
          const linea = (p.linea ?? p.lineaNegocio ?? '').toLowerCase();
          return values.some(v => linea.includes(v));
        }
        if (groupKey === 'tipo') {
          if (values.includes('pack') && p.esPack) return true;
          if (values.includes('simple') && !p.esPack) return true;
          return false;
        }
        if (groupKey === 'estado') {
          const estado = p.estado ?? 'activo';
          if (values.includes('activos') && estado === 'activo') return true;
          if (values.includes('en_investigacion') && estado === 'en_investigacion') return true;
          if (values.includes('archivados') && estado === 'archivado') return true;
          return false;
        }
        return true;
      });
    });

    // 4. Sort
    switch (filtros.sortValue) {
      case 'nombre_asc':
        result.sort((a: any, b: any) => (a.nombre ?? '').localeCompare(b.nombre ?? ''));
        break;
      case 'margen_desc':
        result.sort((a: any, b: any) => {
          const margenA = calcMargen(a);
          const margenB = calcMargen(b);
          return margenB - margenA;
        });
        break;
      case 'stock_desc':
        result.sort((a: any, b: any) => (b.stockTotal ?? b.stock ?? 0) - (a.stockTotal ?? a.stock ?? 0));
        break;
      case 'recientes':
        result.sort((a: any, b: any) => {
          const ta = a.fechaCreacion?.toDate?.()?.getTime?.() ?? 0;
          const tb = b.fechaCreacion?.toDate?.()?.getTime?.() ?? 0;
          return tb - ta;
        });
        break;
      case 'mas_vendidos':
      default:
        // sin orden específico · respeta el orden de Firestore
        break;
    }

    return result;
  }, [lista, filtros.pillActivo, filtros.searchTerm, filtros.selecciones, filtros.sortValue]);

  // ─── Counts derivados para Pills + ChipGroups ──────────────────────────────
  const counts = useMemo(() => {
    const list = lista;
    const all = list.length;
    const activos = list.filter((p: any) => p.estado === 'activo' || !p.estado).length;
    const stockCritico = list.filter((p: any) => {
      const stock = p.stockTotal ?? p.stock ?? 0;
      const minimo = p.stockMinimo ?? 0;
      return minimo > 0 && stock <= minimo;
    }).length;
    const sinInvestigar = list.filter((p: any) => {
      const stock = p.stockTotal ?? p.stock ?? 0;
      const minimo = p.stockMinimo ?? 0;
      const critico = minimo > 0 && stock <= minimo;
      return critico && !p.ultimaInvestigacion;
    }).length;
    const packs = list.filter((p: any) => p.esPack === true).length;

    // Por línea
    const skincare = list.filter((p: any) => (p.linea ?? p.lineaNegocio ?? '').toLowerCase().includes('skin')).length;
    const suplementos = list.filter((p: any) =>
      (p.linea ?? p.lineaNegocio ?? '').toLowerCase().match(/sup|vita|cap/)
    ).length;
    const wellness = list.filter((p: any) =>
      (p.linea ?? p.lineaNegocio ?? '').toLowerCase().match(/well|aloe|herb/)
    ).length;

    // Por tipo
    const simple = list.filter((p: any) => !p.esPack).length;

    // Por estado
    const enInvestigacion = list.filter((p: any) => p.estado === 'en_investigacion').length;
    const archivadosTotal = Array.isArray(archivados) ? archivados.length : 0;

    return {
      all,
      activos,
      stockCritico,
      sinInvestigar,
      packs,
      skincare,
      suplementos,
      wellness,
      simple,
      enInvestigacion,
      archivadosTotal,
    };
  }, [lista, archivados]);

  // ─── ChipGroups config dinámico (counts vienen del estado) ────────────────
  const chipGroups: ChipGroupConfig[] = useMemo(
    () => [
      {
        key: 'linea',
        label: 'Línea',
        options: [
          { value: 'skincare', label: 'Skincare', icon: Droplets, count: counts.skincare, variant: 'amber' },
          { value: 'suplementos', label: 'Suplementos', icon: Pill, count: counts.suplementos, variant: 'indigo' },
        ],
      },
      {
        key: 'tipo',
        label: 'Tipo',
        options: [
          { value: 'simple', label: 'Simple', icon: Box, count: counts.simple, variant: 'slate' },
          { value: 'pack', label: 'Pack', icon: Package2, count: counts.packs, variant: 'purple' },
        ],
      },
      {
        key: 'estado',
        label: 'Estado',
        options: [
          { value: 'activos', label: 'Activos', icon: Check, count: counts.activos, variant: 'emerald' },
          { value: 'en_investigacion', label: 'En investigación', icon: SearchIcon, count: counts.enInvestigacion, variant: 'amber' },
        ],
      },
    ],
    [counts]
  );

  // KPIs para el strip
  const kpis = useMemo(() => {
    const totales = lista.length;
    const haceUnMes = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const nuevosMes = lista.filter((p: any) => {
      const created = p.fechaCreacion?.toDate?.()?.getTime?.() ?? 0;
      return created >= haceUnMes;
    }).length;

    let variantesTotal = 0;
    let conVariantes = 0;
    lista.forEach((p: any) => {
      const numVar = (p.variantes?.length ?? 0) || (p.variantesCount ?? 0);
      if (numVar > 0) {
        variantesTotal += numVar;
        conVariantes++;
      } else {
        variantesTotal += 1;
      }
    });

    const conMargenList = lista.filter((p: any) => {
      const inv = p.investigacion?.[0];
      return inv?.ctruEstimado > 0 && p.precioVenta > 0;
    });
    const margenPromedio =
      conMargenList.length === 0
        ? 0
        : Math.round(
            conMargenList.reduce((acc: number, p: any) => {
              const inv = p.investigacion[0];
              const ctru = inv.ctruEstimado;
              const precioVenta = p.precioVenta;
              return acc + ((precioVenta - ctru) / precioVenta) * 100;
            }, 0) / conMargenList.length
          );

    return {
      activos: counts.activos,
      totales,
      nuevosMes,
      variantesTotal,
      conVariantes: conVariantes > 0 ? conVariantes : totales, // fallback: si no hay grupos, mostramos N de N
      stockCritico: counts.stockCritico,
      stockCriticoSinInvestigar: counts.sinInvestigar,
      margenPromedio,
    };
  }, [lista, counts]);

  // Chips activos para el banner debajo de FiltrosBar
  const chipsActivos = useMemo(
    () => filtros.buildChipsActivos(CHIP_LABELS, DATE_RANGE_LABEL[filtros.dateRange]),
    [filtros]
  );

  // Texto de filtros activos (para EmptyStateBusqueda)
  const filtrosActivosTexto = useMemo(() => {
    const partes: string[] = [];
    if (filtros.dateRange !== 'todo') partes.push(DATE_RANGE_LABEL[filtros.dateRange]);
    Object.entries(filtros.selecciones).forEach(([groupKey, values]) => {
      values.forEach(v => {
        const label = CHIP_LABELS[groupKey]?.[v]?.label;
        if (label) partes.push(label);
      });
    });
    return partes.join(' · ');
  }, [filtros.dateRange, filtros.selecciones]);

  const archivadosCount = counts.archivadosTotal;
  const hayProductos = lista.length > 0;
  const selectedCount = filtros.selectedIds.size;

  // ─── Handlers · placeholders hasta Fases 4-9 ───────────────────────────────
  const handleNuevo = () => toast.info('Wizard de creación · disponible en Fase 7');
  const handleArchivo = () => toast.info('Modal Papelera · disponible en Fase 8');
  const handleCalculadora = () => toast.info('Productos Intel · disponible en Fase 9');
  const handleSugerencias = () => toast.info('Sugerencias del día · disponible en Fase 9');
  const handleImportar = () => toast.info('Importar · pendiente');
  const handleExportar = () => toast.info('Exportar · pendiente');
  const handleBulkAction = (label: string) => toast.info(`${label} (${selectedCount} productos) · pendiente`);

  // ─── Render: prioridad de estados ──────────────────────────────────────────
  if (loading && !hayProductos) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 lg:py-6">
        <LoadingState />
      </div>
    );
  }

  if (!hayProductos) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 lg:py-6">
        <HeaderV2
          archivadosCount={archivadosCount}
          onClickNuevo={handleNuevo}
          onClickArchivo={archivadosCount > 0 ? handleArchivo : undefined}
        />
        <EmptyStateBd
          onClickCrearSimple={handleNuevo}
          onClickCrearConVariantes={handleNuevo}
          onClickCrearPack={handleNuevo}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 lg:py-6">
      <HeaderV2
        archivadosCount={archivadosCount}
        onClickCalculadora={handleCalculadora}
        onClickSugerencias={handleSugerencias}
        onClickArchivo={archivadosCount > 0 ? handleArchivo : undefined}
        onClickImportar={handleImportar}
        onClickExportar={handleExportar}
        onClickNuevo={handleNuevo}
      />

      <KpiStripV2
        productosActivos={kpis.activos}
        productosTotales={kpis.totales}
        productosNuevosMes={kpis.nuevosMes}
        variantesSkusTotal={kpis.variantesTotal}
        productosConVariantes={kpis.conVariantes}
        stockCritico={kpis.stockCritico}
        stockCriticoSinInvestigar={kpis.stockCriticoSinInvestigar}
        margenPromedio={kpis.margenPromedio}
      />

      <PillsRapidos
        counts={{
          todos: counts.all,
          activos: counts.activos,
          stock_critico: counts.stockCritico,
          sin_investigar: counts.sinInvestigar,
          packs: counts.packs,
        }}
        active={filtros.pillActivo}
        onChange={(key: PillKey) => filtros.setPillActivo(key)}
      />

      {/* Botón de drawer mobile (solo visible en mobile) */}
      <div className="flex items-center justify-end mb-3 lg:hidden">
        <button
          type="button"
          onClick={() => setShowMobileDrawer(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100"
        >
          <FilterIcon className="w-3.5 h-3.5" />
          Filtros
          {chipsActivos.length > 0 && (
            <span className="bg-teal-600 text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center tabular-nums">
              {chipsActivos.length}
            </span>
          )}
        </button>
      </div>

      {/* FiltrosBar · solo desktop · en mobile usa drawer */}
      <div className="hidden lg:block">
        <FiltrosBar
          dateRange={filtros.dateRange}
          onDateRangeChange={filtros.setDateRange}
          chipGroups={chipGroups}
          selecciones={filtros.selecciones}
          onChipToggle={filtros.toggleChip}
          searchTerm={filtros.searchTerm}
          searchPlaceholder="Buscar por nombre, marca, SKU..."
          onSearchChange={filtros.setSearchTerm}
          sortValue={filtros.sortValue}
          sortOptions={SORT_OPTIONS}
          onSortChange={filtros.setSortValue}
          hayFiltrosActivos={filtros.hayFiltrosActivos}
          onLimpiarTodo={filtros.reset}
        />
      </div>

      <ChipsActivos resultCount={productosFiltered.length} totalCount={lista.length} chips={chipsActivos} />

      <BulkActionsToolbar
        selectedCount={selectedCount}
        totalCount={lista.length}
        onClear={filtros.clearSelection}
        onCambiarEstado={() => handleBulkAction('Cambiar estado')}
        onEtiquetar={() => handleBulkAction('Etiquetar')}
        onCambiarLinea={() => handleBulkAction('Cambiar línea')}
        onExportar={() => handleBulkAction('Exportar')}
        onArchivar={() => handleBulkAction('Archivar')}
      />

      {/* Drawer mobile · slide-up */}
      <FiltrosDrawerMobile
        open={showMobileDrawer}
        onClose={() => setShowMobileDrawer(false)}
        resultCount={productosFiltered.length}
        dateRange={filtros.dateRange}
        onDateRangeChange={filtros.setDateRange}
        chipGroups={chipGroups}
        selecciones={filtros.selecciones}
        onChipToggle={filtros.toggleChip}
        searchTerm={filtros.searchTerm}
        onSearchChange={filtros.setSearchTerm}
        sortValue={filtros.sortValue}
        sortOptions={SORT_OPTIONS}
        onSortChange={filtros.setSortValue}
        onLimpiarTodo={filtros.reset}
      />

      {/* Empty búsqueda · cuando hay filtros aplicados pero 0 resultados */}
      {productosFiltered.length === 0 && (filtros.searchTerm.trim() || filtros.hayFiltrosActivos) ? (
        <EmptyStateBusqueda
          searchTerm={filtros.searchTerm || '(sin término)'}
          filtrosActivosTexto={filtrosActivosTexto || undefined}
          onLimpiarBusqueda={filtros.searchTerm ? () => filtros.setSearchTerm('') : undefined}
          onLimpiarFiltros={filtros.hayFiltrosActivos ? filtros.reset : undefined}
          onCrearProducto={handleNuevo}
        />
      ) : (
        // Fase 3 · Lista real de productos con cards polimórficas
        <ProductosListV2
          productos={productosFiltered}
          selectedIds={filtros.selectedIds}
          onToggleSelected={filtros.toggleSelected}
          onSelectAll={filtros.setManyselected}
          onClearSelection={filtros.clearSelection}
          onClickProducto={p => toast.info(`Modal detalle de ${p.nombreComercial} · disponible en Fase 4`)}
          onView={p => toast.info(`Ver detalle de ${p.nombreComercial} · disponible en Fase 4`)}
          onActions={p => toast.info(`Menú de acciones · disponible en Fase 4`)}
          onCrearOC={p => toast.info(`Crear OC para ${p.nombreComercial} · pendiente`)}
          onReInvestigar={p => toast.info(`Re-investigar ${p.nombreComercial} · disponible en Fase 5`)}
        />
      )}
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcMargen(p: any): number {
  const inv = p.investigacion?.[0];
  if (!inv?.ctruEstimado || !p.precioVenta) return -1;
  return ((p.precioVenta - inv.ctruEstimado) / p.precioVenta) * 100;
}
