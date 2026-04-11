import { Timestamp } from 'firebase/firestore';

/**
 * Estados posibles de una unidad (flujo lineal + excepciones)
 *
 * Flujo normal:
 *   pedida → en_transito → disponible → reservada → asignada_venta → vendida
 *
 * Excepciones (pueden ocurrir en cualquier punto):
 *   danada, perdida, retenida_aduana
 */
export type EstadoUnidad =
  // Flujo normal (Acuerdo 7)
  | 'pedida'              // Nace al confirmar OC
  | 'en_transito'         // En movimiento (cualquier envio)
  | 'disponible'          // Disponible para venta en casilla destino
  | 'reservada'           // Reservada para un cliente (intencion o adelanto)
  | 'asignada_venta'      // Asignada a una venta especifica
  | 'vendida'             // Vendida y entregada
  // Excepciones (Acuerdo 7)
  | 'danada'              // Producto danado fisicamente
  | 'perdida'             // Producto extraviado o decomisado
  | 'retenida_aduana'     // Retenido en aduana (puede liberarse o decomisarse)
  // Legacy (backward compat — eliminados en reingenieria, solo para docs pre-existentes)
  | 'recibida_origen'
  | 'recibida_usa'
  | 'en_transito_origen'
  | 'en_transito_usa'
  | 'en_transito_peru'
  | 'disponible_peru'
  | 'asignada_pedido'
  | 'vencida'
  | 'en_reclamo'
  | 'baja'
  | 'donada';

/**
 * Disposición para unidades vencidas
 */
export type DisposicionVencida = 'baja_definitiva' | 'donacion';

/**
 * Estados activos para calculo de CTRU y stock
 * Solo unidades que representan inventario disponible o comprometido
 */
export const ESTADOS_ACTIVOS: EstadoUnidad[] = [
  'disponible',
  'reservada',
  'asignada_venta',
];

/**
 * Estados que representan unidades en el pipeline (pedidas + transito + activas)
 */
export const ESTADOS_PIPELINE: EstadoUnidad[] = [
  'pedida',
  'en_transito',
  'disponible',
  'reservada',
  'asignada_venta',
];

/**
 * @deprecated Legacy — usar ESTADOS_ACTIVOS en su lugar
 */
export const ESTADOS_EN_ORIGEN: EstadoUnidad[] = ['recibida_origen', 'recibida_usa'];
export const ESTADOS_EN_TRANSITO_ORIGEN: EstadoUnidad[] = ['en_transito_origen', 'en_transito_usa'];

/**
 * Tipo de movimiento de una unidad
 */
export type TipoMovimiento =
  | 'recepcion'        // Llegó al almacén
  | 'transferencia'    // Se movió entre almacenes
  | 'reserva'          // Se reservó para venta
  | 'venta'            // Se vendió
  | 'ajuste'           // Ajuste de inventario
  | 'vencimiento'      // Se marcó como vencido
  | 'daño'             // Se marcó como dañado
  | 'devolucion';      // Devuelta por el cliente

/**
 * Registro de movimiento de una unidad (para timeline)
 */
export interface MovimientoUnidad {
  id: string;
  tipo: TipoMovimiento;
  fecha: Timestamp;
  almacenOrigen?: string;      // ID del almacén de origen
  almacenDestino?: string;      // ID del almacén de destino
  usuarioId: string;
  observaciones?: string;
  documentoRelacionado?: {      // OC, Venta, etc.
    tipo: 'orden-compra' | 'venta' | 'transferencia';
    id: string;
    numero: string;
  };
}

/**
 * Unidad individual de producto
 * Representa cada producto físico con trazabilidad completa
 */
export interface Unidad {
  id: string;

  // Relación con producto
  productoId: string;
  productoSKU: string;           // Desnormalizado para queries rápidas
  productoNombre: string;        // Desnormalizado para display

  // Información de lote y vencimiento
  lote: string;
  fechaVencimiento: Timestamp;
  diasParaVencer?: number;       // Calculado: días hasta vencimiento

  // Ubicacion actual
  casillaActualId: string;       // Casilla donde esta la unidad actualmente
  casillaNombre?: string;        // Desnormalizado
  /** @deprecated Usar casillaActualId */ almacenId?: string;
  /** @deprecated Usar casillaNombre */ almacenNombre?: string;
  pais: string;                  // Desnormalizado (PaisCasilla)
  paisOrigen?: string;           // Pais donde se compro originalmente

  // Línea de negocio (desnormalizado del producto)
  lineaNegocioId?: string;
  lineaNegocioNombre?: string;

  // Estado y costos
  estado: EstadoUnidad;
  estadoLegacy?: string;         // Preserva el estado original pre-migración
  costoUnitarioUSD: number;      // Costo de compra en USD
  costoFleteUSD?: number;        // Costo de flete internacional prorrateado (legacy: USA→Perú)
  costoUnitarioPEN?: number;     // Si se vendió en Perú, el costo convertido

