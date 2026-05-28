// src/types/relacionLaboral.types.ts
// chk5.PERSONAS-v5.6 · Multi-relación + Historial (2026-05-28)
// chk5.PERSONAS-v5.8 · Vinculación con Maestros (entidadMaestroRef)
//
// Modela la(s) relación(es) entre una persona (UserProfile) y el negocio.
// Una persona puede tener N relaciones simultáneas (empleado + socio · honorarios + socio)
// y M relaciones históricas (reclasificada · finalizada · re-incorporada).
//
// Cada RelacionLaboral es INMUTABLE una vez finalizada · el snapshot de datos
// se preserva para auditoría sin importar cambios posteriores en UserProfile.
//
// REEMPLAZA en código nuevo:
//   - users/{uid}/private/datosLaborales (singular) → 1 doc en relacionesLaborales/{id}
//   - users/{uid}/private/datosSocio   (singular)   → 1 doc en relacionesLaborales/{id}
//   - socios/{uid}                                   → relación tipo='socio'
//
// La migración (script idempotente) crea las relaciones equivalentes y deja
// los docs legacy para backward compat hasta que todos los lectores se migren.

import { Timestamp } from 'firebase/firestore';

// ═════════════════════════════════════════════════════════════════════════
// ENUMS · tipos · estados · motivos
// ═════════════════════════════════════════════════════════════════════════

/**
 * Tipo de relación de la persona con el negocio.
 * Una persona puede tener N tipos simultáneos (ej. empleado + socio).
 */
export type TipoRelacion =
  | 'empleado'    // En planilla · sueldo fijo · 5ta categoría · CTS · gratificaciones
  | 'honorarios'  // Profesional independiente · RxH · 4ta categoría · sin vínculo laboral formal
  | 'socio'       // Participación accionaria · cap table · distribuciones · sin sueldo (a menos que también sea empleado)
  | 'externo';    // No staff interno · contactos de Maestros · clientes VIP · colaboradores

/**
 * Estado de la relación · ciclo de vida.
 * vigente · operación normal
 * pausada · suspensión temporal (licencia · maternidad · sabbatical) · re-activable
 * prueba   · período de prueba inicial (típicamente 3-6 meses) · termina vigente o finalizada
 * finalizada · cerrada permanentemente · snapshot inmutable · NO se puede reactivar (se crea nueva relación)
 */
export type EstadoRelacion = 'vigente' | 'pausada' | 'prueba' | 'finalizada';

/**
 * Motivo por el que la relación llegó a estado finalizada.
 * reclasificacion · pasó a otro tipo (ej. honorarios → empleado) · se crea nueva relación
 */
export type MotivoFinRelacion =
  | 'renuncia'
  | 'despido'
  | 'fin_contrato'
  | 'reclasificacion'  // Atomic transition · pasó a otro tipo
  | 'jubilacion'
  | 'venta_participacion' // Solo socios
  | 'otro';

/**
 * Sub-tipo aplicable según el TipoRelacion principal.
 * Granularidad adicional para reportes y políticas.
 */
export type SubTipoEmpleado =
  | 'full_time'
  | 'medio_tiempo'
  | 'por_horas'
  | 'tercerizado'  // Empleado de otra empresa que trabaja para nosotros
  | 'practicante'
  | 'aprendiz';

export type SubTipoHonorarios =
  | 'consultor'
  | 'asesor'
  | 'profesional_servicios'
  | 'freelance';

export type SubTipoSocio =
  | 'fundador'
  | 'inversor'
  | 'minoritario'
  | 'estrategico';

export type SubTipoExterno =
  | 'contacto_proveedor'        // Sales rep · account mgr de un proveedor
  | 'contacto_cliente'          // Comprador en empresa cliente B2B
  | 'cliente_vip'               // Persona natural compra recurrente alto valor
  | 'tercerizado_logistico'     // Motorizado · courier freelance · sin RUC
  | 'colaborador_marketing'     // Influencer · creador · agencia
  | 'contacto_marca'            // Brand mgr · marca aliada
  | 'auditor_externo'           // Read-only contabilidad
  | 'otro';

export type SubTipoRelacion =
  | SubTipoEmpleado
  | SubTipoHonorarios
  | SubTipoSocio
  | SubTipoExterno;

// ═════════════════════════════════════════════════════════════════════════
// SNAPSHOTS INMUTABLES · v5.6 canon
// Al pasar una relación a estado 'finalizada' (o cuando se reclasifica),
// se guarda un snapshot inmutable de los datos vigentes en ese momento.
// El histórico permanece accurate aunque después se editen los datos.
// ═════════════════════════════════════════════════════════════════════════

