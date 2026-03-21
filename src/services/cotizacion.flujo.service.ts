/**
 * cotizacion.flujo.service.ts
 * State-transition operations: validar, revertirValidacion, comprometerAdelanto,
 * actualizarDiasValidez, actualizarDiasCompromisoEntrega,
 * actualizarTiempoEstimadoImportacion, rechazar, marcarVencida.
 */
import {
  doc,
  updateDoc,
  Timestamp,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTION_NAME } from './cotizacion.shared';
import type {
  Cotizacion,
  EstadoCotizacion,
  ComprometerAdelantoData,
  RechazarCotizacionData,
  AdelantoComprometido,
  MotivoRechazo
} from '../types/cotizacion.types';
import { COLLECTIONS } from '../config/collections';
import { actividadService } from './actividad.service';
import { logger } from '../lib/logger';

// ─── validar ──────────────────────────────────────────────────────────────────

export async function validar(
  id: string,
  userId: string,
  getCotizacionById: (id: string) => Promise<Cotizacion | null>
): Promise<void> {
  try {
    const cotizacion = await getCotizacionById(id);
    if (!cotizacion) throw new Error('Cotización no encontrada');
    if (cotizacion.estado !== 'nueva') throw new Error('Solo se pueden validar cotizaciones nuevas');

    await updateDoc(doc(db, COLLECTION_NAME, id), {
      estado: 'validada' as EstadoCotizacion,
      fechaValidacion: serverTimestamp(),
      validadoPor: userId,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    });

    actividadService.registrar({
      tipo: 'cotizacion_validada',
      mensaje: `Cotización ${cotizacion.numeroCotizacion || id} validada - ${cotizacion.nombreCliente}`,
      userId,
      displayName: userId,
      metadata: { entidadId: id, entidadTipo: 'cotizacion', monto: cotizacion.totalPEN, moneda: 'PEN' }
    }).catch(() => {});
  } catch (error: any) {
    logger.error('Error al validar cotización:', error);
    throw new Error(error.message || 'Error al validar cotización');
  }
}

// ─── revertirValidacion ───────────────────────────────────────────────────────

export async function revertirValidacion(
  id: string,
  userId: string,
  getCotizacionById: (id: string) => Promise<Cotizacion | null>
): Promise<void> {
  try {
    const cotizacion = await getCotizacionById(id);
    if (!cotizacion) throw new Error('Cotización no encontrada');
    if (cotizacion.estado !== 'validada') throw new Error('Solo se pueden revertir cotizaciones validadas');

    await updateDoc(doc(db, COLLECTION_NAME, id), {
      estado: 'nueva' as EstadoCotizacion,
      fechaValidacion: null,
      validadoPor: null,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    });
  } catch (error: any) {
    logger.error('Error al revertir validación:', error);
    throw new Error(error.message || 'Error al revertir validación');
  }
}

// ─── comprometerAdelanto ──────────────────────────────────────────────────────

export async function comprometerAdelanto(
  id: string,
  data: ComprometerAdelantoData,
  userId: string,
  getCotizacionById: (id: string) => Promise<Cotizacion | null>
): Promise<void> {
  try {
    const cotizacion = await getCotizacionById(id);
    if (!cotizacion) throw new Error('Cotización no encontrada');

    const estadosPermitidos: EstadoCotizacion[] = ['nueva', 'validada'];
    if (!estadosPermitidos.includes(cotizacion.estado)) {
      throw new Error('Solo se puede comprometer adelanto en cotizaciones nuevas o validadas');
    }
    if (data.monto <= 0) throw new Error('El monto del adelanto debe ser mayor a 0');
    if (data.monto > cotizacion.totalPEN) throw new Error('El adelanto no puede ser mayor al total');

    const diasParaPagar = data.diasParaPagar || 3;
    const fechaLimitePago = new Date();
    fechaLimitePago.setDate(fechaLimitePago.getDate() + diasParaPagar);

    const adelantoComprometido: AdelantoComprometido = {
      monto: data.monto,
      porcentaje: data.porcentaje,
      fechaCompromiso: Timestamp.now(),
      fechaLimitePago: Timestamp.fromDate(fechaLimitePago),
      registradoPor: userId
    };

    await updateDoc(doc(db, COLLECTION_NAME, id), {
      estado: 'pendiente_adelanto' as EstadoCotizacion,
      fechaCompromisoAdelanto: serverTimestamp(),
      adelantoComprometido,
      diasCompromisoEntrega: cotizacion.diasCompromisoEntrega || 15,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    });
  } catch (error: any) {
    logger.error('Error al comprometer adelanto:', error);
    throw new Error(error.message || 'Error al comprometer adelanto');
  }
}

// ─── actualizarDiasValidez ────────────────────────────────────────────────────

export async function actualizarDiasValidez(
  id: string,
  diasValidez: number,
  userId: string,
  getCotizacionById: (id: string) => Promise<Cotizacion | null>
): Promise<void> {
  try {
    const cotizacion = await getCotizacionById(id);
    if (!cotizacion) throw new Error('Cotización no encontrada');

    const estadosPermitidos: EstadoCotizacion[] = ['nueva', 'validada', 'pendiente_adelanto'];
    if (!estadosPermitidos.includes(cotizacion.estado)) {
      throw new Error('No se puede modificar la validez en este estado');
    }
    if (diasValidez < 1 || diasValidez > 90) {
      throw new Error('Los días de validez deben ser entre 1 y 90');
    }

    const fechaCreacion = cotizacion.fechaCreacion.toDate();
    const nuevaFechaVencimiento = new Date(fechaCreacion);
    nuevaFechaVencimiento.setDate(nuevaFechaVencimiento.getDate() + diasValidez);

    await updateDoc(doc(db, COLLECTION_NAME, id), {
      diasVigencia: diasValidez,
      fechaVencimiento: Timestamp.fromDate(nuevaFechaVencimiento),
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    });
  } catch (error: any) {
    logger.error('Error al actualizar días de validez:', error);
    throw new Error(error.message || 'Error al actualizar días de validez');
  }
}

