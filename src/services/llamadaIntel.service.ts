import {
  addDoc,
  doc,
  updateDoc,
  getDocs,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type {
  LlamadaIntel,
  LlamadaIntelFormData,
  EstadoGrabacion,
  EstadoTarea,
  AnalisisLlamada,
  TranscripcionSegmento,
} from '../types/llamadaIntel.types';

const COL = COLLECTIONS.LLAMADAS_INTEL;

export const llamadaIntelService = {
  /**
   * Subir audio a Firebase Storage y obtener la URL.
   * Path: llamadas-audio/{llamadaId}/{timestamp}.webm
   */
  async subirAudio(llamadaId: string, audioBlob: Blob): Promise<string> {
    const timestamp = Date.now();
    const path = `llamadas-audio/${llamadaId}/${timestamp}.webm`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, audioBlob, {
      contentType: 'audio/webm;codecs=opus',
    });
    return getDownloadURL(storageRef);
  },

  /**
   * Crear registro inicial de LlamadaIntel (estado: subiendo/procesando).
   */
  async crear(data: LlamadaIntelFormData): Promise<string> {
    const docRef = await addDoc(collection(db, COL), {
      llamadaId: data.llamadaId,
      audioUrl: data.audioUrl,
      audioDuracionSeg: data.audioDuracionSeg,
      transcripcion: data.transcripcion || [],
      transcripcionTexto: data.transcripcionTexto || '',
      analisis: data.analisis || null,
      participantes: data.participantes,
      participantesUids: data.participantesUids,
      estado: data.estado,
      error: data.error || null,
      creadoEn: Timestamp.now(),
      procesadoEn: null,
    });
    return docRef.id;
  },

  /**
   * Actualizar con resultados de transcripción y análisis.
   */
  async actualizarResultados(
    intelId: string,
    transcripcion: TranscripcionSegmento[],
    transcripcionTexto: string,
    analisis: AnalisisLlamada
  ): Promise<void> {
    await updateDoc(doc(db, COL, intelId), {
      transcripcion,
      transcripcionTexto,
      analisis,
      estado: 'completado' as EstadoGrabacion,
      procesadoEn: Timestamp.now(),
    });
  },

  /** Actualizar estado */
  async actualizarEstado(intelId: string, estado: EstadoGrabacion, error?: string): Promise<void> {
    const updateData: Record<string, unknown> = { estado };
    if (error) updateData.error = error;
    if (estado === 'completado') updateData.procesadoEn = Timestamp.now();
    await updateDoc(doc(db, COL, intelId), updateData);
  },

  /** Obtener un registro por ID */
  async obtener(intelId: string): Promise<LlamadaIntel | null> {
    const snap = await getDoc(doc(db, COL, intelId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as LlamadaIntel;
  },

  /** Obtener intel por llamadaId */
  async obtenerPorLlamada(llamadaId: string): Promise<LlamadaIntel | null> {
    const q = query(
      collection(db, COL),
      where('llamadaId', '==', llamadaId),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as LlamadaIntel;
  },

  /** Listar historial de llamadas con intel, más recientes primero */
  async listarHistorial(maxResults = 50): Promise<LlamadaIntel[]> {
    const q = query(
      collection(db, COL),
      where('estado', '==', 'completado'),
      orderBy('creadoEn', 'desc'),
      limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as LlamadaIntel));
  },

  /** Suscripción en tiempo real a un registro de intel (para mostrar progreso) */
  suscribir(intelId: string, callback: (intel: LlamadaIntel | null) => void): Unsubscribe {
    return onSnapshot(doc(db, COL, intelId), (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback({ id: snap.id, ...snap.data() } as LlamadaIntel);
    });
  },

  /**
   * Actualizar el estado de una tarea específica dentro de una llamada.
   * Permite delegar, completar, o actualizar notas de una tarea.
   */
  async actualizarTarea(
    intelId: string,
    tareaIndex: number,
    updates: {
      estado?: EstadoTarea;
      responsableUid?: string;
      responsable?: string;
      notas?: string;
      completada?: boolean;
    }
  ): Promise<void> {
    const intel = await this.obtener(intelId);
    if (!intel || !intel.analisis?.tareas?.[tareaIndex]) return;

    const tareas = [...intel.analisis.tareas];
    tareas[tareaIndex] = {
      ...tareas[tareaIndex],
      ...updates,
      actualizadoEn: Timestamp.now(),
      completada: updates.estado === 'completada' ? true : updates.completada ?? tareas[tareaIndex].completada,
    };

    await updateDoc(doc(db, COL, intelId), {
      'analisis.tareas': tareas,
    });
  },

  /**
   * Actualizar el estado de un seguimiento.
   */
  async actualizarSeguimiento(
    intelId: string,
    segIndex: number,
    updates: { completado?: boolean; responsableUid?: string; responsable?: string }
  ): Promise<void> {
    const intel = await this.obtener(intelId);
    if (!intel || !intel.analisis?.seguimientos?.[segIndex]) return;

    const seguimientos = [...intel.analisis.seguimientos];
    seguimientos[segIndex] = { ...seguimientos[segIndex], ...updates };

    await updateDoc(doc(db, COL, intelId), {
      'analisis.seguimientos': seguimientos,
    });
  },

  /** Listar todas las llamadas (incluyendo procesando) */
  async listarTodas(maxResults = 50): Promise<LlamadaIntel[]> {
    const q = query(
      collection(db, COL),
      orderBy('creadoEn', 'desc'),
      limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as LlamadaIntel));
  },

  /** Obtener tareas pendientes de un usuario específico */
  async obtenerTareasPendientesUsuario(uid: string): Promise<{ intel: LlamadaIntel; tareaIndex: number; tarea: LlamadaIntel['analisis']['tareas'][0] }[]> {
    const todas = await this.listarHistorial(100);
    const resultado: { intel: LlamadaIntel; tareaIndex: number; tarea: LlamadaIntel['analisis']['tareas'][0] }[] = [];

    for (const intel of todas) {
      if (!intel.analisis?.tareas) continue;
      intel.analisis.tareas.forEach((tarea, idx) => {
        const estado = tarea.estado || (tarea.completada ? 'completada' : 'pendiente');
        if (estado !== 'completada' && estado !== 'cancelada') {
          if (!uid || tarea.responsableUid === uid || !tarea.responsableUid) {
            resultado.push({ intel, tareaIndex: idx, tarea });
          }
        }
      });
    }
    return resultado;
  },
};
