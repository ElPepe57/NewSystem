import { Timestamp } from 'firebase/firestore';

/**
 * Tipo de almacén / agente logístico
 * - viajero: Persona que almacena y transporta a Perú (modelo USA principal)
 * - courier: Servicio courier internacional (China, Corea, etc.)
 * - almacen_origen: Almacén en país de origen (no viajero)
 * - almacen_peru: Almacén en Perú
 */
export type TipoAlmacen = 'viajero' | 'courier' | 'almacen_origen' | 'almacen_peru';

/**
 * Estado del almacén/viajero
 */
export type EstadoAlmacen = 'activo' | 'inactivo' | 'suspendido';

/**
 * Clasificación de almacén/viajero basada en evaluación
 */
export type ClasificacionAlmacen =
  | 'excelente'     // >=80 pts
  | 'bueno'         // 60-79 pts
  | 'regular'       // 40-59 pts
  | 'deficiente';   // <40 pts

/**
 * Factores de evaluación del almacén/viajero
 */
export interface FactoresEvaluacionAlmacen {
  conservacionProductos: number;  // 0-25 (% sin daños)
  tiempoRespuesta: number;        // 0-25 (rapidez en procesar)
  cumplimientoFechas: number;     // 0-25 (viajes a tiempo)
  comunicacion: number;           // 0-25 (disponibilidad)
}

/**
 * Evaluación del almacén/viajero
 */
export interface EvaluacionAlmacen {
  puntuacion: number;               // 0-100
  clasificacion: ClasificacionAlmacen;
  factores: FactoresEvaluacionAlmacen;
  ultimoCalculo: Timestamp;
  calculoAutomatico: boolean;
}

/**
 * Historial de evaluación del almacén
 */
export interface HistorialEvaluacionAlmacen {
  fecha: Timestamp;
  puntuacion: number;
  factores: FactoresEvaluacionAlmacen;
  notas?: string;
  evaluadoPor: string;
}

/**
 * Métricas operativas del almacén/viajero
 */
export interface MetricasOperativasAlmacen {
  transferenciasRecibidas: number;
  transferenciasEnviadas: number;
  productosAlmacenados: number;
  incidenciasReportadas: number;
  tasaIncidencias: number;          // %
  tiempoPromedioAlmacenaje: number; // días
  // Para viajeros
  viajesRealizados?: number;
  viajesATiempo?: number;
  tasaPuntualidadViajes?: number;   // %
  capacidadUtilizadaPromedio?: number; // %
}

/**
 * País del almacén
 * Extensible: se pueden agregar más países según necesidad.
 * Los valores legacy 'USA' | 'Peru' se mantienen para backward compat.
 */
export type PaisAlmacen = 'USA' | 'Peru' | 'China' | 'Corea' | 'Peru_local';

/**
 * Configuración de país para display y lógica
 */
export const PAISES_CONFIG: Record<string, { nombre: string; emoji: string; esOrigen: boolean; monedaDefault: string }> = {
  USA:        { nombre: 'Estados Unidos', emoji: '🇺🇸', esOrigen: true, monedaDefault: 'USD' },
  China:      { nombre: 'China',          emoji: '🇨🇳', esOrigen: true, monedaDefault: 'USD' },
  Corea:      { nombre: 'Corea del Sur',  emoji: '🇰🇷', esOrigen: true, monedaDefault: 'USD' },
  Peru:       { nombre: 'Perú',           emoji: '🇵🇪', esOrigen: false, monedaDefault: 'PEN' },
  Peru_local: { nombre: 'Perú (local)',   emoji: '🇵🇪', esOrigen: false, monedaDefault: 'PEN' },
};

/**
 * Frecuencia de viajes (solo para tipo viajero)
 */
export type FrecuenciaViaje = 'semanal' | 'quincenal' | 'mensual' | 'bimestral' | 'variable';

/**
 * Almacén / Viajero / Courier
 * Entidad que almacena productos en el país de origen y los transporta a Perú.
 * - Viajero: persona en USA que trae productos (modelo original)
 * - Courier: servicio de envío internacional (China, Corea, USA, etc.)
 * - Almacén origen: almacén en país de origen (sin viajero)
 * - Almacén Perú: almacén de inventario local
 */
export interface Almacen {
  id: string;
  codigo: string;                    // VIA-001, ALM-PERU-01, etc.
  nombre: string;                    // "Juan Pérez", "Almacén Lima"
  pais: PaisAlmacen;
  tipo: TipoAlmacen;
  estadoAlmacen: EstadoAlmacen;

  // Ubicación
  direccion: string;
  ciudad: string;
  estado?: string;                   // Estado/Región (Florida, California, etc.)
  codigoPostal?: string;

