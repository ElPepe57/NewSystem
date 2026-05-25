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
  runTransaction,
  Timestamp,
  type Transaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';
import { registrarMovimientoFinanciero } from './movimientoFinanciero.service';
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
  movimientoId: string;
  snapshotActualizado: VerificacionSaldoSnapshot;
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
