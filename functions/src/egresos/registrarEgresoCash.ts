/**
 * registrarEgresoCash · F3 · Cloud Function · ÚNICA escritora del CASH de egreso referenciado.
 *
 * El dinero NO se mueve por el campo `autorizacion` (eso lo enforza F1/F2) sino al CREAR un doc en
 * `movimientosFinancieros` + mutar el saldo del producto financiero. F3 cierra ese money-out: el create
 * de un egreso REFERENCIADO (a gasto/OC) deja de ser escribible por el cliente (rules) y pasa por esta CF
 * (admin SDK), que en UNA transacción: relee el egreso, exige `autorizacion.estado==='aprobado'` (o ≤$1k
 * directo), valida que el pago no exceda lo aprobado, escribe el movimiento y mueve el saldo. fail-closed.
 *
 * F3a = referenciados (gasto/OC · reusa la autorización de F1/F2). F3c = sin-ref (retiro/nómina/… ·
 * autorización standalone) + envío. Ver docs/DEFENSA_EGRESOS_F3_CASH_LEDGER.md.
 */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { COLLECTIONS } from "../collections";
import { montoUSDDeGasto, requiereAutorizacionSocio } from "./autorizacionEgreso.helper";

type Code = functions.https.FunctionsErrorCode;
function err(code: Code, msg: string): functions.https.HttpsError {
  return new functions.https.HttpsError(code, msg);
}

type RefTipo = "oc" | "gasto";
type Moneda = "USD" | "PEN";

export interface RegistrarEgresoCashInput {
  refDocumentoTipo: RefTipo;
  refDocumentoId: string;
  refDocumentoNumero?: string;
  categoria: string;
  productoOrigenId: string;
  moneda: Moneda;
  monto: number;
  tipoCambio: number;
  concepto: string;
  fechaMs: number; // epoch ms (serializable sobre httpsCallable)
  metodo?: string;
  referencia?: string;
  lineaNegocioId?: string;
  notas?: string;
  idempotencyKey: string;
}

export interface RegistrarEgresoCashResult {
  movimientoId: string;
  saldoNuevo: number | null;
  idempotente?: boolean;
}

const COL_EGRESO: Record<RefTipo, string> = {
  oc: COLLECTIONS.ORDENES_COMPRA,
  gasto: COLLECTIONS.GASTOS,
};

/** Monto USD landed del egreso referenciado (recomputado · no se confía en el input). null = no resoluble. */
function montoUSDDelEgreso(tipo: RefTipo, data: admin.firestore.DocumentData): number | null {
  let m = 0;
  if (tipo === "gasto") {
    m = montoUSDDeGasto({
      moneda: data.moneda,
      montoOriginal: Number(data.montoOriginal ?? 0),
      montoPEN: Number(data.montoPEN ?? 0),
      tipoCambio: data.tipoCambio,
    });
  } else {
    m = Number(data.totalUSD ?? 0);
  }
  return m > 0 ? m : null;
}

/** numeroMovimiento (MF-YYYY-NNN) · query max+1 (fuera de la tx · el nº es cosmético). */
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

