import type { EstadoRequerimiento } from '../../types/requerimiento.types';
import type { Producto } from '../../types/producto.types';

// Tipo para informacion de investigacion de mercado
export interface InvestigacionProducto {
  productoId: string;
  precioPromedioUSD: number;
  precioMinimoUSD: number;
  precioMaximoUSD: number;
  ultimoPrecioUSD: number;
  proveedorRecomendado?: {
    id: string;
    nombre: string;
    ultimoPrecioUSD: number;
  };
  historial: Array<{
    proveedorNombre: string;
    costoUnitarioUSD: number;
    fechaCompra: Date;
  }>;
}

// Tipo para sugerencias de stock bajo
export interface SugerenciaStock {
  producto: Producto;
  stockActual: number;
  stockMinimo: number;
  demandaPromedio: number;
  diasParaAgotarse: number;
  urgencia: 'critica' | 'alta' | 'media';
  precioEstimadoUSD?: number;
  proveedorSugerido?: string;
}

// Estadisticas del modulo
export interface RequerimientosStats {
  total: number;
  activos: number;
  pendientes: number;
  aprobados: number;
  enProceso: number;
  urgentes: number;
  costoEstimadoPendiente: number;
  alertasStock: number;
}

// Columnas del Kanban — definidas sin JSX para que sea importable desde .ts y .tsx
export interface KanbanColumn {
  id: EstadoRequerimiento;
  label: string;
  color: string;
}

export const KANBAN_COLUMN_DEFS: KanbanColumn[] = [
  { id: 'pendiente', label: 'Pendientes', color: 'bg-yellow-500' },
  { id: 'aprobado', label: 'Aprobados', color: 'bg-blue-500' },
  { id: 'parcial', label: 'OC Parcial', color: 'bg-indigo-500' },
  { id: 'en_proceso', label: 'En Proceso', color: 'bg-purple-500' },
  { id: 'completado', label: 'Completados', color: 'bg-green-500' }
];
