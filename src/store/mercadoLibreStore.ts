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
  importingOrders: boolean;
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
  disconnect: () => Promise<void>;
  disconnecting: boolean;

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

  // Importar historial
  importHistoricalOrders: (maxOrders?: number) => Promise<{
    importadas: number;
    omitidas: number;
    errores: number;
    totalEnML: number;
  }>;

  // Re-enriquecer buyers
  reenrichingBuyers: boolean;
  reenrichBuyers: () => Promise<{
    actualizadas: number;
    clientesActualizados: number;
    errores: number;
    total: number;
  }>;

  // Migración envío
  patchEnvio: () => Promise<{ parchadas: number; sinCambio: number; sinMetodo: number; total: number }>;

  // Fix ventas históricas
  fixingVentas: boolean;
  fixVentasHistoricas: () => Promise<{
    corregidas: number;
    sinCambio: number;
    gastosEliminados: number;
    total: number;
  }>;

  // Reparar ventas Urbano
  repararVentasUrbano: () => Promise<{
    reparadas: number;
    omitidas: number;
    errores: number;
    total: number;
    detalles: string[];
  }>;

  // Reparar nombres y DNI
  repararNombresDni: () => Promise<{
    reparadas: number;
    omitidas: number;
    errores: number;
    total: number;
    detalles: string[];
  }>;

  // Buy Box / Competencia
  syncingBuyBox: boolean;
  syncBuyBox: () => Promise<{ checked: number; winning: number; competing: number; sharing: number; listed: number; errors: number }>;

  // Pack order consolidation
  consolidatingPacks: boolean;
  consolidatePackOrders: (dryRun?: boolean) => Promise<{ duplicatesFound: number; fixed: number; log: string[] }>;

  // Diagnóstico del sistema
  runningDiagnostic: boolean;
  diagnosticoSistema: () => Promise<{ totalIssues: number; criticas: number; altas: number; medias: number; issues: any[]; log: string[] }>;

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
  importingOrders: false,
  reenrichingBuyers: false,
  fixingVentas: false,
  syncingBuyBox: false,
  consolidatingPacks: false,
  runningDiagnostic: false,
  disconnecting: false,
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

  disconnect: async () => {
    set({ disconnecting: true, error: null });
    try {
      // BUG-001 fix: cancel listeners BEFORE writing to Firestore
      // to prevent onConfigChange from receiving the intermediate snapshot
      get().cleanup();
      await mercadoLibreService.disconnect();
      set({
        config: null,
        productMaps: [],
        orderSyncs: [],
        questions: [],
        questionsTotal: 0,
        disconnecting: false,
        initialized: false,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconectando ML';
      set({ error: message, disconnecting: false });
      // Re-initialize listeners if disconnect failed
      get().initialize();
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

  // ============================================================
  // IMPORTAR HISTORIAL
  // ============================================================

  importHistoricalOrders: async (maxOrders = 100) => {
    set({ importingOrders: true, error: null });
    try {
      const result = await mercadoLibreService.importHistoricalOrders(maxOrders);
      set({ importingOrders: false });
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error importando historial';
      set({ error: message, importingOrders: false });
      throw error;
    }
  },

  // ============================================================
  // RE-ENRIQUECER BUYERS
  // ============================================================

  reenrichBuyers: async () => {
    set({ reenrichingBuyers: true, error: null });
    try {
      const result = await mercadoLibreService.reenrichBuyers();
      set({ reenrichingBuyers: false });
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error actualizando datos de buyers';
      set({ error: message, reenrichingBuyers: false });
      throw error;
    }
  },

  // ============================================================
  // PATCH ENVÍO (migración)
  // ============================================================

  patchEnvio: async () => {
    set({ error: null });
    try {
      const result = await mercadoLibreService.patchEnvio();
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error parcheando envíos';
      set({ error: message });
      throw error;
    }
  },

  // ============================================================
  // FIX VENTAS HISTÓRICAS
  // ============================================================

  fixVentasHistoricas: async () => {
    set({ fixingVentas: true, error: null });
    try {
      const result = await mercadoLibreService.fixVentasHistoricas();
      set({ fixingVentas: false });
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error corrigiendo ventas históricas';
      set({ error: message, fixingVentas: false });
      throw error;
    }
  },

  // ============================================================
  // REPARAR VENTAS URBANO
  // ============================================================

  repararVentasUrbano: async () => {
    set({ error: null });
    try {
      const result = await mercadoLibreService.repararVentasUrbano();
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error reparando ventas Urbano';
      set({ error: message });
      throw error;
    }
  },

  // ============================================================
  // REPARAR NOMBRES Y DNI
  // ============================================================

  repararNombresDni: async () => {
    set({ error: null });
    try {
      const result = await mercadoLibreService.repararNombresDni();
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error reparando nombres/DNI';
      set({ error: message });
      throw error;
    }
  },

  // ============================================================
  // BUY BOX / COMPETENCIA
  // ============================================================

  syncBuyBox: async () => {
    set({ syncingBuyBox: true, error: null });
    try {
      const result = await mercadoLibreService.syncBuyBox();
      set({ syncingBuyBox: false });
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error sincronizando competencia';
      set({ error: message, syncingBuyBox: false });
      throw error;
    }
  },

  // ============================================================
  // CONSOLIDAR PACK ORDERS
  // ============================================================

  consolidatePackOrders: async (dryRun = true) => {
    set({ consolidatingPacks: true, error: null });
    try {
      const result = await mercadoLibreService.consolidatePackOrders(dryRun);
      set({ consolidatingPacks: false });
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error consolidando pack orders';
      set({ error: message, consolidatingPacks: false });
      throw error;
    }
  },

  // ============================================================
  // DIAGNÓSTICO DEL SISTEMA
  // ============================================================

  diagnosticoSistema: async () => {
    set({ runningDiagnostic: true, error: null });
    try {
      const result = await mercadoLibreService.diagnosticoSistema();
      set({ runningDiagnostic: false });
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error ejecutando diagnóstico';
      set({ error: message, runningDiagnostic: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
