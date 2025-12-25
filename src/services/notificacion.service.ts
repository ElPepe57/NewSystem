import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Notificacion, NotificacionCreate } from '../types/notificacion.types';

const COLLECTION_NAME = 'notificaciones';

class NotificacionService {
  private collectionRef = collection(db, COLLECTION_NAME);

  /**
   * Obtener todas las notificaciones de un usuario
   */
  async getByUsuario(usuarioId: string, limite: number = 50): Promise<Notificacion[]> {
    try {
      const q = query(
        this.collectionRef,
        where('usuarioId', 'in', [usuarioId, null]), // Notificaciones del usuario o globales
        orderBy('fechaCreacion', 'desc'),
        limit(limite)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notificacion));
    } catch (error: any) {
      console.error('Error al obtener notificaciones:', error);
      // Si falla por índice, intentar query más simple
      const q = query(
        this.collectionRef,
        orderBy('fechaCreacion', 'desc'),
        limit(limite)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Notificacion))
        .filter(n => !n.usuarioId || n.usuarioId === usuarioId);
    }
  }

  /**
   * Obtener notificaciones no leídas
   */
  async getNoLeidas(usuarioId: string): Promise<Notificacion[]> {
    try {
      const q = query(
        this.collectionRef,
        where('leida', '==', false),
        orderBy('fechaCreacion', 'desc'),
        limit(100)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Notificacion))
        .filter(n => !n.usuarioId || n.usuarioId === usuarioId);
    } catch (error: any) {
      console.error('Error al obtener notificaciones no leídas:', error);
      return [];
    }
  }

  /**
   * Suscribirse a notificaciones en tiempo real
   */
  subscribeToNotificaciones(
    usuarioId: string,
    callback: (notificaciones: Notificacion[]) => void
  ): () => void {
    const q = query(
      this.collectionRef,
      orderBy('fechaCreacion', 'desc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const notificaciones = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Notificacion))
        .filter(n => !n.usuarioId || n.usuarioId === usuarioId);
      callback(notificaciones);
    }, (error) => {
      console.error('Error en suscripción de notificaciones:', error);
    });
  }

  /**
   * Crear una nueva notificación
   */
  async create(data: NotificacionCreate): Promise<Notificacion> {
    try {
      // Construir objeto sin campos undefined (Firestore no los acepta)
      const notificacion: Record<string, any> = {
        tipo: data.tipo,
        titulo: data.titulo,
        mensaje: data.mensaje,
        prioridad: data.prioridad,
        leida: false,
        fechaCreacion: Timestamp.now()
      };

      // Agregar campos opcionales solo si tienen valor
      if (data.usuarioId) notificacion.usuarioId = data.usuarioId;
      if (data.entidadTipo) notificacion.entidadTipo = data.entidadTipo;
      if (data.entidadId) notificacion.entidadId = data.entidadId;
      if (data.metadata) notificacion.metadata = data.metadata;

      const docRef = await addDoc(this.collectionRef, notificacion);

      return {
        id: docRef.id,
        ...notificacion
      } as Notificacion;
    } catch (error: any) {
      console.error('Error al crear notificación:', error);
      throw new Error('Error al crear notificación');
    }
  }

  /**
   * Marcar notificación como leída
   */
  async marcarComoLeida(id: string): Promise<void> {
    try {
      const docRef = doc(this.collectionRef, id);
      await updateDoc(docRef, {
        leida: true,
        fechaLeida: Timestamp.now()
      });
    } catch (error: any) {
      console.error('Error al marcar notificación como leída:', error);
      throw new Error('Error al actualizar notificación');
    }
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  async marcarTodasComoLeidas(usuarioId: string): Promise<void> {
    try {
      const notificaciones = await this.getNoLeidas(usuarioId);
      const batch = writeBatch(db);

      notificaciones.forEach(n => {
        const docRef = doc(this.collectionRef, n.id);
        batch.update(docRef, {
          leida: true,
          fechaLeida: Timestamp.now()
        });
      });

      await batch.commit();
    } catch (error: any) {
      console.error('Error al marcar todas como leídas:', error);
      throw new Error('Error al actualizar notificaciones');
    }
  }

  /**
   * Eliminar notificación
   */
  async delete(id: string): Promise<void> {
    try {
      const docRef = doc(this.collectionRef, id);
      await deleteDoc(docRef);
    } catch (error: any) {
      console.error('Error al eliminar notificación:', error);
      throw new Error('Error al eliminar notificación');
    }
  }

  /**
   * Eliminar notificaciones duplicadas (mantiene solo la más reciente de cada tipo/entidad)
   */
  async limpiarDuplicadas(): Promise<number> {
    try {
      const snapshot = await getDocs(this.collectionRef);
      const notificaciones = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notificacion[];

      // Agrupar por tipo + entidadId
      const grupos = new Map<string, Notificacion[]>();
      notificaciones.forEach(n => {
        const key = `${n.tipo}_${n.entidadId || 'global'}`;
        if (!grupos.has(key)) {
          grupos.set(key, []);
        }
        grupos.get(key)!.push(n);
      });

      // Identificar duplicados (mantener solo el más reciente de cada grupo)
      const idsAEliminar: string[] = [];
      grupos.forEach((grupo) => {
        if (grupo.length > 1) {
          // Ordenar por fecha descendente
          grupo.sort((a, b) => b.fechaCreacion.seconds - a.fechaCreacion.seconds);
          // Eliminar todos excepto el primero (más reciente)
          for (let i = 1; i < grupo.length; i++) {
            idsAEliminar.push(grupo[i].id);
          }
        }
      });

      // Eliminar en lotes
      const batch = writeBatch(db);
      idsAEliminar.forEach(id => {
        batch.delete(doc(this.collectionRef, id));
      });

      if (idsAEliminar.length > 0) {
        await batch.commit();
      }

      return idsAEliminar.length;
    } catch (error: any) {
      console.error('Error al limpiar duplicados:', error);
      return 0;
    }
  }

  /**
   * Eliminar notificaciones antiguas (más de 30 días)
   */
  async limpiarAntiguas(): Promise<number> {
    try {
      const hace30Dias = new Date();
      hace30Dias.setDate(hace30Dias.getDate() - 30);

      const q = query(
        this.collectionRef,
        where('fechaCreacion', '<', Timestamp.fromDate(hace30Dias)),
        where('leida', '==', true)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      return snapshot.size;
    } catch (error: any) {
      console.error('Error al limpiar notificaciones antiguas:', error);
      return 0;
    }
  }

  // === MÉTODOS PARA CREAR NOTIFICACIONES ESPECÍFICAS ===

  /**
   * Verificar si ya existe una notificación reciente del mismo tipo para la misma entidad
   * Previene duplicados en las últimas 24 horas
   * Usa query simple sin índice compuesto
   */
  private async existeNotificacionReciente(
    tipo: string,
    entidadId: string
  ): Promise<boolean> {
    try {
      const hace24h = new Date();
      hace24h.setHours(hace24h.getHours() - 24);

      // Query simple por tipo (no requiere índice compuesto)
      const q = query(
        this.collectionRef,
        where('tipo', '==', tipo),
        limit(50)
      );

      const snapshot = await getDocs(q);

      // Filtrar en memoria por entidadId y fecha
      const existe = snapshot.docs.some(doc => {
        const data = doc.data();
        const fechaCreacion = data.fechaCreacion?.toDate?.();
        return data.entidadId === entidadId &&
               fechaCreacion &&
               fechaCreacion >= hace24h;
      });

      return existe;
    } catch (error) {
      // Si falla la verificación, prevenir creación para evitar spam
      console.warn('Error verificando notificación existente:', error);
      return true; // Cambiado a true para prevenir duplicados en caso de error
    }
  }

  /**
   * Notificación de stock crítico
   */
  async notificarStockCritico(
    productoId: string,
    sku: string,
    nombreProducto: string,
    stockActual: number,
    stockMinimo: number
  ): Promise<Notificacion | null> {
    // Verificar si ya existe una notificación reciente
    if (await this.existeNotificacionReciente('stock_critico', productoId)) {
      return null;
    }

    return this.create({
      tipo: 'stock_critico',
      titulo: 'Stock Crítico',
      mensaje: `${nombreProducto} (${sku}) tiene solo ${stockActual} unidades. Mínimo requerido: ${stockMinimo}`,
      prioridad: 'urgente',
      entidadTipo: 'producto',
      entidadId: productoId,
      metadata: { sku, stockActual, stockMinimo }
    });
  }

  /**
   * Notificación de producto por vencer
   */
  async notificarProductoPorVencer(
    productoId: string,
    sku: string,
    nombreProducto: string,
    cantidad: number,
    diasRestantes: number
  ): Promise<Notificacion | null> {
    // Verificar si ya existe una notificación reciente
    if (await this.existeNotificacionReciente('producto_por_vencer', productoId)) {
      return null;
    }

    const prioridad = diasRestantes <= 7 ? 'alta' : 'media';
    return this.create({
      tipo: 'producto_por_vencer',
      titulo: 'Producto Por Vencer',
      mensaje: `${cantidad} unidades de ${nombreProducto} (${sku}) vencen en ${diasRestantes} días`,
      prioridad,
      entidadTipo: 'producto',
      entidadId: productoId,
      metadata: { sku, cantidad, diasRestantes }
    });
  }

  /**
   * Notificación de nueva venta
   */
  async notificarNuevaVenta(
    ventaId: string,
    numeroVenta: string,
    cliente: string,
    total: number
  ): Promise<Notificacion> {
    return this.create({
      tipo: 'nueva_venta',
      titulo: 'Nueva Venta',
      mensaje: `Venta ${numeroVenta} registrada para ${cliente} por S/ ${total.toFixed(2)}`,
      prioridad: 'media',
      entidadTipo: 'venta',
      entidadId: ventaId,
      metadata: { numeroVenta, cliente, total }
    });
  }

  /**
   * Notificación de orden recibida
   */
  async notificarOrdenRecibida(
    ordenId: string,
    numeroOrden: string,
    proveedor: string,
    productos: number
  ): Promise<Notificacion> {
    return this.create({
      tipo: 'orden_recibida',
      titulo: 'Orden Recibida',
      mensaje: `Orden ${numeroOrden} de ${proveedor} recibida con ${productos} productos`,
      prioridad: 'media',
      entidadTipo: 'orden',
      entidadId: ordenId,
      metadata: { numeroOrden, proveedor, productos }
    });
  }

  /**
   * Notificación de sistema
   */
  async notificarSistema(
    titulo: string,
    mensaje: string,
    prioridad: 'baja' | 'media' | 'alta' = 'media'
  ): Promise<Notificacion> {
    return this.create({
      tipo: 'sistema',
      titulo,
      mensaje,
      prioridad
    });
  }
}

export const notificacionService = new NotificacionService();