/**
 * Snapshot de datos de un empleado al momento de finalizar/reclasificar.
 * Equivalente a un congelado de datosLaborales en una fecha específica.
 */
export interface DatosLaboralesSnapshot {
  cargo: string;
  area?: string;
  salarioBruto: number;
  monedaSalario: 'PEN' | 'USD';
  /** Régimen laboral peruano (general · MYPE · agrario · construcción) */
  regimenLaboral?: string;
  /** Si está afiliado a AFP o SNP */
  sistemaPensiones?: 'AFP' | 'SNP';
  /** AFP específica si aplica */
  afp?: string;
  /** % de comisión AFP · solo si AFP */
  comisionAFP?: number;
  /** CUSPP (Código Único de SPP) · solo si AFP */
  cuspp?: string;
  /** Banco para abono · cached snapshot */
  bancoAbono?: string;
  cciAbono?: string;
  fechaSnapshot: Timestamp;
}

/**
 * Snapshot de datos de socio al finalizar (ej. venta de participación).
 */
export interface DatosSocioSnapshot {
  porcentajeParticipacion: number;
  aporteCapitalAcumulado: number;
  monedaAporte: 'PEN' | 'USD';
  fechaIngresoSocio: Timestamp;
  /** Tipo de acciones · ordinarias · preferentes · etc */
  tipoAcciones?: string;
  /** Total recibido en distribuciones hasta el snapshot */
  distribucionesAcumuladas: number;
  fechaSnapshot: Timestamp;
}

/**
 * Snapshot de externo al finalizar (ej. termina contrato de servicio).
 */
export interface DatosExternoSnapshot {
  cargoEnEntidad?: string;
  tarifaAcordada?: number;
  monedaTarifa?: 'PEN' | 'USD';
  /** Volumen acumulado de operaciones · OC · ventas · canjes según subTipo */
  volumenAcumulado?: number;
  fechaSnapshot: Timestamp;
}

// ═════════════════════════════════════════════════════════════════════════
// VINCULACIÓN CON MAESTROS · v5.8 canon
// Solo aplicable a relaciones tipo='externo' principalmente.
// También puede usarse en 'honorarios' si el prestador tiene RUC y vive
// como Proveedor en Maestros (ej. diseñador autónomo).
// ═════════════════════════════════════════════════════════════════════════

/**
 * Tipo de entidad de Maestros con la que se vincula la persona.
 * Refleja las colecciones existentes en Maestros (auditado 2026-05-28).
 */
export type TipoEntidadMaestro = 'cliente' | 'proveedor' | 'marca';

/**
 * Vínculo opcional bidireccional entre una RelacionLaboral y una entidad
 * comercial de Maestros. 1 User → 0..1 Maestro (un externo no puede
 * representar a 2 entidades simultáneas en la misma relación · si lo hace,
 * son 2 relaciones distintas).
 *
 * 1 Maestro → N Users (un proveedor puede tener N contactos humanos).
 *
 * El nombreCachedSnapshot evita 1 lectura extra al renderizar listas ·
 * se actualiza vía Cloud Function cuando el Maestro cambia de nombre.
 */
export interface EntidadMaestroRef {
  tipo: TipoEntidadMaestro;
  id: string;
  /** Rol de la persona DENTRO de la entidad (ej. "Sales Representative") */
  rolEnEntidad?: string;
  /** Snapshot del nombre del Maestro al crear el vínculo · cached read */
  nombreCachedSnapshot: string;
  fechaVinculacion: Timestamp;
  vinculadoPor: string; // uid del admin
}

// ═════════════════════════════════════════════════════════════════════════
// ENTIDAD PRINCIPAL · RelacionLaboral
// ═════════════════════════════════════════════════════════════════════════

/**
 * Una relación específica entre una persona (User) y el negocio.
 *
 * Doc id: auto-generado (no determinístico).
 * FK userId · referencia al UserProfile.
 *
 * IMMUTABILIDAD:
 *   - Mientras estado === 'vigente' | 'pausada' | 'prueba' → mutable (editar salario · cargo · etc)
 *   - Cuando estado === 'finalizada' → se llena fechaFin + motivoFin + snapshot · NO se edita más
 *
 * Reglas Firestore: admin read+write · user puede leer las suyas (where userId == auth.uid).
 */
