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
  Venta, 
  VentaFormData, 
  EstadoVenta,
  VentaStats,
  ProductoVenta,
  AsignacionUnidad,
  ResultadoAsignacion,
  ProductoDisponible
} from '../types/venta.types';
import type { Unidad } from '../types/producto.types';
import { ProductoService } from './producto.service';
import { InventarioService } from './inventario.service';

const COLLECTION_NAME = 'ventas';

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
   */
  static async getProductosDisponibles(): Promise<ProductoDisponible[]> {
    try {
      const productos = await ProductoService.getAll();
      const productosDisponibles: ProductoDisponible[] = [];
      
      for (const producto of productos) {
        if (producto.estado !== 'activo') continue;
        
        // Obtener unidades disponibles en Perú
        const unidades = await InventarioService.getByProducto(producto.id);
        const unidadesDisponibles = unidades.filter(u => u.estado === 'disponible_peru');
        
        if (unidadesDisponibles.length > 0) {
          productosDisponibles.push({
            productoId: producto.id,
            sku: producto.sku,
            marca: producto.marca,
            nombreComercial: producto.nombreComercial,
            presentacion: producto.presentacion,
            unidadesDisponibles: unidadesDisponibles.length,
            precioSugerido: producto.precioSugerido || 0,
            margenObjetivo: producto.margenObjetivo || 0
          });
        }
      }
      
      return productosDisponibles;
    } catch (error: any) {
      console.error('Error al obtener productos disponibles:', error);
      throw new Error('Error al cargar productos');
    }
  }

  /**
   * Crear venta (cotización o venta directa)
   */
  static async create(data: VentaFormData, userId: string, esVentaDirecta: boolean = false): Promise<Venta> {
    try {
      // Validar disponibilidad de productos
      for (const prod of data.productos) {
        const unidades = await InventarioService.getByProducto(prod.productoId);
        const disponibles = unidades.filter(u => u.estado === 'disponible_peru');
        
        if (disponibles.length < prod.cantidad) {
          const producto = await ProductoService.getById(prod.productoId);
          throw new Error(
            `Stock insuficiente para ${producto?.marca} ${producto?.nombreComercial}. ` +
            `Disponibles: ${disponibles.length}, Solicitados: ${prod.cantidad}`
          );
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
      const totalPEN = subtotalPEN - descuento;
      
      // Generar número de venta
      const numeroVenta = await this.generateNumeroVenta();
      
      const nuevaVenta: any = {
        numeroVenta,
        nombreCliente: data.nombreCliente,
        canal: data.canal,
        productos: productosVenta,
        subtotalPEN,
        totalPEN,
        estado: esVentaDirecta ? 'confirmada' : 'cotizacion',
        creadoPor: userId,
        fechaCreacion: serverTimestamp()
      };
      
      // Agregar campos opcionales
      if (descuento > 0) nuevaVenta.descuento = descuento;
      if (data.emailCliente) nuevaVenta.emailCliente = data.emailCliente;
      if (data.telefonoCliente) nuevaVenta.telefonoCliente = data.telefonoCliente;
      if (data.direccionEntrega) nuevaVenta.direccionEntrega = data.direccionEntrega;
      if (data.dniRuc) nuevaVenta.dniRuc = data.dniRuc;
      if (data.mercadoLibreId) nuevaVenta.mercadoLibreId = data.mercadoLibreId;
      if (data.observaciones) nuevaVenta.observaciones = data.observaciones;
      
      if (esVentaDirecta) {
        nuevaVenta.fechaConfirmacion = serverTimestamp();
      }
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevaVenta);
      
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
   * Convertir cotización a venta confirmada
   */
  static async confirmarCotizacion(id: string, userId: string): Promise<void> {
    try {
      const venta = await this.getById(id);
      if (!venta) {
        throw new Error('Venta no encontrada');
      }
      
      if (venta.estado !== 'cotizacion') {
        throw new Error('Solo se pueden confirmar cotizaciones');
      }
      
      await updateDoc(doc(db, COLLECTION_NAME, id), {
        estado: 'confirmada',
        fechaConfirmacion: serverTimestamp(),
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });
    } catch (error: any) {
      console.error('Error al confirmar cotización:', error);
      throw new Error(error.message || 'Error al confirmar cotización');
    }
  }

  /**
   * Asignar inventario con lógica FEFO (First Expire, First Out)
   */
  static async asignarInventario(id: string, userId: string): Promise<ResultadoAsignacion[]> {
    try {
      const venta = await this.getById(id);
      if (!venta) {
        throw new Error('Venta no encontrada');
      }
      
      if (venta.estado !== 'confirmada') {
        throw new Error('Solo se puede asignar inventario a ventas confirmadas');
      }
      
      const batch = writeBatch(db);
      const resultados: ResultadoAsignacion[] = [];
      const productosActualizados: ProductoVenta[] = [];
      let costoTotalPEN = 0;
      
      // Asignar unidades para cada producto usando FEFO
      for (const producto of venta.productos) {
        const resultado = await this.asignarUnidadesFEFO(producto.productoId, producto.cantidad);
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
   */
  private static async asignarUnidadesFEFO(
    productoId: string,
    cantidad: number
  ): Promise<ResultadoAsignacion> {
    try {
      // Obtener todas las unidades disponibles del producto en Perú
      const todasUnidades = await InventarioService.getByProducto(productoId);
      const unidadesDisponibles = todasUnidades.filter(u => u.estado === 'disponible_peru');
      
      // Ordenar por fecha de vencimiento (FEFO)
      // Primero las que vencen (si tienen fecha), luego las sin fecha por fecha de llegada
      const unidadesOrdenadas = unidadesDisponibles.sort((a, b) => {
        // Si ambas tienen fecha de vencimiento, ordenar por la que vence primero
        if (a.fechaVencimiento && b.fechaVencimiento) {
          return a.fechaVencimiento.toMillis() - b.fechaVencimiento.toMillis();
        }
        // Si solo 'a' tiene vencimiento, va primero
        if (a.fechaVencimiento) return -1;
        // Si solo 'b' tiene vencimiento, va primero
        if (b.fechaVencimiento) return 1;
        // Si ninguna tiene vencimiento, ordenar por fecha de llegada a Perú
        if (a.fechaLlegadaPeru && b.fechaLlegadaPeru) {
          return a.fechaLlegadaPeru.toMillis() - b.fechaLlegadaPeru.toMillis();
        }
        return 0;
      });
      
      // Tomar las primeras N unidades (las que vencen primero)
      const unidadesAsignar = unidadesOrdenadas.slice(0, cantidad);
      
      const asignaciones: AsignacionUnidad[] = unidadesAsignar.map(u => ({
        unidadId: u.id,
        productoId: u.productoId,
        sku: u.sku,
        codigoUnidad: u.codigoUnidad,
        ctru: u.ctruDinamico,
        fechaVencimiento: u.fechaVencimiento
      }));
      
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
   */
  static async marcarEntregada(id: string, userId: string): Promise<void> {
    try {
      const venta = await this.getById(id);
      if (!venta) {
        throw new Error('Venta no encontrada');
      }
      
      if (venta.estado !== 'en_entrega' && venta.estado !== 'asignada') {
        throw new Error('Estado inválido para marcar como entregada');
      }
      
      const batch = writeBatch(db);
      
      // Actualizar estado de las unidades a "entregada"
      for (const producto of venta.productos) {
        if (producto.unidadesAsignadas) {
          for (const unidadId of producto.unidadesAsignadas) {
            const unidadRef = doc(db, 'unidades', unidadId);
            batch.update(unidadRef, {
              estado: 'entregada',
              fechaEntrega: serverTimestamp()
            });
          }
        }
      }
      
      // Actualizar venta
      const ventaRef = doc(db, COLLECTION_NAME, id);
      batch.update(ventaRef, {
        estado: 'entregada',
        fechaEntrega: serverTimestamp(),
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });
      
      await batch.commit();
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
      if (venta.estado === 'asignada' || venta.estado === 'en_entrega') {
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
      
      // Actualizar venta
      const ventaRef = doc(db, COLLECTION_NAME, id);
      const updates: any = {
        estado: 'cancelada',
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
        else if (venta.estado === 'asignada' || venta.estado === 'en_entrega') stats.enProceso++;
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
   * Generar número de venta
   */
  private static async generateNumeroVenta(): Promise<string> {
    try {
      const year = new Date().getFullYear();
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('fechaCreacion', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return `VT-${year}-001`;
      }
      
      const ultimaVenta = snapshot.docs[0].data() as Venta;
      const ultimoNumero = parseInt(ultimaVenta.numeroVenta.split('-')[2]);
      const nuevoNumero = (ultimoNumero + 1).toString().padStart(3, '0');
      
      return `VT-${year}-${nuevoNumero}`;
    } catch (error) {
      return `VT-${new Date().getFullYear()}-001`;
    }
  }
}