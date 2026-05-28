import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { UserProfile } from '../types/auth.types';
import { userService } from '../services/user.service';
import { auditoriaService } from '../services/auditoria.service';
import { sesionService } from '../services/sesion.service';

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

      // Si no existe el perfil, crear uno con rol invitado y activo: false (pendiente de aprobación)
      if (!profile) {
        const user = useAuthStore.getState().user;
        if (user) {
          profile = await userService.createProfile(
            uid,
            user.email || '',
            user.displayName || user.email || 'Usuario',
            'invitado',
            undefined,
            false // activo: false - requiere aprobación del admin
          );
        }
      } else {
        // chk5.AUTH-GUARD (2026-05-28) · GUARD CRÍTICO de integridad de identidad.
        // Detectar mismatch entre el email del Firebase Auth user y el email del
        // UserProfile en Firestore. Si NO coinciden · es un cruce de datos peligroso
        // (el doc users/{uid} tiene un email distinto al usuario autenticado).
        // Causa típica: data legacy donde alguien creó docs users/X con email Y
        // que no corresponde al Auth user X.
        // Comportamiento: NO setear userProfile · forzar logout · mostrar error.
        const authUser = useAuthStore.getState().user;
        const authEmail = authUser?.email?.toLowerCase().trim();
        const profileEmail = profile.email?.toLowerCase().trim();
        if (authEmail && profileEmail && authEmail !== profileEmail) {
          console.error(
            '[authStore] CRUCE DE IDENTIDAD DETECTADO · Firebase Auth dice ' +
              `email="${authEmail}" pero el doc users/${uid} tiene email="${profileEmail}". ` +
              'El UserProfile NO se va a cargar · forzando logout por seguridad.',
          );
          set({
            userProfile: null,
            error:
              `Cruce de identidad detectado. La cuenta de Firebase Auth (${authEmail}) ` +
              `no coincide con el UserProfile en Firestore (${profileEmail}). ` +
              'Contactá al admin del sistema · puede ser data legacy corrupta.',
          });
          // Hacer logout async · no bloquear el flow
          (async () => {
            try {
              const { AuthService } = await import('../services/auth.service');
              await AuthService.logout();
            } catch (e) {
              console.error('[authStore] error al forzar logout:', e);
            }
          })();
          return;
        }

        // Solo actualizar última conexión si el usuario está activo
        if (profile.activo) {
          await userService.updateLastConnection(uid);
        }
      }

      set({ userProfile: profile });

      // Solo registrar login en auditoría para usuarios activos
      if (profile?.activo) {
        await auditoriaService.logLogin(true);
        // chk5.F4-USERS · 2026-05-26 · iniciar tracking de sesión (no bloquea login)
        sesionService.iniciar(uid).catch(() => { /* fail silently */ });
      }
    } catch (error: any) {
      console.error('Error al obtener perfil de usuario:', error);
      set({ error: error.message });
    }
  },

  logout: async () => {
    // Registrar logout en auditoría ANTES de limpiar el estado
    await auditoriaService.logLogout();
    // chk5.F4-USERS · 2026-05-26 · cerrar sesión tracking server-side
    await sesionService.cerrarActual('logout_user').catch(() => { /* fail silently */ });
    set({
      user: null,
      userProfile: null,
      isAuthenticated: false,
      error: null
    });
  },
}));
