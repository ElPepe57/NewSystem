import type { Timestamp } from 'firebase/firestore';

/**
 * ===============================================
 * TIPO DE PRODUCTO
 * ===============================================
 *
 * Agrupa productos por composicion/principio activo.
 * Permite comparar "manzanas con manzanas" entre diferentes marcas.
 *
 * Ejemplos:
 * - "Aceite de Oregano" (diferentes marcas: NOW, Carlyle, etc.)
 * - "Omega 3 EPA/DHA"
 * - "Sulfato de Zinc"
 * - "Colageno Hidrolizado"
 */

export type EstadoTipoProducto = 'activo' | 'inactivo';

/**
 * Tipo de Producto - Entidad Maestra
 */
export interface TipoProducto {
  id: string;
  codigo: string;                    // TPR-001, TPR-002, etc.

  // Identificacion
  nombre: string;                    // "Aceite de Oregano", "Sulfato de Zinc"
  nombreNormalizado: string;         // Para busqueda: "aceite-de-oregano"
  alias?: string[];                  // Variantes: ["Oregano Oil", "Aceite Oregano"]

  // Descripcion
  descripcion?: string;              // Descripcion general del tipo
  principioActivo?: string;          // Componente principal
  beneficiosPrincipales?: string[];  // Lista de beneficios

  // Relacion con Categorias Sugeridas
  categoriasSugeridasIds?: string[]; // IDs de categorias tipicas para este tipo

  // Visual (para web futura)
  iconoUrl?: string;
  imagenUrl?: string;

  // Estado
  estado: EstadoTipoProducto;

  // Metricas (desnormalizadas)
  metricas: {
    productosActivos: number;
    unidadesVendidas: number;
    ventasTotalPEN: number;
    margenPromedio: number;
  };

  // Auditoria
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Snapshot desnormalizado para embeber en Producto
 */
export interface TipoProductoSnapshot {
  tipoProductoId: string;
  codigo: string;
  nombre: string;
}

/**
 * FormData para crear/editar tipo de producto
 */
export interface TipoProductoFormData {
  nombre: string;
  alias?: string[];
  descripcion?: string;
  principioActivo?: string;
  beneficiosPrincipales?: string[];
  categoriasSugeridasIds?: string[];
  iconoUrl?: string;
  imagenUrl?: string;
}

/**
 * Filtros para busqueda de tipos de producto
 */
export interface TipoProductoFiltros {
  busqueda?: string;
  estado?: EstadoTipoProducto;
  conProductos?: boolean;
  ordenarPor?: 'nombre' | 'productosActivos' | 'ventasTotal' | 'fechaCreacion';
  orden?: 'asc' | 'desc';
}

/**
 * Estadisticas de tipos de producto para dashboard
 */
export interface TipoProductoStats {
  totalTipos: number;
  tiposActivos: number;
  tiposConProductos: number;

  // Top tipos por ventas
  topTiposPorVentas: Array<{
    tipoProductoId: string;
    nombre: string;
    ventasTotalPEN: number;
    productosActivos: number;
  }>;

  // Top tipos por margen
  topTiposPorMargen: Array<{
    tipoProductoId: string;
    nombre: string;
    margenPromedio: number;
    productosActivos: number;
  }>;
}
