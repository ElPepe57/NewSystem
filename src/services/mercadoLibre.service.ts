/**
 * Servicio frontend para Mercado Libre
 *
 * Combina llamadas a Firestore (lectura directa) con
 * Cloud Functions (operaciones que requieren la API de ML).
 */

import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../lib/firebase';
import type {
  MLConfig,
  MLProductMap,
  MLOrderSync,
  MLQuestion,
} from '../types/mercadoLibre.types';

const functions = getFunctions();

export const mercadoLibreService = {
  // ============================================================
  // CONFIGURACIÓN / CONEXIÓN
  // ============================================================

  /**
   * Obtiene el estado de conexión de ML
   */
  async getConfig(): Promise<MLConfig | null> {
    const docRef = doc(db, 'mlConfig', 'settings');
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docSnap.data() as MLConfig;
  },

  /**
   * Obtiene la URL de autorización de ML (via Cloud Function)
   */
  async getAuthUrl(): Promise<string> {
    const fn = httpsCallable<void, { url: string }>(functions, 'mlgetauthurl');
    const result = await fn();
    return result.data.url;
  },

  /**
   * Obtiene el estado de conexión (via Cloud Function)
   */
  async getStatus(): Promise<MLConfig> {
    const fn = httpsCallable<void, MLConfig>(functions, 'mlgetstatus');
    const result = await fn();
    return result.data;
  },

  /**
   * Actualiza configuración de ML
   */
  async updateConfig(data: Partial<MLConfig>): Promise<void> {
    const docRef = doc(db, 'mlConfig', 'settings');
    await updateDoc(docRef, {
      ...data,
    });
  },

  /**
   * Registra la URL del webhook en Mercado Libre (via Cloud Function)
   * Sin esto, ML no envía notificaciones de órdenes, envíos, etc.
   */
  async registerWebhook(): Promise<{
    success: boolean;
    previousUrl: string | null;
    registeredUrl: string;
    topics: string[];
  }> {
    const fn = httpsCallable<void, {
      success: boolean;
      previousUrl: string | null;
      registeredUrl: string;
      topics: string[];
    }>(functions, 'mlregisterwebhook');
    const result = await fn();
    return result.data;
  },

  /**
   * Obtiene el estado actual del webhook
   */
  async getWebhookStatus(): Promise<{ notificationUrl: string | null; topics: string[] }> {
    const fn = httpsCallable<void, { notificationUrl: string | null; topics: string[] }>(
      functions,
      'mlgetwebhookstatus'
    );
    const result = await fn();
    return result.data;
  },

  /**
   * Listener en tiempo real para el estado de configuración
   */
  onConfigChange(callback: (config: MLConfig | null) => void): Unsubscribe {
    const docRef = doc(db, 'mlConfig', 'settings');
    return onSnapshot(docRef, (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(snap.data() as MLConfig);
    });
  },

  // ============================================================
  // PRODUCTOS / MAPEO
  // ============================================================

  /**
   * Obtiene todos los productos mapeados
   */
  async getProductMaps(): Promise<MLProductMap[]> {
    const snapshot = await getDocs(
      query(collection(db, 'mlProductMap'), orderBy('mlTitle'))
    );
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as MLProductMap[];
  },

  /**
   * Sincroniza estado de competencia Buy Box para publicaciones de catálogo
   */
  async syncBuyBox(): Promise<{ checked: number; winning: number; competing: number; sharing: number; listed: number; errors: number }> {
    const fn = httpsCallable<void, { checked: number; winning: number; competing: number; sharing: number; listed: number; errors: number }>(
      functions,
      'mlsyncbuybox'
    );
    const result = await fn();
    return result.data;
  },

  /**
   * Sincroniza items de ML con Firestore (via Cloud Function)
   */
  async syncItems(): Promise<{ total: number; nuevos: number; actualizados: number }> {
    const fn = httpsCallable<void, { total: number; nuevos: number; actualizados: number }>(
      functions,
      'mlsyncitems'
    );
    const result = await fn();
    return result.data;
  },

  /**
   * Vincula un producto ML con un producto del ERP (via Cloud Function)
   */
  async vincularProducto(
    mlProductMapId: string,
    productoId: string,
    productoSku: string,
    productoNombre: string
  ): Promise<void> {
    const fn = httpsCallable<
      { mlProductMapId: string; productoId: string; productoSku: string; productoNombre: string },
      { success: boolean }
    >(functions, 'mlvinculateproduct');

    await fn({ mlProductMapId, productoId, productoSku, productoNombre });
  },

  /**
   * Desvincula un producto ML del ERP (cascade: desvincula hermanos con mismo SKU)
   */
  async desvincularProducto(mlProductMapId: string): Promise<{ cascadeCount: number }> {
    const fn = httpsCallable<
      { mlProductMapId: string },
      { success: boolean; cascadeCount: number }
    >(functions, 'mldesvincularproduct');
    const result = await fn({ mlProductMapId });
    return { cascadeCount: result.data.cascadeCount };
  },

  /**
   * Sincroniza stock del ERP hacia ML
   */
  async syncStock(productoId?: string): Promise<{ synced: number; errors: number; details: Array<{ mlItemId: string; stock: number; success: boolean; error?: string }> }> {
    const fn = httpsCallable<
      { productoId?: string },
      { synced: number; errors: number; details: Array<{ mlItemId: string; stock: number; success: boolean; error?: string }> }
    >(functions, 'mlsyncstock');
    const result = await fn({ productoId });
    return result.data;
  },

  /**
   * Migración / Reconciliación de stockPendienteML
   * Recalcula desde cero contando órdenes pendientes
   */
  async migrateStockPendiente(): Promise<{ ordenesPendientes: number; ordenesMigradas: number; productosActualizados: number; productosReseteados: number }> {
    const fn = httpsCallable<
      void,
      { ordenesPendientes: number; ordenesMigradas: number; productosActualizados: number; productosReseteados: number }
    >(functions, 'mlmigratestockpendiente');
    const result = await fn();
    return result.data;
  },

  /**
   * Actualiza el precio de una publicacion ML individual
   */
  async updatePrice(mlProductMapId: string, newPrice: number): Promise<{ success: boolean; oldPrice: number; newPrice: number }> {
    const fn = httpsCallable<
      { mlProductMapId: string; newPrice: number },
      { success: boolean; mlItemId: string; oldPrice: number; newPrice: number }
    >(functions, 'mlupdateprice');
    const result = await fn({ mlProductMapId, newPrice });
    return result.data;
  },

  /**
   * Listener en tiempo real para productos mapeados
   */
  onProductMapsChange(callback: (maps: MLProductMap[]) => void): Unsubscribe {
    const q = query(collection(db, 'mlProductMap'), orderBy('mlTitle'));
    return onSnapshot(q, (snapshot) => {
      const maps = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as MLProductMap[];
      callback(maps);
    });
  },

  // ============================================================
  // ÓRDENES
  // ============================================================

  /**
   * Obtiene las órdenes sincronizadas de ML
   */
  async getOrderSyncs(estadoFilter?: string): Promise<MLOrderSync[]> {
    let q;
    if (estadoFilter) {
      q = query(
        collection(db, 'mlOrderSync'),
        where('estado', '==', estadoFilter),
        orderBy('fechaOrdenML', 'desc'),
        limit(200)
      );
    } else {
      q = query(
        collection(db, 'mlOrderSync'),
        orderBy('fechaOrdenML', 'desc'),
        limit(200)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as MLOrderSync[];
  },

  /**
   * Listener en tiempo real para órdenes (hasta 200 para incluir historial)
   */
  onOrderSyncsChange(callback: (orders: MLOrderSync[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'mlOrderSync'),
      orderBy('fechaOrdenML', 'desc'),
      limit(200)
    );
    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as MLOrderSync[];
      callback(orders);
    });
  },

  // ============================================================
  // PREGUNTAS
  // ============================================================

  /**
   * Obtiene preguntas sin responder (via Cloud Function → ML API)
   */
  async getQuestions(): Promise<{ total: number; questions: MLQuestion[] }> {
    const fn = httpsCallable<void, { total: number; questions: MLQuestion[] }>(
      functions,
      'mlgetquestions'
    );
    const result = await fn();
    return result.data;
  },

  /**
   * Responde una pregunta (via Cloud Function → ML API)
   */
  async answerQuestion(questionId: number, text: string): Promise<void> {
    const fn = httpsCallable<
      { questionId: number; text: string },
      { success: boolean }
    >(functions, 'mlanswerquestion');
    await fn({ questionId, text });
  },

  // ============================================================
  // PROCESAMIENTO DE ÓRDENES → VENTAS ERP
  // ============================================================

  /**
   * Procesa una orden ML individual → crea venta completa en ERP
   */
  async procesarOrden(orderSyncId: string): Promise<{ ventaId: string; numeroVenta: string }> {
    const fn = httpsCallable<
      { orderSyncId: string },
      { ventaId: string; numeroVenta: string; already?: boolean }
    >(functions, 'mlprocesarorden');
    const result = await fn({ orderSyncId });
    return result.data;
  },

  /**
   * Procesa todas las órdenes pendientes con productos vinculados
   */
  async procesarPendientes(): Promise<{ procesadas: number; errores: number; detalles: any[] }> {
    const fn = httpsCallable<
      void,
      { procesadas: number; errores: number; detalles: any[] }
    >(functions, 'mlprocesarpendientes');
    const result = await fn();
    return result.data;
  },

  /**
   * Importa historial de órdenes desde ML (via Cloud Function)
   * Trae las últimas N órdenes del seller que no estén ya en el sistema.
   * Las marca con origen: "importacion_historica" para distinguirlas.
   */
  async importHistoricalOrders(maxOrders: number = 100): Promise<{
    importadas: number;
    omitidas: number;
    errores: number;
    totalEnML: number;
  }> {
    const fn = httpsCallable<
      { maxOrders: number },
      { importadas: number; omitidas: number; errores: number; totalEnML: number }
    >(functions, 'mlimporthistoricalorders');
    const result = await fn({ maxOrders });
    return result.data;
  },

  /**
   * Re-enriquece datos de buyers (nombre, DNI, teléfono, email) en todas las órdenes existentes.
   * Obtiene datos reales desde la API de ML y actualiza mlOrderSync + clientes ERP.
   */
  async reenrichBuyers(): Promise<{
    actualizadas: number;
    clientesActualizados: number;
    errores: number;
    total: number;
  }> {
    const fn = httpsCallable<
      void,
      { actualizadas: number; clientesActualizados: number; errores: number; total: number }
    >(functions, 'mlreenrichbuyers');
    const result = await fn();
    return result.data;
  },

  async patchEnvio(): Promise<{
    parchadas: number;
    sinCambio: number;
    sinMetodo: number;
    total: number;
    detalles: Array<{ orderId: number; metodo: string; costoEnvioCliente: number; cargoEnvioML: number }>;
  }> {
    const fn = httpsCallable<
      void,
      { parchadas: number; sinCambio: number; sinMetodo: number; total: number; detalles: any[] }
    >(functions, 'mlpatchenvio');
    const result = await fn();
    return result.data;
  },

  async fixVentasHistoricas(): Promise<{
    corregidas: number;
    sinCambio: number;
    gastosEliminados: number;
    total: number;
    detalles: Array<{
      numeroVenta: string;
      mlOrderId: string;
      metodoEnvio: string | null;
      cargoEnvioML: number;
      gastosVentaPENAntes: number;
      gastosVentaPENDespues: number;
      utilidadNetaAntes: number;
      utilidadNetaDespues: number;
      gastoCargoEliminado: boolean;
      costoEnvioAjustado: boolean;
    }>;
  }> {
    const fn = httpsCallable<
      void,
      { corregidas: number; sinCambio: number; gastosEliminados: number; total: number; detalles: any[] }
    >(functions, 'mlfixventashistoricas');
    const result = await fn();
    return result.data;
  },

  async repararVentasUrbano(): Promise<{
    reparadas: number;
    omitidas: number;
    errores: number;
    total: number;
    detalles: string[];
  }> {
    const fn = httpsCallable<
      void,
      { reparadas: number; omitidas: number; errores: number; total: number; detalles: string[] }
    >(functions, 'mlrepararventasurbano');
    const result = await fn();
    return result.data;
  },

  async repararNombresDni(): Promise<{
    reparadas: number;
    omitidas: number;
    errores: number;
    total: number;
    detalles: string[];
  }> {
    const fn = httpsCallable<
      void,
      { reparadas: number; omitidas: number; errores: number; total: number; detalles: string[] }
    >(functions, 'mlrepararnamesdni');
    const result = await fn();
    return result.data;
  },

  /**
   * Consolida pack orders duplicadas en una sola venta.
   * Corrige gastos, tesorería, rentabilidad y mlOrderSync.
   * @param dryRun - true para solo diagnóstico, false para aplicar cambios
   */
  /**
   * Diagnóstico integral del sistema ML.
   * Escanea ventas, gastos, tesorería, mlOrderSync buscando fantasmas e inconsistencias.
   */
  async diagnosticoSistema(): Promise<{
    totalIssues: number;
    criticas: number;
    altas: number;
    medias: number;
    issues: Array<{ tipo: string; severidad: string; descripcion: string; ids: string[] }>;
    log: string[];
  }> {
    const fn = httpsCallable<
      void,
      { totalIssues: number; criticas: number; altas: number; medias: number; issues: any[]; log: string[] }
    >(functions, 'mldiagnosticosistema');
    const result = await fn();
    return result.data;
  },

  async consolidatePackOrders(dryRun: boolean = true): Promise<{
    duplicatesFound: number;
    fixed: number;
    log: string[];
  }> {
    const fn = httpsCallable<
      { dryRun: boolean },
      { duplicatesFound: number; fixed: number; log: string[] }
    >(functions, 'mlconsolidatepackorders');
    const result = await fn({ dryRun });
    return result.data;
  },

  /**
   * Reingeniería de datos ML - Reconstruye registros financieros desde mlOrderSync
   */
  async reingenieria(dryRun: boolean = true, saldoRealMP?: number): Promise<{
    dryRun: boolean;
    ordenesAnalizadas: number;
    ventasActualizadas: number;
    movimientosAnulados: number;
    movimientosCreados: number;
    gastosEliminados: number;
    gastosCreados: number;
    gdUrbanoCreadosCorregidos: number;
    adelantosRespetados: number;
    ventasSinVincular: number;
    balanceMP: {
      anterior: number;
      calculado: number;
      ajusteReconciliacion: number;
      final: number;
      saldoRealMP: number | null;
    };
    log: string[];
  }> {
    const fn = httpsCallable<
      { dryRun: boolean; saldoRealMP?: number },
      any
    >(functions, 'mlreingenieria');
    const result = await fn({ dryRun, ...(saldoRealMP !== undefined ? { saldoRealMP } : {}) });
    return result.data;
  },

  /**
   * Recalcula el balance de la cuenta MercadoPago desde movimientos de tesorería
   */
  /**
   * Obtiene sugerencias de matching entre mlOrderSync pendientes y ventas ML sin vincular
   */
  async matchSuggestions(): Promise<{
    success: boolean;
    totalSyncPendientes: number;
    totalVentasSinVincular: number;
    suggestions: Array<{
      syncId: string;
      mlOrderId: number;
      syncBuyerName: string;
      syncBuyerDni: string;
      syncTotal: number;
      syncFecha: string;
      syncProductos: string;
      syncMetodoEnvio: string;
      matches: Array<{
        ventaId: string;
        numeroVenta: string;
        nombreCliente: string;
        dniRuc: string;
        totalPEN: number;
        fechaCreacion: string;
        productos: string;
        score: number;
        matchDetails: string[];
      }>;
    }>;
  }> {
    const fn = httpsCallable<void, any>(functions, 'mlmatchsuggestions');
    const result = await fn();
    return result.data;
  },

  /**
   * Confirma vinculación manual entre mlOrderSync y venta
   */
  async confirmMatch(matches: Array<{ syncId: string; ventaId: string }>): Promise<{
    success: boolean;
    total: number;
    vinculados: number;
    errores: number;
    results: Array<{ syncId: string; ventaId: string; status: string }>;
  }> {
    const fn = httpsCallable<{ matches: Array<{ syncId: string; ventaId: string }> }, any>(functions, 'mlconfirmmatch');
    const result = await fn({ matches });
    return result.data;
  },

  /**
   * Diagnostica inconsistencias financieras ML (ventas sin movimientos, montos incorrectos)
   */
  async diagInconsistencias(): Promise<{
    success: boolean;
    totalInconsistencias: number;
    totalHuerfanos: number;
    inconsistencias: Array<{
      tipo: 'sin_movimientos' | 'monto_incorrecto';
      ventaId: string;
      ventaNumero: string;
      clienteNombre: string;
      totalPENCorrecto: number;
      subtotalPEN: number;
      metodoEnvio: string;
      comisionML: number;
      cargoEnvioML: number;
      fechaVenta: string;
      movimientoActual?: { movId: string; monto: number; tipo: string; concepto: string };
      diferencia?: number;
      candidatos: Array<{
        movId: string; monto: number; tipo: string; concepto: string;
        fecha: string; score: number; matchDetail: string;
      }>;
    }>;
    huerfanos: Array<{
      movId: string; monto: number; tipo: string;
      concepto: string; fecha: string; metodo: string;
    }>;
  }> {
    const fn = httpsCallable<void, any>(functions, 'mldiaginconsistencias');
    const result = await fn();
    return result.data;
  },

  /**
   * Resuelve inconsistencias: vincular movimiento a venta, o anularlo
   */
  async resolverInconsistencias(acciones: Array<{
    movimientoId?: string;
    ventaId?: string;
    ventaNumero?: string;
    accion: 'vincular' | 'anular' | 'patch_sync';
    syncId?: string;
    patchData?: Record<string, any>;
  }>): Promise<{
    success: boolean;
    total: number;
    exitosos: number;
    errores: number;
    results: Array<{ id: string; ok: boolean; accion?: string; error?: string }>;
  }> {
    const fn = httpsCallable<{ acciones: typeof acciones }, any>(functions, 'mlresolverinconsistencias');
    const result = await fn({ acciones });
    return result.data;
  },

  async recalcularBalanceMP(dryRun: boolean = true): Promise<{
    success: boolean;
    dryRun?: boolean;
    message: string;
    saldoAnterior?: number;
    saldoNuevo?: number;
    diferencia?: number;
    movimientos?: { ingresos: number; egresos: number; total: number };
  }> {
    const fn = httpsCallable<
      { dryRun: boolean },
      any
    >(functions, 'mlrecalcularbalancemp');
    const result = await fn({ dryRun });
    return result.data;
  },
};
