import { Timestamp } from 'firebase/firestore';

/**
 * Fuente del tipo de cambio
 * - manual: Ingresado manualmente por el usuario
 * - sunat: Obtenido de la API de SUNAT
 * - bcrp: Obtenido del Banco Central de Reserva del Perú
 */
export type FuenteTipoCambio = 'manual' | 'sunat' | 'bcrp';

/**
 * Tipo de Cambio
 * Representa el tipo de cambio USD/PEN para una fecha específica
 */
export interface TipoCambio {
  id: string;
  fecha: Timestamp;
  compra: number;
  venta: number;
  promedio: number;           // Promedio de compra y venta: (compra + venta) / 2
  fuente: FuenteTipoCambio;
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Datos para crear o actualizar un Tipo de Cambio
 */
export interface TipoCambioFormData {
  fecha: Date;
  compra: number;
  venta: number;
  fuente: FuenteTipoCambio;
}

/**
 * Respuesta de la API de SUNAT
 */
export interface SunatTCResponse {
  fecha: string;
  compra: number;
  venta: number;
}

/**
 * Filtros para consultar el historial de TC
 */
export interface TipoCambioFiltros {
  fechaInicio?: Date;
  fechaFin?: Date;
  fuente?: FuenteTipoCambio;
}

/**
 * Punto de datos para el gráfico de evolución
 */
export interface TipoCambioDataPoint {
  fecha: string;
  compra: number;
  venta: number;
}
