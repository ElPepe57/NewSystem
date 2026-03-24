import { Timestamp } from 'firebase/firestore';

/**
 * Estado del requerimiento
 */
export type EstadoRequerimiento =
  | 'borrador'              // En proceso de creación
  | 'pendiente'             // Recién creado, sin asignar
  | 'pendiente_aprobacion'  // Monto > $1,000 — requiere aprobación dual (gerente + admin)
  | 'aprobado'              // Aprobado para compra
  | 'parcial'               // Algunos productos en OC, otros pendientes
  | 'en_proceso'            // En proceso de compra/envío (todos los productos en OC)
  | 'completado'            // Todos los productos recibidos en Perú
  | 'cancelado';            // Cancelado

/**
 * Umbral de monto que requiere aprobación dual (en USD)
 */
export const UMBRAL_APROBACION_DUAL_USD = 1000;

/**
 * Prioridad del requerimiento
 */
export type PrioridadRequerimiento = 'baja' | 'normal' | 'media' | 'alta' | 'urgente';

/**
 * Origen del requerimiento
 */
export type OrigenRequerimiento =
  | 'venta_pendiente'     // Desde cotización con productos sin stock
  | 'stock_minimo'        // Alerta de stock mínimo
  | 'proyeccion'          // Proyección de demanda
  | 'manual';             // Creación manual

/**
 * Tipo de solicitante del requerimiento
 */
export type TipoSolicitante =
  | 'cliente'           // Pedido por un cliente específico
  | 'interno'           // Interno (administración/equipo)
  | 'administracion'    // Por administración
  | 'ventas'            // Por equipo de ventas
  | 'stock_minimo'      // Por alerta de stock mínimo
  | 'investigacion';    // Producto encontrado en investigación de mercado

/**
 * Estado de una asignación de responsable
 */
export type EstadoAsignacion =
  | 'pendiente'           // Asignado pero no ha iniciado
  | 'comprando'           // Responsable está comprando en origen
  | 'comprado'            // Productos comprados, esperando recibir
  | 'en_almacen_origen'   // Productos en almacén/viajero/courier del país origen
  | 'en_almacen_usa'      // Legacy: equivale a en_almacen_origen (backward compat)
  | 'en_transito'         // En camino a Perú (transferencia activa)
  | 'recibido'            // Recibido en Perú
  | 'cancelado';          // Esta asignación fue cancelada

/**
 * Arrays de compatibilidad para queries
 */
export const ESTADOS_EN_ALMACEN_ORIGEN: EstadoAsignacion[] = ['en_almacen_origen', 'en_almacen_usa'];

/**
 * Producto dentro de una asignación
 * Permite que cada responsable traiga cantidades diferentes de cada producto
 */
export interface ProductoAsignado {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  cantidadAsignada: number;         // Cuántas unidades trae este responsable
  cantidadRecibida: number;         // Cuántas ya llegaron a Perú
  precioCompraUSD?: number;         // Precio real de compra (cuando se conozca)
  ordenCompraId?: string;           // OC donde se compró (si aplica)
}

/**
 * Asignación de responsable/viajero
 * Un requerimiento puede tener múltiples asignaciones
 */
export interface AsignacionResponsable {
  id: string;                         // ID único de la asignación

  // Responsable (viajero/almacén)
  responsableId: string;              // ID del almacén/viajero
  responsableNombre: string;          // Nombre desnormalizado
  responsableCodigo: string;          // Código (VIA-001, etc.)
  esViajero: boolean;                 // true si es viajero

  // Productos asignados a este responsable
  productos: ProductoAsignado[];

  // Estado de la asignación
  estado: EstadoAsignacion;

  // Fechas
  fechaAsignacion: Timestamp;
  fechaEstimadaCompra?: Timestamp;    // Cuándo comprará
  fechaCompra?: Timestamp;            // Cuándo compró realmente
  fechaEstimadaLlegada?: Timestamp;   // Cuándo llegará a Perú
  fechaRecepcion?: Timestamp;         // Cuándo se recibió en Perú

  // Referencias
  ordenCompraId?: string;             // OC asociada (si se creó una)
  ordenCompraNumero?: string;
  transferenciaId?: string;           // Transferencia USA→Perú
  transferenciaNumero?: string;

  // Costos
  costoEstimadoUSD?: number;          // Estimado de compra
  costoRealUSD?: number;              // Costo real de compra
  costoFleteUSD?: number;             // Costo del flete

  // Notas
  notas?: string;

