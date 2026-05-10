import { Timestamp } from 'firebase/firestore';

/**
 * Tipos que aparecen en el sistema cuando se lee `fecha` de Firestore o legacy.
 * - Timestamp: el tipo declarado en los modelos canónicos
 * - { seconds: number, nanoseconds?: number }: Timestamp serializado (export/import)
 * - Date: cuando ya fue convertido en memoria
 * - string | number: legacy o ISO strings
 * - null | undefined: cuando el campo es opcional
 */
export type FechaLike =
  | Timestamp
  | Date
  | { seconds: number; nanoseconds?: number }
  | string
  | number
  | null
  | undefined;

/**
 * Convierte cualquier `FechaLike` a `Date`. Reemplaza el patrón duplicado en
 * ~33 ocurrencias del codebase: `f?.toDate?.() ?? new Date(f as any)`.
 *
 * Si la fecha es inválida (campo ausente, formato corrupto), devuelve `null`.
 * Para casos donde quieras un fallback no nulo, usa `toDateOrNow(f)`.
 *
 * chk5.A7 (S3.6 M1.bis · Cost Intelligence) — utility canónica para reemplazar
 * `as any` en conversiones Timestamp→Date a lo largo del sistema.
 */
export function toDateSafe(fecha: FechaLike): Date | null {
  if (fecha === null || fecha === undefined) return null;
  try {
    let date: Date;
    if (fecha instanceof Timestamp) {
      date = fecha.toDate();
    } else if (fecha instanceof Date) {
      date = fecha;
    } else if (typeof fecha === 'object' && 'seconds' in fecha) {
      date = new Date((fecha as { seconds: number }).seconds * 1000);
    } else if (typeof fecha === 'string' || typeof fecha === 'number') {
      date = new Date(fecha);
    } else {
      return null;
    }
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

/**
 * Variante de `toDateSafe` que devuelve `new Date()` si la fecha es inválida.
 * Útil cuando el flujo tolera "ahora" como fallback (ej. ordenar por fecha,
 * calcular últimos 12m, etc.).
 */
export function toDateOrNow(fecha: FechaLike): Date {
  return toDateSafe(fecha) ?? new Date();
}

/**
 * Convierte un valor de fecha (Firestore Timestamp, Date, string, number, etc.)
 * a un string formateado legible.
 *
 * Reemplaza las ~30 copias de `formatFecha(timestamp: any)` duplicadas en el proyecto.
 */
export function formatFecha(
  timestamp: Timestamp | Date | string | number | null | undefined,
  options?: { includeTime?: boolean }
): string {
  if (!timestamp) return '-';

  try {
    let date: Date;

    if (timestamp instanceof Timestamp) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'object' && 'seconds' in timestamp) {
      // Firestore Timestamp serializado (ej: { seconds: number, nanoseconds: number })
      date = new Date((timestamp as { seconds: number }).seconds * 1000);
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      return '-';
    }

    if (isNaN(date.getTime())) return '-';

    if (options?.includeTime) {
      return date.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

/**
 * Formatea una fecha como fecha relativa ("hace 2 horas", "hace 3 días", etc.)
 */
export function formatFechaRelativa(
  timestamp: Timestamp | Date | string | number | null | undefined
): string {
  if (!timestamp) return '-';

  try {
    let date: Date;

    if (timestamp instanceof Timestamp) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'object' && 'seconds' in timestamp) {
      date = new Date((timestamp as { seconds: number }).seconds * 1000);
    } else {
      date = new Date(timestamp);
    }

    if (isNaN(date.getTime())) return '-';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Justo ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return formatFecha(timestamp);
  } catch {
    return '-';
  }
}

/**
 * Calcula los días restantes hasta una fecha de vencimiento.
 * Retorna un número negativo si ya venció.
 *
 * Reemplaza las ~6 copias de `calcularDiasParaVencer` en inventario.
 */
export function calcularDiasParaVencer(
  fechaVencimiento: Timestamp | Date | string | number | null | undefined
): number | null {
  if (!fechaVencimiento) return null;

  try {
    let date: Date;

    if (fechaVencimiento instanceof Timestamp) {
      date = fechaVencimiento.toDate();
    } else if (fechaVencimiento instanceof Date) {
      date = fechaVencimiento;
    } else if (typeof fechaVencimiento === 'object' && 'seconds' in fechaVencimiento) {
      date = new Date((fechaVencimiento as { seconds: number }).seconds * 1000);
    } else {
      date = new Date(fechaVencimiento);
    }

    if (isNaN(date.getTime())) return null;

    const now = new Date();
    return Math.ceil((date.getTime() - now.getTime()) / 86400000);
  } catch {
    return null;
  }
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Calcula los días transcurridos desde una fecha hasta hoy.
 * Reemplaza las ~75 copias de `Math.floor(diff / (1000 * 60 * 60 * 24))`.
 */
export function diasDesde(fecha: Timestamp | Date | string | number | null | undefined): number {
  if (!fecha) return 0;
  try {
    let date: Date;
    if (fecha instanceof Timestamp) date = fecha.toDate();
    else if (fecha instanceof Date) date = fecha;
    else if (typeof fecha === 'object' && 'seconds' in fecha) date = new Date((fecha as { seconds: number }).seconds * 1000);
    else date = new Date(fecha);
    if (isNaN(date.getTime())) return 0;
    return Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);
  } catch { return 0; }
}

/**
 * Calcula los días entre dos fechas (absoluto).
 */
export function diasEntre(
  fecha1: Timestamp | Date | string | number | null | undefined,
  fecha2: Timestamp | Date | string | number | null | undefined
): number {
  if (!fecha1 || !fecha2) return 0;
  try {
    const toDate = (f: any): Date => {
      if (f instanceof Timestamp) return f.toDate();
      if (f instanceof Date) return f;
      if (typeof f === 'object' && 'seconds' in f) return new Date(f.seconds * 1000);
      return new Date(f);
    };
    const d1 = toDate(fecha1);
    const d2 = toDate(fecha2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    return Math.abs(Math.floor((d2.getTime() - d1.getTime()) / MS_PER_DAY));
  } catch { return 0; }
}
