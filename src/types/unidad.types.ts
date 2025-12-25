import { Timestamp } from 'firebase/firestore';

/**
 * Estados posibles de una unidad (flujo USA → Perú)
 */
export type EstadoUnidad =
  // Estados en USA
  | 'recibida_usa'        // Recibida en almacén/viajero USA (disponible para transferir)
  | 'en_transito_usa'     // En tránsito entre almacenes USA (transferencia interna)
  // Estados en tránsito a Perú
  | 'en_transito_peru'    // En tránsito USA → Perú (con viajero)
  // Estados en Perú
  | 'disponible_peru'     // Disponible para venta en Perú
  | 'reservada'           // Reservada en una cotización/orden
  | 'vendida'             // Vendida y entregada
  // Estados especiales
  | 'vencida'             // Producto vencido
  | 'danada';             // Producto dañado/inutilizable

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
  | 'daño';            // Se marcó como dañado

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

  // Ubicación actual
  almacenId: string;
  almacenNombre: string;         // Desnormalizado
  pais: 'USA' | 'Peru';          // Desnormalizado

  // Estado y costos
  estado: EstadoUnidad;
  costoUnitarioUSD: number;      // Costo de compra en USD
  costoFleteUSD?: number;        // Costo de flete USA→Perú prorrateado
  costoUnitarioPEN?: number;     // Si se vendió en Perú, el costo convertido

  // Tipo de cambio aplicado
  tcCompra?: number;             // TC al momento de registrar la OC
  tcPago?: number;               // TC al momento del pago (más relevante)

  // CTRU (Costo Total Real por Unidad)
  ctruInicial?: number;          // CTRU base: costoUSD*TC + flete prorrateado
  ctruDinamico?: number;         // CTRU con gastos prorrateables del mes

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
  pais?: 'USA' | 'Peru';
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
  reservadoPara?: string;        // ID de cotización/venta a reservar
  requerimientoId?: string;      // ID del requerimiento de origen
}
