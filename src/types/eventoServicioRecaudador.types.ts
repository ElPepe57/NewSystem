/**
 * eventoServicioRecaudador.types.ts — chk5.D-S1f · F2
 *
 * Modelo de eventos que componen el balance de una Caja Recaudadora
 * (ProductoFinanciero con tipoProducto='caja_recaudadora'). Cada evento
 * es UN cobro entrante (el rider cobró al cliente final) o UN servicio
 * descontado (el recaudador descuenta su tarifa). La liquidación
 * periódica consolida ambos y transfiere el saldo neto al banco destino.
 *
 * Modelo conceptual (D5 + D12 · chk5.D-S1e):
 *   Balance recaudadora = SUM(cobros) − SUM(servicios) − SUM(liquidaciones previas)
 *
 * Decisiones aplicadas:
 *   - D5: 6to tipo `caja_recaudadora` con responsable tercero + tarifa servicio
 *   - D12: multi-canal con balance consolidado (1 entidad · N canales)
 *
 * Coexiste con `productoFinanciero.types.ts` (entidad madre) y se consume
 * desde `cajaRecaudadora.service.ts` + `liquidarCajaRecaudadora.service.ts` (F3).
 *
 * Ver DEUDA-MODELO-RECAUDADOR (refinada) en docs/mockups/SUPERSEDED-v5.md.
 */

import { Timestamp } from 'firebase/firestore';
import type {
  MonedaPF,
  TarifaServicio,
  TipoCanalRecaudacion,
} from './productoFinanciero.types';

// ═════════════════════════════════════════════════════════════════════════
// TIPO DE EVENTO (discriminator)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Discriminator que distingue los 2 tipos de eventos que afectan el balance
 * de una Caja Recaudadora:
 *   - cobro_entrante: el rider/recaudador cobró al cliente final (entra a la caja)
 *   - servicio_descontado: tarifa que el recaudador cobra por su servicio (sale)
 */
export type TipoEventoRecaudador = 'cobro_entrante' | 'servicio_descontado';

export const TIPO_EVENTO_RECAUDADOR_LABEL: Record<TipoEventoRecaudador, string> = {
  cobro_entrante:       'Cobro entrante',
  servicio_descontado:  'Servicio descontado',
};

// ═════════════════════════════════════════════════════════════════════════
// VINCULACIÓN DEL EVENTO A OTROS MÓDULOS
// ═════════════════════════════════════════════════════════════════════════

/**
 * Origen del evento · qué módulo del ERP lo generó.
 *   - envio: cobro del rider al cliente final por envío entregado
 *   - venta: cobro asociado a una venta específica del cliente
 *   - manual: registro manual sin documento vinculado (ej. reconciliación)
 */
export type TipoVinculacionEvento = 'envio' | 'venta' | 'manual';

export const TIPO_VINCULACION_LABEL: Record<TipoVinculacionEvento, string> = {
  envio:  'Envío',
  venta:  'Venta',
  manual: 'Manual (sin doc vinculado)',
};

// ═════════════════════════════════════════════════════════════════════════
// ESTADO DEL EVENTO (vs liquidación periódica)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Estado del evento respecto a la liquidación al banco destino.
 *   - pendiente: evento registrado · aún no incluido en liquidación
 *   - liquidado: evento incluido en una liquidación · cerrado
 *   - cancelado: evento anulado (ej. devolución · error registro)
 */
export type EstadoEventoRecaudador = 'pendiente' | 'liquidado' | 'cancelado';

export const ESTADO_EVENTO_LABEL: Record<EstadoEventoRecaudador, string> = {
  pendiente:  'Pendiente liquidar',
  liquidado:  'Liquidado',
  cancelado:  'Cancelado',
};

// ═════════════════════════════════════════════════════════════════════════
// EVENTO SERVICIO RECAUDADOR (entidad principal)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Cada movimiento atómico que afecta el balance de una Caja Recaudadora.
 * Persistido en colección `eventosServicioRecaudador` en Firestore.
 *
 * Diseño discriminator-based: campos específicos por tipo son opcionales
 * y se completan según `tipo`.
 */
export interface EventoServicioRecaudador {
  id: string;
  codigo: string;                          // ESR-2026-0001 (autogenerado)
  recaudadoraId: string;                   // FK a ProductoFinanciero (tipoProducto='caja_recaudadora')
  recaudadoraNombre: string;               // Denormalizado para queries rápidas

