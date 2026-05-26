// src/types/auth.types.ts
import { Timestamp } from 'firebase/firestore';

// 1. Definición estricta de los Roles posibles
// chk5.F1-MULTI-ROL (2026-05-24) · agregado 'socio' como rol del modelo de personas unificado.
// UserProfile.roles[] ahora puede contener múltiples roles (una persona = N funciones reales).
export type UserRole =
  | 'admin'
  | 'gerente'
  | 'vendedor'
  | 'comprador'
  | 'almacenero'
  | 'finanzas'
  | 'supervisor'
  | 'invitado'
  | 'socio';      // NUEVO · da acceso al módulo Inversionistas + sub-perfil datosSocio

// ═════════════════════════════════════════════════════════════════════════
// chk5.F4-USERS (2026-05-25) · ESTADOS Y ORÍGENES DEL CICLO DE VIDA
// ═════════════════════════════════════════════════════════════════════════

/**
 * Estados posibles del ciclo de vida de un usuario en el sistema.
 *
 * Transiciones válidas:
 *   invitado_no_registrado → activo            (admin invitó · user clickeó setup-password)
 *   self_signup            → pendiente_aprobacion → activo  (admin aprueba)
 *   activo                 ↔ suspendido         (admin bloquea/reactiva)
 *   activo|suspendido      → archivado          (soft-delete · audit 90d)
 *
 * Backward compat: documentos viejos solo tienen `activo: boolean`.
 *   - `activo: true`  → estado: 'activo'
 *   - `activo: false` + role 'invitado' → estado: 'pendiente_aprobacion'
 *   - `activo: false` + otro role → estado: 'suspendido'
 *
 * Helper `getUserEstado()` deriva el estado automáticamente con fallback.
 */
export type UserEstado =
  | 'invitado_no_registrado'  // Admin envió email · user no clickeó link aún
  | 'pendiente_aprobacion'    // User completó signup · espera aprobación admin
  | 'activo'                  // User operando normalmente
  | 'suspendido'              // Admin bloqueó temporalmente · puede reactivarse
  | 'archivado';              // Soft-delete · audit trail 90 días

/**
 * Origen del usuario · de dónde vino su registro.
 * Útil para auditoría y para diferenciar nivel de confianza inicial.
 */
export type UserOrigen =
  | 'invitacion_admin'   // Admin envió email de invitación · trust alto
  | 'self_signup'        // User entró por /signup público · trust bajo · validar
  | 'creacion_directa';  // Admin creó user con todos los datos · trust máximo

/**
 * Permisos custom (overrides) por usuario individual · fuera de su rol base.
 * - `otorgados`: permisos extra que el user tiene además de los de su(s) rol(es)
 * - `revocados`: permisos del rol base que se le quitan a este user específico
 *
 * Caso de uso: Diego (rol 'planilla') con override `+VER_FINANZAS` para período
 * de prueba. O Carlos (rol 'socio') con `-ELIMINAR_GASTOS` por separación de funciones.
 */
export interface PermisosCustom {
  otorgados: string[];
  revocados: string[];
  motivoOtorgados?: string;
  motivoRevocados?: string;
  vigenteHasta?: Timestamp;
  configuradoPor?: string;  // uid del admin
  fechaConfiguracion?: Timestamp;
}

