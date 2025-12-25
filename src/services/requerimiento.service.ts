import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  Requerimiento,
  RequerimientoFormData,
  EstadoRequerimiento,
  AsignacionResponsable,
  AsignarResponsableData,
  ActualizarAsignacionData,
  ProductoRequerimiento,
  ProductoAsignado,
  RequerimientoFiltros,
  RequerimientoStats,
  RequerimientoResumen,
  ResumenAsignaciones
} from '../types/requerimiento.types';
import { almacenService } from './almacen.service';

const COLLECTION_NAME = 'requerimientos';

export const requerimientoService = {
  /**
   * Obtener todos los requerimientos
   */
  async getAll(): Promise<Requerimiento[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('fechaCreacion', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Requerimiento));
    } catch (error: any) {
      console.error('Error al obtener requerimientos:', error);
      throw new Error('Error al cargar requerimientos');
    }
  },

  /**
   * Obtener requerimiento por ID
   */
  async getById(id: string): Promise<Requerimiento | null> {
    try {
      const docSnap = await getDoc(doc(db, COLLECTION_NAME, id));

      if (!docSnap.exists()) {
        return null;
      }

      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Requerimiento;
    } catch (error: any) {
      console.error('Error al obtener requerimiento:', error);
      throw new Error('Error al cargar requerimiento');
    }
  },

  /**
   * Buscar requerimientos con filtros
   */
  async buscar(filtros: RequerimientoFiltros): Promise<Requerimiento[]> {
    try {
      let q = query(collection(db, COLLECTION_NAME));

      if (filtros.estado) {
        q = query(q, where('estado', '==', filtros.estado));
      }

      if (filtros.prioridad) {
        q = query(q, where('prioridad', '==', filtros.prioridad));
      }

      if (filtros.clienteId) {
        q = query(q, where('clienteId', '==', filtros.clienteId));
      }

      const snapshot = await getDocs(q);
      let requerimientos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Requerimiento));

      // Filtros adicionales en memoria
      if (filtros.responsableId) {
        requerimientos = requerimientos.filter(r =>
          r.asignaciones?.some(a => a.responsableId === filtros.responsableId)
        );
      }

      if (filtros.conAsignacionesPendientes) {
        requerimientos = requerimientos.filter(r =>
          r.productos.some(p => p.cantidadPendiente > 0)
        );
      }

      return requerimientos;
    } catch (error: any) {
      console.error('Error al buscar requerimientos:', error);
      throw new Error('Error al buscar requerimientos');
    }
  },

  /**
   * Crear nuevo requerimiento
   */
  async create(data: RequerimientoFormData, userId: string): Promise<Requerimiento> {
    try {
      const numeroRequerimiento = await this.generateNumero();

      // Preparar productos con cantidades iniciales
      const productos: ProductoRequerimiento[] = data.productos.map(p => ({
        productoId: p.productoId,
        sku: p.sku,
        marca: p.marca,
        nombreComercial: p.nombreComercial,
        presentacion: p.presentacion,
        cantidadSolicitada: p.cantidadSolicitada,
        cantidadAsignada: 0,
        cantidadRecibida: 0,
        cantidadPendiente: p.cantidadSolicitada,
        precioEstimadoUSD: p.precioEstimadoUSD,
        precioVentaPEN: p.precioVentaPEN,
        completado: false
      }));

      const nuevoRequerimiento: Omit<Requerimiento, 'id'> = {
        numeroRequerimiento,
        origen: data.origen,
        tipoSolicitante: data.tipoSolicitante,
        nombreSolicitante: data.nombreSolicitante,
        cotizacionId: data.cotizacionId,
        cotizacionNumero: data.cotizacionNumero,
        clienteId: data.clienteId,
        clienteNombre: data.clienteNombre,
        productos,
        asignaciones: [],
        resumenAsignaciones: {
          totalResponsables: 0,
          responsablesActivos: 0,
          productosAsignados: 0,
          productosRecibidos: 0,
          porcentajeCompletado: 0
        },
        expectativa: data.expectativa,
        estado: 'pendiente',
        prioridad: data.prioridad,
        fechaRequerida: data.fechaRequerida ? Timestamp.fromDate(data.fechaRequerida) : undefined,
        fechaSolicitud: Timestamp.now(),
        justificacion: data.justificacion,
        observaciones: data.observaciones,
        solicitadoPor: userId,
        creadoPor: userId,
        fechaCreacion: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevoRequerimiento);

      return {
        id: docRef.id,
        ...nuevoRequerimiento
      } as Requerimiento;
    } catch (error: any) {
      console.error('Error al crear requerimiento:', error);
      throw new Error(error.message || 'Error al crear requerimiento');
    }
  },

  /**
   * Aprobar requerimiento
   */
  async aprobar(id: string, userId: string): Promise<void> {
    try {
      const requerimiento = await this.getById(id);
      if (!requerimiento) {
        throw new Error('Requerimiento no encontrado');
      }

      if (requerimiento.estado !== 'pendiente') {
        throw new Error('Solo se pueden aprobar requerimientos pendientes');
      }

      await updateDoc(doc(db, COLLECTION_NAME, id), {
        estado: 'aprobado',
        fechaAprobacion: serverTimestamp(),
        aprobadoPor: userId,
        fechaActualizacion: serverTimestamp(),
        actualizadoPor: userId
      });
    } catch (error: any) {
      console.error('Error al aprobar requerimiento:', error);
      throw new Error(error.message || 'Error al aprobar requerimiento');
    }
  },

  /**
   * =======================================================
   * ASIGNAR RESPONSABLE/VIAJERO A UN REQUERIMIENTO
   * =======================================================
   *
   * Permite asignar múltiples responsables al mismo requerimiento.
   * Cada responsable puede traer diferentes productos/cantidades.
   */
  async asignarResponsable(
    requerimientoId: string,
    data: AsignarResponsableData,
    userId: string
  ): Promise<AsignacionResponsable> {
    try {
      const requerimiento = await this.getById(requerimientoId);
      if (!requerimiento) {
        throw new Error('Requerimiento no encontrado');
      }

      if (requerimiento.estado === 'cancelado' || requerimiento.estado === 'completado') {
        throw new Error('No se puede asignar a un requerimiento cancelado o completado');
      }

      // Obtener datos del responsable (almacén/viajero)
      const responsable = await almacenService.getById(data.responsableId);
      if (!responsable) {
        throw new Error('Responsable/viajero no encontrado');
      }

      // Validar que los productos existen en el requerimiento y tienen cantidad pendiente
      const productosAsignados: ProductoAsignado[] = [];
      for (const prodAsignado of data.productos) {
        const productoReq = requerimiento.productos.find(p => p.productoId === prodAsignado.productoId);
        if (!productoReq) {
          throw new Error(`Producto ${prodAsignado.productoId} no existe en el requerimiento`);
        }

        // Para requerimientos antiguos, cantidadPendiente puede no existir
        // En ese caso, usar cantidadSolicitada - cantidadAsignada (o cantidadSolicitada si no hay asignada)
        const cantidadAsignadaPrevia = productoReq.cantidadAsignada || 0;
        const cantidadPendiente = productoReq.cantidadPendiente !== undefined
          ? productoReq.cantidadPendiente
          : productoReq.cantidadSolicitada - cantidadAsignadaPrevia;

        if (prodAsignado.cantidadAsignada > cantidadPendiente) {
          throw new Error(
            `No hay suficiente cantidad pendiente de ${productoReq.sku}. ` +
            `Pendiente: ${cantidadPendiente}, Solicitado: ${prodAsignado.cantidadAsignada}`
          );
        }

        productosAsignados.push({
          productoId: productoReq.productoId,
          sku: productoReq.sku,
          marca: productoReq.marca || '',
          nombreComercial: productoReq.nombreComercial || '',
          cantidadAsignada: prodAsignado.cantidadAsignada,
          cantidadRecibida: 0
        });
      }

      // Crear la asignación (sin campos undefined para Firestore)
      const nuevaAsignacion: Record<string, any> = {
        id: `ASG-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        responsableId: responsable.id,
        responsableNombre: responsable.nombre,
        responsableCodigo: responsable.codigo,
        esViajero: responsable.esViajero || false,
        productos: productosAsignados,
        estado: 'pendiente',
        fechaAsignacion: Timestamp.now(),
        asignadoPor: userId
      };

      // Agregar campos opcionales solo si tienen valor
      if (data.fechaEstimadaCompra) {
        nuevaAsignacion.fechaEstimadaCompra = Timestamp.fromDate(data.fechaEstimadaCompra);
      }
      if (data.fechaEstimadaLlegada) {
        nuevaAsignacion.fechaEstimadaLlegada = Timestamp.fromDate(data.fechaEstimadaLlegada);
      } else if (responsable.proximoViaje) {
        nuevaAsignacion.fechaEstimadaLlegada = responsable.proximoViaje;
      }
      if (data.costoEstimadoUSD !== undefined && data.costoEstimadoUSD !== null) {
        nuevaAsignacion.costoEstimadoUSD = data.costoEstimadoUSD;
      }
      if (data.notas) {
        nuevaAsignacion.notas = data.notas;
      }

      // Actualizar cantidades en productos del requerimiento
      const productosActualizados = requerimiento.productos.map(prod => {
        const asignado = productosAsignados.find(p => p.productoId === prod.productoId);

        // Para requerimientos antiguos, inicializar campos si no existen
        const cantidadAsignadaPrevia = prod.cantidadAsignada || 0;
        const cantidadPendientePrevia = prod.cantidadPendiente !== undefined
          ? prod.cantidadPendiente
          : prod.cantidadSolicitada - cantidadAsignadaPrevia;
        const cantidadRecibidaPrevia = prod.cantidadRecibida || 0;

        if (asignado) {
          return {
            ...prod,
            cantidadAsignada: cantidadAsignadaPrevia + asignado.cantidadAsignada,
            cantidadPendiente: cantidadPendientePrevia - asignado.cantidadAsignada,
            cantidadRecibida: cantidadRecibidaPrevia
          };
        }

        // Asegurar que los campos existen incluso para productos no asignados
        return {
          ...prod,
          cantidadAsignada: cantidadAsignadaPrevia,
          cantidadPendiente: cantidadPendientePrevia,
          cantidadRecibida: cantidadRecibidaPrevia
        };
      });

      // Agregar asignación y actualizar resumen
      // Nota: requerimientos antiguos pueden no tener el campo asignaciones
      const asignacionesPrevias = requerimiento.asignaciones || [];
      const asignacionesActualizadas = [...asignacionesPrevias, nuevaAsignacion];
      const resumen = this.calcularResumenAsignaciones(productosActualizados, asignacionesActualizadas as AsignacionResponsable[]);

      // Determinar nuevo estado del requerimiento
      let nuevoEstado: EstadoRequerimiento = requerimiento.estado;
      if (requerimiento.estado === 'pendiente' || requerimiento.estado === 'aprobado') {
        nuevoEstado = 'en_proceso';
      }

      await updateDoc(doc(db, COLLECTION_NAME, requerimientoId), {
        productos: productosActualizados,
        asignaciones: asignacionesActualizadas,
        resumenAsignaciones: resumen,
        estado: nuevoEstado,
        fechaActualizacion: serverTimestamp(),
        actualizadoPor: userId
      });

      console.log(`[Requerimiento] Asignado ${responsable.nombre} a ${requerimiento.numeroRequerimiento}`);

      return nuevaAsignacion as AsignacionResponsable;
    } catch (error: any) {
      console.error('Error al asignar responsable:', error);
      throw new Error(error.message || 'Error al asignar responsable');
    }
  },

  /**
   * Actualizar una asignación existente
   */
  async actualizarAsignacion(
    requerimientoId: string,
    asignacionId: string,
    data: ActualizarAsignacionData,
    userId: string
  ): Promise<void> {
    try {
      const requerimiento = await this.getById(requerimientoId);
      if (!requerimiento) {
        throw new Error('Requerimiento no encontrado');
      }

      const asignacionIndex = requerimiento.asignaciones.findIndex(a => a.id === asignacionId);
      if (asignacionIndex === -1) {
        throw new Error('Asignación no encontrada');
      }

      const asignacion = requerimiento.asignaciones[asignacionIndex];

      // Actualizar campos de la asignación
      const asignacionActualizada: AsignacionResponsable = {
        ...asignacion,
        estado: data.estado || asignacion.estado,
        fechaCompra: data.fechaCompra ? Timestamp.fromDate(data.fechaCompra) : asignacion.fechaCompra,
        fechaEstimadaLlegada: data.fechaEstimadaLlegada
          ? Timestamp.fromDate(data.fechaEstimadaLlegada)
          : asignacion.fechaEstimadaLlegada,
        fechaRecepcion: data.fechaRecepcion
          ? Timestamp.fromDate(data.fechaRecepcion)
          : asignacion.fechaRecepcion,
        ordenCompraId: data.ordenCompraId || asignacion.ordenCompraId,
        ordenCompraNumero: data.ordenCompraNumero || asignacion.ordenCompraNumero,
        transferenciaId: data.transferenciaId || asignacion.transferenciaId,
        transferenciaNumero: data.transferenciaNumero || asignacion.transferenciaNumero,
        costoRealUSD: data.costoRealUSD ?? asignacion.costoRealUSD,
        costoFleteUSD: data.costoFleteUSD ?? asignacion.costoFleteUSD,
        notas: data.notas !== undefined ? data.notas : asignacion.notas,
        actualizadoPor: userId,
        fechaActualizacion: Timestamp.now()
      };

      // Actualizar productos recibidos si se especifica
      if (data.productosRecibidos && data.productosRecibidos.length > 0) {
        asignacionActualizada.productos = asignacion.productos.map(prod => {
          const recibido = data.productosRecibidos!.find(p => p.productoId === prod.productoId);
          if (recibido) {
            return {
              ...prod,
              cantidadRecibida: recibido.cantidadRecibida
            };
          }
          return prod;
        });
      }

      // Reemplazar asignación
      const asignacionesActualizadas = [...requerimiento.asignaciones];
      asignacionesActualizadas[asignacionIndex] = asignacionActualizada;

      // Recalcular cantidades recibidas en productos del requerimiento
      const productosActualizados = this.recalcularProductos(
        requerimiento.productos,
        asignacionesActualizadas
      );

      // Recalcular resumen
      const resumen = this.calcularResumenAsignaciones(productosActualizados, asignacionesActualizadas);

      // Verificar si el requerimiento se completó
      const todosCompletados = productosActualizados.every(p => p.completado);
      let nuevoEstado = requerimiento.estado;
      if (todosCompletados) {
        nuevoEstado = 'completado';
      }

      await updateDoc(doc(db, COLLECTION_NAME, requerimientoId), {
        productos: productosActualizados,
        asignaciones: asignacionesActualizadas,
        resumenAsignaciones: resumen,
        estado: nuevoEstado,
        fechaCompletado: todosCompletados ? serverTimestamp() : null,
        fechaActualizacion: serverTimestamp(),
        actualizadoPor: userId
      });
    } catch (error: any) {
      console.error('Error al actualizar asignación:', error);
      throw new Error(error.message || 'Error al actualizar asignación');
    }
  },

  /**
   * Cancelar una asignación
   */
  async cancelarAsignacion(
    requerimientoId: string,
    asignacionId: string,
    motivo: string,
    userId: string
  ): Promise<void> {
    try {
      const requerimiento = await this.getById(requerimientoId);
      if (!requerimiento) {
        throw new Error('Requerimiento no encontrado');
      }

      const asignacionIndex = requerimiento.asignaciones.findIndex(a => a.id === asignacionId);
      if (asignacionIndex === -1) {
        throw new Error('Asignación no encontrada');
      }

      const asignacion = requerimiento.asignaciones[asignacionIndex];

      if (asignacion.estado === 'recibido') {
        throw new Error('No se puede cancelar una asignación que ya fue recibida');
      }

      // Marcar asignación como cancelada
      const asignacionActualizada: AsignacionResponsable = {
        ...asignacion,
        estado: 'cancelado',
        notas: `${asignacion.notas || ''}\n[CANCELADO]: ${motivo}`.trim(),
        actualizadoPor: userId,
        fechaActualizacion: Timestamp.now()
      };

      const asignacionesActualizadas = [...requerimiento.asignaciones];
      asignacionesActualizadas[asignacionIndex] = asignacionActualizada;

      // Devolver cantidades a "pendiente" (solo si no fueron recibidas)
      const productosActualizados = requerimiento.productos.map(prod => {
        const prodAsignado = asignacion.productos.find(p => p.productoId === prod.productoId);
        if (prodAsignado) {
          const cantidadADevolver = prodAsignado.cantidadAsignada - prodAsignado.cantidadRecibida;
          return {
            ...prod,
            cantidadAsignada: prod.cantidadAsignada - cantidadADevolver,
            cantidadPendiente: prod.cantidadPendiente + cantidadADevolver
          };
        }
        return prod;
      });

      // Recalcular resumen
      const resumen = this.calcularResumenAsignaciones(productosActualizados, asignacionesActualizadas);

      await updateDoc(doc(db, COLLECTION_NAME, requerimientoId), {
        productos: productosActualizados,
        asignaciones: asignacionesActualizadas,
        resumenAsignaciones: resumen,
        fechaActualizacion: serverTimestamp(),
        actualizadoPor: userId
      });
    } catch (error: any) {
      console.error('Error al cancelar asignación:', error);
      throw new Error(error.message || 'Error al cancelar asignación');
    }
  },

  /**
   * Vincular asignación con Orden de Compra
   */
  async vincularConOrdenCompra(
    requerimientoId: string,
    asignacionId: string,
    ordenCompraId: string,
    ordenCompraNumero: string,
    userId: string
  ): Promise<void> {
    await this.actualizarAsignacion(requerimientoId, asignacionId, {
      estado: 'comprado',
      ordenCompraId,
      ordenCompraNumero,
      fechaCompra: new Date()
    }, userId);
  },

  /**
   * Vincular asignación con Transferencia
   */
  async vincularConTransferencia(
    requerimientoId: string,
    asignacionId: string,
    transferenciaId: string,
    transferenciaNumero: string,
    userId: string
  ): Promise<void> {
    await this.actualizarAsignacion(requerimientoId, asignacionId, {
      estado: 'en_transito',
      transferenciaId,
      transferenciaNumero
    }, userId);
  },

  /**
   * Marcar recepción de productos de una asignación
   */
  async marcarRecepcion(
    requerimientoId: string,
    asignacionId: string,
    productosRecibidos: { productoId: string; cantidadRecibida: number }[],
    userId: string
  ): Promise<void> {
    await this.actualizarAsignacion(requerimientoId, asignacionId, {
      estado: 'recibido',
      fechaRecepcion: new Date(),
      productosRecibidos
    }, userId);
  },

  /**
   * Obtener requerimientos asignados a un responsable
   */
  async getByResponsable(responsableId: string): Promise<Requerimiento[]> {
    return this.buscar({ responsableId });
  },

  /**
   * Obtener estadísticas
   */
  async getStats(): Promise<RequerimientoStats> {
    try {
      const requerimientos = await this.getAll();

      const stats: RequerimientoStats = {
        total: requerimientos.length,
        pendientes: 0,
        aprobados: 0,
        enProceso: 0,
        completados: 0,
        cancelados: 0,
        urgentes: 0,
        sinAsignar: 0,
        parcialmenteAsignados: 0,
        totalmenteAsignados: 0,
        costoTotalEstimadoUSD: 0,
        costoTotalRealUSD: 0,
        asignacionesPorResponsable: []
      };

      const responsablesMap = new Map<string, {
        responsableNombre: string;
        cantidadRequerimientos: Set<string>;
        cantidadProductos: number;
        valorEstimadoUSD: number;
      }>();

      for (const req of requerimientos) {
        // Por estado
        switch (req.estado) {
          case 'pendiente': stats.pendientes++; break;
          case 'aprobado': stats.aprobados++; break;
          case 'en_proceso': stats.enProceso++; break;
          case 'completado': stats.completados++; break;
          case 'cancelado': stats.cancelados++; break;
        }

        if (req.prioridad === 'urgente') stats.urgentes++;

        // Por asignación
        const totalSolicitado = req.productos.reduce((s, p) => s + p.cantidadSolicitada, 0);
        const totalAsignado = req.productos.reduce((s, p) => s + p.cantidadAsignada, 0);

        if (totalAsignado === 0) {
          stats.sinAsignar++;
        } else if (totalAsignado < totalSolicitado) {
          stats.parcialmenteAsignados++;
        } else {
          stats.totalmenteAsignados++;
        }

        // Costos
        if (req.expectativa) {
          stats.costoTotalEstimadoUSD += req.expectativa.costoTotalEstimadoUSD || 0;
        }

        // Por responsable
        for (const asig of req.asignaciones || []) {
          if (asig.estado === 'cancelado') continue;

          if (!responsablesMap.has(asig.responsableId)) {
            responsablesMap.set(asig.responsableId, {
              responsableNombre: asig.responsableNombre,
              cantidadRequerimientos: new Set(),
              cantidadProductos: 0,
              valorEstimadoUSD: 0
            });
          }

          const respData = responsablesMap.get(asig.responsableId)!;
          respData.cantidadRequerimientos.add(req.id);
          respData.cantidadProductos += asig.productos.reduce((s, p) => s + p.cantidadAsignada, 0);
          respData.valorEstimadoUSD += asig.costoEstimadoUSD || 0;

          stats.costoTotalRealUSD += asig.costoRealUSD || 0;
        }
      }

      // Convertir mapa a array
      stats.asignacionesPorResponsable = Array.from(responsablesMap.entries()).map(
        ([responsableId, data]) => ({
          responsableId,
          responsableNombre: data.responsableNombre,
          cantidadRequerimientos: data.cantidadRequerimientos.size,
          cantidadProductos: data.cantidadProductos,
          valorEstimadoUSD: data.valorEstimadoUSD
        })
      );

      return stats;
    } catch (error: any) {
      console.error('Error al obtener estadísticas:', error);
      throw new Error('Error al generar estadísticas');
    }
  },

  // ============ MÉTODOS AUXILIARES ============

  /**
   * Generar número de requerimiento
   */
  async generateNumero(): Promise<string> {
    try {
      const year = new Date().getFullYear();
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));

      if (snapshot.empty) {
        return `REQ-${year}-0001`;
      }

      let maxNumber = 0;
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const numero = data.numeroRequerimiento;
        const match = numero?.match(/REQ-\d{4}-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) maxNumber = num;
        }
      });

      return `REQ-${year}-${(maxNumber + 1).toString().padStart(4, '0')}`;
    } catch (error) {
      return `REQ-${new Date().getFullYear()}-0001`;
    }
  },

  /**
   * Calcular resumen de asignaciones
   */
  calcularResumenAsignaciones(
    productos: ProductoRequerimiento[],
    asignaciones: AsignacionResponsable[]
  ): ResumenAsignaciones {
    const asignacionesActivas = asignaciones.filter(a => a.estado !== 'cancelado');

    const responsablesUnicos = new Set(asignacionesActivas.map(a => a.responsableId));

    const totalSolicitado = productos.reduce((s, p) => s + p.cantidadSolicitada, 0);
    const totalAsignado = productos.reduce((s, p) => s + p.cantidadAsignada, 0);
    const totalRecibido = productos.reduce((s, p) => s + p.cantidadRecibida, 0);

    return {
      totalResponsables: responsablesUnicos.size,
      responsablesActivos: responsablesUnicos.size,
      productosAsignados: totalAsignado,
      productosRecibidos: totalRecibido,
      porcentajeCompletado: totalSolicitado > 0
        ? Math.round((totalRecibido / totalSolicitado) * 100)
        : 0
    };
  },

  /**
   * Recalcular cantidades de productos basado en asignaciones
   */
  recalcularProductos(
    productos: ProductoRequerimiento[],
    asignaciones: AsignacionResponsable[]
  ): ProductoRequerimiento[] {
    return productos.map(prod => {
      // Sumar cantidades de todas las asignaciones activas para este producto
      let totalAsignado = 0;
      let totalRecibido = 0;

      for (const asig of asignaciones) {
        if (asig.estado === 'cancelado') continue;

        const prodAsig = asig.productos.find(p => p.productoId === prod.productoId);
        if (prodAsig) {
          totalAsignado += prodAsig.cantidadAsignada;
          totalRecibido += prodAsig.cantidadRecibida;
        }
      }

      return {
        ...prod,
        cantidadAsignada: totalAsignado,
        cantidadRecibida: totalRecibido,
        cantidadPendiente: Math.max(0, prod.cantidadSolicitada - totalAsignado),
        completado: totalRecibido >= prod.cantidadSolicitada
      };
    });
  }
};
