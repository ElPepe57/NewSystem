/**
 * venta.recalculo.service.ts
 *
 * Métodos de corrección y recálculo de ventas extraídos de VentaService.
 * Contiene: corregirPrecioProducto, corregirProductoVenta, editarVenta,
 * diagnosticarAsignacionesFEFO, corregirAsignacionFEFO, corregirCanalesVentas.
 *
 * Estas funciones son invocadas como delegados desde VentaService,
 * manteniendo la API pública intacta.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type {
  Venta,
  EstadoVenta,
  EstadoPago,
  ProductoVenta,
  AsignacionUnidad,
  EstadoAsignacionProducto,
  EditarVentaData,
} from '../types/venta.types';
import { tipoCambioService } from './tipoCambio.service';
import { tesoreriaService } from './tesoreria.service';
import { entregaService } from './entrega.service';
import { unidadService } from './unidad.service';
import { actividadService } from './actividad.service';
import { ProductoService } from './producto.service';
import { logger } from '../lib/logger';

const COLLECTION_NAME = COLLECTIONS.VENTAS;

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Calcular el CTRU en PEN para una unidad, usando ctruDinamico si está disponible.
 */
function calcularCtruPEN(unidad: any, tipoCambioFallback: number): number {
  if (unidad.ctruDinamico && unidad.ctruDinamico > 0) {
    return unidad.ctruDinamico;
  }
  const costoFleteUSD = unidad.costoFleteUSD || 0;
  const costoTotalUSD = unidad.costoUnitarioUSD + costoFleteUSD;
  const tcAplicable = unidad.tcPago || unidad.tcCompra || tipoCambioFallback;
  return costoTotalUSD * tcAplicable;
}

/**
 * Recalcular el estado de pago correcto dado el monto pagado y el total.
 */
function calcularEstadoPago(montoPagado: number, totalPEN: number): EstadoPago {
  const pendiente = totalPEN - montoPagado;
  if (pendiente <= 0) return 'pagado';
  if (montoPagado > 0) return 'parcial';
  return 'pendiente';
}

/**
 * Sumar el monto total pagado en PEN (convierte USD→PEN cuando corresponde).
 */
function sumarMontoPagadoPEN(pagos: Venta['pagos']): number {
  return (pagos || []).reduce((sum, p) => {
    if (p.moneda === 'USD' && p.montoEquivalentePEN) return sum + p.montoEquivalentePEN;
    return sum + p.monto;
  }, 0);
}

// ---------------------------------------------------------------------------
// Corrección de precio de producto
// ---------------------------------------------------------------------------

/**
 * Corregir el precio de un producto en una venta ya completada.
 * Propaga cambios a: venta (totales, márgenes, pagos), entregas y tesorería.
 */
