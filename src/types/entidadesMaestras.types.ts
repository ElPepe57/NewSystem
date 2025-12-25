import type { Timestamp } from 'firebase/firestore';

/**
 * ===============================================
 * ENTIDADES MAESTRAS DEL SISTEMA
 * ===============================================
 *
 * Gestión centralizada de:
 * - Clientes
 * - Marcas
 * - Proveedores (ya existe en ordenCompra.types.ts)
 * - Almacenes/Viajeros (ya existe en almacen.types.ts)
 */

// ===============================================
// CLIENTE
// ===============================================

export type TipoCliente = 'persona' | 'empresa';
export type CanalOrigen = 'whatsapp' | 'facebook' | 'instagram' | 'mercadolibre' | 'referido' | 'web' | 'otro';
export type EstadoCliente = 'activo' | 'inactivo' | 'potencial';

// ========== CRM - CLASIFICACIÓN ABC ==========

/**
 * Clasificación ABC basada en el principio de Pareto (80/20)
 * - A: Top 20% de clientes que generan ~80% de ingresos
 * - B: Siguiente 30% que genera ~15% de ingresos
 * - C: Restante 50% que genera ~5% de ingresos
 * - nuevo: Clientes sin historial de compras
 */
export type ClasificacionABC = 'A' | 'B' | 'C' | 'nuevo';

/**
 * Segmento de cliente basado en comportamiento
 * Combinación de frecuencia, recencia y valor
 */
export type SegmentoCliente =
  | 'vip'         // A + Alta frecuencia + Reciente
  | 'premium'     // A + Frecuencia media
  | 'frecuente'   // B + Alta frecuencia
  | 'regular'     // B + Frecuencia media
  | 'ocasional'   // C + Cualquier frecuencia
  | 'nuevo'       // Sin compras o primera compra reciente
  | 'inactivo'    // Última compra hace >90 días
  | 'en_riesgo'   // Era frecuente pero dejó de comprar
  | 'perdido';    // Última compra hace >180 días

/**
 * Análisis RFM (Recency, Frequency, Monetary)
 */
export interface AnalisisRFM {
  recencia: number;           // Días desde última compra
  frecuencia: number;         // Compras en los últimos 365 días
  valorMonetario: number;     // Monto total en los últimos 365 días
  scoreRecencia: number;      // 1-5 (5 = más reciente)
  scoreFrecuencia: number;    // 1-5 (5 = más frecuente)
  scoreMonetario: number;     // 1-5 (5 = mayor valor)
  scoreTotal: number;         // Promedio de los 3 scores
}

/**
 * Historial de clasificación del cliente
 */
export interface HistorialClasificacion {
  fecha: Timestamp;
  clasificacionAnterior: ClasificacionABC;
  clasificacionNueva: ClasificacionABC;
  segmentoAnterior: SegmentoCliente;
  segmentoNuevo: SegmentoCliente;
  motivo?: string;
}

/**
 * Dirección del cliente (para múltiples direcciones de entrega)
 */
export interface DireccionCliente {
  id: string;
  etiqueta: string;           // "Casa", "Oficina", "Mamá", etc.
  direccion: string;
  distrito?: string;
  ciudad?: string;
  referencia?: string;
  esPrincipal: boolean;
}

/**
 * Cliente del negocio
 * Centraliza información de compradores para auditoría y CRM
 */
export interface Cliente {
  id: string;
  codigo: string;                    // CLI-001, CLI-002, etc.

  // Identificación
  nombre: string;             // Nombre completo o razón social
  nombreCorto?: string;       // Apodo o nombre corto para display
  tipoCliente: TipoCliente;
  dniRuc?: string;            // DNI (8 dígitos) o RUC (11 dígitos)

  // Contacto
  telefono?: string;          // Teléfono principal (WhatsApp)
  telefonoAlt?: string;       // Teléfono alternativo
  email?: string;

  // Direcciones
  direcciones: DireccionCliente[];
  direccionPrincipal?: string; // Snapshot de dirección principal para display rápido

  // Origen y marketing
  canalOrigen: CanalOrigen;   // Cómo llegó el cliente
  referidoPor?: string;       // Si fue referido, por quién

  // Estado
  estado: EstadoCliente;

  // Métricas (desnormalizadas para reportes rápidos)
  metricas: {
    totalCompras: number;           // Cantidad de compras
    montoTotalPEN: number;          // Suma de todas las compras
    ultimaCompra?: Timestamp;       // Fecha de última compra
    ticketPromedio: number;         // Promedio por compra
    productosFavoritos?: string[];  // IDs de productos más comprados
    // Métricas adicionales para CRM
    comprasUltimos30Dias?: number;
    comprasUltimos90Dias?: number;
    comprasUltimos365Dias?: number;
    montoUltimos365Dias?: number;
  };

