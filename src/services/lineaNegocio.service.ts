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
import type { LineaNegocio, LineaNegocioFormData } from '../types/lineaNegocio.types';

const COLLECTION_NAME = COLLECTIONS.LINEAS_NEGOCIO;

export const lineaNegocioService = {
  /**
   * Obtener todas las líneas de negocio
   */
  async getAll(): Promise<LineaNegocio[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('nombre', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LineaNegocio));
  },

  /**
   * Obtener solo las líneas activas
   */
  async getActivas(): Promise<LineaNegocio[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('activa', '==', true),
      orderBy('nombre', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LineaNegocio));
  },

  /**
   * Obtener una línea por ID
   */
  async getById(id: string): Promise<LineaNegocio | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as LineaNegocio;
  },

  /**
   * Crear una nueva línea de negocio
   */
  async create(data: LineaNegocioFormData, userId: string): Promise<string> {
    // Verificar que no exista una línea con el mismo código
    const existente = await this.getByCodigo(data.codigo);
    if (existente) {
      throw new Error(`Ya existe una línea de negocio con código "${data.codigo}"`);
    }

    const docData = {
      nombre: data.nombre,
      codigo: data.codigo.toUpperCase(),
      descripcion: data.descripcion || null,
      color: data.color,
      icono: data.icono || null,
      activa: data.activa,
      totalProductos: 0,
      totalUnidadesActivas: 0,
      ventasMesActualPEN: 0,
      creadoPor: userId,
      fechaCreacion: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
    return docRef.id;
  },

  /**
   * Actualizar una línea de negocio
   */
  async update(id: string, data: Partial<LineaNegocioFormData>, userId: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...data,
      ...(data.codigo ? { codigo: data.codigo.toUpperCase() } : {}),
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });
  },

  /**
   * Buscar línea por código
   */
  async getByCodigo(codigo: string): Promise<LineaNegocio | null> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('codigo', '==', codigo.toUpperCase())
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const d = snapshot.docs[0];
    return { id: d.id, ...d.data() } as LineaNegocio;
  },

  /**
   * Crear la línea "Suplementos" por defecto (para migración)
   * Retorna el ID de la línea creada o existente
   */
  async crearLineaDefault(userId: string): Promise<string> {
    // Verificar si ya existe
    const existente = await this.getByCodigo('SUP');
    if (existente) return existente.id;

    return this.create({
      nombre: 'Suplementos y Vitaminas',
      codigo: 'SUP',
      descripcion: 'Línea principal de suplementos alimenticios, vitaminas y minerales',
      color: '#3B82F6',       // blue-500
      icono: '💊',
      activa: true,
    }, userId);
  },
};