export interface RelacionLaboral {
  /** Doc id auto-generado */
  id: string;

  /** FK a users/{uid} */
  userId: string;

  /** Tipo de relación */
  tipo: TipoRelacion;

  /** Sub-tipo más granular · opcional */
  subTipo?: SubTipoRelacion;

  /** Estado del ciclo de vida */
  estado: EstadoRelacion;

  // ── Fechas ─────────────────────────────────────────────────────────────
  fechaInicio: Timestamp;
  fechaFin?: Timestamp;
  /** Solo si estado === 'finalizada' */
  motivoFin?: MotivoFinRelacion;
  /** Texto libre · detalle del motivo */
  notaMotivoFin?: string;

  // ── Datos vigentes (mientras está activa) ──────────────────────────────
  // Los datos reales viven en su propia estructura según tipo
  // Aquí solo los más críticos para queries rápidas (lista · cards)

  /** Cargo o rol display · todos los tipos */
  cargoDisplay?: string;

  /** Monto principal · sueldo (empleado) · tarifa mensual (honorarios) · solo para queries · NO source of truth */
  montoMensualReferencia?: number;
  monedaReferencia?: 'PEN' | 'USD';

  // ── Snapshots inmutables (al finalizar) ────────────────────────────────
  datosLaboralesSnapshot?: DatosLaboralesSnapshot;
  datosSocioSnapshot?: DatosSocioSnapshot;
  datosExternoSnapshot?: DatosExternoSnapshot;

  // ── Vinculación con Maestros · v5.8 · principalmente para 'externo' ────
  entidadMaestroRef?: EntidadMaestroRef;

  // ── Audit ───────────────────────────────────────────────────────────────
  creadoPor: string;     // uid del admin que la creó
  fechaCreacion: Timestamp;

  modificadoPor?: string;
  fechaModificacion?: Timestamp;

  /** Notas libres del admin sobre esta relación */
  notas?: string;

