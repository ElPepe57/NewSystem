/**
 * pago.types.ts
 *
 * Modelo UNIFICADO de pagos para todo el sistema.
 * Reemplaza: PagoVenta, PagoOrdenCompra, PagoViajero, PagoGasto
 *
 * Todos los formularios de pago del ERP deben usar este modelo.
 */

// ============================================
// MÉTODOS DE PAGO
// ============================================
// Los métodos disponibles se derivan de las CUENTAS configuradas en Tesorería.
// Cada cuenta define qué métodos acepta según su tipo y banco.
//
// Ejemplo real del negocio:
//   BCP  → transferencia, yape
//   IBK  → transferencia, plin
//   Caja → efectivo
//   Tarjeta BCP → tarjeta_debito, tarjeta_credito (con línea de crédito)
//   MercadoPago → mercado_pago
//   PayPal → paypal
//   Zelle → zelle (via cuenta USD)

export type MetodoPagoUnificado =
  | 'efectivo'
  | 'transferencia'
  | 'yape'
  | 'plin'
  | 'tarjeta_debito'
  | 'tarjeta_credito'
  | 'mercado_pago'
  | 'paypal'
  | 'zelle'
  | 'otro';

/** Métodos que cada tipo de cuenta puede ofrecer */
export const METODOS_POR_TIPO_CUENTA: Record<string, MetodoPagoUnificado[]> = {
  efectivo: ['efectivo'],
  banco:    ['transferencia', 'yape', 'plin'],          // el banco define cuáles aplican
  digital:  ['mercado_pago', 'paypal', 'zelle', 'otro'],
  credito:  ['tarjeta_debito', 'tarjeta_credito'],
};

/** Metadata de cada método */
export const METODOS_PAGO_INFO: Record<MetodoPagoUnificado, {
  label: string;
  requiereReferencia: boolean;
}> = {
  efectivo:         { label: 'Efectivo',         requiereReferencia: false },
  transferencia:    { label: 'Transferencia',    requiereReferencia: true },
  yape:             { label: 'Yape',             requiereReferencia: false },
  plin:             { label: 'Plin',             requiereReferencia: false },
  tarjeta_debito:   { label: 'Tarjeta Débito',  requiereReferencia: true },
  tarjeta_credito:  { label: 'Tarjeta Crédito', requiereReferencia: true },
  mercado_pago:     { label: 'Mercado Pago',     requiereReferencia: false },
  paypal:           { label: 'PayPal',           requiereReferencia: true },
  zelle:            { label: 'Zelle',            requiereReferencia: true },
  otro:             { label: 'Otro',             requiereReferencia: false },
};

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
  estado: 'pendiente' | 'pagado' | 'vencida';
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
