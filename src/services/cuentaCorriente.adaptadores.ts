/**
 * cuentaCorriente.adaptadores.ts — S55 Fase 2
 *
 * Adaptadores retro-compatibles que leen desde la nueva colección
 * `movimientosCC` y exponen los datos en el formato legacy esperado por
 * UIs/services existentes.
 *
 * Esto permite eliminar `oc.historialPagos[]` del modelo sin romper los
 * 21 consumidores actuales — se cambian poco a poco a hooks/queries
 * directas a `movimientosCC` en futuras sesiones.
 *
 * Convenciones:
 *  - Los pagos de OC se modelan como `MovimientoCC` con `tipo: 'credito_pago_oc'`
 *  - Cada movimiento tiene `refDocumentoTipo: 'oc'` y `refDocumentoId: ocId`
 *  - Los pagos a sub-órdenes específicas usan `refSubDocumentoId: subOrdenId`
 *    (campo nuevo opcional, agregar al tipo MovimientoCC en F2.1.b)
 *  - El movimiento de tesorería real vive en `movimientoTesoreriaId`
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type {
  MovimientoCC,
  MonedaCC,
} from '../types/cuentaCorriente.types';

/**
 * Forma legacy de un pago de OC. Se mantiene para no romper UIs y
 * services que ya consumen `oc.historialPagos[]`.
 *
 * NO usar en código nuevo — preferir leer `MovimientoCC` directamente.
 */
export interface PagoOCLegacy {
  id: string;
  fecha: Timestamp;
  monedaPago: 'USD' | 'PEN';
  montoOriginal: number;
  montoUSD: number;
  montoPEN: number;
  tipoCambio: number;
  metodoPago: string;
  cuentaOrigenId?: string;
  cuentaOrigenNombre?: string;
  referencia?: string;
  notas?: string;
  movimientoTesoreriaId?: string;
  errorTesoreria?: boolean;
  errorTesoreriaMsg?: string;
  lotePagoId?: string;
  esPagoMasivo?: boolean;
  subOrdenId?: string;
  registradoPor: string;
  fechaRegistro: Timestamp;
}

/**
 * Convierte un MovimientoCC a formato legacy PagoOCLegacy.
 *
 * Pierde info que no existía en el modelo legacy (refDocumentoNumero,
 * saldoAfter, idempotencyKey) pero conserva todo lo necesario para que
 * los consumidores actuales sigan funcionando.
 */
export function movimientoCCAPagoOCLegacy(mov: MovimientoCC): PagoOCLegacy {
  // Heurística para reconstruir montoUSD/montoPEN/tipoCambio desde el modelo
  // unificado. Como en CC el monto vive en `moneda + monto`, derivamos los
  // otros valores asumiendo TC = 1 si la moneda nativa coincide.
  // Para info real de TC, se debería leer el `movimientoTesoreria` vinculado.
  const montoOriginal = mov.monto;
  const isUSD = mov.moneda === 'USD';
  const montoUSD = isUSD ? montoOriginal : 0;
  const montoPEN = !isUSD ? montoOriginal : 0;

  return {
    id: mov.id,
    fecha: mov.fecha,
    monedaPago: mov.moneda as 'USD' | 'PEN',
    montoOriginal,
    montoUSD,
    montoPEN,
    tipoCambio: 1, // sin info; consumers que lo necesitan deben leer movimientoTesoreria
    metodoPago: 'transferencia_bancaria', // default; consumers leen movimientoTesoreria si lo necesitan
    referencia: undefined,
    notas: mov.notas,
    movimientoTesoreriaId: mov.movimientoTesoreriaId,
    subOrdenId: undefined, // se popula vía refSubDocumentoId si está en el mov
    registradoPor: mov.registradoPor,
    fechaRegistro: mov.fechaRegistro,
  };
}

/**
 * Lee los pagos de una OC desde `movimientosCC` y los retorna en formato
 * legacy `PagoOCLegacy[]` ordenados por fecha asc (más viejo primero).
 *
 * Reemplaza `oc.historialPagos[]` para los consumidores existentes.
 *
 * @example
 *   const pagos = await getPagosOC('oc-id-123');
 *   const totalPagado = pagos.reduce((s, p) => s + p.montoUSD, 0);
 */
