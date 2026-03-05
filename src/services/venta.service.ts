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
  onSnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
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
import { COLLECTIONS } from '../config/collections';

const COLLECTION_NAME = COLLECTIONS.VENTAS;

export class VentaService {
  /**
   * Obtener todas las ventas
   */
  static async getAll(): Promise<Venta[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('fechaCreacion', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Venta));
    } catch (error: any) {
      console.error('Error al obtener ventas:', error);
      throw new Error('Error al cargar ventas');
    }
  }

  /**
   * Suscripción en tiempo real a ventas (últimas N ventas, ordenadas por fecha)
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
      console.error('Error en suscripción de ventas:', error);
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

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Venta));
    } catch (error: any) {
      console.error('Error al obtener ventas recientes:', error);
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
      console.error('Error al obtener venta:', error);
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
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Venta));
    } catch (error: any) {
      console.error('Error al obtener ventas por estado:', error);
      throw new Error('Error al cargar ventas');
    }
  }

  /**
   * Obtener productos disponibles para venta
   *
   * OPTIMIZADO: Hace UNA sola consulta de inventario en lugar de N consultas
   */
  static async getProductosDisponibles(): Promise<ProductoDisponible[]> {
    try {
      // Obtener productos e inventario de ambos países en paralelo
      const [productos, inventarioPeru, inventarioUSA] = await Promise.all([
        ProductoService.getAll(),
        inventarioService.getInventarioAgregado({ pais: 'Peru' }),
        inventarioService.getInventarioAgregado({ pais: 'USA' })
      ]);

      // Crear mapas de disponibles por productoId para acceso O(1)
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

      // Procesar productos
      const productosDisponibles: ProductoDisponible[] = [];

      for (const producto of productos) {
        if (producto.estado !== 'activo') continue;

        const disponiblesEnPeru = disponiblesPorProductoPeru.get(producto.id) || 0;
        const disponiblesEnUSA = disponiblesPorProductoUSA.get(producto.id) || 0;

        // Incluir todos los productos activos (con o sin stock en Perú)
        // para permitir cotizaciones que generen requerimientos
        const productoDisponible: ProductoDisponible = {
          productoId: producto.id,
          sku: producto.sku,
          marca: producto.marca,
          nombreComercial: producto.nombreComercial,
          presentacion: producto.presentacion,
          unidadesDisponibles: disponiblesEnPeru,
          unidadesUSA: disponiblesEnUSA,
          unidadesEnTransito: 0,
          precioSugerido: producto.precioSugerido || 0,
          margenObjetivo: producto.margenObjetivo || 0
        };

        // Agregar datos de investigación de mercado si existen
        if (producto.investigacion) {
          const inv = producto.investigacion;
          productoDisponible.investigacion = {
            precioPERUMin: inv.precioPERUMin,
            precioPERUMax: inv.precioPERUMax,
            precioPERUPromedio: inv.precioPERUPromedio,
            precioEntrada: inv.precioPERUMin * 0.95, // Precio competitivo de entrada
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
      console.error('Error al obtener productos disponibles:', error);
      throw new Error('Error al cargar productos');
    }
  }

  /**
   * Crear venta (cotización o venta directa)
   *
   * Para cotizaciones: NO valida stock (permite reservas virtuales)
   * Para ventas directas: SÍ valida stock disponible
   */
  static async create(data: VentaFormData, userId: string, esVentaDirecta: boolean = false): Promise<Venta> {
    try {
      // Track de productos con faltante de stock (solo para cotizaciones)
      const productosConFaltante: Array<{
        productoId: string;
        nombre: string;
        disponibles: number;
        solicitados: number;
      }> = [];
      let requiereStock = false;

      // Validar disponibilidad de productos SOLO para ventas directas
      for (const prod of data.productos) {
        const inventarioProducto = await inventarioService.getInventarioProducto(prod.productoId);
        const disponiblesEnPeru = inventarioProducto
          .filter(inv => inv.pais === 'Peru')
          .reduce((sum, inv) => sum + inv.disponibles, 0);

        if (disponiblesEnPeru < prod.cantidad) {
          const producto = await ProductoService.getById(prod.productoId);
          const nombreProducto = `${producto?.marca} ${producto?.nombreComercial}`;

          if (esVentaDirecta) {
            // Ventas directas SÍ requieren stock disponible
            throw new Error(
              `Stock insuficiente para ${nombreProducto}. ` +
              `Disponibles: ${disponiblesEnPeru}, Solicitados: ${prod.cantidad}`
            );
          } else {
            // Cotizaciones: registrar el faltante pero permitir la creación
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

      // Obtener información de productos y calcular totales
      const productosVenta: ProductoVenta[] = [];
      let subtotalPEN = 0;
      
      for (const prod of data.productos) {
        const producto = await ProductoService.getById(prod.productoId);
        if (!producto) {
          throw new Error(`Producto ${prod.productoId} no encontrado`);
        }
        
        const subtotal = prod.cantidad * prod.precioUnitario;
        subtotalPEN += subtotal;
        
        productosVenta.push({
          productoId: prod.productoId,
          sku: producto.sku,
          marca: producto.marca,
          nombreComercial: producto.nombreComercial,
          presentacion: producto.presentacion,
          cantidad: prod.cantidad,
          precioUnitario: prod.precioUnitario,
          subtotal
        });
      }
      
      // Calcular total
      const descuento = data.descuento || 0;
      const costoEnvio = data.costoEnvio || 0;
      const incluyeEnvio = data.incluyeEnvio ?? true; // Por defecto envío gratis
      // Si incluyeEnvio = true (gratis), no se suma al total
      // Si incluyeEnvio = false, el cliente paga el envío
      const totalPEN = subtotalPEN - descuento + (incluyeEnvio ? 0 : costoEnvio);
      
      // Generar número de venta
      const numeroVenta = await this.generateNumeroVenta();
      
      const nuevaVenta: any = {
        numeroVenta,
        nombreCliente: data.nombreCliente,
        ...(data.clienteId && { clienteId: data.clienteId }),
        canal: data.canal,
        ...(data.canalNombre && { canalNombre: data.canalNombre }),
        productos: productosVenta,
        subtotalPEN,
        totalPEN,
        incluyeEnvio,
        // Estado de pago inicial
        estadoPago: 'pendiente' as EstadoPago,
        pagos: [],
        montoPagado: 0,
        montoPendiente: totalPEN,
        estado: esVentaDirecta ? 'confirmada' : 'cotizacion',
        // Estado del flujo de cotización (solo si es cotización)
        ...((!esVentaDirecta) && { estadoCotizacion: 'nueva' as EstadoCotizacion }),
        creadoPor: userId,
        fechaCreacion: serverTimestamp()
      };

      // Agregar campos opcionales
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

      // Campos de gastos de venta (ML y generales)
      if (data.comisionML) nuevaVenta.comisionML = data.comisionML;
      if (data.comisionMLPorcentaje) nuevaVenta.comisionMLPorcentaje = data.comisionMLPorcentaje;
      if (data.costoEnvioML) nuevaVenta.costoEnvioML = data.costoEnvioML;
      if (data.costoEnvioNegocio) nuevaVenta.costoEnvioNegocio = data.costoEnvioNegocio;
      if (data.otrosGastosVenta) nuevaVenta.otrosGastosVenta = data.otrosGastosVenta;
      const gastosVentaPEN = (data.comisionML || 0) + (data.costoEnvioML || 0) + (data.costoEnvioNegocio || 0) + (data.otrosGastosVenta || 0);
      if (gastosVentaPEN > 0) nuevaVenta.gastosVentaPEN = gastosVentaPEN;

      // Agregar info de stock faltante para cotizaciones
      if (!esVentaDirecta && requiereStock) {
        nuevaVenta.requiereStock = true;
        nuevaVenta.productosConFaltante = productosConFaltante;
      }

      if (esVentaDirecta) {
        nuevaVenta.fechaConfirmacion = serverTimestamp();
      }
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevaVenta);

      // Broadcast actividad (fire-and-forget)
      actividadService.registrar({
        tipo: esVentaDirecta ? 'venta_creada' : 'cotizacion_creada',
        mensaje: esVentaDirecta
          ? `Nueva venta ${numeroVenta} creada para ${data.nombreCliente} por S/${totalPEN.toFixed(2)}`
          : `Nueva cotización ${numeroVenta} creada para ${data.nombreCliente} por S/${totalPEN.toFixed(2)}`,
        userId,
        displayName: userId,
        metadata: { entidadId: docRef.id, entidadTipo: 'venta', monto: totalPEN, moneda: 'PEN' }
      }).catch(() => {});

      return {
        id: docRef.id,
        ...nuevaVenta,
        fechaCreacion: Timestamp.now(),
        ...(esVentaDirecta && { fechaConfirmacion: Timestamp.now() })
      } as Venta;
    } catch (error: any) {
      console.error('Error al crear venta:', error);
      throw new Error(error.message || 'Error al crear venta');
    }
  }

  /**
   * Validar cotización - El cliente confirmó interés
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
      console.error('Error al validar cotización:', error);
      throw new Error(error.message || 'Error al validar cotización');
    }
  }

  /**
   * Revertir validación de cotización
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
      console.error('Error al revertir validación:', error);
      throw new Error(error.message || 'Error al revertir validación');
    }
  }

  /**
   * Convertir cotización a venta confirmada
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
        estadoCotizacion: null, // Ya no es cotización
        fechaConfirmacion: serverTimestamp(),
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });

      // Broadcast actividad (fire-and-forget)
      actividadService.registrar({
        tipo: 'venta_confirmada',
        mensaje: `Venta ${venta.numeroVenta} confirmada para ${venta.nombreCliente}`,
        userId,
        displayName: userId,
        metadata: { entidadId: id, entidadTipo: 'venta', monto: venta.totalPEN, moneda: 'PEN' }
      }).catch(() => {});

      // Recalcular canal principal del cliente (fire & forget)
      if (venta.clienteId) {
        import('./cliente.service').then(({ clienteService }) => {
          clienteService.calcularCanalPrincipal(venta.clienteId!).catch(() => {});
        });
      }
    } catch (error: any) {
      console.error('Error al confirmar cotización:', error);
      throw new Error(error.message || 'Error al confirmar cotización');
    }
  }

  /**
   * Asignar inventario con lógica FEFO (First Expire, First Out)
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

      // Permitir asignar inventario a ventas confirmadas O reservadas
      // (reservadas = cotización con adelanto que ya tiene unidades reservadas)
      if (venta.estado !== 'confirmada' && venta.estado !== 'reservada') {
        throw new Error('Solo se puede asignar inventario a ventas confirmadas o reservadas');
      }

      const batch = writeBatch(db);
      const resultados: ResultadoAsignacion[] = [];
      const productosActualizados: ProductoVenta[] = [];
      let costoTotalPEN = 0;

      // Construir mapa de unidades ya reservadas para esta venta/cotización
      // Estas unidades tienen estado 'reservada' y reservadaPara = id de la venta
      const unidadesYaReservadas = new Map<string, string[]>(); // productoId → [unidadId, ...]

      // Fuente 1: stockReservado de la venta (reservas hechas por adelanto)
      if (venta.stockReservado?.productosReservados) {
        for (const prodReservado of venta.stockReservado.productosReservados) {
          if (prodReservado.unidadesReservadas.length > 0) {
            unidadesYaReservadas.set(prodReservado.productoId, prodReservado.unidadesReservadas);
          }
        }
      }

      // Fuente 2: Buscar unidades con reservadaPara = id de esta venta O de la cotización origen
      // (reservas hechas desde requerimiento/OC que no pasaron por adelanto)
      // IMPORTANTE: Las unidades pueden estar reservadas para:
      // - El ID de la venta actual (id)
      // - El ID de la cotización que originó esta venta (cotizacionOrigenId)
      const ventaExtendida = venta as any;
      const cotizacionOrigenId = ventaExtendida.cotizacionOrigenId;

      console.log(`[FEFO] ========================================`);
      console.log(`[FEFO] Venta ID: ${id}`);
      console.log(`[FEFO] Número: ${venta.numeroVenta}`);
      console.log(`[FEFO] Cotización origen ID: ${cotizacionOrigenId || 'N/A'}`);
      console.log(`[FEFO] stockReservado: ${venta.stockReservado ? 'SÍ' : 'NO'}`);
      if (venta.stockReservado) {
        console.log(`[FEFO] stockReservado.tipoReserva: ${(venta.stockReservado as any).tipoReserva || 'N/A'}`);
        console.log(`[FEFO] stockReservado.productosReservados:`, venta.stockReservado.productosReservados);
      }
      console.log(`[FEFO] Productos en venta:`, venta.productos.map(p => `${p.sku}: ${p.cantidad} uds`));
      console.log(`[FEFO] ========================================`);

      for (const producto of venta.productos) {
        if (!unidadesYaReservadas.has(producto.productoId)) {
          // Buscar unidades reservadas para esta venta/cotización
          const unidadesReservadasDB = await unidadService.buscar({
            productoId: producto.productoId,
            estado: 'reservada'
          });

          // Filtrar las que tienen reservadaPara/reservadoPara = id de la venta O de la cotización origen
          // NOTA: El campo puede ser "reservadaPara" o "reservadoPara" por inconsistencia histórica
          const reservadasParaEstaVenta = unidadesReservadasDB.filter(u => {
            const unidadExtendida = u as any;
            // Verificar AMBOS campos posibles
            const refs = [unidadExtendida.reservadaPara, unidadExtendida.reservadoPara].filter(Boolean);
            const coincide = refs.some(ref =>
              ref === id || (cotizacionOrigenId && ref === cotizacionOrigenId)
            );
            console.log(`[FEFO] Unidad ${u.id}: reservadaPara=${unidadExtendida.reservadaPara}, reservadoPara=${unidadExtendida.reservadoPara}, match=${coincide}`);
            return coincide;
          });

          console.log(`[FEFO] Producto ${producto.productoId}: ${unidadesReservadasDB.length} reservadas en DB, ${reservadasParaEstaVenta.length} para esta venta`);

          if (reservadasParaEstaVenta.length > 0) {
            console.log(`[FEFO] Encontradas ${reservadasParaEstaVenta.length} unidades reservadas para producto ${producto.productoId}`);
            unidadesYaReservadas.set(
              producto.productoId,
              reservadasParaEstaVenta.map(u => u.id)
            );
          }
          // NOTA: Fallback eliminado - no tomar unidades reservadas de otras ventas
        }
      }

      // Asignar unidades para cada producto
      for (const producto of venta.productos) {
        let resultado: ResultadoAsignacion;

        // Verificar si ya hay unidades reservadas para este producto
        const unidadesReservadasProducto = unidadesYaReservadas.get(producto.productoId) || [];

        if (unidadesReservadasProducto.length > 0) {
          // Usar las unidades ya reservadas para esta cotización/venta
          resultado = await this.usarUnidadesReservadas(
            producto.productoId,
            producto.cantidad,
            unidadesReservadasProducto
          );
        } else {
          // No hay reservas previas, usar FEFO normal
          resultado = await this.asignarUnidadesFEFO(producto.productoId, producto.cantidad);
        }

        resultados.push(resultado);

        if (resultado.unidadesFaltantes > 0) {
          throw new Error(
            `Stock insuficiente para ${producto.marca} ${producto.nombreComercial}. ` +
            `Faltan ${resultado.unidadesFaltantes} unidades`
          );
        }

        // Calcular costo y margen real
        const costoUnidades = resultado.unidadesAsignadas.reduce((sum, u) => sum + u.ctru, 0);
        const margenReal = ((producto.subtotal - costoUnidades) / producto.subtotal) * 100;

        costoTotalPEN += costoUnidades;

        // Actualizar estado de las unidades a "asignada_pedido"
        for (const unidad of resultado.unidadesAsignadas) {
          const unidadRef = doc(db, 'unidades', unidad.unidadId);
          batch.update(unidadRef, {
            estado: 'asignada_pedido',
            ventaId: id,
            fechaAsignacion: serverTimestamp()
          });
        }

        productosActualizados.push({
          ...producto,
          unidadesAsignadas: resultado.unidadesAsignadas.map(u => u.unidadId),
          costoTotalUnidades: costoUnidades,
          margenReal
        });
      }

      // Calcular rentabilidad total
      const utilidadBrutaPEN = venta.totalPEN - costoTotalPEN;
      const margenPromedio = (utilidadBrutaPEN / venta.totalPEN) * 100;

      // Actualizar venta
      const ventaRef = doc(db, COLLECTION_NAME, id);
      batch.update(ventaRef, {
        estado: 'asignada',
        productos: productosActualizados,
        costoTotalPEN,
        utilidadBrutaPEN,
        margenPromedio,
        stockReservado: null, // Limpiar reserva, ya está asignada
        fechaAsignacion: serverTimestamp(),
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });

      await batch.commit();

      return resultados;
    } catch (error: any) {
      console.error('Error al asignar inventario:', error);
      throw new Error(error.message || 'Error al asignar inventario');
    }
  }

  /**
   * Asignar unidades usando FEFO (First Expire, First Out)
   * El CTRU se calcula en PEN usando:
   * 1. ctruDinamico si ya está calculado (incluye costo base + flete + gastos prorrateados)
   * 2. Si no, (costoUnitarioUSD + costoFleteUSD) × tipoCambio del día
   */
  private static async asignarUnidadesFEFO(
    productoId: string,
    cantidad: number
  ): Promise<ResultadoAsignacion> {
    try {
      // Usar el servicio de unidades que tiene la lógica FEFO implementada
      const seleccionFEFO = await unidadService.seleccionarFEFO(productoId, cantidad);

      // Obtener tipo de cambio del día para conversión USD → PEN
      let tipoCambioVenta = 3.70; // Valor por defecto
      try {
        const tcDelDia = await tipoCambioService.getTCDelDia();
        if (tcDelDia) {
          tipoCambioVenta = tcDelDia.venta;
        }
      } catch (e) {
        console.warn('No se pudo obtener TC del día, usando valor por defecto');
      }

      const asignaciones: AsignacionUnidad[] = seleccionFEFO.map(({ unidad }) => {
        // Calcular CTRU en PEN
        // La unidad puede tener campos extendidos del tipo Unidad de producto.types.ts
        const unidadExtendida = unidad as any;

        let ctruPEN: number;
        if (unidadExtendida.ctruDinamico && unidadExtendida.ctruDinamico > 0) {
          // Ya tiene CTRU calculado en PEN
          ctruPEN = unidadExtendida.ctruDinamico;
        } else {
          // Calcular: (costo compra + flete) × tipo de cambio
          const costoFleteUSD = unidadExtendida.costoFleteUSD || 0;
          const costoTotalUSD = unidad.costoUnitarioUSD + costoFleteUSD;
          // Usar TC de pago si existe, sino TC del día
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
      console.error('Error en FEFO:', error);
      throw error;
    }
  }

  /**
   * Usar unidades ya reservadas para esta venta/cotización
   * Estas unidades ya tienen estado 'reservada' y reservadaPara apuntando a esta venta
   *
   * Si las unidades reservadas no son suficientes, complementa con FEFO de disponibles
   */
  private static async usarUnidadesReservadas(
    productoId: string,
    cantidad: number,
    unidadesReservadasIds: string[]
  ): Promise<ResultadoAsignacion> {
    try {
      // Obtener tipo de cambio del día para conversión USD → PEN
      let tipoCambioVenta = 3.70;
      try {
        const tcDelDia = await tipoCambioService.getTCDelDia();
        if (tcDelDia) {
          tipoCambioVenta = tcDelDia.venta;
        }
      } catch (e) {
        console.warn('No se pudo obtener TC del día, usando valor por defecto');
      }

      const asignaciones: AsignacionUnidad[] = [];

      // Obtener las unidades reservadas
      for (const unidadId of unidadesReservadasIds) {
        if (asignaciones.length >= cantidad) break; // Ya tenemos suficientes

        const unidad = await unidadService.getById(unidadId);
        if (!unidad) {
          console.warn(`Unidad reservada ${unidadId} no encontrada`);
          continue;
        }

        // Verificar que la unidad es del producto correcto y está reservada
        if (unidad.productoId !== productoId) {
          console.warn(`Unidad ${unidadId} no corresponde al producto ${productoId}`);
          continue;
        }

        // Validar estado: debe estar reservada o disponible (para casos de inconsistencia)
        const estadosValidos = ['reservada', 'disponible_peru', 'recibida_usa'];
        if (!estadosValidos.includes(unidad.estado)) {
          console.warn(`Unidad ${unidadId} no está en estado válido para asignar (estado: ${unidad.estado})`);
          continue;
        }

        // Calcular CTRU en PEN
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
        console.log(`[Reserva] Faltan ${faltantes} unidades, buscando con FEFO...`);
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
      console.error('Error usando unidades reservadas:', error);
      throw error;
    }
  }

  /**
   * Completar asignación de un producto específico (asignación parcial tardía)
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

      // Asignar unidades FEFO para la cantidad pendiente
      const resultado = await this.asignarUnidadesFEFO(
        productoId,
        cantidadPendiente
      );

      const batch = writeBatch(db);

      // Actualizar producto en la venta
      const unidadesAsignadasActuales = producto.unidadesAsignadas || [];
      const nuevasUnidades = resultado.unidadesAsignadas.map(u => u.unidadId);
      const todasLasUnidades = [...unidadesAsignadasActuales, ...nuevasUnidades];

      const cantidadAsignadaTotal = (producto.cantidadAsignada || 0) + resultado.cantidadAsignada;
      const cantidadPendienteNueva = producto.cantidad - cantidadAsignadaTotal;
      const estadoAsignacion: EstadoAsignacionProducto =
        cantidadPendienteNueva === 0 ? 'asignado' : 'parcial';

      // Actualizar el producto en el array de productos
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

      // Verificar si todos los productos están completamente asignados
      const todosCompletos = productosActualizados.every(
        p => p.estadoAsignacion === 'asignado'
      );

      // Actualizar venta
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
      console.error('Error completando asignación de producto:', error);
      throw error;
    }
  }

  /**
   * Actualizar fecha estimada de llegada de stock para un producto con asignación parcial
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

      // Actualizar el producto en el array
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

      // Actualizar venta
      const ventaRef = doc(db, COLLECTION_NAME, ventaId);
      await updateDoc(ventaRef, {
        productos: productosActualizados,
        ultimaEdicion: serverTimestamp(),
        ...(userId && { editadoPor: userId })
      });
    } catch (error: any) {
      console.error('Error actualizando fecha estimada:', error);
      throw error;
    }
  }

  /**
   * Registrar entrega parcial de productos
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
      if (!venta) {
        throw new Error('Venta no encontrada');
      }

      if (venta.estado !== 'en_entrega' && venta.estado !== 'despachada' && venta.estado !== 'asignada') {
        throw new Error('Solo se pueden registrar entregas parciales para ventas asignadas o en entrega');
      }

      const batch = writeBatch(db);
      const productosEntregados: Array<{
        productoId: string;
        cantidad: number;
        unidadesIds: string[];
      }> = [];

      // Si no se especifican productos, entregar todos los que tengan unidades asignadas
      const productosAEntregar = datos?.productosAEntregar || venta.productos.map(p => ({
        productoId: p.productoId,
        cantidad: (p.unidadesAsignadas?.length || 0) - (p.cantidadEntregada || 0)
      }));

      // Procesar cada producto a entregar
      for (const { productoId, cantidad } of productosAEntregar) {
        const producto = venta.productos.find(p => p.productoId === productoId);
        if (!producto || !producto.unidadesAsignadas) {
          continue;
        }

        const cantidadYaEntregada = producto.cantidadEntregada || 0;
        const cantidadDisponible = producto.unidadesAsignadas.length - cantidadYaEntregada;
        const cantidadAEntregar = Math.min(cantidad, cantidadDisponible);

        if (cantidadAEntregar <= 0) {
          continue;
        }

        // Obtener las unidades a entregar
        const unidadesAEntregar = producto.unidadesAsignadas.slice(
          cantidadYaEntregada,
          cantidadYaEntregada + cantidadAEntregar
        );

        // Actualizar estado de las unidades a "entregada"
        for (const unidadId of unidadesAEntregar) {
          const unidadRef = doc(db, 'unidades', unidadId);
          batch.update(unidadRef, {
            estado: 'entregada',
            fechaEntrega: serverTimestamp()
          });
        }

        productosEntregados.push({
          productoId,
          cantidad: cantidadAEntregar,
          unidadesIds: unidadesAEntregar
        });
      }

      // Crear registro de entrega parcial
      const entregaParcial: EntregaParcial = {
        id: doc(collection(db, 'entregas_parciales')).id,
        fecha: Timestamp.now(),
        productosEntregados,
        direccionEntrega: datos?.direccionEntrega,
        notasEntrega: datos?.notasEntrega,
        registradoPor: userId
      };

      // Actualizar productos en la venta
      const productosActualizados = venta.productos.map(p => {
        const entregado = productosEntregados.find(pe => pe.productoId === p.productoId);
        if (!entregado) {
          return p;
        }

        const cantidadEntregadaTotal = (p.cantidadEntregada || 0) + entregado.cantidad;
        const cantidadPorEntregar = (p.unidadesAsignadas?.length || 0) - cantidadEntregadaTotal;

        let estadoEntrega: EstadoEntregaProducto = 'pendiente';
        if (cantidadEntregadaTotal > 0 && cantidadPorEntregar > 0) {
          estadoEntrega = 'parcial';
        } else if (cantidadPorEntregar === 0) {
          estadoEntrega = 'entregado';
        }

        return {
          ...p,
          cantidadEntregada: cantidadEntregadaTotal,
          cantidadPorEntregar,
          estadoEntrega
        };
      });

      // Verificar si todos los productos están completamente entregados
      const todosEntregados = productosActualizados.every(
        p => p.estadoEntrega === 'entregado' || !p.unidadesAsignadas?.length
      );

      // Actualizar venta
      const entregasParciales = (venta as any).entregasParciales || [];
      const ventaRef = doc(db, COLLECTION_NAME, id);
      batch.update(ventaRef, {
        productos: productosActualizados,
        entregasParciales: [...entregasParciales, entregaParcial],
        estado: todosEntregados ? 'entregada' : (venta.estado === 'despachada' ? 'despachada' : 'en_entrega'),
        ...(!todosEntregados && venta.estado !== 'en_entrega' && venta.estado !== 'despachada' && { fechaEnEntrega: serverTimestamp() }),
        ...(todosEntregados && { fechaEntrega: serverTimestamp() }),
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });

      await batch.commit();

      return entregaParcial;
    } catch (error: any) {
      console.error('Error registrando entrega parcial:', error);
      throw error;
    }
  }

  /**
   * Marcar como en entrega
   */
  static async marcarEnEntrega(
    id: string,
    userId: string,
    datos?: { direccionEntrega?: string; notasEntrega?: string }
  ): Promise<void> {
    try {
      const venta = await this.getById(id);
      if (!venta) {
        throw new Error('Venta no encontrada');
      }
      
      if (venta.estado !== 'asignada') {
        throw new Error('Solo se puede poner en entrega ventas con inventario asignado');
      }
      
      const updates: any = {
        estado: 'en_entrega',
        fechaEnEntrega: serverTimestamp(),
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      };
      
      if (datos?.direccionEntrega) updates.direccionEntregaFinal = datos.direccionEntrega;
      if (datos?.notasEntrega) updates.notasEntrega = datos.notasEntrega;
      
      await updateDoc(doc(db, COLLECTION_NAME, id), updates);
    } catch (error: any) {
      console.error('Error al marcar en entrega:', error);
      throw new Error(error.message || 'Error al actualizar estado');
    }
  }

  /**
   * Marcar como entregada
   * También completa las entregas pendientes y crea los gastos GD correspondientes
   *
   * FLUJO:
   * 1. Completar entregas pendientes → esto crea GD y actualiza unidades a 'vendida'
   * 2. Si no hay entregas, actualizar unidades directamente a 'vendida'
   * 3. Actualizar estado de la venta
   * 4. Actualizar métricas
   */
  static async marcarEntregada(id: string, userId: string, fechaEntregaReal?: Date): Promise<void> {
    try {
      const venta = await this.getById(id);
      if (!venta) {
        throw new Error('Venta no encontrada');
      }

      if (venta.estado !== 'en_entrega' && venta.estado !== 'despachada' && venta.estado !== 'asignada') {
        throw new Error('Estado inválido para marcar como entregada');
      }

      console.log(`[marcarEntregada] Iniciando para venta ${venta.numeroVenta}`);

      // 1. Completar todas las entregas pendientes de esta venta
      // entregaService.registrarResultado hace:
      // - Actualiza estado de entrega a 'entregada'
      // - Cambia unidades de 'reservada' a 'vendida' via confirmarVentaUnidades
      // - Crea gasto GD automáticamente
      let entregasCompletadas = 0;
      let entregasPendientes: Awaited<ReturnType<typeof entregaService.getByVenta>> = [];

      try {
        const entregas = await entregaService.getByVenta(id);
        entregasPendientes = entregas.filter(
          e => e.estado === 'programada' || e.estado === 'en_camino' || e.estado === 'reprogramada'
        );
        console.log(`[marcarEntregada] Encontradas ${entregasPendientes.length} entregas pendientes`);

        for (const entrega of entregasPendientes) {
          try {
            console.log(`[marcarEntregada] Completando entrega ${entrega.codigo}...`);
            await entregaService.registrarResultado({
              entregaId: entrega.id,
              exitosa: true,
              notasEntrega: 'Completada automáticamente al marcar venta como entregada'
            }, userId);
            entregasCompletadas++;
            console.log(`[marcarEntregada] Entrega ${entrega.codigo} completada OK`);
          } catch (entregaError) {
            console.error(`[marcarEntregada] Error completando entrega ${entrega.codigo}:`, entregaError);
            // Continuamos con las demás entregas
          }
        }
      } catch (entregasError) {
        console.error('[marcarEntregada] Error obteniendo entregas:', entregasError);
      }

      // 2. Si NO había entregas programadas, actualizar las unidades directamente
      // Esto solo ocurre si la venta se asignó pero nunca se programaron entregas
      if (entregasPendientes.length === 0) {
        console.log('[marcarEntregada] No había entregas, actualizando unidades directamente');
        for (const producto of venta.productos) {
          if (producto.unidadesAsignadas && producto.unidadesAsignadas.length > 0) {
            try {
              await unidadService.confirmarVentaUnidades(
                producto.unidadesAsignadas,
                venta.id,
                venta.numeroVenta,
                producto.subtotal || (producto.cantidad * producto.precioUnitario),
                userId
              );
            } catch (error) {
              console.error(`[marcarEntregada] Error confirmando unidades producto ${producto.sku}:`, error);
            }
          }
        }
      }

      // 3. Actualizar estado de la venta
      const ventaRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(ventaRef, {
        estado: 'entregada',
        fechaEntrega: fechaEntregaReal
          ? Timestamp.fromDate(fechaEntregaReal)
          : serverTimestamp(),
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });

      console.log(`[marcarEntregada] Venta ${venta.numeroVenta} marcada como entregada. Entregas completadas: ${entregasCompletadas}`);

      // 4. Reclasificar anticipos: pasivo → ingreso real
      try {
        const reclasificados = await tesoreriaService.reclasificarAnticipos(
          id,
          venta.cotizacionOrigenId,
          userId
        );
        if (reclasificados > 0) {
          console.log(`[marcarEntregada] ${reclasificados} anticipo(s) reclasificados a ingreso_venta`);
        }
      } catch (reclasError) {
        console.warn('[marcarEntregada] Error al reclasificar anticipos:', reclasError);
      }

      // 5. Actualizar métricas del Gestor Maestro (cliente y marcas)
      try {
        const marcaIds = new Map<string, string>();
        for (const producto of venta.productos) {
          const productoCompleto = await ProductoService.getById(producto.productoId);
          if (productoCompleto?.marcaId) {
            marcaIds.set(producto.sku, productoCompleto.marcaId);
          }
        }
        await metricasService.procesarVentaCompleta(venta, marcaIds);
      } catch (metricasError) {
        console.warn('Error al actualizar métricas del Gestor Maestro:', metricasError);
      }
    } catch (error: any) {
      console.error('Error al marcar como entregada:', error);
      throw new Error(error.message || 'Error al actualizar estado');
    }
  }

  /**
   * Cancelar venta
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

      // Si tiene inventario asignado, liberarlo
      if (venta.estado === 'asignada' || venta.estado === 'en_entrega' || venta.estado === 'despachada') {
        for (const producto of venta.productos) {
          if (producto.unidadesAsignadas) {
            for (const unidadId of producto.unidadesAsignadas) {
              const unidadRef = doc(db, 'unidades', unidadId);
              batch.update(unidadRef, {
                estado: 'disponible_peru',
                ventaId: null,
                fechaAsignacion: null
              });
            }
          }
        }
      }

      // Si tiene stock reservado, liberar unidades reservadas
      if (venta.estado === 'reservada' && venta.stockReservado?.productosReservados) {
        for (const prod of venta.stockReservado.productosReservados) {
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

      // Actualizar venta
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

      // Broadcast actividad (fire-and-forget)
      actividadService.registrar({
        tipo: 'venta_cancelada',
        mensaje: `Venta ${venta.numeroVenta} cancelada${motivo ? ': ' + motivo : ''}`,
        userId,
        displayName: userId,
        metadata: { entidadId: id, entidadTipo: 'venta' }
      }).catch(() => {});

      // Cancelar entregas pendientes (operación secundaria, no bloquea la cancelación)
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
          console.log(`[Venta ${venta.numeroVenta}] ${pendientes.length} entrega(s) pendiente(s) cancelada(s)`);
        }
      } catch (entregaError) {
        console.warn(`[Venta ${venta.numeroVenta}] Error al cancelar entregas pendientes (no bloquea):`, entregaError);
      }
    } catch (error: any) {
      console.error('Error al cancelar venta:', error);
      throw new Error(error.message || 'Error al cancelar venta');
    }
  }

  /**
   * Eliminar venta (solo cotizaciones)
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
      console.error('Error al eliminar venta:', error);
      throw new Error(error.message || 'Error al eliminar venta');
    }
  }

  /**
   * Obtener estadísticas
   */
  static async getStats(): Promise<VentaStats> {
    try {
      const ventas = await this.getAll();
      
      const stats: VentaStats = {
        totalVentas: ventas.length,
        cotizaciones: 0,
        confirmadas: 0,
        enProceso: 0,
        entregadas: 0,
        canceladas: 0,
        ventasTotalPEN: 0,
        utilidadTotalPEN: 0,
        margenPromedio: 0,
        ventasML: 0,
        ventasDirecto: 0,
        ventasOtro: 0
      };
      
      let ventasConMargen = 0;
      let sumaMargenPonderado = 0;
      
      ventas.forEach(venta => {
        // Contar por estado
        if (venta.estado === 'cotizacion') stats.cotizaciones++;
        else if (venta.estado === 'confirmada') stats.confirmadas++;
        else if (venta.estado === 'asignada' || venta.estado === 'en_entrega' || venta.estado === 'despachada') stats.enProceso++;
        else if (venta.estado === 'entregada') stats.entregadas++;
        else if (venta.estado === 'cancelada') stats.canceladas++;
        
        // Contar por canal (solo ventas no canceladas)
        if (venta.estado !== 'cancelada' && venta.estado !== 'cotizacion') {
          if (venta.canal === 'mercado_libre') stats.ventasML++;
          else if (venta.canal === 'directo') stats.ventasDirecto++;
          else stats.ventasOtro++;
          
          stats.ventasTotalPEN += venta.totalPEN;
          
          if (venta.utilidadBrutaPEN !== undefined) {
            stats.utilidadTotalPEN += venta.utilidadBrutaPEN;
            ventasConMargen++;
            sumaMargenPonderado += venta.margenPromedio! * venta.totalPEN;
          }
        }
      });
      
      // Calcular margen promedio ponderado
      if (stats.ventasTotalPEN > 0) {
        stats.margenPromedio = sumaMargenPonderado / stats.ventasTotalPEN;
      }
      
      return stats;
    } catch (error: any) {
      console.error('Error al obtener estadísticas:', error);
      throw new Error('Error al generar estadísticas');
    }
  }

  /**
   * Generar número de venta (busca el máximo para evitar duplicados)
   */
  private static async generateNumeroVenta(): Promise<string> {
    try {
      const year = new Date().getFullYear();
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));

      if (snapshot.empty) {
        return `VT-${year}-001`;
      }

      // Buscar el número máximo existente
      let maxNumber = 0;
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data() as Venta;
        const numero = data.numeroVenta;

        // Extraer el número del formato VT-YYYY-NNN
        const match = numero?.match(/VT-\d{4}-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      });

      return `VT-${year}-${(maxNumber + 1).toString().padStart(3, '0')}`;
    } catch (error) {
      return `VT-${new Date().getFullYear()}-001`;
    }
  }

  // ========== MÉTODOS DE PAGO ==========

  /**
   * Registrar un pago para una venta
   * @param ventaId - ID de la venta
   * @param datosPago - Datos del pago incluyendo monto, método y opcionalmente cuenta destino
   * @param userId - ID del usuario que registra el pago
   * @param registrarEnTesoreria - Si true, crea automáticamente un movimiento de ingreso en Tesorería
   */
  static async registrarPago(
    ventaId: string,
    datosPago: {
      monto: number;
      metodoPago: MetodoPago;
      referencia?: string;
      comprobante?: string;
      notas?: string;
      cuentaDestinoId?: string; // ID de la cuenta de tesorería donde se recibe el pago
    },
    userId: string,
    registrarEnTesoreria: boolean = true
  ): Promise<PagoVenta> {
    try {
      const venta = await this.getById(ventaId);
      if (!venta) {
        throw new Error('Venta no encontrada');
      }

      if (venta.estado === 'cancelada') {
        throw new Error('No se puede registrar pago en una venta cancelada');
      }

      if (venta.estado === 'cotizacion') {
        throw new Error('No se puede registrar pago en una cotización. Confirme la venta primero.');
      }

      // Validar monto
      if (datosPago.monto <= 0) {
        throw new Error('El monto debe ser mayor a 0');
      }

      if (datosPago.monto > venta.montoPendiente) {
        throw new Error(
          `El monto excede el saldo pendiente. Pendiente: S/ ${venta.montoPendiente.toFixed(2)}`
        );
      }

      // Crear nuevo pago
      const pagosAnteriores = venta.pagos || [];
      const nuevoPago: PagoVenta = {
        id: `PAG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        monto: datosPago.monto,
        metodoPago: datosPago.metodoPago,
        tipoPago: pagosAnteriores.some(p => p.tipoPago === 'anticipo') ? 'saldo' : 'pago',
        fecha: Timestamp.now(),
        registradoPor: userId
      };

      if (datosPago.referencia) nuevoPago.referencia = datosPago.referencia;
      if (datosPago.comprobante) nuevoPago.comprobante = datosPago.comprobante;
      if (datosPago.notas) nuevoPago.notas = datosPago.notas;

      // Calcular nuevos totales
      const nuevosPagos = [...pagosAnteriores, nuevoPago];
      const nuevoMontoPagado = venta.montoPagado + datosPago.monto;
      const nuevoMontoPendiente = venta.totalPEN - nuevoMontoPagado;

      // Determinar nuevo estado de pago
      let nuevoEstadoPago: EstadoPago;
      if (nuevoMontoPendiente <= 0) {
        nuevoEstadoPago = 'pagado';
      } else if (nuevoMontoPagado > 0) {
        nuevoEstadoPago = 'parcial';
      } else {
        nuevoEstadoPago = 'pendiente';
      }

      // Preparar actualización
      const updates: any = {
        pagos: nuevosPagos,
        montoPagado: nuevoMontoPagado,
        montoPendiente: Math.max(0, nuevoMontoPendiente),
        estadoPago: nuevoEstadoPago,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      };

      // Si se completó el pago, registrar fecha
      if (nuevoEstadoPago === 'pagado') {
        updates.fechaPagoCompleto = serverTimestamp();
      }

      await updateDoc(doc(db, COLLECTION_NAME, ventaId), updates);

      // Registrar movimiento en Tesorería si está habilitado
      if (registrarEnTesoreria) {
        try {
          // Mapear método de pago a método de tesorería
          const metodoTesoreriaMap: Record<MetodoPago, string> = {
            'yape': 'yape',
            'plin': 'plin',
            'efectivo': 'efectivo',
            'transferencia': 'transferencia_bancaria',
            'mercado_pago': 'mercado_pago',
            'tarjeta': 'tarjeta',
            'otro': 'otro',
            'paypal': 'paypal',
            'zelle': 'otro'
          };

          const metodoTesoreria = metodoTesoreriaMap[datosPago.metodoPago] || 'efectivo';

          // Buscar cuenta destino: usar la proporcionada o buscar por método de pago
          let cuentaDestinoId = datosPago.cuentaDestinoId;
          if (!cuentaDestinoId) {
            const cuentaPorDefecto = await tesoreriaService.getCuentaPorMetodoPago(
              metodoTesoreria as any,
              'PEN'
            );
            cuentaDestinoId = cuentaPorDefecto?.id;
          }

          // Obtener TC actual
          let tipoCambio = 3.70;
          try {
            const tcDelDia = await tipoCambioService.getTCDelDia();
            if (tcDelDia) tipoCambio = tcDelDia.venta;
          } catch (e) {
            console.warn('No se pudo obtener TC del día, usando valor por defecto');
          }

          // Crear movimiento de ingreso en tesorería
          await tesoreriaService.registrarMovimiento(
            {
              tipo: 'ingreso_venta',
              moneda: 'PEN',
              monto: datosPago.monto,
              tipoCambio,
              metodo: metodoTesoreria as any,
              concepto: `Pago de venta ${venta.numeroVenta}`,
              fecha: new Date(),
              referencia: datosPago.referencia,
              notas: datosPago.notas || `Pago registrado desde venta. Cliente: ${venta.nombreCliente}`,
              ventaId: ventaId,
              ventaNumero: venta.numeroVenta,
              cuentaDestino: cuentaDestinoId
            },
            userId
          );

          // Guardar referencia del movimiento en el pago
          nuevoPago.tesoreriaMovimientoId = 'registrado';
        } catch (tesoreriaError: any) {
          // No fallar el pago si hay error en tesorería, solo loguear
          console.error('Error registrando en tesorería (el pago fue registrado):', tesoreriaError);
        }
      }

      return nuevoPago;
    } catch (error: any) {
      console.error('Error al registrar pago:', error);
      throw new Error(error.message || 'Error al registrar pago');
    }
  }

  /**
   * Eliminar un pago registrado
   */
  static async eliminarPago(ventaId: string, pagoId: string, userId: string): Promise<void> {
    try {
      const venta = await this.getById(ventaId);
      if (!venta) {
        throw new Error('Venta no encontrada');
      }

      if (venta.estado === 'entregada') {
        throw new Error('No se pueden eliminar pagos de ventas entregadas');
      }

      const pagos = venta.pagos || [];
      const pagoIndex = pagos.findIndex(p => p.id === pagoId);

      if (pagoIndex === -1) {
        throw new Error('Pago no encontrado');
      }

      const pagoEliminado = pagos[pagoIndex];
      const nuevosPagos = pagos.filter(p => p.id !== pagoId);
      const nuevoMontoPagado = venta.montoPagado - pagoEliminado.monto;
      const nuevoMontoPendiente = venta.totalPEN - nuevoMontoPagado;

      // Determinar nuevo estado de pago
      let nuevoEstadoPago: EstadoPago;
      if (nuevoMontoPagado <= 0) {
        nuevoEstadoPago = 'pendiente';
      } else if (nuevoMontoPendiente > 0) {
        nuevoEstadoPago = 'parcial';
      } else {
        nuevoEstadoPago = 'pagado';
      }

      const updates: any = {
        pagos: nuevosPagos,
        montoPagado: Math.max(0, nuevoMontoPagado),
        montoPendiente: nuevoMontoPendiente,
        estadoPago: nuevoEstadoPago,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      };

      // Limpiar fecha de pago completo si ya no está pagado
      if (nuevoEstadoPago !== 'pagado') {
        updates.fechaPagoCompleto = null;
      }

      await updateDoc(doc(db, COLLECTION_NAME, ventaId), updates);
    } catch (error: any) {
      console.error('Error al eliminar pago:', error);
      throw new Error(error.message || 'Error al eliminar pago');
    }
  }

  /**
   * Obtener ventas por estado de pago
   */
  static async getByEstadoPago(estadoPago: EstadoPago): Promise<Venta[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('estadoPago', '==', estadoPago),
        orderBy('fechaCreacion', 'desc')
      );

      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Venta));
    } catch (error: any) {
      console.error('Error al obtener ventas por estado de pago:', error);
      throw new Error('Error al cargar ventas');
    }
  }

  /**
   * Obtener ventas con pagos pendientes
   */
  static async getVentasPendientesPago(): Promise<Venta[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('estadoPago', 'in', ['pendiente', 'parcial']),
        where('estado', '!=', 'cancelada'),
        orderBy('estado'),
        orderBy('fechaCreacion', 'desc')
      );

      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Venta));
    } catch (error: any) {
      console.error('Error al obtener ventas pendientes de pago:', error);
      throw new Error('Error al cargar ventas');
    }
  }

  /**
   * Obtener resumen de pagos
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
      const ventasActivas = ventas.filter(v => v.estado !== 'cancelada' && v.estado !== 'cotizacion');

      const ahora = new Date();
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

      let totalPorCobrar = 0;
      let ventasPendientes = 0;
      let ventasParciales = 0;
      let ventasPagadas = 0;
      let cobranzaMesActual = 0;

      ventasActivas.forEach(venta => {
        totalPorCobrar += venta.montoPendiente || 0;

        if (venta.estadoPago === 'pendiente') ventasPendientes++;
        else if (venta.estadoPago === 'parcial') ventasParciales++;
        else if (venta.estadoPago === 'pagado') ventasPagadas++;

        // Sumar pagos del mes actual
        if (venta.pagos) {
          venta.pagos.forEach(pago => {
            const fechaPago = pago.fecha.toDate();
            if (fechaPago >= inicioMes) {
              cobranzaMesActual += pago.monto;
            }
          });
        }
      });

      return {
        totalPorCobrar,
        ventasPendientes,
        ventasParciales,
        ventasPagadas,
        cobranzaMesActual
      };
    } catch (error: any) {
      console.error('Error al obtener resumen de pagos:', error);
      throw new Error('Error al generar resumen');
    }
  }

  // ========== PRE-VENTA CON RESERVA DE STOCK ==========

  /**
   * Registrar adelanto y crear reserva de stock (física o virtual)
   *
   * Esta función permite:
   * 1. Si hay stock disponible → Reserva FÍSICA (bloquea unidades reales)
   * 2. Si NO hay stock → Reserva VIRTUAL (registra la intención de venta)
   * 3. Híbrido: Reserva física de lo disponible + virtual del faltante
   *
   * @param cotizacionId ID de la cotización
   * @param adelanto Datos del adelanto (monto, método de pago, etc.)
   * @param userId ID del usuario
   * @param horasVigencia Horas de vigencia de la reserva (default: 48)
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
      // 1. Obtener la venta/cotización
      const venta = await this.getById(cotizacionId);
      if (!venta) {
        throw new Error('Venta/Cotización no encontrada');
      }

      const estadosPermitidos: EstadoVenta[] = ['cotizacion', 'confirmada'];
      if (!estadosPermitidos.includes(venta.estado)) {
        throw new Error('Solo se pueden procesar cotizaciones o ventas confirmadas. Estado actual: ' + venta.estado);
      }

      const esVentaDirecta = venta.estado === 'confirmada';

      // 2. Validar monto de adelanto
      if (adelanto.monto <= 0) {
        throw new Error('El monto del adelanto debe ser mayor a 0');
      }

      if (adelanto.monto > venta.totalPEN) {
        throw new Error('El adelanto no puede ser mayor al total de la venta');
      }

      const batch = writeBatch(db);
      const productosReservados: ProductoReservado[] = [];
      const productosVirtuales: ProductoStockVirtual[] = [];
      let tieneStockFisico = false;
      let tieneFaltantes = false;

      // 3. Para cada producto, verificar stock y clasificar
      for (const producto of venta.productos) {
        const nombreProducto = `${producto.marca} ${producto.nombreComercial}`;

        // Intentar obtener unidades disponibles usando FEFO
        let unidadesDisponibles: Array<{ unidad: Unidad; orden: number }> = [];
        try {
          unidadesDisponibles = await unidadService.seleccionarFEFO(
            producto.productoId,
            producto.cantidad
          );
        } catch (e) {
          // Si no hay stock, seleccionarFEFO puede fallar o retornar array vacío
          unidadesDisponibles = [];
        }

        const cantidadDisponible = unidadesDisponibles.length;
        const cantidadRequerida = producto.cantidad;
        const cantidadFaltante = cantidadRequerida - cantidadDisponible;

        if (cantidadDisponible > 0) {
          tieneStockFisico = true;

          // Reservar las unidades físicas disponibles
          const unidadesAReservar = unidadesDisponibles.slice(0, cantidadRequerida);
          const unidadesIds: string[] = [];

          for (const { unidad } of unidadesAReservar) {
            // Marcar unidad como reservada
            const unidadRef = doc(db, 'unidades', unidad.id);
            batch.update(unidadRef, {
              estado: 'reservada',
              reservadoPara: cotizacionId,
              fechaReserva: serverTimestamp()
            });
            unidadesIds.push(unidad.id);
          }

          productosReservados.push({
            productoId: producto.productoId,
            sku: producto.sku,
            cantidad: unidadesAReservar.length,
            unidadesReservadas: unidadesIds
          });
        }

        // Si hay faltantes, crear registro virtual
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

          // Si no había stock disponible, crear un registro de reserva virtual
          if (cantidadDisponible === 0) {
            productosReservados.push({
              productoId: producto.productoId,
              sku: producto.sku,
              cantidad: cantidadRequerida,
              unidadesReservadas: [] // Vacío = reserva virtual
            });
          }
        }
      }

      // 4. Determinar tipo de reserva
      let tipoReserva: TipoReserva;
      if (tieneStockFisico && !tieneFaltantes) {
        tipoReserva = 'fisica';
      } else if (!tieneStockFisico && tieneFaltantes) {
        tipoReserva = 'virtual';
      } else {
        // Híbrido: tiene algo de stock pero faltan productos
        tipoReserva = 'virtual'; // Lo tratamos como virtual porque requiere acciones
      }

      // 5. Crear el pago de adelanto
      const pagoAdelanto: PagoVenta = {
        id: `ADL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tipoPago: 'anticipo',
        monto: adelanto.monto,
        metodoPago: adelanto.metodoPago,
        fecha: Timestamp.now(),
        registradoPor: userId,
        notas: `Adelanto para reserva de stock (${tipoReserva})`
      };
      // Agregar referencia solo si existe (Firestore no acepta undefined)
      if (adelanto.referencia) {
        pagoAdelanto.referencia = adelanto.referencia;
      }

      // 6. Calcular vigencia de la reserva
      const ahora = new Date();
      const vigenciaHasta = new Date(ahora.getTime() + horasVigencia * 60 * 60 * 1000);

      // 7. Crear estructura de StockReservado
      const stockReservado: StockReservado = {
        activo: true,
        tipoReserva,
        fechaReserva: Timestamp.now(),
        vigenciaHasta: Timestamp.fromDate(vigenciaHasta),
        horasVigenciaOriginal: horasVigencia,
        adelantoId: pagoAdelanto.id,
        montoAdelanto: adelanto.monto,
        productosReservados
      };

      // Si hay productos virtuales, agregarlos
      if (productosVirtuales.length > 0) {
        stockReservado.stockVirtual = {
          productosVirtuales
        };
      }

      // 8. Actualizar la venta/cotización
      const ventaRef = doc(db, COLLECTION_NAME, cotizacionId);

      // Construir objeto de actualización sin valores undefined (Firestore no los acepta)
      const updateData: Record<string, any> = {
        estado: 'reservada',
        stockReservado,
        pagos: [pagoAdelanto],
        montoPagado: adelanto.monto,
        montoPendiente: venta.totalPEN - adelanto.monto,
        estadoPago: adelanto.monto >= venta.totalPEN ? 'pagado' : 'parcial',
        requiereStock: tieneFaltantes,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      };

      // Solo agregar estadoCotizacion para cotizaciones (no ventas directas)
      if (!esVentaDirecta) {
        updateData.estadoCotizacion = 'con_abono' as EstadoCotizacion;
      }

      // Solo agregar productosConFaltante si hay productos virtuales
      if (productosVirtuales.length > 0) {
        updateData.productosConFaltante = productosVirtuales.map(p => ({
          nombre: p.nombreProducto,
          disponibles: p.cantidadDisponible,
          solicitados: p.cantidadRequerida
        }));
      } else {
        // Limpiar el campo si no hay faltantes (usar null, no undefined)
        updateData.productosConFaltante = null;
      }

      batch.update(ventaRef, updateData);

      // 9. Ejecutar todas las actualizaciones
      await batch.commit();

      // 10. Registrar movimiento de tesorería para el anticipo
      const metodoTesoreriaMap: Record<string, string> = {
        'yape': 'yape', 'plin': 'plin', 'efectivo': 'efectivo',
        'transferencia': 'transferencia_bancaria', 'mercado_pago': 'mercado_pago',
        'tarjeta': 'tarjeta', 'paypal': 'paypal', 'zelle': 'otro', 'otro': 'otro'
      };

      let tipoCambio = 3.70;
      try {
        const tcDelDia = await tipoCambioService.getTCDelDia();
        if (tcDelDia) tipoCambio = tcDelDia.venta;
      } catch { /* usar fallback */ }

      let cuentaDestinoId = adelanto.cuentaDestinoId;
      if (!cuentaDestinoId) {
        const metodoTes = metodoTesoreriaMap[adelanto.metodoPago] || 'efectivo';
        const cuentaPorDefecto = await tesoreriaService.getCuentaPorMetodoPago(metodoTes as any, 'PEN');
        if (cuentaPorDefecto) {
          cuentaDestinoId = cuentaPorDefecto.id;
        } else {
          console.warn(`No se encontró cuenta por defecto para método "${metodoTes}". El movimiento se registrará sin cuenta destino.`);
        }
      }

      await tesoreriaService.registrarMovimiento({
        tipo: 'ingreso_anticipo',
        moneda: 'PEN',
        monto: adelanto.monto,
        tipoCambio,
        metodo: (metodoTesoreriaMap[adelanto.metodoPago] || 'efectivo') as any,
        concepto: `Adelanto con reserva - ${venta.numeroVenta} - ${venta.nombreCliente}`,
        fecha: new Date(),
        referencia: adelanto.referencia,
        ventaId: cotizacionId,
        ventaNumero: venta.numeroVenta,
        cuentaDestino: cuentaDestinoId
      }, userId);

      // 11. Crear notificación si es reserva virtual
      if (tipoReserva === 'virtual') {
        // Notificar que se necesita stock
        console.log(`[Reserva Virtual] Cotización ${venta.numeroVenta} requiere stock adicional`);
        // La notificación se disparará cuando llegue stock al sistema
      }

      return {
        tipoReserva,
        productosReservados,
        productosVirtuales: productosVirtuales.length > 0 ? productosVirtuales : undefined,
        pagoRegistrado: pagoAdelanto,
        requerimientoId: stockReservado.stockVirtual?.requerimientoGenerado
      };
    } catch (error: any) {
      console.error('Error al registrar adelanto con reserva:', error);
      throw new Error(error.message || 'Error al procesar el adelanto');
    }
  }

  /**
   * Extender vigencia de una reserva
   */
  static async extenderReserva(
    ventaId: string,
    horasAdicionales: number,
    motivo: string,
    userId: string
  ): Promise<void> {
    try {
      const venta = await this.getById(ventaId);
      if (!venta) {
        throw new Error('Venta no encontrada');
      }

      if (venta.estado !== 'reservada' || !venta.stockReservado?.activo) {
        throw new Error('No hay una reserva activa para extender');
      }

      const extensiones = venta.stockReservado.extensiones || [];
      if (extensiones.length >= 3) {
        throw new Error('Se ha alcanzado el límite máximo de 3 extensiones');
      }

      const vigenciaActual = venta.stockReservado.vigenciaHasta.toDate();
      const nuevaVigencia = new Date(vigenciaActual.getTime() + horasAdicionales * 60 * 60 * 1000);

      const nuevaExtension = {
        fecha: Timestamp.now(),
        horasExtendidas: horasAdicionales,
        nuevaVigencia: Timestamp.fromDate(nuevaVigencia),
        motivo,
        extendidoPor: userId
      };

      await updateDoc(doc(db, COLLECTION_NAME, ventaId), {
        'stockReservado.vigenciaHasta': Timestamp.fromDate(nuevaVigencia),
        'stockReservado.extensiones': [...extensiones, nuevaExtension],
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });
    } catch (error: any) {
      console.error('Error al extender reserva:', error);
      throw new Error(error.message || 'Error al extender reserva');
    }
  }

  /**
   * Cancelar una reserva y liberar el stock
   */
  static async cancelarReserva(ventaId: string, userId: string, motivo?: string): Promise<void> {
    try {
      const venta = await this.getById(ventaId);
      if (!venta) {
        throw new Error('Venta no encontrada');
      }

      if (venta.estado !== 'reservada') {
        throw new Error('Solo se pueden cancelar ventas en estado reservada');
      }

      const batch = writeBatch(db);

      // Liberar unidades físicas reservadas
      if (venta.stockReservado?.productosReservados) {
        for (const prod of venta.stockReservado.productosReservados) {
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

      // Actualizar venta a cotización (vuelve al estado anterior)
      const updates: any = {
        estado: 'cotizacion',
        stockReservado: null,
        requiereStock: null,
        productosConFaltante: null,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      };

      if (motivo) {
        updates.observaciones = venta.observaciones
          ? `${venta.observaciones}\n\nRESERVA CANCELADA: ${motivo}`
          : `RESERVA CANCELADA: ${motivo}`;
      }

      const ventaRef = doc(db, COLLECTION_NAME, ventaId);
      batch.update(ventaRef, updates);

      await batch.commit();
    } catch (error: any) {
      console.error('Error al cancelar reserva:', error);
      throw new Error(error.message || 'Error al cancelar reserva');
    }
  }

  /**
   * Verificar reservas próximas a vencer y crear notificaciones
   * Esta función debería ejecutarse periódicamente (ej: cada hora)
   */
  static async verificarReservasPorVencer(): Promise<void> {
    try {
      const ventas = await this.getByEstado('reservada');
      const ahora = new Date();
      const limiteHoras = 12; // Notificar 12 horas antes

      for (const venta of ventas) {
        if (!venta.stockReservado?.activo) continue;

        const vigenciaHasta = venta.stockReservado.vigenciaHasta.toDate();
        const horasRestantes = (vigenciaHasta.getTime() - ahora.getTime()) / (1000 * 60 * 60);

        if (horasRestantes > 0 && horasRestantes <= limiteHoras) {
          // Verificar si ya existe una notificación activa
          const existeNotificacion = await NotificationService.existeNotificacionActiva(
            venta.id,
            'reserva_por_vencer'
          );

          if (!existeNotificacion) {
            await NotificationService.notificarReservaPorVencer({
              ventaId: venta.id,
              numeroVenta: venta.numeroVenta,
              nombreCliente: venta.nombreCliente,
              horasRestantes: Math.round(horasRestantes),
              vigenciaHasta: venta.stockReservado.vigenciaHasta
            });
          }
        }
      }
    } catch (error: any) {
      console.error('Error al verificar reservas por vencer:', error);
    }
  }

  /**
   * Verificar si hay stock disponible para ventas con reserva virtual
   * Esta función debería ejecutarse cuando se recibe nuevo stock
   */
  static async verificarStockParaReservasVirtuales(productoId: string): Promise<void> {
    try {
      // Obtener ventas con reserva virtual que incluyen este producto
      const ventas = await this.getByEstado('reservada');

      for (const venta of ventas) {
        if (venta.stockReservado?.tipoReserva !== 'virtual') continue;
        if (!venta.stockReservado?.stockVirtual?.productosVirtuales) continue;

        const productoVirtual = venta.stockReservado.stockVirtual.productosVirtuales
          .find(p => p.productoId === productoId);

        if (!productoVirtual) continue;

        // Verificar stock disponible actual
        const inventario = await inventarioService.getInventarioProducto(productoId);
        const disponiblesEnPeru = inventario
          .filter(inv => inv.pais === 'Peru')
          .reduce((sum, inv) => sum + inv.disponibles, 0);

        if (disponiblesEnPeru > 0) {
          // Verificar si ya existe una notificación
          const existeNotificacion = await NotificationService.existeNotificacionActiva(
            venta.id,
            'stock_disponible'
          );

          if (!existeNotificacion) {
            const producto = await ProductoService.getById(productoId);
            await NotificationService.notificarStockDisponible({
              ventaId: venta.id,
              numeroVenta: venta.numeroVenta,
              nombreCliente: venta.nombreCliente,
              productos: [{
                productoId,
                nombre: `${producto?.marca} ${producto?.nombreComercial}`,
                cantidadDisponible: Math.min(disponiblesEnPeru, productoVirtual.cantidadFaltante),
                cantidadRequerida: productoVirtual.cantidadFaltante
              }]
            });
          }
        }
      }
    } catch (error: any) {
      console.error('Error al verificar stock para reservas virtuales:', error);
    }
  }

  /**
   * Convertir reserva virtual a física cuando hay stock disponible
   */
  static async asignarStockAReservaVirtual(
    ventaId: string,
    userId: string
  ): Promise<{ asignados: number; faltantes: number }> {
    try {
      const venta = await this.getById(ventaId);
      if (!venta) {
        throw new Error('Venta no encontrada');
      }

      if (venta.estado !== 'reservada') {
        throw new Error('La venta no está en estado reservada');
      }

      if (venta.stockReservado?.tipoReserva !== 'virtual') {
        throw new Error('La venta no tiene una reserva virtual');
      }

      const batch = writeBatch(db);
      let totalAsignados = 0;
      let totalFaltantes = 0;
      const nuevosProductosReservados: ProductoReservado[] = [];
      const nuevosProductosVirtuales: ProductoStockVirtual[] = [];

      // Procesar productos con faltantes
      for (const productoVirtual of venta.stockReservado.stockVirtual?.productosVirtuales || []) {
        // Intentar obtener unidades disponibles
        let unidadesDisponibles: Array<{ unidad: Unidad; orden: number }> = [];
        try {
          unidadesDisponibles = await unidadService.seleccionarFEFO(
            productoVirtual.productoId,
            productoVirtual.cantidadFaltante
          );
        } catch (e) {
          unidadesDisponibles = [];
        }

        const cantidadAsignada = Math.min(unidadesDisponibles.length, productoVirtual.cantidadFaltante);
        const nuevasFaltantes = productoVirtual.cantidadFaltante - cantidadAsignada;

        if (cantidadAsignada > 0) {
          const unidadesIds: string[] = [];

          for (let i = 0; i < cantidadAsignada; i++) {
            const { unidad } = unidadesDisponibles[i];
            const unidadRef = doc(db, 'unidades', unidad.id);
            batch.update(unidadRef, {
              estado: 'reservada',
              reservadoPara: ventaId,
              fechaReserva: serverTimestamp()
            });
            unidadesIds.push(unidad.id);
          }

          nuevosProductosReservados.push({
            productoId: productoVirtual.productoId,
            sku: productoVirtual.sku,
            cantidad: cantidadAsignada,
            unidadesReservadas: unidadesIds
          });

          totalAsignados += cantidadAsignada;
        }

        if (nuevasFaltantes > 0) {
          nuevosProductosVirtuales.push({
            ...productoVirtual,
            cantidadDisponible: productoVirtual.cantidadDisponible + cantidadAsignada,
            cantidadFaltante: nuevasFaltantes
          });
          totalFaltantes += nuevasFaltantes;
        }
      }

      // Combinar con productos ya reservados físicamente
      const productosReservadosExistentes = venta.stockReservado.productosReservados
        .filter(p => p.unidadesReservadas.length > 0);

      const todosProductosReservados = [
        ...productosReservadosExistentes,
        ...nuevosProductosReservados
      ];

      // Determinar nuevo tipo de reserva
      const nuevoTipoReserva: TipoReserva = totalFaltantes > 0 ? 'virtual' : 'fisica';

      // Actualizar stockReservado
      const nuevoStockReservado: StockReservado = {
        ...venta.stockReservado,
        tipoReserva: nuevoTipoReserva,
        productosReservados: todosProductosReservados,
        stockVirtual: totalFaltantes > 0
          ? { productosVirtuales: nuevosProductosVirtuales }
          : undefined
      };

      // Actualizar venta
      const ventaRef = doc(db, COLLECTION_NAME, ventaId);
      batch.update(ventaRef, {
        stockReservado: nuevoStockReservado,
        requiereStock: totalFaltantes > 0,
        productosConFaltante: totalFaltantes > 0
          ? nuevosProductosVirtuales.map(p => ({
              nombre: p.nombreProducto,
              disponibles: p.cantidadDisponible,
              solicitados: p.cantidadRequerida
            }))
          : null,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });

      await batch.commit();

      return {
        asignados: totalAsignados,
        faltantes: totalFaltantes
      };
    } catch (error: any) {
      console.error('Error al asignar stock a reserva virtual:', error);
      throw new Error(error.message || 'Error al asignar stock');
    }
  }

  /**
   * Sincronizar adelanto desde cotización de origen
   * Útil para corregir ventas creadas antes de la corrección del flujo de adelantos
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

      // Verificar si ya tiene el adelanto transferido
      const ventaExtendida = venta as any;
      if (ventaExtendida.adelantoComprometido?.transferidoComoPago === true) {
        return { sincronizado: false, mensaje: 'El adelanto ya fue transferido previamente' };
      }

      // Verificar si tiene cotización de origen
      const cotizacionOrigenId = ventaExtendida.cotizacionOrigenId;
      if (!cotizacionOrigenId) {
        return { sincronizado: false, mensaje: 'La venta no tiene cotización de origen' };
      }

      // Obtener la cotización de origen
      const cotizacionDoc = await getDoc(doc(db, 'cotizaciones', cotizacionOrigenId));
      if (!cotizacionDoc.exists()) {
        return { sincronizado: false, mensaje: 'Cotización de origen no encontrada' };
      }

      const cotizacion = { id: cotizacionDoc.id, ...cotizacionDoc.data() } as any;

      // Verificar si la cotización tiene adelanto
      if (!cotizacion.adelanto || cotizacion.adelanto.monto <= 0) {
        return { sincronizado: false, mensaje: 'La cotización no tiene adelanto registrado' };
      }

      // Calcular el monto en PEN
      const montoAdelantoPEN = cotizacion.adelanto.montoEquivalentePEN ||
        cotizacion.adelanto.monto * (cotizacion.adelanto.tipoCambio || 1);

      // Crear el pago desde el adelanto
      const pagoAdelanto: PagoVenta = {
        id: `ADL-SYNC-${Date.now()}`,
        monto: montoAdelantoPEN,
        metodoPago: cotizacion.adelanto.metodoPago || 'efectivo',
        fecha: cotizacion.adelanto.fecha || Timestamp.now(),
        registradoPor: userId,
        notas: `Adelanto sincronizado desde cotización ${cotizacion.numeroCotizacion} (corrección)`
      };

      if (cotizacion.adelanto.referencia) {
        pagoAdelanto.referencia = cotizacion.adelanto.referencia;
      }

      // Calcular nuevos totales
      const pagosExistentes = venta.pagos || [];
      const nuevosPagos = [...pagosExistentes, pagoAdelanto];
      const nuevoMontoPagado = venta.montoPagado + montoAdelantoPEN;
      const nuevoMontoPendiente = venta.totalPEN - nuevoMontoPagado;
      const nuevoEstadoPago = nuevoMontoPendiente <= 0 ? 'pagado' :
        nuevoMontoPagado > 0 ? 'parcial' : 'pendiente';

      // Construir objeto adelantoComprometido evitando valores undefined
      const adelantoComprometidoData: Record<string, any> = {
        monto: cotizacion.adelanto.monto,
        metodoPago: cotizacion.adelanto.metodoPago,
        fechaCompromiso: cotizacion.adelanto.fecha || Timestamp.now(),
        desdeCotizacion: cotizacion.numeroCotizacion,
        montoEquivalentePEN: montoAdelantoPEN,
        transferidoComoPago: true,
        sincronizadoEn: serverTimestamp()
      };

      // Solo agregar campos opcionales si tienen valor
      if (cotizacion.adelanto.moneda) {
        adelantoComprometidoData.moneda = cotizacion.adelanto.moneda;
      }
      if (cotizacion.adelanto.tipoCambio) {
        adelantoComprometidoData.tipoCambio = cotizacion.adelanto.tipoCambio;
      }

      // Actualizar la venta
      await updateDoc(doc(db, COLLECTION_NAME, ventaId), {
        pagos: nuevosPagos,
        montoPagado: nuevoMontoPagado,
        montoPendiente: Math.max(0, nuevoMontoPendiente),
        estadoPago: nuevoEstadoPago,
        adelantoComprometido: adelantoComprometidoData,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });

      console.log(`[Sync Adelanto] Venta ${venta.numeroVenta}: S/${montoAdelantoPEN.toFixed(2)} sincronizado desde ${cotizacion.numeroCotizacion}`);

      return {
        sincronizado: true,
        montoAdelanto: montoAdelantoPEN,
        mensaje: `Adelanto de S/${montoAdelantoPEN.toFixed(2)} sincronizado correctamente`
      };
    } catch (error: any) {
      console.error('Error al sincronizar adelanto:', error);
      return { sincronizado: false, mensaje: `Error: ${error.message}` };
    }
  }

  /**
   * Sincronizar todos los adelantos pendientes de ventas que vienen de cotizaciones
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

        // Solo procesar ventas con cotización de origen y sin adelanto ya transferido
        if (!ventaExtendida.cotizacionOrigenId) continue;
        if (ventaExtendida.adelantoComprometido?.transferidoComoPago === true) continue;

        const resultado = await this.sincronizarAdelantoDesdeCotizacion(venta.id, userId);

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
      console.error('Error al sincronizar adelantos pendientes:', error);
      throw new Error(`Error al sincronizar adelantos: ${error.message}`);
    }
  }

  /**
   * Obtener historial financiero de un cliente
   * Busca ventas por clienteId o por nombre del cliente
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
      // Obtener el cliente para saber sus datos
      const { clienteService } = await import('./cliente.service');
      const cliente = await clienteService.getById(clienteId);

      if (!cliente) {
        console.log(`[getHistorialFinancieroCliente] Cliente ${clienteId} no encontrado`);
        throw new Error('Cliente no encontrado');
      }

      console.log(`[getHistorialFinancieroCliente] Buscando ventas para: ${cliente.nombre}`);
      console.log(`[getHistorialFinancieroCliente] DNI/RUC: ${cliente.dniRuc}, Tel: ${cliente.telefono}`);

      // Buscar ventas por múltiples criterios
      const todasVentas = await this.getAll();
      const nombreClienteNorm = cliente.nombre?.toLowerCase().trim();
      const telefonoCliente = cliente.telefono?.replace(/\D/g, '');
      const telefonoAlt = cliente.telefonoAlt?.replace(/\D/g, '');
      const dniRucCliente = cliente.dniRuc?.trim();

      console.log(`[getHistorialFinancieroCliente] Total ventas en sistema: ${todasVentas.length}`);

      const ventas = todasVentas.filter(v => {
        // 1. Por clienteId ya asignado
        if (v.clienteId === clienteId) {
          console.log(`[getHistorialFinancieroCliente] Match por clienteId: ${v.numeroVenta}`);
          return true;
        }

        // 2. Por DNI/RUC exacto (más confiable)
        if (dniRucCliente && v.dniRuc?.trim() === dniRucCliente) {
          console.log(`[getHistorialFinancieroCliente] Match por DNI/RUC: ${v.numeroVenta}`);
          return true;
        }

        // 3. Por teléfono (últimos 9 dígitos)
        const telVenta = v.telefonoCliente?.replace(/\D/g, '');
        if (telVenta && telefonoCliente) {
          const ultimos9Venta = telVenta.slice(-9);
          const ultimos9Cliente = telefonoCliente.slice(-9);
          if (ultimos9Venta.length >= 7 && ultimos9Venta === ultimos9Cliente) {
            console.log(`[getHistorialFinancieroCliente] Match por teléfono: ${v.numeroVenta} (${telVenta})`);
            return true;
          }
        }
        if (telVenta && telefonoAlt) {
          const ultimos9Venta = telVenta.slice(-9);
          const ultimos9Alt = telefonoAlt.slice(-9);
          if (ultimos9Venta.length >= 7 && ultimos9Venta === ultimos9Alt) {
            console.log(`[getHistorialFinancieroCliente] Match por teléfono alt: ${v.numeroVenta}`);
            return true;
          }
        }

        // 4. Por nombre exacto (normalizado)
        const nombreVentaNorm = v.nombreCliente?.toLowerCase().trim();
        if (nombreVentaNorm && nombreClienteNorm && nombreVentaNorm === nombreClienteNorm) {
          console.log(`[getHistorialFinancieroCliente] Match por nombre: ${v.numeroVenta} (${v.nombreCliente})`);
          return true;
        }

        return false;
      });

      console.log(`[getHistorialFinancieroCliente] Cliente ${cliente.nombre}: ${ventas.length} ventas encontradas`);

      // Ordenar por fecha descendente
      ventas.sort((a, b) => {
        const fechaA = a.fechaCreacion?.toDate?.() || new Date(a.fechaCreacion as any);
        const fechaB = b.fechaCreacion?.toDate?.() || new Date(b.fechaCreacion as any);
        return fechaB.getTime() - fechaA.getTime();
      });

      // Calcular resumen
      const ventasNoCancel = ventas.filter(v => v.estado !== 'cancelada');
      const ventasCompletadas = ventas.filter(v => v.estado === 'entregada').length;
      const ventasPendientes = ventas.filter(v => ['cotizacion', 'confirmada', 'asignada', 'en_entrega', 'despachada'].includes(v.estado)).length;
      const ventasCanceladas = ventas.filter(v => v.estado === 'cancelada').length;

      const totalVendidoPEN = ventasNoCancel.reduce((sum, v) => sum + (v.totalPEN || 0), 0);
      const totalCobradoPEN = ventasNoCancel.reduce((sum, v) => sum + (v.montoPagado || 0), 0);
      const totalPendientePEN = ventasNoCancel.reduce((sum, v) => sum + (v.montoPendiente || 0), 0);

      const ticketPromedio = ventasNoCancel.length > 0 ? totalVendidoPEN / ventasNoCancel.length : 0;

      // Obtener fechas
      let ultimaCompra: Date | undefined;
      let primeraCompra: Date | undefined;

      if (ventas.length > 0) {
        const fechas = ventas
          .map(v => v.fechaCreacion?.toDate?.() || new Date(v.fechaCreacion as any))
          .filter(f => f instanceof Date && !isNaN(f.getTime()))
          .sort((a, b) => b.getTime() - a.getTime());

        if (fechas.length > 0) {
          ultimaCompra = fechas[0];
          primeraCompra = fechas[fechas.length - 1];
        }
      }

      // Separar por cobrar y cobradas
      const porCobrar = ventas.filter(v =>
        v.estado !== 'cancelada' &&
        (v.estadoPago === 'pendiente' || v.estadoPago === 'parcial')
      );

      const cobradas = ventas.filter(v =>
        v.estado !== 'cancelada' &&
        v.estadoPago === 'pagado'
      );

      return {
        ventas,
        resumen: {
          totalVentas: ventas.length,
          ventasCompletadas,
          ventasPendientes,
          ventasCanceladas,
          totalVendidoPEN,
          totalCobradoPEN,
          totalPendientePEN,
          ticketPromedio,
          ultimaCompra,
          primeraCompra
        },
        porCobrar,
        cobradas
      };
    } catch (error: any) {
      console.error('Error al obtener historial financiero del cliente:', error);
      // Retornar estructura vacía en caso de error
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

  /**
   * Corregir el precio de un producto en una venta ya completada.
   * Propaga cambios a: venta (totales, márgenes, pagos), entregas y tesorería.
   */
  static async corregirPrecioProducto(
    ventaId: string,
    productoId: string,
    nuevoPrecioUnitario: number,
    userId: string
  ): Promise<{ cambios: string[] }> {
    const cambios: string[] = [];

    // 1. Obtener venta actual
    const venta = await this.getById(ventaId);
    if (!venta) throw new Error('Venta no encontrada');

    // 2. Encontrar el producto y calcular nuevos valores
    const productoIndex = venta.productos.findIndex(p => p.productoId === productoId);
    if (productoIndex === -1) throw new Error('Producto no encontrado en la venta');

    const producto = venta.productos[productoIndex];
    const precioAnterior = producto.precioUnitario;
    if (precioAnterior === nuevoPrecioUnitario) {
      return { cambios: ['Sin cambios - el precio es el mismo'] };
    }

    const nuevoSubtotalProducto = producto.cantidad * nuevoPrecioUnitario;
    const diferenciaProducto = nuevoSubtotalProducto - producto.subtotal;

    // 3. Recalcular totales de la venta
    const nuevoSubtotalPEN = venta.subtotalPEN + diferenciaProducto;
    const descuento = venta.descuento || 0;
    const costoEnvio = venta.incluyeEnvio ? 0 : (venta.costoEnvio || 0);
    const nuevoTotalPEN = nuevoSubtotalPEN - descuento + costoEnvio;

    // 4. Actualizar producto en el array
    const productosActualizados = [...venta.productos];
    productosActualizados[productoIndex] = {
      ...producto,
      precioUnitario: nuevoPrecioUnitario,
      subtotal: nuevoSubtotalProducto,
      margenReal: producto.costoTotalUnidades
        ? ((nuevoSubtotalProducto - producto.costoTotalUnidades) / nuevoSubtotalProducto) * 100
        : producto.margenReal
    };

    // 5. Recalcular márgenes de la venta
    const costoTotalPEN = venta.costoTotalPEN || 0;
    const gastosVentaPEN = venta.gastosVentaPEN || 0;
    const utilidadBrutaPEN = nuevoTotalPEN - costoTotalPEN;
    const utilidadNetaPEN = utilidadBrutaPEN - gastosVentaPEN;
    const margenBruto = nuevoTotalPEN > 0 ? (utilidadBrutaPEN / nuevoTotalPEN) * 100 : 0;
    const margenNeto = nuevoTotalPEN > 0 ? (utilidadNetaPEN / nuevoTotalPEN) * 100 : 0;

    // 6. Recalcular estado de pago
    const montoPagado = venta.montoPagado || 0;
    const nuevoMontoPendiente = nuevoTotalPEN - montoPagado;
    let nuevoEstadoPago: EstadoPago;
    if (nuevoMontoPendiente <= 0) {
      nuevoEstadoPago = 'pagado';
    } else if (montoPagado > 0) {
      nuevoEstadoPago = 'parcial';
    } else {
      nuevoEstadoPago = 'pendiente';
    }

    // 7. Recalcular estado de pago (pagos NO se modifican, representan dinero realmente recibido)
    const pagos = venta.pagos || [];

    const nuevoMontoPagadoFinal = pagos.reduce((sum, p) => sum + p.monto, 0);
    const nuevoMontoPendienteFinal = nuevoTotalPEN - nuevoMontoPagadoFinal;
    let estadoPagoFinal: EstadoPago;
    if (nuevoMontoPendienteFinal <= 0) {
      estadoPagoFinal = 'pagado';
    } else if (nuevoMontoPagadoFinal > 0) {
      estadoPagoFinal = 'parcial';
    } else {
      estadoPagoFinal = 'pendiente';
    }

    // 8. Actualizar documento de la venta
    const ventaUpdates: Record<string, any> = {
      productos: productosActualizados,
      subtotalPEN: nuevoSubtotalPEN,
      totalPEN: nuevoTotalPEN,
      montoPagado: nuevoMontoPagadoFinal,
      montoPendiente: Math.max(0, nuevoMontoPendienteFinal),
      estadoPago: estadoPagoFinal,
      utilidadBrutaPEN,
      utilidadNetaPEN,
      margenBruto,
      margenNeto,
      margenPromedio: margenBruto,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    };

    // Manejar sobrepago
    if (nuevoMontoPendienteFinal < 0) {
      ventaUpdates.saldoAFavor = Math.abs(nuevoMontoPendienteFinal);
      ventaUpdates.tieneSobrepago = true;
    } else {
      ventaUpdates.saldoAFavor = 0;
      ventaUpdates.tieneSobrepago = false;
    }

    await updateDoc(doc(db, COLLECTION_NAME, ventaId), ventaUpdates);
    cambios.push(`Venta: Total S/ ${venta.totalPEN.toFixed(2)} → S/ ${nuevoTotalPEN.toFixed(2)}`);
    cambios.push(`Producto: Precio S/ ${precioAnterior.toFixed(2)} → S/ ${nuevoPrecioUnitario.toFixed(2)}`);

    // 9. Actualizar entregas asociadas
    try {
      const entregas = await entregaService.getByVenta(ventaId);
      for (const entrega of entregas) {
        const productoEntrega = entrega.productos.find(p => p.productoId === productoId);
        if (productoEntrega) {
          const nuevosProductosEntrega = entrega.productos.map(p => {
            if (p.productoId === productoId) {
              return {
                ...p,
                precioUnitario: nuevoPrecioUnitario,
                subtotal: p.cantidad * nuevoPrecioUnitario
              };
            }
            return p;
          });
          const nuevoSubtotalEntrega = nuevosProductosEntrega.reduce((sum, p) => sum + p.subtotal, 0);

          const entregaUpdates: Record<string, any> = {
            productos: nuevosProductosEntrega,
            subtotalPEN: nuevoSubtotalEntrega
          };
          // Si tenía montoPorCobrar igual al subtotal anterior, actualizar también
          if (entrega.montoPorCobrar && entrega.montoPorCobrar === entrega.subtotalPEN) {
            entregaUpdates.montoPorCobrar = nuevoSubtotalEntrega;
          }

          await updateDoc(doc(db, 'entregas', entrega.id), entregaUpdates);
          cambios.push(`Entrega ${entrega.codigo}: Subtotal S/ ${entrega.subtotalPEN.toFixed(2)} → S/ ${nuevoSubtotalEntrega.toFixed(2)}`);
        }
      }
    } catch (err) {
      console.error('Error actualizando entregas:', err);
      cambios.push('Entregas: Error al actualizar (revisar manualmente)');
    }

    // 10. Actualizar movimiento de tesorería (buscar por ventaId o cotizacionId)
    try {
      const movimientos = await tesoreriaService.getMovimientos({});
      const movimientosVenta = movimientos.filter(
        m => (m.ventaId === ventaId || (venta.cotizacionOrigenId && m.cotizacionId === venta.cotizacionOrigenId)) &&
          (m.tipo === 'ingreso_venta' || m.tipo === 'ingreso_anticipo') && m.estado === 'ejecutado'
      );

      if (movimientosVenta.length === 1 && movimientosVenta[0].monto === venta.totalPEN) {
        await tesoreriaService.actualizarMovimiento(
          movimientosVenta[0].id,
          { monto: nuevoTotalPEN },
          userId
        );
        cambios.push(`Tesorería: Movimiento actualizado S/ ${venta.totalPEN.toFixed(2)} → S/ ${nuevoTotalPEN.toFixed(2)}`);
      } else if (movimientosVenta.length > 1) {
        cambios.push(`Tesorería: Múltiples movimientos encontrados (${movimientosVenta.length}), revisar manualmente`);
      } else if (movimientosVenta.length === 0) {
        cambios.push('Tesorería: No se encontró movimiento asociado');
      } else {
        cambios.push(`Tesorería: Movimiento tiene monto diferente (S/ ${movimientosVenta[0].monto.toFixed(2)}), no se actualizó`);
      }
    } catch (err) {
      console.error('Error actualizando tesorería:', err);
      cambios.push('Tesorería: Error al actualizar (revisar manualmente)');
    }

    return { cambios };
  }

  // ========== EDICIÓN GENERAL DE VENTA ==========

  /**
   * Editar una venta: productos (precio/cantidad), costos, datos de cliente, observaciones.
   * Respeta restricciones por estado y propaga cambios a entregas y tesorería.
   */
  static async editarVenta(
    ventaId: string,
    cambios: EditarVentaData,
    userId: string
  ): Promise<{ cambios: string[] }> {
    const log: string[] = [];

    // 1. Obtener venta actual
    const venta = await this.getById(ventaId);
    if (!venta) throw new Error('Venta no encontrada');

    // 2. Validar estado
    const estadosTerminales = ['entregada', 'cancelada', 'devuelta', 'devolucion_parcial'];
    if (estadosTerminales.includes(venta.estado)) {
      throw new Error(`No se puede editar una venta en estado "${venta.estado}"`);
    }

    const esEstadoTemprano = ['cotizacion', 'confirmada'].includes(venta.estado);
    const updates: Record<string, any> = {};

    // 3. Aplicar cambios de productos
    if (cambios.productos && cambios.productos.length > 0) {
      const productosActualizados = [...venta.productos];

      for (const cp of cambios.productos) {
        const idx = productosActualizados.findIndex(p => p.productoId === cp.productoId);
        if (idx === -1) continue;

        const prod = productosActualizados[idx];

        // Validar cantidad solo editable en estados tempranos
        if (cp.cantidad !== prod.cantidad && !esEstadoTemprano) {
          throw new Error(`No se puede cambiar cantidad en estado "${venta.estado}" (unidades ya asignadas)`);
        }

        const cambiosProd: string[] = [];
        if (cp.precioUnitario !== prod.precioUnitario) {
          cambiosProd.push(`precio S/ ${prod.precioUnitario.toFixed(2)} → S/ ${cp.precioUnitario.toFixed(2)}`);
        }
        if (cp.cantidad !== prod.cantidad) {
          cambiosProd.push(`cantidad ${prod.cantidad} → ${cp.cantidad}`);
        }

        if (cambiosProd.length > 0) {
          const nuevoSubtotal = cp.cantidad * cp.precioUnitario;
          productosActualizados[idx] = {
            ...prod,
            precioUnitario: cp.precioUnitario,
            cantidad: cp.cantidad,
            subtotal: nuevoSubtotal,
            ...(prod.costoTotalUnidades && {
              margenReal: ((nuevoSubtotal - prod.costoTotalUnidades) / nuevoSubtotal) * 100
            })
          };
          log.push(`${prod.marca} ${prod.nombreComercial}: ${cambiosProd.join(', ')}`);
        }
      }

      updates.productos = productosActualizados;
    }

    // 4. Aplicar cambios financieros
    if (cambios.costoEnvio !== undefined && cambios.costoEnvio !== (venta.costoEnvio || 0)) {
      log.push(`Costo envío: S/ ${(venta.costoEnvio || 0).toFixed(2)} → S/ ${cambios.costoEnvio.toFixed(2)}`);
      updates.costoEnvio = cambios.costoEnvio;
    }
    if (cambios.descuento !== undefined && cambios.descuento !== (venta.descuento || 0)) {
      log.push(`Descuento: S/ ${(venta.descuento || 0).toFixed(2)} → S/ ${cambios.descuento.toFixed(2)}`);
      updates.descuento = cambios.descuento;
    }
    if (cambios.incluyeEnvio !== undefined && cambios.incluyeEnvio !== venta.incluyeEnvio) {
      log.push(`Envío gratis: ${venta.incluyeEnvio ? 'Sí' : 'No'} → ${cambios.incluyeEnvio ? 'Sí' : 'No'}`);
      updates.incluyeEnvio = cambios.incluyeEnvio;
    }

    // 5. Aplicar cambios de cliente (solo en estados tempranos)
    if (esEstadoTemprano) {
      const camposCliente: Array<{ key: keyof EditarVentaData; ventaKey: string; label: string }> = [
        { key: 'nombreCliente', ventaKey: 'nombreCliente', label: 'Cliente' },
        { key: 'telefonoCliente', ventaKey: 'telefonoCliente', label: 'Teléfono' },
        { key: 'emailCliente', ventaKey: 'emailCliente', label: 'Email' },
        { key: 'direccionEntrega', ventaKey: 'direccionEntrega', label: 'Dirección' },
        { key: 'distrito', ventaKey: 'distrito', label: 'Distrito' },
        { key: 'provincia', ventaKey: 'provincia', label: 'Provincia' },
        { key: 'codigoPostal', ventaKey: 'codigoPostal', label: 'Código postal' },
        { key: 'referencia', ventaKey: 'referencia', label: 'Referencia' },
        { key: 'dniRuc', ventaKey: 'dniRuc', label: 'DNI/RUC' },
      ];

      for (const campo of camposCliente) {
        const nuevoValor = cambios[campo.key] as string | undefined;
        if (nuevoValor !== undefined && nuevoValor !== ((venta as any)[campo.ventaKey] || '')) {
          updates[campo.ventaKey] = nuevoValor;
          log.push(`${campo.label} actualizado`);
        }
      }
    }

    // 6. Aplicar observaciones
    if (cambios.observaciones !== undefined && cambios.observaciones !== (venta.observaciones || '')) {
      updates.observaciones = cambios.observaciones;
      log.push('Observaciones actualizadas');
    }

    // Si no hay cambios reales, salir
    if (log.length === 0) {
      return { cambios: ['Sin cambios'] };
    }

    // 7. Recalcular totales
    const productosFinales = updates.productos || venta.productos;
    const nuevoSubtotalPEN = productosFinales.reduce((sum: number, p: ProductoVenta) => sum + p.subtotal, 0);
    const descuento = updates.descuento ?? venta.descuento ?? 0;
    const costoEnvio = (updates.incluyeEnvio ?? venta.incluyeEnvio) ? 0 : (updates.costoEnvio ?? venta.costoEnvio ?? 0);
    const nuevoTotalPEN = nuevoSubtotalPEN - descuento + costoEnvio;

    updates.subtotalPEN = nuevoSubtotalPEN;
    updates.totalPEN = nuevoTotalPEN;

    // 8. Recalcular márgenes
    const costoTotalPEN = venta.costoTotalPEN || 0;
    const gastosVentaPEN = venta.gastosVentaPEN || 0;
    const utilidadBrutaPEN = nuevoTotalPEN - costoTotalPEN;
    const utilidadNetaPEN = utilidadBrutaPEN - gastosVentaPEN;
    updates.utilidadBrutaPEN = utilidadBrutaPEN;
    updates.utilidadNetaPEN = utilidadNetaPEN;
    updates.margenBruto = nuevoTotalPEN > 0 ? (utilidadBrutaPEN / nuevoTotalPEN) * 100 : 0;
    updates.margenNeto = nuevoTotalPEN > 0 ? (utilidadNetaPEN / nuevoTotalPEN) * 100 : 0;
    updates.margenPromedio = updates.margenBruto;

    // 9. Recalcular estado de pago (pagos NO se modifican, representan dinero realmente recibido)
    const pagos = venta.pagos || [];

    const montoPagadoFinal = pagos.reduce((sum, p) => sum + p.monto, 0);
    const montoPendienteFinal = nuevoTotalPEN - montoPagadoFinal;

    updates.montoPagado = montoPagadoFinal;
    updates.montoPendiente = Math.max(0, montoPendienteFinal);
    updates.estadoPago = montoPendienteFinal <= 0 ? 'pagado' : montoPagadoFinal > 0 ? 'parcial' : 'pendiente';

    // Sobrepago
    if (montoPendienteFinal < 0) {
      updates.saldoAFavor = Math.abs(montoPendienteFinal);
      updates.tieneSobrepago = true;
    } else {
      updates.saldoAFavor = 0;
      updates.tieneSobrepago = false;
    }

    // 10. Audit
    updates.ultimaEdicion = serverTimestamp();
    updates.editadoPor = userId;

    if (nuevoTotalPEN !== venta.totalPEN) {
      log.push(`Total: S/ ${venta.totalPEN.toFixed(2)} → S/ ${nuevoTotalPEN.toFixed(2)}`);
    }

    // 11. Guardar
    await updateDoc(doc(db, COLLECTION_NAME, ventaId), updates);

    // 12. Cascade a entregas (si cambió algún producto)
    if (updates.productos && nuevoTotalPEN !== venta.totalPEN) {
      try {
        const entregas = await entregaService.getByVenta(ventaId);
        for (const entrega of entregas) {
          const nuevosProductosEntrega = entrega.productos.map(pe => {
            const productoActualizado = (updates.productos as ProductoVenta[]).find(
              p => p.productoId === pe.productoId
            );
            if (productoActualizado && (pe.precioUnitario !== productoActualizado.precioUnitario)) {
              return {
                ...pe,
                precioUnitario: productoActualizado.precioUnitario,
                subtotal: pe.cantidad * productoActualizado.precioUnitario
              };
            }
            return pe;
          });
          const nuevoSubtotalEntrega = nuevosProductosEntrega.reduce((sum, p) => sum + p.subtotal, 0);

          const entregaUpdates: Record<string, any> = {
            productos: nuevosProductosEntrega,
            subtotalPEN: nuevoSubtotalEntrega
          };
          if (entrega.montoPorCobrar && entrega.montoPorCobrar === entrega.subtotalPEN) {
            entregaUpdates.montoPorCobrar = nuevoSubtotalEntrega;
          }
          await updateDoc(doc(db, 'entregas', entrega.id), entregaUpdates);
          log.push(`Entrega ${entrega.codigo} actualizada`);
        }
      } catch (err) {
        console.error('Error actualizando entregas:', err);
        log.push('Entregas: revisar manualmente');
      }
    }

    // 13. Cascade a tesorería (si cambió el total)
    if (nuevoTotalPEN !== venta.totalPEN) {
      try {
        const movimientos = await tesoreriaService.getMovimientos({});
        // Buscar movimientos vinculados por ventaId O por cotizacionId (adelantos desde cotización)
        const movimientosVenta = movimientos.filter(
          m => (m.ventaId === ventaId || (venta.cotizacionOrigenId && m.cotizacionId === venta.cotizacionOrigenId)) &&
            (m.tipo === 'ingreso_venta' || m.tipo === 'ingreso_anticipo') && m.estado === 'ejecutado'
        );

        if (movimientosVenta.length === 1 && movimientosVenta[0].monto === venta.totalPEN) {
          await tesoreriaService.actualizarMovimiento(
            movimientosVenta[0].id,
            { monto: nuevoTotalPEN },
            userId
          );
          log.push(`Tesorería actualizada`);
        } else if (movimientosVenta.length === 1) {
          // Monto no coincide exactamente con total anterior — puede ser un adelanto parcial
          log.push(`Tesorería: movimiento con monto diferente (S/ ${movimientosVenta[0].monto.toFixed(2)}), revisar manualmente`);
        } else if (movimientosVenta.length > 1) {
          log.push(`Tesorería: ${movimientosVenta.length} movimientos, revisar manualmente`);
        }
      } catch (err) {
        console.error('Error actualizando tesorería:', err);
        log.push('Tesorería: revisar manualmente');
      }
    }

    // 14. Actividad
    actividadService.registrar({
      tipo: 'venta_confirmada' as any, // edición de venta
      mensaje: `Venta ${venta.numeroVenta} editada: ${log.join(', ')}`,
      userId,
      displayName: userId,
      metadata: { entidadId: ventaId, entidadTipo: 'venta' }
    }).catch(() => {});

    return { cambios: log };
  }

  // ========== DIAGNÓSTICO Y CORRECCIÓN DE ASIGNACIONES FEFO ==========

  /**
   * Diagnosticar ventas que fueron asignadas incorrectamente por el bug FEFO.
   * Detecta ventas con cotizacionOrigenId que todavía tienen unidades huérfanas
   * en estado 'reservada' con reservadaPara = cotizacionOrigenId.
   *
   * Esto indica que FEFO asignó unidades disponibles en lugar de las reservadas.
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
      corregible: boolean; // true si estado permite corrección automática
    }>;
    resumen: {
      total: number;
      corregibles: number;
      soloReporte: number;
    };
  }> {
    console.log('[DIAG-FEFO] Iniciando diagnóstico de asignaciones FEFO...');

    // 1. Buscar ventas en estados que podrían estar afectados (ya asignadas)
    const estadosConAsignacion: EstadoVenta[] = ['asignada', 'en_entrega', 'despachada', 'entrega_parcial', 'entregada'];
    const ventasAfectadas: Array<any> = [];

    for (const estado of estadosConAsignacion) {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('estado', '==', estado)
      );
      const snap = await getDocs(q);

      for (const docSnap of snap.docs) {
        const venta = { id: docSnap.id, ...docSnap.data() } as any;

        // Solo nos interesan ventas que vinieron de cotización (tienen reservas)
        if (!venta.cotizacionOrigenId) continue;

        const productosAfectados: Array<any> = [];

        for (const producto of (venta.productos || [])) {
          // Buscar unidades todavía en estado 'reservada' para esta cotización
          const unidadesReservadasDB = await unidadService.buscar({
            productoId: producto.productoId,
            estado: 'reservada'
          });

          // Filtrar las que son para esta cotización/venta
          const huerfanas = unidadesReservadasDB.filter(u => {
            const ext = u as any;
            const refs = [ext.reservadaPara, ext.reservadoPara].filter(Boolean);
            return refs.some((ref: string) =>
              ref === venta.id || ref === venta.cotizacionOrigenId
            );
          });

          if (huerfanas.length > 0) {
            productosAfectados.push({
              productoId: producto.productoId,
              sku: producto.sku,
              nombre: `${producto.marca} ${producto.nombreComercial}`,
              cantidadVenta: producto.cantidad,
              unidadesAsignadasActuales: producto.unidadesAsignadas || [],
              unidadesReservadasHuerfanas: huerfanas.map(u => u.id),
            });
          }
        }

        if (productosAfectados.length > 0) {
          // Corregible si no está entregada (entregada requiere más cuidado)
          const corregible = ['asignada', 'en_entrega', 'despachada', 'entrega_parcial'].includes(venta.estado);
          ventasAfectadas.push({
            ventaId: venta.id,
            numeroVenta: venta.numeroVenta,
            estado: venta.estado,
            cotizacionOrigenId: venta.cotizacionOrigenId,
            cliente: venta.nombreCliente,
            productos: productosAfectados,
            corregible,
          });
        }
      }
    }

    const corregibles = ventasAfectadas.filter(v => v.corregible).length;
    const resumen = {
      total: ventasAfectadas.length,
      corregibles,
      soloReporte: ventasAfectadas.length - corregibles,
    };

    console.log(`[DIAG-FEFO] Diagnóstico completado:`);
    console.log(`  - Ventas afectadas: ${resumen.total}`);
    console.log(`  - Corregibles automáticamente: ${resumen.corregibles}`);
    console.log(`  - Solo reporte (entregadas): ${resumen.soloReporte}`);

    for (const v of ventasAfectadas) {
      console.log(`  [${v.corregible ? 'CORREGIBLE' : 'REPORTE'}] ${v.numeroVenta} (${v.estado}) - ${v.cliente}`);
      for (const p of v.productos) {
        console.log(`    - ${p.sku}: ${p.unidadesReservadasHuerfanas.length} unidades huérfanas, ${p.unidadesAsignadasActuales.length} asignadas actualmente`);
      }
    }

    return { ventasAfectadas, resumen };
  }

  /**
   * Corregir una venta específica que fue mal asignada por el bug FEFO.
   *
   * Para cada producto afectado:
   * 1. Libera las unidades FEFO incorrectamente asignadas → disponible_peru
   * 2. Asigna las unidades reservadas correctas → asignada_pedido
   * 3. Recalcula costos y márgenes de la venta
   *
   * Solo funciona para ventas en estado: asignada, en_entrega, entrega_parcial
   */
  static async corregirAsignacionFEFO(
    ventaId: string,
    userId: string
  ): Promise<{
    corregido: boolean;
    cambios: string[];
  }> {
    const cambios: string[] = [];
    const ventaDoc = await getDoc(doc(db, COLLECTION_NAME, ventaId));
    if (!ventaDoc.exists()) {
      throw new Error(`Venta ${ventaId} no encontrada`);
    }

    const venta = { id: ventaDoc.id, ...ventaDoc.data() } as any;
    const estadosCorregibles = ['asignada', 'en_entrega', 'despachada', 'entrega_parcial'];

    if (!estadosCorregibles.includes(venta.estado)) {
      throw new Error(`Venta ${venta.numeroVenta} en estado '${venta.estado}' no es corregible automáticamente`);
    }

    if (!venta.cotizacionOrigenId) {
      throw new Error(`Venta ${venta.numeroVenta} no tiene cotizacionOrigenId`);
    }

    console.log(`[CORR-FEFO] Corrigiendo ${venta.numeroVenta} (${venta.estado})...`);

    // Obtener TC del día para recalcular costos
    let tipoCambioVenta = 3.70;
    try {
      const tcDelDia = await tipoCambioService.getTCDelDia();
      if (tcDelDia) tipoCambioVenta = tcDelDia.venta;
    } catch (_e) { /* usar default */ }

    const productosActualizados = [...venta.productos];
    let costoTotalPEN = 0;
    let huboCorrecciones = false;

    for (let i = 0; i < productosActualizados.length; i++) {
      const producto = productosActualizados[i];

      // Buscar unidades huérfanas reservadas para esta cotización/venta
      const unidadesReservadasDB = await unidadService.buscar({
        productoId: producto.productoId,
        estado: 'reservada'
      });

      const huerfanas = unidadesReservadasDB.filter(u => {
        const ext = u as any;
        const refs = [ext.reservadaPara, ext.reservadoPara].filter(Boolean);
        return refs.some((ref: string) =>
          ref === ventaId || ref === venta.cotizacionOrigenId
        );
      });

      if (huerfanas.length === 0) {
        // Este producto no tiene unidades huérfanas, mantener asignación actual
        costoTotalPEN += producto.costoTotalUnidades || 0;
        continue;
      }

      huboCorrecciones = true;
      const asignadasActuales = producto.unidadesAsignadas || [];

      // Determinar qué unidades FEFO incorrectas liberar
      // Solo liberamos las que NO son de la reserva original
      const idsHuerfanas = new Set(huerfanas.map(u => u.id));
      const idsALiberar = asignadasActuales.filter((id: string) => !idsHuerfanas.has(id));

      console.log(`[CORR-FEFO] Producto ${producto.sku}:`);
      console.log(`  - Asignadas actuales: ${asignadasActuales.length}`);
      console.log(`  - Huérfanas encontradas: ${huerfanas.length}`);
      console.log(`  - A liberar: ${idsALiberar.length}`);

      // Crear batch para las operaciones de unidades
      const batch = writeBatch(db);

      // 1. Liberar unidades FEFO incorrectas → disponible_peru
      for (const unidadId of idsALiberar) {
        const unidadRef = doc(db, 'unidades', unidadId);
        batch.update(unidadRef, {
          estado: 'disponible_peru',
          ventaId: null,
          fechaAsignacion: null,
          actualizadoPor: userId,
          fechaActualizacion: serverTimestamp()
        });
        cambios.push(`Liberada unidad ${unidadId} → disponible_peru`);
      }

      // 2. Asignar unidades reservadas correctas → asignada_pedido
      const nuevasAsignaciones: AsignacionUnidad[] = [];
      const cantidadNecesaria = producto.cantidad;
      let asignadas = 0;

      for (const unidad of huerfanas) {
        if (asignadas >= cantidadNecesaria) break;

        const unidadRef = doc(db, 'unidades', unidad.id);
        batch.update(unidadRef, {
          estado: 'asignada_pedido',
          ventaId: ventaId,
          fechaAsignacion: serverTimestamp(),
          actualizadoPor: userId,
          fechaActualizacion: serverTimestamp()
        });

        // Calcular CTRU
        const ext = unidad as any;
        let ctruPEN: number;
        if (ext.ctruDinamico && ext.ctruDinamico > 0) {
          ctruPEN = ext.ctruDinamico;
        } else {
          const costoFleteUSD = ext.costoFleteUSD || 0;
          const costoTotalUSD = unidad.costoUnitarioUSD + costoFleteUSD;
          const tcAplicable = ext.tcPago || ext.tcCompra || tipoCambioVenta;
          ctruPEN = costoTotalUSD * tcAplicable;
        }

        nuevasAsignaciones.push({
          unidadId: unidad.id,
          productoId: unidad.productoId,
          sku: unidad.productoSKU,
          codigoUnidad: `${unidad.ordenCompraNumero}-${unidad.id.slice(-3)}`,
          ctru: ctruPEN,
          fechaVencimiento: unidad.fechaVencimiento
        });

        asignadas++;
        cambios.push(`Asignada unidad reservada ${unidad.id} → asignada_pedido`);
      }

      await batch.commit();

      // 3. Reconstruir lista de unidades asignadas del producto
      // Mantener las que NO fueron liberadas + agregar las nuevas
      const idsLiberados = new Set(idsALiberar);
      const idsMantenidos = asignadasActuales.filter((id: string) => !idsLiberados.has(id));
      const nuevosIds = nuevasAsignaciones.map(a => a.unidadId);
      const todosIds = [...idsMantenidos, ...nuevosIds];

      // Recalcular costo para TODAS las unidades del producto (mantenidas + nuevas)
      let costoProducto = 0;
      // Costo de las nuevas asignaciones
      costoProducto += nuevasAsignaciones.reduce((sum, a) => sum + a.ctru, 0);
      // Costo de las unidades mantenidas (necesitamos obtenerlas)
      for (const uid of idsMantenidos) {
        const unidad = await unidadService.getById(uid);
        if (unidad) {
          const ext = unidad as any;
          if (ext.ctruDinamico && ext.ctruDinamico > 0) {
            costoProducto += ext.ctruDinamico;
          } else {
            const costoFleteUSD = ext.costoFleteUSD || 0;
            const costoTotalUSD = unidad.costoUnitarioUSD + costoFleteUSD;
            const tcAplicable = ext.tcPago || ext.tcCompra || tipoCambioVenta;
            costoProducto += costoTotalUSD * tcAplicable;
          }
        }
      }

      const margenReal = producto.subtotal > 0
        ? ((producto.subtotal - costoProducto) / producto.subtotal) * 100
        : 0;

      productosActualizados[i] = {
        ...producto,
        unidadesAsignadas: todosIds,
        costoTotalUnidades: costoProducto,
        margenReal,
      };

      costoTotalPEN += costoProducto;

      cambios.push(`Producto ${producto.sku}: ${idsALiberar.length} liberadas, ${nuevasAsignaciones.length} reservadas asignadas, costo: S/ ${costoProducto.toFixed(2)}`);
    }

    if (!huboCorrecciones) {
      cambios.push('No se encontraron productos con unidades huérfanas para corregir');
      return { corregido: false, cambios };
    }

    // 4. Actualizar la venta con los productos corregidos
    const utilidadBrutaPEN = venta.totalPEN - costoTotalPEN;
    const margenPromedio = venta.totalPEN > 0 ? (utilidadBrutaPEN / venta.totalPEN) * 100 : 0;

    await updateDoc(doc(db, COLLECTION_NAME, ventaId), {
      productos: productosActualizados,
      costoTotalPEN,
      utilidadBrutaPEN,
      margenPromedio,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId,
    });

    cambios.push(`Venta ${venta.numeroVenta} actualizada: Costo S/ ${costoTotalPEN.toFixed(2)}, Margen ${margenPromedio.toFixed(1)}%`);

    console.log(`[CORR-FEFO] Corrección completada para ${venta.numeroVenta}:`);
    cambios.forEach(c => console.log(`  - ${c}`));

    return { corregido: true, cambios };
  }

  // ========== MIGRACIÓN: CORREGIR CANALES ==========

  /**
   * Corregir canales de ventas existentes:
   * 1. Ventas con canal='directo' que tienen clienteId → busca el canal real del cliente
   * 2. Todas las ventas sin canalNombre → resuelve y guarda el nombre legible
   */
  static async corregirCanalesVentas(): Promise<{
    corregidas: number;
    nombreAsignado: number;
    sinCambio: number;
    detalle: string[];
  }> {
    // Mapeo de strings legacy → nombre oficial
    const LEGACY_CANAL_NAMES: Record<string, string> = {
      mercado_libre: 'Mercado Libre',
      mercadolibre: 'Mercado Libre',
      directo: 'Directo',
      'venta directa': 'Venta Directa',
      otro: 'Otro'
    };

    // Strings legacy que deben corregirse al ID de entidad correspondiente
    const LEGACY_STRINGS_TO_FIX = new Set([
      'mercadolibre', 'mercado_libre', 'directo', 'otro', 'venta directa'
    ]);

    console.log('[CORREGIR-CANALES] Iniciando corrección...');

    // 1. Cargar canales de venta (id → {nombre, id})
    const canalesSnap = await getDocs(collection(db, 'canalesVenta'));
    const canalesById = new Map<string, { id: string; nombre: string }>();
    const canalesByNombre = new Map<string, { id: string; nombre: string }>();
    canalesSnap.forEach(d => {
      const data = d.data();
      const entry = { id: d.id, nombre: data.nombre };
      canalesById.set(d.id, entry);
      if (data.codigo) canalesById.set(data.codigo, entry);
      // Indexar por nombre normalizado para resolver legacy strings
      canalesByNombre.set(data.nombre.toLowerCase(), entry);
    });

    // 2. Cargar clientes (id → canalPrincipalActual/canalOrigen)
    const clientesSnap = await getDocs(collection(db, 'clientes'));
    const clientesCanal = new Map<string, string>();
    clientesSnap.forEach(d => {
      const data = d.data();
      const canal = data.canalPrincipalActual || data.canalOrigen;
      if (canal) clientesCanal.set(d.id, canal);
    });

    // 3. Obtener todas las ventas
    const ventas = await this.getAll();

    let corregidas = 0;
    let nombreAsignado = 0;
    let sinCambio = 0;
    const detalle: string[] = [];

    // Resolver un string legacy a entidad real (id + nombre)
    const resolverCanalEntidad = (canal: string): { id: string; nombre: string } | null => {
      // Buscar directamente por ID/codigo
      const byId = canalesById.get(canal);
      if (byId) return byId;
      // Buscar por nombre legacy → nombre oficial → entidad
      const nombreOficial = LEGACY_CANAL_NAMES[canal.toLowerCase()];
      if (nombreOficial) {
        const byNombre = canalesByNombre.get(nombreOficial.toLowerCase());
        if (byNombre) return byNombre;
      }
      // Buscar directamente por nombre
      const byNombreDirecto = canalesByNombre.get(canal.toLowerCase());
      if (byNombreDirecto) return byNombreDirecto;
      return null;
    };

    // Resolver solo nombre
    const resolverNombre = (canal: string): string => {
      const entidad = resolverCanalEntidad(canal);
      if (entidad) return entidad.nombre;
      if (LEGACY_CANAL_NAMES[canal.toLowerCase()]) return LEGACY_CANAL_NAMES[canal.toLowerCase()];
      return canal;
    };

    // 4. Procesar ventas que necesitan corrección
    const ventasParaActualizar: { id: string; updates: Record<string, any>; desc: string }[] = [];

    for (const venta of ventas) {
      const updates: Record<string, any> = {};
      let desc = `${venta.numeroVenta}:`;

      // A) Corregir canal='directo' usando el canal del cliente
      if (venta.canal === 'directo' && venta.clienteId) {
        const canalCliente = clientesCanal.get(venta.clienteId);
        if (canalCliente && canalCliente !== 'directo') {
          const entidad = resolverCanalEntidad(canalCliente);
          if (entidad) {
            updates.canal = entidad.id;
            updates.canalNombre = entidad.nombre;
            desc += ` canal "directo" → "${entidad.nombre}" (${entidad.id})`;
          } else {
            updates.canal = canalCliente;
            updates.canalNombre = resolverNombre(canalCliente);
            desc += ` canal "directo" → "${updates.canalNombre}" (${canalCliente})`;
          }
          corregidas++;
        } else if (!venta.canalNombre) {
          updates.canalNombre = 'Directo';
          desc += ` +nombre "Directo"`;
          nombreAsignado++;
        } else {
          sinCambio++;
          continue;
        }
      }
      // B) Canal es un string legacy que debe apuntar a entidad real
      else if (LEGACY_STRINGS_TO_FIX.has(venta.canal.toLowerCase())) {
        const entidad = resolverCanalEntidad(venta.canal);
        if (entidad && entidad.id !== venta.canal) {
          updates.canal = entidad.id;
          updates.canalNombre = entidad.nombre;
          desc += ` canal "${venta.canal}" → "${entidad.nombre}" (${entidad.id})`;
          corregidas++;
        } else {
          // No se encontró entidad pero el nombre puede estar mal
          const nombreCorrecto = resolverNombre(venta.canal);
          if (!venta.canalNombre || venta.canalNombre !== nombreCorrecto) {
            updates.canalNombre = nombreCorrecto;
            desc += ` nombre "${venta.canalNombre || ''}" → "${nombreCorrecto}"`;
            nombreAsignado++;
          } else {
            sinCambio++;
            continue;
          }
        }
      }
      // C) Solo falta canalNombre
      else if (!venta.canalNombre && venta.canal) {
        updates.canalNombre = resolverNombre(venta.canal);
        desc += ` +nombre "${updates.canalNombre}"`;
        nombreAsignado++;
      } else {
        sinCambio++;
        continue;
      }

      if (Object.keys(updates).length > 0) {
        ventasParaActualizar.push({ id: venta.id, updates, desc });
        detalle.push(desc);
      }
    }

    // 5. Escribir en batches
    for (let i = 0; i < ventasParaActualizar.length; i += 450) {
      const batch = writeBatch(db);
      const chunk = ventasParaActualizar.slice(i, i + 450);
      for (const item of chunk) {
        batch.update(doc(db, COLLECTION_NAME, item.id), item.updates);
      }
      await batch.commit();
      console.log(`[CORREGIR-CANALES] Batch ${Math.floor(i / 450) + 1}: ${chunk.length} ventas actualizadas`);
    }

    console.log(`[CORREGIR-CANALES] Completado: ${corregidas} corregidas, ${nombreAsignado} nombres asignados, ${sinCambio} sin cambio`);
    return { corregidas, nombreAsignado, sinCambio, detalle };
  }
}