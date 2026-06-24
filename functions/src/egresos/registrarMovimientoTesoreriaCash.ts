/**
 * registrarMovimientoTesoreriaCash · F3.5 Fase B · CF universal del cash del libro LEGACY de tesorería.
 *
 * Replica tesoreria.movimientos.service.registrarMovimiento (la parte de cash) con admin SDK y la mutación
 * de saldo de cuentasCaja DENTRO de una tx: crea el doc en movimientosTesoreria y aplica el delta a las
 * cuentas (origen resta · destino suma). Cubre los movimientos de tesorería NO-retiro (ingresos, aportes,
 * conversiones-leg, transferencias, egresos de caja ≤$1k). El retiro de socio sigue por su propia CF
 * (registrarRetiroCashTesoreria · con el gate de quórum).
 *
 * Por qué CF: F3.5 Fase B congela el saldo de cuentasCaja para el cliente (regla saldoIntactoCaja) → CF-only,
 * igual que se hizo con productosFinancieros en Fase A (review cf-retiro#1). El poolUSD + las estadísticas
 * NO van acá (son otro sub-ledger · se mantienen client-side post-CF · no tocan el saldo de cuentasCaja).
 *
 * Idempotencia: query pre-tx por idempotencyKey + el par de cuentas (una conversión escribe 2 movimientos
 * con la misma key · distinto par). numeroMovimiento MOV-YYYY-NNNN por contador (igual que el retiro).
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

export interface RegistrarMovimientoTesoreriaCashInput {
  tipo: string;
  moneda: Moneda;
  monto: number;
  tipoCambio: number;
  metodo: string;
  concepto: string;
  fechaMs: number;
  cuentaOrigen?: string;
  cuentaDestino?: string;
  referencia?: string;
  notas?: string;
  ordenCompraId?: string;
  ordenCompraNumero?: string;
  ventaId?: string;
  ventaNumero?: string;
  gastoId?: string;
  gastoNumero?: string;
  cotizacionId?: string;
  cotizacionNumero?: string;
  transferenciaId?: string;
  transferenciaNumero?: string;
  idempotencyKey?: string;
}

export interface RegistrarMovimientoTesoreriaCashResult {
  movimientoId: string;
  idempotente?: boolean;
}

/** El cliente NO puede crear el cash de un retiro por esta CF · va por registrarRetiroCashTesoreria (gateada). */
const TIPOS_PROHIBIDOS = ["retiro_socio"];

/** numeroMovimiento MOV-YYYY-NNNN · contador atómico (igual que registrarRetiroCashTesoreria). */
async function generarNumeroMovimiento(db: admin.firestore.Firestore, year: number): Promise<string> {
  const prefix = `MOV-${year}`;
  const ref = db.collection(COLLECTIONS.CONTADORES).doc(prefix);
  const next = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? Number(snap.data()?.current ?? 0) : 0;
    const n = current + 1;
    tx.set(ref, { current: n, updatedAt: admin.firestore.Timestamp.now() }, { merge: true });
    return n;
  });
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

/** Aplica el delta al saldo de una cuentasCaja DENTRO de la tx (réplica de actualizarSaldoCuenta + guarda moneda). */
function deltaSaldoCajaEnTx(
  tx: admin.firestore.Transaction,
  ref: admin.firestore.DocumentReference,
  cuenta: admin.firestore.DocumentData,
  delta: number,
  moneda: Moneda,
): void {
  const updates: Record<string, unknown> = { fechaActualizacion: admin.firestore.Timestamp.now() };
  if (cuenta.esBiMoneda) {
    const campo = moneda === "USD" ? "saldoUSD" : "saldoPEN";
    updates[campo] = Number(cuenta[campo] ?? 0) + delta;
  } else {
    // guarda de moneda mono (actualizarSaldoCuenta NO la tiene · la añadimos · evita mezclar monedas)
    if (moneda !== cuenta.moneda) {
      throw err("failed-precondition", `La moneda del movimiento (${moneda}) no coincide con la cuenta (${cuenta.moneda}).`);
    }
    updates.saldoActual = Number(cuenta.saldoActual ?? 0) + delta;
  }
  tx.update(ref, updates);
}

