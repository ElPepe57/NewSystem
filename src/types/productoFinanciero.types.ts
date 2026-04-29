/**
 * productoFinanciero.types.ts — ADR-PF-001 · F1
 *
 * Entidad madre que reemplaza a CuentaCaja + TarjetaCredito (legacy).
 * Discriminator: `tipoProducto`. Campos comunes + condicionales por tipo.
 *
 * Decisiones aplicadas:
 *   - D-PF-1: Una sola coleccion `productosFinancieros` con discriminator
 *   - D-PF-2: Vinculo titular - banco via `relacionBancariaId`
 *   - D-PF-3: Saldo cacheado + libro mayor como fuente de verdad
 *   - P-1 (Opcion C): Yape/Plin/SIP/Agora/BIM son CANALES adosados, no productos
 *
 * Coexiste con CuentaCaja y TarjetaCredito durante F1-F4. Se elimina la
 * duplicacion en F5.
 */

import { Timestamp } from 'firebase/firestore';
import type {
  TitularidadPF,
  TipoEntidadTitularPF,
} from './relacionBancaria.types';

// Re-export para que el resto del modulo no tenga que importar 2 veces
export type { TitularidadPF, TipoEntidadTitularPF };

// ═════════════════════════════════════════════════════════════════════════
// MONEDA
// ═════════════════════════════════════════════════════════════════════════

export type MonedaPF = 'USD' | 'PEN';

// ═════════════════════════════════════════════════════════════════════════
// TIPO DE PRODUCTO (discriminator)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Resolucion P-1 (Opcion C): Yape/Plin/SIP/Agora/BIM NO son productos
 * independientes — son canales adosados a una cuenta banco. Solo wallets
 * con saldo PROPIO independiente del banco son `wallet_digital`
 * (PayPal, Wise, MercadoPago, Zelle, Binance).
 */
export type TipoProductoFinanciero =
  | 'cuenta_corriente'
  | 'cuenta_ahorros'
  | 'tarjeta_credito'
  | 'tarjeta_debito'
  | 'caja_efectivo'
  | 'wallet_digital';

// ═════════════════════════════════════════════════════════════════════════
// PROVEEDOR DE WALLET DIGITAL
// ═════════════════════════════════════════════════════════════════════════

export type ProveedorWallet =
  | 'paypal'
  | 'wise'
  | 'mercadopago'
  | 'zelle'
  | 'binance';

// ═════════════════════════════════════════════════════════════════════════
// CANAL DIGITAL (Yape, Plin, SIP, Agora, BIM)
// ═════════════════════════════════════════════════════════════════════════

export type TipoCanalDigital = 'yape' | 'plin' | 'sip' | 'agora' | 'bim';

/**
 * Cada tipo de canal pertenece a UN banco especifico (invariante operativo
 * confirmado por el usuario). La validacion del form debe rechazar adosar
 * un canal a una RelacionBancaria del banco equivocado.
 *
 * Confirmado por el usuario:
 *   - yape  → BCP
 *   - plin  → IBK (Interbank)
 *   - sip   → Financiera Oh
 *
 * Pendiente de confirmar en F1 antes de F4:
 *   - agora → ?
 *   - bim   → ?
 */
export const CANAL_BANCO_MAP: Record<TipoCanalDigital, string> = {
  yape:  'BCP',
  plin:  'IBK',
  sip:   'Financiera Oh',
  agora: 'AGORA',                          // REVISAR EN F1
  bim:   'BIM',                            // REVISAR EN F1
};

export const CANAL_LABEL: Record<TipoCanalDigital, string> = {
  yape:  'Yape',
  plin:  'Plin',
  sip:   'SIP',
  agora: 'Ágora',
  bim:   'BIM',
};

export interface CanalDigital {
  tipo: TipoCanalDigital;
  identificador: string;                   // Numero telefono / alias
  titular?: string;                        // Display titular del canal
}

// ═════════════════════════════════════════════════════════════════════════
// MARCA DE TARJETA
// ═════════════════════════════════════════════════════════════════════════

export type MarcaTarjeta =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'diners'
  | 'otro';

// ═════════════════════════════════════════════════════════════════════════
// PRODUCTO FINANCIERO (entidad principal)
// ═════════════════════════════════════════════════════════════════════════

