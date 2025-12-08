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
  Unidad, 
  UnidadFormData, 
  EstadoUnidad, 
  Almacen,
  MovimientoUnidad,
  ResumenInventario,
  StockPorAlmacen
} from '../types/producto.types';

const COLLECTION_NAME = 'unidades';

export class InventarioService {
  /**
   * Obtener todas las unidades de un producto
   */
  static async getByProducto(productoId: string): Promise<Unidad[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('productoId', '==', productoId),
        orderBy('numeroUnidad', 'asc')
      );
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Unidad));
    } catch (error: any) {
      console.error('Error al obtener unidades:', error);
      throw new Error('Error al cargar inventario');
    }
  }

  /**
   * Obtener unidades por almacén
   */
  static async getByAlmacen(almacen: Almacen): Promise<Unidad[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('almacenActual', '==', almacen),
        orderBy('fechaCreacion', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Unidad));
    } catch (error: any) {
      console.error('Error al obtener unidades por almacén:', error);
      throw new Error('Error al cargar inventario');
    }
  }

  /**
   * Obtener unidades por estado
   */
  static async getByEstado(estado: EstadoUnidad): Promise<Unidad[]> {
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
      } as Unidad));
    } catch (error: any) {
      console.error('Error al obtener unidades por estado:', error);
      throw new Error('Error al cargar inventario');
    }
  }

  /**
   * Crear unidades (recepción en almacén)
   */
  static async crearUnidades(
    data: UnidadFormData, 
    sku: string,
    userId: string
  ): Promise<Unidad[]> {
    try {
      const batch = writeBatch(db);
      const unidadesCreadas: Unidad[] = [];
      
      // Obtener el último número de unidad para este producto
      const ultimoNumero = await this.getUltimoNumeroUnidad(data.productoId);
      
      // Calcular CTRU
      const costoPEN = data.costoUSA * data.tcPago;
      const ctru = costoPEN;
      
      // Determinar estado según almacén
      const estado: EstadoUnidad = data.almacenDestino.startsWith('peru') 
        ? 'disponible_peru' 
        : 'recibida_usa';
      
      const now = Timestamp.now();
      
      // Crear múltiples unidades
      for (let i = 0; i < data.cantidad; i++) {
        const numeroUnidad = ultimoNumero + i + 1;
        const codigoUnidad = `${sku}-${numeroUnidad.toString().padStart(4, '0')}`;
        
        const movimientoInicial: MovimientoUnidad = {
          fecha: now,
          tipo: 'recepcion',
          estadoAnterior: 'recibida_usa',
          estadoNuevo: estado,
          almacenDestino: data.almacenDestino,
          motivo: 'Recepción inicial en almacén',
          realizadoPor: userId
        };
        
        // Agregar observaciones solo si existen
        if (data.observaciones) {
          movimientoInicial.observaciones = data.observaciones;
        }
        
        // Crear objeto base sin campos opcionales undefined
        const nuevaUnidad: any = {
          productoId: data.productoId,
          sku,
          numeroUnidad,
          codigoUnidad,
          lote: data.lote,
          
          ctruInicial: ctru,
          ctruDinamico: ctru,
          tcCompra: data.tcCompra,
          tcPago: data.tcPago,
          costoUSA: data.costoUSA,
          costoPEN,
          
          estado,
          almacenActual: data.almacenDestino,
          
          fechaOrigen: now,
          
          historial: [movimientoInicial],
          
          creadoPor: userId,
          fechaCreacion: serverTimestamp()
        };
        
        // Agregar campos opcionales solo si existen
        if (data.fechaVencimiento) {
          nuevaUnidad.fechaVencimiento = Timestamp.fromDate(data.fechaVencimiento);
        }
        
        if (estado === 'recibida_usa') {
          nuevaUnidad.fechaRecepcionUSA = now;
        }
        
        if (estado === 'disponible_peru') {
          nuevaUnidad.fechaLlegadaPeru = now;
        }
        
        if (data.ordenCompraId) {
          nuevaUnidad.ordenCompraId = data.ordenCompraId;
        }
        
        if (data.numeroTracking) {
          nuevaUnidad.numeroTracking = data.numeroTracking;
        }
        
        if (data.courier) {
          nuevaUnidad.courier = data.courier;
        }
        
        const docRef = doc(collection(db, COLLECTION_NAME));
        batch.set(docRef, nuevaUnidad);
        
        unidadesCreadas.push({
          id: docRef.id,
          ...nuevaUnidad,
          fechaCreacion: now
        } as Unidad);
      }
      
      await batch.commit();
      
      return unidadesCreadas;
    } catch (error: any) {
      console.error('Error al crear unidades:', error);
      throw new Error('Error al crear inventario');
    }
  }

  /**
   * Mover unidad entre almacenes
   */
  static async moverUnidad(
    unidadId: string,
    almacenDestino: Almacen,
    motivo: string,
    userId: string,
    observaciones?: string
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, unidadId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Unidad no encontrada');
      }
      
      const unidad = docSnap.data() as Unidad;
      
      // Determinar nuevo estado según almacén destino
      let nuevoEstado: EstadoUnidad = unidad.estado;
      
      if (almacenDestino.startsWith('peru') && unidad.almacenActual.startsWith('miami')) {
        nuevoEstado = 'en_transito';
      } else if (almacenDestino.startsWith('peru') && unidad.estado === 'en_transito') {
        nuevoEstado = 'disponible_peru';
      }
      
      const movimiento: MovimientoUnidad = {
        fecha: Timestamp.now(),
        tipo: 'traslado',
        estadoAnterior: unidad.estado,
        estadoNuevo: nuevoEstado,
        almacenOrigen: unidad.almacenActual,
        almacenDestino,
        motivo,
        realizadoPor: userId
      };
      
      if (observaciones) {
        movimiento.observaciones = observaciones;
      }
      
      const updates: any = {
        estado: nuevoEstado,
        almacenActual: almacenDestino,
        historial: [...unidad.historial, movimiento],
        ultimaEdicion: serverTimestamp()
      };
      
      // Actualizar fechas según el movimiento
      if (nuevoEstado === 'en_transito') {
        updates.fechaSalidaUSA = Timestamp.now();
      } else if (nuevoEstado === 'disponible_peru') {
        updates.fechaLlegadaPeru = Timestamp.now();
      }
      
      await updateDoc(docRef, updates);
    } catch (error: any) {
      console.error('Error al mover unidad:', error);
      throw new Error('Error al mover unidad');
    }
  }

  /**
   * Cambiar estado de unidad
   */
  static async cambiarEstado(
    unidadId: string,
    nuevoEstado: EstadoUnidad,
    motivo: string,
    userId: string,
    observaciones?: string
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, unidadId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Unidad no encontrada');
      }
      
      const unidad = docSnap.data() as Unidad;
      
      const movimiento: MovimientoUnidad = {
        fecha: Timestamp.now(),
        tipo: 'ajuste',
        estadoAnterior: unidad.estado,
        estadoNuevo: nuevoEstado,
        motivo,
        realizadoPor: userId
      };
      
      if (observaciones) {
        movimiento.observaciones = observaciones;
      }
      
      const updates: any = {
        estado: nuevoEstado,
        historial: [...unidad.historial, movimiento],
        ultimaEdicion: serverTimestamp()
      };
      
      await updateDoc(docRef, updates);
    } catch (error: any) {
      console.error('Error al cambiar estado:', error);
      throw new Error('Error al actualizar estado');
    }
  }

  /**
   * Obtener resumen de inventario por producto
   */
  static async getResumenPorProducto(productoId: string): Promise<ResumenInventario> {
    try {
      const unidades = await this.getByProducto(productoId);
      
      const stockPorAlmacen: { [key: string]: StockPorAlmacen } = {
        miami_1: { almacen: 'miami_1', nombreAlmacen: 'Miami 1', cantidad: 0, unidades: [] },
        miami_2: { almacen: 'miami_2', nombreAlmacen: 'Miami 2', cantidad: 0, unidades: [] },
        utah: { almacen: 'utah', nombreAlmacen: 'Utah', cantidad: 0, unidades: [] },
        peru_principal: { almacen: 'peru_principal', nombreAlmacen: 'Perú Principal', cantidad: 0, unidades: [] },
        peru_secundario: { almacen: 'peru_secundario', nombreAlmacen: 'Perú Secundario', cantidad: 0, unidades: [] }
      };
      
      let unidadesUSA = 0;
      let unidadesPeru = 0;
      let unidadesTransito = 0;
      let unidadesDisponibles = 0;
      let unidadesAsignadas = 0;
      let valorTotalPEN = 0;
      
      unidades.forEach(unidad => {
        // Contar por almacén
        if (stockPorAlmacen[unidad.almacenActual]) {
          stockPorAlmacen[unidad.almacenActual].cantidad++;
          stockPorAlmacen[unidad.almacenActual].unidades.push(unidad);
        }
        
        // Contar por ubicación
        if (unidad.almacenActual.startsWith('miami') || unidad.almacenActual === 'utah') {
          unidadesUSA++;
        } else if (unidad.almacenActual.startsWith('peru')) {
          unidadesPeru++;
        }
        
        // Contar por estado
        if (unidad.estado === 'en_transito') unidadesTransito++;
        if (unidad.estado === 'disponible_peru') unidadesDisponibles++;
        if (unidad.estado === 'asignada_pedido') unidadesAsignadas++;
        
        // Valor total
        valorTotalPEN += unidad.ctruDinamico;
      });
      
      return {
        totalUnidades: unidades.length,
        unidadesUSA,
        unidadesPeru,
        unidadesTransito,
        unidadesDisponibles,
        unidadesAsignadas,
        valorTotalPEN,
        stockPorAlmacen: Object.values(stockPorAlmacen).filter(s => s.cantidad > 0)
      };
    } catch (error: any) {
      console.error('Error al obtener resumen:', error);
      throw new Error('Error al generar resumen');
    }
  }

  /**
   * Obtener último número de unidad para un producto
   */
  private static async getUltimoNumeroUnidad(productoId: string): Promise<number> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('productoId', '==', productoId),
        orderBy('numeroUnidad', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return 0;
      }
      
      const ultimaUnidad = snapshot.docs[0].data() as Unidad;
      return ultimaUnidad.numeroUnidad;
    } catch (error) {
      return 0;
    }
  }
}