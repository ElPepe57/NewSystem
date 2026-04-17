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

  // Línea de negocio (desnormalizado desde envío)
  lineaNegocioId?: string;
}

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
