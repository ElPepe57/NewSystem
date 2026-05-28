// src/services/solicitudesAccesoExterno.service.ts
// chk5.PERSONAS-v5.9 · Service para self-service de acceso de externos (2026-05-28)
//
// Encapsula la lógica del lado cliente para:
//   - Crear solicitud desde página pública /solicitar-acceso (client-side base · CF
//     completa con IP/UA/reCAPTCHA score)
//   - Listar bandeja del admin (pendientes / info_solicitada / históricas)
//   - Marcar info_solicitada · enviar pregunta al solicitante
//   - Las acciones "aprobar" y "rechazar" finales VAN POR CLOUD FUNCTION
//     porque crean User + Relacion + Invitacion atómicamente con admin SDK.
//
// IMPORTANTE: este service NO crea UserProfile directamente. Solo manipula
// solicitudesAccesoExterno/{id}. La transición a User real está en la CF
// aprobarSolicitudAcceso (a implementar en Etapa 9 del plan).

import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type {
  SolicitudAccesoExterno,
  CrearSolicitudAccesoInput,
  EstadoSolicitudAcceso,
  HistorialEstadoSolicitud,
  PedirInfoSolicitudInput,
  RechazarSolicitudInput,
} from '../types/solicitudAccesoExterno.types';
import { MOTIVO_MIN_CHARS } from '../types/solicitudAccesoExterno.types';

const COL = COLLECTIONS.SOLICITUDES_ACCESO_EXTERNO;

// ═════════════════════════════════════════════════════════════════════════
// READ · queries para bandeja admin
// ═════════════════════════════════════════════════════════════════════════

/**
 * Lista solicitudes en estados procesables (pendiente + info_solicitada).
 * Ordenadas por fechaCreacion desc · más recientes primero.
 * Usado para el badge "🔔 N solicitudes" + bandeja en /usuarios.
 */
async function listPendientes(): Promise<SolicitudAccesoExterno[]> {
  const q = query(
    collection(db, COL),
    where('estado', 'in', ['pendiente', 'info_solicitada']),
    orderBy('fechaCreacion', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as SolicitudAccesoExterno);
}

/**
 * Cuenta rápida de solicitudes pendientes · usado para badge en sidebar/tabs
 * sin tener que cargar todo el data.
 */
async function countPendientes(): Promise<number> {
  const q = query(
    collection(db, COL),
    where('estado', 'in', ['pendiente', 'info_solicitada']),
  );
  const snap = await getDocs(q);
  return snap.size;
}

/**
 * Lista TODAS las solicitudes (incluso finales) · usado para histórico/auditoría.
 */
async function listAll(maxResults: number = 100): Promise<SolicitudAccesoExterno[]> {
  const q = query(
    collection(db, COL),
    orderBy('fechaCreacion', 'desc'),
  );
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }) as SolicitudAccesoExterno);
  return all.slice(0, maxResults);
}

async function getById(id: string): Promise<SolicitudAccesoExterno | null> {
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as SolicitudAccesoExterno;
}

/**
 * Chequea si ya existe una solicitud pendiente con el mismo email.
 * Anti-duplicado · evitar que el mismo externo cree N solicitudes spam.
 */
