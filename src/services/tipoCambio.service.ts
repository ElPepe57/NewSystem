import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { TipoCambio, TipoCambioFormData, TipoCambioFiltros, SunatTCResponse } from '../types/tipoCambio.types';

const COLLECTION_NAME = 'tiposCambio';

/**
 * Servicio para gestionar Tipos de Cambio
 */
export const tipoCambioService = {
  /**
   * Obtener todos los tipos de cambio
   */
  async getAll(): Promise<TipoCambio[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('fecha', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        promedio: data.promedio ?? (data.compra + data.venta) / 2
      } as TipoCambio;
    });
  },

  /**
   * Obtener tipo de cambio por ID
   */
  async getById(id: string): Promise<TipoCambio | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      promedio: data.promedio ?? (data.compra + data.venta) / 2
    } as TipoCambio;
  },

  /**
   * Obtener tipo de cambio por fecha específica
   */
  async getByFecha(fecha: Date): Promise<TipoCambio | null> {
    const inicioDia = new Date(fecha);
    inicioDia.setHours(0, 0, 0, 0);
    
    const finDia = new Date(fecha);
    finDia.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, COLLECTION_NAME),
      where('fecha', '>=', Timestamp.fromDate(inicioDia)),
      where('fecha', '<=', Timestamp.fromDate(finDia)),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const docSnap = snapshot.docs[0];
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      promedio: data.promedio ?? (data.compra + data.venta) / 2
    } as TipoCambio;
  },

  /**
   * Obtener historial de tipos de cambio con filtros
   */
  async getHistorial(filtros?: TipoCambioFiltros): Promise<TipoCambio[]> {
    let q = query(
      collection(db, COLLECTION_NAME),
      orderBy('fecha', 'desc')
    );

    // Aplicar filtros si existen
    if (filtros?.fechaInicio) {
      const inicio = new Date(filtros.fechaInicio);
      inicio.setHours(0, 0, 0, 0);
      q = query(q, where('fecha', '>=', Timestamp.fromDate(inicio)));
    }

    if (filtros?.fechaFin) {
      const fin = new Date(filtros.fechaFin);
      fin.setHours(23, 59, 59, 999);
      q = query(q, where('fecha', '<=', Timestamp.fromDate(fin)));
    }

    if (filtros?.fuente) {
      q = query(q, where('fuente', '==', filtros.fuente));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        promedio: data.promedio ?? (data.compra + data.venta) / 2
      } as TipoCambio;
    });
  },

  /**
   * Obtener TC del día actual
   * Si no hay TC para hoy, busca el más reciente
   */
  async getTCDelDia(): Promise<TipoCambio | null> {
    const hoy = new Date();
    const tcHoy = await this.getByFecha(hoy);

    if (tcHoy) {
      return tcHoy;
    }

    // Si no hay TC para hoy, buscar el más reciente
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

      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        fecha: data.fecha,
        compra: data.compra,
        venta: data.venta,
        fuente: data.fuente,
        creadoPor: data.creadoPor,
        fechaCreacion: data.fechaCreacion,
        promedio: data.promedio ?? (data.compra + data.venta) / 2
      } as TipoCambio;
    } catch (error) {
      console.error('Error buscando TC más reciente:', error);
      return null;
    }
  },

  /**
   * Crear un nuevo tipo de cambio
   */
  async create(data: TipoCambioFormData, userId: string): Promise<string> {
    // Verificar que no exista ya un TC para esta fecha
    const existente = await this.getByFecha(data.fecha);
    if (existente) {
      throw new Error('Ya existe un tipo de cambio registrado para esta fecha');
    }

    const now = Timestamp.now();
    const newTC = {
      fecha: Timestamp.fromDate(data.fecha),
      compra: data.compra,
      venta: data.venta,
      promedio: (data.compra + data.venta) / 2,
      fuente: data.fuente,
      creadoPor: userId,
      fechaCreacion: now
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), newTC);
    return docRef.id;
  },

  /**
   * Actualizar un tipo de cambio
   */
  async update(id: string, data: Partial<TipoCambioFormData>, userId: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData: any = {
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now()
    };

    if (data.compra !== undefined) updateData.compra = data.compra;
    if (data.venta !== undefined) updateData.venta = data.venta;
    if (data.fuente !== undefined) updateData.fuente = data.fuente;
    if (data.fecha !== undefined) updateData.fecha = Timestamp.fromDate(data.fecha);

    // Recalcular promedio si se actualiza compra o venta
    if (data.compra !== undefined || data.venta !== undefined) {
      const current = await this.getById(id);
      const compra = data.compra ?? current?.compra ?? 0;
      const venta = data.venta ?? current?.venta ?? 0;
      updateData.promedio = (compra + venta) / 2;
    }

    await updateDoc(docRef, updateData);
  },

  /**
   * Obtener TC desde la API de SUNAT
   * Usa un proxy CORS para evitar problemas de bloqueo del navegador
   */
  async obtenerDeSunat(fecha?: Date): Promise<SunatTCResponse> {
    try {
      const fechaStr = fecha
        ? fecha.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      // Usar proxy CORS público para evitar bloqueo del navegador
      const corsProxy = 'https://corsproxy.io/?';
      const apiUrl = `https://api.apis.net.pe/v1/tipo-cambio-sunat?fecha=${fechaStr}`;
      const url = corsProxy + encodeURIComponent(apiUrl);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('No se pudo obtener el tipo de cambio de SUNAT');
      }

      const data = await response.json();

      return {
        fecha: fechaStr,
        compra: parseFloat(data.compra || data.precioCompra || 0),
        venta: parseFloat(data.venta || data.precioVenta || 0)
      };
    } catch (error) {
      console.error('Error al obtener TC de SUNAT:', error);
      throw new Error('No se pudo conectar con el servicio de SUNAT. Intente con ingreso manual.');
    }
  },

  /**
   * Registrar TC automáticamente desde SUNAT
   */
  async registrarDesdeSunat(fecha: Date, userId: string): Promise<string> {
    // Verificar que no exista ya un TC para esta fecha
    const existente = await this.getByFecha(fecha);
    if (existente) {
      throw new Error('Ya existe un tipo de cambio registrado para esta fecha');
    }

    // Obtener TC de SUNAT
    const tcSunat = await this.obtenerDeSunat(fecha);

    // Crear registro
    return this.create({
      fecha,
      compra: tcSunat.compra,
      venta: tcSunat.venta,
      fuente: 'sunat'
    }, userId);
  },

  /**
   * Obtener promedio del tipo de cambio para un mes específico
   */
  async getPromedioMensual(mes?: number, anio?: number): Promise<number> {
    const ahora = new Date();
    const mesTarget = mes ?? ahora.getMonth();
    const anioTarget = anio ?? ahora.getFullYear();

    const inicioMes = new Date(anioTarget, mesTarget, 1);
    const finMes = new Date(anioTarget, mesTarget + 1, 0, 23, 59, 59, 999);

    const q = query(
      collection(db, COLLECTION_NAME),
      where('fecha', '>=', Timestamp.fromDate(inicioMes)),
      where('fecha', '<=', Timestamp.fromDate(finMes))
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return 0;
    }

    const registros = snapshot.docs.map(doc => {
      const data = doc.data();
      return (data.compra + data.venta) / 2;
    });

    return registros.reduce((sum, val) => sum + val, 0) / registros.length;
  },

  /**
   * Obtener últimos N días de TC para gráficos
   */
  async getUltimosDias(dias: number = 30): Promise<TipoCambio[]> {
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - dias);
    fechaInicio.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, COLLECTION_NAME),
      where('fecha', '>=', Timestamp.fromDate(fechaInicio)),
      orderBy('fecha', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as TipoCambio));
  }
};
