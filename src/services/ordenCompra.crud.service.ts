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
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { requiereAutorizacionSocio } from './autorizacionEgreso.helper';
import type {
  OrdenCompra,
  OrdenCompraFormData,
  EstadoOrden,
  ProductoOrden,
  ForecastSnapshot
} from '../types/ordenCompra.types';
import type { ComponenteCostoUnidad } from '../types/ctru.types';
import type { MetodoProrrateo, EstadoEnvio } from '../types/envio.types';
import type { MotivoCancelacionOC } from '../types/requerimiento.types';
import { ProductoService } from './producto.service';
import { requerimientoService } from './requerimiento.service';
import { actividadService } from './actividad.service';
import { metricasService } from './metricas.service';
import { COLLECTIONS } from '../config/collections';
import { ORDENES_COLLECTION, PROVEEDORES_COLLECTION, generateNumeroOrden } from './ordenCompra.shared';
import { getProveedorById } from './ordenCompra.proveedores.service';
import { buildProductoSnapshot } from '../utils/producto.helpers';
import { getCargosEfectivosOC } from '../utils/ordenCompra.helpers';

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
      // Lente 2 · pass-through del forecast congelado en la UI (retrospectivo · NO toca costo/CTRU).
      if (prod.forecastSnapshot) prodOrden.forecastSnapshot = prod.forecastSnapshot;
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

    // Fase A · v2-puro: el costo de cabecera de la OC = arrays v2 (cargosOC/descuentosOC/impuestosOC), única fuente.
    const cargosV2 = (data.cargosOC ?? []).reduce((s, c) => s + (c.montoUSD || 0), 0);
    const descuentosV2 = (data.descuentosOC ?? []).reduce((s, d) => s + (d.montoUSD || 0), 0);
    const impuestosV2 = (data.impuestosOC ?? []).reduce((s, i) => s + (i.montoUSD || 0), 0);

    const totalUSD = subtotalUSD + cargosV2 + impuestosV2 - descuentosV2;

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
    // S41 Bloque 5 — Deudor alternativo: persistir solo si difiere del proveedor default
    if (data.deudorTipo === 'colaborador' && data.deudorId) {
      nuevaOrden.deudorId = data.deudorId;
      nuevaOrden.deudorNombre = data.deudorNombre ?? '';
      nuevaOrden.deudorTipo = 'colaborador';
    }
    // S42af — Flag "Recojo en origen" (al confirmar, envío y unidades nacen recibidos)
    if (data.recojoEnOrigen) {
      nuevaOrden.recojoEnOrigen = true;
    }
    if (data.tcCompra) {
      nuevaOrden.tcCompra = data.tcCompra;
      nuevaOrden.tcReferencial = data.tcCompra; // Unificacion: tcReferencial = tcCompra al crear
    }

    if (data.almacenDestino) {
      nuevaOrden.almacenDestino = data.almacenDestino;
      // Resolver nombre desde la casilla (única fuente de verdad).
      const { casillaCrudService } = await import('./casilla.crud.service');
      const casilla = await casillaCrudService.getById(data.almacenDestino);
      if (casilla) nuevaOrden.nombreAlmacenDestino = casilla.nombre;
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

      // Lente 2 · preservar el forecast congelado al reescribir el array de productos:
      // usar el snapshot fresco que trae la edición o, si no viene, el ya guardado en la OC
      // (NO borrarlo · simétrico al pass-through de create · off money-path).
      const snapshotsPrevios = new Map<string, ForecastSnapshot>();
      for (const p of orden.productos) {
        if (p.forecastSnapshot) snapshotsPrevios.set(p.productoId, p.forecastSnapshot);
      }

      for (const prod of data.productos) {
        const producto = await ProductoService.getById(prod.productoId);
        if (!producto) continue;

        const subtotal = prod.cantidad * prod.costoUnitario;
        subtotalUSD += subtotal;

        const prodOrden: ProductoOrden = {
          ...buildProductoSnapshot({ ...producto, productoId: prod.productoId }),
          cantidad: prod.cantidad,
          costoUnitario: prod.costoUnitario,
          subtotal
        };
        const snap = prod.forecastSnapshot ?? snapshotsPrevios.get(prod.productoId);
        if (snap) prodOrden.forecastSnapshot = snap;
        productosOrden.push(prodOrden);
      }

      updates.productos = productosOrden;
      updates.subtotalUSD = subtotalUSD;

      // Fase A · v2-puro: el costo de cabecera = arrays v2 (única fuente).
      const cargosV2 = (data.cargosOC ?? orden.cargosOC ?? []).reduce((s, c) => s + (c.montoUSD || 0), 0);
      const descuentosV2 = (data.descuentosOC ?? orden.descuentosOC ?? []).reduce((s, d) => s + (d.montoUSD || 0), 0);
      const impuestosV2 = (data.impuestosOC ?? orden.impuestosOC ?? []).reduce((s, i) => s + (i.montoUSD || 0), 0);

      updates.totalUSD = subtotalUSD + cargosV2 + impuestosV2 - descuentosV2;
    }

    if (data.proveedorId && data.proveedorId !== orden.proveedorId) {
      const proveedor = await getProveedorById(data.proveedorId);
      if (proveedor) {
        updates.proveedorId = data.proveedorId;
        updates.nombreProveedor = proveedor.nombre;
      }
    }

    if (data.almacenDestino && data.almacenDestino !== orden.almacenDestino) {
      const { casillaCrudService } = await import('./casilla.crud.service');
      const casilla = await casillaCrudService.getById(data.almacenDestino);
      if (casilla) {
        updates.almacenDestino = data.almacenDestino;
        updates.nombreAlmacenDestino = casilla.nombre;
      }
    }

    // Fase A · persistir los arrays v2 editados (gap-edit-path: antes el total se
    // recomputaba pero los arrays nunca se escribían → doc quedaba desincronizado).
    if (data.cargosOC !== undefined) updates.cargosOC = data.cargosOC;
    if (data.descuentosOC !== undefined) updates.descuentosOC = data.descuentosOC;
    if (data.impuestosOC !== undefined) updates.impuestosOC = data.impuestosOC;
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