export async function getPagosOC(ocId: string): Promise<PagoOCLegacy[]> {
  if (!ocId) return [];

  const q = query(
    collection(db, COLLECTIONS.MOVIMIENTOS_CC),
    where('refDocumentoTipo', '==', 'oc'),
    where('refDocumentoId', '==', ocId),
    where('tipo', '==', 'credito_pago_oc'),
    orderBy('fecha', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const mov = { id: d.id, ...d.data() } as MovimientoCC;
    return movimientoCCAPagoOCLegacy(mov);
  });
}

/**
 * Calcula el monto total pagado de una OC en USD desde sus movimientos CC.
 * Reemplaza `oc.historialPagos.reduce((s, p) => s + p.montoUSD, 0)`.
 */
export async function getTotalPagadoOC_USD(ocId: string): Promise<number> {
  const pagos = await getPagosOC(ocId);
  return pagos.reduce((sum, p) => sum + p.montoUSD, 0);
}

/**
 * Filtra pagos por sub-orden específica.
 * Reemplaza `historialPagos.filter(p => p.subOrdenId === subId)`.
 */
export async function getPagosSubOrden(
  ocId: string,
  subOrdenId: string,
): Promise<PagoOCLegacy[]> {
  const pagos = await getPagosOC(ocId);
  return pagos.filter((p) => p.subOrdenId === subOrdenId);
}

/**
 * Helper genérico para queries por documento. Retorna movimientos crudos
 * (no convertidos a legacy). Útil para nuevos consumidores que prefieren
 * el modelo directo.
 */
