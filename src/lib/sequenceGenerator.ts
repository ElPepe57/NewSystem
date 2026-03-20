import { doc, runTransaction, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Genera números secuenciales atómicos usando un documento contador en Firestore.
 *
 * Usa `runTransaction` para garantizar que dos usuarios concurrentes
 * nunca obtengan el mismo número. Elimina la necesidad de leer toda
 * la colección para encontrar el máximo.
 *
 * Documento contador: `contadores/{prefix}`
 * Ejemplo: `contadores/VT-2026` → { current: 42 }
 *
 * @param prefix - Prefijo del número (ej: "VT-2026", "GAS")
 * @param padLength - Largo del número con padding (ej: 3 → "001", 4 → "0001")
 * @returns El siguiente número formateado (ej: "VT-2026-043", "GAS-0043")
 */
export async function getNextSequenceNumber(
  prefix: string,
  padLength: number = 3
): Promise<string> {
  const counterRef = doc(db, 'contadores', prefix);

  const nextNumber = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    let current = 0;
    if (counterDoc.exists()) {
      current = counterDoc.data().current || 0;
    }

    const next = current + 1;
    transaction.set(counterRef, { current: next, updatedAt: new Date() });

    return next;
  });

  const separator = prefix.includes('-') ? '-' : '-';
  return `${prefix}${separator}${nextNumber.toString().padStart(padLength, '0')}`;
}

/**
 * Inicializa un contador basado en los datos existentes.
 * Ejecutar UNA VEZ para migrar del patrón anterior (full-collection scan)
 * al patrón de contador atómico.
 *
 * @param prefix - Prefijo del contador
 * @param currentMax - El número máximo actual encontrado en la colección
 */
export async function initializeCounter(
  prefix: string,
  currentMax: number
): Promise<void> {
  const counterRef = doc(db, 'contadores', prefix);
  await setDoc(counterRef, {
    current: currentMax,
    initializedAt: new Date(),
    updatedAt: new Date(),
  });
}
