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
import { COLLECTIONS } from '../config/collections';
import type { ResultadoAutorizacionCF } from './autorizacionEgreso.helper';

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

/**
 * F3c · firma de socio sobre un retiro >$1k (bandeja). La CF autorizarEgreso aplica el quórum por equity
 * (misma colección retirosCapital · ya soportada). Al COMPLETARSE el quórum, encadena el desembolso vía la
 * CF de cash (idempotente + re-gateada) — el retiro ES el pago, así que el cash se mueve al aprobarse.
 * Si el cash falla (ej. saldo insuficiente al ejecutar), la aprobación ya quedó registrada y el error se
 * propaga con contexto (el desembolso es reintentable · la CF de cash es idempotente).
 */
export async function autorizarRetiroCapital(retiroId: string): Promise<ResultadoAutorizacionCF> {
  const fn = httpsCallable<{ coleccion: string; docId: string }, ResultadoAutorizacionCF>(functions, 'autorizarEgreso');
  const { data } = await fn({ coleccion: COLLECTIONS.RETIROS_CAPITAL, docId: retiroId });
  if (data.completa) {
    try {
      await registrarRetiroCashTesoreriaFn(retiroId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // La aprobación ya quedó registrada · el trigger onRetiroCapitalEjecutable reintenta el desembolso
      // automáticamente (failurePolicy) cuando se resuelva la causa (ej. saldo) · no queda estancado.
      throw new Error(`El retiro fue aprobado pero el desembolso no se pudo completar ahora: ${msg}. Se reintentará automáticamente.`);
    }
  }
  return data;
}

/** F3c · rechazo de socio sobre un retiro >$1k · la CF deja autorizacion.estado='rechazado' (no ejecutable). */
export async function rechazarRetiroCapital(retiroId: string, motivo?: string): Promise<void> {
  const fn = httpsCallable<{ coleccion: string; docId: string; motivo?: string }, { ok: true }>(functions, 'rechazarEgreso');
  await fn({ coleccion: COLLECTIONS.RETIROS_CAPITAL, docId: retiroId, motivo });
}
