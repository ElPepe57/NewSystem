/**
 * delegacionAutorizacion.helper · F4 · LÓGICA PURA de delegación de autoridad de egresos.
 *
 * Un socio puede DELEGAR su facultad de autorizar egresos a otro usuario (ej. Gerente General)
 * cuando no está disponible. La delegación puede apuntar a una PERSONA concreta o a un ROL.
 * Modelo (decisión usuario 2026-06-22): el delegado ENTRA AL POOL de quienes pueden firmar ·
 * la regla de doble firma (>$1k = 2 firmas DISTINTAS) se mantiene intacta (delegar en 2 para
 * cubrir >$1k estando ausente). Sin I/O · testeable.
 */

export interface DelegacionAutorizacion {
  id: string;
  /** Socio que delega su autoridad. */
  delegadoPor: string;
  delegadoPorNombre?: string;
  /** A una persona concreta o a un rol. */
  tipo: 'usuario' | 'rol';
  /** uid del delegado (si tipo='usuario'). */
  delegadoAUsuario?: string;
  delegadoANombre?: string;
  /** rol delegado (si tipo='rol'). */
  delegadoARol?: string;
  motivo?: string;
  /** Vigencia · Timestamps opacos. */
  desde?: unknown;
  hasta?: unknown;
  /** Revocable · false = revocada. */
  activa: boolean;
}

/** Convierte un Firestore Timestamp opaco a ms (o null). */
function tsToMs(ts: unknown): number | null {
  if (!ts || typeof ts !== 'object') return null;
  const t = ts as { toMillis?: () => number; seconds?: number };
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.seconds === 'number') return t.seconds * 1000;
  return null;
}

/** ¿la delegación está VIGENTE en `ahoraMs`? (activa + dentro del rango desde/hasta). */
export function delegacionVigente(d: DelegacionAutorizacion, ahoraMs: number): boolean {
  if (!d.activa) return false;
  const hasta = tsToMs(d.hasta);
  if (hasta != null && hasta < ahoraMs) return false;
  const desde = tsToMs(d.desde);
  if (desde != null && desde > ahoraMs) return false;
  return true;
}

/**
 * ¿este usuario tiene autoridad DELEGADA vigente para autorizar egresos?
 * Cubre delegación por-usuario (su uid) y por-rol (alguno de sus roles).
 */
export function tieneAutoridadDelegada(
  delegaciones: DelegacionAutorizacion[],
  userId: string,
  userRoles: string[],
  ahoraMs: number,
): boolean {
  return delegaciones.some(
    (d) =>
      delegacionVigente(d, ahoraMs) &&
      ((d.tipo === 'usuario' && !!d.delegadoAUsuario && d.delegadoAUsuario === userId) ||
        (d.tipo === 'rol' && !!d.delegadoARol && userRoles.includes(d.delegadoARol))),
  );
}

/** Etiqueta legible del destinatario de una delegación (para la UI). */
export function etiquetaDelegado(d: DelegacionAutorizacion): string {
  return d.tipo === 'usuario' ? (d.delegadoANombre || 'Usuario') : `Rol: ${d.delegadoARol || '—'}`;
}
