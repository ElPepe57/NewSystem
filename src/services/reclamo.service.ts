/**
 * reclamo.service.ts — S40 Bloque B
 *
 * CRUD + workflow de Reclamos a proveedor/courier/seguro por unidades
 * dañadas, perdidas o abandonadas en aduana.
 *
 * Efectos contables automáticos:
 *  - `registrarCobro` → crea movimiento tesorería ingreso_otro
 *  - `rechazar` / `cerrarSinCobrar` → crea gasto categoria GV / tipo merma_transferencia
 */
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import { envioCrudService } from './envio.crud.service';
import { tesoreriaService } from './tesoreria.service';
import { gastoService } from './gasto.service';
import type {
  Reclamo,
  ReclamoFormData,
  ReclamoFiltros,
  EstadoReclamo,
  ResumenReclamos,
  TipoResolucionReclamo,
  ReclamoEvento,
  TipoEventoReclamo,
} from '../types/reclamo.types';
import { ESTADOS_RECLAMO_ACTIVOS } from '../types/reclamo.types';
import type { MetodoTesoreria } from '../types/tesoreria.types';
import type { IncidenciaEnvio } from '../types/envio.types';
// S55 Fase 6 — Tipo de entidad CC para mapear destinatario del reclamo.
import type { TipoEntidadCC } from '../types/cuentaCorriente.types';

/**
 * S55 Fase 6 — Mapea el destinatario del reclamo al tipo de entidad CC.
 *
 * 'proveedor' → 'proveedor'
 * 'courier'   → 'colaborador' (couriers en este ERP son colaboradores)
 * 'seguro'    → null (no es entidad CC; el cobro queda como ingreso_otro)
 * 'otro'      → null (idem)
 */
function mapDestinatarioReclamoATipoCC(
  destinatario: 'proveedor' | 'courier' | 'seguro' | 'otro',
): TipoEntidadCC | null {
  if (destinatario === 'proveedor') return 'proveedor';
  if (destinatario === 'courier') return 'colaborador';
  return null;
}

const COLL = COLLECTIONS.RECLAMOS;

/**
 * Limpia campos undefined recursivamente (Firestore no acepta undefined).
 */