export interface ProductoFinanciero {
  id: string;
  codigo: string;                          // PF-001, PF-002, etc.
  nombre: string;                          // "BCP Cta Ahorros USD", "Visa BBVA ····6411"
  tipoProducto: TipoProductoFinanciero;

  // ─── Vinculacion bancaria ──────────────────────────────────────────
  /**
   * NULL para caja_efectivo y wallet_digital sin banco asociado.
   * Para tarjetas y cuentas: SIEMPRE tiene RelacionBancaria.
   */
  relacionBancariaId?: string;
  banco?: string;                          // Denormalizado para queries rapidas
  bancoNombreCompleto?: string;            // Denormalizado

  // ─── Moneda ─────────────────────────────────────────────────────────
  moneda: MonedaPF;                        // Moneda principal
  esBiMoneda: boolean;                     // true = USD + PEN simultaneos

  // ─── Saldos (cache, fuente de verdad = movimientosFinancieros) ─────
  /**
   * D-PF-3: hibrido. El libro mayor es la verdad. Estos campos son cache
   * para lecturas rapidas en listas y dashboards. Se actualizan por:
   *   - Trigger automatico al insertar MovimientoFinanciero
   *   - Cron mensual de reconciliacion
   *   - Boton manual "recalcular saldos"
   */
  saldoActual: number;                     // Mono-moneda
  saldoUSD?: number;                       // Solo bi-moneda
  saldoPEN?: number;                       // Solo bi-moneda
  saldoActualizadoEn: Timestamp;

  // ─── Alertas (saldo minimo) ────────────────────────────────────────
  saldoMinimo?: number;
  saldoMinimoUSD?: number;
  saldoMinimoPEN?: number;

  // ─── Titularidad ────────────────────────────────────────────────────
  /**
   * Hereda de RelacionBancaria cuando existe. Para productos sin banco
   * (caja_efectivo, wallet_digital sin banco), se setea aqui directamente.
   */
  titularidad: TitularidadPF;
  titularEntidadId?: string;               // Solo si titularidad='personal'
  titularEntidadTipo?: TipoEntidadTitularPF;
  titularNombre?: string;                  // Display denormalizado

  // ─── Datos bancarios (cuenta_corriente / cuenta_ahorros) ───────────
  numeroCuenta?: string;
  cci?: string;                            // Codigo Cuenta Interbancario (Peru)
  numerosAdicionales?: Array<{
    tipo: string;                          // SWIFT, IBAN, ABA, etc.
    numero: string;
    etiqueta?: string;
  }>;

  // ─── Tarjeta debito ─────────────────────────────────────────────────
  /** Solo cuando tipoProducto='tarjeta_debito': producto de ahorros vinculado. */
  cuentaVinculadaId?: string;

  // ─── Tarjeta credito (condicional) ─────────────────────────────────
  ultimosDigitos?: string;                 // "6411"
  marca?: MarcaTarjeta;
  diaCorte?: number;                       // 1-31
  diaPago?: number;                        // 1-31
  topeControlUSD?: number;                 // Alerta, NO es limite real
  topeControlPEN?: number;
  cuentaPagoDefaultId?: string;            // Cuenta default desde donde se paga

  // ─── Wallet digital ─────────────────────────────────────────────────
  proveedorWallet?: ProveedorWallet;
  identificadorWallet?: string;            // Email, telefono, alias

  // ─── Metodos de pago aceptados ──────────────────────────────────────
  metodosDisponibles?: string[];

  // ─── Canales digitales adosados (Yape/Plin/SIP/Agora/BIM) ──────────
  /**
   * Solo aplica a cuenta_corriente y cuenta_ahorros.
   * Cada canal debe coincidir con CANAL_BANCO_MAP[tipo] === banco.
   */
  canalesDigitales?: CanalDigital[];

  // ─── Configuracion ──────────────────────────────────────────────────
  esCuentaPorDefecto?: boolean;            // Si es la cuenta por defecto del negocio

  // ─── Estado ─────────────────────────────────────────────────────────
  activa: boolean;

