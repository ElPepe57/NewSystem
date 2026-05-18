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
 *
 * D5 + D12 (chk5.D-S1e · 2026-05-15): `caja_recaudadora` es 6to tipo
 * agregado para terceros que recaudan en nombre del negocio (ej. GK Xpress)
 * via N canales aceptados (multi-canal) · balance consolidado · 1 sola CC
 * con el proveedor · liquidacion periodica al banco destino.
 * Ver DEUDA-MODELO-RECAUDADOR (refinada) en docs/mockups/SUPERSEDED-v5.md.
 */
export type TipoProductoFinanciero =
  | 'cuenta_corriente'
  | 'cuenta_ahorros'
  | 'tarjeta_credito'
  | 'tarjeta_debito'
  | 'caja_efectivo'
  | 'wallet_digital'
  | 'caja_recaudadora';

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
// CANAL RECAUDACION (D12 · chk5.D-S1e · multi-canal Caja Recaudadora)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Canales por los cuales un tercero recaudador puede cobrar en nombre del
 * negocio. Cubre TODAS las modalidades reales operadas en Peru:
 *   - Digitales: yape, plin, sip, agora, bim
 *   - Fisica: efectivo (cash physical · manual report)
 *   - POS terminals: niubiz, izipay, visanet
 *   - Bancario: transferencia (banco directo)
 *
 * NOTA: estos canales NO requieren validacion banco<->canal (a diferencia
 * de TipoCanalDigital de cuenta_corriente/ahorros). El recaudador tercero
 * usa sus propias cuentas/POS · solo le interesa al negocio el monto que
 * le cobran a su cliente final y la liquidacion consolidada.
 */
export type TipoCanalRecaudacion =
  | 'yape'
  | 'plin'
  | 'sip'
  | 'agora'
  | 'bim'
  | 'efectivo'
  | 'pos_niubiz'
  | 'pos_izipay'
  | 'pos_visanet'
  | 'transferencia';

export const CANAL_RECAUDACION_LABEL: Record<TipoCanalRecaudacion, string> = {
  yape:           'Yape',
  plin:           'Plin',
  sip:            'SIP',
  agora:          'Ágora',
  bim:            'BIM',
  efectivo:       'Efectivo',
  pos_niubiz:     'POS Niubiz',
  pos_izipay:     'POS Izipay',
  pos_visanet:    'POS Visanet',
  transferencia:  'Transferencia bancaria',
};

/**
 * Color semantico canon v8.0 por canal de recaudacion (para UI consistente).
 * Mantener sincronizado con docs/mockups MOCK 2 drawer Caja recaudadora.
 */
export const CANAL_RECAUDACION_COLOR: Record<TipoCanalRecaudacion, string> = {
  yape:           'purple',
  plin:           'cyan',
  sip:            'amber',
  agora:          'emerald',
  bim:            'sky',
  efectivo:       'emerald',
  pos_niubiz:     'amber',
  pos_izipay:     'amber',
  pos_visanet:    'amber',
  transferencia:  'teal',
};

/**
 * Canal aceptado en una Caja Recaudadora. Diferente de CanalDigital:
 *   - No requiere validacion banco (el recaudador tercero usa sus cuentas)
 *   - Tiene flag `activo` para desactivar temporalmente sin eliminar histórico
 *   - `identificador` opcional (efectivo no tiene · POS tiene merchant ID)
 */
export interface CanalAceptado {
  tipo: TipoCanalRecaudacion;
  identificador?: string;                  // Cel Yape/Plin · merchant ID POS · CCI · N/A para efectivo
  activo: boolean;                         // Desactivable sin perder histórico (ej. POS en reparación)
}

// ═════════════════════════════════════════════════════════════════════════
// TARIFA SERVICIO (D5 · Caja Recaudadora · como cobra el recaudador)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Tarifa del recaudador por su servicio. Se descuenta del saldo a liquidar
 * en cada liquidacion periodica al negocio.
 *
 * Tipos:
 *   - 'fijo_por_evento': monto fijo por cada evento (ej. S/ 25 por carrera de GK Xpress)
 *   - 'porcentaje': % del monto cobrado (ej. 2% sobre cobro)
 *   - 'mixto': % + fijo (ej. 1.5% + S/ 5 por evento)
 *
 * El campo `eventoLabel` es display de la unidad de cobro
 * (ej. "por carrera" · "por envio" · "por transaccion").
 */
export interface TarifaServicio {
  tipo: 'fijo_por_evento' | 'porcentaje' | 'mixto';
  valor: number;                           // Monto fijo o % segun tipo
  valorAdicional?: number;                 // Solo si tipo='mixto' (el componente fijo del mixto)
  eventoLabel: string;                     // "por carrera", "por envio", "por transaccion"
  /** Vigencia · si cambia tarifa se preserva la antigua para eventos viejos */
  vigenteDesde: Timestamp;
}

export const TIPO_TARIFA_LABEL: Record<TarifaServicio['tipo'], string> = {
  fijo_por_evento: 'Fijo por evento',
  porcentaje:      'Porcentaje del cobro',
  mixto:           'Mixto · % + fijo',
};

// ═════════════════════════════════════════════════════════════════════════
// RESPONSABLE TERCERO (D5 · Caja Recaudadora)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Tipo de entidad que puede ser responsable tercero de una Caja Recaudadora.
 * Tipicamente es 'proveedor' (GK Xpress · servicios logisticos · etc.)
 * pero puede ser 'colaborador' (freelance que cobra a clientes) o 'cliente'
 * (cliente grande que recauda para su grupo).
 */
export type TipoResponsableTercero = 'proveedor' | 'colaborador' | 'cliente';

