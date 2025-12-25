import { create } from 'zustand';
import { clienteService } from '../services/cliente.service';
import type {
  Cliente,
  ClienteFormData,
  ClienteStats,
  DuplicadoEncontrado
} from '../types/entidadesMaestras.types';

interface ClienteState {
  // Estado
  clientes: Cliente[];
  clienteSeleccionado: Cliente | null;
  resultadosBusqueda: Cliente[];
  duplicadosDetectados: DuplicadoEncontrado<Cliente>[];
  stats: ClienteStats | null;
  loading: boolean;
  buscando: boolean;
  error: string | null;

  // Caché para búsqueda rápida
  cacheActualizado: boolean;
  ultimaActualizacionCache: number;

  // Acciones de carga
  fetchClientes: () => Promise<void>;
  fetchStats: () => Promise<void>;
  cargarCacheInicial: () => Promise<void>;

  // Acciones de búsqueda inteligente (optimizada con caché local)
  buscar: (termino: string) => Promise<void>;
  buscarLocal: (termino: string) => Cliente[];
  buscarPorDniRuc: (dniRuc: string) => Promise<Cliente | null>;
  buscarPorTelefono: (telefono: string) => Promise<Cliente | null>;
  detectarDuplicados: (data: ClienteFormData) => Promise<void>;
  limpiarBusqueda: () => void;

  // Acciones CRUD
  getById: (id: string) => Promise<Cliente | null>;
  createCliente: (data: ClienteFormData, userId: string) => Promise<string>;
  updateCliente: (id: string, data: Partial<ClienteFormData>, userId: string) => Promise<void>;
  deleteCliente: (id: string) => Promise<void>;
  cambiarEstado: (id: string, estado: 'activo' | 'inactivo' | 'potencial', userId: string) => Promise<void>;

  // Acciones especiales
  getOrCreate: (data: ClienteFormData, userId: string) => Promise<{ cliente: Cliente; esNuevo: boolean }>;
  agregarDireccion: (clienteId: string, direccion: any, userId: string) => Promise<void>;
  actualizarMetricas: (clienteId: string, montoVenta: number, productoIds?: string[]) => Promise<void>;

  // Selección
  setClienteSeleccionado: (cliente: Cliente | null) => void;
  clearError: () => void;
}

