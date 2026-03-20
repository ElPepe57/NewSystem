import React, { useEffect, useRef, useState, useCallback } from 'react';
import DailyIframe from '@daily-co/daily-js';
import type { DailyCall } from '@daily-co/daily-js';
import { PhoneOff, Maximize2, Minimize2, Minus, Clock, RefreshCw, GripHorizontal, Mic, MicOff, Loader2 } from 'lucide-react';
import { useCollaborationStore } from '../../store/collaborationStore';
import { useAuthStore } from '../../store/authStore';
import { useCallRecorder } from '../../hooks/useCallRecorder';
import { llamadaIntelService } from '../../services/llamadaIntel.service';
import { CallProcessingToast } from '../modules/llamadaIntel/CallProcessingToast';

/**
 * DailyCallModal — Daily.co Prebuilt video call via DailyIframe.createFrame()
 *
 * 3 modos de visualización:
 * - 'maximizado': Pantalla completa con overlay oscuro
 * - 'flotante': Ventana mediana arrastrable, sin overlay (default)
 * - 'mini': Barra compacta arrastrable, solo controles
 */

type ModoVentana = 'maximizado' | 'flotante' | 'mini';

export const DailyCallModal: React.FC = () => {
  const llamadaActiva = useCollaborationStore(s => s.llamadaActiva);
  const llamadaUsuario = useCollaborationStore(s => s.llamadaUsuario);
  const roomUrl = useCollaborationStore(s => s.roomUrl);
  const finalizarLlamadaConSignaling = useCollaborationStore(
    s => s.finalizarLlamadaConSignaling
  );
  const { userProfile } = useAuthStore();

  const llamadaId = useCollaborationStore(s => s.llamadaId);

  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<DailyCall | null>(null);
  const [modo, setModo] = useState<ModoVentana>('flotante');
  const [cargando, setCargando] = useState(true);
  const [duracion, setDuracion] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalizingRef = useRef(false);
  const initializingRef = useRef(false);

  // ─── Grabación de audio ────────────────────────────────
  const { grabando, iniciarGrabacion, detenerGrabacion, limpiar: limpiarGrabacion } = useCallRecorder();
  const [subiendoAudio, setSubiendoAudio] = useState(false);
  const [grabacionIniciada, setGrabacionIniciada] = useState(false);
  const [processingIntelId, setProcessingIntelId] = useState<string | null>(null);

  // Drag state
  const [posicion, setPosicion] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0,
  });

  const callLabel = llamadaUsuario
    ? `Llamada con ${llamadaUsuario.displayName}`
    : 'Llamada de Equipo';

  // ─── Drag handlers ───────────────────────────────────────
  const getWindowSize = useCallback(() => {
    if (modo === 'mini') return [260, 44];
    return [Math.min(480, window.innerWidth - 32), Math.min(360, window.innerHeight - 32)];
  }, [modo]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current.dragging) return;
    e.preventDefault();
    const dx = dragRef.current.startX - e.clientX;
    const dy = dragRef.current.startY - e.clientY;
    const newX = dragRef.current.startPosX + dx;
    const newY = dragRef.current.startPosY + dy;

    const [winW, winH] = getWindowSize();
    const minX = -12;
    const maxX = window.innerWidth - 16 - winW;
    const minY = -12;
    const maxY = window.innerHeight - 16 - winH;

    setPosicion({
      x: Math.max(minX, Math.min(newX, maxX)),
      y: Math.max(minY, Math.min(newY, maxY)),
    });
  }, [getWindowSize]);

  const handleMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = '';
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (modo === 'maximizado') return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: posicion.x,
      startPosY: posicion.y,
    };
    setIsDragging(true);
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [modo, posicion, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [handleMouseMove, handleMouseUp]);

  // ─── Daily.co lifecycle ──────────────────────────────────
  const cleanup = useCallback(() => {
    initializingRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (callFrameRef.current) {
      try {
        callFrameRef.current.destroy();
      } catch {
        // May already be destroyed
      }
      callFrameRef.current = null;
    }
  }, []);

  const initDaily = useCallback(async () => {
    if (!containerRef.current || !roomUrl) return;
    if (initializingRef.current || callFrameRef.current) {
      console.log('[DailyCall] Skipping duplicate init');
      return;
    }
    initializingRef.current = true;
    cleanup();
    initializingRef.current = true;
    setCargando(true);
    setDuracion(0);
    finalizingRef.current = false;

    console.log('[DailyCall] Initializing with roomUrl:', roomUrl);

    try {
      const callFrame = DailyIframe.createFrame(containerRef.current, {
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: '0',
        },
        showLeaveButton: true,
        showFullscreenButton: true,
      });

      callFrameRef.current = callFrame;

      callFrame.on('loaded', () => {
        console.log('[DailyCall] Prebuilt UI loaded');
        setCargando(false);
      });

      callFrame.on('joined-meeting', () => {
        console.log('[DailyCall] Joined meeting successfully');
        setCargando(false);
        // Auto-iniciar grabación al unirse a la llamada
        iniciarGrabacion().then(ok => {
          if (ok) {
            setGrabacionIniciada(true);
            console.log('[DailyCall] Grabación automática iniciada');
          }
        });
        if (!timerRef.current) {
          timerRef.current = setInterval(() => setDuracion(d => d + 1), 1000);
        }
      });

      callFrame.on('left-meeting', () => {
        console.log('[DailyCall] Left meeting');
        if (!finalizingRef.current) {
          finalizingRef.current = true;
          cleanup();
          finalizarLlamadaConSignaling();
        }
      });

      callFrame.on('error', (e) => {
        console.error('[DailyCall] Error:', JSON.stringify(e, null, 2));
        setCargando(false);
      });

      const userName = userProfile?.displayName
        || userProfile?.email?.split('@')[0]
        || 'Usuario';

      await callFrame.join({ url: roomUrl, userName });
      console.log('[DailyCall] Join returned successfully');
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('[DailyCall] Error initializing:', errMsg);
      setCargando(false);
    }
  }, [roomUrl, userProfile, cleanup, finalizarLlamadaConSignaling]);

  useEffect(() => {
    if (llamadaActiva && roomUrl) {
      initDaily();
    }
    return () => { cleanup(); };
  }, [llamadaActiva, roomUrl]);

  useEffect(() => {
    if (!llamadaActiva) {
      cleanup();
      setDuracion(0);
      setCargando(true);
      finalizingRef.current = false;
      setGrabacionIniciada(false);
      setSubiendoAudio(false);
    }
  }, [llamadaActiva, cleanup]);

  // ─── Recording toggle ───────────────────────────────────
  const handleToggleGrabacion = async () => {
    if (grabando) {
      detenerGrabacion();
      setGrabacionIniciada(false);
    } else {
      const ok = await iniciarGrabacion();
      if (ok) setGrabacionIniciada(true);
    }
  };

  // Procesar audio grabado al finalizar llamada
  const procesarGrabacion = async (audioBlob: Blob) => {
    if (!llamadaId || !userProfile) return;
    setSubiendoAudio(true);
    try {
      // 1. Subir audio a Firebase Storage
      const audioUrl = await llamadaIntelService.subirAudio(llamadaId, audioBlob);

      // 2. Crear registro en Firestore (estado: procesando)
      const participantes = llamadaUsuario
        ? [userProfile.displayName || 'Usuario', llamadaUsuario.displayName]
        : [userProfile.displayName || 'Usuario'];
      const participantesUids = llamadaUsuario
        ? [userProfile.uid, llamadaUsuario.uid]
        : [userProfile.uid];

      const intelId = await llamadaIntelService.crear({
        llamadaId,
        audioUrl,
        audioDuracionSeg: duracion,
        participantes,
        participantesUids,
        estado: 'procesando',
        creadoEn: null as never, // Set by service
      });

      // 3. Llamar Cloud Function para transcripción + análisis
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const procesarLlamadaFn = httpsCallable(functions, 'procesarLlamadaIntel');
      procesarLlamadaFn({ intelId, audioUrl }).catch((err: unknown) => {
        console.error('[DailyCall] Error procesando audio:', err);
      });

      console.log('[DailyCall] Audio subido y procesamiento iniciado, intelId:', intelId);
      setProcessingIntelId(intelId);
    } catch (error) {
      console.error('[DailyCall] Error subiendo audio:', error);
    } finally {
      setSubiendoAudio(false);
    }
  };

  // ─── Actions ─────────────────────────────────────────────
  const handleColgar = async () => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;

    // Si estaba grabando, detener y procesar
    let audioBlob: Blob | null = null;
    if (grabando) {
      audioBlob = detenerGrabacion();
      setGrabacionIniciada(false);
    }

    cleanup();
    setCargando(true);
    setModo('flotante');
    setPosicion({ x: 0, y: 0 });

    // Procesar audio en background (no bloquear el hang-up)
    if (audioBlob && audioBlob.size > 0) {
      procesarGrabacion(audioBlob);
    }

    setDuracion(0);
    await finalizarLlamadaConSignaling();
  };

  const handleReintentar = () => {
    cleanup();
    setCargando(true);
    setDuracion(0);
    finalizingRef.current = false;
    initDaily();
  };

  // Si no hay llamada activa, solo mostrar toast de procesamiento si existe
  if (!llamadaActiva || !roomUrl || !userProfile) {
    return processingIntelId ? (
      <CallProcessingToast
        intelId={processingIntelId}
        onDismiss={() => setProcessingIntelId(null)}
      />
    ) : null;
  }

  const minutos = String(Math.floor(duracion / 60)).padStart(2, '0');
  const segundos = String(duracion % 60).padStart(2, '0');

  // ─── Container classes by mode ───────────────────────────
  const transitionClass = isDragging ? '' : 'transition-all duration-300 ease-in-out';
  const containerClass = modo === 'maximizado'
    ? 'inset-4'
    : modo === 'flotante'
    ? 'w-[480px] h-[360px] lg:w-[640px] lg:h-[480px]'
    : 'w-[260px] h-[44px]';

  const containerStyle: React.CSSProperties | undefined =
    modo !== 'maximizado'
      ? { right: `${16 + posicion.x}px`, bottom: `${16 + posicion.y}px` }
      : undefined;

  return (
    <>
      {/* Overlay: SOLO en modo maximizado */}
      {modo === 'maximizado' && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 transition-opacity duration-300"
          onClick={() => { setPosicion({ x: 0, y: 0 }); setModo('flotante'); }}
        />
      )}

      {/* Ventana principal */}
      <div
        className={`fixed z-[61] ${transitionClass} ${containerClass}`}
        style={containerStyle}
      >
        <div className={`h-full flex flex-col bg-gray-900 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 ${
          modo !== 'maximizado' ? 'ring-2 ring-green-500/30' : ''
        }`}>

          {/* ─── Header (arrastrable) ─── */}
          <div
            className={`flex items-center gap-1.5 shrink-0 select-none bg-gray-800/95 ${
              modo === 'mini' ? 'px-2.5 py-1.5' : 'px-3 py-2'
            } ${modo !== 'maximizado' ? 'cursor-move' : ''}`}
            onMouseDown={handleMouseDown}
          >
            {modo !== 'maximizado' && (
              <GripHorizontal className="h-3.5 w-3.5 text-gray-600 shrink-0" />
            )}

            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />

            <span className={`text-white font-medium truncate ${
              modo === 'mini' ? 'text-xs max-w-[120px]' : 'text-sm max-w-[180px]'
            }`}>
              {modo === 'mini'
                ? (llamadaUsuario?.displayName || 'Equipo')
                : callLabel
              }
            </span>

            {duracion > 0 && (
              <span className="flex items-center gap-1 text-gray-400 text-xs tabular-nums shrink-0">
                <Clock className="h-3 w-3" />
                {minutos}:{segundos}
              </span>
            )}

            {grabando && (
              <span className="flex items-center gap-1 text-red-400 text-xs shrink-0">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                REC
              </span>
            )}

            <div className="flex-1" />

            <div className="flex items-center gap-0.5 shrink-0">
              {modo === 'mini' && (
                <button
                  onClick={() => { setPosicion({ x: 0, y: 0 }); setModo('flotante'); }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                  title="Expandir video"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              )}
              {modo === 'flotante' && (
                <>
                  <button
                    onClick={() => { setPosicion({ x: 0, y: 0 }); setModo('mini'); }}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                    title="Minimizar"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { setPosicion({ x: 0, y: 0 }); setModo('maximizado'); }}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                    title="Pantalla completa"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              {modo === 'maximizado' && (
                <button
                  onClick={() => { setPosicion({ x: 0, y: 0 }); setModo('flotante'); }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                  title="Ventana flotante"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Botón de grabación */}
              {subiendoAudio ? (
                <button
                  disabled
                  className="p-1.5 rounded-lg bg-yellow-600/50 text-yellow-200 cursor-wait"
                  title="Subiendo grabación..."
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                </button>
              ) : (
                <button
                  onClick={handleToggleGrabacion}
                  className={`p-1.5 rounded-lg transition-colors ${
                    grabando
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 ring-1 ring-red-500/50'
                      : 'hover:bg-white/10 text-gray-300 hover:text-white'
                  }`}
                  title={grabando ? 'Detener grabación' : 'Grabar llamada (IA)'}
                >
                  {grabando ? (
                    <MicOff className="h-3.5 w-3.5" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                </button>
              )}

              <button
                onClick={handleColgar}
                className="ml-1 p-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                title="Colgar"
              >
                <PhoneOff className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ─── Content: Daily iframe — siempre en DOM para mantener audio ─── */}
          <div className={`relative bg-[#1a1a2e] ${modo === 'mini' ? 'h-0 overflow-hidden' : 'flex-1'}`}>
            {cargando && modo !== 'mini' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a2e] z-10 gap-3">
                <div className="w-10 h-10 border-3 border-green-500 border-t-transparent rounded-full animate-spin mb-1" />
                <p className="text-gray-400 text-sm">
                  {llamadaUsuario
                    ? `Conectando con ${llamadaUsuario.displayName}...`
                    : 'Conectando a la llamada...'}
                </p>
                <button
                  onClick={handleReintentar}
                  className="flex items-center gap-1.5 mt-3 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reintentar
                </button>
              </div>
            )}

            <div ref={containerRef} className="w-full h-full" />
          </div>
        </div>
      </div>

      {/* Toast de procesamiento post-llamada */}
      {processingIntelId && !llamadaActiva && (
        <CallProcessingToast
          intelId={processingIntelId}
          onDismiss={() => setProcessingIntelId(null)}
        />
      )}
    </>
  );
};
