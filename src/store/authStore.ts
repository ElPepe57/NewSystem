import { create } from 'zustand';
import type { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;                // <--- NUEVO
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void; // <--- NUEVO
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,                  // <--- NUEVO: Empieza cargando

  setUser: (user) => set({ 
    user, 
    isAuthenticated: !!user 
  }),

  // Esta es la función que te faltaba y causaba el error en App.tsx
  setLoading: (loading) => set({ loading }),

  logout: () => set({ 
    user: null, 
    isAuthenticated: false 
  }),
}));