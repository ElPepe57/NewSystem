/**
 * productoFinanciero.adapters.ts — ADR-PF-001 · F2
 *
 * Adaptadores temporales que permiten que el código durante F1-F4 lea/use
 * el formato nuevo (`ProductoFinanciero`) aunque la persistencia siga en
 * `cuentasCaja` y `tarjetasCredito`.
 *
 * Sentido del flujo:
 *   - cuentaCajaToProductoFinanciero(c)        ← Vista nueva sobre dato viejo
 *   - tarjetaCreditoToProductoFinanciero(t)    ← idem
 *   - getProductosFinancierosLegacy()          ← Lee ambas col viejas + adapta
 *
 * Esto NO escribe en productosFinancieros — sólo proyecta. La escritura
 * directa a productosFinancieros se habilita en F4 (wizard universal).
 *
 * SE ELIMINA EN F5 cuando los tipos legacy se borren.
 */

import { Timestamp } from 'firebase/firestore';
import type { CuentaCaja } from '../types/tesoreria.types';
import type { TarjetaCredito } from '../types/tarjetaCredito.types';
import type {
  ProductoFinanciero,
  TipoProductoFinanciero,
  CanalDigital,
  TipoCanalDigital,
  MarcaTarjeta,
  ProveedorWallet,
} from '../types/productoFinanciero.types';
import { getCuentas } from './tesoreria.cuentas.service';
import { tarjetaCreditoService } from './tarjetaCredito.service';

// ═════════════════════════════════════════════════════════════════════════
// CuentaCaja → ProductoFinanciero
// ═════════════════════════════════════════════════════════════════════════

/**
 * Mapea una CuentaCaja legacy al modelo nuevo.
 *
 * El campo `productoFinanciero` legacy (con valores como 'cuenta_ahorros',
 * 'mercadopago', 'caja') se traduce a los nuevos `tipoProducto`. Yape/Plin
 * que vivían en `metodosDetalle` se proyectan a `canalesDigitales`.
 */
export function cuentaCajaToProductoFinanciero(
  c: CuentaCaja,
): ProductoFinanciero {
  const tipoProducto = mapearTipoProducto(c);
  const canales = extraerCanalesDigitales(c);

  const pf: ProductoFinanciero = {
    id: c.id,
    codigo: c.id, // Legacy no tiene codigo formateado
    nombre: c.nombre,
    tipoProducto,

    moneda: c.moneda,
    esBiMoneda: c.esBiMoneda,

    saldoActual: c.saldoActual,
    saldoUSD: c.saldoUSD,
    saldoPEN: c.saldoPEN,
    saldoActualizadoEn: Timestamp.now(),

    titularidad: c.titularidad ?? 'empresa',
    titularEntidadId: c.titularEntidadId,
    titularEntidadTipo: c.titularEntidadTipo,
    titularNombre: c.titularNombre ?? c.titular,

    activa: c.activa,
    creadoPor: '',                    // No disponible en CuentaCaja legacy
    fechaCreacion: Timestamp.now(),   // Placeholder
  };

  // Saldos mínimos
  if (c.saldoMinimo !== undefined) pf.saldoMinimo = c.saldoMinimo;
  if (c.saldoMinimoUSD !== undefined) pf.saldoMinimoUSD = c.saldoMinimoUSD;
  if (c.saldoMinimoPEN !== undefined) pf.saldoMinimoPEN = c.saldoMinimoPEN;

  // Datos bancarios
  if (c.banco) pf.banco = c.banco;
  if (c.bancoNombreCompleto) pf.bancoNombreCompleto = c.bancoNombreCompleto;
  if (c.numeroCuenta) pf.numeroCuenta = c.numeroCuenta;
  if (c.cci) pf.cci = c.cci;

  // Numeros adicionales (legacy `numerosCuenta`)
  if (c.numerosCuenta?.length) {
    pf.numerosAdicionales = c.numerosCuenta.map((n) => ({
      tipo: n.tipo ?? 'cuenta',
      numero: n.numero,
      etiqueta: n.etiqueta,
    }));
  }

  // Tarjeta debito
  if (c.cuentaVinculadaId) pf.cuentaVinculadaId = c.cuentaVinculadaId;

  // Wallet (digital)
  if (tipoProducto === 'wallet_digital' && c.productoFinanciero) {
    pf.proveedorWallet = mapearProveedorWallet(c.productoFinanciero);
  }

  // Métodos
  if (c.metodosDisponibles?.length) pf.metodosDisponibles = c.metodosDisponibles;

  // Canales digitales (Yape/Plin)
  if (canales.length > 0) pf.canalesDigitales = canales;

  // Config
  if (c.esCuentaPorDefecto !== undefined)
    pf.esCuentaPorDefecto = c.esCuentaPorDefecto;

  return pf;
}

// ═════════════════════════════════════════════════════════════════════════
// TarjetaCredito → ProductoFinanciero
// ═════════════════════════════════════════════════════════════════════════

