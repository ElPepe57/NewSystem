import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useCollaborationStore } from '../store/collaborationStore';
import { useToastStore } from '../store/toastStore';
import { presenciaService } from '../services/presencia.service';
import { actividadService } from '../services/actividad.service';
import { userService } from '../services/user.service';
import { llamadaService } from '../services/llamada.service';
import { HEARTBEAT_INTERVAL_MS } from '../types/collaboration.types';

/**
 * Hook que inicializa todo el sistema de colaboración:
 * - Heartbeat de presencia cada 2 min
 * - Suscripciones en tiempo real (presencia, actividad, chat)
 * - Toast de actividad de otros usuarios
 * - Marca offline al desconectar
 */
export const useCollaborationInit = () => {
  const { userProfile } = useAuthStore();
  const location = useLocation();
  const toast = useToastStore();
  const actividades = useCollaborationStore(s => s.actividades);

  // Refs para controlar el heartbeat y la actividad
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ultimaActividadIdRef = useRef<string | null>(null);
  const isFirstLoadRef = useRef(true);

  // === 1. Heartbeat de presencia + registrar conexión ===
  useEffect(() => {
    if (!userProfile?.uid) return;

    const { uid, displayName, role, photoURL } = userProfile;

    // Heartbeat inmediato al montar
    presenciaService.actualizarPresencia(uid, displayName, role, location.pathname, photoURL);

    // Registrar conexión como actividad (solo primera vez)
    actividadService.registrar({
      tipo: 'usuario_conectado',
      mensaje: 'se conectó',
      userId: uid,
      displayName,
    }).catch(() => {});

    // Heartbeat periódico
    heartbeatRef.current = setInterval(() => {
      const currentProfile = useAuthStore.getState().userProfile;
      presenciaService.actualizarPresencia(
        uid,
        currentProfile?.displayName || displayName,
        currentProfile?.role || role,
        location.pathname,
        currentProfile?.photoURL
      );
    }, HEARTBEAT_INTERVAL_MS);

    // Marcar offline y finalizar llamada activa al cerrar pestaña
    const handleBeforeUnload = () => {
      presenciaService.marcarOffline(uid);
      const { llamadaId } = useCollaborationStore.getState();
      if (llamadaId) {
        llamadaService.finalizarLlamada(llamadaId).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      presenciaService.marcarOffline(uid);
    };
  }, [userProfile?.uid]);

  // === 2. Actualizar página actual cuando cambia la ruta ===
  useEffect(() => {
    if (!userProfile?.uid) return;
    presenciaService.actualizarPresencia(
      userProfile.uid,
      userProfile.displayName,
      userProfile.role,
      location.pathname,
      userProfile.photoURL
    );
  }, [location.pathname]);

  // === 3. Iniciar suscripciones de colaboración + limpiar presencia huérfana ===
  useEffect(() => {
    if (!userProfile?.uid) return;

    const { iniciarTodo, detenerTodo } = useCollaborationStore.getState();
    iniciarTodo();

    // Limpiar presencia de usuarios eliminados (una vez al iniciar)
    userService.getAll().then(users => {
      const uidsActivos = users.map(u => u.uid);
      presenciaService.limpiarHuerfanos(uidsActivos);
    }).catch(() => {});

    // Limpiar documentos de llamadas antiguos (una vez al iniciar)
    llamadaService.limpiarLlamadasAntiguas().catch(() => {});

    return () => {
      detenerTodo();
    };
  }, [userProfile?.uid]);

  // === 4. Toast de actividad de otros usuarios ===
  useEffect(() => {
    if (!userProfile?.uid || actividades.length === 0) return;

    // Ignorar la carga inicial (snapshot completo)
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      ultimaActividadIdRef.current = actividades[0]?.id || null;
      return;
    }

    const ultima = actividades[0]; // La más reciente (ordenadas desc)
    if (!ultima || ultima.id === ultimaActividadIdRef.current) return;

    ultimaActividadIdRef.current = ultima.id;

    // Solo toast si es de OTRO usuario y NO es login/logout
    if (
      ultima.userId !== userProfile.uid &&
      ultima.tipo !== 'usuario_conectado' &&
      ultima.tipo !== 'usuario_desconectado'
    ) {
      toast.info(
        `${ultima.displayName} ${ultima.mensaje}`,
        'Actividad del equipo'
      );
    }
  }, [actividades, userProfile?.uid]);
};
