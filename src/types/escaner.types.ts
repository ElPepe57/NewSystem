// ========== SCANNER TYPES ==========
import type { Timestamp } from 'firebase/firestore';

export type ScannerMode = 'camera' | 'manual';

export type ScanResultStatus = 'found' | 'not_found' | 'error';

export type ScanSource = 'escaner' | 'venta' | 'cotizacion' | 'transferencia' | 'recepcion' | 'conteo' | 'despacho';

export interface ScanResult {
  barcode: string;
  format: string;
  timestamp: Date;
  status: ScanResultStatus;
  productoId?: string;
  productoNombre?: string;
  productoSKU?: string;
  firestoreId?: string;
}

export interface ScanResultFirestore {
  id: string;
  barcode: string;
  format: string;
  timestamp: Timestamp;
  status: ScanResultStatus;
  productoId?: string;
  productoNombre?: string;
  productoSKU?: string;
  userId: string;
  source: ScanSource;
}

export interface ExternalProductInfo {
  name?: string;
  brand?: string;
  imageUrl?: string;
  category?: string;
  source: 'openfoodfacts' | 'manual';
}
