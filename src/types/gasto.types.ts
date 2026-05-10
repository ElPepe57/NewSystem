import { Timestamp } from 'firebase/firestore';

/**
 * Tipos de gasto según su naturaleza
 */
export type TipoGasto =
  // COSTOS DE IMPORTACIÓN (se pegan al producto vía CTRU)
  | 'flete_internacional'       // C2: Flete internacional (cualquier país → Perú)
  /**
   * @deprecated Usar 'flete_internacional'. Se mantiene para backward compat con docs existentes.
   */
  | 'flete_usa_peru'            // Legacy: equivale a flete_internacional (backward compat)
  | 'recojo_local'              // C3: Recojo en Perú (courier/viajero → almacén)
  | 'almacenaje'                // Almacenamiento origen o Perú
  | 'internacion'               // Internación/aduanas (si aplica)
  // GASTOS DEL NEGOCIO
  | 'administrativo'            // GA: Gastos administrativos
  | 'operativo'                 // GO: Gastos operativos (incluye packaging como GO)
  | 'marketing'                 // GV: Marketing y publicidad
  | 'empaque'                   // GO: Material de empaque (reclasificado de GD a GO)
  | 'delivery'                  // GD: Delivery local al cliente
  | 'comision_ml'               // GV: Comisión Mercado Libre
  | 'comision_pasarela'         // GV: Comisión pasarela de pago
  | 'comision_vendedor'         // GV: Comisión vendedor
  // PLANILLA
  | 'nomina'                     // GA: Sueldo/planilla de empleado
  // PÉRDIDAS DE INVENTARIO
  | 'merma_transferencia'       // Pérdida por daño en transferencia (cuenta 6952)
  | 'merma_vencimiento'         // Pérdida por vencimiento de producto (cuenta 6951)
  | 'desmedro'                  // Deterioro físico de producto (cuenta 6952)
  // OTROS
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
 * @deprecated Usar tipoCosto y asignacionGasto en su lugar
 * Clase de gasto - agrupación de categorías (mantener para compatibilidad)
 */
export type ClaseGasto = 'GVD' | 'GAO';

/**
 * Tipo de costo para clasificación contable
 * - directo: Varía directamente con cada venta (GV, GD)
 * - indirecto: Fijo del período, independiente del volumen (GA, GO)
 */
export type TipoCosto = 'directo' | 'indirecto';

/**
 * Tipo de asignación del gasto
 * - venta: Se asigna directamente a cada venta (GV, GD)
 * - periodo: Se asigna al período completo (GA, GO)
 */
export type AsignacionGasto = 'venta' | 'periodo';

/**
 * Comportamiento del costo
 * - variable: Cambia proporcionalmente con las ventas (comisiones %)
 * - fijo: Se mantiene constante independiente del volumen (alquiler)
 * - semi_variable: Tiene componente fijo y variable (algunos servicios)
 */
export type ComportamientoCosto = 'variable' | 'fijo' | 'semi_variable';

/**
 * @deprecated Usar getTipoCosto en su lugar
 * Obtener la clase de gasto a partir de la categoría
 */
export const getClaseGasto = (categoria: CategoriaGasto): ClaseGasto => {
  return categoria === 'GV' || categoria === 'GD' ? 'GVD' : 'GAO';
};

/**
 * Obtener el tipo de costo a partir de la categoría
 */
export const getTipoCosto = (categoria: CategoriaGasto): TipoCosto => {
  return categoria === 'GV' || categoria === 'GD' ? 'directo' : 'indirecto';
};

/**
 * Obtener el tipo de asignación a partir de la categoría
 */
export const getAsignacionGasto = (categoria: CategoriaGasto): AsignacionGasto => {
  return categoria === 'GV' || categoria === 'GD' ? 'venta' : 'periodo';
};

/**
 * Obtener el comportamiento típico de una categoría
 */
