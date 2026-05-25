/**
 * revisionMensual.types.ts · canon v5.2 chk5.E-RM
 *
 * Reemplaza cierreContable.types.ts (deprecated).
 *
 * Filosofía: Revisión Mensual NO es cierre contable formal · es health check
 * informal · sin bloqueo de modificaciones · sin snapshot inmutable · sin
 * motivo obligatorio para re-abrir.
 *
 * Aplica a PyME que NO tributa (Vita Skin) · prioriza conciliación bancaria
 * como motor único de confiabilidad de datos.
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Estado de la revisión de un período
 * - sin_revisar · período sin haber sido revisado nunca
 * - en_revision · existe registro pero aún no se marcó como completo
 * - revisado · usuario marcó "revisado" · solo registro (NO bloquea ediciones)
 */
export type EstadoRevisionMensual = 'sin_revisar' | 'en_revision' | 'revisado';

/**
 * Registro de revisión mensual · documento Firestore en revisionesMensuales/
 */
export interface RevisionMensual {
  id?: string;
  /** Período · 1-12 */
  mes: number;
  /** Año · ej. 2026 */
  anio: number;
  /** Estado actual */
  estado: EstadoRevisionMensual;
  /** Usuario que marcó como revisado · null si aún sin revisar */
  revisadoPor?: string;
  /** Nombre del usuario · desnormalizado */
  revisadoPorNombre?: string;
  /** Fecha de la revisión */
  fechaRevision?: Timestamp;
  /** Observaciones opcionales del usuario al marcar revisado */
  observaciones?: string;
  /** Conteo de observaciones automáticas detectadas (informativo) */
  alertasDetectadas?: number;
  /** Utilidad neta del período al momento de la revisión (snapshot LIGHT · informativo) */
  utilidadNetaSnapshot?: number;
  /** Fecha de última actualización del registro */
  fechaActualizacion?: Timestamp;
}

/**
 * Estado de conciliación bancaria de una cuenta individual
 * - verificada · ≤7 días desde última verificación · sin desviación
 * - sin_verificar · 8-30 días sin verificar
 * - desactualizada · >30 días sin verificar
 * - desviacion · saldo sistema ≠ último verificado · requiere investigación
 */
export type EstadoConciliacion =
  | 'verificada'
  | 'sin_verificar'
  | 'desactualizada'
  | 'desviacion';

/**
 * Resumen de conciliación bancaria por cuenta
 */
export interface ConciliacionCuenta {
  cuentaId: string;
  nombre: string;
  tipo: 'banco' | 'efectivo' | 'billetera' | 'credito';
  moneda: string;
  /** Saldo actual según el sistema (calculado de movimientos) */
  saldoSistemaPEN: number;
  /** Saldo original en moneda nativa */
  saldoSistemaOriginal: number;
  /** Saldo de la última verificación · null si nunca se verificó */
  saldoVerificadoPEN?: number;
  saldoVerificadoOriginal?: number;
  /** Días desde la última verificación · null si nunca */
  diasDesdeVerificacion?: number;
  /** Diferencia detectada (sistema - verificado) · solo si hay verificación */
  desviacionPEN?: number;
  desviacionOriginal?: number;
  /** Estado de conciliación */
  estado: EstadoConciliacion;
  /** Última fecha de verificación · null si nunca */
  fechaUltimaVerificacion?: Timestamp;
}

/**
 * Resumen consolidado de conciliación bancaria de TODAS las cuentas
 */
export interface ResumenConciliacion {
  cuentas: ConciliacionCuenta[];
  totalCuentas: number;
  verificadas: number;
  sinVerificar: number;
  desactualizadas: number;
  conDesviacion: number;
}

/**
 * Chequeo informativo · NO bloquea modificaciones
 */
export interface ChequeoInformativo {
  id: string;
  /** Polaridad */
  polaridad: 'ok' | 'warning' | 'info';
  titulo: string;
  detalle?: string;
  /** Cross-link contextual a otro módulo */
  crossLink?: {
    label: string;
    ruta: string;
  };
}
