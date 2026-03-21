import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  Timestamp,
  orderBy,
  limit,
  writeBatch,
  arrayUnion,
  onSnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type {
  Entrega,
  ProgramarEntregaData,
  ResultadoEntregaData,
  ResumenEntregasVenta,
  EntregaStats,
  EntregaFilters,
  EstadoEntrega
} from '../types/entrega.types';
import type { Venta, EstadoVenta } from '../types/venta.types';
import type { Unidad, MovimientoUnidad } from '../types/unidad.types';
import { transportistaService } from './transportista.service';
import { movimientoTransportistaService } from './movimiento-transportista.service';
import { gastoService } from './gasto.service';
import { unidadService } from './unidad.service';
import { tesoreriaService } from './tesoreria.service';
import { auditoriaService } from './auditoria.service';
import { inventarioService } from './inventario.service';
import { actividadService } from './actividad.service';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import { logBackgroundError } from '../lib/logger';
import { logger } from '../lib/logger';

const COLLECTION_NAME = COLLECTIONS.ENTREGAS;

/**
 * Genera el siguiente código de entrega automáticamente
 * ENT-2024-001, ENT-2024-002, etc.
 */
async function generarCodigoEntrega(): Promise<string> {
  const year = new Date().getFullYear();
  return getNextSequenceNumber(`ENT-${year}`, 3);
}