export async function corregirPrecioProducto(
  venta: Venta,
  productoId: string,
  nuevoPrecioUnitario: number,
  userId: string
): Promise<{ cambios: string[] }> {
  const ventaId = venta.id;
  const cambios: string[] = [];

  const productoIndex = venta.productos.findIndex(p => p.productoId === productoId);
  if (productoIndex === -1) throw new Error('Producto no encontrado en la venta');

  const producto = venta.productos[productoIndex];
  const precioAnterior = producto.precioUnitario;
  if (precioAnterior === nuevoPrecioUnitario) {
    return { cambios: ['Sin cambios - el precio es el mismo'] };
  }

  const nuevoSubtotalProducto = producto.cantidad * nuevoPrecioUnitario;
  const diferenciaProducto = nuevoSubtotalProducto - producto.subtotal;

  const nuevoSubtotalPEN = venta.subtotalPEN + diferenciaProducto;
  const descuento = venta.descuento || 0;
  const costoEnvio = venta.incluyeEnvio ? 0 : (venta.costoEnvio || 0);
  const nuevoTotalPEN = nuevoSubtotalPEN - descuento + costoEnvio;

  const productosActualizados = [...venta.productos];
  productosActualizados[productoIndex] = {
    ...producto,
    precioUnitario: nuevoPrecioUnitario,
    subtotal: nuevoSubtotalProducto,
    margenReal: producto.costoTotalUnidades
      ? ((nuevoSubtotalProducto - producto.costoTotalUnidades) / nuevoSubtotalProducto) * 100
      : producto.margenReal
  };

  const costoTotalPEN = venta.costoTotalPEN || 0;
  const gastosVentaPEN = venta.gastosVentaPEN || 0;
  const utilidadBrutaPEN = nuevoTotalPEN - costoTotalPEN;
  const utilidadNetaPEN = utilidadBrutaPEN - gastosVentaPEN;
  const margenBruto = nuevoTotalPEN > 0 ? (utilidadBrutaPEN / nuevoTotalPEN) * 100 : 0;
  const margenNeto = nuevoTotalPEN > 0 ? (utilidadNetaPEN / nuevoTotalPEN) * 100 : 0;

  const nuevoMontoPagadoFinal = sumarMontoPagadoPEN(venta.pagos);
  const nuevoMontoPendienteFinal = nuevoTotalPEN - nuevoMontoPagadoFinal;
  const estadoPagoFinal = calcularEstadoPago(nuevoMontoPagadoFinal, nuevoTotalPEN);

  const ventaUpdates: Record<string, any> = {
    productos: productosActualizados,
    subtotalPEN: nuevoSubtotalPEN,
    totalPEN: nuevoTotalPEN,
    montoPagado: nuevoMontoPagadoFinal,
    montoPendiente: Math.max(0, nuevoMontoPendienteFinal),
    estadoPago: estadoPagoFinal,
    utilidadBrutaPEN,
    utilidadNetaPEN,
    margenBruto,
    margenNeto,
    margenPromedio: margenBruto,
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId
  };

  if (nuevoMontoPendienteFinal < 0) {
    ventaUpdates.saldoAFavor = Math.abs(nuevoMontoPendienteFinal);
    ventaUpdates.tieneSobrepago = true;
  } else {
    ventaUpdates.saldoAFavor = 0;
    ventaUpdates.tieneSobrepago = false;
  }

  await updateDoc(doc(db, COLLECTION_NAME, ventaId), ventaUpdates);
  cambios.push(`Venta: Total S/ ${venta.totalPEN.toFixed(2)} → S/ ${nuevoTotalPEN.toFixed(2)}`);
  cambios.push(`Producto: Precio S/ ${precioAnterior.toFixed(2)} → S/ ${nuevoPrecioUnitario.toFixed(2)}`);

  // Propagar a entregas
  try {
    const entregas = await entregaService.getByVenta(ventaId);
    for (const entrega of entregas) {
      const productoEntrega = entrega.productos.find(p => p.productoId === productoId);
      if (productoEntrega) {
        const nuevosProductosEntrega = entrega.productos.map(p => {
          if (p.productoId === productoId) {
            return {
              ...p,
              precioUnitario: nuevoPrecioUnitario,
              subtotal: p.cantidad * nuevoPrecioUnitario
            };
          }
          return p;
        });
        const nuevoSubtotalEntrega = nuevosProductosEntrega.reduce((sum, p) => sum + p.subtotal, 0);

        const entregaUpdates: Record<string, any> = {
          productos: nuevosProductosEntrega,
          subtotalPEN: nuevoSubtotalEntrega
        };
        if (entrega.montoPorCobrar && entrega.montoPorCobrar === entrega.subtotalPEN) {
          entregaUpdates.montoPorCobrar = nuevoSubtotalEntrega;
        }

        await updateDoc(doc(db, COLLECTIONS.ENTREGAS, entrega.id), entregaUpdates);
        cambios.push(`Entrega ${entrega.codigo}: Subtotal S/ ${entrega.subtotalPEN.toFixed(2)} → S/ ${nuevoSubtotalEntrega.toFixed(2)}`);
      }
    }
  } catch (err) {
    logger.error('Error actualizando entregas:', err);
    cambios.push('Entregas: Error al actualizar (revisar manualmente)');
  }

  // Propagar a tesorería
  try {
    const movimientos = await tesoreriaService.getMovimientos({});
    const movimientosVenta = movimientos.filter(
      m => (m.ventaId === ventaId || ((venta as any).cotizacionOrigenId && m.cotizacionId === (venta as any).cotizacionOrigenId)) &&
        (m.tipo === 'ingreso_venta' || m.tipo === 'ingreso_anticipo') && m.estado === 'ejecutado'
    );

    if (movimientosVenta.length === 1 && movimientosVenta[0].monto === venta.totalPEN) {
      await tesoreriaService.actualizarMovimiento(
        movimientosVenta[0].id,
        { monto: nuevoTotalPEN },
        userId
      );
      cambios.push(`Tesorería: Movimiento actualizado S/ ${venta.totalPEN.toFixed(2)} → S/ ${nuevoTotalPEN.toFixed(2)}`);
    } else if (movimientosVenta.length > 1) {
      cambios.push(`Tesorería: Múltiples movimientos encontrados (${movimientosVenta.length}), revisar manualmente`);
    } else if (movimientosVenta.length === 0) {
      cambios.push('Tesorería: No se encontró movimiento asociado');
    } else {
      cambios.push(`Tesorería: Movimiento tiene monto diferente (S/ ${movimientosVenta[0].monto.toFixed(2)}), no se actualizó`);
    }
  } catch (err) {
    logger.error('Error actualizando tesorería:', err);
    cambios.push('Tesorería: Error al actualizar (revisar manualmente)');
  }

  return { cambios };
}

// ---------------------------------------------------------------------------
// Corrección de producto equivocado
// ---------------------------------------------------------------------------

/**
 * Corregir un producto equivocado en una venta: reemplaza la identidad del producto
 * manteniendo cantidad y precio. Propaga cambios a cotización origen, requerimientos y entregas.
 * Solo permitido en estados tempranos (cotizacion, confirmada) sin unidades asignadas.
 */
