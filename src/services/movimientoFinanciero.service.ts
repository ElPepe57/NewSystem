/**
 * movimientoFinanciero.service.ts — ADR-PF-001 · F2
 *
 * Libro mayor unificado. Cada inserción dispara la actualización del saldo
 * cacheado de los productos afectados (D-PF-3).
 *
 * Reemplazará en F4-F5:
 *   - tesoreria.movimientos.service (movimientosTesoreria)
 *   - cargoTarjeta.service (cargosTarjeta)
 *   - pagoEstadoCuentaTarjeta.service (pagosEstadoCuentaTC)
 *   - tesoreria.conversiones.service (conversionesCambiarias)
 *
 * En F2 (esta sesión) coexiste con todos los anteriores. En F3 los services
 * de pagos (venta.pagos, ordenCompra.pagos, etc.) empezarán a llamar a este
 * en lugar de los legacy.
 *
 * Decisiones aplicadas:
 *   - D-PF-3: actualiza saldo cacheado tras cada movimiento ejecutado
 *   - D-PF-4: una sola colección movimientosFinancieros
 *   - P-1: persiste canalUtilizado para BI
 *   - P-2: conversiones se crean como par con idempotencyKey común
 *   - TAREA-101: persiste loteId para Pagos Masivos
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type {
  MovimientoFinanciero,
  MovimientoFinancieroFormData,
  CategoriaMovimientoFinanciero,
  EstadoMovimientoFinanciero,
  CanalUtilizado,
  RefDocumentoTipo,
  MonedaPF,
} from '../types/movimientoFinanciero.types';
import {
  esIngreso,
  esEgreso,
  esInterno,
  CATEGORIA_LABEL,
} from '../types/movimientoFinanciero.types';
import { aplicarDeltaSaldo } from './productoFinanciero.service';

const COL = COLLECTIONS.MOVIMIENTOS_FINANCIEROS;

// ═════════════════════════════════════════════════════════════════════════
// VALIDACIONES INTERNAS
// ═════════════════════════════════════════════════════════════════════════

function validarFormData(data: MovimientoFinancieroFormData): void {
  if (!data.categoria) throw new Error('Categoría obligatoria');
  if (!data.moneda) throw new Error('Moneda obligatoria');
  if (data.monto === undefined || data.monto <= 0) {
    throw new Error('Monto debe ser mayor a 0');
  }
  if (!data.tipoCambio || data.tipoCambio <= 0) {
    throw new Error('TipoCambio debe ser mayor a 0');
  }
  if (!data.concepto?.trim()) throw new Error('Concepto obligatorio');
  if (!data.fecha) throw new Error('Fecha obligatoria');

  // Validar productos según tipo de movimiento
  const cat = data.categoria;
  if (esIngreso(cat) && !data.productoDestinoId) {
    throw new Error(
      `Categoría "${CATEGORIA_LABEL[cat]}" requiere productoDestinoId`,
    );
  }
  if (esEgreso(cat) && !data.productoOrigenId) {
    throw new Error(
      `Categoría "${CATEGORIA_LABEL[cat]}" requiere productoOrigenId`,
    );
  }
  if (esInterno(cat)) {
    if (!data.productoOrigenId || !data.productoDestinoId) {
      throw new Error(
        `Categoría "${CATEGORIA_LABEL[cat]}" requiere productoOrigenId Y productoDestinoId`,
      );
    }
    if (data.productoOrigenId === data.productoDestinoId) {
      throw new Error('Origen y destino no pueden ser el mismo producto');
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════
// CREAR (con afectación de saldo)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Crea un movimiento financiero y aplica el delta a los saldos cacheados
 * de los productos afectados (D-PF-3).
 *
 * Si el movimiento tiene estado='pendiente' (programado), NO se aplica
 * delta. Solo cuando se marca 'ejecutado' (ahora o luego con `marcarEjecutado`).
 */
