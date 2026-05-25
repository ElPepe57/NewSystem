/**
 * Helpers compartidos por los sub-componentes de Inversionistas.
 * Mantenerlos acá evita duplicar lógica simple entre los 7 tabs.
 */
import type { Timestamp } from 'firebase/firestore';

export const MESES_NOMBRES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export const MESES_NOMBRE_LARGO = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Formatea fecha corta tipo "15/May/2026" para listados densos · canon F7 tabular */
export function formatFechaCorta(ts: Timestamp | undefined): string {
  if (!ts) return '—';
  const d = ts.toDate();
  return `${String(d.getDate()).padStart(2, '0')}/${MESES_NOMBRES[d.getMonth()]}/${d.getFullYear()}`;
}
