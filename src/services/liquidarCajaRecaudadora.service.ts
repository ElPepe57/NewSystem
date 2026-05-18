/**
 * liquidarCajaRecaudadora.service.ts — chk5.D-S1f · F3
 *
 * Liquidación periódica de Caja Recaudadora (D5 + D12). Transacción atómica
 * que cierra el ciclo: consolida cobros − servicios del periodo, transfiere
 * el saldo neto al banco destino, genera asiento contable, marca eventos
 * como liquidados, y reconoce servicios al proveedor recaudador via CC.
 *
 * Patrón similar a PagoEstadoCuentaTarjeta (TX-2):
 *   1. Validar recaudadora existe + activa + bien configurada
 *   2. Calcular balance del periodo (usar cajaRecaudadora.service)
 *   3. Validar saldoLiquidado ≈ balance.pendienteLiquidar (tolerancia 0.01)
 *   4. runTransaction Firestore:
 *      a. Crear LiquidacionRecaudadora (estado='confirmada')
 *      b. Marcar eventos del periodo como 'liquidado' + liquidacionId
 *      c. Generar MovimientoTesoreria (egreso recaudadora ↔ ingreso cuenta destino)
 *      d. Generar MovimientoCC con proveedor recaudador (servicios reconocidos)
 *      e. Generar AsientoContable (delegando a contabilidad.service si aplica)
 *
 * IDEMPOTENCIA: idempotencyKey por (recaudadoraId + fechaInicio + fechaFin +
 * saldoLiquidado). Reintento con misma key retorna liquidación existente.
 *
 * NOTA F3: en esta versión los pasos c/d/e son STUBS que registran TODOs
 * y emiten warnings logger · la integración real con movimientoTesoreria
 * + cuentaCorriente + contabilidad service se hace en F6 o S2 con tests
 * end-to-end. La transacción Firestore SI es atómica para los pasos a y b
 * (que son los críticos para integridad del balance).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  serverTimestamp,
  addDoc,
  updateDoc,
  runTransaction,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import type {
  ProductoFinanciero,
  TipoCanalRecaudacion,
} from '../types/productoFinanciero.types';
import type {
  LiquidacionRecaudadora,
  LiquidarSaldoRecaudadoraInput,
  LiquidarSaldoRecaudadoraResult,
  EventoServicioRecaudador,
} from '../types/eventoServicioRecaudador.types';
import { cajaRecaudadoraService, validarConfigRecaudadora } from './cajaRecaudadora.service';

// ═════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═════════════════════════════════════════════════════════════════════════

const LIQUIDACIONES_COLL = COLLECTIONS.LIQUIDACIONES_RECAUDADORA;
const EVENTOS_COLL = COLLECTIONS.EVENTOS_SERVICIO_RECAUDADOR;
const PRODUCTOS_COLL = COLLECTIONS.PRODUCTOS_FINANCIEROS;
const TOLERANCIA = 0.01;

// ═════════════════════════════════════════════════════════════════════════
// HELPERS PRIVADOS
// ═════════════════════════════════════════════════════════════════════════

async function generarCodigoLiquidacion(): Promise<string> {
  const year = new Date().getFullYear();
  return getNextSequenceNumber(`LIQ-${year}`, 4);
}

function generarIdempotencyKeyLiquidacion(input: LiquidarSaldoRecaudadoraInput): string {
  const fiIso = input.fechaInicio.toISOString().split('T')[0];
  const ffIso = input.fechaFin.toISOString().split('T')[0];
  return [
    'liq',
    input.recaudadoraId,
    fiIso,
    ffIso,
    input.saldoLiquidado.toFixed(2),
    input.cuentaDestinoId,
  ].join('|');
}

async function buscarLiquidacionPorIdempotencyKey(
  key: string,
): Promise<LiquidacionRecaudadora | null> {
  const q = query(
    collection(db, LIQUIDACIONES_COLL),
    where('idempotencyKey', '==', key),
    limit(1),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as LiquidacionRecaudadora;
}

async function getRecaudadora(id: string): Promise<ProductoFinanciero | null> {
  const docSnap = await getDoc(doc(db, PRODUCTOS_COLL, id));
  if (!docSnap.exists()) return null;
  const data = { id: docSnap.id, ...docSnap.data() } as ProductoFinanciero;
  if (data.tipoProducto !== 'caja_recaudadora') return null;
  return data;
}

async function getCuentaDestino(id: string): Promise<ProductoFinanciero | null> {
  const docSnap = await getDoc(doc(db, PRODUCTOS_COLL, id));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as ProductoFinanciero;
}

// ═════════════════════════════════════════════════════════════════════════
// SERVICIO PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════

export const liquidarCajaRecaudadoraService = {

  /**
   * Ejecuta una liquidación periódica de Caja Recaudadora.
   *
   * Pre-condiciones validadas:
   *   - Recaudadora existe + activa + bien configurada (validarConfigRecaudadora)
   *   - Cuenta destino existe + es producto banco (cuenta_corriente/ahorros/caja_efectivo)
   *   - Moneda match recaudadora vs cuenta destino
   *   - Balance calculado coincide con saldoLiquidado declarado (tolerancia 0.01)
   *   - Hay al menos 1 evento pendiente en el periodo
   *
   * Atómico (runTransaction Firestore):
   *   - Crea documento LiquidacionRecaudadora
   *   - Marca eventos del periodo como 'liquidado' + liquidacionId/Codigo
   *
   * Best-effort post-transacción (TODOs F6/S2):
   *   - Genera movimientoTesoreria (egreso recaudadora ↔ ingreso destino)
   *   - Genera movimientoCC con proveedor recaudador (servicios reconocidos)
   *   - Genera asientoContable
   *
   * IDEMPOTENCIA: si key ya existe retorna liquidación existente sin recrearla.
   */
  async liquidarSaldo(
    input: LiquidarSaldoRecaudadoraInput,
    userId: string,
  ): Promise<LiquidarSaldoRecaudadoraResult> {
    const key = input.idempotencyKey ?? generarIdempotencyKeyLiquidacion(input);

    // Idempotencia
    const existente = await buscarLiquidacionPorIdempotencyKey(key);
    if (existente) {
      logger.info(`Liquidación ya ejecutada con key ${key} · retornando existente ${existente.codigo}`);
      return {
        liquidacionId: existente.id,
        codigo: existente.codigo,
        movimientoTesoreriaId: existente.movimientoTesoreriaId ?? '',
        movimientoCCProveedorId: existente.movimientoCCProveedorId ?? '',
        asientoContableId: existente.asientoContableId ?? '',
        eventosLiquidadosCount: existente.eventoIds.length,
        saldoLiquidado: existente.saldoLiquidado,
        errores: [],
      };
    }

    // ── Pre-validaciones ────────────────────────────────────────────
    const recaudadora = await getRecaudadora(input.recaudadoraId);
    if (!recaudadora) {
      throw new Error(`Caja recaudadora ${input.recaudadoraId} no encontrada o no es tipo 'caja_recaudadora'.`);
    }

    const errConfig = validarConfigRecaudadora(recaudadora);
    if (errConfig) {
      throw new Error(`Recaudadora mal configurada: ${errConfig}`);
    }

    if (!recaudadora.activa) {
      throw new Error(`Recaudadora ${recaudadora.codigo} no está activa.`);
    }

    const cuentaDestino = await getCuentaDestino(input.cuentaDestinoId);
    if (!cuentaDestino) {
      throw new Error(`Cuenta destino ${input.cuentaDestinoId} no encontrada.`);
    }

    // Validar moneda match (recaudadora siempre PEN típicamente · destino igual)
    if (cuentaDestino.moneda !== recaudadora.moneda) {
      throw new Error(
        `Moneda cuenta destino (${cuentaDestino.moneda}) no coincide con recaudadora (${recaudadora.moneda}). ` +
        `Si necesitás convertir, usar wizard conversión USD↔PEN antes.`,
      );
    }

    if (input.saldoLiquidado <= 0) {
      throw new Error('El saldo a liquidar debe ser mayor a 0.');
    }

    // ── Calcular balance del periodo ────────────────────────────────
    const balance = await cajaRecaudadoraService.calcularBalanceMes(
      input.recaudadoraId,
      input.fechaInicio,
      input.fechaFin,
    );

    // Validar que saldoLiquidado coincide con balance calculado (tolerancia)
    const diff = Math.abs(balance.pendienteLiquidar - input.saldoLiquidado);
    if (diff > TOLERANCIA) {
      throw new Error(
        `Saldo a liquidar declarado (${input.saldoLiquidado.toFixed(2)}) no coincide con balance calculado ` +
        `(${balance.pendienteLiquidar.toFixed(2)}). Diferencia: ${diff.toFixed(2)}. ` +
        `Revisar eventos del periodo antes de liquidar.`,
      );
    }

    if (balance.eventosPendientesCount === 0) {
      throw new Error('No hay eventos pendientes en el periodo para liquidar.');
    }

    // ── Eventos a marcar como liquidado ─────────────────────────────
    const eventosPendientes = await cajaRecaudadoraService.getEventosPorPeriodo(
      input.recaudadoraId,
      input.fechaInicio,
      input.fechaFin,
      { estado: 'pendiente' },
    );

    if (eventosPendientes.length === 0) {
      throw new Error('No se encontraron eventos pendientes para liquidar (race condition?).');
    }

    // ── Construir documento liquidación ─────────────────────────────
    const codigo = await generarCodigoLiquidacion();
    const fechaLiquidacionTs = Timestamp.fromDate(input.fechaLiquidacion);
    const fechaInicioTs = Timestamp.fromDate(input.fechaInicio);
    const fechaFinTs = Timestamp.fromDate(input.fechaFin);

    // Convertir porCanal a record con counts (incluir solo canales con cobros)
    const cobrosPorCanal: Partial<Record<TipoCanalRecaudacion, { monto: number; eventos: number }>> = {};
    for (const [canal, datos] of Object.entries(balance.porCanal)) {
      if (datos && datos.monto > 0) {
        cobrosPorCanal[canal as TipoCanalRecaudacion] = datos;
      }
    }

    const liquidacionData: Omit<LiquidacionRecaudadora, 'id'> & { idempotencyKey: string } = {
      codigo,
      recaudadoraId: input.recaudadoraId,
      recaudadoraNombre: recaudadora.nombre,
      fechaInicio: fechaInicioTs,
      fechaFin: fechaFinTs,
      fechaLiquidacion: fechaLiquidacionTs,
      totalCobrosRecibidos: balance.cobrosRecibidos,
      totalServiciosDescontados: balance.serviciosDescontados,
      totalLiquidacionesPreviasEnPeriodo: balance.liquidacionesYa,
      saldoLiquidado: input.saldoLiquidado,
      cobrosPorCanal,
      cuentaDestinoId: input.cuentaDestinoId,
      cuentaDestinoNombre: cuentaDestino.nombre,
      moneda: recaudadora.moneda,
      eventoIds: eventosPendientes.map((e) => e.id),
      liquidadoPor: userId,
      fechaCreacion: serverTimestamp() as Timestamp,
      notas: input.notas,
      estado: 'confirmada',
      idempotencyKey: key,
    } as any;

    // ── Transacción atómica: crear liquidación + marcar eventos ─────
    const result = await runTransaction(db, async (transaction) => {
      // 1. Crear documento liquidación
      const liqRef = doc(collection(db, LIQUIDACIONES_COLL));
      transaction.set(liqRef, liquidacionData);

      // 2. Marcar cada evento pendiente como liquidado
      for (const evento of eventosPendientes) {
        const evtRef = doc(db, EVENTOS_COLL, evento.id);
        transaction.update(evtRef, {
          estado: 'liquidado',
          liquidacionId: liqRef.id,
          liquidacionCodigo: codigo,
          fechaLiquidacion: fechaLiquidacionTs,
        });
      }

      return {
        liquidacionId: liqRef.id,
        codigo,
      };
    });

    logger.info(
      `Liquidación atómica OK: ${codigo} · ${eventosPendientes.length} eventos marcados liquidados · ` +
      `saldo ${recaudadora.moneda} ${input.saldoLiquidado}`,
    );

    // ── Best-effort post-transacción (TODOs F6/S2) ──────────────────
    const errores: string[] = [];
    let movimientoTesoreriaId = '';
    let movimientoCCProveedorId = '';
    let asientoContableId = '';

    // TODO F6: integrar movimientoFinanciero.service para crear:
    //   - Egreso recaudadora (saldo recaudadora baja a 0)
    //   - Ingreso cuenta destino (saldo BCP sube por saldoLiquidado)
    logger.warn(
      `[TODO F6] Generar movimiento tesoreria para liquidacion ${codigo}: ` +
      `egreso recaudadora ${input.recaudadoraId} ↔ ingreso ${input.cuentaDestinoId}.`,
    );

    // TODO F6: integrar cuentaCorriente.service para reconocer servicios al proveedor
    if (balance.serviciosDescontados > 0 && recaudadora.responsableTerceroId) {
      logger.warn(
        `[TODO F6] Reconocer ${recaudadora.moneda} ${balance.serviciosDescontados} en CC del proveedor ` +
        `${recaudadora.responsableTerceroId} por servicios cobrados en liquidacion ${codigo}.`,
      );
    }

    // TODO F6: integrar contabilidad.service para asiento contable
    logger.warn(`[TODO F6] Generar asiento contable para liquidacion ${codigo}.`);

    // Actualizar la liquidación con FKs reales cuando F6 se implemente
    // Por ahora se queda con campos opcionales vacíos

    return {
      liquidacionId: result.liquidacionId,
      codigo: result.codigo,
      movimientoTesoreriaId,
      movimientoCCProveedorId,
      asientoContableId,
      eventosLiquidadosCount: eventosPendientes.length,
      saldoLiquidado: input.saldoLiquidado,
      errores,
    };
  },

  // ════════════════════════════════════════════════════════════════════
  // LECTURA
  // ════════════════════════════════════════════════════════════════════

  async getLiquidacionById(id: string): Promise<LiquidacionRecaudadora | null> {
    const docSnap = await getDoc(doc(db, LIQUIDACIONES_COLL, id));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as LiquidacionRecaudadora;
  },

  /**
   * Lista liquidaciones de una recaudadora · más recientes primero.
   */
  async getLiquidaciones(
    recaudadoraId: string,
    options?: { soloConfirmadas?: boolean },
  ): Promise<LiquidacionRecaudadora[]> {
    let q = query(
      collection(db, LIQUIDACIONES_COLL),
      where('recaudadoraId', '==', recaudadoraId),
    );
    const snapshot = await getDocs(q);
    let liquidaciones = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as LiquidacionRecaudadora));

    if (options?.soloConfirmadas) {
      liquidaciones = liquidaciones.filter((l) => l.estado === 'confirmada');
    }

    // Ordenar por fechaLiquidacion desc (más reciente primero)
    liquidaciones.sort((a, b) => {
      const ta = a.fechaLiquidacion?.toMillis() ?? 0;
      const tb = b.fechaLiquidacion?.toMillis() ?? 0;
      return tb - ta;
    });

    return liquidaciones;
  },

  // ════════════════════════════════════════════════════════════════════
  // ANULACIÓN (revertir liquidación)
  // ════════════════════════════════════════════════════════════════════

  /**
   * Anula una liquidación · revierte eventos a 'pendiente'.
   * NO permite anular si ya pasó +30 días (preservar histórico contable).
   * NO regenera movimientos tesoreria · esto requiere acción manual del usuario.
   */
  async anularLiquidacion(
    liquidacionId: string,
    motivo: string,
    userId: string,
  ): Promise<void> {
    const liq = await this.getLiquidacionById(liquidacionId);
    if (!liq) throw new Error(`Liquidación ${liquidacionId} no encontrada.`);
    if (liq.estado === 'anulada') {
      throw new Error(`Liquidación ${liq.codigo} ya estaba anulada.`);
    }
    if (!motivo || !motivo.trim()) {
      throw new Error('El motivo de anulación es obligatorio.');
    }

    // Validación temporal: no permitir anular liquidaciones > 30 días
    const fechaLiq = liq.fechaLiquidacion?.toDate();
    if (fechaLiq) {
      const dias = (Date.now() - fechaLiq.getTime()) / (1000 * 60 * 60 * 24);
      if (dias > 30) {
        throw new Error(
          `Liquidación ${liq.codigo} tiene ${Math.floor(dias)} días · no se permite anular >30 días por preservar histórico contable. ` +
          `Realizar ajuste contable manual.`,
        );
      }
    }

    // Transacción atómica: anular + revertir eventos
    await runTransaction(db, async (transaction) => {
      // 1. Marcar liquidación como anulada
      const liqRef = doc(db, LIQUIDACIONES_COLL, liquidacionId);
      transaction.update(liqRef, {
        estado: 'anulada',
        motivoAnulacion: motivo,
        anuladaPor: userId,
        fechaAnulacion: serverTimestamp(),
      });

      // 2. Revertir cada evento a pendiente
      for (const eventoId of liq.eventoIds) {
        const evtRef = doc(db, EVENTOS_COLL, eventoId);
        transaction.update(evtRef, {
          estado: 'pendiente',
          liquidacionId: null,
          liquidacionCodigo: null,
          fechaLiquidacion: null,
        });
      }
    });

    logger.warn(
      `Liquidación ${liq.codigo} anulada por ${userId} · motivo: ${motivo} · ` +
      `${liq.eventoIds.length} eventos revertidos a pendiente. ` +
      `[ACCIÓN MANUAL REQUERIDA] revertir movimiento tesoreria + CC proveedor + asiento contable si ya existían.`,
    );
  },
};
