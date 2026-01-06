import type { Timestamp } from 'firebase/firestore';
import type { BaseEntity } from './common.types';

/**
 * Tipo de transportista
 */
export type TipoTransportista = 'interno' | 'externo';

/**
 * Couriers externos soportados
 */
export type CourierExterno =
  | 'olva'
  | 'mercado_envios'
  | 'urbano'
  | 'shalom'
  | 'otro';

/**
 * Estado del transportista
 */
export type EstadoTransportista = 'activo' | 'inactivo';

/**
 * Transportista - Repartidor interno o courier externo
 */
export interface Transportista extends BaseEntity {
  // Identificación
  codigo: string;                    // TR-001
  nombre: string;                    // Nombre completo o razón social
  tipo: TipoTransportista;

  // Para externos
  courierExterno?: CourierExterno;   // Si es externo, cuál courier

  // Contacto
  telefono?: string;
  email?: string;

  // Comisiones y costos
  comisionPorcentaje?: number;       // Comisión % sobre el valor
  costoFijo?: number;                // Costo fijo por entrega (PEN)
  costoPromedioPorEntrega?: number;  // Calculado automáticamente

  // Documentos (para internos)
  dni?: string;
  licencia?: string;

  // Estado
  estado: EstadoTransportista;

  // Métricas (calculadas)
  totalEntregas?: number;
  entregasExitosas?: number;
  entregasFallidas?: number;
  tasaExito?: number;                // entregasExitosas / totalEntregas * 100
  tiempoPromedioEntrega?: number;    // En horas
  calificacionPromedio?: number;     // 1-5
  costoTotalHistorico?: number;      // Suma de todos los GD generados

  // Zonas frecuentes (calculado por historial)
  zonasAtendidas?: string[];

  // Auditoría adicional
  fechaUltimaEntrega?: Timestamp;
  observaciones?: string;
}

/**
 * Datos para crear/editar un transportista
 */
export interface TransportistaFormData {
  codigo?: string;
  nombre: string;
  tipo: TipoTransportista;
  courierExterno?: CourierExterno;
  telefono?: string;
  email?: string;
  comisionPorcentaje?: number;
  costoFijo?: number;
  dni?: string;
  licencia?: string;
  observaciones?: string;
}

/**
 * Estadísticas de un transportista
 */
export interface TransportistaStats {
  transportistaId: string;
  periodo: {
    inicio: Timestamp;
    fin: Timestamp;
  };
  totalEntregas: number;
  entregasExitosas: number;
  entregasFallidas: number;
  entregasPendientes: number;
  tasaExito: number;
  tiempoPromedioHoras: number;
  costoTotal: number;
  ingresoGenerado: number;           // Suma de ventas entregadas

  // Por zona
  entregasPorZona: Array<{
    zona: string;
    cantidad: number;
    exitosas: number;
  }>;

  // Por día de la semana
  entregasPorDia: Array<{
    dia: string;
    cantidad: number;
  }>;
}

/**
 * Filtros para búsqueda de transportistas
 */
export interface TransportistaFilters {
  tipo?: TipoTransportista;
  courierExterno?: CourierExterno;
  estado?: EstadoTransportista;
  search?: string;
}

// ============================================
// MOVIMIENTOS CONTABLES DE TRANSPORTISTA
// ============================================

/**
 * Tipo de movimiento contable del transportista
 */
export type TipoMovimientoTransportista =
  | 'entrega_exitosa'      // Se completó una entrega - genera deuda a favor del transportista
  | 'entrega_fallida'      // Entrega fallida - solo registro, sin costo
  | 'cobro_recaudado'      // Dinero recaudado por contraentrega - genera deuda del transportista
  | 'pago_transportista'   // Pago al transportista - reduce deuda
  | 'ajuste';              // Ajuste manual

/**
 * Movimiento contable de un transportista
 * Registra cada operación para historial y contabilidad
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
