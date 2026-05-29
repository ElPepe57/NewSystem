import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useCollaborationStore } from '../store/collaborationStore';
import { useToastStore } from '../store/toastStore';
import { presenciaService } from '../services/presencia.service';
import { actividadService } from '../services/actividad.service';
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

  // === 3. Iniciar suscripciones de colaboración ===
  useEffect(() => {
    if (!userProfile?.uid) return;

    const { iniciarTodo, detenerTodo } = useCollaborationStore.getState();
    iniciarTodo();

    // chk5.PERF-LISTENERS (2026-05-29) · ELIMINADAS las tareas de mantenimiento
    // global que corrían en CADA arranque de CADA cliente:
    //   - userService.getAll() → leía TODA la colección users solo para limpiar presencia
    //   - presenciaService.limpiarHuerfanos() → leía+borraba presencia ajena → permission-denied
    //     repetido (las reglas Firestore correctamente lo bloquean para no-admin)
    //   - llamadaService.limpiarLlamadasAntiguas() → similar
    // Son mantenimiento GLOBAL · deben correr en un Cloud Function programado (cron),
    // NO en el cliente. Ejecutarlas acá generaba tráfico + errores en cada sesión.
    // DEUDA: mover estas 3 limpiezas a una Cloud Function scheduled (o TTL de Firestore).

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
