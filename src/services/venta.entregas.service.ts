/**
 * venta.entregas.service.ts
 *
 * Métodos de entrega de ventas extraídos de VentaService.
 * Contiene: marcarEnEntrega, marcarEntregada.
 *
 * Estas funciones son invocadas como delegados desde VentaService,
 * manteniendo la API pública intacta.
 */

import {
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type { Venta } from '../types/venta.types';
import { unidadService } from './unidad.service';
import { tesoreriaService } from './tesoreria.service';
import { metricasService } from './metricas.service';
import { ProductoService } from './producto.service';
import { logger } from '../lib/logger';

const COLLECTION_NAME = COLLECTIONS.VENTAS;

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
 * Ruta venta-SIN-despacho (retiro en tienda / cierre directo). El despacho con
 * Envío (Caso F) NO pasa por aquí: su motor (envio.despacho.service) confirma
 * unidades, cobra COD y cierra la venta. El call-site (Ventas) bloquea esta ruta
 * si la venta ya tiene un despacho F activo, evitando doble-conteo.
 *
 * FLUJO:
 * 1. Confirmar las unidades de la venta directamente (→ 'vendida')
 * 2. Actualizar estado de la venta → 'entregada'
 * 3. Reclasificar anticipos en Tesorería (pasivo → ingreso)
 * 4. Consumo automático de kit de empaque (costo + inventario)
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

  logger.log(`[marcarEntregada] Iniciando para venta ${venta.numeroVenta}`);

  // 1. Confirmar las unidades de la venta directamente.
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
        logger.error(`[marcarEntregada] Error confirmando unidades producto ${producto.sku}:`, error);
      }
    }
  }

  // 2. Actualizar estado de la venta
  const ventaRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(ventaRef, {
    estado: 'entregada',
    fechaEntrega: fechaEntregaReal
      ? Timestamp.fromDate(fechaEntregaReal)
      : serverTimestamp(),
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId
  });

  logger.log(`[marcarEntregada] Venta ${venta.numeroVenta} marcada como entregada`);

  // 3. Reclasificar anticipos: pasivo → ingreso real
  try {
    const reclasificados = await tesoreriaService.reclasificarAnticipos(
      id,
      (venta as any).cotizacionOrigenId,
      userId
    );
    if (reclasificados > 0) {
      logger.log(`[marcarEntregada] ${reclasificados} anticipo(s) reclasificados a ingreso_venta`);
    }
  } catch (reclasError) {
    logger.warn('[marcarEntregada] Error al reclasificar anticipos:', reclasError);
  }

  // 4. Consumo automatico de kit de empaque (si hay kits configurados)
  try {
    const { kitEmpaqueService } = await import('./kitEmpaque.service');
    // Calcular peso total del despacho
    let pesoTotalLb = 0;
    for (const prod of venta.productos) {
      const producto = await ProductoService.getById(prod.productoId);
      if (producto?.pesoLibras) {
        pesoTotalLb += producto.pesoLibras * prod.cantidad;
      }
    }

    if (pesoTotalLb > 0) {
      const kit = await kitEmpaqueService.seleccionarPorPeso(pesoTotalLb);
      if (kit) {
        const costoKit = await kitEmpaqueService.consumirKit(kit.id, userId);
        // Agregar costo del kit como costoVenta
        if (costoKit > 0) {
          const ventaRef2 = doc(db, COLLECTION_NAME, id);
          const costosVentaActuales = (venta as any).costosVenta || [];
          await updateDoc(ventaRef2, {
            costosVenta: [...costosVentaActuales, {
              id: `CV-KIT-${Date.now()}`,
              categoriaCostoId: 'kit_empaque',
              categoriaCostoNombre: 'Kit de Empaque',
              descripcion: `${kit.nombre} (${pesoTotalLb.toFixed(1)} lb)`,
              monto: costoKit,
              moneda: 'PEN',
              montoPEN: costoKit,
            }],
            costoVentaTotalPEN: ((venta as any).costoVentaTotalPEN || 0) + costoKit,
          });
          logger.log(`[marcarEntregada] Kit ${kit.codigo} consumido: S/${costoKit.toFixed(2)}`);
        }
      }
    }
  } catch (kitError) {
    logger.warn('[marcarEntregada] Error consumiendo kit de empaque:', kitError);
  }

  // 5. Actualizar metricas del Gestor Maestro (cliente y marcas)
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
    logger.warn('Error al actualizar métricas del Gestor Maestro:', metricasError);
  }
}
