/**
 * retiroCash.client · F3c · puente del cliente a la Cloud Function `registrarRetiroCashTesoreria`.
 *
 * El cash de un retiro de socio ya NO se escribe directo: lo mueve la CF (admin SDK · única escritora ·
 * valida la aprobación de socios server-side · las rules congelan el create de movimientosTesoreria
 * tipo:'retiro_socio'). El input es mínimo (solo retiroId) · la CF relee el doc retirosCapital y recomputa
 * todo fail-closed. Si la CF rechaza (no autorizado / saldo insuficiente / cancelado) LANZA → el cash no
 * se mueve. Idempotencia anclada en el retiroId. Ver docs/DEFENSA_EGRESOS_F3_CASH_LEDGER.md.
 */
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

export interface RetiroCashResult {
  movimientoId: string;
  saldoNuevo: number | null;
  idempotente?: boolean;
}

/** Mueve el cash de un retiro (ya creado en retirosCapital) vía la CF. Lanza si la CF rechaza. */
export async function registrarRetiroCashTesoreriaFn(retiroId: string): Promise<RetiroCashResult> {
  const fn = httpsCallable<{ retiroId: string }, RetiroCashResult>(functions, 'registrarRetiroCashTesoreria');
  const { data } = await fn({ retiroId });
  return data;
}