// ═════════════════════════════════════════════════════════════════════════
// 2. Definición del Perfil de Usuario (Lo que se guarda en Firestore /users)
//
// chk5.F1-MULTI-ROL · multi-rol vía `roles: UserRole[]`.
// chk5.F4-USERS · agregados estado · origen · permisosCustom · audit fields.
// Backward compat con documentos legacy:
//   - `role` singular → fallback a `roles[]`
//   - `activo: boolean` → fallback a `estado`
// Helpers `getUserRoles()`, `hasRole()`, `getUserEstado()` manejan ambos casos.
// ═════════════════════════════════════════════════════════════════════════
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  cargo?: string;
  telefono?: string;  // chk5.F4-USERS · útil para contacto operativo

  /**
   * Array de roles del usuario. Una persona puede tener múltiples roles
   * simultáneamente (ej: admin + socio + vendedor).
   *
   * Documentos viejos pueden tener solo `role` singular · helpers de lectura
   * hacen fallback: `roles ?? [role]`. Documentos nuevos siempre escriben `roles`.
   */
  roles?: UserRole[];

  /**
   * @deprecated chk5.F1-MULTI-ROL · usar `roles[]` en código nuevo.
   * Se mantiene para backward compat con documentos viejos del sistema.
   * Los helpers `getUserRoles()` y `hasRole()` priorizan `roles` y caen a
   * `role` si no existe.
   */
  role: UserRole;

  permisos: string[];

  /**
   * chk5.F4-USERS · permisos custom (overrides) específicos por usuario.
   * Opcional · si no existe · permisos efectivos = permisos por rol.
   * Permisos efectivos = (permisos por rol + otorgados) - revocados.
   */
  permisosCustom?: PermisosCustom;

  /**
   * @deprecated chk5.F4-USERS · usar `estado` en código nuevo.
   * Se mantiene para backward compat con documentos viejos.
   * Helper `getUserEstado()` deriva automáticamente:
   *   activo: true → 'activo'
   *   activo: false + role 'invitado' → 'pendiente_aprobacion'
   *   activo: false + otro role → 'suspendido'
   */
  activo: boolean;

  /**
   * chk5.F4-USERS · estado del ciclo de vida del usuario.
   * Opcional para retrocompatibilidad · docs viejos derivan de `activo`.
   * Docs nuevos SIEMPRE escriben este campo + activo (sincronizados).
   */
  estado?: UserEstado;

  /**
   * chk5.F4-USERS · cómo entró este usuario al sistema.
   * Opcional para retrocompatibilidad · docs viejos asumen 'creacion_directa'.
   */
  origen?: UserOrigen;

  fechaCreacion: Timestamp;
  ultimaConexion?: Timestamp;

  // ── Audit fields · chk5.F4-USERS ──────────────────────────────────────
  /** uid del admin que invitó · solo si origen === 'invitacion_admin' */
  invitadoPor?: string;
  /** Cuándo el admin envió la invitación · solo si origen === 'invitacion_admin' */
  fechaInvitacion?: Timestamp;
  /** Cuándo el user completó el formulario (signup o setup-password) */
  fechaRegistro?: Timestamp;
  /** Cuándo el admin aprobó la cuenta · transición a 'activo' */
  fechaAprobacion?: Timestamp;
  /** uid del admin que aprobó */
  aprobadoPor?: string;
  /** Cuándo se suspendió la cuenta · solo si estado === 'suspendido' */
  fechaSuspension?: Timestamp;
  /** uid del admin que suspendió */
  suspendidoPor?: string;
  /** Motivo de suspensión (visible al user) */
  motivoSuspension?: string;
  /** Cuándo se archivó (soft-delete) */
  fechaArchivado?: Timestamp;
  /** uid del admin que archivó */
  archivadoPor?: string;

  // ── Tracking del registro · self-signup ────────────────────────────────
  /** IP desde donde se registró · útil para detección de bots/abuse */
  ipRegistro?: string;
  /** User-Agent del navegador al registrarse · auditoría */
  userAgentRegistro?: string;
  /** Si el email del user fue verificado (Firebase Auth `emailVerified`) */
  emailVerificado?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS · estado del ciclo de vida (con backward compat)
// chk5.F4-USERS (2026-05-25)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Retorna el estado efectivo del usuario · prioriza `estado` nuevo · fallback
 * derivado de `activo` + `role` para documentos legacy.
 * SIEMPRE usar este helper en lugar de leer `userProfile.estado` o `activo` directamente.
 */
export function getUserEstado(
  user: Pick<UserProfile, 'estado' | 'activo' | 'role' | 'roles'> | null | undefined
): UserEstado {
  if (!user) return 'archivado';
  if (user.estado) return user.estado;
  // Fallback legacy: derivar de activo + role
  if (user.activo === true) return 'activo';
  // activo: false → puede ser pendiente o suspendido según el rol
  const roles = getUserRoles(user);
  if (roles.length === 0 || roles.includes('invitado')) return 'pendiente_aprobacion';
  return 'suspendido';
}

/**
 * Atajo para chequear si el usuario está activo (puede operar el sistema).
 * Reemplaza `userProfile.activo === true` con check del nuevo modelo.
 */
export function isUserActivo(
  user: Pick<UserProfile, 'estado' | 'activo' | 'role' | 'roles'> | null | undefined
): boolean {
  return getUserEstado(user) === 'activo';
}

/**
 * Atajo para chequear si el usuario está pendiente de aprobación.
 * Útil en guards de routing · redirect a /pending-approval.
 */
export function isUserPendiente(
  user: Pick<UserProfile, 'estado' | 'activo' | 'role' | 'roles'> | null | undefined
): boolean {
  const estado = getUserEstado(user);
  return estado === 'pendiente_aprobacion' || estado === 'invitado_no_registrado';
}

/**
 * Labels en español para mostrar el estado en la UI.
 */
