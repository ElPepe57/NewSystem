import { create } from 'zustand';
import { productoIntelService } from '../services/productoIntel.service';
import type {
  ProductoIntel,
  ResumenCaja,
  FlujoCajaProyectado,
  SugerenciaReposicion,
  MetricasLeadTime
} from '../types/productoIntel.types';

interface ProductoIntelState {
  // Data
  productosIntel: ProductoIntel[];
  resumenCaja: ResumenCaja | null;
  flujoCaja: FlujoCajaProyectado | null;
  sugerenciasReposicion: SugerenciaReposicion[];
  leadTimeGlobal: MetricasLeadTime | null;

  // UI State
  loading: boolean;
  error: string | null;
  ultimaActualizacion: Date | null;

  // Filtros
  // Filtros por categoría de caja (nuevo sistema de 4 categorías)
  // 'activa' = stock disponible con buena liquidez
  // 'comprometida' = stock reservado
  // 'transito' = stock en tránsito
  // 'congelada' = baja + critica (stock sin movimiento)
  filtroLiquidez: 'todos' | 'alta' | 'media' | 'baja' | 'critica' | 'congelada' | 'activa' | 'comprometida' | 'transito';
  filtroRotacion: 'todos' | 'muy_alta' | 'alta' | 'media' | 'baja' | 'muy_baja' | 'sin_movimiento';
  ordenarPor: 'score' | 'rotacion' | 'margen' | 'stock' | 'nombre';
  ordenAscendente: boolean;

  // Actions
  cargarDatos: (tc?: number) => Promise<void>;
  setFiltroLiquidez: (filtro: ProductoIntelState['filtroLiquidez']) => void;
  setFiltroRotacion: (filtro: ProductoIntelState['filtroRotacion']) => void;
  setOrdenarPor: (campo: ProductoIntelState['ordenarPor']) => void;
  toggleOrden: () => void;

  // Getters computados
  getProductosFiltrados: () => ProductoIntel[];
  getProductoById: (id: string) => ProductoIntel | undefined;
  getTopProductosLiquidez: (n: number) => ProductoIntel[];
  getProductosSinMovimiento: () => ProductoIntel[];
  getAlertasCriticas: () => { producto: ProductoIntel; alerta: ProductoIntel['alertas'][0] }[];
}