  // ─── Auditoria ──────────────────────────────────────────────────────
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

// ═════════════════════════════════════════════════════════════════════════
// FORM DATA (para wizards)
// ═════════════════════════════════════════════════════════════════════════

export interface ProductoFinancieroFormData {
  nombre: string;
  tipoProducto: TipoProductoFinanciero;

  // Banco
  relacionBancariaId?: string;
  banco?: string;
  bancoNombreCompleto?: string;

  // Moneda
  moneda: MonedaPF;
  esBiMoneda: boolean;

  // Saldo inicial (solo en CREACION)
  saldoInicial?: number;
  saldoInicialUSD?: number;
  saldoInicialPEN?: number;

  // Titularidad
  titularidad: TitularidadPF;
  titularEntidadId?: string;
  titularEntidadTipo?: TipoEntidadTitularPF;
  titularNombre?: string;

  // Cuenta bancaria
  numeroCuenta?: string;
  cci?: string;
  numerosAdicionales?: Array<{
    tipo: string;
    numero: string;
    etiqueta?: string;
  }>;

  // Tarjeta debito
  cuentaVinculadaId?: string;

  // Tarjeta credito
  ultimosDigitos?: string;
  marca?: MarcaTarjeta;
  diaCorte?: number;
  diaPago?: number;
  topeControlUSD?: number;
  topeControlPEN?: number;
  cuentaPagoDefaultId?: string;

  // Wallet
  proveedorWallet?: ProveedorWallet;
  identificadorWallet?: string;

  // Metodos
  metodosDisponibles?: string[];
  canalesDigitales?: CanalDigital[];

  // Config
  esCuentaPorDefecto?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

/**
 * Tipos que requieren RelacionBancaria obligatoria.
 */
export const TIPOS_CON_BANCO: TipoProductoFinanciero[] = [
  'cuenta_corriente',
  'cuenta_ahorros',
  'tarjeta_credito',
  'tarjeta_debito',
];

/**
 * Tipos que NO tienen banco asociado.
 */
export const TIPOS_SIN_BANCO: TipoProductoFinanciero[] = [
  'caja_efectivo',
  'wallet_digital',
];

export function requiereRelacionBancaria(
  tipo: TipoProductoFinanciero,
): boolean {
  return TIPOS_CON_BANCO.includes(tipo);
}

/**
 * Permite saber si un producto admite canales digitales adosados
 * (Yape/Plin/SIP/Agora/BIM).
 */
export function admiteCanalesDigitales(
  tipo: TipoProductoFinanciero,
): boolean {
  return tipo === 'cuenta_corriente' || tipo === 'cuenta_ahorros';
}

/**
 * Valida que un canal digital sea consistente con el banco del producto.
 * Retorna null si OK, o un mensaje de error si hay inconsistencia.
 */
export function validarCanalDigital(
  canal: CanalDigital,
  banco: string,
): string | null {
  const bancoEsperado = CANAL_BANCO_MAP[canal.tipo];
  if (bancoEsperado !== banco) {
    return `${CANAL_LABEL[canal.tipo]} solo puede adosarse a ${bancoEsperado}, no a ${banco}.`;
  }
  if (!canal.identificador.trim()) {
    return `${CANAL_LABEL[canal.tipo]}: falta identificador (número o alias).`;
  }
  return null;
}

export const TIPO_PRODUCTO_LABEL: Record<TipoProductoFinanciero, string> = {
  cuenta_corriente: 'Cuenta corriente',
  cuenta_ahorros:   'Cuenta de ahorros',
  tarjeta_credito:  'Tarjeta de crédito',
  tarjeta_debito:   'Tarjeta de débito',
  caja_efectivo:    'Caja efectivo',
  wallet_digital:   'Wallet digital',
};

export const PROVEEDOR_WALLET_LABEL: Record<ProveedorWallet, string> = {
  paypal:      'PayPal',
  wise:        'Wise',
  mercadopago: 'MercadoPago',
  zelle:       'Zelle',
  binance:     'Binance',
};

export const MARCA_TARJETA_LABEL: Record<MarcaTarjeta, string> = {
  visa:       'Visa',
  mastercard: 'Mastercard',
  amex:       'American Express',
  diners:     'Diners Club',
  otro:       'Otro',
};
