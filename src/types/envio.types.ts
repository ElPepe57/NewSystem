import { Timestamp } from 'firebase/firestore';

/**
 * Tipo de envio (reemplaza TipoTransferencia del modelo legacy)
 * - interna_origen: Movimiento interno en el pais de origen entre casillas/viajeros
 * - internacional_peru: Envio internacional desde cualquier origen hacia Peru
 */
export type TipoEnvio = 'interna_origen' | 'internacional_peru';

/**
 * Motivo de un envio interno en origen
 */
export type MotivoEnvioInterno =
  | 'consolidacion'   // Juntar inventario en una casilla
  | 'capacidad'       // La casilla actual no tiene espacio
  | 'viaje_proximo'   // Mover a viajero que viaja pronto
  | 'costo_menor'     // Viajero con mejor tarifa de flete
  | 'otro';

/**
 * Arrays de compatibilidad para queries y filtros
 */
export const TIPOS_ENVIO_INTERNO: TipoEnvio[] = ['interna_origen'];
export const TIPOS_ENVIO_INTERNACIONAL: TipoEnvio[] = ['internacional_peru'];

/**
 * Disposicion de una unidad danada
 */
export type DisposicionDanada =
  | 'baja_definitiva'
  | 'devolucion_proveedor'
  | 'reparacion_reingreso';

/**
 * Responsable del dano
 */
export type ResponsableDano = 'viajero' | 'proveedor' | 'sin_responsable';

/**
 * Incidencia registrada en un envio
 */
export interface IncidenciaEnvio {
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
  disposicion?: DisposicionDanada;
  disposicionMotivo?: string;
  disposicionPor?: string;
  disposicionFecha?: Timestamp;
  responsable?: ResponsableDano;
  montoReclamoPEN?: number;
  estadoReclamo?: 'pendiente' | 'aceptado' | 'rechazado' | 'cobrado';
}

/**
 * Estado del envio
 */
export type EstadoEnvio =
  | 'borrador'           // Creado automaticamente al confirmar OC, pendiente de preparar
  | 'confirmado'         // Listo para salir
  | 'en_transito'        // En camino
  | 'retenida_aduana'    // Retenido en aduana (excepcion)
  | 'recibida_parcial'   // Llego parcialmente
  | 'recibida_completa'  // Todas las unidades recibidas
  | 'perdida_total'      // Envio perdido completamente (excepcion)
  | 'cancelada';         // Cancelado

/**
 * Tipo de origen del envio
 */
export type OrigenTipoEnvio = 'proveedor' | 'casilla';

/**
 * Metodo de prorrateo de costos landed
 * - fijo_por_unidad: Monto fijo por cada unidad del envio
 * - variado_por_producto: Monto distinto por producto (manual)
 * - total_por_peso: Monto total dividido proporcionalmente por peso
 * - total_por_valor: Monto total dividido proporcionalmente por valor USD
 */
export type MetodoProrrateo = 'fijo_por_unidad' | 'variado_por_producto' | 'total_por_peso' | 'total_por_valor';

/**
 * Costo landed — costo de importacion asociado a un envio
 */
export interface CostoLanded {
  id: string;                          // CL-{timestamp}
  categoriaCostoId: string;            // Ref a categorias de costos (maestro dinamico)
  categoriaCostoNombre: string;        // Desnormalizado
  descripcion?: string;

  // Monto
  monto: number;
  moneda: 'USD' | 'PEN';
  montoPEN: number;                    // Convertido a PEN
  tipoCambio?: number;                 // TC usado si moneda=USD

  // Prorrateo
  metodoProrrateo: MetodoProrrateo;
  // Si variado_por_producto: mapa productoId -> monto
  detalleVariado?: Record<string, number>;

  // Pago
  pagado: boolean;
  fechaPago?: Timestamp;
  movimientoTesoreriaId?: string;

  // Auditoria
  creadoPor: string;
  fechaCreacion: Timestamp;
}

/**
 * Unidad dentro de un envio
 */
export interface EnvioUnidad {
  unidadId: string;
  productoId: string;
  sku: string;
  codigoUnidad: string;
  pesoLibras?: number;

  // Flete de esta unidad (especifico para envios internacionales)
  costoFleteUSD?: number;

  // Datos de lote y vencimiento
  lote?: string;
  fechaVencimiento?: Timestamp;

  // Estado en este envio
  estadoEnvio: 'pendiente' | 'preparada' | 'enviada' | 'recibida' | 'faltante' | 'danada' | 'perdida' | 'retenida';

  // Si hubo problema
  incidencia?: string;
}

/**
 * Datos de recepcion de un envio
 */
export interface RecepcionEnvio {
  id: string;                          // REC-ENV-{timestamp}
  numero: number;                      // Secuencial: 1, 2, 3...
  fechaRecepcion: Timestamp;
  recibidoPor: string;

  // Conteo
  unidadesEsperadas: number;
  unidadesRecibidas: number;
  unidadesFaltantes: number;
  unidadesDanadas: number;

  // Detalle
  unidadesProcesadas: {
    unidadId: string;
    resultado: 'recibida' | 'faltante' | 'danada' | 'perdida' | 'retenida';
    incidencia?: string;
    fechaVencimiento?: string;         // YYYY-MM-DD
  }[];

  observaciones?: string;
  fotoEvidencia?: string;
}

/**
 * Envio — movimiento fisico de productos entre ubicaciones
 * Reemplaza a Transferencia en el modelo anterior.
 */
export interface Envio {
  id: string;
  numeroEnvio: string;                 // ENV-2026-001
  estado: EstadoEnvio;

  // Clasificacion (nuevo — reemplaza TipoTransferencia)
  tipo?: TipoEnvio;
  motivo?: MotivoEnvioInterno;
  motivoDetalle?: string;

