/**
 * saldosHelpers — chk5.D-S3.ter · SF1
 *
 * Helpers puros para la sub-vista Saldos (`/finanzas/saldos`) · canon MOCK 6.
 * Centraliza modelo unificado de "producto financiero", agrupaciones y KPIs.
 *
 * Modelo unificado · 3 fuentes de datos:
 *   1. CuentaCaja        (banco · digital · efectivo · credito[débito])
 *   2. TarjetaCredito    (tarjetas de crédito · titularidad empresa o personal)
 *   3. ProductoFinanciero (caja_recaudadora · creado en chk5.D-S1f)
 *
 * Vista derivada D13: Pool USD = sub-grupo agregado de todas las cuentas USD
 * físicas del titular Empresa · NO entidad propia.
 *
 * Sin Firestore · sin React · testeable aislado.
 */

import type { CuentaCaja } from '../../../../types/tesoreria.types';
import type { TarjetaCredito } from '../../../../types/tarjetaCredito.types';
import type { ProductoFinanciero } from '../../../../types/productoFinanciero.types';

// ═════════════════════════════════════════════════════════════════════════
// MODELO UNIFICADO · ProductoFinancieroUnif
// ═════════════════════════════════════════════════════════════════════════

/**
 * Discriminator del tipo de producto en la vista Saldos.
 * Determina cómo se renderiza el avatar · monto · drawer.
 */
export type KindProductoSaldo =
  | 'cuenta_bancaria'      // CuentaCaja.tipo='banco'
  | 'wallet_digital'       // CuentaCaja.tipo='digital'
  | 'tarjeta_credito'      // TarjetaCredito (entidad propia)
  | 'tarjeta_debito'       // CuentaCaja con productoFinanciero='tarjeta_debito' (vinculada a otra cuenta)
  | 'caja_efectivo'        // CuentaCaja.tipo='efectivo' (NO recaudadora)
  | 'caja_recaudadora';    // ProductoFinanciero.tipo='caja_recaudadora'

export type TitularGrupo = 'empresa' | 'personal' | 'recaudador';

export type GrupoSaldos = 'titular' | 'tipo' | 'moneda' | 'banco';

/**
 * Producto financiero unificado en la vista Saldos.
 * Wrapper disciminado por `kind` con data original + helpers derivados.
 */
export type ProductoFinancieroUnif =
  | {
      kind: 'cuenta_bancaria' | 'wallet_digital' | 'tarjeta_debito' | 'caja_efectivo';
      id: string;
      kindData: CuentaCaja;
    }
  | {
      kind: 'tarjeta_credito';
      id: string;
      kindData: TarjetaCredito;
      /** Saldo derivado de la CC espejo · si no se carga · usa el legacy saldoActualUSD */
      saldoEspejoPEN?: number;
      saldoEspejoUSD?: number;
    }
  | {
      kind: 'caja_recaudadora';
      id: string;
      kindData: ProductoFinanciero;
      /** Saldo pendiente de liquidar · calculado por cajaRecaudadora.service */
      saldoPendientePEN: number;
    };

// ═════════════════════════════════════════════════════════════════════════
// HELPERS · derivar campos comunes desde el wrapper unificado
// ═════════════════════════════════════════════════════════════════════════

export function nombreDe(p: ProductoFinancieroUnif): string {
  if (p.kind === 'tarjeta_credito') return p.kindData.nombre;
  if (p.kind === 'caja_recaudadora') return p.kindData.nombre;
  return p.kindData.nombre;
}

export function titularNombreDe(p: ProductoFinancieroUnif): string {
  if (p.kind === 'tarjeta_credito') return p.kindData.titularNombre ?? 'Empresa';
  if (p.kind === 'caja_recaudadora') {
    return p.kindData.responsableTerceroNombre ?? 'Recaudador';
  }
  return p.kindData.titular ?? p.kindData.titularNombre ?? 'Empresa';
}

/**
 * Clasifica el producto en uno de los 3 grupos top-level: empresa · personal · recaudador.
 * Canon mockup MOCK 6 §1: cada grupo tiene un header con icon distinto.
 */
