/**
 * venta.service.ts
 *
 * Punto de entrada público del módulo de ventas.
 * Mantiene la misma clase VentaService con todos sus métodos estáticos
 * para no romper ninguna importación existente.
 *
 * La lógica ha sido extraída a módulos especializados:
 *   - venta.pagos.service.ts      → registrarPago, eliminarPago, consultas de pago
 *   - venta.entregas.service.ts   → registrarEntregaParcial, marcarEnEntrega, marcarEntregada
 *   - venta.reservas.service.ts   → registrarAdelantoConReserva, reservas, adelantos
 *   - venta.recalculo.service.ts  → corregirPrecio, editarVenta, FEFO diag, canales
 *   - venta.stats.service.ts      → getStats, historial financiero cliente
 */

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
  limit,
  Timestamp,
  serverTimestamp,
  writeBatch,
  runTransaction,
  onSnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { mapDocs } from '../lib/firestoreHelpers';
import { COLLECTIONS } from '../config/collections';
import type {
  Venta,
  VentaFormData,
  EstadoVenta,
  EstadoPago,
  MetodoPago,
  PagoVenta,
  VentaStats,
  ProductoVenta,
  AsignacionUnidad,
  ResultadoAsignacion,
  ProductoDisponible,
  StockReservado,
  ProductoReservado,
  ProductoStockVirtual,
  AdelantoData,
  TipoReserva,
  EstadoCotizacion,
  EstadoAsignacionProducto,
  EstadoEntregaProducto,
  EntregaParcial,
  EditarVentaData
} from '../types/venta.types';
import type { Unidad } from '../types/unidad.types';
import { ESTADOS_EN_ORIGEN } from '../types/unidad.types';
import { esPaisOrigen } from '../utils/multiOrigen.helpers';
import { ProductoService } from './producto.service';
import { inventarioService } from './inventario.service';
import { unidadService } from './unidad.service';
import { tipoCambioService } from './tipoCambio.service';
import { NotificationService } from './notification.service';
import { tesoreriaService } from './tesoreria.service';
import { metricasService } from './metricas.service';
import { entregaService } from './entrega.service';
import { gastoService } from './gasto.service';
import { actividadService } from './actividad.service';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import { logBackgroundError } from '../lib/logger';

// Módulos especializados
import * as PagosService from './venta.pagos.service';
import * as EntregasService from './venta.entregas.service';
import * as ReservasService from './venta.reservas.service';
import * as RecalculoService from './venta.recalculo.service';
import * as StatsService from './venta.stats.service';
import { logger } from '../lib/logger';

const COLLECTION_NAME = COLLECTIONS.VENTAS;

