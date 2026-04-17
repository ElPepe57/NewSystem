/**
 * reclamoStore — S40 Bloque B
 *
 * Estado global de Reclamos. Fachada entre UI y `reclamo.service`.
 */
import { create } from 'zustand';
import { reclamoService } from '../services/reclamo.service';
import type {
  Reclamo,
  ReclamoFormData,
  ReclamoFiltros,
  ResumenReclamos,
} from '../types/reclamo.types';
import type { MetodoTesoreria } from '../types/tesoreria.types';

interface ReclamoState {
  // Estado
  reclamos: Reclamo[];
  reclamosActivos: Reclamo[];       // borrador | enviado | en_disputa | aceptado
  resumen: ResumenReclamos | null;
  selectedReclamo: Reclamo | null;
  loading: boolean;
  error: string | null;

  // Consultas
  fetchReclamos: (filtros?: ReclamoFiltros) => Promise<void>;
  fetchActivos: () => Promise<void>;
  fetchResumen: (filtros?: ReclamoFiltros) => Promise<void>;
  fetchByEnvio: (envioId: string) => Promise<Reclamo[]>;
  getById: (id: string) => Promise<Reclamo | null>;

  // Workflow
  crearReclamo: (data: ReclamoFormData, userId: string) => Promise<string>;
  actualizarReclamo: (id: string, partial: Partial<ReclamoFormData>, userId: string) => Promise<void>;
  enviarReclamo: (id: string, userId: string) => Promise<void>;
  marcarEnDisputa: (id: string, motivo: string, userId: string) => Promise<void>;
  aceptarReclamo: (id: string, montoAcordadoPEN: number, userId: string) => Promise<void>;
  registrarCobro: (
    id: string,
    cobro: {
      cuentaId: string;
      metodoPago: MetodoTesoreria;
      montoCobradoPEN: number;
      fecha?: Date;
      referencia?: string;
      notas?: string;
    },
    userId: string,
  ) => Promise<void>;
  rechazarReclamo: (id: string, motivo: string, userId: string) => Promise<void>;
  cerrarSinCobrar: (id: string, motivo: string, userId: string) => Promise<void>;
  eliminarReclamo: (id: string, userId: string) => Promise<void>;

  // Utilidades
  setSelectedReclamo: (r: Reclamo | null) => void;
  clearError: () => void;
}

export const useReclamoStore = create<ReclamoState>((set, get) => ({
  reclamos: [],
  reclamosActivos: [],
  resumen: null,
  selectedReclamo: null,
  loading: false,
  error: null,

  // ─── Consultas ─────────────────────────────────────────────────────────────

  fetchReclamos: async (filtros) => {
    set({ loading: true, error: null });
    try {
      const reclamos = await reclamoService.getAll(filtros);
      set({ reclamos, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchActivos: async () => {
    set({ loading: true, error: null });
    try {
      const reclamos = await reclamoService.getAll({
        estados: ['borrador', 'enviado', 'en_disputa', 'aceptado'],
      });
      set({ reclamosActivos: reclamos, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchResumen: async (filtros) => {
    try {
      const resumen = await reclamoService.getResumen(filtros);
      set({ resumen });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message });
    }
  },

  fetchByEnvio: async (envioId) => {
    try {
      return await reclamoService.getByEnvio(envioId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message });
      return [];
    }
  },

  getById: async (id) => {
    try {
      const r = await reclamoService.getById(id);
      if (r) set({ selectedReclamo: r });
      return r;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message });
      return null;
    }
  },

  // ─── Workflow ──────────────────────────────────────────────────────────────

  crearReclamo: async (data, userId) => {
    set({ loading: true, error: null });
    try {
      const id = await reclamoService.crear(data, userId);
      await get().fetchReclamos();
      set({ loading: false });
      return id;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  actualizarReclamo: async (id, partial, userId) => {
    await reclamoService.actualizar(id, partial, userId);
    await get().fetchReclamos();
  },

  enviarReclamo: async (id, userId) => {
    await reclamoService.enviar(id, userId);
    await get().fetchReclamos();
  },

  marcarEnDisputa: async (id, motivo, userId) => {
    await reclamoService.marcarEnDisputa(id, motivo, userId);
    await get().fetchReclamos();
  },

  aceptarReclamo: async (id, montoAcordadoPEN, userId) => {
    await reclamoService.aceptar(id, montoAcordadoPEN, userId);
    await get().fetchReclamos();
  },

  registrarCobro: async (id, cobro, userId) => {
    await reclamoService.registrarCobro(id, cobro, userId);
    await get().fetchReclamos();
  },

  rechazarReclamo: async (id, motivo, userId) => {
    await reclamoService.rechazar(id, motivo, userId);
    await get().fetchReclamos();
  },

  cerrarSinCobrar: async (id, motivo, userId) => {
    await reclamoService.cerrarSinCobrar(id, motivo, userId);
    await get().fetchReclamos();
  },

  eliminarReclamo: async (id, userId) => {
    await reclamoService.eliminar(id, userId);
    await get().fetchReclamos();
  },

  // ─── Utilidades ────────────────────────────────────────────────────────────

  setSelectedReclamo: (r) => set({ selectedReclamo: r }),
  clearError: () => set({ error: null }),
}));
