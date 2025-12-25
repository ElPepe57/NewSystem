import type { Timestamp } from 'firebase/firestore';
import type { PaisAlmacen } from './almacen.types';
import type { Requerimiento } from './expectativa.types';

/**
 * ============================================================
 * TIPOS PARA GESTIÓN DE DISPONIBILIDAD DE STOCK MULTI-ALMACÉN
 * ============================================================
 *
 * Sistema de consulta y reserva de stock desde múltiples ubicaciones:
 * - Perú (almacén local): Stock disponible inmediatamente
 * - USA (almacenes/viajeros): Stock disponible pero requiere importación
 * - Virtual: Sin stock, requiere compra (genera Requerimiento)
 *
 * Flujo de prioridad:
 * 1. Perú (disponible inmediato)
 * 2. USA con viajero próximo (menor tiempo espera)
 * 3. USA sin viaje programado
 * 4. Virtual (sin stock → Requerimiento de compra)
 */

/**
 * Fuente de disponibilidad del stock
 */
export type FuenteStock =
  | 'peru'           // Stock en almacén Perú (disponible inmediato)
  | 'usa_viajero'    // Stock en USA con viajero que tiene viaje programado
  | 'usa_almacen'    // Stock en almacén USA sin viaje programado
  | 'virtual';       // Sin stock, requiere compra

/**
 * Estado de disponibilidad para reserva
 */
export type EstadoDisponibilidad =
  | 'disponible'     // Stock listo para reservar
  | 'parcial'        // Hay stock pero no suficiente
  | 'sin_stock';     // No hay stock disponible

/**
 * Disponibilidad de un producto en un almacén específico
 */
export interface DisponibilidadAlmacen {
  almacenId: string;
  almacenNombre: string;
  almacenCodigo: string;
  pais: PaisAlmacen;
  esViajero: boolean;

  // Cantidades
  unidadesDisponibles: number;
  unidadesReservadas: number;   // Ya reservadas por otras cotizaciones
  unidadesLibres: number;       // disponibles - reservadas

  // IDs de unidades disponibles (para reserva directa)
  unidadesIds: string[];

  // Costos
  costoPromedioUSD: number;     // CTRU promedio de las unidades
  costoFleteEstimadoUSD?: number; // Si es USA, costo estimado de flete

  // Tiempos (solo para USA)
  tiempoEstimadoLlegadaDias?: number;
  viajeroProximoViaje?: Timestamp;
  viajeroNombre?: string;

  // Vencimiento
  diasPromedioVencimiento?: number;
  proximaUnidadVence?: Timestamp;
}

/**
 * Disponibilidad consolidada de un producto
 * Agrupa la disponibilidad por país y almacén
 */
export interface DisponibilidadProducto {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;

  // Resumen general
  estadoDisponibilidad: EstadoDisponibilidad;
  totalDisponible: number;
  totalReservado: number;
  totalLibre: number;

  // Por país
  disponiblePeru: number;
  disponibleUSA: number;
  requiereCompra: boolean;      // true si no hay stock suficiente

  // Detalle por almacén
  almacenes: DisponibilidadAlmacen[];

  // Recomendación del sistema
  recomendacion?: RecomendacionStock;
}

/**
 * Recomendación de fuente de stock
 * El sistema sugiere de dónde tomar el stock
 */
export interface RecomendacionStock {
  fuente: FuenteStock;
  razon: string;                // "Stock disponible en Perú", "Viajero llega en 5 días", etc.

  // Detalle de la recomendación
  almacenesRecomendados: Array<{
    almacenId: string;
    almacenNombre: string;
    cantidad: number;           // Cuántas unidades tomar de este almacén
    tiempoEstimadoDias: number;
    costoEstimadoUSD: number;
  }>;

  // Si hay faltante
  cantidadFaltante?: number;
  generaRequerimiento?: boolean;

  // Alternativas
  alternativas?: Array<{
    fuente: FuenteStock;
    razon: string;
    tiempoAdicionalDias: number;
    costoAdicionalUSD?: number;
  }>;
}

/**
 * Solicitud de consulta de disponibilidad
 */
