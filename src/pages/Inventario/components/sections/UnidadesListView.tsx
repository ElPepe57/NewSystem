/**
 * UnidadesListView · vista de listado de unidades individuales (FEFO)
 *
 * Extraído de `pages/Unidades/Unidades.tsx` (S3.6 M1 chk4.4 · fusión).
 * Se renderiza dentro del modo "Unidades" del tab Inventario.
 *
 * NO renderiza header ni KPI strip · esos vienen del shell `InventarioPageV2`.
 * SÍ renderiza: filtros (FiltrosBar canónico) + búsqueda + paginación + cards
 * apiladas (canon F4) / tabla densa + modales propios (UnidadDetails · EditarVencimiento).
 *
 * chk5.DS · FILTROS UNIFICADOS A FiltrosBar (igual que el modo Stock · InventarioPageV2):
 *   - Búsqueda  → searchTerm (SKU/nombre/lote/almacén)
 *   - Ubicación → leadingFilter "Todas las ubicaciones" (dropdown agrupado por TIPO de almacén)
 *   - País      → chipGroup multi (USA 🇺🇸 sky · Perú 🇵🇪 emerald · count = nº unidades)
 *   - Estado    → chipGroup multi GRANULAR (preserva casos especiales recibida_origen/en_transito_origen)
 *   - Orden     → sortValue (vencen_asc default · reciente_desc · sku_asc · nombre_asc)
 *   - ChipsActivos → banner removible bajo FiltrosBar
 * Eliminados: <Toolbar> · <FilterDrawer>/<FilterSection> · filtro Producto (cubierto por búsqueda).
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  Package, Eye, Calendar, LayoutGrid, Table2,
  Building2, Warehouse, User, Truck, Globe2, type LucideIcon,
} from 'lucide-react';
import { formatFecha, calcularDiasParaVencer as calcularDiasParaVencerUtil } from '../../../../utils/dateFormatters';
import { getDescripcionProducto } from '../../../../utils/producto.helpers';
import { formatCurrency } from '../../../../utils/format';
import {
  Card,
  Badge,
  Button,
  ListSummary,
  Pagination,
  LineaNegocioBadge,
  PaisOrigenBadge,
} from '../../../../components/common';
import { DataTable, FiltrosBar, ChipsActivos } from '../../../../design-system';
import type {
  DataTableColumn,
  ChipGroupConfig, SortOption,
  LeadingFilterConfig, LeadingFilterOptionGroup, ChipActivo,
} from '../../../../design-system';
import { UnidadDetailsModal } from '../detail/UnidadDetailsModal';
import { UnidadCard } from '../cards/UnidadCard';
import { EditarVencimientoModal } from '../modals/EditarVencimientoModal';
import { useUnidadStore } from '../../../../store/unidadStore';
import { useProductoStore } from '../../../../store/productoStore';
import { useAlmacenStore } from '../../../../store/casillaStore';
import { useToastStore } from '../../../../store/toastStore';
import { useAuthStore } from '../../../../store/authStore';
import { unidadService } from '../../../../services/unidad.service';
import type { Unidad, EstadoUnidad } from '../../../../types/unidad.types';
import { useLineaFilter } from '../../../../hooks/useLineaFilter';
import { esEstadoEnOrigen, esEstadoEnTransitoOrigen, getLabelEstadoUnidad, getPaisEmoji } from '../../../../utils/multiOrigen.helpers';

type VistaUnidades = 'cards' | 'tabla';

const getColorVencimiento = (dias: number): string => {
  if (dias < 0) return 'text-rose-700';
  if (dias <= 30) return 'text-amber-700';
  if (dias <= 90) return 'text-yellow-700';
  return 'text-slate-700';
};

const getEstadoBadgeMeta = (estado: EstadoUnidad | string, paisOrigen?: string) => {
  const variantMap: Record<string, 'success' | 'info' | 'warning' | 'default' | 'danger'> = {
    recibida_usa: 'success',
    recibida_origen: 'success',
    en_transito_usa: 'info',
    en_transito_origen: 'info',
    en_transito_peru: 'info',
    disponible_peru: 'success',
    reservada: 'warning',
    vendida: 'default',
    vencida: 'danger',
    danada: 'danger',
    entregada: 'warning',
    asignada_pedido: 'warning',
  };
  const variant = variantMap[estado] || 'default';
  const label = getLabelEstadoUnidad(estado as EstadoUnidad, paisOrigen);
  return { variant, label };
};

// ─── Filtro de ESTADO · valores granulares para el chipGroup ──────────────────
// Mismos 6 valores que el Select legacy (pedida/en_transito/disponible/reservada/
// vendida/danada). Cada chip lleva su variant semántico FIJO (no el color del módulo).
const ESTADO_CHIP_OPTIONS: { value: string; label: string; variant: ChipGroupConfig['options'][number]['variant'] }[] = [
  { value: 'pedida',      label: 'Pedida',      variant: 'slate' },
  { value: 'en_transito', label: 'En Tránsito', variant: 'sky' },
  { value: 'disponible',  label: 'Disponible',  variant: 'emerald' },
  { value: 'reservada',   label: 'Reservada',   variant: 'amber' },
  { value: 'vendida',     label: 'Vendida',     variant: 'slate' },
  { value: 'danada',      label: 'Dañada',      variant: 'rose' },
];

/**
 * Determina si una unidad matchea un valor de estado del filtro.
 * PRESERVA 1:1 la lógica granular original (UnidadesListView legacy L123-130):
 *   - 'recibida_origen'    → esEstadoEnOrigen(unidad.estado)
 *   - 'en_transito_origen' → esEstadoEnTransitoOrigen(unidad.estado)
 *   - resto               → unidad.estado === valor
 * Estos casos especiales se conservan aunque los 6 chips visibles sean los
 * estándar · garantiza comportamiento equivalente al filtro previo.
 */
