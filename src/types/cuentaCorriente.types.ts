/**
 * cuentaCorriente.types.ts — S55 · Cuenta Corriente Unificada
 *
 * Modelo procedural y financiero unificado por entidad. Reemplaza:
 *   - oc.estadoPago / historialPagos / montoPendiente
 *   - venta.estadoPago / cobros / saldoAFavor / montoPendiente
 *   - envio.pagosColaborador / estadoPagoColaborador / montoPagado
 *   - boleta.estado / adelanto.estado (parcialmente)
 *
 * Decisiones cerradas (ver REGISTRO_IMPLEMENTACION.md S55):
 *  - 4 entidades: cliente, proveedor, colaborador, empleado
 *  - BD separada por (entidad_id, tipo) — UI agregada por persona física
 *  - Saldos por moneda separados (USD ≠ PEN, no convertibles)
 *  - Aplicación de saldo siempre con confirmación manual
 *  - Sin caducidad de saldos
 *  - Movimientos inmutables (audit trail)
 *  - CC nunca se elimina
 */

import { Timestamp } from 'firebase/firestore';

// ═════════════════════════════════════════════════════════════════════════
// ENUMS Y TIPOS BASE
// ═════════════════════════════════════════════════════════════════════════

/**
 * Tipo de entidad financiera. Determina el contexto contable de la CC.
 *
 * Una misma persona física puede tener N CCs distintas (una por rol):
 * Carlos Pérez puede ser cliente, empleado y colaborador a la vez —
 * sus 3 CCs viven separadas en BD para limpieza contable, y la UI las
 * agrega en su ficha de Maestros.
 */
export type TipoEntidadCC = 'cliente' | 'proveedor' | 'colaborador' | 'empleado';

/**
 * Tipo de movimiento del libro de la CC.
 *
 * **DÉBITOS** ("la entidad nos debe / aumenta lo que nos deben"):
 *   - debito_oc:                OC emitida a proveedor (debe entregar)
 *   - debito_venta:             Venta emitida a cliente (debe pagar)
 *   - debito_envio:             Pago al colaborador devengado por envío
 *   - debito_adelanto_empleado: Adelanto pagado a empleado (debe descontar)
 *   - debito_prestamo_empleado: Préstamo a empleado/colaborador
 *   - debito_boleta_emitida:    Boleta de planilla aprobada (debemos sueldo)
 *   - debito_comision:          Comisión devengada al comisionista
 *
 * **CRÉDITOS** ("saldamos / nos pagan / les pagamos / nos descuentan"):
 *   - credito_pago_oc:                Pago hecho al proveedor
 *   - credito_cobro_venta:            Cobro recibido del cliente
 *   - credito_pago_envio:             Pago hecho al colaborador
 *   - credito_pago_boleta:            Pago de boleta al empleado
 *   - credito_descuento_adelanto:     Adelanto descontado en boleta
 *   - credito_reclamo:                Crédito por reclamo aceptado
 *   - credito_descuento_comercial:    Descuento del proveedor (Subscribe&Save)
 *   - credito_adelanto_cotizacion:    Cliente paga adelanto sobre cotización
 *   - credito_devolucion_cliente:     Devolución de mercadería del cliente
 *
 * **APLICACIONES / ESPECIALES**:
 *   - aplicacion_saldo:    Saldo a favor aplicado a otro doc (resta saldo)
 *   - devolucion_cash:     Devolución de dinero al cliente / cobro al proveedor
 *   - ajuste_manual:       Ajuste contable manual (motivo obligatorio)
 */
export type TipoMovimientoCC =
  // Débitos
  | 'debito_oc'
  | 'debito_venta'
  | 'debito_envio'
  | 'debito_gasto'
  | 'debito_adelanto_empleado'
  | 'debito_prestamo_empleado'
  | 'debito_boleta_emitida'
  | 'debito_comision'
  // Créditos
  | 'credito_pago_oc'
  | 'credito_cobro_venta'
  | 'credito_pago_envio'
  | 'credito_pago_gasto'
  | 'credito_pago_boleta'
  | 'credito_descuento_adelanto'
  | 'credito_reclamo'
  | 'credito_descuento_comercial'
  | 'credito_adelanto_cotizacion'
  | 'credito_devolucion_cliente'
  // Aplicaciones / especiales
  | 'aplicacion_saldo'
  | 'devolucion_cash'
  | 'ajuste_manual';

