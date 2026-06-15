// src/services/relacionesLaborales.service.ts
// chk5.PERSONAS-v5.6/v5.8 · Service CRUD para relaciones laborales (2026-05-28)
//
// Encapsula TODA la lógica de RelacionLaboral: crear · listar · finalizar ·
// reclasificar (atomic) · pausar/reanudar · query por Maestro (contactos).
//
// USO desde componentes UI:
//   import { relacionesLaboralesService } from '@/services/relacionesLaborales.service';
//   const relaciones = await relacionesLaboralesService.listByUser(uid);
//
// PRINCIPIO: el doc es INMUTABLE una vez finalizada. Sólo se permite editar
// mientras estado === 'vigente' | 'pausada' | 'prueba'. Finalizar dispara
// snapshot inmutable + audit.

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
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';
import { userService } from './user.service';
import { datosSocioService } from './datosSocio.service';
import type {
  RelacionLaboral,
  CrearRelacionInput,
  FinalizarRelacionInput,
  ReclasificarRelacionInput,
  EntidadMaestroRef,
  TipoEntidadMaestro,
  TipoRelacion,
  EstadoRelacion,
  DatosLaboralesSnapshot,
  DatosSocioSnapshot,
  DatosExternoSnapshot,
} from '../types/relacionLaboral.types';

const COL = COLLECTIONS.RELACIONES_LABORALES;

// ═════════════════════════════════════════════════════════════════════════
// READ · queries
// ═════════════════════════════════════════════════════════════════════════

/**
 * Lista todas las relaciones de un usuario (vigentes + históricas).
 * Ordenadas por fechaInicio descendente · más recientes primero.
 */
