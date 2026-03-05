/**
 * Store Zustand para Mercado Libre
 */

import { create } from 'zustand';
import { mercadoLibreService } from '../services/mercadoLibre.service';
import type {
  MLConfig,
  MLProductMap,
  MLProductGroup,
  MLOrderSync,
  MLQuestion,
  MLTabType,
} from '../types/mercadoLibre.types';
import type { Unsubscribe } from 'firebase/firestore';

// ============================================================
// UTILIDAD: Agrupar publicaciones ML por SKU
// ============================================================

/**
 * Agrupa publicaciones ML por skuGroupKey.
 * Multiples publicaciones (clasica + catalogo) del mismo producto
 * se consolidan en un solo MLProductGroup.
 * Items sin SKU van como standalone.
 */
export function groupProductMaps(productMaps: MLProductMap[]): MLProductGroup[] {
  const groups = new Map<string, MLProductGroup>();

  for (const pm of productMaps) {
    // Fallback: SKU > catalog_product_id > standalone
    // catalog_product_id es compartido entre publicaciones directa y catalogo del mismo producto
    const key = pm.skuGroupKey ?? pm.mlSku ?? pm.mlCatalogProductId ?? `standalone_${pm.id}`;

    if (!groups.has(key)) {
      groups.set(key, {
        groupKey: key,
        mlSku: pm.mlSku,
        productoId: null,
        productoSku: null,
        productoNombre: null,
        vinculado: false,
        listings: [],
        stockML: 0,
      });
    }

    const group = groups.get(key)!;
    group.listings.push(pm);

    // Stock compartido en ML: tomar el valor de cualquier publicacion (son iguales)
    // Usamos el max como fallback en caso de datos inconsistentes
    if (pm.mlAvailableQuantity > group.stockML) {
      group.stockML = pm.mlAvailableQuantity;
    }

    // Si alguna publicacion del grupo esta vinculada, el grupo esta vinculado
    if (pm.vinculado && pm.productoId) {
      group.vinculado = true;
      group.productoId = pm.productoId;
      group.productoSku = pm.productoSku;
      group.productoNombre = pm.productoNombre;
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    // Ordenar por nombre de primera publicacion
    const nameA = a.listings[0]?.mlTitle || '';
    const nameB = b.listings[0]?.mlTitle || '';
    return nameA.localeCompare(nameB);
  });
}

interface MercadoLibreState {
  // State
  config: MLConfig | null;
  productMaps: MLProductMap[];
  orderSyncs: MLOrderSync[];
  questions: MLQuestion[];
  questionsTotal: number;
  activeTab: MLTabType;
  loading: boolean;
  syncing: boolean;
  syncingStock: boolean;
  procesando: boolean;
  procesandoOrderId: string | null;
  error: string | null;
  initialized: boolean;

  // Listeners
  _unsubConfig: Unsubscribe | null;
  _unsubProducts: Unsubscribe | null;
  _unsubOrders: Unsubscribe | null;

  // Actions
  initialize: () => Promise<void>;
  cleanup: () => void;
  setActiveTab: (tab: MLTabType) => void;

  // Conexión
  getAuthUrl: () => Promise<string>;
  refreshStatus: () => Promise<void>;
  updateConfig: (data: Partial<MLConfig>) => Promise<void>;

  // Productos
  syncItems: () => Promise<{ total: number; nuevos: number; actualizados: number }>;
  vincularProducto: (
    mlProductMapId: string,
    productoId: string,
    productoSku: string,
    productoNombre: string
  ) => Promise<void>;
  desvincularProducto: (mlProductMapId: string) => Promise<void>;

  // Stock sync
  syncStock: (productoId?: string) => Promise<{ synced: number; errors: number }>;

  // Precios
  updatePrice: (mlProductMapId: string, newPrice: number) => Promise<void>;

  // Preguntas
  fetchQuestions: () => Promise<void>;
  answerQuestion: (questionId: number, text: string) => Promise<void>;

  // Procesamiento de órdenes
  procesarOrden: (orderSyncId: string) => Promise<{ ventaId: string; numeroVenta: string }>;
  procesarPendientes: () => Promise<{ procesadas: number; errores: number }>;

  // Helpers
  clearError: () => void;
}

