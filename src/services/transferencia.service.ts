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
import type {
  Transferencia,
  TransferenciaFormData,
  TransferenciaUnidad,
  RecepcionFormData,
  TransferenciaFiltros,
  ResumenTransferencias,
  EstadoTransferencia,
  PagoViajero
} from '../types/transferencia.types';
import type { Unidad, MovimientoUnidad, EstadoUnidad } from '../types/unidad.types';
import { almacenService } from './almacen.service';
import { ProductoService } from './producto.service';
import { tesoreriaService } from './tesoreria.service';
import { inventarioService } from './inventario.service';
import type { MetodoTesoreria } from '../types/tesoreria.types';

const COLLECTION_NAME = 'transferencias';
const UNIDADES_COLLECTION = 'unidades';

/**
 * Genera el siguiente número de transferencia
 */
async function generarNumeroTransferencia(tipo: 'interna_usa' | 'usa_peru'): Promise<string> {
  const prefix = tipo === 'interna_usa' ? 'TRF' : 'ENV';
  const year = new Date().getFullYear();

  // Query simple sin orderBy para evitar índices compuestos
  const q = query(
    collection(db, COLLECTION_NAME),
    where('tipo', '==', tipo)
  );

  const snapshot = await getDocs(q);

  let maxNumber = 0;
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const numero = data.numeroTransferencia;
    // Extraer el número del formato TRF-2024-001 o ENV-2024-001
    const match = numero?.match(/-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  });

  return `${prefix}-${year}-${String(maxNumber + 1).padStart(3, '0')}`;
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
      q = query(q, where('tipo', '==', filtros.tipo));
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
      where('estado', 'in', ['en_transito', 'preparando'])
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
      const estadosValidos: EstadoUnidad[] = ['recibida_usa', 'disponible_peru', 'reservada'];
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
    if (data.tipo === 'usa_peru') {
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

    // Actualizar transferencia
    const transferenciaRef = doc(db, COLLECTION_NAME, transferenciaId);
    const transferenciaUpdate: Record<string, unknown> = {
      estado: 'en_transito',
      fechaSalida,
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
    const estadoNuevo: EstadoUnidad = transferencia.tipo === 'usa_peru'
      ? 'en_transito_peru'
      : 'en_transito_usa';

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
          observaciones: `Envío ${transferencia.tipo === 'usa_peru' ? 'USA → Perú' : 'interno USA'}. Estado: ${estadoAnterior} → ${estadoNuevo}`,
          documentoRelacionado: {
            tipo: 'transferencia',
            id: transferenciaId,
            numero: transferencia.numeroTransferencia
          }
        };

        const unidadUpdate: Record<string, unknown> = {
          estado: estadoNuevo,
          transferenciaActualId: transferenciaId,
          numeroTransferencia: transferencia.numeroTransferencia,
          movimientos: [...(unidadData.movimientos || []), nuevoMovimiento],
          actualizadoPor: userId,
          fechaActualizacion: now
        };

        // Solo incluir fechaSalidaUSA para transferencias usa_peru
        if (transferencia.tipo === 'usa_peru') {
          unidadUpdate.fechaSalidaUSA = fechaSalida;
        }

        batch.update(unidadRef, unidadUpdate);
      }
    }

    // Actualizar métricas del almacén origen
    await almacenService.incrementarUnidadesEnviadas(
      transferencia.almacenOrigenId,
      transferencia.totalUnidades
    );

    // Para transferencias USA→Perú: sincronizar stock de productos afectados
    if (transferencia.tipo === 'usa_peru') {
      // Obtener productos únicos afectados
      const productosAfectados = [...new Set(transferencia.unidades.map(u => u.productoId))];
      await inventarioService.sincronizarStockProductos_batch(productosAfectados);
    }

    await batch.commit();
  },

  // ============================================
  // RECEPCIÓN
  // ============================================

  /**
   * Registra la recepción de una transferencia
   */
  async registrarRecepcion(data: RecepcionFormData, userId: string): Promise<void> {
    const transferencia = await this.getById(data.transferenciaId);
    if (!transferencia) {
      throw new Error('Transferencia no encontrada');
    }

    if (transferencia.estado !== 'en_transito') {
      throw new Error('Solo se pueden recibir transferencias en tránsito');
    }

    const batch = writeBatch(db);
    const now = Timestamp.now();

    // Contadores
    let unidadesRecibidas = 0;
    let unidadesFaltantes = 0;
    let unidadesDanadas = 0;

    // Procesar cada unidad
    const unidadesActualizadas: TransferenciaUnidad[] = [];

    for (const unidadRecepcion of data.unidadesRecibidas) {
      const unidadTransferencia = transferencia.unidades.find(
        u => u.unidadId === unidadRecepcion.unidadId
      );

      if (!unidadTransferencia) continue;

      let estadoTransferencia: TransferenciaUnidad['estadoTransferencia'];

      if (!unidadRecepcion.recibida) {
        estadoTransferencia = 'faltante';
        unidadesFaltantes++;
      } else if (unidadRecepcion.danada) {
        estadoTransferencia = 'danada';
        unidadesDanadas++;
        unidadesRecibidas++;
      } else {
        estadoTransferencia = 'recibida';
        unidadesRecibidas++;
      }

      const unidadActualizada: TransferenciaUnidad = {
        ...unidadTransferencia,
        estadoTransferencia
      };

      // Solo incluir incidencia si tiene valor
      if (unidadRecepcion.incidencia) {
        unidadActualizada.incidencia = unidadRecepcion.incidencia;
      }

      unidadesActualizadas.push(unidadActualizada);

      // Actualizar la unidad en Firestore
      const unidadRef = doc(db, UNIDADES_COLLECTION, unidadRecepcion.unidadId);
      const unidadSnap = await getDoc(unidadRef);

      if (unidadSnap.exists() && unidadRecepcion.recibida) {
        const unidadData = unidadSnap.data() as Unidad;
        const estadoAnterior = unidadData.estado;

        // Determinar nuevo estado
        // IMPORTANTE: Si la unidad estaba reservada para una cotización/venta,
        // debe mantener ese estado después de la recepción
        const estabaReservada = unidadData.reservadaPara || (unidadData as any).reservadoPara;

        let estadoNuevo: EstadoUnidad;
        if (unidadRecepcion.danada) {
          estadoNuevo = 'danada';
        } else if (estabaReservada) {
          // Mantener estado reservada - la unidad sigue comprometida para la cotización/venta
          estadoNuevo = 'reservada';
        } else if (transferencia.tipo === 'usa_peru') {
          estadoNuevo = 'disponible_peru';
        } else {
          estadoNuevo = 'recibida_usa';
        }

        // Calcular días en tránsito
        const diasEnTransito = transferencia.fechaSalida
          ? Math.ceil((now.toMillis() - transferencia.fechaSalida.toMillis()) / (1000 * 60 * 60 * 24))
          : 0;

        // Obtener datos del almacén destino
        const almacenDestino = await almacenService.getById(transferencia.almacenDestinoId);

        // Crear movimiento
        const observacion = unidadRecepcion.incidencia
          ? `Recepción ${transferencia.tipo === 'usa_peru' ? 'en Perú' : 'en USA'}. Incidencia: ${unidadRecepcion.incidencia}`
          : `Recepción ${transferencia.tipo === 'usa_peru' ? 'en Perú' : 'en USA'}. Estado: ${estadoAnterior} → ${estadoNuevo}`;

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
          almacenId: transferencia.almacenDestinoId,
          almacenNombre: transferencia.almacenDestinoNombre,
          pais: transferencia.tipo === 'usa_peru' ? 'Peru' : 'USA',
          transferenciaActualId: deleteField(),
          numeroTransferencia: deleteField(),
          movimientos: [...(unidadData.movimientos || []), nuevoMovimiento],
          actualizadoPor: userId,
          fechaActualizacion: now
        };

        // Si llegó a Perú, registrar fecha y costo de flete
        if (transferencia.tipo === 'usa_peru') {
          updateData.fechaLlegadaPeru = now;

          // Propagar el costo de flete USD de la transferencia a la unidad
          if (unidadTransferencia && unidadTransferencia.costoFleteUSD > 0) {
            updateData.costoFleteUSD = unidadTransferencia.costoFleteUSD;
          }
        }

        batch.update(unidadRef, updateData);
      }
    }

    // Determinar estado final de la transferencia
    const estadoFinal: EstadoTransferencia =
      unidadesFaltantes > 0 || unidadesDanadas > 0
        ? 'recibida_parcial'
        : 'recibida_completa';

    // Calcular días en tránsito
    const diasEnTransito = transferencia.fechaSalida
      ? Math.ceil((now.toMillis() - transferencia.fechaSalida.toMillis()) / (1000 * 60 * 60 * 24))
      : 0;

    // Actualizar transferencia
    const transferenciaRef = doc(db, COLLECTION_NAME, data.transferenciaId);

    // Construir objeto recepcion sin campos undefined
    const recepcionData: Record<string, unknown> = {
      fechaRecepcion: now,
      recibidoPor: userId,
      unidadesEsperadas: transferencia.totalUnidades,
      unidadesRecibidas,
      unidadesFaltantes,
      unidadesDanadas
    };

    // Solo incluir campos opcionales si tienen valor
    if (data.observaciones) {
      recepcionData.observaciones = data.observaciones;
    }
    if (data.fotoEvidencia) {
      recepcionData.fotoEvidencia = data.fotoEvidencia;
    }

    batch.update(transferenciaRef, {
      estado: estadoFinal,
      fechaLlegadaReal: now,
      diasEnTransito,
      unidades: unidadesActualizadas,
      recepcion: recepcionData,
      actualizadoPor: userId,
      fechaActualizacion: now
    });

    // Actualizar métricas del almacén destino
    await almacenService.incrementarUnidadesRecibidas(
      transferencia.almacenDestinoId,
      unidadesRecibidas
    );

    // Sincronizar stock de productos afectados desde unidades (fuente de verdad)
    const productosAfectados = [...new Set(transferencia.unidades.map(u => u.productoId))];

    await batch.commit();

    // Sincronizar después del commit para reflejar cambios reales
    await inventarioService.sincronizarStockProductos_batch(productosAfectados);
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
      t.estado === 'en_transito' || t.estado === 'preparando'
    );
    const completadasMes = todas.filter(t =>
      (t.estado === 'recibida_completa' || t.estado === 'recibida_parcial') &&
      t.fechaLlegadaReal &&
      t.fechaLlegadaReal.toDate() >= inicioMes
    );

    const internasUSA = todas.filter(t => t.tipo === 'interna_usa').length;
    const enviosUSAPeru = todas.filter(t => t.tipo === 'usa_peru').length;

    // Unidades en tránsito
    const unidadesEnTransitoUSA = enTransito
      .filter(t => t.tipo === 'interna_usa')
      .reduce((sum, t) => sum + t.totalUnidades, 0);

    const unidadesEnTransitoPeru = enTransito
      .filter(t => t.tipo === 'usa_peru')
      .reduce((sum, t) => sum + t.totalUnidades, 0);

    // Tiempo promedio de tránsito USA-Perú
    const enviosCompletados = todas.filter(t =>
      t.tipo === 'usa_peru' &&
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
      const transferencias = await this.getByFiltros({ tipo: 'usa_peru' });
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
            console.error(`Error actualizando unidad ${unidadTransf.unidadId}:`, e);
            errores++;
          }
        }
      }

      logger.info(`Migración completada: ${actualizadas} unidades actualizadas, ${errores} errores`);
      return { actualizadas, errores };
    } catch (error: any) {
      console.error('Error en migración de costoFleteUSD:', error);
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
      const transferencias = await this.getByFiltros({ tipo: 'usa_peru' });
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
          const docRef = doc(db, 'productos', productoId);
          await updateDoc(docRef, { stockPeru });
          productosActualizados++;
          logger.debug(`Producto ${productoId}: stockPeru = ${stockPeru}`);
        } catch (e) {
          console.error(`Error actualizando stock de producto ${productoId}:`, e);
          errores++;
        }
      }

      logger.info(`Migración de stock completada: ${productosActualizados} productos actualizados, ${errores} errores`);
      return { productosActualizados, errores };
    } catch (error: any) {
      console.error('Error en migración de stock:', error);
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

    if (transferencia.tipo !== 'usa_peru') {
      throw new Error('Solo se pueden registrar pagos a viajero en transferencias USA-Perú');
    }

    if (transferencia.estadoPagoViajero === 'pagado') {
      throw new Error('El pago a viajero ya fue registrado');
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

    // Obtener nombre de cuenta si se especificó
    let cuentaOrigenNombre: string | undefined;
    if (cuentaOrigenId) {
      try {
        const cuenta = await tesoreriaService.getCuentaById(cuentaOrigenId);
        if (cuenta) {
          cuentaOrigenNombre = cuenta.nombre;
        }
      } catch (e) {
        console.warn('No se pudo obtener nombre de cuenta:', e);
      }
    }

    // Crear registro de pago (sin campos undefined para Firestore)
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
    // Agregar campos opcionales solo si tienen valor
    if (cuentaOrigenId) nuevoPago.cuentaOrigenId = cuentaOrigenId;
    if (cuentaOrigenNombre) nuevoPago.cuentaOrigenNombre = cuentaOrigenNombre;
    if (referencia) nuevoPago.referencia = referencia;
    if (notas) nuevoPago.notas = notas;

    // Actualizar la transferencia
    const docRef = doc(db, COLLECTION_NAME, transferenciaId);
    await updateDoc(docRef, {
      estadoPagoViajero: 'pagado',
      pagoViajero: nuevoPago,
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
        concepto: `Pago flete ${transferencia.numeroTransferencia} - Viajero: ${transferencia.viajeroNombre || 'Sin nombre'}`,
        notas: notas || `Transferencia ${transferencia.numeroTransferencia}. ${monedaPago === 'USD' ? `≈ S/ ${montoPEN.toFixed(2)}` : `≈ $${montoUSD.toFixed(2)} USD`}`,
        fecha: fechaPago,
        transferenciaId: transferenciaId,
        transferenciaNumero: transferencia.numeroTransferencia
      };

      // Agregar campos opcionales solo si tienen valor
      if (referencia) movimientoData.referencia = referencia;
      if (cuentaOrigenId) movimientoData.cuentaOrigen = cuentaOrigenId;

      const movimientoId = await tesoreriaService.registrarMovimiento(movimientoData, userId);
      nuevoPago.movimientoTesoreriaId = movimientoId;

      // Actualizar con el ID del movimiento
      await updateDoc(docRef, {
        'pagoViajero.movimientoTesoreriaId': movimientoId
      });

      logger.success(`Pago viajero registrado en tesorería: ${monedaPago} ${montoOriginal} para ${transferencia.numeroTransferencia}`);
    } catch (tesoreriaError) {
      // No bloquear el pago si falla tesorería
      console.error('Error registrando pago viajero en tesorería:', tesoreriaError);
    }

    return nuevoPago;
  },

  /**
   * Obtiene transferencias pendientes de pago a viajero
   */
  async getPendientesPagoViajero(): Promise<Transferencia[]> {
    const todas = await this.getAll();
    return todas.filter(t =>
      t.tipo === 'usa_peru' &&
      t.costoFleteTotal &&
      t.costoFleteTotal > 0 &&
      t.estadoPagoViajero !== 'pagado' &&
      (t.estado === 'recibida_completa' || t.estado === 'recibida_parcial')
    );
  },

  // ============================================
  // HISTORIAL DE VIAJERO
  // ============================================

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