function removeUndefined<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Timestamp) && !(v instanceof Date)) {
      out[k] = removeUndefined(v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

/**
 * Genera REC-YYYY-NNN.
 */
async function generateNumeroReclamo(): Promise<string> {
  const year = new Date().getFullYear();
  return getNextSequenceNumber(`REC-${year}`, 3);
}

/**
 * S54.x (D-REC-4) — Construye un evento del historial del reclamo.
 * Cada transición de estado llama a este helper y agrega el evento al
 * array `historial[]` del doc en Firestore (vía arrayUnion).
 */
function buildEvento(
  tipo: TipoEventoReclamo,
  descripcion: string,
  usuarioId: string,
  meta?: ReclamoEvento['meta'],
): ReclamoEvento {
  return removeUndefined({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tipo,
    fecha: Timestamp.now(),
    usuarioId,
    descripcion,
    meta,
  } as ReclamoEvento);
}

/**
 * Propaga estadoReclamo y montoReclamoPEN a la incidencia asociada (si hay).
 * Mantiene sincronizados los dos modelos (Reclamo + IncidenciaEnvio.estadoReclamo).
 */
async function syncIncidenciasEnvio(reclamo: Reclamo, userId: string): Promise<void> {
  try {
    const envio = await envioCrudService.getById(reclamo.envioId);
    if (!envio) return;

    const mapEstado: Record<EstadoReclamo, IncidenciaEnvio['estadoReclamo'] | undefined> = {
      borrador: 'pendiente',
      enviado: 'pendiente',
      en_disputa: 'pendiente',
      aceptado: 'aceptado',
      cobrado: 'cobrado',
      rechazado: 'rechazado',
      cerrado_sin_cobrar: 'rechazado',
    };
    const nuevoEstadoInc = mapEstado[reclamo.estado];
    if (!nuevoEstadoInc) return;

    const now = Timestamp.now();
    const unidadIdsSet = new Set(reclamo.unidadesIds);
    const incidenciasActualizadas = (envio.incidencias || []).map(inc => {
      if (!inc.unidadId || !unidadIdsSet.has(inc.unidadId)) return inc;
      // BUG-INC-006/007/008 fix (S54.x) — Cuando hay reclamo creado, la
      // incidencia se considera RESUELTA (la decisión fue tomada: ir por
      // reclamo). El reclamo seguirá su propio ciclo. Esto permite que el
      // envío transite a 'recibida_completa' una vez todas las incidencias
      // tengan decisión, aunque los reclamos sigan abiertos.
      return {
        ...inc,
        resuelta: true,
        resolucion:
          inc.resolucion ||
          `Reclamo ${reclamo.numeroReclamo} creado (tipo: ${reclamo.tipo})`,
        fechaResolucion: inc.fechaResolucion || now,
        estadoReclamo: nuevoEstadoInc,
        montoReclamoPEN: reclamo.montoReclamadoPEN,
      };
    });

    // BUG-INC-006/007/008 fix — Recalcular estado del envío considerando
    // las incidencias resueltas. Esto reemplaza la lógica vieja que dejaba
    // el envío en 'recibida_parcial' eternamente.
    const { buildEnvioEstadoUpdates } = await import('../utils/envio.estado.helpers');
    const envioEstadoUpdates = buildEnvioEstadoUpdates(
      envio.unidades,
      incidenciasActualizadas,
    );

    const envioRef = doc(db, COLLECTIONS.ENVIOS, reclamo.envioId);
    await updateDoc(envioRef, {
      incidencias: incidenciasActualizadas,
      ...envioEstadoUpdates,
      actualizadoPor: userId,
      fechaActualizacion: now,
    });

    logger.info(
      `Reclamo ${reclamo.numeroReclamo}: envío ${envio.numeroEnvio} ` +
      `recalculado a estado='${envioEstadoUpdates.estado}'`
    );
  } catch (err) {
    logger.error('Error al sincronizar incidencias del envío con reclamo (no bloqueante):', err);
  }
}

export const reclamoService = {
  // ─── Lecturas ─────────────────────────────────────────────────────────────

  async getAll(filtros?: ReclamoFiltros): Promise<Reclamo[]> {
    const constraints: any[] = [];

    if (filtros?.estado) {
      constraints.push(where('estado', '==', filtros.estado));
    } else if (filtros?.estados && filtros.estados.length > 0) {
      // Firestore limita 'in' a 10 valores — ok para nuestros enum de 7
      constraints.push(where('estado', 'in', filtros.estados));
    }
    if (filtros?.tipo) constraints.push(where('tipo', '==', filtros.tipo));
    if (filtros?.destinatario) constraints.push(where('destinatario', '==', filtros.destinatario));
    // BUG-INC-004 fix (S54.x) — filtrar por entidad destinataria
    if (filtros?.destinatarioId) constraints.push(where('destinatarioId', '==', filtros.destinatarioId));
    if (filtros?.envioId) constraints.push(where('envioId', '==', filtros.envioId));
    if (filtros?.ordenCompraId) constraints.push(where('ordenCompraId', '==', filtros.ordenCompraId));
    if (filtros?.lineaNegocioId) constraints.push(where('lineaNegocioId', '==', filtros.lineaNegocioId));
    if (filtros?.fechaDesde) constraints.push(where('fechaCreacion', '>=', Timestamp.fromDate(filtros.fechaDesde)));
    if (filtros?.fechaHasta) constraints.push(where('fechaCreacion', '<=', Timestamp.fromDate(filtros.fechaHasta)));

    // Si hay filtro por fecha no combinamos con orderBy para evitar índice compuesto
    const hasFechaFilter = !!filtros?.fechaDesde || !!filtros?.fechaHasta;
    const q = hasFechaFilter
      ? query(collection(db, COLL), ...constraints)
      : query(collection(db, COLL), ...constraints, orderBy('fechaCreacion', 'desc'));

    const snap = await getDocs(q);
    const reclamos = snap.docs.map(d => ({ id: d.id, ...d.data() } as Reclamo));
    if (hasFechaFilter) {
      reclamos.sort((a, b) => b.fechaCreacion.toMillis() - a.fechaCreacion.toMillis());
    }
    return reclamos;
  },

  async getById(id: string): Promise<Reclamo | null> {
    const snap = await getDoc(doc(db, COLL, id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Reclamo) : null;
  },

  async getByEnvio(envioId: string): Promise<Reclamo[]> {
    return this.getAll({ envioId });
  },

  async getResumen(filtros?: ReclamoFiltros): Promise<ResumenReclamos> {
    const reclamos = await this.getAll(filtros);
    const totalReclamadoPEN = reclamos.reduce((s, r) => s + (r.montoReclamadoPEN || 0), 0);
    const totalCobradoPEN = reclamos.reduce((s, r) => s + (r.montoCobradoPEN || 0), 0);
    const perdidos = reclamos.filter(r => r.estado === 'rechazado' || r.estado === 'cerrado_sin_cobrar');
    const totalPerdidoPEN = perdidos.reduce((s, r) => s + (r.montoReclamadoPEN || 0), 0);

    const reclamosPendientes = reclamos.filter(r =>
      r.estado === 'enviado' || r.estado === 'en_disputa' || r.estado === 'aceptado'
    ).length;
    const reclamosCobrados = reclamos.filter(r => r.estado === 'cobrado').length;
    const reclamosRechazados = reclamos.filter(r => r.estado === 'rechazado').length;

    const tasaRecuperacion = totalReclamadoPEN > 0
      ? (totalCobradoPEN / totalReclamadoPEN) * 100
      : 0;

    return {
      totalReclamos: reclamos.length,
      totalReclamadoPEN,
      totalCobradoPEN,
      totalPerdidoPEN,
      reclamosPendientes,
      reclamosCobrados,
      reclamosRechazados,
      tasaRecuperacion,
    };
  },

  // ─── Escritura / Workflow ─────────────────────────────────────────────────

  /**
   * Crea un reclamo en estado 'borrador'.
   */
  async crear(data: ReclamoFormData, userId: string): Promise<string> {
    if (!data.envioId) throw new Error('envioId requerido');
    if (!data.unidadesIds || data.unidadesIds.length === 0) {
      throw new Error('Debe indicar al menos una unidad afectada');
    }
    if (data.montoReclamadoPEN <= 0) {
      throw new Error('El monto reclamado debe ser mayor a 0');
    }

    const numeroReclamo = await generateNumeroReclamo();
    const now = Timestamp.now();

    const eventoCreacion = buildEvento(
      'creado',
      `Reclamo creado en borrador · monto S/ ${data.montoReclamadoPEN.toFixed(2)} · ${data.unidadesIds.length} unidad${data.unidadesIds.length !== 1 ? 'es' : ''}`,
      userId,
      {
        montoPEN: data.montoReclamadoPEN,
        montoUSD: data.montoReclamadoUSD,
        nuevoEstado: 'borrador',
      },
    );

    const reclamo: Omit<Reclamo, 'id'> = {
      numeroReclamo,
      envioId: data.envioId,
      envioNumero: data.envioNumero,
      ordenCompraId: data.ordenCompraId,
      ordenCompraNumero: data.ordenCompraNumero,
      tipo: data.tipo,
      destinatario: data.destinatario,
      destinatarioId: data.destinatarioId,
      destinatarioNombre: data.destinatarioNombre,
      unidadesIds: data.unidadesIds,
      cantidadUnidades: data.unidadesIds.length,
      montoReclamadoPEN: data.montoReclamadoPEN,
      montoReclamadoUSD: data.montoReclamadoUSD,
      tipoCambio: data.tipoCambio,
      evidenciaURLs: data.evidenciaURLs,
      notas: data.notas,
      estado: 'borrador',
      fechaCreacion: now,
      creadoPor: userId,
      lineaNegocioId: data.lineaNegocioId,
      historial: [eventoCreacion],
    };

    const ref = await addDoc(collection(db, COLL), removeUndefined(reclamo as any));
    const creado: Reclamo = { id: ref.id, ...reclamo };
    logger.success(`Reclamo ${numeroReclamo} creado (borrador) — ${data.destinatarioNombre} — S/ ${data.montoReclamadoPEN.toFixed(2)}`);

    // Sync con incidencia (marcar estadoReclamo=pendiente)
    await syncIncidenciasEnvio(creado, userId);

    return ref.id;
  },

  /**
   * Actualiza campos editables de un reclamo (solo si está en borrador o enviado).
   */
  async actualizar(id: string, partial: Partial<ReclamoFormData>, userId: string): Promise<void> {
    const reclamo = await this.getById(id);
    if (!reclamo) throw new Error('Reclamo no encontrado');
    if (reclamo.estado !== 'borrador' && reclamo.estado !== 'enviado') {
      throw new Error(`No se puede editar un reclamo en estado ${reclamo.estado}`);
    }

    const updates: Record<string, any> = {
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    };
    if (partial.montoReclamadoPEN !== undefined) updates.montoReclamadoPEN = partial.montoReclamadoPEN;
    if (partial.montoReclamadoUSD !== undefined) updates.montoReclamadoUSD = partial.montoReclamadoUSD;
    if (partial.tipoCambio !== undefined) updates.tipoCambio = partial.tipoCambio;
    if (partial.destinatario !== undefined) updates.destinatario = partial.destinatario;
    if (partial.destinatarioId !== undefined) updates.destinatarioId = partial.destinatarioId;
    if (partial.destinatarioNombre !== undefined) updates.destinatarioNombre = partial.destinatarioNombre;
    if (partial.tipo !== undefined) updates.tipo = partial.tipo;
    if (partial.unidadesIds !== undefined) {
      updates.unidadesIds = partial.unidadesIds;
      updates.cantidadUnidades = partial.unidadesIds.length;
    }
    if (partial.evidenciaURLs !== undefined) updates.evidenciaURLs = partial.evidenciaURLs;
    if (partial.notas !== undefined) updates.notas = partial.notas;

    await updateDoc(doc(db, COLL, id), updates);
    logger.info(`Reclamo ${reclamo.numeroReclamo}: actualizado`);
  },

  /**
   * borrador → enviado
   */
  async enviar(id: string, userId: string): Promise<void> {
    const reclamo = await this.getById(id);
    if (!reclamo) throw new Error('Reclamo no encontrado');
    if (reclamo.estado !== 'borrador') {
      throw new Error(`Solo se pueden enviar reclamos en borrador (actual: ${reclamo.estado})`);
    }

    const now = Timestamp.now();
    const evento = buildEvento(
      'enviado',
      `Reclamo enviado a ${reclamo.destinatarioNombre}. A la espera de respuesta.`,
      userId,
      { estadoAnterior: reclamo.estado, nuevoEstado: 'enviado' },
    );
    await updateDoc(doc(db, COLL, id), {
      estado: 'enviado' as EstadoReclamo,
      fechaEnvio: now,
      actualizadoPor: userId,
      fechaActualizacion: now,
      historial: arrayUnion(evento),
    });
    logger.success(`Reclamo ${reclamo.numeroReclamo}: enviado a ${reclamo.destinatarioNombre}`);
    await syncIncidenciasEnvio({ ...reclamo, estado: 'enviado', fechaEnvio: now }, userId);
  },

  /**
   * enviado → en_disputa
   */
  async marcarEnDisputa(id: string, motivoDisputa: string, userId: string): Promise<void> {
    const reclamo = await this.getById(id);
    if (!reclamo) throw new Error('Reclamo no encontrado');
    if (reclamo.estado !== 'enviado' && reclamo.estado !== 'en_disputa') {
      throw new Error(`No se puede marcar en disputa desde estado ${reclamo.estado}`);
    }

    const now = Timestamp.now();
    const evento = buildEvento(
      'marcado_en_disputa',
      `Marcado en disputa: ${motivoDisputa}`,
      userId,
      { estadoAnterior: reclamo.estado, nuevoEstado: 'en_disputa', motivo: motivoDisputa },
    );
    await updateDoc(doc(db, COLL, id), {
      estado: 'en_disputa' as EstadoReclamo,
      motivoDisputa,
      fechaRespuesta: now,
      actualizadoPor: userId,
      fechaActualizacion: now,
      historial: arrayUnion(evento),
    });
    logger.info(`Reclamo ${reclamo.numeroReclamo}: en disputa — ${motivoDisputa}`);
  },

  /**
   * enviado | en_disputa → aceptado
   * montoAcordadoPEN puede ser distinto al reclamado original.
   */
  async aceptar(id: string, montoAcordadoPEN: number, userId: string): Promise<void> {
    const reclamo = await this.getById(id);
    if (!reclamo) throw new Error('Reclamo no encontrado');
    if (reclamo.estado !== 'enviado' && reclamo.estado !== 'en_disputa') {
      throw new Error(`No se puede aceptar desde estado ${reclamo.estado}`);
    }
    if (montoAcordadoPEN <= 0) throw new Error('Monto acordado debe ser > 0');

    const now = Timestamp.now();
    const evento = buildEvento(
      'aceptado',
      `Aceptado por S/ ${montoAcordadoPEN.toFixed(2)}. Pendiente de cobro efectivo.`,
      userId,
      {
        estadoAnterior: reclamo.estado,
        nuevoEstado: 'aceptado',
        montoPEN: montoAcordadoPEN,
      },
    );
    await updateDoc(doc(db, COLL, id), {
      estado: 'aceptado' as EstadoReclamo,
      montoAcordadoPEN,
      fechaRespuesta: reclamo.fechaRespuesta || now,
      actualizadoPor: userId,
      fechaActualizacion: now,
      historial: arrayUnion(evento),
    });
    logger.success(`Reclamo ${reclamo.numeroReclamo}: aceptado por S/ ${montoAcordadoPEN.toFixed(2)}`);
    await syncIncidenciasEnvio({ ...reclamo, estado: 'aceptado', montoAcordadoPEN }, userId);
  },

  /**
   * S45 (D-16) — enviado | en_disputa → aceptado con tipoResolucion='reemplazo'
   *
   * El destinatario acepta enviar fisicamente una nueva unidad en vez de pagar.
   * Crea una sub-tanda tipo='reemplazo' dentro del envio padre, vinculada al
   * reclamo. El CTRU de la unidad reclamada se preserva (reemplazo gratuito
   * por convencion).
   *
   * NO crea asiento contable (no hay movimiento financiero). Cuando la tanda
   * de reemplazo llegue y se marque como entregado, llamar a
   * `confirmarReemplazoRecibido()` para cerrar el reclamo.
   *
   * Si el reemplazo tambien falla (nunca llega), el usuario puede reabrir el
   * reclamo y convertirlo a 'merma' via `rechazar()` o `cerrarSinCobrar()`.
   */
  async resolverConReemplazo(
    reclamoId: string,
    datos: {
      reemplazoTracking?: string;
      reemplazoFechaEstimada?: Date;
      notas?: string;
    },
    userId: string
  ): Promise<{ subEnvioReemplazoId: string }> {
    const reclamo = await this.getById(reclamoId);
    if (!reclamo) throw new Error('Reclamo no encontrado');
    if (reclamo.estado !== 'enviado' && reclamo.estado !== 'en_disputa') {
      throw new Error(`No se puede resolver con reemplazo desde estado ${reclamo.estado}`);
    }
    if (!reclamo.envioId) {
      throw new Error('Reclamo sin envío vinculado — no se puede crear tanda de reemplazo');
    }
    if (!reclamo.unidadesIds || reclamo.unidadesIds.length === 0) {
      throw new Error('Reclamo sin unidades — no se puede crear tanda de reemplazo');
    }

    // Ubicar la sub-tanda original (si hay) para vincular la de reemplazo.
    // La original es la que contenía alguna de las unidades reclamadas (tipo='normal').
    const envio = await envioCrudService.getById(reclamo.envioId);
    if (!envio) throw new Error('Envío del reclamo no existe');
    const reclamoUidsSet = new Set(reclamo.unidadesIds);
    const tandaOriginal = (envio.subEnvios ?? []).find(
      (se) =>
        se.tipo === 'normal' &&
        se.unidadesIds.some((uid) => reclamoUidsSet.has(uid))
    );

    // 1. Crear la sub-tanda tipo='reemplazo' en el envío
    const nuevaTanda = await envioCrudService.crearSubTandaT1(
      reclamo.envioId,
      {
        unidadesIds: reclamo.unidadesIds,
        tipo: 'reemplazo',
        estado: 'pendiente',
        numeroTrackingProveedor: datos.reemplazoTracking,
        fechaEstimadaEntrega: datos.reemplazoFechaEstimada,
        reclamoId,
        tandaOriginalId: tandaOriginal?.id,
        notas: datos.notas
          ? `Reemplazo por reclamo ${reclamo.numeroReclamo}. ${datos.notas}`
          : `Reemplazo por reclamo ${reclamo.numeroReclamo}`,
      },
      userId
    );

    // 2. Actualizar el reclamo con la resolución elegida
    const now = Timestamp.now();
    const tipoRes: TipoResolucionReclamo = 'reemplazo';
    const evento = buildEvento(
      'resuelto_con_reemplazo',
      `Aceptado con reemplazo físico. Sub-tanda creada en envío ${envio.numeroEnvio}.`,
      userId,
      {
        estadoAnterior: reclamo.estado,
        nuevoEstado: 'aceptado',
        subEnvioReemplazoId: nuevaTanda.id,
        montoPEN: reclamo.montoReclamadoPEN,
      },
    );
    await updateDoc(doc(db, COLL, reclamoId), {
      estado: 'aceptado' as EstadoReclamo,
      tipoResolucion: tipoRes,
      subEnvioReemplazoId: nuevaTanda.id,
      fechaResolucion: now,
      fechaRespuesta: reclamo.fechaRespuesta || now,
      // Monto acordado = monto reclamado completo (se reemplaza en especie)
      montoAcordadoPEN: reclamo.montoReclamadoPEN,
      actualizadoPor: userId,
      fechaActualizacion: now,
      historial: arrayUnion(evento),
      ...(datos.notas ? { notas: datos.notas } : {}),
    });

    logger.success(
      `Reclamo ${reclamo.numeroReclamo}: resuelto con REEMPLAZO · sub-tanda ${nuevaTanda.id} creada en envío ${envio.numeroEnvio}`
    );
    await syncIncidenciasEnvio(
      { ...reclamo, estado: 'aceptado', tipoResolucion: tipoRes, subEnvioReemplazoId: nuevaTanda.id },
      userId
    );

    return { subEnvioReemplazoId: nuevaTanda.id };
  },

  /**
   * S45 (D-16) — aceptado con tipoResolucion='reemplazo' → cerrado
   *
   * Llamar cuando la sub-tanda de reemplazo efectivamente se entrega. Cierra
   * el reclamo sin movimiento financiero (no hay cobro — se reemplazo en
   * especie). La unidad queda disponible con su CTRU original preservado.
   *
   * Si el reemplazo NO llega, llamar a `rechazar()` o `cerrarSinCobrar()`
   * para convertir la resolucion a merma.
   */
  async confirmarReemplazoRecibido(reclamoId: string, userId: string): Promise<void> {
    const reclamo = await this.getById(reclamoId);
    if (!reclamo) throw new Error('Reclamo no encontrado');
    if (reclamo.estado !== 'aceptado') {
      throw new Error(
        `Solo se puede confirmar reemplazo de reclamos aceptados (actual: ${reclamo.estado})`
      );
    }
    if (reclamo.tipoResolucion !== 'reemplazo') {
      throw new Error(
        `Reclamo no fue resuelto con reemplazo (tipoResolucion: ${reclamo.tipoResolucion})`
      );
    }

    const now = Timestamp.now();
    // Estado 'cobrado' se usa como terminal de éxito aunque no haya movimiento
    // financiero — refleja que el reclamo cumplió su resolución. El
    // tipoResolucion='reemplazo' deja claro que no hubo pago.
    const evento = buildEvento(
      'reemplazo_recibido',
      'Sub-tanda de reemplazo recibida. Reclamo cerrado sin movimiento financiero.',
      userId,
      { estadoAnterior: 'aceptado', nuevoEstado: 'cobrado' },
    );
    await updateDoc(doc(db, COLL, reclamoId), {
      estado: 'cobrado' as EstadoReclamo,
      fechaCobro: now,
      fechaCierre: now,
      cerradoPor: userId,
      montoCobradoPEN: 0, // no hay dinero, se reemplazo en especie
      actualizadoPor: userId,
      fechaActualizacion: now,
      historial: arrayUnion(evento),
    });

    logger.success(
      `Reclamo ${reclamo.numeroReclamo}: REEMPLAZO confirmado recibido · cerrado sin movimiento financiero`
    );
    await syncIncidenciasEnvio(
      { ...reclamo, estado: 'cobrado', montoCobradoPEN: 0 },
      userId
    );
  },

  /**
   * S55 Fase 6 — enviado | en_disputa → aceptado con tipoResolucion='credito_a_favor'
   *
   * El destinatario acepta el reclamo PERO no paga cash. En su lugar nos da
   * un crédito aplicable a futuras transacciones (ej: descuento en próxima OC).
   *
   * Crea movimiento `credito_reclamo` en CC del destinatario sin tocar
   * tesorería. El saldo CC del destinatario refleja "te debo $X aplicables".
   * Cuando se aplique a una OC/Venta nueva, se hace via `aplicarSaldo`.
   *
   * Estado del reclamo pasa a 'cobrado' (terminal de éxito) con
   * `montoCobradoPEN = 0` (sin dinero real) — análogo al reemplazo físico
   * pero contablemente el saldo a favor queda registrado en CC.
   */
  async aceptarConCreditoAFavor(
    reclamoId: string,
    montoAcordadoPEN: number,
    userId: string,
    notas?: string,
  ): Promise<{ movimientoCCId: string }> {
    const reclamo = await this.getById(reclamoId);
    if (!reclamo) throw new Error('Reclamo no encontrado');
    if (reclamo.estado !== 'enviado' && reclamo.estado !== 'en_disputa') {
      throw new Error(`No se puede aceptar con crédito desde estado ${reclamo.estado}`);
    }
    if (montoAcordadoPEN <= 0) throw new Error('Monto debe ser > 0');

    const tipoCC = mapDestinatarioReclamoATipoCC(reclamo.destinatario);
    if (!tipoCC || !reclamo.destinatarioId) {
      throw new Error(
        `Crédito a favor solo aplica a destinatarios proveedor/courier con ID. ` +
        `Para 'seguro' u 'otro' usar registrarCobro o rechazar.`,
      );
    }

    // 1. Crear movimiento `credito_reclamo` en CC del destinatario
    const { cuentaCorrienteService } = await import('./cuentaCorriente.service');
    const ccResult = await cuentaCorrienteService.registrarMovimiento(
      {
        entidadId: reclamo.destinatarioId,
        tipo: tipoCC,
        entidadNombre: reclamo.destinatarioNombre,
        tipoMovimiento: 'credito_reclamo',
        descripcion:
          `Crédito a favor por reclamo ${reclamo.numeroReclamo} (${reclamo.tipo}) · ` +
          `S/ ${montoAcordadoPEN.toFixed(2)} aplicable a futuros documentos`,
        moneda: 'PEN',
        monto: montoAcordadoPEN,
        refDocumentoTipo: 'reclamo',
        refDocumentoId: reclamoId,
        refDocumentoNumero: reclamo.numeroReclamo,
        notas,
        idempotencyKey: `aceptar_credito_reclamo_${reclamoId}`,
      },
      userId,
    );

    // 2. Actualizar reclamo a 'cobrado' (terminal de éxito sin cash)
    const now = Timestamp.now();
    const tipoRes: TipoResolucionReclamo = 'reembolso'; // semánticamente reembolso (no merma, no reemplazo)
    const evento = buildEvento(
      'cobrado',
      `Resuelto con crédito a favor · S/ ${montoAcordadoPEN.toFixed(2)} ` +
        `aplicable a futuras OCs/transacciones con ${reclamo.destinatarioNombre}`,
      userId,
      {
        estadoAnterior: reclamo.estado,
        nuevoEstado: 'cobrado',
        montoPEN: montoAcordadoPEN,
      },
    );
    await updateDoc(doc(db, COLL, reclamoId), {
      estado: 'cobrado' as EstadoReclamo,
      tipoResolucion: tipoRes,
      montoAcordadoPEN,
      montoCobradoPEN: 0, // no hay cash; el crédito vive en CC
      fechaResolucion: now,
      fechaRespuesta: reclamo.fechaRespuesta || now,
      fechaCobro: now,
      fechaCierre: now,
      cerradoPor: userId,
      actualizadoPor: userId,
      fechaActualizacion: now,
      historial: arrayUnion(evento),
      ...(notas ? { notas } : {}),
    });

    logger.success(
      `Reclamo ${reclamo.numeroReclamo}: aceptado con CRÉDITO a favor · S/ ${montoAcordadoPEN.toFixed(2)} en CC de ${reclamo.destinatarioNombre}`,
    );
    await syncIncidenciasEnvio(
      { ...reclamo, estado: 'cobrado', tipoResolucion: tipoRes, montoAcordadoPEN, montoCobradoPEN: 0 } as Reclamo,
      userId,
    );

    return { movimientoCCId: ccResult.movimientoId };
  },

  /**
   * aceptado → cobrado
   * Crea movimiento de tesorería (ingreso_otro) con el monto efectivamente cobrado.
   */
  async registrarCobro(
    id: string,
    cobro: {
      cuentaId: string;
      metodoPago: MetodoTesoreria;
      montoCobradoPEN: number;
      fecha?: Date;
      referencia?: string;
      notas?: string;
    },
    userId: string,
  ): Promise<void> {
    const reclamo = await this.getById(id);
    if (!reclamo) throw new Error('Reclamo no encontrado');
    if (reclamo.estado !== 'aceptado') {
      throw new Error(`Solo se pueden cobrar reclamos aceptados (actual: ${reclamo.estado})`);
    }
    if (cobro.montoCobradoPEN <= 0) throw new Error('Monto cobrado debe ser > 0');

    const fecha = cobro.fecha || new Date();

    // 1. F4b.1 · ADR-PF-001 · escribe al libro mayor unificado
    const { registrarMovimientoFinanciero } = await import(
      './movimientoFinanciero.service'
    );
    const movimientoId = await registrarMovimientoFinanciero(
      {
        categoria: 'reembolso_recibido',
        moneda: 'PEN',
        monto: cobro.montoCobradoPEN,
        tipoCambio: 1,
        metodo: cobro.metodoPago,
        concepto: `Cobro Reclamo ${reclamo.numeroReclamo} — ${reclamo.destinatarioNombre}`,
        fecha,
        productoDestinoId: cobro.cuentaId,
        referencia: cobro.referencia || reclamo.numeroReclamo,
        notas: cobro.notas,
      },
      userId,
    );

    // 2. Actualizar reclamo a cobrado
    const now = Timestamp.now();
    const evento = buildEvento(
      'cobrado',
      `Cobrado S/ ${cobro.montoCobradoPEN.toFixed(2)} vía ${cobro.metodoPago}. Ingreso registrado en tesorería.`,
      userId,
      {
        estadoAnterior: 'aceptado',
        nuevoEstado: 'cobrado',
        montoPEN: cobro.montoCobradoPEN,
        cuentaId: cobro.cuentaId,
        movimientoTesoreriaId: movimientoId,
      },
    );
    const updates = removeUndefined({
      estado: 'cobrado' as EstadoReclamo,
      montoCobradoPEN: cobro.montoCobradoPEN,
      cuentaCobroId: cobro.cuentaId,
      movimientoTesoreriaId: movimientoId,
      fechaCobro: Timestamp.fromDate(fecha),
      fechaCierre: now,
      actualizadoPor: userId,
      fechaActualizacion: now,
      cerradoPor: userId,
      historial: arrayUnion(evento),
    });
    await updateDoc(doc(db, COLL, id), updates);

    // S55 Fase 6 — Crear movimiento `credito_reclamo` en CC del destinatario.
    // El destinatario (proveedor/colaborador/cliente) "pagó" un reclamo —
    // este crédito refleja la recuperación financiera vinculada a ese
    // destinatario. Útil para reportes "cuánto me ha pagado X en reclamos
    // históricos", aging, etc.
    // No bloqueante: si falla, el cobro queda registrado.
    if (reclamo.destinatarioId && cobro.montoCobradoPEN > 0) {
      const tipoCC = mapDestinatarioReclamoATipoCC(reclamo.destinatario);
      if (tipoCC) {
        try {
          const { cuentaCorrienteService } = await import('./cuentaCorriente.service');
          await cuentaCorrienteService.registrarMovimiento(
            {
              entidadId: reclamo.destinatarioId,
              tipo: tipoCC,
              entidadNombre: reclamo.destinatarioNombre,
              tipoMovimiento: 'credito_reclamo',
              descripcion: `Cobro reclamo ${reclamo.numeroReclamo} (${reclamo.tipo}) · S/ ${cobro.montoCobradoPEN.toFixed(2)}`,
              moneda: 'PEN',
              monto: cobro.montoCobradoPEN,
              fecha,
              refDocumentoTipo: 'reclamo',
              refDocumentoId: id,
              refDocumentoNumero: reclamo.numeroReclamo,
              movimientoTesoreriaId: movimientoId,
              notas: cobro.notas,
              idempotencyKey: `cobrar_reclamo_${id}`,
            },
            userId,
          );
        } catch (ccErr) {
          logger.warn(
            '[CC] No se pudo crear credito_reclamo (no bloqueante): ' +
              (ccErr instanceof Error ? ccErr.message : String(ccErr)),
          );
        }
      }
    }

    logger.success(`Reclamo ${reclamo.numeroReclamo}: COBRADO S/ ${cobro.montoCobradoPEN.toFixed(2)} → ${cobro.cuentaId}`);
    await syncIncidenciasEnvio(
      { ...reclamo, estado: 'cobrado', montoCobradoPEN: cobro.montoCobradoPEN } as Reclamo,
      userId,
    );
  },

  /**
   * → rechazado (o cerrado_sin_cobrar por timeout).
   * Crea automáticamente un gasto tipo 'merma_transferencia' por el monto reclamado.
   */
  async rechazar(
    id: string,
    motivoRechazo: string,
    userId: string,
    opts?: { porTimeout?: boolean },
  ): Promise<void> {
    const reclamo = await this.getById(id);
    if (!reclamo) throw new Error('Reclamo no encontrado');
    if (!ESTADOS_RECLAMO_ACTIVOS.includes(reclamo.estado)) {
      throw new Error(`No se puede rechazar desde estado ${reclamo.estado}`);
    }

    // 1. Crear gasto contable (merma logística)
    const gastoId = await gastoService.create(
      {
        tipo: 'merma_transferencia',
        categoria: 'GV',
        descripcion: `Reclamo ${reclamo.numeroReclamo} ${opts?.porTimeout ? 'cerrado sin cobrar' : 'rechazado'} — ${motivoRechazo}`,
        moneda: 'PEN',
        montoOriginal: reclamo.montoReclamadoPEN,
        esProrrateable: false,
        fecha: new Date(),
        frecuencia: 'unico',
        estado: 'pendiente',        // Gasto ya reconocido, no implica pago
        impactaCTRU: false,
        notas: `Unidades: ${reclamo.unidadesIds.join(', ')}`,
        lineaNegocioId: reclamo.lineaNegocioId || null,
      },
      userId,
    );

    // 2. Actualizar reclamo a rechazado / cerrado_sin_cobrar
    const nuevoEstado: EstadoReclamo = opts?.porTimeout ? 'cerrado_sin_cobrar' : 'rechazado';
    const now = Timestamp.now();
    const evento = buildEvento(
      opts?.porTimeout ? 'cerrado_sin_cobrar' : 'rechazado',
      opts?.porTimeout
        ? `Cerrado sin cobrar (timeout): ${motivoRechazo}. Gasto de merma S/ ${reclamo.montoReclamadoPEN.toFixed(2)} registrado.`
        : `Rechazado: ${motivoRechazo}. Gasto de merma S/ ${reclamo.montoReclamadoPEN.toFixed(2)} registrado.`,
      userId,
      {
        estadoAnterior: reclamo.estado,
        nuevoEstado,
        motivo: motivoRechazo,
        gastoId,
        montoPEN: reclamo.montoReclamadoPEN,
      },
    );
    const updates = removeUndefined({
      estado: nuevoEstado,
      motivoRechazo,
      gastoId,
      fechaRespuesta: reclamo.fechaRespuesta || now,
      fechaCierre: now,
      actualizadoPor: userId,
      fechaActualizacion: now,
      cerradoPor: userId,
      historial: arrayUnion(evento),
    });
    await updateDoc(doc(db, COLL, id), updates);

    logger.warn(`Reclamo ${reclamo.numeroReclamo}: ${nuevoEstado.toUpperCase()} — pérdida S/ ${reclamo.montoReclamadoPEN.toFixed(2)} registrada como gasto ${gastoId}`);
    await syncIncidenciasEnvio({ ...reclamo, estado: nuevoEstado } as Reclamo, userId);
  },

  /**
   * Atajo: cerrar por timeout.
   */
  async cerrarSinCobrar(id: string, motivo: string, userId: string): Promise<void> {
    return this.rechazar(id, motivo, userId, { porTimeout: true });
  },

  /**
   * Elimina un reclamo en borrador (nunca los confirmados).
   */
  async eliminar(id: string, userId: string): Promise<void> {
    const reclamo = await this.getById(id);
    if (!reclamo) throw new Error('Reclamo no encontrado');
    if (reclamo.estado !== 'borrador') {
      throw new Error('Solo se pueden eliminar reclamos en borrador — para cerrar un reclamo activo usa rechazar/cerrarSinCobrar');
    }

    const batch = writeBatch(db);
    batch.delete(doc(db, COLL, id));
    await batch.commit();
    logger.info(`Reclamo ${reclamo.numeroReclamo}: eliminado (era borrador) por ${userId}`);

    // Limpiar estadoReclamo en incidencias
    const envio = await envioCrudService.getById(reclamo.envioId);
    if (envio) {
      const unidadIdsSet = new Set(reclamo.unidadesIds);
      const incidenciasActualizadas = (envio.incidencias || []).map(inc => {
        if (!inc.unidadId || !unidadIdsSet.has(inc.unidadId)) return inc;
        const { estadoReclamo: _er, montoReclamoPEN: _m, ...rest } = inc as any;
        return rest as IncidenciaEnvio;
      });
      await updateDoc(doc(db, COLLECTIONS.ENVIOS, reclamo.envioId), {
        incidencias: incidenciasActualizadas,
        actualizadoPor: userId,
        fechaActualizacion: Timestamp.now(),
      });
    }
  },
};
