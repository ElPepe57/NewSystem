import { Timestamp } from 'firebase/firestore';

/**
 * Tipo de transferencia (genérico multi-origen)
 * - interna_origen: Movimiento entre almacenes/viajeros/couriers en país de origen
 * - internacional_peru: Envío internacional desde cualquier origen hacia Perú
 *
 * Legacy (backward compat, misma semántica):
 * - interna_usa: alias de interna_origen para docs existentes con origen USA
 * - usa_peru: alias de internacional_peru para docs existentes con origen USA
 */
export type TipoTransferencia =
  | 'interna_origen'        // Genérico: movimiento interno en país origen
  | 'internacional_peru'    // Genérico: envío internacional → Perú
  | 'interna_usa'           // Legacy: equivale a interna_origen (USA)
  | 'usa_peru';             // Legacy: equivale a internacional_peru (USA)

/**
 * Arrays de compatibilidad para queries y filtros
 */
export const TIPOS_TRANSFERENCIA_INTERNA: TipoTransferencia[] = ['interna_origen', 'interna_usa'];
export const TIPOS_TRANSFERENCIA_INTERNACIONAL: TipoTransferencia[] = ['internacional_peru', 'usa_peru'];

/**
 * Estado de la transferencia
 */
export type EstadoTransferencia =
  | 'borrador'          // Aún no confirmada
  | 'preparando'        // Seleccionando/preparando unidades
  | 'en_transito'       // En camino
  | 'recibida_parcial'  // Llegó pero faltan unidades
  | 'recibida_completa' // Todas las unidades llegaron
  | 'cancelada';        // Cancelada

/**
 * Motivo de transferencia interna USA
 */
export type MotivoTransferenciaUSA =
  | 'consolidacion'     // Juntar inventario en un solo viajero
  | 'capacidad'         // El viajero actual no tiene espacio
  | 'viaje_proximo'     // Mover a viajero que viaja pronto
  | 'costo_menor'       // Viajero con mejor tarifa de flete
  | 'otro';

/**
 * Transferencia
 * Representa el movimiento de unidades entre almacenes/viajeros
 */
export interface Transferencia {
  id: string;
  numeroTransferencia: string;       // TRF-2024-001, ENV-2024-001
  tipo: TipoTransferencia;
  estado: EstadoTransferencia;

  // === ORIGEN ===
  almacenOrigenId: string;
  almacenOrigenNombre: string;       // Desnormalizado
  almacenOrigenCodigo: string;

  // === DESTINO ===
  almacenDestinoId: string;
  almacenDestinoNombre: string;      // Desnormalizado
  almacenDestinoCodigo: string;

  // === UNIDADES ===
  unidades: TransferenciaUnidad[];
  totalUnidades: number;

  // === PRODUCTOS (resumen desnormalizado) ===
  productosSummary: {
    productoId: string;
    sku: string;
    nombre: string;
    cantidad: number;
  }[];

  // === COSTOS (solo para usa_peru) ===
  // El costo de flete por unidad está en el Producto, pero aquí
  // registramos el costo total de esta transferencia
  costoFleteTotal?: number;          // Suma de todos los fletes
  monedaFlete?: 'USD' | 'PEN';

  // === PAGO AL VIAJERO ===
  estadoPagoViajero?: 'pendiente' | 'parcial' | 'pagado';
  pagoViajero?: PagoViajero;            // Legacy: single payment (backward compat)
  pagosViajero?: PagoViajero[];         // Array de pagos parciales
  montoPagadoUSD?: number;              // Acumulado pagado en USD
  montoPendienteUSD?: number;           // costoFleteTotal - montoPagadoUSD

  // === MOTIVO (solo para interna_usa) ===
  motivo?: MotivoTransferenciaUSA;
  motivoDetalle?: string;

  // === TRACKING (principalmente para usa_peru) ===
  viajeroId?: string;                // ID del viajero que transporta
  viajeroNombre?: string;
  numeroTracking?: string;
  courier?: string;                  // Si usa courier externo

  // === FECHAS ===
  fechaCreacion: Timestamp;
  fechaPreparacion?: Timestamp;      // Cuando se empezó a preparar
  fechaSalida?: Timestamp;           // Cuando salió del origen
  fechaLlegadaEstimada?: Timestamp;
  fechaLlegadaReal?: Timestamp;

