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
} from '../types/reclamo.types';
import { ESTADOS_RECLAMO_ACTIVOS } from '../types/reclamo.types';
import type { MetodoTesoreria } from '../types/tesoreria.types';
import type { IncidenciaEnvio } from '../types/envio.types';

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

    const unidadIdsSet = new Set(reclamo.unidadesIds);
    const incidenciasActualizadas = (envio.incidencias || []).map(inc => {
      if (!inc.unidadId || !unidadIdsSet.has(inc.unidadId)) return inc;
      return {
        ...inc,
        estadoReclamo: nuevoEstadoInc,
        montoReclamoPEN: reclamo.montoReclamadoPEN,
      };
    });

    const envioRef = doc(db, COLLECTIONS.ENVIOS, reclamo.envioId);
    await updateDoc(envioRef, {
      incidencias: incidenciasActualizadas,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });
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
    await updateDoc(doc(db, COLL, id), {
      estado: 'enviado' as EstadoReclamo,
      fechaEnvio: now,
      actualizadoPor: userId,
      fechaActualizacion: now,
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
    await updateDoc(doc(db, COLL, id), {
      estado: 'en_disputa' as EstadoReclamo,
      motivoDisputa,
      fechaRespuesta: now,
      actualizadoPor: userId,
      fechaActualizacion: now,
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
    await updateDoc(doc(db, COLL, id), {
      estado: 'aceptado' as EstadoReclamo,
      montoAcordadoPEN,
      fechaRespuesta: reclamo.fechaRespuesta || now,
      actualizadoPor: userId,
      fechaActualizacion: now,
    });
    logger.success(`Reclamo ${reclamo.numeroReclamo}: aceptado por S/ ${montoAcordadoPEN.toFixed(2)}`);
    await syncIncidenciasEnvio({ ...reclamo, estado: 'aceptado', montoAcordadoPEN }, userId);
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

    // 1. Crear movimiento de tesorería PRIMERO (si falla, el reclamo no cambia)
    const movimientoId = await tesoreriaService.registrarMovimiento(
      {
        tipo: 'ingreso_otro',
        moneda: 'PEN',
        monto: cobro.montoCobradoPEN,
        tipoCambio: 1,
        metodo: cobro.metodoPago,
        concepto: `Cobro Reclamo ${reclamo.numeroReclamo} — ${reclamo.destinatarioNombre}`,
        fecha,
        cuentaDestino: cobro.cuentaId,
        referencia: cobro.referencia || reclamo.numeroReclamo,
        notas: cobro.notas,
      },
      userId,
    );

    // 2. Actualizar reclamo a cobrado
    const now = Timestamp.now();
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
    });
    await updateDoc(doc(db, COLL, id), updates);

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
    const updates = removeUndefined({
      estado: nuevoEstado,
      motivoRechazo,
      gastoId,
      fechaRespuesta: reclamo.fechaRespuesta || now,
      fechaCierre: now,
      actualizadoPor: userId,
      fechaActualizacion: now,
      cerradoPor: userId,
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
