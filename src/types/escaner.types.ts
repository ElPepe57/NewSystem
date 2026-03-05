// ========== SCANNER TYPES ==========

export type ScannerMode = 'camera' | 'manual';

export type ScanResultStatus = 'found' | 'not_found' | 'error';

export interface ScanResult {
  barcode: string;
  format: string;
  timestamp: Date;
  status: ScanResultStatus;
  productoId?: string;
  productoNombre?: string;
  productoSKU?: string;
}

export interface ExternalProductInfo {
  name?: string;
  brand?: string;
  imageUrl?: string;
  category?: string;
  source: 'openfoodfacts' | 'manual';
}
