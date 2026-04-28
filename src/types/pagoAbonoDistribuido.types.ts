/**
 * pagoAbonoDistribuido.types.ts — S58b Fase 1
 *
 * Tipos para "1 desembolso → N deudas" del Hub Finanzas.
 * Caso canónico: pagas US$ 12,000 al proveedor X que tiene 5 OCs vencidas;
 * el sistema distribuye el abono entre las OCs (auto o manual) y deja
 * trazabilidad atómica.
 *
 * Distinto del módulo "Pagos masivos" actual (TAREA-101), que hace N pagos
 * individuales agrupados. Este es 1 sola transferencia bancaria distribuida.
 *
 * Ver docs/mockups/pago-abono-distribuido-s58.html y
 * docs/mockups/arquitectura-finanzas-s58.md sección 3.
 */

import { Timestamp } from 'firebase/firestore';
import type { TipoEntidadCC } from './cuentaCorriente.types';
import type { MetodoTesoreria, MonedaTesoreria } from './tesoreria.types';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS DE DOCUMENTO DISTRIBUIBLE
// ═════════════════════════════════════════════════════════════════════════

/**
 * Tipos de documento que pueden recibir un abono distribuido.
 *
 * Versión inicial soporta solo 'oc'. Los demás se agregan progresivamente
 * (envío en S58b F4, gasto en S58b F5, etc.).
 */
export type TipoDocumentoDistribuible = 'oc' | 'envio' | 'gasto' | 'boleta';

/**
 * Una deuda específica que el sistema sabe pagar parcialmente.
 * Se construye a partir de la colección original (OCs, envíos, etc.)
 * filtrando por entidad + estado de pago.
 */
export interface DeudaDistribuible {
  tipo: TipoDocumentoDistribuible;
  documentoId: string;
  documentoNumero: string;

  /** Fecha de creación del documento (para ordenar por antigüedad). */
  fechaCreacion: Timestamp;

  /** Fecha de vencimiento si aplica (ej: condiciones de crédito). */
  fechaVencimiento?: Timestamp;

  /** Monto total del documento (sin descontar pagos). */
  montoTotal: number;

  /** Monto ya pagado (suma de pagos previos). */
  montoPagado: number;

  /** Saldo pendiente · = montoTotal − montoPagado. */
  montoPendiente: number;

  /** Moneda del documento. */
  moneda: MonedaTesoreria;

  /** Días de vencimiento. Negativo = vencido. */
  diasVencimiento?: number;

  /** True si está vencido. */
  estaVencido: boolean;
}

// ═════════════════════════════════════════════════════════════════════════
// INPUT / RESULT
// ═════════════════════════════════════════════════════════════════════════

/**
 * Entrada del wizard "Pago con abono distribuido".
 */
export interface PagoAbonoDistribuidoInput {
  // ── Identidad ──
  entidadId: string;
  entidadTipo: TipoEntidadCC;
  entidadNombre: string;

  // ── Abono ──
  /** Monto total del abono (1 sola transferencia bancaria). */
  montoAbono: number;
  monedaAbono: MonedaTesoreria;
  /** TC del día (default desde tipoCambio.service). */
  tipoCambio: number;

  /** Fecha del abono. Default: hoy. */
  fecha: Date;

  /** Cuenta desde la que sale el dinero (si entidadTipo='cliente', es destino). */
  cuentaId: string;
  cuentaNombre: string;
  metodo: MetodoTesoreria;
  referencia?: string;
  notas?: string;

  // ── Distribución ──
  /**
   * Lista de documentos a los que aplicar el abono.
   * Σ(montoAplicado) DEBE ser igual a montoAbono (validación).
   */
  distribucion: DistribucionItem[];

  // ── Idempotencia ──
  /** Si se reintenta, evitar duplicados. Default: generado del input. */
  idempotencyKey?: string;
}

export interface DistribucionItem {
  tipo: TipoDocumentoDistribuible;
  documentoId: string;
  documentoNumero: string;
  /** Monto aplicado a este documento. ≤ montoPendiente del documento. */
  montoAplicado: number;
}

/**
 * Resultado de la ejecución de un pago distribuido.
 */
export interface PagoAbonoDistribuidoResult {
  /** ID del movimiento de tesorería único (1 egreso/ingreso). */
  movimientoTesoreriaId: string;

  /** IDs de los movimientos CC créditos generados (uno por documento). */
  movimientosCCIds: string[];

  /** Cuántos documentos quedaron actualizados (estadoPago, montoPendiente). */
  documentosActualizados: number;

  /**
   * Si Σ(montoAplicado) < montoAbono → diferencia queda como saldo a favor
   * en CC. Default: 0 (validación lo previene).
   */
  saldoAFavor: number;

  /** Idempotency key efectivamente usada. */
  idempotencyKey: string;

  /** Errores parciales (si algunos pasos fallaron pero el TX tesorería sí). */
  errores: string[];
}

// ═════════════════════════════════════════════════════════════════════════
// FILTROS
// ═════════════════════════════════════════════════════════════════════════

export interface DeudasFiltro {
  entidadId: string;
  entidadTipo: TipoEntidadCC;
  /** Solo documentos vencidos. */
  soloVencidos?: boolean;
  /** Tipos de documento a incluir. Default: ['oc']. */
  tipos?: TipoDocumentoDistribuible[];
  /** Moneda a filtrar. Si omitido, todas. */
  moneda?: MonedaTesoreria;
}

// ═════════════════════════════════════════════════════════════════════════
// ESTRATEGIAS DE AUTO-DISTRIBUCIÓN
// ═════════════════════════════════════════════════════════════════════════

export type EstrategiaDistribucion =
  | 'antiguas_primero' // Pagar las más antiguas hasta agotar el abono
  | 'solo_vencidas' // Pagar solo las vencidas (en orden de antigüedad)
  | 'mayor_monto' // Pagar las de mayor monto pendiente primero
  | 'manual'; // Usuario distribuye manualmente

/**
 * Aplica una estrategia automática de distribución sobre una lista de deudas.
 * Retorna la distribución sugerida (no modifica nada).
 *
 * Si montoAbono > Σ(deudas.montoPendiente), lo que sobra queda sin asignar
 * (caller debe decidir si lo aplica como saldo a favor o reduce el abono).
 */
export function autoDistribuir(
  deudas: DeudaDistribuible[],
  montoAbono: number,
  estrategia: EstrategiaDistribucion,
): DistribucionItem[] {
  if (estrategia === 'manual') return [];

  // Filtrar y ordenar según estrategia
  let candidatas = [...deudas];
  if (estrategia === 'solo_vencidas') {
    candidatas = candidatas.filter((d) => d.estaVencido);
  }
  if (estrategia === 'antiguas_primero' || estrategia === 'solo_vencidas') {
    candidatas.sort(
      (a, b) => a.fechaCreacion.toMillis() - b.fechaCreacion.toMillis(),
    );
  } else if (estrategia === 'mayor_monto') {
    candidatas.sort((a, b) => b.montoPendiente - a.montoPendiente);
  }

  // Aplicar abono cubriendo las primeras candidatas
  const distribucion: DistribucionItem[] = [];
  let restante = montoAbono;
  for (const d of candidatas) {
    if (restante <= 0.01) break;
    const aplicar = Math.min(restante, d.montoPendiente);
    if (aplicar > 0.01) {
      distribucion.push({
        tipo: d.tipo,
        documentoId: d.documentoId,
        documentoNumero: d.documentoNumero,
        montoAplicado: aplicar,
      });
      restante -= aplicar;
    }
  }
  return distribucion;
}
