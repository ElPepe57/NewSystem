import { create } from 'zustand';
import type { Unsubscribe } from 'firebase/firestore';
import { presenciaService } from '../services/presencia.service';
import { actividadService } from '../services/actividad.service';
import { chatService, getDMCanalId } from '../services/chat.service';
import { llamadaService } from '../services/llamada.service';
import { useAuthStore } from './authStore';
import type {
  PresenciaUsuario,
  ActividadReciente,
  ChatMensaje,
  LlamadaActiva,
  TipoLlamada,
} from '../types/collaboration.types';
import { LLAMADA_RING_TIMEOUT_MS } from '../types/collaboration.types';

interface CanalUsuario {
  uid: string;
  displayName: string;
}

interface CollaborationState {
  // === Presencia ===
  usuariosOnline: PresenciaUsuario[];
  unsubPresencia: Unsubscribe | null;

  // === Actividad ===
  actividades: ActividadReciente[];
  unsubActividad: Unsubscribe | null;

  // === Chat ===
  mensajes: ChatMensaje[];
  mensajesNoLeidos: number;
  unsubChat: Unsubscribe | null;
  canalActivo: string;
  canalUsuario: CanalUsuario | null;

  // === Llamada ===
  llamadaActiva: boolean;
  llamadaUsuario: CanalUsuario | null; // null = llamada de equipo
  llamadaId: string | null;                  // ID del doc de llamada en Firestore
  llamadaEntrante: LlamadaActiva | null;     // Llamada entrante que esta sonando
  unsubLlamadas: Unsubscribe | null;         // Sub a llamadas entrantes
  unsubLlamadaActiva: Unsubscribe | null;    // Sub al doc de llamada actual
  roomUrl: string | null;                    // Daily.co room URL para la llamada activa
  _ringTimeout: ReturnType<typeof setTimeout> | null; // Timeout para no_contestada (interno)

  // === UI ===
  panelAbierto: boolean;
  tabActivo: 'equipo' | 'chat';

  // === Acciones ===
  iniciarTodo: () => void;
  detenerTodo: () => void;
  enviarMensaje: (texto: string, userId: string, displayName: string) => Promise<void>;
  togglePanel: () => void;
  setTab: (tab: 'equipo' | 'chat') => void;
  marcarChatLeido: () => void;
  iniciarLlamada: (usuario?: CanalUsuario) => void;
  finalizarLlamada: () => void;
  abrirDM: (usuario: PresenciaUsuario, currentUid: string) => void;
  volverAGeneral: () => void;