  // ========== CRM - Clasificación ==========
  clasificacionABC?: ClasificacionABC;
  segmento?: SegmentoCliente;
  analisisRFM?: AnalisisRFM;
  historialClasificacion?: HistorialClasificacion[];
  fechaUltimaClasificacion?: Timestamp;

  // Notas internas (CRM básico)
  notas?: string;
  etiquetas?: string[];       // Tags para segmentación: "mayorista", "puntual", "frecuente"

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Datos mínimos del cliente para desnormalizar en Venta
 * Evita JOINs pero mantiene datos actualizados en snapshot
 */
export interface ClienteSnapshot {
  clienteId: string;
  nombre: string;
  telefono?: string;
  email?: string;
  dniRuc?: string;
}

/**
 * FormData para crear/editar cliente
 */
export interface ClienteFormData {
  nombre: string;
  nombreCorto?: string;
  tipoCliente: TipoCliente;
  dniRuc?: string;
  telefono?: string;
  telefonoAlt?: string;
  email?: string;
  direcciones?: Omit<DireccionCliente, 'id'>[];
  canalOrigen: CanalOrigen;
  referidoPor?: string;
  notas?: string;
  etiquetas?: string[];
}

/**
 * Filtros para búsqueda de clientes
 */
export interface ClienteFiltros {
  busqueda?: string;          // Búsqueda por nombre, teléfono, DNI
  tipoCliente?: TipoCliente;
  canalOrigen?: CanalOrigen;
  estado?: EstadoCliente;
  etiqueta?: string;
  conCompras?: boolean;       // Solo clientes con al menos 1 compra
  ordenarPor?: 'nombre' | 'ultimaCompra' | 'montoTotal' | 'fechaCreacion';
  orden?: 'asc' | 'desc';
}

// ===============================================
// MARCA
// ===============================================

export type EstadoMarca = 'activa' | 'inactiva' | 'descontinuada';
export type TipoMarca = 'farmaceutica' | 'suplementos' | 'cosmetica' | 'tecnologia' | 'otro';

/**
 * Marca de productos
 * Centraliza información de marcas para estandarización y reportes
 */
export interface Marca {
  id: string;
  codigo: string;                    // MRC-001, MRC-002, etc.

  // Identificación
  nombre: string;             // Nombre oficial: "Pfizer", "NOW Foods", etc.
  nombreNormalizado: string;  // En minúsculas sin acentos para búsqueda: "pfizer"
  alias?: string[];           // Nombres alternativos: ["Phizer", "Pfiizer"] para match

  // Información
  descripcion?: string;
  paisOrigen?: string;        // País de origen de la marca
  tipoMarca: TipoMarca;
  sitioWeb?: string;

  // Visual
  logoUrl?: string;
  colorPrimario?: string;     // Para UI consistente

  // Estado
  estado: EstadoMarca;

  // Métricas (desnormalizadas para reportes rápidos)
  metricas: {
    productosActivos: number;       // Cantidad de productos de esta marca
    unidadesVendidas: number;       // Total histórico
    ventasTotalPEN: number;         // Facturación total
    margenPromedio: number;         // Margen promedio %
    ultimaVenta?: Timestamp;
  };

  // Relaciones con proveedores preferidos
  proveedoresPreferidos?: Array<{
    proveedorId: string;
    nombreProveedor: string;
    esPrincipal: boolean;
  }>;

  // Notas internas
  notas?: string;

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Datos mínimos de marca para desnormalizar en Producto/Venta
 */
export interface MarcaSnapshot {
  marcaId: string;
  nombre: string;
}

/**
 * FormData para crear/editar marca
 */
export interface MarcaFormData {
  nombre: string;
  alias?: string[];
  descripcion?: string;
  paisOrigen?: string;
  tipoMarca: TipoMarca;
  sitioWeb?: string;
  logoUrl?: string;
  colorPrimario?: string;
  proveedoresPreferidos?: Array<{
    proveedorId: string;
    nombreProveedor: string;
    esPrincipal: boolean;
  }>;
  notas?: string;
}

/**
 * Filtros para búsqueda de marcas
 */
export interface MarcaFiltros {
  busqueda?: string;          // Búsqueda por nombre o alias
  tipoMarca?: TipoMarca;
  estado?: EstadoMarca;
  paisOrigen?: string;
  conProductos?: boolean;     // Solo marcas con productos activos
  ordenarPor?: 'nombre' | 'productosActivos' | 'ventasTotal' | 'fechaCreacion';
  orden?: 'asc' | 'desc';
}

// ===============================================
// ESTADÍSTICAS Y REPORTES
// ===============================================

/**
 * Estadísticas de clientes para dashboard
 */
export interface ClienteStats {
  totalClientes: number;
  clientesActivos: number;
  clientesNuevosMes: number;
  clientesConCompras: number;
  ticketPromedioGeneral: number;

  // Top clientes
  topClientesPorMonto: Array<{
    clienteId: string;
    nombre: string;
    montoTotalPEN: number;
  }>;

