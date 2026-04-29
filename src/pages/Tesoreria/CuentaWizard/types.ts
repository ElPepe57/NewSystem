/**
 * types.ts — CuentaWizard internal state · S58c v2
 *
 * Wizard de creación de cuenta bancaria con 4-5 pasos según el flujo:
 *   Paso 1 · Tipo + producto financiero
 *   Paso 2 · Identidad bancaria (banco, nombre, número, CCI) · solo banco/digital
 *   Paso 2.5 · Titularidad personal (intercalado si titularidad='personal')
 *   Paso 3 · Moneda + saldo del negocio
 *   Paso 4 · Métodos + canales digitales (Yape/Plin/SIP/Ágora/BIM si banco)
 *
 * El estado final se mapea a CuentaCajaFormData para llamar al service.
 */

import type {
  CuentaCajaFormData,
  CuentaCaja,
  MonedaTesoreria,
  MetodoTesoreria,
} from '../../../types/tesoreria.types';

// ═════════════════════════════════════════════════════════════════════════
// PASOS
// ═════════════════════════════════════════════════════════════════════════

export type PasoCuentaWizard = 1 | 2 | 3 | 4;

export const PASOS_LABEL: Record<PasoCuentaWizard, string> = {
  1: 'Tipo',
  2: 'Identidad',
  3: 'Saldo',
  4: 'Métodos',
};

// ═════════════════════════════════════════════════════════════════════════
// TIPO Y PRODUCTO
// ═════════════════════════════════════════════════════════════════════════

export type TipoCuenta = 'banco' | 'digital' | 'efectivo' | 'credito';

export type ProductoFinancieroNuevo =
  | 'cuenta_ahorros'
  | 'cuenta_corriente'
  | 'tarjeta_debito'
  | 'tarjeta_credito'              // F3c.5 · ADR-PF-001
  | 'caja'
  | 'mercadopago'
  | 'paypal'
  | 'zelle'
  | 'wise'
  | 'binance';

/**
 * Productos válidos por tipo (S58c v2 sección 2 del mockup).
 */
export const PRODUCTOS_POR_TIPO: Record<TipoCuenta, ProductoFinancieroNuevo[]> = {
  banco: ['cuenta_ahorros', 'cuenta_corriente'],
  digital: ['mercadopago', 'paypal', 'zelle', 'wise', 'binance'],
  efectivo: ['caja'],
  credito: ['tarjeta_debito', 'tarjeta_credito'],   // F3c.5
};

export const PRODUCTO_LABEL: Record<ProductoFinancieroNuevo, string> = {
  cuenta_ahorros: 'Cuenta de ahorros',
  cuenta_corriente: 'Cuenta corriente',
  tarjeta_debito: 'Tarjeta débito',
  tarjeta_credito: 'Tarjeta de crédito',
  caja: 'Efectivo',
  mercadopago: 'Mercado Pago',
  paypal: 'PayPal',
  zelle: 'Zelle',
  wise: 'Wise',
  binance: 'Binance',
};

// ═════════════════════════════════════════════════════════════════════════
// CANALES DIGITALES
// ═════════════════════════════════════════════════════════════════════════

export type TipoCanalDigital = 'yape' | 'plin' | 'sip' | 'agora' | 'bim';

export const CANAL_LABEL: Record<TipoCanalDigital, string> = {
  yape: 'Yape',
  plin: 'Plin',
  sip: 'SIP',
  agora: 'Ágora',
  bim: 'BIM',
};

export const CANAL_COLOR: Record<TipoCanalDigital, string> = {
  yape: 'purple',
  plin: 'cyan',
  sip: 'amber',
  agora: 'emerald',
  bim: 'sky',
};

// ═════════════════════════════════════════════════════════════════════════
// STATE
// ═════════════════════════════════════════════════════════════════════════

export interface CuentaWizardState {
  // ── Paso 1 ──
  tipo: TipoCuenta;
  productoFinanciero: ProductoFinancieroNuevo | undefined;

  // ── Paso 2 ──
  banco: string;                  // Alias corto: BCP, IBK, BBVA
  bancoNombreCompleto: string;
  nombre: string;                 // Nombre interno
  ultimosCuatro: string;          // Para identificar
  numeroCuenta: string;
  cci: string;
  cuentaVinculadaId: string;      // Para tarjeta_debito

