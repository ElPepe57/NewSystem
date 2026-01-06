import { Timestamp } from 'firebase/firestore';

/**
 * Tipos de gasto según su naturaleza
 */
export type TipoGasto =
  | 'flete_usa_peru'           // Logística internacional
  | 'almacenaje'                // Almacenamiento USA o Perú
  | 'administrativo'            // Gastos administrativos
  | 'operativo'                 // Gastos operativos
  | 'marketing'                 // Marketing y publicidad
  | 'empaque'                   // Material de empaque
  | 'delivery'                  // Delivery local
  | 'comision_ml'               // Comisión Mercado Libre
  | 'otros';                    // Otros gastos

/**
 * Categorías de gasto para clasificación
 * - GV: Gastos de Venta (comisiones, fees, marketing)
 * - GD: Gastos de Distribución (delivery, empaque, flete local)
 * - GA: Gastos Administrativos (planilla, servicios, contador)
 * - GO: Gastos Operativos (movilidad, suministros, mantenimiento)
 */
export type CategoriaGasto = 'GV' | 'GD' | 'GA' | 'GO';

/**
 * Clase de gasto - agrupación de categorías
 * - GVD: Gastos de Venta y Distribución (GV + GD) - afectan margen directo, NO CTRU
 * - GAO: Gastos Administrativos y Operativos (GA + GO) - prorrateables, SÍ afectan CTRU
 */
export type ClaseGasto = 'GVD' | 'GAO';

/**
 * Obtener la clase de gasto a partir de la categoría
 */
export const getClaseGasto = (categoria: CategoriaGasto): ClaseGasto => {
  return categoria === 'GV' || categoria === 'GD' ? 'GVD' : 'GAO';
};

/**
 * Información de cada clase de gasto
 */
export const CLASES_GASTO: Record<ClaseGasto, {
  codigo: ClaseGasto;
  nombre: string;
  descripcion: string;
  categorias: CategoriaGasto[];
  impactaCTRU: boolean;
}> = {
  GVD: {
    codigo: 'GVD',
    nombre: 'Gastos de Venta y Distribución',
    descripcion: 'Gastos directos asociados a ventas específicas',
    categorias: ['GV', 'GD'],
    impactaCTRU: false
  },
  GAO: {
    codigo: 'GAO',
    nombre: 'Gastos Administrativos y Operativos',
    descripcion: 'Gastos generales prorrateables entre unidades',
    categorias: ['GA', 'GO'],
    impactaCTRU: true
  }
};

/**
 * Información de cada categoría de gasto para la UI
 */
export const CATEGORIAS_GASTO: Record<CategoriaGasto, {
  codigo: CategoriaGasto;
  nombre: string;
  descripcion: string;
  color: string;
  ejemplos: string[];
  impactaCTRU: boolean;
}> = {
  GV: {
    codigo: 'GV',
    nombre: 'Gasto de Venta',
    descripcion: 'Comisiones, pasarelas de pago, fees de plataformas',
    color: 'purple',
    ejemplos: ['Comisión ML', 'Comisión pasarela', 'Fee plataforma', 'Marketing'],
    impactaCTRU: false
  },
  GD: {
    codigo: 'GD',
    nombre: 'Gasto de Distribución',
    descripcion: 'Delivery, empaque, flete local',
    color: 'blue',
    ejemplos: ['Delivery', 'Empaque', 'Flete local', 'Courier'],
    impactaCTRU: false
  },
  GA: {
    codigo: 'GA',
    nombre: 'Gasto Administrativo',
    descripcion: 'Planilla, servicios, contador, alquiler',
    color: 'amber',
    ejemplos: ['Planilla', 'Luz', 'Agua', 'Internet', 'Contador', 'Alquiler'],
    impactaCTRU: true
  },
  GO: {
    codigo: 'GO',
    nombre: 'Gasto Operativo',
    descripcion: 'Movilidad, suministros, mantenimiento',
    color: 'green',
    ejemplos: ['Movilidad', 'Suministros', 'Mantenimiento', 'Herramientas'],
    impactaCTRU: true
  }
};

// Alias para compatibilidad con GastosVentaForm
export const CATEGORIAS_GASTO_INFO = CATEGORIAS_GASTO;

/**
 * Categorías aplicables a gastos directos de venta
 * Solo GV (Gasto de Venta) - comisiones, pasarelas, fees, etc.
 * NOTA: GD (Gasto de Distribución) ahora se gestiona en el módulo de Transportistas
 */
export const CATEGORIAS_GASTO_VENTA: CategoriaGasto[] = ['GV'];

/**
 * Labels para mostrar tipos de gasto en la UI
 */
export const TIPOS_GASTO_LABELS: Record<TipoGasto, string> = {
  flete_usa_peru: 'Flete USA-Perú',
  almacenaje: 'Almacenaje',
  administrativo: 'Administrativo',
  operativo: 'Operativo',
  marketing: 'Marketing',
  empaque: 'Empaque',
  delivery: 'Delivery',
  comision_ml: 'Comisión ML',
  otros: 'Otros'
};

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
 * Gasto del negocio
 * Puede ser directo (asociado a una OC) o indirecto (prorrateado)
 */
export interface Gasto {
  id: string;

  // Identificación
  numeroGasto: string;            // GAS-0001, GAS-0002, etc.

  // Clasificación
  tipo: TipoGasto;
  categoria: CategoriaGasto;
  claseGasto: ClaseGasto;         // GVD o GAO (derivado de categoría)
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
  tipo: TipoGasto;
  categoria: CategoriaGasto;
  descripcion: string;
  moneda: MonedaGasto;
  montoOriginal: number;
  tipoCambio?: number;
  esProrrateable: boolean;
  prorrateoTipo?: 'unidad' | 'oc' | 'manual';
  ordenCompraId?: string;
  ventaId?: string;
  fecha: Date;
  frecuencia: FrecuenciaGasto;
  proveedor?: string;
  responsable?: string;
  estado: EstadoGasto;
  // Información de pago
  metodoPago?: string;
  cuentaOrigenId?: string;       // Cuenta de donde sale el dinero
  referenciaPago?: string;       // Nº operación, voucher, etc.
  numeroComprobante?: string;
  impactaCTRU: boolean;
  notas?: string;
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