/**
 * CANCELACION_OC · F5 · PREVIEW de las consecuencias (NO muta nada).
 *
 * Lee la OC y COMPUTA, sin escribir, lo que `cambiarEstado('cancelada')` haría:
 * libera reservas · borra unidades 'pedida' · revierte la deuda en la CC del
 * proveedor · cancela los envíos T1 cancelables. Es la fuente de verdad del cuerpo
 * del `CancelarOCModal` (typed-confirm) → lo que el usuario ve == lo que va a pasar.
 *
 * Espeja EXACTAMENTE los criterios del motor:
 *  - `unidadesPedidas` / `reservasAfectadas`: query unidades por `ordenCompraId` en
 *    estado EXACTO 'pedida' (el mismo guard de `revertirFisicoOC`). De esas, cuántas
 *    tienen reserva (mismo triple-check `reserva || reservadaPara || reservadoPara`).
 *  - `deudaUSD`: el `debito_oc` REAL de esta OC (mismo lookup que `revertirDeudaOC`),
 *    fallback a `orden.totalUSD`. SOLO si la OC era firme (un borrador no tiene deuda).
 *  - `enviosCancelables` / `enviosNoCancelables`: por `ordenCompraId`, mismo corte
 *    ('borrador'/'confirmado' = cancelable · resto = ya va a llegar → devolución).
 *  - `tienePago` / `refundUSD`: la OC fue pagada → el proveedor te deberá ese reembolso.
 *  - `esRecibida`: tiene unidades en estado ≠ 'pedida' (inventario real) → ADVERTIR que
 *    eso NO se cancela, es devolución (§1 del spec).
 *
 * Best-effort: cada bloque de lectura está aislado · si una query falla, el campo cae a
 * su default y la preview sigue (nunca tira · el modal igual debe poder abrir).
 *
 * @returns objeto con las consecuencias computadas (todo en 0 / false si no aplica).
 */
export interface PreviewCancelacionOC {
  /** Unidades en estado EXACTO 'pedida' que se borrarían. */
  unidadesPedidas: number;
  /** De esas 'pedida', cuántas tienen una reserva que se liberaría. */
  reservasAfectadas: number;
  /** Monto del debito_oc que se revertiría en la CC del proveedor (0 si la OC era borrador). */
  deudaUSD: number;
  /** ¿La OC era firme (tenía debito_oc que revertir)? */
  ocEraFirme: boolean;
  /** Envíos T1 'borrador'/'confirmado' que se cancelarían. */
  enviosCancelables: number;
  /** Envíos T1 ya en camino/recibidos que NO se cancelan (derivan a devolución). */
  enviosNoCancelables: number;
  /** ¿La OC tenía pagos registrados / estadoPago ≠ pendiente? */
  tienePago: boolean;
  /** Reembolso que el proveedor te deberá si la OC estaba pagada. */
  refundUSD: number;
  /** ¿La OC tiene unidades ya recibidas (inventario real · NO se cancela · es devolución)? */
  esRecibida: boolean;
}

export async function previewCancelacionOC(orden: OrdenCompra): Promise<PreviewCancelacionOC> {
  const ocEraFirme = orden.estado !== 'borrador';

  const preview: PreviewCancelacionOC = {
    unidadesPedidas: 0,
    reservasAfectadas: 0,
    deudaUSD: 0,
    ocEraFirme,
    enviosCancelables: 0,
    enviosNoCancelables: 0,
    tienePago: false,
    refundUSD: 0,
    esRecibida: false,
  };

  // ── Físico: unidades 'pedida' + reservas + ¿hay inventario recibido? ──
  // Espeja revertirFisicoOC: SOLO 'pedida' se borra · cualquier otro estado es inventario
  // real → esRecibida=true (territorio de devolución).
  try {
    const idsGenerados = orden.unidadesGeneradas || [];
    for (const unidadId of idsGenerados) {
      const snap = await getDoc(doc(db, COLLECTIONS.UNIDADES, unidadId));
      if (!snap.exists()) continue;
      const unidad = snap.data() as {
        estado?: string;
        reserva?: unknown;
        reservadaPara?: string;
        reservadoPara?: string;
      };
      if (unidad.estado === 'pedida') {
        preview.unidadesPedidas++;
        const tieneReserva = !!unidad.reserva || !!unidad.reservadaPara || !!unidad.reservadoPara;
        if (tieneReserva) preview.reservasAfectadas++;
      } else {
        // Inventario real (recibido/arribado/asignado/…) → NO se cancela · es devolución.
        preview.esRecibida = true;
      }
    }
  } catch (fisicoErr) {
    logger.warn(
      `[CANCELACION_OC] preview · no se pudo leer el físico de la OC ${orden.numeroOrden || orden.id}:`,
      fisicoErr,
    );
  }

  // ── Deuda: el debito_oc REAL (solo si la OC era firme · un borrador no lo tiene). ──
  if (ocEraFirme && orden.proveedorId) {
    preview.deudaUSD = orden.totalUSD || 0;
    try {
      const { cuentaCorrienteService } = await import('./cuentaCorriente.service');
      const movsOC = await cuentaCorrienteService.getMovimientosByFiltros({
        refDocumentoId: orden.id,
        tipoMovimiento: 'debito_oc',
      });
      const debitoReal = movsOC.find((m) => m.tipo === 'debito_oc');
      if (debitoReal) preview.deudaUSD = debitoReal.monto;
    } catch (deudaErr) {
      logger.warn(
        `[CANCELACION_OC] preview · no se pudo leer el debito_oc de la OC ${orden.numeroOrden || orden.id} · uso totalUSD:`,
        deudaErr,
      );
    }
  }

  // ── Pago: ¿la OC fue pagada? → el proveedor te deberá un reembolso. ──
  try {
    const { getPagosOC } = await import('./cuentaCorriente.adaptadores');
    const pagos = await getPagosOC(orden.id);
    const totalPagado = pagos.reduce((s, p) => s + (p.montoUSD || 0), 0);
    preview.tienePago =
      pagos.length > 0 || (!!orden.estadoPago && orden.estadoPago !== 'pendiente');
    preview.refundUSD = totalPagado;
  } catch (pagoErr) {
    logger.warn(
      `[CANCELACION_OC] preview · no se pudo verificar el pago de la OC ${orden.numeroOrden || orden.id}:`,
      pagoErr,
    );
  }

  // ── Envíos: cancelables ('borrador'/'confirmado') vs ya en camino (devolución). ──
  try {
    const { envioCrudService } = await import('./envio.crud.service');
    const enviosDeOC = await envioCrudService.getByFiltros({ ordenCompraId: orden.id });
    const CANCELABLES: EstadoEnvio[] = ['borrador', 'confirmado'];
    for (const envio of enviosDeOC) {
      if (envio.estado === 'cancelada') continue; // idempotencia
      if (CANCELABLES.includes(envio.estado)) preview.enviosCancelables++;
      else preview.enviosNoCancelables++;
    }
  } catch (envioErr) {
    logger.warn(
      `[CANCELACION_OC] preview · no se pudieron leer los envíos de la OC ${orden.numeroOrden || orden.id}:`,
      envioErr,
    );
  }

  return preview;
}

