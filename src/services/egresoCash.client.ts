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

const functions = getFunctions();

export interface EgresoCashInput {
  refDocumentoTipo: 'oc' | 'gasto';
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
  const idempotencyKey = [
    input.refDocumentoTipo,
    input.refDocumentoId,
    Math.round(input.monto * 100),
    input.fecha.getTime(),
    input.productoOrigenId,
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
