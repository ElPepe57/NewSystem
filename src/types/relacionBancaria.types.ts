/**
 * relacionBancaria.types.ts — ADR-PF-001 · F1
 *
 * Entidad explicita que vincula un titular con un banco. Permite agrupar
 * todos los productos financieros (cuentas + tarjetas + tarjetas debito)
 * que ese titular tiene en ese banco.
 *
 * Una cuenta corriente BCP, una cuenta de ahorros BCP y una tarjeta credito
 * BCP del mismo titular pertenecen a la MISMA RelacionBancaria. Esto permite
 * vistas agrupadas como "Vita Skin SAC > BCP > [3 productos]".
 *
 * Decisiones aplicadas:
 *   - D-PF-2: Vinculo titular - banco - productos via entidad explicita
 *
 * Coexiste con los tipos legacy (CuentaCaja.banco, TarjetaCredito.banco)
 * durante F1-F4. Se elimina la duplicacion en F5.
 */

import { Timestamp } from 'firebase/firestore';

// ═════════════════════════════════════════════════════════════════════════
// TITULARIDAD (compartido con ProductoFinanciero)
// ═════════════════════════════════════════════════════════════════════════

export type TitularidadPF = 'empresa' | 'personal';

export type TipoEntidadTitularPF =
  | 'empleado'
  | 'colaborador'
  | 'proveedor'
  | 'cliente'
  | 'socio';   // chk5.F4-USERS · 2026-05-25 · alineado con TipoEntidadCC + UserRole

// ═════════════════════════════════════════════════════════════════════════
// RELACION BANCARIA
// ═════════════════════════════════════════════════════════════════════════

export interface RelacionBancaria {
  id: string;

  // ── Banco ──
  banco: string;                           // "BCP", "IBK", "BBVA", "Interbank"
  bancoNombreCompleto: string;             // "Banco de Crédito del Perú"
  bancoLogo?: string;                      // URL opcional del logo

  // ── Titular ──
  titularidad: TitularidadPF;
  titularEntidadId?: string;               // Solo si titularidad='personal'
  titularEntidadTipo?: TipoEntidadTitularPF;
  titularNombre?: string;                  // Display denormalizado

  // ── Metadatos bancarios opcionales ──
  oficialDeCuenta?: string;                // Nombre del oficial de cuenta
  numeroCliente?: string;                  // ID interno del banco
  fechaApertura?: Timestamp;               // Cuando se abrió la relación
  sucursal?: string;
  notas?: string;

  // ── Estado ──
  activa: boolean;

  // ── Auditoria ──
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

// ═════════════════════════════════════════════════════════════════════════
// FORM DATA
// ═════════════════════════════════════════════════════════════════════════

export interface RelacionBancariaFormData {
  banco: string;
  bancoNombreCompleto: string;
  bancoLogo?: string;
  titularidad: TitularidadPF;
  titularEntidadId?: string;
  titularEntidadTipo?: TipoEntidadTitularPF;
  titularNombre?: string;
  oficialDeCuenta?: string;
  numeroCliente?: string;
  fechaApertura?: Date;
  sucursal?: string;
  notas?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS DE BUSQUEDA / AGRUPACION
// ═════════════════════════════════════════════════════════════════════════

/**
 * Clave compuesta para identificar relaciones bancarias unicas.
 * Una misma persona puede tener relacion bancaria con BCP como persona
 * natural Y como representante de empresa — son 2 RelacionBancaria distintas.
 */
export function buildRelacionBancariaKey(
  banco: string,
  titularidad: TitularidadPF,
  titularEntidadId?: string,
): string {
  if (titularidad === 'empresa') return `empresa::${banco}`;
  return `personal::${titularEntidadId ?? 'sin_id'}::${banco}`;
}
