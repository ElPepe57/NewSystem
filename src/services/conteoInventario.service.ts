import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type { AuditoriaSession, AuditoriaSessionItem } from '../types/escanerModos.types';

export const conteoInventarioService = {
  async guardar(session: Omit<AuditoriaSession, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTIONS.CONTEOS_INVENTARIO), {
      ...session,
      fecha: serverTimestamp(),
    });
    return docRef.id;
  },

  async getRecent(limit: number = 20): Promise<AuditoriaSession[]> {
    const q = query(
      collection(db, COLLECTIONS.CONTEOS_INVENTARIO),
      orderBy('fecha', 'desc'),
      firestoreLimit(limit)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    } as AuditoriaSession));
  },

  async getById(id: string): Promise<AuditoriaSession | null> {
    const docRef = doc(db, COLLECTIONS.CONTEOS_INVENTARIO, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as AuditoriaSession;
  },

  exportarCSV(items: AuditoriaSessionItem[], almacenNombre: string): string {
    const header = 'SKU,Producto,Cantidad Fisica,Stock Sistema,Discrepancia';
    const rows = items.map(i =>
      `"${i.sku}","${i.nombre}",${i.cantidadFisica},${i.stockSistema},${i.discrepancia}`
    );
    return `Auditoria Inventario - ${almacenNombre} - ${new Date().toLocaleDateString()}\n${header}\n${rows.join('\n')}`;
  },
};
