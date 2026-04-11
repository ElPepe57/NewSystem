import { Timestamp } from 'firebase/firestore';

/**
 * Tipo de colaborador en la red logistica
 * - empresa: La propia Vitaskin Peru (duena del almacen principal)
 * - viajero: Persona fisica que transporta productos (ej. Angie Price)
 * - courier_externo: Empresa de mensajeria internacional (DHL, FedEx, etc.)
 * - transportista_local: Delivery local en Peru (Olva, Shalom, motorizados)
 */
export type TipoColaborador = 'empresa' | 'viajero' | 'courier_externo' | 'transportista_local';

/**
 * Estado del colaborador
 */
export type EstadoColaborador = 'activo' | 'inactivo' | 'suspendido';

/**
 * Tarifas del colaborador (varia segun tipo)
 */
export interface TarifasColaborador {
  // Viajero
  tarifaPorLibraUSD?: number;         // Tarifa por libra de peso
  tarifaFijaPorViajeUSD?: number;     // Tarifa fija por viaje (si aplica)

  // Courier externo
  tarifaBasePorEnvioUSD?: number;     // Tarifa base por envio
  tarifaPorKgUSD?: number;            // Tarifa por kg

  // Transportista local
  tarifaEntregaPEN?: number;          // Tarifa por entrega local
  zonaCobertura?: string;             // Descripcion de zona de cobertura
}

/**
 * Metricas operativas del colaborador
 */
export interface MetricasColaborador {
  enviosRealizados: number;
  enviosCompletados: number;
  enviosConIncidencia: number;
  tasaIncidencias: number;            // %
  unidadesTransportadas: number;
  tiempoPromedioEntregaDias: number;
  // Solo viajeros
  viajesRealizados?: number;
  proximoViaje?: Timestamp;
}

/**
 * Colaborador de la red logistica
 */
export interface Colaborador {
  id: string;
  codigo: string;                     // COL-001, COL-002, etc.
  nombre: string;
  tipo: TipoColaborador;
  estado: EstadoColaborador;

  // Contacto
  telefono?: string;
  email?: string;
  whatsapp?: string;

  // Ubicacion base
  pais: string;                       // USA, Peru, China, etc.
  ciudad?: string;
  direccion?: string;

  // Tarifas
  tarifas?: TarifasColaborador;

  // Metricas
  metricas?: MetricasColaborador;

  // Solo viajeros
  frecuenciaViaje?: 'semanal' | 'quincenal' | 'mensual' | 'bimestral' | 'variable';
  proximoViaje?: Timestamp;

  // Notas
  notas?: string;

  // Auditoria
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Datos para crear/editar un colaborador
 */
export interface ColaboradorFormData {
  nombre: string;
  tipo: TipoColaborador;
  estado: EstadoColaborador;
  telefono?: string;
  email?: string;
  whatsapp?: string;
  pais: string;
  ciudad?: string;
  direccion?: string;
  tarifas?: TarifasColaborador;
  frecuenciaViaje?: 'semanal' | 'quincenal' | 'mensual' | 'bimestral' | 'variable';
  proximoViaje?: Date;
  notas?: string;
}