export const TIPO_RESPONSABLE_TERCERO_LABEL: Record<TipoResponsableTercero, string> = {
  proveedor:    'Proveedor',
  colaborador:  'Colaborador',
  cliente:      'Cliente',
};

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

  // ─── Caja Recaudadora (D5 + D12 · solo si tipoProducto='caja_recaudadora') ─
  /**
   * Tercero responsable que recauda en nombre del negocio (ej. GK Xpress).
   * Vincula a entidad del modulo correspondiente (proveedor/colaborador/cliente).
   */
  responsableTerceroId?: string;
  responsableTerceroTipo?: TipoResponsableTercero;
  responsableTerceroNombre?: string;       // Display denormalizado

  /**
   * Tarifa que cobra el recaudador por su servicio · se descuenta de cada
   * liquidacion. Ver TarifaServicio para tipos posibles.
   */
  tarifaServicio?: TarifaServicio;

  /**
   * Cuenta destino donde el recaudador liquida el saldo periodico al negocio.
   * Tipicamente BCP Soles Operativa. Solo PEN (raro USD recaudadora local).
   */
  cuentaLiquidacionDefaultId?: string;

  /**
   * Canales aceptados multi-canal · el cliente final paga con cualquiera de
   * estos al recaudador · balance se consolida. NO confundir con
   * `canalesDigitales` (que es para cuenta bancaria normal).
   */
  canalesAceptados?: CanalAceptado[];

  /**
   * Frecuencia esperada de liquidacion · informativa para alertas.
   */
  frecuenciaLiquidacion?: 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'a_demanda';

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

  // Caja Recaudadora (D5 + D12)
  responsableTerceroId?: string;
  responsableTerceroTipo?: TipoResponsableTercero;
  responsableTerceroNombre?: string;
  tarifaServicio?: TarifaServicio;
  cuentaLiquidacionDefaultId?: string;
  canalesAceptados?: CanalAceptado[];
  frecuenciaLiquidacion?: 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'a_demanda';

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
 * Caja recaudadora tampoco tiene RelacionBancaria directa · el banco
 * relevante es el del recaudador (de su POS/Yape/etc.) que es opaco al negocio.
 */
export const TIPOS_SIN_BANCO: TipoProductoFinanciero[] = [
  'caja_efectivo',
  'wallet_digital',
  'caja_recaudadora',
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

// ─── Helpers Caja Recaudadora (D5 + D12) ──────────────────────────────

/**
 * Indica si el tipo requiere configuracion de responsable tercero + tarifa
 * servicio + canales aceptados (solo Caja Recaudadora).
 */
export function requiereResponsableTercero(
  tipo: TipoProductoFinanciero,
): boolean {
  return tipo === 'caja_recaudadora';
}

/**
 * Indica si el tipo admite multi-canal de recaudacion (vs canales digitales
 * de cuenta bancaria que tienen validacion banco<->canal).
 */
export function admiteCanalesRecaudacion(
  tipo: TipoProductoFinanciero,
): boolean {
  return tipo === 'caja_recaudadora';
}

/**
 * Valida configuracion de canal aceptado para Caja Recaudadora.
 * Reglas:
 *   - efectivo: NO requiere identificador
 *   - todos los demas: SI requieren identificador (cel/merchant ID/CCI)
 * Retorna null si OK, o un mensaje de error si hay inconsistencia.
 */
export function validarCanalRecaudacion(
  canal: CanalAceptado,
): string | null {
  const requiereIdentificador = canal.tipo !== 'efectivo';
  if (requiereIdentificador && (!canal.identificador || !canal.identificador.trim())) {
    return `${CANAL_RECAUDACION_LABEL[canal.tipo]}: falta identificador (celular · merchant ID · CCI).`;
  }
  return null;
}

/**
 * Valida que el array de canales aceptados sea valido:
 *   - Al menos 1 canal activo
 *   - Cada canal pasa validarCanalRecaudacion()
 *   - No hay tipos duplicados
 */
export function validarCanalesAceptados(
  canales: CanalAceptado[],
): string | null {
  if (canales.length === 0) {
    return 'Debe haber al menos 1 canal aceptado configurado.';
  }
  const activos = canales.filter((c) => c.activo);
  if (activos.length === 0) {
    return 'Debe haber al menos 1 canal activo (los inactivos se preservan pero no aceptan cobros).';
  }
  const tipos = new Set<TipoCanalRecaudacion>();
  for (const canal of canales) {
    if (tipos.has(canal.tipo)) {
      return `Canal ${CANAL_RECAUDACION_LABEL[canal.tipo]} duplicado · use solo uno por tipo.`;
    }
    tipos.add(canal.tipo);
    const err = validarCanalRecaudacion(canal);
    if (err) return err;
  }
  return null;
}

export const TIPO_PRODUCTO_LABEL: Record<TipoProductoFinanciero, string> = {
  cuenta_corriente:  'Cuenta corriente',
  cuenta_ahorros:    'Cuenta de ahorros',
  tarjeta_credito:   'Tarjeta de crédito',
  tarjeta_debito:    'Tarjeta de débito',
  caja_efectivo:     'Caja efectivo',
  wallet_digital:    'Wallet digital',
  caja_recaudadora:  'Caja recaudadora',
};

export const FRECUENCIA_LIQUIDACION_LABEL: Record<
  NonNullable<ProductoFinanciero['frecuenciaLiquidacion']>,
  string
> = {
  diaria:     'Diaria',
  semanal:    'Semanal',
  quincenal:  'Quincenal',
  mensual:    'Mensual',
  a_demanda:  'A demanda',
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
