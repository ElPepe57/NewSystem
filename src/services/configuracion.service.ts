import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import type {
  EmpresaInfo,
  ConfiguracionGeneral,
  EmpresaFormData,
  ConfiguracionFormData
} from '../types/configuracion.types';

const EMPRESA_DOC = 'configuracion/empresa';
const CONFIG_DOC = 'configuracion/general';

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
      logger.error('Error al obtener empresa:', error);
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
      logger.error('Error al guardar empresa:', error);
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
      logger.error('Error al obtener configuración:', error);
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
      logger.error('Error al guardar configuración:', error);
      throw new Error('Error al guardar configuración');
    }
  }

}