  // ─── Discriminator + fecha + montos ────────────────────────────────
  tipo: TipoEventoRecaudador;
  fecha: Timestamp;
  moneda: MonedaPF;
  monto: number;                           // Siempre positivo · el signo lo da `tipo`

  // ─── Solo si tipo='cobro_entrante' ─────────────────────────────────
  /** Canal por el cual cobró el rider al cliente final */
  canalCobro?: TipoCanalRecaudacion;
  /** Origen del cobro · qué módulo lo generó */
  vinculacionTipo?: TipoVinculacionEvento;
  /** ID del doc origen (envio, venta) · null si manual */
  vinculacionId?: string;
  /** Referencia legible del doc (ej. ENV-2026-127 · V-2026-512) */
  vinculacionRefDoc?: string;
  /** Nombre cliente final que pagó (denormalizado) */
  clienteFinalNombre?: string;

  // ─── Solo si tipo='servicio_descontado' ────────────────────────────
  /**
   * Snapshot de la tarifa al momento del descuento. Preservar permite que
   * cambios de tarifa futuros NO afecten eventos viejos (auditoría limpia).
   */
  tarifaSnapshot?: TarifaServicio;
  /** Cantidad de eventos cobrados (ej. 5 carreras · 3 envíos) */
  unidadesDeServicio?: number;
  /** Detalle textual del servicio (ej. "carreras del día") */
  descripcionServicio?: string;

  // ─── Estado liquidación ────────────────────────────────────────────
  estado: EstadoEventoRecaudador;
  /** FK a LiquidacionRecaudadora cuando estado='liquidado' */
  liquidacionId?: string;
  /** Código liquidación (ej. LIQ-2026-0001) · denormalizado */
  liquidacionCodigo?: string;
  /** Fecha en que se liquidó (cuando estado pasó a 'liquidado') */
  fechaLiquidacion?: Timestamp;

  // ─── Si fue cancelado ──────────────────────────────────────────────
  motivoCancelacion?: string;
  canceladoPor?: string;
  fechaCancelacion?: Timestamp;

  // ─── Auditoría ──────────────────────────────────────────────────────
  registradoPor: string;
  fechaRegistro: Timestamp;
  notas?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// INPUTS PARA CREACIÓN (services F3)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Input para registrar un cobro entrante (rider cobró al cliente final).
 * El service `cajaRecaudadora.service.ts::registrarCobroEntrante()` valida:
 *   - recaudadora existe + activa
 *   - canalCobro está en recaudadora.canalesAceptados y activo
 *   - moneda match con recaudadora
 *   - vinculacionId existe si vinculacionTipo != 'manual'
 */
export interface CrearCobroEntranteInput {
  recaudadoraId: string;
  fecha: Date;
  monto: number;
  moneda: MonedaPF;

  canalCobro: TipoCanalRecaudacion;
  vinculacionTipo: TipoVinculacionEvento;
  vinculacionId?: string;
  vinculacionRefDoc?: string;
  clienteFinalNombre?: string;
  notas?: string;

  /** Idempotencia para evitar doble registro */
  idempotencyKey?: string;
}

/**
 * Input para registrar un servicio descontado (recaudador cobró su tarifa).
 * Tipicamente se genera AUTO al cerrar el periodo de liquidación a partir
 * del conteo de eventos. Pero también puede registrarse manualmente
 * (ej. ajuste · servicios fuera de catálogo).
 */
export interface CrearServicioDescontadoInput {
  recaudadoraId: string;
  fecha: Date;
  monto: number;
  moneda: MonedaPF;

  tarifaSnapshot: TarifaServicio;
  unidadesDeServicio: number;
  descripcionServicio: string;
  notas?: string;

  idempotencyKey?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// LIQUIDACIÓN RECAUDADORA (transacción periódica al banco destino)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Documento de liquidación periódica · consolida cobros − servicios del
 * periodo y registra la transferencia efectiva al banco destino.
 *
 * Persistido en colección `liquidacionesRecaudadora` en Firestore.
 *
 * Generado por `liquidarCajaRecaudadora.service.ts::liquidarSaldo()`
 * (transacción atómica · F3).
 */
export interface LiquidacionRecaudadora {
  id: string;
  codigo: string;                          // LIQ-2026-0001 (autogenerado)
  recaudadoraId: string;                   // FK ProductoFinanciero
  recaudadoraNombre: string;               // Denormalizado

