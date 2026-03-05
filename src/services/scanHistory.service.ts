import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type { ScanResultFirestore, ScanResultStatus, ScanSource } from '../types/escaner.types';

interface SaveScanParams {
  barcode: string;
  format: string;
  status: ScanResultStatus;
  productoId?: string;
  productoNombre?: string;
  productoSKU?: string;
  userId: string;
  source: ScanSource;
}

export const scanHistoryService = {
  async save(params: SaveScanParams): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTIONS.SCAN_HISTORY), {
      ...params,
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  },

  async getRecent(maxResults: number = 50): Promise<ScanResultFirestore[]> {
    const q = query(
      collection(db, COLLECTIONS.SCAN_HISTORY),
      orderBy('timestamp', 'desc'),
      firestoreLimit(maxResults)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as ScanResultFirestore));
  },

  async deleteOne(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.SCAN_HISTORY, id));
  },

  async deleteAll(): Promise<void> {
    const snapshot = await getDocs(collection(db, COLLECTIONS.SCAN_HISTORY));
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  },
};