export async function corregirProductoVenta(
  venta: Venta,
  productoIdAnterior: string,
  nuevoProductoId: string,
  userId: string
): Promise<{ cambios: string[] }> {
  const ventaId = venta.id;
  const cambios: string[] = [];

  const estadosPermitidos: EstadoVenta[] = ['cotizacion', 'confirmada'];
  if (!estadosPermitidos.includes(venta.estado)) {
    throw new Error(`No se puede corregir producto en estado "${venta.estado}". Solo permitido en: ${estadosPermitidos.join(', ')}`);
  }

  const productoIndex = venta.productos.findIndex(p => p.productoId === productoIdAnterior);
  if (productoIndex === -1) throw new Error('Producto no encontrado en la venta');

  const productoAnterior = venta.productos[productoIndex];

  if (productoAnterior.unidadesAsignadas && productoAnterior.unidadesAsignadas.length > 0) {
    throw new Error('No se puede corregir: el producto ya tiene unidades asignadas. Desasigne primero.');
  }
  if (productoAnterior.cantidadAsignada && productoAnterior.cantidadAsignada > 0) {
    throw new Error('No se puede corregir: el producto ya tiene unidades asignadas.');
  }

  if (productoIdAnterior === nuevoProductoId) {
    return { cambios: ['Sin cambios - es el mismo producto'] };
  }

  const nuevoProducto = await ProductoService.getById(nuevoProductoId);
  if (!nuevoProducto) throw new Error('Nuevo producto no encontrado en el catálogo');

  const productoCorregido: Record<string, any> = {
    productoId: nuevoProducto.id,
    sku: nuevoProducto.sku,
    marca: nuevoProducto.marca,
    nombreComercial: nuevoProducto.nombreComercial,
    presentacion: nuevoProducto.presentacion,
    cantidad: productoAnterior.cantidad,
    precioUnitario: productoAnterior.precioUnitario,
    subtotal: productoAnterior.subtotal,
    unidadesAsignadas: [],
    estadoAsignacion: 'pendiente' as EstadoAsignacionProducto,
    cantidadAsignada: 0,
    cantidadPendiente: productoAnterior.cantidad,
  };
  if (nuevoProducto.contenido) productoCorregido.contenido = nuevoProducto.contenido;
  if (nuevoProducto.dosaje) productoCorregido.dosaje = nuevoProducto.dosaje;
  if ((nuevoProducto as any).sabor) productoCorregido.sabor = (nuevoProducto as any).sabor;

  const productosActualizados = [...venta.productos];
  productosActualizados[productoIndex] = productoCorregido as ProductoVenta;

  const nombreAnterior = `${productoAnterior.marca} ${productoAnterior.nombreComercial} (${productoAnterior.presentacion})`;
  const nombreNuevo = `${nuevoProducto.marca} ${nuevoProducto.nombreComercial} (${nuevoProducto.presentacion})`;

  await updateDoc(doc(db, COLLECTION_NAME, ventaId), {
    productos: productosActualizados,
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId
  });
  cambios.push(`Venta: ${nombreAnterior} → ${nombreNuevo}`);

  // Cascada a cotización origen
  if ((venta as any).cotizacionOrigenId) {
    try {
      const cotRef = doc(db, COLLECTIONS.COTIZACIONES, (venta as any).cotizacionOrigenId);
      const cotSnap = await getDoc(cotRef);
      if (cotSnap.exists()) {
        const cotData = cotSnap.data();
        const cotProductos = cotData.productos as any[] || [];
        const cotProdIndex = cotProductos.findIndex((p: any) => p.productoId === productoIdAnterior);

        if (cotProdIndex !== -1) {
          const cotProductosActualizados = [...cotProductos];
          const cotProdActualizado: Record<string, any> = {
            ...cotProductos[cotProdIndex],
            productoId: nuevoProducto.id,
            sku: nuevoProducto.sku,
            marca: nuevoProducto.marca,
            nombreComercial: nuevoProducto.nombreComercial,
            presentacion: nuevoProducto.presentacion,
          };
          if (nuevoProducto.contenido) cotProdActualizado.contenido = nuevoProducto.contenido;
          if (nuevoProducto.dosaje) cotProdActualizado.dosaje = nuevoProducto.dosaje;
          cotProductosActualizados[cotProdIndex] = cotProdActualizado;

          await updateDoc(cotRef, {
            productos: cotProductosActualizados,
            ultimaEdicion: serverTimestamp(),
            editadoPor: userId
          });
          cambios.push(`Cotización ${cotData.numeroCotizacion || (venta as any).numeroCotizacionOrigen}: Producto actualizado`);
        } else {
          cambios.push(`Cotización: Producto no encontrado en cotización (verificar manualmente)`);
        }
      }
    } catch (err) {
      logger.error('Error actualizando cotización:', err);
      cambios.push('Cotización: Error al actualizar (revisar manualmente)');
    }
  }

  // Cascada a requerimientos vinculados
  try {
    const reqQuery = query(collection(db, COLLECTIONS.REQUERIMIENTOS));
    const reqSnap = await getDocs(reqQuery);
    let reqsActualizados = 0;

    for (const reqDoc of reqSnap.docs) {
      const req = reqDoc.data();
      const vinculado =
        req.ventaId === ventaId ||
        req.ventaRelacionadaId === ventaId ||
        ((venta as any).cotizacionOrigenId && req.cotizacionId === (venta as any).cotizacionOrigenId) ||
        ((venta as any).cotizacionOrigenId && req.ventaRelacionadaId === (venta as any).cotizacionOrigenId);

      if (!vinculado) continue;
      if (req.estado === 'cancelado') continue;

      const reqProductos = req.productos as any[] || [];
      const reqProdIndex = reqProductos.findIndex((p: any) => p.productoId === productoIdAnterior);

      if (reqProdIndex === -1) continue;

      const reqProductosActualizados = [...reqProductos];
      reqProductosActualizados[reqProdIndex] = {
        ...reqProductos[reqProdIndex],
        productoId: nuevoProducto.id,
        sku: nuevoProducto.sku,
        marca: nuevoProducto.marca,
        nombreComercial: nuevoProducto.nombreComercial,
        presentacion: nuevoProducto.presentacion,
      };

      await updateDoc(doc(db, COLLECTIONS.REQUERIMIENTOS, reqDoc.id), {
        productos: reqProductosActualizados,
        ultimaEdicion: serverTimestamp(),
        editadoPor: userId
      });
      reqsActualizados++;
      cambios.push(`Requerimiento ${req.numeroRequerimiento}: Producto actualizado`);
    }

    if (reqsActualizados === 0) {
      cambios.push('Requerimientos: Sin requerimientos vinculados');
    }
  } catch (err) {
    logger.error('Error actualizando requerimientos:', err);
    cambios.push('Requerimientos: Error al actualizar (revisar manualmente)');
  }

  // Cascada a entregas
  try {
    const entregas = await entregaService.getByVenta(ventaId);
    for (const entrega of entregas) {
      const entregaProdIndex = entrega.productos.findIndex(p => p.productoId === productoIdAnterior);
      if (entregaProdIndex !== -1) {
        const entregaProductosActualizados = entrega.productos.map(p => {
          if (p.productoId === productoIdAnterior) {
            return {
              ...p,
              productoId: nuevoProducto.id,
              sku: nuevoProducto.sku,
              marca: nuevoProducto.marca,
              nombreComercial: nuevoProducto.nombreComercial,
              presentacion: nuevoProducto.presentacion,
            };
          }
          return p;
        });

        await updateDoc(doc(db, COLLECTIONS.ENTREGAS, entrega.id), {
          productos: entregaProductosActualizados
        });
        cambios.push(`Entrega ${entrega.codigo}: Producto actualizado`);
      }
    }
  } catch (err) {
    logger.error('Error actualizando entregas:', err);
    cambios.push('Entregas: Error al actualizar (revisar manualmente)');
  }

  return { cambios };
}

