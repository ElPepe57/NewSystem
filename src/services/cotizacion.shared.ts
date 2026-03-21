/**
 * cotizacion.shared.ts
 * Shared constants and helper functions used across all cotizacion sub-service modules.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';

// ─── Collection names ─────────────────────────────────────────────────────────

export const COLLECTION_NAME = COLLECTIONS.COTIZACIONES;
export const VENTAS_COLLECTION = COLLECTIONS.VENTAS;

// ─── Mapeo legacy de canales a nombres legibles ───────────────────────────────

export const LEGACY_CANAL_NAMES: Record<string, string> = {
  mercado_libre: 'Mercado Libre',
  mercadolibre: 'Mercado Libre',
  directo: 'Directo',
  otro: 'Otro'
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolver nombre de canal desde ID o valor legacy */
export async function resolverCanalNombre(canal: string): Promise<string | undefined> {
  if (!canal) return undefined;
  if (LEGACY_CANAL_NAMES[canal]) return LEGACY_CANAL_NAMES[canal];
  try {
    const canalDoc = await getDoc(doc(db, COLLECTIONS.CANALES_VENTA, canal));
    if (canalDoc.exists()) return canalDoc.data().nombre;
  } catch { /* ignore */ }
  return canal;
}

/** Generar número de cotización (COT-YYYY-NNN) */
export async function generateNumeroCotizacion(): Promise<string> {
  const year = new Date().getFullYear();
  return getNextSequenceNumber(`COT-${year}`, 3);
}
