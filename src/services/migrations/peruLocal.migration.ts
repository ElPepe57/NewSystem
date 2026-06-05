/**
 * Migración one-shot · `Peru_local` → `Peru` (chk5.ENVIOS-UNIF).
 *
 * El valor de país `Peru_local` se eliminó del modelo: era redundante. El eje
 * "importado vs comprado local" NO es una propiedad de la UBICACIÓN (una casilla
 * en Lima es Perú) sino del ORIGEN del stock, que ya vive en la ruta del envío
 * (`tipoRutaLogistica`) + `paisOrigen`/`proveedorPais` de cada unidad.
 *
 * Esta función normaliza los datos existentes que aún tengan `pais: 'Peru_local'`.
 * Ejecutar UNA sola vez desde un contexto admin (o la consola del navegador con
 * sesión iniciada). Idempotente: si no hay datos, no hace nada.
 *
 *   import { migrarPeruLocal } from './services/migrations/peruLocal.migration';
 *   await migrarPeruLocal();
 */
import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS } from '../../config/collections';
import { logger } from '../../lib/logger';

async function migrarColeccion(coll: string): Promise<number> {
  const snap = await getDocs(query(collection(db, coll), where('pais', '==', 'Peru_local')));
  if (snap.empty) return 0;
  const docs = snap.docs;
  // Firestore: máximo 500 escrituras por batch.
  for (let i = 0; i < docs.length; i += 500) {
    const batch = writeBatch(db);
    docs.slice(i, i + 500).forEach(d => batch.update(doc(db, coll, d.id), { pais: 'Peru' }));
    await batch.commit();
  }
  return docs.length;
}

export async function migrarPeruLocal(): Promise<{ casillas: number; unidades: number }> {
  const casillas = await migrarColeccion(COLLECTIONS.CASILLAS);
  const unidades = await migrarColeccion(COLLECTIONS.UNIDADES);
  logger.success(`Migración Peru_local→Peru · casillas: ${casillas} · unidades: ${unidades}.`);
  return { casillas, unidades };
}