export const entregaService = {
  // ============================================
  // CRUD BÁSICO
  // ============================================

  async getAll(): Promise<Entrega[]> {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const entregas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Entrega));

    // Ordenar por fecha programada descendente
    return entregas.sort((a, b) => {
      const fechaA = a.fechaProgramada?.toMillis() || 0;
      const fechaB = b.fechaProgramada?.toMillis() || 0;
      return fechaB - fechaA;
    });
  },

  /**
   * Obtener entregas programadas o reprogramadas (pendientes de despacho).
   */
  async getProgramadas(): Promise<Entrega[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('estado', 'in', ['programada', 'reprogramada']),
      orderBy('fechaProgramada', 'desc'),
      limit(100)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as Entrega));
  },

  /**
   * Suscripción en tiempo real a entregas activas (no finalizadas).
   * Escucha cambios en entregas con estado programada, en_camino o reprogramada.
   */
  suscribirEntregasActivas(
    callback: (entregas: Entrega[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('estado', 'in', ['programada', 'en_camino', 'reprogramada']),
      orderBy('fechaProgramada', 'desc'),
      limit(200)
    );

    return onSnapshot(q, (snapshot) => {
      const entregas = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Entrega));
      callback(entregas);
    }, (error) => {
      logger.error('Error en suscripción de entregas:', error);
    });
  },

  async getById(id: string): Promise<Entrega | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    } as Entrega;
  },

  async getByCodigo(codigo: string): Promise<Entrega | null> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('codigo', '==', codigo)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const docSnap = snapshot.docs[0];
    return {
      id: docSnap.id,
      ...docSnap.data()
    } as Entrega;
  },

  async getByVenta(ventaId: string): Promise<Entrega[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('ventaId', '==', ventaId)
    );
    const snapshot = await getDocs(q);
    const entregas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Entrega));

    // Ordenar por número de entrega
    return entregas.sort((a, b) => a.numeroEntrega - b.numeroEntrega);
  },

  async getByTransportista(transportistaId: string): Promise<Entrega[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('transportistaId', '==', transportistaId)
    );
    const snapshot = await getDocs(q);
    const entregas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Entrega));

    return entregas.sort((a, b) => {
      const fechaA = a.fechaProgramada?.toMillis() || 0;
      const fechaB = b.fechaProgramada?.toMillis() || 0;
      return fechaB - fechaA;
    });
  },

  async getPendientes(): Promise<Entrega[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('estado', 'in', ['programada', 'en_camino', 'reprogramada'])
    );
    const snapshot = await getDocs(q);
    const entregas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Entrega));

    // Ordenar por fecha programada ascendente (próximas primero)
    return entregas.sort((a, b) => {
      const fechaA = a.fechaProgramada?.toMillis() || 0;
      const fechaB = b.fechaProgramada?.toMillis() || 0;
      return fechaA - fechaB;
    });
  },

  async getDelDia(fecha?: Date): Promise<Entrega[]> {
    const dia = fecha || new Date();
    const inicioDelDia = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 0, 0, 0);
    const finDelDia = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 23, 59, 59);

    const q = query(
      collection(db, COLLECTION_NAME),
      where('fechaProgramada', '>=', Timestamp.fromDate(inicioDelDia)),
      where('fechaProgramada', '<=', Timestamp.fromDate(finDelDia))
    );
    const snapshot = await getDocs(q);
    const entregas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Entrega));

    return entregas.sort((a, b) => a.nombreTransportista.localeCompare(b.nombreTransportista));
  },

  async search(filters: EntregaFilters): Promise<Entrega[]> {
    let q = query(collection(db, COLLECTION_NAME));

    if (filters.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }

    if (filters.transportistaId) {
      q = query(q, where('transportistaId', '==', filters.transportistaId));
    }

    if (filters.ventaId) {
      q = query(q, where('ventaId', '==', filters.ventaId));
    }

    if (filters.cobroPendiente !== undefined) {
      q = query(q, where('cobroPendiente', '==', filters.cobroPendiente));
    }

    const snapshot = await getDocs(q);
    let entregas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Entrega));

    // Filtros de fecha (cliente)
    if (filters.fechaDesde) {
      const desde = Timestamp.fromDate(filters.fechaDesde);
      entregas = entregas.filter(e => e.fechaProgramada && e.fechaProgramada >= desde);
    }

    if (filters.fechaHasta) {
      const hasta = Timestamp.fromDate(filters.fechaHasta);
      entregas = entregas.filter(e => e.fechaProgramada && e.fechaProgramada <= hasta);
    }

    if (filters.distrito) {
      entregas = entregas.filter(e =>
        e.distrito?.toLowerCase().includes(filters.distrito!.toLowerCase())
      );
    }

    return entregas.sort((a, b) => {
      const fechaA = a.fechaProgramada?.toMillis() || 0;
      const fechaB = b.fechaProgramada?.toMillis() || 0;
      return fechaB - fechaA;
    });
  },

  // ============================================
  // PROGRAMAR ENTREGA
  // ============================================

  async programar(
    data: ProgramarEntregaData,
    venta: Venta,
    userId: string
  ): Promise<string> {
    // Obtener transportista
    const transportista = await transportistaService.getById(data.transportistaId);
    if (!transportista) {
      throw new Error('Transportista no encontrado');
    }

    // Contar entregas previas de esta venta
    const entregasPrevias = await this.getByVenta(data.ventaId);
    const numeroEntrega = entregasPrevias.length + 1;

    // =============================================
    // VALIDACION: Prevenir asignacion duplicada de unidades
    // =============================================
    const activeEntregas = entregasPrevias.filter(e => e.estado !== 'cancelada');
    const allAssignedUnits = new Set<string>();
    const quantityByProduct: Record<string, number> = {};

    for (const ent of activeEntregas) {
      for (const prod of ent.productos) {
        (prod.unidadesAsignadas || []).forEach(uid => allAssignedUnits.add(uid));
        quantityByProduct[prod.productoId] = (quantityByProduct[prod.productoId] || 0) + prod.cantidad;
      }
    }

    // Verificar que las unidades no esten ya asignadas a otra entrega
    for (const p of data.productos) {
      for (const uid of p.unidadesAsignadas) {
        if (allAssignedUnits.has(uid)) {
          throw new Error(
            `Unidad ${uid.slice(0, 8)}... ya esta asignada a otra entrega. ` +
            `Recargue la ventana e intente de nuevo.`
          );
        }
      }
    }

    // Verificar que las cantidades no excedan lo disponible
    for (const p of data.productos) {
      const productoVenta = venta.productos.find(pv => pv.productoId === p.productoId);
      if (productoVenta) {
        const yaAsignado = quantityByProduct[p.productoId] || 0;
        const disponible = productoVenta.cantidad - yaAsignado;
        if (p.cantidad > disponible) {
          throw new Error(
            `${productoVenta.nombreComercial}: solo quedan ${disponible} unidad(es) por entregar, ` +
            `pero se intentan asignar ${p.cantidad}.`
          );
        }
      }
    }

    // Generar codigo
    const codigo = await generarCodigoEntrega();

    // =============================================
    // ISSUE 6: Fallback de costo del transportista
    // =============================================
    let costoFinal = data.costoTransportista;
    if (costoFinal === 0 && transportista.costoFijo && transportista.costoFijo > 0) {
      costoFinal = transportista.costoFijo;
      logger.warn(`[Entrega] costoTransportista era 0, usando costoFijo del transportista: S/${costoFinal}`);
    }

    // Construir productos de la entrega
    const productosEntrega = data.productos.map(p => {
      const productoVenta = venta.productos.find(pv => pv.productoId === p.productoId);
      if (!productoVenta) {
        throw new Error(`Producto ${p.productoId} no encontrado en la venta`);
      }
      return {
        productoId: p.productoId,
        sku: productoVenta.sku,
        marca: productoVenta.marca,
        nombreComercial: productoVenta.nombreComercial,
        presentacion: productoVenta.presentacion,
        cantidad: p.cantidad,
        unidadesAsignadas: p.unidadesAsignadas,
        precioUnitario: productoVenta.precioUnitario,
        subtotal: p.cantidad * productoVenta.precioUnitario
      };
    });

    const cantidadItems = productosEntrega.reduce((sum, p) => sum + p.cantidad, 0);
    const subtotalPEN = productosEntrega.reduce((sum, p) => sum + p.subtotal, 0);

    const now = Timestamp.now();

    const newEntrega: Record<string, unknown> = {
      codigo,
      ventaId: data.ventaId,
      numeroVenta: venta.numeroVenta,
      numeroEntrega,
      // Transportista
      transportistaId: data.transportistaId,
      nombreTransportista: transportista.nombre,
      tipoTransportista: transportista.tipo,
      // Cliente
      nombreCliente: venta.nombreCliente,
      // Dirección
      direccionEntrega: data.direccionEntrega,
      // Productos
      productos: productosEntrega,
      cantidadItems,
      subtotalPEN,
      // Cobro
      cobroPendiente: data.cobroPendiente,
      // Costo
      costoTransportista: costoFinal,
      // Estado
      estado: 'programada' as EstadoEntrega,
      fechaProgramada: Timestamp.fromDate(data.fechaProgramada),
      // Auditoría
      creadoPor: userId,
      fechaCreacion: now
    };

    // Agregar campos opcionales solo si tienen valor (Firebase no acepta undefined)
    if (transportista.telefono) newEntrega.telefonoTransportista = transportista.telefono;
    if (transportista.courierExterno) newEntrega.courierExterno = transportista.courierExterno;
    if (venta.telefonoCliente) newEntrega.telefonoCliente = venta.telefonoCliente;
    if (venta.emailCliente) newEntrega.emailCliente = venta.emailCliente;
    if (data.distrito) newEntrega.distrito = data.distrito;
    if (data.provincia) newEntrega.provincia = data.provincia;
    if (data.codigoPostal) newEntrega.codigoPostal = data.codigoPostal;
    if (data.referencia) newEntrega.referencia = data.referencia;
    if (data.montoPorCobrar !== undefined) newEntrega.montoPorCobrar = data.montoPorCobrar;
    if (data.metodoPagoEsperado) newEntrega.metodoPagoEsperado = data.metodoPagoEsperado;
    if (data.horaProgramada) newEntrega.horaProgramada = data.horaProgramada;
    if (data.observaciones) newEntrega.observaciones = data.observaciones;
    if (data.coordenadas) newEntrega.coordenadas = data.coordenadas;
    // Propagar línea de negocio desde venta
    if (venta.lineaNegocioId) newEntrega.lineaNegocioId = venta.lineaNegocioId;
    if (venta.lineaNegocioNombre) newEntrega.lineaNegocioNombre = venta.lineaNegocioNombre;
    if (data.costoEnvio && data.costoEnvio > 0) newEntrega.costoEnvio = data.costoEnvio;

    const docRef = await addDoc(collection(db, COLLECTION_NAME), newEntrega);

    // Actualizar el estado de la venta a "en_entrega"
    const ventaRef = doc(db, COLLECTIONS.VENTAS, data.ventaId);
    const ventaUpdateData: Record<string, unknown> = {
      estado: 'en_entrega',
      editadoPor: userId,
      ultimaEdicion: Timestamp.now()
    };
    // Solo registrar fechaEnEntrega la primera vez que entra a en_entrega
    if (venta.estado !== 'en_entrega') {
      ventaUpdateData.fechaEnEntrega = Timestamp.now();
    }
    await updateDoc(ventaRef, ventaUpdateData);

    // NOTA: El gasto GD se crea al despachar (marcarEnCamino), no al programar.
    // El costoTransportista ya queda guardado en el documento de entrega.

    // Broadcast actividad (fire-and-forget)
    actividadService.registrar({
      tipo: 'entrega_programada',
      mensaje: `Entrega ${codigo} programada para ${venta.nombreCliente} - ${transportista.nombre}`,
      userId,
      displayName: userId,
      metadata: { entidadId: docRef.id, entidadTipo: 'entrega' }
    }).catch(() => {});

    return docRef.id;
  },

  // ============================================
  // ACTUALIZAR ESTADO
  // ============================================

  async marcarEnCamino(id: string, userId: string): Promise<void> {
    const entrega = await this.getById(id);
    if (!entrega) throw new Error('Entrega no encontrada');

    const batch = writeBatch(db);
    const entregaRef = doc(db, COLLECTION_NAME, id);

    // Update entrega → en_camino
    batch.update(entregaRef, {
      estado: 'en_camino',
      fechaSalida: Timestamp.now(),
      editadoPor: userId,
      ultimaEdicion: Timestamp.now()
    });

    // Update venta → despachada (only on first dispatch)
    const ventaRef = doc(db, COLLECTIONS.VENTAS, entrega.ventaId);
    const ventaSnap = await getDoc(ventaRef);
    if (ventaSnap.exists()) {
      const venta = ventaSnap.data() as Venta;
      if (venta.estado === 'en_entrega') {
        batch.update(ventaRef, {
          estado: 'despachada',
          fechaDespacho: Timestamp.now(),
          editadoPor: userId,
          ultimaEdicion: Timestamp.now()
        });
      }
    }

    await batch.commit();

    // Crear gasto GD al despachar (momento unificado para registrar el costo de delivery)
    if (!entrega.gastoDistribucionId && entrega.costoTransportista > 0) {
      try {
        const gastoId = await gastoService.crearGastoDistribucion({
          entregaId: id,
          entregaCodigo: entrega.codigo,
          ventaId: entrega.ventaId,
          ventaNumero: entrega.numeroVenta,
          transportistaId: entrega.transportistaId,
          transportistaNombre: entrega.nombreTransportista,
          costoEntrega: entrega.costoTransportista,
          distrito: entrega.distrito
        }, userId);

        await updateDoc(entregaRef, { gastoDistribucionId: gastoId });
        logger.log(`[Entrega ${entrega.codigo}] Gasto GD creado al despachar: ${gastoId} por S/${entrega.costoTransportista.toFixed(2)}`);
      } catch (error) {
        logger.error(`[Entrega ${entrega.codigo}] Error creando gasto GD al despachar:`, error);
      }
    }
  },

  async registrarResultado(data: ResultadoEntregaData, userId: string): Promise<void> {
    const entrega = await this.getById(data.entregaId);
    if (!entrega) {
      throw new Error('Entrega no encontrada');
    }

    const docRef = doc(db, COLLECTION_NAME, data.entregaId);
    const now = Timestamp.now();

    if (data.exitosa) {
      // ============================================
      // ENTREGA EXITOSA - FLUJO ATÓMICO
      // ============================================

      // 1. Calcular tiempo de entrega
      // Si se completa directamente desde 'programada', usar now como salida
      const fechaSalidaEfectiva = entrega.fechaSalida || now;
      let tiempoEntregaMinutos: number | undefined;
      const salida = fechaSalidaEfectiva.toMillis();
      const llegada = data.fechaEntrega
        ? new Date(data.fechaEntrega).getTime()
        : Date.now();
      const minutos = Math.round((llegada - salida) / 60000);
      // Solo registrar si el tiempo es positivo (evitar metricas negativas en retroactivos)
      if (minutos > 0) {
        tiempoEntregaMinutos = minutos;
      }

      // 2. Pre-lectura de unidades (necesarias para construir el batch)
      const unidadIds = entrega.productos.flatMap(p => p.unidadesAsignadas || []);
      const unidadesMap = new Map<string, Unidad>();
      const productosAfectados = new Set<string>();

      for (const unidadId of unidadIds) {
        const unidad = await unidadService.getById(unidadId);
        if (unidad) {
          unidadesMap.set(unidadId, unidad);
          productosAfectados.add(unidad.productoId);
        }
      }

      // 3. Pre-calcular estado de venta post-entrega
      const estadoVentaPost = await this.calcularEstadoVentaPostEntrega(
        entrega.ventaId,
        entrega.cantidadItems
      );

      // ============================================
      // FASE A: BATCH ATÓMICO (todo o nada)
      // Entrega + Unidades + Venta en una sola operación
      // ============================================
      const batch = writeBatch(db);

      // A1. Actualizar estado de la entrega
      const entregaUpdate: Record<string, unknown> = {
        estado: 'entregada',
        fechaEntrega: data.fechaEntrega
          ? Timestamp.fromDate(data.fechaEntrega)
          : now,
        editadoPor: userId,
        ultimaEdicion: now
      };

      // Si fechaSalida nunca se registro (completado desde 'programada'),
      // usar la misma fecha de entrega para que el registro quede completo
      if (!entrega.fechaSalida) {
        entregaUpdate.fechaSalida = entregaUpdate.fechaEntrega;
      }

      if (tiempoEntregaMinutos !== undefined) {
        entregaUpdate.tiempoEntregaMinutos = tiempoEntregaMinutos;
      }
      if (data.fotoEntrega !== undefined) {
        entregaUpdate.fotoEntrega = data.fotoEntrega;
      }
      if (data.firmaCliente !== undefined) {
        entregaUpdate.firmaCliente = data.firmaCliente;
      }
      if (data.cobroRealizado !== undefined) {
        entregaUpdate.cobroRealizado = data.cobroRealizado;
      }
      if (data.montoRecaudado !== undefined) {
        entregaUpdate.montoRecaudado = data.montoRecaudado;
      }
      if (data.metodoPagoRecibido !== undefined) {
        entregaUpdate.metodoPagoRecibido = data.metodoPagoRecibido;
      }
      if (data.notasEntrega !== undefined) {
        entregaUpdate.notasEntrega = data.notasEntrega;
      }

      batch.update(docRef, entregaUpdate);

      // A2. Marcar unidades como vendidas (reservada → vendida)
      // Construir mapa unidadId → precioUnitario del producto correspondiente
      const preciosPorUnidad = new Map<string, number>();
      for (const producto of entrega.productos) {
        const precioProducto = producto.precioUnitario || 0;
        for (const uid of (producto.unidadesAsignadas || [])) {
          preciosPorUnidad.set(uid, precioProducto);
        }
      }
      // Fallback: si alguna unidad no tiene precio mapeado, usar promedio general
      const precioFallback = unidadIds.length > 0
        ? entrega.subtotalPEN / unidadIds.length
        : 0;

      for (const unidadId of unidadIds) {
        const unidad = unidadesMap.get(unidadId);
        if (!unidad) continue;

        const precioUnitario = preciosPorUnidad.get(unidadId) ?? precioFallback;

        const movimientoVenta: MovimientoUnidad = {
          id: crypto.randomUUID(),
          tipo: 'venta',
          fecha: now,
          almacenOrigen: unidad.almacenId,
          usuarioId: userId,
          observaciones: `Venta registrada: ${entrega.numeroVenta}`,
          documentoRelacionado: {
            tipo: 'venta',
            id: entrega.ventaId,
            numero: entrega.numeroVenta
          }
        };

        const unidadRef = doc(db, COLLECTIONS.UNIDADES, unidadId);
        batch.update(unidadRef, {
          estado: 'vendida',
          ventaId: entrega.ventaId,
          ventaNumero: entrega.numeroVenta,
          fechaVenta: now,
          precioVentaPEN: precioUnitario,
          movimientos: arrayUnion(movimientoVenta),
          actualizadoPor: userId,
          fechaActualizacion: now
        });
      }

      // A3. Actualizar estado de venta si corresponde
      if (estadoVentaPost.nuevoEstado) {
        const ventaRef = doc(db, COLLECTIONS.VENTAS, entrega.ventaId);
        const ventaUpdate: Record<string, unknown> = {
          estado: estadoVentaPost.nuevoEstado,
          editadoPor: userId,
          ultimaEdicion: now
        };
        // Si la venta pasa a entregada, usar la fecha real de entrega
        if (estadoVentaPost.nuevoEstado === 'entregada') {
          ventaUpdate.fechaEntrega = data.fechaEntrega
            ? Timestamp.fromDate(data.fechaEntrega)
            : now;
        }
        batch.update(ventaRef, ventaUpdate);
      }

      // Commit atómico: si falla, NADA se escribe
      await batch.commit();
      logger.log(`[Entrega ${entrega.codigo}] Batch atómico completado: entrega + ${unidadesMap.size} unidades${estadoVentaPost.nuevoEstado ? ` + venta → ${estadoVentaPost.nuevoEstado}` : ''}`);

      // ============================================
      // FASE B: OPERACIONES SECUNDARIAS (con try/catch individual)
      // Si algo falla, la entrega ya está registrada correctamente.
      // Se registran errores en _secondaryErrors para recuperación.
      // ============================================
      const secondaryErrors: string[] = [];

      // B1. Auditoría y sync de stock por unidad
      for (const unidadId of unidadIds) {
        const unidad = unidadesMap.get(unidadId);
        if (!unidad) continue;
        try {
          await auditoriaService.logInventario(
            unidad.productoId,
            unidad.productoNombre,
            'salida_inventario',
            1,
            unidad.almacenNombre
          );
        } catch (error) {
          secondaryErrors.push(`auditoria_unidad_${unidadId}: ${error}`);
        }
      }

      // B2. Sincronizar stock de productos afectados
      for (const productoId of productosAfectados) {
        try {
          await inventarioService.sincronizarStockProducto(productoId);
        } catch (error) {
          secondaryErrors.push(`sync_stock_${productoId}: ${error}`);
        }
      }

      // B2.5. Sincronizar stock hacia Mercado Libre (fire-and-forget)
      import('./mercadoLibre.service').then(({ mercadoLibreService }) => {
        for (const productoId of productosAfectados) {
          mercadoLibreService.syncStock(productoId)
            .then(r => { if (r.synced > 0) logger.log(`[ML Sync] Post-entrega: ${productoId} → ${r.synced} pubs actualizadas`); })
            .catch(e => {
              logger.error(`[ML Sync] Error post-entrega ${productoId}:`, e);
              logBackgroundError('mlSync.postEntrega', e, 'high', { productoId, entregaId: entrega.id });
            });
        }
      });

      // B3. Crear gasto GD solo si no se creó al programar (backwards compat)
      let gastoId: string | undefined = entrega.gastoDistribucionId;
      if (!gastoId) {
        try {
          gastoId = await gastoService.crearGastoDistribucion({
            entregaId: entrega.id,
            entregaCodigo: entrega.codigo,
            ventaId: entrega.ventaId,
            ventaNumero: entrega.numeroVenta,
            transportistaId: entrega.transportistaId,
            transportistaNombre: entrega.nombreTransportista,
            costoEntrega: entrega.costoTransportista || 0,
            distrito: entrega.distrito
          }, userId);

          await updateDoc(docRef, { gastoDistribucionId: gastoId });
          logger.log(`[Entrega ${entrega.codigo}] Gasto GD creado al completar (fallback): ${gastoId}`);
        } catch (error) {
          secondaryErrors.push(`gasto_gd: ${error}`);
        }
      }

      // B4. Registrar movimiento contable del transportista
      try {
        await movimientoTransportistaService.registrarEntregaExitosa(
          entrega,
          data.montoRecaudado,
          gastoId,
          userId
        );
      } catch (error) {
        secondaryErrors.push(`movimiento_transportista: ${error}`);
      }

      // B5. Actualizar métricas del transportista
      try {
        await transportistaService.registrarEntrega(
          entrega.transportistaId,
          true,
          tiempoEntregaMinutos || 0,
          entrega.costoTransportista,
          entrega.distrito
        );
      } catch (error) {
        secondaryErrors.push(`metricas_transportista: ${error}`);
      }

      // B6. Si se cobró en destino, registrar pago en la venta
      if (data.cobroRealizado && data.montoRecaudado && data.montoRecaudado > 0) {
        try {
          const { VentaService } = await import('./venta.service');
          const ventaActual = await VentaService.getById(entrega.ventaId);
          const montoACobrar = Math.min(data.montoRecaudado, ventaActual?.montoPendiente || 0);

          if (montoACobrar > 0) {
            const pago = await VentaService.registrarPago(
              entrega.ventaId,
              {
                monto: montoACobrar,
                metodoPago: data.metodoPagoRecibido || 'efectivo',
                referencia: `Cobro entrega ${entrega.codigo}`,
                notas: `Cobro en destino - ${entrega.nombreTransportista}`,
                cuentaDestinoId: data.cuentaDestinoId,
              },
              userId,
              true
            );
            await updateDoc(docRef, { referenciaCobroId: pago.id });
            logger.log(
              `[Entrega ${entrega.codigo}] Cobro de S/${montoACobrar.toFixed(2)} registrado. PagoId: ${pago.id}`
            );
          }
        } catch (cobroError) {
          secondaryErrors.push(`cobro_venta: ${cobroError}`);
        }
      }

      // B7. Reclasificar anticipos si la venta se marcó como entregada
      if (estadoVentaPost.nuevoEstado === 'entregada') {
        try {
          const ventaRef = doc(db, COLLECTIONS.VENTAS, entrega.ventaId);
          const ventaSnap = await getDoc(ventaRef);
          const venta = ventaSnap.data() as Venta;
          const reclasificados = await tesoreriaService.reclasificarAnticipos(
            entrega.ventaId,
            venta.cotizacionOrigenId,
            userId
          );
          if (reclasificados > 0) {
            logger.log(`[Entrega ${entrega.codigo}] ${reclasificados} anticipo(s) reclasificados a ingreso_venta`);
          }
        } catch (error) {
          secondaryErrors.push(`reclasificar_anticipos: ${error}`);
        }
      }

      // B8. Trigger CTRU recalc (fire-and-forget con lock)
      import('./ctru.service').then(({ ctruService }) => {
        ctruService.recalcularCTRUDinamicoSafe()
          .then(result => {
            if (result) {
              logger.log(`[CTRU] Auto-recalculo post-entrega: ${result.unidadesActualizadas} unidades`);
            }
          })
          .catch(error => {
            logger.error('[CTRU] Error en auto-recalculo post-entrega:', error);
            logBackgroundError('ctru.recalcPostEntrega', error, 'critical', { entregaId: entrega.id, entregaCodigo: entrega.codigo });
          });
      });

      // Registrar errores secundarios si hubo alguno
      if (secondaryErrors.length > 0) {
        logger.warn(`[Entrega ${entrega.codigo}] ${secondaryErrors.length} error(es) secundario(s):`, secondaryErrors);
        try {
          await updateDoc(docRef, {
            _secondaryErrors: secondaryErrors,
            _needsRecovery: true
          });
        } catch {
          logger.error(`[Entrega ${entrega.codigo}] No se pudieron registrar errores secundarios`);
        }
      }

      // Broadcast actividad (fire-and-forget)
      actividadService.registrar({
        tipo: 'entrega_completada',
        mensaje: `Entrega ${entrega.codigo} completada exitosamente - ${entrega.nombreCliente}`,
        userId,
        displayName: userId,
        metadata: { entidadId: data.entregaId, entidadTipo: 'entrega' }
      }).catch(() => {});

    } else {
      // ============================================
      // ENTREGA FALLIDA
      // ============================================

      const nuevoEstado = data.reprogramar ? 'reprogramada' : 'fallida';

      // 1. Actualizar estado de la entrega
      const updateData: Record<string, unknown> = {
        estado: nuevoEstado,
        motivoFallo: data.motivoFallo,
        descripcionFallo: data.descripcionFallo,
        notasEntrega: data.notasEntrega,
        editadoPor: userId,
        ultimaEdicion: now
      };

      if (data.reprogramar && data.nuevaFechaProgramada) {
        updateData.fechaProgramada = Timestamp.fromDate(data.nuevaFechaProgramada);
      }

      await updateDoc(docRef, updateData);

      // 2. Si NO se reprograma, anular el gasto GD asociado
      if (!data.reprogramar && entrega.gastoDistribucionId) {
        try {
          await gastoService.delete(entrega.gastoDistribucionId);
          logger.log(`[Entrega ${entrega.codigo}] Gasto GD anulado por entrega fallida: ${entrega.gastoDistribucionId}`);
        } catch (error) {
          logger.error(`[Entrega ${entrega.codigo}] Error anulando gasto GD:`, error);
        }
      }

      // 3. Si NO se reprograma, liberar las unidades
      if (!data.reprogramar) {
        const unidadIds = entrega.productos.flatMap(p => p.unidadesAsignadas || []);
        if (unidadIds.length > 0) {
          try {
            const motivo = `Entrega fallida: ${data.motivoFallo || 'sin especificar'}`;
            const resultadoLiberacion = await unidadService.liberarUnidades(
              unidadIds,
              motivo,
              userId
            );
            logger.log(`[Entrega ${entrega.codigo}] Unidades liberadas: ${resultadoLiberacion.exitos}/${unidadIds.length}`);
          } catch (error) {
            logger.error(`[Entrega ${entrega.codigo}] Error liberando unidades:`, error);
          }
        }
      }

      // 3. Registrar movimiento contable (solo historial, sin costo)
      try {
        await movimientoTransportistaService.registrarEntregaFallida(
          entrega,
          data.motivoFallo || 'Sin especificar',
          userId
        );
      } catch (error) {
        logger.error(`[Entrega ${entrega.codigo}] Error registrando fallo:`, error);
      }

      // 4. Actualizar métricas del transportista (fallo)
      await transportistaService.registrarEntrega(
        entrega.transportistaId,
        false,
        0,
        0, // No se cobra por entrega fallida
        entrega.distrito
      );

      // Broadcast actividad (fire-and-forget)
      actividadService.registrar({
        tipo: 'entrega_fallida',
        mensaje: `Entrega ${entrega.codigo} fallida: ${data.motivoFallo || 'sin especificar'}`,
        userId,
        displayName: userId,
        metadata: { entidadId: data.entregaId, entidadTipo: 'entrega' }
      }).catch(() => {});
    }
  },

  /**
   * Calcula qué estado debería tener la venta DESPUÉS de esta entrega,
   * sin escribir nada. Se usa ANTES del batch.commit() para incluir
   * la actualización de venta en el mismo batch atómico.
   */
  async calcularEstadoVentaPostEntrega(
    ventaId: string,
    itemsEntregaActual: number
  ): Promise<{ nuevoEstado: EstadoVenta | null; totalProductos: number; totalEntregados: number }> {
    try {
      const ventaRef = doc(db, COLLECTIONS.VENTAS, ventaId);
      const ventaSnap = await getDoc(ventaRef);

      if (!ventaSnap.exists()) {
        return { nuevoEstado: null, totalProductos: 0, totalEntregados: 0 };
      }

      const venta = ventaSnap.data() as Venta;
      const totalProductosVenta = venta.productos.reduce((sum, p) => sum + p.cantidad, 0);

      // Obtener entregas ya existentes de esta venta
      const entregas = await this.getByVenta(ventaId);

      // Sumar productos ya entregados (de entregas previas)
      let productosEntregados = 0;
      entregas.forEach(e => {
        if (e.estado === 'entregada') {
          productosEntregados += e.cantidadItems;
        }
      });

      // Sumar los items de la entrega actual (que aún no está en estado 'entregada')
      productosEntregados += itemsEntregaActual;

      let nuevoEstado: EstadoVenta | null = null;

      if (productosEntregados >= totalProductosVenta) {
        nuevoEstado = 'entregada';
      } else if (productosEntregados > 0 && venta.estado !== 'despachada') {
        nuevoEstado = 'despachada';
      }

      // Solo devolver nuevo estado si difiere del actual
      if (nuevoEstado && nuevoEstado !== venta.estado) {
        return { nuevoEstado, totalProductos: totalProductosVenta, totalEntregados: productosEntregados };
      }

      return { nuevoEstado: null, totalProductos: totalProductosVenta, totalEntregados: productosEntregados };
    } catch (error) {
      logger.error(`[calcularEstadoVentaPostEntrega] Error para venta ${ventaId}:`, error);
      return { nuevoEstado: null, totalProductos: 0, totalEntregados: 0 };
    }
  },

  /**
   * Verifica si todas las entregas de una venta están completas
   * y actualiza el estado de la venta a 'entregada' si corresponde
   */
  async actualizarEstadoVentaSiCompleta(ventaId: string, userId: string): Promise<void> {
    try {
      // Obtener la venta
      const ventaRef = doc(db, COLLECTIONS.VENTAS, ventaId);
      const ventaSnap = await getDoc(ventaRef);

      if (!ventaSnap.exists()) {
        logger.warn(`[actualizarEstadoVenta] Venta ${ventaId} no encontrada`);
        return;
      }

      const venta = ventaSnap.data() as Venta;

      // Calcular total de productos de la venta
      const totalProductosVenta = venta.productos.reduce((sum, p) => sum + p.cantidad, 0);

      // Obtener entregas de esta venta
      const entregas = await this.getByVenta(ventaId);

      // Calcular productos entregados (solo de entregas con estado 'entregada')
      let productosEntregados = 0;
      entregas.forEach(e => {
        if (e.estado === 'entregada') {
          productosEntregados += e.cantidadItems;
        }
      });

      logger.log(`[Venta ${venta.numeroVenta}] Productos: ${productosEntregados}/${totalProductosVenta} entregados`);

      // Determinar nuevo estado
      let nuevoEstado: EstadoVenta | null = null;

      if (productosEntregados >= totalProductosVenta) {
        // Todos los productos entregados → venta completa
        nuevoEstado = 'entregada';
      } else if (productosEntregados > 0) {
        // Algunos productos entregados → entrega parcial, mantener despachada
        nuevoEstado = 'despachada';
      }

      // Actualizar estado de la venta si cambió
      if (nuevoEstado && nuevoEstado !== venta.estado) {
        await updateDoc(ventaRef, {
          estado: nuevoEstado,
          editadoPor: userId,
          ultimaEdicion: Timestamp.now()
        });
        logger.log(`[Venta ${venta.numeroVenta}] Estado actualizado a: ${nuevoEstado}`);

        // Si la venta se marcó como entregada, reclasificar anticipos
        if (nuevoEstado === 'entregada') {
          try {
            const reclasificados = await tesoreriaService.reclasificarAnticipos(
              ventaId,
              venta.cotizacionOrigenId,
              userId
            );
            if (reclasificados > 0) {
              logger.log(`[actualizarEstadoVenta] ${reclasificados} anticipo(s) reclasificados a ingreso_venta`);
            }
          } catch (reclasError) {
            logger.warn('[actualizarEstadoVenta] Error al reclasificar anticipos:', reclasError);
          }
        }
      }
    } catch (error) {
      logger.error(`[actualizarEstadoVenta] Error para venta ${ventaId}:`, error);
    }
  },

  async cancelar(id: string, motivo: string, userId: string): Promise<void> {
    const entrega = await this.getById(id);
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      estado: 'cancelada',
      descripcionFallo: motivo,
      editadoPor: userId,
      ultimaEdicion: Timestamp.now()
    });

    // Anular gasto GD si existe
    if (entrega?.gastoDistribucionId) {
      try {
        await gastoService.delete(entrega.gastoDistribucionId);
        logger.log(`[Entrega ${entrega.codigo}] Gasto GD anulado por cancelación: ${entrega.gastoDistribucionId}`);
      } catch (error) {
        logger.error(`[Entrega ${entrega.codigo}] Error anulando gasto GD al cancelar:`, error);
      }
    }
  },

  // ============================================
  // TRACKING (para couriers externos)
  // ============================================

  async registrarTracking(id: string, numeroTracking: string, userId: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      numeroTracking,
      editadoPor: userId,
      ultimaEdicion: Timestamp.now()
    });
  },

  // ============================================
  // RESUMEN DE ENTREGAS POR VENTA
  // ============================================

  async getResumenVenta(ventaId: string): Promise<ResumenEntregasVenta> {
    // Obtener venta
    const ventaDoc = await getDoc(doc(db, COLLECTIONS.VENTAS, ventaId));
    if (!ventaDoc.exists()) {
      throw new Error('Venta no encontrada');
    }
    const venta = ventaDoc.data() as Venta;

    // Obtener entregas de la venta
    const entregas = await this.getByVenta(ventaId);

    // Calcular productos totales de la venta
    const totalProductos = venta.productos.reduce((sum, p) => sum + p.cantidad, 0);

    // Calcular productos ya entregados o en proceso
    let productosEntregados = 0;
    entregas.forEach(e => {
      if (e.estado === 'entregada') {
        productosEntregados += e.cantidadItems;
      }
    });

    // Costo total de distribución
    const costoTotalDistribucion = entregas.reduce((sum, e) => sum + e.costoTransportista, 0);

    return {
      ventaId,
      totalProductos,
      productosEntregados,
      productosPendientes: totalProductos - productosEntregados,
      entregas: entregas.map(e => ({
        entregaId: e.id,
        codigo: e.codigo,
        estado: e.estado,
        transportista: e.nombreTransportista,
        fecha: e.fechaProgramada,
        productos: e.cantidadItems
      })),
      costoTotalDistribucion,
      entregaCompleta: productosEntregados >= totalProductos
    };
  },

  // ============================================
  // ESTADÍSTICAS GENERALES
  // ============================================

  async getStats(fechaInicio: Date, fechaFin: Date): Promise<EntregaStats> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('fechaProgramada', '>=', Timestamp.fromDate(fechaInicio)),
      where('fechaProgramada', '<=', Timestamp.fromDate(fechaFin))
    );

    const snapshot = await getDocs(q);
    const entregas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Entrega));

    const entregasExitosas = entregas.filter(e => e.estado === 'entregada').length;
    const entregasFallidas = entregas.filter(e => e.estado === 'fallida').length;
    const entregasPendientes = entregas.filter(e =>
      ['programada', 'en_camino', 'reprogramada'].includes(e.estado)
    ).length;

    const tasaExito = entregas.length > 0
      ? (entregasExitosas / entregas.length) * 100
      : 0;

    // Tiempo y costo promedio
    const entregasConTiempo = entregas.filter(e => e.tiempoEntregaMinutos);
    const tiempoPromedioEntrega = entregasConTiempo.length > 0
      ? entregasConTiempo.reduce((sum, e) => sum + (e.tiempoEntregaMinutos || 0), 0) / entregasConTiempo.length
      : 0;

    const costoTotalDistribucion = entregas.reduce((sum, e) => sum + e.costoTransportista, 0);
    const costoPromedioEntrega = entregas.length > 0
      ? costoTotalDistribucion / entregas.length
      : 0;

    // Por transportista
    const transportistaMap: Record<string, { id: string; nombre: string; entregas: number; exitosas: number }> = {};
    entregas.forEach(e => {
      if (!transportistaMap[e.transportistaId]) {
        transportistaMap[e.transportistaId] = {
          id: e.transportistaId,
          nombre: e.nombreTransportista,
          entregas: 0,
          exitosas: 0
        };
      }
      transportistaMap[e.transportistaId].entregas++;
      if (e.estado === 'entregada') {
        transportistaMap[e.transportistaId].exitosas++;
      }
    });

    // Por zona
    const zonaMap: Record<string, { entregas: number; exitosas: number }> = {};
    entregas.forEach(e => {
      const zona = e.distrito || 'Sin zona';
      if (!zonaMap[zona]) {
        zonaMap[zona] = { entregas: 0, exitosas: 0 };
      }
      zonaMap[zona].entregas++;
      if (e.estado === 'entregada') {
        zonaMap[zona].exitosas++;
      }
    });

    return {
      periodo: {
        inicio: Timestamp.fromDate(fechaInicio),
        fin: Timestamp.fromDate(fechaFin)
      },
      totalEntregas: entregas.length,
      entregasExitosas,
      entregasFallidas,
      entregasPendientes,
      tasaExito,
      tiempoPromedioEntrega,
      costoPromedioEntrega,
      costoTotalDistribucion,
      porTransportista: Object.values(transportistaMap).map(t => ({
        transportistaId: t.id,
        nombre: t.nombre,
        entregas: t.entregas,
        exitosas: t.exitosas,
        tasaExito: t.entregas > 0 ? (t.exitosas / t.entregas) * 100 : 0
      })),
      porZona: Object.entries(zonaMap).map(([zona, data]) => ({
        zona,
        entregas: data.entregas,
        exitosas: data.exitosas
      }))
    };
  },

  // ============================================
  // PDF
  // ============================================

  /**
   * Registra la URL del PDF generado
   */
  async registrarPDF(
    id: string,
    tipo: 'guia_transportista' | 'cargo_cliente',
    url: string,
    userId: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const campo = tipo === 'guia_transportista' ? 'pdfGuiaTransportista' : 'pdfCargoCliente';

    await updateDoc(docRef, {
      [campo]: url,
      editadoPor: userId,
      ultimaEdicion: Timestamp.now()
    });
  },

  // ============================================
  // CÓDIGOS
  // ============================================

  async getProximoCodigo(): Promise<string> {
    return generarCodigoEntrega();
  },

  // ============================================
  // CORREGIR ENTREGA (transportista y/o tarifa)
  // ============================================

  async corregirEntrega(
    id: string,
    data: { transportistaId?: string; costoTransportista?: number },
    userId: string
  ): Promise<void> {
    const entrega = await this.getById(id);
    if (!entrega) {
      throw new Error('Entrega no encontrada');
    }

    const estadosEditables: EstadoEntrega[] = ['programada', 'en_camino', 'reprogramada', 'entregada'];
    if (!estadosEditables.includes(entrega.estado)) {
      throw new Error(`No se puede editar una entrega en estado "${entrega.estado}"`);
    }

    const costoAnterior = entrega.costoTransportista || 0;
    const costoNuevo = data.costoTransportista ?? costoAnterior;
    const transportistaCambio = !!(data.transportistaId && data.transportistaId !== entrega.transportistaId);

    const updates: Record<string, unknown> = {
      editadoPor: userId,
      ultimaEdicion: Timestamp.now()
    };

    let nombreTransportistaActualizado = entrega.nombreTransportista;

    // Actualizar transportista si cambio
    if (transportistaCambio) {
      const nuevoTransportista = await transportistaService.getById(data.transportistaId!);
      if (!nuevoTransportista) {
        throw new Error('Transportista no encontrado');
      }
      updates.transportistaId = nuevoTransportista.id;
      updates.nombreTransportista = nuevoTransportista.nombre;
      updates.tipoTransportista = nuevoTransportista.tipo;
      nombreTransportistaActualizado = nuevoTransportista.nombre;

      if (nuevoTransportista.telefono) {
        updates.telefonoTransportista = nuevoTransportista.telefono;
      }
      if (nuevoTransportista.courierExterno) {
        updates.courierExterno = nuevoTransportista.courierExterno;
      }
    }

    // Actualizar costo si cambio
    if (costoNuevo !== costoAnterior) {
      updates.costoTransportista = costoNuevo;
    }

    // Aplicar cambios a la entrega
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, updates);

    // ============================================
    // ACTUALIZAR GASTO GD ASOCIADO (cualquier estado)
    // ============================================
    if (entrega.gastoDistribucionId && (costoNuevo !== costoAnterior || transportistaCambio)) {
      const gastoUpdates: Record<string, unknown> = {
        editadoPor: userId,
        ultimaEdicion: Timestamp.now()
      };

      if (costoNuevo !== costoAnterior) {
        gastoUpdates.montoOriginal = costoNuevo;
        gastoUpdates.montoPEN = costoNuevo;
      }

      if (transportistaCambio) {
        gastoUpdates.transportistaId = data.transportistaId;
        gastoUpdates.transportistaNombre = nombreTransportistaActualizado;
        gastoUpdates.proveedor = nombreTransportistaActualizado;
        gastoUpdates.descripcion = `Entrega ${entrega.codigo} - ${nombreTransportistaActualizado}${entrega.distrito ? ` (${entrega.distrito})` : ''}`;
      }

      const gastoRef = doc(db, COLLECTIONS.GASTOS, entrega.gastoDistribucionId);
      await updateDoc(gastoRef, gastoUpdates);
      logger.log(`[Entrega ${entrega.codigo}] Gasto GD ${entrega.gastoDistribucionId} actualizado (estado: ${entrega.estado})`);
    }

    // ============================================
    // CASCADA ADICIONAL PARA ENTREGAS YA COMPLETADAS
    // ============================================
    if (entrega.estado === 'entregada') {

      // 1. Corregir metricas de transportistas
      try {
        if (transportistaCambio) {
          // Revertir metricas del transportista anterior
          await this.revertirMetricasTransportista(entrega.transportistaId, costoAnterior);
          logger.log(`[Entrega ${entrega.codigo}] Metricas revertidas para transportista anterior: ${entrega.nombreTransportista}`);

          // Acreditar metricas al nuevo transportista
          await transportistaService.registrarEntrega(
            data.transportistaId!,
            true,
            entrega.tiempoEntregaMinutos || 0,
            costoNuevo,
            entrega.distrito
          );
          logger.log(`[Entrega ${entrega.codigo}] Metricas asignadas a nuevo transportista: ${nombreTransportistaActualizado}`);
        } else if (costoNuevo !== costoAnterior) {
          // Solo cambio costo, mismo transportista: ajustar costoTotalHistorico
          await this.ajustarCostoTransportista(entrega.transportistaId, costoAnterior, costoNuevo);
          logger.log(`[Entrega ${entrega.codigo}] Costo ajustado en transportista: S/${costoAnterior} → S/${costoNuevo}`);
        }
      } catch (error) {
        logger.error(`[Entrega ${entrega.codigo}] Error actualizando metricas transportista:`, error);
      }

      // 3. Crear movimiento de ajuste contable
      try {
        const deltaCosto = costoNuevo - costoAnterior;

        if (transportistaCambio) {
          // Reversar movimiento del transportista anterior
          await movimientoTransportistaService.registrarAjuste(
            entrega.transportistaId,
            entrega.nombreTransportista,
            -costoAnterior, // reversar el costo original
            `Correccion ${entrega.codigo}: entrega reasignada a ${nombreTransportistaActualizado}`,
            entrega.id,
            entrega.codigo,
            userId
          );

          // Crear movimiento para el nuevo transportista
          await movimientoTransportistaService.registrarAjuste(
            data.transportistaId!,
            nombreTransportistaActualizado,
            costoNuevo,
            `Correccion ${entrega.codigo}: entrega reasignada desde ${entrega.nombreTransportista}`,
            entrega.id,
            entrega.codigo,
            userId
          );
          logger.log(`[Entrega ${entrega.codigo}] Movimientos de ajuste creados para ambos transportistas`);
        } else if (deltaCosto !== 0) {
          // Solo cambio costo: ajuste en el mismo transportista
          await movimientoTransportistaService.registrarAjuste(
            entrega.transportistaId,
            entrega.nombreTransportista,
            deltaCosto,
            `Correccion ${entrega.codigo}: tarifa ajustada S/${costoAnterior.toFixed(2)} → S/${costoNuevo.toFixed(2)}`,
            entrega.id,
            entrega.codigo,
            userId
          );
          logger.log(`[Entrega ${entrega.codigo}] Movimiento de ajuste creado: delta S/${deltaCosto.toFixed(2)}`);
        }
      } catch (error) {
        logger.error(`[Entrega ${entrega.codigo}] Error creando movimiento de ajuste:`, error);
      }
    }

    logger.log(`[Entrega ${entrega.codigo}] Corregida: ${JSON.stringify(data)}`);
  },

  /**
   * Revierte las metricas de un transportista por una entrega exitosa que se reasigno
   */
  async revertirMetricasTransportista(transportistaId: string, costoEntrega: number): Promise<void> {
    const transportista = await transportistaService.getById(transportistaId);
    if (!transportista) return;

    const totalEntregas = Math.max(0, (transportista.totalEntregas || 0) - 1);
    const entregasExitosas = Math.max(0, (transportista.entregasExitosas || 0) - 1);
    const tasaExito = totalEntregas > 0 ? (entregasExitosas / totalEntregas) * 100 : 0;
    const costoTotalHistorico = Math.max(0, (transportista.costoTotalHistorico || 0) - costoEntrega);
    const costoPromedioPorEntrega = totalEntregas > 0 ? costoTotalHistorico / totalEntregas : 0;

    const docRef = doc(db, COLLECTIONS.TRANSPORTISTAS, transportistaId);
    await updateDoc(docRef, {
      totalEntregas,
      entregasExitosas,
      entregasFallidas: transportista.entregasFallidas || 0,
      tasaExito,
      costoTotalHistorico,
      costoPromedioPorEntrega
    });
  },

  /**
   * Ajusta el costoTotalHistorico de un transportista cuando solo cambio la tarifa
   */
  async ajustarCostoTransportista(transportistaId: string, costoAnterior: number, costoNuevo: number): Promise<void> {
    const transportista = await transportistaService.getById(transportistaId);
    if (!transportista) return;

    const delta = costoNuevo - costoAnterior;
    const costoTotalHistorico = Math.max(0, (transportista.costoTotalHistorico || 0) + delta);
    const totalEntregas = transportista.totalEntregas || 1;
    const costoPromedioPorEntrega = costoTotalHistorico / totalEntregas;

    const docRef = doc(db, COLLECTIONS.TRANSPORTISTAS, transportistaId);
    await updateDoc(docRef, {
      costoTotalHistorico,
      costoPromedioPorEntrega
    });
  }
};
