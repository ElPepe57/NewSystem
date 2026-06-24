/**
 * tesoreria.ajustes.service.ts · canon v5.2 chk5.E-RM
 *
 * Service especializado para "Ajuste de caja por verificación":
 * cuando el usuario verifica el saldo real y hay desviación, este service
 * permite registrar un movimiento de ajuste que cuadra el sistema con la
 * realidad reportada.
 *
 * Flujo:
 *  1. Usuario verifica · ej. "Banco tiene S/10,000" pero ERP decía S/9,500
 *  2. Sistema detecta desviación de +S/500
 *  3. Usuario click "Aplicar ajuste S/+500"
 *  4. Este service:
 *     a) Crea MovimientoFinanciero con categoría 'ajuste_positivo' o 'ajuste_negativo'
 *     b) Saldo de la cuenta se actualiza automáticamente vía aplicarDeltasASaldos
 *     c) Marca la verificación con audit trail (ajusteAplicado)
 *
 * Es contablemente correcto: el ajuste es un movimiento auditable · NO sobrescribe saldos.
 */

import {
  doc,
  collection,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  runTransaction,
  Timestamp,
  type Transaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';
import { registrarMovimientoFinanciero } from './movimientoFinanciero.service';
import { requiereAutorizacionSocio, type FirmaSocio, type ResultadoAutorizacionCF } from './autorizacionEgreso.helper';
import type {
  CuentaCaja,
  VerificacionSaldoSnapshot,
} from '../types/tesoreria.types';
import type {
  CategoriaMovimientoFinanciero,
  MovimientoFinancieroFormData,
} from '../types/movimientoFinanciero.types';

export interface AplicarAjusteInput {
  cuentaId: string;
  /** Monto del ajuste · positivo = sumar al ERP · negativo = restar */
  montoAjuste: number;
  /** Moneda del ajuste (debe coincidir con la cuenta · USD o PEN) */
  moneda: 'USD' | 'PEN';
  /** TC del momento · necesario para registrar equivalentes */
  tipoCambio: number;
  /** Razón opcional del ajuste · ej. "intereses bancarios no registrados" */
  razon?: string;
  userId: string;
  userNombre?: string;
}

export interface AplicarAjusteResult {
  /** A.2 · true cuando el ajuste_negativo >$1k quedó PENDIENTE de aprobación de socios (no se ejecutó). */
  pendienteAprobacion?: boolean;
  /** id del doc ajustesConciliacion (solo en el caso pendiente). */
  ajusteId?: string;
  movimientoId?: string;
  snapshotActualizado?: VerificacionSaldoSnapshot;
}

// ════════════════════════════════════════════════════════════════════════════════
// A.2 · AJUSTE STANDALONE · ajuste_negativo >$1k requiere aprobación de socios (clon del retiro)
// ════════════════════════════════════════════════════════════════════════════════

/** Doc del ajuste de conciliación pendiente de aprobación (sobre el que la CF autorizarEgreso aplica el quórum). */
export interface AjusteConciliacionDoc {
  id: string;
  cuentaId: string;
  montoAbs: number;
  moneda: 'USD' | 'PEN';
  tipoCambio: number;
  razon?: string;
  montoEstimadoUSD: number;
  estado: 'pendiente' | 'ejecutado' | 'cancelado';
  autorizacion?: { estado: 'pendiente' | 'aprobado' | 'rechazado'; firmas: FirmaSocio[] };
  creadoPor: string;
  movimientoId?: string;
  fechaCreacion?: unknown;
}

/** A.2 · crea el doc de ajuste pendiente (NO mueve cash · aparece en la bandeja · la CF lo ejecuta tras quórum). */
export async function solicitarAjusteConciliacion(input: {
  cuentaId: string; montoAbs: number; moneda: 'USD' | 'PEN'; tipoCambio: number;
  razon?: string; montoEstimadoUSD: number; userId: string;
}): Promise<string> {
  const docData: Record<string, unknown> = {
    cuentaId: input.cuentaId,
    montoAbs: input.montoAbs,
    moneda: input.moneda,
    tipoCambio: input.tipoCambio,
    montoEstimadoUSD: input.montoEstimadoUSD,
    estado: 'pendiente',
    autorizacion: { estado: 'pendiente', firmas: [], solicitadaPor: input.userId },
    creadoPor: input.userId,
    fechaCreacion: Timestamp.now(),
  };
  if (input.razon?.trim()) docData.razon = input.razon.trim();
  const ref = await addDoc(collection(db, COLLECTIONS.AJUSTES_CONCILIACION), docData);
  logger.info('[Ajuste] solicitud >$1k creada · pendiente de aprobación de socios', { ajusteId: ref.id });
  return ref.id;
}

/** A.2 · ejecuta el ajuste aprobado: mueve el cash vía la CF (que re-valida la aprobación · gate) y marca ejecutado. */
export async function ejecutarAjusteConciliacion(ajusteId: string, userId: string): Promise<string> {
  const snap = await getDoc(doc(db, COLLECTIONS.AJUSTES_CONCILIACION, ajusteId));
  if (!snap.exists()) throw new Error('Ajuste no encontrado');
  const a = snap.data() as Omit<AjusteConciliacionDoc, 'id'>;
  if (a.estado === 'ejecutado') return a.movimientoId ?? ''; // idempotente
  if (a.estado === 'cancelado') throw new Error('El ajuste está cancelado');

  // El cash · la CF registrarMovimientoCash re-valida autorizacion=aprobado (gate >$1k) antes de mover el saldo.
  const movimientoId = await registrarMovimientoFinanciero(
    {
      categoria: 'ajuste_negativo',
      moneda: a.moneda,
      monto: a.montoAbs,
      tipoCambio: a.tipoCambio,
      metodo: 'otro',
      concepto: a.razon?.trim() ? `Ajuste de saldo por verificación · ${a.razon.trim()}` : 'Ajuste de saldo por verificación bancaria',
      fecha: new Date(),
      productoOrigenId: a.cuentaId,
      refDocumentoTipo: 'ajuste',
      refDocumentoId: ajusteId,
    },
    userId,
  );
  await updateDoc(doc(db, COLLECTIONS.AJUSTES_CONCILIACION, ajusteId), {
    estado: 'ejecutado',
    movimientoId,
    ejecutadoPor: userId,
    fechaEjecucion: Timestamp.now(),
  });
  return movimientoId;
}

/** A.2 · lista los ajustes de conciliación (la bandeja de socio los agrega como 7ª fuente). */
export async function getAllAjustesConciliacion(): Promise<AjusteConciliacionDoc[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.AJUSTES_CONCILIACION));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AjusteConciliacionDoc, 'id'>) }));
}