  // === TIEMPOS CALCULADOS ===
  diasEnTransito?: number;           // Calculado al recibir

  // === RECEPCIÓN ===
  recepcion?: RecepcionTransferencia;                  // Legacy: single reception (backward compat)
  recepcionesTransferencia?: RecepcionTransferencia[];  // Array de recepciones parciales
  totalUnidadesRecibidas?: number;                      // Acumulado recibidas across all receptions
  totalUnidadesFaltantes?: number;                      // Actualmente faltantes
  totalUnidadesDanadas?: number;                        // Acumulado dañadas

  // === LÍNEA DE NEGOCIO (auto-inherited from units) ===
  lineaNegocioId?: string;
  lineaNegocioNombre?: string;

  // === NOTAS ===
  notas?: string;

  // === AUDITORÍA ===
  creadoPor: string;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Registro de pago al viajero por el flete
 */
export interface PagoViajero {
  id: string;                       // PAG-VIA-{timestamp}
  fecha: Timestamp;                 // Fecha real del pago

  // Moneda y montos
  monedaPago: 'USD' | 'PEN';       // Moneda en la que se pagó
  montoOriginal: number;            // Monto en la moneda de pago
  montoUSD: number;                 // Equivalente en USD
  montoPEN: number;                 // Equivalente en PEN

  // Tipo de cambio
  tipoCambio: number;               // TC usado para conversión

  // Cuenta y método
  metodoPago: string;               // efectivo, transferencia_bancaria, zelle, etc.
  cuentaOrigenId?: string;          // ID de la cuenta de tesorería
  cuentaOrigenNombre?: string;      // Nombre de la cuenta

  // Referencias
  referencia?: string;              // Nro de operación, voucher, etc.
  notas?: string;

  // Tesorería
  movimientoTesoreriaId?: string;   // ID del movimiento en tesorería
  errorTesoreria?: boolean;         // True si el registro en tesorería falló
  errorTesoreriaMsg?: string;       // Mensaje de error

  // Auditoría
  registradoPor: string;
  fechaRegistro: Timestamp;
}

/**
 * Unidad dentro de una transferencia
 */
export interface TransferenciaUnidad {
  unidadId: string;
  productoId: string;
  sku: string;
  codigoUnidad: string;              // OC-001-001
  lote?: string;
  fechaVencimiento?: Timestamp;

  // Costo de flete de esta unidad (del Producto.costoFleteUSAPeru)
  costoFleteUSD: number;

  // Estado en esta transferencia
  estadoTransferencia: 'pendiente' | 'preparada' | 'enviada' | 'recibida' | 'faltante' | 'danada';

  // Si hubo problema
  incidencia?: string;
}

/**
 * Datos de recepción de una transferencia (soporta múltiples recepciones parciales)
 */
export interface RecepcionTransferencia {
  id?: string;                        // REC-TRF-{timestamp} (undefined in legacy records)
  numero?: number;                    // Secuencial: 1, 2, 3... (undefined in legacy records)

  fechaRecepcion: Timestamp;
  recibidoPor: string;

  // Conteo general (en legacy: acumulado total; en multi-recepcion: de ESTA recepcion)
  unidadesEsperadas: number;
  unidadesRecibidas: number;
  unidadesFaltantes: number;
  unidadesDanadas: number;

  // Detalle de unidades procesadas en ESTA recepcion
  unidadesProcesadas?: {
    unidadId: string;
    resultado: 'recibida' | 'faltante' | 'danada';
    incidencia?: string;
  }[];

  // Incidencias
  incidencias?: IncidenciaTransferencia[];

