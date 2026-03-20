import {
  QuerySnapshot,
  DocumentData,
  collection,
  getDocs,
  query,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Mapea los documentos de un QuerySnapshot a un array de objetos tipados con `id`.
 *
 * Reemplaza el patrón duplicado ~40+ veces:
 *   snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T))
 */
export function mapDocs<T extends { id: string }>(
  snapshot: QuerySnapshot<DocumentData>
): T[] {
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as T));
}

/**
 * Ejecuta una query Firestore y retorna los documentos mapeados.
 * Centraliza el patrón getDocs + mapDocs en una sola llamada.
 *
 * Ejemplo:
 *   const ventas = await queryDocs<Venta>('ventas', orderBy('fechaCreacion', 'desc'));
 */
export async function queryDocs<T extends { id: string }>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const q = constraints.length > 0
    ? query(collection(db, collectionName), ...constraints)
    : collection(db, collectionName);
  const snapshot = await getDocs(q);
  return mapDocs<T>(snapshot);
}