  // Auditoría
  asignadoPor: string;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Referencia de una OC vinculada a un producto
 */
export interface OrdenCompraRef {
  ordenCompraId: string;
  ordenCompraNumero: string;
  cantidad: number;
}

/**
 * Resumen de cobertura OC del requerimiento
 */
export interface OCCoverage {
  totalProductos: number;           // Total de productos distintos
  productosEnOC: number;            // Productos con cantidadEnOC > 0
  productosPendientes: number;      // Productos con pendienteCompra > 0
  porcentaje: number;               // 0-100, cobertura ponderada por cantidad
}

/**
 * Producto solicitado en el requerimiento
 */
export interface ProductoRequerimiento {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion?: string;
  contenido?: string;               // e.g. "60 cápsulas", "500g"
  dosaje?: string;                  // e.g. "150mg", "1000 UI"
  sabor?: string;                   // e.g. "Limón", "Fresa", "Natural"

  // Cantidades
  cantidadSolicitada: number;         // Total que se necesita
  cantidadAsignada: number;           // Suma de asignaciones activas
  cantidadRecibida: number;           // Suma de lo que ya llegó a Perú
  cantidadPendiente: number;          // cantidadSolicitada - cantidadAsignada

  // Tracking OC parcial
  cantidadEnOC: number;               // Cuánto ya está asignado a OCs creadas
  pendienteCompra: number;            // cantidadSolicitada - cantidadEnOC
  ordenCompraRefs?: OrdenCompraRef[]; // A qué OCs fue asignado este producto

  // Precios de referencia (de investigación de mercado)
  precioEstimadoUSD?: number;         // Precio estimado de compra
  precioVentaPEN?: number;            // Precio al que se venderá
  fechaInvestigacion?: Timestamp;
  proveedorSugerido?: string;         // Proveedor sugerido (Amazon, etc.)
  urlReferencia?: string;             // Link de referencia

  // Estado del producto en el requerimiento
  completado: boolean;                // cantidadRecibida >= cantidadSolicitada
}

/**
 * Expectativa de costos del requerimiento
 */
export interface ExpectativaRequerimiento {
  tcInvestigacion: number;            // TC al momento de crear
  costoEstimadoUSD: number;           // Costo total estimado de productos
  costoEstimadoPEN: number;
  impuestoEstimadoUSD?: number;
  fleteEstimadoUSD?: number;
  costoTotalEstimadoUSD: number;
  costoTotalEstimadoPEN: number;
}

/**
 * Resumen de asignaciones para vista rápida
 */
export interface ResumenAsignaciones {
  totalResponsables: number;          // Cuántos responsables asignados
  responsablesActivos: number;        // Con estado != cancelado
  productosAsignados: number;         // Suma de productos asignados
  productosRecibidos: number;         // Suma de productos recibidos
  porcentajeCompletado: number;       // % de avance
}

/**
 * Requerimiento de compra
 */
export interface Requerimiento {
  id: string;
  numeroRequerimiento: string;        // REQ-YYYY-NNNN

  // Origen y solicitante
  origen: OrigenRequerimiento;
  tipoSolicitante: TipoSolicitante;
  nombreSolicitante?: string;         // Nombre del cliente o área
  nombreClienteSolicitante?: string;  // Alias legacy (si tipoSolicitante === 'cliente')

  // Referencias
  cotizacionId?: string;              // Cotización que lo originó
  cotizacionNumero?: string;
  ventaId?: string;                   // Venta asociada (cuando se confirme)
  ventaNumero?: string;
  ventaRelacionadaId?: string;        // Si es por venta pendiente
  clienteId?: string;
  clienteNombre?: string;

  // === LÍNEA DE NEGOCIO Y ORIGEN ===
  lineaNegocioId?: string;
  lineaNegocioNombre?: string;
  paisOrigenPrincipal?: string;          // 'USA', 'China', 'Corea', 'Peru'

  // Productos solicitados
  productos: ProductoRequerimiento[];

  // === ASIGNACIONES MÚLTIPLES ===
  asignaciones: AsignacionResponsable[];
  resumenAsignaciones?: ResumenAsignaciones;

  // Expectativa de costos
  expectativa?: ExpectativaRequerimiento;

  // Estado y prioridad
  estado: EstadoRequerimiento;
  prioridad: PrioridadRequerimiento;

  // Relación con OC (cuando se genera) — legacy singular
  ordenCompraId?: string;
  ordenCompraNumero?: string;

  // Multi-OC support (OC parcial + fusión)
  ordenCompraIds?: string[];
  ordenCompraNumeros?: string[];
  ocCoverage?: OCCoverage;

