import { create } from 'zustand';
import type { 
  ResumenEjecutivo,
  ProductoRentabilidad,
  InventarioValorizado,
  VentasPorCanal,
  TendenciaVentas,
  AlertaInventario,
  RangoFechas
} from '../types/reporte.types';
import { ReporteService } from '../services/reporte.service';

interface ReporteState {
  resumenEjecutivo: ResumenEjecutivo | null;
  productosRentabilidad: ProductoRentabilidad[];
  inventarioValorizado: InventarioValorizado[];
  ventasPorCanal: VentasPorCanal | null;
  tendenciaVentas: TendenciaVentas[];
  alertasInventario: AlertaInventario[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchResumenEjecutivo: () => Promise<void>;
  fetchProductosRentabilidad: (rango?: RangoFechas) => Promise<void>;
  fetchInventarioValorizado: () => Promise<void>;
  fetchVentasPorCanal: () => Promise<void>;
  fetchTendenciaVentas: (dias?: number) => Promise<void>;
  fetchAlertasInventario: () => Promise<void>;
  fetchAll: () => Promise<void>;
}

export const useReporteStore = create<ReporteState>((set, get) => ({
  resumenEjecutivo: null,
  productosRentabilidad: [],
  inventarioValorizado: [],
  ventasPorCanal: null,
  tendenciaVentas: [],
  alertasInventario: [],
  loading: false,
  error: null,
  
  fetchResumenEjecutivo: async () => {
    set({ loading: true, error: null });
    try {
      const resumenEjecutivo = await ReporteService.getResumenEjecutivo();
      set({ resumenEjecutivo, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchProductosRentabilidad: async (rango?: RangoFechas) => {
    set({ loading: true, error: null });
    try {
      const rangoFinal = rango || { inicio: new Date(0), fin: new Date() };
      const productosRentabilidad = await ReporteService.getProductosRentabilidad(rangoFinal);
      set({ productosRentabilidad, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchInventarioValorizado: async () => {
    set({ loading: true, error: null });
    try {
      const inventarioValorizado = await ReporteService.getInventarioValorizado();
      set({ inventarioValorizado, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchVentasPorCanal: async () => {
    set({ loading: true, error: null });
    try {
      const ventasPorCanal = await ReporteService.getVentasPorCanal();
      set({ ventasPorCanal, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchTendenciaVentas: async (dias: number = 30) => {
    set({ loading: true, error: null });
    try {
      const tendenciaVentas = await ReporteService.getTendenciaVentas(dias);
      set({ tendenciaVentas, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchAlertasInventario: async () => {
    set({ loading: true, error: null });
    try {
      const alertasInventario = await ReporteService.getAlertasInventario();
      set({ alertasInventario, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      await Promise.all([
        get().fetchResumenEjecutivo(),
        get().fetchProductosRentabilidad(),
        get().fetchInventarioValorizado(),
        get().fetchVentasPorCanal(),
        get().fetchTendenciaVentas(),
        get().fetchAlertasInventario()
      ]);
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  }
}));