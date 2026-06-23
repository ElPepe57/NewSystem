/**
 * registrarRetiroCashTesoreria · F3c · Cloud Function · ÚNICA escritora del CASH de un retiro de socio.
 *
 * El retiro de socio vive en el dominio TESORERÍA legacy (NO en productosFinancieros): mueve cash al
 * CREAR un doc en `movimientosTesoreria` + restar el saldo de una `cuentasCaja`. Por eso esta CF NO puede
 * reusar registrarEgresoCash (que es del dominio productosFinancieros) · REPLICA registrarRetiroCapital
 * (src/services/tesoreria.capital.service.ts) con admin SDK.
 *
 * Gate (el corazón de F3c · sin-ref): relee el doc `retirosCapital` dentro de la tx, recomputa el USD
 * landed server-side y exige `autorizacion.estado==='aprobado'` si supera el umbral (>$1k · quórum por
 * equity de socios · lo enforza autorizarEgreso). ≤$1k pasa directo (no requiere socio). El cliente ya no
 * escribe el cash del retiro (firestore.rules bloquea el create de movimientosTesoreria tipo:'retiro_socio').
 *
 * Idempotencia doble: (1) query pre-tx por idempotencyKey=`retiro-{retiroId}` · (2) transición de estado
 * pendiente→ejecutado dentro de la tx (un retiro = un solo desembolso · la aprobación puede gatillar retry).
 * fail-closed. Ver docs/DEFENSA_EGRESOS_F3_CASH_LEDGER.md.
 */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { COLLECTIONS } from "../collections";
import { requiereAutorizacionSocio } from "./autorizacionEgreso.helper";

type Code = functions.https.FunctionsErrorCode;
function err(code: Code, msg: string): functions.https.HttpsError {
  return new functions.https.HttpsError(code, msg);
}

export interface RegistrarRetiroCashInput {
  retiroId: string;
}

export interface RegistrarRetiroCashResult {
  movimientoId: string;
  saldoNuevo: number | null;
  idempotente?: boolean;
}

/** USD landed del retiro · recomputado del doc (no se confía en un campo persistido). */
function montoUSDDelRetiro(data: admin.firestore.DocumentData): number {
  const monto = Number(data.monto ?? 0);
  const tc = Number(data.tipoCambio ?? 0);
  return data.moneda === "USD" ? monto : tc > 0 ? monto / tc : 0;
}

/**
 * numeroMovimiento MOV-YYYY-NNNN · contador atómico en `contadores/MOV-{year}` (replica
 * src/lib/sequenceGenerator.ts · NO el esquema MF-YYYY-NNN de registrarEgresoCash). Fuera de la tx
 * principal · el nº es cosmético · comparte secuencia con los movimientos de tesorería del cliente.
 */
