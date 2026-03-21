/**
 * cotizacion.crud.service.ts
 * Create, update and delete operations for cotizaciones.
 */
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTION_NAME, generateNumeroCotizacion } from './cotizacion.shared';
import type { Cotizacion, CotizacionFormData, EstadoCotizacion, ProductoCotizacion } from '../types/cotizacion.types';
import { ProductoService } from './producto.service';
import { inventarioService } from './inventario.service';
import { stockDisponibilidadService } from './stockDisponibilidad.service';
import { tipoCambioService } from './tipoCambio.service';
import { ctruService } from './ctru.service';
import { logger } from '../lib/logger';
import type { DisponibilidadProducto } from '../types/stockDisponibilidad.types';

/** Calcular estimación de costo/margen para una cotización usando el CTRU actual */
async function calcularExpectativaCotizacion(
  productos: Array<{ productoId: string; cantidad: number; precioUnitario: number }>,
  tcActual: number
): Promise<{
  costoEstimadoUSD: number;
  costoEstimadoPEN: number;
  margenEsperado: number;
  utilidadEsperadaPEN: number;
  productosEstimados: Array<{
    productoId: string;
    costoUnitarioEstimadoUSD: number;
    margenEstimado: number;
  }>;
}> {
  let costoTotalUSD = 0;
  let ventaTotalPEN = 0;
  const productosEstimados: Array<{
    productoId: string;
    costoUnitarioEstimadoUSD: number;
    margenEstimado: number;
  }> = [];

  for (const prod of productos) {
    try {
      const ctruInfo = await ctruService.getCTRUProducto(prod.productoId);
      const costoUnitarioUSD = ctruInfo.ctruPromedio / tcActual;
      const costoProductoUSD = costoUnitarioUSD * prod.cantidad;
      costoTotalUSD += costoProductoUSD;

      const subtotalVenta = prod.cantidad * prod.precioUnitario;
      ventaTotalPEN += subtotalVenta;

      const costoProductoPEN = costoProductoUSD * tcActual;
      const utilidadProducto = subtotalVenta - costoProductoPEN;
      const margenProducto = subtotalVenta > 0 ? (utilidadProducto / subtotalVenta) * 100 : 0;

      productosEstimados.push({
        productoId: prod.productoId,
        costoUnitarioEstimadoUSD: costoUnitarioUSD,
        margenEstimado: margenProducto
      });
    } catch {
      productosEstimados.push({
        productoId: prod.productoId,
        costoUnitarioEstimadoUSD: 0,
        margenEstimado: 0
      });
    }
  }

  const costoEstimadoPEN = costoTotalUSD * tcActual;
  const utilidadEsperadaPEN = ventaTotalPEN - costoEstimadoPEN;
  const margenEsperado = ventaTotalPEN > 0 ? (utilidadEsperadaPEN / ventaTotalPEN) * 100 : 0;

  return {
    costoEstimadoUSD: costoTotalUSD,
    costoEstimadoPEN,
    margenEsperado,
    utilidadEsperadaPEN,
    productosEstimados
  };
}