export function tarjetaCreditoToProductoFinanciero(
  t: TarjetaCredito,
): ProductoFinanciero {
  const pf: ProductoFinanciero = {
    id: t.id,
    codigo: t.codigo ?? t.id,
    nombre: t.nombre,
    tipoProducto: 'tarjeta_credito',

    moneda: t.moneda,
    esBiMoneda: t.esBiMoneda ?? false,

    // Saldo de TC vive en CC espejo, no en el doc. Se setea 0 aquí y la UI
    // que necesite el saldo real lo lee con useSaldoCCTarjeta() — patrón
    // legacy que se mantiene en F2.
    saldoActual: 0,
    saldoActualizadoEn: t.fechaActualizacion ?? Timestamp.now(),

    titularidad: t.titularidad ?? 'empresa',
    titularEntidadId: t.titularEntidadId,
    titularEntidadTipo: t.titularEntidadTipo,
    titularNombre: t.titularNombre,

    activa: t.activa ?? true,
    creadoPor: t.creadoPor ?? '',
    fechaCreacion: t.fechaCreacion ?? Timestamp.now(),
    actualizadoPor: t.actualizadoPor,
    fechaActualizacion: t.fechaActualizacion,
  };

  // Datos bancarios
  if (t.banco) pf.banco = t.banco;
  if (t.bancoNombreCompleto) pf.bancoNombreCompleto = t.bancoNombreCompleto;

  // TC específicos
  if (t.ultimosDigitos) pf.ultimosDigitos = t.ultimosDigitos;
  if (t.marca) pf.marca = t.marca as MarcaTarjeta;
  if (t.diaCorte !== undefined) pf.diaCorte = t.diaCorte;
  if (t.diaPago !== undefined) pf.diaPago = t.diaPago;
  if (t.topeControlUSD !== undefined) pf.topeControlUSD = t.topeControlUSD;
  if (t.topeControlPEN !== undefined) pf.topeControlPEN = t.topeControlPEN;
  if (t.cuentaPagoDefaultId) pf.cuentaPagoDefaultId = t.cuentaPagoDefaultId;

  return pf;
}

// ═════════════════════════════════════════════════════════════════════════
// LECTURA UNIFICADA (lee ambas colecciones legacy y proyecta a PF)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Lee cuentasCaja + tarjetasCredito y los proyecta a ProductoFinanciero[].
 *
 * Usado por componentes en F2-F3 que ya están refactorizados al modelo
 * nuevo pero aún operan sobre data legacy. En F4 esta función se reemplaza
 * por `getProductosFinancierosActivos()` directo.
 */
export async function getProductosFinancierosLegacy(): Promise<
  ProductoFinanciero[]
> {
  const [cuentas, tarjetas] = await Promise.all([
    getCuentas(),
    tarjetaCreditoService.getAll(),
  ]);

  const productos: ProductoFinanciero[] = [];

  for (const c of cuentas) {
    if (!c.activa) continue;
    productos.push(cuentaCajaToProductoFinanciero(c));
  }

  for (const t of tarjetas) {
    if (t.activa === false) continue;
    productos.push(tarjetaCreditoToProductoFinanciero(t));
  }

  return productos;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS DE MAPEO INTERNO
// ═════════════════════════════════════════════════════════════════════════

function mapearTipoProducto(c: CuentaCaja): TipoProductoFinanciero {
  // Prioriza el campo `productoFinanciero` específico cuando existe
  switch (c.productoFinanciero) {
    case 'cuenta_ahorros':  return 'cuenta_ahorros';
    case 'cuenta_corriente': return 'cuenta_corriente';
    case 'tarjeta_debito':  return 'tarjeta_debito';
    case 'caja':            return 'caja_efectivo';
    case 'mercadopago':
    case 'paypal':
    case 'zelle':
    case 'wise':
    case 'binance':
      return 'wallet_digital';
    case 'tarjeta_credito':
      // Legacy — la TC migra a tarjetaCredito.types.ts hace tiempo
      return 'tarjeta_credito';
    case 'billetera_digital':
      return 'wallet_digital';
    default:
      // Fallback por `tipo` legacy
      switch (c.tipo) {
        case 'banco':
          return 'cuenta_ahorros'; // Asunción: si no se sabe, ahorros
        case 'digital':
          return 'wallet_digital';
        case 'efectivo':
          return 'caja_efectivo';
        case 'credito':
          return 'tarjeta_debito';
        default:
          return 'caja_efectivo';
      }
  }
}

function mapearProveedorWallet(
  productoFinanciero: NonNullable<CuentaCaja['productoFinanciero']>,
): ProveedorWallet | undefined {
  switch (productoFinanciero) {
    case 'mercadopago': return 'mercadopago';
    case 'paypal':      return 'paypal';
    case 'zelle':       return 'zelle';
    case 'wise':        return 'wise';
    case 'binance':     return 'binance';
    default:            return undefined;
  }
}

function extraerCanalesDigitales(c: CuentaCaja): CanalDigital[] {
  // Preferir el campo nuevo si existe
  if (c.canalesDigitales?.length) {
    return c.canalesDigitales.map((cd) => ({
      tipo: cd.tipo as TipoCanalDigital,
      identificador: cd.identificador,
    }));
  }

  // Fallback al legacy `metodosDetalle`
  if (c.metodosDetalle) {
    const canales: CanalDigital[] = [];
    const tiposValidos: TipoCanalDigital[] = ['yape', 'plin', 'sip', 'agora', 'bim'];
    for (const [tipo, det] of Object.entries(c.metodosDetalle)) {
      if (tiposValidos.includes(tipo as TipoCanalDigital) && det?.identificador) {
        canales.push({
          tipo: tipo as TipoCanalDigital,
          identificador: det.identificador,
        });
      }
    }
    return canales;
  }

  return [];
}