  // Contacto
  contacto?: string;                 // Nombre del contacto (si es diferente al nombre)
  telefono?: string;
  email?: string;
  whatsapp?: string;

  // Capacidad
  capacidadUnidades?: number;        // Máximo de unidades que puede almacenar
  unidadesActuales?: number;         // Unidades actualmente almacenadas

  // === ESPECÍFICO PARA VIAJEROS ===
  esViajero: boolean;                // true si este almacén es un viajero
  frecuenciaViaje?: FrecuenciaViaje;
  proximoViaje?: Timestamp;          // Fecha estimada del próximo viaje

  // Costos del viajero (para referencia, el costo real está en Producto)
  costoPromedioFlete?: number;       // Costo promedio por unidad USD

  // === MÉTRICAS ===
  // Total de unidades que ha recibido históricamente
  totalUnidadesRecibidas: number;
  // Total de unidades que ha enviado a Perú
  totalUnidadesEnviadas: number;
  // Valor actual del inventario en este almacén (USD)
  valorInventarioUSD: number;
  // Tiempo promedio que las unidades pasan en este almacén (días)
  tiempoPromedioAlmacenamiento: number;

  // ========== Evaluación del Almacén/Viajero ==========
  evaluacion?: EvaluacionAlmacen;
  evaluacionesHistorial?: HistorialEvaluacionAlmacen[];
  metricasOperativas?: MetricasOperativasAlmacen;

  // Notas
  notas?: string;

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Datos para crear o actualizar un Almacén/Viajero
 * El código se genera automáticamente según el tipo:
 * - Viajero: VIA-001, VIA-002...
 * - Almacén USA: ALM-USA-001...
 * - Almacén Perú: ALM-PE-001...
 */
export interface AlmacenFormData {
  codigo?: string;  // Solo para visualización, se genera automáticamente
  nombre: string;
  pais: PaisAlmacen;
  tipo: TipoAlmacen;
  estadoAlmacen: EstadoAlmacen;

  // Ubicación
  direccion: string;
  ciudad: string;
  estado?: string;
  codigoPostal?: string;

  // Contacto
  contacto?: string;
  telefono?: string;
  email?: string;
  whatsapp?: string;

  // Capacidad
  capacidadUnidades?: number;

  // Viajero
  esViajero: boolean;
  frecuenciaViaje?: FrecuenciaViaje;
  proximoViaje?: Date;
  costoPromedioFlete?: number;

  notas?: string;
}

/**
 * Resumen de inventario por almacén
 */
export interface InventarioAlmacen {
  almacenId: string;
  almacenNombre: string;
  almacenCodigo: string;
  pais: PaisAlmacen;
  esViajero: boolean;

  // Conteo de unidades
  totalUnidades: number;
  unidadesDisponibles: number;      // Estado: recibida_usa o disponible_peru
  unidadesEnTransito: number;       // Estado: en_transito (salieron de este almacén)

  // Valor
  valorTotalUSD: number;
  valorTotalPEN: number;

  // Tiempo
  tiempoPromedioAlmacenamiento: number;  // Días promedio
  unidadMasAntigua?: {
    id: string;
    sku: string;
    diasEnAlmacen: number;
  };

  // Desglose por producto
  productosPorSKU: {
    productoId: string;
    sku: string;
    nombre: string;
    cantidad: number;
    valorUSD: number;
  }[];
}

/**
 * Estadísticas generales de almacenes USA
 * @deprecated Usar ResumenAlmacenesPorPais en su lugar
 */
export interface ResumenAlmacenesUSA {
  totalAlmacenes: number;
  totalViajeros: number;

  // Inventario total en USA
  totalUnidadesUSA: number;
  valorTotalUSA_USD: number;

  // Por almacén
  inventarioPorAlmacen: InventarioAlmacen[];

  // Alertas
  almacenesConCapacidadAlta: Almacen[];  // >80% capacidad
  unidadesConMuchotiempo: {              // >30 días en almacén
    almacenId: string;
    almacenNombre: string;
    cantidad: number;
  }[];
}

/**
 * Estadísticas generales de almacenes por país (genérico, reemplaza ResumenAlmacenesUSA)
 */
export interface ResumenAlmacenesPorPais {
  pais: PaisAlmacen;
  paisNombre: string;
  paisEmoji: string;
  totalAlmacenes: number;
  totalViajerosCouriers: number;

  // Inventario total en este país
  totalUnidades: number;
  valorTotalUSD: number;

  // Por almacén
  inventarioPorAlmacen: InventarioAlmacen[];

  // Alertas
  almacenesConCapacidadAlta: Almacen[];
  unidadesConMuchotiempo: {
    almacenId: string;
    almacenNombre: string;
    cantidad: number;
  }[];
}
