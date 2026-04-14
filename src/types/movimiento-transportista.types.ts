import type { Timestamp } from 'firebase/firestore';

// ============================================
// MOVIMIENTOS CONTABLES DE TRANSPORTISTA
// Registros históricos de cuenta corriente.
// Independientes del modelo Colaborador/Transportista.
// ============================================

/**
 * Tipo de movimiento contable del transportista
 */
export type TipoMovimientoTransportista =
  | 'entrega_exitosa'      // Se completó una entrega — genera deuda a favor del transportista
  | 'entrega_fallida'      // Entrega fallida — solo registro, sin costo
  | 'cobro_recaudado'      // Dinero recaudado por contraentrega — genera deuda del transportista
  | 'pago_transportista'   // Pago al transportista — reduce deuda
  | 'ajuste';              // Ajuste manual

/**
 * Movimiento contable de un transportista
 * Registra cada operación para historial y contabilidad.
 * Usa transportistaId como FK al Colaborador (tipo transportista_local).
 */
export interface MovimientoTransportista {
  id: string;

  // Identificación
  transportistaId: string;
  transportistaNombre: string;

  // Tipo de movimiento
  tipo: TipoMovimientoTransportista;

  // Referencias
  entregaId?: string;
  entregaCodigo?: string;
  ventaId?: string;
  ventaNumero?: string;
  gastoId?: string;          // ID del gasto GD generado

  // Montos
  costoEntrega: number;      // Costo del servicio de entrega (lo que se le debe)
  montoRecaudado?: number;   // Si cobró contraentrega (lo que debe devolver)
  comision?: number;         // Si tiene comisión por venta
  montoPago?: number;        // Si es un pago al transportista

  // Saldos (running balance)
  saldoAnterior: number;     // Saldo antes del movimiento
  movimientoNeto: number;    // + si le debemos, - si nos debe
  saldoNuevo: number;        // Saldo después del movimiento

  // Detalles de la entrega
  distrito?: string;

  // Auditoría
  fecha: Timestamp;
  observaciones?: string;
  creadoPor: string;
  fechaCreacion: Timestamp;
}

/**
 * Resumen de cuenta de un transportista
 */
export interface ResumenCuentaTransportista {
  transportistaId: string;
  transportistaNombre: string;

  // Saldo actual
  saldoActual: number;       // + nos debe, - le debemos

  // Totales del período
  totalCostosEntrega: number;
  totalRecaudado: number;
  totalPagado: number;
  totalComisiones: number;

  // Entregas
  entregasExitosas: number;
  entregasFallidas: number;

  // Últimos movimientos
  ultimosMovimientos: MovimientoTransportista[];
}
