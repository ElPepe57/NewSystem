/**
 * cuentaCorriente.helpers.ts — S55 Fase 9-pre · Cloud Functions
 *
 * Helpers para registrar movimientos en la Cuenta Corriente desde Cloud
 * Functions usando el Firebase Admin SDK (no el frontend SDK).
 *
 * Espejo simplificado de `src/services/cuentaCorriente.service.ts`. Mantiene
 * los mismos invariantes:
 *   - Operación atómica vía Firestore Transaction
 *   - CC se crea automáticamente si no existe
 *   - Movimientos inmutables (audit trail)
 *   - Saldos por moneda separados (PEN/USD)
 *   - Idempotencia opcional vía idempotencyKey
 *
 * Tipos minimalistas (no se importa el tipo del frontend para evitar
 * acoplamiento entre runtimes). El tipo "real" vive en
 * `src/types/cuentaCorriente.types.ts` — ambos deben mantenerse alineados.
 */

import * as admin from "firebase-admin";
import { COLLECTIONS } from "./collections";

const db = admin.firestore;

export type TipoEntidadCC = "cliente" | "proveedor" | "colaborador" | "empleado";

export type TipoMovimientoCC =
  // Débitos
  | "debito_oc"
  | "debito_venta"
  | "debito_envio"
  | "debito_adelanto_empleado"
  | "debito_prestamo_empleado"
  | "debito_boleta_emitida"
  | "debito_comision"
  // Créditos
  | "credito_pago_oc"
  | "credito_cobro_venta"
  | "credito_pago_envio"
  | "credito_pago_boleta"
  | "credito_descuento_adelanto"
  | "credito_reclamo"
  | "credito_descuento_comercial"
  | "credito_adelanto_cotizacion"
  | "credito_devolucion_cliente"
  // Aplicaciones / especiales
  | "aplicacion_saldo"
  | "devolucion_cash"
  | "ajuste_manual";

export type MonedaCC = "PEN" | "USD";

const TIPOS_DEBITO: TipoMovimientoCC[] = [
  "debito_oc", "debito_venta", "debito_envio",
  "debito_adelanto_empleado", "debito_prestamo_empleado",
  "debito_boleta_emitida", "debito_comision",
];

const TIPOS_CREDITO: TipoMovimientoCC[] = [
  "credito_pago_oc", "credito_cobro_venta", "credito_pago_envio",
  "credito_pago_boleta", "credito_descuento_adelanto",
  "credito_reclamo", "credito_descuento_comercial",
  "credito_adelanto_cotizacion", "credito_devolucion_cliente",
];

const TIPOS_APLICACION: TipoMovimientoCC[] = ["aplicacion_saldo", "devolucion_cash"];

function esDebito(tipo: TipoMovimientoCC): boolean {
  return TIPOS_DEBITO.includes(tipo);
}
function esCredito(tipo: TipoMovimientoCC): boolean {
  return TIPOS_CREDITO.includes(tipo) || TIPOS_APLICACION.includes(tipo);
}

/** ID determinístico de una CC. */
export function buildCuentaCorrienteId(
  entidadId: string,
  tipo: TipoEntidadCC
): string {
  return `${tipo}_${entidadId}`;
}

interface MovimientoCCInput {
  entidadId: string;
  tipo: TipoEntidadCC;
  entidadNombre: string;
  fecha?: Date;
  tipoMovimiento: TipoMovimientoCC;
  descripcion: string;
  moneda: MonedaCC;
  monto: number;
  refDocumentoTipo?: string;
  refDocumentoId?: string;
  refDocumentoNumero?: string;
  movimientoTesoreriaId?: string;
  notas?: string;
  idempotencyKey?: string;
  registradoPor?: string;
}

function calcularDelta(
  tipo: TipoMovimientoCC,
  monto: number
): number {
  if (esDebito(tipo)) return monto;
  if (esCredito(tipo)) return -monto;
  throw new Error(`Tipo de movimiento no soportado en CF: ${tipo}`);
}

