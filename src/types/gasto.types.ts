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
  | 'administrativo'            // bloque 'periodo' · administrativos
  | 'operativo'                 // bloque 'periodo' · operativos (incluye packaging)
  | 'marketing'                 // bloque 'venta' · marketing y publicidad directa
  | 'empaque'                   // bloque 'venta' · material de empaque
  | 'delivery'                  // bloque 'venta' · delivery local al cliente
  | 'comision_ml'               // bloque 'venta' · comisión Mercado Libre
  | 'comision_pasarela'         // bloque 'venta' · comisión pasarela de pago
  | 'comision_vendedor'         // bloque 'venta' · comisión vendedor
  // PLANILLA
  | 'nomina'                    // bloque 'periodo' · sueldo/planilla de empleado
  // PÉRDIDAS DE INVENTARIO (bloque 'producto')
  | 'merma_transferencia'       // Pérdida por daño en transferencia (cuenta 6952)
  | 'merma_vencimiento'         // Pérdida por vencimiento de producto (cuenta 6951)
  | 'desmedro'                  // Deterioro físico de producto (cuenta 6952)
  // OTROS
  | 'otros';                    // Otros gastos

// chk5.A15 · CIRUGÍA FINAL · tipos/funciones/constantes legacy ELIMINADOS:
// ─────────────────────────────────────────────────────────────────────
//   - type CategoriaGasto ('GV' | 'GD' | 'GA' | 'GO')
//   - type ClaseGasto ('GVD' | 'GAO')
//   - type TipoCosto ('directo' | 'indirecto')
//   - type AsignacionGasto ('venta' | 'periodo')
//   - type ComportamientoCosto ('variable' | 'fijo' | 'semi_variable')
//   - getClaseGasto / getTipoCosto / getAsignacionGasto / getComportamientoCosto
//   - const CLASES_GASTO / CATEGORIAS_GASTO / CATEGORIAS_GASTO_INFO / CATEGORIAS_GASTO_VENTA
//
// Modelo canónico vigente: `BloqueCosto` ('producto' | 'venta' | 'periodo')
// + `categoriaCostoId` (referencia al árbol dinámico en `categoriasCosto/{id}`).
// Las distinciones GV/GD y GA/GO se derivan vía helpers en `gasto.bloque.ts`:
//   - esGastoDistribucion(g)    ≡ GD legacy
//   - esGastoAdministrativo(g)  ≡ GA legacy
//   - esGastoDelBloque(g, ...)  ≡ filtrado por bloque

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
 *
 * chk5.A15 · CIRUGÍA FINAL · modelo canon (cero campos legacy):
 *   - Sin `categoria: CategoriaGasto`
 *   - Sin `claseGasto: ClaseGasto`
 *   - Sin `cuentaOrigenId` (vive en `pagos[].cuentaOrigenId`)
 *   - La clasificación de costo se resuelve vía `categoriaCostoId` + árbol.
 */
export interface Gasto {
  id: string;

  // Identificación
  numeroGasto: string;            // GAS-0001, GAS-0002, etc.

  // Clasificacion canónica (3 niveles)
  tipo: TipoGasto;
  descripcion: string;
  categoriaCostoId?: string;       // Referencia al maestro dinámico en categoriasCosto/{id}
  categoriaCostoNombre?: string;   // Desnormalizado para queries y exports

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

  // Pagos parciales (modelo canon · ver PagoGasto interface)
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
  /**
   * Modelo canónico 3 niveles · apunta a categoriasCosto/{id}.
   * Identifica el bloque + categoría padre + (opcional) subcategoría.
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
  cuentaOrigenId?: string;       // Cuenta de donde sale el dinero (input · se materializa en PagoGasto)
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

  // chk5.A15 · `porCategoria` legacy eliminado · era dead.
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
  // chk5.A15 · canon · filtrar por categoría = pasar categoriaCostoId del árbol dinámico
  categoriaCostoId?: string;
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
