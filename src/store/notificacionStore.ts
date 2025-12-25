import { create } from 'zustand';
import type { Notificacion, NotificacionStats } from '../types/notificacion.types';

interface NotificacionState {
  notificaciones: Notificacion[];
  loading: boolean;
  error: string | null;
  stats: NotificacionStats;
  // IDs de notificaciones marcadas como leídas localmente (pendientes de sincronizar)
  leidasPendientes: Set<string>;
  // IDs de notificaciones eliminadas localmente (pendientes de sincronizar)
  eliminadasPendientes: Set<string>;

  // Actions
  setNotificaciones: (notificaciones: Notificacion[]) => void;
  addNotificacion: (notificacion: Notificacion) => void;
  marcarComoLeida: (id: string) => void;
  marcarTodasComoLeidas: () => void;
  removeNotificacion: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateStats: () => void;
}

const calcularStats = (notificaciones: Notificacion[]): NotificacionStats => {
  const stats: NotificacionStats = {
    total: notificaciones.length,
    noLeidas: notificaciones.filter(n => !n.leida).length,
    urgentes: notificaciones.filter(n => n.prioridad === 'urgente' && !n.leida).length,
    porTipo: {
      stock_critico: 0,
      stock_bajo: 0,
      producto_vencido: 0,
      producto_por_vencer: 0,
      nueva_venta: 0,
      venta_entregada: 0,
      orden_recibida: 0,
      orden_en_transito: 0,
      usuario_nuevo: 0,
      sistema: 0,
      alerta: 0
    }
  };

  notificaciones.forEach(n => {
    if (!n.leida) {
      stats.porTipo[n.tipo]++;
    }
  });

  return stats;
};

export const useNotificacionStore = create<NotificacionState>((set, get) => ({
  notificaciones: [],
  loading: false,
  error: null,
  stats: {
    total: 0,
    noLeidas: 0,
    urgentes: 0,
    porTipo: {
      stock_critico: 0,
      stock_bajo: 0,
      producto_vencido: 0,
      producto_por_vencer: 0,
      nueva_venta: 0,
      venta_entregada: 0,
      orden_recibida: 0,
      orden_en_transito: 0,
      usuario_nuevo: 0,
      sistema: 0,
      alerta: 0
    }
  },
  leidasPendientes: new Set<string>(),
  eliminadasPendientes: new Set<string>(),

  setNotificaciones: (notificaciones) => {
    const { leidasPendientes, eliminadasPendientes } = get();

    // Filtrar notificaciones eliminadas localmente
    let filtradas = notificaciones.filter(n => !eliminadasPendientes.has(n.id));

    // Preservar estado "leída" para las que se marcaron localmente
    filtradas = filtradas.map(n => {
      if (leidasPendientes.has(n.id)) {
        // Si Firestore ya la tiene como leída, limpiar de pendientes
        if (n.leida) {
          leidasPendientes.delete(n.id);
        }
        return { ...n, leida: true };
      }
      return n;
    });

    // Limpiar eliminadas que ya no existen en Firestore
    eliminadasPendientes.forEach(id => {
      if (!notificaciones.find(n => n.id === id)) {
        eliminadasPendientes.delete(id);
      }
    });

    set({
      notificaciones: filtradas,
      leidasPendientes: new Set(leidasPendientes),
      eliminadasPendientes: new Set(eliminadasPendientes)
    });
    get().updateStats();
  },

  addNotificacion: (notificacion) => {
    set(state => ({
      notificaciones: [notificacion, ...state.notificaciones]
    }));
    get().updateStats();
  },

  marcarComoLeida: (id) => {
    set(state => {
      const nuevasLeidas = new Set(state.leidasPendientes);
      nuevasLeidas.add(id);
      return {
        notificaciones: state.notificaciones.map(n =>
          n.id === id ? { ...n, leida: true } : n
        ),
        leidasPendientes: nuevasLeidas
      };
    });
    get().updateStats();
  },

  marcarTodasComoLeidas: () => {
    set(state => {
      const nuevasLeidas = new Set(state.leidasPendientes);
      state.notificaciones.forEach(n => {
        if (!n.leida) {
          nuevasLeidas.add(n.id);
        }
      });
      return {
        notificaciones: state.notificaciones.map(n => ({ ...n, leida: true })),
        leidasPendientes: nuevasLeidas
      };
    });
    get().updateStats();
  },

  removeNotificacion: (id) => {
    set(state => {
      const nuevasEliminadas = new Set(state.eliminadasPendientes);
      nuevasEliminadas.add(id);
      return {
        notificaciones: state.notificaciones.filter(n => n.id !== id),
        eliminadasPendientes: nuevasEliminadas
      };
    });
    get().updateStats();
  },

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  updateStats: () => {
    const { notificaciones } = get();
    set({ stats: calcularStats(notificaciones) });
  }
}));