async function existeSolicitudPendienteParaEmail(email: string): Promise<boolean> {
  const q = query(
    collection(db, COL),
    where('email', '==', email.toLowerCase()),
    where('estado', 'in', ['pendiente', 'info_solicitada']),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// ═════════════════════════════════════════════════════════════════════════
// WRITE · página pública /solicitar-acceso
// ═════════════════════════════════════════════════════════════════════════

/**
 * Crea una solicitud desde la página pública.
 *
 * NOTA SOBRE ARQUITECTURA:
 *   - En producción, esto DEBE ir por Cloud Function que:
 *     1. Valida reCAPTCHA token server-side
 *     2. Aplica rate limit por IP
 *     3. Captura IP/UA del request
 *     4. Crea el doc atómicamente
 *     5. Dispara email "Solicitud recibida" vía Resend
 *
 *   - Este método es la base client-side que llama a la CF. En E9 se cablea
 *     a la CF real. Por ahora es un stub que sabe escribir el doc si las
 *     rules lo permiten (allow create público con validaciones · ver firestore.rules).
 */
async function crearSolicitud(
  input: CrearSolicitudAccesoInput,
  metaTracking: { ipAddress: string; userAgent: string; reCaptchaScore: number },
): Promise<string> {
  // Validaciones cliente · server las re-valida
  if (!input.email || !input.email.includes('@')) {
    throw new Error('Email inválido');
  }
  if (!input.nombreCompleto || input.nombreCompleto.trim().length < 3) {
    throw new Error('Nombre completo requerido (mín 3 caracteres)');
  }
  if (!input.motivo || input.motivo.trim().length < MOTIVO_MIN_CHARS) {
    throw new Error(`Motivo muy corto · mínimo ${MOTIVO_MIN_CHARS} caracteres`);
  }

  // Anti-duplicado pendiente
  const existe = await existeSolicitudPendienteParaEmail(input.email);
  if (existe) {
    throw new Error(
      'Ya existe una solicitud pendiente con este email. Revisá tu bandeja o esperá la respuesta del equipo.',
    );
  }

  const ahora = serverTimestamp() as Timestamp;

  const historialInicial: HistorialEstadoSolicitud[] = [
    {
      estado: 'pendiente',
      fecha: ahora,
      nota: 'Solicitud creada desde portal público',
    },
  ];

  const docData: Omit<SolicitudAccesoExterno, 'id'> = {
    fechaCreacion: ahora,
    estado: 'pendiente',
    nombreCompleto: input.nombreCompleto.trim(),
    email: input.email.toLowerCase().trim(),
    telefono: input.telefono,
    tipoRelacion: input.tipoRelacion,
    entidadMaestroRefSugerida: input.entidadMaestroRefSugerida,
    cargoEnEntidad: input.cargoEnEntidad,
    motivo: input.motivo.trim(),
    recomendadoPor: input.recomendadoPor,
    ipAddress: metaTracking.ipAddress,
    userAgent: metaTracking.userAgent,
    reCaptchaScore: metaTracking.reCaptchaScore,
    historialEstados: historialInicial,
    ciclosInfoSolicitada: 0,
  };

  const ref = await addDoc(collection(db, COL), removeUndefined(docData));
  return ref.id;
}

// ═════════════════════════════════════════════════════════════════════════
// WRITE · acciones del admin (que NO crean User · esas van por CF)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Admin marca la solicitud como "info_solicitada" · envía pregunta al solicitante.
 * El email lo dispara una CF asociada (no este service).
 *
 * Bloqueado si la solicitud ya está en estado final.
 */
async function pedirInfo(
  input: PedirInfoSolicitudInput,
  porUid: string,
): Promise<void> {
  const sol = await getById(input.solicitudId);
  if (!sol) throw new Error(`Solicitud ${input.solicitudId} no existe`);
  if (sol.estado === 'aprobada' || sol.estado === 'rechazada' || sol.estado === 'caducada') {
    throw new Error(`Solicitud en estado final (${sol.estado}) · no se puede modificar`);
  }

  const nuevoCiclo = sol.ciclosInfoSolicitada + 1;
  // Anti-spam: si superó el max, auto-rechazar
  // (en producción · una CF debería decidir esto · acá lo dejamos al admin)

  const evento: HistorialEstadoSolicitud = {
    estado: 'info_solicitada',
    fecha: serverTimestamp() as Timestamp,
    porUid,
    nota: input.preguntaAlSolicitante,
  };

  await updateDoc(doc(db, COL, input.solicitudId), {
    estado: 'info_solicitada' as EstadoSolicitudAcceso,
    procesadaPor: porUid,
    fechaProcesamiento: serverTimestamp(),
    motivoDecision: input.preguntaAlSolicitante,
    ciclosInfoSolicitada: nuevoCiclo,
    historialEstados: arrayUnion(evento),
  });
}

/**
 * Admin rechaza la solicitud · estado='rechazada' · email al solicitante.
 *
 * IMPORTANTE: rechazar es DEFINITIVO · si el externo quiere volver a solicitar,
 * tiene que crear una nueva solicitud (no se reabre la antigua).
 */
async function rechazar(
  input: RechazarSolicitudInput,
  porUid: string,
): Promise<void> {
  const sol = await getById(input.solicitudId);
  if (!sol) throw new Error(`Solicitud ${input.solicitudId} no existe`);
  if (sol.estado === 'aprobada' || sol.estado === 'rechazada' || sol.estado === 'caducada') {
    throw new Error(`Solicitud en estado final (${sol.estado}) · no se puede rechazar`);
  }
  if (!input.motivoDecision || input.motivoDecision.trim().length < 10) {
    throw new Error('El motivo del rechazo es obligatorio (mín 10 caracteres)');
  }

  const evento: HistorialEstadoSolicitud = {
    estado: 'rechazada',
    fecha: serverTimestamp() as Timestamp,
    porUid,
    nota: input.motivoDecision.trim(),
  };

  await updateDoc(doc(db, COL, input.solicitudId), {
    estado: 'rechazada' as EstadoSolicitudAcceso,
    procesadaPor: porUid,
    fechaProcesamiento: serverTimestamp(),
    motivoDecision: input.motivoDecision.trim(),
    historialEstados: arrayUnion(evento),
  });
}

/**
 * Marca una solicitud como caducada (solo lo hace cron job · sin uid).
 * No es invocado por admins · existe como helper testeable.
 */
async function marcarCaducada(solicitudId: string): Promise<void> {
  const evento: HistorialEstadoSolicitud = {
    estado: 'caducada',
    fecha: serverTimestamp() as Timestamp,
    nota: 'Auto-caducada · sin procesamiento en plazo',
  };
  await updateDoc(doc(db, COL, solicitudId), {
    estado: 'caducada' as EstadoSolicitudAcceso,
    historialEstados: arrayUnion(evento),
  });
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS internos
// ═════════════════════════════════════════════════════════════════════════

function removeUndefined<T extends DocumentData>(obj: T): Partial<T> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) clean[key] = value;
  }
  return clean as Partial<T>;
}

// ═════════════════════════════════════════════════════════════════════════
// EXPORT · namespace pattern
// ═════════════════════════════════════════════════════════════════════════

export const solicitudesAccesoExternoService = {
  // Read
  listPendientes,
  countPendientes,
  listAll,
  getById,
  existeSolicitudPendienteParaEmail,

  // Write · página pública
  crearSolicitud,

  // Write · acciones del admin (NO crean User · esas van por CF)
  pedirInfo,
  rechazar,
  marcarCaducada,

  // NOTA · aprobarSolicitud NO está acá · está en CF para crear User + Relacion + Invitacion atómicamente
};
