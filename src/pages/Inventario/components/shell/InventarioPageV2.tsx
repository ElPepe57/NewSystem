/**
 * InventarioPageV2 · orquestador canónico del módulo Inventario (S3.6 M1 chk4.2)
 *
 * Estructura banking-grade pixel-perfect (mockup stock-rediseno-s58f + canon X):
 *   1. HeaderV2          → breadcrumb + h1+icon Warehouse + subtítulo + acciones
 *   2. KpiStripV2        → 5 KPIs canónicos (Total · Disponibles · Reservadas · Tránsito · Vencen <30d)
 *   3. Tabs canónicos    → Inventario [toggle Stock|Unidades] · Mapa · Analytics · Atención
 *   4. Tab activo        → render condicional + SegmentedControl en tab Inventario
 *   5. Modales globales  → Sincronización · UnidadDetails · Vencidas · Promoción
 *
 * Reemplaza al god-file `Inventario.tsx` (1081 ln) que delega ahora todo a este
 * orquestador. Eliminados del flujo legacy:
 *   - StatCards interactivos (redundantes con KPI strip)
 *   - StatDistribution dual (visual viejo)
 *   - PipelineHeader (huérfano · eliminado completamente en chk5)
 *   - AlertasPrioritarias suelto en tab Inventario (vive solo en tab Atención)
 *
 * Toda la lógica de useMemo (stats, productosConUnidades, alertas, etc.) se preserva
 * 1:1 sin cambios funcionales · el refactor es estructural y visual, no de comportamiento.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, BarChart3, Bell, MapPin, CheckCircle, Boxes } from 'lucide-react';
import { useToastStore } from '../../../../store/toastStore';
import { calcularDiasParaVencer } from '../../../../utils/dateFormatters';
import {
  Card,
  Button,
  Modal,
  InventarioSkeleton,
  Tabs,
} from '../../../../components/common';
import { FiltrosBar } from '../../../../design-system';
import type { ChipGroupConfig, SortOption } from '../../../../design-system';
import type { Tab } from '../../../../components/common/Tabs';

// Componentes locales del módulo
import { HeaderV2 } from './HeaderV2';
import { KpiStripV2 } from './KpiStripV2';
import { SegmentedControl } from './SegmentedControl';
import { InventarioPills, type PillInventario } from './InventarioPills';
import {
  ProductoInventarioTable,
  UnidadDetailsModal,
  StockProductoCard,
  StockListHeader,
  InventarioAnalytics,
  PromocionModal,
  GestionVencidasModal,
} from '../index';
import { AtencionTab } from '../sections/AtencionTab';
import { MapaTab } from '../sections/MapaTab';
import { UnidadesListView } from '../sections/UnidadesListView';
import { AlertasBanner } from '../sections/AlertasBanner';
import type { PromocionData, ProductoConUnidades, AlertaProducto } from '../index';

// Stores
import { useUnidadStore } from '../../../../store/unidadStore';
import { useProductoStore } from '../../../../store/productoStore';
import { useAlmacenStore } from '../../../../store/casillaStore';
import { useInventarioStore } from '../../../../store/inventarioStore';
import { useCTRUStore } from '../../../../store/ctruStore';
import { useLineaNegocioStore } from '../../../../store/lineaNegocioStore';

// Services + helpers
import { exportService } from '../../../../services/export.service';
import { inventarioService } from '../../../../services/inventario.service';
import type { Unidad } from '../../../../types/unidad.types';
import { useLineaFilter } from '../../../../hooks/useLineaFilter';
import { esEstadoEnOrigen, esEstadoEnTransitoOrigen } from '../../../../utils/multiOrigen.helpers';

type VistaInventario = 'cards' | 'tabla';
type ModoInventario = 'stock' | 'unidades';
type TabInventarioV2 = 'inventario' | 'mapa' | 'analytics' | 'atencion';

export const InventarioPageV2: React.FC = () => {
  const toast = useToastStore();

  // Stores
  const unidades = useUnidadStore(state => state.unidades);
  const unidadesLoading = useUnidadStore(state => state.loading);
  const fetchUnidades = useUnidadStore(state => state.fetchUnidades);
  const productos = useProductoStore(state => state.productos);
  const fetchProductos = useProductoStore(state => state.fetchProductos);
  const almacenes = useAlmacenStore(state => state.almacenes);
  const fetchAlmacenes = useAlmacenStore(state => state.fetchAlmacenes);
  const fetchStats = useInventarioStore(state => state.fetchStats);
  const ctruData = useCTRUStore(state => state.productosDetalle);
  const fetchCTRU = useCTRUStore(state => state.fetchAll);
  const lineasNegocio = useLineaNegocioStore(state => state.lineasActivas);
  const fetchLineas = useLineaNegocioStore(state => state.fetchLineas);

  // Pre-filtrar unidades por línea de negocio global
  const unidadesPorLinea = useLineaFilter(
    Array.isArray(unidades) ? unidades : [],
    u => u.lineaNegocioId
  );

  // Tab activo via URL ?tab=
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabInventarioV2 | null;
  const modoParam = searchParams.get('modo') as ModoInventario | null;
  const [tabActivo, setTabActivo] = useState<TabInventarioV2>(
    tabParam && ['inventario', 'mapa', 'analytics', 'atencion'].includes(tabParam)
      ? tabParam
      : (modoParam === 'unidades' ? 'inventario' : 'inventario')
  );

  // Modo Stock|Unidades dentro del tab Inventario · respeta ?modo= en URL
  const [modoInventario, setModoInventario] = useState<ModoInventario>(
    modoParam === 'unidades' ? 'unidades' : 'stock'
  );

  // Filtros y estado UI
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [vistaActual, setVistaActual] = useState<VistaInventario>('cards');

  // Pills rápidos (chk4.7c)
  const [pillActivo, setPillActivo] = useState<PillInventario>('todos');

  // Chip groups multi-valor (chk4.7d) · línea · país · ubicación
  const [selecciones, setSelecciones] = useState<Record<string, string[]>>({});

  // Sort (chk4.7e)
  const [sortValue, setSortValue] = useState<string>('stock_desc');

  // Modales
  const [unidadSeleccionada, setUnidadSeleccionada] = useState<Unidad | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [resultadoSync, setResultadoSync] = useState<any>(null);
  const [showVencidasModal, setShowVencidasModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showPromocionModal, setShowPromocionModal] = useState(false);
  const [productoPromocion, setProductoPromocion] = useState<{
    producto: any;
    unidades: any[];
    valorOriginal: number;
    diasParaVencer?: number;
  } | null>(null);

  useEffect(() => {
    fetchUnidades();
    fetchStats();
    fetchProductos();
    fetchAlmacenes();
    fetchCTRU();
    fetchLineas();
  }, [fetchUnidades, fetchStats, fetchProductos, fetchAlmacenes, fetchCTRU, fetchLineas]);

  // ==================== STATS DERIVADOS ====================

  const inventarioStats = useMemo(() => {
    let enOrigen = 0;
    let enTransitoOrigen = 0;
    let enTransitoPeru = 0;
    let disponiblePeru = 0;
    let reservada = 0;
    let reservadaOrigen = 0;
    let reservadaPeru = 0;
    let problemas = 0;
    let total = 0;
    let vendida = 0;
    let valorTotalUSD = 0;
    let proximasAVencer = 0;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const lineasSel = selecciones.linea ?? [];
    const paisesSel = selecciones.pais ?? [];
    const ubicacionesSel = selecciones.ubicacion ?? [];

    unidadesPorLinea.forEach(u => {
      if (lineasSel.length > 0 && !lineasSel.includes(u.lineaNegocioId ?? '')) return;
      if (paisesSel.length > 0 && !paisesSel.includes(u.pais ?? '')) return;
      if (ubicacionesSel.length > 0 && !ubicacionesSel.includes(u.casillaActualId || u.almacenId || '')) return;

      if (u.estado === 'vendida') {
        vendida++;
        return;
      }

      total++;
      valorTotalUSD += u.costoUnitarioUSD;

      if (u.estado === 'pedida') {
        enOrigen++;
      } else if (esEstadoEnOrigen(u.estado)) {
        enOrigen++;
      } else if (u.estado === 'en_transito' || esEstadoEnTransitoOrigen(u.estado)) {
        enTransitoOrigen++;
      } else if (u.estado === 'en_transito_peru') {
        enTransitoPeru++;
      } else if (u.estado === 'disponible' || u.estado === 'disponible_peru') {
        disponiblePeru++;
      } else if (u.estado === 'reservada') {
        reservada++;
        if (u.pais !== 'Peru') reservadaOrigen++;
        else reservadaPeru++;
      } else if (u.estado === 'asignada_venta' || u.estado === 'asignada_pedido') {
        reservada++;
        reservadaPeru++;
      } else if (u.estado === 'vencida' || u.estado === 'danada' || u.estado === 'perdida' || u.estado === 'retenida_aduana') {
        problemas++;
      }

      if (u.fechaVencimiento?.toDate) {
        const vencimiento = u.fechaVencimiento.toDate();
        vencimiento.setHours(0, 0, 0, 0);
        const diffDias = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDias >= 0 && diffDias <= 30) {
          proximasAVencer++;
        }
      }
    });

    const enTransito = enTransitoOrigen + enTransitoPeru;

    return {
      enOrigen,
      enTransitoOrigen,
      enTransitoPeru,
      enTransito,
      disponiblePeru,
      reservada,
      reservadaOrigen,
      reservadaPeru,
      problemas,
      total,
      vendida,
      valorTotalUSD,
      proximasAVencer,
    };
  }, [unidadesPorLinea, selecciones]);

  // KPI derivado para el strip
  const pctDisponiblesPeru = inventarioStats.total > 0
    ? Math.round((inventarioStats.disponiblePeru / inventarioStats.total) * 100)
    : 0;

  // ==================== AGRUPACIÓN POR PRODUCTO ====================

  const productosConUnidades = useMemo((): ProductoConUnidades[] => {
    const grupos: Record<string, ProductoConUnidades> = {};

    const vendidasPorProducto: Record<string, number> = {};
    unidadesPorLinea.filter(u => u.estado === 'vendida').forEach(u => {
      vendidasPorProducto[u.productoId] = (vendidasPorProducto[u.productoId] || 0) + 1;
    });

    const lineasSel = selecciones.linea ?? [];
    const paisesSel = selecciones.pais ?? [];
    const ubicacionesSel = selecciones.ubicacion ?? [];

    let unidadesActivas = unidadesPorLinea.filter(u => u.estado !== 'vendida');
    if (lineasSel.length > 0) {
      unidadesActivas = unidadesActivas.filter(u => lineasSel.includes(u.lineaNegocioId ?? ''));
    }
    if (paisesSel.length > 0) {
      unidadesActivas = unidadesActivas.filter(u => paisesSel.includes(u.pais ?? ''));
    }
    if (ubicacionesSel.length > 0) {
      unidadesActivas = unidadesActivas.filter(u => ubicacionesSel.includes(u.casillaActualId || u.almacenId || ''));
    }

    unidadesActivas.forEach(unidad => {
      if (!grupos[unidad.productoId]) {
        grupos[unidad.productoId] = {
          productoId: unidad.productoId,
          sku: unidad.productoSKU,
          nombre: unidad.productoNombre,
          marca: '',
          grupo: '',
          unidades: [],
          enOrigen: 0,
          enTransitoOrigen: 0,
          enTransitoPeru: 0,
          disponiblePeru: 0,
          reservada: 0,
          reservadaOrigen: 0,
          reservadaPeru: 0,
          vendida: 0,
          problemas: 0,
          totalUnidades: 0,
          totalDisponibles: 0,
          valorTotalUSD: 0,
          costoPromedioUSD: 0,
          proximasAVencer30Dias: 0,
          stockCritico: false,
        };
      }

      const grupo = grupos[unidad.productoId];
      grupo.unidades.push(unidad);
      grupo.totalUnidades++;
      grupo.valorTotalUSD += unidad.costoUnitarioUSD;

      if (esEstadoEnOrigen(unidad.estado)) {
        grupo.enOrigen++;
        grupo.totalDisponibles++;
      } else if (esEstadoEnTransitoOrigen(unidad.estado)) {
        grupo.enTransitoOrigen++;
      } else if (unidad.estado === 'en_transito_peru') {
        grupo.enTransitoPeru++;
      } else if (unidad.estado === 'disponible_peru') {
        grupo.disponiblePeru++;
        grupo.totalDisponibles++;
      } else if (unidad.estado === 'reservada') {
        grupo.reservada++;
        if (unidad.pais !== 'Peru') grupo.reservadaOrigen++;
        else grupo.reservadaPeru++;
      } else if (unidad.estado === 'vencida' || unidad.estado === 'danada') {
        grupo.problemas++;
      }

      if (unidad.fechaVencimiento && typeof unidad.fechaVencimiento.toDate === 'function') {
        const diffDias = calcularDiasParaVencer(unidad.fechaVencimiento);
        if (diffDias !== null && diffDias >= 0 && diffDias <= 30) {
          grupo.proximasAVencer30Dias++;
        }
      }
    });

    Object.entries(vendidasPorProducto).forEach(([productoId, cantVendidas]) => {
      if (!grupos[productoId]) {
        const producto = productos.find(p => p.id === productoId);
        if (producto) {
          grupos[productoId] = {
            productoId,
            sku: producto.sku,
            nombre: producto.nombreComercial,
            marca: producto.marca,
            grupo: producto.grupo,
            unidades: [],
            enOrigen: 0, enTransitoOrigen: 0, enTransitoPeru: 0,
            disponiblePeru: 0, reservada: 0, reservadaOrigen: 0, reservadaPeru: 0,
            vendida: cantVendidas,
            problemas: 0,
            totalUnidades: 0,
            totalDisponibles: 0,
            valorTotalUSD: 0,
            costoPromedioUSD: 0,
            proximasAVencer30Dias: 0,
            stockCritico: false,
          };
        }
      }
    });

    Object.values(grupos).forEach(grupo => {
      const producto = productos.find(p => p.id === grupo.productoId);
      if (producto) {
        grupo.marca = producto.marca;
        grupo.grupo = producto.grupo;
        grupo.presentacion = producto.presentacion;
        grupo.contenido = producto.contenido;
        grupo.dosaje = producto.dosaje;
        grupo.sabor = producto.sabor;
        grupo.lineaNegocioId = producto.lineaNegocioId;
        grupo.stockCritico = producto.stockMinimo !== undefined &&
          grupo.totalDisponibles <= producto.stockMinimo;
      }
      grupo.vendida = vendidasPorProducto[grupo.productoId] || 0;
      grupo.costoPromedioUSD = grupo.totalUnidades > 0
        ? grupo.valorTotalUSD / grupo.totalUnidades
        : 0;
    });

    return Object.values(grupos).sort((a, b) => (a.sku ?? '').localeCompare(b.sku ?? ''));
  }, [unidadesPorLinea, productos, selecciones]);

  // ==================== PILL COUNTS (chk4.7c) ====================

  const pillCounts = useMemo(() => ({
    todos: productosConUnidades.length,
    disponibles: productosConUnidades.filter(p => p.disponiblePeru > 0).length,
    stock_critico: productosConUnidades.filter(p => p.stockCritico).length,
    vencen_pronto: productosConUnidades.filter(p => p.proximasAVencer30Dias > 0).length,
    en_transito: productosConUnidades.filter(
      p => p.enTransitoOrigen > 0 || p.enTransitoPeru > 0
    ).length,
  }), [productosConUnidades]);

  // ==================== FILTRADO + SORT ====================

  const productosFiltrados = useMemo(() => {
    let resultado = productosConUnidades;

    // Pill rápido
    if (pillActivo !== 'todos') {
      resultado = resultado.filter(p => {
        switch (pillActivo) {
          case 'disponibles': return p.disponiblePeru > 0;
          case 'stock_critico': return p.stockCritico;
          case 'vencen_pronto': return p.proximasAVencer30Dias > 0;
          case 'en_transito': return p.enTransitoOrigen > 0 || p.enTransitoPeru > 0;
          default: return true;
        }
      });
    }

    // Estado pipeline legacy (compatible)
    if (filtroEstado) {
      resultado = resultado.filter(p => {
        switch (filtroEstado) {
          case 'en_origen': return p.enOrigen > 0;
          case 'en_transito':
          case 'en_transito_peru': return p.enTransitoOrigen > 0 || p.enTransitoPeru > 0;
          case 'disponible_peru': return p.disponiblePeru > 0;
          case 'reservada': return p.reservada > 0;
          case 'vendida': return p.vendida > 0;
          case 'problemas': return p.problemas > 0;
          default: return true;
        }
      });
    }

    // Búsqueda
    if (busqueda.trim()) {
      const termino = busqueda.toLowerCase();
      resultado = resultado.filter(p => {
        const sku = (p.sku ?? '').toLowerCase();
        const nombre = (p.nombre ?? '').toLowerCase();
        const marca = (p.marca ?? '').toLowerCase();
        return sku.includes(termino) || nombre.includes(termino) || marca.includes(termino);
      });
    }

    // Sort (chk4.7e)
    const sorted = [...resultado];
    switch (sortValue) {
      case 'stock_desc':
        sorted.sort((a, b) => b.totalUnidades - a.totalUnidades); break;
      case 'stock_asc':
        sorted.sort((a, b) => a.totalUnidades - b.totalUnidades); break;
      case 'valor_desc':
        sorted.sort((a, b) => b.valorTotalUSD - a.valorTotalUSD); break;
      case 'vencen_asc':
        sorted.sort((a, b) => b.proximasAVencer30Dias - a.proximasAVencer30Dias); break;
      case 'sku_asc':
        sorted.sort((a, b) => (a.sku ?? '').localeCompare(b.sku ?? '')); break;
      case 'nombre_asc':
        sorted.sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '')); break;
      default:
        break;
    }
    return sorted;
  }, [productosConUnidades, pillActivo, filtroEstado, busqueda, sortValue]);

  // ==================== ALERTAS (para badge en tab Atención) ====================

  const alertasPrioritarias = useMemo((): AlertaProducto[] => {
    const alertas: AlertaProducto[] = [];

    productosConUnidades.forEach(producto => {
      if (producto.proximasAVencer30Dias > 0) {
        let menorDias = 999;
        producto.unidades.forEach(u => {
          if (u.fechaVencimiento && u.estado !== 'vendida') {
            const dias = calcularDiasParaVencer(u.fechaVencimiento);
            if (dias !== null && dias < menorDias && dias >= 0) menorDias = dias;
          }
        });

        alertas.push({
          producto,
          tipo: 'vencimiento',
          prioridad: menorDias <= 7 ? 'alta' : menorDias <= 15 ? 'media' : 'baja',
          diasRestantes: menorDias,
          unidadesAfectadas: producto.proximasAVencer30Dias,
          mensaje: menorDias <= 7
            ? `¡Vence en ${menorDias} días! Considerar promoción urgente`
            : `Vencimiento próximo en ${menorDias} días`,
        });
      }

      if (producto.stockCritico) {
        alertas.push({
          producto,
          tipo: 'stock_critico',
          prioridad: producto.totalDisponibles === 0 ? 'alta' : 'media',
          unidadesAfectadas: producto.totalDisponibles,
          mensaje: producto.totalDisponibles === 0
            ? 'Sin stock disponible. Reordenar urgente'
            : `Stock bajo: ${producto.totalDisponibles} unidades disponibles`,
        });
      }
    });

    return alertas.sort((a, b) => {
      const prioridadOrder = { alta: 0, media: 1, baja: 2 };
      return prioridadOrder[a.prioridad] - prioridadOrder[b.prioridad];
    });
  }, [productosConUnidades]);

  // ==================== CHIP GROUPS PARA FILTROSBAR (chk4.7d) ====================

  const chipGroups: ChipGroupConfig[] = useMemo(() => {
    // Contar productos por línea de negocio
    const byLinea = new Map<string, number>();
    productosConUnidades.forEach(p => {
      const lid = p.lineaNegocioId ?? 'sin-linea';
      byLinea.set(lid, (byLinea.get(lid) ?? 0) + 1);
    });

    // Contar productos por país (basado en sus unidades)
    const productosPorPais: Record<string, Set<string>> = { USA: new Set(), Peru: new Set() };
    unidadesPorLinea.forEach(u => {
      const p = u.pais;
      if (p && productosPorPais[p]) productosPorPais[p].add(u.productoId);
    });

    return [
      {
        key: 'linea',
        label: 'Línea',
        multi: true,
        options: lineasNegocio.map(ln => ({
          value: ln.id,
          label: ln.nombre,
          count: byLinea.get(ln.id) ?? 0,
          variant: ln.id.toLowerCase().includes('skin') ? 'amber' :
                   ln.id.toLowerCase().includes('supl') ? 'indigo' : 'slate',
        })),
      },
      {
        key: 'pais',
        label: 'País',
        multi: true,
        options: [
          { value: 'USA', label: 'USA', count: productosPorPais.USA.size, variant: 'sky' },
          { value: 'Peru', label: 'Perú', count: productosPorPais.Peru.size, variant: 'emerald' },
        ],
      },
      {
        key: 'ubicacion',
        label: 'Ubicación',
        multi: true,
        options: almacenes.map(a => ({
          value: a.id,
          label: a.nombre,
          variant: 'slate' as const,
        })),
      },
    ];
  }, [lineasNegocio, productosConUnidades, almacenes, unidadesPorLinea]);

  const sortOptions: SortOption[] = useMemo(() => [
    { value: 'stock_desc',  label: 'Mayor stock' },
    { value: 'stock_asc',   label: 'Menor stock' },
    { value: 'valor_desc',  label: 'Mayor valor USD' },
    { value: 'vencen_asc',  label: 'Por vencer primero' },
    { value: 'sku_asc',     label: 'SKU A-Z' },
    { value: 'nombre_asc',  label: 'Nombre A-Z' },
  ], []);

  const hayFiltrosActivos = useMemo(() => {
    if (Object.values(selecciones).some(v => v.length > 0)) return true;
    if (busqueda.trim().length > 0) return true;
    if (pillActivo !== 'todos') return true;
    return false;
  }, [selecciones, busqueda, pillActivo]);

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

  const handleLimpiarTodo = () => {
    setSelecciones({});
    setBusqueda('');
    setPillActivo('todos');
    setFiltroEstado(null);
  };

  // ==================== TABS CANÓNICOS (4) ====================

  const tabs: Tab[] = useMemo(() => [
    { id: 'inventario', label: 'Inventario', icon: <Package className="h-4 w-4" /> },
    { id: 'mapa', label: 'Mapa', icon: <MapPin className="h-4 w-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
    {
      id: 'atencion',
      label: 'Atención',
      icon: <Bell className="h-4 w-4" />,
      badge: alertasPrioritarias.length > 0 ? alertasPrioritarias.length : undefined,
    },
  ], [alertasPrioritarias.length]);

  // ==================== HANDLERS ====================

  const handleSincronizarCompleto = async () => {
    setSincronizando(true);
    try {
      const resultado = await inventarioService.sincronizacionCompleta();
      setResultadoSync(resultado);
      setShowSyncModal(true);
      fetchUnidades();
      fetchStats();
    } catch (error: any) {
      console.error('Error sincronizando:', error);
      toast.error('Error al sincronizar: ' + error.message);
    } finally {
      setSincronizando(false);
    }
  };

  const handleExportar = () => {
    const dataExport = unidades.map(u => ({
      SKU: u.productoSKU,
      Producto: u.productoNombre,
      Lote: u.lote,
      Estado: u.estado,
      Almacen: u.almacenNombre,
      Pais: u.pais,
      CostoUSD: u.costoUnitarioUSD,
      FechaVencimiento: u.fechaVencimiento?.toDate?.()?.toLocaleDateString() || '-',
      OrdenCompra: u.ordenCompraNumero,
    }));
    exportService.downloadExcel(dataExport, 'Inventario_Unidades');
  };

  const handleVerProducto = (_productoId: string) => {
    setTabActivo('inventario');
    setModoInventario('stock');
    setVistaActual('tabla');
  };

  const handlePromocionar = (productoId: string) => {
    const productoConUnidades = productosConUnidades.find(p => p.productoId === productoId);
    if (!productoConUnidades) return;

    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;

    const unidadesPorVencer = productoConUnidades.unidades.filter(u => {
      if (!u.fechaVencimiento?.toDate) return false;
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const vencimiento = u.fechaVencimiento.toDate();
      vencimiento.setHours(0, 0, 0, 0);
      const diffDias = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      return diffDias >= 0 && diffDias <= 60;
    });

    let diasMinimos: number | undefined;
    if (unidadesPorVencer.length > 0) {
      diasMinimos = Math.min(
        ...unidadesPorVencer.map(u => {
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          const vencimiento = u.fechaVencimiento.toDate();
          vencimiento.setHours(0, 0, 0, 0);
          return Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        })
      );
    }

    const valorOriginal = unidadesPorVencer.length > 0
      ? unidadesPorVencer.reduce((sum, u) => sum + u.costoUnitarioUSD, 0)
      : productoConUnidades.valorTotalUSD;

    setProductoPromocion({
      producto,
      unidades: unidadesPorVencer.length > 0 ? unidadesPorVencer : productoConUnidades.unidades,
      valorOriginal,
      diasParaVencer: diasMinimos,
    });
    setShowPromocionModal(true);
  };

  const handleCrearPromocion = (promocion: PromocionData) => {
    toast.success(`Promocion creada: ${promocion.porcentajeDescuento}% de descuento para ${productoPromocion?.producto?.sku}`);
    setShowPromocionModal(false);
    setProductoPromocion(null);
  };

  // ==================== EARLY RETURN: SKELETON ====================

  if (unidadesLoading && unidades.length === 0) {
    return <InventarioSkeleton />;
  }

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* Header banking-grade canónico */}
      <HeaderV2
        parentCrumb="Logística"
        currentCrumb="Stock · Inventario operativo"
        titulo="Stock"
        subtitulo="Qué tengo, dónde está, en qué estado · vista operativa de existencias en tiempo real (productos, lotes, vencimientos, reservas)."
        sincronizando={sincronizando}
        onSincronizar={handleSincronizarCompleto}
        onExportar={handleExportar}
        exportarDisabled={unidades.length === 0}
      />

      {/* KPI strip canónico (5 KPIs) */}
      <KpiStripV2
        stats={{
          total: inventarioStats.total,
          productos: productosConUnidades.length,
          disponiblePeru: inventarioStats.disponiblePeru,
          pctDisponiblesPeru,
          reservada: inventarioStats.reservada,
          reservadaOrigen: inventarioStats.reservadaOrigen,
          reservadaPeru: inventarioStats.reservadaPeru,
          enTransito: inventarioStats.enTransito,
          proximasAVencer: inventarioStats.proximasAVencer,
        }}
      />

      {/* Banner amber alertas inmediatas (chk4.7a) */}
      <AlertasBanner
        alertas={alertasPrioritarias}
        onIrAtencion={() => setTabActivo('atencion')}
      />

      {/* Tabs canónicos (4) */}
      <Tabs
        tabs={tabs}
        activeTab={tabActivo}
        onChange={(tabId) => setTabActivo(tabId as TabInventarioV2)}
        variant="pills"
        size="md"
      />

      {/* ==================== TAB: INVENTARIO ==================== */}
      {tabActivo === 'inventario' && (
        <>
          {/* SegmentedControl Stock|Unidades + helper text inline (chk4.7b) */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <SegmentedControl<ModoInventario>
              options={[
                { value: 'stock',    label: 'Stock',    icon: Package, count: productosConUnidades.length },
                { value: 'unidades', label: 'Unidades', icon: Boxes,   count: unidades.length },
              ]}
              value={modoInventario}
              onChange={setModoInventario}
            />
            <p className="text-xs text-slate-500 hidden md:block">
              <span className="font-medium text-slate-600">Stock</span> = vista agregada por producto ·{' '}
              <span className="font-medium text-slate-600">Unidades</span> = vista granular por lote y vencimiento (FEFO)
            </p>
          </div>

          {modoInventario === 'stock' ? (
            <>
              {/* Pills rápidos canónicos (chk4.7c) */}
              <InventarioPills
                counts={pillCounts}
                active={pillActivo}
                onChange={setPillActivo}
              />

              {/* FiltrosBar componible (chk4.7d + chk4.7e) */}
              <FiltrosBar
                chipGroups={chipGroups}
                selecciones={selecciones}
                onChipToggle={handleChipToggle}
                searchTerm={busqueda}
                searchPlaceholder="Buscar por SKU, nombre, marca o lote..."
                onSearchChange={setBusqueda}
                sortValue={sortValue}
                sortOptions={sortOptions}
                onSortChange={setSortValue}
                hayFiltrosActivos={hayFiltrosActivos}
                onLimpiarTodo={handleLimpiarTodo}
              />

              {vistaActual === 'cards' ? (
                /* Cards apiladas (canon F4 + paleta mockup X chk4.8) */
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <StockListHeader total={productosFiltrados.length} />
                  <div className="divide-y divide-slate-100">
                    {productosFiltrados.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <Package className="mx-auto h-12 w-12 text-slate-400" />
                        <h3 className="mt-2 text-sm font-medium text-slate-900">
                          No hay productos en inventario
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Las unidades se crean automáticamente al recibir órdenes de compra
                        </p>
                      </div>
                    ) : (
                      productosFiltrados.map((producto) => {
                        const lineaCodigo = lineasNegocio.find(
                          ln => ln.id === producto.lineaNegocioId
                        )?.codigo;
                        const productoOriginal = productos.find(p => p.id === producto.productoId);
                        const esPack = !!productoOriginal?.esPack;
                        const packCount = productoOriginal?.componentesPack?.length;
                        return (
                          <StockProductoCard
                            key={producto.productoId}
                            producto={producto}
                            lineaCodigo={lineaCodigo}
                            esPack={esPack}
                            packCount={packCount}
                            onVerDetalle={() => setVistaActual('tabla')}
                            onCrearPromocion={() => handlePromocionar(producto.productoId)}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <Card padding="md">
                  <ProductoInventarioTable
                    productos={productosFiltrados}
                    loading={unidadesLoading}
                    onUnidadClick={setUnidadSeleccionada}
                    filtroEstado={filtroEstado}
                  />
                </Card>
              )}
            </>
          ) : (
            // Modo "Unidades" · vista FEFO de unidades individuales (chk4.4 · fusión)
            <UnidadesListView />
          )}
        </>
      )}

      {/* ==================== TAB: MAPA ==================== */}
      {tabActivo === 'mapa' && <MapaTab />}

      {/* ==================== TAB: ANALYTICS ==================== */}
      {tabActivo === 'analytics' && (
        <InventarioAnalytics
          unidades={unidades}
          productos={productos}
          almacenes={almacenes}
          ctruData={ctruData}
        />
      )}

      {/* ==================== TAB: ATENCIÓN (fusión Alertas + Incidencias) ==================== */}
      {tabActivo === 'atencion' && (
        <AtencionTab
          unidades={unidades}
          productos={productos}
          onVerProducto={handleVerProducto}
          onPromocionar={handlePromocionar}
          onOpenVencidasModal={() => setShowVencidasModal(true)}
          onRefresh={() => { fetchUnidades(); fetchProductos(); }}
        />
      )}

      {/* ==================== MODALES GLOBALES ==================== */}

      {showVencidasModal && (
        <GestionVencidasModal
          onClose={() => setShowVencidasModal(false)}
          onSuccess={() => {
            setShowVencidasModal(false);
            fetchUnidades();
            fetchProductos();
            toast.success('Unidades vencidas procesadas correctamente');
          }}
        />
      )}

      {unidadSeleccionada && (
        <UnidadDetailsModal
          unidad={unidadSeleccionada}
          productoInfo={(() => {
            const p = productos.find(pr => pr.id === unidadSeleccionada.productoId);
            return p ? {
              presentacion: p.presentacion,
              contenido: p.contenido,
              dosaje: p.dosaje,
              sabor: p.sabor,
              atributosSkincare: p.atributosSkincare,
            } : undefined;
          })()}
          onClose={() => setUnidadSeleccionada(null)}
        />
      )}

      <Modal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        title="Sincronización Completa"
        size="lg"
      >
        <div className="space-y-4">
          {resultadoSync && (
            <>
              <div>
                <h4 className="font-medium text-slate-900 mb-2">Estados de Unidades</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-slate-900 tabular-nums">
                      {resultadoSync.estadosUnidades?.unidadesRevisadas || 0}
                    </div>
                    <div className="text-xs text-slate-500">Revisadas</div>
                  </div>
                  <div className="bg-teal-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-teal-600 tabular-nums">
                      {resultadoSync.estadosUnidades?.correccionesRealizadas || 0}
                    </div>
                    <div className="text-xs text-teal-700">Corregidas</div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-emerald-600 tabular-nums">
                      {resultadoSync.estadosUnidades?.reservasLiberadas || 0}
                    </div>
                    <div className="text-xs text-emerald-700">Reservas Lib.</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-slate-900 mb-2">Stock de Productos</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-slate-900 tabular-nums">
                      {resultadoSync.stockProductos?.productosRevisados || 0}
                    </div>
                    <div className="text-xs text-slate-500">Revisados</div>
                  </div>
                  <div className="bg-teal-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-teal-600 tabular-nums">
                      {resultadoSync.stockProductos?.productosActualizados || 0}
                    </div>
                    <div className="text-xs text-teal-700">Actualizados</div>
                  </div>
                  <div className="bg-sky-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-sky-600 tabular-nums">
                      {resultadoSync.ctruActualizados || 0}
                    </div>
                    <div className="text-xs text-sky-700">CTRU Actualiz.</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-red-600 tabular-nums">
                      {resultadoSync.errores || 0}
                    </div>
                    <div className="text-xs text-red-700">Errores</div>
                  </div>
                </div>
              </div>

              {(resultadoSync.estadosUnidades?.correccionesRealizadas === 0 &&
               resultadoSync.stockProductos?.productosActualizados === 0) ? (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-lg">
                  <CheckCircle className="h-5 w-5" />
                  <span>Todo sincronizado correctamente. No se encontraron inconsistencias.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-teal-600 bg-teal-50 p-3 rounded-lg">
                  <CheckCircle className="h-5 w-5" />
                  <span>
                    Sincronización completada. Se corrigieron {resultadoSync.estadosUnidades?.correccionesRealizadas || 0} unidades
                    y {resultadoSync.stockProductos?.productosActualizados || 0} productos.
                  </span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setShowSyncModal(false)}>Cerrar</Button>
          </div>
        </div>
      </Modal>

      <PromocionModal
        isOpen={showPromocionModal}
        onClose={() => {
          setShowPromocionModal(false);
          setProductoPromocion(null);
        }}
        producto={productoPromocion?.producto}
        unidadesAfectadas={productoPromocion?.unidades}
        valorOriginal={productoPromocion?.valorOriginal || 0}
        diasParaVencer={productoPromocion?.diasParaVencer}
        onCrearPromocion={handleCrearPromocion}
      />
    </div>
  );
};