  // ─── Periodo liquidado ─────────────────────────────────────────────
  fechaInicio: Timestamp;
  fechaFin: Timestamp;
  fechaLiquidacion: Timestamp;             // Fecha en que se ejecutó

  // ─── Totales del periodo (calculados desde eventos) ────────────────
  totalCobrosRecibidos: number;
  totalServiciosDescontados: number;
  totalLiquidacionesPreviasEnPeriodo: number;
  /** = totalCobros − totalServicios − totalLiquidacionesPrevias */
  saldoLiquidado: number;

  // ─── Detalle por canal (breakdown D12) ─────────────────────────────
  /**
   * Discriminación por canal de los cobros del periodo. Útil para
   * reportes + auditoría + identificar canales más usados.
   * Key: TipoCanalRecaudacion · Value: { monto acumulado, count eventos }
   */
  cobrosPorCanal: Partial<Record<TipoCanalRecaudacion, { monto: number; eventos: number }>>;

  // ─── Cuenta destino + transferencia ────────────────────────────────
  cuentaDestinoId: string;                 // FK ProductoFinanciero del banco
  cuentaDestinoNombre: string;             // Denormalizado
  moneda: MonedaPF;

  // ─── FKs a documentos generados ────────────────────────────────────
  /** Eventos incluidos en esta liquidación · marcados como 'liquidado' */
  eventoIds: string[];
  /** Movimiento tesorería generado (egreso recaudadora → ingreso cuenta destino) */
  movimientoTesoreriaId?: string;
  /** Movimiento CC con proveedor recaudador (reconoce servicios cobrados) */
  movimientoCCProveedorId?: string;
  /** Asiento contable generado */
  asientoContableId?: string;

  // ─── Auditoría ──────────────────────────────────────────────────────
  liquidadoPor: string;
  fechaCreacion: Timestamp;
  notas?: string;

  // ─── Estado final (para anular si hace falta) ──────────────────────
  estado: 'confirmada' | 'anulada';
  motivoAnulacion?: string;
  anuladaPor?: string;
  fechaAnulacion?: Timestamp;
}

/**
 * Input para ejecutar una liquidación · transacción atómica TX-2
 * (similar al patrón de PagoEstadoCuentaTarjeta).
 */
export interface LiquidarSaldoRecaudadoraInput {
  recaudadoraId: string;
  fechaInicio: Date;
  fechaFin: Date;
  fechaLiquidacion: Date;

  cuentaDestinoId: string;
  /** Monto a liquidar · debe coincidir con balance calculado (validación) */
  saldoLiquidado: number;

  notas?: string;
  idempotencyKey?: string;
}

export interface LiquidarSaldoRecaudadoraResult {
  liquidacionId: string;
  codigo: string;
  movimientoTesoreriaId: string;
  movimientoCCProveedorId: string;
  asientoContableId: string;
  eventosLiquidadosCount: number;
  saldoLiquidado: number;
  errores: string[];
}

// ═════════════════════════════════════════════════════════════════════════
// BALANCE CONSOLIDADO (output de calcularBalanceMes en F3)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Resultado del cálculo de balance de una Caja Recaudadora en un periodo.
 * Incluye breakdown por canal (D12) y por tipo de evento.
 */
export interface BalanceRecaudadora {
  recaudadoraId: string;
  fechaInicio: Date;
  fechaFin: Date;

  // ─── Totales consolidados ──────────────────────────────────────────
  cobrosRecibidos: number;
  serviciosDescontados: number;
  liquidacionesYa: number;
  pendienteLiquidar: number;               // = cobros − servicios − liquidacionesYa

  // ─── Breakdown por canal (D12) ─────────────────────────────────────
  porCanal: Partial<Record<TipoCanalRecaudacion, { monto: number; eventos: number }>>;

  // ─── Counts ────────────────────────────────────────────────────────
  cobrosCount: number;
  serviciosCount: number;
  liquidacionesCount: number;
  eventosPendientesCount: number;

  // ─── Para alertas ──────────────────────────────────────────────────
  ultimaLiquidacionFecha?: Date;
  diasDesdeUltimaLiquidacion?: number;
}