  /**
   * Si esta relación es el resultado de una reclasificación de otra,
   * apunta al id de la relación anterior (que está finalizada con
   * motivoFin === 'reclasificacion').
   * Permite rastrear cadenas: honorarios → empleado → empleado promovido.
   */
  relacionAnteriorId?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// INPUTS para creación / edición
// ═════════════════════════════════════════════════════════════════════════

/**
 * Datos mínimos para crear una nueva relación.
 * Los campos opcionales se derivan o calculan en el service.
 */
export interface CrearRelacionInput {
  userId: string;
  tipo: TipoRelacion;
  subTipo?: SubTipoRelacion;
  estado?: EstadoRelacion; // default: 'vigente' (o 'prueba' si así se solicita)
  fechaInicio: Timestamp;
  cargoDisplay?: string;
  montoMensualReferencia?: number;
  monedaReferencia?: 'PEN' | 'USD';
  entidadMaestroRef?: Omit<EntidadMaestroRef, 'fechaVinculacion' | 'vinculadoPor'>;
  notas?: string;
  relacionAnteriorId?: string;
}

/**
 * Input para finalizar una relación · pasa a estado 'finalizada' atómicamente.
 * El service construye el snapshot apropiado según el tipo de relación.
 */
export interface FinalizarRelacionInput {
  relacionId: string;
  motivoFin: MotivoFinRelacionUnion; // tipo helper más abajo
  notaMotivoFin?: string;
  fechaFin?: Timestamp; // default: now()
}

/**
 * Input para reclasificar (atómico · cierra relación A + crea relación B).
 */
export interface ReclasificarRelacionInput {
  relacionAnteriorId: string;
  nuevoTipo: TipoRelacion;
  nuevoSubTipo?: SubTipoRelacion;
  nuevoCargoDisplay?: string;
  nuevoMontoMensualReferencia?: number;
  notaMotivo?: string;
  fechaTransicion?: Timestamp; // default: now()
}

// Helper para tipar el union de motivos válidos en finalización
export type MotivoFinRelacionUnion = MotivoFinRelacion;

// ═════════════════════════════════════════════════════════════════════════
// LABELS Y COLORS CANON · para UI
// ═════════════════════════════════════════════════════════════════════════

export const TIPO_RELACION_LABELS: Record<TipoRelacion, string> = {
  empleado: 'Empleado',
  honorarios: 'Honorarios',
  socio: 'Socio',
  externo: 'Externo',
};

export const TIPO_RELACION_ICONS: Record<TipoRelacion, string> = {
  empleado: '💼',
  honorarios: '📄',
  socio: '🤝',
  externo: '👤',
};

/** Color canon por tipo · alineado con N1-N10 v8.0 */
export const TIPO_RELACION_COLORS: Record<TipoRelacion, { bg: string; text: string; ring: string }> = {
  empleado:   { bg: 'bg-teal-100',   text: 'text-teal-700',   ring: 'ring-teal-200' },
  honorarios: { bg: 'bg-sky-100',    text: 'text-sky-700',    ring: 'ring-sky-200' },
  socio:      { bg: 'bg-purple-100', text: 'text-purple-700', ring: 'ring-purple-200' },
  externo:    { bg: 'bg-amber-100',  text: 'text-amber-700',  ring: 'ring-amber-200' },
};

export const ESTADO_RELACION_LABELS: Record<EstadoRelacion, string> = {
  vigente:    'Vigente',
  pausada:    'Pausada',
  prueba:     'En prueba',
  finalizada: 'Finalizada',
};

export const ESTADO_RELACION_COLORS: Record<EstadoRelacion, { bg: string; text: string }> = {
  vigente:    { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  pausada:    { bg: 'bg-amber-100',   text: 'text-amber-700' },
  prueba:     { bg: 'bg-slate-100',   text: 'text-slate-700' },
  finalizada: { bg: 'bg-rose-100',    text: 'text-rose-700' },
};

export const MOTIVO_FIN_LABELS: Record<MotivoFinRelacion, string> = {
  renuncia:             'Renuncia',
  despido:              'Despido',
  fin_contrato:         'Fin de contrato',
  reclasificacion:      'Reclasificación de tipo',
  jubilacion:           'Jubilación',
  venta_participacion:  'Venta de participación',
  otro:                 'Otro',
};

// ═════════════════════════════════════════════════════════════════════════
// HELPERS · derivar info de un array de relaciones
// ═════════════════════════════════════════════════════════════════════════

/**
 * Retorna solo las relaciones VIGENTES (incluye 'vigente' · 'prueba' · 'pausada').
 * NO incluye 'finalizada'.
 */
export function getRelacionesActivas(relaciones: RelacionLaboral[]): RelacionLaboral[] {
  return relaciones.filter(r => r.estado !== 'finalizada');
}

/**
 * Retorna solo las históricas (finalizadas).
 */
export function getRelacionesHistoricas(relaciones: RelacionLaboral[]): RelacionLaboral[] {
  return relaciones.filter(r => r.estado === 'finalizada');
}

/**
 * Chequea si el user tiene multi-relación vigente (>1 relación NO finalizada).
 * Usado para mostrar badge MULTI en la lista de usuarios.
 */
export function esMultiRelacion(relaciones: RelacionLaboral[]): boolean {
  return getRelacionesActivas(relaciones).length > 1;
}

/**
 * Retorna los tipos de relación VIGENTES de un usuario.
 * Útil para gating UI: si tiene 'empleado' vigente → ver Mi planilla.
 */
export function getTiposVigentes(relaciones: RelacionLaboral[]): TipoRelacion[] {
  return getRelacionesActivas(relaciones).map(r => r.tipo);
}

/**
 * Chequea si el usuario tiene una relación VIGENTE de un tipo específico.
 */
export function tieneRelacionVigente(relaciones: RelacionLaboral[], tipo: TipoRelacion): boolean {
  return getRelacionesActivas(relaciones).some(r => r.tipo === tipo);
}

/**
 * Chequea si el usuario fue reclasificado (tiene una relación finalizada con
 * motivoFin === 'reclasificacion' y existe la "siguiente" relación apuntando
 * a esa anterior).
 */
export function fueReclasificado(relaciones: RelacionLaboral[]): boolean {
  return relaciones.some(r => r.estado === 'finalizada' && r.motivoFin === 'reclasificacion');
}

/**
 * Retorna la relación MÁS RECIENTE de un tipo específico (incluso finalizada).
 * Útil para "su último cargo como empleado fue X".
 */
export function getRelacionMasReciente(
  relaciones: RelacionLaboral[],
  tipo: TipoRelacion,
): RelacionLaboral | null {
  const delTipo = relaciones.filter(r => r.tipo === tipo);
  if (delTipo.length === 0) return null;
  // Ordenar por fechaInicio descendente
  return delTipo.sort((a, b) => b.fechaInicio.toMillis() - a.fechaInicio.toMillis())[0];
}
