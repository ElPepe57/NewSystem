/**
 * egresoCash.client · F3 · puente del cliente a la Cloud Function `registrarEgresoCash`.
 *
 * El cash de un egreso REFERENCIADO (pago de gasto/OC) ya NO se escribe directo: se delega a la CF
 * (admin SDK · única escritora · valida la aprobación server-side · las rules congelan el create directo).
 * Si la CF rechaza (egreso no autorizado / monto excede / cancelado) LANZA → el pago NO se registra
 * (atómico-con-autorización · ya no se marca errorTesoreria y se sigue, que dejaría plata sin aprobar).
 *
 * Idempotencia: la key se deriva de la identidad lógica del pago → un reintento (misma data) reusa la key
 * y la CF devuelve el mismo movimiento sin doble desembolso. Ver docs/DEFENSA_EGRESOS_F3_CASH_LEDGER.md.
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import { COLLECTIONS } from '../config/collections';
import type { ResultadoAutorizacionCF } from './autorizacionEgreso.helper';

const functions = getFunctions();

/**
 * F3c · firma de socio sobre el flete de un envío >$1k (bandeja). La CF autorizarEgreso aplica el quórum
 * por equity sobre la colección envios (autorizacion en el doc · como gasto/OC). A diferencia del retiro,
 * el envío NO mueve cash al aprobarse: el flete se paga aparte (envio.pagos · gateado por registrarEgresoCash).
 */
export async function autorizarEnvioFlete(envioId: string): Promise<ResultadoAutorizacionCF> {
  const fn = httpsCallable<{ coleccion: string; docId: string }, ResultadoAutorizacionCF>(functions, 'autorizarEgreso');
  const { data } = await fn({ coleccion: COLLECTIONS.ENVIOS, docId: envioId });
  return data;
}

/** F3c · rechazo de socio sobre el flete de un envío · la CF deja autorizacion.estado='rechazado'. */
export async function rechazarEnvioFlete(envioId: string, motivo?: string): Promise<void> {
  const fn = httpsCallable<{ coleccion: string; docId: string; motivo?: string }, { ok: true }>(functions, 'rechazarEgreso');
  await fn({ coleccion: COLLECTIONS.ENVIOS, docId: envioId, motivo });
}

export interface EgresoCashInput {
  refDocumentoTipo: 'oc' | 'gasto' | 'envio';
  refDocumentoId: string;
  refDocumentoNumero?: string;
  categoria: string;
  productoOrigenId: string;
  moneda: 'USD' | 'PEN';
  monto: number;
  tipoCambio: number;
  concepto: string;
  fecha: Date;
  metodo?: string;
  referencia?: string;
  lineaNegocioId?: string;
  notas?: string;
}

export interface EgresoCashResult {
  movimientoId: string;
  saldoNuevo: number | null;
  idempotente?: boolean;
}

/** Registra el cash de un egreso referenciado vía la CF. Lanza si la CF rechaza (bloquea el pago). */
export async function registrarEgresoCashFn(input: EgresoCashInput): Promise<EgresoCashResult> {
  // Identidad lógica del pago · incluye método/moneda/TC para que una EDICIÓN (CASO C · anula viejo +
  // crea nuevo) que cambie solo el método no colisione con el movimiento original. Retry exacto = misma key.
  const idempotencyKey = [
    input.refDocumentoTipo,
    input.refDocumentoId,
    Math.round(input.monto * 100),
    input.moneda,
    Math.round(input.tipoCambio * 10000),
    input.fecha.getTime(),
    input.productoOrigenId,
    input.metodo || '',
  ].join('-');

  const fn = httpsCallable<Record<string, unknown>, EgresoCashResult>(functions, 'registrarEgresoCash');
  const { data } = await fn({
    refDocumentoTipo: input.refDocumentoTipo,
    refDocumentoId: input.refDocumentoId,
    refDocumentoNumero: input.refDocumentoNumero,
    categoria: input.categoria,
    productoOrigenId: input.productoOrigenId,
    moneda: input.moneda,
    monto: input.monto,
    tipoCambio: input.tipoCambio,
    concepto: input.concepto,
    fechaMs: input.fecha.getTime(),
    metodo: input.metodo,
    referencia: input.referencia,
    lineaNegocioId: input.lineaNegocioId,
    notas: input.notas,
    idempotencyKey,
  });
  return data;
}

export interface EgresoCashLoteInput {
  categoria: string;
  productoOrigenId: string;
  moneda: 'USD' | 'PEN';
  monto: number;
  tipoCambio: number;
  concepto: string;
  fecha: Date;
  metodo?: string;
  referencia?: string;
  notas?: string;
  refs: { tipo: 'oc' | 'gasto' | 'envio'; id: string; montoAplicadoUSD: number }[];
}

/** F3 · registra el cash de un pago MASIVO (lote · cubre N egresos) vía la CF · valida cada ref aprobado. */
export async function registrarEgresoCashLoteFn(input: EgresoCashLoteInput): Promise<EgresoCashResult> {
  const idempotencyKey = [
    'lote',
    input.categoria,
    Math.round(input.monto * 100),
    input.moneda,
    input.fecha.getTime(),
    input.productoOrigenId,
    input.refs.map((r) => `${r.tipo}:${r.id}`).join('|'),
  ].join('-');

  const fn = httpsCallable<Record<string, unknown>, EgresoCashResult>(functions, 'registrarEgresoCashLote');
  const { data } = await fn({
    categoria: input.categoria,
    productoOrigenId: input.productoOrigenId,
    moneda: input.moneda,
    monto: input.monto,
    tipoCambio: input.tipoCambio,
    concepto: input.concepto,
    fechaMs: input.fecha.getTime(),
    metodo: input.metodo,
    referencia: input.referencia,
    notas: input.notas,
    idempotencyKey,
    refs: input.refs,
  });
  return data;
}
