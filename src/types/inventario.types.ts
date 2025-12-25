import { Timestamp } from 'firebase/firestore';

/**
 * Inventario agregado por producto y almacén
 * Consolida las unidades individuales en vistas agregadas
 */
export interface InventarioProducto {
  id: string; // productoId-almacenId

  // Identificación
  productoId: string;
  productoSKU: string;
  productoNombre: string;
  productoMarca: string;
  productoGrupo: string;
  productoSubgrupo: string;

  // Ubicación
  almacenId: string;
  almacenNombre: string;
  pais: 'USA' | 'Peru';

  // Cantidades agregadas
  totalUnidades: number;
  disponibles: number;
  enTransito: number;
  reservadas: number;
  vendidas: number;
  vencidas: number;
  dañadas: number;

  // Valores financieros
  valorTotalUSD: number;        // Suma de costos de unidades disponibles
  costoPromedioUSD: number;     // Costo promedio unitario

  // Alertas y vencimientos
  proximasAVencer30Dias: number;  // Unidades que vencen en próximos 30 días
  proximasAVencer90Dias: number;  // Unidades que vencen en próximos 90 días
  diasPromedioVencimiento: number; // Promedio de días hasta vencimiento

  // Control de stock
  stockCritico: boolean;        // Si está por debajo del mínimo
  stockMinimo?: number;         // Del producto
  stockMaximo?: number;         // Del producto

  // Metadata
  ultimaActualizacion: Timestamp;
}

/**
 * Resumen de inventario por país
 */
export interface InventarioPorPais {
  pais: 'USA' | 'Peru';
  totalProductos: number;         // Productos únicos
  totalUnidades: number;          // Total de unidades
  disponibles: number;
  enTransito: number;
  reservadas: number;
  valorTotalUSD: number;
  productosStockCritico: number;
  productosAgotados: number;
  unidadesProximasVencer30: number;
  unidadesProximasVencer90: number;
}

/**
 * Resumen general de inventario (ambos países)
 */
export interface InventarioResumen {
  usa: InventarioPorPais;
  peru: InventarioPorPais;
  total: {
    productos: number;
    unidades: number;
    valorUSD: number;
  };
}

/**
 * Movimiento de inventario entre almacenes
 */
export interface MovimientoInventario {
  id: string;

  // Tipo de movimiento
  tipo: 'transferencia' | 'ajuste' | 'merma' | 'devolucion';

  // Producto
  productoId: string;
  productoSKU: string;
  productoNombre: string;

  // Origen y destino
  almacenOrigenId?: string;
  almacenOrigenNombre?: string;
  almacenDestinoId?: string;
  almacenDestinoNombre?: string;

  // Cantidad y unidades afectadas
  cantidad: number;
  unidadesIds: string[];          // IDs de las unidades movidas

  // Motivo y observaciones
  motivo: string;
  observaciones?: string;

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  aprobadoPor?: string;
  fechaAprobacion?: Timestamp;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'completado';
}

/**
 * Filtros para búsqueda de inventario
 */
export interface InventarioFiltros {
  productoId?: string;
  productoSKU?: string;
  almacenId?: string;
  pais?: 'USA' | 'Peru';
  grupo?: string;
  subgrupo?: string;
  marca?: string;
  soloStockCritico?: boolean;
  soloAgotados?: boolean;
  soloConStock?: boolean;
}

/**
 * Datos para crear un movimiento de inventario
 */
export interface MovimientoInventarioFormData {
  tipo: 'transferencia' | 'ajuste' | 'merma' | 'devolucion';
  productoId: string;
  almacenOrigenId?: string;
  almacenDestinoId?: string;
  cantidad: number;
  motivo: string;
  observaciones?: string;
}

/**
 * Historial de cambios en inventario (para auditoría)
 */
export interface HistorialInventario {
  id: string;
  productoId: string;
  productoSKU: string;
  almacenId: string;
  tipo: 'entrada' | 'salida' | 'ajuste' | 'transferencia';
  cantidadAnterior: number;
  cantidadNueva: number;
  diferencia: number;
  motivo: string;
  documentoRelacionado?: {
    tipo: 'orden-compra' | 'venta' | 'transferencia' | 'ajuste';
    id: string;
    numero: string;
  };
  usuarioId: string;
  fecha: Timestamp;
}

/**
 * Alerta de inventario
 */
export interface AlertaInventario {
  id: string;
  tipo: 'stock-critico' | 'stock-agotado' | 'proximo-vencer' | 'vencido';
  prioridad: 'alta' | 'media' | 'baja';
  productoId: string;
  productoSKU: string;
  productoNombre: string;
  almacenId: string;
  almacenNombre: string;
  pais: 'USA' | 'Peru';
  mensaje: string;
  cantidadActual: number;
  cantidadRequerida?: number;
  diasParaVencer?: number;
  fechaCreacion: Timestamp;
  leida: boolean;
}

/**
 * Estadísticas globales de inventario
 */
export interface InventarioStats {
  // Por país
  totalUnidadesUSA: number;
  totalUnidadesPeru: number;
  disponiblesUSA: number;
  disponiblesPeru: number;
  reservadasUSA: number;
  reservadasPeru: number;
  enTransitoUSA: number;
  enTransitoPeru: number;
  valorUSA: number;
  valorPeru: number;

  // Globales
  totalProductos: number;
  totalUnidades: number;
  totalDisponibles: number;
  totalReservadas: number;
  totalEnTransito: number;
  valorTotalUSD: number;

  // Alertas
  productosStockCritico: number;
  productosAgotados: number;
  unidadesProximasVencer30: number;
  unidadesVencidas: number;

  // Movimientos recientes
  movimientosUltimos7Dias: number;
  transferenciasUltimos7Dias: number;
}