  // ── Tarjeta crédito (F3c.5 · ADR-PF-001) ──
  // Solo aplica cuando productoFinanciero='tarjeta_credito'
  marcaTC: 'visa' | 'mastercard' | 'amex' | 'diners' | 'otro' | undefined;
  diaCorte: number | undefined;   // 1-31
  diaPago: number | undefined;    // 1-31
  topeControlUSD: number | undefined;
  topeControlPEN: number | undefined;
  cuentaPagoDefaultId: string;    // Cuenta default desde donde se paga estado de cuenta

  // ── Titularidad (intercalado en Paso 2 cuando aplica) ──
  titularidad: 'empresa' | 'personal';
  titularEntidadId: string;
  titularEntidadTipo: 'empleado' | 'colaborador' | 'proveedor' | 'cliente' | undefined;
  titularNombre: string;          // Display del titular (auto desde entidad o manual)

  // ── Paso 3 ──
  esBiMoneda: boolean;
  moneda: MonedaTesoreria;        // Mono-moneda o moneda principal
  saldoInicial: number;           // Mono-moneda (saldo del negocio actual)
  saldoInicialUSD: number;        // Bi-moneda
  saldoInicialPEN: number;        // Bi-moneda

  // ── Paso 4 ──
  metodosDisponibles: MetodoTesoreria[];
  canalesDigitales: Array<{ tipo: TipoCanalDigital; identificador: string }>;
  esCuentaPorDefecto: boolean;
}

export const INITIAL_STATE: CuentaWizardState = {
  tipo: 'banco',
  productoFinanciero: undefined,

  banco: '',
  bancoNombreCompleto: '',
  nombre: '',
  ultimosCuatro: '',
  numeroCuenta: '',
  cci: '',
  cuentaVinculadaId: '',

  marcaTC: undefined,
  diaCorte: undefined,
  diaPago: undefined,
  topeControlUSD: undefined,
  topeControlPEN: undefined,
  cuentaPagoDefaultId: '',

  titularidad: 'empresa',
  titularEntidadId: '',
  titularEntidadTipo: undefined,
  titularNombre: 'Vita Skin Peru SAC',

  esBiMoneda: false,
  moneda: 'PEN',
  saldoInicial: 0,
  saldoInicialUSD: 0,
  saldoInicialPEN: 0,

  metodosDisponibles: ['transferencia_bancaria'],
  canalesDigitales: [],
  esCuentaPorDefecto: false,
};

// ═════════════════════════════════════════════════════════════════════════
// VALIDACIÓN POR PASO
// ═════════════════════════════════════════════════════════════════════════

export interface ValidacionPaso {
  valido: boolean;
  errores: string[];
}

export function validarPaso(
  paso: PasoCuentaWizard,
  state: CuentaWizardState,
): ValidacionPaso {
  const errores: string[] = [];

  if (paso === 1) {
    if (!state.tipo) errores.push('Selecciona el tipo de cuenta');
    if (!state.productoFinanciero) errores.push('Selecciona el producto financiero');
  }

  if (paso === 2) {
    if (!state.nombre.trim())
      errores.push('Asigna un nombre interno a la cuenta');
    if (state.tipo === 'banco') {
      if (!state.banco.trim()) errores.push('Indica el banco');
    }
    if (state.titularidad === 'personal') {
      if (!state.titularEntidadId)
        errores.push('Vincula la cuenta a una entidad (empleado/colaborador/proveedor/cliente)');
    }
    if (state.tipo === 'credito' && state.productoFinanciero === 'tarjeta_debito') {
      if (!state.cuentaVinculadaId)
        errores.push('Vincula la tarjeta débito a una cuenta de ahorros');
    }
    // F3c.5 · validaciones tarjeta crédito
    if (state.tipo === 'credito' && state.productoFinanciero === 'tarjeta_credito') {
      if (!state.banco.trim())
        errores.push('Indica el banco emisor de la tarjeta');
      if (!state.ultimosCuatro.trim() || state.ultimosCuatro.length !== 4)
        errores.push('Ingresa los últimos 4 dígitos de la tarjeta');
      if (!state.marcaTC)
        errores.push('Selecciona la marca (Visa/Mastercard/Amex/Diners)');
      if (!state.diaCorte || state.diaCorte < 1 || state.diaCorte > 31)
        errores.push('Día de corte debe estar entre 1 y 31');
      if (!state.diaPago || state.diaPago < 1 || state.diaPago > 31)
        errores.push('Día de pago debe estar entre 1 y 31');
    }
  }

  if (paso === 3) {
    if (!state.moneda) errores.push('Elige la moneda');
    if (state.esBiMoneda) {
      if (state.saldoInicialUSD < 0)
        errores.push('Saldo USD no puede ser negativo');
      if (state.saldoInicialPEN < 0)
        errores.push('Saldo PEN no puede ser negativo');
    } else {
      if (state.saldoInicial < 0)
        errores.push('Saldo inicial no puede ser negativo');
    }
  }

  if (paso === 4) {
    if (state.metodosDisponibles.length === 0)
      errores.push('Selecciona al menos un método de pago');
    // Validar que canales digitales tengan identificador
    for (const canal of state.canalesDigitales) {
      if (!canal.identificador.trim()) {
        errores.push(`Canal ${canal.tipo}: ingresa un identificador`);
        break;
      }
    }
  }

  return { valido: errores.length === 0, errores };
}