export interface ConsultaDisponibilidadRequest {
  productos: Array<{
    productoId: string;
    cantidadRequerida: number;
  }>;
  incluirRecomendacion?: boolean;  // true para incluir recomendación
  priorizarPeru?: boolean;         // true = preferir Perú aunque haya stock USA más barato
}

/**
 * Respuesta de consulta de disponibilidad
 */
export interface ConsultaDisponibilidadResponse {
  productos: DisponibilidadProducto[];
  resumen: {
    todosDisponibles: boolean;
    algunosParciales: boolean;
    algunosSinStock: boolean;
    tiempoMaximoEstimadoDias: number;
    costoTotalEstimadoUSD: number;
    requiereRequerimiento: boolean;
  };
  fechaConsulta: Timestamp;
}

// ============================================================
// TIPOS PARA RESERVA MULTI-ALMACÉN
// ============================================================

/**
 * Reserva de unidades en un almacén específico
 */
export interface ReservaAlmacen {
  almacenId: string;
  almacenNombre: string;
  almacenCodigo: string;
  pais: PaisAlmacen;
  esViajero: boolean;

  // Unidades reservadas
  unidadesIds: string[];
  cantidad: number;

  // Tiempos estimados
  tiempoEstimadoLlegadaDias?: number;
  fechaEstimadaLlegada?: Timestamp;

  // Estado
  estado: 'activa' | 'en_transito' | 'llegada' | 'cancelada';
}

/**
 * Reserva de un producto (puede incluir múltiples almacenes)
 */
export interface ReservaProductoMultiAlmacen {
  productoId: string;
  sku: string;
  nombreProducto: string;
  cantidadTotal: number;

  // Distribución por almacén
  reservasPorAlmacen: ReservaAlmacen[];

  // Resumen
  cantidadPeru: number;
  cantidadUSA: number;
  cantidadVirtual: number;       // Sin stock, genera requerimiento

  // Si hay stock virtual (sin stock)
  requerimientoId?: string;
  requerimientoNumero?: string;
}

/**
 * Extensión de ReservaStockCotizacion para multi-almacén
 * Esta estructura reemplaza/extiende la original
 */
export interface ReservaStockMultiAlmacen {
  activo: boolean;
  fechaReserva: Timestamp;
  vigenciaHasta: Timestamp;
  horasVigencia: number;

  // Productos con sus reservas multi-almacén
  productos: ReservaProductoMultiAlmacen[];

  // Resumen global
  resumen: {
    totalUnidades: number;
    unidadesPeru: number;
    unidadesUSA: number;
    unidadesVirtual: number;
    tiempoMaximoLlegadaDias: number;
    fechaEstimadaCompleta?: Timestamp;
  };

  // Si hay stock virtual (sin stock físico)
  requerimientosGenerados?: Array<{
    id: string;
    numero: string;             // REQ-2025-XXX
    productos: string[];        // SKUs incluidos
    fechaEstimada?: Timestamp;
    estado?: Requerimiento['estado'];
  }>;

  // Referencia a cotización origen
  cotizacionOrigenId?: string;
  cotizacionOrigenNumero?: string;
}

// ============================================================
// TIPOS PARA CONFIGURACIÓN Y PREFERENCIAS
// ============================================================

/**
 * Configuración de prioridad de almacenes
 */
export interface ConfiguracionPrioridadStock {
  // Orden de prioridad (1 = más prioritario)
  prioridadPeru: number;
  prioridadUSAConViaje: number;
  prioridadUSASinViaje: number;

  // Umbrales
  diasMaximoEsperaUSA: number;  // Días máximos para esperar stock USA
  costoFleteMaximoUSD: number;  // Costo máximo de flete por unidad

  // Preferencias
  preferirPeruSiDisponible: boolean;
  permitirMezclaAlmacenes: boolean;
  generarRequerimientoAutomatico: boolean;
}

/**
 * Criterios para selección inteligente de almacén
 */
export interface CriteriosSeleccionAlmacen {
  // Peso de cada criterio (0-100, suma = 100)
  pesoDisponibilidadInmediata: number;  // Perú > USA
  pesoCostoTotal: number;               // Menor costo total (incluye flete)
  pesoTiempoEntrega: number;            // Menor tiempo
  pesoVencimiento: number;              // Productos más próximos a vencer
}