export const useProductoIntelStore = create<ProductoIntelState>((set, get) => ({
  // Initial state
  productosIntel: [],
  resumenCaja: null,
  flujoCaja: null,
  sugerenciasReposicion: [],
  leadTimeGlobal: null,
  loading: false,
  error: null,
  ultimaActualizacion: null,
  filtroLiquidez: 'todos',
  filtroRotacion: 'todos',
  ordenarPor: 'score',
  ordenAscendente: false,

  // Actions
  cargarDatos: async (tc?: number) => {
    set({ loading: true, error: null });
    // Si no se provee TC, resolver del servicio centralizado
    if (!tc) {
      const { tipoCambioService } = await import('../services/tipoCambio.service');
      tc = await tipoCambioService.resolverTCVenta();
    }

    try {
      // Cargar analisis de todos los productos
      const productosIntel = await productoIntelService.analizarTodosProductos(tc);

      // Cargar preventas virtuales (Fase 3)
      const preventasVirtuales = await productoIntelService.getPreventasVirtuales();

      // Generar resumen de caja CON preventas virtuales
      const resumenCaja = productoIntelService.generarResumenCaja(productosIntel, preventasVirtuales);

      // Generar flujo de caja proyectado
      const flujoCaja = await productoIntelService.generarFlujoCajaProyectado(productosIntel, tc);

      // Generar sugerencias de reposicion
      const sugerenciasReposicion = productoIntelService.generarSugerenciasReposicion(productosIntel, tc);

      // Calcular lead time global
      const leadTimeGlobal = await productoIntelService.calcularLeadTimeGlobal();

      set({
        productosIntel,
        resumenCaja,
        flujoCaja,
        sugerenciasReposicion,
        leadTimeGlobal,
        loading: false,
        ultimaActualizacion: new Date()
      });
    } catch (error: any) {
      console.error('Error al cargar datos de inteligencia:', error);
      set({
        loading: false,
        error: error.message || 'Error al cargar datos'
      });
    }
  },

  setFiltroLiquidez: (filtro) => set({ filtroLiquidez: filtro }),
  setFiltroRotacion: (filtro) => set({ filtroRotacion: filtro }),
  setOrdenarPor: (campo) => set({ ordenarPor: campo }),
  toggleOrden: () => set((state) => ({ ordenAscendente: !state.ordenAscendente })),

  // Getters
  getProductosFiltrados: () => {
    const { productosIntel, filtroLiquidez, filtroRotacion, ordenarPor, ordenAscendente } = get();

    let filtrados = [...productosIntel];

    // Filtrar por liquidez/categoría de caja
    if (filtroLiquidez !== 'todos') {
      switch (filtroLiquidez) {
        case 'congelada':
          // Caja Congelada: baja + critica liquidez Y stock disponible > 0
          filtrados = filtrados.filter(p =>
            (p.liquidez.clasificacion === 'baja' || p.liquidez.clasificacion === 'critica') &&
            p.rotacion.stockDisponible > 0
          );
          break;
        case 'activa':
          // Caja Activa: alta o media liquidez Y stock disponible > 0
          filtrados = filtrados.filter(p =>
            (p.liquidez.clasificacion === 'alta' || p.liquidez.clasificacion === 'media') &&
            p.rotacion.stockDisponible > 0
          );
          break;
        case 'comprometida':
          // Caja Comprometida: stock reservado > 0
          filtrados = filtrados.filter(p => p.rotacion.stockReservado > 0);
          break;
        case 'transito':
          // Caja en Tránsito: stock en tránsito > 0
          filtrados = filtrados.filter(p => p.rotacion.stockTransito > 0);
          break;
        default:
          // Filtros legacy por clasificación de liquidez directa
          filtrados = filtrados.filter(p => p.liquidez.clasificacion === filtroLiquidez);
      }
    }

    // Filtrar por rotacion
    if (filtroRotacion !== 'todos') {
      filtrados = filtrados.filter(p => p.rotacion.clasificacionRotacion === filtroRotacion);
    }

    // Ordenar
    filtrados.sort((a, b) => {
      let valorA: number, valorB: number;

      switch (ordenarPor) {
        case 'score':
          valorA = a.liquidez.score;
          valorB = b.liquidez.score;
          break;
        case 'rotacion':
          valorA = a.rotacion.rotacionDias;
          valorB = b.rotacion.rotacionDias;
          break;
        case 'margen':
          valorA = a.rentabilidad.margenBrutoPromedio;
          valorB = b.rentabilidad.margenBrutoPromedio;
          break;
        case 'stock':
          valorA = a.rotacion.stockTotal;
          valorB = b.rotacion.stockTotal;
          break;
        case 'nombre':
          return ordenAscendente
            ? a.nombreComercial.localeCompare(b.nombreComercial)
            : b.nombreComercial.localeCompare(a.nombreComercial);
        default:
          valorA = a.liquidez.score;
          valorB = b.liquidez.score;
      }

      return ordenAscendente ? valorA - valorB : valorB - valorA;
    });

    return filtrados;
  },

  getProductoById: (id) => {
    return get().productosIntel.find(p => p.productoId === id);
  },

  getTopProductosLiquidez: (n) => {
    const { productosIntel } = get();
    return [...productosIntel]
      .sort((a, b) => b.liquidez.score - a.liquidez.score)
      .slice(0, n);
  },

  getProductosSinMovimiento: () => {
    return get().productosIntel.filter(p =>
      p.rotacion.clasificacionRotacion === 'sin_movimiento' &&
      p.rotacion.stockTotal > 0
    );
  },

  getAlertasCriticas: () => {
    const alertas: { producto: ProductoIntel; alerta: ProductoIntel['alertas'][0] }[] = [];

    for (const producto of get().productosIntel) {
      for (const alerta of producto.alertas) {
        if (alerta.severidad === 'danger') {
          alertas.push({ producto, alerta });
        }
      }
    }

    return alertas;
  }
}));
