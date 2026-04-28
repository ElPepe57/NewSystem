/**
 * tarjetaCredito.types.ts — S58d v2 · Modelo banking-grade
 *
 * Tarjeta de crédito como entidad rica con CC espejo (TipoEntidadCC='tarjeta_credito').
 * Soporta titularidad empresarial o personal (de un empleado/colaborador).
 *
 * Cambios respecto al modelo v1 (legacy):
 *   - Sin saldoActualUSD/disponibleUSD obligatorios (saldo se deriva de la CC espejo)
 *   - Sin limiteUSD como tope (solo topeControlUSD opcional · alerta)
 *   - Titularidad ramificada (empresa / personal con vinculación a entidad)
 *   - Bi-moneda opcional (cuentas BCP/IBK/BBVA empresariales)
 *   - Cargos vinculados a docs (OCs/gastos) que se saldan con el cargo
 *   - 2 transacciones atómicas: TX-1 (cargar) y TX-2 (pagar estado de cuenta)
 *
 * Decisiones aplicadas (S58):
 *   - D-S58-7: TC = entidad rica TarjetaCredito + CargoTarjeta
 *   - D-S58-8: TipoEntidadCC = 'tarjeta_credito'
 *   - D-S58-19: Sin tope · saldo negativo = deuda con titular
 *   - D-S58-23: Bi-moneda (USD + PEN simultáneos)
 */

import { Timestamp } from 'firebase/firestore';
import type { MetodoTesoreria, MonedaTesoreria } from './tesoreria.types';

// ═════════════════════════════════════════════════════════════════════════
// TARJETA DE CRÉDITO (entidad principal)
// ═════════════════════════════════════════════════════════════════════════

export type TitularidadTC = 'empresa' | 'personal';
export type MarcaTC = 'visa' | 'mastercard' | 'amex' | 'diners' | 'otro';
export type TipoEntidadTitularTC =
  | 'empleado'
  | 'colaborador'
  | 'proveedor'
  | 'cliente';

export interface TarjetaCredito {
  id: string;
  codigo: string;                      // TC-001, TC-002, etc.
  nombre: string;                      // "BBVA Visa Jose · ····6411"

  // ── Identidad bancaria ──
  banco: string;                       // BBVA, BCP, Interbank
  bancoNombreCompleto?: string;
  ultimosDigitos: string;              // "6411"
  marca?: MarcaTC;

  // ── Moneda ──
  moneda: MonedaTesoreria;             // Mono-moneda o moneda principal (bi-moneda)
  esBiMoneda?: boolean;                // S58d v2 · D-S58-23 · acumula USD + PEN simultáneos

  // ─── S58d v2 — Titularidad ───────────────────────────────────────────
  /**
   * - 'empresa': TC del negocio. Pago va al banco emisor con cuenta empresarial.
   * - 'personal': TC del titular (empleado/colaborador). Pago = reembolso al titular.
   *
   * Para retrocompat con tarjetas legacy (sin titularidad), default 'empresa'.
   */
  titularidad?: TitularidadTC;
  titularEntidadId?: string;
  titularEntidadTipo?: TipoEntidadTitularTC;
  titularNombre?: string;              // Desnormalizado (display)

  // ─── S58d v2 — Tope de control (opcional, NO es límite del banco) ────
  /**
   * Monto MÁXIMO de cargos del negocio acumulados antes de alertar.
   * Si vacío, no hay alerta. NO bloquea operaciones (la TC tiene
   * disponibilidad total real con el banco).
   */
  topeControlUSD?: number;
  topeControlPEN?: number;             // Para bi-moneda

  // ── Ciclo (referencial, no operativo) ──
  diaCorte: number;                    // 1-31
  diaPago: number;                     // 1-31

  // ── Cuenta de pago default (cuando se paga al banco emisor) ──
  /**
   * Cuenta empresarial sugerida para pagar al banco. Solo aplica para
   * titularidad='empresa'. Para 'personal', el reembolso va al titular
   * directamente y la cuenta origen se elige al momento del pago.
   */
  cuentaPagoDefaultId?: string;

  // ─── LEGACY v1 (mantener required para retrocompat con código v1) ───
  // Estos campos siguen siendo obligatorios mientras existe la UI v1
  // (TabTarjetasCredito legacy). Cuando se reescriba la UI a v2, se podrán
  // marcar opcionales y eventualmente eliminar.
  /** @deprecated v2 — usar topeControlUSD. */
  limiteUSD: number;
  /** @deprecated v2 — saldo se deriva de la CC espejo. */
  saldoActualUSD: number;
  /** @deprecated v2 — sin tope, no aplica. */
  disponibleUSD: number;

  // ── Estado ──
  activa: boolean;

  // ── Auditoría ──
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Datos para crear/editar una tarjeta (v2).
 */
export interface TarjetaCreditoFormData {
  nombre: string;
  banco: string;
  bancoNombreCompleto?: string;
  ultimosDigitos: string;
  marca?: MarcaTC;
  moneda: MonedaTesoreria;
  esBiMoneda?: boolean;

