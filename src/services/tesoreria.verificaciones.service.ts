/**
 * tesoreria.verificaciones.service.ts — chk5.D-S9.B
 *
 * Verificación manual de saldos contra el banco real.
 *
 * Concepto: el usuario abre el app del banco, lee el saldo real, lo ingresa
 * al ERP. El sistema registra un snapshot con la diferencia detectada y la
 * persiste en la CuentaCaja (last + history). NO es conciliación bancaria:
 * no importa extracto, no hace matching automático.
 *
 * Operación atómica (transacción Firestore):
 *   1. Lee CuentaCaja
 *   2. Calcula saldoErpEnEseMomento desde el snapshot leído
 *   3. Calcula diferencia = saldoBancoReportado - saldoErpEnEseMomento
 *   4. Construye el snapshot
 *   5. Actualiza CuentaCaja.ultimaVerificacion + push a historialVerificaciones (cap 12)
 *   6. Set actualizadoPor + fechaActualizacion
 *
 * Si la transacción falla, ningún cambio se persiste.
 */

import {
  doc,
  runTransaction,
  Timestamp,
  type Transaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type {
  CuentaCaja,
  MonedaTesoreria,
  VerificacionSaldoSnapshot,
} from '../types/tesoreria.types';

const HISTORIAL_MAX = 12;

// ─── Tipos públicos ─────────────────────────────────────────────────

export interface RegistrarVerificacionInput {
  cuentaId: string;
  moneda: MonedaTesoreria;
  /** Saldo real que el usuario leyó del app del banco */
  saldoBancoReportado: number;
  /** Notas opcionales · útiles si hay diferencia para anotar la causa */
  notas?: string;
  /** userId del socio · usado para audit trail */
  userId: string;
  /** Nombre del socio · desnormalizado para display rápido */
  userNombre?: string;
}

export interface RegistrarVerificacionResult {
  snapshot: VerificacionSaldoSnapshot;
  /** Movimientos previos · útil si el usuario quiere ver el historial al cuadrar */
  saldoErpEnEseMomento: number;
}

// ─── Implementación ─────────────────────────────────────────────────

/**
 * Registra una verificación manual de saldo · transacción atómica.
 *
 * Devuelve el snapshot creado para que la UI muestre la diferencia
 * detectada inmediatamente.
 */
export async function registrarVerificacionSaldo(
  input: RegistrarVerificacionInput,
): Promise<RegistrarVerificacionResult> {
  if (!input.cuentaId) throw new Error('cuentaId requerido');
  if (!Number.isFinite(input.saldoBancoReportado)) {
    throw new Error('saldoBancoReportado debe ser un número finito');
  }
  if (!input.userId) throw new Error('userId requerido para audit trail');

  const cuentaRef = doc(db, COLLECTIONS.CUENTAS_CAJA, input.cuentaId);

  return await runTransaction(db, async (tx: Transaction) => {
    const snap = await tx.get(cuentaRef);
    if (!snap.exists()) {
      throw new Error(`Cuenta ${input.cuentaId} no encontrada`);
    }
    const cuenta = snap.data() as CuentaCaja;

    // Determinar saldo ERP en el momento de la verificación según moneda
    const saldoErp = pickSaldoErp(cuenta, input.moneda);
    const diferencia = roundTo2(input.saldoBancoReportado - saldoErp);

    const newSnapshot: VerificacionSaldoSnapshot = {
      fecha: Timestamp.now(),
      moneda: input.moneda,
      saldoErpEnEseMomento: roundTo2(saldoErp),
      saldoBancoReportado: roundTo2(input.saldoBancoReportado),
      diferencia,
      ...(input.notas?.trim() ? { notas: input.notas.trim() } : {}),
      verificadoPor: input.userId,
      ...(input.userNombre ? { verificadoPorNombre: input.userNombre } : {}),
    };

    // Historial: insertar al frente, cap a HISTORIAL_MAX
    const historialPrev = Array.isArray(cuenta.historialVerificaciones)
      ? cuenta.historialVerificaciones
      : [];
    const historialNuevo = [newSnapshot, ...historialPrev].slice(0, HISTORIAL_MAX);

    tx.update(cuentaRef, {
      ultimaVerificacion: newSnapshot,
      historialVerificaciones: historialNuevo,
      actualizadoPor: input.userId,
      fechaActualizacion: Timestamp.now(),
    });

    return {
      snapshot: newSnapshot,
      saldoErpEnEseMomento: roundTo2(saldoErp),
    };
  });
}

// ─── Helpers internos ───────────────────────────────────────────────

/**
 * Lee el saldo de la cuenta en la moneda dada · maneja mono y bi-moneda.
 */
function pickSaldoErp(cuenta: CuentaCaja, moneda: MonedaTesoreria): number {
  if (cuenta.esBiMoneda) {
    if (moneda === 'USD') return cuenta.saldoUSD ?? 0;
    if (moneda === 'PEN') return cuenta.saldoPEN ?? 0;
  }
  // Mono-moneda · solo saldoActual es válido (y debe coincidir con moneda)
  if (cuenta.moneda === moneda) return cuenta.saldoActual ?? 0;
  // Moneda no soportada en esta cuenta · 0 por defecto
  return 0;
}

function roundTo2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}
