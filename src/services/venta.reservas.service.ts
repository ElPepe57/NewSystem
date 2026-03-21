/**
 * venta.reservas.service.ts
 *
 * Métodos de reserva de stock y adelantos extraídos de VentaService.
 * Contiene: registrarAdelantoConReserva, extenderReserva, cancelarReserva,
 * verificarReservasPorVencer, verificarStockParaReservasVirtuales,
 * asignarStockAReservaVirtual, sincronizarAdelantoDesdeCotizacion,
 * sincronizarTodosLosAdelantosPendientes.
 *
 * Estas funciones son invocadas como delegados desde VentaService,
 * manteniendo la API pública intacta.
 */

import {
  collection,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type {
  Venta,
  EstadoVenta,
  EstadoCotizacion,
  PagoVenta,
  StockReservado,
  ProductoReservado,
  ProductoStockVirtual,
  TipoReserva,
  AdelantoData,
} from '../types/venta.types';
import type { Unidad } from '../types/unidad.types';
import { unidadService } from './unidad.service';
import { tipoCambioService } from './tipoCambio.service';
import { tesoreriaService } from './tesoreria.service';
import { NotificationService } from './notification.service';
import { inventarioService } from './inventario.service';
import { ProductoService } from './producto.service';
import { esPaisOrigen } from '../utils/multiOrigen.helpers';

const COLLECTION_NAME = COLLECTIONS.VENTAS;

/**
 * Registrar adelanto y crear reserva de stock (física o virtual).
 */
export async function registrarAdelantoConReserva(
  cotizacionId: string,
  venta: Venta,
  adelanto: AdelantoData,
  userId: string,
  horasVigencia: number = 48
): Promise<{
  tipoReserva: TipoReserva;
  productosReservados: ProductoReservado[];
  productosVirtuales?: ProductoStockVirtual[];
  pagoRegistrado: PagoVenta;
  requerimientoId?: string;
}> {
  const estadosPermitidos: EstadoVenta[] = ['cotizacion', 'confirmada'];
  if (!estadosPermitidos.includes(venta.estado)) {
    throw new Error('Solo se pueden procesar cotizaciones o ventas confirmadas. Estado actual: ' + venta.estado);
  }

  const esVentaDirecta = venta.estado === 'confirmada';

  if (adelanto.monto <= 0) {
    throw new Error('El monto del adelanto debe ser mayor a 0');
  }

  if (adelanto.monto > venta.totalPEN) {
    throw new Error('El adelanto no puede ser mayor al total de la venta');
  }

  const batch = writeBatch(db);
  const productosReservados: ProductoReservado[] = [];
  const productosVirtuales: ProductoStockVirtual[] = [];
  let tieneStockFisico = false;
  let tieneFaltantes = false;

  for (const producto of venta.productos) {
    const nombreProducto = `${producto.marca} ${producto.nombreComercial}`;

    let unidadesDisponibles: Array<{ unidad: Unidad; orden: number }> = [];
    try {
      unidadesDisponibles = await unidadService.seleccionarFEFO(
        producto.productoId,
        producto.cantidad
      );
    } catch (e) {
      unidadesDisponibles = [];
    }

    const cantidadDisponible = unidadesDisponibles.length;
    const cantidadRequerida = producto.cantidad;
    const cantidadFaltante = cantidadRequerida - cantidadDisponible;

    if (cantidadDisponible > 0) {
      tieneStockFisico = true;

      const unidadesAReservar = unidadesDisponibles.slice(0, cantidadRequerida);
      const unidadesIds: string[] = [];

      for (const { unidad } of unidadesAReservar) {
        const unidadRef = doc(db, COLLECTIONS.UNIDADES, unidad.id);
        batch.update(unidadRef, {
          estado: 'reservada',
          reservadaPara: cotizacionId,
          fechaReserva: serverTimestamp()
        });
        unidadesIds.push(unidad.id);
      }

      productosReservados.push({
        productoId: producto.productoId,
        sku: producto.sku,
        cantidad: unidadesAReservar.length,
        unidadesReservadas: unidadesIds
      });
    }

    if (cantidadFaltante > 0) {
      tieneFaltantes = true;

      productosVirtuales.push({
        productoId: producto.productoId,
        sku: producto.sku,
        nombreProducto,
        cantidadRequerida,
        cantidadDisponible,
        cantidadFaltante
      });

      if (cantidadDisponible === 0) {
        productosReservados.push({
          productoId: producto.productoId,
          sku: producto.sku,
          cantidad: cantidadRequerida,
          unidadesReservadas: []
        });
      }
    }
  }

  let tipoReserva: TipoReserva;
  if (tieneStockFisico && !tieneFaltantes) {
    tipoReserva = 'fisica';
  } else if (!tieneStockFisico && tieneFaltantes) {
    tipoReserva = 'virtual';
  } else {
    tipoReserva = 'virtual';
  }

  const pagoAdelanto: PagoVenta = {
    id: `ADL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    tipoPago: 'anticipo',
    monto: adelanto.monto,
    metodoPago: adelanto.metodoPago,
    fecha: Timestamp.now(),
    registradoPor: userId,
    notas: `Adelanto para reserva de stock (${tipoReserva})`
  };
  if (adelanto.referencia) {
    pagoAdelanto.referencia = adelanto.referencia;
  }

  const ahora = new Date();
  const vigenciaHasta = new Date(ahora.getTime() + horasVigencia * 60 * 60 * 1000);

  const stockReservado: StockReservado = {
    activo: true,
    tipoReserva,
    fechaReserva: Timestamp.now(),
    vigenciaHasta: Timestamp.fromDate(vigenciaHasta),
    horasVigenciaOriginal: horasVigencia,
    adelantoId: pagoAdelanto.id,
    montoAdelanto: adelanto.monto,
    productosReservados
  };

  if (productosVirtuales.length > 0) {
    stockReservado.stockVirtual = {
      productosVirtuales
    };
  }

  const ventaRef = doc(db, COLLECTION_NAME, cotizacionId);

  const updateData: Record<string, any> = {
    estado: 'reservada',
    stockReservado,
    pagos: [pagoAdelanto],
    montoPagado: adelanto.monto,
    montoPendiente: venta.totalPEN - adelanto.monto,
    estadoPago: adelanto.monto >= venta.totalPEN ? 'pagado' : 'parcial',
    requiereStock: tieneFaltantes,
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId
  };

  if (!esVentaDirecta) {
    updateData.estadoCotizacion = 'con_abono' as EstadoCotizacion;
  }

  if (productosVirtuales.length > 0) {
    updateData.productosConFaltante = productosVirtuales.map(p => ({
      nombre: p.nombreProducto,
      disponibles: p.cantidadDisponible,
      solicitados: p.cantidadRequerida
    }));
  } else {
    updateData.productosConFaltante = null;
  }

  batch.update(ventaRef, updateData);

  await batch.commit();

  // Registrar movimiento de tesorería para el anticipo
  const metodoTesoreriaMap: Record<string, string> = {
    'yape': 'yape', 'plin': 'plin', 'efectivo': 'efectivo',
    'transferencia': 'transferencia_bancaria', 'mercado_pago': 'mercado_pago',
    'tarjeta': 'tarjeta', 'paypal': 'paypal', 'zelle': 'otro', 'otro': 'otro'
  };

  const tipoCambio = await tipoCambioService.resolverTCVentaEstricto();

  const metodosUSD: string[] = ['paypal', 'zelle'];
  const monedaAdelanto = metodosUSD.includes(adelanto.metodoPago) ? 'USD' : 'PEN';

  let cuentaDestinoId = adelanto.cuentaDestinoId;
  if (!cuentaDestinoId) {
    const metodoTes = metodoTesoreriaMap[adelanto.metodoPago] || 'efectivo';
    const cuentaPorDefecto = await tesoreriaService.getCuentaPorMetodoPago(metodoTes as any, monedaAdelanto);
    if (cuentaPorDefecto) {
      cuentaDestinoId = cuentaPorDefecto.id;
    } else {
      console.warn(`No se encontró cuenta por defecto para método "${metodoTes}". El movimiento se registrará sin cuenta destino.`);
    }
  }

  await tesoreriaService.registrarMovimiento({
    tipo: 'ingreso_anticipo',
    moneda: monedaAdelanto as any,
    monto: adelanto.monto,
    tipoCambio,
    metodo: (metodoTesoreriaMap[adelanto.metodoPago] || 'efectivo') as any,
    concepto: `Adelanto con reserva - ${venta.numeroVenta} - ${venta.nombreCliente}`,
    fecha: new Date(),
    referencia: adelanto.referencia,
    ventaId: cotizacionId,
    ventaNumero: venta.numeroVenta,
    cuentaDestino: cuentaDestinoId
  }, userId);

  if (tipoReserva === 'virtual') {
    console.log(`[Reserva Virtual] Cotización ${venta.numeroVenta} requiere stock adicional`);
  }

  return {
    tipoReserva,
    productosReservados,
    productosVirtuales: productosVirtuales.length > 0 ? productosVirtuales : undefined,
    pagoRegistrado: pagoAdelanto,
    requerimientoId: stockReservado.stockVirtual?.requerimientoGenerado
  };
}

/**
 * Extender la vigencia de una reserva activa.
 */
export async function extenderReserva(
  venta: Venta,
  horasAdicionales: number,
  motivo: string,
  userId: string
): Promise<void> {
  const ventaId = venta.id;

  if (venta.estado !== 'reservada' || !venta.stockReservado?.activo) {
    throw new Error('No hay una reserva activa para extender');
  }

  const extensiones = venta.stockReservado.extensiones || [];
  if (extensiones.length >= 3) {
    throw new Error('Se ha alcanzado el límite máximo de 3 extensiones');
  }

  const vigenciaActual = venta.stockReservado.vigenciaHasta.toDate();
  const nuevaVigencia = new Date(vigenciaActual.getTime() + horasAdicionales * 60 * 60 * 1000);

  const nuevaExtension = {
    fecha: Timestamp.now(),
    horasExtendidas: horasAdicionales,
    nuevaVigencia: Timestamp.fromDate(nuevaVigencia),
    motivo,
    extendidoPor: userId
  };

  await updateDoc(doc(db, COLLECTION_NAME, ventaId), {
    'stockReservado.vigenciaHasta': Timestamp.fromDate(nuevaVigencia),
    'stockReservado.extensiones': [...extensiones, nuevaExtension],
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId
  });
}

/**
 * Cancelar una reserva activa y liberar el stock físico reservado.
 */
export async function cancelarReserva(
  venta: Venta,
  userId: string,
  motivo?: string
): Promise<void> {
  const ventaId = venta.id;

  if (venta.estado !== 'reservada') {
    throw new Error('Solo se pueden cancelar ventas en estado reservada');
  }

  const batch = writeBatch(db);

  if (venta.stockReservado?.productosReservados) {
    for (const prod of venta.stockReservado.productosReservados) {
      for (const unidadId of prod.unidadesReservadas) {
        const unidadRef = doc(db, COLLECTIONS.UNIDADES, unidadId);
        const unidadSnap = await getDoc(unidadRef);
        const unidadData = unidadSnap.data();
        const estadoLiberado = esPaisOrigen(unidadData?.pais) ? 'recibida_origen' : 'disponible_peru';
        batch.update(unidadRef, {
          estado: estadoLiberado,
          reservadaPara: null,
          reservadoPara: null,
          fechaReserva: null
        });
      }
    }
  }

  const updates: any = {
    estado: 'cotizacion',
    stockReservado: null,
    requiereStock: null,
    productosConFaltante: null,
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId
  };

  if (motivo) {
    updates.observaciones = venta.observaciones
      ? `${venta.observaciones}\n\nRESERVA CANCELADA: ${motivo}`
      : `RESERVA CANCELADA: ${motivo}`;
  }

  const ventaRef = doc(db, COLLECTION_NAME, ventaId);
  batch.update(ventaRef, updates);

  await batch.commit();
}

/**
 * Verificar reservas próximas a vencer y crear notificaciones.
 */
export async function verificarReservasPorVencer(ventasReservadas: Venta[]): Promise<void> {
  const ahora = new Date();
  const limiteHoras = 12;

  for (const venta of ventasReservadas) {
    if (!venta.stockReservado?.activo) continue;

    const vigenciaHasta = venta.stockReservado.vigenciaHasta.toDate();
    const horasRestantes = (vigenciaHasta.getTime() - ahora.getTime()) / (1000 * 60 * 60);

    if (horasRestantes > 0 && horasRestantes <= limiteHoras) {
      const existeNotificacion = await NotificationService.existeNotificacionActiva(
        venta.id,
        'reserva_por_vencer'
      );

      if (!existeNotificacion) {
        await NotificationService.notificarReservaPorVencer({
          ventaId: venta.id,
          numeroVenta: venta.numeroVenta,
          nombreCliente: venta.nombreCliente,
          horasRestantes: Math.round(horasRestantes),
          vigenciaHasta: venta.stockReservado.vigenciaHasta
        });
      }
    }
  }
}

/**
 * Verificar si hay stock disponible para ventas con reserva virtual
 * de un producto específico.
 */
export async function verificarStockParaReservasVirtuales(
  productoId: string,
  ventasReservadas: Venta[]
): Promise<void> {
  for (const venta of ventasReservadas) {
    if (venta.stockReservado?.tipoReserva !== 'virtual') continue;
    if (!venta.stockReservado?.stockVirtual?.productosVirtuales) continue;

    const productoVirtual = venta.stockReservado.stockVirtual.productosVirtuales
      .find(p => p.productoId === productoId);

    if (!productoVirtual) continue;

    const inventario = await inventarioService.getInventarioProducto(productoId);
    const disponiblesEnPeru = inventario
      .filter(inv => inv.pais === 'Peru')
      .reduce((sum, inv) => sum + inv.disponibles, 0);

    if (disponiblesEnPeru > 0) {
      const existeNotificacion = await NotificationService.existeNotificacionActiva(
        venta.id,
        'stock_disponible'
      );

      if (!existeNotificacion) {
        const producto = await ProductoService.getById(productoId);
        await NotificationService.notificarStockDisponible({
          ventaId: venta.id,
          numeroVenta: venta.numeroVenta,
          nombreCliente: venta.nombreCliente,
          productos: [{
            productoId,
            nombre: `${producto?.marca} ${producto?.nombreComercial}`,
            cantidadDisponible: Math.min(disponiblesEnPeru, productoVirtual.cantidadFaltante),
            cantidadRequerida: productoVirtual.cantidadFaltante
          }]
        });
      }
    }
  }
}

/**
 * Convertir reserva virtual a física cuando hay stock disponible.
 */
export async function asignarStockAReservaVirtual(
  venta: Venta,
  userId: string
): Promise<{ asignados: number; faltantes: number }> {
  const ventaId = venta.id;

  if (venta.estado !== 'reservada') {
    throw new Error('La venta no está en estado reservada');
  }

  if (venta.stockReservado?.tipoReserva !== 'virtual') {
    throw new Error('La venta no tiene una reserva virtual');
  }

  const batch = writeBatch(db);
  let totalAsignados = 0;
  let totalFaltantes = 0;
  const nuevosProductosReservados: ProductoReservado[] = [];
  const nuevosProductosVirtuales: ProductoStockVirtual[] = [];

  for (const productoVirtual of venta.stockReservado.stockVirtual?.productosVirtuales || []) {
    let unidadesDisponibles: Array<{ unidad: Unidad; orden: number }> = [];
    try {
      unidadesDisponibles = await unidadService.seleccionarFEFO(
        productoVirtual.productoId,
        productoVirtual.cantidadFaltante
      );
    } catch (e) {
      unidadesDisponibles = [];
    }

    const cantidadAsignada = Math.min(unidadesDisponibles.length, productoVirtual.cantidadFaltante);
    const nuevasFaltantes = productoVirtual.cantidadFaltante - cantidadAsignada;

    if (cantidadAsignada > 0) {
      const unidadesIds: string[] = [];

      for (let i = 0; i < cantidadAsignada; i++) {
        const { unidad } = unidadesDisponibles[i];
        const unidadRef = doc(db, COLLECTIONS.UNIDADES, unidad.id);
        batch.update(unidadRef, {
          estado: 'reservada',
          reservadaPara: ventaId,
          fechaReserva: serverTimestamp()
        });
        unidadesIds.push(unidad.id);
      }

      nuevosProductosReservados.push({
        productoId: productoVirtual.productoId,
        sku: productoVirtual.sku,
        cantidad: cantidadAsignada,
        unidadesReservadas: unidadesIds
      });

      totalAsignados += cantidadAsignada;
    }

    if (nuevasFaltantes > 0) {
      nuevosProductosVirtuales.push({
        ...productoVirtual,
        cantidadDisponible: productoVirtual.cantidadDisponible + cantidadAsignada,
        cantidadFaltante: nuevasFaltantes
      });
      totalFaltantes += nuevasFaltantes;
    }
  }

  const productosReservadosExistentes = venta.stockReservado.productosReservados
    .filter(p => p.unidadesReservadas.length > 0);

  const todosProductosReservados = [
    ...productosReservadosExistentes,
    ...nuevosProductosReservados
  ];

  const nuevoTipoReserva: TipoReserva = totalFaltantes > 0 ? 'virtual' : 'fisica';

  const nuevoStockReservado: StockReservado = {
    ...venta.stockReservado,
    tipoReserva: nuevoTipoReserva,
    productosReservados: todosProductosReservados,
    stockVirtual: totalFaltantes > 0
      ? { productosVirtuales: nuevosProductosVirtuales }
      : undefined
  };

  const ventaRef = doc(db, COLLECTION_NAME, ventaId);
  batch.update(ventaRef, {
    stockReservado: nuevoStockReservado,
    requiereStock: totalFaltantes > 0,
    productosConFaltante: totalFaltantes > 0
      ? nuevosProductosVirtuales.map(p => ({
          nombre: p.nombreProducto,
          disponibles: p.cantidadDisponible,
          solicitados: p.cantidadRequerida
        }))
      : null,
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId
  });

  await batch.commit();

  return {
    asignados: totalAsignados,
    faltantes: totalFaltantes
  };
}

/**
 * Sincronizar adelanto desde cotización de origen hacia una venta.
 * Útil para corregir ventas creadas antes de la corrección del flujo de adelantos.
 */
export async function sincronizarAdelantoDesdeCotizacion(
  ventaId: string,
  venta: Venta,
  userId: string
): Promise<{
  sincronizado: boolean;
  montoAdelanto?: number;
  mensaje: string;
}> {
  const ventaExtendida = venta as any;
  if (ventaExtendida.adelantoComprometido?.transferidoComoPago === true) {
    return { sincronizado: false, mensaje: 'El adelanto ya fue transferido previamente' };
  }

  const cotizacionOrigenId = ventaExtendida.cotizacionOrigenId;
  if (!cotizacionOrigenId) {
    return { sincronizado: false, mensaje: 'La venta no tiene cotización de origen' };
  }

  const cotizacionDoc = await getDoc(doc(db, COLLECTIONS.COTIZACIONES, cotizacionOrigenId));
  if (!cotizacionDoc.exists()) {
    return { sincronizado: false, mensaje: 'Cotización de origen no encontrada' };
  }

  const cotizacion = { id: cotizacionDoc.id, ...cotizacionDoc.data() } as any;

  if (!cotizacion.adelanto || cotizacion.adelanto.monto <= 0) {
    return { sincronizado: false, mensaje: 'La cotización no tiene adelanto registrado' };
  }

  const montoAdelantoPEN = cotizacion.adelanto.montoEquivalentePEN ||
    cotizacion.adelanto.monto * (cotizacion.adelanto.tipoCambio || 1);

  const pagoAdelanto: PagoVenta = {
    id: `ADL-SYNC-${Date.now()}`,
    monto: montoAdelantoPEN,
    metodoPago: cotizacion.adelanto.metodoPago || 'efectivo',
    fecha: cotizacion.adelanto.fecha || Timestamp.now(),
    registradoPor: userId,
    notas: `Adelanto sincronizado desde cotización ${cotizacion.numeroCotizacion} (corrección)`
  };

  if (cotizacion.adelanto.referencia) {
    pagoAdelanto.referencia = cotizacion.adelanto.referencia;
  }

  const pagosExistentes = venta.pagos || [];
  const nuevosPagos = [...pagosExistentes, pagoAdelanto];
  const nuevoMontoPagado = venta.montoPagado + montoAdelantoPEN;
  const nuevoMontoPendiente = venta.totalPEN - nuevoMontoPagado;
  const nuevoEstadoPago = nuevoMontoPendiente <= 0 ? 'pagado' :
    nuevoMontoPagado > 0 ? 'parcial' : 'pendiente';

  const adelantoComprometidoData: Record<string, any> = {
    monto: cotizacion.adelanto.monto,
    metodoPago: cotizacion.adelanto.metodoPago,
    fechaCompromiso: cotizacion.adelanto.fecha || Timestamp.now(),
    desdeCotizacion: cotizacion.numeroCotizacion,
    montoEquivalentePEN: montoAdelantoPEN,
    transferidoComoPago: true,
    sincronizadoEn: serverTimestamp()
  };

  if (cotizacion.adelanto.moneda) {
    adelantoComprometidoData.moneda = cotizacion.adelanto.moneda;
  }
  if (cotizacion.adelanto.tipoCambio) {
    adelantoComprometidoData.tipoCambio = cotizacion.adelanto.tipoCambio;
  }

  await updateDoc(doc(db, COLLECTION_NAME, ventaId), {
    pagos: nuevosPagos,
    montoPagado: nuevoMontoPagado,
    montoPendiente: Math.max(0, nuevoMontoPendiente),
    estadoPago: nuevoEstadoPago,
    adelantoComprometido: adelantoComprometidoData,
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId
  });

  console.log(`[Sync Adelanto] Venta ${venta.numeroVenta}: S/${montoAdelantoPEN.toFixed(2)} sincronizado desde ${cotizacion.numeroCotizacion}`);

  return {
    sincronizado: true,
    montoAdelanto: montoAdelantoPEN,
    mensaje: `Adelanto de S/${montoAdelantoPEN.toFixed(2)} sincronizado correctamente`
  };
}