  // Titularidad v2
  titularidad?: TitularidadTC;
  titularEntidadId?: string;
  titularEntidadTipo?: TipoEntidadTitularTC;
  titularNombre?: string;

  // Tope opcional
  topeControlUSD?: number;
  topeControlPEN?: number;

  // Ciclo
  diaCorte: number;
  diaPago: number;

  // Cuenta de pago default
  cuentaPagoDefaultId?: string;

  activa: boolean;

  // Legacy (mantener para que el form viejo no rompa)
  /** @deprecated */
  limiteUSD: number;
}

// ═════════════════════════════════════════════════════════════════════════
// CARGO A TARJETA (TX-1)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Documento que se cancela con un cargo a tarjeta.
 * Snapshot — captura el monto aplicado del cargo a este documento.
 */
export interface DocumentoCanceladoCargoTC {
  tipo: 'oc' | 'envio' | 'gasto';
  documentoId: string;
  documentoNumero: string;
  /** Monto aplicado de este cargo al documento. */
  montoAplicado: number;
  /** Moneda del documento (informativo). */
  monedaDocumento: MonedaTesoreria;
}

/**
 * Estado del cargo (vs. estado de cuenta del banco emisor).
 */
export type EstadoCargoTC = 'pendiente' | 'parcial' | 'pagado';

/**
 * Cargo individual a una tarjeta de crédito.
 *
 * Cada cargo:
 *   - Genera 1 débito en la CC de la tarjeta (saldo TC sube)
 *   - Genera N créditos en CCs de los documentos cancelados (saldan deuda)
 *   - NO toca tesorería (la tarjeta es un pasivo, no movimiento de caja)
 *
 * Cuando llega el estado de cuenta, los cargos se pagan vía
 * PagoEstadoCuentaTarjeta (TX-2) y se marcan como `pagado`.
 */
export interface CargoTarjeta {
  id: string;
  numeroCargo: string;                 // CARG-2026-001
  tarjetaCreditoId: string;
  tarjetaCreditoNombre: string;        // Desnormalizado

  fecha: Timestamp;                    // Fecha del cargo
  descripcion: string;

  // Monto
  moneda: MonedaTesoreria;             // Moneda del cargo
  monto: number;                       // Monto en la moneda del cargo

  // TC al momento del cargo (referencia para diferencial cambiario futuro)
  tcDelDia?: number;                   // TC oficial del día del cargo
  fuenteTcDelDia?: 'auto' | 'manual';  // 'auto' = tipoCambio.service · 'manual' = override
  motivoOverrideTc?: string;           // Solo si fuenteTcDelDia='manual'

  // Documentos cancelados (snapshot al momento del cargo)
  documentosCancelados: DocumentoCanceladoCargoTC[];

  // Estado del pago al banco emisor
  estado: EstadoCargoTC;
  montoPagado: number;                 // Acumulado de los pagos al banco
  montoPendiente: number;              // monto - montoPagado

  // Cuando se paga, captura los IDs del PagoEstadoCuentaTarjeta y diferencial
  pagosIds?: string[];                 // PagoEstadoCuentaTarjeta IDs que aplicaron a este cargo
  diferencialCambiarioPEN?: number;    // Acumulado · solo si titularidad='empresa'

  // ── LEGACY (v1) ──
  /** @deprecated v2 — usar `monto` y `moneda`. */
  montoUSD?: number;
  /** @deprecated v2 — usar `tcDelDia`. */
  montoPENReferencial?: number;
  /** @deprecated v2 — usar `montoPagado`/`estado`. */
  pagado?: boolean;
  /** @deprecated v2 — el pago vive en PagoEstadoCuentaTarjeta. */
  fechaPago?: Timestamp;
  /** @deprecated v2 — diferencial vive por pago, no por cargo. */
  tcPago?: number;
  /** @deprecated v2 */
  montoPENReal?: number;

  // Vinculación legacy con OC (mantener por retrocompat)
  ordenCompraId?: string;
  ordenCompraNumero?: string;

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  movimientoCCTarjetaId?: string;      // FK al MovimientoCC en CC de la tarjeta (débito)
}

/**
 * Input para crear un cargo a tarjeta vía TX-1.
 */
export interface CargoTarjetaInput {
  tarjetaCreditoId: string;

  fecha: Date;
  descripcion: string;

  moneda: MonedaTesoreria;
  monto: number;

  // TC del día (auto o manual)
  tcDelDia?: number;
  fuenteTcDelDia?: 'auto' | 'manual';
  motivoOverrideTc?: string;

  // Documentos a cancelar (Σ montoAplicado === monto)
  documentosCancelados: DocumentoCanceladoCargoTC[];

