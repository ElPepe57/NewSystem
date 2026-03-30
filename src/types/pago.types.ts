/**
 * pago.types.ts
 *
 * Modelo UNIFICADO de pagos para todo el sistema.
 * Reemplaza: PagoVenta, PagoOrdenCompra, PagoViajero, PagoGasto
 *
 * Todos los formularios de pago del ERP deben usar este modelo.
 */

// ============================================
// MÉTODOS DE PAGO (catálogo único)
// ============================================

export type MetodoPagoUnificado =
  | 'efectivo'
  | 'transferencia_bancaria'
  | 'yape'
  | 'plin'
  | 'tarjeta_debito'
  | 'tarjeta_credito'
  | 'linea_credito'        // NUEVO: pago con línea de crédito bancaria
  | 'mercado_pago'
  | 'paypal'
  | 'zelle'
  | 'otro';

export const METODOS_PAGO_CATALOGO: Array<{
  id: MetodoPagoUnificado;
  label: string;
  monedas: ('PEN' | 'USD')[];
  requiereCuenta: boolean;
  requiereReferencia: boolean;
  icon?: string;
}> = [
  { id: 'efectivo', label: 'Efectivo', monedas: ['PEN', 'USD'], requiereCuenta: false, requiereReferencia: false },
  { id: 'transferencia_bancaria', label: 'Transferencia', monedas: ['PEN', 'USD'], requiereCuenta: true, requiereReferencia: true },
  { id: 'yape', label: 'Yape', monedas: ['PEN'], requiereCuenta: true, requiereReferencia: false },
  { id: 'plin', label: 'Plin', monedas: ['PEN'], requiereCuenta: true, requiereReferencia: false },
  { id: 'tarjeta_debito', label: 'Tarjeta Débito', monedas: ['PEN', 'USD'], requiereCuenta: true, requiereReferencia: true },
  { id: 'tarjeta_credito', label: 'Tarjeta Crédito', monedas: ['PEN', 'USD'], requiereCuenta: false, requiereReferencia: true },
  { id: 'linea_credito', label: 'Línea de Crédito', monedas: ['PEN', 'USD'], requiereCuenta: false, requiereReferencia: true },
  { id: 'mercado_pago', label: 'Mercado Pago', monedas: ['PEN'], requiereCuenta: true, requiereReferencia: false },
  { id: 'paypal', label: 'PayPal', monedas: ['USD'], requiereCuenta: true, requiereReferencia: true },
  { id: 'zelle', label: 'Zelle', monedas: ['USD'], requiereCuenta: true, requiereReferencia: true },
  { id: 'otro', label: 'Otro', monedas: ['PEN', 'USD'], requiereCuenta: false, requiereReferencia: false },
];

// ============================================
// PAGO UNIFICADO (estructura base para todo el sistema)
// ============================================

export type OrigenPago = 'venta' | 'orden_compra' | 'gasto' | 'viajero' | 'otro';

export interface PagoUnificado {
  id: string;
  // Contexto
  origen: OrigenPago;
  origenId: string;                    // ventaId, ocId, gastoId, transferenciaId
  origenNumero?: string;               // VT-2026-001, OC-2026-003, etc.

  // Monto
  monedaPago: 'PEN' | 'USD';
  montoOriginal: number;               // en la moneda de pago
  montoUSD: number;                    // siempre calculado
  montoPEN: number;                    // siempre calculado
  tipoCambio: number;

  // Método
  metodoPago: MetodoPagoUnificado;
  cuentaOrigenId?: string;             // cuenta de tesorería
  cuentaOrigenNombre?: string;         // desnormalizado
  referencia?: string;                 // número de operación

  // Línea de crédito (si aplica)
  lineaCreditoId?: string;
  lineaCreditoNombre?: string;
  numeroCuota?: number;                // cuota 1 de 3, etc.
  totalCuotas?: number;

  // Metadata
  fecha: Date;                         // fecha real del pago
  fechaRegistro: Date;                 // cuándo se registró en el sistema
  registradoPor: string;               // uid del usuario
  notas?: string;
  comprobante?: string;                // URL de foto/PDF

