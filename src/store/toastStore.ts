import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration: number;
  /** Para animacion de salida */
  isLeaving?: boolean;
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  addToastWithTitle: (type: ToastType, title: string, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  /** Helpers para uso mas facil */
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (type, message, duration = 4000) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2);

    set((state) => ({
      toasts: [...state.toasts, { id, type, message, duration }]
    }));

    if (duration > 0) {
      // Iniciar animacion de salida 300ms antes
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.map((t) =>
            t.id === id ? { ...t, isLeaving: true } : t
          )
        }));
      }, duration - 300);

      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id)
        }));
      }, duration);
    }
  },

  addToastWithTitle: (type, title, message, duration = 4000) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2);

    set((state) => ({
      toasts: [...state.toasts, { id, type, title, message, duration }]
    }));

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.map((t) =>
            t.id === id ? { ...t, isLeaving: true } : t
          )
        }));
      }, duration - 300);

      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id)
        }));
      }, duration);
    }
  },

  removeToast: (id) => {
    // Animacion de salida
    set((state) => ({
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, isLeaving: true } : t
      )
    }));

    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      }));
    }, 300);
  },

  // Helpers
  success: (message, title) => {
    if (title) {
      get().addToastWithTitle('success', title, message);
    } else {
      get().addToast('success', message);
    }
  },

  error: (message, title) => {
    if (title) {
      get().addToastWithTitle('error', title, message, 6000); // Errores duran mas
    } else {
      get().addToast('error', message, 6000);
    }
  },

  warning: (message, title) => {
    if (title) {
      get().addToastWithTitle('warning', title, message, 5000);
    } else {
      get().addToast('warning', message, 5000);
    }
  },

  info: (message, title) => {
    if (title) {
      get().addToastWithTitle('info', title, message);
    } else {
      get().addToast('info', message);
    }
  }
}));

// Alias para compatibilidad con codigo existente
export type NotificationType = ToastType;
export interface Notification extends Toast {}
export const useNotificationStore = useToastStore;
