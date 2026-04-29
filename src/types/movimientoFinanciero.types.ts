/**
 * movimientoFinanciero.types.ts — ADR-PF-001 · F1
 *
 * Libro mayor unificado que reemplaza:
 *   - MovimientoTesoreria (caja, conversiones, transferencias)
 *   - CargoTarjeta (TX-1)
 *   - PagoEstadoCuentaTarjeta (TX-2)
 *   - MovimientoCC (libro de entidad — NOTA: este NO se elimina, sigue
 *     existiendo para CuentaCorriente S55, pero ya no duplica los
 *     movimientos de tesoreria)
 *
 * Decisiones aplicadas:
 *   - D-PF-3: Es la fuente de verdad para los saldos cacheados de los
 *     ProductoFinanciero
 *   - D-PF-4: Una sola coleccion `movimientosFinancieros`
 *   - P-1 (Opcion C): Campo `canalUtilizado` para BI sin productos fantasma
 *   - P-2: Conversiones absorbidas como par de movimientos vinculados por
 *     idempotencyKey
 *   - Pagos Masivos · TAREA-101: campo `loteId` para trazar movimientos
 *     que nacen de un LotePago padre
 *
 * Coexiste con MovimientoTesoreria/CargoTarjeta/PagoEstadoCuentaTarjeta
 * durante F1-F4. Se elimina la duplicacion en F5.
 */

import { Timestamp } from 'firebase/firestore';
import type { MonedaPF } from './productoFinanciero.types';

// Re-export para que el modulo no tenga que importar 2 veces
export type { MonedaPF };

// ═════════════════════════════════════════════════════════════════════════
// CATEGORIA (que tipo de movimiento es a nivel de negocio)
// ═════════════════════════════════════════════════════════════════════════

export type CategoriaMovimientoFinanciero =
  // Entradas
  | 'ingreso_venta'
  | 'ingreso_anticipo'
  | 'ingreso_otro'
  | 'aporte_capital'
  | 'reembolso_recibido'
  // Salidas
  | 'pago_orden_compra'
  | 'pago_viajero'
  | 'pago_proveedor_local'
  | 'gasto_operativo'
  | 'retiro_socio'
  | 'pago_nomina'
  | 'adelanto_empleado'
  | 'pago_estado_cuenta_tc'
  | 'reembolso_cliente'
  // Internos
  | 'transferencia_interna'
  | 'conversion_entrada'                   // par P-2
  | 'conversion_salida'                    // par P-2
  // Tarjeta credito
  | 'cargo_tc'
  // Ajustes
  | 'ajuste_positivo'
  | 'ajuste_negativo';

// ═════════════════════════════════════════════════════════════════════════
// ESTADO
// ═════════════════════════════════════════════════════════════════════════

export type EstadoMovimientoFinanciero =
  | 'pendiente'                            // Programado a fecha futura
  | 'ejecutado'                            // Aplicado a saldos
  | 'anulado';                             // Reverso o cancelacion

// ═════════════════════════════════════════════════════════════════════════
// CANAL UTILIZADO (resolucion P-1)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Permite a BI reportar "que medios prefieren los clientes" sin tener
 * que crear productos fantasma para Yape/Plin/SIP/Agora/BIM.
 * Vacio cuando aplica solo `metodo` (transferencia bancaria, efectivo).
 */
export type CanalUtilizado =
  | 'yape' | 'plin' | 'sip' | 'agora' | 'bim'
  | 'transferencia_bancaria' | 'cheque' | 'efectivo'
  | 'tarjeta_fisica' | 'pos' | 'link_pago'
  | 'paypal' | 'wise' | 'mercadopago' | 'zelle' | 'binance';

// ═════════════════════════════════════════════════════════════════════════
// REFERENCIA POLIMORFICA A DOCUMENTO
// ═════════════════════════════════════════════════════════════════════════

