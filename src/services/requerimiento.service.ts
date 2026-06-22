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
  arrayUnion,
  writeBatch
} from 'firebase/firestore';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import { db } from '../lib/firebase';
import { recomputarCoberturaProductos, aplicarCancelacionRef, aplicarEstadoOCaRefs, aplicarCancelacionTotalReq, esFirme, type ModoCancelacionRef } from './requerimiento.cobertura';
import { ORDENES_COLLECTION } from './ordenCompra.shared';
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
  ResumenAsignaciones
} from '../types/requerimiento.types';
import { casillaCrudService } from './casilla.crud.service';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';
import { tipoCambioService } from './tipoCambio.service';
import { ProductoService } from './producto.service';
import { unidadService } from './unidad.service';
import { actividadService } from './actividad.service';
import { NotificationService } from './notification.service';
import { userService } from './user.service';

const COLLECTION_NAME = COLLECTIONS.REQUERIMIENTOS;

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
      logger.error('Error al obtener requerimientos:', error);
      throw new Error('Error al cargar requerimientos');
    }
  },

  /**
   * F4 · Mapa de demanda comprometida por producto = Σ pendienteCompra de requerimientos
   * 'demanda_comprometida' ACTIVOS (excluye borrador/cancelado/completado). Alimenta el motor de
   * reorden: netea el stock disponible para no sugerir reponer lo que ya está prometido a un cliente.
   */
  async getDemandaComprometidaPorProducto(): Promise<Map<string, number>> {
    const ACTIVOS = new Set(['pendiente', 'pendiente_aprobacion', 'aprobado', 'parcial', 'en_proceso']);
    const mapa = new Map<string, number>();
    try {
      const reqs = await requerimientoService.buscar({ origen: 'demanda_comprometida' });
      for (const req of reqs) {
        if (!ACTIVOS.has(req.estado)) continue;
        for (const p of req.productos || []) {
          const pendiente = Math.max(0, p.pendienteCompra || 0);
          if (pendiente > 0) mapa.set(p.productoId, (mapa.get(p.productoId) || 0) + pendiente);
        }
      }
    } catch (error) {
      logger.error('Error al calcular demanda comprometida por producto:', error);
    }
    return mapa;
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
      logger.error('Error al obtener requerimiento:', error);
      throw new Error('Error al cargar requerimiento');
    }
  },

  /**
   * Alias de getById para compatibilidad con callers de expectativaService
   */
  getRequerimientoById(id: string): Promise<Requerimiento | null> {
    return requerimientoService.getById(id);
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

      if (filtros.origen) {
        q = query(q, where('origen', '==', filtros.origen));
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
      logger.error('Error al buscar requerimientos:', error);
      throw new Error('Error al buscar requerimientos');
    }
  },

  /**
   * Obtener requerimientos con filtros opcionales
   * Alias compatible con expectativaService.getRequerimientos()
   */
  async getRequerimientos(filtros?: RequerimientoFiltros): Promise<Requerimiento[]> {
    if (!filtros) {
      return requerimientoService.getAll();
    }
    // If only estado/prioridad/origen are supplied (Firestore-filterable), use buscar
    return requerimientoService.buscar(filtros);
  },

  /**
   * Crear nuevo requerimiento (versión enriquecida — llama ProductoService, calcula expectativa)
   */
  async crearRequerimiento(
    data: RequerimientoFormData,
    userId: string
  ): Promise<string> {
    // Candado duro (F4): la tesis es obligatoria para una apuesta
    if (data.origen === 'administrativo' && data.subtipo === 'apuesta' && !data.tesis?.trim()) {
      throw new Error('La tesis es obligatoria para un requerimiento de tipo apuesta');
    }

    // Verificar duplicados si viene de una cotización/venta
    if (data.ventaRelacionadaId) {
      const reqsExistentes = await requerimientoService.getRequerimientos();
      const reqExistente = reqsExistentes.find(r =>
        r.ventaRelacionadaId === data.ventaRelacionadaId &&
        r.estado !== 'cancelado'
      );
      if (reqExistente) {
        throw new Error(`Ya existe el requerimiento ${reqExistente.numeroRequerimiento} para esta cotización`);
      }
    }

    const numeroRequerimiento = await requerimientoService.generateNumero();

    // Obtener TC centralizado para la expectativa (no bloquea — es estimación)
    const tcInvestigacion = await tipoCambioService.resolverTCVenta();

    // Calcular expectativa financiera usando datos reales de investigación
    const costoEstimadoUSD = data.productos.reduce(
      (sum, p) => sum + (p.precioEstimadoUSD || 0) * p.cantidadSolicitada,
      0
    );

    const impuestoEstimadoUSD = data.productos.reduce((sum, p) => {
      if (p.impuestoPorcentaje && p.impuestoPorcentaje > 0) {
        return sum + (p.precioEstimadoUSD || 0) * p.cantidadSolicitada * (p.impuestoPorcentaje / 100);
      }
      return sum;
    }, 0);

    const fleteEstimadoUSD = data.productos.reduce((sum, p) => {
      if (p.logisticaEstimadaUSD) {
        return sum + p.logisticaEstimadaUSD * p.cantidadSolicitada;
      }
      return sum + (p.precioEstimadoUSD || 0) * p.cantidadSolicitada * 0.10;
    }, 0);

    const costoTotalEstimadoUSD = costoEstimadoUSD + impuestoEstimadoUSD + fleteEstimadoUSD;
    const costoTotalEstimadoPEN = costoTotalEstimadoUSD * tcInvestigacion;

    // Obtener información completa de cada producto desde Firestore
    const productosConInfo = await Promise.all(
      data.productos.map(async (p) => {
        const productoInfo = await ProductoService.getById(p.productoId);

        const producto: Record<string, any> = {
          productoId: p.productoId,
          sku: productoInfo?.sku || '',
          marca: productoInfo?.marca || '',
          nombreComercial: productoInfo?.nombreComercial || '',
          presentacion: productoInfo?.presentacion || '',
          contenido: productoInfo?.contenido || '',
          dosaje: productoInfo?.dosaje || '',
          sabor: productoInfo?.sabor || '',
          ...(productoInfo?.atributosSkincare && { atributosSkincare: productoInfo.atributosSkincare }),
          cantidadSolicitada: p.cantidadSolicitada,
          cantidadAsignada: 0,
          cantidadPendiente: p.cantidadSolicitada,
          cantidadRecibida: 0,
          cantidadEnOC: 0,
          pendienteCompra: p.cantidadSolicitada,
          fechaInvestigacion: Timestamp.now()
        };

        if (p.precioEstimadoUSD !== undefined && p.precioEstimadoUSD !== null) {
          producto.precioEstimadoUSD = p.precioEstimadoUSD;
        }
        if (p.proveedorSugerido) {
          producto.proveedorSugerido = p.proveedorSugerido;
        }
        if (p.urlReferencia) {
          producto.urlReferencia = p.urlReferencia;
        }
        return producto;
      })
    );

    // Construir objeto base sin campos undefined
    const requerimiento: Record<string, any> = {
      numeroRequerimiento,
      origen: data.origen,
      productos: productosConInfo,
      asignaciones: [],
      expectativa: {
        tcInvestigacion,
        costoEstimadoUSD,
        costoEstimadoPEN: costoEstimadoUSD * tcInvestigacion,
        impuestoEstimadoUSD,
        fleteEstimadoUSD,
        costoTotalEstimadoUSD,
        costoTotalEstimadoPEN
      },
      // Blindaje · monto que dispara la doble firma (>$1k) = LANDED (compromiso real de plata · decisión usuario).
      montoEstimadoUSD: costoTotalEstimadoUSD,
      prioridad: data.prioridad,
      estado: 'pendiente',
      solicitadoPor: userId,
      fechaSolicitud: Timestamp.now(),
      creadoPor: userId,
      fechaCreacion: Timestamp.now()
    };

    // Auto-inherit lineaNegocioId from the first product that has one
    const firstProductoWithLinea = await (async () => {
      for (const p of data.productos) {
        const prod = await ProductoService.getById(p.productoId);
        if (prod?.lineaNegocioId) {
          return { lineaNegocioId: prod.lineaNegocioId, lineaNegocioNombre: prod.lineaNegocioNombre || '' };
        }
      }
      return null;
    })();
    if (firstProductoWithLinea) {
      requerimiento.lineaNegocioId = firstProductoWithLinea.lineaNegocioId;
      if (firstProductoWithLinea.lineaNegocioNombre) {
        requerimiento.lineaNegocioNombre = firstProductoWithLinea.lineaNegocioNombre;
      }
    }

    // Agregar campos opcionales solo si tienen valor
    if (data.ventaRelacionadaId) {
      requerimiento.ventaRelacionadaId = data.ventaRelacionadaId;
    }
    if (data.nombreClienteSolicitante) {
      requerimiento.nombreClienteSolicitante = data.nombreClienteSolicitante;
    }
    if (data.fechaRequerida) {
      requerimiento.fechaRequerida = Timestamp.fromDate(data.fechaRequerida);
    }
    if (data.justificacion) {
      requerimiento.justificacion = data.justificacion;
    }
    if (data.observaciones) {
      requerimiento.observaciones = data.observaciones;
    }
    if (data.subtipo) {
      requerimiento.subtipo = data.subtipo;
    }
    if (data.tesis?.trim()) {
      requerimiento.tesis = data.tesis.trim();
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), requerimiento);

    // Broadcast actividad (fire-and-forget)
    actividadService.registrar({
      tipo: 'requerimiento_creado',
      mensaje: `Requerimiento ${numeroRequerimiento} creado - ${data.productos.length} producto(s)`,
      userId,
      displayName: userId,
      metadata: { entidadId: docRef.id, entidadTipo: 'requerimiento' }
    }).catch(() => {});

    return docRef.id;
  },

  /**
   * Crear requerimiento desde cotización (cuando no hay stock)
   */
  async crearRequerimientoDesdeCotizacion(
    cotizacionId: string,
    cotizacionNumero: string,
    nombreCliente: string,
    productos: Array<{
      productoId: string;
      sku: string;
      marca: string;
      nombreComercial: string;
      cantidadFaltante: number;
      precioEstimadoUSD?: number;
      impuestoPorcentaje?: number;
      logisticaEstimadaUSD?: number;
      ctruEstimado?: number;
    }>,
    userId: string
  ): Promise<{ id: string; numero: string }> {
    // Red de seguridad: verificar duplicados antes de crear
    const reqsExistentes = await requerimientoService.getRequerimientos();
    const reqExistente = reqsExistentes.find(r =>
      r.ventaRelacionadaId === cotizacionId &&
      r.estado !== 'cancelado'
    );
    if (reqExistente) {
      logger.warn(`Requerimiento ${reqExistente.numeroRequerimiento} ya existe para cotización ${cotizacionId}, reutilizando.`);
      return { id: reqExistente.id!, numero: reqExistente.numeroRequerimiento };
    }

    const formData: RequerimientoFormData = {
      origen: 'demanda_comprometida',
      ventaRelacionadaId: cotizacionId,
      nombreClienteSolicitante: nombreCliente,
      prioridad: 'alta',
      productos: productos.map(p => ({
        productoId: p.productoId,
        cantidadSolicitada: p.cantidadFaltante,
        precioEstimadoUSD: p.precioEstimadoUSD,
        impuestoPorcentaje: p.impuestoPorcentaje,
        logisticaEstimadaUSD: p.logisticaEstimadaUSD,
        ctruEstimado: p.ctruEstimado
      })),
      justificacion: `Requerimiento automático desde cotización ${cotizacionNumero} - Cliente: ${nombreCliente}`
    };

    const id = await requerimientoService.crearRequerimiento(formData, userId);
    const req = await requerimientoService.getRequerimientoById(id);

    return {
      id,
      numero: req?.numeroRequerimiento || ''
    };
  },

  /**
   * Actualizar estado de un requerimiento
   * Agrega fechaAprobacion, aprobadoPor, fechaCompletado según el estado.
   * Reemplaza al antiguo aprobar() que se mantiene como alias.
   */
  async actualizarEstado(
    requerimientoId: string,
    nuevoEstado: 'pendiente' | 'pendiente_aprobacion' | 'aprobado' | 'en_proceso' | 'completado' | 'cancelado',
    userId: string
  ): Promise<void> {
    const updateData: Record<string, any> = {
      estado: nuevoEstado,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    };

    if (nuevoEstado === 'aprobado') {
      updateData.fechaAprobacion = serverTimestamp();
      updateData.aprobadoPor = userId;
    } else if (nuevoEstado === 'completado') {
      updateData.fechaCompletado = serverTimestamp();
    }

    await updateDoc(doc(db, COLLECTION_NAME, requerimientoId), updateData);

    // Broadcast actividad for approval (fire-and-forget)
    if (nuevoEstado === 'aprobado') {
      actividadService.registrar({
        tipo: 'requerimiento_aprobado',
        mensaje: `Requerimiento ${requerimientoId} aprobado`,
        userId,
        displayName: userId,
        metadata: { entidadId: requerimientoId, entidadTipo: 'requerimiento' }
      }).catch(() => {});
    }
  },

  /**
   * Cancela un requerimiento de forma INTEGRAL (F4 · §6 · B4). En UNA escritura:
   *  1. Retrae sus OCs en BORRADOR (la ref se borra · el producto vuelve al pool) y marca 'soft' las refs
   *     de OCs FIRMES (la compra real PROCEDE a stock · §6). El estado de cada OC se lee del doc real.
   *  2. Recomputa la cobertura derivada y limpia los vínculos a OCs ya no referenciadas.
   *  3. Fuerza estado='cancelado' y DESVINCULA la cotización (`ventaRelacionadaId=null` · Modelo A) → el req
   *     cancelado se vuelve invisible a los guardas anti-duplicado, sin recrear duplicados al próximo adelanto.
   * NO cancela las OCs en sí (solo retrae la ref dentro del req → no re-dispara `cambiarEstado` de la OC).
   * Fase C · C6: libera las reservas de unidades de demanda comprometida (query requerimientoId → liberarUnidades).
   * Reemplaza al `actualizarEstado(id,'cancelado')` cosmético en todo flujo de cancelación de req.
   */
  async cancelarRequerimiento(requerimientoId: string, userId: string): Promise<void> {
    const reqRef = doc(db, COLLECTION_NAME, requerimientoId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) throw new Error('Requerimiento no encontrado');
    const reqData = reqSnap.data();
    if (reqData.estado === 'cancelado') return; // idempotente

    const productos = reqData.productos || [];
    const ordenCompraIds: string[] = reqData.ordenCompraIds || [];

    // Estado REAL de cada OC del req (del doc, no de ref.estadoOC → maneja refs legacy)
    const estadoOCPorId: Record<string, string | undefined> = {};
    if (ordenCompraIds.length > 0) {
      const ocSnaps = await Promise.all(
        ordenCompraIds.map((ocId) => getDoc(doc(db, ORDENES_COLLECTION, ocId)))
      );
      ocSnaps.forEach((s, i) => { estadoOCPorId[ordenCompraIds[i]] = s.data()?.estado as string | undefined; });
    }

    // Puro: retraer borrador (delete) / dejar firme (soft) · luego recomputar cobertura derivada
    const productosCancelados = aplicarCancelacionTotalReq(productos, estadoOCPorId);
    const { productos: productosFinal, ocCoverage } = recomputarCoberturaProductos(productosCancelados);

    // Vínculos a OCs que SIGUEN referenciadas tras la retracción (la borrador eliminada desaparece)
    const ocsVigentes = new Map<string, string>();
    for (const p of productosFinal) {
      for (const r of (p.ordenCompraRefs || [])) {
        if (r.ordenCompraId) ocsVigentes.set(r.ordenCompraId, r.ordenCompraNumero || '');
      }
    }
    const idsVigentes = Array.from(ocsVigentes.keys());
    const numerosVigentes = Array.from(ocsVigentes.values());

    await updateDoc(reqRef, {
      productos: productosFinal,
      ocCoverage,
      estado: 'cancelado',
      ordenCompraIds: idsVigentes,
      ordenCompraNumeros: numerosVigentes,
      ordenCompraId: idsVigentes[0] || null,
      ordenCompraNumero: numerosVigentes[0] || null,
      ventaRelacionadaId: null,        // Modelo A · desvincula la cotización (cierra el re-trigger de duplicado)
      canceladoPor: userId,
      fechaCancelacion: serverTimestamp(),
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId,
    });

    // F4 · Fase C · C6: liberar las unidades de DEMANDA COMPROMETIDA reservadas para este requerimiento
    // (cierra el gap BUG-RESERVA · antes ninguna cancelación liberaba reservas). No bloqueante.
    try {
      const unidadesSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.UNIDADES),
          where('requerimientoId', '==', requerimientoId),
          where('estado', '==', 'reservada')
        )
      );
      if (!unidadesSnap.empty) {
        await unidadService.liberarUnidades(
          unidadesSnap.docs.map((d) => d.id),
          'Requerimiento cancelado',
          userId
        );
      }
    } catch (error) {
      logger.error('Error liberando reservas del requerimiento cancelado (no bloqueante):', error);
    }
  },

  /**
   * Aprobar requerimiento con lógica de aprobación dual
   * - Monto <= $1,000: aprobación directa
   * - Monto > $1,000: requiere aprobación de gerente Y admin
   */
  async aprobar(id: string, userId: string, userRole: string): Promise<{ completa: boolean; pendiente?: 'gerente' | 'admin' }> {
    try {
      const requerimiento = await requerimientoService.getById(id);
      if (!requerimiento) {
        throw new Error('Requerimiento no encontrado');
      }

      if (requerimiento.estado !== 'pendiente' && requerimiento.estado !== 'pendiente_aprobacion') {
        throw new Error('Solo se pueden aprobar requerimientos pendientes');
      }

      // Blindaje · Segregación de funciones: el que SOLICITA no aprueba lo suyo. Admin = root (excepción).
      const creadorId = requerimiento.creadoPor || (requerimiento as any).solicitadoPor;
      if (creadorId && creadorId === userId && userRole !== 'admin') {
        throw new Error('No podés aprobar tu propio requerimiento. Debe aprobarlo otra persona con permiso de aprobación.');
      }

      const montoUSD = requerimiento.montoEstimadoUSD || 0;
      const requiereDual = montoUSD > 1000;

      if (!requiereDual) {
        // Aprobación directa para montos <= $1,000
        await requerimientoService.actualizarEstado(id, 'aprobado', userId);
        return { completa: true };
      }

      // Aprobación dual: verificar rol y registrar firma
      const aprobaciones = requerimiento.aprobaciones || {};
      const rolAprobacion = userRole === 'admin' ? 'admin' : 'gerente';

      if (rolAprobacion !== 'admin' && rolAprobacion !== 'gerente') {
        throw new Error('Solo gerentes y administradores pueden aprobar requerimientos > $1,000');
      }

      // Registrar esta aprobación
      aprobaciones[rolAprobacion] = {
        aprobadoPor: userId,
        fecha: serverTimestamp() as any,
      };

      // Verificar si ambas firmas están
      const tieneGerente = !!aprobaciones.gerente;
      const tieneAdmin = !!aprobaciones.admin;

      if (tieneGerente && tieneAdmin) {
        // Ambas firmas: aprobar completamente
        await updateDoc(doc(db, COLLECTION_NAME, id), {
          estado: 'aprobado',
          aprobaciones,
          aprobadoPor: userId,
          fechaAprobacion: serverTimestamp(),
          ultimaEdicion: serverTimestamp(),
          editadoPor: userId,
        });

        actividadService.registrar({
          tipo: 'requerimiento_aprobado',
          mensaje: `Requerimiento ${id} aprobado (dual)`,
          userId,
          displayName: userId,
          metadata: { entidadId: id, entidadTipo: 'requerimiento' }
        }).catch(() => {});

        return { completa: true };
      } else {
        // Falta una firma: marcar como pendiente_aprobacion
        const pendiente = !tieneGerente ? 'gerente' : 'admin';
        await updateDoc(doc(db, COLLECTION_NAME, id), {
          estado: 'pendiente_aprobacion',
          aprobaciones,
          requiereAprobacionDual: true,
          ultimaEdicion: serverTimestamp(),
          editadoPor: userId,
        });

        // Notificar al rol pendiente
        try {
          const rolPendienteLabel = pendiente === 'admin' ? 'Administrador' : 'Gerente';
          const rolFirmoLabel = pendiente === 'admin' ? 'Gerente' : 'Administrador';
          const usuarios = await userService.getByRole(pendiente as any);
          const activos = usuarios.filter(u => u.activo);

          for (const usuario of activos) {
            await NotificationService.crear({
              tipo: 'aprobacion_pendiente',
              prioridad: 'alta',
              titulo: `Firma pendiente — ${requerimiento.numeroRequerimiento || id}`,
              mensaje: `${rolFirmoLabel} ya firmó. Falta tu firma como ${rolPendienteLabel} para aprobar este requerimiento de $${(montoUSD || 0).toFixed(0)} USD.`,
              usuarioId: usuario.uid,
              requerimientoId: id,
              entidadTipo: 'usuario',
              entidadId: id,
              creadoPor: 'sistema',
              metadata: {
                montoUSD,
                rolPendiente: pendiente,
                rolFirmo: rolAprobacion,
              },
            });
          }
        } catch (notifError) {
          logger.warn('Error al enviar notificación de aprobación dual:', notifError);
        }

        return { completa: false, pendiente };
      }
    } catch (error: any) {
      logger.error('Error al aprobar requerimiento:', error);
      throw new Error(error.message || 'Error al aprobar requerimiento');
    }
  },

  /**
   * Crear nuevo requerimiento — versión legacy (usada por UI que pasa RequerimientoFormData directamente)
   * Mantiene compatibilidad; internamente delega a crearRequerimiento cuando tiene los datos
   * o construye el objeto con los campos del formulario si no se necesita enriquecer.
   */
  async create(data: RequerimientoFormData, userId: string): Promise<Requerimiento> {
    try {
      const numeroRequerimiento = await requerimientoService.generateNumero();

      // Preparar productos con cantidades iniciales
      const productos: ProductoRequerimiento[] = data.productos.map(p => ({
        productoId: p.productoId,
        sku: p.sku || '',
        marca: p.marca || '',
        nombreComercial: p.nombreComercial || '',
        presentacion: p.presentacion,
        contenido: p.contenido,
        dosaje: p.dosaje,
        sabor: p.sabor,
        cantidadSolicitada: p.cantidadSolicitada,
        cantidadAsignada: 0,
        cantidadRecibida: 0,
        cantidadPendiente: p.cantidadSolicitada,
        cantidadEnOC: 0,
        pendienteCompra: p.cantidadSolicitada,
        precioEstimadoUSD: p.precioEstimadoUSD,
        precioVentaPEN: p.precioVentaPEN,
        completado: false
      }));

      const nuevoRequerimiento: Omit<Requerimiento, 'id'> = {
        numeroRequerimiento,
        origen: data.origen,
        subtipo: data.subtipo,
        tesis: data.tesis,
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
      logger.error('Error al crear requerimiento:', error);
      throw new Error(error.message || 'Error al crear requerimiento');
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
      const requerimiento = await requerimientoService.getById(requerimientoId);
      if (!requerimiento) {
        throw new Error('Requerimiento no encontrado');
      }

      if (requerimiento.estado === 'cancelado' || requerimiento.estado === 'completado') {
        throw new Error('No se puede asignar a un requerimiento cancelado o completado');
      }

      // Obtener datos del responsable (la casilla · su dueño es el colaborador/viajero)
      const responsable = await casillaCrudService.getById(data.responsableId);
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
        esViajero: responsable.tipo === 'casilla_viajero',
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
      }
      // (legacy) Se eliminó el fallback a `responsable.proximoViaje`: "próximo viaje" es
      // feature muerto (deprecado S42j) · la casilla no lo tiene. chk5.ENVIOS-UNIF.
      if (data.costoEstimadoUSD !== undefined && data.costoEstimadoUSD !== null) {
        nuevaAsignacion.costoEstimadoUSD = data.costoEstimadoUSD;
      }
      if (data.notas) {
        nuevaAsignacion.notas = data.notas;
      }

      // Actualizar cantidades en productos del requerimiento
      const productosActualizados = requerimiento.productos.map(prod => {
        const asignado = productosAsignados.find(p => p.productoId === prod.productoId);

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

        return {
          ...prod,
          cantidadAsignada: cantidadAsignadaPrevia,
          cantidadPendiente: cantidadPendientePrevia,
          cantidadRecibida: cantidadRecibidaPrevia
        };
      });

      const asignacionesPrevias = requerimiento.asignaciones || [];
      const asignacionesActualizadas = [...asignacionesPrevias, nuevaAsignacion];
      const resumen = requerimientoService.calcularResumenAsignaciones(productosActualizados, asignacionesActualizadas as AsignacionResponsable[]);

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

      logger.log(`[Requerimiento] Asignado ${responsable.nombre} a ${requerimiento.numeroRequerimiento}`);

      return nuevaAsignacion as AsignacionResponsable;
    } catch (error: any) {
      logger.error('Error al asignar responsable:', error);
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
      const requerimiento = await requerimientoService.getById(requerimientoId);
      if (!requerimiento) {
        throw new Error('Requerimiento no encontrado');
      }

      const asignacionIndex = requerimiento.asignaciones.findIndex(a => a.id === asignacionId);
      if (asignacionIndex === -1) {
        throw new Error('Asignación no encontrada');
      }

      const asignacion = requerimiento.asignaciones[asignacionIndex];

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

      const asignacionesActualizadas = [...requerimiento.asignaciones];
      asignacionesActualizadas[asignacionIndex] = asignacionActualizada;

      const productosActualizados = requerimientoService.recalcularProductos(
        requerimiento.productos,
        asignacionesActualizadas
      );

      const resumen = requerimientoService.calcularResumenAsignaciones(productosActualizados, asignacionesActualizadas);

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
      logger.error('Error al actualizar asignación:', error);
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
      const requerimiento = await requerimientoService.getById(requerimientoId);
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

      const asignacionActualizada: AsignacionResponsable = {
        ...asignacion,
        estado: 'cancelado',
        notas: `${asignacion.notas || ''}\n[CANCELADO]: ${motivo}`.trim(),
        actualizadoPor: userId,
        fechaActualizacion: Timestamp.now()
      };

      const asignacionesActualizadas = [...requerimiento.asignaciones];
      asignacionesActualizadas[asignacionIndex] = asignacionActualizada;

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

      const resumen = requerimientoService.calcularResumenAsignaciones(productosActualizados, asignacionesActualizadas);

      await updateDoc(doc(db, COLLECTION_NAME, requerimientoId), {
        productos: productosActualizados,
        asignaciones: asignacionesActualizadas,
        resumenAsignaciones: resumen,
        fechaActualizacion: serverTimestamp(),
        actualizadoPor: userId
      });
    } catch (error: any) {
      logger.error('Error al cancelar asignación:', error);
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
    await requerimientoService.actualizarAsignacion(requerimientoId, asignacionId, {
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
    await requerimientoService.actualizarAsignacion(requerimientoId, asignacionId, {
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
    await requerimientoService.actualizarAsignacion(requerimientoId, asignacionId, {
      estado: 'recibido',
      fechaRecepcion: new Date(),
      productosRecibidos
    }, userId);
  },

  /**
   * Vincular requerimiento con OC (legacy — sin info de productos)
   */
  async vincularConOC(
    requerimientoId: string,
    ordenCompraId: string,
    ordenCompraNumero: string,
    userId: string
  ): Promise<void> {
    try {
      const { OrdenCompraService } = await import('./ordenCompra.service');
      const oc = await OrdenCompraService.getById(ordenCompraId);
      if (oc && oc.productos.length > 0) {
        const productosOC = oc.productos.map(p => ({
          productoId: p.productoId,
          cantidad: p.cantidad,
        }));
        await requerimientoService.vincularConOCParcial(
          requerimientoId, ordenCompraId, ordenCompraNumero, productosOC, userId
        );
        return;
      }
    } catch (error) {
      logger.warn('vincularConOC: no se pudo obtener OC para coverage, usando legacy:', error);
    }

    // Blindaje · enforce de aprobación también en el fallback legacy.
    const reqSnap = await getDoc(doc(db, COLLECTION_NAME, requerimientoId));
    const estadoReq = reqSnap.data()?.estado as string | undefined;
    if (!['aprobado', 'parcial', 'en_proceso'].includes(estadoReq || '')) {
      throw new Error(`Requerimiento ${requerimientoId} sin aprobar (estado: ${estadoReq}) · no puede vincularse a una OC.`);
    }

    // Fallback legacy: marcar como en_proceso
    await updateDoc(doc(db, COLLECTION_NAME, requerimientoId), {
      estado: 'en_proceso',
      ordenCompraId,
      ordenCompraNumero,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    });
  },

  /**
   * Vincular requerimiento con OC de forma parcial (por producto)
   * Actualiza cantidadEnOC, pendienteCompra, ordenCompraRefs por producto,
   * y calcula ocCoverage del requerimiento.
   */
  async vincularConOCParcial(
    requerimientoId: string,
    ordenCompraId: string,
    ordenCompraNumero: string,
    productosOC: Array<{ productoId: string; cantidad: number }>,
    userId: string
  ): Promise<void> {
    const reqDoc = await getDoc(doc(db, COLLECTION_NAME, requerimientoId));
    if (!reqDoc.exists()) {
      logger.warn(`vincularConOCParcial: req ${requerimientoId} no encontrado`);
      return;
    }
    const reqData = reqDoc.data() as any;

    // Blindaje · enforce de aprobación en el SERVICIO: no se vincula a OC un requerimiento que no pasó
    // por aprobación (antes solo lo filtraba la UI · bypass posible vía servicio/API).
    if (!['aprobado', 'parcial', 'en_proceso'].includes(reqData.estado)) {
      throw new Error(`Requerimiento ${requerimientoId} sin aprobar (estado: ${reqData.estado}) · no puede vincularse a una OC.`);
    }

    const productos = reqData.productos || [];

    // Estado actual de la OC → se stampa en la ref (gate de cobertura §4 · la OC nace borrador = no cuenta aún)
    const ocSnap = await getDoc(doc(db, ORDENES_COLLECTION, ordenCompraId));
    const estadoOC = (ocSnap.data()?.estado as string | undefined) ?? 'borrador';

    // Construir/actualizar las refs por producto (EDGE-003: dedup por ordenCompraId · sin doble conteo)
    const productosConRefs = productos.map((p: any) => {
      const ocItem = productosOC.find(o => o.productoId === p.productoId);
      if (!ocItem) return p;

      const refs: any[] = [...(p.ordenCompraRefs || [])];
      const indiceExistente = refs.findIndex((r) => r.ordenCompraId === ordenCompraId);
      if (indiceExistente >= 0) {
        // Ya vinculado — actualizar sin duplicar (re-sincroniza estadoOC + estado)
        refs[indiceExistente] = { ...refs[indiceExistente], ordenCompraId, ordenCompraNumero, cantidad: ocItem.cantidad, estadoOC, estado: 'vigente' };
      } else {
        refs.push({ ordenCompraId, ordenCompraNumero, cantidad: ocItem.cantidad, estadoOC, estado: 'vigente' });
      }
      return { ...p, ordenCompraRefs: refs };
    });

    // Cobertura derivada (fuente única · cuenta solo OCs firmes y no canceladas · §4)
    const { productos: productosActualizados, ocCoverage, estadoSugerido } =
      recomputarCoberturaProductos(productosConRefs);

    // Al vincular solo se SUBE el estado (la baja a 'aprobado' la hace la reversión)
    let nuevoEstado = reqData.estado;
    if (estadoSugerido === 'en_proceso') {
      nuevoEstado = 'en_proceso';
    } else if (estadoSugerido === 'parcial') {
      nuevoEstado = 'parcial';
    }

    await updateDoc(doc(db, COLLECTION_NAME, requerimientoId), {
      productos: productosActualizados,
      estado: nuevoEstado,
      ordenCompraId: reqData.ordenCompraId || ordenCompraId,
      ordenCompraNumero: reqData.ordenCompraNumero || ordenCompraNumero,
      ordenCompraIds: arrayUnion(ordenCompraId),
      ordenCompraNumeros: arrayUnion(ordenCompraNumero),
      ocCoverage,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId,
    });
  },

  /**
   * Desvincular una OC de sus requerimientos (al eliminar OC borrador).
   * Revierte cantidadEnOC, pendienteCompra y ordenCompraRefs.
   */
  async desvincularOCDeRequerimientos(
    ordenCompraId: string,
    ordenCompraNumero: string
  ): Promise<void> {
    const reqsSnap = await getDocs(
      query(
        collection(db, COLLECTION_NAME),
        where('ordenCompraIds', 'array-contains', ordenCompraId)
      )
    );

    if (reqsSnap.empty) {
      const reqsSnapLegacy = await getDocs(
        query(
          collection(db, COLLECTION_NAME),
          where('ordenCompraId', '==', ordenCompraId)
        )
      );
      if (reqsSnapLegacy.empty) return;
      for (const reqDoc of reqsSnapLegacy.docs) {
        await requerimientoService._revertirOCEnReq(reqDoc, ordenCompraId, ordenCompraNumero);
      }
      return;
    }

    for (const reqDoc of reqsSnap.docs) {
      await requerimientoService._revertirOCEnReq(reqDoc, ordenCompraId, ordenCompraNumero);
    }
  },

  /** Helper interno: revertir una OC específica dentro de un requerimiento */
  async _revertirOCEnReq(
    reqDoc: any,
    ordenCompraId: string,
    ordenCompraNumero: string,
    modo: ModoCancelacionRef = 'delete',
    opts?: { productoId?: string; cantidadCancelar?: number }
  ): Promise<void> {
    const reqData = reqDoc.data() as any;
    const productos = reqData.productos || [];

    // Mutar la(s) ref(s) de esta OC según el modo (delete/soft/porcion · puro)
    const productosConRefs = aplicarCancelacionRef(productos, ordenCompraId, modo, opts);

    // Cobertura derivada (motor único · recomputa del array · §4)
    const { productos: productosActualizados, ocCoverage, estadoSugerido } =
      recomputarCoberturaProductos(productosConRefs);

    const updates: Record<string, any> = {
      productos: productosActualizados,
      estado: estadoSugerido,
      ocCoverage,
      ultimaEdicion: serverTimestamp(),
    };

    // Si la OC ya no está en ninguna ref tras la mutación (delete la quita · soft/porcion la dejan),
    // sacarla de los arrays de vínculo del requerimiento.
    const aunReferenciada = productosActualizados.some((p: any) =>
      (p.ordenCompraRefs || []).some((r: any) => r.ordenCompraId === ordenCompraId)
    );
    if (!aunReferenciada) {
      const ordenCompraIds = (reqData.ordenCompraIds || []).filter((id: string) => id !== ordenCompraId);
      const ordenCompraNumeros = (reqData.ordenCompraNumeros || []).filter((n: string) => n !== ordenCompraNumero);
      updates.ordenCompraIds = ordenCompraIds;
      updates.ordenCompraNumeros = ordenCompraNumeros;
      if (reqData.ordenCompraId === ordenCompraId) {
        updates.ordenCompraId = ordenCompraIds[0] || null;
        updates.ordenCompraNumero = ordenCompraNumeros[0] || null;
      }
    }

    await updateDoc(doc(db, COLLECTION_NAME, reqDoc.id), updates);
  },

  /**
   * Cancela la cobertura de una OC sobre los requerimientos (F4 · §6). 3 alcances:
   *  - 'oc_completa' : sobre TODOS los reqs que referencian la OC.
   *  - 'req_en_oc'   : solo el req indicado (la OC consolidada queda viva para los demás · BUG-B).
   *  - 'porcion'     : N unidades de un producto de un req.
   * Regla de irreversibilidad (leída de oc.estado): borrador → retrae ('delete' · vuelve al pool);
   * firme (enviada+) → 'soft' (marca cancelada · la compra procede a stock). Reutiliza _revertirOCEnReq.
   * Cableado (B3): `cambiarEstado` de la OC lo invoca con scope 'oc_completa' al cancelar la OC. El cancel
   * de un REQUERIMIENTO usa `cancelarRequerimiento` (B4), que aplica la retracción total sin pasar por aquí.
   */
  async cancelarReferenciaOC(params: {
    scope: 'oc_completa' | 'req_en_oc' | 'porcion';
    ordenCompraId: string;
    ordenCompraNumero: string;
    requerimientoId?: string;
    productoId?: string;
    cantidadCancelar?: number;
    ocEstadoActual?: string;   // si se pasa, evita el getDoc (cambiarEstado pasa el estado PRE-cambio)
  }): Promise<void> {
    const { scope, ordenCompraId, ordenCompraNumero, requerimientoId, productoId, cantidadCancelar, ocEstadoActual } = params;

    // Irreversibilidad: el modo sale del estado de la OC (borrador retractable · firme deja rastro)
    let ocEstado = ocEstadoActual;
    if (ocEstado === undefined) {
      const ocSnap = await getDoc(doc(db, ORDENES_COLLECTION, ordenCompraId));
      ocEstado = ocSnap.data()?.estado as string | undefined;
    }
    const modoBase: ModoCancelacionRef = esFirme(ocEstado) ? 'soft' : 'delete';

    if (scope === 'oc_completa') {
      const reqsSnap = await getDocs(
        query(collection(db, COLLECTION_NAME), where('ordenCompraIds', 'array-contains', ordenCompraId))
      );
      for (const reqDoc of reqsSnap.docs) {
        await requerimientoService._revertirOCEnReq(reqDoc, ordenCompraId, ordenCompraNumero, modoBase);
      }
      return;
    }

    if (!requerimientoId) {
      throw new Error(`cancelarReferenciaOC(${scope}): requerimientoId requerido`);
    }
    const reqDoc = await getDoc(doc(db, COLLECTION_NAME, requerimientoId));
    if (!reqDoc.exists()) return;

    if (scope === 'req_en_oc') {
      await requerimientoService._revertirOCEnReq(reqDoc, ordenCompraId, ordenCompraNumero, modoBase);
      return;
    }

    // porcion
    if (!productoId || cantidadCancelar == null) {
      throw new Error('cancelarReferenciaOC(porcion): productoId y cantidadCancelar requeridos');
    }
    await requerimientoService._revertirOCEnReq(reqDoc, ordenCompraId, ordenCompraNumero, 'porcion', { productoId, cantidadCancelar });
  },

  /**
   * Propaga el nuevo estado de una OC (cache `estadoOC` denormalizado) a TODOS los requerimientos que la
   * referencian y recomputa su cobertura. Es el ÚNICO sincronizador del denormalizado · lo llama
   * `cambiarEstado` de la OC (F4 · B3). Al pasar borrador→firme la cobertura SUBE (la ref ya estaba,
   * ahora `esFirme` la cuenta). Atómico por writeBatch. NO toca refs canceladas (siguen canceladas).
   */
  async propagarEstadoOCaRequerimientos(
    ordenCompraId: string,
    _ordenCompraNumero: string,
    nuevoEstadoOC: string
  ): Promise<void> {
    const reqsSnap = await getDocs(
      query(collection(db, COLLECTION_NAME), where('ordenCompraIds', 'array-contains', ordenCompraId))
    );
    if (reqsSnap.empty) return;

    const batch = writeBatch(db);
    for (const reqDoc of reqsSnap.docs) {
      const reqData = reqDoc.data();
      const productos = reqData.productos || [];
      const productosConEstado = aplicarEstadoOCaRefs(productos, ordenCompraId, nuevoEstadoOC);
      const { productos: productosActualizados, ocCoverage, estadoSugerido } =
        recomputarCoberturaProductos(productosConEstado);

      // El estado del req SOLO se mueve dentro de los estados de cobertura (no degradar
      // pendiente/aprobación ni pisar completado/cancelado · la recepción es Fase C).
      const ESTADOS_COBERTURA = ['aprobado', 'parcial', 'en_proceso'];
      const estadoFinal = ESTADOS_COBERTURA.includes(reqData.estado) ? estadoSugerido : reqData.estado;

      batch.update(reqDoc.ref, {
        productos: productosActualizados,
        ocCoverage,
        estado: estadoFinal,
        ultimaEdicion: serverTimestamp(),
      });
    }
    await batch.commit();
  },

  /**
   * Vincular retroactivamente una OC existente con una cotización.
   * Crea requerimiento → lo aprueba → vincula con OC → reserva unidades → completa.
   */
  async vincularOCRetroactivamente(params: {
    cotizacionId: string;
    cotizacionNumero: string;
    nombreCliente: string;
    ordenCompraId: string;
    ordenCompraNumero: string;
    productos: Array<{
      productoId: string;
      sku: string;
      marca: string;
      nombreComercial: string;
      cantidadFaltante: number;
      precioEstimadoUSD?: number;
    }>;
    userId: string;
  }): Promise<{ requerimientoId: string; requerimientoNumero: string; unidadesReservadas: number; detalles: Array<{ productoId: string; reservadas: number; faltantes: number }> }> {
    const { cotizacionId, cotizacionNumero, nombreCliente, ordenCompraId, ordenCompraNumero, productos, userId } = params;

    // 1. Buscar requerimiento existente para esta cotización (evitar duplicados)
    let requerimientoId: string;
    let requerimientoNumero: string;
    let reqYaVinculadoAEstaOC = false;

    const reqsExistentes = await requerimientoService.getRequerimientos();
    // Primero buscar uno sin OC vinculada (pendiente o aprobado)
    let reqExistente = reqsExistentes.find(r =>
      r.ventaRelacionadaId === cotizacionId &&
      r.estado !== 'cancelado' &&
      !r.ordenCompraId
    );

    // Si no hay sin vincular, buscar uno ya vinculado a ESTA misma OC (re-ejecución)
    if (!reqExistente) {
      reqExistente = reqsExistentes.find(r =>
        r.ventaRelacionadaId === cotizacionId &&
        r.estado !== 'cancelado' &&
        r.ordenCompraId === ordenCompraId
      );
      if (reqExistente) reqYaVinculadoAEstaOC = true;
    }

    // Si tampoco, buscar CUALQUIER requerimiento no cancelado para esta cotización
    // (puede estar vinculado a otra OC — evita crear duplicado)
    if (!reqExistente) {
      reqExistente = reqsExistentes.find(r =>
        r.ventaRelacionadaId === cotizacionId &&
        r.estado !== 'cancelado'
      );
    }

    if (reqExistente) {
      // Reutilizar el requerimiento existente
      requerimientoId = reqExistente.id!;
      requerimientoNumero = reqExistente.numeroRequerimiento;

      // Si estaba pendiente, aprobarlo
      if (reqExistente.estado === 'pendiente') {
        await requerimientoService.actualizarEstado(requerimientoId, 'aprobado', userId);
      }
    } else {
      // Crear nuevo solo si no existe ninguno para esta cotización
      const created = await requerimientoService.crearRequerimientoDesdeCotizacion(
        cotizacionId,
        cotizacionNumero,
        nombreCliente,
        productos.map(p => ({
          productoId: p.productoId,
          sku: p.sku,
          marca: p.marca,
          nombreComercial: p.nombreComercial,
          cantidadFaltante: p.cantidadFaltante,
          precioEstimadoUSD: p.precioEstimadoUSD
        })),
        userId
      );
      requerimientoId = created.id;
      requerimientoNumero = created.numero;

      // Aprobar inmediatamente
      await requerimientoService.actualizarEstado(requerimientoId, 'aprobado', userId);
    }

    // 2. Vincular con la OC (saltar si ya estaba vinculado a esta misma OC)
    if (!reqYaVinculadoAEstaOC) {
      await requerimientoService.vincularConOC(requerimientoId, ordenCompraId, ordenCompraNumero, userId);
    }

    // 2b. Recalcular expectativa financiera con costos reales de la OC
    try {
      const { OrdenCompraService } = await import('./ordenCompra.service');
      const ordenCompra = await OrdenCompraService.getById(ordenCompraId);
      if (ordenCompra) {
        const tcActual = await tipoCambioService.resolverTCVenta();

        const costoEstimadoUSD = productos.reduce((sum, p) => {
          const productoOC = ordenCompra.productos.find(po => po.productoId === p.productoId);
          const costoReal = productoOC?.costoUnitario || p.precioEstimadoUSD || 0;
          return sum + costoReal * p.cantidadFaltante;
        }, 0);

        const fleteEstimadoUSD = 0;
        const impuestoEstimadoUSD = 0;
        const costoTotalEstimadoUSD = costoEstimadoUSD + impuestoEstimadoUSD + fleteEstimadoUSD;

        await updateDoc(doc(db, COLLECTION_NAME, requerimientoId), {
          expectativa: {
            tcInvestigacion: tcActual,
            costoEstimadoUSD,
            costoEstimadoPEN: costoEstimadoUSD * tcActual,
            impuestoEstimadoUSD,
            fleteEstimadoUSD,
            costoTotalEstimadoUSD,
            costoTotalEstimadoPEN: costoTotalEstimadoUSD * tcActual
          }
        });
      }
    } catch (e) {
      logger.warn('No se pudo recalcular expectativa con datos de OC:', e);
    }

    // 3. Actualizar la OC con el requerimientoId (solo si no estaba ya vinculado)
    const ORDENES_COLLECTION = COLLECTIONS.ORDENES_COMPRA;
    const ordenRef = doc(db, ORDENES_COLLECTION, ordenCompraId);

    if (!reqYaVinculadoAEstaOC) {
      const ordenSnap = await getDoc(ordenRef);
      if (ordenSnap.exists()) {
        const ordenData = ordenSnap.data();
        const existingReqIds = ordenData.requerimientoIds || [];
        const existingReqNumeros = ordenData.requerimientoNumeros || [];
        const existingProductosOrigen = ordenData.productosOrigen || [];

        const newProductosOrigen = productos.map(p => ({
          productoId: p.productoId,
          requerimientoId,
          requerimientoNumero,
          cotizacionId,
          clienteNombre: nombreCliente,
          cantidad: p.cantidadFaltante
        }));

        await updateDoc(ordenRef, {
          ...(!ordenData.requerimientoId ? { requerimientoId, requerimientoNumero } : {}),
          requerimientoIds: [...existingReqIds, requerimientoId],
          requerimientoNumeros: [...existingReqNumeros, requerimientoNumero],
          productosOrigen: [...existingProductosOrigen, ...newProductosOrigen],
          ultimaEdicion: serverTimestamp(),
          editadoPor: userId
        });
      }
    }

    // 4. Reservar unidades existentes
    const reservaResult = await unidadService.reservarUnidadesParaCotizacion({
      ordenCompraId,
      cotizacionId,
      cotizacionNumero,
      requerimientoId,
      productos: productos.map(p => ({
        productoId: p.productoId,
        cantidad: p.cantidadFaltante
      })),
      userId
    });

    // 5. El estado del requerimiento ya fue calculado por vincularConOC/vincularConOCParcial

    // 6. Actualizar cotización/venta con el requerimiento generado
    const VENTAS_COLLECTION = COLLECTIONS.VENTAS;
    try {
      const ventaRef = doc(db, VENTAS_COLLECTION, cotizacionId);
      const ventaSnap = await getDoc(ventaRef);
      if (ventaSnap.exists()) {
        const ventaData = ventaSnap.data();
        const existingReqIds = ventaData.requerimientosIds || [];
        const existingReqNumeros = ventaData.requerimientosNumeros || [];

        const todasReservadas = reservaResult.detalles.every(d => d.faltantes === 0);

        const updateData: Record<string, any> = {
          requerimientosIds: [...new Set([...existingReqIds, requerimientoId])],
          requerimientosNumeros: [...new Set([...existingReqNumeros, requerimientoNumero])]
        };

        if (todasReservadas && reservaResult.totalReservadas > 0) {
          updateData.requiereStock = false;
          updateData.productosConFaltante = null;
        }

        await updateDoc(ventaRef, updateData);
      }
    } catch (e) {
      logger.warn('No se pudo actualizar la venta con requerimientoId:', e);
    }

    return {
      requerimientoId,
      requerimientoNumero,
      unidadesReservadas: reservaResult.totalReservadas,
      detalles: reservaResult.detalles
    };
  },

  /**
   * Consolidar productos de múltiples requerimientos para OC unificada
   */
  consolidarProductosRequerimientos(requerimientos: Requerimiento[]): {
    productosConsolidados: Array<{
      productoId: string;
      sku: string;
      marca: string;
      nombreComercial: string;
      cantidadTotal: number;
      precioEstimadoUSD: number;
      origenes: Array<{
        requerimientoId: string;
        requerimientoNumero: string;
        cotizacionId?: string;
        clienteNombre?: string;
        cantidad: number;
      }>;
    }>;
    resumen: { totalProductos: number; totalUnidades: number; clientes: string[] };
  } {
    const productoMap = new Map<string, {
      productoId: string;
      sku: string;
      marca: string;
      nombreComercial: string;
      cantidadTotal: number;
      precioAcumulado: number;
      cantidadParaPrecio: number;
      origenes: Array<{
        requerimientoId: string;
        requerimientoNumero: string;
        cotizacionId?: string;
        clienteNombre?: string;
        cantidad: number;
      }>;
    }>();

    const clientesSet = new Set<string>();

    for (const req of requerimientos) {
      const clienteNombre = req.nombreClienteSolicitante || 'Stock interno';
      clientesSet.add(clienteNombre);

      for (const prod of req.productos) {
        const existing = productoMap.get(prod.productoId);
        const origen = {
          requerimientoId: req.id!,
          requerimientoNumero: req.numeroRequerimiento,
          cotizacionId: req.ventaRelacionadaId,
          clienteNombre,
          cantidad: prod.cantidadSolicitada
        };

        if (existing) {
          existing.cantidadTotal += prod.cantidadSolicitada;
          if (prod.precioEstimadoUSD) {
            existing.precioAcumulado += prod.precioEstimadoUSD * prod.cantidadSolicitada;
            existing.cantidadParaPrecio += prod.cantidadSolicitada;
          }
          existing.origenes.push(origen);
        } else {
          productoMap.set(prod.productoId, {
            productoId: prod.productoId,
            sku: prod.sku || '',
            marca: prod.marca || '',
            nombreComercial: prod.nombreComercial || '',
            cantidadTotal: prod.cantidadSolicitada,
            precioAcumulado: (prod.precioEstimadoUSD || 0) * prod.cantidadSolicitada,
            cantidadParaPrecio: prod.precioEstimadoUSD ? prod.cantidadSolicitada : 0,
            origenes: [origen]
          });
        }
      }
    }

    const productosConsolidados = Array.from(productoMap.values()).map(p => ({
      productoId: p.productoId,
      sku: p.sku,
      marca: p.marca,
      nombreComercial: p.nombreComercial,
      cantidadTotal: p.cantidadTotal,
      precioEstimadoUSD: p.cantidadParaPrecio > 0 ? p.precioAcumulado / p.cantidadParaPrecio : 0,
      origenes: p.origenes
    }));

    return {
      productosConsolidados,
      resumen: {
        totalProductos: productosConsolidados.length,
        totalUnidades: productosConsolidados.reduce((sum, p) => sum + p.cantidadTotal, 0),
        clientes: Array.from(clientesSet)
      }
    };
  },

  /**
   * Limpieza de datos: eliminar requerimientos duplicados y corregir flags de ventas.
   */
  async limpiarDatosVinculacion(userId: string): Promise<{
    reqsCancelados: string[];
    ventasCorregidas: string[];
    resumen: string;
  }> {
    const reqsCancelados: string[] = [];
    const ventasCorregidas: string[] = [];

    // 1. Obtener todos los requerimientos
    const allReqs = await requerimientoService.getRequerimientos();

    // 2. Agrupar por ventaRelacionadaId (cotización)
    const reqsPorCotizacion = new Map<string, typeof allReqs>();
    for (const req of allReqs) {
      if (!req.ventaRelacionadaId || req.estado === 'cancelado') continue;
      const existing = reqsPorCotizacion.get(req.ventaRelacionadaId) || [];
      existing.push(req);
      reqsPorCotizacion.set(req.ventaRelacionadaId, existing);
    }

    // 3. Para cada grupo con duplicados, mantener el que tiene OC vinculada más reciente
    for (const [cotId, reqs] of reqsPorCotizacion) {
      if (reqs.length <= 1) continue;

      const sorted = [...reqs].sort((a, b) => {
        const aHasOC = a.ordenCompraId ? 1 : 0;
        const bHasOC = b.ordenCompraId ? 1 : 0;
        if (aHasOC !== bHasOC) return bHasOC - aHasOC;
        const stateOrder: Record<string, number> = { completado: 3, en_proceso: 2, aprobado: 1, pendiente: 0 };
        return (stateOrder[b.estado] || 0) - (stateOrder[a.estado] || 0);
      });

      const keeper = sorted[0];
      for (let i = 1; i < sorted.length; i++) {
        const dup = sorted[i];
        try {
          // Cancelación INTEGRAL (B4): retrae OCs borrador + desvincula la cotización (no solo cosmético)
          await requerimientoService.cancelarRequerimiento(dup.id!, userId);
          reqsCancelados.push(`${dup.numeroRequerimiento} (${dup.nombreClienteSolicitante || cotId})`);
        } catch (e) {
          logger.error(`Error cancelando ${dup.numeroRequerimiento}:`, e);
        }
      }
    }

    // 4. Corregir ventas con requiereStock=true que ya tienen reqs completados con OC
    const { VentaService } = await import('./venta.service');
    const ventas = await VentaService.getAll();
    const ventasConFaltante = ventas.filter(v => v.estado === 'confirmada' && v.requiereStock === true);

    for (const venta of ventasConFaltante) {
      const reqsDeEstaVenta = allReqs.filter(r =>
        r.ventaRelacionadaId === venta.id &&
        r.estado !== 'cancelado'
      );

      const tieneReqCompletadoConOC = reqsDeEstaVenta.some(r =>
        r.estado === 'completado' && r.ordenCompraId
      );

      if (tieneReqCompletadoConOC) {
        try {
          const ventaRef = doc(db, COLLECTIONS.VENTAS, venta.id);
          await updateDoc(ventaRef, {
            requiereStock: false,
            productosConFaltante: null
          });
          ventasCorregidas.push(`${venta.numeroVenta} (${venta.nombreCliente})`);
        } catch (e) {
          logger.error(`Error actualizando venta ${venta.numeroVenta}:`, e);
        }
      }
    }

    const resumen = [
      `Requerimientos duplicados cancelados: ${reqsCancelados.length}`,
      ...reqsCancelados.map(r => `  - ${r}`),
      `Ventas corregidas (requiereStock → false): ${ventasCorregidas.length}`,
      ...ventasCorregidas.map(v => `  - ${v}`)
    ].join('\n');

    return { reqsCancelados, ventasCorregidas, resumen };
  },

  /**
   * Obtener requerimientos asignados a un responsable
   */
  async getByResponsable(responsableId: string): Promise<Requerimiento[]> {
    return requerimientoService.buscar({ responsableId });
  },

  /**
   * Obtener estadísticas
   */
  async getStats(): Promise<RequerimientoStats> {
    try {
      const requerimientos = await requerimientoService.getAll();

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
        switch (req.estado) {
          case 'pendiente': stats.pendientes++; break;
          case 'aprobado': stats.aprobados++; break;
          case 'en_proceso': stats.enProceso++; break;
          case 'completado': stats.completados++; break;
          case 'cancelado': stats.cancelados++; break;
        }

        if (req.prioridad === 'urgente') stats.urgentes++;

        const totalSolicitado = req.productos.reduce((s, p) => s + p.cantidadSolicitada, 0);
        const totalAsignado = req.productos.reduce((s, p) => s + p.cantidadAsignada, 0);

        if (totalAsignado === 0) {
          stats.sinAsignar++;
        } else if (totalAsignado < totalSolicitado) {
          stats.parcialmenteAsignados++;
        } else {
          stats.totalmenteAsignados++;
        }

        if (req.expectativa) {
          stats.costoTotalEstimadoUSD += req.expectativa.costoTotalEstimadoUSD || 0;
        }

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
      logger.error('Error al obtener estadísticas:', error);
      throw new Error('Error al generar estadísticas');
    }
  },

  // ============ MÉTODOS AUXILIARES ============

  /**
   * Generar número de requerimiento
   */
  async generateNumero(): Promise<string> {
    const year = new Date().getFullYear();
    return getNextSequenceNumber(`REQ-${year}`, 4);
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
