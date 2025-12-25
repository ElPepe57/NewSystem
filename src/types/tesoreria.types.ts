import { Timestamp } from 'firebase/firestore';

/**
 * ===============================================
 * MÓDULO DE TESORERÍA
 * ===============================================
 *
 * Gestiona el flujo de dinero en ambas monedas (USD/PEN),
 * las conversiones cambiarias y el tracking del impacto
 * del tipo de cambio en cada operación del negocio.
 */

// ===============================================
// TIPOS BASE
// ===============================================

export type MonedaTesoreria = 'USD' | 'PEN';

/**
 * Tipo de movimiento de caja/tesorería
 */
export type TipoMovimientoTesoreria =
  // Entradas
  | 'ingreso_venta'           // Cobro de venta
  | 'ingreso_otro'            // Otros ingresos
  // Salidas
  | 'pago_orden_compra'       // Pago a proveedor USA
  | 'pago_viajero'            // Pago a viajero (flete)
  | 'pago_proveedor_local'    // Pago a proveedor Perú
  | 'gasto_operativo'         // Gastos operativos
  | 'retiro_socio'            // Retiro de dinero por socio
  // Conversiones
  | 'conversion_pen_usd'      // Cambio de PEN a USD
  | 'conversion_usd_pen'      // Cambio de USD a PEN
  // Ajustes
  | 'ajuste_positivo'         // Ajuste de caja positivo
  | 'ajuste_negativo';        // Ajuste de caja negativo

/**
 * Estado del movimiento
 */
export type EstadoMovimientoTesoreria =
  | 'pendiente'               // Programado pero no ejecutado
  | 'ejecutado'               // Movimiento completado
  | 'anulado';                // Movimiento anulado

/**
 * Método de pago/cobro
 */
export type MetodoTesoreria =
  | 'efectivo'
  | 'transferencia_bancaria'
  | 'yape'
  | 'plin'
  | 'tarjeta'
  | 'mercado_pago'
  | 'paypal'
  | 'zelle'                   // Para pagos USA
  | 'otro';

// ===============================================
// MOVIMIENTO DE TESORERÍA
// ===============================================

/**
 * Movimiento de tesorería (entrada/salida de dinero)
 */
export interface MovimientoTesoreria {
  id: string;
  numeroMovimiento: string;     // MOV-2024-001

  // Tipo y clasificación
  tipo: TipoMovimientoTesoreria;
  estado: EstadoMovimientoTesoreria;

  // Montos
  moneda: MonedaTesoreria;
  monto: number;                // Monto en la moneda original

  // Tipo de cambio aplicado
  tipoCambio: number;           // TC al momento del movimiento
  montoEquivalentePEN: number;  // Monto convertido a PEN (para reportes)
  montoEquivalenteUSD: number;  // Monto convertido a USD (para reportes)

  // Método
  metodo: MetodoTesoreria;
  referencia?: string;          // Nro operación, voucher, etc.

  // Documentos relacionados
  ordenCompraId?: string;
  ordenCompraNumero?: string;
  ventaId?: string;
  ventaNumero?: string;
  gastoId?: string;
  gastoNumero?: string;

  // Caja/Cuenta
  cuentaOrigen?: string;        // ID de la cuenta de origen
  cuentaDestino?: string;       // ID de la cuenta de destino

  // Descripción
  concepto: string;
  notas?: string;

  // Comprobante
  urlComprobante?: string;

  // Fechas
  fecha: Timestamp;             // Fecha del movimiento
  fechaProgramada?: Timestamp;  // Si es un pago programado

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

// ===============================================
// CONVERSIÓN CAMBIARIA
// ===============================================

/**
 * Registro de conversión de moneda
 * Cada vez que se cambia dinero de una moneda a otra
 */
export interface ConversionCambiaria {
  id: string;
  numeroConversion: string;     // CONV-2024-001

  // Monedas
  monedaOrigen: MonedaTesoreria;
  monedaDestino: MonedaTesoreria;

  // Montos
  montoOrigen: number;          // Monto que se cambió
  montoDestino: number;         // Monto que se recibió

  // Tipo de cambio
  tipoCambio: number;           // TC aplicado en la conversión
  tipoCambioReferencia: number; // TC del día (SUNAT/BCRP)
  spreadCambiario: number;      // Diferencia % vs TC referencia

  // Casa de cambio / Banco
  entidadCambio?: string;       // Nombre de la entidad

