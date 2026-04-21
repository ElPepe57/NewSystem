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
 *
 * Subtipo 'aduana' cubre retenciones por autoridades aduaneras (solo aplica cuando el envío
 * cruza frontera hacia Perú). El subtipo 'otro' permanece para casos no categorizados.
 * NOTA: antes de S40 las incidencias de aduana se guardaban como tipo='otro' con descripción
 * que empezaba con "Retenida en aduana" — los lectores legacy siguen funcionando porque
 * la detección fallback se hace por descripción.
 */
export interface IncidenciaEnvio {
  id: string;
  tipo: 'faltante' | 'danada' | 'diferente' | 'aduana' | 'otro';
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

  // S40 — Campos específicos de aduana (solo aplicables cuando tipo='aduana')
  gastosLiberacionPEN?: number;        // Tasas/aranceles pagados al liberar (PEN)
  fechaRetencion?: Timestamp;          // Cuando quedó retenida en aduana
  fechaLiberacion?: Timestamp;         // Cuando se liberó
  documentoLiberacion?: string;        // URL de evidencia (DUA, constancia, etc.)
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

  // S46 (D-18) — Scope del costo:
  //   'envio' → afecta todas las unidades del envío (default, backcompat)
  //   'tanda' → afecta solo las unidades de una sub-tanda específica (tandaId required)
  // Registros existentes sin scope se asumen 'envio' por compatibilidad retroactiva.
  scope?: 'envio' | 'tanda';
  /** Required si scope='tanda': id del SubEnvioT1 al que aplica este costo */
  tandaId?: string;

  // S46 (D-17) — Estado del costo para el cierre financiero:
  //   'estimado'   → valor conocido pero pendiente de factura firme (default al crear)
  //   'confirmado' → factura emitida y verificada, entra al CTRU final al finalizar
  // Costos 'confirmado' NO se pueden editar (solo reabrir con auditoría).
  // Costos 'estimado' bloquean el cierre financiero del envío/tanda.
  estado?: 'estimado' | 'confirmado';
  /** Fecha en que se confirmó el costo (transición estimado → confirmado) */
  fechaConfirmacion?: Timestamp;
  /** Usuario que confirmó el costo */
  confirmadoPor?: string;
  /** Nº factura o documento de respaldo (para auditoría del confirmado) */
  facturaReferencia?: string;
  /** Motivo por el que aún está estimado (ej. "pendiente factura del viajero") */
  motivoEstimado?: string;

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
  origenProveedorPais?: string;        // Desnormalizado (S38)
  origenCasillaId?: string;            // Si origenTipo = 'casilla'
  origenCasillaNombre?: string;
  origenCasillaCodigo?: string;
  origenCasillaPais?: string;

  // Destino (siempre una casilla)
  destinoCasillaId: string;
  destinoCasillaNombre: string;
  destinoCasillaCodigo: string;
  destinoCasillaPais?: string;         // Desnormalizado (S38)

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
    nombre: string;          // = nombreComercial del catálogo
    cantidad: number;
    // S38-014: snapshot enriquecido por línea de negocio (SUP vs SKC)
    // Permite getDescripcionProducto() consistente sin lookup runtime
    marca?: string;
    presentacion?: string;
    contenido?: string;
    dosaje?: string;
    sabor?: string;
    pesoLibras?: number;
    atributosSkincare?: import('./producto.types').AtributosSkincare;
    lineaNegocioId?: string;
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

  // S45 (D-3) — Sub-envíos T1: tandas de despacho del proveedor dentro del mismo
  // envío T1 (casos A, B, D). Ejemplo: Amazon despacha una sub-orden de 7 unidades
  // en 3 paquetes con fechas 29-mar / 30-mar / 01-abr → 3 SubEnvioT1.
  // Si no hay sub-tandas explícitas, el envío funciona plano (una sola tanda
  // implícita con todas las unidades). Al recibir la primera tanda parcial, se
  // puede crear retroactivamente (modo reactivo) o pueden crearse prospectivamente
  // al recibir el aviso del proveedor. Ver docs/MODELO_ENVIOS_TRANSVERSAL.md §7.
  subEnvios?: SubEnvioT1[];

