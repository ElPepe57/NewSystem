/**
 * pagoMasivo.service.ts
 *
 * Orquestador de pagos masivos (TAREA-101).
 * Ejecuta N pagos secuencialmente reutilizando los servicios existentes.
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import { gastoService } from './gasto.service';
import { registrarPago as registrarPagoOC } from './ordenCompra.pagos.service';
import { registrarPago as registrarPagoVenta } from './venta.pagos.service';
import type { TipoPendiente } from '../types/tesoreria.types';
import type { MetodoPagoUnificado } from '../types/pago.types';
import type {
  LotePago,
  ResultadoItemLote,
  ItemSeleccionado,
  ConfigPagoMasivo,
  ProgresoLote,
} from '../types/pagoMasivo.types';

type OnProgreso = (progreso: ProgresoLote) => void;

/**
 * Ejecuta un lote de pagos secuencialmente.
 * Cada pago es independiente: si uno falla, los demás continúan.
 */
export async function ejecutarLote(
  tipo: 'egreso' | 'ingreso',
  items: ItemSeleccionado[],
  config: ConfigPagoMasivo,
  userId: string,
  onProgreso?: OnProgreso
): Promise<LotePago> {
  const inicio = Date.now();

  // Generar ID del lote
  const year = new Date().getFullYear();
  const loteNumero = await getNextSequenceNumber(`LOTE-${year}`, 3);
  const loteId = `LOTE-${year}-${loteNumero}`;

  const resultados: ResultadoItemLote[] = items.map((item) => ({
    documentoId: item.documentoId,
    tipoDocumento: item.tipoDocumento,
    numeroDocumento: item.numeroDocumento,
    contraparteNombre: item.contraparteNombre,
    montoPagado: item.montoPagar,
    monedaDocumento: item.monedaDocumento,
    estado: 'pendiente' as const,
  }));

  const progreso: ProgresoLote = {
    total: items.length,
    procesados: 0,
    exitosos: 0,
    errores: 0,
    ejecutando: true,
    resultados,
  };

  onProgreso?.(structuredClone(progreso));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    resultados[i].estado = 'procesando';
    progreso.itemActual = item.numeroDocumento;
    onProgreso?.(structuredClone(progreso));

    try {
      const pagoId = await ejecutarPagoIndividual(
        item,
        config,
        loteId,
        userId
      );
      resultados[i].estado = 'exitoso';
      resultados[i].pagoId = pagoId;
      progreso.exitosos++;
    } catch (error: any) {
      resultados[i].estado = 'error';
      resultados[i].error = error?.message || 'Error desconocido';
      progreso.errores++;
      logger.error(`[PagoMasivo] Error en ${item.numeroDocumento}:`, error);
    }

    progreso.procesados++;
    onProgreso?.(structuredClone(progreso));
  }

  progreso.ejecutando = false;
  progreso.itemActual = undefined;
  onProgreso?.(structuredClone(progreso));

  // Calcular totales de items exitosos
  let montoTotalPagado = 0;
  let montoTotalPEN = 0;
  let montoTotalUSD = 0;

  for (let i = 0; i < items.length; i++) {
    if (resultados[i].estado === 'exitoso') {
      const monto = items[i].montoPagar;
      montoTotalPagado += monto;
      if (items[i].monedaDocumento === 'PEN') {
        montoTotalPEN += monto;
        montoTotalUSD += monto / config.tipoCambio;
      } else {
        montoTotalUSD += monto;
        montoTotalPEN += monto * config.tipoCambio;
      }
    }
  }

  // Guardar lote en Firestore
  const lote: LotePago = {
    id: loteId,
    tipo,
    fecha: Timestamp.now(),
    monedaPago: config.monedaPago,
    tipoCambio: config.tipoCambio,
    metodoPago: config.metodoPago,
    cuentaId: config.cuentaId,
    cuentaNombre: config.cuentaNombre,
    referencia: config.referencia || undefined,
    notas: config.notas || undefined,
    items: resultados,
    totalItems: items.length,
    itemsExitosos: progreso.exitosos,
    itemsConError: progreso.errores,
    montoTotalPagado,
    montoTotalPEN,
    montoTotalUSD,
    ejecutadoPor: userId,
    fechaEjecucion: Timestamp.now(),
    duracionMs: Date.now() - inicio,
  };

  try {
    const ref = doc(db, COLLECTIONS.LOTES_PAGOS, loteId);
    await setDoc(ref, lote);
  } catch (error) {
    logger.error('[PagoMasivo] Error al guardar lote en Firestore:', error);
  }

  return lote;
}

/**
 * Ejecuta un pago individual según el tipo de documento.
 * Retorna el ID del pago creado.
 */
async function ejecutarPagoIndividual(
  item: ItemSeleccionado,
  config: ConfigPagoMasivo,
  loteId: string,
  userId: string
): Promise<string> {
  const fechaPago = new Date(config.fechaPago);

  switch (item.tipoDocumento) {
    case 'gasto_por_pagar':
      await gastoService.registrarPago(
        item.documentoId,
        {
          fechaPago,
          monedaPago: config.monedaPago,
          montoPago: item.montoPagar,
          tipoCambio: config.tipoCambio,
          metodoPago: config.metodoPago as any,
          cuentaOrigenId: config.cuentaId,
          referenciaPago: config.referencia || undefined,
          notas: config.notas || undefined,
        },
        userId
      );
      return `PAG-GAS-lote-${loteId}`;

    case 'orden_compra_por_pagar': {
      const pago = await registrarPagoOC(
        item.documentoId,
        {
          fechaPago,
          monedaPago: config.monedaPago,
          montoOriginal: item.montoPagar,
          tipoCambio: config.tipoCambio,
          metodoPago: config.metodoPago as any,
          cuentaOrigenId: config.cuentaId,
          referencia: config.referencia || undefined,
          notas: config.notas || undefined,
        },
        userId
      );
      return pago.id;
    }

    case 'venta_por_cobrar': {
      const pago = await registrarPagoVenta(
        item.documentoId,
        {
          monto: item.montoPagar,
          metodoPago: config.metodoPago as any,
          tipoCambio: config.tipoCambio,
          referencia: config.referencia || undefined,
          notas: config.notas || undefined,
          cuentaDestinoId: config.cuentaId,
        },
        userId
      );
      return pago.id;
    }

    default:
      throw new Error(`Tipo de documento no soportado: ${item.tipoDocumento}`);
  }
}

/**
 * Obtiene el historial de lotes de pago.
 */
export async function getHistorialLotes(maxResults: number = 50): Promise<LotePago[]> {
  const ref = collection(db, COLLECTIONS.LOTES_PAGOS);
  const q = query(ref, orderBy('fechaEjecucion', 'desc'), limit(maxResults));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as LotePago);
}
