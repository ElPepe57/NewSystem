import { Timestamp } from 'firebase/firestore';

// ============================================================
// LLAMADA INTELIGENTE - Transcripción + Análisis IA
// ============================================================

export type EstadoGrabacion = 'grabando' | 'subiendo' | 'procesando' | 'completado' | 'error';

export type EstadoTarea = 'pendiente' | 'en_progreso' | 'completada' | 'cancelada';

export interface TareaExtraida {
  descripcion: string;
  responsable: string;       // Nombre del participante
  responsableUid?: string;   // UID si se puede mapear
  deadline?: string;         // Fecha mencionada o inferida
  prioridad: 'alta' | 'media' | 'baja';
  completada: boolean;
  estado: EstadoTarea;       // Estado granular de la tarea
  notas?: string;            // Notas adicionales del responsable
  actualizadoEn?: Timestamp; // Última actualización
}

export interface DecisionTomada {
  decision: string;
  contexto: string;           // Por qué se tomó
  involucrados: string[];     // Quiénes participaron
}

export interface SeguimientoSugerido {
  accion: string;
  responsable: string;
  responsableUid?: string;
  plazo?: string;
  completado?: boolean;
}

export interface AnalisisLlamada {
  resumenEjecutivo: string[];           // 3-5 puntos clave
  tareas: TareaExtraida[];
  decisiones: DecisionTomada[];
  seguimientos: SeguimientoSugerido[];
  temasDiscutidos: string[];            // Lista de temas principales
  sentimiento: 'positivo' | 'neutral' | 'tenso' | 'urgente';
  alertas?: string[];                   // Riesgos o problemas mencionados
}

export interface TranscripcionSegmento {
  timestamp: string;        // "00:01:23"
  hablante: string;         // Nombre o "Participante 1"
  texto: string;
}

export interface LlamadaIntel {
  id: string;
  llamadaId: string;                    // Ref al doc de llamada original
  audioUrl: string;                     // Firebase Storage path
  audioDuracionSeg: number;
  transcripcion: TranscripcionSegmento[];
  transcripcionTexto: string;           // Texto plano completo
  analisis: AnalisisLlamada;
  participantes: string[];              // Nombres
  participantesUids: string[];          // UIDs
  creadoEn: Timestamp;
  procesadoEn: Timestamp;
  estado: EstadoGrabacion;
  error?: string;
}

/** Datos para crear un nuevo registro de intel */
export type LlamadaIntelFormData = Omit<LlamadaIntel, 'id' | 'procesadoEn' | 'analisis' | 'transcripcion' | 'transcripcionTexto'> & {
  analisis?: AnalisisLlamada;
  transcripcion?: TranscripcionSegmento[];
  transcripcionTexto?: string;
};