  // Tipo de cambio aplicado
  tcCompra?: number;             // TC al momento de registrar la OC
  tcPago?: number;               // TC al momento del pago (más relevante)

  // CTRU (Costo Total Real por Unidad) — Modelo 4 capas
  ctruInicial?: number;          // C1+C2: costoAdquisición*TC + flete prorrateado (inmutable post-recepción)
  ctruDinamico?: number;         // CTRU legacy = ctruContable (backward compat)
  ctruContable?: number;         // C1+C2+C3 + GA/GO solo entre vendidas (para P&L)
  ctruGerencial?: number;        // C1+C2+C3 + GA/GO entre todas las unidades (para cotizar)

  // C3 — Costo de recojo en Perú (prorrateado por recepción parcial de transferencia)
  costoRecojoPEN?: number;       // En soles — monto variable por recepción
  transferenciaRecojoId?: string; // ID de la transferencia/recepción que generó el C3

  // Costos landed prorrateados (del Envio)
  costosLandedPEN?: number;      // Suma de costos landed prorrateados a esta unidad

  // @deprecated — eliminados en reingenieria (Acuerdo 3: GA/GO no tocan CTRU)
  costoGAAsignado?: number;
  costoGOAsignado?: number;

  // Trazabilidad
  ordenCompraId: string;         // OC que generó esta unidad
  ordenCompraNumero: string;     // Desnormalizado
  fechaRecepcion: Timestamp;     // Cuándo llegó físicamente

  // Si está vendida
  ventaId?: string;
  ventaNumero?: string;
  fechaVenta?: Timestamp;
  precioVentaPEN?: number;

  // ========== Reserva de Stock (Pre-Venta) ==========
  reservadaPara?: string;            // ID de la venta que reservó esta unidad
  fechaReserva?: Timestamp;          // Cuándo se reservó
  reservaVigenciaHasta?: Timestamp;  // Hasta cuándo está reservada

  // ========== Transferencia en curso ==========
  estadoAntesDeTransferencia?: string;  // Estado previo al envío (para rollback en faltante)

  // Historial de movimientos
  movimientos: MovimientoUnidad[];

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Datos para crear una unidad
 */
export interface UnidadFormData {
  productoId: string;
  lote: string;
  fechaVencimiento: Date;
  almacenId: string;
  costoUnitarioUSD: number;
  ordenCompraId: string;
  ordenCompraNumero: string;
  fechaRecepcion: Date;
}

/**
 * Filtros para búsqueda de unidades
 */
export interface UnidadFiltros {
  productoId?: string;
  productoSKU?: string;
  almacenId?: string;
  pais?: string;                   // PaisAlmacen genérico
  lineaNegocioId?: string;
  estado?: EstadoUnidad;
  lote?: string;
  fechaVencimientoDesde?: Date;
  fechaVencimientoHasta?: Date;
  ordenCompraId?: string;
  ventaId?: string;
  diasParaVencerMenorQue?: number;  // Para alertas de vencimiento
}

/**
 * Resultado de selección FEFO
 * Devuelve unidades ordenadas por fecha de vencimiento (primero las que vencen antes)
 */
export interface UnidadFEFO {
  unidad: Unidad;
  orden: number;  // Orden de selección (1 = vence primero)
}

/**
 * Estadísticas de unidades
 */
export interface UnidadStats {
  totalUnidades: number;
  disponibles: number;
  reservadas: number;
  vendidas: number;
  enTransito: number;
  porVencer: number;       // Próximos 30 días
  vencidas: number;
  valorTotalUSD: number;   // Valor total del inventario disponible
}

/**
 * Datos para crear múltiples unidades (al recibir OC)
 */
export interface CrearUnidadesLoteData {
  productoId: string;
  cantidad: number;
  lote: string;
  fechaVencimiento: Date;
  almacenId: string;
  costoUnitarioUSD: number;
  ordenCompraId: string;
  ordenCompraNumero: string;
  fechaRecepcion: Date;

  // Tipo de cambio de la OC (para trazabilidad financiera)
  tcCompra?: number;            // TC al momento de crear la OC
  tcPago?: number;              // TC al momento del pago de la OC

  // ========== RESERVA AUTOMÁTICA (desde requerimiento de cliente) ==========
  // Si la OC viene de un requerimiento vinculado a una cotización,
  // las unidades se crean ya reservadas para ese cliente
  estadoInicial?: EstadoUnidad;  // Por defecto se calcula según país
  reservadoPara?: string;        // ID de cotización/venta a reservar (se mapea a reservadaPara en Firestore)
  requerimientoId?: string;      // ID del requerimiento de origen
}
