import type { Timestamp } from 'firebase/firestore';

export type CanalVenta = 
  | 'mercado_libre'
  | 'directo'
  | 'otro';

export type EstadoVenta = 
  | 'cotizacion'      // Solo cotización, no confirmada
  | 'confirmada'      // Venta confirmada, pendiente de asignación
  | 'asignada'        // Unidades asignadas del inventario
  | 'en_entrega'      // En proceso de entrega
  | 'entregada'       // Completada
  | 'cancelada';      // Cancelada

export interface ProductoVenta {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  
  cantidad: number;
  precioUnitario: number;    // Precio de venta en PEN
  subtotal: number;          // cantidad × precioUnitario
  
  // Unidades asignadas (cuando estado >= 'asignada')
  unidadesAsignadas?: string[];  // IDs de unidades del inventario
  costoTotalUnidades?: number;   // Suma de CTRU de unidades asignadas
  margenReal?: number;           // (subtotal - costoTotalUnidades) / subtotal * 100
}

export interface Venta {
  id: string;
  numeroVenta: string;        // VT-2024-001
  
  // Cliente
  nombreCliente: string;
  emailCliente?: string;
  telefonoCliente?: string;
  direccionEntrega?: string;
  dniRuc?: string;
  
  // Canal
  canal: CanalVenta;
  
  // Productos
  productos: ProductoVenta[];
  
  // Totales
  subtotalPEN: number;        // Suma de productos
  descuento?: number;         // Descuento aplicado
  totalPEN: number;           // subtotal - descuento
  
  // Rentabilidad (calculada después de asignar unidades)
  costoTotalPEN?: number;     // Suma de costos de todas las unidades
  utilidadBrutaPEN?: number;  // totalPEN - costoTotalPEN
  margenPromedio?: number;    // utilidadBruta / totalPEN * 100
  
  // Estado y fechas
  estado: EstadoVenta;
  fechaCreacion: Timestamp;
  fechaConfirmacion?: Timestamp;
  fechaAsignacion?: Timestamp;
  fechaEntrega?: Timestamp;
  
  // Entrega
  direccionEntregaFinal?: string;
  notasEntrega?: string;
  
  // ML específico
  mercadoLibreId?: string;     // ID de la venta en ML
  
  // Observaciones
  observaciones?: string;
  
  // Auditoría
  creadoPor: string;
  ultimaEdicion?: Timestamp;
  editadoPor?: string;
}

export interface VentaFormData {
  nombreCliente: string;
  emailCliente?: string;
  telefonoCliente?: string;
  direccionEntrega?: string;
  dniRuc?: string;
  canal: CanalVenta;
  productos: Array<{
    productoId: string;
    cantidad: number;
    precioUnitario: number;
  }>;
  descuento?: number;
  mercadoLibreId?: string;
  observaciones?: string;
}

export interface AsignacionUnidad {
  unidadId: string;
  productoId: string;
  sku: string;
  codigoUnidad: string;
  ctru: number;
  fechaVencimiento?: Timestamp;
}

export interface ResultadoAsignacion {
  productoId: string;
  cantidadSolicitada: number;
  cantidadAsignada: number;
  unidadesAsignadas: AsignacionUnidad[];
  unidadesFaltantes: number;
}

export interface VentaStats {
  totalVentas: number;
  cotizaciones: number;
  confirmadas: number;
  enProceso: number;
  entregadas: number;
  canceladas: number;
  
  ventasTotalPEN: number;
  utilidadTotalPEN: number;
  margenPromedio: number;
  
  // Por canal
  ventasML: number;
  ventasDirecto: number;
  ventasOtro: number;
}

export interface ProductoDisponible {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  
  unidadesDisponibles: number;
  precioSugerido: number;
  margenObjetivo: number;
}