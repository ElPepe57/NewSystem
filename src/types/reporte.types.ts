import type { Timestamp } from 'firebase/firestore';

export type PeriodoReporte = 
  | 'hoy'
  | 'semana'
  | 'mes'
  | 'trimestre'
  | 'anio'
  | 'personalizado';

export interface RangoFechas {
  inicio: Date;
  fin: Date;
}

export interface MetricaVentas {
  periodo: string;
  ventas: number;
  ventasPEN: number;
  utilidad: number;
  margen: number;
  cantidad: number;
}

export interface ProductoRentabilidad {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  
  unidadesVendidas: number;
  ventasTotalPEN: number;
  costoTotalPEN: number;
  utilidadPEN: number;
  margenPromedio: number;
  
  precioPromedioVenta: number;
  costoPromedioUnidad: number;
}

export interface InventarioValorizado {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  
  unidadesDisponibles: number;
  unidadesAsignadas: number;
  unidadesTotal: number;
  
  valorTotalPEN: number;
  costoPromedioUnidad: number;
  
  unidadesMiami: number;
  unidadesUtah: number;
  unidadesPeru: number;
}

export interface ResumenEjecutivo {
  // Ventas
  ventasTotalesPEN: number;
  ventasMes: number;
  ventasSemana: number;
  ventasHoy: number;
  
  // Rentabilidad
  utilidadTotalPEN: number;
  margenPromedio: number;
  
  // Inventario
  valorInventarioPEN: number;
  unidadesTotales: number;
  unidadesDisponibles: number;
  
  // Órdenes de compra
  ordenesActivas: number;
  ordenesRecibidas: number;
  inversionTotalUSD: number;
  
  // Productos
  productosActivos: number;
  productosMasVendidos: ProductoRentabilidad[];
  
  // Tipo de cambio
  tcActual: number;
  tcPromedio: number;
}

export interface VentasPorCanal {
  mercadoLibre: {
    cantidad: number;
    totalPEN: number;
    porcentaje: number;
  };
  directo: {
    cantidad: number;
    totalPEN: number;
    porcentaje: number;
  };
  otro: {
    cantidad: number;
    totalPEN: number;
    porcentaje: number;
  };
}

export interface TendenciaVentas {
  fecha: string;
  ventas: number;
  utilidad: number;
  margen: number;
}

export interface AlertaInventario {
  tipo: 'stock_bajo' | 'stock_critico' | 'proximo_vencer' | 'vencido';
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  mensaje: string;
  prioridad: 'alta' | 'media' | 'baja';
  cantidad?: number;
  fechaVencimiento?: Timestamp;
}