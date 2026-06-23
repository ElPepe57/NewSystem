/**
 * autorizarEgreso · F2 · Cloud Functions callables · ENFORCEMENT REAL de la autorización de egresos.
 *
 * La CF (admin SDK · ignora firestore.rules) es la ÚNICA escritora del campo de aprobación
 * (gastos/OC: `autorizacion` · requerimientos: `estado→aprobado`+`aprobaciones`). Las rules (F1)
 * congelan ese campo para el cliente → un actor con el SDK ya no puede forjar una aprobación.
 *
 * Modelo v3 · QUÓRUM PONDERADO POR EQUITY (ver autorizacionEgreso.helper.ts · mirror del app-side):
 *   - identidad del firmante = context.auth.uid (no spoofeable).
 *   - monto USD recomputado server-side (no se confía en un campo client-escrito) · fail-closed.
 *   - socios + % desde users(rol socio) + users/{uid}/private/datosSocio.porcentajeParticipacion.
 *   - delegado carga el % del socio que lo delegó · admin = override root · creador excluido.
 *
 * Ver docs/DEFENSA_EGRESOS_SERVER_SIDE.md.
 */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { COLLECTIONS } from "../collections";
import {
  montoUSDDeGasto,
  requiereAutorizacionSocio,
  sociosRepresentados,
  evaluarAprobacionEgreso,
  type SocioEquity,
  type FirmaEgreso,
  type DelegacionLite,
} from "./autorizacionEgreso.helper";

// Solo gasto + OC: necesitan el QUÓRUM DE EQUITY (que las rules no pueden computar). El requerimiento
// es autoridad de CARGO (permiso APROBAR_REQUERIMIENTO) y se enforza por firestore.rules · NO por la CF.
const COLECCIONES_VALIDAS: string[] = [
  COLLECTIONS.GASTOS,
  COLLECTIONS.ORDENES_COMPRA,
  COLLECTIONS.RETIROS_CAPITAL, // F3c · retiro de socio >$1k · quórum por equity (autorización standalone)
  COLLECTIONS.ENVIOS, // F3c · pago de flete >$1k · egreso referenciado (autorizacion en el doc · como gasto/OC)
];

type Code = functions.https.FunctionsErrorCode;
function err(code: Code, msg: string): functions.https.HttpsError {
  return new functions.https.HttpsError(code, msg);
}

// ── Resolver I/O (referencia · read-only · fuera de la transacción) ───────────────────
async function cargarSocios(db: admin.firestore.Firestore): Promise<SocioEquity[]> {
  const users = db.collection(COLLECTIONS.USERS);
  // Cubre el modelo nuevo (roles[]) y el legacy (role singular).
  const [porArray, porSingular] = await Promise.all([
    users.where("roles", "array-contains", "socio").get(),
    users.where("role", "==", "socio").get(),
  ]);
  const uids = new Set<string>();
  [...porArray.docs, ...porSingular.docs].forEach((d) => uids.add(d.id));
  return Promise.all(
    [...uids].map(async (uid) => {
      const datos = await users.doc(uid).collection("private").doc("datosSocio").get();
      const participacion = Number(datos.data()?.porcentajeParticipacion ?? 0);
      return { uid, participacion } as SocioEquity;
    }),
  );
}

async function cargarDelegaciones(db: admin.firestore.Firestore): Promise<DelegacionLite[]> {
  const snap = await db
    .collection(COLLECTIONS.DELEGACIONES_AUTORIZACION)
    .where("activa", "==", true)
    .get();
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      delegadoPor: x.delegadoPor,
      delegadoAUsuario: x.delegadoAUsuario,
      delegadoARol: x.delegadoARol,
      activa: x.activa,
      desde: x.desde,
      hasta: x.hasta,
    } as DelegacionLite;
  });
}

/** Monto USD landed del egreso · per-colección · recomputado · null si no se resuelve (fail-closed). */
function montoDelEgreso(coleccion: string, data: admin.firestore.DocumentData): number | null {
  let m = 0;
  if (coleccion === COLLECTIONS.GASTOS) {
    m = montoUSDDeGasto({
      moneda: data.moneda,
      montoOriginal: Number(data.montoOriginal ?? 0),
      montoPEN: Number(data.montoPEN ?? 0),
      tipoCambio: data.tipoCambio,
    });
  } else if (coleccion === COLLECTIONS.ORDENES_COMPRA) {
    m = Number(data.totalUSD ?? 0);
  } else if (coleccion === COLLECTIONS.RETIROS_CAPITAL) {
    // F3c · el retiro lleva monto/moneda/tipoCambio (no totalUSD/montoUSD) · recomputar el USD landed.
    const monto = Number(data.monto ?? 0);
    const tc = Number(data.tipoCambio ?? 0);
    m = data.moneda === "USD" ? monto : tc > 0 ? monto / tc : 0;
  } else if (coleccion === COLLECTIONS.ENVIOS) {
    // F3c · el flete del envío (costoFleteTotal) se trata como USD por convención del negocio.
    m = Number(data.costoFleteTotal ?? 0);
  } else {
    m = Number(data.montoEstimadoUSD ?? 0);
  }
  return m > 0 ? m : null;
}

