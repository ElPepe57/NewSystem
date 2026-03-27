import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  deleteField
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import type {
  Transferencia,
  TransferenciaFormData,
  TransferenciaUnidad,
  RecepcionFormData,
  RecepcionTransferencia,
  TransferenciaFiltros,
  ResumenTransferencias,
  EstadoTransferencia,
  PagoViajero
} from '../types/transferencia.types';
import type { Unidad, MovimientoUnidad, EstadoUnidad } from '../types/unidad.types';
import { ESTADOS_EN_ORIGEN } from '../types/unidad.types';
import { TIPOS_TRANSFERENCIA_INTERNA, TIPOS_TRANSFERENCIA_INTERNACIONAL } from '../types/transferencia.types';
import { esTipoTransferenciaInterna, esTipoTransferenciaInternacional, esEstadoEnOrigen } from '../utils/multiOrigen.helpers';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import { almacenService } from './almacen.service';
import { ProductoService } from './producto.service';
import { tesoreriaService } from './tesoreria.service';
import { inventarioService } from './inventario.service';
import type { MetodoTesoreria } from '../types/tesoreria.types';

const COLLECTION_NAME = COLLECTIONS.TRANSFERENCIAS;
const UNIDADES_COLLECTION = COLLECTIONS.UNIDADES;

/**
 * Helper: obtiene pagos como array (backward compat con pagoViajero singular)
 */
function getPagosArray(transferencia: Transferencia): PagoViajero[] {
  if (transferencia.pagosViajero && transferencia.pagosViajero.length > 0) {
    return transferencia.pagosViajero;
  }
  if (transferencia.pagoViajero) {
    return [transferencia.pagoViajero];
  }
  return [];
}

/**
 * Helper: obtiene recepciones como array (backward compat con recepcion singular)
 */
function getRecepcionesArray(transferencia: Transferencia): RecepcionTransferencia[] {
  if (transferencia.recepcionesTransferencia && transferencia.recepcionesTransferencia.length > 0) {
    return transferencia.recepcionesTransferencia;
  }
  if (transferencia.recepcion) {
    return [{
      ...transferencia.recepcion,
      id: 'REC-TRF-legacy',
      numero: 1,
      unidadesProcesadas: []
    }];
  }
  return [];
}

/**
 * Helper: identifica unidades pendientes de recepcion
 * Estados válidos: 'pendiente' (legacy, pre-envio), 'enviada' (en tránsito), 'faltante' (retry)
 */
function getUnidadesPendientesRecepcion(transferencia: Transferencia): TransferenciaUnidad[] {
  return transferencia.unidades.filter(
    u => u.estadoTransferencia === 'enviada' || u.estadoTransferencia === 'faltante'
      || u.estadoTransferencia === 'pendiente'
  );
}

/**
 * Genera el siguiente número de transferencia
 */
async function generarNumeroTransferencia(tipo: 'interna_usa' | 'usa_peru' | 'interna_origen' | 'internacional_peru'): Promise<string> {
  const esInterna = tipo === 'interna_usa' || tipo === 'interna_origen';
  const prefix = esInterna ? 'TRF' : 'ENV';
  const year = new Date().getFullYear();

  return getNextSequenceNumber(`${prefix}-${year}`, 3);
}

