import type { Timestamp } from 'firebase/firestore';

// ============================================
// TIPOS DE PRODUCTO (Ya existentes)
// ============================================

export type Presentacion = 
  | 'tabletas' 
  | 'gomitas' 
  | 'capsulas' 
  | 'capsulas_blandas' 
  | 'polvo' 
  | 'liquido';

export type EstadoProducto = 'activo' | 'inactivo' | 'descontinuado';

export interface Producto {
  id: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: Presentacion;
  dosaje: string;
  contenido: string;
  grupo: string;
  subgrupo: string;
  
  enlaceProveedor: string;
  codigoUPC: string;
  
  estado: EstadoProducto;
  etiquetas: string[];
  
  habilitadoML: boolean;
  restriccionML: string;
  
  ctruPromedio: number;
  precioSugerido: number;
  margenMinimo: number;
  margenObjetivo: number;
  
  stockUSA: number;
  stockPeru: number;
  stockTransito: number;
  stockReservado: number;
  stockDisponible: number;
  
  stockMinimo: number;
  stockMaximo: number;
  
  rotacionPromedio: number;
  diasParaQuiebre: number;
  
  esPadre: boolean;
  
  creadoPor: string;
  fechaCreacion: Timestamp;
  ultimaEdicion?: Timestamp;
}

export interface ProductoFormData {
  marca: string;
  nombreComercial: string;
  presentacion: Presentacion;
  dosaje: string;
  contenido: string;
  grupo: string;
  subgrupo: string;
  enlaceProveedor: string;
  codigoUPC: string;
  precioSugerido: number;
  margenMinimo: number;
  margenObjetivo: number;
  stockMinimo: number;
  stockMaximo: number;
  habilitadoML: boolean;
  restriccionML: string;
}

// ============================================
// TIPOS DE INVENTARIO (NUEVOS)
// ============================================

export type EstadoUnidad = 
  | 'recibida_usa'        // Recibida en almacén USA
  | 'en_transito'         // En tránsito USA → Perú
  | 'disponible_peru'     // Disponible para venta en Perú
  | 'asignada_pedido'     // Asignada a un pedido
  | 'entregada'           // Entregada al cliente
  | 'devuelta'            // Devuelta por cliente
  | 'danada'              // Dañada/perdida
  | 'vencida';            // Vencida

export type Almacen = 
  | 'miami_1' 
  | 'miami_2' 
  | 'utah' 
  | 'peru_principal' 
  | 'peru_secundario';

export interface Unidad {
  id: string;
  productoId: string;
  sku: string;
  
  // Identificación
  numeroUnidad: number;           // Número secuencial por producto
  codigoUnidad: string;           // SKU-0001, SKU-0002, etc.
  lote: string;
  fechaVencimiento?: Timestamp;
  
  // Costos
  ctruInicial: number;            // CTRU al momento de recepción
  ctruDinamico: number;           // CTRU actualizado mensualmente
  tcCompra: number;               // TC al momento de la compra
  tcPago: number;                 // TC al momento del pago
  costoUSA: number;               // Costo en USD
  costoPEN: number;               // Costo convertido a PEN
  
  // Ubicación y estado
  estado: EstadoUnidad;
  almacenActual: Almacen;
  
  // Fechas importantes
  fechaOrigen: Timestamp;         // Fecha de compra/origen
  fechaRecepcionUSA?: Timestamp;
  fechaSalidaUSA?: Timestamp;
  fechaLlegadaPeru?: Timestamp;
  fechaAsignacion?: Timestamp;
  fechaEntrega?: Timestamp;
  
  // Referencias
  ordenCompraId?: string;
  ventaId?: string;
  cotizacionId?: string;
  
  // Tracking
  numeroTracking?: string;
  courier?: string;
  
  // Historial
  historial: MovimientoUnidad[];
  
  // Metadata
  creadoPor: string;
  fechaCreacion: Timestamp;
  ultimaEdicion?: Timestamp;
}

export interface MovimientoUnidad {
  fecha: Timestamp;
  tipo: 'recepcion' | 'traslado' | 'asignacion' | 'entrega' | 'devolucion' | 'ajuste';
  estadoAnterior: EstadoUnidad;
  estadoNuevo: EstadoUnidad;
  almacenOrigen?: Almacen;
  almacenDestino?: Almacen;
  motivo: string;
  observaciones?: string;
  realizadoPor: string;
}

export interface UnidadFormData {
  productoId: string;
  cantidad: number;              // Cuántas unidades crear
  lote: string;
  fechaVencimiento?: Date;
  costoUSA: number;
  tcCompra: number;
  tcPago: number;
  almacenDestino: Almacen;
  ordenCompraId?: string;
  numeroTracking?: string;
  courier?: string;
  observaciones?: string;
}

export interface StockPorAlmacen {
  almacen: Almacen;
  nombreAlmacen: string;
  cantidad: number;
  unidades: Unidad[];
}

export interface ResumenInventario {
  totalUnidades: number;
  unidadesUSA: number;
  unidadesPeru: number;
  unidadesTransito: number;
  unidadesDisponibles: number;
  unidadesAsignadas: number;
  valorTotalPEN: number;
  stockPorAlmacen: StockPorAlmacen[];
}