/** Crear nueva cotización con disponibilidad multi-almacén */
export async function create(data: CotizacionFormData, userId: string): Promise<Cotizacion> {
  try {
    const productosCotizacion: ProductoCotizacion[] = [];
    let subtotalPEN = 0;
    const lineaNegocioIds: string[] = [];
    let lineaNegocioNombreMap: Record<string, string> = {};

    const consultaDisponibilidad = await stockDisponibilidadService.consultarDisponibilidad({
      productos: data.productos.map(p => ({
        productoId: p.productoId,
        cantidadRequerida: p.cantidad
      })),
      incluirRecomendacion: true,
      priorizarPeru: true
    });

    const disponibilidadMap = new Map<string, DisponibilidadProducto>();
    consultaDisponibilidad.productos.forEach(d => disponibilidadMap.set(d.productoId, d));

    for (const prod of data.productos) {
      const producto = await ProductoService.getById(prod.productoId);
      if (!producto) {
        throw new Error(`Producto ${prod.productoId} no encontrado`);
      }

      if (producto.lineaNegocioId) {
        lineaNegocioIds.push(producto.lineaNegocioId);
        if (producto.lineaNegocioNombre) {
          lineaNegocioNombreMap[producto.lineaNegocioId] = producto.lineaNegocioNombre;
        }
      }

      const disponibilidad = disponibilidadMap.get(prod.productoId);
      const disponiblesTotal = disponibilidad?.totalLibre || 0;
      const disponiblesPeru = disponibilidad?.disponiblePeru || 0;
      const disponiblesUSA = disponibilidad?.disponibleUSA || 0;

      const subtotal = prod.cantidad * prod.precioUnitario;
      subtotalPEN += subtotal;

      const productoCotizacion: ProductoCotizacion = {
        productoId: prod.productoId,
        sku: producto.sku,
        marca: producto.marca,
        nombreComercial: producto.nombreComercial,
        presentacion: producto.presentacion,
        contenido: producto.contenido,
        dosaje: producto.dosaje,
        cantidad: prod.cantidad,
        precioUnitario: prod.precioUnitario,
        subtotal,
        stockDisponible: disponiblesTotal,
        requiereStock: disponiblesTotal < prod.cantidad
      };

      if (disponibilidad) {
        const recomendacion = disponibilidad.recomendacion;
        const cantidadFaltante = prod.cantidad - disponiblesTotal;
        const almacenesRecomendados = recomendacion?.almacenesRecomendados || [];

        const disponibilidadMultiAlmacen: Record<string, any> = {
          stockPeru: disponiblesPeru,
          stockUSA: disponiblesUSA,
          stockTotal: disponiblesTotal,
          fuenteRecomendada: recomendacion?.fuente || 'virtual',
          cantidadDesdePeru: almacenesRecomendados
            .filter(a => disponibilidad.almacenes.find(al => al.almacenId === a.almacenId)?.pais === 'Peru')
            .reduce((sum, a) => sum + a.cantidad, 0),
          cantidadDesdeUSA: almacenesRecomendados
            .filter(a => disponibilidad.almacenes.find(al => al.almacenId === a.almacenId)?.pais === 'USA')
            .reduce((sum, a) => sum + a.cantidad, 0),
          tiempoEstimadoLlegadaDias: almacenesRecomendados
            .reduce((max, a) => Math.max(max, a.tiempoEstimadoDias), 0)
        };

        if (cantidadFaltante > 0) {
          disponibilidadMultiAlmacen.cantidadVirtual = cantidadFaltante;
        }
        const costoEstimado = almacenesRecomendados.reduce((sum, a) => sum + a.costoEstimadoUSD, 0);
        if (costoEstimado > 0) {
          disponibilidadMultiAlmacen.costoEstimadoUSD = costoEstimado;
        }
        const costoFlete = disponibilidad.almacenes
          .filter(a => a.pais === 'USA')
          .reduce((sum, a) => sum + (a.costoFleteEstimadoUSD || 0), 0);
        if (costoFlete > 0) {
          disponibilidadMultiAlmacen.costoFleteEstimadoUSD = costoFlete;
        }

        productoCotizacion.disponibilidadMultiAlmacen = disponibilidadMultiAlmacen as any;
      }

      productosCotizacion.push(productoCotizacion);
    }

    // Auto-inherit lineaNegocioId from products (most frequent wins)
    let derivedLineaNegocioId: string | undefined;
    let derivedLineaNegocioNombre: string | undefined;
    if (lineaNegocioIds.length > 0) {
      const freq: Record<string, number> = {};
      for (const id of lineaNegocioIds) {
        freq[id] = (freq[id] || 0) + 1;
      }
      derivedLineaNegocioId = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
      derivedLineaNegocioNombre = lineaNegocioNombreMap[derivedLineaNegocioId];
    }

    const descuento = data.descuento || 0;
    const costoEnvio = data.costoEnvio || 0;
    const incluyeEnvio = data.incluyeEnvio ?? true;
    const totalPEN = subtotalPEN - descuento + (incluyeEnvio ? 0 : costoEnvio);

    // Calcular expectativa de cotización (TC momento 1)
    let expectativaCotizacion: Record<string, any> | undefined;
    try {
      const tcCotizacion = await tipoCambioService.resolverTCVenta();
      const expectativaCalc = await calcularExpectativaCotizacion(
        data.productos.map(p => ({
          productoId: p.productoId,
          cantidad: p.cantidad,
          precioUnitario: p.precioUnitario
        })),
        tcCotizacion
      );
      expectativaCotizacion = {
        tcCotizacion,
        costoEstimadoUSD: expectativaCalc.costoEstimadoUSD,
        costoEstimadoPEN: expectativaCalc.costoEstimadoPEN,
        margenEsperado: expectativaCalc.margenEsperado,
        utilidadEsperadaPEN: expectativaCalc.utilidadEsperadaPEN,
        productosEstimados: expectativaCalc.productosEstimados,
        fechaCotizacion: Timestamp.now()
      };
    } catch (e) {
      logger.warn('[Expectativa] No se pudo calcular expectativa de cotización (no bloqueante):', e);
    }

    const numeroCotizacion = await generateNumeroCotizacion();
    const diasVigencia = data.diasVigencia || 7;
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + diasVigencia);

    const nuevaCotizacion: any = {
      numeroCotizacion,
      nombreCliente: data.nombreCliente,
      canal: data.canal,
      productos: productosCotizacion,
      subtotalPEN,
      totalPEN,
      incluyeEnvio,
      estado: 'nueva' as EstadoCotizacion,
      diasVigencia,
      fechaCreacion: serverTimestamp(),
      fechaVencimiento: Timestamp.fromDate(fechaVencimiento),
      productosInteres: productosCotizacion.map(p => p.productoId),
      creadoPor: userId
    };

    if (expectativaCotizacion) {
      nuevaCotizacion.expectativaCotizacion = expectativaCotizacion;
    }
    if (derivedLineaNegocioId) {
      nuevaCotizacion.lineaNegocioId = derivedLineaNegocioId;
      if (derivedLineaNegocioNombre) nuevaCotizacion.lineaNegocioNombre = derivedLineaNegocioNombre;
    }

    // Auto-crear o vincular cliente en Maestros
    let clienteIdFinal = data.clienteId;
    if (!clienteIdFinal && data.nombreCliente) {
      try {
        const { clienteService } = await import('./cliente.service');
        const { cliente } = await clienteService.getOrCreate({
          nombre: data.nombreCliente.trim(),
          tipoCliente: 'persona',
          telefono: data.telefonoCliente || undefined,
          email: data.emailCliente || undefined,
          dniRuc: data.dniRuc || undefined,
          canalOrigen: data.canal || 'directo',
        }, userId);
        clienteIdFinal = cliente.id;
      } catch (clienteError) {
        logger.warn('[crearCotizacion] Error auto-creando cliente en Maestros:', clienteError);
      }
    }

    if (clienteIdFinal) nuevaCotizacion.clienteId = clienteIdFinal;
    if (descuento > 0) nuevaCotizacion.descuento = descuento;
    if (costoEnvio > 0) nuevaCotizacion.costoEnvio = costoEnvio;
    if (data.emailCliente) nuevaCotizacion.emailCliente = data.emailCliente;
    if (data.telefonoCliente) nuevaCotizacion.telefonoCliente = data.telefonoCliente;
    if (data.direccionEntrega) nuevaCotizacion.direccionEntrega = data.direccionEntrega;
    if (data.distrito) nuevaCotizacion.distrito = data.distrito;
    if (data.provincia) nuevaCotizacion.provincia = data.provincia;
    if (data.codigoPostal) nuevaCotizacion.codigoPostal = data.codigoPostal;
    if (data.referencia) nuevaCotizacion.referencia = data.referencia;
    if (data.coordenadas) nuevaCotizacion.coordenadas = data.coordenadas;
    if (data.dniRuc) nuevaCotizacion.dniRuc = data.dniRuc;
    if (data.observaciones) nuevaCotizacion.observaciones = data.observaciones;

    const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevaCotizacion);

    return {
      id: docRef.id,
      ...nuevaCotizacion,
      fechaCreacion: Timestamp.now(),
      fechaVencimiento: Timestamp.fromDate(fechaVencimiento)
    } as Cotizacion;
  } catch (error: any) {
    logger.error('Error al crear cotización:', error);
    throw new Error(error.message || 'Error al crear cotización');
  }
}