/**
 * A.2 · firma de socio sobre un ajuste >$1k (bandeja). La CF autorizarEgreso aplica el quórum por equity sobre
 * ajustesConciliacion. Al COMPLETARSE, encadena la ejecución del cash (el ajuste ES el egreso · como el retiro ·
 * la CF de cash re-valida la aprobación · idempotente).
 */
export async function autorizarAjusteConciliacion(ajusteId: string, userId: string): Promise<ResultadoAutorizacionCF> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fn = httpsCallable<{ coleccion: string; docId: string }, ResultadoAutorizacionCF>(getFunctions(), 'autorizarEgreso');
  const { data } = await fn({ coleccion: COLLECTIONS.AJUSTES_CONCILIACION, docId: ajusteId });
  if (data.completa) {
    try {
      await ejecutarAjusteConciliacion(ajusteId, userId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`El ajuste fue aprobado pero no se pudo ejecutar: ${msg}. La aprobación quedó registrada · reintentá.`);
    }
  }
  return data;
}

/** A.2 · rechazo de socio sobre un ajuste · la CF deja autorizacion.estado='rechazado'. */
export async function rechazarAjusteConciliacion(ajusteId: string, motivo?: string): Promise<void> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fn = httpsCallable<{ coleccion: string; docId: string; motivo?: string }, { ok: true }>(getFunctions(), 'rechazarEgreso');
  await fn({ coleccion: COLLECTIONS.AJUSTES_CONCILIACION, docId: ajusteId, motivo });
}

/**
 * Aplicar ajuste de caja por verificación.
 *
 * Crea atómicamente:
 *   1. MovimientoFinanciero con categoría 'ajuste_positivo' o 'ajuste_negativo'
 *      → la cuenta de tesorería se actualiza vía aplicarDeltasASaldos del service
 *   2. Update de cuenta.ultimaVerificacion.ajusteAplicado (audit trail)
 *
 * Returns el ID del movimiento creado para que la UI pueda referenciarlo.
 */