export const getComportamientoCosto = (categoria: CategoriaGasto): ComportamientoCosto => {
  switch (categoria) {
    case 'GV': return 'variable';      // Comisiones varían con ventas
    case 'GD': return 'variable';      // Delivery varía con entregas
    case 'GA': return 'fijo';          // Administrativos son fijos
    case 'GO': return 'semi_variable'; // Operativos pueden variar algo
  }
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
    nombre: 'Costos por Venta',
    descripcion: 'Costos directos asociados a ventas (comisiones, delivery, empaque)',
    categorias: ['GV', 'GD'],
    impactaCTRU: false
  },
  GAO: {
    codigo: 'GAO',
    nombre: 'Gastos Fijos del Mes',
    descripcion: 'Gastos del periodo (personal, local, servicios, operativos)',
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
  nombreCorto: string;
  descripcion: string;
  color: string;
  ejemplos: string[];
  /** @deprecated Usar tipoCosto en su lugar */
  impactaCTRU: boolean;
  // Nuevos campos de clasificación contable
  tipoCosto: TipoCosto;
  asignacion: AsignacionGasto;
  comportamiento: ComportamientoCosto;
}> = {
  GV: {
    codigo: 'GV',
    nombre: 'Costo por Venta',
    nombreCorto: 'Ventas',
    descripcion: 'Comisiones, pasarelas de pago, fees de plataformas',
    color: 'purple',
    ejemplos: ['Comisi\u00f3n ML', 'Comisi\u00f3n pasarela', 'Fee plataforma', 'Marketing'],
    impactaCTRU: false,
    tipoCosto: 'directo',
    asignacion: 'venta',
    comportamiento: 'variable'
  },
  GD: {
    codigo: 'GD',
    nombre: 'Costo de Distribuci\u00f3n',
    nombreCorto: 'Distribuci\u00f3n',
    descripcion: 'Delivery, empaque, flete local',
    color: 'blue',
    ejemplos: ['Delivery', 'Empaque', 'Flete local', 'Courier'],
    impactaCTRU: false,
    tipoCosto: 'directo',
    asignacion: 'venta',
    comportamiento: 'variable'
  },
  GA: {
    codigo: 'GA',
    nombre: 'Gasto Fijo Administrativo',
    nombreCorto: 'Administrativos',
    descripcion: 'Planilla, servicios, contador, alquiler',
    color: 'amber',
    ejemplos: ['Planilla', 'Luz', 'Agua', 'Internet', 'Contador', 'Alquiler'],
    impactaCTRU: false,
    tipoCosto: 'indirecto',
    asignacion: 'periodo',
    comportamiento: 'fijo'
  },
  GO: {
    codigo: 'GO',
    nombre: 'Gasto Fijo Operativo',
    nombreCorto: 'Operativos',
    descripcion: 'Movilidad, suministros, mantenimiento',
    color: 'green',
    ejemplos: ['Movilidad', 'Suministros', 'Mantenimiento', 'Herramientas'],
    impactaCTRU: false,
    tipoCosto: 'indirecto',
    asignacion: 'periodo',
    comportamiento: 'semi_variable'
  }
};

// Alias para compatibilidad con GastosVentaForm
export const CATEGORIAS_GASTO_INFO = CATEGORIAS_GASTO;

/**
 * Categorías aplicables a gastos directos de venta
 * Solo GV (Gasto de Venta) - comisiones, pasarelas, fees, etc.
 * NOTA: GD (Gasto de Distribución) ahora se gestiona en el módulo de Transportistas
 */
export const CATEGORIAS_GASTO_VENTA: CategoriaGasto[] = ['GV', 'GD'];

/**
 * Labels para mostrar tipos de gasto en la UI
 */
