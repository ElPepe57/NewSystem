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
import { buildProductoSnapshot } from '../utils/producto.helpers';

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

      const snapshot = buildProductoSnapshot({ ...producto, productoId: prod.productoId });
      const prodOrden: ProductoOrden = {
        ...snapshot,
        cantidad: prod.cantidad,
        costoUnitario: prod.costoUnitario,
        subtotal
      };
      if (snapshot.pesoLibras) {
        pesoTotalEstimadoLb += snapshot.pesoLibras * prod.cantidad;
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

    // Totals — S38-008: soporte unificado para cargos v2 (cargosOC[]) + legacy
    // Los campos legacy (impuestoCompraUSD, gastosEnvioUSD, otrosGastosUSD, descuentoUSD)
    // coexisten con las nuevas estructuras (cargosOC[], descuentosOC[], impuestosOC[]).
    // El wizard V2 usa las estructuras nuevas; flujos antiguos usan los campos legacy.
    // Sumamos AMBOS para no perder cargos cuando el wizard solo envía cargosOC[].

    // v2 — arrays estructurados
    const cargosV2 = (data.cargosOC ?? []).reduce((s, c) => s + (c.montoUSD || 0), 0);
    const descuentosV2 = (data.descuentosOC ?? []).reduce((s, d) => s + (d.montoUSD || 0), 0);
    const impuestosV2 = (data.impuestosOC ?? []).reduce((s, i) => s + (i.montoUSD || 0), 0);

    // Legacy — campos individuales (solo usar si NO vienen arrays, para evitar doble conteo)
    const impuestoLegacy = cargosV2 === 0 && impuestosV2 === 0
      ? (data.impuestoCompraUSD ?? 0)
      : 0;
    const gastosEnvioLegacy = cargosV2 === 0
      ? (data.costoEnvioProveedorUSD ?? 0)
      : 0;
    const otrosGastosLegacy = cargosV2 === 0
      ? (data.otrosGastosCompraUSD ?? 0)
      : 0;
    const descuentoLegacy = descuentosV2 === 0 ? (data.descuentoUSD || 0) : 0;

    // Agregados finales (para guardar en campos legacy por retrocompat de lectores)
    const impuesto = impuestoLegacy + impuestosV2;
    const gastosEnvio = gastosEnvioLegacy + cargosV2;
    const otrosGastos = otrosGastosLegacy;
    const descuento = descuentoLegacy + descuentosV2;

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
      // S39: sync bidireccional — courier = colaboradorTransporteNombre
      if (data.colaboradorTransporteNombre) nuevaOrden.courier = data.colaboradorTransporteNombre;
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
      // Resolver nombre: primero casilla (modelo nuevo), luego almacén (legacy)
      const { casillaCrudService } = await import('./casilla.crud.service');
      const casilla = await casillaCrudService.getById(data.almacenDestino);
      if (casilla) {
        nuevaOrden.nombreAlmacenDestino = casilla.nombre;
      } else {
        const almacen = await almacenService.getById(data.almacenDestino);
        if (almacen) nuevaOrden.nombreAlmacenDestino = almacen.nombre;
      }
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
          ...buildProductoSnapshot({ ...producto, productoId: prod.productoId }),
          cantidad: prod.cantidad,
          costoUnitario: prod.costoUnitario,
          subtotal
        });
      }

      updates.productos = productosOrden;
      updates.subtotalUSD = subtotalUSD;

      // S38-008: soporte v2 (cargosOC[]) + legacy unificado
      const cargosArr = data.cargosOC ?? orden.cargosOC ?? [];
      const descuentosArr = data.descuentosOC ?? orden.descuentosOC ?? [];
      const impuestosArr = data.impuestosOC ?? orden.impuestosOC ?? [];

      const cargosV2 = cargosArr.reduce((s, c) => s + (c.montoUSD || 0), 0);
      const descuentosV2 = descuentosArr.reduce((s, d) => s + (d.montoUSD || 0), 0);
      const impuestosV2 = impuestosArr.reduce((s, i) => s + (i.montoUSD || 0), 0);

      const impuestoLegacy = cargosV2 === 0 && impuestosV2 === 0
        ? (data.impuestoCompraUSD ?? orden.impuestoCompraUSD ?? 0)
        : 0;
      const gastosEnvioLegacy = cargosV2 === 0
        ? (data.costoEnvioProveedorUSD ?? orden.costoEnvioProveedorUSD ?? 0)
        : 0;
      const otrosGastosLegacy = cargosV2 === 0
        ? (data.otrosGastosCompraUSD ?? orden.otrosGastosCompraUSD ?? 0)
        : 0;
      const descuentoLegacy = descuentosV2 === 0
        ? (data.descuentoUSD !== undefined ? data.descuentoUSD : orden.descuentoUSD || 0)
        : 0;

      const impuestoUSD = impuestoLegacy + impuestosV2;
      const gastosEnvio = gastosEnvioLegacy + cargosV2;
      const otrosGastos = otrosGastosLegacy;
      const descuentoOC = descuentoLegacy + descuentosV2;

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
    if (data.costoEnvioProveedorUSD !== undefined) updates.costoEnvioProveedorUSD = data.costoEnvioProveedorUSD;
    if (data.otrosGastosCompraUSD !== undefined) updates.otrosGastosCompraUSD = data.otrosGastosCompraUSD;
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
    courier?: string;                  // Nombre del courier (string libre o derivado del colaborador)
    courierColaboradorId?: string;     // S38-011: ID del colaborador (Red Logística) si fue seleccionado
    fechaDespacho?: Date;
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

    // S38-011: cuando OC pasa a estados de tránsito/despacho, propagamos al Envío
    const estadosDespacho: EstadoOrden[] = ['en_proceso', 'en_transito', 'enviada', 'despachada'];
    const debeActivarEnvio = estadosDespacho.includes(nuevoEstado);

    if (nuevoEstado === 'enviada' && !orden.fechaEnviada) {
      updates.fechaEnviada = Timestamp.now();
    } else if (nuevoEstado === 'recibida_parcial') {
      if (!orden.fechaPrimeraRecepcion) updates.fechaPrimeraRecepcion = Timestamp.now();
    } else if (nuevoEstado === 'recibida' && !orden.fechaRecibida) {
      updates.fechaRecibida = Timestamp.now();
    }

    // S39: courier/tracking se graban para CUALQUIER estado de despacho (en_proceso, en_transito, despachada, enviada)
    if (debeActivarEnvio) {
      if (datos?.numeroTracking) updates.numeroTracking = datos.numeroTracking;
      if (datos?.courier) {
        updates.courier = datos.courier;
        updates.colaboradorTransporteNombre = datos.courier;
      }
      if (datos?.courierColaboradorId) {
        updates.colaboradorTransporteId = datos.courierColaboradorId;
      }
      if (!updates.fechaEnTransito && !orden.fechaEnTransito) {
        updates.fechaEnTransito = Timestamp.now();
      }
    }

    await updateDoc(doc(db, ORDENES_COLLECTION, id), updates);

    // S38-011: Sincronizar Envíos vinculados — si la OC se despacha,
    // los Envíos en borrador pasan a en_transito y heredan info del courier
    if (debeActivarEnvio) {
      try {
        const { envioCrudService } = await import('./envio.crud.service');
        // Buscar todos los envíos vinculados a esta OC en estado borrador
        const enviosVinculados = await envioCrudService.getByFiltros({
          ordenCompraId: id,
        });
        const enviosABorrador = enviosVinculados.filter(e => e.estado === 'borrador');
        for (const env of enviosABorrador) {
          const updatesEnvio: any = {
            estado: 'en_transito',
          };
          if (datos?.fechaDespacho) {
            updatesEnvio.fechaSalida = Timestamp.fromDate(datos.fechaDespacho);
          } else {
            updatesEnvio.fechaSalida = Timestamp.now();
          }
          if (datos?.numeroTracking) updatesEnvio.numeroTracking = datos.numeroTracking;
          if (datos?.courier) updatesEnvio.courier = datos.courier;
          // S38-011: vincular colaborador (Red Logística) al envío para reportes/métricas
          if (datos?.courierColaboradorId) updatesEnvio.colaboradorId = datos.courierColaboradorId;
          await updateDoc(doc(db, 'envios', env.id), updatesEnvio);
          logger.info(`Envío ${env.numeroEnvio} → en_transito (sync desde OC ${orden.numeroOrden})`);
        }
      } catch (envioErr: any) {
        // No bloquear el cambio de estado de la OC si falla el sync
        logger.error('Error al sincronizar Envíos vinculados (no bloqueante):', envioErr);
      }
    }
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
  colaboradorId?: string,
  subOrdenes?: import('../types/ordenCompra.types').SubOrdenCompra[]
): Promise<{ unidadesCreadas: number; envioId: string }> {
  const { writeBatch: createBatch } = await import('firebase/firestore');
  const { envioCrudService } = await import('./envio.crud.service');

  const orden = await getById(ocId);
  if (!orden) throw new Error('Orden no encontrada');

  // Si se pasaron sub-órdenes desde el modal de confirmación, usarlas
  if (subOrdenes && subOrdenes.length > 0) {
    orden.subOrdenes = subOrdenes;
  }

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
        casillaActualId: 'PROVEEDOR', // ubicacion virtual generica del proveedor
        pais: orden.paisOrigen || 'USA',
        estado: 'pedida',
        costoUnitarioUSD: prod.costoUnitario,
        tcCompra: orden.tcReferencial || orden.tcCompra || 0,
        ordenCompraId: ocId,
        ordenCompraNumero: orden.numeroOrden,
        // S38-010: Desnormalizar proveedor para filtros/reportes sin JOIN
        proveedorId: orden.proveedorId,
        proveedorNombre: orden.nombreProveedor,
        ...(orden.paisOrigen ? { proveedorPais: orden.paisOrigen } : {}),
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
  // S38-009: DDP se detecta por modoEntregaDetallado, no por un sentinel en destinoCasillaId.
  // El destino SIEMPRE es una casilla real (en DDP: la casilla Peru principal del cliente).
  const esDDP = orden.modoEntregaDetallado === 'ddp_directo';
  const ocUpdate: Record<string, unknown> = {
    estado: 'confirmada',
    inventarioGenerado: true,
    unidadesGeneradas: unidadIds,
    almacenDestino: destinoCasillaId,
    ...(orden.nombreAlmacenDestino ? {} : await (async () => {
      const { casillaCrudService } = await import('./casilla.crud.service');
      const cas = await casillaCrudService.getById(destinoCasillaId);
      if (cas) return { nombreAlmacenDestino: cas.nombre };
      const alm = await almacenService.getById(destinoCasillaId);
      return alm ? { nombreAlmacenDestino: alm.nombre } : {};
    })()),
    ultimaEdicion: now,
    editadoPor: userId,
  };
  // Persistir sub-órdenes si se configuraron en el modal de confirmación
  if (orden.subOrdenes && orden.subOrdenes.length > 0) {
    ocUpdate.subOrdenes = orden.subOrdenes;
  }
  batch.update(ocRef, ocUpdate);

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

  // Helper: construir EnvioUnidad[] desde unidadIds y productos
  const buildEnvioUnidades = (ids: string[], productos: typeof orden.productos): import('../types/envio.types').EnvioUnidad[] => {
    const result: import('../types/envio.types').EnvioUnidad[] = [];
    let idIdx = 0;
    for (const prod of productos) {
      for (let i = 0; i < prod.cantidad; i++) {
        if (idIdx < ids.length) {
          const envioUnidad: import('../types/envio.types').EnvioUnidad = {
            unidadId: ids[idIdx],
            productoId: prod.productoId,
            sku: prod.sku,
            codigoUnidad: ids[idIdx].slice(-6).toUpperCase(),
            estadoEnvio: 'pendiente',
          };
          if (prod.pesoLibras) envioUnidad.pesoLibras = prod.pesoLibras;
          result.push(envioUnidad);
          idIdx++;
        }
      }
    }
    return result;
  };

  if (orden.subOrdenes && orden.subOrdenes.length > 0) {
    // 3a. Multi-envio: one Envio T1 per sub-orden
    const subOrdenesActualizadas = [];
    let firstEnvioId: string | undefined;

    for (const subOrden of orden.subOrdenes) {
      const subUnidadIds: string[] = subOrden.productos.flatMap(
        (p) => unitsByProductoId[p.productoId] || []
      );

      const subEnvioUnidades = buildEnvioUnidades(subUnidadIds, subOrden.productos);

      const envioResult = await envioCrudService.crear({
        origenTipo: 'proveedor',
        origenProveedorId: orden.proveedorId,
        destinoCasillaId,
        colaboradorId: transporteColaboradorId,
        ordenCompraId: ocId,
        subOrdenId: subOrden.id,
        unidadesIds: subUnidadIds,
        unidadesDetalle: subEnvioUnidades,
        esDDP, // S38-009: sin casilla intermedia, proveedor entrega directo a destino
      }, userId);

      await heredarCargos(envioResult.id);

      // Vincular unidades con su envio y sub-orden
      const linkBatch = createBatch(db);
      for (const uid of subUnidadIds) {
        linkBatch.update(doc(db, 'unidades', uid), {
          envioId: envioResult.id,
          envioNumero: envioResult.numeroEnvio,
          subOrdenId: subOrden.id,
        });
      }
      await linkBatch.commit();

      subOrdenesActualizadas.push({
        ...subOrden,
        envioId: envioResult.id,
        envioNumero: envioResult.numeroEnvio,
      });
      if (!firstEnvioId) firstEnvioId = envioResult.id;
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
    const envioUnidades = buildEnvioUnidades(unidadIds, orden.productos);

    const envioResult = await envioCrudService.crear({
      origenTipo: 'proveedor',
      origenProveedorId: orden.proveedorId,
      destinoCasillaId,
      colaboradorId: transporteColaboradorId,
      ordenCompraId: ocId,
      unidadesIds: unidadIds,
      unidadesDetalle: envioUnidades,
      esDDP, // S38-009: sin casilla intermedia, proveedor entrega directo a destino
    }, userId);

    await heredarCargos(envioResult.id);

    // Vincular unidades con su envio
    const linkBatch = createBatch(db);
    for (const uid of unidadIds) {
      linkBatch.update(doc(db, 'unidades', uid), {
        envioId: envioResult.id,
        envioNumero: envioResult.numeroEnvio,
      });
    }
    await linkBatch.commit();

    envioId = envioResult.id;

    if (orden.cargosOC && orden.cargosOC.length > 0) {
      logger.info(`${orden.cargosOC.length} cargos OC heredados al Envio T1 como costosLanded`);
    }
    logger.success(`OC ${orden.numeroOrden} confirmada: ${unidadIds.length} unidades pedida + Envio T1 creado (${envioResult.numeroEnvio})`);
  }

  return {
    unidadesCreadas: unidadIds.length,
    envioId,
  };
}