/** Moneda del movimiento. Saldos USD y PEN viven separados (Decisión F3). */
export type MonedaCC = 'PEN' | 'USD';

/** Tipo de documento al que un movimiento puede referirse. */
export type RefDocumentoCC =
  | 'oc'
  | 'venta'
  | 'envio'
  | 'gasto'
  | 'reclamo'
  | 'boleta'
  | 'adelanto'
  | 'pago_unificado'
  | 'devolucion'
  | 'cotizacion';

// ═════════════════════════════════════════════════════════════════════════
// DOCUMENTOS PRINCIPALES
// ═════════════════════════════════════════════════════════════════════════

/**
 * Cuenta Corriente de una entidad. Doc raíz por entidadId + tipo.
 *
 * Identificador determinístico: `{tipo}_{entidadId}` (ej: `proveedor_abc123`).
 * Esto permite acceso O(1) y evita queries para resolver una CC.
 *
 * Convención de saldos:
 *   - **positivo** → la entidad nos debe (CxC, saldo a favor nuestro)
 *   - **negativo** → nosotros le debemos (CxP, saldo a favor de la entidad)
 *   - **cero**     → cuenta saldada
 *
 * Saldos por moneda son independientes — un proveedor puede tener
 * saldo USD positivo (le debemos USD por OCs) y saldo PEN cero.
 */
export interface CuentaCorriente {
  /** ID determinístico: `{tipo}_{entidadId}`. */
  id: string;

  // ── Identidad ─────────────────────────────────────────────────────
  /** ID de la entidad en su colección de origen (proveedor.id, cliente.id, etc.). */
  entidadId: string;
  /** Tipo de relación financiera. */
  tipo: TipoEntidadCC;
  /** Nombre desnormalizado para UI rápida (no requiere lookup). */
  entidadNombre: string;

  // ── Saldos por moneda (Decisión F3) ───────────────────────────────
  /** Saldo en PEN. Positivo = nos debe · Negativo = le debemos. */
  saldoPEN: number;
  /** Saldo en USD. Positivo = nos debe · Negativo = le debemos. */
  saldoUSD: number;

  // ── Metadata ──────────────────────────────────────────────────────
  fechaCreacion: Timestamp;
  /** Fecha del último movimiento registrado (para queries de "actividad reciente"). */
  fechaUltimoMovimiento?: Timestamp;
  /** Contador denormalizado de movimientos (para paginación / KPIs). */
  cantidadMovimientos: number;

  /** Notas administrativas opcionales (no operativas). */
  notas?: string;
}

/**
 * Movimiento del libro de la CC. INMUTABLE después de creado.
 *
 * Cada movimiento es atómico vía transacción Firestore:
 *  1. Lee/crea CC
 *  2. Calcula nuevo saldo según tipo
 *  3. Crea MovimientoCC con snapshot post-movimiento
 *  4. Actualiza CC.saldoPEN/saldoUSD + fechaUltimoMovimiento + cantidadMovimientos
 *
 * Si la transacción falla, ningún cambio se persiste.
 */
export interface MovimientoCC {
  id: string;
  /** FK a CuentaCorriente.id. */
  cuentaCorrienteId: string;

  // ── Cuándo ────────────────────────────────────────────────────────
  /** Fecha contable del movimiento (puede ser distinta de fechaRegistro). */
  fecha: Timestamp;
  /** Cuándo se grabó en sistema (para auditoría). */
  fechaRegistro: Timestamp;

  // ── Qué ───────────────────────────────────────────────────────────
  tipo: TipoMovimientoCC;
  descripcion: string;

  // ── Cuánto ────────────────────────────────────────────────────────
  /** Moneda del movimiento (debe coincidir con la del documento origen). */
  moneda: MonedaCC;
  /**
   * Monto SIEMPRE positivo. La dirección (débito/crédito) se infiere del `tipo`.
   * Para saber si suma o resta al saldo, usar helper `esDebito(tipo)` /
   * `esCredito(tipo)`.
   */
  monto: number;

  // ── Documento origen (polimórfico) ────────────────────────────────
  refDocumentoTipo?: RefDocumentoCC;
  refDocumentoId?: string;
  /** Numero legible: OC-2026-001, REC-2026-005, etc. */
  refDocumentoNumero?: string;