export function titularGrupoDe(p: ProductoFinancieroUnif): TitularGrupo {
  if (p.kind === 'caja_recaudadora') return 'recaudador';
  if (p.kind === 'tarjeta_credito') {
    return p.kindData.titularidad === 'personal' ? 'personal' : 'empresa';
  }
  // CuentaCaja
  return p.kindData.titularidad === 'personal' ? 'personal' : 'empresa';
}

export function activoDe(p: ProductoFinancieroUnif): boolean {
  if (p.kind === 'tarjeta_credito') return p.kindData.activa;
  if (p.kind === 'caja_recaudadora') return p.kindData.activa;
  return p.kindData.activa;
}

/**
 * Moneda principal · USD para Pool USD · PEN para resto.
 * Para bi-moneda (Visa BCP Empresarial) devuelve 'PEN' como principal.
 */
export function monedaPrincipalDe(p: ProductoFinancieroUnif): 'PEN' | 'USD' {
  if (p.kind === 'tarjeta_credito') return p.kindData.moneda as 'PEN' | 'USD';
  if (p.kind === 'caja_recaudadora') return (p.kindData.moneda as 'PEN' | 'USD') ?? 'PEN';
  return p.kindData.moneda;
}

export function esBiMonedaDe(p: ProductoFinancieroUnif): boolean {
  if (p.kind === 'tarjeta_credito') return !!p.kindData.esBiMoneda;
  if (p.kind === 'caja_recaudadora') return false;
  return p.kindData.esBiMoneda ?? false;
}

/**
 * Saldo en PEN · positivo o negativo según contexto.
 * Tarjetas de crédito devuelven negativo (deuda).
 * Recaudadoras devuelven el saldo pendiente de liquidar (positivo).
 */
export function saldoPENDe(p: ProductoFinancieroUnif): number {
  if (p.kind === 'tarjeta_credito') {
    // TC bi-moneda · CC espejo PEN (negativo = deuda)
    if (p.kindData.esBiMoneda && p.saldoEspejoPEN !== undefined) {
      return -Math.abs(p.saldoEspejoPEN);
    }
    return 0;
  }
  if (p.kind === 'caja_recaudadora') return p.saldoPendientePEN;
  // CuentaCaja
  if (p.kindData.esBiMoneda) return p.kindData.saldoPEN ?? 0;
  if (p.kindData.moneda === 'PEN') return p.kindData.saldoActual ?? 0;
  return 0;
}

