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
import { logger } from '../lib/logger';
import type {
  OrdenCompra,
  OrdenCompraFormData,
  EstadoOrden,
  CambioEstadoOrden,
  OrdenCompraStats,
  Proveedor,
  ProveedorFormData,
  ProductoOrden,
  PagoOrdenCompra
} from '../types/ordenCompra.types';
import { ProductoService } from './producto.service';
import { inventarioService } from './inventario.service';
import { unidadService } from './unidad.service';
import { almacenService } from './almacen.service';
import { ExpectativaService } from './expectativa.service';
import { tesoreriaService } from './tesoreria.service';
import type { MetodoTesoreria } from '../types/tesoreria.types';

const ORDENES_COLLECTION = 'ordenesCompra';
const PROVEEDORES_COLLECTION = 'proveedores';

export class OrdenCompraService {
  // ========================================
  // PROVEEDORES
  // ========================================

  /**
   * Obtener todos los proveedores
   */
  static async getAllProveedores(): Promise<Proveedor[]> {
    try {
      const q = query(
        collection(db, PROVEEDORES_COLLECTION),
        orderBy('nombre', 'asc')
      );
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Proveedor));
    } catch (error: any) {
      console.error('Error al obtener proveedores:', error);
      throw new Error('Error al cargar proveedores');
    }
  }

  /**
   * Crear proveedor
   */
  static async createProveedor(data: ProveedorFormData, userId: string): Promise<Proveedor> {
    try {
      const nuevoProveedor: any = {
        nombre: data.nombre,
        tipo: data.tipo,
        pais: data.pais,
        activo: true,
        creadoPor: userId,
        fechaCreacion: serverTimestamp()
      };
      
      // Agregar campos opcionales solo si existen
      if (data.contacto) nuevoProveedor.contacto = data.contacto;
      if (data.email) nuevoProveedor.email = data.email;
      if (data.telefono) nuevoProveedor.telefono = data.telefono;
      if (data.direccion) nuevoProveedor.direccion = data.direccion;
      if (data.notasInternas) nuevoProveedor.notasInternas = data.notasInternas;
      
      const docRef = await addDoc(collection(db, PROVEEDORES_COLLECTION), nuevoProveedor);
      
      return {
        id: docRef.id,
        ...nuevoProveedor,
        fechaCreacion: Timestamp.now()
      } as Proveedor;
    } catch (error: any) {
      console.error('Error al crear proveedor:', error);
      throw new Error('Error al crear proveedor');
    }
  }

  /**
   * Actualizar proveedor
   */
  static async updateProveedor(id: string, data: Partial<ProveedorFormData>): Promise<void> {
    try {
      const updates: any = {
        ultimaEdicion: serverTimestamp()
      };
      
      if (data.nombre !== undefined) updates.nombre = data.nombre;
      if (data.tipo !== undefined) updates.tipo = data.tipo;
      if (data.contacto !== undefined) updates.contacto = data.contacto;
      if (data.email !== undefined) updates.email = data.email;
      if (data.telefono !== undefined) updates.telefono = data.telefono;
      if (data.direccion !== undefined) updates.direccion = data.direccion;
      if (data.pais !== undefined) updates.pais = data.pais;
      if (data.notasInternas !== undefined) updates.notasInternas = data.notasInternas;
      
      await updateDoc(doc(db, PROVEEDORES_COLLECTION, id), updates);
    } catch (error: any) {
      console.error('Error al actualizar proveedor:', error);
      throw new Error('Error al actualizar proveedor');
    }
  }

  /**
   * Eliminar proveedor (soft delete)
   */
  static async deleteProveedor(id: string): Promise<void> {
    try {
      await updateDoc(doc(db, PROVEEDORES_COLLECTION, id), {
        activo: false,
        ultimaEdicion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error al eliminar proveedor:', error);
      throw new Error('Error al eliminar proveedor');
    }
  }

  // ========================================
  // ÓRDENES DE COMPRA
  // ========================================

  /**
   * Obtener todas las órdenes de compra
   */
  static async getAll(): Promise<OrdenCompra[]> {
    try {
      const q = query(
        collection(db, ORDENES_COLLECTION),
        orderBy('fechaCreacion', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as OrdenCompra));
    } catch (error: any) {
      console.error('Error al obtener órdenes:', error);
      throw new Error('Error al cargar órdenes de compra');
    }
  }

  /**
   * Obtener orden por ID
   */
  static async getById(id: string): Promise<OrdenCompra | null> {
    try {
      const docSnap = await getDoc(doc(db, ORDENES_COLLECTION, id));
      
      if (!docSnap.exists()) {
        return null;
      }
      
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as OrdenCompra;
    } catch (error: any) {
      console.error('Error al obtener orden:', error);
      throw new Error('Error al cargar orden');
    }
  }

  /**
   * Obtener órdenes por estado
   */
  static async getByEstado(estado: EstadoOrden): Promise<OrdenCompra[]> {
    try {
      const q = query(
        collection(db, ORDENES_COLLECTION),
        where('estado', '==', estado),
        orderBy('fechaCreacion', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as OrdenCompra));
    } catch (error: any) {
      console.error('Error al obtener órdenes por estado:', error);
      throw new Error('Error al cargar órdenes');
    }
  }

  /**
   * Crear orden de compra
   */
  static async create(data: OrdenCompraFormData, userId: string): Promise<OrdenCompra> {
    try {
      // Obtener información del proveedor
      const proveedorSnap = await getDoc(doc(db, PROVEEDORES_COLLECTION, data.proveedorId));
      if (!proveedorSnap.exists()) {
        throw new Error('Proveedor no encontrado');
      }
      const proveedor = proveedorSnap.data() as Proveedor;
      
      // Obtener información de productos y calcular totales
      const productosOrden: ProductoOrden[] = [];
      let subtotalUSD = 0;
      
      for (const prod of data.productos) {
        const producto = await ProductoService.getById(prod.productoId);
        if (!producto) {
          throw new Error(`Producto ${prod.productoId} no encontrado`);
        }
        
        const subtotal = prod.cantidad * prod.costoUnitario;
        subtotalUSD += subtotal;
        
        productosOrden.push({
          productoId: prod.productoId,
          sku: producto.sku,
          marca: producto.marca,
          nombreComercial: producto.nombreComercial,
          presentacion: producto.presentacion,
          cantidad: prod.cantidad,
          costoUnitario: prod.costoUnitario,
          subtotal
        });
      }
      
      // Calcular total
      const impuesto = data.impuestoUSD || 0;
      const gastosEnvio = data.gastosEnvioUSD || 0;
      const otrosGastos = data.otrosGastosUSD || 0;
      const totalUSD = subtotalUSD + impuesto + gastosEnvio + otrosGastos;
      
      // Generar número de orden
      const numeroOrden = await this.generateNumeroOrden();
      
      const nuevaOrden: any = {
        numeroOrden,
        proveedorId: data.proveedorId,
        nombreProveedor: proveedor.nombre,
        productos: productosOrden,
        subtotalUSD,
        totalUSD,
        estado: 'borrador',
        estadoPago: 'pendiente',  // Estado de pago independiente
        inventarioGenerado: false,
        creadoPor: userId,
        fechaCreacion: serverTimestamp()
      };
      
      // Agregar campos opcionales
      if (impuesto > 0) nuevaOrden.impuestoUSD = impuesto;
      if (gastosEnvio > 0) nuevaOrden.gastosEnvioUSD = gastosEnvio;
      if (otrosGastos > 0) nuevaOrden.otrosGastosUSD = otrosGastos;
      if (data.tcCompra) nuevaOrden.tcCompra = data.tcCompra;
      if (data.almacenDestino) nuevaOrden.almacenDestino = data.almacenDestino;
      if (data.observaciones) nuevaOrden.observaciones = data.observaciones;
      if (data.requerimientoId) nuevaOrden.requerimientoId = data.requerimientoId;

      const docRef = await addDoc(collection(db, ORDENES_COLLECTION), nuevaOrden);

      // Si viene de un requerimiento, vincularlo y actualizar su estado
      if (data.requerimientoId) {
        try {
          await ExpectativaService.vincularConOC(
            data.requerimientoId,
            docRef.id,
            numeroOrden,
            userId
          );
        } catch (error) {
          console.error('Error al vincular requerimiento con OC:', error);
          // No lanzamos error para no bloquear la creación de la OC
        }
      }

      return {
        id: docRef.id,
        ...nuevaOrden,
        fechaCreacion: Timestamp.now()
      } as OrdenCompra;
    } catch (error: any) {
      console.error('Error al crear orden:', error);
      throw new Error(error.message || 'Error al crear orden de compra');
    }
  }

  /**
   * Actualizar orden de compra (solo en borrador)
   */
  static async update(id: string, data: Partial<OrdenCompraFormData>, userId: string): Promise<void> {
    try {
      const orden = await this.getById(id);
      if (!orden) {
        throw new Error('Orden no encontrada');
      }
      
      if (orden.estado !== 'borrador') {
        throw new Error('Solo se pueden editar órdenes en borrador');
      }
      
      const updates: any = {
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      };
      
      // Si se actualizan los productos, recalcular totales
      if (data.productos) {
        const productosOrden: ProductoOrden[] = [];
        let subtotalUSD = 0;
        
        for (const prod of data.productos) {
          const producto = await ProductoService.getById(prod.productoId);
          if (!producto) continue;
          
          const subtotal = prod.cantidad * prod.costoUnitario;
          subtotalUSD += subtotal;
          
          productosOrden.push({
            productoId: prod.productoId,
            sku: producto.sku,
            marca: producto.marca,
            nombreComercial: producto.nombreComercial,
            presentacion: producto.presentacion,
            cantidad: prod.cantidad,
            costoUnitario: prod.costoUnitario,
            subtotal
          });
        }
        
        updates.productos = productosOrden;
        updates.subtotalUSD = subtotalUSD;
        
        const gastosEnvio = data.gastosEnvioUSD !== undefined ? data.gastosEnvioUSD : (orden.gastosEnvioUSD || 0);
        const otrosGastos = data.otrosGastosUSD !== undefined ? data.otrosGastosUSD : (orden.otrosGastosUSD || 0);
        updates.totalUSD = subtotalUSD + gastosEnvio + otrosGastos;
      }
      
      if (data.gastosEnvioUSD !== undefined) updates.gastosEnvioUSD = data.gastosEnvioUSD;
      if (data.otrosGastosUSD !== undefined) updates.otrosGastosUSD = data.otrosGastosUSD;
      if (data.tcCompra !== undefined) updates.tcCompra = data.tcCompra;
      if (data.almacenDestino !== undefined) updates.almacenDestino = data.almacenDestino;
      if (data.observaciones !== undefined) updates.observaciones = data.observaciones;
      
      await updateDoc(doc(db, ORDENES_COLLECTION, id), updates);
    } catch (error: any) {
      console.error('Error al actualizar orden:', error);
      throw new Error(error.message || 'Error al actualizar orden');
    }
  }

  /**
   * Cambiar estado de orden
   */
  static async cambiarEstado(
    id: string,
    nuevoEstado: EstadoOrden,
    userId: string,
    datos?: {
      tcPago?: number;
      numeroTracking?: string;
      courier?: string;
      motivo?: string;
      observaciones?: string;
    }
  ): Promise<void> {
    try {
      const orden = await this.getById(id);
      if (!orden) {
        throw new Error('Orden no encontrada');
      }
      
      const updates: any = {
        estado: nuevoEstado,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      };
      
      // Actualizar fechas según el estado
      if (nuevoEstado === 'enviada' && !orden.fechaEnviada) {
        updates.fechaEnviada = Timestamp.now();
      } else if (nuevoEstado === 'en_transito' && !orden.fechaEnTransito) {
        updates.fechaEnTransito = Timestamp.now();
        
        if (datos?.numeroTracking) updates.numeroTracking = datos.numeroTracking;
        if (datos?.courier) updates.courier = datos.courier;
      } else if (nuevoEstado === 'recibida' && !orden.fechaRecibida) {
        updates.fechaRecibida = Timestamp.now();
      }
      
      await updateDoc(doc(db, ORDENES_COLLECTION, id), updates);
    } catch (error: any) {
      console.error('Error al cambiar estado:', error);
      throw new Error(error.message || 'Error al cambiar estado');
    }
  }

  /**
   * Registrar pago de orden (independiente del estado logístico)
   * Soporta pagos en USD o PEN con historial estructurado
   * Integrado con Tesorería
   */
  static async registrarPago(
    id: string,
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
  ): Promise<PagoOrdenCompra> {
    try {
      const orden = await this.getById(id);
      if (!orden) {
        throw new Error('Orden no encontrada');
      }

      if (orden.estado === 'cancelada') {
        throw new Error('No se puede registrar pago en una orden cancelada');
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

      // Crear registro de pago estructurado (sin campos undefined - Firestore no los acepta)
      const pagoId = `PAG-OC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const nuevoPago: PagoOrdenCompra = {
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

      // Solo agregar campos opcionales si tienen valor
      if (cuentaOrigenId) nuevoPago.cuentaOrigenId = cuentaOrigenId;
      if (cuentaOrigenNombre) nuevoPago.cuentaOrigenNombre = cuentaOrigenNombre;
      if (referencia) nuevoPago.referencia = referencia;
      if (notas) nuevoPago.notas = notas;

      // Calcular totales
      const historialPagos = orden.historialPagos || [];
      const totalPagadoUSD = historialPagos.reduce((sum, p) => sum + p.montoUSD, 0) + montoUSD;
      const pendienteUSD = orden.totalUSD - totalPagadoUSD;

      // Determinar estado de pago
      const estadoPago = pendienteUSD <= 0.01 ? 'pagada' : 'pago_parcial';

      // Preparar actualización
      const updates: any = {
        historialPagos: [...historialPagos, nuevoPago],
        estadoPago,
        tcPago: tipoCambio,
        montoPendiente: Math.max(0, pendienteUSD * tipoCambio),
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      };

      // Si es pago completo, marcar fecha de pago
      if (estadoPago === 'pagada') {
        updates.fechaPago = Timestamp.fromDate(fechaPago);
        updates.totalPEN = orden.totalUSD * tipoCambio;

        // Calcular diferencia cambiaria si existe TC de compra
        if (orden.tcCompra) {
          const costoEnCompra = orden.totalUSD * orden.tcCompra;
          const costoEnPago = orden.totalUSD * tipoCambio;
          updates.diferenciaCambiaria = costoEnPago - costoEnCompra;
        }
      }

      // Actualizar la orden
      await updateDoc(doc(db, ORDENES_COLLECTION, id), updates);

      // ========== REGISTRAR EN TESORERÍA ==========
      try {
        const esPagoCompleto = estadoPago === 'pagada';
        const movimientoData: any = {
          tipo: 'pago_orden_compra',
          moneda: monedaPago, // Registrar en la moneda real del pago
          monto: montoOriginal,
          tipoCambio,
          metodo: metodoPago,
          referencia,
          concepto: `Pago ${esPagoCompleto ? 'completo' : 'parcial'} OC ${orden.numeroOrden} - ${orden.nombreProveedor}`,
          ordenCompraId: id,
          ordenCompraNumero: orden.numeroOrden,
          notas: notas || `${monedaPago === 'USD' ? `≈ S/ ${montoPEN.toFixed(2)}` : `≈ $${montoUSD.toFixed(2)} USD`}`,
          fecha: fechaPago
        };

        // Agregar cuenta origen (de donde sale el dinero)
        if (cuentaOrigenId) {
          movimientoData.cuentaOrigen = cuentaOrigenId;
        }

        const movimientoId = await tesoreriaService.registrarMovimiento(movimientoData, userId);
        nuevoPago.movimientoTesoreriaId = movimientoId;

        logger.success(`Pago OC registrado en tesorería: ${monedaPago} ${montoOriginal} para ${orden.numeroOrden}`);
      } catch (tesoreriaError) {
        // No bloquear el pago si falla tesorería
        console.error('Error registrando pago OC en tesorería:', tesoreriaError);
      }

      return nuevoPago;
    } catch (error: any) {
      console.error('Error al registrar pago:', error);
      throw new Error(error.message || 'Error al registrar pago');
    }
  }

  /**
   * Recibir orden y generar inventario automáticamente
   * El costo unitario incluye la parte proporcional del impuesto, envío y otros gastos
   *
   * LÓGICA INTELIGENTE DE RESERVA:
   * - Si la OC viene de un Requerimiento vinculado a una cotización/venta:
   *   - Las unidades hasta la cantidad solicitada se marcan como "reservada"
   *   - El excedente (si se compró más) queda como "disponible"
   * - Si la OC NO viene de un Requerimiento: todas las unidades quedan como "disponible"
   */
  static async recibirOrden(id: string, userId: string): Promise<{
    unidadesGeneradas: string[];
    unidadesReservadas: string[];
    unidadesDisponibles: string[];
    cotizacionVinculada?: string;
  }> {
    try {
      const orden = await this.getById(id);
      if (!orden) {
        throw new Error('Orden no encontrada');
      }

      if (orden.estado !== 'en_transito' && orden.estado !== 'enviada') {
        throw new Error('La orden debe estar enviada o en tránsito para ser recibida');
      }

      if (orden.inventarioGenerado) {
        throw new Error('El inventario ya fue generado para esta orden');
      }

      // Si no hay TC de pago, usar TC de compra como fallback
      const tcAplicable = orden.tcPago ?? orden.tcCompra;
      if (!tcAplicable) {
        throw new Error('Se requiere tipo de cambio para generar inventario');
      }

      if (!orden.almacenDestino) {
        throw new Error('Se requiere almacén destino para generar inventario');
      }

      // ================================================================
      // OBTENER INFORMACIÓN DEL REQUERIMIENTO SI EXISTE
      // ================================================================
      let requerimiento: any = null;
      let cotizacionId: string | undefined;
      const cantidadesSolicitadas: Map<string, number> = new Map();

      if (orden.requerimientoId) {
        try {
          requerimiento = await ExpectativaService.getRequerimientoById(orden.requerimientoId);

          if (requerimiento) {
            // ventaRelacionadaId es realmente la cotizacionId en nuestro flujo
            cotizacionId = requerimiento.ventaRelacionadaId;

            // Construir mapa de cantidades solicitadas por producto
            for (const prod of requerimiento.productos) {
              cantidadesSolicitadas.set(prod.productoId, prod.cantidadSolicitada);
            }

            logger.info(`OC ${orden.numeroOrden} vinculada a requerimiento ${requerimiento.numeroRequerimiento}`);
            if (cotizacionId) {
              logger.info(`  → Cotización vinculada: ${cotizacionId}`);
            }
          }
        } catch (error) {
          console.error('Error al obtener requerimiento:', error);
          // Continuar sin reservar si falla
        }
      }

      // Calcular el total de unidades para prorrateo de gastos adicionales
      const totalUnidadesOrden = orden.productos.reduce((sum, p) => sum + p.cantidad, 0);

      // Calcular costos adicionales totales (impuesto + envío + otros)
      const impuestoTotal = orden.impuestoUSD || 0;
      const gastosEnvioTotal = orden.gastosEnvioUSD || 0;
      const otrosGastosTotal = orden.otrosGastosUSD || 0;
      const costosAdicionalesTotal = impuestoTotal + gastosEnvioTotal + otrosGastosTotal;

      // Costo adicional por unidad (prorrateado equitativamente entre todas las unidades)
      const costoAdicionalPorUnidad = totalUnidadesOrden > 0
        ? costosAdicionalesTotal / totalUnidadesOrden
        : 0;

      const unidadesGeneradas: string[] = [];
      const unidadesReservadas: string[] = [];
      const unidadesDisponibles: string[] = [];

      // Generar inventario para cada producto
      for (const producto of orden.productos) {
        // Obtener información del producto
        const productoInfo = await ProductoService.getById(producto.productoId);
        if (!productoInfo) {
          throw new Error(`Producto ${producto.productoId} no encontrado`);
        }

        // Obtener información del almacén
        const almacen = await almacenService.getById(orden.almacenDestino);
        if (!almacen) {
          throw new Error(`Almacén ${orden.almacenDestino} no encontrado`);
        }
        const almacenInfo = {
          nombre: almacen.nombre,
          pais: almacen.pais
        };

        // Costo unitario real = costo producto + parte proporcional de gastos adicionales
        const costoUnitarioReal = producto.costoUnitario + costoAdicionalPorUnidad;

        // ================================================================
        // LÓGICA INTELIGENTE DE RESERVA
        // ================================================================
        const cantidadSolicitada = cantidadesSolicitadas.get(producto.productoId) || 0;
        const cantidadComprada = producto.cantidad;

        // Calcular cuántas reservar y cuántas dejar disponibles
        const cantidadAReservar = cotizacionId ? Math.min(cantidadSolicitada, cantidadComprada) : 0;
        const cantidadDisponible = cantidadComprada - cantidadAReservar;

        // Crear unidades RESERVADAS (para el cliente)
        if (cantidadAReservar > 0) {
          const unidadesReservadasIds = await unidadService.crearLote(
            {
              productoId: producto.productoId,
              cantidad: cantidadAReservar,
              lote: `OC-${orden.numeroOrden}`,
              fechaVencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              almacenId: orden.almacenDestino,
              costoUnitarioUSD: costoUnitarioReal,
              ordenCompraId: id,
              ordenCompraNumero: orden.numeroOrden,
              fechaRecepcion: new Date(),
              tcCompra: orden.tcCompra,
              tcPago: orden.tcPago,
              // RESERVA AUTOMÁTICA
              estadoInicial: 'reservada',
              reservadoPara: cotizacionId,
              requerimientoId: orden.requerimientoId
            },
            userId,
            {
              sku: productoInfo.sku,
              nombre: productoInfo.nombreComercial
            },
            almacenInfo
          );

          unidadesGeneradas.push(...unidadesReservadasIds);
          unidadesReservadas.push(...unidadesReservadasIds);

          logger.success(`  → ${cantidadAReservar} unidades de ${productoInfo.sku} RESERVADAS para cotización ${cotizacionId}`);
        }

        // Crear unidades DISPONIBLES (excedente o sin requerimiento)
        if (cantidadDisponible > 0) {
          const unidadesDisponiblesIds = await unidadService.crearLote(
            {
              productoId: producto.productoId,
              cantidad: cantidadDisponible,
              lote: `OC-${orden.numeroOrden}`,
              fechaVencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              almacenId: orden.almacenDestino,
              costoUnitarioUSD: costoUnitarioReal,
              ordenCompraId: id,
              ordenCompraNumero: orden.numeroOrden,
              fechaRecepcion: new Date(),
              tcCompra: orden.tcCompra,
              tcPago: orden.tcPago
              // Sin estadoInicial = quedará como "recibida_usa" o "disponible_peru"
            },
            userId,
            {
              sku: productoInfo.sku,
              nombre: productoInfo.nombreComercial
            },
            almacenInfo
          );

          unidadesGeneradas.push(...unidadesDisponiblesIds);
          unidadesDisponibles.push(...unidadesDisponiblesIds);

          if (cantidadAReservar > 0) {
            logger.info(`  → ${cantidadDisponible} unidades de ${productoInfo.sku} como STOCK LIBRE (excedente)`);
          }
        }
      }

      // Calcular total de unidades y valor TOTAL para el almacén
      const totalUnidades = orden.productos.reduce((sum, p) => sum + p.cantidad, 0);
      const valorTotalUSD = orden.totalUSD;

      // Actualizar contadores del almacén destino
      await almacenService.incrementarUnidadesRecibidas(orden.almacenDestino, totalUnidades);
      await almacenService.actualizarValorInventario(
        orden.almacenDestino,
        valorTotalUSD
      );

      // Sincronizar stock de cada producto desde unidades (fuente de verdad)
      const productosAfectados = orden.productos.map(p => p.productoId);
      await inventarioService.sincronizarStockProductos_batch(productosAfectados);

      // Actualizar orden con información de reservas
      await updateDoc(doc(db, ORDENES_COLLECTION, id), {
        estado: 'recibida',
        fechaRecibida: Timestamp.now(),
        inventarioGenerado: true,
        unidadesGeneradas,
        unidadesReservadas: unidadesReservadas.length > 0 ? unidadesReservadas : null,
        unidadesDisponibles: unidadesDisponibles.length > 0 ? unidadesDisponibles : null,
        cotizacionVinculada: cotizacionId || null,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });

      // Si la orden estaba vinculada a un requerimiento, marcarlo como completado
      if (orden.requerimientoId) {
        try {
          await ExpectativaService.actualizarEstado(
            orden.requerimientoId,
            'completado',
            userId
          );
        } catch (error) {
          console.error('Error al marcar requerimiento como completado:', error);
        }
      }

      // Log resumen
      if (unidadesReservadas.length > 0) {
        logger.success(`OC ${orden.numeroOrden} recibida: ${unidadesReservadas.length} reservadas, ${unidadesDisponibles.length} disponibles`);
      } else {
        logger.info(`OC ${orden.numeroOrden} recibida: ${unidadesGeneradas.length} unidades disponibles`);
      }

      return {
        unidadesGeneradas,
        unidadesReservadas,
        unidadesDisponibles,
        cotizacionVinculada: cotizacionId
      };
    } catch (error: any) {
      console.error('Error al recibir orden:', error);
      throw new Error(error.message || 'Error al recibir orden');
    }
  }

  /**
   * Eliminar orden (solo borradores)
   */
  static async delete(id: string): Promise<void> {
    try {
      const orden = await this.getById(id);
      if (!orden) {
        throw new Error('Orden no encontrada');
      }
      
      if (orden.estado !== 'borrador') {
        throw new Error('Solo se pueden eliminar órdenes en borrador');
      }
      
      await deleteDoc(doc(db, ORDENES_COLLECTION, id));
    } catch (error: any) {
      console.error('Error al eliminar orden:', error);
      throw new Error(error.message || 'Error al eliminar orden');
    }
  }

  /**
   * Obtener estadísticas
   */
  static async getStats(): Promise<OrdenCompraStats> {
    try {
      const ordenes = await this.getAll();
      
      const stats: OrdenCompraStats = {
        totalOrdenes: ordenes.length,
        borradores: 0,
        enviadas: 0,
        pagadas: 0,
        enTransito: 0,
        recibidas: 0,
        canceladas: 0,
        valorTotalUSD: 0,
        valorTotalPEN: 0
      };
      
      ordenes.forEach(orden => {
        // Contar por estado logístico
        if (orden.estado === 'borrador') stats.borradores++;
        else if (orden.estado === 'enviada') stats.enviadas++;
        else if (orden.estado === 'en_transito') stats.enTransito++;
        else if (orden.estado === 'recibida') stats.recibidas++;
        else if (orden.estado === 'cancelada') stats.canceladas++;

        // Contar pagadas por estado de pago
        if (orden.estadoPago === 'pagada') stats.pagadas++;
        
        // Sumar valores (solo órdenes no canceladas)
        if (orden.estado !== 'cancelada') {
          stats.valorTotalUSD += orden.totalUSD;
          if (orden.totalPEN) {
            stats.valorTotalPEN += orden.totalPEN;
          }
        }
      });
      
      return stats;
    } catch (error: any) {
      console.error('Error al obtener estadísticas:', error);
      throw new Error('Error al generar estadísticas');
    }
  }

  /**
   * Generar número de orden (busca el máximo para evitar duplicados)
   */
  private static async generateNumeroOrden(): Promise<string> {
    try {
      const year = new Date().getFullYear();
      const snapshot = await getDocs(collection(db, ORDENES_COLLECTION));

      if (snapshot.empty) {
        return `OC-${year}-001`;
      }

      // Buscar el número máximo existente
      let maxNumber = 0;
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data() as OrdenCompra;
        const numero = data.numeroOrden;

        // Extraer el número del formato OC-YYYY-NNN
        const match = numero?.match(/OC-\d{4}-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      });

      return `OC-${year}-${(maxNumber + 1).toString().padStart(3, '0')}`;
    } catch (error) {
      return `OC-${new Date().getFullYear()}-001`;
    }
  }

  // ========================================
  // INVESTIGACIÓN DE MERCADO / PRECIOS HISTÓRICOS
  // ========================================

  /**
   * Obtener historial de precios de un producto por proveedor
   * Extrae información de órdenes de compra anteriores
   */
  static async getPreciosHistoricos(productoId: string): Promise<Array<{
    proveedorId: string;
    proveedorNombre: string;
    costoUnitarioUSD: number;
    cantidad: number;
    fechaCompra: Date;
    numeroOrden: string;
    tcCompra?: number;
  }>> {
    try {
      const ordenes = await this.getAll();
      const precios: Array<{
        proveedorId: string;
        proveedorNombre: string;
        costoUnitarioUSD: number;
        cantidad: number;
        fechaCompra: Date;
        numeroOrden: string;
        tcCompra?: number;
      }> = [];

      ordenes.forEach(orden => {
        // Solo órdenes no canceladas
        if (orden.estado === 'cancelada') return;

        const producto = orden.productos.find(p => p.productoId === productoId);
        if (producto) {
          precios.push({
            proveedorId: orden.proveedorId,
            proveedorNombre: orden.nombreProveedor,
            costoUnitarioUSD: producto.costoUnitario,
            cantidad: producto.cantidad,
            fechaCompra: orden.fechaCreacion.toDate(),
            numeroOrden: orden.numeroOrden,
            tcCompra: orden.tcCompra
          });
        }
      });

      // Ordenar por fecha más reciente
      precios.sort((a, b) => b.fechaCompra.getTime() - a.fechaCompra.getTime());

      return precios;
    } catch (error: any) {
      console.error('Error al obtener precios históricos:', error);
      return [];
    }
  }

  /**
   * Obtener el mejor precio histórico de un producto
   * Retorna el precio más bajo registrado
   */
  static async getMejorPrecioHistorico(productoId: string): Promise<{
    proveedorId: string;
    proveedorNombre: string;
    costoUnitarioUSD: number;
    fechaCompra: Date;
    numeroOrden: string;
  } | null> {
    const precios = await this.getPreciosHistoricos(productoId);

    if (precios.length === 0) return null;

    return precios.reduce((mejor, actual) =>
      actual.costoUnitarioUSD < mejor.costoUnitarioUSD ? actual : mejor
    );
  }

  /**
   * Obtener precio promedio histórico de un producto
   */
  static async getPrecioPromedioHistorico(productoId: string): Promise<number> {
    const precios = await this.getPreciosHistoricos(productoId);

    if (precios.length === 0) return 0;

    const suma = precios.reduce((sum, p) => sum + p.costoUnitarioUSD, 0);
    return suma / precios.length;
  }

  /**
   * Obtener último precio de un producto por proveedor específico
   */
  static async getUltimoPrecioProveedor(productoId: string, proveedorId: string): Promise<{
    costoUnitarioUSD: number;
    fechaCompra: Date;
    numeroOrden: string;
    tcCompra?: number;
  } | null> {
    const precios = await this.getPreciosHistoricos(productoId);

    const precioProveedor = precios.find(p => p.proveedorId === proveedorId);

    if (!precioProveedor) return null;

    return {
      costoUnitarioUSD: precioProveedor.costoUnitarioUSD,
      fechaCompra: precioProveedor.fechaCompra,
      numeroOrden: precioProveedor.numeroOrden,
      tcCompra: precioProveedor.tcCompra
    };
  }

  /**
   * Obtener resumen de investigación de mercado para múltiples productos
   * Útil para el formulario de requerimientos
   */
  static async getInvestigacionMercado(productoIds: string[]): Promise<Map<string, {
    productoId: string;
    precioPromedioUSD: number;
    precioMinimoUSD: number;
    precioMaximoUSD: number;
    ultimoPrecioUSD: number;
    proveedorRecomendado?: {
      id: string;
      nombre: string;
      ultimoPrecioUSD: number;
    };
    historial: Array<{
      proveedorNombre: string;
      costoUnitarioUSD: number;
      fechaCompra: Date;
    }>;
  }>> {
    const resultado = new Map();

    for (const productoId of productoIds) {
      const precios = await this.getPreciosHistoricos(productoId);

      if (precios.length === 0) {
        resultado.set(productoId, {
          productoId,
          precioPromedioUSD: 0,
          precioMinimoUSD: 0,
          precioMaximoUSD: 0,
          ultimoPrecioUSD: 0,
          proveedorRecomendado: undefined,
          historial: []
        });
        continue;
      }

      const preciosUSD = precios.map(p => p.costoUnitarioUSD);
      const precioMinimo = Math.min(...preciosUSD);
      const precioMaximo = Math.max(...preciosUSD);
      const precioPromedio = preciosUSD.reduce((a, b) => a + b, 0) / preciosUSD.length;

      // Encontrar proveedor con mejor precio reciente (últimos 6 meses)
      const seismesesAtras = new Date();
      seismesesAtras.setMonth(seismesesAtras.getMonth() - 6);

      const preciosRecientes = precios.filter(p => p.fechaCompra >= seismesesAtras);
      const mejorReciente = preciosRecientes.length > 0
        ? preciosRecientes.reduce((mejor, actual) =>
            actual.costoUnitarioUSD < mejor.costoUnitarioUSD ? actual : mejor
          )
        : precios[0]; // Si no hay recientes, usar el más reciente de todos

      resultado.set(productoId, {
        productoId,
        precioPromedioUSD: precioPromedio,
        precioMinimoUSD: precioMinimo,
        precioMaximoUSD: precioMaximo,
        ultimoPrecioUSD: precios[0].costoUnitarioUSD,
        proveedorRecomendado: {
          id: mejorReciente.proveedorId,
          nombre: mejorReciente.proveedorNombre,
          ultimoPrecioUSD: mejorReciente.costoUnitarioUSD
        },
        historial: precios.slice(0, 5).map(p => ({
          proveedorNombre: p.proveedorNombre,
          costoUnitarioUSD: p.costoUnitarioUSD,
          fechaCompra: p.fechaCompra
        }))
      });
    }

    return resultado;
  }

  /**
   * Obtener productos comprados a un proveedor específico
   */
  static async getProductosProveedor(proveedorId: string): Promise<Array<{
    productoId: string;
    sku: string;
    marca: string;
    nombreComercial: string;
    ultimoCostoUSD: number;
    cantidadTotal: number;
    ordenesCount: number;
  }>> {
    try {
      const ordenes = await this.getAll();
      const productosMap = new Map<string, {
        productoId: string;
        sku: string;
        marca: string;
        nombreComercial: string;
        ultimoCostoUSD: number;
        cantidadTotal: number;
        ordenesCount: number;
        ultimaFecha: Date;
      }>();

      ordenes
        .filter(o => o.proveedorId === proveedorId && o.estado !== 'cancelada')
        .forEach(orden => {
          orden.productos.forEach(producto => {
            const existing = productosMap.get(producto.productoId);
            const fechaOrden = orden.fechaCreacion.toDate();

            if (existing) {
              existing.cantidadTotal += producto.cantidad;
              existing.ordenesCount += 1;
              // Actualizar precio si es más reciente
              if (fechaOrden > existing.ultimaFecha) {
                existing.ultimoCostoUSD = producto.costoUnitario;
                existing.ultimaFecha = fechaOrden;
              }
            } else {
              productosMap.set(producto.productoId, {
                productoId: producto.productoId,
                sku: producto.sku,
                marca: producto.marca,
                nombreComercial: producto.nombreComercial,
                ultimoCostoUSD: producto.costoUnitario,
                cantidadTotal: producto.cantidad,
                ordenesCount: 1,
                ultimaFecha: fechaOrden
              });
            }
          });
        });

      return Array.from(productosMap.values()).map(({ ultimaFecha, ...rest }) => rest);
    } catch (error: any) {
      console.error('Error al obtener productos del proveedor:', error);
      return [];
    }
  }
}