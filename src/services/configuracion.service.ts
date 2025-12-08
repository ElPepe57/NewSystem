import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { 
  EmpresaInfo,
  ConfiguracionGeneral,
  Almacen,
  EmpresaFormData,
  ConfiguracionFormData,
  AlmacenFormData
} from '../types/configuracion.types';

const EMPRESA_DOC = 'configuracion/empresa';
const CONFIG_DOC = 'configuracion/general';
const ALMACENES_COLLECTION = 'almacenes';

export class ConfiguracionService {
  // ========================================
  // EMPRESA
  // ========================================

  /**
   * Obtener información de la empresa
   */
  static async getEmpresa(): Promise<EmpresaInfo | null> {
    try {
      const docSnap = await getDoc(doc(db, EMPRESA_DOC));
      
      if (!docSnap.exists()) {
        return null;
      }
      
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as EmpresaInfo;
    } catch (error: any) {
      console.error('Error al obtener empresa:', error);
      throw new Error('Error al cargar información de la empresa');
    }
  }

  /**
   * Crear/Actualizar información de la empresa
   */
  static async saveEmpresa(data: EmpresaFormData, userId: string): Promise<void> {
    try {
      const empresaRef = doc(db, EMPRESA_DOC);
      const empresaSnap = await getDoc(empresaRef);
      
      if (empresaSnap.exists()) {
        // Actualizar
        await updateDoc(empresaRef, {
          ...data,
          ultimaEdicion: serverTimestamp(),
          editadoPor: userId
        });
      } else {
        // Crear
        await setDoc(empresaRef, {
          ...data,
          decimalesPrecio: 2,
          decimalesCantidad: 0,
          creadoPor: userId,
          fechaCreacion: serverTimestamp()
        });
      }
    } catch (error: any) {
      console.error('Error al guardar empresa:', error);
      throw new Error('Error al guardar información');
    }
  }

  // ========================================
  // CONFIGURACIÓN GENERAL
  // ========================================

  /**
   * Obtener configuración general
   */
  static async getConfiguracion(): Promise<ConfiguracionGeneral | null> {
    try {
      const docSnap = await getDoc(doc(db, CONFIG_DOC));
      
      if (!docSnap.exists()) {
        // Retornar valores por defecto
        return {
          id: 'general',
          skuAutomatico: true,
          prefijoSKU: 'BMN',
          stockMinimoDefault: 10,
          alertaStockBajo: true,
          alertaVencimiento: true,
          diasAlertaVencimiento: 30,
          usarLotes: true,
          descuentoMaximo: 20,
          permitirVentaSinStock: false,
          alertaVariacionTC: true,
          porcentajeAlertaTC: 3,
          aprobarOrdenesGrandes: false,
          montoAprobarUSD: 10000,
          idioma: 'es',
          formatoFecha: 'DD/MM/YYYY'
        } as ConfiguracionGeneral;
      }
      
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as ConfiguracionGeneral;
    } catch (error: any) {
      console.error('Error al obtener configuración:', error);
      throw new Error('Error al cargar configuración');
    }
  }

  /**
   * Guardar configuración general
   */
  static async saveConfiguracion(data: ConfiguracionFormData, userId: string): Promise<void> {
    try {
      const configRef = doc(db, CONFIG_DOC);
      const configSnap = await getDoc(configRef);
      
      const configData = {
        ...data,
        idioma: 'es',
        formatoFecha: 'DD/MM/YYYY',
        aprobarOrdenesGrandes: false,
        montoAprobarUSD: 10000,
        usarLotes: true,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      };
      
      if (configSnap.exists()) {
        await updateDoc(configRef, configData);
      } else {
        await setDoc(configRef, configData);
      }
    } catch (error: any) {
      console.error('Error al guardar configuración:', error);
      throw new Error('Error al guardar configuración');
    }
  }

  // ========================================
  // ALMACENES
  // ========================================

  /**
   * Obtener todos los almacenes
   */
  static async getAlmacenes(): Promise<Almacen[]> {
    try {
      const snapshot = await getDocs(collection(db, ALMACENES_COLLECTION));
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Almacen));
    } catch (error: any) {
      console.error('Error al obtener almacenes:', error);
      throw new Error('Error al cargar almacenes');
    }
  }

  /**
   * Crear almacén
   */
  static async createAlmacen(data: AlmacenFormData, userId: string): Promise<Almacen> {
    try {
      const nuevoAlmacen: any = {
        codigo: data.codigo,
        nombre: data.nombre,
        tipo: data.tipo,
        activo: true,
        creadoPor: userId,
        fechaCreacion: serverTimestamp()
      };
      
      if (data.direccion) nuevoAlmacen.direccion = data.direccion;
      if (data.responsable) nuevoAlmacen.responsable = data.responsable;
      
      const docRef = await addDoc(collection(db, ALMACENES_COLLECTION), nuevoAlmacen);
      
      return {
        id: docRef.id,
        ...nuevoAlmacen,
        fechaCreacion: Timestamp.now()
      } as Almacen;
    } catch (error: any) {
      console.error('Error al crear almacén:', error);
      throw new Error('Error al crear almacén');
    }
  }

  /**
   * Actualizar almacén
   */
  static async updateAlmacen(id: string, data: Partial<AlmacenFormData>): Promise<void> {
    try {
      const updates: any = {
        ultimaEdicion: serverTimestamp()
      };
      
      if (data.codigo) updates.codigo = data.codigo;
      if (data.nombre) updates.nombre = data.nombre;
      if (data.tipo) updates.tipo = data.tipo;
      if (data.direccion !== undefined) updates.direccion = data.direccion;
      if (data.responsable !== undefined) updates.responsable = data.responsable;
      
      await updateDoc(doc(db, ALMACENES_COLLECTION, id), updates);
    } catch (error: any) {
      console.error('Error al actualizar almacén:', error);
      throw new Error('Error al actualizar almacén');
    }
  }

  /**
   * Eliminar almacén (soft delete)
   */
  static async deleteAlmacen(id: string): Promise<void> {
    try {
      await updateDoc(doc(db, ALMACENES_COLLECTION, id), {
        activo: false,
        ultimaEdicion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error al eliminar almacén:', error);
      throw new Error('Error al eliminar almacén');
    }
  }
}