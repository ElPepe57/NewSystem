import React, { useEffect, useState, useRef } from 'react';
import { Phone, PhoneOff, Users } from 'lucide-react';
import { useCollaborationStore } from '../../store/collaborationStore';

const ROLE_COLORS: Record<string, string> = {
  admin: 'from-red-500 to-orange-500',
  gerente: 'from-purple-500 to-pink-500',
  vendedor: 'from-blue-500 to-cyan-500',
  comprador: 'from-amber-500 to-yellow-500',
  almacenero: 'from-green-500 to-emerald-500',
  finanzas: 'from-teal-500 to-cyan-500',
  supervisor: 'from-indigo-500 to-purple-500',
  invitado: 'from-gray-400 to-gray-500',
};

/**
 * Genera un ringtone usando Web Audio API.
 * Patron: dos tonos cortos cada 2 segundos (estilo telefono).
 */
function createRingtone() {
  let audioCtx: AudioContext | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let isPlaying = false;

  const playRingPattern = () => {
    if (!audioCtx || audioCtx.state === 'closed') return;

    // Primer tono
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.frequency.value = 440;
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc1.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + 0.4);

    // Segundo tono (0.5s despues)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.frequency.value = 480;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.25, audioCtx.currentTime + 0.5);
    gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.9);
    osc2.start(audioCtx.currentTime + 0.5);
    osc2.stop(audioCtx.currentTime + 0.9);
  };

  return {
    start() {
      if (isPlaying) return;
      isPlaying = true;
      try {
        audioCtx = new AudioContext();
        playRingPattern();
        intervalId = setInterval(playRingPattern, 2500);
      } catch (e) {
        console.warn('Web Audio API no disponible para ringtone:', e);
      }
    },
    stop() {
      isPlaying = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
    },
  };
}

export const IncomingCallModal: React.FC = () => {
  const llamadaEntrante = useCollaborationStore(s => s.llamadaEntrante);
  const aceptarLlamada = useCollaborationStore(s => s.aceptarLlamadaEntrante);
  const rechazarLlamada = useCollaborationStore(s => s.rechazarLlamadaEntrante);

  const [segundos, setSegundos] = useState(0);
  const ringtoneRef = useRef<ReturnType<typeof createRingtone> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentCallIdRef = useRef<string | null>(null);

  // Iniciar/detener ringtone y timer cuando cambia llamadaEntrante
  useEffect(() => {
    if (llamadaEntrante) {
      // Evitar reinicializar si es la misma llamada
      if (currentCallIdRef.current === llamadaEntrante.id) return;
      currentCallIdRef.current = llamadaEntrante.id;

      setSegundos(0);

      // Ringtone
      ringtoneRef.current = createRingtone();
      ringtoneRef.current.start();

      // Timer visual
      timerRef.current = setInterval(() => {
        setSegundos(s => s + 1);
      }, 1000);
    } else {
      currentCallIdRef.current = null;

      // Cleanup
      ringtoneRef.current?.stop();
      ringtoneRef.current = null;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setSegundos(0);
    }

    return () => {
      ringtoneRef.current?.stop();
      ringtoneRef.current = null;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [llamadaEntrante?.id]);

  if (!llamadaEntrante) return null;

  const callerInitial = llamadaEntrante.creadorNombre?.charAt(0).toUpperCase() || '?';
  const gradientClass = ROLE_COLORS[llamadaEntrante.creadorRole || ''] || ROLE_COLORS.invitado;
  const isTeamCall = llamadaEntrante.tipo === 'equipo';

  const timerDisplay = `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm transition-opacity duration-300" />

      {/* Modal centrado */}
      <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[320px] overflow-hidden animate-in fade-in zoom-in duration-300">

          {/* Header con gradiente */}
          <div className={`bg-gradient-to-br ${gradientClass} px-6 pt-8 pb-12 text-center relative`}>
            {/* Ondas de ring animadas */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-32 h-32 rounded-full border-2 border-white/20 animate-ping" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-40 h-40 rounded-full border border-white/10 animate-ping" style={{ animationDelay: '0.5s' }} />
            </div>

            {/* Avatar */}
            <div className="relative mx-auto w-20 h-20 mb-4">
              {!isTeamCall && llamadaEntrante.creadorPhotoURL ? (
                <img
                  src={llamadaEntrante.creadorPhotoURL}
                  alt={llamadaEntrante.creadorNombre}
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-white/30"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-3xl font-bold ring-4 ring-white/30">
                  {isTeamCall ? (
                    <Users className="h-10 w-10" />
                  ) : (
                    callerInitial
                  )}
                </div>
              )}
            </div>

            {/* Nombre */}
            <h3 className="text-white text-lg font-bold drop-shadow-sm">
              {llamadaEntrante.creadorNombre}
            </h3>
            <p className="text-white/80 text-sm mt-1">
              {isTeamCall ? 'Llamada de equipo' : 'Llamada directa'}
            </p>
          </div>

          {/* Cuerpo */}
          <div className="px-6 py-6 text-center -mt-6 bg-white rounded-t-2xl relative">
            {/* Timer */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-gray-500 tabular-nums font-medium">
                Sonando {timerDisplay}
              </span>
            </div>

            {/* Botones Accept / Decline */}
            <div className="flex items-center justify-center gap-10">
              {/* Rechazar */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={rechazarLlamada}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700
                             flex items-center justify-center text-white
                             transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105
                             active:scale-95"
                  title="Rechazar llamada"
                >
                  <PhoneOff className="h-7 w-7" />
                </button>
                <span className="text-xs text-gray-500 font-medium">Rechazar</span>
              </div>

              {/* Aceptar */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={aceptarLlamada}
                  className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 active:bg-green-700
                             flex items-center justify-center text-white
                             transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105
                             active:scale-95 animate-pulse"
                  title="Aceptar llamada"
                >
                  <Phone className="h-7 w-7" />
                </button>
                <span className="text-xs text-gray-500 font-medium">Aceptar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
