import { Timestamp } from 'firebase/firestore';

/**
 * Pais de Origen
 * Coleccion Firestore: paisesOrigen
 * Cada pais donde se pueden comprar/sourcing productos
 */
export interface PaisOrigen {
  id: string;
  nombre: string;          // 'Estados Unidos', 'China', 'Corea del Sur', 'Peru'
  codigo: string;          // 'USA', 'CHN', 'KOR', 'PER' — ISO-like short code
  codigoISO?: string;      // 'US', 'CN', 'KR', 'PE' — ISO 3166-1 alpha-2
  activo: boolean;

  // Metadata logistica
  tiempoTransitoEstimadoDias?: number;  // Lead time promedio al destino (Peru)
  modeloLogistico?: string;              // 'viajero', 'courier', 'freight', 'local'
  monedaCompra?: string;                 // 'USD', 'CNY', 'KRW', 'PEN'

  // Tarifa de flete estimada por ruta (origen → Perú)
  tarifaFleteEstimadaUSD?: number;       // USD promedio por unidad para esta ruta
  metodoEnvio?: string;                  // 'viajero' | 'courier' | 'freight_maritimo' | 'freight_aereo'
  tiempoTransitoDias?: number;           // Tiempo estimado de tránsito en días (envío)
  notasRuta?: string;                    // Notas adicionales sobre la ruta

  // Auditoria
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

export type MetodoEnvio = 'viajero' | 'courier' | 'freight_maritimo' | 'freight_aereo';

export const METODO_ENVIO_LABELS: Record<MetodoEnvio, string> = {
  viajero: 'Viajero',
  courier: 'Courier',
  freight_maritimo: 'Freight Marítimo',
  freight_aereo: 'Freight Aéreo',
};

export interface PaisOrigenFormData {
  nombre: string;
  codigo: string;
  codigoISO?: string;
  activo: boolean;
  tiempoTransitoEstimadoDias?: number;
  modeloLogistico?: string;
  monedaCompra?: string;
  tarifaFleteEstimadaUSD?: number;
  metodoEnvio?: MetodoEnvio;
  tiempoTransitoDias?: number;
  notasRuta?: string;
}
