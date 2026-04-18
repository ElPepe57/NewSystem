import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  BORRADORES_WIZARD_COLLECTION,
  buildBorradorWizardId,
} from '../types/borradorWizard.types';
import type {
  BorradorWizard,
  BorradorWizardInput,
  TipoBorradorWizard,
} from '../types/borradorWizard.types';

/**
 * Servicio de borradores de wizard (Firestore — capa 2 del autoguardado).
 *
 * Colección: `borradoresWizard/{userId}_{tipo}`
 *
 * Regla: solo 1 borrador activo por (usuario, tipo). Al abrir un wizard con
 * borrador existente, el usuario decide si continuar o descartar.
 */
export const borradorWizardService = {
  /**
   * Guarda o actualiza el borrador del usuario para el tipo indicado.
   * Si ya existe, sobrescribe. Si no existe, crea.
   */
  async save(input: BorradorWizardInput): Promise<void> {
    const id = buildBorradorWizardId(input.userId, input.tipo);
    const ref = doc(db, BORRADORES_WIZARD_COLLECTION, id);

    // Si existe, solo actualizar fechaActualizacion. Si no, setear fechaCreacion también.
    const existing = await getDoc(ref);
    const payload = {
      id,
      ...input,
      fechaActualizacion: serverTimestamp(),
      ...(existing.exists() ? {} : { fechaCreacion: serverTimestamp() }),
    };

    await setDoc(ref, payload, { merge: true });
  },

  /**
   * Lee el borrador del usuario para el tipo dado. Devuelve null si no existe.
   */
  async get(userId: string, tipo: TipoBorradorWizard): Promise<BorradorWizard | null> {
    const id = buildBorradorWizardId(userId, tipo);
    const ref = doc(db, BORRADORES_WIZARD_COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id, ...snap.data() } as BorradorWizard;
  },

  /**
   * Elimina el borrador al completar (confirmar) o cancelar el wizard.
   */
  async delete(userId: string, tipo: TipoBorradorWizard): Promise<void> {
    const id = buildBorradorWizardId(userId, tipo);
    const ref = doc(db, BORRADORES_WIZARD_COLLECTION, id);
    await deleteDoc(ref);
  },

  /**
   * Lista todos los borradores del sistema (solo admin).
   * Ordenados por fechaActualizacion desc.
   */
  async listAll(): Promise<BorradorWizard[]> {
    const ref = collection(db, BORRADORES_WIZARD_COLLECTION);
    const q = query(ref, orderBy('fechaActualizacion', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as BorradorWizard));
  },

  /**
   * Lista los borradores del usuario autenticado (todos los tipos).
   */
  async listByUser(userId: string): Promise<BorradorWizard[]> {
    const ref = collection(db, BORRADORES_WIZARD_COLLECTION);
    const q = query(ref, where('userId', '==', userId), orderBy('fechaActualizacion', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as BorradorWizard));
  },

  /**
   * Elimina borradores antiguos (> `diasMax` días sin actualización).
   * Uso típico: herramienta admin de limpieza (§10.3 ESPEC).
   */
  async deleteExpired(diasMax: number = 30): Promise<number> {
    const todos = await this.listAll();
    const limite = Date.now() - diasMax * 24 * 60 * 60 * 1000;
    let eliminados = 0;

    for (const borrador of todos) {
      const fecha = borrador.fechaActualizacion;
      const ts = fecha instanceof Timestamp ? fecha.toMillis() : new Date(fecha).getTime();
      if (ts < limite) {
        await this.delete(borrador.userId, borrador.tipo);
        eliminados++;
      }
    }

    return eliminados;
  },

  /**
   * Borrado masivo por IDs (para selección múltiple en la herramienta admin).
   */
  async deleteMultiple(ids: string[]): Promise<void> {
    await Promise.all(
      ids.map((id) => deleteDoc(doc(db, BORRADORES_WIZARD_COLLECTION, id)))
    );
  },
};
