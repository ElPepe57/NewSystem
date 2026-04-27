/**
 * cuentaCorriente.service.ts — S55 · Cuenta Corriente Unificada
 *
 * CRUD + operaciones atómicas sobre el libro de la CC.
 *
 * GARANTÍAS:
 *  - Cada movimiento es atómico vía Firestore Transaction:
 *    1. Lee/crea CC raíz
 *    2. Calcula nuevo saldo según tipo
 *    3. Crea documento MovimientoCC con snapshot post-movimiento
 *    4. Actualiza CC.saldoPEN/saldoUSD + fechaUltimoMovimiento + cantidadMovimientos
 *  - Movimientos son INMUTABLES post-creación (rules Firestore lo enforcean)
 *  - CC nunca se elimina (audit trail)
 *  - Saldos USD y PEN viven separados (no hay conversión cruzada)
 *  - Idempotencia opcional vía `idempotencyKey`
 *
 * Ver REGISTRO_IMPLEMENTACION.md S55 para decisiones de diseño.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as fsLimit,
  Timestamp,
  runTransaction,
  type Transaction,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import type {
  CuentaCorriente,
  MovimientoCC,
  MovimientoCCInput,
  CuentaCorrienteFiltros,
  MovimientoCCFiltros,
  TipoEntidadCC,
  TipoMovimientoCC,
  MonedaCC,
  SaldosResumen,
} from '../types/cuentaCorriente.types';
import {
  esDebito,
  esCredito,
  buildCuentaCorrienteId,
  TIPOS_APLICACION,
} from '../types/cuentaCorriente.types';

const CC_COLL = COLLECTIONS.CUENTAS_CORRIENTES;
const MOV_COLL = COLLECTIONS.MOVIMIENTOS_CC;

// ═════════════════════════════════════════════════════════════════════════
// HELPERS INTERNOS
// ═════════════════════════════════════════════════════════════════════════

/** Limpia campos undefined (Firestore no acepta undefined). */
function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      !(v instanceof Timestamp) &&
      !(v instanceof Date)
    ) {
      out[k] = removeUndefined(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

/**
 * Calcula el delta de saldo según tipo de movimiento.
 *
 * - Débitos: suman al saldo (la entidad nos debe más)
 * - Créditos: restan al saldo (la entidad nos debe menos / saldamos)
 * - Aplicaciones (aplicacion_saldo, devolucion_cash): restan al saldo
 *   (consumen saldo a favor)
 * - Ajuste manual: el signo lo define `direccionAjuste` del input
 */
function calcularDeltaSaldo(
  tipo: TipoMovimientoCC,
  monto: number,
  direccionAjuste?: 'debito' | 'credito',
): number {
  if (tipo === 'ajuste_manual') {
    if (!direccionAjuste) {
      throw new Error('ajuste_manual requiere direccionAjuste');
    }
    return direccionAjuste === 'debito' ? monto : -monto;
  }
  if (esDebito(tipo)) return monto;
  if (esCredito(tipo)) return -monto;
  throw new Error(`Tipo de movimiento desconocido: ${tipo}`);
}

/**
 * Genera un ID único para un movimiento. Suficientemente entropy para
 * evitar colisiones; el orden temporal lo da `fechaRegistro`.
 */
function generateMovimientoId(): string {
  return `mov_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ═════════════════════════════════════════════════════════════════════════
// SERVICE
// ═════════════════════════════════════════════════════════════════════════

export const cuentaCorrienteService = {
  // ───────────────────────────────────────────────────────────────────────
  // LECTURAS
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Obtiene la CC de una entidad. Retorna null si nunca tuvo movimiento.
   */
  async getByEntidad(
    entidadId: string,
    tipo: TipoEntidadCC,
  ): Promise<CuentaCorriente | null> {
    if (!entidadId) throw new Error('entidadId requerido');
    const ccId = buildCuentaCorrienteId(entidadId, tipo);
    const snap = await getDoc(doc(db, CC_COLL, ccId));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as CuentaCorriente) : null;
  },

  /**
   * Obtiene la CC por su ID determinístico.
   */
  async getById(ccId: string): Promise<CuentaCorriente | null> {
    if (!ccId) throw new Error('ccId requerido');
    const snap = await getDoc(doc(db, CC_COLL, ccId));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as CuentaCorriente) : null;
  },

  /**
   * Obtiene TODAS las CCs vinculadas a una entidadId (cross-tipo).
   * Útil para mostrar la "vista persona física" en fichas de Maestros:
   * Carlos Pérez puede tener CC como cliente + empleado + colaborador.
   */
  async getByEntidadFisicaId(entidadFisicaId: string): Promise<CuentaCorriente[]> {
    if (!entidadFisicaId) return [];
    const q = query(
      collection(db, CC_COLL),
      where('entidadId', '==', entidadFisicaId),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CuentaCorriente);
  },

  /**
   * Lista CCs filtradas. Soporta filtros por tipo y estado de saldo.
   * NOTA: filtros `conSaldo` / `soloDeudoras` / `soloAcreedoras` se aplican
   * en memoria (Firestore no permite OR de comparaciones en queries).
   */
  async getAll(filtros?: CuentaCorrienteFiltros): Promise<CuentaCorriente[]> {
    const constraints: QueryConstraint[] = [];
    if (filtros?.tipo) constraints.push(where('tipo', '==', filtros.tipo));

    const q =
      constraints.length > 0
        ? query(collection(db, CC_COLL), ...constraints, orderBy('entidadNombre', 'asc'))
        : query(collection(db, CC_COLL), orderBy('entidadNombre', 'asc'));

    const snap = await getDocs(q);
    let ccs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CuentaCorriente);

    if (filtros?.conSaldo) {
      ccs = ccs.filter((cc) => cc.saldoPEN !== 0 || cc.saldoUSD !== 0);
    }
    if (filtros?.soloDeudoras) {
      ccs = ccs.filter((cc) => cc.saldoPEN > 0 || cc.saldoUSD > 0);
    }
    if (filtros?.soloAcreedoras) {
      ccs = ccs.filter((cc) => cc.saldoPEN < 0 || cc.saldoUSD < 0);
    }
    return ccs;
  },

  /**
   * Lista movimientos de una CC ordenados por fecha desc.
   */
  async getMovimientos(
    cuentaCorrienteId: string,
    options?: { limit?: number },
  ): Promise<MovimientoCC[]> {
    if (!cuentaCorrienteId) throw new Error('cuentaCorrienteId requerido');
    const constraints: QueryConstraint[] = [
      where('cuentaCorrienteId', '==', cuentaCorrienteId),
      orderBy('fecha', 'desc'),
    ];
    if (options?.limit) constraints.push(fsLimit(options.limit));
    const q = query(collection(db, MOV_COLL), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MovimientoCC);
  },

  /**
   * Lista movimientos con filtros más amplios (usado por reportes / aging).
   */
  async getMovimientosByFiltros(
    filtros: MovimientoCCFiltros,
  ): Promise<MovimientoCC[]> {
    const constraints: QueryConstraint[] = [];
    if (filtros.cuentaCorrienteId) {
      constraints.push(where('cuentaCorrienteId', '==', filtros.cuentaCorrienteId));
    }
    if (filtros.refDocumentoId) {
      constraints.push(where('refDocumentoId', '==', filtros.refDocumentoId));
    }
    if (filtros.moneda) constraints.push(where('moneda', '==', filtros.moneda));
    if (Array.isArray(filtros.tipoMovimiento)) {
      // Firestore 'in' soporta hasta 30 valores
      constraints.push(where('tipo', 'in', filtros.tipoMovimiento.slice(0, 30)));
    } else if (filtros.tipoMovimiento) {
      constraints.push(where('tipo', '==', filtros.tipoMovimiento));
    }
    if (filtros.fechaDesde) {
      constraints.push(where('fecha', '>=', Timestamp.fromDate(filtros.fechaDesde)));
    }
    if (filtros.fechaHasta) {
      constraints.push(where('fecha', '<=', Timestamp.fromDate(filtros.fechaHasta)));
    }

    // Si hay filtros por fecha + otro, evitar índice compuesto: ordenar después
    const hasFechaFilter = !!filtros.fechaDesde || !!filtros.fechaHasta;
    const q = hasFechaFilter
      ? query(collection(db, MOV_COLL), ...constraints)
      : query(collection(db, MOV_COLL), ...constraints, orderBy('fecha', 'desc'));

    const snap = await getDocs(q);
    let movs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MovimientoCC);
    if (hasFechaFilter) {
      movs = movs.sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
    }
    return movs;
  },

  /**
   * Busca el MovimientoCC vinculado a un movimiento de tesorería.
   * Usado para cross-linking bidireccional CC ↔ Tesorería (S57 Fase B):
   * desde un mov de tesorería, abrir el drawer de la CC de la entidad asociada.
   *
   * Retorna null si el mov de tesorería no tiene contraparte en CC
   * (ej: gastos operativos, conversiones, transferencias internas).
   */
  async getMovimientoByTesoreriaId(
    movimientoTesoreriaId: string,
  ): Promise<MovimientoCC | null> {
    if (!movimientoTesoreriaId) return null;
    const q = query(
      collection(db, MOV_COLL),
      where('movimientoTesoreriaId', '==', movimientoTesoreriaId),
      fsLimit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as MovimientoCC;
  },

  /**
   * Resumen agregado de saldos por tipo. Usado por dashboards.
   */
  async getResumen(): Promise<SaldosResumen> {
    const ccs = await this.getAll();

    const byTipo: SaldosResumen['porTipo'] = {
      cliente: { cantidadEntidades: 0, debenAEmpresa: { PEN: 0, USD: 0 }, empresaDebe: { PEN: 0, USD: 0 } },
      proveedor: { cantidadEntidades: 0, debenAEmpresa: { PEN: 0, USD: 0 }, empresaDebe: { PEN: 0, USD: 0 } },
      colaborador: { cantidadEntidades: 0, debenAEmpresa: { PEN: 0, USD: 0 }, empresaDebe: { PEN: 0, USD: 0 } },
      empleado: { cantidadEntidades: 0, debenAEmpresa: { PEN: 0, USD: 0 }, empresaDebe: { PEN: 0, USD: 0 } },
    };

    for (const cc of ccs) {
      byTipo[cc.tipo].cantidadEntidades++;
      if (cc.saldoPEN > 0) byTipo[cc.tipo].debenAEmpresa.PEN += cc.saldoPEN;
      if (cc.saldoPEN < 0) byTipo[cc.tipo].empresaDebe.PEN += Math.abs(cc.saldoPEN);
      if (cc.saldoUSD > 0) byTipo[cc.tipo].debenAEmpresa.USD += cc.saldoUSD;
      if (cc.saldoUSD < 0) byTipo[cc.tipo].empresaDebe.USD += Math.abs(cc.saldoUSD);
    }

    const tiposArr = Object.values(byTipo);
    return {
      totalEntidades: ccs.length,
      totalDebenAEmpresa: {
        PEN: tiposArr.reduce((s, t) => s + t.debenAEmpresa.PEN, 0),
        USD: tiposArr.reduce((s, t) => s + t.debenAEmpresa.USD, 0),
      },
      totalEmpresaDebe: {
        PEN: tiposArr.reduce((s, t) => s + t.empresaDebe.PEN, 0),
        USD: tiposArr.reduce((s, t) => s + t.empresaDebe.USD, 0),
      },
      porTipo: byTipo,
    };
  },

  // ───────────────────────────────────────────────────────────────────────
  // ESCRITURA · OPERACIÓN ATÓMICA PRINCIPAL
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Registra un movimiento en la CC de forma atómica.
   *
   * **Flujo transaccional**:
   *  1. Lee CC. Si no existe, la crea con saldos en 0.
   *  2. Verifica idempotencia si se proveyó `idempotencyKey`.
   *  3. Calcula nuevo saldo (PEN o USD según moneda).
   *  4. Crea MovimientoCC con snapshot post-movimiento.
   *  5. Actualiza CC con nuevos saldos + metadatos.
   *
   * **Validaciones**:
   *  - monto > 0 (positivo)
   *  - motivoAjuste obligatorio si tipo === 'ajuste_manual'
   *  - direccionAjuste obligatorio si tipo === 'ajuste_manual'
   *
   * @returns ID del movimiento creado + nuevos saldos.
   */
  async registrarMovimiento(
    input: MovimientoCCInput,
    userId: string,
  ): Promise<{ movimientoId: string; saldoPEN: number; saldoUSD: number }> {
    // ── Validaciones de entrada ─────────────────────────────────────────
    if (!input.entidadId) throw new Error('entidadId requerido');
    if (!input.entidadNombre) throw new Error('entidadNombre requerido');
    if (!userId) throw new Error('userId requerido');
    if (input.monto <= 0) {
      throw new Error(`Monto debe ser positivo. Recibido: ${input.monto}`);
    }
    if (input.tipoMovimiento === 'ajuste_manual') {
      if (!input.motivoAjuste || !input.motivoAjuste.trim()) {
        throw new Error('ajuste_manual requiere motivoAjuste');
      }
      if (!input.direccionAjuste) {
        throw new Error('ajuste_manual requiere direccionAjuste');
      }
    }

    const ccId = buildCuentaCorrienteId(input.entidadId, input.tipo);
    const ccRef = doc(db, CC_COLL, ccId);
    const movId = generateMovimientoId();
    const movRef = doc(db, MOV_COLL, movId);
    const now = Timestamp.now();
    const fecha = input.fecha ? Timestamp.fromDate(input.fecha) : now;

    return await runTransaction(db, async (tx: Transaction) => {
      // ── Idempotencia ────────────────────────────────────────────────
      // Si se proveyó idempotencyKey, buscar movimiento existente con esa key
      // y la misma CC. Si existe, retornar el resultado sin duplicar.
      if (input.idempotencyKey) {
        const existingSnap = await getDocs(
          query(
            collection(db, MOV_COLL),
            where('cuentaCorrienteId', '==', ccId),
            where('idempotencyKey', '==', input.idempotencyKey),
            fsLimit(1),
          ),
        );
        if (!existingSnap.empty) {
          const existing = existingSnap.docs[0].data() as MovimientoCC;
          logger.info(
            `CC ${ccId}: movimiento idempotente reutilizado (key=${input.idempotencyKey})`,
          );
          return {
            movimientoId: existingSnap.docs[0].id,
            saldoPEN: existing.saldoPENDespues,
            saldoUSD: existing.saldoUSDDespues,
          };
        }
      }

      // ── Lee/crea CC raíz ────────────────────────────────────────────
      const ccSnap = await tx.get(ccRef);
      let saldoPEN = 0;
      let saldoUSD = 0;
      let cantidadMovimientos = 0;

      if (ccSnap.exists()) {
        const ccData = ccSnap.data() as CuentaCorriente;
        saldoPEN = ccData.saldoPEN || 0;
        saldoUSD = ccData.saldoUSD || 0;
        cantidadMovimientos = ccData.cantidadMovimientos || 0;
      }

      // ── Calcula nuevo saldo ─────────────────────────────────────────
      const delta = calcularDeltaSaldo(
        input.tipoMovimiento,
        input.monto,
        input.direccionAjuste,
      );
      const nuevoSaldoPEN = input.moneda === 'PEN' ? saldoPEN + delta : saldoPEN;
      const nuevoSaldoUSD = input.moneda === 'USD' ? saldoUSD + delta : saldoUSD;

      // ── Validación: aplicación no puede consumir más del saldo disponible ──
      if (TIPOS_APLICACION.includes(input.tipoMovimiento)) {
        const saldoAntesEnMoneda = input.moneda === 'PEN' ? saldoPEN : saldoUSD;
        if (saldoAntesEnMoneda < input.monto) {
          throw new Error(
            `Saldo insuficiente en ${input.moneda}: disponible ${saldoAntesEnMoneda.toFixed(2)}, intento aplicar ${input.monto.toFixed(2)}`,
          );
        }
      }

      // ── Construye documento del movimiento ──────────────────────────
      const mov: Omit<MovimientoCC, 'id'> = removeUndefined({
        cuentaCorrienteId: ccId,
        fecha,
        fechaRegistro: now,
        tipo: input.tipoMovimiento,
        descripcion: input.descripcion,
        moneda: input.moneda,
        monto: input.monto,
        refDocumentoTipo: input.refDocumentoTipo,
        refDocumentoId: input.refDocumentoId,
        refDocumentoNumero: input.refDocumentoNumero,
        movimientoTesoreriaId: input.movimientoTesoreriaId,
        aplicadoARefTipo: input.aplicadoARefTipo,
        aplicadoARefId: input.aplicadoARefId,
        aplicadoARefNumero: input.aplicadoARefNumero,
        saldoPENDespues: nuevoSaldoPEN,
        saldoUSDDespues: nuevoSaldoUSD,
        registradoPor: userId,
        notas: input.notas,
        motivoAjuste: input.motivoAjuste,
        idempotencyKey: input.idempotencyKey,
      } as Record<string, unknown>) as Omit<MovimientoCC, 'id'>;

      tx.set(movRef, mov);

      // ── Upsert CC raíz ──────────────────────────────────────────────
      if (ccSnap.exists()) {
        tx.update(ccRef, {
          saldoPEN: nuevoSaldoPEN,
          saldoUSD: nuevoSaldoUSD,
          fechaUltimoMovimiento: now,
          cantidadMovimientos: cantidadMovimientos + 1,
          // Refresca nombre por si la entidad cambió de nombre desde el último mov
          entidadNombre: input.entidadNombre,
        });
      } else {
        const ccNew: Omit<CuentaCorriente, 'id'> = {
          entidadId: input.entidadId,
          tipo: input.tipo,
          entidadNombre: input.entidadNombre,
          saldoPEN: nuevoSaldoPEN,
          saldoUSD: nuevoSaldoUSD,
          fechaCreacion: now,
          fechaUltimoMovimiento: now,
          cantidadMovimientos: 1,
        };
        tx.set(ccRef, ccNew);
      }

      logger.info(
        `CC ${ccId}: ${input.tipoMovimiento} ${input.moneda} ${input.monto.toFixed(2)} → saldo ${input.moneda}=${(input.moneda === 'PEN' ? nuevoSaldoPEN : nuevoSaldoUSD).toFixed(2)}`,
      );

      return {
        movimientoId: movId,
        saldoPEN: nuevoSaldoPEN,
        saldoUSD: nuevoSaldoUSD,
      };
    });
  },

  // ───────────────────────────────────────────────────────────────────────
  // OPERACIONES DE ALTO NIVEL (wrappers de registrarMovimiento)
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Aplica saldo a favor a otro documento (OC/Venta/Cotización).
   *
   * VALIDACIÓN: la moneda del documento destino debe coincidir con la moneda
   * del saldo a aplicar. NO se aplica USD a docs PEN ni viceversa (Decisión F3).
   *
   * El doc destino debe registrar la aplicación en sus propios campos
   * (responsabilidad del caller — este service solo toca CC).
   */
  async aplicarSaldo(params: {
    entidadId: string;
    tipo: TipoEntidadCC;
    entidadNombre: string;
    monto: number;
    moneda: MonedaCC;
    aplicadoARefTipo: 'oc' | 'venta' | 'cotizacion';
    aplicadoARefId: string;
    aplicadoARefNumero: string;
    descripcion?: string;
    userId: string;
  }): Promise<{ movimientoId: string }> {
    const desc =
      params.descripcion ||
      `Saldo a favor aplicado a ${params.aplicadoARefTipo.toUpperCase()} ${params.aplicadoARefNumero}`;

    const result = await this.registrarMovimiento(
      {
        entidadId: params.entidadId,
        tipo: params.tipo,
        entidadNombre: params.entidadNombre,
        tipoMovimiento: 'aplicacion_saldo',
        descripcion: desc,
        moneda: params.moneda,
        monto: params.monto,
        aplicadoARefTipo: params.aplicadoARefTipo,
        aplicadoARefId: params.aplicadoARefId,
        aplicadoARefNumero: params.aplicadoARefNumero,
      },
      params.userId,
    );

    return { movimientoId: result.movimientoId };
  },

  /**
   * Registra un ajuste manual con motivo obligatorio.
   * Usar para correcciones contables justificadas que no encajan en otros tipos.
   */
  async ajusteManual(params: {
    entidadId: string;
    tipo: TipoEntidadCC;
    entidadNombre: string;
    monto: number;
    moneda: MonedaCC;
    direccion: 'debito' | 'credito';
    motivo: string;
    userId: string;
  }): Promise<{ movimientoId: string }> {
    if (!params.motivo || !params.motivo.trim()) {
      throw new Error('Ajuste manual requiere motivo no vacío');
    }

    const result = await this.registrarMovimiento(
      {
        entidadId: params.entidadId,
        tipo: params.tipo,
        entidadNombre: params.entidadNombre,
        tipoMovimiento: 'ajuste_manual',
        descripcion: `Ajuste manual: ${params.motivo}`,
        moneda: params.moneda,
        monto: params.monto,
        direccionAjuste: params.direccion,
        motivoAjuste: params.motivo,
      },
      params.userId,
    );

    logger.warn(
      `CC ${buildCuentaCorrienteId(params.entidadId, params.tipo)}: AJUSTE MANUAL ${params.direccion} ${params.moneda} ${params.monto.toFixed(2)} — ${params.motivo}`,
    );

    return { movimientoId: result.movimientoId };
  },
};