export function saldoUSDDe(p: ProductoFinancieroUnif): number {
  if (p.kind === 'tarjeta_credito') {
    // TC en USD · saldo de la CC espejo (negativo = deuda)
    if (p.saldoEspejoUSD !== undefined) {
      return -Math.abs(p.saldoEspejoUSD);
    }
    // Fallback legacy si no hay CC espejo
    return -Math.abs(p.kindData.saldoActualUSD ?? 0);
  }
  if (p.kind === 'caja_recaudadora') return 0; // recaudadoras siempre PEN
  // CuentaCaja
  if (p.kindData.esBiMoneda) return p.kindData.saldoUSD ?? 0;
  if (p.kindData.moneda === 'USD') return p.kindData.saldoActual ?? 0;
  return 0;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPER · kind unificado
// ═════════════════════════════════════════════════════════════════════════

/**
 * Resuelve el `kind` final del producto · útil para discriminator de UI.
 * Para CuentaCaja con productoFinanciero='tarjeta_debito' devuelve 'tarjeta_debito'.
 */
export function kindFinalDe(p: ProductoFinancieroUnif): KindProductoSaldo {
  if (p.kind === 'tarjeta_credito') return 'tarjeta_credito';
  if (p.kind === 'caja_recaudadora') return 'caja_recaudadora';
  // CuentaCaja
  if (p.kind === 'tarjeta_debito') return 'tarjeta_debito';
  if (p.kind === 'wallet_digital') return 'wallet_digital';
  if (p.kind === 'caja_efectivo') return 'caja_efectivo';
  return 'cuenta_bancaria';
}

/**
 * Detecta si una CuentaCaja debe clasificarse como tarjeta_debito o wallet_digital
 * basado en su `tipo` y `productoFinanciero`. Útil para envolver CuentaCaja en
 * el wrapper correcto.
 */
export function detectarKindCuentaCaja(c: CuentaCaja): KindProductoSaldo {
  if (c.tipo === 'efectivo') return 'caja_efectivo';
  if (c.tipo === 'digital') return 'wallet_digital';
  if (c.tipo === 'credito' && c.productoFinanciero === 'tarjeta_debito') return 'tarjeta_debito';
  return 'cuenta_bancaria';
}

/**
 * Wrap CuentaCaja en ProductoFinancieroUnif (kind autodetectado).
 */
export function wrapCuentaCaja(c: CuentaCaja): ProductoFinancieroUnif {
  const k = detectarKindCuentaCaja(c);
  return {
    kind: k as 'cuenta_bancaria' | 'wallet_digital' | 'tarjeta_debito' | 'caja_efectivo',
    id: c.id,
    kindData: c,
  };
}

export function wrapTarjetaCredito(
  tc: TarjetaCredito,
  saldoEspejoPEN?: number,
  saldoEspejoUSD?: number,
): ProductoFinancieroUnif {
  return {
    kind: 'tarjeta_credito',
    id: tc.id,
    kindData: tc,
    saldoEspejoPEN,
    saldoEspejoUSD,
  };
}

export function wrapCajaRecaudadora(
  pf: ProductoFinanciero,
  saldoPendientePEN: number,
): ProductoFinancieroUnif {
  return {
    kind: 'caja_recaudadora',
    id: pf.id ?? `recaudadora_${pf.responsableTerceroId ?? 'sin-id'}`,
    kindData: pf,
    saldoPendientePEN,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// BANCO · color · iniciales
// ═════════════════════════════════════════════════════════════════════════

/**
 * Banco corto · "BCP" · "IBK" · "BBVA" · "AMEX" · "STR" (Stripe) · "GK" · etc.
 * Para wallets retorna las iniciales del nombre del proveedor.
 */
export function bancoCortoDe(p: ProductoFinancieroUnif): string {
  if (p.kind === 'tarjeta_credito') {
    const banco = p.kindData.banco ?? '';
    if (/amex/i.test(banco)) return 'AMEX';
    return banco.slice(0, 4).toUpperCase();
  }
  if (p.kind === 'caja_recaudadora') {
    // Usar iniciales del responsable · ej "GK Xpress" → "GK"
    const nom = p.kindData.responsableTerceroNombre ?? p.kindData.nombre;
    const palabras = nom.trim().split(/\s+/);
    if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
  }
  // CuentaCaja
  const c = p.kindData as CuentaCaja;
  if (p.kind === 'wallet_digital') {
    // Stripe · MercadoPago · PayPal
    if (c.productoFinanciero === 'paypal') return 'PP';
    if (c.productoFinanciero === 'mercadopago') return 'MP';
    if (c.productoFinanciero === 'wise') return 'WSE';
    if (c.productoFinanciero === 'zelle') return 'ZL';
    if (c.productoFinanciero === 'binance') return 'BNB';
    // Detectar Stripe desde nombre
    if (/stripe/i.test(c.nombre)) return 'STR';
    return c.nombre.slice(0, 3).toUpperCase();
  }
  if (p.kind === 'caja_efectivo') return '$';
  // Bancarias · tarjeta débito
  const banco = c.banco ?? '';
  if (banco) return banco.slice(0, 4).toUpperCase();
  return c.nombre.slice(0, 3).toUpperCase();
}

/**
 * Gradient CSS string para el avatar del banco · matchea mockup MOCK 6.
 * Colores específicos por banco · fallback a gradient slate.
 */
export function gradientBancoDe(p: ProductoFinancieroUnif): string {
  const banco = bancoCortoDe(p).toLowerCase();
  const kind = kindFinalDe(p);

  // TC: gradient amber (bimoneda) o indigo (débito vinculada)
  if (kind === 'tarjeta_credito') {
    if (banco.includes('amex')) return 'linear-gradient(135deg, #016fd0 0%, #2557d6 100%)';
    return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
  }
  if (kind === 'tarjeta_debito') return 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)';
  if (kind === 'caja_efectivo') return 'linear-gradient(135deg, #475569 0%, #334155 100%)';
  if (kind === 'caja_recaudadora') return 'linear-gradient(135deg, #6a2c7e 0%, #9333ea 100%)';

  // Wallets
  if (kind === 'wallet_digital') {
    if (banco === 'str') return 'linear-gradient(135deg, #635bff 0%, #4f46e5 100%)';
    if (banco === 'mp') return 'linear-gradient(135deg, #00b1ea 0%, #009ee3 100%)';
    if (banco === 'pp') return 'linear-gradient(135deg, #003087 0%, #009cde 100%)';
    return 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)';
  }

  // Bancarias
  if (banco === 'bcp') return 'linear-gradient(135deg, #003876 0%, #0066b3 100%)';
  if (banco === 'ibk') return 'linear-gradient(135deg, #00a99d 0%, #00c4b3 100%)';
  if (banco === 'bbva') return 'linear-gradient(135deg, #004481 0%, #1973b8 100%)';
  // Fallback
  return 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
}

// ═════════════════════════════════════════════════════════════════════════
// AGRUPACIONES · canon mockup MOCK 6 toolbar (Titular · Tipo · Moneda · Banco)
// ═════════════════════════════════════════════════════════════════════════

export interface GrupoProductos {
  key: string;
  label: string;
  productos: ProductoFinancieroUnif[];
  /** Subtotal PEN (suma absoluta) */
  subtotalPEN: number;
  /** Subtotal USD (suma absoluta) */
  subtotalUSD: number;
  /** Meta-info opcional para el header del grupo · ej "Vita Skin Peru SAC" */
  meta?: string;
}

function subtotalProductos(productos: ProductoFinancieroUnif[]): { pen: number; usd: number } {
  let pen = 0;
  let usd = 0;
  for (const p of productos) {
    pen += saldoPENDe(p);
    usd += saldoUSDDe(p);
  }
  return { pen, usd };
}

/**
 * Agrupa por TITULAR · Empresa · Personal · Recaudador.
 * Orden canon: empresa primero · luego personal · luego recaudador.
 */
export function agruparPorTitular(productos: ProductoFinancieroUnif[]): GrupoProductos[] {
  const mapa = new Map<TitularGrupo, ProductoFinancieroUnif[]>([
    ['empresa', []],
    ['personal', []],
    ['recaudador', []],
  ]);

  for (const p of productos) {
    const grupo = titularGrupoDe(p);
    mapa.get(grupo)!.push(p);
  }

  const grupos: GrupoProductos[] = [];
  const ORDEN: TitularGrupo[] = ['empresa', 'personal', 'recaudador'];
  for (const k of ORDEN) {
    const lista = mapa.get(k)!;
    if (lista.length === 0) continue;
    const sub = subtotalProductos(lista);
    grupos.push({
      key: k,
      label: labelTitularGrupo(k, lista[0]),
      productos: lista,
      subtotalPEN: Math.abs(sub.pen),
      subtotalUSD: Math.abs(sub.usd),
      meta: metaTitularGrupo(k, lista[0]),
    });
  }
  return grupos;
}

function labelTitularGrupo(k: TitularGrupo, sample: ProductoFinancieroUnif): string {
  if (k === 'empresa') return 'Empresa';
  if (k === 'personal') {
    const nom = titularNombreDe(sample);
    return `Personal · ${nom}`;
  }
  // recaudador
  const nom = titularNombreDe(sample);
  return `Recaudador · ${nom}`;
}

function metaTitularGrupo(k: TitularGrupo, sample: ProductoFinancieroUnif): string | undefined {
  if (k === 'empresa') {
    // Si tenemos razon social desnormalizada en algún producto, usarla
    const razon = titularNombreDe(sample);
    return razon && razon !== 'Empresa' ? razon : undefined;
  }
  return undefined;
}

/**
 * Agrupa por TIPO de producto (canon MOCK 6 §5 toggle alternativo).
 */
export function agruparPorTipo(productos: ProductoFinancieroUnif[]): GrupoProductos[] {
  const ORDEN_TIPO: KindProductoSaldo[] = [
    'cuenta_bancaria',
    'wallet_digital',
    'tarjeta_credito',
    'tarjeta_debito',
    'caja_efectivo',
    'caja_recaudadora',
  ];
  const TIPO_LABEL: Record<KindProductoSaldo, string> = {
    cuenta_bancaria: 'Bancarias',
    wallet_digital: 'Wallets digitales',
    tarjeta_credito: 'Tarjetas de crédito',
    tarjeta_debito: 'Tarjetas de débito',
    caja_efectivo: 'Cajas efectivo',
    caja_recaudadora: 'Cajas recaudadoras',
  };

  const mapa = new Map<KindProductoSaldo, ProductoFinancieroUnif[]>();
  for (const k of ORDEN_TIPO) mapa.set(k, []);
  for (const p of productos) {
    const k = kindFinalDe(p);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k)!.push(p);
  }

  const grupos: GrupoProductos[] = [];
  for (const k of ORDEN_TIPO) {
    const lista = mapa.get(k)!;
    if (lista.length === 0) continue;
    const sub = subtotalProductos(lista);
    grupos.push({
      key: k,
      label: TIPO_LABEL[k],
      productos: lista,
      subtotalPEN: Math.abs(sub.pen),
      subtotalUSD: Math.abs(sub.usd),
    });
  }
  return grupos;
}

