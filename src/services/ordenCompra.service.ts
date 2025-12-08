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
  OrdenCompra, 
  OrdenCompraFormData, 
  EstadoOrden,
  CambioEstadoOrden,
  OrdenCompraStats,
  Proveedor,
  ProveedorFormData,
  ProductoOrden
} from '../types/ordenCompra.types';
import { ProductoService } from './producto.service';
import { InventarioService } from './inventario.service';

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
      const gastosEnvio = data.gastosEnvioUSD || 0;
      const otrosGastos = data.otrosGastosUSD || 0;
      const totalUSD = subtotalUSD + gastosEnvio + otrosGastos;
      
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
        inventarioGenerado: false,
        creadoPor: userId,
        fechaCreacion: serverTimestamp()
      };
      
      // Agregar campos opcionales
      if (gastosEnvio > 0) nuevaOrden.gastosEnvioUSD = gastosEnvio;
      if (otrosGastos > 0) nuevaOrden.otrosGastosUSD = otrosGastos;
      if (data.tcCompra) nuevaOrden.tcCompra = data.tcCompra;
      if (data.almacenDestino) nuevaOrden.almacenDestino = data.almacenDestino;
      if (data.observaciones) nuevaOrden.observaciones = data.observaciones;
      
      const docRef = await addDoc(collection(db, ORDENES_COLLECTION), nuevaOrden);
      
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
      } else if (nuevoEstado === 'pagada' && !orden.fechaPagada) {
        updates.fechaPagada = Timestamp.now();
        
        if (datos?.tcPago) {
          updates.tcPago = datos.tcPago;
          updates.totalPEN = orden.totalUSD * datos.tcPago;
          
          // Calcular diferencia cambiaria si existe TC de compra
          if (orden.tcCompra) {
            const costoEnCompra = orden.totalUSD * orden.tcCompra;
            const costoEnPago = orden.totalUSD * datos.tcPago;
            updates.diferenciaCambiaria = costoEnPago - costoEnCompra;
          }
        }
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
   * Recibir orden y generar inventario automáticamente
   */
  static async recibirOrden(id: string, userId: string): Promise<string[]> {
    try {
      const orden = await this.getById(id);
      if (!orden) {
        throw new Error('Orden no encontrada');
      }
      
      if (orden.estado !== 'en_transito' && orden.estado !== 'pagada') {
        throw new Error('La orden debe estar en tránsito o pagada para ser recibida');
      }
      
      if (orden.inventarioGenerado) {
        throw new Error('El inventario ya fue generado para esta orden');
      }
      
      if (!orden.tcPago) {
        throw new Error('Se requiere TC de pago para generar inventario');
      }
      
      if (!orden.almacenDestino) {
        throw new Error('Se requiere almacén destino para generar inventario');
      }
      
      const unidadesGeneradas: string[] = [];
      
      // Generar inventario para cada producto
      for (const producto of orden.productos) {
        const unidades = await InventarioService.crearUnidades(
          {
            productoId: producto.productoId,
            cantidad: producto.cantidad,
            lote: `OC-${orden.numeroOrden}`,
            costoUSA: producto.costoUnitario,
            tcCompra: orden.tcCompra || orden.tcPago,
            tcPago: orden.tcPago,
            almacenDestino: orden.almacenDestino as any,
            ordenCompraId: id,
            numeroTracking: orden.numeroTracking,
            courier: orden.courier,
            observaciones: `Generado automáticamente desde ${orden.numeroOrden}`
          },
          producto.sku,
          userId
        );
        
        unidadesGeneradas.push(...unidades.map(u => u.id));
      }
      
      // Actualizar orden
      await updateDoc(doc(db, ORDENES_COLLECTION, id), {
        estado: 'recibida',
        fechaRecibida: Timestamp.now(),
        inventarioGenerado: true,
        unidadesGeneradas,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });
      
      return unidadesGeneradas;
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
        // Contar por estado
        if (orden.estado === 'borrador') stats.borradores++;
        else if (orden.estado === 'enviada') stats.enviadas++;
        else if (orden.estado === 'pagada') stats.pagadas++;
        else if (orden.estado === 'en_transito') stats.enTransito++;
        else if (orden.estado === 'recibida') stats.recibidas++;
        else if (orden.estado === 'cancelada') stats.canceladas++;
        
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
   * Generar número de orden
   */
  private static async generateNumeroOrden(): Promise<string> {
    try {
      const year = new Date().getFullYear();
      const q = query(
        collection(db, ORDENES_COLLECTION),
        orderBy('fechaCreacion', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return `OC-${year}-001`;
      }
      
      const ultimaOrden = snapshot.docs[0].data() as OrdenCompra;
      const ultimoNumero = parseInt(ultimaOrden.numeroOrden.split('-')[2]);
      const nuevoNumero = (ultimoNumero + 1).toString().padStart(3, '0');
      
      return `OC-${year}-${nuevoNumero}`;
    } catch (error) {
      return `OC-${new Date().getFullYear()}-001`;
    }
  }
}