export const ESTADO_LABELS: Record<UserEstado, string> = {
  invitado_no_registrado: 'Invitado · esperando registro',
  pendiente_aprobacion: 'Pendiente de aprobación',
  activo: 'Activo',
  suspendido: 'Suspendido',
  archivado: 'Archivado',
};

/**
 * Colors canon por estado (Tailwind classes) · para chips y badges.
 */
export const ESTADO_COLORS: Record<UserEstado, { bg: string; text: string; border: string }> = {
  invitado_no_registrado: { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200' },
  pendiente_aprobacion: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  activo: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  suspendido: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  archivado: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
};

/**
 * Calcula permisos EFECTIVOS del usuario aplicando overrides.
 * Permisos efectivos = (permisos por rol + otorgados) - revocados.
 *
 * Usar este helper en lugar de leer `userProfile.permisos` cuando sea crítico
 * (ej. validar acceso a una acción sensible).
 */
export function calcularPermisosEfectivos(
  user: Pick<UserProfile, 'role' | 'roles' | 'permisosCustom'> | null | undefined
): string[] {
  if (!user) return [];
  const roles = getUserRoles(user);
  const base = new Set(calcularPermisosDeRoles(roles));
  // Aplicar overrides
  if (user.permisosCustom) {
    for (const p of user.permisosCustom.otorgados || []) base.add(p);
    for (const p of user.permisosCustom.revocados || []) base.delete(p);
  }
  return Array.from(base);
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS · multi-rol con backward compat
// chk5.F1-MULTI-ROL (2026-05-24)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Retorna los roles del usuario · prioriza `roles[]` nuevo · fallback a `role`.
 * SIEMPRE usar este helper en lugar de leer `userProfile.role` directamente.
 */
export function getUserRoles(user: Pick<UserProfile, 'role' | 'roles'> | null | undefined): UserRole[] {
  if (!user) return [];
  if (user.roles && user.roles.length > 0) return user.roles;
  if (user.role) return [user.role];
  return [];
}

/**
 * Chequea si el usuario tiene un rol específico (en cualquier posición del array).
 * Reemplazo seguro de `userProfile.role === 'admin'`.
 */
export function hasRole(
  user: Pick<UserProfile, 'role' | 'roles'> | null | undefined,
  role: UserRole,
): boolean {
  return getUserRoles(user).includes(role);
}

/**
 * Chequea si el usuario tiene al menos uno de los roles dados.
 * Reemplazo de los `['admin', 'gerente'].includes(userProfile.role)`.
 */
export function hasAnyRole(
  user: Pick<UserProfile, 'role' | 'roles'> | null | undefined,
  rolesPermitidos: UserRole[],
): boolean {
  const myRoles = getUserRoles(user);
  return rolesPermitidos.some((r) => myRoles.includes(r));
}

/**
 * Retorna el rol "principal" para display (avatar · chip único).
 * Prioriza admin > gerente > resto.
 */
export function getRolPrincipal(
  user: Pick<UserProfile, 'role' | 'roles'> | null | undefined,
): UserRole | null {
  const roles = getUserRoles(user);
  if (roles.length === 0) return null;
  // Prioridad: admin > gerente > resto en orden del enum
  const prioridad: UserRole[] = ['admin', 'gerente', 'socio', 'finanzas', 'vendedor', 'comprador', 'almacenero', 'supervisor', 'invitado'];
  for (const r of prioridad) {
    if (roles.includes(r)) return r;
  }
  return roles[0];
}

/**
 * Calcula el array de permisos union de los roles dados.
 * Usado al guardar UserProfile · escribe `permisos: calcularPermisos(roles)`.
 */
export function calcularPermisosDeRoles(roles: UserRole[]): string[] {
  const set = new Set<string>();
  for (const r of roles) {
    const perms = DEFAULT_PERMISOS[r] || [];
    for (const p of perms) set.add(p);
  }
  return Array.from(set);
}

// 3. Constantes de Permisos (30 permisos granulares por módulo)
// Úsalas así: PERMISOS.CREAR_VENTA
export const PERMISOS = {
  // === General ===
  VER_DASHBOARD: 'ver_dashboard',

  // === Ventas ===
  VER_VENTAS: 'ver_ventas',
  CREAR_VENTA: 'crear_venta',
  EDITAR_VENTA: 'editar_venta',
  CONFIRMAR_VENTA: 'confirmar_venta',
  CANCELAR_VENTA: 'cancelar_venta',

  // === Cotizaciones ===
  VER_COTIZACIONES: 'ver_cotizaciones',
  CREAR_COTIZACION: 'crear_cotizacion',
  VALIDAR_COTIZACION: 'validar_cotizacion',

  // === Entregas ===
  VER_ENTREGAS: 'ver_entregas',
  PROGRAMAR_ENTREGA: 'programar_entrega',
  REGISTRAR_ENTREGA: 'registrar_entrega',

  // === Compras (Requerimientos + OC) ===
  VER_REQUERIMIENTOS: 'ver_requerimientos',
  CREAR_REQUERIMIENTO: 'crear_requerimiento',
  APROBAR_REQUERIMIENTO: 'aprobar_requerimiento',
  VER_ORDENES_COMPRA: 'ver_ordenes_compra',
  CREAR_OC: 'crear_oc',
  RECIBIR_OC: 'recibir_oc',

  // === Inventario ===
  VER_INVENTARIO: 'ver_inventario',
  GESTIONAR_INVENTARIO: 'gestionar_inventario',
  TRANSFERIR_UNIDADES: 'transferir_unidades',

  // === Finanzas ===
  VER_GASTOS: 'ver_gastos',
  CREAR_GASTO: 'crear_gasto',
  VER_TESORERIA: 'ver_tesoreria',
  GESTIONAR_TESORERIA: 'gestionar_tesoreria',
  VER_REPORTES: 'ver_reportes',
  VER_CTRU: 'ver_ctru',

  // === Planilla ===
  VER_PLANILLA: 'ver_planilla',
  GESTIONAR_PLANILLA: 'gestionar_planilla',

  // === Administración ===
  GESTIONAR_USUARIOS: 'gestionar_usuarios',
  GESTIONAR_CONFIGURACION: 'gestionar_configuracion',
  VER_AUDITORIA: 'ver_auditoria',
  ADMIN_TOTAL: 'admin_total',

  // === Inversionistas · chk5.E-INV ===
  /** Acceso al módulo de vista ejecutiva para socios/inversionistas */
  VER_INVERSIONISTAS: 'ver_inversionistas',
  /** Capacidad de configurar socios y porcentajes de participación */
  GESTIONAR_SOCIOS: 'gestionar_socios',
} as const;

// 4. Permisos predeterminados por rol
export const DEFAULT_PERMISOS: Record<UserRole, string[]> = {
  // Admin: acceso total
  admin: Object.values(PERMISOS),

  // Gerente: todo excepto gestión de usuarios, config y admin_total
  gerente: [
    PERMISOS.VER_DASHBOARD,
    // Ventas
    PERMISOS.VER_VENTAS, PERMISOS.CREAR_VENTA, PERMISOS.EDITAR_VENTA,
    PERMISOS.CONFIRMAR_VENTA, PERMISOS.CANCELAR_VENTA,
    // Cotizaciones
    PERMISOS.VER_COTIZACIONES, PERMISOS.CREAR_COTIZACION, PERMISOS.VALIDAR_COTIZACION,
    // Entregas
    PERMISOS.VER_ENTREGAS, PERMISOS.PROGRAMAR_ENTREGA, PERMISOS.REGISTRAR_ENTREGA,
    // Compras
    PERMISOS.VER_REQUERIMIENTOS, PERMISOS.CREAR_REQUERIMIENTO, PERMISOS.APROBAR_REQUERIMIENTO,
    PERMISOS.VER_ORDENES_COMPRA, PERMISOS.CREAR_OC, PERMISOS.RECIBIR_OC,
    // Inventario
    PERMISOS.VER_INVENTARIO, PERMISOS.GESTIONAR_INVENTARIO, PERMISOS.TRANSFERIR_UNIDADES,
    // Finanzas
    PERMISOS.VER_GASTOS, PERMISOS.CREAR_GASTO,
    PERMISOS.VER_TESORERIA, PERMISOS.GESTIONAR_TESORERIA,
    PERMISOS.VER_REPORTES, PERMISOS.VER_CTRU,
    // Planilla
    PERMISOS.VER_PLANILLA, PERMISOS.GESTIONAR_PLANILLA,
    // Admin (solo auditoría)
    PERMISOS.VER_AUDITORIA,
  ],

  // Vendedor: ventas, cotizaciones, entregas, requerimientos básicos
  vendedor: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_VENTAS, PERMISOS.CREAR_VENTA, PERMISOS.EDITAR_VENTA,
    PERMISOS.CONFIRMAR_VENTA, PERMISOS.CANCELAR_VENTA,
    PERMISOS.VER_COTIZACIONES, PERMISOS.CREAR_COTIZACION, PERMISOS.VALIDAR_COTIZACION,
    PERMISOS.VER_ENTREGAS, PERMISOS.PROGRAMAR_ENTREGA, PERMISOS.REGISTRAR_ENTREGA,
    PERMISOS.VER_REQUERIMIENTOS, PERMISOS.CREAR_REQUERIMIENTO,
    PERMISOS.VER_ORDENES_COMPRA,
    PERMISOS.VER_INVENTARIO,
    PERMISOS.VER_GASTOS,
    PERMISOS.VER_REPORTES,
  ],

  // Comprador: requerimientos, OC, inventario
  comprador: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_REQUERIMIENTOS, PERMISOS.CREAR_REQUERIMIENTO, PERMISOS.APROBAR_REQUERIMIENTO,
    PERMISOS.VER_ORDENES_COMPRA, PERMISOS.CREAR_OC, PERMISOS.RECIBIR_OC,
    PERMISOS.VER_INVENTARIO, PERMISOS.GESTIONAR_INVENTARIO, PERMISOS.TRANSFERIR_UNIDADES,
    PERMISOS.VER_GASTOS,
  ],

  // Almacenero: inventario, recepción OC, transferencias
  almacenero: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_INVENTARIO, PERMISOS.GESTIONAR_INVENTARIO, PERMISOS.TRANSFERIR_UNIDADES,
    PERMISOS.RECIBIR_OC,
    PERMISOS.VER_ORDENES_COMPRA,
    PERMISOS.VER_VENTAS,
    PERMISOS.VER_ENTREGAS,
  ],

  // Finanzas: gastos, tesorería, reportes, CTRU
  finanzas: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_GASTOS, PERMISOS.CREAR_GASTO,
    PERMISOS.VER_TESORERIA, PERMISOS.GESTIONAR_TESORERIA,
    PERMISOS.VER_REPORTES, PERMISOS.VER_CTRU,
    PERMISOS.VER_PLANILLA, PERMISOS.GESTIONAR_PLANILLA,
    PERMISOS.VER_VENTAS,
    PERMISOS.VER_ORDENES_COMPRA,
    PERMISOS.VER_AUDITORIA,
  ],

  // Supervisor: solo lectura en todos los módulos
  supervisor: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_VENTAS,
    PERMISOS.VER_COTIZACIONES,
    PERMISOS.VER_ENTREGAS,
    PERMISOS.VER_REQUERIMIENTOS,
    PERMISOS.VER_ORDENES_COMPRA,
    PERMISOS.VER_INVENTARIO,
    PERMISOS.VER_GASTOS,
    PERMISOS.VER_TESORERIA,
    PERMISOS.VER_REPORTES,
    PERMISOS.VER_CTRU,
    PERMISOS.VER_AUDITORIA,
  ],

  // Invitado: sin permisos
  invitado: [],

  // Socio · chk5.F1-MULTI-ROL · acceso al módulo Inversionistas + dashboard básico
  // No es un rol operativo · es un "rol de propietario" · permisos limitados al
  // dominio de inversión. Si la persona también opera el sistema (admin/gerente/
  // vendedor/etc), tiene esos roles ADICIONALMENTE.
  socio: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_INVERSIONISTAS,
    PERMISOS.VER_REPORTES,
  ],
};

