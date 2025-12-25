import { create } from 'zustand';
import type { Unsubscribe } from 'firebase/firestore';
import { NotificationService } from '../services/notification.service';
import type {
  SystemNotification,
  NotificationCounts,
  NotificationFilters
} from '../types/notification.types';

interface SystemNotificationState {
  // Estado
  notificaciones: SystemNotification[];
  contadores: NotificationCounts;
  cargando: boolean;
  error: string | null;

  // Suscripción en tiempo real
  unsubscribe: Unsubscribe | null;

  // Acciones
  iniciarSuscripcion: () => void;
  detenerSuscripcion: () => void;
  cargarNotificaciones: (filtros?: NotificationFilters) => Promise<void>;
  cargarContadores: () => Promise<void>;
  marcarComoLeida: (id: string) => Promise<void>;
  marcarTodasComoLeidas: () => Promise<void>;
  marcarComoAccionada: (id: string) => Promise<void>;
  eliminar: (id: string) => Promise<void>;
  limpiarAntiguas: () => Promise<number>;
}

export const useSystemNotificationStore = create<SystemNotificationState>((set, get) => ({
  notificaciones: [],
  contadores: {
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
  },
  cargando: false,
  error: null,
  unsubscribe: null,

  iniciarSuscripcion: () => {
    const { unsubscribe: currentUnsub } = get();
    if (currentUnsub) return; // Ya hay una suscripción activa

    const unsub = NotificationService.suscribirNoLeidas((notificaciones) => {
      set({
        notificaciones,
        contadores: {
          ...get().contadores,
          noLeidas: notificaciones.length,
          urgentes: notificaciones.filter(n => n.prioridad === 'urgente').length
        }
      });
    });

    set({ unsubscribe: unsub });
  },

  detenerSuscripcion: () => {
    const { unsubscribe } = get();
    if (unsubscribe) {
      unsubscribe();
      set({ unsubscribe: null });
    }
  },

  cargarNotificaciones: async (filtros?: NotificationFilters) => {
    set({ cargando: true, error: null });
    try {
      const notificaciones = await NotificationService.obtener(filtros);
      set({ notificaciones, cargando: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Error al cargar notificaciones',
        cargando: false
      });
    }
  },

  cargarContadores: async () => {
    try {
      const contadores = await NotificationService.obtenerContadores();
      set({ contadores });
    } catch (error) {
      console.error('Error al cargar contadores:', error);
    }
  },

  marcarComoLeida: async (id: string) => {
    try {
      await NotificationService.marcarComoLeida(id);
      set((state) => ({
        notificaciones: state.notificaciones.map((n) =>
          n.id === id ? { ...n, leida: true } : n
        ),
        contadores: {
          ...state.contadores,
          noLeidas: Math.max(0, state.contadores.noLeidas - 1)
        }
      }));
    } catch (error) {
      console.error('Error al marcar como leída:', error);
    }
  },

  marcarTodasComoLeidas: async () => {
    try {
      await NotificationService.marcarTodasComoLeidas();
      set((state) => ({
        notificaciones: state.notificaciones.map((n) => ({ ...n, leida: true })),
        contadores: { ...state.contadores, noLeidas: 0, urgentes: 0 }
      }));
    } catch (error) {
      console.error('Error al marcar todas como leídas:', error);
    }
  },

  marcarComoAccionada: async (id: string) => {
    try {
      await NotificationService.marcarComoAccionada(id);
      set((state) => ({
        notificaciones: state.notificaciones.map((n) =>
          n.id === id ? { ...n, accionada: true, leida: true } : n
        )
      }));
    } catch (error) {
      console.error('Error al marcar como accionada:', error);
    }
  },

  eliminar: async (id: string) => {
    try {
      await NotificationService.eliminar(id);
      set((state) => ({
        notificaciones: state.notificaciones.filter((n) => n.id !== id),
        contadores: {
          ...state.contadores,
          total: Math.max(0, state.contadores.total - 1)
        }
      }));
    } catch (error) {
      console.error('Error al eliminar notificación:', error);
    }
  },

  limpiarAntiguas: async () => {
    try {
      const cantidad = await NotificationService.limpiarAntiguas();
      await get().cargarContadores();
      return cantidad;
    } catch (error) {
      console.error('Error al limpiar notificaciones antiguas:', error);
      return 0;
    }
  }
}));
