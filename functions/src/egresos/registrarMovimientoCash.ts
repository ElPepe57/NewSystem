/**
 * registrarMovimientoCash · F3.5 Fase A · CF universal del cash de `movimientosFinancieros`.
 *
 * Replica registrarMovimientoFinanciero (src/services/movimientoFinanciero.service.ts) con admin SDK y la
 * mutación de saldo DENTRO de una transacción. Cubre los movimientos NO-egreso-referenciado del libro
 * canónico (ADR-PF-001): ingresos (suman saldo), conversiones/transferencias (origen resta + destino suma,
 * net-zero) y egresos sin-ref (reembolso_cliente, ajuste_negativo · restan).
 *
 * Por qué CF: F3.5 congela el saldo de productosFinancieros para el cliente (regla saldoIntacto) → el saldo
 * pasa a ser CF-only. Sin esto, bloquear el create del movimiento no alcanzaba porque el cliente mutaba el
 * saldo directo (review cf-retiro#1). Esta CF + registrarEgresoCash (egresos referenciados) + el trigger de
 * retiro son las ÚNICAS escritoras del saldo.
 *
 * Dirección del delta (igual que aplicarDeltasASaldos): productoOrigenId resta `monto` · productoDestinoId
 * suma `monto`. Al menos uno requerido. Mono-moneda valida que la moneda coincida con la del producto.
 *
 * NOTA A.2 (pendiente): los egresos sin-ref >$1k (reembolso_cliente/ajuste_negativo) NO se gatean acá todavía
 * (la aprobación de devolución/ajuste es la sub-fase A.2) · A.1 cierra el blindaje del saldo, no el gate de
 * aprobación de esos egresos (que hoy ya están ungated · no hay regresión).
 */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { COLLECTIONS } from "../collections";
import { assertRolCash } from "./registrarEgresoCash";

type Code = functions.https.FunctionsErrorCode;
function err(code: Code, msg: string): functions.https.HttpsError {
  return new functions.https.HttpsError(code, msg);
}

type Moneda = "USD" | "PEN";

export interface RegistrarMovimientoCashInput {
  categoria: string;
  productoOrigenId?: string;
  productoDestinoId?: string;
  moneda: Moneda;
  monto: number;
  tipoCambio: number;
  concepto: string;
  fechaMs: number;
  metodo?: string;
  referencia?: string;
  canalUtilizado?: string;
  lineaNegocioId?: string;
  refDocumentoTipo?: string;
  refDocumentoId?: string;
  refDocumentoNumero?: string;
  loteId?: string;
  loteNumero?: string;
  notas?: string;
  urlComprobante?: string;
  idempotencyKey?: string;
}

export interface RegistrarMovimientoCashResult {
  movimientoId: string;
  idempotente?: boolean;
}

