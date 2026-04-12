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
import { almacenService } from './casilla.service';
import { requerimientoService } from './requerimiento.service';
import { actividadService } from './actividad.service';
import { metricasService } from './metricas.service';
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

    let pesoTotalEstimadoLb = 0;

    for (const prod of data.productos) {
      const producto = await ProductoService.getById(prod.productoId);
      if (!producto) throw new Error(`Producto ${prod.productoId} no encontrado`);

      const subtotal = prod.cantidad * prod.costoUnitario;
      subtotalUSD += subtotal;

      const prodOrden: ProductoOrden = {
        productoId: prod.productoId,
        sku: producto.sku,
        marca: producto.marca,
        nombreComercial: producto.nombreComercial,
        presentacion: producto.presentacion,
        cantidad: prod.cantidad,
        costoUnitario: prod.costoUnitario,
        subtotal
      };
      if (producto.pesoLibras && producto.pesoLibras > 0) {
        prodOrden.pesoLibras = producto.pesoLibras;
        pesoTotalEstimadoLb += producto.pesoLibras * prod.cantidad;
      }
      productosOrden.push(prodOrden);

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
    const impuesto = data.impuestoCompraUSD ?? data.impuestoUSD ?? 0;
    const gastosEnvio = data.costoEnvioProveedorUSD ?? data.gastosEnvioUSD ?? 0;
    const otrosGastos = data.otrosGastosCompraUSD ?? data.otrosGastosUSD ?? 0;
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

    if (pesoTotalEstimadoLb > 0) nuevaOrden.pesoTotalEstimadoLb = Math.round(pesoTotalEstimadoLb * 100) / 100;
    if (impuesto > 0) nuevaOrden.impuestoCompraUSD = impuesto;
    if (gastosEnvio > 0) nuevaOrden.costoEnvioProveedorUSD = gastosEnvio;
    if (otrosGastos > 0) nuevaOrden.otrosGastosCompraUSD = otrosGastos;
    if (data.modoEntrega) nuevaOrden.modoEntrega = data.modoEntrega;
    if (data.fleteIncluidoEnPrecio) nuevaOrden.fleteIncluidoEnPrecio = data.fleteIncluidoEnPrecio;
    // Wizard V2 fields (Acuerdos 40-41)
    if (data.modoEntregaDetallado) nuevaOrden.modoEntregaDetallado = data.modoEntregaDetallado;
    if (data.quienPagaFlete) nuevaOrden.quienPagaFlete = data.quienPagaFlete;
    if (data.colaboradorTransporteId) {
      nuevaOrden.colaboradorTransporteId = data.colaboradorTransporteId;
      if (data.colaboradorTransporteNombre) nuevaOrden.colaboradorTransporteNombre = data.colaboradorTransporteNombre;
    }
    if (data.cargosOC && data.cargosOC.length > 0) nuevaOrden.cargosOC = data.cargosOC;
    if (data.descuentosOC && data.descuentosOC.length > 0) nuevaOrden.descuentosOC = data.descuentosOC;
    if (data.impuestosOC && data.impuestosOC.length > 0) nuevaOrden.impuestosOC = data.impuestosOC;
    if (descuento > 0) nuevaOrden.descuentoUSD = descuento;
    if (data.tcCompra) {
      nuevaOrden.tcCompra = data.tcCompra;
      nuevaOrden.tcReferencial = data.tcCompra; // Unificacion: tcReferencial = tcCompra al crear
    }

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

    if (data.subOrdenes && data.subOrdenes.length > 0) nuevaOrden.subOrdenes = data.subOrdenes;

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

    // Incrementar métricas del proveedor
    if (data.proveedorId && totalUSD > 0) {
      try {
        await metricasService.incrementarMetricasProveedorPorOC(data.proveedorId, { totalUSD });
      } catch (metricasError) {
        logger.warn('Error incrementando métricas proveedor (no bloquea):', metricasError);
      }
    }

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
        data.impuestoCompraUSD ?? data.impuestoUSD ?? orden.impuestoCompraUSD ?? orden.impuestoUSD ?? 0;
      const gastosEnvio =
        data.costoEnvioProveedorUSD ?? data.gastosEnvioUSD ?? orden.costoEnvioProveedorUSD ?? orden.gastosEnvioUSD ?? 0;
      const otrosGastos =
        data.otrosGastosCompraUSD ?? data.otrosGastosUSD ?? orden.otrosGastosCompraUSD ?? orden.otrosGastosUSD ?? 0;
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

    if (data.impuestoCompraUSD !== undefined) updates.impuestoCompraUSD = data.impuestoCompraUSD;
    else if (data.impuestoUSD !== undefined) updates.impuestoCompraUSD = data.impuestoUSD;
    if (data.costoEnvioProveedorUSD !== undefined) updates.costoEnvioProveedorUSD = data.costoEnvioProveedorUSD;
    else if (data.gastosEnvioUSD !== undefined) updates.costoEnvioProveedorUSD = data.gastosEnvioUSD;
    if (data.otrosGastosCompraUSD !== undefined) updates.otrosGastosCompraUSD = data.otrosGastosCompraUSD;
    else if (data.otrosGastosUSD !== undefined) updates.otrosGastosCompraUSD = data.otrosGastosUSD;
    if (data.modoEntrega !== undefined) updates.modoEntrega = data.modoEntrega;
    if (data.fleteIncluidoEnPrecio !== undefined) updates.fleteIncluidoEnPrecio = data.fleteIncluidoEnPrecio;
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

    // Archivar antes de eliminar
    const ocSnap = await getDoc(doc(db, ORDENES_COLLECTION, id));
    if (ocSnap.exists()) {
      await addDoc(collection(db, 'ordenesCompraArchivo'), {
        ...ocSnap.data(), ordenOriginalId: id, fechaArchivo: Timestamp.now(), motivoArchivo: 'eliminada'
      });
    }

    // Revertir métricas del proveedor
    if (orden.proveedorId && orden.totalUSD) {
      try {
        await metricasService.revertirMetricasProveedorPorOC(orden.proveedorId, { totalUSD: orden.totalUSD });
      } catch (metricasError) {
        logger.warn(`Error revirtiendo métricas proveedor ${orden.proveedorId} (no bloquea):`, metricasError);
      }
    }

    await deleteDoc(doc(db, ORDENES_COLLECTION, id));
  } catch (error: any) {
    logger.error('Error al eliminar orden:', error);
    throw new Error(error.message || 'Error al eliminar orden');
  }
}