function creadorDelEgreso(data: admin.firestore.DocumentData): string | undefined {
  return data.creadoPor || data.solicitadoPor || undefined;
}

function firmasActuales(coleccion: string, data: admin.firestore.DocumentData): FirmaEgreso[] {
  const raw =
    coleccion === COLLECTIONS.REQUERIMIENTOS
      ? data.aprobaciones?.firmas
      : data.autorizacion?.firmas;
  return Array.isArray(raw) ? (raw as FirmaEgreso[]) : [];
}

function yaAprobado(coleccion: string, data: admin.firestore.DocumentData): boolean {
  return coleccion === COLLECTIONS.REQUERIMIENTOS
    ? data.estado === "aprobado"
    : data.autorizacion?.estado === "aprobado";
}

function rolesDe(data: admin.firestore.DocumentData | undefined): string[] {
  if (!data) return [];
  if (Array.isArray(data.roles)) return data.roles as string[];
  return data.role ? [data.role as string] : [];
}

interface InputEgreso {
  coleccion?: unknown;
  docId?: unknown;
  motivo?: unknown;
}

function validarInput(data: InputEgreso): { coleccion: string; docId: string } {
  const coleccion = String(data?.coleccion || "");
  const docId = String(data?.docId || "");
  if (!COLECCIONES_VALIDAS.includes(coleccion)) throw err("invalid-argument", "Colección de egreso no válida.");
  if (!docId) throw err("invalid-argument", "Falta el id del egreso.");
  return { coleccion, docId };
}

// ════════════════════════════════════════════════════════════════════════════════
// autorizarEgreso · firma de socio (quórum por equity) · única escritora del campo
// ════════════════════════════════════════════════════════════════════════════════
export interface ResultadoAutorizacion {
  completa: boolean;
  equityFirmado: number;
  equityElegible: number;
  equityFaltante: number;
}

/** Core testeable (sin transporte onCall) · lo invocan el wrapper y el test de emulador. */
export async function autorizarEgresoCore(
  db: admin.firestore.Firestore,
  params: { coleccion: string; docId: string; uid: string },
): Promise<ResultadoAutorizacion> {
  const { coleccion, docId, uid } = params;

  const actorSnap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
  if (!actorSnap.exists) throw err("permission-denied", "Usuario no encontrado.");
  const roles = rolesDe(actorSnap.data());
  const esAdmin = roles.includes("admin");

  // Referencia read-only fuera de la transacción.
  const [socios, delegaciones] = await Promise.all([cargarSocios(db), cargarDelegaciones(db)]);
  const ahoraMs = Date.now();

  const ref = db.collection(coleccion).doc(docId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw err("not-found", "Egreso no encontrado.");
    const egreso = snap.data() as admin.firestore.DocumentData;

    if (egreso.estado === "cancelado" || egreso.estado === "cancelada") {
      throw err("failed-precondition", "No se puede autorizar un egreso cancelado.");
    }
    if (yaAprobado(coleccion, egreso)) throw err("failed-precondition", "Este egreso ya está autorizado.");

    // Monto recomputado server-side · fail-closed (no se confía en el cliente).
    const montoUSD = montoDelEgreso(coleccion, egreso);
    if (montoUSD == null) throw err("failed-precondition", "Monto del egreso no resoluble (fail-closed).");
    if (!requiereAutorizacionSocio(montoUSD)) {
      throw err("failed-precondition", "Este egreso no requiere autorización de socio (≤ umbral · directo por cargo).");
    }

    const creadorId = creadorDelEgreso(egreso);
    // Segregación: el creador no firma su propio egreso (admin = excepción root).
    if (creadorId && creadorId === uid && !esAdmin) {
      throw err("permission-denied", "No podés autorizar tu propio egreso · debe firmarlo otro socio.");
    }

    const representa = sociosRepresentados({ firmanteUid: uid, firmanteRoles: roles, socios, delegaciones, ahoraMs });
    if (!esAdmin && representa.length === 0) {
      throw err("permission-denied", "Solo los socios (o sus delegados vigentes) pueden autorizar egresos sobre el umbral.");
    }

    const firmas = firmasActuales(coleccion, egreso);
    if (firmas.some((f) => f.usuarioId === uid)) throw err("failed-precondition", "Ya firmaste este egreso.");

    const nuevasFirmas: FirmaEgreso[] = [
      ...firmas,
      { usuarioId: uid, representaSocios: representa, fecha: admin.firestore.Timestamp.now() },
    ];
    const evalR = evaluarAprobacionEgreso({ montoUSD, socios, creadorId, firmas: nuevasFirmas, esAdminActor: esAdmin });
    const ahora = admin.firestore.Timestamp.now();

    if (coleccion === COLLECTIONS.REQUERIMIENTOS) {
      tx.update(ref, {
        estado: evalR.completa ? "aprobado" : "pendiente_aprobacion",
        aprobaciones: { firmas: nuevasFirmas },
        ...(evalR.completa
          ? { aprobadoPor: uid, fechaAprobacion: ahora }
          : { requiereAprobacionDual: true }),
        ultimaEdicion: ahora,
        editadoPor: uid,
      });
    } else {
      const solicitadaPor = egreso.autorizacion?.solicitadaPor;
      tx.update(ref, {
        autorizacion: {
          estado: evalR.completa ? "aprobado" : "pendiente",
          firmas: nuevasFirmas,
          ...(solicitadaPor ? { solicitadaPor } : {}),
          ...(evalR.completa ? { fechaAprobacion: ahora } : {}),
        },
        ultimaEdicion: ahora,
        editadoPor: uid,
      });
    }

    return {
      completa: evalR.completa,
      equityFirmado: evalR.equityFirmado,
      equityElegible: evalR.equityElegible,
      equityFaltante: evalR.equityFaltante,
    };
  });
}

