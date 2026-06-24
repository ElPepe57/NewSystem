/**
 * movimientoTesoreriaCash.client · F3.5 Fase B · puente a la CF `registrarMovimientoTesoreriaCash`.
 *
 * El cash del libro legacy de tesorería (movimiento + saldo de cuentasCaja) ya NO se escribe directo: lo
 * mueve la CF (admin SDK · única escritora del saldo · regla saldoIntactoCaja). El poolUSD + estadísticas +
 * actividad siguen client-side (otro sub-ledger / fire-and-forget · no tocan el saldo de cuentasCaja).
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { MovimientoTesoreriaFormData } from '../types/tesoreria.types';

const functions = getFunctions();

export interface TesoreriaCashResult {
  movimientoId: string;
  numeroMovimiento: string;
  idempotente?: boolean;
}

/** Registra el cash de un movimiento de tesorería vía la CF. Devuelve id + número. Lanza si rechaza. */
export async function registrarMovimientoTesoreriaCashFn(
  data: MovimientoTesoreriaFormData,
  idempotencyKey?: string,
): Promise<TesoreriaCashResult> {
  const payload: Record<string, unknown> = {
    tipo: data.tipo,
    moneda: data.moneda,
    monto: data.monto,
    tipoCambio: data.tipoCambio,
    metodo: data.metodo,
    concepto: data.concepto,
    fechaMs: data.fecha.getTime(),
  };
  if (data.cuentaOrigen) payload.cuentaOrigen = data.cuentaOrigen;
  if (data.cuentaDestino) payload.cuentaDestino = data.cuentaDestino;
  if (data.referencia) payload.referencia = data.referencia;
  if (data.notas) payload.notas = data.notas;
  if (data.ordenCompraId) payload.ordenCompraId = data.ordenCompraId;
  if (data.ordenCompraNumero) payload.ordenCompraNumero = data.ordenCompraNumero;
  if (data.ventaId) payload.ventaId = data.ventaId;
  if (data.ventaNumero) payload.ventaNumero = data.ventaNumero;
  if (data.gastoId) payload.gastoId = data.gastoId;
  if (data.gastoNumero) payload.gastoNumero = data.gastoNumero;
  if (data.cotizacionId) payload.cotizacionId = data.cotizacionId;
  if (data.cotizacionNumero) payload.cotizacionNumero = data.cotizacionNumero;
  if (data.transferenciaId) payload.transferenciaId = data.transferenciaId;
  if (data.transferenciaNumero) payload.transferenciaNumero = data.transferenciaNumero;
  if (idempotencyKey) payload.idempotencyKey = idempotencyKey;

  const fn = httpsCallable<Record<string, unknown>, TesoreriaCashResult>(functions, 'registrarMovimientoTesoreriaCash');
  const { data: res } = await fn(payload);
  return res;
}

/** F3.5 · elimina un movimiento de tesorería vía la CF (revierte saldo + archiva + borra). Lanza si rechaza. */
export async function eliminarMovimientoTesoreriaCashFn(movimientoId: string): Promise<void> {
  const fn = httpsCallable<{ movimientoId: string }, { eliminado: boolean }>(functions, 'eliminarMovimientoTesoreriaCash');
  await fn({ movimientoId });
}