export async function registrarMovimientoFinanciero(
  data: MovimientoFinancieroFormData,
  userId: string,
  opts: { estado?: EstadoMovimientoFinanciero } = {},
): Promise<string> {
  validarFormData(data);

  const estado = opts.estado ?? 'ejecutado';

  // Generar numeroMovimiento (MF-2026-001)
  const numeroMovimiento = await generarNumeroMovimiento();

  const montoEquivalentePEN =
    data.moneda === 'PEN' ? data.monto : data.monto * data.tipoCambio;
  const montoEquivalenteUSD =
    data.moneda === 'USD' ? data.monto : data.monto / data.tipoCambio;

  const docData: Record<string, unknown> = {
    numeroMovimiento,
    categoria: data.categoria,
    estado,

    moneda: data.moneda,
    monto: data.monto,
    tipoCambio: data.tipoCambio,
    montoEquivalentePEN,
    montoEquivalenteUSD,

    concepto: data.concepto.trim(),
    fecha: Timestamp.fromDate(data.fecha),

    creadoPor: userId,
    fechaCreacion: Timestamp.now(),
  };

  // Productos afectados
  if (data.productoOrigenId) docData.productoOrigenId = data.productoOrigenId;
  if (data.productoDestinoId) docData.productoDestinoId = data.productoDestinoId;

  // Línea de negocio
  if (data.lineaNegocioId) docData.lineaNegocioId = data.lineaNegocioId;

  // Método y canal
  if (data.metodo?.trim()) docData.metodo = data.metodo.trim();
  if (data.referencia?.trim()) docData.referencia = data.referencia.trim();
  if (data.canalUtilizado) docData.canalUtilizado = data.canalUtilizado;

  // Documento relacionado
  if (data.refDocumentoTipo) docData.refDocumentoTipo = data.refDocumentoTipo;
  if (data.refDocumentoId) docData.refDocumentoId = data.refDocumentoId;
  if (data.refDocumentoNumero) docData.refDocumentoNumero = data.refDocumentoNumero;

  // Lote padre
  if (data.loteId) docData.loteId = data.loteId;
  if (data.loteNumero) docData.loteNumero = data.loteNumero;

  // Notas y comprobante
  if (data.notas?.trim()) docData.notas = data.notas.trim();
  if (data.urlComprobante?.trim()) docData.urlComprobante = data.urlComprobante.trim();

  // Fecha programada
  if (data.fechaProgramada) {
    docData.fechaProgramada = Timestamp.fromDate(data.fechaProgramada);
  }

  // Idempotencia (P-2: par de conversiones comparte clave)
  if (data.idempotencyKey) docData.idempotencyKey = data.idempotencyKey;

  // ─── Insertar el movimiento ───────────────────────────────────────
  const ref = await addDoc(collection(db, COL), docData);

  // ─── Aplicar delta de saldo (solo si ejecutado) ──────────────────
  if (estado === 'ejecutado') {
    await aplicarDeltasASaldos(
      data.productoOrigenId,
      data.productoDestinoId,
      data.monto,
      data.moneda,
      userId,
    );
  }

  return ref.id;
}

/**
 * Helper: aplica los deltas de saldo a los productos de origen y/o destino.
 * - Origen: -monto
 * - Destino: +monto
 */
async function aplicarDeltasASaldos(
  productoOrigenId: string | undefined,
  productoDestinoId: string | undefined,
  monto: number,
  moneda: MonedaPF,
  userId: string,
): Promise<void> {
  const tasks: Promise<void>[] = [];
  if (productoOrigenId) {
    tasks.push(aplicarDeltaSaldo(productoOrigenId, -monto, moneda, userId));
  }
  if (productoDestinoId) {
    tasks.push(aplicarDeltaSaldo(productoDestinoId, monto, moneda, userId));
  }
  await Promise.all(tasks);
}

// ═════════════════════════════════════════════════════════════════════════
// CONVERSIÓN CAMBIARIA (par de movimientos · P-2)
// ═════════════════════════════════════════════════════════════════════════

export interface ConversionInput {
  productoOrigenId: string;          // Producto USD (cuenta o caja)
  productoDestinoId: string;         // Producto PEN
  montoOrigen: number;               // En la moneda del origen
  monedaOrigen: MonedaPF;
  monedaDestino: MonedaPF;
  tipoCambio: number;                // TC aplicado en la conversión
  fecha: Date;
  concepto: string;
  notas?: string;
  urlComprobante?: string;
}

/**
 * Crea el par de movimientos de una conversión cambiaria. Ambos comparten
 * el mismo idempotencyKey para que se puedan reconstruir como una unidad.
 *
 * Resolución P-2 del ADR.
 */
