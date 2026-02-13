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
  PagoOrdenCompra,
  RecepcionParcial
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
   * Obtener proveedor por ID
   */
  static async getProveedorById(id: string): Promise<Proveedor | null> {
    try {
      const docRef = doc(db, PROVEEDORES_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Proveedor;
    } catch (error: any) {
      console.error('Error al obtener proveedor:', error);
      return null;
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
      if (data.almacenDestino) {
        nuevaOrden.almacenDestino = data.almacenDestino;
        // Obtener nombre del almacén
        const almacen = await almacenService.getById(data.almacenDestino);
        if (almacen) {
          nuevaOrden.nombreAlmacenDestino = almacen.nombre;
        }
      }
      if (data.observaciones) nuevaOrden.observaciones = data.observaciones;
      if (data.requerimientoId) nuevaOrden.requerimientoId = data.requerimientoId;

      // Soporte multi-requerimiento (OC consolidada)
      if (data.requerimientoIds && data.requerimientoIds.length > 0) {
        nuevaOrden.requerimientoIds = data.requerimientoIds;
        nuevaOrden.requerimientoNumeros = [];
        if (data.productosOrigen) {
          nuevaOrden.productosOrigen = data.productosOrigen;
          // Agregar origenRequerimientos a cada ProductoOrden
          for (const prodOrden of productosOrden) {
            prodOrden.origenRequerimientos = data.productosOrigen
              .filter(o => o.productoId === prodOrden.productoId)
              .map(o => ({
                requerimientoId: o.requerimientoId,
                cotizacionId: o.cotizacionId,
                clienteNombre: o.clienteNombre,
                cantidad: o.cantidad
              }));
          }
        }
        // Backwards compat: primer req como singular
        if (!nuevaOrden.requerimientoId) {
          nuevaOrden.requerimientoId = data.requerimientoIds[0];
        }
      }

      const docRef = await addDoc(collection(db, ORDENES_COLLECTION), nuevaOrden);

      // Vincular requerimiento(s) con la OC
      const reqIdsToLink = data.requerimientoIds && data.requerimientoIds.length > 0
        ? data.requerimientoIds
        : data.requerimientoId ? [data.requerimientoId] : [];

      for (const reqId of reqIdsToLink) {
        try {
          const req = await ExpectativaService.getRequerimientoById(reqId);
          await ExpectativaService.vincularConOC(reqId, docRef.id, numeroOrden, userId);
          // Llenar números para multi-req
          if (data.requerimientoIds?.length) {
            nuevaOrden.requerimientoNumeros.push(req?.numeroRequerimiento || '');
          }
        } catch (error) {
          console.error('Error al vincular requerimiento con OC:', error);
        }
      }

      // Actualizar OC con los números de requerimiento resueltos
      if (nuevaOrden.requerimientoNumeros?.length > 0) {
        await updateDoc(docRef, {
          requerimientoNumeros: nuevaOrden.requerimientoNumeros,
          requerimientoNumero: nuevaOrden.requerimientoNumeros[0]
        });
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

        const impuestoUSD = data.impuestoUSD !== undefined ? data.impuestoUSD : (orden.impuestoUSD || 0);
        const gastosEnvio = data.gastosEnvioUSD !== undefined ? data.gastosEnvioUSD : (orden.gastosEnvioUSD || 0);
        const otrosGastos = data.otrosGastosUSD !== undefined ? data.otrosGastosUSD : (orden.otrosGastosUSD || 0);
        updates.totalUSD = subtotalUSD + impuestoUSD + gastosEnvio + otrosGastos;
      }

      // Actualizar proveedor si cambió
      if (data.proveedorId && data.proveedorId !== orden.proveedorId) {
        const proveedor = await this.getProveedorById(data.proveedorId);
        if (proveedor) {
          updates.proveedorId = data.proveedorId;
          updates.nombreProveedor = proveedor.nombre;
        }
      }

      // Actualizar almacén destino si cambió
      if (data.almacenDestino && data.almacenDestino !== orden.almacenDestino) {
        const almacen = await almacenService.getById(data.almacenDestino);
        if (almacen) {
          updates.almacenDestino = data.almacenDestino;
          updates.nombreAlmacenDestino = almacen.nombre;
        }
      }

      if (data.impuestoUSD !== undefined) updates.impuestoUSD = data.impuestoUSD;
      if (data.gastosEnvioUSD !== undefined) updates.gastosEnvioUSD = data.gastosEnvioUSD;
      if (data.otrosGastosUSD !== undefined) updates.otrosGastosUSD = data.otrosGastosUSD;
      if (data.tcCompra !== undefined) updates.tcCompra = data.tcCompra;
      if (data.numeroTracking !== undefined) updates.numeroTracking = data.numeroTracking;
      if (data.courier !== undefined) updates.courier = data.courier;
      if (data.observaciones !== undefined) updates.observaciones = data.observaciones;

      // Recalcular totalPEN si cambió tcCompra
      if (data.tcCompra !== undefined || updates.totalUSD !== undefined) {
        const tc = data.tcCompra !== undefined ? data.tcCompra : (orden.tcCompra || 0);
        const total = updates.totalUSD !== undefined ? updates.totalUSD : orden.totalUSD;
        if (tc > 0) {
          updates.totalPEN = total * tc;
        }
      }

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
      } else if (nuevoEstado === 'recibida_parcial') {
        if (!orden.fechaPrimeraRecepcion) {
          updates.fechaPrimeraRecepcion = Timestamp.now();
        }
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
   * Recepción parcial de orden de compra
   * Permite recibir productos en múltiples entregas (ej: Amazon envía en varios paquetes)
   * Genera inventario solo para los productos recibidos en esta entrega
   */
  static async recibirOrdenParcial(
    id: string,
    productosRecibidos: Array<{ productoId: string; cantidadRecibida: number }>,
    userId: string,
    observaciones?: string
  ): Promise<{
    recepcionId: string;
    unidadesGeneradas: string[];
    unidadesReservadas: string[];
    unidadesDisponibles: string[];
    esRecepcionFinal: boolean;
    cotizacionVinculada?: string;
  }> {
    try {
      const orden = await this.getById(id);
      if (!orden) {
        throw new Error('Orden no encontrada');
      }

      // Validar estados permitidos
      if (!['en_transito', 'enviada', 'recibida_parcial'].includes(orden.estado)) {
        throw new Error('La orden debe estar enviada, en tránsito o recibida parcial para recibir productos');
      }

      // Si no hay TC de pago, usar TC de compra como fallback
      const tcAplicable = orden.tcPago ?? orden.tcCompra;
      if (!tcAplicable) {
        throw new Error('Se requiere tipo de cambio para generar inventario');
      }

      if (!orden.almacenDestino) {
        throw new Error('Se requiere almacén destino para generar inventario');
      }

      // Validar productos recibidos
      const productosValidos = productosRecibidos.filter(pr => pr.cantidadRecibida > 0);
      if (productosValidos.length === 0) {
        throw new Error('Debe recibir al menos 1 producto con cantidad mayor a 0');
      }

      for (const pr of productosValidos) {
        const productoOC = orden.productos.find(p => p.productoId === pr.productoId);
        if (!productoOC) {
          throw new Error(`Producto ${pr.productoId} no existe en esta orden`);
        }
        const yaRecibido = productoOC.cantidadRecibida || 0;
        const pendiente = productoOC.cantidad - yaRecibido;
        if (pr.cantidadRecibida > pendiente) {
          throw new Error(`${productoOC.nombreComercial}: no se pueden recibir ${pr.cantidadRecibida} unidades, solo quedan ${pendiente} pendientes`);
        }
      }

      // ================================================================
      // OBTENER INFORMACIÓN DE REQUERIMIENTOS (soporte multi-req)
      // ================================================================
      const reservationMap = new Map<string, Array<{
        requerimientoId: string;
        cotizacionId: string;
        cantidad: number;
      }>>();

      const reqIds: string[] = [];
      if (orden.requerimientoIds && orden.requerimientoIds.length > 0) {
        reqIds.push(...orden.requerimientoIds);
      } else if (orden.requerimientoId) {
        reqIds.push(orden.requerimientoId);
      }

      let cotizacionId: string | undefined;

      for (const reqId of reqIds) {
        try {
          const req = await ExpectativaService.getRequerimientoById(reqId);
          if (!req) continue;

          const cotId = req.ventaRelacionadaId || '';
          if (cotId && !cotizacionId) cotizacionId = cotId;

          const productosDeEsteReq = orden.productosOrigen
            ?.filter(po => po.requerimientoId === reqId)
            || req.productos.map((p: any) => ({ productoId: p.productoId, cantidad: p.cantidadSolicitada }));

          for (const prod of productosDeEsteReq) {
            const existing = reservationMap.get(prod.productoId) || [];
            existing.push({
              requerimientoId: reqId,
              cotizacionId: cotId,
              cantidad: prod.cantidad
            });
            reservationMap.set(prod.productoId, existing);
          }
        } catch (error) {
          console.error(`Error al obtener requerimiento ${reqId}:`, error);
        }
      }

      // Calcular prorrateo de costos sobre el total COMPLETO de la OC
      const totalUnidadesOrden = orden.productos.reduce((sum, p) => sum + p.cantidad, 0);
      const impuestoTotal = orden.impuestoUSD || 0;
      const gastosEnvioTotal = orden.gastosEnvioUSD || 0;
      const otrosGastosTotal = orden.otrosGastosUSD || 0;
      const costosAdicionalesTotal = impuestoTotal + gastosEnvioTotal + otrosGastosTotal;
      const costoAdicionalPorUnidad = totalUnidadesOrden > 0
        ? costosAdicionalesTotal / totalUnidadesOrden
        : 0;

      // Contar unidades ya reservadas en recepciones previas por producto
      const unidadesYaReservadas = new Map<string, number>();
      if (orden.recepcionesParciales) {
        for (const recPrev of orden.recepcionesParciales) {
          for (const id of recPrev.unidadesReservadas || []) {
            // Las reservadas previas se cuentan por producto indirectamente
            // Usamos el conteo directo de recepciones previas
          }
          for (const prPrev of recPrev.productosRecibidos) {
            // No podemos saber cuántas fueron reservadas vs disponibles por producto
            // desde el historial de recepciones, así que lo calculamos diferente
          }
        }
      }
      // Alternativa más precisa: calcular reservas restantes del reservationMap
      // descontando lo ya recibido (cantidadRecibida) de cada producto
      // La lógica de reserva tomará en cuenta el acumulado

      const unidadesGeneradas: string[] = [];
      const unidadesReservadas: string[] = [];
      const unidadesDisponibles: string[] = [];
      let totalUnidadesRecepcion = 0;

      // Obtener información del almacén una sola vez
      const almacen = await almacenService.getById(orden.almacenDestino);
      if (!almacen) {
        throw new Error(`Almacén ${orden.almacenDestino} no encontrado`);
      }
      const almacenInfo = { nombre: almacen.nombre, pais: almacen.pais };

      // Generar inventario solo para los productos de ESTA entrega
      for (const pr of productosValidos) {
        const productoOC = orden.productos.find(p => p.productoId === pr.productoId)!;
        const productoInfo = await ProductoService.getById(pr.productoId);
        if (!productoInfo) {
          throw new Error(`Producto ${pr.productoId} no encontrado`);
        }

        const costoUnitarioReal = productoOC.costoUnitario + costoAdicionalPorUnidad;

        // Lógica de reserva: descontar lo ya reservado en entregas previas
        const reservations = reservationMap.get(pr.productoId) || [];
        const yaRecibidoEsteProducto = productoOC.cantidadRecibida || 0;

        // Calcular cuántas unidades ya se reservaron (entregas previas)
        let totalReservaRequerida = 0;
        for (const res of reservations) {
          totalReservaRequerida += res.cantidad;
        }
        const yaReservadoPrevio = Math.min(totalReservaRequerida, yaRecibidoEsteProducto);
        const reservaPendiente = totalReservaRequerida - yaReservadoPrevio;

        let unidadesRestantes = pr.cantidadRecibida;

        const datosBaseLote = {
          productoId: pr.productoId,
          lote: `OC-${orden.numeroOrden}`,
          fechaVencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          almacenId: orden.almacenDestino,
          costoUnitarioUSD: costoUnitarioReal,
          ordenCompraId: id,
          ordenCompraNumero: orden.numeroOrden,
          fechaRecepcion: new Date(),
          tcCompra: orden.tcCompra,
          tcPago: orden.tcPago
        };

        // Crear lotes reservados (solo si quedan reservas pendientes)
        if (reservaPendiente > 0 && reservations.length > 0) {
          // Distribuir la reserva pendiente entre los requerimientos
          let reservaPendienteRestante = reservaPendiente;
          let yaConsumidoPrevio = yaReservadoPrevio;

          for (const reserva of reservations) {
            if (unidadesRestantes <= 0 || reservaPendienteRestante <= 0) break;
            if (!reserva.cotizacionId) continue;

            // Cuánto de esta reserva específica ya se cubrió en entregas previas
            const consumidoDeEstaReserva = Math.min(reserva.cantidad, yaConsumidoPrevio);
            yaConsumidoPrevio -= consumidoDeEstaReserva;
            const pendienteDeEstaReserva = reserva.cantidad - consumidoDeEstaReserva;

            if (pendienteDeEstaReserva <= 0) continue;

            const cantReservar = Math.min(pendienteDeEstaReserva, unidadesRestantes);

            const reservadasIds = await unidadService.crearLote(
              {
                ...datosBaseLote,
                cantidad: cantReservar,
                estadoInicial: 'reservada',
                reservadoPara: reserva.cotizacionId,
                requerimientoId: reserva.requerimientoId
              },
              userId,
              { sku: productoInfo.sku, nombre: productoInfo.nombreComercial },
              almacenInfo
            );

            unidadesGeneradas.push(...reservadasIds);
            unidadesReservadas.push(...reservadasIds);
            unidadesRestantes -= cantReservar;
            reservaPendienteRestante -= cantReservar;

            logger.success(`  → ${cantReservar} unidades de ${productoInfo.sku} RESERVADAS para cotización ${reserva.cotizacionId}`);
          }
        }

        // Crear unidades DISPONIBLES (excedente o sin requerimiento)
        if (unidadesRestantes > 0) {
          const disponiblesIds = await unidadService.crearLote(
            {
              ...datosBaseLote,
              cantidad: unidadesRestantes
            },
            userId,
            { sku: productoInfo.sku, nombre: productoInfo.nombreComercial },
            almacenInfo
          );

          unidadesGeneradas.push(...disponiblesIds);
          unidadesDisponibles.push(...disponiblesIds);
        }

        totalUnidadesRecepcion += pr.cantidadRecibida;
      }

      // Actualizar cantidadRecibida en productos de la OC
      const productosActualizados = orden.productos.map(p => {
        const recibido = productosValidos.find(pr => pr.productoId === p.productoId);
        if (recibido) {
          return {
            ...p,
            cantidadRecibida: (p.cantidadRecibida || 0) + recibido.cantidadRecibida
          };
        }
        return p;
      });

      // Determinar si es recepción final
      const esRecepcionFinal = productosActualizados.every(
        p => (p.cantidadRecibida || 0) >= p.cantidad
      );

      // Crear registro de recepción parcial
      const recepcionesPrevias = orden.recepcionesParciales || [];
      const recepcionNumero = recepcionesPrevias.length + 1;
      const recepcionId = `REC-${Date.now()}`;

      const nuevaRecepcion: RecepcionParcial = {
        id: recepcionId,
        fecha: Timestamp.now(),
        numero: recepcionNumero,
        productosRecibidos: productosValidos.map(pr => {
          const productoOC = orden.productos.find(p => p.productoId === pr.productoId)!;
          return {
            productoId: pr.productoId,
            cantidadRecibida: pr.cantidadRecibida,
            cantidadAcumulada: (productoOC.cantidadRecibida || 0) + pr.cantidadRecibida
          };
        }),
        unidadesGeneradas,
        unidadesReservadas,
        unidadesDisponibles,
        totalUnidadesRecepcion,
        costoAdicionalPorUnidad,
        registradoPor: userId,
        ...(observaciones ? { observaciones } : {})
      };

      // Actualizar contadores del almacén
      const valorRecepcionUSD = productosValidos.reduce((sum, pr) => {
        const productoOC = orden.productos.find(p => p.productoId === pr.productoId)!;
        return sum + (pr.cantidadRecibida * (productoOC.costoUnitario + costoAdicionalPorUnidad));
      }, 0);

      await almacenService.incrementarUnidadesRecibidas(orden.almacenDestino, totalUnidadesRecepcion);
      await almacenService.actualizarValorInventario(orden.almacenDestino, valorRecepcionUSD);

      // Sincronizar stock de productos afectados
      const productosAfectados = productosValidos.map(pr => pr.productoId);
      await inventarioService.sincronizarStockProductos_batch(productosAfectados);

      // Acumular unidades generadas globales
      const todasUnidadesGeneradas = [...(orden.unidadesGeneradas || []), ...unidadesGeneradas];
      const totalUnidadesRecibidasGlobal = (orden.totalUnidadesRecibidas || 0) + totalUnidadesRecepcion;

      // Preparar actualización de la OC
      const ocUpdates: any = {
        productos: productosActualizados,
        recepcionesParciales: [...recepcionesPrevias, nuevaRecepcion],
        unidadesGeneradas: todasUnidadesGeneradas,
        totalUnidadesRecibidas: totalUnidadesRecibidasGlobal,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      };

      if (esRecepcionFinal) {
        ocUpdates.estado = 'recibida';
        ocUpdates.fechaRecibida = Timestamp.now();
        ocUpdates.inventarioGenerado = true;
        ocUpdates.cotizacionVinculada = cotizacionId || null;
      } else {
        ocUpdates.estado = 'recibida_parcial';
        if (!orden.fechaPrimeraRecepcion) {
          ocUpdates.fechaPrimeraRecepcion = Timestamp.now();
        }
      }

      await updateDoc(doc(db, ORDENES_COLLECTION, id), ocUpdates);

      // Marcar requerimientos como completados SOLO si es recepción final
      // y TODOS sus productos están completos
      if (esRecepcionFinal) {
        for (const reqId of reqIds) {
          try {
            await ExpectativaService.actualizarEstado(reqId, 'completado', userId);
          } catch (error) {
            console.error(`Error al marcar requerimiento ${reqId} como completado:`, error);
          }
        }
      }

      // Log resumen
      logger.success(`OC ${orden.numeroOrden} - Recepción #${recepcionNumero}: ${totalUnidadesRecepcion} unidades (${unidadesReservadas.length} reservadas, ${unidadesDisponibles.length} disponibles)${esRecepcionFinal ? ' - RECEPCIÓN FINAL' : ''}`);

      return {
        recepcionId,
        unidadesGeneradas,
        unidadesReservadas,
        unidadesDisponibles,
        esRecepcionFinal,
        cotizacionVinculada: cotizacionId
      };
    } catch (error: any) {
      console.error('Error al recibir orden parcial:', error);
      throw new Error(error.message || 'Error al recibir orden parcial');
    }
  }

  /**
   * Recibir orden completa (wrapper que delega a recibirOrdenParcial)
   * Recibe TODO lo pendiente de una sola vez
   */
  static async recibirOrden(id: string, userId: string): Promise<{
    unidadesGeneradas: string[];
    unidadesReservadas: string[];
    unidadesDisponibles: string[];
    cotizacionVinculada?: string;
  }> {
    const orden = await this.getById(id);
    if (!orden) {
      throw new Error('Orden no encontrada');
    }

    // Calcular todo lo pendiente
    const productosRecibidos = orden.productos
      .map(p => ({
        productoId: p.productoId,
        cantidadRecibida: p.cantidad - (p.cantidadRecibida || 0)
      }))
      .filter(p => p.cantidadRecibida > 0);

    if (productosRecibidos.length === 0) {
      throw new Error('Todos los productos ya fueron recibidos');
    }

    const result = await this.recibirOrdenParcial(id, productosRecibidos, userId, 'Recepción completa');

    return {
      unidadesGeneradas: result.unidadesGeneradas,
      unidadesReservadas: result.unidadesReservadas,
      unidadesDisponibles: result.unidadesDisponibles,
      cotizacionVinculada: result.cotizacionVinculada
    };
  }

  /**
   * Eliminar orden (solo si no ha generado inventario)
   * Permite eliminar borradores, enviadas y en tránsito que no tengan recepciones
   */
  static async delete(id: string): Promise<void> {
    try {
      const orden = await this.getById(id);
      if (!orden) {
        throw new Error('Orden no encontrada');
      }

      // Bloquear eliminación si ya tiene unidades generadas
      const tieneInventario = (orden.unidadesGeneradas?.length ?? 0) > 0
        || (orden.recepcionesParciales?.length ?? 0) > 0
        || orden.inventarioGenerado === true;

      if (tieneInventario) {
        throw new Error('No se puede eliminar una orden que ya generó inventario. Usa "Revertir Recepciones" primero.');
      }

      // Solo permitir eliminar estados sin impacto
      const estadosPermitidos: EstadoOrden[] = ['borrador', 'enviada', 'en_transito', 'cancelada'];
      if (!estadosPermitidos.includes(orden.estado)) {
        throw new Error(`No se puede eliminar una orden en estado "${orden.estado}"`);
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
        recibidasParcial: 0,
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
        else if (orden.estado === 'recibida_parcial') stats.recibidasParcial++;
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
  // LIMPIEZA DE DATOS DE PRUEBA
  // ========================================

  /**
   * Revertir TODAS las recepciones parciales de una OC
   * Elimina las unidades generadas, revierte el estado de la OC y limpia los contadores
   * USO: Solo para limpiar datos de prueba. No usar en producción con datos reales.
   */
  static async revertirRecepciones(
    ordenId: string,
    userId: string
  ): Promise<{
    unidadesEliminadas: number;
    recepcionesEliminadas: number;
    estadoRestaurado: string;
  }> {
    try {
      const orden = await this.getById(ordenId);
      if (!orden) throw new Error('Orden no encontrada');

      if (!['recibida_parcial', 'recibida'].includes(orden.estado)) {
        throw new Error('La orden no tiene recepciones que revertir');
      }

      const recepciones = orden.recepcionesParciales || [];
      const todasUnidadesGeneradas = orden.unidadesGeneradas || [];

      // 1. Eliminar todas las unidades generadas de Firestore
      let unidadesEliminadas = 0;
      const batchSize = 400;
      for (let i = 0; i < todasUnidadesGeneradas.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = todasUnidadesGeneradas.slice(i, i + batchSize);
        for (const unidadId of chunk) {
          batch.delete(doc(db, 'unidades', unidadId));
          unidadesEliminadas++;
        }
        await batch.commit();
      }

      // 2. Calcular valor total a restar del almacén
      const totalUnidadesOrden = orden.productos.reduce((sum, p) => sum + p.cantidad, 0);
      const costosAdicionales = (orden.impuestoUSD || 0) + (orden.gastosEnvioUSD || 0) + (orden.otrosGastosUSD || 0);
      const costoAdicionalPorUnidad = totalUnidadesOrden > 0 ? costosAdicionales / totalUnidadesOrden : 0;

      const totalUnidadesRecibidas = orden.totalUnidadesRecibidas || 0;
      const valorARestar = orden.productos.reduce((sum, p) => {
        const recibido = p.cantidadRecibida || 0;
        return sum + (recibido * (p.costoUnitario + costoAdicionalPorUnidad));
      }, 0);

      // 3. Restar del almacén
      if (orden.almacenDestino && totalUnidadesRecibidas > 0) {
        await almacenService.incrementarUnidadesRecibidas(orden.almacenDestino, -totalUnidadesRecibidas);
      }

      // 4. Restaurar productos a cantidadRecibida = 0
      const productosRestaurados = orden.productos.map(p => ({
        ...p,
        cantidadRecibida: 0
      }));

      // 5. Determinar estado previo (antes de cualquier recepción)
      const estadoRestaurado = 'en_transito';

      // 6. Actualizar la OC
      const updates: any = {
        estado: estadoRestaurado,
        productos: productosRestaurados,
        recepcionesParciales: [],
        unidadesGeneradas: [],
        totalUnidadesRecibidas: 0,
        inventarioGenerado: false,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      };

      // Limpiar campos de recepción
      await updateDoc(doc(db, ORDENES_COLLECTION, ordenId), updates);

      // 7. Sincronizar stock de productos afectados
      const productosAfectados = orden.productos.map(p => p.productoId);
      await inventarioService.sincronizarStockProductos_batch(productosAfectados);

      console.log(`[LIMPIEZA] OC ${orden.numeroOrden}: ${unidadesEliminadas} unidades eliminadas, ${recepciones.length} recepciones revertidas, estado → ${estadoRestaurado}`);

      return {
        unidadesEliminadas,
        recepcionesEliminadas: recepciones.length,
        estadoRestaurado
      };
    } catch (error: any) {
      console.error('Error al revertir recepciones:', error);
      throw new Error(error.message || 'Error al revertir recepciones');
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

    // Obtener precios de todos los productos en paralelo para mejor performance
    const preciosPromises = productoIds.map(id =>
      this.getPreciosHistoricos(id).then(precios => ({ productoId: id, precios }))
    );

    const todosLosPrecios = await Promise.all(preciosPromises);

    for (const { productoId, precios } of todosLosPrecios) {
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