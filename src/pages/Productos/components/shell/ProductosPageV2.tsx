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
import { Filter as FilterIcon, Droplets, Pill, Box, Package2, Check, Search as SearchIcon, Construction } from 'lucide-react';
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
import { ProductoDetailModal } from '../detail';
import { WizardSelector, WizardSimple, WizardConVariantes, WizardPack, WizardVarianteExistente, type TipoCreacion, type DatosComunes, type VarianteEntry } from '../wizards';
import { PapeleraModal, InvestigacionCompletaModal, type InvestigacionPayload } from '../modals';
import { ProductoService } from '../../../../services/producto.service';
import { useLineaNegocioStore } from '../../../../store/lineaNegocioStore';
import type { Producto, ProductoFormData } from '../../../../types/producto.types';

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
  const { lineasActivas, fetchLineasActivas } = useLineaNegocioStore();
  const { createProducto } = useProductoStore();
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [detailProducto, setDetailProducto] = useState<Producto | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [wizardActivo, setWizardActivo] = useState<TipoCreacion | null>(null);
  // Fase 8 · Modales standalone
  const [showPapelera, setShowPapelera] = useState(false);
  const [investigacionProducto, setInvestigacionProducto] = useState<Producto | null>(null);

  // Cargar productos al montar
  useEffect(() => {
    if (user) {
      fetchProductos();
      fetchArchivados();
      fetchLineasActivas();
    }
  }, [user, fetchProductos, fetchArchivados, fetchLineasActivas]);

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

  // ─── Handlers ─────────────────────────────────────────────────────────────
  // Fase 7a · CTA "Nuevo producto" abre el selector
  const handleNuevo = () => setShowSelector(true);

  // Selector · usuario eligió tipo de creación
  const handleSelectorChoice = (tipo: TipoCreacion) => {
    setShowSelector(false);
    setWizardActivo(tipo);
  };

  // Wizard simple · submit (crear producto)
  const handleCrearSimple = async (data: Partial<ProductoFormData>) => {
    if (!user) {
      toast.error('Sesión expirada · vuelve a iniciar sesión');
      return;
    }
    try {
      await createProducto(data, user.uid);
      toast.success(`Producto "${data.nombreComercial}" creado correctamente`);
      setWizardActivo(null);
      await fetchProductos();
    } catch (err: any) {
      toast.error(`Error al crear producto: ${err?.message ?? 'desconocido'}`);
      throw err;
    }
  };

  // Wizard con variantes · submit (createConVariantes)
  const handleCrearConVariantes = async (datosComunes: DatosComunes, variantes: VarianteEntry[]) => {
    if (!user) {
      toast.error('Sesión expirada · vuelve a iniciar sesión');
      return;
    }
    try {
      const variantesPayload = variantes.map(v => ({
        contenido: v.contenido,
        varianteLabel: v.varianteLabel,
        ...(v.unidad === 'caps' || v.unidad === 'tabs' ? { dosaje: v.cantidad } : {}),
        ...(v.unidad === 'ml' ? { volumen: `${v.cantidad} ml` } : {}),
      }));
      await ProductoService.createConVariantes(
        {
          marca: datosComunes.marca,
          nombreComercial: datosComunes.nombreComercial,
          presentacion: datosComunes.presentacion,
          paisOrigen: datosComunes.paisOrigen,
          lineaNegocioId: datosComunes.lineaNegocioId,
          stockMinimo: datosComunes.stockMinimo,
          stockMaximo: datosComunes.stockMaximo,
          pesoLibras: datosComunes.pesoLibras,
        },
        variantesPayload,
        user.uid
      );
      toast.success(`Producto "${datosComunes.nombreComercial}" creado con ${variantes.length} variantes`);
      setWizardActivo(null);
      await fetchProductos();
    } catch (err: any) {
      toast.error(`Error al crear variantes: ${err?.message ?? 'desconocido'}`);
      throw err;
    }
  };

  // Wizard pack · submit (createProducto con esPack=true)
  const handleCrearPack = async (data: Partial<ProductoFormData>) => {
    if (!user) {
      toast.error('Sesión expirada · vuelve a iniciar sesión');
      return;
    }
    try {
      await createProducto(data, user.uid);
      toast.success(`Pack "${data.nombreComercial}" creado correctamente`);
      setWizardActivo(null);
      await fetchProductos();
    } catch (err: any) {
      toast.error(`Error al crear pack: ${err?.message ?? 'desconocido'}`);
      throw err;
    }
  };

  // Wizard variante existente · submit (createProducto con grupoVarianteId del padre)
  const handleCrearVarianteExistente = async (data: Partial<ProductoFormData>) => {
    if (!user) {
      toast.error('Sesión expirada · vuelve a iniciar sesión');
      return;
    }
    try {
      await createProducto(data, user.uid);
      toast.success(`Variante "${data.varianteLabel}" creada correctamente`);
      setWizardActivo(null);
      await fetchProductos();
    } catch (err: any) {
      toast.error(`Error al crear variante: ${err?.message ?? 'desconocido'}`);
      throw err;
    }
  };

  // Fase 8 · Modal Papelera
  const handleArchivo = () => setShowPapelera(true);

  const handleRestaurarProducto = async (p: Producto) => {
    try {
      await ProductoService.reactivar(p.id);
      toast.success(`"${p.nombreComercial}" restaurado al catálogo`);
      await Promise.all([fetchProductos(), fetchArchivados()]);
    } catch (err: any) {
      toast.error(`Error al restaurar: ${err?.message ?? 'desconocido'}`);
    }
  };

  const handleEliminarDefinitivo = (p: Producto) => {
    // Eliminación física requiere implementación dedicada (CF) — soft delete ya está aplicado.
    toast.warning(
      `Eliminación definitiva de "${p.nombreComercial}" pendiente · se eliminará automáticamente a los 90 días`,
    );
  };

  const handleVaciarPapelera = () => {
    toast.warning(
      `Vaciar papelera pendiente · los ${archivadosCount} productos se eliminarán automáticamente a los 90 días de archivado`,
    );
  };

  // Fase 8 · Modal Investigación completa
  const handleArchivarProducto = async (p: Producto) => {
    if (!user) {
      toast.error('Sesión expirada · vuelve a iniciar sesión');
      return;
    }
    try {
      await ProductoService.delete(p.id, user.uid);
      toast.success(`"${p.nombreComercial}" archivado · se conservará 90 días`);
      setDetailProducto(null);
      await Promise.all([fetchProductos(), fetchArchivados()]);
    } catch (err: any) {
      toast.error(`Error al archivar: ${err?.message ?? 'desconocido'}`);
    }
  };

  const handleAbrirInvestigacion = (p: Producto) => {
    setInvestigacionProducto(p);
  };

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
        // Fase 3 · Lista real de productos · Fase 4 · click abre modal detalle
        <ProductosListV2
          productos={productosFiltered}
          selectedIds={filtros.selectedIds}
          onToggleSelected={filtros.toggleSelected}
          onSelectAll={filtros.setManyselected}
          onClearSelection={filtros.clearSelection}
          onClickProducto={setDetailProducto}
          onView={setDetailProducto}
          onActions={p => toast.info(`Menú de acciones · disponible en Fase 4+`)}
          onCrearOC={p => toast.info(`Crear OC para ${p.nombreComercial} · pendiente`)}
          onReInvestigar={handleAbrirInvestigacion}
        />
      )}

      {/* Wizard Selector · Fase 7a · trigger desde "+ Nuevo producto" */}
      <WizardSelector
        open={showSelector}
        onClose={() => setShowSelector(false)}
        onSelect={handleSelectorChoice}
      />

      {/* Wizard Simple · Fase 7a · 1 paso · 4 secciones colapsables */}
      <WizardSimple
        open={wizardActivo === 'simple'}
        onClose={() => setWizardActivo(null)}
        onSubmit={handleCrearSimple}
        lineasNegocio={lineasActivas.map(l => ({ id: l.id, nombre: l.nombre }))}
      />

      {/* Wizard Con Variantes · Fase 7b · F5(A) sidebar 4 pasos */}
      <WizardConVariantes
        open={wizardActivo === 'con_variantes'}
        onClose={() => setWizardActivo(null)}
        onSubmit={handleCrearConVariantes}
        lineasNegocio={lineasActivas.map(l => ({ id: l.id, nombre: l.nombre }))}
      />

      {/* Wizard Pack · Fase 7b · F5(D) modal con secciones */}
      <WizardPack
        open={wizardActivo === 'pack'}
        onClose={() => setWizardActivo(null)}
        onSubmit={handleCrearPack}
        productosDisponibles={lista}
        lineasNegocio={lineasActivas.map(l => ({ id: l.id, nombre: l.nombre }))}
      />

      {/* Wizard Variante Existente · Fase 7c · buscador + form reducido */}
      <WizardVarianteExistente
        open={wizardActivo === 'variante_existente'}
        onClose={() => setWizardActivo(null)}
        productosDisponibles={lista}
        todosLosProductos={lista}
        onSubmit={handleCrearVarianteExistente}
      />

      {/* Modal detalle producto · Fase 4 · F6(A) desktop / bottom sheet mobile */}
      <ProductoDetailModal
        open={!!detailProducto}
        producto={detailProducto}
        hermanasGrupo={
          detailProducto?.grupoVarianteId
            ? lista.filter((p: any) => p.grupoVarianteId === detailProducto.grupoVarianteId)
            : detailProducto
            ? [detailProducto]
            : []
        }
        onClose={() => setDetailProducto(null)}
        onEdit={p => toast.info(`Editar ${p.nombreComercial} · disponible en Fase 7 (wizards)`)}
        onArchivar={handleArchivarProducto}
        onDuplicar={p => toast.info(`Duplicar ${p.nombreComercial} · pendiente`)}
        onAgregarVariante={p => toast.info(`Agregar variante a ${p.nombreComercial} · disponible en Fase 7`)}
      />

      {/* Modal Papelera · Fase 8 · #23 · listado archivados con restaurar/eliminar */}
      <PapeleraModal
        open={showPapelera}
        archivados={Array.isArray(archivados) ? archivados : []}
        onClose={() => setShowPapelera(false)}
        onRestaurar={handleRestaurarProducto}
        onEliminarDefinitivo={handleEliminarDefinitivo}
        onVaciarPapelera={handleVaciarPapelera}
      />

      {/* Modal Investigación Completa · Fase 8 · #24 · 3 sub-tabs (#25, #26, #27) */}
      <InvestigacionCompletaModal
        open={!!investigacionProducto}
        payload={investigacionProducto ? buildInvestigacionPayload(investigacionProducto) : null}
        tuPrecioPEN={(investigacionProducto as any)?.precioVenta ?? undefined}
        onClose={() => setInvestigacionProducto(null)}
        onReinvestigar={() => toast.info('Re-investigación · disponible en Fase 9 (Tools)')}
        onMarcarVista={() => {
          toast.success('Investigación marcada como vista');
          setInvestigacionProducto(null);
        }}
        onAgregarProveedor={() => toast.info('Agregar proveedor · disponible en wizard de investigación')}
        onCrearOC={(provId) => toast.info(`Crear OC con proveedor ${provId} · pendiente`)}
        onAgregarCompetidor={(nombre) => toast.info(`Agregar competidor "${nombre}" · pendiente`)}
        onImportar={() => {
          toast.success('Producto importado al catálogo · pendiente flujo de OC');
          setInvestigacionProducto(null);
        }}
        onDescartar={() => toast.warning('Descartar oportunidad · pendiente captura de motivo')}
      />
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcMargen(p: any): number {
  const inv = p.investigacion?.[0];
  if (!inv?.ctruEstimado || !p.precioVenta) return -1;
  return ((p.precioVenta - inv.ctruEstimado) / p.precioVenta) * 100;
}