// ═════════════════════════════════════════════════════════════════════════
// MAPEO STATE → CuentaCajaFormData
// ═════════════════════════════════════════════════════════════════════════

/**
 * Convierte el estado del wizard al formato esperado por el service.
 * Aquí se aplica la lógica de "qué campos se mandan según tipo".
 */
export function mapStateToFormData(state: CuentaWizardState): CuentaCajaFormData {
  // Soporte bi-moneda solo para banco y caja
  const soportaBiMoneda = state.tipo === 'banco' || state.tipo === 'efectivo';
  const esBiMoneda = soportaBiMoneda && state.esBiMoneda;

  const data: CuentaCajaFormData = {
    nombre: state.nombre.trim(),
    titular: state.titularNombre.trim() || 'Vita Skin Peru SAC',
    tipo: state.tipo,

    esBiMoneda,
    moneda: state.moneda,

    saldoInicial: esBiMoneda ? 0 : state.saldoInicial,

    titularidad: state.titularidad,
    titularNombre: state.titularNombre.trim() || undefined,

    metodosDisponibles: state.metodosDisponibles,
    esCuentaPorDefecto: state.esCuentaPorDefecto,
  };

  if (esBiMoneda) {
    data.saldoInicialUSD = state.saldoInicialUSD;
    data.saldoInicialPEN = state.saldoInicialPEN;
  }

  if (state.productoFinanciero) {
    data.productoFinanciero = state.productoFinanciero;
  }

  // Datos bancarios solo si tipo='banco' o 'digital'
  if (state.tipo === 'banco' || state.tipo === 'digital') {
    if (state.banco.trim()) data.banco = state.banco.trim();
    if (state.bancoNombreCompleto.trim())
      data.bancoNombreCompleto = state.bancoNombreCompleto.trim();
    if (state.numeroCuenta.trim()) data.numeroCuenta = state.numeroCuenta.trim();
    if (state.cci.trim()) data.cci = state.cci.trim();
  }

  // Vinculación tarjeta débito → ahorros
  if (state.tipo === 'credito' && state.cuentaVinculadaId) {
    data.cuentaVinculadaId = state.cuentaVinculadaId;
  }

  // Titular estructurado (solo si titularidad='personal')
  if (state.titularidad === 'personal') {
    if (state.titularEntidadId) data.titularEntidadId = state.titularEntidadId;
    if (state.titularEntidadTipo)
      data.titularEntidadTipo = state.titularEntidadTipo;
  }

  // Canales digitales solo en banco
  if (state.tipo === 'banco' && state.canalesDigitales.length > 0) {
    data.canalesDigitales = state.canalesDigitales.filter(
      (c) => c.identificador.trim().length > 0,
    );
  }

  return data;
}

// ═════════════════════════════════════════════════════════════════════════
// HIDRATACIÓN: CuentaCaja → CuentaWizardState
// ═════════════════════════════════════════════════════════════════════════

/**
 * Construye el state inicial del wizard desde una cuenta existente,
 * para modo EDICIÓN. Mantiene compatibilidad con cuentas legacy v1
 * (sin titularEntidadId/canalesDigitales estructurados).
 */