/**
 * CANCELACION_OC · F4 · REVERSA DE ENVÍO.
 *
 * Al confirmar una OC, `confirmarOC` genera 1 o varios Envíos T1 vinculados por
 * `ordenCompraId` (1 por sub-orden si la OC es consolidada · 1 en el caso normal).
 * Si la OC se cancela y nadie cancela esos envíos, quedan VIVOS apuntando a una
 * OC cancelada (un T1 fantasma que infla pendientes/recepción).
 *
 * Esta función busca los envíos de la OC (query canónica `getByFiltros({ ordenCompraId })`,
 * la MISMA que el sync de despacho usa en `cambiarEstado`) y aplica el corte clave
 * del modelo ("¿la mercadería va a llegar?"):
 *  - Envío CANCELABLE ('borrador' / 'confirmado' · aún no salió) → `envioCrudService.cancelar`.
 *    Es la lista que el propio `envioCrudService.cancelar` permite (envio.crud:1557).
 *  - Envío NO cancelable ('en_transito' / 'retenida_aduana' / 'recibida_*' / etc. · ya en
 *    camino o recibido) → NO se toca · se LOGUEA un warning para derivar a DEVOLUCIÓN
 *    (la mercadería ya va a llegar → no es cancelación, es otro flujo · §1 del spec).
 *
 * Robusto a múltiples envíos: error por-envío NO frena el loop (se captura y loguea).
 *
 * No bloqueante en el caller: si falla, la cancelación de la OC queda aplicada igual.
 *
 * @returns `{ enviosCancelados, enviosNoCancelables }`. Si la OC no generó envíos
 *   (ej. era borrador · `confirmarOC` no corrió), retorna ambos en 0 (no-op).
 */
export async function cancelarEnviosDeOC(
  ordenId: string,
  motivo: string | undefined,
  userId: string,
): Promise<{ enviosCancelados: number; enviosNoCancelables: number }> {
  const { envioCrudService } = await import('./envio.crud.service');

  // Query canónica · MISMA que el sync de despacho de `cambiarEstado` (envíos por OC).
  const enviosDeOC = await envioCrudService.getByFiltros({ ordenCompraId: ordenId });

  if (enviosDeOC.length === 0) {
    return { enviosCancelados: 0, enviosNoCancelables: 0 };
  }

  // Estados que `envioCrudService.cancelar` ACEPTA (envio.crud:1557). Cualquier otro
  // ('en_transito', 'retenida_aduana', 'recibida_parcial', 'recibida_completa', ...) =
  // ya en camino/recibido → derivar a devolución, NO cancelar.
  const CANCELABLES: EstadoEnvio[] = ['borrador', 'confirmado'];

  let enviosCancelados = 0;
  let enviosNoCancelables = 0;

  for (const envio of enviosDeOC) {
    // Un envío ya cancelado no cuenta como "no cancelable a revisar" (idempotencia).
    if (envio.estado === 'cancelada') continue;

    if (CANCELABLES.includes(envio.estado)) {
      try {
        await envioCrudService.cancelar(envio.id, motivo || 'OC cancelada', userId);
        enviosCancelados++;
      } catch (envErr) {
        // No frenar el loop: otros envíos de la misma OC deben intentarse igual.
        logger.error(
          `[CANCELACION_OC] ⚠️ FALLÓ cancelar el envío ${envio.numeroEnvio || envio.id} ` +
            `(estado ${envio.estado}) de la OC ${ordenId} (no bloqueante · revisar manualmente):`,
          envErr,
        );
      }
    } else {
      enviosNoCancelables++;
      logger.warn(
        `[CANCELACION_OC] Envío ${envio.numeroEnvio || envio.id} en estado '${envio.estado}' ` +
          `· ya en camino/recibido · NO se cancela · revisar para DEVOLUCIÓN (la mercadería ya va a llegar).`,
      );
    }
  }

  return { enviosCancelados, enviosNoCancelables };
}

