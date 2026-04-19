/**
 * MapKit — Tipos comunes
 *
 * Todos los consumidores del MapKit trabajan con `MapPoint<T>`.
 * Cada feature escribe un adapter `dominio -> MapPoint<Dominio>`.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Punto genérico que el MapKit sabe renderizar.
 * `metadata` preserva el objeto del dominio original para tooltips/handlers.
 */
export interface MapPoint<T = unknown> {
  id: string;
  coordenadas: LatLng;
  nombre: string;
  /** Etiqueta usada por helpers `colorBy`/filtros; libre al consumidor */
  categoria?: string;
  /** Valor numérico opcional — útil para heatmap weight o tamaño de marker */
  peso?: number;
  /** Objeto del dominio preservado para uso en tooltips/handlers */
  metadata?: T;
}

/**
 * Ruta entre 2 puntos (origen → destino).
 * Preparado para envíos/flujos logísticos futuros.
 */
export interface MapRoute<T = unknown> {
  id: string;
  origen: LatLng;
  destino: LatLng;
  label?: string;
  color?: string;
  metadata?: T;
}

/**
 * Entrada de leyenda (MapLegend).
 */
export interface LegendItem {
  label: string;
  color: string;
  count?: number;
}

/**
 * Configuración inicial del mapa (pasa a MapContainer).
 */
export interface MapInitialConfig {
  center?: LatLng;
  zoom?: number;
  /** Si true, al cambiar `points` ajusta bounds automáticamente */
  autoFit?: boolean;
  /** Padding en px para el autoFit */
  autoFitPadding?: number;
  /** Altura mínima del contenedor (por defecto 400px) */
  minHeight?: string;
  /** Desactiva POIs y transit para vista limpia */
  cleanStyles?: boolean;
}

/**
 * Presets de centros geográficos comunes.
 */
export const MAP_CENTERS = {
  PERU: { lat: -9.19, lng: -75.0152 },
  LIMA: { lat: -12.0464, lng: -77.0428 },
  USA: { lat: 39.8283, lng: -98.5795 },
  CHINA: { lat: 35.8617, lng: 104.1954 },
  COREA: { lat: 36.5, lng: 127.8 },
  AMERICAS: { lat: 0, lng: -80 },
  GLOBAL: { lat: 20, lng: 0 },
} as const;

/**
 * Paletas de color estándar por país (usable con `colorBy`).
 */
export const COUNTRY_COLORS: Record<string, string> = {
  USA: '#3B82F6',   // sky-500
  Peru: '#EF4444',  // red-500
  China: '#F59E0B', // amber-500
  Corea: '#10B981', // emerald-500
};