/**
 * Agrupa por MONEDA principal · PEN · USD · Bimoneda.
 */
export function agruparPorMoneda(productos: ProductoFinancieroUnif[]): GrupoProductos[] {
  const mapa = new Map<string, ProductoFinancieroUnif[]>([
    ['PEN', []],
    ['USD', []],
    ['BIMONEDA', []],
  ]);
  for (const p of productos) {
    if (esBiMonedaDe(p)) mapa.get('BIMONEDA')!.push(p);
    else mapa.get(monedaPrincipalDe(p))!.push(p);
  }
  const ORDEN = ['PEN', 'USD', 'BIMONEDA'];
  const LABEL: Record<string, string> = {
    PEN: 'Soles (PEN)',
    USD: 'Dólares (USD)',
    BIMONEDA: 'Bimoneda',
  };
  const grupos: GrupoProductos[] = [];
  for (const k of ORDEN) {
    const lista = mapa.get(k)!;
    if (lista.length === 0) continue;
    const sub = subtotalProductos(lista);
    grupos.push({
      key: k,
      label: LABEL[k],
      productos: lista,
      subtotalPEN: Math.abs(sub.pen),
      subtotalUSD: Math.abs(sub.usd),
    });
  }
  return grupos;
}

/**
 * Agrupa por BANCO emisor.
 */