export const useMercadoLibreStore = create<MercadoLibreState>((set, get) => ({
  // Initial state
  config: null,
  productMaps: [],
  orderSyncs: [],
  questions: [],
  questionsTotal: 0,
  activeTab: 'resumen',
  loading: false,
  syncing: false,
  syncingStock: false,
  procesando: false,
  procesandoOrderId: null,
  error: null,
  initialized: false,
  _unsubConfig: null,
  _unsubProducts: null,
  _unsubOrders: null,

  // ============================================================
  // INICIALIZACIÓN con listeners en tiempo real
  // ============================================================

  initialize: async () => {
    const { _unsubConfig, _unsubProducts, _unsubOrders, initialized } = get();
    if (initialized) return;

    set({ loading: true, error: null });

    try {
      // Listener de configuración
      if (!_unsubConfig) {
        const unsub = mercadoLibreService.onConfigChange((config) => {
          set({ config });
        });
        set({ _unsubConfig: unsub });
      }

      // Listener de productos mapeados
      if (!_unsubProducts) {
        const unsub = mercadoLibreService.onProductMapsChange((productMaps) => {
          set({ productMaps });
        });
        set({ _unsubProducts: unsub });
      }

      // Listener de órdenes
      if (!_unsubOrders) {
        const unsub = mercadoLibreService.onOrderSyncsChange((orderSyncs) => {
          set({ orderSyncs });
        });
        set({ _unsubOrders: unsub });
      }

      set({ loading: false, initialized: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error inicializando ML';
      set({ error: message, loading: false });
    }
  },

  cleanup: () => {
    const { _unsubConfig, _unsubProducts, _unsubOrders } = get();
    _unsubConfig?.();
    _unsubProducts?.();
    _unsubOrders?.();
    set({
      _unsubConfig: null,
      _unsubProducts: null,
      _unsubOrders: null,
      initialized: false,
    });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ============================================================
  // CONEXIÓN
  // ============================================================

  getAuthUrl: async () => {
    try {
      return await mercadoLibreService.getAuthUrl();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error obteniendo URL de auth';
      set({ error: message });
      throw error;
    }
  },

  refreshStatus: async () => {
    try {
      const config = await mercadoLibreService.getStatus();
      set({ config });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error obteniendo estado';
      set({ error: message });
    }
  },

  updateConfig: async (data) => {
    try {
      await mercadoLibreService.updateConfig(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error actualizando config';
      set({ error: message });
      throw error;
    }
  },

  // ============================================================
  // PRODUCTOS
  // ============================================================

  syncItems: async () => {
    set({ syncing: true, error: null });
    try {
      const result = await mercadoLibreService.syncItems();
      set({ syncing: false });
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error sincronizando items';
      set({ error: message, syncing: false });
      throw error;
    }
  },

  vincularProducto: async (mlProductMapId, productoId, productoSku, productoNombre) => {
    try {
      await mercadoLibreService.vincularProducto(mlProductMapId, productoId, productoSku, productoNombre);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error vinculando producto';
      set({ error: message });
      throw error;
    }
  },

  desvincularProducto: async (mlProductMapId) => {
    try {
      await mercadoLibreService.desvincularProducto(mlProductMapId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desvinculando producto';
      set({ error: message });
      throw error;
    }
  },

  // ============================================================
  // STOCK SYNC
  // ============================================================

  syncStock: async (productoId?: string) => {
    set({ syncingStock: true, error: null });
    try {
      const result = await mercadoLibreService.syncStock(productoId);
      set({ syncingStock: false });
      return { synced: result.synced, errors: result.errors };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error sincronizando stock';
      set({ error: message, syncingStock: false });
      throw error;
    }
  },

  // ============================================================
  // PRECIOS
  // ============================================================

  updatePrice: async (mlProductMapId, newPrice) => {
    try {
      await mercadoLibreService.updatePrice(mlProductMapId, newPrice);
      // Firestore listener auto-actualiza mlPrice en el estado local
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error actualizando precio';
      set({ error: message });
      throw error;
    }
  },

  // ============================================================
  // PREGUNTAS
  // ============================================================

  fetchQuestions: async () => {
    try {
      const result = await mercadoLibreService.getQuestions();
      set({ questions: result.questions, questionsTotal: result.total });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error obteniendo preguntas';
      set({ error: message });
    }
  },

  answerQuestion: async (questionId, text) => {
    try {
      await mercadoLibreService.answerQuestion(questionId, text);
      await get().fetchQuestions();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error respondiendo pregunta';
      set({ error: message });
      throw error;
    }
  },

  // ============================================================
  // PROCESAMIENTO DE ÓRDENES
  // ============================================================

  procesarOrden: async (orderSyncId) => {
    set({ procesando: true, procesandoOrderId: orderSyncId, error: null });
    try {
      const result = await mercadoLibreService.procesarOrden(orderSyncId);
      set({ procesando: false, procesandoOrderId: null });
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error procesando orden';
      set({ error: message, procesando: false, procesandoOrderId: null });
      throw error;
    }
  },

  procesarPendientes: async () => {
    set({ procesando: true, error: null });
    try {
      const result = await mercadoLibreService.procesarPendientes();
      set({ procesando: false });
      return { procesadas: result.procesadas, errores: result.errores };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error procesando pendientes';
      set({ error: message, procesando: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
