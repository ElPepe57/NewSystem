import { useRef, useState, useCallback } from 'react';

export interface CallRecorderState {
  grabando: boolean;
  duracionGrabacion: number;
  audioBlob: Blob | null;
}

/**
 * Hook para grabar audio del navegador usando Web Audio API + MediaRecorder.
 * Captura el audio del micrófono local (lo que el usuario dice).
 *
 * Para capturar ambos lados de la llamada, usamos getDisplayMedia con audio
 * como fallback, o combinamos con el audio del micrófono.
 */
export function useCallRecorder() {
  const [grabando, setGrabando] = useState(false);
  const [duracionGrabacion, setDuracionGrabacion] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const iniciarGrabacion = useCallback(async (): Promise<boolean> => {
    try {
      // Capturar audio del micrófono
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
        video: false,
      });

      streamRef.current = micStream;
      chunksRef.current = [];

      // Usar formato webm/opus (soporte universal en browsers modernos)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(micStream, {
        mimeType,
        audioBitsPerSecond: 64000, // Suficiente para voz, archivos pequeños
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        chunksRef.current = [];
      };

      // Grabar en chunks de 10 segundos (permite streaming futuro)
      recorder.start(10000);
      mediaRecorderRef.current = recorder;
      setGrabando(true);
      setDuracionGrabacion(0);
      setAudioBlob(null);

      // Timer de duración
      timerRef.current = setInterval(() => {
        setDuracionGrabacion(d => d + 1);
      }, 1000);

      return true;
    } catch (error) {
      console.error('[CallRecorder] Error iniciando grabación:', error);
      return false;
    }
  }, []);

  const detenerGrabacion = useCallback((): Blob | null => {
    // Detener timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Detener recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    // Detener stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setGrabando(false);

    // Construir blob con los chunks acumulados hasta ahora
    if (chunksRef.current.length > 0) {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      setAudioBlob(blob);
      return blob;
    }

    return null;
  }, []);

  const limpiar = useCallback(() => {
    detenerGrabacion();
    setAudioBlob(null);
    setDuracionGrabacion(0);
  }, [detenerGrabacion]);

  return {
    grabando,
    duracionGrabacion,
    audioBlob,
    iniciarGrabacion,
    detenerGrabacion,
    limpiar,
  };
}