// ─── Adaptador Producto → InvestigacionPayload (Fase 8 · Modal #24) ─────────
function buildInvestigacionPayload(p: Producto): InvestigacionPayload {
  const inv: any = (p as any).investigacion;
  const proveedoresRaw: any[] = inv?.proveedoresUSA ?? [];
  const competidoresRaw: any[] = inv?.competidoresPeru ?? [];
  const tuPrecio = (p as any).precioVenta ?? 0;

  // Ordenar proveedores por mejor costo + lead time razonable
  const proveedoresSort = [...proveedoresRaw].sort((a, b) => (a?.precio ?? 0) - (b?.precio ?? 0));
  const proveedores = proveedoresSort.map((prov, idx) => ({
    id: prov.id ?? `prov-${idx}`,
    ranking: idx + 1,
    nombre: prov.nombre ?? `Proveedor ${idx + 1}`,
    esTopEleccion: idx === 0,
    rating: prov.rating ?? 4.5,
    ocsHistoricas: prov.ocsHistoricas,
    ultimaOC: prov.ultimaOC,
    notas: prov.notas,
    costoUnidadUSD: prov.precio ?? 0,
    leadTimeDias: prov.leadTimeDias ?? prov.envioEstimado ?? 21,
    minOrdenUSD: prov.minOrdenUSD,
    formaPago: prov.formaPago,
    ctruEstimadoPEN: inv?.ctruEstimado,
    margenProyectadoPct: inv?.margenEstimado,
    sinStock: prov.disponibilidad === 'sin_stock',
  }));

  // Competidores con fila TÚ al inicio
  const COLORES_AVATAR: Array<'emerald' | 'indigo' | 'rose' | 'purple' | 'amber'> = [
    'emerald',
    'indigo',
    'rose',
    'purple',
    'amber',
  ];
  const competidores = [
    {
      id: '__tu__',
      iniciales: 'TÚ',
      nombre: 'Vita Skin Perú',
      precioPEN: tuPrecio,
      tendencia30d: 'estable' as const,
      stock: (p as any).stockDisponible ?? 0,
      esTu: true,
      colorAvatar: 'amber' as const,
    },
    ...competidoresRaw.map((c, idx) => {
      const ratio = tuPrecio > 0 ? Math.round((c.precio / tuPrecio) * 100) : 100;
      const variacion = tuPrecio > 0 ? ((c.precio - tuPrecio) / tuPrecio) * 100 : 0;
      const tend: 'sube' | 'baja' | 'estable' = variacion > 5 ? 'sube' : variacion < -5 ? 'baja' : 'estable';
      const inicialesCalc = (c.nombre ?? '?')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w: string) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '?';
      return {
        id: c.id ?? `comp-${idx}`,
        iniciales: inicialesCalc,
        nombre: c.nombre ?? `Competidor ${idx + 1}`,
        url: c.url,
        precioPEN: c.precio ?? 0,
        variacionPct: variacion,
        porcentajeVsTuPrecio: ratio,
        tendencia30d: tend,
        variacionTendenciaPct: Math.abs(variacion),
        stock: c.ventas,
        esTu: false,
        colorAvatar: COLORES_AVATAR[idx % COLORES_AVATAR.length],
      };
    }),
  ];

  // Decisión basada en investigacion
  const recom: 'importar' | 'descartar' | 'evaluar' =
    inv?.recomendacion === 'descartar'
      ? 'descartar'
      : inv?.recomendacion === 'investigar_mas'
        ? 'evaluar'
        : 'importar';
  const ctru = inv?.ctruEstimado ?? 0;
  const precioSug = inv?.precioSugeridoCalculado ?? tuPrecio ?? 0;
  const margenPct = inv?.margenEstimado ?? (precioSug > 0 ? ((precioSug - ctru) / precioSug) * 100 : 0);
  const margenPEN = precioSug - ctru;
  const breakEven = margenPEN > 0 && proveedores[0]?.minOrdenUSD ? Math.ceil((proveedores[0].minOrdenUSD * 3.7) / margenPEN) : 12;
  const score = Math.min(10, Math.max(0, (inv?.puntuacionViabilidad ?? 75) / 10));

  return {
    productoId: p.id,
    productoNombre: (p as any).nombreComercial ?? (p as any).nombre ?? 'Producto',
    productoSku: p.sku ?? '—',
    productoMarca: p.marca,
    ultimaActualizacion: inv?.fechaInvestigacion?.toDate
      ? inv.fechaInvestigacion.toDate().toLocaleDateString('es-PE', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : undefined,
    alertas: (inv?.alertas ?? []).slice(0, 5).map((a: any, i: number) => ({
      id: a.id ?? `alerta-${i}`,
      tipo: 'otro' as const,
      mensaje: a.mensaje ?? a.descripcion ?? 'Alerta sin descripción',
    })),
    proveedores,
    competidores,
    decision: {
      recomendacion: recom,
      precioSugeridoPEN: precioSug,
      costoUnitarioPEN: ctru,
      margenBrutoPct: margenPct,
      margenBrutoPEN: margenPEN,
      breakEvenUds: breakEven,
      proveedorPrincipalId: proveedores[0]?.id,
      stockInicialSugerido: 50,
      resumen:
        inv?.razonamiento ??
        `Margen proyectado ${margenPct.toFixed(0)}% con ${proveedores[0]?.nombre ?? 'el mejor proveedor'} como proveedor principal · CTRU estimado S/ ${ctru.toFixed(0)} · stock inicial sugerido 50 unidades.`,
      scoreGlobal: score,
      criterios: [
        {
          key: 'margen',
          label: 'Margen proyectado',
          icon: 'dollar',
          score: Math.min(10, margenPct / 6),
          etiqueta: margenPct >= 50 ? 'Excelente' : margenPct >= 35 ? 'Buena' : 'Justa',
          semaforo: margenPct >= 45 ? 'emerald' : margenPct >= 30 ? 'amber' : 'rose',
        },
        {
          key: 'demanda',
          label: 'Demanda en el mercado',
          icon: 'users',
          score: inv?.demandaEstimada === 'alta' ? 8.5 : inv?.demandaEstimada === 'media' ? 6 : 4,
          etiqueta: inv?.demandaEstimada === 'alta' ? 'Alta' : inv?.demandaEstimada === 'media' ? 'Media' : 'Baja',
          semaforo: inv?.demandaEstimada === 'alta' ? 'emerald' : inv?.demandaEstimada === 'media' ? 'amber' : 'rose',
        },
        {
          key: 'proveedor',
          label: 'Confiabilidad proveedor',
          icon: 'award',
          score: (proveedores[0]?.rating ?? 4) * 2,
          etiqueta: proveedores[0]?.ocsHistoricas
            ? `${proveedores[0].ocsHistoricas} OCs OK`
            : 'Sin histórico',
          semaforo: (proveedores[0]?.rating ?? 4) >= 4.5 ? 'emerald' : 'amber',
        },
        {
          key: 'competencia',
          label: 'Posición competitiva',
          icon: 'trending',
          score: 8,
          etiqueta: `${competidoresRaw.length} competidor${competidoresRaw.length === 1 ? '' : 'es'}`,
          semaforo: inv?.nivelCompetencia === 'baja' ? 'emerald' : inv?.nivelCompetencia === 'saturada' ? 'rose' : 'amber',
        },
        {
          key: 'riesgo',
          label: 'Riesgo de obsolescencia',
          icon: 'alert',
          score: 3,
          etiqueta: 'Bajo · 24m vida',
          semaforo: 'rose',
        },
      ],
      consideraciones: (inv?.alertas ?? []).slice(0, 3).map((a: any) => a.mensaje ?? a.descripcion).filter(Boolean),
    },
  };
}

// ─── Placeholder para wizards Fase 7b/7c (no bloquea selector) ─────────────
const PlaceholderWizard: React.FC<{ tipo: TipoCreacion; onClose: () => void; fase: string }> = ({
  tipo,
  onClose,
  fase,
}) => {
  const labels: Record<TipoCreacion, string> = {
    simple: 'Producto único',
    con_variantes: 'Producto con variantes',
    variante_existente: 'Variante de producto existente',
    pack: 'Pack / Kit',
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        aria-label="Cerrar"
      />
      <div className="relative max-w-md mx-auto bg-white rounded-2xl shadow-2xl p-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-100 flex items-center justify-center mb-4">
          <Construction className="w-6 h-6 text-indigo-600" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-2">Wizard "{labels[tipo]}"</h3>
        <p className="text-xs text-slate-500 mb-4">
          Disponible en <strong>Fase {fase}</strong> · próxima sub-sesión.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          Volver al selector
        </button>
      </div>
    </div>
  );
};