export const autorizarEgreso = functions.https.onCall(async (data: InputEgreso, context) => {
  if (!context.auth) throw err("unauthenticated", "Debe estar autenticado.");
  const { coleccion, docId } = validarInput(data);
  return autorizarEgresoCore(admin.firestore(), { coleccion, docId, uid: context.auth.uid });
});

// ════════════════════════════════════════════════════════════════════════════════
// rechazarEgreso · un socio/delegado/admin rechaza (cierra el hueco #11 · sin camino CF)
// ════════════════════════════════════════════════════════════════════════════════
export async function rechazarEgresoCore(
  db: admin.firestore.Firestore,
  params: { coleccion: string; docId: string; uid: string; motivo?: string },
): Promise<{ ok: true }> {
  const { coleccion, docId, uid, motivo } = params;

  const actorSnap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
  const roles = rolesDe(actorSnap.data());
  const esAdmin = roles.includes("admin");

  const [socios, delegaciones] = await Promise.all([cargarSocios(db), cargarDelegaciones(db)]);
  const puedeRechazar =
    esAdmin ||
    sociosRepresentados({ firmanteUid: uid, firmanteRoles: roles, socios, delegaciones, ahoraMs: Date.now() }).length > 0;
  if (!puedeRechazar) throw err("permission-denied", "Solo los socios (o sus delegados) pueden rechazar egresos.");

  const ref = db.collection(coleccion).doc(docId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw err("not-found", "Egreso no encontrado.");
    const egreso = snap.data() as admin.firestore.DocumentData;
    if (yaAprobado(coleccion, egreso)) throw err("failed-precondition", "Este egreso ya está autorizado · no se puede rechazar.");
    const ahora = admin.firestore.Timestamp.now();

    if (coleccion === COLLECTIONS.REQUERIMIENTOS) {
      // El rechazo de un requerimiento lo cancela (consistente con el flujo existente).
      tx.update(ref, {
        estado: "cancelado",
        ...(motivo ? { motivoCancelacion: motivo } : {}),
        canceladoPor: uid,
        ultimaEdicion: ahora,
        editadoPor: uid,
      });
    } else {
      const firmas = firmasActuales(coleccion, egreso);
      const solicitadaPor = egreso.autorizacion?.solicitadaPor;
      tx.update(ref, {
        autorizacion: {
          estado: "rechazado",
          firmas,
          ...(solicitadaPor ? { solicitadaPor } : {}),
          rechazadoPor: uid,
          fechaRechazo: ahora,
          ...(motivo ? { motivoRechazo: motivo } : {}),
        },
        ultimaEdicion: ahora,
        editadoPor: uid,
      });
    }
  });

  return { ok: true };
}

export const rechazarEgreso = functions.https.onCall(async (data: InputEgreso, context) => {
  if (!context.auth) throw err("unauthenticated", "Debe estar autenticado.");
  const { coleccion, docId } = validarInput(data);
  const motivo = data?.motivo ? String(data.motivo) : undefined;
  return rechazarEgresoCore(admin.firestore(), { coleccion, docId, uid: context.auth.uid, motivo });
});
