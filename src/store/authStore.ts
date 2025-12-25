import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { UserProfile } from '../types/auth.types';
import { userService } from '../services/user.service';
import { auditoriaService } from '../services/auditoria.service';

interface AuthState {
  user: User | null;
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchUserProfile: (uid: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userProfile: null,
  isAuthenticated: false,
  loading: true,
  error: null,

  setUser: (user) => set({
    user,
    isAuthenticated: !!user,
    error: null
  }),

  setUserProfile: (userProfile) => set({ userProfile }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  fetchUserProfile: async (uid: string) => {
    try {
      let profile = await userService.getByUid(uid);

      // Si no existe el perfil, crear uno con rol invitado
      if (!profile) {
        const user = useAuthStore.getState().user;
        if (user) {
          profile = await userService.createProfile(
            uid,
            user.email || '',
            user.displayName || user.email || 'Usuario',
            'invitado'
          );
        }
      } else {
        // Actualizar última conexión
        await userService.updateLastConnection(uid);
      }

      set({ userProfile: profile });

      // Registrar login en auditoría (después de establecer el perfil)
      await auditoriaService.logLogin(true);
    } catch (error: any) {
      console.error('Error al obtener perfil de usuario:', error);
      set({ error: error.message });
    }
  },

  logout: async () => {
    // Registrar logout en auditoría ANTES de limpiar el estado
    await auditoriaService.logLogout();
    set({
      user: null,
      userProfile: null,
      isAuthenticated: false,
      error: null
    });
  },
}));
