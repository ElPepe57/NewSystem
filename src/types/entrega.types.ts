import type { Timestamp } from 'firebase/firestore';
import type { BaseEntity } from './common.types';
import type { MetodoPago } from './venta.types';
import type { TipoTransportista, CourierExterno } from './transportista.types';

/**
 * Estado de la entrega
 */
export type EstadoEntrega =
  | 'programada'      // Entrega programada, pendiente de salir
  | 'en_camino'       // Transportista en ruta
  | 'entregada'       // Entrega exitosa
  | 'fallida'         // Entrega fallida (no encontró, rechazó, etc)
  | 'reprogramada'    // Reprogramada para otro día
  | 'cancelada';      // Cancelada

/**
 * Resultado de entrega fallida
 */
export type MotivoFallo =
  | 'no_encontrado'      // No encontró la dirección
  | 'ausente'            // Cliente ausente
  | 'rechazo'            // Cliente rechazó
  | 'producto_danado'    // Producto llegó dañado
  | 'pago_rechazado'     // No pudo realizar el cobro
  | 'otro';

/**
 * Producto incluido en la entrega
 */
export interface ProductoEntrega {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  cantidad: number;
  unidadesAsignadas: string[];     // IDs de unidades del inventario
  precioUnitario: number;          // Para el PDF
  subtotal: number;
}

/**
 * Entrega - Representa una entrega individual (puede ser parcial)
 */
export interface Entrega extends BaseEntity {
  // Identificación
  codigo: string;                   // ENT-2024-001
  ventaId: string;                  // Referencia a la venta
  numeroVenta: string;              // Para display

  // Número de entrega parcial
  numeroEntrega: number;            // 1, 2, 3... (para entregas parciales)
  totalEntregas?: number;           // Total de entregas de la venta (si es parcial)

  // Transportista
  transportistaId: string;
  nombreTransportista: string;
  tipoTransportista: TipoTransportista;
  courierExterno?: CourierExterno;
  telefonoTransportista?: string;

  // Cliente
  nombreCliente: string;
  telefonoCliente?: string;
  emailCliente?: string;

  // Dirección
  direccionEntrega: string;
  distrito?: string;
  referencia?: string;
  coordenadas?: {
    lat: number;
    lng: number;
  };

  // Productos a entregar
  productos: ProductoEntrega[];
  cantidadItems: number;           // Total de items (suma de cantidades)

  // Valores
  subtotalPEN: number;             // Suma de productos en esta entrega
  costoEnvio?: number;             // Costo de envío al cliente

  // Cobro pendiente
  cobroPendiente: boolean;
  montoPorCobrar?: number;         // Si hay cobro pendiente
  metodoPagoEsperado?: MetodoPago;

  // Gasto de distribución (GD)
  costoTransportista: number;      // Costo del transportista para esta entrega
  gastoDistribucionId?: string;    // ID del gasto GD generado

  // Estado y tracking
  estado: EstadoEntrega;
  numeroTracking?: string;         // Para couriers externos

  // Fechas
  fechaProgramada: Timestamp;      // Cuándo se debe entregar
  horaProgramada?: string;         // Rango horario: "10:00-14:00"
  fechaSalida?: Timestamp;         // Cuándo salió el transportista
  fechaEntrega?: Timestamp;        // Cuándo se entregó
  tiempoEntregaMinutos?: number;   // Tiempo desde salida hasta entrega

  // Para entregas fallidas
  motivoFallo?: MotivoFallo;
  descripcionFallo?: string;

  // Cobro realizado
  cobroRealizado?: boolean;
  montoRecaudado?: number;
  metodoPagoRecibido?: MetodoPago;
  referenciaCobroId?: string;      // ID del pago en venta

  // Confirmaciones
  fotoEntrega?: string;            // URL de foto de entrega
  firmaCLiente?: string;           // URL de firma digital
  notasEntrega?: string;

  // PDF generados
  pdfGuiaTransportista?: string;   // URL del PDF para transportista
  pdfCargoCliente?: string;        // URL del PDF cargo para cliente

  // Observaciones
  observaciones?: string;
}

/**
 * Datos para programar una entrega
 */
export interface ProgramarEntregaData {
  ventaId: string;
  transportistaId: string;

  // Productos a incluir (para entregas parciales)
  productos: Array<{
    productoId: string;
    cantidad: number;
    unidadesAsignadas: string[];
  }>;

  // Dirección
  direccionEntrega: string;
  distrito?: string;
  referencia?: string;

  // Programación
  fechaProgramada: Date;
  horaProgramada?: string;

  // Cobro
  cobroPendiente: boolean;
  montoPorCobrar?: number;
  metodoPagoEsperado?: MetodoPago;

  // Costo
  costoTransportista: number;

  observaciones?: string;
}

/**
 * Datos para registrar resultado de entrega
 */
export interface ResultadoEntregaData {
  entregaId: string;
  exitosa: boolean;

  // Si exitosa
  fechaEntrega?: Date;
  fotoEntrega?: string;
  firmaCliente?: string;

  // Si hubo cobro
  cobroRealizado?: boolean;
  montoRecaudado?: number;
  metodoPagoRecibido?: MetodoPago;

  // Si fallida
  motivoFallo?: MotivoFallo;
  descripcionFallo?: string;
  reprogramar?: boolean;
  nuevaFechaProgramada?: Date;

  notasEntrega?: string;
}

/**
 * Resumen de entregas de una venta
 */
export interface ResumenEntregasVenta {
  ventaId: string;
  totalProductos: number;
  productosEntregados: number;
  productosPendientes: number;

  entregas: Array<{
    entregaId: string;
    codigo: string;
    estado: EstadoEntrega;
    transportista: string;
    fecha: Timestamp;
    productos: number;
  }>;

  costoTotalDistribucion: number;
  entregaCompleta: boolean;
}

/**
 * Estadísticas de entregas
 */
export interface EntregaStats {
  periodo: {
    inicio: Timestamp;
    fin: Timestamp;
  };
  totalEntregas: number;
  entregasExitosas: number;
  entregasFallidas: number;
  entregasPendientes: number;
  tasaExito: number;

  tiempoPromedioEntrega: number;   // Minutos
  costoPromedioEntrega: number;    // PEN
  costoTotalDistribucion: number;

  // Por transportista
  porTransportista: Array<{
    transportistaId: string;
    nombre: string;
    entregas: number;
    exitosas: number;
    tasaExito: number;
  }>;

  // Por zona/distrito
  porZona: Array<{
    zona: string;
    entregas: number;
    exitosas: number;
  }>;
}

/**
 * Filtros para búsqueda de entregas
 */
export interface EntregaFilters {
  estado?: EstadoEntrega;
  transportistaId?: string;
  ventaId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  distrito?: string;
  cobroPendiente?: boolean;
}

/**
 * Datos para generar PDF de entrega
 */
export interface PDFEntregaData {
  tipoDocumento: 'guia_transportista' | 'cargo_cliente';
  entrega: Entrega;

  // Información de empresa
  empresa: {
    nombre: string;
    ruc: string;
    direccion: string;
    telefono: string;
  };

  // QR para pagos pendientes
  qrPago?: {
    url: string;              // URL o data para QR
    cuenta: string;           // Número de cuenta/teléfono
    banco?: string;
  };
}