  // Fechas
  fechaRequerida?: Timestamp;         // Fecha límite de necesidad
  fechaSolicitud: Timestamp;
  fechaAprobacion?: Timestamp;
  fechaCompletado?: Timestamp;

  // Notas
  justificacion?: string;
  observaciones?: string;

  // Auditoría
  solicitadoPor: string;
  aprobadoPor?: string;
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;

  // Aprobación dual (para montos > UMBRAL_APROBACION_DUAL_USD)
  requiereAprobacionDual?: boolean;
  aprobaciones?: {
    gerente?: { aprobadoPor: string; fecha: Timestamp };
    admin?: { aprobadoPor: string; fecha: Timestamp };
  };
  montoEstimadoUSD?: number;
}

/**
 * Datos para crear un requerimiento
 */
export interface RequerimientoFormData {
  origen: OrigenRequerimiento;
  tipoSolicitante: TipoSolicitante;
  nombreSolicitante?: string;
  nombreClienteSolicitante?: string;  // Legacy alias

  cotizacionId?: string;
  cotizacionNumero?: string;
  ventaRelacionadaId?: string;        // Si es por venta pendiente
  clienteId?: string;
  clienteNombre?: string;

  productos: {
    productoId: string;
    sku?: string;
    marca?: string;
    nombreComercial?: string;
    presentacion?: string;
    contenido?: string;
    dosaje?: string;
    sabor?: string;
    cantidadSolicitada: number;
    precioEstimadoUSD?: number;
    precioVentaPEN?: number;
    impuestoPorcentaje?: number;      // % de sales tax USA
    logisticaEstimadaUSD?: number;    // Costo logístico por unidad
    ctruEstimado?: number;            // CTRU ya calculado
    proveedorSugerido?: string;
    urlReferencia?: string;
  }[];

  expectativa?: ExpectativaRequerimiento;

  prioridad: PrioridadRequerimiento;
  fechaRequerida?: Date;
  justificacion?: string;
  observaciones?: string;
}

/**
 * Datos para asignar un responsable
 */
export interface AsignarResponsableData {
  responsableId: string;              // ID del almacén/viajero

  // Productos que trae este responsable
  productos: {
    productoId: string;
    cantidadAsignada: number;
  }[];

  fechaEstimadaCompra?: Date;
  fechaEstimadaLlegada?: Date;
  costoEstimadoUSD?: number;
  notas?: string;
}

/**
 * Datos para actualizar una asignación
 */
export interface ActualizarAsignacionData {
  estado?: EstadoAsignacion;
  fechaCompra?: Date;
  fechaEstimadaLlegada?: Date;
  fechaRecepcion?: Date;
  ordenCompraId?: string;
  ordenCompraNumero?: string;
  transferenciaId?: string;
  transferenciaNumero?: string;
  costoRealUSD?: number;
  costoFleteUSD?: number;
  notas?: string;

  // Actualizar cantidades recibidas por producto
  productosRecibidos?: {
    productoId: string;
    cantidadRecibida: number;
  }[];
}

/**
 * Filtros para buscar requerimientos
 */
export interface RequerimientoFiltros {
  estado?: EstadoRequerimiento;
  prioridad?: PrioridadRequerimiento;
  origen?: OrigenRequerimiento;
  responsableId?: string;             // Filtrar por responsable asignado
  clienteId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  conAsignacionesPendientes?: boolean;
}

/**
 * Estadísticas de requerimientos
 */
export interface RequerimientoStats {
  total: number;
  pendientes: number;
  aprobados: number;
  enProceso: number;
  completados: number;
  cancelados: number;
  urgentes: number;

  // Métricas de asignación
  sinAsignar: number;                 // Requerimientos sin ningún responsable
  parcialmenteAsignados: number;      // Con algunos productos sin asignar
  totalmenteAsignados: number;        // Todos los productos asignados

  // Valores
  costoTotalEstimadoUSD: number;
  costoTotalRealUSD: number;

  // Por responsable
  asignacionesPorResponsable: {
    responsableId: string;
    responsableNombre: string;
    cantidadRequerimientos: number;
    cantidadProductos: number;
    valorEstimadoUSD: number;
  }[];
}

/**
 * Vista resumida para listas
 */
export interface RequerimientoResumen {
  id: string;
  numeroRequerimiento: string;
  estado: EstadoRequerimiento;
  prioridad: PrioridadRequerimiento;
  clienteNombre?: string;
  totalProductos: number;
  cantidadAsignada: number;
  cantidadRecibida: number;
  responsables: string[];             // Nombres de responsables asignados
  fechaSolicitud: Timestamp;
  fechaRequerida?: Timestamp;
  costoEstimadoUSD: number;
}
