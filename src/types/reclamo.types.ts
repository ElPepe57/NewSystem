import { Timestamp } from 'firebase/firestore';

/**
 * Tipo de reclamo — qué situación operativa originó el reclamo.
 */
export type TipoReclamo =
  | 'danada'          // Unidad llegó dañada, se reclama al responsable
  | 'perdida'         // Unidad se perdió en tránsito
  | 'aduana_timeout'  // Retenida en aduana más de lo aceptable, se abandona
  | 'otro';

/**
 * Destinatario del reclamo — a quién se le exige el resarcimiento.
 */
export type DestinatarioReclamo =
  | 'proveedor'       // Producto defectuoso/mal embalado
  | 'courier'         // Manipulación deficiente en tránsito
  | 'seguro'          // Cobertura de seguro contratado
  | 'otro';

/**
 * Ciclo de vida del reclamo.
 *
 * borrador → enviado → [en_disputa] → (aceptado → cobrado) | rechazado | cerrado_sin_cobrar
 *
 *  - borrador: creado pero aún no notificado al destinatario
 *  - enviado: reclamo formal comunicado al destinatario
 *  - en_disputa: el destinatario cuestiona monto/causa
 *  - aceptado: destinatario acepta pagar un monto acordado
 *  - cobrado: el monto entró a tesorería (ingreso registrado)
 *  - rechazado: destinatario rechaza — se castiga contablemente como merma
 *  - cerrado_sin_cobrar: timeout sin respuesta — también castigo contable
 */
export type EstadoReclamo =
  | 'borrador'
  | 'enviado'
  | 'en_disputa'
  | 'aceptado'
  | 'rechazado'
  | 'cobrado'
  | 'cerrado_sin_cobrar';

/**
 * S54.x (D-REC-4) — Tipo de evento del historial procedural del reclamo.
 *
 * Cada transición del ciclo (crear, enviar, marcar disputa, aceptar, cobrar,
 * rechazar, cerrar, resolver con reemplazo) deja un evento en el array
 * `historial` del reclamo. Permite renderizar un timeline visual completo
 * de la negociación y auditar quién hizo qué cuándo.
 */
export type TipoEventoReclamo =
  | 'creado'
  | 'editado'
  | 'enviado'
  | 'marcado_en_disputa'
  | 'aceptado'
  | 'resuelto_con_reemplazo'
  | 'reemplazo_recibido'
  | 'cobrado'
  | 'rechazado'
  | 'cerrado_sin_cobrar';

export interface ReclamoEvento {
  id: string;                          // uuid corto del evento
  tipo: TipoEventoReclamo;
  fecha: Timestamp;
  usuarioId: string;
  /** Texto descriptivo del evento (qué pasó en lenguaje natural). */
  descripcion: string;
  /** Datos adicionales del evento — montos, motivos, IDs relacionados. */
  meta?: {
    montoPEN?: number;
    montoUSD?: number;
    motivo?: string;
    nuevoEstado?: EstadoReclamo;
    estadoAnterior?: EstadoReclamo;
    cuentaId?: string;
    movimientoTesoreriaId?: string;
    gastoId?: string;
    subEnvioReemplazoId?: string;
  };
}

/**
 * Reclamo presentado a un destinatario para recuperar el valor de unidades
 * dañadas, perdidas o abandonadas en aduana.
 */
export interface Reclamo {
  id: string;
  numeroReclamo: string;              // REC-2026-001

  // Contexto
  envioId: string;
  envioNumero: string;                // Desnormalizado
  ordenCompraId?: string;
  ordenCompraNumero?: string;         // Desnormalizado

  tipo: TipoReclamo;
  destinatario: DestinatarioReclamo;
  destinatarioId?: string;            // colaboradorId si es courier
  destinatarioNombre: string;         // Desnormalizado

  // Unidades afectadas
  unidadesIds: string[];
  cantidadUnidades: number;

  // Monto
  montoReclamadoPEN: number;
  montoReclamadoUSD?: number;
  tipoCambio?: number;

  // Acuerdo / resolución
  montoAcordadoPEN?: number;          // Si destinatario acepta monto distinto
  montoCobradoPEN?: number;           // Monto efectivamente cobrado
  cuentaCobroId?: string;             // Cuenta de tesorería donde entró
  movimientoTesoreriaId?: string;     // Movimiento generado al cobrar
  gastoId?: string;                   // Gasto generado al rechazar/cerrar

  // Evidencia
  evidenciaURLs?: string[];           // URLs de fotos/docs
  notas?: string;

  // Estado y workflow
  estado: EstadoReclamo;
  motivoRechazo?: string;             // Si rechazado
  motivoDisputa?: string;             // Si en_disputa