// ---------------------------------------------------------------------------
// Edición general de venta
// ---------------------------------------------------------------------------

/**
 * Editar una venta: productos (precio/cantidad), costos, datos de cliente, observaciones.
 * Respeta restricciones por estado y propaga cambios a entregas y tesorería.
 */
export async function editarVenta(
  venta: Venta,
  cambios: EditarVentaData,
  userId: string
): Promise<{ cambios: string[] }> {
  const ventaId = venta.id;
  const log: string[] = [];

  const estadosTerminales = ['entregada', 'cancelada', 'devuelta', 'devolucion_parcial'];
  if (estadosTerminales.includes(venta.estado)) {
    throw new Error(`No se puede editar una venta en estado "${venta.estado}"`);
  }

  const esEstadoTemprano = ['cotizacion', 'confirmada'].includes(venta.estado);
  const updates: Record<string, any> = {};

  // Cambios de productos
  if (cambios.productos && cambios.productos.length > 0) {
    const productosActualizados = [...venta.productos];

    for (const cp of cambios.productos) {
      const idx = productosActualizados.findIndex(p => p.productoId === cp.productoId);
      if (idx === -1) continue;

      const prod = productosActualizados[idx];

      if (cp.cantidad !== prod.cantidad && !esEstadoTemprano) {
        throw new Error(`No se puede cambiar cantidad en estado "${venta.estado}" (unidades ya asignadas)`);
      }

      const cambiosProd: string[] = [];
      if (cp.precioUnitario !== prod.precioUnitario) {
        cambiosProd.push(`precio S/ ${prod.precioUnitario.toFixed(2)} → S/ ${cp.precioUnitario.toFixed(2)}`);
      }
      if (cp.cantidad !== prod.cantidad) {
        cambiosProd.push(`cantidad ${prod.cantidad} → ${cp.cantidad}`);
      }

      if (cambiosProd.length > 0) {
        const nuevoSubtotal = cp.cantidad * cp.precioUnitario;
        productosActualizados[idx] = {
          ...prod,
          precioUnitario: cp.precioUnitario,
          cantidad: cp.cantidad,
          subtotal: nuevoSubtotal,
          ...(prod.costoTotalUnidades && {
            margenReal: ((nuevoSubtotal - prod.costoTotalUnidades) / nuevoSubtotal) * 100
          })
        };
        log.push(`${prod.marca} ${prod.nombreComercial}: ${cambiosProd.join(', ')}`);
      }
    }

    updates.productos = productosActualizados;
  }

  // Cambios financieros
  if (cambios.costoEnvio !== undefined && cambios.costoEnvio !== (venta.costoEnvio || 0)) {
    log.push(`Costo envío: S/ ${(venta.costoEnvio || 0).toFixed(2)} → S/ ${cambios.costoEnvio.toFixed(2)}`);
    updates.costoEnvio = cambios.costoEnvio;
  }
  if (cambios.descuento !== undefined && cambios.descuento !== (venta.descuento || 0)) {
    log.push(`Descuento: S/ ${(venta.descuento || 0).toFixed(2)} → S/ ${cambios.descuento.toFixed(2)}`);
    updates.descuento = cambios.descuento;
  }
  if (cambios.incluyeEnvio !== undefined && cambios.incluyeEnvio !== venta.incluyeEnvio) {
    log.push(`Envío gratis: ${venta.incluyeEnvio ? 'Sí' : 'No'} → ${cambios.incluyeEnvio ? 'Sí' : 'No'}`);
    updates.incluyeEnvio = cambios.incluyeEnvio;
  }

  // Cambios de cliente (solo en estados tempranos)
  if (esEstadoTemprano) {
    const camposCliente: Array<{ key: keyof EditarVentaData; ventaKey: string; label: string }> = [
      { key: 'nombreCliente', ventaKey: 'nombreCliente', label: 'Cliente' },
      { key: 'telefonoCliente', ventaKey: 'telefonoCliente', label: 'Teléfono' },
      { key: 'emailCliente', ventaKey: 'emailCliente', label: 'Email' },
      { key: 'direccionEntrega', ventaKey: 'direccionEntrega', label: 'Dirección' },
      { key: 'distrito', ventaKey: 'distrito', label: 'Distrito' },
      { key: 'provincia', ventaKey: 'provincia', label: 'Provincia' },
      { key: 'codigoPostal', ventaKey: 'codigoPostal', label: 'Código postal' },
      { key: 'referencia', ventaKey: 'referencia', label: 'Referencia' },
      { key: 'dniRuc', ventaKey: 'dniRuc', label: 'DNI/RUC' },
    ];

    for (const campo of camposCliente) {
      const nuevoValor = cambios[campo.key] as string | undefined;
      if (nuevoValor !== undefined && nuevoValor !== ((venta as any)[campo.ventaKey] || '')) {
        updates[campo.ventaKey] = nuevoValor;
        log.push(`${campo.label} actualizado`);
      }
    }
  }

  // Observaciones
  if (cambios.observaciones !== undefined && cambios.observaciones !== (venta.observaciones || '')) {
    updates.observaciones = cambios.observaciones;
    log.push('Observaciones actualizadas');
  }

  if (log.length === 0) {
    return { cambios: ['Sin cambios'] };
  }

  // Recalcular totales
  const productosFinales = updates.productos || venta.productos;
  const nuevoSubtotalPEN = productosFinales.reduce((sum: number, p: ProductoVenta) => sum + p.subtotal, 0);
  const descuento = updates.descuento ?? venta.descuento ?? 0;
  const costoEnvio = (updates.incluyeEnvio ?? venta.incluyeEnvio) ? 0 : (updates.costoEnvio ?? venta.costoEnvio ?? 0);
  const nuevoTotalPEN = nuevoSubtotalPEN - descuento + costoEnvio;

  updates.subtotalPEN = nuevoSubtotalPEN;
  updates.totalPEN = nuevoTotalPEN;

  // Recalcular márgenes
  const costoTotalPEN = venta.costoTotalPEN || 0;
  const gastosVentaPEN = venta.gastosVentaPEN || 0;
  const utilidadBrutaPEN = nuevoTotalPEN - costoTotalPEN;
  const utilidadNetaPEN = utilidadBrutaPEN - gastosVentaPEN;
  updates.utilidadBrutaPEN = utilidadBrutaPEN;
  updates.utilidadNetaPEN = utilidadNetaPEN;
  updates.margenBruto = nuevoTotalPEN > 0 ? (utilidadBrutaPEN / nuevoTotalPEN) * 100 : 0;
  updates.margenNeto = nuevoTotalPEN > 0 ? (utilidadNetaPEN / nuevoTotalPEN) * 100 : 0;
  updates.margenPromedio = updates.margenBruto;

  // Recalcular estado de pago
  const montoPagadoFinal = sumarMontoPagadoPEN(venta.pagos);
  const montoPendienteFinal = nuevoTotalPEN - montoPagadoFinal;

  updates.montoPagado = montoPagadoFinal;
  updates.montoPendiente = Math.max(0, montoPendienteFinal);
  updates.estadoPago = calcularEstadoPago(montoPagadoFinal, nuevoTotalPEN);

  if (montoPendienteFinal < 0) {
    updates.saldoAFavor = Math.abs(montoPendienteFinal);
    updates.tieneSobrepago = true;
  } else {
    updates.saldoAFavor = 0;
    updates.tieneSobrepago = false;
  }

  updates.ultimaEdicion = serverTimestamp();
  updates.editadoPor = userId;

  if (nuevoTotalPEN !== venta.totalPEN) {
    log.push(`Total: S/ ${venta.totalPEN.toFixed(2)} → S/ ${nuevoTotalPEN.toFixed(2)}`);
  }

  await updateDoc(doc(db, COLLECTION_NAME, ventaId), updates);

  // Cascade a entregas
  if (updates.productos && nuevoTotalPEN !== venta.totalPEN) {
    try {
      const entregas = await entregaService.getByVenta(ventaId);
      for (const entrega of entregas) {
        const nuevosProductosEntrega = entrega.productos.map(pe => {
          const productoActualizado = (updates.productos as ProductoVenta[]).find(
            p => p.productoId === pe.productoId
          );
          if (productoActualizado && (pe.precioUnitario !== productoActualizado.precioUnitario)) {
            return {
              ...pe,
              precioUnitario: productoActualizado.precioUnitario,
              subtotal: pe.cantidad * productoActualizado.precioUnitario
            };
          }
          return pe;
        });
        const nuevoSubtotalEntrega = nuevosProductosEntrega.reduce((sum, p) => sum + p.subtotal, 0);

        const entregaUpdates: Record<string, any> = {
          productos: nuevosProductosEntrega,
          subtotalPEN: nuevoSubtotalEntrega
        };
        if (entrega.montoPorCobrar && entrega.montoPorCobrar === entrega.subtotalPEN) {
          entregaUpdates.montoPorCobrar = nuevoSubtotalEntrega;
        }
        await updateDoc(doc(db, COLLECTIONS.ENTREGAS, entrega.id), entregaUpdates);
        log.push(`Entrega ${entrega.codigo} actualizada`);
      }
    } catch (err) {
      logger.error('Error actualizando entregas:', err);
      log.push('Entregas: revisar manualmente');
    }
  }

  // Cascade a tesorería
  if (nuevoTotalPEN !== venta.totalPEN) {
    try {
      const movimientos = await tesoreriaService.getMovimientos({});
      const movimientosVenta = movimientos.filter(
        m => (m.ventaId === ventaId || ((venta as any).cotizacionOrigenId && m.cotizacionId === (venta as any).cotizacionOrigenId)) &&
          (m.tipo === 'ingreso_venta' || m.tipo === 'ingreso_anticipo') && m.estado === 'ejecutado'
      );

      if (movimientosVenta.length === 1 && movimientosVenta[0].monto === venta.totalPEN) {
        await tesoreriaService.actualizarMovimiento(
          movimientosVenta[0].id,
          { monto: nuevoTotalPEN },
          userId
        );
        log.push(`Tesorería actualizada`);
      } else if (movimientosVenta.length === 1) {
        log.push(`Tesorería: movimiento con monto diferente (S/ ${movimientosVenta[0].monto.toFixed(2)}), revisar manualmente`);
      } else if (movimientosVenta.length > 1) {
        log.push(`Tesorería: ${movimientosVenta.length} movimientos, revisar manualmente`);
      }
    } catch (err) {
      logger.error('Error actualizando tesorería:', err);
      log.push('Tesorería: revisar manualmente');
    }
  }

  actividadService.registrar({
    tipo: 'venta_confirmada' as any,
    mensaje: `Venta ${venta.numeroVenta} editada: ${log.join(', ')}`,
    userId,
    displayName: userId,
    metadata: { entidadId: ventaId, entidadTipo: 'venta' }
  }).catch(() => {});

  return { cambios: log };
}

