/**
 * ordenCompra.crud.service.ts
 *
 * Core CRUD for OrdenesCompra:
 *   getAll, getById, getByEstado, create, update, delete, cambiarEstado
 *
 * No payment or reception logic lives here.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import type {
  OrdenCompra,
  OrdenCompraFormData,
  EstadoOrden,
  ProductoOrden
} from '../types/ordenCompra.types';
import { ProductoService } from './producto.service';
import { almacenService } from './almacen.service';
import { requerimientoService } from './requerimiento.service';
import { actividadService } from './actividad.service';
import { ORDENES_COLLECTION, PROVEEDORES_COLLECTION, generateNumeroOrden } from './ordenCompra.shared';
import { getProveedorById } from './ordenCompra.proveedores.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the id of the most-frequent value in an array, or undefined. */
function mostFrequent(arr: string[]): string | undefined {
  if (arr.length === 0) return undefined;
  const freq: Record<string, number> = {};
  for (const v of arr) freq[v] = (freq[v] || 0) + 1;
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getAll(): Promise<OrdenCompra[]> {
  try {
    const q = query(
      collection(db, ORDENES_COLLECTION),
      orderBy('fechaCreacion', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as OrdenCompra));
  } catch (error: any) {
    logger.error('Error al obtener órdenes:', error);
    throw new Error('Error al cargar órdenes de compra');
  }
}

export async function getById(id: string): Promise<OrdenCompra | null> {
  try {
    const docSnap = await getDoc(doc(db, ORDENES_COLLECTION, id));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as OrdenCompra;
  } catch (error: any) {
    logger.error('Error al obtener orden:', error);
    throw new Error('Error al cargar orden');
  }
}

export async function getByEstado(estado: EstadoOrden): Promise<OrdenCompra[]> {
  try {
    const q = query(
      collection(db, ORDENES_COLLECTION),
      where('estado', '==', estado),
      orderBy('fechaCreacion', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as OrdenCompra));
  } catch (error: any) {
    logger.error('Error al obtener órdenes por estado:', error);
    throw new Error('Error al cargar órdenes');
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function create(
  data: OrdenCompraFormData,
  userId: string
): Promise<OrdenCompra> {
  try {
    // Proveedor
    const proveedorSnap = await getDoc(
      doc(db, PROVEEDORES_COLLECTION, data.proveedorId)
    );
    if (!proveedorSnap.exists()) throw new Error('Proveedor no encontrado');
    const proveedor = proveedorSnap.data() as any;

    // Productos y totales
    const productosOrden: ProductoOrden[] = [];
    let subtotalUSD = 0;
    const lineaNegocioIds: string[] = [];
    const lineaNegocioNombres: Record<string, string> = {};
    const paisesOrigen: string[] = [];

    for (const prod of data.productos) {
      const producto = await ProductoService.getById(prod.productoId);
      if (!producto) throw new Error(`Producto ${prod.productoId} no encontrado`);

      const subtotal = prod.cantidad * prod.costoUnitario;
      subtotalUSD += subtotal;

      productosOrden.push({
        productoId: prod.productoId,
        sku: producto.sku,
        marca: producto.marca,
        nombreComercial: producto.nombreComercial,
        presentacion: producto.presentacion,
        cantidad: prod.cantidad,
        costoUnitario: prod.costoUnitario,
        subtotal
      });

      if (producto.lineaNegocioId) {
        lineaNegocioIds.push(producto.lineaNegocioId);
        if (producto.lineaNegocioNombre) {
          lineaNegocioNombres[producto.lineaNegocioId] = producto.lineaNegocioNombre;
        }
      }
      if (producto.paisOrigen) paisesOrigen.push(producto.paisOrigen);
    }

    // Derive lineaNegocio and paisOrigen from product data
    const derivedLineaNegocioId = mostFrequent(lineaNegocioIds);
    const derivedLineaNegocioNombre = derivedLineaNegocioId
      ? lineaNegocioNombres[derivedLineaNegocioId]
      : undefined;
    const derivedPaisOrigen =
      mostFrequent(paisesOrigen) ?? (proveedor.pais as string | undefined);

    // Totals
    const impuesto = data.impuestoUSD || 0;
    const gastosEnvio = data.gastosEnvioUSD || 0;
    const otrosGastos = data.otrosGastosUSD || 0;
    const descuento = data.descuentoUSD || 0;
    const totalUSD = subtotalUSD + impuesto + gastosEnvio + otrosGastos - descuento;

    const numeroOrden = await generateNumeroOrden();

    const nuevaOrden: any = {
      numeroOrden,
      proveedorId: data.proveedorId,
      nombreProveedor: proveedor.nombre,
      productos: productosOrden,
      subtotalUSD,
      totalUSD,
      estado: 'borrador',
      estadoPago: 'pendiente',
      inventarioGenerado: false,
      creadoPor: userId,
      fechaCreacion: serverTimestamp()
    };

    if (impuesto > 0) nuevaOrden.impuestoUSD = impuesto;
    if (gastosEnvio > 0) nuevaOrden.gastosEnvioUSD = gastosEnvio;
    if (otrosGastos > 0) nuevaOrden.otrosGastosUSD = otrosGastos;
    if (descuento > 0) nuevaOrden.descuentoUSD = descuento;
    if (data.tcCompra) nuevaOrden.tcCompra = data.tcCompra;

    if (data.almacenDestino) {
      nuevaOrden.almacenDestino = data.almacenDestino;
      const almacen = await almacenService.getById(data.almacenDestino);
      if (almacen) nuevaOrden.nombreAlmacenDestino = almacen.nombre;
    }

    if (data.observaciones) nuevaOrden.observaciones = data.observaciones;

    const finalLineaNegocioId = data.lineaNegocioId || derivedLineaNegocioId;
    const finalLineaNegocioNombre = data.lineaNegocioNombre || derivedLineaNegocioNombre;
    const finalPaisOrigen = data.paisOrigen || derivedPaisOrigen;
    if (finalLineaNegocioId) {
      nuevaOrden.lineaNegocioId = finalLineaNegocioId;
      if (finalLineaNegocioNombre) nuevaOrden.lineaNegocioNombre = finalLineaNegocioNombre;
    }
    if (finalPaisOrigen) nuevaOrden.paisOrigen = finalPaisOrigen;

    if (data.requerimientoId) nuevaOrden.requerimientoId = data.requerimientoId;

    if (data.requerimientoIds && data.requerimientoIds.length > 0) {
      nuevaOrden.requerimientoIds = data.requerimientoIds;
      nuevaOrden.requerimientoNumeros = [];
      if (data.productosOrigen) {
        nuevaOrden.productosOrigen = data.productosOrigen;
        for (const prodOrden of productosOrden) {
          prodOrden.origenRequerimientos = data.productosOrigen
            .filter(o => o.productoId === prodOrden.productoId)
            .map(o => ({
              requerimientoId: o.requerimientoId,
              cotizacionId: o.cotizacionId,
              clienteNombre: o.clienteNombre,
              cantidad: o.cantidad
            }));
        }
      }
      if (!nuevaOrden.requerimientoId) {
        nuevaOrden.requerimientoId = data.requerimientoIds[0];
      }
    }

    const docRef = await addDoc(collection(db, ORDENES_COLLECTION), nuevaOrden);

    // Link requirements
    const reqIdsToLink =
      data.requerimientoIds && data.requerimientoIds.length > 0
        ? data.requerimientoIds
        : data.requerimientoId
        ? [data.requerimientoId]
        : [];

    const hasProductosOrigen = data.productosOrigen && data.productosOrigen.length > 0;

    for (const reqId of reqIdsToLink) {
      try {
        const req = await requerimientoService.getRequerimientoById(reqId);

        if (hasProductosOrigen) {
          const productosParaReq = data.productosOrigen!
            .filter(o => o.requerimientoId === reqId)
            .map(o => ({ productoId: o.productoId, cantidad: o.cantidad }));

          if (productosParaReq.length > 0) {
            await requerimientoService.vincularConOCParcial(
              reqId,
              docRef.id,
              numeroOrden,
              productosParaReq,
              userId
            );
          }
        } else {
          await requerimientoService.vincularConOC(reqId, docRef.id, numeroOrden, userId);
        }

        if (data.requerimientoIds?.length) {
          nuevaOrden.requerimientoNumeros.push(req?.numeroRequerimiento || '');
        }
      } catch (error) {
        logger.error('Error al vincular requerimiento con OC:', error);
      }
    }

    if (nuevaOrden.requerimientoNumeros?.length > 0) {
      await updateDoc(docRef, {
        requerimientoNumeros: nuevaOrden.requerimientoNumeros,
        requerimientoNumero: nuevaOrden.requerimientoNumeros[0]
      });
    }

    actividadService
      .registrar({
        tipo: 'oc_creada',
        mensaje: `OC ${numeroOrden} creada - ${proveedor.nombre} por $${totalUSD.toFixed(2)}`,
        userId,
        displayName: userId,
        metadata: {
          entidadId: docRef.id,
          entidadTipo: 'ordenCompra',
          monto: totalUSD,
          moneda: 'USD'
        }
      })
      .catch(() => {});

    return {
      id: docRef.id,
      ...nuevaOrden,
      fechaCreacion: Timestamp.now()
    } as OrdenCompra;
  } catch (error: any) {
    logger.error('Error al crear orden:', error);
    throw new Error(error.message || 'Error al crear orden de compra');
  }
}

export async function update(
  id: string,
  data: Partial<OrdenCompraFormData>,
  userId: string
): Promise<void> {
  try {
    const orden = await getById(id);
    if (!orden) throw new Error('Orden no encontrada');
    if (orden.estado !== 'borrador') {
      throw new Error('Solo se pueden editar órdenes en borrador');
    }

    const updates: any = {
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    };

    if (data.productos) {
      const productosOrden: ProductoOrden[] = [];
      let subtotalUSD = 0;

      for (const prod of data.productos) {
        const producto = await ProductoService.getById(prod.productoId);
        if (!producto) continue;

        const subtotal = prod.cantidad * prod.costoUnitario;
        subtotalUSD += subtotal;

        productosOrden.push({
          productoId: prod.productoId,
          sku: producto.sku,
          marca: producto.marca,
          nombreComercial: producto.nombreComercial,
          presentacion: producto.presentacion,
          cantidad: prod.cantidad,
          costoUnitario: prod.costoUnitario,
          subtotal
        });
      }

      updates.productos = productosOrden;
      updates.subtotalUSD = subtotalUSD;

      const impuestoUSD =
        data.impuestoUSD !== undefined ? data.impuestoUSD : orden.impuestoUSD || 0;
      const gastosEnvio =
        data.gastosEnvioUSD !== undefined ? data.gastosEnvioUSD : orden.gastosEnvioUSD || 0;
      const otrosGastos =
        data.otrosGastosUSD !== undefined ? data.otrosGastosUSD : orden.otrosGastosUSD || 0;
      const descuentoOC =
        data.descuentoUSD !== undefined ? data.descuentoUSD : orden.descuentoUSD || 0;
      updates.totalUSD = subtotalUSD + impuestoUSD + gastosEnvio + otrosGastos - descuentoOC;
    }

    if (data.proveedorId && data.proveedorId !== orden.proveedorId) {
      const proveedor = await getProveedorById(data.proveedorId);
      if (proveedor) {
        updates.proveedorId = data.proveedorId;
        updates.nombreProveedor = proveedor.nombre;
      }
    }

    if (data.almacenDestino && data.almacenDestino !== orden.almacenDestino) {
      const almacen = await almacenService.getById(data.almacenDestino);
      if (almacen) {
        updates.almacenDestino = data.almacenDestino;
        updates.nombreAlmacenDestino = almacen.nombre;
      }
    }

    if (data.impuestoUSD !== undefined) updates.impuestoUSD = data.impuestoUSD;
    if (data.gastosEnvioUSD !== undefined) updates.gastosEnvioUSD = data.gastosEnvioUSD;
    if (data.otrosGastosUSD !== undefined) updates.otrosGastosUSD = data.otrosGastosUSD;
    if (data.tcCompra !== undefined) updates.tcCompra = data.tcCompra;
    if (data.numeroTracking !== undefined) updates.numeroTracking = data.numeroTracking;
    if (data.courier !== undefined) updates.courier = data.courier;
    if (data.observaciones !== undefined) updates.observaciones = data.observaciones;

    // Re-derive lineaNegocioId and paisOrigen if products changed
    if (data.productos) {
      const lineaIds: string[] = [];
      const lineaNombres: Record<string, string> = {};
      const paises: string[] = [];
      for (const prod of data.productos) {
        const producto = await ProductoService.getById(prod.productoId);
        if (producto) {
          if (producto.lineaNegocioId) {
            lineaIds.push(producto.lineaNegocioId);
            if (producto.lineaNegocioNombre) {
              lineaNombres[producto.lineaNegocioId] = producto.lineaNegocioNombre;
            }
          }
          if (producto.paisOrigen) paises.push(producto.paisOrigen);
        }
      }
      const topLineaId = mostFrequent(lineaIds);
      if (topLineaId) {
        updates.lineaNegocioId = topLineaId;
        if (lineaNombres[topLineaId]) updates.lineaNegocioNombre = lineaNombres[topLineaId];
      }
      const topPais = mostFrequent(paises);
      if (topPais) updates.paisOrigen = topPais;
    }

    if (data.lineaNegocioId !== undefined) updates.lineaNegocioId = data.lineaNegocioId;
    if (data.lineaNegocioNombre !== undefined) updates.lineaNegocioNombre = data.lineaNegocioNombre;
    if (data.paisOrigen !== undefined) updates.paisOrigen = data.paisOrigen;

    if (data.tcCompra !== undefined || updates.totalUSD !== undefined) {
      const tc = data.tcCompra !== undefined ? data.tcCompra : orden.tcCompra || 0;
      const total = updates.totalUSD !== undefined ? updates.totalUSD : orden.totalUSD;
      if (tc > 0) updates.totalPEN = total * tc;
    }

    await updateDoc(doc(db, ORDENES_COLLECTION, id), updates);
  } catch (error: any) {
    logger.error('Error al actualizar orden:', error);
    throw new Error(error.message || 'Error al actualizar orden');
  }
}

export async function cambiarEstado(
  id: string,
  nuevoEstado: EstadoOrden,
  userId: string,
  datos?: {
    tcPago?: number;
    numeroTracking?: string;
    courier?: string;
    motivo?: string;
    observaciones?: string;
  }
): Promise<void> {
  try {
    const orden = await getById(id);
    if (!orden) throw new Error('Orden no encontrada');

    const updates: any = {
      estado: nuevoEstado,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    };

    if (nuevoEstado === 'enviada' && !orden.fechaEnviada) {
      updates.fechaEnviada = Timestamp.now();
    } else if (nuevoEstado === 'en_transito' && !orden.fechaEnTransito) {
      updates.fechaEnTransito = Timestamp.now();
      if (datos?.numeroTracking) updates.numeroTracking = datos.numeroTracking;
      if (datos?.courier) updates.courier = datos.courier;
    } else if (nuevoEstado === 'recibida_parcial') {
      if (!orden.fechaPrimeraRecepcion) updates.fechaPrimeraRecepcion = Timestamp.now();
    } else if (nuevoEstado === 'recibida' && !orden.fechaRecibida) {
      updates.fechaRecibida = Timestamp.now();
    }

    await updateDoc(doc(db, ORDENES_COLLECTION, id), updates);
  } catch (error: any) {
    logger.error('Error al cambiar estado:', error);
    throw new Error(error.message || 'Error al cambiar estado');
  }
}

export async function deleteOrden(id: string): Promise<void> {
  try {
    const orden = await getById(id);
    if (!orden) throw new Error('Orden no encontrada');

    const tieneInventario =
      (orden.unidadesGeneradas?.length ?? 0) > 0 ||
      (orden.recepcionesParciales?.length ?? 0) > 0 ||
      orden.inventarioGenerado === true;

    if (tieneInventario) {
      throw new Error(
        'No se puede eliminar una orden que ya generó inventario. Usa "Revertir Recepciones" primero.'
      );
    }

    const estadosPermitidos: EstadoOrden[] = ['borrador', 'enviada', 'en_transito', 'cancelada'];
    if (!estadosPermitidos.includes(orden.estado)) {
      throw new Error(`No se puede eliminar una orden en estado "${orden.estado}"`);
    }

    try {
      await requerimientoService.desvincularOCDeRequerimientos(id, orden.numeroOrden || '');
    } catch (e) {
      logger.warn('Error al desvincular OC de requerimientos (no-blocking):', e);
    }

    await deleteDoc(doc(db, ORDENES_COLLECTION, id));
  } catch (error: any) {
    logger.error('Error al eliminar orden:', error);
    throw new Error(error.message || 'Error al eliminar orden');
  }
}