  // S45 (D-16) — Tipo de resolución del reclamo con el destinatario.
  // El reclamo pasa a 'aceptado' cuando el destinatario acepta una resolución.
  // El tipo determina qué efecto operativo/contable dispara:
  //   - 'reembolso':  destinatario paga dinero (flujo actual: → cobrado → ingreso_otro)
  //   - 'reemplazo':  destinatario envía unidad física como sub-tanda (NUEVO S45)
  //   - 'merma':      destinatario no asume (flujo actual: → rechazado/cerrado_sin_cobrar → gasto_merma)
  tipoResolucion?: TipoResolucionReclamo;
  /** Si tipoResolucion='reemplazo': ID de la sub-tanda generada en el envío padre */
  subEnvioReemplazoId?: string;
  /** Fecha en que se definió el tipo de resolución (cuando el destinatario respondió) */
  fechaResolucion?: Timestamp;

  // Fechas
  fechaCreacion: Timestamp;
  fechaEnvio?: Timestamp;
  fechaRespuesta?: Timestamp;
  fechaCobro?: Timestamp;
  fechaCierre?: Timestamp;

  // Auditoría
  creadoPor: string;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
  cerradoPor?: string;

  // S54.x (D-REC-4) — Timeline procedural del reclamo. Cada transición de
  // estado o resolución agrega un evento. Render visual en ReclamoTimeline.
  historial?: ReclamoEvento[];

  // Línea de negocio (desnormalizado desde envío)
  lineaNegocioId?: string;
}

/**
 * S45 (D-16) — Tipo de resolución del reclamo al destinatario (proveedor,
 * courier, seguro, etc.).
 *
 *   'reembolso' → destinatario paga el valor reclamado en dinero.
 *                 Efecto: tesorería ingreso_otro + unidad queda perdida_total.
 *                 CTRU de unidad NO cambia (ya estaba calculado con costo original).
 *
 *   'reemplazo' → destinatario envía físicamente una nueva unidad como
 *                 sub-tanda dentro del mismo envío T1.
 *                 Efecto: nueva SubEnvioT1 tipo='reemplazo' vinculada al reclamo.
 *                 CTRU de la unidad se preserva (reemplazo gratuito por convención).
 *                 Sin asiento contable automático.
 *                 Si el reemplazo también falla, se puede reabrir el reclamo y
 *                 convertirlo a 'merma'.
 *
 *   'merma'     → destinatario rechaza o no responde.
 *                 Efecto: gasto_merma_transferencia + unidad queda perdida_total.
 *                 Afecta ranking de integridad del destinatario (visible en reportes).
 */
export type TipoResolucionReclamo = 'reembolso' | 'reemplazo' | 'merma';

/**
 * Datos para crear un reclamo (borrador) desde UI.
 */
export interface ReclamoFormData {
  envioId: string;
  envioNumero: string;
  ordenCompraId?: string;
  ordenCompraNumero?: string;

  tipo: TipoReclamo;
  destinatario: DestinatarioReclamo;
  destinatarioId?: string;
  destinatarioNombre: string;

  unidadesIds: string[];

  montoReclamadoPEN: number;
  montoReclamadoUSD?: number;
  tipoCambio?: number;

  evidenciaURLs?: string[];
  notas?: string;

  lineaNegocioId?: string;
}

/**
 * Filtros para búsqueda de reclamos.
 */
export interface ReclamoFiltros {
  estado?: EstadoReclamo;
  estados?: EstadoReclamo[];
  tipo?: TipoReclamo;
  destinatario?: DestinatarioReclamo;
  /**
   * BUG-INC-004 fix (S54.x) — Filtro por entidad destinataria (proveedorId,
   * colaboradorId, etc.). Permite listar reclamos abiertos contra X proveedor
   * o X courier desde su ficha de Maestros.
   */
  destinatarioId?: string;
  envioId?: string;
  ordenCompraId?: string;
  lineaNegocioId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
}

/**
 * Resumen de reclamos para KPIs.
 */
export interface ResumenReclamos {
  totalReclamos: number;
  totalReclamadoPEN: number;
  totalCobradoPEN: number;
  totalPerdidoPEN: number;             // rechazados + cerrados sin cobrar
  reclamosPendientes: number;          // enviado | en_disputa | aceptado (no cobrado)
  reclamosCobrados: number;
  reclamosRechazados: number;
  tasaRecuperacion: number;            // % cobrado sobre total reclamado (0-100)
}

/**
 * Estados "activos" del reclamo (pendientes de resolución final)
 */
export const ESTADOS_RECLAMO_ACTIVOS: EstadoReclamo[] = [
  'borrador',
  'enviado',
  'en_disputa',
  'aceptado',
];

/**
 * Estados "resueltos" (finalizados)
 */
export const ESTADOS_RECLAMO_RESUELTOS: EstadoReclamo[] = [
  'cobrado',
  'rechazado',
  'cerrado_sin_cobrar',
];
