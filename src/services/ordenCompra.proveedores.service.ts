/**
 * ordenCompra.proveedores.service.ts
 *
 * CRUD for the Proveedores collection.
 * No external dependency on other OC sub-modules.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import type { Proveedor, ProveedorFormData } from '../types/ordenCompra.types';
import { PROVEEDORES_COLLECTION } from './ordenCompra.shared';

export async function getAllProveedores(): Promise<Proveedor[]> {
  try {
    const q = query(
      collection(db, PROVEEDORES_COLLECTION),
      orderBy('nombre', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Proveedor));
  } catch (error: any) {
    logger.error('Error al obtener proveedores:', error);
    throw new Error('Error al cargar proveedores');
  }
}

export async function getProveedorById(id: string): Promise<Proveedor | null> {
  try {
    const docRef = doc(db, PROVEEDORES_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Proveedor;
  } catch (error: any) {
    logger.error('Error al obtener proveedor:', error);
    return null;
  }
}

export async function createProveedor(
  data: ProveedorFormData,
  userId: string
): Promise<Proveedor> {
  try {
    const nuevoProveedor: any = {
      nombre: data.nombre,
      tipo: data.tipo,
      pais: data.pais,
      activo: true,
      creadoPor: userId,
      fechaCreacion: serverTimestamp()
    };

    if (data.contacto) nuevoProveedor.contacto = data.contacto;
    if (data.email) nuevoProveedor.email = data.email;
    if (data.telefono) nuevoProveedor.telefono = data.telefono;
    if (data.direccion) nuevoProveedor.direccion = data.direccion;
    if (data.notasInternas) nuevoProveedor.notasInternas = data.notasInternas;

    const docRef = await addDoc(collection(db, PROVEEDORES_COLLECTION), nuevoProveedor);

    return {
      id: docRef.id,
      ...nuevoProveedor,
      fechaCreacion: Timestamp.now()
    } as Proveedor;
  } catch (error: any) {
    logger.error('Error al crear proveedor:', error);
    throw new Error('Error al crear proveedor');
  }
}

export async function updateProveedor(
  id: string,
  data: Partial<ProveedorFormData>
): Promise<void> {
  try {
    const updates: any = { ultimaEdicion: serverTimestamp() };

    if (data.nombre !== undefined) updates.nombre = data.nombre;
    if (data.tipo !== undefined) updates.tipo = data.tipo;
    if (data.contacto !== undefined) updates.contacto = data.contacto;
    if (data.email !== undefined) updates.email = data.email;
    if (data.telefono !== undefined) updates.telefono = data.telefono;
    if (data.direccion !== undefined) updates.direccion = data.direccion;
    if (data.pais !== undefined) updates.pais = data.pais;
    if (data.notasInternas !== undefined) updates.notasInternas = data.notasInternas;

    await updateDoc(doc(db, PROVEEDORES_COLLECTION, id), updates);
  } catch (error: any) {
    logger.error('Error al actualizar proveedor:', error);
    throw new Error('Error al actualizar proveedor');
  }
}

export async function deleteProveedor(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, PROVEEDORES_COLLECTION, id), {
      activo: false,
      ultimaEdicion: serverTimestamp()
    });
  } catch (error: any) {
    logger.error('Error al eliminar proveedor:', error);
    throw new Error('Error al eliminar proveedor');
  }
}
