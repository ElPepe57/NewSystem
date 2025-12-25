import { create } from 'zustand';
import type {
  Venta,
  VentaFormData,
  EstadoVenta,
  EstadoPago,
  MetodoPago,
  PagoVenta,
  EntregaParcial,
  VentaStats,
  ProductoDisponible,
  ResultadoAsignacion,
  StockReservado,
  TipoReserva,
  ProductoReservado,
  ProductoStockVirtual
} from '../types/venta.types';
import { VentaService } from '../services/venta.service';

interface ResumenPagos {
  totalPorCobrar: number;
  ventasPendientes: number;
  ventasParciales: number;
  ventasPagadas: number;
  cobranzaMesActual: number;
}

interface VentaState {
  ventas: Venta[];
  productosDisponibles: ProductoDisponible[];
  stats: VentaStats | null;
  resumenPagos: ResumenPagos | null;
  loading: boolean;
  error: string | null;
  selectedVenta: Venta | null;

  // Actions
  fetchVentas: () => Promise<void>;
  fetchVentaById: (id: string) => Promise<void>;
  fetchVentasByEstado: (estado: EstadoVenta) => Promise<void>;
  fetchProductosDisponibles: () => Promise<void>;
  createCotizacion: (data: VentaFormData, userId: string) => Promise<string>;
  createVenta: (data: VentaFormData, userId: string) => Promise<string>;
  confirmarCotizacion: (id: string, userId: string) => Promise<void>;
  asignarInventario: (id: string, userId: string, permitirParcial?: boolean) => Promise<ResultadoAsignacion[]>;
  completarAsignacionProducto: (ventaId: string, productoId: string, userId: string) => Promise<ResultadoAsignacion>;
  actualizarFechaEstimadaProducto: (ventaId: string, productoId: string, fechaEstimada: Date, notas?: string, userId?: string) => Promise<void>;
  marcarEnEntrega: (id: string, userId: string, datos?: any) => Promise<void>;
  marcarEntregada: (id: string, userId: string) => Promise<void>;
  registrarEntregaParcial: (id: string, userId: string, datos?: {
    direccionEntrega?: string;
    notasEntrega?: string;
    productosAEntregar?: Array<{ productoId: string; cantidad: number }>;
  }) => Promise<EntregaParcial>;
  cancelarVenta: (id: string, userId: string, motivo?: string) => Promise<void>;
  deleteVenta: (id: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  setSelectedVenta: (venta: Venta | null) => void;

  // Pagos Actions
  registrarPago: (ventaId: string, datosPago: {
    monto: number;
    metodoPago: MetodoPago;
    referencia?: string;
    comprobante?: string;
    notas?: string;
  }, userId: string) => Promise<PagoVenta>;
  eliminarPago: (ventaId: string, pagoId: string, userId: string) => Promise<void>;
  fetchVentasByEstadoPago: (estadoPago: EstadoPago) => Promise<void>;
  fetchVentasPendientesPago: () => Promise<void>;
  fetchResumenPagos: () => Promise<void>;

  // Pre-Venta con Reserva de Stock
  registrarAdelantoConReserva: (ventaId: string, datosPago: {
    monto: number;
    metodoPago: MetodoPago;
    referencia?: string;
  }, userId: string, horasVigencia?: number) => Promise<{
    tipoReserva: TipoReserva;
    productosReservados: ProductoReservado[];
    productosVirtuales?: ProductoStockVirtual[];
    pagoRegistrado: PagoVenta;
    requerimientoId?: string;
  }>;

  // Flujo de Cotización
  validarCotizacion: (id: string, userId: string) => Promise<void>;
  revertirValidacion: (id: string, userId: string) => Promise<void>;
}

export const useVentaStore = create<VentaState>((set, get) => ({
  ventas: [],
  productosDisponibles: [],
  stats: null,
  resumenPagos: null,
  loading: false,
  error: null,
  selectedVenta: null,
  
  fetchVentas: async () => {
    set({ loading: true, error: null });
    try {
      const ventas = await VentaService.getAll();
      set({ ventas, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchVentaById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const venta = await VentaService.getById(id);
      set({ selectedVenta: venta, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchVentasByEstado: async (estado: EstadoVenta) => {
    set({ loading: true, error: null });
    try {
      const ventas = await VentaService.getByEstado(estado);
      set({ ventas, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchProductosDisponibles: async () => {
    set({ loading: true, error: null });
    try {
      const productosDisponibles = await VentaService.getProductosDisponibles();
      set({ productosDisponibles, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  createCotizacion: async (data: VentaFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const nuevaVenta = await VentaService.create(data, userId, false);
      set(state => ({
        ventas: [nuevaVenta, ...state.ventas],
        loading: false
      }));

      await get().fetchStats();
      return nuevaVenta.id; // Retornar el ID para poder registrar adelanto
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  createVenta: async (data: VentaFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const nuevaVenta = await VentaService.create(data, userId, true);
      set(state => ({
        ventas: [nuevaVenta, ...state.ventas],
        loading: false
      }));

      await get().fetchStats();
      return nuevaVenta.id; // Retornar el ID para poder registrar adelanto
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  confirmarCotizacion: async (id: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      await VentaService.confirmarCotizacion(id, userId);
      await get().fetchVentas();
      await get().fetchStats();
      
      if (get().selectedVenta?.id === id) {
        await get().fetchVentaById(id);
      }
      
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  asignarInventario: async (id: string, userId: string, permitirParcial: boolean = false) => {
    set({ loading: true, error: null });
    try {
      const resultados = await VentaService.asignarInventario(id, userId, permitirParcial);
      await get().fetchVentas();
      await get().fetchStats();
      await get().fetchProductosDisponibles();

      if (get().selectedVenta?.id === id) {
        await get().fetchVentaById(id);
      }

      set({ loading: false });
      return resultados;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  completarAsignacionProducto: async (ventaId: string, productoId: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      const resultado = await VentaService.completarAsignacionProducto(ventaId, productoId, userId);
      await get().fetchVentas();
      await get().fetchStats();
      await get().fetchProductosDisponibles();

      if (get().selectedVenta?.id === ventaId) {
        await get().fetchVentaById(ventaId);
      }

      set({ loading: false });
      return resultado;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  actualizarFechaEstimadaProducto: async (ventaId: string, productoId: string, fechaEstimada: Date, notas?: string, userId?: string) => {
    set({ loading: true, error: null });
    try {
      await VentaService.actualizarFechaEstimadaProducto(ventaId, productoId, fechaEstimada, notas, userId);
      await get().fetchVentas();

      if (get().selectedVenta?.id === ventaId) {
        await get().fetchVentaById(ventaId);
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  marcarEnEntrega: async (id: string, userId: string, datos?: any) => {
    set({ loading: true, error: null });
    try {
      await VentaService.marcarEnEntrega(id, userId, datos);
      await get().fetchVentas();
      await get().fetchStats();
      
      if (get().selectedVenta?.id === id) {
        await get().fetchVentaById(id);
      }
      
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  marcarEntregada: async (id: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      await VentaService.marcarEntregada(id, userId);
      await get().fetchVentas();
      await get().fetchStats();
      await get().fetchProductosDisponibles();

      if (get().selectedVenta?.id === id) {
        await get().fetchVentaById(id);
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  registrarEntregaParcial: async (id, userId, datos) => {
    set({ loading: true, error: null });
    try {
      const entrega = await VentaService.registrarEntregaParcial(id, userId, datos);
      await get().fetchVentas();
      await get().fetchStats();
      await get().fetchProductosDisponibles();

      if (get().selectedVenta?.id === id) {
        await get().fetchVentaById(id);
      }

      set({ loading: false });
      return entrega;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  cancelarVenta: async (id: string, userId: string, motivo?: string) => {
    set({ loading: true, error: null });
    try {
      await VentaService.cancelar(id, userId, motivo);
      await get().fetchVentas();
      await get().fetchStats();
      await get().fetchProductosDisponibles();
      
      if (get().selectedVenta?.id === id) {
        await get().fetchVentaById(id);
      }
      
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  deleteVenta: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await VentaService.delete(id);
      set(state => ({
        ventas: state.ventas.filter(v => v.id !== id),
        loading: false
      }));
      
      await get().fetchStats();
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await VentaService.getStats();
      set({ stats, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  setSelectedVenta: (venta) => {
    set({ selectedVenta: venta });
  },

  // ========== PAGOS ACTIONS ==========

  registrarPago: async (ventaId, datosPago, userId) => {
    set({ loading: true, error: null });
    try {
      const pago = await VentaService.registrarPago(ventaId, datosPago, userId);
      await get().fetchVentas();
      await get().fetchResumenPagos();

      if (get().selectedVenta?.id === ventaId) {
        await get().fetchVentaById(ventaId);
      }

      set({ loading: false });
      return pago;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  eliminarPago: async (ventaId, pagoId, userId) => {
    set({ loading: true, error: null });
    try {
      await VentaService.eliminarPago(ventaId, pagoId, userId);
      await get().fetchVentas();
      await get().fetchResumenPagos();

      if (get().selectedVenta?.id === ventaId) {
        await get().fetchVentaById(ventaId);
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchVentasByEstadoPago: async (estadoPago) => {
    set({ loading: true, error: null });
    try {
      const ventas = await VentaService.getByEstadoPago(estadoPago);
      set({ ventas, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchVentasPendientesPago: async () => {
    set({ loading: true, error: null });
    try {
      const ventas = await VentaService.getVentasPendientesPago();
      set({ ventas, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchResumenPagos: async () => {
    try {
      const resumenPagos = await VentaService.getResumenPagos();
      set({ resumenPagos });
    } catch (error: any) {
      console.error('Error al obtener resumen de pagos:', error);
    }
  },

  // ========== PRE-VENTA CON RESERVA DE STOCK ==========

  registrarAdelantoConReserva: async (ventaId, datosPago, userId, horasVigencia = 48) => {
    set({ loading: true, error: null });
    try {
      const resultado = await VentaService.registrarAdelantoConReserva(
        ventaId,
        datosPago,
        userId,
        horasVigencia
      );

      // Refrescar datos
      await get().fetchVentas();
      await get().fetchStats();
      await get().fetchProductosDisponibles();
      await get().fetchResumenPagos();

      if (get().selectedVenta?.id === ventaId) {
        await get().fetchVentaById(ventaId);
      }

      set({ loading: false });
      return resultado;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // ========== FLUJO DE COTIZACIÓN ==========

  validarCotizacion: async (id, userId) => {
    set({ loading: true, error: null });
    try {
      await VentaService.validarCotizacion(id, userId);
      await get().fetchVentas();

      if (get().selectedVenta?.id === id) {
        await get().fetchVentaById(id);
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  revertirValidacion: async (id, userId) => {
    set({ loading: true, error: null });
    try {
      await VentaService.revertirValidacion(id, userId);
      await get().fetchVentas();

      if (get().selectedVenta?.id === id) {
        await get().fetchVentaById(id);
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  }
}));