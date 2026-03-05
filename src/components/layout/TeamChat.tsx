import React, { useState, useRef, useEffect } from 'react';
import { Send, Phone, ArrowLeft, Users } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useCollaborationStore } from '../../store/collaborationStore';
import { actividadService } from '../../services/actividad.service';
import type { ChatMensaje } from '../../types/collaboration.types';

function formatChatTime(timestamp: { toMillis: () => number }): string {
  const date = new Date(timestamp.toMillis());
  return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function formatChatDate(timestamp: { toMillis: () => number }): string {
  const date = new Date(timestamp.toMillis());
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);

  if (date.toDateString() === hoy.toDateString()) return 'Hoy';
  if (date.toDateString() === ayer.toDateString()) return 'Ayer';
  return date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'from-red-500 to-orange-500',
  vendedor: 'from-blue-500 to-cyan-500',
  almacenero: 'from-green-500 to-emerald-500',
  invitado: 'from-gray-400 to-gray-500',
};

export const TeamChat: React.FC = () => {
  const { userProfile } = useAuthStore();
  const mensajes = useCollaborationStore(s => s.mensajes);
  const enviarMensaje = useCollaborationStore(s => s.enviarMensaje);
  const llamadaActiva = useCollaborationStore(s => s.llamadaActiva);
  const iniciarLlamadaConSignaling = useCollaborationStore(s => s.iniciarLlamadaConSignaling);
  const canalUsuario = useCollaborationStore(s => s.canalUsuario);
  const volverAGeneral = useCollaborationStore(s => s.volverAGeneral);
  const usuariosOnline = useCollaborationStore(s => s.usuariosOnline);

  const isDM = canalUsuario !== null;

  // Obtener foto del usuario DM desde la lista de presencia
  const dmUserPhoto = isDM
    ? usuariosOnline.find(u => u.uid === canalUsuario.uid)?.photoURL
    : undefined;

  const handleIniciarLlamada = async (dmUsuario?: { uid: string; displayName: string }) => {
    if (llamadaActiva || !userProfile?.uid) return;

    await iniciarLlamadaConSignaling(
      userProfile.uid,
      userProfile.displayName,
      userProfile.role,
      dmUsuario
    );

    actividadService.registrar({
      tipo: 'llamada_iniciada',
      mensaje: dmUsuario
        ? `inició una llamada con ${dmUsuario.displayName}`
        : 'inició una llamada de equipo',
      userId: userProfile.uid,
      displayName: userProfile.displayName,
    }).catch(() => {});
  };

  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll al fondo cuando llegan nuevos mensajes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes.length]);

  const handleEnviar = async () => {
    if (!texto.trim() || !userProfile?.uid || enviando) return;

    setEnviando(true);
    try {
      await enviarMensaje(texto, userProfile.uid, userProfile.displayName);
      setTexto('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error enviando mensaje:', error);
    } finally {
      setEnviando(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  };

  // Agrupar mensajes por fecha
  let lastDate = '';

  return (
    <div className="flex flex-col h-full">
      {/* Header del canal */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 bg-white">
        {isDM ? (
          <>
            <button
              onClick={volverAGeneral}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              title="Volver al chat general"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            {dmUserPhoto ? (
              <img src={dmUserPhoto} alt={canalUsuario.displayName} className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-[10px] font-bold">
                {canalUsuario.displayName?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <span className="text-sm font-medium text-gray-900 truncate flex-1">{canalUsuario.displayName}</span>
            <button
              onClick={() => handleIniciarLlamada(canalUsuario)}
              disabled={llamadaActiva}
              className={`p-1.5 rounded-lg transition-colors ${
                llamadaActiva
                  ? 'text-green-500 cursor-not-allowed'
                  : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
              }`}
              title={llamadaActiva ? 'Llamada en curso' : `Llamar a ${canalUsuario.displayName}`}
            >
              <Phone className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <Users className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Chat General</span>
          </>
        )}
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1">
        {mensajes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400 italic text-center">
              {isDM
                ? `Inicia una conversación con ${canalUsuario?.displayName}`
                : 'Sin mensajes aún.\n¡Sé el primero en escribir!'}
            </p>
          </div>
        ) : (
          mensajes.map((msg) => {
            const dateStr = formatChatDate(msg.timestamp);
            const showDate = dateStr !== lastDate;
            lastDate = dateStr;
            const isOwn = msg.userId === userProfile?.uid;

            return (
              <React.Fragment key={msg.id}>
                {showDate && (
                  <div className="flex items-center justify-center py-2">
                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-3 py-0.5 rounded-full">
                      {dateStr}
                    </span>
                  </div>
                )}
                <MessageBubble mensaje={msg} isOwn={isOwn} hideName={isDM} />
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Input + Llamada */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex items-center gap-2">
          {/* Botón de llamada (solo en general) */}
          {!isDM && (
            <button
              onClick={() => handleIniciarLlamada()}
              disabled={llamadaActiva}
              className={`p-2 rounded-lg transition-colors ${
                llamadaActiva
                  ? 'bg-green-100 text-green-600 cursor-not-allowed'
                  : 'hover:bg-green-50 text-gray-500 hover:text-green-600'
              }`}
              title={llamadaActiva ? 'Llamada en curso' : 'Iniciar llamada de equipo'}
            >
              <Phone className="h-4 w-4" />
            </button>
          )}

          <input
            ref={inputRef}
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isDM ? `Mensaje a ${canalUsuario?.displayName}...` : 'Escribe un mensaje...'}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={enviando}
          />
          <button
            onClick={handleEnviar}
            disabled={!texto.trim() || enviando}
            className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const MessageBubble: React.FC<{ mensaje: ChatMensaje; isOwn: boolean; hideName?: boolean }> = ({ mensaje, isOwn, hideName }) => {
  return (
    <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
      {/* Avatar (solo para otros) */}
      {!isOwn && (
        mensaje.photoURL ? (
          <img src={mensaje.photoURL} alt={mensaje.displayName} className="w-6 h-6 rounded-full flex-shrink-0 object-cover" />
        ) : (
          <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold bg-gradient-to-br ${ROLE_COLORS.admin}`}>
            {mensaje.displayName?.charAt(0).toUpperCase() || '?'}
          </div>
        )
      )}

      {/* Burbuja */}
      <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 ${
        isOwn
          ? 'bg-primary-600 text-white rounded-br-md'
          : 'bg-gray-100 text-gray-900 rounded-bl-md'
      }`}>
        {!isOwn && !hideName && (
          <p className="text-[10px] font-semibold text-primary-600 mb-0.5">
            {mensaje.displayName}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{mensaje.texto}</p>
        <p className={`text-[10px] mt-0.5 text-right ${isOwn ? 'text-primary-200' : 'text-gray-400'}`}>
          {formatChatTime(mensaje.timestamp)}
        </p>
      </div>
    </div>
  );
};