export type RefDocumentoTipo =
  | 'oc'
  | 'venta'
  | 'gasto'
  | 'envio'
  | 'cotizacion'
  | 'boleta'
  | 'conversion'
  | 'cargo_tc'
  | 'pago_tc'
  | 'lote_masivo'
  | 'transferencia';

// ═════════════════════════════════════════════════════════════════════════
// MOVIMIENTO FINANCIERO (entidad principal)
// ═════════════════════════════════════════════════════════════════════════

export interface MovimientoFinanciero {
  id: string;
  numeroMovimiento: string;                // MF-2026-001

  categoria: CategoriaMovimientoFinanciero;
  estado: EstadoMovimientoFinanciero;

  // ─── Productos afectados ──────────────────────────────────────────
  /**
   * Reglas:
   *   - transferencia_interna: AMBOS (origen y destino)
   *   - ingresos: solo destino
   *   - egresos: solo origen
   *   - cargo_tc: solo origen=TC
   *   - pago_estado_cuenta_tc: origen=cuenta banco, destino=TC
   *   - conversion_salida: origen (cuenta USD), conversion_entrada: destino (cuenta PEN)
   */
  productoOrigenId?: string;
  productoOrigenNombre?: string;           // Denormalizado
  productoDestinoId?: string;
  productoDestinoNombre?: string;          // Denormalizado

  // ─── Monto ─────────────────────────────────────────────────────────
  moneda: MonedaPF;
  monto: number;                           // En la moneda del campo `moneda`
  tipoCambio: number;                      // TC USD/PEN aplicado al momento
  montoEquivalentePEN: number;             // Para reporting unificado
  montoEquivalenteUSD: number;             // Para reporting unificado

  // ─── Linea de negocio ──────────────────────────────────────────────
  lineaNegocioId?: string;
  lineaNegocioNombre?: string;             // Denormalizado

  // ─── Metodo y canal ────────────────────────────────────────────────
  metodo?: string;                         // Display libre del metodo
  referencia?: string;                     // Numero de operacion bancaria, etc.
  canalUtilizado?: CanalUtilizado;         // P-1 · BI

  // ─── Documento relacionado (polimorfico) ──────────────────────────
  refDocumentoTipo?: RefDocumentoTipo;
  refDocumentoId?: string;
  refDocumentoNumero?: string;             // OC-001, VT-2026-042, etc.

  // ─── Lote padre (Pagos Masivos · TAREA-101) ───────────────────────
  /**
   * Cuando el movimiento nace de un LotePago, estos campos lo enlazan.
   * Permite filtrar el libro mayor por lote y reconstruir el batch.
   */
  loteId?: string;
  loteNumero?: string;                     // LOTE-2026-001 (denormalizado)

  // ─── Descripcion ───────────────────────────────────────────────────
  concepto: string;
  notas?: string;
  urlComprobante?: string;                 // PDF / imagen del comprobante

  // ─── Fechas ────────────────────────────────────────────────────────
  fecha: Timestamp;                        // Fecha contable del movimiento
  fechaProgramada?: Timestamp;             // Si estado='pendiente'

  // ─── Idempotencia ──────────────────────────────────────────────────
  /**
   * P-2: Conversiones se modelan como par (conversion_salida + entrada)
   * con MISMO idempotencyKey para que se pueda reconstruir.
   * Tambien se usa para evitar duplicados en sync con sistemas externos.
   */
  idempotencyKey?: string;

  // ─── Auditoria ─────────────────────────────────────────────────────
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
  anuladoPor?: string;
  fechaAnulacion?: Timestamp;
  motivoAnulacion?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// FORM DATA (para crear movimientos desde la UI)
// ═════════════════════════════════════════════════════════════════════════

export interface MovimientoFinancieroFormData {
  categoria: CategoriaMovimientoFinanciero;
  productoOrigenId?: string;
  productoDestinoId?: string;

  moneda: MonedaPF;
  monto: number;
  tipoCambio: number;

