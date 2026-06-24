/**
 * movimientoCash.client · F3.5 Fase A · puente del cliente a la Cloud Function `registrarMovimientoCash`.
 *
 * El cash del libro canónico (movimiento + saldo de productosFinancieros) ya NO se escribe directo: lo mueve
 * la CF (admin SDK · única escritora del saldo · regla saldoIntacto congela el saldo para el cliente). Cubre
 * ingresos/conversiones/transferencias/egresos sin-ref. Lanza si la CF rechaza.
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { MovimientoFinancieroFormData } from '../types/movimientoFinanciero.types';

const functions = getFunctions();

interface MovimientoCashResult {
  movimientoId: string;
  idempotente?: boolean;
}

/** Registra un movimiento de cash (ejecutado · con saldo) vía la CF. Devuelve el id del movimiento. */
export async function registrarMovimientoCashFn(data: MovimientoFinancieroFormData): Promise<string> {
  const payload: Record<string, unknown> = {
    categoria: data.categoria,
    moneda: data.moneda,
    monto: data.monto,
    tipoCambio: data.tipoCambio,
    concepto: data.concepto,
    fechaMs: data.fecha.getTime(),
  };
  // opcionales · solo si están presentes (la CF los omite si faltan)
  if (data.productoOrigenId) payload.productoOrigenId = data.productoOrigenId;
  if (data.productoDestinoId) payload.productoDestinoId = data.productoDestinoId;
  if (data.lineaNegocioId) payload.lineaNegocioId = data.lineaNegocioId;
  if (data.metodo) payload.metodo = data.metodo;
  if (data.referencia) payload.referencia = data.referencia;
  if (data.canalUtilizado) payload.canalUtilizado = data.canalUtilizado;
  if (data.refDocumentoTipo) payload.refDocumentoTipo = data.refDocumentoTipo;
  if (data.refDocumentoId) payload.refDocumentoId = data.refDocumentoId;
  if (data.refDocumentoNumero) payload.refDocumentoNumero = data.refDocumentoNumero;
  if (data.loteId) payload.loteId = data.loteId;
  if (data.loteNumero) payload.loteNumero = data.loteNumero;
  if (data.notas) payload.notas = data.notas;
  if (data.urlComprobante) payload.urlComprobante = data.urlComprobante;
  if (data.idempotencyKey) payload.idempotencyKey = data.idempotencyKey;

  const fn = httpsCallable<Record<string, unknown>, MovimientoCashResult>(functions, 'registrarMovimientoCash');
  const { data: res } = await fn(payload);
  return res.movimientoId;
}
