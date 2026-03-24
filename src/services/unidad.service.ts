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
import { COLLECTIONS } from '../config/collections';
import { auditoriaService } from './auditoria.service';
import { inventarioService } from './inventario.service';
import { tipoCambioService } from './tipoCambio.service';
import type {
  Unidad,
  UnidadFormData,
  UnidadFiltros,
  UnidadFEFO,
  UnidadStats,
  CrearUnidadesLoteData,
  MovimientoUnidad,
  TipoMovimiento
} from '../types/unidad.types';
import { ESTADOS_EN_ORIGEN, ESTADOS_EN_TRANSITO_ORIGEN } from '../types/unidad.types';
import { TIPOS_TRANSFERENCIA_INTERNACIONAL } from '../types/transferencia.types';
import { esEstadoEnOrigen, esEstadoEnTransitoOrigen, esPaisOrigen } from '../utils/multiOrigen.helpers';
import { logBackgroundError } from '../lib/logger';
import { logger } from '../lib/logger';

const COLLECTION_NAME = COLLECTIONS.UNIDADES;

export const unidadService = {
  /**
   * Obtener todas las unidades activas (excluye vendida, vencida, danada)
   */
  async getAll(): Promise<Unidad[]> {
    const estadosExcluidos = ['vendida', 'vencida', 'danada'];
    const q = query(
      collection(db, COLLECTION_NAME),
      where('estado', 'not-in', estadosExcluidos)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Unidad));
  },

  /**
   * Obtener TODAS las unidades sin filtro (incluye vendidas, vencidas, etc.)
   * Usar solo cuando se necesite el historial completo (ej: CTRU, reportes)
   */
  async getAllIncluyendoHistoricas(): Promise<Unidad[]> {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Unidad));
  },

  /**
   * Obtener unidad por ID
   */
  async getById(id: string): Promise<Unidad | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    } as Unidad;
  },

  /**
   * Buscar unidades con filtros
   */
  async buscar(filtros: UnidadFiltros): Promise<Unidad[]> {
    let q = query(collection(db, COLLECTION_NAME));

    // Aplicar filtros
    if (filtros.productoId) {
      q = query(q, where('productoId', '==', filtros.productoId));
    }
    if (filtros.productoSKU) {
      q = query(q, where('productoSKU', '==', filtros.productoSKU));
    }
    if (filtros.almacenId) {
      q = query(q, where('almacenId', '==', filtros.almacenId));
    }
    if (filtros.pais) {
      q = query(q, where('pais', '==', filtros.pais));
    }
    if (filtros.estado) {
      q = query(q, where('estado', '==', filtros.estado));
    }
    if (filtros.lote) {
      q = query(q, where('lote', '==', filtros.lote));
    }
    if (filtros.ordenCompraId) {
      q = query(q, where('ordenCompraId', '==', filtros.ordenCompraId));
    }
    if (filtros.ventaId) {
      q = query(q, where('ventaId', '==', filtros.ventaId));
    }

    const snapshot = await getDocs(q);
    let unidades = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Unidad));

    // Filtros adicionales que requieren lógica en memoria
    if (filtros.fechaVencimientoDesde) {
      const desde = Timestamp.fromDate(filtros.fechaVencimientoDesde);
      unidades = unidades.filter(u => u.fechaVencimiento.seconds >= desde.seconds);
    }
    if (filtros.fechaVencimientoHasta) {
      const hasta = Timestamp.fromDate(filtros.fechaVencimientoHasta);
      unidades = unidades.filter(u => u.fechaVencimiento.seconds <= hasta.seconds);
    }
    if (filtros.diasParaVencerMenorQue !== undefined) {
      const ahora = new Date();
      unidades = unidades.filter(u => {
        const dias = Math.floor(
          (u.fechaVencimiento.toDate().getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)
        );
        return dias <= filtros.diasParaVencerMenorQue!;
      });
    }

    return unidades;
  },

  /**
   * Seleccionar unidades usando FEFO (First Expired, First Out)
   * Devuelve las unidades que deben venderse primero
   */
  async seleccionarFEFO(
    productoId: string,
    cantidad: number,
    almacenId?: string
  ): Promise<UnidadFEFO[]> {
    // Buscar unidades disponibles del producto (en Perú para venta)
    const filtros: UnidadFiltros = {
      productoId,
      estado: 'disponible_peru'
    };
    if (almacenId) {
      filtros.almacenId = almacenId;
    }

    let unidades = await this.buscar(filtros);

    // Filtrar unidades que tienen reserva activa para otra venta/cotización.
    // Una unidad disponible_peru puede tener reservadaPara/reservadoPara si:
    // 1. Un cliente pagó adelanto y se le reservó stock (reserva legítima)
    // 2. Datos residuales de una operación anterior que no limpió el campo (huérfano)
    // Verificamos si la referencia apunta a una venta/cotización activa con reserva vigente.
    const unidadesConReserva = unidades.filter(u => {
      const ext = u as any;
      return ext.reservadaPara || ext.reservadoPara;
    });

    if (unidadesConReserva.length > 0) {
      // Verificar cuáles reservas son legítimas (venta activa con stockReservado)
      const { VentaService } = await import('./venta.service');
      const idsReserva = new Set<string>();

      for (const u of unidadesConReserva) {
        const ext = u as any;
        const refId = ext.reservadaPara || ext.reservadoPara;
        if (refId) idsReserva.add(refId);
      }

      // Verificar cada referencia
      const reservasActivas = new Set<string>();
      for (const refId of idsReserva) {
        try {
          const venta = await VentaService.getById(refId);
          if (venta && venta.estado === 'reservada' && venta.stockReservado?.activo) {
            reservasActivas.add(refId);
            logger.log(`[FEFO] Reserva activa encontrada: ${refId} (${venta.numeroVenta})`);
          } else if (venta) {
            logger.warn(`[FEFO] Unidad referencia a ${venta.numeroVenta} (estado: ${venta.estado}) - reserva NO activa, campo huérfano`);
          } else {
            logger.warn(`[FEFO] Referencia ${refId} no encontrada como venta, verificando cotización...`);
            // Podría ser una cotización
            try {
              const { CotizacionService } = await import('./cotizacion.service');
              const cot = await CotizacionService.getById(refId);
              if (cot && (cot as any).stockReservado?.activo) {
                reservasActivas.add(refId);
                logger.log(`[FEFO] Reserva activa en cotización: ${refId}`);
              } else {
                logger.warn(`[FEFO] Referencia ${refId} es cotización sin reserva activa - campo huérfano`);
              }
            } catch {
              logger.warn(`[FEFO] Referencia ${refId} no encontrada - campo huérfano`);
            }
          }
        } catch {
          logger.warn(`[FEFO] Error verificando referencia ${refId} - tratando como huérfano`);
        }
      }

      // Solo excluir unidades con reservas genuinamente activas
      unidades = unidades.filter(u => {
        const ext = u as any;
        const refId = ext.reservadaPara || ext.reservadoPara;
        if (!refId) return true; // Sin referencia = disponible
        if (reservasActivas.has(refId)) {
          logger.log(`[FEFO] Excluyendo unidad ${u.id} - reservada activamente para ${refId}`);
          return false; // Reserva legítima, excluir
        }
        // Reserva huérfana - la unidad está disponible
        logger.warn(`[FEFO] Unidad ${u.id} tiene reserva huérfana (${refId}), incluyendo en FEFO`);
        return true;
      });
    }

    // Excluir unidades ya vencidas (fecha de vencimiento pasada)
    const ahoraSeconds = Math.floor(Date.now() / 1000);
    unidades = unidades.filter(u => {
      const fvSeconds = u.fechaVencimiento?.seconds;
      if (!fvSeconds) return true; // Sin fecha = no perecible, incluir
      return fvSeconds > ahoraSeconds; // Solo incluir si NO ha vencido
    });

    // Ordenar por fecha de vencimiento (más próximo primero — FEFO)
    // Unidades sin fechaVencimiento van al final (no perecibles o dato faltante)
    unidades.sort((a, b) => {
      const aSeconds = a.fechaVencimiento?.seconds ?? Number.MAX_SAFE_INTEGER;
      const bSeconds = b.fechaVencimiento?.seconds ?? Number.MAX_SAFE_INTEGER;
      return aSeconds - bSeconds;
    });

    // Tomar las primeras N unidades
    const seleccionadas = unidades.slice(0, cantidad);

    return seleccionadas.map((unidad, index) => ({
      unidad,
      orden: index + 1
    }));
  },

  /**
   * Crear una unidad individual
   */
  async create(data: UnidadFormData, userId: string, productoInfo: {
    sku: string;
    nombre: string;
  }, almacenInfo: {
    nombre: string;
    pais: string;
  }): Promise<string> {
    const now = Timestamp.now();

    // Crear movimiento inicial de recepción
    const movimientoInicial: MovimientoUnidad = {
      id: crypto.randomUUID(),
      tipo: 'recepcion',
      fecha: Timestamp.fromDate(data.fechaRecepcion),
      almacenDestino: data.almacenId,
      usuarioId: userId,
      observaciones: 'Recepción inicial',
      documentoRelacionado: {
        tipo: 'orden-compra',
        id: data.ordenCompraId,
        numero: data.ordenCompraNumero
      }
    };

    // Estado inicial según país del almacén (multi-origen)
    const estadoInicial = esPaisOrigen(almacenInfo.pais) ? 'recibida_origen' : 'disponible_peru';

    const newUnidad: Omit<Unidad, 'id'> = {
      productoId: data.productoId,
      productoSKU: productoInfo.sku,
      productoNombre: productoInfo.nombre,
      lote: data.lote,
      fechaVencimiento: Timestamp.fromDate(data.fechaVencimiento),
      almacenId: data.almacenId,
      almacenNombre: almacenInfo.nombre,
      pais: almacenInfo.pais,
      estado: estadoInicial,
      costoUnitarioUSD: data.costoUnitarioUSD,
      ordenCompraId: data.ordenCompraId,
      ordenCompraNumero: data.ordenCompraNumero,
      fechaRecepcion: Timestamp.fromDate(data.fechaRecepcion),
      movimientos: [movimientoInicial],
      creadoPor: userId,
      fechaCreacion: now
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), newUnidad);
    return docRef.id;
  },

  /**
   * Crear múltiples unidades de un lote (útil al recibir OC)
   *
   * RESERVA AUTOMÁTICA:
   * Si data.estadoInicial === 'reservada' y data.reservadoPara está definido,
   * las unidades se crean ya reservadas para esa cotización/venta.
   */
  async crearLote(data: CrearUnidadesLoteData, userId: string, productoInfo: {
    sku: string;
    nombre: string;
  }, almacenInfo: {
    nombre: string;
    pais: string;
  }): Promise<string[]> {
    const batch = writeBatch(db);
    const ids: string[] = [];
    const now = Timestamp.now();

    // Determinar si es una recepción con reserva automática
    const esReservaAutomatica = data.estadoInicial === 'reservada' && data.reservadoPara;

    // Crear movimiento inicial
    const movimientoInicial: MovimientoUnidad = {
      id: crypto.randomUUID(),
      tipo: esReservaAutomatica ? 'reserva' : 'recepcion',
      fecha: Timestamp.fromDate(data.fechaRecepcion),
      almacenDestino: data.almacenId,
      usuarioId: userId,
      observaciones: esReservaAutomatica
        ? `Recepción y reserva automática para cotización ${data.reservadoPara}`
        : 'Recepción inicial de lote',
      documentoRelacionado: {
        tipo: 'orden-compra',
        id: data.ordenCompraId,
        numero: data.ordenCompraNumero
      }
    };

    // Crear cada unidad
    for (let i = 0; i < data.cantidad; i++) {
      const docRef = doc(collection(db, COLLECTION_NAME));
      ids.push(docRef.id);

      // Estado inicial: usar el proporcionado o calcular según país (multi-origen)
      const estadoInicial = data.estadoInicial ||
        (esPaisOrigen(almacenInfo.pais) ? 'recibida_origen' : 'disponible_peru');

      const newUnidad: Omit<Unidad, 'id'> = {
        productoId: data.productoId,
        productoSKU: productoInfo.sku,
        productoNombre: productoInfo.nombre,
        lote: data.lote,
        fechaVencimiento: Timestamp.fromDate(data.fechaVencimiento),
        almacenId: data.almacenId,
        almacenNombre: almacenInfo.nombre,
        pais: almacenInfo.pais,
        estado: estadoInicial,
        costoUnitarioUSD: data.costoUnitarioUSD,
        ordenCompraId: data.ordenCompraId,
        ordenCompraNumero: data.ordenCompraNumero,
        fechaRecepcion: Timestamp.fromDate(data.fechaRecepcion),
        movimientos: [movimientoInicial],
        creadoPor: userId,
        fechaCreacion: now,
        // Tipo de cambio de la OC (para trazabilidad financiera)
        ...(data.tcCompra && { tcCompra: data.tcCompra }),
        ...(data.tcPago && { tcPago: data.tcPago }),
        // Datos de reserva automática (si aplica)
        ...(esReservaAutomatica && {
          reservadaPara: data.reservadoPara,
          fechaReserva: now,
          // Vigencia de 30 días por defecto para reservas de requerimiento
          reservaVigenciaHasta: Timestamp.fromMillis(now.toMillis() + 30 * 24 * 60 * 60 * 1000)
        })
      };

      batch.set(docRef, newUnidad);
    }

    await batch.commit();

    // Registrar en auditoría
    await auditoriaService.logInventario(
      data.productoId,
      productoInfo.nombre,
      'ingreso_inventario',
      data.cantidad,
      esReservaAutomatica ? `${almacenInfo.nombre} (reservado para ${data.reservadoPara})` : almacenInfo.nombre
    );

    return ids;
  },

  /**
   * Actualizar estado de una unidad
   * Sincroniza automáticamente el stock del producto
   */
  async actualizarEstado(
    id: string,
    nuevoEstado: Unidad['estado'],
    userId: string,
    observaciones?: string
  ): Promise<void> {
    // Obtener la unidad para conocer el productoId
    const unidad = await this.getById(id);
    if (!unidad) {
      throw new Error('Unidad no encontrada');
    }

    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      estado: nuevoEstado,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now()
    });

    // Sincronizar stock del producto automáticamente
    await inventarioService.sincronizarStockProducto(unidad.productoId);
  },

  /**
   * Registrar movimiento de unidad
   */
  async registrarMovimiento(
    id: string,
    movimiento: Omit<MovimientoUnidad, 'id' | 'fecha'>,
    nuevoAlmacenId?: string,
    nuevoAlmacenNombre?: string,
    nuevoPais?: string
  ): Promise<void> {
    const unidad = await this.getById(id);
    if (!unidad) {
      throw new Error('Unidad no encontrada');
    }

    const nuevoMovimiento: MovimientoUnidad = {
      ...movimiento,
      id: crypto.randomUUID(),
      fecha: Timestamp.now()
    };

    const updateData: any = {
      movimientos: [...unidad.movimientos, nuevoMovimiento],
      actualizadoPor: movimiento.usuarioId,
      fechaActualizacion: Timestamp.now()
    };

    // Si cambia de almacén
    if (nuevoAlmacenId && nuevoAlmacenNombre) {
      updateData.almacenId = nuevoAlmacenId;
      updateData.almacenNombre = nuevoAlmacenNombre;
      if (nuevoPais) {
        updateData.pais = nuevoPais;
      }
    }

    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, updateData);
  },

  /**
   * Marcar unidad como vendida
   */
  async marcarComoVendida(
    id: string,
    ventaId: string,
    ventaNumero: string,
    precioVentaPEN: number,
    userId: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const unidad = await this.getById(id);

    if (!unidad) {
      throw new Error('Unidad no encontrada');
    }

    const movimientoVenta: MovimientoUnidad = {
      id: crypto.randomUUID(),
      tipo: 'venta',
      fecha: Timestamp.now(),
      almacenOrigen: unidad.almacenId,
      usuarioId: userId,
      observaciones: `Venta registrada: ${ventaNumero}`,
      documentoRelacionado: {
        tipo: 'venta',
        id: ventaId,
        numero: ventaNumero
      }
    };

    await updateDoc(docRef, {
      estado: 'vendida',
      ventaId,
      ventaNumero,
      fechaVenta: Timestamp.now(),
      precioVentaPEN,
      movimientos: [...unidad.movimientos, movimientoVenta],
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now()
    });

    // Registrar en auditoría
    await auditoriaService.logInventario(
      unidad.productoId,
      unidad.productoNombre,
      'salida_inventario',
      1,
      unidad.almacenNombre
    );

    // Sincronizar stock del producto automáticamente
    await inventarioService.sincronizarStockProducto(unidad.productoId);
  },

  /**
   * Obtener unidades disponibles en un almacén específico (para transferencias)
   *
   * IMPORTANTE: Incluye unidades 'reservada' porque:
   * - Las unidades reservadas en USA para un requerimiento/cotización
   *   deben poder transferirse a Perú para cumplir el pedido
   * - El estado 'reservada' se mantiene durante la transferencia
   */
  async getDisponiblesPorAlmacen(almacenId: string): Promise<Unidad[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('almacenId', '==', almacenId)
    );

    const snapshot = await getDocs(q);
    const unidades = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Unidad));

    // Filtrar unidades transferibles (multi-origen compatible):
    // - recibida_origen/recibida_usa: disponibles en origen para envío a Perú
    // - disponible_peru: disponibles en Perú para transferencia interna
    // - reservada: comprometidas para una cotización/venta, necesitan transferirse a Perú
    return unidades.filter(u =>
      esEstadoEnOrigen(u.estado) ||
      u.estado === 'disponible_peru' ||
      u.estado === 'reservada'
    );
  },

  /**
   * Obtener estadísticas de unidades
   */
  async getStats(filtros?: Pick<UnidadFiltros, 'productoId' | 'almacenId' | 'pais'>): Promise<UnidadStats> {
    let unidades = await this.getAll();

    // Aplicar filtros opcionales
    if (filtros?.productoId) {
      unidades = unidades.filter(u => u.productoId === filtros.productoId);
    }
    if (filtros?.almacenId) {
      unidades = unidades.filter(u => u.almacenId === filtros.almacenId);
    }
    if (filtros?.pais) {
      unidades = unidades.filter(u => u.pais === filtros.pais);
    }

    const ahora = new Date();
    const en30Dias = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Unidades disponibles (recibida_origen/recibida_usa o disponible_peru)
    const disponibles = unidades.filter(u =>
      esEstadoEnOrigen(u.estado) || u.estado === 'disponible_peru'
    );

    // Unidades reservadas
    const reservadas = unidades.filter(u => u.estado === 'reservada');

    // Unidades en tránsito
    const enTransito = unidades.filter(u =>
      esEstadoEnTransitoOrigen(u.estado) || u.estado === 'en_transito_peru'
    );

    // Valor total del inventario ACTIVO (disponibles + reservadas + en tránsito)
    // Estas son las unidades que representan valor real en el inventario
    const unidadesActivas = [...disponibles, ...reservadas, ...enTransito];
    const valorTotalUSD = unidadesActivas.reduce(
      (sum, u) => sum + u.costoUnitarioUSD + (u.costoFleteUSD || 0),
      0
    );

    // Por vencer: considerar disponibles Y reservadas (ambas tienen fecha de vencimiento relevante)
    const unidadesConVencimiento = [...disponibles, ...reservadas];
    const porVencer = unidadesConVencimiento.filter(u =>
      u.fechaVencimiento?.toDate &&
      u.fechaVencimiento.toDate() <= en30Dias &&
      u.fechaVencimiento.toDate() > ahora
    ).length;

    return {
      totalUnidades: unidades.length,
      disponibles: disponibles.length,
      reservadas: reservadas.length,
      vendidas: unidades.filter(u => u.estado === 'vendida').length,
      enTransito: enTransito.length,
      porVencer,
      vencidas: unidades.filter(u => u.estado === 'vencida').length,
      valorTotalUSD
    };
  },

  /**
   * Obtener unidades próximas a vencer (alertas)
   */
  async getProximasAVencer(dias: number = 30): Promise<Unidad[]> {
    // Obtener todas las unidades y filtrar las disponibles
    const todasUnidades = await this.getAll();
    const unidadesDisponibles = todasUnidades.filter(u =>
      (esEstadoEnOrigen(u.estado) || u.estado === 'disponible_peru') &&
      u.fechaVencimiento
    );

    // Filtrar por días para vencer
    const ahora = new Date();
    const unidadesProximas = unidadesDisponibles.filter(u => {
      const diasParaVencer = Math.floor(
        (u.fechaVencimiento.toDate().getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diasParaVencer <= dias && diasParaVencer > 0;
    });

    // Ordenar por fecha de vencimiento
    return unidadesProximas.sort((a, b) =>
      a.fechaVencimiento.seconds - b.fechaVencimiento.seconds
    );
  },

  /**
   * Calcular días para vencer de una unidad
   */
  calcularDiasParaVencer(fechaVencimiento: Timestamp): number {
    if (!fechaVencimiento || !fechaVencimiento.toDate) {
      return 0;
    }
    const ahora = new Date();
    const vencimiento = fechaVencimiento.toDate();
    const diff = vencimiento.getTime() - ahora.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  },

  /**
   * Recalcula el costoFleteUSD para unidades que no lo tienen
   * basándose en las transferencias USA→Perú
   * @returns Estadísticas de la operación
   */
  async recalcularCostosFlete(): Promise<{
    unidadesSinFlete: number;
    unidadesActualizadas: number;
    errores: number;
    detalle: Array<{ unidadId: string; costoFleteUSD: number; transferenciaNumero: string }>;
  }> {
    try {
      // Obtener todas las unidades en Perú que no tienen costoFleteUSD
      const todasUnidades = await this.getAll();
      const unidadesSinFlete = todasUnidades.filter(u =>
        u.pais === 'Peru' &&
        (!u.costoFleteUSD || u.costoFleteUSD === 0)
      );

      if (unidadesSinFlete.length === 0) {
        return {
          unidadesSinFlete: 0,
          unidadesActualizadas: 0,
          errores: 0,
          detalle: []
        };
      }

      // Obtener todas las transferencias internacionales completadas (generic + legacy)
      const transferenciasSnapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.TRANSFERENCIAS),
          where('tipo', 'in', TIPOS_TRANSFERENCIA_INTERNACIONAL)
        )
      );

      // Crear mapa de unidadId → costoFleteUSD desde transferencias
      const costosFleteMap = new Map<string, { costoFleteUSD: number; transferenciaNumero: string }>();

      transferenciasSnapshot.docs.forEach(docSnap => {
        const transferencia = docSnap.data();
        if (transferencia.unidades && Array.isArray(transferencia.unidades)) {
          for (const unidadTransf of transferencia.unidades) {
            if (unidadTransf.costoFleteUSD && unidadTransf.costoFleteUSD > 0) {
              costosFleteMap.set(unidadTransf.unidadId, {
                costoFleteUSD: unidadTransf.costoFleteUSD,
                transferenciaNumero: transferencia.numeroTransferencia
              });
            }
          }
        }
      });

      // Actualizar unidades que encontramos en transferencias
      let actualizadas = 0;
      let errores = 0;
      const detalle: Array<{ unidadId: string; costoFleteUSD: number; transferenciaNumero: string }> = [];

      for (const unidad of unidadesSinFlete) {
        const costoInfo = costosFleteMap.get(unidad.id);
        if (costoInfo) {
          try {
            const docRef = doc(db, COLLECTION_NAME, unidad.id);
            await updateDoc(docRef, {
              costoFleteUSD: costoInfo.costoFleteUSD
            });
            actualizadas++;
            detalle.push({
              unidadId: unidad.id,
              costoFleteUSD: costoInfo.costoFleteUSD,
              transferenciaNumero: costoInfo.transferenciaNumero
            });
          } catch (e) {
            logger.error(`Error actualizando unidad ${unidad.id}:`, e);
            errores++;
          }
        }
      }

      logger.log(
        `[Recálculo Flete] ${unidadesSinFlete.length} unidades sin flete, ` +
        `${actualizadas} actualizadas, ${errores} errores`
      );

      return {
        unidadesSinFlete: unidadesSinFlete.length,
        unidadesActualizadas: actualizadas,
        errores,
        detalle
      };
    } catch (error: any) {
      logger.error('Error en recálculo de costos de flete:', error);
      throw new Error(`Error recalculando costos de flete: ${error.message}`);
    }
  },

  /**
   * Sincronizar unidades huérfanas
   * Busca unidades con ventaId que ya no existe y las devuelve a estado disponible
   * También corrige unidades con estado 'vendida' o 'asignada_pedido' sin venta válida
   */
  async sincronizarUnidadesHuerfanas(): Promise<{
    unidadesAnalizadas: number;
    unidadesSincronizadas: number;
    errores: number;
    detalle: Array<{
      unidadId: string;
      productoSKU: string;
      estadoAnterior: string;
      ventaIdAnterior: string;
      accion: string;
    }>;
  }> {
    const resultado = {
      unidadesAnalizadas: 0,
      unidadesSincronizadas: 0,
      errores: 0,
      detalle: [] as Array<{
        unidadId: string;
        productoSKU: string;
        estadoAnterior: string;
        ventaIdAnterior: string;
        accion: string;
      }>
    };

    try {
      // 1. Obtener todas las unidades que tienen ventaId o estado relacionado con ventas
      const todasUnidades = await this.getAll();
      const unidadesConVenta = todasUnidades.filter(u =>
        u.ventaId ||
        u.estado === 'vendida' ||
        u.estado === 'reservada' ||
        (u as any).estado === 'asignada_pedido' ||
        (u as any).estado === 'entregada' // Estado legacy que no debería existir
      );

      resultado.unidadesAnalizadas = unidadesConVenta.length;

      if (unidadesConVenta.length === 0) {
        return resultado;
      }

      // 2. Obtener todas las ventas existentes
      const ventasSnapshot = await getDocs(collection(db, COLLECTIONS.VENTAS));
      const ventasExistentes = new Set(ventasSnapshot.docs.map(d => d.id));

      // 3. Identificar unidades a sincronizar
      const unidadesASincronizar: Array<{
        unidad: Unidad;
        nuevoEstado: string;
      }> = [];

      for (const unidad of unidadesConVenta) {
        const tieneVentaId = !!unidad.ventaId;
        const ventaExiste = tieneVentaId && ventasExistentes.has(unidad.ventaId!);
        const estadoActual = unidad.estado;

        // Caso 1: Tiene ventaId pero la venta no existe
        // Caso 2: Estado 'vendida'/'asignada_pedido'/'entregada' pero sin venta válida
        const necesitaSincronizar =
          (tieneVentaId && !ventaExiste) ||
          (!tieneVentaId && (
            estadoActual === 'vendida' ||
            (estadoActual as any) === 'asignada_pedido' ||
            (estadoActual as any) === 'entregada'
          ));

        if (necesitaSincronizar) {
          const nuevoEstado = esPaisOrigen(unidad.pais) ? 'recibida_origen' : 'disponible_peru';
          unidadesASincronizar.push({ unidad, nuevoEstado });
        }
      }

      // 4. Procesar en batches de 500
      const MAX_BATCH = 400; // Un poco menos del límite para seguridad
      for (let i = 0; i < unidadesASincronizar.length; i += MAX_BATCH) {
        const chunk = unidadesASincronizar.slice(i, i + MAX_BATCH);
        const batch = writeBatch(db);

        for (const { unidad, nuevoEstado } of chunk) {
          try {
            const docRef = doc(db, COLLECTION_NAME, unidad.id);
            const estadoActual = unidad.estado;

            // Crear movimiento de ajuste
            const movimientoAjuste: MovimientoUnidad = {
              id: crypto.randomUUID(),
              tipo: 'ajuste',
              fecha: Timestamp.now(),
              usuarioId: 'sistema',
              observaciones: `Sincronización automática: venta ${unidad.ventaNumero || unidad.ventaId || 'N/A'} eliminada. Estado anterior: ${estadoActual}`
            };

            batch.update(docRef, {
              estado: nuevoEstado,
              ventaId: deleteField(),
              ventaNumero: deleteField(),
              fechaVenta: deleteField(),
              precioVentaPEN: deleteField(),
              reservadaPara: deleteField(),
              fechaReserva: deleteField(),
              reservaVigenciaHasta: deleteField(),
              movimientos: [...unidad.movimientos, movimientoAjuste],
              actualizadoPor: 'sistema',
              fechaActualizacion: Timestamp.now()
            });

            resultado.unidadesSincronizadas++;
            resultado.detalle.push({
              unidadId: unidad.id,
              productoSKU: unidad.productoSKU,
              estadoAnterior: estadoActual,
              ventaIdAnterior: unidad.ventaId || 'N/A',
              accion: `Restaurado a ${nuevoEstado}`
            });
          } catch (error) {
            logger.error(`Error preparando unidad ${unidad.id}:`, error);
            resultado.errores++;
          }
        }

        // Ejecutar este batch
        try {
          await batch.commit();
          logger.log(`[Sincronización] Batch ${Math.floor(i / MAX_BATCH) + 1} completado`);
        } catch (batchError) {
          logger.error('Error ejecutando batch:', batchError);
          resultado.errores += chunk.length;
          resultado.unidadesSincronizadas -= chunk.length;
        }
      }

      logger.log(
        `[Sincronización] ${resultado.unidadesAnalizadas} unidades analizadas, ` +
        `${resultado.unidadesSincronizadas} sincronizadas, ${resultado.errores} errores`
      );

      return resultado;
    } catch (error: any) {
      logger.error('Error en sincronización de unidades huérfanas:', error);
      throw new Error(`Error sincronizando unidades: ${error.message}`);
    }
  },

  /**
   * Confirmar venta de múltiples unidades (cuando la entrega es exitosa)
   * Cambia estado de reservada → vendida
   */
  async confirmarVentaUnidades(
    unidadIds: string[],
    ventaId: string,
    ventaNumero: string,
    precioVentaPEN: number,
    userId: string
  ): Promise<{ exitos: number; errores: number }> {
    let exitos = 0;
    let errores = 0;

    for (const unidadId of unidadIds) {
      try {
        await this.marcarComoVendida(
          unidadId,
          ventaId,
          ventaNumero,
          precioVentaPEN / unidadIds.length, // Prorratear precio
          userId
        );
        exitos++;
      } catch (error) {
        logger.error(`Error confirmando venta unidad ${unidadId}:`, error);
        errores++;
      }
    }

    // Trigger redistribución GA/GO post-venta (fire-and-forget, no bloqueante)
    if (exitos > 0) {
      import('./ctru.service').then(({ ctruService }) => {
        ctruService.recalcularCTRUDinamicoSafe()
          .then(result => {
            if (result) {
              logger.log(`[CTRU] Auto-recalculo post-venta: ${result.unidadesActualizadas} vendidas actualizadas`);
            } else {
              logger.log('[CTRU] Auto-recalculo post-venta encolado (otro en ejecución)');
            }
          })
          .catch(error => {
            logger.error('[CTRU] Error en auto-recalculo post-venta (no bloqueante):', error);
            logBackgroundError('ctru.recalcPostVenta', error, 'critical', { unidadIds, exitos });
          });
      });
    }

    return { exitos, errores };
  },

  /**
   * Liberar unidades (cuando una entrega falla y no se reprograma)
   * Cambia estado de reservada → disponible_peru
   * Sincroniza automáticamente el stock del producto
   */
  async liberarUnidades(
    unidadIds: string[],
    motivo: string,
    userId: string
  ): Promise<{ exitos: number; errores: number }> {
    let exitos = 0;
    let errores = 0;
    const productosAfectados = new Set<string>();

    for (const unidadId of unidadIds) {
      try {
        const unidad = await this.getById(unidadId);
        if (!unidad) {
          errores++;
          continue;
        }

        // Solo liberar si está en un estado que permita liberación
        const estadosLiberables = ['reservada', 'disponible_peru', 'asignada_pedido'];
        if (!estadosLiberables.includes(unidad.estado)) {
          logger.warn(`Unidad ${unidadId} tiene estado ${unidad.estado}, no se puede liberar`);
          errores++;
          continue;
        }

        const docRef = doc(db, COLLECTION_NAME, unidadId);
        // Determinar estado correcto según país (multi-origen)
        const estadoLiberado = esPaisOrigen(unidad.pais) ? 'recibida_origen' : 'disponible_peru';

        const movimientoLiberacion: MovimientoUnidad = {
          id: crypto.randomUUID(),
          tipo: 'ajuste',
          fecha: Timestamp.now(),
          usuarioId: userId,
          observaciones: `Unidad liberada: ${motivo}`
        };

        await updateDoc(docRef, {
          estado: estadoLiberado,
          // Limpiar datos de reserva/venta/asignación
          reservadaPara: deleteField(),
          fechaReserva: deleteField(),
          reservaVigenciaHasta: deleteField(),
          ventaId: deleteField(),
          fechaAsignacion: deleteField(),
          movimientos: [...unidad.movimientos, movimientoLiberacion],
          actualizadoPor: userId,
          fechaActualizacion: Timestamp.now()
        });

        productosAfectados.add(unidad.productoId);
        exitos++;
      } catch (error) {
        logger.error(`Error liberando unidad ${unidadId}:`, error);
        errores++;
      }
    }

    // Sincronizar stock de todos los productos afectados
    await inventarioService.sincronizarStockProductos_batch([...productosAfectados]);

    return { exitos, errores };
  },

  /**
   * Obtiene diagnóstico de costos para una unidad específica
   * Útil para debugging de discrepancias
   */
  async getDiagnosticoCostos(unidadId: string): Promise<{
    unidad: Unidad | null;
    costoUnitarioUSD: number;
    costoFleteUSD: number;
    tcCompra: number | null;
    tcPago: number | null;
    ctruDinamico: number | null;
    transferencia: {
      numero: string;
      costoFleteRegistrado: number;
    } | null;
    ctruCalculado: {
      sinFlete: number;
      conFlete: number;
      tc: number;
    };
  }> {
    const unidad = await this.getById(unidadId);
    if (!unidad) {
      return {
        unidad: null,
        costoUnitarioUSD: 0,
        costoFleteUSD: 0,
        tcCompra: null,
        tcPago: null,
        ctruDinamico: null,
        transferencia: null,
        ctruCalculado: { sinFlete: 0, conFlete: 0, tc: 0 }
      };
    }

    const unidadExtendida = unidad as any;

    // Buscar transferencia que trajo esta unidad
    let transferenciaInfo: { numero: string; costoFleteRegistrado: number } | null = null;
    try {
      const transferenciasSnapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.TRANSFERENCIAS),
          where('tipo', 'in', TIPOS_TRANSFERENCIA_INTERNACIONAL)
        )
      );

      for (const docSnap of transferenciasSnapshot.docs) {
        const transferencia = docSnap.data();
        if (transferencia.unidades) {
          const unidadEnTransf = transferencia.unidades.find(
            (u: any) => u.unidadId === unidadId
          );
          if (unidadEnTransf) {
            transferenciaInfo = {
              numero: transferencia.numeroTransferencia,
              costoFleteRegistrado: unidadEnTransf.costoFleteUSD || 0
            };
            break;
          }
        }
      }
    } catch (e) {
      logger.error('Error buscando transferencia:', e);
    }

    // Calcular CTRU con diferentes escenarios
    // Preferir TC histórico de la unidad; si no existe, usar TC centralizado
    let tc = unidadExtendida.tcPago || unidadExtendida.tcCompra || 0;
    if (!tc) {
      tc = await tipoCambioService.resolverTCVenta();
    }
    const costoFleteUSD = unidadExtendida.costoFleteUSD || 0;

    return {
      unidad,
      costoUnitarioUSD: unidad.costoUnitarioUSD,
      costoFleteUSD,
      tcCompra: unidadExtendida.tcCompra || null,
      tcPago: unidadExtendida.tcPago || null,
      ctruDinamico: unidadExtendida.ctruDinamico || null,
      transferencia: transferenciaInfo,
      ctruCalculado: {
        sinFlete: unidad.costoUnitarioUSD * tc,
        conFlete: (unidad.costoUnitarioUSD + costoFleteUSD) * tc,
        tc
      }
    };
  },

  /**
   * Actualizar fechas de vencimiento de múltiples unidades (por lote)
   * Usado para corregir las fechas por defecto que se asignan al recibir OC
   */
  async actualizarFechasVencimiento(
    unidadIds: string[],
    nuevaFecha: Date,
    userId: string,
    motivo?: string
  ): Promise<{ exitos: number; errores: number }> {
    let exitos = 0;
    let errores = 0;
    const MAX_BATCH = 400;
    const nuevaFechaTimestamp = Timestamp.fromDate(nuevaFecha);

    for (let i = 0; i < unidadIds.length; i += MAX_BATCH) {
      const chunk = unidadIds.slice(i, i + MAX_BATCH);

      // Primero, obtener las unidades del chunk para acceder a sus movimientos
      const unidadesChunk: Unidad[] = [];
      for (const id of chunk) {
        const unidad = await this.getById(id);
        if (unidad) {
          unidadesChunk.push(unidad);
        } else {
          errores++;
        }
      }

      const batch = writeBatch(db);

      for (const unidad of unidadesChunk) {
        try {
          const docRef = doc(db, COLLECTION_NAME, unidad.id);

          const movimientoAjuste: MovimientoUnidad = {
            id: crypto.randomUUID(),
            tipo: 'ajuste',
            fecha: Timestamp.now(),
            usuarioId: userId,
            observaciones: motivo
              ? `Corrección fecha vencimiento: ${motivo}`
              : 'Corrección de fecha de vencimiento'
          };

          batch.update(docRef, {
            fechaVencimiento: nuevaFechaTimestamp,
            movimientos: [...unidad.movimientos, movimientoAjuste],
            actualizadoPor: userId,
            fechaActualizacion: Timestamp.now()
          });

          exitos++;
        } catch (error) {
          logger.error(`Error preparando unidad ${unidad.id}:`, error);
          errores++;
        }
      }

      try {
        await batch.commit();
        logger.log(`[Vencimiento] Batch ${Math.floor(i / MAX_BATCH) + 1} completado (${unidadesChunk.length} unidades)`);
      } catch (batchError) {
        logger.error('Error ejecutando batch de vencimiento:', batchError);
        errores += unidadesChunk.length;
        exitos -= unidadesChunk.length;
      }
    }

    return { exitos, errores };
  },

  /**
   * Reservar unidades existentes para una cotización (vinculación retroactiva)
   * Cambia unidades de disponible_peru → reservada para una cotización específica
   */
  async reservarUnidadesParaCotizacion(params: {
    ordenCompraId: string;
    cotizacionId: string;
    cotizacionNumero?: string;
    requerimientoId: string;
    productos: Array<{ productoId: string; cantidad: number }>;
    userId: string;
  }): Promise<{ totalReservadas: number; detalles: Array<{ productoId: string; reservadas: number; faltantes: number }> }> {
    const { ordenCompraId, cotizacionId, requerimientoId, productos, userId } = params;
    let { cotizacionNumero } = params;

    // Si no se proporcionó el número de cotización, buscarlo en Firestore
    if (!cotizacionNumero && cotizacionId) {
      try {
        const cotDoc = await getDoc(doc(db, COLLECTIONS.COTIZACIONES, cotizacionId));
        if (cotDoc.exists()) {
          cotizacionNumero = cotDoc.data().numeroCotizacion || undefined;
        }
      } catch {
        // Non-critical, usará el ID como fallback
      }
    }

    let totalReservadas = 0;
    const detalles: Array<{ productoId: string; reservadas: number; faltantes: number }> = [];

    for (const prod of productos) {
      // Buscar unidades disponibles de esta OC para este producto
      // Buscar en todos los estados no-reservados/no-vendidos (puede estar en USA o Perú)
      const todasUnidades = await this.buscar({
        ordenCompraId,
        productoId: prod.productoId
      });
      // Filtrar solo las que están en estado disponible (no reservada, no vendida, no en_movimiento)
      // También excluir unidades ya reservadas para ESTA MISMA cotización (evitar doble reserva)
      const estadosDisponibles = [...ESTADOS_EN_ORIGEN, 'en_transito_peru', 'disponible_peru'];
      const unidades = todasUnidades.filter(u => {
        if (!estadosDisponibles.includes(u.estado)) return false;
        // Excluir unidades que ya tienen reserva para esta cotización
        const reservada = (u as any).reservadaPara;
        if (reservada === cotizacionId) return false;
        return true;
      });

      const cantidadAReservar = Math.min(prod.cantidad, unidades.length);
      const unidadesAReservar = unidades.slice(0, cantidadAReservar);

      // Reservar en lotes de hasta 500 (límite Firestore batch)
      for (let i = 0; i < unidadesAReservar.length; i += 450) {
        const chunk = unidadesAReservar.slice(i, i + 450);
        const batch = writeBatch(db);

        for (const unidad of chunk) {
          const docRef = doc(db, COLLECTION_NAME, unidad.id);
          const movimiento: MovimientoUnidad = {
            id: crypto.randomUUID(),
            tipo: 'reserva' as TipoMovimiento,
            fecha: Timestamp.now(),
            usuarioId: userId,
            observaciones: `Reserva retroactiva para cotización ${cotizacionNumero || cotizacionId}`
          };

          batch.update(docRef, {
            estado: 'reservada',
            reservadaPara: cotizacionId,
            fechaReserva: Timestamp.now(),
            requerimientoId,
            movimientos: [...unidad.movimientos, movimiento],
            actualizadoPor: userId,
            fechaActualizacion: Timestamp.now()
          });
        }

        await batch.commit();
      }

      totalReservadas += cantidadAReservar;
      detalles.push({
        productoId: prod.productoId,
        reservadas: cantidadAReservar,
        faltantes: Math.max(0, prod.cantidad - cantidadAReservar)
      });
    }

    // Sincronizar stock de productos afectados
    const productosAfectados = productos.map(p => p.productoId);
    await inventarioService.sincronizarStockProductos_batch(productosAfectados);

    return { totalReservadas, detalles };
  }
};
