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
 * Subtipo para transportistas locales
 * - interno: Repartidor propio (motorizado, socio)
 * - externo: Courier tercerizado (Olva, Shalom, etc.)
 */
export type SubtipoTransportistaLocal = 'interno' | 'externo';

/**
 * Couriers externos soportados
 */
export type CourierExterno = 'olva' | 'mercado_envios' | 'urbano' | 'shalom' | 'otro';

/**
 * Tarifas del colaborador (varia segun tipo)
 */
export interface TarifasColaborador {
  // Viajero
  /** @deprecated S42j — Campo sin consumo en flete/pago/reportes. Se mantiene por retrocompat con datos existentes. */
  tarifaPorLibraUSD?: number;
  /** @deprecated S42j — Campo sin consumo en cálculos del negocio. */
  tarifaFijaPorViajeUSD?: number;

  // Courier externo
  tarifaBasePorEnvioUSD?: number;     // Tarifa base por envio
  tarifaPorKgUSD?: number;            // Tarifa por kg

  // Transportista local
  tarifaEntregaPEN?: number;          // Tarifa por entrega local
  zonaCobertura?: string;             // Descripcion de zona de cobertura
  comisionPorcentaje?: number;        // % sobre el valor de la venta
  costoFijo?: number;                 // Costo fijo por entrega (PEN)
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
  // Solo transportistas locales
  totalEntregas?: number;
  entregasExitosas?: number;
  entregasFallidas?: number;
  tasaExito?: number;                 // entregasExitosas / totalEntregas * 100
  costoPromedioPorEntrega?: number;   // Calculado automaticamente
  costoTotalHistorico?: number;       // Suma de todos los costos de entrega
  tiempoPromedioEntrega?: number;     // En horas
  zonasAtendidas?: string[];
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
  /** @deprecated S42j — Campo sin uso real en el negocio (no participa en cálculos ni decisiones operativas). Se mantiene por retrocompat con datos existentes. */
  frecuenciaViaje?: 'semanal' | 'quincenal' | 'mensual' | 'bimestral' | 'variable';
  /** @deprecated S42j — Campo sin consumo en flujo de trabajo. */
  proximoViaje?: Timestamp;

  // Solo transportistas locales
  subtipoTransportista?: SubtipoTransportistaLocal;  // interno | externo
  courierExterno?: CourierExterno;                   // solo si subtipo='externo'
  dni?: string;                                      // solo internos
  licencia?: string;                                 // solo internos

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
  /** @deprecated S42j — sin uso real en el negocio. */
  frecuenciaViaje?: 'semanal' | 'quincenal' | 'mensual' | 'bimestral' | 'variable';
  /** @deprecated S42j — sin consumo. */
  proximoViaje?: Date;
  notas?: string;
  // Solo transportistas locales
  subtipoTransportista?: SubtipoTransportistaLocal;
  courierExterno?: CourierExterno;
  dni?: string;
  licencia?: string;
}

// ============================================
// ALIAS DE COMPATIBILIDAD — Transportista = Colaborador tipo transportista_local
// Permiten que el codigo consumidor siga compilando sin reescritura masiva
// ============================================

/** Alias: Transportista es un Colaborador de tipo transportista_local */
export type Transportista = Colaborador;

/** Alias: subtipo de transportista (interno | externo) */
export type TipoTransportista = SubtipoTransportistaLocal;

/** Alias: estado de transportista */
export type EstadoTransportista = EstadoColaborador;