  // S46 (D-17) — Cierre financiero del envío (distinto del cierre operativo).
  // El cierre operativo = estado='recibida_completa' (mercadería llegó).
  // El cierre financiero = todos los costosLanded.estado='confirmado' + acción
  // explícita del usuario. Al cerrar se aplica CTRU final definitivo a las unidades.
  // Puede tardar semanas tras el operativo (esperando facturas del viajero/courier).
  costosFinalizados?: boolean;
  fechaFinalizacionCostos?: Timestamp;
  finalizadoPor?: string;
  /** Motivo registrado al reabrir los costos (caso raro de auditoría) */
  motivoReaperturaCostos?: string;

  // S38-009: DDP directo — proveedor entrega directo a Perú sin casilla intermedia
  esDDP?: boolean;

  // Notas
  notas?: string;

  // Auditoria
  creadoPor: string;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * S45 (D-3, D-16) — Sub-envío T1 (tanda de despacho del proveedor).
 *
 * Representa una entrega parcial dentro del envío T1 padre. Aplica a los casos
 * A (Proveedor → Casilla), B (DDP directo) y D (Recojo colaborador).
 *
 * Ejemplo real: Amazon despacha una sub-orden de 7 unidades en 3 paquetes
 * (fechas 29-mar / 30-mar / 01-abr). Cada paquete es una SubEnvioT1 con su
 * propio tracking del courier del proveedor y fecha de entrega.
 *
 * Tipo 'reemplazo' (D-16): cuando el proveedor acepta reemplazar una unidad
 * faltante/dañada, se crea una nueva sub-tanda vinculada al reclamo origen. El
 * CTRU de la unidad reemplazada se preserva (reemplazo gratuito por convención).
 */
export interface SubEnvioT1 {
  /** SE-{envioId}-{secuencia}, generado al crear */
  id: string;
  /** Número secuencial dentro del envío padre (1, 2, 3...) */
  secuencia: number;
  /** Tipo de sub-tanda — 'normal' por default, 'reemplazo' si viene de un reclamo */
  tipo: 'normal' | 'reemplazo';
  /** IDs de las unidades que viajan en esta tanda específica (subset del envío padre) */
  unidadesIds: string[];

  // Tracking del courier del proveedor (distinto al tracking global del envío)
  numeroTrackingProveedor?: string;
  /** Fecha en que el proveedor despachó la tanda (si la conocemos) */
  fechaDespachoProveedor?: Timestamp;
  /** Fecha estimada de entrega en destino */
  fechaEstimadaEntrega?: Timestamp;
  /** Fecha real de entrega (cuando la tanda se marcó como entregada) */
  fechaEntrega?: Timestamp;

  /** Ciclo de vida de la tanda — independiente del estado del envío padre */
  estado: EstadoSubEnvio;

  // ─── Solo para tandas de reemplazo (tipo='reemplazo', D-16) ───
  /** Reclamo que originó esta tanda de reemplazo */
  reclamoId?: string;
  /** ID de la sub-tanda original cuya unidad fue reclamada */
  tandaOriginalId?: string;

  // Auditoría
  notas?: string;
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * S45 — Estados del sub-envío T1 (ciclo de vida independiente del envío padre).
 *
 * Transiciones típicas:
 *   pendiente → en_transito → entregado
 *   pendiente → en_transito → entregado_parcial  (llegó incompleto, genera incidencia)
 *   pendiente → cancelada                        (antes de despachar)
 */
export type EstadoSubEnvio =
  | 'pendiente'          // Planificada, aún no sale
  | 'en_transito'        // El proveedor la despachó (con tracking)
  | 'entregado'          // Llegó completa a la casilla destino
  | 'entregado_parcial'  // Llegó incompleta — algunas unidades faltantes/dañadas
  | 'cancelada';         // Se canceló antes de entregar

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