  // Confirmación
  observaciones?: string;
  fotoEvidencia?: string;            // URL de foto
}

/**
 * Tipo de disposición para unidades dañadas
 */
export type DisposicionDanada =
  | 'baja_definitiva'        // Destruir/descartar — genera gasto en cuenta 6952
  | 'devolucion_proveedor'   // Reclamo al viajero o proveedor — genera CxC en cuenta 162
  | 'reparacion_reingreso';  // Reparar/relabelar — vuelve a disponible_peru

/**
 * Responsable del daño
 */
export type ResponsableDano = 'viajero' | 'proveedor' | 'sin_responsable';

/**
 * Incidencia en una transferencia
 */
export interface IncidenciaTransferencia {
  id: string;
  tipo: 'faltante' | 'danada' | 'diferente' | 'otro';
  unidadId?: string;
  sku?: string;
  productoId?: string;
  productoNombre?: string;
  descripcion: string;
  evidenciaURL?: string;
  fechaRegistro: Timestamp;
  registradoPor: string;
  resuelta: boolean;
  resolucion?: string;
  fechaResolucion?: Timestamp;
  // Campos de disposición (para tipo 'danada')
  disposicion?: DisposicionDanada;
  disposicionMotivo?: string;
  disposicionPor?: string;         // userId que decidió la disposición
  disposicionFecha?: Timestamp;
  responsable?: ResponsableDano;
  montoReclamoPEN?: number;
  estadoReclamo?: 'pendiente' | 'aceptado' | 'rechazado' | 'cobrado';
}

/**
 * Datos para crear una transferencia
 */
export interface TransferenciaFormData {
  tipo: TipoTransferencia;
  almacenOrigenId: string;
  almacenDestinoId: string;

  // Unidades a transferir (IDs)
  unidadesIds: string[];

  // Para interna_usa
  motivo?: MotivoTransferenciaUSA;
  motivoDetalle?: string;

  // Para usa_peru
  viajeroId?: string;
  fechaSalidaEstimada?: Date;
  fechaLlegadaEstimada?: Date;
  numeroTracking?: string;

  // Costo de flete por producto (productoId -> costo total en USD)
  // El costo por unidad se calcula: costoFlete / cantidadUnidades
  costoFletePorProducto?: Record<string, number>;

  notas?: string;
}

/**
 * Datos para registrar recepción
 */
export interface RecepcionFormData {
  transferenciaId: string;

  // Estado de cada unidad
  unidadesRecibidas: {
    unidadId: string;
    recibida: boolean;
    danada: boolean;
    incidencia?: string;
  }[];

  // Fechas de vencimiento por unidadId (YYYY-MM-DD)
  // Cada unidad puede tener su propia fecha de vencimiento
  // Key: unidadId, Value: fecha en formato YYYY-MM-DD
  fechasVencimiento?: Record<string, string>;

  // Legacy: fechas por productoId (backward compat con recepciones antiguas)
  // Si existe fechasVencimiento[unidadId], tiene prioridad sobre este
  fechasVencimientoPorProducto?: Record<string, string>;

  // C3 — Costo de recojo en Perú (por recepción parcial)
  costoRecojoPEN?: number;              // Monto total del recojo de esta recepción
  // Se prorratea: costoRecojoPEN / unidades recibidas en esta recepción

  observaciones?: string;
  fotoEvidencia?: string;
}

/**
 * Filtros para buscar transferencias
 */
export interface TransferenciaFiltros {
  tipo?: TipoTransferencia;
  estado?: EstadoTransferencia;
  almacenOrigenId?: string;
  almacenDestinoId?: string;
  viajeroId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  conIncidencias?: boolean;
}

/**
 * Resumen de transferencias
 */
export interface ResumenTransferencias {
  // Totales
  totalTransferencias: number;
  enTransito: number;
  pendientesRecepcion: number;
  completadasMes: number;

  // Por tipo
  internasUSA: number;
  enviosUSAPeru: number;

  // Unidades
  unidadesEnTransitoUSA: number;
  unidadesEnTransitoPeru: number;

  // Tiempos
  tiempoPromedioTransitoUSAPeru: number;  // días

  // Incidencias
  transferenciasConIncidencias: number;
  unidadesFaltantesMes: number;
  unidadesDanadasMes: number;
}

/**
 * Historial de una unidad (para trazabilidad)
 */
export interface HistorialUnidadTransferencias {
  unidadId: string;
  sku: string;
  codigoUnidad: string;

  // Timeline de movimientos
  movimientos: {
    fecha: Timestamp;
    tipo: 'recepcion_usa' | 'transferencia_interna' | 'envio_peru' | 'recepcion_peru';
    almacenOrigenId?: string;
    almacenOrigenNombre?: string;
    almacenDestinoId?: string;
    almacenDestinoNombre?: string;
    transferenciaId?: string;
    numeroTransferencia?: string;
    diasEnAlmacen?: number;          // Tiempo que estuvo en ese almacén
  }[];

  // Estado actual
  almacenActualId: string;
  almacenActualNombre: string;
  diasEnAlmacenActual: number;

  // Totales
  totalTransferencias: number;
  tiempoTotalEnUSA: number;          // días totales en USA
}