  // Tesorería
  movimientoTesoreriaId?: string;      // link al movimiento generado
}

// ============================================
// LÍNEA DE CRÉDITO BANCARIA
// ============================================

export interface LineaCredito {
  id: string;
  banco: string;                       // "BCP", "Interbank", etc.
  tipo: 'revolvente' | 'cuotas' | 'tarjeta_credito';
  moneda: 'PEN' | 'USD';
  limiteTotal: number;
  utilizado: number;                   // suma de pagos activos con esta línea
  disponible: number;                  // limiteTotal - utilizado
  tasaInteres?: number;                // % anual
  fechaVencimiento?: Date;             // cuándo vence la línea
  activa: boolean;
  notas?: string;
  // Metadata
  fechaCreacion: Date;
  creadoPor: string;
}

export interface CuotaLineaCredito {
  id: string;
  lineaCreditoId: string;
  lineaCreditoNombre: string;
  pagoOrigenId: string;                // el PagoUnificado que generó esta cuota
  origenTipo: OrigenPago;
  origenNumero?: string;
  numeroCuota: number;
  totalCuotas: number;
  montoOriginal: number;
  moneda: 'PEN' | 'USD';
  fechaVencimiento: Date;
  estado: 'pendiente' | 'pagada' | 'vencida';
  fechaPago?: Date;
  pagoId?: string;                     // PagoUnificado del pago de la cuota
}

// ============================================
// RESUMEN DE CxC / CxP (para reportes)
// ============================================

export interface CuentaPorCobrarDetalle {
  clienteId: string;
  clienteNombre: string;
  ventaId: string;
  ventaNumero: string;
  fechaVenta: Date;
  montoTotal: number;
  montoCobrado: number;
  montoPendiente: number;
  diasPendiente: number;
  rango: '0-7' | '8-15' | '16-30' | '31-60' | '60+';
  ultimoPago?: Date;
  canal: string;
}

export interface CuentaPorPagarDetalle {
  tipo: 'proveedor' | 'viajero' | 'gasto' | 'linea_credito';
  contraparteId: string;
  contraparteNombre: string;
  documentoId: string;
  documentoNumero: string;
  fechaDocumento: Date;
  montoTotal: number;
  montoPagado: number;
  montoPendiente: number;
  moneda: 'PEN' | 'USD';
  diasPendiente: number;
  rango: '0-7' | '8-15' | '16-30' | '31-60' | '60+';
  urgencia: 'normal' | 'proximo' | 'vencido';
}

export interface ResumenLiquidez {
  // Saldos
  saldoCuentasPEN: number;
  saldoCuentasUSD: number;
  saldoTotalPEN: number;              // PEN + USD×TC

  // CxC
  totalCxC: number;
  cxcVencida: number;
  dso: number;                         // Days Sales Outstanding

  // CxP
  totalCxP: number;
  cxpProxima7d: number;
  dpo: number;                         // Days Payable Outstanding

  // Líneas de crédito
  creditoDisponible: number;
  creditoUtilizado: number;

  // Flujo neto
  flujoNeto: number;                   // saldo + CxC - CxP
  ratioCobertura: number;              // saldo / CxP proxima 30d
  semaforo: 'verde' | 'amarillo' | 'rojo';

  // Métricas
  ventasMes: number;
  gastosMes: number;
  puntoEquilibrio: number;             // gastos fijos / margen bruto %
  mesesOperacion: number;              // saldo / gastos fijos mensuales
}

// ============================================
// FORM DATA (para el componente unificado)
// ============================================

export interface PagoFormData {
  monedaPago: 'PEN' | 'USD';
  montoOriginal: number;
  tipoCambio: number;
  metodoPago: MetodoPagoUnificado;
  cuentaOrigenId: string;
  referencia: string;
  notas: string;
  fechaPago: string;                   // ISO date string
  // Línea de crédito
  lineaCreditoId?: string;
  numeroCuotas?: number;
  // Flags
  esPagoCompleto: boolean;
}
