import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  Cotizacion,
  CotizacionFormData,
  EstadoCotizacion,
  ProductoCotizacion,
  ComprometerAdelantoData,
  RegistrarAdelantoData,
  RechazarCotizacionData,
  AdelantoComprometido,
  AdelantoPagado,
  ReservaStockCotizacion,
  CotizacionStats,
  CotizacionFilters,
  MotivoRechazo
} from '../types/cotizacion.types';
import type {
  Venta,
  VentaFormData,
  MetodoPago,
  TipoReserva,
  ProductoReservado,
  ProductoStockVirtual
} from '../types/venta.types';
import type { Unidad } from '../types/unidad.types';
import type { MetodoTesoreria } from '../types/tesoreria.types';
import type { FuenteStock, DisponibilidadProducto } from '../types/stockDisponibilidad.types';
import { ProductoService } from './producto.service';
import { inventarioService } from './inventario.service';
import { unidadService } from './unidad.service';
import { VentaService } from './venta.service';
import { tesoreriaService } from './tesoreria.service';
import { tipoCambioService } from './tipoCambio.service';
import { stockDisponibilidadService } from './stockDisponibilidad.service';
import { expectativaService } from './expectativa.service';

const COLLECTION_NAME = 'cotizaciones';
const VENTAS_COLLECTION = 'ventas';

export class CotizacionService {
  // ========== CRUD BÁSICO ==========