  lineaNegocioId?: string;
  metodo?: string;
  referencia?: string;
  canalUtilizado?: CanalUtilizado;

  refDocumentoTipo?: RefDocumentoTipo;
  refDocumentoId?: string;
  refDocumentoNumero?: string;

  loteId?: string;
  loteNumero?: string;

  concepto: string;
  notas?: string;
  urlComprobante?: string;

  fecha: Date;
  fechaProgramada?: Date;
  idempotencyKey?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

export const CATEGORIA_LABEL: Record<CategoriaMovimientoFinanciero, string> = {
  ingreso_venta:          'Ingreso por venta',
  ingreso_anticipo:       'Anticipo recibido',
  ingreso_otro:           'Otro ingreso',
  aporte_capital:         'Aporte de capital',
  reembolso_recibido:     'Reembolso recibido',
  pago_orden_compra:      'Pago a OC',
  pago_viajero:           'Pago a viajero',
  pago_proveedor_local:   'Pago a proveedor local',
  gasto_operativo:        'Gasto operativo',
  retiro_socio:           'Retiro de socio',
  pago_nomina:            'Pago de planilla',
  adelanto_empleado:      'Adelanto a empleado',
  pago_estado_cuenta_tc:  'Pago estado de cuenta TC',
  reembolso_cliente:      'Reembolso a cliente',
  transferencia_interna:  'Transferencia interna',
  conversion_entrada:     'Conversión (entrada)',
  conversion_salida:      'Conversión (salida)',
  cargo_tc:               'Cargo a tarjeta de crédito',
  ajuste_positivo:        'Ajuste (+)',
  ajuste_negativo:        'Ajuste (−)',
};

/**
 * Categorias que afectan UN solo producto (origen O destino, no ambos).
 */
export const CATEGORIAS_INGRESO: CategoriaMovimientoFinanciero[] = [
  'ingreso_venta',
  'ingreso_anticipo',
  'ingreso_otro',
  'aporte_capital',
  'reembolso_recibido',
  'conversion_entrada',
  'ajuste_positivo',
];

export const CATEGORIAS_EGRESO: CategoriaMovimientoFinanciero[] = [
  'pago_orden_compra',
  'pago_viajero',
  'pago_proveedor_local',
  'gasto_operativo',
  'retiro_socio',
  'pago_nomina',
  'adelanto_empleado',
  'reembolso_cliente',
  'cargo_tc',
  'conversion_salida',
  'ajuste_negativo',
];

export const CATEGORIAS_INTERNO: CategoriaMovimientoFinanciero[] = [
  'transferencia_interna',
  'pago_estado_cuenta_tc',
];

export function esIngreso(cat: CategoriaMovimientoFinanciero): boolean {
  return CATEGORIAS_INGRESO.includes(cat);
}

export function esEgreso(cat: CategoriaMovimientoFinanciero): boolean {
  return CATEGORIAS_EGRESO.includes(cat);
}

export function esInterno(cat: CategoriaMovimientoFinanciero): boolean {
  return CATEGORIAS_INTERNO.includes(cat);
}

/**
 * Calcula el delta de saldo que un movimiento aplica sobre un producto dado.
 * Positivo = entra dinero, negativo = sale, 0 = no afecta.
 */
export function deltaSaldoParaProducto(
  mov: Pick<
    MovimientoFinanciero,
    'categoria' | 'productoOrigenId' | 'productoDestinoId' | 'monto' | 'estado'
  >,
  productoId: string,
): number {
  if (mov.estado !== 'ejecutado') return 0;

  const esOrigen = mov.productoOrigenId === productoId;
  const esDestino = mov.productoDestinoId === productoId;

  if (esOrigen && esDestino) {
    // Caso patologico, no deberia pasar (un producto no se transfiere a si mismo)
    return 0;
  }
  if (esDestino) return mov.monto;
  if (esOrigen) return -mov.monto;
  return 0;
}