  // === Acciones Signaling ===
  iniciarLlamadaConSignaling: (
    myUid: string,
    myNombre: string,
    myRole: string,
    usuario?: CanalUsuario
  ) => Promise<void>;
  aceptarLlamadaEntrante: () => Promise<void>;
  rechazarLlamadaEntrante: () => Promise<void>;
  finalizarLlamadaConSignaling: () => Promise<void>;
}

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  // Estado inicial
  usuariosOnline: [],
  unsubPresencia: null,
  actividades: [],
  unsubActividad: null,
  mensajes: [],
  mensajesNoLeidos: 0,
  unsubChat: null,
  canalActivo: 'general',
  canalUsuario: null,
  llamadaActiva: false,
  llamadaUsuario: null,
  llamadaId: null,
  llamadaEntrante: null,
  unsubLlamadas: null,
  unsubLlamadaActiva: null,
  roomUrl: null,
  _ringTimeout: null,
  panelAbierto: false,
  tabActivo: 'equipo',

  iniciarTodo: () => {
    const state = get();

    // Evitar doble suscripcion
    if (state.unsubPresencia || state.unsubActividad || state.unsubChat) return;

    // 1. Presencia
    const unsubPresencia = presenciaService.suscribirPresencia((usuarios) => {
      set({ usuariosOnline: usuarios });
    });

    // 2. Actividad
    const unsubActividad = actividadService.suscribirActividad((actividades) => {
      set({ actividades });
    });

    // 3. Chat (general por defecto)
    const unsubChat = chatService.suscribirMensajes((mensajes) => {
      const { panelAbierto, tabActivo, mensajes: prevMensajes } = get();
      const chatVisible = panelAbierto && tabActivo === 'chat';

      if (!chatVisible && mensajes.length > prevMensajes.length) {
        const nuevos = mensajes.length - prevMensajes.length;
        set(s => ({ mensajes, mensajesNoLeidos: s.mensajesNoLeidos + nuevos }));
      } else {
        set({ mensajes, mensajesNoLeidos: chatVisible ? 0 : get().mensajesNoLeidos });
      }
    });

    // 4. Llamadas entrantes
    const { userProfile } = useAuthStore.getState();
    let unsubLlamadas: Unsubscribe | null = null;
    if (userProfile?.uid) {
      unsubLlamadas = llamadaService.suscribirLlamadasEntrantes(
        userProfile.uid,
        (llamadas) => {
          // Si estamos en una llamada activa, ignorar entrantes
          const { llamadaActiva } = get();
          if (llamadaActiva) return;

          // Tomar la primera llamada sonando (normalmente solo hay una)
          const llamadaEntrante = llamadas.length > 0 ? llamadas[0] : null;
          set({ llamadaEntrante });
        }
      );
    }

    set({ unsubPresencia, unsubActividad, unsubChat, unsubLlamadas });
  },

  detenerTodo: () => {
    const { unsubPresencia, unsubActividad, unsubChat, unsubLlamadas, unsubLlamadaActiva } = get();
    if (unsubPresencia) unsubPresencia();
    if (unsubActividad) unsubActividad();
    if (unsubChat) unsubChat();
    if (unsubLlamadas) unsubLlamadas();
    if (unsubLlamadaActiva) unsubLlamadaActiva();
    set({
      unsubPresencia: null,
      unsubActividad: null,
      unsubChat: null,
      unsubLlamadas: null,
      unsubLlamadaActiva: null,
      canalActivo: 'general',
      canalUsuario: null,
      llamadaEntrante: null,
      llamadaId: null,
    });
  },

  enviarMensaje: async (texto, userId, displayName) => {
    if (!texto.trim()) return;
    const { canalActivo, mensajes } = get();
    const { userProfile } = useAuthStore.getState();

    // Optimistic UI: mostrar el mensaje inmediatamente antes de que Firestore confirme
    const mensajeOptimista = {
      id: `_optimistic_${Date.now()}`,
      texto: texto.trim(),
      userId,
      displayName,
      canalId: canalActivo,
      timestamp: { toDate: () => new Date(), toMillis: () => Date.now() } as any,
      photoURL: userProfile?.photoURL,
    };
    set({ mensajes: [...mensajes, mensajeOptimista] });

    // Enviar a Firestore (el listener real reemplazará el mensaje optimista)
    await chatService.enviarMensaje(texto, userId, displayName, canalActivo, userProfile?.photoURL);
  },

  abrirDM: (usuario, currentUid) => {
    const { unsubChat } = get();
    if (unsubChat) unsubChat();

    const canalId = getDMCanalId(currentUid, usuario.uid);

    const newUnsub = chatService.suscribirMensajesCanal(canalId, (mensajes) => {
      set({ mensajes });
    });

    set({
      canalActivo: canalId,
      canalUsuario: { uid: usuario.uid, displayName: usuario.displayName },
      unsubChat: newUnsub,
      mensajes: [],
      mensajesNoLeidos: 0,
      tabActivo: 'chat',
      panelAbierto: true,
    });
  },

  volverAGeneral: () => {
    const { unsubChat } = get();
    if (unsubChat) unsubChat();

    const newUnsub = chatService.suscribirMensajes((mensajes) => {
      const { panelAbierto, tabActivo, mensajes: prevMensajes } = get();
      const chatVisible = panelAbierto && tabActivo === 'chat';

      if (!chatVisible && mensajes.length > prevMensajes.length) {
        const nuevos = mensajes.length - prevMensajes.length;
        set(s => ({ mensajes, mensajesNoLeidos: s.mensajesNoLeidos + nuevos }));
      } else {
        set({ mensajes, mensajesNoLeidos: chatVisible ? 0 : get().mensajesNoLeidos });
      }
    });

    set({
      canalActivo: 'general',
      canalUsuario: null,
      unsubChat: newUnsub,
      mensajes: [],
    });
  },

  togglePanel: () => {
    const { panelAbierto, tabActivo } = get();
    const nuevoEstado = !panelAbierto;
    set({ panelAbierto: nuevoEstado });

    if (nuevoEstado && tabActivo === 'chat') {
      set({ mensajesNoLeidos: 0 });
    }
  },

  setTab: (tab) => {
    set({ tabActivo: tab });
    if (tab === 'chat') {
      set({ mensajesNoLeidos: 0 });
    }
  },

  marcarChatLeido: () => set({ mensajesNoLeidos: 0 }),

  // Accion local legacy (mantener por compatibilidad)
  iniciarLlamada: (usuario?: CanalUsuario) => {
    set({ llamadaActiva: true, llamadaUsuario: usuario || null });
  },

  finalizarLlamada: () => {
    set({ llamadaActiva: false, llamadaUsuario: null, roomUrl: null });
  },

  // =========================================================
  // SIGNALING ACTIONS
  // =========================================================

  iniciarLlamadaConSignaling: async (myUid, myNombre, myRole, usuario) => {
    const { llamadaActiva } = get();
    if (llamadaActiva) return;

    const tipo: TipoLlamada = usuario ? 'directa' : 'equipo';
    const roomName = usuario
      ? `vspdm-${[myUid, usuario.uid].sort().map(id => id.slice(0, 6)).join('-')}`
      : 'vspteam';

    // Construir array de participantes
    let participantes: string[];
    if (usuario) {
      participantes = [myUid, usuario.uid];
    } else {
      const { usuariosOnline } = get();
      participantes = usuariosOnline.map(u => u.uid);
      if (!participantes.includes(myUid)) {
        participantes.push(myUid);
      }
    }

    try {
      // Crear sala Daily.co via Cloud Function
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const createDailyRoomFn = httpsCallable<
        { roomName: string; isTeamCall: boolean },
        { success: boolean; roomUrl: string; roomName: string }
      >(functions, 'createDailyRoom');

      const roomResult = await createDailyRoomFn({
        roomName,
        isTeamCall: tipo === 'equipo',
      });

      if (!roomResult.data.success || !roomResult.data.roomUrl) {
        console.error('Failed to create Daily room');
        return;
      }

      const roomUrl = roomResult.data.roomUrl;

      const { userProfile } = useAuthStore.getState();
      const llamadaId = await llamadaService.crearLlamada({
        tipo,
        estado: 'sonando',
        creadorId: myUid,
        creadorNombre: myNombre,
        creadorRole: myRole as LlamadaActiva['creadorRole'],
        creadorPhotoURL: userProfile?.photoURL,
        destinatarioId: usuario?.uid,
        destinatarioNombre: usuario?.displayName,
        participantes,
        roomName,
        roomUrl,
        creadoEn: null as unknown as LlamadaActiva['creadoEn'], // Set by service
      });

      // Activar estado local de llamada
      set({
        llamadaActiva: true,
        llamadaUsuario: usuario || null,
        llamadaId,
        roomUrl,
      });

      // Suscribirse al doc para rastrear cambios de estado
      const unsubLlamadaActiva = llamadaService.suscribirLlamada(
        llamadaId,
        (llamada) => {
          if (!llamada) return;
          const currentId = get().llamadaId;
          if (currentId !== llamadaId) return; // Stale listener

          // Llamada aceptada -> cancelar timeout de no_contestada
          if (llamada.estado === 'activa') {
            const { _ringTimeout } = get();
            if (_ringTimeout) {
              clearTimeout(_ringTimeout);
              set({ _ringTimeout: null });
            }
          }

          if (llamada.estado === 'rechazada' || llamada.estado === 'no_contestada' || llamada.estado === 'finalizada') {
            const { unsubLlamadaActiva: unsub, _ringTimeout } = get();
            if (_ringTimeout) clearTimeout(_ringTimeout);
            if (unsub) unsub();
            set({
              llamadaActiva: false,
              llamadaUsuario: null,
              llamadaId: null,
              unsubLlamadaActiva: null,
              roomUrl: null,
              _ringTimeout: null,
            });
          }
        }
      );

      set({ unsubLlamadaActiva });

      // Auto-timeout: marcar como no_contestada despues de 30s
      const ringTimeout = setTimeout(async () => {
        const currentState = get();
        if (currentState.llamadaId === llamadaId && currentState.llamadaActiva) {
          try {
            await llamadaService.marcarNoContestada(llamadaId);
          } catch {
            // Puede fallar si ya fue actualizado — ok
          }
        }
        set({ _ringTimeout: null });
      }, LLAMADA_RING_TIMEOUT_MS);
      set({ _ringTimeout: ringTimeout });

    } catch (error) {
      console.error('Error creando llamada:', error);
    }
  },

  aceptarLlamadaEntrante: async () => {
    const { llamadaEntrante } = get();
    if (!llamadaEntrante) return;

    const llamadaId = llamadaEntrante.id;
    const roomUrl = llamadaEntrante.roomUrl || null;

    try {
      await llamadaService.aceptarLlamada(llamadaId);

      // Abrir DailyCallModal con los datos de la llamada
      set({
        llamadaActiva: true,
        llamadaUsuario: llamadaEntrante.tipo === 'directa'
          ? { uid: llamadaEntrante.creadorId, displayName: llamadaEntrante.creadorNombre }
          : null,
        llamadaId,
        llamadaEntrante: null,
        roomUrl,
      });

      // Suscribirse al doc para detectar hang-up del otro lado
      const unsubLlamadaActiva = llamadaService.suscribirLlamada(
        llamadaId,
        (llamada) => {
          if (!llamada) return;
          const currentId = get().llamadaId;
          if (currentId !== llamadaId) return;

          if (llamada.estado === 'finalizada' || llamada.estado === 'no_contestada' || llamada.estado === 'rechazada') {
            const { unsubLlamadaActiva: unsub } = get();
            if (unsub) unsub();
            set({
              llamadaActiva: false,
              llamadaUsuario: null,
              llamadaId: null,
              unsubLlamadaActiva: null,
              roomUrl: null,
            });
          }
        }
      );

      set({ unsubLlamadaActiva });
    } catch (error) {
      console.error('Error aceptando llamada:', error);
    }
  },

  rechazarLlamadaEntrante: async () => {
    const { llamadaEntrante } = get();
    if (!llamadaEntrante) return;

    try {
      await llamadaService.rechazarLlamada(llamadaEntrante.id);
    } catch (error) {
      console.error('Error rechazando llamada:', error);
    }
    set({ llamadaEntrante: null });
  },

  finalizarLlamadaConSignaling: async () => {
    const { llamadaId, unsubLlamadaActiva, _ringTimeout } = get();

    if (_ringTimeout) clearTimeout(_ringTimeout);

    if (llamadaId) {
      try {
        await llamadaService.finalizarLlamada(llamadaId);
      } catch (error) {
        console.error('Error finalizando llamada:', error);
      }
    }

    if (unsubLlamadaActiva) unsubLlamadaActiva();

    set({
      llamadaActiva: false,
      llamadaUsuario: null,
      llamadaId: null,
      unsubLlamadaActiva: null,
      roomUrl: null,
      _ringTimeout: null,
    });
  },
}));
