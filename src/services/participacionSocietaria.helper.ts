/**
 * participacionSocietaria.helper · tope del cap table societario (100%).
 *
 * Fuente ÚNICA para "¿cuánto equity está asignado y cuánto queda libre?". La consumen TANTO la
 * validación al editar el % de un socio (no pasar de 100%) COMO el indicador del total en el cap
 * table — para que NUNCA deriven cifras distintas entre lo que se bloquea y lo que se muestra
 * (principio rector 360). Puro · sin I/O · 100% testeable.
 */

/** Tope de participación societaria · la suma de TODOS los socios no puede superarlo. */
export const TOPE_PARTICIPACION_PCT = 100;

/** Tolerancia para comparaciones de punto flotante (ej. 33.33 × 3 = 99.99). */
const EPS = 0.001;

export interface ParticipacionRef {
  /** Identificador del socio (su uid). */
  uid: string;
  /** % de participación societaria (0 si no está cargado). */
  porcentajeParticipacion?: number;
}

/** Suma de % de participación de todos los socios de la lista. */
export function sumaParticipacion(socios: ParticipacionRef[]): number {
  return socios.reduce((acc, s) => acc + (s.porcentajeParticipacion || 0), 0);
}

/**
 * % máximo que se le puede asignar a `uid` sin que el cap table pase del tope
 * (= 100 − suma de los DEMÁS socios). Nunca negativo.
 */
export function disponibleParaSocio(socios: ParticipacionRef[], uid: string): number {
  const otros = socios
    .filter((s) => s.uid !== uid)
    .reduce((acc, s) => acc + (s.porcentajeParticipacion || 0), 0);
  return Math.max(0, +(TOPE_PARTICIPACION_PCT - otros).toFixed(4));
}

export type EstadoCapTable = 'completo' | 'excedido' | 'incompleto';

/** Estado del cap table según el total asignado: completo (=100) · excedido (>100) · incompleto (<100). */
export function estadoCapTable(total: number): EstadoCapTable {
  if (total > TOPE_PARTICIPACION_PCT + EPS) return 'excedido';
  if (total < TOPE_PARTICIPACION_PCT - EPS) return 'incompleto';
  return 'completo';
}