/**
 * CANCELACION_OC · F3a · REVERSA FINANCIERA (deuda).
 *
 * Al confirmar una OC, `confirmarOC` registra en la CC del proveedor un movimiento
 * `debito_oc` por `orden.totalUSD` ("le DEBÉS el total de la OC"). Si la OC se
 * cancela, esa deuda queda VIVA → **deuda fantasma**. Esta función emite el
 * movimiento INVERSO: un crédito dedicado `reversa_debito_oc` que neutraliza el
 * débito original.
 *
 * Detalles de diseño:
 *  - **Lookup de la CC**: EXACTAMENTE el mismo que `confirmarOC` →
 *    `entidadId: orden.proveedorId`, `tipo: 'proveedor'`, `entidadNombre:
 *    orden.nombreProveedor`. La CC no se referencia por id en la OC: el id es
 *    determinístico `proveedor_{proveedorId}`.
 *  - **Tipo dedicado** (no `ajusteManual`): el modelo de saldo clasifica por
 *    DIRECCIÓN (`esCredito` lee de `TIPOS_CREDITO`), no por un switch hardcodeado
 *    por tipo. Agregar `reversa_debito_oc` como crédito basta para que reste del
 *    saldo · más trazable e idempotente que un ajuste genérico.
 *  - **Monto**: se lee el `debito_oc` REAL de esta OC (maneja OCs editadas cuyo
 *    `totalUSD` cambió después de confirmar). Fallback a `orden.totalUSD` (lo que
 *    `confirmarOC` usó) si no se encuentra el movimiento.
 *  - **Idempotencia**: `idempotencyKey: cancelar_oc_{ocId}` → re-cancelar NO
 *    duplica la reversa (mismo patrón que `confirmar_oc_{ocId}`).
 *  - **Edge · OC YA PAGADA** (F3b): si la OC tenía pagos (`credito_pago_oc`),
 *    revertir SOLO la deuda dejaría la CC mostrando un sobre-pago. Para F3a se
 *    revierte la deuda IGUAL y se LOGUEA un warning fuerte · la reversa del pago
 *    (cash + crédito inverso) se maneja en F3b. NO se toca el pago acá.
 *
 * No bloqueante en el caller: si falla, la cancelación queda aplicada igual.
 *
 * @returns `{ montoRevertido, movimientoId? }`. Si la OC no tiene deuda que
 *   revertir (sin proveedorId / total 0), retorna `{ montoRevertido: 0 }`.
 */
