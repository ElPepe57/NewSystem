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
 * Tramo de peso escalonado para tarifa de flete (S52 · D-11)
 *
 * Los tramos definen el costo unitario del flete según el peso del producto.
 * Ejemplo típico de acuerdo con viajero:
 *   { pesoDesde: 0,   pesoHasta: 0.5,  costoUnitario: 5 }   // < 0.5 lb = $5/ud
 *   { pesoDesde: 0.5, pesoHasta: 1.0,  costoUnitario: 6 }   // 0.5-1 lb = $6/ud
 *   { pesoDesde: 1.0, pesoHasta: 1.5,  costoUnitario: 7 }   // 1-1.5 lb = $7/ud
 *   { pesoDesde: 2.0, pesoHasta: null, costoUnitario: 10 }  // >= 2 lb = $10/ud (último tramo)
 *
 * Solo libras (lb). La conversión desde kg (si algún producto la usa)
 * se hace al vuelo en el cálculo del wizard.
 */
export interface TramoPeso {
  /** Peso mínimo del tramo (inclusive) en libras */
  pesoDesde: number;
  /** Peso máximo del tramo (exclusive) en libras. `null` = infinito (último tramo). */
  pesoHasta: number | null;
  /** Costo por unidad en USD que se aplica a productos cuyo peso cae en este tramo */
  costoUnitario: number;
}

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
  /** @deprecated S42l — Campo sin consumo en flete/pagos. Retrocompat con datos existentes. */
  tarifaBasePorEnvioUSD?: number;
  /** @deprecated S42l — Campo sin consumo. */
  tarifaPorKgUSD?: number;

  // Transportista local
  /** @deprecated S42l — Sin uso en cálculos. */
  tarifaEntregaPEN?: number;
  /** @deprecated S42l — Sin uso. */
  zonaCobertura?: string;
  /** @deprecated S42l — Sin uso. */
  comisionPorcentaje?: number;
  /** @deprecated S42l — Sin uso. */
  costoFijo?: number;

  /**
   * Tarifa por tramos de peso (S52 · D-11).
   * Aplicable a viajeros y couriers externos. Cuando el wizard de envíos
   * selecciona este colaborador como transportador y elige la modalidad
   * "Por tramos de peso", la tabla se auto-carga desde este campo.
   *
   * Requisitos de integridad (validar en UI antes de persistir):
   * - Los tramos deben estar en orden ascendente por `pesoDesde`.
   * - No deben tener gaps (el `pesoHasta` de un tramo = `pesoDesde` del siguiente).
   * - Exactamente un tramo con `pesoHasta === null` (el último, cubre peso infinito).
   * - Todos los `costoUnitario` >= 0.
   */
  tarifaPorTramos?: TramoPeso[];
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
  subtipoTransportista?: SubtipoTransportistaLocal;  // interno | externo (activo en UI)
  /** @deprecated S42l — Sin uso en UI. */
  courierExterno?: CourierExterno;
  /** @deprecated S42l — Dato personal no requerido para flujo operativo. */
  dni?: string;
  /** @deprecated S42l — Sin uso. */
  licencia?: string;

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
  // Solo transportistas locales (subtipo sigue en UI; resto @deprecated S42l)
  subtipoTransportista?: SubtipoTransportistaLocal;
  /** @deprecated S42l */
  courierExterno?: CourierExterno;
  /** @deprecated S42l */
  dni?: string;
  /** @deprecated S42l */
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