export function agruparPorBanco(productos: ProductoFinancieroUnif[]): GrupoProductos[] {
  const mapa = new Map<string, ProductoFinancieroUnif[]>();
  for (const p of productos) {
    const b = bancoCortoDe(p);
    if (!mapa.has(b)) mapa.set(b, []);
    mapa.get(b)!.push(p);
  }
  const grupos: GrupoProductos[] = [];
  for (const [k, lista] of mapa) {
    const sub = subtotalProductos(lista);
    grupos.push({
      key: k,
      label: k,
      productos: lista,
      subtotalPEN: Math.abs(sub.pen),
      subtotalUSD: Math.abs(sub.usd),
    });
  }
  // Orden por monto descendente
  grupos.sort((a, b) => b.subtotalPEN + b.subtotalUSD - a.subtotalPEN - a.subtotalUSD);
  return grupos;
}

// ═════════════════════════════════════════════════════════════════════════
// POOL USD · D13 vista agregada de cuentas USD físicas
// ═════════════════════════════════════════════════════════════════════════

/**
 * Filtra los productos del titular EMPRESA que conforman el Pool USD.
 * Son cuentas bancarias en USD activas (NO bi-moneda · NO digitales · NO TC).
 */
export function extraerCuentasPoolUSD(
  productosEmpresa: ProductoFinancieroUnif[],
): ProductoFinancieroUnif[] {
  return productosEmpresa.filter(
    (p) =>
      p.kind === 'cuenta_bancaria' &&
      !esBiMonedaDe(p) &&
      monedaPrincipalDe(p) === 'USD' &&
      activoDe(p),
  );
}