  // S38-009: DDP directo — proveedor despacha directo a destino sin casilla intermedia
  esDDP?: boolean;
}

/**
 * S44 — Payload para crear un envío T2 (Casilla Internacional → Almacén Perú)
 * desde el Wizard T2. Consumido por `envioCrudService.crearEnvioT2()`.
 *
 * Es distinto a `EnvioFormData` porque encapsula la vista del wizard (unidades
 * seleccionadas con metadata derivada + costos ya resueltos por preset de tarifa
 * + contexto de transporte) y delega en el servicio la conversión al formato
 * interno y la aplicación de costos landed.
 */
export interface CrearEnvioT2Payload {
  /** ID de la casilla internacional origen */
  casillaOrigenId: string;
  /** ID del almacén destino en Perú */
  almacenDestinoId: string;
  /** Tipo de transporte elegido (afecta metadata, no cálculos) */
  tipoTransporte: 'viajero' | 'courier';
  /** ID del colaborador transportador (viajero/courier) */
  colaboradorId: string;
  /** Tracking opcional del viaje/paquete */
  numeroTracking?: string;
  /** Notas internas del envío */
  notas?: string;
  /** Unidades seleccionadas en el Paso 2 (Picking) con metadata desnormalizada */
  unidades: Array<{
    unidadId: string;
    productoId: string;
    sku: string;
    codigoUnidad: string;
    pesoLibras?: number;
  }>;
  /** Costos landed capturados en el Paso 4 (ya resueltos por preset de tarifa) */
  costos: Array<{
    categoriaCostoId: string;        // ej. 'flete-viajero', 'fee-recepcion'
    categoriaCostoNombre: string;
    descripcion?: string;
    montoUSD: number;
    tipoCambio: number;              // para calcular montoPEN = monto * tc
    metodoProrrateo: MetodoProrrateo;
    /** Mapa productoId → monto (solo si metodoProrrateo='variado_por_producto') */
    detalleVariado?: Record<string, number>;
  }>;
}

/**
 * S47 — Payload para crear un envío Caso J (Casilla Internacional → Casilla Internacional)
 * desde el Wizard J. Consumido por `envioCrudService.crearEnvioJ()`.
 *
 * Dos variantes (D-8):
 *   - J1: mismo colaborador, dos casillas suyas (sin destinatario externo)
 *   - J2: colaboradores distintos (un remitente, un destinatario)
 *
 * Decisión D-9: intra-país preferente. Si origenPais !== destinoPais, el usuario
 * recibe un warning visible (no bloqueante) y el campo `advertenciaCambioPais`
 * queda en true para auditoría.
 */
export interface CrearEnvioJPayload {
  /** ID de la casilla internacional origen */
  casillaOrigenId: string;
  /** ID de la casilla internacional destino (NO es almacén Perú) */
  casillaDestinoId: string;
  /** Variante del Caso J */
  variante: 'J1' | 'J2';
  /** ID del colaborador transportador (puede ser el mismo del origen en J1) */
  colaboradorTransporteId: string;
  /** Tracking opcional del envío */
  numeroTracking?: string;
  /** Notas internas */
  notas?: string;
  /**
   * D-9: flag auditable cuando el destino está en un país distinto al origen.
   * Se setea automáticamente en el wizard cuando origenPais !== destinoPais.
   */
  advertenciaCambioPais?: boolean;
  /** Unidades seleccionadas en el Paso 1 con metadata desnormalizada */
  unidades: Array<{
    unidadId: string;
    productoId: string;
    sku: string;
    codigoUnidad: string;
    pesoLibras?: number;
  }>;
  /** Costos landed capturados en el Paso 4 (ya resueltos por preset de tarifa) */
  costos: Array<{
    categoriaCostoId: string;
    categoriaCostoNombre: string;
    descripcion?: string;
    montoUSD: number;
    tipoCambio: number;
    metodoProrrateo: MetodoProrrateo;
    detalleVariado?: Record<string, number>;
  }>;
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
    perdida?: boolean;
    incidencia?: string;
    fechaVencimiento?: string;
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