/** numeroMovimiento (MF-YYYY-NNN) · query max+1 · igual esquema que registrarEgresoCash (mismo libro). */
async function generarNumeroMovimiento(db: admin.firestore.Firestore, year: number): Promise<string> {
  const prefix = `MF-${year}-`;
  const snap = await db
    .collection(COLLECTIONS.MOVIMIENTOS_FINANCIEROS)
    .where("numeroMovimiento", ">=", prefix)
    .where("numeroMovimiento", "<", `MF-${year + 1}-`)
    .orderBy("numeroMovimiento", "desc")
    .limit(1)
    .get();
  let next = 1;
  if (!snap.empty) {
    const m = String(snap.docs[0].data().numeroMovimiento || "").match(/^MF-\d{4}-(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(next).padStart(3, "0")}`;
}

/** Aplica el delta al saldo de un producto DENTRO de la tx (réplica de aplicarDeltaSaldo · biMoneda/mono). */
function deltaSaldoEnTx(
  tx: admin.firestore.Transaction,
  prodRef: admin.firestore.DocumentReference,
  prod: admin.firestore.DocumentData,
  delta: number,
  moneda: Moneda,
  userId: string,
): void {
  const updates: Record<string, unknown> = {
    saldoActualizadoEn: admin.firestore.Timestamp.now(),
    actualizadoPor: userId,
  };
  if (prod.esBiMoneda) {
    const campo = moneda === "USD" ? "saldoUSD" : "saldoPEN";
    updates[campo] = Number(prod[campo] ?? 0) + delta;
  } else {
    if (moneda !== prod.moneda) {
      throw err("failed-precondition", `La moneda del movimiento (${moneda}) no coincide con la del producto (${prod.moneda}).`);
    }
    updates.saldoActual = Number(prod.saldoActual ?? 0) + delta;
  }
  tx.update(prodRef, updates);
}

export async function registrarMovimientoCashCore(
  db: admin.firestore.Firestore,
  input: RegistrarMovimientoCashInput,
  userId: string,
): Promise<RegistrarMovimientoCashResult> {
  // — validación de forma —
  if (!input.categoria) throw err("invalid-argument", "Falta la categoría.");
  if (!input.productoOrigenId && !input.productoDestinoId) throw err("invalid-argument", "Falta el producto origen o destino.");
  if (!(input.monto > 0)) throw err("invalid-argument", "Monto inválido.");
  if (!(input.tipoCambio > 0)) throw err("invalid-argument", "Tipo de cambio inválido.");
  if (input.moneda !== "USD" && input.moneda !== "PEN") throw err("invalid-argument", "Moneda inválida.");
  if (!input.concepto?.trim()) throw err("invalid-argument", "Falta el concepto.");

  // — idempotencia (par de conversiones comparte clave · query pre-tx) —
  if (input.idempotencyKey) {
    const dup = await db
      .collection(COLLECTIONS.MOVIMIENTOS_FINANCIEROS)
      .where("idempotencyKey", "==", input.idempotencyKey)
      .limit(1)
      .get();
    // Una conversión escribe 2 movimientos con la MISMA key (salida + entrada). La idempotencia debe
    // distinguir por la PATA (origen vs destino) para no colapsar el par · se incluye el lado en la clave
    // efectiva sólo cuando hay ambos productos en llamadas separadas. Acá: si ya existe un movimiento con
    // esta key Y el mismo par de productos, es un retry → idempotente.
    const ya = dup.docs.find((d) => {
      const x = d.data();
      return (x.productoOrigenId ?? null) === (input.productoOrigenId ?? null)
        && (x.productoDestinoId ?? null) === (input.productoDestinoId ?? null);
    });
    if (ya) return { movimientoId: ya.id, idempotente: true };
  }

  const fecha = admin.firestore.Timestamp.fromMillis(input.fechaMs);
  const numeroMovimiento = await generarNumeroMovimiento(db, fecha.toDate().getFullYear());
  const movRef = db.collection(COLLECTIONS.MOVIMIENTOS_FINANCIEROS).doc();
  const origenRef = input.productoOrigenId ? db.collection(COLLECTIONS.PRODUCTOS_FINANCIEROS).doc(input.productoOrigenId) : null;
  const destinoRef = input.productoDestinoId ? db.collection(COLLECTIONS.PRODUCTOS_FINANCIEROS).doc(input.productoDestinoId) : null;

  return db.runTransaction(async (tx) => {
    // leer productos afectados DENTRO de la tx
    const origenSnap = origenRef ? await tx.get(origenRef) : null;
    const destinoSnap = destinoRef ? await tx.get(destinoRef) : null;
    if (origenRef && !origenSnap!.exists) throw err("not-found", "Producto origen no encontrado.");
    if (destinoRef && !destinoSnap!.exists) throw err("not-found", "Producto destino no encontrado.");

    const montoEquivalentePEN = input.moneda === "PEN" ? input.monto : input.monto * input.tipoCambio;
    const montoEquivalenteUSD = input.moneda === "USD" ? input.monto : input.monto / input.tipoCambio;
    const docData: Record<string, unknown> = {
      numeroMovimiento,
      categoria: input.categoria,
      estado: "ejecutado",
      moneda: input.moneda,
      monto: input.monto,
      tipoCambio: input.tipoCambio,
      montoEquivalentePEN,
      montoEquivalenteUSD,
      concepto: input.concepto.trim(),
      fecha,
      creadoPor: userId,
      fechaCreacion: admin.firestore.Timestamp.now(),
    };
    if (input.productoOrigenId) docData.productoOrigenId = input.productoOrigenId;
    if (input.productoDestinoId) docData.productoDestinoId = input.productoDestinoId;
    if (input.lineaNegocioId) docData.lineaNegocioId = input.lineaNegocioId;
    if (input.metodo?.trim()) docData.metodo = input.metodo.trim();
    if (input.referencia?.trim()) docData.referencia = input.referencia.trim();
    if (input.canalUtilizado) docData.canalUtilizado = input.canalUtilizado;
    if (input.refDocumentoTipo) docData.refDocumentoTipo = input.refDocumentoTipo;
    if (input.refDocumentoId) docData.refDocumentoId = input.refDocumentoId;
    if (input.refDocumentoNumero) docData.refDocumentoNumero = input.refDocumentoNumero;
    if (input.loteId) docData.loteId = input.loteId;
    if (input.loteNumero) docData.loteNumero = input.loteNumero;
    if (input.notas?.trim()) docData.notas = input.notas.trim();
    if (input.urlComprobante?.trim()) docData.urlComprobante = input.urlComprobante.trim();
    if (input.idempotencyKey) docData.idempotencyKey = input.idempotencyKey;

    // mutar saldos: origen resta, destino suma (igual que aplicarDeltasASaldos)
    if (origenRef && origenSnap) deltaSaldoEnTx(tx, origenRef, origenSnap.data()!, -input.monto, input.moneda, userId);
    if (destinoRef && destinoSnap) deltaSaldoEnTx(tx, destinoRef, destinoSnap.data()!, input.monto, input.moneda, userId);

    tx.set(movRef, docData);
    return { movimientoId: movRef.id };
  });
}

export const registrarMovimientoCash = functions.https.onCall(
  async (data: RegistrarMovimientoCashInput, context) => {
    if (!context.auth) throw err("unauthenticated", "Debe estar autenticado.");
    await assertRolCash(admin.firestore(), context.auth.uid);
    return registrarMovimientoCashCore(admin.firestore(), data, context.auth.uid);
  },
);