export async function registrarConversionCambiaria(
  input: ConversionInput,
  userId: string,
): Promise<{ idSalida: string; idEntrada: string; idempotencyKey: string }> {
  if (input.monedaOrigen === input.monedaDestino) {
    throw new Error('Moneda origen y destino no pueden ser iguales');
  }
  if (input.montoOrigen <= 0) {
    throw new Error('Monto origen debe ser mayor a 0');
  }
  if (input.tipoCambio <= 0) {
    throw new Error('TipoCambio debe ser mayor a 0');
  }

  // Calcular monto destino según TC
  const montoDestino =
    input.monedaOrigen === 'USD'
      ? input.montoOrigen * input.tipoCambio  // USD → PEN
      : input.montoOrigen / input.tipoCambio; // PEN → USD

  const idempotencyKey = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Movimiento de SALIDA (sale del producto origen)
  const idSalida = await registrarMovimientoFinanciero(
    {
      categoria: 'conversion_salida',
      productoOrigenId: input.productoOrigenId,
      moneda: input.monedaOrigen,
      monto: input.montoOrigen,
      tipoCambio: input.tipoCambio,
      concepto: `${input.concepto} (salida ${input.monedaOrigen})`,
      fecha: input.fecha,
      idempotencyKey,
      notas: input.notas,
      urlComprobante: input.urlComprobante,
      refDocumentoTipo: 'conversion',
    },
    userId,
  );

  // Movimiento de ENTRADA (entra al producto destino)
  const idEntrada = await registrarMovimientoFinanciero(
    {
      categoria: 'conversion_entrada',
      productoDestinoId: input.productoDestinoId,
      moneda: input.monedaDestino,
      monto: montoDestino,
      tipoCambio: input.tipoCambio,
      concepto: `${input.concepto} (entrada ${input.monedaDestino})`,
      fecha: input.fecha,
      idempotencyKey,
      notas: input.notas,
      refDocumentoTipo: 'conversion',
    },
    userId,
  );

  return { idSalida, idEntrada, idempotencyKey };
}

// ═════════════════════════════════════════════════════════════════════════
// TRANSFERENCIA INTERNA (un solo movimiento, afecta 2 productos)
// ═════════════════════════════════════════════════════════════════════════

export interface TransferenciaInput {
  productoOrigenId: string;
  productoDestinoId: string;
  monto: number;
  moneda: MonedaPF;
  tipoCambio: number;
  fecha: Date;
  concepto: string;
  notas?: string;
}

export async function registrarTransferenciaInterna(
  input: TransferenciaInput,
  userId: string,
): Promise<string> {
  return registrarMovimientoFinanciero(
    {
      categoria: 'transferencia_interna',
      productoOrigenId: input.productoOrigenId,
      productoDestinoId: input.productoDestinoId,
      moneda: input.moneda,
      monto: input.monto,
      tipoCambio: input.tipoCambio,
      concepto: input.concepto,
      fecha: input.fecha,
      notas: input.notas,
      refDocumentoTipo: 'transferencia',
    },
    userId,
  );
}

// ═════════════════════════════════════════════════════════════════════════
// LEER
// ═════════════════════════════════════════════════════════════════════════

export async function getMovimientoFinanciero(
  id: string,
): Promise<MovimientoFinanciero | null> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as MovimientoFinanciero;
}

export async function getMovimientosPorProducto(
  productoId: string,
  opts: { estado?: EstadoMovimientoFinanciero; max?: number } = {},
): Promise<MovimientoFinanciero[]> {
  const max = opts.max ?? 200;

  // Firestore no permite OR en una query con !=, así que hacemos 2 queries
  // y combinamos: una por origen, otra por destino.
  const constraints = [where('estado', '==', opts.estado ?? 'ejecutado')];

  const [origenSnap, destinoSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, COL),
        where('productoOrigenId', '==', productoId),
        ...constraints,
        orderBy('fecha', 'desc'),
        limit(max),
      ),
    ),
    getDocs(
      query(
        collection(db, COL),
        where('productoDestinoId', '==', productoId),
        ...constraints,
        orderBy('fecha', 'desc'),
        limit(max),
      ),
    ),
  ]);

  const movs = new Map<string, MovimientoFinanciero>();
  for (const d of [...origenSnap.docs, ...destinoSnap.docs]) {
    movs.set(d.id, { id: d.id, ...d.data() } as MovimientoFinanciero);
  }
  // Ordenar por fecha desc
  return Array.from(movs.values()).sort((a, b) => {
    const ta = a.fecha?.toMillis?.() ?? 0;
    const tb = b.fecha?.toMillis?.() ?? 0;
    return tb - ta;
  }).slice(0, max);
}

