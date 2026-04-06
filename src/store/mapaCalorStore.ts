import { create } from 'zustand';
import { mapaCalorService } from '../services/mapaCalor.service';
import { collection, getCountFromServer } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type {
  VentaGeo,
  ZonaResumen,
  FiltrosMapaCalor,
  MapaCalorKPIData,
  CapaMapa,
  PeriodoPresetMapa
} from '../types/mapaCalor.types';

function getFechasPorPreset(preset: PeriodoPresetMapa): { inicio: Date; fin: Date } {
  const fin = new Date();
  const inicio = new Date();

  switch (preset) {
    case 'hoy':
      inicio.setHours(0, 0, 0, 0);
      break;
    case 'semana':
      inicio.setDate(inicio.getDate() - 7);
      break;
    case 'mes':
      inicio.setMonth(inicio.getMonth() - 1);
      break;
    case '3meses':
      inicio.setMonth(inicio.getMonth() - 3);
      break;
    case '6meses':
      inicio.setMonth(inicio.getMonth() - 6);
      break;
    case 'todo':
      inicio.setFullYear(2020, 0, 1);
      break;
    default:
      inicio.setMonth(inicio.getMonth() - 1);
  }

  return { inicio, fin };
}

interface MapaCalorState {
  // Data
  ventasGeo: VentaGeo[];
  zonas: ZonaResumen[];
  kpis: MapaCalorKPIData | null;

  // UI State
  filtros: FiltrosMapaCalor;
  capaActiva: CapaMapa;
  zonaSeleccionada: ZonaResumen | null;
  ventaSeleccionada: VentaGeo | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchVentasGeo: () => Promise<void>;
  setPeriodo: (preset: PeriodoPresetMapa) => void;
  setFechasCustom: (inicio: Date, fin: Date) => void;
  setCapa: (capa: CapaMapa) => void;
  setZonaSeleccionada: (zona: ZonaResumen | null) => void;
  setVentaSeleccionada: (venta: VentaGeo | null) => void;
}

const defaultFechas = getFechasPorPreset('mes');

export const useMapaCalorStore = create<MapaCalorState>((set, get) => ({
  ventasGeo: [],
  zonas: [],
  kpis: null,
  filtros: {
    periodoPreset: 'mes',
    fechaInicio: defaultFechas.inicio,
    fechaFin: defaultFechas.fin,
    lineaNegocioId: null,
    distritos: []
  },
  capaActiva: 'heatmap',
  zonaSeleccionada: null,
  ventaSeleccionada: null,
  loading: false,
  error: null,

  fetchVentasGeo: async () => {
    const { filtros } = get();
    set({ loading: true, error: null });

    try {
      // Obtener ventas geo y total de ventas del sistema
      const [ventasGeo, totalSnap] = await Promise.all([
        mapaCalorService.getVentasGeo(filtros),
        getCountFromServer(collection(db, COLLECTIONS.VENTAS))
      ]);

      const zonas = mapaCalorService.calcularZonas(ventasGeo);
      const kpis = mapaCalorService.calcularKPIs(ventasGeo, totalSnap.data().count);

      set({ ventasGeo, zonas, kpis, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  setPeriodo: (preset: PeriodoPresetMapa) => {
    const fechas = getFechasPorPreset(preset);
    set(state => ({
      filtros: {
        ...state.filtros,
        periodoPreset: preset,
        fechaInicio: fechas.inicio,
        fechaFin: fechas.fin
      }
    }));
    get().fetchVentasGeo();
  },

  setFechasCustom: (inicio: Date, fin: Date) => {
    set(state => ({
      filtros: {
        ...state.filtros,
        periodoPreset: 'custom',
        fechaInicio: inicio,
        fechaFin: fin
      }
    }));
    get().fetchVentasGeo();
  },

  setCapa: (capa: CapaMapa) => set({ capaActiva: capa }),

  setZonaSeleccionada: (zona) => set({ zonaSeleccionada: zona, ventaSeleccionada: null }),

  setVentaSeleccionada: (venta) => set({ ventaSeleccionada: venta, zonaSeleccionada: null })
}));