  // Cálculo de pérdida/ganancia
  // Si vendimos USD y el TC real es menor al de referencia = pérdida
  diferenciaVsReferencia: number; // (TC aplicado - TC ref) × monto

  // Fechas
  fecha: Timestamp;

  // Notas
  motivo?: string;              // Por qué se hizo la conversión
  notas?: string;

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
}

// ===============================================
// TRACKING DE TC POR TRANSACCIÓN
// ===============================================

/**
 * Registro del TC aplicado en cada punto del flujo de negocio
 * Permite calcular la diferencia cambiaria real
 */
export interface RegistroTCTransaccion {
  id: string;

  // Documento relacionado
  tipoDocumento: 'orden_compra' | 'venta' | 'gasto' | 'pago_viajero';
  documentoId: string;
  documentoNumero: string;

  // Momento del flujo
  momento:
    | 'cotizacion'              // TC al cotizar
    | 'creacion'                // TC al crear el documento
    | 'confirmacion'            // TC al confirmar
    | 'pago'                    // TC al pagar
    | 'cobro'                   // TC al cobrar
    | 'conversion';             // TC al convertir moneda

  // Montos
  montoUSD: number;
  tipoCambio: number;
  montoPEN: number;             // montoUSD × tipoCambio

  // Comparación con momento anterior
  tcMomentoAnterior?: number;
  diferenciaVsMomentoAnterior?: number; // Ganancia/pérdida vs momento anterior

  // Fecha
  fecha: Timestamp;

  // Auditoría
  registradoPor: string;
}

// ===============================================
// CUENTA DE CAJA
// ===============================================

/**
 * Cuenta de caja (física o bancaria)
 * Soporta cuentas mono-moneda y bi-moneda (USD + PEN en una sola cuenta)
 */
export interface CuentaCaja {
  id: string;
  nombre: string;               // "Caja Chica PEN", "Cuenta BCP", etc.
  titular: string;              // Nombre del titular de la cuenta (obligatorio)
  tipo: 'efectivo' | 'banco' | 'digital'; // Tipo de cuenta

  // Configuración de moneda
  esBiMoneda: boolean;          // true = maneja USD y PEN en la misma cuenta
  moneda: MonedaTesoreria;      // Para cuentas mono-moneda: la moneda única
                                // Para cuentas bi-moneda: moneda principal (para display)

  // Saldos - Mono-moneda
  saldoActual: number;          // Saldo en la moneda configurada (mono-moneda)

  // Saldos - Bi-moneda
  saldoUSD?: number;            // Saldo en USD (solo bi-moneda)
  saldoPEN?: number;            // Saldo en PEN (solo bi-moneda)

  saldoMinimo?: number;         // Alerta si baja de este monto
  saldoMinimoUSD?: number;      // Alerta USD (bi-moneda)
  saldoMinimoPEN?: number;      // Alerta PEN (bi-moneda)

  // Datos bancarios (si aplica)
  banco?: string;
  numeroCuenta?: string;
  cci?: string;

  // Asociación con método de pago (para selección automática)
  metodoPagoAsociado?: MetodoTesoreria;
  esCuentaPorDefecto?: boolean; // Si es la cuenta por defecto para ese método

  // Estado
  activa: boolean;

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

// ===============================================
// DIFERENCIA CAMBIARIA ACUMULADA
// ===============================================

/**
 * Resumen de diferencia cambiaria por período
 */
export interface DiferenciaCambiariaPeriodo {
  mes: number;
  anio: number;

  // Por tipo de operación
  ordenesCompra: {
    cantidad: number;
    diferenciaTotal: number;    // Positivo = pérdida, Negativo = ganancia
    tcPromedioCompra: number;
    tcPromedioPago: number;
  };

  ventas: {
    cantidad: number;
    diferenciaTotal: number;
    tcPromedioVenta: number;
    tcPromedioCobro: number;
  };

  conversiones: {
    cantidad: number;
    diferenciaTotal: number;
    spreadPromedio: number;
  };

  // Totales
  diferenciaNetoMes: number;    // Positivo = pérdida neta, Negativo = ganancia neta
  impactoEnUtilidad: number;    // % de impacto sobre la utilidad del mes
}

// ===============================================
// FORM DATA
// ===============================================

export interface MovimientoTesoreriaFormData {
  tipo: TipoMovimientoTesoreria;
  moneda: MonedaTesoreria;
  monto: number;
  tipoCambio: number;
  metodo: MetodoTesoreria;
  referencia?: string;
  concepto: string;
  notas?: string;
  fecha: Date;