  /**
   * Obtener todas las cotizaciones
   */
  static async getAll(): Promise<Cotizacion[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('fechaCreacion', 'desc')
      );

      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Cotizacion));
    } catch (error: any) {
      console.error('Error al obtener cotizaciones:', error);
      throw new Error('Error al cargar cotizaciones');
    }
  }

  /**
   * Obtener cotización por ID
   */
  static async getById(id: string): Promise<Cotizacion | null> {
    try {
      const docSnap = await getDoc(doc(db, COLLECTION_NAME, id));

      if (!docSnap.exists()) {
        return null;
      }

      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Cotizacion;
    } catch (error: any) {
      console.error('Error al obtener cotización:', error);
      throw new Error('Error al cargar cotización');
    }
  }

  /**
   * Obtener cotizaciones por estado
   */
  static async getByEstado(estado: EstadoCotizacion | EstadoCotizacion[]): Promise<Cotizacion[]> {
    try {
      const estados = Array.isArray(estado) ? estado : [estado];
      const q = query(
        collection(db, COLLECTION_NAME),
        where('estado', 'in', estados),
        orderBy('fechaCreacion', 'desc')
      );

      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Cotizacion));
    } catch (error: any) {
      console.error('Error al obtener cotizaciones por estado:', error);
      throw new Error('Error al cargar cotizaciones');
    }
  }

  /**
   * Obtener cotizaciones con filtros
   */
  static async getWithFilters(filters: CotizacionFilters): Promise<Cotizacion[]> {
    try {
      let q = query(collection(db, COLLECTION_NAME), orderBy('fechaCreacion', 'desc'));

      // Firestore tiene limitaciones con múltiples where + orderBy
      // Por ahora filtramos en memoria para flexibilidad
      const snapshot = await getDocs(q);
      let cotizaciones = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Cotizacion));

      // Aplicar filtros en memoria
      if (filters.estado) {
        const estados = Array.isArray(filters.estado) ? filters.estado : [filters.estado];
        cotizaciones = cotizaciones.filter(c => estados.includes(c.estado));
      }

      if (filters.canal) {
        cotizaciones = cotizaciones.filter(c => c.canal === filters.canal);
      }

      if (filters.clienteId) {
        cotizaciones = cotizaciones.filter(c => c.clienteId === filters.clienteId);
      }

      if (filters.montoMinimo !== undefined) {
        cotizaciones = cotizaciones.filter(c => c.totalPEN >= filters.montoMinimo!);
      }

      if (filters.montoMaximo !== undefined) {
        cotizaciones = cotizaciones.filter(c => c.totalPEN <= filters.montoMaximo!);
      }

      if (filters.productoId) {
        cotizaciones = cotizaciones.filter(c =>
          c.productos.some(p => p.productoId === filters.productoId)
        );
      }

      return cotizaciones;
    } catch (error: any) {
      console.error('Error al filtrar cotizaciones:', error);
      throw new Error('Error al cargar cotizaciones');
    }
  }

  /**
   * Generar número de cotización (COT-YYYY-NNN)
   */
  private static async generateNumeroCotizacion(): Promise<string> {
    try {
      const year = new Date().getFullYear();
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));

      if (snapshot.empty) {
        return `COT-${year}-001`;
      }

      // Buscar el número máximo existente
      let maxNumber = 0;
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data() as Cotizacion;
        const numero = data.numeroCotizacion;

        // Extraer el número del formato COT-YYYY-NNN
        const match = numero?.match(/COT-\d{4}-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      });

      return `COT-${year}-${(maxNumber + 1).toString().padStart(3, '0')}`;
    } catch (error) {
      return `COT-${new Date().getFullYear()}-001`;
    }
  }

  /**
   * Crear nueva cotización
   * Ahora incluye consulta de disponibilidad multi-almacén (Perú + USA)
   */
  static async create(data: CotizacionFormData, userId: string): Promise<Cotizacion> {
    try {
      // Obtener información de productos y calcular totales
      const productosCotizacion: ProductoCotizacion[] = [];
      let subtotalPEN = 0;

      // Consultar disponibilidad multi-almacén para todos los productos
      const consultaDisponibilidad = await stockDisponibilidadService.consultarDisponibilidad({
        productos: data.productos.map(p => ({
          productoId: p.productoId,
          cantidadRequerida: p.cantidad
        })),
        incluirRecomendacion: true,
        priorizarPeru: true
      });

      // Crear mapa de disponibilidad por productoId
      const disponibilidadMap = new Map<string, DisponibilidadProducto>();
      consultaDisponibilidad.productos.forEach(d => disponibilidadMap.set(d.productoId, d));

      for (const prod of data.productos) {
        const producto = await ProductoService.getById(prod.productoId);
        if (!producto) {
          throw new Error(`Producto ${prod.productoId} no encontrado`);
        }

        // Obtener disponibilidad multi-almacén
        const disponibilidad = disponibilidadMap.get(prod.productoId);
        const disponiblesTotal = disponibilidad?.totalLibre || 0;
        const disponiblesPeru = disponibilidad?.disponiblePeru || 0;
        const disponiblesUSA = disponibilidad?.disponibleUSA || 0;

        const subtotal = prod.cantidad * prod.precioUnitario;
        subtotalPEN += subtotal;

        // Construir producto con información multi-almacén
        const productoCotizacion: ProductoCotizacion = {
          productoId: prod.productoId,
          sku: producto.sku,
          marca: producto.marca,
          nombreComercial: producto.nombreComercial,
          presentacion: producto.presentacion,
          contenido: producto.contenido,
          dosaje: producto.dosaje,
          cantidad: prod.cantidad,
          precioUnitario: prod.precioUnitario,
          subtotal,
          stockDisponible: disponiblesTotal, // Ahora incluye Perú + USA
          requiereStock: disponiblesTotal < prod.cantidad
        };

        // Agregar información de disponibilidad multi-almacén
        if (disponibilidad) {
          const recomendacion = disponibilidad.recomendacion;
          const cantidadFaltante = prod.cantidad - disponiblesTotal;

          // Construir objeto base sin campos undefined (Firestore no los acepta)
          const almacenesRecomendados = recomendacion?.almacenesRecomendados || [];

          const disponibilidadMultiAlmacen: Record<string, any> = {
            stockPeru: disponiblesPeru,
            stockUSA: disponiblesUSA,
            stockTotal: disponiblesTotal,
            fuenteRecomendada: recomendacion?.fuente || 'virtual',
            cantidadDesdePeru: almacenesRecomendados
              .filter(a => disponibilidad.almacenes.find(al => al.almacenId === a.almacenId)?.pais === 'Peru')
              .reduce((sum, a) => sum + a.cantidad, 0),
            cantidadDesdeUSA: almacenesRecomendados
              .filter(a => disponibilidad.almacenes.find(al => al.almacenId === a.almacenId)?.pais === 'USA')
              .reduce((sum, a) => sum + a.cantidad, 0),
            tiempoEstimadoLlegadaDias: almacenesRecomendados
              .reduce((max, a) => Math.max(max, a.tiempoEstimadoDias), 0)
          };

          // Solo agregar campos opcionales si tienen valor
          if (cantidadFaltante > 0) {
            disponibilidadMultiAlmacen.cantidadVirtual = cantidadFaltante;
          }

          const costoEstimado = almacenesRecomendados
            .reduce((sum, a) => sum + a.costoEstimadoUSD, 0);
          if (costoEstimado > 0) {
            disponibilidadMultiAlmacen.costoEstimadoUSD = costoEstimado;
          }

          const costoFlete = disponibilidad.almacenes
            .filter(a => a.pais === 'USA')
            .reduce((sum, a) => sum + (a.costoFleteEstimadoUSD || 0), 0);
          if (costoFlete > 0) {
            disponibilidadMultiAlmacen.costoFleteEstimadoUSD = costoFlete;
          }

          productoCotizacion.disponibilidadMultiAlmacen = disponibilidadMultiAlmacen as any;
        }

        productosCotizacion.push(productoCotizacion);
      }

      // Calcular total
      const descuento = data.descuento || 0;
      const costoEnvio = data.costoEnvio || 0;
      const incluyeEnvio = data.incluyeEnvio ?? true;
      const totalPEN = subtotalPEN - descuento + (incluyeEnvio ? 0 : costoEnvio);

      // Generar número de cotización
      const numeroCotizacion = await this.generateNumeroCotizacion();

      // Calcular fecha de vencimiento
      const diasVigencia = data.diasVigencia || 7; // Default: 7 días
      const fechaVencimiento = new Date();
      fechaVencimiento.setDate(fechaVencimiento.getDate() + diasVigencia);

      const nuevaCotizacion: any = {
        numeroCotizacion,
        nombreCliente: data.nombreCliente,
        canal: data.canal,
        productos: productosCotizacion,
        subtotalPEN,
        totalPEN,
        incluyeEnvio,
        estado: 'nueva' as EstadoCotizacion,
        diasVigencia, // 7 días por defecto, 90 si tiene adelanto pagado
        fechaCreacion: serverTimestamp(),
        fechaVencimiento: Timestamp.fromDate(fechaVencimiento),
        productosInteres: productosCotizacion.map(p => p.productoId),
        creadoPor: userId
      };

      // Agregar campos opcionales
      if (data.clienteId) nuevaCotizacion.clienteId = data.clienteId;
      if (descuento > 0) nuevaCotizacion.descuento = descuento;
      if (costoEnvio > 0) nuevaCotizacion.costoEnvio = costoEnvio;
      if (data.emailCliente) nuevaCotizacion.emailCliente = data.emailCliente;
      if (data.telefonoCliente) nuevaCotizacion.telefonoCliente = data.telefonoCliente;
      if (data.direccionEntrega) nuevaCotizacion.direccionEntrega = data.direccionEntrega;
      if (data.dniRuc) nuevaCotizacion.dniRuc = data.dniRuc;
      if (data.observaciones) nuevaCotizacion.observaciones = data.observaciones;

      const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevaCotizacion);

      return {
        id: docRef.id,
        ...nuevaCotizacion,
        fechaCreacion: Timestamp.now(),
        fechaVencimiento: Timestamp.fromDate(fechaVencimiento)
      } as Cotizacion;
    } catch (error: any) {
      console.error('Error al crear cotización:', error);
      throw new Error(error.message || 'Error al crear cotización');
    }
  }

  /**
   * Actualizar cotización
   * Permitido en estados: nueva, validada, pendiente_adelanto
   * NO permitido: adelanto_pagado (ya tiene stock reservado), confirmada, rechazada, vencida
   */
  static async update(id: string, data: Partial<CotizacionFormData>, userId: string): Promise<void> {
    try {
      const cotizacion = await this.getById(id);
      if (!cotizacion) {
        throw new Error('Cotización no encontrada');
      }

      const estadosEditables: EstadoCotizacion[] = ['nueva', 'validada', 'pendiente_adelanto'];
      if (!estadosEditables.includes(cotizacion.estado)) {
        throw new Error('Solo se pueden editar cotizaciones en estados: Nueva, Validada o Esperando Pago');
      }

      const updates: any = {
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      };

      // Actualizar campos básicos
      if (data.nombreCliente !== undefined) updates.nombreCliente = data.nombreCliente;
      if (data.emailCliente !== undefined) updates.emailCliente = data.emailCliente;
      if (data.telefonoCliente !== undefined) updates.telefonoCliente = data.telefonoCliente;
      if (data.direccionEntrega !== undefined) updates.direccionEntrega = data.direccionEntrega;
      if (data.dniRuc !== undefined) updates.dniRuc = data.dniRuc;
      if (data.canal !== undefined) updates.canal = data.canal;
      if (data.descuento !== undefined) updates.descuento = data.descuento;
      if (data.costoEnvio !== undefined) updates.costoEnvio = data.costoEnvio;
      if (data.incluyeEnvio !== undefined) updates.incluyeEnvio = data.incluyeEnvio;
      if (data.observaciones !== undefined) updates.observaciones = data.observaciones;

      // Si se actualizan productos, recalcular totales
      if (data.productos) {
        const productosCotizacion: ProductoCotizacion[] = [];
        let subtotalPEN = 0;

        for (const prod of data.productos) {
          const producto = await ProductoService.getById(prod.productoId);
          if (!producto) {
            throw new Error(`Producto ${prod.productoId} no encontrado`);
          }

          const inventarioProducto = await inventarioService.getInventarioProducto(prod.productoId);
          const disponiblesEnPeru = inventarioProducto
            .filter(inv => inv.pais === 'Peru')
            .reduce((sum, inv) => sum + inv.disponibles, 0);

          const subtotal = prod.cantidad * prod.precioUnitario;
          subtotalPEN += subtotal;

          productosCotizacion.push({
            productoId: prod.productoId,
            sku: producto.sku,
            marca: producto.marca,
            nombreComercial: producto.nombreComercial,
            presentacion: producto.presentacion,
            cantidad: prod.cantidad,
            precioUnitario: prod.precioUnitario,
            subtotal,
            stockDisponible: disponiblesEnPeru,
            requiereStock: disponiblesEnPeru < prod.cantidad
          });
        }

        updates.productos = productosCotizacion;
        updates.subtotalPEN = subtotalPEN;
        updates.productosInteres = productosCotizacion.map(p => p.productoId);

        // Recalcular total
        const descuento = data.descuento ?? cotizacion.descuento ?? 0;
        const costoEnvio = data.costoEnvio ?? cotizacion.costoEnvio ?? 0;
        const incluyeEnvio = data.incluyeEnvio ?? cotizacion.incluyeEnvio;
        updates.totalPEN = subtotalPEN - descuento + (incluyeEnvio ? 0 : costoEnvio);
      }

      await updateDoc(doc(db, COLLECTION_NAME, id), updates);
    } catch (error: any) {
      console.error('Error al actualizar cotización:', error);
      throw new Error(error.message || 'Error al actualizar cotización');
    }
  }

  /**
   * Eliminar cotización (solo si está en estado 'nueva')
   */
  static async delete(id: string): Promise<void> {
    try {
      const cotizacion = await this.getById(id);
      if (!cotizacion) {
        throw new Error('Cotización no encontrada');
      }

      if (cotizacion.estado !== 'nueva' && cotizacion.estado !== 'rechazada') {
        throw new Error('Solo se pueden eliminar cotizaciones nuevas o rechazadas');
      }

      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error: any) {
      console.error('Error al eliminar cotización:', error);
      throw new Error(error.message || 'Error al eliminar cotización');
    }
  }

  // ========== FLUJO DE COTIZACIÓN ==========

  /**
   * Validar cotización - El cliente confirmó interés
   * Flujo: nueva → validada
   */
  static async validar(id: string, userId: string): Promise<void> {
    try {
      const cotizacion = await this.getById(id);
      if (!cotizacion) {
        throw new Error('Cotización no encontrada');
      }

      if (cotizacion.estado !== 'nueva') {
        throw new Error('Solo se pueden validar cotizaciones nuevas');
      }

      await updateDoc(doc(db, COLLECTION_NAME, id), {
        estado: 'validada' as EstadoCotizacion,
        fechaValidacion: serverTimestamp(),
        validadoPor: userId,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });
    } catch (error: any) {
      console.error('Error al validar cotización:', error);
      throw new Error(error.message || 'Error al validar cotización');
    }
  }

  /**
   * Revertir validación
   * Flujo: validada → nueva
   */
  static async revertirValidacion(id: string, userId: string): Promise<void> {
    try {
      const cotizacion = await this.getById(id);
      if (!cotizacion) {
        throw new Error('Cotización no encontrada');
      }

      if (cotizacion.estado !== 'validada') {
        throw new Error('Solo se pueden revertir cotizaciones validadas');
      }

      await updateDoc(doc(db, COLLECTION_NAME, id), {
        estado: 'nueva' as EstadoCotizacion,
        fechaValidacion: null,
        validadoPor: null,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });
    } catch (error: any) {
      console.error('Error al revertir validación:', error);
      throw new Error(error.message || 'Error al revertir validación');
    }
  }

  /**
   * PASO 1: Comprometer adelanto (cliente acepta CON adelanto)
   * Flujo: nueva|validada → pendiente_adelanto
   * NO reserva stock aún - solo registra el compromiso para el PDF
   */
  static async comprometerAdelanto(
    id: string,
    data: ComprometerAdelantoData,
    userId: string
  ): Promise<void> {
    try {
      const cotizacion = await this.getById(id);
      if (!cotizacion) {
        throw new Error('Cotización no encontrada');
      }

      // Permitir comprometer adelanto desde 'nueva' o 'validada'
      const estadosPermitidos: EstadoCotizacion[] = ['nueva', 'validada'];
      if (!estadosPermitidos.includes(cotizacion.estado)) {
        throw new Error('Solo se puede comprometer adelanto en cotizaciones nuevas o validadas');
      }

      if (data.monto <= 0) {
        throw new Error('El monto del adelanto debe ser mayor a 0');
      }

      if (data.monto > cotizacion.totalPEN) {
        throw new Error('El adelanto no puede ser mayor al total');
      }

      // Calcular fecha límite para pagar (default: 3 días)
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
        // Establecer días de compromiso de entrega por defecto (15 días hábiles)
        // El usuario puede editarlo desde el UI antes de descargar el PDF
        diasCompromisoEntrega: cotizacion.diasCompromisoEntrega || 15,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });
    } catch (error: any) {
      console.error('Error al comprometer adelanto:', error);
      throw new Error(error.message || 'Error al comprometer adelanto');
    }
  }

  /**
   * Actualizar días de validez de la cotización
   * Permite ajustar la vigencia de la cotización según acuerdo con el cliente
   */
  static async actualizarDiasValidez(
    id: string,
    diasValidez: number,
    userId: string
  ): Promise<void> {
    try {
      const cotizacion = await this.getById(id);
      if (!cotizacion) {
        throw new Error('Cotización no encontrada');
      }

      // Permitir actualizar en estados antes de confirmación/rechazo
      const estadosPermitidos: EstadoCotizacion[] = ['nueva', 'validada', 'pendiente_adelanto'];
      if (!estadosPermitidos.includes(cotizacion.estado)) {
        throw new Error('No se puede modificar la validez en este estado');
      }

      if (diasValidez < 1 || diasValidez > 90) {
        throw new Error('Los días de validez deben ser entre 1 y 90');
      }

      // Calcular nueva fecha de vencimiento desde la fecha de creación
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
      console.error('Error al actualizar días de validez:', error);
      throw new Error(error.message || 'Error al actualizar días de validez');
    }
  }

  /**
   * Actualizar días de compromiso de entrega
   * Permite definir en cuántos días hábiles se entregará después del pago del adelanto
   */
  static async actualizarDiasCompromisoEntrega(
    id: string,
    diasCompromisoEntrega: number,
    userId: string
  ): Promise<void> {
    try {
      const cotizacion = await this.getById(id);
      if (!cotizacion) {
        throw new Error('Cotización no encontrada');
      }

      // Permitir actualizar en cualquier estado antes de confirmación
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
      console.error('Error al actualizar días de compromiso:', error);
      throw new Error(error.message || 'Error al actualizar días de compromiso');
    }
  }

  /**
   * Actualizar tiempo estimado de importación
   * Para cotizaciones con productos sin stock, define el tiempo estimado de llegada
   */
  static async actualizarTiempoEstimadoImportacion(
    id: string,
    tiempoEstimadoImportacion: number,
    userId: string
  ): Promise<void> {
    try {
      const cotizacion = await this.getById(id);
      if (!cotizacion) {
        throw new Error('Cotización no encontrada');
      }

      // Permitir actualizar en cualquier estado antes de confirmación
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
      console.error('Error al actualizar tiempo estimado:', error);
      throw new Error(error.message || 'Error al actualizar tiempo estimado');
    }
  }

  /**
   * PASO 2: Registrar PAGO de adelanto y reservar stock
   * Flujo: pendiente_adelanto → adelanto_pagado
   * AQUÍ sí se reserva el stock y se extiende vigencia a 90 días
   *
   * NUEVO: Soporta reserva multi-almacén (Perú + USA)
   * - Prioriza stock de Perú (disponibilidad inmediata)
   * - Si no hay suficiente en Perú, busca en almacenes USA
   * - Si no hay stock en ningún lado, genera Requerimiento de compra
   */
  static async registrarPagoAdelanto(
    id: string,
    data: RegistrarAdelantoData,
    userId: string
  ): Promise<{
    tipoReserva: TipoReserva;
    productosReservados: ProductoReservado[];
    productosVirtuales?: ProductoStockVirtual[];
    requerimientosGenerados?: Array<{ id: string; numero: string }>;
  }> {
    try {
      const cotizacion = await this.getById(id);
      if (!cotizacion) {
        throw new Error('Cotización no encontrada');
      }

      if (cotizacion.estado !== 'pendiente_adelanto') {
        throw new Error('Solo se puede registrar pago en cotizaciones con adelanto pendiente');
      }

      if (data.monto <= 0) {
        throw new Error('El monto del pago debe ser mayor a 0');
      }

      // ============================================================
      // NUEVO: Consultar disponibilidad multi-almacén
      // ============================================================
      const consultaDisponibilidad = await stockDisponibilidadService.consultarDisponibilidad({
        productos: cotizacion.productos.map(p => ({
          productoId: p.productoId,
          cantidadRequerida: p.cantidad
        })),
        incluirRecomendacion: true,
        priorizarPeru: true
      });

      const batch = writeBatch(db);
      const productosReservados: ProductoReservado[] = [];
      const productosVirtuales: ProductoStockVirtual[] = [];
      const productosParaRequerimiento: Array<{
        productoId: string;
        sku: string;
        marca: string;
        nombreComercial: string;
        cantidadFaltante: number;
        precioEstimadoUSD?: number;
        impuestoPorcentaje?: number;
        logisticaEstimadaUSD?: number;
        ctruEstimado?: number;
      }> = [];

      let tieneStockFisico = false;
      let tieneFaltantes = false;

      // Obtener datos de investigación de mercado para calcular precios estimados
      const productosInfo = await Promise.all(
        cotizacion.productos.map(p => ProductoService.getById(p.productoId))
      );
      const productosInfoMap = new Map(
        productosInfo.filter(p => p !== null).map(p => [p!.id, p!])
      );

      // Procesar cada producto usando la disponibilidad multi-almacén
      for (const producto of cotizacion.productos) {
        const nombreProducto = `${producto.marca} ${producto.nombreComercial}`;
        const disponibilidad = consultaDisponibilidad.productos.find(
          d => d.productoId === producto.productoId
        );

        // Obtener datos de investigación de mercado para expectativa financiera
        const productoInfo = productosInfoMap.get(producto.productoId);
        const investigacion = productoInfo?.investigacion;
        const precioEstimadoUSD = investigacion?.precioUSAPromedio ||
                                   investigacion?.precioUSAMin ||
                                   undefined;
        const logisticaEstimadaUSD = investigacion?.logisticaEstimada || undefined;
        const ctruEstimado = investigacion?.ctruEstimado || undefined;

        // Calcular impuesto promedio desde proveedores USA
        let impuestoPorcentaje: number | undefined = undefined;
        if (investigacion?.proveedoresUSA && investigacion.proveedoresUSA.length > 0) {
          const proveedoresConImpuesto = investigacion.proveedoresUSA.filter(p => p.impuesto !== undefined && p.impuesto > 0);
          if (proveedoresConImpuesto.length > 0) {
            impuestoPorcentaje = proveedoresConImpuesto.reduce((sum, p) => sum + (p.impuesto || 0), 0) / proveedoresConImpuesto.length;
          }
        }

        if (!disponibilidad) {
          // Si no hay información de disponibilidad, tratar como faltante
          tieneFaltantes = true;
          productosVirtuales.push({
            productoId: producto.productoId,
            sku: producto.sku,
            nombreProducto,
            cantidadRequerida: producto.cantidad,
            cantidadDisponible: 0,
            cantidadFaltante: producto.cantidad
          });
          productosParaRequerimiento.push({
            productoId: producto.productoId,
            sku: producto.sku,
            marca: producto.marca,
            nombreComercial: producto.nombreComercial,
            cantidadFaltante: producto.cantidad,
            precioEstimadoUSD,
            impuestoPorcentaje,
            logisticaEstimadaUSD,
            ctruEstimado
          });
          continue;
        }

        const cantidadRequerida = producto.cantidad;
        const cantidadDisponible = disponibilidad.totalLibre;
        const cantidadFaltante = Math.max(0, cantidadRequerida - cantidadDisponible);

        // Reservar stock disponible usando recomendación multi-almacén
        if (disponibilidad.recomendacion && disponibilidad.recomendacion.almacenesRecomendados.length > 0) {
          tieneStockFisico = true;
          const unidadesIds: string[] = [];

          for (const almacenRec of disponibilidad.recomendacion.almacenesRecomendados) {
            const almacenInfo = disponibilidad.almacenes.find(a => a.almacenId === almacenRec.almacenId);
            if (!almacenInfo) continue;

            // Obtener IDs de unidades a reservar
            const unidadesDeEsteAlmacen = almacenInfo.unidadesIds.slice(0, almacenRec.cantidad);

            for (const unidadId of unidadesDeEsteAlmacen) {
              const unidadRef = doc(db, 'unidades', unidadId);
              batch.update(unidadRef, {
                estado: 'reservada',
                reservadoPara: id,
                fechaReserva: serverTimestamp()
              });
              unidadesIds.push(unidadId);
            }
          }

          if (unidadesIds.length > 0) {
            productosReservados.push({
              productoId: producto.productoId,
              sku: producto.sku,
              cantidad: unidadesIds.length,
              unidadesReservadas: unidadesIds
            });
          }
        }

        // Manejar faltantes
        if (cantidadFaltante > 0) {
          tieneFaltantes = true;

          productosVirtuales.push({
            productoId: producto.productoId,
            sku: producto.sku,
            nombreProducto,
            cantidadRequerida,
            cantidadDisponible,
            cantidadFaltante
          });

          productosParaRequerimiento.push({
            productoId: producto.productoId,
            sku: producto.sku,
            marca: producto.marca,
            nombreComercial: producto.nombreComercial,
            cantidadFaltante,
            precioEstimadoUSD,
            impuestoPorcentaje,
            logisticaEstimadaUSD,
            ctruEstimado
          });

          // Si no hay ninguna unidad disponible, agregar entrada vacía
          if (cantidadDisponible === 0) {
            productosReservados.push({
              productoId: producto.productoId,
              sku: producto.sku,
              cantidad: cantidadRequerida,
              unidadesReservadas: []
            });
          }
        }
      }

      // ============================================================
      // NUEVO: Generar requerimiento automático si hay faltantes
      // ============================================================
      const requerimientosGenerados: Array<{ id: string; numero: string }> = [];

      if (productosParaRequerimiento.length > 0) {
        try {
          const requerimiento = await expectativaService.crearRequerimientoDesdeCotizacion(
            id,
            cotizacion.numeroCotizacion,
            cotizacion.nombreCliente,
            productosParaRequerimiento,
            userId
          );
          requerimientosGenerados.push(requerimiento);
        } catch (reqError) {
          console.warn('No se pudo crear requerimiento automático:', reqError);
          // No lanzamos error para no interrumpir el flujo principal
        }
      }

      // Determinar tipo de reserva
      const tipoReserva: TipoReserva = (tieneStockFisico && !tieneFaltantes) ? 'fisica' : 'virtual';

      // Crear registro del pago
      const monedaPago = data.moneda || 'PEN';
      const adelantoPagado: AdelantoPagado = {
        id: `ADL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        monto: data.monto,
        moneda: monedaPago,
        metodoPago: data.metodoPago,
        fecha: Timestamp.now(),
        registradoPor: userId
      };
      if (monedaPago === 'USD' && data.tipoCambio) {
        adelantoPagado.tipoCambio = data.tipoCambio;
        adelantoPagado.montoEquivalentePEN = data.montoEquivalentePEN;
      }
      if (data.referencia) adelantoPagado.referencia = data.referencia;
      if (data.cuentaDestinoId) adelantoPagado.cuentaDestinoId = data.cuentaDestinoId;

      // Nueva vigencia: 90 días desde el pago
      const nuevaVigencia = new Date();
      nuevaVigencia.setDate(nuevaVigencia.getDate() + 90);

      // Crear reserva de stock
      const reservaStock: ReservaStockCotizacion = {
        activo: true,
        tipoReserva,
        fechaReserva: Timestamp.now(),
        vigenciaHasta: Timestamp.fromDate(nuevaVigencia),
        horasVigencia: 90 * 24,
        productosReservados
      };

      if (productosVirtuales.length > 0) {
        reservaStock.stockVirtual = {
          productosVirtuales,
          requerimientoId: requerimientosGenerados[0]?.id,
          fechaEstimadaStock: requerimientosGenerados.length > 0
            ? Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) // Estimado: 30 días
            : undefined
        };
      }

      // Actualizar cotización
      const cotizacionRef = doc(db, COLLECTION_NAME, id);
      const updateData: Record<string, any> = {
        estado: 'adelanto_pagado' as EstadoCotizacion,
        fechaAdelanto: serverTimestamp(),
        adelanto: adelantoPagado,
        reservaStock,
        diasVigencia: 90,
        fechaVencimiento: Timestamp.fromDate(nuevaVigencia),
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      };

      // Agregar requerimientos si se generaron
      if (requerimientosGenerados.length > 0) {
        updateData.requerimientosIds = requerimientosGenerados.map(r => r.id);
        updateData.requerimientosNumeros = requerimientosGenerados.map(r => r.numero);
      }

      batch.update(cotizacionRef, updateData);
      await batch.commit();

      // Registrar movimiento en Tesorería (si hay cuenta destino)
      if (data.cuentaDestinoId) {
        try {
          // Mapear método de pago de venta a método de tesorería
          const metodoTesoreriaMap: Record<MetodoPago, MetodoTesoreria> = {
            'yape': 'yape',
            'plin': 'plin',
            'transferencia': 'transferencia_bancaria',
            'efectivo': 'efectivo',
            'tarjeta': 'tarjeta',
            'mercado_pago': 'mercado_pago',
            'paypal': 'paypal',
            'zelle': 'zelle',
            'otro': 'otro'
          };

          // Obtener TC del día si no viene en los datos
          let tcParaMovimiento = data.tipoCambio || 1;
          if (!data.tipoCambio) {
            const tcDelDia = await tipoCambioService.getTCDelDia();
            tcParaMovimiento = tcDelDia?.venta || 3.7;
          }

          // El monto para tesorería
          // Si es USD: monto está en USD
          // Si es PEN: monto está en PEN
          const montoMovimiento = data.monto;
          const monedaMovimiento = monedaPago;

          // Crear concepto descriptivo
          const conceptoMovimiento = `Adelanto cotización ${cotizacion.numeroCotizacion} - ${cotizacion.nombreCliente}`;

          await tesoreriaService.registrarMovimiento({
            tipo: 'ingreso_venta',
            moneda: monedaMovimiento,
            monto: montoMovimiento,
            tipoCambio: tcParaMovimiento,
            metodo: metodoTesoreriaMap[data.metodoPago] || 'otro',
            referencia: data.referencia,
            concepto: conceptoMovimiento,
            fecha: new Date(),
            cuentaDestino: data.cuentaDestinoId,
            cotizacionId: id,
            cotizacionNumero: cotizacion.numeroCotizacion,
            notas: monedaPago === 'USD'
              ? `Pago en USD. Equivalente PEN: S/ ${data.montoEquivalentePEN?.toFixed(2) || 'N/A'}`
              : undefined
          }, userId);

          // Actualizar el adelanto con el ID del movimiento
          // (Opcional: podríamos guardar el ID del movimiento en la cotización)
        } catch (tesoreriaError) {
          console.warn('No se pudo registrar en tesorería:', tesoreriaError);
          // No lanzamos error para no interrumpir el flujo principal
        }
      }

      return {
        tipoReserva,
        productosReservados,
        productosVirtuales: productosVirtuales.length > 0 ? productosVirtuales : undefined,
        requerimientosGenerados: requerimientosGenerados.length > 0 ? requerimientosGenerados : undefined
      };
    } catch (error: any) {
      console.error('Error al registrar pago de adelanto:', error);
      throw new Error(error.message || 'Error al registrar pago de adelanto');
    }
  }

  /**
   * @deprecated Usar comprometerAdelanto + registrarPagoAdelanto
   * Mantener para compatibilidad temporal
   */
  static async registrarAdelanto(
    id: string,
    data: RegistrarAdelantoData & { horasVigencia?: number },
    userId: string
  ): Promise<{
    tipoReserva: TipoReserva;
    productosReservados: ProductoReservado[];
    productosVirtuales?: ProductoStockVirtual[];
    requerimientosGenerados?: Array<{ id: string; numero: string }>;
  }> {
    // Redirigir al nuevo flujo
    return this.registrarPagoAdelanto(id, data, userId);
  }

  /**
   * Confirmar cotización y crear venta
   * Flujo: validada|adelanto_pagado → confirmada (crea venta en colección ventas)
   *
   * Estados válidos para confirmar:
   * - validada: Cliente aceptó sin adelanto (7 días vigencia)
   * - adelanto_pagado: Cliente pagó adelanto (90 días vigencia, stock reservado)
   * - con_abono: Legacy, equivalente a adelanto_pagado
   */
  static async confirmar(id: string, userId: string): Promise<{ ventaId: string; numeroVenta: string }> {
    try {
      const cotizacion = await this.getById(id);
      if (!cotizacion) {
        throw new Error('Cotización no encontrada');
      }

      // Estados válidos para confirmar
      const estadosValidos: EstadoCotizacion[] = ['validada', 'adelanto_pagado', 'con_abono' as EstadoCotizacion];
      if (!estadosValidos.includes(cotizacion.estado)) {
        throw new Error('Solo se pueden confirmar cotizaciones validadas o con adelanto pagado');
      }

      // Crear venta en colección ventas
      const ventaData: VentaFormData = {
        clienteId: cotizacion.clienteId,
        nombreCliente: cotizacion.nombreCliente,
        emailCliente: cotizacion.emailCliente,
        telefonoCliente: cotizacion.telefonoCliente,
        direccionEntrega: cotizacion.direccionEntrega,
        dniRuc: cotizacion.dniRuc,
        canal: cotizacion.canal,
        productos: cotizacion.productos.map(p => ({
          productoId: p.productoId,
          cantidad: p.cantidad,
          precioUnitario: p.precioUnitario
        })),
        descuento: cotizacion.descuento,
        costoEnvio: cotizacion.costoEnvio,
        incluyeEnvio: cotizacion.incluyeEnvio,
        observaciones: `Creada desde cotización ${cotizacion.numeroCotizacion}. ${cotizacion.observaciones || ''}`
      };

      // Determinar si ya tiene stock reservado (físico o virtual)
      // Si tiene reserva, NO validamos stock al crear venta (ya está comprometido)
      const tieneReservaStock = cotizacion.reservaStock?.activo === true;

      // Si viene de adelanto_pagado con reserva, no validar stock (ya lo reservamos)
      // Si es validada sin adelanto, sí validar stock
      const esVentaDirectaSinReserva = cotizacion.estado === 'validada' && !tieneReservaStock;

      // Crear la venta (solo valida stock si NO tiene reserva previa)
      const venta = await VentaService.create(ventaData, userId, esVentaDirectaSinReserva);

      // Guardar referencia a la cotización de origen en la venta
      await updateDoc(doc(db, 'ventas', venta.id), {
        cotizacionOrigenId: id,
        numeroCotizacionOrigen: cotizacion.numeroCotizacion
      });

      // Si hay adelanto, registrarlo como pago en la venta
      // El adelanto ya fue pagado en la cotización, debe reflejarse en la venta
      if (cotizacion.adelanto && cotizacion.adelanto.monto > 0) {
        // Determinar el monto en PEN del adelanto
        const montoAdelantoPEN = cotizacion.adelanto.montoEquivalentePEN ||
          cotizacion.adelanto.monto * (cotizacion.adelanto.tipoCambio || 1);

        // Crear el pago desde el adelanto de la cotización
        const pagoAdelanto: any = {
          id: `ADL-COT-${Date.now()}`,
          monto: montoAdelantoPEN,
          metodoPago: cotizacion.adelanto.metodoPago,
          fecha: cotizacion.adelanto.fecha || Timestamp.now(),
          registradoPor: userId,
          notas: `Adelanto transferido desde cotización ${cotizacion.numeroCotizacion}`
        };

        // Agregar referencia solo si existe
        if (cotizacion.adelanto.referencia) {
          pagoAdelanto.referencia = cotizacion.adelanto.referencia;
        }

        // Calcular nuevos totales de pago
        const nuevoMontoPagado = montoAdelantoPEN;
        const nuevoMontoPendiente = venta.totalPEN - nuevoMontoPagado;
        const nuevoEstadoPago = nuevoMontoPendiente <= 0 ? 'pagado' :
          nuevoMontoPagado > 0 ? 'parcial' : 'pendiente';

        // Actualizar venta con el pago y referencia al adelanto
        // Construir objeto adelantoComprometido evitando valores undefined
        const adelantoComprometidoData: Record<string, any> = {
          monto: cotizacion.adelanto.monto,
          metodoPago: cotizacion.adelanto.metodoPago,
          fechaCompromiso: cotizacion.adelanto.fecha || Timestamp.now(),
          desdeCotizacion: cotizacion.numeroCotizacion,
          montoEquivalentePEN: montoAdelantoPEN,
          transferidoComoPago: true
        };

        // Solo agregar campos opcionales si tienen valor
        if (cotizacion.adelanto.moneda) {
          adelantoComprometidoData.moneda = cotizacion.adelanto.moneda;
        }
        if (cotizacion.adelanto.tipoCambio) {
          adelantoComprometidoData.tipoCambio = cotizacion.adelanto.tipoCambio;
        }

        await updateDoc(doc(db, 'ventas', venta.id), {
          pagos: [pagoAdelanto],
          montoPagado: nuevoMontoPagado,
          montoPendiente: Math.max(0, nuevoMontoPendiente),
          estadoPago: nuevoEstadoPago,
          adelantoComprometido: adelantoComprometidoData
        });

        console.log(`[Cotización→Venta] Adelanto de S/${montoAdelantoPEN.toFixed(2)} transferido a venta ${venta.numeroVenta}`);
      }

      // Si hay stock reservado físicamente, transferir a la venta
      if (cotizacion.reservaStock?.productosReservados) {
        const batch = writeBatch(db);

        for (const prod of cotizacion.reservaStock.productosReservados) {
          for (const unidadId of prod.unidadesReservadas) {
            const unidadRef = doc(db, 'unidades', unidadId);
            batch.update(unidadRef, {
              reservadoPara: venta.id, // Transferir reserva a la venta
              ventaId: venta.id
            });
          }
        }

        await batch.commit();
      }

      // Actualizar cotización como confirmada
      await updateDoc(doc(db, COLLECTION_NAME, id), {
        estado: 'confirmada' as EstadoCotizacion,
        fechaConfirmacion: serverTimestamp(),
        ventaId: venta.id,
        numeroVenta: venta.numeroVenta,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });

      return {
        ventaId: venta.id,
        numeroVenta: venta.numeroVenta
      };
    } catch (error: any) {
      console.error('Error al confirmar cotización:', error);
      throw new Error(error.message || 'Error al confirmar cotización');
    }
  }

  /**
   * Rechazar cotización (para análisis de demanda)
   */
  static async rechazar(id: string, data: RechazarCotizacionData, userId: string): Promise<void> {
    try {
      const cotizacion = await this.getById(id);
      if (!cotizacion) {
        throw new Error('Cotización no encontrada');
      }

      if (cotizacion.estado === 'confirmada') {
        throw new Error('No se puede rechazar una cotización confirmada');
      }

      const batch = writeBatch(db);

      // Liberar stock reservado si existe
      if (cotizacion.reservaStock?.productosReservados) {
        for (const prod of cotizacion.reservaStock.productosReservados) {
          for (const unidadId of prod.unidadesReservadas) {
            const unidadRef = doc(db, 'unidades', unidadId);
            batch.update(unidadRef, {
              estado: 'disponible_peru',
              reservadoPara: null,
              fechaReserva: null
            });
          }
        }
      }

      // Actualizar cotización
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
        reservaStock: null, // Limpiar reserva
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });

      await batch.commit();
    } catch (error: any) {
      console.error('Error al rechazar cotización:', error);
      throw new Error(error.message || 'Error al rechazar cotización');
    }
  }

  /**
   * Marcar como vencida (se llama automáticamente o manualmente)
   * Puede vencer: nueva, validada, pendiente_adelanto
   */
  static async marcarVencida(id: string, userId: string): Promise<void> {
    try {
      const cotizacion = await this.getById(id);
      if (!cotizacion) {
        throw new Error('Cotización no encontrada');
      }

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
      console.error('Error al marcar como vencida:', error);
      throw new Error(error.message || 'Error al marcar como vencida');
    }
  }

  // ========== ESTADÍSTICAS Y ANÁLISIS ==========

  /**
   * Obtener estadísticas de cotizaciones
   */
  static async getStats(): Promise<CotizacionStats> {
    try {
      const cotizaciones = await this.getAll();

      const stats: CotizacionStats = {
        total: cotizaciones.length,
        nuevas: 0,
        validadas: 0,
        pendienteAdelanto: 0,
        adelantoPagado: 0,
        conAbono: 0, // Legacy alias
        confirmadas: 0,
        rechazadas: 0,
        vencidas: 0,
        tasaValidacion: 0,
        tasaConversion: 0,
        tasaRechazo: 0,
        tasaPagoAdelanto: 0,
        montoTotalCotizado: 0,
        montoConfirmado: 0,
        montoPerdido: 0,
        montoEsperandoPago: 0,
        rechazosPorMotivo: {
          precio_alto: 0,
          encontro_mejor_opcion: 0,
          sin_presupuesto: 0,
          producto_diferente: 0,
          demora_entrega: 0,
          cambio_necesidad: 0,
          sin_respuesta: 0,
          otro: 0
        },
        productosRechazados: []
      };

      const productosRechazadosMap: Record<string, {
        productoId: string;
        nombreProducto: string;
        vezesRechazado: number;
        motivos: Record<MotivoRechazo, number>;
      }> = {};

      cotizaciones.forEach(cot => {
        stats.montoTotalCotizado += cot.totalPEN;

        switch (cot.estado) {
          case 'nueva':
            stats.nuevas++;
            break;
          case 'validada':
            stats.validadas++;
            break;
          case 'pendiente_adelanto':
            stats.pendienteAdelanto++;
            stats.montoEsperandoPago += cot.totalPEN;
            break;
          case 'adelanto_pagado':
            stats.adelantoPagado++;
            stats.conAbono++; // Legacy alias
            break;
          case 'con_abono': // Legacy state
            stats.adelantoPagado++;
            stats.conAbono++;
            break;
          case 'confirmada':
            stats.confirmadas++;
            stats.montoConfirmado += cot.totalPEN;
            break;
          case 'rechazada':
            stats.rechazadas++;
            stats.montoPerdido += cot.totalPEN;

            // Contar motivos de rechazo
            if (cot.rechazo?.motivo) {
              stats.rechazosPorMotivo[cot.rechazo.motivo]++;
            }

            // Registrar productos rechazados
            cot.productos.forEach(prod => {
              const key = prod.productoId;
              if (!productosRechazadosMap[key]) {
                productosRechazadosMap[key] = {
                  productoId: prod.productoId,
                  nombreProducto: `${prod.marca} ${prod.nombreComercial}`,
                  vezesRechazado: 0,
                  motivos: {
                    precio_alto: 0,
                    encontro_mejor_opcion: 0,
                    sin_presupuesto: 0,
                    producto_diferente: 0,
                    demora_entrega: 0,
                    cambio_necesidad: 0,
                    sin_respuesta: 0,
                    otro: 0
                  }
                };
              }
              productosRechazadosMap[key].vezesRechazado++;
              if (cot.rechazo?.motivo) {
                productosRechazadosMap[key].motivos[cot.rechazo.motivo]++;
              }
            });
            break;
          case 'vencida':
            stats.vencidas++;
            stats.montoPerdido += cot.totalPEN;
            break;
        }
      });

      // Calcular tasas
      const cotizacionesAceptadas = stats.validadas + stats.pendienteAdelanto + stats.adelantoPagado + stats.confirmadas;
      if (stats.total > 0) {
        stats.tasaValidacion = (cotizacionesAceptadas / stats.total) * 100;
        stats.tasaConversion = (stats.confirmadas / stats.total) * 100;
        stats.tasaRechazo = ((stats.rechazadas + stats.vencidas) / stats.total) * 100;
      }
      // Tasa de pago de adelanto (cuántos que prometieron, pagaron)
      const prometieronAdelanto = stats.pendienteAdelanto + stats.adelantoPagado;
      if (prometieronAdelanto > 0) {
        stats.tasaPagoAdelanto = (stats.adelantoPagado / prometieronAdelanto) * 100;
      }

      // Convertir map de productos rechazados a array
      stats.productosRechazados = Object.values(productosRechazadosMap)
        .map(p => {
          // Encontrar el motivo principal
          let motivoPrincipal: MotivoRechazo = 'otro';
          let maxCount = 0;
          Object.entries(p.motivos).forEach(([motivo, count]) => {
            if (count > maxCount) {
              maxCount = count;
              motivoPrincipal = motivo as MotivoRechazo;
            }
          });

          return {
            productoId: p.productoId,
            nombreProducto: p.nombreProducto,
            vezesRechazado: p.vezesRechazado,
            motivoPrincipal
          };
        })
        .sort((a, b) => b.vezesRechazado - a.vezesRechazado);

      return stats;
    } catch (error: any) {
      console.error('Error al obtener estadísticas:', error);
      throw new Error('Error al generar estadísticas');
    }
  }

  /**
   * Obtener análisis de demanda basado en cotizaciones
   */
  static async getAnalisisDemanda(): Promise<{
    productosMasCotizados: Array<{
      productoId: string;
      nombreProducto: string;
      vecesCotizado: number;
      vecesConfirmado: number;
      tasaConversion: number;
      montoTotalCotizado: number;
    }>;
    tendenciaMensual: Array<{
      mes: string;
      cotizaciones: number;
      confirmadas: number;
      rechazadas: number;
      montoTotal: number;
    }>;
  }> {
    try {
      const cotizaciones = await this.getAll();

      // Análisis por producto
      const productosMap: Record<string, {
        productoId: string;
        nombreProducto: string;
        vecesCotizado: number;
        vecesConfirmado: number;
        montoTotalCotizado: number;
      }> = {};

      // Análisis mensual
      const mensualMap: Record<string, {
        mes: string;
        cotizaciones: number;
        confirmadas: number;
        rechazadas: number;
        montoTotal: number;
      }> = {};

      cotizaciones.forEach(cot => {
        // Por producto
        cot.productos.forEach(prod => {
          const key = prod.productoId;
          if (!productosMap[key]) {
            productosMap[key] = {
              productoId: prod.productoId,
              nombreProducto: `${prod.marca} ${prod.nombreComercial}`,
              vecesCotizado: 0,
              vecesConfirmado: 0,
              montoTotalCotizado: 0
            };
          }
          productosMap[key].vecesCotizado++;
          productosMap[key].montoTotalCotizado += prod.subtotal;
          if (cot.estado === 'confirmada') {
            productosMap[key].vecesConfirmado++;
          }
        });

        // Por mes
        const fecha = cot.fechaCreacion.toDate();
        const mesKey = `${fecha.getFullYear()}-${(fecha.getMonth() + 1).toString().padStart(2, '0')}`;
        if (!mensualMap[mesKey]) {
          mensualMap[mesKey] = {
            mes: mesKey,
            cotizaciones: 0,
            confirmadas: 0,
            rechazadas: 0,
            montoTotal: 0
          };
        }
        mensualMap[mesKey].cotizaciones++;
        mensualMap[mesKey].montoTotal += cot.totalPEN;
        if (cot.estado === 'confirmada') mensualMap[mesKey].confirmadas++;
        if (cot.estado === 'rechazada' || cot.estado === 'vencida') mensualMap[mesKey].rechazadas++;
      });

      return {
        productosMasCotizados: Object.values(productosMap)
          .map(p => ({
            ...p,
            tasaConversion: p.vecesCotizado > 0 ? (p.vecesConfirmado / p.vecesCotizado) * 100 : 0
          }))
          .sort((a, b) => b.vecesCotizado - a.vecesCotizado),
        tendenciaMensual: Object.values(mensualMap).sort((a, b) => a.mes.localeCompare(b.mes))
      };
    } catch (error: any) {
      console.error('Error al obtener análisis de demanda:', error);
      throw new Error('Error al generar análisis');
    }
  }
}

export const cotizacionService = new CotizacionService();