async function listByUser(userId: string): Promise<RelacionLaboral[]> {
  const q = query(
    collection(db, COL),
    where('userId', '==', userId),
    orderBy('fechaInicio', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as RelacionLaboral);
}

/**
 * Lista solo las relaciones vigentes (NO finalizadas) de un usuario.
 * Útil para "qué hace esta persona HOY en el negocio".
 */
async function listVigentesByUser(userId: string): Promise<RelacionLaboral[]> {
  const q = query(
    collection(db, COL),
    where('userId', '==', userId),
    where('estado', 'in', ['vigente', 'pausada', 'prueba']),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as RelacionLaboral);
}

/**
 * v5.8 · Lista los Users que están vinculados como contactos de un Maestro.
 * Usado en la sub-sección "Contactos" del detalle de un proveedor/cliente/marca.
 *
 * Ejemplo:
 *   getContactosByMaestro('proveedor', 'skinLabsId')
 *   → [{ userId, tipo: 'externo', subTipo: 'contacto_proveedor', ... }]
 */
async function getContactosByMaestro(
  tipoMaestro: TipoEntidadMaestro,
  maestroId: string,
): Promise<RelacionLaboral[]> {
  const q = query(
    collection(db, COL),
    where('entidadMaestroRef.tipo', '==', tipoMaestro),
    where('entidadMaestroRef.id', '==', maestroId),
    where('estado', 'in', ['vigente', 'pausada', 'prueba']),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as RelacionLaboral);
}

async function getById(relacionId: string): Promise<RelacionLaboral | null> {
  const ref = doc(db, COL, relacionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as RelacionLaboral;
}

// ═════════════════════════════════════════════════════════════════════════
// SYNC ROL ↔ RELACIÓN · chk5.PERSONAS-F1 (2026-06-08)
// Materializa el rol del UserProfile a partir de sus relaciones vigentes.
// Por ahora SOLO 'socio' (único TipoRelacion con un UserRole homónimo).
// ═════════════════════════════════════════════════════════════════════════

/**
 * Sincroniza el rol 'socio' del UserProfile con sus relaciones laborales vigentes.
 * Idempotente · se invoca tras create/finalizar/reclasificar de relaciones socio.
 *
 *  - Tiene relación 'socio' vigente y le falta el rol → lo AGREGA.
 *  - No tiene relación 'socio' vigente y le sobra el rol → lo QUITA, salvo el
 *    guard de coexistencia: si el user todavía tiene `datosSocio` (modelo viejo
 *    aún vivo), conserva el rol (su condición de socio viene de ahí). El "quitar"
 *    pleno se habilita en la Fase 3, cuando RelacionLaboral sea la única fuente.
 *
 * No relanza · si el sync falla, loguea y NO bloquea la operación de relación.
 */
async function sincronizarRolSocio(userId: string): Promise<void> {
  try {
    const vigentes = await listVigentesByUser(userId);
    const tieneSocioVigente = vigentes.some((r) => r.tipo === 'socio');
    if (tieneSocioVigente) {
      await userService.agregarRol(userId, 'socio');
      return;
    }
    // No hay relación socio vigente · guard de coexistencia con el modelo viejo
    const datos = await datosSocioService.get(userId).catch(() => null);
    if (!datos) {
      await userService.quitarRol(userId, 'socio');
    }
    // else: socio del modelo viejo (datosSocio) · conserva el rol hasta la Fase 3.
  } catch (error) {
    logger.warn(`[relacionesLaborales] sync rol socio falló para ${userId} (no bloquea):`, error);
  }
}

// ═════════════════════════════════════════════════════════════════════════
// WRITE · create
// ═════════════════════════════════════════════════════════════════════════

/**
 * Crea una nueva relación.
 * Si se incluye entidadMaestroRef (v5.8), se enriquece con fechaVinculacion + vinculadoPor.
 */
async function create(input: CrearRelacionInput, creadoPor: string): Promise<string> {
  const now = serverTimestamp() as Timestamp;

  const docData: Omit<RelacionLaboral, 'id'> = {
    userId: input.userId,
    tipo: input.tipo,
    subTipo: input.subTipo,
    estado: input.estado ?? 'vigente',
    fechaInicio: input.fechaInicio,
    cargoDisplay: input.cargoDisplay,
    montoMensualReferencia: input.montoMensualReferencia,
    monedaReferencia: input.monedaReferencia,
    metaVentasMensual: input.metaVentasMensual,
    // Línea de negocio · single · ausente = compartido (chk5-LINEAS)
    lineaNegocioId: input.lineaNegocioId,
    lineaNegocioSnapshot: input.lineaNegocioSnapshot,
    notas: input.notas,
    relacionAnteriorId: input.relacionAnteriorId,
    creadoPor,
    fechaCreacion: now,
  };

  // Vinculación con Maestro (v5.8) · solo para 'externo' principalmente
  if (input.entidadMaestroRef) {
    docData.entidadMaestroRef = {
      ...input.entidadMaestroRef,
      fechaVinculacion: now,
      vinculadoPor: creadoPor,
    };
  }

  // Limpiar campos undefined antes de Firestore (no acepta undefined)
  const clean = removeUndefined(docData);

  const ref = await addDoc(collection(db, COL), clean);
  // chk5.PERSONAS-F1 · materializar el rol socio si la relación creada es socio
  if (input.tipo === 'socio') await sincronizarRolSocio(input.userId);
  return ref.id;
}

// ═════════════════════════════════════════════════════════════════════════
// WRITE · update / state transitions
// ═════════════════════════════════════════════════════════════════════════

/**
 * Edita campos editables de una relación vigente.
 * Bloqueado si estado === 'finalizada'.
 */
async function update(
  relacionId: string,
  cambios: Partial<Pick<RelacionLaboral,
    'cargoDisplay' | 'montoMensualReferencia' | 'monedaReferencia' | 'metaVentasMensual' |
    'subTipo' | 'notas' | 'lineaNegocioId' | 'lineaNegocioSnapshot'>>,
  modificadoPor: string,
): Promise<void> {
  const existente = await getById(relacionId);
  if (!existente) throw new Error(`Relación ${relacionId} no existe`);
  if (existente.estado === 'finalizada') {
    throw new Error(`No se puede editar una relación finalizada (id=${relacionId})`);
  }

  const update = {
    ...removeUndefined(cambios),
    modificadoPor,
    fechaModificacion: serverTimestamp(),
  };

  await updateDoc(doc(db, COL, relacionId), update);
}

/**
 * Pausa una relación (típicamente licencia · maternidad · sabbatical).
 * estado: vigente → pausada · re-activable después.
 */
async function pausar(
  relacionId: string,
  motivo: string,
  modificadoPor: string,
): Promise<void> {
  const existente = await getById(relacionId);
  if (!existente) throw new Error(`Relación ${relacionId} no existe`);
  if (existente.estado !== 'vigente' && existente.estado !== 'prueba') {
    throw new Error(`Solo se pueden pausar relaciones vigentes (actual=${existente.estado})`);
  }
  await updateDoc(doc(db, COL, relacionId), {
    estado: 'pausada' as EstadoRelacion,
    notas: existente.notas ? `${existente.notas}\n[Pausa] ${motivo}` : `[Pausa] ${motivo}`,
    modificadoPor,
    fechaModificacion: serverTimestamp(),
  });
}

/**
 * Reanuda una relación pausada · pausada → vigente.
 */
async function reanudar(relacionId: string, modificadoPor: string): Promise<void> {
  const existente = await getById(relacionId);
  if (!existente) throw new Error(`Relación ${relacionId} no existe`);
  if (existente.estado !== 'pausada') {
    throw new Error(`Solo se pueden reanudar relaciones pausadas (actual=${existente.estado})`);
  }
  await updateDoc(doc(db, COL, relacionId), {
    estado: 'vigente' as EstadoRelacion,
    modificadoPor,
    fechaModificacion: serverTimestamp(),
  });
}

/**
 * Finaliza una relación · snapshot inmutable + audit.
 * estado → finalizada · NO se puede reactivar (se crea relación nueva).
 *
 * El snapshot se construye según el tipo de relación.
 * NOTA: en v5.6/E1, los snapshots se llenan con datos básicos disponibles.
 *       La integración profunda con datos de planilla/socios se hace en E3+.
 */
async function finalizar(
  input: FinalizarRelacionInput,
  modificadoPor: string,
): Promise<void> {
  const existente = await getById(input.relacionId);
  if (!existente) throw new Error(`Relación ${input.relacionId} no existe`);
  if (existente.estado === 'finalizada') {
    throw new Error(`Relación ${input.relacionId} ya está finalizada`);
  }

  const fechaFin = input.fechaFin ?? (serverTimestamp() as Timestamp);

  // Construir snapshot básico según tipo · v5.6 mínimo
  // (E3 enriquecerá con datos de planilla/socios cuando integremos)
  let snapshot: Partial<RelacionLaboral> = {};

  if (existente.tipo === 'empleado') {
    const empSnap: DatosLaboralesSnapshot = {
      cargo: existente.cargoDisplay ?? '—',
      salarioBruto: existente.montoMensualReferencia ?? 0,
      monedaSalario: (existente.monedaReferencia ?? 'PEN') as 'PEN' | 'USD',
      fechaSnapshot: fechaFin,
    };
    snapshot.datosLaboralesSnapshot = empSnap;
  } else if (existente.tipo === 'socio') {
    const socSnap: DatosSocioSnapshot = {
      porcentajeParticipacion: 0, // E3 enriquecerá desde socios/datosSocio
      aporteCapitalAcumulado: 0,
      monedaAporte: 'PEN',
      fechaIngresoSocio: existente.fechaInicio,
      distribucionesAcumuladas: 0,
      fechaSnapshot: fechaFin,
    };
    snapshot.datosSocioSnapshot = socSnap;
  } else if (existente.tipo === 'externo') {
    const extSnap: DatosExternoSnapshot = {
      cargoEnEntidad: existente.entidadMaestroRef?.rolEnEntidad,
      tarifaAcordada: existente.montoMensualReferencia,
      monedaTarifa: (existente.monedaReferencia ?? 'PEN') as 'PEN' | 'USD',
      fechaSnapshot: fechaFin,
    };
    snapshot.datosExternoSnapshot = extSnap;
  }
  // honorarios: no estructura snapshot dedicada por ahora · usa fechaFin + motivoFin

  await updateDoc(doc(db, COL, input.relacionId), {
    estado: 'finalizada' as EstadoRelacion,
    fechaFin,
    motivoFin: input.motivoFin,
    notaMotivoFin: input.notaMotivoFin,
    modificadoPor,
    fechaModificacion: serverTimestamp(),
    ...removeUndefined(snapshot),
  });

  // chk5.PERSONAS-F1 · re-sincronizar el rol socio si la relación finalizada era socio
  if (existente.tipo === 'socio') await sincronizarRolSocio(existente.userId);
}

/**
 * RECLASIFICACIÓN ATÓMICA · v5.6 canon.
 * Cierra la relación A (motivoFin='reclasificacion') + crea la relación B
 * apuntando a A (relacionAnteriorId).
 *
 * Caso de uso: Carlos era honorarios · pasa a empleado. Se preserva el
 * histórico de honorarios + nueva relación empleado con link a la anterior.
 *
 * Usa writeBatch para atomicidad · si falla, ningún cambio se persiste.
 */
async function reclasificar(
  input: ReclasificarRelacionInput,
  modificadoPor: string,
): Promise<string> {
  const anterior = await getById(input.relacionAnteriorId);
  if (!anterior) throw new Error(`Relación anterior ${input.relacionAnteriorId} no existe`);
  if (anterior.estado === 'finalizada') {
    throw new Error(`No se puede reclasificar una relación ya finalizada`);
  }
  if (anterior.tipo === input.nuevoTipo) {
    throw new Error(`Reclasificar requiere cambiar de tipo (de ${anterior.tipo} a ${input.nuevoTipo})`);
  }

  const fechaTransicion = input.fechaTransicion ?? (serverTimestamp() as Timestamp);
  const batch = writeBatch(db);

  // 1. Cerrar relación anterior · estado=finalizada · motivoFin=reclasificacion
  const refAnterior = doc(db, COL, input.relacionAnteriorId);
  batch.update(refAnterior, {
    estado: 'finalizada' as EstadoRelacion,
    fechaFin: fechaTransicion,
    motivoFin: 'reclasificacion',
    notaMotivoFin: input.notaMotivo ?? `Reclasificada a ${input.nuevoTipo}`,
    modificadoPor,
    fechaModificacion: serverTimestamp(),
  });

  // 2. Crear nueva relación · referenciando la anterior
  const refNueva = doc(collection(db, COL));
  const nuevaData: Omit<RelacionLaboral, 'id'> = {
    userId: anterior.userId,
    tipo: input.nuevoTipo,
    subTipo: input.nuevoSubTipo,
    estado: 'vigente',
    fechaInicio: fechaTransicion,
    cargoDisplay: input.nuevoCargoDisplay,
    montoMensualReferencia: input.nuevoMontoMensualReferencia,
    monedaReferencia: anterior.monedaReferencia,
    creadoPor: modificadoPor,
    fechaCreacion: serverTimestamp() as Timestamp,
    relacionAnteriorId: input.relacionAnteriorId,
    notas: input.notaMotivo ? `Reclasificación desde ${anterior.tipo}: ${input.notaMotivo}` : `Reclasificación desde ${anterior.tipo}`,
  };
  batch.set(refNueva, removeUndefined(nuevaData));

  await batch.commit();
  // chk5.PERSONAS-F1 · re-sincronizar el rol socio si el tipo viejo o el nuevo es socio
  if (anterior.tipo === 'socio' || input.nuevoTipo === 'socio') {
    await sincronizarRolSocio(anterior.userId);
  }
  return refNueva.id;
}

// ═════════════════════════════════════════════════════════════════════════
// VINCULACIÓN MAESTROS · v5.8
// ═════════════════════════════════════════════════════════════════════════

/**
 * Vincula una relación con una entidad de Maestros (post-creación).
 * Si la relación ya tiene entidadMaestroRef, lo sobrescribe.
 */
async function vincularConMaestro(
  relacionId: string,
  ref: Omit<EntidadMaestroRef, 'fechaVinculacion' | 'vinculadoPor'>,
  vinculadoPor: string,
): Promise<void> {
  const existente = await getById(relacionId);
  if (!existente) throw new Error(`Relación ${relacionId} no existe`);
  if (existente.estado === 'finalizada') {
    throw new Error(`No se puede vincular una relación finalizada`);
  }

  const fullRef: EntidadMaestroRef = {
    ...ref,
    fechaVinculacion: serverTimestamp() as Timestamp,
    vinculadoPor,
  };

  await updateDoc(doc(db, COL, relacionId), {
    entidadMaestroRef: fullRef,
    modificadoPor: vinculadoPor,
    fechaModificacion: serverTimestamp(),
  });
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS internos
// ═════════════════════════════════════════════════════════════════════════

/**
 * Firestore no acepta `undefined` como valor · esta función filtra los undefined
 * de un objeto recursivamente (1 nivel · suficiente para nuestros docs flat).
 */
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

export const relacionesLaboralesService = {
  // Read
  listByUser,
  listVigentesByUser,
  getContactosByMaestro,
  getById,

  // Write · creación
  create,

  // Write · transiciones
  update,
  pausar,
  reanudar,
  finalizar,
  reclasificar,

  // Vinculación con Maestros (v5.8)
  vincularConMaestro,
};