  // Documentos relacionados
  ordenCompraId?: string;
  ordenCompraNumero?: string;
  ventaId?: string;
  ventaNumero?: string;
  gastoId?: string;
  gastoNumero?: string;

  // Cuentas
  cuentaOrigen?: string;
  cuentaDestino?: string;
}

export interface ConversionCambiariaFormData {
  monedaOrigen: MonedaTesoreria;
  montoOrigen: number;
  tipoCambio: number;
  entidadCambio?: string;
  motivo?: string;
  notas?: string;
  fecha: Date;
}

export interface CuentaCajaFormData {
  nombre: string;
  titular: string;              // Nombre del titular (obligatorio)
  tipo: 'efectivo' | 'banco' | 'digital';

  // Configuración de moneda
  esBiMoneda: boolean;          // true = cuenta bi-moneda
  moneda: MonedaTesoreria;      // Moneda única (mono) o principal (bi-moneda)

  // Saldos iniciales
  saldoInicial: number;         // Saldo inicial mono-moneda
  saldoInicialUSD?: number;     // Saldo inicial USD (bi-moneda)
  saldoInicialPEN?: number;     // Saldo inicial PEN (bi-moneda)

  // Alertas de saldo mínimo
  saldoMinimo?: number;
  saldoMinimoUSD?: number;      // Alerta USD (bi-moneda)
  saldoMinimoPEN?: number;      // Alerta PEN (bi-moneda)

  // Datos bancarios
  banco?: string;
  numeroCuenta?: string;
  cci?: string;
  metodoPagoAsociado?: MetodoTesoreria;
  esCuentaPorDefecto?: boolean;
}

// ===============================================
// FILTROS
// ===============================================

export interface MovimientoTesoreriaFiltros {
  tipo?: TipoMovimientoTesoreria;
  estado?: EstadoMovimientoTesoreria;
  moneda?: MonedaTesoreria;
  fechaInicio?: Date;
  fechaFin?: Date;
  cuentaId?: string;
  ordenCompraId?: string;
  ventaId?: string;
}

export interface ConversionCambiariaFiltros {
  monedaOrigen?: MonedaTesoreria;
  fechaInicio?: Date;
  fechaFin?: Date;
  entidadCambio?: string;
}

// ===============================================
// ESTADÍSTICAS
// ===============================================

export interface TesoreriaStats {
  // Saldos actuales
  saldoTotalUSD: number;
  saldoTotalPEN: number;
  saldoTotalEquivalentePEN: number; // USD convertido + PEN

  // Movimientos del mes
  ingresosMesUSD: number;
  ingresosMesPEN: number;
  egresosMesUSD: number;
  egresosMesPEN: number;

  // Conversiones del mes
  conversionesMes: number;
  montoConvertidoMes: number;
  spreadPromedioMes: number;

  // Diferencia cambiaria
  diferenciaNetaMes: number;
  diferenciaAcumuladaAnio: number;

  // Pagos pendientes
  pagosPendientesUSD: number;
  pagosPendientesPEN: number;

  // Por cobrar
  porCobrarPEN: number;
}

// ===============================================
// RESUMEN DE FLUJO DE CAJA
// ===============================================

export interface FlujoCajaDiario {
  fecha: string;                // YYYY-MM-DD

  // Saldo inicial del día
  saldoInicialUSD: number;
  saldoInicialPEN: number;

  // Movimientos del día
  ingresosUSD: number;
  ingresosPEN: number;
  egresosUSD: number;
  egresosPEN: number;

  // Conversiones
  conversionesUSDaPEN: number;
  conversionesPENaUSD: number;

  // Saldo final del día
  saldoFinalUSD: number;
  saldoFinalPEN: number;

  // TC del día
  tcDelDia: number;
}

export interface FlujoCajaMensual {
  mes: number;
  anio: number;

  // Saldo inicial del mes
  saldoInicialUSD: number;
  saldoInicialPEN: number;

  // Totales del mes
  ingresosUSD: number;
  ingresosPEN: number;
  egresosUSD: number;
  egresosPEN: number;

  // Conversiones
  totalConvertidoUSDaPEN: number;
  totalConvertidoPENaUSD: number;