export async function aplicarAjustePorVerificacion(
  input: AplicarAjusteInput,
): Promise<AplicarAjusteResult> {
  const { cuentaId, montoAjuste, moneda, tipoCambio, razon, userId, userNombre } = input;

  if (!cuentaId) throw new Error('cuentaId requerido');
  if (!Number.isFinite(montoAjuste) || montoAjuste === 0) {
    throw new Error('montoAjuste debe ser un número finito ≠ 0');
  }
  if (!userId) throw new Error('userId requerido para audit trail');
  if (!Number.isFinite(tipoCambio) || tipoCambio <= 0) {
    throw new Error('tipoCambio debe ser positivo');
  }

  // Verificar que la cuenta exista
  const cuentaRef = doc(db, COLLECTIONS.CUENTAS_CAJA, cuentaId);

  // ─── Crear el movimiento financiero (afuera de la transacción · multidoc) ─
  // El service `registrarMovimientoFinanciero` aplica deltas a saldos via su propio flujo
  const esPositivo = montoAjuste > 0;
  const montoAbs = Math.abs(montoAjuste);
  const categoria: CategoriaMovimientoFinanciero = esPositivo
    ? 'ajuste_positivo'
    : 'ajuste_negativo';

  // A.2 · un ajuste_negativo >$1k (saca dinero · vector para "tapar un faltante") requiere aprobación de socios.
  // Se crea un doc PENDIENTE y NO se mueve cash · aparece en la bandeja · la CF lo ejecuta tras el quórum. El
  // ajuste_positivo (suma · ingreso) y los ≤$1k siguen directos. La CF igual bloquea fail-closed un >$1k sin aprobar.
  const montoUSDAjuste = moneda === 'USD' ? montoAbs : montoAbs / tipoCambio;
  if (!esPositivo && requiereAutorizacionSocio(montoUSDAjuste)) {
    const ajusteId = await solicitarAjusteConciliacion({ cuentaId, montoAbs, moneda, tipoCambio, razon, montoEstimadoUSD: montoUSDAjuste, userId });
    return { pendienteAprobacion: true, ajusteId };
  }

  const formData: MovimientoFinancieroFormData = {
    categoria,
    moneda,
    monto: montoAbs,
    tipoCambio,
    metodo: 'otro',
    concepto: razon?.trim()
      ? `Ajuste de saldo por verificación · ${razon.trim()}`
      : 'Ajuste de saldo por verificación bancaria',
    notas: razon?.trim() ?? undefined,
    fecha: new Date(),
    // Productos afectados:
    // - ajuste_positivo: destino = cuenta (sumar al saldo)
    // - ajuste_negativo: origen = cuenta (restar del saldo)
    ...(esPositivo
      ? { productoDestinoId: cuentaId }
      : { productoOrigenId: cuentaId }),
  };

  const movimientoId = await registrarMovimientoFinanciero(formData, userId);

  logger.info('[Ajuste verificación] Movimiento creado', {
    movimientoId,
    cuentaId,
    montoAjuste,
    moneda,
    categoria,
  });

  // ─── Update audit trail en ultimaVerificacion (transacción atómica) ─
  const snapshotActualizado = await runTransaction(db, async (tx: Transaction) => {
    const snap = await tx.get(cuentaRef);
    if (!snap.exists()) {
      throw new Error(`Cuenta ${cuentaId} no encontrada`);
    }
    const cuenta = snap.data() as CuentaCaja;
    const ultimaVerif = cuenta.ultimaVerificacion;
    if (!ultimaVerif) {
      // Edge case: aplicar ajuste sin haber verificado antes · no debería pasar desde UI
      // pero lo manejamos · no actualizamos el snapshot porque no hay
      throw new Error(
        'No hay verificación previa para marcar ajuste · verificá el saldo primero',
      );
    }

    const ajusteAplicado = {
      fecha: Timestamp.now(),
      movimientoId,
      montoAjuste,
      ...(razon?.trim() ? { razon: razon.trim() } : {}),
      aplicadoPor: userId,
    };

    const newSnapshot: VerificacionSaldoSnapshot = {
      ...ultimaVerif,
      ajusteAplicado,
    };

    // Actualizar también el primer item del historial (que es el mismo snapshot)
    const historialPrev = Array.isArray(cuenta.historialVerificaciones)
      ? cuenta.historialVerificaciones
      : [];
    const historialNuevo = historialPrev.length > 0
      ? [newSnapshot, ...historialPrev.slice(1)]
      : [newSnapshot];

    tx.update(cuentaRef, {
      ultimaVerificacion: newSnapshot,
      historialVerificaciones: historialNuevo,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });

    // userNombre se preserva pero no se modifica en este update
    void userNombre;
    return newSnapshot;
  });

  return {
    movimientoId,
    snapshotActualizado,
  };
}
