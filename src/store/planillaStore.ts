/**
 * planillaStore.ts
 *
 * Estado global del módulo de Planilla.
 */
import { create } from 'zustand';
import { planillaService } from '../services/planilla.service';
import type {
  EmpleadoConPerfil,
  Boleta,
  AdelantoNomina,
  PerfilLaboralFormData,
  AdelantoFormData,
  BoletaAjustes,
} from '../types/planilla.types';

interface PlanillaState {
  // Empleados
  empleados: EmpleadoConPerfil[];
  loadingEmpleados: boolean;
  fetchEmpleados: () => Promise<void>;

  // Boletas
  boletas: Boleta[];
  loadingBoletas: boolean;
  mesActivo: number;
  anioActivo: number;
  setMesActivo: (mes: number) => void;
  setAnioActivo: (anio: number) => void;
  fetchBoletas: () => Promise<void>;
  generarBoletas: (userId: string) => Promise<Boleta[]>;
  ajustarBoleta: (boletaId: string, ajustes: BoletaAjustes) => Promise<void>;
  aprobarBoleta: (boletaId: string, userId: string) => Promise<void>;
  pagarBoleta: (boletaId: string, datosPago: any, userId: string) => Promise<void>;
  anularBoleta: (boletaId: string) => Promise<void>;
  eliminarBoleta: (boletaId: string) => Promise<void>;

  // Adelantos
  adelantos: AdelantoNomina[];
  loadingAdelantos: boolean;
  fetchAdelantos: () => Promise<void>;
  crearAdelanto: (data: AdelantoFormData, userId: string) => Promise<string>;

  // Perfil laboral
  guardarPerfilLaboral: (userId: string, data: PerfilLaboralFormData) => Promise<void>;
  eliminarPerfilLaboral: (userId: string) => Promise<void>;

  // Error
  error: string | null;
  clearError: () => void;
}

const now = new Date();

export const usePlanillaStore = create<PlanillaState>((set, get) => ({
  // --- Empleados ---
  empleados: [],
  loadingEmpleados: false,
  fetchEmpleados: async () => {
    set({ loadingEmpleados: true, error: null });
    try {
      const empleados = await planillaService.getEmpleados();
      set({ empleados, loadingEmpleados: false });
    } catch (e: any) {
      set({ error: e.message, loadingEmpleados: false });
    }
  },

  // --- Boletas ---
  boletas: [],
  loadingBoletas: false,
  mesActivo: now.getMonth() + 1,
  anioActivo: now.getFullYear(),
  setMesActivo: (mes) => {
    set({ mesActivo: mes });
    get().fetchBoletas();
  },
  setAnioActivo: (anio) => {
    set({ anioActivo: anio });
    get().fetchBoletas();
  },
  fetchBoletas: async () => {
    set({ loadingBoletas: true, error: null });
    try {
      const { mesActivo, anioActivo } = get();
      const boletas = await planillaService.getBoletasPorPeriodo(mesActivo, anioActivo);
      set({ boletas, loadingBoletas: false });
    } catch (e: any) {
      set({ error: e.message, loadingBoletas: false });
    }
  },
  generarBoletas: async (userId) => {
    const { mesActivo, anioActivo } = get();
    set({ error: null });
    try {
      const boletas = await planillaService.generarBoletasMes(mesActivo, anioActivo, userId);
      set({ boletas });
      return boletas;
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    }
  },
  ajustarBoleta: async (boletaId, ajustes) => {
    await planillaService.ajustarBoleta(boletaId, ajustes);
    get().fetchBoletas();
  },
  aprobarBoleta: async (boletaId, userId) => {
    await planillaService.aprobarBoleta(boletaId, userId);
    get().fetchBoletas();
  },
  pagarBoleta: async (boletaId, datosPago, userId) => {
    await planillaService.pagarBoleta(boletaId, datosPago, userId);
    get().fetchBoletas();
  },
  anularBoleta: async (boletaId) => {
    await planillaService.anularBoleta(boletaId);
    get().fetchBoletas();
  },
  eliminarBoleta: async (boletaId) => {
    await planillaService.eliminarBoleta(boletaId);
    get().fetchBoletas();
  },

  // --- Adelantos ---
  adelantos: [],
  loadingAdelantos: false,
  fetchAdelantos: async () => {
    set({ loadingAdelantos: true, error: null });
    try {
      const adelantos = await planillaService.getAdelantos();
      set({ adelantos, loadingAdelantos: false });
    } catch (e: any) {
      set({ error: e.message, loadingAdelantos: false });
    }
  },
  crearAdelanto: async (data, userId) => {
    set({ error: null });
    try {
      const id = await planillaService.crearAdelanto(data, userId);
      get().fetchAdelantos();
      return id;
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    }
  },

  // --- Perfil laboral ---
  guardarPerfilLaboral: async (userId, data) => {
    await planillaService.guardarPerfilLaboral(userId, data);
    get().fetchEmpleados();
  },
  eliminarPerfilLaboral: async (userId) => {
    await planillaService.eliminarPerfilLaboral(userId);
    get().fetchEmpleados();
  },

  // --- Error ---
  error: null,
  clearError: () => set({ error: null }),
}));