/** Core testeable · lo invocan el wrapper onCall y el test de emulador. */
export async function registrarEgresoCashCore(
  db: admin.firestore.Firestore,
  input: RegistrarEgresoCashInput,
  userId: string,
): Promise<RegistrarEgresoCashResult> {
  // — validación de forma —
  if (!(input.refDocumentoTipo in COL_EGRESO)) throw err("invalid-argument", "Tipo de egreso referenciado no válido.");
  if (!input.refDocumentoId) throw err("invalid-argument", "Falta el egreso referenciado.");
  if (!input.productoOrigenId) throw err("invalid-argument", "Falta la cuenta de origen.");
  if (!input.idempotencyKey) throw err("invalid-argument", "Falta idempotencyKey.");
  if (!(input.monto > 0)) throw err("invalid-argument", "Monto inválido.");
  if (!(input.tipoCambio > 0)) throw err("invalid-argument", "Tipo de cambio inválido.");
  if (input.moneda !== "USD" && input.moneda !== "PEN") throw err("invalid-argument", "Moneda inválida.");

  // — idempotencia (pre-tx · evita doble desembolso por reintento) —
  const dup = await db
    .collection(COLLECTIONS.MOVIMIENTOS_FINANCIEROS)
    .where("idempotencyKey", "==", input.idempotencyKey)
    .limit(1)
    .get();
  if (!dup.empty) return { movimientoId: dup.docs[0].id, saldoNuevo: null, idempotente: true };

  const fecha = admin.firestore.Timestamp.fromMillis(input.fechaMs);
  const numeroMovimiento = await generarNumeroMovimiento(db, fecha.toDate().getFullYear());

  const egresoRef = db.collection(COL_EGRESO[input.refDocumentoTipo]).doc(input.refDocumentoId);
  const productoRef = db.collection(COLLECTIONS.PRODUCTOS_FINANCIEROS).doc(input.productoOrigenId);
  const movRef = db.collection(COLLECTIONS.MOVIMIENTOS_FINANCIEROS).doc();

  return db.runTransaction(async (tx) => {
    const egresoSnap = await tx.get(egresoRef);
    if (!egresoSnap.exists) throw err("not-found", "Egreso referenciado no encontrado.");
    const egreso = egresoSnap.data() as admin.firestore.DocumentData;
    if (egreso.estado === "cancelado" || egreso.estado === "cancelada") {
      throw err("failed-precondition", "El egreso está cancelado · no se puede pagar.");
    }

    // — gate de autorización (recomputado server-side · fail-closed) —
    const montoUSD = montoUSDDelEgreso(input.refDocumentoTipo, egreso);
    if (montoUSD == null) throw err("failed-precondition", "Monto del egreso no resoluble (fail-closed).");
    if (requiereAutorizacionSocio(montoUSD) && egreso.autorizacion?.estado !== "aprobado") {
      throw err("permission-denied", "Este egreso supera el umbral y no está autorizado por socios · no se puede desembolsar.");
    }

    // — el desembolso no excede lo aprobado (D5 · suma de pagos previos en USD) —
    const pagadoUSD = Number(egreso.montoPagadoUSD ?? 0);
    const montoUSDPago = input.moneda === "USD" ? input.monto : input.monto / input.tipoCambio;
    if (pagadoUSD + montoUSDPago > montoUSD + 0.01) {
      throw err("failed-precondition", "El pago excede el monto autorizado del egreso.");
    }

    // — saldo del producto de origen (-monto · misma tx) —
    const prodSnap = await tx.get(productoRef);
    if (!prodSnap.exists) throw err("not-found", "Cuenta de origen (producto financiero) no encontrada.");
    const prod = prodSnap.data() as admin.firestore.DocumentData;
    const saldoUpdate: Record<string, unknown> = {
      saldoActualizadoEn: admin.firestore.Timestamp.now(),
      actualizadoPor: userId,
    };
    let saldoNuevo: number;
    if (prod.esBiMoneda) {
      const campo = input.moneda === "USD" ? "saldoUSD" : "saldoPEN";
      saldoNuevo = Number(prod[campo] ?? 0) - input.monto;
      saldoUpdate[campo] = saldoNuevo;
    } else {
      if (input.moneda !== prod.moneda) {
        throw err("failed-precondition", `La moneda del pago (${input.moneda}) no coincide con la cuenta (${prod.moneda}).`);
      }
      saldoNuevo = Number(prod.saldoActual ?? 0) - input.monto;
      saldoUpdate.saldoActual = saldoNuevo;
    }

    // — escribir el movimiento (ejecutado) —
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
      productoOrigenId: input.productoOrigenId,
      refDocumentoTipo: input.refDocumentoTipo,
      refDocumentoId: input.refDocumentoId,
      idempotencyKey: input.idempotencyKey,
      creadoPor: userId,
      fechaCreacion: admin.firestore.Timestamp.now(),
    };
    if (input.refDocumentoNumero) docData.refDocumentoNumero = input.refDocumentoNumero;
    if (input.metodo?.trim()) docData.metodo = input.metodo.trim();
    if (input.referencia?.trim()) docData.referencia = input.referencia.trim();
    if (input.lineaNegocioId) docData.lineaNegocioId = input.lineaNegocioId;
    if (input.notas?.trim()) docData.notas = input.notas.trim();

    tx.set(movRef, docData);
    tx.update(productoRef, saldoUpdate);
    return { movimientoId: movRef.id, saldoNuevo };
  });
}

export const registrarEgresoCash = functions.https.onCall(async (data: RegistrarEgresoCashInput, context) => {
  if (!context.auth) throw err("unauthenticated", "Debe estar autenticado.");
  return registrarEgresoCashCore(admin.firestore(), data, context.auth.uid);
});

// ════════════════════════════════════════════════════════════════════════════════
// MODO LOTE · F3a · pagoAbonoDistribuido (UN movimiento agregado cubre N egresos)
// ════════════════════════════════════════════════════════════════════════════════

/** Re-lee y valida un egreso referenciado dentro de una tx · devuelve su montoUSD (o lanza). */
async function validarEgresoEnTx(
  tx: admin.firestore.Transaction,
  db: admin.firestore.Firestore,
  tipo: RefTipo,
  id: string,
): Promise<number> {
  const snap = await tx.get(db.collection(COL_EGRESO[tipo]).doc(id));
  if (!snap.exists) throw err("not-found", `Egreso ${tipo}/${id} no encontrado.`);
  const egreso = snap.data() as admin.firestore.DocumentData;
  if (egreso.estado === "cancelado" || egreso.estado === "cancelada") {
    throw err("failed-precondition", `Egreso ${id} cancelado · no se puede pagar.`);
  }
  const montoUSD = montoUSDDelEgreso(tipo, egreso);
  if (montoUSD == null) throw err("failed-precondition", `Monto del egreso ${id} no resoluble (fail-closed).`);
  if (requiereAutorizacionSocio(montoUSD) && egreso.autorizacion?.estado !== "aprobado") {
    throw err("permission-denied", `El egreso ${id} supera el umbral y no está autorizado por socios.`);
  }
  return montoUSD;
}