/**
 * Saldo total agregado del Pool USD.
 */
export function saldoTotalPoolUSD(productosEmpresa: ProductoFinancieroUnif[]): number {
  return extraerCuentasPoolUSD(productosEmpresa).reduce((acc, p) => acc + saldoUSDDe(p), 0);
}

// ═════════════════════════════════════════════════════════════════════════
// KPIs CANON MOCK 6 · 5 KPIs específicos Saldos
// ═════════════════════════════════════════════════════════════════════════

export interface KPIsSaldos {
  /** Total patrimonio · cuentas PEN + USD*tcpa - deudaTC */
  patrimonioTotalPEN: number;
  /** Cantidad de productos activos */
  productosActivosCount: number;
  /** Saldo total cuentas PEN (excluye TC) */
  cuentasPENTotal: number;
  /** Cantidad de cuentas PEN · % sobre patrimonio */
  cuentasPENCount: number;
  cuentasPENPctPatrimonio: number;
  /** Pool USD agregado · saldo en USD */
  poolUSDTotal: number;
  poolUSDCuentasCount: number;
  poolUSDEquivPEN: number;
  /** Deuda total en TC · suma de saldos negativos de tarjetas (USD + PEN bimoneda) */
  deudaTCTotalUSD: number;
  deudaTCTotalPEN: number;
  tcCount: number;
  tcPersonalReembolsoCount: number;
  /** Pendientes liquidar de cajas recaudadoras (PEN) */
  recaudadorasPendientePEN: number;
  recaudadorasCount: number;
}