export const TIPOS_GASTO_LABELS: Record<TipoGasto, string> = {
  flete_internacional: 'Flete Internacional',
  flete_usa_peru: 'Flete Internacional (legacy)',
  recojo_local: 'Recojo Local',
  almacenaje: 'Almacenaje',
  internacion: 'Internación / Aduanas',
  administrativo: 'Administrativo',
  operativo: 'Operativo',
  marketing: 'Marketing',
  empaque: 'Empaque',
  delivery: 'Delivery',
  comision_ml: 'Comisión ML',
  comision_pasarela: 'Comisión Pasarela',
  comision_vendedor: 'Comisión Vendedor',
  merma_transferencia: 'Merma en Transferencia',
  merma_vencimiento: 'Merma por Vencimiento',
  desmedro: 'Desmedro',
  nomina: 'Nómina / Planilla',
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
  | 'parcial'
  | 'pagado'
  | 'cancelado';

/**
 * Registro de un pago individual de gasto
 * Sigue el patrón de PagoOrdenCompra para consistencia
 */
export interface PagoGasto {
  id: string;                       // PAG-GAS-{timestamp}-{random}
  fecha: Timestamp;                 // Fecha real del pago

  // Moneda y montos
  monedaPago: 'USD' | 'PEN';       // Moneda en la que se pagó
  montoOriginal: number;            // Monto en la moneda de pago
  montoUSD: number;                 // Equivalente en USD
  montoPEN: number;                 // Equivalente en PEN

  // Tipo de cambio
  tipoCambio: number;               // TC usado para conversión

  // Cuenta y método
  metodoPago: string;               // efectivo, transferencia_bancaria, yape, etc.
  cuentaOrigenId?: string;          // ID de la cuenta de tesorería

  // Referencias
  referencia?: string;              // Nro de operación, voucher, etc.
  notas?: string;

  // Tesorería
  movimientoTesoreriaId?: string;   // ID del movimiento en tesorería
  errorTesoreria?: boolean;          // true si falló el registro en tesorería
  errorTesoreriaMsg?: string;        // Mensaje de error para reconciliación
  cuentaOrigenNombre?: string;       // Desnormalizado para reportes (DATA-001 fix)

  // Pago masivo (trazabilidad de lote)
  lotePagoId?: string;
  esPagoMasivo?: boolean;

  // Auditoría
  registradoPor: string;
  fechaRegistro: Timestamp;
}

/**
 * Gasto del negocio
 * Puede ser directo (asociado a una OC) o indirecto (prorrateado)
 */
export interface Gasto {
  id: string;

  // Identificación
  numeroGasto: string;            // GAS-0001, GAS-0002, etc.

  // Clasificacion
  tipo: TipoGasto;
  /** @deprecated Usar categoriaCostoId */ categoria: CategoriaGasto;
  /** @deprecated Usar categoriaCostoId */ claseGasto: ClaseGasto;
  descripcion: string;

  // Reingenieria: referencia al maestro dinamico de categorias de costo
  categoriaCostoId?: string;
  categoriaCostoNombre?: string;

  // Monto
  moneda: MonedaGasto;
  montoOriginal: number;          // En la moneda original
  montoPEN: number;                // Convertido a PEN
  tipoCambio?: number;             // Si es USD, el TC usado

  // Línea de negocio (null = compartido, se prorratea por % ventas entre líneas)
  lineaNegocioId?: string | null;
  lineaNegocioNombre?: string | null;

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
  proveedor?: string;              // Nombre del proveedor (texto libre · legacy + display rápido)
  responsable?: string;            // Quién autorizó el gasto

  // S58b F5 — Vinculación estructurada a Cuenta Corriente.
  // Cuando estos campos están presentes, los pagos crean MovimientoCC en la
  // CC de la entidad referenciada (igual que OCs y envíos). Son OPCIONALES
  // por retrocompat — gastos legacy sin proveedorId siguen usando el flujo
  // tradicional (solo gasto.pagos[] + tesorería).
  proveedorId?: string;
  proveedorTipo?: 'proveedor' | 'colaborador' | 'empleado';
  proveedorNombre?: string;        // Desnormalizado (suele coincidir con `proveedor`)

  // Pago
  estado: EstadoGasto;
  metodoPago?: string;             // Efectivo, Tarjeta, Transferencia (legacy)
  fechaPago?: Timestamp;           // Legacy: fecha del pago único
  numeroComprobante?: string;      // Factura, boleta, etc.

  // Pagos parciales
  pagos?: PagoGasto[];             // Historial de pagos
  montoPagado?: number;            // Suma de todos los pagos en PEN
  montoPendiente?: number;         // montoPEN - montoPagado

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
  /**
   * Modelo canónico 3 niveles (chk5.A2/A6) · apunta a categoriasCosto/{id}.
   * Coexiste con `categoria` legacy hasta que chk5.A8 elimine la dual-write.
   */
  categoriaCostoId?: string;
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
  // S58b F5 — Vinculación estructurada opcional a CC
  proveedorId?: string;
  proveedorTipo?: 'proveedor' | 'colaborador' | 'empleado';
  proveedorNombre?: string;
  estado: EstadoGasto;
  // Información de pago
  metodoPago?: string;
  cuentaOrigenId?: string;       // Cuenta de donde sale el dinero
  referenciaPago?: string;       // Nº operación, voucher, etc.
  numeroComprobante?: string;
  impactaCTRU: boolean;
  notas?: string;
  // Línea de negocio (null = compartido entre todas las líneas)
  lineaNegocioId?: string | null;
  lineaNegocioNombre?: string | null;
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
