import { Timestamp } from 'firebase/firestore';

/**
 * Categorías principales de gasto (fijas)
 * GV: Gastos de Venta - comisiones, pasarelas de pago, fees de plataformas
 * GD: Gastos de Distribución - envíos, motorizado, agencias de carga
 * GA: Gastos Administrativos - servicios, planilla, mantenimiento
 * GO: Gastos Operativos - movilidad, suministros de oficina
 */
export type CategoriaGasto = 'GV' | 'GD' | 'GA' | 'GO';

/**
 * Información de cada categoría de gasto
 */
export const CATEGORIAS_GASTO: Record<CategoriaGasto, {
  codigo: CategoriaGasto;
  nombre: string;
  descripcion: string;
  color: string;
  ejemplos: string[];
  impactaCTRU: boolean;  // Si por defecto impacta CTRU
}> = {
  GV: {
    codigo: 'GV',
    nombre: 'Gasto de Venta',
    descripcion: 'Gastos directamente relacionados con la venta',
    color: 'purple',
    ejemplos: ['Comisión pasarela de pagos', 'Comisión MercadoLibre', 'Fee página web', 'Comisión vendedor'],
    impactaCTRU: false  // Se descuenta de utilidad de venta, no de CTRU
  },
  GD: {
    codigo: 'GD',
    nombre: 'Gasto de Distribución',
    descripcion: 'Gastos de envío y entrega de productos',
    color: 'blue',
    ejemplos: ['Envío motorizado', 'Agencia de carga', 'Movilidad independiente', 'Courier express'],
    impactaCTRU: false  // Se descuenta de utilidad de venta, no de CTRU
  },
  GA: {
    codigo: 'GA',
    nombre: 'Gasto Administrativo',
    descripcion: 'Gastos de administración del negocio',
    color: 'amber',
    ejemplos: ['Servicios (luz, agua, internet)', 'Planilla', 'Contador', 'Software/suscripciones'],
    impactaCTRU: true   // Se prorratea entre unidades disponibles
  },
  GO: {
    codigo: 'GO',
    nombre: 'Gasto Operativo',
    descripcion: 'Gastos operacionales del día a día',
    color: 'green',
    ejemplos: ['Movilidad de personal', 'Útiles de oficina', 'Mantenimiento equipos', 'Almacenaje'],
    impactaCTRU: true   // Se prorratea entre unidades disponibles
  }
};

/**
 * Tipo de gasto - string libre creado por el usuario
 * Ejemplos: "Comisión MercadoLibre", "Envío Olva Courier", "Luz oficina"
 */
export type TipoGasto = string;

/**
 * Moneda del gasto
 */
export type MonedaGasto = 'USD' | 'PEN';

/**
 * Frecuencia del gasto (para gastos recurrentes)
 */
export type FrecuenciaGasto =
  | 'unico'
  | 'mensual'
  | 'trimestral'
  | 'anual';

/**
 * Estado del gasto
 */
export type EstadoGasto =
  | 'pendiente'
  | 'pagado'
  | 'cancelado';

/**
 * Clase de gasto según su origen
 * GVD: Gastos de Venta y Distribución (asociados a ventas específicas)
 * GAO: Gastos Administrativos y Operativos (resto de gastos)
 */
export type ClaseGasto = 'GVD' | 'GAO';

/**
 * Gasto del negocio
 * Puede ser directo (asociado a una OC) o indirecto (prorrateado)
 */
export interface Gasto {
  id: string;

  // Identificación
  numeroGasto: string;            // GVD-0001 o GAO-0001
  claseGasto: ClaseGasto;         // GVD o GAO

  // Clasificación
  tipo: TipoGasto;
  categoria: CategoriaGasto;
  descripcion: string;

  // Monto
  moneda: MonedaGasto;
  montoOriginal: number;          // En la moneda original
  montoPEN: number;                // Convertido a PEN
  tipoCambio?: number;             // Si es USD, el TC usado

  // Prorrateo
  esProrrateable: boolean;         // Si se debe prorratear entre unidades
  prorrateoTipo?: 'unidad' | 'oc' | 'manual'; // Cómo se prorratean

  // Asociación directa
  ordenCompraId?: string;          // Si es gasto directo de una OC
  ventaId?: string;                // Si es gasto directo de una venta
  ventaNumero?: string;            // Número de venta para referencia

  // Período
  mes: number;                     // 1-12
  anio: number;                    // 2024, 2025, etc.
  fecha: Timestamp;                // Fecha del gasto