export interface RegistrarEgresoCashLoteInput {
  categoria: string;
  productoOrigenId: string;
  moneda: Moneda;
  monto: number; // total del lote (lo que sale de la cuenta)
  tipoCambio: number;
  concepto: string;
  fechaMs: number;
  metodo?: string;
  referencia?: string;
  notas?: string;
  idempotencyKey: string;
  refs: { tipo: RefTipo; id: string; montoAplicadoUSD: number }[];
}

export async function registrarEgresoCashLoteCore(
  db: admin.firestore.Firestore,
  input: RegistrarEgresoCashLoteInput,
  userId: string,
): Promise<RegistrarEgresoCashResult> {
  if (!input.refs?.length) throw err("invalid-argument", "El lote no tiene egresos.");
  if (!input.productoOrigenId) throw err("invalid-argument", "Falta la cuenta de origen.");
  if (!input.idempotencyKey) throw err("invalid-argument", "Falta idempotencyKey.");
  if (!(input.monto > 0)) throw err("invalid-argument", "Monto inválido.");
  if (!(input.tipoCambio > 0)) throw err("invalid-argument", "Tipo de cambio inválido.");
  if (input.moneda !== "USD" && input.moneda !== "PEN") throw err("invalid-argument", "Moneda inválida.");

  const dup = await db.collection(COLLECTIONS.MOVIMIENTOS_FINANCIEROS).where("idempotencyKey", "==", input.idempotencyKey).limit(1).get();
  if (!dup.empty) return { movimientoId: dup.docs[0].id, saldoNuevo: null, idempotente: true };

  const fecha = admin.firestore.Timestamp.fromMillis(input.fechaMs);
  const numeroMovimiento = await generarNumeroMovimiento(db, fecha.toDate().getFullYear());
  const productoRef = db.collection(COLLECTIONS.PRODUCTOS_FINANCIEROS).doc(input.productoOrigenId);
  const movRef = db.collection(COLLECTIONS.MOVIMIENTOS_FINANCIEROS).doc();

  return db.runTransaction(async (tx) => {
    // valida CADA egreso del lote · si UNO no está aprobado, TODO el lote falla (atómico).
    for (const r of input.refs) {
      const montoUSD = await validarEgresoEnTx(tx, db, r.tipo, r.id);
      if (r.montoAplicadoUSD > montoUSD + 0.01) {
        throw err("failed-precondition", `El monto aplicado al egreso ${r.id} excede su monto autorizado.`);
      }
    }

    const prodSnap = await tx.get(productoRef);
    if (!prodSnap.exists) throw err("not-found", "Cuenta de origen no encontrada.");
    const prod = prodSnap.data() as admin.firestore.DocumentData;
    const saldoUpdate: Record<string, unknown> = { saldoActualizadoEn: admin.firestore.Timestamp.now(), actualizadoPor: userId };
    let saldoNuevo: number;
    if (prod.esBiMoneda) {
      const campo = input.moneda === "USD" ? "saldoUSD" : "saldoPEN";
      saldoNuevo = Number(prod[campo] ?? 0) - input.monto;
      saldoUpdate[campo] = saldoNuevo;
    } else {
      if (input.moneda !== prod.moneda) throw err("failed-precondition", `La moneda del pago (${input.moneda}) no coincide con la cuenta (${prod.moneda}).`);
      saldoNuevo = Number(prod.saldoActual ?? 0) - input.monto;
      saldoUpdate.saldoActual = saldoNuevo;
    }

    const montoEquivalentePEN = input.moneda === "PEN" ? input.monto : input.monto * input.tipoCambio;
    const montoEquivalenteUSD = input.moneda === "USD" ? input.monto : input.monto / input.tipoCambio;
    const docData: Record<string, unknown> = {
      numeroMovimiento, categoria: input.categoria, estado: "ejecutado",
      moneda: input.moneda, monto: input.monto, tipoCambio: input.tipoCambio, montoEquivalentePEN, montoEquivalenteUSD,
      concepto: input.concepto.trim(), fecha, productoOrigenId: input.productoOrigenId,
      idempotencyKey: input.idempotencyKey, creadoPor: userId, fechaCreacion: admin.firestore.Timestamp.now(),
      loteRefs: input.refs.map((r) => ({ tipo: r.tipo, id: r.id })),
    };
    if (input.metodo?.trim()) docData.metodo = input.metodo.trim();
    if (input.referencia?.trim()) docData.referencia = input.referencia.trim();
    if (input.notas?.trim()) docData.notas = input.notas.trim();

    tx.set(movRef, docData);
    tx.update(productoRef, saldoUpdate);
    return { movimientoId: movRef.id, saldoNuevo };
  });
}

export const registrarEgresoCashLote = functions.https.onCall(async (data: RegistrarEgresoCashLoteInput, context) => {
  if (!context.auth) throw err("unauthenticated", "Debe estar autenticado.");
  return registrarEgresoCashLoteCore(admin.firestore(), data, context.auth.uid);
});