async function generarNumeroMovimientoTesoreria(db: admin.firestore.Firestore, year: number): Promise<string> {
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

/** Core testeable · lo invocan el wrapper onCall y el test de emulador. */
export async function registrarRetiroCashCore(
  db: admin.firestore.Firestore,
  input: RegistrarRetiroCashInput,
  userId: string,
): Promise<RegistrarRetiroCashResult> {
  if (!input.retiroId) throw err("invalid-argument", "Falta el retiro.");

  // idempotencyKey determinístico · un retiro = un solo desembolso.
  const idempotencyKey = `retiro-${input.retiroId}`;

  // — idempotencia pre-tx (evita doble desembolso por reintento de la aprobación) —
  const dup = await db
    .collection(COLLECTIONS.MOVIMIENTOS_TESORERIA)
    .where("idempotencyKey", "==", idempotencyKey)
    .limit(1)
    .get();
  if (!dup.empty) return { movimientoId: dup.docs[0].id, saldoNuevo: null, idempotente: true };

  const retiroRef = db.collection(COLLECTIONS.RETIROS_CAPITAL).doc(input.retiroId);
  const movRef = db.collection(COLLECTIONS.MOVIMIENTOS_TESORERIA).doc();

  // El nº se genera antes de la tx principal (su propia tx sobre el contador · cosmético).
  const numeroMovimiento = await generarNumeroMovimientoTesoreria(db, new Date().getFullYear());

  return db.runTransaction(async (tx) => {
    const retiroSnap = await tx.get(retiroRef);
    if (!retiroSnap.exists) throw err("not-found", "Retiro no encontrado.");
    const retiro = retiroSnap.data() as admin.firestore.DocumentData;

    // — 2ª capa de idempotencia · ancla en la transición de estado —
    if (retiro.estado === "ejecutado") {
      return { movimientoId: String(retiro.movimientoId ?? ""), saldoNuevo: null, idempotente: true };
    }
    if (retiro.estado === "rechazado" || retiro.estado === "cancelado") {
      throw err("failed-precondition", "El retiro está rechazado o cancelado · no se puede ejecutar.");
    }

    // — gate de autorización (recomputado server-side · fail-closed) —
    const montoUSD = montoUSDDelRetiro(retiro);
    if (!(montoUSD > 0)) throw err("failed-precondition", "Monto del retiro no resoluble (fail-closed).");
    if (requiereAutorizacionSocio(montoUSD) && retiro.autorizacion?.estado !== "aprobado") {
      throw err("permission-denied", "El retiro supera el umbral y no está autorizado por socios · no se puede ejecutar.");
    }

    const monto = Number(retiro.monto ?? 0);
    const moneda: string = retiro.moneda;
    const tipoCambio = Number(retiro.tipoCambio ?? 0);
    if (!(monto > 0)) throw err("failed-precondition", "Monto del retiro inválido.");
    if (!(tipoCambio > 0)) throw err("failed-precondition", "Tipo de cambio del retiro inválido.");

    // — cuenta de origen (cuentasCaja · NO productoFinanciero) · saldo releído DENTRO de la tx —
    const cuentaId = String(retiro.cuentaOrigenId ?? "");
    if (!cuentaId) throw err("failed-precondition", "El retiro no tiene cuenta de origen.");
    const cuentaRef = db.collection(COLLECTIONS.CUENTAS_CAJA).doc(cuentaId);
    const cuentaSnap = await tx.get(cuentaRef);
    if (!cuentaSnap.exists) throw err("not-found", "Cuenta de origen (caja) no encontrada.");
    const cuenta = cuentaSnap.data() as admin.firestore.DocumentData;
    if (cuenta.activa === false) throw err("failed-precondition", "La cuenta de origen está inactiva.");

    const saldoUpdate: Record<string, unknown> = { fechaActualizacion: admin.firestore.Timestamp.now() };
    let saldoNuevo: number;
    if (cuenta.esBiMoneda) {
      const campo = moneda === "USD" ? "saldoUSD" : "saldoPEN";
      const disponible = Number(cuenta[campo] ?? 0);
      if (disponible < monto) throw err("failed-precondition", `Saldo insuficiente. Disponible: ${disponible} ${moneda}`);
      saldoNuevo = disponible - monto;
      saldoUpdate[campo] = saldoNuevo;
    } else {
      // guarda de moneda mono-moneda (registrarRetiroCapital/actualizarSaldoCuenta NO la tienen · la añadimos)
      if (moneda !== cuenta.moneda) {
        throw err("failed-precondition", `La moneda del retiro (${moneda}) no coincide con la cuenta (${cuenta.moneda}).`);
      }
      const disponible = Number(cuenta.saldoActual ?? 0);
      if (disponible < monto) throw err("failed-precondition", `Saldo insuficiente. Disponible: ${disponible} ${moneda}`);
      saldoNuevo = disponible - monto;
      saldoUpdate.saldoActual = saldoNuevo;
    }

    // — escribir el movimiento (shape exacta de registrarRetiroCapital · estado ejecutado) —
    const montoEquivalentePEN = moneda === "USD" ? monto * tipoCambio : monto;
    const montoEquivalenteUSD = moneda === "USD" ? monto : monto / tipoCambio;
    const docData: Record<string, unknown> = {
      numeroMovimiento,
      tipo: "retiro_socio",
      estado: "ejecutado",
      moneda,
      monto,
      tipoCambio,
      montoEquivalentePEN,
      montoEquivalenteUSD,
      concepto: retiro.concepto ?? "",
      cuentaOrigen: cuentaId,
      fecha: retiro.fecha ?? admin.firestore.Timestamp.now(),
      creadoPor: retiro.creadoPor ?? userId,
      fechaCreacion: admin.firestore.Timestamp.now(),
      socioNombre: retiro.socioNombre ?? "",
      tipoRetiro: retiro.tipoRetiro ?? "capital",
      esRetiroCapital: true,
      idempotencyKey,
      ejecutadoPor: userId,
    };
    if (retiro.metodo) docData.metodo = retiro.metodo;
    if (retiro.socioId) docData.socioId = retiro.socioId;
    if (retiro.referencia) docData.referencia = retiro.referencia;
    if (retiro.notas) docData.notas = retiro.notas;

    tx.set(movRef, docData);
    tx.update(cuentaRef, saldoUpdate);
    tx.update(retiroRef, {
      estado: "ejecutado",
      movimientoId: movRef.id,
      ejecutadoPor: userId,
      fechaEjecucion: admin.firestore.Timestamp.now(),
    });
    return { movimientoId: movRef.id, saldoNuevo };
  });
}

export const registrarRetiroCashTesoreria = functions.https.onCall(
  async (data: RegistrarRetiroCashInput, context) => {
    if (!context.auth) throw err("unauthenticated", "Debe estar autenticado.");
    return registrarRetiroCashCore(admin.firestore(), data, context.auth.uid);
  },
);