  // Recurrencia
  frecuencia: FrecuenciaGasto;
  esRecurrente: boolean;

  // Proveedor/Responsable
  proveedor?: string;              // Nombre del proveedor
  responsable?: string;            // Quién autorizó el gasto

  // Pago
  estado: EstadoGasto;
  metodoPago?: string;             // Efectivo, Tarjeta, Transferencia
  fechaPago?: Timestamp;
  numeroComprobante?: string;      // Factura, boleta, etc.

  // Impacto en CTRU
  impactaCTRU: boolean;            // Si afecta el cálculo de CTRU
  ctruRecalculado: boolean;        // Si ya se recalculó el CTRU
  fechaRecalculoCTRU?: Timestamp;

  // Documentos
  urlComprobante?: string;         // URL del comprobante
  notas?: string;                  // Notas adicionales

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  ultimaEdicion?: Timestamp;
  editadoPor?: string;
}

/**
 * Datos para crear un nuevo gasto
 */
export interface GastoFormData {
  // Clase de gasto (determina el prefijo del número)
  claseGasto?: ClaseGasto;         // GVD o GAO (default: GAO)

  tipo: TipoGasto;
  categoria: CategoriaGasto;
  descripcion: string;

  // Monto - puede ser moneda+montoOriginal o montoPEN directo
  moneda?: MonedaGasto;
  montoOriginal?: number;
  montoPEN?: number;               // Alternativa: monto directo en PEN
  tipoCambio?: number;

  esProrrateable: boolean;
  prorrateoTipo?: 'unidad' | 'oc' | 'manual';

  // Asociación directa
  ordenCompraId?: string;
  ventaId?: string;
  ventaNumero?: string;            // Número de venta para referencia

  fecha: Date;
  frecuencia?: FrecuenciaGasto;
  proveedor?: string;
  responsable?: string;
  estado: EstadoGasto;
  metodoPago?: string;
  numeroComprobante?: string;
  impactaCTRU: boolean;
  notas?: string;
  cuentaOrigenId?: string;
}

/**
 * Resumen de gastos por período
 */
export interface ResumenGastosMes {
  mes: number;
  anio: number;
  totalPEN: number;
  totalUSD: number;
  totalGastos: number;
  gastosProrrateables: number;
  montoProrrateable: number;
  gastosDirectos: number;
  montoDirecto: number;
  gastosRecurrentes: number;
  montoRecurrente: number;

  // Por categoría
  porCategoria: {
    categoria: CategoriaGasto;
    totalPEN: number;
    cantidad: number;
  }[];

  // Por tipo
  porTipo: {
    tipo: TipoGasto;
    totalPEN: number;
    cantidad: number;
  }[];
}

/**
 * Filtros para búsqueda de gastos
 */
export interface GastoFiltros {
  claseGasto?: ClaseGasto;
  tipo?: TipoGasto;
  categoria?: CategoriaGasto;
  mes?: number;
  anio?: number;
  estado?: EstadoGasto;
  esProrrateable?: boolean;
  ordenCompraId?: string;
  ventaId?: string;
  impactaCTRU?: boolean;
  moneda?: MonedaGasto;
}

/**
 * Estadísticas de gastos
 */
export interface GastoStats {
  // Mes actual
  totalMesActual: number;
  gastosProrrateablesMesActual: number;
  gastosDirectosMesActual: number;
  cantidadGastosMesActual: number;

  // Año actual
  totalAnioActual: number;
  promedioMensualAnioActual: number;

  // Por pagar
  totalPendientePago: number;
  cantidadPendientePago: number;

  // Comparaciones
  variacionVsMesAnterior: number; // %
  variacionVsPromedioAnual: number; // %
}

/**
 * Detalle de prorrateo de un gasto
 */
export interface DetalleProrrateGasto {
  gastoId: string;
  totalUnidadesAfectadas: number;
  montoPorUnidad: number;
  unidadesIds?: string[];          // Solo si prorrateoTipo = 'unidad'
  ordenCompraId?: string;          // Solo si prorrateoTipo = 'oc'
  fechaProrrateo: Timestamp;
}

/**
 * Historial de recálculo CTRU por un gasto
 */
export interface HistorialRecalculoCTRU {
  id: string;
  gastoId: string;
  numeroGasto: string;
  montoGasto: number;
  unidadesAfectadas: number;
  impactoPorUnidad: number;
  fechaRecalculo: Timestamp;
  ejecutadoPor: string;
}
