import { create } from 'zustand';
import type {
  Cotizacion,
  CotizacionFormData,
  EstadoCotizacion,
  ComprometerAdelantoData,
  RegistrarAdelantoData,
  RechazarCotizacionData,
  CotizacionStats,
  CotizacionFilters
} from '../types/cotizacion.types';
import type {
  TipoReserva,
  ProductoReservado,
  ProductoStockVirtual
} from '../types/venta.types';
import { CotizacionService } from '../services/cotizacion.service';

interface CotizacionState {
  cotizaciones: Cotizacion[];
  stats: CotizacionStats | null;
  analisisDemanda: {
    productosMasCotizados: Array<{
      productoId: string;
      nombreProducto: string;
      vecesCotizado: number;
      vecesConfirmado: number;
      tasaConversion: number;
      montoTotalCotizado: number;
    }>;
    tendenciaMensual: Array<{
      mes: string;
      cotizaciones: number;
      confirmadas: number;
      rechazadas: number;
      montoTotal: number;
    }>;
  } | null;
  loading: boolean;
  error: string | null;
  selectedCotizacion: Cotizacion | null;

  // Actions - CRUD
  fetchCotizaciones: () => Promise<void>;
  fetchCotizacionById: (id: string) => Promise<void>;
  fetchCotizacionesByEstado: (estado: EstadoCotizacion | EstadoCotizacion[]) => Promise<void>;
  fetchCotizacionesWithFilters: (filters: CotizacionFilters) => Promise<void>;
  createCotizacion: (data: CotizacionFormData, userId: string) => Promise<string>;
  updateCotizacion: (id: string, data: Partial<CotizacionFormData>, userId: string) => Promise<void>;
  deleteCotizacion: (id: string) => Promise<void>;
  setSelectedCotizacion: (cotizacion: Cotizacion | null) => void;

  // Actions - Flujo
  validarCotizacion: (id: string, userId: string) => Promise<void>;
  revertirValidacion: (id: string, userId: string) => Promise<void>;

  // Nuevo flujo de adelanto (2 pasos)
  comprometerAdelanto: (id: string, data: ComprometerAdelantoData, userId: string) => Promise<void>;
  registrarPagoAdelanto: (
    id: string,
    data: RegistrarAdelantoData,
    userId: string
  ) => Promise<{
    tipoReserva: TipoReserva;
    productosReservados: ProductoReservado[];
    productosVirtuales?: ProductoStockVirtual[];
  }>;

  // @deprecated - Usar comprometerAdelanto + registrarPagoAdelanto
  registrarAdelanto: (
    id: string,
    data: RegistrarAdelantoData,
    userId: string
  ) => Promise<{
    tipoReserva: TipoReserva;
    productosReservados: ProductoReservado[];
    productosVirtuales?: ProductoStockVirtual[];
  }>;

  confirmarCotizacion: (id: string, userId: string) => Promise<{ ventaId: string; numeroVenta: string }>;
  rechazarCotizacion: (id: string, data: RechazarCotizacionData, userId: string) => Promise<void>;
  marcarVencida: (id: string, userId: string) => Promise<void>;

  // Actions - Compromiso de entrega, validez y tiempo de importación
  actualizarDiasCompromisoEntrega: (id: string, diasCompromisoEntrega: number, userId: string) => Promise<void>;
  actualizarDiasValidez: (id: string, diasValidez: number, userId: string) => Promise<void>;
  actualizarTiempoEstimadoImportacion: (id: string, tiempoEstimado: number, userId: string) => Promise<void>;

  // Actions - Estadísticas
  fetchStats: () => Promise<void>;
  fetchAnalisisDemanda: () => Promise<void>;
}

