import type { Timestamp } from 'firebase/firestore';

export type FuenteTC = 
  | 'manual'           // Ingresado manualmente por usuario
  | 'api_sunat'        // Consultado de API SUNAT
  | 'api_sbs'          // Consultado de API SBS
  | 'api_net'          // Consultado de APIs.net.pe
  | 'promedio';        // Promedio de varias fuentes

export interface TipoCambio {
  id: string;
  fecha: Timestamp;           // Fecha del tipo de cambio
  
  // Valores principales
  compra: number;             // TC de compra (venta de dólares)
  venta: number;              // TC de venta (compra de dólares)
  promedio: number;           // (compra + venta) / 2
  
  // Metadata
  fuente: FuenteTC;
  observaciones?: string;
  
  // Análisis
  variacionCompra?: number;   // % variación vs día anterior
  variacionVenta?: number;    // % variación vs día anterior
  alertaVariacion?: boolean;  // true si variación > 3%
  
  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  ultimaEdicion?: Timestamp;
}

export interface TipoCambioFormData {
  fecha: Date;
  compra: number;
  venta: number;
  fuente: FuenteTC;
  observaciones?: string;
}

export interface TipoCambioStats {
  tcActual: TipoCambio | null;
  tcAnterior: TipoCambio | null;
  variacionCompra: number;
  variacionVenta: number;
  promedioSemana: number;
  promedioMes: number;
  minimo30Dias: number;
  maximo30Dias: number;
}

export interface TipoCambioHistorial {
  fecha: string;
  compra: number;
  venta: number;
  promedio: number;
}

// Para respuesta de API
export interface TipoCambioAPI {
  compra: number;
  venta: number;
  fecha: string;
  fuente: string;
}