// 5. Labels para mostrar en la UI
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente General',
  vendedor: 'Vendedor',
  comprador: 'Comprador',
  almacenero: 'Almacenero',
  finanzas: 'Finanzas',
  supervisor: 'Supervisor',
  invitado: 'Invitado',
  socio: 'Socio',          // chk5.F1-MULTI-ROL
};

// 6. Descripciones cortas de cada rol
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Acceso total al sistema. Gestiona usuarios, configuración y todos los módulos.',
  gerente: 'Ve y gestiona todos los módulos operativos. No gestiona usuarios ni configuración del sistema.',
  vendedor: 'Crea y gestiona ventas, cotizaciones, entregas. Puede crear requerimientos y ver inventario.',
  comprador: 'Gestiona requerimientos y órdenes de compra. Controla la recepción de mercadería.',
  almacenero: 'Gestiona inventario, recibe órdenes de compra y realiza transferencias entre almacenes.',
  finanzas: 'Gestiona gastos, tesorería, reportes financieros y CTRU. Ve ventas y compras como referencia.',
  supervisor: 'Acceso de solo lectura a todos los módulos. No puede crear ni modificar registros.',
  invitado: 'Sin acceso al sistema. Cuenta pendiente de asignación de rol.',
  socio: 'Propietario del negocio · acceso a módulo Inversionistas (vista ejecutiva · capital · ROI). Sub-perfil datosSocio con % participación y aportes.',
};
