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
import type { CuentaCaja, MovimientoTesoreria, TipoMovimientoTesoreria } from '../types/tesoreria.types';
import type { TarjetaCredito } from '../types/tarjetaCredito.types';
import type {
  ProductoFinanciero,
  TipoProductoFinanciero,
  CanalDigital,
  TipoCanalDigital,
  MarcaTarjeta,
  ProveedorWallet,
} from '../types/productoFinanciero.types';
import type {
  MovimientoFinanciero,
  CategoriaMovimientoFinanciero,
} from '../types/movimientoFinanciero.types';
import { getCuentas } from './tesoreria.cuentas.service';
import { tarjetaCreditoService } from './tarjetaCredito.service';
import { getProductosFinancierosActivos } from './productoFinanciero.service';

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
// ProductoFinanciero → CuentaCaja (adapter INVERSO · F3c)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Adapter inverso: proyecta un ProductoFinanciero al shape CuentaCaja
 * para que componentes que aún esperan el shape viejo puedan mostrarlo.
 *
 * F3c: TabCuentas, VistaPorTitular y otras vistas siguen tipadas con
 * CuentaCaja. En lugar de refactorizar todas, leemos productosFinancieros
 * y los proyectamos a CuentaCaja-shape. Las nuevas creaciones del wizard
 * (F3b) entonces aparecen en la lista sin más cambios.
 *
 * SE ELIMINA EN F5 cuando todos los consumers usen ProductoFinanciero
 * directamente.
 */
export function productoFinancieroToCuentaCaja(
  pf: ProductoFinanciero,
): CuentaCaja {
  // Mapping inverso de tipoProducto → tipo legacy
  const tipoLegacy = mapearTipoProductoAlegacy(pf.tipoProducto);
  const productoLegacy = mapearProductoFinancieroAlegacy(
    pf.tipoProducto,
    pf.proveedorWallet,
  );

  const c: CuentaCaja = {
    id: pf.id,
    nombre: pf.nombre,
    titular: pf.titularNombre ?? 'Vita Skin Peru SAC',
    tipo: tipoLegacy,

    esBiMoneda: pf.esBiMoneda,
    moneda: pf.moneda,

    saldoActual: pf.saldoActual,
    saldoUSD: pf.saldoUSD,
    saldoPEN: pf.saldoPEN,

    activa: pf.activa,
    creadoPor: pf.creadoPor,
    fechaCreacion: pf.fechaCreacion,
  };

  // Saldos mínimos
  if (pf.saldoMinimo !== undefined) c.saldoMinimo = pf.saldoMinimo;
  if (pf.saldoMinimoUSD !== undefined) c.saldoMinimoUSD = pf.saldoMinimoUSD;
  if (pf.saldoMinimoPEN !== undefined) c.saldoMinimoPEN = pf.saldoMinimoPEN;

  // Datos bancarios
  if (pf.banco) c.banco = pf.banco;
  if (pf.bancoNombreCompleto) c.bancoNombreCompleto = pf.bancoNombreCompleto;
  if (pf.numeroCuenta) c.numeroCuenta = pf.numeroCuenta;
  if (pf.cci) c.cci = pf.cci;

  // Producto financiero legacy
  if (productoLegacy) c.productoFinanciero = productoLegacy;

  // Titularidad
  c.titularidad = pf.titularidad;
  if (pf.titularEntidadId) c.titularEntidadId = pf.titularEntidadId;
  if (pf.titularEntidadTipo) c.titularEntidadTipo = pf.titularEntidadTipo;
  if (pf.titularNombre) c.titularNombre = pf.titularNombre;

  // Tarjeta débito
  if (pf.cuentaVinculadaId) c.cuentaVinculadaId = pf.cuentaVinculadaId;

  // Métodos
  if (pf.metodosDisponibles?.length) c.metodosDisponibles = pf.metodosDisponibles;

  // Canales digitales
  if (pf.canalesDigitales?.length) {
    c.canalesDigitales = pf.canalesDigitales.map((cd) => ({
      tipo: cd.tipo,
      identificador: cd.identificador,
    }));
  }

  // Configuración
  if (pf.esCuentaPorDefecto !== undefined)
    c.esCuentaPorDefecto = pf.esCuentaPorDefecto;

  if (pf.actualizadoPor) c.actualizadoPor = pf.actualizadoPor;
  if (pf.fechaActualizacion) c.fechaActualizacion = pf.fechaActualizacion;

  return c;
}