  // Idempotencia
  idempotencyKey?: string;
}

export interface CargoTarjetaResult {
  cargoId: string;
  numeroCargo: string;
  movimientoCCTarjetaId: string;
  movimientosCCDocumentosIds: string[]; // 1 por documento cancelado
  errores: string[];
}

// ═════════════════════════════════════════════════════════════════════════
// PAGO DE ESTADO DE CUENTA (TX-2)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Modo de pago del estado de cuenta.
 *
 * - 'banco_emisor': El negocio paga al banco con su cuenta empresarial.
 *   Solo aplica para tarjetas con titularidad='empresa'. Genera diferencial
 *   cambiario contra TCPA del Pool USD.
 *
 * - 'reembolso_titular': El negocio reembolsa al titular (empleado/colaborador)
 *   por uso de su tarjeta personal. Solo aplica para titularidad='personal'.
 *   NO hay diferencial cambiario (el titular ya lo asumió al pagar al banco).
 *
 * El modo se infiere de la tarjeta.titularidad pero se persiste explícito
 * en el documento del pago para auditoría histórica.
 */
export type ModoPagoEstadoCuentaTC = 'banco_emisor' | 'reembolso_titular';

/**
 * Aplicación de un PagoEstadoCuentaTarjeta a un CargoTarjeta específico.
 * Permite pagar varios cargos con una sola transferencia.
 */
export interface AplicacionPagoCargoTC {
  cargoId: string;
  cargoNumero: string;
  montoAplicado: number;               // En la moneda del pago
  /** Diferencial cambiario calculado (solo modo banco_emisor). */
  diferencialCambiarioPEN?: number;
}

/**
 * Pago al estado de cuenta de una tarjeta de crédito.
 *
 * En modo 'banco_emisor':
 *   - 1 movimiento de tesorería egreso (cuenta empresarial → banco emisor)
 *   - 1 crédito en CC de la tarjeta (saldo TC baja)
 *   - N actualizaciones en cargos pagados (estado, montoPagado, diferencial)
 *
 * En modo 'reembolso_titular':
 *   - 1 movimiento de tesorería egreso (cuenta empresa → titular)
 *   - 1 crédito en CC de la tarjeta (saldo TC baja)
 *   - 1 crédito en CC del titular (saldamos lo que le debemos)
 *   - N actualizaciones en cargos pagados (estado, montoPagado, sin diferencial)
 */
export interface PagoEstadoCuentaTarjeta {
  id: string;
  numeroPago: string;                  // PEC-2026-001
  tarjetaCreditoId: string;
  tarjetaCreditoNombre: string;        // Desnormalizado

  modo: ModoPagoEstadoCuentaTC;
  fecha: Timestamp;

  // Monto
  moneda: MonedaTesoreria;
  monto: number;
  tipoCambio: number;                  // TC del pago (TCPA Pool USD para banco_emisor)
  fuenteTipoCambio?: 'tcpa_pool' | 'tipocambio_service' | 'manual';

  // Cuenta origen del pago (empresa)
  cuentaOrigenId: string;
  cuentaOrigenNombre: string;          // Desnormalizado

  // Método (transferencia, yape, etc.)
  metodo: MetodoTesoreria;
  referencia?: string;
  notas?: string;

  // Aplicaciones a cargos (Σ montoAplicado === monto)
  aplicaciones: AplicacionPagoCargoTC[];

  // Para modo 'reembolso_titular': info del titular receptor
  titularEntidadId?: string;
  titularEntidadTipo?: TipoEntidadTitularTC;
  titularNombre?: string;

  // Diferencial cambiario total (solo modo banco_emisor)
  diferencialCambiarioPENTotal?: number;

  // FKs a otros documentos generados
  movimientoTesoreriaId?: string;      // El egreso de tesorería
  movimientoCCTarjetaId?: string;      // Crédito en CC de la tarjeta
  movimientoCCTitularId?: string;      // Crédito en CC del titular (solo reembolso)

  // Errores parciales (best-effort)
  errores?: string[];

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
}

/**
 * Input para pagar estado de cuenta vía TX-2.
 */
export interface PagoEstadoCuentaTarjetaInput {
  tarjetaCreditoId: string;
  /** Si no se provee, se infiere de tarjeta.titularidad. */
  modo?: ModoPagoEstadoCuentaTC;

  fecha: Date;
  moneda: MonedaTesoreria;
  monto: number;
  tipoCambio: number;
  fuenteTipoCambio?: 'tcpa_pool' | 'tipocambio_service' | 'manual';

  cuentaOrigenId: string;
  metodo: MetodoTesoreria;
  referencia?: string;
  notas?: string;

  aplicaciones: AplicacionPagoCargoTC[];

  // Idempotencia
  idempotencyKey?: string;
}

export interface PagoEstadoCuentaTarjetaResult {
  pagoId: string;
  numeroPago: string;
  movimientoTesoreriaId: string;
  movimientoCCTarjetaId: string;
  movimientoCCTitularId?: string;
  cargosActualizados: number;
  diferencialCambiarioPENTotal: number;
  errores: string[];
}