  // Origen polimorfico
  origenTipo: OrigenTipoEnvio;
  origenProveedorId?: string;          // Si origenTipo = 'proveedor'
  origenProveedorNombre?: string;
  origenCasillaId?: string;            // Si origenTipo = 'casilla'
  origenCasillaNombre?: string;
  origenCasillaCodigo?: string;

  // Destino (siempre una casilla)
  destinoCasillaId: string;
  destinoCasillaNombre: string;
  destinoCasillaCodigo: string;

  // Transportador
  colaboradorId?: string;              // Quien transporta (viajero, courier, etc.)
  colaboradorNombre?: string;
  colaboradorTipo?: string;            // TipoColaborador desnormalizado

  // Vinculo con OC
  ordenCompraId?: string;
  ordenCompraNumero?: string;
  subOrdenId?: string;                 // Si viene de una sub-orden

  // Unidades
  unidades: EnvioUnidad[];
  totalUnidades: number;

  // Productos (resumen desnormalizado)
  productosSummary: {
    productoId: string;
    sku: string;
    nombre: string;
    cantidad: number;
  }[];

  // Costos landed (costos de importacion de este envio)
  costosLanded: CostoLanded[];
  costoLandedTotalPEN: number;         // Suma de todos los costos landed en PEN

  // Peso
  pesoTotalLibras?: number;

  // Flete (separado de costos landed: es lo que se le paga al colaborador transportador)
  costoFleteTotal?: number;
  monedaFlete?: 'USD' | 'PEN';
  costoFletePorLibra?: number;

  // Pago al colaborador (viajero/courier)
  estadoPagoColaborador?: 'pendiente' | 'parcial' | 'pagado';
  pagosColaborador?: PagoColaborador[];
  montoPagadoUSD?: number;
  montoPendienteUSD?: number;

  // Tracking
  numeroTracking?: string;
  courier?: string;

  // Fechas
  fechaCreacion: Timestamp;
  fechaConfirmacion?: Timestamp;
  fechaSalida?: Timestamp;
  fechaLlegadaEstimada?: Timestamp;
  fechaLlegadaReal?: Timestamp;
  diasEnTransito?: number;

  // Recepciones
  recepciones?: RecepcionEnvio[];
  totalUnidadesRecibidas?: number;
  totalUnidadesFaltantes?: number;
  totalUnidadesDanadas?: number;

  // Linea de negocio
  lineaNegocioId?: string;
  lineaNegocioNombre?: string;

  // Incidencias
  incidencias?: IncidenciaEnvio[];

  // Notas
  notas?: string;

  // Auditoria
  creadoPor: string;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Pago al colaborador (viajero/courier) por el transporte
 */
export interface PagoColaborador {
  id: string;                          // PAG-COL-{timestamp}
  fecha: Timestamp;

  monedaPago: 'USD' | 'PEN';
  montoOriginal: number;
  montoUSD: number;
  montoPEN: number;
  tipoCambio: number;

  metodoPago: string;
  cuentaOrigenId?: string;
  cuentaOrigenNombre?: string;
  referencia?: string;
  notas?: string;

  movimientoTesoreriaId?: string;
  errorTesoreria?: boolean;
  errorTesoreriaMsg?: string;

  registradoPor: string;
  fechaRegistro: Timestamp;
}

/**
 * Datos para crear un envio
 */
export interface EnvioFormData {
  origenTipo: OrigenTipoEnvio;
  origenProveedorId?: string;
  origenCasillaId?: string;
  destinoCasillaId: string;
  colaboradorId?: string;
  // Alias semantico de colaboradorId cuando el colaborador llega como viajero internacional
  viajeroId?: string;
  ordenCompraId?: string;
  subOrdenId?: string;
  unidadesIds: string[];
  unidadesDetalle?: EnvioUnidad[];  // Datos completos de unidades para poblar envio.unidades[]

  // Clasificacion
  tipo?: TipoEnvio;
  motivo?: MotivoEnvioInterno;
  motivoDetalle?: string;

  // Flete por producto al crear (productoId -> costoTotalUSD del flete de ese producto)
  costoFletePorProducto?: Record<string, number>;

  numeroTracking?: string;
  courier?: string;
  fechaSalidaEstimada?: Date;
  fechaLlegadaEstimada?: Date;
  notas?: string;
}

/**
 * Filtros para busqueda de envios
 */
export interface EnvioFiltros {
  estado?: EstadoEnvio;
  origenTipo?: OrigenTipoEnvio;
  tipo?: TipoEnvio;
  origenCasillaId?: string;
  destinoCasillaId?: string;
  colaboradorId?: string;
  ordenCompraId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  conIncidencias?: boolean;
}

/**
 * Datos para registrar recepcion de un envio
 */
export interface RecepcionEnvioFormData {
  envioId: string;

  unidadesRecibidas: {
    unidadId: string;
    recibida: boolean;
    danada: boolean;
    incidencia?: string;
  }[];

  // Fechas de vencimiento por unidadId (YYYY-MM-DD)
  fechasVencimiento?: Record<string, string>;

  // C3 — Costo de recojo en Peru (por recepcion parcial)
  costoRecojoPEN?: number;

  observaciones?: string;
  fotoEvidencia?: string;
}

/**
 * Resumen de envios (KPIs del modulo)
 */
export interface ResumenEnvios {
  totalEnvios: number;
  enTransito: number;
  pendientesRecepcion: number;
  completadasMes: number;
  internos: number;
  internacionales: number;
  tiempoPromedioTransitoDias: number;
  enviosConIncidencias: number;
  unidadesFaltantesMes: number;
  unidadesDanadasMes: number;
}
