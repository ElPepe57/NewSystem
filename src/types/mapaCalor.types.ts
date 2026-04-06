import { Timestamp } from 'firebase/firestore';

// ============================================
// MAPA DE CALOR DE VENTAS — GeoAnalytics 360
// ============================================

export interface Coordenadas {
  lat: number;
  lng: number;
}

/** Venta con datos geográficos (proyección ligera para el mapa) */
export interface VentaGeo {
  id: string;
  codigo: string;
  coordenadas: Coordenadas;
  totalPEN: number;
  lineaNegocioId: string;
  distrito?: string;
  provincia?: string;
  clienteId?: string;
  clienteNombre?: string;
  productos: { nombre: string; cantidad: number }[];
  fechaCreacion: Timestamp;
}

/** Resumen agregado por zona (distrito + provincia) */
export interface ZonaResumen {
  key: string;                // distrito-provincia (unique key)
  distrito: string;
  provincia: string;
  totalVentas: number;        // cantidad de ventas
  volumenPEN: number;         // suma totalPEN
  ticketPromedio: number;     // volumenPEN / totalVentas
  clientesUnicos: number;
  productosTop: { nombre: string; cantidad: number }[];
  distribucionLinea: { lineaNegocioId: string; porcentaje: number }[];
  coordenadasCentro: Coordenadas; // promedio de coordenadas de ventas en la zona
}

/** Filtros del mapa */
export interface FiltrosMapaCalor {
  periodoPreset: PeriodoPresetMapa;
  fechaInicio: Date;
  fechaFin: Date;
  lineaNegocioId: string | null;  // null = todas
  distritos: string[];            // filtro por distritos específicos
}

export type PeriodoPresetMapa = 'hoy' | 'semana' | 'mes' | '3meses' | '6meses' | 'todo' | 'custom';

export type CapaMapa = 'heatmap' | 'clusters' | 'marcadores';

/** KPIs del dashboard del mapa */
export interface MapaCalorKPIData {
  zonasActivas: number;
  provinciasActivas: number;
  volumenTotalPEN: number;
  ticketPromedio: number;
  zonaTopVolumen: { distrito: string; provincia: string; volumen: number } | null;
  ventasGeolocalizadas: number;
  ventasTotales: number;
  porcentajeCobertura: number;
}
