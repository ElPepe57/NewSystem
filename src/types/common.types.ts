import { Timestamp } from 'firebase/firestore';

// Tipos comunes usados en todo el sistema
export interface BaseEntity {
  id: string;
  creadoPor: string;
  fechaCreacion: Timestamp;
  ultimaEdicion?: Timestamp;
  editadoPor?: string;
}

export type Canal = 'retail' | 'mayorista' | 'mercadolibre';
export type Moneda = 'USD' | 'PEN';
export type Presentacion = 'tabletas' | 'gomitas' | 'capsulas' | 'capsulas_blandas' | 'polvo' | 'liquido';

// Estados comunes
export type EstadoGeneral = 'activo' | 'inactivo' | 'eliminado';

// Usuario
export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: 'socio' | 'vendedor' | 'operativo';
  activo: boolean;
  fechaCreacion: Timestamp;
}

// Respuestas de API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Paginación
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Filtros
export interface DateRange {
  inicio: Date;
  fin: Date;
}

export interface FilterOptions {
  search?: string;
  dateRange?: DateRange;
  estado?: string;
  [key: string]: any;
}
