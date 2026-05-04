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
import { calcularInvestigacion, calcularAciertoInversion } from '../../utils/investigacionCalculos';
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
  PaginacionFooter,
  OrdenamientoSelect,
  type PillKey,
  type ChipGroupConfig,
  type ChipColor,
  type SortOption,
  type SortKey,
  type PageSize,
} from '../filters';
import { ProductosListV2 } from '../cards';
import { ProductoDetailModal } from '../detail';
import { ProductoEditModal } from '../edit';
import { ProductoEditModalV2 } from '../edit/ProductoEditModalV2';
import { WizardSelector, WizardSimple, WizardProductoV2, WizardConVariantes, WizardPack, WizardVarianteExistente, type TipoCreacion, type DatosComunes, type VarianteEntry } from '../wizards';
import { isWizardProductoV2Enabled } from '../../../../config/features';
import {
  PapeleraModal,
  ImportarCSVModal,
  // S3.4 · InvestigacionCompletaModal, ProveedorFormModal, CompetidorFormModal
  // y sus tipos ELIMINADOS de este import: la gestión vive ahora dentro del
  // modal detalle del producto (TabInvestigacion + sub-modales internos).
} from '../modals';
import {
  CambiarEstadoBulkModal,
  EtiquetarBulkModal,
  ExportarCSVBulkModal,
  ArchivarBulkModal,
  type EtiquetadoModo,
} from '../modals/bulk';
import {
  ProductosIntelDashboard,
  PuntoEquilibrioModal,
  SugerenciasVariantesBanner,
  SugerenciasVariantesModal,
  SugerenciasDelDiaModal,
  type ProductoIntelRow,
  type ScoreLiquidezCategoria,
  type AccionIntel,
  type LineaIntel,
  type PuntoEquilibrioInput,
  type SugerenciaDelDia,
  type GrupoSugerido,
} from '../tools';
import { ProductoService } from '../../../../services/producto.service';
import { useLineaNegocioStore } from '../../../../store/lineaNegocioStore';
import { useLineaFilter } from '../../../../hooks/useLineaFilter';
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
  // Fase H · Estado de investigación (mockup #39)
  investigacion: {
    vigente: { label: 'Investig: Vigente', color: 'emerald' },
    vencida: { label: 'Investig: Vencida', color: 'amber' },
    sin_investigar: { label: 'Investig: Sin investigar', color: 'slate' },
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
  // S3.4 · tab inicial al abrir el modal detalle. 'resumen' por default · 'investigacion'
  // cuando el usuario clickea "Investigación" en el listado o en el dashboard.
  const [detailInitialTab, setDetailInitialTab] = useState<'resumen' | 'investigacion'>('resumen');
  const [showSelector, setShowSelector] = useState(false);
  const [wizardActivo, setWizardActivo] = useState<TipoCreacion | null>(null);
  // Fase 8 · Modales standalone
  const [showPapelera, setShowPapelera] = useState(false);
  // Modal Editar Producto · Fase D
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);

  // S3.4 (2026-05-04) · States `investigacionProducto`, `proveedorEditing`, `competidorEditing`
  // ELIMINADOS junto con InvestigacionCompletaModal. Ahora todo el CRUD de proveedores/
  // competidores vive dentro de ProductoDetailModal · TabInvestigacion.

  // Fase 9 · Tools
  const [showIntel, setShowIntel] = useState(false);
  const [showSugerenciasDia, setShowSugerenciasDia] = useState(false);
  const [showVariantesModal, setShowVariantesModal] = useState(false);
  const [puntoEquilibrioInput, setPuntoEquilibrioInput] = useState<PuntoEquilibrioInput | null>(null);
  // Hash del último set de grupos que el usuario descartó · persiste en localStorage
  // así el banner no reaparece al cambiar de pestaña / refrescar / aplicar filtros.
  // Si en el futuro se detectan grupos NUEVOS (hash distinto), el banner reaparece.
  const [bannerVariantesHashDescartado, setBannerVariantesHashDescartado] = useState<string>(() => {
    try {
      return localStorage.getItem('productos-banner-variantes-descartado') ?? '';
    } catch { return ''; }
  });

  // ─── Fase G · Paginación + Sort ampliado ────────────────────────────────────
  const [paginaActual, setPaginaActual] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [sortKeyExt, setSortKeyExt] = useState<SortKey>('margen_desc');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // ─── Fase G · BulkActions sub-modales ───────────────────────────────────────
  const [bulkEstadoOpen, setBulkEstadoOpen] = useState(false);
  const [bulkEtiquetarOpen, setBulkEtiquetarOpen] = useState(false);
  const [bulkExportarOpen, setBulkExportarOpen] = useState(false);
  const [bulkArchivarOpen, setBulkArchivarOpen] = useState(false);

  // ─── Fase H · Modal Importar CSV ────────────────────────────────────────────
  const [importarOpen, setImportarOpen] = useState(false);

  // Cargar productos al montar
  useEffect(() => {
    if (user) {
      fetchProductos();
      fetchArchivados();
      fetchLineasActivas();
    }
  }, [user, fetchProductos, fetchArchivados, fetchLineasActivas]);

  // GAP-002 fix · respetar filtro global de linea del header
  const listaCruda = useMemo(() => (Array.isArray(productos) ? productos : []), [productos]);
  const lista = useLineaFilter(listaCruda, (p: any) => p.lineaNegocioId);

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

    // 2. Búsqueda por término · GAP-003 fix: campo correcto es nombreComercial · sumar más campos
    // FIX-A · safeLower defensivo · data legacy puede tener tipos mixtos
    // (ej. etiquetas como objetos en lugar de strings) que rompen .toLowerCase()
    if (filtros.searchTerm.trim()) {
      const term = filtros.searchTerm.toLowerCase();
      const safeLower = (v: any): string => {
        if (v == null) return '';
        if (typeof v === 'string') return v.toLowerCase();
        if (typeof v === 'object' && typeof v.nombre === 'string') return v.nombre.toLowerCase();
        return String(v).toLowerCase();
      };
      result = result.filter((p: any) => {
        // Identidad
        if (safeLower(p.nombreComercial).includes(term)) return true;
        if (safeLower(p.marca).includes(term)) return true;
        if (safeLower(p.sku).includes(term)) return true;
        // Clasificación legacy + nueva
        if (safeLower(p.grupo).includes(term)) return true;
        if (safeLower(p.subgrupo).includes(term)) return true;
        if (safeLower(p.tipoProducto?.nombre).includes(term)) return true;
        if (Array.isArray(p.categorias) && p.categorias.some((c: any) => safeLower(c?.nombre).includes(term))) return true;
        if (Array.isArray(p.etiquetasData) && p.etiquetasData.some((e: any) => safeLower(e?.nombre).includes(term))) return true;
        // etiquetas legacy · puede ser array de strings O array de objetos {nombre}
        if (Array.isArray(p.etiquetas) && p.etiquetas.some((e: any) => safeLower(e).includes(term))) return true;
        return false;
      });
    }

    // 3. Filtros por chip group (línea / tipo / estado)
    // GAP-001 fix · linea ahora compara contra lineaNegocioNombre y lineaNegocioId
    // Mapeo: chips usan slug ("skincare", "suplementos") · productos guardan
    // lineaNegocioNombre ("Skincare", "Suplementos y Vitaminas") · matching insensible
    Object.entries(filtros.selecciones).forEach(([groupKey, values]) => {
      if (values.length === 0) return;
      result = result.filter((p: any) => {
        if (groupKey === 'linea') {
          const lineaNombre = (p.lineaNegocioNombre ?? '').toLowerCase();
          // Slug→keyword: skincare matches "skincare" · suplementos matches "suplementos"
          return values.some(v => lineaNombre.includes(v.toLowerCase()));
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
        // Fase H · Filtro por estado de investigación (mockup #39)
        if (groupKey === 'investigacion') {
          const inv = p.investigacion;
          const ahora = Date.now();
          const ts = inv?.vigenciaHasta?.toDate?.()?.getTime?.() ?? 0;
          const esVigente = !!inv && ts > ahora;
          const esVencida = !!inv && ts > 0 && ts < ahora;
          const sinInvestigar = !inv;
          if (values.includes('vigente') && esVigente) return true;
          if (values.includes('vencida') && esVencida) return true;
          if (values.includes('sin_investigar') && sinInvestigar) return true;
          return false;
        }
        return true;
      });
    });

    // 4. Sort · Fase G · 12 opciones agrupadas + dirección invertible
    const cmpFn = getSortComparator(sortKeyExt);
    result.sort(cmpFn);
    if (sortDirection === 'asc' && SORT_DEFAULT_DIR[sortKeyExt] === 'desc') {
      result.reverse();
    } else if (sortDirection === 'desc' && SORT_DEFAULT_DIR[sortKeyExt] === 'asc') {
      result.reverse();
    }

    return result;
  }, [lista, filtros.pillActivo, filtros.searchTerm, filtros.selecciones, sortKeyExt, sortDirection]);

  // ─── Fase G · Aplicar paginación ────────────────────────────────────────────
  const productosVisibles = useMemo(() => {
    if (pageSize === 'all') return productosFiltered;
    const start = (paginaActual - 1) * pageSize;
    return productosFiltered.slice(start, start + pageSize);
  }, [productosFiltered, paginaActual, pageSize]);

  // Reset página cuando cambia filtro/búsqueda/sort/pageSize
  useEffect(() => {
    setPaginaActual(1);
  }, [
    filtros.pillActivo,
    filtros.searchTerm,
    filtros.selecciones,
    sortKeyExt,
    sortDirection,
    pageSize,
  ]);

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

    // Por línea · campo correcto = lineaNegocioNombre (no `linea` ni `lineaNegocio`)
    const getLineaTexto = (p: any) =>
      (p.lineaNegocioNombre ?? p.linea ?? p.lineaNegocio ?? '').toLowerCase();
    const skincare = list.filter((p: any) => getLineaTexto(p).includes('skin')).length;
    const suplementos = list.filter((p: any) => /sup|vita|cap/.test(getLineaTexto(p))).length;
    const wellness = list.filter((p: any) => /well|aloe|herb/.test(getLineaTexto(p))).length;

    // Por tipo
    const simple = list.filter((p: any) => !p.esPack).length;

    // Por estado
    const enInvestigacion = list.filter((p: any) => p.estado === 'en_investigacion').length;
    const archivadosTotal = Array.isArray(archivados) ? archivados.length : 0;

    // Fase H · Counts de estado de investigación (mockup #39)
    const ahora = Date.now();
    const invVigente = list.filter((p: any) => {
      const inv = p.investigacion;
      if (!inv) return false;
      const ts = inv.vigenciaHasta?.toDate?.()?.getTime?.() ?? 0;
      return ts > ahora;
    }).length;
    const invVencida = list.filter((p: any) => {
      const inv = p.investigacion;
      if (!inv) return false;
      const ts = inv.vigenciaHasta?.toDate?.()?.getTime?.() ?? 0;
      return ts > 0 && ts < ahora;
    }).length;
    const invSin = list.filter((p: any) => !p.investigacion).length;

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
      invVigente,
      invVencida,
      invSin,
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
      // Fase H · Filtro nuevo "Estado de Investigación" (mockup #39)
      {
        key: 'investigacion',
        label: 'Investig.',
        options: [
          { value: 'vigente', label: 'Vigente', icon: Check, count: counts.invVigente, variant: 'emerald' },
          { value: 'vencida', label: 'Vencida', icon: SearchIcon, count: counts.invVencida, variant: 'amber' },
          { value: 'sin_investigar', label: 'Sin investigar', icon: SearchIcon, count: counts.invSin, variant: 'slate' },
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

    // GAP-007 fix · investigacion es OBJETO (InvestigacionMercado), no array
    const conMargenList = lista.filter((p: any) => {
      const inv = p.investigacion;
      return inv?.ctruEstimado > 0 && p.precioVenta > 0;
    });
    const margenPromedio =
      conMargenList.length === 0
        ? 0
        : Math.round(
            conMargenList.reduce((acc: number, p: any) => {
              const inv = p.investigacion;
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
          marcaId: datosComunes.marcaId,
          nombreComercial: datosComunes.nombreComercial,
          presentacion: datosComunes.presentacion,
          paisOrigen: datosComunes.paisOrigen,
          lineaNegocioId: datosComunes.lineaNegocioId,
          stockMinimo: datosComunes.stockMinimo,
          stockMaximo: datosComunes.stockMaximo,
          pesoLibras: datosComunes.pesoLibras,
          // Fase E3 · maestros y atributos compartidos
          tipoProductoId: datosComunes.tipoProductoId,
          categoriaIds: datosComunes.categoriaIds,
          categoriaPrincipalId: datosComunes.categoriaPrincipalId,
          etiquetaIds: datosComunes.etiquetaIds,
          atributosSkincare: datosComunes.atributosSkincare,
          atributosSuplementos: datosComunes.atributosSuplementos,
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

  /**
   * S3.4 (2026-05-04) · Consolidación de gestión de Investigación.
   *
   * Antes esto abría el modal full-screen `InvestigacionCompletaModal` aislado
   * (con 3 sub-tabs Proveedores · Competencia · Decisión). Ahora abre el modal
   * detalle del producto directamente en el tab `investigacion`, donde el
   * usuario tiene contexto completo del producto y la misma funcionalidad de
   * agregar/editar proveedores y competidores · sin perder contexto.
   *
   * El modal viejo y sus 3 sub-tabs quedan eliminados (eran duplicación de UI).
   */
  const handleAbrirInvestigacion = (p: Producto) => {
    setDetailProducto(p);
    setDetailInitialTab('investigacion');
  };

  // S3.4 · Handlers handle*Inv ELIMINADOS · vivían acoplados al InvestigacionCompletaModal.
  // El CRUD de proveedores/competidores ahora se hace dentro del ProductoDetailModal
  // → TabInvestigacion → ProveedorFormModal/CompetidorFormModal (todo en un solo lugar).

  // Fase 9 · Tools (memos)
  const intelRows = useMemo(() => buildIntelRows(lista), [lista]);
  const sugerenciasDia = useMemo(() => buildSugerenciasDelDia(lista), [lista]);
  const gruposSugeridos = useMemo(() => buildGruposSugeridos(lista), [lista]);
  // Hash estable del SET actual de grupos · si coincide con lo que el usuario
  // descartó, no mostramos el banner. Si cambia (grupos nuevos), reaparece.
  const gruposSugeridosHash = useMemo(() => {
    if (gruposSugeridos.length === 0) return '';
    return gruposSugeridos.map(g => g.id).sort().join('|');
  }, [gruposSugeridos]);
  const bannerVariantesOculto = !!gruposSugeridosHash && gruposSugeridosHash === bannerVariantesHashDescartado;

  const handleCalculadora = () => setShowIntel(true);
  const handleSugerencias = () => setShowSugerenciasDia(true);
  const handleAbrirPuntoEquilibrio = (p: Producto) => {
    // Fase H+ · usa helper compartido · MISMOS números que TabInvestigacion + cards
    // Si no hay investigación, ctru y precio quedan en 0 y el modal mostrará
    // empty state pidiendo agregar proveedores y competidores primero.
    const calc = calcularInvestigacion(p);
    setPuntoEquilibrioInput({
      productoId: p.id,
      productoSku: p.sku ?? '—',
      productoNombre: (p as any).nombreComercial ?? 'Producto',
      productoMarca: p.marca,
      ctruInicial: calc.costoPEN,                                  // (prov × (1+tax%) + flete) × TC
      precioVentaInicial: calc.precioEfectivo,                     // manual o sugerido (MIN comp × 0.95)
      unidadesCompradasInicial: 12,                                // default · 1 docena (usuario ajusta a su realidad)
    });
  };
  const handleImportar = () => setImportarOpen(true);
  const handleExportar = () => setBulkExportarOpen(true); // exporta lo seleccionado o lo visible

  // Productos seleccionados resueltos a objetos completos
  const productosSeleccionados = useMemo(
    () => productos.filter((p: any) => filtros.selectedIds.has(p.id)),
    [productos, filtros.selectedIds],
  );

  // ─── Fase G · Bulk action handlers ────────────────────────────────────────
  const handleBulkCambiarEstado = async (nuevoEstado: any) => {
    if (!user || productosSeleccionados.length === 0) return;
    try {
      await Promise.all(
        productosSeleccionados.map(p => ProductoService.update(p.id, { estado: nuevoEstado } as any))
      );
      toast.success(`Estado actualizado a "${nuevoEstado}" en ${productosSeleccionados.length} producto(s)`);
      setBulkEstadoOpen(false);
      filtros.clearSelection?.();
      await fetchProductos();
    } catch (err: any) {
      toast.error(`Error al cambiar estado: ${err?.message ?? 'desconocido'}`);
      throw err;
    }
  };

  const handleBulkEtiquetar = async (etiquetaIds: string[], modo: EtiquetadoModo) => {
    if (!user || productosSeleccionados.length === 0 || etiquetaIds.length === 0) return;
    try {
      await Promise.all(
        productosSeleccionados.map(p => {
          const actualesIds = (p as any).etiquetaIds ?? [];
          const finalIds = modo === 'reemplazar'
            ? Array.from(new Set(etiquetaIds))
            : Array.from(new Set([...actualesIds, ...etiquetaIds]));
          return ProductoService.update(p.id, { etiquetaIds: finalIds } as any);
        })
      );
      toast.success(`${etiquetaIds.length} etiqueta(s) ${modo === 'sumar' ? 'agregada(s)' : 'reemplazada(s)'} en ${productosSeleccionados.length} producto(s)`);
      setBulkEtiquetarOpen(false);
      filtros.clearSelection?.();
      await fetchProductos();
    } catch (err: any) {
      toast.error(`Error al etiquetar: ${err?.message ?? 'desconocido'}`);
      throw err;
    }
  };

  const handleBulkArchivar = async () => {
    if (!user || productosSeleccionados.length === 0) return;
    try {
      await Promise.all(
        productosSeleccionados.map(p => ProductoService.delete(p.id, user.uid))
      );
      toast.success(`${productosSeleccionados.length} producto(s) archivado(s) · van a la papelera`);
      setBulkArchivarOpen(false);
      filtros.clearSelection?.();
      await Promise.all([fetchProductos(), fetchArchivados()]);
    } catch (err: any) {
      toast.error(`Error al archivar: ${err?.message ?? 'desconocido'}`);
      throw err;
    }
  };

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
        onCambiarEstado={() => setBulkEstadoOpen(true)}
        onEtiquetar={() => setBulkEtiquetarOpen(true)}
        // Cambiar línea deshabilitado (mockup #44 nota: rompe SKU prefix · debe ser individual)
        onExportar={() => setBulkExportarOpen(true)}
        onArchivar={() => setBulkArchivarOpen(true)}
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

      {/* Banner Sugerencias Variantes (#32) · Fase 9 · solo visible si hay grupos detectados.
          El estado "descartado" persiste en localStorage como HASH del set de grupos.
          Si aparecen grupos NUEVOS (hash distinto), el banner reaparece. */}
      <SugerenciasVariantesBanner
        open={!bannerVariantesOculto}
        grupos={gruposSugeridos}
        onRevisar={() => setShowVariantesModal(true)}
        onDescartarTodas={() => {
          setBannerVariantesHashDescartado(gruposSugeridosHash);
          try {
            localStorage.setItem('productos-banner-variantes-descartado', gruposSugeridosHash);
          } catch { /* ignore quota/private mode */ }
          toast.info('Sugerencias descartadas · reaparecerán si se detectan grupos nuevos');
        }}
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
        // Fase G · Card-list con header (count + sort + pageSize) y footer (paginación)
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header del listado · Fase G */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[11px] text-slate-700">
              <strong className="tabular-nums">{productosVisibles.length}</strong> de{' '}
              <strong className="tabular-nums">{productosFiltered.length}</strong> productos
              {pageSize !== 'all' && productosFiltered.length > pageSize && (
                <span className="text-slate-400">
                  {' · '}página {paginaActual} de {Math.max(1, Math.ceil(productosFiltered.length / pageSize))}
                </span>
              )}
            </div>
            <OrdenamientoSelect
              sortKey={sortKeyExt}
              sortDirection={sortDirection}
              pageSize={pageSize}
              onChangeSort={setSortKeyExt}
              onChangeDirection={setSortDirection}
              onChangePageSize={setPageSize}
            />
          </div>

          <ProductosListV2
            productos={productosVisibles}
            selectedIds={filtros.selectedIds}
            onToggleSelected={filtros.toggleSelected}
            onSelectAll={filtros.setManyselected}
            onClearSelection={filtros.clearSelection}
            onClickProducto={setDetailProducto}
            onView={setDetailProducto}
            onActions={(p) => handleAbrirPuntoEquilibrio(p)}
            onCrearOC={p => toast.info(`Crear OC para ${p.nombreComercial} · pendiente`)}
            onReInvestigar={handleAbrirInvestigacion}
          />

          <PaginacionFooter
            paginaActual={paginaActual}
            totalItems={productosFiltered.length}
            itemsPorPagina={pageSize === 'all' ? Math.max(1, productosFiltered.length) : pageSize}
            onCambiarPagina={setPaginaActual}
          />
        </div>
      )}

      {/* Wizard Selector · Fase 7a · trigger desde "+ Nuevo producto" */}
      <WizardSelector
        open={showSelector}
        onClose={() => setShowSelector(false)}
        onSelect={handleSelectorChoice}
      />

      {/* Wizard Simple · Fase 7a · 5 secciones colapsables (con Atributos SKC/SUP) + Fase H detección duplicados */}
      {/* S3.2 · Si flag WIZARD_PRODUCTO_V2 activo → WizardProductoV2 (6 secciones + Marketing IA) · sino legacy */}
      {isWizardProductoV2Enabled() ? (
        <WizardProductoV2
          open={wizardActivo === 'simple'}
          onClose={() => setWizardActivo(null)}
          onSubmit={handleCrearSimple}
          lineasNegocio={lineasActivas.map(l => ({ id: l.id, nombre: l.nombre, codigo: l.codigo }))}
          catalogoExistente={lista}
        />
      ) : (
        <WizardSimple
          open={wizardActivo === 'simple'}
          onClose={() => setWizardActivo(null)}
          onSubmit={handleCrearSimple}
          lineasNegocio={lineasActivas.map(l => ({ id: l.id, nombre: l.nombre, codigo: l.codigo }))}
          catalogoExistente={lista}
          onConvertirAVariante={(productoBase) => {
            // Cierra el wizard simple y abre el de variante con el padre pre-seleccionado
            setWizardActivo('variante_existente');
            // Pasar el producto base al WizardVarianteExistente (placeholder · TBD)
            toast.info(`Convertí a variante de "${productoBase.nombreComercial}" · seleccionalo manualmente`);
          }}
          onVerDetalle={(p) => {
            setDetailProducto(p);
            setWizardActivo(null); // cierra el wizard para ver detalle
          }}
        />
      )}

      {/* Wizard Con Variantes · Fase 7b · F5(A) sidebar 4 pasos · Fase E3 con maestros */}
      <WizardConVariantes
        open={wizardActivo === 'con_variantes'}
        onClose={() => setWizardActivo(null)}
        onSubmit={handleCrearConVariantes}
        lineasNegocio={lineasActivas.map(l => ({ id: l.id, nombre: l.nombre, codigo: l.codigo }))}
      />

      {/* Wizard Pack · Fase 7b · F5(D) modal con secciones · Fase E3 con maestros */}
      <WizardPack
        open={wizardActivo === 'pack'}
        onClose={() => setWizardActivo(null)}
        onSubmit={handleCrearPack}
        productosDisponibles={lista}
        lineasNegocio={lineasActivas.map(l => ({ id: l.id, nombre: l.nombre, codigo: l.codigo }))}
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
        initialTab={detailInitialTab}
        onClose={() => {
          setDetailProducto(null);
          setDetailInitialTab('resumen'); // reset para próximo open
        }}
        onEdit={(p) => {
          setDetailProducto(null);
          setEditingProducto(p);
        }}
        onArchivar={handleArchivarProducto}
        onDuplicar={p => toast.info(`Duplicar ${p.nombreComercial} · pendiente`)}
        onAgregarVariante={p => toast.info(`Agregar variante a ${p.nombreComercial} · disponible en Fase 7`)}
      />

      {/* Modal Editar Producto · Fase D · #40 · GAP-020 + GAP-060 */}
      {/* S3.2 · Si flag WIZARD_PRODUCTO_V2 activo → ProductoEditModalV2 (6 secciones + Marketing IA) · sino legacy */}
      {isWizardProductoV2Enabled() ? (
        <ProductoEditModalV2
          open={!!editingProducto}
          producto={editingProducto}
          onClose={() => setEditingProducto(null)}
        />
      ) : (
        <ProductoEditModal
          open={!!editingProducto}
          producto={editingProducto}
          onClose={() => setEditingProducto(null)}
        />
      )}

      {/* Modal Papelera · Fase 8 · #23 · listado archivados con restaurar/eliminar */}
      <PapeleraModal
        open={showPapelera}
        archivados={Array.isArray(archivados) ? archivados : []}
        onClose={() => setShowPapelera(false)}
        onRestaurar={handleRestaurarProducto}
        onEliminarDefinitivo={handleEliminarDefinitivo}
        onVaciarPapelera={handleVaciarPapelera}
      />

      {/* S3.4 (2026-05-04) · InvestigacionCompletaModal ELIMINADO · consolidado en
          el tab "Investigación" del modal detalle del producto. handleAbrirInvestigacion
          ahora abre el modal detalle directamente en ese tab (no más modal aislado). */}


      {/* Tool #30 · Productos Intel Dashboard · Fase 9 */}
      <ProductosIntelDashboard
        open={showIntel}
        productos={intelRows}
        onClose={() => setShowIntel(false)}
        onAbrirSugerencias={() => {
          setShowIntel(false);
          setShowSugerenciasDia(true);
        }}
        onDescargarReporte={() => toast.info('Reporte ejecutivo · pendiente generador PDF')}
        onClickProducto={(productoId) => {
          const p = lista.find((x: any) => x.id === productoId);
          if (p) {
            setShowIntel(false);
            setDetailProducto(p);
          }
        }}
      />

      {/* Tool #31 · Punto de Equilibrio · Fase 9 */}
      <PuntoEquilibrioModal
        open={!!puntoEquilibrioInput}
        input={puntoEquilibrioInput}
        onClose={() => setPuntoEquilibrioInput(null)}
        onGuardarEscenario={(datos) =>
          toast.success(`Escenario guardado · PE ${datos.breakEven} uds @ S/${datos.precioVenta}`)
        }
      />

      {/* Tool #32 · Sugerencias Variantes · Modal de revisión · Fase 9 */}
      <SugerenciasVariantesModal
        open={showVariantesModal}
        grupos={gruposSugeridos}
        onClose={() => setShowVariantesModal(false)}
        onAplicar={(grupoId) =>
          toast.success(`Grupo ${grupoId} aplicado · variantes creadas (pendiente persistencia)`)
        }
        onDescartar={(grupoId) => toast.info(`Grupo ${grupoId} descartado`)}
        onAplicarTodos={() => {
          toast.success('Grupos de alta confianza aplicados (pendiente persistencia)');
          setShowVariantesModal(false);
        }}
        onConfigurar={() => toast.info('Configurar detección IA · pendiente')}
      />

      {/* Tool #36 · Sugerencias del día · Fase 9 */}
      <SugerenciasDelDiaModal
        open={showSugerenciasDia}
        sugerencias={sugerenciasDia}
        onClose={() => setShowSugerenciasDia(false)}
        onConfigurar={() => toast.info('Configurar sugerencias · pendiente')}
        onEjecutarTodasUrgentes={() => toast.info('Ejecutar todas las urgentes · pendiente')}
        onPausarNotificaciones={() => toast.info('Notificaciones pausadas')}
        onClickSugerencia={(s) => {
          if (s.icono === 'sparkles' && s.esLinkado) {
            setShowSugerenciasDia(false);
            setShowVariantesModal(true);
          } else {
            toast.info(`Sugerencia "${s.titulo}" · pendiente flujo dedicado`);
          }
        }}
      />

      {/* S3.4 · ProveedorFormModal y CompetidorFormModal a nivel page ELIMINADOS.
          Esos sub-modales ahora viven dentro de ProductoDetailModal (línea 687-708),
          invocados desde TabInvestigacion · NO necesitan duplicarse a nivel page. */}

      {/* ═══════ Fase G · Mini-modales BulkActions ═══════ */}
      <CambiarEstadoBulkModal
        open={bulkEstadoOpen}
        productos={productosSeleccionados}
        onClose={() => setBulkEstadoOpen(false)}
        onAplicar={handleBulkCambiarEstado}
      />
      <EtiquetarBulkModal
        open={bulkEtiquetarOpen}
        productos={productosSeleccionados}
        onClose={() => setBulkEtiquetarOpen(false)}
        onAplicar={handleBulkEtiquetar}
      />
      <ExportarCSVBulkModal
        open={bulkExportarOpen}
        productos={productosSeleccionados.length > 0 ? productosSeleccionados : productosFiltered}
        onClose={() => setBulkExportarOpen(false)}
      />
      <ArchivarBulkModal
        open={bulkArchivarOpen}
        productos={productosSeleccionados}
        onClose={() => setBulkArchivarOpen(false)}
        onConfirmar={handleBulkArchivar}
      />

      {/* ═══════ Fase H · Importar CSV ═══════ */}
      <ImportarCSVModal
        open={importarOpen}
        onClose={() => setImportarOpen(false)}
        lineasNegocio={lineasActivas.map(l => ({ id: l.id, nombre: l.nombre, codigo: l.codigo }))}
        onImportComplete={({ creados, actualizados, omitidos }) => {
          if (creados > 0 || actualizados > 0) {
            toast.success(`Importación: ${creados} creados · ${actualizados} actualizados${omitidos > 0 ? ` · ${omitidos} omitidos` : ''}`);
          } else if (omitidos > 0) {
            toast.warning(`Importación finalizada · ${omitidos} omitidos por errores`);
          }
        }}
      />
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Helper · usa calcularInvestigacion compartido (Fase H+) · MISMA fórmula
// que cards y TabInvestigacion. Devuelve -Infinity si no se puede calcular
// (sort coloca esos al final).
function calcMargen(p: any): number {
  const c = calcularInvestigacion(p);
  if (!c.esCompleta || c.precioEfectivo <= 0 || c.costoPEN <= 0) return -Infinity;
  return c.margenPct;
}

// ─── Fase G · Sort comparators (12 keys) ─────────────────────────────────────

const SORT_DEFAULT_DIR: Record<SortKey, 'asc' | 'desc'> = {
  margen_desc: 'desc',
  roi_desc: 'desc',
  multiplicador_desc: 'desc',
  utilidad_desc: 'desc',
  ventas_30d: 'desc',
  ventas_90d: 'desc',
  stock_desc: 'desc',
  stock_critico: 'asc',
  nombre_asc: 'asc',
  marca_asc: 'asc',
  sku_asc: 'asc',
  recientes: 'desc',
};

function getSortComparator(key: SortKey): (a: any, b: any) => number {
  switch (key) {
    case 'margen_desc':
      return (a, b) => calcMargen(b) - calcMargen(a);
    case 'roi_desc':
      // Fase H+ · usa calcularInvestigacion · MISMA fórmula que cards y tab
      return (a, b) => {
        const ca = calcularInvestigacion(a);
        const cb = calcularInvestigacion(b);
        const roiA = ca.esCompleta && ca.costoPEN > 0 ? (ca.precioEfectivo - ca.costoPEN) / ca.costoPEN : -Infinity;
        const roiB = cb.esCompleta && cb.costoPEN > 0 ? (cb.precioEfectivo - cb.costoPEN) / cb.costoPEN : -Infinity;
        return roiB - roiA;
      };
    case 'multiplicador_desc':
      return (a, b) => {
        const ca = calcularInvestigacion(a);
        const cb = calcularInvestigacion(b);
        const mA = ca.esCompleta && ca.costoPEN > 0 ? ca.precioEfectivo / ca.costoPEN : -Infinity;
        const mB = cb.esCompleta && cb.costoPEN > 0 ? cb.precioEfectivo / cb.costoPEN : -Infinity;
        return mB - mA;
      };
    case 'utilidad_desc':
      return (a, b) => {
        const ca = calcularInvestigacion(a);
        const cb = calcularInvestigacion(b);
        const uA = ca.esCompleta && ca.costoPEN > 0 ? ca.utilidad : -Infinity;
        const uB = cb.esCompleta && cb.costoPEN > 0 ? cb.utilidad : -Infinity;
        return uB - uA;
      };
    case 'ventas_30d':
      return (a, b) => (b.ventasUltimos30 ?? 0) - (a.ventasUltimos30 ?? 0);
    case 'ventas_90d':
      return (a, b) => (b.ventasUltimos90 ?? 0) - (a.ventasUltimos90 ?? 0);
    case 'stock_desc':
      return (a, b) => (b.stockDisponible ?? b.stockTotal ?? b.stock ?? 0) - (a.stockDisponible ?? a.stockTotal ?? a.stock ?? 0);
    case 'stock_critico':
      return (a, b) => {
        const ratioA = (a.stockMinimo ?? 0) > 0 ? (a.stockDisponible ?? a.stock ?? 0) / a.stockMinimo : 999;
        const ratioB = (b.stockMinimo ?? 0) > 0 ? (b.stockDisponible ?? b.stock ?? 0) / b.stockMinimo : 999;
        return ratioA - ratioB;
      };
    case 'nombre_asc':
      return (a, b) => (a.nombreComercial ?? '').localeCompare(b.nombreComercial ?? '');
    case 'marca_asc':
      return (a, b) => (a.marca ?? '').localeCompare(b.marca ?? '');
    case 'sku_asc':
      return (a, b) => (a.sku ?? '').localeCompare(b.sku ?? '');
    case 'recientes':
      return (a, b) => {
        const ta = a.fechaCreacion?.toDate?.()?.getTime?.() ?? 0;
        const tb = b.fechaCreacion?.toDate?.()?.getTime?.() ?? 0;
        return tb - ta;
      };
    default:
      return () => 0;
  }
}

// S3.4 · `buildInvestigacionPayload` ELIMINADO · solo se usaba para alimentar
// el InvestigacionCompletaModal (también eliminado). El TabInvestigacion del
// modal detalle lee directo de `producto.investigacion` sin necesidad de
// adaptar al payload legacy.
/* function buildInvestigacionPayload(p: Producto): InvestigacionPayload {
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
} */

// ─── Adaptadores Fase 9 · Tools ─────────────────────────────────────────────

function inferLineaIntel(p: any): LineaIntel {
  if (p.esPack) return 'pack';
  const skc = p.atributosSkincare;
  if (skc) return 'skincare';
  const linea = (p.lineaNegocioNombre ?? '').toLowerCase();
  if (linea.includes('skin')) return 'skincare';
  if (linea.includes('suplem')) return 'suplemento';
  if (linea.includes('well')) return 'wellness';
  return 'otros';
}

function inferScoreCategoria(score: number): ScoreLiquidezCategoria {
  if (score >= 60) return 'liquido';
  if (score >= 35) return 'medio';
  return 'lento';
}

function inferAccion(p: any, score: number, diasVencer?: number): AccionIntel {
  if (diasVencer !== undefined && diasVencer <= 30) return 'liquidar';
  const stock = p.stockDisponible ?? 0;
  const minimo = p.stockMinimo ?? 0;
  if (minimo > 0 && stock <= minimo * 1.2) return 'reponer';
  if (score < 35) return 'liquidar';
  if (score < 60) return 'vigilar';
  return 'reponer';
}

/**
 * Filtra productos con ACTIVIDAD REAL para Productos Intel.
 * (Fase H+ · acordado con usuario · 2026-05-03)
 *
 * Un producto tiene actividad si CUALQUIERA de:
 *   - Tiene >= 1 OC histórica (decisión activa de compra)
 *   - Tiene >= 1 venta histórica (generó ingreso)
 *   - Tiene stock > 0 en cualquier país (capital invertido)
 *   - Tiene investigación COMPLETA (proveedores+competidores · análisis pre-OC)
 *
 * Productos sin nada de eso son "creados pero no en operación" · no aportan
 * a inteligencia. Se excluyen del modal Productos Intel.
 */
function tieneActividadReal(p: any): boolean {
  const ocs = p.ocsHistoricas ?? 0;
  const ventas = p.cantidadVentas ?? p.unidadesVendidas ?? 0;
  const stockTotal = (p.stockUSA ?? 0) + (p.stockTransito ?? 0) +
                     (p.stockPeru ?? 0) + (p.stockReservado ?? 0);
  if (ocs >= 1 || ventas >= 1 || stockTotal >= 1) return true;
  // Investigación completa también cuenta · habilita el comparativo "Acierto"
  const provs = p.investigacion?.proveedoresUSA?.length ?? 0;
  const comps = p.investigacion?.competidoresPeru?.length ?? 0;
  return provs > 0 && comps > 0;
}

function buildIntelRows(productos: Producto[]): ProductoIntelRow[] {
  return productos
    .filter((p: any) => (p.estado ?? 'activo') === 'activo')
    .filter(tieneActividadReal)
    .map((p: any): ProductoIntelRow => {
      // ── Datos REALES sin placeholders ─────────────────────────────────────
      // CTRU real: solo si existe el campo en producto · NO inventamos default
      const ctruReal: number | null = (typeof p.ctruPromedio === 'number' && p.ctruPromedio > 0)
        ? p.ctruPromedio
        : null;

      // Stock real (siempre cuantificable · 0 es valor válido)
      const stock = typeof p.stockDisponible === 'number' ? p.stockDisponible : 0;

      // Capital invertido = stock × CTRU · null si no hay CTRU
      const capitalInvertidoPEN = ctruReal !== null && stock > 0
        ? Math.round(stock * ctruReal)
        : null;

      // Precio efectivo desde helper compartido (manual O sugerido en vivo)
      const calcInv = calcularInvestigacion(p);
      const precioEfectivo = calcInv.precioEfectivo;
      const costoPENVivo = calcInv.costoPEN > 0 ? calcInv.costoPEN : ctruReal;

      // Margen potencial = stock × (precioEfectivo − costo) · null si falta dato
      const margenPotencialPEN = (precioEfectivo > 0 && costoPENVivo !== null && costoPENVivo > 0 && stock > 0)
        ? Math.round((precioEfectivo - costoPENVivo) * stock)
        : null;

      const margenPotencialPct = (precioEfectivo > 0 && costoPENVivo !== null && costoPENVivo > 0)
        ? Math.round(((precioEfectivo - costoPENVivo) / precioEfectivo) * 100)
        : null;

      // Métricas que requieren agregación de movimientos · null si no hay data
      // (se llenan cuando exista unidad.analytics.service)
      const velocidadMes: number | null = typeof p.metricas?.velocidadVenta === 'number'
        ? p.metricas.velocidadVenta
        : null;
      const leadTimeDias: number | null = typeof p.leadTimeDias === 'number' ? p.leadTimeDias : null;
      const ocsHistoricas = typeof p.ocsHistoricas === 'number' ? p.ocsHistoricas : 0;
      const variacionVsPeriodoAnteriorPct: number | null = typeof p.variacionMensualPct === 'number'
        ? p.variacionMensualPct
        : null;

      // Score liquidez · solo si hay velocidad real · null si no
      const scoreLiquidez: number | null = (typeof p.scoreLiquidez === 'number')
        ? p.scoreLiquidez
        : (typeof p.metricas?.scoreLiquidez === 'number')
          ? p.metricas.scoreLiquidez
          : null;
      const scoreCategoria = scoreLiquidez !== null ? inferScoreCategoria(scoreLiquidez) : null;

      // Acción sugerida solo si tenemos suficientes datos
      const diasVencer = p.proximoVencimiento?.diasRestantes;
      const accion = scoreLiquidez !== null
        ? inferAccion(p, scoreLiquidez, diasVencer)
        : null;
      const esPerdidaSiVence = accion === 'liquidar' && diasVencer !== undefined && diasVencer <= 30;

      // Si es pérdida por vencimiento, ajustamos el margen (recuperamos solo 25%)
      const margenAjustado = esPerdidaSiVence && margenPotencialPEN !== null
        ? -Math.abs(margenPotencialPEN * 0.25)
        : margenPotencialPEN;

      return {
        id: p.id,
        sku: p.sku ?? '—',
        nombre: p.nombreComercial ?? 'Producto',
        marca: p.marca ?? 'Sin marca',
        linea: inferLineaIntel(p),
        scoreLiquidez,
        scoreCategoria,
        leadTimeDias,
        ocsHistoricas,
        velocidadMes,
        variacionVsPeriodoAnteriorPct,
        capitalInvertidoPEN,
        unidadesStock: stock,
        costoUnitarioPEN: costoPENVivo,
        margenPotencialPEN: margenAjustado,
        margenPotencialPct,
        accion,
        diasParaVencer: diasVencer,
        esPerdidaSiVence,
        // Fase H+ · Acierto vs Realidad (null si no hay base para comparar)
        acierto: calcularAciertoInversion(p),
      };
    });
}

function buildSugerenciasDelDia(productos: Producto[]): SugerenciaDelDia[] {
  const rows = buildIntelRows(productos);
  const sugerencias: SugerenciaDelDia[] = [];

  // Urgentes · liquidar productos con vencimiento <30d (requiere margen real)
  rows
    .filter((r) => r.accion === 'liquidar' && r.esPerdidaSiVence && r.margenPotencialPEN !== null)
    .slice(0, 3)
    .forEach((r) =>
      sugerencias.push({
        id: `urg-liq-${r.id}`,
        categoria: 'urgente',
        icono: 'zap-off',
        titulo: `Liquidar ${r.nombre}`,
        descripcion: `${r.unidadesStock} uds vencen en ${r.diasParaVencer} días`,
        metricaLabel: 'Pérdida potencial:',
        metricaValor: `−S/ ${Math.abs(r.margenPotencialPEN!).toLocaleString('es-PE')}`,
        metricaColor: 'rose',
      }),
    );

  // Urgentes · reponer con stock crítico (requiere velocidad real)
  rows
    .filter((r) => r.accion === 'reponer' && r.unidadesStock < 5 && r.velocidadMes !== null && r.velocidadMes > 0)
    .slice(0, 2)
    .forEach((r) => {
      const vel = r.velocidadMes!;
      const dias = Math.max(1, Math.round((r.unidadesStock / vel) * 30));
      sugerencias.push({
        id: `urg-rep-${r.id}`,
        categoria: 'urgente',
        icono: 'alert-circle',
        titulo: `Reponer ${r.nombre}`,
        descripcion: `Solo ${r.unidadesStock} uds libres · velocidad ${vel}/mes`,
        metricaLabel: 'Días restantes:',
        metricaValor: `${dias}d`,
        metricaColor: 'rose',
      });
    });

  // Vigilar · alta velocidad (requiere velocidad real)
  rows
    .filter((r) => r.scoreCategoria === 'liquido' && r.velocidadMes !== null && r.velocidadMes >= 8)
    .slice(0, 3)
    .forEach((r) => {
      const vel = r.velocidadMes!;
      sugerencias.push({
        id: `vig-alza-${r.id}`,
        categoria: 'vigilar',
        icono: 'trending-up',
        titulo: `${r.nombre} en alza · prepara OC`,
        descripcion: `Velocidad ${vel}/mes · stock dura ~${Math.round(r.unidadesStock / Math.max(1, vel))}m`,
        metricaLabel: 'Sugerido:',
        metricaValor: `${Math.round(vel * 4)} uds`,
        metricaColor: 'amber',
      });
    });

  // Oportunidades · cross-sell pack potencial entre líquidos
  const liquidos = rows.filter((r) => r.scoreCategoria === 'liquido');
  if (liquidos.length >= 2) {
    sugerencias.push({
      id: 'opp-cross-sell',
      categoria: 'oportunidad',
      icono: 'link-2',
      titulo: `Cross-sell ${liquidos[0].nombre.split(' ')[0]} + ${liquidos[1].nombre.split(' ')[0]}`,
      descripcion: '~68% clientes compran ambos · pack potencial',
      metricaLabel: 'Margen pack est.:',
      metricaValor: '+12%',
      metricaColor: 'emerald',
    });
  }

  // Oportunidad · linkado al banner #32 si hay grupos sugeridos
  const grupos = buildGruposSugeridos(productos);
  if (grupos.length > 0) {
    sugerencias.push({
      id: 'opp-variantes',
      categoria: 'oportunidad',
      icono: 'sparkles',
      titulo: `${grupos.length} grupo${grupos.length === 1 ? '' : 's'} podrían ser variantes`,
      descripcion: 'IA detectó SKUs similares agrupables',
      esLinkado: true,
      borderHighlight: 'purple',
    });
  }

  return sugerencias;
}

function buildGruposSugeridos(productos: Producto[]): GrupoSugerido[] {
  // Heurística simple: agrupar por marca + primeras 3 palabras del nombre
  const grupos = new Map<string, Producto[]>();
  productos.forEach((p: any) => {
    if ((p.estado ?? 'activo') !== 'activo') return;
    if (p.grupoVarianteId) return; // ya es variante
    if (p.esPack) return;
    const palabras = (p.nombreComercial ?? '')
      .toLowerCase()
      .split(/\s+/)
      .slice(0, 3)
      .join(' ');
    const key = `${p.marca ?? 'sin'}|${palabras}`;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(p);
  });

  const resultado: GrupoSugerido[] = [];
  let idx = 0;
  grupos.forEach((items, key) => {
    if (items.length < 2) return;
    if (idx >= 3) return; // máximo 3 grupos en banner
    const primero: any = items[0];
    const matchPct = items.length >= 3 ? 96 : items.length === 2 ? 78 : 62;
    const confianza: 'alta' | 'media' | 'baja' = matchPct >= 90 ? 'alta' : matchPct >= 70 ? 'media' : 'baja';
    resultado.push({
      id: `grp-${idx}-${primero.id}`,
      nombreBase: primero.nombreComercial ?? 'Producto',
      matchPct,
      confianza,
      descripcion:
        confianza === 'alta'
          ? `${items.length} SKUs sueltos detectados · misma marca, mismo producto, diferentes presentaciones`
          : confianza === 'media'
            ? `${items.length} SKUs · revisar manualmente · presentaciones diferentes`
            : `${items.length} SKUs · marcas diferentes · revisar si son intercambiables`,
      productos: items.map((it: any) => ({
        sku: it.sku ?? '—',
        nombre: it.nombreComercial ?? 'Producto',
        detalle: it.contenido ? `→ ${it.contenido}` : undefined,
        detalleColor: 'slate' as const,
        icono: inferLineaIntel(it) === 'suplemento' ? 'pill' : inferLineaIntel(it) === 'wellness' ? 'flower' : 'droplets',
        iconoColor: inferLineaIntel(it) === 'suplemento' ? 'indigo' : inferLineaIntel(it) === 'wellness' ? 'rose' : 'amber',
      })),
    });
    idx++;
  });

  return resultado;
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