// ---------------------------------------------------------------------------
// Diagnóstico y corrección de asignaciones FEFO
// ---------------------------------------------------------------------------

/**
 * Diagnosticar ventas que fueron asignadas incorrectamente por el bug FEFO.
 */
export async function diagnosticarAsignacionesFEFO(): Promise<{
  ventasAfectadas: Array<{
    ventaId: string;
    numeroVenta: string;
    estado: string;
    cotizacionOrigenId: string;
    cliente: string;
    productos: Array<{
      productoId: string;
      sku: string;
      nombre: string;
      cantidadVenta: number;
      unidadesAsignadasActuales: string[];
      unidadesReservadasHuerfanas: string[];
    }>;
    corregible: boolean;
  }>;
  resumen: {
    total: number;
    corregibles: number;
    soloReporte: number;
  };
}> {
  logger.log('[DIAG-FEFO] Iniciando diagnóstico de asignaciones FEFO...');

  const estadosConAsignacion: EstadoVenta[] = ['asignada', 'en_entrega', 'despachada', 'entrega_parcial', 'entregada'];
  const ventasAfectadas: Array<any> = [];

  for (const estado of estadosConAsignacion) {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('estado', '==', estado)
    );
    const snap = await getDocs(q);

    for (const docSnap of snap.docs) {
      const venta = { id: docSnap.id, ...docSnap.data() } as any;

      if (!venta.cotizacionOrigenId) continue;

      const productosAfectados: Array<any> = [];

      for (const producto of (venta.productos || [])) {
        const unidadesReservadasDB = await unidadService.buscar({
          productoId: producto.productoId,
          estado: 'reservada'
        });

        const huerfanas = unidadesReservadasDB.filter(u => {
          const ext = u as any;
          const refs = [ext.reservadaPara, ext.reservadoPara].filter(Boolean);
          return refs.some((ref: string) =>
            ref === venta.id || ref === venta.cotizacionOrigenId
          );
        });

        if (huerfanas.length > 0) {
          productosAfectados.push({
            productoId: producto.productoId,
            sku: producto.sku,
            nombre: `${producto.marca} ${producto.nombreComercial}`,
            cantidadVenta: producto.cantidad,
            unidadesAsignadasActuales: producto.unidadesAsignadas || [],
            unidadesReservadasHuerfanas: huerfanas.map(u => u.id),
          });
        }
      }

      if (productosAfectados.length > 0) {
        const corregible = ['asignada', 'en_entrega', 'despachada', 'entrega_parcial'].includes(venta.estado);
        ventasAfectadas.push({
          ventaId: venta.id,
          numeroVenta: venta.numeroVenta,
          estado: venta.estado,
          cotizacionOrigenId: venta.cotizacionOrigenId,
          cliente: venta.nombreCliente,
          productos: productosAfectados,
          corregible,
        });
      }
    }
  }

  const corregibles = ventasAfectadas.filter(v => v.corregible).length;
  const resumen = {
    total: ventasAfectadas.length,
    corregibles,
    soloReporte: ventasAfectadas.length - corregibles,
  };

  logger.log(`[DIAG-FEFO] Diagnóstico completado:`);
  logger.log(`  - Ventas afectadas: ${resumen.total}`);
  logger.log(`  - Corregibles automáticamente: ${resumen.corregibles}`);
  logger.log(`  - Solo reporte (entregadas): ${resumen.soloReporte}`);

  for (const v of ventasAfectadas) {
    logger.log(`  [${v.corregible ? 'CORREGIBLE' : 'REPORTE'}] ${v.numeroVenta} (${v.estado}) - ${v.cliente}`);
    for (const p of v.productos) {
      logger.log(`    - ${p.sku}: ${p.unidadesReservadasHuerfanas.length} unidades huérfanas, ${p.unidadesAsignadasActuales.length} asignadas actualmente`);
    }
  }

  return { ventasAfectadas, resumen };
}