  // ── Movimiento financiero asociado (si hay flujo de cash) ─────────
  /** ID del movimiento de tesorería generado (cobros/pagos reales). */
  movimientoTesoreriaId?: string;

  // ── Si es aplicación de saldo a otro doc ──────────────────────────
  aplicadoARefTipo?: 'oc' | 'venta' | 'cotizacion';
  aplicadoARefId?: string;
  aplicadoARefNumero?: string;

  // ── Snapshot post-movimiento (auditoría obligatoria) ──────────────
  /** Saldo PEN de la CC DESPUÉS de aplicar este movimiento. */
  saldoPENDespues: number;
  /** Saldo USD de la CC DESPUÉS de aplicar este movimiento. */
  saldoUSDDespues: number;

  // ── Auditoría ─────────────────────────────────────────────────────
  /** UID del usuario que registró el movimiento. */
  registradoPor: string;
  notas?: string;

  /** Obligatorio si tipo === 'ajuste_manual'. Justifica el movimiento. */
  motivoAjuste?: string;

  /**
   * Clave de idempotencia opcional. Si se provee, el service verifica que
   * no exista otro movimiento con la misma key en la CC. Útil para reintentos
   * de operaciones complejas (webhooks ML, etc.).
   */
  idempotencyKey?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS DE TIPO
// ═════════════════════════════════════════════════════════════════════════

/** Tipos de movimiento que SUMAN al saldo (la entidad nos debe más). */
export const TIPOS_DEBITO: TipoMovimientoCC[] = [
  'debito_oc',
  'debito_venta',
  'debito_envio',
  'debito_gasto',
  'debito_adelanto_empleado',
  'debito_prestamo_empleado',
  'debito_boleta_emitida',
  'debito_comision',
];

/** Tipos de movimiento que RESTAN al saldo (saldamos / nos pagan). */
export const TIPOS_CREDITO: TipoMovimientoCC[] = [
  'credito_pago_oc',
  'credito_cobro_venta',
  'credito_pago_envio',
  'credito_pago_gasto',
  'credito_pago_boleta',
  'credito_descuento_adelanto',
  'credito_reclamo',
  'credito_descuento_comercial',
  'credito_adelanto_cotizacion',
  'credito_devolucion_cliente',
];

/**
 * Tipos especiales: aplicación de saldo (RESTA al saldo positivo) y
 * devolución cash (RESTA al saldo positivo, igual que aplicación pero
 * con flujo de tesorería).
 *
 * `ajuste_manual` no entra en débito ni crédito — su dirección la define
 * el campo `direccion` del input.
 */
export const TIPOS_APLICACION: TipoMovimientoCC[] = [
  'aplicacion_saldo',
  'devolucion_cash',
];

/** ¿El tipo de movimiento suma al saldo? */
export function esDebito(tipo: TipoMovimientoCC): boolean {
  return TIPOS_DEBITO.includes(tipo);
}

/** ¿El tipo de movimiento resta al saldo? */
export function esCredito(tipo: TipoMovimientoCC): boolean {
  return TIPOS_CREDITO.includes(tipo) || TIPOS_APLICACION.includes(tipo);
}

/** Construye el ID determinístico de una CC. */
export function buildCuentaCorrienteId(
  entidadId: string,
  tipo: TipoEntidadCC,
): string {
  return `${tipo}_${entidadId}`;
}

// ═════════════════════════════════════════════════════════════════════════
// FORM DATA / INPUTS
// ═════════════════════════════════════════════════════════════════════════

/**
 * Input para registrar un movimiento. Si la CC no existe, se crea
 * automáticamente con saldos en 0 usando `entidadNombre`.
 */
export interface MovimientoCCInput {
  // ── Identidad de la CC ────────────────────────────────────────────
  entidadId: string;
  tipo: TipoEntidadCC;
  /** Nombre denormalizado. Solo se usa si la CC no existe (al crearla). */
  entidadNombre: string;

  // ── Movimiento ────────────────────────────────────────────────────
  /** Default: ahora. */
  fecha?: Date;
  tipoMovimiento: TipoMovimientoCC;
  descripcion: string;
  moneda: MonedaCC;
  /** Siempre positivo. */
  monto: number;

