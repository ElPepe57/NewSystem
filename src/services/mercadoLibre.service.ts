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
        limit(50)
      );
    } else {
      q = query(
        collection(db, 'mlOrderSync'),
        orderBy('fechaOrdenML', 'desc'),
        limit(50)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as MLOrderSync[];
  },

  /**
   * Listener en tiempo real para órdenes
   */
  onOrderSyncsChange(callback: (orders: MLOrderSync[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'mlOrderSync'),
      orderBy('fechaOrdenML', 'desc'),
      limit(50)
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
};