function generateMovId(): string {
  return `mov_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out as T;
}

/**
 * Registra un movimiento atómico en la CC desde Cloud Functions.
 *
 * Si la CC no existe, la crea con saldos en 0 y aplica el movimiento.
 * Si se proveyó idempotencyKey, retorna el movimiento existente sin duplicar.
 *
 * NO bloqueante: el caller debe envolver en try/catch y decidir si fallar
 * la operación principal o solo loggear el error.
 */
export async function registrarMovimientoCC_CF(
  input: MovimientoCCInput
): Promise<{ movimientoId: string; saldoPEN: number; saldoUSD: number }> {
  if (!input.entidadId) throw new Error("entidadId requerido");
  if (!input.entidadNombre) throw new Error("entidadNombre requerido");
  if (input.monto <= 0) {
    throw new Error(`Monto debe ser positivo. Recibido: ${input.monto}`);
  }

  const ccId = buildCuentaCorrienteId(input.entidadId, input.tipo);
  const ccRef = db().collection(COLLECTIONS.CUENTAS_CORRIENTES).doc(ccId);
  const movId = generateMovId();
  const movRef = db().collection(COLLECTIONS.MOVIMIENTOS_CC).doc(movId);
  const now = admin.firestore.Timestamp.now();
  const fecha = input.fecha
    ? admin.firestore.Timestamp.fromDate(input.fecha)
    : now;

  return await db().runTransaction(async (tx) => {
    // Idempotencia
    if (input.idempotencyKey) {
      const existing = await db()
        .collection(COLLECTIONS.MOVIMIENTOS_CC)
        .where("cuentaCorrienteId", "==", ccId)
        .where("idempotencyKey", "==", input.idempotencyKey)
        .limit(1)
        .get();
      if (!existing.empty) {
        const data = existing.docs[0].data();
        return {
          movimientoId: existing.docs[0].id,
          saldoPEN: data.saldoPENDespues || 0,
          saldoUSD: data.saldoUSDDespues || 0,
        };
      }
    }

    // Lee/crea CC
    const ccSnap = await tx.get(ccRef);
    let saldoPEN = 0;
    let saldoUSD = 0;
    let cantidadMovimientos = 0;

    if (ccSnap.exists) {
      const ccData = ccSnap.data() as Record<string, number>;
      saldoPEN = ccData.saldoPEN || 0;
      saldoUSD = ccData.saldoUSD || 0;
      cantidadMovimientos = ccData.cantidadMovimientos || 0;
    }

    const delta = calcularDelta(input.tipoMovimiento, input.monto);
    const nuevoSaldoPEN = input.moneda === "PEN" ? saldoPEN + delta : saldoPEN;
    const nuevoSaldoUSD = input.moneda === "USD" ? saldoUSD + delta : saldoUSD;

    // Validación: aplicación no consume más del saldo
    if (TIPOS_APLICACION.includes(input.tipoMovimiento)) {
      const saldoEnMoneda = input.moneda === "PEN" ? saldoPEN : saldoUSD;
      if (saldoEnMoneda < input.monto) {
        throw new Error(
          `Saldo insuficiente en ${input.moneda}: ${saldoEnMoneda.toFixed(2)} disponible, intento aplicar ${input.monto.toFixed(2)}`
        );
      }
    }

    // Movimiento
    const mov = removeUndefined({
      cuentaCorrienteId: ccId,
      fecha,
      fechaRegistro: now,
      tipo: input.tipoMovimiento,
      descripcion: input.descripcion,
      moneda: input.moneda,
      monto: input.monto,
      refDocumentoTipo: input.refDocumentoTipo,
      refDocumentoId: input.refDocumentoId,
      refDocumentoNumero: input.refDocumentoNumero,
      movimientoTesoreriaId: input.movimientoTesoreriaId,
      saldoPENDespues: nuevoSaldoPEN,
      saldoUSDDespues: nuevoSaldoUSD,
      registradoPor: input.registradoPor || "ml-auto-processor",
      notas: input.notas,
      idempotencyKey: input.idempotencyKey,
    });
    tx.set(movRef, mov);

    // Upsert CC
    if (ccSnap.exists) {
      tx.update(ccRef, {
        saldoPEN: nuevoSaldoPEN,
        saldoUSD: nuevoSaldoUSD,
        fechaUltimoMovimiento: now,
        cantidadMovimientos: cantidadMovimientos + 1,
        entidadNombre: input.entidadNombre,
      });
    } else {
      tx.set(ccRef, {
        entidadId: input.entidadId,
        tipo: input.tipo,
        entidadNombre: input.entidadNombre,
        saldoPEN: nuevoSaldoPEN,
        saldoUSD: nuevoSaldoUSD,
        fechaCreacion: now,
        fechaUltimoMovimiento: now,
        cantidadMovimientos: 1,
      });
    }

    return {
      movimientoId: movId,
      saldoPEN: nuevoSaldoPEN,
      saldoUSD: nuevoSaldoUSD,
    };
  });
}
