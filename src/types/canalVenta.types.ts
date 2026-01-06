import type { Timestamp } from 'firebase/firestore';

/**
 * Estado del canal de venta
 */
export type EstadoCanalVenta = 'activo' | 'inactivo';

/**
 * Canal de Venta - Entidad maestra
 * Colección: canalesVenta
 */
export interface CanalVenta {
  id: string;
  codigo: string;                    // CV-001, CV-002, etc.
  nombre: string;                    // "Mercado Libre", "WhatsApp", "Instagram"
  descripcion?: string;              // Descripción opcional

  // Configuración comercial
  comisionPorcentaje?: number;       // % de comisión del canal (ej: 13% para ML)
  requiereEnvio?: boolean;           // Si típicamente requiere envío
  tiempoProcesamientoDias?: number;  // Días típicos de procesamiento

  // Visualización
  color?: string;                    // Color para badges/reportes (hex)
  icono?: string;                    // Nombre del icono (lucide)

  // Estado
  estado: EstadoCanalVenta;
  esSistema: boolean;                // true = no se puede eliminar (canales base)
  orden: number;                     // Orden de aparición en selects

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Datos para crear/actualizar un canal de venta
 */
export interface CanalVentaFormData {
  codigo?: string;                   // Opcional, se genera automáticamente si no se provee
  nombre: string;
  descripcion?: string;
  comisionPorcentaje?: number;
  requiereEnvio?: boolean;
  tiempoProcesamientoDias?: number;
  color?: string;
  icono?: string;
  estado: EstadoCanalVenta;
  orden?: number;
}

/**
 * Estadísticas de un canal de venta
 */
export interface CanalVentaStats {
  canalId: string;
  nombreCanal: string;

  // Métricas de volumen
  totalCotizaciones: number;
  totalVentas: number;
  tasaConversion: number;            // ventas / cotizaciones * 100

  // Métricas financieras
  montoTotalVentas: number;          // S/ vendido por este canal
  montoPromedioPorVenta: number;     // Ticket promedio
  comisionesTotales: number;         // Comisiones pagadas al canal
  margenNeto: number;                // Ventas - comisiones

  // Métricas de tiempo
  tiempoPromedioConversion: number;  // Días promedio cotización → venta

  // Período
  periodo: {
    desde: Date;
    hasta: Date;
  };
}

/**
 * Canales del sistema (valores por defecto)
 */
export const CANALES_SISTEMA: Omit<CanalVenta, 'id' | 'creadoPor' | 'fechaCreacion'>[] = [
  {
    codigo: 'CV-001',
    nombre: 'Venta Directa',
    descripcion: 'Ventas presenciales o por contacto directo',
    comisionPorcentaje: 0,
    requiereEnvio: false,
    color: '#22c55e',
    icono: 'Store',
    estado: 'activo',
    esSistema: true,
    orden: 1
  },
  {
    codigo: 'CV-002',
    nombre: 'Mercado Libre',
    descripcion: 'Ventas a través de Mercado Libre',
    comisionPorcentaje: 13,
    requiereEnvio: true,
    tiempoProcesamientoDias: 1,
    color: '#ffe600',
    icono: 'ShoppingBag',
    estado: 'activo',
    esSistema: true,
    orden: 2
  },
  {
    codigo: 'CV-003',
    nombre: 'WhatsApp',
    descripcion: 'Ventas por WhatsApp Business',
    comisionPorcentaje: 0,
    requiereEnvio: true,
    color: '#25d366',
    icono: 'MessageCircle',
    estado: 'activo',
    esSistema: true,
    orden: 3
  },
  {
    codigo: 'CV-004',
    nombre: 'Instagram',
    descripcion: 'Ventas por Instagram/Facebook',
    comisionPorcentaje: 0,
    requiereEnvio: true,
    color: '#e1306c',
    icono: 'Instagram',
    estado: 'activo',
    esSistema: true,
    orden: 4
  },
  {
    codigo: 'CV-005',
    nombre: 'Otro',
    descripcion: 'Otros canales de venta',
    comisionPorcentaje: 0,
    color: '#6b7280',
    icono: 'MoreHorizontal',
    estado: 'activo',
    esSistema: true,
    orden: 99
  }
];

/**
 * Mapeo de valores legacy a códigos de canal
 * Para migración de datos existentes
 */
export const CANAL_LEGACY_MAP: Record<string, string> = {
  'venta_directa': 'CV-001',
  'directo': 'CV-001',
  'mercado_libre': 'CV-002',
  'whatsapp': 'CV-003',
  'instagram': 'CV-004',
  'otro': 'CV-005'
};
