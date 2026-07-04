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
  collection, doc, updateDoc, getDoc, query, where, getDocs, writeBatch, arrayUnion, Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { envioCrudService } from './envio.crud.service';
import { gastoService } from './gasto.service';
import { unidadService } from './unidad.service';
import { colaboradorService } from './colaborador.service';
import { auditoriaService } from './auditoria.service';
import { inventarioService } from './inventario.service';
import { tesoreriaService } from './tesoreria.service';
import type { Venta, EstadoVenta, MetodoPago } from '../types/venta.types';
import type { Unidad, MovimientoUnidad } from '../types/unidad.types';
import type { EstadoEnvio, MotivoFallo, Envio } from '../types/envio.types';
import type { TipoCanalRecaudacion } from '../types/productoFinanciero.types';

/**
 * Mapea el método de pago del cobro contra-entrega (COD) al canal de recaudación
 * de una caja recaudadora. Solo los canales que se pueden mapear 1:1 con certeza
 * (efectivo/transferencia/yape/plin) generan el evento en la recaudadora; para el
 * resto (tarjeta/POS ambiguo, wallets internacionales) se retorna null y se OMITE
 * el evento — el cobro a la Venta + tesorería ya quedó registrado por registrarPago.
 */
function mapMetodoToCanalCobro(metodo?: MetodoPago): TipoCanalRecaudacion | null {
  switch (metodo) {
    case 'efectivo': return 'efectivo';
    case 'transferencia': return 'transferencia';
    case 'yape': return 'yape';
    case 'plin': return 'plin';
    default: return null;
  }
}

const ENVIOS_COLL = COLLECTIONS.ENVIOS;
const VENTAS_COLL = COLLECTIONS.VENTAS;

/** Estados de venta desde los que se puede DESPACHAR (Caso F). Igual que el wizard F. */
const ESTADOS_VENTA_DESPACHABLES: readonly string[] = [
  'confirmada', 'reservada', 'parcial', 'asignada', 'en_entrega',
];

/**
 * Calcula qué estado debería tener la venta tras este despacho (sin escribir).
 * Porta entrega.service.calcularEstadoVentaPostEntrega contando los DESPACHOS F
 * (envíos destinoTipo='cliente' estado='entregada') de la venta en vez de entregas.
 */