export function hidratarStateDesdeCuenta(
  cuenta: CuentaCaja,
): CuentaWizardState {
  // Producto financiero — fallback según tipo si no hay
  const productoFinanciero = (cuenta.productoFinanciero ??
    (cuenta.tipo === 'banco'
      ? 'cuenta_ahorros'
      : cuenta.tipo === 'efectivo'
        ? 'caja'
        : cuenta.tipo === 'credito'
          ? 'tarjeta_debito'
          : 'mercadopago')) as ProductoFinancieroNuevo;

  // Tipo cuenta del wizard
  const tipo: TipoCuenta = (cuenta.tipo as TipoCuenta) ?? 'banco';

  // Canales digitales — preferir el campo nuevo, fallback al legacy metodosDetalle
  let canalesDigitales: CuentaWizardState['canalesDigitales'] = [];
  if (cuenta.canalesDigitales && cuenta.canalesDigitales.length > 0) {
    canalesDigitales = cuenta.canalesDigitales.map((c) => ({
      tipo: c.tipo,
      identificador: c.identificador,
    }));
  } else if (cuenta.metodosDetalle) {
    // Migración soft del shape legacy: { yape: { identificador: '999' } } → array
    canalesDigitales = Object.entries(cuenta.metodosDetalle)
      .filter(([tipo, det]) =>
        ['yape', 'plin', 'sip', 'agora', 'bim'].includes(tipo) &&
        det?.identificador,
      )
      .map(([tipo, det]) => ({
        tipo: tipo as CuentaWizardState['canalesDigitales'][number]['tipo'],
        identificador: det.identificador!,
      }));
  }

  // Ultimos 4 — derivar del numeroCuenta si no está explícito
  const numero = cuenta.numeroCuenta ?? '';
  const ultimosCuatro = numero
    ? numero.replace(/\D/g, '').slice(-4)
    : '';

  return {
    tipo,
    productoFinanciero,

    banco: cuenta.banco ?? '',
    bancoNombreCompleto: cuenta.bancoNombreCompleto ?? '',
    nombre: cuenta.nombre,
    ultimosCuatro,
    numeroCuenta: cuenta.numeroCuenta ?? '',
    cci: cuenta.cci ?? '',
    cuentaVinculadaId: cuenta.cuentaVinculadaId ?? '',

    // F3c.5 · campos tarjeta crédito (no existen en CuentaCaja legacy
    // — se hidratan desde un ProductoFinanciero real en la edición
    // inteligente del wizard).
    marcaTC: undefined,
    diaCorte: undefined,
    diaPago: undefined,
    topeControlUSD: undefined,
    topeControlPEN: undefined,
    cuentaPagoDefaultId: '',

    titularidad: cuenta.titularidad ?? 'empresa',
    titularEntidadId: cuenta.titularEntidadId ?? '',
    titularEntidadTipo: cuenta.titularEntidadTipo,
    titularNombre:
      cuenta.titularNombre ?? cuenta.titular ?? 'Vita Skin Peru SAC',

    esBiMoneda: cuenta.esBiMoneda ?? false,
    moneda: cuenta.moneda,
    saldoInicial: cuenta.saldoActual ?? 0,
    saldoInicialUSD: cuenta.saldoUSD ?? 0,
    saldoInicialPEN: cuenta.saldoPEN ?? 0,

    metodosDisponibles: (cuenta.metodosDisponibles ??
      []) as MetodoTesoreria[],
    canalesDigitales,
    esCuentaPorDefecto: cuenta.esCuentaPorDefecto ?? false,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// MAPEO STATE → ProductoFinancieroFormData (F3b · ADR-PF-001)
// ═════════════════════════════════════════════════════════════════════════

import type {
  ProductoFinanciero,
  ProductoFinancieroFormData,
  TipoProductoFinanciero,
  ProveedorWallet,
  CanalDigital,
} from '../../../types/productoFinanciero.types';

/**
 * Convierte el state del wizard al formato del modelo nuevo.
 *
 * F3b: el wizard sigue trabajando internamente con el shape "viejo"
 * (CuentaWizardState con tipo='banco'|'digital'|'efectivo'|'credito') pero
 * al persistir traduce a ProductoFinanciero.
 *
 * Mapping `tipo` legacy → `tipoProducto` nuevo:
 *   - banco + productoFinanciero='cuenta_ahorros' → cuenta_ahorros
 *   - banco + productoFinanciero='cuenta_corriente' → cuenta_corriente
 *   - digital + productoFinanciero='mercadopago'/'paypal'/etc. → wallet_digital
 *   - efectivo → caja_efectivo
 *   - credito + productoFinanciero='tarjeta_debito' → tarjeta_debito
 *
 * Tarjeta crédito NO se soporta en este mapper aún (F3c lo agrega).
 */
export function mapStateToProductoFinancieroFormData(
  state: CuentaWizardState,
): ProductoFinancieroFormData {
  const tipoProducto = inferirTipoProducto(state);
  const soportaBiMoneda =
    tipoProducto === 'cuenta_corriente' || tipoProducto === 'cuenta_ahorros';
  const esBiMoneda = soportaBiMoneda && state.esBiMoneda;

  const data: ProductoFinancieroFormData = {
    nombre: state.nombre.trim(),
    tipoProducto,

    moneda: state.moneda,
    esBiMoneda,

    saldoInicial: esBiMoneda ? 0 : state.saldoInicial,

    titularidad: state.titularidad,
    titularNombre: state.titularNombre.trim() || undefined,
  };

  if (esBiMoneda) {
    data.saldoInicialUSD = state.saldoInicialUSD;
    data.saldoInicialPEN = state.saldoInicialPEN;
  }

  // Datos bancarios (banco/wallet con banco)
  if (state.banco.trim()) data.banco = state.banco.trim();
  if (state.bancoNombreCompleto.trim())
    data.bancoNombreCompleto = state.bancoNombreCompleto.trim();
  if (state.numeroCuenta.trim()) data.numeroCuenta = state.numeroCuenta.trim();
  if (state.cci.trim()) data.cci = state.cci.trim();

  // Tarjeta débito: cuenta vinculada
  if (tipoProducto === 'tarjeta_debito' && state.cuentaVinculadaId) {
    data.cuentaVinculadaId = state.cuentaVinculadaId;
  }

  // Tarjeta crédito (F3c.5)
  if (tipoProducto === 'tarjeta_credito') {
    if (state.ultimosCuatro.trim()) data.ultimosDigitos = state.ultimosCuatro.trim();
    if (state.marcaTC) data.marca = state.marcaTC;
    if (state.diaCorte) data.diaCorte = state.diaCorte;
    if (state.diaPago) data.diaPago = state.diaPago;
    if (state.topeControlUSD !== undefined)
      data.topeControlUSD = state.topeControlUSD;
    if (state.topeControlPEN !== undefined)
      data.topeControlPEN = state.topeControlPEN;
    if (state.cuentaPagoDefaultId)
      data.cuentaPagoDefaultId = state.cuentaPagoDefaultId;
  }

  // Wallet digital: proveedor (PayPal, Wise, etc.)
  if (tipoProducto === 'wallet_digital' && state.productoFinanciero) {
    data.proveedorWallet = mapearProveedorWalletDesdeProductoLegacy(
      state.productoFinanciero,
    );
  }

  // Titular estructurado (solo si titularidad='personal')
  if (state.titularidad === 'personal') {
    if (state.titularEntidadId) data.titularEntidadId = state.titularEntidadId;
    if (state.titularEntidadTipo)
      data.titularEntidadTipo = state.titularEntidadTipo;
  }

  // Métodos
  if (state.metodosDisponibles?.length)
    data.metodosDisponibles = state.metodosDisponibles;

  // Canales digitales (solo cuenta_corriente / cuenta_ahorros, P-1)
  if (
    (tipoProducto === 'cuenta_corriente' || tipoProducto === 'cuenta_ahorros') &&
    state.canalesDigitales.length > 0
  ) {
    const canales: CanalDigital[] = state.canalesDigitales
      .filter((c) => c.identificador.trim().length > 0)
      .map((c) => ({ tipo: c.tipo, identificador: c.identificador }));
    if (canales.length > 0) data.canalesDigitales = canales;
  }

  // Config
  if (state.esCuentaPorDefecto !== undefined)
    data.esCuentaPorDefecto = state.esCuentaPorDefecto;

  return data;
}

function inferirTipoProducto(state: CuentaWizardState): TipoProductoFinanciero {
  // Prioriza productoFinanciero específico
  switch (state.productoFinanciero) {
    case 'cuenta_ahorros':   return 'cuenta_ahorros';
    case 'cuenta_corriente': return 'cuenta_corriente';
    case 'tarjeta_debito':   return 'tarjeta_debito';
    case 'tarjeta_credito':  return 'tarjeta_credito';   // F3c.5
    case 'caja':             return 'caja_efectivo';
    case 'mercadopago':
    case 'paypal':
    case 'zelle':
    case 'wise':
    case 'binance':
      return 'wallet_digital';
  }
  // Fallback por tipo
  switch (state.tipo) {
    case 'banco':    return 'cuenta_ahorros';   // default razonable
    case 'digital':  return 'wallet_digital';
    case 'efectivo': return 'caja_efectivo';
    case 'credito':  return 'tarjeta_debito';
  }
}

function mapearProveedorWalletDesdeProductoLegacy(
  pf: NonNullable<CuentaWizardState['productoFinanciero']>,
): ProveedorWallet | undefined {
  switch (pf) {
    case 'mercadopago': return 'mercadopago';
    case 'paypal':      return 'paypal';
    case 'zelle':       return 'zelle';
    case 'wise':        return 'wise';
    case 'binance':     return 'binance';
    default:            return undefined;
  }
}

// ═════════════════════════════════════════════════════════════════════════
// HIDRATACIÓN DESDE ProductoFinanciero (F3c.6 · edición nativa)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Construye el state inicial del wizard desde un ProductoFinanciero del
 * modelo nuevo. Usado en el modo edición cuando la cuenta a editar es
 * nativa (existe en productosFinancieros).
 *
 * Reverse mapping de tipoProducto → tipo legacy + productoFinanciero.
 */
export function hidratarStateDesdeProductoFinanciero(
  pf: ProductoFinanciero,
): CuentaWizardState {
  const { tipo, productoFinanciero } = mapearTipoProductoAlegacy(pf);

  // Saldos según mono/bi-moneda
  const saldoInicial = pf.esBiMoneda ? 0 : pf.saldoActual;

  // Canales digitales
  const canalesDigitales: CuentaWizardState['canalesDigitales'] =
    pf.canalesDigitales?.map((c) => ({
      tipo: c.tipo as TipoCanalDigital,
      identificador: c.identificador,
    })) ?? [];

  return {
    tipo,
    productoFinanciero,

    banco: pf.banco ?? '',
    bancoNombreCompleto: pf.bancoNombreCompleto ?? '',
    nombre: pf.nombre,
    ultimosCuatro: pf.ultimosDigitos ?? '',
    numeroCuenta: pf.numeroCuenta ?? '',
    cci: pf.cci ?? '',
    cuentaVinculadaId: pf.cuentaVinculadaId ?? '',

    // Tarjeta crédito
    marcaTC: pf.marca,
    diaCorte: pf.diaCorte,
    diaPago: pf.diaPago,
    topeControlUSD: pf.topeControlUSD,
    topeControlPEN: pf.topeControlPEN,
    cuentaPagoDefaultId: pf.cuentaPagoDefaultId ?? '',

    titularidad: pf.titularidad,
    titularEntidadId: pf.titularEntidadId ?? '',
    titularEntidadTipo: pf.titularEntidadTipo,
    titularNombre: pf.titularNombre ?? 'Vita Skin Peru SAC',

    esBiMoneda: pf.esBiMoneda,
    moneda: pf.moneda,
    saldoInicial,
    saldoInicialUSD: pf.saldoUSD ?? 0,
    saldoInicialPEN: pf.saldoPEN ?? 0,

    metodosDisponibles: (pf.metodosDisponibles ?? []) as MetodoTesoreria[],
    canalesDigitales,
    esCuentaPorDefecto: pf.esCuentaPorDefecto ?? false,
  };
}

/**
 * Mapping inverso: ProductoFinanciero.tipoProducto → wizard.tipo + productoFinanciero
 */
function mapearTipoProductoAlegacy(pf: ProductoFinanciero): {
  tipo: TipoCuenta;
  productoFinanciero: ProductoFinancieroNuevo | undefined;
} {
  switch (pf.tipoProducto) {
    case 'cuenta_corriente': return { tipo: 'banco', productoFinanciero: 'cuenta_corriente' };
    case 'cuenta_ahorros':   return { tipo: 'banco', productoFinanciero: 'cuenta_ahorros' };
    case 'tarjeta_debito':   return { tipo: 'credito', productoFinanciero: 'tarjeta_debito' };
    case 'tarjeta_credito':  return { tipo: 'credito', productoFinanciero: 'tarjeta_credito' };
    case 'caja_efectivo':    return { tipo: 'efectivo', productoFinanciero: 'caja' };
    case 'wallet_digital': {
      const productoFinanciero = (pf.proveedorWallet ?? 'mercadopago') as ProductoFinancieroNuevo;
      return { tipo: 'digital', productoFinanciero };
    }
  }
}