  // ── Refs opcionales ───────────────────────────────────────────────
  refDocumentoTipo?: RefDocumentoCC;
  refDocumentoId?: string;
  refDocumentoNumero?: string;
  movimientoTesoreriaId?: string;

  // ── Si es aplicación ──────────────────────────────────────────────
  aplicadoARefTipo?: MovimientoCC['aplicadoARefTipo'];
  aplicadoARefId?: string;
  aplicadoARefNumero?: string;

  // ── Solo para ajuste_manual ───────────────────────────────────────
  /** Para `ajuste_manual`: 'debito' suma al saldo, 'credito' resta. */
  direccionAjuste?: 'debito' | 'credito';
  /** Obligatorio si tipoMovimiento === 'ajuste_manual'. */
  motivoAjuste?: string;

  // ── Notas ─────────────────────────────────────────────────────────
  notas?: string;

  /** Para evitar duplicados en reintentos. */
  idempotencyKey?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// QUERIES Y FILTROS
// ═════════════════════════════════════════════════════════════════════════

export interface CuentaCorrienteFiltros {
  tipo?: TipoEntidadCC;
  /** Solo CCs con algún saldo distinto de cero. */
  conSaldo?: boolean;
  /** Solo CCs donde la entidad nos debe (saldo > 0 en alguna moneda). */
  soloDeudoras?: boolean;
  /** Solo CCs donde le debemos a la entidad (saldo < 0 en alguna moneda). */
  soloAcreedoras?: boolean;
}

export interface MovimientoCCFiltros {
  cuentaCorrienteId?: string;
  entidadId?: string;
  tipoMovimiento?: TipoMovimientoCC | TipoMovimientoCC[];
  fechaDesde?: Date;
  fechaHasta?: Date;
  refDocumentoId?: string;
  moneda?: MonedaCC;
}

// ═════════════════════════════════════════════════════════════════════════
// KPIS / RESÚMENES
// ═════════════════════════════════════════════════════════════════════════

export interface SaldosResumen {
  totalEntidades: number;
  /** Suma de saldos positivos (lo que nos deben en total). */
  totalDebenAEmpresa: { PEN: number; USD: number };
  /** Suma absoluta de saldos negativos (lo que la empresa debe en total). */
  totalEmpresaDebe: { PEN: number; USD: number };

  porTipo: Record<TipoEntidadCC, {
    cantidadEntidades: number;
    debenAEmpresa: { PEN: number; USD: number };
    empresaDebe: { PEN: number; USD: number };
  }>;
}

// ═════════════════════════════════════════════════════════════════════════
// LABELS PARA UI (i18n preparado)
// ═════════════════════════════════════════════════════════════════════════

export const TIPO_ENTIDAD_CC_LABELS: Record<TipoEntidadCC, string> = {
  cliente: 'Cliente',
  proveedor: 'Proveedor',
  colaborador: 'Colaborador',
  empleado: 'Empleado',
};

export const TIPO_MOVIMIENTO_CC_LABELS: Record<TipoMovimientoCC, string> = {
  // Débitos
  debito_oc: 'OC emitida',
  debito_venta: 'Venta emitida',
  debito_envio: 'Envío devengado',
  debito_gasto: 'Gasto registrado',
  debito_adelanto_empleado: 'Adelanto pagado',
  debito_prestamo_empleado: 'Préstamo otorgado',
  debito_boleta_emitida: 'Boleta emitida',
  debito_comision: 'Comisión devengada',
  // Créditos
  credito_pago_oc: 'Pago a proveedor',
  credito_cobro_venta: 'Cobro de venta',
  credito_pago_envio: 'Pago a colaborador',
  credito_pago_gasto: 'Pago de gasto',
  credito_pago_boleta: 'Pago de boleta',
  credito_descuento_adelanto: 'Adelanto descontado',
  credito_reclamo: 'Crédito por reclamo',
  credito_descuento_comercial: 'Descuento comercial',
  credito_adelanto_cotizacion: 'Adelanto de cotización',
  credito_devolucion_cliente: 'Devolución del cliente',
  // Aplicaciones / especiales
  aplicacion_saldo: 'Aplicación de saldo a favor',
  devolucion_cash: 'Devolución de dinero',
  ajuste_manual: 'Ajuste manual',
};