const matchEstadoUnidad = (unidad: Unidad, valor: string): boolean => {
  if (valor === 'recibida_origen') return esEstadoEnOrigen(unidad.estado);
  if (valor === 'en_transito_origen') return esEstadoEnTransitoOrigen(unidad.estado);
  return unidad.estado === valor;
};

export const UnidadesListView: React.FC = () => {
  const { unidades, loading, fetchUnidades, fetchStats } = useUnidadStore();
  const { productos } = useProductoStore();
  const { almacenes } = useAlmacenStore();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  const unidadesPorLinea = useLineaFilter(unidades, u => u.lineaNegocioId);

  // chk5.DS · modelo de filtros unificado al canon FiltrosBar (mismo que modo Stock):
  //   selecciones · multi-valor por dimensión (pais/estado) + ubicacion (single → [valor])
  //   busqueda    · texto libre (SKU/nombre/lote/almacén)
  //   sortValue   · orden de la lista (default FEFO · por vencer primero)
  const [selecciones, setSelecciones] = useState<Record<string, string[]>>({});
  const [busqueda, setBusqueda] = useState('');
  const [sortValue, setSortValue] = useState('vencen_asc');
  const [unidadSeleccionada, setUnidadSeleccionada] = useState<Unidad | null>(null);
  const [showEditarVencimiento, setShowEditarVencimiento] = useState(false);
  const [vistaActual, setVistaActual] = useState<VistaUnidades>(
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'tabla'
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);

  // chk5.DS-F3 FIX · NO re-fetch al montar · el shell InventarioPageV2 ya carga unidades/stats/
  // productos/almacenes en su propio mount. El doble fetch causaba un LOOP de skeleton al entrar
  // al modo Unidades con inventario VACÍO: fetch→loading=true→el guard global del shell renderiza
  // InventarioSkeleton (desmonta esta vista)→fetch resuelve con 0→loading=false→remonta→re-fetch…
  // Esta vista solo CONSUME del store. fetchUnidades/fetchStats se conservan para refrescar tras
  // acciones (editar vencimiento, etc.), que operan sobre unidades existentes (no disparan el loop).

  // Valor de ubicación seleccionado (single-select · vive en selecciones.ubicacion como [valor])
  const ubicacionSel = selecciones.ubicacion?.[0] ?? '';

  const unidadesFiltradas = useMemo(() => {
    const paisSel = selecciones.pais ?? [];
    const estadoSel = selecciones.estado ?? [];

    return unidadesPorLinea.filter(unidad => {
      // Búsqueda (SKU / nombre / lote / almacén)
      if (busqueda) {
        const term = busqueda.toLowerCase();
        const matchSearch =
          unidad.productoSKU?.toLowerCase().includes(term) ||
          unidad.productoNombre?.toLowerCase().includes(term) ||
          unidad.lote?.toLowerCase().includes(term) ||
          (unidad.casillaNombre || unidad.almacenNombre)?.toLowerCase().includes(term);
        if (!matchSearch) return false;
      }

      // Ubicación (leadingFilter · single-select)
      if (ubicacionSel && (unidad.casillaActualId || unidad.almacenId) !== ubicacionSel) return false;

      // País (chipGroup multi · pasa si vacío O incluye el país de la unidad)
      if (paisSel.length > 0 && !paisSel.includes(unidad.pais)) return false;

      // Estado (chipGroup multi GRANULAR · pasa si vacío O matchea ALGÚN valor seleccionado,
      // aplicando los casos especiales recibida_origen/en_transito_origen por cada valor)
      if (estadoSel.length > 0 && !estadoSel.some(v => matchEstadoUnidad(unidad, v))) return false;

      return true;
    });
  }, [unidadesPorLinea, selecciones, busqueda, ubicacionSel]);

  // Orden (FEFO por defecto) · se aplica ANTES de la paginación
  const unidadesOrdenadas = useMemo(() => {
    const arr = [...unidadesFiltradas];
    switch (sortValue) {
      case 'vencen_asc': // FEFO · vence antes primero (null/sin fecha al final)
        arr.sort((a, b) => {
          const da = calcularDiasParaVencerUtil(a.fechaVencimiento);
          const db = calcularDiasParaVencerUtil(b.fechaVencimiento);
          if (da === null && db === null) return 0;
          if (da === null) return 1;
          if (db === null) return -1;
          return da - db;
        });
        break;
      case 'reciente_desc': // creación más reciente primero
        arr.sort((a, b) => (b.fechaCreacion?.toMillis?.() ?? 0) - (a.fechaCreacion?.toMillis?.() ?? 0));
        break;
      case 'sku_asc':
        arr.sort((a, b) => (a.productoSKU ?? '').localeCompare(b.productoSKU ?? ''));
        break;
      case 'nombre_asc':
        arr.sort((a, b) => (a.productoNombre ?? '').localeCompare(b.productoNombre ?? ''));
        break;
      default:
        break;
    }
    return arr;
  }, [unidadesFiltradas, sortValue]);

  const unidadesPaginadas = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return unidadesOrdenadas.slice(startIndex, startIndex + pageSize);
  }, [unidadesOrdenadas, currentPage, pageSize]);

  const productosMap = useMemo(() => {
    const map = new Map<string, { presentacion?: string; contenido?: string; dosaje?: string; sabor?: string; atributosSkincare?: any }>();
    productos.forEach(p => {
      if (p.presentacion || p.contenido || p.dosaje || p.sabor || p.atributosSkincare) {
        map.set(p.id, { presentacion: p.presentacion, contenido: p.contenido, dosaje: p.dosaje, sabor: p.sabor, atributosSkincare: p.atributosSkincare });
      }
    });
    return map;
  }, [productos]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selecciones, busqueda, sortValue]);

  // ─── Config FiltrosBar ──────────────────────────────────────────────────────

  // chipGroups · País (multi · count = nº de UNIDADES de ese país)
  const chipGroups: ChipGroupConfig[] = useMemo(() => {
    const porPais = new Map<string, number>();
    unidadesPorLinea.forEach(u => {
      if (u.pais) porPais.set(u.pais, (porPais.get(u.pais) ?? 0) + 1);
    });
    return [
      {
        key: 'pais',
        label: 'País',
        multi: true,
        options: [
          { value: 'USA',  label: 'USA',  count: porPais.get('USA') ?? 0,  emojiPrefix: '🇺🇸', variant: 'sky' as const },
          { value: 'Peru', label: 'Perú', count: porPais.get('Peru') ?? 0, emojiPrefix: '🇵🇪', variant: 'emerald' as const },
        ],
      },
      {
        key: 'estado',
        label: 'Estado',
        multi: true,
        options: ESTADO_CHIP_OPTIONS.map(o => ({
          value: o.value,
          label: o.label,
          variant: o.variant,
          count: unidadesPorLinea.filter(u => matchEstadoUnidad(u, o.value)).length,
        })),
      },
    ];
  }, [unidadesPorLinea]);

  // leadingFilter · "Todas las ubicaciones" · dropdown agrupado por TIPO de almacén
  // (réplica del patrón Stock · InventarioPageV2 L583-638)
  const leadingFilter: LeadingFilterConfig = useMemo(() => {
    const TIPO_CONFIG: Record<string, { label: string; icon: LucideIcon; itemIcon: LucideIcon; orden: number }> = {
      almacen_peru:   { label: 'Almacenes Perú',      icon: Building2, itemIcon: Building2, orden: 1 },
      almacen_origen: { label: 'Almacenes en origen', icon: Warehouse, itemIcon: Warehouse, orden: 2 },
      viajero:        { label: 'Viajeros',            icon: User,      itemIcon: User,      orden: 3 },
      courier:        { label: 'Couriers',            icon: Truck,     itemIcon: Truck,     orden: 4 },
    };

    const porTipo = new Map<string, typeof almacenes>();
    almacenes.forEach(a => {
      const tipo = a.tipo || 'almacen_peru';
      if (!porTipo.has(tipo)) porTipo.set(tipo, []);
      porTipo.get(tipo)!.push(a);
    });

    const grupos: LeadingFilterOptionGroup[] = Array.from(porTipo.keys())
      .filter(tipo => (porTipo.get(tipo)?.length ?? 0) > 0)
      .sort((a, b) => (TIPO_CONFIG[a]?.orden ?? 99) - (TIPO_CONFIG[b]?.orden ?? 99))
      .map(tipo => {
        const cfg = TIPO_CONFIG[tipo] ?? { label: tipo, icon: Warehouse, itemIcon: Warehouse, orden: 99 };
        const items = (porTipo.get(tipo) ?? []).slice().sort((a, b) =>
          (a.nombre ?? '').localeCompare(b.nombre ?? '')
        );
        return {
          groupLabel: cfg.label,
          groupIcon: cfg.icon,
          options: items.map(a => ({
            value: a.id,
            label: a.nombre,
            icon: cfg.itemIcon,
          })),
        };
      });

    return {
      label: 'Todas las ubicaciones',
      value: ubicacionSel,
      icon: Globe2,
      allOption: {
        value: '',
        label: 'Todas las ubicaciones',
        icon: Globe2,
      },
      options: grupos,
      onChange: (value: string) => {
        setSelecciones(prev => {
          const updated = { ...prev };
          if (value === '') delete updated.ubicacion;
          else updated.ubicacion = [value];
          return updated;
        });
      },
    };
  }, [ubicacionSel, almacenes]);

  const sortOptions: SortOption[] = useMemo(() => [
    { value: 'vencen_asc',    label: 'Por vencer primero' },
    { value: 'reciente_desc', label: 'Más reciente' },
    { value: 'sku_asc',       label: 'SKU A-Z' },
    { value: 'nombre_asc',    label: 'Nombre A-Z' },
  ], []);

  const handleChipToggle = (groupKey: string, value: string) => {
    setSelecciones(prev => {
      const current = prev[groupKey] ?? [];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      const updated = { ...prev };
      if (next.length === 0) delete updated[groupKey];
      else updated[groupKey] = next;
      return updated;
    });
  };

  const hayFiltrosActivos = useMemo(
    () => !!busqueda || Object.values(selecciones).some(a => a.length > 0),
    [busqueda, selecciones]
  );

  const limpiarFiltros = () => {
    setSelecciones({});
    setBusqueda('');
    setCurrentPage(1);
  };

  // chipsActivos · banner removible bajo el FiltrosBar (réplica patrón Stock L650+)
  const chipsActivos: ChipActivo[] = useMemo(() => {
    const chips: ChipActivo[] = [];

    // País
    (selecciones.pais ?? []).forEach(pais => {
      chips.push({
        key: `pais:${pais}`,
        label: `${pais === 'USA' ? '🇺🇸' : '🇵🇪'} ${pais === 'Peru' ? 'Perú' : pais}`,
        color: pais === 'USA' ? 'sky' : 'emerald',
        onRemove: () => handleChipToggle('pais', pais),
      });
    });

    // Estado
    (selecciones.estado ?? []).forEach(estado => {
      const opt = ESTADO_CHIP_OPTIONS.find(o => o.value === estado);
      chips.push({
        key: `estado:${estado}`,
        label: `Estado: ${opt?.label ?? estado}`,
        color: (opt?.variant as ChipActivo['color']) ?? 'slate',
        onRemove: () => handleChipToggle('estado', estado),
      });
    });

    // Ubicación
    (selecciones.ubicacion ?? []).forEach(almacenId => {
      const almacen = almacenes.find(a => a.id === almacenId);
      if (!almacen) return;
      chips.push({
        key: `ubicacion:${almacenId}`,
        label: `Ubicación: ${almacen.nombre}`,
        color: 'slate',
        onRemove: () => {
          setSelecciones(prev => {
            const updated = { ...prev };
            delete updated.ubicacion;
            return updated;
          });
        },
      });
    });

    // Búsqueda
    if (busqueda.trim()) {
      chips.push({
        key: 'search',
        label: `"${busqueda}"`,
        color: 'slate',
        onRemove: () => setBusqueda(''),
      });
    }

    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecciones, busqueda, almacenes]);

  const tablaColumns: DataTableColumn<Unidad>[] = [
    {
      key: 'producto',
      header: 'Producto',
      render: unidad => (
        <div>
          <div className="text-sm font-medium text-slate-900 tabular-nums">{unidad.productoSKU || '-'}</div>
          <div className="text-sm text-slate-500">{unidad.productoNombre || '-'}</div>
          {(() => {
            const pInfo = productosMap.get(unidad.productoId);
            const desc = pInfo ? getDescripcionProducto(pInfo) : '';
            return desc ? <div className="text-[10px] text-slate-400">{desc}</div> : null;
          })()}
          <div className="flex items-center gap-1 mt-0.5">
            <LineaNegocioBadge lineaNegocioId={unidad.lineaNegocioId} />
            <PaisOrigenBadge paisOrigen={unidad.paisOrigen} />
          </div>
        </div>
      ),
    },
    {
      key: 'lote',
      header: 'Lote',
      hideOnMobile: true,
      render: unidad => <div className="text-sm text-slate-900 tabular-nums">{unidad.lote || '-'}</div>,
    },
    {
      key: 'vencimiento',
      header: 'Vencimiento',
      hideOnMobile: true,
      render: unidad => {
        const diasVencer = calcularDiasParaVencerUtil(unidad.fechaVencimiento) ?? 0;
        return (
          <div>
            <div className="text-sm text-slate-900 tabular-nums">{formatFecha(unidad.fechaVencimiento)}</div>
            <div className={`text-xs font-medium tabular-nums ${getColorVencimiento(diasVencer)}`}>
              {diasVencer < 0 ? `Vencido hace ${Math.abs(diasVencer)} días` : `${diasVencer} días`}
            </div>
          </div>
        );
      },
    },
    {
      key: 'almacen',
      header: 'Casilla',
      render: unidad => (
        <div className="text-sm text-slate-900">
          {getPaisEmoji(unidad.pais)} {unidad.casillaNombre || unidad.almacenNombre || '-'}
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: unidad => {
        const meta = getEstadoBadgeMeta(unidad.estado, unidad.paisOrigen || unidad.pais);
        return <Badge variant={meta.variant}>{meta.label}</Badge>;
      },
    },
    {
      key: 'envio',
      header: 'Envío',
      hideOnMobile: true,
      render: unidad => unidad.envioNumero
        ? <span className="text-xs font-medium text-sky-600 tabular-nums">{unidad.envioNumero}</span>
        : <span className="text-xs text-slate-300">—</span>,
    },
    {
      key: 'costoUSD',
      header: 'Costo USD',
      align: 'right',
      render: unidad => (
        <span className="text-sm text-slate-900 tabular-nums">
          {formatCurrency(unidad.costoUnitarioUSD || 0)}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'center',
      render: unidad => (
        <button
          onClick={() => setUnidadSeleccionada(unidad)}
          className="p-1.5 text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded-lg transition-colors"
          title="Ver detalles"
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {/* Acciones secundarias específicas del modo Unidades */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => setShowEditarVencimiento(true)}
          className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5"
        >
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">Vencimientos</span>
        </Button>
      </div>

      {/* FiltrosBar canónico (búsqueda + ubicación + país + estado + orden) */}
      <FiltrosBar
        leadingFilter={leadingFilter}
        chipGroups={chipGroups}
        selecciones={selecciones}
        onChipToggle={handleChipToggle}
        searchTerm={busqueda}
        searchPlaceholder="Buscar por SKU, nombre, lote o almacén..."
        onSearchChange={setBusqueda}
        sortValue={sortValue}
        sortOptions={sortOptions}
        onSortChange={setSortValue}
        hayFiltrosActivos={hayFiltrosActivos}
        onLimpiarTodo={limpiarFiltros}
      />

      {/* ChipsActivos · banner removible cuando hay filtros aplicados */}
      <ChipsActivos
        resultCount={unidadesFiltradas.length}
        totalCount={unidadesPorLinea.length}
        chips={chipsActivos}
        entityLabel="unidades"
      />

      {/* Mini-toolbar · contador + toggle de vista (Cards / Tabla) */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-slate-600">
          Mostrando <span className="font-medium tabular-nums">{unidadesPaginadas.length}</span> de{' '}
          <span className="font-medium tabular-nums">{unidadesFiltradas.length}</span> unidades
          {unidadesFiltradas.length !== unidadesPorLinea.length && ` (${unidadesPorLinea.length} total)`}
        </span>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setVistaActual('cards')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              vistaActual === 'cards'
                ? 'bg-white text-orange-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            title="Vista de tarjetas"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cards</span>
          </button>
          <button
            type="button"
            onClick={() => setVistaActual('tabla')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              vistaActual === 'tabla'
                ? 'bg-white text-orange-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            title="Vista de tabla"
          >
            <Table2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tabla</span>
          </button>
        </div>
      </div>

      {/* Vista cards apiladas o tabla */}
      {vistaActual === 'cards' ? (
        <>
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
              </div>
            ) : unidadesPaginadas.length === 0 ? (
              <Card padding="lg">
                <div className="text-center py-8">
                  <Package className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="mt-2 text-sm font-medium text-slate-900">No hay unidades</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Las unidades se crean automáticamente al recibir órdenes de compra
                  </p>
                </div>
              </Card>
            ) : (
              unidadesPaginadas.map((unidad) => (
                <UnidadCard
                  key={unidad.id}
                  unidad={unidad}
                  productoInfo={productosMap.get(unidad.productoId)}
                  onVerDetalle={() => setUnidadSeleccionada(unidad)}
                />
              ))
            )}
          </div>

          {!loading && unidadesFiltradas.length > 0 && (
            <Card padding="sm">
              <Pagination
                currentPage={currentPage}
                totalItems={unidadesFiltradas.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[12, 24, 48, 96]}
                showPageSizeSelector
                showItemsInfo
              />
            </Card>
          )}
        </>
      ) : (
        <Card padding="md">
          {unidadesFiltradas.length === 0 && !loading ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-2 text-sm font-medium text-slate-900">No hay unidades</h3>
              <p className="mt-1 text-sm text-slate-500">
                Las unidades se crean automáticamente al recibir órdenes de compra
              </p>
            </div>
          ) : (
            <DataTable
              columns={tablaColumns}
              data={unidadesPaginadas.filter(u => u && u.estado)}
              keyExtractor={u => u.id}
              loading={loading}
            />
          )}
          {!loading && unidadesFiltradas.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 space-y-4">
              <ListSummary
                filteredCount={unidadesFiltradas.length}
                totalCount={unidadesPorLinea.length}
                itemLabel="unidades"
                summaryItems={[
                  {
                    label: 'Valor Total',
                    value: `$${unidadesFiltradas.reduce((sum, u) => sum + (u.costoUnitarioUSD || 0), 0).toFixed(2)}`,
                    icon: 'money',
                    variant: 'info',
                  },
                  {
                    label: 'Disponibles',
                    value: unidadesFiltradas.filter(u => u.estado === 'disponible_peru' || esEstadoEnOrigen(u.estado)).length,
                    icon: 'package',
                    variant: 'success',
                  },
                  {
                    label: 'Reservadas',
                    value: unidadesFiltradas.filter(u => u.estado === 'reservada').length,
                    icon: 'package',
                    variant: 'warning',
                  },
                ]}
              />
              <Pagination
                currentPage={currentPage}
                totalItems={unidadesFiltradas.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[25, 50, 100, 200]}
                showPageSizeSelector
                showItemsInfo
              />
            </div>
          )}
        </Card>
      )}

      {/* Modales internos */}
      <EditarVencimientoModal
        isOpen={showEditarVencimiento}
        onClose={() => setShowEditarVencimiento(false)}
        unidades={unidades}
        productosMap={productosMap}
        onSuccess={() => {
          fetchUnidades();
          fetchStats();
        }}
      />

      {unidadSeleccionada && (
        <UnidadDetailsModal
          unidad={unidadSeleccionada}
          productoInfo={productosMap.get(unidadSeleccionada.productoId)}
          onClose={() => setUnidadSeleccionada(null)}
          onLiberarReserva={async (unidad) => {
            if (!user) return;
            const confirmar = window.confirm(
              `¿Liberar la reserva de la unidad ${unidad.lote}?\n\nLa unidad volverá al estado "Disponible Perú" y podrá ser asignada a otra cotización.`
            );
            if (!confirmar) return;
            try {
              const resultado = await unidadService.liberarUnidades(
                [unidad.id],
                'Liberación manual desde detalle de unidad',
                user.uid
              );
              if (resultado.exitos > 0) {
                addToast('success', 'Reserva liberada exitosamente');
                setUnidadSeleccionada(null);
                await fetchUnidades();
                await fetchStats();
              } else {
                addToast('error', 'No se pudo liberar la reserva');
              }
            } catch (error: any) {
              addToast('error', error.message || 'Error al liberar reserva');
            }
          }}
        />
      )}
    </div>
  );
};
