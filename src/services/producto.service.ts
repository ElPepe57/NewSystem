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
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Producto, ProductoFormData } from '../types/producto.types';

const COLLECTION_NAME = 'productos';

export class ProductoService {
  /**
   * Obtener todos los productos
   */
  static async getAll(): Promise<Producto[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('fechaCreacion', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Producto));
    } catch (error: any) {
      console.error('Error al obtener productos:', error);
      throw new Error('Error al cargar productos');
    }
  }

  /**
   * Obtener producto por ID
   */
  static async getById(id: string): Promise<Producto | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as Producto;
      }
      
      return null;
    } catch (error: any) {
      console.error('Error al obtener producto:', error);
      throw new Error('Error al cargar producto');
    }
  }

  /**
   * Crear nuevo producto
   */
  static async create(data: ProductoFormData, userId: string): Promise<Producto> {
    try {
      // Generar SKU automático
      const sku = await this.generateSKU();
      
      const newProducto = {
        sku,
        marca: data.marca,
        nombreComercial: data.nombreComercial,
        presentacion: data.presentacion,
        dosaje: data.dosaje,
        contenido: data.contenido,
        grupo: data.grupo,
        subgrupo: data.subgrupo,
        enlaceProveedor: data.enlaceProveedor,
        codigoUPC: data.codigoUPC || '',
        
        estado: 'activo' as const,
        etiquetas: [],
        
        habilitadoML: data.habilitadoML,
        restriccionML: data.restriccionML || '',
        
        ctruPromedio: 0,
        precioSugerido: data.precioSugerido,
        margenMinimo: data.margenMinimo,
        margenObjetivo: data.margenObjetivo,
        
        stockUSA: 0,
        stockPeru: 0,
        stockTransito: 0,
        stockReservado: 0,
        stockDisponible: 0,
        
        stockMinimo: data.stockMinimo,
        stockMaximo: data.stockMaximo,
        
        rotacionPromedio: 0,
        diasParaQuiebre: 0,
        
        esPadre: false,
        
        creadoPor: userId,
        fechaCreacion: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), newProducto);
      
      return {
        id: docRef.id,
        ...newProducto,
        fechaCreacion: Timestamp.now()
      } as Producto;
    } catch (error: any) {
      console.error('Error al crear producto:', error);
      throw new Error('Error al crear producto');
    }
  }

  /**
   * Actualizar producto
   */
  static async update(id: string, data: Partial<ProductoFormData>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      
      await updateDoc(docRef, {
        ...data,
        ultimaEdicion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error al actualizar producto:', error);
      throw new Error('Error al actualizar producto');
    }
  }

  /**
   * Eliminar producto (soft delete)
   */
  static async delete(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      
      await updateDoc(docRef, {
        estado: 'inactivo',
        ultimaEdicion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error al eliminar producto:', error);
      throw new Error('Error al eliminar producto');
    }
  }

  /**
   * Generar SKU automático (BMN-0001, BMN-0002, etc.)
   */
  private static async generateSKU(): Promise<string> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      const count = snapshot.size + 1;
      return `BMN-${count.toString().padStart(4, '0')}`;
    } catch (error) {
      // Si falla, usar timestamp
      return `BMN-${Date.now().toString().slice(-4)}`;
    }
  }

  /**
   * Buscar productos por texto
   */
  static async search(searchTerm: string): Promise<Producto[]> {
    try {
      const allProducts = await this.getAll();
      
      const term = searchTerm.toLowerCase();
      
      return allProducts.filter(p => 
        p.sku.toLowerCase().includes(term) ||
        p.marca.toLowerCase().includes(term) ||
        p.nombreComercial.toLowerCase().includes(term) ||
        p.grupo.toLowerCase().includes(term) ||
        p.subgrupo.toLowerCase().includes(term)
      );
    } catch (error: any) {
      console.error('Error al buscar productos:', error);
      throw new Error('Error al buscar productos');
    }
  }
}