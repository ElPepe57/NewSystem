/**
 * Tipos para el widget "Tareas del Día" del Dashboard.
 * Consolida pendientes operativos de múltiples fuentes en una vista unificada.
 */

export type CategoriaTarea =
  | 'entrega_pendiente'
  | 'cobro_vencido'
  | 'oc_por_recibir'
  | 'cotizacion_por_vencer'
  | 'requerimiento_urgente'
  | 'transferencia_por_recibir';

export type PrioridadTarea = 'critica' | 'alta' | 'media' | 'baja';

/**
 * Una tarea individual del día.
 * Representa un ítem accionable con ruta de navegación directa.
 */
export interface TareaDia {
  id: string;
  categoria: CategoriaTarea;
  prioridad: PrioridadTarea;
  titulo: string;
  subtitulo: string;
  fechaLimite?: Date;
  diasRestantes?: number;
  monto?: number;
  moneda?: 'PEN' | 'USD';
  rutaDestino: string;
  documentoId: string;
}

/**
 * Resumen de tareas del día con conteos por prioridad.
 */
export interface ResumenTareasDia {
  fecha: Date;
  tareas: TareaDia[];
  resumen: {
    total: number;
    criticas: number;
    altas: number;
    medias: number;
    bajas: number;
  };
}