export async function getMovimientosPorLote(
  loteId: string,
): Promise<MovimientoFinanciero[]> {
  const q = query(
    collection(db, COL),
    where('loteId', '==', loteId),
    orderBy('fecha', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MovimientoFinanciero);
}

export async function getMovimientosPorCategoria(
  categoria: CategoriaMovimientoFinanciero,
  opts: { fechaDesde?: Date; fechaHasta?: Date; max?: number } = {},
): Promise<MovimientoFinanciero[]> {
  const constraints = [where('categoria', '==', categoria)];
  if (opts.fechaDesde) {
    constraints.push(where('fecha', '>=', Timestamp.fromDate(opts.fechaDesde)));
  }
  if (opts.fechaHasta) {
    constraints.push(where('fecha', '<=', Timestamp.fromDate(opts.fechaHasta)));
  }
  const q = query(
    collection(db, COL),
    ...constraints,
    orderBy('fecha', 'desc'),
    limit(opts.max ?? 500),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MovimientoFinanciero);
}

export async function getMovimientosPorCanal(
  canal: CanalUtilizado,
  opts: { fechaDesde?: Date; fechaHasta?: Date; max?: number } = {},
): Promise<MovimientoFinanciero[]> {
  const constraints = [where('canalUtilizado', '==', canal)];
  if (opts.fechaDesde) {
    constraints.push(where('fecha', '>=', Timestamp.fromDate(opts.fechaDesde)));
  }
  if (opts.fechaHasta) {
    constraints.push(where('fecha', '<=', Timestamp.fromDate(opts.fechaHasta)));
  }
  const q = query(
    collection(db, COL),
    ...constraints,
    orderBy('fecha', 'desc'),
    limit(opts.max ?? 500),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MovimientoFinanciero);
}

export async function getMovimientosPorDocumento(
  refDocumentoTipo: RefDocumentoTipo,
  refDocumentoId: string,
): Promise<MovimientoFinanciero[]> {
  const q = query(
    collection(db, COL),
    where('refDocumentoTipo', '==', refDocumentoTipo),
    where('refDocumentoId', '==', refDocumentoId),
    orderBy('fecha', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MovimientoFinanciero);
}

// ═════════════════════════════════════════════════════════════════════════
// ANULAR
// ═════════════════════════════════════════════════════════════════════════

/**
 * Anula un movimiento ya ejecutado. Revierte el delta de saldo.
 * No borra el doc — preserva audit trail con estado='anulado'.
 */
export async function anularMovimientoFinanciero(
  id: string,
  motivo: string,
  userId: string,
): Promise<void> {
  const mov = await getMovimientoFinanciero(id);
  if (!mov) throw new Error(`Movimiento ${id} no existe`);
  if (mov.estado === 'anulado') {
    throw new Error('El movimiento ya está anulado');
  }
  if (!motivo?.trim()) {
    throw new Error('El motivo de anulación es obligatorio');
  }

  // Si estaba ejecutado, revertir saldos
  if (mov.estado === 'ejecutado') {
    await aplicarDeltasASaldos(
      // Invertir: el destino "devuelve" y el origen "recibe"
      mov.productoDestinoId,
      mov.productoOrigenId,
      mov.monto,
      mov.moneda,
      userId,
    );
  }

  await updateDoc(doc(db, COL, id), {
    estado: 'anulado',
    anuladoPor: userId,
    fechaAnulacion: Timestamp.now(),
    motivoAnulacion: motivo.trim(),
  });
}

// ═════════════════════════════════════════════════════════════════════════
// RECÁLCULO DE SALDOS DESDE LIBRO MAYOR (D-PF-3)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Suma todos los movimientos ejecutados de un producto y devuelve el saldo
 * derivado. Útil para el botón "recalcular" del UI o para reconciliación.
 *
 * Soporta bi-moneda: si moneda no se pasa, retorna ambos.
 */
export async function calcularSaldoDesdeLibroMayor(
  productoId: string,
): Promise<{ saldoUSD: number; saldoPEN: number }> {
  const movs = await getMovimientosPorProducto(productoId, {
    estado: 'ejecutado',
    max: 100000,
  });

  let saldoUSD = 0;
  let saldoPEN = 0;

  for (const m of movs) {
    const esOrigen = m.productoOrigenId === productoId;
    const esDestino = m.productoDestinoId === productoId;
    const signo = esDestino ? 1 : esOrigen ? -1 : 0;
    if (signo === 0) continue;

    if (m.moneda === 'USD') saldoUSD += signo * m.monto;
    else saldoPEN += signo * m.monto;
  }

  return { saldoUSD, saldoPEN };
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

async function generarNumeroMovimiento(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `MF-${year}-`;
  const q = query(
    collection(db, COL),
    where('numeroMovimiento', '>=', prefix),
    where('numeroMovimiento', '<', `MF-${year + 1}-`),
    orderBy('numeroMovimiento', 'desc'),
    limit(1),
  );
  const snap = await getDocs(q);
  let next = 1;
  if (!snap.empty) {
    const ultimo = snap.docs[0].data().numeroMovimiento as string;
    const m = ultimo.match(/^MF-\d{4}-(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${next.toString().padStart(3, '0')}`;
}

// Re-export
export type {
  MovimientoFinanciero,
  MovimientoFinancieroFormData,
  CategoriaMovimientoFinanciero,
  EstadoMovimientoFinanciero,
  CanalUtilizado,
  RefDocumentoTipo,
};
