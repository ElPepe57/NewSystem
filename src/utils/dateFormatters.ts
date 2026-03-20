import { Timestamp } from 'firebase/firestore';

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
