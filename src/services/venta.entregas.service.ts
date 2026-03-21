/**
 * venta.entregas.service.ts
 *
 * Métodos de entrega de ventas extraídos de VentaService.
 * Contiene: registrarEntregaParcial, marcarEnEntrega, marcarEntregada.
 *
 * Estas funciones son invocadas como delegados desde VentaService,
 * manteniendo la API pública intacta.
 */

import {
  collection,
  doc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type {
  Venta,
  EstadoEntregaProducto,
  EntregaParcial,
} from '../types/venta.types';
import { unidadService } from './unidad.service';
import { tesoreriaService } from './tesoreria.service';
import { metricasService } from './metricas.service';
import { entregaService } from './entrega.service';
import { ProductoService } from './producto.service';

const COLLECTION_NAME = COLLECTIONS.VENTAS;

/**
 * Registrar entrega parcial de productos.
 * Actualiza el estado de las unidades a 'entregada' y actualiza la venta.
 */
export async function registrarEntregaParcial(
  venta: Venta,
  userId: string,
  datos?: {
    direccionEntrega?: string;
    notasEntrega?: string;
    productosAEntregar?: Array<{ productoId: string; cantidad: number }>;
  }
): Promise<EntregaParcial> {
  const id = venta.id;

  if (venta.estado !== 'en_entrega' && venta.estado !== 'despachada' && venta.estado !== 'asignada') {
    throw new Error('Solo se pueden registrar entregas parciales para ventas asignadas o en entrega');
  }

  const batch = writeBatch(db);
  const productosEntregados: Array<{
    productoId: string;
    cantidad: number;
    unidadesIds: string[];
  }> = [];

  const productosAEntregar = datos?.productosAEntregar || venta.productos.map(p => ({
    productoId: p.productoId,
    cantidad: (p.unidadesAsignadas?.length || 0) - (p.cantidadEntregada || 0)
  }));

  for (const { productoId, cantidad } of productosAEntregar) {
    const producto = venta.productos.find(p => p.productoId === productoId);
    if (!producto || !producto.unidadesAsignadas) {
      continue;
    }

    const cantidadYaEntregada = producto.cantidadEntregada || 0;
    const cantidadDisponible = producto.unidadesAsignadas.length - cantidadYaEntregada;
    const cantidadAEntregar = Math.min(cantidad, cantidadDisponible);

    if (cantidadAEntregar <= 0) {
      continue;
    }

    const unidadesAEntregar = producto.unidadesAsignadas.slice(
      cantidadYaEntregada,
      cantidadYaEntregada + cantidadAEntregar
    );

    for (const unidadId of unidadesAEntregar) {
      const unidadRef = doc(db, COLLECTIONS.UNIDADES, unidadId);
      batch.update(unidadRef, {
        estado: 'entregada',
        fechaEntrega: serverTimestamp()
      });
    }

    productosEntregados.push({
      productoId,
      cantidad: cantidadAEntregar,
      unidadesIds: unidadesAEntregar
    });
  }

  const entregaParcial: EntregaParcial = {
    id: doc(collection(db, COLLECTIONS.ENTREGAS_PARCIALES)).id,
    fecha: Timestamp.now(),
    productosEntregados,
    direccionEntrega: datos?.direccionEntrega,
    notasEntrega: datos?.notasEntrega,
    registradoPor: userId
  };

  const productosActualizados = venta.productos.map(p => {
    const entregado = productosEntregados.find(pe => pe.productoId === p.productoId);
    if (!entregado) {
      return p;
    }

    const cantidadEntregadaTotal = (p.cantidadEntregada || 0) + entregado.cantidad;
    const cantidadPorEntregar = (p.unidadesAsignadas?.length || 0) - cantidadEntregadaTotal;

    let estadoEntrega: EstadoEntregaProducto = 'pendiente';
    if (cantidadEntregadaTotal > 0 && cantidadPorEntregar > 0) {
      estadoEntrega = 'parcial';
    } else if (cantidadPorEntregar === 0) {
      estadoEntrega = 'entregado';
    }

    return {
      ...p,
      cantidadEntregada: cantidadEntregadaTotal,
      cantidadPorEntregar,
      estadoEntrega
    };
  });

  const todosEntregados = productosActualizados.every(
    p => p.estadoEntrega === 'entregado' || !p.unidadesAsignadas?.length
  );

  const entregasParciales = (venta as any).entregasParciales || [];
  const ventaRef = doc(db, COLLECTION_NAME, id);
  batch.update(ventaRef, {
    productos: productosActualizados,
    entregasParciales: [...entregasParciales, entregaParcial],
    estado: todosEntregados ? 'entregada' : (venta.estado === 'despachada' ? 'despachada' : 'en_entrega'),
    ...(!todosEntregados && venta.estado !== 'en_entrega' && venta.estado !== 'despachada' && { fechaEnEntrega: serverTimestamp() }),
    ...(todosEntregados && { fechaEntrega: serverTimestamp() }),
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId
  });

  await batch.commit();

  return entregaParcial;
}

/**
 * Marcar una venta como en entrega (estado: asignada → en_entrega).
 */
export async function marcarEnEntrega(
  venta: Venta,
  userId: string,
  datos?: { direccionEntrega?: string; notasEntrega?: string }
): Promise<void> {
  const id = venta.id;

  if (venta.estado !== 'asignada') {
    throw new Error('Solo se puede poner en entrega ventas con inventario asignado');
  }

  const updates: any = {
    estado: 'en_entrega',
    fechaEnEntrega: serverTimestamp(),
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId
  };

  if (datos?.direccionEntrega) updates.direccionEntregaFinal = datos.direccionEntrega;
  if (datos?.notasEntrega) updates.notasEntrega = datos.notasEntrega;

  await updateDoc(doc(db, COLLECTION_NAME, id), updates);
}

/**
 * Marcar una venta como entregada.
 *
 * FLUJO:
 * 1. Completar entregas pendientes → crea GD y actualiza unidades a 'vendida'
 * 2. Si no hay entregas programadas, actualizar unidades directamente a 'vendida'
 * 3. Actualizar estado de la venta
 * 4. Reclasificar anticipos en Tesorería
 * 5. Actualizar métricas del Gestor Maestro
 */
export async function marcarEntregada(
  venta: Venta,
  userId: string,
  fechaEntregaReal?: Date
): Promise<void> {
  const id = venta.id;

  if (venta.estado !== 'en_entrega' && venta.estado !== 'despachada' && venta.estado !== 'asignada') {
    throw new Error('Estado inválido para marcar como entregada');
  }

  console.log(`[marcarEntregada] Iniciando para venta ${venta.numeroVenta}`);

  // 1. Completar todas las entregas pendientes de esta venta
  let entregasCompletadas = 0;
  let entregasPendientes: Awaited<ReturnType<typeof entregaService.getByVenta>> = [];

  try {
    const entregas = await entregaService.getByVenta(id);
    entregasPendientes = entregas.filter(
      e => e.estado === 'programada' || e.estado === 'en_camino' || e.estado === 'reprogramada'
    );
    console.log(`[marcarEntregada] Encontradas ${entregasPendientes.length} entregas pendientes`);

    for (const entrega of entregasPendientes) {
      try {
        console.log(`[marcarEntregada] Completando entrega ${entrega.codigo}...`);
        await entregaService.registrarResultado({
          entregaId: entrega.id,
          exitosa: true,
          notasEntrega: 'Completada automáticamente al marcar venta como entregada'
        }, userId);
        entregasCompletadas++;
        console.log(`[marcarEntregada] Entrega ${entrega.codigo} completada OK`);
      } catch (entregaError) {
        console.error(`[marcarEntregada] Error completando entrega ${entrega.codigo}:`, entregaError);
      }
    }
  } catch (entregasError) {
    console.error('[marcarEntregada] Error obteniendo entregas:', entregasError);
  }

  // 2. Si NO había entregas programadas, actualizar las unidades directamente
  if (entregasPendientes.length === 0) {
    console.log('[marcarEntregada] No había entregas, actualizando unidades directamente');
    for (const producto of venta.productos) {
      if (producto.unidadesAsignadas && producto.unidadesAsignadas.length > 0) {
        try {
          await unidadService.confirmarVentaUnidades(
            producto.unidadesAsignadas,
            venta.id,
            venta.numeroVenta,
            producto.subtotal || (producto.cantidad * producto.precioUnitario),
            userId
          );
        } catch (error) {
          console.error(`[marcarEntregada] Error confirmando unidades producto ${producto.sku}:`, error);
        }
      }
    }
  }

  // 3. Actualizar estado de la venta
  const ventaRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(ventaRef, {
    estado: 'entregada',
    fechaEntrega: fechaEntregaReal
      ? Timestamp.fromDate(fechaEntregaReal)
      : serverTimestamp(),
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId
  });

  console.log(`[marcarEntregada] Venta ${venta.numeroVenta} marcada como entregada. Entregas completadas: ${entregasCompletadas}`);

  // 4. Reclasificar anticipos: pasivo → ingreso real
  try {
    const reclasificados = await tesoreriaService.reclasificarAnticipos(
      id,
      (venta as any).cotizacionOrigenId,
      userId
    );
    if (reclasificados > 0) {
      console.log(`[marcarEntregada] ${reclasificados} anticipo(s) reclasificados a ingreso_venta`);
    }
  } catch (reclasError) {
    console.warn('[marcarEntregada] Error al reclasificar anticipos:', reclasError);
  }

  // 5. Actualizar métricas del Gestor Maestro (cliente y marcas)
  try {
    const marcaIds = new Map<string, string>();
    for (const producto of venta.productos) {
      const productoCompleto = await ProductoService.getById(producto.productoId);
      if (productoCompleto?.marcaId) {
        marcaIds.set(producto.sku, productoCompleto.marcaId);
      }
    }
    await metricasService.procesarVentaCompleta(venta, marcaIds);
  } catch (metricasError) {
    console.warn('Error al actualizar métricas del Gestor Maestro:', metricasError);
  }
}
