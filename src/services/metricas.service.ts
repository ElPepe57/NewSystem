/**
 * Servicio de Métricas Transversales
 *
 * Actualiza automáticamente las métricas en el Gestor Maestro cuando ocurren eventos
 * en otros módulos (ventas, compras, investigaciones, cotizaciones).
 *
 * Este servicio es el "cerebro" que conecta la información transversal del negocio.
 */

import {
  doc,
  updateDoc,
  increment,
  arrayUnion,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import type { Venta } from '../types/venta.types';
import type { OrdenCompra } from '../types/ordenCompra.types';

const CLIENTES_COLLECTION = 'clientes';
const MARCAS_COLLECTION = 'marcas';

export const metricasService = {
  /**
   * Actualizar métricas del cliente después de una venta
   *
   * Se llama cuando:
   * - Se confirma una venta
   * - Se completa el pago de una venta
   * - Se entrega una venta
   */
  async actualizarMetricasClientePorVenta(
    clienteId: string,
    datosVenta: { totalPEN: number; productos: Array<{ sku: string; marca: string; nombreComercial: string }> }
  ): Promise<void> {
    if (!clienteId) return;

    try {
      const clienteRef = doc(db, CLIENTES_COLLECTION, clienteId);

      // Extraer productos únicos para favoritos
      const productosComprados = datosVenta.productos?.map(p => `${p.marca} ${p.nombreComercial}`) || [];

      const updates: Record<string, unknown> = {
        'metricas.totalCompras': increment(1),
        'metricas.montoTotalPEN': increment(datosVenta.totalPEN),
        'metricas.ultimaCompra': serverTimestamp(),
        fechaActualizacion: serverTimestamp()
      };

      // Agregar productos a frecuentes (máximo 10)
      if (productosComprados.length > 0) {
        updates['metricas.productosFrecuentes'] = arrayUnion(...productosComprados.slice(0, 3));
      }

      await updateDoc(clienteRef, updates);
      logger.success(`Métricas actualizadas para cliente ${clienteId}`);
    } catch (error: any) {
      console.error('Error actualizando métricas del cliente:', error);
      // No lanzamos error para no interrumpir el flujo principal
    }
  },

  /**
   * Actualizar métricas de la marca después de una venta
   *
   * Se llama cuando se completa una venta con productos de esa marca
   */
  async actualizarMetricasMarcaPorVenta(
    marcaId: string,
    datosVenta: {
      unidadesVendidas: number;
      ventaTotalPEN: number;
      margenReal?: number;
    }
  ): Promise<void> {
    if (!marcaId) return;

    try {
      const marcaRef = doc(db, MARCAS_COLLECTION, marcaId);

      const updates: Record<string, unknown> = {
        'metricas.unidadesVendidas': increment(datosVenta.unidadesVendidas),
        'metricas.ventasTotalPEN': increment(datosVenta.ventaTotalPEN),
        fechaActualizacion: serverTimestamp()
      };

      // Actualizar margen promedio si se proporciona
      // Nota: Esto es una simplificación. En producción, calcularíamos el promedio ponderado
      if (datosVenta.margenReal !== undefined) {
        updates['metricas.ultimoMargen'] = datosVenta.margenReal;
      }

      await updateDoc(marcaRef, updates);
      logger.success(`Métricas actualizadas para marca ${marcaId}`);
    } catch (error: any) {
      console.error('Error actualizando métricas de marca:', error);
    }
  },

  /**
   * Incrementar contador de productos activos de una marca
   *
   * Se llama cuando se crea un nuevo producto con esa marca
   */
  async incrementarProductosMarca(marcaId: string): Promise<void> {
    if (!marcaId) return;

    try {
      const marcaRef = doc(db, MARCAS_COLLECTION, marcaId);
      await updateDoc(marcaRef, {
        'metricas.productosActivos': increment(1),
        fechaActualizacion: serverTimestamp()
      });
      logger.success(`Productos activos incrementados para marca ${marcaId}`);
    } catch (error: any) {
      console.error('Error incrementando productos de marca:', error);
    }
  },

  /**
   * Decrementar contador de productos activos de una marca
   *
   * Se llama cuando se desactiva o elimina un producto de esa marca
   */
  async decrementarProductosMarca(marcaId: string): Promise<void> {
    if (!marcaId) return;

    try {
      const marcaRef = doc(db, MARCAS_COLLECTION, marcaId);
      await updateDoc(marcaRef, {
        'metricas.productosActivos': increment(-1),
        fechaActualizacion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error decrementando productos de marca:', error);
    }
  },

  /**
   * Actualizar ticket promedio del cliente
   *
   * Se debe llamar después de actualizar el total de compras y monto
   */
  async recalcularTicketPromedioCliente(
    clienteId: string,
    totalCompras: number,
    montoTotalPEN: number
  ): Promise<void> {
    if (!clienteId || totalCompras === 0) return;

    try {
      const ticketPromedio = montoTotalPEN / totalCompras;
      const clienteRef = doc(db, CLIENTES_COLLECTION, clienteId);

      await updateDoc(clienteRef, {
        'metricas.ticketPromedio': ticketPromedio,
        fechaActualizacion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error recalculando ticket promedio:', error);
    }
  },

  /**
   * Registrar interacción con el cliente
   *
   * Se llama cuando hay cualquier interacción (cotización, consulta, etc.)
   */
  async registrarInteraccionCliente(
    clienteId: string,
    tipoInteraccion: 'cotizacion' | 'consulta' | 'reclamo' | 'seguimiento'
  ): Promise<void> {
    if (!clienteId) return;

    try {
      const clienteRef = doc(db, CLIENTES_COLLECTION, clienteId);

      await updateDoc(clienteRef, {
        ultimaInteraccion: serverTimestamp(),
        [`contadorInteracciones.${tipoInteraccion}`]: increment(1),
        fechaActualizacion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error registrando interacción:', error);
    }
  },

  /**
   * Actualizar proveedores preferidos de una marca
   *
   * Se llama cuando se hace una compra exitosa a un proveedor con productos de esa marca
   */
  async actualizarProveedorPreferidoMarca(
    marcaId: string,
    proveedorId: string
  ): Promise<void> {
    if (!marcaId || !proveedorId) return;

    try {
      const marcaRef = doc(db, MARCAS_COLLECTION, marcaId);
      await updateDoc(marcaRef, {
        proveedoresPreferidos: arrayUnion(proveedorId),
        fechaActualizacion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error actualizando proveedor preferido:', error);
    }
  },

  /**
   * Procesar una venta completa y actualizar todas las métricas relacionadas
   *
   * Este es el método principal que se debe llamar cuando se completa una venta.
   * Actualiza automáticamente cliente, marcas y cualquier otra entidad relacionada.
   */
  async procesarVentaCompleta(
    venta: Venta,
    marcaIds?: Map<string, string> // Map de SKU -> marcaId
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    // 1. Actualizar métricas del cliente
    if (venta.clienteId) {
      promises.push(
        this.actualizarMetricasClientePorVenta(venta.clienteId, {
          totalPEN: venta.totalPEN,
          productos: venta.productos.map(p => ({
            sku: p.sku,
            marca: p.marca,
            nombreComercial: p.nombreComercial
          }))
        })
      );
    }

    // 2. Actualizar métricas de las marcas (si se proporcionan los IDs)
    if (marcaIds && marcaIds.size > 0) {
      // Agrupar productos por marca
      const ventasPorMarca = new Map<string, { unidades: number; total: number }>();

      for (const producto of venta.productos) {
        const marcaId = marcaIds.get(producto.sku);
        if (marcaId) {
          const actual = ventasPorMarca.get(marcaId) || { unidades: 0, total: 0 };
          ventasPorMarca.set(marcaId, {
            unidades: actual.unidades + producto.cantidad,
            total: actual.total + producto.subtotal
          });
        }
      }

      // Actualizar cada marca
      for (const [marcaId, datos] of ventasPorMarca) {
        promises.push(
          this.actualizarMetricasMarcaPorVenta(marcaId, {
            unidadesVendidas: datos.unidades,
            ventaTotalPEN: datos.total,
            margenReal: venta.margenPromedio
          })
        );
      }
    }

    // Ejecutar todas las actualizaciones en paralelo
    await Promise.allSettled(promises);
    logger.success('Métricas de venta procesadas');
  }
};