  // Diferencia cambiaria
  diferenciaNetaMes: number;

  // Saldo final del mes
  saldoFinalUSD: number;
  saldoFinalPEN: number;

  // TC promedio del mes
  tcPromedioMes: number;
}

// ===============================================
// CUENTAS POR PAGAR / COBRAR CONSOLIDADAS
// ===============================================

/**
 * Tipo de pendiente financiero
 */
export type TipoPendiente =
  | 'venta_por_cobrar'
  | 'orden_compra_por_pagar'
  | 'gasto_por_pagar'
  | 'viajero_por_pagar';

/**
 * Item pendiente individual (normalizado para todas las fuentes)
 */
export interface PendienteFinanciero {
  id: string;
  tipo: TipoPendiente;

  // Identificación del documento origen
  documentoId: string;
  numeroDocumento: string;       // VT-001, OC-001, GAS-001, ENV-001

  // Contraparte
  contraparteNombre: string;     // Cliente, Proveedor, Viajero, etc.
  contraparteId?: string;

  // Montos
  montoTotal: number;            // Monto total del documento
  montoPagado: number;           // Lo que ya se pagó/cobró
  montoPendiente: number;        // Lo que falta
  moneda: MonedaTesoreria;

  // Tipo de cambio (si aplica)
  tipoCambio?: number;
  montoEquivalentePEN?: number;  // Para mostrar en reportes

  // Fechas
  fechaDocumento: Timestamp;     // Fecha del documento
  fechaVencimiento?: Timestamp;  // Si tiene fecha límite
  diasPendiente: number;         // Días desde la fecha del documento

  // Estado
  estadoDocumento: string;       // Estado original del documento
  esVencido: boolean;            // Si pasó la fecha de vencimiento
  esParcial: boolean;            // Si tiene pago parcial

  // Metadata
  notas?: string;
  canal?: string;                // Para ventas: ML, directo, etc.
}

/**
 * Resumen de cuentas por cobrar
 */
export interface ResumenCuentasPorCobrar {
  // Totales
  totalPendientePEN: number;
  totalPendienteUSD: number;
  totalEquivalentePEN: number;   // USD convertido a PEN

  // Cantidades
  cantidadDocumentos: number;
  cantidadVencidos: number;
  cantidadParciales: number;

  // Por antigüedad
  pendiente0a7dias: number;
  pendiente8a15dias: number;
  pendiente16a30dias: number;
  pendienteMas30dias: number;

  // Por canal (solo ventas)
  porCanal?: {
    canal: string;
    cantidad: number;
    montoPEN: number;
  }[];

  // Lista de pendientes
  pendientes: PendienteFinanciero[];
}

/**
 * Resumen de cuentas por pagar
 */
export interface ResumenCuentasPorPagar {
  // Totales
  totalPendientePEN: number;
  totalPendienteUSD: number;
  totalEquivalentePEN: number;

  // Cantidades
  cantidadDocumentos: number;
  cantidadVencidos: number;
  cantidadParciales: number;

  // Por tipo
  porTipo: {
    tipo: TipoPendiente;
    etiqueta: string;
    cantidad: number;
    montoPEN: number;
    montoUSD: number;
  }[];

  // Por antigüedad
  pendiente0a7dias: number;
  pendiente8a15dias: number;
  pendiente16a30dias: number;
  pendienteMas30dias: number;

  // Lista de pendientes
  pendientes: PendienteFinanciero[];
}

/**
 * Dashboard consolidado de CxP/CxC
 */
export interface DashboardCuentasPendientes {
  // Fecha de cálculo
  fechaCalculo: Date;
  tipoCambioUsado: number;

  // Por cobrar (ingresos pendientes)
  cuentasPorCobrar: ResumenCuentasPorCobrar;

  // Por pagar (egresos pendientes)
  cuentasPorPagar: ResumenCuentasPorPagar;

  // Balance proyectado
  balanceNeto: {
    porCobrarPEN: number;
    porPagarPEN: number;
    flujoNetoPEN: number;        // porCobrar - porPagar

    porCobrarUSD: number;
    porPagarUSD: number;
    flujoNetoUSD: number;
  };

  // Alertas
  alertas: {
    tipo: 'vencido' | 'proximo_vencer' | 'monto_alto';
    mensaje: string;
    pendienteId: string;
    prioridad: 'alta' | 'media' | 'baja';
  }[];
}
