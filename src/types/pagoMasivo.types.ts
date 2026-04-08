/**
 * pagoMasivo.types.ts
 *
 * Tipos para el módulo de Pagos Masivos (TAREA-101).
 * Un LotePago agrupa N pagos individuales ejecutados secuencialmente.
 */
import { Timestamp } from 'firebase/firestore';
import type { MetodoPagoUnificado } from './pago.types';
import type { TipoPendiente, MonedaTesoreria } from './tesoreria.types';

// ============================================
// ESTADO DE ITEMS DEL LOTE
// ============================================

export type EstadoItemLote = 'pendiente' | 'procesando' | 'exitoso' | 'error';

// ============================================
// ITEM DEL LOTE (resultado por documento)
// ============================================

export interface ResultadoItemLote {
  documentoId: string;
  tipoDocumento: TipoPendiente;
  numeroDocumento: string;
  contraparteNombre: string;
  montoPagado: number;
  monedaDocumento: MonedaTesoreria;
  estado: EstadoItemLote;
  error?: string;
  pagoId?: string;
}

// ============================================
// LOTE DE PAGO (documento en Firestore)
// ============================================

export interface LotePago {
  id: string;                         // LOTE-2026-001
  tipo: 'egreso' | 'ingreso';
  fecha: Timestamp;

  // Configuración de pago común
  monedaPago: MonedaTesoreria;
  tipoCambio: number;
  metodoPago: MetodoPagoUnificado;
  cuentaId: string;
  cuentaNombre: string;
  referencia?: string;
  notas?: string;

  // Items
  items: ResultadoItemLote[];
  totalItems: number;
  itemsExitosos: number;
  itemsConError: number;

  // Totales (solo de items exitosos)
  montoTotalPagado: number;
  montoTotalPEN: number;
  montoTotalUSD: number;

  // Auditoría
  ejecutadoPor: string;
  fechaEjecucion: Timestamp;
  duracionMs: number;
}

// ============================================
// CONFIGURACIÓN DE PAGO (panel lateral UI)
// ============================================

export interface ConfigPagoMasivo {
  monedaPago: MonedaTesoreria;
  tipoCambio: number;
  metodoPago: MetodoPagoUnificado;
  cuentaId: string;
  cuentaNombre: string;
  referencia: string;
  notas: string;
  fechaPago: string;               // ISO date string
}

// ============================================
// ITEM SELECCIONADO (estado en UI)
// ============================================

export interface ItemSeleccionado {
  documentoId: string;
  tipoDocumento: TipoPendiente;
  numeroDocumento: string;
  contraparteNombre: string;
  montoOriginal: number;           // monto pendiente del documento
  montoPagar: number;              // monto a pagar (editable, <= montoOriginal)
  monedaDocumento: MonedaTesoreria;
}

// ============================================
// PROGRESO DE EJECUCIÓN
// ============================================

export interface ProgresoLote {
  total: number;
  procesados: number;
  exitosos: number;
  errores: number;
  itemActual?: string;             // numeroDocumento del item en proceso
  ejecutando: boolean;
  resultados: ResultadoItemLote[];
}
