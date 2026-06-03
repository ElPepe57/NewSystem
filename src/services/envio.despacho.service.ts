/**
 * envio.despacho.service — Última milla (Caso F · despacho de venta).
 *
 * Absorción de `Entrega` en `Envio` (Camino A · 2026-06-03). Este servicio porta
 * la lógica de última milla de `entrega.service` operando sobre `Envio` (Caso F)
 * en vez de sobre la colección `entregas`. Orquesta los servicios YA probados
 * (envioCrudService, gasto tipo 'delivery', VentaService.registrarPago, caja
 * recaudadora, métricas) — NO reescribe la lógica financiera de cero.
 *
 * Ciclo de reparto (estado del Envio):
 *   despacharVenta()        → 'programada'  (+ venta='en_entrega')        [A2.1]
 *   marcarEnCaminoEnvio()   → 'en_camino'   (+ gasto delivery, venta='despachada')  [A2.2]
 *   registrarEntregaEnvio() → 'entregada'|'fallida'|'reprogramada' (+ COD)          [A2.3]
 *
 * Ver docs/ENVIOS_ABSORCION_ENTREGA_PLAN.md
 */
import {
  collection, doc, updateDoc, getDoc, query, where, getDocs, writeBatch, Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { envioCrudService } from './envio.crud.service';
import { gastoService } from './gasto.service';
import type { Venta, MetodoPago } from '../types/venta.types';
import type { EstadoEnvio } from '../types/envio.types';

const ENVIOS_COLL = COLLECTIONS.ENVIOS;
const VENTAS_COLL = COLLECTIONS.VENTAS;

/** Estados de venta desde los que se puede DESPACHAR (Caso F). Igual que el wizard F. */
const ESTADOS_VENTA_DESPACHABLES: readonly string[] = [
  'confirmada', 'reservada', 'parcial', 'asignada', 'en_entrega',
];

export interface DespacharVentaPayload {
  /** La venta a despachar (ya cargada por la UI). */
  venta: Venta;
  /** Almacén Perú de origen. */
  almacenOrigenId: string;
  /** Unidades seleccionadas para esta entrega (picking · FEFO). */
  unidades: Array<{
    unidadId: string;
    productoId: string;
    sku: string;
    codigoUnidad: string;
    pesoLibras?: number;
  }>;
  /** Courier / repartidor (opcional al programar · se confirma al despachar). */
  colaboradorTransporteId?: string;
  /** Programación de la entrega. */
  fechaProgramada: Date;
  horaProgramada?: string;
  /** Cobro contra-entrega (COD). */
  cobroPendiente: boolean;
  montoPorCobrar?: number;
  metodoPagoEsperado?: MetodoPago;
  /** Flete del repartidor (PEN). El Gasto tipo 'delivery' se crea al despachar, no acá. */
  costoDeliveryPEN?: number;
  numeroTracking?: string;
  notas?: string;
}

export const envioDespachoService = {
  /**
   * A2.1 — Dispara un despacho de venta (Caso F) desde el detalle de la Venta.
   *
   * Crea un Envío en estado 'programada' (última milla) y sincroniza la venta a
   * 'en_entrega'. NO crea el gasto de delivery ni cobra (eso es marcarEnCaminoEnvio /
   * registrarEntregaEnvio). Replica entrega.service.programar() sobre Envio.
   *
   * Soporta entregas PARCIALES: cada llamada crea un despacho con su numeroEntrega
   * (cuenta los despachos F previos de la venta).
   */
  async despacharVenta(
    payload: DespacharVentaPayload,
    userId: string,
  ): Promise<{ envioId: string; numeroEnvio: string }> {
    const { venta, almacenOrigenId, unidades } = payload;

    // 1. Validar
    if (!ESTADOS_VENTA_DESPACHABLES.includes(venta.estado)) {
      throw new Error(`No se puede despachar una venta en estado "${venta.estado}".`);
    }
    if (unidades.length === 0) {
      throw new Error('Selecciona al menos una unidad para despachar.');
    }

    // 2. numeroEntrega — contar despachos F (destinoTipo='cliente') previos de la venta
    const previosSnap = await getDocs(query(
      collection(db, ENVIOS_COLL),
      where('ventaId', '==', venta.id),
      where('destinoTipo', '==', 'cliente'),
    ));
    const numeroEntrega = previosSnap.size + 1;

    // 3. Crear el Envío F base (nace en 'borrador'). El delivery NO va como costo
    //    landed (es Gasto tipo 'delivery') → costosPEN vacío.
    const { id: envioId, numeroEnvio } = await envioCrudService.crearEnvioF({
      almacenOrigenId,
      ventaId: venta.id,
      ventaNumero: venta.numeroVenta,
      cliente: {
        id: venta.clienteId,
        nombre: venta.nombreCliente,
        direccion: venta.direccionEntrega,
        distrito: venta.distrito,
        telefono: venta.telefonoCliente,
      },
      colaboradorTransporteId: payload.colaboradorTransporteId,
      numeroTracking: payload.numeroTracking,
      notas: payload.notas,
      unidades,
      costosPEN: [],
    }, userId);

    // 4. Transicionar 'borrador' → 'programada' + campos de reparto (última milla)
    const reparto: Record<string, unknown> = {
      estado: 'programada' as EstadoEnvio,
      numeroEntrega,
      cobroPendiente: payload.cobroPendiente,
      fechaLlegadaEstimada: Timestamp.fromDate(payload.fechaProgramada),
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    };
    if (payload.horaProgramada) reparto.horaProgramada = payload.horaProgramada;
    if (payload.montoPorCobrar !== undefined) reparto.montoPorCobrar = payload.montoPorCobrar;
    if (payload.metodoPagoEsperado) reparto.metodoPagoEsperado = payload.metodoPagoEsperado;
    if (payload.costoDeliveryPEN !== undefined) reparto.costoDeliveryPEN = payload.costoDeliveryPEN;
    await updateDoc(doc(db, ENVIOS_COLL, envioId), reparto);

    // 5. Sincronizar la venta → 'en_entrega' (patrón de entrega.service.programar)
    const ventaUpdate: Record<string, unknown> = {
      estado: 'en_entrega',
      editadoPor: userId,
      ultimaEdicion: Timestamp.now(),
    };
    if (venta.estado !== 'en_entrega') {
      ventaUpdate.fechaEnEntrega = Timestamp.now();
    }
    await updateDoc(doc(db, VENTAS_COLL, venta.id), ventaUpdate);

    logger.success(
      `[despacharVenta] Despacho ${numeroEnvio} programado · VT ${venta.numeroVenta} · ` +
      `entrega #${numeroEntrega} · ${unidades.length} uds${payload.cobroPendiente ? ' · COD' : ''}`,
    );

    return { envioId, numeroEnvio };
  },

  /**
   * A2.2 — Despacha un envío de venta (Caso F): 'programada'|'reprogramada' → 'en_camino'.
   *
   * Replica entrega.service.marcarEnCamino() sobre Envio:
   *   - batch atómico: envío → 'en_camino' (+fechaSalida) · venta → 'despachada'
   *     (solo si estaba en 'en_entrega').
   *   - crea el Gasto tipo 'delivery' (bloque venta · NO el GD legacy) reusando el
   *     servicio probado `gastoService.crearGastoDistribucion` (idempotente). El gasto
   *     se vincula a la venta (costeo) y al envío (trazabilidad · campo `entregaId`
   *     contiene el envioId hasta que se deprecan las entregas en A6).
   */
  async marcarEnCaminoEnvio(envioId: string, userId: string): Promise<void> {
    const envio = await envioCrudService.getById(envioId);
    if (!envio) throw new Error('Envío no encontrado');
    if (envio.destinoTipo !== 'cliente') {
      throw new Error('No es un despacho de venta (Caso F).');
    }
    if (envio.estado !== 'programada' && envio.estado !== 'reprogramada') {
      throw new Error(`No se puede despachar un envío en estado "${envio.estado}".`);
    }

    const batch = writeBatch(db);
    const envioRef = doc(db, ENVIOS_COLL, envioId);
    batch.update(envioRef, {
      estado: 'en_camino' as EstadoEnvio,
      fechaSalida: Timestamp.now(),
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });

    // Venta → 'despachada' (solo en el primer despacho · si estaba en 'en_entrega')
    if (envio.ventaId) {
      const ventaRef = doc(db, VENTAS_COLL, envio.ventaId);
      const ventaSnap = await getDoc(ventaRef);
      if (ventaSnap.exists() && (ventaSnap.data() as Venta).estado === 'en_entrega') {
        batch.update(ventaRef, {
          estado: 'despachada',
          fechaDespacho: Timestamp.now(),
          editadoPor: userId,
          ultimaEdicion: Timestamp.now(),
        });
      }
    }

    await batch.commit();

    // Gasto de delivery (tipo 'delivery' · momento unificado de registro del flete)
    if (!envio.gastoDeliveryId && envio.costoDeliveryPEN && envio.costoDeliveryPEN > 0 && envio.ventaId) {
      try {
        const gastoId = await gastoService.crearGastoDistribucion({
          entregaId: envioId,                                  // absorción: contiene el envioId
          entregaCodigo: envio.numeroEnvio,
          ventaId: envio.ventaId,
          ventaNumero: envio.ventaNumero ?? envio.numeroEnvio,
          transportistaId: envio.colaboradorId ?? '',
          transportistaNombre: envio.colaboradorNombre ?? 'Repartidor',
          costoEntrega: envio.costoDeliveryPEN,
          distrito: envio.destinoClienteDistrito,
        }, userId);
        await updateDoc(envioRef, { gastoDeliveryId: gastoId });
        logger.log(
          `[marcarEnCaminoEnvio ${envio.numeroEnvio}] Gasto delivery ${gastoId} · S/${envio.costoDeliveryPEN.toFixed(2)}`,
        );
      } catch (error) {
        logger.error(`[marcarEnCaminoEnvio ${envio.numeroEnvio}] Error creando gasto delivery:`, error);
      }
    }
  },
};
