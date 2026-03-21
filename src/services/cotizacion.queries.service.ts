/**
 * cotizacion.queries.service.ts
 * Read-only Firestore queries: getAll, getById, getByEstado, getWithFilters.
 */
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTION_NAME } from './cotizacion.shared';
import type { Cotizacion, EstadoCotizacion, CotizacionFilters } from '../types/cotizacion.types';
import { logger } from '../lib/logger';

export async function getAll(): Promise<Cotizacion[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('fechaCreacion', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Cotizacion));
  } catch (error: any) {
    logger.error('Error al obtener cotizaciones:', error);
    throw new Error('Error al cargar cotizaciones');
  }
}

export async function getById(id: string): Promise<Cotizacion | null> {
  try {
    const docSnap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Cotizacion;
  } catch (error: any) {
    logger.error('Error al obtener cotización:', error);
    throw new Error('Error al cargar cotización');
  }
}

export async function getByEstado(estado: EstadoCotizacion | EstadoCotizacion[]): Promise<Cotizacion[]> {
  try {
    const estados = Array.isArray(estado) ? estado : [estado];
    const q = query(
      collection(db, COLLECTION_NAME),
      where('estado', 'in', estados),
      orderBy('fechaCreacion', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Cotizacion));
  } catch (error: any) {
    logger.error('Error al obtener cotizaciones por estado:', error);
    throw new Error('Error al cargar cotizaciones');
  }
}

export async function getWithFilters(filters: CotizacionFilters): Promise<Cotizacion[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('fechaCreacion', 'desc'));
    const snapshot = await getDocs(q);
    let cotizaciones = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Cotizacion));

    if (filters.estado) {
      const estados = Array.isArray(filters.estado) ? filters.estado : [filters.estado];
      cotizaciones = cotizaciones.filter(c => estados.includes(c.estado));
    }
    if (filters.canal) {
      cotizaciones = cotizaciones.filter(c => c.canal === filters.canal);
    }
    if (filters.clienteId) {
      cotizaciones = cotizaciones.filter(c => c.clienteId === filters.clienteId);
    }
    if (filters.montoMinimo !== undefined) {
      cotizaciones = cotizaciones.filter(c => c.totalPEN >= filters.montoMinimo!);
    }
    if (filters.montoMaximo !== undefined) {
      cotizaciones = cotizaciones.filter(c => c.totalPEN <= filters.montoMaximo!);
    }
    if (filters.productoId) {
      cotizaciones = cotizaciones.filter(c =>
        c.productos.some(p => p.productoId === filters.productoId)
      );
    }

    return cotizaciones;
  } catch (error: any) {
    logger.error('Error al filtrar cotizaciones:', error);
    throw new Error('Error al cargar cotizaciones');
  }
}