/**
 * Reintenta una función async con backoff exponencial.
 * Intentos: 1 inmediato + 2 reintentos (1 s → 2 s).
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries exceeded');
}

export class VentaService {
  // ==========================================================================
  // CONSULTAS BÁSICAS
  // ==========================================================================

  /**
   * Obtener ventas ordenadas por fecha descendente.
   * @param maxResults - Límite de documentos (default 500). Pasar Infinity para reportes completos.
   */
  static async getAll(maxResults: number = 500): Promise<Venta[]> {
    try {
      const baseQ = query(
        collection(db, COLLECTION_NAME),
        orderBy('fechaCreacion', 'desc')
      );
      const q = isFinite(maxResults) ? query(baseQ, limit(maxResults)) : baseQ;

      const snapshot = await getDocs(q);

      return mapDocs<Venta>(snapshot);
    } catch (error: any) {
      logger.error('Error al obtener ventas:', error);
      throw new Error('Error al cargar ventas');
    }
  }

  /**
   * Obtener ventas confirmadas que requieren stock (para Requerimientos)
   * Optimización: solo trae lo necesario en vez de todas las ventas
   */
  static async getVentasRequierenStock(): Promise<Venta[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('estado', '==', 'confirmada'),
        where('requiereStock', '==', true)
      );
      const snapshot = await getDocs(q);
      return mapDocs<Venta>(snapshot);
    } catch (error: any) {
      logger.error('Error al obtener ventas que requieren stock:', error);
      return [];
    }
  }

  /**
   * Suscripción en tiempo real a ventas (últimas N ventas, ordenadas por fecha).
   * Usa onSnapshot para recibir actualizaciones automáticas.
   */
  static suscribirVentas(
    callback: (ventas: Venta[]) => void,
    limitCount: number = 200
  ): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('fechaCreacion', 'desc'),
      limit(limitCount)
    );

    return onSnapshot(q, (snapshot) => {
      const ventas = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Venta));
      callback(ventas);
    }, (error) => {
      logger.error('Error en suscripción de ventas:', error);
    });
  }

  /**
   * Obtener ventas recientes (últimos N días)
   */
  static async getVentasRecientes(dias: number = 30): Promise<Venta[]> {
    try {
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - dias);

      const q = query(
        collection(db, COLLECTION_NAME),
        where('fechaCreacion', '>=', Timestamp.fromDate(fechaLimite)),
        orderBy('fechaCreacion', 'desc')
      );

      const snapshot = await getDocs(q);

      return mapDocs<Venta>(snapshot);
    } catch (error: any) {
      logger.error('Error al obtener ventas recientes:', error);
      // Fallback: obtener todas y filtrar en memoria
      const todasVentas = await this.getAll();
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - dias);
      return todasVentas.filter(v => {
        const fechaVenta = v.fechaCreacion?.toDate?.() || new Date(0);
        return fechaVenta >= fechaLimite;
      });
    }
  }

  /**
   * Obtener venta por ID
   */
  static async getById(id: string): Promise<Venta | null> {
    try {
      const docSnap = await getDoc(doc(db, COLLECTION_NAME, id));

      if (!docSnap.exists()) {
        return null;
      }

      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Venta;
    } catch (error: any) {
      logger.error('Error al obtener venta:', error);
      throw new Error('Error al cargar venta');
    }
  }

  /**
   * Obtener ventas por estado
   */
  static async getByEstado(estado: EstadoVenta): Promise<Venta[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('estado', '==', estado),
        orderBy('fechaCreacion', 'desc')
      );

      const snapshot = await getDocs(q);

      return mapDocs<Venta>(snapshot);
    } catch (error: any) {
      logger.error('Error al obtener ventas por estado:', error);
      throw new Error('Error al cargar ventas');
    }
  }

  /**
   * Obtener productos disponibles para venta.
   *
   * OPTIMIZADO: Hace UNA sola consulta de inventario en lugar de N consultas.
   */
  static async getProductosDisponibles(): Promise<ProductoDisponible[]> {
    try {
      const [productos, inventarioPeru, inventarioUSA] = await Promise.all([
        ProductoService.getAll(false, Infinity),
        inventarioService.getInventarioAgregado({ pais: 'Peru' }),
        inventarioService.getInventarioAgregado({ pais: 'USA' })
      ]);

      const disponiblesPorProductoPeru = new Map<string, number>();
      for (const inv of inventarioPeru) {
        const actual = disponiblesPorProductoPeru.get(inv.productoId) || 0;
        disponiblesPorProductoPeru.set(inv.productoId, actual + inv.disponibles);
      }

      const disponiblesPorProductoUSA = new Map<string, number>();
      for (const inv of inventarioUSA) {
        const actual = disponiblesPorProductoUSA.get(inv.productoId) || 0;
        disponiblesPorProductoUSA.set(inv.productoId, actual + inv.disponibles);
      }

      const productosDisponibles: ProductoDisponible[] = [];

      for (const producto of productos) {
        if (producto.estado !== 'activo') continue;

        const disponiblesEnPeru = disponiblesPorProductoPeru.get(producto.id) || 0;
        const disponiblesEnUSA = disponiblesPorProductoUSA.get(producto.id) || 0;

        const productoDisponible: ProductoDisponible = {
          productoId: producto.id,
          sku: producto.sku,
          marca: producto.marca,
          nombreComercial: producto.nombreComercial,
          presentacion: producto.presentacion,
          ...(producto.contenido && { contenido: producto.contenido }),
          ...(producto.dosaje && { dosaje: producto.dosaje }),
          ...(producto.sabor && { sabor: producto.sabor }),
          unidadesDisponibles: disponiblesEnPeru,
          unidadesUSA: disponiblesEnUSA,
          unidadesEnTransito: 0,
          precioSugerido: 0,
          margenObjetivo: 0
        };

        if (producto.investigacion) {
          const inv = producto.investigacion;
          productoDisponible.investigacion = {
            precioPERUMin: inv.precioPERUMin,
            precioPERUMax: inv.precioPERUMax,
            precioPERUPromedio: inv.precioPERUPromedio,
            precioEntrada: inv.precioPERUMin * 0.95,
            ctruEstimado: inv.ctruEstimado,
            margenEstimado: inv.margenEstimado,
            demandaEstimada: inv.demandaEstimada,
            fechaInvestigacion: inv.fechaInvestigacion?.toDate()
          };
        }

        productosDisponibles.push(productoDisponible);
      }

      return productosDisponibles;
    } catch (error: any) {
      logger.error('Error al obtener productos disponibles:', error);
      throw new Error('Error al cargar productos');
    }
  }

  // ==========================================================================
  // CREACIÓN
  // ==========================================================================

  /**
   * Crear venta (cotización o venta directa).
   *
   * Para cotizaciones: NO valida stock (permite reservas virtuales).
   * Para ventas directas: SÍ valida stock disponible.
   */
  static async create(data: VentaFormData, userId: string, esVentaDirecta: boolean = false): Promise<Venta> {
    try {
      const productosConFaltante: Array<{
        productoId: string;
        nombre: string;
        disponibles: number;
        solicitados: number;
      }> = [];
      let requiereStock = false;

      for (const prod of data.productos) {
        const inventarioProducto = await inventarioService.getInventarioProducto(prod.productoId);
        const disponiblesEnPeru = inventarioProducto
          .filter(inv => inv.pais === 'Peru')
          .reduce((sum, inv) => sum + inv.disponibles, 0);

        if (disponiblesEnPeru < prod.cantidad) {
          const producto = await ProductoService.getById(prod.productoId);
          const nombreProducto = `${producto?.marca} ${producto?.nombreComercial}`;

          if (esVentaDirecta) {
            throw new Error(
              `Stock insuficiente para ${nombreProducto}. ` +
              `Disponibles: ${disponiblesEnPeru}, Solicitados: ${prod.cantidad}`
            );
          } else {
            requiereStock = true;
            productosConFaltante.push({
              productoId: prod.productoId,
              nombre: nombreProducto,
              disponibles: disponiblesEnPeru,
              solicitados: prod.cantidad
            });
          }
        }
      }

      const productosVenta: ProductoVenta[] = [];
      let subtotalPEN = 0;
      const lineaNegocioIds: string[] = [];
      let lineaNegocioNombreMap: Record<string, string> = {};

      for (const prod of data.productos) {
        const producto = await ProductoService.getById(prod.productoId);
        if (!producto) {
          throw new Error(`Producto ${prod.productoId} no encontrado`);
        }

        if (producto.lineaNegocioId) {
          lineaNegocioIds.push(producto.lineaNegocioId);
          if (producto.lineaNegocioNombre) {
            lineaNegocioNombreMap[producto.lineaNegocioId] = producto.lineaNegocioNombre;
          }
        }

        const subtotal = prod.cantidad * prod.precioUnitario;
        subtotalPEN += subtotal;

        const prodVenta: ProductoVenta = {
          productoId: prod.productoId,
          sku: producto.sku,
          marca: producto.marca,
          nombreComercial: producto.nombreComercial,
          presentacion: producto.presentacion,
          cantidad: prod.cantidad,
          precioUnitario: prod.precioUnitario,
          subtotal
        };
        if (producto.contenido) prodVenta.contenido = producto.contenido;
        if (producto.dosaje) prodVenta.dosaje = producto.dosaje;
        if ((producto as any).sabor) prodVenta.sabor = (producto as any).sabor;
        productosVenta.push(prodVenta);
      }

      // Auto-inherit lineaNegocioId from products (most frequent wins)
      let derivedLineaNegocioId: string | undefined;
      let derivedLineaNegocioNombre: string | undefined;
      if (lineaNegocioIds.length > 0) {
        const freq: Record<string, number> = {};
        for (const id of lineaNegocioIds) {
          freq[id] = (freq[id] || 0) + 1;
        }
        derivedLineaNegocioId = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
        derivedLineaNegocioNombre = lineaNegocioNombreMap[derivedLineaNegocioId];
      }

      const descuento = data.descuento || 0;
      const costoEnvio = data.costoEnvio || 0;
      const incluyeEnvio = data.incluyeEnvio ?? true;
      const totalPEN = subtotalPEN - descuento + (incluyeEnvio ? 0 : costoEnvio);

      const numeroVenta = await this.generateNumeroVenta();

      // Auto-crear o vincular cliente en Maestros si no viene clienteId
      let clienteIdFinal = data.clienteId;
      if (!clienteIdFinal && data.nombreCliente) {
        try {
          const { clienteService } = await import('./cliente.service');
          const { cliente } = await clienteService.getOrCreate({
            nombre: data.nombreCliente.trim(),
            tipoCliente: 'persona',
            telefono: data.telefonoCliente || undefined,
            email: data.emailCliente || undefined,
            dniRuc: data.dniRuc || undefined,
            canalOrigen: data.canal || 'directo',
          }, userId);
          clienteIdFinal = cliente.id;
        } catch (clienteError) {
          logger.warn('[crear] Error auto-creando cliente en Maestros:', clienteError);
        }
      }

      const nuevaVenta: any = {
        numeroVenta,
        nombreCliente: data.nombreCliente,
        ...(clienteIdFinal && { clienteId: clienteIdFinal }),
        canal: data.canal,
        ...(data.canalNombre && { canalNombre: data.canalNombre }),
        productos: productosVenta,
        subtotalPEN,
        totalPEN,
        incluyeEnvio,
        estadoPago: 'pendiente' as EstadoPago,
        pagos: [],
        montoPagado: 0,
        montoPendiente: totalPEN,
        estado: esVentaDirecta ? 'confirmada' : 'cotizacion',
        ...((!esVentaDirecta) && { estadoCotizacion: 'nueva' as EstadoCotizacion }),
        creadoPor: userId,
        fechaCreacion: serverTimestamp()
      };

      if (descuento > 0) nuevaVenta.descuento = descuento;
      if (costoEnvio > 0) nuevaVenta.costoEnvio = costoEnvio;
      if (data.emailCliente) nuevaVenta.emailCliente = data.emailCliente;
      if (data.telefonoCliente) nuevaVenta.telefonoCliente = data.telefonoCliente;
      if (data.direccionEntrega) nuevaVenta.direccionEntrega = data.direccionEntrega;
      if (data.distrito) nuevaVenta.distrito = data.distrito;
      if (data.provincia) nuevaVenta.provincia = data.provincia;
      if (data.codigoPostal) nuevaVenta.codigoPostal = data.codigoPostal;
      if (data.referencia) nuevaVenta.referencia = data.referencia;
      if (data.coordenadas) nuevaVenta.coordenadas = data.coordenadas;
      if (data.dniRuc) nuevaVenta.dniRuc = data.dniRuc;
      if (data.mercadoLibreId) nuevaVenta.mercadoLibreId = data.mercadoLibreId;
      if (data.observaciones) nuevaVenta.observaciones = data.observaciones;
      if (data.ventaBajoCosto) {
        nuevaVenta.ventaBajoCosto = true;
        if (data.aprobadoPor) nuevaVenta.aprobadoBajoCostoPor = data.aprobadoPor;
      }
      if (data.esVentaSocio) {
        nuevaVenta.esVentaSocio = true;
        if (data.socioNombre) nuevaVenta.socioNombre = data.socioNombre;
      }

      if (derivedLineaNegocioId) {
        nuevaVenta.lineaNegocioId = derivedLineaNegocioId;
        if (derivedLineaNegocioNombre) nuevaVenta.lineaNegocioNombre = derivedLineaNegocioNombre;
      }

      if (data.comisionML) nuevaVenta.comisionML = data.comisionML;
      if (data.comisionMLPorcentaje) nuevaVenta.comisionMLPorcentaje = data.comisionMLPorcentaje;
      if (data.costoEnvioML) nuevaVenta.costoEnvioML = data.costoEnvioML;
      if (data.costoEnvioNegocio) nuevaVenta.costoEnvioNegocio = data.costoEnvioNegocio;
      if (data.otrosGastosVenta) nuevaVenta.otrosGastosVenta = data.otrosGastosVenta;
      const gastosVentaPEN = (data.comisionML || 0) + (data.costoEnvioML || 0) + (data.costoEnvioNegocio || 0) + (data.otrosGastosVenta || 0);
      if (gastosVentaPEN > 0) nuevaVenta.gastosVentaPEN = gastosVentaPEN;

      if (!esVentaDirecta && requiereStock) {
        nuevaVenta.requiereStock = true;
        nuevaVenta.productosConFaltante = productosConFaltante;
      }

      if (esVentaDirecta) {
        nuevaVenta.fechaConfirmacion = serverTimestamp();
      }

      const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevaVenta);

      actividadService.registrar({
        tipo: esVentaDirecta ? 'venta_creada' : 'cotizacion_creada',
        mensaje: esVentaDirecta
          ? `Nueva venta ${numeroVenta} creada para ${data.nombreCliente} por S/${totalPEN.toFixed(2)}`
          : `Nueva cotización ${numeroVenta} creada para ${data.nombreCliente} por S/${totalPEN.toFixed(2)}`,
        userId,
        displayName: userId,
        metadata: { entidadId: docRef.id, entidadTipo: 'venta', monto: totalPEN, moneda: 'PEN' }
      }).catch(() => {});

      // Métricas de cliente — solo para ventas directas REALES (no cotizaciones).
      // Las cotizaciones actualizan métricas al pasar por confirmarCotizacion().
      const fromCotizacion = !!(data as any)._fromCotizacion;
      if (esVentaDirecta && clienteIdFinal && !fromCotizacion) {
        import('./cliente.service').then(({ clienteService }) => {
          const productoIds = productosVenta.map((p: any) => p.productoId).filter(Boolean);
          withRetry(() => clienteService.actualizarMetricasPorVenta(clienteIdFinal!, {
            montoVenta: totalPEN,
            productoIds,
          })).catch((err: any) => {
            logger.warn('[crear] Error actualizando métricas cliente:', err);
            logBackgroundError('clienteMetricas.crear', err, 'high', { clienteId: clienteIdFinal, montoVenta: totalPEN });
          });
        });
      }

      return {
        id: docRef.id,
        ...nuevaVenta,
        fechaCreacion: Timestamp.now(),
        ...(esVentaDirecta && { fechaConfirmacion: Timestamp.now() })
      } as Venta;
    } catch (error: any) {
      logger.error('Error al crear venta:', error);
      throw new Error(error.message || 'Error al crear venta');
    }
  }

  // ==========================================================================
  // FLUJO DE COTIZACIÓN
  // ==========================================================================

  /**
   * Validar cotización - El cliente confirmó interés.
   * Flujo: nueva → validada
   */
  static async validarCotizacion(id: string, userId: string): Promise<void> {
    try {
      const venta = await this.getById(id);
      if (!venta) {
        throw new Error('Cotización no encontrada');
      }

      if (venta.estado !== 'cotizacion') {
        throw new Error('Solo se pueden validar cotizaciones');
      }

      if (venta.estadoCotizacion && venta.estadoCotizacion !== 'nueva') {
        throw new Error('Esta cotización ya fue validada');
      }

      await updateDoc(doc(db, COLLECTION_NAME, id), {
        estadoCotizacion: 'validada' as EstadoCotizacion,
        fechaValidacion: serverTimestamp(),
        validadoPor: userId,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });
    } catch (error: any) {
      logger.error('Error al validar cotización:', error);
      throw new Error(error.message || 'Error al validar cotización');
    }
  }

  /**
   * Revertir validación de cotización.
   * Flujo: validada → nueva
   */
  static async revertirValidacion(id: string, userId: string): Promise<void> {
    try {
      const venta = await this.getById(id);
      if (!venta) {
        throw new Error('Cotización no encontrada');
      }

      if (venta.estado !== 'cotizacion' || venta.estadoCotizacion !== 'validada') {
        throw new Error('Solo se pueden revertir cotizaciones validadas');
      }

      await updateDoc(doc(db, COLLECTION_NAME, id), {
        estadoCotizacion: 'nueva' as EstadoCotizacion,
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

  /**
   * Convertir cotización a venta confirmada.
   */
  static async confirmarCotizacion(id: string, userId: string): Promise<void> {
    try {
      const venta = await this.getById(id);
      if (!venta) {
        throw new Error('Venta no encontrada');
      }

      if (venta.estado !== 'cotizacion' && venta.estado !== 'reservada') {
        throw new Error('Solo se pueden confirmar cotizaciones o reservadas');
      }

      await updateDoc(doc(db, COLLECTION_NAME, id), {
        estado: 'confirmada',
        estadoCotizacion: null,
        fechaConfirmacion: serverTimestamp(),
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });

      actividadService.registrar({
        tipo: 'venta_confirmada',
        mensaje: `Venta ${venta.numeroVenta} confirmada para ${venta.nombreCliente}`,
        userId,
        displayName: userId,
        metadata: { entidadId: id, entidadTipo: 'venta', monto: venta.totalPEN, moneda: 'PEN' }
      }).catch(() => {});

      if (venta.clienteId) {
        import('./cliente.service').then(({ clienteService }) => {
          const productoIds = venta.productos?.map((p: any) => p.productoId).filter(Boolean) || [];
          const clienteId = venta.clienteId!;
          withRetry(() => clienteService.actualizarMetricasPorVenta(clienteId, {
            montoVenta: venta.totalPEN || 0,
            productoIds,
          })).catch((err: any) => {
            logger.warn('[confirmarVenta] Error actualizando métricas cliente tras 3 intentos:', err);
            logBackgroundError('clienteMetricas.confirmarVenta', err, 'high', { clienteId, ventaId: id, montoVenta: venta.totalPEN });
          });
          withRetry(() => clienteService.calcularCanalPrincipal(clienteId)).catch(() => {});
        });
      }
    } catch (error: any) {
      logger.error('Error al confirmar cotización:', error);
      throw new Error(error.message || 'Error al confirmar cotización');
    }
  }

  // ==========================================================================
  // ASIGNACIÓN DE INVENTARIO (FEFO)
  // ==========================================================================

  /**
   * Asignar inventario con lógica FEFO (First Expire, First Out).
   *
   * IMPORTANTE: Si la venta proviene de una cotización con unidades ya reservadas,
   * se usan primero esas unidades reservadas antes de buscar nuevas con FEFO.
   */
  static async asignarInventario(id: string, userId: string): Promise<ResultadoAsignacion[]> {
    try {
      const venta = await this.getById(id);
      if (!venta) {
        throw new Error('Venta no encontrada');
      }

      if (venta.estado !== 'confirmada' && venta.estado !== 'reservada') {
        throw new Error('Solo se puede asignar inventario a ventas confirmadas o reservadas');
      }

      const resultados: ResultadoAsignacion[] = [];
      const productosActualizados: ProductoVenta[] = [];
      let costoTotalPEN = 0;

      const unidadesYaReservadas = new Map<string, string[]>();

      if (venta.stockReservado?.productosReservados) {
        for (const prodReservado of venta.stockReservado.productosReservados) {
          if (prodReservado.unidadesReservadas.length > 0) {
            unidadesYaReservadas.set(prodReservado.productoId, prodReservado.unidadesReservadas);
          }
        }
      }

      const ventaExtendida = venta as any;
      const cotizacionOrigenId = ventaExtendida.cotizacionOrigenId;

      logger.log(`[FEFO] ========================================`);
      logger.log(`[FEFO] Venta ID: ${id}`);
      logger.log(`[FEFO] Número: ${venta.numeroVenta}`);
      logger.log(`[FEFO] Cotización origen ID: ${cotizacionOrigenId || 'N/A'}`);
      logger.log(`[FEFO] stockReservado: ${venta.stockReservado ? 'SÍ' : 'NO'}`);
      if (venta.stockReservado) {
        logger.log(`[FEFO] stockReservado.tipoReserva: ${(venta.stockReservado as any).tipoReserva || 'N/A'}`);
        logger.log(`[FEFO] stockReservado.productosReservados:`, venta.stockReservado.productosReservados);
      }
      logger.log(`[FEFO] Productos en venta:`, venta.productos.map(p => `${p.sku}: ${p.cantidad} uds`));
      logger.log(`[FEFO] ========================================`);

      for (const producto of venta.productos) {
        if (!unidadesYaReservadas.has(producto.productoId)) {
          const unidadesReservadasDB = await unidadService.buscar({
            productoId: producto.productoId,
            estado: 'reservada'
          });

          const reservadasParaEstaVenta = unidadesReservadasDB.filter(u => {
            const unidadExtendida = u as any;
            const refs = [unidadExtendida.reservadaPara, unidadExtendida.reservadoPara].filter(Boolean);
            const coincide = refs.some(ref =>
              ref === id || (cotizacionOrigenId && ref === cotizacionOrigenId)
            );
            logger.log(`[FEFO] Unidad ${u.id}: reservadaPara=${unidadExtendida.reservadaPara}, reservadoPara=${unidadExtendida.reservadoPara}, match=${coincide}`);
            return coincide;
          });

          logger.log(`[FEFO] Producto ${producto.productoId}: ${unidadesReservadasDB.length} reservadas en DB, ${reservadasParaEstaVenta.length} para esta venta`);

          if (reservadasParaEstaVenta.length > 0) {
            logger.log(`[FEFO] Encontradas ${reservadasParaEstaVenta.length} unidades reservadas para producto ${producto.productoId}`);
            unidadesYaReservadas.set(
              producto.productoId,
              reservadasParaEstaVenta.map(u => u.id)
            );
          }
        }
      }

      // Paso 1 (fuera de transacción): determinar qué unidades asignar usando FEFO/reservas.
      // Estas lecturas pueden ser "stale" — por eso las re-verificamos dentro de la transacción.
      for (const producto of venta.productos) {
        let resultado: ResultadoAsignacion;

        const unidadesReservadasProducto = unidadesYaReservadas.get(producto.productoId) || [];

        if (unidadesReservadasProducto.length > 0) {
          resultado = await this.usarUnidadesReservadas(
            producto.productoId,
            producto.cantidad,
            unidadesReservadasProducto
          );
        } else {
          resultado = await this.asignarUnidadesFEFO(producto.productoId, producto.cantidad);
        }

        resultados.push(resultado);

        if (resultado.unidadesFaltantes > 0) {
          throw new Error(
            `Stock insuficiente para ${producto.marca} ${producto.nombreComercial}. ` +
            `Faltan ${resultado.unidadesFaltantes} unidades`
          );
        }

        const costoUnidades = resultado.unidadesAsignadas.reduce((sum, u) => sum + u.ctru, 0);
        const margenReal = ((producto.subtotal - costoUnidades) / producto.subtotal) * 100;

        costoTotalPEN += costoUnidades;

        productosActualizados.push({
          ...producto,
          unidadesAsignadas: resultado.unidadesAsignadas.map(u => u.unidadId),
          costoTotalUnidades: costoUnidades,
          margenReal
        });
      }

      const utilidadBrutaPEN = venta.totalPEN - costoTotalPEN;
      const margenPromedio = (utilidadBrutaPEN / venta.totalPEN) * 100;

      // Paso 2 (dentro de runTransaction): re-verificar estado de cada unidad seleccionada
      // y escribir atómicamente. Esto previene que dos ventas concurrentes asignen la misma unidad.
      const todasLasUnidades = resultados.flatMap(r => r.unidadesAsignadas);
      const estadosValidosParaAsignar = new Set(['disponible_peru', 'reservada', ...ESTADOS_EN_ORIGEN]);

      await runTransaction(db, async (transaction) => {
        // Re-leer cada unidad dentro de la transacción para detectar cambios concurrentes
        for (const asignacion of todasLasUnidades) {
          const unidadRef = doc(db, COLLECTIONS.UNIDADES, asignacion.unidadId);
          const unidadSnap = await transaction.get(unidadRef);
          if (!unidadSnap.exists()) {
            throw new Error(
              `La unidad ${asignacion.unidadId} ya no existe. Intente asignar inventario nuevamente.`
            );
          }
          const estadoActual = unidadSnap.data()?.estado as string | undefined;
          if (!estadoActual || !estadosValidosParaAsignar.has(estadoActual)) {
            throw new Error(
              `La unidad ${asignacion.unidadId} fue modificada por una operación concurrente ` +
              `(estado actual: ${estadoActual ?? 'desconocido'}). Intente asignar inventario nuevamente.`
            );
          }
          transaction.update(unidadRef, {
            estado: 'asignada_pedido',
            ventaId: id,
            fechaAsignacion: serverTimestamp()
          });
        }

        const ventaRef = doc(db, COLLECTION_NAME, id);
        transaction.update(ventaRef, {
          estado: 'asignada',
          productos: productosActualizados,
          costoTotalPEN,
          utilidadBrutaPEN,
          margenPromedio,
          stockReservado: null,
          fechaAsignacion: serverTimestamp(),
          ultimaEdicion: serverTimestamp(),
          editadoPor: userId
        });
      });

      const productosAfectados = [...new Set(venta.productos.map(p => p.productoId))];
      await inventarioService.sincronizarStockProductos_batch(productosAfectados);

      import('./mercadoLibre.service').then(({ mercadoLibreService }) => {
        for (const pid of productosAfectados) {
          mercadoLibreService.syncStock(pid).catch(e => {
            logger.error(`[ML Sync] Error post-asignación ${pid}:`, e);
            logBackgroundError('mlSync.postAsignacion', e, 'high', { productoId: pid, ventaId: id });
          });
        }
      });

      return resultados;
    } catch (error: any) {
      logger.error('Error al asignar inventario:', error);
      throw new Error(error.message || 'Error al asignar inventario');
    }
  }

  /**
   * Asignar unidades usando FEFO (First Expire, First Out).
   */
  private static async asignarUnidadesFEFO(
    productoId: string,
    cantidad: number
  ): Promise<ResultadoAsignacion> {
    try {
      const seleccionFEFO = await unidadService.seleccionarFEFO(productoId, cantidad);

      const tipoCambioVenta = await tipoCambioService.resolverTCVentaEstricto();

      const asignaciones: AsignacionUnidad[] = seleccionFEFO.map(({ unidad }) => {
        const unidadExtendida = unidad as any;

        let ctruPEN: number;
        if (unidadExtendida.ctruDinamico && unidadExtendida.ctruDinamico > 0) {
          ctruPEN = unidadExtendida.ctruDinamico;
        } else {
          const costoFleteUSD = unidadExtendida.costoFleteUSD || 0;
          const costoTotalUSD = unidad.costoUnitarioUSD + costoFleteUSD;
          const tcAplicable = unidadExtendida.tcPago || unidadExtendida.tcCompra || tipoCambioVenta;
          ctruPEN = costoTotalUSD * tcAplicable;
        }

        return {
          unidadId: unidad.id,
          productoId: unidad.productoId,
          sku: unidad.productoSKU,
          codigoUnidad: `${unidad.ordenCompraNumero}-${unidad.id.slice(-3)}`,
          ctru: ctruPEN,
          fechaVencimiento: unidad.fechaVencimiento
        };
      });

      return {
        productoId,
        cantidadSolicitada: cantidad,
        cantidadAsignada: asignaciones.length,
        unidadesAsignadas: asignaciones,
        unidadesFaltantes: cantidad - asignaciones.length
      };
    } catch (error: any) {
      logger.error('Error en FEFO:', error);
      throw error;
    }
  }

  /**
   * Usar unidades ya reservadas para esta venta/cotización.
   * Si las unidades reservadas no son suficientes, complementa con FEFO de disponibles.
   */
  private static async usarUnidadesReservadas(
    productoId: string,
    cantidad: number,
    unidadesReservadasIds: string[]
  ): Promise<ResultadoAsignacion> {
    try {
      const tipoCambioVenta = await tipoCambioService.resolverTCVentaEstricto();

      const asignaciones: AsignacionUnidad[] = [];

      for (const unidadId of unidadesReservadasIds) {
        if (asignaciones.length >= cantidad) break;

        const unidad = await unidadService.getById(unidadId);
        if (!unidad) {
          logger.warn(`Unidad reservada ${unidadId} no encontrada`);
          continue;
        }

        if (unidad.productoId !== productoId) {
          logger.warn(`Unidad ${unidadId} no corresponde al producto ${productoId}`);
          continue;
        }

        const estadosValidos = ['reservada', 'disponible_peru', ...ESTADOS_EN_ORIGEN];
        if (!estadosValidos.includes(unidad.estado)) {
          logger.warn(`Unidad ${unidadId} no está en estado válido para asignar (estado: ${unidad.estado})`);
          continue;
        }

        const unidadExtendida = unidad as any;
        let ctruPEN: number;

        if (unidadExtendida.ctruDinamico && unidadExtendida.ctruDinamico > 0) {
          ctruPEN = unidadExtendida.ctruDinamico;
        } else {
          const costoFleteUSD = unidadExtendida.costoFleteUSD || 0;
          const costoTotalUSD = unidad.costoUnitarioUSD + costoFleteUSD;
          const tcAplicable = unidadExtendida.tcPago || unidadExtendida.tcCompra || tipoCambioVenta;
          ctruPEN = costoTotalUSD * tcAplicable;
        }

        asignaciones.push({
          unidadId: unidad.id,
          productoId: unidad.productoId,
          sku: unidad.productoSKU,
          codigoUnidad: `${unidad.ordenCompraNumero}-${unidad.id.slice(-3)}`,
          ctru: ctruPEN,
          fechaVencimiento: unidad.fechaVencimiento
        });
      }

      // Si aún faltan unidades, complementar con FEFO de disponibles
      const faltantes = cantidad - asignaciones.length;
      if (faltantes > 0) {
        logger.log(`[Reserva] Faltan ${faltantes} unidades, buscando con FEFO...`);
        const complementoFEFO = await unidadService.seleccionarFEFO(productoId, faltantes);

        for (const { unidad } of complementoFEFO) {
          const unidadExtendida = unidad as any;
          let ctruPEN: number;

          if (unidadExtendida.ctruDinamico && unidadExtendida.ctruDinamico > 0) {
            ctruPEN = unidadExtendida.ctruDinamico;
          } else {
            const costoFleteUSD = unidadExtendida.costoFleteUSD || 0;
            const costoTotalUSD = unidad.costoUnitarioUSD + costoFleteUSD;
            const tcAplicable = unidadExtendida.tcPago || unidadExtendida.tcCompra || tipoCambioVenta;
            ctruPEN = costoTotalUSD * tcAplicable;
          }

          asignaciones.push({
            unidadId: unidad.id,
            productoId: unidad.productoId,
            sku: unidad.productoSKU,
            codigoUnidad: `${unidad.ordenCompraNumero}-${unidad.id.slice(-3)}`,
            ctru: ctruPEN,
            fechaVencimiento: unidad.fechaVencimiento
          });
        }
      }

      return {
        productoId,
        cantidadSolicitada: cantidad,
        cantidadAsignada: asignaciones.length,
        unidadesAsignadas: asignaciones,
        unidadesFaltantes: cantidad - asignaciones.length
      };
    } catch (error: any) {
      logger.error('Error usando unidades reservadas:', error);
      throw error;
    }
  }

  /**
   * Completar asignación de un producto específico (asignación parcial tardía).
   */
  static async completarAsignacionProducto(
    ventaId: string,
    productoId: string,
    userId: string
  ): Promise<ResultadoAsignacion> {
    try {
      const venta = await this.getById(ventaId);
      if (!venta) {
        throw new Error('Venta no encontrada');
      }

      const producto = venta.productos.find(p => p.productoId === productoId);
      if (!producto) {
        throw new Error('Producto no encontrado en la venta');
      }

      if (producto.estadoAsignacion === 'asignado') {
        throw new Error('El producto ya tiene asignación completa');
      }

      const cantidadPendiente = producto.cantidadPendiente || 0;
      if (cantidadPendiente === 0) {
        throw new Error('No hay unidades pendientes para asignar');
      }

      const resultado = await this.asignarUnidadesFEFO(
        productoId,
        cantidadPendiente
      );

      const batch = writeBatch(db);

      const unidadesAsignadasActuales = producto.unidadesAsignadas || [];
      const nuevasUnidades = resultado.unidadesAsignadas.map(u => u.unidadId);
      const todasLasUnidades = [...unidadesAsignadasActuales, ...nuevasUnidades];

      const cantidadAsignadaTotal = (producto.cantidadAsignada || 0) + resultado.cantidadAsignada;
      const cantidadPendienteNueva = producto.cantidad - cantidadAsignadaTotal;
      const estadoAsignacion: EstadoAsignacionProducto =
        cantidadPendienteNueva === 0 ? 'asignado' : 'parcial';

      const productosActualizados = venta.productos.map(p => {
        if (p.productoId === productoId) {
          return {
            ...p,
            unidadesAsignadas: todasLasUnidades,
            cantidadAsignada: cantidadAsignadaTotal,
            cantidadPendiente: cantidadPendienteNueva,
            estadoAsignacion
          };
        }
        return p;
      });

      const todosCompletos = productosActualizados.every(
        p => p.estadoAsignacion === 'asignado'
      );

      const ventaRef = doc(db, COLLECTION_NAME, ventaId);
      batch.update(ventaRef, {
        productos: productosActualizados,
        estado: todosCompletos ? 'asignada' : 'parcial',
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });

      await batch.commit();

      return {
        productoId,
        cantidadSolicitada: cantidadPendiente,
        cantidadAsignada: resultado.cantidadAsignada,
        unidadesAsignadas: resultado.unidadesAsignadas,
        unidadesFaltantes: cantidadPendiente - resultado.cantidadAsignada
      };
    } catch (error: any) {
      logger.error('Error completando asignación de producto:', error);
      throw error;
    }
  }

  /**
   * Actualizar fecha estimada de llegada de stock para un producto con asignación parcial.
   */
  static async actualizarFechaEstimadaProducto(
    ventaId: string,
    productoId: string,
    fechaEstimada: Date,
    notas?: string,
    userId?: string
  ): Promise<void> {
    try {
      const venta = await this.getById(ventaId);
      if (!venta) {
        throw new Error('Venta no encontrada');
      }

      const producto = venta.productos.find(p => p.productoId === productoId);
      if (!producto) {
        throw new Error('Producto no encontrado en la venta');
      }

      const productosActualizados = venta.productos.map(p => {
        if (p.productoId === productoId) {
          return {
            ...p,
            fechaEstimadaStock: Timestamp.fromDate(fechaEstimada),
            notasStock: notas || p.notasStock
          };
        }
        return p;
      });

      const ventaRef = doc(db, COLLECTION_NAME, ventaId);
      await updateDoc(ventaRef, {
        productos: productosActualizados,
        ultimaEdicion: serverTimestamp(),
        ...(userId && { editadoPor: userId })
      });
    } catch (error: any) {
      logger.error('Error actualizando fecha estimada:', error);
      throw error;
    }
  }

  // ==========================================================================
  // ENTREGAS — delegado a venta.entregas.service.ts
  // ==========================================================================

  /**
   * Registrar entrega parcial de productos.
   */
  static async registrarEntregaParcial(
    id: string,
    userId: string,
    datos?: {
      direccionEntrega?: string;
      notasEntrega?: string;
      productosAEntregar?: Array<{ productoId: string; cantidad: number }>;
    }
  ): Promise<EntregaParcial> {
    try {
      const venta = await this.getById(id);
      if (!venta) throw new Error('Venta no encontrada');
      return await EntregasService.registrarEntregaParcial(venta, userId, datos);
    } catch (error: any) {
      logger.error('Error registrando entrega parcial:', error);
      throw error;
    }
  }

  /**
   * Marcar como en entrega.
   */
  static async marcarEnEntrega(
    id: string,
    userId: string,
    datos?: { direccionEntrega?: string; notasEntrega?: string }
  ): Promise<void> {
    try {
      const venta = await this.getById(id);
      if (!venta) throw new Error('Venta no encontrada');
      return await EntregasService.marcarEnEntrega(venta, userId, datos);
    } catch (error: any) {
      logger.error('Error al marcar en entrega:', error);
      throw new Error(error.message || 'Error al actualizar estado');
    }
  }

  /**
   * Marcar como entregada.
   */
  static async marcarEntregada(id: string, userId: string, fechaEntregaReal?: Date): Promise<void> {
    try {
      const venta = await this.getById(id);
      if (!venta) throw new Error('Venta no encontrada');
      return await EntregasService.marcarEntregada(venta, userId, fechaEntregaReal);
    } catch (error: any) {
      logger.error('Error al marcar como entregada:', error);
      throw new Error(error.message || 'Error al actualizar estado');
    }
  }

  // ==========================================================================
  // CICLO DE VIDA: CANCELAR / ELIMINAR
  // ==========================================================================

  /**
   * Cancelar venta.
   */
  static async cancelar(id: string, userId: string, motivo?: string): Promise<void> {
    try {
      const venta = await this.getById(id);
      if (!venta) {
        throw new Error('Venta no encontrada');
      }

      if (venta.estado === 'entregada') {
        throw new Error('No se puede cancelar una venta entregada');
      }

      const batch = writeBatch(db);
      const productosAfectados = new Set<string>();

      if (venta.estado === 'asignada' || venta.estado === 'en_entrega' || venta.estado === 'despachada') {
        for (const producto of venta.productos) {
          if (producto.unidadesAsignadas) {
            productosAfectados.add(producto.productoId);
            for (const unidadId of producto.unidadesAsignadas) {
              const unidadSnap = await getDoc(doc(db, COLLECTIONS.UNIDADES, unidadId));
              const unidadData = unidadSnap.data();
              const estadoLiberado = esPaisOrigen(unidadData?.pais) ? 'recibida_origen' : 'disponible_peru';

              const unidadRef = doc(db, COLLECTIONS.UNIDADES, unidadId);
              batch.update(unidadRef, {
                estado: estadoLiberado,
                ventaId: null,
                fechaAsignacion: null,
                reservadaPara: null,
                reservadoPara: null
              });
            }
          }
        }
      }

      if (venta.estado === 'reservada' && venta.stockReservado?.productosReservados) {
        for (const prod of venta.stockReservado.productosReservados) {
          productosAfectados.add(prod.productoId);
          for (const unidadId of prod.unidadesReservadas) {
            const unidadSnap = await getDoc(doc(db, COLLECTIONS.UNIDADES, unidadId));
            const unidadData = unidadSnap.data();
            const estadoLiberado = esPaisOrigen(unidadData?.pais) ? 'recibida_origen' : 'disponible_peru';

            const unidadRef = doc(db, COLLECTIONS.UNIDADES, unidadId);
            batch.update(unidadRef, {
              estado: estadoLiberado,
              reservadaPara: null,
              reservadoPara: null,
              fechaReserva: null
            });
          }
        }
      }

      const ventaRef = doc(db, COLLECTION_NAME, id);
      const updates: any = {
        estado: 'cancelada',
        montoPendiente: 0,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      };

      if (motivo) {
        updates.observaciones = venta.observaciones
          ? `${venta.observaciones}\n\nCANCELADA: ${motivo}`
          : `CANCELADA: ${motivo}`;
      }

      batch.update(ventaRef, updates);

      await batch.commit();

      // Revertir pagos en Tesorería
      if (venta.pagos && venta.pagos.length > 0) {
        const pagosNoRevertidos: Array<{ monto: number; movimientoId?: string; error: unknown }> = [];

        for (const pago of venta.pagos) {
          try {
            if (pago.tesoreriaMovimientoId && pago.tesoreriaMovimientoId !== 'registrado') {
              await tesoreriaService.eliminarMovimiento(pago.tesoreriaMovimientoId, userId);
            } else if (pago.tesoreriaMovimientoId === 'registrado') {
              const snap = await getDocs(query(
                collection(db, COLLECTIONS.MOVIMIENTOS_TESORERIA),
                where('ventaId', '==', id),
                where('tipo', '==', 'ingreso_venta')
              ));
              const match = snap.docs.find(d => {
                const data = d.data();
                return data.estado !== 'anulado' && Math.abs(data.monto - pago.monto) < 0.01;
              });
              if (match) {
                await tesoreriaService.eliminarMovimiento(match.id, userId);
              }
            }
          } catch (tesoreriaError) {
            logger.error(`[cancelar] Error revirtiendo pago en tesorería (monto: ${pago.monto}):`, tesoreriaError);
            pagosNoRevertidos.push({
              monto: pago.monto,
              movimientoId: pago.tesoreriaMovimientoId,
              error: tesoreriaError,
            });
          }
        }

        if (pagosNoRevertidos.length > 0) {
          logBackgroundError(
            'tesoreria.cancelarVenta',
            new Error(`${pagosNoRevertidos.length} pago(s) no revertido(s) en tesorería tras cancelar venta`),
            'critical',
            {
              ventaId: id,
              ventaNumero: venta.numeroVenta,
              pagosNoRevertidos,
              accionRequerida: 'Revisar y anular manualmente los movimientos de tesorería listados',
            }
          );
        }
      }

      // BUG-003 FIX: Revertir movimientos Pool USD asociados a esta venta.
      // Los cobros en USD (Zelle/PayPal) generan movimientos Pool con
      // documentoOrigenTipo='venta' y documentoOrigenId=ventaId.
      // Eliminarlos uno a uno para que _estado quede consistente.
      const hasUSDPayment = venta.pagos?.some(p => p.moneda === 'USD');
      if (hasUSDPayment) {
        try {
          const { poolUSDService } = await import('./poolUSD.service');
          const { collection: col, query: q, where: w, getDocs: gd } = await import('firebase/firestore');
          const poolSnap = await gd(q(
            col(db, COLLECTIONS.POOL_USD_MOVIMIENTOS),
            w('documentoOrigenTipo', '==', 'venta'),
            w('documentoOrigenId', '==', id)
          ));
          for (const poolDoc of poolSnap.docs) {
            try {
              await poolUSDService.eliminarMovimiento(poolDoc.id);
            } catch (poolErr) {
              logger.error(`[cancelar] Error eliminando movimiento Pool USD ${poolDoc.id}:`, poolErr);
              logBackgroundError('poolUSD.cancelarVenta', poolErr, 'critical', { ventaId: id, movimientoId: poolDoc.id });
            }
          }
        } catch (poolUSDError) {
          logger.error(`[cancelar] Error revirtiendo Pool USD para venta ${id}:`, poolUSDError);
          logBackgroundError('poolUSD.cancelarVenta', poolUSDError, 'critical', { ventaId: id });
        }
      }

      if (productosAfectados.size > 0) {
        await inventarioService.sincronizarStockProductos_batch([...productosAfectados]);

        import('./mercadoLibre.service').then(({ mercadoLibreService }) => {
          for (const pid of productosAfectados) {
            mercadoLibreService.syncStock(pid).catch(e =>
              logger.error(`[ML Sync] Error post-cancelación ${pid}:`, e)
            );
          }
        });
      }

      actividadService.registrar({
        tipo: 'venta_cancelada',
        mensaje: `Venta ${venta.numeroVenta} cancelada${motivo ? ': ' + motivo : ''}`,
        userId,
        displayName: userId,
        metadata: { entidadId: id, entidadTipo: 'venta' }
      }).catch(() => {});

      try {
        const entregas = await entregaService.getByVenta(id);
        const pendientes = entregas.filter(e =>
          e.estado === 'programada' || e.estado === 'en_camino'
        );
        for (const entrega of pendientes) {
          await entregaService.cancelar(
            entrega.id!,
            `Cancelada por cancelación de venta${motivo ? ': ' + motivo : ''}`,
            userId
          );
        }
        if (pendientes.length > 0) {
          logger.log(`[Venta ${venta.numeroVenta}] ${pendientes.length} entrega(s) pendiente(s) cancelada(s)`);
        }
      } catch (entregaError) {
        logger.warn(`[Venta ${venta.numeroVenta}] Error al cancelar entregas pendientes (no bloquea):`, entregaError);
      }
    } catch (error: any) {
      logger.error('Error al cancelar venta:', error);
      throw new Error(error.message || 'Error al cancelar venta');
    }
  }

  /**
   * Eliminar venta (solo cotizaciones).
   */
  static async delete(id: string): Promise<void> {
    try {
      const venta = await this.getById(id);
      if (!venta) {
        throw new Error('Venta no encontrada');
      }

      if (venta.estado !== 'cotizacion') {
        throw new Error('Solo se pueden eliminar cotizaciones');
      }

      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error: any) {
      logger.error('Error al eliminar venta:', error);
      throw new Error(error.message || 'Error al eliminar venta');
    }
  }

  // ==========================================================================
  // ESTADÍSTICAS — delegado a venta.stats.service.ts
  // ==========================================================================

  /**
   * Obtener estadísticas agregadas de ventas.
   */
  static async getStats(): Promise<VentaStats> {
    try {
      const ventas = await this.getAll();
      return StatsService.calcularStats(ventas);
    } catch (error: any) {
      logger.error('Error al obtener estadísticas:', error);
      throw new Error('Error al generar estadísticas');
    }
  }

  // ==========================================================================
  // HELPER PRIVADO
  // ==========================================================================

  /**
   * Generar número de venta usando contador atómico.
   * Formato: VT-YYYY-NNN (ej: VT-2026-043).
   */
  private static async generateNumeroVenta(): Promise<string> {
    const year = new Date().getFullYear();
    return getNextSequenceNumber(`VT-${year}`, 3);
  }

  // ==========================================================================
  // PAGOS — delegado a venta.pagos.service.ts
  // ==========================================================================

  /**
   * Registrar un pago para una venta.
   */
  static async registrarPago(
    ventaId: string,
    datosPago: {
      monto: number;
      metodoPago: MetodoPago;
      referencia?: string;
      comprobante?: string;
      notas?: string;
      cuentaDestinoId?: string;
    },
    userId: string,
    registrarEnTesoreria: boolean = true
  ): Promise<PagoVenta> {
    return PagosService.registrarPago(ventaId, datosPago, userId, registrarEnTesoreria);
  }

  /**
   * Eliminar un pago registrado.
   */
  static async eliminarPago(ventaId: string, pagoId: string, userId: string): Promise<void> {
    try {
      return await PagosService.eliminarPago(ventaId, pagoId, userId);
    } catch (error: any) {
      logger.error('Error al eliminar pago:', error);
      throw new Error(error.message || 'Error al eliminar pago');
    }
  }

  /**
   * Obtener ventas por estado de pago.
   */
  static async getByEstadoPago(estadoPago: EstadoPago): Promise<Venta[]> {
    try {
      return await PagosService.getByEstadoPago(estadoPago);
    } catch (error: any) {
      logger.error('Error al obtener ventas por estado de pago:', error);
      throw new Error('Error al cargar ventas');
    }
  }

  /**
   * Obtener ventas con pagos pendientes.
   */
  static async getVentasPendientesPago(): Promise<Venta[]> {
    try {
      return await PagosService.getVentasPendientesPago();
    } catch (error: any) {
      logger.error('Error al obtener ventas pendientes de pago:', error);
      throw new Error('Error al cargar ventas');
    }
  }

  /**
   * Obtener resumen de pagos.
   */
  static async getResumenPagos(): Promise<{
    totalPorCobrar: number;
    ventasPendientes: number;
    ventasParciales: number;
    ventasPagadas: number;
    cobranzaMesActual: number;
  }> {
    try {
      const ventas = await this.getAll();
      return PagosService.getResumenPagos(ventas);
    } catch (error: any) {
      logger.error('Error al obtener resumen de pagos:', error);
      throw new Error('Error al generar resumen');
    }
  }

  // ==========================================================================
  // PRE-VENTA CON RESERVA DE STOCK — delegado a venta.reservas.service.ts
  // ==========================================================================

  /**
   * Registrar adelanto y crear reserva de stock (física o virtual).
   */
  static async registrarAdelantoConReserva(
    cotizacionId: string,
    adelanto: AdelantoData,
    userId: string,
    horasVigencia: number = 48
  ): Promise<{
    tipoReserva: TipoReserva;
    productosReservados: ProductoReservado[];
    productosVirtuales?: ProductoStockVirtual[];
    pagoRegistrado: PagoVenta;
    requerimientoId?: string;
  }> {
    try {
      const venta = await this.getById(cotizacionId);
      if (!venta) throw new Error('Venta/Cotización no encontrada');
      return await ReservasService.registrarAdelantoConReserva(
        cotizacionId, venta, adelanto, userId, horasVigencia
      );
    } catch (error: any) {
      logger.error('Error al registrar adelanto con reserva:', error);
      throw new Error(error.message || 'Error al procesar el adelanto');
    }
  }

  /**
   * Extender vigencia de una reserva.
   */
  static async extenderReserva(
    ventaId: string,
    horasAdicionales: number,
    motivo: string,
    userId: string
  ): Promise<void> {
    try {
      const venta = await this.getById(ventaId);
      if (!venta) throw new Error('Venta no encontrada');
      return await ReservasService.extenderReserva(venta, horasAdicionales, motivo, userId);
    } catch (error: any) {
      logger.error('Error al extender reserva:', error);
      throw new Error(error.message || 'Error al extender reserva');
    }
  }

  /**
   * Cancelar una reserva y liberar el stock.
   */
  static async cancelarReserva(ventaId: string, userId: string, motivo?: string): Promise<void> {
    try {
      const venta = await this.getById(ventaId);
      if (!venta) throw new Error('Venta no encontrada');
      return await ReservasService.cancelarReserva(venta, userId, motivo);
    } catch (error: any) {
      logger.error('Error al cancelar reserva:', error);
      throw new Error(error.message || 'Error al cancelar reserva');
    }
  }

  /**
   * Verificar reservas próximas a vencer y crear notificaciones.
   */
  static async verificarReservasPorVencer(): Promise<void> {
    try {
      const ventas = await this.getByEstado('reservada');
      return await ReservasService.verificarReservasPorVencer(ventas);
    } catch (error: any) {
      logger.error('Error al verificar reservas por vencer:', error);
    }
  }

  /**
   * Verificar si hay stock disponible para ventas con reserva virtual.
   */
  static async verificarStockParaReservasVirtuales(productoId: string): Promise<void> {
    try {
      const ventas = await this.getByEstado('reservada');
      return await ReservasService.verificarStockParaReservasVirtuales(productoId, ventas);
    } catch (error: any) {
      logger.error('Error al verificar stock para reservas virtuales:', error);
    }
  }

  /**
   * Convertir reserva virtual a física cuando hay stock disponible.
   */
  static async asignarStockAReservaVirtual(
    ventaId: string,
    userId: string
  ): Promise<{ asignados: number; faltantes: number }> {
    try {
      const venta = await this.getById(ventaId);
      if (!venta) throw new Error('Venta no encontrada');
      return await ReservasService.asignarStockAReservaVirtual(venta, userId);
    } catch (error: any) {
      logger.error('Error al asignar stock a reserva virtual:', error);
      throw new Error(error.message || 'Error al asignar stock');
    }
  }

  /**
   * Sincronizar adelanto desde cotización de origen.
   */
  static async sincronizarAdelantoDesdeCotizacion(
    ventaId: string,
    userId: string
  ): Promise<{
    sincronizado: boolean;
    montoAdelanto?: number;
    mensaje: string;
  }> {
    try {
      const venta = await this.getById(ventaId);
      if (!venta) {
        return { sincronizado: false, mensaje: 'Venta no encontrada' };
      }
      return await ReservasService.sincronizarAdelantoDesdeCotizacion(ventaId, venta, userId);
    } catch (error: any) {
      logger.error('Error al sincronizar adelanto:', error);
      return { sincronizado: false, mensaje: `Error: ${error.message}` };
    }
  }

  /**
   * Sincronizar todos los adelantos pendientes de ventas que vienen de cotizaciones.
   */
  static async sincronizarTodosLosAdelantosPendientes(
    userId: string
  ): Promise<{
    totalRevisadas: number;
    sincronizadas: number;
    detalles: Array<{ ventaId: string; numeroVenta: string; resultado: string }>;
  }> {
    try {
      const ventas = await this.getAll();
      const detalles: Array<{ ventaId: string; numeroVenta: string; resultado: string }> = [];
      let sincronizadas = 0;

      for (const venta of ventas) {
        const ventaExtendida = venta as any;

        if (!ventaExtendida.cotizacionOrigenId) continue;
        if (ventaExtendida.adelantoComprometido?.transferidoComoPago === true) continue;

        const resultado = await ReservasService.sincronizarAdelantoDesdeCotizacion(venta.id, venta, userId);

        if (resultado.sincronizado) {
          sincronizadas++;
        }

        detalles.push({
          ventaId: venta.id,
          numeroVenta: venta.numeroVenta,
          resultado: resultado.mensaje
        });
      }

      return {
        totalRevisadas: detalles.length,
        sincronizadas,
        detalles
      };
    } catch (error: any) {
      logger.error('Error al sincronizar adelantos pendientes:', error);
      throw new Error(`Error al sincronizar adelantos: ${error.message}`);
    }
  }

  // ==========================================================================
  // HISTORIAL DE CLIENTE — delegado a venta.stats.service.ts
  // ==========================================================================

  /**
   * Obtener historial financiero de un cliente.
   */
  static async getHistorialFinancieroCliente(clienteId: string): Promise<{
    ventas: Venta[];
    resumen: {
      totalVentas: number;
      ventasCompletadas: number;
      ventasPendientes: number;
      ventasCanceladas: number;
      totalVendidoPEN: number;
      totalCobradoPEN: number;
      totalPendientePEN: number;
      ticketPromedio: number;
      ultimaCompra?: Date;
      primeraCompra?: Date;
    };
    porCobrar: Venta[];
    cobradas: Venta[];
  }> {
    try {
      const { clienteService } = await import('./cliente.service');
      const cliente = await clienteService.getById(clienteId);

      if (!cliente) {
        logger.log(`[getHistorialFinancieroCliente] Cliente ${clienteId} no encontrado`);
        throw new Error('Cliente no encontrado');
      }

      logger.log(`[getHistorialFinancieroCliente] Buscando ventas para: ${cliente.nombre}`);
      logger.log(`[getHistorialFinancieroCliente] DNI/RUC: ${cliente.dniRuc}, Tel: ${cliente.telefono}`);

      const todasVentas = await this.getAll();
      const nombreClienteNorm = cliente.nombre?.toLowerCase().trim();
      const telefonoCliente = cliente.telefono?.replace(/\D/g, '');
      const telefonoAlt = cliente.telefonoAlt?.replace(/\D/g, '');
      const dniRucCliente = cliente.dniRuc?.trim();

      logger.log(`[getHistorialFinancieroCliente] Total ventas en sistema: ${todasVentas.length}`);

      const ventas = todasVentas.filter(v => {
        if (v.clienteId === clienteId) {
          logger.log(`[getHistorialFinancieroCliente] Match por clienteId: ${v.numeroVenta}`);
          return true;
        }

        if (dniRucCliente && v.dniRuc?.trim() === dniRucCliente) {
          logger.log(`[getHistorialFinancieroCliente] Match por DNI/RUC: ${v.numeroVenta}`);
          return true;
        }

        const telVenta = v.telefonoCliente?.replace(/\D/g, '');
        if (telVenta && telefonoCliente) {
          const ultimos9Venta = telVenta.slice(-9);
          const ultimos9Cliente = telefonoCliente.slice(-9);
          if (ultimos9Venta.length >= 7 && ultimos9Venta === ultimos9Cliente) {
            logger.log(`[getHistorialFinancieroCliente] Match por teléfono: ${v.numeroVenta} (${telVenta})`);
            return true;
          }
        }
        if (telVenta && telefonoAlt) {
          const ultimos9Venta = telVenta.slice(-9);
          const ultimos9Alt = telefonoAlt.slice(-9);
          if (ultimos9Venta.length >= 7 && ultimos9Venta === ultimos9Alt) {
            logger.log(`[getHistorialFinancieroCliente] Match por teléfono alt: ${v.numeroVenta}`);
            return true;
          }
        }

        const nombreVentaNorm = v.nombreCliente?.toLowerCase().trim();
        if (nombreVentaNorm && nombreClienteNorm && nombreVentaNorm === nombreClienteNorm) {
          logger.log(`[getHistorialFinancieroCliente] Match por nombre: ${v.numeroVenta} (${v.nombreCliente})`);
          return true;
        }

        return false;
      });

      logger.log(`[getHistorialFinancieroCliente] Cliente ${cliente.nombre}: ${ventas.length} ventas encontradas`);

      ventas.sort((a, b) => {
        const fechaA = a.fechaCreacion?.toDate?.() || new Date(a.fechaCreacion as any);
        const fechaB = b.fechaCreacion?.toDate?.() || new Date(b.fechaCreacion as any);
        return fechaB.getTime() - fechaA.getTime();
      });

      const { resumen, porCobrar, cobradas } = StatsService.calcularHistorialFinanciero(ventas);

      return { ventas, resumen, porCobrar, cobradas };
    } catch (error: any) {
      logger.error('Error al obtener historial financiero del cliente:', error);
      return {
        ventas: [],
        resumen: {
          totalVentas: 0,
          ventasCompletadas: 0,
          ventasPendientes: 0,
          ventasCanceladas: 0,
          totalVendidoPEN: 0,
          totalCobradoPEN: 0,
          totalPendientePEN: 0,
          ticketPromedio: 0
        },
        porCobrar: [],
        cobradas: []
      };
    }
  }

  // ==========================================================================
  // CORRECCIONES Y RECÁLCULO — delegado a venta.recalculo.service.ts
  // ==========================================================================

  /**
   * Corregir el precio de un producto en una venta ya completada.
   */
  static async corregirPrecioProducto(
    ventaId: string,
    productoId: string,
    nuevoPrecioUnitario: number,
    userId: string
  ): Promise<{ cambios: string[] }> {
    const venta = await this.getById(ventaId);
    if (!venta) throw new Error('Venta no encontrada');
    return RecalculoService.corregirPrecioProducto(venta, productoId, nuevoPrecioUnitario, userId);
  }

  /**
   * Corregir un producto equivocado en una venta.
   */
  static async corregirProductoVenta(
    ventaId: string,
    productoIdAnterior: string,
    nuevoProductoId: string,
    userId: string
  ): Promise<{ cambios: string[] }> {
    const venta = await this.getById(ventaId);
    if (!venta) throw new Error('Venta no encontrada');
    return RecalculoService.corregirProductoVenta(venta, productoIdAnterior, nuevoProductoId, userId);
  }

  /**
   * Editar una venta: productos, costos, datos de cliente, observaciones.
   */
  static async editarVenta(
    ventaId: string,
    cambios: EditarVentaData,
    userId: string
  ): Promise<{ cambios: string[] }> {
    const venta = await this.getById(ventaId);
    if (!venta) throw new Error('Venta no encontrada');
    return RecalculoService.editarVenta(venta, cambios, userId);
  }

  /**
   * Diagnosticar ventas mal asignadas por el bug FEFO.
   */
  static async diagnosticarAsignacionesFEFO(): Promise<{
    ventasAfectadas: Array<{
      ventaId: string;
      numeroVenta: string;
      estado: string;
      cotizacionOrigenId: string;
      cliente: string;
      productos: Array<{
        productoId: string;
        sku: string;
        nombre: string;
        cantidadVenta: number;
        unidadesAsignadasActuales: string[];
        unidadesReservadasHuerfanas: string[];
      }>;
      corregible: boolean;
    }>;
    resumen: {
      total: number;
      corregibles: number;
      soloReporte: number;
    };
  }> {
    return RecalculoService.diagnosticarAsignacionesFEFO();
  }

  /**
   * Corregir una venta específica mal asignada por el bug FEFO.
   */
  static async corregirAsignacionFEFO(
    ventaId: string,
    userId: string
  ): Promise<{
    corregido: boolean;
    cambios: string[];
  }> {
    return RecalculoService.corregirAsignacionFEFO(ventaId, userId);
  }

  // ==========================================================================
  // MIGRACIÓN — delegado a venta.recalculo.service.ts
  // ==========================================================================

  /**
   * Corregir canales de ventas existentes.
   */
  static async corregirCanalesVentas(): Promise<{
    corregidas: number;
    nombreAsignado: number;
    sinCambio: number;
    detalle: string[];
  }> {
    const ventas = await this.getAll();
    return RecalculoService.corregirCanalesVentas(ventas);
  }
}