// Helper para normalizar texto (remover acentos, minúsculas)
const normalizarTexto = (texto: string): string => {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

// Tiempo de validez del caché: 5 minutos
const CACHE_TTL = 5 * 60 * 1000;

export const useClienteStore = create<ClienteState>((set, get) => ({
  clientes: [],
  clienteSeleccionado: null,
  resultadosBusqueda: [],
  duplicadosDetectados: [],
  stats: null,
  loading: false,
  buscando: false,
  error: null,
  cacheActualizado: false,
  ultimaActualizacionCache: 0,

  // ============ CARGA ============

  fetchClientes: async () => {
    set({ loading: true, error: null });
    try {
      const clientes = await clienteService.getAll();
      set({
        clientes,
        loading: false,
        cacheActualizado: true,
        ultimaActualizacionCache: Date.now()
      });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Carga inicial silenciosa del caché (para búsqueda rápida)
  cargarCacheInicial: async () => {
    const { cacheActualizado, ultimaActualizacionCache, loading } = get();
    const cacheValido = cacheActualizado && (Date.now() - ultimaActualizacionCache) < CACHE_TTL;

    // Si el caché está válido o ya estamos cargando, no hacer nada
    if (cacheValido || loading) return;

    try {
      const clientes = await clienteService.getAll();
      set({
        clientes,
        cacheActualizado: true,
        ultimaActualizacionCache: Date.now()
      });
    } catch (error) {
      console.error('Error cargando caché de clientes:', error);
    }
  },

  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await clienteService.getStats();
      set({ stats, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // ============ BÚSQUEDA INTELIGENTE ============

  // Búsqueda local sincrónica sobre el caché (ultra rápida)
  buscarLocal: (termino: string): Cliente[] => {
    const { clientes } = get();
    if (!termino || termino.length < 2) return [];

    const terminoNorm = normalizarTexto(termino);
    const palabras = terminoNorm.split(/\s+/).filter(p => p.length > 0);

    // Filtrar y puntuar resultados
    const resultadosConScore = clientes
      .filter(cliente => cliente.estado === 'activo' || cliente.estado === 'potencial')
      .map(cliente => {
        let score = 0;
        const nombreNorm = normalizarTexto(cliente.nombre);
        // Separar el nombre en palabras para búsqueda más inteligente
        const palabrasNombre = nombreNorm.split(/\s+/).filter(p => p.length > 0);

        // Match exacto en DNI/RUC (máxima prioridad)
        if (cliente.dniRuc && normalizarTexto(cliente.dniRuc) === terminoNorm) {
          score = 100;
        }
        // Match en teléfono (solo si el término tiene al menos 3 dígitos)
        if (score === 0 && cliente.telefono) {
          const digitosBusqueda = termino.replace(/\D/g, '');
          const digitosTelefono = cliente.telefono.replace(/\D/g, '');
          if (digitosBusqueda.length >= 3 && digitosTelefono.includes(digitosBusqueda)) {
            score = 95;
          }
        }
        // Match en email
        if (score === 0 && cliente.email && normalizarTexto(cliente.email).includes(terminoNorm)) {
          score = 90;
        }
        // PRIORIDAD ALTA: Primera palabra del nombre empieza con el término
        // Ej: "luis" -> "Luis Alonso" (score 92)
        if (score === 0 && palabrasNombre[0]?.startsWith(terminoNorm)) {
          score = 92;
        }
        // PRIORIDAD MEDIA-ALTA: Alguna palabra del nombre empieza con el término
        // Ej: "luis" -> "Jose Luis" (score 82)
        if (score === 0 && palabrasNombre.some(p => p.startsWith(terminoNorm))) {
          score = 82;
        }
        // Match exacto al inicio del nombre completo
        if (score === 0 && nombreNorm.startsWith(terminoNorm)) {
          score = 88;
        }
        // Match substring en nombre (término aparece en medio)
        if (score === 0 && nombreNorm.includes(terminoNorm)) {
          score = 70;
        }
        // Match de todas las palabras en cualquier orden
        if (score === 0 && palabras.every(p => nombreNorm.includes(p))) {
          score = 65;
        }
        // Match parcial de palabras (al menos 2 coinciden)
        if (score === 0 && palabras.length >= 2 && palabras.filter(p => nombreNorm.includes(p)).length >= 2) {
          score = 55;
        }

        return { cliente, score, nombreNorm, palabrasNombre };
      })
      .filter(r => r.score > 0);

    // Debug: mostrar scores para verificar el algoritmo
    console.log('[buscarLocal] Resultados con score:', terminoNorm);
    resultadosConScore.forEach(r => {
      console.log(`  - "${r.cliente.nombre}" => score: ${r.score}, palabras: [${r.palabrasNombre.join(', ')}], estado: ${r.cliente.estado}`);
    });

    const resultados = resultadosConScore
      .sort((a, b) => {
        // Ordenar por score, luego por compras
        if (b.score !== a.score) return b.score - a.score;
        return b.cliente.metricas.totalCompras - a.cliente.metricas.totalCompras;
      })
      .slice(0, 10)
      .map(r => r.cliente);

    return resultados;
  },

  // Búsqueda híbrida: primero local, luego Firebase si es necesario
  buscar: async (termino: string) => {
    if (!termino || termino.length < 2) {
      set({ resultadosBusqueda: [] });
      return;
    }

    const { cacheActualizado, clientes, buscarLocal, cargarCacheInicial } = get();

    console.log('[buscar] término:', termino, 'cacheActualizado:', cacheActualizado, 'clientes en cache:', clientes.length);

    // Si hay caché, usar búsqueda local inmediata
    if (cacheActualizado && clientes.length > 0) {
      console.log('[buscar] Usando búsqueda LOCAL');
      const resultadosLocales = buscarLocal(termino);
      set({ resultadosBusqueda: resultadosLocales, buscando: false });
      return;
    }

    // Si no hay caché, cargar y luego buscar
    console.log('[buscar] Cargando caché primero...');
    set({ buscando: true });
    try {
      await cargarCacheInicial();
      const resultadosLocales = buscarLocal(termino);
      set({ resultadosBusqueda: resultadosLocales, buscando: false });
    } catch (error: any) {
      // Fallback a búsqueda en Firebase
      console.log('[buscar] Fallback a Firebase');
      try {
        const resultados = await clienteService.buscar(termino);
        set({ resultadosBusqueda: resultados, buscando: false });
      } catch (err) {
        set({ buscando: false });
        console.error('Error en búsqueda:', err);
      }
    }
  },

  buscarPorDniRuc: async (dniRuc: string) => {
    try {
      return await clienteService.buscarPorDniRuc(dniRuc);
    } catch (error: any) {
      console.error('Error buscando por DNI/RUC:', error);
      return null;
    }
  },

  buscarPorTelefono: async (telefono: string) => {
    try {
      return await clienteService.buscarPorTelefono(telefono);
    } catch (error: any) {
      console.error('Error buscando por teléfono:', error);
      return null;
    }
  },

  detectarDuplicados: async (data: ClienteFormData) => {
    try {
      const duplicados = await clienteService.detectarDuplicados(data);
      set({ duplicadosDetectados: duplicados });
    } catch (error: any) {
      console.error('Error detectando duplicados:', error);
      set({ duplicadosDetectados: [] });
    }
  },

  limpiarBusqueda: () => {
    set({ resultadosBusqueda: [], duplicadosDetectados: [] });
  },

  // ============ CRUD ============

  getById: async (id: string) => {
    try {
      const cliente = await clienteService.getById(id);
      if (cliente) {
        set({ clienteSeleccionado: cliente });
      }
      return cliente;
    } catch (error: any) {
      console.error('Error obteniendo cliente:', error);
      return null;
    }
  },

  createCliente: async (data: ClienteFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const id = await clienteService.create(data, userId);
      await get().fetchClientes();
      set({ loading: false });
      return id;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateCliente: async (id: string, data: Partial<ClienteFormData>, userId: string) => {
    set({ loading: true, error: null });
    try {
      await clienteService.update(id, data, userId);
      await get().fetchClientes();

      // Actualizar cliente seleccionado si es el mismo
      const { clienteSeleccionado } = get();
      if (clienteSeleccionado?.id === id) {
        const actualizado = await clienteService.getById(id);
        set({ clienteSeleccionado: actualizado });
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteCliente: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await clienteService.delete(id);
      await get().fetchClientes();

      // Limpiar selección si era el eliminado
      const { clienteSeleccionado } = get();
      if (clienteSeleccionado?.id === id) {
        set({ clienteSeleccionado: null });
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  cambiarEstado: async (id: string, estado: 'activo' | 'inactivo' | 'potencial', userId: string) => {
    set({ loading: true, error: null });
    try {
      await clienteService.cambiarEstado(id, estado, userId);
      await get().fetchClientes();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // ============ ACCIONES ESPECIALES ============

  getOrCreate: async (data: ClienteFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const resultado = await clienteService.getOrCreate(data, userId);
      if (resultado.esNuevo) {
        await get().fetchClientes();
      }
      set({ loading: false });
      return resultado;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  agregarDireccion: async (clienteId: string, direccion: any, userId: string) => {
    set({ loading: true, error: null });
    try {
      await clienteService.agregarDireccion(clienteId, direccion, userId);

      // Actualizar cliente seleccionado si es el mismo
      const { clienteSeleccionado } = get();
      if (clienteSeleccionado?.id === clienteId) {
        const actualizado = await clienteService.getById(clienteId);
        set({ clienteSeleccionado: actualizado });
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  actualizarMetricas: async (clienteId: string, montoVenta: number, productoIds?: string[]) => {
    try {
      await clienteService.actualizarMetricas(clienteId, montoVenta, productoIds);
    } catch (error: any) {
      console.error('Error actualizando métricas:', error);
    }
  },

  // ============ SELECCIÓN ============

  setClienteSeleccionado: (cliente: Cliente | null) => {
    set({ clienteSeleccionado: cliente });
  },

  clearError: () => set({ error: null })
}));