export const useCotizacionStore = create<CotizacionState>((set, get) => ({
  cotizaciones: [],
  stats: null,
  analisisDemanda: null,
  loading: false,
  error: null,
  selectedCotizacion: null,

  // ========== CRUD ==========

  fetchCotizaciones: async () => {
    set({ loading: true, error: null });
    try {
      const cotizaciones = await CotizacionService.getAll();
      set({ cotizaciones, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchCotizacionById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const cotizacion = await CotizacionService.getById(id);
      set({ selectedCotizacion: cotizacion, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchCotizacionesByEstado: async (estado: EstadoCotizacion | EstadoCotizacion[]) => {
    set({ loading: true, error: null });
    try {
      const cotizaciones = await CotizacionService.getByEstado(estado);
      set({ cotizaciones, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchCotizacionesWithFilters: async (filters: CotizacionFilters) => {
    set({ loading: true, error: null });
    try {
      const cotizaciones = await CotizacionService.getWithFilters(filters);
      set({ cotizaciones, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  createCotizacion: async (data: CotizacionFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const nuevaCotizacion = await CotizacionService.create(data, userId);
      set(state => ({
        cotizaciones: [nuevaCotizacion, ...state.cotizaciones],
        loading: false
      }));

      // Actualizar estadísticas
      get().fetchStats();

      return nuevaCotizacion.id;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateCotizacion: async (id: string, data: Partial<CotizacionFormData>, userId: string) => {
    set({ loading: true, error: null });
    try {
      await CotizacionService.update(id, data, userId);
      await get().fetchCotizaciones();

      if (get().selectedCotizacion?.id === id) {
        await get().fetchCotizacionById(id);
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteCotizacion: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await CotizacionService.delete(id);
      set(state => ({
        cotizaciones: state.cotizaciones.filter(c => c.id !== id),
        loading: false
      }));

      get().fetchStats();
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  setSelectedCotizacion: (cotizacion) => {
    set({ selectedCotizacion: cotizacion });
  },

  // ========== FLUJO DE COTIZACIÓN ==========

  validarCotizacion: async (id: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      await CotizacionService.validar(id, userId);
      await get().fetchCotizaciones();

      if (get().selectedCotizacion?.id === id) {
        await get().fetchCotizacionById(id);
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  revertirValidacion: async (id: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      await CotizacionService.revertirValidacion(id, userId);
      await get().fetchCotizaciones();

      if (get().selectedCotizacion?.id === id) {
        await get().fetchCotizacionById(id);
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Nuevo: Comprometer adelanto (paso 1)
  comprometerAdelanto: async (id, data, userId) => {
    set({ loading: true, error: null });
    try {
      await CotizacionService.comprometerAdelanto(id, data, userId);
      await get().fetchCotizaciones();

      if (get().selectedCotizacion?.id === id) {
        await get().fetchCotizacionById(id);
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Nuevo: Registrar pago de adelanto (paso 2)
  registrarPagoAdelanto: async (id, data, userId) => {
    set({ loading: true, error: null });
    try {
      const resultado = await CotizacionService.registrarPagoAdelanto(id, data, userId);
      await get().fetchCotizaciones();
      await get().fetchStats();

      if (get().selectedCotizacion?.id === id) {
        await get().fetchCotizacionById(id);
      }

      set({ loading: false });
      return resultado;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // @deprecated - Mantener para compatibilidad
  registrarAdelanto: async (id, data, userId) => {
    set({ loading: true, error: null });
    try {
      const resultado = await CotizacionService.registrarAdelanto(id, data, userId);
      await get().fetchCotizaciones();
      await get().fetchStats();

      if (get().selectedCotizacion?.id === id) {
        await get().fetchCotizacionById(id);
      }

      set({ loading: false });
      return resultado;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  confirmarCotizacion: async (id: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      const resultado = await CotizacionService.confirmar(id, userId);
      await get().fetchCotizaciones();
      await get().fetchStats();

      if (get().selectedCotizacion?.id === id) {
        await get().fetchCotizacionById(id);
      }

      set({ loading: false });
      return resultado;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  rechazarCotizacion: async (id: string, data: RechazarCotizacionData, userId: string) => {
    set({ loading: true, error: null });
    try {
      await CotizacionService.rechazar(id, data, userId);
      await get().fetchCotizaciones();
      await get().fetchStats();
      await get().fetchAnalisisDemanda();

      if (get().selectedCotizacion?.id === id) {
        await get().fetchCotizacionById(id);
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  marcarVencida: async (id: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      await CotizacionService.marcarVencida(id, userId);
      await get().fetchCotizaciones();
      await get().fetchStats();

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  actualizarDiasCompromisoEntrega: async (id: string, diasCompromisoEntrega: number, userId: string) => {
    try {
      await CotizacionService.actualizarDiasCompromisoEntrega(id, diasCompromisoEntrega, userId);

      // Actualizar en la lista local
      set(state => ({
        cotizaciones: state.cotizaciones.map(c =>
          c.id === id ? { ...c, diasCompromisoEntrega } : c
        )
      }));

      // Actualizar cotización seleccionada si es la misma
      if (get().selectedCotizacion?.id === id) {
        set(state => ({
          selectedCotizacion: state.selectedCotizacion
            ? { ...state.selectedCotizacion, diasCompromisoEntrega }
            : null
        }));
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  actualizarDiasValidez: async (id: string, diasValidez: number, userId: string) => {
    try {
      await CotizacionService.actualizarDiasValidez(id, diasValidez, userId);

      // Actualizar en la lista local
      set(state => ({
        cotizaciones: state.cotizaciones.map(c =>
          c.id === id ? { ...c, diasVigencia: diasValidez } : c
        )
      }));

      // Actualizar cotización seleccionada si es la misma
      if (get().selectedCotizacion?.id === id) {
        set(state => ({
          selectedCotizacion: state.selectedCotizacion
            ? { ...state.selectedCotizacion, diasVigencia: diasValidez }
            : null
        }));
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  actualizarTiempoEstimadoImportacion: async (id: string, tiempoEstimado: number, userId: string) => {
    try {
      await CotizacionService.actualizarTiempoEstimadoImportacion(id, tiempoEstimado, userId);

      // Actualizar en la lista local
      set(state => ({
        cotizaciones: state.cotizaciones.map(c =>
          c.id === id ? { ...c, tiempoEstimadoImportacion: tiempoEstimado } : c
        )
      }));

      // Actualizar cotización seleccionada si es la misma
      if (get().selectedCotizacion?.id === id) {
        set(state => ({
          selectedCotizacion: state.selectedCotizacion
            ? { ...state.selectedCotizacion, tiempoEstimadoImportacion: tiempoEstimado }
            : null
        }));
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  // ========== ESTADÍSTICAS ==========

  fetchStats: async () => {
    try {
      const stats = await CotizacionService.getStats();
      set({ stats });
    } catch (error: any) {
      console.error('Error al obtener estadísticas:', error);
    }
  },

  fetchAnalisisDemanda: async () => {
    try {
      const analisisDemanda = await CotizacionService.getAnalisisDemanda();
      set({ analisisDemanda });
    } catch (error: any) {
      console.error('Error al obtener análisis de demanda:', error);
    }
  }
}));
