import type { Timestamp } from 'firebase/firestore';

/**
 * ===============================================
 * ETIQUETA DE PRODUCTO
 * ===============================================
 *
 * Tags flexibles para filtrado y marketing.
 * Permiten clasificaciones adicionales que no son categorias.
 *
 * Tipos de etiquetas:
 * - atributo: vegano, sin-gluten, organico
 * - marketing: best-seller, nuevo, promocion
 * - origen: importado-usa, nacional
 */

export type TipoEtiqueta =
  | 'atributo'      // vegano, organico, sin-gluten, sin-lactosa
  | 'marketing'     // best-seller, nuevo, promocion, destacado
  | 'origen';       // importado-usa, nacional, importado-europa

export type EstadoEtiqueta = 'activa' | 'inactiva';

/**
 * Colores predefinidos para etiquetas
 */
export const COLORES_ETIQUETA = {
  // Atributos (verdes/naturales)
  vegano: { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' },
  organico: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
  natural: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },

  // Marketing (colores llamativos)
  bestseller: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  nuevo: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
  promocion: { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' },
  destacado: { bg: '#F3E8FF', text: '#6B21A8', border: '#D8B4FE' },

  // Origen (azules/grises)
  usa: { bg: '#EFF6FF', text: '#1E3A8A', border: '#BFDBFE' },
  nacional: { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' },

  // Default
  default: { bg: '#F3F4F6', text: '#4B5563', border: '#D1D5DB' }
} as const;

/**
 * Etiqueta de Producto - Entidad Maestra
 */
export interface Etiqueta {
  id: string;
  codigo: string;                    // ETQ-001, ETQ-002, etc.

  // Identificacion
  nombre: string;                    // "Vegano", "Sin Gluten", "Best Seller"
  nombreNormalizado: string;         // "vegano", "sin-gluten", "best-seller"
  slug: string;                      // Para URLs

  // Clasificacion
  tipo: TipoEtiqueta;
  grupo?: string;                    // Agrupacion visual: "Dieta", "Certificaciones"

  // Visual
  icono?: string;                    // Emoji o nombre de icono: "🌱", "leaf"
  colorFondo?: string;               // Color hex del fondo
  colorTexto?: string;               // Color hex del texto
  colorBorde?: string;               // Color hex del borde

  // Estado
  estado: EstadoEtiqueta;
  mostrarEnFiltros: boolean;         // Si aparece en filtros de busqueda
  ordenDisplay: number;              // Para ordenar en UI

  // Metricas
  productosActivos: number;

  // Auditoria
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Snapshot desnormalizado para embeber en Producto
 */
export interface EtiquetaSnapshot {
  etiquetaId: string;
  codigo: string;
  nombre: string;
  slug: string;
  tipo: TipoEtiqueta;
  icono?: string;
  colorFondo?: string;
  colorTexto?: string;
  colorBorde?: string;
}

/**
 * FormData para crear/editar etiqueta
 */
export interface EtiquetaFormData {
  nombre: string;
  tipo: TipoEtiqueta;
  grupo?: string;
  icono?: string;
  colorFondo?: string;
  colorTexto?: string;
  colorBorde?: string;
  mostrarEnFiltros?: boolean;
  ordenDisplay?: number;
}

/**
 * Filtros para busqueda de etiquetas
 */
export interface EtiquetaFiltros {
  busqueda?: string;
  tipo?: TipoEtiqueta;
  estado?: EstadoEtiqueta;
  mostrarEnFiltros?: boolean;
  conProductos?: boolean;
  ordenarPor?: 'nombre' | 'tipo' | 'productosActivos' | 'ordenDisplay' | 'fechaCreacion';
  orden?: 'asc' | 'desc';
}

/**
 * Etiquetas agrupadas por tipo (para UI)
 */
export interface EtiquetasAgrupadas {
  atributo: Etiqueta[];
  marketing: Etiqueta[];
  origen: Etiqueta[];
}

/**
 * Estadisticas de etiquetas para dashboard
 */
export interface EtiquetaStats {
  totalEtiquetas: number;
  etiquetasActivas: number;

  // Por tipo
  etiquetasPorTipo: Record<TipoEtiqueta, number>;

  // Top etiquetas por uso
  topEtiquetasPorUso: Array<{
    etiquetaId: string;
    nombre: string;
    tipo: TipoEtiqueta;
    productosActivos: number;
  }>;
}

/**
 * Preset de etiquetas comunes para suplementos
 * Util para pre-cargar el sistema
 */
export const ETIQUETAS_PRESET: Omit<EtiquetaFormData, 'ordenDisplay'>[] = [
  // Atributos
  { nombre: 'Vegano', tipo: 'atributo', icono: '🌱', grupo: 'Dieta', ...COLORES_ETIQUETA.vegano },
  { nombre: 'Organico', tipo: 'atributo', icono: '🌿', grupo: 'Certificaciones', ...COLORES_ETIQUETA.organico },
  { nombre: 'Sin Gluten', tipo: 'atributo', icono: '🌾', grupo: 'Dieta' },
  { nombre: 'Sin Lactosa', tipo: 'atributo', icono: '🥛', grupo: 'Dieta' },
  { nombre: 'Non-GMO', tipo: 'atributo', icono: '🧬', grupo: 'Certificaciones' },
  { nombre: 'Kosher', tipo: 'atributo', icono: '✡️', grupo: 'Certificaciones' },
  { nombre: 'Sin Azucar', tipo: 'atributo', icono: '🍬', grupo: 'Dieta' },

  // Marketing
  { nombre: 'Best Seller', tipo: 'marketing', icono: '⭐', ...COLORES_ETIQUETA.bestseller },
  { nombre: 'Nuevo', tipo: 'marketing', icono: '🆕', ...COLORES_ETIQUETA.nuevo },
  { nombre: 'Promocion', tipo: 'marketing', icono: '🏷️', ...COLORES_ETIQUETA.promocion },
  { nombre: 'Destacado', tipo: 'marketing', icono: '💎', ...COLORES_ETIQUETA.destacado },
  { nombre: 'Mas Vendido', tipo: 'marketing', icono: '🔥', ...COLORES_ETIQUETA.bestseller },
  { nombre: 'Recomendado', tipo: 'marketing', icono: '👍' },

  // Origen
  { nombre: 'Importado USA', tipo: 'origen', icono: '🇺🇸', ...COLORES_ETIQUETA.usa },
  { nombre: 'Nacional', tipo: 'origen', icono: '🇵🇪', ...COLORES_ETIQUETA.nacional },
  { nombre: 'Importado Europa', tipo: 'origen', icono: '🇪🇺' },
];
