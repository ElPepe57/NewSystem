import { doc, runTransaction, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
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

  // S3.4 (2026-05-04) · DEUDA-SKU-001 · Defensiva contra contadores no inicializados.
  // Si el contador no existe Y hay productos legacy con ese prefijo, escaneamos
  // para arrancar desde el max real (en vez de desde 0). Solo escanea para los
  // prefijos de productos (SUP/SKC/APPAREL/ALIM) · prefijos de ventas/gastos
  // siguen el comportamiento original (no escanean).
  let baselineFromLegacy = 0;
  const esPrefijoProducto = ['SUP', 'SKC', 'APPAREL', 'ALIM', 'BMN'].includes(prefix);
  if (esPrefijoProducto) {
    try {
      // Verificación previa fuera de la transacción (las TX no aceptan queries).
      const snap = await getDocs(query(collection(db, 'productos'), where('lineaCodigo', '==', prefix))).catch(() => null);
      if (snap) {
        let max = 0;
        for (const d of snap.docs) {
          const sku = (d.data() as { sku?: string }).sku;
          const m = sku?.match(new RegExp(`^${prefix}-(\\d+)$`));
          if (m) max = Math.max(max, parseInt(m[1], 10));
        }
        baselineFromLegacy = max;
      }
    } catch {
      // Si falla por permisos o cualquier otra razón, comportamiento legacy (arrancar en 0).
    }
  }

  const nextNumber = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    let current = 0;
    if (counterDoc.exists()) {
      current = counterDoc.data().current || 0;
    } else if (baselineFromLegacy > 0) {
      // Contador no existe pero hay productos legacy → arrancar desde el max real.
      current = baselineFromLegacy;
    }

    const next = current + 1;
    transaction.set(counterRef, { current: next, updatedAt: new Date() });

    return next;
  });

  const separator = prefix.includes('-') ? '-' : '-';
  return `${prefix}${separator}${nextNumber.toString().padStart(padLength, '0')}`;
}

/**
 * Obtiene el próximo número de secuencia SIN incrementar el contador.
 * Solo lectura — para preview en formularios.
 */
export async function peekNextSequenceNumber(
  prefix: string,
  padLength: number = 3
): Promise<string> {
  const counterRef = doc(db, 'contadores', prefix);
  const { getDoc } = await import('firebase/firestore');
  const counterDoc = await getDoc(counterRef);

  let current = 0;
  if (counterDoc.exists()) {
    current = counterDoc.data().current || 0;
  } else {
    // S3.4 · Mismo defensa que getNextSequenceNumber para coherencia del preview.
    const esPrefijoProducto = ['SUP', 'SKC', 'APPAREL', 'ALIM', 'BMN'].includes(prefix);
    if (esPrefijoProducto) {
      try {
        const snap = await getDocs(query(collection(db, 'productos'), where('lineaCodigo', '==', prefix))).catch(() => null);
        if (snap) {
          let max = 0;
          for (const d of snap.docs) {
            const sku = (d.data() as { sku?: string }).sku;
            const m = sku?.match(new RegExp(`^${prefix}-(\\d+)$`));
            if (m) max = Math.max(max, parseInt(m[1], 10));
          }
          current = max;
        }
      } catch { /* fallback 0 */ }
    }
  }

  const next = current + 1;
  const separator = prefix.includes('-') ? '-' : '-';
  return `${prefix}${separator}${next.toString().padStart(padLength, '0')}`;
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