function mapearTipoProductoAlegacy(
  tipo: TipoProductoFinanciero,
): CuentaCaja['tipo'] {
  switch (tipo) {
    case 'cuenta_corriente':
    case 'cuenta_ahorros':
      return 'banco';
    case 'tarjeta_debito':
      return 'credito';
    case 'tarjeta_credito':
      // En el shape legacy CuentaCaja no soporta tarjeta_credito como tipo —
      // las tarjetas viven en TarjetaCredito. Aquí proyectamos como 'credito'
      // y las consumers que sepan distinguir lo verán por productoFinanciero.
      return 'credito';
    case 'caja_efectivo':
      return 'efectivo';
    case 'wallet_digital':
      return 'digital';
    case 'caja_recaudadora':
      // D5 + D12 · chk5.D-S1f · CuentaCaja legacy NO soporta caja_recaudadora
      // como tipo nativo. Las cajas recaudadoras se gestionan via
      // ProductoFinanciero directo + cajaRecaudadora.service.ts (F3).
      // Si por compatibilidad se necesita exportar a CuentaCaja legacy
      // (ej. para reporte historico), proyectamos como 'efectivo' que es
      // el mas cercano (sin banco · operativa similar). Los consumers que
      // necesiten distinguir deben mirar `productoFinanciero` directamente.
      return 'efectivo';
  }
}

