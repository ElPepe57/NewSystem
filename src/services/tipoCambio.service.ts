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
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { 
  TipoCambio, 
  TipoCambioFormData, 
  TipoCambioStats,
  TipoCambioHistorial
} from '../types/tipoCambio.types';

const COLLECTION_NAME = 'tiposCambio';

export class TipoCambioService {
  /**
   * Obtener todos los tipos de cambio
   */
  static async getAll(): Promise<TipoCambio[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('fecha', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TipoCambio));
    } catch (error: any) {
      console.error('Error al obtener tipos de cambio:', error);
      throw new Error('Error al cargar tipos de cambio');
    }
  }

  /**
   * Obtener tipos de cambio por rango de fechas
   */
  static async getByDateRange(fechaInicio: Date, fechaFin: Date): Promise<TipoCambio[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('fecha', '>=', Timestamp.fromDate(fechaInicio)),
        where('fecha', '<=', Timestamp.fromDate(fechaFin)),
        orderBy('fecha', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TipoCambio));
    } catch (error: any) {
      console.error('Error al obtener tipos de cambio por rango:', error);
      throw new Error('Error al cargar tipos de cambio');
    }
  }

  /**
   * Obtener tipo de cambio por fecha específica
   */
  static async getByFecha(fecha: Date): Promise<TipoCambio | null> {
    try {
      // Crear rango de la fecha (inicio y fin del día)
      const inicioDelDia = new Date(fecha);
      inicioDelDia.setHours(0, 0, 0, 0);
      
      const finDelDia = new Date(fecha);
      finDelDia.setHours(23, 59, 59, 999);
      
      const q = query(
        collection(db, COLLECTION_NAME),
        where('fecha', '>=', Timestamp.fromDate(inicioDelDia)),
        where('fecha', '<=', Timestamp.fromDate(finDelDia)),
        limit(1)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }
      
      return {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      } as TipoCambio;
    } catch (error: any) {
      console.error('Error al obtener tipo de cambio por fecha:', error);
      throw new Error('Error al cargar tipo de cambio');
    }
  }

  /**
   * Obtener el tipo de cambio más reciente
   */
  static async getLatest(): Promise<TipoCambio | null> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('fecha', 'desc'),
        limit(1)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }
      
      return {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      } as TipoCambio;
    } catch (error: any) {
      console.error('Error al obtener último tipo de cambio:', error);
      throw new Error('Error al cargar tipo de cambio');
    }
  }

  /**
   * Crear nuevo tipo de cambio
   */
  static async create(data: TipoCambioFormData, userId: string): Promise<TipoCambio> {
    try {
      // Verificar si ya existe un TC para esta fecha
      const existente = await this.getByFecha(data.fecha);
      if (existente) {
        throw new Error('Ya existe un tipo de cambio registrado para esta fecha');
      }
      
      // Obtener TC del día anterior para calcular variación
      const fechaAnterior = new Date(data.fecha);
      fechaAnterior.setDate(fechaAnterior.getDate() - 1);
      const tcAnterior = await this.getByFecha(fechaAnterior);
      
      // Calcular promedio
      const promedio = (data.compra + data.venta) / 2;
      
      // Calcular variaciones
      let variacionCompra = 0;
      let variacionVenta = 0;
      let alertaVariacion = false;
      
      if (tcAnterior) {
        variacionCompra = ((data.compra - tcAnterior.compra) / tcAnterior.compra) * 100;
        variacionVenta = ((data.venta - tcAnterior.venta) / tcAnterior.venta) * 100;
        
        // Alerta si variación es mayor a 3%
        if (Math.abs(variacionCompra) > 3 || Math.abs(variacionVenta) > 3) {
          alertaVariacion = true;
        }
      }
      
      const nuevoTC: any = {
        fecha: Timestamp.fromDate(data.fecha),
        compra: data.compra,
        venta: data.venta,
        promedio,
        fuente: data.fuente,
        creadoPor: userId,
        fechaCreacion: serverTimestamp()
      };
      
      // Agregar campos opcionales solo si existen
      if (data.observaciones) {
        nuevoTC.observaciones = data.observaciones;
      }
      
      if (tcAnterior) {
        nuevoTC.variacionCompra = variacionCompra;
        nuevoTC.variacionVenta = variacionVenta;
        nuevoTC.alertaVariacion = alertaVariacion;
      }
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevoTC);
      
      return {
        id: docRef.id,
        ...nuevoTC,
        fechaCreacion: Timestamp.now()
      } as TipoCambio;
    } catch (error: any) {
      console.error('Error al crear tipo de cambio:', error);
      throw new Error(error.message || 'Error al crear tipo de cambio');
    }
  }

  /**
   * Actualizar tipo de cambio
   */
  static async update(id: string, data: Partial<TipoCambioFormData>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      
      const updates: any = {
        ultimaEdicion: serverTimestamp()
      };
      
      if (data.compra !== undefined) updates.compra = data.compra;
      if (data.venta !== undefined) updates.venta = data.venta;
      if (data.fuente !== undefined) updates.fuente = data.fuente;
      if (data.observaciones !== undefined) updates.observaciones = data.observaciones;
      
      // Recalcular promedio si se actualizaron compra o venta
      if (data.compra !== undefined || data.venta !== undefined) {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const tc = docSnap.data() as TipoCambio;
          const compra = data.compra !== undefined ? data.compra : tc.compra;
          const venta = data.venta !== undefined ? data.venta : tc.venta;
          updates.promedio = (compra + venta) / 2;
        }
      }
      
      await updateDoc(docRef, updates);
    } catch (error: any) {
      console.error('Error al actualizar tipo de cambio:', error);
      throw new Error('Error al actualizar tipo de cambio');
    }
  }

  /**
   * Eliminar tipo de cambio
   */
  static async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error: any) {
      console.error('Error al eliminar tipo de cambio:', error);
      throw new Error('Error al eliminar tipo de cambio');
    }
  }

  /**
   * Obtener estadísticas
   */
  static async getStats(): Promise<TipoCambioStats> {
    try {
      const tcActual = await this.getLatest();
      
      if (!tcActual) {
        return {
          tcActual: null,
          tcAnterior: null,
          variacionCompra: 0,
          variacionVenta: 0,
          promedioSemana: 0,
          promedioMes: 0,
          minimo30Dias: 0,
          maximo30Dias: 0
        };
      }
      
      // Obtener TC del día anterior
      const fechaAnterior = new Date(tcActual.fecha.toDate());
      fechaAnterior.setDate(fechaAnterior.getDate() - 1);
      const tcAnterior = await this.getByFecha(fechaAnterior);
      
      // Obtener últimos 30 días
      const hace30Dias = new Date();
      hace30Dias.setDate(hace30Dias.getDate() - 30);
      const ultimos30Dias = await this.getByDateRange(hace30Dias, new Date());
      
      // Calcular estadísticas
      const variacionCompra = tcAnterior 
        ? ((tcActual.compra - tcAnterior.compra) / tcAnterior.compra) * 100 
        : 0;
        
      const variacionVenta = tcAnterior 
        ? ((tcActual.venta - tcAnterior.venta) / tcAnterior.venta) * 100 
        : 0;
      
      const ultimos7Dias = ultimos30Dias.slice(0, 7);
      const promedioSemana = ultimos7Dias.length > 0
        ? ultimos7Dias.reduce((sum, tc) => sum + tc.promedio, 0) / ultimos7Dias.length
        : 0;
      
      const promedioMes = ultimos30Dias.length > 0
        ? ultimos30Dias.reduce((sum, tc) => sum + tc.promedio, 0) / ultimos30Dias.length
        : 0;
      
      const minimo30Dias = ultimos30Dias.length > 0
        ? Math.min(...ultimos30Dias.map(tc => tc.compra))
        : 0;
      
      const maximo30Dias = ultimos30Dias.length > 0
        ? Math.max(...ultimos30Dias.map(tc => tc.venta))
        : 0;
      
      return {
        tcActual,
        tcAnterior,
        variacionCompra,
        variacionVenta,
        promedioSemana,
        promedioMes,
        minimo30Dias,
        maximo30Dias
      };
    } catch (error: any) {
      console.error('Error al obtener estadísticas:', error);
      throw new Error('Error al generar estadísticas');
    }
  }

  /**
   * Obtener historial para gráfico
   */
  static async getHistorial(dias: number = 30): Promise<TipoCambioHistorial[]> {
    try {
      const fechaInicio = new Date();
      fechaInicio.setDate(fechaInicio.getDate() - dias);
      
      const tipos = await this.getByDateRange(fechaInicio, new Date());
      
      return tipos.map(tc => ({
        fecha: tc.fecha.toDate().toLocaleDateString('es-PE'),
        compra: tc.compra,
        venta: tc.venta,
        promedio: tc.promedio
      })).reverse();
    } catch (error: any) {
      console.error('Error al obtener historial:', error);
      throw new Error('Error al cargar historial');
    }
  }
}