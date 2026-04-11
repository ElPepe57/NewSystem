import {
  collection, addDoc, getDocs, getDoc, doc, updateDoc,
  query, where, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import type {
  CategoriaCosto, CategoriaCostoFormData, BloqueCosto
} from '../types/categoriaCosto.types';

const COLL = COLLECTIONS.CATEGORIAS_COSTOS;

async function generarCodigo(): Promise<string> {
  return getNextSequenceNumber('CC', 3);
}

export const categoriaCostoService = {
  async getAll(): Promise<CategoriaCosto[]> {
    const q = query(collection(db, COLL), orderBy('bloque', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CategoriaCosto));
  },

  async getById(id: string): Promise<CategoriaCosto | null> {
    const ref = doc(db, COLL, id);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } as CategoriaCosto : null;
  },

  async getByBloque(bloque: BloqueCosto): Promise<CategoriaCosto[]> {
    const q = query(collection(db, COLL), where('bloque', '==', bloque), orderBy('orden', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CategoriaCosto));
  },

  async getPadres(bloque?: BloqueCosto): Promise<CategoriaCosto[]> {
    let q;
    if (bloque) {
      q = query(collection(db, COLL), where('bloque', '==', bloque), where('nivel', '==', 0));
    } else {
      q = query(collection(db, COLL), where('nivel', '==', 0));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CategoriaCosto));
  },

  async getHijos(categoriaPadreId: string): Promise<CategoriaCosto[]> {
    const q = query(collection(db, COLL), where('categoriaPadreId', '==', categoriaPadreId), orderBy('orden', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CategoriaCosto));
  },

  /**
   * Obtiene el arbol completo de categorias agrupado por bloque
   */
  async getArbol(): Promise<Record<BloqueCosto, { padres: CategoriaCosto[]; hijos: Record<string, CategoriaCosto[]> }>> {
    const todas = await this.getAll();

    const arbol: Record<BloqueCosto, { padres: CategoriaCosto[]; hijos: Record<string, CategoriaCosto[]> }> = {
      importacion: { padres: [], hijos: {} },
      venta: { padres: [], hijos: {} },
      periodo: { padres: [], hijos: {} },
    };

    for (const cat of todas) {
      if (cat.nivel === 0) {
        arbol[cat.bloque].padres.push(cat);
      } else if (cat.categoriaPadreId) {
        if (!arbol[cat.bloque].hijos[cat.categoriaPadreId]) {
          arbol[cat.bloque].hijos[cat.categoriaPadreId] = [];
        }
        arbol[cat.bloque].hijos[cat.categoriaPadreId].push(cat);
      }
    }

    return arbol;
  },

  async crear(data: CategoriaCostoFormData, userId: string): Promise<string> {
    const codigo = await generarCodigo();

    const nuevoDoc: Record<string, unknown> = {
      codigo,
      nombre: data.nombre,
      bloque: data.bloque,
      nivel: data.categoriaPadreId ? 1 : 0,
      activa: data.activa,
      orden: data.orden,
      creadoPor: userId,
      fechaCreacion: Timestamp.now(),
    };

    if (data.descripcion) nuevoDoc.descripcion = data.descripcion;
    if (data.categoriaPadreId) {
      nuevoDoc.categoriaPadreId = data.categoriaPadreId;
      const padre = await this.getById(data.categoriaPadreId);
      if (padre) nuevoDoc.categoriaPadreNombre = padre.nombre;
    }

    const docRef = await addDoc(collection(db, COLL), nuevoDoc);
    logger.success(`Categoria de costo ${codigo} creada: ${data.nombre}`);
    return docRef.id;
  },

  async actualizar(id: string, data: Partial<CategoriaCostoFormData>, userId: string): Promise<void> {
    const ref = doc(db, COLL, id);
    await updateDoc(ref, {
      ...data,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });
  },
};
