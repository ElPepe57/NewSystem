import { Timestamp } from 'firebase/firestore';

/**
 * Fuente del tipo de cambio
 * - manual: Ingresado manualmente por el usuario
 * - sunat: Obtenido de la API de SUNAT
 * - bcrp: Obtenido del Banco Central de Reserva del Perú
 */
export type FuenteTipoCambio = 'manual' | 'sunat' | 'bcrp' | 'paralelo' | 'exchangerate-api' | 'fallback';

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
  /** TC paralelo (mercado real — casas de cambio). Fuente principal para operaciones */
  paralelo?: { compra: number; venta: number };
  /** TC SUNAT oficial. Para contabilidad y cumplimiento fiscal */
  sunat?: { compra: number; venta: number };
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

// ============================================================
// TC CENTRALIZADO — Decisión 6 (Híbrido con umbral)
// ============================================================

/**
 * Estado de frescura del tipo de cambio
 * - fresh: TC tiene menos de umbralFreshHoras (default 24h) — uso silencioso
 * - stale: TC tiene entre umbralFreshHoras y umbralStaleHoras (24-72h) — banner amarillo
 * - expired: TC tiene más de umbralStaleHoras (72h) — bloqueo de operaciones
 * - unknown: No se pudo determinar (sin datos)
 */
export type TCFreshness = 'fresh' | 'stale' | 'expired' | 'unknown';

/**
 * Resultado de resolver el TC actual con información de frescura
 */
/** Modalidad del TC resuelto */
export type TCModalidad = 'paralelo' | 'sunat' | 'unico';

export interface TCResuelto {
  compra: number;
  venta: number;
  promedio: number;
  fuente: FuenteTipoCambio;
  modalidad: TCModalidad;
  fechaTC: Date;
  freshness: TCFreshness;
  edadHoras: number;
  esFallback: boolean;
}

/**
 * Configuración de umbrales de TC — almacenada en configuracion/tipoCambio
 */
export interface TCConfig {
  umbralFreshHoras: number;       // TC < este valor = fresh (default 24)
  umbralStaleHoras: number;       // TC < este valor = stale; > = expired (default 72)
  fallbackCompra: number;         // Valor de emergencia compra (default 3.70)
  fallbackVenta: number;          // Valor de emergencia venta (default 3.75)
  fallbackHabilitado: boolean;    // Solo admin activa en emergencia
  alertaVariacionPorcentaje: number; // Alertar si TC varía >N% vs día anterior
}

/** Valores por defecto de configuración TC */
export const TC_CONFIG_DEFAULTS: TCConfig = {
  umbralFreshHoras: 24,
  umbralStaleHoras: 72,
  fallbackCompra: 3.70,
  fallbackVenta: 3.75,
  fallbackHabilitado: true,       // Habilitado durante primeras semanas post-deploy
  alertaVariacionPorcentaje: 2,
};