/**
 * Actualizar cotización.
 * Permitido en estados: nueva, validada, pendiente_adelanto.
 */
export async function update(
  id: string,
  data: Partial<CotizacionFormData>,
  userId: string,
  getCotizacionById: (id: string) => Promise<Cotizacion | null>
): Promise<void> {
  try {
    const cotizacion = await getCotizacionById(id);
    if (!cotizacion) {
      throw new Error('Cotización no encontrada');
    }

    const estadosEditables: EstadoCotizacion[] = ['nueva', 'validada', 'pendiente_adelanto'];
    if (!estadosEditables.includes(cotizacion.estado)) {
      throw new Error('Solo se pueden editar cotizaciones en estados: Nueva, Validada o Esperando Pago');
    }

    const updates: any = {
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    };

    if (data.nombreCliente !== undefined) updates.nombreCliente = data.nombreCliente;
    if (data.emailCliente !== undefined) updates.emailCliente = data.emailCliente;
    if (data.telefonoCliente !== undefined) updates.telefonoCliente = data.telefonoCliente;
    if (data.direccionEntrega !== undefined) updates.direccionEntrega = data.direccionEntrega;
    if (data.distrito !== undefined) updates.distrito = data.distrito;
    if (data.provincia !== undefined) updates.provincia = data.provincia;
    if (data.codigoPostal !== undefined) updates.codigoPostal = data.codigoPostal;
    if (data.referencia !== undefined) updates.referencia = data.referencia;
    if (data.coordenadas !== undefined) updates.coordenadas = data.coordenadas;
    if (data.dniRuc !== undefined) updates.dniRuc = data.dniRuc;
    if (data.canal !== undefined) updates.canal = data.canal;
    if (data.clienteId !== undefined) updates.clienteId = data.clienteId;
    if (data.descuento != null) updates.descuento = data.descuento;
    if (data.costoEnvio != null) updates.costoEnvio = data.costoEnvio;
    if (data.incluyeEnvio !== undefined) updates.incluyeEnvio = data.incluyeEnvio;
    if (data.observaciones !== undefined) updates.observaciones = data.observaciones;
    if (data.diasVigencia !== undefined) updates.diasVigencia = data.diasVigencia;

    if (data.productos) {
      const productosCotizacion: ProductoCotizacion[] = [];
      let subtotalPEN = 0;

      for (const prod of data.productos) {
        const producto = await ProductoService.getById(prod.productoId);
        if (!producto) {
          throw new Error(`Producto ${prod.productoId} no encontrado`);
        }

        const inventarioProducto = await inventarioService.getInventarioProducto(prod.productoId);
        const disponiblesEnPeru = inventarioProducto
          .filter(inv => inv.pais === 'Peru')
          .reduce((sum, inv) => sum + inv.disponibles, 0);

        const subtotal = prod.cantidad * prod.precioUnitario;
        subtotalPEN += subtotal;

        productosCotizacion.push({
          productoId: prod.productoId,
          sku: producto.sku,
          marca: producto.marca,
          nombreComercial: producto.nombreComercial,
          presentacion: producto.presentacion,
          cantidad: prod.cantidad,
          precioUnitario: prod.precioUnitario,
          subtotal,
          stockDisponible: disponiblesEnPeru,
          requiereStock: disponiblesEnPeru < prod.cantidad
        });
      }

      updates.productos = productosCotizacion;
      updates.subtotalPEN = subtotalPEN;
      updates.productosInteres = productosCotizacion.map(p => p.productoId);

      const descuento = data.descuento ?? cotizacion.descuento ?? 0;
      const costoEnvio = data.costoEnvio ?? cotizacion.costoEnvio ?? 0;
      const incluyeEnvio = data.incluyeEnvio ?? cotizacion.incluyeEnvio;
      updates.totalPEN = subtotalPEN - descuento + (incluyeEnvio ? 0 : costoEnvio);
    }

    await updateDoc(doc(db, COLLECTION_NAME, id), updates);
  } catch (error: any) {
    logger.error('Error al actualizar cotización:', error);
    throw new Error(error.message || 'Error al actualizar cotización');
  }
}

/** Eliminar cotización (solo si está en estado 'nueva' o 'rechazada') */
export async function deleteCotizacion(
  id: string,
  getCotizacionById: (id: string) => Promise<Cotizacion | null>
): Promise<void> {
  try {
    const cotizacion = await getCotizacionById(id);
    if (!cotizacion) {
      throw new Error('Cotización no encontrada');
    }
    if (cotizacion.estado !== 'nueva' && cotizacion.estado !== 'rechazada') {
      throw new Error('Solo se pueden eliminar cotizaciones nuevas o rechazadas');
    }
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error: any) {
    logger.error('Error al eliminar cotización:', error);
    throw new Error(error.message || 'Error al eliminar cotización');
  }
}