export async function revertirDeudaOC(
  orden: OrdenCompra,
  motivo: string | undefined,
  userId: string,
): Promise<{ montoRevertido: number; movimientoId?: string }> {
  // Sin proveedor o sin monto → no hubo debito_oc que revertir.
  if (!orden.proveedorId) {
    logger.warn(
      `[CANCELACION_OC] OC ${orden.numeroOrden || orden.id} sin proveedorId · no hay deuda en CC que revertir.`,
    );
    return { montoRevertido: 0 };
  }

  const { cuentaCorrienteService } = await import('./cuentaCorriente.service');

  // ── Monto a revertir: leer el debito_oc REAL de esta OC (maneja OCs cuyo total
  //    cambió por edición post-confirmación). Fallback a orden.totalUSD. ──
  let montoRevertido = orden.totalUSD || 0;
  try {
    const movsOC = await cuentaCorrienteService.getMovimientosByFiltros({
      refDocumentoId: orden.id,
      tipoMovimiento: 'debito_oc',
    });
    const debitoReal = movsOC.find((m) => m.tipo === 'debito_oc');
    if (debitoReal) montoRevertido = debitoReal.monto;
  } catch (lookupErr) {
    logger.warn(
      `[CANCELACION_OC] No se pudo leer el debito_oc real de ${orden.numeroOrden || orden.id} · ` +
        `uso orden.totalUSD=${montoRevertido}.`,
      lookupErr,
    );
  }

  if (montoRevertido <= 0) {
    logger.warn(
      `[CANCELACION_OC] OC ${orden.numeroOrden || orden.id} sin monto de deuda (>0) · nada que revertir.`,
    );
    return { montoRevertido: 0 };
  }

  // ── EDGE · OC YA PAGADA: detectar pagos (credito_pago_oc) y/o estadoPago. La
  //    reversa del PAGO es F3b — acá solo se LOGUEA un warning fuerte. ──
  try {
    const { getPagosOC } = await import('./cuentaCorriente.adaptadores');
    const pagos = await getPagosOC(orden.id);
    const tienePago = pagos.length > 0 || (orden.estadoPago && orden.estadoPago !== 'pendiente');
    if (tienePago) {
      const totalPagado = pagos.reduce((s, p) => s + (p.montoUSD || 0), 0);
      logger.warn(
        `[CANCELACION_OC] ⚠️⚠️ OC ${orden.numeroOrden || orden.id} CANCELADA TENÍA PAGO REGISTRADO ` +
          `(${pagos.length} pago(s) · ~$${totalPagado.toFixed(2)} USD · estadoPago=${orden.estadoPago}). ` +
          `La reversa de la DEUDA se aplica igual, pero la reversa del PAGO (cash + crédito inverso en CC) ` +
          `se maneja en F3b · la CC del proveedor puede quedar mostrando un sobre-pago hasta entonces. ` +
          `Revisar manualmente.`,
      );
    }
  } catch (pagoErr) {
    logger.warn(
      `[CANCELACION_OC] No se pudo verificar si la OC ${orden.numeroOrden || orden.id} tenía pagos (edge F3b):`,
      pagoErr,
    );
  }

  // ── Emitir el crédito inverso (idempotente) ──
  const descripcion =
    `Reversa de deuda · OC ${orden.numeroOrden || orden.id} cancelada` +
    (motivo ? ` · ${motivo}` : '');
  const result = await cuentaCorrienteService.registrarMovimiento(
    {
      entidadId: orden.proveedorId,
      tipo: 'proveedor',
      entidadNombre: orden.nombreProveedor,
      tipoMovimiento: 'reversa_debito_oc',
      descripcion,
      moneda: 'USD',
      monto: montoRevertido,
      refDocumentoTipo: 'oc',
      refDocumentoId: orden.id,
      refDocumentoNumero: orden.numeroOrden,
      // Idempotencia: re-cancelar NO duplica la reversa (mismo patrón que confirmar_oc_).
      idempotencyKey: `cancelar_oc_${orden.id}`,
      ...(motivo ? { notas: motivo } : {}),
    },
    userId,
  );

  return { montoRevertido, movimientoId: result.movimientoId };
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
    motivo?: string;                   // motivo libre (log de las reversas físico/deuda/envío)
    /** F1 cancelación · motivo ESTRUCTURADO · se persiste en las refs soft-canceladas (scorecard de proveedor). */
    motivoCancelacion?: MotivoCancelacionOC;
    /** F1 cancelación · detalle libre opcional que el usuario tipeó junto al motivo estructurado. */
    motivoDetalle?: string;
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

    // F4 · B3: sincronizar la cobertura de Requerimientos con el nuevo estado de la OC (no bloqueante).
    // Es el ÚNICO punto que mueve el cache estadoOC de las refs → borrador→firme hace SUBIR la cobertura.
    try {
      if (nuevoEstado === 'cancelada') {
        // orden.estado = estado PRE-cambio → define la irreversibilidad (borrador retrae · firme deja rastro · §6)
        await requerimientoService.cancelarReferenciaOC({
          scope: 'oc_completa',
          ordenCompraId: id,
          ordenCompraNumero: orden.numeroOrden || '',
          ocEstadoActual: orden.estado,
          // F1 · forwardear el motivo ESTRUCTURADO → se persiste en las refs soft-canceladas
          // (alimenta el scorecard de proveedor). El `motivo` libre sigue yendo a los logs.
          motivo: datos?.motivoCancelacion,
          motivoDetalle: datos?.motivoDetalle,
        });
      } else {
        await requerimientoService.propagarEstadoOCaRequerimientos(id, orden.numeroOrden || '', nuevoEstado);
      }
    } catch (reqErr) {
      logger.error('Error al sincronizar cobertura de Requerimientos (no bloqueante):', reqErr);
    }

    // CANCELACION_OC · F2 · REVERSA FÍSICA: al cancelar, borrar las unidades 'pedida' huérfanas
    // que confirmarOC creó + contar las reservas que colgaban de ellas. No bloqueante (mismo
    // patrón que cancelarReferenciaOC arriba): si falla, la OC YA quedó cancelada y se loguea fuerte.
    // El filtro por-unidad dentro de revertirFisicoOC garantiza que SOLO se borran 'pedida' (no
    // inventario recibido) y el guard (a) cubre el caso borrador (sin unidadesGeneradas → no-op).
    if (nuevoEstado === 'cancelada') {
      try {
        // Import dinámico: ordenCompra.recepcion.service importa estáticamente de este módulo
        // (getById) → usar import() evita el ciclo, igual que confirmarOC con envio.crud.service.
        const { revertirFisicoOC } = await import('./ordenCompra.recepcion.service');
        const reversa = await revertirFisicoOC(id, datos?.motivo, userId);
        logger.info(
          `[CANCELACION_OC] OC ${orden.numeroOrden || id} reversa física aplicada: ` +
            `${reversa.unidadesBorradas} unidades borradas · ${reversa.reservasLiberadas} reservas liberadas.`,
        );
      } catch (fisicoErr) {
        logger.error(
          `[CANCELACION_OC] ⚠️ FALLÓ la reversa física de la OC ${orden.numeroOrden || id} (no bloqueante · ` +
            `la cancelación SÍ se aplicó · pueden quedar unidades 'pedida' huérfanas · revisar manualmente):`,
          fisicoErr,
        );
      }

      // CANCELACION_OC · F3a · REVERSA FINANCIERA (deuda): emitir el crédito inverso del
      // debito_oc que confirmarOC creó en la CC del proveedor. Solo si la OC era FIRME:
      // `confirmarOC` solo corre el debito_oc al salir de 'borrador' → un borrador no tiene
      // deuda que revertir. `orden.estado` es el estado PRE-cambio (getById antes del update).
      // No bloqueante (mismo patrón que la reversa física): si falla, la OC YA quedó cancelada.
      const ocEraFirme = orden.estado !== 'borrador';
      if (ocEraFirme) {
        try {
          const reversaDeuda = await revertirDeudaOC(orden, datos?.motivo, userId);
          if (reversaDeuda.montoRevertido > 0) {
            logger.info(
              `[CANCELACION_OC] OC ${orden.numeroOrden || id} reversa financiera aplicada: ` +
                `deuda revertida $${reversaDeuda.montoRevertido.toFixed(2)} USD en CC del proveedor ` +
                `(mov=${reversaDeuda.movimientoId ?? 'reutilizado'}).`,
            );
          }
        } catch (deudaErr) {
          logger.error(
            `[CANCELACION_OC] ⚠️ FALLÓ la reversa financiera de la OC ${orden.numeroOrden || id} (no bloqueante · ` +
              `la cancelación SÍ se aplicó · puede quedar DEUDA FANTASMA en la CC del proveedor · revisar manualmente):`,
            deudaErr,
          );
        }
      }

      // CANCELACION_OC · F4 · REVERSA DE ENVÍO: cancelar el/los Envío(s) T1 que `confirmarOC`
      // generó (vinculados por ordenCompraId). Los CANCELABLES (borrador/confirmado · aún no
      // salieron) se cancelan; los que ya están en_transito/recibidos se LOGUEAN para derivar
      // a devolución (la mercadería ya va a llegar). No bloqueante (mismo patrón que la reversa
      // física/financiera): si falla, la OC YA quedó cancelada. No-op si la OC no generó envíos
      // (ej. era borrador → confirmarOC no corrió).
      try {
        const reversaEnvios = await cancelarEnviosDeOC(id, datos?.motivo, userId);
        if (reversaEnvios.enviosCancelados > 0 || reversaEnvios.enviosNoCancelables > 0) {
          logger.info(
            `[CANCELACION_OC] OC ${orden.numeroOrden || id} reversa de envíos: ` +
              `${reversaEnvios.enviosCancelados} envío(s) cancelado(s) · ` +
              `${reversaEnvios.enviosNoCancelables} no cancelable(s) (ya en camino/recibido · revisar para devolución).`,
          );
        }
      } catch (envioReversaErr) {
        logger.error(
          `[CANCELACION_OC] ⚠️ FALLÓ la reversa de envíos de la OC ${orden.numeroOrden || id} (no bloqueante · ` +
            `la cancelación SÍ se aplicó · pueden quedar envíos T1 vivos apuntando a la OC cancelada · revisar manualmente):`,
          envioReversaErr,
        );
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

  // F2 · GATE DE COMPROMISO (decisión usuario "ambos puntos"): una OC cuyo total consolidado supera el
  // umbral NO se puede confirmar/comprometer con el proveedor sin la firma de socio (la misma autorización
  // que exige el pago). El socio bendice el compromiso ANTES de obligarse · el total ya quedó congelado.
  if (requiereAutorizacionSocio(orden.totalUSD || 0) && orden.autorizacion?.estado !== 'aprobado') {
    throw new Error(
      `Esta OC ($${(orden.totalUSD || 0).toFixed(0)} USD) supera el umbral · requiere la firma de socio ANTES de comprometerla. Autorizala primero.`,
    );
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

  // 2. Actualizar OC — S53.12 FIX: cuando es recojo en origen, la OC salta
  // directamente a 'completada' porque el colaborador ya compro todo fisicamente.
  // No pasa por 'confirmada' ni 'en_proceso' porque no hay envio en transito:
  // las unidades estan inmediatamente disponibles en la casilla destino.
  // Para via_casilla/DDP, la OC nace 'confirmada' y transita normalmente segun
  // vaya llegando el envio.
  const ocRef = doc(db, ORDENES_COLLECTION, ocId);
  // S38-009: DDP se detecta por modoEntregaDetallado, no por un sentinel en destinoCasillaId.
  // El destino SIEMPRE es una casilla real (en DDP: la casilla Peru principal del cliente).
  const esDDP = orden.modoEntregaDetallado === 'ddp_directo';
  const estadoInicial: 'completada' | 'confirmada' = orden.recojoEnOrigen
    ? 'completada'
    : 'confirmada';
  const ocUpdate: Record<string, unknown> = {
    estado: estadoInicial,
    inventarioGenerado: true,
    unidadesGeneradas: unidadIds,
    almacenDestino: destinoCasillaId,
    ...(orden.nombreAlmacenDestino ? {} : await (async () => {
      const { casillaCrudService } = await import('./casilla.crud.service');
      const cas = await casillaCrudService.getById(destinoCasillaId);
      return cas ? { nombreAlmacenDestino: cas.nombre } : {};
    })()),
    ultimaEdicion: now,
    editadoPor: userId,
  };
  // Persistir sub-órdenes si se configuraron en el modal de confirmación
  if (orden.subOrdenes && orden.subOrdenes.length > 0) {
    ocUpdate.subOrdenes = orden.subOrdenes;
  }
  // S42ay — Firestore rechaza `undefined` en WriteBatch.update(). Limpiamos
  // recursivamente antes de enviar por si algún consumer cuela un undefined.
  const cleanUndefined = (obj: unknown): unknown => {
    if (Array.isArray(obj)) return obj.map(cleanUndefined);
    if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (v !== undefined) out[k] = cleanUndefined(v);
      }
      return out;
    }
    return obj;
  };
  batch.update(ocRef, cleanUndefined(ocUpdate) as Record<string, unknown>);

  await batch.commit();

  // 2.5. S55 Fase 2 — Crear movimiento `debito_oc` en CC del proveedor.
  // La OC representa una deuda con el proveedor: vamos a recibir mercadería
  // y debemos pagar `totalUSD`. Esto inicializa la CC para que los pagos
  // posteriores la salden vía `credito_pago_oc`.
  //
  // No bloqueante: si falla, la confirmación queda aplicada y se puede
  // resolver con `cuentaCorrienteService.ajusteManual`. Esto evita que un
  // problema en CC bloquee la creación de inventario.
  if (orden.proveedorId && orden.totalUSD > 0) {
    try {
      const { cuentaCorrienteService } = await import('./cuentaCorriente.service');
      await cuentaCorrienteService.registrarMovimiento(
        {
          entidadId: orden.proveedorId,
          tipo: 'proveedor',
          entidadNombre: orden.nombreProveedor,
          tipoMovimiento: 'debito_oc',
          descripcion: `OC ${orden.numeroOrden} confirmada · ${orden.productos.length} productos`,
          moneda: 'USD',
          monto: orden.totalUSD,
          fecha: now.toDate(),
          refDocumentoTipo: 'oc',
          refDocumentoId: ocId,
          refDocumentoNumero: orden.numeroOrden,
          // Idempotencia: si se reintenta confirmar la misma OC, el debito
          // no se duplica.
          idempotencyKey: `confirmar_oc_${ocId}`,
        },
        userId,
      );
    } catch (err) {
      // Log pero no fallar — la OC ya está confirmada e inventario creado
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      console.warn(
        `[CC] No se pudo registrar debito_oc para ${orden.numeroOrden}: ${msg}. ` +
          `Resolver con ajusteManual.`,
      );
    }
  }

  // 3. Crear Envio(s) T1 en 'borrador'
  const transporteColaboradorId = orden.colaboradorTransporteId || colaboradorId;
  const metodoProrrateoMap: Record<string, MetodoProrrateo> = {
    por_valor: 'total_por_valor',
    por_peso: 'total_por_peso',
    por_cantidad: 'fijo_por_unidad',
    proporcional: 'total_por_valor', // proporcional ≈ por valor
  };

  // S42ba — Helper: heredar cargos comerciales al envío como costosLanded.
  // La regla del usuario (Ejemplo 3): los cargos se asignan al bloque (OC o
  // sub-orden) según lo que el proveedor cobró, y dentro del bloque se
  // prorratean por valor a cada producto. Este helper se llama una vez por
  // envío, con la info del bloque correspondiente.
  //
  // Sobre-carga:
  // - Si `subOrden` se pasa → hereda los 3 consolidados (shipping, descuento,
  //   impuesto) de ESA sub-orden, reflejando lo que el proveedor facturó en
  //   esa tanda específica.
  // - Si no → hereda los cargos originales granulares de la OC padre
  //   (cargosOC[] + descuentosOC[] + impuestosOC[]) manteniendo concepto.
  const tc = orden.tcReferencial || orden.tcCompra || 1;
  const heredarCargos = async (
    targetEnvioId: string,
    subOrden?: import('../types/ordenCompra.types').SubOrdenCompra
  ) => {
    const items: Array<{
      id: string;
      concepto: string;
      monto: number; // positivo = cargo/impuesto; negativo = descuento
      metodoProrrateo?: string; // método declarado en el cargo/descuento (si lo hay)
    }> = [];

    if (subOrden) {
      // ─── Bloque: sub-orden ───
      if ((subOrden.shippingUSD ?? 0) > 0) {
        items.push({
          id: `sub-${subOrden.id}-shipping`,
          concepto: `Cargos del proveedor · ${subOrden.id}`,
          monto: subOrden.shippingUSD!,
        });
      }
      if ((subOrden.descuentoUSD ?? 0) > 0) {
        items.push({
          id: `sub-${subOrden.id}-descuento`,
          concepto: `Descuento del proveedor · ${subOrden.id}`,
          monto: -subOrden.descuentoUSD!, // negativo: reduce el CTRU
        });
      }
      if ((subOrden.impuestoUSD ?? 0) > 0) {
        items.push({
          id: `sub-${subOrden.id}-impuesto`,
          concepto: `Impuesto del proveedor · ${subOrden.id}`,
          monto: subOrden.impuestoUSD!,
        });
      }
    } else {
      // ─── Bloque: OC única ─── (mantenemos conceptos granulares)
      for (const c of orden.cargosOC ?? []) {
        if (c.montoUSD > 0) {
          items.push({
            id: `cargo-oc-${c.id}`,
            concepto: c.concepto || 'Cargo OC',
            monto: c.montoUSD,
            metodoProrrateo: c.metodoProrrateo,
          });
        }
      }
      for (const d of orden.descuentosOC ?? []) {
        if (d.montoUSD > 0) {
          items.push({
            id: `desc-oc-${d.id}`,
            concepto: d.concepto || 'Descuento OC',
            monto: -d.montoUSD,
            metodoProrrateo: d.metodoProrrateo,
          });
        }
      }
      for (const i of orden.impuestosOC ?? []) {
        if (i.montoUSD > 0) {
          items.push({
            id: `imp-oc-${i.id}`,
            concepto: i.concepto || 'Impuesto OC',
            monto: i.montoUSD,
          });
        }
      }
    }

    // Persistir todos los items como costosLanded del envío
    for (const item of items) {
      await envioCrudService.agregarCostoLanded(
        targetEnvioId,
        {
          categoriaCostoId: item.id,
          categoriaCostoNombre: item.concepto,
          monto: item.monto,
          moneda: 'USD',
          montoPEN: item.monto * tc,
          tipoCambio: tc,
          // BUG-4: propagar el método declarado de cada cargo/descuento
          // (por_valor/por_peso/por_cantidad). Default total_por_valor para
          // sub-órdenes consolidadas, impuestos y 'proporcional'.
          metodoProrrateo: metodoProrrateoMap[item.metodoProrrateo ?? ''] ?? 'total_por_valor',
          pagado: false,
        },
        userId
      );
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

      // S42ba — Heredar cargos de ESTA sub-orden específica (no los globales)
      await heredarCargos(envioResult.id, subOrden);

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

  // S42af — Recojo en origen: el colaborador ya tiene la mercadería al confirmar.
  // El envío nace en 'recibida_completa', unidades en 'disponible' en la casilla
  // destino, e inventario de la casilla actualizado.
  if (orden.recojoEnOrigen) {
    await aplicarRecojoEnOrigen(orden, destinoCasillaId, unidadIds, userId);
  }

  return {
    unidadesCreadas: unidadIds.length,
    envioId,
  };
}

/**
 * S42af — Helper para "Recojo en origen": marca envío(s) como recibidos
 * completos, unidades como disponibles en la casilla destino, y actualiza
 * el inventario (unidadesActuales + totalUnidadesRecibidas + valorInventarioUSD).
 *
 * Se llama al final de confirmarOC cuando orden.recojoEnOrigen === true.
 */
async function aplicarRecojoEnOrigen(
  orden: OrdenCompra,
  destinoCasillaId: string,
  unidadIds: string[],
  userId: string
): Promise<void> {
  const { casillaCrudService } = await import('./casilla.crud.service');
  const { envioCrudService } = await import('./envio.crud.service');
  const { buildProductosInfoFromOC } = await import('../utils/prorrateoLanded');
  const { buildUnidadesPorTanda, prorratearLandedAComponentes, construirComponentesUnidad } =
    await import('../utils/costoComponentes.builder');
  const now = Timestamp.now();

  // 1. Obtener nombre de la casilla para desnormalizar en unidades
  const casillaDestino = await casillaCrudService.getById(destinoCasillaId);
  const casillaNombre = casillaDestino?.nombre ?? destinoCasillaId;

  // 2. S53.6 — Calcular CTRU prorrateado por unidad leyendo los costosLanded
  //    del(los) envío(s) de la OC. Al recibir en origen, los cargos comerciales
  //    de la OC (impuestos, cargos, descuentos) ya fueron heredados al Envio T1
  //    via `heredarCargos` durante confirmarOC. Aquí replicamos la lógica que
  //    hace `envio.recepcion.service.registrarRecepcion` para que el CTRU final
  //    (componentesCosto[] congelados) incluya esos prorrateos.
  const enviosDeOC = await envioCrudService.getByOrdenCompra(orden.id);
  const productosInfo = buildProductosInfoFromOC(orden.productos);
  const tcCompra = orden.tcReferencial || orden.tcCompra || 0;

  // Prorrateo de costos landed → ComponenteCostoUnidad[] por unidad, POR ÁMBITO
  // (mismo builder que registrarRecepcion · fundación 2026-06-16). scope='envio' se
  // reparte entre todas las unidades del envío; scope='tanda' solo en su tanda.
  const landedComponentesPorUnidad = new Map<string, ComponenteCostoUnidad[]>();
  for (const envio of enviosDeOC) {
    if (!envio.costosLanded || envio.costosLanded.length === 0) continue;
    const todasUnidades = envio.unidades || [];
    const unidadesPorTanda = buildUnidadesPorTanda(envio.subEnvios, todasUnidades);
    const comps = prorratearLandedAComponentes(
      envio.costosLanded,
      todasUnidades,
      unidadesPorTanda,
      productosInfo,
      now
    );
    for (const [uid, list] of comps) {
      const prev = landedComponentesPorUnidad.get(uid);
      if (prev) prev.push(...list);
      else landedComponentesPorUnidad.set(uid, [...list]);
    }
  }

  // 3. Marcar todas las unidades como 'disponible' en la casilla destino con CTRU calculado
  // S53.5 FIX — el tipo Unidad define el campo desnormalizado como `casillaNombre`
  // (sin "Actual"). Antes se escribía `casillaActualNombre` que la UI de /unidades
  // no lee, resultando en "🇺🇸 -" en vez de "🇺🇸 Casa - Angie".
  // S53.6 FIX — congelar componentesCosto[] por cada unidad (fuente única del CTRU).
  // Antes quedaba sin costo porque se saltaba el flujo de recepción normal.
  const unidadesBatch = writeBatch(db);
  for (const uid of unidadIds) {
    // Resolver el costoUnitarioUSD del producto desde la OC (vía el productoId que
    // el Envio T1 guarda para cada unidad).
    let costoUnitarioUSD = 0;
    for (const envio of enviosDeOC) {
      const unidadEnvio = envio.unidades?.find(u => u.unidadId === uid);
      if (unidadEnvio) {
        const prod = orden.productos.find(p => p.productoId === unidadEnvio.productoId);
        if (prod) costoUnitarioUSD = prod.costoUnitario;
        break;
      }
    }

    const updateData: Record<string, unknown> = {
      estado: 'disponible',
      casillaActualId: destinoCasillaId,
      casillaNombre,
      pais: casillaDestino?.pais || orden.paisOrigen || 'USA',
      fechaRecepcion: now,
      actualizadoPor: userId,
      fechaActualizacion: now,
    };

    // Congelar componentes con el MISMO builder que registrarRecepcion (sin 2ª copia
    // divergente de la fórmula). El TC viene de la OC; solo se valoriza si hay TC.
    if (tcCompra > 0) {
      const landedComps = landedComponentesPorUnidad.get(uid) || [];
      const componentes = construirComponentesUnidad({ costoUnitarioUSD, tcCompra }, landedComps, now);

      updateData.componentesCosto = componentes;
      // Limpieza 2026-07 · componentesCosto[] es la FUENTE ÚNICA del CTRU: no se
      // escribe ningún escalar derivado (costosLandedPEN/ctru* eliminados del tipo).
    }

    unidadesBatch.update(doc(db, 'unidades', uid), updateData);
  }
  await unidadesBatch.commit();

  // 4. Actualizar envío(s) buscados en paso 2: marcarlos como recibidos
  for (const envio of enviosDeOC) {
    const envioRef = doc(db, COLLECTIONS.ENVIOS, envio.id);
    const totalUnidades = envio.unidades?.length ?? 0;
    await updateDoc(envioRef, {
      estado: 'recibida_completa',
      fechaRecepcion: now,
      totalUnidadesRecibidas: totalUnidades,
      // Marcar todas las unidadesDetalle como 'recibida'
      ...(envio.unidades && envio.unidades.length > 0 && {
        unidades: envio.unidades.map((u) => ({
          ...u,
          estadoEnvio: 'recibida',
          fechaRecepcion: now,
        })),
      }),
      notas: [envio.notas, 'Recibido automáticamente al confirmar OC (Recojo en origen)']
        .filter(Boolean).join(' · '),
      actualizadoPor: userId,
      fechaActualizacion: now,
    });
  }

  // 5. Actualizar inventario de la casilla destino
  const cantidadTotal = unidadIds.length;
  await casillaCrudService.incrementarUnidadesRecibidas(destinoCasillaId, cantidadTotal);

  // Sumar valor de inventario — S53.6 incluye impuestos + cargos - descuentos de la OC
  // (total efectivo de la OC en USD) en vez de solo el subtotal base de productos.
  // Fase A · valor de inventario vía getCargosEfectivosOC (fuente única v2; antes era
  // un read híbrido: impuestos/descuentos de escalar + cargos de array).
  const ef = getCargosEfectivosOC(orden);
  const valorTotalUSD = ef.subtotalProductos + ef.impuestos + ef.cargos - ef.descuentos;
  await casillaCrudService.actualizarValorInventario(destinoCasillaId, valorTotalUSD);

  logger.success(
    `Recojo en origen aplicado: ${cantidadTotal} unidades disponibles en ${casillaNombre}, ` +
      `valor +$${valorTotalUSD.toFixed(2)} (subtotal $${ef.subtotalProductos.toFixed(2)} + ` +
      `impuestos $${ef.impuestos.toFixed(2)} + cargos $${ef.cargos.toFixed(2)} - ` +
      `descuentos $${ef.descuentos.toFixed(2)}), CTRU calculado por unidad, ` +
      `${enviosDeOC.length} envío(s) marcado(s) como recibidos`
  );
}