async function calcularEstadoVentaPostDespacho(
  ventaId: string,
  itemsDespachoActual: number,
  envioIdActual: string,
): Promise<{ nuevoEstado: EstadoVenta | null }> {
  try {
    const ventaSnap = await getDoc(doc(db, VENTAS_COLL, ventaId));
    if (!ventaSnap.exists()) return { nuevoEstado: null };
    const venta = ventaSnap.data() as Venta;
    const totalProductos = venta.productos.reduce((s, p) => s + p.cantidad, 0);
    if (totalProductos === 0) return { nuevoEstado: null }; // EDGE-001: venta sin productos

    const previosSnap = await getDocs(query(
      collection(db, ENVIOS_COLL),
      where('ventaId', '==', ventaId),
      where('destinoTipo', '==', 'cliente'),
    ));
    let entregados = 0;
    previosSnap.forEach((d) => {
      if (d.id === envioIdActual) return; // excluir el despacho actual (evita doble conteo en reintentos · BUG-001)
      const e = d.data() as Envio;
      if (e.estado === 'entregada') entregados += e.totalUnidades || 0;
    });
    entregados += itemsDespachoActual;

    let nuevoEstado: EstadoVenta | null = null;
    if (entregados >= totalProductos) nuevoEstado = 'entregada';
    else if (entregados > 0 && venta.estado !== 'despachada') nuevoEstado = 'despachada';

    return { nuevoEstado: (nuevoEstado && nuevoEstado !== venta.estado) ? nuevoEstado : null };
  } catch (error) {
    logger.error(`[calcularEstadoVentaPostDespacho] venta ${ventaId}:`, error);
    return { nuevoEstado: null };
  }
}

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

  /**
   * A2.3a — Marca un despacho de venta como FALLIDO o REPROGRAMADO (NO cobra · sin dinero).
   *
   * Porta la rama `exitosa=false` de entrega.service.registrarResultado sobre Envio:
   *   - estado → 'fallida' | 'reprogramada' (+ motivoFallo).
   *   - si NO se reprograma: anula el gasto delivery + libera las unidades (vuelven a stock).
   *   - actualiza métricas del transportista (fallo · sin cobro).
   *
   * La rama EXITOSA (entrega + cobro COD → venta/tesorería/caja recaudadora + métricas +
   * anticipos + CTRU) es A2.3b — se porta con foco y revisión contable (toca dinero real).
   */
  async marcarEntregaFallida(
    envioId: string,
    payload: {
      motivoFallo: MotivoFallo;
      descripcionFallo?: string;
      reprogramar?: boolean;
      nuevaFechaProgramada?: Date;
      notasEntrega?: string;
    },
    userId: string,
  ): Promise<void> {
    const envio = await envioCrudService.getById(envioId);
    if (!envio) throw new Error('Envío no encontrado');
    if (envio.destinoTipo !== 'cliente') {
      throw new Error('No es un despacho de venta (Caso F).');
    }
    if (!['programada', 'en_camino', 'reprogramada'].includes(envio.estado)) {
      throw new Error(`No se puede marcar como fallida un envío en estado "${envio.estado}".`);
    }

    const nuevoEstado: EstadoEnvio = payload.reprogramar ? 'reprogramada' : 'fallida';
    const update: Record<string, unknown> = {
      estado: nuevoEstado,
      motivoFallo: payload.motivoFallo,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    };
    if (payload.descripcionFallo) update.descripcionFallo = payload.descripcionFallo;
    if (payload.notasEntrega) update.notasEntregaDetalles = payload.notasEntrega;
    if (payload.reprogramar && payload.nuevaFechaProgramada) {
      update.fechaLlegadaEstimada = Timestamp.fromDate(payload.nuevaFechaProgramada);
    }
    await updateDoc(doc(db, ENVIOS_COLL, envioId), update);

    // Si NO se reprograma: anular gasto delivery + liberar unidades (vuelven a stock)
    if (!payload.reprogramar) {
      if (envio.gastoDeliveryId) {
        try {
          await gastoService.delete(envio.gastoDeliveryId);
          await updateDoc(doc(db, ENVIOS_COLL, envioId), { gastoDeliveryId: null });
        } catch (error) {
          logger.error(`[marcarEntregaFallida ${envio.numeroEnvio}] Error anulando gasto delivery:`, error);
        }
      }
      const unidadIds = envio.unidades.map((u) => u.unidadId);
      if (unidadIds.length > 0) {
        try {
          const r = await unidadService.liberarUnidades(
            unidadIds, `Entrega fallida: ${payload.motivoFallo}`, userId,
          );
          logger.log(`[marcarEntregaFallida ${envio.numeroEnvio}] Unidades liberadas: ${r.exitos}/${unidadIds.length}`);
        } catch (error) {
          logger.error(`[marcarEntregaFallida ${envio.numeroEnvio}] Error liberando unidades:`, error);
        }
      }
    }

    // Métricas del transportista (fallo · sin tiempo ni cobro)
    if (envio.colaboradorId) {
      try {
        await colaboradorService.registrarEntrega(envio.colaboradorId, false, 0, 0, envio.destinoClienteDistrito);
      } catch (error) {
        logger.error(`[marcarEntregaFallida ${envio.numeroEnvio}] Error métricas transportista:`, error);
      }
    }

    // TODO (A2.3b/A6): movimientoTransportistaService.registrarEntregaFallida espera un objeto
    // `Entrega` · se adapta a Envio cuando se porte el cobro/movimiento transportista (es solo
    // historial sin costo · no bloquea la operación de fallo).

    logger.log(`[marcarEntregaFallida ${envio.numeroEnvio}] → ${nuevoEstado} · ${payload.motivoFallo}`);
  },

  /**
   * A2.3b — Registra la ENTREGA EXITOSA de un despacho de venta (Caso F). EL DINERO REAL.
   *
   * Porta la rama `exitosa=true` de entrega.service.registrarResultado sobre Envio:
   *   FASE A (batch atómico · todo o nada): envío → 'entregada' · unidades → 'vendida'
   *     (con movimiento) · venta → 'entregada'|'despachada'.
   *   FASE B (secundarias · try/catch individual · si una falla, el core ya está commiteado):
   *     auditoría, sync stock, ML, métricas transportista, COBRO COD (registrarPago → venta +
   *     tesorería), reclasificar anticipos, CTRU.
   *
   * Reusa los servicios YA probados (VentaService.registrarPago, tesoreriaService, etc.).
   *
   * ⚠️ DEUDA DECLARADA (no atajo · ver plan A6):
   *   - movimientoTransportistaService.registrarEntregaExitosa espera un objeto Entrega → TODO.
   *   - cable cajaRecaudadora.registrarCobroEntrante (si el COD lo recauda un courier-recaudador)
   *     → TODO (requiere detectar tipoProducto de la cuenta + mapear canal). El cobro a la Venta
   *     + tesorería SÍ se registra (registrarPago).
   *   - _secondaryErrors solo se loguean (no se persisten · Envio no tiene ese campo de recovery).
   */
  async registrarEntregaExitosa(
    envioId: string,
    data: {
      fechaEntrega?: Date;
      fotoEntrega?: string;
      firmaCliente?: string;
      cobroRealizado?: boolean;
      montoRecaudado?: number;
      metodoPagoRecibido?: MetodoPago;
      cuentaDestinoId?: string;
      notasEntrega?: string;
    },
    userId: string,
  ): Promise<{ secondaryErrors: string[] }> {
    const envio = await envioCrudService.getById(envioId);
    if (!envio) throw new Error('Envío no encontrado');
    if (envio.destinoTipo !== 'cliente') throw new Error('No es un despacho de venta (Caso F).');
    if (!['programada', 'en_camino'].includes(envio.estado)) {
      throw new Error(`No se puede entregar un envío en estado "${envio.estado}".`);
    }
    if (!envio.ventaId) throw new Error('El despacho no está vinculado a una venta.');

    const now = Timestamp.now();
    const envioRef = doc(db, ENVIOS_COLL, envioId);

    // Cargar la venta (precios por producto + datos para anticipos)
    const ventaSnap = await getDoc(doc(db, VENTAS_COLL, envio.ventaId));
    if (!ventaSnap.exists()) throw new Error('Venta no encontrada');
    const venta = ventaSnap.data() as Venta;
    const precioPorProducto = new Map<string, number>();
    venta.productos.forEach((p) => precioPorProducto.set(p.productoId, p.precioUnitario || 0));

    // Tiempo de entrega
    const fechaSalida = envio.fechaSalida ?? now;
    const llegadaMs = data.fechaEntrega ? data.fechaEntrega.getTime() : Date.now();
    const minutos = Math.round((llegadaMs - fechaSalida.toMillis()) / 60000);
    const tiempoEntregaMinutos = minutos > 0 ? minutos : undefined;

    // Pre-lectura de unidades
    const unidadIds = envio.unidades.map((u) => u.unidadId);
    const unidadesMap = new Map<string, Unidad>();
    const productosAfectados = new Set<string>();
    for (const uid of unidadIds) {
      const u = await unidadService.getById(uid);
      if (u) { unidadesMap.set(uid, u); productosAfectados.add(u.productoId); }
    }

    const estadoVentaPost = await calcularEstadoVentaPostDespacho(envio.ventaId, unidadIds.length, envioId);

    // ─────── FASE A · batch atómico ───────
    const batch = writeBatch(db);
    const envioUpdate: Record<string, unknown> = {
      estado: 'entregada' as EstadoEnvio,
      fechaLlegadaReal: data.fechaEntrega ? Timestamp.fromDate(data.fechaEntrega) : now,
      actualizadoPor: userId,
      fechaActualizacion: now,
    };
    if (!envio.fechaSalida) envioUpdate.fechaSalida = envioUpdate.fechaLlegadaReal;
    if (tiempoEntregaMinutos !== undefined) envioUpdate.tiempoEntregaMinutos = tiempoEntregaMinutos;
    if (data.fotoEntrega !== undefined) envioUpdate.fotoEntrega = data.fotoEntrega;
    if (data.firmaCliente !== undefined) envioUpdate.firmaCliente = data.firmaCliente;
    if (data.cobroRealizado !== undefined) envioUpdate.cobroRealizado = data.cobroRealizado;
    if (data.montoRecaudado !== undefined) envioUpdate.montoRecaudado = data.montoRecaudado;
    if (data.metodoPagoRecibido !== undefined) envioUpdate.metodoPagoRecibido = data.metodoPagoRecibido;
    if (data.notasEntrega !== undefined) envioUpdate.notasEntregaDetalles = data.notasEntrega;
    batch.update(envioRef, envioUpdate);

    // Unidades → 'vendida' (con movimiento)
    const precioFallback = unidadIds.length > 0 ? (venta.subtotalPEN || 0) / unidadIds.length : 0; // BUG-002: subtotal, no total
    for (const uid of unidadIds) {
      const u = unidadesMap.get(uid);
      if (!u) continue;
      const precio = precioPorProducto.get(u.productoId) ?? precioFallback;
      const mov: MovimientoUnidad = {
        id: crypto.randomUUID(),
        tipo: 'venta',
        fecha: now,
        almacenOrigen: u.almacenId,
        usuarioId: userId,
        observaciones: `Venta registrada: ${venta.numeroVenta}`,
        documentoRelacionado: { tipo: 'venta', id: envio.ventaId, numero: venta.numeroVenta },
      };
      batch.update(doc(db, COLLECTIONS.UNIDADES, uid), {
        estado: 'vendida',
        ventaId: envio.ventaId,
        ventaNumero: venta.numeroVenta,
        fechaVenta: now,
        precioVentaPEN: precio,
        movimientos: arrayUnion(mov),
        actualizadoPor: userId,
        fechaActualizacion: now,
      });
    }

    // Venta → estado post
    if (estadoVentaPost.nuevoEstado) {
      const vu: Record<string, unknown> = {
        estado: estadoVentaPost.nuevoEstado, editadoPor: userId, ultimaEdicion: now,
      };
      if (estadoVentaPost.nuevoEstado === 'entregada') {
        vu.fechaEntrega = data.fechaEntrega ? Timestamp.fromDate(data.fechaEntrega) : now;
      }
      batch.update(doc(db, VENTAS_COLL, envio.ventaId), vu);
    }

    await batch.commit();
    logger.log(
      `[registrarEntregaExitosa ${envio.numeroEnvio}] Batch: entrega + ${unidadesMap.size} uds` +
      `${estadoVentaPost.nuevoEstado ? ` + venta → ${estadoVentaPost.nuevoEstado}` : ''}`,
    );

    // ─────── FASE B · secundarias (try/catch individual) ───────
    const secondaryErrors: string[] = [];

    for (const uid of unidadIds) {
      const u = unidadesMap.get(uid);
      if (!u) continue;
      try {
        await auditoriaService.logInventario(u.productoId, u.productoNombre, 'salida_inventario', 1, u.almacenNombre);
      } catch (e) { secondaryErrors.push(`auditoria_${uid}: ${e}`); }
    }
    for (const pid of productosAfectados) {
      try { await inventarioService.sincronizarStockProducto(pid); }
      catch (e) { secondaryErrors.push(`sync_stock_${pid}: ${e}`); }
    }
    // ML sync (fire-and-forget)
    import('./mercadoLibre.service').then(({ mercadoLibreService }) => {
      for (const pid of productosAfectados) {
        mercadoLibreService.syncStock(pid).catch((e) => logger.error(`[ML Sync] post-entrega ${pid}:`, e));
      }
    }).catch(() => {});

    // Métricas del transportista (éxito)
    if (envio.colaboradorId) {
      try {
        await colaboradorService.registrarEntrega(
          envio.colaboradorId, true, tiempoEntregaMinutos || 0, envio.costoDeliveryPEN || 0, envio.destinoClienteDistrito,
        );
      } catch (e) { secondaryErrors.push(`metricas_transportista: ${e}`); }
    }

    // COBRO COD → registrarPago en la venta (+ tesorería). Guarda anti-doble-cobro (BUG-003).
    if (data.cobroRealizado && data.montoRecaudado && data.montoRecaudado > 0 && !envio.referenciaCobroId) {
      try {
        const { VentaService } = await import('./venta.service');
        const ventaActual = await VentaService.getById(envio.ventaId);
        const montoACobrar = Math.min(data.montoRecaudado, ventaActual?.montoPendiente || 0);
        if (montoACobrar > 0) {
          const pago = await VentaService.registrarPago(
            envio.ventaId,
            {
              monto: montoACobrar,
              metodoPago: data.metodoPagoRecibido || 'efectivo',
              referencia: `Cobro despacho ${envio.numeroEnvio}`,
              notas: `Cobro contra-entrega · ${envio.colaboradorNombre ?? 'repartidor'}`,
              cuentaDestinoId: data.cuentaDestinoId,
            },
            userId,
            true,
          );
          await updateDoc(envioRef, { referenciaCobroId: pago.id });
          logger.log(`[registrarEntregaExitosa ${envio.numeroEnvio}] COD S/${montoACobrar.toFixed(2)} · pago ${pago.id}`);

          // Cable caja recaudadora: si la cuenta de cobro es una caja_recaudadora
          // (el COD lo recaudó un courier-recaudador), registrar el evento de cobro
          // entrante — el courier nos debe lo recaudado. Idempotente (key por envío) +
          // aislado en su propio try/catch: el cobro a la Venta ya está commiteado.
          if (data.cuentaDestinoId) {
            try {
              const { cajaRecaudadoraService } = await import('./cajaRecaudadora.service');
              const recaudadora = await cajaRecaudadoraService.getRecaudadora(data.cuentaDestinoId);
              const canalCobro = mapMetodoToCanalCobro(data.metodoPagoRecibido);
              if (recaudadora && canalCobro) {
                await cajaRecaudadoraService.registrarCobroEntrante({
                  recaudadoraId: data.cuentaDestinoId,
                  fecha: data.fechaEntrega ?? new Date(),
                  monto: montoACobrar,
                  moneda: 'PEN',
                  canalCobro,
                  vinculacionTipo: 'envio',
                  vinculacionId: envioId,
                  vinculacionRefDoc: envio.numeroEnvio,
                  clienteFinalNombre: envio.destinoClienteNombre,
                  notas: `COD despacho ${envio.numeroEnvio} · pago ${pago.id}`,
                  idempotencyKey: `cod_${envioId}`,
                }, userId);
                logger.log(
                  `[registrarEntregaExitosa ${envio.numeroEnvio}] Cobro entrante en recaudadora ${recaudadora.codigo} · ${canalCobro}`,
                );
              }
            } catch (e) { secondaryErrors.push(`cobro_recaudadora: ${e}`); }
          }
        }
      } catch (e) { secondaryErrors.push(`cobro_venta: ${e}`); }
    }

    // Reclasificar anticipos (si la venta quedó entregada)
    if (estadoVentaPost.nuevoEstado === 'entregada') {
      try {
        const reclas = await tesoreriaService.reclasificarAnticipos(envio.ventaId, venta.cotizacionOrigenId, userId);
        if (reclas > 0) logger.log(`[registrarEntregaExitosa ${envio.numeroEnvio}] ${reclas} anticipo(s) reclasificados`);
      } catch (e) { secondaryErrors.push(`reclasificar_anticipos: ${e}`); }
    }

    // CTRU recalc (fire-and-forget)
    import('./ctru.service').then(({ ctruService }) => {
      ctruService.actualizarCTRUPromedioProductos().catch((e) => logger.error('[CTRU] post-entrega:', e));
    }).catch(() => {});

    // TODO (A6): B4 movimientoTransportistaService.registrarEntregaExitosa espera Entrega · adaptar a Envio.

    if (secondaryErrors.length > 0) {
      logger.warn(`[registrarEntregaExitosa ${envio.numeroEnvio}] ${secondaryErrors.length} error(es) secundario(s):`, secondaryErrors);
    }

    return { secondaryErrors };
  },

  /**
   * A2.4 — Cancela un despacho de venta (Caso F). Porta entrega.service.cancelar sobre Envio:
   *   - estado → 'cancelada' (+ motivo en descripcionFallo).
   *   - anula el gasto delivery si existe.
   *   - libera las unidades (vuelven a stock · mejora vs original, que no las liberaba).
   * No se puede cancelar un despacho ya entregado (las unidades ya están vendidas).
   */
  async cancelarDespacho(envioId: string, motivo: string, userId: string): Promise<void> {
    const envio = await envioCrudService.getById(envioId);
    if (!envio) throw new Error('Envío no encontrado');
    if (envio.destinoTipo !== 'cliente') throw new Error('No es un despacho de venta (Caso F).');
    if (envio.estado === 'entregada') throw new Error('No se puede cancelar un despacho ya entregado.');
    if (envio.estado === 'cancelada') return; // idempotente

    await updateDoc(doc(db, ENVIOS_COLL, envioId), {
      estado: 'cancelada' as EstadoEnvio,
      descripcionFallo: motivo,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });

    if (envio.gastoDeliveryId) {
      try {
        await gastoService.delete(envio.gastoDeliveryId);
        await updateDoc(doc(db, ENVIOS_COLL, envioId), { gastoDeliveryId: null });
      } catch (error) {
        logger.error(`[cancelarDespacho ${envio.numeroEnvio}] Error anulando gasto delivery:`, error);
      }
    }

    const unidadIds = envio.unidades.map((u) => u.unidadId);
    if (unidadIds.length > 0) {
      try {
        const r = await unidadService.liberarUnidades(unidadIds, `Despacho cancelado: ${motivo}`, userId);
        logger.log(`[cancelarDespacho ${envio.numeroEnvio}] Unidades liberadas: ${r.exitos}/${unidadIds.length}`);
      } catch (error) {
        logger.error(`[cancelarDespacho ${envio.numeroEnvio}] Error liberando unidades:`, error);
      }
    }

    logger.log(`[cancelarDespacho ${envio.numeroEnvio}] cancelado · ${motivo}`);
  },

  /**
   * A2.5 — Programa un despacho F que ya existe en 'borrador' (creado por el WizardF
   * `/envios/nuevo-f` vía `crearEnvioF`). Transiciona 'borrador' → 'programada' con
   * los datos de reparto (courier, fecha, COD, flete) y sincroniza la venta a
   * 'en_entrega'. Es la contraparte "programar-existente" de `despacharVenta`
   * (que crea + programa en un solo paso desde el disparo de la Venta).
   */
  async programarDespacho(
    envioId: string,
    payload: {
      colaboradorTransporteId?: string;
      fechaProgramada: Date;
      horaProgramada?: string;
      cobroPendiente: boolean;
      montoPorCobrar?: number;
      metodoPagoEsperado?: MetodoPago;
      costoDeliveryPEN?: number;
      numeroTracking?: string;
    },
    userId: string,
  ): Promise<void> {
    const envio = await envioCrudService.getById(envioId);
    if (!envio) throw new Error('Envío no encontrado');
    if (envio.destinoTipo !== 'cliente') throw new Error('No es un despacho de venta (Caso F).');
    if (envio.estado !== 'borrador') {
      throw new Error(`Solo se puede programar un despacho en 'borrador' (actual: "${envio.estado}").`);
    }

    const reparto: Record<string, unknown> = {
      estado: 'programada' as EstadoEnvio,
      numeroEntrega: envio.numeroEntrega ?? 1,
      cobroPendiente: payload.cobroPendiente,
      fechaLlegadaEstimada: Timestamp.fromDate(payload.fechaProgramada),
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    };
    if (payload.colaboradorTransporteId) reparto.colaboradorId = payload.colaboradorTransporteId;
    if (payload.horaProgramada) reparto.horaProgramada = payload.horaProgramada;
    if (payload.montoPorCobrar !== undefined) reparto.montoPorCobrar = payload.montoPorCobrar;
    if (payload.metodoPagoEsperado) reparto.metodoPagoEsperado = payload.metodoPagoEsperado;
    if (payload.costoDeliveryPEN !== undefined) reparto.costoDeliveryPEN = payload.costoDeliveryPEN;
    if (payload.numeroTracking) reparto.numeroTracking = payload.numeroTracking;
    await updateDoc(doc(db, ENVIOS_COLL, envioId), reparto);

    // Sincronizar la venta → 'en_entrega' SOLO si aún no llegó a ese estado o
    // uno más avanzado (evita retroceder una venta ya 'despachada'/'entregada'
    // cuando hay despachos parciales · BUG-001).
    if (envio.ventaId) {
      const ventaSnap = await getDoc(doc(db, VENTAS_COLL, envio.ventaId));
      if (ventaSnap.exists()) {
        const estadoActual = (ventaSnap.data() as Venta).estado;
        const YA_AVANZADA = ['en_entrega', 'despachada', 'entrega_parcial', 'entregada', 'cancelada'];
        if (!YA_AVANZADA.includes(estadoActual)) {
          await updateDoc(doc(db, VENTAS_COLL, envio.ventaId), {
            estado: 'en_entrega',
            fechaEnEntrega: Timestamp.now(),
            editadoPor: userId,
            ultimaEdicion: Timestamp.now(),
          });
        }
      }
    }

    logger.success(`[programarDespacho] ${envio.numeroEnvio} → programada · VT ${envio.ventaNumero ?? '—'}`);
  },

  /**
   * Guardia anti-doble-camino (A4). Devuelve true si la venta ya tiene un despacho
   * F ACTIVO (Envío destinoTipo='cliente' en estado de reparto no terminal:
   * programada/en_camino/reprogramada). El call site (Ventas/entregaStore) combina
   * esto con `entregaService.getByVenta` para cubrir también entregas legacy activas,
   * evitando que una misma venta se despache por ambos caminos (doble gasto/cobro).
   * El estado se filtra en memoria para no exigir un índice compuesto con 'in'.
   */
  async existeEnvioFActivo(ventaId: string): Promise<boolean> {
    if (!ventaId) return false;
    const snap = await getDocs(query(
      collection(db, ENVIOS_COLL),
      where('ventaId', '==', ventaId),
      where('destinoTipo', '==', 'cliente'),
    ));
    const ACTIVOS: readonly EstadoEnvio[] = ['programada', 'en_camino', 'reprogramada'];
    return snap.docs.some((d) => ACTIVOS.includes((d.data() as Envio).estado));
  },
};