export function calcularKPIsSaldos(
  productos: ProductoFinancieroUnif[],
  tcpaActual = 0,
): KPIsSaldos {
  let cuentasPENTotal = 0;
  let cuentasPENCount = 0;
  let poolUSDTotal = 0;
  let poolUSDCuentasCount = 0;
  let deudaTCTotalUSD = 0;
  let deudaTCTotalPEN = 0;
  let tcCount = 0;
  let tcPersonalReembolsoCount = 0;
  let recaudadorasPendientePEN = 0;
  let recaudadorasCount = 0;
  let productosActivosCount = 0;

  for (const p of productos) {
    if (!activoDe(p)) continue;
    productosActivosCount++;

    const kind = kindFinalDe(p);

    if (kind === 'tarjeta_credito') {
      tcCount++;
      if (p.kind === 'tarjeta_credito' && p.kindData.titularidad === 'personal') {
        tcPersonalReembolsoCount++;
      }
      deudaTCTotalUSD += Math.abs(saldoUSDDe(p));
      deudaTCTotalPEN += Math.abs(saldoPENDe(p));
      continue;
    }

    if (kind === 'tarjeta_debito') {
      // TC débito · vinculada · NO suma porque el saldo ya vive en la cuenta vinculada
      continue;
    }

    if (kind === 'caja_recaudadora') {
      recaudadorasCount++;
      recaudadorasPendientePEN += saldoPENDe(p);
      continue;
    }

    // Bancarias · wallets · cajas efectivo
    const pen = saldoPENDe(p);
    const usd = saldoUSDDe(p);
    if (pen > 0.01) {
      cuentasPENTotal += pen;
      cuentasPENCount++;
    }
    if (usd > 0.01) {
      // Solo cuentas USD del titular Empresa entran al Pool USD
      if (titularGrupoDe(p) === 'empresa') {
        poolUSDTotal += usd;
        poolUSDCuentasCount++;
      }
    }
  }

  const poolUSDEquivPEN = poolUSDTotal * (tcpaActual || 0);
  const patrimonioTotalPEN =
    cuentasPENTotal + poolUSDEquivPEN - deudaTCTotalPEN - deudaTCTotalUSD * (tcpaActual || 0);

  const cuentasPENPctPatrimonio =
    patrimonioTotalPEN > 0 ? Math.round((cuentasPENTotal / patrimonioTotalPEN) * 100) : 0;

  return {
    patrimonioTotalPEN,
    productosActivosCount,
    cuentasPENTotal,
    cuentasPENCount,
    cuentasPENPctPatrimonio,
    poolUSDTotal,
    poolUSDCuentasCount,
    poolUSDEquivPEN,
    deudaTCTotalUSD,
    deudaTCTotalPEN,
    tcCount,
    tcPersonalReembolsoCount,
    recaudadorasPendientePEN,
    recaudadorasCount,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// FILTRADO · helpers para FiltrosSaldosBar (SF4)
// ═════════════════════════════════════════════════════════════════════════

export interface FiltrosSaldosState {
  busqueda: string;
  kindFiltro: 'todos' | KindProductoSaldo;
  monedaFiltro: 'todas' | 'PEN' | 'USD';
  titularFiltro: 'todos' | TitularGrupo;
  soloActivas: boolean;
}

export function defaultFiltrosSaldos(): FiltrosSaldosState {
  return {
    busqueda: '',
    kindFiltro: 'todos',
    monedaFiltro: 'todas',
    titularFiltro: 'todos',
    soloActivas: true,
  };
}

export function contarFiltrosSaldosActivos(f: FiltrosSaldosState): number {
  let count = 0;
  if (f.busqueda.trim()) count++;
  if (f.kindFiltro !== 'todos') count++;
  if (f.monedaFiltro !== 'todas') count++;
  if (f.titularFiltro !== 'todos') count++;
  if (!f.soloActivas) count++;
  return count;
}

/**
 * Aplica filtros a la lista unificada de productos.
 */
export function aplicarFiltrosSaldos(
  productos: ProductoFinancieroUnif[],
  filtros: FiltrosSaldosState,
): ProductoFinancieroUnif[] {
  const q = filtros.busqueda.trim().toLowerCase();
  return productos.filter((p) => {
    if (filtros.soloActivas && !activoDe(p)) return false;
    if (filtros.kindFiltro !== 'todos' && kindFinalDe(p) !== filtros.kindFiltro) return false;
    if (filtros.titularFiltro !== 'todos' && titularGrupoDe(p) !== filtros.titularFiltro) {
      return false;
    }
    if (filtros.monedaFiltro !== 'todas') {
      const mon = monedaPrincipalDe(p);
      const isBi = esBiMonedaDe(p);
      if (!isBi && mon !== filtros.monedaFiltro) return false;
    }
    if (q) {
      const haystack = [
        nombreDe(p),
        titularNombreDe(p),
        bancoCortoDe(p),
        p.kind === 'cuenta_bancaria' ? (p.kindData as CuentaCaja).numeroCuenta ?? '' : '',
        p.kind === 'cuenta_bancaria' ? (p.kindData as CuentaCaja).cci ?? '' : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

// ═════════════════════════════════════════════════════════════════════════
// LABELS CANON
// ═════════════════════════════════════════════════════════════════════════

export const KIND_LABEL_CORTO: Record<KindProductoSaldo, string> = {
  cuenta_bancaria: 'Bancaria',
  wallet_digital: 'Wallet',
  tarjeta_credito: 'TC',
  tarjeta_debito: 'TC Débito',
  caja_efectivo: 'Caja',
  caja_recaudadora: 'Recaudadora',
};

export const TITULAR_GRUPO_LABEL: Record<TitularGrupo, string> = {
  empresa: 'Empresa',
  personal: 'Personal',
  recaudador: 'Recaudador',
};

export const TITULAR_GRUPO_COLOR: Record<TitularGrupo, 'teal' | 'indigo' | 'purple'> = {
  empresa: 'teal',
  personal: 'indigo',
  recaudador: 'purple',
};

export const TITULAR_GRUPO_ICON: Record<TitularGrupo, 'building' | 'user' | 'truck'> = {
  empresa: 'building',
  personal: 'user',
  recaudador: 'truck',
};

export const KIND_COLOR: Record<KindProductoSaldo, 'teal' | 'sky' | 'amber' | 'indigo' | 'slate' | 'purple'> = {
  cuenta_bancaria: 'teal',
  wallet_digital: 'sky',
  tarjeta_credito: 'amber',
  tarjeta_debito: 'indigo',
  caja_efectivo: 'slate',
  caja_recaudadora: 'purple',
};
