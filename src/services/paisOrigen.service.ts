import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type { PaisOrigen, PaisOrigenFormData } from '../types/paisOrigen.types';

const COLLECTION_NAME = COLLECTIONS.PAISES_ORIGEN;

export const paisOrigenService = {
  /**
   * Obtener todos los paises de origen
   */
  async getAll(): Promise<PaisOrigen[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('nombre', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PaisOrigen));
  },

  /**
   * Obtener solo los paises activos
   */
  async getActivos(): Promise<PaisOrigen[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('activo', '==', true),
      orderBy('nombre', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PaisOrigen));
  },

  /**
   * Obtener un pais por ID
   */
  async getById(id: string): Promise<PaisOrigen | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as PaisOrigen;
  },

  /**
   * Buscar pais por codigo (USA, CHN, etc.)
   */
  async getByCodigo(codigo: string): Promise<PaisOrigen | null> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('codigo', '==', codigo.toUpperCase())
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const d = snapshot.docs[0];
    return { id: d.id, ...d.data() } as PaisOrigen;
  },

  /**
   * Crear un nuevo pais de origen
   */
  async create(data: PaisOrigenFormData, userId: string): Promise<string> {
    // Verificar que no exista uno con el mismo codigo
    const existente = await this.getByCodigo(data.codigo);
    if (existente) {
      throw new Error(`Ya existe un pais de origen con codigo "${data.codigo}"`);
    }

    const docData = {
      nombre: data.nombre.trim(),
      codigo: data.codigo.toUpperCase(),
      codigoISO: data.codigoISO || null,
      activo: data.activo,
      tiempoTransitoEstimadoDias: data.tiempoTransitoEstimadoDias ?? null,
      modeloLogistico: data.modeloLogistico || null,
      monedaCompra: data.monedaCompra || null,
      tarifaFleteEstimadaUSD: data.tarifaFleteEstimadaUSD ?? null,
      metodoEnvio: data.metodoEnvio || null,
      tiempoTransitoDias: data.tiempoTransitoDias ?? null,
      notasRuta: data.notasRuta || null,
      creadoPor: userId,
      fechaCreacion: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
    return docRef.id;
  },

  /**
   * Actualizar un pais de origen
   */
  async update(id: string, data: Partial<PaisOrigenFormData>, userId: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);

    const updateData: Record<string, any> = {
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    };

    if (data.nombre !== undefined) updateData.nombre = data.nombre.trim();
    if (data.codigo !== undefined) updateData.codigo = data.codigo.toUpperCase();
    if (data.codigoISO !== undefined) updateData.codigoISO = data.codigoISO || null;
    if (data.activo !== undefined) updateData.activo = data.activo;
    if (data.tiempoTransitoEstimadoDias !== undefined) updateData.tiempoTransitoEstimadoDias = data.tiempoTransitoEstimadoDias;
    if (data.modeloLogistico !== undefined) updateData.modeloLogistico = data.modeloLogistico || null;
    if (data.monedaCompra !== undefined) updateData.monedaCompra = data.monedaCompra || null;
    if (data.tarifaFleteEstimadaUSD !== undefined) updateData.tarifaFleteEstimadaUSD = data.tarifaFleteEstimadaUSD ?? null;
    if (data.metodoEnvio !== undefined) updateData.metodoEnvio = data.metodoEnvio || null;
    if (data.tiempoTransitoDias !== undefined) updateData.tiempoTransitoDias = data.tiempoTransitoDias ?? null;
    if (data.notasRuta !== undefined) updateData.notasRuta = data.notasRuta || null;

    await updateDoc(docRef, updateData);
  },

  /**
   * Obtener tarifa de flete estimada por código de país
   * Retorna 0 si no se encuentra o no tiene tarifa configurada
   */
  async getFleteEstimado(paisCodigo: string): Promise<number> {
    const pais = await this.getByCodigo(paisCodigo);
    return pais?.tarifaFleteEstimadaUSD ?? 0;
  },
};
