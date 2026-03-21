import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  writeBatch,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  SystemNotification,
  SystemNotificationCreate,
  TipoNotificacion,
  NotificacionStockDisponibleData,
  NotificacionReservaPorVencerData,
  NotificationFilters,
  NotificationCounts,
  AccionNotificacion
} from '../types/notification.types';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';

const COLLECTION_NAME = COLLECTIONS.NOTIFICACIONES;

/**
 * Servicio unificado para gestionar notificaciones del sistema.
 *
 * Cubre dos categorías:
 * - Notificaciones operativas de ventas/reservas (métodos estáticos originales)
 * - Notificaciones automáticas de inventario (stock crítico, vencimientos)
 *
 * Todos los documentos se guardan en la misma colección Firestore.
 */
export class NotificationService {
  // ─── CRUD BÁSICO ──────────────────────────────────────────────────────────

  /**
   * Crea una nueva notificación
   */
  static async crear(
    notificacion: SystemNotificationCreate
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...notificacion,
        leida: false,
        accionada: false,
        fechaCreacion: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      logger.error('Error al crear notificación:', error);
      throw error;
    }
  }

  /**
   * Obtiene notificaciones con filtros opcionales
   */
  static async obtener(filtros: NotificationFilters = {}): Promise<SystemNotification[]> {
    try {
      let q = query(
        collection(db, COLLECTION_NAME),
        orderBy('fechaCreacion', 'desc')
      );

      if (filtros.tipo) {
        q = query(q, where('tipo', '==', filtros.tipo));
      }
      if (filtros.prioridad) {
        q = query(q, where('prioridad', '==', filtros.prioridad));
      }
      if (filtros.soloNoLeidas) {
        q = query(q, where('leida', '==', false));
      }
      if (filtros.ventaId) {
        q = query(q, where('ventaId', '==', filtros.ventaId));
      }
      if (filtros.limite) {
        q = query(q, limit(filtros.limite));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
      })) as SystemNotification[];
    } catch (error) {
      logger.error('Error al obtener notificaciones:', error);
      throw error;
    }
  }

  /**
   * Obtiene notificaciones de un usuario específico (incluyendo globales)
   */
  static async getByUsuario(
    usuarioId: string,
    limite = 50
  ): Promise<SystemNotification[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('usuarioId', 'in', [usuarioId, null]),
        orderBy('fechaCreacion', 'desc'),
        limit(limite)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SystemNotification));
    } catch {
      // Fallback sin índice compuesto
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('fechaCreacion', 'desc'),
        limit(limite)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as SystemNotification))
        .filter(n => !n.usuarioId || n.usuarioId === usuarioId);
    }
  }

  /**
   * Obtiene notificaciones no leídas de un usuario
   */
  static async getNoLeidas(usuarioId: string): Promise<SystemNotification[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('leida', '==', false),
        orderBy('fechaCreacion', 'desc'),
        limit(100)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as SystemNotification))
        .filter(n => !n.usuarioId || n.usuarioId === usuarioId);
    } catch (error) {
      logger.error('Error al obtener notificaciones no leídas:', error);
      return [];
    }
  }

  /**
   * Obtiene una notificación por ID
   */
  static async obtenerPorId(id: string): Promise<SystemNotification | null> {
    try {
      const docSnapshot = await getDoc(doc(db, COLLECTION_NAME, id));
      if (!docSnapshot.exists()) return null;
      return { id: docSnapshot.id, ...docSnapshot.data() } as SystemNotification;
    } catch (error) {
      logger.error('Error al obtener notificación:', error);
      throw error;
    }
  }

  /**
   * Obtiene contadores de notificaciones
   */
  static async obtenerContadores(): Promise<NotificationCounts> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      const counts: NotificationCounts = {
        total: 0,
        noLeidas: 0,
        urgentes: 0,
        porTipo: {}
      };

      snapshot.docs.forEach(docSnapshot => {
        const data = docSnapshot.data() as SystemNotification;
        counts.total++;
        if (!data.leida) counts.noLeidas++;
        if (data.prioridad === 'urgente' && !data.leida) counts.urgentes++;
        const tipo = data.tipo as TipoNotificacion;
        counts.porTipo[tipo] = (counts.porTipo[tipo] ?? 0) + 1;
      });

      return counts;
    } catch (error) {
      logger.error('Error al obtener contadores:', error);
      throw error;
    }
  }

  // ─── MUTACIONES DE ESTADO ─────────────────────────────────────────────────

  /**
   * Marca una notificación como leída
   */
  static async marcarComoLeida(notificacionId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, notificacionId);
      await updateDoc(docRef, { leida: true, fechaLeida: Timestamp.now() });
    } catch (error) {
      logger.error('Error al marcar notificación como leída:', error);
      throw error;
    }
  }

  /**
   * Marca una notificación como accionada
   */
  static async marcarComoAccionada(notificacionId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, notificacionId);
      await updateDoc(docRef, {
        accionada: true,
        fechaAccion: Timestamp.now()
      });
    } catch (error) {
      logger.error('Error al marcar notificación como accionada:', error);
      throw error;
    }
  }

  /**
   * Marca todas las notificaciones no leídas como leídas.
   * Si se pasa usuarioId, solo afecta las de ese usuario.
   */
  static async marcarTodasComoLeidas(usuarioId?: string): Promise<void> {
    try {
      const notificaciones = usuarioId
        ? await this.getNoLeidas(usuarioId)
        : await (async () => {
            const q = query(
              collection(db, COLLECTION_NAME),
              where('leida', '==', false)
            );
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemNotification));
          })();

      const batch = writeBatch(db);
      notificaciones.forEach(n => {
        batch.update(doc(db, COLLECTION_NAME, n.id), {
          leida: true,
          fechaLeida: Timestamp.now()
        });
      });
      await batch.commit();
    } catch (error) {
      logger.error('Error al marcar todas como leídas:', error);
      throw error;
    }
  }

  /**
   * Elimina una notificación
   */
  static async eliminar(notificacionId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, notificacionId));
    } catch (error) {
      logger.error('Error al eliminar notificación:', error);
      throw error;
    }
  }

  // ─── SUSCRIPCIONES REAL-TIME ──────────────────────────────────────────────

  /**
   * Suscripción en tiempo real a notificaciones no leídas
   */
  static suscribirNoLeidas(
    callback: (notificaciones: SystemNotification[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('leida', '==', false),
      orderBy('fechaCreacion', 'desc'),
      limit(20)
    );

    return onSnapshot(q, (snapshot) => {
      const notificaciones = snapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
      })) as SystemNotification[];
      callback(notificaciones);
    });
  }

  /**
   * Suscripción en tiempo real filtrada por usuario
   */
  static subscribeToNotificaciones(
    usuarioId: string,
    callback: (notificaciones: SystemNotification[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('usuarioId', '==', usuarioId),
      orderBy('fechaCreacion', 'desc'),
      limit(50)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const notificaciones = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as SystemNotification[];
        callback(notificaciones);
      },
      (error) => {
        logger.error('Error en suscripción de notificaciones:', error);
      }
    );
  }

  // ─── LIMPIEZA ─────────────────────────────────────────────────────────────

  /**
   * Elimina notificaciones antiguas (más de 30 días y ya leídas)
   */
  static async limpiarAntiguas(): Promise<number> {
    try {
      const fechaLimite = Timestamp.fromDate(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );

      const q = query(
        collection(db, COLLECTION_NAME),
        where('fechaCreacion', '<', fechaLimite),
        where('leida', '==', true)
      );

      const snapshot = await getDocs(q);
      const eliminaciones = snapshot.docs.map(docSnapshot =>
        deleteDoc(doc(db, COLLECTION_NAME, docSnapshot.id))
      );

      await Promise.all(eliminaciones);
      return snapshot.size;
    } catch (error) {
      logger.error('Error al limpiar notificaciones antiguas:', error);
      throw error;
    }
  }

  /**
   * Elimina notificaciones duplicadas (mantiene solo la más reciente por tipo + entidad)
   */
  static async limpiarDuplicadas(): Promise<number> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      const notificaciones = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as SystemNotification[];

      const grupos = new Map<string, SystemNotification[]>();
      notificaciones.forEach(n => {
        const key = `${n.tipo}_${n.entidadId ?? n.ventaId ?? 'global'}`;
        if (!grupos.has(key)) grupos.set(key, []);
        grupos.get(key)!.push(n);
      });

      const idsAEliminar: string[] = [];
      grupos.forEach((grupo) => {
        if (grupo.length > 1) {
          grupo.sort((a, b) => b.fechaCreacion.seconds - a.fechaCreacion.seconds);
          for (let i = 1; i < grupo.length; i++) {
            idsAEliminar.push(grupo[i].id);
          }
        }
      });

      if (idsAEliminar.length > 0) {
        const batch = writeBatch(db);
        idsAEliminar.forEach(id => batch.delete(doc(db, COLLECTION_NAME, id)));
        await batch.commit();
      }

      return idsAEliminar.length;
    } catch (error) {
      logger.error('Error al limpiar duplicados:', error);
      return 0;
    }
  }

  // ─── VERIFICACIONES ANTI-SPAM ─────────────────────────────────────────────

  /**
   * Verifica si existe una notificación activa (no accionada) para una venta y tipo
   */
  static async existeNotificacionActiva(
    ventaId: string,
    tipo: TipoNotificacion
  ): Promise<boolean> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('ventaId', '==', ventaId),
        where('tipo', '==', tipo),
        where('accionada', '==', false)
      );
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      logger.error('Error al verificar notificación activa:', error);
      return false;
    }
  }

  /**
   * Verifica si existe una notificación reciente del mismo tipo para la misma entidad.
   * Previene duplicados en las últimas 24 horas.
   */
  private static async existeNotificacionReciente(
    tipo: string,
    entidadId: string
  ): Promise<boolean> {
    try {
      const hace24h = new Date();
      hace24h.setHours(hace24h.getHours() - 24);

      const q = query(
        collection(db, COLLECTION_NAME),
        where('tipo', '==', tipo),
        limit(50)
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.some(d => {
        const data = d.data();
        const fechaCreacion = data.fechaCreacion?.toDate?.();
        return (
          (data.entidadId === entidadId || data.productoId === entidadId) &&
          fechaCreacion &&
          fechaCreacion >= hace24h
        );
      });
    } catch {
      // En caso de error, prevenir creación para evitar spam
      return true;
    }
  }

  // ─── FÁBRICA DE NOTIFICACIONES ESPECÍFICAS ────────────────────────────────

  /**
   * Notificación de stock crítico (inventario automático)
   */
  static async notificarStockCritico(
    productoId: string,
    sku: string,
    nombreProducto: string,
    stockActual: number,
    stockMinimo: number
  ): Promise<string | null> {
    if (await this.existeNotificacionReciente('stock_critico', productoId)) {
      return null;
    }
    return this.crear({
      tipo: 'stock_critico',
      titulo: 'Stock Crítico',
      mensaje: `${nombreProducto} (${sku}) tiene solo ${stockActual} unidades. Mínimo requerido: ${stockMinimo}`,
      prioridad: 'urgente',
      entidadTipo: 'producto',
      entidadId: productoId,
      productoId,
      metadata: { sku, stockActual, stockMinimo },
      creadoPor: 'sistema',

    });
  }

  /**
   * Notificación de producto próximo a vencer (inventario automático)
   */
  static async notificarProductoPorVencer(
    productoId: string,
    sku: string,
    nombreProducto: string,
    cantidad: number,
    diasRestantes: number
  ): Promise<string | null> {
    if (await this.existeNotificacionReciente('producto_por_vencer', productoId)) {
      return null;
    }
    const prioridad = diasRestantes <= 7 ? 'alta' : 'media';
    return this.crear({
      tipo: 'producto_por_vencer',
      titulo: 'Producto Por Vencer',
      mensaje: `${cantidad} unidades de ${nombreProducto} (${sku}) vencen en ${diasRestantes} días`,
      prioridad,
      entidadTipo: 'producto',
      entidadId: productoId,
      productoId,
      metadata: { sku, cantidad, diasRestantes },
      creadoPor: 'sistema',

    });
  }

  /**
   * Notificación de nueva venta
   */
  static async notificarNuevaVenta(
    ventaId: string,
    numeroVenta: string,
    cliente: string,
    total: number
  ): Promise<string> {
    return this.crear({
      tipo: 'nueva_venta',
      titulo: 'Nueva Venta',
      mensaje: `Venta ${numeroVenta} registrada para ${cliente} por S/ ${total.toFixed(2)}`,
      prioridad: 'media',
      entidadTipo: 'venta',
      entidadId: ventaId,
      ventaId,
      metadata: { numeroVenta, cliente, total },
      creadoPor: 'sistema',

    });
  }

  /**
   * Notificación de orden de compra recibida
   */
  static async notificarOrdenRecibida(
    ordenId: string,
    numeroOrden: string,
    proveedor: string,
    productos: number
  ): Promise<string> {
    return this.crear({
      tipo: 'orden_recibida',
      titulo: 'Orden Recibida',
      mensaje: `Orden ${numeroOrden} de ${proveedor} recibida con ${productos} productos`,
      prioridad: 'media',
      entidadTipo: 'orden',
      entidadId: ordenId,
      metadata: { numeroOrden, proveedor, productos },
      creadoPor: 'sistema',

    });
  }

  /**
   * Notificación genérica del sistema
   */
  static async notificarSistema(
    titulo: string,
    mensaje: string,
    prioridad: 'baja' | 'media' | 'alta' = 'media'
  ): Promise<string> {
    return this.crear({
      tipo: 'sistema',
      titulo,
      mensaje,
      prioridad,
      creadoPor: 'sistema',

    });
  }

  /**
   * Crea notificación cuando llega stock para una venta con reserva virtual
   */
  static async notificarStockDisponible(data: NotificacionStockDisponibleData): Promise<string> {
    const productosTexto = data.productos
      .map(p => `${p.nombre}: ${p.cantidadDisponible}/${p.cantidadRequerida} uds`)
      .join(', ');

    const todosDisponibles = data.productos.every(
      p => p.cantidadDisponible >= p.cantidadRequerida
    );

    const acciones: AccionNotificacion[] = [
      {
        id: 'ver',
        label: 'Ver Venta',
        tipo: 'secondary',
        accion: 'ver_venta',
        parametros: { ventaId: data.ventaId }
      }
    ];

    if (todosDisponibles) {
      acciones.unshift({
        id: 'asignar',
        label: 'Asignar Stock',
        tipo: 'primary',
        accion: 'asignar_stock',
        parametros: { ventaId: data.ventaId }
      });
    }

    return this.crear({
      tipo: 'stock_disponible',
      prioridad: todosDisponibles ? 'alta' : 'media',
      titulo: `Stock disponible para ${data.numeroVenta}`,
      mensaje: `Llegó stock para el cliente ${data.nombreCliente}`,
      detalles: productosTexto,
      ventaId: data.ventaId,
      acciones,
      creadoPor: 'sistema',

    });
  }

  /**
   * Crea notificación cuando una reserva está por vencer
   */
  static async notificarReservaPorVencer(data: NotificacionReservaPorVencerData): Promise<string> {
    return this.crear({
      tipo: 'reserva_por_vencer',
      prioridad: data.horasRestantes <= 6 ? 'urgente' : 'alta',
      titulo: `Reserva por vencer: ${data.numeroVenta}`,
      mensaje: `La reserva del cliente ${data.nombreCliente} vence en ${data.horasRestantes} horas`,
      detalles: `Vigencia hasta: ${data.vigenciaHasta.toDate().toLocaleString('es-PE')}`,
      ventaId: data.ventaId,
      fechaExpiracion: data.vigenciaHasta,
      acciones: [
        {
          id: 'extender',
          label: 'Extender Reserva',
          tipo: 'primary',
          accion: 'extender_reserva',
          parametros: { ventaId: data.ventaId }
        },
        {
          id: 'ver',
          label: 'Ver Venta',
          tipo: 'secondary',
          accion: 'ver_venta',
          parametros: { ventaId: data.ventaId }
        }
      ],
      creadoPor: 'sistema',

    });
  }
}
