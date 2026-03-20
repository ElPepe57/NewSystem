import { Timestamp } from 'firebase/firestore';

/**
 * ===============================================
 * LÍNEA DE NEGOCIO
 * ===============================================
 *
 * Representa una vertical/cartera de productos del negocio.
 * Ejemplos: "Suplementos y Vitaminas", "Skincare"
 *
 * Cada línea tiene su propia rentabilidad, métricas y
 * prorrateo de gastos GA/GO independiente.
 *
 * Relaciones:
 * - Producto → lineaNegocioId (obligatorio)
 * - Unidad → lineaNegocioId (heredado del producto)
 * - Venta → lineaNegocioId (heredado del producto/cotización)
 * - Gasto → lineaNegocioId (null = compartido, se prorratea por % ventas)
 * - Cotización → lineaNegocioId (del producto principal)
 * - Requerimiento → lineaNegocioId (del producto principal)
 * - OC → lineaNegocioId (si todos los productos son de la misma línea)
 * - Mov. Tesorería → lineaNegocioId (heredado del doc origen)
 */

/**
 * Línea de Negocio
 */
export interface LineaNegocio {
  id: string;
  nombre: string;                    // 'Suplementos y Vitaminas', 'Skincare'
  codigo: string;                    // 'SUP', 'SKC' — para prefijos y reportes
  descripcion?: string;
  color: string;                     // Color para UI (badges, charts, etc.)
  icono?: string;                    // Emoji o nombre de ícono (ej: '💊', '✨')
  activa: boolean;

  // Métricas snapshot (desnormalizadas, se recalculan)
  totalProductos?: number;
  totalUnidadesActivas?: number;
  ventasMesActualPEN?: number;

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Datos para crear/editar una línea de negocio
 */
export interface LineaNegocioFormData {
  nombre: string;
  codigo: string;
  descripcion?: string;
  color: string;
  icono?: string;
  activa: boolean;
}

/**
 * Snapshot desnormalizado para embeber en otros documentos
 * Evita joins costosos en queries frecuentes
 */
export interface LineaNegocioSnapshot {
  lineaNegocioId: string;
  lineaNegocioNombre: string;
  lineaNegocioCodigo: string;
  lineaNegocioColor?: string;
}

/**
 * Filtro por línea de negocio (para stores y queries)
 */
export interface LineaNegocioFiltro {
  lineaNegocioId?: string | null;    // null = todas las líneas
}

/**
 * Resumen financiero por línea de negocio
 * Usado en dashboard comparativo y P&L segmentado
 */
export interface ResumenLineaNegocio {
  lineaNegocioId: string;
  lineaNegocioNombre: string;
  lineaNegocioCodigo: string;
  lineaNegocioColor: string;

  // Inventario
  totalProductos: number;
  totalUnidadesActivas: number;
  valorInventarioUSD: number;
  valorInventarioPEN: number;

  // Ventas del período
  ventasBrutasPEN: number;
  ventasNetasPEN: number;
  cantidadVentas: number;
  unidadesVendidas: number;

  // Costos del período
  costoMercaderiaPEN: number;        // CMV
  gastosDirectosPEN: number;         // GV + GD asignados a esta línea
  gastosIndirectosPEN: number;       // GA + GO prorrateados a esta línea
  gastosTotalPEN: number;

  // Márgenes
  margenBrutoPorcentaje: number;     // (ventasNetas - CMV) / ventasNetas
  margenOperativoPorcentaje: number; // (ventasNetas - CMV - gastos) / ventasNetas
  utilidadOperativaPEN: number;

  // Participación
  participacionVentas: number;       // % del total de ventas del negocio
  participacionGastos: number;       // % del total de gastos
}

/**
 * Comparativo entre líneas de negocio
 */
export interface ComparativoLineasNegocio {
  mes: number;
  anio: number;
  lineas: ResumenLineaNegocio[];
  consolidado: ResumenLineaNegocio;  // Totales del negocio
}
