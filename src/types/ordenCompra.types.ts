import type { Timestamp } from 'firebase/firestore';

export type EstadoOrden = 
  | 'borrador'      // Creada pero no enviada
  | 'enviada'       // Enviada al proveedor
  | 'pagada'        // Pago realizado
  | 'en_transito'   // Mercadería en camino
  | 'recibida'      // Recibida en almacén
  | 'cancelada';    // Cancelada

export type TipoProveedor = 
  | 'fabricante'
  | 'distribuidor'
  | 'mayorista'
  | 'minorista';

export interface Proveedor {
  id: string;
  nombre: string;
  tipo: TipoProveedor;
  contacto?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  pais: string;
  notasInternas?: string;
  activo: boolean;
  
  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  ultimaEdicion?: Timestamp;
}

export interface ProductoOrden {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  cantidad: number;
  costoUnitario: number;    // Precio por unidad en USD
  subtotal: number;         // cantidad × costoUnitario
}

export interface OrdenCompra {
  id: string;
  numeroOrden: string;        // OC-2024-001
  
  // Proveedor
  proveedorId: string;
  nombreProveedor: string;
  
  // Productos
  productos: ProductoOrden[];
  
  // Totales
  subtotalUSD: number;        // Suma de todos los productos
  gastosEnvioUSD?: number;    // Gastos de envío/courier
  otrosGastosUSD?: number;    // Otros gastos adicionales
  totalUSD: number;           // subtotal + gastos
  
  // Tipo de Cambio
  tcCompra?: number;          // TC al momento de crear la orden
  tcPago?: number;            // TC al momento del pago
  totalPEN?: number;          // totalUSD × tcPago
  
  // Diferencia cambiaria (si TC pago != TC compra)
  diferenciaCambiaria?: number;
  
  // Estado y fechas
  estado: EstadoOrden;
  fechaCreacion: Timestamp;
  fechaEnviada?: Timestamp;
  fechaPagada?: Timestamp;
  fechaEnTransito?: Timestamp;
  fechaRecibida?: Timestamp;
  
  // Tracking y logística
  numeroTracking?: string;
  courier?: string;
  almacenDestino?: string;    // miami_1, utah, etc.
  
  // Información adicional
  observaciones?: string;
  documentos?: string[];      // URLs de facturas, etc.
  
  // Inventario generado
  inventarioGenerado: boolean;
  unidadesGeneradas?: string[];  // IDs de las unidades creadas
  
  // Auditoría
  creadoPor: string;
  ultimaEdicion?: Timestamp;
  editadoPor?: string;
}

export interface OrdenCompraFormData {
  proveedorId: string;
  productos: Array<{
    productoId: string;
    cantidad: number;
    costoUnitario: number;
  }>;
  gastosEnvioUSD?: number;
  otrosGastosUSD?: number;
  tcCompra?: number;
  almacenDestino?: string;
  observaciones?: string;
}

export interface CambioEstadoOrden {
  estadoAnterior: EstadoOrden;
  estadoNuevo: EstadoOrden;
  fecha: Timestamp;
  realizadoPor: string;
  motivo?: string;
  observaciones?: string;
  
  // Datos adicionales según el estado
  tcPago?: number;            // Si cambia a "pagada"
  numeroTracking?: string;    // Si cambia a "en_transito"
  courier?: string;           // Si cambia a "en_transito"
}

export interface OrdenCompraStats {
  totalOrdenes: number;
  borradores: number;
  enviadas: number;
  pagadas: number;
  enTransito: number;
  recibidas: number;
  canceladas: number;
  valorTotalUSD: number;
  valorTotalPEN: number;
}

export interface ProveedorFormData {
  nombre: string;
  tipo: TipoProveedor;
  contacto?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  pais: string;
  notasInternas?: string;
}