export async function registrarMovimientoTesoreriaCashCore(
  db: admin.firestore.Firestore,
  input: RegistrarMovimientoTesoreriaCashInput,
  userId: string,
): Promise<RegistrarMovimientoTesoreriaCashResult> {
  if (!input.tipo) throw err("invalid-argument", "Falta el tipo.");
  if (TIPOS_PROHIBIDOS.includes(input.tipo)) throw err("permission-denied", "El retiro de socio va por su CF (gateada).");
  if (!input.cuentaOrigen && !input.cuentaDestino) throw err("invalid-argument", "Falta la cuenta origen o destino.");
  if (!(input.monto > 0)) throw err("invalid-argument", "Monto inválido.");
  if (!(input.tipoCambio > 0)) throw err("invalid-argument", "Tipo de cambio inválido.");
  if (input.moneda !== "USD" && input.moneda !== "PEN") throw err("invalid-argument", "Moneda inválida.");
  if (!input.concepto?.trim()) throw err("invalid-argument", "Falta el concepto.");

  if (input.idempotencyKey) {
    const dup = await db.collection(COLLECTIONS.MOVIMIENTOS_TESORERIA).where("idempotencyKey", "==", input.idempotencyKey).limit(1).get();
    const ya = dup.docs.find((d) => {
      const x = d.data();
      return (x.cuentaOrigen ?? null) === (input.cuentaOrigen ?? null)
        && (x.cuentaDestino ?? null) === (input.cuentaDestino ?? null);
    });
    if (ya) return { movimientoId: ya.id, idempotente: true };
  }

  const fecha = admin.firestore.Timestamp.fromMillis(input.fechaMs);
  const numeroMovimiento = await generarNumeroMovimiento(db, new Date().getFullYear());
  const movRef = db.collection(COLLECTIONS.MOVIMIENTOS_TESORERIA).doc();
  const origenRef = input.cuentaOrigen ? db.collection(COLLECTIONS.CUENTAS_CAJA).doc(input.cuentaOrigen) : null;
  const destinoRef = input.cuentaDestino ? db.collection(COLLECTIONS.CUENTAS_CAJA).doc(input.cuentaDestino) : null;

  return db.runTransaction(async (tx) => {
    const origenSnap = origenRef ? await tx.get(origenRef) : null;
    const destinoSnap = destinoRef ? await tx.get(destinoRef) : null;
    if (origenRef && !origenSnap!.exists) throw err("not-found", "Cuenta origen no encontrada.");
    if (destinoRef && !destinoSnap!.exists) throw err("not-found", "Cuenta destino no encontrada.");

    const montoEquivalentePEN = input.moneda === "USD" ? input.monto * input.tipoCambio : input.monto;
    const montoEquivalenteUSD = input.moneda === "USD" ? input.monto : input.monto / input.tipoCambio;
    const docData: Record<string, unknown> = {
      numeroMovimiento,
      tipo: input.tipo,
      estado: "ejecutado",
      moneda: input.moneda,
      monto: input.monto,
      tipoCambio: input.tipoCambio,
      montoEquivalentePEN,
      montoEquivalenteUSD,
      metodo: input.metodo,
      concepto: input.concepto.trim(),
      fecha,
      creadoPor: userId,
      fechaCreacion: admin.firestore.Timestamp.now(),
    };
    if (input.cuentaOrigen) docData.cuentaOrigen = input.cuentaOrigen;
    if (input.cuentaDestino) docData.cuentaDestino = input.cuentaDestino;
    if (input.referencia) docData.referencia = input.referencia;
    if (input.notas) docData.notas = input.notas;
    if (input.ordenCompraId) docData.ordenCompraId = input.ordenCompraId;
    if (input.ordenCompraNumero) docData.ordenCompraNumero = input.ordenCompraNumero;
    if (input.ventaId) docData.ventaId = input.ventaId;
    if (input.ventaNumero) docData.ventaNumero = input.ventaNumero;
    if (input.gastoId) docData.gastoId = input.gastoId;
    if (input.gastoNumero) docData.gastoNumero = input.gastoNumero;
    if (input.cotizacionId) docData.cotizacionId = input.cotizacionId;
    if (input.cotizacionNumero) docData.cotizacionNumero = input.cotizacionNumero;
    if (input.transferenciaId) docData.transferenciaId = input.transferenciaId;
    if (input.transferenciaNumero) docData.transferenciaNumero = input.transferenciaNumero;
    if (input.idempotencyKey) docData.idempotencyKey = input.idempotencyKey;

    if (origenRef && origenSnap) deltaSaldoCajaEnTx(tx, origenRef, origenSnap.data()!, -input.monto, input.moneda);
    if (destinoRef && destinoSnap) deltaSaldoCajaEnTx(tx, destinoRef, destinoSnap.data()!, input.monto, input.moneda);

    tx.set(movRef, docData);
    return { movimientoId: movRef.id };
  });
}

export const registrarMovimientoTesoreriaCash = functions.https.onCall(
  async (data: RegistrarMovimientoTesoreriaCashInput, context) => {
    if (!context.auth) throw err("unauthenticated", "Debe estar autenticado.");
    await assertRolCash(admin.firestore(), context.auth.uid);
    return registrarMovimientoTesoreriaCashCore(admin.firestore(), data, context.auth.uid);
  },
);