/**
 * Corregir una venta específica mal asignada por el bug FEFO.
 */
export async function corregirAsignacionFEFO(
  ventaId: string,
  userId: string
): Promise<{
  corregido: boolean;
  cambios: string[];
}> {
  const cambios: string[] = [];
  const ventaDoc = await getDoc(doc(db, COLLECTION_NAME, ventaId));
  if (!ventaDoc.exists()) {
    throw new Error(`Venta ${ventaId} no encontrada`);
  }

  const venta = { id: ventaDoc.id, ...ventaDoc.data() } as any;
  const estadosCorregibles = ['asignada', 'en_entrega', 'despachada', 'entrega_parcial'];

  if (!estadosCorregibles.includes(venta.estado)) {
    throw new Error(`Venta ${venta.numeroVenta} en estado '${venta.estado}' no es corregible automáticamente`);
  }

  if (!venta.cotizacionOrigenId) {
    throw new Error(`Venta ${venta.numeroVenta} no tiene cotizacionOrigenId`);
  }

  logger.log(`[CORR-FEFO] Corrigiendo ${venta.numeroVenta} (${venta.estado})...`);

  const tipoCambioVenta = await tipoCambioService.resolverTCVentaEstricto();

  const productosActualizados = [...venta.productos];
  let costoTotalPEN = 0;
  let huboCorrecciones = false;

  for (let i = 0; i < productosActualizados.length; i++) {
    const producto = productosActualizados[i];

    const unidadesReservadasDB = await unidadService.buscar({
      productoId: producto.productoId,
      estado: 'reservada'
    });

    const huerfanas = unidadesReservadasDB.filter(u => {
      const ext = u as any;
      const refs = [ext.reservadaPara, ext.reservadoPara].filter(Boolean);
      return refs.some((ref: string) =>
        ref === ventaId || ref === venta.cotizacionOrigenId
      );
    });

    if (huerfanas.length === 0) {
      costoTotalPEN += producto.costoTotalUnidades || 0;
      continue;
    }

    huboCorrecciones = true;
    const asignadasActuales = producto.unidadesAsignadas || [];

    const idsHuerfanas = new Set(huerfanas.map(u => u.id));
    const idsALiberar = asignadasActuales.filter((id: string) => !idsHuerfanas.has(id));

    logger.log(`[CORR-FEFO] Producto ${producto.sku}:`);
    logger.log(`  - Asignadas actuales: ${asignadasActuales.length}`);
    logger.log(`  - Huérfanas encontradas: ${huerfanas.length}`);
    logger.log(`  - A liberar: ${idsALiberar.length}`);

    const batch = writeBatch(db);

    // Liberar unidades FEFO incorrectas → disponible_peru
    for (const unidadId of idsALiberar) {
      const unidadRef = doc(db, COLLECTIONS.UNIDADES, unidadId);
      batch.update(unidadRef, {
        estado: 'disponible_peru',
        ventaId: null,
        fechaAsignacion: null,
        actualizadoPor: userId,
        fechaActualizacion: serverTimestamp()
      });
      cambios.push(`Liberada unidad ${unidadId} → disponible_peru`);
    }

    // Asignar unidades reservadas correctas → asignada_pedido
    const nuevasAsignaciones: AsignacionUnidad[] = [];
    const cantidadNecesaria = producto.cantidad;
    let asignadas = 0;

    for (const unidad of huerfanas) {
      if (asignadas >= cantidadNecesaria) break;

      const unidadRef = doc(db, COLLECTIONS.UNIDADES, unidad.id);
      batch.update(unidadRef, {
        estado: 'asignada_pedido',
        ventaId: ventaId,
        fechaAsignacion: serverTimestamp(),
        actualizadoPor: userId,
        fechaActualizacion: serverTimestamp()
      });

      const ctruPEN = calcularCtruPEN(unidad as any, tipoCambioVenta);

      nuevasAsignaciones.push({
        unidadId: unidad.id,
        productoId: unidad.productoId,
        sku: unidad.productoSKU,
        codigoUnidad: `${unidad.ordenCompraNumero}-${unidad.id.slice(-3)}`,
        ctru: ctruPEN,
        fechaVencimiento: unidad.fechaVencimiento
      });

      asignadas++;
      cambios.push(`Asignada unidad reservada ${unidad.id} → asignada_pedido`);
    }

    await batch.commit();

    const idsLiberados = new Set(idsALiberar);
    const idsMantenidos = asignadasActuales.filter((id: string) => !idsLiberados.has(id));
    const nuevosIds = nuevasAsignaciones.map(a => a.unidadId);
    const todosIds = [...idsMantenidos, ...nuevosIds];

    let costoProducto = 0;
    costoProducto += nuevasAsignaciones.reduce((sum, a) => sum + a.ctru, 0);
    for (const uid of idsMantenidos) {
      const unidad = await unidadService.getById(uid);
      if (unidad) {
        costoProducto += calcularCtruPEN(unidad as any, tipoCambioVenta);
      }
    }

    const margenReal = producto.subtotal > 0
      ? ((producto.subtotal - costoProducto) / producto.subtotal) * 100
      : 0;

    productosActualizados[i] = {
      ...producto,
      unidadesAsignadas: todosIds,
      costoTotalUnidades: costoProducto,
      margenReal,
    };

    costoTotalPEN += costoProducto;

    cambios.push(`Producto ${producto.sku}: ${idsALiberar.length} liberadas, ${nuevasAsignaciones.length} reservadas asignadas, costo: S/ ${costoProducto.toFixed(2)}`);
  }

  if (!huboCorrecciones) {
    cambios.push('No se encontraron productos con unidades huérfanas para corregir');
    return { corregido: false, cambios };
  }

  const utilidadBrutaPEN = venta.totalPEN - costoTotalPEN;
  const margenPromedio = venta.totalPEN > 0 ? (utilidadBrutaPEN / venta.totalPEN) * 100 : 0;

  await updateDoc(doc(db, COLLECTION_NAME, ventaId), {
    productos: productosActualizados,
    costoTotalPEN,
    utilidadBrutaPEN,
    margenPromedio,
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId,
  });

  cambios.push(`Venta ${venta.numeroVenta} actualizada: Costo S/ ${costoTotalPEN.toFixed(2)}, Margen ${margenPromedio.toFixed(1)}%`);

  logger.log(`[CORR-FEFO] Corrección completada para ${venta.numeroVenta}:`);
  cambios.forEach(c => logger.log(`  - ${c}`));

  return { corregido: true, cambios };
}

