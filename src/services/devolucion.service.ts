/**
 * devolucion.service.ts
 *
 * Gestiona el ciclo completo de devoluciones de productos:
 *   solicitada → aprobada → ejecutada → completada
 *
 * Patrón seguido: VentaService.cancelar() en venta.service.ts
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  writeBatch,
  deleteField,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger, logBackgroundError } from '../lib/logger';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import { tesoreriaService } from './tesoreria.service';
import { tipoCambioService } from './tipoCambio.service';
import { actividadService } from './actividad.service';
import { inventarioService } from './inventario.service';
import type { Venta, MetodoPago } from '../types/venta.types';
import type {
  Devolucion,
  DevolucionInput,
  RecepcionDevolucionInput,
  DevolucionDineroInput,
  DevolucionFiltros,
  DevolucionStats,
  EstadoDevolucion,
  ProductoDevolucion,
  CondicionProductoDevuelto,
} from '../types/devolucion.types';

// ================================================================
// CONSTANTES
// ================================================================

const COLLECTION_NAME = COLLECTIONS.DEVOLUCIONES;

/** Estados desde los que se puede generar una devolución */
const ESTADOS_VENTA_DEVOLVIBLE: string[] = [
  'entregada',
  'devolucion_parcial',
];

// ================================================================
// HELPERS INTERNOS
// ================================================================

/**
 * Obtiene una devolución por ID y lanza si no existe.
 */
async function _getDevolucionOrThrow(id: string): Promise<Devolucion> {
  const snap = await getDoc(doc(db, COLLECTION_NAME, id));
  if (!snap.exists()) {
    throw new Error(`Devolución ${id} no encontrada`);
  }
  return { id: snap.id, ...snap.data() } as Devolucion;
}

/**
 * Obtiene una venta por ID y lanza si no existe.
 */
async function _getVentaOrThrow(ventaId: string): Promise<Venta> {
  const snap = await getDoc(doc(db, COLLECTIONS.VENTAS, ventaId));
  if (!snap.exists()) {
    throw new Error(`Venta ${ventaId} no encontrada`);
  }
  return { id: snap.id, ...snap.data() } as Venta;
}

// ================================================================
// SERVICIO
// ================================================================