export const transferenciaService = {
  // ============================================
  // CRUD BÁSICO
  // ============================================

  async getAll(): Promise<Transferencia[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('fechaCreacion', 'desc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Transferencia));
  },

  async getById(id: string): Promise<Transferencia | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    } as Transferencia;
  },

  async getByNumero(numero: string): Promise<Transferencia | null> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('numeroTransferencia', '==', numero)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const docSnap = snapshot.docs[0];
    return {
      id: docSnap.id,
      ...docSnap.data()
    } as Transferencia;
  },

  // ============================================
  // FILTROS
  // ============================================

  async getByFiltros(filtros: TransferenciaFiltros): Promise<Transferencia[]> {
    let q = query(collection(db, COLLECTION_NAME));

    if (filtros.tipo) {
      // Use arrays for backward compat (match both legacy and generic types)
      if (esTipoTransferenciaInterna(filtros.tipo)) {
        q = query(q, where('tipo', 'in', TIPOS_TRANSFERENCIA_INTERNA));
      } else if (esTipoTransferenciaInternacional(filtros.tipo)) {
        q = query(q, where('tipo', 'in', TIPOS_TRANSFERENCIA_INTERNACIONAL));
      } else {
        q = query(q, where('tipo', '==', filtros.tipo));
      }
    }

    if (filtros.estado) {
      q = query(q, where('estado', '==', filtros.estado));
    }

    if (filtros.almacenOrigenId) {
      q = query(q, where('almacenOrigenId', '==', filtros.almacenOrigenId));
    }

    if (filtros.almacenDestinoId) {
      q = query(q, where('almacenDestinoId', '==', filtros.almacenDestinoId));
    }

    if (filtros.viajeroId) {
      q = query(q, where('viajeroId', '==', filtros.viajeroId));
    }

    const snapshot = await getDocs(q);
    let transferencias = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Transferencia));

    // Filtros adicionales en memoria
    if (filtros.fechaDesde) {
      const desde = Timestamp.fromDate(filtros.fechaDesde);
      transferencias = transferencias.filter(t =>
        t.fechaCreacion.toMillis() >= desde.toMillis()
      );
    }

    if (filtros.fechaHasta) {
      const hasta = Timestamp.fromDate(filtros.fechaHasta);
      transferencias = transferencias.filter(t =>
        t.fechaCreacion.toMillis() <= hasta.toMillis()
      );
    }

    if (filtros.conIncidencias) {
      transferencias = transferencias.filter(t =>
        t.recepcion?.incidencias && t.recepcion.incidencias.length > 0
      );
    }

    // Ordenar por fecha descendente
    return transferencias.sort((a, b) =>
      b.fechaCreacion.toMillis() - a.fechaCreacion.toMillis()
    );
  },

  /**
   * Obtiene transferencias en tránsito
   */
  async getEnTransito(): Promise<Transferencia[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('estado', '==', 'en_transito')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Transferencia));
  },

  /**
   * Obtiene transferencias pendientes de recepción
   */
  async getPendientesRecepcion(): Promise<Transferencia[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('estado', 'in', ['en_transito', 'preparando', 'recibida_parcial'])
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Transferencia));
  },

  // ============================================
  // CREAR TRANSFERENCIA
  // ============================================

  /**
   * Crea una nueva transferencia
   */
  async crear(data: TransferenciaFormData, userId: string): Promise<string> {
    const batch = writeBatch(db);

    // Obtener datos de almacenes
    const almacenOrigen = await almacenService.getById(data.almacenOrigenId);
    const almacenDestino = await almacenService.getById(data.almacenDestinoId);

    if (!almacenOrigen || !almacenDestino) {
      throw new Error('Almacén origen o destino no encontrado');
    }

    // Validar que las unidades existan y estén disponibles
    const unidades: TransferenciaUnidad[] = [];
    const productosSummary: Map<string, { productoId: string; sku: string; nombre: string; cantidad: number }> = new Map();

    // Primera pasada: contar unidades por producto y validar
    const unidadesPorProducto: Map<string, { unidades: Unidad[]; count: number }> = new Map();

    for (const unidadId of data.unidadesIds) {
      const unidadRef = doc(db, UNIDADES_COLLECTION, unidadId);
      const unidadSnap = await getDoc(unidadRef);

      if (!unidadSnap.exists()) {
        throw new Error(`Unidad ${unidadId} no encontrada`);
      }

      const unidadData = unidadSnap.data() as Unidad;
      unidadData.id = unidadId; // Asegurar que el ID esté presente

      // Validar que la unidad esté en el almacén origen
      if (unidadData.almacenId !== data.almacenOrigenId) {
        throw new Error(`La unidad ${unidadData.productoSKU} (${unidadData.lote}) no está en el almacén origen`);
      }

      // Validar estado válido para transferir
      // Incluye 'reservada' porque las unidades reservadas en USA para un
      // requerimiento/cotización deben poder transferirse a Perú
      const estadosValidos: EstadoUnidad[] = [...ESTADOS_EN_ORIGEN, 'disponible_peru', 'reservada'];
      if (!estadosValidos.includes(unidadData.estado)) {
        throw new Error(`La unidad ${unidadData.productoSKU} (${unidadData.lote}) no está en estado válido para transferir`);
      }

      // Agrupar por producto
      if (!unidadesPorProducto.has(unidadData.productoId)) {
        unidadesPorProducto.set(unidadData.productoId, { unidades: [], count: 0 });
      }
      const grupo = unidadesPorProducto.get(unidadData.productoId)!;
      grupo.unidades.push(unidadData);
      grupo.count++;

      // Agregar al resumen por producto
      const key = unidadData.productoId;
      if (productosSummary.has(key)) {
        const existing = productosSummary.get(key)!;
        existing.cantidad++;
      } else {
        productosSummary.set(key, {
          productoId: unidadData.productoId,
          sku: unidadData.productoSKU,
          nombre: unidadData.productoNombre,
          cantidad: 1
        });
      }
    }

    // Segunda pasada: calcular costo de flete por unidad basado en el flete por producto
    let costoFleteTotal = 0;

    for (const [productoId, grupo] of unidadesPorProducto) {
      // Obtener el costo de flete total para este producto (ingresado por el usuario)
      const costoFleteProducto = data.costoFletePorProducto?.[productoId] || 0;
      // Calcular costo por unidad para este producto
      const costoPorUnidad = grupo.count > 0 ? costoFleteProducto / grupo.count : 0;

      costoFleteTotal += costoFleteProducto;

      // Agregar cada unidad con su costo de flete calculado
      for (const unidadData of grupo.unidades) {
        unidades.push({
          unidadId: unidadData.id,
          productoId: unidadData.productoId,
          sku: unidadData.productoSKU,
          codigoUnidad: `${unidadData.productoSKU}-${unidadData.lote}`,
          lote: unidadData.lote,
          fechaVencimiento: unidadData.fechaVencimiento,
          costoFleteUSD: costoPorUnidad,
          estadoTransferencia: 'pendiente'
        });
      }
    }

    // Generar número de transferencia
    const numeroTransferencia = await generarNumeroTransferencia(data.tipo);

    // Obtener viajero si aplica
    let viajeroNombre: string | undefined;
    if (data.viajeroId) {
      const viajero = await almacenService.getById(data.viajeroId);
      viajeroNombre = viajero?.nombre;
    }

    // Crear documento de transferencia
    // Construir objeto sin campos undefined (Firestore no los acepta)
    const now = Timestamp.now();
    const nuevaTransferencia: Record<string, unknown> = {
      // Campos requeridos
      numeroTransferencia,
      tipo: data.tipo,
      estado: 'borrador',

      almacenOrigenId: almacenOrigen.id,
      almacenOrigenNombre: almacenOrigen.nombre,
      almacenOrigenCodigo: almacenOrigen.codigo,

      almacenDestinoId: almacenDestino.id,
      almacenDestinoNombre: almacenDestino.nombre,
      almacenDestinoCodigo: almacenDestino.codigo,

      unidades,
      totalUnidades: unidades.length,
      productosSummary: Array.from(productosSummary.values()),

      fechaCreacion: now,
      creadoPor: userId
    };

    // Campos opcionales - solo agregar si tienen valor
    if (esTipoTransferenciaInternacional(data.tipo)) {
      nuevaTransferencia.costoFleteTotal = costoFleteTotal;
      nuevaTransferencia.monedaFlete = 'USD';
    }

    if (data.motivo) {
      nuevaTransferencia.motivo = data.motivo;
    }

    if (data.motivoDetalle) {
      nuevaTransferencia.motivoDetalle = data.motivoDetalle;
    }

    if (data.viajeroId) {
      nuevaTransferencia.viajeroId = data.viajeroId;
    }

    if (viajeroNombre) {
      nuevaTransferencia.viajeroNombre = viajeroNombre;
    }

    if (data.numeroTracking) {
      nuevaTransferencia.numeroTracking = data.numeroTracking;
    }

    if (data.fechaLlegadaEstimada) {
      nuevaTransferencia.fechaLlegadaEstimada = Timestamp.fromDate(data.fechaLlegadaEstimada);
    }

    if (data.notas) {
      nuevaTransferencia.notas = data.notas;
    }

    // Auto-inherit lineaNegocioId from units being transferred
    // Use the first unit that has a lineaNegocioId
    for (const [, grupo] of unidadesPorProducto) {
      const unidadConLinea = grupo.unidades.find(u => u.lineaNegocioId);
      if (unidadConLinea) {
        nuevaTransferencia.lineaNegocioId = unidadConLinea.lineaNegocioId;
        if (unidadConLinea.lineaNegocioNombre) {
          nuevaTransferencia.lineaNegocioNombre = unidadConLinea.lineaNegocioNombre;
        }
        break;
      }
    }

    const transferenciaRef = doc(collection(db, COLLECTION_NAME));
    batch.set(transferenciaRef, nuevaTransferencia);

    await batch.commit();

    return transferenciaRef.id;
  },

  // ============================================
  // CONFIRMAR Y ENVIAR
  // ============================================

  /**
   * Confirma la transferencia y la pone en estado "preparando"
   */
  async confirmar(transferenciaId: string, userId: string): Promise<void> {
    const transferencia = await this.getById(transferenciaId);
    if (!transferencia) {
      throw new Error('Transferencia no encontrada');
    }

    if (transferencia.estado !== 'borrador') {
      throw new Error('Solo se pueden confirmar transferencias en estado borrador');
    }

    const docRef = doc(db, COLLECTION_NAME, transferenciaId);
    await updateDoc(docRef, {
      estado: 'preparando',
      fechaPreparacion: Timestamp.now(),
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now()
    });
  },

  /**
   * Marca la transferencia como enviada (en tránsito)
   */
  async enviar(
    transferenciaId: string,
    datos: { numeroTracking?: string; fechaSalida?: Date },
    userId: string
  ): Promise<void> {
    const transferencia = await this.getById(transferenciaId);
    if (!transferencia) {
      throw new Error('Transferencia no encontrada');
    }

    if (transferencia.estado !== 'preparando') {
      throw new Error('Solo se pueden enviar transferencias en estado preparando');
    }

    const batch = writeBatch(db);
    const now = Timestamp.now();
    const fechaSalida = datos.fechaSalida ? Timestamp.fromDate(datos.fechaSalida) : now;

    // Actualizar estadoTransferencia de cada unidad en el doc de transferencia a 'enviada'
    const unidadesEnviadas = transferencia.unidades.map(u => ({
      ...u,
      estadoTransferencia: 'enviada' as const,
    }));

    // Actualizar transferencia
    const transferenciaRef = doc(db, COLLECTION_NAME, transferenciaId);
    const transferenciaUpdate: Record<string, unknown> = {
      estado: 'en_transito',
      fechaSalida,
      unidades: unidadesEnviadas,
      actualizadoPor: userId,
      fechaActualizacion: now
    };

    // Solo incluir numeroTracking si tiene valor
    const trackingNumber = datos.numeroTracking || transferencia.numeroTracking;
    if (trackingNumber) {
      transferenciaUpdate.numeroTracking = trackingNumber;
    }

    batch.update(transferenciaRef, transferenciaUpdate);

    // Actualizar estado de cada unidad
    const estadoNuevo: EstadoUnidad = esTipoTransferenciaInternacional(transferencia.tipo)
      ? 'en_transito_peru'
      : 'en_transito_origen';

    for (const unidad of transferencia.unidades) {
      const unidadRef = doc(db, UNIDADES_COLLECTION, unidad.unidadId);
      const unidadSnap = await getDoc(unidadRef);

      if (unidadSnap.exists()) {
        const unidadData = unidadSnap.data() as Unidad;
        const estadoAnterior = unidadData.estado;

        // Crear movimiento en historial
        const nuevoMovimiento: MovimientoUnidad = {
          id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tipo: 'transferencia',
          fecha: now,
          almacenOrigen: transferencia.almacenOrigenId,
          almacenDestino: transferencia.almacenDestinoId,
          usuarioId: userId,
          observaciones: `Envío ${esTipoTransferenciaInternacional(transferencia.tipo) ? 'Internacional → Perú' : 'interno origen'}. Estado: ${estadoAnterior} → ${estadoNuevo}`,
          documentoRelacionado: {
            tipo: 'transferencia',
            id: transferenciaId,
            numero: transferencia.numeroTransferencia
          }
        };

        const unidadUpdate: Record<string, unknown> = {
          estado: estadoNuevo,
          // Guardar estado previo para rollback en caso de faltante
          estadoAntesDeTransferencia: estadoAnterior,
          transferenciaActualId: transferenciaId,
          numeroTransferencia: transferencia.numeroTransferencia,
          // NOTA: reservadaPara se preserva implícitamente (updateDoc no borra campos no mencionados)
          movimientos: [...(unidadData.movimientos || []), nuevoMovimiento],
          actualizadoPor: userId,
          fechaActualizacion: now
        };

        // Solo incluir fechaSalidaOrigen para transferencias internacionales
        if (esTipoTransferenciaInternacional(transferencia.tipo)) {
          unidadUpdate.fechaSalidaOrigen = fechaSalida;
        }

        batch.update(unidadRef, unidadUpdate);
      }
    }

    await batch.commit();

    // Actualizar métricas del almacén origen
    await almacenService.incrementarUnidadesEnviadas(
      transferencia.almacenOrigenId,
      transferencia.totalUnidades
    );

    // Sincronizar stock de productos afectados (después del commit para reflejar cambios reales)
    const productosAfectados = [...new Set(transferencia.unidades.map(u => u.productoId))];
    await inventarioService.sincronizarStockProductos_batch(productosAfectados);

    // ML sync (fire-and-forget)
    import('./mercadoLibre.service').then(({ mercadoLibreService }) => {
      for (const pid of productosAfectados) {
        mercadoLibreService.syncStock(pid).catch(e =>
          logger.error(`[ML Sync] Error post-envío transferencia ${pid}:`, e)
        );
      }
    });
  },

  // ============================================
  // RECEPCIÓN
  // ============================================

  /**
   * Registra la recepción de una transferencia (soporta múltiples recepciones parciales)
   * - Primera recepción: en_transito → recibida_parcial o recibida_completa
   * - Recepciones adicionales: recibida_parcial → recibida_parcial o recibida_completa
   */
  async registrarRecepcion(data: RecepcionFormData, userId: string): Promise<void> {
    const transferencia = await this.getById(data.transferenciaId);
    if (!transferencia) {
      throw new Error('Transferencia no encontrada');
    }

    // Permitir en_transito (primera recepcion) Y recibida_parcial (recepciones adicionales)
    if (transferencia.estado !== 'en_transito' && transferencia.estado !== 'recibida_parcial') {
      throw new Error('Solo se pueden recibir transferencias en tránsito o con recepción parcial');
    }

    // Re-fetch almacén destino para obtener datos actualizados (el ID/nombre pudo cambiar post-migración)
    const almacenDestino = await almacenService.getById(transferencia.almacenDestinoId);
    const almacenDestinoId = almacenDestino?.id || transferencia.almacenDestinoId;
    const almacenDestinoNombre = almacenDestino?.nombre || transferencia.almacenDestinoNombre;

    // Validar que las unidades enviadas están realmente pendientes
    const unidadesPendientes = getUnidadesPendientesRecepcion(transferencia);
    const idsPendientes = new Set(unidadesPendientes.map(u => u.unidadId));
    for (const ur of data.unidadesRecibidas) {
      if (!idsPendientes.has(ur.unidadId)) {
        throw new Error(`Unidad ${ur.unidadId.slice(0, 8)}... ya fue procesada en una recepción anterior`);
      }
    }

    const batch = writeBatch(db);
    const now = Timestamp.now();
    const esPrimeraRecepcion = transferencia.estado === 'en_transito';

    // Contadores de ESTA recepcion
    let recEnEsta = 0;
    let faltEnEsta = 0;
    let danEnEsta = 0;

    // Clonar array de unidades completo para actualizar
    const unidadesActualizadas = [...transferencia.unidades];
    const unidadesProcesadas: NonNullable<RecepcionTransferencia['unidadesProcesadas']> = [];

    // C3: Calcular costo de recojo prorrateado por unidad recibida en esta recepción
    const unidadesRecibidasCount = data.unidadesRecibidas.filter(u => u.recibida).length;
    const costoRecojoPorUnidad = (data.costoRecojoPEN && unidadesRecibidasCount > 0)
      ? data.costoRecojoPEN / unidadesRecibidasCount
      : 0;
    // Enrich data with calculated per-unit cost for use in the loop
    const dataConRecojo = { ...data, costoRecojoPorUnidad };

    for (const unidadRecepcion of dataConRecojo.unidadesRecibidas) {
      const idx = unidadesActualizadas.findIndex(u => u.unidadId === unidadRecepcion.unidadId);
      if (idx === -1) continue;

      const unidadTransferencia = unidadesActualizadas[idx];
      let estadoTransferencia: TransferenciaUnidad['estadoTransferencia'];
      let resultado: 'recibida' | 'faltante' | 'danada';

      if (!unidadRecepcion.recibida) {
        estadoTransferencia = 'faltante'; resultado = 'faltante'; faltEnEsta++;
      } else if (unidadRecepcion.danada) {
        estadoTransferencia = 'danada'; resultado = 'danada'; danEnEsta++; recEnEsta++;
      } else {
        estadoTransferencia = 'recibida'; resultado = 'recibida'; recEnEsta++;
      }

      // Actualizar unidad en el array de la transferencia
      unidadesActualizadas[idx] = {
        ...unidadTransferencia,
        estadoTransferencia,
        ...(unidadRecepcion.incidencia ? { incidencia: unidadRecepcion.incidencia } : {})
      };

      unidadesProcesadas.push({
        unidadId: unidadRecepcion.unidadId,
        resultado,
        ...(unidadRecepcion.incidencia ? { incidencia: unidadRecepcion.incidencia } : {})
      });

      // Actualizar documento de Unidad en Firestore
      const unidadRef = doc(db, UNIDADES_COLLECTION, unidadRecepcion.unidadId);
      const unidadSnap = await getDoc(unidadRef);

      if (unidadSnap.exists()) {
        const unidadData = unidadSnap.data() as Unidad;
        const estadoAnterior = unidadData.estado;

        if (unidadRecepcion.recibida) {
          // Unidad recibida (OK o dañada) — mover al almacén destino
          const estabaReservada = unidadData.reservadaPara || (unidadData as any).reservadoPara;

          let estadoNuevo: EstadoUnidad;
          if (unidadRecepcion.danada) {
            estadoNuevo = 'danada';
          } else if (estabaReservada) {
            estadoNuevo = 'reservada';
          } else if (esTipoTransferenciaInternacional(transferencia.tipo)) {
            estadoNuevo = 'disponible_peru';
          } else {
            estadoNuevo = 'recibida_origen';
          }

          const observacion = unidadRecepcion.incidencia
            ? `Recepción ${esTipoTransferenciaInternacional(transferencia.tipo) ? 'en Perú' : 'en origen'}. Incidencia: ${unidadRecepcion.incidencia}`
            : `Recepción ${esTipoTransferenciaInternacional(transferencia.tipo) ? 'en Perú' : 'en origen'}. Estado: ${estadoAnterior} → ${estadoNuevo}`;

          const nuevoMovimiento: MovimientoUnidad = {
            id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            tipo: 'transferencia',
            fecha: now,
            almacenOrigen: transferencia.almacenOrigenId,
            almacenDestino: transferencia.almacenDestinoId,
            usuarioId: userId,
            observaciones: observacion,
            documentoRelacionado: {
              tipo: 'transferencia',
              id: data.transferenciaId,
              numero: transferencia.numeroTransferencia
            }
          };

          const updateData: Record<string, unknown> = {
            estado: estadoNuevo,
            almacenId: almacenDestinoId,
            almacenNombre: almacenDestinoNombre,
            pais: esTipoTransferenciaInternacional(transferencia.tipo) ? 'Peru' : (unidadData.pais || almacenDestino?.pais || 'USA'),
            estadoAntesDeTransferencia: deleteField(),
            transferenciaActualId: deleteField(),
            numeroTransferencia: deleteField(),
            movimientos: [...(unidadData.movimientos || []), nuevoMovimiento],
            actualizadoPor: userId,
            fechaActualizacion: now
          };

          // Aplicar fecha de vencimiento: prioridad unidadId > productoId (backward compat)
          const fvByUnit = data.fechasVencimiento?.[unidadTransferencia.unidadId];
          const fvByProduct = data.fechasVencimiento?.[unidadTransferencia.productoId]
            || data.fechasVencimientoPorProducto?.[unidadTransferencia.productoId];
          const fvStr = fvByUnit || fvByProduct;
          if (fvStr) {
            updateData.fechaVencimiento = Timestamp.fromDate(new Date(fvStr + 'T00:00:00'));
          }

          if (esTipoTransferenciaInternacional(transferencia.tipo)) {
            updateData.fechaLlegadaPeru = now;
            const costoFleteUSD = unidadTransferencia.costoFleteUSD ?? 0;
            updateData.costoFleteUSD = costoFleteUSD;

            // C3: Recojo en Perú — prorrateado por esta recepción parcial
            const costoRecojoPEN = dataConRecojo.costoRecojoPorUnidad ?? 0;
            if (costoRecojoPEN > 0) {
              updateData.costoRecojoPEN = costoRecojoPEN;
              updateData.transferenciaRecojoId = transferencia.id;
            }

            // Recalcular ctruInicial incluyendo C3
            const tc = unidadData.tcPago || unidadData.tcCompra || 0;
            const costoBasePEN = (unidadData.costoUnitarioUSD || 0) * tc;
            const costoFletePEN = costoFleteUSD * tc;
            const nuevoCtruInicial = costoBasePEN + costoFletePEN + costoRecojoPEN;

            if (costoFleteUSD > 0 || costoRecojoPEN > 0) {
              updateData.ctruInicial = nuevoCtruInicial;
              updateData.ctruContable = nuevoCtruInicial;
              updateData.ctruGerencial = nuevoCtruInicial;
              if (!(unidadData as any).costoGAGOAsignado || (unidadData as any).costoGAGOAsignado === 0) {
                updateData.ctruDinamico = nuevoCtruInicial;
              }
            }
          }

          batch.update(unidadRef, updateData);
        } else {
          // Unidad faltante — marcar como faltante y devolver al almacén origen
          const nuevoMovimiento: MovimientoUnidad = {
            id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            tipo: 'transferencia',
            fecha: now,
            almacenOrigen: transferencia.almacenOrigenId,
            almacenDestino: transferencia.almacenDestinoId,
            usuarioId: userId,
            observaciones: `Faltante en recepción ${esTipoTransferenciaInternacional(transferencia.tipo) ? 'Perú' : 'origen'}. Unidad no recibida — devuelta a origen.`,
            documentoRelacionado: {
              tipo: 'transferencia',
              id: data.transferenciaId,
              numero: transferencia.numeroTransferencia
            }
          };

          // Faltante: devolver al estado previo a la transferencia (guardado en enviar)
          const estadoRollback: EstadoUnidad = (unidadData as any).estadoAntesDeTransferencia
            || (estadoAnterior.startsWith('en_transito')
              ? (unidadData.pais === 'Peru' ? 'disponible_peru' : 'recibida_origen')
              : estadoAnterior);
          batch.update(unidadRef, {
            estado: estadoRollback,
            estadoAntesDeTransferencia: deleteField(),
            transferenciaActualId: deleteField(),
            numeroTransferencia: deleteField(),
            movimientos: [...(unidadData.movimientos || []), nuevoMovimiento],
            actualizadoPor: userId,
            fechaActualizacion: now
          });
        }
      }
    }

    // Calcular totales acumulados desde array de unidades actualizado
    const totalRecibidas = unidadesActualizadas.filter(u => u.estadoTransferencia === 'recibida').length;
    const totalFaltantes = unidadesActualizadas.filter(u => u.estadoTransferencia === 'faltante').length;
    const totalDanadas = unidadesActualizadas.filter(u => u.estadoTransferencia === 'danada').length;
    const totalPendientes = unidadesActualizadas.filter(
      u => u.estadoTransferencia === 'enviada' || u.estadoTransferencia === 'pendiente'
    ).length;

    // Estado: recibida_completa solo cuando NO quedan pendientes ni faltante
    const estadoFinal: EstadoTransferencia =
      (totalPendientes === 0 && totalFaltantes === 0) ? 'recibida_completa' : 'recibida_parcial';

    const diasEnTransito = transferencia.fechaSalida
      ? Math.ceil((now.toMillis() - transferencia.fechaSalida.toMillis()) / (1000 * 60 * 60 * 24))
      : 0;

    // Construir nuevo registro de recepcion
    const recepcionesAnteriores = getRecepcionesArray(transferencia);
    const recepcionNumero = recepcionesAnteriores.filter(r => r.id !== 'REC-TRF-legacy').length + 1;

    const nuevaRecepcion: Record<string, unknown> = {
      id: `REC-TRF-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      numero: recepcionNumero,
      fechaRecepcion: now,
      recibidoPor: userId,
      unidadesEsperadas: transferencia.totalUnidades,
      unidadesRecibidas: recEnEsta,
      unidadesFaltantes: faltEnEsta,
      unidadesDanadas: danEnEsta,
      unidadesProcesadas
    };
    if (data.observaciones) nuevaRecepcion.observaciones = data.observaciones;
    if (data.fotoEvidencia) nuevaRecepcion.fotoEvidencia = data.fotoEvidencia;

    const nuevasRecepciones = [
      ...recepcionesAnteriores.filter(r => r.id !== 'REC-TRF-legacy'),
      nuevaRecepcion
    ];

    // Legacy recepcion field (cumulative snapshot for backwards compat)
    const recepcionLegacy: Record<string, unknown> = {
      fechaRecepcion: now,
      recibidoPor: userId,
      unidadesEsperadas: transferencia.totalUnidades,
      unidadesRecibidas: totalRecibidas,
      unidadesFaltantes: totalFaltantes,
      unidadesDanadas: totalDanadas
    };
    if (data.observaciones) recepcionLegacy.observaciones = data.observaciones;

    // Construir update de transferencia
    const transferenciaRef = doc(db, COLLECTION_NAME, data.transferenciaId);
    const transferenciaUpdate: Record<string, unknown> = {
      estado: estadoFinal,
      diasEnTransito,
      unidades: unidadesActualizadas,
      recepcion: recepcionLegacy,
      recepcionesTransferencia: nuevasRecepciones,
      totalUnidadesRecibidas: totalRecibidas,
      totalUnidadesFaltantes: totalFaltantes,
      totalUnidadesDanadas: totalDanadas,
      actualizadoPor: userId,
      fechaActualizacion: now
    };

    // Solo setear fechaLlegadaReal en la PRIMERA recepcion
    if (esPrimeraRecepcion) {
      transferenciaUpdate.fechaLlegadaReal = now;
    }

    batch.update(transferenciaRef, transferenciaUpdate);

    // Sincronizar stock de productos afectados (recibidos + faltantes devueltos a origen)
    const productosAfectados = [...new Set(
      data.unidadesRecibidas
        .map(ur => {
          const u = transferencia.unidades.find(tu => tu.unidadId === ur.unidadId);
          return u?.productoId;
        })
        .filter(Boolean) as string[]
    )];

    await batch.commit();

    // Actualizar métricas del almacén destino (solo las de ESTA recepcion)
    await almacenService.incrementarUnidadesRecibidas(
      transferencia.almacenDestinoId,
      recEnEsta
    );

    if (productosAfectados.length > 0) {
      await inventarioService.sincronizarStockProductos_batch(productosAfectados);
    }
  },

  // ============================================
  // CANCELAR
  // ============================================

  /**
   * Cancela una transferencia
   */
  async cancelar(transferenciaId: string, motivo: string, userId: string): Promise<void> {
    const transferencia = await this.getById(transferenciaId);
    if (!transferencia) {
      throw new Error('Transferencia no encontrada');
    }

    const estadosCancelables: EstadoTransferencia[] = ['borrador', 'preparando'];
    if (!estadosCancelables.includes(transferencia.estado)) {
      throw new Error('Solo se pueden cancelar transferencias en borrador o preparando');
    }

    const docRef = doc(db, COLLECTION_NAME, transferenciaId);
    await updateDoc(docRef, {
      estado: 'cancelada',
      notas: `${transferencia.notas || ''}\n[CANCELADA] ${motivo}`.trim(),
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now()
    });
  },

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  async getResumen(): Promise<ResumenTransferencias> {
    const todas = await this.getAll();
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const enTransito = todas.filter(t => t.estado === 'en_transito');
    const pendientesRecepcion = todas.filter(t =>
      t.estado === 'en_transito' || t.estado === 'preparando' || t.estado === 'recibida_parcial'
    );
    const completadasMes = todas.filter(t =>
      (t.estado === 'recibida_completa' || t.estado === 'recibida_parcial') &&
      t.fechaLlegadaReal &&
      t.fechaLlegadaReal.toDate() >= inicioMes
    );

    const internasUSA = todas.filter(t => esTipoTransferenciaInterna(t.tipo)).length;
    const enviosUSAPeru = todas.filter(t => esTipoTransferenciaInternacional(t.tipo)).length;

    // Unidades en tránsito
    const unidadesEnTransitoUSA = enTransito
      .filter(t => esTipoTransferenciaInterna(t.tipo))
      .reduce((sum, t) => sum + t.totalUnidades, 0);

    const unidadesEnTransitoPeru = enTransito
      .filter(t => esTipoTransferenciaInternacional(t.tipo))
      .reduce((sum, t) => sum + t.totalUnidades, 0);

    // Tiempo promedio de tránsito internacional
    const enviosCompletados = todas.filter(t =>
      esTipoTransferenciaInternacional(t.tipo) &&
      t.diasEnTransito !== undefined
    );
    const tiempoPromedioTransitoUSAPeru = enviosCompletados.length > 0
      ? enviosCompletados.reduce((sum, t) => sum + (t.diasEnTransito || 0), 0) / enviosCompletados.length
      : 0;

    // Incidencias del mes
    const conIncidenciasMes = completadasMes.filter(t =>
      t.recepcion?.incidencias && t.recepcion.incidencias.length > 0
    );

    const unidadesFaltantesMes = completadasMes.reduce(
      (sum, t) => sum + (t.recepcion?.unidadesFaltantes || 0), 0
    );

    const unidadesDanadasMes = completadasMes.reduce(
      (sum, t) => sum + (t.recepcion?.unidadesDanadas || 0), 0
    );

    return {
      totalTransferencias: todas.length,
      enTransito: enTransito.length,
      pendientesRecepcion: pendientesRecepcion.length,
      completadasMes: completadasMes.length,
      internasUSA,
      enviosUSAPeru,
      unidadesEnTransitoUSA,
      unidadesEnTransitoPeru,
      tiempoPromedioTransitoUSAPeru: Math.round(tiempoPromedioTransitoUSAPeru * 10) / 10,
      transferenciasConIncidencias: conIncidenciasMes.length,
      unidadesFaltantesMes,
      unidadesDanadasMes
    };
  },

  // ============================================
  // MIGRACIÓN - Actualizar costoFleteUSD en unidades existentes
  // ============================================

  /**
   * Migra las unidades existentes para agregar el costoFleteUSD
   * basándose en las transferencias USA→Perú completadas
   * @returns Número de unidades actualizadas
   */
  async migrarCostoFleteUnidades(): Promise<{ actualizadas: number; errores: number }> {
    try {
      // Obtener todas las transferencias USA→Perú completadas
      const transferencias = await this.getByFiltros({ tipo: 'internacional_peru' });
      const transferenciasCompletadas = transferencias.filter(
        t => t.estado === 'recibida_completa' || t.estado === 'recibida_parcial'
      );

      let actualizadas = 0;
      let errores = 0;

      for (const transferencia of transferenciasCompletadas) {
        for (const unidadTransf of transferencia.unidades) {
          // Solo procesar unidades que fueron recibidas
          if (unidadTransf.estadoTransferencia !== 'recibida') continue;
          if (!unidadTransf.costoFleteUSD || unidadTransf.costoFleteUSD <= 0) continue;

          try {
            // Verificar si la unidad ya tiene costoFleteUSD
            const unidadRef = doc(db, UNIDADES_COLLECTION, unidadTransf.unidadId);
            const unidadSnap = await getDoc(unidadRef);

            if (unidadSnap.exists()) {
              const unidadData = unidadSnap.data();

              // Solo actualizar si no tiene costoFleteUSD
              if (!unidadData.costoFleteUSD) {
                await updateDoc(unidadRef, {
                  costoFleteUSD: unidadTransf.costoFleteUSD
                });
                actualizadas++;
              }
            }
          } catch (e) {
            logger.error(`Error actualizando unidad ${unidadTransf.unidadId}:`, e);
            errores++;
          }
        }
      }

      logger.info(`Migración completada: ${actualizadas} unidades actualizadas, ${errores} errores`);
      return { actualizadas, errores };
    } catch (error: any) {
      logger.error('Error en migración de costoFleteUSD:', error);
      throw new Error(`Error en migración: ${error.message}`);
    }
  },

  /**
   * Recalcula los contadores de stock de productos basándose en las
   * transferencias USA→Perú completadas
   * @returns Número de productos actualizados
   */
  async migrarStockProductos(): Promise<{ productosActualizados: number; errores: number }> {
    try {
      // Obtener todas las transferencias USA→Perú completadas
      const transferencias = await this.getByFiltros({ tipo: 'internacional_peru' });
      const transferenciasCompletadas = transferencias.filter(
        t => t.estado === 'recibida_completa' || t.estado === 'recibida_parcial'
      );

      // Agrupar unidades recibidas por producto
      const stockPeruPorProducto = new Map<string, number>();

      for (const transferencia of transferenciasCompletadas) {
        for (const unidadTransf of transferencia.unidades) {
          if (unidadTransf.estadoTransferencia !== 'recibida') continue;

          const count = stockPeruPorProducto.get(unidadTransf.productoId) || 0;
          stockPeruPorProducto.set(unidadTransf.productoId, count + 1);
        }
      }

      let productosActualizados = 0;
      let errores = 0;

      // Actualizar cada producto con su stock correcto en Perú
      for (const [productoId, stockPeru] of stockPeruPorProducto) {
        try {
          const docRef = doc(db, COLLECTIONS.PRODUCTOS, productoId);
          await updateDoc(docRef, { stockPeru });
          productosActualizados++;
          logger.debug(`Producto ${productoId}: stockPeru = ${stockPeru}`);
        } catch (e) {
          logger.error(`Error actualizando stock de producto ${productoId}:`, e);
          errores++;
        }
      }

      logger.info(`Migración de stock completada: ${productosActualizados} productos actualizados, ${errores} errores`);
      return { productosActualizados, errores };
    } catch (error: any) {
      logger.error('Error en migración de stock:', error);
      throw new Error(`Error en migración: ${error.message}`);
    }
  },

  // ============================================
  // PAGO A VIAJERO
  // ============================================

  /**
   * Registra el pago al viajero por el flete
   * Integrado con Tesorería
   */
  async registrarPagoViajero(
    transferenciaId: string,
    datos: {
      fechaPago: Date;
      monedaPago: 'USD' | 'PEN';
      montoOriginal: number;
      tipoCambio: number;
      metodoPago: MetodoTesoreria;
      cuentaOrigenId?: string;
      referencia?: string;
      notas?: string;
    },
    userId: string
  ): Promise<PagoViajero> {
    const transferencia = await this.getById(transferenciaId);
    if (!transferencia) {
      throw new Error('Transferencia no encontrada');
    }

    if (!esTipoTransferenciaInternacional(transferencia.tipo)) {
      throw new Error('Solo se pueden registrar pagos a viajero en transferencias internacionales');
    }

    // Permitir pagos parciales: solo bloquear si ya está completamente pagado
    const pagosAnteriores = getPagosArray(transferencia);
    const esPagadoSinRegistro = transferencia.estadoPagoViajero === 'pagado' && pagosAnteriores.length === 0;
    if (transferencia.estadoPagoViajero === 'pagado' && !esPagadoSinRegistro) {
      throw new Error('El pago a viajero ya fue completado');
    }

    const {
      fechaPago,
      monedaPago,
      montoOriginal,
      tipoCambio,
      metodoPago,
      cuentaOrigenId,
      referencia,
      notas
    } = datos;

    // Validar campos requeridos
    if (!tipoCambio || tipoCambio <= 0) {
      throw new Error('El tipo de cambio es requerido y debe ser mayor a 0');
    }
    if (!montoOriginal || montoOriginal <= 0) {
      throw new Error('El monto es requerido y debe ser mayor a 0');
    }

    // Calcular equivalencias según la moneda de pago
    const montoUSD = monedaPago === 'USD' ? montoOriginal : montoOriginal / tipoCambio;
    const montoPEN = monedaPago === 'PEN' ? montoOriginal : montoOriginal * tipoCambio;

    // Calcular montos acumulados y pendientes
    const costoFleteTotal = transferencia.costoFleteTotal || 0;
    const montoPagadoUSDAnterior = pagosAnteriores.reduce((sum, p) => sum + p.montoUSD, 0);
    const montoPendienteUSD = costoFleteTotal - montoPagadoUSDAnterior;

    // Validar que no exceda el pendiente
    if (montoUSD > montoPendienteUSD + 0.01) {
      throw new Error(`El monto excede el saldo pendiente. Pendiente: $${montoPendienteUSD.toFixed(2)} USD`);
    }

    // Determinar nuevo estado
    const nuevoMontoPagadoUSD = montoPagadoUSDAnterior + montoUSD;
    const nuevoMontoPendienteUSD = costoFleteTotal - nuevoMontoPagadoUSD;
    const nuevoEstado = nuevoMontoPendienteUSD <= 0.01 ? 'pagado' : 'parcial';
    const esPagoCompleto = nuevoEstado === 'pagado';

    // Obtener nombre de cuenta si se especificó
    let cuentaOrigenNombre: string | undefined;
    if (cuentaOrigenId) {
      try {
        const cuenta = await tesoreriaService.getCuentaById(cuentaOrigenId);
        if (cuenta) {
          cuentaOrigenNombre = cuenta.nombre;
        }
      } catch (e) {
        logger.warn('No se pudo obtener nombre de cuenta:', e);
      }
    }

    // Crear registro de pago
    const pagoId = `PAG-VIA-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const nuevoPago: PagoViajero = {
      id: pagoId,
      fecha: Timestamp.fromDate(fechaPago),
      monedaPago,
      montoOriginal,
      montoUSD,
      montoPEN,
      tipoCambio,
      metodoPago,
      registradoPor: userId,
      fechaRegistro: Timestamp.now()
    };
    if (cuentaOrigenId) nuevoPago.cuentaOrigenId = cuentaOrigenId;
    if (cuentaOrigenNombre) nuevoPago.cuentaOrigenNombre = cuentaOrigenNombre;
    if (referencia) nuevoPago.referencia = referencia;
    if (notas) nuevoPago.notas = notas;

    const nuevosPagos = [...pagosAnteriores, nuevoPago];

    // Actualizar la transferencia con array de pagos y montos acumulados
    const docRef = doc(db, COLLECTION_NAME, transferenciaId);
    await updateDoc(docRef, {
      estadoPagoViajero: nuevoEstado,
      pagosViajero: nuevosPagos,
      montoPagadoUSD: nuevoMontoPagadoUSD,
      montoPendienteUSD: Math.max(0, nuevoMontoPendienteUSD),
      // Legacy field: solo al pago completo
      ...(esPagoCompleto ? { pagoViajero: nuevoPago } : {}),
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now()
    });

    // ========== REGISTRAR EN TESORERÍA ==========
    try {
      const movimientoData: any = {
        tipo: 'pago_viajero',
        moneda: monedaPago,
        monto: montoOriginal,
        tipoCambio,
        metodo: metodoPago,
        concepto: `Pago ${esPagoCompleto ? '' : 'parcial '}flete ${transferencia.numeroTransferencia} - Viajero: ${transferencia.viajeroNombre || 'Sin nombre'}`,
        notas: notas || `Transferencia ${transferencia.numeroTransferencia}. ${monedaPago === 'USD' ? `≈ S/ ${montoPEN.toFixed(2)}` : `≈ $${montoUSD.toFixed(2)} USD`}`,
        fecha: fechaPago,
        transferenciaId: transferenciaId,
        transferenciaNumero: transferencia.numeroTransferencia
      };

      if (referencia) movimientoData.referencia = referencia;
      if (cuentaOrigenId) movimientoData.cuentaOrigen = cuentaOrigenId;

      const movimientoId = await tesoreriaService.registrarMovimiento(movimientoData, userId);
      nuevoPago.movimientoTesoreriaId = movimientoId;

      // Actualizar el último pago en el array con el ID del movimiento
      nuevosPagos[nuevosPagos.length - 1] = { ...nuevoPago, movimientoTesoreriaId: movimientoId };
      await updateDoc(docRef, {
        pagosViajero: nuevosPagos,
        ...(esPagoCompleto ? { 'pagoViajero.movimientoTesoreriaId': movimientoId } : {})
      });

      logger.success(`Pago viajero registrado en tesorería: ${monedaPago} ${montoOriginal} para ${transferencia.numeroTransferencia}`);
    } catch (tesoreriaError) {
      logger.error('Error registrando pago viajero en tesorería:', tesoreriaError);
      // Marcar error en el último pago del array
      nuevosPagos[nuevosPagos.length - 1] = { ...nuevoPago, errorTesoreria: true, errorTesoreriaMsg: tesoreriaError instanceof Error ? tesoreriaError.message : 'Error desconocido' };
      await updateDoc(docRef, { pagosViajero: nuevosPagos }).catch(() => {});
    }

    return nuevoPago;
  },

  /**
   * Reconciliar pago de viajero: re-crear el movimiento en tesorería
   * para pagos que se registraron pero cuyo movimiento falló o no existe
   */
  async reconciliarPagoViajero(
    transferenciaId: string,
    userId: string,
    pagoId?: string
  ): Promise<string> {
    const transferencia = await this.getById(transferenciaId);
    if (!transferencia) {
      throw new Error('Transferencia no encontrada');
    }

    const pagos = getPagosArray(transferencia);
    if (pagos.length === 0) {
      throw new Error('Esta transferencia no tiene pagos registrados');
    }

    // Encontrar el pago a reconciliar
    let pago: PagoViajero | undefined;
    if (pagoId) {
      pago = pagos.find(p => p.id === pagoId);
    } else {
      // Buscar el primer pago con error o sin movimiento de tesorería
      pago = pagos.find(p => p.errorTesoreria || !p.movimientoTesoreriaId);
    }

    if (!pago) {
      // Verificar si todos los movimientos realmente existen
      for (const p of pagos) {
        if (p.movimientoTesoreriaId) {
          const movExistente = await tesoreriaService.getMovimientoById(p.movimientoTesoreriaId);
          if (!movExistente) {
            pago = p;
            break;
          }
        }
      }
    }

    if (!pago) {
      throw new Error('Todos los pagos ya tienen sus movimientos de tesorería vinculados correctamente');
    }

    // Re-crear el movimiento en tesorería
    const movimientoData: any = {
      tipo: 'pago_viajero',
      moneda: pago.monedaPago,
      monto: pago.montoOriginal,
      tipoCambio: pago.tipoCambio,
      metodo: pago.metodoPago,
      concepto: `Pago flete ${transferencia.numeroTransferencia} - Viajero: ${transferencia.viajeroNombre || 'Sin nombre'}`,
      notas: `[Reconciliado] Transferencia ${transferencia.numeroTransferencia}. ${pago.monedaPago === 'USD' ? `≈ S/ ${pago.montoPEN.toFixed(2)}` : `≈ $${pago.montoUSD.toFixed(2)} USD`}`,
      fecha: pago.fecha.toDate(),
      transferenciaId: transferenciaId,
      transferenciaNumero: transferencia.numeroTransferencia
    };

    if (pago.referencia) movimientoData.referencia = pago.referencia;
    if (pago.cuentaOrigenId) movimientoData.cuentaOrigen = pago.cuentaOrigenId;

    const movimientoId = await tesoreriaService.registrarMovimiento(movimientoData, userId);

    // Actualizar el pago específico en el array
    const pagosActualizados = pagos.map(p =>
      p.id === pago!.id
        ? { ...p, movimientoTesoreriaId: movimientoId, errorTesoreria: undefined, errorTesoreriaMsg: undefined }
        : p
    );
    // Limpiar undefined para Firestore
    pagosActualizados.forEach(p => {
      if (p.errorTesoreria === undefined) delete (p as any).errorTesoreria;
      if (p.errorTesoreriaMsg === undefined) delete (p as any).errorTesoreriaMsg;
    });

    const docRef = doc(db, COLLECTION_NAME, transferenciaId);
    await updateDoc(docRef, {
      pagosViajero: pagosActualizados,
      // Legacy field update si solo hay 1 pago
      ...(pagos.length === 1 ? {
        'pagoViajero.movimientoTesoreriaId': movimientoId,
        'pagoViajero.errorTesoreria': deleteField(),
        'pagoViajero.errorTesoreriaMsg': deleteField()
      } : {})
    });

    logger.success(`Pago viajero reconciliado en tesorería: ${pago.monedaPago} ${pago.montoOriginal} para ${transferencia.numeroTransferencia}`);
    return movimientoId;
  },

  /**
   * Obtiene transferencias pendientes de pago a viajero
   */
  async getPendientesPagoViajero(): Promise<Transferencia[]> {
    const todas = await this.getAll();
    return todas.filter(t =>
      esTipoTransferenciaInternacional(t.tipo) &&
      t.costoFleteTotal &&
      t.costoFleteTotal > 0 &&
      t.estadoPagoViajero !== 'pagado' &&
      (t.estado === 'recibida_completa' || t.estado === 'recibida_parcial')
    );
  },

  // ============================================
  // HISTORIAL DE VIAJERO
  // ============================================

  // ============================================
  // ACTUALIZAR FLETE
  // ============================================

  /**
   * Actualiza el costo de flete de una transferencia existente.
   * Permite agregar o editar el flete después de crear la transferencia.
   * Si las unidades ya fueron recibidas, también actualiza el costoFleteUSD
   * en cada unidad y recalcula el ctruInicial.
   */
  async actualizarFleteTransferencia(
    transferenciaId: string,
    costoFletePorProducto: Record<string, number>,
    userId: string
  ): Promise<void> {
    const transferencia = await this.getById(transferenciaId);
    if (!transferencia) {
      throw new Error('Transferencia no encontrada');
    }

    if (!esTipoTransferenciaInternacional(transferencia.tipo)) {
      throw new Error('Solo se puede asignar flete a transferencias internacionales → Perú');
    }

    // Agrupar unidades por producto
    const unidadesPorProducto = new Map<string, TransferenciaUnidad[]>();
    for (const u of transferencia.unidades) {
      if (!unidadesPorProducto.has(u.productoId)) {
        unidadesPorProducto.set(u.productoId, []);
      }
      unidadesPorProducto.get(u.productoId)!.push(u);
    }

    // Calcular costoFleteUSD por unidad y actualizar array de unidades
    let costoFleteTotal = 0;
    const unidadesActualizadas = transferencia.unidades.map(u => {
      const costoFleteProducto = costoFletePorProducto[u.productoId] || 0;
      const cantidadUnidades = unidadesPorProducto.get(u.productoId)?.length || 1;
      const costoPorUnidad = cantidadUnidades > 0 ? costoFleteProducto / cantidadUnidades : 0;
      return { ...u, costoFleteUSD: costoPorUnidad };
    });

    // Calcular total (suma de los costos por producto, no por unidad)
    for (const [, costo] of Object.entries(costoFletePorProducto)) {
      costoFleteTotal += costo || 0;
    }

    // Actualizar el documento de transferencia
    const docRef = doc(db, COLLECTION_NAME, transferenciaId);
    await updateDoc(docRef, {
      unidades: unidadesActualizadas,
      costoFleteTotal,
      monedaFlete: 'USD',
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now()
    });

    // Si las unidades ya fueron recibidas, propagar flete a las unidades individuales
    const yaRecibida = transferencia.estado === 'recibida_completa' || transferencia.estado === 'recibida_parcial';
    if (yaRecibida) {
      const batch = writeBatch(db);
      let batchCount = 0;

      for (const unidadTransf of unidadesActualizadas) {
        if (unidadTransf.estadoTransferencia !== 'recibida') continue;

        const unidadRef = doc(db, UNIDADES_COLLECTION, unidadTransf.unidadId);
        const unidadSnap = await getDoc(unidadRef);
        if (!unidadSnap.exists()) continue;

        const unidadData = unidadSnap.data();
        const updateData: Record<string, unknown> = {
          costoFleteUSD: unidadTransf.costoFleteUSD,
          actualizadoPor: userId,
          fechaActualizacion: Timestamp.now()
        };

        // Recalcular ctruInicial incluyendo flete
        if (unidadTransf.costoFleteUSD > 0) {
          const tc = unidadData.tcPago || unidadData.tcCompra || 0;
          const costoBasePEN = (unidadData.costoUnitarioUSD || 0) * tc;
          const costoFletePEN = unidadTransf.costoFleteUSD * tc;
          const nuevoCtruInicial = costoBasePEN + costoFletePEN;
          updateData.ctruInicial = nuevoCtruInicial;
          if (!unidadData.costoGAGOAsignado || unidadData.costoGAGOAsignado === 0) {
            updateData.ctruDinamico = nuevoCtruInicial;
          }
        }

        batch.update(unidadRef, updateData);
        batchCount++;

        // Firestore batch limit
        if (batchCount >= 490) {
          await batch.commit();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      // Trigger CTRU recalculation if flete changed
      try {
        const ctruService = await import('./ctru.service');
        await ctruService.ctruService.recalcularCTRUDinamicoSafe();
      } catch (e) {
        logger.warn('No se pudo recalcular CTRU tras actualizar flete:', e);
      }
    }

    logger.success(`Flete actualizado para transferencia ${transferencia.numeroTransferencia}: $${costoFleteTotal.toFixed(2)}`);
  },

  /**
   * Obtiene todas las transferencias de un viajero específico
   */
  async getByViajeroId(viajeroId: string): Promise<Transferencia[]> {
    return this.getByFiltros({ viajeroId });
  },

  /**
   * Obtiene el historial financiero completo de un viajero
   */
  async getHistorialFinancieroViajero(viajeroId: string): Promise<{
    transferencias: Transferencia[];
    resumen: {
      totalTransferencias: number;
      transferenciasCompletadas: number;
      transferenciasEnTransito: number;
      totalUnidadesTransportadas: number;
      totalFletePagado: number;
      totalFletePendiente: number;
      monedaFlete: 'USD' | 'PEN';
      promedioFletePorUnidad: number;
      ultimaTransferencia?: Date;
      primeraTransferencia?: Date;
    };
    pendientes: Transferencia[];
    pagados: Transferencia[];
  }> {
    const transferencias = await this.getByViajeroId(viajeroId);

    let totalUnidadesTransportadas = 0;
    let totalFletePagado = 0;
    let totalFletePendiente = 0;
    let transferenciasCompletadas = 0;
    let transferenciasEnTransito = 0;

    const pendientes: Transferencia[] = [];
    const pagados: Transferencia[] = [];

    for (const t of transferencias) {
      // Contar unidades transportadas
      const unidadesRecibidas = t.unidades.filter(u => u.estadoTransferencia === 'recibida').length;
      totalUnidadesTransportadas += unidadesRecibidas;

      // Estado de transferencia
      if (t.estado === 'recibida_completa' || t.estado === 'recibida_parcial') {
        transferenciasCompletadas++;
      } else if (t.estado === 'en_transito') {
        transferenciasEnTransito++;
      }

      // Clasificar por estado de pago
      if (t.costoFleteTotal && t.costoFleteTotal > 0) {
        if (t.estadoPagoViajero === 'pagado') {
          totalFletePagado += t.costoFleteTotal;
          pagados.push(t);
        } else if (t.estadoPagoViajero === 'parcial') {
          const pagadoUSD = t.montoPagadoUSD || 0;
          totalFletePagado += pagadoUSD;
          totalFletePendiente += (t.costoFleteTotal - pagadoUSD);
          pendientes.push(t);
        } else {
          totalFletePendiente += t.costoFleteTotal;
          pendientes.push(t);
        }
      }
    }

    // Calcular promedio
    const promedioFletePorUnidad = totalUnidadesTransportadas > 0
      ? (totalFletePagado + totalFletePendiente) / totalUnidadesTransportadas
      : 0;

    // Fechas
    const fechasOrdenadas = transferencias
      .map(t => t.fechaCreacion.toDate())
      .sort((a, b) => a.getTime() - b.getTime());

    return {
      transferencias,
      resumen: {
        totalTransferencias: transferencias.length,
        transferenciasCompletadas,
        transferenciasEnTransito,
        totalUnidadesTransportadas,
        totalFletePagado,
        totalFletePendiente,
        monedaFlete: 'USD',
        promedioFletePorUnidad,
        primeraTransferencia: fechasOrdenadas[0],
        ultimaTransferencia: fechasOrdenadas[fechasOrdenadas.length - 1]
      },
      pendientes,
      pagados
    };
  }
};