// ─── actualizarDiasCompromisoEntrega ─────────────────────────────────────────

export async function actualizarDiasCompromisoEntrega(
  id: string,
  diasCompromisoEntrega: number,
  userId: string,
  getCotizacionById: (id: string) => Promise<Cotizacion | null>
): Promise<void> {
  try {
    const cotizacion = await getCotizacionById(id);
    if (!cotizacion) throw new Error('Cotización no encontrada');

    const estadosPermitidos: EstadoCotizacion[] = ['nueva', 'validada', 'pendiente_adelanto', 'adelanto_pagado'];
    if (!estadosPermitidos.includes(cotizacion.estado)) {
      throw new Error('No se puede modificar el compromiso de entrega en este estado');
    }
    if (diasCompromisoEntrega < 1) {
      throw new Error('Los días de compromiso deben ser al menos 1');
    }

    await updateDoc(doc(db, COLLECTION_NAME, id), {
      diasCompromisoEntrega,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    });
  } catch (error: any) {
    logger.error('Error al actualizar días de compromiso:', error);
    throw new Error(error.message || 'Error al actualizar días de compromiso');
  }
}

// ─── actualizarTiempoEstimadoImportacion ─────────────────────────────────────

export async function actualizarTiempoEstimadoImportacion(
  id: string,
  tiempoEstimadoImportacion: number,
  userId: string,
  getCotizacionById: (id: string) => Promise<Cotizacion | null>
): Promise<void> {
  try {
    const cotizacion = await getCotizacionById(id);
    if (!cotizacion) throw new Error('Cotización no encontrada');

    const estadosPermitidos: EstadoCotizacion[] = ['nueva', 'validada', 'pendiente_adelanto', 'adelanto_pagado'];
    if (!estadosPermitidos.includes(cotizacion.estado)) {
      throw new Error('No se puede modificar el tiempo estimado en este estado');
    }
    if (tiempoEstimadoImportacion < 1) {
      throw new Error('El tiempo estimado debe ser al menos 1 día');
    }

    await updateDoc(doc(db, COLLECTION_NAME, id), {
      tiempoEstimadoImportacion,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    });
  } catch (error: any) {
    logger.error('Error al actualizar tiempo estimado:', error);
    throw new Error(error.message || 'Error al actualizar tiempo estimado');
  }
}

// ─── rechazar ─────────────────────────────────────────────────────────────────

export async function rechazar(
  id: string,
  data: RechazarCotizacionData,
  userId: string,
  getCotizacionById: (id: string) => Promise<Cotizacion | null>
): Promise<void> {
  try {
    const cotizacion = await getCotizacionById(id);
    if (!cotizacion) throw new Error('Cotización no encontrada');
    if (cotizacion.estado === 'confirmada') {
      throw new Error('No se puede rechazar una cotización confirmada');
    }

    const batch = writeBatch(db);

    if (cotizacion.reservaStock?.productosReservados) {
      for (const prod of cotizacion.reservaStock.productosReservados) {
        for (const unidadId of prod.unidadesReservadas) {
          const unidadRef = doc(db, COLLECTIONS.UNIDADES, unidadId);
          batch.update(unidadRef, {
            estado: 'disponible_peru',
            reservadaPara: null,
            reservadoPara: null,
            fechaReserva: null
          });
        }
      }
    }

    const cotizacionRef = doc(db, COLLECTION_NAME, id);
    batch.update(cotizacionRef, {
      estado: 'rechazada' as EstadoCotizacion,
      fechaRechazo: serverTimestamp(),
      rechazo: {
        motivo: data.motivo,
        descripcion: data.descripcion || null,
        precioEsperado: data.precioEsperado || null,
        competidor: data.competidor || null,
        fechaRechazo: serverTimestamp(),
        registradoPor: userId
      },
      reservaStock: null,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    });

    await batch.commit();
  } catch (error: any) {
    logger.error('Error al rechazar cotización:', error);
    throw new Error(error.message || 'Error al rechazar cotización');
  }
}

// ─── marcarVencida ────────────────────────────────────────────────────────────

export async function marcarVencida(
  id: string,
  userId: string,
  getCotizacionById: (id: string) => Promise<Cotizacion | null>
): Promise<void> {
  try {
    const cotizacion = await getCotizacionById(id);
    if (!cotizacion) throw new Error('Cotización no encontrada');

    const estadosQueVencen: EstadoCotizacion[] = ['nueva', 'validada', 'pendiente_adelanto'];
    if (!estadosQueVencen.includes(cotizacion.estado)) {
      throw new Error('Solo cotizaciones nuevas, validadas o pendientes de adelanto pueden vencer');
    }

    await updateDoc(doc(db, COLLECTION_NAME, id), {
      estado: 'vencida' as EstadoCotizacion,
      rechazo: {
        motivo: 'sin_respuesta' as MotivoRechazo,
        descripcion: 'Cotización vencida sin respuesta del cliente',
        fechaRechazo: serverTimestamp(),
        registradoPor: userId
      },
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    });
  } catch (error: any) {
    logger.error('Error al marcar como vencida:', error);
    throw new Error(error.message || 'Error al marcar como vencida');
  }
}
