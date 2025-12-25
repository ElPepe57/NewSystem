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
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  SystemNotification,
  TipoNotificacion,
  NotificacionStockDisponibleData,
  NotificacionReservaPorVencerData,
  NotificationFilters,
  NotificationCounts,
  AccionNotificacion
} from '../types/notification.types';

const COLLECTION_NAME = 'notificaciones';

/**
 * Servicio para gestionar notificaciones del sistema
 */
export class NotificationService {
  /**
   * Crea una nueva notificación
   */
  static async crear(
    notificacion: Omit<SystemNotification, 'id' | 'fechaCreacion' | 'leida' | 'accionada'>
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
      console.error('Error al crear notificación:', error);
      throw error;
    }
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
      creadoPor: 'sistema'
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
      creadoPor: 'sistema'
    });
  }

  /**
   * Marca una notificación como leída
   */
  static async marcarComoLeida(notificacionId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, notificacionId);
      await updateDoc(docRef, { leida: true });
    } catch (error) {
      console.error('Error al marcar notificación como leída:', error);
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
      console.error('Error al marcar notificación como accionada:', error);
      throw error;
    }
  }

  /**
   * Marca todas las notificaciones como leídas
   */
  static async marcarTodasComoLeidas(): Promise<void> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('leida', '==', false)
      );
      const snapshot = await getDocs(q);

      const updates = snapshot.docs.map(docSnapshot =>
        updateDoc(doc(db, COLLECTION_NAME, docSnapshot.id), { leida: true })
      );

      await Promise.all(updates);
    } catch (error) {
      console.error('Error al marcar todas como leídas:', error);
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
      console.error('Error al eliminar notificación:', error);
      throw error;
    }
  }

  /**
   * Obtiene notificaciones con filtros
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
      console.error('Error al obtener notificaciones:', error);
      throw error;
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
      console.error('Error al obtener notificación:', error);
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
        porTipo: {
          stock_disponible: 0,
          reserva_por_vencer: 0,
          reserva_vencida: 0,
          pago_recibido: 0,
          stock_bajo: 0,
          requerimiento_urgente: 0,
          general: 0
        }
      };

      snapshot.docs.forEach(docSnapshot => {
        const data = docSnapshot.data() as SystemNotification;
        counts.total++;

        if (!data.leida) counts.noLeidas++;
        if (data.prioridad === 'urgente' && !data.leida) counts.urgentes++;

        const tipo = data.tipo as TipoNotificacion;
        if (counts.porTipo[tipo] !== undefined) {
          counts.porTipo[tipo]++;
        }
      });

      return counts;
    } catch (error) {
      console.error('Error al obtener contadores:', error);
      throw error;
    }
  }

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
   * Elimina notificaciones antiguas (más de 30 días)
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
      console.error('Error al limpiar notificaciones antiguas:', error);
      throw error;
    }
  }

  /**
   * Verifica si existe una notificación activa para una venta
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
      console.error('Error al verificar notificación activa:', error);
      return false;
    }
  }
}