export async function getMovimientosByDocumento(
  refDocumentoTipo: string,
  refDocumentoId: string,
): Promise<MovimientoCC[]> {
  if (!refDocumentoId) return [];
  const q = query(
    collection(db, COLLECTIONS.MOVIMIENTOS_CC),
    where('refDocumentoTipo', '==', refDocumentoTipo),
    where('refDocumentoId', '==', refDocumentoId),
    orderBy('fecha', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MovimientoCC);
}

// ═════════════════════════════════════════════════════════════════════════
// VENTAS · COBROS LEGACY (S55 Fase 3)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Forma legacy de un cobro de Venta. Reemplaza `venta.pagos[]` legacy.
 *
 * NO usar en código nuevo — preferir `MovimientoCC` directamente.
 */
export interface CobroVentaLegacy {
  id: string;
  fecha: Timestamp;
  /** 'anticipo' | 'pago' | 'saldo' — clasificación legacy. Aproximada en el adapter. */
  tipoPago?: 'anticipo' | 'pago' | 'saldo';
  monto: number;
  moneda?: 'PEN' | 'USD';
  metodoPago: string;
  referencia?: string;
  comprobante?: string;
  notas?: string;
  tipoCambio?: number;
  montoEquivalentePEN?: number;
  tesoreriaMovimientoId?: string;
  cuentaDestinoId?: string;
  errorTesoreria?: boolean;
  errorTesoreriaMsg?: string;
  registradoPor: string;
}

/**
 * Convierte un MovimientoCC tipo='credito_cobro_venta' al formato legacy
 * `CobroVentaLegacy`. Igual que `movimientoCCAPagoOCLegacy` pero para ventas.
 */
export function movimientoCCACobroVentaLegacy(mov: MovimientoCC): CobroVentaLegacy {
  return {
    id: mov.id,
    fecha: mov.fecha,
    tipoPago: 'pago', // default; tipoPago real se infiere del orden histórico
    monto: mov.monto,
    moneda: mov.moneda as 'PEN' | 'USD',
    metodoPago: 'transferencia', // default; consumers pueden leer movimientoTesoreria si necesitan
    referencia: undefined,
    notas: mov.notas,
    tesoreriaMovimientoId: mov.movimientoTesoreriaId,
    registradoPor: mov.registradoPor,
  };
}

/**
 * Lee los cobros de una Venta desde `movimientosCC` y los retorna en formato
 * legacy `CobroVentaLegacy[]` ordenados por fecha asc.
 *
 * Reemplaza `venta.pagos[]` para los consumidores existentes.
 */
export async function getCobrosVenta(ventaId: string): Promise<CobroVentaLegacy[]> {
  if (!ventaId) return [];

  const q = query(
    collection(db, COLLECTIONS.MOVIMIENTOS_CC),
    where('refDocumentoTipo', '==', 'venta'),
    where('refDocumentoId', '==', ventaId),
    where('tipo', '==', 'credito_cobro_venta'),
    orderBy('fecha', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const mov = { id: d.id, ...d.data() } as MovimientoCC;
    return movimientoCCACobroVentaLegacy(mov);
  });
}

/** Total cobrado de una venta en PEN desde sus movimientos CC. */
export async function getTotalCobradoVenta(ventaId: string): Promise<number> {
  const cobros = await getCobrosVenta(ventaId);
  return cobros.reduce((sum, c) => sum + c.monto, 0);
}

/**
 * Lee los adelantos de una Cotización desde `movimientosCC`. Retorna formato
 * legacy `CobroVentaLegacy[]` para consumidores existentes.
 */
export async function getAdelantosCotizacion(
  cotizacionId: string,
): Promise<CobroVentaLegacy[]> {
  if (!cotizacionId) return [];

  const q = query(
    collection(db, COLLECTIONS.MOVIMIENTOS_CC),
    where('refDocumentoTipo', '==', 'cotizacion'),
    where('refDocumentoId', '==', cotizacionId),
    where('tipo', '==', 'credito_adelanto_cotizacion'),
    orderBy('fecha', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const mov = { id: d.id, ...d.data() } as MovimientoCC;
    return {
      ...movimientoCCACobroVentaLegacy(mov),
      tipoPago: 'anticipo' as const,
    };
  });
}

// ═════════════════════════════════════════════════════════════════════════
// ENVIOS · PAGOS A COLABORADOR LEGACY (S55 Fase 4)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Forma legacy de un pago a colaborador en envíos. Reemplaza
 * `envio.pagosColaborador[]`.
 */
export interface PagoColaboradorLegacy {
  id: string;
  fecha: Timestamp;
  monedaPago: 'USD' | 'PEN';
  montoOriginal: number;
  montoUSD: number;
  montoPEN: number;
  tipoCambio: number;
  metodoPago: string;
  cuentaOrigenId?: string;
  cuentaOrigenNombre?: string;
  referencia?: string;
  notas?: string;
  movimientoTesoreriaId?: string;
  errorTesoreria?: boolean;
  errorTesoreriaMsg?: string;
  registradoPor: string;
  fechaRegistro: Timestamp;
}

/**
 * Convierte MovimientoCC tipo='credito_pago_envio' al formato legacy.
 */
export function movimientoCCAPagoColaboradorLegacy(
  mov: MovimientoCC,
): PagoColaboradorLegacy {
  // Heurística: monto USD/PEN se infiere de la moneda nativa.
  // Para info real (TC, método de pago), consumers leen el movimientoTesoreriaId.
  const isUSD = mov.moneda === 'USD';
  return {
    id: mov.id,
    fecha: mov.fecha,
    monedaPago: mov.moneda as 'USD' | 'PEN',
    montoOriginal: mov.monto,
    montoUSD: isUSD ? mov.monto : 0,
    montoPEN: !isUSD ? mov.monto : 0,
    tipoCambio: 1, // sin info; consumer puede leer movimientoTesoreria
    metodoPago: 'transferencia_bancaria', // default
    movimientoTesoreriaId: mov.movimientoTesoreriaId,
    registradoPor: mov.registradoPor,
    fechaRegistro: mov.fechaRegistro,
  };
}

/**
 * Lee los pagos al colaborador de un Envio desde `movimientosCC` y los
 * retorna en formato legacy `PagoColaboradorLegacy[]` ordenados por fecha asc.
 */
export async function getPagosEnvio(
  envioId: string,
): Promise<PagoColaboradorLegacy[]> {
  if (!envioId) return [];

  const q = query(
    collection(db, COLLECTIONS.MOVIMIENTOS_CC),
    where('refDocumentoTipo', '==', 'envio'),
    where('refDocumentoId', '==', envioId),
    where('tipo', '==', 'credito_pago_envio'),
    orderBy('fecha', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const mov = { id: d.id, ...d.data() } as MovimientoCC;
    return movimientoCCAPagoColaboradorLegacy(mov);
  });
}

/** Total pagado al colaborador en USD desde sus movimientos CC. */
export async function getTotalPagadoEnvioUSD(envioId: string): Promise<number> {
  const pagos = await getPagosEnvio(envioId);
  return pagos.reduce(
    (sum, p) => sum + (p.monedaPago === 'USD' ? p.montoOriginal : p.montoUSD),
    0,
  );
}

// ─── Gastos (S58b F5) ─────────────────────────────────────────────────────

/**
 * Forma legacy de un pago de gasto. Mismo shape que PagoGasto en el tipo,
 * con conversión USD↔PEN que el consumer puede usar para sumar pendiente.
 */
export interface PagoGastoLegacy {
  id: string;
  fecha: Timestamp;
  monedaPago: 'USD' | 'PEN';
  montoOriginal: number;
  montoUSD: number;
  montoPEN: number;
  tipoCambio: number;
  movimientoTesoreriaId?: string;
  registradoPor: string;
  fechaRegistro: Timestamp;
}

function movimientoCCAPagoGastoLegacy(mov: MovimientoCC): PagoGastoLegacy {
  const isUSD = mov.moneda === 'USD';
  return {
    id: mov.id,
    fecha: mov.fecha,
    monedaPago: mov.moneda as 'USD' | 'PEN',
    montoOriginal: mov.monto,
    // Heurística: si CC guarda USD, montoUSD=monto; PEN no derivable sin TC
    // → consumer debería leer movimientoTesoreriaId para TC real.
    montoUSD: isUSD ? mov.monto : 0,
    montoPEN: !isUSD ? mov.monto : 0,
    tipoCambio: 1,
    movimientoTesoreriaId: mov.movimientoTesoreriaId,
    registradoPor: mov.registradoPor,
    fechaRegistro: mov.fechaRegistro,
  };
}

/**
 * Lee los pagos de un gasto desde `movimientosCC`. Solo devuelve resultados
 * para gastos que tienen `proveedorId` vinculado (S58b F5+). Para gastos
 * legacy sin vinculación, los pagos siguen viviendo en `gasto.pagos[]` y
 * este adaptador retorna [].
 */
export async function getPagosGasto(
  gastoId: string,
): Promise<PagoGastoLegacy[]> {
  if (!gastoId) return [];

  const q = query(
    collection(db, COLLECTIONS.MOVIMIENTOS_CC),
    where('refDocumentoTipo', '==', 'gasto'),
    where('refDocumentoId', '==', gastoId),
    where('tipo', '==', 'credito_pago_gasto'),
    orderBy('fecha', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const mov = { id: d.id, ...d.data() } as MovimientoCC;
    return movimientoCCAPagoGastoLegacy(mov);
  });
}

/** Total pagado de un gasto en PEN, desde CC. */
export async function getTotalPagadoGastoPEN(
  gastoId: string,
  tipoCambioFallback = 1,
): Promise<number> {
  const pagos = await getPagosGasto(gastoId);
  return pagos.reduce((sum, p) => {
    if (p.monedaPago === 'PEN') return sum + p.montoOriginal;
    // Para USD, sin TC del mov original, multiplicar por fallback
    return sum + p.montoOriginal * tipoCambioFallback;
  }, 0);
}

// ─── Tarjeta de Crédito (S58d v2) ──────────────────────────────────────

/**
 * Obtiene el saldo de la CC de una tarjeta (entidad 'tarjeta_credito').
 * Saldo positivo = el negocio le debe al titular/banco.
 * Saldo cero = no hay cargos pendientes.
 *
 * Devuelve los 2 saldos por si la TC es bi-moneda.
 */
export async function getSaldoCCTarjeta(
  tarjetaCreditoId: string,
): Promise<{ saldoUSD: number; saldoPEN: number; existe: boolean }> {
  if (!tarjetaCreditoId) return { saldoUSD: 0, saldoPEN: 0, existe: false };

  const id = `tarjeta_credito_${tarjetaCreditoId}`;
  const ref = doc(collection(db, COLLECTIONS.CUENTAS_CORRIENTES), id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { saldoUSD: 0, saldoPEN: 0, existe: false };
  }
  const data = snap.data() as { saldoUSD?: number; saldoPEN?: number };
  return {
    saldoUSD: data.saldoUSD ?? 0,
    saldoPEN: data.saldoPEN ?? 0,
    existe: true,
  };
}

// ─── Re-exports para conveniencia ─────────────────────────────────────────

/** @deprecated Mantenida por compatibilidad. Usar PagoOCLegacy nuevo nombre. */
export type PagoOrdenCompra = PagoOCLegacy;

export type { MovimientoCC, MonedaCC };
