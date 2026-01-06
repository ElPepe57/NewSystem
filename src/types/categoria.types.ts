import type { Timestamp } from 'firebase/firestore';

/**
 * ===============================================
 * CATEGORIA DE PRODUCTO
 * ===============================================
 *
 * Clasificacion por area de beneficio/salud.
 * Un producto puede pertenecer a MULTIPLES categorias.
 * Soporta jerarquia de 2 niveles (padre/hijo).
 *
 * Ejemplos de categorias padre:
 * - "Sistema Inmune"
 * - "Digestivo"
 * - "Cardiovascular"
 * - "Energia y Vitalidad"
 *
 * Ejemplos de subcategorias:
 * - "Sistema Inmune > Antioxidantes"
 * - "Digestivo > Probioticos"
 */

export type EstadoCategoria = 'activa' | 'inactiva';
export type NivelCategoria = 1 | 2;  // 1 = padre, 2 = hijo

/**
 * Iconos disponibles para categorias
 * Usando nombres de iconos de Lucide React
 */
export type IconoCategoria =
  | 'shield'          // Sistema Inmune
  | 'heart'           // Cardiovascular
  | 'brain'           // Cerebro y Memoria
  | 'zap'             // Energia
  | 'sparkles'        // Belleza
  | 'bone'            // Huesos
  | 'flame'           // Control de Peso
  | 'activity'        // Digestivo
  | 'moon'            // Sueno
  | 'sun'             // Vitaminas
  | 'pill'            // General
  | 'leaf'            // Natural
  | 'droplet'         // Liquidos
  | 'eye'             // Vision
  | 'baby'            // Ninos
  | 'user'            // Adultos
  | 'users';          // Familia

/**
 * Categoria de Producto - Entidad Maestra
 */
export interface Categoria {
  id: string;
  codigo: string;                    // CAT-001, CAT-002, etc.

  // Identificacion
  nombre: string;                    // "Sistema Inmune", "Digestivo"
  nombreNormalizado: string;         // Para busqueda: "sistema-inmune"
  slug: string;                      // Para URLs web: "sistema-inmune"

  // Jerarquia
  nivel: NivelCategoria;
  categoriaPadreId?: string;         // null si es nivel 1
  categoriaPadreNombre?: string;     // Snapshot para display rapido
  ordenDisplay: number;              // Para ordenar en navegacion

  // Descripcion
  descripcion?: string;
  metaDescription?: string;          // Para SEO web
  keywords?: string[];               // Para SEO y busqueda

  // Visual
  icono?: IconoCategoria;            // Nombre de icono
  color?: string;                    // Color hex para UI (ej: "#3B82F6")
  imagenUrl?: string;                // Imagen para web
  imagenBannerUrl?: string;          // Banner para pagina de categoria

  // Estado
  estado: EstadoCategoria;
  mostrarEnWeb: boolean;             // Si aparece en navegacion web
  mostrarEnApp: boolean;             // Si aparece en app interna

  // Metricas (desnormalizadas)
  metricas: {
    productosActivos: number;
    subcategorias: number;           // Solo para nivel 1
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
export interface CategoriaSnapshot {
  categoriaId: string;
  codigo: string;
  nombre: string;
  slug: string;
  nivel: NivelCategoria;
  categoriaPadreId?: string;
  categoriaPadreNombre?: string;
  icono?: IconoCategoria;
  color?: string;
}

/**
 * FormData para crear/editar categoria
 */
export interface CategoriaFormData {
  nombre: string;
  nivel: NivelCategoria;
  categoriaPadreId?: string;
  ordenDisplay?: number;
  descripcion?: string;
  metaDescription?: string;
  keywords?: string[];
  icono?: IconoCategoria;
  color?: string;
  imagenUrl?: string;
  imagenBannerUrl?: string;
  mostrarEnWeb?: boolean;
  mostrarEnApp?: boolean;
}

/**
 * Filtros para busqueda de categorias
 */
export interface CategoriaFiltros {
  busqueda?: string;
  estado?: EstadoCategoria;
  nivel?: NivelCategoria;
  categoriaPadreId?: string;
  mostrarEnWeb?: boolean;
  conProductos?: boolean;
  ordenarPor?: 'nombre' | 'ordenDisplay' | 'productosActivos' | 'fechaCreacion';
  orden?: 'asc' | 'desc';
}

/**
 * Arbol de categorias para navegacion
 * Extiende Categoria agregando hijos anidados
 */
export interface CategoriaArbol extends Categoria {
  hijos: CategoriaArbol[];
}

/**
 * Categoria con path completo para display
 */
export interface CategoriaConPath extends Categoria {
  pathCompleto: string;  // "Sistema Inmune > Antioxidantes"
}

/**
 * Estadisticas de categorias para dashboard
 */
export interface CategoriaStats {
  totalCategorias: number;
  categoriasActivas: number;
  categoriasPadre: number;
  subcategorias: number;

  // Top categorias por productos
  topCategoriasPorProductos: Array<{
    categoriaId: string;
    nombre: string;
    productosActivos: number;
    nivel: NivelCategoria;
  }>;

  // Distribucion por nivel
  distribucionPorNivel: {
    nivel1: number;
    nivel2: number;
  };
}

/**
 * Opcion para select de categorias (UI)
 */
export interface CategoriaSelectOption {
  value: string;           // ID de la categoria
  label: string;           // Nombre con path si es subcategoria
  nivel: NivelCategoria;
  icono?: IconoCategoria;
  color?: string;
  disabled?: boolean;      // Si ya esta seleccionada
}