function mapearProductoFinancieroAlegacy(
  tipo: TipoProductoFinanciero,
  proveedor?: ProveedorWallet,
): CuentaCaja['productoFinanciero'] | undefined {
  switch (tipo) {
    case 'cuenta_corriente': return 'cuenta_corriente';
    case 'cuenta_ahorros':   return 'cuenta_ahorros';
    case 'tarjeta_debito':   return 'tarjeta_debito';
    case 'tarjeta_credito':  return 'tarjeta_credito';
    case 'caja_efectivo':    return 'caja';
    case 'wallet_digital':
      return proveedor ?? 'billetera_digital';
    case 'caja_recaudadora':
      // D5 + D12 · chk5.D-S1f · caja_recaudadora NO tiene equivalente legacy
      // en CuentaCaja.productoFinanciero. Retornamos undefined para que
      // consumers legacy no la confundan con otro producto.
      return undefined;
  }
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

/**
 * F3c · Lectura unificada compat con TabCuentas.
 *
 * Lee:
 *  1. cuentasCaja (legacy) — productos creados antes de F3b
 *  2. productosFinancieros (nativos, F3b+) — productos creados con el wizard
 *     que ya persiste al modelo nuevo
 *
 * Devuelve un único array CuentaCaja[] para que la UI legacy
 * (TabCuentas, VistaPorTitular, formularios) los muestre sin refactor.
 *
 * Deduplicación por id: si por algún motivo el mismo id aparece en ambas
 * colecciones, prevalece la versión nativa (modelo nuevo).
 *
 * SE ELIMINA EN F5 cuando todos los consumers lean ProductoFinanciero directo.
 */
export async function getCuentasUnificadas(): Promise<CuentaCaja[]> {
  const [cuentasLegacy, productosNativos] = await Promise.all([
    getCuentas(),
    getProductosFinancierosActivos(),
  ]);

  const map = new Map<string, CuentaCaja>();

  // Primero los legacy
  for (const c of cuentasLegacy) {
    map.set(c.id, c);
  }

  // Después los nativos — sobreescriben en caso de id duplicado
  for (const pf of productosNativos) {
    map.set(pf.id, productoFinancieroToCuentaCaja(pf));
  }

  return Array.from(map.values());
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

// ═════════════════════════════════════════════════════════════════════════
// F4a · MovimientoFinanciero → MovimientoTesoreria (lectura legacy)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Adapter inverso de movimiento: proyecta MovimientoFinanciero al shape
 * MovimientoTesoreria legacy para que TabMovimientos, dashboards y otras
 * vistas legacy puedan mostrar los movimientos del libro mayor unificado
 * sin refactor.
 *
 * SE ELIMINA EN F5 cuando todos los consumers lean MovimientoFinanciero
 * directamente.
 */
export function movimientoFinancieroToTesoreria(
  mf: MovimientoFinanciero,
): MovimientoTesoreria {
  const tipoLegacy = mapearCategoriaATipoLegacy(mf.categoria);

  const m: MovimientoTesoreria = {
    id: mf.id,
    numeroMovimiento: mf.numeroMovimiento,
    tipo: tipoLegacy,
    moneda: mf.moneda,
    monto: mf.monto,
    tipoCambio: mf.tipoCambio,
    montoEquivalentePEN: mf.montoEquivalentePEN,
    montoEquivalenteUSD: mf.montoEquivalenteUSD,
    metodo: (mf.metodo ?? 'otro') as MovimientoTesoreria['metodo'],
    concepto: mf.concepto,
    fecha: mf.fecha,
    estado: mf.estado,
    creadoPor: mf.creadoPor,
    fechaCreacion: mf.fechaCreacion,
  };

  if (mf.productoOrigenId) m.cuentaOrigen = mf.productoOrigenId;
  if (mf.productoDestinoId) m.cuentaDestino = mf.productoDestinoId;
  if (mf.referencia) m.referencia = mf.referencia;
  if (mf.notas) m.notas = mf.notas;
  if (mf.urlComprobante) m.urlComprobante = mf.urlComprobante;
  if (mf.actualizadoPor) m.actualizadoPor = mf.actualizadoPor;
  if (mf.fechaActualizacion) m.fechaActualizacion = mf.fechaActualizacion;

  // Refs polimórficas → campos legacy específicos
  if (mf.refDocumentoTipo === 'oc' && mf.refDocumentoId) {
    m.ordenCompraId = mf.refDocumentoId;
    if (mf.refDocumentoNumero) m.ordenCompraNumero = mf.refDocumentoNumero;
  }
  if (mf.refDocumentoTipo === 'venta' && mf.refDocumentoId) {
    m.ventaId = mf.refDocumentoId;
    if (mf.refDocumentoNumero) m.ventaNumero = mf.refDocumentoNumero;
  }
  if (mf.refDocumentoTipo === 'gasto' && mf.refDocumentoId) {
    m.gastoId = mf.refDocumentoId;
    if (mf.refDocumentoNumero) m.gastoNumero = mf.refDocumentoNumero;
  }
  // envio y cotizacion no tienen campos top-level en MovimientoTesoreria
  // legacy — se preservan en notas + concepto + refDocumento*.
  if (mf.refDocumentoTipo === 'cotizacion' && mf.refDocumentoId) {
    m.cotizacionId = mf.refDocumentoId;
    if (mf.refDocumentoNumero) m.cotizacionNumero = mf.refDocumentoNumero;
  }

  return m;
}

function mapearCategoriaATipoLegacy(
  cat: CategoriaMovimientoFinanciero,
): TipoMovimientoTesoreria {
  switch (cat) {
    case 'ingreso_venta':         return 'ingreso_venta';
    case 'ingreso_anticipo':      return 'ingreso_anticipo';
    case 'ingreso_otro':          return 'ingreso_otro';
    case 'aporte_capital':        return 'aporte_capital';
    case 'reembolso_recibido':    return 'ingreso_otro';
    case 'pago_orden_compra':     return 'pago_orden_compra';
    case 'pago_viajero':          return 'pago_viajero';
    case 'pago_proveedor_local':  return 'pago_proveedor_local';
    case 'gasto_operativo':       return 'gasto_operativo';
    case 'retiro_socio':          return 'retiro_socio';
    case 'pago_nomina':           return 'pago_nomina';
    case 'adelanto_empleado':     return 'adelanto_empleado';
    case 'pago_estado_cuenta_tc': return 'pago_orden_compra';
    case 'reembolso_cliente':     return 'gasto_operativo';
    case 'transferencia_interna': return 'transferencia_interna';
    case 'conversion_entrada':    return 'conversion_pen_usd';
    case 'conversion_salida':     return 'conversion_usd_pen';
    case 'cargo_tc':              return 'gasto_operativo';
    case 'ajuste_positivo':       return 'ingreso_otro';
    case 'ajuste_negativo':       return 'gasto_operativo';
  }
}

/**
 * F4a · Lectura unificada de movimientos.
 *
 * Lee:
 *  1. movimientosTesoreria (legacy) — pre-F4
 *  2. movimientosFinancieros (nativos, F4+) proyectados al shape legacy
 *
 * Devuelve un único array MovimientoTesoreria[] ordenado por fecha desc
 * para que TabMovimientos y otros consumers legacy lo muestren sin
 * refactor.
 */
export async function getMovimientosUnificados(): Promise<MovimientoTesoreria[]> {
  const [movsLegacy, movsNativos] = await Promise.all([
    (async () => {
      const { tesoreriaService } = await import('./tesoreria.service');
      return tesoreriaService.getMovimientos();
    })(),
    (async () => {
      const { collection, getDocs, query, orderBy, limit } = await import(
        'firebase/firestore'
      );
      const { db } = await import('../lib/firebase');
      const { COLLECTIONS } = await import('../config/collections');
      const q = query(
        collection(db, COLLECTIONS.MOVIMIENTOS_FINANCIEROS),
        orderBy('fecha', 'desc'),
        limit(2000),
      );
      const snap = await getDocs(q);
      return snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as MovimientoFinanciero,
      );
    })(),
  ]);

  const map = new Map<string, MovimientoTesoreria>();

  for (const m of movsLegacy) map.set(m.id, m);
  for (const mf of movsNativos) {
    map.set(mf.id, movimientoFinancieroToTesoreria(mf));
  }

  return Array.from(map.values()).sort((a, b) => {
    const ta = a.fecha?.toMillis?.() ?? 0;
    const tb = b.fecha?.toMillis?.() ?? 0;
    return tb - ta;
  });
}
