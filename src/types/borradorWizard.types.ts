import type { Timestamp } from 'firebase/firestore';

/**
 * Tipo de wizard que persiste borradores.
 * Extensible si en el futuro se agregan más wizards con autoguardado.
 */
// chk5.C-FIX · agregado 'gasto' · canon F-Borradores extendido al módulo Gastos
// (referencias canon: oc · envio · producto · ahora también gasto)
// chk5.D-S1f · F5 · agregado 'liquidar_recaudadora' para LiquidarRecaudadoraWizard
// (DEUDA-MODELO-RECAUDADOR · D5 + D12 · F-Borradores obligatorio en wizards multi-step)
// chk5.PERSONAS-v5.4 · F5 · agregados 'esquema_incentivo' (wizard 3 pasos) y
// 'baja_empleado' (wizard 4 pasos) · ambos con autoguardado obligatorio.
export type TipoBorradorWizard =
  | 'oc'
  | 'envio'
  | 'producto'
  | 'gasto'
  | 'liquidar_recaudadora'
  | 'esquema_incentivo'
  | 'baja_empleado';

/**
 * Documento de borrador de wizard almacenado en Firestore.
 * Colección: `borradoresWizard/{userId}_{wizardId}`
 *
 * Ver §10 del ESPEC S41 — Autoguardado 2 capas (localStorage + Firestore).
 */
export interface BorradorWizard {
  id: string;                    // userId_wizardId
  tipo: TipoBorradorWizard;
  userId: string;
  pasoActual: number;
  estado: Record<string, any>;   // snapshot completo del estado del wizard
  fechaCreacion: Timestamp | Date;
  fechaActualizacion: Timestamp | Date;
  /** Descripción corta para listar en la UI admin (ej: proveedor + total) */
  resumen?: string;
  /** Monto total estimado para mostrar en el listado */
  montoEstimado?: number;
}

/**
 * Datos de borrador sin timestamps (input a createBorrador/updateBorrador).
 */
export interface BorradorWizardInput {
  tipo: TipoBorradorWizard;
  userId: string;
  pasoActual: number;
  estado: Record<string, any>;
  resumen?: string;
  montoEstimado?: number;
}

export const BORRADORES_WIZARD_COLLECTION = 'borradoresWizard';

/**
 * Calcula el ID determinístico de un borrador — permite tener máximo 1 borrador
 * activo por (usuario, tipo de wizard). Si el usuario abre un nuevo wizard y
 * ya tiene borrador del mismo tipo, se sobrescribe.
 */
export function buildBorradorWizardId(userId: string, tipo: TipoBorradorWizard): string {
  return `${userId}_${tipo}`;
}

/**
 * Key de localStorage (nivel 1 del autoguardado).
 */
export function buildBorradorLocalStorageKey(userId: string, tipo: TipoBorradorWizard): string {
  return `wizard_draft_${tipo}_${userId}`;
}
