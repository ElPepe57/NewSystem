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
import { auditoriaService } from './auditoria.service';
import { inventarioService } from './inventario.service';
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

const COLLECTION_NAME = 'unidades';

export const unidadService = {
  /**
   * Obtener todas las unidades
   */
  async getAll(): Promise<Unidad[]> {
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

    // Ordenar por fecha de vencimiento (más próximo primero)
    unidades.sort((a, b) =>
      a.fechaVencimiento.seconds - b.fechaVencimiento.seconds
    );

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
    pais: 'USA' | 'Peru';
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

    // Estado inicial según país del almacén
    const estadoInicial = almacenInfo.pais === 'USA' ? 'recibida_usa' : 'disponible_peru';

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
    pais: 'USA' | 'Peru';
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

      // Estado inicial: usar el proporcionado o calcular según país
      const estadoInicial = data.estadoInicial ||
        (almacenInfo.pais === 'USA' ? 'recibida_usa' : 'disponible_peru');

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
    nuevoPais?: 'USA' | 'Peru'
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

    // Filtrar unidades transferibles:
    // - recibida_usa: disponibles en USA para envío a Perú
    // - disponible_peru: disponibles en Perú para transferencia interna
    // - reservada: comprometidas para una cotización/venta, necesitan transferirse a Perú
    return unidades.filter(u =>
      u.estado === 'recibida_usa' ||
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

    // Unidades disponibles (recibida_usa o disponible_peru)
    const disponibles = unidades.filter(u =>
      u.estado === 'recibida_usa' || u.estado === 'disponible_peru'
    );

    // Unidades reservadas
    const reservadas = unidades.filter(u => u.estado === 'reservada');

    // Unidades en tránsito
    const enTransito = unidades.filter(u =>
      u.estado === 'en_transito_usa' || u.estado === 'en_transito_peru'
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
      (u.estado === 'recibida_usa' || u.estado === 'disponible_peru') &&
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

      // Obtener todas las transferencias USA→Perú completadas
      const transferenciasSnapshot = await getDocs(
        query(
          collection(db, 'transferencias'),
          where('tipo', '==', 'usa_peru')
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
            console.error(`Error actualizando unidad ${unidad.id}:`, e);
            errores++;
          }
        }
      }

      console.log(
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
      console.error('Error en recálculo de costos de flete:', error);
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
      const ventasSnapshot = await getDocs(collection(db, 'ventas'));
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
          const nuevoEstado = unidad.pais === 'USA' ? 'recibida_usa' : 'disponible_peru';
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
              observaciones: `Sincronización automática: venta ${unidad.ventaId || 'N/A'} eliminada. Estado anterior: ${estadoActual}`
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
            console.error(`Error preparando unidad ${unidad.id}:`, error);
            resultado.errores++;
          }
        }

        // Ejecutar este batch
        try {
          await batch.commit();
          console.log(`[Sincronización] Batch ${Math.floor(i / MAX_BATCH) + 1} completado`);
        } catch (batchError) {
          console.error('Error ejecutando batch:', batchError);
          resultado.errores += chunk.length;
          resultado.unidadesSincronizadas -= chunk.length;
        }
      }

      console.log(
        `[Sincronización] ${resultado.unidadesAnalizadas} unidades analizadas, ` +
        `${resultado.unidadesSincronizadas} sincronizadas, ${resultado.errores} errores`
      );

      return resultado;
    } catch (error: any) {
      console.error('Error en sincronización de unidades huérfanas:', error);
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
        console.error(`Error confirmando venta unidad ${unidadId}:`, error);
        errores++;
      }
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

        // Solo liberar si está reservada o en un estado que permita liberación
        if (unidad.estado !== 'reservada' && unidad.estado !== 'disponible_peru') {
          console.warn(`Unidad ${unidadId} tiene estado ${unidad.estado}, no se puede liberar`);
          errores++;
          continue;
        }

        const docRef = doc(db, COLLECTION_NAME, unidadId);
        const movimientoLiberacion: MovimientoUnidad = {
          id: crypto.randomUUID(),
          tipo: 'ajuste',
          fecha: Timestamp.now(),
          usuarioId: userId,
          observaciones: `Unidad liberada: ${motivo}`
        };

        await updateDoc(docRef, {
          estado: 'disponible_peru',
          // Limpiar datos de reserva/venta
          reservadaPara: deleteField(),
          fechaReserva: deleteField(),
          reservaVigenciaHasta: deleteField(),
          movimientos: [...unidad.movimientos, movimientoLiberacion],
          actualizadoPor: userId,
          fechaActualizacion: Timestamp.now()
        });

        productosAfectados.add(unidad.productoId);
        exitos++;
      } catch (error) {
        console.error(`Error liberando unidad ${unidadId}:`, error);
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
          collection(db, 'transferencias'),
          where('tipo', '==', 'usa_peru')
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
      console.error('Error buscando transferencia:', e);
    }

    // Calcular CTRU con diferentes escenarios
    const tc = unidadExtendida.tcPago || unidadExtendida.tcCompra || 3.70;
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
  }
};
