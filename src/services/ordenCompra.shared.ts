/**
 * ordenCompra.shared.ts
 *
 * Shared constants and the sequence-number helper used by all
 * ordenCompra sub-modules.
 */

import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import { COLLECTIONS } from '../config/collections';

export const ORDENES_COLLECTION = COLLECTIONS.ORDENES_COMPRA;
export const PROVEEDORES_COLLECTION = COLLECTIONS.PROVEEDORES;

export async function generateNumeroOrden(): Promise<string> {
  const year = new Date().getFullYear();
  return getNextSequenceNumber(`OC-${year}`, 3);
}