// ---------------------------------------------------------------------------
// Migración: corrección de canales
// ---------------------------------------------------------------------------

/**
 * Corregir canales de ventas existentes:
 * 1. Ventas con canal='directo' que tienen clienteId → busca el canal real del cliente
 * 2. Todas las ventas sin canalNombre → resuelve y guarda el nombre legible
 */
export async function corregirCanalesVentas(ventas: Venta[]): Promise<{
  corregidas: number;
  nombreAsignado: number;
  sinCambio: number;
  detalle: string[];
}> {
  const LEGACY_CANAL_NAMES: Record<string, string> = {
    mercado_libre: 'Mercado Libre',
    mercadolibre: 'Mercado Libre',
    directo: 'Directo',
    'venta directa': 'Venta Directa',
    otro: 'Otro'
  };

  const LEGACY_STRINGS_TO_FIX = new Set([
    'mercadolibre', 'mercado_libre', 'directo', 'otro', 'venta directa'
  ]);

  logger.log('[CORREGIR-CANALES] Iniciando corrección...');

  // Cargar canales de venta
  const canalesSnap = await getDocs(collection(db, COLLECTIONS.CANALES_VENTA));
  const canalesById = new Map<string, { id: string; nombre: string }>();
  const canalesByNombre = new Map<string, { id: string; nombre: string }>();
  canalesSnap.forEach(d => {
    const data = d.data();
    const entry = { id: d.id, nombre: data.nombre };
    canalesById.set(d.id, entry);
    if (data.codigo) canalesById.set(data.codigo, entry);
    canalesByNombre.set(data.nombre.toLowerCase(), entry);
  });

  // Cargar clientes
  const clientesSnap = await getDocs(collection(db, COLLECTIONS.CLIENTES));
  const clientesCanal = new Map<string, string>();
  clientesSnap.forEach(d => {
    const data = d.data();
    const canal = data.canalPrincipalActual || data.canalOrigen;
    if (canal) clientesCanal.set(d.id, canal);
  });

  let corregidas = 0;
  let nombreAsignado = 0;
  let sinCambio = 0;
  const detalle: string[] = [];

  const resolverCanalEntidad = (canal: string): { id: string; nombre: string } | null => {
    const byId = canalesById.get(canal);
    if (byId) return byId;
    const nombreOficial = LEGACY_CANAL_NAMES[canal.toLowerCase()];
    if (nombreOficial) {
      const byNombre = canalesByNombre.get(nombreOficial.toLowerCase());
      if (byNombre) return byNombre;
    }
    const byNombreDirecto = canalesByNombre.get(canal.toLowerCase());
    if (byNombreDirecto) return byNombreDirecto;
    return null;
  };

  const resolverNombre = (canal: string): string => {
    const entidad = resolverCanalEntidad(canal);
    if (entidad) return entidad.nombre;
    if (LEGACY_CANAL_NAMES[canal.toLowerCase()]) return LEGACY_CANAL_NAMES[canal.toLowerCase()];
    return canal;
  };

  const ventasParaActualizar: { id: string; updates: Record<string, any>; desc: string }[] = [];

  for (const venta of ventas) {
    const updates: Record<string, any> = {};
    let desc = `${venta.numeroVenta}:`;

    if (venta.canal === 'directo' && venta.clienteId) {
      const canalCliente = clientesCanal.get(venta.clienteId);
      if (canalCliente && canalCliente !== 'directo') {
        const entidad = resolverCanalEntidad(canalCliente);
        if (entidad) {
          updates.canal = entidad.id;
          updates.canalNombre = entidad.nombre;
          desc += ` canal "directo" → "${entidad.nombre}" (${entidad.id})`;
        } else {
          updates.canal = canalCliente;
          updates.canalNombre = resolverNombre(canalCliente);
          desc += ` canal "directo" → "${updates.canalNombre}" (${canalCliente})`;
        }
        corregidas++;
      } else if (!venta.canalNombre) {
        updates.canalNombre = 'Directo';
        desc += ` +nombre "Directo"`;
        nombreAsignado++;
      } else {
        sinCambio++;
        continue;
      }
    } else if (LEGACY_STRINGS_TO_FIX.has(venta.canal.toLowerCase())) {
      const entidad = resolverCanalEntidad(venta.canal);
      if (entidad && entidad.id !== venta.canal) {
        updates.canal = entidad.id;
        updates.canalNombre = entidad.nombre;
        desc += ` canal "${venta.canal}" → "${entidad.nombre}" (${entidad.id})`;
        corregidas++;
      } else {
        const nombreCorrecto = resolverNombre(venta.canal);
        if (!venta.canalNombre || venta.canalNombre !== nombreCorrecto) {
          updates.canalNombre = nombreCorrecto;
          desc += ` nombre "${venta.canalNombre || ''}" → "${nombreCorrecto}"`;
          nombreAsignado++;
        } else {
          sinCambio++;
          continue;
        }
      }
    } else if (!venta.canalNombre && venta.canal) {
      updates.canalNombre = resolverNombre(venta.canal);
      desc += ` +nombre "${updates.canalNombre}"`;
      nombreAsignado++;
    } else {
      sinCambio++;
      continue;
    }

    if (Object.keys(updates).length > 0) {
      ventasParaActualizar.push({ id: venta.id, updates, desc });
      detalle.push(desc);
    }
  }

  // Escribir en batches de 450 (margen de seguridad sobre el límite de 500)
  for (let i = 0; i < ventasParaActualizar.length; i += 450) {
    const batch = writeBatch(db);
    const chunk = ventasParaActualizar.slice(i, i + 450);
    for (const item of chunk) {
      batch.update(doc(db, COLLECTION_NAME, item.id), item.updates);
    }
    await batch.commit();
    logger.log(`[CORREGIR-CANALES] Batch ${Math.floor(i / 450) + 1}: ${chunk.length} ventas actualizadas`);
  }

  logger.log(`[CORREGIR-CANALES] Completado: ${corregidas} corregidas, ${nombreAsignado} nombres asignados, ${sinCambio} sin cambio`);
  return { corregidas, nombreAsignado, sinCambio, detalle };
}