  // Por canal
  clientesPorCanal: Record<CanalOrigen, number>;

  // ========== CRM - Clasificación ABC ==========
  clientesPorClasificacion?: Record<ClasificacionABC, number>;
  clientesPorSegmento?: Record<SegmentoCliente, number>;
  clientesEnRiesgo?: number;
  clientesPerdidos?: number;
  valorClientesA?: number;      // % del valor total que representa el grupo A
  valorClientesB?: number;      // % del valor total que representa el grupo B
  valorClientesC?: number;      // % del valor total que representa el grupo C
}

/**
 * Estadísticas de marcas para dashboard
 */
export interface MarcaStats {
  totalMarcas: number;
  marcasActivas: number;
  marcasConProductos: number;

  // Top marcas
  topMarcasPorVentas: Array<{
    marcaId: string;
    nombre: string;
    ventasTotalPEN: number;
    margenPromedio: number;
  }>;

  topMarcasPorMargen: Array<{
    marcaId: string;
    nombre: string;
    margenPromedio: number;
    ventasTotalPEN: number;
  }>;

  // Por tipo
  marcasPorTipo: Record<TipoMarca, number>;
}

// ===============================================
// COMPETIDORES
// ===============================================

export type PlataformaCompetidor = 'mercado_libre' | 'web_propia' | 'inkafarma' | 'mifarma' | 'amazon' | 'falabella' | 'otra';
export type ReputacionCompetidor = 'excelente' | 'buena' | 'regular' | 'mala' | 'desconocida';
export type EstadoCompetidor = 'activo' | 'inactivo' | 'cerrado';

/**
 * Competidor del negocio
 * Centraliza información de competidores para análisis de mercado
 */
export interface Competidor {
  id: string;
  codigo: string;                    // CMP-001, CMP-002, etc.

  // Identificación
  nombre: string;             // Nombre del vendedor o tienda
  nombreNormalizado: string;  // En minúsculas sin acentos para búsqueda
  alias?: string[];           // Nombres alternativos

  // Información de negocio
  plataformaPrincipal: PlataformaCompetidor;
  plataformas: PlataformaCompetidor[];  // Puede estar en múltiples plataformas
  urlTienda?: string;         // URL principal de la tienda
  urlMercadoLibre?: string;   // Perfil de MercadoLibre si aplica

  // Ubicación
  ciudad?: string;
  departamento?: string;

  // Métricas
  reputacion: ReputacionCompetidor;
  ventasEstimadas?: number;    // Ventas mensuales estimadas
  cantidadProductos?: number;  // Cantidad de productos que vende
  esLiderCategoria?: boolean;  // Si es líder en alguna categoría
  categoriasLider?: string[];  // En qué categorías es líder

  // Análisis
  fortalezas?: string;        // Puntos fuertes del competidor
  debilidades?: string;       // Puntos débiles
  estrategiaPrecio?: 'premium' | 'competitivo' | 'bajo' | 'variable';
  nivelAmenaza: 'bajo' | 'medio' | 'alto';

  // Notas
  notas?: string;

  // Estado
  estado: EstadoCompetidor;

  // Métricas calculadas
  metricas: {
    productosAnalizados: number;     // Cuántos productos hemos comparado con este competidor
    precioPromedio: number;          // Precio promedio de sus productos (PEN)
    ultimaActualizacion?: Timestamp;
  };

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Datos para crear/editar un competidor
 */
export interface CompetidorFormData {
  nombre: string;
  plataformaPrincipal: PlataformaCompetidor;
  plataformas?: PlataformaCompetidor[];
  urlTienda?: string;
  urlMercadoLibre?: string;
  ciudad?: string;
  departamento?: string;
  reputacion?: ReputacionCompetidor;
  ventasEstimadas?: number;
  esLiderCategoria?: boolean;
  categoriasLider?: string[];
  fortalezas?: string;
  debilidades?: string;
  estrategiaPrecio?: 'premium' | 'competitivo' | 'bajo' | 'variable';
  nivelAmenaza?: 'bajo' | 'medio' | 'alto';
  notas?: string;
}

/**
 * Snapshot de competidor para uso en investigaciones
 */
export interface CompetidorSnapshot {
  competidorId: string;
  codigo: string;
  nombre: string;
  plataformaPrincipal: PlataformaCompetidor;
  reputacion: ReputacionCompetidor;
}

// ===============================================
// UTILIDADES
// ===============================================

/**
 * Resultado de búsqueda de duplicados
 */
export interface DuplicadoEncontrado<T> {
  entidad: T;
  campo: string;              // Campo que coincide: "dniRuc", "telefono", "nombre"
  valorCoincidente: string;
  similitud: number;          // 0-100%, 100 = exacto
}

/**
 * Resultado de normalización de texto
 */
export interface TextoNormalizado {
  original: string;
  normalizado: string;        // Sin acentos, minúsculas
  tokens: string[];           // Palabras separadas
}
