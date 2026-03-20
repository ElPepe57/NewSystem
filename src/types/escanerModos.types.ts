// ========== SCANNER MODES TYPES ==========
import type { Timestamp } from 'firebase/firestore';
import type { Producto } from './producto.types';

/** All available scanner modes */
export type ScannerModoId = 'consulta' | 'auditoria' | 'recepcion' | 'despacho' | 'transferencia';

/** Generic accumulator item used by all modes */
export interface AccumulatorItem<T = Record<string, never>> {
  productoId: string;
  producto: Producto;
  cantidad: number;
  modeData: T;
}

// ========== MODE 2: AUDITORIA ==========

export interface AuditoriaItem {
  stockSistema: number;
  almacenId: string;
  discrepancia: number; // cantidad - stockSistema
}

export type AuditoriaEstado = 'en_progreso' | 'finalizado';

export interface AuditoriaSession {
  id?: string;
  fecha: Date | Timestamp;
  almacenId: string;
  almacenNombre: string;
  items: AuditoriaSessionItem[];
  estado: AuditoriaEstado;
  creadoPor: string;
  notas?: string;
  resumen: AuditoriaResumen;
}

export interface AuditoriaSessionItem {
  productoId: string;
  sku: string;
  nombre: string; // marca + nombreComercial
  cantidadFisica: number;
  stockSistema: number;
  discrepancia: number;
}

export interface AuditoriaResumen {
  totalProductos: number;
  coincidencias: number;
  sobrantes: number;
  faltantes: number;
}

// ========== MODE 3: RECEPCION ==========

export interface RecepcionScanItem {
  esperado: number;
  recibido: number;
  estadoVisual: 'completo' | 'parcial' | 'excedido' | 'pendiente';
  fechaVencimiento?: string; // YYYY-MM-DD
}

// ========== MODE 4: DESPACHO ==========

export type DespachoTipo = 'ml_order' | 'cotizacion' | 'venta_directa';

export interface DespachoContexto {
  tipo: DespachoTipo;
  referenciaId?: string;
  referenciaNombre?: string;
}

export interface DespachoScanItem {
  esperado: number;
  escaneado: number;
  validado: boolean; // escaneado >= esperado
}

export interface VentaDirectaItem {
  precioUnitario: number;
  subtotal: number;
}

// ========== MODE 5: TRANSFERENCIA ==========

export interface TransferenciaScanItem {
  stockDisponible: number;
  almacenOrigenId: string;
}