export const devolucionService = {

  // ==============================================================
  // CREAR — Paso 1: Registrar solicitud de devolución
  // ==============================================================

  /**
   * Crea una solicitud de devolución vinculada a una venta entregada.
   *
   * Validaciones:
   * - La venta debe existir y estar en estado 'entregada' o 'devolucion_parcial'.
   * - Los productos solicitados deben pertenecer a la venta.
   * - La cantidad devuelta no puede superar la cantidad vendida.
   *
   * @returns ID del documento creado en Firestore.
   */
  async crear(data: DevolucionInput, userId: string): Promise<string> {
    try {
      const venta = await _getVentaOrThrow(data.ventaId);

      if (!ESTADOS_VENTA_DEVOLVIBLE.includes(venta.estado)) {
        throw new Error(
          `No se puede crear una devolución para una venta en estado '${venta.estado}'. ` +
          `La venta debe estar en estado 'entregada' o 'devolucion_parcial'.`
        );
      }

      // Validar que todos los productos pertenecen a la venta
      const productoIdsVenta = new Set(venta.productos.map(p => p.productoId));
      for (const prod of data.productos) {
        if (!productoIdsVenta.has(prod.productoId)) {
          throw new Error(
            `El producto ${prod.sku} (${prod.productoId}) no pertenece a la venta ${venta.numeroVenta}`
          );
        }
        if (prod.cantidad <= 0) {
          throw new Error(`La cantidad a devolver del producto ${prod.sku} debe ser mayor a 0`);
        }
        // Verificar que no supera la cantidad vendida
        const prodVenta = venta.productos.find(p => p.productoId === prod.productoId);
        if (prodVenta && prod.cantidad > prodVenta.cantidad) {
          throw new Error(
            `La cantidad a devolver (${prod.cantidad}) de ${prod.sku} supera ` +
            `la cantidad vendida (${prodVenta.cantidad})`
          );
        }
      }

      // Generar número DEV-YYYY-NNN
      const anio = new Date().getFullYear();
      const numeroDevolucion = await getNextSequenceNumber(`DEV-${anio}`);

      // Construir líneas de productos
      const productos: ProductoDevolucion[] = data.productos.map(p => ({
        productoId: p.productoId,
        sku: p.sku,
        nombreProducto: p.nombreProducto,
        cantidad: p.cantidad,
        precioUnitarioOriginal: p.precioUnitarioOriginal,
        subtotalDevolucion: p.cantidad * p.precioUnitarioOriginal,
        unidadesIds: p.unidadesIds ?? [],
      }));

      const montoDevolucion = productos.reduce(
        (acc, p) => acc + p.subtotalDevolucion,
        0
      );

      const nuevaDevolucion: Omit<Devolucion, 'id'> = {
        numeroDevolucion,
        ventaId: data.ventaId,
        ventaNumero: venta.numeroVenta,
        clienteNombre: venta.nombreCliente,
        clienteId: venta.clienteId,
        productos,
        motivo: data.motivo,
        ...(data.detalleMotivo ? { detalleMotivo: data.detalleMotivo } : {}),
        montoDevolucion,
        montoDevuelto: 0,
        estado: 'solicitada',
        fechaCreacion: serverTimestamp() as Timestamp,
        creadoPor: userId,
        ...(venta.lineaNegocioId ? { lineaNegocioId: venta.lineaNegocioId } : {}),
        ...(venta.lineaNegocioNombre ? { lineaNegocioNombre: venta.lineaNegocioNombre } : {}),
      };

      const ref = await addDoc(collection(db, COLLECTION_NAME), nuevaDevolucion);

      logger.log(`[Devolución] ${numeroDevolucion} creada — venta: ${venta.numeroVenta}`);

      actividadService.registrar({
        tipo: 'devolucion_solicitada',
        mensaje: `Devolución ${numeroDevolucion} solicitada para venta ${venta.numeroVenta}`,
        userId,
        displayName: userId,
        metadata: { entidadId: ref.id, entidadTipo: 'devolucion' },
      }).catch(() => {});

      return ref.id;
    } catch (error: any) {
      logger.error('[devolucionService.crear] Error:', error);
      throw new Error(error.message || 'Error al crear la devolución');
    }
  },

  // ==============================================================
  // APROBAR — Paso 2a: Admin aprueba la solicitud
  // ==============================================================

  /**
   * Aprueba una solicitud de devolución en estado 'solicitada'.
   * Solo administradores pueden aprobar.
   */
  async aprobar(devolucionId: string, userId: string): Promise<void> {
    try {
      const devolucion = await _getDevolucionOrThrow(devolucionId);

      if (devolucion.estado !== 'solicitada') {
        throw new Error(
          `Solo se pueden aprobar devoluciones en estado 'solicitada'. ` +
          `Estado actual: '${devolucion.estado}'`
        );
      }

      await updateDoc(doc(db, COLLECTION_NAME, devolucionId), {
        estado: 'aprobada' as EstadoDevolucion,
        aprobadoPor: userId,
        fechaAprobacion: serverTimestamp(),
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId,
      });

      logger.log(`[Devolución] ${devolucion.numeroDevolucion} aprobada por ${userId}`);

      actividadService.registrar({
        tipo: 'devolucion_aprobada',
        mensaje: `Devolución ${devolucion.numeroDevolucion} aprobada`,
        userId,
        displayName: userId,
        metadata: { entidadId: devolucionId, entidadTipo: 'devolucion' },
      }).catch(() => {});
    } catch (error: any) {
      logger.error('[devolucionService.aprobar] Error:', error);
      throw new Error(error.message || 'Error al aprobar la devolución');
    }
  },

  // ==============================================================
  // RECHAZAR — Paso 2b: Admin rechaza la solicitud
  // ==============================================================

  /**
   * Rechaza una solicitud de devolución en estado 'solicitada'.
   */
  async rechazar(
    devolucionId: string,
    motivoRechazo: string,
    userId: string
  ): Promise<void> {
    try {
      const devolucion = await _getDevolucionOrThrow(devolucionId);

      if (devolucion.estado !== 'solicitada') {
        throw new Error(
          `Solo se pueden rechazar devoluciones en estado 'solicitada'. ` +
          `Estado actual: '${devolucion.estado}'`
        );
      }

      if (!motivoRechazo?.trim()) {
        throw new Error('El motivo de rechazo es obligatorio');
      }

      await updateDoc(doc(db, COLLECTION_NAME, devolucionId), {
        estado: 'rechazada' as EstadoDevolucion,
        motivoRechazo: motivoRechazo.trim(),
        rechazadoPor: userId,
        fechaRechazo: serverTimestamp(),
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId,
      });

      logger.log(`[Devolución] ${devolucion.numeroDevolucion} rechazada por ${userId}`);

      actividadService.registrar({
        tipo: 'devolucion_rechazada',
        mensaje: `Devolución ${devolucion.numeroDevolucion} rechazada: ${motivoRechazo}`,
        userId,
        displayName: userId,
        metadata: { entidadId: devolucionId, entidadTipo: 'devolucion' },
      }).catch(() => {});
    } catch (error: any) {
      logger.error('[devolucionService.rechazar] Error:', error);
      throw new Error(error.message || 'Error al rechazar la devolución');
    }
  },

  // ==============================================================
  // EJECUTAR — Paso 3: Recepción física del producto
  // ==============================================================

  /**
   * Registra la recepción física del producto devuelto.
   *
   * Efectos en inventario:
   * - Condición 'vendible' → unidad pasa a 'disponible_peru', se limpian campos de venta.
   * - Condición 'danado'   → unidad pasa a 'danada', se limpian campos de venta.
   * - En ambos casos se agrega un movimiento 'devolucion' al historial de la unidad.
   *
   * Efectos en la venta:
   * - Si TODAS las unidades vendidas fueron devueltas → estado 'devuelta'.
   * - Si solo algunas fueron devueltas              → estado 'devolucion_parcial'.
   */
  async ejecutar(data: RecepcionDevolucionInput, userId: string): Promise<void> {
    try {
      const devolucion = await _getDevolucionOrThrow(data.devolucionId);

      if (devolucion.estado !== 'aprobada') {
        throw new Error(
          `Solo se pueden ejecutar devoluciones en estado 'aprobada'. ` +
          `Estado actual: '${devolucion.estado}'`
        );
      }

      const venta = await _getVentaOrThrow(devolucion.ventaId);

      // Coleccionar todos los IDs de unidades devueltas para recalcular stock
      const productosAfectados = new Set<string>();
      const todasLasUnidadesDevueltas: string[] = [];

      // Límite seguro: particionamos si hay muchas unidades (máx 450 ops por batch)
      const batch = writeBatch(db);
      let opsEnBatch = 0;

      const ahora = Timestamp.now();

      // Procesar cada grupo de unidades recibidas
      for (const grupo of data.productosRecibidos) {
        // Buscar la línea de producto en la devolución para actualizar unidadesIds
        const lineaDevolucion = devolucion.productos.find(
          p => p.productoId === grupo.productoId
        );
        if (!lineaDevolucion) {
          throw new Error(
            `El producto ${grupo.productoId} no está en la devolución ${devolucion.numeroDevolucion}`
          );
        }

        productosAfectados.add(grupo.productoId);
        todasLasUnidadesDevueltas.push(...grupo.unidadesIds);

        // Determinar el nuevo estado de la unidad según su condición
        const nuevoEstado = grupo.condicion === 'vendible'
          ? 'disponible_peru'
          : 'danada';

        for (const unidadId of grupo.unidadesIds) {
          const unidadRef = doc(db, COLLECTIONS.UNIDADES, unidadId);
          const unidadSnap = await getDoc(unidadRef);

          if (!unidadSnap.exists()) {
            logger.warn(`[ejecutar] Unidad ${unidadId} no encontrada — se omite`);
            continue;
          }

          const unidadData = unidadSnap.data();
          const movimientoDevolucion = {
            id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            tipo: 'devolucion' as const,
            fecha: ahora,
            usuarioId: userId,
            observaciones: `Devuelta. Condición: ${grupo.condicion}. Devolución: ${devolucion.numeroDevolucion}`,
            documentoRelacionado: {
              tipo: 'venta' as const,
              id: devolucion.ventaId,
              numero: devolucion.ventaNumero,
            },
          };

          const movimientosActualizados = [
            ...(unidadData.movimientos || []),
            movimientoDevolucion,
          ];

          // Limpiar todos los campos de venta con deleteField()
          // para no dejar datos huérfanos (Firestore updateDoc no borra campos no mencionados)
          batch.update(unidadRef, {
            estado: nuevoEstado,
            movimientos: movimientosActualizados,
            ventaId: deleteField(),
            ventaNumero: deleteField(),
            fechaVenta: deleteField(),
            precioVentaPEN: deleteField(),
            reservadaPara: deleteField(),
            fechaReserva: deleteField(),
            reservaVigenciaHasta: deleteField(),
            fechaActualizacion: serverTimestamp(),
            actualizadoPor: userId,
          });

          opsEnBatch++;

          // Firestore admite 500 ops por batch; usamos margen de 450
          if (opsEnBatch >= 440) {
            logger.warn('[ejecutar] Batch cercano al límite — particionando (no implementado aún)');
            // En una implementación futura con más de 440 unidades se commit y se crea un nuevo batch.
            // Para el volumen actual del negocio esto no ocurrirá.
          }
        }
      }

      // Actualizar la devolución con los IDs de unidades recibidas y su condición
      const productosActualizados: ProductoDevolucion[] = devolucion.productos.map(prod => {
        const grupoRecibido = data.productosRecibidos.find(
          g => g.productoId === prod.productoId
        );
        if (!grupoRecibido) return prod;

        const vendibles = grupoRecibido.condicion === 'vendible'
          ? grupoRecibido.unidadesIds.length
          : 0;
        const danadas = grupoRecibido.condicion === 'danado'
          ? grupoRecibido.unidadesIds.length
          : 0;

        return {
          ...prod,
          unidadesIds: grupoRecibido.unidadesIds,
          condicion: grupoRecibido.condicion as CondicionProductoDevuelto,
          // ctruPromedio se podría calcular aquí si se necesita en el futuro
        };
      });

      // Determinar nuevo estado de la venta
      // Contar el total de unidades asignadas a la venta
      const totalUnidadesVendidas = venta.productos.reduce(
        (acc, p) => acc + (p.unidadesAsignadas?.length ?? p.cantidad),
        0
      );
      const totalUnidadesDevueltas = todasLasUnidadesDevueltas.length;

      const nuevoEstadoVenta =
        totalUnidadesDevueltas >= totalUnidadesVendidas
          ? 'devuelta'
          : 'devolucion_parcial';

      // Actualizar la devolución en el mismo batch
      const devolucionRef = doc(db, COLLECTION_NAME, data.devolucionId);
      batch.update(devolucionRef, {
        estado: 'ejecutada' as EstadoDevolucion,
        productos: productosActualizados,
        fechaEjecucion: serverTimestamp(),
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId,
      });

      // Actualizar la venta
      const ventaRef = doc(db, COLLECTIONS.VENTAS, devolucion.ventaId);
      batch.update(ventaRef, {
        estado: nuevoEstadoVenta,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId,
      });

      await batch.commit();

      logger.log(
        `[Devolución] ${devolucion.numeroDevolucion} ejecutada. ` +
        `${todasLasUnidadesDevueltas.length} unidades recibidas. ` +
        `Venta → ${nuevoEstadoVenta}`
      );

      // Sincronizar stock de productos afectados (fire-and-forget)
      if (productosAfectados.size > 0) {
        inventarioService
          .sincronizarStockProductos_batch([...productosAfectados])
          .catch(e =>
            logger.error('[ejecutar] Error sincronizando stock post-devolución:', e)
          );
      }

      actividadService.registrar({
        tipo: 'devolucion_ejecutada',
        mensaje:
          `Devolución ${devolucion.numeroDevolucion} ejecutada. ` +
          `${todasLasUnidadesDevueltas.length} unidades recibidas.`,
        userId,
        displayName: userId,
        metadata: { entidadId: data.devolucionId, entidadTipo: 'devolucion' },
      }).catch(() => {});
    } catch (error: any) {
      logger.error('[devolucionService.ejecutar] Error:', error);
      throw new Error(error.message || 'Error al ejecutar la devolución');
    }
  },

  // ==============================================================
  // DEVOLVER DINERO — Paso 4: Registrar egreso y completar ciclo
  // ==============================================================

  /**
   * Registra el egreso de dinero en tesorería y marca la devolución como completada.
   * Solo se puede completar una devolución en estado 'ejecutada'.
   */
  async devolverDinero(data: DevolucionDineroInput, userId: string): Promise<void> {
    try {
      const devolucion = await _getDevolucionOrThrow(data.devolucionId);

      if (devolucion.estado !== 'ejecutada') {
        throw new Error(
          `Solo se puede devolver el dinero de una devolución en estado 'ejecutada'. ` +
          `Estado actual: '${devolucion.estado}'`
        );
      }

      if (data.monto <= 0) {
        throw new Error('El monto a devolver debe ser mayor a 0');
      }

      // Mapeo de MetodoPago → MetodoTesoreria
      const metodoTesoreriaMap: Record<string, string> = {
        efectivo: 'efectivo',
        transferencia: 'transferencia_bancaria',
        yape: 'yape',
        plin: 'plin',
        tarjeta: 'tarjeta',
        mercado_pago: 'mercado_pago',
        paypal: 'paypal',
        zelle: 'zelle',
        otro: 'otro',
      };
      const metodoTesoreria = metodoTesoreriaMap[data.metodoPago] ?? 'efectivo';

      // Método en USD solo para paypal/zelle
      const metodosUSD = ['paypal', 'zelle'];
      const moneda = metodosUSD.includes(data.metodoPago) ? 'USD' : 'PEN';

      const tipoCambio = await tipoCambioService.resolverTCVenta();

      let tesoreriaMovimientoId: string | undefined;
      try {
        tesoreriaMovimientoId = await tesoreriaService.registrarMovimiento(
          {
            tipo: 'gasto_operativo',
            moneda: moneda as 'PEN' | 'USD',
            monto: data.monto,
            tipoCambio,
            metodo: metodoTesoreria as any,
            concepto: `Devolución ${devolucion.numeroDevolucion} — venta ${devolucion.ventaNumero}`,
            fecha: new Date(),
            referencia: data.referencia,
            notas: data.notas ?? `Devolución de dinero al cliente ${devolucion.clienteNombre}`,
            ventaId: devolucion.ventaId,
            cuentaOrigen: data.cuentaOrigenId,
          },
          userId
        );
      } catch (tesoreriaError: any) {
        logBackgroundError(
          'tesoreria.devolverDinero',
          tesoreriaError,
          'critical',
          {
            devolucionId: data.devolucionId,
            devolucionNumero: devolucion.numeroDevolucion,
            monto: data.monto,
            accionRequerida: 'Registrar egreso manualmente en tesorería',
          }
        );
        logger.error('[devolverDinero] Error registrando en tesorería:', tesoreriaError);
        // No relanzo: el negocio puede querer marcar la devolución como completada
        // aunque tesorería falle; el error queda en _errorLog para revisión.
      }

      await updateDoc(doc(db, COLLECTION_NAME, data.devolucionId), {
        estado: 'completada' as EstadoDevolucion,
        montoDevuelto: data.monto,
        metodoPago: data.metodoPago,
        ...(data.referencia ? { referenciaPago: data.referencia } : {}),
        ...(data.cuentaOrigenId ? { cuentaOrigenId: data.cuentaOrigenId } : {}),
        ...(tesoreriaMovimientoId ? { tesoreriaMovimientoId } : {}),
        fechaCompletado: serverTimestamp(),
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId,
      });

      logger.log(
        `[Devolución] ${devolucion.numeroDevolucion} completada. ` +
        `Devuelto: S/${data.monto} vía ${data.metodoPago}`
      );

      actividadService.registrar({
        tipo: 'devolucion_completada',
        mensaje:
          `Devolución ${devolucion.numeroDevolucion} completada. ` +
          `S/${data.monto} devueltos al cliente ${devolucion.clienteNombre}`,
        userId,
        displayName: userId,
        metadata: { entidadId: data.devolucionId, entidadTipo: 'devolucion' },
      }).catch(() => {});
    } catch (error: any) {
      logger.error('[devolucionService.devolverDinero] Error:', error);
      throw new Error(error.message || 'Error al registrar la devolución de dinero');
    }
  },

  // ==============================================================
  // CANCELAR — Solo en estado 'solicitada'
  // ==============================================================

  /**
   * Cancela una solicitud de devolución en estado 'solicitada'.
   * Una vez aprobada/rechazada/ejecutada, no se puede cancelar.
   */
  async cancelar(
    devolucionId: string,
    motivo: string,
    userId: string
  ): Promise<void> {
    try {
      const devolucion = await _getDevolucionOrThrow(devolucionId);

      if (devolucion.estado !== 'solicitada') {
        throw new Error(
          `Solo se pueden cancelar devoluciones en estado 'solicitada'. ` +
          `Estado actual: '${devolucion.estado}'`
        );
      }

      if (!motivo?.trim()) {
        throw new Error('El motivo de cancelación es obligatorio');
      }

      await updateDoc(doc(db, COLLECTION_NAME, devolucionId), {
        estado: 'cancelada' as EstadoDevolucion,
        motivoCancelacion: motivo.trim(),
        canceladoPor: userId,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId,
      });

      logger.log(`[Devolución] ${devolucion.numeroDevolucion} cancelada por ${userId}`);

      actividadService.registrar({
        tipo: 'devolucion_cancelada',
        mensaje: `Devolución ${devolucion.numeroDevolucion} cancelada: ${motivo}`,
        userId,
        displayName: userId,
        metadata: { entidadId: devolucionId, entidadTipo: 'devolucion' },
      }).catch(() => {});
    } catch (error: any) {
      logger.error('[devolucionService.cancelar] Error:', error);
      throw new Error(error.message || 'Error al cancelar la devolución');
    }
  },

  // ==============================================================
  // CONSULTAS
  // ==============================================================

  /**
   * Obtiene una devolución por ID.
   * Devuelve null si no existe (no lanza).
   */
  async getById(id: string): Promise<Devolucion | null> {
    try {
      const snap = await getDoc(doc(db, COLLECTION_NAME, id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Devolucion;
    } catch (error: any) {
      logger.error('[devolucionService.getById] Error:', error);
      throw new Error(error.message || 'Error al obtener la devolución');
    }
  },

  /**
   * Obtiene todas las devoluciones vinculadas a una venta específica.
   */
  async getByVenta(ventaId: string): Promise<Devolucion[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('ventaId', '==', ventaId),
        orderBy('fechaCreacion', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Devolucion));
    } catch (error: any) {
      logger.error('[devolucionService.getByVenta] Error:', error);
      throw new Error(error.message || 'Error al obtener devoluciones de la venta');
    }
  },

  /**
   * Obtiene todas las devoluciones con filtros opcionales.
   * Los filtros por fecha se aplican en memoria para evitar índices compuestos adicionales.
   */
  async getAll(filtros?: DevolucionFiltros): Promise<Devolucion[]> {
    try {
      let q = query(
        collection(db, COLLECTION_NAME),
        orderBy('fechaCreacion', 'desc')
      );

      // Filtros que Firestore puede resolver directamente
      if (filtros?.estado) {
        q = query(q, where('estado', '==', filtros.estado));
      }
      if (filtros?.ventaId) {
        q = query(q, where('ventaId', '==', filtros.ventaId));
      }
      if (filtros?.clienteId) {
        q = query(q, where('clienteId', '==', filtros.clienteId));
      }
      if (filtros?.lineaNegocioId) {
        q = query(q, where('lineaNegocioId', '==', filtros.lineaNegocioId));
      }
      if (filtros?.motivo) {
        q = query(q, where('motivo', '==', filtros.motivo));
      }

      const snap = await getDocs(q);
      let devoluciones = snap.docs.map(
        d => ({ id: d.id, ...d.data() } as Devolucion)
      );

      // Filtros por rango de fecha (en memoria)
      if (filtros?.fechaDesde) {
        const desde = Timestamp.fromDate(filtros.fechaDesde);
        devoluciones = devoluciones.filter(
          d => d.fechaCreacion >= desde
        );
      }
      if (filtros?.fechaHasta) {
        const hasta = Timestamp.fromDate(filtros.fechaHasta);
        devoluciones = devoluciones.filter(
          d => d.fechaCreacion <= hasta
        );
      }

      return devoluciones;
    } catch (error: any) {
      logger.error('[devolucionService.getAll] Error:', error);
      throw new Error(error.message || 'Error al obtener las devoluciones');
    }
  },

  /**
   * Calcula estadísticas de devoluciones para un mes y año dados.
   */
  async getStats(mes: number, anio: number): Promise<DevolucionStats> {
    try {
      // Rango del mes solicitado
      const inicio = new Date(anio, mes - 1, 1);
      const fin = new Date(anio, mes, 1);

      const devoluciones = await this.getAll({
        fechaDesde: inicio,
        fechaHasta: fin,
      });

      const stats: DevolucionStats = {
        total: devoluciones.length,
        porEstado: {
          solicitada: 0,
          aprobada: 0,
          rechazada: 0,
          ejecutada: 0,
          completada: 0,
          cancelada: 0,
        },
        montoTotalSolicitado: 0,
        montoTotalDevuelto: 0,
        porMotivo: {},
        productosVendibles: 0,
        productosDanados: 0,
      };

      for (const dev of devoluciones) {
        stats.porEstado[dev.estado] = (stats.porEstado[dev.estado] ?? 0) + 1;
        stats.montoTotalSolicitado += dev.montoDevolucion;
        stats.montoTotalDevuelto += dev.montoDevuelto;
        stats.porMotivo[dev.motivo] = (stats.porMotivo[dev.motivo] ?? 0) + 1;

        for (const prod of dev.productos) {
          if (prod.condicion === 'vendible') {
            stats.productosVendibles += prod.unidadesIds.length;
          } else if (prod.condicion === 'danado') {
            stats.productosDanados += prod.unidadesIds.length;
          }
        }
      }

      return stats;
    } catch (error: any) {
      logger.error('[devolucionService.getStats] Error:', error);
      throw new Error(error.message || 'Error al calcular estadísticas de devoluciones');
    }
  },
};