// ─── REINGENIERIA: Confirmar OC (Acuerdo 6) ─────────────────────────────────

/**
 * Confirma una OC: crea N unidades en estado 'pedida' y un Envio T1 en 'borrador'.
 *
 * Acuerdo 6: Las unidades nacen al confirmar la OC, no al recibir.
 * Acuerdo 2: Toda OC pasa obligatoriamente por al menos 1 Envio.
 * Acuerdo 4: Estado OC pasa de 'borrador' a 'confirmada'.
 *
 * @param ocId - ID de la OC a confirmar
 * @param destinoCasillaId - Casilla destino para el Envio T1
 * @param colaboradorId - Colaborador transportador (viajero/courier) - opcional
 * @param userId - ID del usuario que confirma
 */
export async function confirmarOC(
  ocId: string,
  destinoCasillaId: string,
  userId: string,
  colaboradorId?: string
): Promise<{ unidadesCreadas: number; envioId: string }> {
  const { writeBatch: createBatch } = await import('firebase/firestore');
  const { envioCrudService } = await import('./envio.crud.service');

  const orden = await getById(ocId);
  if (!orden) throw new Error('Orden no encontrada');

  if (orden.estado !== 'borrador') {
    throw new Error('Solo se pueden confirmar ordenes en estado borrador');
  }

  const batch = createBatch(db);
  const now = Timestamp.now();
  const unidadIds: string[] = [];

  // Track units per productoId so sub-ordenes can map correctly
  const unitsByProductoId: Record<string, string[]> = {};

  // 1. Crear N unidades en estado 'pedida'
  for (const prod of orden.productos) {
    if (!unitsByProductoId[prod.productoId]) unitsByProductoId[prod.productoId] = [];

    for (let i = 0; i < prod.cantidad; i++) {
      const unidadRef = doc(collection(db, 'unidades'));
      const unidadData: Record<string, unknown> = {
        productoId: prod.productoId,
        productoSKU: prod.sku,
        productoNombre: prod.nombreComercial,
        lote: 'PENDIENTE',
        fechaVencimiento: Timestamp.fromDate(new Date('2099-12-31')), // placeholder
        casillaActualId: 'PROVEEDOR', // ubicacion virtual del proveedor
        pais: orden.paisOrigen || 'USA',
        estado: 'pedida',
        costoUnitarioUSD: prod.costoUnitario,
        tcCompra: orden.tcReferencial || orden.tcCompra || 0,
        ordenCompraId: ocId,
        ordenCompraNumero: orden.numeroOrden,
        fechaRecepcion: now, // placeholder — se actualiza al recibir
        movimientos: [],
        creadoPor: userId,
        fechaCreacion: now,
      };

      // Linea de negocio
      if (orden.lineaNegocioId) {
        unidadData.lineaNegocioId = orden.lineaNegocioId;
        if (orden.lineaNegocioNombre) unidadData.lineaNegocioNombre = orden.lineaNegocioNombre;
      }

      // Peso
      if (prod.pesoLibras) unidadData.pesoLibras = prod.pesoLibras;

      batch.set(unidadRef, unidadData);
      unidadIds.push(unidadRef.id);
      unitsByProductoId[prod.productoId].push(unidadRef.id);
    }
  }

  // 2. Actualizar OC a 'confirmada'
  const ocRef = doc(db, ORDENES_COLLECTION, ocId);
  batch.update(ocRef, {
    estado: 'confirmada',
    inventarioGenerado: true,
    unidadesGeneradas: unidadIds,
    ultimaEdicion: now,
    editadoPor: userId,
  });

  await batch.commit();

  // 3. Crear Envio(s) T1 en 'borrador'
  const transporteColaboradorId = orden.colaboradorTransporteId || colaboradorId;
  const metodoProrrateoMap: Record<string, string> = {
    por_valor: 'total_por_valor',
    por_peso: 'total_por_peso',
    por_cantidad: 'fijo_por_unidad',
  };

  // Helper: heredar cargosOC a un envio creado
  const heredarCargos = async (targetEnvioId: string) => {
    if (orden.cargosOC && orden.cargosOC.length > 0) {
      for (const cargo of orden.cargosOC) {
        await envioCrudService.agregarCostoLanded(targetEnvioId, {
          categoriaCostoId: `cargo-oc-${cargo.id}`,
          categoriaCostoNombre: cargo.concepto || 'Cargo OC',
          monto: cargo.montoUSD,
          moneda: 'USD',
          montoPEN: cargo.montoUSD * (orden.tcReferencial || orden.tcCompra || 1),
          tipoCambio: orden.tcReferencial || orden.tcCompra,
          metodoProrrateo: (metodoProrrateoMap[cargo.metodoProrrateo] || 'total_por_valor') as any,
          pagado: false,
        }, userId);
      }
    }
  };

  let envioId: string;

  if (orden.subOrdenes && orden.subOrdenes.length > 0) {
    // 3a. Multi-envio: one Envio T1 per sub-orden
    const subOrdenesActualizadas = [];
    let firstEnvioId: string | undefined;

    for (const subOrden of orden.subOrdenes) {
      // Collect unidad IDs for all products in this sub-orden.
      // Each productoId may appear in multiple sub-ordenes only if the same product
      // was split (unusual), so we consume units in order from the pool.
      const subUnidadIds: string[] = subOrden.productos.flatMap(
        (p) => unitsByProductoId[p.productoId] || []
      );

      const subEnvioId = await envioCrudService.crear({
        origenTipo: 'proveedor',
        origenProveedorId: orden.proveedorId,
        destinoCasillaId,
        colaboradorId: transporteColaboradorId,
        ordenCompraId: ocId,
        subOrdenId: subOrden.id,
        unidadesIds: subUnidadIds,
      }, userId);

      await heredarCargos(subEnvioId);

      subOrdenesActualizadas.push({ ...subOrden, envioId: subEnvioId });
      if (!firstEnvioId) firstEnvioId = subEnvioId;
    }

    // Persist envioIds back to the sub-ordenes array on the OC document
    await updateDoc(ocRef, { subOrdenes: subOrdenesActualizadas });

    envioId = firstEnvioId!;
    logger.info(`${orden.cargosOC?.length ?? 0} cargos OC heredados a ${orden.subOrdenes.length} Envios T1`);
    logger.success(
      `OC ${orden.numeroOrden} confirmada: ${unidadIds.length} unidades pedida + ${orden.subOrdenes.length} Envios T1 (sub-órdenes)`
    );
  } else {
    // 3b. Envio unico (comportamiento original)
    envioId = await envioCrudService.crear({
      origenTipo: 'proveedor',
      origenProveedorId: orden.proveedorId,
      destinoCasillaId,
      colaboradorId: transporteColaboradorId,
      ordenCompraId: ocId,
      unidadesIds: unidadIds,
    }, userId);

    await heredarCargos(envioId);

    if (orden.cargosOC && orden.cargosOC.length > 0) {
      logger.info(`${orden.cargosOC.length} cargos OC heredados al Envio T1 como costosLanded`);
    }
    logger.success(`OC ${orden.numeroOrden} confirmada: ${unidadIds.length} unidades pedida + Envio T1 creado`);
  }

  return {
    unidadesCreadas: unidadIds.length,
    envioId,
  };
}
